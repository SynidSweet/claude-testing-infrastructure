#!/usr/bin/env node

/**
 * Initialize Project Script
 * 
 * Initializes testing configuration for a project using the decoupled approach.
 * Generates configuration files and sets up test structure without modifying the target project.
 */

const path = require('path');
const fs = require('fs').promises;
const chalk = require('chalk');
const { Command } = require('commander');
const inquirer = require('inquirer');
const { adapterFactory } = require('../../shared/adapters/AdapterFactory');
const { ConfigManager } = require('../core/config/config-manager');
const { PathResolver } = require('../core/utils/path-resolver');

const program = new Command();

program
  .name('init-project')
  .description('Initialize testing configuration for a project (decoupled approach)')
  .option('-p, --project-path <path>', 'Path to the project to test', process.cwd())
  .option('-c, --config-dir <path>', 'Directory to store test configuration', './test-config')
  .option('-y, --yes', 'Accept all defaults without prompting')
  .option('-v, --verbose', 'Verbose output')
  .option('--force', 'Overwrite existing configuration')
  .option('--template <name>', 'Use specific template (react, vue, python, etc.)')
  .parse();

const options = program.opts();

async function main() {
  try {
    console.log(chalk.blue('🚀 Initializing decoupled testing configuration...'));
    
    const projectPath = path.resolve(options.projectPath);
    const configDir = path.resolve(options.configDir);
    
    // Validate project path
    await validateProjectPath(projectPath);
    
    // Check if configuration already exists
    if (!options.force) {
      await checkExistingConfig(configDir);
    }
    
    if (options.verbose) {
      console.log(chalk.gray(`Project: ${projectPath}`));
      console.log(chalk.gray(`Config Directory: ${configDir}`));
    }
    
    // Get project adapter
    console.log(chalk.yellow('🔍 Analyzing project...'));
    const adapter = await adapterFactory.getAdapter(projectPath);
    
    if (options.verbose) {
      console.log(chalk.gray(`Using adapter: ${adapter.constructor.name}`));
    }
    
    // Analyze project
    const analysis = await adapter.analyze(projectPath);
    
    // Get user preferences (unless --yes flag is used)
    const preferences = options.yes ? {} : await getUserPreferences(analysis);
    
    // Generate configuration
    console.log(chalk.yellow('⚙️  Generating configuration...'));
    const config = await generateConfiguration(analysis, preferences, {
      projectPath,
      configDir,
      template: options.template
    });
    
    // Create configuration directory
    await fs.mkdir(configDir, { recursive: true });
    
    // Save configuration
    const configManager = new ConfigManager();
    const configPath = path.join(configDir, 'config.json');
    await configManager.saveConfig(config, configPath);
    
    // Generate test structure
    console.log(chalk.yellow('📁 Creating test structure...'));
    await createTestStructure(configDir, config, analysis);
    
    // Generate helper scripts
    console.log(chalk.yellow('📝 Creating helper scripts...'));
    await createHelperScripts(configDir, config, projectPath);
    
    // Generate documentation
    await createDocumentation(configDir, config, analysis);
    
    console.log(chalk.green('✅ Decoupled testing configuration initialized successfully!'));
    console.log('\n' + chalk.bold('Next steps:'));
    console.log(`1. Review configuration in ${chalk.cyan(configDir)}`);
    console.log(`2. Run ${chalk.cyan('npm run test')} to execute tests`);
    console.log(`3. Run ${chalk.cyan('npm run test:watch')} for development mode`);
    
  } catch (error) {
    console.error(chalk.red('❌ Initialization failed:'));
    console.error(chalk.red(error.message));
    
    if (options.verbose) {
      console.error(chalk.gray(error.stack));
    }
    
    process.exit(1);
  }
}

async function validateProjectPath(projectPath) {
  try {
    await fs.access(projectPath);
    const stats = await fs.stat(projectPath);
    
    if (!stats.isDirectory()) {
      throw new Error(`Project path is not a directory: ${projectPath}`);
    }
  } catch (error) {
    throw new Error(`Invalid project path: ${projectPath}`);
  }
}

async function checkExistingConfig(configDir) {
  try {
    await fs.access(path.join(configDir, 'config.json'));
    
    const { overwrite } = await inquirer.prompt([{
      type: 'confirm',
      name: 'overwrite',
      message: 'Configuration already exists. Overwrite?',
      default: false
    }]);
    
    if (!overwrite) {
      console.log(chalk.yellow('⏹️  Initialization cancelled.'));
      process.exit(0);
    }
  } catch (error) {
    // Config doesn't exist, continue
  }
}

