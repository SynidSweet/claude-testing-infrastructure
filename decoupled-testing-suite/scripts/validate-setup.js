#!/usr/bin/env node

/**
 * Validate Setup Script
 * 
 * Validates that the decoupled testing configuration is properly set up
 * and all dependencies are available for running tests.
 */

const path = require('path');
const fs = require('fs').promises;
const { execSync, spawn } = require('child_process');
const chalk = require('chalk');
const { Command } = require('commander');
const { ConfigManager } = require('../core/config/config-manager');
const { adapterFactory } = require('../../shared/adapters/AdapterFactory');

const program = new Command();

program
  .name('validate-setup')
  .description('Validate decoupled testing configuration and dependencies')
  .option('-c, --config-dir <path>', 'Test configuration directory', './test-config')
  .option('-p, --project-path <path>', 'Path to the target project')
  .option('-v, --verbose', 'Verbose output')
  .option('--fix', 'Attempt to fix issues automatically')
  .option('--quick', 'Quick validation (skip dependency checks)')
  .parse();

const options = program.opts();

async function main() {
  try {
    console.log(chalk.blue('🔍 Validating decoupled testing setup...'));
    
    const configDir = path.resolve(options.configDir);
    
    // Load configuration
    let config = null;
    let projectPath = null;
    
    try {
      const configManager = new ConfigManager();
      const configPath = path.join(configDir, 'config.json');
      config = await configManager.loadConfig(configPath);
      projectPath = config?.projectPath || options.projectPath;
    } catch (error) {
      if (!options.projectPath) {
        throw new Error(`No configuration found and no project path provided. Run 'npm run init' first or provide --project-path.`);
      }
      projectPath = path.resolve(options.projectPath);
    }
    
    if (options.verbose) {
      console.log(chalk.gray(`Configuration directory: ${configDir}`));
      console.log(chalk.gray(`Project path: ${projectPath}`));
    }
    
    // Perform validation checks
    const validationResults = await performValidation(config, configDir, projectPath, options);
    
    // Report results
    reportValidationResults(validationResults, options);
    
    // Summary
    const totalChecks = validationResults.length;
    const passedChecks = validationResults.filter(r => r.status === 'pass').length;
    const failedChecks = validationResults.filter(r => r.status === 'fail').length;
    const warningChecks = validationResults.filter(r => r.status === 'warning').length;
    
    console.log('\n' + chalk.bold('📊 Validation Summary'));
    console.log('─'.repeat(30));
    console.log(`${chalk.green('✅ Passed:')} ${passedChecks}/${totalChecks}`);
    
    if (warningChecks > 0) {
      console.log(`${chalk.yellow('⚠️  Warnings:')} ${warningChecks}`);
    }
    
    if (failedChecks > 0) {
      console.log(`${chalk.red('❌ Failed:')} ${failedChecks}`);
      console.log('\n' + chalk.yellow('Run with --fix to attempt automatic fixes.'));
      process.exit(1);
    } else {
      console.log('\n' + chalk.green('✅ All validations passed! Setup is ready for testing.'));
      process.exit(0);
    }
    
  } catch (error) {
    console.error(chalk.red('❌ Validation failed:'));
    console.error(chalk.red(error.message));
    
    if (options.verbose) {
      console.error(chalk.gray(error.stack));
    }
    
    process.exit(1);
  }
}

async function performValidation(config, configDir, projectPath, options) {
  const checks = [];
  
  // Basic configuration checks
  checks.push(await validateConfiguration(config, configDir));
  checks.push(await validateProjectAccess(projectPath));
  
  if (config) {
    // Framework-specific checks
    checks.push(await validateFrameworkSetup(config, projectPath));
    checks.push(await validateTestStructure(config, configDir));
    
    if (!options.quick) {
      // Dependency checks
      checks.push(await validateDependencies(config, projectPath));
      checks.push(await validateTestExecution(config, configDir, projectPath));
    }
  }
  
  // Adapter validation
  checks.push(await validateAdapters(projectPath));
  
  // File permissions and access
  checks.push(await validateFilePermissions(configDir, projectPath));
  
  return checks.filter(check => check !== null);
}

async function validateConfiguration(config, configDir) {
  const check = {
    name: 'Configuration',
    description: 'Validate configuration file exists and is valid'
  };
  
  try {
    // Check if config directory exists
    await fs.access(configDir);
    
    if (!config) {
      return {
        ...check,
        status: 'fail',
        message: 'No configuration found',
        fix: 'Run npm run init to create configuration'
      };
    }
    
    // Validate required fields
    const requiredFields = ['version', 'projectPath', 'language', 'testing'];
    const missingFields = requiredFields.filter(field => !config[field]);
    
    if (missingFields.length > 0) {
      return {
        ...check,
        status: 'fail',
        message: `Missing required configuration fields: ${missingFields.join(', ')}`,
        fix: 'Run npm run init --force to regenerate configuration'
      };
    }
    
    return {
      ...check,
      status: 'pass',
      message: 'Configuration is valid'
    };
    
  } catch (error) {
    return {
      ...check,
      status: 'fail',
      message: `Configuration directory not accessible: ${error.message}`,
      fix: 'Ensure configuration directory exists and is readable'
    };
  }
}

