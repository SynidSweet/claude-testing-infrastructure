# Development Patterns & Conventions

*Last updated: 2025-06-30 | Updated by: /document-all command | Discriminated union types patterns added*

## Naming Conventions

### Basic Naming Rules
- **Functions/Variables**: camelCase (`analyzeProject`, `testConfig`)
- **Classes**: PascalCase (`ProjectAnalyzer`, `TestGenerator`)
- **Files**: kebab-case (`project-analyzer.ts`, `test-runner.ts`)
- **Directories**: kebab-case (`cli/commands`, `analyzers`)
- **Constants**: SCREAMING_SNAKE_CASE (`DEFAULT_TIMEOUT`, `MAX_RETRIES`)

### AI-Friendly Function Naming (Updated 2025-06-29)
Functions should be **self-documenting** and clearly indicate their purpose and context:

#### Domain-Specific Naming
- **Include domain context**: `analyzeCoverage()` → `analyzeStructuralTestCoverage()`
- **Specify operation scope**: `identifyGaps()` → `identifyLogicalTestingGaps()`
- **Clarify data type**: `calculateComplexity()` → `calculateCodeComplexityMetrics()`
- **Indicate target context**: `extractTestContext()` → `extractAITestContext()`

#### Framework and Language Specificity
- **Expand abbreviations**: `generateJSSetup()` → `generateJavaScriptTestSetup()`
- **Include framework context**: `parse()` → `parseJestCoverageData()` or `parsePytestCoverageData()`
- **Specify file operations**: `generateMockFile()` → `generateMockFileForDependencies()`

#### Examples of Improved Function Names
```typescript
// BEFORE - Generic/unclear names
analyze() → analyzeProject()
generate() → generateAllTests()
processSingle() → processSingleCoverageSource()
analyzeGaps() → analyzeTestGaps()
generateTestForFile() → generateStructuralTestForFile()

// AFTER - Self-documenting names that include context
private analyzeStructuralTestCoverage(sourceContent: string, testContent: string): CoverageAnalysis
private identifyLogicalTestingGaps(sourceContent: string, coverage: CoverageAnalysis): IdentifiedGap[]
private calculateCodeComplexityMetrics(sourceContent: string, filePath: string): ComplexityScore
private extractAITestContext(sourceContent: string): TestContext
```

#### Naming Pattern Guidelines
1. **Start with action verb** that clearly describes what the function does
2. **Include object/subject** the function operates on
3. **Add domain context** (test, coverage, analysis, generation)
4. **Specify scope** (single vs multiple, structural vs logical)
5. **Avoid generic terms** like "process", "handle", "check" without context

## Code Organization Patterns
### Directory Structure
```
src/
├── cli/            # Command-line interface
├── analyzers/      # Project analysis components
├── generators/     # Test generation logic
├── runners/        # Test execution systems
├── adapters/       # Language-specific adapters
└── utils/          # Shared utilities
```

### Class Architecture
- **Abstract base classes**: Provide common functionality and interfaces
- **Concrete implementations**: Language/framework-specific logic
- **Factory pattern**: Automatic adapter/runner selection
- **Dependency injection**: Constructor-based with interface contracts

## Design Patterns Used
### Language Adapter Pattern
- **Purpose**: Handle JavaScript/TypeScript vs Python differences
- **Implementation**: `BaseProjectAdapter` → `JavaScriptAdapter`/`PythonAdapter`
- **Benefits**: Extensible for new languages, clear separation of concerns

### Factory Pattern
- **TestRunnerFactory**: Selects Jest vs pytest based on project analysis
- **AdapterFactory**: Chooses appropriate language adapter
- **Benefits**: Automatic configuration, reduces conditional logic

### Strategy Pattern
- **Coverage aggregation**: Union, intersection, latest, highest strategies
- **Test generation**: Structural vs AI-powered logical generation
- **Benefits**: Flexible approaches, easy to extend

### Template Method Pattern
- **Purpose**: Separate report content from presentation logic
- **Implementation**: External HTML/Markdown templates with template engine
- **Example**: `CoverageVisualizer` using `HtmlTemplateEngine` for report generation
- **Benefits**: Reduces method complexity, improves maintainability, easier to customize

### Validation Pattern ✅ NEW (2025-06-29)
- **Purpose**: Prevent invalid operations with clear user guidance
- **Implementation**: Pre-operation validation with bypass options
- **Example**: Test generation ratio validation with `--force` override
- **Pattern**:
  ```typescript
  // 1. Check skip conditions first
  if (skipValidation) {
    logger.debug('Validation skipped');
    return;
  }
  
  // 2. Perform validation logic
  const ratio = calculateRatio();
  
  // 3. Provide clear error with guidance
  if (ratio > threshold) {
    const message = [
      `⚠️  WARNING: Operation would create problematic state`,
      `   Options:`,
      `   • Review your configuration`,
      `   • Use --force to bypass this check`,
      `   To proceed anyway, add the --force flag.`
    ].join('\n');
    
    throw new Error('Validation failed');
  }
  ```
- **Benefits**: Prevents user errors, provides educational feedback, maintains escape hatch

