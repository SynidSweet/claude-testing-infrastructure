/**
 * Standardized CLI error handling utilities
 *
 * This module provides consistent error handling patterns across all CLI commands,
 * building on the existing error handling infrastructure.
 */

import { chalk, logger } from '../../utils/common-imports';
import { handleCLIError, type CLIErrorOptions } from '../../utils/error-handling';

/**
 * Standardized CLI error types
 */
export enum CLIErrorType {
  CONFIGURATION_ERROR = 'configuration-error',
  VALIDATION_ERROR = 'validation-error',
  FILE_NOT_FOUND = 'file-not-found',
  PERMISSION_ERROR = 'permission-error',
  OPERATION_FAILED = 'operation-failed',
  INVALID_ARGUMENT = 'invalid-argument',
  NETWORK_ERROR = 'network-error',
  TIMEOUT_ERROR = 'timeout-error',
}

/**
 * Base CLI error context interface
 */
export interface CLIErrorContext {
  operation?: string;
  projectPath?: string;
  details?: Record<string, unknown>;
}

/**
 * Extended CLI error context with standardized fields
 */
export interface StandardCLIErrorContext extends CLIErrorContext {
  errorType: CLIErrorType;
  configPath?: string;
  suggestions?: string[];
  recoverable?: boolean;
}

/**
 * CLI error handling options
 */
export interface CLIErrorHandlingOptions extends CLIErrorOptions {
  /** Whether to include suggestions in error output */
  includeSuggestions?: boolean;
  /** Whether to log the error before exiting */
  logError?: boolean;
  /** Whether to show stack trace in verbose mode */
  showStackTrace?: boolean;
  /** Whether to exit immediately or return error info */
  exitImmediately?: boolean;
}

/**
 * Handle CLI configuration errors with standardized messaging
 */
export function handleConfigurationError(
  error: Error,
  context: {
    projectPath?: string;
    configPath?: string;
    suggestions?: string[];
  },
  options: CLIErrorHandlingOptions = {}
): never | { handled: true; error: Error } {
  const errorContext: StandardCLIErrorContext = {
    errorType: CLIErrorType.CONFIGURATION_ERROR,
    operation: 'configuration loading',
    ...context,
    details: {
      message: error.message,
      stack: error.stack,
    },
  };

  const standardizedOptions: CLIErrorHandlingOptions = {
    exitCode: 1,
    logError: true,
    includeSuggestions: true,
    showStackTrace: false,
    exitImmediately: true,
    ...options,
  };

  return handleStandardError(error, errorContext, standardizedOptions);
}

/**
 * Handle CLI validation errors with standardized messaging
 */
export function handleValidationError(
  error: Error,
  context: {
    projectPath?: string;
    validationIssues?: string[];
    suggestions?: string[];
  },
  options: CLIErrorHandlingOptions = {}
): never | { handled: true; error: Error } {
  const errorContext: StandardCLIErrorContext = {
    errorType: CLIErrorType.VALIDATION_ERROR,
    operation: 'validation',
    ...context,
    details: {
      message: error.message,
      validationIssues: context.validationIssues,
    },
  };

  const standardizedOptions: CLIErrorHandlingOptions = {
    exitCode: 1,
    logError: true,
    includeSuggestions: true,
    exitImmediately: true,
    ...options,
  };

  return handleStandardError(error, errorContext, standardizedOptions);
}

/**
 * Handle CLI file operation errors with standardized messaging
 */
export function handleFileOperationError(
  error: Error,
  context: {
    projectPath?: string;
    filePath?: string;
    operation?: string;
    suggestions?: string[];
  },
  options: CLIErrorHandlingOptions = {}
): never | { handled: true; error: Error } {
  const errorContext: StandardCLIErrorContext = {
    errorType: CLIErrorType.FILE_NOT_FOUND,
    operation: context.operation || 'file operation',
    ...(context.projectPath !== undefined && { projectPath: context.projectPath }),
    details: {
      message: error.message,
      ...(context.filePath !== undefined && { filePath: context.filePath }),
    },
    suggestions: context.suggestions || [],
  };

  const standardizedOptions: CLIErrorHandlingOptions = {
    exitCode: 1,
    logError: true,
    includeSuggestions: true,
    exitImmediately: true,
    ...options,
  };

  return handleStandardError(error, errorContext, standardizedOptions);
}

/**
 * Handle CLI argument validation errors with standardized messaging
 */
