# CLI Development Guidelines

*Comprehensive guide for developing CLI commands in the Claude Testing Infrastructure*

*Created: 2025-07-09 | Based on CLI standardization work*

## 🎯 Purpose

This guide provides patterns, templates, and best practices for developing CLI commands in the Claude Testing Infrastructure. It ensures consistency, maintainability, and type safety across all CLI commands.

## 📋 Architecture Overview

### CLI Command Structure
```
src/cli/
├── index.ts              # Main CLI entry point with Commander.js setup
├── commands/             # Individual command implementations
│   ├── analyze.ts        # Project analysis command
│   ├── test.ts           # Test generation command
│   ├── run.ts            # Test execution command
│   └── ...               # Other commands
└── utils/                # Standardized CLI utilities
    ├── config-loader.ts  # Configuration loading patterns
    ├── error-handler.ts  # Error handling utilities
    └── command-patterns.ts # Command execution patterns
```

### Standardized Utilities

All CLI commands should use these standardized utilities:

1. **Configuration Loading** (`config-loader.ts`)
   - Consistent configuration loading across commands
   - Type-safe parent option access
   - Standardized validation and error handling

2. **Error Handling** (`error-handler.ts`)
   - Consistent error messages and exit codes
   - Structured error context and suggestions
   - User-friendly error display

3. **Command Patterns** (`command-patterns.ts`)
   - Standardized command execution wrappers
   - Configuration validation and spinner management
   - Common patterns for different command types

## 🏗️ Command Development Templates

### Basic Command Template

```typescript
import { chalk, ora, logger } from '../../utils/common-imports';
import {
  analysisCommand,
  type StandardCliOptions,
} from '../utils';

export interface MyCommandOptions extends StandardCliOptions {
  // Add command-specific options
  output?: string;
  format?: 'json' | 'markdown' | 'console';
  someFlag?: boolean;
}

export async function myCommand(
  projectPath: string,
  options: MyCommandOptions = {},
  command?: { parent?: { opts: () => { showConfigSources?: boolean } } }
): Promise<void> {
  // Use appropriate command pattern based on command type
  return analysisCommand(
    projectPath,
    options,
    command,
    async (context) => {
      // Command implementation goes here
      logger.info(`Starting operation for project: ${projectPath}`);
      
      // Access configuration through context.config
      const config = context.config.config;
      
      // Perform command logic
      await performOperation(config, options);
      
      // Display results
      displayResults(options);
    },
    'my-command'
  );
}

async function performOperation(config: any, options: MyCommandOptions): Promise<void> {
  // Implementation details
}

function displayResults(options: MyCommandOptions): void {
  // Result display logic
}
```

### Command Pattern Selection

Choose the appropriate command pattern based on your command type:

#### 1. Analysis Commands
```typescript
import { analysisCommand } from '../utils';

// For commands that analyze projects (analyze, analyze-gaps)
return analysisCommand(projectPath, options, command, async (context) => {
  // Analysis logic
}, 'analysis-command');
```

#### 2. Generation Commands
```typescript
import { generationCommand } from '../utils';

// For commands that generate files or content (test, generate-logical)
return generationCommand(projectPath, options, command, async (context) => {
  // Generation logic
}, 'generation-command');
```

#### 3. Simple Commands
```typescript
import { simpleCommand } from '../utils';

// For simple operations (run, watch)
return simpleCommand(projectPath, options, command, async (context) => {
  // Simple operation logic
}, 'simple-command');
```

#### 4. Configuration Commands
```typescript
import { executeConfigCommand } from '../utils';

// For commands that primarily work with configuration (init-config)
return executeConfigCommand(projectPath, options, command, async (context) => {
  // Configuration-focused logic
});
```

## 🔧 Configuration Loading Patterns

### Standard Configuration Loading

```typescript
import { loadStandardConfiguration } from '../utils/config-loader';

// Load configuration with standardized error handling
const configResult = await loadStandardConfiguration(projectPath, {
  customConfigPath: options.config,
  cliArgs: options,
  validateConfig: true,
  exitOnValidationError: true,
  logValidationWarnings: true,
});

// Access configuration
const config = configResult.config;
```

### Parent Options Access

```typescript
import { getParentOptions } from '../utils/config-loader';

// Type-safe parent option access
const parentOptions = getParentOptions(command);

// Check for global flags
if (parentOptions.showConfigSources) {
  displayConfigurationSources(configResult);
}
```

### Configuration Service Integration

```typescript
import { createConfigurationService } from '../utils/config-loader';

// Create configuration service with standardized options
const configService = createConfigurationService(projectPath, {
  customConfigPath: options.config,
  cliArgs: options,
  includeEnvVars: true,
  includeUserConfig: true,
});

const configResult = await configService.loadConfiguration();
```

