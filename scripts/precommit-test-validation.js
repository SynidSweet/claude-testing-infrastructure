#!/usr/bin/env node

/**
 * Pre-commit Test Validation Script
 * 
 * Prevents commits when test commands would produce false success signals.
 * Validates that tests actually execute and pass before allowing commits.
 * 
 * Exit codes:
 * 0 - All validations passed
 * 1 - Validation failed, commit blocked
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class PreCommitTestValidator {
  constructor() {
    this.failures = [];
    this.testResults = {};
    
    // Quick validation mode for pre-commit
    this.quickTestCommands = [
      { cmd: 'npm run test:fast', desc: 'Fast unit tests', required: true },
      { cmd: 'npm run validate:test-quick', desc: 'Quick test validation', required: false }
    ];
  }

  log(message, type = 'info') {
    const prefix = {
      info: '  ',
      success: '✅',
      error: '❌',
      warning: '⚠️ '
    };
    console.log(`${prefix[type]} ${message}`);
  }

  validateTestCommand(command, description, required = true) {
    try {
      this.log(`Running ${description}...`);
      
      const output = execSync(command, {
        encoding: 'utf8',
        stdio: 'pipe',
        timeout: 120000 // 2 minutes
      });

      // Check for zero test execution
      if (output.includes('No tests found') || 
          output.includes('0 passing') ||
          (output.includes('Test Suites:') && output.includes('0 total'))) {
        
        this.failures.push({
          command,
          reason: 'No tests were executed',
          severity: 'critical'
        });
        
        this.log(`${description} - No tests found!`, 'error');
        return false;
      }

      // Extract test counts
      const testMatch = output.match(/Tests:.*?(\d+)\s+passed.*?(\d+)\s+total/);
      const failMatch = output.match(/Tests:.*?(\d+)\s+failed/);
      
      if (failMatch && parseInt(failMatch[1]) > 0) {
        this.failures.push({
          command,
          reason: `${failMatch[1]} tests failed`,
          severity: 'critical'
        });
        
        this.log(`${description} - ${failMatch[1]} tests failed!`, 'error');
        return false;
      }

      if (testMatch) {
        const passed = parseInt(testMatch[1]);
        const total = parseInt(testMatch[2]);
        
        this.log(`${description} - ${passed}/${total} tests passed`, 'success');
        
        this.testResults[command] = {
          passed,
          total,
          success: passed === total && total > 0
        };
        
        return passed === total && total > 0;
      }

      // If we can't parse results but command succeeded, check exit code
      this.log(`${description} - Completed (couldn't parse test count)`, 'warning');
      return true;

    } catch (error) {
      if (required) {
        this.failures.push({
          command,
          reason: error.message,
          severity: 'critical'
        });
        
        this.log(`${description} - Failed: ${error.message}`, 'error');
        return false;
      } else {
        this.log(`${description} - Skipped (optional): ${error.message}`, 'warning');
        return true;
      }
    }
  }

  checkJestConfiguration() {
    this.log('Checking Jest configuration...');
    
    const configFiles = fs.readdirSync(process.cwd())
      .filter(f => f.startsWith('jest') && f.endsWith('.config.js'));

    let hasIssues = false;
    
    configFiles.forEach(file => {
      const content = fs.readFileSync(file, 'utf8');
      
      if (content.includes('passWithNoTests: true')) {
        this.log(`${file} has passWithNoTests enabled - tests may falsely pass!`, 'warning');
        hasIssues = true;
      }
    });

    return !hasIssues;
  }

  checkStagedFiles() {
    try {
      const stagedFiles = execSync('git diff --cached --name-only', {
        encoding: 'utf8'
      }).trim().split('\n').filter(Boolean);

      const testFiles = stagedFiles.filter(f => 
        f.includes('.test.') || f.includes('.spec.') || f.includes('jest.config')
      );

      const srcFiles = stagedFiles.filter(f => 
        (f.includes('/src/') || f.includes('/lib/')) && 
        (f.endsWith('.ts') || f.endsWith('.js'))
      );

      return {
        hasTestChanges: testFiles.length > 0,
        hasSrcChanges: srcFiles.length > 0,
        testFiles,
        srcFiles
      };
    } catch (error) {
      return {
        hasTestChanges: false,
        hasSrcChanges: false,
        testFiles: [],
        srcFiles: []
      };
    }
  }

  async run() {
    console.log('\n🔍 Pre-commit Test Validation');
    console.log('=' + '='.repeat(30));
    
    // Check what's being committed
    const stagedInfo = this.checkStagedFiles();
    
    if (stagedInfo.hasSrcChanges || stagedInfo.hasTestChanges) {
      console.log('\nDetected changes:');
      if (stagedInfo.hasSrcChanges) {
        this.log(`${stagedInfo.srcFiles.length} source files modified`);
      }
      if (stagedInfo.hasTestChanges) {
        this.log(`${stagedInfo.testFiles.length} test files modified`);
      }
    }

    // Check Jest configuration
    const configOk = this.checkJestConfiguration();
    if (!configOk) {
      this.log('Jest configuration has issues that may cause false success', 'warning');
    }

    // Run quick test validation
    console.log('\nRunning test validation...');
    
    let allPassed = true;
    for (const { cmd, desc, required } of this.quickTestCommands) {
      const passed = this.validateTestCommand(cmd, desc, required);
      if (required && !passed) {
        allPassed = false;
      }
    }

    // Summary
    console.log('\n' + '='.repeat(31));
    if (allPassed) {
      console.log('✅ Pre-commit test validation PASSED\n');
      
      // Show test summary
      Object.entries(this.testResults).forEach(([cmd, result]) => {
        if (result.success) {
          console.log(`  ✓ ${result.total} tests passed`);
        }
      });
      
      console.log('\n✨ Ready to commit!');
      process.exit(0);
    } else {
      console.log('❌ Pre-commit test validation FAILED\n');
      
      this.failures.forEach(failure => {
        console.log(`  • ${failure.reason}`);
      });
      
      console.log('\n📋 To fix:');
      console.log('  1. Ensure tests are passing: npm test');
      console.log('  2. Fix any test discovery issues');
      console.log('  3. Remove passWithNoTests from Jest configs');
      console.log('\n💡 To skip (emergency only): git commit --no-verify');
      
      process.exit(1);
    }
  }
}

// Execute
if (require.main === module) {
  const validator = new PreCommitTestValidator();
  validator.run().catch(error => {
    console.error('❌ Pre-commit validation error:', error.message);
    process.exit(1);
  });
}

module.exports = PreCommitTestValidator;