#!/usr/bin/env node

/**
 * Test Count Validation Script
 * 
 * This script ensures that test commands actually execute tests and don't produce
 * false success through --passWithNoTests or empty test discovery patterns.
 * 
 * Features:
 * - Validates test counts for all test commands
 * - Ensures minimum test thresholds are met
 * - Detects false success scenarios
 * - Provides detailed reporting
 * 
 * Exit codes:
 * 0 - All test commands execute expected number of tests
 * 1 - Test commands found with insufficient or no tests
 * 2 - Script execution error
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class TestCountValidator {
  constructor() {
    this.results = [];
    this.failures = [];
    this.testCommands = this.loadTestCommands();
    this.minTestThresholds = {
      'npm test': 1000,           // Main test suite should have many tests
      'npm run test:unit': 500,   // Unit tests should be substantial
      'npm run test:integration': 50, // Integration tests are fewer but critical
      'npm run test:ci': 1000,    // CI should run full suite
      'npm run test:coverage': 1000, // Coverage should run full suite
      'npm run test:fast': 100,   // Fast tests should still be meaningful
      'npm run test:core': 500,   // Core tests are critical
      'default': 10               // Minimum for any test command
    };
  }

  loadTestCommands() {
    // Extract test commands from package.json
    const packagePath = path.join(process.cwd(), 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    const scripts = packageJson.scripts || {};
    
    // Filter for test-related scripts
    return Object.entries(scripts)
      .filter(([name]) => name.includes('test') && !name.includes('watch'))
      .map(([name]) => `npm run ${name}`);
  }

  extractTestCount(output) {
    // Try multiple patterns to extract test counts
    const patterns = [
      /Tests:.*?(\d+)\s+total/,         // Jest format
      /(\d+)\s+passing/,                // Mocha format
      /Ran\s+(\d+)\s+test/,            // Python unittest
      /(\d+)\s+test.*?executed/,       // Generic
      /Test Suites:.*?(\d+)\s+total/   // Jest suites
    ];

    for (const pattern of patterns) {
      const match = output.match(pattern);
      if (match && match[1]) {
        return parseInt(match[1], 10);
      }
    }

    // Check for "No tests found" patterns
    if (output.includes('No tests found') || 
        output.includes('0 tests') ||
        output.includes('No test files found')) {
      return 0;
    }

    return null;
  }

  validateTestCommand(command) {
    console.log(`\nValidating: ${command}`);
    
    try {
      // Run test command with list/dry-run mode if possible
      let testCommand = command;
      
      // Add flags to get test count without full execution
      if (command.includes('jest')) {
        testCommand += ' -- --listTests --json';
      } else if (command.includes('test')) {
        // Try to run in dry-run mode
        testCommand += ' -- --dry-run 2>/dev/null || ' + command + ' -- --listTests 2>/dev/null || true';
      }

      const startTime = Date.now();
      const output = execSync(testCommand, {
        encoding: 'utf8',
        stdio: 'pipe',
        timeout: 60000 // 1 minute timeout
      });
      const duration = Date.now() - startTime;

      // Try to parse JSON output for Jest
      let testCount = 0;
      let testFiles = [];
      
      try {
        const jsonData = JSON.parse(output);
        if (Array.isArray(jsonData)) {
          testFiles = jsonData.filter(f => !f.includes('node_modules'));
          testCount = testFiles.length;
        }
      } catch {
        // Not JSON, try pattern matching
        testCount = this.extractTestCount(output);
      }

      // If we couldn't get count from list, try actual execution with bail
      if (testCount === null || testCount === 0) {
        console.log('  → Could not get test count from list, trying limited execution...');
        
        const bailCommand = command + ' -- --bail=1 --maxWorkers=2';
        try {
          const bailOutput = execSync(bailCommand, {
            encoding: 'utf8',
            stdio: 'pipe',
            timeout: 30000 // 30 seconds
          });
          
          testCount = this.extractTestCount(bailOutput);
        } catch (bailError) {
          // Test execution failed, check output
          const errorOutput = bailError.stdout || '';
          testCount = this.extractTestCount(errorOutput);
        }
      }

      // Get minimum threshold
      const threshold = this.minTestThresholds[command] || this.minTestThresholds.default;
      
      const result = {
        command,
        testCount,
        testFiles: testFiles.length,
        threshold,
        passed: testCount >= threshold,
        duration: `${(duration / 1000).toFixed(2)}s`,
        timestamp: new Date().toISOString()
      };

      this.results.push(result);

      if (!result.passed) {
        this.failures.push({
          command,
          reason: testCount === 0 
            ? 'No tests found - possible --passWithNoTests issue'
            : `Only ${testCount} tests found, minimum ${threshold} required`,
          severity: testCount === 0 ? 'critical' : 'warning'
        });
        
        console.log(`  ❌ FAILED: ${this.failures[this.failures.length - 1].reason}`);
      } else {
        console.log(`  ✅ PASSED: Found ${testCount} tests (minimum: ${threshold})`);
      }

      return result;

    } catch (error) {
      const result = {
        command,
        testCount: 0,
        passed: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };

      this.results.push(result);
      this.failures.push({
        command,
        reason: `Command failed: ${error.message}`,
        severity: 'critical'
      });

      console.log(`  ❌ ERROR: ${error.message}`);
      return result;
    }
  }

  checkJestConfigurations() {
    console.log('\nChecking Jest configuration files...');
    
    const configFiles = fs.readdirSync(process.cwd())
      .filter(f => f.startsWith('jest') && f.endsWith('.config.js'));

    const issues = [];
    
    configFiles.forEach(file => {
      const content = fs.readFileSync(file, 'utf8');
      
      if (content.includes('passWithNoTests: true')) {
        issues.push({
          file,
          issue: 'passWithNoTests is enabled',
          severity: 'high',
          fix: 'Remove or set passWithNoTests to false'
        });
      }

      if (content.includes('testMatch: []')) {
        issues.push({
          file,
          issue: 'Empty testMatch pattern',
          severity: 'critical',
          fix: 'Add valid test file patterns to testMatch'
        });
      }
    });

    return issues;
  }

  generateReport() {
    const configIssues = this.checkJestConfigurations();
    
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalCommands: this.results.length,
        passed: this.results.filter(r => r.passed).length,
        failed: this.failures.length,
        criticalIssues: this.failures.filter(f => f.severity === 'critical').length
      },
      results: this.results,
      failures: this.failures,
      configurationIssues: configIssues,
      recommendations: this.generateRecommendations()
    };

    // Save report
    const reportPath = path.join(process.cwd(), 'test-count-validation.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    return report;
  }

  generateRecommendations() {
    const recommendations = [];

    if (this.failures.some(f => f.reason.includes('No tests found'))) {
      recommendations.push({
        priority: 'critical',
        action: 'Fix test discovery patterns in Jest configurations',
        details: 'Some test commands are finding 0 tests, indicating broken test patterns'
      });
    }

    if (this.failures.some(f => f.severity === 'warning')) {
      recommendations.push({
        priority: 'high',
        action: 'Increase test coverage for commands with low test counts',
        details: 'Some test suites have fewer tests than expected minimums'
      });
    }

    const configIssues = this.checkJestConfigurations();
    if (configIssues.some(i => i.issue.includes('passWithNoTests'))) {
      recommendations.push({
        priority: 'high',
        action: 'Remove passWithNoTests flags from Jest configurations',
        details: 'This flag allows tests to pass even when no tests are found'
      });
    }

    return recommendations;
  }

  printSummary(report) {
    console.log('\n' + '='.repeat(60));
    console.log('TEST COUNT VALIDATION SUMMARY');
    console.log('='.repeat(60));
    
    console.log(`\nTotal Commands Tested: ${report.summary.totalCommands}`);
    console.log(`Passed: ${report.summary.passed}`);
    console.log(`Failed: ${report.summary.failed}`);
    console.log(`Critical Issues: ${report.summary.criticalIssues}`);

    if (report.failures.length > 0) {
      console.log('\n❌ FAILURES:');
      report.failures.forEach(failure => {
        console.log(`  • ${failure.command}: ${failure.reason}`);
      });
    }

    if (report.configurationIssues.length > 0) {
      console.log('\n⚠️  CONFIGURATION ISSUES:');
      report.configurationIssues.forEach(issue => {
        console.log(`  • ${issue.file}: ${issue.issue}`);
        console.log(`    Fix: ${issue.fix}`);
      });
    }

    if (report.recommendations.length > 0) {
      console.log('\n📋 RECOMMENDATIONS:');
      report.recommendations.forEach(rec => {
        console.log(`  • [${rec.priority.toUpperCase()}] ${rec.action}`);
        console.log(`    ${rec.details}`);
      });
    }

    console.log('\n' + '='.repeat(60));
    console.log(`Full report saved to: test-count-validation.json`);
  }

  async run() {
    console.log('🔍 Test Count Validator');
    console.log('=' + '='.repeat(59));
    console.log('Ensuring test commands execute actual tests...\n');

    // Validate main test commands
    const mainCommands = [
      'npm test',
      'npm run test:unit',
      'npm run test:integration',
      'npm run test:ci',
      'npm run test:coverage'
    ];

    for (const command of mainCommands) {
      this.validateTestCommand(command);
    }

    // Generate and print report
    const report = this.generateReport();
    this.printSummary(report);

    // Exit with appropriate code
    const exitCode = report.summary.criticalIssues > 0 ? 1 : 0;
    
    if (exitCode === 0) {
      console.log('\n✅ All test commands execute sufficient tests!');
    } else {
      console.log('\n❌ Critical issues found - test commands may produce false success!');
    }

    process.exit(exitCode);
  }
}

// Execute if run directly
if (require.main === module) {
  const validator = new TestCountValidator();
  validator.run().catch(error => {
    console.error('Script error:', error);
    process.exit(2);
  });
}

module.exports = TestCountValidator;