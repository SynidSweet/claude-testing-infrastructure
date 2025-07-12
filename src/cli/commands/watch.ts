/**
 * Watch Mode Command
 *
 * Continuously monitors project files and automatically updates tests when changes are detected:
 * - Real-time file change detection
 * - Debounced incremental test generation
 * - Live console feedback and statistics
 * - Graceful shutdown handling
 */

import { Command } from 'commander';
import { chalk, ora, path, fs, logger } from '../../utils/common-imports';
import type { FileChangeEvent } from '../../utils/FileWatcher';
import { FileWatcher } from '../../utils/FileWatcher';
import type { DebouncedEvent } from '../../utils/Debouncer';
import { FileChangeDebouncer } from '../../utils/Debouncer';
import { IncrementalGenerator } from '../../state/IncrementalGenerator';
import { ProjectAnalyzer } from '../../utils/analyzer-imports';
import { ConfigurationService } from '../../config/ConfigurationService';
import { FileDiscoveryServiceFactory } from '../../services/FileDiscoveryServiceFactory';
import { type StandardCliOptions, executeCommand, type CommandContext } from '../utils';

interface WatchOptions extends StandardCliOptions {
  /** Debounce delay for file changes in milliseconds */
  debounce?: string;
  /** Disable automatic test generation */
  noGenerate?: boolean;
  /** Enable automatic test execution */
  autoRun?: boolean;
  /** Include/exclude patterns */
  include?: string[];
  exclude?: string[];
  /** Output statistics every N seconds */
  statsInterval?: string;
}

interface WatchStats {
  startTime: Date;
  totalChangeEvents: number;
  totalBatches: number;
  totalGenerations: number;
  successfulGenerations: number;
  failedGenerations: number;
  lastActivity: Date;
  filesWatched: number;
}

export const watchCommand = new Command('watch')
  .description('Watch a project for changes and update tests automatically')
  .argument('<path>', 'Path to the project to watch')
  .option('-d, --debounce <ms>', 'Debounce delay for file changes (ms)', '500')
  .option('-v, --verbose', 'Enable verbose logging')
  .option('--no-generate', 'Disable automatic test generation (watch only)')
  .option('--auto-run', 'Automatically run tests after generation')
  .option('--include <patterns...>', 'Additional file patterns to watch')
  .option('--exclude <patterns...>', 'File patterns to exclude from watching')
  .option('--stats-interval <seconds>', 'Show statistics every N seconds', '30')
  .action(async (projectPath: string, options: WatchOptions, command: Command) => {
    await executeCommand(
      projectPath,
      options,
      command,
      async (context: CommandContext) => watchModeHandler(projectPath, options, context),
      {
        commandName: 'watch',
        loadingText: 'Initializing watch mode...',
        showConfigSources: true,
        validateConfig: true,
        exitOnConfigError: false,
      }
    );
  });

