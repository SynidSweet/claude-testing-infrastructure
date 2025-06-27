/**
 * File System Analyzer using Adapter Pattern
 * 
 * This is a refactored version of FileSystemAnalyzer that uses the
 * new adapter pattern for language detection and project analysis.
 */

const path = require('path');
const { adapterFactory } = require('../../../shared/adapters');

/**
 * File system analysis utilities using the adapter pattern
 */
class FileSystemAnalyzer {
  constructor(projectPath = process.cwd()) {
    this.projectPath = projectPath;
    this.adapter = null;
    this.analysis = null;
  }

  /**
   * Initializes the analyzer by detecting the appropriate adapter
   * @returns {Promise<void>}
   */
  async initialize() {
    try {
      // Check for multi-language project
      const adapters = await this.detectAllLanguages();
      
      if (adapters.length > 1) {
        this.adapter = await adapterFactory.createMultiLanguageAdapter(this.projectPath);
      } else if (adapters.length === 1) {
        this.adapter = adapters[0];
      } else {
        throw new Error('No supported language detected in project');
      }
    } catch (error) {
      // If no adapter found, create a default response
      this.adapter = null;
    }
  }

  /**
   * Detect all languages in the project
   * @private
   * @returns {Promise<Array>} Array of adapters that can handle the project
   */
  async detectAllLanguages() {
    const adapters = [];
    const languages = adapterFactory.getSupportedLanguages();
    
    for (const language of languages) {
      const adapter = adapterFactory.getAdapterByLanguage(language);
      if (await adapter.detect(this.projectPath)) {
        adapters.push(adapter);
      }
    }
    
    return adapters;
  }

  /**
   * Detects if the current directory is a JavaScript/TypeScript project
   * @returns {Object} Detection results with framework info
   */
  async detectJavaScriptProject() {
    try {
      const jsAdapter = adapterFactory.getAdapterByLanguage('javascript');
      const isJavaScript = await jsAdapter.detect(this.projectPath);
      
      if (!isJavaScript) {
        return { isJavaScript: false };
      }

      const analysis = await jsAdapter.analyze(this.projectPath);
      
      // Convert to legacy format for backward compatibility
      const frameworks = {};
      analysis.frameworks.forEach(fw => {
        frameworks[fw] = true;
      });

      // Add specific framework mappings for backward compatibility
      if (frameworks.nextjs) frameworks.nextjs = true;
      if (frameworks.express) frameworks.express = true;
      if (frameworks.fastify) frameworks.fastify = true;
      if (frameworks.nestjs) frameworks.nestjs = true;
      
      return {
        isJavaScript: true,
        frameworks,
        projectType: analysis.projectType,
        packageJson: analysis.packageInfo,
        hasTypeScript: analysis.buildConfig.hasTypeScript
      };
    } catch (error) {
      console.warn('JavaScript detection error:', error.message);
      return { isJavaScript: false };
    }
  }

  /**
   * Detects if the current directory is a Python project
   * @returns {Object} Detection results with framework info
   */
  async detectPythonProject() {
    try {
      const pyAdapter = adapterFactory.getAdapterByLanguage('python');
      const isPython = await pyAdapter.detect(this.projectPath);
      
      if (!isPython) {
        return { isPython: false };
      }

      const analysis = await pyAdapter.analyze(this.projectPath);
      
      // Convert to legacy format for backward compatibility
      const frameworks = {};
      analysis.frameworks.forEach(fw => {
        frameworks[fw] = true;
      });
      
      return {
        isPython: true,
        frameworks,
        projectType: analysis.projectType,
        packageInfo: analysis.packageInfo,
        hasRequirementsTxt: frameworks.pip || frameworks.setuptools
      };
    } catch (error) {
      console.warn('Python detection error:', error.message);
      return { isPython: false };
    }
  }

  /**
   * Determines the project type based on detected frameworks
   * @param {Object} frameworks - Detected frameworks
   * @param {Object} packageJson - Package.json content
   * @returns {string} Project type
   */
  determineProjectType(frameworks, packageJson) {
    // This method is kept for backward compatibility
    // The adapters now handle this internally
    if (!this.adapter) return 'unknown';
    
    if (this.analysis) {
      return this.analysis.projectType;
    }
    
    // Fallback logic
    if (frameworks.react || frameworks.vue || frameworks.angular) return 'frontend';
    if (frameworks.express || frameworks.fastify || frameworks.nestjs) return 'backend';
    if (frameworks.nextjs) return 'fullstack';
    if (packageJson?.bin) return 'cli';
    return 'library';
  }

