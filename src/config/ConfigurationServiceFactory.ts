/**
 * Configuration Service Factory
 *
 * Factory pattern implementation for creating and coordinating configuration service modules.
 * This factory provides dependency injection and orchestration for the modularized configuration system.
 */

import { logger } from '../utils/common-imports';
import { ConfigurationSourceLoaderRegistry, type LoaderRegistryOptions } from './loaders';
import { EnvironmentVariableParser } from './EnvironmentVariableParser';
import { CliArgumentMapper } from './CliArgumentMapper';
import { ConfigurationMerger } from './ConfigurationMerger';
import type { ConfigurationServiceOptions } from './ConfigurationService';

/**
 * Options for configuring the factory
 */
export interface ConfigurationServiceFactoryOptions extends ConfigurationServiceOptions {
  /** Custom environment variable parser (for testing) */
  envParser?: EnvironmentVariableParser;
  /** Custom CLI argument mapper (for testing) */
  cliMapper?: CliArgumentMapper;
  /** Custom configuration merger (for testing) */
  merger?: ConfigurationMerger;
  /** Custom loader registry (for testing) */
  loaderRegistry?: ConfigurationSourceLoaderRegistry;
}

/**
 * Configuration modules bundle
 */
export interface ConfigurationModules {
  /** Loader registry for file-based configuration sources */
  loaderRegistry: ConfigurationSourceLoaderRegistry;
  /** Environment variable parser */
  envParser: EnvironmentVariableParser;
  /** CLI argument mapper */
  cliMapper: CliArgumentMapper;
  /** Configuration merger */
  merger: ConfigurationMerger;
}

/**
 * Factory for creating and coordinating configuration service modules
 */
export class ConfigurationServiceFactory {
  private readonly options: ConfigurationServiceFactoryOptions;

  constructor(options: ConfigurationServiceFactoryOptions) {
    this.options = {
      includeEnvVars: true,
      includeUserConfig: true,
      ...options,
    };
  }

  /**
   * Create all configuration modules with proper dependency injection
   */
  createModules(): ConfigurationModules {
    logger.debug('Creating configuration service modules');

    // Create loader registry
    const loaderRegistry = this.createLoaderRegistry();

    // Create environment variable parser
    const envParser = this.createEnvironmentVariableParser();

    // Create CLI argument mapper
    const cliMapper = this.createCliArgumentMapper();

    // Create configuration merger
    const merger = this.createConfigurationMerger();

    logger.debug('Configuration service modules created successfully');

    return {
      loaderRegistry,
      envParser,
      cliMapper,
      merger,
    };
  }

  /**
   * Create loader registry with project-specific options
   */
  private createLoaderRegistry(): ConfigurationSourceLoaderRegistry {
    if (this.options.loaderRegistry) {
      logger.debug('Using provided loader registry');
      return this.options.loaderRegistry;
    }

    const registryOptions: LoaderRegistryOptions = {
      projectPath: this.options.projectPath,
      includeUserConfig: this.options.includeUserConfig ?? true,
    };

    if (this.options.customConfigPath) {
      registryOptions.customConfigPath = this.options.customConfigPath;
    }

    logger.debug('Creating new loader registry', registryOptions);
    return new ConfigurationSourceLoaderRegistry(registryOptions);
  }

  /**
   * Create environment variable parser
   */
  private createEnvironmentVariableParser(): EnvironmentVariableParser {
    if (this.options.envParser) {
      logger.debug('Using provided environment variable parser');
      return this.options.envParser;
    }

    logger.debug('Creating new environment variable parser');
    return new EnvironmentVariableParser();
  }

  /**
   * Create CLI argument mapper
   */
  private createCliArgumentMapper(): CliArgumentMapper {
    if (this.options.cliMapper) {
      logger.debug('Using provided CLI argument mapper');
      return this.options.cliMapper;
    }

    logger.debug('Creating new CLI argument mapper');
    return new CliArgumentMapper();
  }

  /**
   * Create configuration merger
   */
  private createConfigurationMerger(): ConfigurationMerger {
    if (this.options.merger) {
      logger.debug('Using provided configuration merger');
      return this.options.merger;
    }

    logger.debug('Creating new configuration merger');
    return new ConfigurationMerger({ projectPath: this.options.projectPath });
  }

  /**
   * Get factory options (useful for testing)
   */
  getOptions(): ConfigurationServiceFactoryOptions {
    return { ...this.options };
  }

  /**
   * Create a new factory with different options
   */
  withOptions(
    newOptions: Partial<ConfigurationServiceFactoryOptions>
  ): ConfigurationServiceFactory {
    return new ConfigurationServiceFactory({
      ...this.options,
      ...newOptions,
    });
  }
}

/**
 * Convenience function to create configuration modules
 */
export function createConfigurationModules(
  projectPath: string,
  options: Partial<ConfigurationServiceFactoryOptions> = {}
): ConfigurationModules {
  const factory = new ConfigurationServiceFactory({
    projectPath,
    ...options,
  });

  return factory.createModules();
}

/**
 * Convenience function to create factory with minimal options
 */
export function createConfigurationServiceFactory(
  projectPath: string,
  options: Partial<ConfigurationServiceFactoryOptions> = {}
): ConfigurationServiceFactory {
  return new ConfigurationServiceFactory({
    projectPath,
    ...options,
  });
}
