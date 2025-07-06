# Project Context & AI Agent Guide

*Last updated: 2025-07-06 | Process Context Isolation System completed - all 3 phases implemented with comprehensive mock testing infrastructure*

## 🎯 Project Overview

### Core Purpose
AI-powered decoupled testing infrastructure that generates comprehensive tests without modifying target projects, achieving 80%+ coverage for JavaScript/TypeScript and Python projects.

**Target Users**: AI agents, developers, teams needing rapid test implementation  
**Current Status**: Production-ready v2.0 with comprehensive safety mechanisms and validated testing infrastructure

### Key Success Metrics
- Zero modification of target projects (100% decoupled approach)
- 80%+ test coverage generation with structural + AI-powered logical tests
- Sub-10 minute setup time for comprehensive testing infrastructure
- Multi-language support with framework detection and validated mixed project testing

## 🏗️ Architecture & Technical Stack

### Quick Overview
**Technology**: TypeScript with Node.js CLI, supports JavaScript/TypeScript + Python projects  
**Architecture**: Decoupled external testing infrastructure with AI integration  
**Core Pattern**: Language Adapter Pattern for multi-framework support

📖 **See detailed architecture**: [`./docs/architecture/overview.md`](./docs/architecture/overview.md)  
📖 **See technical stack**: [`./docs/architecture/technical-stack.md`](./docs/architecture/technical-stack.md)

## 🔧 Quick Start & Key Commands

### Setup
```bash
# Build the infrastructure
npm install && npm run build

# Initialize configuration for your project type
node dist/cli/index.js init-config /path/to/project    # Auto-detect and set up config
```

### Main Commands
```bash
# Complete analysis workflow
node dist/cli/index.js analyze /path/to/project --show-config-sources
node dist/cli/index.js test /path/to/project --dry-run  # Preview generation
node dist/cli/index.js test /path/to/project           # Generate tests
node dist/cli/index.js run /path/to/project --coverage # Execute with coverage

# Efficient workflows
node dist/cli/index.js incremental /path/to/project    # Smart Git-based updates
node dist/cli/index.js generate-logical-batch /path/to/project --batch-size 5
```

📖 **See development workflow**: [`./docs/development/workflow.md`](./docs/development/workflow.md)  
📖 **See commands reference**: [`./docs/commands/api-reference.md`](./docs/commands/api-reference.md)

## ⚠️ Critical Constraints

- **Claude CLI Required**: AI-powered logical tests require Claude Code installation and Max subscription
- **Decoupled Only**: Never modifies target projects - all tests stored externally
- **Git Dependency**: Incremental testing requires Git repository for change detection
- **Usage Limits**: Sequential processing by default to prevent Claude usage spikes (use --allow-concurrent flag for parallel processing)
- **⚠️ CRITICAL**: Never run infrastructure on itself - recursive testing causes exponential process spawning and system crashes (absolute safety via DISABLE_HEADLESS_AGENTS environment variable - no exceptions)
- **Test Safety**: Test suite runs with `DISABLE_HEADLESS_AGENTS=true` by default to prevent API calls and quota consumption

## 📍 Where to Find Things

### Key Files & Locations
- **AI agent entry point**: `AI_AGENT_GUIDE.md` - Protected, stable primary entry point
- **CLI entry point**: `src/cli/index.ts` - Main command interface with 9 production commands
- **Core services**: `src/services/` - FileDiscoveryService, ConfigurationService (centralized)
- **Test generation**: `src/generators/` - Language-specific generators with factory pattern
- **AI integration**: `src/ai/ClaudeOrchestrator.ts` - Enhanced process management with usage controls, `src/ai/MockClaudeOrchestrator.ts` - Mock implementation for validation tests
- **Safety utilities**: `src/utils/ProcessContextValidator.ts` - Compile-time process context enforcement, `src/utils/ImportSanitizer.ts` - Test generation sandboxing and import validation, `src/utils/recursion-prevention.ts` - Environment-based prevention fallback
- **Testing infrastructure**: `src/ai/AITestHarness.ts` - Mock test scenario generation and validation utilities
- **Configuration**: `templates/config/` - Pre-built templates for React, Vue, Next.js, Express, Node.js, Django
- **Safe testing scripts**: `run-safe-tests.sh`, `monitor-test-run.sh` - Smart process monitoring
- **Testing guide**: `SAFE_TESTING_GUIDE.md` - Comprehensive safety documentation

