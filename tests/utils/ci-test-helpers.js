/**
 * CI test utilities for skipping problematic tests and providing CI-specific behavior
 */

/**
 * Check if running in CI environment
 */
function isCI() {
  return !!(
    process.env.CI ||
    process.env.GITHUB_ACTIONS ||
    process.env.GITLAB_CI ||
    process.env.TRAVIS ||
    process.env.CIRCLECI ||
    process.env.JENKINS_URL
  );
}

/**
 * Skip test if running in CI and SKIP_INTEGRATION_TESTS is set
 */
function skipIfCI(testName = 'test') {
  if (isCI() && process.env.SKIP_INTEGRATION_TESTS) {
    return test.skip;
  }
  return test;
}

/**
 * Skip test suite if running in CI and SKIP_INTEGRATION_TESTS is set
 */
function describeSkipIfCI(suiteName = 'suite') {
  if (isCI() && process.env.SKIP_INTEGRATION_TESTS) {
    return describe.skip;
  }
  return describe;
}

/**
 * Skip specific problematic tests by name
 */
function skipProblematicTest(testName) {
  const problematicTests = (process.env.SKIP_TESTS || '').split(',').map(s => s.trim());
  if (isCI() && problematicTests.includes(testName)) {
    return test.skip;
  }
  return test;
}

/**
 * Create a test with reduced timeout for CI
 */
function testWithTimeout(name, testFn, timeout = null) {
  const ciTimeout = timeout || (isCI() ? 30000 : 10000);
  return test(name, testFn, ciTimeout);
}

/**
 * Create a test that's only run locally (skipped in CI)
 */
function testLocalOnly(name, testFn, timeout = null) {
  if (isCI()) {
    return test.skip(name, testFn, timeout);
  }
  return test(name, testFn, timeout);
}

/**
 * Create a test that's only run in CI (skipped locally)
 */
function testCIOnly(name, testFn, timeout = null) {
  if (!isCI()) {
    return test.skip(name, testFn, timeout);
  }
  return test(name, testFn, timeout);
}

/**
 * Wrap test function with CI-specific error handling
 */
function withCIErrorHandling(testFn) {
  return async (...args) => {
    if (!isCI()) {
      return testFn(...args);
    }

    try {
      const result = await testFn(...args);
      return result;
    } catch (error) {
      // In CI, provide more context for debugging
      console.error(`CI Test Error in ${testFn.name || 'anonymous test'}:`, error);
      throw error;
    }
  };
}

module.exports = {
  isCI,
  skipIfCI,
  describeSkipIfCI,
  skipProblematicTest,
  testWithTimeout,
  testLocalOnly,
  testCIOnly,
  withCIErrorHandling
};