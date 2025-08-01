# Getting Started with Claude Testing Infrastructure

*Last updated: 2025-07-04 | Updated by: /document command | Added init-config command for easy setup*

*A comprehensive guide for end users to quickly set up testing for their projects*

## 🎯 What is Claude Testing Infrastructure?

The Claude Testing Infrastructure is an AI-powered, decoupled testing solution that:
- **Analyzes your existing project** automatically
- **Generates comprehensive tests** without modifying your code
- **Supports multiple languages and frameworks** (JavaScript, TypeScript, Python)
- **Runs tests with coverage reports** and CI/CD integration
- **Updates via `git pull`** to continuously improve testing strategies

## 🚀 Quick Start (5 Minutes)

### Prerequisites
- **Node.js 18+** installed (verify with `node --version`)
- **Git** installed  
- Your project in **JavaScript/TypeScript** or **Python**
- **Claude CLI** installed and authenticated (for AI features - verify with `claude --version`)

### Step 1: Get the Infrastructure
```bash
# Clone into your project or a separate directory
git clone https://github.com/YourOrg/claude-testing-infrastructure.git
cd claude-testing-infrastructure

# Configure git ownership if needed (common for AI agents)
git config --global --add safe.directory "$(pwd)"

# Install and build
npm install
npm run build
```

### Step 2: Initialize Configuration
```bash
# Auto-detect project type and create configuration
node dist/src/cli/index.js init-config /path/to/your/project

# Use a specific template (react-typescript, vue-typescript, etc.)
node dist/src/cli/index.js init-config /path/to/your/project --template react-typescript

# Interactive setup with customization
node dist/src/cli/index.js init-config /path/to/your/project --interactive

# List all available templates
node dist/src/cli/index.js init-config --list
```

### Step 3: Analyze Your Project
```bash
# Analyze any project (shows what we detected)
node dist/src/cli/index.js analyze /path/to/your/project

# Detailed analysis with verbose output
node dist/src/cli/index.js analyze /path/to/your/project --verbose

# Save analysis to file for review
node dist/src/cli/index.js analyze /path/to/your/project --output analysis.json --format json

# Validate configuration file (if you have .claude-testing.config.json)
node dist/src/cli/index.js analyze /path/to/your/project --validate-config
```

### Step 4: Generate Tests
```bash
# Generate comprehensive test suite
node dist/src/cli/index.js test /path/to/your/project

# Generate with detailed progress information
node dist/src/cli/index.js test /path/to/your/project --verbose

# Generate only structural tests (faster, no AI required)
node dist/src/cli/index.js test /path/to/your/project --only-structural
```

### Step 5: Run Tests
```bash
# Run all generated tests
node dist/src/cli/index.js run /path/to/your/project

# Run with coverage reporting
node dist/src/cli/index.js run /path/to/your/project --coverage

# Run in watch mode during development
node dist/src/cli/index.js run /path/to/your/project --watch
```

### Step 6: Analyze Test Gaps (NEW in v2.0)
```bash
# Analyze gaps in test coverage with beautiful reporting
node dist/src/cli/index.js analyze-gaps /path/to/your/project

# Generate detailed Markdown report
node dist/src/cli/index.js analyze-gaps /path/to/your/project --format markdown --output gaps.md --include-details

# Get structured JSON data for CI/CD integration
node dist/src/cli/index.js analyze-gaps /path/to/your/project --format json --output gaps.json
```

### Step 7: AI-Powered Logical Test Generation (NEW in v2.0)
```bash
# Generate intelligent logical tests using Claude Code CLI
node dist/src/cli/index.js generate-logical /path/to/your/project

# Use latest model with automatic fallback for Max subscription
node dist/src/cli/index.js generate-logical /path/to/your/project --model opus --timeout 1800

# Budget-controlled generation with cost optimization
node dist/src/cli/index.js generate-logical /path/to/your/project --budget 5.00 --min-complexity 3

# Dry run to see what would be generated
node dist/src/cli/index.js generate-logical /path/to/your/project --dry-run --output ./ai-analysis
```

**Timeout Configuration**: The system automatically configures extended timeouts (15-30 minutes) for complex AI analysis while preserving your standard 2-minute timeout for other Claude Code operations through session isolation.

## 🎓 Common Use Cases

### React Frontend Project
```bash
# Your project structure:
# my-react-app/
# ├── package.json
# ├── src/
# │   ├── components/
# │   └── App.js
# └── public/

# Generate tests
node dist/src/cli/index.js test ./my-react-app

# Output: ./my-react-app/.claude-testing/
# ├── setupTests.js
# ├── __mocks__/
# └── code/
#     └── (mirror of your src/ with .test.js files)

# Run tests
node dist/src/cli/index.js run ./my-react-app --coverage
```

### Python FastAPI Backend
```bash
# Your project structure:
# my-api/
# ├── requirements.txt
# ├── main.py
# └── app/
#     ├── models/
#     └── routes/

# Generate tests
node dist/src/cli/index.js test ./my-api

# Output: ./my-api/.claude-testing/
# ├── conftest.py
# ├── fixtures/
# └── code/
#     └── (mirror of your app/ with test_*.py files)

# Run tests
node dist/src/cli/index.js run ./my-api --coverage
```

### Full-Stack Project (JavaScript + Python)
```bash
# Your project structure:
# full-stack-app/
# ├── frontend/          # React app
# │   └── package.json
# └── backend/           # FastAPI
#     └── requirements.txt

# Analyze both parts
node dist/src/cli/index.js analyze ./full-stack-app/frontend
node dist/src/cli/index.js analyze ./full-stack-app/backend

# Generate tests for each
node dist/src/cli/index.js test ./full-stack-app/frontend
node dist/src/cli/index.js test ./full-stack-app/backend

# Run tests for each
node dist/src/cli/index.js run ./full-stack-app/frontend --coverage
node dist/src/cli/index.js run ./full-stack-app/backend --coverage
```

