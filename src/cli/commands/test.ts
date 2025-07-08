import { chalk, ora, fs, path, logger } from '../../utils/common-imports';
import type { Command } from 'commander';
import { ConfigurationService } from '../../config/ConfigurationService';
import type {
  ProjectAnalysis,
  TestGeneratorConfig,
  DetectedLanguage,
  DetectedFramework,
} from '../../utils/analyzer-imports';
import {
  ProjectAnalyzer,
  StructuralTestGenerator,
  TestGapAnalyzer,
} from '../../utils/analyzer-imports';
import type { StructuralTestGeneratorOptions } from '../../generators/StructuralTestGenerator';
import type { GeneratedTest, GeneratedFile } from '../../generators/TestGenerator';
import {
  handleAnalysisOperation,
  handleValidation,
  formatErrorMessage,
} from '../../utils/error-handling';
import { displayConfigurationSources } from '../../utils/config-display';
import { ChunkedAITaskPreparation, ClaudeOrchestrator, CostEstimator } from '../../ai';
import { ProgressReporter } from '../../utils/ProgressReporter';
import { FileDiscoveryServiceFactory } from '../../services/FileDiscoveryServiceFactory';
import type { TestFramework } from '../../types/config';

export interface TestOptions {
  config?: string;
  onlyStructural?: boolean;
  onlyLogical?: boolean;
  coverage?: boolean;
  update?: boolean;
  force?: boolean;
  maxRatio?: number;
  verbose?: boolean;
  enableChunking?: boolean;
  chunkSize?: number;
  dryRun?: boolean;
  parent?: { opts(): Record<string, unknown> }; // Parent command for accessing global options
}

