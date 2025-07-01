import { promises as fs } from 'fs';
import path from 'path';
import { CoverageData } from '../CoverageParser';
import { AggregatedCoverageData } from '../CoverageAggregator';
import { CoverageGapAnalysis } from '../CoverageVisualizer';
import { BaseTemplateEngine, BaseTemplateData } from './BaseTemplateEngine';

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

  private renderTemplate(template: string, data: any): string {
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
        coverageClass: this.getCoverageClass(data.summary.statements)
      },
      {
        name: 'Branches',
        value: this.formatPercentage(data.summary.branches),
        coverageClass: this.getCoverageClass(data.summary.branches)
      },
      {
        name: 'Functions',
        value: this.formatPercentage(data.summary.functions),
        coverageClass: this.getCoverageClass(data.summary.functions)
      },
      {
        name: 'Lines',
        value: this.formatPercentage(data.summary.lines),
        coverageClass: this.getCoverageClass(data.summary.lines)
      }
    ];

    const files = this.transformFilesData(data.files);

    return {
      ...baseData,
      metrics,
      files,
      ...(gaps.suggestions.length > 0 && { suggestions: gaps.suggestions }),
      ...(data.uncoveredAreas.length > 0 && { uncoveredAreas: data.uncoveredAreas })
    };
  }
}