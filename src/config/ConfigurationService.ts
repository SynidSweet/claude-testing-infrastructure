/**
 * Centralized configuration service for Claude Testing Infrastructure
 *
 * This service provides a consistent way to load and manage configuration across all commands.
 * It supports multiple configuration sources with proper precedence:
 * 1. CLI arguments (highest priority)
 * 2. Environment variables
 * 3. Project configuration file
 * 4. User configuration file
 * 5. Default configuration (lowest priority)
 */

import { fs, path, logger } from '../utils/common-imports';
import {
  type ClaudeTestingConfig,
  type PartialClaudeTestingConfig,
  type ConfigValidationResult,
} from '../types/config';
import type { FileDiscoveryConfig } from '../types/file-discovery-types';
import {
  ConfigurationSourceLoaderRegistry,
  type ConfigurationSource,
  ConfigurationSourceType,
  type LoaderRegistryOptions,
} from './loaders';
import { EnvironmentVariableParser } from './EnvironmentVariableParser';
import { CliArgumentMapper, type CliArguments } from './CliArgumentMapper';
import { ConfigurationMerger } from './ConfigurationMerger';

// Re-export CliArguments for backward compatibility
export type { CliArguments } from './CliArgumentMapper';


/**
 * Type for configuration object sections
 */
export interface ConfigSection {
  [key: string]: string | number | boolean | string[] | ConfigSection | undefined;
}

/**
 * Options for configuring the ConfigurationService
 */
export interface ConfigurationServiceOptions {
  /** Project path to search for configuration */
  projectPath: string;
  /** Custom configuration file path (overrides discovery) */
  customConfigPath?: string | undefined;
  /** Whether to include environment variables */
  includeEnvVars?: boolean;
  /** Whether to include user configuration */
  includeUserConfig?: boolean;
  /** CLI arguments to merge */
  cliArgs?: CliArguments;
}

/**
 * Result of configuration loading process
 */
export interface ConfigurationLoadResult extends ConfigValidationResult {
  /** All configuration sources that were processed */
  sources: ConfigurationSource[];
  /** Final merged configuration after all sources */
  config: ClaudeTestingConfig;
  /** Configuration load summary */
  summary: {
    sourcesLoaded: number;
    sourcesWithErrors: number;
    totalErrors: number;
    totalWarnings: number;
  };
}

/**
 * Centralized configuration service
 */
export class ConfigurationService {
  private options: ConfigurationServiceOptions;
  private sources: ConfigurationSource[] = [];
  private loadedConfig: ClaudeTestingConfig | null = null;
  private loadResult: ConfigurationLoadResult | null = null;
  private loaderRegistry: ConfigurationSourceLoaderRegistry;
  private envParser: EnvironmentVariableParser;
  private cliMapper: CliArgumentMapper;
  private merger: ConfigurationMerger;

  constructor(options: ConfigurationServiceOptions) {
    this.options = {
      includeEnvVars: true,
      includeUserConfig: true,
      ...options,
    };
    
    // Initialize loader registry
    const registryOptions: LoaderRegistryOptions = {
      projectPath: this.options.projectPath,
      includeUserConfig: this.options.includeUserConfig ?? true,
    };
    
    if (this.options.customConfigPath) {
      registryOptions.customConfigPath = this.options.customConfigPath;
    }
    
    this.loaderRegistry = new ConfigurationSourceLoaderRegistry(registryOptions);
    
    // Initialize environment variable parser
    this.envParser = new EnvironmentVariableParser();
    
    // Initialize CLI argument mapper
    this.cliMapper = new CliArgumentMapper();
    
    // Initialize configuration merger
    this.merger = new ConfigurationMerger({ projectPath: this.options.projectPath });
  }

  /**
   * Load configuration from all sources with proper precedence
   */
  async loadConfiguration(): Promise<ConfigurationLoadResult> {
    logger.debug('Loading configuration from all sources');

    // Reset state
    this.sources = [];
    this.loadedConfig = null;
    this.loadResult = null;

    // Load from file sources using the loader registry
    await this.loadFromSourceLoaders();

    // Load remaining sources (environment variables and CLI args)
    // These will be handled by dedicated modules in future refactoring
    if (this.options.includeEnvVars) {
      this.loadEnvironmentConfiguration();
    }

    if (this.options.cliArgs) {
      this.loadCliConfiguration();
    }

    // Merge all configurations
    const mergeResult = this.merger.mergeConfigurations(this.sources);

    // Create final result
    this.loadResult = {
      ...mergeResult,
      sources: [...this.sources],
      summary: this.generateSummary(),
    };

    this.loadedConfig = this.loadResult.config;

    logger.debug(
      `Configuration loaded successfully from ${this.loadResult.summary.sourcesLoaded} sources`
    );
    if (this.loadResult.summary.sourcesWithErrors > 0) {
      logger.warn(`${this.loadResult.summary.sourcesWithErrors} sources had errors`);
    }

    return this.loadResult;
  }

  /**
   * Get the loaded configuration
   */
  getConfiguration(): ClaudeTestingConfig {
    if (!this.loadedConfig) {
      throw new Error('Configuration has not been loaded. Call loadConfiguration() first.');
    }
    return this.loadedConfig;
  }

