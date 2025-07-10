// Integration tests configuration - I/O-optimized
// CI environment detection - inline to avoid TypeScript import issues
function isCIEnvironment() {
  return !!(
    process.env.CI ||
    process.env.GITHUB_ACTIONS ||
    process.env.GITLAB_CI ||
    process.env.TRAVIS ||
    process.env.CIRCLECI ||
    process.env.JENKINS_URL
  );
}

/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  
  // Only include I/O-bound integration tests
  testMatch: [
    '**/tests/integration/**/*.test.ts',
    '**/tests/fixtures/**/*.test.ts'
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    'tests/fixtures/.*\\.claude-testing/',
    'validation/ai-agents'
  ],
  
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
  ],
  coverageDirectory: 'coverage-integration',
  coverageReporters: ['text', 'lcov'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@cli/(.*)$': '<rootDir>/src/cli/$1',
    '^@analyzers/(.*)$': '<rootDir>/src/analyzers/$1',
    '^@generators/(.*)$': '<rootDir>/src/generators/$1',
    '^@runners/(.*)$': '<rootDir>/src/runners/$1',
    '^@adapters/(.*)$': '<rootDir>/src/adapters/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
  },
  
  // Optimized for I/O-heavy tests
  testTimeout: 20000, // Longer timeout for file operations
  maxWorkers: isCIEnvironment() ? 1 : 2, // Limit workers for I/O contention
  
  // I/O test settings with advanced caching
  cache: true,
  cacheDirectory: '<rootDir>/.jest-cache-integration',
  detectOpenHandles: true,
  forceExit: true,
  
  // Enhanced memory management for long-running tests
  logHeapUsage: isCIEnvironment(),
  workerIdleMemoryLimit: '768MB', // Higher for I/O operations
  
  // I/O-specific optimizations
  clearMocks: true,
  restoreMocks: true,
  resetMocks: false,
  
  // Memory pressure monitoring
  exposedGC: false,
  slowTestThreshold: 10, // Flag slow I/O tests
  
  // Sequential execution for problematic tests
  bail: false,
  
  // Reporting
  reporters: isCIEnvironment() 
    ? ['default', ['jest-junit', { outputDirectory: 'test-results-integration' }]]
    : ['default'],
  verbose: isCIEnvironment(),
  
  // Setup/teardown optimization
  setupFilesAfterEnv: [],
  globalSetup: undefined,
  globalTeardown: undefined
};