/**
 * Base Test Configurator Implementation
 * 
 * This abstract base class provides common functionality for test configuration
 * generation across different languages and test runners. It handles shared
 * configuration logic while delegating language-specific details to subclasses.
 * 
 * @abstract
 * @implements {ITestConfigurator}
 */

const fs = require('fs-extra');
const path = require('path');
const { ITestConfigurator } = require('../../interfaces');

class BaseTestConfigurator extends ITestConfigurator {
  constructor() {
    super();
    this.defaultConfigs = new Map();
  }

  /**
   * Merge configurations with intelligent conflict resolution
   * @param {Object} existingConfig - Existing configuration
   * @param {Object} newConfig - New configuration to merge
   * @returns {Object} Merged configuration
   */
  mergeConfigurations(existingConfig, newConfig) {
    return this.deepMerge(existingConfig, newConfig);
  }

  /**
   * Validate configuration with base rules
   * @param {Object} config - Configuration to validate
   * @returns {ValidationResult} Validation results
   */
  validateConfiguration(config) {
    const errors = [];
    const warnings = [];
    const suggestions = {};

    // Base validation rules
    if (!config || typeof config !== 'object') {
      errors.push('Configuration must be an object');
      return { valid: false, errors, warnings, suggestions };
    }

    // Validate test patterns if present
    if (config.testPatterns) {
      if (!Array.isArray(config.testPatterns) && typeof config.testPatterns !== 'object') {
        errors.push('testPatterns must be an array or object');
      }
    }

    // Validate coverage configuration
    if (config.coverage) {
      const coverage = config.coverage;
      if (coverage.threshold) {
        const threshold = coverage.threshold;
        ['lines', 'functions', 'branches', 'statements'].forEach(metric => {
          if (metric in threshold) {
            const value = threshold[metric];
            if (typeof value !== 'number' || value < 0 || value > 100) {
              errors.push(`Coverage threshold for ${metric} must be a number between 0 and 100`);
            }
          }
        });
      }
    }

    // Run language-specific validation
    const specificValidation = this.validateLanguageSpecific(config);
    errors.push(...specificValidation.errors);
    warnings.push(...specificValidation.warnings);
    Object.assign(suggestions, specificValidation.suggestions);

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      suggestions
    };
  }

  /**
   * Generate CI/CD configuration with common patterns
   * @param {string} platform - CI/CD platform
   * @param {TestConfiguration} config - Test configuration
   * @returns {Promise<ConfigFile>} CI/CD configuration file
   */
  async generateCIConfig(platform, config) {
    const generators = {
      github: () => this.generateGitHubActions(config),
      gitlab: () => this.generateGitLabCI(config),
      circleci: () => this.generateCircleCI(config),
      jenkins: () => this.generateJenkinsfile(config),
      travis: () => this.generateTravisCI(config)
    };

    const generator = generators[platform.toLowerCase()];
    if (!generator) {
      throw new Error(`Unsupported CI/CD platform: ${platform}`);
    }

    return await generator();
  }

  /**
   * Optimize configuration based on project characteristics
   * @param {Object} config - Base configuration
   * @param {ProjectAnalysis} analysis - Project analysis
   * @returns {Object} Optimized configuration
   */
  optimizeConfiguration(config, analysis) {
    const optimized = { ...config };

    // Optimize based on project size
    const projectSize = this.estimateProjectSize(analysis);
    if (projectSize === 'large') {
      // For large projects, use parallel execution
      if (optimized.maxWorkers === undefined) {
        optimized.maxWorkers = 4;
      }
      // Increase timeouts
      if (optimized.testTimeout === undefined) {
        optimized.testTimeout = 30000;
      }
    }

    // Optimize based on test count
    if (analysis.existingTests && analysis.existingTests.testFiles.length > 100) {
      // Enable test result caching
      if (optimized.cache === undefined) {
        optimized.cache = true;
      }
    }

    // Add language-specific optimizations
    return this.optimizeLanguageSpecific(optimized, analysis);
  }

  /**
   * Generate GitHub Actions workflow
   * @protected
   * @param {TestConfiguration} config - Test configuration
   * @returns {Promise<ConfigFile>} GitHub Actions workflow file
   */
  async generateGitHubActions(config) {
    const workflow = {
      name: 'Tests',
      on: {
        push: {
          branches: ['main', 'master', 'develop']
        },
        pull_request: {
          branches: ['main', 'master', 'develop']
        }
      },
      jobs: {
        test: {
          'runs-on': 'ubuntu-latest',
          strategy: {
            matrix: this.getTestMatrix(config)
          },
          steps: await this.getGitHubActionsSteps(config)
        }
      }
    };

    return {
      filename: '.github/workflows/test.yml',
      content: this.yamlStringify(workflow),
      format: 'yaml',
      encoding: 'utf8',
      targetPath: '.github/workflows'
    };
  }

  /**
   * Generate GitLab CI configuration
   * @protected
   * @param {TestConfiguration} config - Test configuration
   * @returns {Promise<ConfigFile>} GitLab CI configuration file
   */
  async generateGitLabCI(config) {
    const ciConfig = {
      stages: ['test', 'coverage'],
      variables: {
        ...this.getCIVariables(config)
      },
      test: {
        stage: 'test',
        script: await this.getTestCommands(config),
        artifacts: {
          reports: {
            junit: this.getJUnitReportPath(config),
            coverage_report: {
              coverage_format: 'cobertura',
              path: this.getCoverageReportPath(config)
            }
          }
        }
      }
    };

    return {
      filename: '.gitlab-ci.yml',
      content: this.yamlStringify(ciConfig),
      format: 'yaml',
      encoding: 'utf8',
      targetPath: '.'
    };
  }

  // Utility methods

  /**
   * Deep merge objects with array concatenation
   * @protected
   * @param {Object} target - Target object
   * @param {Object} source - Source object
   * @returns {Object} Merged object
   */
  deepMerge(target, source) {
    const output = { ...target };
    
    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
          if (target[key] && typeof target[key] === 'object' && !Array.isArray(target[key])) {
            output[key] = this.deepMerge(target[key], source[key]);
          } else {
            output[key] = source[key];
          }
        } else if (Array.isArray(source[key])) {
          if (Array.isArray(target[key])) {
            // Concatenate arrays and remove duplicates
            output[key] = [...new Set([...target[key], ...source[key]])];
          } else {
            output[key] = source[key];
          }
        } else {
          output[key] = source[key];
        }
      }
    }
    
    return output;
  }

  /**
   * Convert object to YAML string
   * @protected
   * @param {Object} obj - Object to convert
   * @returns {string} YAML string
   */
  yamlStringify(obj) {
    // Simple YAML stringification (in production, use a proper YAML library)
    const indent = (str, spaces) => str.split('\n').map(line => ' '.repeat(spaces) + line).join('\n');
    
    const stringify = (obj, level = 0) => {
      if (obj === null || obj === undefined) return 'null';
      if (typeof obj === 'string') return obj.includes(':') || obj.includes('#') ? `"${obj}"` : obj;
      if (typeof obj === 'number' || typeof obj === 'boolean') return String(obj);
      
      if (Array.isArray(obj)) {
        return obj.map(item => `\n${' '.repeat(level * 2)}- ${stringify(item, level + 1)}`).join('');
      }
      
      if (typeof obj === 'object') {
        return Object.entries(obj)
          .map(([key, value]) => {
            const valueStr = stringify(value, level + 1);
            if (valueStr.startsWith('\n')) {
              return `\n${' '.repeat(level * 2)}${key}:${valueStr}`;
            }
            return `\n${' '.repeat(level * 2)}${key}: ${valueStr}`;
          })
          .join('');
      }
      
      return String(obj);
    };
    
    return stringify(obj).trim();
  }

  /**
   * Estimate project size based on analysis
   * @protected
   * @param {ProjectAnalysis} analysis - Project analysis
   * @returns {string} Size estimate (small, medium, large)
   */
  estimateProjectSize(analysis) {
    // Simple heuristic based on file count and structure
    const fileCount = analysis.structure.sourceDirs.length * 50; // Rough estimate
    if (fileCount < 100) return 'small';
    if (fileCount < 500) return 'medium';
    return 'large';
  }

  // Abstract methods to be implemented by subclasses

  /**
   * Language-specific validation
   * @abstract
   * @protected
   * @param {Object} config - Configuration to validate
   * @returns {ValidationResult} Language-specific validation results
   */
  validateLanguageSpecific(config) {
    return { errors: [], warnings: [], suggestions: {} };
  }

  /**
   * Language-specific optimization
   * @abstract
   * @protected
   * @param {Object} config - Configuration to optimize
   * @param {ProjectAnalysis} analysis - Project analysis
   * @returns {Object} Optimized configuration
   */
  optimizeLanguageSpecific(config, analysis) {
    return config;
  }

  /**
   * Get test matrix for CI
   * @abstract
   * @protected
   * @param {TestConfiguration} config - Test configuration
   * @returns {Object} Test matrix configuration
   */
  getTestMatrix(config) {
    throw new Error('getTestMatrix must be implemented by subclass');
  }

  /**
   * Get CI steps for GitHub Actions
   * @abstract
   * @protected
   * @param {TestConfiguration} config - Test configuration
   * @returns {Promise<Array>} Array of step configurations
   */
  async getGitHubActionsSteps(config) {
    throw new Error('getGitHubActionsSteps must be implemented by subclass');
  }

  /**
   * Get test commands for CI
   * @abstract
   * @protected
   * @param {TestConfiguration} config - Test configuration
   * @returns {Promise<string[]>} Array of test commands
   */
  async getTestCommands(config) {
    throw new Error('getTestCommands must be implemented by subclass');
  }

  /**
   * Get CI environment variables
   * @abstract
   * @protected
   * @param {TestConfiguration} config - Test configuration
   * @returns {Object} Environment variables
   */
  getCIVariables(config) {
    return {};
  }

  /**
   * Get JUnit report path
   * @abstract
   * @protected
   * @param {TestConfiguration} config - Test configuration
   * @returns {string} JUnit report path
   */
  getJUnitReportPath(config) {
    return 'test-results.xml';
  }

  /**
   * Get coverage report path
   * @abstract
   * @protected
   * @param {TestConfiguration} config - Test configuration
   * @returns {string} Coverage report path
   */
  getCoverageReportPath(config) {
    return 'coverage/cobertura-coverage.xml';
  }
}

module.exports = BaseTestConfigurator;