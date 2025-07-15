/**
 * Standardized CLI configuration loading utilities
 *
 * This module provides consistent configuration loading patterns across all CLI commands,
 * eliminating the inconsistencies identified in the CLI command analysis.
 */

import { logger } from '../../utils/common-imports';
import {
  ConfigurationService,
  type ConfigurationLoadResult,
} from '../../config/ConfigurationService';
import type { CliArguments } from '../../config/ConfigurationService';

/**
 * Standardized interface for CLI command options
 */
export interface StandardCliOptions {
  config?: string;
  verbose?: boolean;
  debug?: boolean;
  quiet?: boolean;
  [key: string]: string | number | boolean | string[] | undefined;
}

/**
 * Type-safe interface for parent command options
 */
export interface ParentCommandOptions {
  showConfigSources?: boolean;
  [key: string]: string | number | boolean | undefined;
}

/**
 * Configuration loading result with standardized error handling
 */
export interface StandardConfigResult {
  config: ConfigurationLoadResult;
  isValid: boolean;
  hasWarnings: boolean;
  warnings: string[];
  errors: string[];
}

/**
 * Configuration loading options for commands
 */
export interface ConfigLoadOptions {
  /** Custom configuration file path */
  customConfigPath?: string | undefined;
  /** CLI arguments to merge into configuration */
  cliArgs?: CliArguments;
  /** Whether to include environment variables */
  includeEnvVars?: boolean;
  /** Whether to include user configuration */
  includeUserConfig?: boolean;
  /** Whether to validate configuration before returning */
  validateConfig?: boolean;
  /** Whether to exit process on validation errors */
  exitOnValidationError?: boolean;
  /** Whether to log warnings for validation issues */
  logValidationWarnings?: boolean;
}

/**
 * Load configuration with standardized error handling and validation
 */
export async function loadStandardConfiguration(
  projectPath: string,
  options: ConfigLoadOptions = {}
): Promise<StandardConfigResult> {
  const {
    customConfigPath,
    cliArgs,
    includeEnvVars = true,
    includeUserConfig = true,
    validateConfig = true,
    exitOnValidationError = false,
    logValidationWarnings = true,
  } = options;

  try {
    // Create configuration service with standardized options
    const configService = new ConfigurationService({
      projectPath,
      ...(customConfigPath && { customConfigPath }),
      includeEnvVars,
      includeUserConfig,
      ...(cliArgs && { cliArgs }),
    });

    // Load configuration
    const configResult = await configService.loadConfiguration();

    // Collect warnings and errors
    const warnings: string[] = [];
    const errors: string[] = [];

    if (validateConfig && !configResult.valid) {
      // Collect all validation issues
      configResult.sources.forEach((source) => {
        warnings.push(...source.warnings);
        errors.push(...source.errors);
      });

      // Add general validation warnings
      if (configResult.warnings) {
        warnings.push(...configResult.warnings);
      }

      // Handle validation errors based on strategy
      if (exitOnValidationError && errors.length > 0) {
        logger.error('Configuration validation failed:', errors);
        process.exit(1);
      }

      // Log warnings if requested
      if (logValidationWarnings && warnings.length > 0) {
        logger.warn('Configuration validation warnings:', warnings);
      }
    }

    return {
      config: configResult,
      isValid: configResult.valid,
      hasWarnings: warnings.length > 0,
      warnings,
      errors,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown configuration error';
    logger.error('Failed to load configuration:', errorMessage);

    if (exitOnValidationError) {
      process.exit(1);
    }

    throw error;
  }
}

/**
 * Get parent command options with type safety
 */
export function getParentOptions(command?: {
  parent?: { opts: () => Record<string, unknown> };
}): ParentCommandOptions {
  if (!command?.parent?.opts) {
    return {};
  }

  try {
    const parentOpts = command.parent.opts();

    // Type-safe extraction of known parent options
    const typedOptions: ParentCommandOptions = {};

    if (typeof parentOpts.showConfigSources === 'boolean') {
      typedOptions.showConfigSources = parentOpts.showConfigSources;
    }

    // Add other known parent options with type checking
    Object.entries(parentOpts).forEach(([key, value]) => {
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        typedOptions[key] = value;
      }
    });

    return typedOptions;
  } catch (error) {
    logger.debug('Failed to get parent options:', error);
    return {};
  }
}

/**
 * Standardized configuration service factory
 * Reduces redundant instantiation patterns across commands
 */
export function createConfigurationService(
  projectPath: string,
  options: ConfigLoadOptions = {}
): ConfigurationService {
  const { customConfigPath, cliArgs, includeEnvVars = true, includeUserConfig = true } = options;

  return new ConfigurationService({
    projectPath,
    ...(customConfigPath && { customConfigPath }),
    includeEnvVars,
    includeUserConfig,
    ...(cliArgs && { cliArgs }),
  });
}

/**
 * Standardized option validation for CLI commands
 */
export function validateCliOptions(
  options: StandardCliOptions,
  requiredOptions: string[] = []
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check for required options
  for (const required of requiredOptions) {
    if (!(required in options) || options[required] === undefined) {
      errors.push(`Missing required option: ${required}`);
    }
  }

  // Validate config file path if provided
  if (options.config && typeof options.config !== 'string') {
    errors.push('Configuration file path must be a string');
  }

  // Validate boolean options
  const booleanOptions = ['verbose', 'debug', 'quiet'];
  for (const boolOption of booleanOptions) {
    if (boolOption in options && typeof options[boolOption] !== 'boolean') {
      errors.push(`Option ${boolOption} must be a boolean`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Apply configuration to logger with standardized patterns
 */
export function applyConfigToLogger(_configResult: StandardConfigResult): void {
  // Apply logging configuration based on CLI flags
  // Note: The logger doesn't have a setLevel method, so we'll use info/debug/warn patterns

  // For now, we'll just use the existing logger as-is
  // This can be extended when a more sophisticated logging system is implemented
  logger.info('Configuration applied to logger');
}

/**
 * Legacy compatibility function
 * Provides the same interface as the existing loadCommandConfig for backward compatibility
 */
export async function loadCommandConfig(
  projectPath: string,
  options: Partial<{
    customConfigPath?: string;
    cliArgs?: CliArguments;
  }> = {}
): Promise<ConfigurationLoadResult> {
  const loadOptions: ConfigLoadOptions = {
    exitOnValidationError: false,
    logValidationWarnings: true,
  };

  if (options.customConfigPath !== undefined) {
    loadOptions.customConfigPath = options.customConfigPath;
  }

  if (options.cliArgs !== undefined) {
    loadOptions.cliArgs = options.cliArgs;
  }

  const standardResult = await loadStandardConfiguration(projectPath, loadOptions);

  return standardResult.config;
}
