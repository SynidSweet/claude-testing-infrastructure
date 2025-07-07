import { spawn } from 'child_process';
import path from 'path';
import type { TestRunnerConfig, TestResult, TestFailure, CoverageResult } from './TestRunner';
import { TestRunner } from './TestRunner';
import type { ProjectAnalysis } from '../analyzers/ProjectAnalyzer';
import { logger } from '../utils/logger';
import type { CoverageReporter, CoverageReporterConfig } from './CoverageReporter';
import { CoverageReporterFactory } from './CoverageReporter';
import type { FileDiscoveryService } from '../types/file-discovery-types';
import { FileDiscoveryType } from '../types/file-discovery-types';

/**
 * Pytest test runner implementation
 */
export class PytestRunner extends TestRunner {
  private coverageReporter?: CoverageReporter;

  constructor(
    config: TestRunnerConfig,
    analysis: ProjectAnalysis,
    private fileDiscovery: FileDiscoveryService
  ) {
    super(config, analysis);

    // Initialize coverage reporter if coverage is enabled
    if (config.coverage?.enabled) {
      const reporterConfig: Partial<CoverageReporterConfig> = {
        projectPath: config.projectPath,
        framework: 'pytest',
        failOnThreshold: false, // Don't fail here, let the runner handle it
      };

      if (config.coverage.thresholds) {
        reporterConfig.thresholds = config.coverage.thresholds;
      }

      this.coverageReporter = CoverageReporterFactory.createPytestReporter(
        config.projectPath,
        reporterConfig
      );
    }
  }

  supports(framework: string): boolean {
    return framework === 'pytest';
  }

  protected async hasTests(): Promise<boolean> {
    try {
      const result = await this.fileDiscovery.findFiles({
        baseDir: this.config.testPath,
        type: FileDiscoveryType.TEST_EXECUTION,
        languages: ['python'],
        useCache: true,
      });

      return result.files.length > 0;
    } catch {
      return false;
    }
  }

  protected async executeTests(): Promise<TestResult> {
    const { command, args } = this.getRunCommand();

    return new Promise((resolve) => {
      let stdout = '';
      let stderr = '';

      const child = spawn(command, args, {
        cwd: this.getWorkingDirectory(),
        env: this.getEnvironment(),
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', async (code) => {
        const exitCode = code || 0;
        const result = await this.parseOutput(stdout, stderr, exitCode);
        resolve(result);
      });

      child.on('error', (error) => {
        logger.error('Pytest process error', { error });
        resolve({
          success: false,
          exitCode: 1,
          testSuites: 0,
          tests: 0,
          passed: 0,
          failed: 0,
          skipped: 0,
          duration: 0,
          failures: [
            {
              suite: 'Process Error',
              test: 'Pytest Execution',
              message: error.message,
            },
          ],
          output: stdout,
          errorOutput: stderr,
        });
      });
    });
  }

  protected getRunCommand(): { command: string; args: string[] } {
    const args: string[] = [];

    // Base configuration
    args.push(this.config.testPath);
    args.push('-v'); // Verbose output
    args.push('--tb=short'); // Short traceback format

    // JSON report for parsing
    args.push('--json-report');
    args.push('--json-report-file=/tmp/pytest-report.json');

    // Coverage options
    if (this.config.coverage?.enabled) {
      args.push('--cov=' + this.config.projectPath);
      args.push('--cov-report=term-missing');

      if (this.config.coverage.outputDir) {
        args.push('--cov-report=html:' + this.config.coverage.outputDir);
      }

      if (this.config.coverage.thresholds) {
        const thresholds = this.config.coverage.thresholds;
        if (thresholds.lines) {
          args.push('--cov-fail-under=' + thresholds.lines);
        }
      }

      // Coverage exclusions
      if (this.config.coverage.exclude) {
        this.config.coverage.exclude.forEach((pattern) => {
          args.push('--cov-config=' + pattern);
        });
      }
    }

    // JUnit XML output
    if (this.config.reporter?.junit) {
      const junitPath = this.config.reporter.outputDir
        ? path.join(this.config.reporter.outputDir, 'junit.xml')
        : 'junit.xml';
      args.push('--junit-xml=' + junitPath);
    }

    // Additional options
    if (this.config.options) {
      args.push(...this.config.options);
    }

    return { command: 'python', args: ['-m', 'pytest', ...args] };
  }

