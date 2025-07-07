# Project Context & AI Agent Guide

*Last updated: 2025-07-07 | Updated by: /document command | Autonomous development session - infrastructure maintenance mode with test fix task created*

## 🎯 Project Overview

### Core Purpose
AI-powered decoupled testing infrastructure that generates comprehensive tests without modifying target projects. Uses intelligent analysis and AI test generation to achieve 80%+ coverage for JavaScript/TypeScript and Python projects.

**Target Users**: AI agents, developers, teams needing rapid test implementation  
**Business Value**: Reduces testing setup from days to minutes while maintaining quality  
**Current Status**: Production-ready v2.0 - Test suite at 96.7% pass rate (497/515 core tests passing) with CI/CD pipeline operational

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
- **FileDiscoveryService** (`src/services/FileDiscoveryService.ts`): Centralized file discovery with caching
- **ProjectAnalyzer** (`src/analyzers/ProjectAnalyzer.ts`): Language/framework detection with 10+ framework support
- **TestGenerator** (`src/generators/TestGenerator.ts`): Structural + AI-powered test generation system
- **ClaudeOrchestrator** (`src/ai/ClaudeOrchestrator.ts`): Enhanced Claude CLI management with intelligent retry strategies
- **TestRunner** (`src/runners/TestRunner.ts`): Production-ready Jest/pytest execution with timeout handling

## 📍 Where to Find Things

### Key Files & Locations
- **AI agent entry point**: `AI_AGENT_GUIDE.md` - Protected, stable primary entry point
- **CLI entry point**: `src/cli/index.ts` - Main command interface
- **Core analysis logic**: `src/analyzers/ProjectAnalyzer.ts` - Project detection engine
- **Test generation**: `src/generators/TestGenerator.ts` - Test creation system
- **AI integration**: `src/ai/ClaudeOrchestrator.ts` - Enhanced Claude CLI process management
- **Configuration system**: `src/config/ConfigurationService.ts` - Centralized configuration service
- **Type system**: `src/types/` - Comprehensive TypeScript interfaces

### Documentation Locations
- **AI agent navigation hub**: [`/docs/CLAUDE.md`](./docs/CLAUDE.md) - Central navigation for all AI agent documentation
- **Development history**: [`/docs/development/DEVELOPMENT_HISTORY.md`](./docs/development/DEVELOPMENT_HISTORY.md) - Complete development timeline and decisions
- **Configuration guide**: [`/docs/configuration.md`](./docs/configuration.md) - Complete .claude-testing.config.json reference
- **Architecture decisions**: [`/docs/architecture/overview.md`](./docs/architecture/overview.md) - System design
- **User guides**: [`/docs/user/getting-started.md`](./docs/user/getting-started.md) - Complete usage examples

## 🎯 Current Status & Priorities

### Current Status
**PRODUCTION-READY** (2025-07-07): Infrastructure is production-ready in maintenance mode with systematic code quality improvements ongoing. Build system fully functional with TypeScript compilation successful. Test suite at 96.7% pass rate (497/515 core tests passing) with 17 failing tests in AI heartbeat monitoring requiring fixes. CI/CD pipeline operational. Branch-based deployment strategy implemented with deploy/clean branch for minimal installations. **MILESTONE ACHIEVED**: Systematic TypeScript improvements crossed 50% reduction threshold - reduced linting problems from 1,390 to 678 (52.3% improvement) with enhanced type safety across core modules and continued nullish coalescing operator improvements.

📖 **See active tasks**: [`/docs/planning/ACTIVE_TASKS.md`](./docs/planning/ACTIVE_TASKS.md)  
📖 **See future work**: [`/docs/planning/FUTURE_WORK.md`](./docs/planning/FUTURE_WORK.md)  
📖 **See development history**: [`/docs/development/DEVELOPMENT_HISTORY.md`](./docs/development/DEVELOPMENT_HISTORY.md)

### Recent Updates
- **2025-07-07**: **AUTONOMOUS SESSION** - Infrastructure maintenance mode confirmed with all implementation-ready tasks completed. Discovered 17 failing tests in AI heartbeat monitoring (timing-related). Created TASK-TESTFIX-20250707-001 for test reliability fixes (96.7% pass rate: 497/515 tests)
- **2025-07-07**: **CONTINUED PROGRESS** - Systematic linting improvements: 52.3% reduction achieved (1,390→678 problems), nullish coalescing operator improvements in ProjectAnalyzer.ts and ConfigurationService.ts, enhanced type safety with continued TypeScript improvements
- **2025-07-07**: **MAJOR MILESTONE** - Systematic linting improvements crossed 50% reduction threshold (1,390→693 problems), enhanced type safety across generation-types.ts, reporting-types.ts, retry-helper.ts, config-validation.ts, and ClaudeOrchestrator.ts with TypeScript build successful
- **2025-07-02**: **CRITICAL FUNCTIONALITY COMPLETE** - All user feedback issues resolved, AI model configuration fixed, logical test generation operational, ES module support verified, comprehensive AI agent validation system implemented

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
```

### Test Execution Modes
```bash
# Fast tests (<1 minute) - for development
npm run test:fast

# Core tests (<2 minutes) - for pre-commit validation
npm run test:core

# Full tests (<10 minutes) - for comprehensive validation
npm run test:full
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

---

**Version**: 2.0.0 | **Architecture**: Decoupled-only | **AI**: Claude-powered | **Status**: Production Ready