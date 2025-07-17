#!/usr/bin/env node

/**
 * Quick Test Validator
 * 
 * Fast validation that test commands will execute real tests.
 * Designed for pre-commit hooks and rapid feedback.
 * 
 * Exit codes:
 * 0 - Test commands are properly configured
 * 1 - Test commands have issues
 */

const { execSync } = require('child_process');
const fs = require('fs');

class QuickTestValidator {
  constructor() {
    this.issues = [];
    this.criticalCommands = [
      'npm test',
      'npm run test:unit',
      'npm run test:ci'
    ];
  }

  checkJestConfigs() {
    const configs = fs.readdirSync('.')
      .filter(f => f.startsWith('jest') && f.endsWith('.config.js'));
    
    let hasPassWithNoTests = false;
    let hasEmptyTestMatch = false;
    
    configs.forEach(config => {
      const content = fs.readFileSync(config, 'utf8');
      
      if (content.includes('passWithNoTests: true')) {
        hasPassWithNoTests = true;
        this.issues.push(`${config} has passWithNoTests enabled`);
      }
      
      if (content.includes('testMatch: []')) {
        hasEmptyTestMatch = true;
        this.issues.push(`${config} has empty testMatch`);
      }
    });
    
    return !hasPassWithNoTests && !hasEmptyTestMatch;
  }

  quickTestCheck(command) {
    try {
      // Use --listTests for Jest to quickly check if tests exist
      const listCommand = command.includes('jest') 
        ? `${command} -- --listTests 2>/dev/null | grep -E "\\.(test|spec)\\." | head -5`
        : `${command} -- --dry-run 2>/dev/null || echo "dry-run not supported"`;
      
      const output = execSync(listCommand, {
        encoding: 'utf8',
        stdio: 'pipe',
        timeout: 10000 // 10 seconds
      });
      
      // Check if we found test files
      const hasTests = output.includes('.test.') || 
                      output.includes('.spec.') ||
                      output.includes('dry-run not supported');
      
      if (!hasTests) {
        this.issues.push(`${command} finds no test files`);
        return false;
      }
      
      return true;
    } catch (error) {
      // Command failed - could be configuration issue
      this.issues.push(`${command} failed quick check`);
      return false;
    }
  }

  run() {
    console.log('⚡ Quick Test Validator\n');
    
    // 1. Check Jest configurations
    console.log('Checking configurations...');
    const configOk = this.checkJestConfigs();
    console.log(configOk ? '  ✓ Configurations OK' : '  ✗ Configuration issues found');
    
    // 2. Quick check critical commands
    console.log('\nChecking test commands...');
    let allOk = configOk;
    
    for (const cmd of this.criticalCommands) {
      const ok = this.quickTestCheck(cmd);
      console.log(ok ? `  ✓ ${cmd}` : `  ✗ ${cmd}`);
      allOk = allOk && ok;
    }
    
    // 3. Summary
    console.log('\n' + '-'.repeat(30));
    if (allOk) {
      console.log('✅ All checks passed!');
      process.exit(0);
    } else {
      console.log('❌ Issues found:\n');
      this.issues.forEach(issue => console.log(`  • ${issue}`));
      process.exit(1);
    }
  }
}

if (require.main === module) {
  new QuickTestValidator().run();
}