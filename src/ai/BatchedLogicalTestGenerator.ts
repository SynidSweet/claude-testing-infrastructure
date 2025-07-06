/**
 * Batched Logical Test Generator
 *
 * Provides iterative, configurable batch processing for AI test generation:
 * - Configurable batch sizes for manageable AI processing
 * - State persistence between executions
 * - Progress tracking and resume functionality
 * - Cost estimation per batch
 */

import type { TestGapAnalysisResult } from '../analyzers/TestGapAnalyzer';
import type { AITask, AITaskBatch, AITaskPreparation } from './AITaskPreparation';
import { ClaudeOrchestrator, type ProcessResult } from './ClaudeOrchestrator';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface BatchProgress {
  batchId: string;
  projectPath: string;
  totalTasks: number;
  completedBatches: number;
  totalBatches: number;
  completedTasks: number;
  failedTasks: number;
  totalEstimatedCost: number;
  actualCostSoFar: number;
  startTime: string;
  lastUpdate: string;
  nextBatchIndex: number;
  config: BatchConfig;
}

export interface BatchConfig {
  batchSize: number;
  model: string;
  maxConcurrent: number;
  timeout: number;
  minComplexity: number;
  costLimit?: number | undefined;
}

export interface BatchResult {
  batchIndex: number;
  batchSize: number;
  results: ProcessResult[];
  stats: {
    completed: number;
    failed: number;
    totalCost: number;
    totalTokens: number;
    duration: number;
  };
}

export interface BatchInfo {
  index: number;
  tasks: AITask[];
  estimatedCost: number;
  estimatedTokens: number;
}

export class BatchedLogicalTestGenerator {
  private static readonly STATE_FILE = '.claude-testing/batch-state.json';

  constructor(
    private batchSize: number = 10,
    private taskPreparation: AITaskPreparation
  ) {
    if (batchSize < 1 || batchSize > 50) {
      throw new Error('Batch size must be between 1 and 50');
    }
  }

  /**
   * Generate a specific batch of logical tests
   */
  async generateBatch(
    gapReport: TestGapAnalysisResult,
    batchIndex: number,
    config: BatchConfig
  ): Promise<BatchResult> {
    // Prepare all tasks first
    const fullBatch = await this.taskPreparation.prepareTasks(gapReport);

    // Extract the specific batch
    const startIndex = batchIndex * config.batchSize;
    const endIndex = Math.min(startIndex + config.batchSize, fullBatch.tasks.length);
    const batchTasks = fullBatch.tasks.slice(startIndex, endIndex);

    if (batchTasks.length === 0) {
      throw new Error(`Batch ${batchIndex} is empty - no more tasks to process`);
    }

    // Create batch for orchestrator
    const batch: AITaskBatch = {
      id: `batch-${batchIndex}-${Date.now()}`,
      tasks: batchTasks,
      totalEstimatedTokens: batchTasks.reduce((sum, t) => sum + t.estimatedTokens, 0),
      totalEstimatedCost: batchTasks.reduce((sum, t) => sum + t.estimatedCost, 0),
      maxConcurrency: config.maxConcurrent,
    };

    // Check cost limit if specified
    if (config.costLimit && batch.totalEstimatedCost > config.costLimit) {
      throw new Error(
        `Batch estimated cost ($${batch.totalEstimatedCost.toFixed(2)}) exceeds limit ($${config.costLimit.toFixed(2)})`
      );
    }

    // Execute the batch
    const orchestrator = new ClaudeOrchestrator({
      maxConcurrent: config.maxConcurrent,
      model: config.model,
      fallbackModel: config.model === 'opus' ? 'sonnet' : 'haiku',
      timeout: config.timeout,
      verbose: false,
      gracefulDegradation: true,
      exponentialBackoff: true,
      circuitBreakerEnabled: true,
      maxRetryDelay: 30000,
    });

    const startTime = Date.now();
    const results = await orchestrator.processBatch(batch);
    const duration = Date.now() - startTime;

    // Calculate stats
    const completed = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;
    const totalCost = results.reduce((sum, r) => sum + (r.result?.actualCost ?? 0), 0);
    const totalTokens = results.reduce((sum, r) => sum + (r.result?.tokensUsed ?? 0), 0);

    return {
      batchIndex,
      batchSize: batchTasks.length,
      results,
      stats: {
        completed,
        failed,
        totalCost,
        totalTokens,
        duration,
      },
    };
  }

