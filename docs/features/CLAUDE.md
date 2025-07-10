# Features Documentation - AI Agent Guide

*Quick navigation for AI agents working with specific features and components*

*Last updated: 2025-07-10 | Updated by: /document command | Configuration Service modularization 70% complete - REF-CONFIG-004 Configuration Merger extraction*

## 🎯 Purpose

This guide helps AI agents understand and work with individual features of the Claude Testing Infrastructure. Each feature has specific patterns, integration points, and modification guidelines.

## 🔍 Core Features Overview

### File Discovery Service ✅ IMPLEMENTATION COMPLETE + SMART PATTERNS
**Purpose**: Centralized file discovery with caching, user-configurable patterns, and smart project structure detection  
**Status**: All 4 tasks complete + Smart pattern integration (REF-PATTERNS-002) ✅ NEW  
**Key Files**:
- `src/services/FileDiscoveryService.ts` - Main orchestrator with smart pattern integration ✅ ENHANCED
- `src/services/FileDiscoveryServiceFactory.ts` - Singleton factory for consistent service instances
- `src/services/ProjectStructureDetector.ts` - Intelligent project structure analysis ✅ INTEGRATED
- `src/services/PatternManager.ts` - Language-specific pattern resolution with user configuration
- `src/services/FileDiscoveryCache.ts` - Memory cache with TTL and statistics
- `src/types/file-discovery-types.ts` - Type definitions with smart detection config
- `src/config/ConfigurationService.ts` - Enhanced with smartDetection configuration
- `tests/integration/FileDiscoveryService.integration.test.ts` - Comprehensive end-to-end testing
**Features**: Smart pattern detection, workspace-specific patterns, confidence scoring, CLI integration
**Integrations**: All CLI commands, TestRunners, StructuralTestGenerator, ProjectAnalyzer, TestRunnerFactory ✅ COMPLETE

### Enhanced File Discovery ✅ TYPE SAFETY ENHANCED
**Purpose**: Type-safe file discovery with structured error handling and pattern building  
**Status**: Type safety enhancement complete - Added comprehensive TypeScript interfaces  
**Key Files**:
- `src/types/enhanced-file-discovery-types.ts` - Enhanced type definitions with const enums ✅ NEW
- `src/services/EnhancedFileDiscoveryService.ts` - Type-safe service implementation ✅ NEW
- `src/services/PatternBuilder.ts` - Fluent API for type-safe pattern construction ✅ NEW
- `src/services/CacheKeyGenerator.ts` - Deterministic cache key generation with SHA-256 ✅ NEW
- `src/services/EnhancedPatternValidator.ts` - Comprehensive pattern validation ✅ NEW
- `tests/services/enhanced-file-discovery.test.ts` - 25 new test cases ✅ NEW
**Features**: Const enums for languages/frameworks, discriminated union error types, fluent pattern builder API, deterministic cache keys, detailed validation with error codes

### Project Analysis
**Purpose**: Detect languages, frameworks, and project structure  
**Key File**: `src/analyzers/ProjectAnalyzer.ts`  
**Adapters**: `JavaScriptAdapter`, `PythonAdapter`  
**Enhancement**: ✅ Fully integrated with FileDiscoveryService via singleton factory pattern for consistent file scanning with caching and fallback support

### Test Generation ✅ ENHANCED TEMPLATE CLASS EXTRACTION COMPLETED
**Purpose**: Create comprehensive test files with confidence-based template selection system and modular template classes  
**Key Files**: 
- `src/generators/TestGenerator.ts` - Orchestrator
- `src/generators/StructuralTestGenerator.ts` - Basic tests
- `src/generators/templates/TestTemplateEngine.ts` - Enhanced with TemplateRegistry architecture ✅ MIGRATED
- `src/generators/templates/core/TemplateRegistry.ts` - Centralized template management with confidence scoring ✅ NEW
- `src/generators/templates/core/TemplateEngine.ts` - Template execution engine with performance monitoring ✅ NEW
- `src/generators/templates/javascript/` - Enhanced template classes in separate files ✅ EXTRACTED
- `src/generators/types/contexts.ts` - Rich language and framework context types for enhanced templates
**Recent Enhancement**: Extracted 5 enhanced template classes (1,765 lines → 5 focused files) into separate modules under `src/generators/templates/javascript/` for improved maintainability. All template functionality preserved with better code organization.

### AI Integration
**Purpose**: Generate logical tests using Claude  
**Key Files**:
- `src/ai/ClaudeOrchestrator.ts` - API integration
- `src/ai/AITaskPreparation.ts` - Task batching
- `src/ai/ChunkedAITaskPreparation.ts` - Large file handling

