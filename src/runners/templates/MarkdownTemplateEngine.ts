import { CoverageData } from '../CoverageParser';
import { AggregatedCoverageData } from '../CoverageAggregator';
import { CoverageGapAnalysis } from '../CoverageVisualizer';

export interface MarkdownTemplateData {
  projectName: string;
  generatedDate: string;
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

export class MarkdownTemplateEngine {
  render(data: MarkdownTemplateData): string {
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
    const files = Object.entries(data.files).map(([filename, coverage]) => ({
      filename,
      lines: coverage.summary.lines.toFixed(1),
      statements: coverage.summary.statements.toFixed(1),
      branches: coverage.summary.branches.toFixed(1),
      functions: coverage.summary.functions.toFixed(1)
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
      projectName: projectName || '',
      generatedDate: new Date().toLocaleString(),
      summary: {
        statements: data.summary.statements.toFixed(1),
        branches: data.summary.branches.toFixed(1),
        functions: data.summary.functions.toFixed(1),
        lines: data.summary.lines.toFixed(1)
      },
      meetsThresholds: data.meetsThreshold,
      files,
      suggestions
    };
  }
}