async function getUserPreferences(analysis) {
  console.log(chalk.blue('\n📋 Configuration Questions'));
  
  const questions = [];
  
  // Test framework preference
  if (analysis.language === 'javascript') {
    questions.push({
      type: 'list',
      name: 'testFramework',
      message: 'Which test framework would you like to use?',
      choices: [
        { name: 'Jest (Recommended)', value: 'jest' },
        { name: 'Vitest', value: 'vitest' },
        { name: 'Mocha + Chai', value: 'mocha' }
      ],
      default: analysis.detectedTestFramework || 'jest'
    });
  }
  
  // Coverage threshold
  questions.push({
    type: 'number',
    name: 'coverageThreshold',
    message: 'Minimum coverage threshold (%):',
    default: 80,
    validate: (input) => input >= 0 && input <= 100 || 'Please enter a number between 0 and 100'
  });
  
  // Test types to include
  questions.push({
    type: 'checkbox',
    name: 'testTypes',
    message: 'Which types of tests to include?',
    choices: [
      { name: 'Unit Tests', value: 'unit', checked: true },
      { name: 'Integration Tests', value: 'integration', checked: true },
      { name: 'Component Tests (UI)', value: 'component', checked: analysis.hasUIComponents },
      { name: 'End-to-End Tests', value: 'e2e', checked: false },
      { name: 'Performance Tests', value: 'performance', checked: false }
    ],
    validate: (answer) => answer.length > 0 || 'Please select at least one test type'
  });
  
  // CI/CD integration
  questions.push({
    type: 'list',
    name: 'ciProvider',
    message: 'CI/CD provider (optional):',
    choices: [
      { name: 'None', value: null },
      { name: 'GitHub Actions', value: 'github' },
      { name: 'GitLab CI', value: 'gitlab' },
      { name: 'CircleCI', value: 'circle' },
      { name: 'Jenkins', value: 'jenkins' }
    ],
    default: null
  });
  
  // Watch mode preference
  questions.push({
    type: 'confirm',
    name: 'enableWatch',
    message: 'Enable watch mode for development?',
    default: true
  });
  
  return inquirer.prompt(questions);
}

async function generateConfiguration(analysis, preferences, options) {
  const config = {
    version: '1.0.0',
    projectPath: options.projectPath,
    projectRoot: options.projectPath,
    configDir: options.configDir,
    language: analysis.language,
    projectType: analysis.projectType,
    frameworks: analysis.frameworks || [],
    
    // Test configuration
    testing: {
      framework: preferences.testFramework || (analysis.language === 'python' ? 'pytest' : 'jest'),
      types: preferences.testTypes || ['unit', 'integration'],
      coverage: {
        threshold: preferences.coverageThreshold || 80,
        reporters: ['text', 'html', 'lcov'],
        collectFrom: analysis.testableFiles || []
      },
      watch: preferences.enableWatch !== false
    },
    
    // Environment configuration
    environment: {
      testEnv: analysis.language === 'python' ? 'pytest' : 'test',
      nodeEnv: 'test',
      setupFiles: [],
      teardownFiles: []
    },
    
    // File patterns
    patterns: {
      testFiles: getTestFilePatterns(analysis.language),
      sourceFiles: getSourceFilePatterns(analysis.language),
      ignorePatterns: ['node_modules/', '*.log', 'coverage/', 'dist/', 'build/']
    },
    
    // Scripts and commands
    scripts: generateScriptCommands(analysis, preferences),
    
    // CI/CD integration
    ci: preferences.ciProvider ? {
      provider: preferences.ciProvider,
      enabled: true,
      config: {}
    } : null,
    
    // Metadata
    metadata: {
      createdAt: new Date().toISOString(),
      adapter: analysis.adapter || 'unknown',
      version: require('../package.json').version
    }
  };
  
  return config;
}

function getTestFilePatterns(language) {
  switch (language) {
    case 'python':
      return ['test_*.py', '*_test.py', 'tests/**/*.py'];
    case 'javascript':
    case 'typescript':
    default:
      return ['**/*.test.js', '**/*.spec.js', '**/__tests__/**/*.js'];
  }
}

function getSourceFilePatterns(language) {
  switch (language) {
    case 'python':
      return ['**/*.py'];
    case 'javascript':
      return ['**/*.js', '**/*.jsx'];
    case 'typescript':
      return ['**/*.ts', '**/*.tsx'];
    default:
      return ['**/*.js'];
  }
}

