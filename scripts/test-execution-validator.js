#!/usr/bin/env node

/**
 * Test Execution Validator
 * 
 * Comprehensive script to validate that all CI/CD test commands actually run tests
 * and provide accurate results. Prevents false success claims by verifying:
 * - Test discovery and execution
 * - Test counts within expected ranges
 * - Exit codes match test results
 * - No "--passWithNoTests" deception
 * 
 * Usage: node scripts/test-execution-validator.js [--json] [--strict] [--detailed]
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

class TestExecutionValidator {
  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      overall: 'pending',
      commands: {},
      summary: {
        totalCommands: 0,
        passedValidation: 0,
        failedValidation: 0,
        warnings: 0
      },
      evidence: {
        testCounts: {},
        executionLogs: {},
        exitCodes: {},
        configIssues: []
      }
    };

    // Define expected test ranges based on current project state
    this.expectedRanges = {
      'npm test': { min: 1000, max: 1500, description: 'Full test suite' },
      'npm run test:unit': { min: 100, max: 500, description: 'Unit tests only' },
      'npm run test:integration': { min: 20, max: 200, description: 'Integration tests' },
      'npm run test:fast': { min: 100, max: 500, description: 'Fast unit tests' },
      'npm run test:core': { min: 120, max: 700, description: 'Core unit + integration' },
      'npm run test:ci': { min: 120, max: 700, description: 'CI test suite' },
      'npm run test:coverage': { min: 1000, max: 1500, description: 'Coverage with all tests' }
    };

    // Parse command line arguments
    this.args = process.argv.slice(2);
    this.jsonOutput = this.args.includes('--json');
    this.strictMode = this.args.includes('--strict');
    this.detailedMode = this.args.includes('--detailed');
  }

  log(message, type = 'info') {
    if (this.jsonOutput) return;

    const prefix = {
      info: chalk.blue('ℹ'),
      success: chalk.green('✓'),
      warning: chalk.yellow('⚠'),
      error: chalk.red('✗'),
      debug: chalk.gray('🔍')
    };

    console.log(`${prefix[type] || prefix.info} ${message}`);
  }

  header(title) {
    if (this.jsonOutput) return;
    console.log(`\n${chalk.bold.cyan('━'.repeat(60))}`);
    console.log(chalk.bold.cyan(`  ${title}`));
    console.log(chalk.bold.cyan('━'.repeat(60)));
  }

  /**
   * Execute a test command and capture results
   */
  executeCommand(command) {
    this.log(`Executing: ${command}`, 'debug');
    
    const result = {
      command,
      executed: false,
      exitCode: null,
      stdout: '',
      stderr: '',
      testCount: 0,
      failureCount: 0,
      passingCount: 0,
      skippedCount: 0,
      duration: 0,
      issues: []
    };

    const startTime = Date.now();

    try {
      const output = execSync(command, {
        encoding: 'utf8',
        stdio: 'pipe',
        env: { ...process.env, CI: 'true', FORCE_COLOR: '0' }
      });
      
      result.executed = true;
      result.exitCode = 0;
      result.stdout = output;
      result.duration = Date.now() - startTime;
      
    } catch (error) {
      result.executed = true;
      result.exitCode = error.status || 1;
      result.stdout = error.stdout || '';
      result.stderr = error.stderr || '';
      result.duration = Date.now() - startTime;
    }

    // Parse test output
    this.parseTestOutput(result);
    
    return result;
  }

  /**
   * Parse Jest output to extract test counts
   */
  parseTestOutput(result) {
    const output = result.stdout + result.stderr;
    
    // Check for "No tests found" scenario
    if (output.includes('No tests found')) {
      result.issues.push({
        type: 'NO_TESTS_FOUND',
        severity: 'critical',
        message: 'Command found no tests to execute'
      });
      return;
    }

    // Extract test counts from Jest output
    // Pattern: "Tests:  X failed, Y passed, Z skipped, N total"
    const testSummaryMatch = output.match(/Tests?:\s+(?:(\d+) failed,?\s*)?(?:(\d+) passed,?\s*)?(?:(\d+) skipped,?\s*)?(\d+) total/);
    
    if (testSummaryMatch) {
      result.failureCount = parseInt(testSummaryMatch[1] || '0');
      result.passingCount = parseInt(testSummaryMatch[2] || '0');
      result.skippedCount = parseInt(testSummaryMatch[3] || '0');
      result.testCount = parseInt(testSummaryMatch[4] || '0');
    }

    // Alternative pattern for single test suite results
    if (result.testCount === 0) {
      const passMatch = output.match(/PASS.*\n.*√ (\d+) test/);
      if (passMatch) {
        result.testCount = parseInt(passMatch[1]);
        result.passingCount = result.testCount;
      }
    }

    // Check for --passWithNoTests flag
    if (output.includes('--passWithNoTests')) {
      result.issues.push({
        type: 'PASS_WITH_NO_TESTS_FLAG',
        severity: 'high',
        message: 'Command uses --passWithNoTests flag which masks test discovery failures'
      });
    }

    // Check for configuration warnings
    if (output.includes('testMatch:')) {
      const testMatchLine = output.match(/testMatch:\s*\[(.*?)\]/);
      if (testMatchLine && testMatchLine[1].trim() === '') {
        result.issues.push({
          type: 'EMPTY_TEST_MATCH',
          severity: 'critical',
          message: 'Jest configuration has empty testMatch array'
        });
      }
    }
  }

  /**
   * Validate command results against expected behavior
   */
  validateCommand(command, result) {
    const validation = {
      command,
      valid: true,
      issues: [],
      warnings: []
    };

    // Critical: Check if tests were actually found and executed
    if (result.testCount === 0) {
      validation.valid = false;
      validation.issues.push('No tests were executed');
    }

    // Check if exit code matches test results
    if (result.failureCount > 0 && result.exitCode === 0) {
      validation.valid = false;
      validation.issues.push(`Exit code is 0 despite ${result.failureCount} test failures`);
    }

    if (result.failureCount === 0 && result.exitCode !== 0 && result.testCount > 0) {
      validation.warnings.push(`Exit code ${result.exitCode} but all tests passed`);
    }

    // Check against expected ranges
    const expected = this.expectedRanges[command];
    if (expected) {
      if (result.testCount < expected.min) {
        validation.warnings.push(`Test count (${result.testCount}) below expected minimum (${expected.min})`);
      }
      if (result.testCount > expected.max) {
        validation.warnings.push(`Test count (${result.testCount}) above expected maximum (${expected.max})`);
      }
    }

    // Check for critical issues
    result.issues.forEach(issue => {
      if (issue.severity === 'critical') {
        validation.valid = false;
        validation.issues.push(issue.message);
      } else if (issue.severity === 'high') {
        validation.warnings.push(issue.message);
      }
    });

    return validation;
  }

  /**
   * Check Jest configuration files for issues
   */
  async checkJestConfigurations() {
    const configFiles = [
      'jest.config.js',
      'jest.unit.config.js',
      'jest.integration.config.js',
      'jest.optimized.config.js',
      'jest.performance.config.js'
    ];

    for (const configFile of configFiles) {
      const configPath = path.join(process.cwd(), configFile);
      if (fs.existsSync(configPath)) {
        try {
          const config = require(configPath);
          
          // Check for problematic configurations
          if (config.testMatch && config.testMatch.length === 0) {
            this.results.evidence.configIssues.push({
              file: configFile,
              issue: 'Empty testMatch array',
              severity: 'critical'
            });
          }

          if (config.passWithNoTests === true) {
            this.results.evidence.configIssues.push({
              file: configFile,
              issue: 'passWithNoTests is enabled',
              severity: 'high'
            });
          }

          if (!config.testMatch && !config.testRegex) {
            this.results.evidence.configIssues.push({
              file: configFile,
              issue: 'No testMatch or testRegex defined',
              severity: 'warning'
            });
          }
        } catch (error) {
          this.results.evidence.configIssues.push({
            file: configFile,
            issue: `Failed to load: ${error.message}`,
            severity: 'error'
          });
        }
      }
    }
  }

  /**
   * Run validation for all test commands
   */
  async runValidation() {
    this.header('Test Execution Validation');
    
    // Check Jest configurations first
    this.log('Checking Jest configuration files...', 'info');
    await this.checkJestConfigurations();

    // Commands to validate
    const testCommands = [
      'npm test',
      'npm run test:unit',
      'npm run test:integration',
      'npm run test:fast',
      'npm run test:core',
      'npm run test:ci',
      'npm run test:coverage'
    ];

    this.results.summary.totalCommands = testCommands.length;

    // Validate each command
    for (const command of testCommands) {
      this.log(`\nValidating: ${chalk.cyan(command)}`, 'info');
      
      const result = this.executeCommand(command);
      const validation = this.validateCommand(command, result);
      
      // Store results
      this.results.commands[command] = {
        result,
        validation,
        status: validation.valid ? 'passed' : 'failed'
      };

      // Store evidence
      this.results.evidence.testCounts[command] = result.testCount;
      this.results.evidence.exitCodes[command] = result.exitCode;
      
      if (this.detailedMode || !validation.valid) {
        this.results.evidence.executionLogs[command] = {
          stdout: result.stdout.slice(-1000), // Last 1000 chars
          stderr: result.stderr.slice(-1000)
        };
      }

      // Update summary
      if (validation.valid) {
        this.results.summary.passedValidation++;
        this.log(`Validation: ${chalk.green('PASSED')}`, 'success');
      } else {
        this.results.summary.failedValidation++;
        this.log(`Validation: ${chalk.red('FAILED')}`, 'error');
        validation.issues.forEach(issue => {
          this.log(`  Issue: ${issue}`, 'error');
        });
      }

      if (validation.warnings.length > 0) {
        this.results.summary.warnings += validation.warnings.length;
        validation.warnings.forEach(warning => {
          this.log(`  Warning: ${warning}`, 'warning');
        });
      }

      // Show test count summary
      this.log(`  Tests found: ${result.testCount} (${result.passingCount} passed, ${result.failureCount} failed)`, 'info');
      this.log(`  Exit code: ${result.exitCode}`, 'info');
      this.log(`  Duration: ${(result.duration / 1000).toFixed(1)}s`, 'info');
    }

    // Determine overall status
    if (this.results.summary.failedValidation === 0) {
      this.results.overall = 'passed';
    } else if (this.strictMode) {
      this.results.overall = 'failed';
    } else {
      this.results.overall = this.results.summary.warnings > 0 ? 'passed_with_warnings' : 'passed';
    }
  }

  /**
   * Generate summary report
   */
  generateReport() {
    if (this.jsonOutput) {
      console.log(JSON.stringify(this.results, null, 2));
      return;
    }

    this.header('Validation Summary');

    console.log(`\nOverall Status: ${
      this.results.overall === 'passed' ? chalk.green('PASSED') :
      this.results.overall === 'passed_with_warnings' ? chalk.yellow('PASSED WITH WARNINGS') :
      chalk.red('FAILED')
    }`);

    console.log(`\nCommands Validated: ${this.results.summary.totalCommands}`);
    console.log(`  ${chalk.green('✓')} Passed: ${this.results.summary.passedValidation}`);
    console.log(`  ${chalk.red('✗')} Failed: ${this.results.summary.failedValidation}`);
    console.log(`  ${chalk.yellow('⚠')} Warnings: ${this.results.summary.warnings}`);

    // Configuration issues
    if (this.results.evidence.configIssues.length > 0) {
      console.log(`\n${chalk.yellow('Configuration Issues:')}`);
      this.results.evidence.configIssues.forEach(issue => {
        const icon = issue.severity === 'critical' ? chalk.red('✗') :
                    issue.severity === 'high' ? chalk.yellow('⚠') :
                    chalk.gray('ℹ');
        console.log(`  ${icon} ${issue.file}: ${issue.issue}`);
      });
    }

    // Test count summary
    console.log(`\n${chalk.cyan('Test Counts by Command:')}`);
    Object.entries(this.results.evidence.testCounts).forEach(([cmd, count]) => {
      const expected = this.expectedRanges[cmd];
      const inRange = expected && count >= expected.min && count <= expected.max;
      const icon = count === 0 ? chalk.red('✗') :
                  inRange ? chalk.green('✓') :
                  chalk.yellow('⚠');
      console.log(`  ${icon} ${cmd}: ${count} tests${expected ? ` (expected ${expected.min}-${expected.max})` : ''}`);
    });

    // Critical findings
    const criticalIssues = [];
    Object.entries(this.results.commands).forEach(([cmd, data]) => {
      if (!data.validation.valid) {
        criticalIssues.push({ command: cmd, issues: data.validation.issues });
      }
    });

    if (criticalIssues.length > 0) {
      console.log(`\n${chalk.red('Critical Issues Found:')}`);
      criticalIssues.forEach(({ command, issues }) => {
        console.log(`  ${chalk.red('✗')} ${command}:`);
        issues.forEach(issue => {
          console.log(`    - ${issue}`);
        });
      });
    }

    // Evidence file path
    const evidenceFile = path.join(process.cwd(), 'test-validation-evidence.json');
    fs.writeFileSync(evidenceFile, JSON.stringify(this.results, null, 2));
    console.log(`\n${chalk.gray('Evidence report saved to:')} ${evidenceFile}`);

    // Exit code recommendation
    console.log(`\n${chalk.bold('Exit Code:')} ${
      this.results.overall === 'failed' ? '1 (validation failed)' : '0 (validation passed)'
    }`);
  }

  /**
   * Main execution
   */
  async run() {
    try {
      await this.runValidation();
      this.generateReport();
      
      // Exit with appropriate code
      process.exit(this.results.overall === 'failed' ? 1 : 0);
    } catch (error) {
      this.log(`Unexpected error: ${error.message}`, 'error');
      if (this.jsonOutput) {
        console.log(JSON.stringify({
          error: error.message,
          stack: error.stack
        }, null, 2));
      }
      process.exit(2);
    }
  }
}

// Execute if run directly
if (require.main === module) {
  const validator = new TestExecutionValidator();
  validator.run();
}

module.exports = TestExecutionValidator;