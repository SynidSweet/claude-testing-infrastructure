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
import {
  createBabelConfigAdapter,
  type BabelConfigAdaptationOptions,
} from '../services/BabelConfigAdapter';

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
  transform?: Record<string, string | [string, object]>;
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
    // Setup babel configuration before getting run command
    await this.setupBabelConfigurationIfNeeded();

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

  /**
   * Setup babel configuration if needed for React ES modules projects
   */
  private async setupBabelConfigurationIfNeeded(): Promise<void> {
    const moduleSystem = this.analysis.moduleSystem;

    // For React ES modules projects, ensure babel config is accessible
    if (moduleSystem.type === 'esm' && this.analysis.frameworks?.some((f) => f.name === 'react')) {
      await this.ensureBabelConfig();
    }
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

    // Debug: Log the configuration to see what's being generated
    logger.debug(`Jest config for ${this.config.projectPath}:`, {
      rootDir: jestConfig.rootDir,
      projectPath: this.config.projectPath,
      testPath: this.config.testPath,
    });

    fs.writeFileSync(configPath, configContent);

    // Babel configuration is now handled in setupBabelConfigurationIfNeeded() before this method

    args.push('--config', configPath);
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
      rootDir: path.resolve(this.config.projectPath),
      // Only include setupFiles if they exist in the target project
      ...(this.hasSetupFile() && {
        setupFilesAfterEnv: [
          `<rootDir>/.claude-testing/setupTests.${moduleSystem.type === 'esm' ? 'mjs' : 'js'}`,
        ],
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
            '^.+\\.(js|jsx)$': [
              'babel-jest',
              { configFile: path.resolve(this.config.testPath, 'babel.config.mjs') },
            ],
          };
          config.transformIgnorePatterns = ['node_modules/(?!(.*\\.mjs$))'];
          // Add CSS module mapper for React projects
          config.moduleNameMapper = {
            ...config.moduleNameMapper,
            '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
          };
          // Ensure React setup file exists
          this.ensureReactSetupFile();

          // Add setup file to configuration if not already set
          if (!config.setupFilesAfterEnv) {
            config.setupFilesAfterEnv = [];
          }
          const setupExtension = moduleSystem.type === 'esm' ? 'mjs' : 'js';
          const relativeSetupFile = `<rootDir>/.claude-testing/setupTests.${setupExtension}`;
          if (!config.setupFilesAfterEnv.includes(relativeSetupFile)) {
            config.setupFilesAfterEnv.push(relativeSetupFile);
          }
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

        // Ensure React setup file exists
        this.ensureReactSetupFile();

        // Add setup file to configuration if not already set
        if (!config.setupFilesAfterEnv) {
          config.setupFilesAfterEnv = [];
        }
        const setupExtension = 'js'; // CommonJS projects always use .js extension
        const relativeSetupFile = `<rootDir>/.claude-testing/setupTests.${setupExtension}`;
        if (!config.setupFilesAfterEnv.includes(relativeSetupFile)) {
          config.setupFilesAfterEnv.push(relativeSetupFile);
        }
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
      // Check if setup file exists in either project root or test directory
      const projectSetupPathJs = path.join(this.config.projectPath, 'setupTests.js');
      const projectSetupPathMjs = path.join(this.config.projectPath, 'setupTests.mjs');
      const testSetupPathJs = path.join(this.config.testPath, 'setupTests.js');
      const testSetupPathMjs = path.join(this.config.testPath, 'setupTests.mjs');
      return (
        fs.existsSync(projectSetupPathJs) ||
        fs.existsSync(projectSetupPathMjs) ||
        fs.existsSync(testSetupPathJs) ||
        fs.existsSync(testSetupPathMjs)
      );
    } catch {
      return false;
    }
  }

  private ensureReactSetupFile(): void {
    // Setup file is now generated by StructuralTestGenerator with enhanced React support
    // This method is kept for backward compatibility but no longer creates files
    logger.debug('React setup file generation handled by StructuralTestGenerator');
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

  private async ensureBabelConfig(): Promise<void> {
    const isEsm = this.analysis.moduleSystem.type === 'esm';

    // For ES modules, we need to create a babel config that works with ES modules
    if (isEsm) {
      await this.createEsmBabelConfig();
    } else {
      // For CommonJS, copy existing babel config if available
      this.copyBabelConfigForCommonJS();
    }
  }

  private async createEsmBabelConfig(): Promise<void> {
    const testDir = this.config.testPath;
    const projectDir = this.config.projectPath;

    // Check for existing babel configuration files in test directory
    const existingTestConfigs = this.findExistingBabelConfigs(testDir);
    const existingProjectConfigs = this.findExistingBabelConfigs(projectDir);

    // If we already have an ESM-compatible config in test directory, use it
    const testEsmConfig = path.join(testDir, 'babel.config.mjs');
    if (existingTestConfigs.includes(testEsmConfig)) {
      logger.debug('Using existing babel.config.mjs in test directory');
      return;
    }

    // Handle conflicts: if other babel configs exist in test directory, warn about potential conflicts
    if (existingTestConfigs.length > 0) {
      logger.warn('Existing babel configuration files detected in test directory', {
        existingConfigs: existingTestConfigs,
        willCreate: testEsmConfig,
      });

      // Check if there's a conflicting .js config
      const testJsConfig = path.join(testDir, 'babel.config.js');
      if (existingTestConfigs.includes(testJsConfig)) {
        logger.warn(
          'babel.config.js already exists - this may conflict with babel.config.mjs for ES modules'
        );
      }
    }

    // Try to copy/adapt existing project babel config if available
    if (existingProjectConfigs.length > 0) {
      const adaptedConfig = await this.tryAdaptProjectBabelConfig(existingProjectConfigs);
      if (adaptedConfig) {
        try {
          fs.writeFileSync(testEsmConfig, adaptedConfig);
          logger.debug('Created adapted babel.config.mjs from project configuration');
          return;
        } catch (error) {
          logger.warn('Failed to write adapted babel configuration', { error });
        }
      }
    }

    // Create default ESM babel configuration
    const defaultBabelConfig = `export default {
  presets: [
    ['@babel/preset-env', {
      targets: {
        node: 'current'
      },
      modules: 'auto'
    }],
    ['@babel/preset-react', {
      runtime: 'automatic'
    }]
  ],
  plugins: []
};
`;

    try {
      fs.writeFileSync(testEsmConfig, defaultBabelConfig);
      logger.debug('Created default ES modules compatible babel.config.mjs for Jest');
    } catch (error) {
      logger.warn('Failed to create babel.config.mjs for ES modules', { error });
    }
  }

  private copyBabelConfigForCommonJS(): void {
    const projectDir = this.config.projectPath;
    const testDir = this.config.testPath;

    // Find existing babel configs in project
    const existingProjectConfigs = this.findExistingBabelConfigs(projectDir);
    const existingTestConfigs = this.findExistingBabelConfigs(testDir);

    // If test directory already has babel config, don't overwrite
    if (existingTestConfigs.length > 0) {
      logger.debug('Test directory already has babel configuration', {
        existingConfigs: existingTestConfigs,
      });
      return;
    }

    // Try to copy the most appropriate config
    const preferredConfigOrder = [
      'babel.config.js',
      'babel.config.json',
      '.babelrc.js',
      '.babelrc.json',
      '.babelrc',
    ];

    for (const configFile of preferredConfigOrder) {
      const sourcePath = path.join(projectDir, configFile);
      if (existingProjectConfigs.includes(sourcePath)) {
        const targetPath = path.join(testDir, 'babel.config.js');

        try {
          fs.copyFileSync(sourcePath, targetPath);
          logger.debug(`Copied ${configFile} to test directory as babel.config.js`);
          return;
        } catch (error) {
          logger.warn(`Failed to copy ${configFile} to test directory`, { error });
        }
      }
    }

    logger.debug('No babel configuration found in project directory');
  }

  private findExistingBabelConfigs(directory: string): string[] {
    const possibleConfigs = [
      'babel.config.js',
      'babel.config.mjs',
      'babel.config.json',
      '.babelrc',
      '.babelrc.js',
      '.babelrc.json',
      '.babelrc.mjs',
    ];

    const existingConfigs: string[] = [];

    for (const configFile of possibleConfigs) {
      const configPath = path.join(directory, configFile);
      if (fs.existsSync(configPath)) {
        existingConfigs.push(configPath);
      }
    }

    return existingConfigs;
  }

  private async tryAdaptProjectBabelConfig(existingConfigs: string[]): Promise<string | null> {
    const babelAdapter = createBabelConfigAdapter();
    const isEsm = this.analysis.moduleSystem.type === 'esm';

    // Enhanced babel configuration adaptation options
    const adaptationOptions: Partial<BabelConfigAdaptationOptions> = {
      targetModuleSystem: isEsm ? 'esm' : 'commonjs',
      validateSyntax: true,
      preserveComments: true,
      fallbackToBasicTransform: true, // Enable fallback for complex configs
    };

    try {
      // Use the enhanced adapter to handle multiple configs
      const result = await babelAdapter.adaptBestAvailableConfig(
        existingConfigs,
        adaptationOptions
      );

      if (result?.success && result.adaptedConfig) {
        // Log successful adaptation with details
        logger.debug('Successfully adapted babel configuration with enhanced adapter', {
          configType: result.configType,
          targetModuleSystem: adaptationOptions.targetModuleSystem,
          warnings: result.warnings.length,
          validationErrors: result.validationErrors.length,
        });

        // Log warnings if any
        if (result.warnings.length > 0) {
          logger.warn('Babel configuration adaptation warnings', {
            warnings: result.warnings,
          });
        }

        return result.adaptedConfig;
      } else if (result) {
        // Log adaptation failures
        logger.warn('Enhanced babel configuration adaptation failed', {
          errors: result.validationErrors,
          warnings: result.warnings,
        });

        // Fallback to legacy method if enhanced adapter fails completely
        logger.debug('Attempting fallback to legacy babel adaptation method');
        return this.tryAdaptProjectBabelConfigLegacy(existingConfigs);
      }

      return null;
    } catch (error) {
      logger.warn(
        'Enhanced babel configuration adapter threw error, falling back to legacy method',
        {
          error,
          configPaths: existingConfigs,
        }
      );

      // Fallback to legacy method
      return this.tryAdaptProjectBabelConfigLegacy(existingConfigs);
    }
  }

  /**
   * Legacy babel configuration adaptation method (fallback)
   * Kept for compatibility and as a fallback when enhanced adaptation fails
   */
  private tryAdaptProjectBabelConfigLegacy(existingConfigs: string[]): string | null {
    const isEsm = this.analysis.moduleSystem.type === 'esm';

    // Try to read and adapt the first available config
    for (const configPath of existingConfigs) {
      try {
        const content = fs.readFileSync(configPath, 'utf8');
        const fileName = path.basename(configPath);

        // Handle different config file types
        if (fileName.endsWith('.json') || fileName === '.babelrc') {
          // Parse JSON config and convert to target module system
          const config = JSON.parse(content) as object;

          if (isEsm) {
            return `export default ${JSON.stringify(config, null, 2)};`;
          } else {
            return `module.exports = ${JSON.stringify(config, null, 2)};`;
          }
        } else if (fileName.endsWith('.js') || fileName.endsWith('.mjs')) {
          // Basic transformation for JavaScript configs
          if (isEsm) {
            const adaptedContent = content
              .replace(/module\.exports\s*=/, 'export default')
              .replace(/require\(/g, 'import(')
              .replace(/const\s+(\w+)\s*=\s*require\(['"]([^'"]+)['"]\)/g, "import $1 from '$2'");
            return adaptedContent;
          } else {
            // For CommonJS, minimal transformation needed
            return content
              .replace(/export\s+default\s+/, 'module.exports = ')
              .replace(/import\s+(\w+)\s+from\s+['"]([^'"]+)['"]/g, "const $1 = require('$2')");
          }
        }
      } catch (error) {
        logger.warn(`Failed to read/adapt babel config with legacy method: ${configPath}`, {
          error,
        });
        continue;
      }
    }

    return null;
  }
}
