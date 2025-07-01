# AI Agent Testing Infrastructure Guide v2.0

**🤖 PRIMARY ENTRY POINT: This file provides complete guidance for AI agents using this testing infrastructure.**

⚠️ **STABILITY NOTICE**: This file is protected and stable - designed specifically to not be modified by AI tools during sessions. Use this as your reliable reference point.

## 🚨 Major Update: Single Decoupled Approach

This infrastructure has been completely redesigned as a **single, focused solution** that:
- Never modifies target projects
- Generates comprehensive tests externally
- Uses AI for intelligent test generation
- Updates via simple `git pull`

## 🚀 How to Use This Infrastructure

### Step 0: Check User Feedback (PRODUCTION MAINTENANCE MODE)
```bash
# Check for any new user-reported issues (now in maintenance mode)
cat ~/Documents/testing-feedback.md 2>/dev/null || echo "No feedback file found - infrastructure is production-ready"
```
**✅ STATUS**: Infrastructure is now in production-ready maintenance mode. Major user-reported issues have been resolved (enhanced test content generation, Python import syntax errors fixed). Check feedback file for any new edge cases, but proceed with normal usage for all standard testing workflows.

### Step 1: Verify Prerequisites
```bash
# Check Node.js version (required: 18+)
node --version
# Should output: v18.x.x or higher

# Check Claude CLI (required for AI features)
claude --version
# Should output version info without errors

# Verify Claude CLI authentication (Max subscription required for AI features)
claude config get
# Should show your Claude configuration

# Verify Git is available (required for incremental features)
git --version
# Should output Git version info

# Check available disk space (tests can generate significant output)
df -h .
# Ensure several GB available for large projects
```

### Step 1: Clone this infrastructure
```bash
# Clone it anywhere - it works independently
git clone https://github.com/SynidSweet/claude-testing-infrastructure.git
cd claude-testing-infrastructure

# If you encounter git dubious ownership warnings, configure safe.directory
git config --global --add safe.directory "$(pwd)"
```

### Step 2: Install and build
```bash
npm install
npm run build
```

### Step 2.5: Verify Installation Success
```bash
# Ensure CLI is available after build (CRITICAL)
node dist/cli/index.js --version
# Should output: 2.0.0

# Test basic functionality
node dist/cli/index.js --help
# Should show command help without errors
```

### Step 3: Analyze your target project
```bash
# Basic analysis
node dist/cli/index.js analyze /path/to/your/project

# With output file
node dist/cli/index.js analyze /path/to/your/project --output analysis.json
```

### Step 4: Generate tests
```bash
# Generate all tests (structural + AI-powered logical)
node dist/cli/index.js test /path/to/your/project

# Only structural tests (no Claude CLI required)
node dist/cli/index.js test /path/to/your/project --only-structural

# Only logical tests (requires Claude CLI with Max subscription)
node dist/cli/index.js test /path/to/your/project --only-logical

# Generate logical tests in configurable batches (recommended for large projects)
node dist/cli/index.js generate-logical-batch /path/to/your/project --batch-size 10

# Resume interrupted batch processing
node dist/cli/index.js generate-logical-batch /path/to/your/project --resume

# With custom config
node dist/cli/index.js test /path/to/your/project --config my-config.json
```

### Step 5: Incremental updates (recommended for development)
```bash
# Smart test updates based on Git changes (cost-efficient)
node dist/cli/index.js incremental /path/to/your/project

# Preview changes without executing
node dist/cli/index.js incremental /path/to/your/project --dry-run

# Create baseline for future comparisons
node dist/cli/index.js incremental /path/to/your/project --baseline

# View statistics and history
node dist/cli/index.js incremental /path/to/your/project --stats
```

### Step 6: Watch mode (alternative for development)
```bash
# Auto-update tests as code changes
node dist/cli/index.js watch /path/to/your/project
```

## 📊 Key Features

### AI-Powered Test Generation
- Analyzes code structure and intent
- Generates meaningful test cases
- Handles edge cases automatically
- Creates both unit and integration tests

### Batched AI Processing ✅ NEW
- ✅ Configurable batch sizes (default: 10 tests per batch)
- ✅ State persistence for resumable processing
- ✅ Progress tracking and cost estimation per batch
- ✅ Iterative processing ideal for large projects
- ✅ Prevents timeout issues and provides better control

### Incremental Updates ✅ COMPLETED
- ✅ Detects code changes via Git with smart diff analysis
- ✅ Only regenerates affected tests (70-90% cost savings)
- ✅ Maintains test history and baseline management
- ✅ Cost-efficient AI usage with estimation and limits
- ✅ Complete state management in `.claude-testing/` directory

