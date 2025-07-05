import { chalk, ora, logger } from '../../utils/common-imports';
import { ProjectAnalyzer } from '../../utils/analyzer-imports';
import { ConfigurationService } from '../../config/ConfigurationService';
import { FileDiscoveryServiceFactory } from '../../services/FileDiscoveryServiceFactory';
import {
  handleAnalysisOperation,
  handleFileOperation,
  formatErrorMessage,
} from '../../utils/error-handling';
import { displayConfigurationSources } from '../../utils/config-display';

interface AnalyzeOptions {
  output?: string;
  format?: 'json' | 'markdown' | 'console';
  verbose?: boolean;
  validateConfig?: boolean;
  config?: string;
}

export async function analyzeCommand(
  projectPath: string,
  options: AnalyzeOptions = {},
  command?: { parent?: { opts(): { showConfigSources?: boolean } } }
): Promise<void> {
  // Access global options from parent command
  const globalOptions = command?.parent?.opts() || {};
  const showConfigSources = globalOptions.showConfigSources || false;
  const spinner = ora('Analyzing project...').start();

  try {
    logger.info(`Starting analysis of project: ${projectPath}`);

    // Load and validate configuration if requested
    if (options.validateConfig) {
      spinner.text = 'Loading and validating configuration...';

      const configService = new ConfigurationService({
        projectPath,
        ...(options.config && { customConfigPath: options.config }),
        includeEnvVars: true,
        includeUserConfig: true,
        cliArgs: options as Record<string, unknown>,
      });

      const configResult = await configService.loadConfiguration();

      spinner.stop();
      console.log(chalk.blue('\n📋 Configuration Validation Results'));
      console.log(chalk.blue('====================================='));

      if (configResult.valid) {
        console.log(chalk.green('✓ Configuration is valid'));
        if (configResult.warnings.length > 0) {
          console.log(chalk.yellow('\n⚠️  Warnings:'));
          configResult.warnings.forEach((warning) => console.log(chalk.yellow(`  • ${warning}`)));
        }
      } else {
        console.log(chalk.red('✗ Configuration validation failed'));
        console.log(chalk.red('\nErrors:'));
        configResult.errors.forEach((error) => console.log(chalk.red(`  • ${error}`)));
        if (configResult.warnings.length > 0) {
          console.log(chalk.yellow('\nWarnings:'));
          configResult.warnings.forEach((warning) => console.log(chalk.yellow(`  • ${warning}`)));
        }
        process.exit(1);
      }

      // Show configuration sources
      console.log(chalk.blue('\n📂 Configuration Sources:'));
      configResult.sources.forEach((source) => {
        const status = source.loaded ? '✓' : '✗';
        const path = source.path ? ` (${source.path})` : '';
        console.log(`  ${status} ${source.type}${path}`);
        if (source.errors.length > 0) {
          source.errors.forEach((error) => {
            console.log(chalk.red(`    • ${error}`));
          });
        }
      });

      console.log(chalk.blue('\n📊 Resolved Configuration:'));
      console.log(JSON.stringify(configResult.config, null, 2));
      console.log('');
    } else if (showConfigSources) {
      // Show config sources even when not validating
      spinner.text = 'Loading configuration...';

      const configService = new ConfigurationService({
        projectPath,
        ...(options.config && { customConfigPath: options.config }),
        includeEnvVars: true,
        includeUserConfig: true,
        cliArgs: options as Record<string, unknown>,
      });

      const configResult = await configService.loadConfiguration();
      spinner.stop();

      displayConfigurationSources(configResult);
      console.log('');

      spinner.start('Analyzing project...');
    }

    const analysis = await handleAnalysisOperation(
      async () => {
        // Create or get existing configuration service
        const configService = new ConfigurationService({
          projectPath,
          ...(options.config && { customConfigPath: options.config }),
          includeEnvVars: true,
          includeUserConfig: true,
          cliArgs: options as Record<string, unknown>,
        });

        // Load configuration before creating FileDiscoveryService
        await configService.loadConfiguration();

        // Create FileDiscoveryService instance
        const fileDiscovery = FileDiscoveryServiceFactory.create(configService);

        // Create analyzer with FileDiscoveryService
        const analyzer = new ProjectAnalyzer(projectPath, fileDiscovery);
        return await analyzer.analyzeProject();
      },
      'project analysis',
      projectPath
    );

    spinner.succeed('Analysis complete');

    // Format and display results
    if (options.format === 'json') {
      const output = JSON.stringify(analysis, null, 2);
      console.log(output);

      if (options.output) {
        await handleFileOperation(
          async () => {
            const fs = await import('fs/promises');
            await fs.writeFile(options.output!, output);
          },
          `writing analysis output to file`,
          options.output
        );
        console.log(chalk.green(`\n✓ Analysis saved to ${options.output}`));
      }
    } else if (options.format === 'markdown') {
      const markdown = formatAsMarkdown(analysis as unknown as Record<string, unknown>);
      console.log(markdown);

      if (options.output) {
        await handleFileOperation(
          async () => {
            const fs = await import('fs/promises');
            await fs.writeFile(options.output!, markdown);
          },
          `writing markdown analysis to file`,
          options.output
        );
        console.log(chalk.green(`\n✓ Analysis saved to ${options.output}`));
      }
    } else {
      // Console format (default)
      if (options.output) {
        // Capture console output for file writing
        const originalLog = console.log;
        let consoleOutput = '';
        console.log = (...args: any[]) => {
          consoleOutput +=
            args
              .map((arg) => (typeof arg === 'object' ? JSON.stringify(arg) : String(arg)))
              .join(' ') + '\n';
        };

        displayConsoleResults(analysis as unknown as Record<string, unknown>, options.verbose);

        // Restore original console.log
        console.log = originalLog;

        // Write captured output to file
        await handleFileOperation(
          async () => {
            const fs = await import('fs/promises');
            await fs.writeFile(options.output!, consoleOutput);
          },
          `writing console analysis to file`,
          options.output
        );
        console.log(chalk.green(`\n✓ Analysis saved to ${options.output}`));
      } else {
        displayConsoleResults(analysis as unknown as Record<string, unknown>, options.verbose);
      }
    }
  } catch (error) {
    spinner.fail('Analysis failed');
    console.error(chalk.red(`\n✗ ${formatErrorMessage(error)}`));
    process.exit(1);
  }
}

