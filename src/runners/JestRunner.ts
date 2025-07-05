import { spawn } from 'child_process';
import type { TestRunnerConfig, TestResult, TestFailure, CoverageResult } from './TestRunner';
import { TestRunner } from './TestRunner';
import type { ProjectAnalysis } from '../analyzers/ProjectAnalyzer';
import { logger } from '../utils/logger';
import type { CoverageReporter } from './CoverageReporter';
import { CoverageReporterFactory } from './CoverageReporter';
import type { FileDiscoveryService } from '../types/file-discovery-types';
import { FileDiscoveryType } from '../types/file-discovery-types';

/**
 * Jest test runner implementation
 */
export class JestRunner extends TestRunner {
  private coverageReporter?: CoverageReporter;

  constructor(
    config: TestRunnerConfig,
    analysis: ProjectAnalysis,
    private fileDiscovery: FileDiscoveryService
  ) {
    super(config, analysis);

    // Initialize coverage reporter if coverage is enabled
    if (config.coverage?.enabled) {
      const reporterConfig: any = {
        outputDir: config.coverage.outputDir,
        failOnThreshold: false, // Don't fail here, let the runner handle it
      };

      if (config.coverage.thresholds) {
        reporterConfig.thresholds = config.coverage.thresholds;
      }

      this.coverageReporter = CoverageReporterFactory.createJestReporter(
        config.projectPath,
        reporterConfig
      );
    }
  }

  supports(framework: string): boolean {
    return framework === 'jest';
  }

