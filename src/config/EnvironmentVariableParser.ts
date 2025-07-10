/**
 * Environment Variable Parser - Configuration Service Module
 *
 * This module provides environment variable parsing functionality, including
 * type conversion, nested object assignment, and special case mapping logic.
 *
 * Extracted from ConfigurationService.ts as part of modularization effort.
 */

import type {
  PartialClaudeTestingConfig,
  OutputOptions,
  OutputFormat,
  FeatureFlags,
  CoverageOptions,
  CoverageThresholds,
  AIOptions,
  GenerationOptions,
  LogLevel,
} from '../types/config';

/**
 * Type for environment variable parsing result value
 */
export type EnvValue = string | number | boolean | string[] | object | undefined;

/**
 * Type for configuration record manipulation
 */
export type ConfigRecord = Record<string, unknown>;

/**
 * Result of parsing environment variables
 */
export interface EnvParsingResult {
  /** Parsed configuration object */
  config: PartialClaudeTestingConfig;
  /** Warnings encountered during parsing */
  warnings: string[];
}

/**
 * Environment variable parser for Claude Testing configuration
 */
export class EnvironmentVariableParser {
  private static readonly ARRAY_FIELDS = ['INCLUDE', 'EXCLUDE', 'COVERAGE_REPORTERS', 'OUTPUT_FORMATS'];

  /**
   * Parse environment variables starting with CLAUDE_TESTING_ prefix
   * @param env Environment variables object
   * @returns Parsed configuration with warnings
   */
  public parseEnvironmentVariables(env: Record<string, string | undefined>): EnvParsingResult {
    const config: PartialClaudeTestingConfig = {};
    const warnings: string[] = [];

    // Process all environment variables with CLAUDE_TESTING_ prefix
    for (const [fullKey, value] of Object.entries(env)) {
      if (!fullKey.startsWith('CLAUDE_TESTING_') || value === undefined) {
        continue;
      }

      // Remove CLAUDE_TESTING_ prefix
      const key = fullKey.substring('CLAUDE_TESTING_'.length);
      const path = key.toLowerCase().split('_');
      
      // Check if this is an array field before parsing
      const isArrayField = this.isArrayField(key);
      const { value: parsedValue, warning } = this.parseEnvValue(value, isArrayField, key);

      if (warning) {
        warnings.push(warning);
      }

      // Pass the parsed value with the original key for special case handling
      this.setNestedValue(config as ConfigRecord, path, parsedValue, key);
    }

    return { config, warnings };
  }

  /**
   * Check if a field should be treated as an array
   */
  private isArrayField(key: string): boolean {
    return EnvironmentVariableParser.ARRAY_FIELDS.some(
      (field) => key === field || key.endsWith(`_${field}`)
    );
  }

