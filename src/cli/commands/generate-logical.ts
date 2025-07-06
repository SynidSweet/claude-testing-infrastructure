#!/usr/bin/env node

/**
 * generate-logical command: AI-powered logical test generation
 *
 * Uses Claude to generate comprehensive logical tests based on gap analysis
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
  AITaskPreparation,
  ClaudeOrchestrator,
  CostEstimator,
  BatchedLogicalTestGenerator,
} from '../../ai';
import { logger } from '../../utils/logger';
import { loadCommandConfig, ConfigurationService } from '../../config/ConfigurationService';
import { FileDiscoveryServiceFactory } from '../../services/FileDiscoveryServiceFactory';

export const generateLogicalCommand = new Command()
  .name('generate-logical')
  .description('Generate logical tests using AI based on gap analysis')
  .argument('<projectPath>', 'Path to the project to generate tests for')
  .option('-g, --gap-report <path>', 'Path to existing gap analysis report')
  .option('-m, --model <model>', 'Claude model to use (opus, sonnet, haiku)', 'sonnet')
  .option('-c, --concurrent <number>', 'Max concurrent Claude processes', '3')
  .option('-b, --budget <amount>', 'Maximum budget in USD')
  .option('--min-complexity <number>', 'Minimum complexity for AI generation', '5')
  .option('--timeout <seconds>', 'Timeout per AI task in seconds (default: 900)', '900')
  .option('--batch-mode', 'Enable batched processing for large projects')
  .option('--batch-size <number>', 'Batch size when using batch mode (default: 10)', '10')
  .option('--dry-run', 'Show what would be generated without executing')
  .option('-o, --output <path>', 'Output directory for reports')
  .option('-v, --verbose', 'Enable verbose logging')
  .action(async (projectPath: string, options: any) => {
    const spinner = ora('Initializing AI test generation...').start();

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
          dryRun: options.dryRun,
        },
      });

      if (!configResult.valid) {
        logger.warn('Configuration validation warnings', {
          warnings: configResult.warnings,
        });
      }

      const config = configResult.config;

      // Apply configuration to logger
      if (
        options.verbose ||
        config.output?.logLevel === 'debug' ||
        config.output?.logLevel === 'verbose'
      ) {
        logger.level = 'debug';
      } else if (config.output?.logLevel) {
        logger.level = config.output.logLevel as any;
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
        const configService = new ConfigurationService({ projectPath: absoluteProjectPath });
        await configService.loadConfiguration();
        const fileDiscovery = FileDiscoveryServiceFactory.create(configService);
        const projectAnalyzer = new ProjectAnalyzer(absoluteProjectPath, fileDiscovery);
        const projectAnalysis = await projectAnalyzer.analyzeProject();

        spinner.text = 'Generating structural tests...';
        const testConfig: TestGeneratorConfig = {
          projectPath: absoluteProjectPath,
          outputPath: path.join(absoluteProjectPath, '.claude-testing'),
          testFramework:
            config.testFramework ||
            (projectAnalysis.languages[0]?.name === 'python' ? 'pytest' : 'jest'),
          options: {},
          patterns: {
            include: config.include,
            exclude: config.exclude,
          },
        };

        const structuralGenerator = new StructuralTestGenerator(
          testConfig,
          projectAnalysis,
          {},
          fileDiscovery
        );
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

      spinner.succeed(`Found ${gapReport.gaps.length} files requiring logical tests`);

      // Step 2: Prepare AI tasks
      spinner.start('Preparing AI tasks...');
      const taskPrep = new AITaskPreparation({
        model: options.model || config.aiModel || 'sonnet', // Use CLI arg, then config, then default
        maxConcurrentTasks: parseInt(options.concurrent || '3'),
        minComplexityForAI: parseInt(options.minComplexity || '5'),
      });

      let batch = await taskPrep.prepareTasks(gapReport);

      // Step 3: Cost estimation and budget optimization
      spinner.text = 'Estimating costs...';
      const estimator = new CostEstimator(options.model);
      const costReport = estimator.estimateReportCost(gapReport);

      console.log('\n' + chalk.blue('Cost Estimation:'));
      console.log(`Total estimated cost: ${chalk.green(`$${costReport.totalCost.toFixed(2)}`)}`);
      console.log('By complexity:');
      Object.entries(costReport.byComplexity).forEach(([level, data]) => {
        if (data.count > 0) {
          console.log(`  ${level}: ${data.count} files, $${data.cost.toFixed(2)}`);
        }
      });

      // Apply budget if specified
      if (options.budget) {
        const budget = parseFloat(options.budget);
        const optimization = estimator.optimizeForBudget(gapReport, budget);

        if (optimization.tasksExcluded > 0) {
          console.log(
            chalk.yellow(
              `\nBudget optimization: ${optimization.tasksIncluded} tasks included, ${optimization.tasksExcluded} excluded`
            )
          );
        }

        // Filter batch based on optimization
        batch.tasks = batch.tasks.filter((task) => {
          const allocation = optimization.allocations.find((a) => a.file === task.sourceFile);
          return allocation?.includeInBatch;
        });

        batch.totalEstimatedCost = optimization.totalEstimatedCost;
      }

      // Handle batch mode
      if (options.batchMode) {
        const batchSize = parseInt(options.batchSize) || 10;
        const batchGenerator = new BatchedLogicalTestGenerator(batchSize, taskPrep);

        // Validate batching benefit
        const validation = batchGenerator.validateBatchingBenefit(gapReport);
        if (!validation.beneficial) {
          console.log(chalk.yellow(`\nBatch mode note: ${validation.reason}`));
          console.log(chalk.yellow('Proceeding with regular processing...'));
        } else {
          console.log(
            chalk.blue(
              `\nBatch mode: Will process ${Math.ceil(gapReport.gaps.length / batchSize)} batches of ${batchSize} tasks each`
            )
          );
          console.log(
            chalk.yellow('Use generate-logical-batch command for better iterative control')
          );
        }
      }

      // Show recommendations
      if (costReport.recommendations.length > 0) {
        console.log('\n' + chalk.blue('Recommendations:'));
        costReport.recommendations.forEach((rec) => {
          console.log(`  • ${rec}`);
        });
      }

      // Dry run mode - just show what would be done
      if (options.dryRun) {
        spinner.succeed('Dry run complete');

        console.log('\n' + chalk.blue('Tasks to be generated:'));
        const summary = taskPrep.generateSummary(batch);
        console.log(summary);

        // Save batch for later use
        if (options.output) {
          const batchPath = path.join(options.output, 'ai-batch.json');
          await fs.mkdir(options.output, { recursive: true });
          await taskPrep.saveBatch(batch, batchPath);
          console.log(`\nBatch saved to: ${batchPath}`);
        }

        return;
      }

      // Step 4: Execute AI generation
      console.log('\n' + chalk.blue('Starting AI test generation...'));

      // Check if Claude Code CLI is available
      try {
        const { execSync } = require('child_process');
        execSync('claude --version', { stdio: 'ignore' });
      } catch {
        throw new Error(
          'Claude Code CLI not found. Please install it first: npm install -g @anthropic-ai/claude-code'
        );
      }

      const timeoutMs = parseInt(options.timeout) * 1000;
      const orchestrator = new ClaudeOrchestrator({
        maxConcurrent: parseInt(options.concurrent) || 3,
        model: options.model, // Use alias directly (opus, sonnet, haiku)
        fallbackModel: options.model === 'opus' ? 'sonnet' : 'haiku',
        timeout: timeoutMs, // Convert seconds to milliseconds
        verbose: options.verbose,
      });

      if (options.verbose) {
        console.log(chalk.gray(`Using ${timeoutMs / 1000}s timeout per AI task`));
      }

      // Set up progress tracking
      let completed = 0;
      const total = batch.tasks.length;

      orchestrator.on('task:complete', ({ task }) => {
        completed++;
        spinner.text = `Generating tests... (${completed}/${total}) - ${path.basename(task.sourceFile)}`;
      });

      orchestrator.on('task:failed', ({ task, error }) => {
        logger.error(`Failed to generate tests for ${task.sourceFile}: ${error}`);
      });

      // Process the batch
      spinner.text = `Generating tests... (0/${total})`;
      const results = await orchestrator.processBatch(batch);

      // Step 5: Generate report
      spinner.succeed(`Generated ${results.filter((r) => r.success).length} test files`);

      const report = orchestrator.generateReport();
      console.log('\n' + report);

      // Save reports
      if (options.output) {
        const outputDir = path.resolve(options.output);
        await fs.mkdir(outputDir, { recursive: true });

        // Save execution report
        const reportPath = path.join(outputDir, 'ai-generation-report.md');
        await fs.writeFile(reportPath, report, 'utf-8');

        // Save detailed results
        const resultsPath = path.join(outputDir, 'ai-generation-results.json');
        await fs.writeFile(
          resultsPath,
          JSON.stringify(
            {
              timestamp: new Date().toISOString(),
              batch,
              results,
              stats: (orchestrator as any).stats,
            },
            null,
            2
          ),
          'utf-8'
        );

        console.log(`\nReports saved to: ${outputDir}`);
      }

      // Track usage for future reporting
      const orchStats = (orchestrator as any).stats;
      estimator.trackUsage(
        absoluteProjectPath,
        options.model,
        orchStats.totalTokensUsed,
        orchStats.totalCost
      );

      // Success summary
      console.log('\n' + chalk.green('✓ AI test generation complete!'));
      console.log(`  Total cost: $${orchStats.totalCost.toFixed(2)}`);
      console.log(`  Tokens used: ${orchStats.totalTokensUsed.toLocaleString()}`);
      console.log(
        `  Duration: ${((orchStats.endTime!.getTime() - orchStats.startTime.getTime()) / 1000).toFixed(1)}s`
      );
    } catch (error) {
      spinner.fail('AI test generation failed');
      logger.error('Error:', error);
      process.exit(1);
    }
  });

// Support direct execution
if (require.main === module) {
  generateLogicalCommand.parse(process.argv);
}
