/**
 * Type-safe error handling utilities and guards
 * Provides consistent patterns for catch blocks and error handling
 */

import {
  ClaudeTestingError,
  AnalysisError,
  FileOperationError,
  ValidationError,
  GenerationError,
  TestExecutionError,
} from './error-handling';

import {
  AIError,
  AIAuthenticationError,
  AITimeoutError,
  AIRateLimitError,
  AINetworkError,
  isNodeError,
} from '../types/ai-error-types';

import {
  ConfigurationError,
  CLIError,
  TemplateError,
  RunnerError,
  ServiceError,
  ParserError,
  FactoryError,
  getErrorMessage,
  getErrorStack,
  getErrorCode,
  extractErrorContext,
} from '../types/error-types';

/**
 * Comprehensive error handler for catch blocks
 * Ensures proper typing and consistent error handling
 */
export function handleError(error: unknown): ClaudeTestingError {
  // Already a ClaudeTestingError
  if (error instanceof ClaudeTestingError) {
    return error;
  }

  // Standard Error
  if (error instanceof Error) {
    return new ClaudeTestingError(error.message, {
      originalError: error,
      stack: error.stack,
      name: error.name,
    });
  }

  // String error
  if (typeof error === 'string') {
    return new ClaudeTestingError(error);
  }

  // Object with message
  if (error && typeof error === 'object' && 'message' in error) {
    return new ClaudeTestingError(String(error.message), {
      originalError: error,
    });
  }

  // Unknown error
  return new ClaudeTestingError('An unknown error occurred', {
    originalError: error,
    errorType: typeof error,
  });
}

/**
 * Type-safe error handler with domain-specific error creation
 */
export function handleDomainError(
  error: unknown,
  domain:
    | 'analysis'
    | 'file'
    | 'validation'
    | 'generation'
    | 'execution'
    | 'configuration'
    | 'cli'
    | 'template'
    | 'runner'
    | 'service'
    | 'parser'
    | 'factory'
    | 'ai',
  context?: Record<string, unknown>
): ClaudeTestingError {
  const errorContext = {
    ...extractErrorContext(error),
    ...context,
  };

  const message = getErrorMessage(error);

  switch (domain) {
    case 'analysis':
      return new AnalysisError(message, errorContext);
    case 'file':
      return new FileOperationError(message, errorContext);
    case 'validation':
      return new ValidationError(message, errorContext);
    case 'generation':
      return new GenerationError(message, errorContext);
    case 'execution':
      return new TestExecutionError(message, errorContext);
    case 'configuration':
      return new ConfigurationError(message, undefined, errorContext);
    case 'cli':
      return new CLIError(message, (context?.commandName as string) ?? 'unknown', 1, errorContext);
    case 'template':
      return new TemplateError(
        message,
        (context?.templateName as string) ?? 'unknown',
        errorContext
      );
    case 'runner':
      return new RunnerError(
        message,
        (context?.runnerType as string) || 'unknown',
        undefined,
        errorContext
      );
    case 'service':
      return new ServiceError(message, (context?.serviceName as string) || 'unknown', errorContext);
    case 'parser':
      return new ParserError(
        message,
        (context?.parserType as string) || 'unknown',
        undefined,
        errorContext
      );
    case 'factory':
      return new FactoryError(
        message,
        (context?.factoryType as string) || 'unknown',
        undefined,
        errorContext
      );
    case 'ai':
      return new AIError(message, 'AI_GENERAL_ERROR', errorContext);
    default:
      return new ClaudeTestingError(message, errorContext);
  }
}

/**
 * Safe error logging with type safety
 */
export function logError(
  error: unknown,
  logger: { error: (msg: string, ctx?: Record<string, unknown>) => void },
  operation?: string
): void {
  const message = getErrorMessage(error);
  const context = extractErrorContext(error);

  if (operation) {
    logger.error(`${operation}: ${message}`, context);
  } else {
    logger.error(message, context);
  }
}

/**
 * Type-safe wrapper for async operations
 */
export async function safeAsync<T>(
  operation: () => Promise<T>,
  domain: Parameters<typeof handleDomainError>[1],
  context?: Record<string, unknown>
): Promise<T> {
  try {
    return await operation();
  } catch (error: unknown) {
    throw handleDomainError(error, domain, context);
  }
}

/**
 * Type-safe wrapper for sync operations
 */
