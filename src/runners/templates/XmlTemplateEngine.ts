import { CoverageData } from '../CoverageParser';
import { AggregatedCoverageData } from '../CoverageAggregator';
import { BaseTemplateEngine, BaseTemplateData } from './BaseTemplateEngine';

export interface XmlTemplateData extends BaseTemplateData {
  summary: {
    statements: number;
    branches: number;
    functions: number;
    lines: number;
  };
  files: Array<{
    path: string;
    summary: {
      statements: number;
      branches: number;
      functions: number;
      lines: number;
    };
    uncoveredLines: string;
  }>;
  uncoveredAreas: Array<{
    file: string;
    line: number;
    type: string;
    description: string;
  }>;
}

export class XmlTemplateEngine extends BaseTemplateEngine<XmlTemplateData> {
  async render(data: XmlTemplateData): Promise<string> {
    const xml: string[] = [];
    
    xml.push('<?xml version="1.0" encoding="UTF-8"?>');
    xml.push(`<coverage timestamp="${data.timestamp}">`);
    
    // Summary section
    xml.push('    <summary>');
    xml.push(`        <statements>${data.summary.statements}</statements>`);
    xml.push(`        <branches>${data.summary.branches}</branches>`);
    xml.push(`        <functions>${data.summary.functions}</functions>`);
    xml.push(`        <lines>${data.summary.lines}</lines>`);
    xml.push('    </summary>');
    
    // Files section
    xml.push('    <files>');
    data.files.forEach(file => {
      xml.push(`        <file path="${this.escapeXml(file.path)}">`);
      xml.push('            <summary>');
      xml.push(`                <statements>${file.summary.statements}</statements>`);
      xml.push(`                <branches>${file.summary.branches}</branches>`);
      xml.push(`                <functions>${file.summary.functions}</functions>`);
      xml.push(`                <lines>${file.summary.lines}</lines>`);
      xml.push('            </summary>');
      xml.push(`            <uncovered_lines>${file.uncoveredLines}</uncovered_lines>`);
      xml.push('        </file>');
    });
    xml.push('    </files>');
    
    // Uncovered areas section
    xml.push('    <uncovered_areas>');
    data.uncoveredAreas.forEach(area => {
      xml.push(`        <area file="${this.escapeXml(area.file)}" line="${area.line}" type="${area.type}">`);
      xml.push(`            ${this.escapeXml(area.description)}`);
      xml.push('        </area>');
    });
    xml.push('    </uncovered_areas>');
    
    xml.push('</coverage>');
    
    return xml.join('\n');
  }

  prepareTemplateData(data: CoverageData | AggregatedCoverageData): XmlTemplateData {
    const baseData = this.createBaseTemplateData();
    
    const files = Object.entries(data.files).map(([path, coverage]) => ({
      path,
      summary: {
        statements: coverage.summary.statements,
        branches: coverage.summary.branches,
        functions: coverage.summary.functions,
        lines: coverage.summary.lines
      },
      uncoveredLines: coverage.uncoveredLines.join(',')
    }));

    return {
      ...baseData,
      summary: data.summary,
      files,
      uncoveredAreas: data.uncoveredAreas
    };
  }

  private escapeXml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}