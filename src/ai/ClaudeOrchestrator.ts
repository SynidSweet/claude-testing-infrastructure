/**
 * Claude Orchestrator
 *
 * Manages parallel Claude processes for AI test generation:
 * - Process pool management
 * - Task queue and scheduling
 * - Result aggregation
 * - Error handling and retries
 */

import { spawn, execSync, type ChildProcess } from 'child_process';
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
  type AIProgressUpdate,
} from '../types/ai-error-types';
import {
  withRetry,
  CircuitBreaker,
  FailurePatternDetector,
  type TaskRetryContext,
} from '../utils/retry-helper';
import { logger } from '../utils/logger';
import { createStderrParser, type ParsedError } from '../utils/stderr-parser';
import {
  ProcessMonitor,
  type ProcessHealthMetrics,
  type ProcessResourceUsage,
} from '../utils/ProcessMonitor';
import { TaskCheckpointManager } from '../state/TaskCheckpointManager';
import { type TestableTimer, type TimerHandle } from '../types/timer-types';
import { createAutoTimer } from '../utils/TimerFactory';
import type { HeartbeatMonitor } from './heartbeat';
import {
  createHeartbeatMonitor,
  setupEventMapping,
  HeartbeatMonitorAdapter,
} from './heartbeat/ClaudeOrchestratorIntegration';

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
  checkpointingEnabled?: boolean;
  projectPath?: string;
  timerService?: TestableTimer;
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
  checkInterval?: TimerHandle;
  timeoutProgress?: TimerHandle;
  warningThresholds?: Set<number>;
  startTime?: Date;
  resourceUsage?: ProcessResourceUsage;
  healthMetrics?: ProcessHealthMetrics;
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
  private processMonitor: ProcessMonitor;
  private checkpointManager?: TaskCheckpointManager;
  private activeCheckpoints = new Map<string, string>(); // taskId -> checkpointId
  private failurePatternDetector = new FailurePatternDetector();
  private taskMetrics = new Map<
    string,
    { successTime: number; complexity: 'low' | 'medium' | 'high' }
  >(); // Task performance tracking
  private timerService: TestableTimer;
  private heartbeatMonitor: HeartbeatMonitor;
  private heartbeatAdapter: HeartbeatMonitorAdapter;

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
      checkpointingEnabled: true,
      ...config,
    };

    // Initialize timer service (use provided or create auto-timer)
    this.timerService = this.config.timerService ?? createAutoTimer();

    // Initialize checkpoint manager if enabled and project path provided
    if (this.config.checkpointingEnabled && this.config.projectPath) {
      this.checkpointManager = new TaskCheckpointManager(this.config.projectPath);
    }

    // Validate model configuration on construction
    if (this.config.model) {
      const validation = validateModelConfiguration(this.config.model);
      if (!validation.valid) {
        logger.warn(`ClaudeOrchestrator: ${validation.error}. ${validation.suggestion}`);
        this.config.model = 'claude-3-5-sonnet-20241022'; // Fallback to default
      } else {
        this.config.model = validation.resolvedName!;
      }
    }

    if (this.config.fallbackModel) {
      const validation = validateModelConfiguration(this.config.fallbackModel);
      if (!validation.valid) {
        logger.warn(
          `ClaudeOrchestrator fallback model: ${validation.error}. ${validation.suggestion}`
        );
        this.config.fallbackModel = 'claude-3-haiku-20240307'; // Fallback to cheapest
      } else {
        this.config.fallbackModel = validation.resolvedName!;
      }
    }

    this.stats = this.resetStats();

    // Initialize process monitor
    this.processMonitor = new ProcessMonitor({
      cpuThreshold: 85,
      memoryThreshold: 85,
      checkInterval: this.HEARTBEAT_INTERVAL,
      maxHistory: 50,
      zombieDetection: true,
    });

    // Initialize new heartbeat monitoring system
    this.heartbeatMonitor = createHeartbeatMonitor(this.timerService, {
      scheduler: {
        intervalMs: this.HEARTBEAT_INTERVAL,
        timeoutMs: this.config.timeout ?? 900000,
        progressIntervalMs: 10000,
      },
      analysis: {
        cpuThreshold: 80,
        memoryThresholdMB: 1000,
        minOutputRate: 0.1,
        maxSilenceDuration: this.DEAD_PROCESS_THRESHOLD,
        maxErrorCount: 50,
        progressMarkerPatterns: ['analyzing', 'processing', 'generating'],
        minProgressMarkers: 1,
        analysisWindowMs: 60000,
      },
    });
    this.heartbeatAdapter = new HeartbeatMonitorAdapter(this.heartbeatMonitor);

    // Set up event mapping between new heartbeat monitor and orchestrator
    setupEventMapping(this.heartbeatMonitor, this);

    // Initialize circuit breaker if enabled
    if (this.config.circuitBreakerEnabled) {
      this.circuitBreaker = new CircuitBreaker(5, 60000); // 5 failures, 1 minute recovery
    }
  }

  /**
   * Validate Claude CLI authentication
   */
  validateClaudeAuth(): {
    authenticated: boolean;
    error?: string;
    canDegrade?: boolean;
  } {
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
        error:
          'Claude CLI not authenticated. Please run Claude Code interactively to authenticate.',
        canDegrade: this.config.gracefulDegradation ?? false,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      if (errorMessage.includes('ENOENT') || errorMessage.includes('not found')) {
        return {
          authenticated: false,
          error:
            'Claude CLI not found. Please ensure Claude Code is installed and available in PATH.',
          canDegrade: this.config.gracefulDegradation ?? false,
        };
      }

      if (errorMessage.includes('login') || errorMessage.includes('authenticate')) {
        return {
          authenticated: false,
          error:
            'Claude CLI not authenticated. Please run Claude Code interactively to authenticate.',
          canDegrade: this.config.gracefulDegradation ?? false,
        };
      }

      // Generic error
      return {
        authenticated: false,
        error: `Failed to check Claude CLI authentication: ${errorMessage}`,
        canDegrade: this.config.gracefulDegradation ?? false,
      };
    }
  }

  /**
   * Start heartbeat monitoring for a process
   */
  private startHeartbeatMonitoring(taskId: string, process: ChildProcess): void {
    // Use new heartbeat monitoring system
    this.heartbeatAdapter.startMonitoring(taskId, process);

    // Keep legacy heartbeat object for backward compatibility during transition
    const currentTime = this.timerService.getCurrentTime();
    const heartbeat: ProcessHeartbeat = {
      taskId,
      process,
      lastActivity: new Date(currentTime),
      stdoutBytes: 0,
      stderrBytes: 0,
      startTime: new Date(currentTime),
      warningThresholds: new Set([50, 75, 90]),
      lastStdinCheck: new Date(currentTime),
      isWaitingForInput: false,
      consecutiveSlowChecks: 0,
      progressHistory: [],
    };

    this.processHeartbeats.set(taskId, heartbeat);

    // Start process monitoring if we have a valid PID
    if (process.pid) {
      this.processMonitor.startMonitoring(process.pid);
    }
  }

  /**
   * Stop heartbeat monitoring for a process
   */
  private stopHeartbeatMonitoring(taskId: string): void {
    // Use new heartbeat monitoring system
    this.heartbeatAdapter.stopMonitoring(taskId);

    // Clean up legacy heartbeat object
    const heartbeat = this.processHeartbeats.get(taskId);
    if (heartbeat) {
      // Stop process monitoring if we have a valid PID
      if (heartbeat.process.pid) {
        this.processMonitor.stopMonitoring(heartbeat.process.pid);
      }

      if (heartbeat.checkInterval) {
        heartbeat.checkInterval.cancel();
      }
      if (heartbeat.timeoutProgress) {
        heartbeat.timeoutProgress.cancel();
      }
      this.processHeartbeats.delete(taskId);
    }
  }

  /**
   * Update activity timestamp for a process
   */
  private updateProcessActivity(
    taskId: string,
    bytesReceived: number,
    isStdout: boolean,
    data?: string
  ): void {
    // Notify new heartbeat system
    this.heartbeatAdapter.updateActivity(taskId, bytesReceived, isStdout, data);

    // Update legacy heartbeat object for compatibility
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
   * Capture resource usage for a process using ProcessMonitor
   */
  private captureResourceUsage(pid?: number): ProcessResourceUsage | undefined {
    if (!pid) return undefined;

    return this.processMonitor.getResourceUsage(pid) ?? undefined;
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
      message: 'Validating Claude CLI authentication...',
    } as AIProgressUpdate);

    // Validate Claude CLI authentication before starting
    const authStatus = this.validateClaudeAuth();
    if (!authStatus.authenticated) {
      if (authStatus.canDegrade) {
        // Enable graceful degradation mode
        this.isGracefullyDegraded = true;
        logger.warn('Claude CLI not available - entering graceful degradation mode');
        this.emit('degradation:enabled', {
          reason: authStatus.error,
          message:
            'AI test generation will return placeholder tests. Install Claude Code for full functionality.',
        });
      } else {
        throw new AIAuthenticationError(authStatus.error ?? 'Authentication failed');
      }
    }

    this.emit('progress', {
      taskId: 'auth-check',
      phase: 'authenticating',
      progress: 100,
      message: 'Authentication validated successfully',
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

    // Stop all process monitoring
    this.processMonitor.stopAll();
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
   * Assess task complexity based on context
   */
  private assessTaskComplexity(task: AITask): 'low' | 'medium' | 'high' {
    const { estimatedTokens } = task;
    const sourceFile = task.sourceFile;

    // Simple heuristics for complexity assessment
    if (estimatedTokens > 8000) return 'high';
    if (estimatedTokens > 4000) return 'medium';

    // Check file type indicators
    if (sourceFile.includes('test') || sourceFile.includes('spec')) return 'low';
    if (sourceFile.includes('component') || sourceFile.includes('service')) return 'medium';
    if (sourceFile.includes('controller') || sourceFile.includes('api')) return 'high';

    return estimatedTokens > 2000 ? 'medium' : 'low';
  }

  /**
   * Create task retry context for intelligent retry strategies
   */
  private createTaskRetryContext(task: AITask): TaskRetryContext {
    const complexity = this.assessTaskComplexity(task);
    const existingMetrics = this.taskMetrics.get(task.id);

    const context: TaskRetryContext = {
      taskId: task.id,
      estimatedTokens: task.estimatedTokens,
      complexity,
      previousAttempts: 0,
      previousFailures: [],
    };

    if (existingMetrics?.successTime !== undefined) {
      context.averageSuccessTime = existingMetrics.successTime;
    }

    return context;
  }

  /**
   * Process a single task
   */
  private async processTask(task: AITask): Promise<void> {
    const startTime = Date.now();

    this.emit('task:start', { task });

    // Check for existing checkpoint and potentially resume
    let checkpointId: string | undefined;
    let shouldResume = false;

    if (this.checkpointManager) {
      const resumeInfo = await this.checkpointManager.canResume(task);
      if (resumeInfo.canResume && resumeInfo.checkpointId) {
        shouldResume = true;
        checkpointId = resumeInfo.checkpointId;

        this.emit('progress', {
          taskId: task.id,
          phase: 'preparing',
          progress: resumeInfo.lastProgress ?? 0,
          message: `Resuming task ${task.id} from checkpoint (${resumeInfo.lastProgress}% complete)`,
          estimatedTimeRemaining:
            task.estimatedTokens * 10 * ((100 - (resumeInfo.lastProgress ?? 0)) / 100),
        } as AIProgressUpdate);

        logger.info(`Resuming task ${task.id} from checkpoint ${checkpointId}`);
      } else {
        // Create new checkpoint
        checkpointId = await this.checkpointManager.createCheckpoint(task, 'preparing');
        this.activeCheckpoints.set(task.id, checkpointId);

        this.emit('progress', {
          taskId: task.id,
          phase: 'preparing',
          progress: 0,
          message: `Processing task ${task.id} (checkpoint created)`,
          estimatedTimeRemaining: task.estimatedTokens * 10,
        } as AIProgressUpdate);
      }
    } else {
      // No checkpointing - emit normal progress
      this.emit('progress', {
        taskId: task.id,
        phase: 'preparing',
        progress: 0,
        message: `Processing task ${task.id}`,
        estimatedTimeRemaining: task.estimatedTokens * 10,
      } as AIProgressUpdate);
    }

    // Handle graceful degradation
    if (this.isGracefullyDegraded) {
      await this.handleDegradedTask(task, startTime, checkpointId);
      return;
    }

    // Create intelligent retry context
    const retryContext = this.createTaskRetryContext(task);

    // Use intelligent retry helper with adaptive strategies
    const retryResult = await withRetry(
      async () => {
        // Use circuit breaker if enabled
        if (this.circuitBreaker) {
          return await this.circuitBreaker.execute(() =>
            this.executeClaudeProcess(task, shouldResume, checkpointId)
          );
        } else {
          return await this.executeClaudeProcess(task, shouldResume, checkpointId);
        }
      },
      {
        maxAttempts: this.config.retryAttempts ?? 3,
        initialDelay: this.config.retryDelay ?? 1000,
        maxDelay: this.config.maxRetryDelay ?? 30000,
        backoffFactor: 2,
        jitter: true,
        retryableErrors: [AITimeoutError, AINetworkError, AIRateLimitError],
        adaptiveTimeout: true,
        contextAware: true,
        taskContext: retryContext,
        failurePatterns: this.failurePatternDetector,
        onRetry: (error, attempt, delay) => {
          logger.info(
            `Intelligent retry for task ${task.id}: attempt ${attempt + 1}, ` +
              `delay ${delay}ms, complexity ${retryContext.complexity}, ` +
              `pattern ${this.failurePatternDetector.getRecommendedStrategy(error).strategy}`
          );

          this.emit('task:retry', {
            task,
            attemptNumber: attempt,
            error: error.message,
            nextRetryIn: delay,
            complexity: retryContext.complexity,
            strategy: this.failurePatternDetector.getRecommendedStrategy(error).strategy,
          });

          // Update progress with intelligent retry info
          this.emit('progress', {
            taskId: task.id,
            phase: 'preparing',
            progress: 0,
            message: `Intelligent retry: ${retryContext.complexity} complexity task, attempt ${attempt + 1} in ${delay}ms`,
            estimatedTimeRemaining: task.estimatedTokens * 10,
          } as AIProgressUpdate);
        },
      }
    );

    if (retryResult.success && retryResult.result) {
      const processResult: ProcessResult = {
        taskId: task.id,
        success: true,
        result: {
          generatedTests: retryResult.result.output,
          tokensUsed: retryResult.result.tokensUsed ?? task.estimatedTokens,
          actualCost: retryResult.result.cost ?? task.estimatedCost,
          duration: Date.now() - startTime,
        },
      };

      // Complete checkpoint if enabled
      if (checkpointId && this.checkpointManager) {
        await this.checkpointManager.completeCheckpoint(checkpointId, processResult.result!);
        this.activeCheckpoints.delete(task.id);
      }

      // Track successful task metrics for future intelligent retry decisions
      this.taskMetrics.set(task.id, {
        successTime: processResult.result!.duration,
        complexity: retryContext.complexity,
      });

      // Update average success time for this complexity level
      const similarTasks = Array.from(this.taskMetrics.values()).filter(
        (metric) => metric.complexity === retryContext.complexity
      );
      const avgSuccessTime =
        similarTasks.reduce((sum, metric) => sum + metric.successTime, 0) / similarTasks.length;
      retryContext.averageSuccessTime = avgSuccessTime;

      logger.debug(
        `Task ${task.id} completed successfully: duration=${processResult.result!.duration}ms, ` +
          `complexity=${retryContext.complexity}, avgForComplexity=${Math.round(avgSuccessTime)}ms`
      );

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
        error: retryResult.error?.message ?? 'Unknown error',
      };

      // Fail checkpoint if enabled
      if (checkpointId && this.checkpointManager) {
        await this.checkpointManager.failCheckpoint(checkpointId, processResult.error!);
        this.activeCheckpoints.delete(task.id);
      }

      this.stats.failedTasks++;
      this.results.push(processResult);
      this.emit('task:failed', { task, error: processResult.error });
    }
  }

  /**
   * Handle task in degraded mode (no Claude CLI available)
   */
  private async handleDegradedTask(
    task: AITask,
    startTime: number,
    checkpointId?: string
  ): Promise<void> {
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

    // Complete checkpoint if enabled (even for degraded mode)
    if (checkpointId && this.checkpointManager) {
      await this.checkpointManager.completeCheckpoint(checkpointId, processResult.result!);
      this.activeCheckpoints.delete(task.id);
    }

    // Update stats
    this.stats.completedTasks++;
    this.stats.totalDuration += processResult.result!.duration;

    // Save generated tests
    await this.saveGeneratedTests(task, processResult.result!.generatedTests);

    this.results.push(processResult);
    this.emit('task:complete', {
      task,
      result: processResult,
      degraded: true,
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
  ${task.context.missingScenarios.map((scenario) => `  // - ${scenario}`).join('\n')}
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
${task.context.missingScenarios.map((scenario) => `    # - ${scenario}`).join('\n')}

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

    const timerHandle = this.timerService.scheduleInterval(() => {
      const currentTime = this.timerService.getCurrentTime();
      const elapsed = currentTime - (heartbeat.startTime?.getTime() ?? currentTime);
      const progress = Math.floor((elapsed / timeoutMs) * 100);

      // Check warning thresholds
      for (const threshold of heartbeat.warningThresholds ?? []) {
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
          logger.warn(
            `Timeout warning for task ${taskId}: ${threshold}% of timeout reached`,
            stateInfo
          );

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

    heartbeat.timeoutProgress = timerHandle;
  }

  /**
   * Execute Claude process for a task
   */
  private executeClaudeProcess(
    task: AITask,
    shouldResume: boolean = false,
    checkpointId?: string
  ): Promise<{
    output: string;
    tokensUsed?: number;
    cost?: number;
  }> {
    return new Promise((resolve, reject) => {
      const executeTask = async (): Promise<void> => {
        let promptToUse = task.prompt;
        let estimatedTokens = task.estimatedTokens;

        // Handle resume from checkpoint
        if (shouldResume && checkpointId && this.checkpointManager) {
          try {
            const resumeInfo = await this.checkpointManager.resumeFromCheckpoint(checkpointId);
            promptToUse = resumeInfo.resumePrompt;
            estimatedTokens = resumeInfo.estimatedRemainingTokens;

            // Update progress to show resuming
            this.emit('progress', {
              taskId: task.id,
              phase: 'generating',
              progress: resumeInfo.checkpoint.progress,
              message: `Resuming generation from ${resumeInfo.checkpoint.progress}%...`,
              estimatedTimeRemaining: estimatedTokens * 10,
            } as AIProgressUpdate);

            logger.info(
              `Resuming task ${task.id} with ${estimatedTokens} estimated remaining tokens`
            );
          } catch (error) {
            logger.warn(`Failed to resume from checkpoint ${checkpointId}, starting fresh:`, error);
            // Continue with original prompt if resume fails
          }
        }

        const args = [promptToUse, '--model', this.config.model!];

        // Add fallback model if configured (helps with Max subscription limits)
        if (this.config.fallbackModel) {
          args.push('--fallback-model', this.config.fallbackModel);
        }

        if (this.config.verbose) {
          logger.info(`Executing Claude for task ${task.id} with model ${this.config.model}...`);
        }

        // Emit progress update for generation start
        this.emit('progress', {
          taskId: task.id,
          phase: 'generating',
          progress: 10,
          message: `Generating tests with ${this.config.model} model...`,
          estimatedTimeRemaining: task.estimatedTokens * 10,
        } as AIProgressUpdate);

        // Set up environment with extended timeouts for headless AI generation
        const claudeEnv = {
          ...process.env,
          // Only affect this specific headless Claude process, not interactive sessions
          BASH_DEFAULT_TIMEOUT_MS: String(this.config.timeout),
          BASH_MAX_TIMEOUT_MS: String(this.config.timeout),
        };

        let stdout = '';
        let stderr = '';
        let timeout: TimerHandle | undefined;
        let killed = false;
        let claude: ChildProcess | undefined; // eslint-disable-line prefer-const

        // Set up early error detection handler BEFORE spawning process
        const errorHandler = (error: ParsedError): void => {
          if (error.severity === 'fatal' && !killed) {
            logger.error(`Early fatal error detected for task ${task.id}: ${error.type}`);

            // Kill the process immediately on fatal errors
            killed = true;
            if (timeout) timeout.cancel();
            this.stopHeartbeatMonitoring(task.id);
            this.activeProcesses.delete(task.id);

            // Kill the process if it exists
            if (claude) {
              claude.kill('SIGTERM');
              this.timerService.schedule(() => {
                if (claude && !claude.killed) {
                  claude.kill('SIGKILL');
                }
              }, 1000);
            }

            // Reject with the specific error
            reject(error.error);
          }
        };

        // Listen for early error detection BEFORE spawning
        this.on('error:detected', errorHandler);

        claude = spawn('claude', args, {
          env: claudeEnv,
          shell: false,
        });

        // Create stderr parser for early error detection
        const stderrParser = createStderrParser(this);

        // Store active process
        this.activeProcesses.set(task.id, claude);

        // Set up timeout with more descriptive error
        if (this.config.timeout) {
          // Create a more aggressive timeout handling
          const timeoutMs = this.config.timeout ?? 900000;

          // Set main timeout
          timeout = this.timerService.schedule(() => {
            if (!killed) {
              killed = true;
              // Stop heartbeat monitoring before killing
              this.stopHeartbeatMonitoring(task.id);

              // Try SIGTERM first, then SIGKILL after 5 seconds
              claude.kill('SIGTERM');
              this.timerService.schedule(() => {
                if (claude.killed === false) {
                  claude.kill('SIGKILL');
                }
              }, 5000);

              reject(
                new AITimeoutError(
                  `AI generation timed out after ${timeoutMs / 1000} seconds. ` +
                    `This may indicate: 1) Complex task requiring more time, 2) Claude CLI hanging, ` +
                    `3) Network connectivity issues. Try: reducing batch size, checking Claude Code setup, ` +
                    `or increasing timeout with --timeout flag.`,
                  timeoutMs
                )
              );
            }
          }, timeoutMs);

          // Set progress timeout (if no output for 30 seconds, consider it stuck)
          this.timerService.schedule(() => {
            if (!stdout && !killed) {
              logger.warn(`No output from Claude CLI after 30 seconds for task ${task.id}`);
              this.emit('progress', {
                taskId: task.id,
                phase: 'generating',
                progress: 25,
                message: 'Waiting for Claude CLI response (may be processing)...',
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

        claude.stdout?.on('data', (data: Buffer) => {
          const dataStr = data.toString();
          const bytes = data.length;
          stdout += dataStr;

          // Update heartbeat activity with data content
          this.updateProcessActivity(task.id, bytes, true, dataStr);

          // Update checkpoint with partial progress
          if (checkpointId && this.checkpointManager) {
            const progress = Math.min(50 + (stdout.length / estimatedTokens) * 40, 90); // Scale 50-90%
            void this.checkpointManager.updateCheckpoint(checkpointId, {
              phase: 'generating',
              progress,
              partialResult: {
                generatedContent: stdout,
                tokensUsed: Math.floor(stdout.length / 4), // Rough token estimate
                estimatedCost: task.estimatedCost * (progress / 100),
              },
              state: {
                outputBytes: stdout.length,
                elapsedTime:
                  Date.now() -
                  (Date.now() -
                    (this.processHeartbeats.get(task.id)?.startTime?.getTime() ?? Date.now())),
              },
            });
          }

          // Emit progress update - we're getting data
          this.emit('progress', {
            taskId: task.id,
            phase: 'generating',
            progress: 50,
            message: 'Receiving generated tests from Claude...',
          } as AIProgressUpdate);
        });

        claude.stderr?.on('data', (data: Buffer) => {
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
            if (timeout) timeout.cancel();
            this.activeProcesses.delete(task.id);
            this.stopHeartbeatMonitoring(task.id);

            // Provide more helpful error messages
            if (error.message.includes('ENOENT')) {
              reject(
                new AIAuthenticationError(
                  'Claude CLI not found. Please ensure Claude Code is installed and available in PATH. ' +
                    'Visit https://docs.anthropic.com/claude-code for installation instructions.'
                )
              );
            } else {
              reject(new Error(`Failed to spawn Claude process: ${error.message}`));
            }
          }
        });

        claude.on('close', (code) => {
          // Clean up error handler
          this.removeListener('error:detected', errorHandler);

          if (!killed) {
            if (timeout) timeout.cancel();
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
                reject(
                  new AIAuthenticationError(
                    'Claude CLI authentication required. Please run Claude Code interactively first to authenticate. ' +
                      'Use: claude auth login'
                  )
                );
              } else if (stderr.includes('rate limit') || stderr.includes('quota')) {
                reject(
                  new AIRateLimitError(
                    'Claude API rate limit or quota exceeded. Please try again later or use a different model. ' +
                      'Consider using --model haiku for lower-cost generation.'
                  )
                );
              } else if (stderr.includes('network') || stderr.includes('connection')) {
                reject(
                  new AINetworkError(
                    'Network connection error while communicating with Claude API. ' +
                      'Please check your internet connection and try again.'
                  )
                );
              } else {
                reject(
                  new Error(`Claude process exited with code ${code}${stderr ? `: ${stderr}` : ''}`)
                );
              }
              return;
            }

            try {
              // Handle both text and JSON responses
              if (stdout.trim().startsWith('{')) {
                const result = JSON.parse(stdout) as {
                  result?: string;
                  output?: string;
                  content?: string;
                  usage?: { total_tokens?: number };
                  tokens_used?: number;
                  total_cost_usd?: number;
                  cost?: number;
                };
                const resolveData: {
                  output: string;
                  tokensUsed?: number;
                  cost?: number;
                } = {
                  output: result.result ?? result.output ?? result.content ?? stdout,
                };

                if (result.usage?.total_tokens !== undefined || result.tokens_used !== undefined) {
                  resolveData.tokensUsed = result.usage?.total_tokens ?? result.tokens_used!;
                }

                if (result.total_cost_usd !== undefined || result.cost !== undefined) {
                  resolveData.cost = result.total_cost_usd ?? result.cost!;
                }

                resolve(resolveData);
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
      };

      void executeTask();
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
    logger.info('Merging chunked results...');

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
        logger.info(`Writing merged results for ${sourceFile}`);
        await this.saveGeneratedTests(task, mergedContent);
      }
    }
  }

  /**
   * Static method to merge chunked results
   */
  private static mergeChunkedResults(
    _tasks: ChunkedAITask[],
    results: Map<string, string>
  ): Map<string, string> {
    // Simple merge logic to avoid circular dependency
    // Note: This is a simplified implementation - for full chunking support,
    // the ChunkedAITaskPreparation should be used directly
    const mergedResults = new Map<string, string>();

    // Copy existing results
    for (const [key, value] of results) {
      mergedResults.set(key, value);
    }

    return mergedResults;
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
      // Check if AI-generated tests already exist
      const aiGeneratedMarker = '// AI-Generated Logical Tests';
      if (existingContent.includes(aiGeneratedMarker)) {
        // Replace existing AI-generated section
        const markerIndex = existingContent.indexOf(aiGeneratedMarker);
        const beforeMarker = existingContent.substring(0, markerIndex).trim();
        const updatedContent = `${beforeMarker}\n\n${aiGeneratedMarker}\n${tests}`;
        await fs.writeFile(task.testFile, updatedContent, 'utf-8');
      } else {
        // Append logical tests to existing file
        const updatedContent = `${existingContent}\n\n// AI-Generated Logical Tests\n${tests}`;
        await fs.writeFile(task.testFile, updatedContent, 'utf-8');
      }
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
      circuitBreakerState: circuitBreakerState?.state ?? undefined,
      failureRate,
      successRate,
    };
  }

  /**
   * Get system-wide zombie processes
   */
  getZombieProcesses(): ProcessResourceUsage[] {
    return this.processMonitor.detectZombieProcesses();
  }

  /**
   * Get process monitoring status
   */
  getProcessMonitoringStatus(): {
    activeProcesses: number[];
    totalHistory: number;
    zombieProcesses: ProcessResourceUsage[];
  } {
    const status = this.processMonitor.getMonitoringStatus();
    const zombies = this.getZombieProcesses();

    return {
      ...status,
      zombieProcesses: zombies,
    };
  }

  /**
   * Get intelligent retry statistics
   */
  getRetryStatistics(): {
    failurePatterns: Map<string, { count: number; lastSeen: string; suggestion: string }>;
    taskMetrics: { complexity: string; count: number; avgSuccessTime: number }[];
    totalTasksWithMetrics: number;
  } {
    const rawPatterns = this.failurePatternDetector.getPatternStats();
    const patterns = new Map<string, { count: number; lastSeen: string; suggestion: string }>();

    // Transform the pattern data to match expected interface
    for (const [key, value] of rawPatterns) {
      patterns.set(key, {
        count: value.count,
        lastSeen: value.lastSeen.toISOString(),
        suggestion: `Consider using ${value.successfulRetryStrategies.length > 0 ? value.successfulRetryStrategies[0] : 'default'} strategy`,
      });
    }

    // Aggregate task metrics by complexity
    const complexityGroups = new Map<string, { times: number[]; count: number }>();

    for (const metric of this.taskMetrics.values()) {
      if (!complexityGroups.has(metric.complexity)) {
        complexityGroups.set(metric.complexity, { times: [], count: 0 });
      }
      const group = complexityGroups.get(metric.complexity)!;
      group.times.push(metric.successTime);
      group.count++;
    }

    const taskMetrics = Array.from(complexityGroups.entries()).map(([complexity, data]) => ({
      complexity,
      count: data.count,
      avgSuccessTime: data.times.reduce((sum, time) => sum + time, 0) / data.times.length,
    }));

    return {
      failurePatterns: patterns,
      taskMetrics,
      totalTasksWithMetrics: this.taskMetrics.size,
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
    const processMonitoringStatus = this.getProcessMonitoringStatus();
    const retryStats = this.getRetryStatistics();

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
      `- Circuit Breaker: ${reliabilityStatus.circuitBreakerState ?? 'Disabled'}`,
      '',
      '## Process Monitoring',
      `- Monitored Processes: ${processMonitoringStatus.activeProcesses.length}`,
      `- Total History Entries: ${processMonitoringStatus.totalHistory}`,
      `- Zombie Processes Detected: ${processMonitoringStatus.zombieProcesses.length}`,
      ...(processMonitoringStatus.zombieProcesses.length > 0
        ? [
            '',
            '### Zombie Processes',
            ...processMonitoringStatus.zombieProcesses.map(
              (zombie) =>
                `- PID ${zombie.pid}: ${zombie.command ?? 'unknown'} (Parent: ${zombie.ppid ?? 'unknown'})`
            ),
          ]
        : []),
      '',
      '## Resource Usage',
      `- Total Tokens: ${this.stats.totalTokensUsed.toLocaleString()}`,
      `- Total Cost: $${this.stats.totalCost.toFixed(2)}`,
      `- Average Cost per Task: $${avgCost}`,
      '',
      '## Intelligent Retry Statistics',
      `- Tasks with Metrics: ${retryStats.totalTasksWithMetrics}`,
      `- Failure Patterns Learned: ${retryStats.failurePatterns.size}`,
      ...(retryStats.taskMetrics.length > 0
        ? [
            '',
            '### Task Complexity Performance',
            ...retryStats.taskMetrics.map(
              (metric) =>
                `- ${metric.complexity.toUpperCase()}: ${metric.count} tasks, avg ${(metric.avgSuccessTime / 1000).toFixed(1)}s`
            ),
          ]
        : []),
      ...(retryStats.failurePatterns.size > 0
        ? [
            '',
            '### Learned Failure Patterns',
            ...Array.from(retryStats.failurePatterns.entries()).map(
              ([pattern, data]) =>
                `- ${pattern}: ${data.count} occurrences, last seen ${data.lastSeen}`
            ),
          ]
        : []),
      '',
      '## Configuration',
      `- Model: ${this.config.model}`,
      `- Fallback Model: ${this.config.fallbackModel ?? 'None'}`,
      `- Max Concurrent: ${this.config.maxConcurrent}`,
      `- Retry Attempts: ${this.config.retryAttempts}`,
      `- Exponential Backoff: ${this.config.exponentialBackoff ? 'Enabled' : 'Disabled'}`,
      `- Graceful Degradation: ${this.config.gracefulDegradation ? 'Enabled' : 'Disabled'}`,
      `- Intelligent Retry: Enabled (Adaptive timeout, Context-aware decisions, Pattern learning)`,
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

  /**
   * Clean up resources and cancel all active timers
   */
  cleanup(): void {
    // Cancel all heartbeat monitoring timers
    for (const [, heartbeat] of this.processHeartbeats) {
      if (heartbeat.checkInterval) {
        heartbeat.checkInterval.cancel();
      }
      if (heartbeat.timeoutProgress) {
        heartbeat.timeoutProgress.cancel();
      }
    }

    // Cancel all active timers in the timer service
    this.timerService.cancelAll();

    // Clean up process monitoring
    this.processMonitor.stopAll();

    // Clear all collections
    this.processHeartbeats.clear();
    this.activeProcesses.clear();
    this.taskQueue = [];
    this.results = [];
  }
}
