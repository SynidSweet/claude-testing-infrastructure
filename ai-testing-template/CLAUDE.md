# AI Testing Template - Agent Guide

This directory contains the **template-based approach** for quickly setting up comprehensive testing in JavaScript/TypeScript and Python projects.

## 🎯 What This Approach Does

The template-based approach:
- **Copies** testing infrastructure directly INTO your project
- **Configures** test frameworks based on detected project type
- **Provides** ready-to-use test templates and examples
- **Sets up** CI/CD pipelines for automated testing

## 📁 Directory Structure

```
ai-testing-template/
├── scripts/                    # Core initialization logic
│   ├── init.js                # Main entry point (start here)
│   └── utils/                 # Utility modules
│       ├── fileSystem.js      # Project analysis & detection
│       ├── prompter.js        # Interactive CLI prompts
│       └── templateManager.js # Template copying & configuration
│
├── templates/                  # Test templates by technology
│   ├── javascript/            # JS/TS templates
│   │   ├── frontend/         # React, Vue, Angular tests
│   │   ├── backend/          # Node.js, Express tests
│   │   └── shared/           # Common JS testing patterns
│   │
│   ├── python/               # Python templates
│   │   ├── backend/          # FastAPI, Flask, Django tests
│   │   ├── data/             # Data science testing patterns
│   │   └── shared/           # Common Python testing patterns
│   │
│   └── common/               # Language-agnostic templates
│       ├── github-actions/   # CI/CD workflows
│       ├── gitlab-ci/        # GitLab pipelines
│       └── docker/           # Containerized testing
│
├── examples/                  # Complete example projects
│   ├── react-app/            # React with full test suite
│   ├── node-api/             # Express API with tests
│   ├── python-fastapi/       # FastAPI with pytest
│   └── fullstack/            # JS frontend + Python backend
│
└── docs/                     # Additional documentation
    ├── AGENT_README.md       # Step-by-step setup guide
    └── AGENT_TEST_GUIDE.md   # Testing methodology
```

## 🚀 Quick Start

### Initialize Testing in Any Project
```bash
# From your project directory
npx ai-testing-template init

# Or clone and run
git clone [repo-url] testing-setup
cd testing-setup/ai-testing-template
npm install
npm run init
```

### What Happens During Initialization

1. **Project Analysis** (`fileSystem.js:257`)
   - Detects language (JavaScript/TypeScript/Python)
   - Identifies frameworks (React, Vue, Express, FastAPI, etc.)
   - Analyzes existing test structure

2. **Interactive Configuration** (`prompter.js`)
   - Asks about testing preferences
   - Confirms detected frameworks
   - Allows customization of test structure

3. **Template Installation** (`templateManager.js`)
   - Copies appropriate test templates
   - Configures test runners (Jest/pytest)
   - Sets up coverage reporting
   - Adds CI/CD workflows

## 🔧 Key Components

### Project Detection (`scripts/utils/fileSystem.js`)

The analyzer detects:
- **JavaScript Projects**: package.json, node_modules
- **TypeScript Projects**: tsconfig.json, .ts files
- **Python Projects**: setup.py, pyproject.toml, requirements.txt
- **Frameworks**: React, Vue, Angular, Express, FastAPI, Flask, Django

```javascript
// Key method for project analysis
async analyzeProject(projectPath) {
    const analysis = {
        language: null,
        frameworks: [],
        hasExistingTests: false,
        testRunner: null,
        projectStructure: {}
    };
    // ... detection logic
}
```

### Template Management (`scripts/utils/templateManager.js`)

Handles:
- Template selection based on project type
- Variable substitution in templates
- Safe file copying (with backup)
- Configuration merging

### Interactive Prompts (`scripts/utils/prompter.js`)

Provides:
- Framework confirmation
- Test directory structure choice
- Coverage threshold settings
- CI/CD platform selection

## 📋 Common Tasks

### Task: Add React Testing
```bash
# The init script will detect React automatically
npm run init

# Templates copied:
# - Component testing with React Testing Library
# - Hook testing patterns
# - Integration test examples
# - Jest configuration
```

