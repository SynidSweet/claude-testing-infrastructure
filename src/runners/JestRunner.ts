import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import {
  TestRunner,
  type TestRunnerConfig,
  type TestResult,
  type TestFailure,
  type CoverageResult,
} from './TestRunner';
import type { ProjectAnalysis } from '../analyzers/ProjectAnalyzer';
import { logger } from '../utils/logger';
import { CoverageReporterFactory, type CoverageReporter } from './CoverageReporter';
import { FileDiscoveryType, type FileDiscoveryService } from '../types/file-discovery-types';
import type { CoverageThresholds } from './CoverageParser';

/**
 * Jest coverage data structure
 */
interface JestCoverageData {
  [filePath: string]: {
    path?: string;
    s: Record<string, number>;
    b: Record<string, number[]>;
    f: Record<string, number>;
    statementMap: Record<
      string,
      { start: { line: number; column: number }; end: { line: number; column: number } }
    >;
    branchMap: Record<
      string,
      { loc?: { start?: { line: number; column: number } }; type?: string }
    >;
    fnMap: Record<string, { name?: string; decl?: { start: { line: number } } }>;
  };
}

/**
 * Jest JSON result structure
 */
interface JestJsonResult {
  numTotalTests?: number;
  numTotalTestSuites?: number;
  numPassedTests?: number;
  numFailedTests?: number;
  numPendingTests?: number;
  startTime?: number;
  endTime?: number;
  coverageMap?: JestCoverageData;
  testResults?: Array<{
    message?: string;
    name?: string;
    assertionResults?: Array<{
      status?: string;
      title?: string;
      failureMessages?: string[];
    }>;
  }>;
}

/**
 * Jest configuration object structure
 */
interface JestConfig {
  testEnvironment?: string;
  testMatch?: string[];
  passWithNoTests?: boolean;
  rootDir?: string;
  setupFilesAfterEnv?: string[];
  preset?: string;
  extensionsToTreatAsEsm?: string[];
  moduleNameMapper?: Record<string, string>;
  transform?: Record<string, string>;
  transformIgnorePatterns?: string[];
  testPathIgnorePatterns?: string[];
  collectCoverage?: boolean;
  coverageDirectory?: string;
  coverageReporters?: string[];
  coverageThreshold?: {
    global?: {
      statements?: number;
      branches?: number;
      functions?: number;
      lines?: number;
    };
  };
}

/**
 * Jest coverage map structure
 */
interface JestCoverageMap {
  global?: {
    statements?: { pct?: number };
    branches?: { pct?: number };
    functions?: { pct?: number };
    lines?: { pct?: number };
  };
}

/**
 * Coverage report data structure
 */
interface CoverageReportData {
  files?: Record<
    string,
    {
      uncoveredLines?: number[];
    }
  >;
}

/**
 * Type guard to check if unknown data is a JestCoverageMap
 */
