/**
 * Configuration validation utilities for Claude Testing Infrastructure
 */

import { fs, path, logger } from './common-imports';
import { 
  ClaudeTestingConfig, 
  PartialClaudeTestingConfig, 
  ConfigValidationResult,
  DEFAULT_CONFIG,
  TestFramework,
  AIModel,
  TestType,
  CoverageFormat,
  LogLevel,
  OutputFormat
} from '../types/config';

/**
 * Configuration loader and validator
 */
export class ConfigurationManager {
  private configPath: string;
  private config: ClaudeTestingConfig;
  private validated: boolean = false;

  constructor(projectPath: string) {
    this.configPath = path.join(projectPath, '.claude-testing.config.json');
    this.config = { ...DEFAULT_CONFIG };
  }

  /**
   * Load and validate configuration from project directory
   */
  async loadConfiguration(): Promise<ConfigValidationResult> {
    logger.debug(`Looking for configuration at: ${this.configPath}`);

    let userConfig: PartialClaudeTestingConfig = {};
    let configExists = false;

    // Try to load user configuration
    try {
      await fs.access(this.configPath);
      configExists = true;
      
      const configContent = await fs.readFile(this.configPath, 'utf8');
      userConfig = JSON.parse(configContent);
      logger.info(`Loaded configuration from: ${this.configPath}`);
    } catch (error) {
      if (configExists) {
        // File exists but couldn't be parsed
        return {
          valid: false,
          errors: [`Invalid JSON in configuration file: ${(error as Error).message}`],
          warnings: [],
          config: this.config
        };
      } else {
        // File doesn't exist - use defaults
        logger.info('No configuration file found, using defaults');
      }
    }

    // Validate and merge configuration
    const validationResult = this.validateConfiguration(userConfig);
    this.config = validationResult.config;
    this.validated = validationResult.valid;

    return validationResult;
  }

  /**
   * Validate configuration object and merge with defaults
   */
  validateConfiguration(userConfig: PartialClaudeTestingConfig): ConfigValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Start with default configuration
    const mergedConfig: ClaudeTestingConfig = JSON.parse(JSON.stringify(DEFAULT_CONFIG));

    try {
      // Validate and merge each section
      this.validateAndMergeArrays(userConfig, mergedConfig, errors);
      this.validateAndMergeFramework(userConfig, mergedConfig, errors, warnings);
      this.validateAndMergeAIModel(userConfig, mergedConfig, errors, warnings);
      this.validateAndMergeFeatures(userConfig, mergedConfig, errors);
      this.validateAndMergeGeneration(userConfig, mergedConfig, errors, warnings);
      this.validateAndMergeCoverage(userConfig, mergedConfig, errors, warnings);
      this.validateAndMergeIncremental(userConfig, mergedConfig, errors, warnings);
      this.validateAndMergeWatch(userConfig, mergedConfig, errors, warnings);
      this.validateAndMergeAI(userConfig, mergedConfig, errors, warnings);
      this.validateAndMergeOutput(userConfig, mergedConfig, errors, warnings);

      // Cross-validation checks
      this.performCrossValidation(mergedConfig, errors, warnings);

    } catch (error) {
      errors.push(`Configuration validation failed: ${(error as Error).message}`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      config: mergedConfig
    };
  }

  /**
   * Get the validated configuration
   */
  getConfiguration(): ClaudeTestingConfig {
    if (!this.validated) {
      throw new Error('Configuration has not been validated. Call loadConfiguration() first.');
    }
    return this.config;
  }