export function safeSync<T>(
  operation: () => T,
  domain: Parameters<typeof handleDomainError>[1],
  context?: Record<string, unknown>
): T {
  try {
    return operation();
  } catch (error: unknown) {
    throw handleDomainError(error, domain, context);
  }
}

/**
 * Check if error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  // AI errors that are retryable
  if (
    error instanceof AITimeoutError ||
    error instanceof AINetworkError ||
    error instanceof AIRateLimitError
  ) {
    return true;
  }

  // Node.js errors that are retryable
  if (isNodeError(error)) {
    const retryableCodes = ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNREFUSED', 'EPIPE'];
    return retryableCodes.includes(error.code ?? '');
  }

  return false;
}

/**
 * Check if error is authentication related
 */
export function isAuthError(error: unknown): boolean {
  return (
    error instanceof AIAuthenticationError ||
    (isNodeError(error) && error.code === 'EACCES') ||
    (error instanceof Error && error.message.toLowerCase().includes('auth'))
  );
}

/**
 * Check if error is file system related
 */
export function isFileSystemError(error: unknown): boolean {
  if (error instanceof FileOperationError) {
    return true;
  }

  if (isNodeError(error)) {
    const fsCodes = ['ENOENT', 'EACCES', 'EISDIR', 'ENOTDIR', 'EMFILE', 'ENOSPC'];
    return fsCodes.includes(error.code ?? '');
  }

  return false;
}

/**
 * Enhanced error context for debugging
 */
export function enrichErrorContext(
  error: unknown,
  additionalContext: Record<string, unknown>
): Record<string, unknown> {
  const baseContext = extractErrorContext(error);

  return {
    ...baseContext,
    ...additionalContext,
    timestamp: new Date().toISOString(),
    environment: {
      nodeVersion: process.version,
      platform: process.platform,
      cwd: process.cwd(),
    },
  };
}

/**
 * Error categorization for better handling
 */
export type ErrorCategory = 'user' | 'system' | 'network' | 'validation' | 'unknown';

export function categorizeError(error: unknown): ErrorCategory {
  if (error instanceof ValidationError || error instanceof ConfigurationError) {
    return 'validation';
  }

  if (isRetryableError(error) || error instanceof AINetworkError) {
    return 'network';
  }

  if (isFileSystemError(error) || isNodeError(error)) {
    return 'system';
  }

  if (error instanceof CLIError || (error instanceof Error && error.message.includes('Invalid'))) {
    return 'user';
  }

  return 'unknown';
}

/**
 * Format error for user display
 */
export function formatErrorForDisplay(error: unknown, verbose = false): string {
  const message = getErrorMessage(error);
  const category = categorizeError(error);

  let displayMessage = message;

  // Add helpful context based on category
  switch (category) {
    case 'user':
      displayMessage = `Invalid input: ${message}`;
      break;
    case 'network':
      displayMessage = `Network error: ${message}. Please check your connection and try again.`;
      break;
    case 'system':
      displayMessage = `System error: ${message}`;
      break;
    case 'validation':
      displayMessage = `Configuration error: ${message}`;
      break;
  }

  if (verbose) {
    const stack = getErrorStack(error);
    const code = getErrorCode(error);

    if (code) {
      displayMessage += `\nError code: ${code}`;
    }

    if (stack) {
      displayMessage += `\n\nStack trace:\n${stack}`;
    }
  }

  return displayMessage;
}

/**
 * Aggregate multiple errors into a single error
 */
export class AggregateError extends ClaudeTestingError {
  constructor(
    message: string,
    public readonly errors: unknown[],
    context: Record<string, unknown> = {}
  ) {
    const errorDetails = errors.map((e, i) => ({
      index: i,
      message: getErrorMessage(e),
      type: e?.constructor?.name ?? typeof e,
    }));

    super(message, {
      errorCount: errors.length,
      errors: errorDetails,
      ...context,
    });

    this.name = 'AggregateError';
    Object.setPrototypeOf(this, AggregateError.prototype);
  }
}

/**
 * Create an aggregate error from multiple errors
 */
export function aggregateErrors(errors: unknown[], message?: string): AggregateError {
  const defaultMessage = `Multiple errors occurred (${errors.length} errors)`;
  return new AggregateError(message ?? defaultMessage, errors);
}

/**
 * Filter and handle multiple errors
 */
export function handleMultipleErrors(
  errors: unknown[],
  filter?: (error: unknown) => boolean
): ClaudeTestingError[] {
  const filteredErrors = filter ? errors.filter(filter) : errors;
  return filteredErrors.map((error) => handleError(error));
}
