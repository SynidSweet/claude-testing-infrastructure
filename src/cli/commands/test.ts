import { chalk, ora, fs, path, logger } from '../../utils/common-imports';
import { ProjectAnalyzer, StructuralTestGenerator, TestGeneratorConfig, TestGapAnalyzer } from '../../utils/analyzer-imports';
import { handleAnalysisOperation, handleValidation, formatErrorMessage } from '../../utils/error-handling';
import { 
  ChunkedAITaskPreparation,
  ClaudeOrchestrator,
  CostEstimator
} from '../../ai';

interface TestOptions {
  config?: string;
  onlyStructural?: boolean;
  onlyLogical?: boolean;
  coverage?: boolean;
  update?: boolean;
  force?: boolean;
  verbose?: boolean;
  enableChunking?: boolean;
  chunkSize?: number;
}

export async function testCommand(projectPath: string, options: TestOptions = {}): Promise<void> {
  let spinner = ora('Analyzing project...').start();
  
  try {
    logger.info(`Starting test generation for project: ${projectPath}`);
    
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
        const analyzer = new ProjectAnalyzer(projectPath);
        return await analyzer.analyzeProject();
      },
      'project analysis for test generation',
      projectPath
    );
    
    spinner.succeed('Project analysis complete');
    
    if (options.verbose) {
      console.log(chalk.gray(`\n📋 Analysis Results:`));
      console.log(chalk.gray(`  • Languages detected: ${analysis.languages.map((l: any) => l.name).join(', ')}`));
      console.log(chalk.gray(`  • Frameworks detected: ${analysis.frameworks.map((f: any) => f.name).join(', ')}`));
      console.log(chalk.gray(`  • Total files: ${analysis.complexity.totalFiles}`));
      console.log(chalk.gray(`  • Total lines: ${analysis.complexity.totalLines.toLocaleString()}`));
    }
    
    // Step 3: Load configuration (with defaults)
    spinner = ora('Loading configuration...').start();
    const config = await loadConfiguration(projectPath, analysis, options);
    spinner.succeed('Configuration loaded');
    
    if (options.verbose) {
      console.log(chalk.gray(`\n⚙️  Configuration:`));
      console.log(chalk.gray(`  • Output path: ${config.outputPath}`));
      console.log(chalk.gray(`  • Test framework: ${config.testFramework}`));
      console.log(chalk.gray(`  • Generate mocks: ${config.options.generateMocks}`));
      console.log(chalk.gray(`  • Include setup/teardown: ${config.options.includeSetupTeardown}`));
    }
    
    // Step 4: Generate tests
    if (!options.onlyLogical) {
      spinner = ora('Generating structural tests...').start();
      
      if (options.verbose) {
        console.log(chalk.gray(`\n🏗️  Test Generation Settings:`));
        console.log(chalk.gray(`  • Generate mocks: true`));
        console.log(chalk.gray(`  • Generate setup: true`));
        console.log(chalk.gray(`  • Skip existing tests: ${!options.update}`));
      }
      
      const generator = new StructuralTestGenerator(config, analysis, {
        generateMocks: true,
        generateSetup: true,
        skipExistingTests: !options.update,
        skipValidation: !!options.force
      });
      
      const result = await generator.generateAllTests();
      
      if (!result.success) {
        spinner.fail('Test generation failed');
        console.log(chalk.red('\n❌ Test generation failed:\n'));
        result.errors.forEach(error => {
          console.log(chalk.red(`  • ${error}`));
        });
        if (result.warnings.length > 0) {
          console.log(chalk.yellow('\n⚠️  Warnings:\n'));
          result.warnings.forEach(warning => {
            console.log(chalk.yellow(`  • ${warning}`));
          });
        }
        process.exit(1);
      }
      
      // Step 5: Write generated tests to filesystem
      if (options.verbose) {
        console.log(chalk.gray(`\n💾 Writing ${result.tests.length} test files to filesystem...`));
      }
      
      await writeGeneratedTests(result.tests, options.verbose);
      
      spinner.succeed('Structural tests generated');
      
      // Display results
      console.log(chalk.green('\n✓ Test generation completed successfully\n'));
      console.log(chalk.cyan('📊 Generation Statistics:'));
      console.log(`  • Files analyzed: ${result.stats.filesAnalyzed}`);
      console.log(`  • Tests generated: ${result.stats.testsGenerated}`);
      console.log(`  • Test lines generated: ${result.stats.testLinesGenerated}`);
      console.log(`  • Generation time: ${result.stats.generationTime}ms`);
      
      if (result.warnings.length > 0) {
        console.log(chalk.yellow('\n⚠️  Warnings:'));
        result.warnings.forEach(warning => {
          console.log(chalk.yellow(`  • ${warning}`));
        });
      }
      
      console.log(chalk.cyan(`\n📁 Output directory: ${config.outputPath}`));
      console.log(chalk.green('\n✨ Tests ready for execution!\n'));
      
      // Optional: Show next steps
      console.log(chalk.gray('Next steps:'));
      console.log(chalk.gray(`  • Review generated tests in ${config.outputPath}`));
      console.log(chalk.gray(`  • Run tests with your test framework (${config.testFramework})`));
      if (options.onlyStructural) {
        console.log(chalk.gray('  • Consider adding --only-logical for AI-powered logical tests'));
      }
      
      if (options.verbose) {
        console.log(chalk.green('\n✓ Test generation completed successfully with detailed logging enabled.'));
      }
    }
    
    if (options.onlyLogical) {
      await generateLogicalTests(projectPath, analysis, config, options);
    }
    
  } catch (error) {
    spinner.fail('Test generation failed');
    console.error(chalk.red(`\n✗ ${formatErrorMessage(error)}`));
    process.exit(1);
  }
}

