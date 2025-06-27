module.exports = {
  // Test environment
  testEnvironment: '{{#if testEnvironment}}{{testEnvironment}}{{else}}jsdom{{/if}}',

  // Setup files
  setupFilesAfterEnv: ['<rootDir>/src/test-utils/setup.js'],

  // Module name mapping for CSS and static assets
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.(gif|ttf|eot|svg|png)$': '<rootDir>/src/test-utils/fileMock.js',
    '^@/(.*)$': '<rootDir>/src/$1'
  },

  // File extensions to consider
  moduleFileExtensions: [
    'js',
    {{#if typescript}}'ts', 'tsx',{{/if}}
    'json',
    'jsx'
  ],

  // Transform files
  transform: {
    '^.+\\.(js|jsx)$': 'babel-jest',
    {{#if typescript}}
    '^.+\\.(ts|tsx)$': 'ts-jest',
    {{/if}}
  },

  // Test match patterns
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.{js,jsx{{#if typescript}},ts,tsx{{/if}}}',
    '<rootDir>/src/**/?(*.)(spec|test).{js,jsx{{#if typescript}},ts,tsx{{/if}}}'
  ],

  // Coverage configuration
  collectCoverageFrom: [
    'src/**/*.{js,jsx{{#if typescript}},ts,tsx{{/if}}}',
    '!src/**/*.d.ts',
    '!src/index.js',
    '!src/serviceWorker.js',
    '!src/reportWebVitals.js'
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
    '<rootDir>/dist/'
  ],

  // Watch plugins
  watchPlugins: [
    'jest-watch-typeahead/filename',
    'jest-watch-typeahead/testname'
  ]
};