# Architecture Overview

*Last updated: 2025-07-13 | Adapter pattern implementation complete - Language adapter system for JavaScript/TypeScript and Python*

## System Design Philosophy

The Claude Testing Infrastructure follows a **decoupled, non-invasive architecture** that generates comprehensive test suites without modifying target projects. This design enables rapid test implementation while maintaining complete isolation from the codebase being tested.

## Core Architectural Patterns

### 1. Language Adapter Pattern ✅ **COMPLETED**
The system uses language-specific adapters to handle different programming languages and frameworks:

```typescript
interface LanguageAdapter {
  name: string;
  supportedLanguages: string[];
  detectFrameworks(projectPath: string): Promise<string[]>;
  generateTests(files: string[]): Promise<AdapterTestGenerationResult>;
  getTestRunner(): AdapterTestRunner;
}
```

**Current Implementation**:
```
src/adapters/
├── index.ts (Registry + Dynamic Loading)
├── JavaScriptAdapter.ts (JS/TS + React/Vue/Angular/Express/Fastify/NestJS)
├── PythonAdapter.ts (Python + FastAPI/Django/Flask)
└── AdapterFactory.ts (Management + Auto-detection)
```

**Key Features**:
- **Dynamic Loading**: Async adapter loading with `getLanguageAdapter()`
- **Registration System**: `registerLanguageAdapter()` and management functions  
- **Auto-detection**: Primary language detection from project analysis
- **Framework Detection**: Multi-framework support with priority ordering
- **Test Runners**: Language-appropriate test execution (Jest, Pytest)

### 2. Orchestrator Pattern
Large monolithic classes have been decomposed into focused services coordinated by orchestrators:

- **TemplateOrchestrator** → Manages template registration and selection (replaced 1,774-line TestTemplateEngine)
- **ProjectAnalysisOrchestrator** → Coordinates analysis services (part of ProjectAnalyzer refactoring from 1,585 to 800 lines)
- **TestGapAnalyzer** → Orchestrates gap analysis across multiple analyzers
- **ClaudeOrchestrator** → Service coordinator for AI task management (378 lines, refactored from 1,226)
- **ServiceFactory** → Centralizes service creation and dependency injection for orchestrator services
- **ProcessExecutor** → Handles Claude CLI process execution and lifecycle management
- **TaskExecutionService** → Manages individual task execution with retry logic and checkpoint management
- **ProcessPoolManager** → Dedicated process lifecycle management and monitoring
- **TaskQueueManager** → Dedicated task scheduling and concurrency control
- **ResultAggregator** → Result collection, statistics, and reporting
- **AuthenticationService** → Claude CLI authentication validation
- **StatisticsService** → Metrics aggregation and reporting
- **DegradedModeHandler** → Fallback test generation when Claude CLI unavailable
- **AIEnhancedTestingWorkflow** → Coordinates the complete testing workflow

**Template Architecture**: The template system uses a facade pattern where `TestTemplateEngine` (196 lines) provides backward compatibility while delegating to `TemplateOrchestrator` for actual functionality. Templates are organized by language:
```
src/generators/templates/
├── TestTemplateEngine.ts (facade, 196 lines)
├── TemplateOrchestrator.ts (core logic, 277 lines)
├── javascript/ (Jest-based templates)
└── python/ (pytest-based templates)
```

### 3. Factory Pattern
Used extensively for creating language-specific implementations:

- **TestRunnerFactory** → Creates Jest or pytest runners
- **JavaScriptTemplateFactory** / **PythonTemplateFactory** → Language-specific template creation
- **ConfigurationServiceFactory** → Builds configuration with proper dependencies
- **ServiceFactory** → Creates and configures all ClaudeOrchestrator services with proper dependencies
- **TemplateOrchestrator** → Uses factory pattern internally to register and create templates

**ClaudeOrchestrator Service Architecture**: Uses dependency injection through ServiceFactory to create:
```
ServiceFactory.createServices() returns:
├── ProcessExecutor (Claude CLI process management)
├── TaskExecutionService (retry logic, checkpoint management)  
├── ProcessPoolManager (process lifecycle)
├── TaskQueueManager (task scheduling)
├── ResultAggregator (result collection)
├── AuthenticationService (auth validation)
├── StatisticsService (metrics aggregation)
└── DegradedModeHandler (fallback generation)
```

