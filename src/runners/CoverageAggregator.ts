import type {
  CoverageData,
  FileCoverage,
  UncoveredArea,
  CoverageThresholds,
} from './CoverageParser';
import { logger } from '../utils/logger';

/**
 * Aggregated coverage data from multiple test runs or sources
 */
export interface AggregatedCoverageData {
  /** Combined coverage summary */
  summary: CoverageData['summary'];
  /** All files with their aggregated coverage */
  files: Record<string, FileCoverage>;
  /** All uncovered areas across all sources */
  uncoveredAreas: UncoveredArea[];
  /** Whether aggregated coverage meets thresholds */
  meetsThreshold: boolean;
  /** Thresholds used for validation */
  thresholds?: CoverageThresholds;
  /** Metadata about the aggregation */
  metadata: AggregationMetadata;
}

export interface AggregationMetadata {
  /** Number of coverage sources aggregated */
  sourceCount: number;
  /** Timestamps of coverage data */
  timestamps: Date[];
  /** Test frameworks used */
  frameworks: string[];
  /** Total number of files covered */
  totalFiles: number;
  /** Aggregation strategy used */
  strategy: AggregationStrategy;
}

export type AggregationStrategy = 'union' | 'intersection' | 'latest' | 'highest';

export interface CoverageSource {
  data: CoverageData;
  framework: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

/**
 * Configuration for coverage aggregation
 */
export interface AggregationConfig {
  /** Strategy for combining coverage from multiple sources */
  strategy: AggregationStrategy;
  /** Whether to preserve individual source metadata */
  preserveMetadata: boolean;
  /** Thresholds to check against aggregated data */
  thresholds?: CoverageThresholds;
  /** File patterns to include/exclude during aggregation */
  fileFilters?: {
    include?: string[];
    exclude?: string[];
  };
  /** Minimum coverage percentage to consider a line covered */
  coverageThreshold?: number;
}

/**
 * Aggregates coverage data from multiple sources (test runs, frameworks, etc.)
 */
export class CoverageAggregator {
  private config: AggregationConfig;
  private sources: CoverageSource[] = [];

  constructor(config: Partial<AggregationConfig> = {}) {
    this.config = {
      strategy: 'union',
      preserveMetadata: true,
      coverageThreshold: 0,
      ...config,
    };
  }

  /**
   * Add a coverage source to be aggregated
   */
  addSource(data: CoverageData, framework: string, metadata?: Record<string, any>): void {
    this.sources.push({
      data,
      framework,
      timestamp: new Date(),
      metadata: metadata || {},
    });

    logger.debug('Added coverage source', {
      framework,
      filesCount: Object.keys(data.files).length,
      summary: data.summary,
    });
  }

  /**
   * Add multiple coverage sources at once
   */
  addSources(
    sources: Array<{ data: CoverageData; framework: string; metadata?: Record<string, any> }>
  ): void {
    for (const source of sources) {
      this.addSource(source.data, source.framework, source.metadata);
    }
  }

  /**
   * Clear all coverage sources
   */
  clearSources(): void {
    this.sources = [];
    logger.debug('Cleared all coverage sources');
  }

  /**
   * Aggregate all coverage sources into combined data
   */
  aggregate(): AggregatedCoverageData {
    if (this.sources.length === 0) {
      logger.warn('No coverage sources to aggregate');
      return this.createEmptyAggregation();
    }

    logger.info('Aggregating coverage data', {
      sourceCount: this.sources.length,
      strategy: this.config.strategy,
    });

    const filteredSources = this.filterSources(this.sources);
    const aggregatedFiles = this.aggregateFiles(filteredSources);
    const summary = this.calculateAggregatedSummary(aggregatedFiles);
    const uncoveredAreas = this.aggregateUncoveredAreas(filteredSources);
    const meetsThreshold = this.checkThresholds(summary);

    const metadata: AggregationMetadata = {
      sourceCount: filteredSources.length,
      timestamps: filteredSources.map((s) => s.timestamp),
      frameworks: [...new Set(filteredSources.map((s) => s.framework))],
      totalFiles: Object.keys(aggregatedFiles).length,
      strategy: this.config.strategy,
    };

    const result: AggregatedCoverageData = {
      summary,
      files: aggregatedFiles,
      uncoveredAreas,
      meetsThreshold,
      metadata,
    };

    if (this.config.thresholds) {
      result.thresholds = this.config.thresholds;
    }

    logger.info('Coverage aggregation completed', {
      totalFiles: metadata.totalFiles,
      summary,
      meetsThreshold,
    });

    return result;
  }

