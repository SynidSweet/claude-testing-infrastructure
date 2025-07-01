# API Documentation - AI Agent Guide

*Quick navigation for AI agents working with APIs and TypeScript interfaces*

## 🎯 Purpose

This guide helps AI agents understand the Claude Testing Infrastructure's programmatic interfaces, type definitions, and API contracts. Use this when implementing features or integrating with the system.

## 📐 Core Type System

### Type Organization
```
src/types/
├── index.ts              # Main type exports
├── config.ts             # Configuration interfaces
├── analysis-types.ts     # Analysis discriminated unions
├── coverage-types.ts     # Coverage discriminated unions
├── generation-types.ts   # Generation discriminated unions
├── reporting-types.ts    # Reporting discriminated unions
└── state.ts             # State management types
```

### Discriminated Union Pattern
The codebase uses discriminated unions for type safety:

```typescript
// Example from analysis-types.ts
export type AnalysisResult = 
  | { type: 'success'; data: ProjectAnalysis }
  | { type: 'error'; error: AnalysisError }
  | { type: 'partial'; data: ProjectAnalysis; warnings: string[] };

// Type guards for narrowing
export function isAnalysisSuccess(result: AnalysisResult): result is AnalysisSuccessResult {
  return result.type === 'success';
}
```

## 🔌 Key Interfaces

### Project Analysis
```typescript
interface ProjectAnalysis {
  projectPath: string;
  primaryLanguage: 'javascript' | 'python' | 'unknown';
  languages: Language[];
  frameworks: Framework[];
  hasTests: boolean;
  testFramework?: string;
  packageManager?: 'npm' | 'yarn' | 'pnpm' | 'pip';
  entryPoints: string[];
  dependencies: Dependency[];
  structure: ProjectStructure;
}
```

### Test Generation
```typescript
interface TestGeneratorConfig {
  projectPath: string;
  outputPath: string;
  framework?: string;
  testType: 'unit' | 'integration' | 'both';
  includePatterns?: string[];
  excludePatterns?: string[];
  aiEnabled?: boolean;
  aiModel?: string;
  maxConcurrency?: number;
}
```

### Coverage Reporting
```typescript
interface CoverageReport {
  summary: CoverageSummary;
  files: FileCoverage[];
  timestamp: string;
  thresholds: CoverageThresholds;
  format: 'html' | 'json' | 'lcov' | 'text';
}
```

### State Management
```typescript
interface TestManifest {
  version: string;
  projectPath: string;
  lastUpdated: string;
  files: ManifestFile[];
  baseline?: BaselineData;
  history: HistoryEntry[];
}
```

## 🏗️ API Patterns

### Command Pattern
All CLI commands follow this structure:
```typescript
interface Command {
  name: string;
  description: string;
  options: CommandOption[];
  action: (args: any, options: any) => Promise<void>;
}
```

### Adapter Pattern
Language support uses adapters:
```typescript
interface LanguageAdapter {
  language: string;
  fileExtensions: string[];
  
  detectFrameworks(projectPath: string): Promise<Framework[]>;
  analyzeFile(filePath: string): Promise<FileAnalysis>;
  generateTest(analysis: FileAnalysis): Promise<TestFile>;
  getTestRunner(): TestRunner;
}
```

### Repository Pattern
State persistence follows repository pattern:
```typescript
interface Repository<T> {
  save(data: T): Promise<void>;
  load(): Promise<T | null>;
  exists(): Promise<boolean>;
  delete(): Promise<void>;
}
```

## 📊 API Usage Examples

### Using the Analyzer API
```typescript
import { ProjectAnalyzer } from '@claude-testing/core';

// Create analyzer instance
const analyzer = new ProjectAnalyzer();

// Analyze a project
const analysis = await analyzer.analyze('/path/to/project');

// Check results with type guards
if (analysis.primaryLanguage === 'javascript') {
  // TypeScript knows this is JavaScript project
  console.log(`Found ${analysis.frameworks.length} JS frameworks`);
}
```

