#!/usr/bin/env node

/**
 * test-ai command: Complete AI-enhanced testing workflow
 * 
 * TEMPORARILY DISABLED due to compilation issues in AIEnhancedTestingWorkflow
 */

import { Command } from 'commander';
import chalk from 'chalk';

export const testAICommand = new Command()
  .name('test-ai')
  .description('Complete AI-enhanced testing workflow (TEMPORARILY DISABLED)')
  .argument('<projectPath>', 'Path to the project to test')
  .option('-m, --model <model>', 'Claude model to use (opus, sonnet, haiku)', 'sonnet')
  .option('-c, --concurrent <number>', 'Max concurrent Claude processes', '3')
  .option('-b, --budget <amount>', 'Maximum budget in USD')
  .option('--min-complexity <number>', 'Minimum complexity for AI generation', '5')
  .option('--no-ai', 'Skip AI test generation')
  .option('--no-run', 'Skip test execution')
  .option('--no-coverage', 'Skip coverage reporting')
  .option('-o, --output <path>', 'Output directory for reports')
  .option('-v, --verbose', 'Enable verbose logging')
  .action(async (_projectPath: string, _options: any) => {
    console.error(chalk.red('AI-enhanced testing workflow is temporarily disabled due to compilation issues.'));
    console.log(chalk.yellow('Please use the individual commands instead:'));
    console.log('  npx claude-testing analyze <project>');
    console.log('  npx claude-testing test <project>');
    console.log('  npx claude-testing run <project> --coverage');
    console.log('  npx claude-testing analyze-gaps <project>');
    console.log('  npx claude-testing generate-logical <project>');
    process.exit(1);
  });