// Jest setup file
// This file is executed before running tests

// Global test configuration
global.console = {
  ...console,
  // Uncomment to ignore console logs in tests
  // log: jest.fn(),
  // debug: jest.fn(),
  // info: jest.fn(),
  // warn: jest.fn(),
  // error: jest.fn(),
};

// Setup test environment
beforeAll(() => {
  // Global setup
});

afterAll(() => {
  // Global cleanup
});