  protected async parseOutput(
    stdout: string,
    stderr: string,
    exitCode: number
  ): Promise<TestResult> {
    // Try enhanced coverage processing first
    if (this.coverageReporter && this.config.coverage?.enabled) {
      try {
        const coverageReport = await this.coverageReporter.processSingleCoverageSource(stdout);
        const result = this.parseTextOutput(stdout, stderr, exitCode);

        // Enhance result with advanced coverage data
        result.coverage = {
          statements: coverageReport.data.summary.statements,
          branches: coverageReport.data.summary.branches,
          functions: coverageReport.data.summary.functions,
          lines: coverageReport.data.summary.lines,
          meetsThreshold: coverageReport.meetsThreshold,
          uncoveredLines: this.extractUncoveredLinesFromReport(coverageReport.data as unknown as Record<string, unknown>),
        };

        logger.info('Pytest coverage processing completed', {
          summary: coverageReport.data.summary,
          meetsThreshold: coverageReport.meetsThreshold,
          reportFiles: coverageReport.reportFiles.length,
        });

        return result;
      } catch (error) {
        logger.warn('Failed to process coverage with new system, falling back to legacy', {
          error,
        });
      }
    }

    // Fallback to text parsing
    return this.parseTextOutput(stdout, stderr, exitCode);
  }

  private parseTextOutput(stdout: string, stderr: string, exitCode: number): TestResult {
    const lines = stdout.split('\n');
    let tests = 0;
    let passed = 0;
    let failed = 0;
    let skipped = 0;
    let testSuites = 0;
    const failures: TestFailure[] = [];

    // Parse pytest output patterns
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;

      // Match summary line: "= 5 passed, 1 failed, 2 skipped in 0.12s ="
      const summaryMatch = line.match(
        /=+\s*(?:(\d+)\s+passed[,\s]*)?(?:(\d+)\s+failed[,\s]*)?(?:(\d+)\s+skipped[,\s]*)?.*?in\s+[\d.]+s\s*=+/
      );
      if (summaryMatch) {
        passed = parseInt(summaryMatch[1] || '0');
        failed = parseInt(summaryMatch[2] || '0');
        skipped = parseInt(summaryMatch[3] || '0');
        tests = passed + failed + skipped;
      }

      // Parse test failures
      if (line.includes('FAILED ')) {
        const failureMatch = line.match(/FAILED\s+(.+?)::(.*?)\s+-\s*(.*)/);
        if (failureMatch) {
          failures.push({
            suite: failureMatch[1] || 'Unknown Suite',
            test: failureMatch[2] || 'Unknown Test',
            message: failureMatch[3] || 'Test failed',
          });
        }
      }

      // Count test files (approximate test suites)
      if (line.includes('.py::')) {
        testSuites++;
      }
    }

    // Parse coverage if present
    let coverage: CoverageResult | undefined;
    const coverageMatch = stdout.match(/TOTAL\s+\d+\s+\d+\s+(\d+)%/);
    if (coverageMatch?.[1]) {
      const coveragePercent = parseInt(coverageMatch[1]);
      coverage = {
        statements: coveragePercent,
        branches: coveragePercent,
        functions: coveragePercent,
        lines: coveragePercent,
        meetsThreshold:
          !this.config.coverage?.thresholds?.lines ||
          coveragePercent >= this.config.coverage.thresholds.lines,
      };
    }

    const result: TestResult = {
      success: exitCode === 0,
      exitCode,
      testSuites,
      tests,
      passed,
      failed,
      skipped,
      duration: 0,
      failures,
      output: stdout,
      errorOutput: stderr,
    };

    if (coverage) {
      result.coverage = coverage;
    }

    return result;
  }

  protected getEnvironment(): Record<string, string> {
    return {
      ...super.getEnvironment(),
      PYTHONPATH: this.config.projectPath,
      // Add common Python test environment variables
      PYTEST_CURRENT_TEST: '1',
    };
  }

  private extractUncoveredLinesFromReport(coverageData: Record<string, unknown>): Record<string, number[]> {
    const uncoveredLines: Record<string, number[]> = {};

    if (coverageData && typeof coverageData === 'object' && 'files' in coverageData) {
      const files = coverageData.files as Record<string, unknown>;
      for (const [filePath, fileData] of Object.entries(files)) {
        if (fileData && typeof fileData === 'object' && 'uncoveredLines' in fileData) {
          const lines = (fileData as Record<string, unknown>).uncoveredLines;
          if (Array.isArray(lines) && lines.length > 0) {
            uncoveredLines[filePath] = lines as number[];
          }
        }
      }
    }

    return uncoveredLines;
  }
}
