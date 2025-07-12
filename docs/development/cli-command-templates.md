# CLI Command Templates

*Ready-to-use templates for creating new CLI commands*

*Created: 2025-07-09 | For Claude Testing Infrastructure CLI development*

## 🎯 Purpose

This document provides copy-paste templates for creating new CLI commands that follow established patterns and best practices.

## 📋 Template Categories

### 1. Basic Analysis Command Template

```typescript
// src/cli/commands/new-analysis-command.ts
import { chalk, ora, logger } from '../../utils/common-imports';
import type {
  ProjectAnalysis,
  // Add other needed types
} from '../../utils/analyzer-imports';
import { ProjectAnalyzer } from '../../utils/analyzer-imports';
import { ConfigurationService } from '../../config/ConfigurationService';
import { FileDiscoveryServiceFactory } from '../../services/FileDiscoveryServiceFactory';
import {
  handleAnalysisOperation,
  handleFileOperation,
} from '../../utils/error-handling';
import {
  analysisCommand,
  type StandardCliOptions,
} from '../utils';

export interface NewAnalysisCommandOptions extends StandardCliOptions {
  output?: string;
  format?: 'json' | 'markdown' | 'console';
  someFlag?: boolean;
}

export async function newAnalysisCommand(
  projectPath: string,
  options: NewAnalysisCommandOptions = {},
  command?: { parent?: { opts: () => { showConfigSources?: boolean } } }
): Promise<void> {
  return analysisCommand(
    projectPath,
    options,
    command,
    async (context) => {
      logger.info(`Starting analysis operation for project: ${projectPath}`);

      // Perform analysis using the configuration from context
      const analysis = await handleAnalysisOperation(
        async () => {
          // Create services using context configuration
          const configService = new ConfigurationService({
            projectPath,
            ...(options.config && { customConfigPath: options.config }),
            includeEnvVars: true,
            includeUserConfig: true,
            cliArgs: options as any,
          });

          await configService.loadConfiguration();
          const fileDiscovery = FileDiscoveryServiceFactory.create(configService);
          const analyzer = new ProjectAnalyzer(projectPath, fileDiscovery);
          
          // Perform your specific analysis
          const results = await analyzer.analyzeProject();
          return processAnalysisResults(results, options);
        },
        'new analysis operation',
        projectPath
      );

      // Display results
      await displayAnalysisResults(analysis, options);
    },
    'new-analysis-command'
  );
}

async function processAnalysisResults(
  analysis: ProjectAnalysis,
  options: NewAnalysisCommandOptions
): Promise<any> {
  // Add your analysis processing logic here
  return {
    projectPath: analysis.projectPath,
    // Add processed results
  };
}

async function displayAnalysisResults(
  results: any,
  options: NewAnalysisCommandOptions
): Promise<void> {
  if (options.format === 'json') {
    const output = JSON.stringify(results, null, 2);
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
    const markdown = formatAsMarkdown(results);
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
    displayConsoleResults(results, options.verbose);
  }
}

function formatAsMarkdown(results: any): string {
  let markdown = `# Analysis Report\n\n`;
  markdown += `**Project:** ${results.projectPath}\n\n`;
  
  // Add your markdown formatting logic
  
  return markdown;
}

function displayConsoleResults(results: any, verbose = false): void {
  console.log(chalk.green('\n✓ Analysis Complete\n'));
  console.log(chalk.cyan('📁 Project:'), results.projectPath);

  // Add your console output logic

  console.log(chalk.green('\n✨ Analysis complete!\n'));
}
```

### 2. Generation Command Template

```typescript
// src/cli/commands/new-generation-command.ts
import { chalk, ora, fs, path, logger } from '../../utils/common-imports';
import type { Command } from 'commander';
import { ConfigurationService } from '../../config/ConfigurationService';
import {
  ProjectAnalyzer,
  type ProjectAnalysis,
} from '../../utils/analyzer-imports';
import {
  handleAnalysisOperation,
  handleValidation,
} from '../../utils/error-handling';
import { FileDiscoveryServiceFactory } from '../../services/FileDiscoveryServiceFactory';
import {
  generationCommand,
  type StandardCliOptions,
} from '../utils';

