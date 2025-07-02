#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { version } from '../../package.json';
import { logger } from '../utils/logger';
import { analyzeCommand } from './commands/analyze';
import { testCommand } from './commands/test';
import { runCommand } from './commands/run';
import { watchCommand } from './commands/watch';
import { analyzeGapsCommand } from './commands/analyze-gaps';
import { generateLogicalCommand } from './commands/generate-logical';
import { generateLogicalBatchCommand } from './commands/generate-logical-batch';
import { testAICommand } from './commands/test-ai';
import { createIncrementalCommand } from './commands/incremental';
import { initializeLanguageSpecificGenerators } from '../generators/registerLanguageGenerators';

// Initialize language-specific generators
initializeLanguageSpecificGenerators();

const program = new Command();

program
  .name('claude-testing')
  .description('AI-powered decoupled testing infrastructure')
  .version(version)
  .option('-d, --debug', 'Enable debug logging')
  .option('-q, --quiet', 'Suppress non-essential output')
  .option('--show-config-sources', 'Show configuration sources and resolved values')
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
  .option('-c, --config <path>', 'Path to configuration file')
  .option('-o, --output <path>', 'Output path for analysis results')
  .option('--format <format>', 'Output format (json|markdown|console)', 'console')
  .option('-v, --verbose', 'Show detailed analysis information')
  .option('--validate-config', 'Validate .claude-testing.config.json configuration')
  .action((projectPath, options, command) => analyzeCommand(projectPath, options, command));

// Test command
program
  .command('test')
  .alias('generate')
  .description('Generate tests for a project')
  .argument('<path>', 'Path to the project to test')
  .option('-c, --config <path>', 'Path to configuration file')
  .option('--only-structural', 'Generate only structural tests')
  .option('--only-logical', 'Generate only logical tests (requires AI)')
  .option('--coverage', 'Generate coverage report')
  .option('--update', 'Update existing tests based on changes')
  .option('--force', 'Skip validation checks (e.g., test-to-source ratio)')
  .option('--max-ratio <number>', 'Override maximum test-to-source file ratio (default: 10)', parseFloat)
  .option('--enable-chunking', 'Enable file chunking for large files (default: true)')
  .option('--chunk-size <size>', 'Maximum tokens per chunk (default: 3500)', parseInt)
  .option('--dry-run', 'Preview test generation without creating files')
  .option('-v, --verbose', 'Show detailed test generation information')
  .action((projectPath, options, command) => testCommand(projectPath, options, command));

// Run command
program
  .command('run')
  .description('Run generated tests for a project')
  .argument('<path>', 'Path to the project with generated tests')
  .option('-c, --config <path>', 'Path to configuration file')
  .option('-f, --framework <framework>', 'Test framework to use (jest, pytest)')
  .option('--coverage', 'Generate coverage report')
  .option('--watch', 'Run tests in watch mode')
  .option('--junit', 'Generate JUnit XML reports')
  .option(
    '--threshold <threshold>',
    'Coverage threshold (e.g., "80" or "statements:80,branches:70")'
  )
  .option('-v, --verbose', 'Show detailed test execution information')
  .action((projectPath, options, command) => runCommand(projectPath, options, command));

// Add the watch command
program.addCommand(watchCommand);

// Add the analyze-gaps command
program.addCommand(analyzeGapsCommand);

// Add the generate-logical command
program.addCommand(generateLogicalCommand);

// Add the generate-logical-batch command
program.addCommand(generateLogicalBatchCommand);

// Add the test-ai command
program.addCommand(testAICommand);

// Add the incremental command
program.addCommand(createIncrementalCommand());

// Error handling
program.exitOverride();

try {
  program.parse();
} catch (error: any) {
  if (error.code === 'commander.unknownCommand') {
    console.error(chalk.red(`Unknown command: ${error.command || 'undefined'}`));
    console.log('\nAvailable commands:');
    console.log('  analyze         - Analyze a project');
    console.log('  test            - Generate tests');
    console.log('  test-ai         - Complete AI-enhanced testing workflow');
    console.log('  run             - Run generated tests');
    console.log('  watch           - Watch for changes');
    console.log('  analyze-gaps    - Analyze test gaps for AI generation');
    console.log('  generate-logical - Generate logical tests using AI');
    console.log('  generate-logical-batch - Generate logical tests in configurable batches');
    console.log('  incremental     - Perform incremental test generation');
    console.log('\nRun claude-testing --help for more information');
  } else if (error.code === 'commander.help' || error.code === 'commander.helpDisplayed') {
    // Help was displayed, exit normally
    process.exit(0);
  } else if (error.code === 'commander.version') {
    // Version was displayed, exit normally
    process.exit(0);
  } else {
    logger.error('Unexpected error:', error);
    process.exit(1);
  }
}
