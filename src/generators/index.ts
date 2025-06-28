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
  GenerationStats
} from './TestGenerator';

// Export concrete implementations
export {
  StructuralTestGenerator,
  StructuralTestGeneratorOptions
} from './StructuralTestGenerator';

// Export template engine
export {
  TestTemplateEngine,
  Template,
  TemplateContext
} from './templates/TestTemplateEngine';

// Legacy interfaces (deprecated - use TestGenerator instead)
export interface Generator {
  name: string;
  generate(config: GeneratorConfig): Promise<GeneratorResult>;
}

export interface GeneratorConfig {
  // Add configuration properties
  targetPath?: string;
  framework?: string;
  options?: Record<string, any>;
}

export interface GeneratorResult {
  success: boolean;
  files?: string[];
  errors?: string[];
}

// Placeholder function (deprecated - use TestGenerator instead)
export async function generateTests(_config: GeneratorConfig): Promise<GeneratorResult> {
  // TODO: Implement test generation logic
  return {
    success: true,
    files: []
  };
}