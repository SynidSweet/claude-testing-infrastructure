/**
 * Base Template Provider Implementation
 * 
 * This abstract base class provides common functionality for template management
 * across different languages and frameworks. It handles template loading,
 * variable substitution, and template generation.
 * 
 * @abstract
 * @implements {ITemplateProvider}
 */

const fs = require('fs-extra');
const path = require('path');
const { ITemplateProvider } = require('../../interfaces');

class BaseTemplateProvider extends ITemplateProvider {
  constructor(templatesRoot) {
    super();
    this.templatesRoot = templatesRoot;
    this.templateCache = new Map();
    this.variablePattern = /\{\{(\w+)\}\}/g;
  }

  /**
   * Get template categories
   * @returns {string[]} Available template categories
   */
  getTemplateCategories() {
    return [
      'unit',
      'integration',
      'e2e',
      'component',
      'api',
      'performance',
      'security',
      'accessibility',
      'snapshot',
      'fixture',
      'mock',
      'setup',
      'config'
    ];
  }

  /**
   * Load a specific template by name with caching
   * @param {string} templateName - Name of the template
   * @returns {Promise<TemplateContent>} Template content
   */
  async loadTemplate(templateName) {
    // Check cache first
    if (this.templateCache.has(templateName)) {
      return this.templateCache.get(templateName);
    }

    // Find template file
    const templatePath = await this.findTemplatePath(templateName);
    if (!templatePath) {
      throw new Error(`Template not found: ${templateName}`);
    }

    // Load template content
    const content = await fs.readFile(templatePath, 'utf8');
    
    // Extract variables
    const variables = this.extractVariables(content);
    
    // Load metadata if exists
    const metadataPath = templatePath.replace(/\.[^.]+$/, '.meta.json');
    const metadata = await this.loadMetadata(metadataPath);

    const templateContent = {
      name: templateName,
      content,
      variables,
      metadata
    };

    // Cache the template
    this.templateCache.set(templateName, templateContent);

    return templateContent;
  }

  /**
   * Process template with variable substitution
   * @param {TemplateContent} template - Template to process
   * @param {Object} variables - Variables to substitute
   * @returns {Promise<string>} Processed template content
   */
  async processTemplate(template, variables) {
    let processed = template.content;

    // Validate required variables
    const missingVars = [];
    for (const varDef of template.variables) {
      if (varDef.required && !(varDef.name in variables)) {
        if (!varDef.defaultValue) {
          missingVars.push(varDef.name);
        }
      }
    }

    if (missingVars.length > 0) {
      throw new Error(`Missing required variables: ${missingVars.join(', ')}`);
    }

    // Create variable map with defaults
    const varMap = {};
    for (const varDef of template.variables) {
      varMap[varDef.name] = variables[varDef.name] || varDef.defaultValue || '';
    }

    // Apply custom processors
    const processedVars = await this.processVariables(varMap, template);

    // Substitute variables
    processed = processed.replace(this.variablePattern, (match, varName) => {
      return processedVars[varName] || match;
    });

    // Apply post-processing
    processed = await this.postProcessTemplate(processed, template, processedVars);

    return processed;
  }

  /**
   * Generate test file from template
   * @param {string} templateName - Template to use
   * @param {Object} context - Context for generation
   * @returns {Promise<GeneratedFile>} Generated test file
   */
  async generateFromTemplate(templateName, context) {
    // Load template
    const template = await this.loadTemplate(templateName);

    // Process template
    const content = await this.processTemplate(template, context.variables || {});

    // Determine filename
    const filename = await this.generateFilename(template, context);

    // Determine target path
    const targetPath = await this.generateTargetPath(template, context);

    return {
      filename,
      content,
      targetPath,
      metadata: {
        template: templateName,
        generatedAt: new Date().toISOString(),
        context: context.metadata || {}
      }
    };
  }

  /**
   * Register a new template
   * @param {TemplateInfo} templateInfo - Template information
   * @param {string} content - Template content
   * @returns {Promise<void>}
   */
  async registerTemplate(templateInfo, content) {
    // Validate template info
    if (!templateInfo.name || !templateInfo.category || !templateInfo.language) {
      throw new Error('Template must have name, category, and language');
    }

    // Determine path for new template
    const templatePath = path.join(
      this.templatesRoot,
      templateInfo.language,
      templateInfo.category,
      `${templateInfo.name}.template`
    );

    // Ensure directory exists
    await fs.ensureDir(path.dirname(templatePath));

    // Write template content
    await fs.writeFile(templatePath, content, 'utf8');

    // Write metadata
    const metadataPath = templatePath.replace(/\.[^.]+$/, '.meta.json');
    await fs.writeJson(metadataPath, {
      ...templateInfo,
      registeredAt: new Date().toISOString()
    }, { spaces: 2 });

    // Clear cache
    this.templateCache.delete(templateInfo.name);
  }

