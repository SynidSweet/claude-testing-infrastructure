/**
 * JavaScript Project Adapter Implementation
 * 
 * This adapter handles JavaScript and TypeScript projects, providing
 * language-specific project detection, analysis, and configuration
 * for various JavaScript frameworks and environments.
 * 
 * @extends BaseProjectAdapter
 */

const path = require('path');
const { BaseProjectAdapter } = require('../base');

class JavaScriptAdapter extends BaseProjectAdapter {
  constructor() {
    super('javascript');
    this.supportedFrameworks = [
      // Frontend frameworks
      'react', 'vue', 'angular', 'svelte', 'preact', 'solid',
      // Backend frameworks
      'express', 'koa', 'fastify', 'nestjs', 'hapi',
      // Metaframeworks
      'nextjs', 'nuxt', 'gatsby', 'remix', 'astro',
      // Build tools
      'vite', 'webpack', 'rollup', 'parcel', 'esbuild',
      // Testing frameworks
      'jest', 'vitest', 'mocha', 'jasmine', 'ava',
      // Others
      'electron', 'react-native', 'expo'
    ];
  }

  /**
   * Detect if this adapter can handle the project
   * @param {string} projectPath - Path to the project directory
   * @returns {Promise<boolean>} True if this is a JavaScript/TypeScript project
   */
  async detect(projectPath) {
    // Check for package.json
    const hasPackageJson = await this.fileExists(path.join(projectPath, 'package.json'));
    if (hasPackageJson) return true;

    // Check for TypeScript config
    const hasTsConfig = await this.fileExists(path.join(projectPath, 'tsconfig.json'));
    if (hasTsConfig) return true;

    // Check for JavaScript files
    const jsFiles = await this.findFiles(projectPath, '**/*.{js,jsx,mjs,cjs}');
    if (jsFiles.length > 0) return true;

    // Check for TypeScript files
    const tsFiles = await this.findFiles(projectPath, '**/*.{ts,tsx}');
    if (tsFiles.length > 0) return true;

    // Check for Node.js indicators
    const hasNodeModules = await this.fileExists(path.join(projectPath, 'node_modules'));
    if (hasNodeModules) return true;

    return false;
  }

  /**
   * Get supported frameworks
   * @returns {string[]} Array of supported framework names
   */
  getSupportedFrameworks() {
    return this.supportedFrameworks;
  }

  /**
   * Language-specific validation
   * @protected
   * @param {string} projectPath - Path to the project directory
   * @returns {Promise<ValidationResult>} Validation results
   */
  async validateLanguageSpecific(projectPath) {
    const errors = [];
    const warnings = [];
    const suggestions = {};

    // Check for package.json
    const packageJsonPath = path.join(projectPath, 'package.json');
    const hasPackageJson = await this.fileExists(packageJsonPath);
    
    if (!hasPackageJson) {
      warnings.push('No package.json found. Consider initializing with npm init');
      suggestions.initialization = 'Run: npm init -y';
    } else {
      // Validate package.json
      const packageJson = await this.readJsonSafe(packageJsonPath);
      if (packageJson) {
        if (!packageJson.name) {
          warnings.push('package.json missing "name" field');
        }
        if (!packageJson.version) {
          warnings.push('package.json missing "version" field');
        }
        if (!packageJson.scripts || !packageJson.scripts.test) {
          suggestions.testScript = 'Add a test script to package.json: "test": "jest"';
        }
      }
    }

    // Check for lock files
    const hasNpmLock = await this.fileExists(path.join(projectPath, 'package-lock.json'));
    const hasYarnLock = await this.fileExists(path.join(projectPath, 'yarn.lock'));
    const hasPnpmLock = await this.fileExists(path.join(projectPath, 'pnpm-lock.yaml'));
    
    if (!hasNpmLock && !hasYarnLock && !hasPnpmLock) {
      warnings.push('No lock file found. Lock files ensure consistent dependencies');
      suggestions.lockFile = 'Run: npm install (or yarn/pnpm install)';
    }

    // Check for TypeScript configuration if TS files exist
    const tsFiles = await this.findFiles(projectPath, '**/*.{ts,tsx}');
    if (tsFiles.length > 0) {
      const hasTsConfig = await this.fileExists(path.join(projectPath, 'tsconfig.json'));
      if (!hasTsConfig) {
        warnings.push('TypeScript files found but no tsconfig.json');
        suggestions.typescript = 'Run: npx tsc --init';
      }
    }

    return { errors, warnings, suggestions };
  }