  protected async hasTests(): Promise<boolean> {
    try {
      const result = await this.fileDiscovery.findFiles({
        baseDir: this.config.testPath,
        type: FileDiscoveryType.TEST_EXECUTION,
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
        logger.error('Jest process error', { error });
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
              test: 'Jest Execution',
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
    const args: string[] = ['jest']; // Add jest as first arg for npx

    // Generate Jest configuration based on module system
    const jestConfig = this.generateJestConfig();
    args.push('--config', JSON.stringify(jestConfig));
    args.push('--passWithNoTests');
    args.push('--json'); // Get JSON output for parsing

    // Coverage options
    if (this.config.coverage?.enabled) {
      args.push('--coverage');

      if (this.config.coverage.outputDir) {
        args.push('--coverageDirectory');
        args.push(this.config.coverage.outputDir);
      }

      if (this.config.coverage.reporters) {
        this.config.coverage.reporters.forEach((reporter) => {
          args.push('--coverageReporters');
          args.push(reporter);
        });
      }

      if (this.config.coverage.thresholds) {
        const thresholds = this.config.coverage.thresholds;
        if (thresholds.statements) {
          args.push('--coverageThreshold');
          args.push(`{"global":{"statements":${thresholds.statements}}}`);
        }
        if (thresholds.branches) {
          args.push('--coverageThreshold');
          args.push(`{"global":{"branches":${thresholds.branches}}}`);
        }
        if (thresholds.functions) {
          args.push('--coverageThreshold');
          args.push(`{"global":{"functions":${thresholds.functions}}}`);
        }
        if (thresholds.lines) {
          args.push('--coverageThreshold');
          args.push(`{"global":{"lines":${thresholds.lines}}}`);
        }
      }
    }

    // Watch mode
    if (this.config.watch) {
      args.push('--watch');
    }

    // Reporter options
    if (this.config.reporter?.junit) {
      args.push('--reporters');
      args.push('default');
      args.push('--reporters');
      args.push('jest-junit');
    }

    // Additional options
    if (this.config.options) {
      args.push(...this.config.options);
    }

    // Try to find Jest executable
    const jestCommand = this.findJestExecutable();

    return { command: jestCommand, args };
  }

  protected async parseOutput(
    stdout: string,
    stderr: string,
    exitCode: number
  ): Promise<TestResult> {
    try {
      // Jest outputs JSON when --json flag is used
      const lines = stdout.split('\n').filter((line) => line.trim());
      let jsonOutput = '';

      // Find the JSON output (usually the last valid JSON line)
      for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i];
        if (!line) continue;

        try {
          const parsed = JSON.parse(line);
          if (parsed.numTotalTests !== undefined) {
            jsonOutput = line;
            break;
          }
        } catch {
          continue;
        }
      }

      if (jsonOutput) {
        const jestResult = JSON.parse(jsonOutput);
        return await this.parseJestJson(jestResult, stdout, stderr, exitCode);
      }
    } catch (error) {
      logger.warn('Failed to parse Jest JSON output, falling back to text parsing', { error });
    }

    // Fallback to text parsing
    return this.parseTextOutput(stdout, stderr, exitCode);
  }

  private async parseJestJson(
    jestResult: any,
    stdout: string,
    stderr: string,
    exitCode: number
  ): Promise<TestResult> {
    const failures: TestFailure[] = [];

    // Extract test failures
    if (jestResult.testResults) {
      for (const testResult of jestResult.testResults) {
        if (testResult.message) {
          // Parse individual test failures
          for (const assertionResult of testResult.assertionResults || []) {
            if (assertionResult.status === 'failed') {
              failures.push({
                suite: testResult.name || 'Unknown Suite',
                test: assertionResult.title || 'Unknown Test',
                message: assertionResult.failureMessages?.join('\n') || 'Test failed',
                stack: assertionResult.failureMessages?.join('\n') || undefined,
              });
            }
          }
        }
      }
    }

    // Process coverage with the new coverage system
    let coverage: CoverageResult | undefined;
    if (jestResult.coverageMap && this.coverageReporter) {
      try {
        const coverageReport = await this.coverageReporter.processSingleCoverageSource(jestResult);

        // Convert to legacy format for compatibility
        coverage = {
          statements: coverageReport.data.summary.statements,
          branches: coverageReport.data.summary.branches,
          functions: coverageReport.data.summary.functions,
          lines: coverageReport.data.summary.lines,
          meetsThreshold: coverageReport.meetsThreshold,
          uncoveredLines: this.extractUncoveredLinesFromReport(coverageReport.data),
        };

        // Log coverage summary
        logger.info('Coverage processing completed', {
          summary: coverageReport.data.summary,
          meetsThreshold: coverageReport.meetsThreshold,
          reportFiles: coverageReport.reportFiles.length,
        });
      } catch (error) {
        logger.warn('Failed to process coverage with new system, falling back to legacy', {
          error,
        });
        coverage = this.parseCoverage(jestResult.coverageMap);
      }
    } else if (jestResult.coverageMap) {
      // Fallback to legacy coverage parsing
      coverage = this.parseCoverage(jestResult.coverageMap);
    }

    const result: TestResult = {
      success: exitCode === 0,
      exitCode,
      testSuites: jestResult.numTotalTestSuites || 0,
      tests: jestResult.numTotalTests || 0,
      passed: jestResult.numPassedTests || 0,
      failed: jestResult.numFailedTests || 0,
      skipped: jestResult.numPendingTests || 0,
      duration:
        jestResult.startTime && jestResult.endTime ? jestResult.endTime - jestResult.startTime : 0,
      failures,
      output: stdout,
      errorOutput: stderr,
    };

    if (coverage) {
      result.coverage = coverage;
    }

    return result;
  }

  private parseTextOutput(stdout: string, stderr: string, exitCode: number): TestResult {
    // Fallback text parsing for when JSON output is not available
    const lines = stdout.split('\n');
    let tests = 0;
    let passed = 0;
    let failed = 0;
    let skipped = 0;
    let testSuites = 0;

    // Look for Jest summary line patterns
    for (const line of lines) {
      // Match patterns like "Tests: 5 passed, 1 failed, 6 total"
      const testMatch = line.match(
        /Tests:\s*(?:(\d+)\s+passed(?:,\s*)?)?(?:(\d+)\s+failed(?:,\s*)?)?(?:(\d+)\s+skipped(?:,\s*)?)?(?:(\d+)\s+total)?/
      );
      if (testMatch) {
        passed = parseInt(testMatch[1] || '0');
        failed = parseInt(testMatch[2] || '0');
        skipped = parseInt(testMatch[3] || '0');
        tests = parseInt(testMatch[4] || '0');
      }

      // Match test suites pattern
      const suiteMatch = line.match(/Test Suites:\s*(?:\d+\s+\w+(?:,\s*)?)*(\d+)\s+total/);
      if (suiteMatch?.[1]) {
        testSuites = parseInt(suiteMatch[1]);
      }
    }

    return {
      success: exitCode === 0,
      exitCode,
      testSuites,
      tests,
      passed,
      failed,
      skipped,
      duration: 0,
      failures: [],
      output: stdout,
      errorOutput: stderr,
    };
  }

  private parseCoverage(coverageMap: any): CoverageResult {
    // Jest coverage format parsing
    let statements = 0;
    let branches = 0;
    let functions = 0;
    let lines = 0;

    if (coverageMap.global) {
      statements = coverageMap.global.statements?.pct || 0;
      branches = coverageMap.global.branches?.pct || 0;
      functions = coverageMap.global.functions?.pct || 0;
      lines = coverageMap.global.lines?.pct || 0;
    }

    // Check if coverage meets thresholds
    const thresholds = this.config.coverage?.thresholds;
    const meetsThreshold =
      !thresholds ||
      ((thresholds.statements ? statements >= thresholds.statements : true) &&
        (thresholds.branches ? branches >= thresholds.branches : true) &&
        (thresholds.functions ? functions >= thresholds.functions : true) &&
        (thresholds.lines ? lines >= thresholds.lines : true));

    return {
      statements,
      branches,
      functions,
      lines,
      meetsThreshold,
    };
  }

  private generateJestConfig(): any {
    const moduleSystem = this.analysis.moduleSystem;

    // Base configuration
    const config: any = {
      testEnvironment: 'node',
      testMatch: ['**/*.test.{js,ts,jsx,tsx}'],
      passWithNoTests: true,
      setupFilesAfterEnv: ['<rootDir>/setupTests.js'],
    };

    // Configure for ES modules
    if (moduleSystem.type === 'esm') {
      config.preset = 'ts-jest/presets/default-esm';
      config.extensionsToTreatAsEsm = ['.ts'];
      config.moduleNameMapper = {
        '^(\\.{1,2}/.*)\\.js$': '$1',
      };
      config.transform = {
        '^.+\\.tsx?$': ['ts-jest', { useESM: true }],
      };
    } else {
      // CommonJS configuration
      config.transform = {};
    }

    // Add coverage configuration if enabled
    if (this.config.coverage?.enabled) {
      config.collectCoverage = true;

      if (this.config.coverage.outputDir) {
        config.coverageDirectory = this.config.coverage.outputDir;
      }

      if (this.config.coverage.reporters) {
        config.coverageReporters = this.config.coverage.reporters;
      }

      if (this.config.coverage.thresholds) {
        config.coverageThreshold = {
          global: this.config.coverage.thresholds,
        };
      }
    }

    return config;
  }

  private findJestExecutable(): string {
    // For now, default to npx jest which should work in most cases
    return 'npx';
  }

  private extractUncoveredLinesFromReport(coverageData: any): Record<string, number[]> {
    const uncoveredLines: Record<string, number[]> = {};

    if (coverageData && typeof coverageData === 'object' && 'files' in coverageData) {
      for (const [filePath, fileData] of Object.entries(coverageData.files)) {
        if (fileData && typeof fileData === 'object' && 'uncoveredLines' in fileData) {
          const lines = (fileData as any).uncoveredLines;
          if (Array.isArray(lines) && lines.length > 0) {
            uncoveredLines[filePath] = lines;
          }
        }
      }
    }

    return uncoveredLines;
  }
}
