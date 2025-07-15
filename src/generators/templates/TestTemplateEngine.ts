import { TestType } from '../TestGenerator';
import type { JavaScriptContext, PythonContext, FrameworkDetectionResult } from '../types/contexts';
import { TemplateRegistry } from './core/TemplateRegistry';
import { TemplateOrchestrator } from './TemplateOrchestrator';

/**
 * Core template context interface with essential properties
 */
export interface BaseTemplateContext {
  moduleName: string;
  modulePath?: string | undefined;
  imports: string[];
  exports: string[];
  hasDefaultExport: boolean;
  testType: TestType;
  framework: string;
  language: 'javascript' | 'typescript' | 'python';
  isAsync: boolean;
  isComponent: boolean;
  dependencies: string[];
  moduleSystem?: 'commonjs' | 'esm' | 'mixed' | undefined;
}

/**
 * Enhanced template context with rich framework and language-specific metadata
 */
export interface EnhancedTemplateContext extends BaseTemplateContext {
  /** Rich framework detection information */
  frameworkInfo?: FrameworkDetectionResult | undefined;
  /** Language-specific context data */
  languageContext?: JavaScriptContext | PythonContext | undefined;
  /** Additional metadata for enhanced templates */
  metadata?: TemplateMetadata | undefined;
}

/**
 * Template metadata for advanced template features
 */
export interface TemplateMetadata {
  /** File path being tested */
  sourceFilePath: string;
  /** Output file path for the test */
  outputFilePath: string;
  /** Custom template variables */
  variables?: Record<string, unknown>;
  /** Framework-specific options */
  frameworkOptions?: Record<string, unknown>;
  /** Test generation options */
  generationOptions?: TestGenerationOptions;
}

/**
 * Test generation options for template customization
 */
export interface TestGenerationOptions {
  /** Whether to generate setup/teardown methods */
  includeSetup?: boolean;
  /** Whether to generate mock utilities */
  includeMocks?: boolean;
  /** Whether to generate async test helpers */
  includeAsyncHelpers?: boolean;
  /** Maximum number of test cases to generate */
  maxTestCases?: number;
  /** Custom test patterns to include */
  customPatterns?: string[];
}

/**
 * Union type for backward compatibility
 */
export type TemplateContext = BaseTemplateContext | EnhancedTemplateContext;

/**
 * Type guard to check if context is enhanced
 */
export function isEnhancedTemplateContext(
  context: TemplateContext
): context is EnhancedTemplateContext {
  return 'frameworkInfo' in context || 'languageContext' in context || 'metadata' in context;
}

/**
 * Template interface with enhanced type safety
 */
export interface Template {
  name: string;
  language: 'javascript' | 'typescript' | 'python';
  framework?: string;
  testType?: TestType;
  /** Generate test content from context */
  generate(context: TemplateContext): string;
  /** Validate context before generation (optional) */
  validateContext?(context: TemplateContext): ValidationResult;
  /** Get template metadata (optional) */
  getMetadata?(): TemplateInfo;
}

/**
 * Template validation result
 */
export interface ValidationResult {
  isValid: boolean;
  errors?: string[] | undefined;
  warnings?: string[] | undefined;
}

/**
 * Template information for discovery and documentation
 */
export interface TemplateInfo {
  name: string;
  description: string;
  language: 'javascript' | 'typescript' | 'python';
  framework?: string | undefined;
  testType?: TestType | undefined;
  supportedFeatures: string[];
  version: string;
}

/**
 * TestTemplateEngine - Simplified facade over TemplateOrchestrator
 *
 * This class maintains backward compatibility while delegating
 * all functionality to the new TemplateOrchestrator pattern.
 */
export class TestTemplateEngine {
  private orchestrator: TemplateOrchestrator;

  constructor() {
    this.orchestrator = new TemplateOrchestrator();
  }

  /**
   * Register a template
   */
  registerTemplate(template: Template, allowOverride: boolean = false): void {
    this.orchestrator.registerTemplate(template, allowOverride);
  }

  /**
   * Generate test content using the most appropriate template with validation
   */
  generateTest(context: TemplateContext): string {
    return this.orchestrator.generateTest(context);
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
    return this.orchestrator.generateTestSafe(context);
  }

  /**
   * Get template information for a given context
   */
  getTemplateInfo(context: TemplateContext): TemplateInfo | undefined {
    return this.orchestrator.getTemplateInfo(context);
  }

  /**
   * Get access to the internal TemplateRegistry for advanced use cases
   */
  getRegistry(): TemplateRegistry {
    return this.orchestrator.getRegistry();
  }

  /**
   * List all registered templates with their metadata
   */
  listTemplates(): TemplateInfo[] {
    return this.orchestrator.listTemplates();
  }
}

// Export template classes from their new modular locations for backward compatibility
export {
  JestJavaScriptTemplate,
  JestReactComponentTemplate,
  JestExpressApiTemplate,
  JestTypeScriptTemplate,
  JestReactTypeScriptTemplate,
} from './javascript';

export { PytestTemplate, PytestFastApiTemplate, PytestDjangoTemplate } from './python';

// Re-export the orchestrator for advanced usage
export { TemplateOrchestrator } from './TemplateOrchestrator';