  /**
   * Language-specific project analysis
   * @protected
   * @param {string} projectPath - Path to the project directory
   * @returns {Promise<Object>} Analysis results
   */
  async analyzeLanguageSpecific(projectPath) {
    const [
      packageInfo,
      frameworks,
      projectType,
      entryPoints,
      buildTool,
      testRunner
    ] = await Promise.all([
      this.analyzePackageJson(projectPath),
      this.detectFrameworks(projectPath),
      this.detectProjectType(projectPath),
      this.findEntryPoints(projectPath),
      this.detectBuildTool(projectPath),
      this.detectTestRunner(projectPath)
    ]);

    return {
      packageInfo,
      frameworks,
      projectType,
      entryPoints,
      buildTool,
      testRunner
    };
  }

  /**
   * Analyze package.json
   * @private
   * @param {string} projectPath - Path to the project directory
   * @returns {Promise<PackageInfo>} Package information
   */
  async analyzePackageJson(projectPath) {
    const packageJsonPath = path.join(projectPath, 'package.json');
    const packageJson = await this.readJsonSafe(packageJsonPath);
    
    if (!packageJson) {
      return {
        name: path.basename(projectPath),
        version: '0.0.0',
        dependencies: {},
        devDependencies: {},
        scripts: {}
      };
    }

    return {
      name: packageJson.name || path.basename(projectPath),
      version: packageJson.version || '0.0.0',
      dependencies: packageJson.dependencies || {},
      devDependencies: packageJson.devDependencies || {},
      scripts: packageJson.scripts || {},
      type: packageJson.type, // 'module' or 'commonjs'
      engines: packageJson.engines
    };
  }

  /**
   * Detect frameworks in use
   * @private
   * @param {string} projectPath - Path to the project directory
   * @returns {Promise<string[]>} Detected frameworks
   */
  async detectFrameworks(projectPath) {
    const frameworks = [];
    const packageJson = await this.readJsonSafe(path.join(projectPath, 'package.json'));
    
    if (!packageJson) return frameworks;

    const allDeps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies
    };

    // Frontend frameworks
    if (allDeps.react || allDeps['react-dom']) frameworks.push('react');
    if (allDeps.vue) frameworks.push('vue');
    if (allDeps['@angular/core']) frameworks.push('angular');
    if (allDeps.svelte) frameworks.push('svelte');
    if (allDeps.preact) frameworks.push('preact');
    if (allDeps['solid-js']) frameworks.push('solid');

    // Backend frameworks
    if (allDeps.express) frameworks.push('express');
    if (allDeps.koa) frameworks.push('koa');
    if (allDeps.fastify) frameworks.push('fastify');
    if (allDeps['@nestjs/core']) frameworks.push('nestjs');
    if (allDeps['@hapi/hapi']) frameworks.push('hapi');

    // Metaframeworks
    if (allDeps.next) frameworks.push('nextjs');
    if (allDeps.nuxt) frameworks.push('nuxt');
    if (allDeps.gatsby) frameworks.push('gatsby');
    if (allDeps['@remix-run/react']) frameworks.push('remix');
    if (allDeps.astro) frameworks.push('astro');

    // Build tools
    if (allDeps.vite || await this.fileExists(path.join(projectPath, 'vite.config.js'))) {
      frameworks.push('vite');
    }
    if (await this.fileExists(path.join(projectPath, 'webpack.config.js'))) {
      frameworks.push('webpack');
    }

