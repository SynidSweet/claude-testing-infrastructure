/**
 * Cache Performance Monitor MCP Tool
 * 
 * MCP tool for comprehensive cache performance monitoring, analytics, and optimization.
 * Provides dashboard data, performance metrics, warmup capabilities, and recommendations.
 * 
 * Implements TASK-2025-186: Add cache performance monitoring and optimization tools
 * 
 * @module mcp/tools/CachePerformanceMonitorTool
 */

import { z } from 'zod';
import { logger } from '../../utils/logger';
import { withCircuitBreaker } from '../services/MCPErrorHandler';
import type { MCPErrorResponse } from '../services/MCPErrorHandler';
import { MCPCachePerformanceMonitor, type CachePerformanceMetrics, type CacheRecommendation } from '../services/MCPCachePerformanceMonitor';
import { CacheLayer } from '../services/MCPCacheManager';
import { getMCPLogger, MCPToolStatus } from '../services/MCPLoggingService';
import type { MCPToolContext } from '../services/MCPLoggingService';

/**
 * Zod schema for cache performance monitoring parameters
 */
const CachePerformanceMonitorParamsSchema = z.object({
  action: z.enum(['dashboard', 'metrics', 'analytics', 'warmup', 'recommendations', 'alerts']),
  layer: z.nativeEnum(CacheLayer).optional(),
  config: z.object({
    layers: z.array(z.nativeEnum(CacheLayer)).optional(),
    batchSize: z.number().optional(),
    enabled: z.boolean().optional()
  }).optional(),
  alertConfig: z.array(z.object({
    metric: z.string(),
    threshold: z.number(),
    condition: z.enum(['above', 'below']),
    severity: z.enum(['warning', 'critical']),
    enabled: z.boolean()
  })).optional()
});

/**
 * Zod schema for cache performance monitoring response
 */
const CachePerformanceMonitorResponseSchema = z.object({
  success: z.boolean(),
  action: z.string(),
  data: z.any(),
  timestamp: z.number(),
  performance: z.object({
    duration: z.number(),
    cacheHit: z.boolean().optional()
  })
});

type CachePerformanceMonitorResponse = z.infer<typeof CachePerformanceMonitorResponseSchema>;

/**
 * Cache Performance Monitor MCP Tool
 * 
 * Provides comprehensive cache performance monitoring, analytics, and optimization capabilities
 */
export class CachePerformanceMonitorTool {
  public readonly name = 'mcp__claude-testing__cache_performance_monitor';
  public readonly description = 'Monitor cache performance, get analytics, execute warmup, and receive optimization recommendations';

  private performanceMonitor: MCPCachePerformanceMonitor;
  private mcpLogger = getMCPLogger();

  constructor() {
    this.performanceMonitor = MCPCachePerformanceMonitor.getInstance();
  }