📖 **See planning**: [`./docs/planning/`](./docs/planning/) for current tasks and roadmap

## 🚀 Core Features

### AI-Powered Test Generation
- Analyzes code structure and intent with AST parsing
- Generates meaningful test cases with edge case handling
- Batched processing with state persistence (default: sequential, 5 tests per batch)
- Cost optimization with incremental updates (70-90% savings)

### Zero Project Modification
- All tests stored externally in `.claude-testing/` directory
- No changes to target codebase - clean separation of concerns
- Git-based change detection for smart updates
- Framework auto-detection without intrusion

### Production-Ready Infrastructure
- Comprehensive validation system with quality gates
- Cross-platform process monitoring and resource limits
- Enhanced error handling with intelligent retry strategies
- CI/CD integration with GitHub Actions templates

## 💡 AI Agent Guidelines

### Essential Workflow
1. **Read this PROJECT_CONTEXT.md first** for navigation overview
2. **Check `/docs/` modules** for detailed technical information
3. **Follow patterns** in `/docs/development/conventions.md`
4. **Use** `/docs/development/workflow.md` for development setup
5. **Current phase**: Production-ready infrastructure with comprehensive safety mechanisms

### Quick Reference
- **Primary entry point**: [`AI_AGENT_GUIDE.md`](./AI_AGENT_GUIDE.md) - Complete setup and usage guide
- **Architecture overview**: [`./docs/architecture/overview.md`](./docs/architecture/overview.md)
- **Development workflow**: [`./docs/development/workflow.md`](./docs/development/workflow.md)
- **Planning and tasks**: [`./docs/planning/`](./docs/planning/)

### Key Design Principles
- **AI-First**: Optimized for AI agent execution with clear success indicators
- **Infrastructure-as-Code**: Continuous improvement via `git pull`
- **Copy-Pasteable**: All commands designed for direct execution
- **Process Aware**: Built-in usage tracking and limits to prevent resource exhaustion

## 📋 Recent Updates

- **2025-07-06**: **PROCESS CONTEXT ISOLATION SYSTEM COMPLETE** - Completed all 3 phases of comprehensive safety architecture. Added MockClaudeOrchestrator and AITestHarness for validation tests that run without real process spawning. Validation tests now complete safely in under 5 seconds while recording all process spawn attempts for verification.
- **2025-07-06**: **PROCESS CONTEXT ISOLATION SYSTEM PHASE 2** - Completed test generation sandboxing with ImportSanitizer utility. Prevents generated tests from importing dangerous infrastructure components. Features: dangerous import detection, content sanitization, path validation, and comprehensive safety at test generation and file writing stages.
- **2025-07-06**: **PROCESS CONTEXT ISOLATION SYSTEM PHASE 1** - Implemented compile-time safety boundaries with ProcessContext enum and ProcessContextValidator. All ClaudeOrchestrator instantiations now use appropriate contexts (USER_INITIATED, TEST_GENERATION, VALIDATION_TEST, INTERNAL_TEST). Architectural-level recursion prevention with infrastructure project detection.
- **2025-07-06**: **GLOBAL PROCESS MANAGEMENT ARCHITECTURE** - Implemented comprehensive process coordination system with GlobalProcessManager. Features: centralized process limits (max 5 Claude, max 12 total), reservation-based spawning, emergency shutdown capabilities, graceful degradation, and cross-component integration.

## 📋 Documentation Structure Reference

### Core Navigation
- **📖 Architecture**: [`./docs/architecture/`](./docs/architecture/) - System design and technical decisions
- **📖 Commands**: [`./docs/commands/`](./docs/commands/) - CLI reference and API documentation
- **📖 Development**: [`./docs/development/`](./docs/development/) - Conventions, workflow, and setup
- **📖 Planning**: [`./docs/planning/`](./docs/planning/) - Roadmap, tasks, and refactoring strategies

---

**Version**: 2.0.0 | **Architecture**: Decoupled-only | **AI**: Claude-powered | **Status**: Production Ready