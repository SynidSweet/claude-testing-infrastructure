#!/usr/bin/env node

/**
 * Check Compatibility Script
 * 
 * Checks compatibility between the decoupled testing suite and target projects.
 * Validates versions, dependencies, and configuration compatibility.
 */

const path = require('path');
const fs = require('fs').promises;
const chalk = require('chalk');
const { Command } = require('commander');
const semver = require('semver');
const { execSync } = require('child_process');
const { adapterFactory } = require('../../shared/adapters/AdapterFactory');
const { ConfigManager } = require('../core/config/config-manager');

const program = new Command();

program
  .name('check-compatibility')
  .description('Check compatibility between testing suite and target project')
  .option('-p, --project-path <path>', 'Path to the project to check', process.cwd())
  .option('-c, --config-dir <path>', 'Test configuration directory', './test-config')
  .option('-v, --verbose', 'Verbose output')
  .option('--fix', 'Attempt to fix compatibility issues automatically')
  .option('--report <format>', 'Report format (table|json|summary)', 'table')
  .parse();

const options = program.opts();

// Compatibility requirements
const COMPATIBILITY_REQUIREMENTS = {
  node: {
    minimum: '14.0.0',
    recommended: '18.0.0'
  },
  python: {
    minimum: '3.8.0',
    recommended: '3.9.0'
  },
  frameworks: {
    jest: {
      minimum: '27.0.0',
      maximum: '30.0.0'
    },
    playwright: {
      minimum: '1.20.0'
    },
    pytest: {
      minimum: '6.0.0'
    }
  }
};

async function main() {
  try {
    console.log(chalk.blue('🔍 Checking compatibility...'));
    
    const projectPath = path.resolve(options.projectPath);
    const configDir = path.resolve(options.configDir);
    
    // Validate inputs
    await validateInputs(projectPath, configDir);
    
    if (options.verbose) {
      console.log(chalk.gray(`Project: ${projectPath}`));
      console.log(chalk.gray(`Config: ${configDir}`));
    }
    
    // Perform compatibility checks
    const compatibilityResults = await performCompatibilityChecks(projectPath, configDir, options);
    
    // Generate report
    await generateCompatibilityReport(compatibilityResults, options);
    
    // Summary and exit
    const issueCount = compatibilityResults.filter(r => r.status === 'incompatible').length;
    const warningCount = compatibilityResults.filter(r => r.status === 'warning').length;
    
    if (issueCount > 0) {
      console.log(chalk.red(`\n❌ ${issueCount} compatibility issue(s) found.`));
      if (options.fix) {
        console.log(chalk.yellow('Use --fix to attempt automatic resolution.'));
      }
      process.exit(1);
    } else if (warningCount > 0) {
      console.log(chalk.yellow(`\n⚠️  ${warningCount} compatibility warning(s) found.`));
      process.exit(0);
    } else {
      console.log(chalk.green('\n✅ All compatibility checks passed!'));
      process.exit(0);
    }
    
  } catch (error) {
    console.error(chalk.red('❌ Compatibility check failed:'));
    console.error(chalk.red(error.message));
    
    if (options.verbose) {
      console.error(chalk.gray(error.stack));
    }
    
    process.exit(1);
  }
}

async function validateInputs(projectPath, configDir) {
  // Check project path
  try {
    await fs.access(projectPath);
    const stats = await fs.stat(projectPath);
    if (!stats.isDirectory()) {
      throw new Error('Project path must be a directory');
    }
  } catch (error) {
    throw new Error(`Invalid project path: ${error.message}`);
  }
  
  // Config directory doesn't need to exist yet
}

async function performCompatibilityChecks(projectPath, configDir, options) {
  const results = [];
  
  // System compatibility checks
  results.push(await checkNodeVersion());
  results.push(await checkPythonVersion(projectPath));
  
  // Project compatibility checks
  results.push(await checkProjectStructure(projectPath));
  results.push(await checkProjectDependencies(projectPath));
  
  // Framework compatibility checks
  const adapter = await adapterFactory.getAdapter(projectPath);
  const analysis = await adapter.analyze(projectPath);
  
  results.push(await checkFrameworkCompatibility(analysis, projectPath));
  
  // Configuration compatibility (if config exists)
  try {
    const configManager = new ConfigManager(configDir);
    const config = await configManager.loadConfig();
    results.push(await checkConfigurationCompatibility(config, analysis));
  } catch {
    // No existing configuration, skip this check
    results.push({
      name: 'Configuration',
      status: 'not_applicable',
      message: 'No existing configuration found',
      category: 'configuration'
    });
  }
  
  // Testing tool compatibility
  results.push(await checkTestingToolCompatibility(analysis, projectPath));
  
  return results.filter(result => result !== null);
}