function generateScriptCommands(analysis, preferences) {
  const scripts = {
    test: 'npm run test:run',
    'test:watch': 'npm run test:run -- --watch',
    'test:coverage': 'npm run test:run -- --coverage',
    'test:ci': 'npm run test:run -- --ci --coverage --watchAll=false'
  };
  
  if (preferences.testTypes && preferences.testTypes.includes('e2e')) {
    scripts['test:e2e'] = 'playwright test';
  }
  
  if (preferences.testTypes && preferences.testTypes.includes('performance')) {
    scripts['test:perf'] = 'lighthouse-ci autorun';
  }
  
  return scripts;
}

async function createTestStructure(configDir, config, analysis) {
  const testDir = path.join(configDir, 'tests');
  await fs.mkdir(testDir, { recursive: true });
  
  // Create test directories based on selected types
  for (const testType of config.testing.types) {
    const typeDir = path.join(testDir, testType);
    await fs.mkdir(typeDir, { recursive: true });
    
    // Create example test file
    await createExampleTest(typeDir, testType, config.language, analysis);
  }
  
  // Create test utilities
  await createTestUtilities(testDir, config.language);
  
  // Create setup files
  await createSetupFiles(testDir, config);
}

async function createExampleTest(testDir, testType, language, analysis) {
  let content = '';
  let filename = '';
  
  switch (language) {
    case 'python':
      filename = `test_example_${testType}.py`;
      content = generatePythonTestExample(testType, analysis);
      break;
    case 'javascript':
    case 'typescript':
    default:
      filename = `example.${testType}.test.js`;
      content = generateJavaScriptTestExample(testType, analysis);
      break;
  }
  
  await fs.writeFile(path.join(testDir, filename), content);
}

function generateJavaScriptTestExample(testType, analysis) {
  switch (testType) {
    case 'unit':
      return `// Example unit test
describe('Example Unit Test', () => {
  test('should pass basic assertion', () => {
    expect(1 + 1).toBe(2);
  });

  test('should test a function', () => {
    const add = (a, b) => a + b;
    expect(add(2, 3)).toBe(5);
  });
});
`;
    case 'integration':
      return `// Example integration test
describe('Example Integration Test', () => {
  test('should test API endpoint', async () => {
    // Example API integration test
    // Replace with your actual API testing logic
    const response = { status: 200, data: 'success' };
    expect(response.status).toBe(200);
  });
});
`;
    case 'component':
      return `// Example component test
import { render, screen } from '@testing-library/react';

describe('Example Component Test', () => {
  test('should render component', () => {
    // Example component test
    // Replace with your actual component testing logic
    const element = document.createElement('div');
    element.textContent = 'Hello World';
    document.body.appendChild(element);
    
    expect(document.body.textContent).toContain('Hello World');
  });
});
`;
    default:
      return `// Example ${testType} test
describe('Example ${testType} Test', () => {
  test('should pass', () => {
    expect(true).toBe(true);
  });
});
`;
  }
}

function generatePythonTestExample(testType, analysis) {
  switch (testType) {
    case 'unit':
      return `"""Example unit test"""
import pytest

def test_basic_assertion():
    """Test basic assertion"""
    assert 1 + 1 == 2

def test_function():
    """Test a function"""
    def add(a, b):
        return a + b
    
    assert add(2, 3) == 5
`;
    case 'integration':
      return `"""Example integration test"""
import pytest

def test_api_endpoint():
    """Test API endpoint"""
    # Example API integration test
    # Replace with your actual API testing logic
    response = {"status": 200, "data": "success"}
    assert response["status"] == 200
`;
    default:
      return `"""Example ${testType} test"""
import pytest

def test_example():
    """Example test"""
    assert True
`;
  }
}

async function createTestUtilities(testDir, language) {
  const utilsDir = path.join(testDir, 'utils');
  await fs.mkdir(utilsDir, { recursive: true });
  
  let content = '';
  let filename = '';
  
  switch (language) {
    case 'python':
      filename = 'test_helpers.py';
      content = `"""Test utilities and helpers"""

def setup_test_environment():
    """Set up test environment"""
    pass

def cleanup_test_environment():
    """Clean up test environment"""
    pass

def create_mock_data():
    """Create mock data for testing"""
    return {"id": 1, "name": "test"}
`;
      break;
    default:
      filename = 'testHelpers.js';
      content = `// Test utilities and helpers

export function setupTestEnvironment() {
  // Set up test environment
}

export function cleanupTestEnvironment() {
  // Clean up test environment  
}

export function createMockData() {
  // Create mock data for testing
  return { id: 1, name: 'test' };
}
`;
      break;
  }
  
  await fs.writeFile(path.join(utilsDir, filename), content);
}

