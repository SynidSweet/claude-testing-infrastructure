# Development Patterns

*Last updated: 2025-07-02 | Added Jest test mock sequencing patterns for asynchronous analyzer components*

## Overview

This document describes key development patterns used throughout the Claude Testing Infrastructure codebase. These patterns help maintain consistency, reduce complexity, and improve maintainability.

## Orchestrator Pattern

### Overview
The Orchestrator pattern decomposes monolithic classes into focused, single-responsibility services coordinated by a lightweight orchestrator. This pattern is essential for maintaining AI comprehension when classes grow beyond 300-500 lines.

### Implementation in TestGapAnalyzer

#### Problem Solved
The original TestGapAnalyzer was a 902-line "god class" with multiple responsibilities:
- Code complexity calculation
- Structural coverage analysis
- Gap identification logic
- AI context extraction
- Priority calculation
- Cost estimation

This violated single responsibility principle and exceeded AI context window limits.

#### Solution Architecture
```typescript
// Before: Monolithic class (902 lines)
export class TestGapAnalyzer {
  // All responsibilities mixed together
  calculateComplexity() { /* 45 lines */ }
  analyzeCoverage() { /* 85 lines */ }
  identifyGaps() { /* 67 lines */ }
  extractContext() { /* 153 lines */ }
  // ... many more mixed responsibilities
}

// After: Orchestrator pattern (438 + 4 focused classes)
export class TestGapAnalyzer {
  constructor(
    private complexityCalculator: ComplexityCalculator,    // 61 lines
    private coverageAnalyzer: CoverageAnalyzer,           // 235 lines  
    private gapIdentifier: GapIdentifier,                 // 56 lines
    private contextExtractor: ContextExtractor            // 168 lines
  ) {}
  
  async analyzeTestFileForGaps(test: GeneratedTest): Promise<TestGap | null> {
    // Orchestrate focused services
    const complexity = await this.complexityCalculator.calculateCodeComplexityMetrics(...);
    const coverage = await this.coverageAnalyzer.analyzeStructuralTestCoverage(...);
    const gaps = await this.gapIdentifier.identifyLogicalTestingGaps(...);
    const context = await this.contextExtractor.extractAITestContext(...);
    
    // Orchestrator-specific logic (priority calculation, etc.)
    return { complexity, coverage, gaps, context, priority };
  }
}
```

#### Benefits Achieved
- **51% Line Reduction**: Main class reduced from 902 → 438 lines
- **AI Comprehension**: All classes fit within single context window (<240 lines)
- **Single Responsibility**: Each service handles one specific concern
- **Maintainability**: Clear separation enables independent modification
- **Testability**: Focused classes easier to test and mock
- **API Compatibility**: 100% backward compatibility maintained

### When to Apply Orchestrator Pattern

#### Size Triggers
- **Class exceeds 500 lines** - Critical refactoring needed
- **Class exceeds 300 lines** - Consider decomposition
- **Method exceeds 50 lines** - Extract to focused service

#### Responsibility Triggers
- **Multiple distinct domains** (e.g., calculation + analysis + reporting)
- **Mixed abstraction levels** (low-level parsing + high-level orchestration)
- **Independent concerns** that could be tested separately

#### AI Comprehension Triggers
- **Exceeds context window** for AI analysis
- **Multiple scrolls required** to understand class
- **Frequent "god object" patterns** emerging

### Implementation Guidelines

#### 1. Identify Service Boundaries
Look for natural separation points:
```typescript
// Natural boundaries in TestGapAnalyzer:
- calculateComplexity() + related methods → ComplexityCalculator
- analyzeCoverage() + gap detection → CoverageAnalyzer  
- identifyGaps() + classification → GapIdentifier
- extractContext() + AI preparation → ContextExtractor
```

#### 2. Extract Services with Clear Interfaces
```typescript
// Each service should have a focused interface
interface ComplexityCalculator {
  calculateCodeComplexityMetrics(content: string, filePath: string): Promise<ComplexityScore>;
}

interface CoverageAnalyzer {
  analyzeStructuralTestCoverage(sourceContent: string, testContent: string): Promise<CoverageAnalysis>;
}
```

#### 3. Maintain Composition Over Inheritance
```typescript
// Initialize services in constructor, not inheritance
constructor(projectAnalysis: ProjectAnalysis, config: Config = {}) {
  this.complexityCalculator = new ComplexityCalculator();
  this.coverageAnalyzer = new CoverageAnalyzer();
  this.gapIdentifier = new GapIdentifier();
  this.contextExtractor = new ContextExtractor();
}
```

