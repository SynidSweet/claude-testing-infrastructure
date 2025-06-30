/**
 * Claude Orchestrator
 * 
 * Manages parallel Claude processes for AI test generation:
 * - Process pool management
 * - Task queue and scheduling
 * - Result aggregation
 * - Error handling and retries
 */

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { AITask, AITaskBatch, AITaskResult } from './AITaskPreparation';
import { ChunkedAITask } from './ChunkedAITaskPreparation';
import * as fs from 'fs/promises';
import * as path from 'path';
import { validateModelConfiguration } from '../utils/model-mapping';

export interface ClaudeOrchestratorConfig {
  maxConcurrent?: number;
  model?: string;
  fallbackModel?: string;
  retryAttempts?: number;
  retryDelay?: number;
  timeout?: number;
  outputFormat?: 'json' | 'text';
  verbose?: boolean;
}

export interface ProcessResult {
  taskId: string;
  success: boolean;
  result?: AITaskResult;
  error?: string;
}

export interface OrchestratorStats {
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  totalTokensUsed: number;
  totalCost: number;
  totalDuration: number;
  startTime: Date;
  endTime?: Date;
}

export class ClaudeOrchestrator extends EventEmitter {
  private activeProcesses = new Map<string, ChildProcess>();
  private taskQueue: AITask[] = [];
  private results: ProcessResult[] = [];
  private stats: OrchestratorStats;
  private isRunning = false;

  constructor(private config: ClaudeOrchestratorConfig = {}) {
    super();
    this.config = {
      maxConcurrent: 3,
      model: 'opus', // Use alias for latest model with Max subscription
      fallbackModel: 'sonnet', // Automatic fallback when usage limits reached
      retryAttempts: 2,
      retryDelay: 1000,
      timeout: 900000, // 15 minutes (increased for complex analysis)
      outputFormat: 'json',
      verbose: false,
      ...config
    };
    
    // Validate model configuration on construction
    if (this.config.model) {
      const validation = validateModelConfiguration(this.config.model);
      if (!validation.valid) {
        console.warn(`ClaudeOrchestrator: ${validation.error}. ${validation.suggestion}`);
        this.config.model = 'claude-3-5-sonnet-20241022'; // Fallback to default
      } else {
        this.config.model = validation.resolvedName!;
      }
    }
    
    if (this.config.fallbackModel) {
      const validation = validateModelConfiguration(this.config.fallbackModel);
      if (!validation.valid) {
        console.warn(`ClaudeOrchestrator fallback model: ${validation.error}. ${validation.suggestion}`);
        this.config.fallbackModel = 'claude-3-haiku-20240307'; // Fallback to cheapest
      } else {
        this.config.fallbackModel = validation.resolvedName!;
      }
    }
    
    this.stats = this.resetStats();
  }