export function handleArgumentValidationError(
  error: Error,
  context: {
    argument?: string;
    value?: string;
    suggestions?: string[];
  },
  options: CLIErrorHandlingOptions = {}
): never | { handled: true; error: Error } {
  const errorContext: StandardCLIErrorContext = {
    errorType: CLIErrorType.INVALID_ARGUMENT,
    operation: 'argument validation',
    details: {
      message: error.message,
      argument: context.argument,
      value: context.value,
    },
    suggestions: context.suggestions || [],
  };

  const standardizedOptions: CLIErrorHandlingOptions = {
    exitCode: 1,
    logError: true,
    includeSuggestions: true,
    exitImmediately: true,
    ...options,
  };

  return handleStandardError(error, errorContext, standardizedOptions);
}

/**
 * Central standardized error handler
 */
function handleStandardError(
  error: Error,
  context: StandardCLIErrorContext,
  options: CLIErrorHandlingOptions
): never | { handled: true; error: Error } {
  // Log error if requested
  if (options.logError) {
    logger.error(`CLI Error [${context.errorType}]:`, error.message);

    if (options.showStackTrace && error.stack) {
      logger.debug('Stack trace:', error.stack);
    }
  }

  // Display user-friendly error message
  displayErrorMessage(error, context, options);

  // Use existing handleCLIError for consistent behavior
  if (options.exitImmediately) {
    handleCLIError(error, context.operation || 'operation', options);
  }

  return { handled: true, error };
}

/**
 * Display formatted error message to user
 */
function displayErrorMessage(
  error: Error,
  context: StandardCLIErrorContext,
  options: CLIErrorHandlingOptions
): void {
  // Main error message
  console.error(chalk.red(`✗ ${getErrorTypeDisplay(context.errorType)} failed`));
  console.error(chalk.red(`  ${error.message}`));

  // Context information
  if (context.projectPath) {
    console.error(chalk.gray(`  Project: ${context.projectPath}`));
  }

  if (context.configPath) {
    console.error(chalk.gray(`  Config: ${context.configPath}`));
  }

  // Validation issues
  if (context.details?.validationIssues && Array.isArray(context.details.validationIssues)) {
    console.error(chalk.yellow('  Validation Issues:'));
    context.details.validationIssues.forEach((issue: string) => {
      console.error(chalk.yellow(`    - ${issue}`));
    });
  }

  // Suggestions
  if (options.includeSuggestions && context.suggestions && context.suggestions.length > 0) {
    console.error(chalk.cyan('  Suggestions:'));
    context.suggestions.forEach((suggestion) => {
      console.error(chalk.cyan(`    - ${suggestion}`));
    });
  }
}

/**
 * Get user-friendly display name for error type
 */
function getErrorTypeDisplay(errorType: CLIErrorType): string {
  switch (errorType) {
    case CLIErrorType.CONFIGURATION_ERROR:
      return 'Configuration loading';
    case CLIErrorType.VALIDATION_ERROR:
      return 'Validation';
    case CLIErrorType.FILE_NOT_FOUND:
      return 'File operation';
    case CLIErrorType.PERMISSION_ERROR:
      return 'Permission';
    case CLIErrorType.OPERATION_FAILED:
      return 'Operation';
    case CLIErrorType.INVALID_ARGUMENT:
      return 'Argument validation';
    case CLIErrorType.NETWORK_ERROR:
      return 'Network operation';
    case CLIErrorType.TIMEOUT_ERROR:
      return 'Timeout';
    default:
      return 'Command';
  }
}

/**
 * Wrap command execution with standardized error handling
 */
export async function executeCLICommand<T>(
  commandName: string,
  operation: () => Promise<T>,
  errorContext: Partial<StandardCLIErrorContext> = {}
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    const cliError = error instanceof Error ? error : new Error(String(error));

    const context: StandardCLIErrorContext = {
      errorType: CLIErrorType.OPERATION_FAILED,
      operation: commandName,
      ...errorContext,
    };

    handleStandardError(cliError, context, {
      exitCode: 1,
      logError: true,
      includeSuggestions: true,
      exitImmediately: true,
    });

    // This line should never be reached due to process.exit in handleStandardError
    throw cliError;
  }
}

/**
 * Create standardized error with context
 */
export function createCLIError(
  message: string,
  type: CLIErrorType,
  context: Partial<StandardCLIErrorContext> = {}
): Error {
  const error = new Error(message);

  // Add context as non-enumerable property
  Object.defineProperty(error, 'cliContext', {
    value: {
      errorType: type,
      ...context,
    },
    enumerable: false,
    configurable: true,
  });

  return error;
}
