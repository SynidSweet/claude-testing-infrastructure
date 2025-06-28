# Getting Started with Claude Testing Infrastructure

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
- **Node.js 18+** installed
- **Git** installed  
- Your project in **JavaScript/TypeScript** or **Python**

### Step 1: Get the Infrastructure
```bash
# Clone into your project or a separate directory
git clone https://github.com/YourOrg/claude-testing-infrastructure.git
cd claude-testing-infrastructure

# Install and build
npm install
npm run build
```

### Step 2: Analyze Your Project
```bash
# Analyze any project (shows what we detected)
npx claude-testing analyze /path/to/your/project

# Save analysis to file for review
npx claude-testing analyze /path/to/your/project --output analysis.json --format json
```

### Step 3: Generate Tests
```bash
# Generate comprehensive test suite
npx claude-testing test /path/to/your/project

# Generate only structural tests (faster, no AI required)
npx claude-testing test /path/to/your/project --only-structural
```

### Step 4: Run Tests
```bash
# Run all generated tests
npx claude-testing run /path/to/your/project

# Run with coverage reporting
npx claude-testing run /path/to/your/project --coverage

# Run in watch mode during development
npx claude-testing run /path/to/your/project --watch
```

### Step 5: Analyze Test Gaps (NEW in v2.0)
```bash
# Analyze gaps in test coverage with beautiful reporting
npx claude-testing analyze-gaps /path/to/your/project

# Generate detailed Markdown report
npx claude-testing analyze-gaps /path/to/your/project --format markdown --output gaps.md --include-details

# Get structured JSON data for CI/CD integration
npx claude-testing analyze-gaps /path/to/your/project --format json --output gaps.json
```

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
npx claude-testing test ./my-react-app

# Output: ./my-react-app/.claude-testing/
# ├── setupTests.js
# ├── __mocks__/
# └── code/
#     └── (mirror of your src/ with .test.js files)

# Run tests
npx claude-testing run ./my-react-app --coverage
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
npx claude-testing test ./my-api

# Output: ./my-api/.claude-testing/
# ├── conftest.py
# ├── fixtures/
# └── code/
#     └── (mirror of your app/ with test_*.py files)

# Run tests
npx claude-testing run ./my-api --coverage
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
npx claude-testing analyze ./full-stack-app/frontend
npx claude-testing analyze ./full-stack-app/backend

# Generate tests for each
npx claude-testing test ./full-stack-app/frontend
npx claude-testing test ./full-stack-app/backend

# Run tests for each
npx claude-testing run ./full-stack-app/frontend --coverage
npx claude-testing run ./full-stack-app/backend --coverage
```

## 📊 Understanding the Output

### Analysis Results
```bash
npx claude-testing analyze ./my-project --verbose
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
npx claude-testing run ./my-project --coverage
```

Provides:
- **Test results**: Pass/fail counts, execution time
- **Coverage reports**: Line, branch, function coverage
- **JUnit XML**: For CI/CD integration (use `--junit` flag)
- **Watch mode**: Continuous testing during development

## 🔧 Configuration Options

### Project-Specific Configuration
Create `.claude-testing.config.json` in your project:

```json
{
  "include": ["src/**/*.{js,ts,jsx,tsx,py}"],
  "exclude": ["**/*.test.*", "**/*.spec.*", "**/node_modules/**"],
  "testFramework": "jest",
  "coverage": {
    "threshold": {
      "statements": 80,
      "branches": 70,
      "functions": 80,
      "lines": 80
    }
  },
  "features": {
    "mocking": true,
    "integration": true,
    "edgeCases": true
  }
}
```

### Command-Line Options
```bash
# Analysis options
--output <file>          # Save analysis results
--format json|markdown   # Output format
--verbose               # Show detailed information

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
npx claude-testing test your-project --only-structural
```

**"Project analysis failed"**
```bash
# Run with debug output
npx claude-testing analyze your-project --verbose

# Check project structure
ls package.json requirements.txt pyproject.toml
```

**"Tests failing after generation"**
```bash
# Install project dependencies first
cd your-project && npm install  # or pip install -r requirements.txt

# Run tests with verbose output
npx claude-testing run your-project --verbose
```

### Debug Mode
```bash
# Enable debug logging for any command
DEBUG=* npx claude-testing analyze your-project
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