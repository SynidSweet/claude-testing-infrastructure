/**
 * MCP Error Handler
 * 
 * Centralized error handling system for MCP tools with graceful degradation,
 * circuit breaker pattern, and standardized error responses.
 * 
 * Implements TASK-2025-178: Create MCPErrorHandler for comprehensive error management
 * 
 * @module mcp/services/MCPErrorHandler
 */

import { logger } from '../../utils/logger';
import { ClaudeTestingError, extractErrorContext, getErrorMessage } from '../../types/error-types';

/**
 * Error category classifications for different types of MCP errors
 */
export enum MCPErrorCategory {
  Validation = 'validation',
  Integration = 'integration', 
  External = 'external',
  Performance = 'performance',
  System = 'system',
  Authentication = 'authentication',
  Authorization = 'authorization',
  RateLimit = 'rate_limit',
  Resource = 'resource',
  Unknown = 'unknown'
}

/**
 * Error severity levels for prioritizing error handling
 */
export enum MCPErrorSeverity {
  Critical = 'critical',
  High = 'high',
  Medium = 'medium',
  Low = 'low',
  Info = 'info'
}

/**
 * Graceful degradation strategies for different error scenarios
 */
export enum DegradationStrategy {
  Fail = 'fail',              // Fail immediately, return error
  Retry = 'retry',            // Retry with exponential backoff
  Fallback = 'fallback',      // Use fallback service/data
  Circuit = 'circuit',        // Circuit breaker pattern
  Cache = 'cache',            // Return cached data if available
  Partial = 'partial'         // Return partial results
}

/**
 * MCP-specific error class extending ClaudeTestingError
 */
export class MCPError extends ClaudeTestingError {
  constructor(
    message: string,
    public readonly category: MCPErrorCategory,
    public readonly severity: MCPErrorSeverity,
    public readonly toolName?: string,
    public readonly operation?: string,
    context: Record<string, unknown> = {}
  ) {
    super(message, { category, severity, toolName, operation, ...context });
    this.name = 'MCPError';
    Object.setPrototypeOf(this, MCPError.prototype);
  }
}

/**
 * Circuit breaker state for external service resilience
 */
interface CircuitBreakerState {
  failures: number;
  lastFailureTime: number;
  state: 'closed' | 'open' | 'half-open';
  nextAttemptTime: number;
}

/**
 * Error handling configuration
 */
export interface MCPErrorHandlerConfig {
  // Circuit breaker settings
  circuitBreaker: {
    failureThreshold: number;
    recoveryTimeoutMs: number;
    halfOpenMaxCalls: number;
  };
  
  // Retry settings
  retry: {
    maxAttempts: number;
    baseDelayMs: number;
    maxDelayMs: number;
    backoffMultiplier: number;
  };
  
  // Performance thresholds
  performance: {
    warningThresholdMs: number;
    errorThresholdMs: number;
  };
  
  // Degradation settings
  degradation: {
    enableFallbacks: boolean;
    enableCaching: boolean;
    enablePartialResults: boolean;
  };
}

/**
 * Default error handler configuration
 */
const DEFAULT_CONFIG: MCPErrorHandlerConfig = {
  circuitBreaker: {
    failureThreshold: 5,
    recoveryTimeoutMs: 60000, // 1 minute
    halfOpenMaxCalls: 3
  },
  retry: {
    maxAttempts: 3,
    baseDelayMs: 1000,
    maxDelayMs: 30000,
    backoffMultiplier: 2
  },
  performance: {
    warningThresholdMs: 5000,   // 5 seconds
    errorThresholdMs: 30000     // 30 seconds
  },
  degradation: {
    enableFallbacks: true,
    enableCaching: true,
    enablePartialResults: false
  }
};

/**
 * Standardized MCP error response format
 */
export interface MCPErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    category: MCPErrorCategory;
    severity: MCPErrorSeverity;
    toolName?: string;
    operation?: string;
    timestamp: string;
    requestId?: string;
    context?: Record<string, unknown>;
    suggestions?: string[];
  };
  metadata: {
    degradationStrategy?: DegradationStrategy;
    retryable: boolean;
    retryAfterMs?: number;
  };
}

/**
 * Comprehensive MCP Error Handler with circuit breaker, retry logic, and graceful degradation
 */
export class MCPErrorHandler {
  private circuitBreakers = new Map<string, CircuitBreakerState>();
  private config: MCPErrorHandlerConfig;
  