### Using the Generator API
```typescript
import { TestGenerator, TestGeneratorConfig } from '@claude-testing/core';

// Configure generation
const config: TestGeneratorConfig = {
  projectPath: '/path/to/project',
  outputPath: '.claude-testing',
  aiEnabled: true,
  testType: 'both'
};

// Generate tests
const generator = new TestGenerator(config);
const result = await generator.generate();

// Handle discriminated union result
switch (result.type) {
  case 'success':
    console.log(`Generated ${result.data.fileCount} test files`);
    break;
  case 'partial':
    console.log(`Generated with warnings: ${result.warnings.join(', ')}`);
    break;
  case 'error':
    console.error(`Generation failed: ${result.error.message}`);
    break;
}
```

### Using State Management API
```typescript
import { ManifestManager } from '@claude-testing/state';

// Load or create manifest
const manager = new ManifestManager('/path/to/project');
const manifest = await manager.loadOrCreate();

// Update manifest
await manager.updateFile({
  path: 'src/index.js',
  hash: 'abc123',
  lastModified: Date.now(),
  testPath: '.claude-testing/src/index.test.js'
});

// Save changes
await manager.save(manifest);
```

## 🔐 Error Handling

### Standard Error Types
```typescript
export class ProjectNotFoundError extends Error {
  constructor(projectPath: string) {
    super(`Project not found: ${projectPath}`);
    this.name = 'ProjectNotFoundError';
  }
}

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(`Configuration error: ${message}`);
    this.name = 'ConfigurationError';
  }
}

export class AIGenerationError extends Error {
  constructor(message: string, public cost?: number) {
    super(`AI generation failed: ${message}`);
    this.name = 'AIGenerationError';
  }
}
```

### Error Handling Pattern
```typescript
try {
  const result = await generator.generate();
  // Handle success
} catch (error) {
  if (error instanceof ProjectNotFoundError) {
    // Handle missing project
  } else if (error instanceof AIGenerationError) {
    // Handle AI failure, check cost
  } else {
    // Handle unexpected error
  }
}
```

## 🔄 API Versioning

### Version Strategy
- **Major**: Breaking changes to interfaces
- **Minor**: New features, backward compatible
- **Patch**: Bug fixes, no API changes

### Checking Version
```typescript
import { version } from '@claude-testing/core';

if (version.startsWith('2.')) {
  // Use v2 API features
}
```

## 📝 Extending the API

### Adding New Commands
1. Define command interface in `src/cli/commands/`
2. Implement command logic
3. Register in CLI router
4. Add types to exports

### Adding New Adapters
1. Implement `LanguageAdapter` interface
2. Register in `ProjectAnalyzer`
3. Add language-specific types
4. Export from main index

### Adding New Types
1. Follow discriminated union pattern
2. Include type guards
3. Document with JSDoc
4. Export from appropriate module

## 🚨 API Constraints

### Performance Limits
- Max 10,000 files per analysis
- Max 100 concurrent AI requests
- Max 50MB manifest size
- 5-minute timeout for operations

### Type Safety Rules
- No `any` types in public APIs
- All unions must be discriminated
- Type guards for all unions
- Strict null checks enabled

## 🔗 Related Documentation

- **Architecture**: [`/docs/architecture/CLAUDE.md`](../architecture/CLAUDE.md) - System design
- **Development**: [`/docs/development/CLAUDE.md`](../development/CLAUDE.md) - Implementation
- **Features**: [`/docs/features/CLAUDE.md`](../features/CLAUDE.md) - Components
- **Planning**: [`/docs/planning/CLAUDE.md`](../planning/CLAUDE.md) - Roadmap
- **User Guide**: [`/docs/user/CLAUDE.md`](../user/CLAUDE.md) - Usage

## ⚡ Quick API Reference

### Analysis
```typescript
analyzer.analyze(path) → Promise<ProjectAnalysis>
analyzer.analyzeFile(path) → Promise<FileAnalysis>
```

### Generation
```typescript
generator.generate() → Promise<GenerationResult>
generator.generateSingle(file) → Promise<TestFile>
```

### Execution
```typescript
runner.run(config) → Promise<TestResult>
runner.coverage(result) → Promise<CoverageReport>
```

### State
```typescript
manifest.updateFile(file) → Promise<void>
manifest.getChangedFiles() → Promise<ChangedFile[]>
```

---

**API Philosophy**: Type-safe, predictable, and extensible interfaces that never break existing integrations.