#!/usr/bin/env node

/**
 * Truth Validation Engine
 * 
 * Core engine that compares documented claims with actual status
 * Part of Truth Validation System - provides comprehensive discrepancy detection
 * 
 * Features:
 * - Compares documented claims with actual status from Status Aggregator
 * - Identifies specific discrepancies with severity assessment
 * - Provides actionable discrepancy reports
 * - Validates production readiness claims against reality
 * - Implements configurable tolerance levels for numeric comparisons
 * 
 * Usage:
 *   node scripts/truth-validation-engine.js                    # Basic validation
 *   node scripts/truth-validation-engine.js --json            # JSON output
 *   node scripts/truth-validation-engine.js --exit-on-fail    # Exit 1 if discrepancies found
 *   node scripts/truth-validation-engine.js --strict          # Strict validation (lower tolerance)
 *   node scripts/truth-validation-engine.js --detailed        # Detailed discrepancy analysis
 */

const path = require('path');
const StatusAggregator = require('./status-aggregator');
const DocumentationClaimParser = require('./documentation-claim-parser');

class TruthValidationEngine {
  constructor(options = {}) {
    this.options = {
      jsonOutput: options.jsonOutput || false,
      exitOnFail: options.exitOnFail || false,
      strict: options.strict || false,
      detailed: options.detailed || false,
      verbose: options.verbose || false,
      ...options
    };
    
    this.config = {
      // Tolerance levels for numeric comparisons
      tolerance: {
        testPassRate: this.options.strict ? 0.005 : 0.01,  // 0.5% vs 1%
        percentage: this.options.strict ? 0.005 : 0.01,    // 0.5% vs 1%
        errorCount: 0,  // No tolerance for error counts
        score: this.options.strict ? 0.02 : 0.05           // 2% vs 5%
      },
      
      // Severity thresholds
      severity: {
        testPassRate: {
          high: 0.1,     // 10% difference
          medium: 0.05,  // 5% difference
          low: 0.02      // 2% difference
        },
        score: {
          high: 0.20,    // 20% difference
          medium: 0.10,  // 10% difference
          low: 0.05      // 5% difference
        }
      }
    };
    
    this.discrepancies = [];
    this.actualStatus = null;
    this.documentedClaims = null;
    this.summary = {
      totalClaims: 0,
      validatedClaims: 0,
      discrepancies: 0,
      criticalDiscrepancies: 0,
      highSeverityDiscrepancies: 0,
      mediumSeverityDiscrepancies: 0,
      lowSeverityDiscrepancies: 0
    };
  }

  async run() {
    if (!this.options.jsonOutput) {
      console.log('🔍 Truth Validation Engine');
      console.log('==========================\n');
    }

    try {
      // Collect actual status
      await this.collectActualStatus();
      
      // Parse documented claims
      await this.parseDocumentedClaims();
      
      // Perform validation
      await this.validateAllClaims();
      
      // Generate results
      this.generateSummary();
      
      if (this.options.jsonOutput) {
        this.outputJSON();
      } else {
        this.generateReport();
      }
      
      // Exit with appropriate code
      if (this.options.exitOnFail && this.discrepancies.length > 0) {
        return 1;
      }
      
      return 0;
    } catch (error) {
      console.error('❌ Truth validation failed:', error.message);
      if (this.options.verbose) {
        console.error('Stack trace:', error.stack);
      }
      return 2;
    }
  }

  async collectActualStatus() {
    if (this.options.verbose) console.log('📊 Collecting actual status...');
    
    const statusAggregator = new StatusAggregator({
      verbose: false,
      jsonOutput: false,
      validateClaims: false
    });
    
    await statusAggregator.run();
    this.actualStatus = statusAggregator.status;
    
    if (this.options.verbose) {
      console.log(`   Test pass rate: ${(this.actualStatus.tests.passRate * 100).toFixed(1)}%`);
      console.log(`   Linting errors: ${this.actualStatus.linting.errorCount}`);
      console.log(`   Overall score: ${this.actualStatus.overall.percentage}%`);
    }
  }

  async parseDocumentedClaims() {
    if (this.options.verbose) console.log('📄 Parsing documented claims...');
    
    const parser = new DocumentationClaimParser({
      targetPath: process.cwd(),
      verbose: false,
      jsonOutput: false
    });
    
    await parser.run();
    this.documentedClaims = parser.getClaims();
    
    if (this.options.verbose) {
      console.log(`   Production ready claims: ${this.documentedClaims.productionReady.length}`);
      console.log(`   Test pass rate claims: ${this.documentedClaims.testPassRate.length}`);
      console.log(`   Error count claims: ${this.documentedClaims.errorCount.length}`);
      console.log(`   Completion claims: ${this.documentedClaims.completed.length}`);
    }
  }

