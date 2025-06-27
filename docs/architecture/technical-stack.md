# Technical Stack

## Technology Foundation
- **Primary language(s)**: JavaScript ES6+ (Node.js 14+), Python 3.9+
- **Framework(s)**: Core Node.js with framework-specific adapters (React, Vue, Express, FastAPI, Flask, Django)
- **Database(s)**: Project-agnostic (supports PostgreSQL, MySQL, SQLite, MongoDB based on target project)
- **Key libraries**: 
  - fs-extra (file operations), glob (pattern matching), inquirer (CLI prompts)
  - chalk (terminal styling), commander (CLI framework), ajv (JSON validation), ajv-formats (format validation)
  - jest/vitest (JS testing), pytest (Python testing), playwright/cypress (E2E testing)
  - cosmiconfig (flexible configuration loading), semver (version management)
- **Infrastructure**: Standalone repositories with Git-based distribution, CI/CD templates for GitHub Actions

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

## Project Structure (Updated 2025-06-27)
```
claude-testing/
├── ARCHITECTURE.md               # System design and dual-approach explanation
├── REFACTORING_PLAN.md          # Comprehensive refactoring roadmap
├── ADAPTER_MIGRATION_GUIDE.md   # Guide for migrating to adapter pattern
├── shared/                      # ⭐ NEW: Shared components (adapter pattern)
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