async function loadConfiguration(
  projectPath: string, 
  analysis: any, 
  options: TestOptions
): Promise<TestGeneratorConfig> {
  // Create default output path
  const outputPath = path.join(projectPath, '.claude-testing');
  
  // Ensure output directory exists
  await fs.mkdir(outputPath, { recursive: true });
  
  // Determine test framework
  let testFramework = 'jest'; // default
  
  if (analysis.testingSetup.testFrameworks.length > 0) {
    testFramework = analysis.testingSetup.testFrameworks[0];
  } else if (analysis.frameworks.some((f: any) => f.name === 'react')) {
    testFramework = 'jest';
  } else if (analysis.languages.some((l: any) => l.name === 'python')) {
    testFramework = 'pytest';
  }
  
  const config: TestGeneratorConfig = {
    projectPath,
    outputPath,
    testFramework,
    options: {
      generateMocks: true,
      includeSetupTeardown: true,
      generateTestData: false,
      addCoverage: options.coverage || false
    }
  };
  
  // Load custom configuration if provided
  if (options.config) {
    try {
      const configContent = await fs.readFile(options.config, 'utf-8');
      const customConfig = JSON.parse(configContent);
      
      // Merge custom configuration
      Object.assign(config, customConfig);
      logger.debug('Custom configuration loaded', { config: options.config });
    } catch (error) {
      logger.warn('Failed to load custom configuration, using defaults', { 
        config: options.config, 
        error 
      });
    }
  }
  
  return config;
}

async function writeGeneratedTests(tests: any[], verbose = false): Promise<void> {
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

async function generateLogicalTests(
  projectPath: string, 
  analysis: any, 
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
      skipValidation: true
    });
    
    const generationResult = await structuralGenerator.generateAllTests();
    
    if (!generationResult.success) {
      throw new Error(`Failed to generate base structural tests: ${generationResult.errors.join(', ')}`);
    }
    
    // Step 2: Analyze test gaps
    spinner.text = 'Analyzing test gaps...';
    const gapAnalyzer = new TestGapAnalyzer(analysis, {
      complexityThreshold: 3
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
    
    // Step 3: Check Claude CLI availability
    try {
      const { execSync } = require('child_process');
      execSync('claude --version', { stdio: 'ignore' });
    } catch {
      throw new Error('Claude Code CLI not found. Please install it first or run with --only-structural flag.');
    }

    // Step 4: Prepare AI tasks (with chunking support)
    spinner.start('Preparing AI tasks...');
    const taskPrep = new ChunkedAITaskPreparation({
      model: 'sonnet', // Default to balanced model
      maxConcurrentTasks: 3,
      minComplexityForAI: 3,
      enableChunking: options.enableChunking ?? true, // Enable by default
      chunkTokenLimit: options.chunkSize || 3500
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
      costReport.recommendations.forEach(rec => {
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
      verbose: options.verbose || false
    });

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
    spinner.text = `Generating logical tests... (0/${total})`;
    const results = await orchestrator.processBatch(batch);

    // Step 7: Show results
    const successfulResults = results.filter(r => r.success);
    const failedResults = results.filter(r => !r.success);
    
    spinner.succeed(`Generated ${successfulResults.length} logical test files`);
    
    if (failedResults.length > 0) {
      console.log(chalk.yellow(`\n⚠️  ${failedResults.length} files failed to generate:`));
      failedResults.forEach(result => {
        console.log(chalk.yellow(`  • ${result.taskId}: ${result.error}`));
      });
    }

    // Generate execution report
    const report = orchestrator.generateReport();
    console.log('\n' + chalk.blue('📊 AI Generation Report:'));
    console.log(report);

    // Track usage for future reporting
    const orchStats = (orchestrator as any).stats;
    estimator.trackUsage(
      projectPath,
      'sonnet',
      orchStats.totalTokensUsed,
      orchStats.totalCost
    );

    // Success summary
    console.log('\n' + chalk.green('✓ Logical test generation complete!'));
    console.log(`  Tests enhanced: ${successfulResults.length}${failedResults.length > 0 ? ` (${failedResults.length} failed)` : ''}`);
    console.log(`  Total cost: $${orchStats.totalCost.toFixed(2)}`);
    console.log(`  Tokens used: ${orchStats.totalTokensUsed.toLocaleString()}`);
    console.log(`  Duration: ${((orchStats.endTime!.getTime() - orchStats.startTime.getTime()) / 1000).toFixed(1)}s`);
    
    console.log(chalk.cyan(`\n📁 Enhanced tests saved to: ${config.outputPath}`));
    console.log(chalk.green('\n✨ Logical tests ready for execution!\n'));

  } catch (error) {
    spinner.fail('Logical test generation failed');
    throw error;
  }
}