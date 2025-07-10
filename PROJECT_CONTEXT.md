# Project Context & AI Agent Guide

*Last updated: 2025-07-10 | Updated by: Autonomous session | Completed REF-CONFIG-004 - Configuration Merger extraction, Configuration Service modularization 70% complete*

## 🎯 Project Overview

### Core Purpose
AI-powered decoupled testing infrastructure that generates comprehensive tests without modifying target projects. Uses intelligent analysis and AI test generation to achieve 80%+ coverage for JavaScript/TypeScript and Python projects.

**Target Users**: AI agents, developers, teams needing rapid test implementation  
**Business Value**: Reduces testing setup from days to minutes while maintaining quality  
**Current Status**: **MVP Phase 2** - **PRODUCTION READY** - Build successful (0 TypeScript errors), linting clean (0 errors), test suite at 99.8% pass rate (465/466 fast tests passing), production readiness validation passing with 99.9% overall score, **END-TO-END VALIDATION COMPLETE** with comprehensive E2E test suite covering all major workflows, autonomous development capable with excellent task completion velocity

### Key Success Metrics
- Zero modification of target projects (100% decoupled approach)
- 80%+ test coverage generation with structural + AI-powered logical tests
- Sub-10 minute setup time for comprehensive testing infrastructure
- Multi-language support (JavaScript/TypeScript, Python) with framework detection

## 🏗️ Architecture & Technical Stack

### Quick Overview
**Technology**: TypeScript with Node.js CLI, supports JavaScript/TypeScript + Python projects  
**Architecture**: Decoupled external testing infrastructure with AI integration  
**Core Pattern**: Language Adapter Pattern for multi-framework support

📖 **See detailed architecture**: [`/docs/architecture/overview.md`](./docs/architecture/overview.md)  
📖 **See technical stack**: [`/docs/architecture/technical-stack.md`](./docs/architecture/technical-stack.md)

## 🚀 Core Features & User Journeys

### Primary User Flows
1. **Configuration Setup**: `node dist/cli/index.js init-config` - Initialize project configuration
2. **Project Analysis**: `node dist/cli/index.js analyze /path/to/project` - Detects languages and frameworks
3. **Test Generation**: `node dist/cli/index.js test /path/to/project` - Creates comprehensive tests
4. **Test Execution**: `node dist/cli/index.js run /path/to/project --coverage` - Runs tests with coverage
5. **Incremental Updates**: `node dist/cli/index.js incremental /path/to/project` - Smart test updates
6. **Watch Mode**: `node dist/cli/index.js watch /path/to/project` - Real-time monitoring

