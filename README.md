# Claude Testing Infrastructure

A comprehensive, AI-agent-friendly testing infrastructure for JavaScript/TypeScript and Python projects. This project provides two powerful approaches to implement testing in any codebase within minutes, not hours.

## 🚀 Quick Start for AI Agents

After cloning this repository, you have two approaches available:

### Option 1: Template-Based Testing (Modifies Your Project)
```bash
cd ai-testing-template
npm install
npm run init
```
This copies testing infrastructure directly into your project - perfect for new projects or when you want full control.

### Option 2: Decoupled Testing Suite (Zero Modification)
```bash
cd decoupled-testing-suite
npm install
npm run discover
```
This maintains tests in a separate repository - ideal for existing projects or when you need version-safe testing.

## 🎯 What This Project Does

This infrastructure helps you:
- **Set up comprehensive testing** in under 10 minutes
- **Support both JavaScript/TypeScript and Python** projects automatically
- **Generate test templates** for your specific framework (React, Vue, Express, FastAPI, Django, etc.)
- **Achieve >80% test coverage** with provided templates and patterns
- **Integrate with CI/CD** platforms like GitHub Actions

## 📖 For AI Agents: Navigation Guide

1. **First Time?** Read `CLAUDE.md` for comprehensive project navigation
2. **Architecture Questions?** See `/docs/architecture/overview.md` for design philosophy
3. **Implementation Details?** Check approach-specific CLAUDE.md files:
   - `ai-testing-template/CLAUDE.md` - Template approach guide
   - `decoupled-testing-suite/CLAUDE.md` - Decoupled approach guide
4. **Full Documentation Hub?** See `PROJECT_CONTEXT.md` for modular documentation structure

## 🔧 Installation & Setup

### Prerequisites
- Node.js 14+ 
- Git
- Target project runtime (Python 3.9+ for Python projects)

### Template-Based Approach

1. **Clone and Navigate**
   ```bash
   git clone <repository-url>
   cd claude-testing/ai-testing-template
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Initialize Testing**
   ```bash
   npm run init
   ```
   Follow the interactive prompts to configure testing for your project.

4. **Verify Setup**
   ```bash
   npm test
   npm run test:coverage
   ```

### Decoupled Testing Suite

1. **Clone and Navigate**
   ```bash
   git clone <repository-url>
   cd claude-testing/decoupled-testing-suite
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Discover Project Structure**
   ```bash
   npm run discover -- --project-path /path/to/your/project
   ```

4. **Initialize Testing Configuration**
   ```bash
   npm run init
   ```

5. **Run Tests**
   ```bash
   npm run test
   ```

## 🎓 Examples

### JavaScript/React Project
```bash
# Template approach
cd ai-testing-template
npm run init
# Select: Frontend > React > JavaScript
# Testing is now set up in your project!

# Decoupled approach
cd decoupled-testing-suite
npm run discover -- --project-path ../my-react-app
npm run init
npm run test
```

### Python/FastAPI Project
```bash
# Template approach
cd ai-testing-template
npm run init
# Select: Backend > FastAPI > Python
# Testing is now set up in your project!

# Decoupled approach
cd decoupled-testing-suite
npm run discover -- --project-path ../my-fastapi-app
npm run init
npm run test
```

## 🏗️ Architecture Overview

This project uses a **Language Adapter Pattern** to support multiple languages:

```
┌─────────────────────┐     ┌──────────────────────┐
│  Template Approach  │     │  Decoupled Approach  │
│  (Modifies Project) │     │  (Zero Modification) │
└──────────┬──────────┘     └──────────┬───────────┘
           │                            │
           └──────────┬─────────────────┘
                      │
            ┌─────────▼──────────┐
            │  Adapter Factory   │
            └─────────┬──────────┘
                      │
     ┌────────────────┼────────────────┐
     │                │                │
┌────▼─────┐   ┌─────▼──────┐  ┌─────▼──────┐
│JavaScript│   │   Python    │  │Multi-Lang  │
│ Adapter  │   │  Adapter    │  │  Adapter   │
└──────────┘   └─────────────┘  └────────────┘
```

