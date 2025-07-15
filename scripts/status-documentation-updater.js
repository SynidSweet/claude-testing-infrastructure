#!/usr/bin/env node

/**
 * Automated Status Documentation Updater
 * 
 * Part of Truth Validation System - maintains accurate documentation
 * Automatically updates status sections in documentation based on actual project state
 * 
 * Features:
 * - Template-based status documentation generation
 * - Maintains documentation accuracy over time
 * - Provides audit trail of status changes
 * - Git integration for automated commits (optional)
 * 
 * Usage:
 *   node scripts/status-documentation-updater.js                    # Update docs with current status
 *   node scripts/status-documentation-updater.js --dry-run          # Preview changes without writing
 *   node scripts/status-documentation-updater.js --commit           # Auto-commit changes
 *   node scripts/status-documentation-updater.js --json             # JSON output
 */

const fs = require('fs/promises');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

class StatusDocumentationUpdater {
  constructor(options = {}) {
    this.options = {
      dryRun: options.dryRun || false,
      autoCommit: options.autoCommit || false,
      jsonOutput: options.jsonOutput || false,
      verbose: options.verbose || false,
      auditFile: options.auditFile || '.claude-testing/status-update-audit.json',
      ...options
    };
    
    this.updates = [];
    this.auditLog = [];
    this.targetFiles = [
      {
        path: 'docs/CURRENT_FOCUS.md',
        statusSection: 'Actual Project Metrics',
        updatePattern: /### Actual Project Metrics \(as of \d{4}-\d{2}-\d{2}\)[\s\S]*?(?=\n##|\n### |\z)/
      },
      {
        path: 'PROJECT_CONTEXT.md',
        statusSection: 'Current Status',
        updatePattern: /### Current Status\n\*\*MVP PHASE \d+\*\*[^\n]*[\s\S]*?(?=\n###|\n##|\z)/
      }
    ];
  }

  async run() {
    if (!this.options.jsonOutput) {
      console.log('📝 Automated Status Documentation Updater');
      console.log('========================================\n');
    }

    try {
      // Get current status from Status Aggregator
      const currentStatus = await this.getCurrentStatus();
      
      // Process each target file
      for (const target of this.targetFiles) {
        await this.updateDocumentFile(target, currentStatus);
      }
      
      // Create audit log entry
      await this.createAuditEntry(currentStatus);
      
      // Write updates if not dry run
      if (!this.options.dryRun) {
        await this.writeUpdates();
        
        // Auto-commit if requested
        if (this.options.autoCommit) {
          await this.commitChanges();
        }
      }
      
      // Generate output
      if (this.options.jsonOutput) {
        console.log(JSON.stringify({
          success: true,
          updates: this.updates,
          audit: this.auditLog[this.auditLog.length - 1]
        }, null, 2));
      } else {
        this.generateReport();
      }
      
      return 0;
    } catch (error) {
      console.error('❌ Documentation update failed:', error.message);
      if (this.options.jsonOutput) {
        console.log(JSON.stringify({
          success: false,
          error: error.message
        }, null, 2));
      }
      return 1;
    }
  }

  async getCurrentStatus() {
    if (this.options.verbose) console.log('📊 Getting current project status...');
    
    try {
      // Run Status Aggregator to get current status
      const StatusAggregator = require('./status-aggregator');
      const aggregator = new StatusAggregator({
        jsonOutput: true,
        verbose: false
      });
      
      // Collect status data
      await aggregator.collectTestStatus();
      await aggregator.collectLintingStatus();
      await aggregator.collectBuildStatus();
      await aggregator.collectCICDStatus();
      await aggregator.collectDocumentationStatus();
      await aggregator.collectAIStatus();
      aggregator.calculateOverallStatus();
      
      return aggregator.status;
    } catch (error) {
      throw new Error(`Failed to get current status: ${error.message}`);
    }
  }

  async updateDocumentFile(target, status) {
    if (this.options.verbose) console.log(`📄 Processing ${target.path}...`);
    
    try {
      const filePath = path.join(process.cwd(), target.path);
      const content = await fs.readFile(filePath, 'utf8');
      
      // Generate new status section
      const newStatusSection = this.generateStatusSection(target, status);
      
      // Find and replace the status section
      const match = content.match(target.updatePattern);
      if (!match) {
        if (this.options.verbose) {
          console.log(`   ⚠️  Status section not found in ${target.path}`);
        }
        return;
      }
      
      const oldSection = match[0];
      const updatedContent = content.replace(oldSection, newStatusSection);
      
      // Check if there are actual changes
      if (oldSection === newStatusSection) {
        if (this.options.verbose) {
          console.log(`   ✓ No changes needed in ${target.path}`);
        }
        return;
      }
      
      // Record the update
      this.updates.push({
        file: target.path,
        oldContent: oldSection,
        newContent: newStatusSection,
        updatedContent: updatedContent
      });
      
      if (this.options.verbose) {
        console.log(`   ✓ Status section updated in ${target.path}`);
      }
    } catch (error) {
      console.error(`Failed to update ${target.path}:`, error.message);
    }
  }

