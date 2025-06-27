# AI Agent Guidelines

## Preferred Approaches
- **Code style**: ES6+ features, async/await for asynchronous operations, clear variable naming, comprehensive error handling
- **Testing approach**: Follow TDD red-green-refactor cycle, use provided templates as starting points, focus on high-value test coverage
- **Documentation style**: Copy-pasteable commands, step-by-step verification, clear success/failure indicators

## Things to Avoid
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
- **Most modified files**: 
  - ai-testing-template/scripts/init.js (initialization logic)
  - decoupled-testing-suite/core/discovery/project-discovery.js (discovery engine)
  - Configuration templates in templates/ directories
- **Stable interfaces**: 
  - IProjectDiscovery interface (decoupled-testing-suite/core/interfaces/)
  - Configuration schema (decoupled-testing-suite/config/schemas/)
- **Extension points**: 
  - New framework adapters (decoupled-testing-suite/config/adapters/)
  - Additional test templates (templates/ directories)
  - Custom configuration generators

## See Also
- 📖 **Navigation Guide**: [`/docs/ai-agents/navigation.md`](./navigation.md)
- 📖 **Migration Guide**: [`/docs/ai-agents/migration-guide.md`](./migration-guide.md)
- 📖 **Architecture Insights**: [`/docs/architecture/insights.md`](../architecture/insights.md)