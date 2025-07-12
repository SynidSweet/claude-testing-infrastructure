// Performance-optimized Jest configuration for I/O-heavy tests
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
  testPathIgnorePatterns: [
    '/node_modules/',
    'tests/fixtures/.*\\.claude-testing/',
    ...(isCIEnvironment() ? ['tests/validation/ai-agents/'] : [])
  ],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@cli/(.*)$': '<rootDir>/src/cli/$1',
    '^@analyzers/(.*)$': '<rootDir>/src/analyzers/$1',
    '^@generators/(.*)$': '<rootDir>/src/generators/$1',
    '^@runners/(.*)$': '<rootDir>/src/runners/$1',
    '^@adapters/(.*)$': '<rootDir>/src/adapters/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
  },
  
  // Performance optimizations for mixed workloads
  testTimeout: 20000, // Increased for I/O operations
  maxWorkers: isCIEnvironment() ? 2 : 4, // Balanced for 8-core system
  detectOpenHandles: true,
  forceExit: true,
  
  // Advanced cache and memory optimizations
  cache: true,
  cacheDirectory: '<rootDir>/.jest-cache-perf',
  
  // Intelligent memory management
  logHeapUsage: isCIEnvironment(),
  workerIdleMemoryLimit: isCIEnvironment() ? '512MB' : '1GB',
  
  // Performance monitoring enhancements
  clearMocks: true,
  restoreMocks: true,
  resetMocks: false,
  slowTestThreshold: 5, // Identify performance bottlenecks
  
  // Heap optimization for mixed workloads
  exposedGC: isCIEnvironment(), // Enable GC monitoring in CI
  
  // Test execution optimization
  bail: false, // Continue running even if some tests fail
  
  // Improve startup time
  haste: {
    enableSymlinks: false,
  },
  
  // Reporter optimization
  reporters: isCIEnvironment() 
    ? ['default', ['jest-junit', { outputDirectory: 'test-results' }]]
    : ['default']
};