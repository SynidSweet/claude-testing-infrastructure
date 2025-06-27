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

### AI Agent Automated Mode (Recommended)
```bash
# Fully automated with smart defaults (AI agents)
npm run init:auto

# Use predefined configuration presets
npm run init:minimal      # Basic testing only
npm run init:recommended  # Balanced setup (default)
npm run init:comprehensive # Full testing suite

# Preview what will be installed
npm run preview

# Advanced automation with specific options
npm run init -- --auto --frameworks jest,playwright --ci github
```

### Interactive Mode (Human Users)
```bash
# Interactive prompts for customization
npm run init:interactive

# Or the traditional way
npm run init

# Clone and run approach
git clone [repo-url] testing-setup
cd testing-setup/ai-testing-template
npm install
npm run init:auto
```

### What Happens During Initialization

#### Automated Mode (AI Agents)
1. **Project Analysis** (`fileSystem.js:257`) - Detects languages and frameworks
2. **Smart Configuration** (`init-auto.js`) - Generates config with confidence scoring
3. **Template Installation** (`templateManager.js`) - Copies appropriate templates
4. **Dependency Installation** - Automatically installs npm/pip packages
5. **Configuration Generation** - Updates package.json, creates configs
6. **Completion Report** - Shows next steps and confidence level

#### Interactive Mode (Human Users)
1. **Project Analysis** (`fileSystem.js:257`) - Same detection logic
2. **Interactive Configuration** (`prompter.js`) - Guided prompts
3. **Template Installation** (`templateManager.js`) - Same installation
4. **Manual Confirmation** - User approves before installation

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

## 🤖 AI Agent Usage Patterns

### Fully Automated Setup (Most Common)
```bash
# Let the system choose everything automatically
npm run init:auto

# Results: Smart defaults based on project analysis
# - JavaScript projects get Jest + React Testing Library (if React detected)
# - Python projects get pytest + coverage
# - Confidence scoring shows decision quality
```

### Preset-Based Setup
```bash
# For minimal testing setup
npm run init:minimal

# For comprehensive testing (includes E2E, performance, etc.)
npm run init:comprehensive

# Preview before installing
npm run preview
```

### Override Specific Options
```bash
# Force specific frameworks
npm run init -- --auto --frameworks jest,playwright,pytest

# Choose CI/CD provider
npm run init -- --auto --ci gitlab

# Disable coverage
npm run init -- --auto --no-coverage
```

### Dry Run for Planning
```bash
# See what would be installed without doing it
npm run init -- --dry-run --preset comprehensive

# Output shows:
# - Files that would be created
# - Dependencies that would be installed
# - Configuration changes planned
```

## 📋 Common Tasks

### Task: Add React Testing (AI Agent)
```bash
# Automated detection and setup
npm run init:auto

# If React is detected, automatically includes:
# - Jest configuration optimized for React
# - React Testing Library
# - Component testing examples
# - Integration test patterns
```

### Task: Add Python Backend Testing (AI Agent)
```bash
# Automated Python testing setup
npm run init:auto

# If FastAPI/Flask/Django detected, automatically includes:
# - pytest configuration
# - API endpoint test examples
# - async testing support (FastAPI)
# - Coverage reporting
# - Framework-specific test utilities
```

### Task: Customize Test Configuration (AI Agent)
```bash
# Use CLI flags for specific requirements
npm run init -- --auto --frameworks jest,cypress --structure colocated --ci gitlab

# Available customization options:
# --frameworks: jest,rtl,playwright,cypress,vitest,pytest,coverage,black,mypy
# --ci: github,gitlab,circle,none
# --structure: separate,colocated,mixed
# --preset: minimal,recommended,comprehensive
# --no-coverage: disable code coverage
```

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