  /**
   * Check if configuration file exists
   */
  async configurationExists(): Promise<boolean> {
    try {
      await fs.access(this.configPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get configuration file path
   */
  getConfigurationPath(): string {
    return this.configPath;
  }

  // Private validation methods

  private validateAndMergeArrays(
    userConfig: PartialClaudeTestingConfig, 
    mergedConfig: ClaudeTestingConfig, 
    errors: string[]
  ): void {
    // Validate include patterns
    if (userConfig.include !== undefined) {
      if (!Array.isArray(userConfig.include)) {
        errors.push('include must be an array of strings');
      } else if (userConfig.include.some(pattern => typeof pattern !== 'string')) {
        errors.push('All include patterns must be strings');
      } else if (userConfig.include.length === 0) {
        errors.push('include array cannot be empty');
      } else {
        mergedConfig.include = userConfig.include;
      }
    }

    // Validate exclude patterns
    if (userConfig.exclude !== undefined) {
      if (!Array.isArray(userConfig.exclude)) {
        errors.push('exclude must be an array of strings');
      } else if (userConfig.exclude.some(pattern => typeof pattern !== 'string')) {
        errors.push('All exclude patterns must be strings');
      } else {
        mergedConfig.exclude = userConfig.exclude;
      }
    }
  }

  private validateAndMergeFramework(
    userConfig: PartialClaudeTestingConfig, 
    mergedConfig: ClaudeTestingConfig, 
    errors: string[],
    warnings: string[]
  ): void {
    if (userConfig.testFramework !== undefined) {
      const validFrameworks: TestFramework[] = ['jest', 'vitest', 'pytest', 'mocha', 'chai', 'jasmine', 'auto'];
      if (!validFrameworks.includes(userConfig.testFramework as TestFramework)) {
        errors.push(`Invalid testFramework: ${userConfig.testFramework}. Valid options: ${validFrameworks.join(', ')}`);
      } else {
        mergedConfig.testFramework = userConfig.testFramework as TestFramework;
        if (userConfig.testFramework !== 'auto') {
          warnings.push(`Using explicit testFramework: ${userConfig.testFramework}. Consider using "auto" for automatic detection.`);
        }
      }
    }
  }

  private validateAndMergeAIModel(
    userConfig: PartialClaudeTestingConfig, 
    mergedConfig: ClaudeTestingConfig, 
    errors: string[],
    warnings: string[]
  ): void {
    if (userConfig.aiModel !== undefined) {
      const validModels: AIModel[] = ['claude-3-5-sonnet-20241022', 'claude-3-opus-20240229', 'claude-3-haiku-20240307'];
      if (!validModels.includes(userConfig.aiModel as AIModel)) {
        errors.push(`Invalid aiModel: ${userConfig.aiModel}. Valid options: ${validModels.join(', ')}`);
      } else {
        mergedConfig.aiModel = userConfig.aiModel as AIModel;
        if (userConfig.aiModel === 'claude-3-opus-20240229') {
          warnings.push('Using claude-3-opus model will result in higher AI costs. Consider claude-3-5-sonnet for better cost/performance balance.');
        }
      }
    }
  }

  private validateAndMergeFeatures(
    userConfig: PartialClaudeTestingConfig, 
    mergedConfig: ClaudeTestingConfig, 
    errors: string[]
  ): void {
    if (userConfig.features !== undefined) {
      if (typeof userConfig.features !== 'object' || userConfig.features === null) {
        errors.push('features must be an object');
        return;
      }

      const booleanFeatures = [
        'coverage', 'edgeCases', 'integrationTests', 'unitTests', 
        'mocks', 'testData', 'aiGeneration', 'incremental', 'watch'
      ];

      for (const [key, value] of Object.entries(userConfig.features)) {
        if (booleanFeatures.includes(key)) {
          if (typeof value !== 'boolean') {
            errors.push(`features.${key} must be a boolean`);
          } else {
            (mergedConfig.features as any)[key] = value;
          }
        } else {
          errors.push(`Unknown feature flag: ${key}`);
        }
      }
    }
  }

  private validateAndMergeGeneration(
    userConfig: PartialClaudeTestingConfig, 
    mergedConfig: ClaudeTestingConfig, 
    errors: string[],
    warnings: string[]
  ): void {
    if (userConfig.generation !== undefined) {
      if (typeof userConfig.generation !== 'object' || userConfig.generation === null) {
        errors.push('generation must be an object');
        return;
      }

      // Validate maxTestsPerFile
      if (userConfig.generation.maxTestsPerFile !== undefined) {
        if (!Number.isInteger(userConfig.generation.maxTestsPerFile) || 
            userConfig.generation.maxTestsPerFile < 1 || 
            userConfig.generation.maxTestsPerFile > 1000) {
          errors.push('generation.maxTestsPerFile must be an integer between 1 and 1000');
        } else {
          mergedConfig.generation.maxTestsPerFile = userConfig.generation.maxTestsPerFile;
          if (userConfig.generation.maxTestsPerFile > 100) {
            warnings.push('High maxTestsPerFile may result in very large test files');
          }
        }
      }

      // Validate maxTestToSourceRatio
      if (userConfig.generation.maxTestToSourceRatio !== undefined) {
        if (!Number.isInteger(userConfig.generation.maxTestToSourceRatio) || 
            userConfig.generation.maxTestToSourceRatio < 1 || 
            userConfig.generation.maxTestToSourceRatio > 100) {
          errors.push('generation.maxTestToSourceRatio must be an integer between 1 and 100');
        } else {
          mergedConfig.generation.maxTestToSourceRatio = userConfig.generation.maxTestToSourceRatio;
          if (userConfig.generation.maxTestToSourceRatio > 20) {
            warnings.push('High maxTestToSourceRatio may generate excessive test files');
          }
        }
      }

      // Validate naming conventions
      if (userConfig.generation.naming !== undefined) {
        this.validateNamingConventions(userConfig.generation.naming, mergedConfig, errors);
      }

      // Validate test types
      if (userConfig.generation.testTypes !== undefined) {
        this.validateTestTypes(userConfig.generation.testTypes, mergedConfig, errors);
      }
    }
  }

  private validateNamingConventions(naming: any, mergedConfig: ClaudeTestingConfig, errors: string[]): void {
    if (typeof naming !== 'object' || naming === null) {
      errors.push('generation.naming must be an object');
      return;
    }

    if (naming.testFileSuffix !== undefined) {
      if (typeof naming.testFileSuffix !== 'string') {
        errors.push('generation.naming.testFileSuffix must be a string');
      } else {
        mergedConfig.generation.naming!.testFileSuffix = naming.testFileSuffix;
      }
    }

    if (naming.testDirectory !== undefined) {
      if (typeof naming.testDirectory !== 'string') {
        errors.push('generation.naming.testDirectory must be a string');
      } else {
        mergedConfig.generation.naming!.testDirectory = naming.testDirectory;
      }
    }

    if (naming.mockFileSuffix !== undefined) {
      if (typeof naming.mockFileSuffix !== 'string') {
        errors.push('generation.naming.mockFileSuffix must be a string');
      } else {
        mergedConfig.generation.naming!.mockFileSuffix = naming.mockFileSuffix;
      }
    }
  }

  private validateTestTypes(testTypes: any, mergedConfig: ClaudeTestingConfig, errors: string[]): void {
    if (!Array.isArray(testTypes)) {
      errors.push('generation.testTypes must be an array');
      return;
    }

    const validTypes = Object.values(TestType);
    for (const type of testTypes) {
      if (!validTypes.includes(type)) {
        errors.push(`Invalid test type: ${type}. Valid options: ${validTypes.join(', ')}`);
      }
    }

    if (errors.length === 0) {
      mergedConfig.generation.testTypes = testTypes;
    }
  }

  private validateAndMergeCoverage(
    userConfig: PartialClaudeTestingConfig, 
    mergedConfig: ClaudeTestingConfig, 
    errors: string[],
    warnings: string[]
  ): void {
    if (userConfig.coverage !== undefined) {
      if (typeof userConfig.coverage !== 'object' || userConfig.coverage === null) {
        errors.push('coverage must be an object');
        return;
      }

      // Validate enabled flag
      if (userConfig.coverage.enabled !== undefined) {
        if (typeof userConfig.coverage.enabled !== 'boolean') {
          errors.push('coverage.enabled must be a boolean');
        } else {
          mergedConfig.coverage.enabled = userConfig.coverage.enabled;
        }
      }

      // Validate formats
      if (userConfig.coverage.formats !== undefined) {
        const validFormats: CoverageFormat[] = ['html', 'json', 'lcov', 'text', 'markdown', 'xml'];
        if (!Array.isArray(userConfig.coverage.formats)) {
          errors.push('coverage.formats must be an array');
        } else {
          for (const format of userConfig.coverage.formats) {
            if (!validFormats.includes(format as CoverageFormat)) {
              errors.push(`Invalid coverage format: ${format}. Valid options: ${validFormats.join(', ')}`);
            }
          }
          if (errors.length === 0) {
            mergedConfig.coverage.formats = userConfig.coverage.formats as CoverageFormat[];
          }
        }
      }

      // Validate thresholds
      if (userConfig.coverage.thresholds !== undefined) {
        this.validateCoverageThresholds(userConfig.coverage.thresholds, mergedConfig, errors, warnings);
      }
    }
  }

  private validateCoverageThresholds(thresholds: any, mergedConfig: ClaudeTestingConfig, errors: string[], warnings: string[]): void {
    if (typeof thresholds !== 'object' || thresholds === null) {
      errors.push('coverage.thresholds must be an object');
      return;
    }

    // Validate global thresholds
    if (thresholds.global !== undefined) {
      if (typeof thresholds.global !== 'object' || thresholds.global === null) {
        errors.push('coverage.thresholds.global must be an object');
      } else {
        const metrics = ['lines', 'functions', 'branches', 'statements'];
        for (const metric of metrics) {
          if (thresholds.global[metric] !== undefined) {
            if (typeof thresholds.global[metric] !== 'number' || 
                thresholds.global[metric] < 0 || 
                thresholds.global[metric] > 100) {
              errors.push(`coverage.thresholds.global.${metric} must be a number between 0 and 100`);
            } else {
              (mergedConfig.coverage.thresholds!.global as any)[metric] = thresholds.global[metric];
              if (thresholds.global[metric] > 95) {
                warnings.push(`Very high coverage threshold for ${metric}: ${thresholds.global[metric]}%`);
              }
            }
          }
        }
      }
    }
  }

  private validateAndMergeIncremental(
    userConfig: PartialClaudeTestingConfig, 
    mergedConfig: ClaudeTestingConfig, 
    errors: string[],
    warnings: string[]
  ): void {
    if (userConfig.incremental !== undefined) {
      if (typeof userConfig.incremental !== 'object' || userConfig.incremental === null) {
        errors.push('incremental must be an object');
        return;
      }

      // Validate cost limit
      if (userConfig.incremental.costLimit !== undefined) {
        if (typeof userConfig.incremental.costLimit !== 'number' || 
            userConfig.incremental.costLimit < 0.01 || 
            userConfig.incremental.costLimit > 100.00) {
          errors.push('incremental.costLimit must be a number between 0.01 and 100.00');
        } else {
          mergedConfig.incremental.costLimit = userConfig.incremental.costLimit;
          if (userConfig.incremental.costLimit > 20.00) {
            warnings.push('High incremental cost limit may result in unexpected AI charges');
          }
        }
      }

      // Validate max files per update
      if (userConfig.incremental.maxFilesPerUpdate !== undefined) {
        if (!Number.isInteger(userConfig.incremental.maxFilesPerUpdate) || 
            userConfig.incremental.maxFilesPerUpdate < 1 || 
            userConfig.incremental.maxFilesPerUpdate > 1000) {
          errors.push('incremental.maxFilesPerUpdate must be an integer between 1 and 1000');
        } else {
          mergedConfig.incremental.maxFilesPerUpdate = userConfig.incremental.maxFilesPerUpdate;
        }
      }
    }
  }

  private validateAndMergeWatch(
    userConfig: PartialClaudeTestingConfig, 
    mergedConfig: ClaudeTestingConfig, 
    errors: string[],
    warnings: string[]
  ): void {
    if (userConfig.watch !== undefined) {
      if (typeof userConfig.watch !== 'object' || userConfig.watch === null) {
        errors.push('watch must be an object');
        return;
      }

      // Validate debounce
      if (userConfig.watch.debounceMs !== undefined) {
        if (!Number.isInteger(userConfig.watch.debounceMs) || 
            userConfig.watch.debounceMs < 100 || 
            userConfig.watch.debounceMs > 10000) {
          errors.push('watch.debounceMs must be an integer between 100 and 10000');
        } else {
          mergedConfig.watch.debounceMs = userConfig.watch.debounceMs;
          if (userConfig.watch.debounceMs < 500) {
            warnings.push('Low watch debounce may cause excessive test generation');
          }
        }
      }
    }
  }

  private validateAndMergeAI(
    userConfig: PartialClaudeTestingConfig, 
    mergedConfig: ClaudeTestingConfig, 
    errors: string[],
    warnings: string[]
  ): void {
    if (userConfig.ai !== undefined) {
      if (typeof userConfig.ai !== 'object' || userConfig.ai === null) {
        errors.push('ai must be an object');
        return;
      }

      // Validate max cost
      if (userConfig.ai.maxCost !== undefined) {
        if (typeof userConfig.ai.maxCost !== 'number' || 
            userConfig.ai.maxCost < 0.01 || 
            userConfig.ai.maxCost > 100.00) {
          errors.push('ai.maxCost must be a number between 0.01 and 100.00');
        } else {
          mergedConfig.ai.maxCost = userConfig.ai.maxCost;
          if (userConfig.ai.maxCost > 50.00) {
            warnings.push('High AI max cost may result in unexpected charges');
          }
        }
      }

      // Validate timeout
      if (userConfig.ai.timeout !== undefined) {
        if (!Number.isInteger(userConfig.ai.timeout) || 
            userConfig.ai.timeout < 30000 || 
            userConfig.ai.timeout > 1800000) {
          errors.push('ai.timeout must be an integer between 30000 and 1800000 (30s to 30m)');
        } else {
          mergedConfig.ai.timeout = userConfig.ai.timeout;
        }
      }

      // Validate temperature
      if (userConfig.ai.temperature !== undefined) {
        if (typeof userConfig.ai.temperature !== 'number' || 
            userConfig.ai.temperature < 0.0 || 
            userConfig.ai.temperature > 1.0) {
          errors.push('ai.temperature must be a number between 0.0 and 1.0');
        } else {
          mergedConfig.ai.temperature = userConfig.ai.temperature;
        }
      }
    }
  }

  private validateAndMergeOutput(
    userConfig: PartialClaudeTestingConfig, 
    mergedConfig: ClaudeTestingConfig, 
    errors: string[],
    _warnings: string[]
  ): void {
    if (userConfig.output !== undefined) {
      if (typeof userConfig.output !== 'object' || userConfig.output === null) {
        errors.push('output must be an object');
        return;
      }

      // Validate log level
      if (userConfig.output.logLevel !== undefined) {
        const validLevels: LogLevel[] = ['error', 'warn', 'info', 'debug', 'verbose'];
        if (!validLevels.includes(userConfig.output.logLevel as LogLevel)) {
          errors.push(`Invalid logLevel: ${userConfig.output.logLevel}. Valid options: ${validLevels.join(', ')}`);
        } else {
          mergedConfig.output.logLevel = userConfig.output.logLevel as LogLevel;
        }
      }

      // Validate formats
      if (userConfig.output.formats !== undefined) {
        const validFormats: OutputFormat[] = ['console', 'json', 'markdown', 'xml', 'html', 'junit'];
        if (!Array.isArray(userConfig.output.formats)) {
          errors.push('output.formats must be an array');
        } else {
          for (const format of userConfig.output.formats) {
            if (!validFormats.includes(format as OutputFormat)) {
              errors.push(`Invalid output format: ${format}. Valid options: ${validFormats.join(', ')}`);
            }
          }
          if (errors.length === 0) {
            mergedConfig.output.formats = userConfig.output.formats as OutputFormat[];
          }
        }
      }
    }
  }

  private performCrossValidation(config: ClaudeTestingConfig, _errors: string[], warnings: string[]): void {
    // Check if AI features are enabled but AI generation is disabled
    if (!config.features.aiGeneration && (config.features.edgeCases || config.ai.enabled)) {
      warnings.push('AI features are configured but aiGeneration is disabled');
    }

    // Check if watch mode is enabled without incremental
    if (config.features.watch && !config.features.incremental) {
      warnings.push('Watch mode is enabled but incremental testing is disabled');
    }

    // Check if coverage is disabled but coverage options are set
    if (!config.features.coverage && config.coverage.enabled) {
      warnings.push('Coverage features are disabled but coverage is enabled');
    }

    // Validate include/exclude patterns don't conflict
    const hasJavaScript = config.include.some(pattern => pattern.includes('.js') || pattern.includes('.ts'));
    const hasPython = config.include.some(pattern => pattern.includes('.py'));
    
    if (hasJavaScript && hasPython && config.testFramework !== 'auto') {
      warnings.push('Mixed language project detected. Consider using testFramework: "auto"');
    }
  }
}

/**
 * Convenience function to load and validate configuration
 */
export async function loadAndValidateConfig(projectPath: string): Promise<ConfigValidationResult> {
  const manager = new ConfigurationManager(projectPath);
  return await manager.loadConfiguration();
}

/**
 * Convenience function to validate configuration object
 */
export function validateConfig(config: PartialClaudeTestingConfig): ConfigValidationResult {
  const manager = new ConfigurationManager('.');
  return manager.validateConfiguration(config);
}