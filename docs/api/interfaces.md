# API Interfaces Documentation

*TypeScript interfaces and classes for Claude Testing Infrastructure*

*Last updated: 2025-06-30 | Added discriminated union types system*

## 🏗️ Core Architecture

The infrastructure is built around four main systems:
1. **ProjectAnalyzer** - Analyzes project structure and detects languages/frameworks
2. **TestGenerator** - Generates test files from analysis
3. **TestRunner** - Executes generated tests
4. **CLI** - Command-line interface

## 🔧 Type System

### Discriminated Union Types

The infrastructure uses comprehensive discriminated union types for enhanced type safety and AI comprehension:

#### Analysis Types (`src/types/analysis-types.ts`)
- **AnalysisInput**: Discriminated union for analysis operations (path vs analysis object)
- **AnalysisResult**: Typed results with success/partial/error variants
- **Type Guards**: `isPathInput()`, `isAnalysisInput()`, `isAnalysisSuccessResult()`, etc.

#### Coverage Types (`src/types/coverage-types.ts`)
- **CoverageInput**: Discriminated union for coverage data (json/text/file formats)
- **CoverageParseResult**: Typed parsing results with metadata
- **CoverageReportFormat**: Report format specifications (html/json/xml/markdown/terminal)
- **Type Guards**: `isJsonInput()`, `isTextInput()`, `isCoverageSuccessResult()`, etc.

#### Generation Types (`src/types/generation-types.ts`)
- **GenerationInput**: Discriminated union for test generation (structural/logical/incremental)
- **GenerationResult**: Typed generation results with test metadata
- **GenerationStrategy**: Strategy specifications (full/incremental/selective)
- **Type Guards**: `isStructuralInput()`, `isLogicalInput()`, `isGenerationSuccessResult()`, etc.

#### Reporting Types (`src/types/reporting-types.ts`)
- **ReportInput**: Discriminated union for report generation (gap-analysis/coverage/test-results/project-analysis)
- **ReportResult**: Typed report results
- **ReportOutput**: Output destination specifications (file/console/buffer)
- **Type Guards**: `isGapAnalysisInput()`, `isCoverageInput()`, `isReportSuccessResult()`, etc.

📖 **See detailed type documentation**: [`/docs/features/discriminated-union-types.md`](../features/discriminated-union-types.md)

## 📊 ProjectAnalyzer Interfaces

### ProjectAnalysis Interface
```typescript
interface ProjectAnalysis {
  projectPath: string;
  languages: DetectedLanguage[];
  frameworks: DetectedFramework[];
  packageManagers: DetectedPackageManager[];
  projectStructure: ProjectStructure;
  dependencies: Dependencies;
  testingSetup: TestingSetup;
  complexity: ComplexityMetrics;
}
```

### Language Detection
```typescript
interface DetectedLanguage {
  name: 'javascript' | 'typescript' | 'python';
  confidence: number;        // 0.0 to 1.0
  files: string[];          // Sample files found
  version?: string;         // Detected version if available
}
```

### Framework Detection
```typescript
interface DetectedFramework {
  name: 'react' | 'vue' | 'angular' | 'express' | 'fastapi' | 'django' | 'flask' | 'nextjs' | 'nuxt' | 'svelte';
  confidence: number;       // 0.0 to 1.0
  version?: string;         // Version from package.json/requirements
  configFiles: string[];   // Related configuration files
}
```

### Package Manager Detection
```typescript
interface DetectedPackageManager {
  name: 'npm' | 'yarn' | 'pnpm' | 'pip' | 'poetry' | 'pipenv';
  confidence: number;       // 0.0 to 1.0
  lockFiles: string[];     // Lock files found
}
```

### Project Structure
```typescript
interface ProjectStructure {
  rootFiles: string[];           // Files in project root
  srcDirectory: string | undefined;  // Main source directory
  testDirectories: string[];     // Existing test directories
  configFiles: string[];        // Configuration files
  buildOutputs: string[];       // Build/dist directories
  entryPoints: string[];        // Main entry files
}
```

### Dependencies
```typescript
interface Dependencies {
  production: Record<string, string>;    // Production dependencies
  development: Record<string, string>;   // Development dependencies
  python: Record<string, string> | undefined;  // Python dependencies
}
```

### Testing Setup
```typescript
interface TestingSetup {
  hasTests: boolean;
  testFrameworks: string[];      // Detected test frameworks
  testFiles: string[];          // Existing test files
  coverageTools: string[];      // Coverage tools found
}
```

