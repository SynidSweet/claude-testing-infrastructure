/**
 * Standardized error handling utilities for Claude Testing Infrastructure
 * Provides consistent error classes and wrapper functions to eliminate code duplication
 */

import { logger } from './common-imports';

/**
 * Base error class with context information
 */
export class ClaudeTestingError extends Error {
  public readonly context: Record<string, unknown>;
  public readonly timestamp: string;

  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message);
    this.name = this.constructor.name;
    this.context = context;
    this.timestamp = new Date().toISOString();

    // Ensure proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, ClaudeTestingError.prototype);
  }
}

/**
 * Error for analysis operations (project analysis, gap analysis, etc.)
 */
export class AnalysisError extends ClaudeTestingError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, context);
    Object.setPrototypeOf(this, AnalysisError.prototype);
  }
}

/**
 * Error for file operations (read, write, stat, etc.)
 */
export class FileOperationError extends ClaudeTestingError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, context);
    Object.setPrototypeOf(this, FileOperationError.prototype);
  }
}

/**
 * Error for validation operations (config validation, path validation, etc.)
 */
export class ValidationError extends ClaudeTestingError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, context);
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * Error for test generation operations
 */
export class GenerationError extends ClaudeTestingError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, context);
    Object.setPrototypeOf(this, GenerationError.prototype);
  }
}

/**
 * Error for test execution operations
 */
export class TestExecutionError extends ClaudeTestingError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, context);
    Object.setPrototypeOf(this, TestExecutionError.prototype);
  }
}

/**
 * Wrapper for file operations that provides consistent error handling
 */
export async function handleFileOperation<T>(
  operation: () => Promise<T>,
  description: string,
  filePath?: string
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    const context: Record<string, unknown> = { originalError: error };
    if (filePath) {
      context.filePath = filePath;
    }

    logger.error(`File operation failed: ${description}`, context);
    throw new FileOperationError(`Failed ${description}`, context);
  }
}

/**
 * Wrapper for analysis operations that provides consistent error handling
 */
export async function handleAnalysisOperation<T>(
  operation: () => Promise<T>,
  description: string,
  projectPath?: string
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    // Capture error details more effectively
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    const context: Record<string, unknown> = {
      originalError: error,
      errorMessage,
      errorStack,
    };
    if (projectPath) {
      context.projectPath = projectPath;
    }

    logger.error(`Analysis operation failed: ${description}`, context);
    // Include the actual error message in the thrown error
    const fullMessage = `Failed ${description}: ${errorMessage}`;
    throw new AnalysisError(fullMessage, context);
  }
}

/**
 * Wrapper for validation operations that provides consistent error handling
 */
export async function handleValidation<T>(
  operation: () => Promise<T>,
  description: string,
  validationTarget?: string
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    const context: Record<string, unknown> = { originalError: error };
    if (validationTarget) {
      context.validationTarget = validationTarget;
    }

    logger.error(`Validation failed: ${description}`, context);
    throw new ValidationError(`Validation failed: ${description}`, context);
  }
}

/**
 * Wrapper for test generation operations that provides consistent error handling
 */
export async function handleGenerationOperation<T>(
  operation: () => Promise<T>,
  description: string,
  generationContext?: Record<string, unknown>
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    const context: Record<string, unknown> = {
      originalError: error,
      ...generationContext,
    };

    logger.error(`Generation operation failed: ${description}`, context);
    throw new GenerationError(`Failed ${description}`, context);
  }
}

/**
 * Wrapper for test execution operations that provides consistent error handling
 */
export async function handleTestExecution<T>(
  operation: () => Promise<T>,
  description: string,
  executionContext?: Record<string, unknown>
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    const context: Record<string, unknown> = {
      originalError: error,
      ...executionContext,
    };

    logger.error(`Test execution failed: ${description}`, context);
    throw new TestExecutionError(`Failed ${description}`, context);
  }
}

/**
 * Synchronous wrapper for validation operations
 */
export function handleValidationSync<T>(
  operation: () => T,
  description: string,
  validationTarget?: string
): T {
  try {
    return operation();
  } catch (error) {
    const context: Record<string, unknown> = { originalError: error };
    if (validationTarget) {
      context.validationTarget = validationTarget;
    }

    logger.error(`Validation failed: ${description}`, context);
    throw new ValidationError(`Validation failed: ${description}`, context);
  }
}

/**
 * Utility to check if an error is a specific Claude Testing error type
 */
export function isClaudeTestingError(error: unknown): error is ClaudeTestingError {
  return error instanceof ClaudeTestingError;
}

/**
 * Utility to extract context from Claude Testing errors
 */
export function getErrorContext(error: unknown): Record<string, unknown> {
  if (isClaudeTestingError(error)) {
    return error.context;
  }
  return {};
}

/**
 * Utility to format error messages with context for display
 */
export function formatErrorMessage(error: unknown): string {
  if (isClaudeTestingError(error)) {
    // Check if we have the original error message in context
    const errorMessage = error.context.errorMessage as string;
    if (errorMessage && errorMessage !== error.message) {
      return errorMessage;
    }

    const contextInfo =
      Object.keys(error.context).length > 0 ? ` (${Object.keys(error.context).join(', ')})` : '';
    return `${error.message}${contextInfo}`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
