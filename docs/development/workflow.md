# Development Workflow

*Complete setup and development practices for the Claude Testing Infrastructure*

*Last updated: 2025-07-02 | Fixed ModuleSystemAnalyzer test failures - improved mock sequencing in Jest tests and enhanced module detection logic*

## 🔒 CRITICAL: Infrastructure Usage

**This is testing infrastructure - clone into your project and use as-is:**

- ✅ **Clone** this repo anywhere (works independently of target projects)
- ✅ **Use** without modifying any infrastructure files
- ✅ **Pull** updates regularly: `git pull origin main`
- ✅ **Report** bugs via GitHub issues (mention `@claude` for automated assistance)
- ❌ **NEVER** modify files in this testing infrastructure

## Getting Started

### Prerequisites
- **Node.js**: 18.0.0 or higher (for infrastructure)
- **Git**: For cloning and updates
- **Target runtime**: Python 3.9+ for Python projects being tested

### Initial Setup
```bash
# 1. Clone the infrastructure
git clone https://github.com/SynidSweet/claude-testing-infrastructure.git
cd claude-testing-infrastructure

# 2. Install dependencies and build
npm install
npm run build

# 3. Verify installation (clean output expected)
node dist/cli/index.js --version
node dist/cli/index.js --help
```

### Quick Verification
```bash
# Test with a sample project
node dist/cli/index.js analyze /path/to/any/project
node dist/cli/index.js test /path/to/any/project --only-structural
node dist/cli/index.js run /path/to/any/project
```

## Production CLI Commands

### Core Workflow
```bash
# 1. Analyze project structure
node dist/cli/index.js analyze /path/to/project [--output analysis.json] [--format json|markdown|console]

# 2. Preview test generation (recommended)
node dist/cli/index.js test /path/to/project --dry-run [--verbose]

# 3. Generate comprehensive tests
node dist/cli/index.js test /path/to/project [--config config.json] [--only-structural|--only-logical]

# 4. Run tests with coverage
node dist/cli/index.js run /path/to/project [--coverage] [--framework jest|pytest] [--watch]

# 5. Analyze gaps for AI generation
node dist/cli/index.js analyze-gaps /path/to/project [--format json|markdown|text] [--threshold 3]
```

### Advanced Options
```bash
# Watch mode for development
node dist/cli/index.js watch /path/to/project

# Coverage with thresholds
node dist/cli/index.js run /path/to/project --coverage --threshold "statements:80,branches:70"

# Generate JUnit reports for CI/CD
node dist/cli/index.js run /path/to/project --junit --coverage
```

## Development Environment Setup

### For Infrastructure Development
```bash
# Clone for development
git clone https://github.com/SynidSweet/claude-testing-infrastructure.git
cd claude-testing-infrastructure

# Install dependencies
npm install

# Development build (watch mode)
npm run dev

# Run infrastructure tests
npm test
npm run test:coverage

# Lint and format
npm run lint
npm run format
```

### Environment Variables
```bash
# .env file for development
LOG_LEVEL=debug
DEBUG=claude-testing:*

# For AI features (Phase 5.3) - Claude Code CLI Integration
# No API key needed if using Claude Code CLI with Max subscription
# ANTHROPIC_API_KEY=sk-...  # Only needed for direct API access

# Timeout configuration for complex AI operations
BASH_DEFAULT_TIMEOUT_MS=900000  # 15 minutes default
BASH_MAX_TIMEOUT_MS=1800000     # 30 minutes maximum

# For testing different scenarios
TEST_PROJECT_PATH=/path/to/test/project
COVERAGE_THRESHOLD=80
```

## Testing Strategy

### Infrastructure Testing
```bash
# Run full test suite (current status: 114/116 passing ✅)
npm test

# Watch mode during development
npm run test:watch

# Coverage report
npm run test:coverage

# Specific test files
npm test -- --testPathPattern="ProjectAnalyzer"

# Run specific component tests
npm test -- tests/generators/TestTemplateEngine.test.ts
npm test -- tests/analyzers/TestGapAnalyzer.test.ts
```

### Test Suite Status
- **Current**: 325/371 core tests passing (88% success rate) with ModuleSystemAnalyzer improvements
- **Core Infrastructure**: All critical functionality tests pass perfectly
- **ModuleSystemAnalyzer**: 65% test pass rate (13/20 tests passing) with core file analysis logic validated
- **Template Generation**: Enhanced React templates with comprehensive testing-library imports
- **Model Recognition**: Fixed integration between AITaskPreparation and model-mapping system
- **Framework Detection**: Auto-framework resolution ("auto" → specific framework) fully operational
- **CI/CD Pipeline**: Major blocking issues resolved for reliable GitHub Actions execution

