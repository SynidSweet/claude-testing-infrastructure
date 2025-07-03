# Project Context & AI Agent Guide

*Last updated: 2025-07-03 | Updated by: /document command | Fixed configuration test logging issues, completed all simple refactoring tasks*

## 🎯 Project Overview

### Core Purpose
AI-powered decoupled testing infrastructure that generates comprehensive tests without modifying target projects. Uses intelligent analysis and AI test generation to achieve 80%+ coverage for JavaScript/TypeScript and Python projects.

**Target Users**: AI agents, developers, teams needing rapid test implementation  
**Business Value**: Reduces testing setup from days to minutes while maintaining quality  
**Current Status**: Production-ready v2.0 with **FileDiscoveryService fully integrated** and **Configuration System stabilized** (325/371 tests passing, 88% pass rate) - all CLI commands now use centralized file discovery with caching and robust configuration precedence, with recent ModuleSystemAnalyzer improvements providing more reliable JavaScript/TypeScript module detection

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
1. **Project Analysis**: `node dist/cli/index.js analyze /path/to/project` - Detects languages, frameworks, and generates recommendations
2. **Test Generation Preview**: `node dist/cli/index.js test /path/to/project --dry-run` - Preview test generation without creating files
3. **Test Generation**: `node dist/cli/index.js test /path/to/project` - Creates comprehensive structural tests with AI-powered logical tests
4. **Test Execution**: `node dist/cli/index.js run /path/to/project --coverage` - Runs tests with coverage reporting and gap analysis
5. **Incremental Updates**: `node dist/cli/index.js incremental /path/to/project` - Smart test updates based on Git changes
6. **Batched AI Generation**: `node dist/cli/index.js generate-logical-batch /path/to/project` - Configurable batch processing for large projects
7. **Watch Mode**: `node dist/cli/index.js watch /path/to/project` - Real-time file monitoring with automatic incremental test generation
8. **Process Monitoring**: `node dist/cli/index.js monitor` - Monitor system processes for resource usage and testing-related activity
9. **Production Validation**: `npm run validation:production` - Comprehensive production readiness assessment with quality gates

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
- **AsyncPatternDetector** (`src/generators/javascript/analyzers/AsyncPatternDetector.ts`): AST-based async pattern detection for async/await, promises, callbacks, and generators with pattern-specific test generation
- **TestTemplateEngine** (`src/generators/templates/TestTemplateEngine.ts`): Robust template system with correct import path calculation for ES modules and CommonJS, generating 100% executable tests with proper relative path resolution
- **JavaScriptEnhancedTemplates** (`src/generators/templates/JavaScriptEnhancedTemplates.ts`): Enhanced framework-specific templates with async pattern awareness, module system intelligence, and comprehensive test generation for React, Vue, Angular, and TypeScript
- **MCP Test Templates** (`src/generators/templates/MCP*.ts`): Specialized templates for MCP server testing - protocol compliance, tool integration, message handling, transport validation, and chaos testing
- **ProgressReporter** (`src/utils/ProgressReporter.ts`): Real-time progress tracking with ETA calculations and file-by-file updates
- **TestRunner** (`src/runners/TestRunner.ts`): Production-ready Jest/pytest execution with timeout handling, fully integrated with FileDiscoveryService for efficient test file discovery with language-specific filtering
- **TestRunnerFactory** (`src/runners/TestRunnerFactory.ts`): Creates test runners with automatic FileDiscoveryService provisioning via singleton factory pattern
- **CoverageReporter** (`src/runners/CoverageReporter.ts`): Advanced multi-format coverage analysis and gap visualization with consolidated template engines
- **Incremental System** (`src/state/`): Git-based change detection with smart test updates and cost optimization
- **FileChunker** (`src/utils/file-chunking.ts`): Intelligent file chunking for large files exceeding AI token limits
- **ClaudeOrchestrator** (`src/ai/ClaudeOrchestrator.ts`): Enhanced Claude CLI management with authentication validation, typed errors, and progress tracking
- **BatchedLogicalTestGenerator** (`src/ai/BatchedLogicalTestGenerator.ts`): Configurable batch processing for large-scale AI test generation
- **ConfigurationService** (`src/config/ConfigurationService.ts`): Centralized configuration loading with source precedence, environment variables, user configuration support, and fixed warnings collection (resolved critical aggregation bug)
- **ProcessMonitor** (`src/utils/ProcessMonitor.ts`): ✅ NEW - Cross-platform process monitoring utility for detecting high-resource test processes, system resource debugging, and orphaned process identification with regex-based testing framework filtering

## 🔌 Integrations & External Dependencies