function displayConsoleResults(analysis: Record<string, unknown>, verbose = false): void {
  console.log(chalk.green('\n✓ Project Analysis Complete\n'));
  console.log(chalk.cyan('📁 Project:'), analysis.projectPath);

  displayLanguages(analysis.languages as any[]);
  displayFrameworks(analysis.frameworks as any[]);
  displayPackageManagers(analysis.packageManagers as any[]);
  displayTestingSetup(analysis.testingSetup as Record<string, unknown>);
  displayComplexityMetrics(analysis.complexity as Record<string, unknown>);

  if (verbose) {
    displayProjectStructure(analysis.projectStructure as Record<string, unknown>);
    displayLargestFiles((analysis.complexity as any).largestFiles);
  }

  console.log(
    chalk.green('\n✨ Analysis complete! Use --format json or --verbose for more details.\n')
  );
}

function displayLanguages(languages: any[]): void {
  if (languages.length > 0) {
    console.log(chalk.cyan('\n🔤 Languages:'));
    languages.forEach((lang: any) => {
      console.log(`  • ${lang.name} (${Math.round(lang.confidence * 100)}% confidence)`);
    });
  }
}

function displayFrameworks(frameworks: any[]): void {
  if (frameworks.length > 0) {
    console.log(chalk.cyan('\n🚀 Frameworks:'));
    frameworks.forEach((framework: any) => {
      const version = framework.version ? ` v${framework.version}` : '';
      console.log(
        `  • ${framework.name}${version} (${Math.round(framework.confidence * 100)}% confidence)`
      );
    });
  }
}

function displayPackageManagers(packageManagers: any[]): void {
  if (packageManagers.length > 0) {
    console.log(chalk.cyan('\n📦 Package Managers:'));
    packageManagers.forEach((pm: any) => {
      console.log(`  • ${pm.name} (${Math.round(pm.confidence * 100)}% confidence)`);
    });
  }
}