function isJestCoverageMap(data: unknown): data is JestCoverageMap {
  return typeof data === 'object' && data !== null;
}

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
      const reporterConfig: {
        outputDir?: string;
        failOnThreshold: boolean;
        thresholds?: CoverageThresholds;
      } = {
        ...(config.coverage.outputDir ? { outputDir: config.coverage.outputDir } : {}),
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

    return new Promise((resolve, reject) => {
      let stdout = '';
      let stderr = '';

      const child = spawn(command, args, {
        cwd: this.getWorkingDirectory(),
        env: this.getEnvironment(),
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      child.stdout?.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        const exitCode = code ?? 0;
        void this.parseOutput(stdout, stderr, exitCode).then(resolve).catch(reject);
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

    // Write Jest config to a temporary file
    // Use ES modules format if the project is using ES modules
    const moduleSystem = this.analysis.moduleSystem;
    const isESM = moduleSystem.type === 'esm';

    const configPath = path.join(
      this.config.testPath,
      isESM ? 'jest.config.mjs' : 'jest.config.js'
    );
    const configContent = isESM
      ? `export default ${JSON.stringify(jestConfig, null, 2)};`
      : `module.exports = ${JSON.stringify(jestConfig, null, 2)};`;
    fs.writeFileSync(configPath, configContent);

    // For React ES modules projects, ensure babel config is accessible
    if (moduleSystem.type === 'esm' && this.analysis.frameworks?.some((f) => f.name === 'react')) {
      this.ensureBabelConfig();
    }

    args.push('--config', configPath);
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

  protected override getWorkingDirectory(): string {
    // Always run Jest from the project root to ensure babel.config.js is found
    return this.config.projectPath;
  }

  protected override getEnvironment(): Record<string, string> {
    const baseEnv = super.getEnvironment();

    // Add Node.js experimental options for ES modules
    if (this.analysis.moduleSystem.type === 'esm') {
      return {
        ...baseEnv,
        NODE_OPTIONS: '--experimental-vm-modules',
      };
    }

    return baseEnv;
  }

  /**
   * Type guard for Jest JSON result
   */
  private isJestJsonResult(data: unknown): data is JestJsonResult {
    return typeof data === 'object' && data !== null && 'numTotalTests' in data;
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
          const parsed = JSON.parse(line) as JestJsonResult;
          if (this.isJestJsonResult(parsed)) {
            jsonOutput = line;
            break;
          }
        } catch {
          continue;
        }
      }

      if (jsonOutput) {
        const jestResult = JSON.parse(jsonOutput) as JestJsonResult;
        return await this.parseJestJson(jestResult, stdout, stderr, exitCode);
      }
    } catch (error) {
      logger.warn('Failed to parse Jest JSON output, falling back to text parsing', { error });
    }

    // Fallback to text parsing
    return this.parseTextOutput(stdout, stderr, exitCode);
  }

  private async parseJestJson(
    jestResult: JestJsonResult,
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
          for (const assertionResult of testResult.assertionResults ?? []) {
            if (assertionResult.status === 'failed') {
              const failureData: TestFailure = {
                suite: testResult.name ?? 'Unknown Suite',
                test: assertionResult.title ?? 'Unknown Test',
                message: assertionResult.failureMessages?.join('\n') ?? 'Test failed',
              };

              const stack = assertionResult.failureMessages?.join('\n');
              if (stack) {
                failureData.stack = stack;
              }

              failures.push(failureData);
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
          uncoveredLines: this.extractUncoveredLinesFromReport(
            coverageReport.data as CoverageReportData
          ),
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
        if (jestResult.coverageMap && isJestCoverageMap(jestResult.coverageMap)) {
          coverage = this.parseCoverage(jestResult.coverageMap);
        }
      }
    } else if (jestResult.coverageMap && isJestCoverageMap(jestResult.coverageMap)) {
      // Fallback to legacy coverage parsing
      coverage = this.parseCoverage(jestResult.coverageMap);
    }

    const result: TestResult = {
      success: exitCode === 0,
      exitCode,
      testSuites: jestResult.numTotalTestSuites ?? 0,
      tests: jestResult.numTotalTests ?? 0,
      passed: jestResult.numPassedTests ?? 0,
      failed: jestResult.numFailedTests ?? 0,
      skipped: jestResult.numPendingTests ?? 0,
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
        passed = parseInt(testMatch[1] ?? '0');
        failed = parseInt(testMatch[2] ?? '0');
        skipped = parseInt(testMatch[3] ?? '0');
        tests = parseInt(testMatch[4] ?? '0');
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

  private parseCoverage(coverageMap: JestCoverageMap): CoverageResult {
    // Jest coverage format parsing
    let statements = 0;
    let branches = 0;
    let functions = 0;
    let lines = 0;

    if (coverageMap.global) {
      statements = coverageMap.global.statements?.pct ?? 0;
      branches = coverageMap.global.branches?.pct ?? 0;
      functions = coverageMap.global.functions?.pct ?? 0;
      lines = coverageMap.global.lines?.pct ?? 0;
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

  private generateJestConfig(): JestConfig {
    const moduleSystem = this.analysis.moduleSystem;

    // Using current directory as root for Jest execution

    // Base configuration
    const config: JestConfig = {
      testEnvironment: 'node',
      testMatch: ['**/*.test.{js,ts,jsx,tsx}'],
      passWithNoTests: true,
      rootDir: '.',
      // Only include setupFiles if they exist in the target project
      ...(this.hasSetupFile() && {
        setupFilesAfterEnv: ['<rootDir>/setupTests.js'],
      }),
      testPathIgnorePatterns: [
        '<rootDir>/node_modules/',
        // Ignore nested .claude-testing directories to prevent recursive test execution
        '<rootDir>/\\.claude-testing/.*\\.claude-testing/',
      ],
    };

    // Configure for ES modules
    if (moduleSystem.type === 'esm') {
      // Check if project is TypeScript-based
      const isTypeScript = moduleSystem.fileExtensionPattern === 'ts';

      if (isTypeScript) {
        // TypeScript ES modules configuration
        config.preset = 'ts-jest/presets/default-esm';
        config.extensionsToTreatAsEsm = ['.ts', '.tsx'];
        config.moduleNameMapper = {
          '^(\\.{1,2}/.*)\\.js$': '$1',
        };
        config.transform = {
          '^.+\\.tsx?$': 'ts-jest',
        };
      } else {
        // JavaScript ES modules configuration
        // Only include .jsx in extensionsToTreatAsEsm if project has "type": "module"
        // as .js files are automatically treated as ES modules in that case
        const hasPackageJsonTypeModule =
          moduleSystem.hasPackageJsonType && moduleSystem.packageJsonType === 'module';
        config.extensionsToTreatAsEsm = hasPackageJsonTypeModule ? ['.jsx'] : ['.js', '.jsx'];
        config.moduleNameMapper = {
          '^(\\.{1,2}/.*)\\.jsx?$': '$1',
        };

        // Check if this is a React project by looking for React in frameworks or JSX files
        const allSourceFiles = this.analysis.languages.flatMap((lang) => lang.files);
        const hasReact =
          this.analysis.frameworks?.some((f) => f.name === 'react') ||
          allSourceFiles.some((f: string) => f.endsWith('.jsx') || f.endsWith('.tsx'));

        if (hasReact) {
          // React ES modules configuration - requires jsdom for DOM testing
          config.testEnvironment = 'jsdom'; // Required for React component testing
          config.transform = {
            '^.+\\.(js|jsx)$': 'babel-jest',
          };
          config.transformIgnorePatterns = ['node_modules/(?!(.*\\.mjs$))'];
          // Add CSS module mapper for React projects
          config.moduleNameMapper = {
            ...config.moduleNameMapper,
            '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
          };
          // Mock React.createElement for JSX support in ES modules
          config.setupFilesAfterEnv = config.setupFilesAfterEnv ?? [];
          config.setupFilesAfterEnv.push('<rootDir>/setupTests.js');
        } else {
          config.transform = {};
          config.testEnvironment = 'node';
        }
      }
    } else {
      // CommonJS configuration
      config.transform = {};

      // Check if this is a React project for CommonJS too
      const allSourceFiles = this.analysis.languages.flatMap((lang) => lang.files);
      const hasReact =
        this.analysis.frameworks?.some((f) => f.name === 'react') ||
        allSourceFiles.some((f: string) => f.endsWith('.jsx') || f.endsWith('.tsx'));
      if (hasReact) {
        config.testEnvironment = 'jsdom'; // Required for React component testing
        config.setupFilesAfterEnv = config.setupFilesAfterEnv ?? [];
        config.setupFilesAfterEnv.push('<rootDir>/setupTests.js');
      }
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

  private hasSetupFile(): boolean {
    try {
      const setupPath = path.join(this.config.projectPath, 'setupTests.js');
      return fs.existsSync(setupPath);
    } catch {
      return false;
    }
  }

  private extractUncoveredLinesFromReport(
    coverageData: CoverageReportData
  ): Record<string, number[]> {
    const uncoveredLines: Record<string, number[]> = {};

    if (coverageData?.files) {
      for (const [filePath, fileData] of Object.entries(coverageData.files)) {
        if (fileData?.uncoveredLines && Array.isArray(fileData.uncoveredLines)) {
          uncoveredLines[filePath] = fileData.uncoveredLines;
        }
      }
    }

    return uncoveredLines;
  }

  private ensureBabelConfig(): void {
    // Check if babel.config.js exists in project root
    const projectBabelConfig = path.join(this.config.projectPath, 'babel.config.js');
    const testBabelConfig = path.join(this.config.testPath, 'babel.config.js');

    if (fs.existsSync(projectBabelConfig) && !fs.existsSync(testBabelConfig)) {
      // Copy babel config to test directory so Jest can find it
      try {
        fs.copyFileSync(projectBabelConfig, testBabelConfig);
        logger.debug('Copied babel.config.js to test directory for Jest');
      } catch (error) {
        logger.warn('Failed to copy babel.config.js to test directory', { error });
      }
    }
  }
}