  /**
   * Checks if the project has TypeScript files
   * @returns {boolean}
   */
  async hasTypeScriptFiles() {
    if (this.adapter && this.adapter.getLanguage() === 'javascript') {
      const analysis = await this.adapter.analyze(this.projectPath);
      return analysis.buildConfig.hasTypeScript;
    }
    
    // Fallback to simple file check
    const glob = require('glob');
    const tsFiles = glob.sync('**/*.{ts,tsx}', { 
      cwd: this.projectPath,
      ignore: ['node_modules/**', 'dist/**', 'build/**']
    });
    return tsFiles.length > 0;
  }

  /**
   * Gets existing test structure in the project
   * @returns {Object} Test structure information
   */
  async getExistingTestStructure() {
    if (!this.adapter) {
      await this.initialize();
    }

    if (!this.adapter) {
      return {
        hasTests: false,
        testFiles: [],
        testFramework: null,
        testDirectories: []
      };
    }

    const analysis = await this.adapter.analyze(this.projectPath);
    
    return {
      hasTests: analysis.existingTests.hasTests,
      testFiles: analysis.existingTests.testFiles,
      testFramework: analysis.existingTests.testRunner,
      testDirectories: analysis.structure.testDirs
    };
  }

  /**
   * Analyzes the complete project structure
   * @returns {Promise<Object>} Complete project analysis
   */
  async analyzeProject() {
    // Initialize if not already done
    if (!this.adapter) {
      await this.initialize();
    }

    // Get individual language analyses for backward compatibility
    const [jsAnalysis, pyAnalysis] = await Promise.all([
      this.detectJavaScriptProject(),
      this.detectPythonProject()
    ]);
    
    const testStructure = await this.getExistingTestStructure();

    // Store full analysis for later use
    if (this.adapter) {
      this.analysis = await this.adapter.analyze(this.projectPath);
    }

    return {
      projectPath: this.projectPath,
      javascript: jsAnalysis,
      python: pyAnalysis,
      testing: testStructure,
      isEmpty: !jsAnalysis.isJavaScript && !pyAnalysis.isPython,
      isMultiLanguage: jsAnalysis.isJavaScript && pyAnalysis.isPython,
      // New adapter-based information
      adapter: this.adapter ? {
        language: this.adapter.getLanguage(),
        frameworks: this.adapter.getSupportedFrameworks(),
        analysis: this.analysis
      } : null
    };
  }

  /**
   * Gets test configuration using the adapter
   * @returns {Promise<Object>} Test configuration
   */
  async getTestConfiguration() {
    if (!this.adapter) {
      await this.initialize();
    }

    if (!this.adapter || !this.analysis) {
      throw new Error('No adapter available for test configuration');
    }

    return await this.adapter.generateConfiguration(this.analysis);
  }

  /**
   * Gets test dependencies using the adapter
   * @returns {Promise<Object>} Test dependencies
   */
  async getTestDependencies() {
    if (!this.adapter || !this.analysis) {
      throw new Error('No adapter available for test dependencies');
    }

    return await this.adapter.getTestDependencies(this.analysis);
  }

  /**
   * Gets available test templates
   * @returns {Promise<Array>} Test templates
   */
  async getTestTemplates() {
    if (!this.adapter || !this.analysis) {
      throw new Error('No adapter available for test templates');
    }

    return await this.adapter.getTestTemplates(this.analysis);
  }

  /**
   * Validates the project
   * @returns {Promise<Object>} Validation results
   */
  async validate() {
    if (!this.adapter) {
      await this.initialize();
    }

    if (!this.adapter) {
      return {
        valid: false,
        errors: ['No supported language detected'],
        warnings: [],
        suggestions: {}
      };
    }

    return await this.adapter.validate(this.projectPath);
  }
}

// Create a wrapper that maintains backward compatibility
class FileSystemAnalyzerCompat extends FileSystemAnalyzer {
  /**
   * Synchronous methods for backward compatibility
   * These wrap the async methods and use sync alternatives where possible
   */
  
  detectJavaScriptProject() {
    // For backward compatibility, provide sync version
    // This is a simplified check - full analysis requires async
    const fs = require('fs-extra');
    const packageJsonPath = path.join(this.projectPath, 'package.json');
    
    if (!fs.existsSync(packageJsonPath)) {
      return { isJavaScript: false };
    }

    try {
      const packageJson = fs.readJsonSync(packageJsonPath);
      const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
      
      const frameworks = {
        react: !!(dependencies.react || dependencies['@types/react']),
        nextjs: !!(dependencies.next),
        vue: !!(dependencies.vue || dependencies['@vue/cli-service']),
        angular: !!(dependencies['@angular/core']),
        express: !!(dependencies.express),
        fastify: !!(dependencies.fastify),
        nestjs: !!(dependencies['@nestjs/core']),
        vite: !!(dependencies.vite),
        webpack: !!(dependencies.webpack),
        typescript: !!(dependencies.typescript || dependencies['@types/node'])
      };

      const projectType = this.determineProjectTypeSync(frameworks, packageJson);
      
      return {
        isJavaScript: true,
        frameworks,
        projectType,
        packageJson,
        hasTypeScript: frameworks.typescript || this.hasTypeScriptFilesSync()
      };
    } catch (error) {
      return { isJavaScript: false };
    }
  }

