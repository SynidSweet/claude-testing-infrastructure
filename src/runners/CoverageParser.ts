import path from 'path';
import { logger } from '../utils/logger';

/**
 * Istanbul file coverage data structure
 */
interface IstanbulFileData {
  path?: string;
  s: Record<string, number>; // statement coverage
  b: Record<string, number[]>; // branch coverage
  f: Record<string, number>; // function coverage
  statementMap: Record<
    string,
    { start: { line: number; column: number }; end: { line: number; column: number } }
  >;
  branchMap: Record<string, { loc?: { start?: { line: number; column: number } }; type?: string }>;
  fnMap: Record<string, { name?: string; decl?: { start: { line: number } } }>;
  summary?: {
    statements?: { total?: number; covered?: number; skipped?: number; pct?: number };
    branches?: { total?: number; covered?: number; skipped?: number; pct?: number };
    functions?: { total?: number; covered?: number; skipped?: number; pct?: number };
    lines?: { total?: number; covered?: number; skipped?: number; pct?: number };
  };
}

/**
 * Istanbul coverage format (from Jest)
 */
interface IstanbulCoverageData {
  coverageMap?: Record<string, IstanbulFileData>;
}

/**
 * Jest JSON result format
 */
interface JestCoverageData {
  coverageMap: Record<string, IstanbulFileData>;
}

/**
 * Coverage.py file data structure
 */
interface CoveragePyFileData {
  filename?: string;
  executed_lines?: number[];
  missing_lines?: number[];
  excluded_lines?: number[];
  summary?: {
    covered_lines?: number;
    num_statements?: number;
    percent_covered?: number;
    missing_lines?: number;
    excluded_lines?: number;
  };
}

/**
 * Raw coverage data types
 */
type RawCoverageData =
  | IstanbulCoverageData
  | JestCoverageData
  | CoverageData
  | { files?: Record<string, CoveragePyFileData>; totals?: Record<string, unknown> };

/**
 * Standardized coverage data structure
 */
export interface CoverageData {
  /** Overall coverage percentages */
  summary: {
    statements: number;
    branches: number;
    functions: number;
    lines: number;
  };
  /** Per-file coverage details */
  files: Record<string, FileCoverage>;
  /** Uncovered areas for gap analysis */
  uncoveredAreas: UncoveredArea[];
  /** Coverage meets configured thresholds */
  meetsThreshold: boolean;
  /** Threshold configuration used */
  thresholds?: CoverageThresholds;
}

export interface FileCoverage {
  /** File path relative to project root */
  path: string;
  /** Coverage percentages for this file */
  summary: {
    statements: number;
    branches: number;
    functions: number;
    lines: number;
  };
  /** Specific uncovered line numbers */
  uncoveredLines: number[];
  /** Uncovered branches (if available) */
  uncoveredBranches?: UncoveredBranch[];
  /** Uncovered functions (if available) */
  uncoveredFunctions?: string[];
}

export interface UncoveredBranch {
  line: number;
  column?: number;
  type: 'if' | 'switch' | 'ternary' | 'logical' | 'other';
}

export interface UncoveredArea {
  /** File path */
  file: string;
  /** Type of uncovered area */
  type: 'statement' | 'branch' | 'function' | 'line';
  /** Line number */
  line: number;
  /** Column number (if available) */
  column?: number;
  /** Function name (if applicable) */
  function?: string;
  /** Description of what's uncovered */
  description: string;
}

export interface CoverageThresholds {
  statements?: number;
  branches?: number;
  functions?: number;
  lines?: number;
}

/**
 * Abstract base class for parsing test coverage output
 */
export abstract class CoverageParser {
  protected projectPath: string;
  protected thresholds?: CoverageThresholds;

  constructor(projectPath: string, thresholds?: CoverageThresholds) {
    this.projectPath = projectPath;
    if (thresholds) {
      this.thresholds = thresholds;
    }
  }

  /**
   * Parse coverage data from test runner output or coverage files
   */
  abstract parse(data: string | object): CoverageData;

