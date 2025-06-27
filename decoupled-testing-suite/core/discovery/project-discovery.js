/**
 * Project Discovery Engine
 * 
 * Analyzes project structure, discovers components, and generates test plans.
 * Implements the IProjectDiscovery interface for stable API compatibility.
 */

const fs = require('fs-extra');
const path = require('path');
const glob = require('glob');
const { promisify } = require('util');
const { IProjectDiscovery } = require('../interfaces');
const { PathResolver } = require('../utils/path-resolver');

const globAsync = promisify(glob);

/**
 * Project Discovery Implementation
 * Provides intelligent analysis of project structure and code
 */
class ProjectDiscovery extends IProjectDiscovery {
  constructor(config = {}) {
    super();
    
    this.config = config;
    this.pathResolver = config.pathResolver || null;
    this.version = '1.0.0';
    
    // Cache for discovered information
    this._discoveryCache = new Map();
    
    // File type mappings
    this.fileTypeMap = {
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.py': 'python',
      '.vue': 'vue',
      '.svelte': 'svelte'
    };
    
    // Component patterns for different frameworks
    this.componentPatterns = {
      react: {
        patterns: ['**/*.{jsx,tsx}', '**/components/**/*.{js,ts}'],
        exclude: ['**/*.test.*', '**/*.spec.*', '**/node_modules/**']
      },
      vue: {
        patterns: ['**/*.vue', '**/components/**/*.{js,ts}'],
        exclude: ['**/*.test.*', '**/*.spec.*', '**/node_modules/**']
      },
      angular: {
        patterns: ['**/*.component.ts', '**/components/**/*.ts'],
        exclude: ['**/*.spec.ts', '**/node_modules/**']
      }
    };
  }

  /**
   * Get component version
   * @returns {string} Component version
   */
  getVersion() {
    return this.version;
  }

  /**
   * Discover components in a project
   * @param {string} projectRoot - Project root directory
   * @param {object} config - Project configuration
   * @returns {Promise<ProjectDiscoveryResult>} Discovery results
   */
  async discoverComponents(projectRoot, config) {
    const cacheKey = `components:${projectRoot}:${JSON.stringify(config)}`;
    
    if (this._discoveryCache.has(cacheKey)) {
      return this._discoveryCache.get(cacheKey);
    }
    
    try {
      // Initialize path resolver if not provided
      if (!this.pathResolver) {
        this.pathResolver = new PathResolver(config);
      }
      
      const [components, routes, services, types, dependencies] = await Promise.all([
        this._discoverUIComponents(projectRoot, config),
        this._discoverRoutes(projectRoot, config),
        this._discoverServices(projectRoot, config),
        this._discoverTypes(projectRoot, config),
        this._analyzeDependencies(projectRoot, config)
      ]);
      
      const result = {
        components,
        routes,
        services,
        types,
        dependencies,
        metadata: {
          discoveredAt: new Date().toISOString(),
          projectRoot,
          totalFiles: components.length + services.length,
          frameworksDetected: this._detectFrameworks(projectRoot, config)
        }
      };
      
      this._discoveryCache.set(cacheKey, result);
      return result;
      
    } catch (error) {
      throw new Error(`Component discovery failed: ${error.message}`);
    }
  }

