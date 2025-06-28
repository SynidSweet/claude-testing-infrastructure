# Development Patterns & Conventions

*TypeScript-first infrastructure with strict patterns for reliability*

## Naming Conventions
- **Functions/Variables**: camelCase (`analyzeProject`, `testConfig`)
- **Classes**: PascalCase (`ProjectAnalyzer`, `TestGenerator`)
- **Files**: kebab-case (`project-analyzer.ts`, `test-runner.ts`)
- **Directories**: kebab-case (`cli/commands`, `analyzers`)
- **Constants**: SCREAMING_SNAKE_CASE (`DEFAULT_TIMEOUT`, `MAX_RETRIES`)

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

### Modern Node.js API Usage
- **File System Operations**: Use modern `fs.rm()` instead of deprecated `fs.rmdir()` for recursive directory removal
- **Compatibility**: Always use the latest stable Node.js filesystem APIs to avoid deprecation warnings
- **Example**: `await fs.rm(tempDir, { recursive: true })` for cleaning up test directories

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