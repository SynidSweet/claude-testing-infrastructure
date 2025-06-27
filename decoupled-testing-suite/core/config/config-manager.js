/**
 * Configuration Manager
 * 
 * Handles loading, validation, saving, and merging of project configurations.
 * Implements the IConfigManager interface for stable API compatibility.
 */

const fs = require('fs-extra');
const path = require('path');
const Ajv = require('ajv');
const addFormats = require('ajv-formats');
const { cosmiconfig } = require('cosmiconfig');
const { IConfigManager } = require('../interfaces');
const { getDefaultConfig, mergeDeep, validateConfig: basicValidate } = require('../../config/default-config');

/**
 * Configuration Manager Implementation
 * Provides comprehensive configuration management with validation and migration
 */
class ConfigManager extends IConfigManager {
  constructor(options = {}) {
    super();
    
    this.schemaPath = options.schemaPath || path.join(__dirname, '..', '..', 'config', 'schemas', 'project-config.schema.json');
    this.configName = options.configName || 'project-config';
    this.searchPlaces = options.searchPlaces || [
      'project-config.json',
      'project-config.js',
      'testing-suite.config.js',
      'package.json'
    ];
    
    // Initialize JSON schema validator
    this.ajv = new Ajv({ allErrors: true, verbose: true });
    addFormats(this.ajv);
    
    // Load schema
    this._loadSchema();
    
    // Initialize cosmiconfig for flexible config loading
    this.explorer = cosmiconfig(this.configName, {
      searchPlaces: this.searchPlaces,
      packageProp: 'testingSuite'
    });
    
    this.version = '1.0.0';
  }

  /**
   * Get component version
   * @returns {string} Component version
   */
  getVersion() {
    return this.version;
  }

  /**
   * Load configuration from file or generate default
   * @param {string} configPath - Path to configuration file or directory to search
   * @returns {Promise<object>} Loaded configuration
   */
  async loadConfig(configPath = null) {
    try {
      let config = null;
      
      if (configPath && await fs.pathExists(configPath)) {
        // Load from specific path
        if ((await fs.stat(configPath)).isFile()) {
          config = await this._loadConfigFile(configPath);
        } else {
          // Search in directory
          const result = await this.explorer.search(configPath);
          config = result ? result.config : null;
        }
      } else {
        // Search from current directory
        const result = await this.explorer.search();
        config = result ? result.config : null;
      }
      
      if (!config) {
        throw new Error('No configuration found. Run initialization first.');
      }
      
      // Validate and migrate if necessary
      const validation = this.validateConfig(config);
      if (!validation.valid) {
        throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
      }
      
      // Apply migrations if needed
      config = await this._migrateConfig(config);
      
      return config;
    } catch (error) {
      throw new Error(`Failed to load configuration: ${error.message}`);
    }
  }

  /**
   * Validate configuration against schema
   * @param {object} config - Configuration to validate
   * @returns {ValidationResult} Validation result
   */
  validateConfig(config) {
    if (!this.schema) {
      return basicValidate(config);
    }
    
    const valid = this.schema(config);
    
    if (valid) {
      return {
        valid: true,
        errors: [],
        warnings: this._generateWarnings(config)
      };
    }
    
    return {
      valid: false,
      errors: this.schema.errors.map(error => 
        `${error.instancePath || 'root'} ${error.message}`
      ),
      warnings: this._generateWarnings(config)
    };
  }

  /**
   * Save configuration to file
   * @param {object} config - Configuration to save
   * @param {string} configPath - Path to save configuration
   * @returns {Promise<void>}
   */
  async saveConfig(config, configPath) {
    try {
      // Validate before saving
      const validation = this.validateConfig(config);
      if (!validation.valid) {
        throw new Error(`Cannot save invalid configuration: ${validation.errors.join(', ')}`);
      }
      
      // Update metadata
      config.metadata = {
        ...config.metadata,
        lastUpdated: new Date().toISOString()
      };
      
      // Ensure directory exists
      await fs.ensureDir(path.dirname(configPath));
      
      // Save with pretty formatting
      await fs.writeJson(configPath, config, { spaces: 2 });
      
    } catch (error) {
      throw new Error(`Failed to save configuration: ${error.message}`);
    }
  }

  /**
   * Merge configurations with deep merge logic
   * @param {object} baseConfig - Base configuration
   * @param {object} overrides - Configuration overrides
   * @returns {object} Merged configuration
   */
  mergeConfigs(baseConfig, overrides) {
    return mergeDeep(baseConfig, overrides);
  }

  /**
   * Generate default configuration for project type
   * @param {string} projectType - Project type
   * @param {object} overrides - Configuration overrides
   * @returns {object} Default configuration
   */
  generateDefaultConfig(projectType, overrides = {}) {
    return getDefaultConfig(projectType, overrides);
  }

  /**
   * Create configuration from project analysis
   * @param {object} projectAnalysis - Analysis results
   * @param {object} userPreferences - User-specified preferences
   * @returns {object} Generated configuration
   */
  createFromAnalysis(projectAnalysis, userPreferences = {}) {
    const { generateFromAnalysis } = require('../../config/default-config');
    const baseConfig = generateFromAnalysis(projectAnalysis);
    return this.mergeConfigs(baseConfig, userPreferences);
  }