async function checkNodeVersion() {
  const check = {
    name: 'Node.js Version',
    category: 'system',
    requirement: `>= ${COMPATIBILITY_REQUIREMENTS.node.minimum}`
  };
  
  try {
    const version = process.version;
    const cleanVersion = version.replace('v', '');
    
    if (semver.lt(cleanVersion, COMPATIBILITY_REQUIREMENTS.node.minimum)) {
      return {
        ...check,
        status: 'incompatible',
        message: `Node.js ${version} is too old. Minimum required: ${COMPATIBILITY_REQUIREMENTS.node.minimum}`,
        current: cleanVersion,
        fix: `Update Node.js to version ${COMPATIBILITY_REQUIREMENTS.node.recommended} or higher`
      };
    }
    
    if (semver.lt(cleanVersion, COMPATIBILITY_REQUIREMENTS.node.recommended)) {
      return {
        ...check,
        status: 'warning',
        message: `Node.js ${version} works but ${COMPATIBILITY_REQUIREMENTS.node.recommended} is recommended`,
        current: cleanVersion,
        fix: `Consider updating to Node.js ${COMPATIBILITY_REQUIREMENTS.node.recommended}`
      };
    }
    
    return {
      ...check,
      status: 'compatible',
      message: `Node.js ${version} is compatible`,
      current: cleanVersion
    };
    
  } catch (error) {
    return {
      ...check,
      status: 'error',
      message: `Cannot determine Node.js version: ${error.message}`
    };
  }
}

async function checkPythonVersion(projectPath) {
  const check = {
    name: 'Python Version',
    category: 'system',
    requirement: `>= ${COMPATIBILITY_REQUIREMENTS.python.minimum}`
  };
  
  try {
    // Check if this is a Python project
    const hasPythonFiles = await hasFiles(projectPath, ['*.py', 'requirements.txt', 'setup.py', 'pyproject.toml']);
    
    if (!hasPythonFiles) {
      return {
        ...check,
        status: 'not_applicable',
        message: 'Not a Python project'
      };
    }
    
    // Try to get Python version
    let pythonVersion;
    try {
      pythonVersion = execSync('python --version 2>&1', { encoding: 'utf-8' }).trim();
    } catch {
      try {
        pythonVersion = execSync('python3 --version 2>&1', { encoding: 'utf-8' }).trim();
      } catch {
        return {
          ...check,
          status: 'incompatible',
          message: 'Python not found in PATH',
          fix: 'Install Python 3.9+ and ensure it\'s in PATH'
        };
      }
    }
    
    const versionMatch = pythonVersion.match(/Python (\d+\.\d+\.\d+)/);
    if (!versionMatch) {
      return {
        ...check,
        status: 'error',
        message: `Cannot parse Python version: ${pythonVersion}`
      };
    }
    
    const version = versionMatch[1];
    
    if (semver.lt(version, COMPATIBILITY_REQUIREMENTS.python.minimum)) {
      return {
        ...check,
        status: 'incompatible',
        message: `Python ${version} is too old. Minimum required: ${COMPATIBILITY_REQUIREMENTS.python.minimum}`,
        current: version,
        fix: `Update Python to version ${COMPATIBILITY_REQUIREMENTS.python.recommended} or higher`
      };
    }
    
    return {
      ...check,
      status: 'compatible',
      message: `Python ${version} is compatible`,
      current: version
    };
    
  } catch (error) {
    return {
      ...check,
      status: 'error',
      message: `Python version check failed: ${error.message}`
    };
  }
}

