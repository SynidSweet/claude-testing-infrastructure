/**
 * Base Adapter Classes
 * 
 * This module exports the abstract base classes that provide common
 * functionality for all language-specific adapters. These base classes
 * implement shared logic while defining abstract methods that must be
 * implemented by language-specific subclasses.
 * 
 * @module shared/adapters/base
 */

const BaseProjectAdapter = require('./BaseProjectAdapter');
const BaseTestConfigurator = require('./BaseTestConfigurator');
const BaseTemplateProvider = require('./BaseTemplateProvider');

module.exports = {
  BaseProjectAdapter,
  BaseTestConfigurator,
  BaseTemplateProvider
};