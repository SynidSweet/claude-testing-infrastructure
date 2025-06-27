/**
 * Base Project Adapter Implementation
 * 
 * This abstract base class provides common functionality for all language adapters.
 * It implements shared logic for project detection, analysis, and configuration
 * while leaving language-specific details to be implemented by subclasses.
 * 
 * @abstract
 * @implements {IProjectAdapter}
 */

const fs = require('fs-extra');
const path = require('path');
const glob = require('glob');
const { IProjectAdapter } = require('../../interfaces');

class BaseProjectAdapter extends IProjectAdapter {
  constructor(language) {
    super();
    this.language = language;
    this.cache = new Map();
  }

  /**
   * Get the language this adapter handles
   * @returns {string} Language name
   */
  getLanguage() {
    return this.language;
  }

  /**
   * Base validation that checks common project requirements
   * @param {string} projectPath - Path to the project directory
   * @returns {Promise<ValidationResult>} Validation results
   */
  async validate(projectPath) {
    const errors = [];
    const warnings = [];
    const suggestions = {};

    try {
      // Check if directory exists
      if (!await fs.pathExists(projectPath)) {
        errors.push(`Project directory does not exist: ${projectPath}`);
        return { valid: false, errors, warnings, suggestions };
      }

      // Check if it's a directory
      const stats = await fs.stat(projectPath);
      if (!stats.isDirectory()) {
        errors.push(`Path is not a directory: ${projectPath}`);
        return { valid: false, errors, warnings, suggestions };
      }

      // Check for version control
      const hasGit = await fs.pathExists(path.join(projectPath, '.git'));
      if (!hasGit) {
        warnings.push('No Git repository detected. Version control is recommended.');
        suggestions.versionControl = 'Initialize a Git repository with: git init';
      }

      // Check for README
      const readmeExists = await this.findFile(projectPath, /^readme\.(md|txt|rst)$/i);
      if (!readmeExists) {
        warnings.push('No README file found. Documentation is important.');
        suggestions.documentation = 'Create a README.md file to document your project';
      }

      // Language-specific validation (to be implemented by subclasses)
      const languageValidation = await this.validateLanguageSpecific(projectPath);
      errors.push(...languageValidation.errors);
      warnings.push(...languageValidation.warnings);
      Object.assign(suggestions, languageValidation.suggestions);

    } catch (error) {
      errors.push(`Validation error: ${error.message}`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      suggestions
    };
  }

  /**
   * Analyze project structure with caching
   * @param {string} projectPath - Path to the project directory
   * @returns {Promise<ProjectAnalysis>} Project analysis results
   */
  async analyze(projectPath) {
    // Check cache first
    const cacheKey = `analysis_${projectPath}`;
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < 60000) { // 1 minute cache
        return cached.data;
      }
    }

    // Perform analysis
    const analysis = await this.performAnalysis(projectPath);
    
    // Cache results
    this.cache.set(cacheKey, {
      data: analysis,
      timestamp: Date.now()
    });

