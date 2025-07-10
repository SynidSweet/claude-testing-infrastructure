/**
 * Core template engine components
 * 
 * This module provides the foundational template system architecture
 * extracted from the monolithic TestTemplateEngine.ts for better
 * separation of concerns and maintainability.
 */

// Core engine and registry
export { TemplateEngine } from './TemplateEngine';
export { TemplateRegistry } from './TemplateRegistry';

// Template factory system
export { TemplateFactory, TemplateFactoryRegistry } from './TemplateFactory';
export { JavaScriptTemplateFactory } from './JavaScriptTemplateFactory';
export { PythonTemplateFactory } from './PythonTemplateFactory';

// Types and interfaces
export type {
  TemplateInfo,
  TemplateRegistrationResult,
  TemplateSearchCriteria,
  TemplateMatch
} from './TemplateRegistry';

export type {
  SafeGenerationResult,
  TemplateGenerationOptions,
  TemplateGenerationStats
} from './TemplateEngine';

export type {
  TemplateFactoryConfig,
  TemplateCreationRequest,
  TemplateCreationResult,
  TemplateFactoryCapabilities,
  TemplateFactoryRegistrationResult
} from './TemplateFactory';

// Re-export important types from the main template engine for compatibility
export type {
  Template,
  TemplateContext,
  BaseTemplateContext,
  EnhancedTemplateContext,
  TemplateMetadata,
  TestGenerationOptions,
  ValidationResult
} from '../TestTemplateEngine';

/**
 * Create a pre-configured template engine with registry
 */
export function createTemplateEngine() {
  const { TemplateRegistry } = require('./TemplateRegistry');
  const { TemplateEngine } = require('./TemplateEngine');
  const registry = new TemplateRegistry();
  return new TemplateEngine(registry);
}

/**
 * Create a template engine with custom registry
 */
export function createTemplateEngineWithRegistry(registry: any) {
  const { TemplateEngine } = require('./TemplateEngine');
  return new TemplateEngine(registry);
}

/**
 * Create a template engine with factory-based template registration
 */
export function createTemplateEngineWithFactories() {
  const { TemplateRegistry } = require('./TemplateRegistry');
  const { TemplateEngine } = require('./TemplateEngine');
  const { TemplateFactoryRegistry } = require('./TemplateFactory');
  const { JavaScriptTemplateFactory } = require('./JavaScriptTemplateFactory');
  const { PythonTemplateFactory } = require('./PythonTemplateFactory');

  // Create registries
  const templateRegistry = new TemplateRegistry();
  const factoryRegistry = new TemplateFactoryRegistry();

  // Register factories
  const jsFactory = new JavaScriptTemplateFactory();
  const pythonFactory = new PythonTemplateFactory();

  factoryRegistry.registerFactory(jsFactory);
  factoryRegistry.registerFactory(pythonFactory);

  // Auto-register templates from factories
  registerTemplatesFromFactories(templateRegistry, factoryRegistry);

  // Create engine
  const engine = new TemplateEngine(templateRegistry);

  // Add factory registry to engine for dynamic template creation
  (engine as any).factoryRegistry = factoryRegistry;

  return engine;
}

/**
 * Create a factory registry with default factories
 */
export function createDefaultFactoryRegistry() {
  const { TemplateFactoryRegistry } = require('./TemplateFactory');
  const { JavaScriptTemplateFactory } = require('./JavaScriptTemplateFactory');
  const { PythonTemplateFactory } = require('./PythonTemplateFactory');

  const factoryRegistry = new TemplateFactoryRegistry();
  
  // Register default factories
  factoryRegistry.registerFactory(new JavaScriptTemplateFactory());
  factoryRegistry.registerFactory(new PythonTemplateFactory());

  return factoryRegistry;
}

/**
 * Register all templates from factories into a template registry
 */
export function registerTemplatesFromFactories(templateRegistry: any, factoryRegistry: any): void {
  const factories = factoryRegistry.getAllFactories();

  for (const factory of factories) {
    try {
      // Register default templates
      const defaultTemplates = factory.getDefaultTemplates();
      for (const template of defaultTemplates) {
        const result = templateRegistry.registerTemplate(template);
        if (!result.success) {
          console.warn(`Failed to register template '${template.name}':`, result.error);
        }
      }

      // Register enhanced templates if supported
      const enhancedTemplates = factory.getEnhancedTemplates();
      for (const template of enhancedTemplates) {
        const result = templateRegistry.registerTemplate(template);
        if (!result.success) {
          console.warn(`Failed to register enhanced template '${template.name}':`, result.error);
        }
      }
    } catch (error) {
      console.warn(`Failed to register templates from factory '${factory.getFactoryName()}':`, error);
    }
  }
}

/**
 * Create a fully configured template system with factories and auto-registration
 */
export function createCompleteTemplateSystem() {
  const templateRegistry = new (require('./TemplateRegistry').TemplateRegistry)();
  const factoryRegistry = createDefaultFactoryRegistry();
  const templateEngine = new (require('./TemplateEngine').TemplateEngine)(templateRegistry);

  // Auto-register all templates
  registerTemplatesFromFactories(templateRegistry, factoryRegistry);

  return {
    templateEngine,
    templateRegistry,
    factoryRegistry,
    
    // Convenience methods
    createTemplate: (request: any) => factoryRegistry.createTemplate(request),
    listTemplates: () => templateRegistry.listTemplates(),
    getStats: () => ({
      templates: templateRegistry.getStats(),
      factories: factoryRegistry.getStats()
    })
  };
}