  /**
   * Get information about the next batch to process
   */
  async getNextBatch(
    projectPath: string,
    gapReport: TestGapAnalysisResult
  ): Promise<BatchInfo | null> {
    const stateFile = path.join(projectPath, BatchedLogicalTestGenerator.STATE_FILE);
    let progress: BatchProgress | null = null;

    try {
      const stateContent = await fs.readFile(stateFile, 'utf-8');
      const parsed = JSON.parse(stateContent) as unknown;
      if (this.isValidBatchProgress(parsed)) {
        progress = parsed;
      }
    } catch {
      // No existing state
    }

    const nextIndex = progress?.nextBatchIndex ?? 0;

    // Prepare all tasks to determine batch bounds
    const fullBatch = await this.taskPreparation.prepareTasks(gapReport);
    const totalTasks = fullBatch.tasks.length;
    const totalBatches = Math.ceil(totalTasks / this.batchSize);

    if (nextIndex >= totalBatches) {
      return null; // All batches complete
    }

    const startIndex = nextIndex * this.batchSize;
    const endIndex = Math.min(startIndex + this.batchSize, totalTasks);
    const batchTasks = fullBatch.tasks.slice(startIndex, endIndex);

    return {
      index: nextIndex,
      tasks: batchTasks,
      estimatedCost: batchTasks.reduce((sum, t) => sum + t.estimatedCost, 0),
      estimatedTokens: batchTasks.reduce((sum, t) => sum + t.estimatedTokens, 0),
    };
  }

  /**
   * Save batch processing state for resume functionality
   */
  async saveBatchState(projectPath: string, progress: BatchProgress): Promise<void> {
    const stateFile = path.join(projectPath, BatchedLogicalTestGenerator.STATE_FILE);
    const stateDir = path.dirname(stateFile);

    await fs.mkdir(stateDir, { recursive: true });
    await fs.writeFile(stateFile, JSON.stringify(progress, null, 2), 'utf-8');
  }