#### 4. Preserve Public API
The orchestrator should maintain the exact same public interface:
```typescript
// Public API remains identical
async analyzeTestGaps(generationResult: TestGenerationResult): Promise<TestGapAnalysisResult>
```

### Future Refactoring Candidates

Classes that would benefit from orchestrator pattern:
- **GapReportGenerator** (847 lines) - Report generation with mixed concerns
- **ProjectAnalyzer** (if it grows beyond 400 lines) - Analysis + detection logic
- Any class approaching 500+ lines with multiple responsibilities

## Template Method Pattern

### Overview
The Template Method pattern is used to separate content/structure from presentation logic, particularly in report generation. This pattern defines the skeleton of an algorithm in a base class, letting subclasses override specific steps without changing the algorithm's structure.

### Implementation in Coverage Reporters

#### Problem Solved
Before implementing this pattern, report generation methods were extremely long (50-150 lines) mixing:
- Data transformation logic
- String formatting
- Content structure
- Output formatting

#### Solution Architecture
```
CoverageVisualizer
    ├── Uses → HtmlTemplateEngine
    ├── Uses → MarkdownTemplateEngine  
    └── Uses → XmlTemplateEngine

Each Template Engine:
    ├── prepareTemplateData() - Transforms raw data into template-ready format
    └── render() - Generates output using prepared data
```

#### Benefits Achieved
- **Complexity Reduction**: 
  - HTML: 137 → 16 lines (88% reduction)
  - Markdown: 48 → 14 lines (71% reduction)
  - XML: 30 → 9 lines (70% reduction)
- **Separation of Concerns**: Content structure separated from generation logic
- **Customization**: Easy to modify reports without changing code
- **Testability**: Each component can be tested independently

#### Example Usage
```typescript
// Before: Mixed concerns in one large method
private async generateMarkdownReport(data: CoverageData, filePath: string) {
  // 48 lines of mixed logic, formatting, and content...
}

// After: Clean separation
private async generateMarkdownReport(data: CoverageData, filePath: string) {
  const gaps = this.analyzeGaps(data);
  const templateData = this.markdownTemplateEngine.prepareTemplateData(data, gaps, this.config.projectName);
  const markdown = this.markdownTemplateEngine.render(templateData);
  await fs.writeFile(filePath, markdown, 'utf8');
}
```

### When to Apply This Pattern

Use the Template Method pattern when:
1. **Multiple output formats** share similar structure but different syntax
2. **Methods exceed 50 lines** mixing data processing with formatting
3. **Customization is needed** without modifying core logic
4. **Testing is difficult** due to mixed concerns

### Implementation Guidelines

1. **Create a dedicated engine class** for each output format
2. **Define a data preparation method** that transforms raw data into template-ready format
3. **Implement a render method** that uses the prepared data
4. **Keep the main method simple** - just orchestrate the steps
5. **Use external templates** when content is complex (like HTML)

### Files Using This Pattern
- `/src/runners/CoverageVisualizer.ts` - Main orchestrator
- `/src/runners/templates/HtmlTemplateEngine.ts` - HTML report generation
- `/src/runners/templates/MarkdownTemplateEngine.ts` - Markdown report generation
- `/src/runners/templates/XmlTemplateEngine.ts` - XML report generation
- `/src/runners/templates/coverage-report.html` - External HTML template

## Language Adapter Pattern

### Overview
The Language Adapter pattern provides language-specific implementations while maintaining a consistent interface. This is NOT code duplication - it's intentional separation of concerns for different language ecosystems.

### Implementation
```
IProjectAdapter (Interface)
    ├── JavaScriptAdapter - Handles npm, package.json, Jest/Vitest
    └── PythonAdapter - Handles pip, setup.py, pytest

Each adapter knows:
- How to detect its language
- Framework-specific patterns
- Dependency management
- Test runner configuration
```

### Benefits
- **Extensibility**: Easy to add new languages
- **Maintainability**: Language-specific logic is isolated
- **Consistency**: Same interface for all languages
- **Type Safety**: Each adapter can have language-specific types

## Extract Method Pattern

### Overview
The Extract Method pattern breaks down large methods into smaller, focused methods with clear single responsibilities. Applied during code quality refactoring to improve readability and maintainability.

