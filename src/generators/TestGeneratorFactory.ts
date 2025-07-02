import { logger } from '../utils/common-imports';
import type { ProjectAnalysis } from '../analyzers/ProjectAnalyzer';
import type { TestGeneratorConfig } from './TestGenerator';
import { StructuralTestGenerator } from './StructuralTestGenerator';
import type { BaseTestGenerator, LanguageContext } from './base/BaseTestGenerator';
import type { StructuralTestGeneratorOptions } from './StructuralTestGenerator';
import type { FileDiscoveryService } from '../types/file-discovery-types';

/**
 * Factory for creating appropriate test generators based on configuration
 * 
 * This factory determines which test generator to use based on the
 * configuration and project analysis. It supports both the legacy
 * StructuralTestGenerator and new language-specific generators.
 */
export class TestGeneratorFactory {
  private static featureFlagEnabled = false;
  private static languageGenerators = new Map<string, new (
    config: TestGeneratorConfig,
    analysis: ProjectAnalysis,
    context: LanguageContext
  ) => BaseTestGenerator>();

  /**
   * Enable or disable language-specific generators feature flag
   */
  static setFeatureFlag(enabled: boolean): void {
    this.featureFlagEnabled = enabled;
    logger.info(`Language-specific generators feature flag set to: ${enabled}`);
  }

  /**
   * Register a language-specific generator
   */
  static registerLanguageGenerator(
    language: string,
    generatorClass: new (
      config: TestGeneratorConfig,
      analysis: ProjectAnalysis,
      context: LanguageContext
    ) => BaseTestGenerator
  ): void {
    this.languageGenerators.set(language.toLowerCase(), generatorClass);
    logger.info(`Registered ${language} test generator`);
  }

  /**
   * Create appropriate test generator based on configuration
   */
  static async createGenerator(
    config: TestGeneratorConfig,
    analysis: ProjectAnalysis,
    options?: StructuralTestGeneratorOptions,
    fileDiscovery?: FileDiscoveryService
  ): Promise<StructuralTestGenerator | BaseTestGenerator> {
    // Check if language-specific generators are enabled
    const useLanguageSpecific = this.shouldUseLanguageSpecificGenerator(config, analysis);

    if (useLanguageSpecific) {
      logger.info('Using language-specific test generator');
      return this.createLanguageSpecificGenerator(config, analysis);
    } else {
      logger.info('Using structural test generator');
      return new StructuralTestGenerator(config, analysis, options || {}, fileDiscovery);
    }
  }

  /**
   * Determine if language-specific generators should be used
   */
  private static shouldUseLanguageSpecificGenerator(
    config: TestGeneratorConfig,
    analysis: ProjectAnalysis
  ): boolean {
    // Check configuration override first (highest priority)
    const generatorConfig = (config as any).testGeneration;
    if (generatorConfig?.engine === 'structural') {
      return false;
    }
    if (generatorConfig?.engine === 'language-specific') {
      return true;
    }

    // Check feature flag
    if (!this.featureFlagEnabled) {
      return false;
    }

    // Check if we have a generator for the detected language
    const primaryLanguage = this.detectPrimaryLanguage(analysis);
    return this.languageGenerators.has(primaryLanguage.toLowerCase());
  }

  /**
   * Create a language-specific generator
   */
  private static async createLanguageSpecificGenerator(
    config: TestGeneratorConfig,
    analysis: ProjectAnalysis
  ): Promise<BaseTestGenerator> {
    const primaryLanguage = this.detectPrimaryLanguage(analysis);
    const GeneratorClass = this.languageGenerators.get(primaryLanguage.toLowerCase());

    if (!GeneratorClass) {
      throw new Error(`No generator registered for language: ${primaryLanguage}`);
    }

    // Build language context
    const languageContext = await this.buildLanguageContext(primaryLanguage, analysis, config);

    return new GeneratorClass(config, analysis, languageContext);
  }

  /**
   * Detect primary language from project analysis
   */
  private static detectPrimaryLanguage(analysis: ProjectAnalysis): string {
    // Count files by language
    const languageCounts = new Map<string, number>();
    
    for (const lang of analysis.languages) {
      const currentCount = languageCounts.get(lang.name) || 0;
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

    // TypeScript is a superset of JavaScript, so we treat them together
    if (primaryLanguage === 'typescript') {
      primaryLanguage = 'javascript'; // Use JS generator for TS too
    }

    return primaryLanguage;
  }

  /**
   * Build language context for a specific language
   */
  private static async buildLanguageContext(
    language: string,
    analysis: ProjectAnalysis,
    config: TestGeneratorConfig
  ): Promise<LanguageContext> {
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
    const isTypeScript = analysis.languages.some(lang => lang.name === 'typescript');
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
          { name: 'component', applicable: framework === 'react' || framework === 'vue' || framework === 'angular', templateKey: 'component' },
          { name: 'integration', applicable: framework === 'express' || framework === 'fastify', templateKey: 'integration' },
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
          { name: 'integration', applicable: framework === 'fastapi' || framework === 'flask' || framework === 'django', templateKey: 'integration' },
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
      if (frameworks.some(fw => fw.name === framework)) {
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
      if (frameworks.some(fw => fw.name === framework)) {
        return framework;
      }
    }

    return undefined;
  }

  /**
   * Create a compatibility adapter for existing code
   * This wraps language-specific generators to work with the existing interface
   */
  static async createCompatibilityAdapter(
    _generator: BaseTestGenerator
  ): Promise<StructuralTestGenerator> {
    // This would be implemented when we have the actual language-specific generators
    // For now, throw an error to indicate it's not yet implemented
    throw new Error('Compatibility adapter not yet implemented');
  }
}