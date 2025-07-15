/**
 * Generators module
 *
 * This module contains test generators for different frameworks and patterns
 */

// Export the base TestGenerator class and related types
export { TestGenerator } from './TestGenerator';
export type {
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
export { StructuralTestGenerator } from './StructuralTestGenerator';
export type { StructuralTestGeneratorOptions } from './StructuralTestGenerator';

// Export base abstractions for language-specific generators
export { BaseTestGenerator } from './base/BaseTestGenerator';
export type {
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
export { TestTemplateEngine } from './templates/TestTemplateEngine';
export type { Template, TemplateContext } from './templates/TestTemplateEngine';
