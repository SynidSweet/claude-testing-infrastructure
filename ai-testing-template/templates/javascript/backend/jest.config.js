module.exports = {
  // Test environment
  testEnvironment: 'node',

  // Setup files
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],

  // Module name mapping
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1'
  },

  // File extensions to consider
  moduleFileExtensions: [
    'js',
    {{#if typescript}}'ts',{{/if}}
    'json'
  ],

  // Transform files
  transform: {
    '^.+\\.js$': 'babel-jest',
    {{#if typescript}}
    '^.+\\.ts$': 'ts-jest',
    {{/if}}
  },

  // Test match patterns
  testMatch: [
    '<rootDir>/tests/**/*.test.{js{{#if typescript}},ts{{/if}}}',
    '<rootDir>/tests/**/*.spec.{js{{#if typescript}},ts{{/if}}}',
    '<rootDir>/src/**/__tests__/**/*.{js{{#if typescript}},ts{{/if}}}',
  ],

  // Coverage configuration
  collectCoverageFrom: [
    'src/**/*.{js{{#if typescript}},ts{{/if}}}',
    '!src/**/*.d.ts',
    '!src/index.js',
    '!src/server.js',
    '!src/config/**',
    '!src/migrations/**',
    '!src/seeds/**'
  ],

  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  },

  // Coverage reporters
  coverageReporters: ['text', 'lcov', 'html'],

  // Clear mocks between tests
  clearMocks: true,

  // Restore mocks after each test
  restoreMocks: true,

  {{#if typescript}}
  // TypeScript-specific configuration
  preset: 'ts-jest',
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.json'
    }
  },
  {{/if}}

  // Ignore patterns
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/build/',
    '<rootDir>/dist/',
    '<rootDir>/coverage/'
  ],

  // Test timeout
  testTimeout: 10000,

  // Force exit after tests complete
  forceExit: true,

  // Detect open handles
  detectOpenHandles: true,

  // Maximum worker threads
  maxWorkers: '50%',

  // Verbose output
  verbose: true
};