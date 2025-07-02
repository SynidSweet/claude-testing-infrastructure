import { chalk, ora, fs, path, logger } from '../../utils/common-imports';
import { ProjectAnalyzer } from '../../utils/analyzer-imports';
import { TestRunnerFactory, TestRunnerConfig } from '../../runners';
import { handleValidation, formatErrorMessage } from '../../utils/error-handling';
import { ConfigurationService } from '../../config/ConfigurationService';
import { displayConfigurationSources } from '../../utils/config-display';
import { FileDiscoveryServiceFactory } from '../../services/FileDiscoveryServiceFactory';

interface RunOptions {
  config?: string;
  framework?: string;
  coverage?: boolean;
  watch?: boolean;
  reporter?: string;
  junit?: boolean;
  threshold?: string;
  verbose?: boolean;
}

export async function runCommand(projectPath: string, options: RunOptions = {}, command?: any): Promise<void> {
  // Access global options from parent command
  const globalOptions = command?.parent?.opts() || {};
  const showConfigSources = globalOptions.showConfigSources || false;
  let spinner = ora('Analyzing project...').start();
  
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
    
    // Step 2: Analyze project
    const configService = new ConfigurationService({ projectPath });
    await configService.loadConfiguration();
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
    spinner = ora('Loading test configuration...').start();
    const config = await loadRunnerConfiguration(projectPath, testPath, analysis, options, showConfigSources);
    spinner.succeed('Configuration loaded');
    
    // Step 5: Create and validate test runner
    spinner = ora('Initializing test runner...').start();
    const runner = TestRunnerFactory.createRunner(config, analysis, fileDiscovery);
    spinner.succeed(`Test runner ready (${config.framework})`);
    
    // Step 6: Execute tests
    spinner = ora('Running tests...').start();
    
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
    console.error(chalk.red(`\n✗ ${formatErrorMessage(error)}`));
    process.exit(1);
  }
}

async function loadRunnerConfiguration(
  projectPath: string,
  testPath: string,
  analysis: any,
  options: RunOptions,
  showConfigSources: boolean = false
): Promise<TestRunnerConfig> {
  // Determine test framework
  let framework = options.framework;
  
  if (!framework) {
    framework = TestRunnerFactory.getRecommendedFramework(analysis);
  }
  
  // Validate framework support
  if (!TestRunnerFactory.isFrameworkSupported(framework)) {
    const supported = TestRunnerFactory.getSupportedFrameworks();
    throw new Error(`Unsupported framework: ${framework}. Supported frameworks: ${supported.join(', ')}`);
  }
  
  const config: TestRunnerConfig = {
    projectPath,
    testPath,
    framework,
    reporter: {
      console: 'normal' as const,
      ...(options.junit !== undefined && { junit: options.junit }),
      outputDir: path.join(testPath, 'reports')
    }
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
      reporters: ['text', 'html', 'json']
    };
    
    const thresholds = parseThresholds(options.threshold);
    if (thresholds) {
      config.coverage.thresholds = thresholds;
    }
  }
  
  // Load configuration using ConfigurationService
  try {
    const configService = new ConfigurationService({
      projectPath,
      ...(options.config && { customConfigPath: options.config }),
      includeEnvVars: true,
      includeUserConfig: true,
      cliArgs: {
        framework: options.framework,
        coverage: options.coverage,
        watch: options.watch,
        reporter: options.reporter,
        junit: options.junit,
        threshold: options.threshold
      }
    });
    
    const configResult = await configService.loadConfiguration();
    
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
          config.reporter.console = fullConfig.output.formats[0] as any;
        }
      }
      
      logger.debug('Configuration applied via ConfigurationService', {
        sourcesLoaded: configResult.summary.sourcesLoaded,
        framework: config.framework
      });
    } else {
      logger.warn('Configuration validation failed, using defaults', { 
        errors: configResult.errors 
      });
    }
  } catch (error) {
    logger.warn('Failed to load configuration service, using defaults', { error });
  }
  
  return config;
}

function parseThresholds(thresholdString?: string): { statements?: number; branches?: number; functions?: number; lines?: number } | undefined {
  if (!thresholdString) {
    return undefined;
  }
  
  try {
    // Parse threshold string like "80" or "statements:80,branches:70"
    if (thresholdString.includes(':')) {
      const thresholds: any = {};
      const parts = thresholdString.split(',');
      
      for (const part of parts) {
        const [type, value] = part.split(':');
        if (type && value) {
          const numValue = parseInt(value);
          if (!isNaN(numValue)) {
            thresholds[type.trim()] = numValue;
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
          lines: value
        };
      }
    }
  } catch (error) {
    logger.warn('Failed to parse threshold string', { thresholdString, error });
  }
  
  return undefined;
}

function displayTestResults(result: any, config: TestRunnerConfig): void {
  console.log();
  
  if (result.success) {
    console.log(chalk.green('✓ All tests passed!'));
  } else {
    console.log(chalk.red('✗ Some tests failed'));
  }
  
  console.log();
  console.log(chalk.cyan('📊 Test Results:'));
  console.log(`  • Test Suites: ${result.testSuites}`);
  console.log(`  • Tests: ${chalk.green(result.passed)} passed, ${chalk.red(result.failed)} failed, ${chalk.yellow(result.skipped)} skipped`);
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
    
    result.failures.slice(0, 5).forEach((failure: any) => {
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
    console.log(chalk.gray(`  • View detailed coverage report: ${config.coverage.outputDir}/index.html`));
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