  /**
   * Generate test plan based on discovered components
   * @param {ProjectDiscoveryResult} discoveryResult - Discovered components
   * @param {string[]} testTypes - Types of tests to generate plan for
   * @returns {Promise<TestPlan>} Test plan
   */
  async generateTestPlan(discoveryResult, testTypes) {
    try {
      const testCases = [];
      const templates = new Set();
      const dependencies = new Set();
      
      // Generate test cases for each component type
      for (const component of discoveryResult.components) {
        const componentTests = await this._generateComponentTests(component, testTypes);
        testCases.push(...componentTests);
        
        componentTests.forEach(test => {
          templates.add(test.template);
          if (test.dependencies) {
            test.dependencies.forEach(dep => dependencies.add(dep));
          }
        });
      }
      
      // Generate test cases for services
      for (const service of discoveryResult.services) {
        const serviceTests = await this._generateServiceTests(service, testTypes);
        testCases.push(...serviceTests);
        
        serviceTests.forEach(test => {
          templates.add(test.template);
          if (test.dependencies) {
            test.dependencies.forEach(dep => dependencies.add(dep));
          }
        });
      }
      
      // Generate test cases for routes/APIs
      for (const route of discoveryResult.routes) {
        const routeTests = await this._generateRouteTests(route, testTypes);
        testCases.push(...routeTests);
        
        routeTests.forEach(test => {
          templates.add(test.template);
          if (test.dependencies) {
            test.dependencies.forEach(dep => dependencies.add(dep));
          }
        });
      }
      
      // Calculate coverage targets
      const coverage = this._calculateCoverageTargets(discoveryResult, testCases);
      
      return {
        testCases,
        templates: Array.from(templates),
        dependencies: Array.from(dependencies),
        coverage,
        metadata: {
          generatedAt: new Date().toISOString(),
          totalTestCases: testCases.length,
          testTypes: testTypes,
          estimatedExecutionTime: this._estimateExecutionTime(testCases)
        }
      };
      
    } catch (error) {
      throw new Error(`Test plan generation failed: ${error.message}`);
    }
  }

  /**
   * Analyze project structure and dependencies
   * @param {string} projectRoot - Project root directory
   * @returns {Promise<ProjectAnalysis>} Project analysis
   */
  async analyzeProject(projectRoot) {
    try {
      const [
        structure,
        packageInfo,
        entryPoints,
        testStructure,
        buildConfig
      ] = await Promise.all([
        this._analyzeProjectStructure(projectRoot),
        this._analyzePackageInfo(projectRoot),
        this._findEntryPoints(projectRoot),
        this._analyzeExistingTests(projectRoot),
        this._analyzeBuildConfiguration(projectRoot)
      ]);
      
      return {
        structure,
        packageInfo,
        entryPoints,
        testStructure,
        buildConfig,
        recommendations: this._generateRecommendations(structure, packageInfo),
        metadata: {
          analyzedAt: new Date().toISOString(),
          projectRoot
        }
      };
      
    } catch (error) {
      throw new Error(`Project analysis failed: ${error.message}`);
    }
  }

  /**
   * Clear discovery cache
   */
  clearCache() {
    this._discoveryCache.clear();
  }

  // Private discovery methods

  /**
   * Discover UI components (React, Vue, Angular, etc.)
   * @param {string} projectRoot - Project root directory
   * @param {object} config - Project configuration
   * @returns {Promise<ComponentInfo[]>} Discovered components
   * @private
   */
  async _discoverUIComponents(projectRoot, config) {
    const framework = config.framework?.frontend;
    
    if (!framework || !this.componentPatterns[framework]) {
      return [];
    }
    
    const patterns = this.componentPatterns[framework];
    const sourceDir = this.pathResolver.getSourceDir();
    
    const files = await this._findFiles(sourceDir, patterns.patterns, patterns.exclude);
    const components = [];
    
    for (const file of files) {
      try {
        const component = await this._analyzeComponent(file, framework);
        if (component) {
          components.push(component);
        }
      } catch (error) {
        console.warn(`Failed to analyze component ${file}: ${error.message}`);
      }
    }
    
    return components;
  }

