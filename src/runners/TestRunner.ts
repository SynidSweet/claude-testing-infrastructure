import { logger } from '../utils/common-imports';
import type { ProjectAnalysis } from '../analyzers/ProjectAnalyzer';

export interface TestRunnerConfig {
  /** Path to the project being tested */
  projectPath: string;
  /** Path to the test files */
  testPath: string;
  /** Test framework to use */
  framework: string;
  /** Coverage options */
  coverage?: CoverageConfig;
  /** Watch mode settings */
  watch?: boolean;
  /** Reporter options */
  reporter?: ReporterConfig;
  /** Environment variables */
  env?: Record<string, string>;
  /** Additional CLI options for the test runner */
  options?: string[];
}

export interface CoverageConfig {
  enabled: boolean;
  /** Coverage threshold percentages */
  thresholds?: {
    statements?: number;
    branches?: number;
    functions?: number;
    lines?: number;
  };
  /** Paths to include in coverage */
  include?: string[];
  /** Paths to exclude from coverage */
  exclude?: string[];
  /** Coverage output directory */
  outputDir?: string;
  /** Coverage reporters (json, html, text, etc.) */
  reporters?: string[];
}

export interface ReporterConfig {
  /** Console output format */
  console?: 'verbose' | 'normal' | 'quiet';
  /** Generate JUnit XML reports */
  junit?: boolean;
  /** Output directory for reports */
  outputDir?: string;
}

export interface TestResult {
  /** Overall success status */
  success: boolean;
  /** Exit code from test runner */
  exitCode: number;
  /** Number of test suites run */
  testSuites: number;
  /** Number of individual tests run */
  tests: number;
  /** Number of passing tests */
  passed: number;
  /** Number of failing tests */
  failed: number;
  /** Number of skipped tests */
  skipped: number;
  /** Test execution time in milliseconds */
  duration: number;
  /** Coverage information if enabled */
  coverage?: CoverageResult;
  /** Individual test failures */
  failures: TestFailure[];
  /** Raw output from test runner */
  output: string;
  /** Error output from test runner */
  errorOutput: string;
}

export interface CoverageResult {
  /** Statement coverage percentage */
  statements: number;
  /** Branch coverage percentage */
  branches: number;
  /** Function coverage percentage */
  functions: number;
  /** Line coverage percentage */
  lines: number;
  /** Whether coverage meets thresholds */
  meetsThreshold: boolean;
  /** Uncovered lines by file */
  uncoveredLines?: Record<string, number[]>;
}

export interface TestFailure {
  /** Test suite name */
  suite: string;
  /** Test name */
  test: string;
  /** Failure message */
  message: string;
  /** Stack trace */
  stack?: string;
  /** Expected vs actual values */
  diff?: {
    expected: string;
    actual: string;
  };
}

/**
 * Abstract base class for test runners
 *
 * This class provides the common interface and utilities for running tests
 * with different testing frameworks. Concrete implementations should extend
 * this class and implement the abstract methods.
 */
export abstract class TestRunner {
  protected config: TestRunnerConfig;
  protected analysis: ProjectAnalysis;

  constructor(config: TestRunnerConfig, analysis: ProjectAnalysis) {
    this.config = config;
    this.analysis = analysis;
    this.validateConfig();
  }

  /**
   * Run tests with the configured test runner
   */
  async run(): Promise<TestResult> {
    const startTime = Date.now();
    logger.info(`Running tests with ${this.config.framework}`, {
      testPath: this.config.testPath,
      coverage: this.config.coverage?.enabled || false,
      watch: this.config.watch || false,
    });

    try {
      // Pre-run setup
      await this.preRun();

      // Check if tests exist
      const hasTests = await this.hasTests();
      if (!hasTests) {
        logger.warn('No tests found to execute');
        return this.createEmptyResult(0);
      }

      // Execute tests
      const result = await this.executeTests();

      // Post-run processing
      await this.postRun(result);

      const endTime = Date.now();
      result.duration = endTime - startTime;

      logger.info('Test execution completed', {
        success: result.success,
        tests: result.tests,
        passed: result.passed,
        failed: result.failed,
        duration: result.duration,
      });

      return result;
    } catch (error) {
      const errorMsg = `Test execution failed: ${error instanceof Error ? error.message : String(error)}`;
      logger.error(errorMsg, { error });

      return {
        success: false,
        exitCode: 1,
        testSuites: 0,
        tests: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        duration: Date.now() - startTime,
        failures: [
          {
            suite: 'Runner Error',
            test: 'Execution',
            message: errorMsg,
          },
        ],
        output: '',
        errorOutput: errorMsg,
      };
    }
  }

  /**
   * Get the test framework name
   */
  getFramework(): string {
    return this.config.framework;
  }

  /**
   * Get runner configuration
   */
  getConfig(): TestRunnerConfig {
    return this.config;
  }

  /**
   * Get project analysis
   */
  getAnalysis(): ProjectAnalysis {
    return this.analysis;
  }

  /**
   * Check if the runner supports the given framework
   */
  abstract supports(framework: string): boolean;

  /**
   * Validate the runner configuration
   */
  protected validateConfig(): void {
    if (!this.config.projectPath) {
      throw new Error('Project path is required');
    }
    if (!this.config.testPath) {
      throw new Error('Test path is required');
    }
    if (!this.config.framework) {
      throw new Error('Test framework is required');
    }
  }

  /**
   * Check if there are tests to run
   */
  protected abstract hasTests(): Promise<boolean>;

  /**
   * Execute the tests using the specific test runner
   */
  protected abstract executeTests(): Promise<TestResult>;

  /**
   * Pre-run hook for setup tasks
   */
  protected async preRun(): Promise<void> {
    // Default implementation does nothing
    // Subclasses can override for custom setup
  }

  /**
   * Post-run hook for cleanup and processing
   */
  protected async postRun(_result: TestResult): Promise<void> {
    // Default implementation does nothing
    // Subclasses can override for custom post-processing
  }

  /**
   * Create an empty test result for when no tests are found
   */
  protected createEmptyResult(exitCode: number): TestResult {
    return {
      success: exitCode === 0,
      exitCode,
      testSuites: 0,
      tests: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      duration: 0,
      failures: [],
      output: 'No tests found',
      errorOutput: '',
    };
  }

  /**
   * Parse test runner output into structured results
   */
  protected abstract parseOutput(
    stdout: string,
    stderr: string,
    exitCode: number
  ): TestResult | Promise<TestResult>;

  /**
   * Get the command and arguments for running tests
   */
  protected abstract getRunCommand(): { command: string; args: string[] };

  /**
   * Get environment variables for test execution
   */
  protected getEnvironment(): Record<string, string> {
    return {
      ...process.env,
      NODE_ENV: 'test',
      ...this.config.env,
    };
  }

  /**
   * Get working directory for test execution
   */
  protected getWorkingDirectory(): string {
    return this.config.testPath;
  }
}
