import type { CoverageData } from '../CoverageParser';
import type { AggregatedCoverageData } from '../CoverageAggregator';
import type { BaseTemplateData } from './BaseTemplateEngine';
import { BaseTemplateEngine } from './BaseTemplateEngine';

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
    data.files.forEach((file) => {
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
    data.uncoveredAreas.forEach((area) => {
      xml.push(
        `        <area file="${this.escapeXml(area.file)}" line="${area.line}" type="${area.type}">`
      );
      xml.push(`            ${this.escapeXml(area.description)}`);
      xml.push('        </area>');
    });
    xml.push('    </uncovered_areas>');

    xml.push('</coverage>');

    return xml.join('\n');
  }

  prepareTemplateData(data: CoverageData | AggregatedCoverageData): XmlTemplateData {
    const baseData = this.createBaseTemplateData();
    const files = this.transformFilesData(data.files, 'raw');
    const uncoveredAreas = this.transformUncoveredAreasData(data.uncoveredAreas);

    return {
      ...baseData,
      summary: data.summary,
      files: files.map((file) => ({
        path: file.path!,
        summary: {
          statements: file.summary.statements as number,
          branches: file.summary.branches as number,
          functions: file.summary.functions as number,
          lines: file.summary.lines as number,
        },
        uncoveredLines: file.uncoveredLines || '',
      })),
      uncoveredAreas,
    };
  }
}
