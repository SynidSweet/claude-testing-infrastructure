import type { Template } from '../TestTemplateEngine';

/**
 * Configuration for template creation
 */
export interface TemplateFactoryConfig {
  /** Language for templates created by this factory */
  language: 'javascript' | 'typescript' | 'python';
  /** Framework-specific configuration */
  frameworkConfig?: Record<string, unknown>;
  /** Custom template options */
  templateOptions?: Record<string, unknown>;
  /** Whether to enable enhanced templates */
  enableEnhanced?: boolean;
}

/**
 * Template creation request with context and options
 */
export interface TemplateCreationRequest {
  /** Template name to create */
  templateName: string;
  /** Framework for the template (optional) */
  framework?: string;
  /** Test type for the template (optional) */
  testType?: string;
  /** Additional creation options */
  options?: Record<string, unknown>;
}

/**
 * Template creation result
 */
export interface TemplateCreationResult {
  /** Whether template creation was successful */
  success: boolean;
  /** Created template instance (if successful) */
  template?: Template;
  /** Error message (if failed) */
  error?: string;
  /** Warning messages */
  warnings?: string[];
}

/**
 * Template factory capabilities
 */
export interface TemplateFactoryCapabilities {
  /** Supported template names */
  supportedTemplates: string[];
  /** Supported frameworks */
  supportedFrameworks: string[];
  /** Whether enhanced templates are supported */
  supportsEnhanced: boolean;
  /** Factory language */
  language: string;
}

/**
 * Abstract base class for template factories
 * 
 * Provides a plugin architecture for creating templates in a structured way.
 * Each language/framework combination can have its own factory implementation.
 */
export abstract class TemplateFactory {
  protected config: TemplateFactoryConfig;

  constructor(config: TemplateFactoryConfig) {
    this.config = config;
  }

  /**
   * Get factory capabilities
   */
  abstract getCapabilities(): TemplateFactoryCapabilities;

  /**
   * Create a template instance
   */
  abstract createTemplate(request: TemplateCreationRequest): TemplateCreationResult;

  /**
   * Create multiple templates at once
   */
  createTemplates(requests: TemplateCreationRequest[]): TemplateCreationResult[] {
    return requests.map(request => this.createTemplate(request));
  }

  /**
   * Get all default templates for this factory
   */
  abstract getDefaultTemplates(): Template[];

  /**
   * Get enhanced templates for this factory (if supported)
   */
  getEnhancedTemplates(): Template[] {
    if (!this.config.enableEnhanced) {
      return [];
    }
    return this.createEnhancedTemplates();
  }

  /**
   * Check if factory can create a specific template
   */
  canCreateTemplate(templateName: string): boolean {
    const capabilities = this.getCapabilities();
    return capabilities.supportedTemplates.includes(templateName);
  }

  /**
   * Check if factory supports a specific framework
   */
  supportsFramework(framework: string): boolean {
    const capabilities = this.getCapabilities();
    return capabilities.supportedFrameworks.includes(framework);
  }

  /**
   * Validate template creation request
   */
  protected validateRequest(request: TemplateCreationRequest): { valid: boolean; error?: string } {
    if (!request.templateName || request.templateName.trim() === '') {
      return { valid: false, error: 'Template name is required' };
    }

    if (!this.canCreateTemplate(request.templateName)) {
      return { 
        valid: false, 
        error: `Template '${request.templateName}' is not supported by this factory` 
      };
    }

    if (request.framework && !this.supportsFramework(request.framework)) {
      return { 
        valid: false, 
        error: `Framework '${request.framework}' is not supported by this factory` 
      };
    }

    return { valid: true };
  }

  /**
   * Create enhanced templates - to be implemented by subclasses if supported
   */
  protected createEnhancedTemplates(): Template[] {
    return [];
  }

  /**
   * Get factory configuration
   */
  getConfig(): TemplateFactoryConfig {
    return { ...this.config };
  }

  /**
   * Update factory configuration
   */
  updateConfig(config: Partial<TemplateFactoryConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get factory language
   */
  getLanguage(): string {
    return this.config.language;
  }

  /**
   * Get factory name for identification
   */
  abstract getFactoryName(): string;

  /**
   * Get factory version for compatibility checking
   */
  getFactoryVersion(): string {
    return '1.0.0';
  }
}

/**
 * Template factory registration result
 */
export interface TemplateFactoryRegistrationResult {
  success: boolean;
  error?: string | undefined;
  existingFactory?: TemplateFactory | undefined;
}

/**
 * Factory registry for managing template factories
 */
export class TemplateFactoryRegistry {
  private factories: Map<string, TemplateFactory> = new Map();
  private languageFactories: Map<string, TemplateFactory[]> = new Map();

  /**
   * Register a template factory
   */
  registerFactory(factory: TemplateFactory): TemplateFactoryRegistrationResult {
    const factoryName = factory.getFactoryName();
    const language = factory.getLanguage();

    if (this.factories.has(factoryName)) {
      return {
        success: false,
        error: `Factory with name '${factoryName}' already exists`,
        existingFactory: this.factories.get(factoryName) || undefined
      };
    }

    this.factories.set(factoryName, factory);

    // Track by language for easy lookup
    if (!this.languageFactories.has(language)) {
      this.languageFactories.set(language, []);
    }
    this.languageFactories.get(language)!.push(factory);

    return { success: true };
  }

  /**
   * Get factory by name
   */
  getFactory(factoryName: string): TemplateFactory | undefined {
    return this.factories.get(factoryName);
  }

  /**
   * Get factories for a specific language
   */
  getFactoriesForLanguage(language: string): TemplateFactory[] {
    return this.languageFactories.get(language) || [];
  }

  /**
   * Get all registered factories
   */
  getAllFactories(): TemplateFactory[] {
    return Array.from(this.factories.values());
  }

  /**
   * Find factory that can create a specific template
   */
  findFactoryForTemplate(templateName: string, language?: string): TemplateFactory | undefined {
    const searchFactories = language 
      ? this.getFactoriesForLanguage(language)
      : this.getAllFactories();

    return searchFactories.find(factory => factory.canCreateTemplate(templateName));
  }

  /**
   * Create template using appropriate factory
   */
  createTemplate(request: TemplateCreationRequest, language?: string): TemplateCreationResult {
    const factory = this.findFactoryForTemplate(request.templateName, language);

    if (!factory) {
      return {
        success: false,
        error: `No factory found for template '${request.templateName}'${language ? ` in language '${language}'` : ''}`
      };
    }

    return factory.createTemplate(request);
  }

  /**
   * Get registry statistics
   */
  getStats(): {
    totalFactories: number;
    factoriesByLanguage: Map<string, number>;
    supportedTemplates: string[];
  } {
    const factoriesByLanguage = new Map<string, number>();
    const supportedTemplates = new Set<string>();

    for (const factory of this.factories.values()) {
      const language = factory.getLanguage();
      factoriesByLanguage.set(language, (factoriesByLanguage.get(language) || 0) + 1);

      const capabilities = factory.getCapabilities();
      capabilities.supportedTemplates.forEach(template => supportedTemplates.add(template));
    }

    return {
      totalFactories: this.factories.size,
      factoriesByLanguage,
      supportedTemplates: Array.from(supportedTemplates).sort()
    };
  }

  /**
   * Clear all factories (for testing)
   */
  clear(): void {
    this.factories.clear();
    this.languageFactories.clear();
  }
}