  detectPythonProject() {
    // For backward compatibility, provide sync version
    const fs = require('fs-extra');
    const pythonFiles = [
      'setup.py', 'setup.cfg', 'pyproject.toml', 
      'requirements.txt', 'Pipfile', 'manage.py'
    ];
    
    const isPython = pythonFiles.some(file => 
      fs.existsSync(path.join(this.projectPath, file))
    );

    if (!isPython) {
      // Check for .py files
      const glob = require('glob');
      const pyFiles = glob.sync('**/*.py', { 
        cwd: this.projectPath,
        ignore: ['**/__pycache__/**', '**/venv/**', '**/.venv/**']
      });
      
      if (pyFiles.length === 0) {
        return { isPython: false };
      }
    }

    // Basic framework detection
    const frameworks = {};
    const files = fs.readdirSync(this.projectPath);
    
    if (files.includes('manage.py')) frameworks.django = true;
    if (files.includes('requirements.txt')) frameworks.pip = true;
    if (files.includes('setup.py')) frameworks.setuptools = true;
    if (files.includes('pyproject.toml')) frameworks.poetry = true;
    
    return {
      isPython: true,
      frameworks,
      projectType: frameworks.django ? 'backend' : 'library',
      hasRequirementsTxt: files.includes('requirements.txt')
    };
  }

  determineProjectTypeSync(frameworks, packageJson) {
    if (frameworks.react || frameworks.vue || frameworks.angular) return 'frontend';
    if (frameworks.express || frameworks.fastify || frameworks.nestjs) return 'backend';
    if (frameworks.nextjs) return 'fullstack';
    if (packageJson?.bin) return 'cli';
    return 'library';
  }

  hasTypeScriptFilesSync() {
    const glob = require('glob');
    const tsFiles = glob.sync('**/*.{ts,tsx}', { 
      cwd: this.projectPath,
      ignore: ['node_modules/**', 'dist/**', 'build/**']
    });
    return tsFiles.length > 0;
  }

  getExistingTestStructure() {
    // Sync version for backward compatibility
    const glob = require('glob');
    const testPatterns = [
      '**/*.test.{js,jsx,ts,tsx}',
      '**/*.spec.{js,jsx,ts,tsx}',
      '**/test_*.py',
      '**/*_test.py',
      '**/tests/**/*.{js,jsx,ts,tsx,py}',
      '**/__tests__/**/*.{js,jsx,ts,tsx}'
    ];
    
    const testFiles = [];
    testPatterns.forEach(pattern => {
      const files = glob.sync(pattern, {
        cwd: this.projectPath,
        ignore: ['node_modules/**', '**/dist/**', '**/build/**', '**/__pycache__/**']
      });
      testFiles.push(...files);
    });

    // Detect test framework
    let testFramework = null;
    const fs = require('fs-extra');
    
    if (fs.existsSync(path.join(this.projectPath, 'jest.config.js'))) {
      testFramework = 'jest';
    } else if (fs.existsSync(path.join(this.projectPath, 'vitest.config.js'))) {
      testFramework = 'vitest';
    } else if (fs.existsSync(path.join(this.projectPath, 'pytest.ini'))) {
      testFramework = 'pytest';
    }

    const testDirectories = [...new Set(testFiles.map(file => {
      const dir = path.dirname(file);
      if (dir.includes('__tests__') || dir.includes('tests') || dir.includes('test')) {
        return dir.split(path.sep).find(d => d.includes('test'));
      }
      return null;
    }).filter(Boolean))];

    return {
      hasTests: testFiles.length > 0,
      testFiles,
      testFramework,
      testDirectories
    };
  }

  analyzeProject() {
    // Sync version for backward compatibility
    const jsAnalysis = this.detectJavaScriptProject();
    const pyAnalysis = this.detectPythonProject();
    const testStructure = this.getExistingTestStructure();

    return {
      projectPath: this.projectPath,
      javascript: jsAnalysis,
      python: pyAnalysis,
      testing: testStructure,
      isEmpty: !jsAnalysis.isJavaScript && !pyAnalysis.isPython,
      isMultiLanguage: jsAnalysis.isJavaScript && pyAnalysis.isPython
    };
  }
}

module.exports = FileSystemAnalyzerCompat;