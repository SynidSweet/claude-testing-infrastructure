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
  retryableErrors?: Array<
    typeof AITimeoutError | typeof AINetworkError | typeof AIRateLimitError | typeof Error
  >;
  onRetry?: (error: Error, attempt: number, delay: number) => void;
  // Intelligent retry enhancements
  adaptiveTimeout?: boolean;
  contextAware?: boolean;
  taskContext?: TaskRetryContext;
  failurePatterns?: FailurePatternDetector;
}

export interface TaskRetryContext {
  taskId: string;
  estimatedTokens: number;
  complexity: 'low' | 'medium' | 'high';
  previousAttempts: number;
  previousFailures: string[];
  averageSuccessTime?: number;
}

export interface RetryResult<T> {
  success: boolean;
  result?: T;
  error?: Error;
  attempts: number;
  totalDuration: number;
}

/**
 * Default retry options
 */
const DEFAULT_OPTIONS: Required<Omit<RetryOptions, 'taskContext' | 'failurePatterns'>> = {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 30000,
  backoffFactor: 2,
  jitter: true,
  retryableErrors: [AITimeoutError, AINetworkError, AIRateLimitError],
  onRetry: () => {},
  adaptiveTimeout: true,
  contextAware: true,
};

/**
 * Failure pattern detector for learning from previous failures
 */
export class FailurePatternDetector {
  private patterns = new Map<
    string,
    {
      count: number;
      lastSeen: Date;
      successfulRetryStrategies: string[];
      avgTimeToSuccess: number;
    }
  >();

  recordFailure(error: Error, _taskContext?: TaskRetryContext): void {
    const pattern = this.categorizeError(error);
    const existing = this.patterns.get(pattern) ?? {
      count: 0,
      lastSeen: new Date(),
      successfulRetryStrategies: [],
      avgTimeToSuccess: 0,
    };

    existing.count++;
    existing.lastSeen = new Date();
    this.patterns.set(pattern, existing);

    logger.debug(`Recorded failure pattern: ${pattern} (count: ${existing.count})`);
  }

  recordSuccess(error: Error, retryStrategy: string, timeToSuccess: number): void {
    const pattern = this.categorizeError(error);
    const existing = this.patterns.get(pattern);
    if (existing) {
      existing.successfulRetryStrategies.push(retryStrategy);
      existing.avgTimeToSuccess = (existing.avgTimeToSuccess + timeToSuccess) / 2;
      this.patterns.set(pattern, existing);
    }
  }

  getRecommendedStrategy(error: Error): {
    maxAttempts: number;
    initialDelay: number;
    backoffFactor: number;
    strategy: string;
  } {
    const pattern = this.categorizeError(error);
    const existing = this.patterns.get(pattern);

    if (!existing || existing.count < 2) {
      return { maxAttempts: 3, initialDelay: 1000, backoffFactor: 2, strategy: 'default' };
    }

    // Adapt strategy based on failure patterns
    if (pattern.includes('timeout')) {
      return {
        maxAttempts: 2, // Fewer attempts for timeouts
        initialDelay: Math.min(existing.avgTimeToSuccess * 0.5, 30000),
        backoffFactor: 1.5, // Gentler backoff
        strategy: 'timeout-adaptive',
      };
    }

    if (pattern.includes('rate-limit')) {
      return {
        maxAttempts: 5, // More attempts for rate limits
        initialDelay: 60000, // Longer initial delay
        backoffFactor: 3, // Aggressive backoff
        strategy: 'rate-limit-adaptive',
      };
    }

    if (pattern.includes('network')) {
      return {
        maxAttempts: 4,
        initialDelay: 2000,
        backoffFactor: 2.5,
        strategy: 'network-adaptive',
      };
    }

    return { maxAttempts: 3, initialDelay: 1000, backoffFactor: 2, strategy: 'default' };
  }

  private categorizeError(error: Error): string {
    const message = error.message.toLowerCase();

    if (
      error instanceof AITimeoutError ||
      message.includes('timeout') ||
      message.includes('timed out')
    ) {
      return 'timeout';
    }
    if (
      error instanceof AIRateLimitError ||
      message.includes('rate limit') ||
      message.includes('quota')
    ) {
      return 'rate-limit';
    }
    if (
      error instanceof AINetworkError ||
      message.includes('network') ||
      message.includes('connection')
    ) {
      return 'network';
    }
    if (message.includes('authentication') || message.includes('auth')) {
      return 'authentication';
    }

    return 'unknown';
  }

