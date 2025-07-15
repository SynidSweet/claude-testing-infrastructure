# Error Handling Patterns

*Standardized error handling patterns for the Claude Testing Infrastructure*

## Overview

This guide documents the standardized approach to error handling implemented as part of TS-EXCEL-004. All error handling follows TypeScript best practices with proper typing and consistent patterns.

## Error Class Hierarchy

```
ClaudeTestingError (base)
├── AnalysisError
├── FileOperationError
├── ValidationError
├── GenerationError
├── TestExecutionError
├── ConfigurationError
├── CLIError
├── TemplateError
├── RunnerError
├── ServiceError
├── ParserError
├── FactoryError
└── AIError
    ├── AIAuthenticationError
    ├── AITimeoutError
    ├── AIModelError
    ├── AIRateLimitError
    ├── AINetworkError
    ├── AIWorkflowError
    ├── AITaskError
    ├── AIResponseParseError
    └── AICheckpointError
```

## Basic Error Handling Pattern

### ❌ Old Pattern (Untyped)
```typescript
try {
  await someOperation();
} catch (error) {
  // error is implicitly 'any'
  console.error(error.message); // Unsafe!
}
```

### ✅ New Pattern (Type-Safe)
```typescript
import { handleError } from '../utils/error-guards';

try {
  await someOperation();
} catch (error: unknown) {
  const typedError = handleError(error);
  logger.error(typedError.message, typedError.context);
}
```

## Domain-Specific Error Handling

### Using Domain Error Handlers
```typescript
import { handleDomainError } from '../utils/error-guards';

// File operations
try {
  await fs.readFile(path);
} catch (error: unknown) {
  throw handleDomainError(error, 'file', { filePath: path });
}

// Analysis operations
try {
  await analyzeProject(projectPath);
} catch (error: unknown) {
  throw handleDomainError(error, 'analysis', { projectPath });
}

// Configuration operations
try {
  await loadConfig(configPath);
} catch (error: unknown) {
  throw handleDomainError(error, 'configuration', { configPath });
}
```

### Using Safe Wrappers
```typescript
import { safeAsync, safeSync } from '../utils/error-guards';

// Async operations
const result = await safeAsync(
  () => fs.readFile(path, 'utf-8'),
  'file',
  { filePath: path }
);

// Sync operations
const config = safeSync(
  () => JSON.parse(configString),
  'parser',
  { parserType: 'json', input: configString }
);
```

## Result Type Pattern

For operations that can fail in expected ways:

```typescript
import { Result, ok, err, isOk } from '../types/error-types';

async function parseConfig(path: string): Promise<Result<Config, ConfigurationError>> {
  try {
    const content = await fs.readFile(path, 'utf-8');
    const config = JSON.parse(content);
    return ok(config);
  } catch (error: unknown) {
    return err(new ConfigurationError(`Failed to parse config`, path, { error }));
  }
}

// Usage
const result = await parseConfig('config.json');
if (isOk(result)) {
  console.log('Config loaded:', result.value);
} else {
  console.error('Failed to load config:', result.error.message);
}
```

## Error Context Enrichment

```typescript
import { enrichErrorContext } from '../utils/error-guards';

try {
  await riskyOperation();
} catch (error: unknown) {
  const context = enrichErrorContext(error, {
    operation: 'test-generation',
    targetFile: 'src/components/Button.tsx',
    framework: 'react',
  });
  
  logger.error('Operation failed', context);
  throw handleDomainError(error, 'generation', context);
}
```

## CLI Error Handling

```typescript
import { handleCLIError } from '../utils/error-handling';
import { formatErrorForDisplay } from '../utils/error-guards';

export async function runCommand(args: string[]) {
  try {
    await executeCommand(args);
  } catch (error: unknown) {
    // User-friendly error display
    const displayMessage = formatErrorForDisplay(error, args.includes('--verbose'));
    console.error(displayMessage);
    
    // Proper CLI exit
    handleCLIError(error, 'run-command', {
      exitCode: 1,
      showStack: args.includes('--debug'),
      context: { args },
    });
  }
}
```

## Retryable Errors

```typescript
import { isRetryableError } from '../utils/error-guards';
import { retry } from '../utils/retry-helper';

async function fetchWithRetry(url: string) {
  return retry(
    async () => {
      try {
        return await fetch(url);
      } catch (error: unknown) {
        if (isRetryableError(error)) {
          throw error; // Let retry handle it
        }
        // Non-retryable error, fail immediately
        throw handleDomainError(error, 'ai', { url });
      }
    },
    { maxAttempts: 3 }
  );
}
```

## Multiple Error Handling