async function createSetupFiles(testDir, config) {
  // Create jest setup file for JavaScript projects
  if (config.language === 'javascript' && config.testing.framework === 'jest') {
    const setupContent = `// Jest setup file
// This file is executed before running tests

// Global test configuration
global.console = {
  ...console,
  // Uncomment to ignore console logs in tests
  // log: jest.fn(),
  // debug: jest.fn(),
  // info: jest.fn(),
  // warn: jest.fn(),
  // error: jest.fn(),
};

// Setup test environment
beforeAll(() => {
  // Global setup
});

afterAll(() => {
  // Global cleanup
});
`;
    await fs.writeFile(path.join(testDir, 'setup.js'), setupContent);
  }
  
  // Create pytest configuration for Python projects
  if (config.language === 'python' && config.testing.framework === 'pytest') {
    const pytestConfig = `[tool:pytest]
testpaths = tests
python_files = test_*.py *_test.py
python_classes = Test*
python_functions = test_*
addopts = 
    --verbose
    --tb=short
    --strict-markers
    --disable-warnings
    --cov=src
    --cov-report=html
    --cov-report=term-missing
    --cov-fail-under=${config.testing.coverage.threshold}
`;
    await fs.writeFile(path.join(testDir, 'pytest.ini'), pytestConfig);
  }
}

async function createHelperScripts(configDir, config, projectPath) {
  const scriptsDir = path.join(configDir, 'scripts');
  await fs.mkdir(scriptsDir, { recursive: true });
  
  // Create run tests script
  const runTestsScript = `#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');

const projectPath = '${projectPath}';
const configDir = '${configDir}';

// Change to project directory
process.chdir(projectPath);

// Set test environment
process.env.NODE_ENV = 'test';
process.env.TEST_CONFIG_DIR = configDir;

// Run tests based on framework
const framework = '${config.testing.framework}';
const args = process.argv.slice(2);

try {
  let command = '';
  
  switch (framework) {
    case 'jest':
      command = \`npx jest --config=\${configDir}/jest.config.js \${args.join(' ')}\`;
      break;
    case 'vitest':
      command = \`npx vitest --config=\${configDir}/vitest.config.js \${args.join(' ')}\`;
      break;
    case 'pytest':
      command = \`python -m pytest --rootdir=\${configDir} \${args.join(' ')}\`;
      break;
    default:
      throw new Error('Unknown test framework: ' + framework);
  }
  
  console.log('Running:', command);
  execSync(command, { stdio: 'inherit' });
  
} catch (error) {
  console.error('Test execution failed:', error.message);
  process.exit(1);
}
`;
  
  await fs.writeFile(path.join(scriptsDir, 'run-tests.js'), runTestsScript);
  await fs.chmod(path.join(scriptsDir, 'run-tests.js'), '755');
  
  // Create package.json for the config directory
  const packageJson = {
    name: `test-config-${path.basename(projectPath)}`,
    version: '1.0.0',
    private: true,
    scripts: config.scripts
  };
  
  await fs.writeFile(
    path.join(configDir, 'package.json'), 
    JSON.stringify(packageJson, null, 2)
  );
}

async function createDocumentation(configDir, config, analysis) {
  const readmeContent = `# Test Configuration

This directory contains the decoupled testing configuration for your project.

## Configuration

- **Project**: ${config.projectPath}
- **Language**: ${config.language}
- **Test Framework**: ${config.testing.framework}
- **Coverage Threshold**: ${config.testing.coverage.threshold}%

## Quick Commands

\`\`\`bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run tests for CI
npm run test:ci
\`\`\`

## Directory Structure

- \`tests/\` - Test files organized by type
- \`scripts/\` - Helper scripts for test execution
- \`config.json\` - Main configuration file

## Framework Detection

Detected frameworks: ${config.frameworks.join(', ') || 'None'}

## Test Types

Enabled test types:
${config.testing.types.map(type => `- ${type}`).join('\n')}

## Coverage

Coverage reports are generated in the \`coverage/\` directory.
Minimum threshold: ${config.testing.coverage.threshold}%

## Updating

To update the test configuration, run:
\`\`\`bash
npm run init -- --force
\`\`\`

## Troubleshooting

If tests fail to run:
1. Ensure all dependencies are installed in the target project
2. Check that the project path is correct
3. Verify the test framework is properly configured
4. Check the error logs for specific issues

Generated on: ${new Date().toLocaleString()}
`;
  
  await fs.writeFile(path.join(configDir, 'README.md'), readmeContent);
}

if (require.main === module) {
  main().catch(error => {
    console.error(chalk.red('❌ Unexpected error:'), error.message);
    process.exit(1);
  });
}

module.exports = { main };