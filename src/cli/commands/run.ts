import { chalk, ora, fs, path, logger } from '../../utils/common-imports';
import { ProjectAnalyzer } from '../../utils/analyzer-imports';
import type { TestRunnerConfig, TestResult, TestFailure } from '../../runners';
import { TestRunnerFactory } from '../../runners';
import { handleValidation } from '../../utils/error-handling';
import { ConfigurationService } from '../../config/ConfigurationService';
import { displayConfigurationSources } from '../../utils/config-display';
import { FileDiscoveryServiceFactory } from '../../services/FileDiscoveryServiceFactory';
import type { ProjectAnalysis } from '../../analyzers/ProjectAnalyzer';
import type { Command } from 'commander';
import type { CoverageThresholds } from '../../types/config';
import { type StandardCliOptions, executeCommand, type CommandContext } from '../utils';

export interface RunOptions extends StandardCliOptions {
  framework?: string;
  coverage?: boolean;
  watch?: boolean;
  reporter?: string;
  junit?: boolean;
  threshold?: string;
}

export async function runCommand(
  projectPath: string,
  options: RunOptions = {},
  command?: Command
): Promise<void> {
  await executeCommand(
    projectPath,
    options,
    command,
    async (context: CommandContext) => {
      const spinner = ora('Analyzing project...').start();

      try {
        logger.info(`Starting test execution for project: ${projectPath}`);

        // Step 1: Validate project path
        await handleValidation(
          async () => {
            const stats = await fs.stat(projectPath);
            if (!stats.isDirectory()) {
              throw new Error(`Path is not a directory: ${projectPath}`);
            }
          },
          `validating project path`,
          projectPath
        );

        // Step 2: Analyze project using loaded configuration
        const configService = new ConfigurationService({
          projectPath,
        });
        const fileDiscovery = FileDiscoveryServiceFactory.create(configService);
        const analyzer = new ProjectAnalyzer(projectPath, fileDiscovery);
        const analysis = await analyzer.analyzeProject();

        spinner.succeed('Project analysis complete');

        // Step 3: Check for generated tests
        const testPath = path.join(projectPath, '.claude-testing');
        try {
          await fs.stat(testPath);
        } catch {
          spinner.fail('No generated tests found');
          console.log(chalk.yellow('\n⚠️  No tests found in .claude-testing directory'));
          console.log(chalk.gray('Run the following command to generate tests first:'));
          console.log(chalk.cyan(`  npx claude-testing test ${projectPath}`));
          console.log();
          return;
        }

        // Step 4: Load configuration
        spinner.text = 'Loading test configuration...';
        const config = await loadRunnerConfiguration(
          projectPath,
          testPath,
          analysis,
          options,
          context.parentOptions.showConfigSources || false,
          context
        );
        spinner.succeed('Configuration loaded');

        // Step 5: Create and validate test runner
        spinner.text = 'Initializing test runner...';
        const runner = TestRunnerFactory.createRunner(config, analysis, fileDiscovery);
        spinner.succeed(`Test runner ready (${config.framework})`);

        // Step 6: Execute tests
        spinner.text = 'Running tests...';

        console.log(chalk.cyan(`\n🚀 Running tests with ${config.framework}...\n`));

        const result = await runner.run();

        if (result.success) {
          spinner.succeed('Tests completed successfully');
        } else {
          spinner.fail('Tests failed');
        }

        // Step 7: Display results
        displayTestResults(result, config);

        // Exit with appropriate code
        if (!result.success) {
          process.exit(result.exitCode || 1);
        }
      } catch (error) {
        spinner.fail('Test execution failed');
        throw error;
      }
    },
    {
      commandName: 'run',
      loadingText: 'Preparing test execution...',
      showConfigSources: true,
      validateConfig: true,
      exitOnConfigError: false,
    }
  );
}

