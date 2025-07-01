# Architecture Documentation - AI Agent Guide

*Quick navigation for AI agents working with architectural decisions and system design*

## 🎯 Purpose

This guide helps AI agents understand and modify the Claude Testing Infrastructure's architecture. The system follows a **Language Adapter Pattern** with **decoupled external testing** to ensure zero modification of target projects.

## 🏗️ Core Architecture Principles

1. **Zero Project Modification**: All tests stored externally in `.claude-testing/` directory
2. **Language Adapter Pattern**: Pluggable adapters for JavaScript/TypeScript and Python
3. **AI Integration**: Claude-powered logical test generation with cost optimization
4. **State Management**: Git-based incremental testing with manifest tracking

## 📍 Key Architecture Files

### System Design
- **Overview**: [`overview.md`](./overview.md) - Complete architectural decisions and patterns
- **Technical Stack**: [`technical-stack.md`](./technical-stack.md) - Technology choices and dependencies
- **Decisions Log**: [`decisions.md`](./decisions.md) - Why we made specific architectural choices

### Core Components
- **Entry Point**: `src/cli/index.ts` - CLI command router
- **Project Analysis**: `src/analyzers/ProjectAnalyzer.ts` - Language/framework detection
- **Test Generation**: `src/generators/TestGenerator.ts` - Orchestrates test creation
- **AI Integration**: `src/ai/ClaudeOrchestrator.ts` - Claude API integration
- **State Management**: `src/state/ManifestManager.ts` - Incremental testing state

## 🔧 Working with Architecture

### Understanding the Language Adapter Pattern

The system uses adapters to support multiple languages without code duplication:

```typescript
// Language adapter interface
interface LanguageAdapter {
  detectFrameworks(projectPath: string): Promise<Framework[]>
  generateTests(files: SourceFile[]): Promise<TestFile[]>
  getTestRunner(): TestRunner
}
```

**Current adapters**:
- `JavaScriptAdapter` - Handles JS/TS, React, Vue, Angular, Node.js
- `PythonAdapter` - Handles Python, FastAPI, Flask, Django

### Adding New Features

When adding architectural components:

1. **Check existing patterns** in `src/types/` for interfaces
2. **Follow adapter pattern** for language-specific features
3. **Update state management** if feature affects incremental testing
4. **Document decisions** in `decisions.md`

### Modifying Core Systems

**Before modifying**:
- Read the complete [`overview.md`](./overview.md)
- Check if change affects Language Adapter Pattern
- Consider impact on zero-modification principle
- Review related components in dependency graph

**Common modifications**:
- **New language support**: Create new adapter implementing `LanguageAdapter`
- **New framework**: Extend existing language adapter
- **AI enhancements**: Modify `ClaudeOrchestrator` or `AITaskPreparation`
- **State changes**: Update `ManifestManager` and related types

## 🚨 Critical Constraints

1. **Never modify target projects** - All artifacts in `.claude-testing/`
2. **Maintain adapter boundaries** - Language-specific code only in adapters
3. **Preserve state compatibility** - Changes must support existing manifests
4. **Cost-aware AI usage** - Always estimate costs before AI operations

## 🔄 Architecture Workflows

### Adding a New Component

1. Define interfaces in `src/types/`
2. Implement core logic following existing patterns
3. Add to appropriate adapter if language-specific
4. Update manifest if affects state
5. Document in architecture files

### Refactoring Existing Components

1. Check [`/docs/planning/REFACTORING_PLAN.md`](../planning/REFACTORING_PLAN.md)
2. Follow decomposition patterns (orchestrator, single responsibility)
3. Maintain API compatibility
4. Update tests and documentation

## 📊 Architecture Decision Records

Key decisions that shape the system:

1. **Decoupled-only approach** (2025-06-28) - Removed template-based testing
2. **Git-based incremental** (2025-06-28) - Smart change detection
3. **AI cost optimization** (2025-06-29) - Batch processing with limits
4. **Discriminated unions** (2025-06-30) - Type safety improvements

## 🔗 Related Documentation

- **Main Guide**: [`/AI_AGENT_GUIDE.md`](../../AI_AGENT_GUIDE.md) - Primary AI agent entry point
- **Development**: [`/docs/development/CLAUDE.md`](../development/CLAUDE.md) - Development workflow
- **Features**: [`/docs/features/CLAUDE.md`](../features/CLAUDE.md) - Feature-specific guidance
- **Planning**: [`/docs/planning/CLAUDE.md`](../planning/CLAUDE.md) - Task planning
- **API**: [`/docs/api/CLAUDE.md`](../api/CLAUDE.md) - API documentation

## ⚡ Quick Actions

### Need to understand a component?
1. Check its role in [`overview.md`](./overview.md)
2. Find its adapter in `src/adapters/`
3. Review its types in `src/types/`

### Need to modify architecture?
1. Document decision in [`decisions.md`](./decisions.md)
2. Update affected adapters
3. Maintain zero-modification principle
4. Update this guide if needed

---

**Architecture Philosophy**: Keep it simple, extensible, and cost-efficient while never touching user projects.