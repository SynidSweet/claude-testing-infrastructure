/**
 * Comprehensive error type definitions for the Claude Testing Infrastructure
 * Provides domain-specific error classes and type-safe error handling utilities
 */

import { ClaudeTestingError } from '../utils/error-handling';

/**
 * Configuration-related errors
 */
export class ConfigurationError extends ClaudeTestingError {
  constructor(
    message: string,
    public readonly configPath?: string,
    context: Record<string, unknown> = {}
  ) {
    super(message, { configPath, ...context });
    this.name = 'ConfigurationError';
    Object.setPrototypeOf(this, ConfigurationError.prototype);
  }
}

/**
 * CLI command errors
 */
export class CLIError extends ClaudeTestingError {
  constructor(
    message: string,
    public readonly commandName: string,
    public readonly exitCode: number = 1,
    context: Record<string, unknown> = {}
  ) {
    super(message, { commandName, exitCode, ...context });
    this.name = 'CLIError';
    Object.setPrototypeOf(this, CLIError.prototype);
  }
}

/**
 * Template-related errors
 */
export class TemplateError extends ClaudeTestingError {
  constructor(
    message: string,
    public readonly templateName: string,
    context: Record<string, unknown> = {}
  ) {
    super(message, { templateName, ...context });
    this.name = 'TemplateError';
    Object.setPrototypeOf(this, TemplateError.prototype);
  }
}

/**
 * Runner-related errors (Jest, pytest, etc.)
 */
export class RunnerError extends ClaudeTestingError {
  constructor(
    message: string,
    public readonly runnerType: string,
    public readonly exitCode?: number,
    context: Record<string, unknown> = {}
  ) {
    super(message, { runnerType, exitCode, ...context });
    this.name = 'RunnerError';
    Object.setPrototypeOf(this, RunnerError.prototype);
  }
}

/**
 * Service-related errors
 */
export class ServiceError extends ClaudeTestingError {
  constructor(
    message: string,
    public readonly serviceName: string,
    context: Record<string, unknown> = {}
  ) {
    super(message, { serviceName, ...context });
    this.name = 'ServiceError';
    Object.setPrototypeOf(this, ServiceError.prototype);
  }
}

/**
 * Parser-related errors
 */
export class ParserError extends ClaudeTestingError {
  constructor(
    message: string,
    public readonly parserType: string,
    public readonly inputData?: string,
    context: Record<string, unknown> = {}
  ) {
    super(message, { parserType, inputData: inputData?.substring(0, 200), ...context });
    this.name = 'ParserError';
    Object.setPrototypeOf(this, ParserError.prototype);
  }
}

/**
 * Factory-related errors
 */
export class FactoryError extends ClaudeTestingError {
  constructor(
    message: string,
    public readonly factoryType: string,
    public readonly requestedType?: string,
    context: Record<string, unknown> = {}
  ) {
    super(message, { factoryType, requestedType, ...context });
    this.name = 'FactoryError';
    Object.setPrototypeOf(this, FactoryError.prototype);
  }
}

/**
 * Type guard to check if an error is a ClaudeTestingError or its subclass
 */
export function isClaudeTestingError(error: unknown): error is ClaudeTestingError {
  return error instanceof ClaudeTestingError;
}

/**
 * Type guard for configuration errors
 */
export function isConfigurationError(error: unknown): error is ConfigurationError {
  return error instanceof ConfigurationError;
}

/**
 * Type guard for CLI errors
 */
export function isCLIError(error: unknown): error is CLIError {
  return error instanceof CLIError;
}

/**
 * Type guard for template errors
 */
export function isTemplateError(error: unknown): error is TemplateError {
  return error instanceof TemplateError;
}

/**
 * Type guard for runner errors
 */
export function isRunnerError(error: unknown): error is RunnerError {
  return error instanceof RunnerError;
}

/**
 * Type guard for service errors
 */
export function isServiceError(error: unknown): error is ServiceError {
  return error instanceof ServiceError;
}

/**
 * Type guard for parser errors
 */
export function isParserError(error: unknown): error is ParserError {
  return error instanceof ParserError;
}

/**
 * Type guard for factory errors
 */
export function isFactoryError(error: unknown): error is FactoryError {
  return error instanceof FactoryError;
}

/**
 * Type guard for Node.js system errors
 */
export function isNodeSystemError(error: unknown): error is NodeJS.ErrnoException {
  return (
    error instanceof Error &&
    'code' in error &&
    typeof (error as NodeJS.ErrnoException).code === 'string' &&
    'errno' in error &&
    'syscall' in error
  );
}

/**
 * Safe error message extraction with type narrowing
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message);
  }
  return String(error);
}

/**
 * Safe error stack extraction
 */
