# Core Features & User Journeys

*Last updated: 2025-06-28 | Watch Mode Added*

## Primary User Flows
1. **Project Analysis**: `analyze` → Detect languages, frameworks, and generate recommendations
2. **Test Generation**: `test` → Create comprehensive structural tests with optional AI-powered logical tests  
3. **Test Execution**: `run` → Execute tests with coverage reporting and gap analysis
4. **Incremental Updates**: `incremental` → Smart test updates based on Git changes with cost optimization
5. **Watch Mode**: `watch` → Real-time file monitoring with automatic incremental test generation
6. **AI Enhancement**: `analyze-gaps` → `generate-logical` → Complete AI-powered logical test generation

## Feature Modules

### Core Analysis & Generation
- **ProjectAnalyzer** (`src/analyzers/ProjectAnalyzer.ts`): Language/framework detection with 8+ framework support
- **TestGenerator** (`src/generators/TestGenerator.ts`): Abstract base class for test generation with lifecycle management  
- **StructuralTestGenerator** (`src/generators/StructuralTestGenerator.ts`): Intelligent structural test scaffolding and analysis
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

## Data Models & Entities
- **ProjectAnalysis**: Framework detection results, project type classification, existing test structure analysis
- **Configuration**: Testing framework settings, coverage thresholds, environment variables, CI/CD pipeline definitions
- **TestPlan**: Generated test cases, template mappings, dependency requirements, coverage targets
- **ComponentInfo**: Discovered UI components, props/hooks analysis, testing recommendations

## See Also
- 📖 **Project Overview**: [`/docs/project/overview.md`](../project/overview.md)
- 📖 **Commands Reference**: [`/docs/reference/commands.md`](../reference/commands.md)
- 📖 **Architecture Overview**: [`/docs/architecture/overview.md`](../architecture/overview.md)