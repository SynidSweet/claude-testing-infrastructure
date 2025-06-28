import { promises as fs } from 'fs';
import path from 'path';
import { CoverageData, FileCoverage, UncoveredArea } from './CoverageParser';
import { AggregatedCoverageData } from './CoverageAggregator';
import { logger } from '../utils/logger';
import { HtmlTemplateEngine } from './templates/HtmlTemplateEngine';
import { MarkdownTemplateEngine } from './templates/MarkdownTemplateEngine';
import { XmlTemplateEngine } from './templates/XmlTemplateEngine';

/**
 * Coverage report configuration
 */
export interface CoverageReportConfig {
  /** Output directory for reports */
  outputDir: string;
  /** Report formats to generate */
  formats: CoverageReportFormat[];
  /** Whether to include file-level details */
  includeFileDetails: boolean;
  /** Whether to include uncovered areas */
  includeUncoveredAreas: boolean;
  /** Minimum coverage to highlight as good */
  goodCoverageThreshold: number;
  /** Coverage below this threshold is highlighted as poor */
  poorCoverageThreshold: number;
  /** Project name for reports */
  projectName?: string;
  /** Additional metadata to include */
  metadata?: Record<string, any>;
}

export type CoverageReportFormat = 'html' | 'json' | 'markdown' | 'text' | 'xml';

/**
 * Coverage gap analysis result
 */
export interface CoverageGapAnalysis {
  /** Total number of gaps found */
  totalGaps: number;
  /** Gaps categorized by type */
  gapsByType: Record<string, UncoveredArea[]>;
  /** Gaps categorized by file */
  gapsByFile: Record<string, UncoveredArea[]>;
  /** High-priority gaps (based on function importance, complexity, etc.) */
  highPriorityGaps: UncoveredArea[];
  /** Suggestions for improving coverage */
  suggestions: CoverageSuggestion[];
  /** Coverage improvement potential */
  improvementPotential: {
    statements: number;
    branches: number;
    functions: number;
    lines: number;
  };
}

export interface CoverageSuggestion {
  /** Type of suggestion */
  type: 'test_missing_function' | 'test_edge_cases' | 'test_error_paths' | 'test_integration';
  /** File the suggestion applies to */
  file: string;
  /** Function or area the suggestion applies to */
  target: string;
  /** Description of what should be tested */
  description: string;
  /** Priority level (1-10, 10 being highest) */
  priority: number;
  /** Estimated effort to implement */
  effort: 'low' | 'medium' | 'high';
}

/**
 * Visualization and reporting for coverage data
 */
export class CoverageVisualizer {
  private config: CoverageReportConfig;
  private htmlTemplateEngine: HtmlTemplateEngine;
  private markdownTemplateEngine: MarkdownTemplateEngine;
  private xmlTemplateEngine: XmlTemplateEngine;

  constructor(config: Partial<CoverageReportConfig> = {}) {
    this.config = {
      outputDir: './coverage-reports',
      formats: ['html', 'json'],
      includeFileDetails: true,
      includeUncoveredAreas: true,
      goodCoverageThreshold: 80,
      poorCoverageThreshold: 50,
      ...config
    };
    this.htmlTemplateEngine = new HtmlTemplateEngine();
    this.markdownTemplateEngine = new MarkdownTemplateEngine();
    this.xmlTemplateEngine = new XmlTemplateEngine();
  }

  /**
   * Generate comprehensive coverage reports
   */
  async generateReports(data: CoverageData | AggregatedCoverageData): Promise<string[]> {
    const generatedFiles: string[] = [];

    // Ensure output directory exists
    await fs.mkdir(this.config.outputDir, { recursive: true });

    logger.info('Generating coverage reports', {
      formats: this.config.formats,
      outputDir: this.config.outputDir
    });

    for (const format of this.config.formats) {
      try {
        const filePath = await this.generateReport(data, format);
        generatedFiles.push(filePath);
        logger.debug(`Generated ${format} report`, { filePath });
      } catch (error) {
        logger.error(`Failed to generate ${format} report`, { error });
      }
    }

    logger.info('Coverage report generation completed', {
      generatedFiles: generatedFiles.length,
      files: generatedFiles
    });

    return generatedFiles;
  }