### Complexity Metrics
```typescript
interface ComplexityMetrics {
  totalFiles: number;
  totalLines: number;
  averageFileSize: number;
  largestFiles: Array<{ path: string; lines: number }>;
}
```

## 🧪 TestGenerator Interfaces

### Test Generation Configuration
```typescript
interface TestGenerationConfig {
  projectPath: string;
  outputPath: string;
  framework: 'jest' | 'vitest' | 'pytest';
  include: string[];            // File patterns to include
  exclude: string[];            // File patterns to exclude
  features: {
    mocking: boolean;
    integration: boolean;
    edgeCases: boolean;
  };
}
```

### Test Generation Results
```typescript
interface TestGenerationResult {
  success: boolean;
  filesAnalyzed: number;
  testsGenerated: number;
  testLinesGenerated: number;
  generationTime: number;       // in milliseconds
  errors: string[];
}
```

### Test Template Context
```typescript
interface TestTemplateContext {
  fileName: string;
  relativePath: string;
  fileType: 'component' | 'utility' | 'service' | 'module';
  framework: string;
  language: 'javascript' | 'typescript' | 'python';
  imports: string[];
  exports: string[];
  dependencies: string[];
}
```

## 🏃 TestRunner Interfaces

### Test Execution Configuration
```typescript
interface TestExecutionConfig {
  testPath: string;             // Path to .claude-testing directory
  framework: 'jest' | 'pytest';
  coverage: boolean;
  watch: boolean;
  junit: boolean;               // Generate JUnit XML
  threshold?: string;           // Coverage threshold
  timeout?: number;            // Test timeout in ms
}
```

### Test Execution Results
```typescript
interface TestExecutionResult {
  success: boolean;
  tests: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
  };
  coverage?: {
    statements: number;
    branches: number;
    functions: number;
    lines: number;
  };
  duration: number;            // in milliseconds
  output: string;              // Raw test output
  errors: string[];
}
```

## 🛠️ Core Classes

### ProjectAnalyzer Class
```typescript
class ProjectAnalyzer {
  constructor(projectPath: string);
  
  async analyze(): Promise<ProjectAnalysis>;
  
  // Private methods for specific analysis tasks
  private async detectLanguages(): Promise<DetectedLanguage[]>;
  private async detectFrameworks(): Promise<DetectedFramework[]>;
  private async detectPackageManagers(): Promise<DetectedPackageManager[]>;
  private async analyzeProjectStructure(): Promise<ProjectStructure>;
  private async analyzeDependencies(): Promise<Dependencies>;
  private async analyzeTestingSetup(): Promise<TestingSetup>;
  private async calculateComplexity(): Promise<ComplexityMetrics>;
}
```

### TestGenerator Base Class
```typescript
abstract class TestGenerator {
  constructor(config: TestGenerationConfig);
  
  abstract async generate(): Promise<TestGenerationResult>;
  
  protected async analyzeFile(filePath: string): Promise<TestTemplateContext>;
  protected async generateTestFile(context: TestTemplateContext): Promise<string>;
  protected async writeTestFile(testPath: string, content: string): Promise<void>;
}
```

### StructuralTestGenerator Class
```typescript
class StructuralTestGenerator extends TestGenerator {
  constructor(config: TestGenerationConfig);
  
  async generate(): Promise<TestGenerationResult>;
  
  private async scanFiles(): Promise<string[]>;
  private async generateStructuralTest(filePath: string): Promise<string>;
  private async generateSetupFiles(): Promise<void>;
  private async generateMockFiles(): Promise<void>;
}
```

### TestRunner Base Class
```typescript
abstract class TestRunner {
  constructor(config: TestExecutionConfig);
  
  abstract async run(): Promise<TestExecutionResult>;
  abstract async parseOutput(output: string): Promise<any>;
  
  protected async executeCommand(command: string, args: string[]): Promise<string>;
  protected async validateTestPath(): Promise<void>;
}
```

### JestRunner Class
```typescript
class JestRunner extends TestRunner {
  constructor(config: TestExecutionConfig);
  
  async run(): Promise<TestExecutionResult>;
  async parseOutput(output: string): Promise<any>;
  
  private buildJestConfig(): any;
  private buildJestArgs(): string[];
}
```

### PytestRunner Class
```typescript
class PytestRunner extends TestRunner {
  constructor(config: TestExecutionConfig);
  
  async run(): Promise<TestExecutionResult>;
  async parseOutput(output: string): Promise<any>;
  
  private buildPytestArgs(): string[];
  private parsePytestOutput(output: string): any;
}
```

## 🔧 CLI Command Interfaces