### Generated Test Validation
```bash
# Test structural generation only
node dist/cli/index.js test ./examples/test-examples --only-structural

# Validate generated tests run successfully
node dist/cli/index.js run ./examples/test-examples

# Check coverage reports
node dist/cli/index.js run ./examples/test-examples --coverage

# Test mixed project validation (JavaScript + Python)
npm test -- --testPathPattern="mixed-test-harness.test.ts"

# Test individual mixed project fixtures
node dist/cli/index.js analyze tests/fixtures/validation-projects/mixed-minimal
node dist/cli/index.js test tests/fixtures/validation-projects/mixed-complex
```

## Development Practices

### Git Workflow
```bash
# Feature development
git checkout -b feature/new-adapter
git add src/adapters/new-adapter.ts
git commit -m "feat: add support for new framework"
git push origin feature/new-adapter

# Create pull request
gh pr create --title "Add support for new framework" --body "Description..."
```

### Code Quality
```bash
# Before committing
npm run lint:fix
npm run format
npm test

# TypeScript checking
npx tsc --noEmit

# Build verification
npm run build
```

### Release Process
1. **Version bump**: Update `package.json` version
2. **Build**: `npm run build`
3. **Test**: `npm test` (all tests must pass)
4. **Tag**: `git tag v2.x.x`
5. **Publish**: Automated via GitHub Actions

## Debugging Approaches

### Verbose Logging
```bash
# Enable debug logging
DEBUG=claude-testing:* node dist/cli/index.js analyze /path/to/project

# Specific component debugging
DEBUG=claude-testing:analyzer node dist/cli/index.js analyze /path/to/project
DEBUG=claude-testing:generator node dist/cli/index.js test /path/to/project
DEBUG=claude-testing:runner node dist/cli/index.js run /path/to/project
```

### Common Debugging Scenarios
```bash
# Project not detected properly
node dist/cli/index.js analyze /path/to/project --verbose

# Tests not generating
node dist/cli/index.js test /path/to/project --debug

# Test execution failing
node dist/cli/index.js run /path/to/project --debug --verbose

# Coverage issues
node dist/cli/index.js run /path/to/project --coverage --debug
```

### Step-by-Step Verification
```bash
# 1. Verify project detection
node dist/cli/index.js analyze /path/to/project --format json

# 2. Check generated test structure
ls -la /path/to/project/.claude-testing/

# 3. Validate test syntax
npx eslint /path/to/project/.claude-testing/**/*.test.js
python -m py_compile /path/to/project/.claude-testing/**/*.py

# 4. Run tests individually
cd /path/to/project/.claude-testing && npm test
cd /path/to/project/.claude-testing && python -m pytest
```

## Performance Optimization

### Build Performance
```bash
# Incremental builds
npm run dev  # Uses tsc --watch

# Clean builds
npm run prebuild  # Cleans dist/
npm run build
```

### Test Performance
```bash
# Parallel test execution
npm test -- --maxWorkers=4

# Specific test suites
npm test -- tests/analyzers/
npm test -- tests/generators/

# AI Agent Validation Tests
npm run test:ai-validation      # Full validation suite (20 min timeout)
npm run test:ai-quick          # Critical tests only
npm run validation:report      # Generate validation report
npm run validation:production  # Production readiness check
```

### AI Agent Validation Workflow

The infrastructure now includes comprehensive validation for AI agent functionality:

```bash
# 1. Run connectivity tests (verify Claude CLI integration)
npm run test:ai-validation -- --testNamePattern="connectivity"

# 2. Run quality validation tests
npm run test:ai-validation -- --testNamePattern="quality"

# 3. Run full end-to-end validation
npm run test:ai-validation -- --testNamePattern="production"

# 4. Generate comprehensive report
npm run validation:report > validation-results.md
```

**Validation Coverage**:
- AI generation hanging detection (15-minute timeouts)
- Model recognition (sonnet/haiku/opus aliases)
- Test quality metrics (assertions vs TODOs)
- End-to-end workflow validation
- Production readiness gates (70% quality, 90% success rate)

## Troubleshooting

### Common Issues

1. **"Command not found"**
   ```bash
   # Ensure you're in the infrastructure directory
   cd claude-testing-infrastructure
   npm run build
   ```

2. **"TypeScript errors"**
   ```bash
   # Check TypeScript configuration
   npx tsc --noEmit
   npm run lint
   ```

3. **"Tests not generating"**
   ```bash
   # Verify project analysis
   node dist/cli/index.js analyze /path/to/project --verbose
   
   # Check file permissions
   ls -la /path/to/project/.claude-testing/
   ```

4. **"Coverage not working"**
   ```bash
   # Verify test runner
   node dist/cli/index.js run /path/to/project --debug
   
   # Check coverage configuration
   cat /path/to/project/.claude-testing/jest.config.js
   ```

## See Also
- 📖 **Development Conventions**: [`./conventions.md`](./conventions.md)
- 📖 **Important Gotchas**: [`./gotchas.md`](./gotchas.md)
- 📖 **Commands Reference**: [`../reference/commands.md`](../reference/commands.md)
- 📖 **User Getting Started**: [`../user/getting-started.md`](../user/getting-started.md)