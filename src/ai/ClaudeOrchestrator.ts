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
import * as fs from 'fs/promises';
import * as path from 'path';

export interface ClaudeOrchestratorConfig {
  maxConcurrent?: number;
  model?: string;
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
      model: 'claude-3-sonnet',
      retryAttempts: 2,
      retryDelay: 1000,
      timeout: 300000, // 5 minutes
      outputFormat: 'json',
      verbose: false,
      ...config
    };
    
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

      if (this.config.verbose) {
        console.log(`Executing Claude for task ${task.id}...`);
      }

      const claude = spawn('claude', args, {
        env: { ...process.env },
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