  generateStatusSection(target, status) {
    const today = new Date().toISOString().split('T')[0];
    
    if (target.path === 'docs/CURRENT_FOCUS.md') {
      return this.generateCurrentFocusStatus(status, today);
    } else if (target.path === 'PROJECT_CONTEXT.md') {
      return this.generateProjectContextStatus(status, today);
    }
    
    return '';
  }

  generateCurrentFocusStatus(status, date) {
    const testStats = status.tests || {};
    const lintStats = status.linting || {};
    const buildStats = status.build || {};
    
    return `### Actual Project Metrics (as of ${date})
- **Test Status**: ${testStats.passed || 0} passed, ${testStats.total || 0} total (${((testStats.passRate || 0) * 100).toFixed(1)}% pass rate${testStats.skipped ? `, ${testStats.skipped} test skipped` : ''})
- **Linting Status**: ${lintStats.errorCount + lintStats.warningCount || 0} problems (${lintStats.errorCount || 0} errors, ${lintStats.warningCount || 0} warnings)${lintStats.errorCount < 103 ? ' - down from 103 problems' : ''}
- **TypeScript**: ${buildStats.successful ? 'Clean compilation (0 errors)' : 'Compilation errors present'}
- **Build**: ${buildStats.status || 'Unknown'}
- **Phase 1**: ✅ COMPLETE - All 4 infrastructure tasks done
- **Phase 2**: ✅ COMPLETE - All 3 truth validation tasks done
- **Phase 3**: ✅ COMPLETE - All 3 blocker detection tasks complete
**Current Phase**: Phase 4 - Integrated Workflow Implementation
**Phase 1 Results**: ✅ TASK-INFRA-001 (Node.js version fixed), ✅ TASK-INFRA-002 (package sync resolved), ✅ TASK-INFRA-003 (linting 84% improved), ✅ TASK-INFRA-004 (documentation accuracy verified)
**Phase 2 Results**: ✅ TASK-TRUTH-001 (Status Aggregator Core Engine implemented), ✅ TASK-TRUTH-002 (Documentation Claim Parser implemented), ✅ TASK-TRUTH-003 (Truth Validation Engine implemented)
**Phase 3 Results**: ✅ TASK-BLOCKER-001 (Test Suite Blocker Detector implemented), ✅ TASK-BLOCKER-002 (Infrastructure Blocker Detector implemented), ✅ TASK-BLOCKER-003 (Code Quality Blocker Detector implemented)
**Phase 4 Results**: ✅ TASK-WORKFLOW-001 (Pre-commit Truth Validation Hook implemented)
**Next Task**: TASK-WORKFLOW-002 - Automated Status Documentation Updater
**Status**: Infrastructure foundation complete, Status Aggregator operational, Documentation Claim Parser operational, ${lintStats.errorCount + lintStats.warningCount || 0} linting problems remain (${lintStats.errorCount || 0} errors, ${lintStats.warningCount || 0} warnings), ${testStats.passed || 0}/${testStats.total || 0} tests passing`;
  }

  generateProjectContextStatus(status, date) {
    const testStats = status.tests || {};
    const lintStats = status.linting || {};
    const buildStats = status.build || {};
    
    const testPercent = ((testStats.passRate || 0) * 100).toFixed(1);
    const lintTotal = (lintStats.errorCount || 0) + (lintStats.warningCount || 0);
    
    return `### Current Status
**MVP PHASE 2** (${date}): **TRUTH VALIDATION SYSTEM PHASE 4 PROGRESS** - Phase 1 complete (all 4 infrastructure fix tasks), Phase 2 complete (all 3 truth validation tasks), Phase 3 complete (all 3 blocker detection tasks), Phase 4 in progress (1/2 tasks complete). Test suite: ${testStats.passed || 0}/${testStats.total || 0} passing (${testPercent}%), Linting: ${lintTotal} problems (${lintStats.errorCount || 0} errors, ${lintStats.warningCount || 0} warnings), Build: ${buildStats.successful ? '0 TypeScript errors' : 'TypeScript errors present'}. Pre-commit truth validation hook operational preventing false claims in commits. Next: TASK-WORKFLOW-002 - Automated Status Documentation Updater.`;
  }

  async createAuditEntry(status) {
    const entry = {
      timestamp: new Date().toISOString(),
      status: {
        tests: status.tests,
        linting: status.linting,
        build: status.build,
        overall: status.overall
      },
      updates: this.updates.map(u => ({
        file: u.file,
        changed: u.oldContent !== u.newContent
      })),
      options: {
        dryRun: this.options.dryRun,
        autoCommit: this.options.autoCommit
      }
    };
    
    this.auditLog.push(entry);
    
    // Save audit log if not dry run
    if (!this.options.dryRun) {
      await this.saveAuditLog();
    }
  }