### APIs & Services
- **Claude Code CLI Integration**: ✅ Complete with authentication validation, typed error handling, progress tracking, and automatic model alias resolution
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
- **AI integration**: `src/ai/ClaudeOrchestrator.ts` - Enhanced Claude CLI process management with crash prevention
- **Shell command sanitizer**: `src/utils/ShellCommandSanitizer.ts` - Pattern detection for problematic shell commands
- **Process monitoring**: `src/utils/ProcessMonitor.ts` - Cross-platform process detection and resource monitoring utilities
- **Configuration system**: `src/config/ConfigurationService.ts` - Centralized configuration service with source management
- **Configuration types**: `src/types/config.ts` - Complete TypeScript interfaces for .claude-testing.config.json and FileDiscoveryConfig
- **Configuration validation**: `src/utils/config-validation.ts` - Configuration loading and validation with enhanced error messages
- **Configuration debugging**: `src/utils/config-display.ts` - Configuration source visualization tools
- **Enhanced error messages**: `src/utils/config-error-messages.ts` - Contextual error formatting system
- **Type system**: `src/types/` - Comprehensive discriminated union types including AI-specific error types
- **Pre-commit hooks**: `.husky/pre-commit` - Automated git hooks for build validation and quality gates
- **Production validation**: `scripts/production-readiness-check.js` - Automated production readiness validation with quality gates
- **Scripts directory**: `scripts/` - Utility scripts for validation, deployment, and maintenance tasks

### Documentation Locations
- **AI agent navigation hub**: `/docs/CLAUDE.md` - Central navigation for all AI agent documentation
- **Development history**: `/docs/development/DEVELOPMENT_HISTORY.md` - Complete development timeline and decisions
- **Configuration guide**: `/docs/configuration.md` - Complete .claude-testing.config.json reference with examples
- **Configuration migration**: `/docs/configuration-migration.md` - Migration guide for upgrading configuration approaches
- **Integration tests**: `/tests/integration/configuration/` - Comprehensive configuration integration test suite
- **Architecture decisions**: `/docs/architecture/overview.md` - System design
- **User guides**: `/docs/user/getting-started.md` - Complete usage examples

## 🎯 Current Status & Priorities

### Current Status
**PRODUCTION VALIDATION READY** (2025-07-03): Production readiness validation infrastructure complete with automated quality gates. **Test Status**: 386/414 tests passing (93.2% success rate). **Completed**: All simple refactoring tasks resolved - fixed configuration test logging issues. **Current priority**: Moderate complexity production blockers (5 tasks) and complex tasks (2 tasks) remain for achieving >98% test pass rate required for production deployment.

### Recent Updates
- **2025-07-03**: Fixed configuration test logging issues - cleaned test output by converting logger.info to logger.debug in ConfigurationService and config-validation, completed all simple refactoring tasks
- **2025-07-02**: Added production readiness validation infrastructure - created automated quality gates script, established scripts directory structure with comprehensive validation covering build, CLI, test suite, core commands, documentation, and AI integration
- **2025-07-02**: Implemented process monitoring and cleanup system - added ProcessMonitor utility for cross-platform resource detection, enhanced watch mode with optional process monitoring, added comprehensive troubleshooting documentation for resource issues
- **2025-07-02**: Implemented defensive shell command patterns - added ShellCommandSanitizer utility to prevent Claude CLI crashes, enhanced error recovery with signal code detection, updated troubleshooting docs

📖 **See active tasks**: [`/docs/planning/ACTIVE_TASKS.md`](./docs/planning/ACTIVE_TASKS.md)  
📖 **See future work**: [`/docs/planning/FUTURE_WORK.md`](./docs/planning/FUTURE_WORK.md)

### Quick Success Example
```bash
# Build the infrastructure
npm install && npm run build

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

**"Fix Remaining GitHub Actions Validation Failures" (2025-07-02)** - Resolved final CI/CD pipeline issues:
- **TypeScript Compilation**: Fixed `enableValidation` property errors, added null checks for `generatedTest` objects, corrected export object structures in `TemplateContext`
- **CLI Compatibility**: Removed invalid `--budget` flag usage, replaced `fail()` with `throw new Error()` statements
- **Template Engine**: Fixed `EnhancedReactTypeScriptComponentTemplate` constructor error by removing non-existent template reference
- **Interface Compliance**: Updated test files to match current `TemplateContext` interface requirements

**"Fix AI Validation Tests and CI/CD Documentation" (Previous)** - API compatibility updates:
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

---

**Version**: 2.0.0 | **Architecture**: Decoupled-only | **AI**: Claude-powered | **Status**: Production Ready