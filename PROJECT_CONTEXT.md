# Project Context & AI Agent Guide

*Last updated: 2025-07-04 | Updated by: /document command | Added configuration templates and init-config command*

## 🎯 Project Overview

### Core Purpose
AI-powered decoupled testing infrastructure that generates comprehensive tests without modifying target projects. Uses intelligent analysis and AI test generation to achieve 80%+ coverage for JavaScript/TypeScript and Python projects.

**Target Users**: AI agents, developers, teams needing rapid test implementation  
**Business Value**: Reduces testing setup from days to minutes while maintaining quality  
**Current Status**: Production-ready v2.0 with **Test Quality Measurement System Fixed** - Resolved duplicate test content generation issue in ClaudeOrchestrator.saveGeneratedTests method, ensuring clean test file output without content duplication

### Key Success Metrics
- Zero modification of target projects (100% decoupled approach)
- 80%+ test coverage generation with structural + AI-powered logical tests
- Sub-10 minute setup time for comprehensive testing infrastructure
- Multi-language support (JavaScript/TypeScript, Python) with framework detection and validated mixed project testing

## 🏗️ Architecture & Technical Stack

### Quick Overview
**Technology**: TypeScript with Node.js CLI, supports JavaScript/TypeScript + Python projects  
**Architecture**: Decoupled external testing infrastructure with AI integration  
**Core Pattern**: Language Adapter Pattern for multi-framework support

📖 **See detailed architecture**: [`/docs/architecture/overview.md`](./docs/architecture/overview.md)  
📖 **See technical stack**: [`/docs/architecture/technical-stack.md`](./docs/architecture/technical-stack.md)

## 🚀 Core Features & User Journeys

### Primary User Flows
1. **Configuration Setup**: `node dist/cli/index.js init-config` - Initialize project configuration with pre-built templates for common frameworks
2. **Project Analysis**: `node dist/cli/index.js analyze /path/to/project` - Detects languages, frameworks, and generates recommendations
3. **Test Generation Preview**: `node dist/cli/index.js test /path/to/project --dry-run` - Preview test generation without creating files
4. **Test Generation**: `node dist/cli/index.js test /path/to/project` - Creates comprehensive structural tests with AI-powered logical tests
5. **Test Execution**: `node dist/cli/index.js run /path/to/project --coverage` - Runs tests with coverage reporting and gap analysis
6. **Incremental Updates**: `node dist/cli/index.js incremental /path/to/project` - Smart test updates based on Git changes
7. **Batched AI Generation**: `node dist/cli/index.js generate-logical-batch /path/to/project` - Configurable batch processing for large projects
8. **Watch Mode**: `node dist/cli/index.js watch /path/to/project` - Real-time file monitoring with automatic incremental test generation
9. **Process Monitoring**: `node dist/cli/index.js monitor` - Monitor system processes for resource usage and testing-related activity
10. **Production Validation**: `npm run validation:production` - Comprehensive production readiness assessment with quality gates
11. **Validation Reporting**: `npm run validation:report` - Generate detailed validation reports with quality metrics and recommendations
12. **Deployment Checklist**: `npm run validation:deployment` - Automated pre/during/post deployment validation checklist

