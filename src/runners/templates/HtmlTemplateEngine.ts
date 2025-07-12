import { promises as fs } from 'fs';
import path from 'path';
import type { CoverageData } from '../CoverageParser';
import type { AggregatedCoverageData } from '../CoverageAggregator';
import type { CoverageGapAnalysis } from '../CoverageVisualizer';
import type { BaseTemplateData } from './BaseTemplateEngine';
import { BaseTemplateEngine } from './BaseTemplateEngine';

export interface HtmlTemplateData extends BaseTemplateData {
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

export class HtmlTemplateEngine extends BaseTemplateEngine<HtmlTemplateData> {
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

  async render(data: HtmlTemplateData): Promise<string> {
    const template = await this.loadTemplate('coverage-report');
    return this.renderTemplate(template, data);
  }

  prepareTemplateData(
    data: CoverageData | AggregatedCoverageData,
    gaps: CoverageGapAnalysis,
    projectName?: string
  ): HtmlTemplateData {
    const baseData = this.createBaseTemplateData(projectName);

    const metrics = [
      {
        name: 'Statements',
        value: this.formatPercentage(data.summary.statements),
        coverageClass: this.getCoverageClass(data.summary.statements),
      },
      {
        name: 'Branches',
        value: this.formatPercentage(data.summary.branches),
        coverageClass: this.getCoverageClass(data.summary.branches),
      },
      {
        name: 'Functions',
        value: this.formatPercentage(data.summary.functions),
        coverageClass: this.getCoverageClass(data.summary.functions),
      },
      {
        name: 'Lines',
        value: this.formatPercentage(data.summary.lines),
        coverageClass: this.getCoverageClass(data.summary.lines),
      },
    ];

    return {
      ...baseData,
      metrics,
      files: this.transformFilesData(data.files, 'formatted').map((file) => ({
        filename: file.filename,
        summary: {
          lines: file.summary.lines as string,
          statements: file.summary.statements as string,
          branches: file.summary.branches as string,
          functions: file.summary.functions as string,
        },
        ...(file.uncoveredLines && { uncoveredLines: file.uncoveredLines }),
      })),
      ...(gaps.suggestions.length > 0 && {
        suggestions: this.transformSuggestionsData(gaps.suggestions),
      }),
      ...(data.uncoveredAreas.length > 0 && {
        uncoveredAreas: this.transformUncoveredAreasData(data.uncoveredAreas),
      }),
    };
  }
}
