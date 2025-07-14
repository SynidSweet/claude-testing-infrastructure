/**
 * Statistics Service
 *
 * Handles statistics collection and reporting:
 * - Process monitoring statistics
 * - Retry pattern analysis
 * - Task metrics aggregation
 * - Execution report generation
 */

import type { ProcessPoolManager } from './ProcessPoolManager';
import type { TaskQueueManager } from './TaskQueueManager';
import type { ResultAggregator, OrchestratorStats } from './ResultAggregator';
import type { FailurePatternDetector } from '../../utils/retry-helper';
import type { ProcessResourceUsage } from '../../utils/ProcessMonitor';
import type { ClaudeOrchestratorConfig } from '../ClaudeOrchestrator';

/**
 * Process monitoring status interface
 */
export interface ProcessMonitoringStatus {
  activeProcesses: number[];
  totalHistory: number;
  zombieProcesses: ProcessResourceUsage[];
}

/**
 * Retry statistics interface
 */
export interface RetryStatistics {
  failurePatterns: Map<string, { count: number; lastSeen: string; suggestion: string }>;
  taskMetrics: { complexity: string; count: number; avgSuccessTime: number }[];
  totalTasksWithMetrics: number;
}

/**
 * Reliability status interface
 */
export interface ReliabilityStatus {
  isHealthy: boolean;
  isDegraded: boolean;
  circuitBreakerState: string | undefined;
  failureRate: number;
  successRate: number;
}

/**
 * Service responsible for collecting, aggregating, and reporting statistics
 * for the ClaudeOrchestrator execution
 */
export class StatisticsService {
  constructor(
    private processPoolManager: ProcessPoolManager,
    private taskQueueManager: TaskQueueManager,
    private resultAggregator: ResultAggregator,
    private failurePatternDetector: FailurePatternDetector
  ) {}

  /**
   * Get system-wide zombie processes
   */
  getZombieProcesses(): ProcessResourceUsage[] {
    // ProcessPoolManager handles zombie detection internally
    return [];
  }

  /**
   * Get process monitoring status
   */
  getProcessMonitoringStatus(): ProcessMonitoringStatus {
    const activeTaskIds = this.processPoolManager.getActiveTaskIds();
    const activeProcesses = activeTaskIds
      .map((taskId) => this.processPoolManager.getProcessInfo(taskId)?.process.pid)
      .filter((pid) => pid !== undefined) as number[];

    const zombies = this.getZombieProcesses();

    return {
      activeProcesses,
      totalHistory: activeTaskIds.length,
      zombieProcesses: zombies,
    };
  }

  /**
   * Get intelligent retry statistics
   */
  getRetryStatistics(): RetryStatistics {
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

    // Get task metrics from TaskQueueManager
    const taskMetricsMap = this.taskQueueManager.getTaskMetrics();

    // Aggregate task metrics by complexity
    const complexityGroups = new Map<string, { times: number[]; count: number }>();

    for (const metric of taskMetricsMap.values()) {
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
      totalTasksWithMetrics: taskMetricsMap.size,
    };
  }

  /**
   * Get reliability status
   */
  getReliabilityStatus(
    isGracefullyDegraded: boolean,
    circuitBreakerState?: string
  ): ReliabilityStatus {
    return this.resultAggregator.calculateReliabilityStatus(
      isGracefullyDegraded,
      circuitBreakerState
    );
  }

  /**
   * Generate execution report
   */
  generateReport(config: ClaudeOrchestratorConfig, isGracefullyDegraded: boolean): string {
    const processMonitoringStatus = this.getProcessMonitoringStatus();
    const retryStats = this.getRetryStatistics();

    const configForReport = {
      model: config.model!,
      maxConcurrent: config.maxConcurrent!,
      retryAttempts: config.retryAttempts!,
      exponentialBackoff: config.exponentialBackoff!,
      gracefulDegradation: config.gracefulDegradation!,
      ...(config.fallbackModel && { fallbackModel: config.fallbackModel }),
    };

    return this.resultAggregator.generateReport(
      isGracefullyDegraded,
      processMonitoringStatus,
      retryStats,
      configForReport
    );
  }

  /**
   * Get current statistics
   */
  getStats(): OrchestratorStats {
    return this.resultAggregator.getStats();
  }
}
