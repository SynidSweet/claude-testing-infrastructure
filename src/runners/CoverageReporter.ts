import {
  CoverageParserFactory,
  type CoverageParser,
  type CoverageData,
  type CoverageThresholds,
} from './CoverageParser';
import {
  CoverageAggregator,
  type AggregatedCoverageData,
  type AggregationConfig,
} from './CoverageAggregator';
import {
  CoverageVisualizer,
  type CoverageReportConfig,
  type CoverageGapAnalysis,
} from './CoverageVisualizer';
import { logger } from '../utils/common-imports';

/**
 * Main configuration for the coverage reporting system
 */
export interface CoverageReporterConfig {
  /** Project path for file resolution */
  projectPath: string;
  /** Test framework being used */
  framework: string;
  /** Coverage thresholds */
  thresholds?: CoverageThresholds;
  /** Aggregation configuration */
  aggregation?: Partial<AggregationConfig>;
  /** Report generation configuration */
  reporting?: Partial<CoverageReportConfig>;
  /** Whether to fail on threshold violations */
  failOnThreshold?: boolean;
}

/**
 * Result of coverage processing
 */
export interface CoverageReport {
  /** Original or aggregated coverage data */
  data: CoverageData | AggregatedCoverageData;
  /** Gap analysis results */
  gapAnalysis: CoverageGapAnalysis;
  /** Generated report file paths */
  reportFiles: string[];
  /** Console summary text */
  consoleSummary: string;
  /** Whether coverage meets thresholds */
  meetsThreshold: boolean;
  /** Processing metadata */
  metadata: {
    framework: string;
    processingTime: number;
    sourceCount: number;
    totalFiles: number;
  };
}

/**
 * Comprehensive coverage reporting system that integrates parsing, aggregation, and visualization
 */
export class CoverageReporter {
  private config: CoverageReporterConfig;
  private parser: CoverageParser;
  private aggregator: CoverageAggregator;
  private visualizer: CoverageVisualizer;

  constructor(config: CoverageReporterConfig) {
    this.config = config;

    // Initialize components
    this.parser = CoverageParserFactory.createParser(
      config.framework,
      config.projectPath,
      config.thresholds
    );

    this.aggregator = new CoverageAggregator({
      strategy: 'union',
      ...(config.thresholds && { thresholds: config.thresholds }),
      ...config.aggregation,
    });

    this.visualizer = new CoverageVisualizer({
      outputDir: './coverage-reports',
      formats: ['html', 'json', 'markdown'],
      projectName: 'Test Project',
      goodCoverageThreshold: 80,
      poorCoverageThreshold: 50,
      ...config.reporting,
    });

    logger.debug('CoverageReporter initialized', {
      framework: config.framework,
      projectPath: config.projectPath,
      thresholds: config.thresholds,
    });
  }

