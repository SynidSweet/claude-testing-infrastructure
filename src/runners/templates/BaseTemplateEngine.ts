import { CoverageData } from '../CoverageParser';
import { AggregatedCoverageData } from '../CoverageAggregator';
import { CoverageGapAnalysis } from '../CoverageVisualizer';

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
export abstract class BaseTemplateEngine<TData extends BaseTemplateData, TInput = CoverageData | AggregatedCoverageData> {
  
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
      timestamp: this.getCurrentTimestamp()
    };
  }
  
  /**
   * Transform coverage files data to consistent format
   */
  protected transformFilesData(files: Record<string, any>): Array<{
    filename: string;
    summary: {
      lines: string;
      statements: string;
      branches: string;
      functions: string;
    };
    uncoveredLines?: string;
  }> {
    return Object.entries(files).map(([filename, coverage]) => ({
      filename,
      summary: {
        lines: this.formatPercentage(coverage.summary.lines),
        statements: this.formatPercentage(coverage.summary.statements),
        branches: this.formatPercentage(coverage.summary.branches),
        functions: this.formatPercentage(coverage.summary.functions)
      },
      ...(coverage.uncoveredLines?.length > 0 && {
        uncoveredLines: Array.isArray(coverage.uncoveredLines) 
          ? coverage.uncoveredLines.join(', ')
          : coverage.uncoveredLines
      })
    }));
  }
  
  /**
   * Transform suggestions data to consistent format
   */
  protected transformSuggestionsData(suggestions: any[]): Array<{
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
      effort: suggestion.effort
    }));
  }
}