  /**
   * Parse environment variable value to appropriate type
   */
  private parseEnvValue(
    value: string,
    isArrayField: boolean = false,
    key?: string
  ): { value: EnvValue; warning?: string } {
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
    // Exclude custom prompts from numeric validation
    if (
      key &&
      !key.startsWith('CUSTOM_PROMPTS_') &&
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
   * Handles special mappings for environment variable to configuration structure
   */
  private setNestedValue(
    obj: ConfigRecord,
    path: string[],
    value: EnvValue,
    originalKey?: string
  ): void {
    if (path.length === 0) return;

    // Handle special root-level mappings first
    const upperPath = originalKey ?? path.join('_').toUpperCase();

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
      this.setCustomPromptsValue(obj, upperPath, value);
      return;
    }

    // OUTPUT_FORMAT needs special handling - set both format and formats
    if (upperPath === 'OUTPUT_FORMAT') {
      this.setOutputFormatValue(obj, value);
      return;
    }

    // Features mappings
    if (upperPath.startsWith('FEATURES_')) {
      this.setFeaturesValue(obj, upperPath, value);
      return;
    }

    // Output mappings
    if (upperPath.startsWith('OUTPUT_')) {
      this.setOutputValue(obj, upperPath, value);
      return;
    }

    // Coverage mappings
    if (upperPath.startsWith('COVERAGE_')) {
      this.setCoverageValue(obj, upperPath, value);
      return;
    }

    // AI Options mappings
    if (upperPath.startsWith('AI_OPTIONS_')) {
      this.setAIOptionsValue(obj, upperPath, value);
      return;
    }

    // Generation mappings
    if (upperPath.startsWith('GENERATION_')) {
      this.setGenerationValue(obj, upperPath, value);
      return;
    }

    // For nested paths, convert to appropriate case
    this.setGenericNestedValue(obj, path, value);
  }

  /**
   * Handle CUSTOM_PROMPTS fields
   */
  private setCustomPromptsValue(obj: ConfigRecord, upperPath: string, value: EnvValue): void {
    const promptKey = upperPath.substring('CUSTOM_PROMPTS_'.length);

    // Handle empty strings for custom prompts
    if (value === '' || value === undefined) {
      // Don't set undefined prompts - exit early before creating customPrompts object
      return;
    }

    if (!obj.customPrompts || typeof obj.customPrompts !== 'object') obj.customPrompts = {};
    const customPrompts = obj.customPrompts as Record<string, string>;

    if (promptKey === 'TEST_GENERATION') {
      customPrompts.testGeneration = value as string;
    }
  }

  /**
   * Handle OUTPUT_FORMAT special case
   */
  private setOutputFormatValue(obj: ConfigRecord, value: EnvValue): void {
    if (!obj.output || typeof obj.output !== 'object') obj.output = {};
    const output = obj.output as Partial<OutputOptions>;
    output.format = value as OutputFormat;
    output.formats = [value as OutputFormat];
  }

  /**
   * Handle FEATURES_ mappings
   */
  private setFeaturesValue(obj: ConfigRecord, upperPath: string, value: EnvValue): void {
    if (!obj.features || typeof obj.features !== 'object') obj.features = {};
    const features = obj.features as Partial<FeatureFlags>;

    if (upperPath === 'FEATURES_COVERAGE') {
      features.coverage = value as boolean;
    } else if (upperPath === 'FEATURES_EDGE_CASES') {
      features.edgeCases = value as boolean;
    } else if (upperPath === 'FEATURES_INTEGRATION_TESTS') {
      features.integrationTests = value as boolean;
    } else if (upperPath === 'FEATURES_MOCKING') {
      features.mocks = value as boolean;
    }
  }

  /**
   * Handle OUTPUT_ mappings
   */
  private setOutputValue(obj: ConfigRecord, upperPath: string, value: EnvValue): void {
    if (!obj.output || typeof obj.output !== 'object') obj.output = {};
    const output = obj.output as Partial<OutputOptions>;

    if (upperPath === 'OUTPUT_VERBOSE') {
      output.verbose = value as boolean;
      if (value === true) {
        output.logLevel = 'verbose';
      }
    } else if (upperPath === 'OUTPUT_LOG_LEVEL') {
      output.logLevel = value as LogLevel;
    } else if (upperPath === 'OUTPUT_COLORS') {
      output.colors = value as boolean;
    }
  }

  /**
   * Handle COVERAGE_ mappings
   */
  private setCoverageValue(obj: ConfigRecord, upperPath: string, value: EnvValue): void {
    if (!obj.coverage || typeof obj.coverage !== 'object') obj.coverage = {};
    const coverage = obj.coverage as Partial<CoverageOptions>;

    if (upperPath === 'COVERAGE_ENABLED') {
      coverage.enabled = value as boolean;
    } else if (upperPath === 'COVERAGE_REPORTERS') {
      coverage.reporters = value as string[];
    } else if (upperPath.startsWith('COVERAGE_THRESHOLDS_GLOBAL_')) {
      this.setCoverageThresholdsValue(coverage, upperPath, value);
    }
  }

  /**
   * Handle COVERAGE_THRESHOLDS_GLOBAL fields
   */
  private setCoverageThresholdsValue(
    coverage: Partial<CoverageOptions>,
    upperPath: string,
    value: EnvValue
  ): void {
    if (!coverage.thresholds || typeof coverage.thresholds !== 'object') coverage.thresholds = {};
    const thresholds = coverage.thresholds as Partial<CoverageThresholds>;
    if (!thresholds.global || typeof thresholds.global !== 'object') thresholds.global = {};
    const global = thresholds.global as Partial<NonNullable<CoverageThresholds['global']>>;

    const thresholdKey = upperPath.substring('COVERAGE_THRESHOLDS_GLOBAL_'.length).toLowerCase();
    // Type-safe assignment with proper key validation
    if (thresholdKey in { branches: true, functions: true, lines: true, statements: true }) {
      (global as ConfigRecord)[thresholdKey] = value as number;
    }
  }

  /**
   * Handle AI_OPTIONS_ mappings
   */
  private setAIOptionsValue(obj: ConfigRecord, upperPath: string, value: EnvValue): void {
    if (!obj.aiOptions || typeof obj.aiOptions !== 'object') obj.aiOptions = {};
    const aiOptions = obj.aiOptions as Partial<AIOptions>;
    const aiOptionKey = upperPath.substring('AI_OPTIONS_'.length);

    if (aiOptionKey === 'MAX_TOKENS') {
      aiOptions.maxTokens = value as number;
    } else if (aiOptionKey === 'TEMPERATURE') {
      aiOptions.temperature = value as number;
    } else if (aiOptionKey === 'MAX_COST') {
      aiOptions.maxCost = value as number;
    }
  }

  /**
   * Handle GENERATION_ mappings
   */
  private setGenerationValue(obj: ConfigRecord, upperPath: string, value: EnvValue): void {
    if (!obj.generation || typeof obj.generation !== 'object') obj.generation = {};
    const generation = obj.generation as Partial<GenerationOptions>;
    const generationKey = upperPath.substring('GENERATION_'.length);

    if (generationKey === 'MAX_RETRIES') {
      generation.maxRetries = value as number;
    } else if (generationKey === 'TIMEOUT_MS') {
      generation.timeoutMs = value as number;
    } else if (generationKey === 'MAX_TEST_TO_SOURCE_RATIO') {
      generation.maxTestToSourceRatio = value as number;
    } else if (generationKey === 'BATCH_SIZE') {
      generation.batchSize = value as number;
    }
  }

  /**
   * Handle generic nested paths
   */
  private setGenericNestedValue(obj: ConfigRecord, path: string[], value: EnvValue): void {
    // For nested paths, convert to appropriate case
    // Keep configuration object keys lowercase (coverage.thresholds.global)
    // Use camelCase only for property names within objects
    const camelPath = path
      .map((segment) => segment.toLowerCase())
      .filter((seg) => seg !== ''); // Remove empty segments

    if (camelPath.length === 0) return;

    // Navigate to the parent object, creating nested objects as needed
    let current: ConfigRecord = obj;
    for (let i = 0; i < camelPath.length - 1; i++) {
      const key = camelPath[i];
      if (!key) continue;

      if (current[key] === undefined) {
        current[key] = {};
      }
      // Type guard to ensure we're working with an object
      if (typeof current[key] === 'object' && current[key] !== null) {
        current = current[key] as ConfigRecord;
      } else {
        current[key] = {};
        current = current[key] as ConfigRecord;
      }
    }

    // Set the final value
    const finalKey = camelPath[camelPath.length - 1];
    if (finalKey) {
      current[finalKey] = value;
    }
  }

}