### Zero Project Modification
- All tests stored externally
- No changes to target codebase
- Clean separation of concerns
- Easy to update infrastructure

### Multi-Language Support
**JavaScript/TypeScript** (Confidence: High)
- ✅ React - Complete component and hook testing
- ✅ Vue - Component and composable testing  
- ✅ Angular - Component and service testing
- ✅ Node.js/Express - API and middleware testing
- ✅ Next.js - Page and API route testing
- ⚠️ Svelte - Basic support (community patterns)

**Python** (Confidence: High)
- ✅ FastAPI - Complete API and dependency testing
- ✅ Flask - Application and blueprint testing
- ✅ Django - Model, view, and form testing
- ✅ Pytest - Native test framework integration
- ⚠️ Streamlit - Basic support (custom patterns)

**Test Frameworks** (Built-in)
- ✅ Jest - Full integration with coverage
- ✅ Vitest - Compatible patterns
- ✅ Pytest - Native Python support
- ⚠️ Mocha/Chai - Basic template support

**Language-specific best practices and patterns automatically applied**

## 🎯 Common Usage Patterns

### New Project Setup
```bash
# Analyze and generate initial test suite
node dist/cli/index.js test /path/to/new/project

# Create initial baseline for incremental updates
node dist/cli/index.js incremental /path/to/new/project --baseline

# Set up incremental development workflow
node dist/cli/index.js incremental /path/to/new/project --dry-run
```

### Existing Project Enhancement
```bash
# Analyze current test coverage
node dist/cli/index.js analyze /path/to/project --format markdown

# Generate missing tests incrementally (cost-efficient)
node dist/cli/index.js incremental /path/to/project

# View update statistics and history
node dist/cli/index.js incremental /path/to/project --stats
```

### Large Project AI Test Generation (Batched Processing)
```bash
# Start batched AI test generation (ideal for 50+ files)
node dist/cli/index.js generate-logical-batch /path/to/large/project --batch-size 10

# Continue processing next batch (after previous batch completes)
node dist/cli/index.js generate-logical-batch /path/to/large/project

# Resume if interrupted (preserves state across sessions)
node dist/cli/index.js generate-logical-batch /path/to/large/project --resume

# Check current progress and cost statistics
node dist/cli/index.js generate-logical-batch /path/to/large/project --stats

# Preview batches without executing (cost estimation)
node dist/cli/index.js generate-logical-batch /path/to/large/project --dry-run

# Clean up state and start fresh
node dist/cli/index.js generate-logical-batch /path/to/large/project --clean

# Process with cost limits per batch
node dist/cli/index.js generate-logical-batch /path/to/large/project --cost-limit 2.00

# Use smaller batches for complex files or budget constraints
node dist/cli/index.js generate-logical-batch /path/to/large/project --batch-size 5
```

### CI/CD Integration
```yaml
# In your GitHub Actions workflow
- name: Incremental Test Generation
  run: |
    node dist/cli/index.js incremental . --cost-limit 5.00
    node dist/cli/index.js run . --coverage

# Alternative: Full generation for critical branches
- name: Full Test Generation
  if: github.ref == 'refs/heads/main'
  run: |
    node dist/cli/index.js test . --only-structural
    node dist/cli/index.js run . --coverage
```

## 🧪 Test Execution

### Understanding Test Separation

The Claude Testing Infrastructure generates tests in a completely separate `.claude-testing/` directory within your target project. This design provides several key benefits:

- **Independence**: Tests run independently of your project's configuration
- **No conflicts**: Avoids conflicts with existing test setups
- **Clean separation**: Easy to manage, update, or remove generated tests
- **Version control**: Simple to include/exclude from git (.gitignore)

### Running Generated Tests

#### Method 1: Using the Infrastructure Runner (Recommended)
```bash
# Run all generated tests with coverage
node dist/cli/index.js run /path/to/your/project --coverage

# Run tests without coverage
node dist/cli/index.js run /path/to/your/project

# Run with specific reporter
node dist/cli/index.js run /path/to/your/project --reporter junit

# Generate coverage in multiple formats
node dist/cli/index.js run /path/to/your/project --coverage --format html,json
```

#### Method 2: Direct Execution from .claude-testing Directory
```bash
# Navigate to the generated tests
cd /path/to/your/project/.claude-testing

# For JavaScript/TypeScript projects with Jest
npx jest

# With coverage
npx jest --coverage

# For Python projects with pytest
pytest

# With coverage
pytest --cov=../src --cov-report=html
```