function displayTestingSetup(testingSetup: Record<string, unknown>): void {
  console.log(chalk.cyan('\n🧪 Testing Setup:'));
  console.log(`  • Has tests: ${testingSetup.hasTests ? '✅' : '❌'}`);
  if ((testingSetup.testFrameworks as any[]).length > 0) {
    console.log(`  • Test frameworks: ${(testingSetup.testFrameworks as any[]).join(', ')}`);
  }
  if ((testingSetup.testFiles as any[]).length > 0) {
    console.log(`  • Test files found: ${(testingSetup.testFiles as any[]).length}`);
  }
}

function displayComplexityMetrics(complexity: Record<string, unknown>): void {
  console.log(chalk.cyan('\n📊 Project Complexity:'));
  console.log(`  • Total files: ${complexity.totalFiles}`);
  console.log(`  • Total lines: ${(complexity.totalLines as number).toLocaleString()}`);
  console.log(`  • Average file size: ${Math.round(complexity.averageFileSize as number)} lines`);
}

function displayProjectStructure(projectStructure: Record<string, unknown>): void {
  console.log(chalk.cyan('\n📂 Project Structure:'));
  if (projectStructure.srcDirectory) {
    console.log(`  • Source directory: ${projectStructure.srcDirectory}`);
  }
  if ((projectStructure.entryPoints as any[]).length > 0) {
    console.log(`  • Entry points: ${(projectStructure.entryPoints as any[]).slice(0, 3).join(', ')}`);
  }
  if ((projectStructure.testDirectories as any[]).length > 0) {
    console.log(`  • Test directories: ${(projectStructure.testDirectories as any[]).slice(0, 3).join(', ')}`);
  }
}

function displayLargestFiles(largestFiles: any[]): void {
  if (largestFiles.length > 0) {
    console.log(chalk.cyan('\n📈 Largest Files:'));
    largestFiles.slice(0, 5).forEach((file: any) => {
      console.log(`  • ${file.path} (${file.lines} lines)`);
    });
  }
}

function formatAsMarkdown(analysis: Record<string, unknown>): string {
  let markdown = `# Project Analysis Report\n\n`;
  markdown += `**Project:** ${analysis.projectPath}\n\n`;

  // Languages
  if ((analysis.languages as any[]).length > 0) {
    markdown += `## Languages\n\n`;
    (analysis.languages as any[]).forEach((lang: any) => {
      markdown += `- **${lang.name}** (${Math.round(lang.confidence * 100)}% confidence)\n`;
    });
    markdown += '\n';
  }

  // Frameworks
  if ((analysis.frameworks as any[]).length > 0) {
    markdown += `## Frameworks\n\n`;
    (analysis.frameworks as any[]).forEach((framework: any) => {
      const version = framework.version ? ` v${framework.version}` : '';
      markdown += `- **${framework.name}**${version} (${Math.round(framework.confidence * 100)}% confidence)\n`;
    });
    markdown += '\n';
  }

  // Testing setup
  markdown += `## Testing Setup\n\n`;
  markdown += `- **Has tests:** ${(analysis.testingSetup as any).hasTests ? '✅ Yes' : '❌ No'}\n`;
  if ((analysis.testingSetup as any).testFrameworks.length > 0) {
    markdown += `- **Test frameworks:** ${(analysis.testingSetup as any).testFrameworks.join(', ')}\n`;
  }
  if ((analysis.testingSetup as any).testFiles.length > 0) {
    markdown += `- **Test files found:** ${(analysis.testingSetup as any).testFiles.length}\n`;
  }
  markdown += '\n';

  // Complexity metrics
  markdown += `## Project Complexity\n\n`;
  markdown += `- **Total files:** ${(analysis.complexity as any).totalFiles}\n`;
  markdown += `- **Total lines:** ${(analysis.complexity as any).totalLines.toLocaleString()}\n`;
  markdown += `- **Average file size:** ${Math.round((analysis.complexity as any).averageFileSize)} lines\n\n`;

  // Largest files
  if ((analysis.complexity as any).largestFiles.length > 0) {
    markdown += `## Largest Files\n\n`;
    (analysis.complexity as any).largestFiles.slice(0, 10).forEach((file: any) => {
      markdown += `- ${file.path} (${file.lines} lines)\n`;
    });
    markdown += '\n';
  }

  return markdown;
}