async function checkProjectStructure(projectPath) {
  const check = {
    name: 'Project Structure',
    category: 'project'
  };
  
  try {
    // Check for common project indicators
    const indicators = [
      'package.json',
      'requirements.txt', 
      'setup.py',
      'pyproject.toml',
      'Cargo.toml',
      'composer.json'
    ];
    
    let foundIndicators = 0;
    let projectType = 'unknown';
    
    for (const indicator of indicators) {
      try {
        await fs.access(path.join(projectPath, indicator));
        foundIndicators++;
        
        if (indicator === 'package.json') projectType = 'JavaScript/Node.js';
        else if (indicator.includes('py')) projectType = 'Python';
        else if (indicator === 'Cargo.toml') projectType = 'Rust';
        else if (indicator === 'composer.json') projectType = 'PHP';
      } catch {}
    }
    
    if (foundIndicators === 0) {
      return {
        ...check,
        status: 'warning',
        message: 'No common project structure indicators found',
        fix: 'Ensure the project has package.json, requirements.txt, or similar configuration files'
      };
    }
    
    return {
      ...check,
      status: 'compatible',
      message: `Project structure detected: ${projectType}`,
      details: { projectType, indicators: foundIndicators }
    };
    
  } catch (error) {
    return {
      ...check,
      status: 'error',
      message: `Project structure check failed: ${error.message}`
    };
  }
}

async function checkProjectDependencies(projectPath) {
  const check = {
    name: 'Project Dependencies',
    category: 'project'
  };
  
  try {
    const issues = [];
    const warnings = [];
    
    // Check package.json if exists
    try {
      const packageJsonPath = path.join(projectPath, 'package.json');
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
      
      // Check for conflicting dependencies
      const allDeps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies
      };
      
      // Check for multiple test frameworks
      const testFrameworks = ['jest', 'mocha', 'vitest', 'ava'].filter(fw => allDeps[fw]);
      if (testFrameworks.length > 1) {
        warnings.push(`Multiple test frameworks detected: ${testFrameworks.join(', ')}`);
      }
      
      // Check for peer dependency warnings
      if (packageJson.peerDependencies) {
        const peerDeps = Object.keys(packageJson.peerDependencies);
        const missingPeers = peerDeps.filter(dep => !allDeps[dep]);
        if (missingPeers.length > 0) {
          warnings.push(`Missing peer dependencies: ${missingPeers.join(', ')}`);
        }
      }
      
    } catch {
      // package.json doesn't exist or is invalid
    }
    
    // Check Python dependencies
    try {
      const requirementsPath = path.join(projectPath, 'requirements.txt');
      await fs.access(requirementsPath);
      
      const requirements = await fs.readFile(requirementsPath, 'utf-8');
      
      // Check for conflicting test frameworks
      const pythonTestFrameworks = ['pytest', 'unittest', 'nose'].filter(fw => 
        requirements.includes(fw)
      );
      
      if (pythonTestFrameworks.length > 1) {
        warnings.push(`Multiple Python test frameworks: ${pythonTestFrameworks.join(', ')}`);
      }
      
    } catch {
      // requirements.txt doesn't exist
    }
    
    if (issues.length > 0) {
      return {
        ...check,
        status: 'incompatible',
        message: `Dependency issues: ${issues.join(', ')}`,
        fix: 'Resolve dependency conflicts'
      };
    }
    
    if (warnings.length > 0) {
      return {
        ...check,
        status: 'warning',
        message: `Dependency warnings: ${warnings.join(', ')}`,
        fix: 'Review and resolve dependency warnings'
      };
    }
    
    return {
      ...check,
      status: 'compatible',
      message: 'No dependency conflicts detected'
    };
    
  } catch (error) {
    return {
      ...check,
      status: 'error',
      message: `Dependency check failed: ${error.message}`
    };
  }
}

