/**
 * Configuration source loader registry
 *
 * Manages registration and access to configuration source loaders.
 * Provides a factory pattern for creating and coordinating loaders.
 */

import type {
  ConfigurationSourceLoader,
  ConfigurationSourceLoaderOptions,
} from './ConfigurationSourceLoader';
import { DefaultConfigurationLoader } from './DefaultConfigurationLoader';
import { UserConfigurationLoader } from './UserConfigurationLoader';
import { ProjectConfigurationLoader } from './ProjectConfigurationLoader';
import { CustomFileConfigurationLoader } from './CustomFileConfigurationLoader';

/**
 * Options for creating the loader registry
 */
export interface LoaderRegistryOptions extends ConfigurationSourceLoaderOptions {
  /** Whether to include user configuration loader */
  includeUserConfig?: boolean;
  /** Custom configuration file path (optional) */
  customConfigPath?: string;
}

/**
 * Registry for configuration source loaders
 */
export class ConfigurationSourceLoaderRegistry {
  private loaders: ConfigurationSourceLoader[] = [];
  private options: LoaderRegistryOptions;

  constructor(options: LoaderRegistryOptions) {
    this.options = {
      includeUserConfig: true,
      ...options,
    };
    this.initializeLoaders();
  }

  /**
   * Get all registered loaders in priority order (lowest to highest)
   */
  getLoaders(): ConfigurationSourceLoader[] {
    return [...this.loaders];
  }

  /**
   * Get a specific loader by its source type
   */
  getLoader(sourceType: string): ConfigurationSourceLoader | undefined {
    return this.loaders.find((loader) => loader.sourceType === sourceType);
  }

  /**
   * Get all available loaders (that can actually load configuration)
   */
  async getAvailableLoaders(): Promise<ConfigurationSourceLoader[]> {
    const availableLoaders: ConfigurationSourceLoader[] = [];

    for (const loader of this.loaders) {
      if (await loader.isAvailable()) {
        availableLoaders.push(loader);
      }
    }

    return availableLoaders;
  }

  /**
   * Load configuration from all registered loaders
   */
  async loadFromAllSources(): Promise<ConfigurationSourceLoader[]> {
    // Return all loaders for the caller to process
    // The actual loading will be handled by the calling code
    return this.getLoaders();
  }

  /**
   * Add a custom loader to the registry
   */
  addLoader(loader: ConfigurationSourceLoader): void {
    this.loaders.push(loader);
  }

  /**
   * Remove a loader from the registry
   */
  removeLoader(sourceType: string): boolean {
    const index = this.loaders.findIndex((loader) => loader.sourceType === sourceType);
    if (index !== -1) {
      this.loaders.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Initialize standard loaders based on options
   */
  private initializeLoaders(): void {
    // Load in reverse priority order (lowest to highest priority)

    // 1. Default configuration (lowest priority)
    this.loaders.push(new DefaultConfigurationLoader(this.options));

    // 2. User configuration (if enabled)
    if (this.options.includeUserConfig) {
      this.loaders.push(new UserConfigurationLoader(this.options));
    }

    // 3. Project configuration
    this.loaders.push(new ProjectConfigurationLoader(this.options));

    // 4. Custom file configuration (if specified)
    if (this.options.customConfigPath) {
      this.loaders.push(
        new CustomFileConfigurationLoader({
          ...this.options,
          customConfigPath: this.options.customConfigPath,
        })
      );
    }

    // Note: Environment variables and CLI arguments will be handled
    // by separate dedicated modules (EnvironmentVariableParser and CliArgumentMapper)
  }
}
