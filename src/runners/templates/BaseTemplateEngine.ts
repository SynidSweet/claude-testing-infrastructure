import type { CoverageData, FileCoverage } from '../CoverageParser';
import type { AggregatedCoverageData } from '../CoverageAggregator';
import type { CoverageGapAnalysis, CoverageSuggestion } from '../CoverageVisualizer';

/**
 * Base template data interface containing common properties
 */
export interface BaseTemplateData {
  projectName: string;
  generatedDate: string;
  timestamp: string;
}

/**
 * Base template engine providing common functionality for all template formats
 */
export abstract class BaseTemplateEngine<
  TData extends BaseTemplateData,
  TInput = CoverageData | AggregatedCoverageData,
> {
  /**
   * Abstract method for rendering template data to output format
   */
  abstract render(data: TData): Promise<string>;

  /**
   * Abstract method for preparing template data from coverage input
   */
  abstract prepareTemplateData(
    data: TInput,
    gaps?: CoverageGapAnalysis,
    projectName?: string
  ): TData;

  /**
   * Get CSS class name for coverage percentage
   */
  protected getCoverageClass(percentage: number): string {
    if (percentage >= 80) return 'good';
    if (percentage >= 60) return 'warning';
    return 'poor';
  }

  /**
   * Format percentage with one decimal place
   */
  protected formatPercentage(value: number): string {
    return value.toFixed(1);
  }

  /**
   * Get current date as locale string
   */
  protected getCurrentDateString(): string {
    return new Date().toLocaleString();
  }

  /**
   * Get current ISO timestamp
   */
  protected getCurrentTimestamp(): string {
    return new Date().toISOString();
  }

  /**
   * Create base template data with common properties
   */
  protected createBaseTemplateData(projectName?: string): BaseTemplateData {
    return {
      projectName: projectName || 'Project',
      generatedDate: this.getCurrentDateString(),
      timestamp: this.getCurrentTimestamp(),
    };
  }

  /**
   * Transform coverage files data to consistent format
   */
  protected transformFilesData(
    files: Record<string, FileCoverage>,
    format: 'formatted' | 'raw' = 'formatted'
  ): Array<{
    filename: string;
    path?: string;
    summary: {
      lines: string | number;
      statements: string | number;
      branches: string | number;
      functions: string | number;
    };
    uncoveredLines?: string;
  }> {
    return Object.entries(files).map(([filename, coverage]) => ({
      filename,
      path: filename, // Also provide as path for compatibility
      summary: {
        lines:
          format === 'formatted'
            ? this.formatPercentage(coverage.summary.lines)
            : coverage.summary.lines,
        statements:
          format === 'formatted'
            ? this.formatPercentage(coverage.summary.statements)
            : coverage.summary.statements,
        branches:
          format === 'formatted'
            ? this.formatPercentage(coverage.summary.branches)
            : coverage.summary.branches,
        functions:
          format === 'formatted'
            ? this.formatPercentage(coverage.summary.functions)
            : coverage.summary.functions,
      },
      ...(coverage.uncoveredLines?.length > 0 && {
        uncoveredLines: Array.isArray(coverage.uncoveredLines)
          ? coverage.uncoveredLines.join(', ')
          : coverage.uncoveredLines,
      }),
    }));
  }

  /**
   * Transform suggestions data to consistent format
   */
  protected transformSuggestionsData(suggestions: CoverageSuggestion[]): Array<{
    index?: number;
    target: string;
    file: string;
    description: string;
    priority: number;
    effort: string;
  }> {
    return suggestions.map((suggestion, index) => ({
      index: index + 1,
      target: suggestion.target,
      file: suggestion.file,
      description: suggestion.description,
      priority: suggestion.priority,
      effort: suggestion.effort,
    }));
  }

  /**
   * Transform coverage summary to common format
   */
  protected transformSummaryData(
    summary: { statements: number; branches: number; functions: number; lines: number },
    format: 'formatted' | 'raw' = 'formatted'
  ): {
    statements: string | number;
    branches: string | number;
    functions: string | number;
    lines: string | number;
  } {
    return {
      statements:
        format === 'formatted' ? this.formatPercentage(summary.statements) : summary.statements,
      branches: format === 'formatted' ? this.formatPercentage(summary.branches) : summary.branches,
      functions:
        format === 'formatted' ? this.formatPercentage(summary.functions) : summary.functions,
      lines: format === 'formatted' ? this.formatPercentage(summary.lines) : summary.lines,
    };
  }

  /**
   * Transform uncovered areas data to consistent format
   */
  protected transformUncoveredAreasData(
    uncoveredAreas: Array<{ type: string; file: string; line: number; description: string }>
  ): Array<{
    type: string;
    file: string;
    line: number;
    description: string;
  }> {
    return uncoveredAreas.map((area) => ({
      type: area.type,
      file: area.file,
      line: area.line,
      description: area.description,
    }));
  }

  /**
   * Escape XML special characters
   */
  protected escapeXml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Common template rendering with variable substitution
   */
  protected renderTemplate(
    template: string,
    data: Record<string, unknown> | BaseTemplateData
  ): string {
    let result = template;
    const templateData = data as Record<string, unknown>;

    // Handle simple variables
    result = result.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return templateData[key] !== undefined ? String(templateData[key]) : match;
    });

    // Handle conditionals {{#if variable}}...{{/if}}
    result = result.replace(/\{\{#if (\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (_match, key, content) => {
      return templateData[key] ? content : '';
    });

    // Handle loops {{#each array}}...{{/each}}
    result = result.replace(
      /\{\{#each (\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g,
      (_match, key, content) => {
        const array = templateData[key];
        if (!Array.isArray(array)) return '';

        return array
          .map((item) => {
            let itemContent = content;
            // Replace nested variables
            itemContent = itemContent.replace(
              /\{\{(\w+(?:\.\w+)*)\}\}/g,
              (m: string, path: string) => {
                const value = this.getNestedValue(item as Record<string, unknown>, path);
                return value !== undefined ? String(value) : m;
              }
            );
            return itemContent;
          })
          .join('');
      }
    );

    return result;
  }

  /**
   * Get nested object value by path
   */
  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    const parts = path.split('.');
    let current: unknown = obj;
    for (const part of parts) {
      if (current && typeof current === 'object' && current !== null && part in current) {
        current = (current as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }
    return current;
  }
}