async function watchModeHandler(
  projectPath: string,
  options: WatchOptions,
  context: CommandContext
): Promise<void> {
  const spinner = ora('Initializing watch mode...').start();
  let fileWatcher: FileWatcher | null = null;
  let debouncer: FileChangeDebouncer | null = null;
  let incrementalGenerator: IncrementalGenerator | null = null;

  const stats: WatchStats = {
    startTime: new Date(),
    totalChangeEvents: 0,
    totalBatches: 0,
    totalGenerations: 0,
    successfulGenerations: 0,
    failedGenerations: 0,
    lastActivity: new Date(),
    filesWatched: 0,
  };

  try {
    // Validate project path
    const resolvedPath = path.resolve(projectPath);

    try {
      const projectStats = await fs.stat(resolvedPath);
      if (!projectStats.isDirectory()) {
        throw new Error(`Not a directory: ${resolvedPath}`);
      }
    } catch (error: unknown) {
      throw new Error(`Project path does not exist: ${resolvedPath}`);
    }

    // Use configuration from context
    const configResult = context.config.config;
    const config = configResult.config;

    if (!configResult.valid) {
      logger.warn('Configuration validation warnings', {
        warnings: configResult.warnings,
      });
    }

    // Apply configuration to options
    if (config.output?.logLevel && options.verbose) {
      logger.level = 'debug';
    } else if (config.output?.logLevel) {
      logger.level = config.output.logLevel as any;
    }

    // Initialize project analysis (for future enhancements)
    spinner.text = 'Analyzing project structure...';
    const configService = new ConfigurationService({
      projectPath: resolvedPath,
    });
    await configService.loadConfiguration();
    const fileDiscovery = FileDiscoveryServiceFactory.create(configService);
    const projectAnalyzer = new ProjectAnalyzer(resolvedPath, fileDiscovery);
    await projectAnalyzer.analyzeProject();

    // Initialize incremental generator if test generation is enabled
    if (!options.noGenerate) {
      spinner.text = 'Setting up incremental test generation...';
      incrementalGenerator = new IncrementalGenerator(resolvedPath);
    }

    // Set up file watcher
    spinner.text = 'Setting up file watcher...';
    const watcherConfig: any = {
      projectPath: resolvedPath,
      verbose: options.verbose || false,
    };

    // Use configuration for include/exclude patterns
    if (options.include) {
      watcherConfig.includePatterns = options.include;
    } else if (config.include) {
      watcherConfig.includePatterns = config.include;
    }

    if (options.exclude) {
      watcherConfig.ignorePatterns = options.exclude;
    } else if (config.exclude) {
      watcherConfig.ignorePatterns = config.exclude;
    }

    fileWatcher = new FileWatcher(watcherConfig);

    // Set up debouncer for file changes
    const debounceDelay = parseInt(options.debounce || '500');
    // Check if watch configuration has a debounce setting
    const configDebounce = config.watch?.debounceMs || debounceDelay;

    debouncer = new FileChangeDebouncer({
      delay: options.debounce ? debounceDelay : configDebounce,
      maxBatchSize: 10,
      maxWaitTime: 3000,
      groupBy: 'extension', // Group by file type for better batching
      verbose: options.verbose || false,
    });

    // Set up event handlers
    setupEventHandlers(fileWatcher, debouncer, incrementalGenerator, stats, options);

    // Start watching
    spinner.text = 'Starting file watcher...';
    await fileWatcher.startWatching();

    stats.filesWatched = fileWatcher.getWatchedFiles().length;

    spinner.succeed(chalk.green('Watch mode started successfully!'));

    // Display initial status
    displayStatus(resolvedPath, stats, options);

    // Set up periodic statistics if requested
    const statsIntervalSeconds = parseInt(options.statsInterval || '30');
    let statsTimer: NodeJS.Timeout | null = null;

    if (statsIntervalSeconds > 0) {
      statsTimer = setInterval(() => {
        displayStats(stats);
      }, statsIntervalSeconds * 1000);
    }

    // Set up graceful shutdown
    const cleanup = async () => {
      console.log('\n' + chalk.yellow('Shutting down watch mode...'));

      if (statsTimer) {
        clearInterval(statsTimer);
      }

      if (debouncer) {
        debouncer.cancel();
      }

      if (fileWatcher) {
        await fileWatcher.stopWatching();
      }

      displayFinalStats(stats);
      process.exit(0);
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);

    // Keep process alive
    process.stdin.resume();
  } catch (error: unknown) {
    spinner.fail('Failed to start watch mode');
    logger.error('Watch mode initialization error:', error);

    // Cleanup on error
    if (fileWatcher) {
      await fileWatcher.stopWatching().catch(() => {});
    }

    throw error; // Re-throw to be handled by executeCLICommand wrapper
  }
}

/**
 * Set up all event handlers for watch mode
 */