## 📚 Key Features

### Automatic Language Detection
- Detects JavaScript/TypeScript projects via package.json
- Detects Python projects via setup.py, pyproject.toml, requirements.txt
- Supports full-stack projects with both languages

### Framework-Specific Support
- **JavaScript**: React, Vue, Angular, Express, Next.js, Nest.js
- **Python**: FastAPI, Django, Flask, Pytest, unittest
- **Testing**: Jest, Vitest, pytest, Playwright, Cypress

### Comprehensive Test Templates
- Unit tests with mocking patterns
- Integration tests for APIs
- Component tests for UI
- End-to-end test setups
- Performance testing templates

### CI/CD Integration
- GitHub Actions workflows
- GitLab CI templates
- Coverage reporting
- Automated test runs

## 🤖 AI Agent Instructions

When implementing testing for a project:

1. **Analyze the Project**
   ```bash
   # Check project type
   ls package.json setup.py pyproject.toml requirements.txt
   ```

2. **Choose Your Approach**
   - **New/Greenfield Projects**: Use template-based approach
   - **Existing/Sensitive Projects**: Use decoupled approach

3. **Follow the Setup Flow**
   - Run initialization commands
   - Answer framework-specific prompts
   - Verify generated configuration
   - Run tests to confirm setup

4. **Customize as Needed**
   - Modify test templates for project-specific needs
   - Add custom test utilities
   - Configure coverage thresholds
   - Set up CI/CD pipelines

## 🛠️ Available Commands

### Template-Based Commands
```bash
npm run init          # Initialize testing setup
npm test             # Run all tests  
npm run test:coverage # Run tests with coverage
npm run test:watch   # Run tests in watch mode
npm run test:e2e     # Run end-to-end tests
```

### Decoupled Suite Commands
```bash
npm run discover     # Analyze project structure
npm run init        # Initialize test configuration
npm run test        # Run all tests
npm run analyze     # Deep project analysis
npm run update      # Update test suite
npm run coverage    # Generate coverage report
```

## 📋 Configuration

### Test Configuration Files
- **JavaScript**: `jest.config.js`, `vitest.config.js`, `.eslintrc.test.js`
- **Python**: `pytest.ini`, `setup.cfg`, `.coveragerc`
- **E2E**: `playwright.config.js`, `cypress.config.js`

### Environment Variables
```bash
# .env.test
TEST_ENV=test
DATABASE_URL=sqlite:///test.db
API_BASE_URL=http://localhost:3000
```

## 🐛 Troubleshooting

### Common Issues

1. **"Cannot find project type"**
   - Ensure you're in the correct directory
   - Check for package.json or Python config files
   - Use `--project-path` flag for custom locations

2. **"Tests failing after setup"**
   - Run `npm install` or `pip install -r requirements.txt`
   - Check Node/Python version compatibility
   - Verify all dependencies are installed

3. **"Permission denied errors"**
   - Check file permissions
   - Run with appropriate user permissions
   - Use `--force` flag if necessary

### Debug Mode
```bash
# Run with debug output
DEBUG=* npm run init

# Verbose logging
npm run init -- --verbose
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup
```bash
# Clone the repository
git clone <repository-url>
cd claude-testing

# Install all dependencies
npm install

# Run tests
npm test

# Check code style
npm run lint
```

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🔗 Quick Links

- [Documentation Hub](PROJECT_CONTEXT.md)
- [Architecture Overview](/docs/architecture/overview.md)
- [AI Agent Navigation Guide](CLAUDE.md)
- [Refactoring Tasks](/docs/planning/refactoring-tasks.md)
- [Template Approach Guide](ai-testing-template/CLAUDE.md)
- [Decoupled Approach Guide](decoupled-testing-suite/CLAUDE.md)

---

*Built with ❤️ for AI agents and developers who value comprehensive testing*