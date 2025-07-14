#!/usr/bin/env node

/**
 * Comprehensive Dependency Validation System
 * 
 * Validates package-lock.json synchronization, dependency compatibility,
 * security vulnerabilities, and consistency across the project.
 * 
 * Part of REF-CICD-003: Implement Dependency Validation System
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const chalk = require('chalk');

class DependencyValidator {
  constructor(options = {}) {
    this.options = {
      strict: false,
      skipSecurity: false,
      skipPerformance: false,
      maxDependencies: 150,
      ...options
    };
    this.errors = [];
    this.warnings = [];
    this.results = {
      synchronization: null,
      compatibility: null,
      security: null,
      consistency: null,
      performance: null
    };
  }

  /**
   * Main validation entry point
   */
  async validate() {
    console.log(chalk.blue('🔍 Starting comprehensive dependency validation...'));
    console.log();

    try {
      await this.validateSynchronization();
      await this.validateCompatibility();
      
      if (!this.options.skipSecurity) {
        await this.validateSecurity();
      }
      
      await this.validateConsistency();
      
      if (!this.options.skipPerformance) {
        await this.validatePerformance();
      }

      return this.generateReport();
    } catch (error) {
      this.addError('VALIDATION_FATAL', `Fatal validation error: ${error.message}`);
      return this.generateReport();
    }
  }

  /**
   * Validate package.json and package-lock.json synchronization
   */
  async validateSynchronization() {
    console.log(chalk.cyan('📦 Validating package-lock.json synchronization...'));
    
    try {
      // Check if both files exist
      const packageJsonPath = path.join(process.cwd(), 'package.json');
      const packageLockPath = path.join(process.cwd(), 'package-lock.json');
      
      if (!fs.existsSync(packageJsonPath)) {
        this.addError('SYNC_MISSING_PACKAGE', 'package.json not found');
        return;
      }
      
      if (!fs.existsSync(packageLockPath)) {
        this.addError('SYNC_MISSING_LOCK', 'package-lock.json not found - run npm install');
        return;
      }

      // Parse both files
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      const packageLock = JSON.parse(fs.readFileSync(packageLockPath, 'utf8'));

      // Validate version consistency
      if (packageJson.version !== packageLock.version) {
        this.addError('SYNC_VERSION_MISMATCH', 
          `Version mismatch: package.json (${packageJson.version}) vs package-lock.json (${packageLock.version})`);
      }

      // Validate name consistency
      if (packageJson.name !== packageLock.name) {
        this.addError('SYNC_NAME_MISMATCH',
          `Name mismatch: package.json (${packageJson.name}) vs package-lock.json (${packageLock.name})`);
      }

      // Check for dependency synchronization
      await this.validateDependencySync(packageJson, packageLock);

      this.results.synchronization = this.errors.filter(e => e.type.startsWith('SYNC_')).length === 0;
      console.log(this.results.synchronization ? 
        chalk.green('✅ Package synchronization validated') : 
        chalk.red('❌ Package synchronization issues found'));

    } catch (error) {
      this.addError('SYNC_PARSE_ERROR', `Failed to parse package files: ${error.message}`);
      this.results.synchronization = false;
    }
  }

  /**
   * Validate dependency synchronization between package.json and package-lock.json
   */
  async validateDependencySync(packageJson, packageLock) {
    const allDeps = {
      ...packageJson.dependencies || {},
      ...packageJson.devDependencies || {},
      ...packageJson.peerDependencies || {},
      ...packageJson.optionalDependencies || {}
    };

    // Check if package-lock contains all dependencies from package.json
    for (const [depName, depVersion] of Object.entries(allDeps)) {
      if (!packageLock.packages || !packageLock.packages[`node_modules/${depName}`]) {
        this.addWarning('SYNC_MISSING_IN_LOCK', 
          `Dependency ${depName} in package.json but not in package-lock.json`);
      }
    }

    // Try to detect if npm install needs to be run
    try {
      const npmLsOutput = execSync('npm ls --depth=0 --json 2>/dev/null', { 
        encoding: 'utf8',
        timeout: 10000 
      });
      const installedPackages = JSON.parse(npmLsOutput);
      
      if (installedPackages.problems) {
        this.addWarning('SYNC_INSTALL_NEEDED', 
          'npm ls detected dependency issues - may need npm install');
      }
    } catch (error) {
      // npm ls can fail for various reasons, treat as warning
      this.addWarning('SYNC_LS_CHECK_FAILED', 
        'Could not verify installed packages - consider running npm install');
    }
  }

  /**
   * Validate Node.js and dependency compatibility
   */
  async validateCompatibility() {
    console.log(chalk.cyan('🔗 Validating Node.js and dependency compatibility...'));
    
    try {
      const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      const currentNodeVersion = process.version;

      // Check Node.js engine compatibility
      if (packageJson.engines && packageJson.engines.node) {
        const requiredNodeVersion = packageJson.engines.node;
        
        // Simple version check (could be enhanced with semver)
        if (requiredNodeVersion.includes('>=')) {
          const minVersion = requiredNodeVersion.replace('>=', '').trim();
          const currentMajor = parseInt(currentNodeVersion.substring(1).split('.')[0]);
          const minMajor = parseInt(minVersion.split('.')[0]);
          
          if (currentMajor < minMajor) {
            this.addError('COMPAT_NODE_VERSION', 
              `Node.js ${currentNodeVersion} does not meet requirement: ${requiredNodeVersion}`);
          }
        }
      }

      // Check for deprecated dependencies
      await this.checkDeprecatedDependencies();

      this.results.compatibility = this.errors.filter(e => e.type.startsWith('COMPAT_')).length === 0;
      console.log(this.results.compatibility ? 
        chalk.green('✅ Compatibility validated') : 
        chalk.red('❌ Compatibility issues found'));

    } catch (error) {
      this.addError('COMPAT_CHECK_FAILED', `Compatibility check failed: ${error.message}`);
      this.results.compatibility = false;
    }
  }

  /**
   * Check for deprecated dependencies
   */
  async checkDeprecatedDependencies() {
    try {
      // Use npm outdated to check for deprecated packages
      const outdatedOutput = execSync('npm outdated --json 2>/dev/null || echo "{}"', { 
        encoding: 'utf8',
        timeout: 15000 
      });
      
      const outdatedPackages = JSON.parse(outdatedOutput);
      
      if (Object.keys(outdatedPackages).length > 0) {
        this.addWarning('COMPAT_OUTDATED_DEPS', 
          `${Object.keys(outdatedPackages).length} dependencies are outdated`);
      }
    } catch (error) {
      this.addWarning('COMPAT_OUTDATED_CHECK_FAILED', 
        'Could not check for outdated dependencies');
    }
  }

  /**
   * Validate security vulnerabilities
   */
  async validateSecurity() {
    console.log(chalk.cyan('🔒 Validating security vulnerabilities...'));
    
    try {
      // Run npm audit
      const auditOutput = execSync('npm audit --json 2>/dev/null || echo "{}"', { 
        encoding: 'utf8',
        timeout: 20000 
      });
      
      const auditResults = JSON.parse(auditOutput);
      
      if (auditResults.vulnerabilities) {
        const vulnCount = Object.keys(auditResults.vulnerabilities).length;
        const highSeverity = Object.values(auditResults.vulnerabilities)
          .filter(vuln => vuln.severity === 'high' || vuln.severity === 'critical').length;
        
        if (highSeverity > 0) {
          this.addError('SECURITY_HIGH_VULNS', 
            `${highSeverity} high/critical security vulnerabilities found`);
        } else if (vulnCount > 0) {
          this.addWarning('SECURITY_LOW_VULNS', 
            `${vulnCount} low/moderate security vulnerabilities found`);
        }
      }

      this.results.security = this.errors.filter(e => e.type.startsWith('SECURITY_')).length === 0;
      console.log(this.results.security ? 
        chalk.green('✅ Security validated') : 
        chalk.red('❌ Security issues found'));

    } catch (error) {
      this.addWarning('SECURITY_CHECK_FAILED', `Security check failed: ${error.message}`);
      this.results.security = null; // Unknown status
    }
  }

  /**
   * Validate dependency consistency
   */
  async validateConsistency() {
    console.log(chalk.cyan('🎯 Validating dependency consistency...'));
    
    try {
      const packageLock = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));
      
      // Check for duplicate dependencies with different versions
      const versionMap = new Map();
      
      if (packageLock.packages) {
        for (const [packagePath, packageInfo] of Object.entries(packageLock.packages)) {
          if (packagePath.startsWith('node_modules/')) {
            const packageName = packagePath.replace('node_modules/', '').split('/')[0];
            const version = packageInfo.version;
            
            if (versionMap.has(packageName)) {
              const existingVersions = versionMap.get(packageName);
              if (!existingVersions.includes(version)) {
                existingVersions.push(version);
                versionMap.set(packageName, existingVersions);
              }
            } else {
              versionMap.set(packageName, [version]);
            }
          }
        }
      }

      // Report packages with multiple versions
      const duplicates = Array.from(versionMap.entries())
        .filter(([name, versions]) => versions.length > 1);
      
      if (duplicates.length > 0) {
        this.addWarning('CONSISTENCY_DUPLICATES', 
          `${duplicates.length} packages have multiple versions: ${duplicates.map(([name, versions]) => 
            `${name} (${versions.join(', ')})`).slice(0, 3).join(', ')}`);
      }

      this.results.consistency = this.errors.filter(e => e.type.startsWith('CONSISTENCY_')).length === 0;
      console.log(this.results.consistency ? 
        chalk.green('✅ Consistency validated') : 
        chalk.red('❌ Consistency issues found'));

    } catch (error) {
      this.addError('CONSISTENCY_CHECK_FAILED', `Consistency check failed: ${error.message}`);
      this.results.consistency = false;
    }
  }

  /**
   * Validate dependency performance impact
   */
  async validatePerformance() {
    console.log(chalk.cyan('⚡ Validating dependency performance impact...'));
    
    try {
      const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      const packageLock = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));
      
      // Count total dependencies
      const totalDeps = packageLock.packages ? 
        Object.keys(packageLock.packages).filter(p => p.startsWith('node_modules/')).length : 0;
      
      if (totalDeps > this.options.maxDependencies) {
        this.addWarning('PERF_TOO_MANY_DEPS', 
          `${totalDeps} total dependencies exceeds recommended maximum of ${this.options.maxDependencies}`);
      }

      // Check for large packages (this would require additional tooling in practice)
      const prodDeps = Object.keys(packageJson.dependencies || {}).length;
      const devDeps = Object.keys(packageJson.devDependencies || {}).length;
      
      console.log(chalk.gray(`  Production dependencies: ${prodDeps}`));
      console.log(chalk.gray(`  Development dependencies: ${devDeps}`));
      console.log(chalk.gray(`  Total installed packages: ${totalDeps}`));

      this.results.performance = this.errors.filter(e => e.type.startsWith('PERF_')).length === 0;
      console.log(this.results.performance ? 
        chalk.green('✅ Performance validated') : 
        chalk.red('❌ Performance issues found'));

    } catch (error) {
      this.addError('PERF_CHECK_FAILED', `Performance check failed: ${error.message}`);
      this.results.performance = false;
    }
  }

  /**
   * Add error to validation results
   */
  addError(type, message) {
    this.errors.push({ type, message, severity: 'error' });
  }

  /**
   * Add warning to validation results
   */
  addWarning(type, message) {
    this.warnings.push({ type, message, severity: 'warning' });
  }

  /**
   * Generate comprehensive validation report
   */
  generateReport() {
    console.log();
    console.log(chalk.blue('📊 Dependency Validation Report'));
    console.log(chalk.blue('═'.repeat(50)));
    console.log();

    // Summary
    const totalChecks = Object.values(this.results).filter(r => r !== null).length;
    const passedChecks = Object.values(this.results).filter(r => r === true).length;
    
    console.log(chalk.bold('📋 Summary:'));
    console.log(`  Checks passed: ${passedChecks}/${totalChecks}`);
    console.log(`  Errors: ${chalk.red(this.errors.length)}`);
    console.log(`  Warnings: ${chalk.yellow(this.warnings.length)}`);
    console.log();

    // Detailed results
    console.log(chalk.bold('🔍 Detailed Results:'));
    for (const [check, result] of Object.entries(this.results)) {
      const status = result === true ? chalk.green('✅ PASS') : 
                    result === false ? chalk.red('❌ FAIL') : 
                    chalk.gray('⏭️ SKIP');
      console.log(`  ${check.padEnd(15)}: ${status}`);
    }
    console.log();

    // Error details
    if (this.errors.length > 0) {
      console.log(chalk.red('❌ Errors:'));
      this.errors.forEach(error => {
        console.log(chalk.red(`  • ${error.message}`));
      });
      console.log();
    }

    // Warning details
    if (this.warnings.length > 0) {
      console.log(chalk.yellow('⚠️ Warnings:'));
      this.warnings.forEach(warning => {
        console.log(chalk.yellow(`  • ${warning.message}`));
      });
      console.log();
    }

    // Recommendations
    if (this.errors.length > 0 || this.warnings.length > 0) {
      console.log(chalk.bold('💡 Recommendations:'));
      
      if (this.errors.some(e => e.type.startsWith('SYNC_'))) {
        console.log('  • Run npm install to synchronize dependencies');
      }
      if (this.errors.some(e => e.type.startsWith('SECURITY_'))) {
        console.log('  • Run npm audit fix to resolve security vulnerabilities');
      }
      if (this.warnings.some(w => w.type.startsWith('COMPAT_'))) {
        console.log('  • Run npm update to update outdated dependencies');
      }
      if (this.warnings.some(w => w.type.startsWith('PERF_'))) {
        console.log('  • Consider removing unused dependencies to improve performance');
      }
      console.log();
    }

    const success = this.errors.length === 0;
    
    console.log(success ? 
      chalk.green('✅ Dependency validation completed successfully') :
      chalk.red('❌ Dependency validation failed'));
    
    return {
      success,
      errors: this.errors,
      warnings: this.warnings,
      results: this.results,
      summary: {
        totalChecks,
        passedChecks,
        errorCount: this.errors.length,
        warningCount: this.warnings.length
      }
    };
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const options = {
    strict: args.includes('--strict'),
    skipSecurity: args.includes('--skip-security'),
    skipPerformance: args.includes('--skip-performance'),
    json: args.includes('--json')
  };

  const validator = new DependencyValidator(options);
  const report = await validator.validate();
  
  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
  }
  
  process.exit(report.success ? 0 : 1);
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error(chalk.red('Fatal error:'), error.message);
    process.exit(1);
  });
}

module.exports = DependencyValidator;