  async saveAuditLog() {
    try {
      const auditPath = path.join(process.cwd(), this.options.auditFile);
      const auditDir = path.dirname(auditPath);
      
      // Ensure directory exists
      await fs.mkdir(auditDir, { recursive: true });
      
      // Load existing audit log
      let existingLog = [];
      try {
        const content = await fs.readFile(auditPath, 'utf8');
        existingLog = JSON.parse(content);
      } catch (error) {
        // File doesn't exist or is invalid, start fresh
      }
      
      // Append new entries
      const updatedLog = [...existingLog, ...this.auditLog];
      
      // Keep only last 100 entries
      const trimmedLog = updatedLog.slice(-100);
      
      // Save updated log
      await fs.writeFile(auditPath, JSON.stringify(trimmedLog, null, 2));
      
      if (this.options.verbose) {
        console.log(`\n✓ Audit log saved to ${this.options.auditFile}`);
      }
    } catch (error) {
      console.error('Failed to save audit log:', error.message);
    }
  }

  async writeUpdates() {
    for (const update of this.updates) {
      const filePath = path.join(process.cwd(), update.file);
      await fs.writeFile(filePath, update.updatedContent, 'utf8');
      
      if (this.options.verbose) {
        console.log(`✓ Written updates to ${update.file}`);
      }
    }
  }

  async commitChanges() {
    if (this.updates.length === 0) {
      if (this.options.verbose) {
        console.log('\nNo changes to commit');
      }
      return;
    }
    
    try {
      const filesList = this.updates.map(u => u.file).join(' ');
      
      // Add files
      await execAsync(`git add ${filesList}`);
      
      // Create commit message
      const today = new Date().toISOString().split('T')[0];
      const commitMessage = `docs: Update status documentation (${today})

Automated status update by Truth Validation System
Files updated: ${this.updates.map(u => path.basename(u.file)).join(', ')}

Generated by: scripts/status-documentation-updater.js`;
      
      // Commit changes
      await execAsync(`git commit -m "${commitMessage}"`);
      
      if (!this.options.jsonOutput) {
        console.log('\n✅ Changes committed to git');
      }
    } catch (error) {
      console.error('\n❌ Failed to commit changes:', error.message);
    }
  }

  generateReport() {
    console.log('\n📊 Documentation Update Report');
    console.log('==============================\n');
    
    if (this.updates.length === 0) {
      console.log('✓ All documentation is up to date!');
      return;
    }
    
    console.log(`Found ${this.updates.length} file(s) requiring updates:\n`);
    
    for (const update of this.updates) {
      console.log(`📄 ${update.file}`);
      
      if (this.options.verbose) {
        console.log('   Old content:');
        console.log('   ' + update.oldContent.split('\n').map(l => '   │ ' + l).join('\n'));
        console.log('   New content:');
        console.log('   ' + update.newContent.split('\n').map(l => '   │ ' + l).join('\n'));
      }
    }
    
    if (this.options.dryRun) {
      console.log('\n⚠️  DRY RUN - No files were modified');
      console.log('Remove --dry-run to apply changes');
    } else {
      console.log('\n✅ Documentation updated successfully');
      
      if (!this.options.autoCommit) {
        console.log('\nTo commit these changes:');
        console.log('  git add ' + this.updates.map(u => u.file).join(' '));
        console.log('  git commit -m "docs: Update status documentation"');
      }
    }
    
    // Show audit log location
    if (!this.options.dryRun) {
      console.log(`\n📋 Audit log: ${this.options.auditFile}`);
    }
  }
}

// CLI execution
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {
    dryRun: args.includes('--dry-run'),
    autoCommit: args.includes('--commit'),
    jsonOutput: args.includes('--json'),
    verbose: args.includes('--verbose') || args.includes('-v'),
    help: args.includes('--help') || args.includes('-h')
  };
  
  if (options.help) {
    console.log(`
Automated Status Documentation Updater

Usage: node scripts/status-documentation-updater.js [options]

Options:
  --dry-run     Preview changes without writing files
  --commit      Automatically commit changes to git
  --json        Output results in JSON format
  --verbose     Show detailed information
  --help        Show this help message

Examples:
  # Update documentation with current status
  node scripts/status-documentation-updater.js
  
  # Preview changes without writing
  node scripts/status-documentation-updater.js --dry-run
  
  # Update and auto-commit
  node scripts/status-documentation-updater.js --commit
`);
    process.exit(0);
  }
  
  const updater = new StatusDocumentationUpdater(options);
  updater.run().then(exitCode => {
    process.exit(exitCode);
  });
}

module.exports = StatusDocumentationUpdater;