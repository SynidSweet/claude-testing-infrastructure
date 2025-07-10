/**
 * CLI argument to configuration mapping service
 *
 * This module provides type-safe mapping of CLI arguments to configuration structures.
 * Extracted from ConfigurationService to improve modularity and testability.
 */

import { logger } from '../utils/common-imports';
import type {
  PartialClaudeTestingConfig,
  AIModel,
  BaselineOptions,
  OutputFormat,
  TestFramework,
  LogLevel,
} from '../types/config';
import type { EnvValue, ConfigRecord } from './EnvironmentVariableParser';

/**
 * CLI argument types for type-safe processing
 */
export interface CliArguments {
  aiModel?: string | undefined;
  verbose?: boolean | undefined;
  debug?: boolean | undefined;
  quiet?: boolean | undefined;
  format?: string | undefined;
  output?: string | undefined;
  framework?: string | undefined;
  maxRatio?: number | undefined;
  batchSize?: number | undefined;
  maxRetries?: number | undefined;
  onlyStructural?: boolean | undefined;
  onlyLogical?: boolean | undefined;
  coverage?: boolean | undefined;
  threshold?: string | undefined;
  reporter?: string | string[] | undefined;
  watch?: boolean | undefined;
  debounce?: number | undefined;
  stats?: boolean | undefined;
  baseline?: BaselineOptions | boolean;
  costLimit?: number | undefined;
  dryRun?: boolean | undefined;
  force?: boolean | undefined;
  enableChunking?: boolean | undefined;
  chunkSize?: number | undefined;
  junit?: boolean | undefined;
  [key: string]: string | number | boolean | string[] | BaselineOptions | undefined;
}

/**
 * Result of threshold parsing operation
 */
export interface ThresholdParseResult {
  thresholds?: { statements?: number; branches?: number; functions?: number; lines?: number };
  error?: string;
}

/**
 * Result of CLI argument mapping operation
 */
export interface CliMappingResult {
  config: PartialClaudeTestingConfig;
  error?: string;
}

/**
 * CLI argument to configuration mapper
 */
export class CliArgumentMapper {
  private thresholdParseError: string | undefined;

