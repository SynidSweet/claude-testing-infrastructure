# Core Features & User Journeys

*Last updated: 2025-07-01 | All moderate-priority improvements verified as complete*

## Primary User Flows
1. **Project Analysis**: `analyze` → Detect languages, frameworks, and generate recommendations
2. **Test Generation Preview**: `test --dry-run` → Preview test generation without creating files
3. **Test Generation**: `test` → Create comprehensive structural tests with optional AI-powered logical tests  
4. **Test Execution**: `run` → Execute tests with coverage reporting and gap analysis
5. **Incremental Updates**: `incremental` → Smart test updates based on Git changes with cost optimization
6. **Watch Mode**: `watch` → Real-time file monitoring with automatic incremental test generation
7. **AI Enhancement**: `analyze-gaps` → `generate-logical` → Complete AI-powered logical test generation

## Feature Modules

### Core Analysis & Generation
- **ProjectAnalyzer** (`src/analyzers/ProjectAnalyzer.ts`): Language/framework detection with 8+ framework support
- **TestGenerator** (`src/generators/TestGenerator.ts`): Abstract base class for test generation with lifecycle management and configurable file count validation  
- **BaseTestGenerator** (`src/generators/base/BaseTestGenerator.ts`): Abstract base class for language-specific test generators with comprehensive language context support
- **TestGeneratorFactory** (`src/generators/TestGeneratorFactory.ts`): Factory pattern for creating appropriate test generators based on language detection and feature flags
- **JavaScriptTestGenerator** (`src/generators/javascript/JavaScriptTestGenerator.ts`): JavaScript/TypeScript specific test generator with module system detection, export analysis, and framework-aware test generation
- **StructuralTestGenerator** (`src/generators/StructuralTestGenerator.ts`): Intelligent structural test scaffolding and analysis with dry-run support, ratio validation, and working exclude pattern integration
- **TestTemplateEngine** (`src/generators/templates/TestTemplateEngine.ts`): Framework-specific template system

### Test Execution & Coverage
- **TestRunner** (`src/runners/TestRunner.ts`): Production-ready Jest/pytest execution with timeout handling
- **CoverageReporter** (`src/runners/CoverageReporter.ts`): Advanced multi-format coverage analysis and gap visualization
- **CoverageVisualizer** (`src/runners/CoverageVisualizer.ts`): HTML, JSON, and Markdown report generation

### AI Integration
- **TestGapAnalyzer** (`src/analyzers/TestGapAnalyzer.ts`): AI-powered gap analysis with cost estimation
- **GapReportGenerator** (`src/analyzers/GapReportGenerator.ts`): Enhanced gap visualization and actionable insights
- **ClaudeOrchestrator** (`src/ai/ClaudeOrchestrator.ts`): Parallel Claude process management for AI test generation
- **AITaskPreparation** (`src/ai/AITaskPreparation.ts`): Task preparation and batch optimization for AI generation

### State Management & Incremental Updates  
- **IncrementalGenerator** (`src/state/IncrementalGenerator.ts`): Git-based change detection with smart test updates
- **ManifestManager** (`src/state/ManifestManager.ts`): Test manifest and baseline management
- **ChangeDetector** (`src/state/ChangeDetector.ts`): File change analysis and impact scoring

### Watch Mode & Real-time Features
- **Watch Command** (`src/cli/commands/watch.ts`): Real-time file monitoring with debounced incremental test generation
- **FileWatcher** (`src/utils/FileWatcher.ts`): Cross-platform file system monitoring with intelligent filtering  
- **Debouncer** (`src/utils/Debouncer.ts`): Smart event batching utility for reducing excessive processing

### User Experience & Feedback
- **ProgressReporter** (`src/utils/ProgressReporter.ts`): Real-time progress tracking with ETA calculations, file-by-file updates, and comprehensive statistics
- **Error Handling System** (`src/utils/error-handling.ts`): Standardized error handling with custom error classes and wrapper functions
- **Dry-Run Mode**: Full preview functionality showing exactly what would be generated without creating files
- **File Count Validation**: Test-to-source ratio validation preventing excessive test generation with configurable thresholds

### Test Quality & Assertions
- **TestTemplateEngine** (`src/generators/templates/TestTemplateEngine.ts`): Generates meaningful test assertions including:
  - Module existence and export validation
  - Type checking and function behavior testing
  - Async function handling and error scenarios
  - Object property testing and input validation
  - **ES Module Support**: Proper ES module import syntax when `moduleSystem: 'esm'` specified
  - **React Component Testing**: Full React testing templates with JSX for ES modules, basic structural tests for CommonJS
- **Mixed Project Support**: Comprehensive test fixtures for projects using multiple languages and module systems

## Data Models & Entities
- **ProjectAnalysis**: Framework detection results, project type classification, existing test structure analysis
- **Configuration**: Testing framework settings, coverage thresholds, environment variables, CI/CD pipeline definitions
- **TestPlan**: Generated test cases, template mappings, dependency requirements, coverage targets
- **ComponentInfo**: Discovered UI components, props/hooks analysis, testing recommendations

## See Also
- 📖 **Project Overview**: [`/docs/project/overview.md`](../project/overview.md)
- 📖 **Commands Reference**: [`/docs/reference/commands.md`](../reference/commands.md)
- 📖 **Architecture Overview**: [`/docs/architecture/overview.md`](../architecture/overview.md)