export function getErrorStack(error: unknown): string | undefined {
  if (error instanceof Error && error.stack) {
    return error.stack;
  }
  return undefined;
}

/**
 * Extract error code from various error types
 */
export function getErrorCode(error: unknown): string | undefined {
  if (isNodeSystemError(error)) {
    return error.code;
  }
  if (error && typeof error === 'object' && 'code' in error) {
    return String(error.code);
  }
  return undefined;
}

/**
 * Comprehensive error context extraction
 */
export function extractErrorContext(error: unknown): Record<string, unknown> {
  const context: Record<string, unknown> = {};

  // Extract message
  context.message = getErrorMessage(error);

  // Extract stack if available
  const stack = getErrorStack(error);
  if (stack) {
    context.stack = stack;
  }

  // Extract code if available
  const code = getErrorCode(error);
  if (code) {
    context.code = code;
  }

  // Extract ClaudeTestingError context
  if (isClaudeTestingError(error)) {
    Object.assign(context, error.context);
  }

  // Extract Node.js error properties
  if (isNodeSystemError(error)) {
    context.errno = error.errno;
    context.syscall = error.syscall;
    if (error.path) context.path = error.path;
  }

  return context;
}

/**
 * Type-safe error wrapping utility
 */
export function wrapError(
  error: unknown,
  ErrorClass: typeof ClaudeTestingError,
  message: string,
  additionalContext?: Record<string, unknown>
): ClaudeTestingError {
  const context = {
    ...extractErrorContext(error),
    originalError: error,
    ...additionalContext,
  };

  return new ErrorClass(message, context);
}

/**
 * Error chain utility for nested error contexts
 */
export class ErrorChain {
  private errors: Array<{ error: unknown; context: Record<string, unknown> }> = [];

  add(error: unknown, context?: Record<string, unknown>): this {
    this.errors.push({ error, context: context ?? {} });
    return this;
  }

  toError(ErrorClass: typeof ClaudeTestingError, message: string): ClaudeTestingError {
    const context: Record<string, unknown> = {
      errorChain: this.errors.map((e) => ({
        message: getErrorMessage(e.error),
        context: e.context,
      })),
    };

    if (this.errors.length > 0) {
      const lastError = this.errors[this.errors.length - 1];
      if (lastError) {
        context.originalError = lastError.error;
      }
    }

    return new ErrorClass(message, context);
  }
}

/**
 * Result type for type-safe error handling
 */
export type ErrorResult<T, E = Error> = { success: true; value: T } | { success: false; error: E };

/**
 * Create a success result
 */
export function ok<T>(value: T): ErrorResult<T, never> {
  return { success: true, value };
}

/**
 * Create an error result
 */
export function err<E = Error>(error: E): ErrorResult<never, E> {
  return { success: false, error };
}

/**
 * Type guard for success results
 */
export function isOk<T, E>(result: ErrorResult<T, E>): result is { success: true; value: T } {
  return result.success === true;
}

/**
 * Type guard for error results
 */
export function isErr<T, E>(result: ErrorResult<T, E>): result is { success: false; error: E } {
  return result.success === false;
}

/**
 * Try-catch wrapper that returns a ErrorResult type
 */
export function trySync<T>(fn: () => T): ErrorResult<T, Error> {
  try {
    return ok(fn());
  } catch (error) {
    return err(error instanceof Error ? error : new Error(String(error)));
  }
}

/**
 * Async try-catch wrapper that returns a ErrorResult type
 */
export async function tryAsync<T>(fn: () => Promise<T>): Promise<ErrorResult<T, Error>> {
  try {
    return ok(await fn());
  } catch (error) {
    return err(error instanceof Error ? error : new Error(String(error)));
  }
}

/**
 * Map over a successful result
 */
export function mapResult<T, U, E>(
  result: ErrorResult<T, E>,
  fn: (value: T) => U
): ErrorResult<U, E> {
  if (isOk(result)) {
    return ok(fn(result.value));
  }
  return result;
}

/**
 * Map over an error result
 */
export function mapError<T, E, F>(
  result: ErrorResult<T, E>,
  fn: (error: E) => F
): ErrorResult<T, F> {
  if (isErr(result)) {
    return err(fn(result.error));
  }
  return result;
}

/**
 * Unwrap a result or throw
 */
export function unwrap<T, E>(result: ErrorResult<T, E>): T {
  if (isOk(result)) {
    return result.value;
  }
  throw result.error;
}

/**
 * Unwrap a result or return a default value
 */
export function unwrapOr<T, E>(result: ErrorResult<T, E>, defaultValue: T): T {
  if (isOk(result)) {
    return result.value;
  }
  return defaultValue;
}

/**
 * Export all error classes for convenience
 */
export * from '../utils/error-handling';
export * from './ai-error-types';
export * from './async-test-types';
export * from './timer-types';