### Configuration Management ✅ MODULAR ARCHITECTURE (2025-07-10)
**Purpose**: Centralized configuration loading with modular architecture for maintainability and testability  
**Status**: **Comprehensive Modularization** - extracted source loaders (REF-CONFIG-001), environment parser (REF-CONFIG-002), and configuration merger (REF-CONFIG-004)  
**Key Files**:
- `src/config/ConfigurationService.ts` - Core service with dependency injection (~368 lines, reduced from 1,467)
- `src/config/loaders/` - Modular source loaders (Default, User, Project, CustomFile, Registry)
- `src/config/EnvironmentVariableParser.ts` - Dedicated environment variable parsing module (428 lines)
- `src/config/ConfigurationMerger.ts` - Dedicated configuration merging and validation module (147 lines)
- `src/types/config.ts` - Complete configuration interfaces with all new properties
- `src/utils/config-validation.ts` - Full validation logic for all configuration fields
**Features**: Multi-source loading, error tracking, discovery algorithms, CLI integration, comprehensive environment variable support, type-safe deep merging, modular architecture, dependency injection pattern
**Recent Enhancement**: Completed REF-CONFIG-004 - extracted configuration merging logic into dedicated module with 14 comprehensive test cases. Combined with previous extractions, achieved 70% modularization with ~650 lines extracted across specialized modules while improving maintainability, testability, and type safety.

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

### Process Monitoring ✅ NEW
**Purpose**: Cross-platform process detection and resource debugging for testing workflows  
**Key Files**:
- `src/utils/ProcessMonitor.ts` - Core process detection utility
- `src/cli/commands/monitor.ts` - Dedicated CLI command
- `tests/utils/ProcessMonitor.test.ts` - Comprehensive test coverage
**Features**: High-resource process detection, testing framework recognition, cross-platform compatibility, watch mode integration

### Production Validation ✅ NEW
**Purpose**: Comprehensive production readiness validation and deployment automation  
**Key Files**:
- `scripts/production-readiness-check.js` - Enhanced production readiness checker with realistic thresholds
- `scripts/generate-validation-report.js` - Validation report generator with markdown/JSON output
- `scripts/production-deployment-checklist.js` - Automated deployment validation checklist
- `.github/workflows/test.yml` - CI/CD integration with production validation job
**Features**: Quality gate validation, realistic thresholds (93% test pass rate, 85% overall score), comprehensive reporting, deployment automation

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

// Smart pattern analysis (CLI feature)
const analysis = await fileDiscovery.analyzeProjectStructure(projectPath);
console.log('Structure:', analysis.detectedStructure, 'Confidence:', analysis.confidence);
```

#### Smart Pattern Detection ✅ NEW
- **Automatic Analysis**: Detects project structure (monorepo, standard-src, flat, etc.)
- **Confidence-Based**: Only applies patterns when confidence > threshold (default 0.7)
- **Workspace Support**: Handles monorepo workspaces with specific patterns
- **CLI Integration**: `--show-patterns` flag displays detected patterns
- **Configuration**: Control via `fileDiscovery.smartDetection` in config

#### Integration Points ✅ COMPLETE
- **All CLI Commands**: ✅ Fully integrated - all commands use FileDiscoveryServiceFactory for consistent service instances
- **ProjectAnalyzer**: ✅ Fully integrated - consistent file scanning with fallback support via singleton factory
- **StructuralTestGenerator**: ✅ Fully integrated - leverages cached file discovery with language filtering via singleton factory
- **TestRunners (Jest & Pytest)**: ✅ Fully integrated - discovers test files with framework patterns and language-specific filtering via singleton factory
- **TestRunnerFactory**: ✅ Fully integrated - automatically provisions FileDiscoveryService for all test runners via singleton factory

### Enhanced File Discovery Feature ✅ TYPE SAFETY ENHANCED

#### Type-Safe Pattern Building
```typescript
import { createPatternBuilder } from './services/PatternBuilder';

// Fluent API for pattern construction
const pattern = createPatternBuilder()
  .inDirectory('src')
  .recursive()
  .withExtensions(['ts', 'tsx'])
  .exclude('**/*.test.*')
  .build();

// Pre-configured patterns
const sourcePattern = createPatternBuilder.sourceFiles('typescript');
const testPattern = createPatternBuilder.testFiles('jest');
```

#### Structured Error Handling
```typescript
import { isFileDiscoveryError } from './types/enhanced-file-discovery-types';

const result = await enhancedDiscovery.findFiles(request);

if (!result.success) {
  if (result.error.kind === 'InvalidPatternError') {
    console.error(`Pattern error at position ${result.error.position}: ${result.error.message}`);
  }
  // Type-safe error handling with discriminated unions
}
```

#### Enhanced Pattern Validation
```typescript
import { EnhancedPatternValidator } from './services/EnhancedPatternValidator';

const validation = EnhancedPatternValidator.validate(patterns);