  async validateAllClaims() {
    if (this.options.verbose) console.log('🔍 Validating all claims...');
    
    // Validate production readiness claims
    await this.validateProductionReadinessClaims();
    
    // Validate test pass rate claims
    await this.validateTestPassRateClaims();
    
    // Validate error count claims
    await this.validateErrorCountClaims();
    
    // Validate completion claims
    await this.validateCompletionClaims();
    
    // Validate status claims
    await this.validateStatusClaims();
    
    // Validate build status claims
    await this.validateBuildStatusClaims();
    
    // Validate CI/CD status claims
    await this.validateCICDStatusClaims();
  }

  async validateProductionReadinessClaims() {
    const claims = this.documentedClaims.productionReady;
    const actuallyReady = this.actualStatus.overall.status === 'PRODUCTION_READY';
    
    for (const claim of claims) {
      const isDiscrepancy = !actuallyReady;
      
      if (isDiscrepancy) {
        this.addDiscrepancy({
          type: 'production-readiness',
          claimed: 'Production Ready',
          actual: this.actualStatus.overall.status,
          severity: this.determineSeverity('production-readiness', true, actuallyReady),
          source: `${claim.file}:${claim.line}`,
          claimText: claim.claim,
          context: {
            actualScore: this.actualStatus.overall.percentage,
            criticalIssues: this.actualStatus.overall.criticalIssues,
            testPassRate: this.actualStatus.tests.passRate,
            lintingErrors: this.actualStatus.linting.errorCount,
            buildStatus: this.actualStatus.build.status,
            cicdStatus: this.actualStatus.cicd.status
          }
        });
      }
    }
  }

  async validateTestPassRateClaims() {
    const claims = this.documentedClaims.testPassRate;
    const actualPassRate = this.actualStatus.tests.passRate;
    
    for (const claim of claims) {
      const difference = Math.abs(claim.value - actualPassRate);
      const isDiscrepancy = difference > this.config.tolerance.testPassRate;
      
      if (isDiscrepancy) {
        this.addDiscrepancy({
          type: 'test-pass-rate',
          claimed: `${(claim.value * 100).toFixed(1)}%`,
          actual: `${(actualPassRate * 100).toFixed(1)}%`,
          severity: this.determineSeverity('test-pass-rate', difference),
          source: `${claim.file}:${claim.line}`,
          claimText: claim.claim,
          context: {
            difference: difference,
            tolerance: this.config.tolerance.testPassRate,
            actualTests: `${this.actualStatus.tests.passed}/${this.actualStatus.tests.total}`,
            claimedTests: claim.total ? `${claim.passed}/${claim.total}` : 'percentage only'
          }
        });
      }
    }
  }

  async validateErrorCountClaims() {
    const claims = this.documentedClaims.errorCount;
    const actualErrorCount = this.actualStatus.linting.errorCount;
    
    for (const claim of claims) {
      const isDiscrepancy = claim.value !== actualErrorCount;
      
      if (isDiscrepancy) {
        this.addDiscrepancy({
          type: 'error-count',
          claimed: claim.value,
          actual: actualErrorCount,
          severity: this.determineSeverity('error-count', claim.value, actualErrorCount),
          source: `${claim.file}:${claim.line}`,
          claimText: claim.claim,
          context: {
            actualWarnings: this.actualStatus.linting.warningCount,
            totalProblems: this.actualStatus.linting.totalProblems,
            lintingStatus: this.actualStatus.linting.status
          }
        });
      }
    }
  }

  async validateCompletionClaims() {
    const claims = this.documentedClaims.completed;
    const hasCriticalIssues = this.actualStatus.overall.criticalIssues.length > 0;
    const isSystemReady = this.actualStatus.overall.status === 'PRODUCTION_READY';
    
    // Group claims by file for more meaningful reporting
    const claimsByFile = {};
    for (const claim of claims) {
      if (!claimsByFile[claim.file]) {
        claimsByFile[claim.file] = [];
      }
      claimsByFile[claim.file].push(claim);
    }
    
    // Validate completion claims against system readiness
    for (const [filePath, fileClaims] of Object.entries(claimsByFile)) {
      if (hasCriticalIssues) {
        this.addDiscrepancy({
          type: 'completion-claims',
          claimed: `${fileClaims.length} completion claims`,
          actual: `${this.actualStatus.overall.criticalIssues.length} critical issues`,
          severity: 'HIGH',
          source: filePath,
          claimText: fileClaims.map(c => c.claim).join(', '),
          context: {
            claimCount: fileClaims.length,
            criticalIssues: this.actualStatus.overall.criticalIssues,
            systemStatus: this.actualStatus.overall.status,
            systemScore: this.actualStatus.overall.percentage
          }
        });
      }
    }
  }

