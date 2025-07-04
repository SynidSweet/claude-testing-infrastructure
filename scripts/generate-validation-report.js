#!/usr/bin/env node

/**
 * Validation Report Generator
 * 
 * Generates comprehensive validation reports for the Claude Testing Infrastructure
 * Includes detailed metrics, quality gates, and deployment readiness assessment
 * 
 * Exit codes:
 * 0 - Report generated successfully
 * 1 - Report generation failed
 * 2 - Script error
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs/promises');
const path = require('path');

const execAsync = promisify(exec);

class ValidationReportGenerator {
  constructor(options = {}) {
    this.options = {
      outputFormat: options.format || 'markdown',
      outputFile: options.output || null,
      includeDetails: options.detailed || false,
      timeout: options.timeout || 120000, // 2 minutes default
      skipAITests: options.skipAITests || process.env.CI || process.env.SKIP_AI_TESTS,
      ...options
    };
    
    this.metrics = {
      timestamp: new Date().toISOString(),
      buildStatus: null,
      cliStatus: null,
      testResults: null,
      coreCommands: null,
      documentation: null,
      aiIntegration: null,
      qualityScore: 0,
      recommendations: []
    };
  }

  async generateReport() {
    console.log('📊 Generating comprehensive validation report...\n');

    try {
      await this.collectMetrics();
      const report = await this.formatReport();
      
      if (this.options.outputFile) {
        await this.saveReport(report);
        console.log(`✅ Report saved to: ${this.options.outputFile}`);
      } else {
        console.log(report);
      }
      
      return 0;
    } catch (error) {
      console.error('❌ Report generation failed:', error.message);
      return 1;
    }
  }

  async collectMetrics() {
    console.log('🔍 Collecting validation metrics...');
    
    // Run metrics collection in parallel where possible
    await Promise.allSettled([
      this.checkBuildStatus(),
      this.checkCLIStatus(),
      this.checkDocumentation(),
      this.checkCoreCommands()
    ]);
    
    // Test suite check (potentially long-running)
    await this.checkTestSuite();
    
    // AI integration check (optional)
    await this.checkAIIntegration();
    
    this.calculateQualityScore();
    this.generateRecommendations();
  }

  async checkBuildStatus() {
    try {
      const distPath = path.join(process.cwd(), 'dist');
      const cliPath = path.join(distPath, 'cli', 'index.js');
      
      await fs.access(distPath);
      await fs.access(cliPath);
      
      // Check build freshness
      const stats = await fs.stat(cliPath);
      const buildAge = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60); // hours
      
      this.metrics.buildStatus = {
        success: true,
        artifactsPresent: true,
        buildAge: buildAge,
        fresh: buildAge < 24 // Fresh if built within 24 hours
      };
    } catch (error) {
      this.metrics.buildStatus = {
        success: false,
        error: error.message,
        artifactsPresent: false
      };
    }
  }

  async checkCLIStatus() {
    try {
      const { stdout: version } = await execAsync('node dist/cli/index.js --version', { 
        timeout: 10000 
      });
      const { stdout: help } = await execAsync('node dist/cli/index.js --help', { 
        timeout: 10000 
      });
      
      this.metrics.cliStatus = {
        responsive: true,
        version: version.trim(),
        helpAvailable: help.includes('analyze'),
        commandsDetected: this.extractCommandsFromHelp(help)
      };
    } catch (error) {
      this.metrics.cliStatus = {
        responsive: false,
        error: error.message
      };
    }
  }

  async checkTestSuite() {
    try {
      console.log('  🧪 Running test suite (this may take a moment)...');
      
      const testCommand = this.options.skipAITests ? 
        'SKIP_AI_TESTS=1 npm test' : 
        'npm test';
        
      const { stdout, stderr } = await execAsync(testCommand, { 
        timeout: this.options.timeout,
        maxBuffer: 1024 * 1024 * 10 // 10MB buffer
      });
      
      const results = this.parseTestResults(stdout);
      
      this.metrics.testResults = {
        ...results,
        stderr: stderr ? stderr.substring(0, 500) : null, // Truncate stderr
        duration: results.duration || 'unknown',
        environment: this.options.skipAITests ? 'CI/Structural' : 'Full'
      };
    } catch (error) {
      // Handle timeout gracefully
      if (error.message.includes('timeout')) {
        this.metrics.testResults = {
          timedOut: true,
          timeout: this.options.timeout,
          error: 'Test suite execution exceeded timeout limit',
          recommendation: 'Consider running with SKIP_AI_TESTS=1 for faster execution'
        };
      } else {
        this.metrics.testResults = {
          failed: true,
          error: error.message.substring(0, 500) // Truncate error
        };
      }
    }
  }

  async checkCoreCommands() {
    const commands = [
      { name: 'analyze', cmd: 'analyze --help' },
      { name: 'test', cmd: 'test --help' },
      { name: 'run', cmd: 'run --help' },
      { name: 'incremental', cmd: 'incremental --help' },
      { name: 'watch', cmd: 'watch --help' }
    ];

    const results = [];
    
    for (const command of commands) {
      try {
        await execAsync(`node dist/cli/index.js ${command.cmd}`, { timeout: 5000 });
        results.push({ name: command.name, working: true });
      } catch (error) {
        results.push({ 
          name: command.name, 
          working: false, 
          error: error.message.substring(0, 100) 
        });
      }
    }
    
    this.metrics.coreCommands = {
      total: commands.length,
      working: results.filter(r => r.working).length,
      results: results
    };
  }

  async checkDocumentation() {
    const requiredDocs = [
      { path: 'README.md', description: 'Main project documentation' },
      { path: 'AI_AGENT_GUIDE.md', description: 'AI agent entry point' },
      { path: 'PROJECT_CONTEXT.md', description: 'Complete project context' },
      { path: 'docs/development/workflow.md', description: 'Development workflow' },
      { path: 'docs/architecture/overview.md', description: 'Architecture overview' }
    ];

    const results = [];
    
    for (const doc of requiredDocs) {
      try {
        const filePath = path.join(process.cwd(), doc.path);
        const stats = await fs.stat(filePath);
        const content = await fs.readFile(filePath, 'utf-8');
        
        results.push({
          path: doc.path,
          description: doc.description,
          exists: true,
          size: stats.size,
          lastModified: stats.mtime,
          wordCount: content.split(/\s+/).length,
          upToDate: this.isDocumentationUpToDate(stats.mtime)
        });
      } catch (error) {
        results.push({
          path: doc.path,
          description: doc.description,
          exists: false,
          error: error.message
        });
      }
    }
    
    this.metrics.documentation = {
      total: requiredDocs.length,
      existing: results.filter(r => r.exists).length,
      upToDate: results.filter(r => r.exists && r.upToDate).length,
      results: results
    };
  }

  async checkAIIntegration() {
    try {
      // Check Claude CLI availability
      await execAsync('claude --version', { timeout: 5000 });
      
      this.metrics.aiIntegration = {
        claudeCLIAvailable: true,
        status: 'ready',
        note: 'AI-powered test generation available'
      };
    } catch (error) {
      this.metrics.aiIntegration = {
        claudeCLIAvailable: false,
        status: 'unavailable',
        note: 'Structural test generation available (AI features disabled)',
        impact: 'Limited - infrastructure works without AI features'
      };
    }
  }

  calculateQualityScore() {
    let score = 0;
    let maxScore = 0;
    
    // Build status (20 points)
    maxScore += 20;
    if (this.metrics.buildStatus?.success) {
      score += 20;
      if (this.metrics.buildStatus.fresh) score += 5; // Bonus for fresh build
    }
    
    // CLI responsiveness (15 points)
    maxScore += 15;
    if (this.metrics.cliStatus?.responsive) {
      score += 15;
    }
    
    // Test suite (30 points)
    maxScore += 30;
    if (this.metrics.testResults && !this.metrics.testResults.failed && !this.metrics.testResults.timedOut) {
      score += Math.floor(this.metrics.testResults.passRate * 30);
    }
    
    // Core commands (20 points)
    maxScore += 20;
    if (this.metrics.coreCommands) {
      score += Math.floor((this.metrics.coreCommands.working / this.metrics.coreCommands.total) * 20);
    }
    
    // Documentation (10 points)
    maxScore += 10;
    if (this.metrics.documentation) {
      score += Math.floor((this.metrics.documentation.existing / this.metrics.documentation.total) * 10);
    }
    
    // AI integration (5 points bonus, not required)
    if (this.metrics.aiIntegration?.claudeCLIAvailable) {
      score += 5;
    }
    
    this.metrics.qualityScore = Math.min(score / maxScore, 1.0);
  }

  generateRecommendations() {
    const recommendations = [];
    
    if (!this.metrics.buildStatus?.success) {
      recommendations.push({
        priority: 'high',
        category: 'build',
        issue: 'Build artifacts missing or invalid',
        action: 'Run npm run build to create distribution files'
      });
    }
    
    if (!this.metrics.cliStatus?.responsive) {
      recommendations.push({
        priority: 'high',
        category: 'cli',
        issue: 'CLI not responding correctly',
        action: 'Check build status and verify CLI entry point'
      });
    }
    
    if (this.metrics.testResults?.timedOut) {
      recommendations.push({
        priority: 'medium',
        category: 'testing',
        issue: 'Test suite execution timeout',
        action: 'Consider running with SKIP_AI_TESTS=1 for faster CI execution'
      });
    }
    
    if (this.metrics.testResults && this.metrics.testResults.passRate < 0.95) {
      recommendations.push({
        priority: 'high',
        category: 'testing',
        issue: `Test pass rate ${(this.metrics.testResults.passRate * 100).toFixed(1)}% below production threshold`,
        action: 'Investigate and fix failing tests before deployment'
      });
    }
    
    if (this.metrics.coreCommands && this.metrics.coreCommands.working < this.metrics.coreCommands.total) {
      recommendations.push({
        priority: 'medium',
        category: 'commands',
        issue: 'Some core commands not responding',
        action: 'Check CLI implementation and command registrations'
      });
    }
    
    if (this.metrics.documentation && this.metrics.documentation.existing < this.metrics.documentation.total) {
      recommendations.push({
        priority: 'low',
        category: 'documentation',
        issue: 'Missing required documentation',
        action: 'Create missing documentation files'
      });
    }
    
    this.metrics.recommendations = recommendations;
  }

  async formatReport() {
    if (this.options.outputFormat === 'json') {
      return JSON.stringify(this.metrics, null, 2);
    }
    
    // Default to markdown format
    return this.generateMarkdownReport();
  }

  generateMarkdownReport() {
    let report = '';
    
    report += '# Claude Testing Infrastructure - Validation Report\n\n';
    report += `**Generated**: ${this.metrics.timestamp}\n`;
    report += `**Environment**: ${this.options.skipAITests ? 'CI/Structural' : 'Full'}\n`;
    report += `**Overall Quality Score**: ${(this.metrics.qualityScore * 100).toFixed(1)}%\n\n`;
    
    // Production readiness assessment
    const productionReady = this.metrics.qualityScore >= 0.90;
    report += `**Production Ready**: ${productionReady ? '✅ YES' : '❌ NO'}\n\n`;
    
    // Detailed metrics
    report += '## 📊 Detailed Metrics\n\n';
    
    // Build Status
    report += '### 📦 Build Status\n';
    if (this.metrics.buildStatus?.success) {
      report += `- ✅ Build artifacts present\n`;
      report += `- 📅 Build age: ${this.metrics.buildStatus.buildAge?.toFixed(1)} hours\n`;
      report += `- 🆕 Fresh build: ${this.metrics.buildStatus.fresh ? 'Yes' : 'No'}\n`;
    } else {
      report += `- ❌ Build failed: ${this.metrics.buildStatus?.error}\n`;
    }
    report += '\n';
    
    // CLI Status
    report += '### 🖥️ CLI Status\n';
    if (this.metrics.cliStatus?.responsive) {
      report += `- ✅ CLI responsive\n`;
      report += `- 🏷️ Version: ${this.metrics.cliStatus.version}\n`;
      report += `- 📖 Help available: ${this.metrics.cliStatus.helpAvailable ? 'Yes' : 'No'}\n`;
      report += `- 🔧 Commands detected: ${this.metrics.cliStatus.commandsDetected?.length || 0}\n`;
    } else {
      report += `- ❌ CLI not responsive: ${this.metrics.cliStatus?.error}\n`;
    }
    report += '\n';
    
    // Test Results
    report += '### 🧪 Test Suite\n';
    if (this.metrics.testResults?.timedOut) {
      report += `- ⏰ Test execution timed out after ${this.metrics.testResults.timeout / 1000}s\n`;
      report += `- 💡 Recommendation: ${this.metrics.testResults.recommendation}\n`;
    } else if (this.metrics.testResults?.failed) {
      report += `- ❌ Test execution failed: ${this.metrics.testResults.error}\n`;
    } else if (this.metrics.testResults) {
      const rate = (this.metrics.testResults.passRate * 100).toFixed(1);
      report += `- 📈 Pass rate: ${rate}% (${this.metrics.testResults.passed}/${this.metrics.testResults.total})\n`;
      report += `- 🏃 Duration: ${this.metrics.testResults.duration}\n`;
      report += `- 🌍 Environment: ${this.metrics.testResults.environment}\n`;
      
      if (this.metrics.testResults.passRate >= 0.95) {
        report += `- ✅ Meets production threshold (≥95%)\n`;
      } else {
        report += `- ⚠️ Below production threshold (≥95%)\n`;
      }
    }
    report += '\n';
    
    // Core Commands
    report += '### ⚙️ Core Commands\n';
    if (this.metrics.coreCommands) {
      report += `- 📊 Working: ${this.metrics.coreCommands.working}/${this.metrics.coreCommands.total}\n`;
      this.metrics.coreCommands.results.forEach(cmd => {
        const status = cmd.working ? '✅' : '❌';
        report += `  - ${status} ${cmd.name}\n`;
      });
    }
    report += '\n';
    
    // Documentation
    report += '### 📚 Documentation\n';
    if (this.metrics.documentation) {
      report += `- 📊 Present: ${this.metrics.documentation.existing}/${this.metrics.documentation.total}\n`;
      report += `- 🔄 Up to date: ${this.metrics.documentation.upToDate}/${this.metrics.documentation.existing}\n`;
      
      this.metrics.documentation.results.forEach(doc => {
        const status = doc.exists ? '✅' : '❌';
        report += `  - ${status} ${doc.path}\n`;
      });
    }
    report += '\n';
    
    // AI Integration
    report += '### 🤖 AI Integration\n';
    if (this.metrics.aiIntegration) {
      const status = this.metrics.aiIntegration.claudeCLIAvailable ? '✅' : '⚠️';
      report += `- ${status} Claude CLI: ${this.metrics.aiIntegration.status}\n`;
      report += `- 📝 Note: ${this.metrics.aiIntegration.note}\n`;
      if (this.metrics.aiIntegration.impact) {
        report += `- 📊 Impact: ${this.metrics.aiIntegration.impact}\n`;
      }
    }
    report += '\n';
    
    // Recommendations
    if (this.metrics.recommendations.length > 0) {
      report += '## 🎯 Recommendations\n\n';
      
      const priorityOrder = ['high', 'medium', 'low'];
      priorityOrder.forEach(priority => {
        const items = this.metrics.recommendations.filter(r => r.priority === priority);
        if (items.length > 0) {
          const emoji = priority === 'high' ? '🔴' : priority === 'medium' ? '🟡' : '🟢';
          report += `### ${emoji} ${priority.charAt(0).toUpperCase() + priority.slice(1)} Priority\n\n`;
          
          items.forEach((rec, index) => {
            report += `${index + 1}. **${rec.category}**: ${rec.issue}\n`;
            report += `   - Action: ${rec.action}\n\n`;
          });
        }
      });
    }
    
    // Summary
    report += '## 📋 Summary\n\n';
    
    if (productionReady) {
      report += '🎉 **Infrastructure is production ready!**\n\n';
      report += '- Core functionality validated\n';
      report += '- Quality gates passed\n';
      report += '- Ready for deployment\n';
    } else {
      report += '⚠️ **Infrastructure needs improvement**\n\n';
      report += '- Address high priority recommendations\n';
      report += '- Re-run validation after fixes\n';
      report += '- Target quality score ≥90% for production\n';
    }
    
    report += '\n---\n';
    report += '*Generated by Claude Testing Infrastructure Validation System*\n';
    
    return report;
  }

  // Helper methods
  extractCommandsFromHelp(helpText) {
    const commandPattern = /^\s+(\w+)\s+/gm;
    const commands = [];
    let match;
    
    while ((match = commandPattern.exec(helpText)) !== null) {
      commands.push(match[1]);
    }
    
    return commands;
  }

  parseTestResults(stdout) {
    // Enhanced test result parsing
    const patterns = {
      jestSummary: /Tests:\s+(?:(\d+) failed,\s*)?(\d+) passed(?:,\s*(\d+) skipped)?,\s*(\d+) total/,
      duration: /Time:\s+([\d.]+\s*m?s)/,
      suites: /Test Suites:\s+(?:(\d+) failed,\s*)?(\d+) passed,\s*(\d+) total/
    };
    
    const summaryMatch = stdout.match(patterns.jestSummary);
    const durationMatch = stdout.match(patterns.duration);
    const suitesMatch = stdout.match(patterns.suites);
    
    let result = {
      passed: 0,
      failed: 0,
      skipped: 0,
      total: 0,
      passRate: 0,
      duration: durationMatch ? durationMatch[1] : 'unknown'
    };
    
    if (summaryMatch) {
      result.failed = summaryMatch[1] ? parseInt(summaryMatch[1]) : 0;
      result.passed = parseInt(summaryMatch[2]);
      result.skipped = summaryMatch[3] ? parseInt(summaryMatch[3]) : 0;
      result.total = parseInt(summaryMatch[4]);
      result.passRate = result.total > 0 ? result.passed / result.total : 0;
    }
    
    if (suitesMatch) {
      result.suitesFailed = suitesMatch[1] ? parseInt(suitesMatch[1]) : 0;
      result.suitesPassed = parseInt(suitesMatch[2]);
      result.suitesTotal = parseInt(suitesMatch[3]);
    }
    
    return result;
  }

  isDocumentationUpToDate(lastModified) {
    const daysSinceModified = (Date.now() - lastModified.getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceModified < 30; // Consider up-to-date if modified within 30 days
  }

  async saveReport(report) {
    await fs.writeFile(this.options.outputFile, report, 'utf-8');
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {};
  
  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--format':
        options.format = args[++i];
        break;
      case '--output':
        options.output = args[++i];
        break;
      case '--detailed':
        options.detailed = true;
        break;
      case '--timeout':
        options.timeout = parseInt(args[++i]) * 1000;
        break;
      case '--skip-ai-tests':
        options.skipAITests = true;
        break;
      case '--help':
        console.log(`
Usage: node generate-validation-report.js [options]

Options:
  --format <format>     Output format (markdown, json) [default: markdown]
  --output <file>       Output file path [default: stdout]
  --detailed            Include detailed metrics
  --timeout <seconds>   Test execution timeout [default: 120]
  --skip-ai-tests       Skip AI integration tests
  --help                Show this help message
        `);
        process.exit(0);
    }
  }
  
  const generator = new ValidationReportGenerator(options);
  generator.generateReport().then(exitCode => {
    process.exit(exitCode);
  }).catch(error => {
    console.error('Fatal error:', error);
    process.exit(2);
  });
}

module.exports = ValidationReportGenerator;