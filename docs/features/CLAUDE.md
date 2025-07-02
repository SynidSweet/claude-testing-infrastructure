# Features Documentation - AI Agent Guide

*Quick navigation for AI agents working with specific features and components*

*Last updated: 2025-07-02 | Updated by: /document command | Enhanced ConfigurationService environment variable support*

## 🎯 Purpose

This guide helps AI agents understand and work with individual features of the Claude Testing Infrastructure. Each feature has specific patterns, integration points, and modification guidelines.

## 🔍 Core Features Overview

### File Discovery Service ✅ IMPLEMENTATION COMPLETE
**Purpose**: Centralized file discovery with caching and user-configurable pattern management  
**Status**: All 4 tasks complete - Singleton factory pattern with comprehensive end-to-end testing  
**Key Files**:
- `src/services/FileDiscoveryService.ts` - Main orchestrator service with performance monitoring
- `src/services/FileDiscoveryServiceFactory.ts` - Singleton factory for consistent service instances ✅ NEW
- `src/services/PatternManager.ts` - Language-specific pattern resolution with user configuration support
- `src/services/FileDiscoveryCache.ts` - Memory cache with TTL and statistics
- `src/types/file-discovery-types.ts` - Complete type definitions
- `src/config/ConfigurationService.ts` - Provides getFileDiscoveryConfig() method
- `tests/integration/FileDiscoveryService.integration.test.ts` - Comprehensive end-to-end testing ✅ NEW
**Integrations**: All CLI commands, TestRunners, StructuralTestGenerator, ProjectAnalyzer, TestRunnerFactory ✅ COMPLETE

### Project Analysis
**Purpose**: Detect languages, frameworks, and project structure  
**Key File**: `src/analyzers/ProjectAnalyzer.ts`  
**Adapters**: `JavaScriptAdapter`, `PythonAdapter`  
**Enhancement**: ✅ Fully integrated with FileDiscoveryService via singleton factory pattern for consistent file scanning with caching and fallback support

### Test Generation
**Purpose**: Create comprehensive test files  
**Key Files**: 
- `src/generators/TestGenerator.ts` - Orchestrator
- `src/generators/StructuralTestGenerator.ts` - Basic tests
- `src/generators/templates/TestTemplateEngine.ts` - Templates with correct import path calculation ✅ FIXED
- `src/generators/StructuralTestGenerator.ts` - Import path calculation methods ✅ NEW

### AI Integration
**Purpose**: Generate logical tests using Claude  
**Key Files**:
- `src/ai/ClaudeOrchestrator.ts` - API integration
- `src/ai/AITaskPreparation.ts` - Task batching
- `src/ai/ChunkedAITaskPreparation.ts` - Large file handling

### Configuration Management ✅ ENHANCED (2025-07-02)
**Purpose**: Centralized configuration loading with source precedence  
**Status**: **Enhanced** - advanced environment variable support with nested object mapping  
**Key Files**:
- `src/config/ConfigurationService.ts` - Core service with enhanced environment variable parsing
- `src/types/config.ts` - Complete configuration interfaces with all new properties
- `src/utils/config-validation.ts` - Full validation logic for all configuration fields
**Features**: Multi-source loading, error tracking, discovery algorithms, CLI integration, comprehensive environment variable support
**Recent Enhancement**: Enhanced environment variable parsing with intelligent nested object mapping, special case handling, and comprehensive type conversion

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
- `src/runners/JestRunner.ts` - Jest test execution ✅ Integrated with FileDiscoveryService via singleton factory
- `src/runners/PytestRunner.ts` - Pytest test execution ✅ Integrated with FileDiscoveryService via singleton factory
- `src/runners/TestRunnerFactory.ts` - Test runner creation ✅ Automatic FileDiscoveryService provisioning via singleton factory
- `src/runners/CoverageReporter.ts` - Coverage analysis
- `src/runners/CoverageVisualizer.ts` - Report generation
- `src/runners/templates/` - Consolidated template engine system

### Progress Reporting ✅ NEW
**Purpose**: Real-time progress tracking for test generation  
**Key File**: `src/utils/ProgressReporter.ts` - Progress tracking system  
**Features**: ETA calculations, file-by-file updates, error integration

