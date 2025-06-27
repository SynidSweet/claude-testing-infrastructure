/**
 * React Frontend Framework Adapter
 * 
 * Provides React-specific project detection, configuration, and testing setup.
 * Implements the IFrameworkAdapter interface for stable API compatibility.
 */

const fs = require('fs-extra');
const path = require('path');
const { IFrameworkAdapter } = require('../../core/interfaces');

/**
 * React Framework Adapter
 * Handles React projects including Create React App, Next.js, and Vite setups
 */
class ReactAdapter extends IFrameworkAdapter {
  constructor() {
    super();
    this.version = '1.0.0';
    this.frameworkName = 'react';
  }

  /**
   * Get component version
   * @returns {string} Component version
   */
  getVersion() {
    return this.version;
  }

  /**
   * Get framework name
   * @returns {string} Framework name
   */
  getFrameworkName() {
    return this.frameworkName;
  }

  /**
   * Detect if this adapter can handle the project
   * @param {string} projectRoot - Project root directory
   * @returns {Promise<boolean>} True if adapter can handle project
   */
  async detectProject(projectRoot) {
    try {
      const packageJsonPath = path.join(projectRoot, 'package.json');
      
      if (!await fs.pathExists(packageJsonPath)) {
        return false;
      }
      
      const packageJson = await fs.readJson(packageJsonPath);
      const dependencies = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies
      };
      
      // Check for React dependencies
      return !!(
        dependencies.react ||
        dependencies['@types/react'] ||
        dependencies['react-dom'] ||
        dependencies['next'] ||
        packageJson.name?.includes('react')
      );
      
    } catch (error) {
      console.warn(`React detection error: ${error.message}`);
      return false;
    }
  }

  /**
   * Get default configuration for React projects
   * @returns {object} Default configuration
   */
  getDefaultConfig() {
    return {
      framework: {
        frontend: 'react',
        testing: {
          unit: 'jest',
          integration: 'jest',
          e2e: 'playwright'
        }
      },
      language: ['javascript'],
      structure: {
        sourceDir: 'src',
        testDir: null, // Co-located tests
        buildDir: 'build',
        publicDir: 'public'
      },
      entryPoints: {
        frontend: 'src/index.js'
      },
      testPatterns: {
        unit: '**/*.{test,spec}.{js,jsx,ts,tsx}',
        integration: '**/integration/**/*.{test,spec}.{js,jsx,ts,tsx}',
        e2e: '**/e2e/**/*.{test,spec}.{js,ts}'
      },
      coverage: {
        include: ['src/**/*.{js,jsx,ts,tsx}'],
        exclude: [
          'src/index.js',
          'src/index.tsx',
          'src/reportWebVitals.js',
          'src/setupTests.js',
          'src/**/*.stories.{js,jsx,ts,tsx}',
          'src/**/*.test.{js,jsx,ts,tsx}',
          'src/**/*.spec.{js,jsx,ts,tsx}'
        ]
      },
      environment: {
        node: '16',
        browser: ['chrome', 'firefox'],
        variables: {
          NODE_ENV: 'test',
          PUBLIC_URL: ''
        }
      }
    };
  }

  /**
   * Get test templates for React projects
   * @returns {string[]} Array of template names
   */
  getTestTemplates() {
    return [
      'react-component-render',
      'react-component-props',
      'react-component-events',
      'react-component-hooks',
      'react-component-integration',
      'react-custom-hooks',
      'react-context-provider',
      'react-routing',
      'react-form-validation',
      'react-async-components',
      'react-error-boundary',
      'react-accessibility'
    ];
  }

  /**
   * Setup test environment for React projects
   * @param {object} config - Project configuration
   * @returns {Promise<EnvironmentSetup>} Environment setup results
   */
  async setupTestEnvironment(config) {
    const setup = {
      success: false,
      dependencies: [],
      configurations: [],
      errors: []
    };

    try {
      // Detect React variant
      const variant = await this._detectReactVariant(config.projectRoot);
      
      // Setup dependencies based on variant
      setup.dependencies = await this._getRequiredDependencies(variant, config);
      
      // Setup configurations
      setup.configurations = await this._generateConfigurations(variant, config);
      
      // Setup test utilities
      const testUtils = await this._setupTestUtilities(variant, config);
      setup.configurations.push(...testUtils);
      
      setup.success = true;
      
    } catch (error) {
      setup.errors.push(error.message);
    }

    return setup;
  }

  /**
   * Analyze React project specifics
   * @param {string} projectRoot - Project root directory
   * @returns {Promise<object>} React-specific analysis
   */
  async analyzeReactProject(projectRoot) {
    try {
      const [
        variant,
        components,
        hooks,
        routing,
        stateManagement,
        styling
      ] = await Promise.all([
        this._detectReactVariant(projectRoot),
        this._analyzeComponents(projectRoot),
        this._analyzeHooks(projectRoot),
        this._analyzeRouting(projectRoot),
        this._analyzeStateManagement(projectRoot),
        this._analyzeStyling(projectRoot)
      ]);

      return {
        variant,
        components,
        hooks,
        routing,
        stateManagement,
        styling,
        recommendations: this._generateReactRecommendations({
          variant,
          components,
          hooks,
          routing,
          stateManagement,
          styling
        })
      };

    } catch (error) {
      throw new Error(`React project analysis failed: ${error.message}`);
    }
  }

  // Private methods

  /**
   * Detect React variant (CRA, Next.js, Vite, etc.)
   * @param {string} projectRoot - Project root directory
   * @returns {Promise<string>} React variant
   * @private
   */
  async _detectReactVariant(projectRoot) {
    const packageJsonPath = path.join(projectRoot, 'package.json');
    
    if (!await fs.pathExists(packageJsonPath)) {
      return 'unknown';
    }
    
    const packageJson = await fs.readJson(packageJsonPath);
    const dependencies = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies
    };
    
    // Check for specific variants
    if (dependencies.next) return 'nextjs';
    if (dependencies.vite || dependencies['@vitejs/plugin-react']) return 'vite';
    if (dependencies['react-scripts']) return 'create-react-app';
    if (dependencies.gatsby) return 'gatsby';
    if (packageJson.scripts?.start?.includes('react-scripts')) return 'create-react-app';
    
    // Check for custom webpack or other build tools
    if (await fs.pathExists(path.join(projectRoot, 'webpack.config.js'))) return 'webpack';
    if (await fs.pathExists(path.join(projectRoot, 'rollup.config.js'))) return 'rollup';
    
    return 'custom';
  }

  /**
   * Get required dependencies for React testing
   * @param {string} variant - React variant
   * @param {object} config - Project configuration
   * @returns {Promise<string[]>} Required dependencies
   * @private
   */
  async _getRequiredDependencies(variant, config) {
    const baseDependencies = [
      '@testing-library/react',
      '@testing-library/jest-dom',
      '@testing-library/user-event',
      'jest-environment-jsdom'
    ];

    const variantDependencies = {
      'create-react-app': [],
      'nextjs': ['@testing-library/jest-dom'],
      'vite': ['vitest', '@vitest/ui', 'jsdom'],
      'gatsby': ['gatsby-plugin-testing'],
      'custom': ['jest', 'babel-jest'],
      'webpack': ['jest', 'babel-jest'],
      'rollup': ['jest', 'babel-jest']
    };

    // Add TypeScript dependencies if needed
    const isTypeScript = config.language?.includes('typescript');
    if (isTypeScript) {
      baseDependencies.push('@types/jest', 'ts-jest');
    }

    // Add E2E testing dependencies
    if (config.framework?.testing?.e2e === 'playwright') {
      baseDependencies.push('@playwright/test');
    } else if (config.framework?.testing?.e2e === 'cypress') {
      baseDependencies.push('cypress');
    }

    return [
      ...baseDependencies,
      ...(variantDependencies[variant] || variantDependencies.custom)
    ];
  }

  /**
   * Generate Jest configuration for React
   * @param {string} variant - React variant
   * @param {object} config - Project configuration
   * @returns {Promise<object[]>} Configuration files
   * @private
   */
  async _generateConfigurations(variant, config) {
    const configurations = [];
    
    // Jest configuration
    const jestConfig = this._generateJestConfig(variant, config);
    configurations.push({
      file: 'jest.config.js',
      content: jestConfig,
      description: 'Jest testing configuration'
    });

    // Setup files
    const setupTest = this._generateSetupTest(variant, config);
    configurations.push({
      file: 'src/setupTests.js',
      content: setupTest,
      description: 'Test setup and global configurations'
    });

    // Playwright configuration (if E2E testing is enabled)
    if (config.framework?.testing?.e2e === 'playwright') {
      const playwrightConfig = this._generatePlaywrightConfig(config);
      configurations.push({
        file: 'playwright.config.js',
        content: playwrightConfig,
        description: 'Playwright E2E testing configuration'
      });
    }

    // Vite-specific configuration
    if (variant === 'vite') {
      const vitestConfig = this._generateVitestConfig(config);
      configurations.push({
        file: 'vitest.config.js',
        content: vitestConfig,
        description: 'Vitest configuration for Vite projects'
      });
    }

    return configurations;
  }

  /**
   * Generate Jest configuration
   * @param {string} variant - React variant
   * @param {object} config - Project configuration
   * @returns {string} Jest configuration
   * @private
   */
  _generateJestConfig(variant, config) {
    const isTypeScript = config.language?.includes('typescript');
    
    const jestConfig = {
      testEnvironment: 'jsdom',
      setupFilesAfterEnv: ['<rootDir>/src/setupTests.js'],
      moduleNameMapper: {
        '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
        '\\.(gif|ttf|eot|svg|png)$': '<rootDir>/src/__mocks__/fileMock.js'
      },
      testMatch: [
        '<rootDir>/src/**/__tests__/**/*.{js,jsx,ts,tsx}',
        '<rootDir>/src/**/?(*.)(spec|test).{js,jsx,ts,tsx}'
      ],
      collectCoverageFrom: [
        'src/**/*.{js,jsx,ts,tsx}',
        '!src/**/*.d.ts',
        '!src/index.{js,tsx}',
        '!src/reportWebVitals.{js,ts}',
        '!src/setupTests.{js,ts}'
      ],
      coverageThreshold: {
        global: {
          branches: config.coverage?.threshold?.branches || 70,
          functions: config.coverage?.threshold?.functions || 80,
          lines: config.coverage?.threshold?.lines || 80,
          statements: config.coverage?.threshold?.statements || 80
        }
      },
      transform: {}
    };

    // Add TypeScript support
    if (isTypeScript) {
      jestConfig.preset = 'ts-jest';
      jestConfig.transform['^.+\\.(ts|tsx)$'] = 'ts-jest';
    }

    // Variant-specific configurations
    switch (variant) {
      case 'create-react-app':
        jestConfig.transformIgnorePatterns = [
          '[/\\\\]node_modules[/\\\\].+\\.(js|jsx|mjs|cjs|ts|tsx)$',
          '^.+\\.module\\.(css|sass|scss)$'
        ];
        break;
        
      case 'nextjs':
        jestConfig.testEnvironment = 'jsdom';
        jestConfig.setupFilesAfterEnv.push('<rootDir>/jest.setup.js');
        break;
        
      case 'vite':
        // Vite uses Vitest instead of Jest
        return this._generateVitestConfig(config);
    }

    return `module.exports = ${JSON.stringify(jestConfig, null, 2)};`;
  }

  /**
   * Generate setup test file
   * @param {string} variant - React variant
   * @param {object} config - Project configuration
   * @returns {string} Setup test content
   * @private
   */
  _generateSetupTest(variant, config) {
    return `// Setup file for React Testing Library
import '@testing-library/jest-dom';

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
};

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
};

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock scrollTo
window.scrollTo = jest.fn();

// Mock fetch if not available
if (!global.fetch) {
  global.fetch = jest.fn();
}

// Custom test utilities
global.testUtils = {
  wait: (ms = 0) => new Promise(resolve => setTimeout(resolve, ms)),
  createMockFunction: (returnValue) => jest.fn().mockReturnValue(returnValue),
  createMockPromise: (resolveValue, rejectValue) => {
    if (rejectValue) {
      return Promise.reject(rejectValue);
    }
    return Promise.resolve(resolveValue);
  }
};`;
  }

  /**
   * Setup test utilities and helpers
   * @param {string} variant - React variant
   * @param {object} config - Project configuration
   * @returns {Promise<object[]>} Test utility configurations
   * @private
   */
  async _setupTestUtilities(variant, config) {
    const utilities = [];

    // Test utilities
    utilities.push({
      file: 'src/test-utils/index.js',
      content: this._generateTestUtils(config),
      description: 'Custom test utilities and helpers'
    });

    // File mock
    utilities.push({
      file: 'src/__mocks__/fileMock.js',
      content: "module.exports = 'test-file-stub';",
      description: 'Mock for static file imports'
    });

    // Style mock
    utilities.push({
      file: 'src/__mocks__/styleMock.js',
      content: "module.exports = {};",
      description: 'Mock for CSS imports'
    });

    return utilities;
  }

  /**
   * Generate test utilities
   * @param {object} config - Project configuration
   * @returns {string} Test utilities content
   * @private
   */
  _generateTestUtils(config) {
    return `import React from 'react';
import { render, queries } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

// Custom queries (extend default queries if needed)
const customQueries = {
  ...queries,
};

/**
 * Test wrapper that includes common providers
 */
export const TestWrapper = ({ 
  children, 
  initialRoute = '/',
  ...props 
}) => {
  return (
    <BrowserRouter initialEntries={[initialRoute]}>
      {children}
    </BrowserRouter>
  );
};

/**
 * Custom render function that includes providers
 */
export const renderWithProviders = (ui, options = {}) => {
  const {
    initialRoute = '/',
    ...renderOptions
  } = options;

  const Wrapper = ({ children }) => (
    <TestWrapper initialRoute={initialRoute}>
      {children}
    </TestWrapper>
  );

  return render(ui, { wrapper: Wrapper, ...renderOptions });
};

/**
 * Create mock handlers for API calls
 */
export const createMockHandlers = (baseUrl = '/api') => ({
  get: (endpoint, response) =>
    jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => response,
    }),
  
  post: (endpoint, response) =>
    jest.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => response,
    }),
});

/**
 * Common test data factories
 */
export const createTestData = {
  user: (overrides = {}) => ({
    id: '1',
    name: 'Test User',
    email: 'test@example.com',
    ...overrides,
  }),

  component: (overrides = {}) => ({
    id: '1',
    title: 'Test Component',
    description: 'Test description',
    ...overrides,
  }),
};

// Re-export everything from @testing-library/react
export * from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';`;
  }

  /**
   * Analyze React components in project
   * @param {string} projectRoot - Project root directory
   * @returns {Promise<object>} Component analysis
   * @private
   */
  async _analyzeComponents(projectRoot) {
    // Implementation for component analysis
    return {
      count: 0,
      types: [],
      complexity: 'low'
    };
  }

  /**
   * Analyze custom hooks usage
   * @param {string} projectRoot - Project root directory
   * @returns {Promise<object>} Hooks analysis
   * @private
   */
  async _analyzeHooks(projectRoot) {
    // Implementation for hooks analysis
    return {
      customHooks: [],
      builtInHooks: []
    };
  }

  /**
   * Analyze routing setup
   * @param {string} projectRoot - Project root directory
   * @returns {Promise<object>} Routing analysis
   * @private
   */
  async _analyzeRouting(projectRoot) {
    // Implementation for routing analysis
    return {
      library: null,
      routes: []
    };
  }

  /**
   * Analyze state management
   * @param {string} projectRoot - Project root directory
   * @returns {Promise<object>} State management analysis
   * @private
   */
  async _analyzeStateManagement(projectRoot) {
    // Implementation for state management analysis
    return {
      library: null,
      patterns: []
    };
  }

  /**
   * Analyze styling approach
   * @param {string} projectRoot - Project root directory
   * @returns {Promise<object>} Styling analysis
   * @private
   */
  async _analyzeStyling(projectRoot) {
    // Implementation for styling analysis
    return {
      approach: 'css',
      libraries: []
    };
  }

  /**
   * Generate React-specific recommendations
   * @param {object} analysis - Project analysis
   * @returns {string[]} Recommendations
   * @private
   */
  _generateReactRecommendations(analysis) {
    const recommendations = [];
    
    if (analysis.components.count > 10) {
      recommendations.push('Consider implementing component testing strategy');
    }
    
    if (analysis.hooks.customHooks.length > 0) {
      recommendations.push('Add unit tests for custom hooks');
    }
    
    if (analysis.routing.routes.length > 5) {
      recommendations.push('Implement route-based testing');
    }
    
    return recommendations;
  }
}

/**
 * Factory function to create React adapter
 * @returns {ReactAdapter} React adapter instance
 */
function createReactAdapter() {
  return new ReactAdapter();
}

module.exports = {
  ReactAdapter,
  createReactAdapter
};