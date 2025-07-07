# Development Workflow

*Complete setup and development practices for the Claude Testing Infrastructure*

*Last updated: 2025-07-07 | TypeScript Type Safety Improvements - Enhanced type safety in CLI commands and test infrastructure*

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

## Test Execution Strategy

### Test Suite Categories
The test suite is organized into three execution modes for different development scenarios:

#### 1. Fast Tests (`npm run test:fast`)
- **Purpose**: Quick feedback during development
- **Scope**: Unit tests for utils, generators, analyzers, and config modules
- **Timeout**: 5 seconds per test
- **Target time**: < 1 minute
- **Use when**: Making code changes, need rapid validation

#### 2. Core Tests (`npm run test:core`)
- **Purpose**: Infrastructure validation before commits
- **Scope**: All tests except AI validation and large fixture tests
- **Timeout**: 10 seconds per test
- **Target time**: < 2 minutes
- **Use when**: Before committing changes, validating functionality

#### 3. Full Tests (`npm run test:full`)
- **Purpose**: Comprehensive validation
- **Scope**: All tests including AI validation
- **Timeout**: 30 seconds per test
- **Target time**: < 10 minutes
- **Use when**: Before releases, after major changes

### Test Execution Guidelines
```bash
# During development - quick feedback
npm run test:fast

# Before commits - ensure stability (automatically run by pre-commit hooks)
npm run test:core

# Before releases - full validation
npm run test:full

# For AI validation specifically
npm run test:ai-validation

# Watch mode during development
npm run test:watch
```

### Timing-Sensitive Tests
Tests involving process monitoring and heartbeat detection have been configured with appropriate timeouts:
- Heartbeat monitoring tests: 30-second timeout
- Process reliability tests: 30-second timeout
- Standard tests: 10-second timeout (core) or 5-second timeout (fast)

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

# Production readiness validation
npm run validation:production
```

### Production Validation
```bash
# Comprehensive production readiness check
npm run validation:production

# Direct script execution
node scripts/production-readiness-check.js

# Check exit code for automation
npm run validation:production && echo "Production ready" || echo "Needs fixes"
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

## 🚀 Comprehensive CI/CD Testing Strategy

The Claude Testing Infrastructure implements a dual-testing strategy designed to provide comprehensive local validation while maintaining fast CI feedback loops:

### 📊 Testing Philosophy

**Dual-Environment Strategy**:
- **Local Development**: Comprehensive testing including AI validation
- **CI/CD Pipeline**: Core infrastructure tests with fast execution

### 🏠 Local Development Testing

**Full Test Suite** - All tests including AI validation:
```bash
# Complete local testing (includes AI validation)
npm test

# Pre-commit quality gates
npm run precommit  # Runs: lint + format + build + full tests

# Comprehensive with coverage
npm run test:coverage
```

**Local Testing Features**:
- ✅ AI validation tests run by default
- ✅ Claude CLI integration testing
- ✅ End-to-end workflow validation
- ✅ Test quality metrics and timeouts
- ✅ Production readiness checks

### ☁️ CI/CD Pipeline Testing

**Core Infrastructure Tests** - Fast, reliable CI execution:
```bash
# CI automatically skips AI tests (via Jest environment detection)
CI=true npm test

# Manual simulation of CI environment
SKIP_AI_TESTS=1 npm test
```

**CI Pipeline Features**:
- ✅ Multi-platform testing (Ubuntu, macOS)
- ✅ Multi-version Node.js support (18, 20)
- ✅ Automatic AI test exclusion
- ✅ Quality gates (lint, format, build)
- ✅ Security scanning
- ✅ Coverage reporting for PRs

### 🎯 Environment Detection

**Automatic CI Detection** (Jest Configuration):
```javascript
// AI tests are automatically skipped when:
// - CI=true (standard CI environment)
// - GITHUB_ACTIONS=true
// - Other CI environment variables detected
```

**Test Environment Utilities**:
```bash
# Check environment programmatically
node -e "
const { isClaudeCLIAvailable, isCIEnvironment } = require('./tests/utils/test-environment');
console.log('Claude CLI:', await isClaudeCLIAvailable());
console.log('CI Environment:', isCIEnvironment());
"
```

### 🔧 Pre-Commit Hooks

**Quality Gates** - Comprehensive local validation:
```bash
# Automatic pre-commit validation
git commit  # Triggers: precommit script

# Bypass for faster iteration
git commit --no-verify

# Manual quality check
npm run quality:check  # lint + format + build
```

**Pre-commit includes**:
- ESLint code quality checks
- Prettier format validation
- TypeScript compilation verification
- Complete test suite with AI validation

### 📈 Testing Metrics

**Current Status**:
- **Core Tests**: 329/358 passing (91.9% success rate)
- **Environment Handling**: ✅ Automatic CI detection
- **AI Validation**: ✅ Graceful skipping when unavailable
- **Quality Gates**: ✅ Pre-commit hooks enforced

**Coverage Goals**:
- Core infrastructure: 90%+ test coverage
- Critical paths: 100% test coverage
- AI validation: Comprehensive end-to-end testing

### 🛠️ Infrastructure Testing