  /**
   * Load existing batch processing state
   */
  async loadBatchState(projectPath: string): Promise<BatchProgress | null> {
    const stateFile = path.join(projectPath, BatchedLogicalTestGenerator.STATE_FILE);

    try {
      const stateContent = await fs.readFile(stateFile, 'utf-8');
      const parsed = JSON.parse(stateContent) as unknown;

      // Validate that the parsed object has the required BatchProgress structure
      if (this.isValidBatchProgress(parsed)) {
        return parsed;
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Initialize batch processing state
   */
  async initializeBatchState(
    projectPath: string,
    gapReport: TestGapAnalysisResult,
    config: BatchConfig
  ): Promise<BatchProgress> {
    // Prepare all tasks to get totals
    const fullBatch = await this.taskPreparation.prepareTasks(gapReport);
    const totalTasks = fullBatch.tasks.length;
    const totalBatches = Math.ceil(totalTasks / config.batchSize);

    const progress: BatchProgress = {
      batchId: `batch-${Date.now()}`,
      projectPath,
      totalTasks,
      completedBatches: 0,
      totalBatches,
      completedTasks: 0,
      failedTasks: 0,
      totalEstimatedCost: fullBatch.totalEstimatedCost,
      actualCostSoFar: 0,
      startTime: new Date().toISOString(),
      lastUpdate: new Date().toISOString(),
      nextBatchIndex: 0,
      config,
    };

    await this.saveBatchState(projectPath, progress);
    return progress;
  }

  /**
   * Update batch processing state after completing a batch
   */
  async updateBatchState(projectPath: string, batchResult: BatchResult): Promise<BatchProgress> {
    const progress = await this.loadBatchState(projectPath);
    if (!progress) {
      throw new Error('No batch state found to update');
    }

    progress.completedBatches++;
    progress.completedTasks += batchResult.stats.completed;
    progress.failedTasks += batchResult.stats.failed;
    progress.actualCostSoFar += batchResult.stats.totalCost;
    progress.lastUpdate = new Date().toISOString();
    progress.nextBatchIndex = batchResult.batchIndex + 1;

    await this.saveBatchState(projectPath, progress);
    return progress;
  }

  /**
   * Get processing statistics and progress report
   */
  async getProgressReport(projectPath: string): Promise<string | null> {
    const progress = await this.loadBatchState(projectPath);
    if (!progress) {
      return null;
    }

    const completionPercentage = (
      (progress.completedBatches / progress.totalBatches) *
      100
    ).toFixed(1);
    const taskCompletionPercentage = (
      (progress.completedTasks / progress.totalTasks) *
      100
    ).toFixed(1);
    const avgCostPerTask =
      progress.completedTasks > 0 ? progress.actualCostSoFar / progress.completedTasks : 0;

    const report = [
      '# Batched AI Test Generation Progress',
      '',
      '## Overall Progress',
      `- Batches: ${progress.completedBatches}/${progress.totalBatches} (${completionPercentage}%)`,
      `- Tasks: ${progress.completedTasks}/${progress.totalTasks} (${taskCompletionPercentage}%)`,
      `- Failed Tasks: ${progress.failedTasks}`,
      '',
      '## Cost Analysis',
      `- Estimated Total: $${progress.totalEstimatedCost.toFixed(2)}`,
      `- Actual So Far: $${progress.actualCostSoFar.toFixed(2)}`,
      `- Average per Task: $${avgCostPerTask.toFixed(3)}`,
      '',
      '## Configuration',
      `- Batch Size: ${progress.config.batchSize}`,
      `- Model: ${progress.config.model}`,
      `- Max Concurrent: ${progress.config.maxConcurrent}`,
      `- Timeout: ${progress.config.timeout / 1000}s`,
      '',
      '## Timeline',
      `- Started: ${progress.startTime}`,
      `- Last Update: ${progress.lastUpdate}`,
      '',
    ];

    return report.join('\n');
  }

  /**
   * Clean up batch processing state
   */
  async cleanupBatchState(projectPath: string): Promise<void> {
    const stateFile = path.join(projectPath, BatchedLogicalTestGenerator.STATE_FILE);

    try {
      await fs.unlink(stateFile);
    } catch {
      // File doesn't exist, which is fine
    }
  }

  /**
   * Validate that batching is beneficial for the given gap report
   */
  validateBatchingBenefit(gapReport: TestGapAnalysisResult): {
    beneficial: boolean;
    reason: string;
  } {
    const taskCount = gapReport.gaps.length;

    if (taskCount <= this.batchSize) {
      return {
        beneficial: false,
        reason: `Only ${taskCount} tasks found, which fits in a single batch of ${this.batchSize}`,
      };
    }

    if (taskCount < this.batchSize * 2) {
      return {
        beneficial: false,
        reason: `Only ${taskCount} tasks found, batching provides minimal benefit`,
      };
    }

    return {
      beneficial: true,
      reason: `${taskCount} tasks found, batching into ${Math.ceil(taskCount / this.batchSize)} batches will provide better control`,
    };
  }

  /**
   * Type guard to validate BatchProgress object structure
   */
  private isValidBatchProgress(obj: unknown): obj is BatchProgress {
    return (
      typeof obj === 'object' &&
      obj !== null &&
      'batchId' in obj &&
      'projectPath' in obj &&
      'totalTasks' in obj &&
      'completedBatches' in obj &&
      'totalBatches' in obj &&
      'completedTasks' in obj &&
      'failedTasks' in obj &&
      'totalEstimatedCost' in obj &&
      'actualCostSoFar' in obj &&
      'startTime' in obj &&
      'lastUpdate' in obj &&
      'nextBatchIndex' in obj &&
      'config' in obj &&
      typeof (obj as BatchProgress).batchId === 'string' &&
      typeof (obj as BatchProgress).projectPath === 'string' &&
      typeof (obj as BatchProgress).totalTasks === 'number' &&
      typeof (obj as BatchProgress).nextBatchIndex === 'number'
    );
  }
}
