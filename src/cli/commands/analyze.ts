import { chalk, logger } from '../../utils/common-imports';
import type {
  ProjectAnalysis,
  DetectedLanguage,
  DetectedFramework,
  DetectedPackageManager,
  TestingSetup,
  ComplexityMetrics,
  ProjectStructure,
} from '../../utils/analyzer-imports';
import { ProjectAnalyzer } from '../../utils/analyzer-imports';
import { ConfigurationService } from '../../config/ConfigurationService';
import { FileDiscoveryServiceFactory } from '../../services/FileDiscoveryServiceFactory';
import { handleAnalysisOperation, handleFileOperation } from '../../utils/error-handling';
import { executeCommand, type CommandContext, type StandardCliOptions } from '../utils';
import type { Command } from 'commander';

export interface AnalyzeOptions extends StandardCliOptions {
  output?: string;
  format?: 'json' | 'markdown' | 'console';
  validateConfig?: boolean;
  showPatterns?: boolean;
  dryRun?: boolean;
}

export async function analyzeCommand(
  projectPath: string,
  options: AnalyzeOptions = {},
  command?: Command
): Promise<void> {
  // Handle configuration validation as a special case
  if (options.validateConfig) {
    return handleConfigValidation(projectPath, options, command);
  }

  // Use standardized command execution pattern
  await executeCommand(
    projectPath,
    options,
    command,
    async (_context: CommandContext) => {
      // Check for dry run mode
      if (options.dryRun) {
        console.log(chalk.blue('\n🔍 DRY RUN MODE - Analysis preview only\n'));
      }

      logger.info(`Starting analysis of project: ${projectPath}`);

      let fileDiscovery: any;
      const analysis = await handleAnalysisOperation(
        async () => {
          // Create a new ConfigurationService for analysis
          const configService = new ConfigurationService({
            projectPath,
            ...(options.config && { customConfigPath: options.config }),
            includeEnvVars: true,
            includeUserConfig: true,
            cliArgs: options,
          });

          // Load configuration before creating FileDiscoveryService
          await configService.loadConfiguration();

          // Create FileDiscoveryService instance
          fileDiscovery = FileDiscoveryServiceFactory.create(configService);

          // Create analyzer with FileDiscoveryService
          const analyzer = new ProjectAnalyzer(projectPath, fileDiscovery);
          return await analyzer.analyzeProject();
        },
        'project analysis',
        projectPath
      );

      // Show pattern analysis if requested
      if (options.showPatterns && fileDiscovery) {
        await displayPatternAnalysis(fileDiscovery, projectPath, analysis, options);
      }

      // Format and display results
      await displayAnalysisResults(analysis, options);

      // Show dry run footer if in dry run mode
      if (options.dryRun) {
        console.log(chalk.blue('\n🔍 Dry run complete - analysis preview only'));
        console.log(chalk.gray('To perform full analysis with file operations:'));
        console.log(chalk.gray('  • Remove --dry-run flag and run the command again'));
      }
    },
    {
      commandName: 'analyze',
      loadingText: 'Analyzing project...',
      showConfigSources: true,
    }
  );
}