  /**
   * Check if this parser supports the given coverage format
   */
  abstract supports(format: string): boolean;

  /**
   * Check if coverage meets the configured thresholds
   */
  protected checkThresholds(summary: CoverageData['summary']): boolean {
    if (!this.thresholds) return true;

    const checks = [
      !this.thresholds.statements || summary.statements >= this.thresholds.statements,
      !this.thresholds.branches || summary.branches >= this.thresholds.branches,
      !this.thresholds.functions || summary.functions >= this.thresholds.functions,
      !this.thresholds.lines || summary.lines >= this.thresholds.lines,
    ];

    return checks.every((check) => check);
  }

  /**
   * Normalize file path relative to project root
   */
  protected normalizePath(filePath: string): string {
    if (path.isAbsolute(filePath)) {
      return path.relative(this.projectPath, filePath);
    }
    return filePath;
  }

  /**
   * Extract uncovered areas for gap analysis
   */
  protected extractUncoveredAreas(files: Record<string, FileCoverage>): UncoveredArea[] {
    const areas: UncoveredArea[] = [];

    for (const [filePath, coverage] of Object.entries(files)) {
      // Add uncovered lines
      for (const line of coverage.uncoveredLines) {
        areas.push({
          file: filePath,
          type: 'line',
          line,
          description: `Uncovered line ${line} in ${filePath}`,
        });
      }

      // Add uncovered branches
      if (coverage.uncoveredBranches) {
        for (const branch of coverage.uncoveredBranches) {
          const area: UncoveredArea = {
            file: filePath,
            type: 'branch',
            line: branch.line,
            description: `Uncovered ${branch.type} branch at line ${branch.line} in ${filePath}`,
          };

          if (branch.column !== undefined) {
            area.column = branch.column;
          }

          areas.push(area);
        }
      }

      // Add uncovered functions
      if (coverage.uncoveredFunctions) {
        for (const func of coverage.uncoveredFunctions) {
          areas.push({
            file: filePath,
            type: 'function',
            line: 0, // Line number would need to be extracted from source
            function: func,
            description: `Uncovered function '${func}' in ${filePath}`,
          });
        }
      }
    }

    return areas;
  }

  /**
   * Type guard to check if data is in Istanbul format
   */
  protected isIstanbulFormat(data: RawCoverageData): data is IstanbulCoverageData {
    return typeof data === 'object' && data !== null && ('coverageMap' in data || '' in data);
  }

  /**
   * Type guard to check if data is in Jest format
   */
  protected isJestFormat(data: RawCoverageData): data is JestCoverageData {
    return typeof data === 'object' && data !== null && 'coverageMap' in data;
  }

  /**
   * Type guard to check if data is already in CoverageData format
   */
  protected isCoverageDataFormat(data: RawCoverageData): data is CoverageData {
    return (
      typeof data === 'object' &&
      data !== null &&
      'summary' in data &&
      'files' in data &&
      'uncoveredAreas' in data
    );
  }

  /**
   * Type guard to check if data has thresholds property
   */
  protected hasThresholds(
    data: RawCoverageData
  ): data is CoverageData & { thresholds: CoverageThresholds } {
    return typeof data === 'object' && data !== null && 'thresholds' in data;
  }
}

/**
 * Jest coverage parser
 */
export class JestCoverageParser extends CoverageParser {
  supports(format: string): boolean {
    return format === 'jest' || format === 'istanbul';
  }

