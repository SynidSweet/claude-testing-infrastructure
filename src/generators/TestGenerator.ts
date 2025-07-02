import { logger, path } from '../utils/common-imports';
import type { ProjectAnalysis } from '../analyzers/ProjectAnalyzer';
import { ProgressReporter } from '../utils/ProgressReporter';

export interface TestGeneratorConfig {
  /** Target project path */
  projectPath: string;
  /** Output directory for generated tests */
  outputPath: string;
  /** Test framework to use (jest, vitest, pytest, etc.) */
  testFramework: string;
  /** Language/framework specific options */
  options: TestGeneratorOptions;
  /** Template overrides */
  templates?: Record<string, string>;
  /** Include/exclude patterns */
  patterns?: {
    include: string[];
    exclude: string[];
  };
}

export interface TestGeneratorOptions {
  /** Generate mocks for dependencies */
  generateMocks?: boolean;
  /** Include setup/teardown code */
  includeSetupTeardown?: boolean;
  /** Generate test data factories */
  generateTestData?: boolean;
  /** Add coverage requirements */
  addCoverage?: boolean;
  /** Override specific test types */
  testTypes?: TestType[];
  /** Custom naming conventions */
  namingConventions?: NamingConventions;
}

export interface NamingConventions {
  /** Test file suffix (default: .test) */
  testFileSuffix?: string;
  /** Test directory name (default: __tests__) */
  testDirectory?: string;
  /** Mock file suffix (default: .mock) */
  mockFileSuffix?: string;
}

export enum TestType {
  UNIT = 'unit',
  INTEGRATION = 'integration',
  COMPONENT = 'component',
  API = 'api',
  UTILITY = 'utility',
  SERVICE = 'service',
  HOOK = 'hook',
}

export interface GeneratedTest {
  /** Path to the source file being tested */
  sourcePath: string;
  /** Path to the generated test file */
  testPath: string;
  /** Type of test generated */
  testType: TestType;
  /** Test framework used */
  framework: string;
  /** Generated test content */
  content: string;
  /** Any additional files (mocks, fixtures, etc.) */
  additionalFiles?: GeneratedFile[];
}

export interface GeneratedFile {
  path: string;
  content: string;
  type: 'mock' | 'fixture' | 'setup' | 'config';
}

export interface TestGenerationResult {
  /** Whether generation was successful */
  success: boolean;
  /** Generated test files */
  tests: GeneratedTest[];
  /** Any errors encountered */
  errors: string[];
  /** Warnings about generation */
  warnings: string[];
  /** Statistics about generation */
  stats: GenerationStats;
}

export interface GenerationStats {
  /** Total files analyzed */
  filesAnalyzed: number;
  /** Tests generated */
  testsGenerated: number;
  /** Lines of test code generated */
  testLinesGenerated: number;
  /** Time taken for generation */
  generationTime: number;
}

/**
 * Abstract base class for all test generators
 *
 * This class provides the common interface and utilities for generating tests
 * across different languages and frameworks. Concrete implementations should
 * extend this class and implement the abstract methods.
 */
export abstract class TestGenerator {
  protected config: TestGeneratorConfig;
  protected analysis: ProjectAnalysis;
  protected progressReporter?: ProgressReporter;

  constructor(config: TestGeneratorConfig, analysis: ProjectAnalysis) {
    this.config = config;
    this.analysis = analysis;
    this.validateConfig();
  }

  /**
   * Set a progress reporter for tracking generation progress
   */
  setProgressReporter(reporter: ProgressReporter): void {
    this.progressReporter = reporter;
  }

