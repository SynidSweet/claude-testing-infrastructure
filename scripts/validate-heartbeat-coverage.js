#!/usr/bin/env node

/**
 * Heartbeat Test Coverage Validation Script
 * 
 * Validates that unit tests for heartbeat monitoring components
 * achieve 100% code coverage target. Enhanced version with improved
 * Jest integration and detailed reporting.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const COVERAGE_THRESHOLD = 100;
const COMPONENTS = [
  'src/ai/heartbeat/HeartbeatMonitor.ts',
  'src/ai/heartbeat/HeartbeatScheduler.ts',
  'src/ai/heartbeat/ProcessHealthAnalyzer.ts'
];

const TEST_FILES = [
  'tests/ai/heartbeat/HeartbeatMonitor.test.ts',
  'tests/ai/heartbeat/HeartbeatScheduler.test.ts', 
  'tests/ai/heartbeat/ProcessHealthAnalyzer.test.ts'
];

console.log('🔍 Heartbeat Test Coverage Validation');
console.log('=====================================\n');

function runCoverageTests() {
  console.log('📋 Running unit tests with coverage for heartbeat components...\n');
  
  try {
    // Clean up any existing coverage data
    const coverageDir = path.join(process.cwd(), 'coverage');
    if (fs.existsSync(coverageDir)) {
      console.log('🧹 Cleaning existing coverage data...\n');
    }
    
    // Build Jest command with proper coverage configuration
    const jestArgs = [
      ...TEST_FILES,
      '--coverage',
      '--coverageReporters=text',
      '--coverageReporters=json-summary',
      ...COMPONENTS.map(comp => `--collectCoverageFrom='${comp}'`)
    ];
    
    const coverageCommand = `npx jest ${jestArgs.join(' ')}`;
    console.log('🏃 Executing:', coverageCommand.replace(/--collectCoverageFrom='[^']*'/g, '--collectCoverageFrom=<component>'));
    console.log();
    
    // Execute jest with coverage
    execSync(coverageCommand, { stdio: 'inherit' });
    
    console.log('\n📊 Analyzing coverage results...\n');
    
    // Parse coverage report
    const coveragePath = path.join(process.cwd(), 'coverage', 'coverage-summary.json');
    if (!fs.existsSync(coveragePath)) {
      throw new Error('Coverage summary file not found at: ' + coveragePath);
    }
    
    const coverage = JSON.parse(fs.readFileSync(coveragePath, 'utf8'));
    
    // Check coverage for each component
    let allPassed = true;
    const results = {};
    const failedComponents = [];
    
    COMPONENTS.forEach(component => {
      const componentName = path.basename(component, '.ts');
      const fullPath = path.join(process.cwd(), component);
      const componentCoverage = coverage[fullPath] || coverage[component];
      
      if (componentCoverage) {
        const metrics = {
          statements: componentCoverage.statements.pct,
          branches: componentCoverage.branches.pct, 
          functions: componentCoverage.functions.pct,
          lines: componentCoverage.lines.pct
        };
        
        // Check if all metrics meet threshold
        const failedMetrics = [];
        Object.entries(metrics).forEach(([type, pct]) => {
          if (pct < COVERAGE_THRESHOLD) {
            failedMetrics.push(`${type}: ${pct}%`);
          }
        });
        
        const passed = failedMetrics.length === 0;
        if (!passed) {
          failedComponents.push({
            name: componentName,
            failedMetrics
          });
        }
        
        allPassed = allPassed && passed;
        
        results[componentName] = {
          passed,
          metrics,
          failedMetrics
        };
        
        console.log(`📋 ${componentName}:`);
        console.log(`   Statements: ${metrics.statements}% ${metrics.statements >= COVERAGE_THRESHOLD ? '✅' : '❌'}`);
        console.log(`   Branches:   ${metrics.branches}% ${metrics.branches >= COVERAGE_THRESHOLD ? '✅' : '❌'}`);
        console.log(`   Functions:  ${metrics.functions}% ${metrics.functions >= COVERAGE_THRESHOLD ? '✅' : '❌'}`);
        console.log(`   Lines:      ${metrics.lines}% ${metrics.lines >= COVERAGE_THRESHOLD ? '✅' : '❌'}`);
        console.log(`   Overall:    ${passed ? '✅ PASS' : '❌ FAIL'}`);
        
        if (!passed) {
          console.log(`   ⚠️  Missing: ${failedMetrics.join(', ')}`);
        }
        console.log();
      } else {
        console.log(`⚠️  ${componentName}: No coverage data found`);
        allPassed = false;
        failedComponents.push({
          name: componentName,
          failedMetrics: ['No coverage data']
        });
        results[componentName] = { passed: false, metrics: null, failedMetrics: ['No coverage data'] };
      }
    });
    
    // Generate validation report
    const report = {
      timestamp: new Date().toISOString(),
      threshold: COVERAGE_THRESHOLD,
      overall: {
        status: allPassed ? 'PASS' : 'FAIL',
        totalComponents: COMPONENTS.length,
        passedComponents: COMPONENTS.length - failedComponents.length,
        failedComponents: failedComponents.length
      },
      components: results,
      failedComponents: failedComponents
    };
    
    const reportPath = 'coverage-validation-report.json';
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    console.log('='.repeat(60));
    console.log(`📊 VALIDATION SUMMARY`);
    console.log('='.repeat(60));
    console.log(`Target Coverage Threshold: ${COVERAGE_THRESHOLD}%`);
    console.log(`Components Tested: ${COMPONENTS.length}`);
    console.log(`Passed: ${COMPONENTS.length - failedComponents.length}`);
    console.log(`Failed: ${failedComponents.length}`);
    
    if (failedComponents.length > 0) {
      console.log('\n❌ FAILED COMPONENTS:');
      failedComponents.forEach(comp => {
        console.log(`   • ${comp.name}: ${comp.failedMetrics.join(', ')}`);
      });
    }
    
    console.log(`\n🎯 Overall Result: ${allPassed ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`📄 Report saved to: ${reportPath}`);
    
    if (!allPassed) {
      console.log('\n💡 To achieve 100% coverage, add tests for uncovered:');
      console.log('   - Statements (lines of code)');
      console.log('   - Branches (if/else conditions)'); 
      console.log('   - Functions (all methods)');
      console.log('   - Lines (executable lines)');
    }
    
    return allPassed;
    
  } catch (error) {
    console.error('\n❌ Coverage validation failed:');
    console.error('Error:', error.message);
    if (error.stdout) console.error('STDOUT:', error.stdout.toString());
    if (error.stderr) console.error('STDERR:', error.stderr.toString());
    return false;
  }
}

// Run validation
const success = runCoverageTests();
process.exit(success ? 0 : 1);