/**
 * Claude Orchestrator
 *
 * Manages parallel Claude processes for AI test generation:
 * - Process pool management
 * - Task queue and scheduling
 * - Result aggregation
 * - Error handling and retries
 */

import type { ChildProcess } from 'child_process';
import { spawn, execSync } from 'child_process';
import { EventEmitter } from 'events';
import type { AITask, AITaskBatch, AITaskResult } from './AITaskPreparation';
import type { ChunkedAITask } from './ChunkedAITaskPreparation';
import * as fs from 'fs/promises';
import * as path from 'path';
import { validateModelConfiguration } from '../utils/model-mapping';
import { 
  AIAuthenticationError, 
  AITimeoutError, 
  AIRateLimitError,
  AINetworkError,
  type AIProgressUpdate 
} from '../types/ai-error-types';
import { withRetry, CircuitBreaker } from '../utils/retry-helper';
import { logger } from '../utils/logger';
import { createStderrParser, type ParsedError } from '../utils/stderr-parser';

export interface ClaudeOrchestratorConfig {
  maxConcurrent?: number;
  model?: string;
  fallbackModel?: string;
  retryAttempts?: number;
  retryDelay?: number;
  timeout?: number;
  outputFormat?: 'json' | 'text';
  verbose?: boolean;
  gracefulDegradation?: boolean;
  exponentialBackoff?: boolean;
  circuitBreakerEnabled?: boolean;
  maxRetryDelay?: number;
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

interface ProcessHeartbeat {
  taskId: string;
  process: ChildProcess;
  lastActivity: Date;
  stdoutBytes: number;
  stderrBytes: number;
  checkInterval?: NodeJS.Timeout;
  timeoutProgress?: NodeJS.Timeout;
  warningThresholds?: Set<number>;
  startTime?: Date;
  resourceUsage?: {
    cpu?: number;
    memory?: number;
  };
  lastStdinCheck?: Date;
  isWaitingForInput?: boolean;
  consecutiveSlowChecks?: number;
  lastProgressMarker?: string;
  progressHistory?: Array<{
    timestamp: Date;
    bytes: number;
    marker?: string;
  }>;
}

export class ClaudeOrchestrator extends EventEmitter {
  private activeProcesses = new Map<string, ChildProcess>();
  private processHeartbeats = new Map<string, ProcessHeartbeat>();
  private taskQueue: AITask[] = [];
  private results: ProcessResult[] = [];
  private stats: OrchestratorStats;
  private isRunning = false;
  private circuitBreaker: CircuitBreaker | null = null;
  private isGracefullyDegraded = false;
  private readonly HEARTBEAT_INTERVAL = 30000; // 30 seconds
  private readonly DEAD_PROCESS_THRESHOLD = 120000; // 2 minutes of no activity

  constructor(private config: ClaudeOrchestratorConfig = {}) {
    super();
    this.config = {
      maxConcurrent: 3,
      model: 'opus', // Use alias for latest model with Max subscription
      fallbackModel: 'sonnet', // Automatic fallback when usage limits reached
      retryAttempts: 3,
      retryDelay: 1000,
      timeout: 900000, // 15 minutes (increased for complex analysis)
      outputFormat: 'json',
      verbose: false,
      gracefulDegradation: true,
      exponentialBackoff: true,
      circuitBreakerEnabled: true,
      maxRetryDelay: 30000, // 30 seconds max retry delay
      ...config,
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
        console.warn(
          `ClaudeOrchestrator fallback model: ${validation.error}. ${validation.suggestion}`
        );
        this.config.fallbackModel = 'claude-3-haiku-20240307'; // Fallback to cheapest
      } else {
        this.config.fallbackModel = validation.resolvedName!;
      }
    }

    this.stats = this.resetStats();

    // Initialize circuit breaker if enabled
    if (this.config.circuitBreakerEnabled) {
      this.circuitBreaker = new CircuitBreaker(5, 60000); // 5 failures, 1 minute recovery
    }
  }

