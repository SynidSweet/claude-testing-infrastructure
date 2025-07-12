#!/usr/bin/env node

/**
 * Documentation Claim Parser
 * 
 * Extracts and structures claims from documentation files for validation
 * Part of Truth Validation System - enables automated claim verification
 * 
 * Features:
 * - Parses completion claims from markdown documentation
 * - Extracts specific metrics (percentages, test rates, status claims)
 * - Provides structured claims for comparison with actual status
 * - Supports various claim patterns and formats
 * 
 * Usage:
 *   node scripts/documentation-claim-parser.js                    # Parse all docs
 *   node scripts/documentation-claim-parser.js --file docs/      # Parse specific directory
 *   node scripts/documentation-claim-parser.js --json            # JSON output
 *   node scripts/documentation-claim-parser.js --verbose         # Detailed output
 */

const fs = require('fs/promises');
const path = require('path');
const glob = require('fast-glob');

class DocumentationClaimParser {
  constructor(options = {}) {
    this.options = {
      targetPath: options.targetPath || process.cwd(),
      jsonOutput: options.jsonOutput || false,
      verbose: options.verbose || false,
      ...options
    };
    
    this.claims = {
      productionReady: [],
      testPassRate: [],
      errorCount: [],
      completed: [],
      status: [],
      percentages: [],
      buildStatus: [],
      cicdStatus: [],
      metadata: {
        filesScanned: 0,
        claimsFound: 0,
        lastScan: new Date().toISOString()
      }
    };
    
    // Claim extraction patterns
    this.patterns = {
      // Production readiness claims
      productionReady: [
        /production\s+ready/gi,
        /100%.*ready/gi,
        /fully\s+ready/gi,
        /deployment\s+ready/gi,
        /ready\s+for\s+production/gi
      ],
      
      // Test pass rate claims
      testPassRate: [
        /(\d+\.?\d*)%.*pass/gi,
        /(\d+\.?\d*)%.*test.*pass/gi,
        /pass.*rate.*(\d+\.?\d*)%/gi,
        /(\d+)\s*\/\s*(\d+).*pass/gi,
        /(\d+)\s*of\s*(\d+).*pass/gi
      ],
      
      // Error count claims
      errorCount: [
        /(\d+)\s*errors?/gi,
        /(\d+)\s*linting.*errors?/gi,
        /(\d+)\s*compilation.*errors?/gi,
        /0\s*errors?/gi,
        /no\s*errors?/gi,
        /error[_-]free/gi
      ],
      
      // Completion claims
      completed: [
        /✅.*completed?/gi,
        /✅.*done/gi,
        /✅.*finished/gi,
        /completed?.*✅/gi,
        /done.*✅/gi,
        /finished.*✅/gi,
        /completed?\s*$/gim,
        /complete\s*$/gim
      ],
      
      // Status claims  
      status: [
        /status:\s*(\w+)/gi,
        /state:\s*(\w+)/gi,
        /phase:\s*(\w+)/gi,
        /stage:\s*(\w+)/gi
      ],
      
      // General percentage claims
      percentages: [
        /(\d+\.?\d*)%/gi
      ],
      
      // Build status claims
      buildStatus: [
        /build.*success/gi,
        /build.*fail/gi,
        /build.*pass/gi,
        /successful.*build/gi,
        /failed.*build/gi,
        /build.*error/gi
      ],
      
      // CI/CD status claims
      cicdStatus: [
        /ci.*pass/gi,
        /ci.*fail/gi,
        /pipeline.*pass/gi,
        /pipeline.*fail/gi,
        /workflow.*pass/gi,
        /workflow.*fail/gi,
        /ci\/cd.*pass/gi,
        /ci\/cd.*fail/gi
      ]
    };
  }

  async run() {
    if (!this.options.jsonOutput) {
      console.log('🔍 Documentation Claim Parser');
      console.log('=============================\n');
    }

    try {
      // Find all markdown files
      const markdownFiles = await this.findMarkdownFiles();
      
      if (this.options.verbose) {
        console.log(`📄 Found ${markdownFiles.length} markdown files to scan`);
      }

      // Parse each file
      for (const filePath of markdownFiles) {
        await this.parseFile(filePath);
      }

      // Update metadata
      this.claims.metadata.filesScanned = markdownFiles.length;
      this.claims.metadata.claimsFound = this.getTotalClaimsCount();

      // Generate output
      if (this.options.jsonOutput) {
        console.log(JSON.stringify(this.claims, null, 2));
      } else {
        this.generateReport();
      }

      return 0;
    } catch (error) {
      console.error('❌ Documentation claim parsing failed:', error.message);
      return 1;
    }
  }

