/**
 * Shared Interfaces for AI-First Testing Infrastructure
 * 
 * This module exports all shared interfaces that define the contracts
 * between different components of the testing infrastructure.
 * These interfaces ensure consistency across language adapters and
 * different testing approaches.
 * 
 * @module shared/interfaces
 * @version 1.0.0
 */

const IProjectAdapter = require('./IProjectAdapter');
const ITestConfigurator = require('./ITestConfigurator');
const ITemplateProvider = require('./ITemplateProvider');

/**
 * Interface version for compatibility checking
 */
const INTERFACE_VERSION = '1.0.0';

/**
 * Minimum compatible version for backward compatibility
 */
const MIN_COMPATIBLE_VERSION = '1.0.0';

module.exports = {
  // Core Interfaces
  IProjectAdapter,
  ITestConfigurator,
  ITemplateProvider,
  
  // Version Information
  INTERFACE_VERSION,
  MIN_COMPATIBLE_VERSION,
  
  // Type exports for documentation
  types: {
    ProjectAnalysis: 'See IProjectAdapter for ProjectAnalysis typedef',
    TestConfiguration: 'See IProjectAdapter for TestConfiguration typedef',
    Dependencies: 'See IProjectAdapter for Dependencies typedef',
    Template: 'See IProjectAdapter for Template typedef',
    ValidationResult: 'See IProjectAdapter for ValidationResult typedef',
    ConfigFile: 'See ITestConfigurator for ConfigFile typedef',
    TemplateInfo: 'See ITemplateProvider for TemplateInfo typedef',
    TemplateContent: 'See ITemplateProvider for TemplateContent typedef',
    GeneratedFile: 'See ITemplateProvider for GeneratedFile typedef'
  }
};