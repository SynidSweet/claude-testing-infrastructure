# Decoupled Testing Suite - Agent Guide

This directory contains the **decoupled testing approach** that maintains testing infrastructure separately from target projects, enabling zero-modification testing.

## 🎯 What This Approach Does

The decoupled approach:
- **Never modifies** the target project code
- **Maintains tests** in a separate repository
- **Analyzes projects** from outside to understand structure
- **Evolves independently** allowing updates without touching target code

## 📁 Directory Structure

```
decoupled-testing-suite/
├── core/                      # Core testing infrastructure
│   ├── discovery/            # Project analysis engine
│   │   ├── project-discovery.js    # Main discovery logic
│   │   ├── component-analyzer.js   # UI component detection
│   │   └── dependency-resolver.js  # Dependency analysis
│   │
│   ├── config/               # Configuration management
│   │   ├── config-manager.js      # Main config handler
│   │   └── config-validator.js    # Schema validation
│   │
│   ├── runners/              # Test execution engines
│   │   ├── jest-runner.js         # JavaScript test runner
│   │   ├── pytest-runner.js       # Python test runner
│   │   └── e2e-runner.js         # End-to-end test runner
│   │
│   └── interfaces/           # Stable API contracts
│       ├── IProjectDiscovery.js
│       ├── ITestRunner.js
│       └── IConfigManager.js
│
├── config/                    # Configuration schemas & adapters
│   ├── adapters/             # Framework-specific adapters
│   │   ├── react-adapter.js
│   │   ├── vue-adapter.js
│   │   ├── express-adapter.js
│   │   ├── fastapi-adapter.js
│   │   └── adapter-factory.js
│   │
│   └── schemas/              # JSON schemas for validation
│       ├── project-config.schema.json
│       ├── test-config.schema.json
│       └── adapter-config.schema.json
│
├── templates/                 # External test templates
│   ├── javascript/           # JS/TS test templates
│   ├── python/              # Python test templates
│   └── integration/         # Cross-language test templates
│
├── scripts/                  # Automation scripts
│   ├── init.js              # Initialize testing for a project
│   ├── discover.js          # Run project discovery
│   ├── test.js             # Execute tests
│   └── update.js           # Update testing suite
│
└── tests/                   # Tests for this testing suite
    └── ... (self-testing)
```

## 🚀 Quick Start

### Analyze Any Project Without Modifying It
```bash
# From this directory
npm run discover -- --project-path /path/to/target/project

# Or use it externally
npx decoupled-testing-suite discover --project-path ./my-project
```

### What Happens During Discovery

1. **External Analysis** (`core/discovery/project-discovery.js:74`)
   - Scans project structure without modifying
   - Identifies languages and frameworks
   - Maps component relationships
   - Detects existing test patterns

2. **Configuration Generation** (`core/config/config-manager.js`)
   - Creates test configuration
   - Selects appropriate adapters
   - Generates test execution plan
   - Stores in suite's config directory

3. **Test Generation** (`templates/` + adapters)
   - Creates tests in THIS repository
   - Links to target project for execution
   - Maintains separation of concerns

## 🔧 Key Components

### Project Discovery Engine (`core/discovery/`)

Non-invasive analysis includes:
- **File structure mapping** - Understanding project layout
- **Dependency analysis** - Package.json, requirements.txt parsing
- **Component detection** - Finding React/Vue components, API endpoints
- **Pattern recognition** - Identifying architectural patterns

```javascript
// Core discovery interface
class IProjectDiscovery {
    async discover(projectPath) {
        // Returns comprehensive project analysis
        // WITHOUT modifying any files
    }
    
    async analyzeComponents(projectPath) {
        // Deep component relationship mapping
    }
}
```

### Framework Adapters (`config/adapters/`)

Each adapter provides:
- **Detection logic** - How to identify the framework
- **Test strategies** - Framework-specific testing patterns
- **Configuration generation** - Optimal test setup
- **Execution patterns** - How to run tests effectively

```javascript
// Example adapter pattern
class ReactAdapter {
    canHandle(projectAnalysis) {
        return projectAnalysis.dependencies.includes('react');
    }
    
    generateTestConfig(projectAnalysis) {
        // React-specific test configuration
    }
    
    getTestTemplates() {
        // React testing patterns
    }
}
```

### Test Runners (`core/runners/`)

Executes tests while maintaining separation:
- **Path mapping** - Links suite tests to target code
- **Environment isolation** - Separate test environment
- **Result aggregation** - Unified reporting
- **Coverage mapping** - Maps coverage to target project

## 📋 Common Tasks

