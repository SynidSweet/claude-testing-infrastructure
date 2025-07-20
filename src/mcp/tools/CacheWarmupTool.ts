/**
 * Cache Warmup MCP Tool
 * 
 * Specialized MCP tool for cache warming strategies and optimization.
 * Provides fine-grained control over cache warmup operations with progress tracking.
 * 
 * Implements TASK-2025-186: Add cache performance monitoring and optimization tools
 * 
 * @module mcp/tools/CacheWarmupTool
 */

import { z } from 'zod';
import { logger } from '../../utils/logger';
import { withCircuitBreaker } from '../services/MCPErrorHandler';
import type { MCPErrorResponse } from '../services/MCPErrorHandler';
import { MCPCachePerformanceMonitor, type CacheWarmupConfig } from '../services/MCPCachePerformanceMonitor';
import { CacheLayer } from '../services/MCPCacheManager';
import { getMCPLogger, MCPToolStatus } from '../services/MCPLoggingService';
import type { MCPToolContext } from '../services/MCPLoggingService';

/**
 * Zod schema for cache warmup parameters
 */
const CacheWarmupParamsSchema = z.object({
  strategy: z.enum(['auto', 'custom', 'progressive', 'targeted']).default('auto'),
  layers: z.array(z.nativeEnum(CacheLayer)).optional(),
  operations: z.array(z.object({
    layer: z.nativeEnum(CacheLayer),
    keys: z.array(z.string()),
    priority: z.enum(['high', 'medium', 'low']).default('medium'),
    dataType: z.enum(['analysis', 'template', 'config', 'coverage', 'dependency']).optional()
  })).optional(),
  config: z.object({
    batchSize: z.number().min(1).max(50).default(5),
    enabled: z.boolean().default(true),
    scheduleInterval: z.number().optional(),
    maxConcurrency: z.number().min(1).max(10).default(3),
    timeout: z.number().min(1000).default(30000)
  }).optional(),
  progressTracking: z.boolean().default(true),
  dryRun: z.boolean().default(false)
});

/**
 * Zod schema for cache warmup response
 */
const CacheWarmupResponseSchema = z.object({
  success: z.boolean(),
  strategy: z.string(),
  results: z.object({
    warmedKeys: z.number(),
    duration: z.number(),
    errors: z.array(z.string()),
    layerResults: z.record(z.object({
      keys: z.number(),
      success: z.boolean(),
      duration: z.number(),
      errors: z.array(z.string())
    }))
  }),
  performance: z.object({
    averageKeyTime: z.number(),
    throughput: z.number(),
    successRate: z.number()
  }),
  recommendations: z.array(z.object({
    type: z.string(),
    message: z.string(),
    priority: z.enum(['high', 'medium', 'low'])
  })),
  timestamp: z.number()
});

type CacheWarmupParams = z.infer<typeof CacheWarmupParamsSchema>;
type CacheWarmupResponse = z.infer<typeof CacheWarmupResponseSchema>;

/**
 * Cache Warmup MCP Tool
 * 
 * Provides specialized cache warming capabilities with progress tracking and optimization
 */
export class CacheWarmupTool {
  public readonly name = 'mcp__claude-testing__cache_warmup';
  public readonly description = 'Execute intelligent cache warmup strategies with progress tracking and optimization';

  private performanceMonitor: MCPCachePerformanceMonitor;
  private mcpLogger = getMCPLogger();

  constructor() {
    this.performanceMonitor = MCPCachePerformanceMonitor.getInstance();
  }