  /**
   * Map CLI arguments to configuration structure
   */
  mapCliArgsToConfig(cliArgs: CliArguments): CliMappingResult {
    const config: PartialClaudeTestingConfig = {};

    // AI model mapping with type validation
    if (cliArgs.aiModel && typeof cliArgs.aiModel === 'string') {
      config.aiModel = cliArgs.aiModel as AIModel;
    }

    // Output configuration with type-safe object manipulation
    if (cliArgs.verbose !== undefined && typeof cliArgs.verbose === 'boolean') {
      const configObj = this.configToRecord(config);
      const output = this.safeGetOutput(configObj);
      output.verbose = cliArgs.verbose;
      if (cliArgs.verbose) {
        output.logLevel = 'verbose';
      }
    }

    if (cliArgs.debug !== undefined && typeof cliArgs.debug === 'boolean') {
      const configObj = this.configToRecord(config);
      const output = this.safeGetOutput(configObj);
      output.logLevel = 'debug';
    }

    if (cliArgs.quiet) {
      const configObj = this.configToRecord(config);
      const output = this.safeGetOutput(configObj);
      Object.assign(output, {
        logLevel: 'error' as LogLevel,
        ...output,
      });
    }

    if (cliArgs.format && typeof cliArgs.format === 'string') {
      const configObj = this.configToRecord(config);
      const output = this.safeGetOutput(configObj);
      Object.assign(output, {
        formats: [cliArgs.format as OutputFormat],
        format: cliArgs.format as OutputFormat,
        ...output,
      });
    }

    if (cliArgs.output && typeof cliArgs.output === 'string') {
      const configObj = this.configToRecord(config);
      const output = this.safeGetOutput(configObj);
      Object.assign(output, {
        file: cliArgs.output,
        ...output,
      });
    }

    // Test framework mapping with type validation
    if (cliArgs.framework && typeof cliArgs.framework === 'string') {
      config.testFramework = cliArgs.framework as TestFramework;
    }

    // Test generation configuration with type safety
    if (cliArgs.maxRatio !== undefined && typeof cliArgs.maxRatio === 'number') {
      const configObj = this.configToRecord(config);
      const generation = this.ensureObject(configObj, 'generation');
      Object.assign(generation, {
        maxTestToSourceRatio: cliArgs.maxRatio,
        ...generation,
      });
    }

    if (cliArgs.batchSize !== undefined && typeof cliArgs.batchSize === 'number') {
      const configObj = this.configToRecord(config);
      const generation = this.ensureObject(configObj, 'generation');
      Object.assign(generation, {
        batchSize: cliArgs.batchSize,
        ...generation,
      });
    }

    if (cliArgs.maxRetries !== undefined && typeof cliArgs.maxRetries === 'number') {
      const configObj = this.configToRecord(config);
      const generation = this.ensureObject(configObj, 'generation');
      Object.assign(generation, {
        maxRetries: cliArgs.maxRetries,
        ...generation,
      });
    }

    // Features configuration based on test generation flags
    if (cliArgs.onlyStructural !== undefined) {
      const configObj = this.configToRecord(config);
      const features = this.safeGetFeatures(configObj);
      Object.assign(features, {
        structuralTests: true,
        logicalTests: false,
        ...features,
      });
    }

    if (cliArgs.onlyLogical !== undefined) {
      const configObj = this.configToRecord(config);
      const features = this.safeGetFeatures(configObj);
      Object.assign(features, {
        structuralTests: false,
        logicalTests: true,
        ...features,
      });
    }

    // Note: force flag doesn't map directly to config schema
    // It's handled at the command level

    // Note: chunking options are handled at implementation level
    // They don't map directly to the config schema

    // Coverage configuration with type safety
    if (cliArgs.coverage !== undefined && typeof cliArgs.coverage === 'boolean') {
      const configObj = this.configToRecord(config);
      const coverage = this.safeGetCoverage(configObj);
      Object.assign(coverage, {
        enabled: cliArgs.coverage,
        ...coverage,
      });
    }

    if (cliArgs.threshold && typeof cliArgs.threshold === 'string') {
      const parseResult = this.parseThresholds(cliArgs.threshold);
      if (parseResult.thresholds) {
        const configObj = this.configToRecord(config);
        const coverage = this.safeGetCoverage(configObj);
        Object.assign(coverage, {
          thresholds: {
            global: parseResult.thresholds,
          },
          ...coverage,
        });
      }
      // Store error to be returned
      this.thresholdParseError = parseResult.error;
    }

    // Map reporter CLI argument to coverage.reporters with type safety
    if (cliArgs.reporter) {
      const reporterValue = cliArgs.reporter;
      let reporters: string[];

      if (Array.isArray(reporterValue)) {
        reporters = reporterValue.filter((r): r is string => typeof r === 'string');
      } else if (typeof reporterValue === 'string') {
        reporters = [reporterValue];
      } else {
        reporters = [];
      }

      if (reporters.length > 0) {
        const configObj = this.configToRecord(config);
        const coverage = this.safeGetCoverage(configObj);
        Object.assign(coverage, {
          reporters,
          ...coverage,
        });
      }
    }

    // Watch mode with type safety
    if (cliArgs.watch !== undefined && typeof cliArgs.watch === 'boolean') {
      const configObj = this.configToRecord(config);
      const watch = this.ensureObject(configObj, 'watch');
      Object.assign(watch, {
        enabled: cliArgs.watch,
        ...watch,
      });
    }

    if (cliArgs.debounce !== undefined && typeof cliArgs.debounce === 'number') {
      const configObj = this.configToRecord(config);
      const watch = this.ensureObject(configObj, 'watch');
      Object.assign(watch, {
        debounceMs: cliArgs.debounce,
        ...watch,
      });
    }

    // Incremental configuration with type safety
    if (cliArgs.stats !== undefined && typeof cliArgs.stats === 'boolean') {
      const configObj = this.configToRecord(config);
      const incremental = this.ensureObject(configObj, 'incremental');
      Object.assign(incremental, {
        showStats: cliArgs.stats,
        ...incremental,
      });
    }

    if (cliArgs.baseline !== undefined) {
      const configObj = this.configToRecord(config);
      const incremental = this.ensureObject(configObj, 'incremental');
      Object.assign(incremental, {
        baseline: cliArgs.baseline as BaselineOptions,
        ...incremental,
      });
    }

    if (cliArgs.costLimit !== undefined && typeof cliArgs.costLimit === 'number') {
      config.costLimit = cliArgs.costLimit;
    }

    if (cliArgs.dryRun !== undefined && typeof cliArgs.dryRun === 'boolean') {
      config.dryRun = cliArgs.dryRun;
    }

    const result: CliMappingResult = { config };
    if (this.thresholdParseError) {
      result.error = this.thresholdParseError;
      this.thresholdParseError = undefined;
    }

    return result;
  }

  /**
   * Parse threshold string into structured threshold configuration
   */
  parseThresholds(thresholdString: string): ThresholdParseResult {
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
          const colonCount = (part.match(/:/g) ?? []).length;
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
      return { error: `Failed to parse threshold: ${String(error)}` };
    }
  }

  // Private utility methods for type-safe configuration manipulation

  /**
   * Type guards for safe type casting
   */
  private isRecordObject(value: EnvValue | ConfigRecord): value is ConfigRecord {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private ensureObject(obj: ConfigRecord, key: string): ConfigRecord {
    if (!this.isRecordObject(obj[key] as EnvValue | ConfigRecord)) {
      obj[key] = {};
    }
    return obj[key] as ConfigRecord;
  }

  /**
   * Safe type casting utilities for configuration objects
   */
  private safeGetFeatures(obj: ConfigRecord): ConfigRecord {
    return this.ensureObject(obj, 'features');
  }

  private safeGetCoverage(obj: ConfigRecord): ConfigRecord {
    return this.ensureObject(obj, 'coverage');
  }

  private safeGetOutput(obj: ConfigRecord): ConfigRecord {
    return this.ensureObject(obj, 'output');
  }

  /**
   * Convert PartialClaudeTestingConfig to Record for safe manipulation
   */
  private configToRecord(config: PartialClaudeTestingConfig): ConfigRecord {
    return config as ConfigRecord;
  }
}