### Task: Add Python Backend Testing
```bash
# Detects Python and asks about framework
npm run init

# Templates for detected framework:
# - pytest configuration
# - API endpoint tests
# - Database test fixtures
# - Mock patterns
```

### Task: Customize Test Configuration
1. Run `npm run init`
2. Choose "Custom" when prompted
3. Select specific options:
   - Test directory location
   - Coverage thresholds
   - E2E testing setup
   - CI/CD platforms

## 🎨 Template Structure

### JavaScript Templates
```
templates/javascript/
├── frontend/
│   ├── react/
│   │   ├── component.test.js.template
│   │   ├── hook.test.js.template
│   │   └── integration.test.js.template
│   ├── vue/
│   │   └── component.test.js.template
│   └── shared/
│       └── jest.config.js.template
└── backend/
    ├── express/
    │   ├── api.test.js.template
    │   └── middleware.test.js.template
    └── shared/
        └── supertest-setup.js.template
```

### Python Templates
```
templates/python/
├── backend/
│   ├── fastapi/
│   │   ├── test_api.py.template
│   │   └── conftest.py.template
│   ├── flask/
│   │   └── test_routes.py.template
│   └── django/
│       └── test_views.py.template
└── shared/
    ├── pytest.ini.template
    └── .coveragerc.template
```

## 🔄 Workflow Integration

### After Running Init

1. **Verify Installation**
   ```bash
   # JavaScript
   npm test
   npm run test:coverage
   
   # Python
   pytest
   pytest --cov
   ```

2. **Customize Templates**
   - Edit generated test files
   - Adjust configuration files
   - Add project-specific patterns

3. **Set Up CI/CD**
   - Check `.github/workflows/` or `.gitlab-ci.yml`
   - Configure secrets if needed
   - Enable in repository settings

## ⚡ Advanced Usage

### Custom Template Variables
Templates support variable substitution:
- `{{projectName}}` - Detected or provided project name
- `{{framework}}` - Primary framework (react, vue, express, etc.)
- `{{testRunner}}` - Jest, Vitest, pytest, etc.
- `{{coverageThreshold}}` - User-selected coverage target

### Extending Templates
1. Add new templates in appropriate directory
2. Follow naming convention: `[type].test.[ext].template`
3. Use variable substitution markers
4. Update template registry in `templateManager.js`

## 🐛 Troubleshooting

### Common Issues

1. **Detection Fails**
   - Check project has clear indicators (package.json, etc.)
   - Run with `--verbose` flag
   - Manually specify with `--framework` option

2. **Templates Not Copying**
   - Verify write permissions
   - Check for file conflicts
   - Use `--force` to overwrite

3. **Tests Not Running**
   - Ensure dependencies installed
   - Check test script in package.json
   - Verify test file patterns match

## 📊 Refactoring Notes

From `/docs/planning/refactoring-tasks.md`, this approach needs:
- Split large methods in `init.js` (some >50 lines)
- Implement proper adapter pattern for language support
- Improve error handling and aggregation
- Better separation of concerns in utility classes

## 🔗 Related Documentation

- **Parent Guide**: `/CLAUDE.md`
- **Architecture**: `/docs/architecture/overview.md`
- **Technical Stack**: `/docs/architecture/technical-stack.md`
- **Adapter Pattern**: `/docs/architecture/adapter-pattern.md`
- **Other Approach**: `/decoupled-testing-suite/CLAUDE.md`
- **Setup Guide**: `docs/AGENT_README.md`
- **Test Patterns**: `docs/AGENT_TEST_GUIDE.md`
- **Navigation Hub**: `/PROJECT_CONTEXT.md`

## 💡 Key Insights

1. **This approach modifies the target project** - use for new projects or when you want embedded tests
2. **Templates are language-specific by design** - not duplication
3. **Interactive prompts guide non-expert users** - important for adoption
4. **Everything is customizable** - templates are starting points

Remember: This is the "quick setup" approach. For zero-modification testing, see the decoupled approach.