  /**
   * Process a single coverage source and generate reports
   */
  async processSingleCoverageSource(coverageData: string | object): Promise<CoverageReport> {
    const startTime = Date.now();

    try {
      logger.info('Processing single coverage source', { framework: this.config.framework });

      // Parse coverage data
      const data = this.parser.parse(coverageData);

      // Generate reports
      const gapAnalysis = this.visualizer.analyzeGaps(data);
      const reportFiles = await this.visualizer.generateReports(data);
      const consoleSummary = this.visualizer.generateConsoleSummary(data);

      // Check thresholds
      const meetsThreshold = data.meetsThreshold;
      if (this.config.failOnThreshold && !meetsThreshold) {
        logger.warn('Coverage does not meet configured thresholds', {
          thresholds: this.config.thresholds,
          actual: data.summary,
        });
      }

      const processingTime = Date.now() - startTime;

      const report: CoverageReport = {
        data,
        gapAnalysis,
        reportFiles,
        consoleSummary,
        meetsThreshold,
        metadata: {
          framework: this.config.framework,
          processingTime,
          sourceCount: 1,
          totalFiles: Object.keys(data.files).length,
        },
      };

      logger.info('Single coverage processing completed', {
        processingTime,
        totalFiles: report.metadata.totalFiles,
        meetsThreshold,
      });

      return report;
    } catch (error) {
      logger.error('Failed to process coverage data', { error });
      throw new Error(
        `Coverage processing failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Process multiple coverage sources and generate aggregated reports
   */
  async processMultiple(
    sources: Array<{
      data: string | object;
      framework: string;
      metadata?: Record<string, unknown>;
    }>
  ): Promise<CoverageReport> {
    const startTime = Date.now();

    try {
      logger.info('Processing multiple coverage sources', {
        sourceCount: sources.length,
        frameworks: [...new Set(sources.map((s) => s.framework))],
      });

      // Clear any existing sources
      this.aggregator.clearSources();

      // Parse and add each source
      for (const source of sources) {
        const parser = CoverageParserFactory.createParser(
          source.framework,
          this.config.projectPath,
          this.config.thresholds
        );

        const parsedData = parser.parse(source.data);
        this.aggregator.addSource(parsedData, source.framework, source.metadata);
      }

      // Aggregate all sources
      const aggregatedData = this.aggregator.aggregate();

      // Generate reports
      const gapAnalysis = this.visualizer.analyzeGaps(aggregatedData);
      const reportFiles = await this.visualizer.generateReports(aggregatedData);
      const consoleSummary = this.visualizer.generateConsoleSummary(aggregatedData);

      // Check thresholds
      const meetsThreshold = aggregatedData.meetsThreshold;
      if (this.config.failOnThreshold && !meetsThreshold) {
        logger.warn('Aggregated coverage does not meet configured thresholds', {
          thresholds: this.config.thresholds,
          actual: aggregatedData.summary,
        });
      }

      const processingTime = Date.now() - startTime;

      const report: CoverageReport = {
        data: aggregatedData,
        gapAnalysis,
        reportFiles,
        consoleSummary,
        meetsThreshold,
        metadata: {
          framework: 'aggregated',
          processingTime,
          sourceCount: sources.length,
          totalFiles: aggregatedData.metadata.totalFiles,
        },
      };

      logger.info('Multiple coverage processing completed', {
        processingTime,
        sourceCount: sources.length,
        totalFiles: report.metadata.totalFiles,
        meetsThreshold,
      });

      return report;
    } catch (error) {
      logger.error('Failed to process multiple coverage sources', { error });
      throw new Error(
        `Coverage aggregation failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Generate only gap analysis without full reports
   */
  analyzeGapsOnly(coverageData: string | object): CoverageGapAnalysis {
    try {
      const data = this.parser.parse(coverageData);
      return this.visualizer.analyzeGaps(data);
    } catch (error) {
      logger.error('Failed to analyze coverage gaps', { error });
      throw new Error(
        `Gap analysis failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Check if coverage meets thresholds without generating reports
   */
  checkThresholds(coverageData: string | object): {
    meetsThreshold: boolean;
    summary: CoverageData['summary'];
    thresholds?: CoverageThresholds;
    violations: string[];
  } {
    try {
      const data = this.parser.parse(coverageData);
      const violations: string[] = [];

      if (data.thresholds) {
        const { thresholds } = data;
        const { summary } = data;

        if (thresholds.statements && summary.statements < thresholds.statements) {
          violations.push(
            `Statements: ${summary.statements.toFixed(1)}% < ${thresholds.statements}%`
          );
        }
        if (thresholds.branches && summary.branches < thresholds.branches) {
          violations.push(`Branches: ${summary.branches.toFixed(1)}% < ${thresholds.branches}%`);
        }
        if (thresholds.functions && summary.functions < thresholds.functions) {
          violations.push(`Functions: ${summary.functions.toFixed(1)}% < ${thresholds.functions}%`);
        }
        if (thresholds.lines && summary.lines < thresholds.lines) {
          violations.push(`Lines: ${summary.lines.toFixed(1)}% < ${thresholds.lines}%`);
        }
      }

      return {
        meetsThreshold: data.meetsThreshold,
        summary: data.summary,
        ...(data.thresholds && { thresholds: data.thresholds }),
        violations,
      };
    } catch (error) {
      logger.error('Failed to check coverage thresholds', { error });
      throw new Error(
        `Threshold check failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Get statistics about the current aggregator state
   */
  getAggregatorStats(): {
    count: number;
    frameworks: string[];
    totalFiles: number;
    dateRange: { earliest: Date; latest: Date } | null;
  } {
    return this.aggregator.getSourceStats();
  }

  /**
   * Update the reporter configuration
   */
  updateConfig(updates: Partial<CoverageReporterConfig>): void {
    this.config = { ...this.config, ...updates };

    // Recreate components if necessary
    if (updates.framework && updates.framework !== this.config.framework) {
      this.parser = CoverageParserFactory.createParser(
        updates.framework,
        this.config.projectPath,
        this.config.thresholds
      );
    }

    if (updates.aggregation) {
      this.aggregator = new CoverageAggregator({
        strategy: 'union',
        ...(this.config.thresholds && { thresholds: this.config.thresholds }),
        ...this.config.aggregation,
        ...updates.aggregation,
      });
    }

    if (updates.reporting) {
      this.visualizer = new CoverageVisualizer({
        outputDir: './coverage-reports',
        formats: ['html', 'json', 'markdown'],
        projectName: 'Test Project',
        goodCoverageThreshold: 80,
        poorCoverageThreshold: 50,
        ...this.config.reporting,
        ...updates.reporting,
      });
    }

    logger.debug('CoverageReporter configuration updated', updates);
  }

  /**
   * Validate if the reporter supports the given framework
   */
  static supportsFramework(framework: string): boolean {
    return CoverageParserFactory.getSupportedFrameworks().includes(framework.toLowerCase());
  }

  /**
   * Get list of supported frameworks
   */
  static getSupportedFrameworks(): string[] {
    return CoverageParserFactory.getSupportedFrameworks();
  }
}

/**
 * Factory for creating CoverageReporter instances with common configurations
 */
export class CoverageReporterFactory {
  /**
   * Create a reporter for Jest projects
   */
  static createJestReporter(
    projectPath: string,
    options: {
      thresholds?: CoverageThresholds;
      outputDir?: string;
      failOnThreshold?: boolean;
    } = {}
  ): CoverageReporter {
    return new CoverageReporter({
      projectPath,
      framework: 'jest',
      ...(options.thresholds && { thresholds: options.thresholds }),
      ...(options.failOnThreshold !== undefined && { failOnThreshold: options.failOnThreshold }),
      reporting: {
        ...(options.outputDir && { outputDir: options.outputDir }),
        formats: ['html', 'json', 'text'],
        includeFileDetails: true,
        includeUncoveredAreas: true,
      },
    });
  }

  /**
   * Create a reporter for Pytest projects
   */
  static createPytestReporter(
    projectPath: string,
    options: {
      thresholds?: CoverageThresholds;
      outputDir?: string;
      failOnThreshold?: boolean;
    } = {}
  ): CoverageReporter {
    return new CoverageReporter({
      projectPath,
      framework: 'pytest',
      ...(options.thresholds && { thresholds: options.thresholds }),
      ...(options.failOnThreshold !== undefined && { failOnThreshold: options.failOnThreshold }),
      reporting: {
        ...(options.outputDir && { outputDir: options.outputDir }),
        formats: ['html', 'json', 'text'],
        includeFileDetails: true,
        includeUncoveredAreas: true,
      },
    });
  }

  /**
   * Create a reporter with aggregation support for multi-framework projects
   */
  static createMultiFrameworkReporter(
    projectPath: string,
    options: {
      thresholds?: CoverageThresholds;
      outputDir?: string;
      aggregationStrategy?: 'union' | 'intersection' | 'latest' | 'highest';
      failOnThreshold?: boolean;
    } = {}
  ): CoverageReporter {
    return new CoverageReporter({
      projectPath,
      framework: 'jest', // Default, will be overridden during processing
      ...(options.thresholds && { thresholds: options.thresholds }),
      ...(options.failOnThreshold !== undefined && { failOnThreshold: options.failOnThreshold }),
      aggregation: {
        strategy: options.aggregationStrategy ?? 'union',
        preserveMetadata: true,
      },
      reporting: {
        ...(options.outputDir && { outputDir: options.outputDir }),
        formats: ['html', 'json', 'markdown'],
        includeFileDetails: true,
        includeUncoveredAreas: true,
      },
    });
  }
}
