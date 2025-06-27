#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');

const projectPath = '/code/personal/claude-testing/examples/decoupled-demo/sample-react-app';
const configDir = '/code/personal/claude-testing/examples/decoupled-demo/test-config';

// Change to project directory
process.chdir(projectPath);

// Set test environment
process.env.NODE_ENV = 'test';
process.env.TEST_CONFIG_DIR = configDir;

// Run tests based on framework
const framework = 'jest';
const args = process.argv.slice(2);

try {
  let command = '';
  
  switch (framework) {
    case 'jest':
      command = `npx jest --config=${configDir}/jest.config.js ${args.join(' ')}`;
      break;
    case 'vitest':
      command = `npx vitest --config=${configDir}/vitest.config.js ${args.join(' ')}`;
      break;
    case 'pytest':
      command = `python -m pytest --rootdir=${configDir} ${args.join(' ')}`;
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