export interface NewGenerationCommandOptions extends StandardCliOptions {
  output?: string;
  update?: boolean;
  force?: boolean;
  dryRun?: boolean;
}

export async function newGenerationCommand(
  projectPath: string,
  options: NewGenerationCommandOptions = {},
  command?: Command
): Promise<void> {
  return generationCommand(
    projectPath,
    options,
    command,
    async (context) => {
      logger.info(`Starting generation for project: ${projectPath}`);

      if (options.dryRun) {
        console.log(chalk.yellow('\n🔍 DRY RUN MODE - No files will be created'));
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
      const analysis = await handleAnalysisOperation(
        async () => {
          const configService = new ConfigurationService({ projectPath });
          await configService.loadConfiguration();
          const fileDiscovery = FileDiscoveryServiceFactory.create(configService);
          const analyzer = new ProjectAnalyzer(projectPath, fileDiscovery);
          return await analyzer.analyzeProject();
        },
        'project analysis for generation',
        projectPath
      );

      // Step 3: Load configuration
      const config = await loadGenerationConfig(projectPath, analysis, options);

      // Step 4: Generate files
      const results = await performGeneration(config, analysis, options);

      // Step 5: Write files or show dry-run preview
      if (options.dryRun) {
        showDryRunPreview(results, options);
      } else {
        await writeGeneratedFiles(results, options);
        displayResults(results, options);
      }
    },
    'new-generation-command'
  );
}

interface GenerationConfig {
  projectPath: string;
  outputPath: string;
  // Add your config properties
}

interface GenerationResults {
  files: Array<{
    path: string;
    content: string;
    type: string;
  }>;
  stats: {
    filesGenerated: number;
    generationTime: number;
  };
}

async function loadGenerationConfig(
  projectPath: string,
  analysis: ProjectAnalysis,
  options: NewGenerationCommandOptions
): Promise<GenerationConfig> {
  const outputPath = path.join(projectPath, '.claude-testing');

  if (!options.dryRun) {
    await fs.mkdir(outputPath, { recursive: true });
  }

  // Add your configuration loading logic

  return {
    projectPath,
    outputPath,
    // Add your config properties
  };
}

async function performGeneration(
  config: GenerationConfig,
  analysis: ProjectAnalysis,
  options: NewGenerationCommandOptions
): Promise<GenerationResults> {
  const startTime = Date.now();

  // Add your generation logic here
  const files: Array<{ path: string; content: string; type: string }> = [];

  // Example generation
  // files.push({
  //   path: path.join(config.outputPath, 'generated-file.ts'),
  //   content: 'export const generated = true;',
  //   type: 'typescript'
  // });

  return {
    files,
    stats: {
      filesGenerated: files.length,
      generationTime: Date.now() - startTime,
    },
  };
}

async function writeGeneratedFiles(
  results: GenerationResults,
  options: NewGenerationCommandOptions
): Promise<void> {
  for (const file of results.files) {
    await fs.mkdir(path.dirname(file.path), { recursive: true });
    await fs.writeFile(file.path, file.content);
    
    if (options.verbose) {
      console.log(chalk.gray(`  ✓ ${file.path}`));
    }
  }
}

function showDryRunPreview(
  results: GenerationResults,
  options: NewGenerationCommandOptions
): void {
  console.log(chalk.blue('\n🔍 Dry Run Preview:\n'));
  
  results.files.forEach(file => {
    const fileSize = Math.round((file.content.length / 1024) * 10) / 10;
    console.log(chalk.gray(`  📄 ${path.basename(file.path)} (${fileSize} KB, ${file.type})`));
  });

  console.log(chalk.cyan(`\n📊 Total files that would be generated: ${results.files.length}`));
}

function displayResults(
  results: GenerationResults,
  options: NewGenerationCommandOptions
): void {
  console.log(chalk.green('\n✓ Generation completed successfully\n'));
  console.log(chalk.cyan('📊 Generation Statistics:'));
  console.log(`  • Files generated: ${results.stats.filesGenerated}`);
  console.log(`  • Generation time: ${results.stats.generationTime}ms`);
}
```

### 3. Simple Command Template

```typescript
// src/cli/commands/new-simple-command.ts
import { chalk, ora, logger } from '../../utils/common-imports';
import { ConfigurationService } from '../../config/ConfigurationService';
import {
  handleFileOperation,
} from '../../utils/error-handling';
import {
  simpleCommand,
  type StandardCliOptions,
} from '../utils';

export interface NewSimpleCommandOptions extends StandardCliOptions {
  output?: string;
  someOption?: string;
}

export async function newSimpleCommand(
  projectPath: string,
  options: NewSimpleCommandOptions = {},
  command?: { parent?: { opts: () => { showConfigSources?: boolean } } }
): Promise<void> {
  return simpleCommand(
    projectPath,
    options,
    command,
    async (context) => {
      logger.info(`Starting simple operation for project: ${projectPath}`);

      // Access configuration from context
      const config = context.config.config;

      // Perform simple operation
      const results = await performSimpleOperation(config, options);

      // Handle output if specified
      if (options.output) {
        await handleFileOperation(
          async () => {
            const fs = await import('fs/promises');
            await fs.writeFile(options.output!, JSON.stringify(results, null, 2));
          },
          `writing output to file`,
          options.output
        );
        console.log(chalk.green(`\n✓ Results saved to ${options.output}`));
      } else {
        displayResults(results, options);
      }
    },
    'new-simple-command'
  );
}

async function performSimpleOperation(
  config: any,
  options: NewSimpleCommandOptions
): Promise<any> {
  // Add your operation logic here
  return {
    success: true,
    // Add your results
  };
}

function displayResults(results: any, options: NewSimpleCommandOptions): void {
  console.log(chalk.green('\n✓ Operation completed successfully\n'));
  
  // Add your result display logic
  
  if (options.verbose) {
    console.log(chalk.gray('🔍 Detailed information:'));
    console.log(chalk.gray(JSON.stringify(results, null, 2)));
  }
}
```

### 4. Configuration Command Template

```typescript
// src/cli/commands/new-config-command.ts
import { chalk, ora, logger } from '../../utils/common-imports';
import { ConfigurationService } from '../../config/ConfigurationService';
import { displayConfigurationSources } from '../../utils/config-display';
import {
  executeConfigCommand,
  type StandardCliOptions,
} from '../utils';

export interface NewConfigCommandOptions extends StandardCliOptions {
  validate?: boolean;
  showSources?: boolean;
}

export async function newConfigCommand(
  projectPath: string,
  options: NewConfigCommandOptions = {},
  command?: { parent?: { opts: () => { showConfigSources?: boolean } } }
): Promise<void> {
  return executeConfigCommand(
    projectPath,
    options,
    command,
    async (context) => {
      logger.info(`Starting configuration operation for project: ${projectPath}`);

      // Access loaded configuration
      const configResult = context.config;

      // Perform configuration-specific operations
      if (options.validate) {
        await validateConfiguration(configResult);
      }

      if (options.showSources) {
        displayConfigurationSources(configResult.config);
      }

      // Add your configuration logic here
      await performConfigOperation(configResult, options);
    }
  );
}

async function validateConfiguration(configResult: any): Promise<void> {
  console.log(chalk.blue('\n📋 Configuration Validation Results'));
  console.log(chalk.blue('====================================='));

  if (configResult.isValid) {
    console.log(chalk.green('✓ Configuration is valid'));
    if (configResult.warnings.length > 0) {
      console.log(chalk.yellow('\n⚠️  Warnings:'));
      configResult.warnings.forEach((warning: string) => 
        console.log(chalk.yellow(`  • ${warning}`))
      );
    }
  } else {
    console.log(chalk.red('✗ Configuration validation failed'));
    console.log(chalk.red('\nErrors:'));
    configResult.errors.forEach((error: string) => 
      console.log(chalk.red(`  • ${error}`))
    );
  }
}

async function performConfigOperation(
  configResult: any,
  options: NewConfigCommandOptions
): Promise<void> {
  // Add your configuration operation logic here
  
  console.log(chalk.green('\n✓ Configuration operation completed successfully'));
}
```

## 🧪 Test Templates

### Basic Command Test Template

```typescript
// tests/cli/commands/new-command.test.ts
import { jest } from '@jest/globals';
import { newCommand } from '../../../src/cli/commands/new-command';
import type { NewCommandOptions } from '../../../src/cli/commands/new-command';

// Mock dependencies
jest.mock('../../../src/cli/utils', () => ({
  analysisCommand: jest.fn(),
  loadStandardConfiguration: jest.fn(),
  getParentOptions: jest.fn(() => ({})),
}));

jest.mock('../../../src/config/ConfigurationService', () => ({
  ConfigurationService: jest.fn().mockImplementation(() => ({
    loadConfiguration: jest.fn().mockResolvedValue({
      valid: true,
      config: {},
      errors: [],
      warnings: [],
    }),
  })),
}));

describe('newCommand', () => {
  const mockProjectPath = '/test/project';
  const mockOptions: NewCommandOptions = {
    verbose: false,
    output: '/test/output.json',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should execute command successfully with valid options', async () => {
    await expect(newCommand(mockProjectPath, mockOptions)).resolves.not.toThrow();
  });

  it('should handle missing project path', async () => {
    await expect(newCommand('', mockOptions)).rejects.toThrow();
  });

  it('should handle configuration errors gracefully', async () => {
    const invalidOptions = { ...mockOptions, config: '/nonexistent/config.json' };
    // Add your error handling test logic
  });

  it('should support dry-run mode', async () => {
    const dryRunOptions = { ...mockOptions, dryRun: true };
    await expect(newCommand(mockProjectPath, dryRunOptions)).resolves.not.toThrow();
  });

  it('should handle verbose mode', async () => {
    const verboseOptions = { ...mockOptions, verbose: true };
    await expect(newCommand(mockProjectPath, verboseOptions)).resolves.not.toThrow();
  });
});
```

## 📝 CLI Registration Template

```typescript
// Add to src/cli/index.ts
import { newCommand } from './commands/new-command';