  /**
   * Analyze coverage gaps and provide suggestions
   */
  analyzeGaps(data: CoverageData | AggregatedCoverageData): CoverageGapAnalysis {
    const gaps = data.uncoveredAreas;
    
    // Categorize gaps by type
    const gapsByType: Record<string, UncoveredArea[]> = {
      statement: [],
      branch: [],
      function: [],
      line: []
    };

    gaps.forEach(gap => {
      if (gapsByType[gap.type]) {
        gapsByType[gap.type]!.push(gap);
      }
    });

    // Categorize gaps by file
    const gapsByFile: Record<string, UncoveredArea[]> = {};
    gaps.forEach(gap => {
      if (!gapsByFile[gap.file]) {
        gapsByFile[gap.file] = [];
      }
      gapsByFile[gap.file]!.push(gap);
    });

    // Identify high-priority gaps
    const highPriorityGaps = this.identifyHighPriorityGaps(gaps, data.files);

    // Generate suggestions
    const suggestions = this.generateSuggestions(data);

    // Calculate improvement potential
    const improvementPotential = this.calculateImprovementPotential(data);

    return {
      totalGaps: gaps.length,
      gapsByType,
      gapsByFile,
      highPriorityGaps,
      suggestions,
      improvementPotential
    };
  }

  /**
   * Generate a console-friendly coverage summary
   */
  generateConsoleSummary(data: CoverageData | AggregatedCoverageData): string {
    const { summary } = data;
    const lines: string[] = [];

    lines.push('📊 Coverage Summary');
    lines.push('==================');
    lines.push('');

    // Overall coverage
    lines.push(`Statements: ${this.formatPercentage(summary.statements)}`);
    lines.push(`Branches:   ${this.formatPercentage(summary.branches)}`);
    lines.push(`Functions:  ${this.formatPercentage(summary.functions)}`);
    lines.push(`Lines:      ${this.formatPercentage(summary.lines)}`);
    lines.push('');

    // Threshold status
    if (data.thresholds) {
      lines.push('Threshold Status:');
      lines.push(`✅ Meets thresholds: ${data.meetsThreshold ? 'Yes' : 'No'}`);
      lines.push('');
    }

    // File summary
    const fileCount = Object.keys(data.files).length;
    lines.push(`📁 Files covered: ${fileCount}`);
    
    if (data.uncoveredAreas.length > 0) {
      lines.push(`⚠️  Uncovered areas: ${data.uncoveredAreas.length}`);
    }

    // Quick gap analysis
    const gaps = this.analyzeGaps(data);
    if (gaps.totalGaps > 0) {
      lines.push('');
      lines.push('🎯 Top Opportunities:');
      
      gaps.suggestions.slice(0, 3).forEach((suggestion, i) => {
        lines.push(`${i + 1}. ${suggestion.description} (${suggestion.effort} effort)`);
      });
    }

    return lines.join('\n');
  }

  private async generateReport(data: CoverageData | AggregatedCoverageData, format: CoverageReportFormat): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `coverage-report-${timestamp}.${format}`;
    const filePath = path.join(this.config.outputDir, filename);

    switch (format) {
      case 'html':
        await this.generateHtmlReport(data, filePath);
        break;
      case 'json':
        await this.generateJsonReport(data, filePath);
        break;
      case 'markdown':
        await this.generateMarkdownReport(data, filePath);
        break;
      case 'text':
        await this.generateTextReport(data, filePath);
        break;
      case 'xml':
        await this.generateXmlReport(data, filePath);
        break;
      default:
        throw new Error(`Unsupported report format: ${format}`);
    }