  parse(data: string | object): CoverageData {
    try {
      // Validate input data
      if (!data) {
        logger.warn('Empty coverage data provided, returning empty coverage');
        return this.createEmptyCoverage();
      }

      let coverageData: RawCoverageData;

      if (typeof data === 'string') {
        if (data.trim().length === 0) {
          logger.warn('Empty coverage string provided, returning empty coverage');
          return this.createEmptyCoverage();
        }

        // Try to parse as JSON first
        try {
          const parsed = JSON.parse(data) as RawCoverageData;
          coverageData = parsed;
        } catch (parseError) {
          // If not JSON, try to extract from Jest output
          logger.debug('Failed to parse as JSON, trying text extraction', { parseError });
          return this.parseJestTextOutput(data);
        }
      } else {
        coverageData = data as RawCoverageData;
      }

      // Validate that coverageData is an object
      if (!coverageData || typeof coverageData !== 'object') {
        logger.warn('Invalid coverage data format, returning empty coverage');
        return this.createEmptyCoverage();
      }

      // Check if it's Istanbul coverage format (used by Jest)
      if (this.isIstanbulFormat(coverageData)) {
        return this.parseIstanbulFormat(coverageData);
      }

      // Check if it's Jest JSON result format
      if (this.isJestFormat(coverageData)) {
        return this.parseJestJsonFormat(coverageData);
      }

      // Check if it's already in CoverageData format (for tests and direct usage)
      if (this.isCoverageDataFormat(coverageData)) {
        // Validate and return as CoverageData, ensuring thresholds are preserved
        const result: CoverageData = {
          summary: coverageData.summary,
          files: coverageData.files,
          uncoveredAreas: coverageData.uncoveredAreas,
          meetsThreshold: coverageData.meetsThreshold,
          ...(this.hasThresholds(coverageData) && { thresholds: coverageData.thresholds }),
          ...(this.thresholds && !coverageData.thresholds && { thresholds: this.thresholds }),
        };

        // Recalculate meetsThreshold if thresholds are available but meetsThreshold isn't set correctly
        if (result.thresholds && !result.meetsThreshold) {
          result.meetsThreshold = this.checkThresholds(result.summary);
        }

        return result;
      }

      logger.warn('Unrecognized Jest coverage format, returning empty coverage', {
        hasKeys: Object.keys(coverageData),
        dataType: typeof coverageData,
      });
      return this.createEmptyCoverage();
    } catch (error) {
      logger.error('Failed to parse Jest coverage', {
        error: error instanceof Error ? error.message : String(error),
        dataType: typeof data,
        dataLength: typeof data === 'string' ? data.length : 'N/A',
      });
      return this.createEmptyCoverage();
    }
  }

  private parseIstanbulFormat(coverageData: IstanbulCoverageData): CoverageData {
    const files: Record<string, FileCoverage> = {};
    let totalStatements = 0;
    let totalBranches = 0;
    let totalFunctions = 0;
    let totalLines = 0;
    let fileCount = 0;

    try {
      // Istanbul format has file paths as keys
      const coverageMap = coverageData.coverageMap ?? coverageData;

      if (!coverageMap || typeof coverageMap !== 'object') {
        logger.warn('Invalid coverage map format, returning empty coverage');
        return this.createEmptyCoverage();
      }

      for (const [filePath, fileData] of Object.entries(coverageMap)) {
        if (typeof fileData !== 'object' || !fileData) continue;

        try {
          const normalizedPath = this.normalizePath(filePath);
          const coverage = this.parseIstanbulFileData(fileData as IstanbulFileData);

          if (coverage) {
            files[normalizedPath] = coverage;
            totalStatements += coverage.summary.statements;
            totalBranches += coverage.summary.branches;
            totalFunctions += coverage.summary.functions;
            totalLines += coverage.summary.lines;
            fileCount++;
          }
        } catch (fileError) {
          logger.warn('Failed to parse coverage for file, skipping', {
            filePath,
            error: fileError instanceof Error ? fileError.message : String(fileError),
          });
          continue;
        }
      }
    } catch (error) {
      logger.error('Failed to parse Istanbul format coverage', { error });
      return this.createEmptyCoverage();
    }

    const summary = {
      statements: fileCount > 0 ? totalStatements / fileCount : 0,
      branches: fileCount > 0 ? totalBranches / fileCount : 0,
      functions: fileCount > 0 ? totalFunctions / fileCount : 0,
      lines: fileCount > 0 ? totalLines / fileCount : 0,
    };

    const uncoveredAreas = this.extractUncoveredAreas(files);
    const meetsThreshold = this.checkThresholds(summary);

    const result: CoverageData = {
      summary,
      files,
      uncoveredAreas,
      meetsThreshold,
    };

    if (this.thresholds) {
      result.thresholds = this.thresholds;
    }

    return result;
  }