### MCP Server Testing ✅ NEW
**Purpose**: Specialized testing for Model Context Protocol servers  
**Key Files**:
- `src/generators/templates/MCP*.ts` - 5 specialized test templates
- `src/types/mcp-types.ts` - MCP-specific type definitions
**Features**: Protocol compliance, tool integration, message handling, transport validation, chaos testing

## 📦 Working with Features

### File Discovery Service Feature

**📖 Detailed guide**: [`file-discovery-service.md`](./file-discovery-service.md)

#### Core Capabilities
- **Centralized discovery**: Single service for all file operations
- **Intelligent caching**: 70-90% hit rates with TTL expiration
- **Language patterns**: Framework-specific patterns for JS/TS and Python
- **User configuration**: Pattern overrides via configuration files

#### Key Operations
```typescript
// Recommended: Use singleton factory pattern
import { FileDiscoveryServiceFactory } from '../../services/FileDiscoveryServiceFactory';

const fileDiscovery = FileDiscoveryServiceFactory.create(configService);

// Basic file discovery
const result = await fileDiscovery.findFiles({
  baseDir: projectPath,
  type: FileDiscoveryType.PROJECT_ANALYSIS,
  languages: ['javascript', 'typescript']
});

// Test file discovery
const testFiles = await fileDiscovery.findTestFiles(directory, 'jest');

// Cache management
const stats = fileDiscovery.getCacheStats();
fileDiscovery.invalidateCache('/path/pattern');
```

#### Integration Points ✅ COMPLETE
- **All CLI Commands**: ✅ Fully integrated - all commands use FileDiscoveryServiceFactory for consistent service instances
- **ProjectAnalyzer**: ✅ Fully integrated - consistent file scanning with fallback support via singleton factory
- **StructuralTestGenerator**: ✅ Fully integrated - leverages cached file discovery with language filtering via singleton factory
- **TestRunners (Jest & Pytest)**: ✅ Fully integrated - discovers test files with framework patterns and language-specific filtering via singleton factory
- **TestRunnerFactory**: ✅ Fully integrated - automatically provisions FileDiscoveryService for all test runners via singleton factory

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

#### Import Path Generation ✅ FIXED (2025-07-01)
- **Relative Path Prefix**: Tests now generate correct imports with `./` prefix (`require('./calculator')` vs `require('calculator')`)
- **ES Module Support**: Proper import syntax with relative paths for ESM (`import Button from './Button.js'`)
- **CommonJS Support**: Compatible require() statements with relative paths (`const { utils } = require('./utils')`)
- **File Path Resolution**: Corrected test file path generation (removed duplicate 'tests' directory)
- **Template System**: All template classes (JavaScript, TypeScript, React) now generate correct paths

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

### Configuration Management Feature ✅ IMPLEMENTED

#### Core Components
- **ConfigurationService**: `src/config/ConfigurationService.ts` - Centralized loading
- **Source Management**: Track and prioritize configuration sources
- **Discovery**: Automatic detection of config files
- **CLI Integration**: All 8 commands now use consistent configuration loading

#### Working with Configuration
```typescript
// Standard pattern used across all commands
import { loadCommandConfig } from '../config/ConfigurationService';

const result = await loadCommandConfig(projectPath, {
  customConfigPath: options.config,
  cliArgs: {
    verbose: options.verbose,
    aiModel: options.model
  }
});

if (!result.valid) {
  logger.warn('Configuration validation warnings', { 
    warnings: result.warnings 
  });
}

const config = result.config;
```

#### Integration Status
- ✅ All CLI commands integrated
- ✅ CLI argument mapping implemented
- ✅ Source precedence working correctly
- ✅ Validation and error handling complete

📖 **Detailed guide**: [`configuration-service.md`](./configuration-service.md)

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

### Configuration ✅ IMPLEMENTED
- Load: `loadCommandConfig()`
- Service: `ConfigurationService`
- Sources: CLI > env > project > user > defaults
- Commands: All 8 commands integrated

### Execution
- Run: `TestRunner.run()`
- Coverage: `CoverageReporter`
- Reports: `CoverageVisualizer`

### State
- Track: `ManifestManager`
- Detect: `ChangeDetector`
- Update: `IncrementalTestGenerator`

### Progress
- Report: `ProgressReporter` ✅ NEW
- Track: Real-time file processing
- Display: ETA and completion stats

---

**Feature Philosophy**: Each feature should be powerful yet simple, working independently while integrating seamlessly.