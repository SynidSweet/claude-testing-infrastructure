# Claude Testing Infrastructure

A comprehensive, AI-agent-friendly testing infrastructure for JavaScript/TypeScript and Python projects. This decoupled approach implements comprehensive testing in any codebase within minutes, not hours.

## 🔒 IMPORTANT: This is Infrastructure

**Clone this repo into your project and use as-is. Do NOT modify files.**

- ✅ Clone into your project directory
- ✅ Pull updates regularly: `git pull origin main`
- ✅ Report bugs via GitHub issues (mention `@claude` for automated assistance)
- ❌ Never modify infrastructure files

## 🚀 Quick Start for AI Agents

After cloning this repository:

### Decoupled Testing Infrastructure (Zero Project Modification)
```bash
npm install
npm run build

# Analyze any project
node dist/cli/index.js analyze /path/to/your/project

# Generate comprehensive tests
node dist/cli/index.js test /path/to/your/project

# Run tests with coverage
node dist/cli/index.js run /path/to/your/project --coverage
```
This maintains tests externally while providing complete testing infrastructure that updates via `git pull`.

## 🎯 What This Project Does

This infrastructure helps you:
- **Set up comprehensive testing** in under 10 minutes
- **Support both JavaScript/TypeScript and Python** projects automatically
- **Generate test templates** for your specific framework (React, Vue, Express, FastAPI, Django, etc.)
- **Achieve >80% test coverage** with provided templates and patterns
- **Integrate with CI/CD** platforms like GitHub Actions

## 📖 For AI Agents: Navigation Guide

1. **First Time?** Read `AI_AGENT_GUIDE.md` for stable, comprehensive project navigation
2. **Architecture Questions?** See `/docs/architecture/overview.md` for design philosophy
3. **Full Documentation Hub?** See `PROJECT_CONTEXT.md` for modular documentation structure
4. **User Guide?** See `/docs/user/getting-started.md` for complete usage examples

## 🔧 Installation & Setup

### Prerequisites
- Node.js 14+ 
- Git
- Target project runtime (Python 3.9+ for Python projects)

### Git Ownership Setup
If you encounter git dubious ownership warnings:
```bash
# Add the infrastructure directory to git safe.directory
git config --global --add safe.directory "$(pwd)"

# Or for the target project if needed
git config --global --add safe.directory "/path/to/your/project"
```

### Installation Options

#### For Testing Your Own Projects (Recommended)
Use the clean deployment branch that contains only the core infrastructure:
```bash
git clone -b deploy/clean https://github.com/SynidSweet/claude-testing-infrastructure.git
cd claude-testing-infrastructure
npm install
npm run build
```

#### For Contributing to the Infrastructure
Use the main branch with full development environment:
```bash
git clone https://github.com/SynidSweet/claude-testing-infrastructure.git
cd claude-testing-infrastructure
npm install
npm run build
```

2. **Analyze Your Project**
   ```bash
   node dist/cli/index.js analyze /path/to/your/project
   ```

3. **Generate Tests**
   ```bash
   node dist/cli/index.js test /path/to/your/project
   ```

4. **Run Tests with Coverage**
   ```bash
   node dist/cli/index.js run /path/to/your/project --coverage
   ```

5. **Watch Mode for Development**
   ```bash
   node dist/cli/index.js watch /path/to/your/project
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

2. **Analyze Project Structure**
   ```bash
   node dist/cli/index.js analyze /path/to/your/project
   ```

3. **Generate and Run Tests**
   ```bash
   node dist/cli/index.js test /path/to/your/project
   node dist/cli/index.js run /path/to/your/project --coverage
   ```

4. **Customize as Needed**
   - Modify test templates for project-specific needs
   - Add custom test utilities
   - Configure coverage thresholds
   - Set up CI/CD pipelines

## 🛠️ Available Commands

### Production CLI Commands
```bash
node dist/cli/index.js analyze <path>     # Analyze project structure
node dist/cli/index.js test <path>        # Generate comprehensive tests
node dist/cli/index.js run <path>         # Run generated tests
node dist/cli/index.js watch <path>       # Watch mode for development

# Additional options
node dist/cli/index.js test <path> --only-structural  # Skip AI generation
node dist/cli/index.js run <path> --coverage          # With coverage report
node dist/cli/index.js test <path> --config <file>    # Custom configuration
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
- [AI Agent Primary Guide](AI_AGENT_GUIDE.md) - **Protected & Stable**
- [AI Agent Legacy Guide](CLAUDE.md) - Working Document
- [User Guide](/docs/user/getting-started.md)
- [API Reference](/docs/api/interfaces.md)

---

*Built with ❤️ for AI agents and developers who value comprehensive testing*