  private parseIstanbulFileData(fileData: IstanbulFileData): FileCoverage | null {
    try {
      const statements = fileData.s || {};
      const branches = fileData.b || {};
      const functions = fileData.f || {};
      const statementMap = fileData.statementMap || {};
      const branchMap = fileData.branchMap || {};
      const fnMap = fileData.fnMap || {};

      // Calculate coverage percentages
      const statementsPct = this.calculatePercentage(statements);
      const branchesPct = this.calculateBranchPercentage(branches);
      const functionsPct = this.calculatePercentage(functions);
      const linesPct = statementsPct; // In Istanbul, lines ~= statements

      // Extract uncovered lines
      const uncoveredLines: number[] = [];
      for (const [stmtId, hitCount] of Object.entries(statements)) {
        if (hitCount === 0 && statementMap[stmtId]) {
          const startLine = statementMap[stmtId]?.start?.line;
          if (typeof startLine === 'number' && !uncoveredLines.includes(startLine)) {
            uncoveredLines.push(startLine);
          }
        }
      }

      // Extract uncovered branches
      const uncoveredBranches: UncoveredBranch[] = [];
      for (const [branchId, branchHits] of Object.entries(branches)) {
        if (Array.isArray(branchHits) && branchMap[branchId]) {
          const branchInfo = branchMap[branchId];
          for (let i = 0; i < branchHits.length; i++) {
            if (branchHits[i] === 0) {
              const branch: UncoveredBranch = {
                line: branchInfo?.loc?.start?.line ?? 0,
                type:
                  (branchInfo?.type as 'if' | 'switch' | 'ternary' | 'logical' | 'other') ??
                  'other',
              };
              if (branchInfo?.loc?.start?.column !== undefined) {
                branch.column = branchInfo.loc.start.column;
              }
              uncoveredBranches.push(branch);
            }
          }
        }
      }

      // Extract uncovered functions
      const uncoveredFunctions: string[] = [];
      for (const [fnId, hitCount] of Object.entries(functions)) {
        if (hitCount === 0 && fnMap[fnId]) {
          uncoveredFunctions.push(fnMap[fnId]?.name ?? `function_${fnId}`);
        }
      }

      return {
        path: fileData.path ?? '',
        summary: {
          statements: statementsPct,
          branches: branchesPct,
          functions: functionsPct,
          lines: linesPct,
        },
        uncoveredLines: uncoveredLines.sort((a, b) => a - b),
        uncoveredBranches,
        uncoveredFunctions,
      };
    } catch (error) {
      logger.warn('Failed to parse Istanbul file data', { error });
      return null;
    }
  }

  private parseJestJsonFormat(jestData: JestCoverageData): CoverageData {
    // Parse Jest's native JSON format if different from Istanbul
    return this.parseIstanbulFormat({ coverageMap: jestData.coverageMap });
  }

  private parseJestTextOutput(output: string): CoverageData {
    // Fallback text parsing for Jest coverage output
    const lines = output.split('\n');
    let overallMatch: RegExpMatchArray | null = null;

    // Look for coverage summary line
    for (const line of lines) {
      const match = line.match(
        /All files\s+\|\s+([\d.]+)\s+\|\s+([\d.]+)\s+\|\s+([\d.]+)\s+\|\s+([\d.]+)/
      );
      if (match) {
        overallMatch = match;
        break;
      }
    }

    if (overallMatch) {
      const summary = {
        statements: parseFloat(overallMatch[1] ?? '0'),
        branches: parseFloat(overallMatch[2] ?? '0'),
        functions: parseFloat(overallMatch[3] ?? '0'),
        lines: parseFloat(overallMatch[4] ?? '0'),
      };

      const result: CoverageData = {
        summary,
        files: {},
        uncoveredAreas: [],
        meetsThreshold: this.checkThresholds(summary),
      };

      if (this.thresholds) {
        result.thresholds = this.thresholds;
      }

      return result;
    }

    return this.createEmptyCoverage();
  }

