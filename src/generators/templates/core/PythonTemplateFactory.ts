import type { Template } from '../TestTemplateEngine';
import {
  TemplateFactory,
  type TemplateFactoryConfig,
  type TemplateCreationRequest,
  type TemplateCreationResult,
  type TemplateFactoryCapabilities,
} from './TemplateFactory';

// Legacy Python template imports from TestTemplateEngine where they're defined
import { PytestTemplate, PytestFastApiTemplate, PytestDjangoTemplate } from '../TestTemplateEngine';

/**
 * Python template factory
 *
 * Creates templates for Python projects with various frameworks.
 * Supports pytest and different Python web frameworks.
 */
export class PythonTemplateFactory extends TemplateFactory {
  private enhancedTemplateCache: Map<string, Template> = new Map();

  constructor(config?: Partial<TemplateFactoryConfig>) {
    const defaultConfig: TemplateFactoryConfig = {
      language: 'python',
      enableEnhanced: true,
      frameworkConfig: {},
      templateOptions: {},
    };

    super({ ...defaultConfig, ...config });
  }

  getFactoryName(): string {
    return 'python-template-factory';
  }

  getCapabilities(): TemplateFactoryCapabilities {
    return {
      supportedTemplates: [
        'pytest',
        'pytest-fastapi',
        'pytest-django',
        'pytest-flask',
        'enhanced-pytest',
        'enhanced-fastapi',
        'enhanced-django',
      ],
      supportedFrameworks: ['pytest', 'fastapi', 'django', 'flask', 'asyncio'],
      supportsEnhanced: this.config.enableEnhanced || false,
      language: this.config.language,
    };
  }

  createTemplate(request: TemplateCreationRequest): TemplateCreationResult {
    const validation = this.validateRequest(request);
    if (!validation.valid) {
      return {
        success: false,
        error: validation.error || 'Validation failed',
      };
    }

    try {
      const template = this.instantiateTemplate(request);
      return {
        success: true,
        template,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to create template '${request.templateName}': ${error}`,
      };
    }
  }

  getDefaultTemplates(): Template[] {
    const templates: Template[] = [];

    try {
      // Core Python templates
      templates.push(new PytestTemplate());
      templates.push(new PytestFastApiTemplate());
      templates.push(new PytestDjangoTemplate());
    } catch (error) {
      console.warn('Some default Python templates failed to load:', error);
    }

    return templates;
  }

  protected createEnhancedTemplates(): Template[] {
    if (!this.config.enableEnhanced) {
      return [];
    }

    const templates: Template[] = [];

    try {
      // Future: Load enhanced Python templates when they're implemented
      // For now, return empty array as enhanced Python templates don't exist yet
      console.info('Enhanced Python templates not yet implemented');
    } catch (error) {
      console.warn('Enhanced Python templates failed to load:', error);
    }

    return templates;
  }

  /**
   * Instantiate a template based on the request
   */
  private instantiateTemplate(request: TemplateCreationRequest): Template {
    const { templateName } = request;

    // Check cache for enhanced templates
    if (templateName.startsWith('enhanced-')) {
      const cached = this.enhancedTemplateCache.get(templateName);
      if (cached) {
        return cached;
      }
    }

    switch (templateName) {
      case 'pytest':
        return new PytestTemplate();

      case 'pytest-fastapi':
        return new PytestFastApiTemplate();

      case 'pytest-django':
        return new PytestDjangoTemplate();

      case 'pytest-flask':
        // Future: Create Flask template
        throw new Error('Flask template not yet implemented');

      case 'enhanced-pytest':
        return this.createEnhancedPytestTemplate();

      case 'enhanced-fastapi':
        return this.createEnhancedFastApiTemplate();

      case 'enhanced-django':
        return this.createEnhancedDjangoTemplate();

      default:
        throw new Error(`Unknown template: ${templateName}`);
    }
  }

  /**
   * Create enhanced pytest template (future implementation)
   */
  private createEnhancedPytestTemplate(): Template {
    try {
      // Future: Load enhanced pytest template when implemented
      console.warn('Enhanced pytest template not yet implemented, falling back to basic template');
      return new PytestTemplate();
    } catch (error) {
      console.warn('EnhancedPytestTemplate not available:', error);
      return new PytestTemplate();
    }
  }

  /**
   * Create enhanced FastAPI template (future implementation)
   */
  private createEnhancedFastApiTemplate(): Template {
    try {
      // Future: Load enhanced FastAPI template when implemented
      console.warn('Enhanced FastAPI template not yet implemented, falling back to basic template');
      return new PytestFastApiTemplate();
    } catch (error) {
      console.warn('EnhancedFastApiTemplate not available:', error);
      return new PytestFastApiTemplate();
    }
  }

  /**
   * Create enhanced Django template (future implementation)
   */
  private createEnhancedDjangoTemplate(): Template {
    try {
      // Future: Load enhanced Django template when implemented
      console.warn('Enhanced Django template not yet implemented, falling back to basic template');
      return new PytestDjangoTemplate();
    } catch (error) {
      console.warn('EnhancedDjangoTemplate not available:', error);
      return new PytestDjangoTemplate();
    }
  }

  /**
   * Get template by framework preference
   */
  getTemplateByFramework(framework: string): Template | null {
    switch (framework.toLowerCase()) {
      case 'pytest':
        return this.config.enableEnhanced
          ? this.createEnhancedPytestTemplate()
          : new PytestTemplate();

      case 'fastapi':
        return this.config.enableEnhanced
          ? this.createEnhancedFastApiTemplate()
          : new PytestFastApiTemplate();

      case 'django':
        return this.config.enableEnhanced
          ? this.createEnhancedDjangoTemplate()
          : new PytestDjangoTemplate();

      case 'flask':
        // Future implementation
        console.warn('Flask template not yet implemented');
        return null;

      default:
        return null;
    }
  }

  /**
   * Clear template cache
   */
  clearCache(): void {
    this.enhancedTemplateCache.clear();
  }

  /**
   * Check if async testing is supported for the given framework
   */
  supportsAsyncTesting(framework: string): boolean {
    const asyncFrameworks = ['fastapi', 'asyncio'];
    return asyncFrameworks.includes(framework.toLowerCase());
  }

  /**
   * Get recommended test patterns for a framework
   */
  getRecommendedPatterns(framework: string): string[] {
    switch (framework.toLowerCase()) {
      case 'fastapi':
        return ['async_client', 'dependency_override', 'test_client'];
      case 'django':
        return ['test_client', 'database_fixtures', 'model_testing'];
      case 'flask':
        return ['app_context', 'test_client', 'fixtures'];
      case 'pytest':
      default:
        return ['fixtures', 'parametrize', 'mocking'];
    }
  }
}
