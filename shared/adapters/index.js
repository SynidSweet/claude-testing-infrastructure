/**
 * Language Adapters Module
 * 
 * This module exports all language adapters and the adapter factory.
 * It provides a centralized way to access adapter functionality for
 * different programming languages and project types.
 * 
 * @module shared/adapters
 */

// Base classes
const { BaseProjectAdapter, BaseTestConfigurator, BaseTemplateProvider } = require('./base');

// Language-specific adapters
const JavaScriptAdapter = require('./javascript/JavaScriptAdapter');
const PythonAdapter = require('./python/PythonAdapter');

// Factory
const { AdapterFactory, adapterFactory, MultiLanguageAdapter } = require('./AdapterFactory');

module.exports = {
  // Base classes (for extending)
  BaseProjectAdapter,
  BaseTestConfigurator,
  BaseTemplateProvider,
  
  // Language adapters
  JavaScriptAdapter,
  PythonAdapter,
  
  // Factory and utilities
  AdapterFactory,
  adapterFactory, // Singleton instance
  MultiLanguageAdapter,
  
  // Convenience methods
  
  /**
   * Get adapter for a project
   * @param {string} projectPath - Project path
   * @returns {Promise<IProjectAdapter>} Appropriate adapter
   */
  getAdapter: (projectPath) => adapterFactory.getAdapter(projectPath),
  
  /**
   * Get adapter by language
   * @param {string} language - Language name
   * @returns {IProjectAdapter} Language adapter
   */
  getAdapterByLanguage: (language) => adapterFactory.getAdapterByLanguage(language),
  
  /**
   * Register a custom adapter
   * @param {string} language - Language name
   * @param {Class} AdapterClass - Adapter class
   */
  registerAdapter: (language, AdapterClass) => adapterFactory.registerAdapter(language, AdapterClass),
  
  /**
   * Get supported languages
   * @returns {string[]} Supported languages
   */
  getSupportedLanguages: () => adapterFactory.getSupportedLanguages()
};