export async function testCommand(
  projectPath: string,
  options: TestOptions = {},
  command?: Command
): Promise<void> {
  // Access global options from parent command
  const globalOptions = command?.parent?.opts() || {};
  const showConfigSources = globalOptions.showConfigSources || false;

  let spinner = ora('Analyzing project...').start();

  try {
    logger.info(`Starting test generation for project: ${projectPath}`);

    if (options.dryRun) {
      console.log(chalk.yellow('\n🔍 DRY RUN MODE - No files will be created'));
    }

    if (options.verbose) {
      console.log(chalk.gray(`\n🔍 Verbose mode enabled`));
      console.log(chalk.gray(`📁 Project path: ${projectPath}`));
      console.log(chalk.gray(`⚙️  Options: ${JSON.stringify(options, null, 2)}`));
    }

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
    if (options.verbose) {
      console.log(chalk.gray(`\n📊 Starting project analysis...`));
    }

    const analysis = await handleAnalysisOperation(
      async () => {
        const configService = new ConfigurationService({ projectPath });
        await configService.loadConfiguration();
        const fileDiscovery = FileDiscoveryServiceFactory.create(configService);
        const analyzer = new ProjectAnalyzer(projectPath, fileDiscovery);
        return await analyzer.analyzeProject();
      },
      'project analysis for test generation',
      projectPath
    );

    spinner.succeed('Project analysis complete');

    if (options.verbose) {
      console.log(chalk.gray(`\n📋 Analysis Results:`));
      console.log(
        chalk.gray(
          `  • Languages detected: ${analysis.languages.map((l: DetectedLanguage) => l.name).join(', ')}`
        )
      );
      console.log(
        chalk.gray(
          `  • Frameworks detected: ${analysis.frameworks.map((f: DetectedFramework) => f.name).join(', ')}`
        )
      );
      console.log(chalk.gray(`  • Total files: ${analysis.complexity.totalFiles}`));
      console.log(
        chalk.gray(`  • Total lines: ${analysis.complexity.totalLines.toLocaleString()}`)
      );
    }

    // Step 3: Load configuration (with defaults)
    spinner = ora('Loading configuration...').start();
    const config = await loadConfiguration(projectPath, analysis, options, showConfigSources);
    spinner.succeed('Configuration loaded');

    if (options.verbose) {
      console.log(chalk.gray(`\n⚙️  Configuration:`));
      console.log(chalk.gray(`  • Output path: ${config.outputPath}`));
      console.log(chalk.gray(`  • Test framework: ${config.testFramework}`));
      console.log(chalk.gray(`  • Generate mocks: ${config.options.generateMocks}`));
      console.log(chalk.gray(`  • Include setup/teardown: ${config.options.includeSetupTeardown}`));
      console.log(
        chalk.gray(`  • Include patterns: ${JSON.stringify(config.patterns?.include || [])}`)
      );
      console.log(
        chalk.gray(`  • Exclude patterns: ${JSON.stringify(config.patterns?.exclude || [])}`)
      );
    }

    // Step 4: Generate tests
    if (!options.onlyLogical) {
      // Stop the analysis spinner before starting test generation
      spinner.stop();

      if (options.verbose) {
        console.log(chalk.gray(`\n🏗️  Test Generation Settings:`));
        console.log(chalk.gray(`  • Generate mocks: true`));
        console.log(chalk.gray(`  • Generate setup: true`));
        console.log(chalk.gray(`  • Skip existing tests: ${!options.update}`));
      }

      const generatorOptions: StructuralTestGeneratorOptions = {
        generateMocks: true,
        generateSetup: true,
        skipExistingTests: !options.update,
        skipValidation: !!options.force,
        dryRun: !!options.dryRun,
      };

      if (options.maxRatio !== undefined) {
        generatorOptions.maxRatio = options.maxRatio;
      }

      const configService = new ConfigurationService({ projectPath });
      const fileDiscovery = FileDiscoveryServiceFactory.create(configService);
      const generator = new StructuralTestGenerator(
        config,
        analysis,
        generatorOptions,
        fileDiscovery
      );

      // Set up progress reporting
      const progressReporter = new ProgressReporter(options.verbose || false);
      generator.setProgressReporter(progressReporter);

      const result = await generator.generateAllTests();

      if (!result.success) {
        console.log(chalk.red('\n❌ Test generation failed:\n'));
        result.errors.forEach((error) => {
          console.log(chalk.red(`  • ${error}`));
        });
        if (result.warnings.length > 0) {
          console.log(chalk.yellow('\n⚠️  Warnings:\n'));
          result.warnings.forEach((warning) => {
            console.log(chalk.yellow(`  • ${warning}`));
          });
        }
        process.exit(1);
      }

      // Step 5: Write generated tests to filesystem or show dry-run preview
      if (options.dryRun) {
        await showDryRunPreview(result.tests, config, options.verbose);
      } else {
        if (options.verbose) {
          console.log(
            chalk.gray(`\n💾 Writing ${result.tests.length} test files to filesystem...`)
          );
        }

        spinner = ora('Writing test files...').start();
        await writeGeneratedTests(result.tests, options.verbose);
        spinner.succeed('Test files written successfully');
      }

      // Display results
      if (options.dryRun) {
        console.log(chalk.green('\n✓ Test generation preview completed successfully\n'));
        console.log(chalk.cyan('📊 Preview Statistics:'));
        console.log(`  • Files that would be analyzed: ${result.stats.filesAnalyzed}`);
        console.log(`  • Tests that would be generated: ${result.stats.testsGenerated}`);
        console.log(`  • Test lines that would be generated: ${result.stats.testLinesGenerated}`);
        console.log(`  • Preview generation time: ${result.stats.generationTime}ms`);

        console.log(chalk.cyan(`\n📁 Target output directory: ${config.outputPath}`));
        console.log(chalk.blue('\n🔍 Dry run complete - no files were created\n'));

        // Show next steps for dry run
        console.log(chalk.gray('To actually generate tests:'));
        console.log(chalk.gray(`  • Remove --dry-run flag and run the command again`));
        console.log(chalk.gray(`  • Or use: node dist/cli/index.js test ${projectPath}`));
      } else {
        console.log(chalk.green('\n✓ Test generation completed successfully\n'));
        console.log(chalk.cyan('📊 Generation Statistics:'));
        console.log(`  • Files analyzed: ${result.stats.filesAnalyzed}`);
        console.log(`  • Tests generated: ${result.stats.testsGenerated}`);
        console.log(`  • Test lines generated: ${result.stats.testLinesGenerated}`);
        console.log(`  • Generation time: ${result.stats.generationTime}ms`);

        console.log(chalk.cyan(`\n📁 Output directory: ${config.outputPath}`));
        console.log(chalk.green('\n✨ Tests ready for execution!\n'));

        // Optional: Show next steps
        console.log(chalk.gray('Next steps:'));
        console.log(chalk.gray(`  • Review generated tests in ${config.outputPath}`));
        console.log(chalk.gray(`  • Run tests with your test framework (${config.testFramework})`));
        if (options.onlyStructural) {
          console.log(
            chalk.gray('  • Consider adding --only-logical for AI-powered logical tests')
          );
        }
      }

      if (result.warnings.length > 0) {
        console.log(chalk.yellow('\n⚠️  Warnings:'));
        result.warnings.forEach((warning) => {
          console.log(chalk.yellow(`  • ${warning}`));
        });
      }

      if (options.verbose) {
        console.log(
          chalk.green('\n✓ Test generation completed successfully with detailed logging enabled.')
        );
      }
    }

    if (options.onlyLogical) {
      if (options.dryRun) {
        console.log(
          chalk.blue('\n🔍 Dry Run: AI logical test generation would be performed here.')
        );
        console.log(chalk.gray('  • AI analysis would identify test gaps'));
        console.log(chalk.gray('  • Claude CLI would generate logical tests'));
        console.log(chalk.gray('  • Enhanced tests would be created with meaningful assertions'));
        console.log(
          chalk.gray('Note: Use --only-logical without --dry-run to actually generate AI tests.')
        );
      } else {
        await generateLogicalTests(projectPath, analysis, config, options);
      }
    }
  } catch (error) {
    spinner.fail('Test generation failed');
    console.error(chalk.red(`\n✗ ${formatErrorMessage(error)}`));
    process.exit(1);
  }
}