### Key Feature Modules
- **FileDiscoveryService** (`src/services/FileDiscoveryService.ts`): ✅ INTEGRATED - Centralized file discovery with caching (70%+ hit rate), pattern management, and language-specific filtering for consistent file operations across all components
- **FileDiscoveryServiceFactory** (`src/services/FileDiscoveryServiceFactory.ts`): ✅ INTEGRATED - Singleton factory pattern ensuring consistent service instances across all 9 CLI commands with reset functionality for testing
- **PatternManager** (`src/services/PatternManager.ts`): ✅ INTEGRATED - Advanced pattern resolution with language-specific patterns, user configuration merging, and glob validation for optimal file discovery
- **ProjectAnalyzer** (`src/analyzers/ProjectAnalyzer.ts`): Language/framework detection with 10+ framework support including MCP servers, fully integrated with FileDiscoveryService for consistent file scanning with caching and fallback support
- **TestGenerator** (`src/generators/TestGenerator.ts`): Structural + AI-powered test generation system with fixed path resolution, correct directory structure, and dependency-free templates
- **BaseTestGenerator** (`src/generators/base/BaseTestGenerator.ts`): Abstract base class for language-specific test generators with comprehensive language context support
- **TestGeneratorFactory** (`src/generators/TestGeneratorFactory.ts`): Factory pattern for creating appropriate test generators based on language detection and feature flags
- **JavaScriptTestGenerator** (`src/generators/javascript/JavaScriptTestGenerator.ts`): ✅ PRODUCTION READY - JavaScript/TypeScript specific test generator with module-aware import generation, framework detection, async pattern analysis, and comprehensive test generation
- **ModuleSystemAnalyzer** (`src/generators/javascript/analyzers/ModuleSystemAnalyzer.ts`): ✅ STABILIZED - Comprehensive module system detection for CommonJS/ESM at project and file levels with improved logic for export-only files and corrected test mock sequencing
- **JSFrameworkDetector** (`src/generators/javascript/analyzers/JSFrameworkDetector.ts`): Enhanced framework detection for UI, backend, meta-frameworks, testing frameworks, and build tools
- **AsyncPatternDetector** (`src/generators/javascript/analyzers/AsyncPatternDetector.ts`): ✅ FIXED - Enhanced AST-based async pattern detection with Promise constructor support, proper confidence levels for regex fallback patterns, and comprehensive test coverage
- **TestTemplateEngine** (`src/generators/templates/TestTemplateEngine.ts`): ✅ FIXED - Enhanced template system with corrected TypeScript extension removal, proper ES module import path generation, and consistent relative path calculation across all templates
- **JavaScriptEnhancedTemplates** (`src/generators/templates/JavaScriptEnhancedTemplates.ts`): ✅ FIXED - Enhanced framework-specific templates with async pattern awareness, module system intelligence, fixed TypeScript import extension handling (.ts/.tsx removal), and comprehensive test generation for React, Vue, Angular, and TypeScript
- **MCP Test Templates** (`src/generators/templates/MCP*.ts`): Specialized templates for MCP server testing - protocol compliance, tool integration, message handling, transport validation, and chaos testing
- **ProgressReporter** (`src/utils/ProgressReporter.ts`): Real-time progress tracking with ETA calculations and file-by-file updates
- **TestRunner** (`src/runners/TestRunner.ts`): Production-ready Jest/pytest execution with timeout handling, fully integrated with FileDiscoveryService for efficient test file discovery with language-specific filtering
- **TestRunnerFactory** (`src/runners/TestRunnerFactory.ts`): Creates test runners with automatic FileDiscoveryService provisioning via singleton factory pattern
- **CoverageReporter** (`src/runners/CoverageReporter.ts`): Advanced multi-format coverage analysis and gap visualization with consolidated template engines
- **Incremental System** (`src/state/`): Git-based change detection with smart test updates and cost optimization
- **FileChunker** (`src/utils/file-chunking.ts`): Intelligent file chunking for large files exceeding AI token limits
- **ClaudeOrchestrator** (`src/ai/ClaudeOrchestrator.ts`): Enhanced Claude CLI management with intelligent retry strategies featuring adaptive timeout adjustment, context-aware retry decisions, and failure pattern learning. Includes exponential backoff retry logic, graceful degradation when CLI unavailable, circuit breaker pattern, improved timeout handling, advanced heartbeat monitoring with progress marker detection and stdin wait detection, preemptive timeout warnings at 50%, 75%, and 90% thresholds, real-time stderr parsing for early error detection, comprehensive subprocess resource monitoring, integrated task checkpointing for timeout recovery, and **fixed duplicate test content generation** in saveGeneratedTests method with proper content replacement logic
- **TaskCheckpointManager** (`src/state/TaskCheckpointManager.ts`): ✅ NEW - Comprehensive checkpointing system for AI tasks with partial progress saving, automatic resume capability, context validation, and checkpoint lifecycle management to prevent complete task loss on timeout
- **StderrParser** (`src/utils/stderr-parser.ts`): ✅ NEW - Real-time Claude CLI error detection with pattern-based parsing for authentication, network, rate limit, model, and API errors, enabling early process termination and resource conservation
- **BatchedLogicalTestGenerator** (`src/ai/BatchedLogicalTestGenerator.ts`): Configurable batch processing for large-scale AI test generation
- **ConfigurationService** (`src/config/ConfigurationService.ts`): Centralized configuration loading with source precedence, individual source validation, comprehensive error/warning reporting per configuration source
- **ConfigInitializer** (`src/cli/commands/init-config.ts`): ✅ NEW - Configuration template system with 6 pre-built templates for common frameworks (React, Vue, Next.js, Express, Node.js, Django), auto-detection of project types, and interactive setup
- **ProcessMonitor** (`src/utils/ProcessMonitor.ts`): ✅ TESTS FIXED - Comprehensive cross-platform process monitoring with CPU/memory tracking, zombie process detection, health metrics analysis, and historical resource usage data. Fixed test mocking for execSync to properly handle string outputs

