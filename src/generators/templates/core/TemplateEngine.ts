import type { Template, TemplateContext, ValidationResult } from '../TestTemplateEngine';
import { TemplateRegistry, type TemplateMatch } from './TemplateRegistry';

/**
 * Safe generation result with error handling
 */
export interface SafeGenerationResult {
  success: boolean;
  content?: string | undefined;
  error?: string | undefined;
  template?: Template | undefined;
  warnings?: string[] | undefined;
}

/**
 * Template generation options
 */
export interface TemplateGenerationOptions {
  /** Whether to validate context before generation */
  validateContext?: boolean;
  /** Whether to include detailed error messages */
  includeErrorDetails?: boolean;
  /** Whether to include generation warnings */
  includeWarnings?: boolean;
  /** Fallback template to use if primary fails */
  fallbackTemplate?: Template;
}

/**
 * Template generation statistics
 */
export interface TemplateGenerationStats {
  totalGenerations: number;
  successfulGenerations: number;
  failedGenerations: number;
  templateUsageCount: Map<string, number>;
  averageGenerationTime: number;
}

/**
 * Core template engine for test generation
 *
 * Extracted from TestTemplateEngine to provide cleaner separation between
 * template management (TemplateRegistry) and template execution (TemplateEngine).
 *
 * This class focuses solely on the execution and generation logic.
 */
export class TemplateEngine {
  private stats: TemplateGenerationStats;
  private generationTimes: number[] = [];

  constructor(private registry: TemplateRegistry) {
    this.stats = {
      totalGenerations: 0,
      successfulGenerations: 0,
      failedGenerations: 0,
      templateUsageCount: new Map(),
      averageGenerationTime: 0,
    };
  }

  /**
   * Generate test content using the best available template
   */
  generateTest(context: TemplateContext, options: TemplateGenerationOptions = {}): string {
    const result = this.generateTestSafe(context, options);

    if (!result.success) {
      throw new Error(result.error || 'Template generation failed');
    }

    return result.content!;
  }

  /**
   * Generate test content with comprehensive error handling
   */
  generateTestSafe(
    context: TemplateContext,
    options: TemplateGenerationOptions = {}
  ): SafeGenerationResult {
    const startTime = Date.now();
    this.stats.totalGenerations++;

    try {
      // Find the best template
      const template = this.findBestTemplate(context);
      if (!template) {
        this.stats.failedGenerations++;
        return {
          success: false,
          error: `No template found for language: ${context.language}, framework: ${context.framework}`,
        };
      }

      // Validate context if requested
      if (options.validateContext && template.validateContext) {
        const validation = template.validateContext(context);
        if (!validation.isValid) {
          this.stats.failedGenerations++;
          return {
            success: false,
            error: `Context validation failed: ${validation.errors?.join(', ')}`,
            template,
            warnings: validation.warnings ?? undefined,
          };
        }
      }

      // Generate content
      const content = template.generate(context);

      // Update statistics
      const endTime = Date.now();
      const generationTime = endTime - startTime;
      this.generationTimes.push(generationTime);
      this.updateAverageGenerationTime();
      this.stats.successfulGenerations++;
      this.updateTemplateUsageCount(template.name);

      return {
        success: true,
        content,
        template,
        warnings: options.includeWarnings ? this.gatherWarnings(context, template) : undefined,
      };
    } catch (error) {
      this.stats.failedGenerations++;

      // Try fallback template if provided
      if (options.fallbackTemplate) {
        try {
          const content = options.fallbackTemplate.generate(context);
          return {
            success: true,
            content,
            template: options.fallbackTemplate,
            warnings: [`Used fallback template due to error: ${error}`],
          };
        } catch (fallbackError) {
          return {
            success: false,
            error: `Primary template failed: ${error}. Fallback template failed: ${fallbackError}`,
            template: options.fallbackTemplate,
          };
        }
      }

      return {
        success: false,
        error: options.includeErrorDetails
          ? `Template generation failed: ${error}`
          : 'Template generation failed',
        template: this.findBestTemplate(context) ?? undefined,
      };
    }
  }