  /**
   * Process a batch of AI tasks
   */
  async processBatch(batch: AITaskBatch): Promise<ProcessResult[]> {
    if (this.isRunning) {
      throw new Error('Orchestrator is already running');
    }

    this.isRunning = true;
    this.results = [];
    this.stats = this.resetStats();
    this.stats.totalTasks = batch.tasks.length;
    
    // Initialize task queue
    this.taskQueue = [...batch.tasks];
    
    // Update max concurrency from batch if specified
    const maxConcurrent = Math.min(
      batch.maxConcurrency || this.config.maxConcurrent!,
      this.config.maxConcurrent!
    );

    this.emit('batch:start', { batch, stats: this.stats });

    try {
      // Start initial concurrent processes
      const promises: Promise<void>[] = [];
      for (let i = 0; i < Math.min(maxConcurrent, this.taskQueue.length); i++) {
        promises.push(this.processNextTask());
      }

      // Wait for all tasks to complete
      await Promise.all(promises);
      
      // Handle chunked results merging
      if (this.hasChunkedTasks(batch)) {
        await this.mergeChunkedResults(batch.tasks as ChunkedAITask[]);
      }
      
      this.stats.endTime = new Date();
      this.emit('batch:complete', { results: this.results, stats: this.stats });
      
      return this.results;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Process the next task in the queue
   */
  private async processNextTask(): Promise<void> {
    while (this.taskQueue.length > 0) {
      const task = this.taskQueue.shift();
      if (!task) break;

      await this.processTask(task);
    }
  }

  /**
   * Process a single task
   */
  private async processTask(task: AITask, attemptNumber = 1): Promise<void> {
    const startTime = Date.now();
    
    this.emit('task:start', { task, attemptNumber });
    
    try {
      const result = await this.executeClaudeProcess(task);
      
      const processResult: ProcessResult = {
        taskId: task.id,
        success: true,
        result: {
          generatedTests: result.output,
          tokensUsed: result.tokensUsed || task.estimatedTokens,
          actualCost: result.cost || task.estimatedCost,
          duration: Date.now() - startTime
        }
      };

      // Update stats
      this.stats.completedTasks++;
      this.stats.totalTokensUsed += processResult.result!.tokensUsed;
      this.stats.totalCost += processResult.result!.actualCost;
      this.stats.totalDuration += processResult.result!.duration;

      // Save generated tests
      await this.saveGeneratedTests(task, processResult.result!.generatedTests);
      
      this.results.push(processResult);
      this.emit('task:complete', { task, result: processResult });
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Retry logic
      if (attemptNumber < (this.config.retryAttempts || 2)) {
        this.emit('task:retry', { task, attemptNumber, error: errorMessage });
        await this.delay(this.config.retryDelay || 1000);
        await this.processTask(task, attemptNumber + 1);
        return;
      }

      // Final failure
      const processResult: ProcessResult = {
        taskId: task.id,
        success: false,
        error: errorMessage
      };

      this.stats.failedTasks++;
      this.results.push(processResult);
      this.emit('task:failed', { task, error: errorMessage });
    }
  }

  /**
   * Execute Claude process for a task
   */
  private executeClaudeProcess(task: AITask): Promise<{
    output: string;
    tokensUsed?: number;
    cost?: number;
  }> {
    return new Promise((resolve, reject) => {
      const args = [
        '-p', task.prompt,
        '--model', this.config.model!,
        '--output-format', this.config.outputFormat!
      ];

      // Add fallback model if configured (helps with Max subscription limits)
      if (this.config.fallbackModel) {
        args.push('--fallback-model', this.config.fallbackModel);
      }

      if (this.config.verbose) {
        console.log(`Executing Claude for task ${task.id}...`);
      }

      // Set up environment with extended timeouts for headless AI generation
      const claudeEnv = {
        ...process.env,
        // Only affect this specific headless Claude process, not interactive sessions
        BASH_DEFAULT_TIMEOUT_MS: String(this.config.timeout),
        BASH_MAX_TIMEOUT_MS: String(this.config.timeout)
      };

      const claude = spawn('claude', args, {
        env: claudeEnv,
        shell: false
      });

      let stdout = '';
      let stderr = '';
      let timeout: NodeJS.Timeout;

      // Set up timeout
      if (this.config.timeout) {
        timeout = setTimeout(() => {
          claude.kill('SIGTERM');
          reject(new Error(`Process timed out after ${this.config.timeout}ms`));
        }, this.config.timeout);
      }

      // Store active process
      this.activeProcesses.set(task.id, claude);

      claude.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      claude.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      claude.on('error', (error) => {
        clearTimeout(timeout);
        this.activeProcesses.delete(task.id);
        reject(new Error(`Failed to spawn Claude process: ${error.message}`));
      });

      claude.on('close', (code) => {
        clearTimeout(timeout);
        this.activeProcesses.delete(task.id);

        if (code !== 0) {
          reject(new Error(`Claude process exited with code ${code}: ${stderr}`));
          return;
        }

        try {
          if (this.config.outputFormat === 'json') {
            const result = JSON.parse(stdout);
            resolve({
              output: result.result || result.output || '',
              tokensUsed: result.usage?.total_tokens,
              cost: result.total_cost_usd
            });
          } else {
            resolve({ output: stdout });
          }
        } catch (error) {
          reject(new Error(`Failed to parse Claude output: ${error}`));
        }
      });
    });
  }

  /**
   * Check if batch contains chunked tasks
   */
  private hasChunkedTasks(batch: AITaskBatch): boolean {
    return batch.tasks.some(task => 
      (task as ChunkedAITask).isChunked !== undefined
    );
  }

  /**
   * Merge results from chunked tasks
   */
  private async mergeChunkedResults(tasks: ChunkedAITask[]): Promise<void> {
    console.log('Merging chunked results...');
    
    // Get successful results
    const successfulResults = new Map<string, string>();
    this.results.forEach(result => {
      if (result.success && result.result?.generatedTests) {
        successfulResults.set(result.taskId, result.result.generatedTests);
      }
    });

    // Merge chunked results
    const mergedResults = ClaudeOrchestrator.mergeChunkedResults(tasks, successfulResults);
    
    // Write merged results to files
    for (const [sourceFile, mergedContent] of mergedResults) {
      const task = tasks.find(t => t.sourceFile === sourceFile);
      if (task) {
        console.log(`Writing merged results for ${sourceFile}`);
        await this.saveGeneratedTests(task, mergedContent);
      }
    }
  }

  /**
   * Static method to merge chunked results
   */
  private static mergeChunkedResults(
    tasks: ChunkedAITask[],
    results: Map<string, string>
  ): Map<string, string> {
    // Dynamic import to avoid circular dependency
    const { ChunkedAITaskPreparation } = require('./ChunkedAITaskPreparation');
    return ChunkedAITaskPreparation.mergeChunkedResults(tasks, results);
  }

  /**
   * Save generated tests to file
   */
  private async saveGeneratedTests(task: AITask, tests: string): Promise<void> {
    const testDir = path.dirname(task.testFile);
    await fs.mkdir(testDir, { recursive: true });
    
    // Check if test file already exists
    let existingContent = '';
    try {
      existingContent = await fs.readFile(task.testFile, 'utf-8');
    } catch {
      // File doesn't exist yet
    }

    if (existingContent) {
      // Append logical tests to existing file
      const updatedContent = `${existingContent}\n\n// AI-Generated Logical Tests\n${tests}`;
      await fs.writeFile(task.testFile, updatedContent, 'utf-8');
    } else {
      // Create new file with generated tests
      await fs.writeFile(task.testFile, tests, 'utf-8');
    }
  }

  /**
   * Kill all active processes
   */
  async killAll(): Promise<void> {
    const promises: Promise<void>[] = [];
    
    for (const [taskId, process] of this.activeProcesses) {
      promises.push(new Promise<void>((resolve) => {
        process.on('close', () => {
          this.activeProcesses.delete(taskId);
          resolve();
        });
        process.kill('SIGTERM');
      }));
    }

    await Promise.all(promises);
  }

  /**
   * Generate execution report
   */
  generateReport(): string {
    const duration = this.stats.endTime 
      ? (this.stats.endTime.getTime() - this.stats.startTime.getTime()) / 1000
      : 0;

    const avgDuration = this.stats.completedTasks > 0
      ? (this.stats.totalDuration / this.stats.completedTasks / 1000).toFixed(1)
      : '0';

    const avgCost = this.stats.completedTasks > 0
      ? (this.stats.totalCost / this.stats.completedTasks).toFixed(4)
      : '0';

    const report = [
      '# Claude Orchestrator Execution Report',
      '',
      '## Summary',
      `- Total Tasks: ${this.stats.totalTasks}`,
      `- Completed: ${this.stats.completedTasks} (${((this.stats.completedTasks / this.stats.totalTasks) * 100).toFixed(1)}%)`,
      `- Failed: ${this.stats.failedTasks} (${((this.stats.failedTasks / this.stats.totalTasks) * 100).toFixed(1)}%)`,
      `- Total Duration: ${duration.toFixed(1)}s`,
      `- Average Task Duration: ${avgDuration}s`,
      '',
      '## Resource Usage',
      `- Total Tokens: ${this.stats.totalTokensUsed.toLocaleString()}`,
      `- Total Cost: $${this.stats.totalCost.toFixed(2)}`,
      `- Average Cost per Task: $${avgCost}`,
      '',
      '## Configuration',
      `- Model: ${this.config.model}`,
      `- Fallback Model: ${this.config.fallbackModel || 'None'}`,
      `- Max Concurrent: ${this.config.maxConcurrent}`,
      `- Retry Attempts: ${this.config.retryAttempts}`,
      ''
    ];

    if (this.stats.failedTasks > 0) {
      report.push('## Failed Tasks');
      const failedResults = this.results.filter(r => !r.success);
      failedResults.forEach(result => {
        report.push(`- Task ${result.taskId}: ${result.error}`);
      });
    }

    return report.join('\n');
  }

  /**
   * Reset statistics
   */
  private resetStats(): OrchestratorStats {
    return {
      totalTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      totalTokensUsed: 0,
      totalCost: 0,
      totalDuration: 0,
      startTime: new Date()
    };
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}