# Project Context & AI Agent Guide

*Last updated: 2025-07-01 | Updated by: /document command | Enhanced AI authentication and error handling*

## 🎯 Project Overview

### Core Purpose
AI-powered decoupled testing infrastructure that generates comprehensive tests without modifying target projects. Uses intelligent analysis and AI test generation to achieve 80%+ coverage for JavaScript/TypeScript and Python projects.

**Target Users**: AI agents, developers, teams needing rapid test implementation  
**Business Value**: Reduces testing setup from days to minutes while maintaining quality  
**Current Status**: Production-ready v2.0 with all critical issues resolved (156/156 tests passing)

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
1. **Project Analysis**: `node dist/cli/index.js analyze /path/to/project` - Detects languages, frameworks, and generates recommendations
2. **Test Generation Preview**: `node dist/cli/index.js test /path/to/project --dry-run` - Preview test generation without creating files
3. **Test Generation**: `node dist/cli/index.js test /path/to/project` - Creates comprehensive structural tests with AI-powered logical tests
4. **Test Execution**: `node dist/cli/index.js run /path/to/project --coverage` - Runs tests with coverage reporting and gap analysis
5. **Incremental Updates**: `node dist/cli/index.js incremental /path/to/project` - Smart test updates based on Git changes
6. **Batched AI Generation**: `node dist/cli/index.js generate-logical-batch /path/to/project` - Configurable batch processing for large projects
7. **Watch Mode**: `node dist/cli/index.js watch /path/to/project` - Real-time file monitoring with automatic incremental test generation

### Key Feature Modules
- **ProjectAnalyzer** (`src/analyzers/ProjectAnalyzer.ts`): Language/framework detection with 8+ framework support
- **TestGenerator** (`src/generators/TestGenerator.ts`): Structural + AI-powered test generation system
- **TestRunner** (`src/runners/TestRunner.ts`): Production-ready Jest/pytest execution with timeout handling
- **CoverageReporter** (`src/runners/CoverageReporter.ts`): Advanced multi-format coverage analysis and gap visualization
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
- **Test generation**: `src/generators/TestGenerator.ts` - Test creation system with validation
- **Test execution**: `src/runners/TestRunner.ts` - Framework-agnostic test running
- **AI integration**: `src/ai/ClaudeOrchestrator.ts` - Enhanced Claude CLI process management
- **Configuration system**: `src/types/config.ts` - Complete TypeScript interfaces for .claude-testing.config.json
- **Type system**: `src/types/` - Comprehensive discriminated union types including AI-specific error types

### Documentation Locations
- **Development history**: `/docs/development/DEVELOPMENT_HISTORY.md` - Complete development timeline and decisions
- **Configuration guide**: `/docs/configuration.md` - Complete .claude-testing.config.json reference with examples
- **Architecture decisions**: `/docs/architecture/overview.md` - System design
- **User guides**: `/docs/user/getting-started.md` - Complete usage examples

## 🎯 Current Status & Priorities

### Current Status
**PRODUCTION MAINTENANCE MODE** (2025-07-01): Production-ready infrastructure with critical AI hanging issue resolved. Enhanced Claude CLI authentication validation, comprehensive error types, and real-time progress tracking implemented. Core test suite maintains 158/163 tests passing. All user-reported AI generation issues addressed.

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
- **Architecture**: Language Adapter Pattern with decoupled external testing
- **Core commands**: `analyze → test → run → analyze-gaps → incremental → watch` workflow
- **Key constraint**: Never modify target projects, all tests external

## 📋 Documentation Structure Reference

### Core Navigation
- **📖 Architecture**: [`/docs/architecture/`](./docs/architecture/) - System design and technical decisions
- **📖 Development**: [`/docs/development/`](./docs/development/) - Conventions, workflow, and development history
- **📖 Features**: [`/docs/features/`](./docs/features/) - Detailed component documentation
- **📖 Planning**: [`/docs/planning/`](./docs/planning/) - Roadmap, implementation plans, and refactoring strategies
- **📖 User Guides**: [`/docs/user/`](./docs/user/) - Getting started and troubleshooting
- **📖 API Reference**: [`/docs/api/`](./docs/api/) - TypeScript interfaces and programmatic usage

---

**Version**: 2.0.0 | **Architecture**: Decoupled-only | **AI**: Claude-powered | **Status**: Production Ready