#### Method 3: NPM Scripts Integration
Add to your project's `package.json`:
```json
{
  "scripts": {
    "test:ai": "cd .claude-testing && jest",
    "test:ai:coverage": "cd .claude-testing && jest --coverage",
    "test:all": "npm test && npm run test:ai"
  }
}
```

### CI/CD Pipeline Integration

#### GitHub Actions Example
```yaml
name: AI-Generated Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      # Run your existing tests
      - name: Run Project Tests
        run: npm test
      
      # Run AI-generated tests separately
      - name: Run AI-Generated Tests
        run: |
          cd .claude-testing
          npm install
          npm test -- --coverage
      
      # Or use the infrastructure runner
      - name: Run Tests via Infrastructure
        run: |
          git clone https://github.com/SynidSweet/claude-testing-infrastructure.git
          cd claude-testing-infrastructure
          npm install && npm run build
          node dist/cli/index.js run ../${{ github.workspace }} --coverage
```

#### GitLab CI Example
```yaml
stages:
  - test
  - ai-test

test:project:
  stage: test
  script:
    - npm install
    - npm test

test:ai-generated:
  stage: ai-test
  script:
    - cd .claude-testing
    - npm install
    - npm test -- --coverage
  artifacts:
    reports:
      coverage_report:
        coverage_format: cobertura
        path: .claude-testing/coverage/cobertura-coverage.xml
```

### Jest Configuration for External Tests

If you need to customize Jest behavior for the generated tests, create `.claude-testing/jest.config.js`:

```javascript
module.exports = {
  // Point to the parent project's source files
  rootDir: '..',
  
  // Look for tests only in .claude-testing
  testMatch: ['<rootDir>/.claude-testing/**/*.test.{js,ts}'],
  
  // Coverage from parent src directory
  collectCoverageFrom: [
    '<rootDir>/src/**/*.{js,ts,jsx,tsx}',
    '!<rootDir>/src/**/*.d.ts',
  ],
  
  // Use parent's node_modules
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  
  // Coverage output in .claude-testing
  coverageDirectory: '<rootDir>/.claude-testing/coverage',
};
```

### Python pytest Configuration

For Python projects, create `.claude-testing/pytest.ini`:

```ini
[tool:pytest]
# Test discovery
testpaths = .
python_files = test_*.py *_test.py

# Coverage settings
addopts = 
    --cov=../src
    --cov-report=html:.claude-testing/htmlcov
    --cov-report=term-missing
    --cov-report=xml:.claude-testing/coverage.xml

# Import parent project
pythonpath = ..
```

### Troubleshooting Test Execution

#### Common Issues and Solutions

**Issue: "Module not found" errors**
```bash
# Solution 1: Install dependencies in .claude-testing
cd .claude-testing
npm install

# Solution 2: Use parent's node_modules
export NODE_PATH=../node_modules
jest
```

**Issue: Python import errors**
```bash
# Solution 1: Add parent to Python path
export PYTHONPATH="${PYTHONPATH}:$(dirname $(pwd))"
pytest

# Solution 2: Use pytest's pythonpath
pytest --pythonpath=..
```

**Issue: Coverage not finding source files**
```bash
# For Jest: Ensure correct rootDir in jest.config.js
# For pytest: Use absolute paths
pytest --cov=$(realpath ../src)
```

**Issue: Tests timing out**
```bash
# Increase Jest timeout
jest --testTimeout=10000

# For pytest
pytest --timeout=30
```

### Benefits of Separated Test Execution

1. **No Configuration Conflicts**: Your project's test configuration remains untouched
2. **Independent Updates**: Regenerate tests without affecting existing test suite
3. **Gradual Adoption**: Run AI tests alongside existing tests during migration
4. **Clear Metrics**: Separate coverage reports for AI-generated vs manual tests
5. **Easy Cleanup**: Simply delete `.claude-testing/` to remove all generated tests

### Best Practices

- **Regular Regeneration**: Use incremental updates to keep tests current
- **Coverage Monitoring**: Track coverage trends separately for AI tests
- **CI Integration**: Run AI tests in parallel with existing tests
- **Local Development**: Use watch mode for automatic test updates
- **Version Control**: Decide whether to commit `.claude-testing/` based on team preferences

## 🔧 Configuration

Create `.claude-testing.config.json` in your **target project root** (not in the infrastructure directory):