## 🔌 Integrations & External Dependencies

### APIs & Services  
- **Claude Code CLI Integration**: ✅ Enhanced with intelligent retry strategies including adaptive timeout adjustment based on task complexity, context-aware retry decisions, failure pattern learning system, exponential backoff retry logic, graceful degradation for unavailable CLI, circuit breaker for cascading failure prevention, and robust timeout handling
- **Git Integration**: ✅ Complete change detection for incremental testing
- **CI/CD Integration**: GitHub Actions, GitLab CI templates with JUnit XML reports

### Third-Party Libraries
- **@babel/parser**: JavaScript/TypeScript AST parsing for test generation and async pattern detection
- **@babel/traverse**: AST traversal for comprehensive code analysis
- **commander**: CLI framework for the `claude-testing` command interface
- **fast-glob**: High-performance file pattern matching for project analysis
- **winston**: Structured logging with configurable output levels
- **chokidar**: Cross-platform file system watching for watch mode functionality

## 📍 Where to Find Things

### Key Files & Locations
- **AI agent entry point**: `AI_AGENT_GUIDE.md` - Protected, stable primary entry point
- **CLI entry point**: `src/cli/index.ts` - Main command interface with polished error handling and dry-run support
- **Service factory**: `src/services/FileDiscoveryServiceFactory.ts` - Singleton factory for consistent FileDiscoveryService instances
- **File discovery service**: `src/services/FileDiscoveryService.ts` - Centralized file discovery with caching and pattern management
- **Pattern management**: `src/services/PatternManager.ts` - Language-specific pattern resolution and user configuration merging
- **File discovery cache**: `src/services/FileDiscoveryCache.ts` - Memory cache with TTL, statistics, and pattern-based invalidation
- **File discovery types**: `src/types/file-discovery-types.ts` - Complete type definitions for file discovery operations
- **Core analysis logic**: `src/analyzers/ProjectAnalyzer.ts` - Project detection engine
- **Test generation**: `src/generators/TestGenerator.ts` - Test creation system with validation and progress tracking
- **Base generator abstraction**: `src/generators/base/BaseTestGenerator.ts` - Abstract base for language-specific generators
- **Generator factory**: `src/generators/TestGeneratorFactory.ts` - Factory for creating appropriate test generators
- **Language-specific generators**: `src/generators/javascript/` - ✅ COMPLETE JavaScript/TypeScript test generator with full integration and real-world validation
- **Async pattern detector**: `src/generators/javascript/analyzers/AsyncPatternDetector.ts` - AST-based async pattern analysis
- **Language contexts**: `src/generators/types/contexts.ts` - Comprehensive type definitions for language-specific contexts
- **Test templates**: `src/generators/templates/TestTemplateEngine.ts` - Enhanced assertion templates with correct import path calculation for all module systems
- **Import path calculation**: `src/generators/StructuralTestGenerator.ts` - getJavaScriptModulePath() method for correct relative path resolution
- **Progress reporting**: `src/utils/ProgressReporter.ts` - Real-time progress tracking for test generation
- **Test execution**: `src/runners/TestRunner.ts` - Framework-agnostic test running with FileDiscoveryService integration
- **Test runner factory**: `src/runners/TestRunnerFactory.ts` - Creates test runners with automatic FileDiscoveryService provisioning
- **AI integration**: `src/ai/ClaudeOrchestrator.ts` - Enhanced Claude CLI process management with crash prevention, timeout warnings, comprehensive resource monitoring, and zombie process detection
- **Retry utilities**: `src/utils/retry-helper.ts` - Intelligent retry system with adaptive timeout adjustment, context-aware retry decisions, failure pattern learning, exponential backoff retry logic, and circuit breaker pattern for transient failure handling
- **Stderr parser**: `src/utils/stderr-parser.ts` - Real-time Claude CLI error detection with comprehensive pattern matching and early termination capabilities
- **Shell command sanitizer**: `src/utils/ShellCommandSanitizer.ts` - Pattern detection for problematic shell commands
- **Process monitoring**: `src/utils/ProcessMonitor.ts` - Comprehensive cross-platform process monitoring with CPU/memory tracking, zombie detection, health metrics, and historical data analysis
- **Task checkpointing**: `src/state/TaskCheckpointManager.ts` - AI task checkpointing system with partial progress persistence, automatic resume capability, and timeout recovery
- **Configuration system**: `src/config/ConfigurationService.ts` - Centralized configuration service with source management
- **Configuration types**: `src/types/config.ts` - Complete TypeScript interfaces for .claude-testing.config.json and FileDiscoveryConfig
- **Configuration validation**: `src/utils/config-validation.ts` - Configuration loading and validation with enhanced error messages
- **Configuration debugging**: `src/utils/config-display.ts` - Configuration source visualization tools
- **Enhanced error messages**: `src/utils/config-error-messages.ts` - Contextual error formatting system
- **Configuration templates**: `templates/config/` - Pre-built configuration templates for React, Vue, Next.js, Express, Node.js, and Django projects
- **Init config command**: `src/cli/commands/init-config.ts` - CLI command for initializing project configurations with templates
- **Type system**: `src/types/` - Comprehensive discriminated union types including AI-specific error types
- **Pre-commit hooks**: `.husky/pre-commit` - Automated git hooks for build validation and quality gates
- **Production validation**: `scripts/production-readiness-check.js` - Enhanced production readiness checker with realistic thresholds (93% test pass rate, 85% overall score)
- **Validation reporting**: `scripts/generate-validation-report.js` - Comprehensive validation report generator with markdown/JSON output formats
- **Deployment checklist**: `scripts/production-deployment-checklist.js` - Automated pre/during/post deployment validation checklist

