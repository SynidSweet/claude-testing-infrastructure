import type { Template } from '../TestTemplateEngine';
import { TemplateFactory, type TemplateFactoryConfig, type TemplateCreationRequest, type TemplateCreationResult, type TemplateFactoryCapabilities } from './TemplateFactory';

// Legacy template imports from TestTemplateEngine where they're defined
import { 
  JestJavaScriptTemplate,
  JestReactComponentTemplate,
  JestExpressApiTemplate,
  JestTypeScriptTemplate,
  JestReactTypeScriptTemplate
} from '../TestTemplateEngine';

/**
 * JavaScript/TypeScript template factory
 * 
 * Creates templates for JavaScript and TypeScript projects with various frameworks.
 * Supports both legacy and enhanced template variants.
 */
export class JavaScriptTemplateFactory extends TemplateFactory {
  private enhancedTemplateCache: Map<string, Template> = new Map();

  constructor(config?: Partial<TemplateFactoryConfig>) {
    const defaultConfig: TemplateFactoryConfig = {
      language: 'javascript',
      enableEnhanced: true,
      frameworkConfig: {},
      templateOptions: {}
    };

    super({ ...defaultConfig, ...config });
  }

  getFactoryName(): string {
    return 'javascript-template-factory';
  }

  getCapabilities(): TemplateFactoryCapabilities {
    return {
      supportedTemplates: [
        'jest-javascript',
        'jest-typescript',
        'jest-react-component',
        'jest-react-typescript',
        'jest-express-api',
        'enhanced-jest-javascript',
        'enhanced-react-component',
        'enhanced-vue-component',
        'enhanced-angular-component',
        'enhanced-typescript'
      ],
      supportedFrameworks: [
        'jest',
        'react',
        'vue',
        'angular',
        'express',
        'node'
      ],
      supportsEnhanced: this.config.enableEnhanced || false,
      language: this.config.language
    };
  }

