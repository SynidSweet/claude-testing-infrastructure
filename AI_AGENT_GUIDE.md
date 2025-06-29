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

### Step 0: Check User Feedback (ITERATIVE TESTING PHASE)
```bash
# CRITICAL: Check for user-reported issues during testing phase
cat ~/Documents/testing-feedback.md 2>/dev/null || echo "No feedback file found - proceeding with normal usage"
```
**⚠️ IMPORTANT**: During the current iterative testing phase, always check `~/Documents/testing-feedback.md` for user-reported issues that need to be addressed before proceeding with development work.

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
```bash
# Check Claude CLI installation and authentication
claude --version
claude config get

# Verify Max subscription is active
claude usage

# Try structural tests only (no AI required)
node dist/cli/index.js test /path/to/project --only-structural

# Test AI functionality separately
node dist/cli/index.js analyze-gaps /path/to/project
```

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