  /**
   * Generate tests for the configured project
   */
  async generateAllTests(): Promise<TestGenerationResult> {
    const startTime = Date.now();
    logger.info(`Starting test generation for ${this.config.projectPath}`, {
      framework: this.config.testFramework,
      outputPath: this.config.outputPath,
    });

    try {
      // Pre-generation setup
      await this.preGenerate();

      // Get files to test
      const filesToTest = await this.getFilesToTest();
      logger.info(`Found ${filesToTest.length} files to test`);

      // Validate test-to-source ratio before generation
      await this.validateTestGenerationRatio(filesToTest);

      // Start progress reporting if reporter is available
      if (this.progressReporter) {
        this.progressReporter.start(filesToTest.length, 'Generating structural tests...');
      }

      // Generate tests for each file
      const results: GeneratedTest[] = [];
      const errors: string[] = [];
      const warnings: string[] = [];

      for (let i = 0; i < filesToTest.length; i++) {
        const filePath = filesToTest[i];
        
        if (!filePath) {
          logger.warn(`Skipping undefined file path at index ${i}`);
          continue;
        }
        
        try {
          // Update progress
          if (this.progressReporter) {
            this.progressReporter.updateProgress(i + 1, filePath);
          }
          
          const testResult = await this.generateStructuralTestForFile(filePath);
          if (testResult) {
            results.push(testResult);
          }
        } catch (error) {
          const errorMsg = `Failed to generate test for ${filePath}: ${error instanceof Error ? error.message : String(error)}`;
          logger.error(errorMsg, { error });
          errors.push(errorMsg);
          
          // Report error to progress reporter
          if (this.progressReporter) {
            this.progressReporter.reportError(error instanceof Error ? error : errorMsg, filePath);
          }
        }
      }

      // Post-generation processing
      await this.postGenerate(results);

      const endTime = Date.now();
      const generationTime = endTime - startTime;

      const stats: GenerationStats = {
        filesAnalyzed: filesToTest.length,
        testsGenerated: results.length,
        testLinesGenerated: results.reduce(
          (total, test) => total + test.content.split('\n').length,
          0
        ),
        generationTime,
      };

      logger.info('Test generation completed', stats);

      // Complete progress reporting
      if (this.progressReporter) {
        this.progressReporter.complete(errors.length === 0, 
          errors.length === 0 ? 'Structural tests generated successfully' : 'Test generation completed with errors');
      }

      return {
        success: errors.length === 0,
        tests: results,
        errors,
        warnings,
        stats,
      };
    } catch (error) {
      const errorMsg = `Test generation failed: ${error instanceof Error ? error.message : String(error)}`;
      logger.error(errorMsg, { error });

      // Report failure to progress reporter
      if (this.progressReporter) {
        this.progressReporter.complete(false, errorMsg);
      }

      return {
        success: false,
        tests: [],
        errors: [errorMsg],
        warnings: [],
        stats: {
          filesAnalyzed: 0,
          testsGenerated: 0,
          testLinesGenerated: 0,
          generationTime: Date.now() - startTime,
        },
      };
    }
  }

  /**
   * Validate the generator configuration
   */
  protected validateConfig(): void {
    if (!this.config.projectPath) {
      throw new Error('Project path is required');
    }
    if (!this.config.outputPath) {
      throw new Error('Output path is required');
    }
    if (!this.config.testFramework) {
      throw new Error('Test framework is required');
    }
  }

  /**
   * Validate test-to-source file ratio before generation
   */
  protected async validateTestGenerationRatio(filesToTest: string[]): Promise<void> {
    const config = this.config as any;
    const skipValidation = config.skipValidation || (this as any).options?.skipValidation;

    if (skipValidation) {
      logger.debug('Skipping test generation validation due to --force flag');
      return;
    }

    // Count total source files in the project for ratio calculation
    const sourceFileCount = await this.countSourceFiles();
    const testFileCount = filesToTest.length;

    if (sourceFileCount === 0) {
      logger.warn('No source files found in project for ratio validation');
      return;
    }

    const ratio = testFileCount / sourceFileCount;
    
    // Use configured threshold or CLI override, with fallback to default
    const maxRatio = config.maxRatio || 
                     config.generation?.maxTestToSourceRatio || 
                     (this as any).options?.maxRatio || 
                     10; // Default fallback

    logger.debug(
      `Test generation ratio check: ${testFileCount} tests for ${sourceFileCount} source files (ratio: ${ratio.toFixed(2)}x, max: ${maxRatio}x)`
    );

    if (ratio > maxRatio) {
      const message = [
        `⚠️  WARNING: Test generation would create ${testFileCount} test files for ${sourceFileCount} source files`,
        `   This is a ${ratio.toFixed(1)}x ratio, which exceeds the configured ${maxRatio}x maximum.`,
        `   This may create an unmaintainable test suite.`,
        ``,
        `   File breakdown:`,
        `   • Source files detected: ${sourceFileCount}`,
        `   • Test files to generate: ${testFileCount}`,
        `   • Current ratio: ${ratio.toFixed(2)}x (max: ${maxRatio}x)`,
        ``,
        `   Options:`,
        `   • Review your include/exclude patterns in .claude-testing.config.json`,
        `   • Adjust maxTestToSourceRatio in your configuration`,
        `   • Use --force to bypass this check`,
        `   • Use --max-ratio <number> to override the threshold`,
        `   • Consider using --only-logical for targeted test generation`,
        ``,
        `   To proceed anyway, add the --force flag to your command.`,
      ].join('\n');

      console.log(`\n${message}\n`);
      throw new Error('Test generation ratio exceeds configured maximum threshold');
    }

    // Warn at 75% of the threshold
    const warningThreshold = Math.max(3, Math.floor(maxRatio * 0.75));
    if (ratio > warningThreshold) {
      const warning = [
        `⚠️  High test-to-source ratio detected:`,
        `   Generating ${testFileCount} tests for ${sourceFileCount} source files (${ratio.toFixed(1)}x ratio).`,
        `   This approaches the ${maxRatio}x limit. Consider reviewing your patterns.`
      ].join('\n');
      console.log(`\n${warning}\n`);
      logger.warn(warning);
    }
  }