  async validateStatusClaims() {
    const claims = this.documentedClaims.status;
    const actualStatus = this.actualStatus.overall.status.toLowerCase();
    
    for (const claim of claims) {
      const claimedStatus = claim.value.toLowerCase();
      const isDiscrepancy = claimedStatus !== actualStatus;
      
      if (isDiscrepancy) {
        this.addDiscrepancy({
          type: 'status',
          claimed: claim.value,
          actual: this.actualStatus.overall.status,
          severity: this.determineSeverity('status', claimedStatus, actualStatus),
          source: `${claim.file}:${claim.line}`,
          claimText: claim.claim,
          context: {
            systemScore: this.actualStatus.overall.percentage,
            criticalIssues: this.actualStatus.overall.criticalIssues
          }
        });
      }
    }
  }

  async validateBuildStatusClaims() {
    const claims = this.documentedClaims.buildStatus;
    const actualBuildStatus = this.actualStatus.build.status.toLowerCase();
    const actualSuccess = this.actualStatus.build.successful;
    
    for (const claim of claims) {
      const claimedStatus = claim.value.toLowerCase();
      let isDiscrepancy = false;
      
      if (claimedStatus === 'success' && !actualSuccess) {
        isDiscrepancy = true;
      } else if (claimedStatus === 'failed' && actualSuccess) {
        isDiscrepancy = true;
      }
      
      if (isDiscrepancy) {
        this.addDiscrepancy({
          type: 'build-status',
          claimed: claim.value,
          actual: actualBuildStatus,
          severity: 'HIGH',
          source: `${claim.file}:${claim.line}`,
          claimText: claim.claim,
          context: {
            buildSuccessful: actualSuccess,
            artifactsPresent: this.actualStatus.build.artifactsPresent,
            cliWorking: this.actualStatus.build.cliWorking
          }
        });
      }
    }
  }

  async validateCICDStatusClaims() {
    const claims = this.documentedClaims.cicdStatus;
    const actualCICDStatus = this.actualStatus.cicd.status.toLowerCase();
    const actualPassing = this.actualStatus.cicd.passing;
    
    for (const claim of claims) {
      const claimedStatus = claim.value.toLowerCase();
      let isDiscrepancy = false;
      
      if (claimedStatus === 'passing' && !actualPassing) {
        isDiscrepancy = true;
      } else if (claimedStatus === 'failing' && actualPassing) {
        isDiscrepancy = true;
      }
      
      if (isDiscrepancy) {
        this.addDiscrepancy({
          type: 'cicd-status',
          claimed: claim.value,
          actual: actualCICDStatus,
          severity: 'HIGH',
          source: `${claim.file}:${claim.line}`,
          claimText: claim.claim,
          context: {
            pipelineStatus: this.actualStatus.cicd.pipelineStatus,
            currentBranch: this.actualStatus.cicd.currentBranch,
            lastRun: this.actualStatus.cicd.lastRun
          }
        });
      }
    }
  }

  determineSeverity(type, claimedValue, actualValue) {
    switch (type) {
      case 'production-readiness':
        return claimedValue && !actualValue ? 'CRITICAL' : 'HIGH';
      
      case 'test-pass-rate':
        const difference = typeof claimedValue === 'number' ? claimedValue : Math.abs(claimedValue - actualValue);
        if (difference > this.config.severity.testPassRate.high) return 'HIGH';
        if (difference > this.config.severity.testPassRate.medium) return 'MEDIUM';
        return 'LOW';
      
      case 'error-count':
        const errorDifference = Math.abs(claimedValue - actualValue);
        if (claimedValue === 0 && actualValue > 0) return 'HIGH';
        if (errorDifference > 10) return 'HIGH';
        if (errorDifference > 5) return 'MEDIUM';
        return 'LOW';
      
      case 'status':
        if (claimedValue === 'production_ready' && actualValue !== 'production_ready') return 'CRITICAL';
        return 'HIGH';
      
      case 'build-status':
      case 'cicd-status':
        return 'HIGH';
      
      default:
        return 'MEDIUM';
    }
  }

  addDiscrepancy(discrepancy) {
    this.discrepancies.push({
      ...discrepancy,
      timestamp: new Date().toISOString(),
      id: `${discrepancy.type}-${this.discrepancies.length + 1}`
    });
  }