  private calculatePercentage(coverage: Record<string, number>): number {
    const total = Object.keys(coverage).length;
    if (total === 0) return 100;

    const covered = Object.values(coverage).filter((hit) => hit > 0).length;
    return (covered / total) * 100;
  }

  private calculateBranchPercentage(branches: Record<string, number[]>): number {
    let totalBranches = 0;
    let coveredBranches = 0;

    for (const branchHits of Object.values(branches)) {
      if (Array.isArray(branchHits)) {
        totalBranches += branchHits.length;
        coveredBranches += branchHits.filter((hit) => hit > 0).length;
      }
    }

    return totalBranches === 0 ? 100 : (coveredBranches / totalBranches) * 100;
  }

  private createEmptyCoverage(): CoverageData {
    const result: CoverageData = {
      summary: { statements: 0, branches: 0, functions: 0, lines: 0 },
      files: {},
      uncoveredAreas: [],
      meetsThreshold: !this.thresholds,
    };

    if (this.thresholds) {
      result.thresholds = this.thresholds;
    }

    return result;
  }
}

/**
 * Pytest coverage parser (pytest-cov / coverage.py)
 */
export class PytestCoverageParser extends CoverageParser {
  supports(format: string): boolean {
    return format === 'pytest' || format === 'coverage.py';
  }

  parse(data: string | object): CoverageData {
    try {
      if (typeof data === 'object') {
        // JSON format from coverage.py
        return this.parseCoverageJson(
          data as { files?: Record<string, CoveragePyFileData>; totals?: Record<string, unknown> }
        );
      } else {
        // Text output from pytest-cov
        return this.parsePytestTextOutput(data);
      }
    } catch (error) {
      logger.error('Failed to parse Pytest coverage', { error });
      return this.createEmptyCoverage();
    }
  }

  private parseCoverageJson(coverageData: {
    files?: Record<string, CoveragePyFileData>;
    totals?: Record<string, unknown>;
  }): CoverageData {
    const files: Record<string, FileCoverage> = {};

    if (coverageData.files) {
      for (const [filePath, fileData] of Object.entries(coverageData.files)) {
        const normalizedPath = this.normalizePath(filePath || '');
        const coverage = this.parseCoverageFileData(fileData);
        if (coverage) {
          files[normalizedPath] = coverage;
        }
      }
    }

    // Extract summary from totals or calculate from files
    const totals = coverageData.totals;
    const summary = totals
      ? {
          statements: Number(totals.covered_percent) || 0,
          branches: Number(totals.branch_percent) || 0,
          functions: Number(totals.covered_percent) || 0, // Coverage.py doesn't separate functions
          lines: Number(totals.covered_percent) || 0,
        }
      : this.calculateOverallSummary(files);

    const uncoveredAreas = this.extractUncoveredAreas(files);
    const meetsThreshold = this.checkThresholds(summary);

    const result: CoverageData = {
      summary,
      files,
      uncoveredAreas,
      meetsThreshold,
    };

    if (this.thresholds) {
      result.thresholds = this.thresholds;
    }

    return result;
  }

  /**
   * Type guard for Coverage.py file data structure
   */
  private isCoveragePyFileData(data: unknown): data is CoveragePyFileData {
    return (
      typeof data === 'object' &&
      data !== null &&
      (typeof (data as Record<string, unknown>).executed_lines === 'undefined' ||
        Array.isArray((data as Record<string, unknown>).executed_lines)) &&
      (typeof (data as Record<string, unknown>).missing_lines === 'undefined' ||
        Array.isArray((data as Record<string, unknown>).missing_lines))
    );
  }