  /**
   * Update configuration with new values
   * @param {object} currentConfig - Current configuration
   * @param {object} updates - Updates to apply
   * @returns {object} Updated configuration
   */
  updateConfig(currentConfig, updates) {
    const updated = this.mergeConfigs(currentConfig, updates);
    
    // Update metadata
    updated.metadata = {
      ...updated.metadata,
      lastUpdated: new Date().toISOString()
    };
    
    return updated;
  }

  /**
   * Backup current configuration
   * @param {string} configPath - Path to configuration file
   * @returns {Promise<string>} Path to backup file
   */
  async backupConfig(configPath) {
    if (!await fs.pathExists(configPath)) {
      return null;
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `${configPath}.backup.${timestamp}`;
    
    await fs.copy(configPath, backupPath);
    return backupPath;
  }

  /**
   * Restore configuration from backup
   * @param {string} backupPath - Path to backup file
   * @param {string} configPath - Path to restore to
   * @returns {Promise<void>}
   */
  async restoreConfig(backupPath, configPath) {
    if (!await fs.pathExists(backupPath)) {
      throw new Error(`Backup file not found: ${backupPath}`);
    }
    
    await fs.copy(backupPath, configPath);
  }

  /**
   * List available configuration backups
   * @param {string} configPath - Configuration file path
   * @returns {Promise<string[]>} Array of backup file paths
   */
  async listBackups(configPath) {
    const dir = path.dirname(configPath);
    const basename = path.basename(configPath);
    
    try {
      const files = await fs.readdir(dir);
      return files
        .filter(file => file.startsWith(`${basename}.backup.`))
        .map(file => path.join(dir, file))
        .sort((a, b) => b.localeCompare(a)); // Most recent first
    } catch {
      return [];
    }
  }

  /**
   * Get configuration schema
   * @returns {object} JSON schema
   */
  getSchema() {
    return this.schemaObject;
  }

  /**
   * Check if configuration needs migration
   * @param {object} config - Configuration to check
   * @returns {boolean} True if migration is needed
   */
  needsMigration(config) {
    const currentVersion = this.getCurrentSchemaVersion();
    const configVersion = config.version || '1.0.0';
    
    return this._compareVersions(configVersion, currentVersion) < 0;
  }

  /**
   * Get current schema version
   * @returns {string} Current schema version
   */
  getCurrentSchemaVersion() {
    return this.schemaObject?.version || '1.0.0';
  }

  // Private methods

  /**
   * Load and compile JSON schema
   * @private
   */
  async _loadSchema() {
    try {
      if (await fs.pathExists(this.schemaPath)) {
        this.schemaObject = await fs.readJson(this.schemaPath);
        this.schema = this.ajv.compile(this.schemaObject);
      } else {
        console.warn(`Schema file not found: ${this.schemaPath}`);
        this.schema = null;
      }
    } catch (error) {
      console.warn(`Failed to load schema: ${error.message}`);
      this.schema = null;
    }
  }

  /**
   * Load configuration from file
   * @param {string} filePath - Path to configuration file
   * @returns {Promise<object>} Loaded configuration
   * @private
   */
  async _loadConfigFile(filePath) {
    const ext = path.extname(filePath);
    
    if (ext === '.json') {
      return await fs.readJson(filePath);
    } else if (ext === '.js') {
      delete require.cache[require.resolve(filePath)];
      return require(filePath);
    } else {
      throw new Error(`Unsupported configuration file type: ${ext}`);
    }
  }

  /**
   * Migrate configuration to current version
   * @param {object} config - Configuration to migrate
   * @returns {Promise<object>} Migrated configuration
   * @private
   */
  async _migrateConfig(config) {
    if (!this.needsMigration(config)) {
      return config;
    }
    
    // Apply migration logic here
    // For now, just update version
    const migrated = { ...config };
    migrated.version = this.getCurrentSchemaVersion();
    
    return migrated;
  }

  /**
   * Generate configuration warnings
   * @param {object} config - Configuration to analyze
   * @returns {string[]} Array of warning messages
   * @private
   */
  _generateWarnings(config) {
    const warnings = [];
    
    // Check for deprecated fields
    if (config.deprecated_field) {
      warnings.push('Field "deprecated_field" is deprecated and will be removed in future versions');
    }
    
    // Check for missing optional but recommended fields
    if (!config.testingSuite?.autoUpdate) {
      warnings.push('Consider setting testingSuite.autoUpdate for automatic updates');
    }
    
    // Check coverage thresholds
    if (config.coverage?.threshold?.global && config.coverage.threshold.global < 70) {
      warnings.push('Coverage threshold below 70% may indicate insufficient testing');
    }
    
    return warnings;
  }

  /**
   * Compare version strings
   * @param {string} version1 - First version
   * @param {string} version2 - Second version
   * @returns {number} -1 if version1 < version2, 0 if equal, 1 if version1 > version2
   * @private
   */
  _compareVersions(version1, version2) {
    const semver = require('semver');
    
    try {
      if (semver.lt(version1, version2)) return -1;
      if (semver.gt(version1, version2)) return 1;
      return 0;
    } catch {
      // Fallback to string comparison
      return version1.localeCompare(version2);
    }
  }
}

/**
 * Factory function to create ConfigManager
 * @param {object} options - Configuration options
 * @returns {ConfigManager} ConfigManager instance
 */
function createConfigManager(options = {}) {
  return new ConfigManager(options);
}

module.exports = {
  ConfigManager,
  createConfigManager
};