// Detailed validation results
validation.errors.forEach(error => {
  console.error(`${error.code}: ${error.message} at position ${error.position}`);
});

// Pattern optimization suggestions
validation.suggestions.forEach(suggestion => {
  console.log(`Consider: ${suggestion.suggested} instead of ${suggestion.original}`);
});
```

#### Const Enums for Type Safety
```typescript
import { SupportedLanguage, SupportedTestFramework } from './types/enhanced-file-discovery-types';

// Type-safe language and framework constants
const language = SupportedLanguage.TYPESCRIPT; // 'typescript'
const framework = SupportedTestFramework.JEST; // 'jest'

// Type guards for runtime validation
if (isSupportedLanguage(userInput)) {
  // userInput is now typed as SupportedLanguage
}
```

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

### Configuration Management Feature ✅ ENHANCED MODULAR ARCHITECTURE (2025-07-10)

#### Core Components
- **ConfigurationService**: `src/config/ConfigurationService.ts` - Centralized loading with dependency injection (~880 lines)
- **Source Loaders**: `src/config/loaders/` - Modular source loader architecture  
- **Environment Parser**: `src/config/EnvironmentVariableParser.ts` - Dedicated environment variable parsing (428 lines)
- **Loader Registry**: Orchestrates all configuration source loaders
- **CLI Integration**: All 8 commands now use consistent configuration loading

#### Modular Architecture ✅ COMPREHENSIVE (REF-CONFIG-001, REF-CONFIG-002, REF-CONFIG-004)
```typescript
// Comprehensive modular architecture with specialized modules
import { ConfigurationSourceLoaderRegistry } from '../config/loaders';
import { EnvironmentVariableParser } from '../config/EnvironmentVariableParser';
import { ConfigurationMerger } from '../config/ConfigurationMerger';

// Each source type has dedicated loader
- DefaultConfigurationLoader: Built-in defaults
- UserConfigurationLoader: User config files
- ProjectConfigurationLoader: Project config files  
- CustomFileConfigurationLoader: Custom config files

// Dedicated environment variable parsing
- EnvironmentVariableParser: Type conversion, special mappings, nested objects

// Dedicated configuration merging and validation
- ConfigurationMerger: Deep merge, validation orchestration, error aggregation

// Consistent interfaces across all modules
interface ConfigurationSourceLoader {
  load(): Promise<ConfigurationSourceLoadResult>;
  isAvailable(): Promise<boolean>;
  getDescription(): string;
}

interface EnvironmentVariableParser {
  parseEnvironmentVariables(env: Record<string, string | undefined>): EnvParsingResult;
}

interface ConfigurationMerger {
  mergeConfigurations(sources: ConfigurationSource[]): ConfigurationMergeResult;
  deepMerge(target: ConfigRecord, source: ConfigRecord): ConfigRecord;
}
```

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

#### Modularization Benefits
- ✅ **Separation of Concerns**: Each module handles single responsibility (source loading, env parsing, merging)
- ✅ **Type Safety**: Comprehensive TypeScript interfaces with proper type checking across all modules  
- ✅ **Testability**: Individual modules tested independently (14 merger tests, 15 env parser tests, 5 loader test suites)
- ✅ **Maintainability**: Reduced complexity from 1,467 to ~368 lines + specialized focused modules
- ✅ **Extensibility**: New configuration sources, parsing logic, and merge strategies easily added
- ✅ **Dependency Injection**: Clean integration patterns with injected dependencies across all modules

#### Integration Status
- ✅ All CLI commands integrated
- ✅ CLI argument mapping implemented
- ✅ Source precedence working correctly
- ✅ Validation and error handling complete
- ✅ Modular loader architecture implemented

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
- Templates: `TestTemplateEngine` ✅ TEMPLATE REGISTRY ENHANCED
- Template Registry: `TemplateRegistry` ✅ NEW - Confidence-based template selection
- Template Engine: `TemplateEngine` ✅ NEW - Safe generation with performance monitoring
- Template Utils: `TemplateContextUtils` ✅ NEW

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

### Process Monitoring ✅ NEW
- Monitor: `ProcessMonitor.detectHighResourceProcesses()`
- Filter: `ProcessMonitor.getTestingProcesses()`
- Display: `ProcessMonitor.formatProcessInfo()`
- CLI: `node dist/cli/index.js monitor`
- Integration: Watch mode `--monitor-processes`

### Production Validation ✅ NEW
- Readiness: `npm run validation:production`
- Reports: `npm run validation:report`
- Deployment: `npm run validation:deployment`
- Thresholds: 93% test pass rate, 85% overall score
- CI Integration: Automatic validation with artifact generation

---

**Feature Philosophy**: Each feature should be powerful yet simple, working independently while integrating seamlessly.