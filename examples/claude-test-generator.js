#!/usr/bin/env node

/**
 * claude-test-generator.js - Programmatic test generation using Claude Code CLI
 * 
 * This demonstrates how to integrate Claude Code into Node.js applications
 * for automated test generation.
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');
const glob = require('glob');

const execAsync = promisify(exec);

class ClaudeTestGenerator {
  constructor(options = {}) {
    this.options = {
      framework: 'jest', // or 'mocha', 'pytest', etc.
      outputFormat: 'json',
      verbose: false,
      maxBuffer: 10 * 1024 * 1024, // 10MB
      ...options
    };
  }

  /**
   * Generate tests for a single file
   * @param {string} filePath - Path to the source file
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} Test generation result
   */
  async generateTestsForFile(filePath, options = {}) {
    try {
      // Read the source file
      const code = await fs.readFile(filePath, 'utf-8');
      const fileName = path.basename(filePath);
      const fileExt = path.extname(filePath);
      
      // Determine the testing framework based on file type
      const framework = this.getTestingFramework(fileExt);
      
      // Build the prompt
      const prompt = this.buildPrompt(code, fileName, framework, options);
      
      // Execute Claude command
      const result = await this.executeClaudeCommand(prompt);
      
      // Parse the result
      const parsedResult = this.parseResult(result);
      
      // Save the test file
      const testPath = await this.saveTestFile(filePath, parsedResult.testCode);
      
      return {
        success: true,
        sourcePath: filePath,
        testPath,
        testCode: parsedResult.testCode,
        sessionId: parsedResult.sessionId,
        cost: parsedResult.cost,
        duration: parsedResult.duration
      };
    } catch (error) {
      return {
        success: false,
        sourcePath: filePath,
        error: error.message
      };
    }
  }

  /**
   * Generate tests for multiple files
   * @param {string[]} filePaths - Array of file paths
   * @returns {Promise<Object[]>} Array of results
   */
  async generateTestsForFiles(filePaths) {
    const results = [];
    
    for (const filePath of filePaths) {
      console.log(`Processing: ${filePath}`);
      const result = await this.generateTestsForFile(filePath);
      results.push(result);
      
      // Add a small delay to avoid rate limiting
      await this.delay(1000);
    }
    
    return results;
  }

  /**
   * Generate tests for all files in a directory
   * @param {string} dirPath - Directory path
   * @param {string} pattern - Glob pattern for files
   * @returns {Promise<Object>} Summary of generation results
   */
  async generateTestsForDirectory(dirPath, pattern = '**/*.{js,ts,jsx,tsx,py}') {
    const files = glob.sync(path.join(dirPath, pattern), {
      ignore: [
        '**/node_modules/**',
        '**/*.test.*',
        '**/*.spec.*',
        '**/test_*',
        '**/*_test.py',
        '**/__tests__/**',
        '**/tests/**'
      ]
    });

    console.log(`Found ${files.length} files to process`);
    
    const results = await this.generateTestsForFiles(files);
    
    // Generate summary
    const summary = {
      total: results.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      totalCost: results
        .filter(r => r.success && r.cost)
        .reduce((sum, r) => sum + r.cost, 0),
      results
    };

    return summary;
  }

  /**
   * Build the prompt for Claude
   */
  buildPrompt(code, fileName, framework, options) {
    const requirements = options.requirements || [
      `Use ${framework} testing framework`,
      'Include unit tests for all exported functions/classes',
      'Add edge case tests',
      'Include error handling tests',
      'Use descriptive test names',
      'Add setup/teardown if needed',
      'Include mocking where appropriate',
      'Add comments explaining complex test logic'
    ];

    return `Generate comprehensive tests for the following ${path.extname(fileName)} file named "${fileName}".

Requirements:
${requirements.map(r => `- ${r}`).join('\n')}

Code to test:
\`\`\`
${code}
\`\`\`

Generate only the test code, no explanations. The test code should be complete and ready to run.`;
  }

  /**
   * Execute Claude command
   */
  async executeClaudeCommand(prompt) {
    const escapedPrompt = prompt.replace(/"/g, '\\"').replace(/\$/g, '\\$');
    const command = `claude -p "${escapedPrompt}" --output-format ${this.options.outputFormat}`;
    
    if (this.options.verbose) {
      console.log('Executing Claude command...');
    }

    const { stdout, stderr } = await execAsync(command, {
      maxBuffer: this.options.maxBuffer
    });

    if (stderr && this.options.verbose) {
      console.warn('Claude stderr:', stderr);
    }

    return stdout;
  }

  /**
   * Parse Claude's response
   */
  parseResult(result) {
    if (this.options.outputFormat === 'json') {
      try {
        const json = JSON.parse(result);
        return {
          testCode: json.result,
          sessionId: json.session_id,
          cost: json.total_cost_usd,
          duration: json.duration_ms
        };
      } catch (error) {
        // Fallback to plain text if JSON parsing fails
        return { testCode: result };
      }
    }
    
    return { testCode: result };
  }

  /**
   * Save the generated test file
   */
  async saveTestFile(sourcePath, testCode) {
    const dir = path.dirname(sourcePath);
    const ext = path.extname(sourcePath);
    const base = path.basename(sourcePath, ext);
    
    // Determine test file name based on convention
    let testFileName;
    if (ext === '.py') {
      testFileName = `test_${base}${ext}`;
    } else {
      testFileName = `${base}.test${ext}`;
    }
    
    const testPath = path.join(dir, testFileName);
    
    // Create __tests__ directory if specified
    if (this.options.useTestDirectory) {
      const testDir = path.join(dir, '__tests__');
      await fs.mkdir(testDir, { recursive: true });
      const finalPath = path.join(testDir, testFileName);
      await fs.writeFile(finalPath, testCode);
      return finalPath;
    }
    
    await fs.writeFile(testPath, testCode);
    return testPath;
  }

  /**
   * Determine testing framework based on file extension
   */
  getTestingFramework(ext) {
    const frameworks = {
      '.py': 'pytest',
      '.js': 'jest',
      '.jsx': 'jest',
      '.ts': 'jest',
      '.tsx': 'jest'
    };
    
    return frameworks[ext] || this.options.framework;
  }

  /**
   * Utility function for delay
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Generate a test coverage report
   */
  async generateCoverageReport(dirPath) {
    const files = glob.sync(path.join(dirPath, '**/*.{js,ts,jsx,tsx}'), {
      ignore: ['**/node_modules/**', '**/*.test.*', '**/*.spec.*']
    });

    const report = {
      totalFiles: files.length,
      filesWithTests: 0,
      filesWithoutTests: 0,
      coverage: 0,
      missingTests: []
    };

    for (const file of files) {
      const testFile = file.replace(/\.(js|ts|jsx|tsx)$/, '.test.$1');
      const specFile = file.replace(/\.(js|ts|jsx|tsx)$/, '.spec.$1');
      
      if (await this.fileExists(testFile) || await this.fileExists(specFile)) {
        report.filesWithTests++;
      } else {
        report.filesWithoutTests++;
        report.missingTests.push(file);
      }
    }

    report.coverage = (report.filesWithTests / report.totalFiles) * 100;
    
    return report;
  }

  /**
   * Check if file exists
   */
  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log(`
Usage: claude-test-generator.js [options] <path>

Options:
  --framework <name>    Testing framework (jest, mocha, pytest)
  --test-dir           Put tests in __tests__ directory
  --verbose            Enable verbose output
  --coverage           Generate coverage report only

Examples:
  node claude-test-generator.js src/
  node claude-test-generator.js --framework mocha src/utils.js
  node claude-test-generator.js --coverage src/
    `);
    process.exit(1);
  }

  // Parse arguments
  const options = {};
  let targetPath = '.';
  
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--framework':
        options.framework = args[++i];
        break;
      case '--test-dir':
        options.useTestDirectory = true;
        break;
      case '--verbose':
        options.verbose = true;
        break;
      case '--coverage':
        options.coverageOnly = true;
        break;
      default:
        targetPath = args[i];
    }
  }

  // Run generator
  const generator = new ClaudeTestGenerator(options);
  
  (async () => {
    try {
      if (options.coverageOnly) {
        const report = await generator.generateCoverageReport(targetPath);
        console.log('\nTest Coverage Report:');
        console.log(`Total files: ${report.totalFiles}`);
        console.log(`Files with tests: ${report.filesWithTests}`);
        console.log(`Files without tests: ${report.filesWithoutTests}`);
        console.log(`Coverage: ${report.coverage.toFixed(2)}%`);
        
        if (report.missingTests.length > 0) {
          console.log('\nFiles missing tests:');
          report.missingTests.forEach(file => console.log(`  - ${file}`));
        }
      } else {
        const stats = await fs.stat(targetPath);
        
        if (stats.isDirectory()) {
          const summary = await generator.generateTestsForDirectory(targetPath);
          
          console.log('\n=== Test Generation Summary ===');
          console.log(`Total files processed: ${summary.total}`);
          console.log(`Successful: ${summary.successful}`);
          console.log(`Failed: ${summary.failed}`);
          console.log(`Total cost: $${summary.totalCost.toFixed(4)}`);
          
          if (summary.failed > 0) {
            console.log('\nFailed files:');
            summary.results
              .filter(r => !r.success)
              .forEach(r => console.log(`  - ${r.sourcePath}: ${r.error}`));
          }
        } else {
          const result = await generator.generateTestsForFile(targetPath);
          
          if (result.success) {
            console.log(`\n✓ Test generated successfully`);
            console.log(`  Source: ${result.sourcePath}`);
            console.log(`  Test: ${result.testPath}`);
            if (result.cost) {
              console.log(`  Cost: $${result.cost.toFixed(4)}`);
            }
          } else {
            console.error(`\n✗ Failed to generate test`);
            console.error(`  Error: ${result.error}`);
            process.exit(1);
          }
        }
      }
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  })();
}

module.exports = ClaudeTestGenerator;