  /**
   * Get statistics about the current sources
   */
  getSourceStats(): {
    count: number;
    frameworks: string[];
    totalFiles: number;
    dateRange: { earliest: Date; latest: Date } | null;
  } {
    if (this.sources.length === 0) {
      return {
        count: 0,
        frameworks: [],
        totalFiles: 0,
        dateRange: null,
      };
    }

    const timestamps = this.sources.map((s) => s.timestamp);
    const allFiles = new Set<string>();

    for (const source of this.sources) {
      Object.keys(source.data.files).forEach((file) => allFiles.add(file));
    }

    return {
      count: this.sources.length,
      frameworks: [...new Set(this.sources.map((s) => s.framework))],
      totalFiles: allFiles.size,
      dateRange: {
        earliest: new Date(Math.min(...timestamps.map((t) => t.getTime()))),
        latest: new Date(Math.max(...timestamps.map((t) => t.getTime()))),
      },
    };
  }

  private filterSources(sources: CoverageSource[]): CoverageSource[] {
    // Apply any source-level filtering here
    // For now, return all sources
    return sources;
  }

  private aggregateFiles(sources: CoverageSource[]): Record<string, FileCoverage> {
    const allFiles = new Set<string>();

    // Collect all unique file paths
    for (const source of sources) {
      Object.keys(source.data.files).forEach((file) => {
        if (this.shouldIncludeFile(file)) {
          allFiles.add(file);
        }
      });
    }

    const aggregatedFiles: Record<string, FileCoverage> = {};

    // Aggregate each file according to strategy
    for (const filePath of allFiles) {
      const fileCoverages = sources
        .map((source) => source.data.files[filePath])
        .filter((coverage) => coverage !== undefined);

      if (fileCoverages.length > 0) {
        aggregatedFiles[filePath] = this.aggregateFileCoverage(fileCoverages, filePath);
      }
    }

    return aggregatedFiles;
  }

  private aggregateFileCoverage(coverages: FileCoverage[], filePath: string): FileCoverage {
    switch (this.config.strategy) {
      case 'union':
        return this.unionFileCoverage(coverages, filePath);
      case 'intersection':
        return this.intersectionFileCoverage(coverages, filePath);
      case 'latest':
        return coverages[coverages.length - 1] || this.createEmptyFileCoverage(filePath); // Assume last is latest
      case 'highest':
        return this.highestFileCoverage(coverages, filePath);
      default:
        logger.warn('Unknown aggregation strategy, using union', {
          strategy: this.config.strategy,
        });
        return this.unionFileCoverage(coverages, filePath);
    }
  }

  private unionFileCoverage(coverages: FileCoverage[], filePath: string): FileCoverage {
    // Union: A line is covered if it's covered in ANY source
    const allUncoveredLines = new Set<number>();

    let maxStatements = 0;
    let maxBranches = 0;
    let maxFunctions = 0;
    let maxLines = 0;

    for (const coverage of coverages) {
      // Track the highest coverage percentages
      maxStatements = Math.max(maxStatements, coverage.summary.statements);
      maxBranches = Math.max(maxBranches, coverage.summary.branches);
      maxFunctions = Math.max(maxFunctions, coverage.summary.functions);
      maxLines = Math.max(maxLines, coverage.summary.lines);

      // Collect all uncovered lines
      coverage.uncoveredLines.forEach((line) => allUncoveredLines.add(line));
    }

    // In union strategy, use the highest coverage percentages found
    return {
      path: filePath,
      summary: {
        statements: maxStatements,
        branches: maxBranches,
        functions: maxFunctions,
        lines: maxLines,
      },
      uncoveredLines: Array.from(allUncoveredLines).sort((a, b) => a - b),
    };
  }

  private intersectionFileCoverage(coverages: FileCoverage[], filePath: string): FileCoverage {
    // Intersection: A line is covered only if it's covered in ALL sources
    if (coverages.length === 1) {
      return coverages[0] || this.createEmptyFileCoverage(filePath);
    }

    if (coverages.length === 0) {
      return this.createEmptyFileCoverage(filePath);
    }

    let minStatements = 100;
    let minBranches = 100;
    let minFunctions = 100;
    let minLines = 100;

    // Get the lowest coverage percentages (most conservative)
    for (const coverage of coverages) {
      minStatements = Math.min(minStatements, coverage.summary.statements);
      minBranches = Math.min(minBranches, coverage.summary.branches);
      minFunctions = Math.min(minFunctions, coverage.summary.functions);
      minLines = Math.min(minLines, coverage.summary.lines);
    }

    // For uncovered lines, include lines that are uncovered in ANY source
    const allUncoveredLines = new Set<number>();
    for (const coverage of coverages) {
      coverage.uncoveredLines.forEach((line) => allUncoveredLines.add(line));
    }

    return {
      path: filePath,
      summary: {
        statements: minStatements,
        branches: minBranches,
        functions: minFunctions,
        lines: minLines,
      },
      uncoveredLines: Array.from(allUncoveredLines).sort((a, b) => a - b),
    };
  }

