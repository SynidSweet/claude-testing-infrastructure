import { promises as fs } from 'fs';
import path from 'path';
import { CoverageData, FileCoverage, UncoveredArea } from './CoverageParser';
import { AggregatedCoverageData } from './CoverageAggregator';
import { logger } from '../utils/logger';

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
    
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Coverage Report - ${this.config.projectName || 'Project'}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f5f5f5; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 20px; }
        .metric { background: white; border: 1px solid #ddd; padding: 15px; border-radius: 5px; text-align: center; }
        .metric-value { font-size: 24px; font-weight: bold; }
        .good { color: #28a745; }
        .warning { color: #ffc107; }
        .poor { color: #dc3545; }
        .file-list { margin-top: 20px; }
        .file-item { background: #f9f9f9; margin: 5px 0; padding: 10px; border-radius: 3px; }
        .uncovered-area { background: #fff3cd; border-left: 4px solid #ffc107; padding: 8px; margin: 2px 0; }
        .suggestion { background: #d1ecf1; border-left: 4px solid #bee5eb; padding: 8px; margin: 2px 0; }
        .progress-bar { width: 100%; height: 20px; background: #e9ecef; border-radius: 10px; overflow: hidden; }
        .progress-fill { height: 100%; background: linear-gradient(90deg, #dc3545 0%, #ffc107 50%, #28a745 100%); }
    </style>
</head>
<body>
    <div class="header">
        <h1>Coverage Report</h1>
        <p>Generated on: ${new Date().toLocaleString()}</p>
        ${this.config.projectName ? `<p>Project: ${this.config.projectName}</p>` : ''}
    </div>

    <div class="summary">
        <div class="metric">
            <div class="metric-value ${this.getCoverageClass(data.summary.statements)}">
                ${data.summary.statements.toFixed(1)}%
            </div>
            <div>Statements</div>
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${data.summary.statements}%"></div>
            </div>
        </div>
        <div class="metric">
            <div class="metric-value ${this.getCoverageClass(data.summary.branches)}">
                ${data.summary.branches.toFixed(1)}%
            </div>
            <div>Branches</div>
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${data.summary.branches}%"></div>
            </div>
        </div>
        <div class="metric">
            <div class="metric-value ${this.getCoverageClass(data.summary.functions)}">
                ${data.summary.functions.toFixed(1)}%
            </div>
            <div>Functions</div>
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${data.summary.functions}%"></div>
            </div>
        </div>
        <div class="metric">
            <div class="metric-value ${this.getCoverageClass(data.summary.lines)}">
                ${data.summary.lines.toFixed(1)}%
            </div>
            <div>Lines</div>
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${data.summary.lines}%"></div>
            </div>
        </div>
    </div>

    <h2>File Coverage</h2>
    <div class="file-list">
        ${Object.entries(data.files).map(([file, coverage]) => `
            <div class="file-item">
                <h3>${file}</h3>
                <p>Lines: ${coverage.summary.lines.toFixed(1)}% | 
                   Statements: ${coverage.summary.statements.toFixed(1)}% | 
                   Branches: ${coverage.summary.branches.toFixed(1)}% | 
                   Functions: ${coverage.summary.functions.toFixed(1)}%</p>
                ${coverage.uncoveredLines.length > 0 ? 
                  `<p><strong>Uncovered lines:</strong> ${coverage.uncoveredLines.join(', ')}</p>` : 
                  ''}
            </div>
        `).join('')}
    </div>

    ${gaps.suggestions.length > 0 ? `
    <h2>Coverage Improvement Suggestions</h2>
    ${gaps.suggestions.map(suggestion => `
        <div class="suggestion">
            <strong>${suggestion.target}</strong> in ${suggestion.file}<br>
            ${suggestion.description}<br>
            <small>Priority: ${suggestion.priority}/10 | Effort: ${suggestion.effort}</small>
        </div>
    `).join('')}
    ` : ''}

    ${data.uncoveredAreas.length > 0 ? `
    <h2>Uncovered Areas</h2>
    ${data.uncoveredAreas.map(area => `
        <div class="uncovered-area">
            <strong>${area.type}</strong> in ${area.file}:${area.line}<br>
            ${area.description}
        </div>
    `).join('')}
    ` : ''}
</body>
</html>`;

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
    
    const lines = [
      `# Coverage Report${this.config.projectName ? ` - ${this.config.projectName}` : ''}`,
      '',
      `Generated on: ${new Date().toLocaleString()}`,
      '',
      '## Summary',
      '',
      '| Metric | Coverage |',
      '|--------|----------|',
      `| Statements | ${this.formatPercentage(data.summary.statements)} |`,
      `| Branches | ${this.formatPercentage(data.summary.branches)} |`,
      `| Functions | ${this.formatPercentage(data.summary.functions)} |`,
      `| Lines | ${this.formatPercentage(data.summary.lines)} |`,
      '',
    ];

    if (data.thresholds) {
      lines.push(`**Meets Thresholds:** ${data.meetsThreshold ? '✅ Yes' : '❌ No'}`);
      lines.push('');
    }

    if (Object.keys(data.files).length > 0) {
      lines.push('## File Coverage');
      lines.push('');
      lines.push('| File | Lines | Statements | Branches | Functions |');
      lines.push('|------|-------|------------|----------|-----------|');
      
      Object.entries(data.files).forEach(([file, coverage]) => {
        lines.push(`| ${file} | ${coverage.summary.lines.toFixed(1)}% | ${coverage.summary.statements.toFixed(1)}% | ${coverage.summary.branches.toFixed(1)}% | ${coverage.summary.functions.toFixed(1)}% |`);
      });
      lines.push('');
    }

    if (gaps.suggestions.length > 0) {
      lines.push('## Improvement Suggestions');
      lines.push('');
      gaps.suggestions.forEach((suggestion, i) => {
        lines.push(`${i + 1}. **${suggestion.target}** in \`${suggestion.file}\``);
        lines.push(`   - ${suggestion.description}`);
        lines.push(`   - Priority: ${suggestion.priority}/10 | Effort: ${suggestion.effort}`);
        lines.push('');
      });
    }

    await fs.writeFile(filePath, lines.join('\n'), 'utf8');
  }

  private async generateTextReport(data: CoverageData | AggregatedCoverageData, filePath: string): Promise<void> {
    const content = this.generateConsoleSummary(data);
    await fs.writeFile(filePath, content, 'utf8');
  }

  private async generateXmlReport(data: CoverageData | AggregatedCoverageData, filePath: string): Promise<void> {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<coverage timestamp="${new Date().toISOString()}">
    <summary>
        <statements>${data.summary.statements}</statements>
        <branches>${data.summary.branches}</branches>
        <functions>${data.summary.functions}</functions>
        <lines>${data.summary.lines}</lines>
    </summary>
    <files>
        ${Object.entries(data.files).map(([file, coverage]) => `
        <file path="${file}">
            <summary>
                <statements>${coverage.summary.statements}</statements>
                <branches>${coverage.summary.branches}</branches>
                <functions>${coverage.summary.functions}</functions>
                <lines>${coverage.summary.lines}</lines>
            </summary>
            <uncovered_lines>${coverage.uncoveredLines.join(',')}</uncovered_lines>
        </file>`).join('')}
    </files>
    <uncovered_areas>
        ${data.uncoveredAreas.map(area => `
        <area file="${area.file}" line="${area.line}" type="${area.type}">
            ${area.description}
        </area>`).join('')}
    </uncovered_areas>
</coverage>`;

    await fs.writeFile(filePath, xml, 'utf8');
  }

  private formatPercentage(value: number): string {
    return `${value.toFixed(1)}%`;
  }

  private getCoverageClass(value: number): string {
    if (value >= this.config.goodCoverageThreshold) return 'good';
    if (value >= this.config.poorCoverageThreshold) return 'warning';
    return 'poor';
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