```json
{
  "include": ["src/**/*.{js,ts,jsx,tsx,py}"],
  "exclude": ["**/*.test.*", "**/*.spec.*"],
  "testFramework": "jest",
  "aiModel": "claude-3",
  "features": {
    "coverage": true,
    "edgeCases": true,
    "integrationTests": true
  }
}
```

## 💡 How It Works

1. **Analysis Phase**
   - Scans project structure
   - Detects languages and frameworks
   - Identifies testable components
   - Creates dependency graph

2. **Generation Phase**
   - Creates structural tests (immediate)
   - Queues AI tasks for logical tests
   - Optimizes for batch processing
   - Manages token usage

3. **Execution Phase**
   - Runs generated tests
   - Collects coverage data
   - Identifies gaps
   - Suggests improvements

4. **Incremental Updates**
   - Monitors file changes
   - Analyzes Git diffs
   - Updates only affected tests
   - Maintains consistency

## 🚨 Important Notes

1. **This is infrastructure** - Clone and use, don't modify
2. **AI features require Claude CLI** - Install Claude CLI and verify Max subscription authentication
3. **Tests are stored in `.claude-testing/`** - Add to target project's .gitignore
4. **Pull updates regularly** - `git pull origin main` in the infrastructure directory
5. **Always use `node dist/cli/index.js`** - Commands are correct as shown above
6. **Git repository required** - Target projects must be Git repositories for incremental features
7. **Cost considerations** - AI generation uses Claude API (estimate ~$0.50-$5.00 per medium project)
8. **System requirements** - Node.js 18+, 2GB+ RAM, several GB disk space for large projects

## ❓ Troubleshooting

### "Command not found" or "Module not found"
```bash
# Ensure you're in the infrastructure directory
cd claude-testing-infrastructure

# Verify build succeeded
node dist/cli/index.js --version
# Should show: 2.0.0

# If build is missing, rebuild
npm run build

# Always use full path to CLI
node dist/cli/index.js --help
```

### "No tests generated" or "Project path does not exist"
```bash
# Check analysis results first
node dist/cli/index.js analyze /path/to/project

# Verify the target project path exists
ls -la /path/to/project

# Check file patterns in target project config
cat /path/to/project/.claude-testing.config.json
```

### "AI tests not generating" or Claude CLI errors

**Common Issue**: AI logical test generation hangs or times out

**Root Cause**: Most often due to Claude CLI authentication issues

**🔧 Claude CLI Setup Guide**:

**Step 1: Install Claude Code**
```bash
# Claude Code must be installed from: https://claude.ai/code
# After installation, verify it's available in PATH:
claude --version
# Should show: Claude Code 1.0.35 or similar
```

**Step 2: Authenticate Claude CLI (CRITICAL)**
```bash
# IMPORTANT: Authentication MUST be done interactively first time
# Option 1: Run any interactive Claude command
claude chat

# Option 2: Open Claude Code application and sign in

# Verify authentication succeeded:
claude config get
# Should show your configuration without login prompts
```

**Step 3: Test Claude CLI Functionality**
```bash
# 1. Quick version check
claude --version
# Should complete immediately

# 2. Test help command (shouldn't prompt for auth)
claude --help
# Should show help without authentication prompts

# 3. Test actual AI query (final verification)
echo "What is 2+2?" | claude
# Should respond with "4" without hanging

# 4. If any of the above hang or prompt for auth:
# - Kill the process (Ctrl+C)
# - Run Claude Code interactively: claude chat
# - Complete authentication flow
# - Try tests again
```

**Step 4: Common Authentication Solutions**
```bash
# Issue: "Claude CLI not authenticated" error
# Solution: Always authenticate interactively first
claude chat  # Complete the login flow

# Issue: Commands hang indefinitely
# Solution: This indicates auth issues
# 1. Kill hanging process (Ctrl+C)
# 2. Check if claude process is still running: ps aux | grep claude
# 3. Kill any zombie claude processes: killall claude
# 4. Re-authenticate interactively

# Issue: "Unknown model: sonnet" warnings
# Solution: These are harmless - infrastructure handles model aliases
# Supported: opus, sonnet, haiku (automatically mapped to full names)
```

**Workarounds**:
```bash
# Option 1: Use structural tests only (no AI required)
node dist/cli/index.js test /path/to/project --only-structural

# Option 2: Test gap analysis without AI generation
node dist/cli/index.js analyze-gaps /path/to/project

# Option 3: Use dry-run mode to preview generation
node dist/cli/index.js test /path/to/project --only-logical --dry-run
```

