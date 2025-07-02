#!/usr/bin/env node

/**
 * generate-logical-batch command: Iterative batched AI test generation
 * 
 * Processes AI test generation in configurable batches with state persistence
 */

import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs/promises';
import chalk from 'chalk';
import ora from 'ora';
import { TestGapAnalyzer } from '../../analyzers/TestGapAnalyzer';
import { ProjectAnalyzer } from '../../analyzers/ProjectAnalyzer';
import { StructuralTestGenerator } from '../../generators/StructuralTestGenerator';
import { TestGeneratorConfig } from '../../generators/TestGenerator';
import { 
  AITaskPreparation
} from '../../ai';
import { BatchedLogicalTestGenerator, type BatchConfig } from '../../ai/BatchedLogicalTestGenerator';
import { logger } from '../../utils/logger';
import { loadCommandConfig } from '../../config/ConfigurationService';

export const generateLogicalBatchCommand = new Command()
  .name('generate-logical-batch')
  .description('Generate logical tests in configurable batches with state persistence')
  .argument('<projectPath>', 'Path to the project to generate tests for')
  .option('-g, --gap-report <path>', 'Path to existing gap analysis report')
  .option('-b, --batch-size <number>', 'Number of tests to generate per batch (default: 10)', '10')
  .option('-m, --model <model>', 'Claude model to use (opus, sonnet, haiku)', 'sonnet')
  .option('-c, --concurrent <number>', 'Max concurrent Claude processes', '3')
  .option('--cost-limit <amount>', 'Maximum cost per batch in USD')
  .option('--min-complexity <number>', 'Minimum complexity for AI generation', '5')
  .option('--timeout <seconds>', 'Timeout per AI task in seconds (default: 900)', '900')
  .option('--resume', 'Resume from previous batch state')
  .option('--dry-run', 'Show what batches would be created without executing')
  .option('--stats', 'Show current progress statistics and exit')
  .option('--clean', 'Clean up batch state and start fresh')
  .option('-o, --output <path>', 'Output directory for reports')
  .option('-v, --verbose', 'Enable verbose logging')
  .action(async (projectPath: string, options: any) => {
    const spinner = ora('Initializing batched AI test generation...').start();
    
    try {
      // Resolve paths
      const absoluteProjectPath = path.resolve(projectPath);
      
      // Validate project exists
      const projectStats = await fs.stat(absoluteProjectPath);
      if (!projectStats.isDirectory()) {
        throw new Error(`Not a directory: ${absoluteProjectPath}`);
      }

      // Load configuration using ConfigurationService
      spinner.text = 'Loading configuration...';
      const configResult = await loadCommandConfig(absoluteProjectPath, {
        cliArgs: {
          verbose: options.verbose,
          aiModel: options.model,
          dryRun: options.dryRun
        }
      });
      
      if (!configResult.valid) {
        logger.warn('Configuration validation warnings', { 
          warnings: configResult.warnings 
        });
      }
      
      const config = configResult.config;
      
      // Apply configuration to logger
      if (options.verbose || config.output?.logLevel === 'debug' || config.output?.logLevel === 'verbose') {
        logger.level = 'debug';
      } else if (config.output?.logLevel) {
        logger.level = config.output.logLevel as any;
      }

      // Parse and validate options with config defaults
      const batchSize = parseInt(options.batchSize || '10');
      if (isNaN(batchSize) || batchSize < 1 || batchSize > 50) {
        throw new Error('Batch size must be a number between 1 and 50');
      }

      // Initialize components with configuration
      const taskPrep = new AITaskPreparation({
        model: options.model || config.aiModel || 'sonnet',
        maxConcurrentTasks: parseInt(options.concurrent || '3'),
        minComplexityForAI: parseInt(options.minComplexity || '5')
      });

      const batchGenerator = new BatchedLogicalTestGenerator(batchSize, taskPrep);

      // Handle clean option
      if (options.clean) {
        spinner.text = 'Cleaning batch state...';
        await batchGenerator.cleanupBatchState(absoluteProjectPath);
        spinner.succeed('Batch state cleaned');
        return;
      }

      // Handle stats option
      if (options.stats) {
        spinner.text = 'Loading progress statistics...';
        const report = await batchGenerator.getProgressReport(absoluteProjectPath);
        spinner.stop();
        
        if (report) {
          console.log(report);
        } else {
          console.log(chalk.yellow('No batch processing in progress'));
        }
        return;
      }

      // Check for Claude CLI
      try {
        const { execSync } = require('child_process');
        execSync('claude --version', { stdio: 'ignore' });
      } catch {
        throw new Error('Claude Code CLI not found. Please install it first: npm install -g @anthropic-ai/claude-code');
      }

      // Step 1: Get or generate gap analysis
      spinner.text = 'Loading gap analysis...';
      let gapReport;
      
      if (options.gapReport) {
        // Load existing report
        const reportContent = await fs.readFile(options.gapReport, 'utf-8');
        gapReport = JSON.parse(reportContent);
      } else {
        // Generate new gap analysis
        spinner.text = 'Analyzing project structure...';
        const projectAnalyzer = new ProjectAnalyzer(absoluteProjectPath);
        const projectAnalysis = await projectAnalyzer.analyzeProject();
        
        spinner.text = 'Generating structural tests...';
        const testConfig: TestGeneratorConfig = {
          projectPath: absoluteProjectPath,
          outputPath: path.join(absoluteProjectPath, '.claude-testing'),
          testFramework: projectAnalysis.languages[0]?.name === 'python' ? 'pytest' : 'jest',
          options: {}
        };
        
        const structuralGenerator = new StructuralTestGenerator(testConfig, projectAnalysis);
        const generationResult = await structuralGenerator.generateAllTests();
        
        spinner.text = 'Analyzing test gaps...';
        const analyzer = new TestGapAnalyzer(projectAnalysis);
        gapReport = await analyzer.analyzeTestGaps(generationResult);
      }

      // Check if we have any gaps
      if (gapReport.gaps.length === 0) {
        spinner.succeed('No test gaps found that require AI generation!');
        return;
      }

      // Validate batching benefit
      const validation = batchGenerator.validateBatchingBenefit(gapReport);
      if (!validation.beneficial && !options.dryRun) {
        spinner.info(validation.reason);
        console.log(chalk.yellow('Consider using the regular generate-logical command instead'));
        if (!options.resume) {
          return;
        }
      }

      spinner.succeed(`Found ${gapReport.gaps.length} files requiring logical tests`);

      // Step 2: Handle resume or initialize state
      let progress;
      if (options.resume) {
        progress = await batchGenerator.loadBatchState(absoluteProjectPath);
        if (!progress) {
          throw new Error('No previous batch state found. Remove --resume flag to start fresh.');
        }
        console.log(chalk.blue(`Resuming from batch ${progress.nextBatchIndex}/${progress.totalBatches}`));
      } else {
        // Check if state already exists
        const existingProgress = await batchGenerator.loadBatchState(absoluteProjectPath);
        if (existingProgress) {
          throw new Error('Batch processing already in progress. Use --resume to continue or --clean to start fresh.');
        }

        // Initialize new batch processing
        const config: BatchConfig = {
          batchSize,
          model: options.model,
          maxConcurrent: parseInt(options.concurrent) || 3,
          timeout: parseInt(options.timeout) * 1000,
          minComplexity: parseInt(options.minComplexity) || 5
        };

        if (options.costLimit) {
          config.costLimit = parseFloat(options.costLimit);
        }

        progress = await batchGenerator.initializeBatchState(absoluteProjectPath, gapReport, config);
      }

      // Step 3: Get next batch to process
      const nextBatch = await batchGenerator.getNextBatch(absoluteProjectPath, gapReport);
      if (!nextBatch) {
        spinner.succeed('All batches have been completed!');
        
        // Show final report
        const finalReport = await batchGenerator.getProgressReport(absoluteProjectPath);
        if (finalReport) {
          console.log('\n' + finalReport);
        }
        
        // Clean up state
        await batchGenerator.cleanupBatchState(absoluteProjectPath);
        return;
      }

      // Step 4: Show batch information
      console.log('\n' + chalk.blue('Batch Information:'));
      console.log(`Batch ${nextBatch.index + 1}/${progress.totalBatches} (${nextBatch.tasks.length} tasks)`);
      console.log(`Estimated cost: ${chalk.green(`$${nextBatch.estimatedCost.toFixed(2)}`)}`);
      console.log(`Estimated tokens: ${nextBatch.estimatedTokens.toLocaleString()}`);

      // Check cost limit
      if (progress.config.costLimit && nextBatch.estimatedCost > progress.config.costLimit) {
        throw new Error(
          `Batch estimated cost ($${nextBatch.estimatedCost.toFixed(2)}) exceeds limit ($${progress.config.costLimit.toFixed(2)})`
        );
      }

      // Dry run mode - just show what would be done
      if (options.dryRun) {
        spinner.succeed('Dry run complete');
        
        console.log('\n' + chalk.blue('Next batch would process:'));
        nextBatch.tasks.forEach((task, index) => {
          console.log(`  ${index + 1}. ${path.basename(task.sourceFile)} ($${task.estimatedCost.toFixed(3)})`);
        });

        console.log('\n' + chalk.blue('Remaining batches:'));
        const remainingBatches = progress.totalBatches - progress.nextBatchIndex;
        console.log(`  ${remainingBatches} batches remaining after this one`);
        
        return;
      }

      // Step 5: Execute the batch
      console.log('\n' + chalk.blue('Starting AI test generation for current batch...'));
      
      spinner.start(`Processing batch ${nextBatch.index + 1}/${progress.totalBatches}...`);
      
      const batchResult = await batchGenerator.generateBatch(
        gapReport,
        nextBatch.index,
        progress.config
      );

      // Step 6: Update progress and show results
      const updatedProgress = await batchGenerator.updateBatchState(absoluteProjectPath, batchResult);
      
      spinner.succeed(`Batch ${nextBatch.index + 1} completed`);
      
      // Show batch results
      console.log('\n' + chalk.blue('Batch Results:'));
      console.log(`✓ Successful: ${batchResult.stats.completed}`);
      console.log(`✗ Failed: ${batchResult.stats.failed}`);
      console.log(`💰 Cost: $${batchResult.stats.totalCost.toFixed(2)}`);
      console.log(`⏱️  Duration: ${(batchResult.stats.duration / 1000).toFixed(1)}s`);

      // Show overall progress
      const completionPercentage = ((updatedProgress.completedBatches / updatedProgress.totalBatches) * 100).toFixed(1);
      console.log('\n' + chalk.blue('Overall Progress:'));
      console.log(`Batches: ${updatedProgress.completedBatches}/${updatedProgress.totalBatches} (${completionPercentage}%)`);
      console.log(`Total cost so far: $${updatedProgress.actualCostSoFar.toFixed(2)}`);

      // Show next steps
      const remainingBatches = updatedProgress.totalBatches - updatedProgress.completedBatches;
      if (remainingBatches > 0) {
        console.log('\n' + chalk.green(`Next: Run the same command to process the next batch (${remainingBatches} remaining)`));
      } else {
        console.log('\n' + chalk.green('🎉 All batches completed! AI test generation is complete.'));
        await batchGenerator.cleanupBatchState(absoluteProjectPath);
      }

      // Save detailed results if output specified
      if (options.output) {
        const outputDir = path.resolve(options.output);
        await fs.mkdir(outputDir, { recursive: true });

        const batchReportPath = path.join(outputDir, `batch-${nextBatch.index + 1}-report.json`);
        await fs.writeFile(batchReportPath, JSON.stringify({
          timestamp: new Date().toISOString(),
          batchIndex: nextBatch.index,
          batchResult,
          progress: updatedProgress
        }, null, 2), 'utf-8');

        console.log(`\nBatch report saved to: ${batchReportPath}`);
      }

    } catch (error) {
      spinner.fail('Batched AI test generation failed');
      logger.error('Error:', error);
      process.exit(1);
    }
  });

// Support direct execution
if (require.main === module) {
  generateLogicalBatchCommand.parse(process.argv);
}