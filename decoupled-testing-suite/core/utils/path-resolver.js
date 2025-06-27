/**
 * Stable Path Resolution System
 * 
 * This module provides consistent, reliable path resolution between the
 * testing suite and target projects. The interface is designed to remain
 * stable across updates to ensure compatibility.
 */

const path = require('path');
const fs = require('fs').promises;
const { existsSync } = require('fs');

/**
 * PathResolver - Stable interface for resolving paths between testing suite and projects
 * 
 * Interface Version: 1.0.0
 * Compatibility Promise: This interface will remain stable within major versions
 */
class PathResolver {
  /**
   * Initialize PathResolver with configuration
   * @param {object} config - Project configuration
   * @param {string} testSuiteRoot - Testing suite root directory (defaults to __dirname)
   */
  constructor(config, testSuiteRoot = null) {
    this.config = config;
    this.testSuiteRoot = testSuiteRoot || path.resolve(__dirname, '..', '..');
    this.projectRoot = path.resolve(this.testSuiteRoot, config.projectRoot);
    
    // Cache for resolved paths to improve performance
    this._pathCache = new Map();
    
    // Validation
    this._validateConfiguration();
  }

  /**
   * Resolve a file path within the project
   * @param {string} relativePath - Path relative to project root
   * @returns {string} Absolute path to project file
   */
  resolveProjectFile(relativePath) {
    const cacheKey = `project:${relativePath}`;
    
    if (this._pathCache.has(cacheKey)) {
      return this._pathCache.get(cacheKey);
    }
    
    const resolved = path.resolve(this.projectRoot, relativePath);
    
    // Security check: ensure path is within project bounds
    if (!this._isWithinProject(resolved)) {
      throw new Error(`Path traversal detected: ${relativePath} resolves outside project bounds`);
    }
    
    this._pathCache.set(cacheKey, resolved);
    return resolved;
  }

  /**
   * Resolve a file path within the testing suite
   * @param {string} relativePath - Path relative to testing suite root
   * @returns {string} Absolute path to testing suite file
   */
  resolveTestFile(relativePath) {
    const cacheKey = `test:${relativePath}`;
    
    if (this._pathCache.has(cacheKey)) {
      return this._pathCache.get(cacheKey);
    }
    
    const resolved = path.resolve(this.testSuiteRoot, relativePath);
    
    // Security check: ensure path is within testing suite bounds
    if (!this._isWithinTestSuite(resolved)) {
      throw new Error(`Path traversal detected: ${relativePath} resolves outside testing suite bounds`);
    }
    
    this._pathCache.set(cacheKey, resolved);
    return resolved;
  }

  /**
   * Resolve a template file path
   * @param {string} templateName - Template name or path
   * @returns {string} Absolute path to template file
   */
  resolveTemplate(templateName) {
    const cacheKey = `template:${templateName}`;
    
    if (this._pathCache.has(cacheKey)) {
      return this._pathCache.get(cacheKey);
    }
    
    // Check if it's already a full path
    if (path.isAbsolute(templateName)) {
      return templateName;
    }
    
    // Try different template locations
    const templatePaths = [
      path.join('templates', templateName),
      path.join('templates', this.config.projectType, templateName),
      path.join('templates', 'shared', templateName)
    ];
    
    for (const templatePath of templatePaths) {
      const resolved = this.resolveTestFile(templatePath);
      if (existsSync(resolved)) {
        this._pathCache.set(cacheKey, resolved);
        return resolved;
      }
    }
    
    throw new Error(`Template not found: ${templateName}`);
  }

  /**
   * Get project source directory path
   * @returns {string} Absolute path to source directory
   */
  getSourceDir() {
    return this.resolveProjectFile(this.config.structure?.sourceDir || 'src');
  }

  /**
   * Get project test directory path (if separate test directory is used)
   * @returns {string|null} Absolute path to test directory or null for co-located tests
   */
  getTestDir() {
    const testDir = this.config.structure?.testDir;
    return testDir ? this.resolveProjectFile(testDir) : null;
  }

  /**
   * Get project build directory path
   * @returns {string} Absolute path to build directory
   */
  getBuildDir() {
    return this.resolveProjectFile(this.config.structure?.buildDir || 'dist');
  }

  /**
   * Get project public directory path
   * @returns {string} Absolute path to public directory
   */
  getPublicDir() {
    return this.resolveProjectFile(this.config.structure?.publicDir || 'public');
  }

  /**
   * Get all entry points defined in configuration
   * @returns {object} Object with entry point names and their absolute paths
   */
  getEntryPoints() {
    const entryPoints = {};
    
    for (const [name, relativePath] of Object.entries(this.config.entryPoints || {})) {
      entryPoints[name] = this.resolveProjectFile(relativePath);
    }
    
    return entryPoints;
  }

