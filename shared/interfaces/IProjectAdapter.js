/**
 * Core Project Adapter Interface
 * 
 * This interface defines the contract for language-specific adapters.
 * Each language (JavaScript, Python, etc.) implements this interface
 * to provide language-specific project detection, analysis, and configuration.
 * 
 * @interface IProjectAdapter
 * @version 1.0.0
 */

class IProjectAdapter {
  /**
   * Detect if this adapter can handle the given project
   * @param {string} projectPath - Path to the project directory
   * @returns {Promise<boolean>} True if this adapter can handle the project
   */
  async detect(projectPath) {
    throw new Error('Method detect must be implemented');
  }

  /**
   * Analyze the project structure and extract relevant information
   * @param {string} projectPath - Path to the project directory
   * @returns {Promise<ProjectAnalysis>} Detailed project analysis
   */
  async analyze(projectPath) {
    throw new Error('Method analyze must be implemented');
  }

  /**
   * Generate appropriate test configuration for the project
   * @param {ProjectAnalysis} analysis - Project analysis results
   * @returns {Promise<TestConfiguration>} Test configuration for the project
   */
  async generateConfiguration(analysis) {
    throw new Error('Method generateConfiguration must be implemented');
  }

  /**
   * Get supported frameworks for this language
   * @returns {string[]} Array of supported framework names
   */
  getSupportedFrameworks() {
    throw new Error('Method getSupportedFrameworks must be implemented');
  }

  /**
   * Get the language this adapter handles
   * @returns {string} Language name (e.g., 'javascript', 'python')
   */
  getLanguage() {
    throw new Error('Method getLanguage must be implemented');
  }

  /**
   * Get required dependencies for testing this project type
   * @param {ProjectAnalysis} analysis - Project analysis results
   * @returns {Promise<Dependencies>} Required testing dependencies
   */
  async getTestDependencies(analysis) {
    throw new Error('Method getTestDependencies must be implemented');
  }

  /**
   * Get test templates applicable to this project
   * @param {ProjectAnalysis} analysis - Project analysis results
   * @returns {Promise<Template[]>} Array of applicable test templates
   */
  async getTestTemplates(analysis) {
    throw new Error('Method getTestTemplates must be implemented');
  }

  /**
   * Validate that the project can be tested with this adapter
   * @param {string} projectPath - Path to the project directory
   * @returns {Promise<ValidationResult>} Validation results with any warnings/errors
   */
  async validate(projectPath) {
    throw new Error('Method validate must be implemented');
  }
}

/**
 * @typedef {Object} ProjectAnalysis
 * @property {string} language - Primary language detected
 * @property {string[]} frameworks - Detected frameworks
 * @property {string} projectType - Type of project (frontend, backend, fullstack, library)
 * @property {PackageInfo} packageInfo - Package/dependency information
 * @property {string[]} entryPoints - Main entry points of the project
 * @property {TestingInfo} existingTests - Information about existing tests
 * @property {ProjectStructure} structure - Project directory structure
 * @property {BuildInfo} buildConfig - Build configuration details
 */

/**
 * @typedef {Object} TestConfiguration
 * @property {string} testRunner - Test runner to use (jest, pytest, etc.)
 * @property {string} testDirectory - Where to place tests
 * @property {Object} runnerConfig - Test runner specific configuration
 * @property {CoverageConfig} coverage - Coverage configuration
 * @property {string[]} testPatterns - File patterns for test discovery
 * @property {Object} environment - Test environment configuration
 */

/**
 * @typedef {Object} Dependencies
 * @property {string[]} required - Required dependencies for testing
 * @property {string[]} optional - Optional but recommended dependencies
 * @property {Object} versions - Specific version requirements
 */

/**
 * @typedef {Object} Template
 * @property {string} name - Template name
 * @property {string} path - Path to template file
 * @property {string} targetPath - Where to place the generated file
 * @property {Object} variables - Variables to substitute in template
 * @property {string} description - What this template provides
 */

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} valid - Whether the project can be tested
 * @property {string[]} errors - Critical errors preventing testing
 * @property {string[]} warnings - Non-critical issues or recommendations
 * @property {Object} suggestions - Suggestions for better testing setup
 */

/**
 * @typedef {Object} PackageInfo
 * @property {string} name - Package/project name
 * @property {string} version - Package version
 * @property {Object} dependencies - Production dependencies
 * @property {Object} devDependencies - Development dependencies
 * @property {Object} scripts - Available scripts
 */

/**
 * @typedef {Object} TestingInfo
 * @property {boolean} hasTests - Whether tests exist
 * @property {string[]} testFiles - Existing test files
 * @property {string} testRunner - Currently configured test runner
 * @property {number} coverage - Current coverage percentage if available
 */

/**
 * @typedef {Object} ProjectStructure
 * @property {string[]} sourceDirs - Source code directories
 * @property {string[]} testDirs - Test directories
 * @property {string} rootDir - Project root directory
 * @property {Object} conventions - Detected naming conventions
 */

/**
 * @typedef {Object} BuildInfo
 * @property {string} buildTool - Build tool (webpack, vite, etc.)
 * @property {Object} buildConfig - Build configuration
 * @property {string} outputDir - Build output directory
 * @property {boolean} hasTypeScript - Whether TypeScript is configured
 */

/**
 * @typedef {Object} CoverageConfig
 * @property {number} threshold - Coverage threshold percentage
 * @property {string[]} include - Paths to include in coverage
 * @property {string[]} exclude - Paths to exclude from coverage
 * @property {string[]} reporters - Coverage report formats
 */

module.exports = IProjectAdapter;