async function loadConfiguration(
  projectPath: string,
  analysis: ProjectAnalysis,
  options: TestOptions,
  showConfigSources: boolean = false
): Promise<TestGeneratorConfig> {
  // Create default output path
  const outputPath = path.join(projectPath, '.claude-testing');

  // Ensure output directory exists (skip in dry-run mode)
  if (!options.dryRun) {
    await fs.mkdir(outputPath, { recursive: true });
  }

  // Load configuration using ConfigurationService
  let fullConfig;
  try {
    const configService = new ConfigurationService({
      projectPath,
      ...(options.config && { customConfigPath: options.config }),
      includeEnvVars: true,
      includeUserConfig: true,
      cliArgs: {
        verbose: options.verbose,
        dryRun: options.dryRun,
        coverage: options.coverage,
        force: options.force,
        maxRatio: options.maxRatio,
        enableChunking: options.enableChunking,
        chunkSize: options.chunkSize,
      },
    });

    const configResult = await configService.loadConfiguration();

    // Display configuration sources if requested
    if (showConfigSources) {
      displayConfigurationSources(configResult);
    }

    if (!configResult.valid) {
      logger.warn('Configuration validation failed, using resolved configuration', {
        errors: configResult.errors,
        warnings: configResult.warnings,
      });
    }

    fullConfig = configResult.config;
    logger.debug('Configuration loaded via ConfigurationService', {
      sourcesLoaded: configResult.summary.sourcesLoaded,
      sourcesWithErrors: configResult.summary.sourcesWithErrors,
      maxRatio: fullConfig.generation.maxTestToSourceRatio,
    });
  } catch (error) {
    logger.warn('Failed to load configuration service, using defaults', { error });
    const { DEFAULT_CONFIG } = await import('../../types/config');
    fullConfig = DEFAULT_CONFIG;
  }

  // Override config file if provided
  if (options.config) {
    try {
      const configContent = await fs.readFile(options.config, 'utf-8');
      const customConfig = JSON.parse(configContent);

      // Merge custom configuration
      Object.assign(fullConfig, customConfig);
      logger.debug('Custom configuration loaded', { config: options.config });
    } catch (error) {
      logger.warn('Failed to load custom configuration, using defaults', {
        config: options.config,
        error,
      });
    }
  }

  // Determine test framework
  let testFramework = fullConfig.testFramework || 'jest'; // default

  if (testFramework === 'auto') {
    if (analysis.testingSetup.testFrameworks.length > 0) {
      testFramework = analysis.testingSetup.testFrameworks[0] as TestFramework;
    } else if (analysis.frameworks.some((f: DetectedFramework) => f.name === 'react')) {
      testFramework = 'jest';
    } else if (analysis.languages.some((l: DetectedLanguage) => l.name === 'python')) {
      testFramework = 'pytest';
    } else {
      testFramework = 'jest';
    }
  }

  const config: TestGeneratorConfig & { generation?: Record<string, unknown>; maxRatio?: number } =
    {
      projectPath,
      outputPath,
      testFramework,
      options: {
        generateMocks: true,
        includeSetupTeardown: true,
        generateTestData: false,
        addCoverage: options.coverage || false,
      },
      // Include patterns from configuration
      patterns: {
        include: fullConfig.include,
        exclude: fullConfig.exclude,
      },
      // Include full configuration for validation
      generation: fullConfig.generation,
    };

  // Add maxRatio only if it's defined to avoid TypeScript strict checking issues
  if (options.maxRatio !== undefined) {
    config.maxRatio = options.maxRatio;
  }

  return config;
}