  /**
   * Discover API routes and endpoints
   * @param {string} projectRoot - Project root directory
   * @param {object} config - Project configuration
   * @returns {Promise<RouteInfo[]>} Discovered routes
   * @private
   */
  async _discoverRoutes(projectRoot, config) {
    const framework = config.framework?.backend;
    
    if (!framework) {
      return [];
    }
    
    const routePatterns = {
      express: ['**/routes/**/*.js', '**/controllers/**/*.js', '**/api/**/*.js'],
      fastify: ['**/routes/**/*.js', '**/handlers/**/*.js', '**/api/**/*.js'],
      fastapi: ['**/routes/**/*.py', '**/api/**/*.py', '**/endpoints/**/*.py'],
      flask: ['**/routes/**/*.py', '**/views/**/*.py', '**/api/**/*.py'],
      django: ['**/views/**/*.py', '**/urls.py']
    };
    
    const patterns = routePatterns[framework] || [];
    const sourceDir = this.pathResolver.getSourceDir();
    
    const files = await this._findFiles(sourceDir, patterns);
    const routes = [];
    
    for (const file of files) {
      try {
        const routeInfo = await this._analyzeRoutes(file, framework);
        routes.push(...routeInfo);
      } catch (error) {
        console.warn(`Failed to analyze routes in ${file}: ${error.message}`);
      }
    }
    
    return routes;
  }

  /**
   * Discover services and business logic
   * @param {string} projectRoot - Project root directory
   * @param {object} config - Project configuration
   * @returns {Promise<ServiceInfo[]>} Discovered services
   * @private
   */
  async _discoverServices(projectRoot, config) {
    const patterns = [
      '**/services/**/*.{js,ts,py}',
      '**/lib/**/*.{js,ts,py}',
      '**/utils/**/*.{js,ts,py}',
      '**/helpers/**/*.{js,ts,py}'
    ];
    
    const sourceDir = this.pathResolver.getSourceDir();
    const files = await this._findFiles(sourceDir, patterns);
    const services = [];
    
    for (const file of files) {
      try {
        const service = await this._analyzeService(file);
        if (service) {
          services.push(service);
        }
      } catch (error) {
        console.warn(`Failed to analyze service ${file}: ${error.message}`);
      }
    }
    
    return services;
  }

  /**
   * Discover type definitions and interfaces
   * @param {string} projectRoot - Project root directory
   * @param {object} config - Project configuration
   * @returns {Promise<TypeInfo[]>} Discovered types
   * @private
   */
  async _discoverTypes(projectRoot, config) {
    if (!config.language?.includes('typescript')) {
      return [];
    }
    
    const patterns = [
      '**/*.d.ts',
      '**/types/**/*.{ts,tsx}',
      '**/interfaces/**/*.{ts,tsx}'
    ];
    
    const sourceDir = this.pathResolver.getSourceDir();
    const files = await this._findFiles(sourceDir, patterns);
    const types = [];
    
    for (const file of files) {
      try {
        const typeInfo = await this._analyzeTypes(file);
        types.push(...typeInfo);
      } catch (error) {
        console.warn(`Failed to analyze types in ${file}: ${error.message}`);
      }
    }
    
    return types;
  }

  /**
   * Analyze project dependencies
   * @param {string} projectRoot - Project root directory
   * @param {object} config - Project configuration
   * @returns {Promise<DependencyInfo[]>} Dependency analysis
   * @private
   */
  async _analyzeDependencies(projectRoot, config) {
    const dependencies = [];
    
    // Analyze package.json (JavaScript/TypeScript)
    const packageJsonPath = path.join(projectRoot, 'package.json');
    if (await fs.pathExists(packageJsonPath)) {
      const packageJson = await fs.readJson(packageJsonPath);
      const deps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies
      };
      
      for (const [name, version] of Object.entries(deps)) {
        dependencies.push({
          name,
          version,
          type: packageJson.devDependencies?.[name] ? 'dev' : 'production',
          ecosystem: 'npm'
        });
      }
    }
    
    // Analyze requirements.txt (Python)
    const requirementsPath = path.join(projectRoot, 'requirements.txt');
    if (await fs.pathExists(requirementsPath)) {
      const content = await fs.readFile(requirementsPath, 'utf-8');
      const lines = content.split('\n').filter(line => line.trim() && !line.startsWith('#'));
      
      for (const line of lines) {
        const [name, version] = line.split(/[>=<]/);
        dependencies.push({
          name: name.trim(),
          version: version || 'latest',
          type: 'production',
          ecosystem: 'pip'
        });
      }
    }
    