  getPatternStats(): Map<
    string,
    {
      count: number;
      lastSeen: Date;
      successfulRetryStrategies: string[];
      avgTimeToSuccess: number;
    }
  > {
    return new Map(this.patterns);
  }
}

/**
 * Check if an error is retryable based on error type and context
 */
function isRetryableError(
  error: Error,
  retryableErrors: Array<
    typeof AITimeoutError | typeof AINetworkError | typeof AIRateLimitError | typeof Error
  >,
  context?: TaskRetryContext,
  patterns?: FailurePatternDetector
): boolean {
  // If retryableErrors is empty, don't retry anything
  if (retryableErrors.length === 0) {
    return false;
  }

  // Check if error is an instance of any retryable error type
  if (retryableErrors.some((ErrorType) => error instanceof ErrorType)) {
    // Context-aware retry decision
    if (context && patterns) {
      // Don't retry if we've seen this error pattern too many times for this task
      const recentFailures = context.previousFailures.filter(
        (f) => f.includes(error.constructor.name) || f.includes(error.message.slice(0, 50))
      ).length;

      if (recentFailures >= 3) {
        logger.warn(`Skipping retry for task ${context.taskId} - too many similar failures`);
        return false;
      }

      // Don't retry complex tasks with timeouts as aggressively
      if (error instanceof AITimeoutError && context.complexity === 'high') {
        return context.previousAttempts < 2;
      }
    }

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
  const isTransient = transientMessages.some((msg) => errorMessage.includes(msg.toLowerCase()));

  // Apply context-aware filtering for transient errors too
  if (isTransient && context) {
    // Be more conservative with retries for high-complexity tasks
    if (context.complexity === 'high' && context.previousAttempts >= 2) {
      return false;
    }
  }

  return isTransient;
}

/**
 * Calculate delay with exponential backoff and adaptive timeout
 */
function calculateDelay(
  attempt: number,
  initialDelay: number,
  maxDelay: number,
  backoffFactor: number,
  jitter: boolean,
  context?: TaskRetryContext,
  _error?: Error
): number {
  let baseDelay = initialDelay;

  // Adaptive timeout based on task context
  if (context) {
    // Adjust base delay based on task complexity and estimated tokens
    const complexityMultiplier =
      {
        low: 0.8,
        medium: 1.0,
        high: 1.5,
      }[context.complexity] ?? 1.0;

    // Adjust based on estimated tokens (more tokens = potentially longer processing)
    const tokenMultiplier = Math.min(1 + context.estimatedTokens / 10000, 3.0);

    baseDelay = baseDelay * complexityMultiplier * tokenMultiplier;

    // Use historical success time if available
    if (context.averageSuccessTime && context.averageSuccessTime > 0) {
      // If this task type typically takes longer, wait a bit longer
      const historicalMultiplier = Math.min(context.averageSuccessTime / 30000, 2.0);
      baseDelay = Math.max(baseDelay, baseDelay * historicalMultiplier);
    }

    logger.debug(
      `Adaptive delay for task ${context.taskId}: base=${initialDelay}ms, ` +
        `adjusted=${Math.round(baseDelay)}ms (complexity=${context.complexity}, ` +
        `tokens=${context.estimatedTokens})`
    );
  }

  // Exponential backoff: delay = baseDelay * (backoffFactor ^ attempt)
  let delay = baseDelay * Math.pow(backoffFactor, attempt - 1);

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
 * Execute a function with intelligent retry logic and adaptive strategies
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<RetryResult<T>> {
  const startTime = Date.now();
  let lastError: Error | undefined;
  const adaptedOptions = { ...DEFAULT_OPTIONS, ...options };

  // Override retryableErrors if explicitly provided (including empty arrays)
  if (options.retryableErrors !== undefined) {
    adaptedOptions.retryableErrors = options.retryableErrors;
  }

  // Initialize failure pattern detector if not provided but context-aware retry is enabled
  if (adaptedOptions.contextAware && !adaptedOptions.failurePatterns) {
    adaptedOptions.failurePatterns = new FailurePatternDetector();
  }

  // Record task context for adaptive retry
  if (adaptedOptions.taskContext) {
    adaptedOptions.taskContext.previousAttempts = 0;
  }

  for (let attempt = 1; attempt <= adaptedOptions.maxAttempts; attempt++) {
    try {
      logger.debug(
        `Executing operation, attempt ${attempt}/${adaptedOptions.maxAttempts}${
          adaptedOptions.taskContext ? ` (task: ${adaptedOptions.taskContext.taskId})` : ''
        }`
      );

      const result = await operation();

      // Record successful retry strategy if this was a retry
      if (attempt > 1 && lastError && adaptedOptions.failurePatterns) {
        const timeToSuccess = Date.now() - startTime;
        adaptedOptions.failurePatterns.recordSuccess(
          lastError,
          'exponential-backoff',
          timeToSuccess
        );

        // Update task context with successful timing
        if (adaptedOptions.taskContext) {
          const avgTime = adaptedOptions.taskContext.averageSuccessTime ?? 0;
          adaptedOptions.taskContext.averageSuccessTime = (avgTime + timeToSuccess) / 2;
        }
      }

      return {
        success: true,
        result,
        attempts: attempt,
        totalDuration: Date.now() - startTime,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Update task context with failure
      if (adaptedOptions.taskContext) {
        adaptedOptions.taskContext.previousAttempts = attempt;
        adaptedOptions.taskContext.previousFailures.push(
          `${lastError.constructor.name}: ${lastError.message.slice(0, 100)}`
        );
      }

      // Record failure pattern
      if (adaptedOptions.failurePatterns) {
        adaptedOptions.failurePatterns.recordFailure(lastError, adaptedOptions.taskContext);

        // Get intelligent retry recommendation if this is an early attempt
        if (attempt === 1 && adaptedOptions.contextAware) {
          const recommendation = adaptedOptions.failurePatterns.getRecommendedStrategy(lastError);

          // Adapt retry options based on recommendation
          adaptedOptions.maxAttempts = Math.max(
            adaptedOptions.maxAttempts,
            recommendation.maxAttempts
          );
          adaptedOptions.initialDelay = Math.max(
            adaptedOptions.initialDelay,
            recommendation.initialDelay
          );
          adaptedOptions.backoffFactor = recommendation.backoffFactor;

          logger.info(
            `Applied intelligent retry strategy: ${recommendation.strategy} ` +
              `(attempts: ${recommendation.maxAttempts}, delay: ${recommendation.initialDelay}ms)`
          );
        }
      }

      logger.debug(`Operation failed on attempt ${attempt}: ${lastError.message}`);

      // Check if we should retry using context-aware logic
      const shouldRetry =
        attempt < adaptedOptions.maxAttempts &&
        isRetryableError(
          lastError,
          adaptedOptions.retryableErrors,
          adaptedOptions.taskContext,
          adaptedOptions.failurePatterns
        );

      if (!shouldRetry) {
        logger.debug(
          `Not retrying: attempt=${attempt}/${adaptedOptions.maxAttempts}, ` +
            `retryable=${isRetryableError(lastError, adaptedOptions.retryableErrors)}`
        );
        break;
      }

      // Calculate delay for next attempt with adaptive logic
      const delay = calculateDelay(
        attempt,
        adaptedOptions.initialDelay,
        adaptedOptions.maxDelay,
        adaptedOptions.backoffFactor,
        adaptedOptions.jitter,
        adaptedOptions.taskContext,
        lastError
      );

      logger.info(
        `Intelligent retry: waiting ${delay}ms before attempt ${attempt + 1}/${adaptedOptions.maxAttempts} ` +
          `(strategy: ${adaptedOptions.failurePatterns?.getRecommendedStrategy(lastError).strategy ?? 'default'})`
      );

      // Call retry callback
      adaptedOptions.onRetry(lastError, attempt, delay);

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // All attempts failed
  return {
    success: false,
    error: lastError ?? new Error('All retry attempts failed'),
    attempts: adaptedOptions.maxAttempts,
    totalDuration: Date.now() - startTime,
  };
}

/**
 * Retry decorator for class methods
 */
export function Retry(options: RetryOptions = {}) {
  return function (
    _target: unknown,
    _propertyKey: string | symbol,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor {
    const originalMethod = descriptor.value as (...args: unknown[]) => Promise<unknown>;

    descriptor.value = async function (...args: unknown[]): Promise<unknown> {
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
        throw new Error(
          'Circuit breaker is open - operation blocked to prevent cascading failures'
        );
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
