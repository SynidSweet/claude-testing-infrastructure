/**
 * Custom test sequencer for AI validation tests
 * Ensures tests run in optimal order for reliability and debugging
 */

const DefaultSequencer = require('@jest/test-sequencer').default;

class AIValidationSequencer extends DefaultSequencer {
  sort(tests) {
    // Define test priority order
    const testOrder = [
      // 1. Basic connectivity and setup tests (fastest, most fundamental)
      'connectivity/claude-cli-integration.test.ts',
      
      // 2. Model recognition tests (critical for AI features)
      'model-recognition/model-aliases.test.ts',
      
      // 3. Generation quality tests (core functionality)
      'generation-quality/test-quality-validation.test.ts',
      
      // 4. End-to-end tests (comprehensive, slowest)
      'end-to-end/production-readiness.test.ts',
      'end-to-end/complete-workflow.test.ts',
      
      // 5. Performance and stress tests (last, most resource intensive)
      'performance/timeout-handling.test.ts',
      'performance/large-codebase.test.ts'
    ];

    // Sort tests based on priority order
    const sortedTests = tests.sort((testA, testB) => {
      const pathA = this.getRelativePath(testA.path);
      const pathB = this.getRelativePath(testB.path);
      
      const indexA = this.getTestPriority(pathA, testOrder);
      const indexB = this.getTestPriority(pathB, testOrder);
      
      // If both tests have defined priorities, sort by priority
      if (indexA !== -1 && indexB !== -1) {
        return indexA - indexB;
      }
      
      // If only one has priority, prioritize it
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      
      // For tests without specific priority, sort alphabetically
      return pathA.localeCompare(pathB);
    });

    // Log test execution order for debugging
    console.log('\n📋 AI Validation Test Execution Order:');
    sortedTests.forEach((test, index) => {
      const relativePath = this.getRelativePath(test.path);
      const priority = this.getTestCategory(relativePath);
      console.log(`   ${index + 1}. ${relativePath} [${priority}]`);
    });
    console.log('');

    return sortedTests;
  }

  /**
   * Get relative path from tests/validation directory
   */
  getRelativePath(fullPath) {
    const validationIndex = fullPath.indexOf('tests/validation/');
    if (validationIndex === -1) return fullPath;
    
    return fullPath.substring(validationIndex + 'tests/validation/'.length);
  }

  /**
   * Get test priority index
   */
  getTestPriority(path, orderArray) {
    return orderArray.findIndex(pattern => path.includes(pattern));
  }

  /**
   * Categorize test for logging
   */
  getTestCategory(path) {
    if (path.includes('connectivity/')) return 'CONNECTIVITY';
    if (path.includes('model-recognition/')) return 'MODEL_RECOGNITION';
    if (path.includes('generation-quality/')) return 'QUALITY';
    if (path.includes('end-to-end/')) return 'END_TO_END';
    if (path.includes('performance/')) return 'PERFORMANCE';
    return 'OTHER';
  }
}

module.exports = AIValidationSequencer;