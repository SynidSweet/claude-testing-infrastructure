/**
 * MCP Logging Service
 *
 * Unified logging service for MCP tool execution tracking and monitoring.
 * Provides centralized logging for all MCP operations with performance metrics,
 * tool-specific contexts, and error aggregation.
 *
 * Implements TASK-2025-176: Create MCPLoggingService for unified tool monitoring
 *
 * @module mcp/services/MCPLoggingService
 */

import { logger, createModuleLogger } from '../../utils/logger';
import type { Logger } from 'winston';

/**
 * MCP tool execution result status
 */
export enum MCPToolStatus {
  Success = 'success',
  Failure = 'failure',
  Partial = 'partial',
  Cached = 'cached',
  Degraded = 'degraded',
}

/**
 * MCP tool execution context
 */
export interface MCPToolContext {
  toolName: string;
  operation?: string;
  parameters?: Record<string, unknown>;
  userId?: string;
  sessionId?: string;
  traceId?: string;
}

/**
 * MCP tool execution metrics
 */
export interface MCPToolMetrics {
  startTime: number;
  endTime?: number;
  duration?: number;
  memoryUsage?: number;
  cacheHit?: boolean;
  retryCount?: number;
  errorCount?: number;
}

/**
 * MCP tool execution result
 */
export interface MCPToolExecutionResult {
  status: MCPToolStatus;
  context: MCPToolContext;
  metrics: MCPToolMetrics;
  result?: unknown;
  error?: Error;
  warnings?: string[];
}

/**
 * Aggregated metrics for reporting
 */
export interface AggregatedMetrics {
  toolName: string;
  totalExecutions: number;
  successCount: number;
  failureCount: number;
  avgDuration: number;
  cacheHitRate: number;
  errorRate: number;
  warnings: string[];
}

/**
 * MCP Logging Service for unified tool monitoring
 */
export class MCPLoggingService {
  private static instance: MCPLoggingService;
  private toolLoggers: Map<string, Logger> = new Map();
  private executionHistory: MCPToolExecutionResult[] = [];
  private metricsMap: Map<string, AggregatedMetrics> = new Map();

  // Configuration
  private readonly maxHistorySize = 10000;
  private readonly metricsAggregationInterval = 60000; // 1 minute
  private metricsTimer?: NodeJS.Timer;

  private constructor() {
    // Start metrics aggregation
    this.startMetricsAggregation();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): MCPLoggingService {
    if (!MCPLoggingService.instance) {
      MCPLoggingService.instance = new MCPLoggingService();
    }
    return MCPLoggingService.instance;
  }

  /**
   * Get or create logger for a specific tool
   */
  private getToolLogger(toolName: string): Logger {
    if (!this.toolLoggers.has(toolName)) {
      const toolLogger = createModuleLogger(`mcp:${toolName}`);
      this.toolLoggers.set(toolName, toolLogger);
    }
    return this.toolLoggers.get(toolName)!;
  }

  /**
   * Log tool execution start
   */
  public logToolStart(context: MCPToolContext): MCPToolMetrics {
    const toolLogger = this.getToolLogger(context.toolName);
    const metrics: MCPToolMetrics = {
      startTime: Date.now(),
    };

    toolLogger.info('Tool execution started', {
      operation: context.operation,
      parameters: context.parameters,
      sessionId: context.sessionId,
      traceId: context.traceId,
    });

    return metrics;
  }

  /**
   * Log tool execution completion
   */
  public logToolComplete(
    context: MCPToolContext,
    metrics: MCPToolMetrics,
    status: MCPToolStatus = MCPToolStatus.Success,
    result?: unknown
  ): void {
    const toolLogger = this.getToolLogger(context.toolName);
    metrics.endTime = Date.now();
    metrics.duration = metrics.endTime - metrics.startTime;

    const executionResult: MCPToolExecutionResult = {
      status,
      context,
      metrics,
      result,
    };

    // Log completion
    toolLogger.info('Tool execution completed', {
      operation: context.operation,
      status,
      duration: `${metrics.duration}ms`,
      cacheHit: metrics.cacheHit,
      retryCount: metrics.retryCount,
      sessionId: context.sessionId,
      traceId: context.traceId,
    });

    // Store execution history
    this.addToHistory(executionResult);

    // Update metrics
    this.updateMetrics(executionResult);
  }