    return analysis;
  }

  /**
   * Perform the actual analysis (to be extended by subclasses)
   * @protected
   * @param {string} projectPath - Path to the project directory
   * @returns {Promise<ProjectAnalysis>} Project analysis results
   */
  async performAnalysis(projectPath) {
    const [
      structure,
      existingTests,
      buildConfig
    ] = await Promise.all([
      this.analyzeStructure(projectPath),
      this.analyzeExistingTests(projectPath),
      this.analyzeBuildConfig(projectPath)
    ]);

    // Get language-specific analysis
    const languageAnalysis = await this.analyzeLanguageSpecific(projectPath);

    return {
      language: this.language,
      frameworks: languageAnalysis.frameworks || [],
      projectType: languageAnalysis.projectType || 'unknown',
      packageInfo: languageAnalysis.packageInfo || {},
      entryPoints: languageAnalysis.entryPoints || [],
      existingTests,
      structure,
      buildConfig
    };
  }

  /**
   * Analyze project directory structure
   * @protected
   * @param {string} projectPath - Path to the project directory
   * @returns {Promise<ProjectStructure>} Project structure information
   */
  async analyzeStructure(projectPath) {
    const sourceDirs = [];
    const testDirs = [];
    const conventions = {
      testNaming: null,
      directoryStructure: null
    };

    // Common source directory patterns
    const commonSourceDirs = ['src', 'lib', 'app', 'source', 'sources'];
    const commonTestDirs = ['test', 'tests', '__tests__', 'spec', 'specs'];

    // Check for common directories
    for (const dir of commonSourceDirs) {
      if (await fs.pathExists(path.join(projectPath, dir))) {
        sourceDirs.push(dir);
      }
    }

    for (const dir of commonTestDirs) {
      if (await fs.pathExists(path.join(projectPath, dir))) {
        testDirs.push(dir);
      }
    }

    // Detect naming conventions
    if (testDirs.length > 0) {
      conventions.directoryStructure = 'separate';
    } else {
      // Check for co-located tests
      const colocatedTests = await this.findFiles(projectPath, '**/*.{test,spec}.*');
      if (colocatedTests.length > 0) {
        conventions.directoryStructure = 'colocated';
      }
    }

    return {
      sourceDirs,
      testDirs,
      rootDir: projectPath,
      conventions
    };
  }

  /**
   * Analyze existing test setup
   * @protected
   * @param {string} projectPath - Path to the project directory
   * @returns {Promise<TestingInfo>} Existing test information
   */
  async analyzeExistingTests(projectPath) {
    const testFiles = await this.findTestFiles(projectPath);
    const testRunner = await this.detectTestRunner(projectPath);
    
    return {
      hasTests: testFiles.length > 0,
      testFiles: testFiles.map(f => path.relative(projectPath, f)),
      testRunner,
      coverage: null // Would need to parse coverage reports
    };
  }

  /**
   * Analyze build configuration
   * @protected
   * @param {string} projectPath - Path to the project directory
   * @returns {Promise<BuildInfo>} Build configuration information
   */
  async analyzeBuildConfig(projectPath) {
    // This is a base implementation; subclasses should override
    return {
      buildTool: 'unknown',
      buildConfig: {},
      outputDir: null,
      hasTypeScript: false
    };
  }

  /**
   * Find files matching a pattern
   * @protected
   * @param {string} basePath - Base path to search from
   * @param {string} pattern - Glob pattern
   * @returns {Promise<string[]>} Array of file paths
   */
  async findFiles(basePath, pattern) {
    return new Promise((resolve, reject) => {
      glob(pattern, { cwd: basePath, absolute: true }, (err, files) => {
        if (err) reject(err);
        else resolve(files);
      });
    });
  }

  /**
   * Find a single file matching a pattern
   * @protected
   * @param {string} basePath - Base path to search from
   * @param {RegExp} pattern - Pattern to match
   * @returns {Promise<string|null>} File path or null
   */
  async findFile(basePath, pattern) {
    try {
      const files = await fs.readdir(basePath);
      const match = files.find(file => pattern.test(file));
      return match ? path.join(basePath, match) : null;
    } catch {
      return null;
    }
  }

  /**
   * Read and parse JSON file safely
   * @protected
   * @param {string} filePath - Path to JSON file
   * @returns {Promise<Object|null>} Parsed JSON or null
   */
  async readJsonSafe(filePath) {
    try {
      return await fs.readJson(filePath);
    } catch {
      return null;
    }
  }

  /**
   * Check if a file exists
   * @protected
   * @param {string} filePath - Path to check
   * @returns {Promise<boolean>} True if file exists
   */
  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  // Abstract methods to be implemented by subclasses

  /**
   * Language-specific validation
   * @abstract
   * @protected
   * @param {string} projectPath - Path to the project directory
   * @returns {Promise<ValidationResult>} Language-specific validation results
   */
  async validateLanguageSpecific(projectPath) {
    throw new Error('validateLanguageSpecific must be implemented by subclass');
  }

  /**
   * Language-specific analysis
   * @abstract
   * @protected
   * @param {string} projectPath - Path to the project directory
   * @returns {Promise<Object>} Language-specific analysis results
   */
  async analyzeLanguageSpecific(projectPath) {
    throw new Error('analyzeLanguageSpecific must be implemented by subclass');
  }

  /**
   * Find test files based on language conventions
   * @abstract
   * @protected
   * @param {string} projectPath - Path to the project directory
   * @returns {Promise<string[]>} Test file paths
   */
  async findTestFiles(projectPath) {
    throw new Error('findTestFiles must be implemented by subclass');
  }

  /**
   * Detect test runner in use
   * @abstract
   * @protected
   * @param {string} projectPath - Path to the project directory
   * @returns {Promise<string|null>} Test runner name or null
   */
  async detectTestRunner(projectPath) {
    throw new Error('detectTestRunner must be implemented by subclass');
  }
}

module.exports = BaseProjectAdapter;