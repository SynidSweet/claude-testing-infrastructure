/**
 * Registration helper for language-specific generators
 *
 * This file registers all language-specific generators with the TestGeneratorFactory.
 * It should be called during CLI initialization to ensure generators are available.
 */

import { TestGeneratorFactory } from './TestGeneratorFactory';
import { JavaScriptTestGenerator } from './javascript/JavaScriptTestGenerator';

/**
 * Register all language-specific generators
 */
export function registerAllLanguageGenerators(): void {
  // Register JavaScript/TypeScript generator
  TestGeneratorFactory.registerLanguageGenerator('javascript', JavaScriptTestGenerator);
  TestGeneratorFactory.registerLanguageGenerator('typescript', JavaScriptTestGenerator);

  // Future: Register Python generator when implemented
  // TestGeneratorFactory.registerLanguageGenerator('python', PythonTestGenerator);
}

/**
 * Enable language-specific generators feature flag
 */
export function enableLanguageSpecificGenerators(): void {
  TestGeneratorFactory.setFeatureFlag(true);
}

/**
 * Complete initialization of language-specific generator system
 */
export function initializeLanguageSpecificGenerators(): void {
  registerAllLanguageGenerators();
  enableLanguageSpecificGenerators();
}
