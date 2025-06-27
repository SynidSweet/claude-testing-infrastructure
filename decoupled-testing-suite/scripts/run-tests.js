#!/usr/bin/env node

/**
 * Run Tests Script
 * 
 * Executes tests for a project using the decoupled testing configuration.
 * Supports multiple test frameworks and provides comprehensive reporting.
 */

const path = require('path');
const fs = require('fs').promises;
const { spawn, execSync } = require('child_process');
const chalk = require('chalk');
const { Command } = require('commander');
const { ConfigManager } = require('../core/config/config-manager');

const program = new Command();

program
  .name('run-tests')
  .description('Run tests using decoupled testing configuration')
  .option('-c, --config-dir <path>', 'Test configuration directory', './test-config')
  .option('-w, --watch', 'Run tests in watch mode')
  .option('--coverage', 'Generate coverage report')
  .option('--ci', 'Run in CI mode (no watch, exit on completion)')
  .option('-t, --testNamePattern <pattern>', 'Run only tests matching pattern')
  .option('-f, --testPathPattern <pattern>', 'Run only test files matching pattern')
  .option('--type <type>', 'Run specific test type (unit, integration, e2e, etc.)')
  .option('--reporter <reporter>', 'Test reporter (default, verbose, json)')
  .option('--bail', 'Stop on first test failure')
  .option('--verbose', 'Verbose output')
  .option('--debug', 'Debug mode')
  .parse();

const options = program.opts();

async function main() {
  try {
    console.log(chalk.blue('🧪 Running decoupled tests...'));
    
    const configDir = path.resolve(options.configDir);
    
    // Load configuration
    const configManager = new ConfigManager(configDir);
    const config = await configManager.loadConfig();
    
    if (!config) {
      throw new Error(`No configuration found in ${configDir}. Run 'npm run init' first.`);
    }
    
    if (options.verbose) {
      console.log(chalk.gray(`Configuration loaded from: ${configDir}`));
      console.log(chalk.gray(`Project path: ${config.projectPath}`));
      console.log(chalk.gray(`Test framework: ${config.testing.framework}`));
    }
    
    // Validate project path exists
    await validateProjectPath(config.projectPath);
    
    // Prepare test environment
    await prepareTestEnvironment(config, options);
    
    // Run tests based on framework
    const result = await runTestsForFramework(config, options, configDir);
    
    // Process results
    await processTestResults(result, config, options);
    
    if (result.success) {
      console.log(chalk.green('✅ All tests passed!'));
      process.exit(0);
    } else {
      console.log(chalk.red('❌ Some tests failed.'));
      process.exit(1);
    }
    
  } catch (error) {
    console.error(chalk.red('❌ Test execution failed:'));
    console.error(chalk.red(error.message));
    
    if (options.verbose || options.debug) {
      console.error(chalk.gray(error.stack));
    }
    
    process.exit(1);
  }
}

async function validateProjectPath(projectPath) {
  try {
    await fs.access(projectPath);
  } catch (error) {
    throw new Error(`Project path does not exist: ${projectPath}`);
  }
}

async function prepareTestEnvironment(config, options) {
  // Set environment variables
  process.env.NODE_ENV = 'test';
  process.env.TEST_CONFIG_DIR = path.resolve(options.configDir);
  
  // Change to project directory
  process.chdir(config.projectPath);
  
  if (options.verbose) {
    console.log(chalk.yellow('🔧 Environment prepared'));
    console.log(chalk.gray(`Working directory: ${process.cwd()}`));
    console.log(chalk.gray(`NODE_ENV: ${process.env.NODE_ENV}`));
  }
}

async function runTestsForFramework(config, options, configDir) {
  const framework = config.testing.framework;
  
  switch (framework) {
    case 'jest':
      return runJestTests(config, options, configDir);
    case 'vitest':
      return runVitestTests(config, options, configDir);
    case 'pytest':
      return runPytestTests(config, options, configDir);
    case 'mocha':
      return runMochaTests(config, options, configDir);
    default:
      throw new Error(`Unsupported test framework: ${framework}`);
  }
}

async function runJestTests(config, options, configDir) {
  const args = ['jest'];
  
  // Add configuration file
  const jestConfigPath = path.join(configDir, 'jest.config.js');
  if (await fileExists(jestConfigPath)) {
    args.push('--config', jestConfigPath);
  }
  
  // Add options
  if (options.watch && !options.ci) {
    args.push('--watch');
  }
  
  if (options.coverage) {
    args.push('--coverage');
  }
  
  if (options.ci) {
    args.push('--ci', '--watchAll=false');
  }
  
  if (options.testNamePattern) {
    args.push('--testNamePattern', options.testNamePattern);
  }
  
  if (options.testPathPattern) {
    args.push('--testPathPattern', options.testPathPattern);
  }
  
  if (options.bail) {
    args.push('--bail');
  }
  
  if (options.verbose) {
    args.push('--verbose');
  }
  
  // Add test type filter
  if (options.type) {
    const testDir = path.join(configDir, 'tests', options.type);
    args.push(testDir);
  } else {
    args.push(path.join(configDir, 'tests'));
  }
  
  if (options.debug) {
    console.log(chalk.gray(`Running: npx ${args.join(' ')}`));
  }
  
  return runCommand('npx', args, { 
    stdio: options.verbose ? 'inherit' : 'pipe',
    cwd: config.projectPath 
  });
}

