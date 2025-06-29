import { chalk, ora, fs, path, logger } from '../../utils/common-imports';
import { ProjectAnalyzer, StructuralTestGenerator, TestGeneratorConfig } from '../../utils/analyzer-imports';

interface TestOptions {
  config?: string;
  onlyStructural?: boolean;
  onlyLogical?: boolean;
  coverage?: boolean;
  update?: boolean;
}

export async function testCommand(projectPath: string, options: TestOptions = {}): Promise<void> {
  let spinner = ora('Analyzing project...').start();
  
  try {
    logger.info(`Starting test generation for project: ${projectPath}`);
    
    // Step 1: Validate project path
    try {
      const stats = await fs.stat(projectPath);
      if (!stats.isDirectory()) {
        throw new Error(`Path ${projectPath} is not a directory`);
      }
    } catch (error) {
      throw new Error(`Invalid project path: ${projectPath}`);
    }
    
    // Step 2: Analyze project
    const analyzer = new ProjectAnalyzer(projectPath);
    const analysis = await analyzer.analyzeProject();
    
    spinner.succeed('Project analysis complete');
    
    // Step 3: Load configuration (with defaults)
    spinner = ora('Loading configuration...').start();
    const config = await loadConfiguration(projectPath, analysis, options);
    spinner.succeed('Configuration loaded');
    
    // Step 4: Generate tests
    if (!options.onlyLogical) {
      spinner = ora('Generating structural tests...').start();
      
      const generator = new StructuralTestGenerator(config, analysis, {
        generateMocks: true,
        generateSetup: true,
        skipExistingTests: !options.update
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
      await writeGeneratedTests(result.tests);
      
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
    }
    
    if (options.onlyLogical) {
      console.log(chalk.yellow('\n🤖 AI-powered logical test generation coming soon!'));
      console.log(chalk.gray('This feature will analyze your code logic and generate intelligent test cases.'));
    }
    
  } catch (error) {
    spinner.fail('Test generation failed');
    logger.error('Test generation error:', error);
    
    if (error instanceof Error) {
      console.log(chalk.red(`\n❌ ${error.message}\n`));
    } else {
      console.log(chalk.red('\n❌ An unexpected error occurred\n'));
    }
    
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

async function writeGeneratedTests(tests: any[]): Promise<void> {
  for (const test of tests) {
    try {
      // Create directory if it doesn't exist
      await fs.mkdir(path.dirname(test.testPath), { recursive: true });
      
      // Write test file
      await fs.writeFile(test.testPath, test.content);
      logger.debug(`Generated test file: ${test.testPath}`);
      
      // Write additional files (mocks, fixtures, etc.)
      if (test.additionalFiles) {
        for (const additionalFile of test.additionalFiles) {
          await fs.mkdir(path.dirname(additionalFile.path), { recursive: true });
          await fs.writeFile(additionalFile.path, additionalFile.content);
          logger.debug(`Generated ${additionalFile.type} file: ${additionalFile.path}`);
        }
      }
    } catch (error) {
      logger.error(`Failed to write test file: ${test.testPath}`, { error });
      throw error;
    }
  }
}