  constructor(config?: Partial<MCPErrorHandlerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Handle errors with appropriate strategy and return standardized response
   */
  public async handleError(
    error: unknown,
    toolName: string,
    operation: string,
    requestId?: string
  ): Promise<MCPErrorResponse> {
    const mcpError = this.categorizeError(error, toolName, operation);
    const strategy = this.getDegradationStrategy(mcpError);
    
    // Log error with full context
    this.logError(mcpError, requestId);
    
    // Update circuit breaker state
    this.updateCircuitBreaker(toolName, mcpError);
    
    // Determine if error is retryable
    const retryable = this.isRetryable(mcpError, strategy);
    const retryAfterMs = retryable ? this.calculateRetryDelay(toolName) : undefined;
    
    const errorResponse: MCPErrorResponse = {
      success: false,
      error: {
        code: this.generateErrorCode(mcpError),
        message: mcpError.message,
        category: mcpError.category,
        severity: mcpError.severity,
        timestamp: new Date().toISOString(),
        context: this.sanitizeContext(mcpError.context),
        suggestions: this.generateSuggestions(mcpError),
        ...(mcpError.toolName && { toolName: mcpError.toolName }),
        ...(mcpError.operation && { operation: mcpError.operation }),
        ...(requestId && { requestId })
      },
      metadata: {
        degradationStrategy: strategy,
        retryable,
        ...(retryAfterMs && { retryAfterMs })
      }
    };

    return errorResponse;
  }

  /**
   * Check if service is available via circuit breaker
   */
  public isServiceAvailable(serviceName: string): boolean {
    const breaker = this.circuitBreakers.get(serviceName);
    if (!breaker) return true;
    
    const now = Date.now();
    
    switch (breaker.state) {
      case 'closed':
        return true;
      case 'open':
        if (now >= breaker.nextAttemptTime) {
          breaker.state = 'half-open';
          return true;
        }
        return false;
      case 'half-open':
        return true;
      default:
        return true;
    }
  }

  /**
   * Execute operation with circuit breaker protection
   */
  public async executeWithCircuitBreaker<T>(
    serviceName: string,
    operation: () => Promise<T>,
    fallback?: () => Promise<T>
  ): Promise<T> {
    if (!this.isServiceAvailable(serviceName)) {
      if (fallback && this.config.degradation.enableFallbacks) {
        logger.info(`Circuit breaker OPEN for ${serviceName}, using fallback`);
        return await fallback();
      }
      throw new MCPError(
        `Service ${serviceName} is currently unavailable (circuit breaker OPEN)`,
        MCPErrorCategory.External,
        MCPErrorSeverity.High,
        undefined,
        serviceName
      );
    }

    try {
      const result = await operation();
      this.recordSuccess(serviceName);
      return result;
    } catch (error) {
      this.recordFailure(serviceName);
      throw error;
    }
  }

  /**
   * Execute operation with retry logic
   */
  public async executeWithRetry<T>(
    operation: () => Promise<T>,
    toolName: string,
    operationName: string,
    maxAttempts?: number
  ): Promise<T> {
    const attempts = maxAttempts ?? this.config.retry.maxAttempts;
    let lastError: unknown;

    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        if (attempt === attempts) {
          break; // Don't wait after the last attempt
        }

        const mcpError = this.categorizeError(error, toolName, operationName);
        if (!this.isRetryable(mcpError, DegradationStrategy.Retry)) {
          break; // Don't retry non-retryable errors
        }

        const delay = this.calculateExponentialBackoff(attempt);
        logger.warn(`Attempt ${attempt}/${attempts} failed for ${toolName}.${operationName}, retrying in ${delay}ms`, {
          error: getErrorMessage(error),
          attempt,
          maxAttempts: attempts
        });
        
        await this.sleep(delay);
      }
    }

