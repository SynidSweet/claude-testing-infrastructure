import { logger, path } from '../../utils/common-imports';
import type { ProjectAnalysis } from '../../analyzers/ProjectAnalyzer';
import { ProgressReporter } from '../../utils/ProgressReporter';
import type {
  TestGeneratorConfig,
  GeneratedTest,
  TestGenerationResult,
  GenerationStats,
} from '../TestGenerator';

/**
 * Language-specific context for test generation
 *
 * This interface provides all the language-specific information
 * needed by a test generator to create appropriate tests.
 */
export interface LanguageContext {
  /** Language identifier (javascript, typescript, python, etc.) */
  language: string;
  /** Detected framework (react, vue, express, fastapi, django, etc.) */
  framework?: string;
  /** Module system for JavaScript/TypeScript projects */
  moduleSystem?: 'commonjs' | 'esm' | 'mixed';
  /** Test framework to use (jest, vitest, pytest, etc.) */
  testFramework: string;
  /** Language-specific features and patterns */
  features: LanguageFeatures;
  /** File extension for test files (.test.ts, .spec.js, _test.py, etc.) */
  testFileExtension: string;
  /** Import/export style for the language */
  importStyle: ImportStyle;
}

/**
 * Language-specific features that affect test generation
 */
export interface LanguageFeatures {
  /** Whether the language supports async/await */
  supportsAsync: boolean;
  /** Whether the language has decorators/annotations */
  hasDecorators: boolean;
  /** Whether the language uses type annotations */
  hasTypeAnnotations: boolean;
  /** Common testing patterns for the language */
  testingPatterns: TestingPattern[];
  /** Common assertion styles */
  assertionStyle: 'expect' | 'assert' | 'should';
}

/**
 * Import/export style configuration
 */
export interface ImportStyle {
  /** How to import modules */
  importSyntax: 'require' | 'import' | 'from-import';
  /** How to export modules */
  exportSyntax: 'module.exports' | 'export' | 'export-default';
  /** Whether to use file extensions in imports */
  useFileExtensions: boolean;
  /** File extension to use for imports */
  importExtension?: string;
}

/**
 * Common testing patterns for a language
 */
export interface TestingPattern {
  /** Pattern name (unit, integration, component, etc.) */
  name: string;
  /** Whether this pattern is applicable to the current context */
  applicable: boolean;
  /** Template key for this pattern */
  templateKey: string;
}

/**
 * Abstract base class for language-specific test generators
 *
 * This class provides the foundation for creating test generators
 * that understand language-specific patterns, frameworks, and idioms.
 * Concrete implementations should extend this class and implement
 * the abstract methods for their specific language.
 */
export abstract class BaseTestGenerator {
  protected config: TestGeneratorConfig;
  protected analysis: ProjectAnalysis;
  protected progressReporter?: ProgressReporter;
  protected languageContext: LanguageContext;