  /**
   * Find files matching a pattern within the project
   * @param {string} pattern - Glob pattern
   * @param {object} options - Search options
   * @returns {Promise<string[]>} Array of absolute file paths
   */
  async findProjectFiles(pattern, options = {}) {
    const glob = require('glob');
    const { promisify } = require('util');
    const globAsync = promisify(glob);
    
    const searchOptions = {
      cwd: this.projectRoot,
      absolute: true,
      ignore: this.config.testPatterns?.exclude || [],
      ...options
    };
    
    try {
      const files = await globAsync(pattern, searchOptions);
      
      // Ensure all files are within project bounds
      return files.filter(file => this._isWithinProject(file));
    } catch (error) {
      throw new Error(`Failed to find files with pattern "${pattern}": ${error.message}`);
    }
  }

  /**
   * Check if a file exists in the project
   * @param {string} relativePath - Path relative to project root
   * @returns {Promise<boolean>} True if file exists
   */
  async projectFileExists(relativePath) {
    try {
      const fullPath = this.resolveProjectFile(relativePath);
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if a template exists
   * @param {string} templateName - Template name
   * @returns {boolean} True if template exists
   */
  templateExists(templateName) {
    try {
      this.resolveTemplate(templateName);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get relative path from project root
   * @param {string} absolutePath - Absolute file path
   * @returns {string} Path relative to project root
   */
  getRelativeToProject(absolutePath) {
    return path.relative(this.projectRoot, absolutePath);
  }

  /**
   * Get relative path from testing suite root
   * @param {string} absolutePath - Absolute file path
   * @returns {string} Path relative to testing suite root
   */
  getRelativeToTestSuite(absolutePath) {
    return path.relative(this.testSuiteRoot, absolutePath);
  }

  /**
   * Normalize path separators for current platform
   * @param {string} filePath - File path to normalize
   * @returns {string} Normalized path
   */
  normalizePath(filePath) {
    return path.normalize(filePath);
  }

  /**
   * Convert path to use forward slashes (useful for patterns and URLs)
   * @param {string} filePath - File path to convert
   * @returns {string} Path with forward slashes
   */
  toForwardSlashes(filePath) {
    return filePath.replace(/\\/g, '/');
  }

  /**
   * Create directory if it doesn't exist
   * @param {string} dirPath - Directory path (relative to project)
   * @returns {Promise<string>} Absolute path to created directory
   */
  async ensureProjectDir(dirPath) {
    const fullPath = this.resolveProjectFile(dirPath);
    await fs.mkdir(fullPath, { recursive: true });
    return fullPath;
  }

  /**
   * Get configuration-aware file patterns
   * @param {string} testType - Type of test ('unit', 'integration', 'e2e')
   * @returns {string} Glob pattern for test files
   */
  getTestPattern(testType) {
    return this.config.testPatterns?.[testType] || `**/*.{test,spec}.{js,ts}`;
  }

  /**
   * Clear path cache (useful for testing or when configuration changes)
   */
  clearCache() {
    this._pathCache.clear();
  }

  /**
   * Get current configuration
   * @returns {object} Current configuration
   */
  getConfig() {
    return { ...this.config };
  }

  // Private methods

  /**
   * Validate configuration on initialization
   * @private
   */
  _validateConfiguration() {
    if (!this.config.projectRoot) {
      throw new Error('Configuration must specify projectRoot');
    }
    
    if (!existsSync(this.projectRoot)) {
      throw new Error(`Project root does not exist: ${this.projectRoot}`);
    }
    
    if (!existsSync(this.testSuiteRoot)) {
      throw new Error(`Testing suite root does not exist: ${this.testSuiteRoot}`);
    }
  }

  /**
   * Check if path is within project bounds
   * @param {string} targetPath - Path to check
   * @returns {boolean} True if within project bounds
   * @private
   */
  _isWithinProject(targetPath) {
    const relativePath = path.relative(this.projectRoot, targetPath);
    return !relativePath.startsWith('..') && !path.isAbsolute(relativePath);
  }

  /**
   * Check if path is within testing suite bounds
   * @param {string} targetPath - Path to check
   * @returns {boolean} True if within testing suite bounds
   * @private
   */
  _isWithinTestSuite(targetPath) {
    const relativePath = path.relative(this.testSuiteRoot, targetPath);
    return !relativePath.startsWith('..') && !path.isAbsolute(relativePath);
  }
}

/**
 * Factory function to create PathResolver with validation
 * @param {object} config - Project configuration
 * @param {string} testSuiteRoot - Testing suite root directory
 * @returns {PathResolver} Configured PathResolver instance
 */
function createPathResolver(config, testSuiteRoot = null) {
  return new PathResolver(config, testSuiteRoot);
}

/**
 * Utility function to resolve paths without creating a full PathResolver instance
 * @param {string} basePath - Base directory
 * @param {string} relativePath - Relative path to resolve
 * @returns {string} Resolved absolute path
 */
function resolvePath(basePath, relativePath) {
  return path.resolve(basePath, relativePath);
}

module.exports = {
  PathResolver,
  createPathResolver,
  resolvePath
};