  /**
   * Validate Claude CLI authentication
   */
  async validateClaudeAuth(): Promise<{ authenticated: boolean; error?: string; canDegrade?: boolean }> {
    try {
      // Try to check Claude CLI version (basic check if Claude CLI exists)
      execSync('claude --version', { stdio: 'ignore' });
      
      // Check if Claude CLI is properly authenticated using a minimal command
      // The 'claude config get' command will fail if not authenticated
      const configCheck = execSync('claude config get 2>&1', { encoding: 'utf-8' });
      
      // If we can get config, we're authenticated
      if (configCheck && !configCheck.includes('error') && !configCheck.includes('login')) {
        this.isGracefullyDegraded = false;
        return { authenticated: true };
      }
      
      return { 
        authenticated: false, 
        error: 'Claude CLI not authenticated. Please run Claude Code interactively to authenticate.',
        canDegrade: this.config.gracefulDegradation || false
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      if (errorMessage.includes('ENOENT') || errorMessage.includes('not found')) {
        return { 
          authenticated: false, 
          error: 'Claude CLI not found. Please ensure Claude Code is installed and available in PATH.',
          canDegrade: this.config.gracefulDegradation || false
        };
      }
      
      if (errorMessage.includes('login') || errorMessage.includes('authenticate')) {
        return { 
          authenticated: false, 
          error: 'Claude CLI not authenticated. Please run Claude Code interactively to authenticate.',
          canDegrade: this.config.gracefulDegradation || false
        };
      }
      
      // Generic error
      return { 
        authenticated: false, 
        error: `Failed to check Claude CLI authentication: ${errorMessage}`,
        canDegrade: this.config.gracefulDegradation || false
      };
    }
  }

  /**
   * Start heartbeat monitoring for a process
   */
  private startHeartbeatMonitoring(taskId: string, process: ChildProcess): void {
    const heartbeat: ProcessHeartbeat = {
      taskId,
      process,
      lastActivity: new Date(),
      stdoutBytes: 0,
      stderrBytes: 0,
      startTime: new Date(),
      warningThresholds: new Set([50, 75, 90]),
      lastStdinCheck: new Date(),
      isWaitingForInput: false,
      consecutiveSlowChecks: 0,
      progressHistory: [],
    };

    // Set up periodic heartbeat checks
    const intervalFn = () => {
      this.checkProcessHealth(taskId);
    };
    heartbeat.checkInterval = setInterval(intervalFn, this.HEARTBEAT_INTERVAL);
    
    // Run initial check immediately
    intervalFn();

    this.processHeartbeats.set(taskId, heartbeat);
  }

  /**
   * Stop heartbeat monitoring for a process
   */
  private stopHeartbeatMonitoring(taskId: string): void {
    const heartbeat = this.processHeartbeats.get(taskId);
    if (heartbeat) {
      if (heartbeat.checkInterval) {
        clearInterval(heartbeat.checkInterval);
      }
      if (heartbeat.timeoutProgress) {
        clearInterval(heartbeat.timeoutProgress);
      }
      this.processHeartbeats.delete(taskId);
    }
  }

  /**
   * Update activity timestamp for a process
   */
  private updateProcessActivity(taskId: string, bytesReceived: number, isStdout: boolean, data?: string): void {
    const heartbeat = this.processHeartbeats.get(taskId);
    if (heartbeat) {
      heartbeat.lastActivity = new Date();
      heartbeat.consecutiveSlowChecks = 0; // Reset slow check counter on activity
      
      if (isStdout) {
        heartbeat.stdoutBytes += bytesReceived;
      } else {
        heartbeat.stderrBytes += bytesReceived;
      }
      
      // Track progress history
      if (heartbeat.progressHistory) {
        const marker = this.detectProgressMarker(data);
        heartbeat.progressHistory.push({
          timestamp: new Date(),
          bytes: bytesReceived,
          ...(marker && { marker }),
        });
        
        // Keep only last 50 entries to avoid memory growth
        if (heartbeat.progressHistory.length > 50) {
          heartbeat.progressHistory = heartbeat.progressHistory.slice(-50);
        }
      }
      
      // Clear waiting for input flag on any activity
      heartbeat.isWaitingForInput = false;
    }
  }
  
  /**
   * Detect progress markers in output that indicate the AI is working
   */
  private detectProgressMarker(data?: string): string | undefined {
    if (!data) return undefined;
    
    // Common progress indicators from Claude CLI
    const progressMarkers = [
      'Analyzing',
      'Generating',
      'Processing',
      'Creating tests',
      'Writing test',
      'Test case',
      'describe(',
      'it(',
      'test(',
      'def test_',
      'class Test',
    ];
    
    for (const marker of progressMarkers) {
      if (data.includes(marker)) {
        return marker;
      }
    }
    
    return undefined;
  }

  /**
   * Capture resource usage for a process
   */
  private captureResourceUsage(pid?: number): { cpu?: number; memory?: number } | undefined {
    if (!pid) return undefined;
    
    try {
      // Try to get basic process info using ps command (cross-platform with some differences)
      const psOutput = execSync(`ps -p ${pid} -o %cpu,%mem 2>/dev/null || echo ""`, { 
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'ignore']
      }).trim();
      
      if (psOutput) {
        const lines = psOutput.split('\n');
        if (lines.length > 1 && lines[1]) {
          const stats = lines[1].trim().split(/\s+/);
          if (stats.length >= 2 && stats[0] && stats[1]) {
            return {
              cpu: parseFloat(stats[0]) || 0,
              memory: parseFloat(stats[1]) || 0,
            };
          }
        }
      }
    } catch (error) {
      // Process might have ended or ps command not available
      logger.debug(`Failed to capture resource usage for PID ${pid}: ${error}`);
    }
    
    return undefined;
  }