async function writeGeneratedTests(tests: GeneratedTest[], verbose = false): Promise<void> {
  for (const test of tests) {
    try {
      // Create directory if it doesn't exist
      await fs.mkdir(path.dirname(test.testPath), { recursive: true });

      // Write test file
      await fs.writeFile(test.testPath, test.content);
      logger.debug(`Generated test file: ${test.testPath}`);

      if (verbose) {
        console.log(chalk.gray(`  ✓ ${test.testPath}`));
      }

      // Write additional files (mocks, fixtures, etc.)
      if (test.additionalFiles) {
        for (const additionalFile of test.additionalFiles) {
          await fs.mkdir(path.dirname(additionalFile.path), { recursive: true });
          await fs.writeFile(additionalFile.path, additionalFile.content);
          logger.debug(`Generated ${additionalFile.type} file: ${additionalFile.path}`);

          if (verbose) {
            console.log(chalk.gray(`  ✓ ${additionalFile.path} (${additionalFile.type})`));
          }
        }
      }
    } catch (error) {
      logger.error(`Failed to write test file: ${test.testPath}`, { error });
      throw error;
    }
  }
}

async function showDryRunPreview(
  tests: GeneratedTest[],
  config: TestGeneratorConfig,
  verbose = false
): Promise<void> {
  console.log(chalk.blue('\n🔍 Dry Run Preview:\n'));

  // Group tests by directory for better organization
  const testsByDirectory = new Map<string, GeneratedTest[]>();
  let totalAdditionalFiles = 0;

  tests.forEach((test) => {
    const dir = path.dirname(test.testPath);
    if (!testsByDirectory.has(dir)) {
      testsByDirectory.set(dir, []);
    }
    testsByDirectory.get(dir)!.push(test);

    // Count additional files
    if (test.additionalFiles) {
      totalAdditionalFiles += test.additionalFiles.length;
    }
  });

  // Show directory structure preview
  console.log(chalk.cyan('📂 Directory Structure:'));
  Array.from(testsByDirectory.keys())
    .sort()
    .forEach((dir) => {
      const relativePath = path.relative(config.projectPath, dir);
      console.log(chalk.gray(`  📁 ${relativePath || '.'}/`));

      const testsInDir = testsByDirectory.get(dir)!;
      testsInDir.forEach((test) => {
        const fileName = path.basename(test.testPath);
        const fileSize = Math.round((test.content.length / 1024) * 10) / 10; // KB with 1 decimal
        console.log(
          chalk.gray(`    • ${fileName} (${fileSize} KB, ${test.content.split('\n').length} lines)`)
        );

        if (verbose && test.additionalFiles) {
          test.additionalFiles.forEach((additionalFile: GeneratedFile) => {
            const addFileName = path.basename(additionalFile.path);
            const addFileSize = Math.round((additionalFile.content.length / 1024) * 10) / 10;
            console.log(
              chalk.gray(`      └─ ${addFileName} (${additionalFile.type}, ${addFileSize} KB)`)
            );
          });
        }
      });
    });

  // Show file type breakdown
  console.log(chalk.cyan('\n📊 File Type Breakdown:'));
  const testFiles = tests.length;
  console.log(chalk.gray(`  • Test files: ${testFiles}`));
  if (totalAdditionalFiles > 0) {
    console.log(chalk.gray(`  • Additional files (mocks, fixtures): ${totalAdditionalFiles}`));
  }
  console.log(
    chalk.gray(`  • Total files that would be created: ${testFiles + totalAdditionalFiles}`)
  );

  // Calculate total size
  const totalSize = tests.reduce((sum, test) => {
    let testSize = test.content.length;
    if (test.additionalFiles) {
      testSize += test.additionalFiles.reduce(
        (addSum: number, file: GeneratedFile) => addSum + file.content.length,
        0
      );
    }
    return sum + testSize;
  }, 0);

  const totalSizeKB = Math.round((totalSize / 1024) * 10) / 10;
  console.log(chalk.gray(`  • Total size: ${totalSizeKB} KB`));

  // Show framework information
  console.log(chalk.cyan('\n⚙️ Test Framework Information:'));
  console.log(chalk.gray(`  • Framework: ${config.testFramework}`));
  console.log(
    chalk.gray(`  • Output directory: ${path.relative(config.projectPath, config.outputPath)}/`)
  );
  console.log(chalk.gray(`  • Mocks enabled: ${config.options.generateMocks}`));
  console.log(chalk.gray(`  • Setup/teardown enabled: ${config.options.includeSetupTeardown}`));

  if (verbose) {
    console.log(chalk.cyan('\n📄 Sample Test File Preview:'));
    if (tests.length > 0) {
      const sampleTest = tests[0];
      if (sampleTest) {
        const preview = sampleTest.content.split('\n').slice(0, 10).join('\n');
        console.log(chalk.gray(`File: ${path.basename(sampleTest.testPath)}`));
        console.log(chalk.gray('Content preview (first 10 lines):'));
        console.log(chalk.gray(preview));
        if (sampleTest.content.split('\n').length > 10) {
          console.log(chalk.gray(`... (${sampleTest.content.split('\n').length - 10} more lines)`));
        }
      }
    }
  }
}