  createTemplate(request: TemplateCreationRequest): TemplateCreationResult {
    const validation = this.validateRequest(request);
    if (!validation.valid) {
      return {
        success: false,
        error: validation.error || 'Validation failed'
      };
    }

    try {
      const template = this.instantiateTemplate(request);
      return {
        success: true,
        template
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to create template '${request.templateName}': ${error}`
      };
    }
  }

  getDefaultTemplates(): Template[] {
    const templates: Template[] = [];

    try {
      // Core JavaScript templates
      templates.push(new JestJavaScriptTemplate());
      templates.push(new JestReactComponentTemplate());
      templates.push(new JestExpressApiTemplate());

      // TypeScript templates (if language supports it)
      if (this.config.language === 'javascript' || this.config.language === 'typescript') {
        templates.push(new JestTypeScriptTemplate());
        templates.push(new JestReactTypeScriptTemplate());
      }
    } catch (error) {
      console.warn('Some default templates failed to load:', error);
    }

    return templates;
  }

  protected createEnhancedTemplates(): Template[] {
    if (!this.config.enableEnhanced) {
      return [];
    }

    const templates: Template[] = [];

    try {
      // Dynamic imports for enhanced templates to handle optional dependencies
      const enhancedTemplates = this.loadEnhancedTemplates();
      templates.push(...enhancedTemplates);
    } catch (error) {
      console.warn('Enhanced templates failed to load:', error);
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
      case 'jest-javascript':
        return new JestJavaScriptTemplate();

      case 'jest-typescript':
        return new JestTypeScriptTemplate();

      case 'jest-react-component':
        return new JestReactComponentTemplate();

      case 'jest-react-typescript':
        return new JestReactTypeScriptTemplate();

      case 'jest-express-api':
        return new JestExpressApiTemplate();

      case 'enhanced-jest-javascript':
        return this.createEnhancedJestTemplate() || new JestJavaScriptTemplate();

      case 'enhanced-react-component':
        return this.createEnhancedReactTemplate() || new JestReactComponentTemplate();

      case 'enhanced-vue-component':
        return this.createEnhancedVueTemplate() || new JestJavaScriptTemplate();

      case 'enhanced-angular-component':
        return this.createEnhancedAngularTemplate() || new JestJavaScriptTemplate();

      case 'enhanced-typescript':
        return this.createEnhancedTypeScriptTemplate() || new JestTypeScriptTemplate();

      default:
        throw new Error(`Unknown template: ${templateName}`);
    }
  }

  /**
   * Load enhanced templates with dynamic imports
   */
  private loadEnhancedTemplates(): Template[] {
    const templates: Template[] = [];

    try {
      // Try to load enhanced templates - these may fail if files don't exist
      const enhancedJest = this.createEnhancedJestTemplate();
      if (enhancedJest) {
        templates.push(enhancedJest);
        this.enhancedTemplateCache.set('enhanced-jest-javascript', enhancedJest);
      }

      const enhancedReact = this.createEnhancedReactTemplate();
      if (enhancedReact) {
        templates.push(enhancedReact);
        this.enhancedTemplateCache.set('enhanced-react-component', enhancedReact);
      }

      const enhancedVue = this.createEnhancedVueTemplate();
      if (enhancedVue) {
        templates.push(enhancedVue);
        this.enhancedTemplateCache.set('enhanced-vue-component', enhancedVue);
      }

      const enhancedAngular = this.createEnhancedAngularTemplate();
      if (enhancedAngular) {
        templates.push(enhancedAngular);
        this.enhancedTemplateCache.set('enhanced-angular-component', enhancedAngular);
      }

      const enhancedTypeScript = this.createEnhancedTypeScriptTemplate();
      if (enhancedTypeScript) {
        templates.push(enhancedTypeScript);
        this.enhancedTemplateCache.set('enhanced-typescript', enhancedTypeScript);
      }
    } catch (error) {
      console.warn('Some enhanced templates failed to load:', error);
    }

    return templates;
  }

  /**
   * Create enhanced Jest JavaScript template
   */
  private createEnhancedJestTemplate(): Template | null {
    try {
      const { EnhancedJestJavaScriptTemplate } = require('../javascript/EnhancedJestJavaScriptTemplate');
      return new EnhancedJestJavaScriptTemplate();
    } catch (error) {
      console.warn('EnhancedJestJavaScriptTemplate not available:', error);
      return null;
    }
  }

  /**
   * Create enhanced React template
   */
  private createEnhancedReactTemplate(): Template | null {
    try {
      const { EnhancedReactComponentTemplate } = require('../javascript/EnhancedReactComponentTemplate');
      return new EnhancedReactComponentTemplate();
    } catch (error) {
      console.warn('EnhancedReactComponentTemplate not available:', error);
      return null;
    }
  }

  /**
   * Create enhanced Vue template
   */
  private createEnhancedVueTemplate(): Template | null {
    try {
      const { EnhancedVueComponentTemplate } = require('../javascript/EnhancedVueComponentTemplate');
      return new EnhancedVueComponentTemplate();
    } catch (error) {
      console.warn('EnhancedVueComponentTemplate not available:', error);
      return null;
    }
  }

  /**
   * Create enhanced Angular template
   */
  private createEnhancedAngularTemplate(): Template | null {
    try {
      const { EnhancedAngularComponentTemplate } = require('../javascript/EnhancedAngularComponentTemplate');
      return new EnhancedAngularComponentTemplate();
    } catch (error) {
      console.warn('EnhancedAngularComponentTemplate not available:', error);
      return null;
    }
  }

  /**
   * Create enhanced TypeScript template
   */
  private createEnhancedTypeScriptTemplate(): Template | null {
    try {
      const { EnhancedTypeScriptTemplate } = require('../javascript/EnhancedTypeScriptTemplate');
      return new EnhancedTypeScriptTemplate();
    } catch (error) {
      console.warn('EnhancedTypeScriptTemplate not available:', error);
      return null;
    }
  }

  /**
   * Get template by framework preference
   */
  getTemplateByFramework(framework: string): Template | null {
    switch (framework.toLowerCase()) {
      case 'jest':
        return this.config.enableEnhanced 
          ? this.createEnhancedJestTemplate() || new JestJavaScriptTemplate()
          : new JestJavaScriptTemplate();

      case 'react':
        return this.config.enableEnhanced
          ? this.createEnhancedReactTemplate() || new JestReactComponentTemplate()
          : new JestReactComponentTemplate();

      case 'vue':
        return this.config.enableEnhanced
          ? this.createEnhancedVueTemplate()
          : null;

      case 'angular':
        return this.config.enableEnhanced
          ? this.createEnhancedAngularTemplate()
          : null;

      case 'express':
        return new JestExpressApiTemplate();

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
}