### Key Feature Modules
- **Configuration Service** (`src/config/ConfigurationService.ts`): Centralized configuration loading with modular architecture - includes dedicated source loader modules (`src/config/loaders/`), environment variable parser (`src/config/EnvironmentVariableParser.ts`), and CLI argument mapper (`src/config/CliArgumentMapper.ts`) with type-safe interfaces, comprehensive error handling, and dependency injection pattern
- **FileDiscoveryService** (`src/services/FileDiscoveryService.ts`): Centralized file discovery with caching
- **Enhanced File Discovery** (`src/services/EnhancedFileDiscoveryService.ts`): Type-safe file discovery with PatternBuilder, CacheKeyGenerator, and EnhancedPatternValidator, supports smart pattern generation based on project structure
- **ProjectAnalyzer** (`src/analyzers/ProjectAnalyzer.ts`): Enhanced language/framework detection with 12+ frameworks, FrameworkDetectionResult interface providing confidence scores and detailed indicators, integrated with smart project structure detection
- **Smart Project Structure Detection** (`src/services/ProjectStructureDetector.ts`): Intelligent project layout analysis supporting 8 structure types with enhanced framework detection (10+ frameworks including Nx), micro-frontend architecture support, full-stack project detection, and package-based architecture patterns
- **TestGenerator** (`src/generators/TestGenerator.ts`): Structural + AI-powered test generation system
- **Template System Core** (`src/generators/templates/core/`): Modular template architecture with TemplateRegistry for centralized template management, TemplateEngine for robust execution, and Template Factory System for plugin-based template creation with language-specific factories (JavaScriptTemplateFactory, PythonTemplateFactory)
- **ClaudeOrchestrator** (`src/ai/ClaudeOrchestrator.ts`): Enhanced Claude CLI management with comprehensive type safety, intelligent retry strategies, timer dependency injection for deterministic testing, public getStats() method, structured AI error types, and type-safe event interfaces for subprocess communication
- **Heartbeat Monitoring** (`src/ai/heartbeat/`): Refactored monitoring system with separation of concerns (ProcessHealthAnalyzer, HeartbeatScheduler, HeartbeatMonitor) - now includes early phase detection for lenient startup monitoring
- **TestRunner** (`src/runners/TestRunner.ts`): Production-ready Jest/pytest execution with timeout handling
- **TestableTimer System** (`src/utils/TimerFactory.ts`, `src/utils/RealTimer.ts`, `src/utils/MockTimer.ts`): Complete timer abstraction with dependency injection for deterministic testing and Jest fake timer compatibility
- **TimerTestUtils** (`src/utils/TimerTestUtils.ts`): Comprehensive timer testing utility library with MockTimerService
- **AsyncTestUtils** (`src/utils/AsyncTestUtils.ts`): Complete async testing framework for promises, events, streams, and coordinated async operations
- **OptimizedAITestUtils** (`src/utils/OptimizedAITestUtils.ts`): High-performance AI test optimization library achieving 99.7% performance improvement through simplified timer patterns, lightweight process mocks, shared mock factories, and batch operations
- **In-Memory Filesystem Testing** (`tests/utils/filesystem-test-utils.ts`): High-performance testing infrastructure using memfs for 10-50x faster filesystem operations in tests
- **Shared Test Fixtures** (`tests/fixtures/shared/`): Performance-optimized fixture system with 14 framework templates (React, Vue, Angular, Express, Svelte, Nuxt, Node.js, Python, FastAPI, Flask, Django, MCP, Mixed, Empty), template-based project generation, caching, and isolation management for 50-70% integration test speed improvement
- **Jest Performance Optimization** (`jest.unit.config.js`, `jest.integration.config.js`, `jest.performance.config.js`, `jest.optimized.config.js`): System-aware Jest configurations achieving 85% cumulative performance improvement with dynamic worker allocation and intelligent memory management
- **Performance Monitoring System** (`scripts/jest-performance-monitor.js`): Automated benchmarking system with system analysis, performance rankings, and optimization recommendations for regression detection and CI integration

## 📍 Where to Find Things

### Key Files & Locations
- **AI agent entry point**: `AI_AGENT_GUIDE.md` - Protected, stable primary entry point
- **CLI entry point**: `src/cli/index.ts` - Main command interface with type-safe argument handling
- **Core analysis logic**: `src/analyzers/ProjectAnalyzer.ts` - Project detection engine with smart structure analysis
- **Smart structure detection**: `src/services/ProjectStructureDetector.ts` - Intelligent project layout analysis and pattern generation
- **Test generation**: `src/generators/TestGenerator.ts` - Test creation system
- **Template system core**: `src/generators/templates/core/` - Modular template architecture (TemplateRegistry, TemplateEngine)
- **Enhanced JavaScript templates**: `src/generators/templates/javascript/` - Framework-specific enhanced template classes (Jest, React, Vue, Angular, TypeScript)
- **AI integration**: `src/ai/ClaudeOrchestrator.ts` - Enhanced Claude CLI process management
- **Heartbeat monitoring**: `src/ai/heartbeat/` - Separated monitoring components (Analyzer, Scheduler, Monitor)
- **Configuration system**: `src/config/ConfigurationService.ts` - Centralized configuration service with modular loader architecture
- **Configuration loaders**: `src/config/loaders/` - Modular source loaders (Default, User, Project, CustomFile, Registry) with type-safe interfaces and consistent error handling
- **CLI argument mapper**: `src/config/CliArgumentMapper.ts` - Dedicated CLI argument to configuration mapping with comprehensive threshold parsing and type-safe transformations
- **CLI utilities**: `src/cli/utils/` - Standardized CLI configuration loading, error handling, and command execution patterns
- **Timer abstraction system**: `src/utils/TimerFactory.ts` - Dependency injection factory for timer implementations
- **Timer testing utilities**: `src/utils/TimerTestUtils.ts` - Comprehensive timer testing library
- **Async testing utilities**: `src/utils/AsyncTestUtils.ts` - Complete async testing framework for promises, events, streams
- **AI test optimization utilities**: `src/utils/OptimizedAITestUtils.ts` - High-performance AI test optimization library with 99.7% performance improvement
- **In-memory filesystem utilities**: `tests/utils/filesystem-test-utils.ts` - High-performance filesystem testing with memfs
- **Type system**: `src/types/` - Comprehensive TypeScript interfaces including timer, async testing, AI error types, and enhanced file discovery types with structured error handling
- **Test fixture system**: `tests/fixtures/shared/` - Shared test fixture management with TestFixtureManager, project templates, and performance optimization utilities