### Documentation Locations
- **AI agent navigation hub**: `/docs/CLAUDE.md` - Central navigation for all AI agent documentation
- **Development history**: `/docs/development/DEVELOPMENT_HISTORY.md` - Complete development timeline and decisions
- **Configuration guide**: `/docs/configuration.md` - Complete .claude-testing.config.json reference with examples
- **Configuration migration**: `/docs/configuration-migration.md` - Migration guide for upgrading configuration approaches
- **Configuration templates guide**: `/templates/config/README.md` - Usage guide for pre-built configuration templates
- **Integration tests**: `/tests/integration/configuration/` - Comprehensive configuration integration test suite
- **Architecture decisions**: `/docs/architecture/overview.md` - System design
- **User guides**: `/docs/user/getting-started.md` - Complete usage examples

## 🎯 Current Status & Priorities

### Current Status
**PRODUCTION-READY MAINTENANCE MODE** (2025-07-04): Infrastructure is in stable maintenance mode with all critical user feedback addressed. All high-priority implementation and refactoring tasks completed. Test suite at 96.3% pass rate with CI/CD pipeline fully operational. Remaining work consists of investigation-phase tasks (6-8+ hours) and architectural epics (20-40+ hours).

### Recent Updates
- **2025-07-04**: Added configuration template system - created 6 pre-built templates for common frameworks, implemented init-config CLI command with auto-detection and interactive setup, comprehensive documentation for template usage
- **2025-07-04**: Fixed test quality measurement system - resolved duplicate content generation in ClaudeOrchestrator.saveGeneratedTests method, preventing multiple AI-generated test sections from being appended to the same file
- **2025-07-04**: Enhanced generated test quality - added intelligent class vs function detection for proper instantiation, fixed module existence tests to use first export when no default export exists, improved React testing configuration with proper jest-dom setup and responsive component mocks
- **2025-07-03**: Comprehensive test suite stabilization - fixed AsyncPatternDetector mocks and test logic, added NewExpression handler for Promise detection, corrected TypeScript import extensions in multiple templates, improved callback pattern detection confidence levels