## 📊 Understanding the Output

### Analysis Results
```bash
node dist/src/cli/index.js analyze ./my-project --verbose
```

Shows:
- **Languages detected**: JavaScript, TypeScript, Python with confidence levels
- **Frameworks found**: React, Vue, Express, FastAPI, Django, etc.
- **Package managers**: npm, yarn, pip, poetry
- **Existing tests**: What testing is already set up
- **Project complexity**: File counts, sizes, structure

### Generated Test Structure
```
your-project/
└── .claude-testing/          # All tests stored here (never modifies your code)
    ├── setupTests.js          # Test configuration
    ├── __mocks__/             # Auto-generated mocks
    │   ├── fs.js
    │   └── axios.js
    └── code/                  # Mirror of your src/ with tests
        └── src/
            ├── App.test.js    # Component tests
            ├── utils.test.js  # Utility function tests
            └── api.test.js    # API tests
```

### Test Execution Results
```bash
node dist/src/cli/index.js run ./my-project --coverage
```

Provides:
- **Test results**: Pass/fail counts, execution time
- **Coverage reports**: Line, branch, function coverage
- **JUnit XML**: For CI/CD integration (use `--junit` flag)
- **Watch mode**: Continuous testing during development

## 🔧 Configuration Options

### Project-Specific Configuration ✅ NEW
Create `.claude-testing.config.json` in your project:

```json
{
  "include": ["src/**/*.{js,ts,jsx,tsx,py}"],
  "exclude": ["**/*.test.*", "**/*.spec.*", "**/node_modules/**"],
  "testFramework": "jest",
  "aiModel": "claude-3-5-sonnet-20241022",
  "features": {
    "coverage": true,
    "edgeCases": true,
    "integrationTests": true
  },
  "ai": {
    "maxCost": 5.00
  }
}
```

### Configuration Validation ✅ NEW
```bash
# Validate your configuration file
node dist/src/cli/index.js analyze /path/to/your/project --validate-config

# Example output:
# 📋 Configuration Validation Results
# =====================================
# ✓ Configuration is valid
# 
# ⚠️  Warnings:
#   • High incremental cost limit may result in unexpected AI charges
```

📖 **Complete Configuration Guide**: [`/docs/configuration.md`](../configuration.md) - Full reference with examples for all project types

### Command-Line Options
```bash
# Analysis options
--output <file>          # Save analysis results
--format json|markdown   # Output format
--verbose               # Show detailed information
--validate-config       # Validate .claude-testing.config.json

# Test generation options
--only-structural       # Skip AI-powered logical tests
--only-logical         # Only generate AI-powered tests
--update               # Update existing tests based on changes
--config <file>        # Use custom configuration

# Test execution options
--coverage             # Generate coverage report
--watch               # Run in watch mode
--junit               # Generate JUnit XML reports
--threshold <value>   # Set coverage threshold
```

## 🚨 Important Notes

### Zero Project Modification
- **Your code is never changed** - all tests are stored in `.claude-testing/`
- **Safe to use on production code** - no risk of breaking changes
- **Easy to remove** - just delete the `.claude-testing/` directory

### Framework Support
Currently supported:
- **JavaScript/TypeScript**: React, Vue, Angular, Express, Next.js
- **Python**: FastAPI, Django, Flask, pytest, unittest
- **Test Runners**: Jest, Vitest, pytest
- **Package Managers**: npm, yarn, pnpm, pip, poetry, pipenv

### Performance Considerations
- **Large projects**: Use `--only-structural` for faster generation
- **Incremental updates**: Re-run commands to update only changed files
- **Parallel execution**: Test runners support parallel execution automatically

## 🆘 Troubleshooting

### Common Issues

**"No tests found to execute"**
```bash
# Check if tests were generated
ls -la your-project/.claude-testing/

# Regenerate tests if missing
node dist/src/cli/index.js test your-project --only-structural
```

**"Project analysis failed"**
```bash
# Run with debug output
node dist/src/cli/index.js analyze your-project --verbose

# Check project structure
ls package.json requirements.txt pyproject.toml
```

**"Tests failing after generation"**
```bash
# Install project dependencies first
cd your-project && npm install  # or pip install -r requirements.txt

# Run tests with verbose output
node dist/src/cli/index.js run your-project --verbose
```

### Debug Mode
```bash
# Enable debug logging for any command
DEBUG=* node dist/src/cli/index.js analyze your-project
```

## 🚀 Next Steps

1. **Review Generated Tests**: Check `.claude-testing/` directory for generated tests
2. **Customize Configuration**: Add `.claude-testing.config.json` for project-specific settings
3. **Integrate with CI/CD**: Use `--junit` flag to generate reports for your CI system
4. **Update Regularly**: Run `git pull` in the infrastructure directory for improvements
5. **Report Issues**: Use GitHub issues with `@claude` mention for automated assistance

## 📚 Additional Resources

- **Architecture Guide**: [`/docs/architecture/overview.md`](../architecture/overview.md)
- **CLI Reference**: [`/docs/reference/commands.md`](../reference/commands.md)
- **AI Agent Guide**: [`/docs/ai-agents/navigation.md`](../ai-agents/navigation.md)
- **Development Workflow**: [`/docs/development/workflow.md`](../development/workflow.md)