  /**
   * Get the best template for a context without generating
   */
  getBestTemplate(context: TemplateContext): Template | undefined {
    return this.findBestTemplate(context);
  }

  /**
   * Get all matching templates with confidence scores
   */
  getTemplateMatches(context: TemplateContext): TemplateMatch[] {
    return this.registry.findTemplateMatches(context);
  }

  /**
   * Validate that a template can handle the given context
   */
  validateTemplate(template: Template, context: TemplateContext): ValidationResult {
    if (template.validateContext) {
      return template.validateContext(context);
    }

    // Basic validation
    const isValid = template.language === context.language;
    return {
      isValid,
      errors: isValid
        ? []
        : [
            `Template language '${template.language}' doesn't match context language '${context.language}'`,
          ],
      warnings: [],
    };
  }

  /**
   * Test template generation without throwing errors
   */
  testTemplate(template: Template, context: TemplateContext): SafeGenerationResult {
    try {
      const validation = this.validateTemplate(template, context);
      if (!validation.isValid) {
        return {
          success: false,
          error: `Template validation failed: ${validation.errors?.join(', ')}`,
          template,
          warnings: validation.warnings || undefined,
        };
      }

      const content = template.generate(context);
      return {
        success: true,
        content,
        template,
      };
    } catch (error) {
      return {
        success: false,
        error: `Template generation failed: ${error}`,
        template,
      };
    }
  }

  /**
   * Get template generation statistics
   */
  getStats(): TemplateGenerationStats {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalGenerations: 0,
      successfulGenerations: 0,
      failedGenerations: 0,
      templateUsageCount: new Map(),
      averageGenerationTime: 0,
    };
    this.generationTimes = [];
  }

  /**
   * Get detailed performance metrics
   */
  getPerformanceMetrics(): {
    averageTime: number;
    minTime: number;
    maxTime: number;
    medianTime: number;
    totalGenerations: number;
  } {
    if (this.generationTimes.length === 0) {
      return {
        averageTime: 0,
        minTime: 0,
        maxTime: 0,
        medianTime: 0,
        totalGenerations: 0,
      };
    }

    const sorted = [...this.generationTimes].sort((a, b) => a - b);
    const median =
      sorted.length % 2 === 0
        ? ((sorted[sorted.length / 2 - 1] || 0) + (sorted[sorted.length / 2] || 0)) / 2
        : sorted[Math.floor(sorted.length / 2)] || 0;

    return {
      averageTime: this.stats.averageGenerationTime,
      minTime: Math.min(...this.generationTimes),
      maxTime: Math.max(...this.generationTimes),
      medianTime: median || 0,
      totalGenerations: this.generationTimes.length,
    };
  }

  // Private helper methods

  private findBestTemplate(context: TemplateContext): Template | undefined {
    return this.registry.findTemplate(context);
  }

  private updateAverageGenerationTime(): void {
    if (this.generationTimes.length === 0) {
      this.stats.averageGenerationTime = 0;
      return;
    }

    const sum = this.generationTimes.reduce((acc, time) => acc + time, 0);
    this.stats.averageGenerationTime = sum / this.generationTimes.length;

    // Keep only the last 100 measurements for rolling average
    if (this.generationTimes.length > 100) {
      this.generationTimes = this.generationTimes.slice(-100);
    }
  }

  private updateTemplateUsageCount(templateName: string): void {
    const current = this.stats.templateUsageCount.get(templateName) || 0;
    this.stats.templateUsageCount.set(templateName, current + 1);
  }

  private gatherWarnings(context: TemplateContext, template: Template): string[] {
    const warnings: string[] = [];

    // Check for potential issues
    if (!context.framework && template.framework) {
      warnings.push(`Template expects framework '${template.framework}' but context has none`);
    }

    if (context.framework && template.framework && context.framework !== template.framework) {
      warnings.push(
        `Framework mismatch: context has '${context.framework}', template expects '${template.framework}'`
      );
    }

    if (!context.exports || context.exports.length === 0) {
      warnings.push('No exports detected in context - generated tests may be incomplete');
    }

    if (context.isAsync && !template.testType?.includes('async')) {
      warnings.push('Context indicates async code but template may not handle async patterns');
    }

    return warnings;
  }
}
