#!/usr/bin/env node

/**
 * Infrastructure Blocker Detector
 * 
 * Systematically identifies CI/CD and infrastructure blockers including:
 * - CI/CD pipeline failures and root causes
 * - Dependency/build issues
 * - Specific fixing instructions for infrastructure
 * 
 * Part of Truth Validation System Implementation Plan - Phase 3
 * TASK-BLOCKER-002: Infrastructure Blocker Detector
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class InfrastructureBlockerDetector {
  constructor() {
    this.projectRoot = process.cwd();
    this.blockers = [];
    this.infraStatus = {
      cicd: null,
      dependencies: null,
      build: null,
      environment: null
    };
  }

  async analyzeInfrastructureBlockers() {
    console.log('🔍 Analyzing infrastructure for blockers...\n');
    
    try {
      // Run comprehensive infrastructure analysis
      await this.analyzeCICDStatus();
      await this.analyzeDependencyIssues();
      await this.analyzeBuildSystem();
      await this.analyzeEnvironmentCompatibility();
      await this.prioritizeBlockers();
      
      // Generate comprehensive report
      this.generateBlockerReport();
      
      return this.blockers;
    } catch (error) {
      console.error('❌ Error analyzing infrastructure blockers:', error.message);
      this.blockers.push({
        type: 'ANALYSIS_ERROR',
        severity: 'CRITICAL',
        message: `Failed to analyze infrastructure: ${error.message}`,
        action: 'Fix infrastructure analysis environment or dependencies'
      });
      return this.blockers;
    }
  }

  async analyzeCICDStatus() {
    console.log('🔧 Analyzing CI/CD pipeline status...');
    
    try {
      // Check if this is a git repository
      const isGitRepo = fs.existsSync(path.join(this.projectRoot, '.git'));
      if (!isGitRepo) {
        this.blockers.push({
          type: 'NO_GIT_REPO',
          severity: 'MEDIUM',
          message: 'Not a git repository - CI/CD pipeline cannot be analyzed',
          action: 'Initialize git repository or check if .git directory exists'
        });
        return;
      }

      // Check GitHub Actions workflows
      const workflowsDir = path.join(this.projectRoot, '.github', 'workflows');
      if (!fs.existsSync(workflowsDir)) {
        this.blockers.push({
          type: 'NO_CICD_WORKFLOWS',
          severity: 'HIGH',
          message: 'No CI/CD workflows found',
          action: 'Set up GitHub Actions workflows in .github/workflows/'
        });
        return;
      }

      // Analyze workflow files
      const workflowFiles = fs.readdirSync(workflowsDir).filter(file => 
        file.endsWith('.yml') || file.endsWith('.yaml')
      );

      if (workflowFiles.length === 0) {
        this.blockers.push({
          type: 'NO_CICD_WORKFLOWS',
          severity: 'HIGH',
          message: 'No CI/CD workflow files found',
          action: 'Add GitHub Actions workflow files (.yml or .yaml)'
        });
        return;
      }

      // Check workflow configuration
      await this.analyzeWorkflowConfiguration(workflowFiles);
      
      // Check current branch and git status
      await this.analyzeGitStatus();
      
      this.infraStatus.cicd = {
        hasWorkflows: true,
        workflowCount: workflowFiles.length,
        workflowFiles: workflowFiles
      };
      
      console.log(`✅ CI/CD analysis complete: ${workflowFiles.length} workflows found`);
    } catch (error) {
      console.log('⚠️  Error analyzing CI/CD status:', error.message);
      this.blockers.push({
        type: 'CICD_ANALYSIS_ERROR',
        severity: 'HIGH',
        message: `Failed to analyze CI/CD: ${error.message}`,
        action: 'Check CI/CD configuration and git repository status'
      });
    }
  }

  async analyzeWorkflowConfiguration(workflowFiles) {
    console.log('📋 Analyzing workflow configuration...');
    
    const workflowIssues = [];
    
    for (const workflowFile of workflowFiles) {
      try {
        const workflowPath = path.join(this.projectRoot, '.github', 'workflows', workflowFile);
        const workflowContent = fs.readFileSync(workflowPath, 'utf8');
        
        // Check for common configuration issues
        await this.checkWorkflowContent(workflowFile, workflowContent, workflowIssues);
      } catch (error) {
        workflowIssues.push(`Failed to analyze ${workflowFile}: ${error.message}`);
      }
    }
    
    if (workflowIssues.length > 0) {
      this.blockers.push({
        type: 'WORKFLOW_CONFIGURATION_ISSUES',
        severity: 'MEDIUM',
        message: 'CI/CD workflow configuration issues detected',
        action: 'Fix workflow configuration issues',
        details: workflowIssues
      });
    }
  }

  async checkWorkflowContent(workflowFile, content, issues) {
    // Check Node.js version compatibility
    const nodeVersionMatch = content.match(/node-version:\s*['"]?(\d+)/);
    if (nodeVersionMatch) {
      const nodeVersion = parseInt(nodeVersionMatch[1]);
      if (nodeVersion < 20) {
        issues.push(`${workflowFile}: Node.js version ${nodeVersion} may be incompatible (recommend 20+)`);
      }
    }
    
    // Check for missing essential steps
    if (!content.includes('npm install') && !content.includes('npm ci')) {
      issues.push(`${workflowFile}: Missing dependency installation step`);
    }
    
    if (!content.includes('npm run build') && !content.includes('npm run test')) {
      issues.push(`${workflowFile}: Missing build or test steps`);
    }
    
    // Check for timeout configurations
    if (!content.includes('timeout-minutes')) {
      issues.push(`${workflowFile}: No timeout configured - may cause hanging builds`);
    }
    
    // Check for cache configuration
    if (!content.includes('cache:') && !content.includes('actions/cache')) {
      issues.push(`${workflowFile}: No dependency caching configured - may cause slow builds`);
    }
  }

  async analyzeGitStatus() {
    console.log('📊 Analyzing git status...');
    
    try {
      // Check current branch
      const currentBranch = execSync('git rev-parse --abbrev-ref HEAD', { 
        encoding: 'utf8',
        timeout: 5000 
      }).trim();
      
      // Check for uncommitted changes
      const gitStatus = execSync('git status --porcelain', { 
        encoding: 'utf8',
        timeout: 5000 
      }).trim();
      
      if (gitStatus.length > 0) {
        const changedFiles = gitStatus.split('\n').length;
        this.blockers.push({
          type: 'UNCOMMITTED_CHANGES',
          severity: 'LOW',
          message: `${changedFiles} uncommitted changes detected`,
          action: 'Commit or stash changes before CI/CD deployment',
          details: {
            branch: currentBranch,
            changedFiles: changedFiles
          }
        });
      }
      
      // Check for unpushed commits
      try {
        const unpushedCommits = execSync('git log --oneline @{upstream}..HEAD', { 
          encoding: 'utf8',
          timeout: 5000 
        }).trim();
        
        if (unpushedCommits.length > 0) {
          const commitCount = unpushedCommits.split('\n').length;
          this.blockers.push({
            type: 'UNPUSHED_COMMITS',
            severity: 'MEDIUM',
            message: `${commitCount} unpushed commits detected`,
            action: 'Push commits to trigger CI/CD pipeline',
            details: {
              branch: currentBranch,
              commitCount: commitCount
            }
          });
        }
      } catch (error) {
        // Ignore upstream tracking errors - may not have upstream set
        console.log('⚠️  Could not check unpushed commits (no upstream tracking)');
      }
      
      this.infraStatus.cicd = {
        ...this.infraStatus.cicd,
        currentBranch: currentBranch,
        hasUncommittedChanges: gitStatus.length > 0
      };
      
    } catch (error) {
      console.log('⚠️  Error analyzing git status:', error.message);
      this.blockers.push({
        type: 'GIT_STATUS_ERROR',
        severity: 'MEDIUM',
        message: `Failed to analyze git status: ${error.message}`,
        action: 'Check git repository configuration and connectivity'
      });
    }
  }

  async analyzeDependencyIssues() {
    console.log('📦 Analyzing dependency issues...');
    
    try {
      // Check package.json exists
      const packageJsonPath = path.join(this.projectRoot, 'package.json');
      if (!fs.existsSync(packageJsonPath)) {
        this.blockers.push({
          type: 'NO_PACKAGE_JSON',
          severity: 'CRITICAL',
          message: 'No package.json found',
          action: 'Initialize npm project with npm init'
        });
        return;
      }

      // Check package-lock.json synchronization
      const packageLockPath = path.join(this.projectRoot, 'package-lock.json');
      if (!fs.existsSync(packageLockPath)) {
        this.blockers.push({
          type: 'NO_PACKAGE_LOCK',
          severity: 'HIGH',
          message: 'No package-lock.json found',
          action: 'Run npm install to generate package-lock.json'
        });
      } else {
        await this.checkPackageLockSync();
      }

      // Check for dependency conflicts
      await this.checkDependencyConflicts();
      
      // Check for security vulnerabilities
      await this.checkSecurityVulnerabilities();
      
      console.log('✅ Dependency analysis complete');
    } catch (error) {
      console.log('⚠️  Error analyzing dependencies:', error.message);
      this.blockers.push({
        type: 'DEPENDENCY_ANALYSIS_ERROR',
        severity: 'HIGH',
        message: `Failed to analyze dependencies: ${error.message}`,
        action: 'Check npm configuration and package.json validity'
      });
    }
  }

  async checkPackageLockSync() {
    try {
      // Run npm ci in dry-run mode to check synchronization
      const npmCiOutput = execSync('npm ci --dry-run', { 
        encoding: 'utf8',
        timeout: 30000,
        stdio: 'pipe' 
      });
      
      if (npmCiOutput.includes('removed') || npmCiOutput.includes('changed')) {
        this.blockers.push({
          type: 'PACKAGE_LOCK_OUT_OF_SYNC',
          severity: 'HIGH',
          message: 'package-lock.json is out of sync with package.json',
          action: 'Run npm install to synchronize package-lock.json'
        });
      }
      
      this.infraStatus.dependencies = {
        packageLockSync: true
      };
      
    } catch (error) {
      // npm ci --dry-run failed, likely means sync issues
      this.blockers.push({
        type: 'PACKAGE_LOCK_SYNC_ERROR',
        severity: 'CRITICAL',
        message: `package-lock.json synchronization check failed: ${error.message}`,
        action: 'Delete package-lock.json and run npm install'
      });
    }
  }

  async checkDependencyConflicts() {
    try {
      // Check for dependency conflicts using npm ls
      const npmLsOutput = execSync('npm ls --depth=0', { 
        encoding: 'utf8',
        timeout: 30000,
        stdio: 'pipe' 
      });
      
      // Look for common conflict indicators
      if (npmLsOutput.includes('UNMET DEPENDENCY') || 
          npmLsOutput.includes('MISSING') ||
          npmLsOutput.includes('invalid')) {
        this.blockers.push({
          type: 'DEPENDENCY_CONFLICTS',
          severity: 'CRITICAL',
          message: 'Dependency conflicts detected',
          action: 'Fix dependency conflicts by updating package.json',
          details: this.extractDependencyErrors(npmLsOutput)
        });
      }
      
    } catch (error) {
      // npm ls failed - likely dependency issues
      const errorOutput = error.stderr || error.stdout || error.message;
      
      if (errorOutput.includes('ERESOLVE') || errorOutput.includes('ENOENT')) {
        this.blockers.push({
          type: 'DEPENDENCY_RESOLUTION_ERROR',
          severity: 'CRITICAL',
          message: 'Dependency resolution failed',
          action: 'Fix dependency resolution issues in package.json',
          details: this.extractDependencyErrors(errorOutput)
        });
      }
    }
  }

  extractDependencyErrors(output) {
    const errors = [];
    const lines = output.split('\n');
    
    for (const line of lines) {
      if (line.includes('UNMET DEPENDENCY') || 
          line.includes('MISSING') ||
          line.includes('ERESOLVE') ||
          line.includes('ENOENT')) {
        errors.push(line.trim());
      }
    }
    
    return errors;
  }

  async checkSecurityVulnerabilities() {
    try {
      // Run npm audit to check for security vulnerabilities
      const auditOutput = execSync('npm audit --json', { 
        encoding: 'utf8',
        timeout: 30000,
        stdio: 'pipe' 
      });
      
      const auditResult = JSON.parse(auditOutput);
      
      if (auditResult.vulnerabilities && Object.keys(auditResult.vulnerabilities).length > 0) {
        const criticalVulns = Object.values(auditResult.vulnerabilities).filter(v => v.severity === 'critical').length;
        const highVulns = Object.values(auditResult.vulnerabilities).filter(v => v.severity === 'high').length;
        
        if (criticalVulns > 0) {
          this.blockers.push({
            type: 'CRITICAL_SECURITY_VULNERABILITIES',
            severity: 'CRITICAL',
            message: `${criticalVulns} critical security vulnerabilities detected`,
            action: 'Fix critical security vulnerabilities with npm audit fix',
            details: {
              critical: criticalVulns,
              high: highVulns,
              total: Object.keys(auditResult.vulnerabilities).length
            }
          });
        } else if (highVulns > 0) {
          this.blockers.push({
            type: 'HIGH_SECURITY_VULNERABILITIES',
            severity: 'HIGH',
            message: `${highVulns} high security vulnerabilities detected`,
            action: 'Fix high security vulnerabilities with npm audit fix',
            details: {
              high: highVulns,
              total: Object.keys(auditResult.vulnerabilities).length
            }
          });
        }
      }
      
    } catch (error) {
      // npm audit may fail if no vulnerabilities or network issues
      console.log('⚠️  Could not check security vulnerabilities:', error.message);
    }
  }

  async analyzeBuildSystem() {
    console.log('🔨 Analyzing build system...');
    
    try {
      const packageJsonPath = path.join(this.projectRoot, 'package.json');
      if (!fs.existsSync(packageJsonPath)) {
        return; // Already handled in dependency analysis
      }

      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      
      // Check for build script
      if (!packageJson.scripts || !packageJson.scripts.build) {
        this.blockers.push({
          type: 'NO_BUILD_SCRIPT',
          severity: 'MEDIUM',
          message: 'No build script defined in package.json',
          action: 'Add build script to package.json scripts section'
        });
        return;
      }

      // Test build process
      console.log('🔧 Testing build process...');
      try {
        const buildOutput = execSync('npm run build', { 
          encoding: 'utf8',
          timeout: 120000, // 2 minutes timeout
          stdio: 'pipe' 
        });
        
        console.log('✅ Build process successful');
        
        // Check if build generates expected output
        await this.checkBuildOutput();
        
        this.infraStatus.build = {
          hasScript: true,
          buildSuccessful: true
        };
        
      } catch (error) {
        this.blockers.push({
          type: 'BUILD_FAILURE',
          severity: 'CRITICAL',
          message: `Build process failed: ${error.message}`,
          action: 'Fix build errors in source code or build configuration',
          details: this.extractBuildErrors(error.stdout || error.stderr || error.message)
        });
      }
      
    } catch (error) {
      console.log('⚠️  Error analyzing build system:', error.message);
      this.blockers.push({
        type: 'BUILD_ANALYSIS_ERROR',
        severity: 'HIGH',
        message: `Failed to analyze build system: ${error.message}`,
        action: 'Check build configuration and package.json validity'
      });
    }
  }

  async checkBuildOutput() {
    const commonOutputDirs = ['dist', 'build', 'lib', 'out'];
    let foundOutput = false;
    
    for (const dir of commonOutputDirs) {
      const outputPath = path.join(this.projectRoot, dir);
      if (fs.existsSync(outputPath)) {
        foundOutput = true;
        break;
      }
    }
    
    if (!foundOutput) {
      this.blockers.push({
        type: 'NO_BUILD_OUTPUT',
        severity: 'MEDIUM',
        message: 'Build completed but no output directory found',
        action: 'Verify build script generates expected output in dist/, build/, or lib/',
        details: {
          checkedDirectories: commonOutputDirs
        }
      });
    }
  }

  extractBuildErrors(output) {
    const errors = [];
    const lines = output.split('\n');
    
    for (const line of lines) {
      if (line.includes('ERROR') || 
          line.includes('error') ||
          line.includes('Error') ||
          line.includes('failed') ||
          line.includes('Failed')) {
        errors.push(line.trim());
      }
    }
    
    return errors.slice(0, 10); // Limit to first 10 errors
  }

  async analyzeEnvironmentCompatibility() {
    console.log('🌍 Analyzing environment compatibility...');
    
    try {
      // Check Node.js version
      const nodeVersion = process.version;
      const majorVersion = parseInt(nodeVersion.replace('v', '').split('.')[0]);
      
      if (majorVersion < 18) {
        this.blockers.push({
          type: 'OUTDATED_NODE_VERSION',
          severity: 'CRITICAL',
          message: `Node.js version ${nodeVersion} is outdated (requires 18+)`,
          action: 'Update Node.js to version 18 or higher',
          details: {
            current: nodeVersion,
            minimum: 'v18.0.0'
          }
        });
      } else if (majorVersion < 20) {
        this.blockers.push({
          type: 'SUBOPTIMAL_NODE_VERSION',
          severity: 'LOW',
          message: `Node.js version ${nodeVersion} works but v20+ recommended`,
          action: 'Consider updating Node.js to version 20+ for better compatibility',
          details: {
            current: nodeVersion,
            recommended: 'v20.0.0'
          }
        });
      }
      
      // Check npm version
      const npmVersion = execSync('npm --version', { encoding: 'utf8', timeout: 5000 }).trim();
      const npmMajorVersion = parseInt(npmVersion.split('.')[0]);
      
      if (npmMajorVersion < 8) {
        this.blockers.push({
          type: 'OUTDATED_NPM_VERSION',
          severity: 'MEDIUM',
          message: `npm version ${npmVersion} is outdated (requires 8+)`,
          action: 'Update npm with npm install -g npm@latest',
          details: {
            current: npmVersion,
            minimum: '8.0.0'
          }
        });
      }
      
      // Check for required global tools
      await this.checkGlobalTools();
      
      this.infraStatus.environment = {
        nodeVersion: nodeVersion,
        npmVersion: npmVersion,
        compatible: majorVersion >= 18
      };
      
      console.log(`✅ Environment analysis complete: Node.js ${nodeVersion}, npm ${npmVersion}`);
      
    } catch (error) {
      console.log('⚠️  Error analyzing environment:', error.message);
      this.blockers.push({
        type: 'ENVIRONMENT_ANALYSIS_ERROR',
        severity: 'HIGH',
        message: `Failed to analyze environment: ${error.message}`,
        action: 'Check Node.js and npm installation'
      });
    }
  }

  async checkGlobalTools() {
    const requiredTools = [
      { name: 'git', command: 'git --version' },
      { name: 'npm', command: 'npm --version' }
    ];
    
    for (const tool of requiredTools) {
      try {
        execSync(tool.command, { stdio: 'pipe', timeout: 5000 });
      } catch (error) {
        this.blockers.push({
          type: 'MISSING_GLOBAL_TOOL',
          severity: 'CRITICAL',
          message: `Required tool '${tool.name}' is not installed or not in PATH`,
          action: `Install ${tool.name} and ensure it's in your PATH`,
          details: {
            tool: tool.name,
            command: tool.command
          }
        });
      }
    }
  }

  prioritizeBlockers() {
    console.log('📋 Prioritizing blockers...');
    
    const severityOrder = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
    
    this.blockers.sort((a, b) => {
      const severityA = severityOrder.indexOf(a.severity);
      const severityB = severityOrder.indexOf(b.severity);
      
      if (severityA !== severityB) {
        return severityA - severityB;
      }
      
      // Secondary sort by type importance
      const typeOrder = [
        'BUILD_FAILURE',
        'DEPENDENCY_CONFLICTS',
        'CRITICAL_SECURITY_VULNERABILITIES',
        'OUTDATED_NODE_VERSION',
        'PACKAGE_LOCK_OUT_OF_SYNC',
        'NO_CICD_WORKFLOWS',
        'WORKFLOW_CONFIGURATION_ISSUES'
      ];
      const typeA = typeOrder.indexOf(a.type);
      const typeB = typeOrder.indexOf(b.type);
      
      return typeA - typeB;
    });
    
    console.log(`📋 Found ${this.blockers.length} blockers, prioritized by severity`);
  }

  generateBlockerReport() {
    console.log('\n🔍 INFRASTRUCTURE BLOCKER ANALYSIS REPORT');
    console.log('==========================================\n');
    
    if (this.blockers.length === 0) {
      console.log('✅ No infrastructure blockers detected! System is ready for deployment.\n');
      return;
    }
    
    console.log(`Found ${this.blockers.length} infrastructure blockers preventing deployment:\n`);
    
    // Summary by severity
    const severityCounts = {};
    this.blockers.forEach(blocker => {
      severityCounts[blocker.severity] = (severityCounts[blocker.severity] || 0) + 1;
    });
    
    console.log('📊 SEVERITY BREAKDOWN:');
    Object.entries(severityCounts).forEach(([severity, count]) => {
      const emoji = this.getSeverityEmoji(severity);
      console.log(`${emoji} ${severity}: ${count} blockers`);
    });
    console.log();
    
    // Infrastructure status summary
    console.log('🏗️  INFRASTRUCTURE STATUS SUMMARY:');
    console.log(`CI/CD: ${this.infraStatus.cicd ? '✅ Configured' : '❌ Not configured'}`);
    console.log(`Dependencies: ${this.infraStatus.dependencies ? '✅ Analyzed' : '❌ Issues detected'}`);
    console.log(`Build: ${this.infraStatus.build?.buildSuccessful ? '✅ Successful' : '❌ Failed'}`);
    console.log(`Environment: ${this.infraStatus.environment?.compatible ? '✅ Compatible' : '❌ Incompatible'}`);
    console.log();
    
    // Detailed blocker list
    console.log('📋 DETAILED BLOCKER LIST:');
    this.blockers.forEach((blocker, index) => {
      const emoji = this.getSeverityEmoji(blocker.severity);
      console.log(`${emoji} ${index + 1}. ${blocker.type} (${blocker.severity})`);
      console.log(`   Problem: ${blocker.message}`);
      console.log(`   Action: ${blocker.action}`);
      
      if (blocker.details) {
        console.log(`   Details: ${JSON.stringify(blocker.details, null, 2)}`);
      }
      console.log();
    });
    
    // Recommended action plan
    console.log('🎯 RECOMMENDED ACTION PLAN:');
    const criticalBlockers = this.blockers.filter(b => b.severity === 'CRITICAL');
    const highBlockers = this.blockers.filter(b => b.severity === 'HIGH');
    
    if (criticalBlockers.length > 0) {
      console.log('⚠️  IMMEDIATE ACTION REQUIRED:');
      criticalBlockers.forEach((blocker, index) => {
        console.log(`${index + 1}. ${blocker.action}`);
      });
      console.log();
    }
    
    if (highBlockers.length > 0) {
      console.log('🔧 HIGH PRIORITY IMPROVEMENTS:');
      highBlockers.forEach((blocker, index) => {
        console.log(`${index + 1}. ${blocker.action}`);
      });
      console.log();
    }
    
    console.log('💡 NEXT STEPS:');
    console.log('1. Address all CRITICAL blockers first');
    console.log('2. Test infrastructure after each fix');
    console.log('3. Address HIGH priority blockers');
    console.log('4. Re-run this analysis to track progress');
    console.log(`5. Use: node ${path.relative(this.projectRoot, __filename)}`);
  }

  getSeverityEmoji(severity) {
    const emojis = {
      'CRITICAL': '🔴',
      'HIGH': '🟠',
      'MEDIUM': '🟡',
      'LOW': '🟢'
    };
    return emojis[severity] || '⚪';
  }

  // Export blockers for integration with other tools
  async exportBlockers(outputPath) {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalBlockers: this.blockers.length,
        bySeverity: {},
        infrastructureStatus: this.infraStatus
      },
      blockers: this.blockers
    };
    
    // Count by severity
    this.blockers.forEach(blocker => {
      const severity = blocker.severity;
      report.summary.bySeverity[severity] = (report.summary.bySeverity[severity] || 0) + 1;
    });
    
    if (outputPath) {
      fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
      console.log(`📄 Infrastructure blocker report exported to: ${outputPath}`);
    }
    
    return report;
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const outputPath = args.includes('--output') ? args[args.indexOf('--output') + 1] : null;
  const jsonOutput = args.includes('--json');
  
  const detector = new InfrastructureBlockerDetector();
  
  try {
    const blockers = await detector.analyzeInfrastructureBlockers();
    
    if (jsonOutput) {
      const report = await detector.exportBlockers(outputPath);
      console.log(JSON.stringify(report, null, 2));
    } else if (outputPath) {
      await detector.exportBlockers(outputPath);
    }
    
    // Exit with appropriate code
    const criticalBlockers = blockers.filter(b => b.severity === 'CRITICAL');
    const highBlockers = blockers.filter(b => b.severity === 'HIGH');
    
    if (criticalBlockers.length > 0) {
      process.exit(2); // Critical blockers
    } else if (highBlockers.length > 0) {
      process.exit(1); // High priority blockers
    } else {
      process.exit(0); // Success
    }
  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    process.exit(3);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = InfrastructureBlockerDetector;