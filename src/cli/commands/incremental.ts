/**
 * CLI command for incremental test generation
 */

import { Command } from 'commander';
import { IncrementalGenerator, ChangeDetector, HistoryManager } from '../../state';
import { logger } from '../../utils/common-imports';
import type { IncrementalUpdate, IncrementalOptions } from '../../state/IncrementalGenerator';
import { type StandardCliOptions, executeCommand, type CommandContext } from '../utils';

export interface IncrementalCommandOptions extends StandardCliOptions {
  force?: boolean;
  skipAi?: boolean;
  dryRun?: boolean;
  maxConcurrency?: string;
  costLimit?: string;
  baseline?: boolean;
  compareBaseline?: string;
  stats?: boolean;
  cleanup?: string;
}

export function createIncrementalCommand(): Command {
  const command = new Command('incremental');

  command
    .description('Perform incremental test generation based on file changes')
    .argument('<project-path>', 'Path to the project to analyze')
    .option('--force', 'Force regeneration even if no changes detected')
    .option('--skip-ai', 'Skip AI-powered logical test generation')
    .option('--dry-run', 'Show what would be generated without making changes')
    .option('--max-concurrency <number>', 'Maximum concurrent operations', '3')
    .option('--cost-limit <number>', 'Maximum cost in dollars for AI generation', '5.0')
    .option('--baseline', 'Create a new baseline after generation')
    .option('--compare-baseline <id>', 'Compare with specific baseline')
    .option('--stats', 'Show incremental generation statistics')
    .option('--cleanup <days>', 'Clean up history older than specified days')
    .action(async (projectPath: string, options: IncrementalCommandOptions, cmd: Command) => {
      await executeCommand(
        projectPath,
        options,
        cmd,
        async (context: CommandContext) => handleIncrementalCommand(projectPath, options, context),
        {
          commandName: 'incremental',
          loadingText: 'Initializing incremental test generation...',
          showConfigSources: true,
          validateConfig: true,
          exitOnConfigError: false,
        }
      );
    });

  return command;
}

async function handleIncrementalCommand(
  projectPath: string,
  options: IncrementalCommandOptions,
  context: CommandContext
): Promise<void> {
  // Use configuration from context
  const configResult = context.config.config;
  const config = configResult.config;

  if (!configResult.valid) {
    logger.warn('Configuration validation warnings', {
      warnings: configResult.warnings,
    });
  }

  // Apply configuration to logger
  if (config.output?.logLevel) {
    logger.level = config.output.logLevel;
  }

  const incrementalGenerator = new IncrementalGenerator(projectPath);
  const changeDetector = new ChangeDetector(projectPath);
  const historyManager = new HistoryManager(projectPath);

  // Handle special operations first
  if (await handleSpecialOperations(options, incrementalGenerator, historyManager)) {
    return;
  }

  // Validate incremental generation
  if (!(await validateIncrementalGeneration(incrementalGenerator, changeDetector, options))) {
    return;
  }

  // Perform incremental generation
  console.log('🔄 Starting incremental test generation...');

  // Use configuration values as defaults
  const incrementalOptions: IncrementalOptions = {
    forceRegenerate: options.force ?? false,
    skipAI: options.skipAi ?? !config.features?.aiGeneration ?? false,
    dryRun: options.dryRun ?? false,
    maxConcurrency: parseInt(options.maxConcurrency || '3', 10),
    costLimit: parseFloat(
      options.costLimit || (config.incremental?.costLimit || config.ai?.maxCost || '5.0').toString()
    ),
  };
  const result = await incrementalGenerator.generateIncremental(incrementalOptions);

  // Display and record results
  displayIncrementalResults(result);
  await recordResults(historyManager, result, options);

  console.log('\n✅ Incremental generation completed');
}

async function handleSpecialOperations(
  options: IncrementalCommandOptions,
  incrementalGenerator: IncrementalGenerator,
  historyManager: HistoryManager
): Promise<boolean> {
  if (options.stats) {
    await showIncrementalStats(incrementalGenerator, historyManager);
    return true;
  }

  if (options.cleanup) {
    const days = parseInt(options.cleanup, 10);
    await historyManager.cleanup(days);
    console.log(`✅ Cleaned up history older than ${days} days`);
    return true;
  }

  if (options.compareBaseline) {
    await compareWithBaseline(historyManager, options.compareBaseline);
    return true;
  }

  return false;
}

async function validateIncrementalGeneration(
  incrementalGenerator: IncrementalGenerator,
  changeDetector: ChangeDetector,
  options: IncrementalCommandOptions
): Promise<boolean> {
  const shouldUseIncremental = await incrementalGenerator.shouldUseIncremental();
  if (!shouldUseIncremental && !options.force) {
    console.log('💡 Incremental generation not recommended - too many changes detected');
    console.log('   Consider using full generation or use --force to proceed');
    return false;
  }

  const isGitRepo = await changeDetector.isGitRepository();
  if (!isGitRepo) {
    console.log('⚠️  Project is not in a Git repository');
    console.log('   Incremental features work best with Git-based change detection');
  }

  return true;
}

function displayIncrementalResults(result: IncrementalUpdate): void {
  console.log('\n📊 Incremental Generation Results:');
  console.log(`   Changed files: ${result.changedFiles.length}`);
  console.log(`   New tests: ${result.newTests.length}`);
  console.log(`   Updated tests: ${result.updatedTests.length}`);
  console.log(`   Deleted tests: ${result.deletedTests.length}`);
  console.log(`   Skipped files: ${result.skippedFiles.length}`);
  console.log(`   Total time: ${result.totalTime}ms`);
  console.log(`   Estimated cost: $${result.costEstimate.toFixed(3)}`);

  if (result.skippedFiles.length > 0) {
    console.log('\n⚠️  Skipped files:');
    result.skippedFiles.forEach((file) => console.log(`   - ${file}`));
  }
}

async function recordResults(
  historyManager: HistoryManager,
  result: IncrementalUpdate,
  options: IncrementalCommandOptions
): Promise<void> {
  if (!options.dryRun) {
    await historyManager.recordEntry({
      operation: 'update',
      summary: {
        filesChanged: result.changedFiles.length,
        testsGenerated: result.newTests.length,
        testsUpdated: result.updatedTests.length,
        testsDeleted: result.deletedTests.length,
        costIncurred: result.costEstimate,
      },
      details: {
        changedFiles: result.changedFiles,
        generatedTests: [...result.newTests, ...result.updatedTests],
        ...(result.skippedFiles.length > 0 && {
          errors: [`Skipped ${result.skippedFiles.length} files`],
        }),
      },
    });
  }

  if (options.baseline && !options.dryRun) {
    const description = `Post-incremental generation - ${new Date().toISOString()}`;
    const baselineId = await historyManager.createBaseline(description);
    console.log(`\n📌 Created baseline: ${baselineId}`);
  }
}

async function showIncrementalStats(
  incrementalGenerator: IncrementalGenerator,
  historyManager: HistoryManager
): Promise<void> {
  console.log('📈 Incremental Testing Statistics\n');

  // Get basic stats
  const stats = await incrementalGenerator.getIncrementalStats();
  console.log('📋 Current State:');
  console.log(`   Files tracked: ${stats.filesTracked}`);
  console.log(`   Tests generated: ${stats.testsGenerated}`);
  console.log(`   Last update: ${stats.lastUpdate}`);
  console.log(`   Changes since last update: ${stats.changesSinceLastUpdate}`);

  // Get history stats
  const historyStats = await historyManager.getStats();
  console.log('\n📊 Historical Data:');
  console.log(`   Total generations: ${historyStats.totalGenerations}`);
  console.log(`   Total cost: $${historyStats.totalCost.toFixed(3)}`);
  console.log(`   Average cost: $${historyStats.averageCost.toFixed(3)}`);
  console.log(`   Error rate: ${(historyStats.errorRate * 100).toFixed(1)}%`);

  if (historyStats.mostActiveFiles.length > 0) {
    console.log('\n🔥 Most Active Files:');
    historyStats.mostActiveFiles.slice(0, 5).forEach((file) => {
      console.log(`   ${file.path} (${file.updates} updates)`);
    });
  }

  // Get recent entries
  const recentEntries = await historyManager.getRecentEntries(5);
  if (recentEntries.length > 0) {
    console.log('\n🕐 Recent Activity:');
    recentEntries.forEach((entry) => {
      const date = new Date(entry.timestamp).toLocaleDateString();
      const operation = entry.operation;
      const files = entry.summary.filesChanged;
      console.log(`   ${date} - ${operation} (${files} files)`);
    });
  }
}

async function compareWithBaseline(
  historyManager: HistoryManager,
  baselineId: string
): Promise<void> {
  console.log(`🔍 Comparing with baseline: ${baselineId}\n`);

  try {
    const comparison = await historyManager.compareWithBaseline(baselineId);

    console.log('📊 Baseline Comparison:');
    console.log(`   Baseline date: ${new Date(comparison.baselineDate).toLocaleDateString()}`);
    console.log('\n📋 Current State:');
    console.log(`   Files: ${comparison.currentState.files}`);
    console.log(`   Tests: ${comparison.currentState.tests}`);
    console.log(`   Coverage: ${comparison.currentState.coverage.toFixed(1)}%`);

    console.log('\n📈 Changes Since Baseline:');
    console.log(`   Files added: ${comparison.changes.filesAdded}`);
    console.log(`   Files modified: ${comparison.changes.filesModified}`);
    console.log(`   Files deleted: ${comparison.changes.filesDeleted}`);
    console.log(`   Tests added: ${comparison.changes.testsAdded}`);
    console.log(`   Tests updated: ${comparison.changes.testsUpdated}`);
    console.log(`   Tests deleted: ${comparison.changes.testsDeleted}`);

    if (comparison.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      comparison.recommendations.forEach((rec) => console.log(`   • ${rec}`));
    }
  } catch (error) {
    console.error(
      `❌ Failed to compare with baseline: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