async function loadRunnerConfiguration(
  projectPath: string,
  testPath: string,
  analysis: ProjectAnalysis,
  options: RunOptions,
  showConfigSources: boolean = false,
  context?: CommandContext
): Promise<TestRunnerConfig> {
  // Determine test framework
  let framework = options.framework;

  if (!framework) {
    framework = TestRunnerFactory.getRecommendedFramework(analysis);
  }

  // Validate framework support
  if (!TestRunnerFactory.isFrameworkSupported(framework)) {
    const supported = TestRunnerFactory.getSupportedFrameworks();
    throw new Error(
      `Unsupported framework: ${framework}. Supported frameworks: ${supported.join(', ')}`
    );
  }

  const config: TestRunnerConfig = {
    projectPath,
    testPath,
    framework,
    reporter: {
      console: 'normal' as const,
      ...(options.junit !== undefined && { junit: options.junit }),
      outputDir: path.join(testPath, 'reports'),
    },
  };

  // Add optional properties
  if (options.watch) {
    config.watch = options.watch;
  }

  // Add coverage config if enabled
  if (options.coverage) {
    config.coverage = {
      enabled: true,
      outputDir: path.join(testPath, 'coverage'),
      reporters: ['text', 'html', 'json'],
    };

    const thresholds = parseThresholds(options.threshold);
    if (thresholds) {
      config.coverage.thresholds = thresholds;
    }
  }

  // Use configuration from context if available, otherwise load it
  if (context) {
    const configResult = context.config.config;

    // Display configuration sources if requested
    if (showConfigSources) {
      displayConfigurationSources(configResult);
    }

    if (configResult.valid) {
      // Apply relevant configuration to runner config
      const fullConfig = configResult.config;

      // Override framework if specified in config and not in CLI options
      if (!options.framework && fullConfig.testFramework) {
        config.framework = fullConfig.testFramework;
      }

      // Apply output configuration
      if (fullConfig.output) {
        if (fullConfig.output.formats && fullConfig.output.formats.length > 0 && config.reporter) {
          const format = fullConfig.output.formats[0];
          // Map output formats to console reporter formats
          if (format === 'console') {
            config.reporter.console = 'normal';
          }
        }
      }

      logger.debug('Configuration applied via CommandContext', {
        sourcesLoaded: configResult.summary.sourcesLoaded,
        framework: config.framework,
      });
    } else {
      logger.warn('Configuration validation failed, using defaults', {
        errors: configResult.errors,
      });
    }
  } else {
    // Fallback for backward compatibility
    logger.debug('No CommandContext provided, using default configuration');
  }

  return config;
}

function parseThresholds(thresholdString?: string): CoverageThresholds['global'] | undefined {
  if (!thresholdString) {
    return undefined;
  }

  try {
    // Parse threshold string like "80" or "statements:80,branches:70"
    if (thresholdString.includes(':')) {
      const thresholds: CoverageThresholds['global'] = {};
      const parts = thresholdString.split(',');

      for (const part of parts) {
        const [type, value] = part.split(':');
        if (type && value) {
          const numValue = parseInt(value);
          const trimmedType = type.trim();
          if (
            !isNaN(numValue) &&
            (trimmedType === 'statements' ||
              trimmedType === 'branches' ||
              trimmedType === 'functions' ||
              trimmedType === 'lines')
          ) {
            thresholds[trimmedType] = numValue;
          }
        }
      }

      return thresholds;
    } else {
      // Single threshold applies to all
      const value = parseInt(thresholdString);
      if (!isNaN(value)) {
        return {
          statements: value,
          branches: value,
          functions: value,
          lines: value,
        };
      }
    }
  } catch (error) {
    logger.warn('Failed to parse threshold string', { thresholdString, error });
  }

  return undefined;
}

function displayTestResults(result: TestResult, config: TestRunnerConfig): void {
  console.log();

  if (result.success) {
    console.log(chalk.green('✓ All tests passed!'));
  } else {
    console.log(chalk.red('✗ Some tests failed'));
  }

  console.log();
  console.log(chalk.cyan('📊 Test Results:'));
  console.log(`  • Test Suites: ${result.testSuites}`);
  console.log(
    `  • Tests: ${chalk.green(result.passed)} passed, ${chalk.red(result.failed)} failed, ${chalk.yellow(result.skipped)} skipped`
  );
  console.log(`  • Duration: ${result.duration}ms`);

  // Display coverage if enabled
  if (result.coverage && config.coverage?.enabled) {
    console.log();
    console.log(chalk.cyan('📈 Coverage:'));
    console.log(`  • Statements: ${result.coverage.statements}%`);
    console.log(`  • Branches: ${result.coverage.branches}%`);
    console.log(`  • Functions: ${result.coverage.functions}%`);
    console.log(`  • Lines: ${result.coverage.lines}%`);

    if (!result.coverage.meetsThreshold) {
      console.log(chalk.yellow('  ⚠️  Coverage below threshold'));
    }
  }

  // Display failures
  if (result.failures && result.failures.length > 0) {
    console.log();
    console.log(chalk.red('❌ Test Failures:'));

    result.failures.slice(0, 5).forEach((failure: TestFailure) => {
      console.log(chalk.red(`\n  • ${failure.suite} > ${failure.test}`));
      console.log(chalk.gray(`    ${failure.message}`));
    });

    if (result.failures.length > 5) {
      console.log(chalk.gray(`\n  ... and ${result.failures.length - 5} more failures`));
    }
  }

  // Display next steps
  console.log();
  console.log(chalk.gray('Next steps:'));
  if (config.coverage?.enabled && config.coverage.outputDir) {
    console.log(
      chalk.gray(`  • View detailed coverage report: ${config.coverage.outputDir}/index.html`)
    );
  }
  if (config.reporter?.junit && config.reporter.outputDir) {
    console.log(chalk.gray(`  • JUnit report available: ${config.reporter.outputDir}/junit.xml`));
  }
  if (!result.success) {
    console.log(chalk.gray('  • Fix failing tests and run again'));
    console.log(chalk.gray('  • Use --watch for continuous testing'));
  }

  console.log();
}
