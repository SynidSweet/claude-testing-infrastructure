import type {
  LanguageAdapter,
  AdapterTestGenerationResult,
  AdapterTestRunner,
  AdapterTestFile,
  AdapterTestRunResult,
} from './index';
import { JavaScriptTestGenerator } from '../generators/javascript/JavaScriptTestGenerator';
import { JestRunner } from '../runners/JestRunner';
import type { TestRunnerConfig } from '../runners/TestRunner';
import { JSFrameworkDetector } from '../generators/javascript/analyzers/JSFrameworkDetector';
import type { ProjectAnalysis, PackageJsonContent } from '../analyzers/ProjectAnalyzer';
import type { TestGeneratorConfig, GeneratedTest } from '../generators/TestGenerator';
import type { LanguageContext } from '../generators/base/BaseTestGenerator';
import type { FileDiscoveryService, FileDiscoveryStats } from '../types/file-discovery-types';
import { logger, fs, path } from '../utils/common-imports';

/**
 * JavaScript/TypeScript Language Adapter
 *
 * Provides a consistent interface for JavaScript and TypeScript test generation
 * using the existing JavaScriptTestGenerator and associated infrastructure.
 */
export class JavaScriptAdapter implements LanguageAdapter {
  public readonly name = 'javascript';
  public readonly supportedLanguages = ['javascript', 'typescript'];

  private generator?: JavaScriptTestGenerator;
  private config?: TestGeneratorConfig;
  private analysis?: ProjectAnalysis;
  private languageContext?: LanguageContext;

  /**
   * Detect JavaScript/TypeScript frameworks in the project
   */
  async detectFrameworks(projectPath: string): Promise<string[]> {
    try {
      let packageJson: PackageJsonContent | null = null;

      // Try to load package.json for better framework detection
      try {
        const packageJsonPath = path.join(projectPath, 'package.json');
        const packageJsonContent = await fs.readFile(packageJsonPath, 'utf-8');
        packageJson = JSON.parse(packageJsonContent) as PackageJsonContent;
      } catch (error) {
        logger.debug('Could not load package.json for framework detection', { error });
      }

      const detector = new JSFrameworkDetector(projectPath, packageJson);

      // Get all detected frameworks
      const frameworks = await detector.detectFrameworks();

      // Filter by confidence and extract framework names
      const detectedFrameworks: string[] = frameworks
        .filter((framework) => framework.confidence > 0.5)
        .map((framework) => framework.name);

      logger.debug(`Detected JavaScript/TypeScript frameworks: ${detectedFrameworks.join(', ')}`, {
        projectPath,
        frameworkCount: detectedFrameworks.length,
      });

      return detectedFrameworks;
    } catch (error) {
      logger.error('Failed to detect JavaScript/TypeScript frameworks', { error, projectPath });
      return [];
    }
  }

  /**
   * Generate tests for JavaScript/TypeScript files
   */
  async generateTests(files: string[]): Promise<AdapterTestGenerationResult> {
    if (!this.generator) {
      throw new Error('Adapter not initialized. Call setupGenerator() first.');
    }

    try {
      logger.info(`Generating tests for ${files.length} JavaScript/TypeScript files`);

      const testFiles: AdapterTestFile[] = [];
      const errors: string[] = [];

      // Generate tests for each file
      for (const filePath of files) {
        try {
          // Create a public wrapper method
          const generatedTest = await this.generateTestForFile(filePath);

          if (generatedTest) {
            testFiles.push({
              path: generatedTest.testPath,
              content: generatedTest.content,
              framework: generatedTest.framework,
            });
          }
        } catch (error) {
          const errorMsg = `Failed to generate test for ${filePath}: ${error instanceof Error ? error.message : String(error)}`;
          logger.error(errorMsg, { error });
          errors.push(errorMsg);
        }
      }

      const success = errors.length === 0;
      logger.info(
        `Test generation completed: ${testFiles.length} tests generated, ${errors.length} errors`
      );

      return {
        success,
        testFiles,
        ...(errors.length > 0 && { errors }),
      };
    } catch (error) {
      const errorMsg = `JavaScript/TypeScript test generation failed: ${error instanceof Error ? error.message : String(error)}`;
      logger.error(errorMsg, { error });

      return {
        success: false,
        testFiles: [],
        errors: [errorMsg],
      };
    }
  }