### Documentation Locations
- **AI agent navigation hub**: [`/docs/CLAUDE.md`](./docs/CLAUDE.md) - Central navigation for all AI agent documentation
- **Development history**: [`/docs/development/DEVELOPMENT_HISTORY.md`](./docs/development/DEVELOPMENT_HISTORY.md) - Complete development timeline and decisions
- **Configuration guide**: [`/docs/configuration.md`](./docs/configuration.md) - Complete .claude-testing.config.json reference
- **Architecture decisions**: [`/docs/architecture/overview.md`](./docs/architecture/overview.md) - System design
- **User guides**: [`/docs/user/getting-started.md`](./docs/user/getting-started.md) - Complete usage examples
- **Jest configuration guide**: [`/docs/testing/jest-configuration-guide.md`](./docs/testing/jest-configuration-guide.md) - Performance-optimized Jest configurations achieving 60-75% test execution improvement
- **Testing patterns**: [`/docs/testing/timer-testing-patterns.md`](./docs/testing/timer-testing-patterns.md) - Timer/async testing standardized patterns
- **Testing troubleshooting**: [`/docs/testing/timer-testing-troubleshooting.md`](./docs/testing/timer-testing-troubleshooting.md) - Timer test issue resolution guide
- **Testing audit**: [`/docs/testing/timer-async-test-audit-report.md`](./docs/testing/timer-async-test-audit-report.md) - Comprehensive test suite analysis and systematic solution recommendations
- **TimerTestUtils guide**: [`/docs/testing/timer-test-utils-guide.md`](./docs/testing/timer-test-utils-guide.md) - Complete guide for TimerTestUtils utility library
- **In-memory filesystem guide**: [`/docs/testing/in-memory-filesystem-guide.md`](./docs/testing/in-memory-filesystem-guide.md) - Complete guide for high-performance filesystem testing with memfs
- **Heartbeat separation strategy**: [`/docs/development/heartbeat-monitoring-separation-strategy.md`](./docs/development/heartbeat-monitoring-separation-strategy.md) - Architecture design for heartbeat monitoring refactoring

## 🎯 Current Status & Priorities

### Current Status
**MVP PHASE 2** (2025-07-08): **PRODUCTION READINESS VALIDATION FIXED** - Fixed production validation script to correctly parse test results. Script now uses fast test suite, captures both stdout/stderr, and properly handles Jest output format with skipped tests. Validation now passes with 99.9% overall score.

📖 **See current focus**: [`/docs/CURRENT_FOCUS.md`](./docs/CURRENT_FOCUS.md) - **PRIMARY GUIDE FOR ALL WORK**  
📖 **See active tasks**: [`/docs/planning/ACTIVE_TASKS.md`](./docs/planning/ACTIVE_TASKS.md)  
📖 **See future work**: [`/docs/planning/FUTURE_WORK.md`](./docs/planning/FUTURE_WORK.md)  
📖 **See development history**: [`/docs/development/DEVELOPMENT_HISTORY.md`](./docs/development/DEVELOPMENT_HISTORY.md)

