# Features Documentation - AI Agent Guide

*Quick navigation for AI agents working with specific features and components*

## 🎯 Purpose

This guide helps AI agents understand and work with individual features of the Claude Testing Infrastructure. Each feature has specific patterns, integration points, and modification guidelines.

## 🔍 Core Features Overview

### Project Analysis
**Purpose**: Detect languages, frameworks, and project structure  
**Key File**: `src/analyzers/ProjectAnalyzer.ts`  
**Adapters**: `JavaScriptAdapter`, `PythonAdapter`

### Test Generation
**Purpose**: Create comprehensive test files  
**Key Files**: 
- `src/generators/TestGenerator.ts` - Orchestrator
- `src/generators/StructuralTestGenerator.ts` - Basic tests
- `src/generators/templates/TestTemplateEngine.ts` - Templates

### AI Integration
**Purpose**: Generate logical tests using Claude  
**Key Files**:
- `src/ai/ClaudeOrchestrator.ts` - API integration
- `src/ai/AITaskPreparation.ts` - Task batching
- `src/ai/ChunkedAITaskPreparation.ts` - Large file handling

### Batched AI Processing ✅ NEW
**Purpose**: Large-scale AI test generation with state persistence  
**Key Files**:
- `src/ai/BatchedLogicalTestGenerator.ts` - Core batching system
- `src/cli/commands/generate-logical-batch.ts` - Dedicated CLI command  
**Features**: Configurable batches, resume functionality, progress tracking

### Incremental Testing
**Purpose**: Smart updates based on Git changes  
**Key Files**:
- `src/state/ManifestManager.ts` - State tracking
- `src/state/ChangeDetector.ts` - Git diff analysis
- `src/state/IncrementalTestGenerator.ts` - Selective generation

### Test Execution
**Purpose**: Run tests and generate coverage reports  
**Key Files**:
- `src/runners/TestRunner.ts` - Execution orchestrator
- `src/runners/CoverageReporter.ts` - Coverage analysis
- `src/runners/CoverageVisualizer.ts` - Report generation

## 📦 Working with Features

### Project Analysis Feature

#### Understanding Detection Flow
```typescript
// 1. Entry point analyzes project
const analyzer = new ProjectAnalyzer();
const analysis = await analyzer.analyze(projectPath);

// 2. Language adapters detect specifics
// JavaScriptAdapter handles: JS, TS, React, Vue, Angular
// PythonAdapter handles: Python, FastAPI, Flask, Django
```

#### Modifying Analysis
- **Add framework**: Update adapter's `detectFrameworks()`
- **Add language**: Create new adapter implementing `LanguageAdapter`
- **Enhance detection**: Modify `analyzeStructure()` in analyzer

### Test Generation Feature

#### Generation Pipeline
1. **Structural tests** - Basic test scaffolding
2. **AI enhancement** - Logical test generation
3. **Template application** - Framework-specific patterns

#### Common Modifications
- **New test patterns**: Update `TestTemplateEngine`
- **Better assertions**: Enhance template strings
- **Framework support**: Add to language adapter

### AI Integration Feature

#### Key Components
- **Model mapping**: `src/utils/model-mapping.ts` - Claude model names
- **Cost estimation**: `src/utils/cost-estimation.ts` - Token pricing
- **Chunking**: `src/utils/file-chunking.ts` - Large file handling

#### Enhancement Points
- **Model support**: Add to model mapping
- **Batch optimization**: Modify `AITaskPreparation`
- **Error handling**: Enhance `ClaudeOrchestrator`

### Incremental Testing Feature

#### State Management
```
.claude-testing/
├── manifest.json       # Current state
├── history/           # Change history
└── baseline.json      # Comparison point
```

#### Modification Guidelines
- **Change detection**: Update `ChangeDetector`
- **State format**: Modify `ManifestManager`
- **Cost optimization**: Enhance `IncrementalTestGenerator`

