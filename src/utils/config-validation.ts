/**
 * Configuration validation utilities for Claude Testing Infrastructure
 */

import { fs, path, logger } from './common-imports';
import {
  DEFAULT_CONFIG,
  TestType,
  type ClaudeTestingConfig,
  type PartialClaudeTestingConfig,
  type ConfigValidationResult,
  type TestFramework,
  type AIModel,
  type CoverageFormat,
  type LogLevel,
  type OutputFormat,
} from '../types/config';
import {
  ConfigErrorFormatter,
  findSimilarFields,
  type ConfigErrorDetails,
} from './config-error-messages';

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
      userConfig = JSON.parse(configContent) as Record<string, unknown>;
      logger.debug(`Loaded configuration from: ${this.configPath}`);
    } catch (error) {
      if (configExists) {
        // File exists but couldn't be parsed
        return {
          valid: false,
          errors: [`Invalid JSON in configuration file: ${(error as Error).message}`],
          warnings: [],
          config: this.config,
        };
      } else {
        // File doesn't exist - use defaults
        logger.debug('No configuration file found, using defaults');
      }
    }

    // Validate and merge configuration
    const validationResult = this.validateConfiguration(userConfig);
    this.config = validationResult.config;
    this.validated = validationResult.valid;

    return validationResult;
  }

  /**
   * Validate a complete configuration without merging with defaults
   */
  validateCompleteConfiguration(config: ClaudeTestingConfig): ConfigValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // For complete configs, we just validate without merging
    // Reuse the existing validation methods by passing the config as both user and merged
    this.validateAndMergeArrays(config, config, errors, warnings);
    this.validateAndMergeFramework(config, config, errors, warnings);
    this.validateAndMergeAIModel(config, config, errors, warnings);
    this.validateAndMergeFeatures(config, config, errors);
    this.validateAndMergeGeneration(config, config, errors, warnings);
    this.validateAndMergeCoverage(config, config, errors, warnings);
    this.validateAndMergeIncremental(config, config, errors, warnings);
    this.validateAndMergeWatch(config, config, errors, warnings);
    this.validateAndMergeAI(config, config, errors, warnings);
    this.validateAndMergeOutput(config, config, errors, warnings);

    // Cross-validation checks
    this.performCrossValidation(config, errors, warnings);

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      config: config,
    };
  }

  /**
   * Validate configuration object and merge with defaults
   */
  validateConfiguration(userConfig: PartialClaudeTestingConfig): ConfigValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if userConfig already has all required fields (i.e., it's a merged config)
    const isAlreadyMerged = this.hasAllRequiredFields(userConfig);

    // Start with default configuration or use the provided config if already merged
    const mergedConfig: ClaudeTestingConfig = isAlreadyMerged
      ? (JSON.parse(JSON.stringify(userConfig)) as ClaudeTestingConfig)
      : (JSON.parse(JSON.stringify(DEFAULT_CONFIG)) as ClaudeTestingConfig);

    try {
      // If already merged, we need to validate the complete config
      // without re-applying defaults
      if (isAlreadyMerged) {
        // For already merged configs, we pass the config as both user and merged
        // This ensures validation happens but values aren't overwritten
        const completeConfig = mergedConfig;
        this.validateAndMergeArrays(completeConfig, mergedConfig, errors, warnings);
        this.validateAndMergeFramework(completeConfig, mergedConfig, errors, warnings);
        this.validateAndMergeAIModel(completeConfig, mergedConfig, errors, warnings);
        this.validateAndMergeFeatures(completeConfig, mergedConfig, errors);
        this.validateAndMergeGeneration(completeConfig, mergedConfig, errors, warnings);
        this.validateAndMergeCoverage(completeConfig, mergedConfig, errors, warnings);
        this.validateAndMergeIncremental(completeConfig, mergedConfig, errors, warnings);
        this.validateAndMergeWatch(completeConfig, mergedConfig, errors, warnings);
        this.validateAndMergeAI(completeConfig, mergedConfig, errors, warnings);
        this.validateAndMergeOutput(completeConfig, mergedConfig, errors, warnings);
      } else {
        // Validate and merge each section normally
        this.validateAndMergeArrays(userConfig, mergedConfig, errors, warnings);
        this.validateAndMergeFramework(userConfig, mergedConfig, errors, warnings);
        this.validateAndMergeAIModel(userConfig, mergedConfig, errors, warnings);
        this.validateAndMergeFeatures(userConfig, mergedConfig, errors);
        this.validateAndMergeGeneration(userConfig, mergedConfig, errors, warnings);
        this.validateAndMergeCoverage(userConfig, mergedConfig, errors, warnings);
        this.validateAndMergeIncremental(userConfig, mergedConfig, errors, warnings);
        this.validateAndMergeWatch(userConfig, mergedConfig, errors, warnings);
        this.validateAndMergeAI(userConfig, mergedConfig, errors, warnings);
        this.validateAndMergeOutput(userConfig, mergedConfig, errors, warnings);
      }

      // Validate legacy aiOptions - merge with existing if present
      if (userConfig.aiOptions !== undefined) {
        if (!mergedConfig.aiOptions) {
          mergedConfig.aiOptions = {};
        }
        // Merge user aiOptions with defaults
        Object.assign(mergedConfig.aiOptions, userConfig.aiOptions);
        this.validateLegacyAIOptions(userConfig.aiOptions, mergedConfig, errors, warnings);
      }

      // Handle root-level fields
      if (userConfig.costLimit !== undefined) {
        if (typeof userConfig.costLimit !== 'number') {
          const warning = ConfigErrorFormatter.formatError({
            field: 'costLimit',
            value: userConfig.costLimit,
            message: 'Should be a number',
            suggestion: 'Use a numeric value for cost limits',
            example: '10.00',
          });
          warnings.push(warning);
        } else {
          mergedConfig.costLimit = userConfig.costLimit;
        }
      }
      if (userConfig.dryRun !== undefined) {
        if (typeof userConfig.dryRun !== 'boolean') {
          const warning = ConfigErrorFormatter.formatError({
            field: 'dryRun',
            value: userConfig.dryRun,
            message: 'Should be a boolean',
            suggestion: 'Use true or false',
            example: 'true',
          });
          warnings.push(warning);
        } else {
          mergedConfig.dryRun = userConfig.dryRun;
        }
      }
      // Cross-validation checks
      this.performCrossValidation(mergedConfig, errors, warnings);
    } catch (error) {
      errors.push(`Configuration validation failed: ${(error as Error).message}`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      config: mergedConfig,
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

  /**
   * Check if a configuration object has all required fields
   * (i.e., it's already been merged with defaults)
   */
  private hasAllRequiredFields(config: PartialClaudeTestingConfig): boolean {
    // Check for presence of all required top-level fields from DEFAULT_CONFIG
    const requiredFields = [
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
    ];

    return requiredFields.every((field) => field in config);
  }

  // Private validation methods

  private validateAndMergeArrays(
    userConfig: PartialClaudeTestingConfig,
    mergedConfig: ClaudeTestingConfig,
    errors: string[],
    warnings?: string[]
  ): void {
    // Validate include patterns
    if (userConfig.include !== undefined) {
      if (!Array.isArray(userConfig.include)) {
        const warning = ConfigErrorFormatter.formatError({
          field: 'include',
          value: userConfig.include,
          message: 'Should be an array of strings',
          suggestion: 'Use an array of glob patterns',
          example: '["src/**/*.js", "src/**/*.ts"]',
        });
        if (warnings) warnings.push(warning);
      } else if (userConfig.include.some((pattern) => typeof pattern !== 'string')) {
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
        const warning = ConfigErrorFormatter.formatError({
          field: 'exclude',
          value: userConfig.exclude,
          message: 'Should be an array of strings',
          suggestion: 'Use an array of glob patterns',
          example: '["**/*.test.js", "node_modules/**"]',
        });
        if (warnings) warnings.push(warning);
      } else if (userConfig.exclude.some((pattern) => typeof pattern !== 'string')) {
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
      // Check type first
      if (typeof userConfig.testFramework !== 'string') {
        const warning = ConfigErrorFormatter.formatError({
          field: 'testFramework',
          value: userConfig.testFramework,
          message: 'Should be a string',
          suggestion: 'Use one of: jest, vitest, pytest, mocha, chai, jasmine, auto',
          example: 'jest',
        });
        warnings.push(warning);
        return;
      }

      const validFrameworks: TestFramework[] = [
        'jest',
        'vitest',
        'pytest',
        'mocha',
        'chai',
        'jasmine',
        'auto',
      ];
      if (!validFrameworks.includes(userConfig.testFramework)) {
        const error = ConfigErrorFormatter.formatError(
          ConfigErrorFormatter.templates.invalidEnum(
            'testFramework',
            userConfig.testFramework,
            validFrameworks
          )
        );
        errors.push(error);
      } else {
        mergedConfig.testFramework = userConfig.testFramework;
        if (userConfig.testFramework !== 'auto') {
          warnings.push(
            `Using explicit testFramework: ${userConfig.testFramework}. Consider using "auto" for automatic detection.`
          );
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
      const validModels: AIModel[] = [
        'claude-3-5-sonnet-20241022',
        'claude-3-opus-20240229',
        'claude-3-haiku-20240307',
      ];
      if (!validModels.includes(userConfig.aiModel)) {
        // Check if it's a common alias that needs to be mapped
        const modelAliases: Record<string, string> = {
          sonnet: 'claude-3-5-sonnet-20241022',
          opus: 'claude-3-opus-20240229',
          haiku: 'claude-3-haiku-20240307',
          'claude-3-sonnet': 'claude-3-5-sonnet-20241022',
        };

        const suggestion = modelAliases[userConfig.aiModel.toLowerCase()]
          ? `Use '${modelAliases[userConfig.aiModel.toLowerCase()]}' or configure model aliases`
          : undefined;

        const errorDetails: ConfigErrorDetails = {
          field: 'aiModel',
          value: userConfig.aiModel,
          message: `Invalid AI model identifier. Valid options: ${validModels.join(', ')}`,
          ...(suggestion ? { suggestion } : {}),
          example: 'claude-3-5-sonnet-20241022',
          documentation: 'https://docs.anthropic.com/claude-testing/ai-models',
        };
        const error = ConfigErrorFormatter.formatError(errorDetails);
        errors.push(error);
      } else {
        mergedConfig.aiModel = userConfig.aiModel;
        if (userConfig.aiModel === 'claude-3-opus-20240229') {
          warnings.push(
            'Using claude-3-opus model will result in higher AI costs. Consider claude-3-5-sonnet for better cost/performance balance.'
          );
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
        'coverage',
        'edgeCases',
        'integrationTests',
        'unitTests',
        'mocks',
        'testData',
        'aiGeneration',
        'incremental',
        'watch',
        'logicalTests',
        'structuralTests',
      ];

      for (const [key, value] of Object.entries(userConfig.features)) {
        if (booleanFeatures.includes(key)) {
          if (typeof value !== 'boolean') {
            const error = ConfigErrorFormatter.formatError(
              ConfigErrorFormatter.templates.invalidType(
                `features.${key}`,
                value,
                'boolean',
                typeof value
              )
            );
            errors.push(error);
          } else {
            (mergedConfig.features as Record<string, boolean>)[key] = value;
          }
        } else {
          const similarFields = findSimilarFields(key, booleanFeatures);
          const error = ConfigErrorFormatter.formatError(
            ConfigErrorFormatter.templates.unknownField(
              `features.${key}`,
              value,
              similarFields.map((f) => `features.${f}`)
            )
          );
          errors.push(error);
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
        const error = ConfigErrorFormatter.formatError(
          ConfigErrorFormatter.templates.invalidType(
            'generation',
            userConfig.generation,
            'object',
            userConfig.generation === null ? 'null' : typeof userConfig.generation
          )
        );
        errors.push(error);
        return;
      }

      // Validate maxTestsPerFile
      if (userConfig.generation.maxTestsPerFile !== undefined) {
        if (
          !Number.isInteger(userConfig.generation.maxTestsPerFile) ||
          userConfig.generation.maxTestsPerFile < 1 ||
          userConfig.generation.maxTestsPerFile > 1000
        ) {
          const error = ConfigErrorFormatter.formatError(
            ConfigErrorFormatter.templates.outOfRange(
              'generation.maxTestsPerFile',
              userConfig.generation.maxTestsPerFile,
              1,
              1000
            )
          );
          errors.push(error);
        } else {
          mergedConfig.generation.maxTestsPerFile = userConfig.generation.maxTestsPerFile;
          if (userConfig.generation.maxTestsPerFile > 100) {
            warnings.push('High maxTestsPerFile may result in very large test files');
          }
        }
      }

      // Validate maxTestToSourceRatio
      if (userConfig.generation.maxTestToSourceRatio !== undefined) {
        if (
          typeof userConfig.generation.maxTestToSourceRatio !== 'number' ||
          isNaN(userConfig.generation.maxTestToSourceRatio) ||
          userConfig.generation.maxTestToSourceRatio < 0.1 ||
          userConfig.generation.maxTestToSourceRatio > 100
        ) {
          const error = ConfigErrorFormatter.formatError(
            ConfigErrorFormatter.templates.outOfRange(
              'generation.maxTestToSourceRatio',
              userConfig.generation.maxTestToSourceRatio,
              0.1,
              100
            )
          );
          errors.push(error);
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

      // Validate maxRetries
      if (userConfig.generation.maxRetries !== undefined) {
        // Handle string numbers gracefully
        const value = userConfig.generation.maxRetries;
        if (typeof value === 'string' && /^\d+$/.test(value)) {
          const warning = ConfigErrorFormatter.formatError({
            field: 'generation.maxRetries',
            value: value,
            message: 'Should be a number, not a string',
            suggestion: 'Use numeric value without quotes',
            example: '3',
          });
          warnings.push(warning);
          // Still parse and use it
          mergedConfig.generation.maxRetries = parseInt(value, 10);
        } else if (!Number.isInteger(value) || value < 0 || value > 10) {
          const warning = ConfigErrorFormatter.formatError({
            field: 'generation.maxRetries',
            value: value,
            message: `Value should be between 0 and 10 for optimal performance`,
            suggestion: 'Use a value between 1 and 3 for best results',
            example: '3',
          });
          warnings.push(warning);
        } else {
          mergedConfig.generation.maxRetries = value;
        }
      }

      // Validate batchSize
      if (userConfig.generation.batchSize !== undefined) {
        if (
          !Number.isInteger(userConfig.generation.batchSize) ||
          userConfig.generation.batchSize < 1 ||
          userConfig.generation.batchSize > 100
        ) {
          const warning = ConfigErrorFormatter.formatError({
            field: 'generation.batchSize',
            value: userConfig.generation.batchSize,
            message: `Value should be between 1 and 100`,
            suggestion: 'Use a value between 5 and 20 for best performance',
            example: '10',
          });
          warnings.push(warning);
        } else {
          mergedConfig.generation.batchSize = userConfig.generation.batchSize;
        }
      }

      // Validate timeoutMs
      if (userConfig.generation.timeoutMs !== undefined) {
        if (
          typeof userConfig.generation.timeoutMs !== 'number' ||
          userConfig.generation.timeoutMs < 0
        ) {
          const warning = ConfigErrorFormatter.formatError({
            field: 'generation.timeoutMs',
            value: userConfig.generation.timeoutMs,
            message: `Value must be a positive number`,
            suggestion: 'Use a value between 30000 and 300000 (30 seconds to 5 minutes)',
            example: '60000',
          });
          warnings.push(warning);
        } else {
          mergedConfig.generation.timeoutMs = userConfig.generation.timeoutMs;
        }
      }
    }
  }

  private validateNamingConventions(
    naming: unknown,
    mergedConfig: ClaudeTestingConfig,
    errors: string[]
  ): void {
    if (typeof naming !== 'object' || naming === null) {
      errors.push('generation.naming must be an object');
      return;
    }

    const namingObj = naming as Record<string, unknown>;

    if (namingObj.testFileSuffix !== undefined) {
      if (typeof namingObj.testFileSuffix !== 'string') {
        errors.push('generation.naming.testFileSuffix must be a string');
      } else {
        mergedConfig.generation.naming!.testFileSuffix = namingObj.testFileSuffix;
      }
    }

    if (namingObj.testDirectory !== undefined) {
      if (typeof namingObj.testDirectory !== 'string') {
        errors.push('generation.naming.testDirectory must be a string');
      } else {
        mergedConfig.generation.naming!.testDirectory = namingObj.testDirectory;
      }
    }

    if (namingObj.mockFileSuffix !== undefined) {
      if (typeof namingObj.mockFileSuffix !== 'string') {
        errors.push('generation.naming.mockFileSuffix must be a string');
      } else {
        mergedConfig.generation.naming!.mockFileSuffix = namingObj.mockFileSuffix;
      }
    }
  }

  private validateTestTypes(
    testTypes: unknown,
    mergedConfig: ClaudeTestingConfig,
    errors: string[]
  ): void {
    if (!Array.isArray(testTypes)) {
      errors.push('generation.testTypes must be an array');
      return;
    }

    const validTypes = Object.values(TestType);
    for (const type of testTypes) {
      if (!validTypes.includes(type as TestType)) {
        errors.push(`Invalid test type: ${type}. Valid options: ${validTypes.join(', ')}`);
      }
    }

    if (errors.length === 0) {
      mergedConfig.generation.testTypes = testTypes as TestType[];
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
            if (!validFormats.includes(format)) {
              errors.push(
                `Invalid coverage format: ${format}. Valid options: ${validFormats.join(', ')}`
              );
            }
          }
          if (errors.length === 0) {
            mergedConfig.coverage.formats = userConfig.coverage.formats;
          }
        }
      }

      // Validate thresholds
      if (userConfig.coverage.thresholds !== undefined) {
        this.validateCoverageThresholds(
          userConfig.coverage.thresholds,
          mergedConfig,
          errors,
          warnings
        );
      }

      // Validate reporters
      if (userConfig.coverage.reporters !== undefined) {
        if (!Array.isArray(userConfig.coverage.reporters)) {
          errors.push('coverage.reporters must be an array');
        } else {
          const validReporters = ['text', 'lcov', 'html', 'json', 'clover', 'cobertura'];
          const invalidReporters: string[] = [];

          for (const reporter of userConfig.coverage.reporters) {
            if (!validReporters.includes(reporter)) {
              invalidReporters.push(reporter);
            }
          }

          if (invalidReporters.length > 0) {
            const warning = ConfigErrorFormatter.formatError({
              field: 'coverage.reporters',
              value: invalidReporters,
              message: `Invalid coverage reporter(s): ${invalidReporters.join(', ')}`,
              suggestion: `Valid reporters: ${validReporters.join(', ')}`,
              example: '["text", "lcov", "html"]',
            });
            warnings.push(warning);
          }

          mergedConfig.coverage.reporters = userConfig.coverage.reporters;
        }
      }

      // Other coverage fields
      if (userConfig.coverage.outputDir !== undefined) {
        mergedConfig.coverage.outputDir = userConfig.coverage.outputDir;
      }
      if (userConfig.coverage.includeUntested !== undefined) {
        mergedConfig.coverage.includeUntested = userConfig.coverage.includeUntested;
      }
    }
  }

  private validateCoverageThresholds(
    thresholds: unknown,
    mergedConfig: ClaudeTestingConfig,
    errors: string[],
    warnings: string[]
  ): void {
    if (typeof thresholds !== 'object' || thresholds === null) {
      errors.push('coverage.thresholds must be an object');
      return;
    }

    const thresholdsObj = thresholds as Record<string, unknown>;

    // Validate global thresholds
    if (thresholdsObj.global !== undefined) {
      if (typeof thresholdsObj.global !== 'object' || thresholdsObj.global === null) {
        errors.push('coverage.thresholds.global must be an object');
      } else {
        const globalObj = thresholdsObj.global as Record<string, unknown>;
        const metrics = ['lines', 'functions', 'branches', 'statements'];
        for (const metric of metrics) {
          if (globalObj[metric] !== undefined) {
            const value = globalObj[metric];
            if (typeof value !== 'number') {
              const warning = ConfigErrorFormatter.formatError({
                field: `coverage.thresholds.global.${metric}`,
                value: value,
                message: 'Must be a number',
                suggestion: 'Use a numeric value between 0 and 100',
                example: '80',
              });
              warnings.push(warning);
            } else if (value < 0 || value > 100) {
              const warning = ConfigErrorFormatter.formatError({
                field: `coverage.thresholds.global.${metric}`,
                value: value,
                message: 'Value out of range (must be 0-100)',
                suggestion: 'Use a value between 50 and 90 for practical thresholds',
                example: '80',
              });
              warnings.push(warning);
            } else {
              (mergedConfig.coverage.thresholds!.global as Record<string, number>)[metric] = value;
              if (value > 95) {
                warnings.push(`Very high coverage threshold for ${metric}: ${value}%`);
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
        if (
          typeof userConfig.incremental.costLimit !== 'number' ||
          userConfig.incremental.costLimit < 0.01 ||
          userConfig.incremental.costLimit > 100.0
        ) {
          errors.push('incremental.costLimit must be a number between 0.01 and 100.00');
        } else {
          mergedConfig.incremental.costLimit = userConfig.incremental.costLimit;
          if (userConfig.incremental.costLimit > 20.0) {
            warnings.push('High incremental cost limit may result in unexpected AI charges');
          }
        }
      }

      // Validate max files per update
      if (userConfig.incremental.maxFilesPerUpdate !== undefined) {
        if (
          !Number.isInteger(userConfig.incremental.maxFilesPerUpdate) ||
          userConfig.incremental.maxFilesPerUpdate < 1 ||
          userConfig.incremental.maxFilesPerUpdate > 1000
        ) {
          errors.push('incremental.maxFilesPerUpdate must be an integer between 1 and 1000');
        } else {
          mergedConfig.incremental.maxFilesPerUpdate = userConfig.incremental.maxFilesPerUpdate;
        }
      }

      // Validate showStats
      if (userConfig.incremental.showStats !== undefined) {
        if (typeof userConfig.incremental.showStats !== 'boolean') {
          errors.push('incremental.showStats must be a boolean');
        } else {
          mergedConfig.incremental.showStats = userConfig.incremental.showStats;
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
        if (
          !Number.isInteger(userConfig.watch.debounceMs) ||
          userConfig.watch.debounceMs < 100 ||
          userConfig.watch.debounceMs > 10000
        ) {
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
        if (
          typeof userConfig.ai.maxCost !== 'number' ||
          userConfig.ai.maxCost < 0.01 ||
          userConfig.ai.maxCost > 100.0
        ) {
          errors.push('ai.maxCost must be a number between 0.01 and 100.00');
        } else {
          mergedConfig.ai.maxCost = userConfig.ai.maxCost;
          if (userConfig.ai.maxCost > 50.0) {
            warnings.push('High AI max cost may result in unexpected charges');
          }
        }
      }

      // Validate timeout
      if (userConfig.ai.timeout !== undefined) {
        if (
          !Number.isInteger(userConfig.ai.timeout) ||
          userConfig.ai.timeout < 30000 ||
          userConfig.ai.timeout > 1800000
        ) {
          errors.push('ai.timeout must be an integer between 30000 and 1800000 (30s to 30m)');
        } else {
          mergedConfig.ai.timeout = userConfig.ai.timeout;
        }
      }

      // Validate temperature
      if (userConfig.ai.temperature !== undefined) {
        if (
          typeof userConfig.ai.temperature !== 'number' ||
          userConfig.ai.temperature < 0.0 ||
          userConfig.ai.temperature > 1.0
        ) {
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
        if (!validLevels.includes(userConfig.output.logLevel)) {
          errors.push(
            `Invalid logLevel: ${userConfig.output.logLevel}. Valid options: ${validLevels.join(', ')}`
          );
        } else {
          mergedConfig.output.logLevel = userConfig.output.logLevel;
        }
      }

      // Validate formats
      if (userConfig.output.formats !== undefined) {
        const validFormats: OutputFormat[] = [
          'console',
          'json',
          'markdown',
          'xml',
          'html',
          'junit',
        ];
        if (!Array.isArray(userConfig.output.formats)) {
          errors.push('output.formats must be an array');
        } else {
          for (const format of userConfig.output.formats) {
            if (!validFormats.includes(format)) {
              errors.push(
                `Invalid output format: ${format}. Valid options: ${validFormats.join(', ')}`
              );
            }
          }
          if (errors.length === 0) {
            mergedConfig.output.formats = userConfig.output.formats;
          }
        }
      }

      // Validate file
      if (userConfig.output.file !== undefined) {
        if (typeof userConfig.output.file !== 'string') {
          errors.push('output.file must be a string');
        } else {
          mergedConfig.output.file = userConfig.output.file;
        }
      }

      // Validate format (singular)
      if (userConfig.output.format !== undefined) {
        const validFormats: OutputFormat[] = [
          'console',
          'json',
          'markdown',
          'xml',
          'html',
          'junit',
        ];
        if (!validFormats.includes(userConfig.output.format)) {
          const error = ConfigErrorFormatter.formatError({
            field: 'output.format',
            value: userConfig.output.format,
            message: `Invalid output format`,
            suggestion: `Valid formats: ${validFormats.join(', ')}`,
            example: 'json',
          });
          errors.push(error);
        } else {
          mergedConfig.output.format = userConfig.output.format;
        }
      }
    }
  }

  private validateLegacyAIOptions(
    aiOptions: unknown,
    mergedConfig: ClaudeTestingConfig,
    errors: string[],
    warnings: string[]
  ): void {
    if (typeof aiOptions !== 'object' || aiOptions === null) {
      errors.push('aiOptions must be an object');
      return;
    }

    const aiOptionsObj = aiOptions as Record<string, unknown>;

    // Validate fields that exist in AIOptions
    if (aiOptionsObj.maxTokens !== undefined) {
      if (!Number.isInteger(aiOptionsObj.maxTokens)) {
        errors.push('aiOptions.maxTokens must be an integer');
      } else if (
        (aiOptionsObj.maxTokens as number) < 256 ||
        (aiOptionsObj.maxTokens as number) > 8192
      ) {
        const warning = ConfigErrorFormatter.formatError({
          field: 'aiOptions.maxTokens',
          value: aiOptionsObj.maxTokens,
          message: `Value should be between 256 and 8192`,
          suggestion: 'Use a value between 1000 and 4000 for optimal results',
          example: '2000',
        });
        warnings.push(warning);
      } else {
        if (mergedConfig.aiOptions) {
          mergedConfig.aiOptions.maxTokens = aiOptionsObj.maxTokens as number;
        }
      }
    }

    // Validate temperature
    if (aiOptionsObj.temperature !== undefined) {
      if (
        typeof aiOptionsObj.temperature !== 'number' ||
        aiOptionsObj.temperature < 0 ||
        aiOptionsObj.temperature > 1
      ) {
        const warning = ConfigErrorFormatter.formatError({
          field: 'aiOptions.temperature',
          value: aiOptionsObj.temperature,
          message: `Value must be between 0.0 and 1.0`,
          suggestion: 'Use a value between 0.2 and 0.8 for balanced results',
          example: '0.7',
        });
        warnings.push(warning);
      }
    }

    // Map other fields to their proper locations
    if (aiOptionsObj.model !== undefined) {
      mergedConfig.aiModel = aiOptionsObj.model as AIModel;
    }
    if (aiOptionsObj.maxCost !== undefined) {
      mergedConfig.ai.maxCost = aiOptionsObj.maxCost as number;
    }
    if (aiOptionsObj.temperature !== undefined) {
      mergedConfig.ai.temperature = aiOptionsObj.temperature as number;
    }
  }

  private performCrossValidation(
    config: ClaudeTestingConfig,
    errors: string[],
    warnings: string[]
  ): void {
    // Check if unit tests and integration tests are both disabled
    if (!config.features.unitTests && !config.features.integrationTests) {
      const error = ConfigErrorFormatter.formatError({
        field: 'features',
        value: { unitTests: false, integrationTests: false },
        message: 'Both unit tests and integration tests are disabled',
        suggestion: 'Enable at least one test type',
        example: '"features": { "unitTests": true, "integrationTests": true }',
      });
      errors.push(error);
    }

    // Check if both logical and structural tests are disabled
    if (!config.features.logicalTests && !config.features.structuralTests) {
      const warning = ConfigErrorFormatter.formatError({
        field: 'features',
        value: { logicalTests: false, structuralTests: false },
        message: 'Both structural and logical tests are disabled. No tests will be generated.',
        suggestion: 'Enable at least one test generation type',
        example: '"features": { "structuralTests": true, "logicalTests": true }',
      });
      warnings.push(warning);
    }
    // Check if AI features are enabled but AI generation is disabled
    if (
      !config.features.aiGeneration &&
      (config.features.edgeCases ?? (false || config.ai.enabled) ?? false)
    ) {
      const warning = ConfigErrorFormatter.formatError(
        ConfigErrorFormatter.templates.conflictingValues(
          'features.aiGeneration',
          false,
          'features.edgeCases or ai.enabled',
          true
        )
      );
      warnings.push(warning);
    }

    // Check if watch mode is enabled without incremental
    if (config.features.watch && !config.features.incremental) {
      const warning = ConfigErrorFormatter.formatError({
        field: 'features.watch',
        value: true,
        message: 'Watch mode requires incremental testing to be effective',
        suggestion: "Enable 'features.incremental' for optimal watch mode performance",
        example: '"features": { "watch": true, "incremental": true }',
      });
      warnings.push(warning);
    }

    // Check if coverage is disabled but coverage options are set
    if (!config.features.coverage && config.coverage.enabled) {
      const warning = ConfigErrorFormatter.formatError(
        ConfigErrorFormatter.templates.conflictingValues(
          'features.coverage',
          false,
          'coverage.enabled',
          true
        )
      );
      warnings.push(warning);
    }

    // Validate include/exclude patterns don't conflict
    if (!Array.isArray(config.include) || !Array.isArray(config.exclude)) {
      // Skip cross-validation if include/exclude aren't arrays
      return;
    }

    const hasJavaScript = config.include.some(
      (pattern) => pattern.includes('.js') || pattern.includes('.ts')
    );
    const hasPython = config.include.some((pattern) => pattern.includes('.py'));

    if (hasJavaScript && hasPython && config.testFramework !== 'auto') {
      const warning = ConfigErrorFormatter.formatError({
        field: 'testFramework',
        value: config.testFramework,
        message: 'Mixed language project detected (JavaScript and Python)',
        suggestion: 'Use "auto" for automatic framework detection in multi-language projects',
        example: '"testFramework": "auto"',
      });
      warnings.push(warning);
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
