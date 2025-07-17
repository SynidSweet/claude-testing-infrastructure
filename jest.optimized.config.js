// High-performance Jest configuration for maximum speed
// Optimized for systems with 8+ cores and 16+ GB RAM
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

function getOptimalWorkerCount() {
  const cores = require('os').cpus().length;
  if (isCIEnvironment()) {
    // Conservative in CI to avoid resource contention
    return Math.min(cores - 1, 4);
  }
  // Aggressive local optimization for 8-core system
  return cores === 8 ? 6 : Math.min(cores - 1, 8);
}

function getMemoryLimit() {
  const totalMemory = require('os').totalmem();
  const totalGB = Math.round(totalMemory / 1024 / 1024 / 1024);
  
  if (isCIEnvironment()) {
    return '256MB'; // Conservative for CI
  }
  
  // Dynamic memory allocation based on system capacity
  if (totalGB >= 32) return '1GB';
  if (totalGB >= 16) return '768MB';
  return '512MB';
}

/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  
  // Exclude heavy integration tests for maximum speed
  testMatch: [
    '**/tests/(utils|generators|analyzers|config)/**/*.test.ts'
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '\.claude-testing/',
    'integration',
    'validation', 
    'fixtures',
    'ai',
    'e2e'
  ],
  
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      // Aggressive compilation optimizations  
      useESM: false,
      transpileOnly: true, // Skip type checking for speed
    }],
  },
  
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
  ],
  coverageDirectory: 'coverage-optimized',
  coverageReporters: ['text-summary'], // Minimal reporting for speed
  
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@cli/(.*)$': '<rootDir>/src/cli/$1',
    '^@analyzers/(.*)$': '<rootDir>/src/analyzers/$1',
    '^@generators/(.*)$': '<rootDir>/src/generators/$1',
    '^@runners/(.*)$': '<rootDir>/src/runners/$1',
    '^@adapters/(.*)$': '<rootDir>/src/adapters/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
  },
  
  // Maximum performance settings
  testTimeout: 3000, // Aggressive timeout for fast tests only
  maxWorkers: getOptimalWorkerCount(),
  
  // Aggressive caching and memory optimizations
  cache: true,
  cacheDirectory: '<rootDir>/.jest-cache-optimized',
  clearMocks: true,
  restoreMocks: true,
  resetMocks: false, // Avoid expensive full resets
  
  // Memory management optimizations
  workerIdleMemoryLimit: getMemoryLimit(),
  logHeapUsage: false, // Disable for maximum speed
  
  // Minimal overhead settings
  detectOpenHandles: false,
  forceExit: false,
  bail: false,
  verbose: false,
  
  // Performance monitoring
  slowTestThreshold: 2, // Identify slow tests aggressively
  
  // Advanced optimizations
  haste: {
    enableSymlinks: false,
    throwOnModuleCollision: false, // Skip collision checks for speed
  },
  
  // Minimal reporting for maximum speed
  reporters: ['default'],
  
  // Skip setup/teardown for pure unit tests
  setupFilesAfterEnv: [],
  globalSetup: undefined,
  globalTeardown: undefined,
  
  // Disable expensive features for speed
  collectCoverage: false, // Can be enabled with --coverage flag
  errorOnDeprecated: false, // Skip deprecation warnings
  
  // Module resolution optimizations
  modulePathIgnorePatterns: [
    '<rootDir>/dist/',
    '<rootDir>/coverage/',
    '<rootDir>/.jest-cache',
    '<rootDir>/node_modules/.cache/'
  ],
};