async function displayPatternAnalysis(
  fileDiscovery: any,
  projectPath: string,
  _analysis: ProjectAnalysis,
  options: AnalyzeOptions = {}
): Promise<void> {
  // Check if FileDiscoveryService has the analyzeProjectStructure method
  if (typeof fileDiscovery.analyzeProjectStructure === 'function') {
    console.log(chalk.blue('\n🔍 Smart Pattern Analysis'));
    console.log(chalk.blue('========================'));

    try {
      const structureAnalysis = await fileDiscovery.analyzeProjectStructure(projectPath);

      console.log(chalk.cyan('\n📂 Detected Structure:'), structureAnalysis.detectedStructure);
      console.log(
        chalk.cyan('🎯 Confidence:'),
        `${(structureAnalysis.confidence * 100).toFixed(0)}%`
      );

      console.log(chalk.cyan('\n📁 Source Directories:'));
      structureAnalysis.sourceDirectories.forEach((dir: any) => {
        console.log(
          `  • ${dir.path} (${dir.type}, confidence: ${(dir.confidence * 100).toFixed(0)}%)`
        );
      });

      console.log(chalk.cyan('\n🧪 Test Directories:'));
      structureAnalysis.testDirectories.forEach((dir: any) => {
        console.log(`  • ${dir.path} (${dir.type}, framework: ${dir.testFramework || 'unknown'})`);
      });

      console.log(chalk.cyan('\n📋 Suggested Patterns:'));
      console.log(chalk.gray('Include patterns:'));
      structureAnalysis.suggestedPatterns.include.forEach((pattern: string) => {
        console.log(`  • ${pattern}`);
      });

      console.log(chalk.gray('\nTest include patterns:'));
      structureAnalysis.suggestedPatterns.testIncludes.forEach((pattern: string) => {
        console.log(`  • ${pattern}`);
      });

      if (structureAnalysis.monorepoInfo?.isMonorepo) {
        console.log(chalk.cyan('\n📦 Monorepo Detected:'));
        console.log('  Workspaces:', structureAnalysis.monorepoInfo.workspaces.join(', '));
      }
    } catch (error: unknown) {
      console.log(chalk.yellow('⚠️  Could not analyze project structure patterns'));
      if (options.verbose) {
        console.error(error);
      }
    }
  } else {
    console.log(chalk.yellow('\n⚠️  Pattern analysis not available in this version'));
  }
}

async function handleConfigValidation(
  projectPath: string,
  options: AnalyzeOptions,
  command?: Command
): Promise<void> {
  await executeCommand(
    projectPath,
    options,
    command,
    async (context: CommandContext) => {
      // Use configuration from context
      const configResult = context.config.config;

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
    },
    {
      commandName: 'validate-config',
      loadingText: 'Loading and validating configuration...',
      validateConfig: true,
      exitOnConfigError: false, // We handle the exit ourselves
    }
  );
}

async function displayAnalysisResults(
  analysis: ProjectAnalysis,
  options: AnalyzeOptions
): Promise<void> {
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
    const markdown = formatAsMarkdown(analysis);
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
      console.log = (...args: unknown[]) => {
        consoleOutput +=
          args
            .map((arg) => (typeof arg === 'object' ? JSON.stringify(arg) : String(arg)))
            .join(' ') + '\n';
      };

      displayConsoleResults(analysis, options.verbose);

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
      displayConsoleResults(analysis, options.verbose);
    }
  }
}

function displayConsoleResults(analysis: ProjectAnalysis, verbose = false): void {
  console.log(chalk.green('\n✓ Project Analysis Complete\n'));
  console.log(chalk.cyan('📁 Project:'), analysis.projectPath);

  displayLanguages(analysis.languages);
  displayFrameworks(analysis.frameworks);
  displayPackageManagers(analysis.packageManagers);
  displayTestingSetup(analysis.testingSetup);
  displayComplexityMetrics(analysis.complexity);

  if (verbose) {
    displayProjectStructure(analysis.projectStructure);
    displayLargestFiles(analysis.complexity.largestFiles);
  }

  console.log(
    chalk.green('\n✨ Analysis complete! Use --format json or --verbose for more details.\n')
  );
}

function displayLanguages(languages: DetectedLanguage[]): void {
  if (languages.length > 0) {
    console.log(chalk.cyan('\n🔤 Languages:'));
    languages.forEach((lang) => {
      console.log(`  • ${lang.name} (${Math.round(lang.confidence * 100)}% confidence)`);
    });
  }
}

function displayFrameworks(frameworks: DetectedFramework[]): void {
  if (frameworks.length > 0) {
    console.log(chalk.cyan('\n🚀 Frameworks:'));
    frameworks.forEach((framework) => {
      const version = framework.version ? ` v${framework.version}` : '';
      console.log(
        `  • ${framework.name}${version} (${Math.round(framework.confidence * 100)}% confidence)`
      );
    });
  }
}