async function generateLogicalTests(
  projectPath: string,
  analysis: ProjectAnalysis,
  config: TestGeneratorConfig,
  options: TestOptions
): Promise<void> {
  const spinner = ora('🤖 Starting AI-powered logical test generation...').start();

  try {
    // Step 1: Generate structural tests first (if they don't exist)
    spinner.text = 'Ensuring structural tests exist...';
    const structuralGenerator = new StructuralTestGenerator(config, analysis, {
      generateMocks: true,
      generateSetup: true,
      skipExistingTests: true, // Don't overwrite existing tests
      skipValidation: true,
      dryRun: false, // Always false for logical tests (they need structural tests to exist)
    });

    const generationResult = await structuralGenerator.generateAllTests();

    if (!generationResult.success) {
      throw new Error(
        `Failed to generate base structural tests: ${generationResult.errors.join(', ')}`
      );
    }

    // Step 2: Analyze test gaps
    spinner.text = 'Analyzing test gaps...';
    const gapAnalyzer = new TestGapAnalyzer(analysis, {
      complexityThreshold: 3,
    });

    const gapReport = await gapAnalyzer.analyzeTestGaps(generationResult);

    // Check if we have any gaps that need AI generation
    if (gapReport.gaps.length === 0) {
      spinner.succeed('No test gaps found that require AI generation!');
      console.log(chalk.green('\n✓ Your structural tests appear comprehensive.'));
      console.log(chalk.gray('Consider running periodic gap analysis as your code evolves.'));
      return;
    }

    spinner.succeed(`Found ${gapReport.gaps.length} files requiring logical tests`);

    // Step 3: Check Claude CLI availability and authentication
    try {
      const { execSync } = require('child_process');
      execSync('claude --version', { stdio: 'ignore' });

      // Check if Claude CLI is authenticated by testing a simple command
      try {
        const authTest = execSync('claude --help', { encoding: 'utf8', timeout: 10000 });
        if (!authTest || authTest.includes('authentication') || authTest.includes('login')) {
          throw new Error('Claude CLI authentication required');
        }
      } catch (authError) {
        const errorMsg = authError instanceof Error ? authError.message : String(authError);
        if (
          errorMsg.includes('timeout') ||
          errorMsg.includes('authentication') ||
          errorMsg.includes('login')
        ) {
          throw new Error(
            'Claude CLI authentication required. Please ensure Claude Code is properly authenticated.\n' +
              'If you have Claude Code installed, try running it interactively first to ensure authentication is working.\n' +
              'Alternatively, use --only-structural flag to generate structural tests only.'
          );
        }
        // If it's a different error, continue - authentication might still work
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (
        errorMsg.includes('Claude CLI authentication required') ||
        errorMsg.includes('authentication')
      ) {
        throw error; // Re-throw authentication errors as-is
      }
      throw new Error(
        'Claude Code CLI not found or not accessible. Please ensure Claude Code is installed and available in your PATH.\n' +
          'Visit https://claude.ai/code for installation instructions.\n' +
          'Alternatively, use --only-structural flag to generate structural tests only.'
      );
    }

    // Step 4: Prepare AI tasks (with chunking support)
    spinner.start('Preparing AI tasks...');
    const taskPrep = new ChunkedAITaskPreparation({
      model: 'sonnet', // Default to balanced model
      maxConcurrentTasks: 3,
      minComplexityForAI: 3,
      enableChunking: options.enableChunking ?? true, // Enable by default
      chunkTokenLimit: options.chunkSize || 3500,
    });

    const batch = await taskPrep.prepareTasks(gapReport);

    // Step 5: Cost estimation
    spinner.text = 'Estimating costs...';
    const estimator = new CostEstimator('sonnet');
    const costReport = estimator.estimateReportCost(gapReport);

    console.log('\n' + chalk.blue('💰 Cost Estimation:'));
    console.log(`Total estimated cost: ${chalk.green(`$${costReport.totalCost.toFixed(2)}`)}`);
    console.log('By complexity:');
    Object.entries(costReport.byComplexity).forEach(([level, data]) => {
      if (data.count > 0) {
        console.log(`  ${level}: ${data.count} files, $${data.cost.toFixed(2)}`);
      }
    });

    // Show recommendations
    if (costReport.recommendations.length > 0) {
      console.log('\n' + chalk.blue('💡 Recommendations:'));
      costReport.recommendations.forEach((rec) => {
        console.log(`  • ${rec}`);
      });
    }

    // Step 6: Execute AI generation
    console.log('\n' + chalk.blue('🤖 Starting AI test generation...'));

    const orchestrator = new ClaudeOrchestrator({
      maxConcurrent: 3,
      model: 'sonnet',
      fallbackModel: 'haiku',
      timeout: 900000, // 15 minutes
      verbose: options.verbose || false,
    });

    // Set up progress tracking with detailed feedback
    let completed = 0;
    let failed = 0;
    const total = batch.tasks.length;
    const startTime = Date.now();

    // Handle progress events for better user feedback
    orchestrator.on('progress', (update: any) => {
      if (update.phase === 'authenticating') {
        spinner.text = update.message;
      } else if (update.phase === 'generating') {
        const fileName =
          update.taskId === 'auth-check' ? 'Authentication' : path.basename(update.taskId);
        spinner.text = `${update.message} - ${fileName} (${update.progress}%)`;
      }
    });

    orchestrator.on('task:start', ({ task }) => {
      if (options.verbose) {
        console.log(
          chalk.gray(`  Starting AI generation for ${path.basename(task.sourceFile)}...`)
        );
      }
    });

    orchestrator.on('task:complete', ({ task, result }) => {
      completed++;
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const eta =
        completed > 0
          ? (((Date.now() - startTime) * (total - completed)) / completed / 1000).toFixed(1)
          : '?';

      spinner.text = `Generating tests... (${completed}/${total}) - ${path.basename(task.sourceFile)} ✓ (${elapsed}s elapsed, ETA: ${eta}s)`;

      if (options.verbose) {
        console.log(
          chalk.green(
            `  ✓ Completed ${path.basename(task.sourceFile)} - Cost: $${result.result?.actualCost?.toFixed(3) || '?'}`
          )
        );
      }
    });

    orchestrator.on('task:failed', ({ task, error }) => {
      failed++;
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

      spinner.text = `Generating tests... (${completed}/${total}, ${failed} failed) - ${path.basename(task.sourceFile)} ✗ (${elapsed}s elapsed)`;
      logger.error(`Failed to generate tests for ${task.sourceFile}: ${error}`);

      if (options.verbose) {
        console.log(chalk.red(`  ✗ Failed ${path.basename(task.sourceFile)}: ${error}`));
      }
    });

    orchestrator.on('task:retry', ({ task, attemptNumber, error }) => {
      if (options.verbose) {
        console.log(
          chalk.yellow(
            `  ↻ Retrying ${path.basename(task.sourceFile)} (attempt ${attemptNumber + 1}): ${error}`
          )
        );
      }
    });

    // Process the batch with timeout handling
    spinner.text = `Generating logical tests... (0/${total}) - Starting AI generation`;

    let results;
    try {
      results = await Promise.race([
        orchestrator.processBatch(batch),
        new Promise<never>((_, reject) => {
          setTimeout(
            () => {
              reject(
                new Error(
                  'Overall AI generation process timed out after 30 minutes. This may indicate authentication or network issues.'
                )
              );
            },
            30 * 60 * 1000
          ); // 30 minute overall timeout
        }),
      ]);
    } catch (error) {
      // Kill all active processes on timeout or error
      await orchestrator.killAll();
      throw error;
    }

    // Step 7: Show results
    const successfulResults = results.filter((r) => r.success);
    const failedResults = results.filter((r) => !r.success);

    spinner.succeed(`Generated ${successfulResults.length} logical test files`);

    if (failedResults.length > 0) {
      console.log(chalk.yellow(`\n⚠️  ${failedResults.length} files failed to generate:`));
      failedResults.forEach((result) => {
        console.log(chalk.yellow(`  • ${result.taskId}: ${result.error}`));
      });
    }

    // Generate execution report
    const report = orchestrator.generateReport();
    console.log('\n' + chalk.blue('📊 AI Generation Report:'));
    console.log(report);

    // Track usage for future reporting
    const orchStats = (orchestrator as any).stats;
    estimator.trackUsage(projectPath, 'sonnet', orchStats.totalTokensUsed, orchStats.totalCost);

    // Success summary
    console.log('\n' + chalk.green('✓ Logical test generation complete!'));
    console.log(
      `  Tests enhanced: ${successfulResults.length}${failedResults.length > 0 ? ` (${failedResults.length} failed)` : ''}`
    );
    console.log(`  Total cost: $${orchStats.totalCost.toFixed(2)}`);
    console.log(`  Tokens used: ${orchStats.totalTokensUsed.toLocaleString()}`);
    console.log(
      `  Duration: ${((orchStats.endTime!.getTime() - orchStats.startTime.getTime()) / 1000).toFixed(1)}s`
    );

    console.log(chalk.cyan(`\n📁 Enhanced tests saved to: ${config.outputPath}`));
    console.log(chalk.green('\n✨ Logical tests ready for execution!\n'));
  } catch (error) {
    spinner.fail('Logical test generation failed');
    throw error;
  }
}
