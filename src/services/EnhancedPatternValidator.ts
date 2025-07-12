/**
 * Enhanced pattern validator with detailed error reporting
 *
 * This validator provides comprehensive validation of glob patterns
 * with specific error codes and suggestions for fixes.
 */

import type {
  EnhancedPatternValidation,
  PatternValidationDetail,
  PatternSuggestion,
  PatternErrorCode,
} from '../types/enhanced-file-discovery-types';

/**
 * Enhanced pattern validator implementation
 */
export class EnhancedPatternValidator {
  /**
   * Validate an array of glob patterns
   */
  static validate(patterns: string[]): EnhancedPatternValidation {
    const errors: PatternValidationDetail[] = [];
    const warnings: PatternValidationDetail[] = [];
    const suggestions: PatternSuggestion[] = [];

    for (const pattern of patterns) {
      this.validateSinglePattern(pattern, errors, warnings, suggestions);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      suggestions,
    };
  }

  /**
   * Validate a single pattern
   */
  private static validateSinglePattern(
    pattern: string,
    errors: PatternValidationDetail[],
    warnings: PatternValidationDetail[],
    suggestions: PatternSuggestion[]
  ): void {
    // Check for empty pattern
    if (!pattern || pattern.trim() === '') {
      errors.push({
        pattern,
        code: 'EMPTY_PATTERN' as PatternErrorCode,
        message: 'Pattern cannot be empty',
        severity: 'error',
      });
      return;
    }

    // Check for unmatched brackets
    const bracketCheck = this.checkBrackets(pattern);
    if (!bracketCheck.valid) {
      const errorDetail: PatternValidationDetail = {
        pattern,
        code: 'UNMATCHED_BRACKETS' as PatternErrorCode,
        message: bracketCheck.message,
        severity: 'error',
      };
      if (bracketCheck.position !== undefined) {
        errorDetail.position = bracketCheck.position;
      }
      errors.push(errorDetail);
    }

    // Check for unmatched braces
    const braceCheck = this.checkBraces(pattern);
    if (!braceCheck.valid) {
      const errorDetail: PatternValidationDetail = {
        pattern,
        code: 'UNMATCHED_BRACES' as PatternErrorCode,
        message: braceCheck.message,
        severity: 'error',
      };
      if (braceCheck.position !== undefined) {
        errorDetail.position = braceCheck.position;
      }
      errors.push(errorDetail);
    }

    // Check for Windows path separators
    if (pattern.includes('\\')) {
      warnings.push({
        pattern,
        code: 'WINDOWS_PATH_SEPARATOR' as PatternErrorCode,
        message: 'Use forward slashes for cross-platform compatibility',
        severity: 'warning',
      });
      suggestions.push({
        original: pattern,
        suggested: pattern.replace(/\\/g, '/'),
        reason: 'Forward slashes work on all platforms',
      });
    }

    // Check for overly broad patterns
    if (pattern === '**' || pattern === '**/*') {
      warnings.push({
        pattern,
        code: 'OVERLY_BROAD' as PatternErrorCode,
        message: 'Very broad pattern may impact performance',
        severity: 'warning',
      });
      suggestions.push({
        original: pattern,
        suggested: '**/*.{js,ts,jsx,tsx}',
        reason: 'Add file extensions to improve performance',
      });
    }

    // Check for redundant patterns
    if (pattern.includes('**/**')) {
      warnings.push({
        pattern,
        code: 'REDUNDANT_PATTERN' as PatternErrorCode,
        message: 'Redundant path separators in pattern',
        severity: 'warning',
      });
      suggestions.push({
        original: pattern,
        suggested: pattern.replace('**/**', '**'),
        reason: 'Simplify redundant pattern',
      });
    }
  }

  /**
   * Check for unmatched brackets
   */
  private static checkBrackets(pattern: string): {
    valid: boolean;
    message: string;
    position?: number;
  } {
    let openCount = 0;
    let position = 0;

    for (let i = 0; i < pattern.length; i++) {
      if (pattern[i] === '[') {
        openCount++;
        if (openCount === 1) position = i;
      } else if (pattern[i] === ']') {
        openCount--;
        if (openCount < 0) {
          return {
            valid: false,
            message: `Unmatched closing bracket at position ${i}`,
            position: i,
          };
        }
      }
    }

    if (openCount > 0) {
      return {
        valid: false,
        message: `Unmatched opening bracket at position ${position}`,
        position,
      };
    }

    return { valid: true, message: '' };
  }

  /**
   * Check for unmatched braces
   */
  private static checkBraces(pattern: string): {
    valid: boolean;
    message: string;
    position?: number;
  } {
    let openCount = 0;
    let position = 0;

    for (let i = 0; i < pattern.length; i++) {
      if (pattern[i] === '{') {
        openCount++;
        if (openCount === 1) position = i;
      } else if (pattern[i] === '}') {
        openCount--;
        if (openCount < 0) {
          return {
            valid: false,
            message: `Unmatched closing brace at position ${i}`,
            position: i,
          };
        }
      }
    }

    if (openCount > 0) {
      return {
        valid: false,
        message: `Unmatched opening brace at position ${position}`,
        position,
      };
    }

    return { valid: true, message: '' };
  }

  /**
   * Check if pattern is likely to match too many files
   */
  static estimateMatchCount(pattern: string): 'low' | 'medium' | 'high' {
    // Very broad patterns
    if (pattern === '**' || pattern === '**/*') {
      return 'high';
    }

    // Has specific extensions
    if (pattern.includes('.') && !pattern.includes('*.*')) {
      return 'low';
    }

    // Has directory constraints
    if (!pattern.startsWith('**') && pattern.includes('/')) {
      return 'low';
    }

    // Default to medium
    return 'medium';
  }

  /**
   * Suggest optimizations for patterns
   */
  static suggestOptimizations(patterns: string[]): PatternSuggestion[] {
    const suggestions: PatternSuggestion[] = [];

    // Check for patterns that could be combined
    const extensionPatterns = patterns.filter((p) => p.match(/\*\.\w+$/));
    if (extensionPatterns.length > 1) {
      // Group patterns by their base path
      const pathGroups = new Map<string, string[]>();

      for (const pattern of extensionPatterns) {
        const basePath = pattern.substring(0, pattern.lastIndexOf('*.'));
        if (!pathGroups.has(basePath)) {
          pathGroups.set(basePath, []);
        }
        const ext = pattern.split('.').pop();
        if (ext) {
          pathGroups.get(basePath)?.push(ext);
        }
      }

      // Create suggestions for each group
      for (const [basePath, extensions] of pathGroups) {
        if (extensions.length > 1) {
          const combinedPattern = `${basePath}*.{${extensions.join(',')}}`;
          const originalPatterns = extensions.map((ext) => `${basePath}*.${ext}`);
          suggestions.push({
            original: originalPatterns.join(', '),
            suggested: combinedPattern,
            reason: 'Combine similar patterns for better performance',
          });
        }
      }
    }

    return suggestions;
  }
}
