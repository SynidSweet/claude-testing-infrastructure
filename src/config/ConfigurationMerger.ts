/**
 * Configuration merger for Claude Testing Infrastructure
 *
 * Provides deep merging capabilities for configuration objects from multiple sources
 * with proper type safety and validation orchestration.
 */

import { logger } from '../utils/common-imports';
import { ConfigurationManager } from '../utils/config-validation';
import {
  type ClaudeTestingConfig,
  type PartialClaudeTestingConfig,
  type ConfigValidationResult,
} from '../types/config';
import { type ConfigurationSource } from './loaders';
import { type EnvValue, type ConfigRecord } from './EnvironmentVariableParser';

/**
 * Options for configuration merging
 */
export interface ConfigurationMergerOptions {
  /** Project path for validation context */
  projectPath: string;
}

/**
 * Result of configuration merging operation
 */
export interface ConfigurationMergeResult extends ConfigValidationResult {
  /** Number of sources that were successfully merged */
  sourcesMerged: number;
  /** Total errors from all sources */
  totalErrors: number;
  /** Total warnings from all sources */
  totalWarnings: number;
}

/**
 * Configuration merger for combining multiple configuration sources
 */
export class ConfigurationMerger {
  private readonly projectPath: string;

  constructor(options: ConfigurationMergerOptions) {
    this.projectPath = options.projectPath;
  }

  /**
   * Merge configurations from multiple sources in precedence order
   * Later sources override earlier ones
   */
  mergeConfigurations(sources: ConfigurationSource[]): ConfigurationMergeResult {
    // Merge configurations in order (later sources override earlier ones)
    let mergedConfig: PartialClaudeTestingConfig = {};
    const allErrors: string[] = [];
    const allWarnings: string[] = [];
    let sourcesMerged = 0;

    for (const source of sources) {
      if (source.loaded) {
        logger.debug(`Merging source: ${source.type}`, { data: source.data });
        const mergedResult = this.deepMerge(
          mergedConfig as ConfigRecord,
          source.data as ConfigRecord
        );
        mergedConfig = mergedResult as PartialClaudeTestingConfig;
        sourcesMerged++;
      }
      allErrors.push(...source.errors);
      allWarnings.push(...source.warnings);
    }

    logger.debug('Final merged configuration before validation', { mergedConfig });

    // Validate the final merged configuration
    const validationResult = this.validateMergedConfiguration(mergedConfig);

    return {
      ...validationResult,
      sourcesMerged,
      totalErrors: allErrors.length,
      totalWarnings: allWarnings.length,
      valid: validationResult.valid && allErrors.length === 0,
      errors: [...allErrors, ...validationResult.errors],
      warnings: [...allWarnings, ...validationResult.warnings],
    };
  }

  /**
   * Deep merge two configuration objects with proper type safety
   */
  deepMerge(target: ConfigRecord, source: ConfigRecord): ConfigRecord {
    const result = { ...target };

    for (const key in source) {
      if (source[key] !== undefined) {
        // Include null and false values
        if (this.isRecordObject(source[key] as EnvValue | ConfigRecord)) {
          // For objects, recursively merge
          const targetValue = result[key];
          const sourceValue = source[key] as ConfigRecord;
          const mergeTarget = this.isRecordObject(targetValue as EnvValue | ConfigRecord)
            ? (targetValue as ConfigRecord)
            : {};
          result[key] = this.deepMerge(mergeTarget, sourceValue);
        } else {
          // For primitives and arrays, override completely
          result[key] = source[key];
        }
      }
    }

    return result;
  }

  /**
   * Validate merged configuration using appropriate validation strategy
   */
  private validateMergedConfiguration(
    mergedConfig: PartialClaudeTestingConfig
  ): ConfigValidationResult {
    const manager = new ConfigurationManager(this.projectPath);

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

    return validationResult;
  }

  /**
   * Type guard for safe type casting to record objects
   */
  private isRecordObject(value: EnvValue | ConfigRecord): value is ConfigRecord {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