  /**
   * Execute cache performance monitoring operation
   */
  public async execute(params: unknown): Promise<CachePerformanceMonitorResponse | MCPErrorResponse> {
    // Create logging context
    const context: MCPToolContext = {
      toolName: this.name,
      operation: 'execute',
      parameters: params as Record<string, unknown>,
      sessionId: this.generateSessionId(),
      traceId: this.generateTraceId()
    };

    // Start performance tracking
    const metrics = this.mcpLogger.logToolStart(context);

    return withCircuitBreaker('cache_performance_monitor', async () => {
      try {
        const startTime = Date.now();

        // Validate parameters
        const validatedParams = CachePerformanceMonitorParamsSchema.parse(params);
        
        let data: any;
        let cacheHit = false;

        // Execute action based on type
        switch (validatedParams.action) {
          case 'dashboard':
            data = await this.getDashboard();
            break;
            
          case 'metrics':
            data = await this.getMetrics(validatedParams.layer);
            break;
            
          case 'analytics':
            data = await this.getAnalytics();
            break;
            
          case 'warmup':
            data = await this.executeWarmup(validatedParams.config);
            break;
            
          case 'recommendations':
            data = await this.getRecommendations();
            break;
            
          case 'alerts':
            data = await this.configureAlerts(validatedParams.alertConfig);
            break;
            
          default:
            throw new Error(`Unknown action: ${validatedParams.action}`);
        }

        const duration = Date.now() - startTime;

        const response: CachePerformanceMonitorResponse = {
          success: true,
          action: validatedParams.action,
          data,
          timestamp: Date.now(),
          performance: {
            duration,
            cacheHit
          }
        };

        // Validate response
        const validatedResponse = CachePerformanceMonitorResponseSchema.parse(response);

        // Log successful completion
        metrics.cacheHit = cacheHit;
        this.mcpLogger.logToolComplete(context, metrics, MCPToolStatus.Success, validatedResponse);

        logger.info('CachePerformanceMonitorTool: Operation completed', {
          action: validatedParams.action,
          duration,
          dataSize: JSON.stringify(data).length
        });

        return validatedResponse;

      } catch (error) {
        // Log error
        this.mcpLogger.logToolError(context, metrics, error as Error);

        if (error instanceof z.ZodError) {
          const validationError: MCPErrorResponse = {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid parameters provided',
              category: 'VALIDATION' as any,
              severity: 'ERROR' as any,
              toolName: this.name,
              operation: 'execute',
              timestamp: new Date().toISOString(),
              context: {
                issues: error.issues.map(issue => ({
                  path: issue.path.join('.'),
                  message: issue.message,
                  code: issue.code
                }))
              }
            },
            metadata: {
              retryable: false
            }
          };

          logger.warn('CachePerformanceMonitorTool: Validation error', { error: validationError });
          return validationError;
        }

        logger.error('CachePerformanceMonitorTool: Execution error', {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        });

        throw error; // Re-throw for circuit breaker handling
      }
    });
  }

  /**
   * Get performance dashboard data
   */
  private async getDashboard(): Promise<any> {
    logger.debug('CachePerformanceMonitorTool: Getting performance dashboard');
    return this.performanceMonitor.getPerformanceDashboard();
  }

  /**
   * Get performance metrics for specific layer or all layers
   */
  private async getMetrics(layer?: CacheLayer): Promise<Record<CacheLayer, CachePerformanceMetrics> | CachePerformanceMetrics> {
    logger.debug('CachePerformanceMonitorTool: Getting performance metrics', { layer });
    
    const allMetrics = await this.performanceMonitor.getPerformanceMetrics();
    
    if (layer) {
      return allMetrics[layer];
    }
    
    return allMetrics;
  }

  /**
   * Get cache usage analytics
   */
  private async getAnalytics(): Promise<any> {
    logger.debug('CachePerformanceMonitorTool: Getting cache analytics');
    return this.performanceMonitor.getCacheAnalytics();
  }

  /**
   * Execute cache warmup
   */
  private async executeWarmup(config?: any): Promise<any> {
    logger.debug('CachePerformanceMonitorTool: Executing cache warmup', { config });
    
    const warmupConfig = config ? {
      layers: config.layers || undefined,
      batchSize: config.batchSize || undefined,
      enabled: config.enabled !== undefined ? config.enabled : undefined
    } : undefined;
    
    return this.performanceMonitor.executeCacheWarmup(warmupConfig);
  }

  /**
   * Get optimization recommendations
   */
  private async getRecommendations(): Promise<CacheRecommendation[]> {
    logger.debug('CachePerformanceMonitorTool: Getting optimization recommendations');
    return this.performanceMonitor.generateOptimizationRecommendations();
  }

  /**
   * Configure performance alerts
   */
  private async configureAlerts(alertConfig?: any[]): Promise<{ configured: number; active: number }> {
    if (!alertConfig) {
      return { configured: 0, active: 0 };
    }

    logger.debug('CachePerformanceMonitorTool: Configuring alerts', { 
      alertCount: alertConfig.length 
    });

    this.performanceMonitor.configureAlerts(alertConfig);
    
    const activeAlerts = alertConfig.filter(alert => alert.enabled).length;
    
    return {
      configured: alertConfig.length,
      active: activeAlerts
    };
  }

  /**
   * Generate session ID for logging
   */
  private generateSessionId(): string {
    return `cache_perf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate trace ID for logging
   */
  private generateTraceId(): string {
    return `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export default CachePerformanceMonitorTool;