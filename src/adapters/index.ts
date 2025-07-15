/**
 * Adapters module
 *
 * This module contains adapters for integrating with different testing frameworks and tools
 */

// Base adapter interface for language-specific test generation
export interface LanguageAdapter {
  name: string;
  supportedLanguages: string[];
  detectFrameworks(projectPath: string): Promise<string[]>;
  generateTests(files: string[]): Promise<AdapterTestGenerationResult>;
  getTestRunner(): AdapterTestRunner;
}

export interface AdapterTestGenerationResult {
  success: boolean;
  testFiles: AdapterTestFile[];
  errors?: string[];
}

export interface AdapterTestFile {
  path: string;
  content: string;
  framework: string;
}

export interface AdapterTestRunner {
  name: string;
  run(testPath: string): Promise<AdapterTestRunResult>;
}

export interface AdapterTestRunResult {
  success: boolean;
  passed: number;
  failed: number;
  skipped: number;
  coverage?: AdapterCoverageResult;
}

export interface AdapterCoverageResult {
  statements: number;
  branches: number;
  functions: number;
  lines: number;
}

// Framework adapter interface for test framework integration
export interface FrameworkAdapter {
  name: string;
  framework: string;
  adapt(source: unknown): Promise<AdapterResult>;
}

export interface AdapterResult {
  success: boolean;
  output?: unknown;
  errors?: string[];
}

// Registry of available adapters
const languageAdapters = new Map<string, LanguageAdapter>();
const frameworkAdapters = new Map<string, FrameworkAdapter>();

// Register a language adapter
export function registerLanguageAdapter(language: string, adapter: LanguageAdapter): void {
  languageAdapters.set(language.toLowerCase(), adapter);
}

// Register a framework adapter
export function registerFrameworkAdapter(framework: string, adapter: FrameworkAdapter): void {
  frameworkAdapters.set(framework.toLowerCase(), adapter);
}

// Get a language adapter by language name with dynamic loading
export async function getLanguageAdapter(language: string): Promise<LanguageAdapter | null> {
  const normalizedLanguage = language.toLowerCase();

  // Check if adapter is already registered
  const existingAdapter = languageAdapters.get(normalizedLanguage);
  if (existingAdapter) {
    return existingAdapter;
  }

  // Try to dynamically load and register the adapter
  try {
    const adapter = await loadLanguageAdapter(normalizedLanguage);
    if (adapter) {
      registerLanguageAdapter(normalizedLanguage, adapter);
      return adapter;
    }
  } catch (error) {
    console.warn(`Failed to load adapter for language '${language}':`, error);
  }

  return null;
}

// Synchronous version for backward compatibility
export function getLanguageAdapterSync(language: string): LanguageAdapter | null {
  return languageAdapters.get(language.toLowerCase()) ?? null;
}

// Get a framework adapter by framework name
export function getAdapter(framework: string): FrameworkAdapter | null {
  return frameworkAdapters.get(framework.toLowerCase()) ?? null;
}

/**
 * Dynamically load a language adapter
 */
async function loadLanguageAdapter(language: string): Promise<LanguageAdapter | null> {
  switch (language) {
    case 'javascript':
    case 'typescript':
      try {
        const { JavaScriptAdapter } = await import('./JavaScriptAdapter');
        return new JavaScriptAdapter();
      } catch (error) {
        console.warn('Failed to load JavaScriptAdapter:', error);
        return null;
      }

    case 'python':
      try {
        const { PythonAdapter } = await import('./PythonAdapter');
        return new PythonAdapter();
      } catch (error) {
        console.warn('Failed to load PythonAdapter:', error);
        return null;
      }

    default:
      console.warn(`No adapter available for language: ${language}`);
      return null;
  }
}

/**
 * Initialize all available adapters
 * This function pre-loads all adapters for better performance
 */
export async function initializeAdapters(): Promise<void> {
  const supportedLanguages = ['javascript', 'typescript', 'python'];

  for (const language of supportedLanguages) {
    try {
      const adapter = await loadLanguageAdapter(language);
      if (adapter) {
        registerLanguageAdapter(language, adapter);
      }
    } catch (error) {
      console.warn(`Failed to initialize adapter for ${language}:`, error);
    }
  }
}

/**
 * Get all registered language adapters
 */
export function getRegisteredLanguageAdapters(): Map<string, LanguageAdapter> {
  return new Map(languageAdapters);
}

/**
 * Get all registered framework adapters
 */
export function getRegisteredFrameworkAdapters(): Map<string, FrameworkAdapter> {
  return new Map(frameworkAdapters);
}

/**
 * Check if a language adapter is registered
 */
export function hasLanguageAdapter(language: string): boolean {
  return languageAdapters.has(language.toLowerCase());
}

/**
 * Check if a framework adapter is registered
 */
export function hasFrameworkAdapter(framework: string): boolean {
  return frameworkAdapters.has(framework.toLowerCase());
}

/**
 * Get supported languages
 */
export function getSupportedLanguages(): string[] {
  return Array.from(languageAdapters.keys());
}

/**
 * Get supported frameworks from adapters
 */
export function getAdapterSupportedFrameworks(): string[] {
  return Array.from(frameworkAdapters.keys());
}

/**
 * Clear all registered adapters (useful for testing)
 */
export function clearAdapters(): void {
  languageAdapters.clear();
  frameworkAdapters.clear();
}

// Export adapter registries for external access
export const adapters = {
  language: languageAdapters,
  framework: frameworkAdapters,
};