  /**
   * Get file discovery configuration with defaults
   */
  getFileDiscoveryConfig(): FileDiscoveryConfig {
    const config = this.getConfiguration();

    return {
      cache: {
        enabled: config.fileDiscovery?.cache?.enabled ?? true,
        ttl: config.fileDiscovery?.cache?.ttl ?? 300000, // 5 minutes
        maxSize: config.fileDiscovery?.cache?.maxSize ?? 1000,
      },
      patterns: config.fileDiscovery?.patterns ?? {},
      performance: {
        enableStats: config.fileDiscovery?.performance?.enableStats ?? false,
        logSlowOperations: config.fileDiscovery?.performance?.logSlowOperations ?? true,
        slowThresholdMs: config.fileDiscovery?.performance?.slowThresholdMs ?? 1000,
      },
      smartDetection: {
        enabled: config.fileDiscovery?.smartDetection?.enabled ?? true,
        confidenceThreshold: config.fileDiscovery?.smartDetection?.confidenceThreshold ?? 0.7,
        cacheAnalysis: config.fileDiscovery?.smartDetection?.cacheAnalysis ?? true,
      },
    };
  }

  /**
   * Get all configuration sources
   */
  getSources(): ConfigurationSource[] {
    return [...this.sources];
  }

  /**
   * Get configuration loading result
   */
  getLoadResult(): ConfigurationLoadResult | null {
    return this.loadResult;
  }

  /**
   * Add a custom configuration source
   */
  addSource(source: ConfigurationSource): void {
    this.sources.push(source);
  }

  /**
   * Check if project has a configuration file
   */
  async hasProjectConfig(): Promise<boolean> {
    const configPath = path.join(this.options.projectPath, '.claude-testing.config.json');
    try {
      await fs.access(configPath);
      return true;
    } catch {
      return false;
    }
  }

  // Private methods for loading different configuration sources

  /**
   * Load configuration from file-based sources using the loader registry
   */
  private async loadFromSourceLoaders(): Promise<void> {
    const loaders = this.loaderRegistry.getLoaders();
    
    for (const loader of loaders) {
      try {
        const result = await loader.load();
        this.sources.push(result.source);
        
        if (result.success && result.source.loaded) {
          logger.debug(`Loaded configuration from: ${loader.getDescription()}`);
        } else if (result.source.errors.length > 0) {
          logger.warn(`Configuration source has errors: ${loader.getDescription()}`);
        }
      } catch (error) {
        logger.warn(`Failed to load configuration from: ${loader.getDescription()}`, error);
      }
    }
  }


  private loadEnvironmentConfiguration(): void {
    const { config: envConfig, warnings } = this.extractEnvConfig();

    const source: ConfigurationSource = {
      type: ConfigurationSourceType.ENV_VARS,
      data: envConfig,
      loaded: Object.keys(envConfig).length > 0,
      errors: [],
      warnings: warnings,
      loadedAt: new Date(),
    };

    this.sources.push(source);

    if (source.loaded) {
      logger.debug(`Loaded configuration from environment variables`, { envConfig });
    }
  }

  private loadCliConfiguration(): void {
    if (!this.options.cliArgs || Object.keys(this.options.cliArgs).length === 0) {
      return;
    }

    const mappingResult = this.cliMapper.mapCliArgsToConfig(this.options.cliArgs);

    // Extract threshold error if present
    const errors: string[] = [];
    if (mappingResult.error) {
      errors.push(mappingResult.error);
    }

    const source: ConfigurationSource = {
      type: ConfigurationSourceType.CLI_ARGS,
      data: mappingResult.config,
      loaded: Object.keys(mappingResult.config).length > 0,
      errors,
      warnings: [],
      loadedAt: new Date(),
    };

    this.sources.push(source);

    if (source.loaded) {
      logger.debug('Loaded configuration from CLI arguments');
    }
  }


  private extractEnvConfig(): { config: PartialClaudeTestingConfig; warnings: string[] } {
    // Use the environment variable parser
    const result = this.envParser.parseEnvironmentVariables(process.env);
    
    // Debug logging
    const envVarCount = Object.keys(process.env).filter(key => key.startsWith('CLAUDE_TESTING_')).length;
    if (envVarCount > 0) {
      logger.debug(`Found ${envVarCount} CLAUDE_TESTING_ environment variables`);
    }

    return result;
  }



  // Configuration object utilities moved to CliArgumentMapper

  // Type-safe configuration utilities moved to CliArgumentMapper


  // CLI argument mapping logic moved to CliArgumentMapper

  // Threshold parsing logic moved to CliArgumentMapper



  private generateSummary(): {
    sourcesLoaded: number;
    sourcesWithErrors: number;
    totalErrors: number;
    totalWarnings: number;
  } {
    const sourcesLoaded = this.sources.filter((s) => s.loaded).length;
    const sourcesWithErrors = this.sources.filter((s) => s.errors.length > 0).length;
    const totalErrors = this.sources.reduce((sum, s) => sum + s.errors.length, 0);
    const totalWarnings = this.loadResult?.warnings.length ?? 0;

    return {
      sourcesLoaded,
      sourcesWithErrors,
      totalErrors,
      totalWarnings,
    };
  }
}

/**
 * Convenience function to create and load configuration
 */
export async function loadCommandConfig(
  projectPath: string,
  options: Partial<ConfigurationServiceOptions> = {}
): Promise<ConfigurationLoadResult> {
  const service = new ConfigurationService({
    projectPath,
    ...options,
  });

  return await service.loadConfiguration();
}
