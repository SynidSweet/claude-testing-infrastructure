import { CoverageData } from '../CoverageParser';
import { AggregatedCoverageData } from '../CoverageAggregator';
import { CoverageGapAnalysis } from '../CoverageVisualizer';
import { BaseTemplateEngine, BaseTemplateData } from './BaseTemplateEngine';

export interface MarkdownTemplateData extends BaseTemplateData {
  summary: {
    statements: string;
    branches: string;
    functions: string;
    lines: string;
  };
  meetsThresholds?: boolean;
  files: Array<{
    filename: string;
    lines: string;
    statements: string;
    branches: string;
    functions: string;
  }>;
  suggestions: Array<{
    index: number;
    target: string;
    file: string;
    description: string;
    priority: number;
    effort: string;
  }>;
}

export class MarkdownTemplateEngine extends BaseTemplateEngine<MarkdownTemplateData> {
  async render(data: MarkdownTemplateData): Promise<string> {
    const lines: string[] = [];

    // Header
    lines.push(`# Coverage Report${data.projectName ? ` - ${data.projectName}` : ''}`);
    lines.push('');
    lines.push(`Generated on: ${data.generatedDate}`);
    lines.push('');

    // Summary section
    lines.push('## Summary');
    lines.push('');
    lines.push('| Metric | Coverage |');
    lines.push('|--------|----------|');
    lines.push(`| Statements | ${data.summary.statements}% |`);
    lines.push(`| Branches | ${data.summary.branches}% |`);
    lines.push(`| Functions | ${data.summary.functions}% |`);
    lines.push(`| Lines | ${data.summary.lines}% |`);
    lines.push('');

    // Threshold status
    if (data.meetsThresholds !== undefined) {
      lines.push(`**Meets Thresholds:** ${data.meetsThresholds ? '✅ Yes' : '❌ No'}`);
      lines.push('');
    }

    // File coverage
    if (data.files.length > 0) {
      lines.push('## File Coverage');
      lines.push('');
      lines.push('| File | Lines | Statements | Branches | Functions |');
      lines.push('|------|-------|------------|----------|-----------|');
      
      data.files.forEach(file => {
        lines.push(`| ${file.filename} | ${file.lines}% | ${file.statements}% | ${file.branches}% | ${file.functions}% |`);
      });
      lines.push('');
    }

    // Suggestions
    if (data.suggestions.length > 0) {
      lines.push('## Improvement Suggestions');
      lines.push('');
      data.suggestions.forEach(suggestion => {
        lines.push(`${suggestion.index}. **${suggestion.target}** in \`${suggestion.file}\``);
        lines.push(`   - ${suggestion.description}`);
        lines.push(`   - Priority: ${suggestion.priority}/10 | Effort: ${suggestion.effort}`);
        lines.push('');
      });
    }

    return lines.join('\n');
  }

  prepareTemplateData(
    data: CoverageData | AggregatedCoverageData,
    gaps: CoverageGapAnalysis,
    projectName?: string
  ): MarkdownTemplateData {
    const baseData = this.createBaseTemplateData(projectName);
    
    const files = Object.entries(data.files).map(([filename, coverage]) => ({
      filename,
      lines: this.formatPercentage(coverage.summary.lines),
      statements: this.formatPercentage(coverage.summary.statements),
      branches: this.formatPercentage(coverage.summary.branches),
      functions: this.formatPercentage(coverage.summary.functions)
    }));
    
    const suggestions = gaps.suggestions.map((suggestion, index) => ({
      index: index + 1,
      target: suggestion.target,
      file: suggestion.file,
      description: suggestion.description,
      priority: suggestion.priority,
      effort: suggestion.effort
    }));

    return {
      ...baseData,
      summary: {
        statements: this.formatPercentage(data.summary.statements),
        branches: this.formatPercentage(data.summary.branches),
        functions: this.formatPercentage(data.summary.functions),
        lines: this.formatPercentage(data.summary.lines)
      },
      meetsThresholds: data.meetsThreshold,
      files,
      suggestions
    };
  }
}