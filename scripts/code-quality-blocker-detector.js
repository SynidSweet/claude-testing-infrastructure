#!/usr/bin/env node

/**
 * Code Quality Blocker Detector
 * 
 * Systematically identifies code quality issues preventing deployment including:
 * - Linting errors with categorization
 * - TypeScript compilation issues
 * - Fix prioritization for code quality
 * 
 * Part of Truth Validation System Implementation Plan - Phase 3
 * TASK-BLOCKER-003: Code Quality Blocker Detector
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class CodeQualityBlockerDetector {
  constructor() {
    this.projectRoot = process.cwd();
    this.blockers = [];
    this.codeQualityStatus = {
      linting: null,
      typescript: null,
      formatting: null,
      complexity: null
    };
    this.qualityThresholds = {
      maxLintErrors: 0,        // No linting errors for production
      maxLintWarnings: 10,     // Maximum acceptable warnings
      maxTypeScriptErrors: 0,  // No TypeScript errors for production
      maxFileComplexity: 20    // Maximum cyclomatic complexity
    };
  }

  async analyzeCodeQualityBlockers() {
    console.log('🔍 Analyzing code quality for blockers...\n');
    
    try {
      // Run comprehensive code quality analysis
      await this.analyzeLintingIssues();
      await this.analyzeTypeScriptIssues();
      await this.analyzeFormattingIssues();
      await this.analyzeCodeComplexity();
      await this.prioritizeBlockers();
      
      // Generate comprehensive report
      this.generateBlockerReport();
      
      return this.blockers;
    } catch (error) {
      console.error('❌ Error analyzing code quality blockers:', error.message);
      this.blockers.push({
        type: 'ANALYSIS_ERROR',
        severity: 'CRITICAL',
        message: `Failed to analyze code quality: ${error.message}`,
        action: 'Fix code quality analysis environment or configuration'
      });
      return this.blockers;
    }
  }

  async analyzeLintingIssues() {
    console.log('📋 Analyzing linting issues...');
    
    try {
      // Check if ESLint is configured
      const eslintConfig = this.findESLintConfiguration();
      if (!eslintConfig) {
        this.blockers.push({
          type: 'NO_ESLINT_CONFIG',
          severity: 'MEDIUM',
          message: 'No ESLint configuration found',
          action: 'Set up ESLint configuration for code quality enforcement'
        });
        return;
      }

      // Run ESLint analysis
      await this.runESLintAnalysis();
      
    } catch (error) {
      console.log('⚠️  Error analyzing linting issues:', error.message);
      this.blockers.push({
        type: 'LINTING_ANALYSIS_ERROR',
        severity: 'HIGH',
        message: `Failed to analyze linting: ${error.message}`,
        action: 'Fix ESLint configuration or installation'
      });
    }
  }

  findESLintConfiguration() {
    const configFiles = [
      '.eslintrc.json',
      '.eslintrc.js',
      '.eslintrc.yaml',
      '.eslintrc.yml',
      'eslint.config.js',
      'package.json'
    ];
    
    for (const configFile of configFiles) {
      const configPath = path.join(this.projectRoot, configFile);
      if (fs.existsSync(configPath)) {
        try {
          if (configFile === 'package.json') {
            const packageJson = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            return packageJson.eslintConfig ? { file: configFile, config: packageJson.eslintConfig } : null;
          }
          return { file: configFile, exists: true };
        } catch (error) {
          console.log(`⚠️  Could not parse ${configFile}:`, error.message);
        }
      }
    }
    
    return null;
  }

  async runESLintAnalysis() {
    console.log('🔍 Running ESLint analysis...');
    
    try {
      // Check if npm run lint script exists
      const packageJsonPath = path.join(this.projectRoot, 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      
      let lintCommand = 'npm run lint';
      if (!packageJson.scripts || !packageJson.scripts.lint) {
        // Try direct ESLint command
        lintCommand = 'npx eslint . --ext .js,.ts,.jsx,.tsx';
      }

      // Run linting with JSON output
      const lintOutput = execSync(`${lintCommand} --format json`, { 
        encoding: 'utf8',
        timeout: 60000, // 1 minute timeout
        maxBuffer: 1024 * 1024 * 10 // 10MB buffer
      });
      
      const lintResults = JSON.parse(lintOutput);
      await this.analyzeLintResults(lintResults);
      
    } catch (error) {
      // ESLint exits with non-zero code when errors found
      try {
        // Try to parse error output as JSON
        const errorOutput = error.stdout || error.stderr || '';
        if (errorOutput.includes('[') && errorOutput.includes(']')) {
          const lintResults = JSON.parse(errorOutput);
          await this.analyzeLintResults(lintResults);
        } else {
          // Parse plain text output
          await this.parsePlainTextLintOutput(errorOutput);
        }
      } catch (parseError) {
        console.log('⚠️  Could not parse ESLint output:', parseError.message);
        this.blockers.push({
          type: 'LINTING_PARSE_ERROR',
          severity: 'HIGH',
          message: `Failed to parse ESLint output: ${parseError.message}`,
          action: 'Check ESLint configuration and output format'
        });
      }
    }
  }

  async analyzeLintResults(lintResults) {
    let totalErrors = 0;
    let totalWarnings = 0;
    const errorsByRule = {};
    const fileErrors = [];

    for (const result of lintResults) {
      if (result.errorCount > 0 || result.warningCount > 0) {
        totalErrors += result.errorCount;
        totalWarnings += result.warningCount;
        
        fileErrors.push({
          file: path.relative(this.projectRoot, result.filePath),
          errors: result.errorCount,
          warnings: result.warningCount
        });

        // Categorize errors by rule
        for (const message of result.messages) {
          const rule = message.ruleId || 'unknown';
          if (!errorsByRule[rule]) {
            errorsByRule[rule] = { errors: 0, warnings: 0 };
          }
          
          if (message.severity === 2) {
            errorsByRule[rule].errors++;
          } else if (message.severity === 1) {
            errorsByRule[rule].warnings++;
          }
        }
      }
    }

    this.codeQualityStatus.linting = {
      totalErrors,
      totalWarnings,
      errorsByRule,
      fileErrors
    };

    // Check against thresholds
    if (totalErrors > this.qualityThresholds.maxLintErrors) {
      this.blockers.push({
        type: 'LINTING_ERRORS',
        severity: 'CRITICAL',
        errorCount: totalErrors,
        threshold: this.qualityThresholds.maxLintErrors,
        message: `${totalErrors} linting errors exceed production threshold (${this.qualityThresholds.maxLintErrors})`,
        action: 'Fix all linting errors before deployment',
        details: {
          topRules: this.getTopErrorRules(errorsByRule),
          affectedFiles: fileErrors.slice(0, 10) // Top 10 files with errors
        }
      });
    }

    if (totalWarnings > this.qualityThresholds.maxLintWarnings) {
      this.blockers.push({
        type: 'EXCESSIVE_LINTING_WARNINGS',
        severity: 'MEDIUM',
        warningCount: totalWarnings,
        threshold: this.qualityThresholds.maxLintWarnings,
        message: `${totalWarnings} linting warnings exceed threshold (${this.qualityThresholds.maxLintWarnings})`,
        action: 'Reduce linting warnings to improve code quality',
        details: {
          topRules: this.getTopWarningRules(errorsByRule)
        }
      });
    }

    console.log(`📊 Linting analysis: ${totalErrors} errors, ${totalWarnings} warnings`);
  }

  async parsePlainTextLintOutput(output) {
    const lines = output.split('\n');
    let totalErrors = 0;
    let totalWarnings = 0;

    for (const line of lines) {
      if (line.includes('error')) {
        totalErrors++;
      } else if (line.includes('warning')) {
        totalWarnings++;
      }
    }

    // Parse summary line if present
    const summaryMatch = output.match(/(\d+)\s+problems?\s*\((\d+)\s+errors?,\s*(\d+)\s+warnings?\)/);
    if (summaryMatch) {
      totalErrors = parseInt(summaryMatch[2]);
      totalWarnings = parseInt(summaryMatch[3]);
    }

    this.codeQualityStatus.linting = {
      totalErrors,
      totalWarnings,
      parsed: 'plain-text'
    };

    if (totalErrors > this.qualityThresholds.maxLintErrors) {
      this.blockers.push({
        type: 'LINTING_ERRORS',
        severity: 'CRITICAL',
        errorCount: totalErrors,
        threshold: this.qualityThresholds.maxLintErrors,
        message: `${totalErrors} linting errors exceed production threshold`,
        action: 'Fix all linting errors before deployment'
      });
    }
  }

  getTopErrorRules(errorsByRule) {
    return Object.entries(errorsByRule)
      .filter(([_, counts]) => counts.errors > 0)
      .sort((a, b) => b[1].errors - a[1].errors)
      .slice(0, 5)
      .map(([rule, counts]) => ({ rule, errors: counts.errors }));
  }

  getTopWarningRules(errorsByRule) {
    return Object.entries(errorsByRule)
      .filter(([_, counts]) => counts.warnings > 0)
      .sort((a, b) => b[1].warnings - a[1].warnings)
      .slice(0, 5)
      .map(([rule, counts]) => ({ rule, warnings: counts.warnings }));
  }

  async analyzeTypeScriptIssues() {
    console.log('📘 Analyzing TypeScript issues...');
    
    try {
      // Check if TypeScript is configured
      const tsConfig = this.findTypeScriptConfiguration();
      if (!tsConfig) {
        console.log('⚠️  No TypeScript configuration found, skipping TS analysis');
        return;
      }

      // Run TypeScript compilation check
      await this.runTypeScriptCheck();
      
    } catch (error) {
      console.log('⚠️  Error analyzing TypeScript issues:', error.message);
      this.blockers.push({
        type: 'TYPESCRIPT_ANALYSIS_ERROR',
        severity: 'HIGH',
        message: `Failed to analyze TypeScript: ${error.message}`,
        action: 'Fix TypeScript configuration or installation'
      });
    }
  }

  findTypeScriptConfiguration() {
    const configFiles = [
      'tsconfig.json',
      'tsconfig.build.json',
      'jsconfig.json'
    ];
    
    for (const configFile of configFiles) {
      const configPath = path.join(this.projectRoot, configFile);
      if (fs.existsSync(configPath)) {
        return { file: configFile, exists: true };
      }
    }
    
    return null;
  }

  async runTypeScriptCheck() {
    console.log('🔍 Running TypeScript compilation check...');
    
    try {
      // Try npm run build first (likely includes TypeScript compilation)
      let buildCommand = 'npm run build';
      
      // Check if build script exists
      const packageJsonPath = path.join(this.projectRoot, 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      
      if (!packageJson.scripts || !packageJson.scripts.build) {
        // Try direct TypeScript compiler
        buildCommand = 'npx tsc --noEmit';
      }

      const buildOutput = execSync(buildCommand, { 
        encoding: 'utf8',
        timeout: 120000, // 2 minutes timeout
        maxBuffer: 1024 * 1024 * 10 // 10MB buffer
      });
      
      this.codeQualityStatus.typescript = {
        compilationSuccessful: true,
        errors: 0
      };
      
      console.log('✅ TypeScript compilation successful');
      
    } catch (error) {
      // TypeScript compilation failed
      const errorOutput = error.stdout || error.stderr || error.message;
      const tsErrors = this.parseTypeScriptErrors(errorOutput);
      
      this.codeQualityStatus.typescript = {
        compilationSuccessful: false,
        errors: tsErrors.length,
        errorDetails: tsErrors
      };

      if (tsErrors.length > this.qualityThresholds.maxTypeScriptErrors) {
        this.blockers.push({
          type: 'TYPESCRIPT_COMPILATION_ERRORS',
          severity: 'CRITICAL',
          errorCount: tsErrors.length,
          threshold: this.qualityThresholds.maxTypeScriptErrors,
          message: `${tsErrors.length} TypeScript compilation errors prevent deployment`,
          action: 'Fix all TypeScript compilation errors',
          details: {
            errors: tsErrors.slice(0, 10) // Top 10 errors
          }
        });
      }
    }
  }

  parseTypeScriptErrors(output) {
    const errors = [];
    const lines = output.split('\n');
    
    for (const line of lines) {
      // TypeScript error format: filename(line,column): error TS####: message
      const errorMatch = line.match(/^(.+?)\((\d+),(\d+)\):\s*error\s+TS(\d+):\s*(.+)$/);
      if (errorMatch) {
        errors.push({
          file: path.relative(this.projectRoot, errorMatch[1]),
          line: parseInt(errorMatch[2]),
          column: parseInt(errorMatch[3]),
          code: errorMatch[4],
          message: errorMatch[5]
        });
      }
    }
    
    return errors;
  }

  async analyzeFormattingIssues() {
    console.log('✨ Analyzing formatting issues...');
    
    try {
      // Check if Prettier is configured
      const prettierConfig = this.findPrettierConfiguration();
      if (!prettierConfig) {
        this.blockers.push({
          type: 'NO_PRETTIER_CONFIG',
          severity: 'LOW',
          message: 'No Prettier configuration found',
          action: 'Consider adding Prettier for consistent code formatting'
        });
        return;
      }

      // Run Prettier check
      await this.runPrettierCheck();
      
    } catch (error) {
      console.log('⚠️  Error analyzing formatting issues:', error.message);
      this.blockers.push({
        type: 'FORMATTING_ANALYSIS_ERROR',
        severity: 'LOW',
        message: `Failed to analyze formatting: ${error.message}`,
        action: 'Check Prettier configuration'
      });
    }
  }

  findPrettierConfiguration() {
    const configFiles = [
      '.prettierrc',
      '.prettierrc.json',
      '.prettierrc.js',
      '.prettierrc.yaml',
      '.prettierrc.yml',
      'prettier.config.js',
      'package.json'
    ];
    
    for (const configFile of configFiles) {
      const configPath = path.join(this.projectRoot, configFile);
      if (fs.existsSync(configPath)) {
        if (configFile === 'package.json') {
          try {
            const packageJson = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            return packageJson.prettier ? { file: configFile, config: packageJson.prettier } : null;
          } catch (error) {
            continue;
          }
        }
        return { file: configFile, exists: true };
      }
    }
    
    return null;
  }

  async runPrettierCheck() {
    try {
      // Check if files need formatting
      const prettierOutput = execSync('npx prettier --check .', { 
        encoding: 'utf8',
        timeout: 60000,
        maxBuffer: 1024 * 1024 * 10
      });
      
      this.codeQualityStatus.formatting = {
        needsFormatting: false,
        formattedFiles: 0
      };
      
      console.log('✅ All files properly formatted');
      
    } catch (error) {
      // Prettier exits with non-zero code when files need formatting
      const errorOutput = error.stdout || error.stderr || '';
      const unformattedFiles = this.parsePrettierOutput(errorOutput);
      
      this.codeQualityStatus.formatting = {
        needsFormatting: true,
        unformattedFiles: unformattedFiles.length,
        fileList: unformattedFiles
      };

      if (unformattedFiles.length > 0) {
        this.blockers.push({
          type: 'FORMATTING_ISSUES',
          severity: 'LOW',
          fileCount: unformattedFiles.length,
          message: `${unformattedFiles.length} files need formatting`,
          action: 'Run prettier --write to fix formatting issues',
          details: {
            files: unformattedFiles.slice(0, 10) // First 10 files
          }
        });
      }
    }
  }

  parsePrettierOutput(output) {
    const lines = output.split('\n');
    const unformattedFiles = [];
    
    for (const line of lines) {
      if (line.trim() && !line.includes('Code style issues') && !line.includes('prettier --write')) {
        unformattedFiles.push(line.trim());
      }
    }
    
    return unformattedFiles;
  }

  async analyzeCodeComplexity() {
    console.log('🔍 Analyzing code complexity...');
    
    try {
      // Simple complexity analysis based on file size and structure
      const complexityIssues = await this.analyzeFileComplexity();
      
      this.codeQualityStatus.complexity = {
        complexFiles: complexityIssues.length,
        issues: complexityIssues
      };

      if (complexityIssues.length > 0) {
        this.blockers.push({
          type: 'HIGH_COMPLEXITY_FILES',
          severity: 'MEDIUM',
          fileCount: complexityIssues.length,
          message: `${complexityIssues.length} files have high complexity`,
          action: 'Consider refactoring complex files for better maintainability',
          details: {
            files: complexityIssues.slice(0, 5) // Top 5 complex files
          }
        });
      }
      
    } catch (error) {
      console.log('⚠️  Error analyzing code complexity:', error.message);
    }
  }

  async analyzeFileComplexity() {
    const complexFiles = [];
    const sourceFiles = this.findSourceFiles();
    
    for (const file of sourceFiles) {
      try {
        const content = fs.readFileSync(file, 'utf8');
        const complexity = this.calculateFileComplexity(content);
        
        if (complexity > this.qualityThresholds.maxFileComplexity) {
          complexFiles.push({
            file: path.relative(this.projectRoot, file),
            complexity: complexity,
            lines: content.split('\n').length
          });
        }
      } catch (error) {
        console.log(`⚠️  Could not analyze ${file}:`, error.message);
      }
    }
    
    return complexFiles.sort((a, b) => b.complexity - a.complexity);
  }

  findSourceFiles() {
    const sourceFiles = [];
    const sourceDirs = ['src', 'lib', 'app'];
    
    for (const sourceDir of sourceDirs) {
      const sourceDirPath = path.join(this.projectRoot, sourceDir);
      if (fs.existsSync(sourceDirPath)) {
        this.findSourceFilesRecursive(sourceDirPath, sourceFiles);
      }
    }
    
    return sourceFiles;
  }

  findSourceFilesRecursive(dir, sourceFiles) {
    const entries = fs.readdirSync(dir);
    
    for (const entry of entries) {
      const entryPath = path.join(dir, entry);
      const stat = fs.statSync(entryPath);
      
      if (stat.isDirectory()) {
        this.findSourceFilesRecursive(entryPath, sourceFiles);
      } else if (this.isSourceFile(entry)) {
        sourceFiles.push(entryPath);
      }
    }
  }

  isSourceFile(filename) {
    const sourcePatterns = [
      /\.[jt]sx?$/,
      /\.vue$/,
      /\.py$/
    ];
    
    return sourcePatterns.some(pattern => pattern.test(filename));
  }

  calculateFileComplexity(content) {
    // Simple complexity calculation based on control structures
    const complexityPatterns = [
      /\bif\s*\(/g,
      /\belse\s*\{/g,
      /\bwhile\s*\(/g,
      /\bfor\s*\(/g,
      /\bswitch\s*\(/g,
      /\bcase\s+/g,
      /\btry\s*\{/g,
      /\bcatch\s*\(/g,
      /\?\s*.*\s*:/g, // Ternary operators
      /&&|\|\|/g      // Logical operators
    ];
    
    let complexity = 1; // Base complexity
    
    for (const pattern of complexityPatterns) {
      const matches = content.match(pattern);
      if (matches) {
        complexity += matches.length;
      }
    }
    
    return complexity;
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
        'TYPESCRIPT_COMPILATION_ERRORS',
        'LINTING_ERRORS',
        'EXCESSIVE_LINTING_WARNINGS',
        'HIGH_COMPLEXITY_FILES',
        'FORMATTING_ISSUES',
        'NO_ESLINT_CONFIG',
        'NO_PRETTIER_CONFIG'
      ];
      const typeA = typeOrder.indexOf(a.type);
      const typeB = typeOrder.indexOf(b.type);
      
      return typeA - typeB;
    });
    
    console.log(`📋 Found ${this.blockers.length} blockers, prioritized by severity`);
  }

  generateBlockerReport() {
    console.log('\n🔍 CODE QUALITY BLOCKER ANALYSIS REPORT');
    console.log('=======================================\n');
    
    if (this.blockers.length === 0) {
      console.log('✅ No code quality blockers detected! Code is ready for deployment.\n');
      return;
    }
    
    console.log(`Found ${this.blockers.length} code quality blockers preventing deployment:\n`);
    
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
    
    // Code quality status summary
    console.log('🏗️  CODE QUALITY STATUS SUMMARY:');
    console.log(`Linting: ${this.codeQualityStatus.linting ? 
      `${this.codeQualityStatus.linting.totalErrors} errors, ${this.codeQualityStatus.linting.totalWarnings} warnings` : 
      'Not analyzed'}`);
    console.log(`TypeScript: ${this.codeQualityStatus.typescript ? 
      (this.codeQualityStatus.typescript.compilationSuccessful ? '✅ Compiles' : `❌ ${this.codeQualityStatus.typescript.errors} errors`) : 
      'Not analyzed'}`);
    console.log(`Formatting: ${this.codeQualityStatus.formatting ? 
      (this.codeQualityStatus.formatting.needsFormatting ? `❌ ${this.codeQualityStatus.formatting.unformattedFiles} files need formatting` : '✅ Formatted') : 
      'Not analyzed'}`);
    console.log(`Complexity: ${this.codeQualityStatus.complexity ? 
      (this.codeQualityStatus.complexity.complexFiles > 0 ? `⚠️  ${this.codeQualityStatus.complexity.complexFiles} complex files` : '✅ Good') : 
      'Not analyzed'}`);
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
    console.log('2. Run code quality checks after each fix');
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
        codeQualityStatus: this.codeQualityStatus
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
      console.log(`📄 Code quality blocker report exported to: ${outputPath}`);
    }
    
    return report;
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const outputPath = args.includes('--output') ? args[args.indexOf('--output') + 1] : null;
  const jsonOutput = args.includes('--json');
  
  const detector = new CodeQualityBlockerDetector();
  
  try {
    const blockers = await detector.analyzeCodeQualityBlockers();
    
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

module.exports = CodeQualityBlockerDetector;