### Implementation in CLI Commands

#### Problem Solved
Command handler methods were becoming too large (70-100 lines), mixing:
- Parameter validation
- Special operation handling
- Main business logic
- Result display and recording

#### Solution Applied
Extract logical sections into focused methods:

**Example: `handleIncrementalCommand` Refactoring**
```typescript
// Before: 96-line method with mixed concerns
async function handleIncrementalCommand(projectPath: string, options: any) {
  // 96 lines of mixed logic...
}

// After: 31-line orchestrator with extracted methods
async function handleIncrementalCommand(projectPath: string, options: any) {
  // Handle special operations first
  if (await handleSpecialOperations(options, incrementalGenerator, historyManager)) {
    return;
  }

  // Validate incremental generation
  if (!await validateIncrementalGeneration(incrementalGenerator, changeDetector, options)) {
    return;
  }

  // Perform main operation and record results
  const result = await incrementalGenerator.generateIncremental(config);
  displayIncrementalResults(result);
  await recordResults(historyManager, result, options);
}
```

#### Benefits Achieved
- **Readability**: Main method shows high-level flow
- **Testability**: Each extracted method can be tested independently
- **Reusability**: Extracted methods can be reused
- **Complexity Reduction**:
  - `handleIncrementalCommand`: 96 → 31 lines (68% reduction)
  - `displayConsoleResults`: 71 → 16 lines (77% reduction)
  - `generateSetupContent`: 67 → 9 lines (87% reduction)

#### Implementation Guidelines
1. **Identify logical sections** that can stand alone
2. **Extract by responsibility** - each method should have one clear purpose
3. **Use descriptive names** that clearly indicate what the method does
4. **Pass necessary parameters** rather than relying on shared state
5. **Return values appropriately** to support the main flow

### Files Using This Pattern
- `/src/cli/commands/incremental.ts` - CLI command handler refactoring
- `/src/cli/commands/analyze.ts` - Console display method refactoring
- `/src/generators/StructuralTestGenerator.ts` - Setup content generation refactoring

## Configuration Access Pattern ✅ NEW

### Overview
Standardized pattern for accessing global CLI options in command implementations. Addresses the challenge that Commander.js commands don't directly receive parent (global) options.

### Problem Solved
CLI commands need access to global flags like `--show-config-sources`, but Commander.js doesn't pass parent options to child commands automatically.

### Solution Architecture
```typescript
// Command signature with parent access
export async function commandFunction(
  projectPath: string, 
  options: CommandOptions = {}, 
  command?: any  // Commander.js command object
): Promise<void> {
  // Access global options from parent command
  const globalOptions = command?.parent?.opts() || {};
  const showConfigSources = globalOptions.showConfigSources || false;
  
  // Use global options in configuration loading
  const config = await loadConfiguration(projectPath, analysis, options, showConfigSources);
}

// CLI registration with command object passing
.action((projectPath, options, command) => commandFunction(projectPath, options, command))
```

### Implementation Pattern
1. **Add optional command parameter** to command functions
2. **Extract global options** from `command?.parent?.opts()`
3. **Pass to configuration loading** or other global-aware functions
4. **Register action with command object** in CLI setup

### Files Using This Pattern
- `/src/cli/commands/test.ts` - Test command with config debugging
- `/src/cli/commands/analyze.ts` - Analysis command with config display
- `/src/cli/commands/run.ts` - Run command with config debugging
- `/src/cli/index.ts` - CLI registration with command object passing

## Enhanced Error Messages Pattern ✅ NEW

### Overview
Structured approach to providing helpful, contextual error messages with suggestions and examples rather than bare error strings.

### Problem Solved
Basic validation error messages like "Invalid testFramework: xyz" don't help users understand what went wrong or how to fix it.

### Solution Architecture
```typescript
// Enhanced error message structure
interface ConfigErrorDetails {
  field: string;
  value: any;
  message: string;
  suggestion?: string;
  example?: string;
  documentation?: string;
}

// Formatter for consistent error display
class ConfigErrorFormatter {
  static formatError(details: ConfigErrorDetails): string {
    // Formats with context, suggestions, examples, and links
  }
  
  static readonly templates = {
    invalidEnum: (field, value, validOptions) => ({ ... }),
    outOfRange: (field, value, min, max) => ({ ... }),
    unknownField: (field, value, similarFields) => ({ ... })
  };
}
```