  generateSummary() {
    // Calculate total claims
    this.summary.totalClaims = Object.values(this.documentedClaims)
      .filter(claims => Array.isArray(claims))
      .reduce((total, claims) => total + claims.length, 0);
    
    this.summary.validatedClaims = this.summary.totalClaims;
    this.summary.discrepancies = this.discrepancies.length;
    
    // Count by severity
    for (const discrepancy of this.discrepancies) {
      switch (discrepancy.severity) {
        case 'CRITICAL':
          this.summary.criticalDiscrepancies++;
          break;
        case 'HIGH':
          this.summary.highSeverityDiscrepancies++;
          break;
        case 'MEDIUM':
          this.summary.mediumSeverityDiscrepancies++;
          break;
        case 'LOW':
          this.summary.lowSeverityDiscrepancies++;
          break;
      }
    }
  }

  outputJSON() {
    const output = {
      summary: this.summary,
      discrepancies: this.discrepancies,
      actualStatus: this.actualStatus,
      documentedClaims: this.documentedClaims.metadata,
      config: this.config,
      timestamp: new Date().toISOString()
    };
    
    console.log(JSON.stringify(output, null, 2));
  }

  generateReport() {
    console.log('📊 Truth Validation Report');
    console.log('==========================\n');
    
    // Summary
    console.log('📋 Validation Summary:');
    console.log(`   Total claims validated: ${this.summary.totalClaims}`);
    console.log(`   Discrepancies found: ${this.summary.discrepancies}`);
    
    if (this.summary.discrepancies > 0) {
      console.log(`   Critical: ${this.summary.criticalDiscrepancies}`);
      console.log(`   High: ${this.summary.highSeverityDiscrepancies}`);
      console.log(`   Medium: ${this.summary.mediumSeverityDiscrepancies}`);
      console.log(`   Low: ${this.summary.lowSeverityDiscrepancies}`);
    }
    
    // Overall status
    const accuracy = ((this.summary.totalClaims - this.summary.discrepancies) / this.summary.totalClaims * 100).toFixed(1);
    console.log(`   Documentation accuracy: ${accuracy}%`);
    
    if (this.summary.discrepancies === 0) {
      console.log('\n✅ All claims validated successfully! Documentation is accurate.');
    } else {
      console.log('\n⚠️  Discrepancies found - documentation does not match reality:');
      
      // Group discrepancies by type
      const byType = {};
      for (const discrepancy of this.discrepancies) {
        if (!byType[discrepancy.type]) {
          byType[discrepancy.type] = [];
        }
        byType[discrepancy.type].push(discrepancy);
      }
      
      for (const [type, discrepancies] of Object.entries(byType)) {
        console.log(`\n🔍 ${type.toUpperCase()} Discrepancies:`);
        
        for (const discrepancy of discrepancies) {
          console.log(`   ${this.getSeverityIcon(discrepancy.severity)} ${discrepancy.source}`);
          console.log(`      Claimed: ${discrepancy.claimed}`);
          console.log(`      Actual: ${discrepancy.actual}`);
          
          if (this.options.detailed && discrepancy.context) {
            console.log(`      Context: ${JSON.stringify(discrepancy.context, null, 8)}`);
          }
          
          if (discrepancy.claimText) {
            console.log(`      Text: "${discrepancy.claimText}"`);
          }
        }
      }
    }
    
    // Recommendations
    if (this.summary.discrepancies > 0) {
      console.log('\n💡 Recommendations:');
      
      if (this.summary.criticalDiscrepancies > 0) {
        console.log('   1. Address critical issues immediately');
        console.log('   2. Update documentation to reflect actual status');
      }
      
      if (this.summary.highSeverityDiscrepancies > 0) {
        console.log('   3. Fix high-severity discrepancies');
        console.log('   4. Implement pre-commit validation');
      }
      
      console.log('   5. Run: npm run validate:truth before commits');
      console.log('   6. Consider implementing automated documentation updates');
    }
    
    console.log('');
  }

  getSeverityIcon(severity) {
    switch (severity) {
      case 'CRITICAL': return '🚨';
      case 'HIGH': return '❌';
      case 'MEDIUM': return '⚠️';
      case 'LOW': return '💛';
      default: return '❓';
    }
  }
}

// CLI handling
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {
    jsonOutput: args.includes('--json'),
    exitOnFail: args.includes('--exit-on-fail'),
    strict: args.includes('--strict'),
    detailed: args.includes('--detailed'),
    verbose: args.includes('--verbose')
  };
  
  const engine = new TruthValidationEngine(options);
  engine.run().then(exitCode => {
    process.exit(exitCode);
  }).catch(error => {
    console.error('Fatal error:', error);
    process.exit(2);
  });
}

module.exports = TruthValidationEngine;