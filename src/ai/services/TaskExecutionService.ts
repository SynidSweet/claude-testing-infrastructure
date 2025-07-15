/**
 * Task Execution Service
 *
 * Handles task execution coordination:
 * - Checkpoint management and resumption
 * - Degraded mode execution
 * - Retry logic with circuit breaker
 * - Result handling and aggregation
 */

import { EventEmitter } from 'events';
import type { AITask } from '../AITaskPreparation';
import type { ProcessResult } from './ResultAggregator';
import type { ProcessExecutor } from './ProcessExecutor';
import type { DegradedModeHandler } from './DegradedModeHandler';
import type { ResultAggregator } from './ResultAggregator';
import type { TaskQueueManager } from './TaskQueueManager';
import type { TaskCheckpointManager } from '../../state/TaskCheckpointManager';
import type { ClaudeOrchestratorConfig } from '../ClaudeOrchestrator';
import {
  withRetry,
  CircuitBreaker,
  FailurePatternDetector,
  AITimeoutError,
  AINetworkError,
  AIRateLimitError,
} from '../../utils/retry-helper';
import { AIError, AITaskError, type AIProgressUpdate } from '../../types/ai-error-types';
import { logger } from '../../utils/logger';

/**
 * Task retry event data
 */
interface TaskRetryEventData {
  task: AITask;
  attemptNumber: number;
  error: string;
  nextRetryIn: number;
  complexity: 'low' | 'medium' | 'high';
  strategy: string;
}

/**
 * Task event data
 */
interface TaskEventData {
  task: AITask;
  result?: ProcessResult | undefined;
  error?: AIError | undefined;
  degraded?: boolean | undefined;
}

/**
 * Service responsible for executing individual AI tasks with comprehensive
 * error handling, retry logic, and checkpoint management
 */
export class TaskExecutionService extends EventEmitter {
  private activeCheckpoints = new Map<string, string>(); // taskId -> checkpointId

  constructor(
    private config: ClaudeOrchestratorConfig,
    private processExecutor: ProcessExecutor,
    private degradedModeHandler: DegradedModeHandler,
    private resultAggregator: ResultAggregator,
    private taskQueueManager: TaskQueueManager,
    private failurePatternDetector: FailurePatternDetector,
    private circuitBreaker: CircuitBreaker | null,
    private isGracefullyDegraded: boolean,
    private checkpointManager?: TaskCheckpointManager
  ) {
    super();
  }

  /**
   * Process a single task
   */
  async processTask(task: AITask): Promise<void> {
    const startTime = Date.now();

    const taskStartData: TaskEventData = { task };
    this.emit('task:start', taskStartData);

    // Check for existing checkpoint and potentially resume
    const { checkpointId, shouldResume } = await this.setupCheckpointForTask(task);

    // Handle graceful degradation
    if (this.isGracefullyDegraded) {
      const processResult = await this.degradedModeHandler.handleDegradedTask(
        task,
        startTime,
        checkpointId,
        this.checkpointManager
      );

      if (checkpointId) {
        this.activeCheckpoints.delete(task.id);
      }

      // Save generated tests and add result
      await this.resultAggregator.saveGeneratedTests(task, processResult.result!.generatedTests);
      this.resultAggregator.addSuccessResult(task.id, processResult.result!);
      const taskCompleteData: TaskEventData = {
        task,
        result: processResult,
        degraded: true,
      };
      this.emit('task:complete', taskCompleteData);
      return;
    }

    // Execute task with retry logic
    await this.executeTaskWithRetry(task, shouldResume, checkpointId, startTime);
  }