📖 **See active tasks**: [`/docs/planning/ACTIVE_TASKS.md`](./docs/planning/ACTIVE_TASKS.md)  
📖 **See future work**: [`/docs/planning/FUTURE_WORK.md`](./docs/planning/FUTURE_WORK.md)

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
node dist/cli/index.js monitor --testing-only       # Monitor system processes for debugging
```

## 💡 AI Agent Guidelines

### Essential Workflow
1. Read this PROJECT_CONTEXT.md first
2. Check relevant `/docs/` modules for detailed information
3. Follow established patterns and conventions
4. Update documentation after changes
5. **Current phase**: Production-ready maintenance mode with all critical user feedback resolved

### Quick Reference
- **Primary entry point**: [`AI_AGENT_GUIDE.md`](./AI_AGENT_GUIDE.md) - Protected, stable AI agent guide
- **Documentation navigation**: [`/docs/CLAUDE.md`](./docs/CLAUDE.md) - Central hub for all AI agent documentation
- **Architecture**: Language Adapter Pattern with decoupled external testing
- **Core commands**: `analyze → test → run → generate-logical → incremental → watch → monitor` workflow
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
- **📖 AI Agents**: [`/docs/ai-agents/`](./docs/ai-agents/) - AI agent patterns and behavioral guidelines
- **📖 Project Info**: [`/docs/project/`](./docs/project/) - Project overview, changelog, and navigation
- **📖 Reference**: [`/docs/reference/`](./docs/reference/) - Command reference and API specifications
- **📖 Testing**: [`/docs/testing/`](./docs/testing/) - Testing frameworks and validation systems

## 🔧 CI/CD Maintenance

### AI Validation Test Maintenance

The infrastructure includes comprehensive AI validation tests (`tests/validation/ai-agents/`) that ensure core functionality works correctly. These tests require periodic maintenance when APIs change.

#### When to Update AI Validation Tests

AI validation tests must be updated when:
- Core API interfaces change (constructor parameters, method signatures)
- New required fields are added to interfaces
- Method names are changed or deprecated
- Type definitions are modified

#### Maintenance Process

1. **Identify API Changes**: When core infrastructure APIs change, check if validation tests need updates
2. **Update Test API Usage**: Fix constructor calls, method names, and interface usage in validation test files
3. **Maintain Test Intent**: Keep the same test coverage and validation goals while updating to current APIs
4. **Verify GitHub Actions**: Ensure CI/CD pipeline completes successfully after changes

#### Key Validation Test Files

- `tests/validation/ai-agents/connectivity/claude-cli-integration.test.ts` - Claude CLI integration and timeout handling
- `tests/validation/ai-agents/generation-quality/test-quality-validation.test.ts` - Test quality metrics and assertions
- `tests/validation/ai-agents/end-to-end/production-readiness.test.ts` - Complete workflow validation

#### Troubleshooting Common Issues

**TypeScript Compilation Errors:**
- Check constructor parameters match current interface requirements
- Verify method names haven't changed
- Update interface field names and types
- Ensure all required fields are provided

**GitHub Actions Failures:**
- Run `npm run test:ai-validation` locally to reproduce issues
- Check for missing required parameters in API calls
- Verify all test dependencies are correctly imported
- Update Jest configuration if needed

#### Recent Maintenance Examples

**"Improve Claude CLI Integration Reliability" (2025-07-04)** - Fixed AI validation test failures in CI:
- **Claude CLI Tests**: Updated to verify graceful degradation when CLI is not available
- **Test Quality Validation**: Fixed overly strict expectations - accepts valid JavaScript patterns
- **Template Expectations**: Updated to handle both `test()` and `it()` syntax from Jest
- **Module System**: Added ES module system specification for React component tests

**"Fix Remaining GitHub Actions Validation Failures" (2025-07-02)** - Resolved final CI/CD pipeline issues:
- **TypeScript Compilation**: Fixed `enableValidation` property errors, added null checks for `generatedTest` objects, corrected export object structures in `TemplateContext`
- **CLI Compatibility**: Removed invalid `--budget` flag usage, replaced `fail()` with `throw new Error()` statements
- **Template Engine**: Fixed `EnhancedReactTypeScriptComponentTemplate` constructor error by removing non-existent template reference
- **Interface Compliance**: Updated test files to match current `TemplateContext` interface requirements
- ClaudeOrchestrator constructor to require config object
- FrameworkInfo interface structure changes
- AITaskBatch required fields (id, totalEstimatedTokens, totalEstimatedCost, maxConcurrency)
- TestGenerator API changes (generateTest → generateAllTests)
- ProjectAnalyzer constructor requirements

#### Responsibility

AI validation test maintenance is part of core infrastructure development. When making API changes:
1. **Check impact** on validation tests before committing
2. **Update tests** as part of the same pull request
3. **Verify CI/CD** passes before merging
4. **Document changes** if they affect maintenance process

## 📊 Current Task Status

### Implementation Backlog
- **Total tasks**: 0 remaining
- **Status**: All immediate implementation tasks completed - infrastructure in maintenance mode

### Refactoring Backlog
- **Total tasks**: 3 remaining (excluding epics)
- **Moderate priority**: 0 tasks (all completed) 
- **Complex priority**: 3 investigation tasks remaining:
  - Configuration System Simplification (High Priority, 6-8 hours)
  - Configuration Auto-Discovery Investigation (Medium Priority, 6 hours)
  - File Discovery Service Investigation (Medium Priority, 8 hours)
- **Epic tasks**: 4 major architectural improvements requiring 20-40+ hours each
- **Next up**: Configuration System Simplification (High Priority, ~6-8 hours) - all remaining work requires extended investigation sessions

---

**Version**: 2.0.0 | **Architecture**: Decoupled-only | **AI**: Claude-powered | **Status**: Production Ready