function setupEventHandlers(
  fileWatcher: FileWatcher,
  debouncer: FileChangeDebouncer,
  incrementalGenerator: IncrementalGenerator | null,
  stats: WatchStats,
  options: WatchOptions
): void {
  // File watcher events
  fileWatcher.on('fileChange', (event: FileChangeEvent) => {
    stats.totalChangeEvents++;
    stats.lastActivity = new Date();

    console.log(chalk.dim(`${formatTime()} ${getChangeIcon(event.type)} ${event.relativePath}`));

    // Convert to debouncer format
    const debounceEvent = {
      type: event.type,
      filePath: event.filePath,
      timestamp: event.timestamp,
      extension: event.extension,
    };

    debouncer.debounce(debounceEvent);
  });

  fileWatcher.on('error', (error) => {
    console.log(chalk.red(`File watcher error: ${error.message}`));
    logger.error('File watcher error', { error: error.message });
  });

  // Debouncer events
  debouncer.on('debounced', async (event: DebouncedEvent<any>, groupKey: string) => {
    stats.totalBatches++;
    stats.lastActivity = new Date();

    const fileCount = event.events.length;
    const uniqueFiles = new Set(event.events.map((e) => e.filePath)).size;

    console.log(
      chalk.blue(
        `${formatTime()} 🔄 Processing ${fileCount} changes (${uniqueFiles} files) in ${groupKey}`
      )
    );

    if (!options.noGenerate && incrementalGenerator) {
      try {
        stats.totalGenerations++;

        // Generate tests for changed files
        const spinner = ora({
          text: 'Generating tests...',
          color: 'blue',
          spinner: 'dots',
        }).start();

        const result = await incrementalGenerator.generateIncremental();

        stats.successfulGenerations++;
        const testCount = result.newTests.length + result.updatedTests.length;
        spinner.succeed(chalk.green(`Generated ${testCount} tests (${result.totalTime}ms)`));

        if (testCount > 0 && options.autoRun) {
          // TODO: Add automatic test execution
          console.log(chalk.gray('  Auto-run tests feature coming soon...'));
        }
      } catch (error: unknown) {
        stats.failedGenerations++;
        console.log(chalk.red(`Test generation error: ${error}`));
        logger.error('Test generation error', { error });
      }
    }
  });
}

/**
 * Display initial status information
 */
function displayStatus(projectPath: string, stats: WatchStats, options: WatchOptions): void {
  console.log(chalk.cyan('\n👁  Watch Mode Active'));
  console.log(chalk.dim('────────────────────'));
  console.log(`📁 Project: ${chalk.white(path.basename(projectPath))}`);
  console.log(`📊 Files watched: ${chalk.white(stats.filesWatched.toString())}`);
  console.log(`⚡ Debounce: ${chalk.white(options.debounce || '500')}ms`);
  console.log(`🔧 Auto-generate: ${chalk.white(options.noGenerate ? 'disabled' : 'enabled')}`);
  console.log(`🏃 Auto-run: ${chalk.white(options.autoRun ? 'enabled' : 'disabled')}`);
  console.log(chalk.dim('\nWatching for changes... Press Ctrl+C to stop\n'));
}

/**
 * Display periodic statistics
 */
function displayStats(stats: WatchStats): void {
  const uptime = Math.floor((Date.now() - stats.startTime.getTime()) / 1000);
  const successRate =
    stats.totalGenerations > 0
      ? Math.round((stats.successfulGenerations / stats.totalGenerations) * 100)
      : 0;

  console.log(chalk.dim('\n📊 Watch Statistics'));
  console.log(chalk.dim(`   Uptime: ${formatDuration(uptime)}`));
  console.log(
    chalk.dim(`   Changes: ${stats.totalChangeEvents} events, ${stats.totalBatches} batches`)
  );
  console.log(chalk.dim(`   Generations: ${stats.totalGenerations} (${successRate}% success)`));
  console.log(chalk.dim(`   Last activity: ${formatTimeAgo(stats.lastActivity)}\n`));
}

/**
 * Display final statistics on shutdown
 */
function displayFinalStats(stats: WatchStats): void {
  const totalDuration = Date.now() - stats.startTime.getTime();

  console.log(chalk.cyan('\n📊 Final Watch Statistics'));
  console.log(chalk.dim('─────────────────────────'));
  console.log(`Total uptime: ${formatDuration(Math.floor(totalDuration / 1000))}`);
  console.log(`File changes: ${stats.totalChangeEvents}`);
  console.log(`Change batches: ${stats.totalBatches}`);
  console.log(`Test generations: ${stats.totalGenerations}`);
  console.log(
    `Success rate: ${stats.totalGenerations > 0 ? Math.round((stats.successfulGenerations / stats.totalGenerations) * 100) : 0}%`
  );
  console.log(chalk.green('\nThank you for using Claude Testing Infrastructure! 🚀\n'));
}

/**
 * Helper functions
 */
function formatTime(): string {
  return new Date().toLocaleTimeString();
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}

function getChangeIcon(type: string): string {
  switch (type) {
    case 'add':
      return '➕';
    case 'change':
      return '📝';
    case 'unlink':
      return '🗑️';
    default:
      return '📄';
  }
}
