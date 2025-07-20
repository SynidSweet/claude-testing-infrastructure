/**
 * Base MCP Service Adapter
 *
 * Abstract base class for creating service adapters that bridge existing
 * infrastructure services with MCP tools. Provides common patterns for
 * caching, error handling, logging, and validation.
 *
 * Implements TASK-2025-205: Create service adapter foundation classes
 *
 * @module mcp/adapters/BaseMCPServiceAdapter
 */

import { z } from 'zod';
import { MCPCacheManager, CacheLayer } from '../services/MCPCacheManager';
import { getMCPLogger, MCPToolStatus, type MCPToolContext } from '../services/MCPLoggingService';
import { withCircuitBreaker, MCPErrorCategory } from '../services/MCPErrorHandler';
import { MCPToolError, MCPToolErrorType } from '../../types/mcp-tool-types';
import { logger } from '../../utils/logger';

/**
 * Service adapter interface defining the contract for all MCP service adapters
 */
export interface ServiceAdapter<TParams, TResult> {
  /** Unique adapter name */
  name: string;

  /** Human-readable description */
  description: string;

  /** Zod schema for parameter validation */
  parameters: z.ZodSchema<TParams>;

  /** Core execution method with error handling and caching */
  execute(params: TParams, context: MCPToolContext): Promise<TResult>;

  /** Generate cache key for the given parameters */
  getCacheKey(params: TParams): string;

  /** Get cache TTL in milliseconds */
  getTTL(): number;

  /** Validate and transform input parameters */
  validateInput(params: unknown): TParams;

  /** Transform service output to MCP-compatible format */
  transformOutput(result: unknown): TResult;
}

/**
 * Base MCP service adapter providing common functionality for all adapters
 */