function displayPackageManagers(packageManagers: DetectedPackageManager[]): void {
  if (packageManagers.length > 0) {
    console.log(chalk.cyan('\n📦 Package Managers:'));
    packageManagers.forEach((pm) => {
      console.log(`  • ${pm.name} (${Math.round(pm.confidence * 100)}% confidence)`);
    });
  }
}

function displayTestingSetup(testingSetup: TestingSetup): void {
  console.log(chalk.cyan('\n🧪 Testing Setup:'));
  console.log(`  • Has tests: ${testingSetup.hasTests ? '✅' : '❌'}`);
  if (testingSetup.testFrameworks.length > 0) {
    console.log(`  • Test frameworks: ${testingSetup.testFrameworks.join(', ')}`);
  }
  if (testingSetup.testFiles.length > 0) {
    console.log(`  • Test files found: ${testingSetup.testFiles.length}`);
  }
}

function displayComplexityMetrics(complexity: ComplexityMetrics): void {
  console.log(chalk.cyan('\n📊 Project Complexity:'));
  console.log(`  • Total files: ${complexity.totalFiles}`);
  console.log(`  • Total lines: ${complexity.totalLines.toLocaleString()}`);
  console.log(`  • Average file size: ${Math.round(complexity.averageFileSize)} lines`);
}

function displayProjectStructure(projectStructure: ProjectStructure): void {
  console.log(chalk.cyan('\n📂 Project Structure:'));

  // Display smart analysis if available
  if (projectStructure.smartAnalysis) {
    const analysis = projectStructure.smartAnalysis;
    console.log(
      `  • Structure Type: ${analysis.detectedStructure} (${Math.round(analysis.confidence * 100)}% confidence)`
    );

    if (analysis.sourceDirectories.length > 0) {
      console.log(`  • Source Directories:`);
      analysis.sourceDirectories.slice(0, 3).forEach((dir) => {
        console.log(
          `    - ${dir.path} (${dir.type}, ${Math.round(dir.confidence * 100)}% confidence, ${dir.fileCount} files)`
        );
      });
    }

    if (analysis.testDirectories.length > 0) {
      console.log(`  • Test Directories:`);
      analysis.testDirectories.slice(0, 3).forEach((dir) => {
        const framework = dir.testFramework ? ` - ${dir.testFramework}` : '';
        console.log(`    - ${dir.path} (${dir.type}${framework})`);
      });
    }

    if (analysis.frameworkIndicators.length > 0) {
      const topFramework = analysis.frameworkIndicators[0];
      if (topFramework) {
        console.log(
          `  • Framework Patterns: ${topFramework.framework} (${Math.round(topFramework.confidence * 100)}% confidence)`
        );
      }
    }

    if (analysis.monorepoInfo?.isMonorepo) {
      console.log(`  • Monorepo: Yes (${analysis.monorepoInfo.workspaces.length} workspaces)`);
    }

    console.log(`  • Suggested Patterns:`);
    console.log(
      `    - Include: ${analysis.suggestedPatterns.include.slice(0, 2).join(', ')}${analysis.suggestedPatterns.include.length > 2 ? '...' : ''}`
    );
    console.log(
      `    - Test: ${analysis.suggestedPatterns.testIncludes.slice(0, 2).join(', ')}${analysis.suggestedPatterns.testIncludes.length > 2 ? '...' : ''}`
    );
  } else {
    // Fallback to basic structure display
    if (projectStructure.srcDirectory) {
      console.log(`  • Source directory: ${projectStructure.srcDirectory}`);
    }
    if (projectStructure.entryPoints.length > 0) {
      console.log(`  • Entry points: ${projectStructure.entryPoints.slice(0, 3).join(', ')}`);
    }
    if (projectStructure.testDirectories.length > 0) {
      console.log(
        `  • Test directories: ${projectStructure.testDirectories.slice(0, 3).join(', ')}`
      );
    }
  }
}

