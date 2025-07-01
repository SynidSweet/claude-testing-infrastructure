# Project Context & AI Agent Guide

*Last updated: 2025-07-01 | Updated by: /document command | All moderate-priority improvements completed*

## 🎯 Project Overview

### Core Purpose
AI-powered decoupled testing infrastructure that generates comprehensive tests without modifying target projects. Uses intelligent analysis and AI test generation to achieve 80%+ coverage for JavaScript/TypeScript and Python projects.

**Target Users**: AI agents, developers, teams needing rapid test implementation  
**Business Value**: Reduces testing setup from days to minutes while maintaining quality  
**Current Status**: Production-ready v2.0 with critical path resolution bugs fixed (160/163 tests passing, test generation workflow operational)

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

### Key Feature Modules
- **ProjectAnalyzer** (`src/analyzers/ProjectAnalyzer.ts`): Language/framework detection with 8+ framework support
- **TestGenerator** (`src/generators/TestGenerator.ts`): Structural + AI-powered test generation system with fixed path resolution, correct directory structure, and dependency-free templates
- **TestTemplateEngine** (`src/generators/templates/TestTemplateEngine.ts`): Robust template system generating CommonJS-compatible tests with basic structural assertions (100% executable without external dependencies)
- **ProgressReporter** (`src/utils/ProgressReporter.ts`): Real-time progress tracking with ETA calculations and file-by-file updates
- **TestRunner** (`src/runners/TestRunner.ts`): Production-ready Jest/pytest execution with timeout handling
- **CoverageReporter** (`src/runners/CoverageReporter.ts`): Advanced multi-format coverage analysis and gap visualization with consolidated template engines
- **Incremental System** (`src/state/`): Git-based change detection with smart test updates and cost optimization
- **FileChunker** (`src/utils/file-chunking.ts`): Intelligent file chunking for large files exceeding AI token limits
- **ClaudeOrchestrator** (`src/ai/ClaudeOrchestrator.ts`): Enhanced Claude CLI management with authentication validation, typed errors, and progress tracking
- **BatchedLogicalTestGenerator** (`src/ai/BatchedLogicalTestGenerator.ts`): Configurable batch processing for large-scale AI test generation

## 🔌 Integrations & External Dependencies

### APIs & Services
- **Claude Code CLI Integration**: ✅ Complete with authentication validation, typed error handling, progress tracking, and automatic model alias resolution
- **Git Integration**: ✅ Complete change detection for incremental testing
- **CI/CD Integration**: GitHub Actions, GitLab CI templates with JUnit XML reports

### Third-Party Libraries
- **@babel/parser**: JavaScript/TypeScript AST parsing for test generation
- **commander**: CLI framework for the `claude-testing` command interface
- **fast-glob**: High-performance file pattern matching for project analysis
- **winston**: Structured logging with configurable output levels
- **chokidar**: Cross-platform file system watching for watch mode functionality

## 📍 Where to Find Things

### Key Files & Locations
- **AI agent entry point**: `AI_AGENT_GUIDE.md` - Protected, stable primary entry point
- **CLI entry point**: `src/cli/index.ts` - Main command interface with polished error handling and dry-run support
- **Core analysis logic**: `src/analyzers/ProjectAnalyzer.ts` - Project detection engine
- **Test generation**: `src/generators/TestGenerator.ts` - Test creation system with validation and progress tracking
- **Test templates**: `src/generators/templates/TestTemplateEngine.ts` - Enhanced assertion templates with 30-50% useful coverage
- **Progress reporting**: `src/utils/ProgressReporter.ts` - Real-time progress tracking for test generation
- **Test execution**: `src/runners/TestRunner.ts` - Framework-agnostic test running
- **AI integration**: `src/ai/ClaudeOrchestrator.ts` - Enhanced Claude CLI process management
- **Configuration system**: `src/types/config.ts` - Complete TypeScript interfaces for .claude-testing.config.json
- **Type system**: `src/types/` - Comprehensive discriminated union types including AI-specific error types

### Documentation Locations
- **AI agent navigation hub**: `/docs/CLAUDE.md` - Central navigation for all AI agent documentation
- **Development history**: `/docs/development/DEVELOPMENT_HISTORY.md` - Complete development timeline and decisions
- **Configuration guide**: `/docs/configuration.md` - Complete .claude-testing.config.json reference with examples
- **Architecture decisions**: `/docs/architecture/overview.md` - System design
- **User guides**: `/docs/user/getting-started.md` - Complete usage examples

## 🎯 Current Status & Priorities

### Current Status
**PRODUCTION MAINTENANCE MODE** (2025-07-01): Production-ready infrastructure with **all moderate-priority improvements completed**. Infrastructure includes dry-run mode, real-time progress reporting, file count validation, meaningful test assertions, batched AI generation, and comprehensive mixed-project support. Core validation workflow operational with 97% success rate (160/163 tests passing). Only specialized features (MCP testing) and investigation-phase tasks remain.

📖 **See active tasks**: [`/docs/planning/ACTIVE_TASKS.md`](./docs/planning/ACTIVE_TASKS.md)  
📖 **See future work**: [`/docs/planning/FUTURE_WORK.md`](./docs/planning/FUTURE_WORK.md)

### Quick Success Example
```bash
# Build the infrastructure
npm install && npm run build

# Complete workflow with any project
node dist/cli/index.js analyze /path/to/project     # Detect languages/frameworks
node dist/cli/index.js test /path/to/project --dry-run  # Preview test generation
node dist/cli/index.js test /path/to/project        # Generate comprehensive tests
node dist/cli/index.js run /path/to/project --coverage  # Execute with coverage
node dist/cli/index.js incremental /path/to/project # Smart updates based on Git changes
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
- **Core commands**: `analyze → test → run → analyze-gaps → incremental → watch` workflow
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

---

**Version**: 2.0.0 | **Architecture**: Decoupled-only | **AI**: Claude-powered | **Status**: Production Ready