async function runVitestTests(config, options, configDir) {
  const args = ['vitest'];
  
  // Add configuration file
  const vitestConfigPath = path.join(configDir, 'vitest.config.js');
  if (await fileExists(vitestConfigPath)) {
    args.push('--config', vitestConfigPath);
  }
  
  // Add options
  if (options.watch && !options.ci) {
    args.push('--watch');
  } else {
    args.push('--run');
  }
  
  if (options.coverage) {
    args.push('--coverage');
  }
  
  if (options.testNamePattern) {
    args.push('--grep', options.testNamePattern);
  }
  
  if (options.bail) {
    args.push('--bail', '1');
  }
  
  if (options.reporter) {
    args.push('--reporter', options.reporter);
  }
  
  // Add test type filter
  if (options.type) {
    const testDir = path.join(configDir, 'tests', options.type);
    args.push(testDir);
  } else {
    args.push(path.join(configDir, 'tests'));
  }
  
  if (options.debug) {
    console.log(chalk.gray(`Running: npx ${args.join(' ')}`));
  }
  
  return runCommand('npx', args, { 
    stdio: options.verbose ? 'inherit' : 'pipe',
    cwd: config.projectPath 
  });
}

async function runPytestTests(config, options, configDir) {
  const args = ['python', '-m', 'pytest'];
  
  // Add configuration
  args.push('--rootdir', configDir);
  
  // Add pytest.ini if it exists
  const pytestConfigPath = path.join(configDir, 'pytest.ini');
  if (await fileExists(pytestConfigPath)) {
    args.push('-c', pytestConfigPath);
  }
  
  // Add options
  if (options.coverage) {
    args.push('--cov', config.projectPath);
    args.push('--cov-report', 'html');
    args.push('--cov-report', 'term-missing');
  }
  
  if (options.testNamePattern) {
    args.push('-k', options.testNamePattern);
  }
  
  if (options.bail) {
    args.push('-x');
  }
  
  if (options.verbose) {
    args.push('-v');
  }
  
  // Add test type filter
  if (options.type) {
    const testDir = path.join(configDir, 'tests', options.type);
    args.push(testDir);
  } else {
    args.push(path.join(configDir, 'tests'));
  }
  
  if (options.debug) {
    console.log(chalk.gray(`Running: ${args.join(' ')}`));
  }
  
  return runCommand(args[0], args.slice(1), { 
    stdio: options.verbose ? 'inherit' : 'pipe',
    cwd: config.projectPath 
  });
}

async function runMochaTests(config, options, configDir) {
  const args = ['mocha'];
  
  // Add test files pattern
  if (options.type) {
    args.push(path.join(configDir, 'tests', options.type, '**/*.test.js'));
  } else {
    args.push(path.join(configDir, 'tests/**/*.test.js'));
  }
  
  // Add options
  if (options.testNamePattern) {
    args.push('--grep', options.testNamePattern);
  }
  
  if (options.bail) {
    args.push('--bail');
  }
  
  if (options.reporter) {
    args.push('--reporter', options.reporter);
  }
  
  if (options.debug) {
    console.log(chalk.gray(`Running: npx ${args.join(' ')}`));
  }
  
  return runCommand('npx', args, { 
    stdio: options.verbose ? 'inherit' : 'pipe',
    cwd: config.projectPath 
  });
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      ...options,
      shell: true
    });
    
    let stdout = '';
    let stderr = '';
    
    if (child.stdout) {
      child.stdout.on('data', (data) => {
        stdout += data.toString();
        if (options.stdio !== 'inherit') {
          process.stdout.write(data);
        }
      });
    }
    
    if (child.stderr) {
      child.stderr.on('data', (data) => {
        stderr += data.toString();
        if (options.stdio !== 'inherit') {
          process.stderr.write(data);
        }
      });
    }
    
    child.on('close', (code) => {
      resolve({
        success: code === 0,
        exitCode: code,
        stdout,
        stderr
      });
    });
    
    child.on('error', (error) => {
      reject(error);
    });
  });
}

async function processTestResults(result, config, options) {
  if (options.verbose) {
    console.log(chalk.blue('\n📊 Test Results Summary'));
    console.log('─'.repeat(40));
    console.log(`Status: ${result.success ? chalk.green('PASSED') : chalk.red('FAILED')}`);
    console.log(`Exit Code: ${result.exitCode}`);
  }
  
  // Save test results if configured
  if (config.testing.saveResults) {
    const resultsDir = path.join(options.configDir, 'results');
    await fs.mkdir(resultsDir, { recursive: true });
    
    const resultsFile = path.join(resultsDir, `test-results-${Date.now()}.json`);
    const resultsData = {
      timestamp: new Date().toISOString(),
      success: result.success,
      exitCode: result.exitCode,
      framework: config.testing.framework,
      options: options,
      stdout: result.stdout,
      stderr: result.stderr
    };
    
    await fs.writeFile(resultsFile, JSON.stringify(resultsData, null, 2));
    
    if (options.verbose) {
      console.log(`Results saved to: ${resultsFile}`);
    }
  }
  
  // Generate coverage report link
  if (options.coverage) {
    const coverageDir = path.join(process.cwd(), 'coverage');
    const htmlReport = path.join(coverageDir, 'index.html');
    
    if (await fileExists(htmlReport)) {
      console.log(chalk.blue(`📈 Coverage report: file://${htmlReport}`));
    }
  }
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

// Handle watch mode gracefully
if (options.watch) {
  process.on('SIGINT', () => {
    console.log(chalk.yellow('\n⏹️  Watch mode interrupted.'));
    process.exit(0);
  });
}

if (require.main === module) {
  main().catch(error => {
    console.error(chalk.red('❌ Unexpected error:'), error.message);
    process.exit(1);
  });
}

module.exports = { main };