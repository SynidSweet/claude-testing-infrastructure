/**
 * Shared Components for AI-First Testing Infrastructure
 * 
 * This module exports all shared components that are used by both
 * the template-based and decoupled approaches. It provides a unified
 * interface for accessing adapters, interfaces, and utilities.
 * 
 * @module shared
 */

// Export interfaces
const interfaces = require('./interfaces');

// Export adapters
const adapters = require('./adapters');

module.exports = {
  // Interfaces
  interfaces,
  IProjectAdapter: interfaces.IProjectAdapter,
  ITestConfigurator: interfaces.ITestConfigurator,
  ITemplateProvider: interfaces.ITemplateProvider,
  
  // Adapters
  adapters,
  AdapterFactory: adapters.AdapterFactory,
  adapterFactory: adapters.adapterFactory,
  JavaScriptAdapter: adapters.JavaScriptAdapter,
  PythonAdapter: adapters.PythonAdapter,
  MultiLanguageAdapter: adapters.MultiLanguageAdapter,
  
  // Convenience methods
  getAdapter: adapters.getAdapter,
  getAdapterByLanguage: adapters.getAdapterByLanguage,
  getSupportedLanguages: adapters.getSupportedLanguages,
  
  // Version info
  VERSION: '1.0.0',
  INTERFACE_VERSION: interfaces.INTERFACE_VERSION
};