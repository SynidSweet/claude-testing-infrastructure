# Claude Testing Infrastructure v2.0 - AI Agent Guide

⚠️ **NOTICE**: This file has been superseded by `AI_AGENT_GUIDE.md` as the primary, stable entry point. This file is preserved for compatibility but may be modified during AI sessions.

**🤖 AI AGENTS: Use `AI_AGENT_GUIDE.md` as your primary entry point for stable guidance.**

## 🚨 Major Update: Single Decoupled Approach

This infrastructure has been completely redesigned as a **single, focused solution** that:
- Never modifies target projects
- Generates comprehensive tests externally
- Uses AI for intelligent test generation
- Updates via simple `git pull`

## 🚀 How to Use This Infrastructure

### Step 0: Verify Prerequisites
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
```

### Step 1: Clone this infrastructure
```bash
# Clone it anywhere - it works independently
git clone https://github.com/SynidSweet/claude-testing-infrastructure.git
cd claude-testing-infrastructure
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
- JavaScript/TypeScript (React, Vue, Angular, Node.js)
- Python (FastAPI, Flask, Django)
- Automatic framework detection
- Language-specific best practices

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
5. **Always use `node dist/cli/index.js`** - Don't use `npx claude-testing` (not published to npm)

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

---

**Version**: 2.0.0 | **Architecture**: Decoupled-only | **AI**: Claude-powered