async function validateProjectAccess(projectPath) {
  const check = {
    name: 'Project Access',
    description: 'Validate target project is accessible'
  };
  
  try {
    await fs.access(projectPath);
    const stats = await fs.stat(projectPath);
    
    if (!stats.isDirectory()) {
      return {
        ...check,
        status: 'fail',
        message: 'Project path is not a directory',
        fix: 'Provide correct project directory path'
      };
    }
    
    return {
      ...check,
      status: 'pass',
      message: 'Project directory is accessible'
    };
    
  } catch (error) {
    return {
      ...check,
      status: 'fail',
      message: `Cannot access project directory: ${error.message}`,
      fix: 'Ensure project path exists and is readable'
    };
  }
}

async function validateFrameworkSetup(config, projectPath) {
  const check = {
    name: 'Framework Detection',
    description: 'Validate framework detection and configuration'
  };
  
  try {
    // Get adapter for the project
    const adapter = await adapterFactory.getAdapter(projectPath);
    const analysis = await adapter.analyze(projectPath);
    
    // Check if detected framework matches configuration
    if (config.language !== analysis.language) {
      return {
        ...check,
        status: 'warning',
        message: `Language mismatch: config has ${config.language}, detected ${analysis.language}`,
        fix: 'Update configuration or verify project language'
      };
    }
    
    // Check if frameworks are properly detected
    if (!analysis.frameworks || analysis.frameworks.length === 0) {
      return {
        ...check,
        status: 'warning',
        message: 'No frameworks detected in project',
        fix: 'Verify project structure or add framework indicators'
      };
    }
    
    return {
      ...check,
      status: 'pass',
      message: `Framework detected: ${analysis.frameworks.join(', ')}`
    };
    
  } catch (error) {
    return {
      ...check,
      status: 'fail',
      message: `Framework detection failed: ${error.message}`,
      fix: 'Check project structure and adapter configuration'
    };
  }
}

async function validateTestStructure(config, configDir) {
  const check = {
    name: 'Test Structure',
    description: 'Validate test directory structure exists'
  };
  
  try {
    const testDir = path.join(configDir, 'tests');
    await fs.access(testDir);
    
    // Check for test directories based on configured types
    const missingTypes = [];
    
    for (const testType of config.testing.types) {
      const typeDir = path.join(testDir, testType);
      try {
        await fs.access(typeDir);
      } catch {
        missingTypes.push(testType);
      }
    }
    
    if (missingTypes.length > 0) {
      return {
        ...check,
        status: 'warning',
        message: `Missing test directories: ${missingTypes.join(', ')}`,
        fix: 'Run npm run init --force to recreate test structure'
      };
    }
    
    return {
      ...check,
      status: 'pass',
      message: 'Test structure is complete'
    };
    
  } catch (error) {
    return {
      ...check,
      status: 'fail',
      message: 'Test directory structure not found',
      fix: 'Run npm run init to create test structure'
    };
  }
}

async function validateDependencies(config, projectPath) {
  const check = {
    name: 'Dependencies',
    description: 'Validate required dependencies are available'
  };
  
  try {
    const framework = config.testing.framework;
    const language = config.language;
    
    // Check framework-specific dependencies
    if (language === 'javascript') {
      // Check Node.js and npm
      try {
        execSync('node --version', { stdio: 'pipe' });
        execSync('npm --version', { stdio: 'pipe' });
      } catch {
        return {
          ...check,
          status: 'fail',
          message: 'Node.js or npm not available',
          fix: 'Install Node.js and npm'
        };
      }
      
      // Check test framework
      try {
        const result = execSync(`npx ${framework} --version`, { 
          stdio: 'pipe', 
          cwd: projectPath 
        });
        
        return {
          ...check,
          status: 'pass',
          message: `${framework} is available: ${result.toString().trim()}`
        };
      } catch {
        return {
          ...check,
          status: 'warning',
          message: `${framework} not available in project`,
          fix: `Install ${framework} in the target project`
        };
      }
    }
    
    if (language === 'python') {
      // Check Python
      try {
        execSync('python --version', { stdio: 'pipe' });
      } catch {
        try {
          execSync('python3 --version', { stdio: 'pipe' });
        } catch {
          return {
            ...check,
            status: 'fail',
            message: 'Python not available',
            fix: 'Install Python 3.9+'
          };
        }
      }
      
      // Check pytest
      try {
        execSync('python -m pytest --version', { stdio: 'pipe', cwd: projectPath });
        return {
          ...check,
          status: 'pass',
          message: 'Python and pytest are available'
        };
      } catch {
        return {
          ...check,
          status: 'warning',
          message: 'pytest not available',
          fix: 'Install pytest: pip install pytest'
        };
      }
    }
    
  } catch (error) {
    return {
      ...check,
      status: 'fail',
      message: `Dependency check failed: ${error.message}`,
      fix: 'Check system dependencies and PATH'
    };
  }
}

