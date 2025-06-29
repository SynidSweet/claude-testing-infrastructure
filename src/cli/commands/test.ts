import { chalk, ora, fs, path, logger } from '../../utils/common-imports';
import { ProjectAnalyzer, StructuralTestGenerator, TestGeneratorConfig } from '../../utils/analyzer-imports';
import { handleAnalysisOperation, handleValidation, formatErrorMessage } from '../../utils/error-handling';

interface TestOptions {
  config?: string;
  onlyStructural?: boolean;
  onlyLogical?: boolean;
  coverage?: boolean;
  update?: boolean;
  force?: boolean;
  verbose?: boolean;
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
      console.log(chalk.yellow('\n🤖 AI-powered logical test generation coming soon!'));
      console.log(chalk.gray('This feature will analyze your code logic and generate intelligent test cases.'));
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