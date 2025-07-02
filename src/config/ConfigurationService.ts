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
import { ConfigurationManager } from '../utils/config-validation';
import type {
  ClaudeTestingConfig,
  PartialClaudeTestingConfig,
  ConfigValidationResult,
} from '../types/config';
import { DEFAULT_CONFIG } from '../types/config';
import type { FileDiscoveryConfig } from '../types/file-discovery-types';

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
  cliArgs?: Record<string, any>;
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

  constructor(options: ConfigurationServiceOptions) {
    this.options = {
      includeEnvVars: true,
      includeUserConfig: true,
      ...options,
    };
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

    // Load from all sources in reverse priority order (lowest to highest)
    await this.loadDefaultConfiguration();
    
    if (this.options.includeUserConfig) {
      await this.loadUserConfiguration();
    }
    
    await this.loadProjectConfiguration();
    
    if (this.options.customConfigPath) {
      await this.loadCustomFileConfiguration();
    }
    
    if (this.options.includeEnvVars) {
      await this.loadEnvironmentConfiguration();
    }
    
    if (this.options.cliArgs) {
      await this.loadCliConfiguration();
    }

    // Merge all configurations
    const mergeResult = this.mergeConfigurations();
    
    // Create final result
    this.loadResult = {
      ...mergeResult,
      sources: [...this.sources],
      summary: this.generateSummary(),
    };

    this.loadedConfig = this.loadResult.config;

    logger.info(`Configuration loaded successfully from ${this.loadResult.summary.sourcesLoaded} sources`);
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
        maxSize: config.fileDiscovery?.cache?.maxSize ?? 1000
      },
      patterns: config.fileDiscovery?.patterns || {},
      performance: {
        enableStats: config.fileDiscovery?.performance?.enableStats ?? false,
        logSlowOperations: config.fileDiscovery?.performance?.logSlowOperations ?? true,
        slowThresholdMs: config.fileDiscovery?.performance?.slowThresholdMs ?? 1000
      }
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

  private async loadDefaultConfiguration(): Promise<void> {
    const source: ConfigurationSource = {
      type: ConfigurationSourceType.DEFAULTS,
      data: DEFAULT_CONFIG,
      loaded: true,
      errors: [],
      warnings: [],
      loadedAt: new Date(),
    };
    
    this.sources.push(source);
    logger.debug('Loaded default configuration');
  }

  private async loadUserConfiguration(): Promise<void> {
    const userConfigPaths = this.discoverUserConfig();
    
    for (const configPath of userConfigPaths) {
      try {
        await fs.access(configPath);
        const configContent = await fs.readFile(configPath, 'utf8');
        const userConfig = JSON.parse(configContent);
        
        const source: ConfigurationSource = {
          type: ConfigurationSourceType.USER_CONFIG,
          data: userConfig,
          path: configPath,
          loaded: true,
          errors: [],
          warnings: [],
          loadedAt: new Date(),
        };
        
        this.sources.push(source);
        logger.debug(`Loaded user configuration from: ${configPath}`);
        return; // Use first found user config
        
      } catch (error) {
        // Try next path
        continue;
      }
    }
    
    logger.debug('No user configuration found');
  }

  private async loadProjectConfiguration(): Promise<void> {
    const manager = new ConfigurationManager(this.options.projectPath);
    
    try {
      const result = await manager.loadConfiguration();
      
      const source: ConfigurationSource = {
        type: ConfigurationSourceType.PROJECT_CONFIG,
        data: result.config,
        path: manager.getConfigurationPath(),
        loaded: result.valid,
        errors: result.errors,
        warnings: [],
        loadedAt: new Date(),
      };
      
      this.sources.push(source);
      
      if (result.valid) {
        logger.debug(`Loaded project configuration from: ${manager.getConfigurationPath()}`);
      } else {
        logger.warn(`Project configuration has errors: ${result.errors.join(', ')}`);
      }
      
    } catch (error) {
      const source: ConfigurationSource = {
        type: ConfigurationSourceType.PROJECT_CONFIG,
        data: {},
        path: manager.getConfigurationPath(),
        loaded: false,
        errors: [`Failed to load project configuration: ${(error as Error).message}`],
        warnings: [],
        loadedAt: new Date(),
      };
      
      this.sources.push(source);
      logger.debug('No project configuration found');
    }
  }

  private async loadEnvironmentConfiguration(): Promise<void> {
    const envConfig = this.extractEnvConfig();
    
    const source: ConfigurationSource = {
      type: ConfigurationSourceType.ENV_VARS,
      data: envConfig,
      loaded: Object.keys(envConfig).length > 0,
      errors: [],
      warnings: [],
      loadedAt: new Date(),
    };
    
    this.sources.push(source);
    
    if (source.loaded) {
      logger.debug(`Loaded configuration from environment variables`, { envConfig });
    }
  }

  private async loadCliConfiguration(): Promise<void> {
    if (!this.options.cliArgs || Object.keys(this.options.cliArgs).length === 0) {
      return;
    }
    
    const cliConfig = this.mapCliArgsToConfig(this.options.cliArgs);
    
    const source: ConfigurationSource = {
      type: ConfigurationSourceType.CLI_ARGS,
      data: cliConfig,
      loaded: Object.keys(cliConfig).length > 0,
      errors: [],
      warnings: [],
      loadedAt: new Date(),
    };
    
    this.sources.push(source);
    
    if (source.loaded) {
      logger.debug('Loaded configuration from CLI arguments');
    }
  }

  private async loadCustomFileConfiguration(): Promise<void> {
    if (!this.options.customConfigPath) {
      return;
    }
    
    try {
      const configContent = await fs.readFile(this.options.customConfigPath, 'utf8');
      const customConfig = JSON.parse(configContent);
      
      const source: ConfigurationSource = {
        type: ConfigurationSourceType.CUSTOM_FILE,
        data: customConfig,
        path: this.options.customConfigPath,
        loaded: true,
        errors: [],
        warnings: [],
        loadedAt: new Date(),
      };
      
      this.sources.push(source);
      logger.debug(`Loaded custom configuration from: ${this.options.customConfigPath}`);
      
    } catch (error) {
      const source: ConfigurationSource = {
        type: ConfigurationSourceType.CUSTOM_FILE,
        data: {},
        path: this.options.customConfigPath,
        loaded: false,
        errors: [`Failed to load custom configuration: ${(error as Error).message}`],
        warnings: [],
        loadedAt: new Date(),
      };
      
      this.sources.push(source);
      logger.warn(`Failed to load custom configuration from: ${this.options.customConfigPath}`);
    }
  }

  private discoverUserConfig(): string[] {
    const homeDir = process.env.HOME || process.env.USERPROFILE || '';
    return [
      path.join(homeDir, '.claude-testing.config.json'),
      path.join(homeDir, '.config', 'claude-testing', 'config.json'),
      path.join(homeDir, '.claude-testing', 'config.json'),
    ];
  }

  private extractEnvConfig(): PartialClaudeTestingConfig {
    const config: PartialClaudeTestingConfig = {};
    
    // Environment variable prefix
    const prefix = 'CLAUDE_TESTING_';
    
    // Get all environment variables with our prefix
    const envVars = Object.entries(process.env)
      .filter(([key]) => key.startsWith(prefix))
      .map(([key, value]) => ({
        key: key.substring(prefix.length), // Remove prefix
        value: value || ''
      }));
    
    // Debug logging
    if (envVars.length > 0) {
      logger.debug(`Found ${envVars.length} CLAUDE_TESTING_ environment variables`);
    }
    
    // Process each environment variable
    for (const { key, value } of envVars) {
      if (!value || value === '') continue; // Skip empty values
      
      // Convert underscore-separated path to object path
      const path = key.toLowerCase().split('_');
      this.setNestedValue(config, path, this.parseEnvValue(value));
    }
    
    return config;
  }
  
  /**
   * Parse environment variable value to appropriate type
   */
  private parseEnvValue(value: string): any {
    // Empty string = undefined
    if (value === '') return undefined;
    
    // Boolean values
    const lowerValue = value.toLowerCase();
    if (lowerValue === 'true' || lowerValue === '1' || lowerValue === 'yes') return true;
    if (lowerValue === 'false' || lowerValue === '0' || lowerValue === 'no') return false;
    
    // Numeric values
    if (/^-?\d+$/.test(value)) {
      const num = parseInt(value, 10);
      if (!isNaN(num)) return num;
    }
    if (/^-?\d*\.?\d+$/.test(value)) {
      const num = parseFloat(value);
      if (!isNaN(num)) return num;
    }
    
    // Array values (comma-separated)
    if (value.includes(',')) {
      return value.split(',').map(v => v.trim()).filter(v => v !== '');
    }
    
    // String value
    return value;
  }
  
  /**
   * Set a nested value in an object using a path array
   */
  private setNestedValue(obj: any, path: string[], value: any): void {
    if (path.length === 0) return;
    
    // Handle special root-level mappings first
    const upperPath = path.join('_').toUpperCase();
    
    // Direct root-level mappings
    if (upperPath === 'TEST_FRAMEWORK') {
      obj.testFramework = value;
      return;
    }
    if (upperPath === 'AI_MODEL') {
      obj.aiModel = value;
      return;
    }
    if (upperPath === 'COST_LIMIT') {
      obj.costLimit = value;
      return;
    }
    if (upperPath === 'DRY_RUN') {
      obj.dryRun = value;
      return;
    }
    
    // OUTPUT_FORMAT needs special handling - set both format and formats
    if (upperPath === 'OUTPUT_FORMAT') {
      if (!obj.output) obj.output = {};
      obj.output.format = value;
      obj.output.formats = [value];
      return;
    }
    
    // For nested paths, keep first segment lowercase, make others camelCase
    const camelPath = path.map((segment, index) => {
      if (index === 0) return segment.toLowerCase();
      return segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase();
    }).filter(seg => seg !== ''); // Remove empty segments
    
    if (camelPath.length === 0) return;
    
    // Navigate to the parent object, creating nested objects as needed
    let current: any = obj;
    for (let i = 0; i < camelPath.length - 1; i++) {
      const key = camelPath[i];
      if (!key) continue;
      
      if (current[key] === undefined) {
        current[key] = {};
      }
      current = current[key];
    }
    
    // Set the final value
    const finalKey = camelPath[camelPath.length - 1];
    if (finalKey) {
      current[finalKey] = value;
    }
    
    // Handle special cases for mapping
    this.handleEnvMappingSpecialCases(obj, path, value);
  }
  
  /**
   * Handle special cases for environment variable mapping
   */
  private handleEnvMappingSpecialCases(obj: any, path: string[], value: any): void {
    const upperPath = path.join('_').toUpperCase();
    
    // Map FEATURES_MOCKING to features.mocks (not mocking)
    if (upperPath === 'FEATURES_MOCKING') {
      if (!obj.features) obj.features = {};
      obj.features.mocks = value;
      delete obj.features.mocking;
    }
    
    // Map FEATURES_INTEGRATION_TESTS to features.integrationTests
    if (upperPath === 'FEATURES_INTEGRATION_TESTS') {
      if (!obj.features) obj.features = {};
      obj.features.integrationTests = value;
      // Clean up incorrectly parsed nested structure
      if (obj.features.Integration) {
        delete obj.features.Integration;
      }
    }
    
    // Map COVERAGE_THRESHOLDS_GLOBAL_* to coverage.thresholds.global.*
    if (upperPath.startsWith('COVERAGE_THRESHOLDS_GLOBAL_')) {
      const thresholdType = path[path.length - 1]; // Get the last segment (e.g., 'functions')
      if (thresholdType) {
        if (!obj.coverage) obj.coverage = {};
        if (!obj.coverage.thresholds) obj.coverage.thresholds = {};
        if (!obj.coverage.thresholds.global) obj.coverage.thresholds.global = {};
        obj.coverage.thresholds.global[thresholdType.toLowerCase()] = value;
        // Clean up incorrectly parsed nested structure
        if (obj.coverage.Thresholds) {
          delete obj.coverage.Thresholds;
        }
      }
    }
    
    // Map OUTPUT_FORMAT to output.format AND formats array
    if (upperPath === 'OUTPUT_FORMAT' && typeof value === 'string') {
      if (!obj.output) obj.output = {};
      obj.output.format = value;
      // Also maintain formats array for compatibility
      if (!obj.output.formats) obj.output.formats = [];
      if (!obj.output.formats.includes(value)) {
        obj.output.formats.push(value);
      }
    }
    
    // Map OUTPUT_VERBOSE to output.verbose AND logLevel
    if (upperPath === 'OUTPUT_VERBOSE') {
      if (!obj.output) obj.output = {};
      obj.output.verbose = value;
      if (value === true) {
        obj.output.logLevel = 'verbose';
      }
    }
    
    // Map DRY_RUN to dryRun at root level
    if (upperPath === 'DRY_RUN') {
      obj.dryRun = value;
      delete obj.dry; // Remove nested structure if created
    }
    
    // Map COST_LIMIT to costLimit at root level
    if (upperPath === 'COST_LIMIT') {
      obj.costLimit = value;
      delete obj.cost; // Remove nested structure
    }
    
    // Map LOG_LEVEL to output.logLevel 
    if (upperPath === 'LOG_LEVEL') {
      if (!obj.output) obj.output = {};
      obj.output.logLevel = value;
      delete obj.log; // Remove nested structure if created
    }
    
    // Map OUTPUT_FORMATS (plural) to output.formats array
    if (upperPath === 'OUTPUT_FORMATS' && Array.isArray(value)) {
      if (!obj.output) obj.output = {};
      obj.output.formats = value;
    }
    
    // Map coverage.enabled properly 
    if (upperPath === 'COVERAGE_ENABLED') {
      if (!obj.coverage) obj.coverage = {};
      obj.coverage.enabled = value;
      // Don't delete the nested structure, keep it
    }
    
    // Map coverage reporters
    if (upperPath === 'COVERAGE_REPORTERS' && Array.isArray(value)) {
      if (!obj.coverage) obj.coverage = {};
      obj.coverage.reporters = value;
    }
    
    // Map INCREMENTAL_SHOW_STATS to incremental.showStats
    if (upperPath === 'INCREMENTAL_SHOW_STATS') {
      if (!obj.incremental) obj.incremental = {};
      obj.incremental.showStats = value;
    }
    
    // Ensure proper nesting for generation options
    if (path[0] === 'generation' && path.length >= 2) {
      if (!obj.generation) obj.generation = {};
    }
    
    // Ensure proper nesting for aiOptions
    if (path[0] === 'ai' && path[1] === 'options' && path.length >= 3) {
      if (!obj.aiOptions) obj.aiOptions = {};
      // Map from ai.options.* to aiOptions.*
      const aiOptionKey = path.slice(2).map((seg, idx) => 
        idx === 0 ? seg : seg.charAt(0).toUpperCase() + seg.slice(1)
      ).join('');
      if (aiOptionKey) {
        obj.aiOptions[aiOptionKey] = value;
      }
      // Clean up the ai.options structure
      if (obj.ai?.options) {
        delete obj.ai.options;
        if (Object.keys(obj.ai).length === 0) {
          delete obj.ai;
        }
      }
    }
    
    // Handle baseline flag
    if (upperPath === 'INCREMENTAL_BASELINE') {
      if (!obj.incremental) obj.incremental = {};
      obj.incremental.baseline = value;
    }
    
    // Handle watch debounce
    if (upperPath === 'WATCH_DEBOUNCE_MS') {
      if (!obj.watch) obj.watch = {};
      obj.watch.debounceMs = value;
    }
  }

  private mapCliArgsToConfig(cliArgs: Record<string, any>): PartialClaudeTestingConfig {
    const config: PartialClaudeTestingConfig = {};
    
    // AI model mapping
    if (cliArgs.aiModel) {
      config.aiModel = cliArgs.aiModel;
    }
    
    // Output configuration
    if (cliArgs.verbose || cliArgs.debug) {
      config.output = { 
        logLevel: cliArgs.debug ? 'debug' : 'verbose',
        ...(config.output || {})
      };
    }
    
    if (cliArgs.quiet) {
      config.output = { 
        logLevel: 'error',
        ...(config.output || {})
      };
    }
    
    if (cliArgs.format) {
      config.output = {
        formats: [cliArgs.format],
        format: cliArgs.format,
        ...(config.output || {})
      };
    }
    
    if (cliArgs.output) {
      config.output = {
        file: cliArgs.output,
        ...(config.output || {})
      };
    }
    
    // Test framework mapping
    if (cliArgs.framework) {
      config.testFramework = cliArgs.framework;
    }
    
    // Test generation configuration
    if (cliArgs.maxRatio !== undefined) {
      config.generation = {
        maxTestToSourceRatio: cliArgs.maxRatio,
        ...(config.generation || {})
      };
    }
    
    // Features configuration based on test generation flags
    if (cliArgs.onlyStructural !== undefined) {
      config.features = {
        structuralTests: true,
        logicalTests: false,
        ...(config.features || {})
      };
    }
    
    if (cliArgs.onlyLogical !== undefined) {
      config.features = {
        structuralTests: false,
        logicalTests: true,
        ...(config.features || {})
      };
    }
    
    // Note: force flag doesn't map directly to config schema
    // It's handled at the command level
    
    // Note: chunking options are handled at implementation level
    // They don't map directly to the config schema
    
    // Coverage configuration
    if (cliArgs.coverage !== undefined) {
      config.coverage = {
        enabled: cliArgs.coverage,
        ...(config.coverage || {})
      };
    }
    
    if (cliArgs.threshold) {
      const thresholds = this.parseThresholds(cliArgs.threshold);
      if (thresholds) {
        config.coverage = {
          thresholds: {
            global: thresholds  // Only set the properties that were explicitly provided
          },
          ...(config.coverage || {})
        };
      }
    }
    
    // Note: junit and reporter are handled at the command level
    // They don't map directly to the main config schema
    
    // Watch mode
    if (cliArgs.watch !== undefined) {
      config.watch = {
        enabled: cliArgs.watch,
        ...(config.watch || {})
      };
    }
    
    // Incremental configuration
    if (cliArgs.stats !== undefined) {
      config.incremental = {
        showStats: cliArgs.stats,
        ...(config.incremental || {})
      };
    }
    
    if (cliArgs.baseline !== undefined) {
      config.incremental = {
        baseline: cliArgs.baseline,
        ...(config.incremental || {})
      };
    }
    
    if (cliArgs.costLimit !== undefined) {
      config.costLimit = cliArgs.costLimit;
    }
    
    return config;
  }
  
  private parseThresholds(thresholdString: string): { statements?: number; branches?: number; functions?: number; lines?: number } | undefined {
    try {
      // Parse threshold string like "80" or "statements:80,branches:70"
      if (thresholdString.includes(':')) {
        const thresholds: any = {};
        const parts = thresholdString.split(',');
        
        for (const part of parts) {
          const [type, value] = part.split(':');
          if (type && value) {
            const numValue = parseInt(value);
            if (!isNaN(numValue)) {
              thresholds[type.trim()] = numValue;
            }
          }
        }
        
        return thresholds;
      } else {
        // Single threshold applies to all
        const value = parseInt(thresholdString);
        if (!isNaN(value)) {
          return {
            statements: value,
            branches: value,
            functions: value,
            lines: value
          };
        }
      }
    } catch (error) {
      logger.warn('Failed to parse threshold string', { thresholdString, error });
    }
    
    return undefined;
  }

  private mergeConfigurations(): ConfigValidationResult {
    // Merge configurations in order (later sources override earlier ones)
    let mergedConfig: PartialClaudeTestingConfig = {};
    const allErrors: string[] = [];
    const allWarnings: string[] = [];
    
    for (const source of this.sources) {
      if (source.loaded) {
        logger.debug(`Merging source: ${source.type}`, { data: source.data });
        mergedConfig = this.deepMerge(mergedConfig, source.data);
      }
      allErrors.push(...source.errors);
    }
    
    logger.debug('Final merged configuration', { mergedConfig });
    
    // Validate the final merged configuration
    const manager = new ConfigurationManager(this.options.projectPath);
    const validationResult = manager.validateConfiguration(mergedConfig);
    
    return {
      valid: validationResult.valid && allErrors.length === 0,
      errors: [...allErrors, ...validationResult.errors],
      warnings: [...allWarnings, ...validationResult.warnings],
      config: validationResult.config,
    };
  }

  private deepMerge(target: any, source: any): any {
    const result = { ...target };
    
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(result[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    
    return result;
  }

  private generateSummary() {
    const sourcesLoaded = this.sources.filter(s => s.loaded).length;
    const sourcesWithErrors = this.sources.filter(s => s.errors.length > 0).length;
    const totalErrors = this.sources.reduce((sum, s) => sum + s.errors.length, 0);
    const totalWarnings = this.loadResult?.warnings.length || 0;
    
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