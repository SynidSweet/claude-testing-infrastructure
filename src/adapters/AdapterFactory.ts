import type { ProjectAnalysis } from '../analyzers/ProjectAnalyzer';
import type { TestGeneratorConfig } from '../generators/TestGenerator';
import type { LanguageContext } from '../generators/base/BaseTestGenerator';
import type { FileDiscoveryService } from '../types/file-discovery-types';
import { getLanguageAdapter, initializeAdapters, type LanguageAdapter } from './index';
import { logger } from '../utils/common-imports';

/**
 * Factory for creating and managing language adapters
 *
 * This factory provides a high-level interface for working with language adapters,
 * handling initialization, configuration, and adapter lifecycle management.
 */
export class AdapterFactory {
  private static initialized = false;

  /**
   * Initialize the adapter system
   * This should be called once during application startup
   */
  static async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      await initializeAdapters();
      this.initialized = true;
      logger.info('Adapter system initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize adapter system', { error });
      throw error;
    }
  }

  /**
   * Create and configure a language adapter for a project
   */
  static async createAdapter(
    language: string,
    config: TestGeneratorConfig,
    analysis: ProjectAnalysis,
    languageContext: LanguageContext,
    fileDiscovery?: FileDiscoveryService
  ): Promise<LanguageAdapter | null> {
    // Ensure adapters are initialized
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      // Get the appropriate adapter
      const adapter = await getLanguageAdapter(language);
      if (!adapter) {
        logger.warn(`No adapter found for language: ${language}`);
        return null;
      }

      // Configure the adapter if it has a setupGenerator method
      if ('setupGenerator' in adapter && typeof adapter.setupGenerator === 'function') {
        adapter.setupGenerator(config, analysis, languageContext, fileDiscovery);
        logger.debug(`Configured ${language} adapter`, {
          language,
          framework: languageContext.framework,
          testFramework: languageContext.testFramework,
        });
      } else {
        logger.warn(`Adapter for ${language} does not support configuration`);
      }

      return adapter;
    } catch (error) {
      logger.error(`Failed to create adapter for language: ${language}`, { error });
      return null;
    }
  }

  /**
   * Get a configured adapter for the primary language in a project
   */
  static async createPrimaryAdapter(
    analysis: ProjectAnalysis,
    config: TestGeneratorConfig,
    fileDiscovery?: FileDiscoveryService
  ): Promise<LanguageAdapter | null> {
    // Detect primary language
    const primaryLanguage = this.detectPrimaryLanguage(analysis);

    // Build language context
    const languageContext = this.buildLanguageContext(primaryLanguage, analysis, config);

    // Create and configure adapter
    return this.createAdapter(primaryLanguage, config, analysis, languageContext, fileDiscovery);
  }

  /**
   * Detect primary language from project analysis
   */
  private static detectPrimaryLanguage(analysis: ProjectAnalysis): string {
    // Count files by language
    const languageCounts = new Map<string, number>();

    for (const lang of analysis.languages) {
      const currentCount = languageCounts.get(lang.name) ?? 0;
      languageCounts.set(lang.name, currentCount + lang.files.length);
    }

    // Find language with most files
    let primaryLanguage = 'javascript'; // default
    let maxCount = 0;

    for (const [language, count] of languageCounts) {
      if (count > maxCount) {
        maxCount = count;
        primaryLanguage = language;
      }
    }

    // TypeScript is a superset of JavaScript, so we use the same adapter
    if (primaryLanguage === 'typescript') {
      primaryLanguage = 'javascript';
    }

    return primaryLanguage;
  }

  /**
   * Build language context for a specific language
   */
  private static buildLanguageContext(
    language: string,
    analysis: ProjectAnalysis,
    config: TestGeneratorConfig
  ): LanguageContext {
    switch (language.toLowerCase()) {
      case 'javascript':
      case 'typescript':
        return this.buildJavaScriptContext(analysis, config);
      case 'python':
        return this.buildPythonContext(analysis, config);
      default:
        throw new Error(`Unsupported language: ${language}`);
    }
  }

  /**
   * Build JavaScript/TypeScript language context
   */
  private static buildJavaScriptContext(
    analysis: ProjectAnalysis,
    config: TestGeneratorConfig
  ): LanguageContext {
    const isTypeScript = analysis.languages.some((lang) => lang.name === 'typescript');
    const moduleSystem = analysis.moduleSystem?.type || 'commonjs';
    const framework = this.detectJavaScriptFramework(analysis);
    const testFramework = config.testFramework || 'jest';

    return {
      language: isTypeScript ? 'typescript' : 'javascript',
      ...(framework && { framework }),
      moduleSystem,
      testFramework,
      features: {
        supportsAsync: true,
        hasDecorators: isTypeScript || framework === 'angular',
        hasTypeAnnotations: isTypeScript,
        testingPatterns: [
          { name: 'unit', applicable: true, templateKey: 'unit' },
          {
            name: 'component',
            applicable: framework === 'react' || framework === 'vue' || framework === 'angular',
            templateKey: 'component',
          },
          {
            name: 'integration',
            applicable: framework === 'express' || framework === 'fastify',
            templateKey: 'integration',
          },
        ],
        assertionStyle: 'expect',
      },
      testFileExtension: `.test.${isTypeScript ? 'ts' : 'js'}`,
      importStyle: {
        importSyntax: moduleSystem === 'esm' ? 'import' : 'require',
        exportSyntax: moduleSystem === 'esm' ? 'export' : 'module.exports',
        useFileExtensions: moduleSystem === 'esm',
        ...(moduleSystem === 'esm' && { importExtension: '.js' }),
      },
    };
  }

  /**
   * Build Python language context
   */
  private static buildPythonContext(
    analysis: ProjectAnalysis,
    config: TestGeneratorConfig
  ): LanguageContext {
    const framework = this.detectPythonFramework(analysis);
    const testFramework = config.testFramework || 'pytest';

    return {
      language: 'python',
      ...(framework && { framework }),
      testFramework,
      features: {
        supportsAsync: true,
        hasDecorators: true,
        hasTypeAnnotations: true, // Python 3.5+ type hints
        testingPatterns: [
          { name: 'unit', applicable: true, templateKey: 'unit' },
          {
            name: 'integration',
            applicable: framework === 'fastapi' || framework === 'flask' || framework === 'django',
            templateKey: 'integration',
          },
        ],
        assertionStyle: 'assert',
      },
      testFileExtension: '_test.py',
      importStyle: {
        importSyntax: 'from-import',
        exportSyntax: 'export', // Python doesn't have explicit exports
        useFileExtensions: false,
      },
    };
  }

  /**
   * Detect JavaScript/TypeScript framework
   */
  private static detectJavaScriptFramework(analysis: ProjectAnalysis): string | undefined {
    const frameworks = analysis.frameworks;

    // Priority order for framework detection
    const priorityOrder = ['react', 'vue', 'angular', 'express', 'fastify', 'nest'];

    for (const framework of priorityOrder) {
      if (frameworks.some((fw) => fw.name === framework)) {
        return framework;
      }
    }

    return undefined;
  }

  /**
   * Detect Python framework
   */
  private static detectPythonFramework(analysis: ProjectAnalysis): string | undefined {
    const frameworks = analysis.frameworks;

    // Priority order for Python framework detection
    const priorityOrder = ['fastapi', 'django', 'flask'];

    for (const framework of priorityOrder) {
      if (frameworks.some((fw) => fw.name === framework)) {
        return framework;
      }
    }

    return undefined;
  }

  /**
   * Check if the adapter system is initialized
   */
  static isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Reset the adapter system (useful for testing)
   */
  static reset(): void {
    this.initialized = false;
  }
}