    return frameworks;
  }

  /**
   * Detect project type
   * @private
   * @param {string} projectPath - Path to the project directory
   * @returns {Promise<string>} Project type
   */
  async detectProjectType(projectPath) {
    const packageJson = await this.readJsonSafe(path.join(projectPath, 'package.json'));
    const frameworks = await this.detectFrameworks(projectPath);

    // Check if it's a library
    if (packageJson && packageJson.main && !packageJson.scripts?.start) {
      return 'library';
    }

    // Check for frontend indicators
    const hasFrontend = frameworks.some(f => 
      ['react', 'vue', 'angular', 'svelte', 'preact', 'solid'].includes(f)
    );

    // Check for backend indicators
    const hasBackend = frameworks.some(f => 
      ['express', 'koa', 'fastify', 'nestjs', 'hapi'].includes(f)
    );

    // Check for fullstack frameworks
    const isFullstack = frameworks.some(f => 
      ['nextjs', 'nuxt', 'remix'].includes(f)
    );

    if (isFullstack) return 'fullstack';
    if (hasFrontend && hasBackend) return 'fullstack';
    if (hasFrontend) return 'frontend';
    if (hasBackend) return 'backend';

    // Check for CLI tool
    if (packageJson?.bin) return 'cli';

    return 'unknown';
  }

  /**
   * Find entry points
   * @private
   * @param {string} projectPath - Path to the project directory
   * @returns {Promise<string[]>} Entry points
   */
  async findEntryPoints(projectPath) {
    const entryPoints = [];
    const packageJson = await this.readJsonSafe(path.join(projectPath, 'package.json'));

    // Check package.json main/module/browser fields
    if (packageJson) {
      if (packageJson.main) entryPoints.push(packageJson.main);
      if (packageJson.module) entryPoints.push(packageJson.module);
      if (packageJson.browser && typeof packageJson.browser === 'string') {
        entryPoints.push(packageJson.browser);
      }
    }

    // Common entry point patterns
    const commonEntryPoints = [
      'src/index.js', 'src/index.ts', 'src/index.jsx', 'src/index.tsx',
      'src/main.js', 'src/main.ts', 'src/app.js', 'src/app.ts',
      'index.js', 'index.ts', 'main.js', 'main.ts',
      'app.js', 'app.ts', 'server.js', 'server.ts'
    ];

    for (const entry of commonEntryPoints) {
      if (await this.fileExists(path.join(projectPath, entry))) {
        entryPoints.push(entry);
      }
    }

    return [...new Set(entryPoints)];
  }

  /**
   * Detect build tool
   * @private
   * @param {string} projectPath - Path to the project directory
   * @returns {Promise<string>} Build tool name
   */
  async detectBuildTool(projectPath) {
    // Check for config files
    if (await this.fileExists(path.join(projectPath, 'vite.config.js'))) return 'vite';
    if (await this.fileExists(path.join(projectPath, 'vite.config.ts'))) return 'vite';
    if (await this.fileExists(path.join(projectPath, 'webpack.config.js'))) return 'webpack';
    if (await this.fileExists(path.join(projectPath, 'rollup.config.js'))) return 'rollup';
    if (await this.fileExists(path.join(projectPath, '.parcelrc'))) return 'parcel';
    if (await this.fileExists(path.join(projectPath, 'esbuild.config.js'))) return 'esbuild';

    // Check package.json scripts
    const packageJson = await this.readJsonSafe(path.join(projectPath, 'package.json'));
    if (packageJson?.scripts) {
      const scripts = JSON.stringify(packageJson.scripts);
      if (scripts.includes('vite')) return 'vite';
      if (scripts.includes('webpack')) return 'webpack';
      if (scripts.includes('rollup')) return 'rollup';
      if (scripts.includes('parcel')) return 'parcel';
      if (scripts.includes('esbuild')) return 'esbuild';
      if (scripts.includes('tsc')) return 'typescript';
    }

    return 'none';
  }

  /**
   * Find test files
   * @protected
   * @param {string} projectPath - Path to the project directory
   * @returns {Promise<string[]>} Test file paths
   */
  async findTestFiles(projectPath) {
    return await this.findFiles(projectPath, '**/*.{test,spec}.{js,jsx,ts,tsx,mjs,cjs}');
  }

  /**
   * Detect test runner
   * @protected
   * @param {string} projectPath - Path to the project directory
   * @returns {Promise<string|null>} Test runner name
   */
  async detectTestRunner(projectPath) {
    const packageJson = await this.readJsonSafe(path.join(projectPath, 'package.json'));
    
    if (!packageJson) return null;

    const allDeps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies
    };

    // Check for test runners in dependencies
    if (allDeps.jest) return 'jest';
    if (allDeps.vitest) return 'vitest';
    if (allDeps.mocha) return 'mocha';
    if (allDeps.jasmine) return 'jasmine';
    if (allDeps.ava) return 'ava';
    if (allDeps['@playwright/test']) return 'playwright';
    if (allDeps.cypress) return 'cypress';

    // Check test script
    if (packageJson.scripts?.test) {
      const testScript = packageJson.scripts.test;
      if (testScript.includes('jest')) return 'jest';
      if (testScript.includes('vitest')) return 'vitest';
      if (testScript.includes('mocha')) return 'mocha';
      if (testScript.includes('jasmine')) return 'jasmine';
      if (testScript.includes('ava')) return 'ava';
    }

    // Check for config files
    if (await this.fileExists(path.join(projectPath, 'jest.config.js'))) return 'jest';
    if (await this.fileExists(path.join(projectPath, 'vitest.config.js'))) return 'vitest';
    if (await this.fileExists(path.join(projectPath, '.mocharc.js'))) return 'mocha';

    return null;
  }

  /**
   * Generate test configuration for JavaScript project
   * @param {ProjectAnalysis} analysis - Project analysis results
   * @returns {Promise<TestConfiguration>} Test configuration
   */
  async generateConfiguration(analysis) {
    const testRunner = analysis.existingTests.testRunner || this.selectTestRunner(analysis);
    const testDirectory = analysis.structure.testDirs[0] || this.selectTestDirectory(analysis);

    return {
      testRunner,
      testDirectory,
      runnerConfig: await this.generateRunnerConfig(testRunner, analysis),
      coverage: this.generateCoverageConfig(analysis),
      testPatterns: this.generateTestPatterns(testRunner, analysis),
      environment: this.generateEnvironmentConfig(analysis)
    };
  }

  /**
   * Select appropriate test runner
   * @private
   * @param {ProjectAnalysis} analysis - Project analysis
   * @returns {string} Selected test runner
   */
  selectTestRunner(analysis) {
    // If using Vite, prefer Vitest
    if (analysis.frameworks.includes('vite')) return 'vitest';
    
    // For React projects, prefer Jest
    if (analysis.frameworks.includes('react')) return 'jest';
    
    // For Vue projects, check version
    if (analysis.frameworks.includes('vue')) {
      // Could check Vue version here
      return 'vitest'; // Vue 3 works well with Vitest
    }

    // Default to Jest for most projects
    return 'jest';
  }

  /**
   * Select test directory structure
   * @private
   * @param {ProjectAnalysis} analysis - Project analysis
   * @returns {string} Test directory
   */
  selectTestDirectory(analysis) {
    // If tests already exist, follow existing pattern
    if (analysis.structure.conventions.directoryStructure === 'colocated') {
      return null; // Co-located with source
    }

    // Frontend projects often use __tests__
    if (analysis.projectType === 'frontend') {
      return '__tests__';
    }

    // Default to tests directory
    return 'tests';
  }

  /**
   * Generate runner configuration
   * @private
   * @param {string} runner - Test runner name
   * @param {ProjectAnalysis} analysis - Project analysis
   * @returns {Promise<Object>} Runner configuration
   */
  async generateRunnerConfig(runner, analysis) {
    const configs = {
      jest: () => this.generateJestConfig(analysis),
      vitest: () => this.generateVitestConfig(analysis),
      mocha: () => this.generateMochaConfig(analysis)
    };

    const generator = configs[runner];
    return generator ? await generator() : {};
  }

  /**
   * Generate Jest configuration
   * @private
   * @param {ProjectAnalysis} analysis - Project analysis
   * @returns {Object} Jest configuration
   */
  generateJestConfig(analysis) {
    const config = {
      testEnvironment: analysis.projectType === 'frontend' ? 'jsdom' : 'node',
      collectCoverageFrom: [
        'src/**/*.{js,jsx,ts,tsx}',
        '!src/**/*.d.ts',
        '!src/**/index.{js,ts}'
      ],
      setupFilesAfterEnv: ['<rootDir>/src/setupTests.js'],
      testMatch: [
        '<rootDir>/**/__tests__/**/*.{js,jsx,ts,tsx}',
        '<rootDir>/**/*.{spec,test}.{js,jsx,ts,tsx}'
      ],
      transform: {}
    };

    // Add TypeScript support
    if (analysis.buildConfig.hasTypeScript) {
      config.preset = 'ts-jest';
      config.transform['^.+\\.(ts|tsx)$'] = 'ts-jest';
    }

    // Add React support
    if (analysis.frameworks.includes('react')) {
      config.moduleNameMapper = {
        '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
        '\\.(gif|ttf|eot|svg|png)$': '<rootDir>/__mocks__/fileMock.js'
      };
    }

    return config;
  }

  /**
   * Generate Vitest configuration
   * @private
   * @param {ProjectAnalysis} analysis - Project analysis
   * @returns {Object} Vitest configuration
   */
  generateVitestConfig(analysis) {
    return {
      test: {
        environment: analysis.projectType === 'frontend' ? 'jsdom' : 'node',
        globals: true,
        setupFiles: './src/setupTests.js',
        coverage: {
          reporter: ['text', 'json', 'html'],
          exclude: ['node_modules/', 'src/setupTests.js']
        }
      }
    };
  }

  /**
   * Generate Mocha configuration
   * @private
   * @param {ProjectAnalysis} analysis - Project analysis
   * @returns {Object} Mocha configuration
   */
  generateMochaConfig(analysis) {
    return {
      require: analysis.buildConfig.hasTypeScript ? ['ts-node/register'] : [],
      extension: ['js', 'jsx', 'ts', 'tsx'],
      recursive: true,
      reporter: 'spec',
      timeout: 5000
    };
  }

  /**
   * Generate coverage configuration
   * @private
   * @param {ProjectAnalysis} analysis - Project analysis
   * @returns {CoverageConfig} Coverage configuration
   */
  generateCoverageConfig(analysis) {
    return {
      threshold: 80,
      include: ['src/**/*.{js,jsx,ts,tsx}'],
      exclude: [
        'node_modules',
        'test',
        'tests',
        '__tests__',
        '**/*.test.{js,jsx,ts,tsx}',
        '**/*.spec.{js,jsx,ts,tsx}',
        '**/index.{js,jsx,ts,tsx}'
      ],
      reporters: ['text', 'lcov', 'html']
    };
  }

  /**
   * Generate test patterns
   * @private
   * @param {string} runner - Test runner
   * @param {ProjectAnalysis} analysis - Project analysis
   * @returns {string[]} Test patterns
   */
  generateTestPatterns(runner, analysis) {
    const extensions = analysis.buildConfig.hasTypeScript ? 
      '{js,jsx,ts,tsx}' : '{js,jsx}';

    return [
      `**/__tests__/**/*.${extensions}`,
      `**/*.{test,spec}.${extensions}`
    ];
  }

  /**
   * Generate environment configuration
   * @private
   * @param {ProjectAnalysis} analysis - Project analysis
   * @returns {Object} Environment configuration
   */
  generateEnvironmentConfig(analysis) {
    const config = {
      node: process.version,
      variables: {
        NODE_ENV: 'test'
      }
    };

    if (analysis.projectType === 'frontend') {
      config.browser = ['chrome'];
    }

    return config;
  }

  /**
   * Get required test dependencies
   * @param {ProjectAnalysis} analysis - Project analysis results
   * @returns {Promise<Dependencies>} Required testing dependencies
   */
  async getTestDependencies(analysis) {
    const testRunner = analysis.existingTests.testRunner || 
      this.selectTestRunner(analysis);

    const required = [];
    const optional = [];

    // Test runner dependencies
    switch (testRunner) {
      case 'jest':
        required.push('jest', '@types/jest');
        if (analysis.projectType === 'frontend') {
          required.push('jest-environment-jsdom');
        }
        break;
      case 'vitest':
        required.push('vitest', '@vitest/ui');
        if (analysis.projectType === 'frontend') {
          required.push('jsdom');
        }
        break;
      case 'mocha':
        required.push('mocha', 'chai', '@types/mocha', '@types/chai');
        break;
    }

    // Framework-specific dependencies
    if (analysis.frameworks.includes('react')) {
      required.push(
        '@testing-library/react',
        '@testing-library/jest-dom',
        '@testing-library/user-event'
      );
    }

    if (analysis.frameworks.includes('vue')) {
      required.push('@vue/test-utils');
    }

    // TypeScript support
    if (analysis.buildConfig.hasTypeScript) {
      required.push('ts-jest', 'ts-node');
    }

    // E2E testing
    optional.push('@playwright/test', 'cypress');

    // Coverage
    optional.push('c8', 'nyc');

    return {
      required,
      optional,
      versions: {} // Could specify versions here
    };
  }

  /**
   * Get test templates applicable to this project
   * @param {ProjectAnalysis} analysis - Project analysis results
   * @returns {Promise<Template[]>} Array of applicable test templates
   */
  async getTestTemplates(analysis) {
    const templates = [];
    const baseTemplatePath = 'javascript';

    // Basic test templates
    templates.push({
      name: 'unit-test',
      path: `${baseTemplatePath}/unit/basic.template`,
      targetPath: analysis.structure.testDirs[0] || 'src',
      variables: { testRunner: analysis.existingTests.testRunner || 'jest' },
      description: 'Basic unit test template'
    });

    // Framework-specific templates
    if (analysis.frameworks.includes('react')) {
      templates.push(
        {
          name: 'react-component',
          path: `${baseTemplatePath}/react/component.template`,
          targetPath: 'src/components',
          variables: { componentName: '{{componentName}}' },
          description: 'React component test template'
        },
        {
          name: 'react-hook',
          path: `${baseTemplatePath}/react/hook.template`,
          targetPath: 'src/hooks',
          variables: { hookName: '{{hookName}}' },
          description: 'React custom hook test template'
        }
      );
    }

    if (analysis.frameworks.includes('express')) {
      templates.push({
        name: 'express-api',
        path: `${baseTemplatePath}/express/api.template`,
        targetPath: 'tests/api',
        variables: { endpoint: '{{endpoint}}' },
        description: 'Express API endpoint test template'
      });
    }

    return templates;
  }

  /**
   * Analyze build configuration
   * @protected
   * @param {string} projectPath - Path to the project directory
   * @returns {Promise<BuildInfo>} Build configuration information
   */
  async analyzeBuildConfig(projectPath) {
    const buildTool = await this.detectBuildTool(projectPath);
    const hasTypeScript = await this.fileExists(path.join(projectPath, 'tsconfig.json'));
    
    let outputDir = 'dist';
    let buildConfig = {};

    // Load build tool config
    switch (buildTool) {
      case 'vite':
        const viteConfig = await this.loadBuildConfig(projectPath, 'vite.config');
        if (viteConfig?.build?.outDir) outputDir = viteConfig.build.outDir;
        buildConfig = viteConfig || {};
        break;
        
      case 'webpack':
        const webpackConfig = await this.loadBuildConfig(projectPath, 'webpack.config');
        if (webpackConfig?.output?.path) outputDir = webpackConfig.output.path;
        buildConfig = webpackConfig || {};
        break;
    }

    return {
      buildTool,
      buildConfig,
      outputDir,
      hasTypeScript
    };
  }

  /**
   * Load build configuration file
   * @private
   * @param {string} projectPath - Project path
   * @param {string} configName - Config file name without extension
   * @returns {Promise<Object|null>} Build configuration
   */
  async loadBuildConfig(projectPath, configName) {
    // Try different extensions
    for (const ext of ['.js', '.ts', '.mjs', '.cjs']) {
      const configPath = path.join(projectPath, configName + ext);
      if (await this.fileExists(configPath)) {
        try {
          // In a real implementation, we'd need to handle require/import
          // For now, return null to indicate config exists but not loaded
          return null;
        } catch {
          return null;
        }
      }
    }
    return null;
  }
}

module.exports = JavaScriptAdapter;