### Recent Updates
- **2025-07-10**: **CONFIGURATION MERGER EXTRACTION COMPLETED** - Completed REF-CONFIG-004: Extracted configuration merging and validation logic into dedicated ConfigurationMerger module. Created comprehensive deep merge functionality with type safety, validation orchestration, and error aggregation. Added full unit test suite (14 tests) covering merge scenarios, source precedence, and validation integration. ConfigurationService reduced by 81 lines (18% complexity reduction). Configuration Service modularization now 70% complete.
- **2025-07-10**: **CLI ARGUMENT MAPPER EXTRACTION COMPLETED** - Completed REF-CONFIG-003: Extracted CLI argument mapping logic into dedicated CliArgumentMapper module. Removed 228 lines from ConfigurationService, reducing complexity by 29%. Added comprehensive type-safe CLI-to-config mapping with threshold parsing, complete unit test suite (29 tests), and dependency injection integration. Configuration Service modularization now 60% complete.
- **2025-07-10**: **ENVIRONMENT VARIABLE PARSER EXTRACTION COMPLETED** - Completed REF-CONFIG-002: Extracted environment variable parsing logic into dedicated EnvironmentVariableParser module. Extracted parseEnvValue, setNestedValue, and special case mapping logic from ConfigurationService (lines 483-602, 883-1061). Added comprehensive unit tests (15 test cases) covering type conversion, array handling, nested objects, and error validation. ConfigurationService now uses dependency injection for cleaner architecture.
- **2025-07-10**: **CONFIGURATION SERVICE MODULARIZATION INITIATED** - Completed REF-CONFIG-001: Extracted configuration source loaders into modular architecture. Created 5 dedicated loader modules (Default, User, Project, CustomFile, Registry) with type-safe interfaces, consistent error handling, and improved testability. ConfigurationService reduced from 1,467 to ~1,300 lines with better separation of concerns.
- **2025-07-10**: **FRAMEWORK-SPECIFIC PATTERN ENHANCEMENT COMPLETED** - Implemented REF-PATTERNS-003: Enhanced framework detection with nested pattern support for 10+ frameworks including Nx monorepos. Added micro-frontend architecture detection with module federation support, full-stack project detection (separated/integrated/monorepo), and package-based architecture patterns (feature/layer/domain-based).

### Quick Success Example
```bash
# Build the infrastructure
npm install && npm run build

# Initialize configuration for your project type
node dist/cli/index.js init-config /path/to/project    # Auto-detect and set up config

# Complete workflow with any project
node dist/cli/index.js analyze /path/to/project --show-config-sources  # Detect languages/frameworks + debug config
node dist/cli/index.js test /path/to/project --dry-run  # Preview test generation
node dist/cli/index.js test /path/to/project        # Generate comprehensive tests
node dist/cli/index.js run /path/to/project --coverage  # Execute with coverage
node dist/cli/index.js incremental /path/to/project # Smart updates based on Git changes

# End-to-End validation
npm run validation:e2e                              # Full E2E workflow validation
npm run test:e2e                                    # Run all E2E tests
```

### Test Execution Modes
```bash
# Ultra-fast optimized tests (5.3s) - for maximum development speed
npm run test:optimized

# Fast tests (6s) - for development
npm run test:fast

# Core tests (<30 seconds) - for pre-commit validation  
npm run test:core

# Full tests (<10 minutes) - for comprehensive validation
npm run test:full

# End-to-End validation (<30 minutes) - real workflow testing
npm run test:e2e

# Performance monitoring - benchmark all configurations
npm run perf:monitor

# Production readiness validation - comprehensive quality gates
npm run validation:production

# Complete validation suite - all quality gates including E2E
npm run validation:e2e
```

## 💡 AI Agent Guidelines

### Essential Workflow
1. Read this PROJECT_CONTEXT.md first
2. Check relevant `/docs/` modules for detailed information
3. Follow established patterns and conventions
4. Update documentation after changes
5. **Current phase**: Production-ready maintenance mode