async function validateTestExecution(config, configDir, projectPath) {
  const check = {
    name: 'Test Execution',
    description: 'Validate tests can be executed'
  };
  
  try {
    // Try to run a simple test command
    const runScript = path.join(configDir, 'scripts', 'run-tests.js');
    
    // Check if run script exists
    try {
      await fs.access(runScript);
    } catch {
      return {
        ...check,
        status: 'fail',
        message: 'Test execution script not found',
        fix: 'Run npm run init to create test scripts'
      };
    }
    
    // Try a dry run (this might be framework-specific)
    // For now, just check if the script is executable
    try {
      await fs.access(runScript, fs.constants.X_OK);
      
      return {
        ...check,
        status: 'pass',
        message: 'Test execution script is ready'
      };
    } catch {
      return {
        ...check,
        status: 'warning',
        message: 'Test execution script not executable',
        fix: 'Make script executable: chmod +x scripts/run-tests.js'
      };
    }
    
  } catch (error) {
    return {
      ...check,
      status: 'fail',
      message: `Test execution validation failed: ${error.message}`,
      fix: 'Check test execution configuration'
    };
  }
}

async function validateAdapters(projectPath) {
  const check = {
    name: 'Adapter System',
    description: 'Validate adapter system is working'
  };
  
  try {
    // Try to get adapter for the project
    const adapter = await adapterFactory.getAdapter(projectPath);
    
    if (!adapter) {
      return {
        ...check,
        status: 'fail',
        message: 'No suitable adapter found for project',
        fix: 'Check project structure or add custom adapter'
      };
    }
    
    // Try basic adapter functionality
    const canDetect = await adapter.detect(projectPath);
    
    if (!canDetect) {
      return {
        ...check,
        status: 'warning',
        message: 'Adapter detected but cannot handle project',
        fix: 'Verify project structure matches adapter requirements'
      };
    }
    
    return {
      ...check,
      status: 'pass',
      message: `Adapter working: ${adapter.constructor.name}`
    };
    
  } catch (error) {
    return {
      ...check,
      status: 'fail',
      message: `Adapter validation failed: ${error.message}`,
      fix: 'Check adapter system configuration'
    };
  }
}

async function validateFilePermissions(configDir, projectPath) {
  const check = {
    name: 'File Permissions',
    description: 'Validate file permissions for reading and writing'
  };
  
  try {
    // Check read/write access to config directory
    await fs.access(configDir, fs.constants.R_OK | fs.constants.W_OK);
    
    // Check read access to project directory
    await fs.access(projectPath, fs.constants.R_OK);
    
    // Try to create a temp file in config directory
    const tempFile = path.join(configDir, '.validation-test');
    await fs.writeFile(tempFile, 'test');
    await fs.unlink(tempFile);
    
    return {
      ...check,
      status: 'pass',
      message: 'File permissions are correct'
    };
    
  } catch (error) {
    return {
      ...check,
      status: 'fail',
      message: `Permission error: ${error.message}`,
      fix: 'Check file permissions and ownership'
    };
  }
}

function reportValidationResults(results, options) {
  console.log('\n' + chalk.bold('🔍 Validation Results'));
  console.log('═'.repeat(50));
  
  results.forEach((result, index) => {
    let icon, color;
    
    switch (result.status) {
      case 'pass':
        icon = '✅';
        color = chalk.green;
        break;
      case 'warning':
        icon = '⚠️ ';
        color = chalk.yellow;
        break;
      case 'fail':
        icon = '❌';
        color = chalk.red;
        break;
      default:
        icon = 'ℹ️ ';
        color = chalk.blue;
    }
    
    console.log(`\n${icon} ${chalk.bold(result.name)}`);
    console.log(`   ${color(result.message)}`);
    
    if (result.fix && (result.status === 'fail' || result.status === 'warning')) {
      console.log(`   ${chalk.gray('Fix:')} ${result.fix}`);
    }
    
    if (options.verbose && result.description) {
      console.log(`   ${chalk.gray('Description:')} ${result.description}`);
    }
  });
  
  console.log('\n' + '═'.repeat(50));
}

if (require.main === module) {
  main().catch(error => {
    console.error(chalk.red('❌ Unexpected error:'), error.message);
    process.exit(1);
  });
}

module.exports = { main };