    throw lastError;
  }

  /**
   * Categorize error into appropriate MCP error type
   */
  private categorizeError(error: unknown, toolName: string, operation: string): MCPError {
    if (error instanceof MCPError) {
      return error;
    }

    let category = MCPErrorCategory.Unknown;
    let severity = MCPErrorSeverity.Medium;
    const errorMessage = getErrorMessage(error);
    const context = extractErrorContext(error);

    // Categorization logic based on error patterns
    if (errorMessage.includes('validation') || errorMessage.includes('invalid')) {
      category = MCPErrorCategory.Validation;
      severity = MCPErrorSeverity.Medium;
    } else if (errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT')) {
      category = MCPErrorCategory.Performance;
      severity = MCPErrorSeverity.High;
    } else if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('ENOTFOUND')) {
      category = MCPErrorCategory.External;
      severity = MCPErrorSeverity.High;
    } else if (errorMessage.includes('permission') || errorMessage.includes('unauthorized')) {
      category = MCPErrorCategory.Authorization;
      severity = MCPErrorSeverity.High;
    } else if (errorMessage.includes('rate limit') || errorMessage.includes('too many requests')) {
      category = MCPErrorCategory.RateLimit;
      severity = MCPErrorSeverity.Medium;
    } else if (errorMessage.includes('ENOENT') || errorMessage.includes('not found')) {
      category = MCPErrorCategory.Resource;
      severity = MCPErrorSeverity.Medium;
    } else if (errorMessage.includes('EMFILE') || errorMessage.includes('ENOMEM')) {
      category = MCPErrorCategory.System;
      severity = MCPErrorSeverity.Critical;
    }

    return new MCPError(errorMessage, category, severity, toolName, operation, context);
  }

  /**
   * Determine appropriate degradation strategy for error
   */
  private getDegradationStrategy(error: MCPError): DegradationStrategy {
    switch (error.category) {
      case MCPErrorCategory.Validation:
        return DegradationStrategy.Fail;
      case MCPErrorCategory.Performance:
        return error.severity === MCPErrorSeverity.Critical 
          ? DegradationStrategy.Circuit 
          : DegradationStrategy.Retry;
      case MCPErrorCategory.External:
        return DegradationStrategy.Circuit;
      case MCPErrorCategory.RateLimit:
        return DegradationStrategy.Retry;
      case MCPErrorCategory.Resource:
        return DegradationStrategy.Fallback;
      case MCPErrorCategory.System:
        return error.severity === MCPErrorSeverity.Critical 
          ? DegradationStrategy.Fail 
          : DegradationStrategy.Retry;
      default:
        return DegradationStrategy.Retry;
    }
  }

  /**
   * Update circuit breaker state based on error
   */
  private updateCircuitBreaker(serviceName: string, error: MCPError): void {
    if (error.category !== MCPErrorCategory.External && 
        error.category !== MCPErrorCategory.Performance) {
      return; // Only use circuit breaker for external/performance issues
    }

    this.recordFailure(serviceName);
  }

  /**
   * Record successful operation for circuit breaker
   */
  private recordSuccess(serviceName: string): void {
    const breaker = this.circuitBreakers.get(serviceName);
    if (breaker) {
      if (breaker.state === 'half-open') {
        // Recovery successful, close circuit
        breaker.state = 'closed';
        breaker.failures = 0;
        logger.info(`Circuit breaker CLOSED for ${serviceName} - service recovered`);
      } else if (breaker.state === 'closed') {
        // Reset failure count on successful operation
        breaker.failures = Math.max(0, breaker.failures - 1);
      }
    }
  }

  /**
   * Record failed operation for circuit breaker
   */
  private recordFailure(serviceName: string): void {
    const now = Date.now();
    let breaker = this.circuitBreakers.get(serviceName);
    
    if (!breaker) {
      breaker = {
        failures: 0,
        lastFailureTime: now,
        state: 'closed',
        nextAttemptTime: 0
      };
      this.circuitBreakers.set(serviceName, breaker);
    }

    breaker.failures++;
    breaker.lastFailureTime = now;

    if (breaker.state === 'closed' && breaker.failures >= this.config.circuitBreaker.failureThreshold) {
      breaker.state = 'open';
      breaker.nextAttemptTime = now + this.config.circuitBreaker.recoveryTimeoutMs;
      logger.warn(`Circuit breaker OPEN for ${serviceName} - too many failures (${breaker.failures})`);
    } else if (breaker.state === 'half-open') {
      breaker.state = 'open';
      breaker.nextAttemptTime = now + this.config.circuitBreaker.recoveryTimeoutMs;
      logger.warn(`Circuit breaker OPEN for ${serviceName} - recovery failed`);
    }
  }

  /**
   * Determine if error is retryable
   */
  private isRetryable(error: MCPError, strategy: DegradationStrategy): boolean {
    if (strategy === DegradationStrategy.Fail) return false;
    
    // Never retry validation errors
    if (error.category === MCPErrorCategory.Validation) return false;
    
    // Never retry authorization errors
    if (error.category === MCPErrorCategory.Authorization) return false;
    
    // Critical system errors are not retryable
    if (error.category === MCPErrorCategory.System && error.severity === MCPErrorSeverity.Critical) {
      return false;
    }
    
    return true;
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(serviceName: string): number {
    const breaker = this.circuitBreakers.get(serviceName);
    if (breaker && breaker.state === 'open') {
      return Math.max(0, breaker.nextAttemptTime - Date.now());
    }
    return this.config.retry.baseDelayMs;
  }

  /**
   * Calculate exponential backoff delay for retries
   */
  private calculateExponentialBackoff(attempt: number): number {
    const delay = this.config.retry.baseDelayMs * Math.pow(this.config.retry.backoffMultiplier, attempt - 1);
    return Math.min(delay, this.config.retry.maxDelayMs);
  }

  /**
   * Generate error code for standardized responses
   */
  private generateErrorCode(error: MCPError): string {
    const categoryCode = error.category.toUpperCase().replace('_', '');
    const severityCode = error.severity.toUpperCase();
    return `MCP_${categoryCode}_${severityCode}`;
  }

  /**
   * Sanitize error context for safe logging/response
   */
  private sanitizeContext(context: Record<string, unknown>): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};
    
    for (const [key, value] of Object.entries(context)) {
      // Remove sensitive information
      if (key.toLowerCase().includes('password') || 
          key.toLowerCase().includes('token') || 
          key.toLowerCase().includes('secret')) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'string' && value.length > 1000) {
        // Truncate very long strings
        sanitized[key] = value.substring(0, 1000) + '...[TRUNCATED]';
      } else {
        sanitized[key] = value;
      }
    }
    
    return sanitized;
  }

  /**
   * Generate helpful suggestions based on error type
   */
  private generateSuggestions(error: MCPError): string[] {
    const suggestions: string[] = [];
    
    switch (error.category) {
      case MCPErrorCategory.Validation:
        suggestions.push('Check input parameters for correct format and values');
        suggestions.push('Refer to tool documentation for required parameters');
        break;
      case MCPErrorCategory.External:
        suggestions.push('Check network connectivity');
        suggestions.push('Verify external service is available');
        suggestions.push('Consider using cached data if available');
        break;
      case MCPErrorCategory.Performance:
        suggestions.push('Reduce request complexity or size');
        suggestions.push('Consider breaking operation into smaller chunks');
        break;
      case MCPErrorCategory.RateLimit:
        suggestions.push('Implement exponential backoff for retries');
        suggestions.push('Reduce request frequency');
        break;
      case MCPErrorCategory.Resource:
        suggestions.push('Check if file or resource exists');
        suggestions.push('Verify permissions for resource access');
        break;
      case MCPErrorCategory.Authorization:
        suggestions.push('Check authentication credentials');
        suggestions.push('Verify required permissions are granted');
        break;
    }
    
    return suggestions;
  }

  /**
   * Log error with appropriate level and context
   */
  private logError(error: MCPError, requestId?: string): void {
    const logContext = {
      category: error.category,
      severity: error.severity,
      toolName: error.toolName,
      operation: error.operation,
      requestId,
      context: this.sanitizeContext(error.context)
    };

    switch (error.severity) {
      case MCPErrorSeverity.Critical:
        logger.error(`CRITICAL MCP Error: ${error.message}`, logContext);
        break;
      case MCPErrorSeverity.High:
        logger.error(`HIGH MCP Error: ${error.message}`, logContext);
        break;
      case MCPErrorSeverity.Medium:
        logger.warn(`MEDIUM MCP Error: ${error.message}`, logContext);
        break;
      case MCPErrorSeverity.Low:
        logger.info(`LOW MCP Error: ${error.message}`, logContext);
        break;
      case MCPErrorSeverity.Info:
        logger.debug(`INFO MCP Error: ${error.message}`, logContext);
        break;
    }
  }

  /**
   * Utility sleep function for delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get current circuit breaker states (for monitoring/debugging)
   */
  public getCircuitBreakerStates(): Map<string, CircuitBreakerState> {
    return new Map(this.circuitBreakers);
  }

  /**
   * Reset circuit breaker for a service (for testing/manual intervention)
   */
  public resetCircuitBreaker(serviceName: string): void {
    this.circuitBreakers.delete(serviceName);
    logger.info(`Circuit breaker reset for ${serviceName}`);
  }

  /**
   * Update configuration at runtime
   */
  public updateConfig(config: Partial<MCPErrorHandlerConfig>): void {
    this.config = { ...this.config, ...config };
    logger.info('MCPErrorHandler configuration updated', { newConfig: config });
  }
}

/**
 * Global singleton instance for consistent error handling across MCP tools
 */
export const mcpErrorHandler = new MCPErrorHandler();

/**
 * Convenience function for handling MCP errors with standard response format
 */
export async function handleMCPError(
  error: unknown,
  toolName: string,
  operation: string,
  requestId?: string
): Promise<MCPErrorResponse> {
  return mcpErrorHandler.handleError(error, toolName, operation, requestId);
}

/**
 * Convenience function for executing operations with circuit breaker protection
 */
export async function withCircuitBreaker<T>(
  serviceName: string,
  operation: () => Promise<T>,
  fallback?: () => Promise<T>
): Promise<T> {
  return mcpErrorHandler.executeWithCircuitBreaker(serviceName, operation, fallback);
}

/**
 * Convenience function for executing operations with retry logic
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  toolName: string,
  operationName: string,
  maxAttempts?: number
): Promise<T> {
  return mcpErrorHandler.executeWithRetry(operation, toolName, operationName, maxAttempts);
}

/**
 * Type guard for MCP errors
 */
export function isMCPError(error: unknown): error is MCPError {
  return error instanceof MCPError;
}