    return filePath;
  }

  private async generateHtmlReport(data: CoverageData | AggregatedCoverageData, filePath: string): Promise<void> {
    const gaps = this.analyzeGaps(data);
    
    // Load the HTML template
    const template = await this.htmlTemplateEngine.loadTemplate('coverage-report');
    
    // Prepare template data
    const templateData = this.htmlTemplateEngine.prepareTemplateData(
      data,
      gaps,
      this.config.projectName
    );
    
    // Render the template
    const html = this.htmlTemplateEngine.render(template, templateData);
    
    // Write the rendered HTML to file
    await fs.writeFile(filePath, html, 'utf8');
  }

  private async generateJsonReport(data: CoverageData | AggregatedCoverageData, filePath: string): Promise<void> {
    const gaps = this.analyzeGaps(data);
    
    const report = {
      timestamp: new Date().toISOString(),
      projectName: this.config.projectName,
      summary: data.summary,
      files: data.files,
      uncoveredAreas: data.uncoveredAreas,
      thresholds: data.thresholds,
      meetsThreshold: data.meetsThreshold,
      gapAnalysis: gaps,
      metadata: 'metadata' in data ? data.metadata : undefined
    };

    await fs.writeFile(filePath, JSON.stringify(report, null, 2), 'utf8');
  }

  private async generateMarkdownReport(data: CoverageData | AggregatedCoverageData, filePath: string): Promise<void> {
    const gaps = this.analyzeGaps(data);
    
    // Prepare template data
    const templateData = this.markdownTemplateEngine.prepareTemplateData(
      data,
      gaps,
      this.config.projectName
    );
    
    // Render the markdown
    const markdown = this.markdownTemplateEngine.render(templateData);
    
    // Write the rendered markdown to file
    await fs.writeFile(filePath, markdown, 'utf8');
  }

  private async generateTextReport(data: CoverageData | AggregatedCoverageData, filePath: string): Promise<void> {
    const content = this.generateConsoleSummary(data);
    await fs.writeFile(filePath, content, 'utf8');
  }

  private async generateXmlReport(data: CoverageData | AggregatedCoverageData, filePath: string): Promise<void> {
    // Prepare template data
    const templateData = this.xmlTemplateEngine.prepareTemplateData(data);
    
    // Render the XML
    const xml = this.xmlTemplateEngine.render(templateData);
    
    // Write the rendered XML to file
    await fs.writeFile(filePath, xml, 'utf8');
  }

  private formatPercentage(value: number): string {
    return `${value.toFixed(1)}%`;
  }

  private identifyHighPriorityGaps(gaps: UncoveredArea[], files: Record<string, FileCoverage>): UncoveredArea[] {
    // Score gaps based on various factors
    const scoredGaps = gaps.map(gap => ({
      gap,
      score: this.calculateGapPriority(gap, files[gap.file])
    }));

    // Return top 20% of gaps by score
    scoredGaps.sort((a, b) => b.score - a.score);
    const topCount = Math.max(1, Math.floor(gaps.length * 0.2));
    
    return scoredGaps.slice(0, topCount).map(item => item.gap);
  }

  private calculateGapPriority(gap: UncoveredArea, fileCoverage?: FileCoverage): number {
    let score = 0;

    // Type priority
    if (gap.type === 'function') score += 5;
    else if (gap.type === 'branch') score += 3;
    else if (gap.type === 'statement') score += 2;
    else score += 1;

    // Function name priority (main, init, etc. are important)
    if (gap.function) {
      if (['main', 'init', 'setup', 'constructor'].some(important => 
          gap.function!.toLowerCase().includes(important))) {
        score += 3;
      }
    }

    // File coverage priority (files with lower coverage are more important)
    if (fileCoverage && fileCoverage.summary.lines < 50) {
      score += 2;
    }

    return score;
  }

  private generateSuggestions(data: CoverageData | AggregatedCoverageData): CoverageSuggestion[] {
    const suggestions: CoverageSuggestion[] = [];

    // Analyze each file for suggestions
    Object.entries(data.files).forEach(([filePath, coverage]) => {
      // Suggest testing for files with low coverage
      if (coverage.summary.lines < 70) {
        suggestions.push({
          type: 'test_missing_function',
          file: filePath,
          target: 'Overall Coverage',
          description: `Increase test coverage for ${filePath} (currently ${coverage.summary.lines.toFixed(1)}%)`,
          priority: coverage.summary.lines < 50 ? 8 : 6,
          effort: coverage.uncoveredLines.length > 20 ? 'high' : 'medium'
        });
      }

      // Suggest branch testing for low branch coverage
      if (coverage.summary.branches < coverage.summary.lines - 10) {
        suggestions.push({
          type: 'test_edge_cases',
          file: filePath,
          target: 'Branch Coverage',
          description: `Add tests for conditional branches in ${filePath}`,
          priority: 7,
          effort: 'medium'
        });
      }

      // Suggest function testing for uncovered functions
      if (coverage.uncoveredFunctions && coverage.uncoveredFunctions.length > 0) {
        coverage.uncoveredFunctions.forEach(func => {
          suggestions.push({
            type: 'test_missing_function',
            file: filePath,
            target: func,
            description: `Add tests for function '${func}' in ${filePath}`,
            priority: 8,
            effort: 'low'
          });
        });
      }
    });

    // Sort by priority and return top suggestions
    return suggestions
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 10); // Limit to top 10 suggestions
  }

  private calculateImprovementPotential(data: CoverageData | AggregatedCoverageData): CoverageGapAnalysis['improvementPotential'] {
    // Calculate how much coverage could theoretically be improved
    // This is a simplified calculation - in reality it would need more complex analysis
    
    const currentCoverage = data.summary;
    const maxImprovement = {
      statements: Math.min(100 - currentCoverage.statements, 30), // Max 30% improvement
      branches: Math.min(100 - currentCoverage.branches, 25),
      functions: Math.min(100 - currentCoverage.functions, 20),
      lines: Math.min(100 - currentCoverage.lines, 30)
    };

    return maxImprovement;
  }
}