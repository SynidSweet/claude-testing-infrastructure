#!/usr/bin/env node

/**
 * Pre-commit Truth Validation Script
 * 
 * Validates documentation claims against actual project status before allowing commits
 * Part of Truth Validation System - prevents false completion claims
 * 
 * Usage:
 *   node scripts/precommit-truth-validation.js
 * 
 * Exit codes:
 *   0 - All claims validated successfully
 *   1 - Validation failed, commit should be blocked
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');

const execAsync = promisify(exec);

class PreCommitTruthValidator {
  constructor() {
    this.scriptsDir = path.join(__dirname);
    this.projectRoot = path.join(__dirname, '..');
    this.skipValidation = process.env.SKIP_TRUTH_VALIDATION === 'true';
  }

  async validateTruth() {
    console.log('🔍 Validating documentation claims against reality...');
    
    try {
      // Run status aggregator with validation and exit on discrepancy
      const statusAggregatorPath = path.join(this.scriptsDir, 'status-aggregator.js');
      const command = `node "${statusAggregatorPath}" --validate-claims --exit-on-discrepancy`;
      
      const { stdout, stderr } = await execAsync(command, {
        cwd: this.projectRoot,
        timeout: 30000 // 30 second timeout
      });

      console.log('✅ All documentation claims validated against reality');
      return true;
      
    } catch (error) {
      console.error('❌ Documentation contains false claims. Please fix:\n');
      
      if (error.stdout) {
        console.error(error.stdout);
      }
      if (error.stderr) {
        console.error(error.stderr);
      }
      
      console.error('\n📋 How to fix:');
      console.error('   1. Update documentation to match actual status');
      console.error('   2. Fix issues to match documentation claims');
      console.error('   3. Re-run: npm run validate:truth');
      console.error('   4. Check specific discrepancies: npm run validate:truth:detailed');
      
      return false;
    }
  }

  async run() {
    if (this.skipValidation) {
      console.log('⚠️  Truth validation skipped (SKIP_TRUTH_VALIDATION=true)');
      console.log('🎉 Pre-commit truth validation bypassed!');
      return;
    }
    
    const isValid = await this.validateTruth();
    
    if (!isValid) {
      process.exit(1);
    }
    
    console.log('🎉 Pre-commit truth validation passed!');
    process.exit(0);
  }
}

// CLI execution
if (require.main === module) {
  const validator = new PreCommitTruthValidator();
  validator.run().catch(error => {
    console.error('❌ Pre-commit truth validation failed:', error.message);
    process.exit(1);
  });
}

module.exports = PreCommitTruthValidator;