  private parseCoverageFileData(fileData: unknown): FileCoverage | null {
    // Type guard for Coverage.py file data
    if (!this.isCoveragePyFileData(fileData)) {
      return null;
    }
    try {
      const executedLines = fileData.executed_lines ?? [];
      const missingLines = fileData.missing_lines ?? [];
      // const excludedLines = fileData.excluded_lines || []; // Not currently used

      const totalLines = executedLines.length + missingLines.length;
      const coveredLines = executedLines.length;
      const lineCoverage = totalLines > 0 ? (coveredLines / totalLines) * 100 : 100;

      // Coverage.py doesn't provide detailed branch/function info in standard JSON
      const summary = {
        statements: lineCoverage,
        branches: lineCoverage, // Approximation
        functions: lineCoverage, // Approximation
        lines: lineCoverage,
      };

      return {
        path: fileData.filename ?? '',
        summary,
        uncoveredLines: missingLines.sort((a: number, b: number) => a - b),
      };
    } catch (error) {
      logger.warn('Failed to parse coverage.py file data', { error });
      return null;
    }
  }

  private parsePytestTextOutput(output: string): CoverageData {
    const lines = output.split('\n');
    const files: Record<string, FileCoverage> = {};
    let totalMatch: RegExpMatchArray | null = null;

    // Parse file-by-file coverage
    for (const line of lines) {
      // Match pattern: "src/module.py     100      0   100%"
      const fileMatch = line.match(/^([\w/.-]+\.py)\s+(\d+)\s+(\d+)\s+(\d+)%/);
      if (fileMatch) {
        const [, filePath, , , pct] = fileMatch;
        const percentage = parseInt(pct ?? '0');
        const uncoveredLines: number[] = [];

        // Look for missing lines in next lines (format: "5-7, 10")
        const normalizedPath = this.normalizePath(filePath ?? '');
        files[normalizedPath] = {
          path: normalizedPath,
          summary: {
            statements: percentage,
            branches: percentage,
            functions: percentage,
            lines: percentage,
          },
          uncoveredLines,
        };
      }

      // Match total line: "TOTAL      150      5    97%"
      const totalLineMatch = line.match(/^TOTAL\s+\d+\s+\d+\s+(\d+)%/);
      if (totalLineMatch) {
        totalMatch = totalLineMatch;
      }
    }

    const overallPercentage = totalMatch ? parseInt(totalMatch[1] ?? '0') : 0;
    const summary = {
      statements: overallPercentage,
      branches: overallPercentage,
      functions: overallPercentage,
      lines: overallPercentage,
    };

    const uncoveredAreas = this.extractUncoveredAreas(files);
    const meetsThreshold = this.checkThresholds(summary);

    const result: CoverageData = {
      summary,
      files,
      uncoveredAreas,
      meetsThreshold,
    };

    if (this.thresholds) {
      result.thresholds = this.thresholds;
    }

    return result;
  }

  private calculateOverallSummary(files: Record<string, FileCoverage>): CoverageData['summary'] {
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

  private createEmptyCoverage(): CoverageData {
    const result: CoverageData = {
      summary: { statements: 0, branches: 0, functions: 0, lines: 0 },
      files: {},
      uncoveredAreas: [],
      meetsThreshold: !this.thresholds,
    };

    if (this.thresholds) {
      result.thresholds = this.thresholds;
    }

    return result;
  }
}

/**
 * Factory for creating appropriate coverage parsers
 */
export class CoverageParserFactory {
  static createParser(
    framework: string,
    projectPath: string,
    thresholds?: CoverageThresholds
  ): CoverageParser {
    switch (framework.toLowerCase()) {
      case 'jest':
        return new JestCoverageParser(projectPath, thresholds);
      case 'pytest':
        return new PytestCoverageParser(projectPath, thresholds);
      default:
        throw new Error(`Unsupported coverage framework: ${framework}`);
    }
  }

  static getSupportedFrameworks(): string[] {
    return ['jest', 'pytest'];
  }
}