  /**
   * Get the test runner for JavaScript/TypeScript projects
   */
  getTestRunner(): AdapterTestRunner {
    if (!this.config || !this.analysis) {
      throw new Error('Adapter not initialized. Call setupGenerator() first.');
    }

    return {
      name: 'jest',
      run: async (testPath: string): Promise<AdapterTestRunResult> => {
        // Create a simple file discovery service for the test runner
        const fileDiscovery: FileDiscoveryService = {
          findFiles: (): Promise<{
            files: string[];
            fromCache: boolean;
            duration: number;
            stats: FileDiscoveryStats;
          }> =>
            Promise.resolve({
              files: [testPath],
              fromCache: false,
              duration: 0,
              stats: { totalScanned: 1, included: 1, excluded: 0, languageFiltered: 0 },
            }),
          findTestFiles: (): Promise<string[]> => Promise.resolve([testPath]),
          fileExists: (filePath: string): Promise<boolean> =>
            Promise.resolve(filePath === testPath),
          invalidateCache: () => {},
          getCacheStats: () => ({
            totalRequests: 0,
            cacheHits: 0,
            cacheMisses: 0,
            hitRate: 0,
            totalSavedMs: 0,
            cacheSize: 0,
            oldestEntry: new Date(),
            newestEntry: new Date(),
          }),
        };

        const runnerConfig: TestRunnerConfig = {
          projectPath: this.config!.projectPath,
          testPath: testPath,
          framework: 'jest',
          coverage: {
            enabled: false, // Basic implementation
          },
        };

        const runner = new JestRunner(runnerConfig, this.analysis!, fileDiscovery);
        const result = await runner.run();

        return {
          success: result.success,
          passed: result.passed,
          failed: result.failed,
          skipped: result.skipped,
          ...(result.coverage && {
            coverage: {
              statements: result.coverage.statements,
              branches: result.coverage.branches,
              functions: result.coverage.functions,
              lines: result.coverage.lines,
            },
          }),
        };
      },
    };
  }

  /**
   * Generate a test for a specific file
   * Public wrapper for the protected method in JavaScriptTestGenerator
   */
  private generateTestForFile(filePath: string): Promise<GeneratedTest | null> {
    if (!this.generator) {
      throw new Error('Generator not initialized');
    }

    // Use the public wrapper method
    return this.generator.generateTestForFilePublic(filePath);
  }

  /**
   * Initialize the adapter with configuration and analysis
   * This is called internally by the adapter system
   */
  setupGenerator(
    config: TestGeneratorConfig,
    analysis: ProjectAnalysis,
    languageContext: LanguageContext,
    _fileDiscovery?: FileDiscoveryService
  ): void {
    this.config = config;
    this.analysis = analysis;
    this.languageContext = languageContext;
    this.generator = new JavaScriptTestGenerator(config, analysis, languageContext);

    logger.debug('JavaScriptAdapter initialized', {
      language: languageContext.language,
      framework: languageContext.framework,
      testFramework: languageContext.testFramework,
    });
  }

  /**
   * Check if the adapter is properly initialized
   */
  isInitialized(): boolean {
    return !!(this.generator && this.config && this.analysis && this.languageContext);
  }

  /**
   * Get the current configuration
   */
  getConfig(): TestGeneratorConfig | undefined {
    return this.config;
  }

  /**
   * Get the current analysis
   */
  getAnalysis(): ProjectAnalysis | undefined {
    return this.analysis;
  }

  /**
   * Get the current language context
   */
  getLanguageContext(): LanguageContext | undefined {
    return this.languageContext;
  }
}
