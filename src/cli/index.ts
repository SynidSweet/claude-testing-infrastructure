#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { version } from '../../package.json';
import { logger } from '@utils/logger';
import { analyzeCommand } from './commands/analyze';
import { testCommand } from './commands/test';
import { watchCommand } from './commands/watch';

const program = new Command();

program
  .name('claude-testing')
  .description('AI-powered decoupled testing infrastructure')
  .version(version)
  .option('-d, --debug', 'Enable debug logging')
  .option('-q, --quiet', 'Suppress non-essential output')
  .hook('preAction', (thisCommand) => {
    const options = thisCommand.opts();
    if (options.debug) {
      logger.level = 'debug';
    } else if (options.quiet) {
      logger.level = 'error';
    }
  });

// Analyze command
program
  .command('analyze')
  .description('Analyze a project and generate test recommendations')
  .argument('<path>', 'Path to the project to analyze')
  .option('-o, --output <path>', 'Output path for analysis results')
  .option('--format <format>', 'Output format (json|html|markdown)', 'json')
  .action(analyzeCommand);

// Test command
program
  .command('test')
  .alias('generate')
  .description('Generate and run tests for a project')
  .argument('<path>', 'Path to the project to test')
  .option('-c, --config <path>', 'Path to configuration file')
  .option('--only-structural', 'Generate only structural tests')
  .option('--only-logical', 'Generate only logical tests (requires AI)')
  .option('--coverage', 'Generate coverage report')
  .option('--update', 'Update existing tests based on changes')
  .action(testCommand);

// Watch command
program
  .command('watch')
  .description('Watch a project for changes and update tests automatically')
  .argument('<path>', 'Path to the project to watch')
  .option('-c, --config <path>', 'Path to configuration file')
  .action(watchCommand);

// Error handling
program.exitOverride();

try {
  program.parse();
} catch (error: any) {
  if (error.code === 'commander.unknownCommand') {
    console.error(chalk.red(`Unknown command: ${error.command || 'undefined'}`));
    console.log('\nAvailable commands:');
    console.log('  analyze  - Analyze a project');
    console.log('  test     - Generate and run tests');
    console.log('  watch    - Watch for changes');
    console.log('\nRun claude-testing --help for more information');
  } else if (error.code === 'commander.help') {
    // Help was displayed, exit normally
    process.exit(0);
  } else {
    logger.error('Unexpected error:', error);
    process.exit(1);
  }
}