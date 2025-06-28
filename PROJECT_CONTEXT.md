# Project Context & AI Agent Guide

*Last updated: 2025-06-28 | Updated by: /document command*

## Recent Updates
- **2025-06-28**: ✅ **PHASE 4 TEST EXECUTION SYSTEM COMPLETE** - Production-ready test runner infrastructure with advanced coverage reporting
- **2025-06-28**: ✅ **PHASE 6 INCREMENTAL TESTING COMPLETE** - Full Git-based incremental testing system with state management
- **2025-06-28**: ✅ **CRITICAL COMPILATION ERRORS RESOLVED** - Fixed TypeScript strict mode violations blocking build process

## 🎯 Project Overview

### Core Purpose
AI-powered decoupled testing infrastructure that generates comprehensive tests without modifying target projects. Uses intelligent analysis and AI test generation to achieve 80%+ coverage for JavaScript/TypeScript and Python projects.

**Target Users**: AI agents, developers, teams needing rapid test implementation
**Business Value**: Reduces testing setup from days to minutes while maintaining quality
**Current Status**: Production-ready v2.0 with complete CLI and AI integration foundation

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

## 🔧 Development Patterns & Conventions

### Key Principles
- Language Adapter Pattern for multi-framework support (JavaScript/TypeScript, Python)
- Zero target project modification (all tests stored in `.claude-testing/` directory)
- AI-powered logical test generation with cost optimization

📖 **See coding conventions**: [`/docs/development/conventions.md`](./docs/development/conventions.md)
📖 **See development workflow**: [`/docs/development/workflow.md`](./docs/development/workflow.md)

## 🚀 Core Features & User Journeys

### Primary User Flows
1. **Project Analysis**: `npx claude-testing analyze /path/to/project` - Detects languages, frameworks, and generates recommendations
2. **Test Generation**: `npx claude-testing test /path/to/project` - Creates comprehensive structural tests with AI-powered logical tests
3. **Test Execution**: `npx claude-testing run /path/to/project --coverage` - Runs tests with coverage reporting and gap analysis
4. **Incremental Updates**: `npx claude-testing incremental /path/to/project` - Smart test updates based on Git changes

### Feature Modules
- **ProjectAnalyzer** (`src/analyzers/ProjectAnalyzer.ts`): Language/framework detection with 8+ framework support
- **TestGenerator** (`src/generators/TestGenerator.ts`): Structural + AI-powered test generation system
- **TestRunner** (`src/runners/TestRunner.ts`): Production-ready Jest/pytest execution with timeout handling
- **CoverageReporter** (`src/runners/CoverageReporter.ts`): Advanced multi-format coverage analysis and gap visualization
- **TestGapAnalyzer** (`src/analyzers/TestGapAnalyzer.ts`): AI-powered gap analysis with cost estimation
- **Incremental System** (`src/state/`): Git-based change detection with smart test updates and cost optimization

### Data Models & Entities
- **ProjectAnalysis**: Comprehensive project structure analysis with complexity metrics
- **TestGeneratorConfig**: Test generation configuration with framework-specific options
- **TestRunnerConfig**: Test execution configuration with coverage and reporting options
- **TestResult**: Comprehensive test execution results with performance metrics and failure details
- **CoverageData**: Multi-format coverage parsing with gap analysis and threshold validation
- **TestManifest**: State tracking for incremental testing with file hashes and baseline management
- **ChangeAnalysis**: Git-based file change detection with impact scoring and cost estimation

## 🔌 Integrations & External Dependencies

### APIs & Services
- **Claude AI Integration**: ✅ Complete intelligent logical test generation (Phase 5.3)
- **Git Integration**: ✅ Complete change detection for incremental testing (Phase 6)
- **CI/CD Integration**: GitHub Actions, GitLab CI templates with JUnit XML reports

### Third-Party Libraries
- **@babel/parser**: JavaScript/TypeScript AST parsing for test generation
- **commander**: CLI framework for the `claude-testing` command interface
- **fast-glob**: High-performance file pattern matching for project analysis
- **winston**: Structured logging with configurable output levels

## 🛠️ Development Workflow

### Getting Started
- **Setup steps**: `git clone → npm install → npm run build`
- **Required tools**: Node.js 18+, Git, target project runtime
- **Common commands**: `analyze`, `test`, `run`, `watch`, `analyze-gaps`, `incremental`

### Development Practices
- **Branch strategy**: Main branch with feature branches and automated testing
- **Code review process**: TypeScript strict mode, comprehensive test suite (113+ tests passing)
- **Deployment process**: NPM package distribution with semantic versioning

## ⚠️ Important Constraints & Gotchas

### Technical Constraints
- **Zero modification requirement**: Never changes target project files
- **Language support**: Currently JavaScript/TypeScript and Python only
- **AI integration**: Requires Claude API key for logical test generation

### Development Gotchas
- **Language adapters are intentional**: Similar patterns for JS/Python are not duplication
- **External test storage**: All tests stored in `.claude-testing/` directory
- **Infrastructure philosophy**: Clone and use, never modify the testing infrastructure

## 📍 Where to Find Things