  /**
   * Set up checkpoint for task execution
   */
  private async setupCheckpointForTask(
    task: AITask
  ): Promise<{ checkpointId?: string; shouldResume: boolean }> {
    if (!this.checkpointManager) {
      // No checkpointing - emit normal progress
      this.emit('progress', {
        taskId: task.id,
        phase: 'preparing',
        progress: 0,
        message: `Processing task ${task.id}`,
        estimatedTimeRemaining: task.estimatedTokens * 10,
      } as AIProgressUpdate);
      return { shouldResume: false };
    }

    const resumeInfo = await this.checkpointManager.canResume(task);
    if (resumeInfo.canResume && resumeInfo.checkpointId) {
      this.emit('progress', {
        taskId: task.id,
        phase: 'preparing',
        progress: resumeInfo.lastProgress ?? 0,
        message: `Resuming task ${task.id} from checkpoint (${resumeInfo.lastProgress}% complete)`,
        estimatedTimeRemaining:
          task.estimatedTokens * 10 * ((100 - (resumeInfo.lastProgress ?? 0)) / 100),
      } as AIProgressUpdate);

      logger.info(`Resuming task ${task.id} from checkpoint ${resumeInfo.checkpointId}`);
      return { checkpointId: resumeInfo.checkpointId, shouldResume: true };
    } else {
      // Create new checkpoint
      const checkpointId = await this.checkpointManager.createCheckpoint(task, 'preparing');
      this.activeCheckpoints.set(task.id, checkpointId);

      this.emit('progress', {
        taskId: task.id,
        phase: 'preparing',
        progress: 0,
        message: `Processing task ${task.id} (checkpoint created)`,
        estimatedTimeRemaining: task.estimatedTokens * 10,
      } as AIProgressUpdate);

      return { checkpointId, shouldResume: false };
    }
  }

  /**
   * Execute task with intelligent retry logic
   */
  private async executeTaskWithRetry(
    task: AITask,
    shouldResume: boolean,
    checkpointId: string | undefined,
    startTime: number
  ): Promise<void> {
    // Create intelligent retry context using TaskQueueManager
    const retryContext = this.taskQueueManager.createTaskRetryContext(task);

    // Use intelligent retry helper with adaptive strategies
    const retryResult = await withRetry(
      async () => {
        // Use circuit breaker if enabled
        if (this.circuitBreaker) {
          return await this.circuitBreaker.execute(() =>
            this.processExecutor.executeClaudeProcess(task, shouldResume, checkpointId)
          );
        } else {
          return await this.processExecutor.executeClaudeProcess(task, shouldResume, checkpointId);
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

          const retryEventData: TaskRetryEventData = {
            task,
            attemptNumber: attempt,
            error: error.message,
            nextRetryIn: delay,
            complexity: retryContext.complexity,
            strategy: this.failurePatternDetector.getRecommendedStrategy(error).strategy,
          };
          this.emit('task:retry', retryEventData);

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

    // Handle results
    await this.handleTaskResult(task, retryResult, checkpointId, retryContext, startTime);
  }

  /**
   * Handle task execution result
   */
  private async handleTaskResult(
    task: AITask,
    retryResult: any,
    checkpointId: string | undefined,
    retryContext: any,
    startTime: number
  ): Promise<void> {
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

      // Track successful task metrics using TaskQueueManager
      this.taskQueueManager.trackTaskSuccess(
        task.id,
        processResult.result!.duration,
        retryContext.complexity
      );

      // Save generated tests and add result
      await this.resultAggregator.saveGeneratedTests(task, processResult.result!.generatedTests);
      this.resultAggregator.addSuccessResult(task.id, processResult.result!);
      const taskCompleteData: TaskEventData = { task, result: processResult };
      this.emit('task:complete', taskCompleteData);
    } else {
      // Final failure
      const processResult: ProcessResult = {
        taskId: task.id,
        success: false,
        error:
          retryResult.error instanceof AIError
            ? retryResult.error
            : new AITaskError(
                retryResult.error?.message ?? 'Unknown error',
                task.id,
                'ai-generation',
                { originalError: retryResult.error }
              ),
      };

      // Fail checkpoint if enabled
      if (checkpointId && this.checkpointManager) {
        await this.checkpointManager.failCheckpoint(checkpointId, processResult.error!.message);
        this.activeCheckpoints.delete(task.id);
      }

      this.resultAggregator.addFailureResult(task.id, processResult.error!);
      const taskFailedData: TaskEventData = { task, error: processResult.error };
      this.emit('task:failed', taskFailedData);
    }
  }

  /**
   * Update graceful degradation status
   */
  setGracefullyDegraded(isGracefullyDegraded: boolean): void {
    this.isGracefullyDegraded = isGracefullyDegraded;
  }
}
