import type {
  LanguageAdapter,
  AdapterTestGenerationResult,
  AdapterTestRunner,
  AdapterTestFile,
  AdapterTestRunResult,
} from './index';
import { PythonTestGenerator } from '../generators/python/PythonTestGenerator';
import { PytestRunner } from '../runners/PytestRunner';
import type { TestRunnerConfig } from '../runners/TestRunner';
import type { ProjectAnalysis } from '../analyzers/ProjectAnalyzer';
import type { TestGeneratorConfig, GeneratedTest } from '../generators/TestGenerator';
import type { LanguageContext } from '../generators/base/BaseTestGenerator';
import type { FileDiscoveryService } from '../types/file-discovery-types';
import { logger, fs, path } from '../utils/common-imports';

/**
 * Python Language Adapter
 *
 * Provides a consistent interface for Python test generation
 * using pytest and the PythonTestGenerator.
 */
export class PythonAdapter implements LanguageAdapter {
  public readonly name = 'python';
  public readonly supportedLanguages = ['python'];

  private generator?: PythonTestGenerator;
  private config?: TestGeneratorConfig;
  private analysis?: ProjectAnalysis;
  private languageContext?: LanguageContext;
  private fileDiscovery?: FileDiscoveryService;

  /**
   * Detect Python frameworks in the project
   */
  async detectFrameworks(projectPath: string): Promise<string[]> {
    try {
      const detectedFrameworks: string[] = [];

      // Check for common Python files that indicate frameworks
      const checkFiles = [
        { file: 'requirements.txt', frameworks: [] },
        { file: 'pyproject.toml', frameworks: [] },
        { file: 'setup.py', frameworks: [] },
        { file: 'Pipfile', frameworks: [] },
      ];

      for (const checkFile of checkFiles) {
        try {
          const filePath = path.join(projectPath, checkFile.file);
          const content = await fs.readFile(filePath, 'utf-8');

          // Detect FastAPI
          if (content.includes('fastapi')) {
            detectedFrameworks.push('fastapi');
          }

          // Detect Django
          if (content.includes('django') || content.includes('Django')) {
            detectedFrameworks.push('django');
          }

          // Detect Flask
          if (content.includes('flask') || content.includes('Flask')) {
            detectedFrameworks.push('flask');
          }

          // Detect pytest
          if (content.includes('pytest')) {
            detectedFrameworks.push('pytest');
          }
        } catch (error) {
          // File doesn't exist, continue
          logger.debug(`Could not read ${checkFile.file} for framework detection`);
        }
      }

      // Check Python source files for framework imports
      try {
        const fg = (await import('fast-glob')).default;
        const pythonFiles = await fg([path.join(projectPath, '**/*.py')], {
          ignore: ['**/venv/**', '**/__pycache__/**', '**/site-packages/**'],
          absolute: true,
          onlyFiles: true,
        });

        // Sample a few files to detect framework usage
        const sampleSize = Math.min(10, pythonFiles.length);
        for (let i = 0; i < sampleSize; i++) {
          const filePath = pythonFiles[i];
          if (!filePath) continue;

          try {
            const content = await fs.readFile(filePath, 'utf-8');

            if (content.includes('from fastapi') || content.includes('import fastapi')) {
              if (!detectedFrameworks.includes('fastapi')) {
                detectedFrameworks.push('fastapi');
              }
            }

            if (content.includes('from django') || content.includes('import django')) {
              if (!detectedFrameworks.includes('django')) {
                detectedFrameworks.push('django');
              }
            }

            if (content.includes('from flask') || content.includes('import flask')) {
              if (!detectedFrameworks.includes('flask')) {
                detectedFrameworks.push('flask');
              }
            }
          } catch (error) {
            // Skip problematic files
            logger.debug(`Could not read ${filePath} for framework detection`);
          }
        }
      } catch (error) {
        logger.debug('Could not scan Python files for framework detection', { error });
      }

      // Default to pytest if no other test framework detected
      if (!detectedFrameworks.includes('pytest') && !detectedFrameworks.includes('unittest')) {
        detectedFrameworks.push('pytest');
      }

      logger.debug(`Detected Python frameworks: ${detectedFrameworks.join(', ')}`, {
        projectPath,
        frameworkCount: detectedFrameworks.length,
      });

      return detectedFrameworks;
    } catch (error) {
      logger.error('Failed to detect Python frameworks', { error, projectPath });
      return ['pytest']; // Default fallback
    }
  }

  /**
   * Generate tests for Python files
   */
  async generateTests(files: string[]): Promise<AdapterTestGenerationResult> {
    if (!this.generator) {
      throw new Error('Adapter not initialized. Call setupGenerator() first.');
    }

    try {
      logger.info(`Generating tests for ${files.length} Python files`);

      const testFiles: AdapterTestFile[] = [];
      const errors: string[] = [];

      // Generate tests for each file
      for (const filePath of files) {
        try {
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
      const errorMsg = `Python test generation failed: ${error instanceof Error ? error.message : String(error)}`;
      logger.error(errorMsg, { error });

      return {
        success: false,
        testFiles: [],
        errors: [errorMsg],
      };
    }
  }

  /**
   * Generate a test for a specific file
   * Public wrapper for the protected method in PythonTestGenerator
   */
  private generateTestForFile(filePath: string): Promise<GeneratedTest | null> {
    if (!this.generator) {
      throw new Error('Generator not initialized');
    }

    // Use the public wrapper method
    return this.generator.generateTestForFilePublic(filePath);
  }

  /**
   * Get the test runner for Python projects
   */
  getTestRunner(): AdapterTestRunner {
    if (!this.config || !this.analysis || !this.fileDiscovery) {
      throw new Error('Adapter not initialized. Call setupGenerator() first.');
    }

    return {
      name: 'pytest',
      run: async (testPath: string): Promise<AdapterTestRunResult> => {
        const runnerConfig: TestRunnerConfig = {
          projectPath: this.config!.projectPath,
          testPath: testPath,
          framework: 'pytest',
          coverage: {
            enabled: false, // Basic implementation
          },
        };

        const runner = new PytestRunner(runnerConfig, this.analysis!, this.fileDiscovery!);
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
   * Initialize the adapter with configuration and analysis
   * This is called internally by the adapter system
   */
  setupGenerator(
    config: TestGeneratorConfig,
    analysis: ProjectAnalysis,
    languageContext: LanguageContext,
    fileDiscovery?: FileDiscoveryService
  ): void {
    this.config = config;
    this.analysis = analysis;
    this.languageContext = languageContext;
    if (fileDiscovery) {
      this.fileDiscovery = fileDiscovery;
    }
    this.generator = new PythonTestGenerator(config, analysis, languageContext);

    logger.debug('PythonAdapter initialized', {
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

  /**
   * Get supported Python frameworks
   */
  getSupportedFrameworks(): string[] {
    return ['fastapi', 'django', 'flask', 'pytest'];
  }

  /**
   * Get recommended test patterns for Python
   */
  getRecommendedPatterns(framework?: string): string[] {
    switch (framework?.toLowerCase()) {
      case 'fastapi':
        return ['async_client', 'dependency_override', 'test_client', 'pytest_asyncio'];
      case 'django':
        return ['test_client', 'database_fixtures', 'model_testing', 'django_test_case'];
      case 'flask':
        return ['app_context', 'test_client', 'fixtures', 'flask_testing'];
      case 'pytest':
      default:
        return ['fixtures', 'parametrize', 'mocking', 'markers'];
    }
  }
}