  /**
   * Get template variables that need to be filled
   * @param {string} templateName - Name of the template
   * @returns {Promise<TemplateVariable[]>} Required variables
   */
  async getTemplateVariables(templateName) {
    const template = await this.loadTemplate(templateName);
    return template.variables;
  }

  // Protected utility methods

  /**
   * Extract variables from template content
   * @protected
   * @param {string} content - Template content
   * @returns {TemplateVariable[]} Extracted variables
   */
  extractVariables(content) {
    const variables = new Map();
    const matches = content.matchAll(this.variablePattern);

    for (const match of matches) {
      const varName = match[1];
      if (!variables.has(varName)) {
        variables.set(varName, {
          name: varName,
          description: `Variable: ${varName}`,
          type: 'string',
          defaultValue: null,
          required: true,
          validValues: []
        });
      }
    }

    return Array.from(variables.values());
  }

  /**
   * Load template metadata
   * @protected
   * @param {string} metadataPath - Path to metadata file
   * @returns {Promise<Object>} Metadata object
   */
  async loadMetadata(metadataPath) {
    try {
      return await fs.readJson(metadataPath);
    } catch {
      return {};
    }
  }

  /**
   * Process variables before substitution
   * @protected
   * @param {Object} variables - Raw variables
   * @param {TemplateContent} template - Template being processed
   * @returns {Promise<Object>} Processed variables
   */
  async processVariables(variables, template) {
    const processed = { ...variables };

    // Apply type conversions
    for (const varDef of template.variables) {
      if (varDef.name in processed) {
        processed[varDef.name] = this.convertVariableType(
          processed[varDef.name],
          varDef.type
        );
      }
    }

    // Apply language-specific processing
    return this.processVariablesLanguageSpecific(processed, template);
  }

  /**
   * Convert variable to specified type
   * @protected
   * @param {*} value - Value to convert
   * @param {string} type - Target type
   * @returns {*} Converted value
   */
  convertVariableType(value, type) {
    switch (type) {
      case 'boolean':
        return Boolean(value);
      case 'number':
        return Number(value);
      case 'array':
        return Array.isArray(value) ? value : [value];
      case 'object':
        return typeof value === 'object' ? value : { value };
      default:
        return String(value);
    }
  }

  /**
   * Generate filename for the test file
   * @protected
   * @param {TemplateContent} template - Template being used
   * @param {Object} context - Generation context
   * @returns {Promise<string>} Generated filename
   */
  async generateFilename(template, context) {
    const baseFilename = context.filename || 
      context.targetName || 
      template.metadata.defaultFilename ||
      'test';

    return this.generateFilenameLanguageSpecific(baseFilename, template, context);
  }

  /**
   * Generate target path for the test file
   * @protected
   * @param {TemplateContent} template - Template being used
   * @param {Object} context - Generation context
   * @returns {Promise<string>} Target path
   */
  async generateTargetPath(template, context) {
    if (context.targetPath) {
      return context.targetPath;
    }

    return this.generateTargetPathLanguageSpecific(template, context);
  }

  // Abstract methods to be implemented by subclasses

  /**
   * Find template path based on template name
   * @abstract
   * @protected
   * @param {string} templateName - Name of the template
   * @returns {Promise<string|null>} Template file path
   */
  async findTemplatePath(templateName) {
    throw new Error('findTemplatePath must be implemented by subclass');
  }

  /**
   * Process variables with language-specific logic
   * @abstract
   * @protected
   * @param {Object} variables - Variables to process
   * @param {TemplateContent} template - Template being processed
   * @returns {Promise<Object>} Processed variables
   */
  async processVariablesLanguageSpecific(variables, template) {
    return variables;
  }

  /**
   * Post-process template content
   * @abstract
   * @protected
   * @param {string} content - Processed content
   * @param {TemplateContent} template - Template being processed
   * @param {Object} variables - Variables used
   * @returns {Promise<string>} Post-processed content
   */
  async postProcessTemplate(content, template, variables) {
    return content;
  }

  /**
   * Generate filename with language-specific conventions
   * @abstract
   * @protected
   * @param {string} baseFilename - Base filename
   * @param {TemplateContent} template - Template being used
   * @param {Object} context - Generation context
   * @returns {Promise<string>} Generated filename
   */
  async generateFilenameLanguageSpecific(baseFilename, template, context) {
    throw new Error('generateFilenameLanguageSpecific must be implemented by subclass');
  }

  /**
   * Generate target path with language-specific conventions
   * @abstract
   * @protected
   * @param {TemplateContent} template - Template being used
   * @param {Object} context - Generation context
   * @returns {Promise<string>} Target path
   */
  async generateTargetPathLanguageSpecific(template, context) {
    throw new Error('generateTargetPathLanguageSpecific must be implemented by subclass');
  }
}

module.exports = BaseTemplateProvider;