### CLI Command Options
```typescript
interface AnalyzeOptions {
  output?: string;
  format?: 'json' | 'markdown' | 'console';
  verbose?: boolean;
}

interface TestOptions {
  config?: string;
  onlyStructural?: boolean;
  onlyLogical?: boolean;
  coverage?: boolean;
  update?: boolean;
}

interface RunOptions {
  config?: string;
  framework?: 'jest' | 'pytest';
  coverage?: boolean;
  watch?: boolean;
  junit?: boolean;
  threshold?: string;
}

interface WatchOptions {
  config?: string;
}
```

## 🔌 Extension Points

### Custom Test Templates
```typescript
interface TestTemplate {
  name: string;
  fileExtension: string;
  framework: string;
  generate(context: TestTemplateContext): string;
}
```

### Custom Test Runners
```typescript
interface CustomTestRunner extends TestRunner {
  framework: string;
  isSupported(projectPath: string): Promise<boolean>;
}
```

### Plugin Interface
```typescript
interface Plugin {
  name: string;
  version: string;
  
  // Lifecycle hooks
  beforeAnalysis?(context: PluginContext): Promise<void>;
  afterAnalysis?(analysis: ProjectAnalysis, context: PluginContext): Promise<void>;
  beforeGeneration?(config: TestGenerationConfig, context: PluginContext): Promise<void>;
  afterGeneration?(result: TestGenerationResult, context: PluginContext): Promise<void>;
  beforeExecution?(config: TestExecutionConfig, context: PluginContext): Promise<void>;
  afterExecution?(result: TestExecutionResult, context: PluginContext): Promise<void>;
}

interface PluginContext {
  projectPath: string;
  outputPath: string;
  logger: Logger;
}
```

## 📝 Configuration Schema

### Project Configuration File
```typescript
interface ClaudeTestingConfig {
  include: string[];           // Glob patterns for files to test
  exclude: string[];           // Glob patterns for files to exclude
  testFramework: 'jest' | 'vitest' | 'pytest';
  outputDirectory?: string;    // Custom output directory (default: .claude-testing)
  
  coverage: {
    threshold: {
      statements: number;
      branches: number;
      functions: number;
      lines: number;
    };
    reporters: string[];       // Coverage reporters
  };
  
  features: {
    mocking: boolean;          // Generate mock files
    integration: boolean;      // Generate integration tests
    edgeCases: boolean;        // Include edge case testing
  };
  
  plugins?: string[];          // Plugin names to load
}
```

## 🔍 Error Handling

### Standard Error Types
```typescript
class AnalysisError extends Error {
  constructor(message: string, cause?: Error);
}

class GenerationError extends Error {
  constructor(message: string, filePath?: string, cause?: Error);
}

class ExecutionError extends Error {
  constructor(message: string, exitCode?: number, cause?: Error);
}

class ConfigurationError extends Error {
  constructor(message: string, configPath?: string, cause?: Error);
}
```

## 📊 Logging Interface

### Logger Interface
```typescript
interface Logger {
  debug(message: string, meta?: any): void;
  info(message: string, meta?: any): void;
  warn(message: string, meta?: any): void;
  error(message: string, error?: Error, meta?: any): void;
}
```

## 🚀 Usage Examples

### Programmatic API Usage
```typescript
import { ProjectAnalyzer, StructuralTestGenerator, JestRunner } from 'claude-testing-infrastructure';

// Analyze a project
const analyzer = new ProjectAnalyzer('/path/to/project');
const analysis = await analyzer.analyze();

// Generate tests
const generator = new StructuralTestGenerator({
  projectPath: '/path/to/project',
  outputPath: '/path/to/project/.claude-testing',
  framework: 'jest',
  include: ['**/*.{js,ts,jsx,tsx}'],
  exclude: ['**/*.test.*', '**/node_modules/**'],
  features: {
    mocking: true,
    integration: true,
    edgeCases: false
  }
});

const result = await generator.generate();

// Run tests
const runner = new JestRunner({
  testPath: '/path/to/project/.claude-testing',
  framework: 'jest',
  coverage: true,
  watch: false,
  junit: false
});

const testResult = await runner.run();
```

### Custom Plugin Example
```typescript
class CustomPlugin implements Plugin {
  name = 'custom-plugin';
  version = '1.0.0';
  
  async afterGeneration(result: TestGenerationResult, context: PluginContext): Promise<void> {
    context.logger.info(`Generated ${result.testsGenerated} tests in ${result.generationTime}ms`);
    
    // Custom post-processing
    // ...
  }
}
```

This API documentation provides the complete interface for extending and integrating with the Claude Testing Infrastructure.