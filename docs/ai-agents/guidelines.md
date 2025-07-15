# AI Agent Guidelines

*Last updated: 2025-06-29 | Updated by: /document command | Documentation consistency improvements completed*

## Preferred Approaches
- **Entry point usage**: Always start with `AI_AGENT_GUIDE.md` for stable, protected guidance with comprehensive information
- **Command execution**: Use `node dist/src/cli/index.js` format (never `npx claude-testing`) - all commands verified working
- **Navigation**: Use `/docs/ai-agents/navigation.md` for detailed architecture understanding aligned with current implementation
- **Requirements verification**: Check Git availability, Node.js 18+, and disk space before starting
- **Code style**: ES6+ features, async/await for asynchronous operations, clear variable naming, comprehensive error handling
- **Testing approach**: Follow TDD red-green-refactor cycle, use provided templates as starting points, focus on high-value test coverage
- **Documentation style**: Copy-pasteable commands, step-by-step verification, clear success/failure indicators

## Things to Avoid
- **Entry point mistakes**:
  - ❌ Modifying `AI_AGENT_GUIDE.md` during sessions (use as read-only reference)
  - ❌ Using `npx claude-testing` commands (infrastructure is not published to npm)
  - ❌ Relying on `CLAUDE.md` as primary entry point (superseded by stable guide)
  - ❌ Ignoring system requirements (Git, Node.js 18+, disk space)
- **Documentation inconsistencies**:
  - ❌ Following outdated dual-approach documentation (project uses single decoupled approach)
  - ❌ Using commands from feature docs without verification (all commands now consistent)
  - ❌ Skipping prerequisites verification before starting work
- **Critical misconceptions**:
  - ❌ Treating JavaScript and Python code as duplication (it's intentional multi-language support)
  - ❌ Trying to merge the two approaches (they serve different use cases)
  - ❌ Simplifying "complex" detection logic (it handles real-world edge cases)
- **Anti-patterns**: 
  - Modifying project source code directly (use decoupled approach instead)
  - Installing global dependencies without user confirmation
  - Overwriting existing test files without backup
- **Deprecated patterns**: Direct file manipulation without path validation, synchronous file operations for large operations
- **Breaking changes**: Modifying template interfaces without version updates, changing CLI command signatures

## Quick Reference
- **Entry point files**:
  - `AI_AGENT_GUIDE.md` - Primary protected entry point (read-only)
  - `AI_AGENT_GUIDE.template.md` - Backup for restoration
  - `PROJECT_CONTEXT.md` - Comprehensive navigation
  - `CLAUDE.md` - Legacy working document
- **Most modified files**: 
  - src/cli/index.ts (CLI command interface)
  - src/analyzers/ProjectAnalyzer.ts (project analysis)
  - src/generators/TestGenerator.ts (test generation)
  - Configuration files in target projects
- **Stable interfaces**: 
  - CLI command structure (`node dist/src/cli/index.js <command>`)
  - Configuration schema (.claude-testing.config.json)
  - Public API interfaces in TypeScript files
- **Extension points**: 
  - New language adapters (src/adapters/)
  - Additional test templates (src/generators/templates/)
  - Custom analysis modules (src/analyzers/)

## See Also
- 📖 **Navigation Guide**: [`/docs/ai-agents/navigation.md`](./navigation.md)
- 📖 **Migration Guide**: [`/docs/ai-agents/migration-guide.md`](./migration-guide.md)
- 📖 **Architecture Insights**: [`/docs/architecture/insights.md`](../architecture/insights.md)