### Enhanced Error Output
```bash
# Before: Basic error
testFramework: Invalid value: xyz. Valid options: jest, vitest, pytest

# After: Enhanced error with context
testFramework: Invalid value. Must be one of: jest, vitest, pytest, mocha, jasmine, auto
  Current value: xyz
  → Choose from: jest, vitest, pytest, mocha, jasmine, auto
  Example: "jest"
```

### Implementation Guidelines
1. **Use structured error objects** instead of plain strings
2. **Provide contextual suggestions** based on the specific error
3. **Include practical examples** for correct usage
4. **Add documentation links** for complex configuration
5. **Use similar field detection** for typo correction

### Files Using This Pattern
- `/src/utils/config-error-messages.ts` - Error message formatting system
- `/src/utils/config-validation.ts` - Enhanced validation with helpful errors

## Jest Mock Sequencing Pattern ✅ NEW

### Overview
Pattern for correctly mocking asynchronous file operations and function calls in Jest tests when multiple mocks are consumed in sequence by analyzer components.

### Problem Solved
Complex analyzer classes like ModuleSystemAnalyzer make multiple asynchronous calls (fs.readFile, fast-glob) in specific sequences. Incorrect mock setup leads to mocks being consumed out of order, causing test failures where file content analysis fails silently.

### Root Cause
When `analyzeProjectFromFiles()` finds no source files (empty array), it skips calling `detectFileExtensionPattern()`, which changes the sequence of mock consumption. Tests that assume both calls happen will fail.

### Solution Architecture
```typescript
// ❌ WRONG: Assumes detectFileExtensionPattern always called
it('should analyze file content', async () => {
  mockFs.readFile.mockResolvedValueOnce(JSON.stringify({})); // package.json
  fastGlobMock.mockResolvedValueOnce([]); // findSourceFiles  
  fastGlobMock.mockResolvedValueOnce([]); // detectFileExtensionPattern - NEVER CALLED!
  mockFs.readFile.mockResolvedValueOnce('file content'); // analyzeFile reads 2nd glob mock!
});

// ✅ CORRECT: Match actual execution flow
it('should analyze file content', async () => {
  // Mock project analysis (empty files = early return, no detectFileExtensionPattern)
  mockFs.readFile.mockResolvedValueOnce(JSON.stringify({})); // package.json
  fastGlobMock.mockResolvedValueOnce([]); // findSourceFiles (early return)
  
  // Mock file content for analyzeFile
  mockFs.readFile.mockResolvedValueOnce('file content'); // analyzeFile specific read
});

// ✅ CORRECT: When files exist, both calls happen
it('should analyze project with files', async () => {
  mockFs.readFile.mockResolvedValueOnce(JSON.stringify({})); // package.json
  fastGlobMock.mockResolvedValueOnce(['file1.js', 'file2.js']); // findSourceFiles
  mockFs.readFile.mockResolvedValueOnce('content1'); // file1 content
  mockFs.readFile.mockResolvedValueOnce('content2'); // file2 content  
  fastGlobMock.mockResolvedValueOnce(['file1.js', 'file2.js']); // detectFileExtensionPattern
});
```

### Implementation Guidelines
1. **Trace execution paths** - Understand when conditional calls are made
2. **Match mock sequence to actual calls** - Don't assume all code paths execute
3. **Comment mock purpose** - Explain what each mock represents
4. **Test individual vs batch runs** - Mocks may work individually but fail in suites
5. **Use descriptive test names** - Indicate the specific scenario being tested

### Files Using This Pattern
- `/tests/generators/javascript/ModuleSystemAnalyzer.test.ts` - Fixed mock sequencing for project and file analysis
- `/tests/analyzers/ProjectAnalyzer.test.ts` - Similar async analysis patterns

## Future Patterns to Document

### Command Pattern
- For CLI command handling
- ✅ Applied via Extract Method pattern in command handlers

### Builder Pattern
- For configuration generation
- Used in test setup creation

### Observer Pattern
- For file watching and change detection
- Used in incremental testing

### Factory Pattern
- For test runner selection
- Already implemented in TestRunnerFactory

## See Also
- **Architecture Overview**: [`/docs/architecture/overview.md`](../architecture/overview.md)
- **Coding Conventions**: [`/docs/development/conventions.md`](./conventions.md)
- **Refactoring Plan**: [`/docs/planning/refactoring-tasks.md`](../planning/refactoring-tasks.md)