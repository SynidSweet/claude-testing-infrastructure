/**
 * Template Provider Interface
 * 
 * This interface defines the contract for providing and managing test templates.
 * It handles template discovery, variable substitution, and template generation
 * for different types of tests and frameworks.
 * 
 * @interface ITemplateProvider
 * @version 1.0.0
 */

class ITemplateProvider {
  /**
   * Get available templates for a given project analysis
   * @param {ProjectAnalysis} analysis - Project analysis results
   * @returns {Promise<TemplateInfo[]>} Available templates
   */
  async getAvailableTemplates(analysis) {
    throw new Error('Method getAvailableTemplates must be implemented');
  }

  /**
   * Load a specific template by name
   * @param {string} templateName - Name of the template
   * @returns {Promise<TemplateContent>} Template content
   */
  async loadTemplate(templateName) {
    throw new Error('Method loadTemplate must be implemented');
  }

  /**
   * Process template with variable substitution
   * @param {TemplateContent} template - Template to process
   * @param {Object} variables - Variables to substitute
   * @returns {Promise<string>} Processed template content
   */
  async processTemplate(template, variables) {
    throw new Error('Method processTemplate must be implemented');
  }

  /**
   * Generate test file from template
   * @param {string} templateName - Template to use
   * @param {Object} context - Context for generation
   * @returns {Promise<GeneratedFile>} Generated test file
   */
  async generateFromTemplate(templateName, context) {
    throw new Error('Method generateFromTemplate must be implemented');
  }

  /**
   * Get template categories
   * @returns {string[]} Available template categories
   */
  getTemplateCategories() {
    throw new Error('Method getTemplateCategories must be implemented');
  }

  /**
   * Register a new template
   * @param {TemplateInfo} templateInfo - Template information
   * @param {string} content - Template content
   * @returns {Promise<void>}
   */
  async registerTemplate(templateInfo, content) {
    throw new Error('Method registerTemplate must be implemented');
  }

  /**
   * Get template variables that need to be filled
   * @param {string} templateName - Name of the template
   * @returns {Promise<TemplateVariable[]>} Required variables
   */
  async getTemplateVariables(templateName) {
    throw new Error('Method getTemplateVariables must be implemented');
  }
}

/**
 * @typedef {Object} TemplateInfo
 * @property {string} name - Template name
 * @property {string} category - Template category (unit, integration, e2e, etc.)
 * @property {string} language - Target language
 * @property {string[]} frameworks - Compatible frameworks
 * @property {string} description - Template description
 * @property {string[]} tags - Template tags for searching
 * @property {string} path - Path to template file
 */

/**
 * @typedef {Object} TemplateContent
 * @property {string} name - Template name
 * @property {string} content - Raw template content
 * @property {TemplateVariable[]} variables - Variables used in template
 * @property {Object} metadata - Additional template metadata
 */

/**
 * @typedef {Object} TemplateVariable
 * @property {string} name - Variable name
 * @property {string} description - Variable description
 * @property {string} type - Variable type (string, boolean, array, etc.)
 * @property {*} defaultValue - Default value if not provided
 * @property {boolean} required - Whether variable is required
 * @property {string[]} validValues - Valid values for enum types
 */

/**
 * @typedef {Object} GeneratedFile
 * @property {string} filename - Generated filename
 * @property {string} content - File content
 * @property {string} targetPath - Where to place the file
 * @property {Object} metadata - Generation metadata
 */

module.exports = ITemplateProvider;