**ProjectAnalyzer Service Architecture**: Decomposed from monolithic analyzer into specialized services:
```
ProjectAnalysisOrchestrator coordinates:
├── LanguageDetectionService (JS/TS/Python detection)
├── FrameworkDetectionService (React/Vue/Angular/Express/FastAPI/Django/Flask)
├── DependencyAnalysisService (package.json/requirements.txt parsing)
└── ComplexityAnalysisService (file count, lines of code metrics)
```

### 4. Template Method Pattern
Separates content generation from presentation:

- Report generators use template methods for consistent formatting
- Test templates define structure while content varies by language

## Component Architecture

### Core Services Layer

#### ProjectAnalyzer
- **Purpose**: Detects languages, frameworks, and project structure
- **Key Features**:
  - Smart pattern recognition for 12+ frameworks
  - Confidence scoring for detection accuracy
  - Micro-frontend and full-stack project support
- **Location**: `src/analyzers/ProjectAnalyzer.ts`

#### ConfigurationService
- **Purpose**: Centralized configuration management
- **Architecture**: Factory pattern with modular loaders
  - DefaultConfigLoader
  - UserConfigLoader
  - ProjectConfigLoader
  - CustomFileLoader
  - RegistryConfigLoader
- **Location**: `src/config/ConfigurationService.ts`

#### FileDiscoveryService
- **Purpose**: Efficient file discovery with caching
- **Features**:
  - Smart pattern generation
  - Cache key generation for performance
  - Enhanced pattern validation
- **Location**: `src/services/FileDiscoveryService.ts`

### AI Integration Layer

#### ClaudeOrchestrator
- **Purpose**: Manages Claude AI subprocess for logical test generation
- **Architecture**: Modernized with extracted services (50% complete):
  - Main coordination and authentication
  - Result aggregation and error handling
  - Delegates process management to ProcessPoolManager
  - Delegates task scheduling to TaskQueueManager
- **Location**: `src/ai/ClaudeOrchestrator.ts` (reduced from 1720 to ~1168 lines)

#### ProcessPoolManager  
- **Purpose**: Dedicated process lifecycle management service
- **Architecture**:
  - Process registration and monitoring
  - Heartbeat integration with event forwarding
  - Resource usage tracking and cleanup
  - Capacity management and zombie detection
- **Location**: `src/ai/services/ProcessPoolManager.ts` (350 lines)
- **Events**: `process-started`, `process-completed`, `process-failed`, `process-timeout`

#### TaskQueueManager
- **Purpose**: Dedicated task scheduling and concurrency control service
- **Architecture**:
  - Task queue operations and batch processing
  - Concurrency control with promise tracking
  - Intelligent retry logic with complexity assessment
  - Task lifecycle events and progress tracking
- **Location**: `src/ai/services/TaskQueueManager.ts` (281 lines)
- **Events**: `batch:start`, `batch:complete`, `task:start`, `task:complete`, `task:failed`

#### HeartbeatMonitor System
- **Components**:
  - ProcessHealthAnalyzer
  - HeartbeatScheduler
  - HeartbeatMonitor
- **Purpose**: Ensures AI subprocess health and handles failures gracefully
- **Location**: `src/ai/heartbeat/`

### Test Generation Layer

#### TestGenerator
- **Purpose**: Orchestrates structural and AI-powered test generation
- **Flow**:
  1. Structural test generation (immediate)
  2. AI task queuing for logical tests
  3. Result aggregation and validation
- **Location**: `src/generators/TestGenerator.ts`

#### Template System
- **Architecture**: Modular template system with:
  - TemplateRegistry → Central template management
  - TemplateEngine → Robust execution with error handling
  - Language-specific factories → Dynamic template creation
- **Location**: `src/generators/templates/core/`

### Workflow Layer

#### AIEnhancedTestingWorkflow
- **Purpose**: Complete end-to-end testing workflow
- **Phases**:
  1. Initialization
  2. Analysis
  3. Generation
  4. AI Enhancement
  5. Finalization