### Watch Mode Feature

#### Components
- **File watching**: `src/utils/FileWatcher.ts`
- **Debouncing**: `src/utils/Debouncer.ts`
- **CLI command**: `src/cli/commands/watch.ts`

#### Enhancements
- **Filter patterns**: Update watcher configuration
- **Batch timing**: Adjust debounce intervals
- **Integration**: Connect to incremental system

## 🔧 Feature Integration Points

### Adding Features to CLI
1. Create command in `src/cli/commands/`
2. Register in `src/cli/index.ts`
3. Add to help text
4. Update documentation

### Connecting Features
- **Analysis → Generation**: Pass `ProjectAnalysis` results
- **Generation → AI**: Create `AITask` batches
- **State → Incremental**: Use manifest for decisions
- **Runner → Reporter**: Feed results to coverage

## 📊 Feature-Specific Patterns

### Orchestrator Pattern
Used in: TestGenerator, TestRunner, ClaudeOrchestrator
```typescript
class FeatureOrchestrator {
  constructor(
    private componentA: ComponentA,
    private componentB: ComponentB
  ) {}
  
  async orchestrate(input: Input): Promise<Result> {
    const resultA = await this.componentA.process(input);
    const resultB = await this.componentB.process(resultA);
    return this.combine(resultA, resultB);
  }
}
```

### Adapter Pattern
Used in: Language support, Test runners
```typescript
interface FeatureAdapter {
  supports(type: string): boolean;
  process(input: Input): Promise<Output>;
}
```

### Repository Pattern
Used in: State management, Configuration
```typescript
class FeatureRepository {
  async save(data: Data): Promise<void>;
  async load(): Promise<Data>;
  async exists(): Promise<boolean>;
}
```

## 🚨 Feature Constraints

### Performance Limits
- **File discovery**: Use glob patterns efficiently
- **AI batching**: Max 10-20 tasks per batch
- **State size**: Keep manifests under 10MB
- **Memory usage**: Stream large files

### Integration Rules
- **Feature isolation**: Each feature should work independently
- **State compatibility**: Changes must support existing data
- **Error propagation**: Use standardized error types
- **Cost awareness**: Always estimate AI costs

## 📝 Feature Documentation

### Where to Document
- **Technical details**: In code comments
- **User guidance**: In `/docs/user/`
- **API changes**: In `/docs/api/`
- **Architecture decisions**: In `/docs/architecture/decisions.md`

### Documentation Requirements
- Explain the "why" not just the "what"
- Include examples for common use cases
- Document error scenarios
- Note performance considerations

## 🔗 Related Documentation

- **Architecture**: [`/docs/architecture/CLAUDE.md`](../architecture/CLAUDE.md) - System design
- **Development**: [`/docs/development/CLAUDE.md`](../development/CLAUDE.md) - Dev workflow
- **Planning**: [`/docs/planning/CLAUDE.md`](../planning/CLAUDE.md) - Task management
- **API**: [`/docs/api/CLAUDE.md`](../api/CLAUDE.md) - Interfaces
- **User Guide**: [`/docs/user/CLAUDE.md`](../user/CLAUDE.md) - Usage docs

## ⚡ Quick Feature Reference

### Analysis
- Detect: `ProjectAnalyzer.analyze()`
- Frameworks: In language adapters
- Results: `ProjectAnalysis` interface

### Generation
- Structural: `StructuralTestGenerator`
- AI: `ClaudeOrchestrator`
- Batched AI: `BatchedLogicalTestGenerator` ✅ NEW
- Templates: `TestTemplateEngine`

### Execution
- Run: `TestRunner.run()`
- Coverage: `CoverageReporter`
- Reports: `CoverageVisualizer`

### State
- Track: `ManifestManager`
- Detect: `ChangeDetector`
- Update: `IncrementalTestGenerator`

---

**Feature Philosophy**: Each feature should be powerful yet simple, working independently while integrating seamlessly.