export abstract class BaseMCPServiceAdapter<TParams, TResult>
  implements ServiceAdapter<TParams, TResult>
{
  public abstract readonly name: string;
  public abstract readonly description: string;
  public abstract readonly parameters: z.ZodSchema<TParams>;

  /**
   * Generate cache key for the given parameters - must be implemented by subclasses
   */
  public abstract getCacheKey(params: TParams): string;

  /**
   * Get cache TTL in milliseconds - must be implemented by subclasses
   */
  public abstract getTTL(): number;

  protected readonly cacheManager: MCPCacheManager;
  protected readonly logger = getMCPLogger();
  protected readonly cacheLayer: CacheLayer = CacheLayer.TestGeneration;

  constructor() {
    this.cacheManager = MCPCacheManager.getInstance();
  }

  /**
   * Execute adapter with full error handling, caching, and monitoring
   */
  public async execute(params: TParams, context: MCPToolContext): Promise<TResult> {
    const metrics = this.logger.logToolStart(context);

    return withCircuitBreaker(this.name, async () => {
      try {
        // Check cache first
        const cacheKey = this.getCacheKey(params);
        const cached = await this.checkCache(cacheKey);

        if (cached) {
          metrics.cacheHit = true;
          this.logger.logToolComplete(context, metrics, MCPToolStatus.Cached, cached);
          return cached;
        }

        // Execute core service logic
        const result = await this.executeCore(params, context);

        // Transform output for MCP compatibility
        const transformedResult = this.transformOutput(result);

        // Cache successful results
        await this.cacheResult(cacheKey, transformedResult);

        this.logger.logToolComplete(context, metrics, MCPToolStatus.Success, transformedResult);
        return transformedResult;
      } catch (error) {
        this.logger.logToolError(context, metrics, error as Error);

        // Transform error to MCPToolError if needed
        if (!(error instanceof MCPToolError)) {
          throw new MCPToolError(
            MCPToolErrorType.EXECUTION_ERROR,
            `Service adapter execution failed: ${(error as Error).message}`,
            { originalError: error }
          );
        }

        throw error;
      }
    });
  }

  /**
   * Validate input parameters using Zod schema
   */
  public validateInput(params: unknown): TParams {
    try {
      return this.parameters.parse(params);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new MCPToolError(MCPToolErrorType.VALIDATION_ERROR, 'Invalid parameters provided', {
          validationErrors: error.errors,
        });
      }
      throw error;
    }
  }

  /**
   * Default output transformation (can be overridden)
   */
  public transformOutput(result: unknown): TResult {
    // Default implementation - subclasses should override for specific transformations
    return result as TResult;
  }

  /**
   * Abstract method for core service execution logic
   */
  protected abstract executeCore(params: TParams, context: MCPToolContext): Promise<unknown>;

  /**
   * Check cache for existing results
   */
  protected async checkCache(key: string): Promise<TResult | null> {
    try {
      const cached = await this.cacheManager.get(this.cacheLayer, key);
      if (cached) {
        logger.debug(`Cache hit for ${this.name}: ${key}`);
        return cached as TResult;
      }
      return null;
    } catch (error) {
      logger.warn(`Cache check failed for ${this.name}: ${(error as Error).message}`);
      return null;
    }
  }

  /**
   * Cache results with appropriate TTL
   */
  protected async cacheResult(key: string, result: TResult): Promise<void> {
    try {
      await this.cacheManager.set(this.cacheLayer, key, result, this.getTTL());
      logger.debug(`Cached result for ${this.name}: ${key}`);
    } catch (error) {
      logger.warn(`Cache set failed for ${this.name}: ${(error as Error).message}`);
      // Cache failures are non-critical, continue execution
    }
  }

  /**
   * Generate unique session ID for tracking
   */
  protected generateSessionId(): string {
    return `${this.name}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate trace ID for distributed tracing
   */
  protected generateTraceId(): string {
    return `trace-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Create standardized MCP tool context
   */
  protected createContext(params: TParams, baseContext?: Partial<MCPToolContext>): MCPToolContext {
    return {
      toolName: this.name,
      operation: 'execute',
      parameters: params as Record<string, unknown>,
      sessionId: baseContext?.sessionId ?? this.generateSessionId(),
      traceId: baseContext?.traceId ?? this.generateTraceId(),
      ...baseContext,
    };
  }

  /**
   * Handle service-specific errors with categorization
   */
  protected handleServiceError(error: Error, context: MCPToolContext): never {
    // Log the error with context
    logger.error(`Service adapter error in ${this.name}:`, {
      error: error.message,
      stack: error.stack,
      context,
    });

    // Categorize the error for proper handling
    const errorCategory = this.categorizeError(error);

    throw new MCPToolError(
      this.mapErrorCategoryToType(errorCategory),
      `${this.name} service error: ${error.message}`,
      {
        category: errorCategory,
        originalError: error,
        context,
      }
    );
  }

  /**
   * Categorize errors for circuit breaker and fallback handling
   */
  protected categorizeError(error: Error): MCPErrorCategory {
    const message = error.message.toLowerCase();

    if (message.includes('timeout') || message.includes('timed out')) {
      return MCPErrorCategory.Performance;
    }

    if (message.includes('permission') || message.includes('access denied')) {
      return MCPErrorCategory.Authorization;
    }

    if (message.includes('not found') || message.includes('does not exist')) {
      return MCPErrorCategory.Resource;
    }

    if (message.includes('invalid') || message.includes('validation')) {
      return MCPErrorCategory.Validation;
    }

    if (message.includes('rate limit') || message.includes('too many')) {
      return MCPErrorCategory.RateLimit;
    }

    return MCPErrorCategory.System;
  }

  /**
   * Map error categories to MCP tool error types
   */
  protected mapErrorCategoryToType(category: MCPErrorCategory): MCPToolErrorType {
    switch (category) {
      case MCPErrorCategory.Validation:
        return MCPToolErrorType.VALIDATION_ERROR;
      case MCPErrorCategory.Performance:
        return MCPToolErrorType.TIMEOUT_ERROR;
      case MCPErrorCategory.Authorization:
        return MCPToolErrorType.PERMISSION_ERROR;
      case MCPErrorCategory.Resource:
        return MCPToolErrorType.RESOURCE_ERROR;
      case MCPErrorCategory.System:
      case MCPErrorCategory.Integration:
      case MCPErrorCategory.External:
      case MCPErrorCategory.RateLimit:
      default:
        return MCPToolErrorType.EXECUTION_ERROR;
    }
  }
}