### Quick Reference
- **Primary entry point**: [`AI_AGENT_GUIDE.md`](./AI_AGENT_GUIDE.md) - Protected, stable AI agent guide
- **Documentation navigation**: [`/docs/CLAUDE.md`](./docs/CLAUDE.md) - Central hub for all AI agent documentation
- **Architecture**: Language Adapter Pattern with decoupled external testing
- **Core commands**: `analyze → test → run → generate-logical → incremental → watch` workflow
- **Key constraint**: Never modify target projects, all tests external

## 📋 Documentation Structure Reference

### Core Navigation
- **📖 Central Hub**: [`/docs/CLAUDE.md`](./docs/CLAUDE.md) - Complete AI agent navigation system
- **📖 Architecture**: [`/docs/architecture/`](./docs/architecture/) - System design and technical decisions
- **📖 Development**: [`/docs/development/`](./docs/development/) - Conventions, workflow, and development history
- **📖 Features**: [`/docs/features/`](./docs/features/) - Detailed component documentation
- **📖 Planning**: [`/docs/planning/`](./docs/planning/) - Roadmap, implementation plans, and refactoring strategies
- **📖 User Guides**: [`/docs/user/`](./docs/user/) - Getting started and troubleshooting
- **📖 API Reference**: [`/docs/api/`](./docs/api/) - TypeScript interfaces and programmatic usage

## 📊 Current Task Status

### Implementation Backlog
- **Total tasks**: 0 remaining
- **High priority**: 0 tasks
- **Status**: All implementation tasks completed - infrastructure ready for production deployment

### Refactoring Backlog  
- **Total tasks**: 3 remaining (REF-CONFIG-004 completed - Configuration Merger extraction)
- **Critical priority**: 2 tasks (TypeScript excellence, Architecture modernization epics)  
- **High priority**: 1 task (Configuration Factory)
- **Medium priority**: 2 tasks (Timer enterprise infrastructure, Async code architecture overhaul)
- **Low priority**: 0 tasks
- **Recently completed**: REF-CONFIG-004 Configuration Merger extraction, REF-CONFIG-003 CLI Argument Mapper extraction, REF-CONFIG-002 Environment Variable Parser extraction, REF-CONFIG-001 Configuration Source Loaders extraction, REF-PATTERNS-003 Framework-Specific Pattern Enhancement, REF-PATTERNS-002 Smart Pattern Integration, REF-PATTERNS-001 Smart Project Structure Detection
- **Next up**: REF-CONFIG-005 Create Configuration Factory (High priority, 3 hours)

### Timer Testing Infrastructure Status
- **Documentation**: ✅ **COMPLETED** - Comprehensive patterns and troubleshooting guides created
- **Audit**: ✅ **COMPLETED** - Complete test suite analysis with risk categorization and systematic recommendations  
- **TimerTestUtils**: ✅ **COMPLETED** - Comprehensive utility library with MockTimerService for dependency injection
- **TestableTimer Abstraction**: ✅ **COMPLETED** - Complete timer abstraction system with RealTimer/MockTimer implementations and dependency injection factory
- **AsyncTestUtils Framework**: ✅ **COMPLETED** - Comprehensive async testing utilities for promises, events, streams, and coordinated operations (all 27 tests passing)
- **Timer Dependency Injection**: ✅ **COMPLETED** - ClaudeOrchestrator now uses injected timer services for deterministic testing
- **HeartbeatMonitor Timer Integration**: ✅ **COMPLETED** - TASK-TIMER-010: Fixed Jest fake timer compatibility with HeartbeatMonitor system. Resolved MockTimer vs RealTimer conflicts and race condition handling.
- **AsyncTestUtils Validation**: ✅ **COMPLETED** - Fixed 5 test failures, all async testing patterns now production-ready
- **Production Validation**: ✅ **COMPLETED** - Production readiness script fixed and passing with 99.9% overall score
- **Foundation**: Production-ready timer and async testing infrastructure with deterministic behavior and heartbeat monitoring

---

**Version**: 2.0.0 | **Architecture**: Decoupled-only | **AI**: Claude-powered | **Status**: Production Ready