  constructor(
    config: TestGeneratorConfig,
    analysis: ProjectAnalysis,
    languageContext: LanguageContext
  ) {
    this.config = config;
    this.analysis = analysis;
    this.languageContext = languageContext;
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
    logger.info(
      `Starting ${this.languageContext.language} test generation for ${this.config.projectPath}`,
      {
        language: this.languageContext.language,
        framework: this.languageContext.framework,
        testFramework: this.languageContext.testFramework,
        outputPath: this.config.outputPath,
      }
    );

    try {
      // Pre-generation setup
      await this.preGenerate();

      // Get files to test
      const filesToTest = await this.getFilesToTest();
      logger.info(`Found ${filesToTest.length} ${this.languageContext.language} files to test`);

      // Validate test-to-source ratio before generation
      await this.validateTestGenerationRatio(filesToTest);

      // Start progress reporting if reporter is available
      if (this.progressReporter) {
        this.progressReporter.start(
          filesToTest.length,
          `Generating ${this.languageContext.language} tests...`
        );
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

          const testResult = await this.generateTestForFile(filePath);
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
        this.progressReporter.complete(
          errors.length === 0,
          errors.length === 0
            ? `${this.languageContext.language} tests generated successfully`
            : 'Test generation completed with errors'
        );
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
    if (!this.languageContext) {
      throw new Error('Language context is required');
    }
  }

  /**
   * Get list of files that should have tests generated
   * Language-specific implementations should filter by appropriate extensions
   */
  protected abstract getFilesToTest(): Promise<string[]>;

  /**
   * Generate a test for a specific file
   * This is the main method that language-specific generators implement
   */
  protected abstract generateTestForFile(filePath: string): Promise<GeneratedTest | null>;

  /**
   * Analyze a source file to understand its structure
   * This should be implemented by language-specific generators using appropriate parsers
   */
  protected abstract analyzeSourceFile(filePath: string): Promise<SourceFileAnalysis>;

  /**
   * Select appropriate test template based on file analysis
   */
  protected abstract selectTestTemplate(analysis: SourceFileAnalysis): string;

  /**
   * Generate test content from template and analysis
   */
  protected abstract generateTestContent(
    template: string,
    analysis: SourceFileAnalysis
  ): Promise<string>;

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
   * Validate test-to-source file ratio before generation
   */
  protected async validateTestGenerationRatio(filesToTest: string[]): Promise<void> {
    const config = this.config as any;
    const skipValidation = config.skipValidation || config.options?.skipValidation;

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

    // Use configured threshold or fallback to default
    const maxRatio =
      config.maxRatio || config.generation?.maxTestToSourceRatio || config.options?.maxRatio || 10; // Default fallback

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
        ``,
        `   To proceed anyway, add the --force flag to your command.`,
      ].join('\n');

      console.log(`\n${message}\n`);
      throw new Error('Test generation ratio exceeds configured maximum threshold');
    }
  }

  /**
   * Count source files in the project for ratio validation
   */
  private async countSourceFiles(): Promise<number> {
    const { fg } = await import('../../utils/common-imports');

    // Get language-specific extensions
    const extensions = this.getSourceFileExtensions();
    const patterns = extensions.map((ext) => path.join(this.config.projectPath, `**/*${ext}`));

    const excludePatterns = this.getExcludePatterns();

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
   * Get source file extensions for this language
   */
  protected abstract getSourceFileExtensions(): string[];

  /**
   * Get patterns to exclude from file discovery
   */
  protected getExcludePatterns(): string[] {
    return [
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
  }

  /**
   * Generate a test file path for a source file
   */
  protected getTestFilePath(sourcePath: string): string {
    // Get relative path from project root
    const relativePath = path.relative(this.config.projectPath, sourcePath);

    // Remove original extension and add test suffix
    const pathWithoutExt = relativePath.replace(/\.[^/.]+$/, '');
    const testPath = `${pathWithoutExt}${this.languageContext.testFileExtension}`;

    return path.join(this.config.outputPath, testPath);
  }

  /**
   * Get the language context
   */
  getLanguageContext(): LanguageContext {
    return this.languageContext;
  }

  /**
   * Get the test framework being used
   */
  getFramework(): string {
    return this.languageContext.testFramework;
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
}

/**
 * Source file analysis result
 * Language-specific generators should extend this interface
 */
export interface SourceFileAnalysis {
  /** File path being analyzed */
  filePath: string;
  /** Detected language */
  language: string;
  /** Detected framework if any */
  framework?: string;
  /** File type (component, service, util, etc.) */
  fileType: string;
  /** Exported items from the file */
  exports: ExportedItem[];
  /** Import statements in the file */
  imports: ImportStatement[];
  /** Whether the file uses async patterns */
  hasAsync: boolean;
  /** Custom metadata from language-specific analysis */
  metadata?: Record<string, any>;
}

/**
 * Exported item from a source file
 */
export interface ExportedItem {
  /** Name of the exported item */
  name: string;
  /** Type of export (function, class, const, etc.) */
  type: 'function' | 'class' | 'const' | 'interface' | 'type' | 'enum' | 'variable';
  /** Whether this is the default export */
  isDefault: boolean;
  /** Whether the item is async (for functions) */
  isAsync?: boolean;
  /** Parameters for functions */
  parameters?: string[];
  /** Methods for classes */
  methods?: string[];
}

/**
 * Import statement in a source file
 */
export interface ImportStatement {
  /** Module being imported from */
  source: string;
  /** Named imports */
  imports: string[];
  /** Default import name if any */
  defaultImport?: string;
  /** Whether this is a type-only import (TypeScript) */
  isTypeOnly?: boolean;
}
