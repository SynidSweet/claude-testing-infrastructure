/**
 * Setup file for AI validation tests
 * Configures environment and utilities for comprehensive testing
 */

// Increase timeout for all tests in this suite
jest.setTimeout(20 * 60 * 1000); // 20 minutes

// Global test utilities
global.testUtils = {
  // Timeout constants
  TIMEOUTS: {
    SHORT: 5000,      // 5 seconds
    MEDIUM: 30000,    // 30 seconds  
    LONG: 120000,     // 2 minutes
    AI_GENERATION: 15 * 60 * 1000,  // 15 minutes
    PRODUCTION_WORKFLOW: 30 * 60 * 1000  // 30 minutes
  },

  // Test project paths
  TEST_PROJECTS: {
    REACT_ES_MODULES: require('path').join(__dirname, '../fixtures/validation-projects/react-es-modules'),
    REACT_COMMONJS: require('path').join(__dirname, '../fixtures/validation-projects/react-commonjs'),
    NODE_TYPESCRIPT: require('path').join(__dirname, '../fixtures/validation-projects/node-typescript'),
    PYTHON_FASTAPI: require('path').join(__dirname, '../fixtures/validation-projects/python-fastapi'),
    MIXED_LANGUAGE: require('path').join(__dirname, '../fixtures/validation-projects/mixed-language'),
    LARGE_CODEBASE: require('path').join(__dirname, '../fixtures/validation-projects/large-codebase')
  },

  // CLI command for consistent usage
  CLI_COMMAND: 'node dist/cli/index.js',

  // Validation thresholds
  QUALITY_THRESHOLDS: {
    MINIMUM_QUALITY_SCORE: 0.7,
    MINIMUM_EXECUTION_SUCCESS_RATE: 0.9,
    MAXIMUM_COMPLETION_TIME: 20 * 60 * 1000, // 20 minutes
    MAXIMUM_TODO_RATIO: 0.3 // Max 30% TODO comments
  },

  // Model aliases to test
  MODEL_ALIASES: ['sonnet', 'haiku', 'opus'],

  // Create timeout promise for racing against operations
  createTimeoutPromise: (ms, message = 'Operation timed out') => {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(message)), ms);
    });
  },

  // Sleep utility for delays
  sleep: (ms) => new Promise(resolve => setTimeout(resolve, ms)),

  // Cleanup utility for test outputs
  cleanupTestOutput: async (projectPath) => {
    const fs = require('fs/promises');
    const path = require('path');
    const testDir = path.join(projectPath, '.claude-testing');
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  },

  // Validate test file quality
  analyzeTestFileQuality: (testContent) => {
    const lines = testContent.split('\n');
    const totalLines = lines.length;
    
    const assertionCount = (testContent.match(/expect\(/g) || []).length;
    const todoCount = (testContent.match(/TODO|FIXME|XXX/gi) || []).length;
    const testCaseCount = (testContent.match(/test\(/g) || []).length;
    const importCount = (testContent.match(/^import /gm) || []).length;
    
    const meaningfulAssertions = countMeaningfulAssertions(testContent);
    const placeholderAssertions = assertionCount - meaningfulAssertions;
    
    const qualityScore = calculateQualityScore({
      assertionCount,
      todoCount,
      testCaseCount,
      meaningfulAssertions,
      totalLines
    });
    
    return {
      totalLines,
      assertionCount,
      todoCount,
      importCount,
      testCaseCount,
      executableTests: testCaseCount,
      qualityScore,
      meaningfulAssertions,
      placeholderAssertions
    };
  },

  // Check if CLI is available and built
  validateCLIAvailability: async () => {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    
    try {
      const result = await execAsync('node dist/cli/index.js --version', {
        cwd: require('path').resolve('.'),
        timeout: 10000
      });
      return result.stdout.includes('2.0.0');
    } catch (error) {
      throw new Error(`CLI not available or not built: ${error.message}`);
    }
  },

  // Extract import statements from test files
  extractImports: (testContent) => {
    const importLines = testContent.split('\n').filter(line => 
      line.trim().startsWith('import')
    );
    
    return importLines.map(line => {
      const isRelative = line.includes('./') || line.includes('../');
      const hasJsExtension = line.match(/\.js['"]$/);
      
      return {
        line: line.trim(),
        isRelative,
        hasJsExtension: !!hasJsExtension,
        path: extractPathFromImport(line)
      };
    });
  },

  // Check for common test issues
  validateTestSyntax: (testContent) => {
    const issues = [];
    
    // Check for balanced brackets
    const openBraces = (testContent.match(/{/g) || []).length;
    const closeBraces = (testContent.match(/}/g) || []).length;
    if (openBraces !== closeBraces) {
      issues.push('Unbalanced braces');
    }
    
    const openParens = (testContent.match(/\(/g) || []).length;
    const closeParens = (testContent.match(/\)/g) || []).length;
    if (openParens !== closeParens) {
      issues.push('Unbalanced parentheses');
    }
    
    // Check for template errors
    if (testContent.includes('{{') || testContent.includes('}}')) {
      issues.push('Template syntax not resolved');
    }
    
    if (testContent.includes('undefined')) {
      issues.push('Undefined values in generated code');
    }
    
    // Check for proper test structure
    if (!testContent.includes('describe(')) {
      issues.push('Missing describe block');
    }
    
    if (!testContent.includes('test(') && !testContent.includes('it(')) {
      issues.push('Missing test cases');
    }
    
    return issues;
  }
};

// Helper functions
function countMeaningfulAssertions(testContent) {
  const meaningfulPatterns = [
    /\.toBe\(/g,
    /\.toEqual\(/g,
    /\.toContain\(/g,
    /\.toHaveLength\(/g,
    /\.toBeGreaterThan\(/g,
    /\.toBeLessThan\(/g,
    /\.toThrow\(/g,
    /\.toHaveBeenCalled\(/g,
    /\.toMatchSnapshot\(/g,
    /\.toBeInstanceOf\(/g,
    /\.toBeNull\(/g,
    /\.toBeUndefined\(/g,
    /\.toBeTruthy\(/g,
    /\.toBeFalsy\(/g
  ];
  
  return meaningfulPatterns.reduce((count, pattern) => {
    return count + (testContent.match(pattern) || []).length;
  }, 0);
}

function calculateQualityScore(metrics) {
  const { assertionCount, todoCount, testCaseCount, meaningfulAssertions, totalLines } = metrics;
  
  // Start with base score
  let score = 0.5;
  
  // Penalties
  const todoPenalty = Math.min(todoCount * 0.1, 0.5);
  const lowAssertionPenalty = testCaseCount > 0 ? Math.max(0, (testCaseCount - assertionCount) * 0.1) : 0;
  
  // Bonuses
  const meaningfulAssertionBonus = meaningfulAssertions * 0.1;
  const testCoverageBonus = testCaseCount > 0 ? Math.min(testCaseCount * 0.05, 0.3) : 0;
  const contentDensityBonus = totalLines > 20 ? 0.1 : 0;
  
  // Apply adjustments
  score += meaningfulAssertionBonus;
  score += testCoverageBonus;
  score += contentDensityBonus;
  score -= todoPenalty;
  score -= lowAssertionPenalty;
  
  // Normalize to 0-1 range
  return Math.max(0, Math.min(1, score));
}

function extractPathFromImport(importLine) {
  const match = importLine.match(/from\s+['"]([^'"]+)['"]/);
  return match ? match[1] : null;
}

// Console utilities for better test output
global.testLogger = {
  info: (message) => console.log(`ℹ️  ${message}`),
  success: (message) => console.log(`✅ ${message}`),
  warning: (message) => console.log(`⚠️  ${message}`),
  error: (message) => console.log(`❌ ${message}`),
  critical: (message) => console.log(`🚨 CRITICAL: ${message}`),
  
  section: (title) => {
    console.log('\n' + '='.repeat(50));
    console.log(`📋 ${title}`);
    console.log('='.repeat(50));
  },
  
  subsection: (title) => {
    console.log(`\n🔍 ${title}`);
    console.log('-'.repeat(30));
  }
};

// Environment validation
beforeAll(async () => {
  // Validate that we have the necessary tools
  try {
    await global.testUtils.validateCLIAvailability();
    global.testLogger.success('CLI availability validated');
  } catch (error) {
    global.testLogger.critical(`CLI validation failed: ${error.message}`);
    throw error;
  }
  
  // Log test environment info
  global.testLogger.info(`Node.js version: ${process.version}`);
  global.testLogger.info(`Test timeout: ${20 * 60 * 1000}ms (20 minutes)`);
  global.testLogger.info(`Working directory: ${process.cwd()}`);
});

// Global error handler for unhandled promises
process.on('unhandledRejection', (reason, promise) => {
  global.testLogger.error(`Unhandled Rejection at: ${promise}, reason: ${reason}`);
});

// Export for use in other test files
module.exports = {
  testUtils: global.testUtils,
  testLogger: global.testLogger
};