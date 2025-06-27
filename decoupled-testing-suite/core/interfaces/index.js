/**
 * Stable API Interfaces for Decoupled Testing Suite
 * 
 * This module defines all public interfaces that must remain stable across updates.
 * These interfaces form the contract between the testing suite and projects.
 * 
 * Interface Version: 1.0.0
 * Compatibility Promise: Interfaces will remain backward compatible within major versions
 */

/**
 * Base interface for all components
 * @interface IComponent
 */
class IComponent {
  /**
   * Get component version
   * @returns {string} Component version
   */
  getVersion() {
    throw new Error('Method getVersion must be implemented');
  }

  /**
   * Get component interface version
   * @returns {string} Interface version
   */
  getInterfaceVersion() {
    return '1.0.0';
  }
}

/**
 * Project Discovery Interface
 * Responsible for analyzing project structure and generating test plans
 * @interface IProjectDiscovery
 */
class IProjectDiscovery extends IComponent {
  /**
   * Discover components in a project
   * @param {string} projectRoot - Project root directory
   * @param {object} config - Project configuration
   * @returns {Promise<ProjectDiscoveryResult>} Discovery results
   */
  async discoverComponents(projectRoot, config) {
    throw new Error('Method discoverComponents must be implemented');
  }

  /**
   * Generate test plan based on discovered components
   * @param {ProjectDiscoveryResult} components - Discovered components
   * @param {string[]} testTypes - Types of tests to generate plan for
   * @returns {Promise<TestPlan>} Test plan
   */
  async generateTestPlan(components, testTypes) {
    throw new Error('Method generateTestPlan must be implemented');
  }

  /**
   * Analyze project structure and dependencies
   * @param {string} projectRoot - Project root directory
   * @returns {Promise<ProjectAnalysis>} Project analysis
   */
  async analyzeProject(projectRoot) {
    throw new Error('Method analyzeProject must be implemented');
  }
}

/**
 * Test Runner Interface
 * Responsible for executing tests and returning results
 * @interface ITestRunner
 */
class ITestRunner extends IComponent {
  /**
   * Run tests of specified type
   * @param {string} testType - Type of tests to run ('unit', 'integration', 'e2e')
   * @param {TestRunOptions} options - Test execution options
   * @returns {Promise<TestResults>} Test execution results
   */
  async runTests(testType, options = {}) {
    throw new Error('Method runTests must be implemented');
  }

  /**
   * Run all tests
   * @param {TestRunOptions} options - Test execution options
   * @returns {Promise<TestResults>} Test execution results
   */
  async runAllTests(options = {}) {
    throw new Error('Method runAllTests must be implemented');
  }

  /**
   * Get available test types for this runner
   * @returns {string[]} Array of supported test types
   */
  getSupportedTestTypes() {
    throw new Error('Method getSupportedTestTypes must be implemented');
  }
}

/**
 * Project Analyzer Interface
 * Provides deep analysis of project code and structure
 * @interface IProjectAnalyzer
 */
class IProjectAnalyzer extends IComponent {
  /**
   * Analyze project structure, dependencies, and code
   * @param {string} projectRoot - Project root directory
   * @param {object} config - Project configuration
   * @returns {Promise<ProjectAnalysisResult>} Analysis results
   */
  async analyzeProject(projectRoot, config) {
    throw new Error('Method analyzeProject must be implemented');
  }

  /**
   * Analyze testability of project code
   * @param {string} projectRoot - Project root directory
   * @param {object} config - Project configuration
   * @returns {Promise<TestabilityReport>} Testability analysis
   */
  async analyzeTestability(projectRoot, config) {
    throw new Error('Method analyzeTestability must be implemented');
  }

  /**
   * Get code metrics
   * @param {string} projectRoot - Project root directory
   * @param {object} config - Project configuration
   * @returns {Promise<CodeMetrics>} Code metrics
   */
  async getCodeMetrics(projectRoot, config) {
    throw new Error('Method getCodeMetrics must be implemented');
  }
}

/**
 * Test Reporter Interface
 * Handles formatting and outputting test results
 * @interface ITestReporter
 */
class ITestReporter extends IComponent {
  /**
   * Generate test report
   * @param {TestResults} results - Test results to report
   * @param {ReportOptions} options - Report generation options
   * @returns {Promise<Report>} Generated report
   */
  async generateReport(results, options = {}) {
    throw new Error('Method generateReport must be implemented');
  }

  /**
   * Get supported report formats
   * @returns {string[]} Array of supported formats
   */
  getSupportedFormats() {
    throw new Error('Method getSupportedFormats must be implemented');
  }
}

/**
 * Framework Adapter Interface
 * Provides framework-specific testing configurations and behaviors
 * @interface IFrameworkAdapter
 */
class IFrameworkAdapter extends IComponent {
  /**
   * Detect if this adapter can handle the project
   * @param {string} projectRoot - Project root directory
   * @returns {Promise<boolean>} True if adapter can handle project
   */
  async detectProject(projectRoot) {
    throw new Error('Method detectProject must be implemented');
  }

  /**
   * Get default configuration for this framework
   * @returns {object} Default configuration
   */
  getDefaultConfig() {
    throw new Error('Method getDefaultConfig must be implemented');
  }

  /**
   * Get test templates for this framework
   * @returns {string[]} Array of template names
   */
  getTestTemplates() {
    throw new Error('Method getTestTemplates must be implemented');
  }

  /**
   * Setup test environment for this framework
   * @param {object} config - Project configuration
   * @returns {Promise<EnvironmentSetup>} Environment setup results
   */
  async setupTestEnvironment(config) {
    throw new Error('Method setupTestEnvironment must be implemented');
  }

