#!/usr/bin/env node

/**
 * Test Execution Validator for CI/CD Pipeline
 * 
 * This script validates that test commands execute real tests and don't
 * produce false success claims. It's designed to be integrated into CI/CD
 * pipelines to catch configuration issues before they cause problems.
 * 
 * Exit codes:
 * 0 - All validations passed
 * 1 - Critical issues found (false success possible)
 * 2 - Validation script error
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class CITestValidator {
  constructor() {
    this.criticalIssues = [];
    this.warnings = [];
    this.testResults = {};
    this.configIssues = [];
  }

  log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = {
      info: '[INFO]',
      warn: '[WARN]',
      error: '[ERROR]',
      success: '[PASS]'
    };
    console.log(`${timestamp} ${prefix[level]} ${message}`);
  }

  /**
   * Check Jest configuration files for problematic settings
   */
  checkJestConfigs() {
    this.log('Checking Jest configuration files...');
    
    const configs = fs.readdirSync(process.cwd())
      .filter(f => f.startsWith('jest') && f.endsWith('.config.js'));
    
    configs.forEach(configFile => {
      try {
        const configPath = path.join(process.cwd(), configFile);
        const configContent = fs.readFileSync(configPath, 'utf8');
        
        // Check for passWithNoTests
        if (configContent.includes('passWithNoTests')) {
          this.configIssues.push({
            file: configFile,
            issue: 'Contains passWithNoTests flag',
            severity: 'high'
          });
          this.warnings.push(`${configFile} uses passWithNoTests - may hide test discovery failures`);
        }
        
        // Check for empty testMatch
        if (configContent.includes('testMatch: []') || configContent.includes('testMatch:[]')) {
          this.configIssues.push({
            file: configFile,
            issue: 'Empty testMatch array',
            severity: 'critical'
          });
          this.criticalIssues.push(`${configFile} has empty testMatch - no tests will run`);
        }
        
      } catch (error) {
        this.warnings.push(`Could not analyze ${configFile}: ${error.message}`);
      }
    });
  }

  /**
   * Validate a test command by checking if it discovers tests
   */
  validateTestCommand(command, description) {
    this.log(`Validating: ${description} (${command})`);
    
    try {
      // First, check if command can list tests
      const listCommand = command.includes('&&') 
        ? command.split('&&')[0].trim() + ' -- --listTests'
        : `${command} -- --listTests`;
      
      const listOutput = execSync(listCommand, { 
        encoding: 'utf8',
        stdio: 'pipe'
      });
      
      const testFiles = listOutput.split('\n')
        .filter(line => line.includes('.test.') || line.includes('.spec.'))
        .filter(line => !line.includes('node_modules'));
      
      const testCount = testFiles.length;
      
      this.testResults[command] = {
        description,
        testCount,
        status: testCount > 0 ? 'ok' : 'critical'
      };
      
      if (testCount === 0) {
        this.criticalIssues.push(`${description}: No tests discovered - would pass with no tests!`);
        this.log(`CRITICAL: No tests found for ${description}`, 'error');
      } else {
        this.log(`Found ${testCount} test files`, 'success');
      }
      
      return testCount > 0;
      
    } catch (error) {
      // For compound commands, check each part
      if (command.includes('&&')) {
        const parts = command.split('&&').map(p => p.trim());
        let totalTests = 0;
        
        for (const part of parts) {
          if (part.startsWith('npm run')) {
            const subResult = this.validateTestCommand(part, `${description} - ${part}`);
            if (subResult) totalTests++;
          }
        }
        
        return totalTests > 0;
      }
      
      this.warnings.push(`Could not validate ${description}: ${error.message}`);
      return false;
    }
  }

  /**
   * Run actual test to check for failing tests
   */
  async checkActualTestExecution() {
    this.log('Checking actual test execution status...');
    
    try {
      // Run a limited test to check for failures
      const output = execSync('npm run test:fast -- --maxWorkers=2 --bail=5', {
        encoding: 'utf8',
        stdio: 'pipe'
      });
      
      // Parse test results
      if (output.includes('FAIL')) {
        const failMatch = output.match(/Tests:.*?(\d+) failed/);
        if (failMatch) {
          this.warnings.push(`${failMatch[1]} tests are currently failing`);
          this.log(`Found ${failMatch[1]} failing tests`, 'warn');
        }
      }
      
      // Check total test count
      const totalMatch = output.match(/Tests:.*?(\d+) total/);
      if (totalMatch) {
        this.log(`Executed ${totalMatch[1]} tests successfully`, 'success');
      }
      
    } catch (error) {
      // Test execution failed - check if due to test failures
      const output = error.stdout || '';
      if (output.includes('FAIL')) {
        const failMatch = output.match(/(\d+) failed/);
        if (failMatch) {
          this.warnings.push(`${failMatch[1]} tests are failing - fix these to ensure accurate CI/CD status`);
        }
      }
    }
  }

  /**
   * Generate validation report
   */
  generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      status: this.criticalIssues.length > 0 ? 'FAILED' : 'PASSED',
      criticalIssues: this.criticalIssues,
      warnings: this.warnings,
      testCommands: this.testResults,
      configurationIssues: this.configIssues,
      recommendations: []
    };

    // Add recommendations based on findings
    if (this.criticalIssues.length > 0) {
      report.recommendations.push('Fix test discovery patterns in Jest configurations');
      report.recommendations.push('Ensure all test commands can find and execute tests');
      report.recommendations.push('Remove or fix any empty testMatch arrays');
    }

    if (this.configIssues.some(i => i.issue.includes('passWithNoTests'))) {
      report.recommendations.push('Remove passWithNoTests flags to catch test discovery failures');
    }

    // Save report
    const reportPath = path.join(process.cwd(), 'test-validation-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    this.log(`Validation report saved to: ${reportPath}`, 'info');

    return report;
  }

  /**
   * Main validation execution
   */
  async run() {
    console.log('\n========================================');
    console.log('  TEST EXECUTION VALIDATOR FOR CI/CD');
    console.log('========================================\n');

    try {
      // Step 1: Check Jest configurations
      this.checkJestConfigs();

      // Step 2: Validate key test commands
      const commandsToValidate = [
        { cmd: 'npm test', desc: 'Default test command' },
        { cmd: 'npm run test:unit', desc: 'Unit tests' },
        { cmd: 'npm run test:integration', desc: 'Integration tests' },
        { cmd: 'npm run test:ci', desc: 'CI test suite' },
        { cmd: 'npm run test:coverage', desc: 'Coverage tests' }
      ];

      for (const { cmd, desc } of commandsToValidate) {
        this.validateTestCommand(cmd, desc);
      }

      // Step 3: Check actual test execution
      await this.checkActualTestExecution();

      // Step 4: Generate report
      const report = this.generateReport();

      // Step 5: Output summary
      console.log('\n========================================');
      console.log('  VALIDATION SUMMARY');
      console.log('========================================\n');

      if (report.status === 'FAILED') {
        console.log('❌ VALIDATION FAILED - Critical issues found:\n');
        this.criticalIssues.forEach(issue => {
          console.log(`  • ${issue}`);
        });
      } else {
        console.log('✅ VALIDATION PASSED - Test commands are properly configured\n');
      }

      if (this.warnings.length > 0) {
        console.log('\n⚠️  Warnings:');
        this.warnings.forEach(warning => {
          console.log(`  • ${warning}`);
        });
      }

      if (report.recommendations.length > 0) {
        console.log('\n📋 Recommendations:');
        report.recommendations.forEach(rec => {
          console.log(`  • ${rec}`);
        });
      }

      console.log('\n========================================\n');

      // Exit with appropriate code
      process.exit(report.status === 'FAILED' ? 1 : 0);

    } catch (error) {
      this.log(`Validation script error: ${error.message}`, 'error');
      console.error(error.stack);
      process.exit(2);
    }
  }
}

// Execute validation
if (require.main === module) {
  const validator = new CITestValidator();
  validator.run();
}

module.exports = CITestValidator;