```typescript
import { aggregateErrors, handleMultipleErrors } from '../utils/error-guards';

async function processMultipleFiles(files: string[]) {
  const errors: unknown[] = [];
  const results: ProcessedFile[] = [];

  for (const file of files) {
    try {
      const result = await processFile(file);
      results.push(result);
    } catch (error: unknown) {
      errors.push(error);
    }
  }

  if (errors.length > 0) {
    // Option 1: Throw aggregate error
    throw aggregateErrors(errors, `Failed to process ${errors.length} files`);
    
    // Option 2: Handle each error
    const typedErrors = handleMultipleErrors(errors);
    typedErrors.forEach(error => {
      logger.error(`File processing failed: ${error.message}`, error.context);
    });
  }

  return results;
}
```

## Type Guards in Catch Blocks

```typescript
import { isNodeSystemError, isAuthError, isFileSystemError } from '../utils/error-guards';

try {
  await someOperation();
} catch (error: unknown) {
  if (isAuthError(error)) {
    // Handle authentication errors
    return { needsAuth: true };
  }
  
  if (isFileSystemError(error)) {
    // Handle file system errors
    if (isNodeSystemError(error) && error.code === 'ENOENT') {
      // File not found - maybe create it
      await createDefaultFile();
      return;
    }
  }
  
  // Other errors
  throw handleError(error);
}
```

## Error Logging Pattern

```typescript
import { logError } from '../utils/error-guards';

class ProjectAnalyzer {
  private logger = getLogger('ProjectAnalyzer');

  async analyze(projectPath: string) {
    try {
      return await this.performAnalysis(projectPath);
    } catch (error: unknown) {
      // Log with context
      logError(error, this.logger, 'Project analysis failed');
      
      // Re-throw typed error
      throw handleDomainError(error, 'analysis', { projectPath });
    }
  }
}
```

## Best Practices

### 1. Always Type Catch Parameters
```typescript
// ❌ Bad
catch (error) { }

// ✅ Good
catch (error: unknown) { }
```

### 2. Use Domain-Specific Errors
```typescript
// ❌ Bad
throw new Error('Config not found');

// ✅ Good
throw new ConfigurationError('Config not found', configPath);
```

### 3. Preserve Error Context
```typescript
// ❌ Bad
catch (error: unknown) {
  throw new Error('Operation failed');
}

// ✅ Good
catch (error: unknown) {
  throw handleDomainError(error, 'operation', { 
    originalError: error,
    context: additionalInfo 
  });
}
```

### 4. Use Type Guards for Conditional Handling
```typescript
// ❌ Bad
catch (error: any) {
  if (error.code === 'ENOENT') { }
}

// ✅ Good
catch (error: unknown) {
  if (isNodeSystemError(error) && error.code === 'ENOENT') { }
}
```

### 5. Provide Actionable Error Messages
```typescript
// ❌ Bad
throw new Error('Invalid config');

// ✅ Good
throw new ConfigurationError(
  `Invalid configuration in ${configPath}: missing required field 'testFramework'`,
  configPath,
  { missingField: 'testFramework' }
);
```

## Migration Guide

To migrate existing code to the new error handling patterns:

1. **Add error type imports**:
   ```typescript
   import { handleError, handleDomainError } from '../utils/error-guards';
   ```

2. **Update catch blocks**:
   ```typescript
   // Change from:
   catch (error) {
     console.error(error.message);
   }
   
   // To:
   catch (error: unknown) {
     const typedError = handleError(error);
     logger.error(typedError.message, typedError.context);
   }
   ```

3. **Use domain-specific handlers**:
   ```typescript
   // For file operations:
   catch (error: unknown) {
     throw handleDomainError(error, 'file', { filePath });
   }
   ```

4. **Replace type assertions**:
   ```typescript
   // Change from:
   const message = (error as Error).message;
   
   // To:
   const message = getErrorMessage(error);
   ```

## Testing Error Handling

```typescript
import { ConfigurationError } from '../types/error-types';

describe('Config loading', () => {
  it('should handle missing config file', async () => {
    await expect(loadConfig('nonexistent.json'))
      .rejects
      .toThrow(ConfigurationError);
  });

  it('should provide proper error context', async () => {
    try {
      await loadConfig('invalid.json');
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigurationError);
      expect((error as ConfigurationError).configPath).toBe('invalid.json');
    }
  });
});
```

## Summary

The standardized error handling system provides:

1. **Type Safety**: All errors are properly typed with no implicit `any`
2. **Consistency**: Same patterns used throughout the codebase
3. **Context Preservation**: Error context is maintained through the stack
4. **Domain Specificity**: Errors are categorized by domain for better handling
5. **User Experience**: Better error messages and actionable feedback

By following these patterns, we ensure robust error handling that makes debugging easier and improves the overall reliability of the system.