  /**
   * Get framework name
   * @returns {string} Framework name
   */
  getFrameworkName() {
    throw new Error('Method getFrameworkName must be implemented');
  }
}

/**
 * Configuration Manager Interface
 * Handles configuration loading, validation, and management
 * @interface IConfigManager
 */
class IConfigManager extends IComponent {
  /**
   * Load configuration from file or generate default
   * @param {string} configPath - Path to configuration file
   * @returns {Promise<object>} Loaded configuration
   */
  async loadConfig(configPath) {
    throw new Error('Method loadConfig must be implemented');
  }

  /**
   * Validate configuration against schema
   * @param {object} config - Configuration to validate
   * @returns {ValidationResult} Validation result
   */
  validateConfig(config) {
    throw new Error('Method validateConfig must be implemented');
  }

  /**
   * Save configuration to file
   * @param {object} config - Configuration to save
   * @param {string} configPath - Path to save configuration
   * @returns {Promise<void>}
   */
  async saveConfig(config, configPath) {
    throw new Error('Method saveConfig must be implemented');
  }

  /**
   * Merge configurations
   * @param {object} baseConfig - Base configuration
   * @param {object} overrides - Configuration overrides
   * @returns {object} Merged configuration
   */
  mergeConfigs(baseConfig, overrides) {
    throw new Error('Method mergeConfigs must be implemented');
  }
}

// Type definitions for return values and parameters

/**
 * @typedef {object} ProjectDiscoveryResult
 * @property {ComponentInfo[]} components - Discovered components
 * @property {RouteInfo[]} routes - Discovered routes
 * @property {ServiceInfo[]} services - Discovered services
 * @property {TypeInfo[]} types - Discovered types
 * @property {DependencyInfo[]} dependencies - Project dependencies
 */

/**
 * @typedef {object} ComponentInfo
 * @property {string} name - Component name
 * @property {string} path - File path
 * @property {string} type - Component type
 * @property {object} props - Component props (for UI components)
 * @property {object} metadata - Additional metadata
 */

/**
 * @typedef {object} RouteInfo
 * @property {string} path - Route path
 * @property {string} method - HTTP method
 * @property {string} handler - Handler function
 * @property {object} middleware - Applied middleware
 */

/**
 * @typedef {object} TestPlan
 * @property {TestCase[]} testCases - Generated test cases
 * @property {string[]} templates - Required templates
 * @property {object} coverage - Coverage targets
 * @property {string[]} dependencies - Required test dependencies
 */

/**
 * @typedef {object} TestCase
 * @property {string} name - Test case name
 * @property {string} type - Test type ('unit', 'integration', 'e2e')
 * @property {string} target - Target component/function
 * @property {string} template - Template to use
 * @property {object} context - Test context and data
 */

/**
 * @typedef {object} TestResults
 * @property {boolean} success - Overall test success
 * @property {TestSuiteResult[]} suites - Test suite results
 * @property {CoverageReport} coverage - Coverage report
 * @property {PerformanceMetrics} performance - Performance metrics
 * @property {number} duration - Total execution time
 * @property {object} metadata - Additional metadata
 */

/**
 * @typedef {object} TestSuiteResult
 * @property {string} name - Suite name
 * @property {boolean} success - Suite success
 * @property {TestCaseResult[]} tests - Individual test results
 * @property {number} duration - Suite execution time
 */

/**
 * @typedef {object} TestCaseResult
 * @property {string} name - Test name
 * @property {boolean} success - Test success
 * @property {string|null} error - Error message if failed
 * @property {number} duration - Test execution time
 */

/**
 * @typedef {object} CoverageReport
 * @property {number} lines - Line coverage percentage
 * @property {number} functions - Function coverage percentage
 * @property {number} branches - Branch coverage percentage
 * @property {number} statements - Statement coverage percentage
 * @property {object} files - Per-file coverage data
 */

/**
 * @typedef {object} ProjectAnalysisResult
 * @property {ProjectStructure} structure - Project structure
 * @property {DependencyMap} dependencies - Dependency analysis
 * @property {EntryPointList} entryPoints - Entry points
 * @property {TestabilityReport} testability - Testability analysis
 * @property {CodeMetrics} metrics - Code metrics
 */

/**
 * @typedef {object} ProjectStructure
 * @property {string} type - Project type
 * @property {string[]} languages - Programming languages
 * @property {object} frameworks - Detected frameworks
 * @property {DirectoryInfo[]} directories - Directory structure
 * @property {FileInfo[]} files - Important files
 */

/**
 * @typedef {object} TestRunOptions
 * @property {boolean} coverage - Generate coverage report
 * @property {boolean} watch - Watch mode
 * @property {string[]} files - Specific files to test
 * @property {string} reporter - Reporter to use
 * @property {number} timeout - Test timeout
 * @property {object} env - Environment variables
 */

/**
 * @typedef {object} ValidationResult
 * @property {boolean} valid - Whether configuration is valid
 * @property {string[]} errors - Validation errors
 * @property {string[]} warnings - Validation warnings
 */

// Export all interfaces and types
module.exports = {
  // Interfaces
  IComponent,
  IProjectDiscovery,
  ITestRunner,
  IProjectAnalyzer,
  ITestReporter,
  IFrameworkAdapter,
  IConfigManager,
  
  // Interface version information
  INTERFACE_VERSION: '1.0.0',
  COMPATIBILITY_VERSION: '1.0.0'
};