async function checkFrameworkCompatibility(analysis, projectPath) {
  const check = {
    name: 'Framework Compatibility',
    category: 'framework'
  };
  
  try {
    const frameworks = analysis.frameworks || [];
    const incompatibleFrameworks = [];
    const warnings = [];
    
    for (const framework of frameworks) {
      const requirement = COMPATIBILITY_REQUIREMENTS.frameworks[framework.toLowerCase()];
      
      if (!requirement) {
        warnings.push(`No compatibility data for framework: ${framework}`);
        continue;
      }
      
      // Try to get framework version from project
      const version = await getFrameworkVersion(framework, projectPath);
      
      if (version) {
        if (requirement.minimum && semver.lt(version, requirement.minimum)) {
          incompatibleFrameworks.push(`${framework} ${version} < ${requirement.minimum}`);
        }
        
        if (requirement.maximum && semver.gte(version, requirement.maximum)) {
          incompatibleFrameworks.push(`${framework} ${version} >= ${requirement.maximum}`);
        }
      }
    }
    
    if (incompatibleFrameworks.length > 0) {
      return {
        ...check,
        status: 'incompatible',
        message: `Incompatible frameworks: ${incompatibleFrameworks.join(', ')}`,
        fix: 'Update frameworks to compatible versions'
      };
    }
    
    if (warnings.length > 0) {
      return {
        ...check,
        status: 'warning',
        message: `Framework warnings: ${warnings.join(', ')}`
      };
    }
    
    return {
      ...check,
      status: 'compatible',
      message: `All frameworks compatible: ${frameworks.join(', ')}`
    };
    
  } catch (error) {
    return {
      ...check,
      status: 'error',
      message: `Framework compatibility check failed: ${error.message}`
    };
  }
}

async function checkConfigurationCompatibility(config, analysis) {
  const check = {
    name: 'Configuration Compatibility',
    category: 'configuration'
  };
  
  try {
    const issues = [];
    
    // Check language compatibility
    if (config.language !== analysis.language) {
      issues.push(`Language mismatch: config(${config.language}) vs detected(${analysis.language})`);
    }
    
    // Check framework compatibility
    const configFrameworks = config.frameworks || [];
    const detectedFrameworks = analysis.frameworks || [];
    
    const missingFrameworks = detectedFrameworks.filter(fw => 
      !configFrameworks.includes(fw)
    );
    
    if (missingFrameworks.length > 0) {
      issues.push(`New frameworks detected: ${missingFrameworks.join(', ')}`);
    }
    
    // Check version compatibility
    if (config.version && semver.lt(config.version, '1.0.0')) {
      issues.push('Configuration version is too old');
    }
    
    if (issues.length > 0) {
      return {
        ...check,
        status: 'incompatible',
        message: `Configuration issues: ${issues.join(', ')}`,
        fix: 'Update configuration or run migration'
      };
    }
    
    return {
      ...check,
      status: 'compatible',
      message: 'Configuration is compatible'
    };
    
  } catch (error) {
    return {
      ...check,
      status: 'error',
      message: `Configuration compatibility check failed: ${error.message}`
    };
  }
}

async function checkTestingToolCompatibility(analysis, projectPath) {
  const check = {
    name: 'Testing Tools',
    category: 'tools'
  };
  
  try {
    const recommendations = [];
    const issues = [];
    
    // Check for testing tools based on language
    if (analysis.language === 'javascript') {
      const hasJest = await hasPackage('jest', projectPath);
      const hasVitest = await hasPackage('vitest', projectPath);
      const hasMocha = await hasPackage('mocha', projectPath);
      
      if (!hasJest && !hasVitest && !hasMocha) {
        recommendations.push('Install a test framework: jest, vitest, or mocha');
      }
      
      // Check for E2E tools
      const hasPlaywright = await hasPackage('playwright', projectPath);
      const hasCypress = await hasPackage('cypress', projectPath);
      
      if (!hasPlaywright && !hasCypress) {
        recommendations.push('Consider adding E2E testing: playwright or cypress');
      }
    }
    
    if (analysis.language === 'python') {
      const hasPytest = await hasPythonPackage('pytest', projectPath);
      
      if (!hasPytest) {
        recommendations.push('Install pytest for Python testing');
      }
    }
    
    if (recommendations.length > 0) {
      return {
        ...check,
        status: 'warning',
        message: `Testing tool recommendations: ${recommendations.join(', ')}`,
        fix: 'Install recommended testing tools'
      };
    }
    
    return {
      ...check,
      status: 'compatible',
      message: 'Testing tools are available'
    };
    
  } catch (error) {
    return {
      ...check,
      status: 'error',
      message: `Testing tool check failed: ${error.message}`
    };
  }
}

