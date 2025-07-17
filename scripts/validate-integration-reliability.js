#!/usr/bin/env node

/**
 * Integration Test Reliability Validation Script
 * 
 * Runs heartbeat monitoring integration tests multiple times to ensure they pass
 * consistently without timeouts or flaky failures. Enhanced version that tests
 * all relevant integration test files.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const INTEGRATION_TESTS = [
  'tests/ai/heartbeat-monitoring.optimized.test.ts',
  'tests/ai/heartbeat/HeartbeatMonitor.integration.test.ts'
];

const NUM_RUNS = 10;
const TIMEOUT_MS = 120000; // 2 minutes per run

console.log('🔄 Integration Test Reliability Validation');
console.log('==========================================\n');

console.log('📋 Testing files:');
INTEGRATION_TESTS.forEach(test => {
  console.log(`   • ${test}`);
});
console.log(`\n🔄 Running each test ${NUM_RUNS} times...\n`);

const allResults = {};
let overallSuccess = true;

// Run each test file multiple times
for (const testFile of INTEGRATION_TESTS) {
  const testName = path.basename(testFile, '.test.ts');
  console.log(`\n📂 Testing: ${testName}`);
  console.log('='.repeat(60));
  
  const results = [];
  let consecutivePasses = 0;
  let currentStreak = 0;
  
  for (let i = 1; i <= NUM_RUNS; i++) {
    process.stdout.write(`Run ${i}/${NUM_RUNS}: `);
    const startTime = Date.now();
    
    try {
      // Use npx jest with specific test file
      execSync(`npx jest ${testFile}`, {
        stdio: 'pipe',
        timeout: TIMEOUT_MS
      });
      
      const duration = Date.now() - startTime;
      console.log(`✅ PASS (${duration}ms)`);
      
      results.push({
        run: i,
        passed: true,
        duration,
        error: null
      });
      
      currentStreak++;
      consecutivePasses = Math.max(consecutivePasses, currentStreak);
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Analyze error type
      let errorMessage = 'Test failure';
      if (error.message.includes('TIMEOUT') || error.killed) {
        errorMessage = 'Test timeout';
      } else if (error.stderr) {
        const stderr = error.stderr.toString();
        if (stderr.includes('FAIL')) {
          errorMessage = 'Test assertion failure';
        } else if (stderr.includes('timeout')) {
          errorMessage = 'Jest timeout';
        }
      }
      
      console.log(`❌ FAIL - ${errorMessage} (${duration}ms)`);
      
      results.push({
        run: i,
        passed: false,
        duration,
        error: errorMessage,
        details: error.stderr ? error.stderr.toString().slice(0, 200) : null
      });
      
      currentStreak = 0;
    }
  }
  
  // Calculate statistics for this test file
  const passCount = results.filter(r => r.passed).length;
  const passRate = (passCount / NUM_RUNS) * 100;
  const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / NUM_RUNS;
  const maxDuration = Math.max(...results.map(r => r.duration));
  const minDuration = Math.min(...results.map(r => r.duration));
  const isReliable = passRate === 100;
  
  if (!isReliable) {
    overallSuccess = false;
  }
  
  allResults[testName] = {
    testFile,
    totalRuns: NUM_RUNS,
    passCount,
    failCount: NUM_RUNS - passCount,
    passRate: parseFloat(passRate.toFixed(1)),
    consecutivePasses,
    isReliable,
    timingStats: {
      average: Math.round(avgDuration),
      min: minDuration,
      max: maxDuration
    },
    runs: results
  };
  
  // Print summary for this test
  console.log(`\n📊 ${testName} Results:`);
  console.log(`   Pass Rate: ${passRate.toFixed(1)}% (${passCount}/${NUM_RUNS})`);
  console.log(`   Max Consecutive: ${consecutivePasses} passes`);
  console.log(`   Avg Duration: ${Math.round(avgDuration)}ms`);
  console.log(`   Status: ${isReliable ? '✅ RELIABLE' : '❌ UNRELIABLE'}`);
  
  if (!isReliable) {
    const failures = results.filter(r => !r.passed);
    console.log(`   Failures: ${failures.map(f => `Run ${f.run} (${f.error})`).join(', ')}`);
  }
}

// Calculate overall statistics
const totalRuns = Object.values(allResults).reduce((sum, r) => sum + r.totalRuns, 0);
const totalPasses = Object.values(allResults).reduce((sum, r) => sum + r.passCount, 0);
const overallPassRate = (totalPasses / totalRuns) * 100;
const reliableTests = Object.values(allResults).filter(r => r.isReliable).length;

// Generate comprehensive report
const report = {
  timestamp: new Date().toISOString(),
  summary: {
    totalTestFiles: INTEGRATION_TESTS.length,
    reliableTestFiles: reliableTests,
    unreliableTestFiles: INTEGRATION_TESTS.length - reliableTests,
    totalRuns,
    totalPasses,
    totalFailures: totalRuns - totalPasses,
    overallPassRate: parseFloat(overallPassRate.toFixed(1)),
    allTestsReliable: overallSuccess,
    overall: overallSuccess ? 'PASS' : 'FAIL'
  },
  testResults: allResults,
  configuration: {
    runsPerTest: NUM_RUNS,
    timeoutMs: TIMEOUT_MS,
    reliabilityThreshold: 100 // 100% pass rate required
  }
};

const reportPath = 'integration-reliability-report.json';
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

// Final summary
console.log('\n' + '='.repeat(70));
console.log('📊 OVERALL RELIABILITY SUMMARY');
console.log('='.repeat(70));
console.log(`Test Files: ${INTEGRATION_TESTS.length}`);
console.log(`Reliable Tests: ${reliableTests}/${INTEGRATION_TESTS.length}`);
console.log(`Total Runs: ${totalRuns}`);
console.log(`Total Pass Rate: ${overallPassRate.toFixed(1)}%`);

if (!overallSuccess) {
  console.log('\n❌ UNRELIABLE TESTS:');
  Object.entries(allResults).forEach(([name, result]) => {
    if (!result.isReliable) {
      console.log(`   • ${name}: ${result.passRate}% pass rate (${result.failCount} failures)`);
    }
  });
}

console.log(`\n🎯 Overall Result: ${overallSuccess ? '✅ PASS - All tests reliable' : '❌ FAIL - Some tests unreliable'}`);
console.log(`📄 Detailed report saved to: ${reportPath}`);

if (overallSuccess) {
  console.log('\n✨ All integration tests demonstrate 100% reliability!');
  console.log('   This validates that the refactoring eliminated flaky behavior.');
} else {
  console.log('\n🔧 Recommendations:');
  console.log('   • Review failing tests for remaining timer dependencies');
  console.log('   • Check for race conditions or async issues');
  console.log('   • Consider additional mocking or test isolation');
  console.log('   • Verify test cleanup and teardown procedures');
}

process.exit(overallSuccess ? 0 : 1);