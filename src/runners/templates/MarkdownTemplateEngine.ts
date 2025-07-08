import type { CoverageData } from '../CoverageParser';
import type { AggregatedCoverageData } from '../CoverageAggregator';
import type { CoverageGapAnalysis } from '../CoverageVisualizer';
import type { BaseTemplateData } from './BaseTemplateEngine';
import { BaseTemplateEngine } from './BaseTemplateEngine';

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

      data.files.forEach((file) => {
        lines.push(
          `| ${file.filename} | ${file.lines}% | ${file.statements}% | ${file.branches}% | ${file.functions}% |`
        );
      });
      lines.push('');
    }

    // Suggestions
    if (data.suggestions.length > 0) {
      lines.push('## Improvement Suggestions');
      lines.push('');
      data.suggestions.forEach((suggestion) => {
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
    const summary = this.transformSummaryData(data.summary);
    const files = this.transformFilesData(data.files);
    const suggestions = this.transformSuggestionsData(gaps.suggestions);

    return {
      ...baseData,
      summary: {
        statements: summary.statements as string,
        branches: summary.branches as string,
        functions: summary.functions as string,
        lines: summary.lines as string,
      },
      meetsThresholds: data.meetsThreshold,
      files: files.map((file) => ({
        filename: file.filename,
        lines: file.summary.lines as string,
        statements: file.summary.statements as string,
        branches: file.summary.branches as string,
        functions: file.summary.functions as string,
      })),
      suggestions: suggestions.map((suggestion) => ({
        index: suggestion.index!,
        target: suggestion.target,
        file: suggestion.file,
        description: suggestion.description,
        priority: suggestion.priority,
        effort: suggestion.effort,
      })),
    };
  }
}