  private highestFileCoverage(coverages: FileCoverage[], filePath: string): FileCoverage {
    // Return the coverage with the highest overall percentage
    if (coverages.length === 0) {
      return {
        path: filePath,
        summary: { statements: 0, branches: 0, functions: 0, lines: 0 },
        uncoveredLines: [],
      };
    }

    let bestCoverage = coverages[0]!; // Already checked for empty array above
    let bestScore = this.calculateOverallScore(bestCoverage.summary);

    for (const coverage of coverages.slice(1)) {
      const score = this.calculateOverallScore(coverage.summary);
      if (score > bestScore) {
        bestCoverage = coverage;
        bestScore = score;
      }
    }

    return bestCoverage;
  }

  private calculateOverallScore(summary: FileCoverage['summary']): number {
    // Weighted average of coverage types
    return (
      summary.statements * 0.4 +
      summary.lines * 0.3 +
      summary.branches * 0.2 +
      summary.functions * 0.1
    );
  }

  private calculateAggregatedSummary(
    files: Record<string, FileCoverage>
  ): AggregatedCoverageData['summary'] {
    const fileCount = Object.keys(files).length;
    if (fileCount === 0) {
      return { statements: 0, branches: 0, functions: 0, lines: 0 };
    }

    let totalStatements = 0;
    let totalBranches = 0;
    let totalFunctions = 0;
    let totalLines = 0;

    for (const coverage of Object.values(files)) {
      totalStatements += coverage.summary.statements;
      totalBranches += coverage.summary.branches;
      totalFunctions += coverage.summary.functions;
      totalLines += coverage.summary.lines;
    }

    return {
      statements: totalStatements / fileCount,
      branches: totalBranches / fileCount,
      functions: totalFunctions / fileCount,
      lines: totalLines / fileCount,
    };
  }

  private aggregateUncoveredAreas(sources: CoverageSource[]): UncoveredArea[] {
    const areasMap = new Map<string, UncoveredArea>();

    for (const source of sources) {
      for (const area of source.data.uncoveredAreas) {
        if (!this.shouldIncludeFile(area.file)) continue;

        // Create unique key for deduplication
        const key = `${area.file}:${area.line}:${area.type}:${area.function || ''}`;

        if (!areasMap.has(key)) {
          areasMap.set(key, { ...area });
        }
      }
    }

    return Array.from(areasMap.values());
  }

  private shouldIncludeFile(filePath: string): boolean {
    const filters = this.config.fileFilters;
    if (!filters) return true;

    // Check exclude patterns first
    if (filters.exclude) {
      for (const pattern of filters.exclude) {
        if (this.matchesPattern(filePath, pattern)) {
          return false;
        }
      }
    }

    // Check include patterns
    if (filters.include && filters.include.length > 0) {
      for (const pattern of filters.include) {
        if (this.matchesPattern(filePath, pattern)) {
          return true;
        }
      }
      return false; // If include patterns exist, file must match one
    }

    return true;
  }

  private matchesPattern(filePath: string, pattern: string): boolean {
    // Simple glob-like pattern matching
    const regexPattern = pattern.replace(/\./g, '\\.').replace(/\*/g, '.*').replace(/\?/g, '.');

    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(filePath);
  }

  private checkThresholds(summary: AggregatedCoverageData['summary']): boolean {
    if (!this.config.thresholds) return true;

    const thresholds = this.config.thresholds;
    return (
      (!thresholds.statements || summary.statements >= thresholds.statements) &&
      (!thresholds.branches || summary.branches >= thresholds.branches) &&
      (!thresholds.functions || summary.functions >= thresholds.functions) &&
      (!thresholds.lines || summary.lines >= thresholds.lines)
    );
  }

  private createEmptyAggregation(): AggregatedCoverageData {
    const result: AggregatedCoverageData = {
      summary: { statements: 0, branches: 0, functions: 0, lines: 0 },
      files: {},
      uncoveredAreas: [],
      meetsThreshold: !this.config.thresholds,
      metadata: {
        sourceCount: 0,
        timestamps: [],
        frameworks: [],
        totalFiles: 0,
        strategy: this.config.strategy,
      },
    };

    if (this.config.thresholds) {
      result.thresholds = this.config.thresholds;
    }

    return result;
  }

  private createEmptyFileCoverage(filePath: string): FileCoverage {
    return {
      path: filePath,
      summary: { statements: 0, branches: 0, functions: 0, lines: 0 },
      uncoveredLines: [],
    };
  }
}