  /**
   * Log tool execution error
   */
  public logToolError(context: MCPToolContext, metrics: MCPToolMetrics, error: Error): void {
    const toolLogger = this.getToolLogger(context.toolName);
    metrics.endTime = Date.now();
    metrics.duration = metrics.endTime - metrics.startTime;
    metrics.errorCount = (metrics.errorCount ?? 0) + 1;

    const executionResult: MCPToolExecutionResult = {
      status: MCPToolStatus.Failure,
      context,
      metrics,
      error,
    };

    // Log error
    toolLogger.error('Tool execution failed', {
      operation: context.operation,
      error: error.message,
      stack: error.stack,
      duration: `${metrics.duration}ms`,
      retryCount: metrics.retryCount,
      sessionId: context.sessionId,
      traceId: context.traceId,
    });

    // Store execution history
    this.addToHistory(executionResult);

    // Update metrics
    this.updateMetrics(executionResult);
  }

  /**
   * Log tool warning
   */
  public logToolWarning(
    context: MCPToolContext,
    message: string,
    details?: Record<string, unknown>
  ): void {
    const toolLogger = this.getToolLogger(context.toolName);

    toolLogger.warn(message, {
      operation: context.operation,
      sessionId: context.sessionId,
      traceId: context.traceId,
      ...details,
    });
  }

  /**
   * Get execution metrics for a specific tool
   */
  public getToolMetrics(toolName: string): AggregatedMetrics | undefined {
    return this.metricsMap.get(toolName);
  }

  /**
   * Get all tool metrics
   */
  public getAllMetrics(): AggregatedMetrics[] {
    return Array.from(this.metricsMap.values());
  }

  /**
   * Get recent execution history
   */
  public getExecutionHistory(toolName?: string, limit: number = 100): MCPToolExecutionResult[] {
    let history = this.executionHistory;

    if (toolName) {
      history = history.filter((result) => result.context.toolName === toolName);
    }

    return history.slice(-limit);
  }

  /**
   * Add execution result to history
   */
  private addToHistory(result: MCPToolExecutionResult): void {
    this.executionHistory.push(result);

    // Trim history if it exceeds max size
    if (this.executionHistory.length > this.maxHistorySize) {
      this.executionHistory = this.executionHistory.slice(-this.maxHistorySize);
    }
  }

  /**
   * Update aggregated metrics
   */
  private updateMetrics(result: MCPToolExecutionResult): void {
    const toolName = result.context.toolName;
    const existing = this.metricsMap.get(toolName) ?? {
      toolName,
      totalExecutions: 0,
      successCount: 0,
      failureCount: 0,
      avgDuration: 0,
      cacheHitRate: 0,
      errorRate: 0,
      warnings: [],
    };

    // Update counts
    existing.totalExecutions++;
    if (result.status === MCPToolStatus.Success || result.status === MCPToolStatus.Cached) {
      existing.successCount++;
    } else if (result.status === MCPToolStatus.Failure) {
      existing.failureCount++;
    }

    // Update average duration
    if (result.metrics.duration) {
      existing.avgDuration =
        (existing.avgDuration * (existing.totalExecutions - 1) + result.metrics.duration) /
        existing.totalExecutions;
    }

    // Update cache hit rate
    const cacheHits = this.executionHistory.filter(
      (r) => r.context.toolName === toolName && r.metrics.cacheHit
    ).length;
    existing.cacheHitRate = cacheHits / existing.totalExecutions;

    // Update error rate
    existing.errorRate = existing.failureCount / existing.totalExecutions;

    // Store warnings if any
    if (result.warnings) {
      existing.warnings.push(...result.warnings);
    }

    this.metricsMap.set(toolName, existing);
  }

  /**
   * Start periodic metrics aggregation
   */
  private startMetricsAggregation(): void {
    this.metricsTimer = setInterval(() => {
      this.logAggregatedMetrics();
    }, this.metricsAggregationInterval);
  }

  /**
   * Log aggregated metrics
   */
  private logAggregatedMetrics(): void {
    const metrics = this.getAllMetrics();

    metrics.forEach((metric) => {
      logger.info('MCP Tool Metrics Summary', {
        tool: metric.toolName,
        executions: metric.totalExecutions,
        successRate: `${((metric.successCount / metric.totalExecutions) * 100).toFixed(2)}%`,
        avgDuration: `${metric.avgDuration.toFixed(2)}ms`,
        cacheHitRate: `${(metric.cacheHitRate * 100).toFixed(2)}%`,
        errorRate: `${(metric.errorRate * 100).toFixed(2)}%`,
      });
    });
  }

  /**
   * Clean up resources
   */
  public destroy(): void {
    if (this.metricsTimer) {
      clearInterval(this.metricsTimer);
    }
    this.toolLoggers.clear();
    this.executionHistory = [];
    this.metricsMap.clear();
  }

  /**
   * Reset instance for testing
   */
  public static resetInstance(): void {
    if (MCPLoggingService.instance) {
      MCPLoggingService.instance.destroy();
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      MCPLoggingService.instance = undefined as any;
    }
  }
}

/**
 * Convenience function to get the singleton instance
 */
export const getMCPLogger = (): MCPLoggingService => {
  return MCPLoggingService.getInstance();
};
