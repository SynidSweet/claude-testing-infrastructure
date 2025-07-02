/**
 * Jest configuration for AI Agent Validation Tests
 * 
 * Specialized configuration for testing the AI agent validation system
 * with longer timeouts and specific test patterns
 */

module.exports = {
  // Display name for this test suite
  displayName: 'AI Agent Validation',

  // Test environment
  testEnvironment: 'node',

  // Test file patterns
  testMatch: [
    '<rootDir>/tests/validation/**/*.test.{js,ts}',
    '<rootDir>/tests/validation/**/*.spec.{js,ts}'
  ],

  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/build/',
    '/.claude-testing/'
  ],

  // Setup files
  setupFilesAfterEnv: [
    '<rootDir>/tests/validation/setup.js'
  ],

  // Module file extensions
  moduleFileExtensions: [
    'js',
    'ts',
    'jsx',
    'tsx',
    'json'
  ],

  // Transform configuration
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: {
        target: 'es2020',
        module: 'commonjs',
        moduleResolution: 'node',
        allowSyntheticDefaultImports: true,
        esModuleInterop: true
      }
    }],
    '^.+\\.(js|jsx)$': ['babel-jest', {
      presets: [
        ['@babel/preset-env', {
          targets: { node: 'current' }
        }]
      ]
    }]
  },

  // Module name mapping
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1',
    '^@fixtures/(.*)$': '<rootDir>/tests/fixtures/$1'
  },

  // Extended timeouts for AI operations
  testTimeout: 20 * 60 * 1000, // 20 minutes for AI validation tests

  // Globals
  globals: {
    'ts-jest': {
      useESM: false
    }
  },

  // Coverage configuration (optional for validation tests)
  collectCoverage: false,
  coverageDirectory: '<rootDir>/coverage/ai-validation',
  coverageReporters: ['text', 'lcov', 'html'],

  // Verbose output for debugging
  verbose: true,

  // Detect open handles (useful for debugging hanging tests)
  detectOpenHandles: true,
  forceExit: true,

  // Reporter configuration
  reporters: [
    'default',
    ['jest-junit', {
      outputDirectory: '<rootDir>/test-results/ai-validation',
      outputName: 'ai-validation-results.xml',
      suiteName: 'AI Agent Validation Tests'
    }]
  ],

  // Environment variables for AI validation
  setupFiles: [
    '<rootDir>/tests/validation/env.setup.js'
  ],

  // Test sequencer for proper test ordering
  testSequencer: '<rootDir>/tests/validation/testSequencer.js',

  // Note: Jest 29 doesn't support retry configuration built-in
  // Retries would need to be implemented at the test level if needed
  
  // Custom test environment variables
  testEnvironmentOptions: {
    // Increase Node.js memory limit for large test operations
    node: '--max-old-space-size=4096'
  },

  // Worker configuration
  maxWorkers: 1, // Run tests sequentially to avoid API rate limits
  workerIdleMemoryLimit: '1GB',

  // Error handling
  errorOnDeprecated: false,
  
  // Silent mode for cleaner output during validation
  silent: false,

  // Cache configuration
  cache: false, // Disable cache for validation to ensure fresh runs

  // Watch configuration (for development)
  watchPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/coverage/',
    '/.claude-testing/',
    '/test-results/'
  ]
};