# Technical Stack

*Last updated: 2025-06-28 | Updated by: /document command | Added template engines*

## Technology Foundation
- **Primary language(s)**: TypeScript (compiled to Node.js 18+), JavaScript ES6+, Python 3.9+
- **Framework(s)**: Core Node.js with framework-specific adapters (React, Vue, Express, FastAPI, Flask, Django)
- **Database(s)**: Project-agnostic (supports PostgreSQL, MySQL, SQLite, MongoDB based on target project)
- **Key libraries**: 
  - **Core Analysis**: fast-glob (pattern matching), @babel/parser (AST parsing), ignore (gitignore support)
  - **CLI & UI**: chalk (terminal styling), commander (CLI framework), ora (spinners)
  - **File Operations**: fs-extra (enhanced file ops), simple-git (git integration)
  - **Validation**: ajv (JSON validation), ajv-formats (format validation), zod (TypeScript validation)
  - **Testing Infrastructure**: jest (internal testing), jest/vitest (JS testing), pytest (Python testing)
  - **Configuration**: cosmiconfig (flexible configuration loading), winston (logging)
  - **Coverage System**: istanbul/nyc (JS coverage), coverage.py (Python coverage), custom template engines
- **Infrastructure**: Standalone TypeScript repositories with Git-based distribution, CI/CD templates for GitHub Actions

## System Architecture
- **Architectural pattern**: Two complementary approaches (NOT competing solutions):
  1. **Template-based**: Direct installation into projects for quick setup and full customization
  2. **Decoupled**: Separate testing repository that never modifies the target project
- **Core modules/components**:
  - Project Discovery Engine: Analyzes codebases and detects frameworks/patterns
  - Template Management System: Copies and configures testing templates
  - Configuration Generator: Creates framework-specific test configurations
  - Language Adapter Pattern: Intentional multi-language support (NOT code duplication)
- **Data flow**: Project Analysis → Framework Detection → Adapter Selection → Configuration Generation → Test Setup
- **External integrations**: Git repositories, NPM/pip package managers, CI/CD platforms (GitHub Actions, GitLab CI)
- **Key architectural principle**: JavaScript and Python support uses language-specific adapters, not duplicated code

## Project Structure (Updated 2025-06-28)
```
claude-testing/
├── ARCHITECTURE.md               # System design and dual-approach explanation
├── IMPLEMENTATION_PLAN_COMPLETE.md # 6-week implementation plan with 200+ tasks
├── AI_POWERED_TEST_GENERATION_PLAN.md # Claude integration strategy
├── INCREMENTAL_TESTING_STRATEGY.md # Smart change detection plan
├── src/                         # ⭐ NEW: Core TypeScript infrastructure
│   ├── analyzers/               # Project analysis engine
│   │   ├── ProjectAnalyzer.ts   # ⭐ IMPLEMENTED: Core analyzer class
│   │   └── index.ts            # Analyzer exports and legacy compatibility
│   ├── cli/                    # Command-line interface
│   │   ├── index.ts            # Main CLI entry point
│   │   └── commands/           # Individual CLI commands
│   │       ├── analyze.ts      # ⭐ ENHANCED: Multi-format analysis command
│   │       ├── test.ts         # Test generation command (placeholder)
│   │       └── watch.ts        # Watch mode command (placeholder)
│   ├── generators/             # Test generation engine (future)
│   ├── runners/                # Test execution engine (future)
│   │   └── templates/          # ⭐ NEW: Template engines for report generation
│   │       ├── HtmlTemplateEngine.ts      # HTML report generator
│   │       ├── MarkdownTemplateEngine.ts  # Markdown report generator
│   │       ├── XmlTemplateEngine.ts       # XML report generator
│   │       └── coverage-report.html       # External HTML template
│   ├── adapters/               # Language adapters (future)
│   └── utils/                  # Shared utilities
│       └── logger.ts          # Winston-based logging
├── tests/                      # TypeScript test suite
│   ├── analyzers/              # Analyzer tests
│   │   └── ProjectAnalyzer.test.ts # ⭐ COMPREHENSIVE: 10 test cases
│   └── utils/                  # Utility tests
├── dist/                       # Compiled JavaScript output
├── shared/                     # Legacy: Shared components (adapter pattern)
│   ├── interfaces/              # Core interfaces (IProjectAdapter, etc.)
│   ├── adapters/               # Language adapter implementations
│   │   ├── base/               # Abstract base classes
│   │   ├── javascript/         # JavaScriptAdapter
│   │   ├── python/            # PythonAdapter
│   │   └── AdapterFactory.js  # Automatic adapter selection
│   └── examples/               # Usage examples
├── ai-testing-template/          # Template-based approach (modifies target project)
│   ├── scripts/                  # Initialization and setup automation
│   │   ├── init.js              # Original initialization script
│   │   ├── initWithAdapter.js   # ⭐ NEW: Adapter-based initialization
│   │   └── utils/               # Utilities including new FileSystemAdapter
│   ├── templates/               # Test templates by technology stack
│   │   ├── javascript/          # JS/TS frontend and backend templates
│   │   ├── python/              # Python backend testing templates
│   │   └── common/              # CI/CD and shared configurations
│   ├── examples/                # Working example implementations
│   └── docs/                    # Agent-optimized documentation
├── decoupled-testing-suite/     # Decoupled approach (zero modification)
│   ├── core/                    # Core testing infrastructure
│   │   ├── discovery/           # ProjectDiscovery engine for code analysis
│   │   ├── config/              # Configuration management system
│   │   ├── runners/             # Test execution engines
│   │   └── interfaces/          # Stable API contracts for version safety
│   ├── config/                  # Configuration schemas and adapters
│   │   ├── adapters/            # Framework-specific adapters
│   │   └── schemas/             # JSON schemas for validation
│   ├── templates/               # External test templates
│   ├── scripts/                 # ✅ IMPLEMENTED: All automation scripts
│   │   ├── discover-project.js  # Analyze project structure
│   │   ├── init-project.js      # Initialize configuration
│   │   ├── run-tests.js         # Execute tests
│   │   ├── analyze-project.js   # Deep project analysis
│   │   ├── validate-setup.js    # Validate configuration
│   │   ├── safe-update.js       # Update testing suite
│   │   ├── migrate-config.js    # Migrate configurations
│   │   └── check-compatibility.js # Check compatibility
│   └── examples/                # ⭐ NEW: Working demo applications
│       └── decoupled-demo/      # Complete React app demo
└── Planning Documents/          # Implementation plans and specifications
```

## See Also
- 📖 **Architecture Overview**: [`/docs/architecture/overview.md`](./overview.md)
- 📖 **Adapter Pattern**: [`/docs/architecture/adapter-pattern.md`](./adapter-pattern.md)
- 📖 **Dependencies**: [`/docs/architecture/dependencies.md`](./dependencies.md)