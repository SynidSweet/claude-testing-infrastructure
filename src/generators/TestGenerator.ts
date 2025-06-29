import { logger } from '../utils/common-imports';
import { ProjectAnalysis } from '../analyzers/ProjectAnalyzer';

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
  HOOK = 'hook'
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

  constructor(config: TestGeneratorConfig, analysis: ProjectAnalysis) {
    this.config = config;
    this.analysis = analysis;
    this.validateConfig();
  }

  /**
   * Generate tests for the configured project
   */
  async generateAllTests(): Promise<TestGenerationResult> {
    const startTime = Date.now();
    logger.info(`Starting test generation for ${this.config.projectPath}`, {
      framework: this.config.testFramework,
      outputPath: this.config.outputPath
    });

    try {
      // Pre-generation setup
      await this.preGenerate();

      // Get files to test
      const filesToTest = await this.getFilesToTest();
      logger.info(`Found ${filesToTest.length} files to test`);

      // Generate tests for each file
      const results: GeneratedTest[] = [];
      const errors: string[] = [];
      const warnings: string[] = [];

      for (const filePath of filesToTest) {
        try {
          const testResult = await this.generateStructuralTestForFile(filePath);
          if (testResult) {
            results.push(testResult);
          }
        } catch (error) {
          const errorMsg = `Failed to generate test for ${filePath}: ${error instanceof Error ? error.message : String(error)}`;
          logger.error(errorMsg, { error });
          errors.push(errorMsg);
        }
      }

      // Post-generation processing
      await this.postGenerate(results);

      const endTime = Date.now();
      const generationTime = endTime - startTime;

      const stats: GenerationStats = {
        filesAnalyzed: filesToTest.length,
        testsGenerated: results.length,
        testLinesGenerated: results.reduce((total, test) => total + test.content.split('\n').length, 0),
        generationTime
      };

      logger.info('Test generation completed', stats);

      return {
        success: errors.length === 0,
        tests: results,
        errors,
        warnings,
        stats
      };

    } catch (error) {
      const errorMsg = `Test generation failed: ${error instanceof Error ? error.message : String(error)}`;
      logger.error(errorMsg, { error });
      
      return {
        success: false,
        tests: [],
        errors: [errorMsg],
        warnings: [],
        stats: {
          filesAnalyzed: 0,
          testsGenerated: 0,
          testLinesGenerated: 0,
          generationTime: Date.now() - startTime
        }
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
      mockFileSuffix: '.mock'
    };

    return {
      ...defaults,
      ...this.config.options.namingConventions
    };
  }

  /**
   * Generate a test file path for a source file
   */
  protected getTestFilePath(sourcePath: string, testType?: TestType): string {
    const ext = this.getTestFileExtension();
    
    // Get relative path from project root
    const relativePath = sourcePath.replace(this.config.projectPath, '').replace(/^\//, '');
    
    // Remove original extension and add test suffix
    const pathWithoutExt = relativePath.replace(/\.[^/.]+$/, '');
    const typePrefix = testType ? `.${testType}` : '';
    
    return `${this.config.outputPath}/${pathWithoutExt}${typePrefix}${ext}`;
  }

  /**
   * Get the appropriate file extension for test files
   */
  protected abstract getTestFileExtension(): string;
}