### Key Files & Locations
- **CLI entry point**: `src/cli/index.ts` - Main command interface
- **Core analysis logic**: `src/analyzers/ProjectAnalyzer.ts` - Project detection engine
- **Test generation**: `src/generators/TestGenerator.ts` - Test creation system
- **Test execution**: `src/runners/TestRunner.ts` - Framework-agnostic test running
- **Coverage system**: `src/runners/CoverageReporter.ts` - Advanced coverage analysis and reporting
- **Incremental system**: `src/state/` - State management and change detection
- **Configuration**: `tsconfig.json`, `jest.config.js`, `package.json`

### Documentation Locations
- **API documentation**: `/docs/api/interfaces.md` - TypeScript interfaces
- **Architecture decisions**: `/docs/architecture/overview.md` - System design
- **User guides**: `/docs/user/getting-started.md` - Complete usage examples

## 🎯 Current Priorities & Roadmap

### Active Development
**Phase 4 COMPLETED**: Test Execution System - Production-ready test runners with advanced coverage reporting
**Phase 6 COMPLETED**: Incremental Testing & Git Integration - Full state management and smart change detection

📖 **See roadmap**: [`/docs/planning/roadmap.md`](./docs/planning/roadmap.md)
📖 **See AI integration plan**: [`AI_POWERED_TEST_GENERATION_PLAN.md`](./AI_POWERED_TEST_GENERATION_PLAN.md)

### Completed Phases (2025-06-28)
- ✅ **Phase 1**: Foundation Setup - Project structure, CLI framework, logging system
- ✅ **Phase 2**: Project Analysis Engine - Language/framework detection, dependency scanning
- ✅ **Phase 3**: Test Generation System - Structural test creation with template engine
- ✅ **Phase 4**: Test Execution System - Production-ready runners with advanced coverage reporting
- ✅ **Phase 5.1-5.3**: Gap Analysis → Report Generation → AI Integration complete
- ✅ **Phase 6**: Incremental Testing & Git Integration complete
- ✅ **Coverage Reporter System**: Multi-format reporting (HTML/JSON/Markdown) with intelligent gap analysis
- ✅ **AI Infrastructure**: Complete AI task preparation and Claude orchestration
- ✅ **Production CLI**: Enhanced with all commands (`analyze`, `test`, `run`, `analyze-gaps`, `incremental`)
- ✅ **State Management**: Complete `.claude-testing/` directory with manifest and history tracking

### Next Priorities
- **✅ RESOLVED**: TypeScript compilation errors fixed - build process operational
- **✅ COMPLETED**: Phase 4 - Test Execution System with advanced coverage reporting
- **✅ COMPLETED**: Phase 6 - Incremental Testing & Git Integration
- **🔄 Current**: Phase 7+ - Advanced Features (dependency analysis, multi-project support)
- **Enhanced Templates**: Framework-specific test patterns and best practices
- **Performance Optimization**: Large codebase handling and caching mechanisms

## 💡 AI Agent Guidelines

### Essential Workflow
1. Read this PROJECT_CONTEXT.md first
2. Check relevant `/docs/` modules for detailed information
3. Follow established patterns and conventions
4. Update documentation after changes

### Quick Reference
- **Main entry point**: [`CLAUDE.md`](./CLAUDE.md) - Complete AI agent guide
- **Architecture**: Language Adapter Pattern with decoupled external testing
- **Core commands**: `analyze → test → run → analyze-gaps → incremental` workflow
- **Key constraint**: Never modify target projects, all tests external

### Quick Success Example
```bash
# Build the infrastructure
npm install && npm run build

# Complete workflow with any project
npx claude-testing analyze /path/to/project     # Detect languages/frameworks
npx claude-testing test /path/to/project        # Generate comprehensive tests
npx claude-testing run /path/to/project --coverage  # Execute with coverage
npx claude-testing analyze-gaps /path/to/project    # Identify gaps for AI generation

# Incremental updates (after initial setup)
npx claude-testing incremental /path/to/project # Smart updates based on Git changes
npx claude-testing incremental /path/to/project --stats # View update statistics
```

## 📋 Documentation Structure Reference

### Core Navigation
- **📖 Architecture**: [`/docs/architecture/`](./docs/architecture/) - System design and technical decisions
- **📖 Development**: [`/docs/development/`](./docs/development/) - Conventions, workflow, and gotchas
- **📖 Features**: [`/docs/features/`](./docs/features/) - Detailed component documentation
- **📖 Planning**: [`/docs/planning/`](./docs/planning/) - Roadmap and implementation plans
- **📖 User Guides**: [`/docs/user/`](./docs/user/) - Getting started and troubleshooting
- **📖 API Reference**: [`/docs/api/`](./docs/api/) - TypeScript interfaces and programmatic usage
- **📖 AI Agent Guides**: [`/docs/ai-agents/`](./docs/ai-agents/) - Specialized guidance for AI agents

### Essential Reading Order
1. **This file** (PROJECT_CONTEXT.md) - Overview and navigation
2. **[`CLAUDE.md`](./CLAUDE.md)** - AI agent entry point and usage guide  
3. **[`/docs/architecture/overview.md`](./docs/architecture/overview.md)** - System architecture
4. **[`/docs/development/workflow.md`](./docs/development/workflow.md)** - Development practices

---

**Version**: 2.0.0 | **Architecture**: Decoupled-only | **AI**: Claude-powered | **Status**: Production Ready