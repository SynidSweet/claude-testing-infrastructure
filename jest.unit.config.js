// Fast unit tests configuration - CPU-bound tests only
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
  roots: ['<rootDir>/tests', '<rootDir>/src'],
  
  // Only include fast CPU-bound tests
  testMatch: [
    '**/tests/utils/**/*.test.ts',
    '**/tests/generators/**/*.test.ts',
    '**/tests/analyzers/**/*.test.ts',
    '**/tests/config/**/*.test.ts'
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '\\.claude-testing/',
    '/tests/integration/',
    '/tests/validation/',
    '/tests/fixtures/',
    '/tests/ai/',
    '/tests/e2e/'
  ],
  
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
  ],
  coverageDirectory: 'coverage-unit',
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
  
  // Optimized for fast CPU-bound tests
  testTimeout: 5000,
  maxWorkers: isCIEnvironment() ? '75%' : 6, // Optimal for 8-core system with headroom
  
  // Performance-tuned execution settings
  cache: true,
  cacheDirectory: '<rootDir>/.jest-cache-unit',
  bail: false,
  
  // Memory and heap optimizations
  detectOpenHandles: true, // Enable to identify resource leaks
  forceExit: true, // Force exit to prevent hanging workers
  logHeapUsage: false,
  workerIdleMemoryLimit: '256MB', // Conservative for CPU-bound tests
  
  // Advanced cache optimizations
  clearMocks: true,
  restoreMocks: true,
  resetMocks: false, // Faster than full reset
  
  // Fast reporting
  reporters: ['default'],
  verbose: false,
  
  // Improve startup time
  haste: {
    enableSymlinks: false,
  }
};