## 🚨 Error Handling Patterns

### Command Execution Wrapper

```typescript
import { executeCLICommand } from '../utils/error-handler';

// Wrap command execution with standardized error handling
return executeCLICommand('my-command', async () => {
  // Command implementation
  await performOperation();
}, {
  errorType: CLIErrorType.OPERATION_FAILED,
  operation: 'my operation',
  projectPath,
});
```

### Specific Error Types

```typescript
import { 
  handleConfigurationError,
  handleValidationError,
  handleFileOperationError,
  handleArgumentValidationError 
} from '../utils/error-handler';

// Configuration errors
try {
  await loadConfiguration();
} catch (error) {
  handleConfigurationError(error, {
    projectPath,
    configPath: options.config,
    suggestions: ['Check configuration file syntax', 'Verify file permissions'],
  });
}

// Validation errors
try {
  validateArguments(options);
} catch (error) {
  handleValidationError(error, {
    projectPath,
    validationIssues: ['Invalid output format', 'Missing required option'],
    suggestions: ['Use --format json|markdown|console', 'Provide required options'],
  });
}

// File operation errors
try {
  await writeOutputFile(outputPath, content);
} catch (error) {
  handleFileOperationError(error, {
    projectPath,
    filePath: outputPath,
    operation: 'writing output file',
    suggestions: ['Check directory permissions', 'Ensure parent directory exists'],
  });
}
```

### Creating Custom Errors

```typescript
import { createCLIError, CLIErrorType } from '../utils/error-handler';

// Create structured CLI errors
const error = createCLIError(
  'Operation failed due to invalid configuration',
  CLIErrorType.CONFIGURATION_ERROR,
  {
    projectPath,
    configPath: options.config,
    suggestions: ['Check configuration syntax', 'Verify required fields'],
  }
);

throw error;
```

## 📝 Option Interface Design

### Standard Options Pattern

```typescript
import { type StandardCliOptions } from '../utils';

// Extend StandardCliOptions for command-specific options
export interface MyCommandOptions extends StandardCliOptions {
  // Command-specific options
  output?: string;
  format?: 'json' | 'markdown' | 'console';
  someFlag?: boolean;
  
  // Optional: Override standard option types if needed
  verbose?: boolean; // Already included in StandardCliOptions
}
```

### Option Validation

```typescript
import { validateCliOptions } from '../utils/config-loader';

// Validate CLI options with standardized patterns
const validation = validateCliOptions(options, ['requiredOption']);

if (!validation.isValid) {
  handleArgumentValidationError(
    new Error('Invalid command options'),
    {
      suggestions: validation.errors,
    }
  );
}
```

## 🧪 Testing CLI Commands

### Test Structure Template

```typescript
// tests/cli/commands/my-command.test.ts
import { jest } from '@jest/globals';
import { myCommand } from '../../../src/cli/commands/my-command';
import type { MyCommandOptions } from '../../../src/cli/commands/my-command';

describe('myCommand', () => {
  const mockProjectPath = '/test/project';
  const mockOptions: MyCommandOptions = {
    verbose: false,
    output: '/test/output.json',
    format: 'json',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should execute command successfully with valid options', async () => {
    // Test implementation
    await expect(myCommand(mockProjectPath, mockOptions)).resolves.not.toThrow();
  });

  it('should handle configuration errors gracefully', async () => {
    // Test error handling
    const invalidOptions = { ...mockOptions, config: '/nonexistent/config.json' };
    await expect(myCommand(mockProjectPath, invalidOptions)).rejects.toThrow();
  });

  it('should validate required options', async () => {
    // Test option validation
    const incompleteOptions = {};
    await expect(myCommand(mockProjectPath, incompleteOptions)).rejects.toThrow();
  });
});
```

### Mock Patterns

```typescript
// Mock standardized utilities
jest.mock('../../../src/cli/utils', () => ({
  analysisCommand: jest.fn(),
  loadStandardConfiguration: jest.fn(),
  getParentOptions: jest.fn(() => ({})),
}));

// Mock specific services
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
```

## 📊 Progress Reporting Patterns

### Spinner Usage

```typescript
import { ora } from '../../utils/common-imports';

// Standard spinner pattern
const spinner = ora('Loading configuration...').start();

try {
  await performOperation();
  spinner.succeed('Operation completed successfully');
} catch (error) {
  spinner.fail('Operation failed');
  throw error;
}
```

### Progress Updates