  /**
   * Count source files in the project for ratio validation
   */
  private async countSourceFiles(): Promise<number> {
    const { fg, path } = await import('../utils/common-imports');

    const patterns = ['**/*.{js,ts,jsx,tsx,py,java,cs,go,rb,php}'].map((pattern) =>
      path.join(this.config.projectPath, pattern)
    );

    const excludePatterns = [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/__pycache__/**',
      '**/coverage/**',
      '**/tests/**',
      '**/__tests__/**',
      '**/*.test.*',
      '**/*.spec.*',
      '**/vendor/**',
      '**/target/**',
      '**/.git/**',
    ];

    try {
      const sourceFiles = await fg(patterns, {
        ignore: excludePatterns,
        absolute: true,
        onlyFiles: true,
      });

      return sourceFiles.length;
    } catch (error) {
      logger.warn('Failed to count source files for validation', { error });
      return 0;
    }
  }

  /**
   * Get list of files that should have tests generated
   */
  protected abstract getFilesToTest(): Promise<string[]>;

  /**
   * Generate a test for a specific file
   */
  protected abstract generateStructuralTestForFile(filePath: string): Promise<GeneratedTest | null>;

  /**
   * Pre-generation hook for setup tasks
   */
  protected async preGenerate(): Promise<void> {
    // Default implementation does nothing
    // Subclasses can override for custom setup
  }

  /**
   * Post-generation hook for cleanup and finalization
   */
  protected async postGenerate(_results: GeneratedTest[]): Promise<void> {
    // Default implementation does nothing
    // Subclasses can override for custom post-processing
  }

  /**
   * Get the test framework being used
   */
  getFramework(): string {
    return this.config.testFramework;
  }

  /**
   * Get the project analysis
   */
  getAnalysis(): ProjectAnalysis {
    return this.analysis;
  }

  /**
   * Get generator configuration
   */
  getConfig(): TestGeneratorConfig {
    return this.config;
  }

  /**
   * Check if a specific test type should be generated
   */
  protected shouldGenerateTestType(testType: TestType): boolean {
    const configuredTypes = this.config.options.testTypes;
    if (!configuredTypes || configuredTypes.length === 0) {
      return true; // Generate all types by default
    }
    return configuredTypes.includes(testType);
  }

  /**
   * Get the naming conventions for tests
   */
  protected getNamingConventions(): Required<NamingConventions> {
    const defaults: Required<NamingConventions> = {
      testFileSuffix: '.test',
      testDirectory: '__tests__',
      mockFileSuffix: '.mock',
    };

    return {
      ...defaults,
      ...this.config.options.namingConventions,
    };
  }

  /**
   * Generate a test file path for a source file
   */
  protected getTestFilePath(sourcePath: string, testType?: TestType, language?: string): string {
    const ext = this.getTestFileExtension(language);

    // Get relative path from project root using proper path operations
    const relativePath = path.relative(this.config.projectPath, sourcePath);

    // Remove original extension and add test suffix
    const pathWithoutExt = relativePath.replace(/\.[^/.]+$/, '');
    const typePrefix = testType ? `.${testType}` : '';

    return path.join(this.config.outputPath, `${pathWithoutExt}${typePrefix}${ext}`);
  }

  /**
   * Get the appropriate file extension for test files
   */
  protected abstract getTestFileExtension(language?: string): string;
}
