/**
 * Resilient Service Adapter
 *
 * Enhanced service adapter with fallback strategies, retry logic, and
 * graceful degradation patterns. Extends BaseMCPServiceAdapter to provide
 * additional resilience features for critical MCP services.
 *
 * Implements TASK-2025-205: Create service adapter foundation classes
 *
 * @module mcp/adapters/ResilientServiceAdapter
 */

import { BaseMCPServiceAdapter } from './BaseMCPServiceAdapter';
import { MCPErrorCategory } from '../services/MCPErrorHandler';
import type { MCPToolContext } from '../services/MCPLoggingService';
import { MCPToolError, MCPToolErrorType } from '../../types/mcp-tool-types';
import { logger } from '../../utils/logger';

/**
 * Fallback strategies for service resilience
 */
export enum FallbackStrategy {
  /** Return cached data if available */
  Cache = 'cache',

  /** Execute simplified version of the operation */
  Simplified = 'simplified',

  /** Return partial results */
  Partial = 'partial',

  /** Return default/empty results */
  Default = 'default',

  /** Fail immediately with error */
  Fail = 'fail',
}

/**
 * Service fallback configuration
 */
export interface ServiceFallbackConfig {
  /** Whether to enable fallback mechanisms */
  enableFallback: boolean;

  /** Primary fallback strategy */
  fallbackStrategy: FallbackStrategy;

  /** Maximum number of retries before fallback */
  maxRetries: number;

  /** Delay between retries in milliseconds */
  retryDelay: number;

  /** Exponential backoff multiplier */
  backoffMultiplier: number;

  /** Maximum retry delay in milliseconds */
  maxRetryDelay: number;

  /** Timeout for individual operations in milliseconds */
  operationTimeout: number;
}

/**
 * Default fallback configuration
 */
const DEFAULT_FALLBACK_CONFIG: ServiceFallbackConfig = {
  enableFallback: true,
  fallbackStrategy: FallbackStrategy.Cache,
  maxRetries: 3,
  retryDelay: 1000,
  backoffMultiplier: 2,
  maxRetryDelay: 10000,
  operationTimeout: 30000,
};

/**
 * Resilient service adapter with enhanced error handling and fallback support
 */
export abstract class ResilientServiceAdapter<TParams, TResult> extends BaseMCPServiceAdapter<
  TParams,
  TResult
