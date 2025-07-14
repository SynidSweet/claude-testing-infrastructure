import { Template, TemplateContext, TemplateInfo } from './TestTemplateEngine';
import { TestType } from '../TestGenerator';
import { TemplateRegistry } from './core/TemplateRegistry';
import {
  TemplateFactoryRegistry,
  JavaScriptTemplateFactory,
  PythonTemplateFactory,
  registerTemplatesFromFactories,
} from './core';

/**
 * Template orchestrator that manages template registration and selection
 * Replaces the monolithic TestTemplateEngine with a cleaner architecture
 * Now uses factory pattern for centralized template creation
 */
export class TemplateOrchestrator {
  private templates: Map<string, Template> = new Map();
  private registry: TemplateRegistry;
  private factoryRegistry: TemplateFactoryRegistry;

  constructor() {
    this.registry = new TemplateRegistry();
    this.factoryRegistry = new TemplateFactoryRegistry();
    this.initializeFactories();
    this.registerTemplatesFromFactories();
  }

  /**
   * Register a template
   */
  registerTemplate(template: Template, allowOverride: boolean = false): void {
    // Register in both legacy Map and new TemplateRegistry for backward compatibility
    const key = this.getTemplateKey(template.language, template.framework, template.testType);
    this.templates.set(key, template);

    // Register in the new TemplateRegistry (ignore failures for backward compatibility)
    this.registry.registerTemplate(template, allowOverride);
  }

  /**
   * Generate test content using the most appropriate template with validation
   */
  generateTest(context: TemplateContext): string {
    const template = this.findBestTemplate(context);
    if (!template) {
      throw new Error(
        `No template found for ${context.language}/${context.framework}/${context.testType}`
      );
    }

    // Validate context if template supports validation
    if (template.validateContext) {
      const validation = template.validateContext(context);
      if (!validation.isValid) {
        const errorMsg = validation.errors?.join(', ') || 'Context validation failed';
        throw new Error(`Template validation failed: ${errorMsg}`);
      }

      // Log warnings if present
      if (validation.warnings && validation.warnings.length > 0) {
        console.warn(`Template warnings: ${validation.warnings.join(', ')}`);
      }
    }

    return template.generate(context);
  }