// Helper functions
async function hasFiles(dirPath, patterns) {
  for (const pattern of patterns) {
    try {
      const files = await fs.readdir(dirPath);
      const hasPattern = files.some(file => 
        file.includes(pattern.replace('*', ''))
      );
      if (hasPattern) return true;
    } catch {}
  }
  return false;
}

async function getFrameworkVersion(framework, projectPath) {
  try {
    const packageJsonPath = path.join(projectPath, 'package.json');
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
    
    const allDeps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies
    };
    
    const version = allDeps[framework.toLowerCase()];
    if (version) {
      return semver.coerce(version)?.version;
    }
  } catch {}
  
  return null;
}

async function hasPackage(packageName, projectPath) {
  try {
    const packageJsonPath = path.join(projectPath, 'package.json');
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
    
    const allDeps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies
    };
    
    return !!allDeps[packageName];
  } catch {
    return false;
  }
}

async function hasPythonPackage(packageName, projectPath) {
  try {
    const requirementsPath = path.join(projectPath, 'requirements.txt');
    const requirements = await fs.readFile(requirementsPath, 'utf-8');
    return requirements.includes(packageName);
  } catch {
    return false;
  }
}

async function generateCompatibilityReport(results, options) {
  switch (options.report) {
    case 'json':
      console.log(JSON.stringify(results, null, 2));
      break;
    case 'summary':
      generateSummaryReport(results);
      break;
    case 'table':
    default:
      generateTableReport(results);
      break;
  }
}

function generateTableReport(results) {
  console.log('\n' + chalk.bold('🔍 Compatibility Report'));
  console.log('═'.repeat(70));
  
  const categories = ['system', 'project', 'framework', 'configuration', 'tools'];
  
  categories.forEach(category => {
    const categoryResults = results.filter(r => r.category === category);
    if (categoryResults.length === 0) return;
    
    console.log(chalk.bold(`\n📋 ${category.charAt(0).toUpperCase() + category.slice(1)}`));
    console.log('─'.repeat(30));
    
    categoryResults.forEach(result => {
      let icon, color;
      
      switch (result.status) {
        case 'compatible':
          icon = '✅';
          color = chalk.green;
          break;
        case 'warning':
          icon = '⚠️ ';
          color = chalk.yellow;
          break;
        case 'incompatible':
          icon = '❌';
          color = chalk.red;
          break;
        case 'not_applicable':
          icon = 'ℹ️ ';
          color = chalk.gray;
          break;
        default:
          icon = '❓';
          color = chalk.blue;
      }
      
      console.log(`${icon} ${chalk.bold(result.name)}`);
      console.log(`   ${color(result.message)}`);
      
      if (result.fix && result.status !== 'compatible') {
        console.log(`   ${chalk.gray('Fix:')} ${result.fix}`);
      }
      
      if (result.current) {
        console.log(`   ${chalk.gray('Current:')} ${result.current}`);
      }
    });
  });
  
  console.log('\n' + '═'.repeat(70));
}

function generateSummaryReport(results) {
  const compatible = results.filter(r => r.status === 'compatible').length;
  const warnings = results.filter(r => r.status === 'warning').length;
  const incompatible = results.filter(r => r.status === 'incompatible').length;
  const total = results.length;
  
  console.log('\n' + chalk.bold('📊 Compatibility Summary'));
  console.log('─'.repeat(40));
  console.log(`${chalk.green('✅ Compatible:')} ${compatible}/${total}`);
  console.log(`${chalk.yellow('⚠️  Warnings:')} ${warnings}/${total}`);
  console.log(`${chalk.red('❌ Incompatible:')} ${incompatible}/${total}`);
  
  if (incompatible > 0) {
    console.log('\n' + chalk.bold('Critical Issues:'));
    results
      .filter(r => r.status === 'incompatible')
      .forEach(r => console.log(`  • ${r.name}: ${r.message}`));
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error(chalk.red('❌ Unexpected error:'), error.message);
    process.exit(1);
  });
}

module.exports = { main, COMPATIBILITY_REQUIREMENTS };