### CLI Options Pattern ✅ NEW (2025-06-29)
- **Purpose**: Consistent flag behavior across all commands
- **Standard flags**:
  - `--verbose`: Detailed operation information
  - `--force`: Skip validation checks
  - `--config <path>`: Custom configuration file
  - `--help`: Command usage information
- **Implementation**: Commander.js with consistent option descriptions
- **Validation**: Boolean flags converted with `!!` for type safety
- **Benefits**: Predictable CLI experience, reduced cognitive load

## Type System Patterns ✅ NEW (2025-06-30)

### Discriminated Union Types
The infrastructure uses discriminated union types for enhanced type safety and AI comprehension:

#### Pattern Implementation
```typescript
// Define discriminated union with 'type' field
type OperationInput =
  | { type: 'file'; path: string; encoding?: 'utf8' | 'binary' }
  | { type: 'data'; content: string; format: 'json' | 'text' }
  | { type: 'stream'; stream: ReadableStream; metadata?: object };

// Create type guards with descriptive names
export function isFileInput(input: OperationInput): input is Extract<OperationInput, { type: 'file' }> {
  return input.type === 'file';
}

export function isDataInput(input: OperationInput): input is Extract<OperationInput, { type: 'data' }> {
  return input.type === 'data';
}

// Use type guards for safe runtime checking
function processInput(input: OperationInput) {
  if (isFileInput(input)) {
    // TypeScript knows input has 'path' and optional 'encoding'
    return processFile(input.path, input.encoding);
  } else if (isDataInput(input)) {
    // TypeScript knows input has 'content' and 'format'
    return processData(input.content, input.format);
  }
  // Handle remaining cases...
}
```

#### Type Guard Naming Convention
- **Prefix with domain**: `isAnalysisInput()`, `isCoverageInput()`, `isGenerationInput()`
- **Include operation context**: `isAnalysisSuccessResult()`, `isCoverageErrorResult()`
- **Avoid generic names**: Use `isCoverageSuccessResult()` not `isSuccessResult()`

#### Benefits
- **AI Comprehension**: Self-documenting type definitions that AI agents can analyze
- **Type Safety**: Compile-time guarantees about data structure
- **IntelliSense**: Better autocomplete and error detection
- **Runtime Safety**: Type guards enable safe runtime type checking

📖 **See detailed type documentation**: [`/docs/features/discriminated-union-types.md`](../features/discriminated-union-types.md)

## Error Handling Approach
### Graceful Degradation
```typescript
try {
  const result = await primaryMethod();
  return result;
} catch (error) {
  logger.warn('Primary method failed, trying fallback');
  return await fallbackMethod();
}
```

### Comprehensive Logging
- **Debug level**: Detailed execution traces for development
- **Info level**: User-facing progress updates
- **Warn level**: Non-critical failures with fallbacks
- **Error level**: Critical failures requiring user intervention

## Testing Strategy
### Infrastructure Testing
- **Framework**: Jest with TypeScript support
- **Coverage target**: 80% overall, 70% branch coverage minimum
- **Test organization**: Co-located in `tests/` directory
- **Patterns**: Unit tests for core logic, integration tests for CLI commands

### Generated Test Strategy
- **JavaScript/TypeScript**: Jest with React Testing Library for components
- **Python**: pytest with pytest-cov for coverage
- **API testing**: supertest for Node.js, httpx for Python
- **Test data**: Factory patterns for consistent test fixtures

## Configuration Management
### TypeScript Configuration
- **Strict mode**: All strict TypeScript options enabled
- **Path mapping**: `@/*` aliases for clean imports
- **Build output**: Compiled to `dist/` with source maps

### Environment Variables
```bash
# Development
DEBUG=claude-testing:*
LOG_LEVEL=debug

# Production
LOG_LEVEL=info
ANTHROPIC_API_KEY=sk-...  # For AI features
```

### Feature Detection
- **Framework detection**: Based on package.json dependencies
- **Language detection**: File extensions and configuration files
- **Capability flags**: Framework-specific feature availability

## Code Style Guidelines
### TypeScript Patterns
```typescript
// Interface definitions
export interface ProjectAnalysis {
  projectPath: string;
  languages: DetectedLanguage[];
  frameworks: DetectedFramework[];
}

// Class implementation
export class ProjectAnalyzer {
  constructor(
    private readonly config: AnalyzerConfig,
    private readonly logger: Logger
  ) {}

  async analyze(path: string): Promise<ProjectAnalysis> {
    // Implementation
  }
}
```

### Import Organization

#### Consolidated Import Pattern (Preferred)
Use shared import utilities to reduce duplication and improve maintainability:

```typescript
// Consolidated imports (preferred)
import { fs, path, fg, chalk, ora, logger } from '../utils/common-imports';
import { ProjectAnalyzer, TestGapAnalyzer, TestGeneratorConfig } from '../utils/analyzer-imports';

// Additional specific imports only when needed
import { Command } from 'commander';
import { FileWatcher } from '../utils/FileWatcher';
```

