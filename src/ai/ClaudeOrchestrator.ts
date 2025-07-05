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
import { ProcessLimitValidator } from '../utils/ProcessLimitValidator';
import { logger } from '../utils/logger';
import { createStderrParser, type ParsedError } from '../utils/stderr-parser';
import {
  ProcessMonitor,
  type ProcessHealthMetrics,
  type ProcessResourceUsage,
} from '../utils/ProcessMonitor';
import { TaskCheckpointManager } from '../state/TaskCheckpointManager';

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
  // Usage tracking
  sessionUsage: {
    processesSpawned: number;
    peakConcurrency: number;
    usageWarnings: number;
    rateLimitHits: number;
  };
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

  constructor(private config: ClaudeOrchestratorConfig = {}) {
    super();
    this.config = {
      maxConcurrent: 2, // Reduced from 3 to prevent usage spikes
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

    // Initialize checkpoint manager if enabled and project path provided
    if (this.config.checkpointingEnabled && this.config.projectPath) {
      this.checkpointManager = new TaskCheckpointManager(this.config.projectPath);
    }

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

    // Initialize process monitor
    this.processMonitor = new ProcessMonitor({
      cpuThreshold: 85,
      memoryThreshold: 85,
      checkInterval: this.HEARTBEAT_INTERVAL,
      maxHistory: 50,
      zombieDetection: true,
    });

    // Initialize circuit breaker if enabled
    if (this.config.circuitBreakerEnabled) {
      this.circuitBreaker = new CircuitBreaker(5, 60000); // 5 failures, 1 minute recovery
    }
  }

  /**
   * Check if Claude CLI is available
   */
  private checkClaudeAvailable(): boolean {
    try {
      execSync('claude --version', { stdio: 'ignore' });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Test Claude CLI with a simple query
   */
  private testClaudeWithQuery(): {
    success: boolean;
    error?: string;
  } {
    try {
      const testResult = execSync('echo "test" | claude 2>&1', {
        encoding: 'utf-8',
        timeout: 10000,
      });

      // If we get any response back (even an error), the CLI is working
      // Empty output or timeout indicates authentication issues
      if (testResult && testResult.trim().length > 0) {
        // Check for specific authentication error patterns
        if (
          testResult.includes('authentication required') ||
          testResult.includes('not authenticated') ||
          testResult.includes('please login') ||
          testResult.includes('invalid credentials')
        ) {
          return {
            success: false,
            error:
              'Claude CLI not authenticated. Please run Claude Code interactively to authenticate.',
          };
        }
        return { success: true };
      }
      return { success: false };
    } catch (error) {
      return { success: false };
    }
  }

  /**
   * Test Claude CLI with config command
   */
  private testClaudeConfig(): {
    success: boolean;
    error?: string;
  } {
    try {
      const configCheck = execSync('claude config get 2>&1', { encoding: 'utf-8' });

      // More lenient check - just ensure we get some output and no auth errors
      if (
        configCheck &&
        !configCheck.includes('not authenticated') &&
        !configCheck.includes('please login') &&
        !configCheck.includes('authentication required')
      ) {
        return { success: true };
      }
      return {
        success: false,
        error:
          'Claude CLI not authenticated. Please run Claude Code interactively to authenticate.',
      };
    } catch (error) {
      return { success: false };
    }
  }

  /**
   * Handle authentication failure
   */
  private handleAuthFailure(error?: string): {
    authenticated: boolean;
    error: string;
    canDegrade?: boolean;
  } {
    return {
      authenticated: false,
      error:
        error ||
        'Claude CLI not authenticated. Please run Claude Code interactively to authenticate.',
      canDegrade: this.config.gracefulDegradation || false,
    };
  }

  /**
   * Validate Claude CLI authentication
   */
  validateClaudeAuth(): {
    authenticated: boolean;
    error?: string;
    canDegrade?: boolean;
  } {
    // Check if Claude CLI is available
    if (!this.checkClaudeAvailable()) {
      return this.handleAuthFailure(
        'Claude CLI not found. Please ensure Claude Code is installed and available in PATH.'
      );
    }

    // Try authentication strategies in order
    const queryTest = this.testClaudeWithQuery();
    if (queryTest.success) {
      this.isGracefullyDegraded = false;
      return { authenticated: true };
    }

    // If query test failed with auth error, return immediately
    if (queryTest.error) {
      return this.handleAuthFailure(queryTest.error);
    }

    // Try config check as fallback
    const configTest = this.testClaudeConfig();
    if (configTest.success) {
      this.isGracefullyDegraded = false;
      return { authenticated: true };
    }

    // Both strategies failed
    return this.handleAuthFailure(configTest.error);
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

    // Start process monitoring if we have a valid PID
    if (process.pid) {
      this.processMonitor.startMonitoring(process.pid);
    }

    // Set up periodic heartbeat checks
    const intervalFn = () => {
      this.checkProcessHealth(taskId);
    };
    heartbeat.checkInterval = setInterval(intervalFn, this.HEARTBEAT_INTERVAL);

    this.processHeartbeats.set(taskId, heartbeat);

    // Run initial check immediately (after heartbeat is stored)
    intervalFn();
  }

  /**
   * Stop heartbeat monitoring for a process
   */
  private stopHeartbeatMonitoring(taskId: string): void {
    const heartbeat = this.processHeartbeats.get(taskId);
    if (heartbeat) {
      // Stop process monitoring if we have a valid PID
      if (heartbeat.process.pid) {
        this.processMonitor.stopMonitoring(heartbeat.process.pid);
      }

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
  private updateProcessActivity(
    taskId: string,
    bytesReceived: number,
    isStdout: boolean,
    data?: string
  ): void {
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

    return this.processMonitor.getResourceUsage(pid) || undefined;
  }

  /**
   * Check if a process is healthy
   */
  private checkProcessHealth(taskId: string): void {
    const heartbeat = this.processHeartbeats.get(taskId);
    if (!heartbeat) return;

    const timeSinceLastActivity = Date.now() - heartbeat.lastActivity.getTime();
    const timeSinceStart = Date.now() - (heartbeat.startTime?.getTime() || Date.now());

    // Get health metrics from ProcessMonitor if available
    let healthMetrics: ProcessHealthMetrics | undefined;
    if (heartbeat.process.pid) {
      healthMetrics = this.processMonitor.getHealthMetrics(heartbeat.process.pid);
      heartbeat.healthMetrics = healthMetrics;
      if (healthMetrics.resourceUsage) {
        heartbeat.resourceUsage = healthMetrics.resourceUsage;
      }
    }

    // Enhanced heuristics for determining process health
    const processMetrics = this.analyzeProcessHealth(
      heartbeat,
      timeSinceLastActivity,
      timeSinceStart
    );

    // Check for zombie processes
    if (healthMetrics?.isZombie) {
      logger.error(`Process ${taskId} is a zombie process`);

      this.emit('process:zombie', {
        taskId,
        lastActivity: heartbeat.lastActivity,
        bytesReceived: heartbeat.stdoutBytes + heartbeat.stderrBytes,
        timeSinceLastActivity,
        healthMetrics,
        resourceUsage: heartbeat.resourceUsage,
      });

      // Kill zombie process and stop monitoring
      if (heartbeat.process && !heartbeat.process.killed) {
        logger.warn(`Attempting to kill zombie process ${taskId}`);
        heartbeat.process.kill('SIGKILL'); // Use SIGKILL directly for zombies
      }
      this.stopHeartbeatMonitoring(taskId);
      return;
    }

    // Check for high resource usage
    if (healthMetrics?.isHighResource) {
      logger.warn(`Process ${taskId} high resource usage: ${healthMetrics.warnings.join(', ')}`);

      this.emit('process:high-resource', {
        taskId,
        lastActivity: heartbeat.lastActivity,
        bytesReceived: heartbeat.stdoutBytes + heartbeat.stderrBytes,
        timeSinceLastActivity,
        healthMetrics,
        resourceUsage: heartbeat.resourceUsage,
        recommendations: healthMetrics.recommendations,
      });
    }

    // Check if process might be waiting for input
    if (this.checkForInputWait(heartbeat, timeSinceLastActivity)) {
      logger.warn(
        `Process ${taskId} may be waiting for input - no activity for ${timeSinceLastActivity / 1000}s`
      );

      this.emit('process:waiting-input', {
        taskId,
        lastActivity: heartbeat.lastActivity,
        bytesReceived: heartbeat.stdoutBytes + heartbeat.stderrBytes,
        timeSinceLastActivity,
        healthMetrics,
        resourceUsage: heartbeat.resourceUsage,
      });

      // Don't kill processes that might be waiting for input yet
      return;
    }

    // Check if process appears to be dead
    if (processMetrics.isDead) {
      logger.warn(`Process ${taskId} appears to be dead - ${processMetrics.reason}`);

      // Emit warning event with enhanced metrics
      this.emit('process:dead', {
        taskId,
        lastActivity: heartbeat.lastActivity,
        bytesReceived: heartbeat.stdoutBytes + heartbeat.stderrBytes,
        timeSinceLastActivity,
        reason: processMetrics.reason,
        metrics: processMetrics,
        healthMetrics,
        resourceUsage: heartbeat.resourceUsage,
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
        healthMetrics,
        resourceUsage: heartbeat.resourceUsage,
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
    const recentProgressMarkers =
      heartbeat.progressHistory?.filter(
        (entry) => entry.marker && Date.now() - entry.timestamp.getTime() < 60000
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

    // Look for actual input prompt patterns, not progress markers
    const hasInputPrompt = recentHistory.some((entry) => {
      if (!entry.marker || entry.bytes > 20) return false; // Input prompts are very short

      const text = entry.marker.toLowerCase();
      // Common input prompt patterns
      const inputPatterns = [
        />\s*$/, // "> "
        /:\s*$/, // ": "
        /\?\s*$/, // "? "
        /enter\s*$/, // "enter"
        /input\s*$/, // "input"
        /password\s*$/, // "password"
        /continue\s*$/, // "continue"
      ];

      return inputPatterns.some((pattern) => pattern.test(text));
    });

    // Only flag as waiting for input if we detect actual prompt patterns
    if (hasInputPrompt && heartbeat.stdoutBytes < 1000) {
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
      message: 'Validating Claude CLI authentication...',
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
          message:
            'AI test generation will return placeholder tests. Install Claude Code for full functionality.',
        });
      } else {
        throw new AIAuthenticationError(authStatus.error || 'Authentication failed');
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

    // Validate global process limits
    const processValidation = ProcessLimitValidator.validateProcessLimit(maxConcurrent);
    if (!processValidation.allowed) {
      logger.error(processValidation.message);
      logger.info('\n' + ProcessLimitValidator.getProcessStatus());

      // Try to wait for a slot
      logger.info('Waiting for Claude processes to complete...');
      const slotAvailable = await ProcessLimitValidator.waitForProcessSlot(30000);

      if (!slotAvailable) {
        throw new Error(
          `Cannot proceed: Too many Claude processes active (${processValidation.current}/${processValidation.max}). ` +
            `Please wait for existing processes to complete or reduce concurrency settings.`
        );
      }
    }

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
          progress: resumeInfo.lastProgress || 0,
          message: `Resuming task ${task.id} from checkpoint (${resumeInfo.lastProgress}% complete)`,
          estimatedTimeRemaining:
            task.estimatedTokens * 10 * ((100 - (resumeInfo.lastProgress || 0)) / 100),
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
        maxAttempts: this.config.retryAttempts || 3,
        initialDelay: this.config.retryDelay || 1000,
        maxDelay: this.config.maxRetryDelay || 30000,
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
          tokensUsed: retryResult.result.tokensUsed || task.estimatedTokens,
          actualCost: retryResult.result.cost || task.estimatedCost,
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
        error: retryResult.error?.message || 'Unknown error',
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
    return new Promise(async (resolve, reject) => {
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
        console.log(`Executing Claude for task ${task.id} with model ${this.config.model}...`);
      }

      // Emit progress update for generation start
      this.emit('progress', {
        taskId: task.id,
        phase: 'generating',
        progress: 10,
        message: `Generating tests with ${this.config.model} model...`,
        estimatedTimeRemaining: task.estimatedTokens * 10,
      } as AIProgressUpdate);

      // Validate we can spawn another process
      const spawnValidation = ProcessLimitValidator.validateProcessLimit(1);
      if (!spawnValidation.allowed) {
        // Wait for a slot to become available
        const slotAvailable = await ProcessLimitValidator.waitForProcessSlot(30000);
        if (!slotAvailable) {
          reject(
            new Error(
              `Cannot spawn Claude process: ${spawnValidation.message}. ` +
                `Current processes: ${spawnValidation.current}/${spawnValidation.max}`
            )
          );
          return;
        }
      }

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

      // Track usage statistics
      this.stats.sessionUsage.processesSpawned++;
      const currentConcurrency = this.activeProcesses.size;
      if (currentConcurrency > this.stats.sessionUsage.peakConcurrency) {
        this.stats.sessionUsage.peakConcurrency = currentConcurrency;
      }

      // Check for usage warning threshold
      if (currentConcurrency >= 3 && this.stats.sessionUsage.usageWarnings === 0) {
        this.stats.sessionUsage.usageWarnings++;
        logger.warn(`⚠️  High concurrency detected: ${currentConcurrency} Claude processes active`);
        logger.warn('This may cause rapid usage depletion. Consider using sequential processing.');
      }

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
        setTimeout(() => {
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

      claude.stdout.on('data', (data) => {
        const dataStr = data.toString();
        const bytes = data.length;
        stdout += dataStr;

        // Update heartbeat activity with data content
        this.updateProcessActivity(task.id, bytes, true, dataStr);

        // Update checkpoint with partial progress
        if (checkpointId && this.checkpointManager) {
          const progress = Math.min(50 + (stdout.length / estimatedTokens) * 40, 90); // Scale 50-90%
          this.checkpointManager.updateCheckpoint(checkpointId, {
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
                  (this.processHeartbeats.get(task.id)?.startTime?.getTime() || Date.now())),
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
              reject(
                new AIAuthenticationError(
                  'Claude CLI authentication required. Please run Claude Code interactively first to authenticate. ' +
                    'Use: claude auth login'
                )
              );
            } else if (stderr.includes('rate limit') || stderr.includes('quota')) {
              // Track rate limit hits
              this.stats.sessionUsage.rateLimitHits++;
              logger.warn(`Rate limit hit #${this.stats.sessionUsage.rateLimitHits} for session`);

              reject(
                new AIRateLimitError(
                  'Claude API rate limit or quota exceeded. Please try again later or use a different model. ' +
                    'Consider using --model haiku for lower-cost generation or reducing concurrency.'
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
      circuitBreakerState: circuitBreakerState?.state || undefined,
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
    failurePatterns: Map<string, any>;
    taskMetrics: { complexity: string; count: number; avgSuccessTime: number }[];
    totalTasksWithMetrics: number;
  } {
    const patterns = this.failurePatternDetector.getPatternStats();

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
      `- Circuit Breaker: ${reliabilityStatus.circuitBreakerState || 'Disabled'}`,
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
                `- PID ${zombie.pid}: ${zombie.command || 'unknown'} (Parent: ${zombie.ppid || 'unknown'})`
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
                `- ${pattern}: ${data.count} occurrences, last seen ${data.lastSeen.toISOString().split('T')[0]}`
            ),
          ]
        : []),
      '',
      '## Configuration',
      `- Model: ${this.config.model}`,
      `- Fallback Model: ${this.config.fallbackModel || 'None'}`,
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
      sessionUsage: {
        processesSpawned: 0,
        peakConcurrency: 0,
        usageWarnings: 0,
        rateLimitHits: 0,
      },
    };
  }
}