  /**
   * Generate test with enhanced context validation and error handling
   */
  generateTestSafe(context: TemplateContext): {
    success: boolean;
    content?: string | undefined;
    error?: string | undefined;
    warnings?: string[] | undefined;
  } {
    try {
      const template = this.findBestTemplate(context);
      if (!template) {
        return {
          success: false,
          error: `No template found for ${context.language}/${context.framework}/${context.testType}`,
        };
      }

      // Validate context if template supports validation
      let warnings: string[] | undefined;
      if (template.validateContext) {
        const validation = template.validateContext(context);
        if (!validation.isValid) {
          return {
            success: false,
            error: validation.errors?.join(', ') || 'Context validation failed',
          };
        }
        warnings = validation.warnings;
      }

      const content = template.generate(context);
      return { success: true, content, warnings: warnings ?? undefined };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Get template information for a given context
   */
  getTemplateInfo(context: TemplateContext): TemplateInfo | undefined {
    const template = this.findBestTemplate(context);
    return template?.getMetadata?.();
  }

  /**
   * Get access to the internal TemplateRegistry for advanced use cases
   */
  getRegistry(): TemplateRegistry {
    return this.registry;
  }

  /**
   * List all registered templates with their metadata
   */
  listTemplates(): TemplateInfo[] {
    const templateInfos: TemplateInfo[] = [];
    const registryTemplateInfos = this.registry.listTemplates();

    // Convert registry template infos to legacy format
    for (const registryInfo of registryTemplateInfos) {
      templateInfos.push({
        name: registryInfo.name,
        description:
          registryInfo.description ||
          `${registryInfo.language} template for ${registryInfo.framework || 'any framework'}`,
        language: registryInfo.language as 'javascript' | 'typescript' | 'python',
        framework: registryInfo.framework ?? undefined,
        testType: (registryInfo.testType as TestType) ?? undefined,
        supportedFeatures: ['basic-generation'],
        version: '1.0.0',
      });
    }

    // Add any legacy templates that might not be in the registry
    for (const template of this.templates.values()) {
      const existingInfo = templateInfos.find(
        (info) =>
          info.name === template.name &&
          info.language === template.language &&
          info.framework === template.framework
      );

      if (!existingInfo) {
        if (template.getMetadata) {
          templateInfos.push(template.getMetadata());
        } else {
          // Fallback for templates without metadata
          templateInfos.push({
            name: template.name,
            description: `${template.language} template for ${template.framework || 'any framework'}`,
            language: template.language,
            framework: template.framework ?? undefined,
            testType: template.testType ?? undefined,
            supportedFeatures: ['basic-generation'],
            version: '1.0.0',
          });
        }
      }
    }

    return templateInfos;
  }

  /**
   * Find the best matching template for the given context
   */
  private findBestTemplate(context: TemplateContext): Template | undefined {
    // First try the new TemplateRegistry for improved matching
    const registryTemplate = this.registry.findTemplate(context);
    if (registryTemplate) {
      return registryTemplate;
    }

    // Fallback to legacy template selection for backward compatibility
    // Try exact match first
    let key = this.getTemplateKey(context.language, context.framework, context.testType);
    let template = this.templates.get(key);
    if (template) return template;

    // Try without test type
    key = this.getTemplateKey(context.language, context.framework);
    template = this.templates.get(key);
    if (template) return template;

    // Try without framework
    key = this.getTemplateKey(context.language, undefined, context.testType);
    template = this.templates.get(key);
    if (template) return template;

    // Try language with default framework (jest for JS/TS, pytest for Python)
    const defaultFramework = context.language === 'python' ? 'pytest' : 'jest';
    key = this.getTemplateKey(context.language, defaultFramework);
    template = this.templates.get(key);
    if (template) return template;

    // Try language only
    key = this.getTemplateKey(context.language);
    template = this.templates.get(key);
    if (template) return template;

    return undefined;
  }

  /**
   * Generate a key for template lookup
   */
  private getTemplateKey(language: string, framework?: string, testType?: TestType): string {
    const parts = [language];
    if (framework) parts.push(framework);
    if (testType) parts.push(testType);
    return parts.join(':');
  }

  /**
   * Initialize template factories
   */
  private initializeFactories(): void {
    // Register JavaScript/TypeScript factory
    const jsFactory = new JavaScriptTemplateFactory({
      language: 'javascript',
      enableEnhanced: true,
    });
    this.factoryRegistry.registerFactory(jsFactory);

    // Register Python factory
    const pythonFactory = new PythonTemplateFactory({
      language: 'python',
      enableEnhanced: true,
    });
    this.factoryRegistry.registerFactory(pythonFactory);
  }

  /**
   * Register templates from factories
   */
  private registerTemplatesFromFactories(): void {
    registerTemplatesFromFactories(this.registry, this.factoryRegistry);

    // Sync with legacy template map for backward compatibility
    this.syncLegacyTemplateMap();
  }

  /**
   * Sync templates from registry to legacy Map for backward compatibility
   */
  private syncLegacyTemplateMap(): void {
    // Clear existing templates
    this.templates.clear();

    // Get all templates from registry and add to legacy map
    const allTemplateInfos = this.registry.listTemplates();
    for (const templateInfo of allTemplateInfos) {
      const key = this.getTemplateKey(
        templateInfo.language,
        templateInfo.framework,
        templateInfo.testType as TestType | undefined
      );
      const template = this.registry.getTemplate(
        `${templateInfo.language}:${templateInfo.framework ?? ''}:${templateInfo.testType ?? ''}`
      );
      if (template) {
        this.templates.set(key, template);
      }
    }
  }

  /**
   * Get access to the factory registry for dynamic template creation
   */
  getFactoryRegistry(): TemplateFactoryRegistry {
    return this.factoryRegistry;
  }

  /**
   * Create template using factory system
   */
  createTemplate(templateName: string, language?: string): Template | undefined {
    const result = this.factoryRegistry.createTemplate({ templateName }, language);
    return result.success ? result.template : undefined;
  }
}