```bash
# Run full test suite (current status: 329/358 passing ✅)
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
- **Current**: Generated test quality significantly improved with proper class detection and React configuration
- **Class Detection**: Added intelligent detection to differentiate classes from functions for proper instantiation
- **React Testing**: Enhanced setupTests.js with @testing-library/jest-dom imports and window.matchMedia mocks
- **Module Imports**: Fixed module existence tests for named-export-only modules
- **TypeScript Support**: Verified proper removal of .ts/.tsx extensions in generated test imports
- **Template Improvements**: Both TestTemplateEngine and JavaScriptEnhancedTemplates now generate valid tests
- **Impact**: Generated tests now compile and execute correctly across all project types

### Environment-Aware Test Execution

```bash
# Run tests with AI validation tests skipped (for CI environments)
SKIP_AI_TESTS=1 npm test

# Run full test suite including AI validation (requires Claude CLI)
npm test

# Check environment availability programmatically
node -e "
const { isClaudeCLIAvailable, isCIEnvironment } = require('./tests/utils/test-environment.ts');
console.log('Claude CLI:', await isClaudeCLIAvailable());
console.log('CI Environment:', isCIEnvironment());
"
```

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

5. **"jest-environment-jsdom cannot be found"**
   ```bash
   # This is a known issue for React projects
   # Jest 28+ requires explicit installation of jest-environment-jsdom
   # The infrastructure generates tests that may require this dependency
   
   # Temporary workaround for testing:
   cd /path/to/project/.claude-testing
   npm install --save-dev jest-environment-jsdom
   
   # This is tracked as a known limitation for React test generation
   ```

### CI/CD Troubleshooting

6. **"AI tests running in CI when they shouldn't"**
   ```bash
   # Verify CI environment detection
   CI=true node -e "
   const { isCIEnvironment } = require('./tests/utils/test-environment');
   console.log('CI detected:', isCIEnvironment());
   "
   
   # Check Jest configuration
   CI=true npm test -- --listTests | grep -c "ai-agents" || echo "AI tests correctly skipped"
   ```

7. **"Pre-commit hook not running"**
   ```bash
   # Check hook exists and is executable
   ls -la .husky/pre-commit
   chmod +x .husky/pre-commit
   
   # Test hook manually
   npm run precommit
   
   # Bypass if needed for emergency commits
   git commit --no-verify -m "emergency fix"
   ```

8. **"GitHub Actions failing on lint"**
   ```bash
   # Fix lint issues locally first
   npm run lint:fix
   npm run format
   
   # Verify clean before pushing
   npm run quality:check
   ```

9. **"CI tests passing but local tests failing"**
   ```bash
   # Ensure local environment matches CI
   CI=true npm test  # Simulate CI locally
   
   # Check if AI tests are the difference
   npm test  # Full local suite
   ```

10. **"Environment detection not working"**
   ```bash
   # Debug environment detection
   node -e "
   const env = require('./tests/utils/test-environment');
   console.log('Environment info:', env.getEnvironmentInfo());
   "
   
   # Reset cached values if needed
   node -e "
   const env = require('./tests/utils/test-environment');
   env.resetEnvironmentCache();
   console.log('Cache reset');
   "
   ```

## Pre-commit Hooks and CI/CD Workflow

### Local Development with Pre-commit Hooks

The project uses Husky for git hooks to ensure code quality before commits:

```bash
# Pre-commit hook automatically runs:
- npm run build       # Ensure TypeScript compiles
- npm test           # Run test suite  
- npm run lint       # Check code style (if configured)

# To skip hooks in emergency (use sparingly):
git commit --no-verify -m "Emergency fix"
```

### CI/CD Pipeline Structure

```yaml
# .github/workflows/main.yml runs:
1. Checkout code
2. Setup Node.js  
3. Install dependencies
4. Run build
5. Run tests
6. Run linting
7. Generate coverage reports
```

### Production Validation

Before deployment, run comprehensive validation:

```bash
# Full production readiness check
npm run validation:production

# Individual validation steps:
npm run build                    # Build validation
npm test                        # Test suite validation  
node dist/cli/index.js --version # CLI validation
```

### Troubleshooting CI/CD Issues

#### Pre-commit Hook Failures
```bash
# Reset hooks if corrupted
rm -rf .husky
npm run prepare  # Reinstalls hooks

# Debug specific failures
npm run build    # Check TypeScript errors
npm test -- --verbose  # Detailed test output
```

#### GitHub Actions Failures
1. Check Actions tab for specific error
2. Run failing command locally
3. Common issues:
   - Node version mismatch
   - Missing environment variables
   - Timeout in AI tests

### Best Practices

1. **Always commit buildable code** - Pre-commit hooks enforce this
2. **Fix test failures immediately** - Don't push broken tests
3. **Update snapshots carefully** - Review before committing
4. **Monitor CI status** - Address failures quickly
5. **Use production validation** - Before major releases

## See Also
- 📖 **Development Conventions**: [`./conventions.md`](./conventions.md)
- 📖 **Important Gotchas**: [`./gotchas.md`](./gotchas.md)
- 📖 **Commands Reference**: [`../reference/commands.md`](../reference/commands.md)
- 📖 **User Getting Started**: [`../user/getting-started.md`](../user/getting-started.md)