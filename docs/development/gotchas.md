# Important Constraints & Gotchas

## Technical Constraints
- **Performance requirements**: Project discovery must complete <10 seconds, template copying <2 minutes, minimal memory footprint
- **Security requirements**: No automatic code execution, safe file operations, dependency validation before installation
- **Compatibility requirements**: Node.js 14+, Python 3.9+, cross-platform path handling (Windows/macOS/Linux)

## Development Gotchas
- **Common pitfalls**: 
  - Path resolution differences between platforms (use path.join())
  - Template variable substitution in binary files (exclude patterns)
  - Framework detection false positives (multiple validation methods)
  - Dependency conflicts between project and testing requirements
  - Import patterns: Use destructured imports for ConfigManager, ProjectDiscovery
  - AdapterFactory: Use singleton instance `adapterFactory`, not the class
- **Legacy considerations**: Support for older project structures, graceful degradation for unsupported frameworks
- **Known technical debt**: 
  - Template system needs better error recovery
  - Discovery engine can be optimized for large codebases
  - Configuration merging logic needs refactoring
  - **File discovery inconsistencies (2025-07-01)**: 5 different implementations with mixed performance, inconsistent exclude patterns, no caching. See `/docs/planning/file-discovery-investigation-report.md`
- **Fixed issues (2025-01-27)**:
  - All module imports corrected to use proper destructuring
  - ConfigManager usage fixed to pass config path parameter
  - Added missing ajv-formats dependency
  - Fixed baseConfig.coverage.exclude array initialization
  - ProjectDiscovery.discoverComponents now receives proper config parameter

## See Also
- 📖 **Development Conventions**: [`/docs/development/conventions.md`](./conventions.md)
- 📖 **Development Workflow**: [`/docs/development/workflow.md`](./workflow.md)
- 📖 **Architecture Insights**: [`/docs/architecture/insights.md`](../architecture/insights.md)