> {
  protected fallbackConfig: ServiceFallbackConfig;

  constructor(fallbackConfig?: Partial<ServiceFallbackConfig>) {
    super();
    this.fallbackConfig = {
      ...DEFAULT_FALLBACK_CONFIG,
      ...fallbackConfig,
    };
  }

  /**
   * Execute with enhanced resilience features
   */
  public async execute(params: TParams, context: MCPToolContext): Promise<TResult> {
    try {
      // Try primary execution with retries
      return await this.executeWithRetries(params, context);
    } catch (primaryError) {
      logger.warn(`Primary execution failed for ${this.name}:`, primaryError);

      // Attempt fallback if enabled
      if (this.fallbackConfig.enableFallback) {
        try {
          const fallbackResult = await this.executeFallback(params, context);

          return fallbackResult;
        } catch (fallbackError) {
          logger.error(`Fallback execution also failed for ${this.name}:`, fallbackError);

          throw new MCPToolError(
            MCPToolErrorType.EXECUTION_ERROR,
            'Both primary and fallback execution failed',
            {
              primaryError,
              fallbackError,
              adapter: this.name,
            }
          );
        }
      }

      // No fallback or fallback disabled
      throw primaryError;
    }
  }

  /**
   * Execute with retry logic and exponential backoff
   */
  protected async executeWithRetries(params: TParams, context: MCPToolContext): Promise<TResult> {
    let lastError: Error | null = null;
    let retryDelay = this.fallbackConfig.retryDelay;

    for (let attempt = 0; attempt <= this.fallbackConfig.maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          logger.info(`Retry attempt ${attempt} for ${this.name} after ${retryDelay}ms delay`);
          await this.delay(retryDelay);

          // Update retry delay with exponential backoff
          retryDelay = Math.min(
            retryDelay * this.fallbackConfig.backoffMultiplier,
            this.fallbackConfig.maxRetryDelay
          );
        }

        // Add timeout to individual attempts
        const result = await Promise.race([
          super.execute(params, context),
          this.createTimeoutPromise(this.fallbackConfig.operationTimeout),
        ]);

        return result;
      } catch (error) {
        lastError = error as Error;

        // Check if error is retryable
        if (!this.isRetryableError(error as Error) || attempt === this.fallbackConfig.maxRetries) {
          throw error;
        }

        logger.warn(`Retryable error on attempt ${attempt + 1} for ${this.name}:`, error);
      }
    }

    throw lastError ?? new Error('Execution failed after all retries');
  }

  /**
   * Execute fallback strategy based on configuration
   */
  protected async executeFallback(params: TParams, context: MCPToolContext): Promise<TResult> {
    logger.info(
      `Executing fallback strategy '${this.fallbackConfig.fallbackStrategy}' for ${this.name}`
    );

    switch (this.fallbackConfig.fallbackStrategy) {
      case FallbackStrategy.Cache:
        return await this.tryFromCache(params);

      case FallbackStrategy.Simplified:
        return await this.executeSimplified(params, context);

      case FallbackStrategy.Partial:
        return await this.executePartial(params, context);

      case FallbackStrategy.Default:
        return this.getDefaultResult(params);

      case FallbackStrategy.Fail:
      default:
        throw new MCPToolError(
          MCPToolErrorType.EXECUTION_ERROR,
          `Service ${this.name} is unavailable and no fallback configured`,
          { strategy: this.fallbackConfig.fallbackStrategy }
        );
    }
  }

  /**
   * Try to return cached data as fallback
   */
  protected async tryFromCache(params: TParams): Promise<TResult> {
    const cacheKey = this.getCacheKey(params);
    const cached = await this.checkCache(cacheKey);

    if (cached) {
      logger.info(`Returning cached data as fallback for ${this.name}`);
      return cached;
    }

    throw new MCPToolError(
      MCPToolErrorType.RESOURCE_ERROR,
      'No cached data available for fallback'
    );
  }

  /**
   * Execute simplified version of the operation
   * Subclasses should override this to provide simplified logic
   */
  protected async executeSimplified(_params: TParams, _context: MCPToolContext): Promise<TResult> {
    // Default implementation - subclasses should override
    throw new MCPToolError(
      MCPToolErrorType.EXECUTION_ERROR,
      'Simplified execution not implemented'
    );
  }

  /**
   * Execute partial version returning incomplete results
   * Subclasses should override this to provide partial results
   */
  protected async executePartial(_params: TParams, _context: MCPToolContext): Promise<TResult> {
    // Default implementation - subclasses should override
    throw new MCPToolError(MCPToolErrorType.EXECUTION_ERROR, 'Partial execution not implemented');
  }

  /**
   * Get default result when all else fails
   * Subclasses should override this to provide sensible defaults
   */
  protected getDefaultResult(_params: TParams): TResult {
    // Default implementation - subclasses should override
    throw new MCPToolError(MCPToolErrorType.EXECUTION_ERROR, 'Default result not implemented');
  }

  /**
   * Determine if an error is retryable
   */
  protected isRetryableError(error: Error): boolean {
    const errorCategory = this.categorizeError(error);

    // Retryable error categories
    const retryableCategories = [
      MCPErrorCategory.Performance,
      MCPErrorCategory.RateLimit,
      MCPErrorCategory.External,
      MCPErrorCategory.System,
    ];

    return retryableCategories.includes(errorCategory);
  }

  /**
   * Create a timeout promise that rejects after specified milliseconds
   */
  protected createTimeoutPromise<T>(timeout: number): Promise<T> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(
          new MCPToolError(MCPToolErrorType.TIMEOUT_ERROR, `Operation timed out after ${timeout}ms`)
        );
      }, timeout);
    });
  }

  /**
   * Delay execution for specified milliseconds
   */
  protected delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Monitor health of the underlying service
   * Can be used by circuit breaker for health checks
   */
  public async checkHealth(): Promise<boolean> {
    try {
      // Default implementation - subclasses can override
      // Try a lightweight operation to verify service availability
      const testParams = this.getHealthCheckParams();
      if (testParams) {
        await this.executeCore(testParams, {
          toolName: this.name,
          operation: 'health_check',
        });
      }
      return true;
    } catch (error) {
      logger.warn(`Health check failed for ${this.name}:`, error);
      return false;
    }
  }

  /**
   * Get parameters for health check operation
   * Subclasses should override to provide appropriate test parameters
   */
  protected getHealthCheckParams(): TParams | null {
    return null;
  }
}