**Enhanced Error Handling** (v2.0 improvements):
The infrastructure now provides detailed error messages for common issues:
- `AIAuthenticationError`: Clear guidance on Claude CLI authentication
- `AITimeoutError`: Specific timeout information with troubleshooting steps
- `AIRateLimitError`: Rate limit guidance with model suggestions
- `AINetworkError`: Network connectivity troubleshooting

**Model Recognition**:
- Aliases supported: "opus", "sonnet", "haiku" 
- Automatically mapped to full model identifiers
- Warnings about "Unknown model" are harmless - models are validated

**Timeout Configuration**:
```bash
# Default: 15 minutes per AI task
# For complex projects, increase timeout:
node dist/cli/index.js test /path/to/project --timeout 1800000  # 30 minutes

# Timeouts prevent infinite hangs and provide clear error messages:
# - "AI generation timed out after X seconds"
# - Includes troubleshooting suggestions
# - Recommends batch size reduction or timeout increase
```

**Progress Tracking** (NEW):
The infrastructure now shows real-time progress during AI generation:
- Authentication validation status
- Per-file generation progress
- Estimated time remaining
- Clear indication of current operation phase

### "Build failed" or TypeScript errors
```bash
# Clean rebuild
rm -rf dist/ node_modules/
npm install
npm run build

# Check Node.js version (must be 18+)
node --version
```

### CLI shows errors but commands work
```bash
# This is normal - Commander.js displays errors for --version and --help
# The commands work correctly despite error messages
node dist/cli/index.js --version  # Shows version but also logs error
node dist/cli/index.js --help     # Shows help but also logs error

# These errors are harmless and expected behavior
```

### Large project handling
```bash
# For projects with >10k files, use selective patterns
echo '{"include": ["src/**/*.{js,ts,jsx,tsx,py}"], "exclude": ["node_modules/**", "dist/**", "build/**"]}' > .claude-testing.config.json

# Monitor memory usage for very large projects
node dist/cli/index.js analyze /path/to/large/project --only-structural
```

### Network or AI generation failures
```bash
# If Claude API is unreachable, use structural tests only
node dist/cli/index.js test /path/to/project --only-structural

# Check API cost before large operations
node dist/cli/index.js analyze-gaps /path/to/project --dry-run

# Set cost limits for safety
node dist/cli/index.js incremental /path/to/project --cost-limit 5.00
```

## 📝 Complete Working Example

Here's a complete example from clone to successful test execution:

```bash
# Step 0: Prerequisites
node --version    # Must be 18+
claude --version  # Must be available
claude config get # Must show valid config

# Step 1: Clone infrastructure
git clone https://github.com/SynidSweet/claude-testing-infrastructure.git
cd claude-testing-infrastructure

# Step 2: Build
npm install
npm run build

# Step 2.5: Verify build
node dist/cli/index.js --version  # Should show: 2.0.0

# Step 3: Use with your project
node dist/cli/index.js analyze ../my-target-project
node dist/cli/index.js test ../my-target-project --only-structural
node dist/cli/index.js run ../my-target-project --coverage

# Check results
ls -la ../my-target-project/.claude-testing/
```

**Success indicators:**
- ✅ Analysis shows detected languages/frameworks
- ✅ Test generation creates `.claude-testing/` directory
- ✅ Tests run and produce coverage reports
- ✅ No "command not found" or "module not found" errors

## 🎯 Summary for AI Agents

1. **Clone** the infrastructure (don't modify target projects)
2. **Analyze** to understand the codebase
3. **Generate** comprehensive tests with AI assistance
4. **Watch** for changes during development
5. **Update** infrastructure with git pull

All commands work externally - no project modification required.

## 📚 Navigation for AI Agents

### **Entry Point Hierarchy:**
1. **`AI_AGENT_GUIDE.md`** (this file) - Stable primary entry point
2. **`PROJECT_CONTEXT.md`** - Comprehensive project context and navigation
3. **`/docs/ai-agents/navigation.md`** - Detailed navigation guide
4. **`README.md`** - Traditional entry point

### **Additional Resources:**
- **Architecture**: `/docs/architecture/overview.md` - System design
- **Development**: `/docs/development/conventions.md` - Coding patterns
- **Features**: `/docs/features/` - Component documentation
- **Troubleshooting**: `/docs/user/troubleshooting.md` - Common issues

---

**Version**: 2.0.0 | **Architecture**: Decoupled-only | **AI**: AI-Agent-powered | **Status**: Production Ready | **Entry Point**: Protected & Stable