### Task: Test Existing JavaScript Project
```bash
# 1. Discover project structure
npm run discover -- --project-path ../my-app

# 2. Review generated configuration
cat config/projects/my-app/test-config.json

# 3. Run tests
npm run test -- --project my-app

# Tests run from THIS repository against target
```

### Task: Test Python Backend
```bash
# 1. Point to Python project
npm run discover -- --project-path ../python-api

# 2. Suite detects Python and frameworks
# 3. Generates pytest configuration
# 4. Creates test files in suite

npm run test -- --project python-api
```

### Task: Update Testing Suite
```bash
# Update suite without touching projects
npm run update

# Projects automatically get new features
# No modifications needed in target code
```

## 🏗️ Architecture Principles

### Zero Modification Guarantee
```javascript
// NEVER do this:
fs.writeFileSync(path.join(targetProject, 'anyFile'), data);

// ALWAYS do this:
fs.writeFileSync(path.join(suiteConfig, 'project-tests', 'test.js'), data);
```

### Stable Interfaces
All public APIs in `core/interfaces/` are versioned:
- Breaking changes require major version bump
- Backward compatibility is maintained
- Projects can rely on interface stability

### Framework Adapter Pattern
```
┌─────────────────┐
│ Target Project  │ (Never Modified)
└────────┬────────┘
         │ Analyzes
         ▼
┌─────────────────┐
│ Discovery Engine│
└────────┬────────┘
         │ Produces
         ▼
┌─────────────────┐
│ Project Analysis│
└────────┬────────┘
         │ Selects
         ▼
┌─────────────────┐
│ Framework       │
│ Adapter         │
└────────┬────────┘
         │ Generates
         ▼
┌─────────────────┐
│ Test Suite      │ (In THIS Repository)
└─────────────────┘
```

## 🔄 Workflow Integration

### Setting Up for a New Project

1. **Discovery Phase**
   ```bash
   npm run discover -- --project-path /path/to/project
   ```

2. **Configuration Review**
   - Check `config/projects/[project-name]/`
   - Adjust if needed (rare)

3. **Test Execution**
   ```bash
   npm run test -- --project [project-name]
   ```

4. **Continuous Testing**
   - Set up watcher for project changes
   - Run tests on suite updates
   - Generate reports

### CI/CD Integration

```yaml
# Example GitHub Action in target project
- name: Run Decoupled Tests
  run: |
    git clone [testing-suite-repo] test-suite
    cd test-suite
    npm install
    npm run test -- --project ${{ github.repository }}
```

## ⚡ Advanced Features

### Custom Adapters
1. Implement adapter interface
2. Register in adapter factory
3. Add detection logic
4. Provide test templates

### Project Profiles
Store project-specific configuration:
```json
{
  "projectName": "my-app",
  "framework": "react",
  "testPatterns": ["**/*.test.js"],
  "coverage": {
    "threshold": 80,
    "exclude": ["**/node_modules/**"]
  }
}
```

### Test Versioning
- Tests versioned with suite
- Can run different test versions
- Gradual migration support

## 🐛 Troubleshooting

### Common Issues

1. **Discovery Can't Find Framework**
   - Ensure project has clear indicators
   - Check adapter detection logic
   - Add custom adapter if needed

2. **Tests Can't Import Target Code**
   - Verify path mappings
   - Check module resolution config
   - Ensure dependencies installed

3. **Coverage Not Mapping**
   - Check source map configuration
   - Verify path transformations
   - Review coverage tool settings

## 📊 Refactoring Notes

From `REFACTORING_PLAN.md`, this approach needs:
- Complete interface implementation
- Adapter pattern for all frameworks
- Better error aggregation
- Performance optimization for large codebases

## 🔗 Related Documentation

- **Parent Guide**: `/CLAUDE.md`
- **Architecture**: `/ARCHITECTURE.md`
- **Other Approach**: `/ai-testing-template/CLAUDE.md`
- **Implementation Plan**: `/DECOUPLED_TESTING_ARCHITECTURE_IMPLEMENTATION_PLAN.md`

## 💡 Key Insights

1. **This approach NEVER modifies target projects** - critical design principle
2. **Tests live separately but execute together** - best of both worlds
3. **Framework adapters provide flexibility** - easy to add new framework support
4. **Interface stability enables long-term maintenance** - projects can rely on APIs

## 🎯 When to Use This Approach

Choose decoupled testing when:
- Working with existing production code
- Version control is sensitive
- Multiple projects need consistent testing
- Testing infrastructure needs independent updates
- Zero modification is a requirement

Remember: This is the "zero modification" approach. For quick embedded testing, see the template-based approach.