// In the main function where commands are registered:
program
  .command('new-command <projectPath>')
  .description('Description of the new command')
  .option('-o, --output <path>', 'Output file path')
  .option('--some-option <value>', 'Some option description')
  .option('--some-flag', 'Enable some feature')
  .action(async (projectPath: string, options: any) => {
    try {
      await newCommand(
        projectPath, 
        options, 
        program.commands.find(cmd => cmd.name() === 'new-command')
      );
    } catch (error) {
      // Error handling is done within the command
      process.exit(1);
    }
  });
```

## 🎯 Quick Start Checklist

To create a new CLI command:

1. **Choose Template**: Select the appropriate template based on command type
2. **Copy Template**: Copy the relevant template to `src/cli/commands/your-command.ts`
3. **Customize Options**: Define your command-specific options interface
4. **Implement Logic**: Add your command-specific implementation
5. **Create Tests**: Copy and customize the test template
6. **Register Command**: Add command registration to `src/cli/index.ts`
7. **Update Documentation**: Document your new command

## 🔗 Related Files

- **CLI Guidelines**: [`cli-development-guidelines.md`](./cli-development-guidelines.md)
- **CLI Utilities**: [`/src/cli/utils/`](../../src/cli/utils/)
- **Error Handling**: [`/src/utils/error-handling.ts`](../../src/utils/error-handling.ts)
- **Configuration**: [`/src/config/ConfigurationService.ts`](../../src/config/ConfigurationService.ts)

---

**Version**: 1.0.0 | **Created**: 2025-07-09 | **Purpose**: Standardized CLI command development templates