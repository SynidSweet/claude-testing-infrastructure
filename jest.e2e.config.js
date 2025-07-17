/**
 * Jest Configuration for End-to-End Tests
 * 
 * Separate configuration for E2E tests with appropriate timeouts and setup
 * Created as part of IMPL-E2E-001 - Create End-to-End Validation Suite
 */

const baseConfig = require('./jest.config.js');

module.exports = {
  ...baseConfig,
  displayName: 'E2E Tests',
  testMatch: [
    '**/tests/e2e/**/*.test.ts'
  ],
  testPathIgnorePatterns: [
    ...baseConfig.testPathIgnorePatterns || [],
    '\.claude-testing/',
    'tests/fixtures/',
    'tests/validation/',
    'tests/integration/',
    'tests/unit/'
  ],
  // E2E tests need longer timeouts
  testTimeout: 10 * 60 * 1000, // 10 minutes
  // Reduce concurrency for E2E tests to avoid resource conflicts
  maxWorkers: 2,
  // Setup for E2E tests
  setupFilesAfterEnv: [
    '<rootDir>/tests/e2e/setup.ts'
  ],
  // Clear mocks between tests
  clearMocks: true,
  // Collect coverage from E2E test runs
  collectCoverage: false, // Disable for E2E as it's not relevant
  // Handle longer operations
  forceExit: true,
  detectOpenHandles: true,
  // Verbose output for debugging E2E issues
  verbose: true
};