- **Features**: Typed event system, state management, phase validation
- **Location**: `src/workflows/AIEnhancedTestingWorkflow.ts`

#### IncrementalGenerator
- **Purpose**: Smart test updates based on Git changes
- **Features**:
  - Git diff analysis
  - Dependency tracking
  - Cost-efficient AI usage
  - Baseline management
- **Location**: `src/generators/IncrementalGenerator.ts`

### Infrastructure Layer

#### Timer System
- **Purpose**: Testable timer abstractions
- **Components**:
  - TimerFactory → Dependency injection
  - RealTimer → Production implementation
  - MockTimer → Test implementation
- **Benefits**: Deterministic testing, Jest compatibility
- **Location**: `src/utils/TimerFactory.ts`

#### Error Handling System
- **Architecture**: Type-safe error handling with:
  - 7 domain-specific error classes
  - ErrorResult<T,E> pattern
  - Comprehensive error guards
  - Error categorization and retry detection
- **Location**: `src/types/error-types.ts`

## Data Flow

### Test Generation Flow
```
1. User Command → CLI Entry Point
2. Configuration Loading → ConfigurationService
3. Project Analysis → ProjectAnalyzer
4. File Discovery → FileDiscoveryService
5. Test Generation → TestGenerator
   ├── Structural Tests → Template System
   └── Logical Tests → ClaudeOrchestrator
6. Test Execution → TestRunner
7. Results → User Output
```

### Incremental Update Flow
```
1. Git Change Detection → IncrementalGenerator
2. Affected File Analysis → Dependency Tracker
3. Selective Test Updates → TestGenerator
4. Cost Optimization → AI Task Batching
5. Baseline Update → State Management
```

## External Integrations

### Claude AI Integration
- **Method**: Subprocess communication via Claude CLI
- **Protocol**: JSON-based message passing
- **Features**:
  - Batch processing for efficiency
  - Timeout handling
  - Retry logic with exponential backoff
  - Cost tracking and limits

### Version Control Integration
- **Library**: simple-git
- **Features**:
  - Diff analysis for incremental updates
  - Baseline branch management
  - Change detection and tracking

### Test Framework Integration
- **JavaScript/TypeScript**: Jest via subprocess
- **Python**: pytest via subprocess
- **Features**:
  - Coverage report generation
  - Multiple output formats
  - Timeout handling

## Security Considerations

### Process Isolation
- AI subprocess runs with limited permissions
- No direct file system access from AI
- Structured communication only

### Configuration Security
- Environment variables for sensitive data
- No credentials in configuration files
- Validation of all user inputs

### File System Safety
- All operations within `.claude-testing/` directory
- No modification of target project files
- Temporary files properly cleaned up

## Performance Architecture

### Caching Strategy
- File discovery results cached with TTL
- Configuration cached per session
- Template compilation cached

### Parallel Processing
- AI tasks processed in batches
- Multiple test files generated concurrently
- Process pool for AI subprocess management

### Memory Management
- Streaming for large file operations
- Chunking for AI context limits
- Proper cleanup of temporary resources

## Scalability Considerations

### Horizontal Scaling
- Stateless design allows multiple instances
- File-based state for persistence
- No shared memory requirements

### Large Project Support
- Efficient file discovery patterns
- Incremental generation for massive codebases
- Chunking for files exceeding token limits

## Quality Assurance Architecture

### Truth Validation System
- Prevents false claims in documentation
- Automated validation of all assertions
- Pre-commit hooks for accuracy
- Continuous monitoring of claims

### Test Infrastructure
- 99.8% test coverage of core functionality
- Performance benchmarking system
- E2E tests for real-world scenarios
- Automated regression detection

## Future Architecture Considerations

### Planned Improvements
1. Plugin system for custom languages
2. Distributed AI processing
3. Cloud-based test execution
4. Real-time collaboration features

### Architecture Principles
- Maintain zero-modification guarantee
- Preserve language adapter extensibility
- Keep AI integration pluggable
- Ensure backward compatibility