  async findMarkdownFiles() {
    const patterns = [
      '**/*.md',
      '**/*.MD'
    ];

    const files = [];
    for (const pattern of patterns) {
      const globPath = path.join(this.options.targetPath, pattern);
      const matches = await glob(globPath, { 
        ignore: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/.claude-testing/**']
      });
      files.push(...matches);
    }

    // Remove duplicates and sort
    return [...new Set(files)].sort();
  }

  async parseFile(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const relativePath = path.relative(this.options.targetPath, filePath);
      
      if (this.options.verbose) {
        console.log(`📄 Parsing: ${relativePath}`);
      }

      // Extract claims from content
      this.extractClaimsFromContent(content, relativePath);

    } catch (error) {
      if (this.options.verbose) {
        console.log(`   ⚠️  Error parsing ${filePath}: ${error.message}`);
      }
    }
  }

  extractClaimsFromContent(content, filePath) {
    const lines = content.split('\n');
    
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];
      const lineNumber = lineIndex + 1;
      
      // Extract different types of claims
      this.extractProductionReadyClaims(line, filePath, lineNumber);
      this.extractTestPassRateClaims(line, filePath, lineNumber);
      this.extractErrorCountClaims(line, filePath, lineNumber);
      this.extractCompletionClaims(line, filePath, lineNumber);
      this.extractStatusClaims(line, filePath, lineNumber);
      this.extractPercentageClaims(line, filePath, lineNumber);
      this.extractBuildStatusClaims(line, filePath, lineNumber);
      this.extractCICDStatusClaims(line, filePath, lineNumber);
    }
  }

  extractProductionReadyClaims(line, filePath, lineNumber) {
    for (const pattern of this.patterns.productionReady) {
      const matches = line.match(pattern);
      if (matches) {
        this.claims.productionReady.push({
          file: filePath,
          line: lineNumber,
          content: line.trim(),
          claim: matches[0],
          type: 'production-ready',
          value: true
        });
      }
    }
  }

  extractTestPassRateClaims(line, filePath, lineNumber) {
    for (const pattern of this.patterns.testPassRate) {
      const matches = line.match(pattern);
      if (matches) {
        let passRate = null;
        let total = null;
        let passed = null;

        // Handle different match formats
        if (matches[1] && matches[2]) {
          // Format: "554/555 tests passing" or "554 of 555 tests passing"
          passed = parseInt(matches[1]);
          total = parseInt(matches[2]);
          passRate = passed / total;
        } else if (matches[1]) {
          // Format: "99.8% tests passing"
          passRate = parseFloat(matches[1]) / 100;
        }

        if (passRate !== null) {
          this.claims.testPassRate.push({
            file: filePath,
            line: lineNumber,
            content: line.trim(),
            claim: matches[0],
            type: 'test-pass-rate',
            value: passRate,
            passed: passed,
            total: total
          });
        }
      }
    }
  }

  extractErrorCountClaims(line, filePath, lineNumber) {
    for (const pattern of this.patterns.errorCount) {
      const matches = line.match(pattern);
      if (matches) {
        let errorCount = null;
        
        if (matches[1]) {
          errorCount = parseInt(matches[1]);
        } else if (matches[0].includes('no errors') || matches[0].includes('error-free')) {
          errorCount = 0;
        }

        if (errorCount !== null) {
          this.claims.errorCount.push({
            file: filePath,
            line: lineNumber,
            content: line.trim(),
            claim: matches[0],
            type: 'error-count',
            value: errorCount
          });
        }
      }
    }
  }

  extractCompletionClaims(line, filePath, lineNumber) {
    for (const pattern of this.patterns.completed) {
      const matches = line.match(pattern);
      if (matches) {
        this.claims.completed.push({
          file: filePath,
          line: lineNumber,
          content: line.trim(),
          claim: matches[0],
          type: 'completion',
          value: true
        });
      }
    }
  }

  extractStatusClaims(line, filePath, lineNumber) {
    for (const pattern of this.patterns.status) {
      const matches = line.match(pattern);
      if (matches && matches[1]) {
        this.claims.status.push({
          file: filePath,
          line: lineNumber,
          content: line.trim(),
          claim: matches[0],
          type: 'status',
          value: matches[1].toLowerCase()
        });
      }
    }
  }

  extractPercentageClaims(line, filePath, lineNumber) {
    for (const pattern of this.patterns.percentages) {
      const matches = line.matchAll(pattern);
      for (const match of matches) {
        const percentage = parseFloat(match[1]);
        if (!isNaN(percentage)) {
          this.claims.percentages.push({
            file: filePath,
            line: lineNumber,
            content: line.trim(),
            claim: match[0],
            type: 'percentage',
            value: percentage / 100
          });
        }
      }
    }
  }

  extractBuildStatusClaims(line, filePath, lineNumber) {
    for (const pattern of this.patterns.buildStatus) {
      const matches = line.match(pattern);
      if (matches) {
        let buildStatus = null;
        const claim = matches[0].toLowerCase();
        
        if (claim.includes('success') || claim.includes('pass')) {
          buildStatus = 'success';
        } else if (claim.includes('fail') || claim.includes('error')) {
          buildStatus = 'failed';
        }

        if (buildStatus) {
          this.claims.buildStatus.push({
            file: filePath,
            line: lineNumber,
            content: line.trim(),
            claim: matches[0],
            type: 'build-status',
            value: buildStatus
          });
        }
      }
    }
  }

  extractCICDStatusClaims(line, filePath, lineNumber) {
    for (const pattern of this.patterns.cicdStatus) {
      const matches = line.match(pattern);
      if (matches) {
        let cicdStatus = null;
        const claim = matches[0].toLowerCase();
        
        if (claim.includes('pass')) {
          cicdStatus = 'passing';
        } else if (claim.includes('fail')) {
          cicdStatus = 'failing';
        }

        if (cicdStatus) {
          this.claims.cicdStatus.push({
            file: filePath,
            line: lineNumber,
            content: line.trim(),
            claim: matches[0],
            type: 'cicd-status',
            value: cicdStatus
          });
        }
      }
    }
  }

  getTotalClaimsCount() {
    return this.claims.productionReady.length +
           this.claims.testPassRate.length +
           this.claims.errorCount.length +
           this.claims.completed.length +
           this.claims.status.length +
           this.claims.percentages.length +
           this.claims.buildStatus.length +
           this.claims.cicdStatus.length;
  }

  generateReport() {
    console.log('📊 Documentation Claims Analysis Report');
    console.log('=====================================\n');
    
    console.log('📄 Scan Summary:');
    console.log(`   Files scanned: ${this.claims.metadata.filesScanned}`);
    console.log(`   Total claims found: ${this.claims.metadata.claimsFound}`);
    console.log(`   Last scan: ${this.claims.metadata.lastScan}`);
    
    if (this.claims.productionReady.length > 0) {
      console.log('\n🚀 Production Ready Claims:');
      this.claims.productionReady.forEach((claim, index) => {
        console.log(`   ${index + 1}. ${claim.file}:${claim.line} - "${claim.claim}"`);
      });
    }

    if (this.claims.testPassRate.length > 0) {
      console.log('\n🧪 Test Pass Rate Claims:');
      this.claims.testPassRate.forEach((claim, index) => {
        const percentage = (claim.value * 100).toFixed(1);
        console.log(`   ${index + 1}. ${claim.file}:${claim.line} - ${percentage}% (${claim.claim})`);
      });
    }

    if (this.claims.errorCount.length > 0) {
      console.log('\n❌ Error Count Claims:');
      this.claims.errorCount.forEach((claim, index) => {
        console.log(`   ${index + 1}. ${claim.file}:${claim.line} - ${claim.value} errors (${claim.claim})`);
      });
    }

    if (this.claims.completed.length > 0) {
      console.log('\n✅ Completion Claims:');
      this.claims.completed.forEach((claim, index) => {
        console.log(`   ${index + 1}. ${claim.file}:${claim.line} - "${claim.claim}"`);
      });
    }

    if (this.claims.status.length > 0) {
      console.log('\n📊 Status Claims:');
      this.claims.status.forEach((claim, index) => {
        console.log(`   ${index + 1}. ${claim.file}:${claim.line} - ${claim.value} (${claim.claim})`);
      });
    }

    if (this.claims.buildStatus.length > 0) {
      console.log('\n🔨 Build Status Claims:');
      this.claims.buildStatus.forEach((claim, index) => {
        console.log(`   ${index + 1}. ${claim.file}:${claim.line} - ${claim.value} (${claim.claim})`);
      });
    }

    if (this.claims.cicdStatus.length > 0) {
      console.log('\n🚀 CI/CD Status Claims:');
      this.claims.cicdStatus.forEach((claim, index) => {
        console.log(`   ${index + 1}. ${claim.file}:${claim.line} - ${claim.value} (${claim.claim})`);
      });
    }

    if (this.options.verbose && this.claims.percentages.length > 0) {
      console.log('\n📊 All Percentage Claims:');
      this.claims.percentages.forEach((claim, index) => {
        const percentage = (claim.value * 100).toFixed(1);
        console.log(`   ${index + 1}. ${claim.file}:${claim.line} - ${percentage}% (${claim.claim})`);
      });
    }

    console.log('');
  }

  // Export claims for use by other modules
  getClaims() {
    return this.claims;
  }
}

// CLI handling
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {
    targetPath: args.find(arg => arg.startsWith('--file='))?.split('=')[1] || process.cwd(),
    jsonOutput: args.includes('--json'),
    verbose: args.includes('--verbose')
  };
  
  const parser = new DocumentationClaimParser(options);
  parser.run().then(exitCode => {
    process.exit(exitCode);
  }).catch(error => {
    console.error('Fatal error:', error);
    process.exit(2);
  });
}

module.exports = DocumentationClaimParser;