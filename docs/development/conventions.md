# Development Conventions

*Last updated: 2025-07-13 | Updated by: /document command | TypeScript type safety enhanced - all 'any' types eliminated in adapter system, strict type enforcement achieved*

## Code Organization

### Directory Structure

```
src/
├── analyzers/        # Project analysis components
├── generators/       # Test generation logic
│   └── templates/    # Test templates by language/framework
├── runners/          # Test execution engines
├── ai/              # AI integration components
│   └── heartbeat/   # Process health monitoring
├── config/          # Configuration management
│   └── loaders/     # Configuration source loaders
├── services/        # Shared services
├── state/           # State management
├── types/           # TypeScript type definitions
├── utils/           # Utility functions
└── cli/             # Command-line interface
    ├── commands/    # Individual CLI commands
    └── utils/       # CLI-specific utilities
```

### File Naming

- **Source files**: `kebab-case.ts` (e.g., `project-analyzer.ts`)
- **Test files**: `*.test.ts` or `*.spec.ts`
- **Type files**: `*-types.ts` for type definitions
- **Constants**: `*-constants.ts` for shared constants
- **Interfaces**: No `I` prefix (e.g., `ProjectAnalysis` not `IProjectAnalysis`)

### Module Organization

Each module should follow this structure:

```typescript
// 1. Imports (external first, then internal)
import { external } from 'package';
import { internal } from '../utils';

// 2. Types and interfaces
interface ModuleOptions {
  // ...
}

// 3. Constants
const DEFAULT_OPTIONS: ModuleOptions = {
  // ...
};

// 4. Main class/function
export class ModuleName {
  // ...
}

// 5. Helper functions (if needed)
function helperFunction(): void {
  // ...
}
```

## Naming Conventions

### Basic Naming Rules
- **Functions/Variables**: camelCase (`analyzeProject`, `testConfig`)
- **Classes**: PascalCase (`ProjectAnalyzer`, `TestGenerator`)
- **Files**: kebab-case (`project-analyzer.ts`, `test-runner.ts`)
- **Directories**: kebab-case (`cli/commands`, `analyzers`)
- **Constants**: SCREAMING_SNAKE_CASE (`DEFAULT_TIMEOUT`, `MAX_RETRIES`)

### AI-Friendly Function Naming

Functions should be **self-documenting** and clearly indicate their purpose:

#### Domain-Specific Naming
- **Include domain context**: `analyzeCoverage()` → `analyzeStructuralTestCoverage()`
- **Specify operation scope**: `identifyGaps()` → `identifyLogicalTestingGaps()`
- **Clarify data type**: `calculateComplexity()` → `calculateCodeComplexityMetrics()`
- **Indicate target context**: `extractTestContext()` → `extractAITestContext()`

#### Examples
```typescript
// ❌ Bad - Generic/unclear names
analyze()
generate()
processSingle()

// ✅ Good - Self-documenting names
analyzeStructuralTestCoverage()
generateJavaScriptTestForFile()
processSingleCoverageSource()
```

## TypeScript Standards

### Strict Mode

The project uses TypeScript strict mode. Follow these rules:

```typescript
// ❌ Bad - Implicit any
function process(data) {
  return data.map(item => item.value);
}

// ✅ Good - Explicit types
function process(data: DataItem[]): number[] {
  return data.map(item => item.value);
}
```

### Type Definitions

1. **Use interfaces for objects**:
```typescript
// ✅ Good
interface UserConfig {
  name: string;
  options?: ConfigOptions;
}

// ❌ Avoid type aliases for objects
type UserConfig = {
  name: string;
  options?: ConfigOptions;
};
```

2. **Use discriminated unions**:
```typescript
// ✅ Good
type Result = 
  | { type: 'success'; data: string }
  | { type: 'error'; error: Error };

// ❌ Bad
type Result = {
  success: boolean;
  data?: string;
  error?: Error;
};
```