    return dependencies;
  }

  /**
   * Analyze a component file
   * @param {string} filePath - Path to component file
   * @param {string} framework - Framework type
   * @returns {Promise<ComponentInfo>} Component information
   * @private
   */
  async _analyzeComponent(filePath, framework) {
    const content = await fs.readFile(filePath, 'utf-8');
    const relativePath = this.pathResolver.getRelativeToProject(filePath);
    const ext = path.extname(filePath);
    
    // Basic component analysis
    const component = {
      name: this._extractComponentName(filePath, content),
      path: relativePath,
      type: 'component',
      framework,
      language: this.fileTypeMap[ext] || 'unknown',
      metadata: {
        linesOfCode: content.split('\n').length,
        fileSize: content.length
      }
    };
    
    // Framework-specific analysis
    switch (framework) {
      case 'react':
        component.props = this._extractReactProps(content);
        component.hooks = this._extractReactHooks(content);
        break;
      case 'vue':
        component.props = this._extractVueProps(content);
        component.data = this._extractVueData(content);
        break;
      case 'angular':
        component.inputs = this._extractAngularInputs(content);
        component.outputs = this._extractAngularOutputs(content);
        break;
    }
    
    return component;
  }

  /**
   * Generate test cases for a component
   * @param {ComponentInfo} component - Component to generate tests for
   * @param {string[]} testTypes - Types of tests to generate
   * @returns {Promise<TestCase[]>} Generated test cases
   * @private
   */
  async _generateComponentTests(component, testTypes) {
    const testCases = [];
    
    if (testTypes.includes('unit')) {
      // Basic render test
      testCases.push({
        name: `${component.name} renders without crashing`,
        type: 'unit',
        target: component.name,
        template: `${component.framework}-component-render`,
        context: {
          componentName: component.name,
          componentPath: component.path,
          props: component.props || []
        }
      });
      
      // Props testing
      if (component.props && component.props.length > 0) {
        testCases.push({
          name: `${component.name} handles props correctly`,
          type: 'unit',
          target: component.name,
          template: `${component.framework}-component-props`,
          context: {
            componentName: component.name,
            componentPath: component.path,
            props: component.props
          }
        });
      }
      
      // Event handling tests
      if (component.events && component.events.length > 0) {
        testCases.push({
          name: `${component.name} handles events correctly`,
          type: 'unit',
          target: component.name,
          template: `${component.framework}-component-events`,
          context: {
            componentName: component.name,
            componentPath: component.path,
            events: component.events
          }
        });
      }
    }
    
    if (testTypes.includes('integration')) {
      testCases.push({
        name: `${component.name} integration test`,
        type: 'integration',
        target: component.name,
        template: `${component.framework}-component-integration`,
        context: {
          componentName: component.name,
          componentPath: component.path
        }
      });
    }
    
    return testCases;
  }

  /**
   * Find files matching patterns
   * @param {string} baseDir - Base directory to search
   * @param {string[]} patterns - Glob patterns
   * @param {string[]} exclude - Patterns to exclude
   * @returns {Promise<string[]>} Found files
   * @private
   */
  async _findFiles(baseDir, patterns, exclude = []) {
    const allFiles = [];
    
    for (const pattern of patterns) {
      try {
        const files = await globAsync(pattern, {
          cwd: baseDir,
          absolute: true,
          ignore: exclude
        });
        allFiles.push(...files);
      } catch (error) {
        console.warn(`Failed to find files with pattern ${pattern}: ${error.message}`);
      }
    }
    
    // Remove duplicates
    return [...new Set(allFiles)];
  }

  /**
   * Extract component name from file path and content
   * @param {string} filePath - Component file path
   * @param {string} content - File content
   * @returns {string} Component name
   * @private
   */
  _extractComponentName(filePath, content) {
    // Try to extract from export statement
    const exportMatch = content.match(/export\s+(?:default\s+)?(?:function\s+|class\s+|const\s+)?(\w+)/);
    if (exportMatch) {
      return exportMatch[1];
    }
    
    // Fallback to filename
    const basename = path.basename(filePath, path.extname(filePath));
    return basename.charAt(0).toUpperCase() + basename.slice(1);
  }

  /**
   * Extract React component props
   * @param {string} content - File content
   * @returns {object[]} Props information
   * @private
   */
  _extractReactProps(content) {
    const props = [];
    
    // Simple prop extraction (this could be much more sophisticated)
    const propMatches = content.matchAll(/(\w+):\s*(\w+)/g);
    for (const match of propMatches) {
      props.push({
        name: match[1],
        type: match[2],
        required: !content.includes(`${match[1]}?:`)
      });
    }
    
    return props;
  }

  /**
   * Extract React hooks usage
   * @param {string} content - File content
   * @returns {string[]} Used hooks
   * @private
   */
  _extractReactHooks(content) {
    const hookPattern = /use(\w+)/g;
    const hooks = [];
    let match;
    
    while ((match = hookPattern.exec(content)) !== null) {
      hooks.push(`use${match[1]}`);
    }
    
    return [...new Set(hooks)];
  }

  // Additional helper methods would be implemented here...
  // For brevity, showing the structure with key methods

  /**
   * Generate service tests
   * @param {ServiceInfo} service - Service to test
   * @param {string[]} testTypes - Test types
   * @returns {Promise<TestCase[]>} Test cases
   * @private
   */
  async _generateServiceTests(service, testTypes) {
    // Implementation for service test generation
    return [];
  }

  /**
   * Generate route tests
   * @param {RouteInfo} route - Route to test
   * @param {string[]} testTypes - Test types
   * @returns {Promise<TestCase[]>} Test cases
   * @private
   */
  async _generateRouteTests(route, testTypes) {
    // Implementation for route test generation
    return [];
  }

  /**
   * Calculate coverage targets
   * @param {ProjectDiscoveryResult} discoveryResult - Discovery results
   * @param {TestCase[]} testCases - Generated test cases
   * @returns {object} Coverage targets
   * @private
   */
  _calculateCoverageTargets(discoveryResult, testCases) {
    return {
      files: discoveryResult.components.length + discoveryResult.services.length,
      functions: testCases.filter(tc => tc.type === 'unit').length,
      lines: 80, // Default target
      branches: 70 // Default target
    };
  }

  /**
   * Estimate test execution time
   * @param {TestCase[]} testCases - Test cases
   * @returns {number} Estimated time in milliseconds
   * @private
   */
  _estimateExecutionTime(testCases) {
    const timeEstimates = {
      unit: 100,      // 100ms per unit test
      integration: 500, // 500ms per integration test
      e2e: 5000       // 5s per e2e test
    };
    
    return testCases.reduce((total, testCase) => {
      return total + (timeEstimates[testCase.type] || 100);
    }, 0);
  }

  /**
   * Detect frameworks used in project
   * @param {string} projectRoot - Project root
   * @param {object} config - Project config
   * @returns {string[]} Detected frameworks
   * @private
   */
  _detectFrameworks(projectRoot, config) {
    const frameworks = [];
    
    if (config.framework?.frontend) {
      frameworks.push(config.framework.frontend);
    }
    
    if (config.framework?.backend) {
      frameworks.push(config.framework.backend);
    }
    
    return frameworks;
  }
}

/**
 * Factory function to create ProjectDiscovery
 * @param {object} config - Configuration
 * @returns {ProjectDiscovery} ProjectDiscovery instance
 */
function createProjectDiscovery(config = {}) {
  return new ProjectDiscovery(config);
}

module.exports = {
  ProjectDiscovery,
  createProjectDiscovery
};