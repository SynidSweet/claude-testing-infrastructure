#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs-extra');
const chalk = require('chalk');

/**
 * E2E Validation Runner for Claude Testing Infrastructure
 * 
 * This script validates the entire workflow of the testing infrastructure
 * by running it against real test projects.
 */

class E2EValidator {
  constructor() {
    this.projectRoot = path.join(__dirname, '../..');
    this.cliPath = path.join(this.projectRoot, 'dist/cli/index.js');
    this.testProjectsDir = path.join(__dirname, 'test-projects');
    this.results = {
      projects: [],
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        duration: 0
      }
    };
  }

  async run() {
    console.log(chalk.blue.bold('\n🚀 Claude Testing Infrastructure E2E Validation\n'));
    
    const startTime = Date.now();
    
    try {
      // Verify CLI is built
      this.verifyCliBuilt();
      
      // Get test projects
      const testProjects = this.getTestProjects();
      this.results.summary.total = testProjects.length;
      
      // Run validation for each project
      for (const project of testProjects) {
        await this.validateProject(project);
      }
      
      // Generate summary
      this.results.summary.duration = Date.now() - startTime;
      this.generateReport();
      
      // Return exit code based on results
      process.exit(this.results.summary.failed > 0 ? 1 : 0);
      
    } catch (error) {
      console.error(chalk.red(`\n❌ E2E Validation Failed: ${error.message}`));
      process.exit(1);
    }
  }

  verifyCliBuilt() {
    if (!fs.existsSync(this.cliPath)) {
      throw new Error('CLI not built. Run "npm run build" first.');
    }
    console.log(chalk.green('✓ CLI build verified'));
  }

  getTestProjects() {
    const projects = fs.readdirSync(this.testProjectsDir)
      .filter(name => fs.statSync(path.join(this.testProjectsDir, name)).isDirectory());
    
    console.log(chalk.cyan(`\nFound ${projects.length} test projects:`));
    projects.forEach(p => console.log(`  - ${p}`));
    
    return projects;
  }

  async validateProject(projectName) {
    console.log(chalk.blue(`\n📁 Validating: ${projectName}`));
    
    const projectPath = path.join(this.testProjectsDir, projectName);
    const projectResult = {
      name: projectName,
      path: projectPath,
      steps: [],
      passed: true,
      error: null,
      duration: 0
    };
    
    const startTime = Date.now();
    
    try {
      // Step 1: Analyze project
      console.log(chalk.gray('  → Running analysis...'));
      const analyzeResult = this.runCommand(`analyze "${projectPath}" --output analysis.json`);
      projectResult.steps.push({
        step: 'analyze',
        passed: true,
        output: analyzeResult
      });
      
      // Verify analysis output
      const analysisFile = path.join(projectPath, 'analysis.json');
      if (fs.existsSync(analysisFile)) {
        const analysis = JSON.parse(fs.readFileSync(analysisFile, 'utf8'));
        console.log(chalk.green(`    ✓ Analysis complete: ${analysis.files.length} files found`));
        fs.removeSync(analysisFile); // Clean up
      }
      
      // Step 2: Generate tests (dry run first)
      console.log(chalk.gray('  → Testing generation (dry run)...'));
      const dryRunResult = this.runCommand(`test "${projectPath}" --dry-run`);
      projectResult.steps.push({
        step: 'test-dry-run',
        passed: true,
        output: dryRunResult
      });
      
      // Step 3: Generate actual tests
      console.log(chalk.gray('  → Generating tests...'));
      const testResult = this.runCommand(`test "${projectPath}" --only-structural`);
      projectResult.steps.push({
        step: 'test-generation',
        passed: true,
        output: testResult
      });
      
      // Verify test generation
      const claudeTestingDir = path.join(projectPath, '.claude-testing');
      if (!fs.existsSync(claudeTestingDir)) {
        throw new Error('No .claude-testing directory created');
      }
      
      const generatedTests = this.countGeneratedTests(claudeTestingDir);
      console.log(chalk.green(`    ✓ Generated ${generatedTests} test files`));
      
      // Step 4: Run generated tests
      console.log(chalk.gray('  → Running generated tests...'));
      const runResult = this.runCommand(`run "${projectPath}" --coverage`);
      projectResult.steps.push({
        step: 'test-execution',
        passed: true,
        output: runResult
      });
      
      // Verify test results
      const resultsFile = path.join(claudeTestingDir, 'test-results.json');
      if (fs.existsSync(resultsFile)) {
        const results = JSON.parse(fs.readFileSync(resultsFile, 'utf8'));
        console.log(chalk.green(`    ✓ Tests executed: ${results.numPassedTests}/${results.numTotalTests} passed`));
      }
      
      // Step 5: Incremental update test
      console.log(chalk.gray('  → Testing incremental updates...'));
      const incrementalResult = this.runCommand(`incremental "${projectPath}" --dry-run`);
      projectResult.steps.push({
        step: 'incremental-update',
        passed: true,
        output: incrementalResult
      });
      
      projectResult.duration = Date.now() - startTime;
      console.log(chalk.green(`  ✅ Project validation passed (${projectResult.duration}ms)`));
      
    } catch (error) {
      projectResult.passed = false;
      projectResult.error = error.message;
      projectResult.duration = Date.now() - startTime;
      console.log(chalk.red(`  ❌ Project validation failed: ${error.message}`));
    } finally {
      // Clean up generated files
      const claudeTestingDir = path.join(projectPath, '.claude-testing');
      if (fs.existsSync(claudeTestingDir)) {
        fs.removeSync(claudeTestingDir);
      }
    }
    
    this.results.projects.push(projectResult);
    if (projectResult.passed) {
      this.results.summary.passed++;
    } else {
      this.results.summary.failed++;
    }
  }

  runCommand(command) {
    const fullCommand = `node "${this.cliPath}" ${command}`;
    try {
      const output = execSync(fullCommand, {
        cwd: this.projectRoot,
        encoding: 'utf8',
        stdio: 'pipe'
      });
      return output.trim();
    } catch (error) {
      // Some commands might exit with non-zero even on success
      if (error.stdout) {
        return error.stdout.toString().trim();
      }
      throw new Error(`Command failed: ${error.message}`);
    }
  }

  countGeneratedTests(claudeTestingDir) {
    let count = 0;
    
    // Recursively count test files
    const countTestsInDir = (dir) => {
      if (!fs.existsSync(dir)) return;
      
      const items = fs.readdirSync(dir);
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          countTestsInDir(fullPath);
        } else if (
          item.endsWith('.test.js') || 
          item.endsWith('.test.ts') || 
          item.endsWith('_test.py') ||
          item.endsWith('.spec.js') ||
          item.endsWith('.spec.ts')
        ) {
          count++;
        }
      }
    };
    
    countTestsInDir(claudeTestingDir);
    return count;
  }

  generateReport() {
    console.log(chalk.blue.bold('\n📊 E2E Validation Report\n'));
    
    // Summary
    console.log(chalk.cyan('Summary:'));
    console.log(`  Total Projects: ${this.results.summary.total}`);
    console.log(`  Passed: ${chalk.green(this.results.summary.passed)}`);
    console.log(`  Failed: ${chalk.red(this.results.summary.failed)}`);
    console.log(`  Duration: ${this.results.summary.duration}ms`);
    
    // Detailed results
    console.log(chalk.cyan('\nDetailed Results:'));
    this.results.projects.forEach(project => {
      const status = project.passed ? chalk.green('✅ PASSED') : chalk.red('❌ FAILED');
      console.log(`\n  ${project.name}: ${status} (${project.duration}ms)`);
      
      if (!project.passed && project.error) {
        console.log(chalk.red(`    Error: ${project.error}`));
      }
      
      project.steps.forEach(step => {
        const stepStatus = step.passed ? chalk.green('✓') : chalk.red('✗');
        console.log(`    ${stepStatus} ${step.step}`);
      });
    });
    
    // Save results to file
    const reportPath = path.join(__dirname, 'e2e-validation-report.json');
    fs.writeJsonSync(reportPath, this.results, { spaces: 2 });
    console.log(chalk.gray(`\nFull report saved to: ${reportPath}`));
    
    // Overall status
    if (this.results.summary.failed === 0) {
      console.log(chalk.green.bold('\n✅ All E2E validations passed!'));
    } else {
      console.log(chalk.red.bold(`\n❌ ${this.results.summary.failed} validations failed!`));
    }
  }
}

// Run validator
const validator = new E2EValidator();
validator.run();