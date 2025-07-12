/**
 * CI-specific test setup for aggressive timeout and cleanup handling
 * This file is only loaded in CI environments to prevent test hangs
 */

// Global test timeout override for CI
jest.setTimeout(45000); // 45 seconds max per test

// Aggressive process cleanup to prevent hangs
let activeTimeouts = new Set();
let activeIntervals = new Set();

// Override setTimeout to track active timers
const originalSetTimeout = global.setTimeout;
global.setTimeout = function(callback, delay, ...args) {
  const timeoutId = originalSetTimeout.call(this, callback, delay, ...args);
  activeTimeouts.add(timeoutId);
  return timeoutId;
};

// Override setInterval to track active intervals
const originalSetInterval = global.setInterval;
global.setInterval = function(callback, delay, ...args) {
  const intervalId = originalSetInterval.call(this, callback, delay, ...args);
  activeIntervals.add(intervalId);
  return intervalId;
};

// Override clearTimeout to clean up tracking
const originalClearTimeout = global.clearTimeout;
global.clearTimeout = function(timeoutId) {
  activeTimeouts.delete(timeoutId);
  return originalClearTimeout.call(this, timeoutId);
};

// Override clearInterval to clean up tracking
const originalClearInterval = global.clearInterval;
global.clearInterval = function(intervalId) {
  activeIntervals.delete(intervalId);
  return originalClearInterval.call(this, intervalId);
};

// Force cleanup after each test
afterEach(async () => {
  // Clear all tracked timers
  for (const timeoutId of activeTimeouts) {
    clearTimeout(timeoutId);
  }
  for (const intervalId of activeIntervals) {
    clearInterval(intervalId);
  }
  activeTimeouts.clear();
  activeIntervals.clear();

  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }

  // Give a tick for cleanup to complete
  await new Promise(resolve => setImmediate(resolve));
});

// Global error handler to prevent uncaught exceptions from hanging tests
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception in CI test:', error);
  // Don't exit in tests, just log
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection in CI test:', reason);
  // Don't exit in tests, just log
});

// Log CI-specific test configuration
console.log('🔧 CI timeout setup loaded: 45s timeout, aggressive cleanup enabled');