#### Legacy Import Pattern (Before Consolidation)
```typescript
// Node.js built-ins
import { promises as fs } from 'fs';
import path from 'path';

// Third-party dependencies
import fg from 'fast-glob';
import chalk from 'chalk';

// Internal imports
import { logger } from '@/utils/logger';
import { ProjectAnalysis } from '@/analyzers/types';
```

#### Import Utility Files
- **`src/utils/common-imports.ts`**: Node.js core modules, logging, and external utilities (fs, path, logger, chalk, ora, fg)
- **`src/utils/analyzer-imports.ts`**: Core analyzers, generators, runners, and their types

### Modern Node.js API Usage
- **File System Operations**: Use modern `fs.rm()` instead of deprecated `fs.rmdir()` for recursive directory removal
- **Compatibility**: Always use the latest stable Node.js filesystem APIs to avoid deprecation warnings
- **Example**: `await fs.rm(tempDir, { recursive: true })` for cleaning up test directories

## CLI Consistency Patterns (Updated 2025-06-29)

### Verbose Flag Implementation
All major CLI commands should support consistent verbose output:

#### Standard Pattern
```typescript
interface CommandOptions {
  verbose?: boolean;
  // ... other options
}

// CLI definition pattern
.option('-v, --verbose', 'Show detailed [command] information')
```

#### Verbose Output Guidelines
- **Use gray colored output** for verbose details: `chalk.gray()`
- **Provide structured information**: Step-by-step process details
- **Include configuration data**: Show what options are being used
- **File-level feedback**: List each file being processed
- **Consistent emojis**: 🔍 for verbose mode, ⚙️ for configuration, 📊 for analysis, etc.
- **Final confirmation**: Indicate verbose mode was active in completion message

#### Implementation Example
```typescript
if (options.verbose) {
  console.log(chalk.gray(`🔍 Verbose mode enabled`));
  console.log(chalk.gray(`📁 Project path: ${projectPath}`));
  console.log(chalk.gray(`⚙️  Options: ${JSON.stringify(options, null, 2)}`));
}
```

#### Current Implementation Status
- ✅ **analyze command**: Full verbose support with detailed analysis output
- ✅ **test command**: Complete verbose logging throughout generation process
- ✅ **run command**: Verbose flag added for test execution details
- 🔄 **watch command**: Already has verbose support
- ⚠️ **analyze-gaps, generate-logical**: Should be updated for consistency

## Error Handling Patterns (Updated 2025-06-29)

### Standardized Error Classes
All error handling should use the centralized error handling system from `src/utils/error-handling.ts`:

```typescript
import { 
  handleFileOperation, 
  handleAnalysisOperation, 
  handleValidation,
  formatErrorMessage 
} from '../utils/error-handling';
```

#### Error Class Hierarchy
- **ClaudeTestingError**: Base error class with context and timestamp
- **AnalysisError**: For project analysis, gap analysis operations
- **FileOperationError**: For file system operations (read, write, stat)
- **ValidationError**: For input validation, path validation, config validation
- **GenerationError**: For test generation operations
- **TestExecutionError**: For test running operations

#### Standard Error Handling Patterns

**File Operations**:
```typescript
const content = await handleFileOperation(
  () => fs.readFile(filePath, 'utf-8'),
  'reading configuration file',
  filePath
);
```

**Analysis Operations**:
```typescript
const analysis = await handleAnalysisOperation(
  async () => {
    const analyzer = new ProjectAnalyzer(projectPath);
    return await analyzer.analyzeProject();
  },
  'project analysis',
  projectPath
);
```

**Validation Operations**:
```typescript
await handleValidation(
  async () => {
    const stats = await fs.stat(projectPath);
    if (!stats.isDirectory()) {
      throw new Error(`Path is not a directory: ${projectPath}`);
    }
  },
  'validating project path',
  projectPath
);
```

#### Error Display Pattern
Always use `formatErrorMessage()` for consistent error display:

```typescript
} catch (error) {
  spinner.fail('Operation failed');
  console.error(chalk.red(`\n✗ ${formatErrorMessage(error)}`));
  process.exit(1);
}
```

#### Benefits
- **Consistent error messages** across all modules
- **Rich context information** for debugging
- **Standardized logging** with proper error levels
- **Type-safe error handling** with specific error classes
- **Reduced code duplication** (eliminated 25+ duplicate error blocks)

## AI Integration Patterns
### Cost-Aware Design
- **Batch processing**: Group multiple test generations
- **Token estimation**: Predict costs before AI calls
- **Incremental updates**: Only regenerate changed tests
- **Fallback logic**: Structural tests when AI unavailable

### Claude Integration (Phase 5.3)
```typescript
interface AITestGenerator {
  generateLogicalTests(
    context: TestContext,
    complexity: ComplexityScore
  ): Promise<GeneratedTest[]>;
}
```

## See Also
- 📖 **Development Workflow**: [`./workflow.md`](./workflow.md)
- 📖 **Important Gotchas**: [`./gotchas.md`](./gotchas.md)
- 📖 **Architecture Overview**: [`../architecture/overview.md`](../architecture/overview.md)
- 📖 **Technical Stack**: [`../architecture/technical-stack.md`](../architecture/technical-stack.md)