/**
 * Standardized CLI command patterns and utilities
 *
 * This module provides consistent patterns for CLI command implementation,
 * reducing code duplication and improving maintainability.
 */

import { ora } from '../../utils/common-imports';
import { displayConfigurationSources } from '../../utils/config-display';
import {
  loadStandardConfiguration,
  getParentOptions,
  applyConfigToLogger,
  type StandardConfigResult,
  type StandardCliOptions,
  type ParentCommandOptions,
} from './config-loader';
import { executeCLICommand } from './error-handler';

/**
 * Standard command execution context
 */
export interface CommandContext {
  projectPath: string;
  options: StandardCliOptions;
  parentOptions: ParentCommandOptions;
  config: StandardConfigResult;
}

/**
 * Command execution options
 */
export interface CommandExecutionOptions {
  /** Whether to show configuration sources if requested */
  showConfigSources?: boolean;
  /** Whether to validate configuration before execution */
  validateConfig?: boolean;
  /** Whether to exit on configuration validation errors */
  exitOnConfigError?: boolean;
  /** Whether to apply configuration to logger */
  applyConfigToLogger?: boolean;
  /** Loading spinner text */
  loadingText?: string;
  /** Command name for error reporting */
  commandName?: string;
}

/**
 * Command execution result
 */
export interface CommandExecutionResult<T = unknown> {
  success: boolean;
  result?: T;
  error?: Error;
  context: CommandContext;
}

/**
 * Standardized command execution wrapper
 * Handles configuration loading, validation, and error handling consistently
 */
export async function executeCommand<T>(
  projectPath: string,
  options: StandardCliOptions,
  command: any | undefined,
  operation: (context: CommandContext) => Promise<T>,
  executionOptions: CommandExecutionOptions = {}
): Promise<CommandExecutionResult<T>> {
  const {
    showConfigSources = true,
    validateConfig = true,
    exitOnConfigError = true,
    applyConfigToLogger: applyConfig = true,
    loadingText = 'Loading configuration...',
    commandName = 'command',
  } = executionOptions;

  const spinner = ora(loadingText).start();

  try {
    // Get parent options with type safety
    const parentOptions = getParentOptions(command);

    // Load configuration with standardized handling
    const configResult = await loadStandardConfiguration(projectPath, {
      customConfigPath: options.config || undefined,
      cliArgs: options,
      validateConfig,
      exitOnValidationError: exitOnConfigError,
      logValidationWarnings: true,
    });

    // Apply configuration to logger if requested
    if (applyConfig) {
      applyConfigToLogger(configResult);
    }

    // Show configuration sources if requested
    if (showConfigSources && parentOptions.showConfigSources) {
      spinner.stop();
      displayConfigurationSources(configResult.config);
      return {
        success: true,
        context: {
          projectPath,
          options,
          parentOptions,
          config: configResult,
        },
      };
    }

    // Create command context
    const context: CommandContext = {
      projectPath,
      options,
      parentOptions,
      config: configResult,
    };

    // Execute the command operation
    spinner.stop();
    const result = await executeCLICommand(commandName, () => operation(context));

    return {
      success: true,
      result,
      context,
    };
  } catch (error) {
    spinner.stop();
    const cliError = error instanceof Error ? error : new Error(String(error));

    return {
      success: false,
      error: cliError,
      context: {
        projectPath,
        options,
        parentOptions: getParentOptions(command),
        config: {} as StandardConfigResult, // Empty config on error
      },
    };
  }
}

/**
 * Standardized configuration-only command execution
 * For commands that only need configuration loading and display
 */
export async function executeConfigCommand(
  projectPath: string,
  options: StandardCliOptions,
  command: { parent?: { opts: () => Record<string, unknown> } } | undefined,
  operation: (context: CommandContext) => Promise<void>,
  executionOptions: CommandExecutionOptions = {}
): Promise<void> {
  const result = await executeCommand(projectPath, options, command, operation, executionOptions);

  if (!result.success && result.error) {
    throw result.error;
  }
}

/**
 * Standardized validation command execution
 * For commands that need configuration validation with custom error handling
 */
