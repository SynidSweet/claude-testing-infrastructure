import { EventEmitter } from 'events';
import { logger } from '../../utils/logger';
import type { AITask, AITaskBatch } from '../AITaskPreparation';
import type { AIProgressUpdate, TaskEventData, BatchEventData } from '../../types/ai-error-types';
import type { TaskRetryContext } from '../../utils/retry-helper';

/**
 * Task performance metrics for intelligent retry strategies
 */
interface TaskPerformanceMetrics {
  successTime: number;
  complexity: 'low' | 'medium' | 'high';
}

/**
 * Configuration for TaskQueueManager
 */
interface TaskQueueConfig {
  maxConcurrency: number;
  timeout?: number | undefined;
  verbose?: boolean | undefined;
}

/**
 * Task processor function type - implemented by ClaudeOrchestrator
 */
type TaskProcessor = (task: AITask) => Promise<void>;

/**
 * TaskQueueManager handles task scheduling, concurrency control, and batch management
 * for the ClaudeOrchestrator. This service manages the task queue lifecycle without
 * being concerned with the actual AI processing logic.
 */
export class TaskQueueManager extends EventEmitter {
  private taskQueue: AITask[] = [];
  private isRunning = false;
  private activePromises = new Set<Promise<void>>();
  private taskMetrics = new Map<string, TaskPerformanceMetrics>();
  private config: TaskQueueConfig;

  constructor(config: TaskQueueConfig) {
    super();
    this.config = config;
  }

  /**
   * Initialize and process a batch of tasks
   */
  async processBatch(
    batch: AITaskBatch,
    taskProcessor: TaskProcessor,
    onProgress?: (update: AIProgressUpdate) => void
  ): Promise<void> {
    if (this.isRunning) {
      throw new Error('TaskQueueManager is already running');
    }

    this.isRunning = true;
    this.taskQueue = [...batch.tasks];

    // Update max concurrency from batch if specified
    const maxConcurrent = Math.min(
      batch.maxConcurrency || this.config.maxConcurrency,
      this.config.maxConcurrency
    );

    const batchStartData: BatchEventData = { batch };
    this.emit('batch:start', batchStartData);

    try {
      // Start initial concurrent processes
      const promises: Promise<void>[] = [];
      for (let i = 0; i < Math.min(maxConcurrent, this.taskQueue.length); i++) {
        const promise = this.processNextTask(taskProcessor, onProgress);
        promises.push(promise);
        this.activePromises.add(promise);

        // Clean up completed promises
        promise.finally(() => {
          this.activePromises.delete(promise);
        });
      }

      // Wait for all tasks to complete
      await Promise.all(promises);

      this.emit('batch:complete', { stats: this.getQueueStats() });
    } finally {
      this.isRunning = false;
      this.cleanup();
    }
  }

  /**
   * Process the next task in the queue with concurrency control
   */
  private async processNextTask(
    taskProcessor: TaskProcessor,
    onProgress?: (update: AIProgressUpdate) => void
  ): Promise<void> {
    while (this.taskQueue.length > 0) {
      const task = this.taskQueue.shift();
      if (!task) break;

      try {
        const taskStartData: TaskEventData = { task };
        this.emit('task:start', taskStartData);

        if (onProgress) {
          onProgress({
            taskId: task.id,
            phase: 'preparing',
            progress: 0,
            message: `Starting task ${task.id}...`,
            estimatedTimeRemaining: task.estimatedTokens * 10,
          } as AIProgressUpdate);
        }

        await taskProcessor(task);

        const taskCompleteData: TaskEventData = { task };
        this.emit('task:complete', taskCompleteData);
      } catch (error: unknown) {
        const taskError = error instanceof Error ? error : new Error(String(error));
        const taskFailedData: TaskEventData = {
          task,
          error: taskError,
        };
        this.emit('task:failed', taskFailedData);

        logger.error(`Task ${task.id} failed:`, taskError.message);
      }
    }
  }

  /**
   * Assess task complexity based on context for intelligent scheduling
   */
  assessTaskComplexity(task: AITask): 'low' | 'medium' | 'high' {
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
  createTaskRetryContext(task: AITask): TaskRetryContext {
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
   * Track task performance metrics for future intelligent retry decisions
   */
  trackTaskSuccess(taskId: string, duration: number, complexity: 'low' | 'medium' | 'high'): void {
    this.taskMetrics.set(taskId, {
      successTime: duration,
      complexity,
    });

    // Update average success time for this complexity level
    const similarTasks = Array.from(this.taskMetrics.values()).filter(
      (metric) => metric.complexity === complexity
    );
    const avgSuccessTime =
      similarTasks.reduce((sum, metric) => sum + metric.successTime, 0) / similarTasks.length;

    logger.debug(
      `Task ${taskId} completed: duration=${duration}ms, ` +
        `complexity=${complexity}, avgForComplexity=${Math.round(avgSuccessTime)}ms`
    );
  }

  /**
   * Get queue statistics
   */
  getQueueStats() {
    return {
      queueLength: this.taskQueue.length,
      activeProcesses: this.activePromises.size,
      totalTaskMetrics: this.taskMetrics.size,
      isRunning: this.isRunning,
    };
  }

  /**
   * Check if queue is currently processing tasks
   */
  isQueueRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Get current queue length
   */
  getQueueLength(): number {
    return this.taskQueue.length;
  }

  /**
   * Get number of active concurrent processes
   */
  getActiveProcessCount(): number {
    return this.activePromises.size;
  }

  /**
   * Stop queue processing and cleanup
   */
  async stop(): Promise<void> {
    if (!this.isRunning) return;

    this.isRunning = false;

    // Wait for active promises to complete
    if (this.activePromises.size > 0) {
      await Promise.allSettled(this.activePromises);
    }

    this.cleanup();
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    this.taskQueue = [];
    this.activePromises.clear();
    this.removeAllListeners();
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<TaskQueueConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get task metrics for statistics and reporting
   */
  getTaskMetrics(): Map<string, TaskPerformanceMetrics> {
    return new Map(this.taskMetrics);
  }
}