  /**
   * Check if a process is healthy
   */
  private checkProcessHealth(taskId: string): void {
    const heartbeat = this.processHeartbeats.get(taskId);
    if (!heartbeat) return;

    const timeSinceLastActivity = Date.now() - heartbeat.lastActivity.getTime();
    const timeSinceStart = Date.now() - (heartbeat.startTime?.getTime() || Date.now());
    
    // Enhanced heuristics for determining process health
    const processMetrics = this.analyzeProcessHealth(heartbeat, timeSinceLastActivity, timeSinceStart);
    
    // Check if process might be waiting for input
    if (this.checkForInputWait(heartbeat, timeSinceLastActivity)) {
      logger.warn(`Process ${taskId} may be waiting for input - no activity for ${timeSinceLastActivity / 1000}s`);
      
      this.emit('process:waiting-input', {
        taskId,
        lastActivity: heartbeat.lastActivity,
        bytesReceived: heartbeat.stdoutBytes + heartbeat.stderrBytes,
        timeSinceLastActivity,
      });
      
      // Don't kill processes that might be waiting for input yet
      return;
    }
    
    // Check if process appears to be dead
    if (processMetrics.isDead) {
      logger.warn(`Process ${taskId} appears to be dead - ${processMetrics.reason}`);
      
      // Emit warning event
      this.emit('process:dead', {
        taskId,
        lastActivity: heartbeat.lastActivity,
        bytesReceived: heartbeat.stdoutBytes + heartbeat.stderrBytes,
        timeSinceLastActivity,
        reason: processMetrics.reason,
        metrics: processMetrics,
      });

      // Try to kill the process if it's still running
      if (heartbeat.process && !heartbeat.process.killed) {
        logger.warn(`Attempting to kill dead process ${taskId}`);
        heartbeat.process.kill('SIGTERM');
        setTimeout(() => {
          if (heartbeat.process && !heartbeat.process.killed) {
            heartbeat.process.kill('SIGKILL');
          }
        }, 5000);
      }

      // Stop monitoring this process
      this.stopHeartbeatMonitoring(taskId);
    } else if (processMetrics.isSlow) {
      // Process is slow but not dead yet
      heartbeat.consecutiveSlowChecks = (heartbeat.consecutiveSlowChecks || 0) + 1;
      
      logger.info(`Process ${taskId} is slow - ${processMetrics.reason}`);
      
      this.emit('process:slow', {
        taskId,
        lastActivity: heartbeat.lastActivity,
        bytesReceived: heartbeat.stdoutBytes + heartbeat.stderrBytes,
        timeSinceLastActivity,
        consecutiveSlowChecks: heartbeat.consecutiveSlowChecks,
        reason: processMetrics.reason,
        metrics: processMetrics,
      });
    }
  }
  
