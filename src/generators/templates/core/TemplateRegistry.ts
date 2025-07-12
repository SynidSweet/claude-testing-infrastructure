import type { Template, TemplateContext } from '../TestTemplateEngine';

/**
 * Template information for introspection and debugging
 */
export interface TemplateInfo {
  name: string;
  language: string;
  framework?: string | undefined;
  testType?: string | undefined;
  description?: string | undefined;
  supported: boolean;
}

/**
 * Template registration result
 */
export interface TemplateRegistrationResult {
  success: boolean;
  error?: string | undefined;
  existingTemplate?: TemplateInfo | undefined;
}

/**
 * Template search criteria for finding templates
 */
export interface TemplateSearchCriteria {
  language: string;
  framework?: string | undefined;
  testType?: string | undefined;
  exact?: boolean | undefined;
}

/**
 * Template matching result with confidence score
 */
export interface TemplateMatch {
  template: Template;
  confidence: number;
  matchType: 'exact' | 'framework' | 'type' | 'language' | 'fallback';
}

/**
 * Central registry for managing test generation templates
 *
 * Extracted from TestTemplateEngine to provide cleaner separation of concerns.
 * Handles template registration, discovery, and selection logic.
 */
export class TemplateRegistry {
  private templates: Map<string, Template> = new Map();
  private languageDefaults: Map<string, string> = new Map();

  constructor() {
    this.initializeLanguageDefaults();
  }

  /**
   * Initialize default frameworks for each language
   */
  private initializeLanguageDefaults(): void {
    this.languageDefaults.set('javascript', 'jest');
    this.languageDefaults.set('typescript', 'jest');
    this.languageDefaults.set('python', 'pytest');
  }

  /**
   * Register a template in the registry
   */
  registerTemplate(template: Template): TemplateRegistrationResult {
    if (!template || !template.name || !template.language) {
      return {
        success: false,
        error: 'Template must have name and language properties',
      };
    }

    const key = this.generateTemplateKey(template);
    const existingTemplate = this.templates.get(key);

    if (existingTemplate) {
      return {
        success: false,
        error: `Template with key '${key}' already exists`,
        existingTemplate: this.createTemplateInfo(existingTemplate),
      };
    }

    this.templates.set(key, template);
    return { success: true };
  }

  /**
   * Find the best template for the given context
   */
  findTemplate(context: TemplateContext): Template | undefined {
    const matches = this.findTemplateMatches(context);
    return matches.length > 0 ? matches[0]?.template : undefined;
  }

  /**
   * Find all matching templates with confidence scores
   */
  findTemplateMatches(context: TemplateContext): TemplateMatch[] {
    const matches: TemplateMatch[] = [];
    const criteria = this.contextToSearchCriteria(context);

    // 1. Try exact match first (language:framework:testType)
    if (criteria.framework && criteria.testType) {
      const exactTemplate = this.findExactMatch(criteria);
      if (exactTemplate) {
        matches.push({
          template: exactTemplate,
          confidence: 1.0,
          matchType: 'exact',
        });
      }
    }

    // 2. Try framework match (language:framework)
    if (criteria.framework) {
      const frameworkTemplate = this.findFrameworkMatch(criteria);
      if (frameworkTemplate && !matches.some((m) => m.template === frameworkTemplate)) {
        matches.push({
          template: frameworkTemplate,
          confidence: 0.8,
          matchType: 'framework',
        });
      }
    }

    // 3. Try test type match (language::testType)
    if (criteria.testType) {
      const typeTemplate = this.findTypeMatch(criteria);
      if (typeTemplate && !matches.some((m) => m.template === typeTemplate)) {
        matches.push({
          template: typeTemplate,
          confidence: 0.6,
          matchType: 'type',
        });
      }
    }

    // 4. Try default framework (language:defaultFramework)
    const defaultFramework = this.languageDefaults.get(criteria.language);
    if (defaultFramework) {
      const defaultTemplate = this.findFrameworkMatch({
        ...criteria,
        framework: defaultFramework,
      });
      if (defaultTemplate && !matches.some((m) => m.template === defaultTemplate)) {
        matches.push({
          template: defaultTemplate,
          confidence: 0.4,
          matchType: 'fallback',
        });
      }
    }

    // 5. Try language only match
    const languageTemplate = this.findLanguageMatch(criteria);
    if (languageTemplate && !matches.some((m) => m.template === languageTemplate)) {
      matches.push({
        template: languageTemplate,
        confidence: 0.2,
        matchType: 'language',
      });
    }

    return matches.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * List all registered templates
   */
  listTemplates(): TemplateInfo[] {
    return Array.from(this.templates.values()).map((template) => this.createTemplateInfo(template));
  }

  /**
   * Get template by exact key
   */
  getTemplate(key: string): Template | undefined {
    return this.templates.get(key);
  }

  /**
   * Get templates by language
   */
  getTemplatesByLanguage(language: string): Template[] {
    return Array.from(this.templates.values()).filter((template) => template.language === language);
  }

  /**
   * Get templates by framework
   */
  getTemplatesByFramework(framework: string): Template[] {
    return Array.from(this.templates.values()).filter(
      (template) => template.framework === framework
    );
  }

  /**
   * Check if a template is registered
   */
  hasTemplate(criteria: TemplateSearchCriteria): boolean {
    return this.findTemplate(criteria as TemplateContext) !== undefined;
  }

  /**
   * Clear all templates (for testing)
   */
  clear(): void {
    this.templates.clear();
  }

  /**
   * Get registry statistics
   */
  getStats(): {
    totalTemplates: number;
    languageCount: Map<string, number>;
    frameworkCount: Map<string, number>;
  } {
    const languageCount = new Map<string, number>();
    const frameworkCount = new Map<string, number>();

    for (const template of this.templates.values()) {
      languageCount.set(template.language, (languageCount.get(template.language) || 0) + 1);
      if (template.framework) {
        frameworkCount.set(template.framework, (frameworkCount.get(template.framework) || 0) + 1);
      }
    }

    return {
      totalTemplates: this.templates.size,
      languageCount,
      frameworkCount,
    };
  }

  // Private helper methods

  private generateTemplateKey(template: Template): string {
    return `${template.language}:${template.framework || ''}:${template.testType || ''}`;
  }

  private contextToSearchCriteria(context: TemplateContext): TemplateSearchCriteria {
    return {
      language: context.language,
      framework: context.framework,
      testType: context.testType,
    };
  }

  private findExactMatch(criteria: TemplateSearchCriteria): Template | undefined {
    const key = `${criteria.language}:${criteria.framework}:${criteria.testType}`;
    return this.templates.get(key);
  }

  private findFrameworkMatch(criteria: TemplateSearchCriteria): Template | undefined {
    const key = `${criteria.language}:${criteria.framework}:`;
    return this.templates.get(key);
  }

  private findTypeMatch(criteria: TemplateSearchCriteria): Template | undefined {
    const key = `${criteria.language}::${criteria.testType}`;
    return this.templates.get(key);
  }

  private findLanguageMatch(criteria: TemplateSearchCriteria): Template | undefined {
    const key = `${criteria.language}::`;
    return this.templates.get(key);
  }

  private createTemplateInfo(template: Template): TemplateInfo {
    return {
      name: template.name,
      language: template.language,
      framework: template.framework || undefined,
      testType: template.testType || undefined,
      description: template.getMetadata?.()?.description || undefined,
      supported: true,
    };
  }
}
