/**
 * Retry helper utility with exponential backoff and intelligent retry strategies
 * 
 * Provides robust retry logic for transient failures in Claude CLI operations
 */

import { logger } from './logger';
import { AIRateLimitError, AINetworkError, AITimeoutError } from '../types/ai-error-types';

export interface RetryOptions {
  maxAttempts?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffFactor?: number;
  jitter?: boolean;
  retryableErrors?: Array<new (...args: any[]) => Error>;
  onRetry?: (error: Error, attempt: number, delay: number) => void;
}

export interface RetryResult<T> {
  success: boolean;
  result?: T;
  error?: Error | undefined;
  attempts: number;
  totalDuration: number;
}

/**
 * Default retry options
 */
const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 30000,
  backoffFactor: 2,
  jitter: true,
  retryableErrors: [AITimeoutError, AINetworkError, AIRateLimitError],
  onRetry: () => {},
};

/**
 * Check if an error is retryable based on error type
 */
function isRetryableError(error: Error, retryableErrors: Array<new (...args: any[]) => Error>): boolean {
  // If retryableErrors is empty, don't retry anything
  if (retryableErrors.length === 0) {
    return false;
  }

  // Check if error is an instance of any retryable error type
  if (retryableErrors.some((ErrorType) => error instanceof ErrorType)) {
    return true;
  }

  // Check for specific error messages that indicate transient failures
  const transientMessages = [
    'ECONNREFUSED',
    'ECONNRESET',
    'ETIMEDOUT',
    'ENOTFOUND',
    'ENETUNREACH',
    'socket hang up',
    'Network error',
    'rate limit',
    'quota exceeded',
    'timeout',
    'timed out',
  ];

  const errorMessage = error.message.toLowerCase();
  return transientMessages.some((msg) => errorMessage.includes(msg.toLowerCase()));
}

/**
 * Calculate delay with exponential backoff
 */
function calculateDelay(
  attempt: number,
  initialDelay: number,
  maxDelay: number,
  backoffFactor: number,
  jitter: boolean
): number {
  // Exponential backoff: delay = initialDelay * (backoffFactor ^ attempt)
  let delay = initialDelay * Math.pow(backoffFactor, attempt - 1);

  // Cap at max delay
  delay = Math.min(delay, maxDelay);

  // Add jitter to prevent thundering herd
  if (jitter) {
    // Add random jitter between -25% and +25%
    const jitterAmount = delay * 0.25;
    delay += (Math.random() * 2 - 1) * jitterAmount;
  }

  return Math.round(delay);
}

/**
 * Execute a function with retry logic and exponential backoff
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<RetryResult<T>> {
  // Handle array options specially to allow overriding with empty arrays
  const opts = { 
    ...DEFAULT_OPTIONS, 
    ...options,
    retryableErrors: options.retryableErrors !== undefined ? options.retryableErrors : DEFAULT_OPTIONS.retryableErrors
  };
  const startTime = Date.now();
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      logger.debug(`Executing operation, attempt ${attempt}/${opts.maxAttempts}`);
      
      const result = await operation();
      
      return {
        success: true,
        result,
        attempts: attempt,
        totalDuration: Date.now() - startTime,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      logger.debug(`Operation failed on attempt ${attempt}: ${lastError.message}`);

      // Check if we should retry
      if (attempt === opts.maxAttempts || !isRetryableError(lastError, opts.retryableErrors)) {
        break;
      }

      // Calculate delay for next attempt
      const delay = calculateDelay(
        attempt,
        opts.initialDelay,
        opts.maxDelay,
        opts.backoffFactor,
        opts.jitter
      );

      logger.info(
        `Retrying operation after ${delay}ms delay (attempt ${attempt + 1}/${opts.maxAttempts})`
      );

      // Call retry callback
      opts.onRetry(lastError, attempt, delay);

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // All attempts failed
  return {
    success: false,
    error: lastError || new Error('All retry attempts failed'),
    attempts: opts.maxAttempts,
    totalDuration: Date.now() - startTime,
  };
}

/**
 * Retry decorator for class methods
 */
export function Retry(options: RetryOptions = {}) {
  return function (
    _target: any,
    _propertyKey: string,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const result = await withRetry(() => originalMethod.apply(this, args), options);

      if (!result.success) {
        throw result.error;
      }

      return result.result;
    };

    return descriptor;
  };
}

/**
 * Create a circuit breaker for preventing cascading failures
 */
export class CircuitBreaker {
  private failureCount = 0;
  private lastFailureTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  constructor(
    private readonly failureThreshold: number = 5,
    private readonly recoveryTimeout: number = 60000 // 1 minute
  ) {}

  /**
   * Execute operation with circuit breaker protection
   */
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    // Check if circuit is open
    if (this.state === 'open') {
      const timeSinceLastFailure = Date.now() - this.lastFailureTime;
      
      if (timeSinceLastFailure < this.recoveryTimeout) {
        throw new Error('Circuit breaker is open - operation blocked to prevent cascading failures');
      }
      
      // Try half-open state
      this.state = 'half-open';
    }

    try {
      const result = await operation();
      
      // Success - reset circuit
      if (this.state === 'half-open' || this.failureCount > 0) {
        this.failureCount = 0;
        this.state = 'closed';
        logger.info('Circuit breaker reset to closed state');
      }
      
      return result;
    } catch (error) {
      this.failureCount++;
      this.lastFailureTime = Date.now();

      if (this.failureCount >= this.failureThreshold) {
        this.state = 'open';
        logger.warn(
          `Circuit breaker opened after ${this.failureCount} failures. ` +
          `Will retry after ${this.recoveryTimeout}ms`
        );
      }

      throw error;
    }
  }

  /**
   * Get current circuit breaker state
   */
  getState(): { state: string; failureCount: number; isHealthy: boolean } {
    return {
      state: this.state,
      failureCount: this.failureCount,
      isHealthy: this.state === 'closed',
    };
  }
}