import { promises as fs } from 'fs';
import * as path from 'path';
import type { AITask } from '../AITaskPreparation';
import type { ChunkedAITask } from '../ChunkedAITaskPreparation';
import { AITaskResult } from '../AITaskPreparation';
import { AIError } from '../../types/ai-error-types';
import { ProcessResourceUsage } from '../../utils/ProcessMonitor';
import { logger } from '../../utils/logger';

/**
 * Interface for result aggregation and statistics
 */
export interface ProcessResult {
  taskId: string;
  success: boolean;
  result?: AITaskResult;
  error?: AIError;
}

/**
 * Statistics tracking for orchestrator execution
 */
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

/**
 * Reliability status data
 */
export interface ReliabilityStatus {
  isHealthy: boolean;
  isDegraded: boolean;
  circuitBreakerState: string | undefined;
  failureRate: number;
  successRate: number;
}

/**
 * Process monitoring status
 */
export interface ProcessMonitoringStatus {
  activeProcesses: number[];
  totalHistory: number;
  zombieProcesses: ProcessResourceUsage[];
}

/**
 * Retry statistics data
 */
export interface RetryStatistics {
  failurePatterns: Map<string, { count: number; lastSeen: string; suggestion: string }>;
  taskMetrics: { complexity: string; count: number; avgSuccessTime: number }[];
  totalTasksWithMetrics: number;
}

/**
 * Result aggregation configuration
 */
export interface ResultAggregatorConfig {
  enableFileOutput?: boolean;
  outputDirectory?: string;
  mergeChunkedResults?: boolean;
}

/**
 * Service responsible for aggregating task results, managing statistics,
 * and handling file I/O operations for test generation
 */
export class ResultAggregator {
  private results: ProcessResult[] = [];
  private stats: OrchestratorStats;
  private config: ResultAggregatorConfig;

  constructor(config: ResultAggregatorConfig = {}) {
    this.config = {
      enableFileOutput: true,
      mergeChunkedResults: true,
      ...config,
    };
    this.stats = this.resetStats();
  }

  /**
   * Add a successful task result
   */
  addSuccessResult(taskId: string, result: AITaskResult): void {
    const processResult: ProcessResult = {
      taskId,
      success: true,
      result,
    };

    this.results.push(processResult);
    this.stats.completedTasks++;
    this.stats.totalTokensUsed += result.tokensUsed;
    this.stats.totalCost += result.actualCost;
    this.stats.totalDuration += result.duration;
  }

  /**
   * Add a failed task result
   */
  addFailureResult(taskId: string, error: AIError): void {
    const processResult: ProcessResult = {
      taskId,
      success: false,
      error,
    };

    this.results.push(processResult);
    this.stats.failedTasks++;
  }

  /**
   * Save generated tests to file system
   */
  async saveGeneratedTests(task: AITask, tests: string): Promise<void> {
    if (!this.config.enableFileOutput) {
      return;
    }

    // Skip file operations in test environment
    if (process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID) {
      return;
    }

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
   * Merge results from chunked tasks
   */
  async mergeChunkedResults(tasks: ChunkedAITask[]): Promise<void> {
    if (!this.config.mergeChunkedResults) {
      return;
    }

    logger.info('Merging chunked results...');

    // Get successful results
    const successfulResults = new Map<string, string>();
    this.results.forEach((result) => {
      if (result.success && result.result?.generatedTests) {
        successfulResults.set(result.taskId, result.result.generatedTests);
      }
    });

    // Merge chunked results
    const mergedResults = this.performChunkedResultsMerge(tasks, successfulResults);

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
   * Generate comprehensive execution report
   */
  generateReport(
    isGracefullyDegraded: boolean,
    processMonitoringStatus: ProcessMonitoringStatus,
    retryStats: RetryStatistics,
    config: {
      model: string;
      fallbackModel?: string;
      maxConcurrent: number;
      retryAttempts: number;
      exponentialBackoff: boolean;
      gracefulDegradation: boolean;
    }
  ): string {
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

    const reliabilityStatus = this.calculateReliabilityStatus(isGracefullyDegraded);

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
      `- Model: ${config.model}`,
      `- Fallback Model: ${config.fallbackModel ?? 'None'}`,
      `- Max Concurrent: ${config.maxConcurrent}`,
      `- Retry Attempts: ${config.retryAttempts}`,
      `- Exponential Backoff: ${config.exponentialBackoff ? 'Enabled' : 'Disabled'}`,
      `- Graceful Degradation: ${config.gracefulDegradation ? 'Enabled' : 'Disabled'}`,
      `- Intelligent Retry: Enabled (Adaptive timeout, Context-aware decisions, Pattern learning)`,
      '',
    ];

    if (this.stats.failedTasks > 0) {
      report.push('## Failed Tasks');
      const failedResults = this.results.filter((r) => !r.success);
      failedResults.forEach((result) => {
        report.push(`- Task ${result.taskId}: ${result.error?.message ?? 'Unknown error'}`);
      });
    }

    return report.join('\n');
  }

  /**
   * Calculate reliability status based on current statistics
   */
  calculateReliabilityStatus(
    isGracefullyDegraded: boolean,
    circuitBreakerState?: string
  ): ReliabilityStatus {
    const totalAttempts = this.stats.completedTasks + this.stats.failedTasks;
    const successRate = totalAttempts > 0 ? this.stats.completedTasks / totalAttempts : 0;
    const failureRate = totalAttempts > 0 ? this.stats.failedTasks / totalAttempts : 0;

    return {
      isHealthy: !isGracefullyDegraded && successRate >= 0.8,
      isDegraded: isGracefullyDegraded,
      circuitBreakerState,
      failureRate,
      successRate,
    };
  }

  /**
   * Get current statistics
   */
  getStats(): OrchestratorStats {
    return { ...this.stats };
  }

  /**
   * Get all results
   */
  getResults(): ProcessResult[] {
    return [...this.results];
  }

  /**
   * Get failed results only
   */
  getFailedResults(): ProcessResult[] {
    return this.results.filter((r) => !r.success);
  }

  /**
   * Get successful results only
   */
  getSuccessfulResults(): ProcessResult[] {
    return this.results.filter((r) => r.success);
  }

  /**
   * Initialize statistics for new execution
   */
  initializeStats(totalTasks: number): void {
    this.stats = this.resetStats();
    this.stats.totalTasks = totalTasks;
  }

  /**
   * Mark execution as complete
   */
  markExecutionComplete(): void {
    this.stats.endTime = new Date();
  }

  /**
   * Clear all results and reset statistics
   */
  clear(): void {
    this.results = [];
    this.stats = this.resetStats();
  }

  /**
   * Reset statistics to initial state
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
   * Perform the actual merging of chunked results
   */
  private performChunkedResultsMerge(
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
}