function displayLargestFiles(largestFiles: Array<{ path: string; lines: number }>): void {
  if (largestFiles.length > 0) {
    console.log(chalk.cyan('\n📈 Largest Files:'));
    largestFiles.slice(0, 5).forEach((file) => {
      console.log(`  • ${file.path} (${file.lines} lines)`);
    });
  }
}

function formatAsMarkdown(analysis: ProjectAnalysis): string {
  let markdown = `# Project Analysis Report\n\n`;
  markdown += `**Project:** ${analysis.projectPath}\n\n`;

  // Languages
  if (analysis.languages.length > 0) {
    markdown += `## Languages\n\n`;
    analysis.languages.forEach((lang: DetectedLanguage) => {
      markdown += `- **${lang.name}** (${Math.round(lang.confidence * 100)}% confidence)\n`;
    });
    markdown += '\n';
  }

  // Frameworks
  if (analysis.frameworks.length > 0) {
    markdown += `## Frameworks\n\n`;
    analysis.frameworks.forEach((framework: DetectedFramework) => {
      const version = framework.version ? ` v${framework.version}` : '';
      markdown += `- **${framework.name}**${version} (${Math.round(framework.confidence * 100)}% confidence)\n`;
    });
    markdown += '\n';
  }

  // Testing setup
  markdown += `## Testing Setup\n\n`;
  markdown += `- **Has tests:** ${analysis.testingSetup.hasTests ? '✅ Yes' : '❌ No'}\n`;
  if (analysis.testingSetup.testFrameworks.length > 0) {
    markdown += `- **Test frameworks:** ${analysis.testingSetup.testFrameworks.join(', ')}\n`;
  }
  if (analysis.testingSetup.testFiles.length > 0) {
    markdown += `- **Test files found:** ${analysis.testingSetup.testFiles.length}\n`;
  }
  markdown += '\n';

  // Complexity metrics
  markdown += `## Project Complexity\n\n`;
  markdown += `- **Total files:** ${analysis.complexity.totalFiles}\n`;
  markdown += `- **Total lines:** ${analysis.complexity.totalLines.toLocaleString()}\n`;
  markdown += `- **Average file size:** ${Math.round(analysis.complexity.averageFileSize)} lines\n\n`;

  // Largest files
  if (analysis.complexity.largestFiles.length > 0) {
    markdown += `## Largest Files\n\n`;
    analysis.complexity.largestFiles
      .slice(0, 10)
      .forEach((file: { path: string; lines: number }) => {
        markdown += `- ${file.path} (${file.lines} lines)\n`;
      });
    markdown += '\n';
  }

  // Smart project structure analysis
  if (analysis.projectStructure.smartAnalysis) {
    const smartAnalysis = analysis.projectStructure.smartAnalysis;
    markdown += `## Smart Project Structure Analysis\n\n`;
    markdown += `- **Structure Type:** ${smartAnalysis.detectedStructure} (${Math.round(smartAnalysis.confidence * 100)}% confidence)\n`;

    if (smartAnalysis.sourceDirectories.length > 0) {
      markdown += `- **Source Directories:**\n`;
      smartAnalysis.sourceDirectories.forEach((dir) => {
        markdown += `  - ${dir.path} (${dir.type}, ${Math.round(dir.confidence * 100)}% confidence, ${dir.fileCount} files)\n`;
      });
    }

    if (smartAnalysis.frameworkIndicators.length > 0) {
      markdown += `- **Framework Patterns:**\n`;
      smartAnalysis.frameworkIndicators.forEach((indicator) => {
        markdown += `  - ${indicator.framework} (${Math.round(indicator.confidence * 100)}% confidence)\n`;
      });
    }

    markdown += `- **Suggested Include Patterns:** ${smartAnalysis.suggestedPatterns.include.join(', ')}\n`;
    markdown += `- **Suggested Test Patterns:** ${smartAnalysis.suggestedPatterns.testIncludes.join(', ')}\n`;
    markdown += '\n';
  }

  return markdown;
}