```typescript
import { ProgressReporter } from '../../utils/ProgressReporter';

// Use ProgressReporter for complex operations
const progressReporter = new ProgressReporter(options.verbose || false);

// Report progress during operations
progressReporter.updateProgress(50, 'Processing files...');
progressReporter.updateProgress(100, 'Operation completed');
```

## 🎨 Output Formatting Patterns

### Console Output

```typescript
import { chalk } from '../../utils/common-imports';

// Success messages
console.log(chalk.green('\n✓ Operation completed successfully\n'));

// Information
console.log(chalk.cyan('📊 Results:'));
console.log(`  • Files processed: ${count}`);

// Warnings
console.log(chalk.yellow('\n⚠️  Warnings:'));
warnings.forEach(warning => {
  console.log(chalk.yellow(`  • ${warning}`));
});

// Errors
console.log(chalk.red('\n❌ Errors:'));
errors.forEach(error => {
  console.log(chalk.red(`  • ${error}`));
});

// Verbose output
if (options.verbose) {
  console.log(chalk.gray('\n🔍 Detailed information:'));
  console.log(chalk.gray(`  • Debug data: ${debugInfo}`));
}
```

### Output Format Support

```typescript
// Support multiple output formats
async function displayResults(results: any, options: MyCommandOptions): Promise<void> {
  switch (options.format) {
    case 'json':
      const jsonOutput = JSON.stringify(results, null, 2);
      console.log(jsonOutput);
      
      if (options.output) {
        await writeFile(options.output, jsonOutput);
        console.log(chalk.green(`\n✓ Results saved to ${options.output}`));
      }
      break;
      
    case 'markdown':
      const markdown = formatAsMarkdown(results);
      console.log(markdown);
      
      if (options.output) {
        await writeFile(options.output, markdown);
        console.log(chalk.green(`\n✓ Results saved to ${options.output}`));
      }
      break;
      
    case 'console':
    default:
      displayConsoleResults(results, options.verbose);
      break;
  }
}
```

## 🔍 Command Registration

### Main CLI Entry Point

```typescript
// src/cli/index.ts
import { Command } from 'commander';
import { myCommand } from './commands/my-command';

const program = new Command();

// Register command with standardized pattern
program
  .command('my-command <projectPath>')
  .description('Description of my command')
  .option('-o, --output <path>', 'Output file path')
  .option('-f, --format <format>', 'Output format (json|markdown|console)', 'console')
  .option('--some-flag', 'Enable some feature')
  .action(async (projectPath: string, options: any) => {
    try {
      await myCommand(projectPath, options, program.commands.find(cmd => cmd.name() === 'my-command'));
    } catch (error) {
      // Error handling is done within the command
      process.exit(1);
    }
  });
```

## 📚 Best Practices

### 1. Type Safety

- Always extend `StandardCliOptions` for command options
- Use proper TypeScript interfaces for all data structures
- Avoid `any` types - use proper type guards when needed

### 2. Error Handling

- Use standardized error handling utilities
- Provide helpful error messages and suggestions
- Include context information for debugging
- Always handle configuration and validation errors gracefully

### 3. Configuration

- Use standardized configuration loading patterns
- Support all configuration sources (file, env vars, CLI args)
- Validate configuration before proceeding
- Display configuration sources when requested

### 4. User Experience

- Provide progress feedback for long operations
- Support verbose mode for debugging
- Use consistent output formatting
- Include helpful suggestions in error messages

### 5. Testing

- Test all error conditions
- Mock external dependencies
- Test configuration loading and validation
- Verify output formatting

### 6. Documentation

- Include clear command descriptions
- Document all options and their effects
- Provide usage examples
- Include troubleshooting information

## 🚀 Command Creation Checklist

When creating a new CLI command:

- [ ] Create command file in `src/cli/commands/`
- [ ] Define options interface extending `StandardCliOptions`
- [ ] Use appropriate command pattern (analysis/generation/simple/config)
- [ ] Implement standardized configuration loading
- [ ] Add proper error handling with suggestions
- [ ] Include progress reporting for long operations
- [ ] Support multiple output formats if applicable
- [ ] Write comprehensive tests
- [ ] Register command in main CLI entry point
- [ ] Update documentation

## 🔗 Related Documentation

- **Configuration System**: [`/docs/configuration.md`](../configuration.md)
- **Error Handling**: [`/src/utils/error-handling.ts`](../../src/utils/error-handling.ts)
- **CLI Utilities**: [`/src/cli/utils/`](../../src/cli/utils/)
- **Testing Patterns**: [`/docs/testing/`](../testing/)

---

**Version**: 1.0.0 | **Last Updated**: 2025-07-09 | **Based on**: CLI standardization work completed in July 2025