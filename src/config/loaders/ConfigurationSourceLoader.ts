/**
 * Configuration source loader interfaces and types
 *
 * This module defines the common interfaces for configuration source loaders,
 * providing a consistent API for loading configuration from different sources.
 */

import type { PartialClaudeTestingConfig } from '../../types/config';

/**
 * Configuration source types
 */
export enum ConfigurationSourceType {
  CLI_ARGS = 'cli-args',
  ENV_VARS = 'env-vars',
  PROJECT_CONFIG = 'project-config',
  USER_CONFIG = 'user-config',
  DEFAULTS = 'defaults',
  CUSTOM_FILE = 'custom-file',
}

/**
 * Represents a configuration source with its data and metadata
 */
export interface ConfigurationSource {
  /** Type of configuration source */
  type: ConfigurationSourceType;
  /** Configuration data from this source */
  data: PartialClaudeTestingConfig;
  /** Path to configuration file (if applicable) */
  path?: string;
  /** Whether this source was successfully loaded */
  loaded: boolean;
  /** Any errors encountered loading this source */
  errors: string[];
  /** Warnings from configuration validation */
  warnings: string[];
  /** Load timestamp */
  loadedAt: Date;
}

/**
 * Result of loading a configuration source
 */
export interface ConfigurationSourceLoadResult {
  /** The configuration source that was loaded */
  source: ConfigurationSource;
  /** Whether the load operation was successful */
  success: boolean;
}

/**
 * Base interface for all configuration source loaders
 */
export interface ConfigurationSourceLoader {
  /** The type of configuration source this loader handles */
  readonly sourceType: ConfigurationSourceType;

  /**
   * Load configuration from this source
   * @returns Promise resolving to the load result
   */
  load(): Promise<ConfigurationSourceLoadResult>;

  /**
   * Check if this source is available/applicable
   * @returns Promise resolving to true if the source can be loaded
   */
  isAvailable(): Promise<boolean>;

  /**
   * Get a human-readable description of this source
   * @returns Description string
   */
  getDescription(): string;
}

/**
 * Base configuration source loader options
 */
export interface ConfigurationSourceLoaderOptions {
  /** Project path for context */
  projectPath: string;
}

/**
 * Abstract base class for configuration source loaders
 */
export abstract class BaseConfigurationSourceLoader implements ConfigurationSourceLoader {
  protected options: ConfigurationSourceLoaderOptions;

  constructor(options: ConfigurationSourceLoaderOptions) {
    this.options = options;
  }

  abstract readonly sourceType: ConfigurationSourceType;
  abstract load(): Promise<ConfigurationSourceLoadResult>;
  abstract isAvailable(): Promise<boolean>;
  abstract getDescription(): string;

  /**
   * Create a configuration source with error handling
   */
  protected createSource(
    data: PartialClaudeTestingConfig,
    loaded: boolean = true,
    errors: string[] = [],
    warnings: string[] = [],
    path?: string
  ): ConfigurationSource {
    const source: ConfigurationSource = {
      type: this.sourceType,
      data,
      loaded,
      errors,
      warnings,
      loadedAt: new Date(),
    };

    if (path !== undefined) {
      source.path = path;
    }

    return source;
  }

  /**
   * Create a successful load result
   */
  protected createSuccessResult(source: ConfigurationSource): ConfigurationSourceLoadResult {
    return {
      source,
      success: true,
    };
  }

  /**
   * Create a failed load result
   */
  protected createFailureResult(
    error: string,
    path?: string,
    data: PartialClaudeTestingConfig = {}
  ): ConfigurationSourceLoadResult {
    const source = this.createSource(data, false, [error], [], path);
    return {
      source,
      success: false,
    };
  }
}