  /**
   * Analyze process health with multiple metrics
   */
  private analyzeProcessHealth(
    heartbeat: ProcessHeartbeat, 
    timeSinceLastActivity: number,
    timeSinceStart: number
  ): {
    isDead: boolean;
    isSlow: boolean;
    reason: string;
    hasProgressMarkers: boolean;
    bytesPerSecond: number;
    isEarlyPhase: boolean;
  } {
    const bytesReceived = heartbeat.stdoutBytes + heartbeat.stderrBytes;
    const bytesPerSecond = timeSinceStart > 0 ? (bytesReceived / timeSinceStart) * 1000 : 0;
    const isEarlyPhase = timeSinceStart < 60000; // First minute
    
    // Check if we've seen progress markers recently
    const recentProgressMarkers = heartbeat.progressHistory?.filter(
      entry => entry.marker && (Date.now() - entry.timestamp.getTime() < 60000)
    ).length || 0;
    
    // Enhanced dead detection heuristics
    let isDead = false;
    let isSlow = false;
    let reason = '';
    
    if (timeSinceLastActivity > this.DEAD_PROCESS_THRESHOLD) {
      // But be more lenient if we've seen progress markers
      if (recentProgressMarkers > 0) {
        isDead = false;
        isSlow = true;
        reason = `no activity for ${timeSinceLastActivity / 1000}s but recent progress markers detected`;
      } else if (isEarlyPhase && bytesReceived === 0) {
        // Early phase with no output might be normal startup
        isDead = false;
        isSlow = true;
        reason = `early phase with no output yet (${timeSinceStart / 1000}s since start)`;
      } else {
        isDead = true;
        reason = `no activity for ${timeSinceLastActivity / 1000}s with no recent progress`;
      }
    } else if (timeSinceLastActivity > this.HEARTBEAT_INTERVAL) {
      isSlow = true;
      
      if (bytesPerSecond < 0.1 && !isEarlyPhase) {
        reason = `very low output rate (${bytesPerSecond.toFixed(2)} bytes/sec)`;
      } else if (heartbeat.consecutiveSlowChecks && heartbeat.consecutiveSlowChecks > 3) {
        reason = `consistently slow (${heartbeat.consecutiveSlowChecks} consecutive slow checks)`;
      } else {
        reason = `no activity for ${timeSinceLastActivity / 1000}s`;
      }
    }
    
    return {
      isDead,
      isSlow,
      reason,
      hasProgressMarkers: recentProgressMarkers > 0,
      bytesPerSecond,
      isEarlyPhase,
    };
  }
  
  /**
   * Check if process might be waiting for input
   */
  private checkForInputWait(heartbeat: ProcessHeartbeat, timeSinceLastActivity: number): boolean {
    // Only check if we haven't had activity in a while
    if (timeSinceLastActivity < 30000) return false;
    
    // Check if the last output might indicate waiting for input
    const recentHistory = heartbeat.progressHistory?.slice(-5) || [];
    const hasRecentSmallOutput = recentHistory.some(entry => entry.bytes < 50);
    
    // If we've had only small outputs recently, might be prompts
    if (hasRecentSmallOutput && heartbeat.stdoutBytes < 1000) {
      heartbeat.isWaitingForInput = true;
      heartbeat.lastStdinCheck = new Date();
      return true;
    }
    
    return false;
  }

