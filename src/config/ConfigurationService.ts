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
  cliArgs?: Record<string, unknown>;
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
  private thresholdParseError: string | undefined;

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
      patterns: config.fileDiscovery?.patterns || {},
      performance: {
        enableStats: config.fileDiscovery?.performance?.enableStats ?? false,
        logSlowOperations: config.fileDiscovery?.performance?.logSlowOperations ?? true,
        slowThresholdMs: config.fileDiscovery?.performance?.slowThresholdMs ?? 1000,
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

        // Validate the user configuration to get errors and warnings
        const manager = new ConfigurationManager(this.options.projectPath);
        const validationResult = manager.validateConfiguration(userConfig);

        const source: ConfigurationSource = {
          type: ConfigurationSourceType.USER_CONFIG,
          data: userConfig,
          path: configPath,
          loaded: true,
          errors: validationResult.errors,
          warnings: validationResult.warnings,
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

  private async loadCliConfiguration(): Promise<void> {
    if (!this.options.cliArgs || Object.keys(this.options.cliArgs).length === 0) {
      return;
    }

    const cliConfig = this.mapCliArgsToConfig(this.options.cliArgs);

    // Extract threshold error if present
    const errors: string[] = [];
    if (this.thresholdParseError) {
      errors.push(this.thresholdParseError);
      this.thresholdParseError = undefined;
    }

    const source: ConfigurationSource = {
      type: ConfigurationSourceType.CLI_ARGS,
      data: cliConfig,
      loaded: Object.keys(cliConfig).length > 0,
      errors,
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

      // Validate the custom configuration to get errors and warnings
      const manager = new ConfigurationManager(this.options.projectPath);
      const validationResult = manager.validateConfiguration(customConfig);

      const source: ConfigurationSource = {
        type: ConfigurationSourceType.CUSTOM_FILE,
        data: customConfig,
        path: this.options.customConfigPath,
        loaded: true,
        errors: validationResult.errors,
        warnings: validationResult.warnings,
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

  private extractEnvConfig(): { config: PartialClaudeTestingConfig; warnings: string[] } {
    const config: PartialClaudeTestingConfig = {};
    const warnings: string[] = [];

    // Environment variable prefix
    const prefix = 'CLAUDE_TESTING_';

    // Get all environment variables with our prefix
    const envVars = Object.entries(process.env)
      .filter(([key]) => key.startsWith(prefix))
      .map(([key, value]) => ({
        key: key.substring(prefix.length), // Remove prefix
        value: value || '',
      }));

    // Debug logging
    if (envVars.length > 0) {
      logger.debug(`Found ${envVars.length} CLAUDE_TESTING_ environment variables`);
    }

    // Process each environment variable
    for (const { key, value } of envVars) {
      // Skip only null/undefined values, not empty strings (empty strings have meaning)
      if (value === null || value === undefined) continue;

      // Convert underscore-separated path to object path
      const path = key.toLowerCase().split('_');
      // Check if this is an array field before parsing
      const isArrayField = this.isArrayField(key);
      const { value: parsedValue, warning } = this.parseEnvValue(value, isArrayField, key);

      if (warning) {
        warnings.push(warning);
      }

      // Pass the parsed value with the original key for special case handling
      this.setNestedValue(config as Record<string, unknown>, path, parsedValue, key);
    }

    return { config, warnings };
  }

  /**
   * Check if a field should be treated as an array
   */
  private isArrayField(key: string): boolean {
    const arrayFields = ['INCLUDE', 'EXCLUDE', 'COVERAGE_REPORTERS', 'OUTPUT_FORMATS'];
    return arrayFields.some((field) => key === field || key.endsWith(`_${field}`));
  }

  /**
   * Parse environment variable value to appropriate type
   */
  private parseEnvValue(
    value: string,
    isArrayField: boolean = false,
    key?: string
  ): { value: unknown; warning?: string } {
    // Handle array fields specially
    if (isArrayField) {
      if (value === '') return { value: [] }; // Empty string = empty array for array fields
      return {
        value: value
          .split(',')
          .map((v) => v.trim())
          .filter((v) => v !== ''),
      };
    }

    // Empty string = undefined for non-array fields
    if (value === '') return { value: undefined };

    // Boolean values
    const lowerValue = value.toLowerCase();
    if (lowerValue === 'true' || lowerValue === '1' || lowerValue === 'yes') return { value: true };
    if (lowerValue === 'false' || lowerValue === '0' || lowerValue === 'no')
      return { value: false };

    // Numeric values - check if it looks like a number
    if (/^-?\d+$/.test(value)) {
      const num = parseInt(value, 10);
      if (!isNaN(num)) return { value: num };
    }
    if (/^-?\d*\.?\d+$/.test(value)) {
      const num = parseFloat(value);
      if (!isNaN(num)) return { value: num };
    }

    // Check if this was supposed to be numeric but failed
    if (
      key &&
      (key.includes('RETRIES') ||
        key.includes('TIMEOUT') ||
        key.includes('TOKENS') ||
        key.includes('TEMPERATURE') ||
        key.includes('RATIO') ||
        key.includes('SIZE') ||
        key.includes('LIMIT') ||
        key.includes('THRESHOLDS'))
    ) {
      // This should have been numeric but wasn't
      return {
        value: value, // Keep as string
        warning: `Environment variable CLAUDE_TESTING_${key}: Invalid numeric value "${value}"`,
      };
    }

    // Array values (comma-separated)
    if (value.includes(',')) {
      return {
        value: value
          .split(',')
          .map((v) => v.trim())
          .filter((v) => v !== ''),
      };
    }

    // String value
    return { value: value };
  }

  /**
   * Set a nested value in an object using a path array
   */
  private setNestedValue(
    obj: Record<string, unknown>,
    path: string[],
    value: unknown,
    originalKey?: string
  ): void {
    if (path.length === 0) return;

    // Handle special root-level mappings first
    const upperPath = originalKey || path.join('_').toUpperCase();

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
    if (upperPath === 'INCLUDE') {
      obj.include = value;
      return;
    }
    if (upperPath === 'EXCLUDE') {
      obj.exclude = value;
      return;
    }

    // Handle CUSTOM_PROMPTS fields
    if (upperPath.startsWith('CUSTOM_PROMPTS_')) {
      if (!obj.customPrompts) obj.customPrompts = {};
      const promptKey = upperPath.substring('CUSTOM_PROMPTS_'.length);

      // Handle empty strings for custom prompts
      if (value === '') {
        // Don't set undefined prompts
        return;
      }

      if (promptKey === 'TEST_GENERATION') {
        (obj as any).customPrompts.testGeneration = value;
        return;
      }
    }

    // OUTPUT_FORMAT needs special handling - set both format and formats
    if (upperPath === 'OUTPUT_FORMAT') {
      if (!obj.output) obj.output = {};
      (obj as any).output.format = value;
      (obj as any).output.formats = [value];
      return;
    }

    // Map FEATURES_COVERAGE to features.coverage
    if (upperPath === 'FEATURES_COVERAGE') {
      if (!obj.features) obj.features = {};
      (obj as any).features.coverage = value;
      return;
    }

    // Map FEATURES_EDGE_CASES to features.edgeCases
    if (upperPath === 'FEATURES_EDGE_CASES') {
      if (!obj.features) obj.features = {};
      (obj as any).features.edgeCases = value;
      return;
    }

    // Map FEATURES_INTEGRATION_TESTS to features.integrationTests
    if (upperPath === 'FEATURES_INTEGRATION_TESTS') {
      if (!obj.features) obj.features = {};
      (obj as any).features.integrationTests = value;
      return;
    }

    // Map FEATURES_MOCKING to features.mocks
    if (upperPath === 'FEATURES_MOCKING') {
      if (!obj.features) obj.features = {};
      (obj as any).features.mocks = value;
      return;
    }

    // Map OUTPUT_VERBOSE to output.verbose
    if (upperPath === 'OUTPUT_VERBOSE') {
      if (!obj.output) obj.output = {};
      (obj as any).output.verbose = value;
      if (value === true) {
        (obj as any).output.logLevel = 'verbose';
      }
      return;
    }

    // Map OUTPUT_LOG_LEVEL to output.logLevel
    if (upperPath === 'OUTPUT_LOG_LEVEL') {
      if (!obj.output) obj.output = {};
      (obj as any).output.logLevel = value;
      return;
    }

    // Map OUTPUT_COLORS to output.colors
    if (upperPath === 'OUTPUT_COLORS') {
      if (!obj.output) obj.output = {};
      (obj as any).output.colors = value;
      return;
    }

    // Map COVERAGE_ENABLED to coverage.enabled
    if (upperPath === 'COVERAGE_ENABLED') {
      if (!obj.coverage) obj.coverage = {};
      (obj as any).coverage.enabled = value;
      return;
    }

    // Map COVERAGE_REPORTERS to coverage.reporters
    if (upperPath === 'COVERAGE_REPORTERS') {
      if (!obj.coverage) obj.coverage = {};
      (obj as any).coverage.reporters = value;
      return;
    }

    // Handle COVERAGE_THRESHOLDS_GLOBAL fields
    if (upperPath.startsWith('COVERAGE_THRESHOLDS_GLOBAL_')) {
      if (!obj.coverage) obj.coverage = {};
      if (!(obj as any).coverage.thresholds) (obj as any).coverage.thresholds = {};
      if (!(obj as any).coverage.thresholds.global) (obj as any).coverage.thresholds.global = {};

      const thresholdKey = upperPath.substring('COVERAGE_THRESHOLDS_GLOBAL_'.length).toLowerCase();
      (obj as any).coverage.thresholds.global[thresholdKey] = value;
      return;
    }

    // Handle special mappings for AI_OPTIONS fields
    if (upperPath.startsWith('AI_OPTIONS_')) {
      if (!obj.aiOptions) obj.aiOptions = {};
      const aiOptionKey = upperPath.substring('AI_OPTIONS_'.length);

      if (aiOptionKey === 'MAX_TOKENS') {
        (obj as any).aiOptions.maxTokens = value;
        return;
      }
      if (aiOptionKey === 'TEMPERATURE') {
        (obj as any).aiOptions.temperature = value;
        return;
      }
      if (aiOptionKey === 'MAX_COST') {
        (obj as any).aiOptions.maxCost = value;
        return;
      }
    }

    // Handle special mappings for GENERATION fields
    if (upperPath.startsWith('GENERATION_')) {
      if (!obj.generation) obj.generation = {};
      const generationKey = upperPath.substring('GENERATION_'.length);

      if (generationKey === 'MAX_RETRIES') {
        (obj as any).generation.maxRetries = value;
        return;
      }
      if (generationKey === 'TIMEOUT_MS') {
        (obj as any).generation.timeoutMs = value;
        return;
      }
      if (generationKey === 'MAX_TEST_TO_SOURCE_RATIO') {
        (obj as any).generation.maxTestToSourceRatio = value;
        return;
      }
      if (generationKey === 'BATCH_SIZE') {
        (obj as any).generation.batchSize = value;
        return;
      }
    }

    // For nested paths, convert to appropriate case
    // Keep configuration object keys lowercase (coverage.thresholds.global)
    // Use camelCase only for property names within objects
    const camelPath = path
      .map((segment, index) => {
        if (index === 0) return segment.toLowerCase();
        return segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase();
      })
      .filter((seg) => seg !== ''); // Remove empty segments

    if (camelPath.length === 0) return;

    // Navigate to the parent object, creating nested objects as needed
    let current: Record<string, unknown> = obj;
    for (let i = 0; i < camelPath.length - 1; i++) {
      const key = camelPath[i];
      if (!key) continue;

      if (current[key] === undefined) {
        current[key] = {};
      }
      current = current[key] as Record<string, unknown>;
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
  private handleEnvMappingSpecialCases(
    obj: Record<string, unknown>,
    path: string[],
    value: unknown
  ): void {
    const upperPath = path.join('_').toUpperCase();

    // Map FEATURES_MOCKING to features.mocks (not mocking)
    if (upperPath === 'FEATURES_MOCKING') {
      if (!obj.features) obj.features = {};
      (obj as any).features.mocks = value;
      delete (obj as any).features.mocking;
    }

    // Map FEATURES_INTEGRATION_TESTS to features.integrationTests
    if (upperPath === 'FEATURES_INTEGRATION_TESTS') {
      if (!obj.features) obj.features = {};
      (obj as any).features.integrationTests = value;
      // Clean up incorrectly parsed nested structure
      if ((obj as any).features.Integration) {
        delete (obj as any).features.Integration;
      }
    }

    // Map COVERAGE_THRESHOLDS_GLOBAL_* to coverage.thresholds.global.*
    if (upperPath.startsWith('COVERAGE_THRESHOLDS_GLOBAL_')) {
      const thresholdType = path[path.length - 1]; // Get the last segment (e.g., 'functions')
      if (thresholdType) {
        if (!obj.coverage) obj.coverage = {};
        if (!(obj as any).coverage.thresholds) (obj as any).coverage.thresholds = {};
        if (!(obj as any).coverage.thresholds.global) (obj as any).coverage.thresholds.global = {};
        (obj as any).coverage.thresholds.global[thresholdType.toLowerCase()] = value;
        // Clean up incorrectly parsed nested structure
        if ((obj as any).coverage.Thresholds) {
          delete (obj as any).coverage.Thresholds;
        }
      }
    }

    // Map OUTPUT_FORMAT to output.format AND formats array
    if (upperPath === 'OUTPUT_FORMAT' && typeof value === 'string') {
      if (!obj.output) obj.output = {};
      (obj as any).output.format = value;
      // Also maintain formats array for compatibility
      if (!(obj as any).output.formats) (obj as any).output.formats = [];
      if (!(obj as any).output.formats.includes(value)) {
        (obj as any).output.formats.push(value);
      }
    }

    // Map OUTPUT_VERBOSE to output.verbose AND logLevel
    if (upperPath === 'OUTPUT_VERBOSE') {
      if (!obj.output) obj.output = {};
      (obj as any).output.verbose = value;
      if (value === true) {
        (obj as any).output.logLevel = 'verbose';
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
      (obj as any).output.logLevel = value;
      delete obj.log; // Remove nested structure if created
    }

    // Map OUTPUT_FORMATS (plural) to output.formats array
    if (upperPath === 'OUTPUT_FORMATS' && Array.isArray(value)) {
      if (!obj.output) obj.output = {};
      (obj as any).output.formats = value;
    }

    // Map coverage.enabled properly
    if (upperPath === 'COVERAGE_ENABLED') {
      if (!obj.coverage) obj.coverage = {};
      (obj as any).coverage.enabled = value;
      // Don't delete the nested structure, keep it
    }

    // Map coverage reporters
    if (upperPath === 'COVERAGE_REPORTERS' && Array.isArray(value)) {
      if (!obj.coverage) obj.coverage = {};
      (obj as any).coverage.reporters = value;
    }

    // Map INCREMENTAL_SHOW_STATS to incremental.showStats
    if (upperPath === 'INCREMENTAL_SHOW_STATS') {
      if (!obj.incremental) obj.incremental = {};
      (obj as any).incremental.showStats = value;
    }

    // Ensure proper nesting for generation options
    if (path[0] === 'generation' && path.length >= 2) {
      if (!obj.generation) obj.generation = {};
    }

    // Ensure proper nesting for aiOptions
    if (path[0] === 'ai' && path[1] === 'options' && path.length >= 3) {
      if (!obj.aiOptions) obj.aiOptions = {};
      // Map from ai.options.* to aiOptions.*
      const aiOptionKey = path
        .slice(2)
        .map((seg, idx) => (idx === 0 ? seg : seg.charAt(0).toUpperCase() + seg.slice(1)))
        .join('');
      if (aiOptionKey) {
        (obj as any).aiOptions[aiOptionKey] = value;
      }
      // Clean up the ai.options structure
      if ((obj as any).ai?.options) {
        delete (obj as any).ai.options;
        if (Object.keys((obj as any).ai).length === 0) {
          delete (obj as any).ai;
        }
      }
    }

    // Handle baseline flag
    if (upperPath === 'INCREMENTAL_BASELINE') {
      if (!obj.incremental) obj.incremental = {};
      (obj as any).incremental.baseline = value;
    }

    // Handle watch debounce
    if (upperPath === 'WATCH_DEBOUNCE_MS') {
      if (!obj.watch) obj.watch = {};
      (obj as any).watch.debounceMs = value;
    }
  }

  private mapCliArgsToConfig(cliArgs: Record<string, unknown>): PartialClaudeTestingConfig {
    const config: PartialClaudeTestingConfig = {};

    // AI model mapping
    if (cliArgs.aiModel) {
      config.aiModel = cliArgs.aiModel as any;
    }

    // Output configuration
    if (cliArgs.verbose !== undefined) {
      if (!config.output) config.output = {};
      config.output.verbose = cliArgs.verbose as boolean;
      if (cliArgs.verbose) {
        config.output.logLevel = 'verbose';
      }
    }

    if (cliArgs.debug !== undefined) {
      if (!config.output) config.output = {};
      config.output.logLevel = 'debug';
    }

    if (cliArgs.quiet) {
      config.output = {
        logLevel: 'error',
        ...(config.output || {}),
      };
    }

    if (cliArgs.format) {
      config.output = {
        formats: [cliArgs.format as any],
        format: cliArgs.format as any,
        ...(config.output || {}),
      };
    }

    if (cliArgs.output) {
      config.output = {
        file: cliArgs.output as string,
        ...(config.output || {}),
      };
    }

    // Test framework mapping
    if (cliArgs.framework) {
      config.testFramework = cliArgs.framework as any;
    }

    // Test generation configuration
    if (cliArgs.maxRatio !== undefined) {
      config.generation = {
        maxTestToSourceRatio: cliArgs.maxRatio as number,
        ...(config.generation || {}),
      };
    }

    if (cliArgs.batchSize !== undefined) {
      config.generation = {
        batchSize: cliArgs.batchSize as number,
        ...(config.generation || {}),
      };
    }

    if (cliArgs.maxRetries !== undefined) {
      config.generation = {
        maxRetries: cliArgs.maxRetries as number,
        ...(config.generation || {}),
      };
    }

    // Features configuration based on test generation flags
    if (cliArgs.onlyStructural !== undefined) {
      config.features = {
        structuralTests: true,
        logicalTests: false,
        ...(config.features || {}),
      };
    }

    if (cliArgs.onlyLogical !== undefined) {
      config.features = {
        structuralTests: false,
        logicalTests: true,
        ...(config.features || {}),
      };
    }

    // Note: force flag doesn't map directly to config schema
    // It's handled at the command level

    // Note: chunking options are handled at implementation level
    // They don't map directly to the config schema

    // Coverage configuration
    if (cliArgs.coverage !== undefined) {
      config.coverage = {
        enabled: cliArgs.coverage as boolean,
        ...(config.coverage || {}),
      };
    }

    if (cliArgs.threshold) {
      const parseResult = this.parseThresholds(cliArgs.threshold as string);
      if (parseResult.thresholds) {
        config.coverage = {
          thresholds: {
            global: parseResult.thresholds, // Only set the properties that were explicitly provided
          },
          ...(config.coverage || {}),
        };
      }
      // Store error to be handled in loadCliConfiguration
      this.thresholdParseError = parseResult.error;
    }

    // Map reporter CLI argument to coverage.reporters
    if (cliArgs.reporter) {
      const reporters = Array.isArray(cliArgs.reporter) ? cliArgs.reporter : [cliArgs.reporter];
      config.coverage = {
        reporters,
        ...(config.coverage || {}),
      };
    }

    // Watch mode
    if (cliArgs.watch !== undefined) {
      config.watch = {
        enabled: cliArgs.watch as boolean,
        ...(config.watch || {}),
      };
    }

    if (cliArgs.debounce !== undefined) {
      config.watch = {
        debounceMs: cliArgs.debounce as number,
        ...(config.watch || {}),
      };
    }

    // Incremental configuration
    if (cliArgs.stats !== undefined) {
      config.incremental = {
        showStats: cliArgs.stats as boolean,
        ...(config.incremental || {}),
      };
    }

    if (cliArgs.baseline !== undefined) {
      config.incremental = {
        baseline: cliArgs.baseline as any,
        ...(config.incremental || {}),
      };
    }

    if (cliArgs.costLimit !== undefined) {
      config.costLimit = cliArgs.costLimit as number;
    }

    if (cliArgs.dryRun !== undefined) {
      config.dryRun = cliArgs.dryRun as boolean;
    }

    return config;
  }

  private parseThresholds(thresholdString: string): {
    thresholds?: { statements?: number; branches?: number; functions?: number; lines?: number };
    error?: string;
  } {
    try {
      const validTypes = ['statements', 'branches', 'functions', 'lines'];

      // Parse threshold string like "80" or "statements:80,branches:70"
      if (thresholdString.includes(':')) {
        const thresholds: Record<string, number> = {};
        const parts = thresholdString.split(',');

        // Check for invalid format (multiple colons)
        if (thresholdString.split(':').length - 1 > parts.length) {
          return {
            error: `Invalid threshold format: '${thresholdString}'. Expected format: 'type:value' or 'type1:value1,type2:value2'`,
          };
        }

        for (const part of parts) {
          const colonCount = (part.match(/:/g) || []).length;
          if (colonCount !== 1) {
            return {
              error: `Invalid threshold format: '${thresholdString}'. Each part must have exactly one colon.`,
            };
          }

          const [type, value] = part.split(':');
          const trimmedType = type?.trim();

          if (!trimmedType || !value) {
            return {
              error: `Invalid threshold format: '${thresholdString}'. Expected format: 'type:value'`,
            };
          }

          if (!validTypes.includes(trimmedType)) {
            return {
              error: `Invalid threshold type: '${trimmedType}'. Valid types: ${validTypes.join(', ')}`,
            };
          }

          const numValue = parseInt(value.trim());
          if (isNaN(numValue) || numValue < 0 || numValue > 100) {
            return {
              error: `Invalid threshold value: '${value}'. Must be a number between 0 and 100.`,
            };
          }

          thresholds[trimmedType] = numValue;
        }

        return { thresholds };
      } else {
        // Single threshold applies to all
        const value = parseInt(thresholdString);
        if (isNaN(value) || value < 0 || value > 100) {
          return {
            error: `Invalid threshold value: '${thresholdString}'. Must be a number between 0 and 100.`,
          };
        }

        return {
          thresholds: {
            statements: value,
            branches: value,
            functions: value,
            lines: value,
          },
        };
      }
    } catch (error) {
      logger.warn('Failed to parse threshold string', { thresholdString, error });
      return { error: `Failed to parse threshold: ${error}` };
    }
  }

  private mergeConfigurations(): ConfigValidationResult {
    // Merge configurations in order (later sources override earlier ones)
    let mergedConfig: PartialClaudeTestingConfig = {};
    const allErrors: string[] = [];
    const allWarnings: string[] = [];

    for (const source of this.sources) {
      if (source.loaded) {
        logger.debug(`Merging source: ${source.type}`, { data: source.data });
        mergedConfig = this.deepMerge(
          mergedConfig as Record<string, unknown>,
          source.data as Record<string, unknown>
        ) as PartialClaudeTestingConfig;
      }
      allErrors.push(...source.errors);
      allWarnings.push(...source.warnings);
    }

    logger.debug('Final merged configuration before validation', { mergedConfig });

    // Validate the final merged configuration
    const manager = new ConfigurationManager(this.options.projectPath);

    // Check if we have a complete config (all required fields present)
    const hasAllFields = [
      'include',
      'exclude',
      'testFramework',
      'aiModel',
      'features',
      'generation',
      'coverage',
      'incremental',
      'watch',
      'ai',
      'output',
    ].every((field) => field in mergedConfig);

    let validationResult: ConfigValidationResult;
    if (hasAllFields && mergedConfig.aiModel && mergedConfig.testFramework) {
      // Use the validation-only method for complete configs
      validationResult = manager.validateCompleteConfiguration(mergedConfig as ClaudeTestingConfig);
    } else {
      // Use the normal validation that merges with defaults
      validationResult = manager.validateConfiguration(mergedConfig);
    }

    logger.debug('After validation:', { hasAllFields });

    return {
      valid: validationResult.valid && allErrors.length === 0,
      errors: [...allErrors, ...validationResult.errors],
      warnings: [...allWarnings, ...validationResult.warnings],
      config: validationResult.config,
    };
  }

  private deepMerge<T extends Record<string, unknown>>(target: T, source: Partial<T>): T {
    const result = { ...target };

    for (const key in source) {
      if (source[key] !== undefined) {
        // Include null and false values
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
          // For objects, recursively merge
          result[key] = this.deepMerge(result[key] || ({} as any), source[key] as any);
        } else {
          // For primitives and arrays, override completely
          result[key] = source[key] as any;
        }
      }
    }

    return result;
  }

  private generateSummary() {
    const sourcesLoaded = this.sources.filter((s) => s.loaded).length;
    const sourcesWithErrors = this.sources.filter((s) => s.errors.length > 0).length;
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
