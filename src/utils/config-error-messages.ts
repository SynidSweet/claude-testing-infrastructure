/**
 * Enhanced configuration error messages with helpful context and suggestions
 */

import chalk from 'chalk';

export interface ConfigErrorDetails {
  field: string;
  value: unknown;
  message: string;
  suggestion?: string;
  example?: string;
  documentation?: string;
}

export class ConfigErrorFormatter {
  /**
   * Format validation errors with helpful context
   */
  static formatError(details: ConfigErrorDetails): string {
    const parts: string[] = [];

    // Main error message
    parts.push(`${chalk.bold(details.field)}: ${details.message}`);

    // Current value (if not sensitive)
    if (details.value !== undefined && details.value !== null) {
      const displayValue =
        typeof details.value === 'object'
          ? JSON.stringify(details.value, null, 2).substring(0, 100) + '...'
          : String(details.value);
      parts.push(`  Current value: ${chalk.red(displayValue)}`);
    }

    // Suggestion
    if (details.suggestion) {
      parts.push(`  ${chalk.yellow('→')} ${details.suggestion}`);
    }

    // Example
    if (details.example) {
      parts.push(`  Example: ${chalk.green(details.example)}`);
    }

    // Documentation link
    if (details.documentation) {
      parts.push(`  See: ${chalk.blue(details.documentation)}`);
    }

    return parts.join('\n');
  }

  /**
   * Common error message templates
   */
  static readonly templates = {
    invalidEnum: (field: string, value: unknown, validOptions: string[]): ConfigErrorDetails => {
      const result: ConfigErrorDetails = {
        field,
        value,
        message: `Invalid value. Must be one of: ${validOptions.join(', ')}`,
        suggestion:
          validOptions.length <= 5
            ? `Choose from: ${validOptions.join(', ')}`
            : `Choose from ${validOptions.length} valid options (see documentation)`,
      };
      if (validOptions[0]) {
        result.example = validOptions[0];
      }
      return result;
    },

    invalidType: (
      field: string,
      value: unknown,
      expectedType: string,
      actualType: string
    ): ConfigErrorDetails => ({
      field,
      value,
      message: `Invalid type. Expected ${expectedType} but got ${actualType}`,
      suggestion: `Ensure the value is a ${expectedType}`,
      example: getTypeExample(expectedType),
    }),

    outOfRange: (field: string, value: number, min?: number, max?: number): ConfigErrorDetails => ({
      field,
      value,
      message: `Value out of range. ${formatRange(min, max)}`,
      suggestion: `Use a value ${formatRange(min, max)}`,
      example: suggestRangeValue(value, min, max),
    }),

    deprecatedField: (field: string, value: unknown, alternative?: string): ConfigErrorDetails => ({
      field,
      value,
      message: `This field is deprecated`,
      suggestion: alternative ? `Use '${alternative}' instead` : 'Remove this field',
      documentation: 'https://docs.anthropic.com/claude-testing/configuration',
    }),

    unknownField: (
      field: string,
      value: unknown,
      similarFields: string[] = []
    ): ConfigErrorDetails => ({
      field,
      value,
      message: `Unknown configuration field`,
      suggestion:
        similarFields.length > 0
          ? `Did you mean: ${similarFields.join(', ')}?`
          : 'Check the field name for typos',
      documentation: 'https://docs.anthropic.com/claude-testing/configuration',
    }),

    missingRequired: (field: string): ConfigErrorDetails => ({
      field,
      value: undefined,
      message: `Required field is missing`,
      suggestion: `Add '${field}' to your configuration`,
      example: getFieldExample(field),
    }),

    conflictingValues: (
      field: string,
      value: unknown,
      conflictsWith: string,
      otherValue: unknown
    ): ConfigErrorDetails => ({
      field,
      value,
      message: `Conflicts with '${conflictsWith}' (${String(otherValue)})`,
      suggestion: `Either remove '${field}' or adjust '${conflictsWith}'`,
      documentation: 'https://docs.anthropic.com/claude-testing/configuration#conflicts',
    }),

    invalidPattern: (field: string, value: string, patternType: string): ConfigErrorDetails => ({
      field,
      value,
      message: `Invalid ${patternType} pattern`,
      suggestion: `Use a valid ${patternType} pattern`,
      example: getPatternExample(patternType),
    }),

    fileMissing: (field: string, value: string): ConfigErrorDetails => ({
      field,
      value,
      message: `Referenced file does not exist`,
      suggestion: `Create the file or update the path`,
      example: `Relative to project root: ./configs/test.json`,
    }),

    invalidModel: (field: string, value: string): ConfigErrorDetails => ({
      field,
      value,
      message: `Invalid AI model identifier`,
      suggestion: `Use a valid Claude model name or alias`,
      example: `claude-3-5-sonnet-20241022, sonnet, haiku`,
      documentation: 'https://docs.anthropic.com/claude-testing/ai-models',
    }),
  };
}

/**
 * Helper functions
 */
function getTypeExample(type: string): string {
  const examples: Record<string, string> = {
    string: '"example"',
    number: '42',
    boolean: 'true',
    array: '["item1", "item2"]',
    object: '{ "key": "value" }',
  };
  return examples[type] ?? type;
}

function formatRange(min?: number, max?: number): string {
  if (min !== undefined && max !== undefined) {
    return `between ${min} and ${max}`;
  } else if (min !== undefined) {
    return `at least ${min}`;
  } else if (max !== undefined) {
    return `at most ${max}`;
  }
  return '';
}

function suggestRangeValue(value: number, min?: number, max?: number): string {
  if (min !== undefined && value < min) return String(min);
  if (max !== undefined && value > max) return String(max);
  if (min !== undefined && max !== undefined) {
    return String(Math.round((min + max) / 2));
  }
  return '10';
}

function getFieldExample(field: string): string {
  const examples: Record<string, string> = {
    testFramework: '"jest"',
    aiModel: '"claude-3-5-sonnet-20241022"',
    include: '["src/**/*.js"]',
    exclude: '["**/*.test.js"]',
    costLimit: '50.00',
  };
  return examples[field] ?? '""';
}

function getPatternExample(patternType: string): string {
  const examples: Record<string, string> = {
    glob: '"src/**/*.js"',
    regex: '"/test\\w+\\.js$/"',
    path: '"./src/components"',
  };
  return examples[patternType] ?? '"pattern"';
}

/**
 * Find similar field names using Levenshtein distance
 */
export function findSimilarFields(field: string, validFields: string[]): string[] {
  const similar: Array<{ field: string; distance: number }> = [];

  for (const validField of validFields) {
    const distance = levenshteinDistance(field.toLowerCase(), validField.toLowerCase());
    if (distance <= 3) {
      // Threshold for similarity
      similar.push({ field: validField, distance });
    }
  }

  return similar
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 3)
    .map((s) => s.field);
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0]![j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i]![j] = matrix[i - 1]![j - 1]!;
      } else {
        matrix[i]![j] = Math.min(
          matrix[i - 1]![j - 1]! + 1,
          matrix[i]![j - 1]! + 1,
          matrix[i - 1]![j]! + 1
        );
      }
    }
  }

  return matrix[b.length]![a.length]!;
}