export async function executeValidationCommand(
  projectPath: string,
  options: StandardCliOptions,
  command: { parent?: { opts: () => Record<string, unknown> } } | undefined,
  operation: (context: CommandContext) => Promise<void>,
  executionOptions: CommandExecutionOptions = {}
): Promise<void> {
  const customOptions: CommandExecutionOptions = {
    validateConfig: true,
    exitOnConfigError: true,
    applyConfigToLogger: true,
    ...executionOptions,
  };

  await executeConfigCommand(projectPath, options, command, operation, customOptions);
}

/**
 * Standardized file operation command execution
 * For commands that work with files and need consistent error handling
 */
export async function executeFileCommand<T>(
  projectPath: string,
  options: StandardCliOptions,
  command: { parent?: { opts: () => Record<string, unknown> } } | undefined,
  operation: (context: CommandContext) => Promise<T>,
  executionOptions: CommandExecutionOptions = {}
): Promise<T> {
  const customOptions: CommandExecutionOptions = {
    validateConfig: true,
    exitOnConfigError: false, // Allow graceful handling of file errors
    applyConfigToLogger: true,
    ...executionOptions,
  };

  const result = await executeCommand(projectPath, options, command, operation, customOptions);

  if (!result.success) {
    throw result.error || new Error('File operation failed');
  }

  return result.result as T;
}

/**
 * Create standardized command options interface
 * Generates consistent option interfaces for commands
 */
export function createCommandOptions<T extends Record<string, unknown>>(
  baseOptions: T
): T & StandardCliOptions {
  return Object.assign({}, baseOptions, {
    verbose: false as boolean | undefined,
    debug: false as boolean | undefined,
    quiet: false as boolean | undefined,
  }) as T & StandardCliOptions;
}

/**
 * Validate project path with standardized error handling
 */
export function validateProjectPath(projectPath: string): void {
  if (!projectPath) {
    throw new Error('Project path is required');
  }

  if (typeof projectPath !== 'string') {
    throw new Error('Project path must be a string');
  }

  if (projectPath.trim() === '') {
    throw new Error('Project path cannot be empty');
  }
}

/**
 * Get spinner for consistent loading indicators
 */
export function getCommandSpinner(text: string) {
  return ora(text);
}

/**
 * Command pattern for simple operations
 * Reduces boilerplate for commands that just need configuration and a simple operation
 */
export async function simpleCommand<T>(
  projectPath: string,
  options: StandardCliOptions,
  command: { parent?: { opts: () => Record<string, unknown> } } | undefined,
  operation: (context: CommandContext) => Promise<T>,
  commandName: string = 'operation'
): Promise<T> {
  validateProjectPath(projectPath);

  return await executeFileCommand(projectPath, options, command, operation, {
    commandName,
    loadingText: `Executing ${commandName}...`,
  });
}

/**
 * Command pattern for analysis operations
 * Specialized pattern for commands that analyze projects
 */
export async function analysisCommand<T>(
  projectPath: string,
  options: StandardCliOptions,
  command: { parent?: { opts: () => Record<string, unknown> } } | undefined,
  operation: (context: CommandContext) => Promise<T>,
  commandName: string = 'analysis'
): Promise<T> {
  validateProjectPath(projectPath);

  return await executeCommand(projectPath, options, command, operation, {
    commandName,
    loadingText: `Analyzing project...`,
    showConfigSources: true,
    validateConfig: true,
    exitOnConfigError: true,
  }).then((result) => {
    if (!result.success) {
      throw result.error || new Error('Analysis failed');
    }
    return result.result as T;
  });
}

/**
 * Command pattern for generation operations
 * Specialized pattern for commands that generate files or content
 */
export async function generationCommand<T>(
  projectPath: string,
  options: StandardCliOptions,
  command: { parent?: { opts: () => Record<string, unknown> } } | undefined,
  operation: (context: CommandContext) => Promise<T>,
  commandName: string = 'generation'
): Promise<T> {
  validateProjectPath(projectPath);

  return await executeCommand(projectPath, options, command, operation, {
    commandName,
    loadingText: `Generating ${commandName}...`,
    showConfigSources: true,
    validateConfig: true,
    exitOnConfigError: true,
  }).then((result) => {
    if (!result.success) {
      throw result.error || new Error('Generation failed');
    }
    return result.result as T;
  });
}
