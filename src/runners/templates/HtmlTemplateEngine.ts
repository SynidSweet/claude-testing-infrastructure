import { promises as fs } from 'fs';
import path from 'path';
import { CoverageData } from '../CoverageParser';
import { AggregatedCoverageData } from '../CoverageAggregator';
import { CoverageGapAnalysis } from '../CoverageVisualizer';

export interface HtmlTemplateData {
  projectName: string;
  generatedDate: string;
  metrics: Array<{
    name: string;
    value: string;
    coverageClass: string;
  }>;
  files: Array<{
    filename: string;
    summary: {
      lines: string;
      statements: string;
      branches: string;
      functions: string;
    };
    uncoveredLines?: string;
  }>;
  suggestions?: Array<{
    target: string;
    file: string;
    description: string;
    priority: number;
    effort: string;
  }>;
  uncoveredAreas?: Array<{
    type: string;
    file: string;
    line: number;
    description: string;
  }>;
}

export class HtmlTemplateEngine {
  private templateCache: Map<string, string> = new Map();

  async loadTemplate(templateName: string): Promise<string> {
    if (this.templateCache.has(templateName)) {
      return this.templateCache.get(templateName)!;
    }

    const templatePath = path.join(__dirname, `${templateName}.html`);
    const template = await fs.readFile(templatePath, 'utf8');
    this.templateCache.set(templateName, template);
    return template;
  }

  render(template: string, data: any): string {
    // Simple template engine - replace {{variable}} patterns
    let result = template;

    // Handle simple variables
    result = result.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return data[key] !== undefined ? String(data[key]) : match;
    });

    // Handle conditionals {{#if variable}}...{{/if}}
    result = result.replace(/\{\{#if (\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (_match, key, content) => {
      return data[key] ? content : '';
    });

    // Handle loops {{#each array}}...{{/each}}
    result = result.replace(/\{\{#each (\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g, (_match, key, content) => {
      const array = data[key];
      if (!Array.isArray(array)) return '';
      
      return array.map(item => {
        let itemContent = content;
        // Replace nested variables
        itemContent = itemContent.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (m: string, path: string) => {
          const value = this.getNestedValue(item, path);
          return value !== undefined ? String(value) : m;
        });
        return itemContent;
      }).join('');
    });

    return result;
  }

  private getNestedValue(obj: any, path: string): any {
    const parts = path.split('.');
    let current = obj;
    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        return undefined;
      }
    }
    return current;
  }

  getCoverageClass(percentage: number): string {
    if (percentage >= 80) return 'good';
    if (percentage >= 60) return 'warning';
    return 'poor';
  }

  prepareTemplateData(
    data: CoverageData | AggregatedCoverageData,
    gaps: CoverageGapAnalysis,
    projectName?: string
  ): HtmlTemplateData {
    const metrics = [
      {
        name: 'Statements',
        value: data.summary.statements.toFixed(1),
        coverageClass: this.getCoverageClass(data.summary.statements)
      },
      {
        name: 'Branches',
        value: data.summary.branches.toFixed(1),
        coverageClass: this.getCoverageClass(data.summary.branches)
      },
      {
        name: 'Functions',
        value: data.summary.functions.toFixed(1),
        coverageClass: this.getCoverageClass(data.summary.functions)
      },
      {
        name: 'Lines',
        value: data.summary.lines.toFixed(1),
        coverageClass: this.getCoverageClass(data.summary.lines)
      }
    ];

    const files = Object.entries(data.files).map(([filename, coverage]) => ({
      filename,
      summary: {
        lines: coverage.summary.lines.toFixed(1),
        statements: coverage.summary.statements.toFixed(1),
        branches: coverage.summary.branches.toFixed(1),
        functions: coverage.summary.functions.toFixed(1)
      },
      ...(coverage.uncoveredLines.length > 0 && {
        uncoveredLines: coverage.uncoveredLines.join(', ')
      })
    }));

    return {
      projectName: projectName || 'Project',
      generatedDate: new Date().toLocaleString(),
      metrics,
      files,
      ...(gaps.suggestions.length > 0 && { suggestions: gaps.suggestions }),
      ...(data.uncoveredAreas.length > 0 && { uncoveredAreas: data.uncoveredAreas })
    };
  }
}