3. **Avoid `any` types**:
```typescript
// ❌ Bad
catch (error: any) {
  console.error(error);
}

// ✅ Good
catch (error: unknown) {
  if (error instanceof Error) {
    console.error(error.message);
  }
}
```

### Recent Type Safety Improvements

**CICD-FIX-001 Completed (2025-07-13)**: Enhanced type safety across adapter system by eliminating all `any` types:

1. **Adapter System**: Added proper interfaces for `PackageJsonContent`, `FileDiscoveryStats`, and `AdapterTestRunResult`
2. **AI Types**: Replaced dynamic imports with proper type imports for `AITask`, `AITaskResult`, and `AITaskBatch`
3. **Method Signatures**: Enhanced return types and removed unnecessary async keywords
4. **Public Interfaces**: Added public wrapper methods for adapter access to protected functionality

**Key Files Enhanced**:
- `src/adapters/AdapterFactory.ts` - Fixed duplicate imports, added type constraints
- `src/adapters/JavaScriptAdapter.ts` - Replaced `any` with `PackageJsonContent`, `FileDiscoveryStats`, `AdapterTestRunResult`
- `src/adapters/PythonAdapter.ts` - Enhanced return types and method signatures
- `src/types/ai-error-types.ts` - Proper TypeScript imports instead of dynamic imports
- `src/generators/*/TestGenerator.ts` - Added public wrapper methods for adapter compatibility

**Impact**: Zero linting errors, enhanced type safety, improved IDE support, better runtime error prevention.

### Code Quality Standards

**Recent Modernization (2025-07-13)**: Watch command modernized with comprehensive linting improvements:

#### Async/Event Handler Patterns
```typescript
// ✅ Proper async event handler extraction
debouncer.on('debounced', (event, groupKey) => {
  void handleDebouncedEvent(event, groupKey, stats, options, ...);
});

async function handleDebouncedEvent(...params): Promise<void> {
  // Async operations properly handled
}
```

#### Console Statement Guidelines
```typescript
// ✅ Intentional console output with eslint disable
// eslint-disable-next-line no-console
console.log(chalk.blue(`Processing ${fileCount} changes`));
```

#### TypeScript Type Safety
```typescript
// ✅ Proper unknown handling in event callbacks
const uniqueFiles = new Set(
  event.events.map((e: unknown) => {
    const eventObj = e as { filePath?: string };
    return String(eventObj.filePath ?? 'unknown');
  })
).size;
```

#### Import Consolidation
```typescript
// ✅ Consolidated imports to avoid duplication
import { FileWatcher, type FileChangeEvent } from '../../utils/FileWatcher';
import { FileChangeDebouncer, type DebouncedEvent } from '../../utils/Debouncer';
```

#### Nullish Coalescing Operator Usage
**Applied (2025-07-13)**: Enhanced type safety by using nullish coalescing operator (`??`) instead of logical OR (`||`) where appropriate:

```typescript
// ✅ Nullish coalescing for null/undefined fallback
function getAsyncPatterns(context: TemplateContext): FileAsyncPatterns | null {
  const metadata = (context as any).metadata;
  return metadata?.asyncPatterns ?? null;  // Only fallback if null/undefined
}

// ✅ Template framework handling
const info = {
  framework: template.framework ?? undefined,  // Preserves empty string
  testType: template.testType ?? undefined,
  description: template.getMetadata?.()?.description ?? undefined,
};

// ❌ Logical OR - can cause unexpected behavior
return metadata?.asyncPatterns || null;  // Falls back on falsy values like 0, false, ""

// ✅ Nullish coalescing - only null/undefined trigger fallback
return metadata?.asyncPatterns ?? null;   // Preserves 0, false, "" as valid values
```

**Key Benefits**:
- **Type Safety**: Preserves falsy values that should not trigger fallbacks
- **Intent Clarity**: Code clearly expresses null/undefined checking only
- **Template System**: Critical for template framework/testType handling where empty strings are valid

## Coding Patterns

### Error Handling

Use the domain-specific error handling pattern:

```typescript
import { handleDomainError } from '../utils/error-guards';

export async function analyzeProject(path: string): Promise<ProjectAnalysis> {
  try {
    // Operation logic
    return await performAnalysis(path);
  } catch (error: unknown) {
    throw handleDomainError(error, 'project', {
      projectPath: path,
      operation: 'analyze'
    });
  }
}
```

### Async/Await

Always use async/await over callbacks or raw promises:

```typescript
// ❌ Bad - Callbacks
fs.readFile(path, (err, data) => {
  if (err) handleError(err);
  else processData(data);
});

// ❌ Bad - Promise chains
readFile(path)
  .then(data => processData(data))
  .catch(err => handleError(err));

// ✅ Good - Async/await
try {
  const data = await fs.promises.readFile(path);
  await processData(data);
} catch (error) {
  handleError(error);
}
```

### Dependency Injection

Use dependency injection for testability:

```typescript
// ✅ Good - Injectable dependencies
export class TestRunner {
  constructor(
    private readonly fileSystem: FileSystem,
    private readonly timer: TestableTimer,
    private readonly logger: Logger
  ) {}
}

// ❌ Bad - Hard-coded dependencies
export class TestRunner {
  private fileSystem = new FileSystem();
  private timer = new RealTimer();
  private logger = console;
}
```

### Factory Pattern

Use factories for complex object creation:

```typescript
export class TestGeneratorFactory {
  static create(language: Language, config: Config): TestGenerator {
    switch (language) {
      case 'javascript':
        return new JavaScriptTestGenerator(config);
      case 'python':
        return new PythonTestGenerator(config);
      default:
        throw new Error(`Unsupported language: ${language}`);
    }
  }
}
```

## CLI Development Patterns

### Command Structure

All CLI commands should follow the standardized pattern:

```typescript
export async function analyzeCommand(
  projectPath: string,
  options: AnalyzeOptions
): Promise<void> {
  const startTime = Date.now();
  
  try {
    // 1. Load configuration using utility
    const config = await loadCommandConfig(projectPath, options);
    
    // 2. Create services with configuration
    const analyzer = new ProjectAnalyzer(config);
    
    // 3. Execute command logic
    const result = await analyzer.analyze(projectPath);
    
    // 4. Handle output
    outputResult(result, options.format);
    
  } catch (error: unknown) {
    handleCommandError(error, 'analyze', { projectPath });
  } finally {
    logExecutionTime(startTime);
  }
}
```

### Configuration Loading

Always use the centralized configuration loading utility:

```typescript
import { loadCommandConfig } from '../utils/config-loader';

// In command implementation
const config = await loadCommandConfig(projectPath, cliOptions);
```

## Testing Conventions

### Test Structure

```typescript
describe('ComponentName', () => {
  // Setup
  let component: ComponentName;
  
  beforeEach(() => {
    component = new ComponentName();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('methodName', () => {
    it('should handle normal case', async () => {
      // Arrange
      const input = createTestInput();
      
      // Act
      const result = await component.method(input);
      
      // Assert
      expect(result).toEqual(expectedOutput);
    });

    it('should handle error case', async () => {
      // Arrange
      const invalidInput = createInvalidInput();
      
      // Act & Assert
      await expect(component.method(invalidInput))
        .rejects.toThrow(ValidationError);
    });
  });
});
```

### Mock Conventions

```typescript
// Create mocks in __mocks__ directory or inline
jest.mock('../services/FileService');

// Type-safe mocks
const mockFileService = {
  readFile: jest.fn().mockResolvedValue('content'),
  writeFile: jest.fn().mockResolvedValue(undefined)
} as jest.Mocked<FileService>;
```

### Test Data

Create test fixtures for reusability:

```typescript
// tests/fixtures/project-fixtures.ts
export const createReactProject = (): ProjectAnalysis => ({
  languages: ['javascript'],
  frameworks: ['react'],
  testFramework: 'jest',
  // ... other properties
});
```

## Documentation Standards

### Code Comments

Use JSDoc for public APIs:

```typescript
/**
 * Analyzes a project to detect languages and frameworks
 * @param projectPath - Absolute path to the project directory
 * @param options - Optional analysis configuration
 * @returns Project analysis results
 * @throws {ProjectNotFoundError} When project path doesn't exist
 * @example
 * const analysis = await analyzer.analyze('/path/to/project');
 */
export async function analyze(
  projectPath: string,
  options?: AnalyzeOptions
): Promise<ProjectAnalysis> {
  // Implementation
}
```

### Inline Comments

Use inline comments sparingly for complex logic:

```typescript
// Use binary search for performance with large arrays
const index = binarySearch(sortedArray, target);

// Compensate for floating-point precision issues
const rounded = Math.round(value * 100) / 100;
```

## Git Conventions

### Branch Names

- `feature/` - New features
- `fix/` - Bug fixes
- `refactor/` - Code refactoring
- `docs/` - Documentation updates
- `test/` - Test improvements
- `chore/` - Maintenance tasks

### Commit Messages

Follow conventional commits:

```
type(scope): subject

body

footer
```

Examples:
```
feat(analyzer): add Python framework detection
fix(cli): handle missing config file gracefully
docs(api): update test generation examples
refactor(templates): extract common template logic
test(e2e): add incremental update scenarios
```

## Performance Guidelines

### Caching

Use caching for expensive operations:

```typescript
export class FileDiscoveryService {
  private cache = new Map<string, CachedResult>();
  
  async discoverFiles(path: string): Promise<string[]> {
    const cacheKey = this.getCacheKey(path);
    const cached = this.cache.get(cacheKey);
    
    if (cached && !this.isExpired(cached)) {
      return cached.data;
    }
    
    const result = await this.performDiscovery(path);
    this.cache.set(cacheKey, { data: result, timestamp: Date.now() });
    return result;
  }
}
```

### Batch Operations

Batch operations for efficiency:

```typescript
// ❌ Bad - Individual operations
for (const file of files) {
  await processFile(file);
}

// ✅ Good - Batched operations
const batchSize = 10;
for (let i = 0; i < files.length; i += batchSize) {
  const batch = files.slice(i, i + batchSize);
  await Promise.all(batch.map(file => processFile(file)));
}
```

## Security Practices

### Input Validation

Always validate external input:

```typescript
export function validateProjectPath(path: string): void {
  if (!path || typeof path !== 'string') {
    throw new ValidationError('Project path must be a non-empty string');
  }
  
  if (!isAbsolute(path)) {
    throw new ValidationError('Project path must be absolute');
  }
  
  if (!existsSync(path)) {
    throw new ProjectNotFoundError(`Project not found: ${path}`);
  }
}
```

### Path Safety

Use path utilities to prevent directory traversal:

```typescript
import { join, resolve, relative } from 'path';

// ✅ Good - Safe path handling
const safePath = resolve(baseDir, userInput);
if (!safePath.startsWith(baseDir)) {
  throw new SecurityError('Path traversal detected');
}
```

## Logging Standards

Use the configured logger:

```typescript
import { logger } from '../utils/logger';

// Log levels
logger.debug('Detailed information for debugging');
logger.info('General information');
logger.warn('Warning that doesn't prevent operation');
logger.error('Error that prevents operation', error);

// Structured logging
logger.info('Analysis completed', {
  projectPath: '/path/to/project',
  duration: 1234,
  filesAnalyzed: 56
});
```

## Code Review Checklist

Before submitting PR, ensure:

- [ ] All tests pass (`npm test`)
- [ ] No linting errors (`npm run lint`)
- [ ] Type checking passes (`npm run typecheck`)
- [ ] Coverage maintained (>90%)
- [ ] Documentation updated
- [ ] No `console.log` statements
- [ ] No commented-out code
- [ ] Error handling implemented
- [ ] Performance considered
- [ ] Security validated

---

**Convention Philosophy**: Maintain consistency, readability, and reliability while optimizing for both human developers and AI agents.