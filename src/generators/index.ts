/**
 * Generators module
 *
 * This module contains test generators for different frameworks and patterns
 */

// Export the base TestGenerator class and related types
export {
  TestGenerator,
  TestGeneratorConfig,
  TestGeneratorOptions,
  TestGenerationResult,
  GeneratedTest,
  GeneratedFile,
  TestType,
  NamingConventions,
  GenerationStats,
} from './TestGenerator';

// Export concrete implementations
export { StructuralTestGenerator, StructuralTestGeneratorOptions } from './StructuralTestGenerator';

// Export base abstractions for language-specific generators
export {
  BaseTestGenerator,
  LanguageContext,
  LanguageFeatures,
  ImportStyle,
  TestingPattern,
  SourceFileAnalysis,
  ExportedItem,
  ImportStatement,
} from './base/BaseTestGenerator';

// Export factory for creating generators
export { TestGeneratorFactory } from './TestGeneratorFactory';

// Export context types for language-specific generators
export * from './types/contexts';

// Export template engine
export { TestTemplateEngine, Template, TemplateContext } from './templates/TestTemplateEngine';

// Legacy interfaces (deprecated - use TestGenerator instead)
export interface Generator {
  name: string;
  generate(config: GeneratorConfig): Promise<GeneratorResult>;
}

export interface GeneratorConfig {
  // Add configuration properties
  targetPath?: string;
  framework?: string;
  options?: Record<string, unknown>;
}

export interface GeneratorResult {
  success: boolean;
  files?: string[];
  errors?: string[];
}

// Placeholder function (deprecated - use TestGenerator instead)
export function generateTestsDeprecated(_config: GeneratorConfig): GeneratorResult {
  // TODO: Implement test generation logic
  return {
    success: true,
    files: [],
  };
}