  /**
   * Execute cache warmup operation
   */
  public async execute(params: unknown): Promise<CacheWarmupResponse | MCPErrorResponse> {
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

    return withCircuitBreaker('cache_warmup', async () => {
      try {
        const startTime = Date.now();

        // Validate parameters
        const validatedParams = CacheWarmupParamsSchema.parse(params);
        
        logger.info('CacheWarmupTool: Starting cache warmup', {
          strategy: validatedParams.strategy,
          layers: validatedParams.layers,
          dryRun: validatedParams.dryRun
        });

        // Execute warmup based on strategy
        const results = await this.executeWarmupStrategy(validatedParams);
        
        const duration = Date.now() - startTime;

        // Calculate performance metrics
        const performance = this.calculatePerformanceMetrics(results, duration);
        
        // Generate recommendations
        const recommendations = this.generateWarmupRecommendations(results, validatedParams);

        const response: CacheWarmupResponse = {
          success: results.errors.length === 0,
          strategy: validatedParams.strategy,
          results,
          performance,
          recommendations,
          timestamp: Date.now()
        };

        // Validate response
        const validatedResponse = CacheWarmupResponseSchema.parse(response);

        // Log successful completion
        metrics.cacheHit = false; // Warmup operations don't use cache
        this.mcpLogger.logToolComplete(context, metrics, MCPToolStatus.Success, validatedResponse);

        logger.info('CacheWarmupTool: Warmup completed', {
          strategy: validatedParams.strategy,
          warmedKeys: results.warmedKeys,
          duration,
          successRate: performance.successRate
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
              message: 'Invalid warmup parameters provided',
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

          logger.warn('CacheWarmupTool: Validation error', { error: validationError });
          return validationError;
        }

        logger.error('CacheWarmupTool: Execution error', {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        });

        throw error; // Re-throw for circuit breaker handling
      }
    });
  }

  /**
   * Execute warmup strategy
   */
  private async executeWarmupStrategy(params: CacheWarmupParams): Promise<{
    warmedKeys: number;
    duration: number;
    errors: string[];
    layerResults: Record<string, any>;
  }> {
    if (params.dryRun) {
      return this.simulateWarmup(params);
    }

    switch (params.strategy) {
      case 'auto':
        return this.executeAutoWarmup(params);
        
      case 'custom':
        return this.executeCustomWarmup(params);
        
      case 'progressive':
        return this.executeProgressiveWarmup(params);
        
      case 'targeted':
        return this.executeTargetedWarmup(params);
        
      default:
        throw new Error(`Unknown warmup strategy: ${params.strategy}`);
    }
  }

  /**
   * Execute automatic warmup strategy
   */
  private async executeAutoWarmup(params: CacheWarmupParams): Promise<any> {
    logger.debug('CacheWarmupTool: Executing auto warmup strategy');
    
    // Use the default warmup configuration from performance monitor
    const warmupConfig: Partial<CacheWarmupConfig> = {
      ...(params.layers && { layers: params.layers }),
      ...(params.config?.batchSize && { batchSize: params.config.batchSize }),
      ...(params.config?.enabled !== undefined && { enabled: params.config.enabled })
    };

    return this.performanceMonitor.executeCacheWarmup(warmupConfig);
  }

  /**
   * Execute custom warmup strategy
   */
  private async executeCustomWarmup(params: CacheWarmupParams): Promise<any> {
    logger.debug('CacheWarmupTool: Executing custom warmup strategy');
    
    if (!params.operations || params.operations.length === 0) {
      throw new Error('Custom warmup strategy requires operations to be specified');
    }

    const startTime = Date.now();
    let totalWarmedKeys = 0;
    const errors: string[] = [];
    const layerResults: Record<string, any> = {};

    // Execute custom operations
    for (const operation of params.operations) {
      const layerStartTime = Date.now();
      const layerErrors: string[] = [];
      
      try {
        // Create warmup configuration for this operation
        const customConfig: Partial<CacheWarmupConfig> = {
          layers: [operation.layer],
          commonOperations: [{
            layer: operation.layer,
            keys: operation.keys,
            priority: operation.priority,
            dataGenerator: async () => this.generateDataForType(operation.dataType || 'analysis')
          }],
          batchSize: params.config?.batchSize || 5,
          enabled: true
        };

        const result = await this.performanceMonitor.executeCacheWarmup(customConfig);
        totalWarmedKeys += result.warmedKeys;
        layerErrors.push(...result.errors);

        layerResults[operation.layer] = {
          keys: result.warmedKeys,
          success: result.success,
          duration: Date.now() - layerStartTime,
          errors: layerErrors
        };

      } catch (error) {
        const errorMessage = `Custom warmup failed for layer ${operation.layer}: ${error instanceof Error ? error.message : String(error)}`;
        errors.push(errorMessage);
        layerErrors.push(errorMessage);

        layerResults[operation.layer] = {
          keys: 0,
          success: false,
          duration: Date.now() - layerStartTime,
          errors: layerErrors
        };
      }
    }

    return {
      warmedKeys: totalWarmedKeys,
      duration: Date.now() - startTime,
      errors,
      layerResults
    };
  }

  /**
   * Execute progressive warmup strategy
   */
  private async executeProgressiveWarmup(params: CacheWarmupParams): Promise<any> {
    logger.debug('CacheWarmupTool: Executing progressive warmup strategy');
    
    // Progressive warmup: start with high-priority layers and operations
    const layers = params.layers || [
      CacheLayer.Configuration,      // Fastest to warm
      CacheLayer.TemplateCompilation, // Most commonly used
      CacheLayer.ProjectAnalysis,    // Largest impact
      CacheLayer.Coverage,
      CacheLayer.Dependencies,
      CacheLayer.TestGeneration,
      CacheLayer.TestExecution
    ];

    const startTime = Date.now();
    let totalWarmedKeys = 0;
    const errors: string[] = [];
    const layerResults: Record<string, any> = {};

    // Warm layers progressively
    for (const layer of layers) {
      const layerStartTime = Date.now();
      
      try {
        const layerConfig: Partial<CacheWarmupConfig> = {
          layers: [layer],
          batchSize: Math.max(1, (params.config?.batchSize || 5) / layers.length), // Smaller batches for progressive
          enabled: true
        };

        const result = await this.performanceMonitor.executeCacheWarmup(layerConfig);
        totalWarmedKeys += result.warmedKeys;

        layerResults[layer] = {
          keys: result.warmedKeys,
          success: result.success,
          duration: Date.now() - layerStartTime,
          errors: result.errors
        };

        // Add any layer-specific errors to global errors
        errors.push(...result.errors);

      } catch (error) {
        const errorMessage = `Progressive warmup failed for layer ${layer}: ${error instanceof Error ? error.message : String(error)}`;
        errors.push(errorMessage);

        layerResults[layer] = {
          keys: 0,
          success: false,
          duration: Date.now() - layerStartTime,
          errors: [errorMessage]
        };
      }
    }

    return {
      warmedKeys: totalWarmedKeys,
      duration: Date.now() - startTime,
      errors,
      layerResults
    };
  }

  /**
   * Execute targeted warmup strategy
   */
  private async executeTargetedWarmup(params: CacheWarmupParams): Promise<any> {
    logger.debug('CacheWarmupTool: Executing targeted warmup strategy');
    
    // Targeted warmup: focus on specific high-impact cache entries
    const targetOperations = params.operations || this.getHighImpactOperations();
    
    return this.executeCustomWarmup({
      ...params,
      strategy: 'custom',
      operations: targetOperations
    });
  }

  /**
   * Simulate warmup for dry run
   */
  private async simulateWarmup(params: CacheWarmupParams): Promise<any> {
    logger.debug('CacheWarmupTool: Simulating warmup (dry run)');
    
    const simulatedResults = {
      warmedKeys: params.operations?.reduce((sum, op) => sum + op.keys.length, 0) || 50,
      duration: 2000, // Simulated 2 seconds
      errors: [],
      layerResults: {}
    };

    // Simulate layer results
    const layers = params.layers || Object.values(CacheLayer);
    for (const layer of layers) {
      (simulatedResults.layerResults as any)[layer as string] = {
        keys: 10,
        success: true,
        duration: 500,
        errors: []
      };
    }

    return simulatedResults;
  }

  /**
   * Get high-impact operations for targeted warmup
   */
  private getHighImpactOperations(): any[] {
    return [
      {
        layer: CacheLayer.ProjectAnalysis,
        keys: ['./src', './tests'],
        priority: 'high' as const,
        dataType: 'analysis' as const
      },
      {
        layer: CacheLayer.TemplateCompilation,
        keys: ['javascript-unit', 'typescript-unit', 'react-component'],
        priority: 'high' as const,
        dataType: 'template' as const
      },
      {
        layer: CacheLayer.Configuration,
        keys: ['default', 'jest', 'typescript'],
        priority: 'medium' as const,
        dataType: 'config' as const
      }
    ];
  }

  /**
   * Generate appropriate data for cache type
   */
  private async generateDataForType(dataType: string): Promise<any> {
    switch (dataType) {
      case 'analysis':
        return {
          projectPath: 'warmup',
          languages: ['javascript', 'typescript'],
          frameworks: ['jest'],
          complexity: 'medium',
          testability: 0.8
        };
        
      case 'template':
        return {
          template: 'compiled-template',
          language: 'javascript',
          framework: 'jest',
          cached: true
        };
        
      case 'config':
        return {
          config: 'default-config',
          validated: true,
          source: 'warmup'
        };
        
      case 'coverage':
        return {
          coverage: {
            lines: 80,
            branches: 75,
            functions: 85
          },
          source: 'warmup'
        };
        
      case 'dependency':
        return {
          dependencies: ['jest', 'typescript'],
          devDependencies: ['@types/jest'],
          source: 'warmup'
        };
        
      default:
        return { warmup: true, type: dataType };
    }
  }

  /**
   * Calculate performance metrics
   */
  private calculatePerformanceMetrics(results: any, duration: number): {
    averageKeyTime: number;
    throughput: number;
    successRate: number;
  } {
    const averageKeyTime = results.warmedKeys > 0 ? duration / results.warmedKeys : 0;
    const throughput = results.warmedKeys / (duration / 1000); // keys per second
    
    // Calculate success rate based on errors
    const totalOperations = results.warmedKeys + results.errors.length;
    const successRate = totalOperations > 0 ? results.warmedKeys / totalOperations : 1;

    return {
      averageKeyTime: Math.round(averageKeyTime * 100) / 100,
      throughput: Math.round(throughput * 100) / 100,
      successRate: Math.round(successRate * 100) / 100
    };
  }

  /**
   * Generate warmup recommendations
   */
  private generateWarmupRecommendations(results: any, params: CacheWarmupParams): Array<{
    type: string;
    message: string;
    priority: 'high' | 'medium' | 'low';
  }> {
    const recommendations: Array<{
      type: string;
      message: string;
      priority: 'high' | 'medium' | 'low';
    }> = [];

    // Performance recommendations
    if (results.duration > 10000) {
      recommendations.push({
        type: 'performance',
        message: 'Warmup took longer than expected. Consider reducing batch size or using progressive strategy.',
        priority: 'medium'
      });
    }

    // Error recommendations
    if (results.errors.length > 0) {
      recommendations.push({
        type: 'reliability',
        message: `${results.errors.length} errors occurred during warmup. Review error details and consider adjusting strategy.`,
        priority: 'high'
      });
    }

    // Success rate recommendations
    const totalOperations = results.warmedKeys + results.errors.length;
    const successRate = totalOperations > 0 ? results.warmedKeys / totalOperations : 1;
    
    if (successRate < 0.9) {
      recommendations.push({
        type: 'reliability',
        message: `Warmup success rate is ${(successRate * 100).toFixed(1)}%. Consider investigating failure causes.`,
        priority: 'high'
      });
    }

    // Strategy recommendations
    if (params.strategy === 'auto' && results.warmedKeys > 100) {
      recommendations.push({
        type: 'optimization',
        message: 'Consider using progressive or targeted strategy for better control over large warmup operations.',
        priority: 'low'
      });
    }

    return recommendations;
  }

  /**
   * Generate session ID for logging
   */
  private generateSessionId(): string {
    return `warmup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate trace ID for logging
   */
  private generateTraceId(): string {
    return `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export default CacheWarmupTool;