  /**
   * Process a batch of AI tasks
   */
  async processBatch(batch: AITaskBatch): Promise<ProcessResult[]> {
    if (this.isRunning) {
      throw new Error('Orchestrator is already running');
    }
    
    // Emit progress for authentication check
    this.emit('progress', {
      taskId: 'auth-check',
      phase: 'authenticating',
      progress: 0,
      message: 'Validating Claude CLI authentication...'
    } as AIProgressUpdate);
    
    // Validate Claude CLI authentication before starting
    const authStatus = await this.validateClaudeAuth();
    if (!authStatus.authenticated) {
      if (authStatus.canDegrade) {
        // Enable graceful degradation mode
        this.isGracefullyDegraded = true;
        logger.warn('Claude CLI not available - entering graceful degradation mode');
        this.emit('degradation:enabled', {
          reason: authStatus.error,
          message: 'AI test generation will return placeholder tests. Install Claude Code for full functionality.'
        });
      } else {
        throw new AIAuthenticationError(authStatus.error || 'Authentication failed');
      }
    }
    
    this.emit('progress', {
      taskId: 'auth-check',
      phase: 'authenticating',
      progress: 100,
      message: 'Authentication validated successfully'
    } as AIProgressUpdate);

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
      this.cleanupAllHeartbeats();
    }
  }
  
  /**
   * Cleanup all heartbeat monitors
   */
  private cleanupAllHeartbeats(): void {
    for (const taskId of this.processHeartbeats.keys()) {
      this.stopHeartbeatMonitoring(taskId);
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
  private async processTask(task: AITask): Promise<void> {
    const startTime = Date.now();

    this.emit('task:start', { task });
    
    // Emit progress update
    this.emit('progress', {
      taskId: task.id,
      phase: 'preparing',
      progress: 0,
      message: `Processing task ${task.id}`,
      estimatedTimeRemaining: task.estimatedTokens * 10 // rough estimate: 10ms per token
    } as AIProgressUpdate);

    // Handle graceful degradation
    if (this.isGracefullyDegraded) {
      await this.handleDegradedTask(task, startTime);
      return;
    }

    // Use retry helper with exponential backoff
    const retryResult = await withRetry(
      async () => {
        // Use circuit breaker if enabled
        if (this.circuitBreaker) {
          return await this.circuitBreaker.execute(() => this.executeClaudeProcess(task));
        } else {
          return await this.executeClaudeProcess(task);
        }
      },
      {
        maxAttempts: this.config.retryAttempts || 3,
        initialDelay: this.config.retryDelay || 1000,
        maxDelay: this.config.maxRetryDelay || 30000,
        backoffFactor: 2,
        jitter: true,
        retryableErrors: [AITimeoutError, AINetworkError, AIRateLimitError],
        onRetry: (error, attempt, delay) => {
          this.emit('task:retry', { 
            task, 
            attemptNumber: attempt, 
            error: error.message,
            nextRetryIn: delay 
          });
          
          // Update progress
          this.emit('progress', {
            taskId: task.id,
            phase: 'preparing',
            progress: 0,
            message: `Retrying task ${task.id} (attempt ${attempt + 1}) after ${delay}ms`,
            estimatedTimeRemaining: task.estimatedTokens * 10
          } as AIProgressUpdate);
        }
      }
    );

    if (retryResult.success && retryResult.result) {
      const processResult: ProcessResult = {
        taskId: task.id,
        success: true,
        result: {
          generatedTests: retryResult.result.output,
          tokensUsed: retryResult.result.tokensUsed || task.estimatedTokens,
          actualCost: retryResult.result.cost || task.estimatedCost,
          duration: Date.now() - startTime,
        },
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
    } else {
      // Final failure
      const processResult: ProcessResult = {
        taskId: task.id,
        success: false,
        error: retryResult.error?.message || 'Unknown error',
      };

      this.stats.failedTasks++;
      this.results.push(processResult);
      this.emit('task:failed', { task, error: processResult.error });
    }
  }

  /**
   * Handle task in degraded mode (no Claude CLI available)
   */
  private async handleDegradedTask(task: AITask, startTime: number): Promise<void> {
    logger.info(`Processing task ${task.id} in degraded mode`);
    
    // Generate placeholder tests based on task context
    const placeholderTests = this.generatePlaceholderTests(task);
    
    const processResult: ProcessResult = {
      taskId: task.id,
      success: true,
      result: {
        generatedTests: placeholderTests,
        tokensUsed: 0, // No AI tokens used
        actualCost: 0, // No cost in degraded mode
        duration: Date.now() - startTime,
      },
    };

    // Update stats
    this.stats.completedTasks++;
    this.stats.totalDuration += processResult.result!.duration;

    // Save generated tests
    await this.saveGeneratedTests(task, processResult.result!.generatedTests);

    this.results.push(processResult);
    this.emit('task:complete', { 
      task, 
      result: processResult,
      degraded: true 
    });
  }

  /**
   * Generate placeholder tests for degraded mode
   */
  private generatePlaceholderTests(task: AITask): string {
    const { language } = task.context.frameworkInfo;
    const sourceFile = path.basename(task.sourceFile);
    
    if (language === 'javascript' || language === 'typescript') {
      return `// AI-Generated Placeholder Tests (Degraded Mode)
// Install Claude Code and authenticate to enable AI-powered test generation

describe('${sourceFile}', () => {
  test.todo('should be tested properly');
  
  // TODO: The following scenarios should be tested:
  ${task.context.missingScenarios.map(scenario => `  // - ${scenario}`).join('\n')}
});

// Note: These are placeholder tests. Install Claude Code for intelligent test generation.
`;
    } else if (language === 'python') {
      return `# AI-Generated Placeholder Tests (Degraded Mode)
# Install Claude Code and authenticate to enable AI-powered test generation

import pytest

class Test${sourceFile.replace('.py', '').replace(/[^a-zA-Z0-9]/g, '')}:
    def test_placeholder(self):
        """TODO: Implement proper tests"""
        pytest.skip("Placeholder test - Claude Code required for AI generation")
    
    # TODO: The following scenarios should be tested:
${task.context.missingScenarios.map(scenario => `    # - ${scenario}`).join('\n')}

# Note: These are placeholder tests. Install Claude Code for intelligent test generation.
`;
    }
    
    return `// Placeholder tests for ${sourceFile} - Claude Code required for AI generation`;
  }

  /**
   * Set up timeout progress tracking
   */
  private setupTimeoutProgressTracking(
    taskId: string, 
    timeoutMs: number, 
    claude: ChildProcess,
    getStdoutLength: () => number,
    getStderrLength: () => number
  ): void {
    const heartbeat = this.processHeartbeats.get(taskId);
    if (!heartbeat) return;

    const progressCheckInterval = Math.min(timeoutMs / 10, 10000); // Check every 10% or 10s, whichever is smaller
    heartbeat.timeoutProgress = setInterval(() => {
      const elapsed = Date.now() - (heartbeat.startTime?.getTime() || Date.now());
      const progress = Math.floor((elapsed / timeoutMs) * 100);
      
      // Check warning thresholds
      for (const threshold of heartbeat.warningThresholds || []) {
        if (progress >= threshold && heartbeat.warningThresholds?.has(threshold)) {
          heartbeat.warningThresholds.delete(threshold); // Only emit once per threshold
          
          // Capture current state
          const stateInfo = {
            taskId,
            threshold,
            progress,
            elapsed: elapsed / 1000,
            timeoutSeconds: timeoutMs / 1000,
            bytesReceived: heartbeat.stdoutBytes + heartbeat.stderrBytes,
            lastActivity: heartbeat.lastActivity,
            stdout: getStdoutLength(),
            stderr: getStderrLength(),
            resourceUsage: this.captureResourceUsage(claude.pid),
          };
          
          // Emit timeout warning event
          this.emit('timeout:warning', stateInfo);
          
          // Log detailed state information
          logger.warn(`Timeout warning for task ${taskId}: ${threshold}% of timeout reached`, stateInfo);
          
          // Update progress event with warning
          this.emit('progress', {
            taskId,
            phase: 'generating',
            progress: Math.min(90, 10 + progress * 0.8), // Scale progress from 10-90%
            message: `⚠️ Generation at ${threshold}% of timeout (${Math.floor(elapsed / 1000)}s / ${Math.floor(timeoutMs / 1000)}s)`,
            warning: true,
            estimatedTimeRemaining: timeoutMs - elapsed,
          } as AIProgressUpdate);
        }
      }
    }, progressCheckInterval);
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
        task.prompt,
        '--model',
        this.config.model!,
      ];

      // Add fallback model if configured (helps with Max subscription limits)
      if (this.config.fallbackModel) {
        args.push('--fallback-model', this.config.fallbackModel);
      }

      if (this.config.verbose) {
        console.log(`Executing Claude for task ${task.id} with model ${this.config.model}...`);
      }
      
      // Emit progress update for generation start
      this.emit('progress', {
        taskId: task.id,
        phase: 'generating',
        progress: 10,
        message: `Generating tests with ${this.config.model} model...`,
        estimatedTimeRemaining: task.estimatedTokens * 10
      } as AIProgressUpdate);

      // Set up environment with extended timeouts for headless AI generation
      const claudeEnv = {
        ...process.env,
        // Only affect this specific headless Claude process, not interactive sessions
        BASH_DEFAULT_TIMEOUT_MS: String(this.config.timeout),
        BASH_MAX_TIMEOUT_MS: String(this.config.timeout),
      };

      const claude = spawn('claude', args, {
        env: claudeEnv,
        shell: false,
      });

      let stdout = '';
      let stderr = '';
      let timeout: NodeJS.Timeout;
      let killed = false;
      
      // Create stderr parser for early error detection
      const stderrParser = createStderrParser(this);
      
      // Store active process
      this.activeProcesses.set(task.id, claude);
      
      // Set up early error detection handler
      const errorHandler = (error: ParsedError) => {
        if (error.severity === 'fatal' && !killed) {
          logger.error(`Early fatal error detected for task ${task.id}: ${error.type}`);
          
          // Kill the process immediately on fatal errors
          killed = true;
          if (timeout) clearTimeout(timeout);
          this.stopHeartbeatMonitoring(task.id);
          this.activeProcesses.delete(task.id);
          
          // Kill the process
          claude.kill('SIGTERM');
          setTimeout(() => {
            if (!claude.killed) {
              claude.kill('SIGKILL');
            }
          }, 1000);
          
          // Reject with the specific error
          reject(error.error);
        }
      };
      
      // Listen for early error detection
      this.once('error:detected', errorHandler);

      // Set up timeout with more descriptive error
      if (this.config.timeout) {
        // Create a more aggressive timeout handling
        const timeoutMs = this.config.timeout || 900000;
        
        // Set main timeout
        timeout = setTimeout(() => {
          if (!killed) {
            killed = true;
            // Stop heartbeat monitoring before killing
            this.stopHeartbeatMonitoring(task.id);
            
            // Try SIGTERM first, then SIGKILL after 5 seconds
            claude.kill('SIGTERM');
            setTimeout(() => {
              if (claude.killed === false) {
                claude.kill('SIGKILL');
              }
            }, 5000);
            
            reject(new AITimeoutError(
              `AI generation timed out after ${timeoutMs / 1000} seconds. ` +
              `This may indicate: 1) Complex task requiring more time, 2) Claude CLI hanging, ` +
              `3) Network connectivity issues. Try: reducing batch size, checking Claude Code setup, ` +
              `or increasing timeout with --timeout flag.`,
              timeoutMs
            ));
          }
        }, timeoutMs);
        
        // Set progress timeout (if no output for 30 seconds, consider it stuck)
        setTimeout(() => {
          if (!stdout && !killed) {
            logger.warn(`No output from Claude CLI after 30 seconds for task ${task.id}`);
            this.emit('progress', {
              taskId: task.id,
              phase: 'generating',
              progress: 25,
              message: 'Waiting for Claude CLI response (may be processing)...'
            } as AIProgressUpdate);
          }
        }, 30000);
      }

      // Start heartbeat monitoring after timeout setup
      this.startHeartbeatMonitoring(task.id, claude);
      
      // Set up timeout progress tracking if timeout is configured
      if (this.config.timeout) {
        this.setupTimeoutProgressTracking(
          task.id, 
          this.config.timeout, 
          claude,
          () => stdout.length,
          () => stderr.length
        );
      }

      claude.stdout.on('data', (data) => {
        const dataStr = data.toString();
        const bytes = data.length;
        stdout += dataStr;
        
        // Update heartbeat activity with data content
        this.updateProcessActivity(task.id, bytes, true, dataStr);
        
        // Emit progress update - we're getting data
        this.emit('progress', {
          taskId: task.id,
          phase: 'generating',
          progress: 50,
          message: 'Receiving generated tests from Claude...'
        } as AIProgressUpdate);
      });

      claude.stderr.on('data', (data) => {
        const dataStr = data.toString();
        const bytes = data.length;
        stderr += dataStr;
        
        // Parse stderr in real-time for early error detection
        const parsedError = stderrParser.parseChunk(dataStr);
        if (parsedError && parsedError.severity === 'fatal' && !killed) {
          // Early error detection will trigger the error handler
          logger.debug(`Parsed fatal error from stderr: ${parsedError.type}`);
        }
        
        // Update heartbeat activity with data content
        this.updateProcessActivity(task.id, bytes, false, dataStr);
      });

      claude.on('error', (error) => {
        if (!killed) {
          clearTimeout(timeout);
          this.activeProcesses.delete(task.id);
          this.stopHeartbeatMonitoring(task.id);
          
          // Provide more helpful error messages
          if (error.message.includes('ENOENT')) {
            reject(new AIAuthenticationError(
              'Claude CLI not found. Please ensure Claude Code is installed and available in PATH. ' +
              'Visit https://docs.anthropic.com/claude-code for installation instructions.'
            ));
          } else {
            reject(new Error(`Failed to spawn Claude process: ${error.message}`));
          }
        }
      });

      claude.on('close', (code) => {
        // Clean up error handler
        this.off('error:detected', errorHandler);
        
        if (!killed) {
          clearTimeout(timeout);
          this.activeProcesses.delete(task.id);
          this.stopHeartbeatMonitoring(task.id);
          
          // Parse any remaining stderr
          stderrParser.parseRemaining();

          if (code !== 0) {
            // Check if parser found any errors
            const fatalError = stderrParser.getFirstFatalError();
            if (fatalError) {
              reject(fatalError.error);
              return;
            }
            
            // Fallback to pattern matching for backwards compatibility
            if (stderr.includes('authentication') || stderr.includes('login')) {
              reject(new AIAuthenticationError(
                'Claude CLI authentication required. Please run Claude Code interactively first to authenticate. ' +
                'Use: claude auth login'
              ));
            } else if (stderr.includes('rate limit') || stderr.includes('quota')) {
              reject(new AIRateLimitError(
                'Claude API rate limit or quota exceeded. Please try again later or use a different model. ' +
                'Consider using --model haiku for lower-cost generation.'
              ));
            } else if (stderr.includes('network') || stderr.includes('connection')) {
              reject(new AINetworkError(
                'Network connection error while communicating with Claude API. ' +
                'Please check your internet connection and try again.'
              ));
            } else {
              reject(new Error(
                `Claude process exited with code ${code}${stderr ? `: ${stderr}` : ''}`
              ));
            }
            return;
          }

          try {
            // Handle both text and JSON responses
            if (stdout.trim().startsWith('{')) {
              const result = JSON.parse(stdout);
              resolve({
                output: result.result || result.output || result.content || stdout,
                tokensUsed: result.usage?.total_tokens || result.tokens_used,
                cost: result.total_cost_usd || result.cost,
              });
            } else {
              resolve({ 
                output: stdout.trim() || 'No output generated',
                tokensUsed: task.estimatedTokens, // Fallback estimation
                cost: task.estimatedCost, // Fallback estimation
              });
            }
          } catch (error) {
            // If JSON parsing fails, return text output
            resolve({ 
              output: stdout.trim() || 'Generated test content',
              tokensUsed: task.estimatedTokens,
              cost: task.estimatedCost,
            });
          }
        }
      });
    });
  }

  /**
   * Check if batch contains chunked tasks
   */
  private hasChunkedTasks(batch: AITaskBatch): boolean {
    return batch.tasks.some((task) => (task as ChunkedAITask).isChunked !== undefined);
  }

  /**
   * Merge results from chunked tasks
   */
  private async mergeChunkedResults(tasks: ChunkedAITask[]): Promise<void> {
    console.log('Merging chunked results...');

    // Get successful results
    const successfulResults = new Map<string, string>();
    this.results.forEach((result) => {
      if (result.success && result.result?.generatedTests) {
        successfulResults.set(result.taskId, result.result.generatedTests);
      }
    });

    // Merge chunked results
    const mergedResults = ClaudeOrchestrator.mergeChunkedResults(tasks, successfulResults);

    // Write merged results to files
    for (const [sourceFile, mergedContent] of mergedResults) {
      const task = tasks.find((t) => t.sourceFile === sourceFile);
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
      promises.push(
        new Promise<void>((resolve) => {
          process.on('close', () => {
            this.activeProcesses.delete(taskId);
            resolve();
          });
          process.kill('SIGTERM');
        })
      );
    }

    await Promise.all(promises);
  }

  /**
   * Get reliability status
   */
  getReliabilityStatus(): {
    isHealthy: boolean;
    isDegraded: boolean;
    circuitBreakerState: string | undefined;
    failureRate: number;
    successRate: number;
  } {
    const totalAttempts = this.stats.completedTasks + this.stats.failedTasks;
    const successRate = totalAttempts > 0 ? this.stats.completedTasks / totalAttempts : 0;
    const failureRate = totalAttempts > 0 ? this.stats.failedTasks / totalAttempts : 0;
    
    const circuitBreakerState = this.circuitBreaker?.getState();
    
    return {
      isHealthy: !this.isGracefullyDegraded && successRate >= 0.8,
      isDegraded: this.isGracefullyDegraded,
      circuitBreakerState: circuitBreakerState?.state || undefined,
      failureRate,
      successRate,
    };
  }

  /**
   * Generate execution report
   */
  generateReport(): string {
    const duration = this.stats.endTime
      ? (this.stats.endTime.getTime() - this.stats.startTime.getTime()) / 1000
      : 0;

    const avgDuration =
      this.stats.completedTasks > 0
        ? (this.stats.totalDuration / this.stats.completedTasks / 1000).toFixed(1)
        : '0';

    const avgCost =
      this.stats.completedTasks > 0
        ? (this.stats.totalCost / this.stats.completedTasks).toFixed(4)
        : '0';

    const reliabilityStatus = this.getReliabilityStatus();
    
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
      '## Reliability Status',
      `- Health Status: ${reliabilityStatus.isHealthy ? '✅ Healthy' : '⚠️ Degraded'}`,
      `- Degraded Mode: ${reliabilityStatus.isDegraded ? 'Yes (Placeholder tests only)' : 'No'}`,
      `- Success Rate: ${(reliabilityStatus.successRate * 100).toFixed(1)}%`,
      `- Circuit Breaker: ${reliabilityStatus.circuitBreakerState || 'Disabled'}`,
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
      `- Exponential Backoff: ${this.config.exponentialBackoff ? 'Enabled' : 'Disabled'}`,
      `- Graceful Degradation: ${this.config.gracefulDegradation ? 'Enabled' : 'Disabled'}`,
      '',
    ];

    if (this.stats.failedTasks > 0) {
      report.push('## Failed Tasks');
      const failedResults = this.results.filter((r) => !r.success);
      failedResults.forEach((result) => {
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
      startTime: new Date(),
    };
  }

}
