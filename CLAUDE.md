# Claude Testing Infrastructure v2.0 - AI Agent Guide

**🤖 AI AGENTS: This is your ONLY entry point. Read this file completely before starting any work.**

## 🚨 Major Update: Single Decoupled Approach

This infrastructure has been completely redesigned as a **single, focused solution** that:
- Never modifies target projects
- Generates comprehensive tests externally
- Uses AI for intelligent test generation
- Updates via simple `git pull`

## 🚀 How to Use This Infrastructure

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

### Step 3: Analyze your target project
```bash
# Basic analysis
npx claude-testing analyze /path/to/your/project

# With output file
npx claude-testing analyze /path/to/your/project --output analysis.json
```

### Step 4: Generate tests
```bash
# Generate all tests (structural + AI-powered logical)
npx claude-testing test /path/to/your/project

# Only structural tests (no AI required)
npx claude-testing test /path/to/your/project --only-structural

# Only logical tests (requires Claude)
npx claude-testing test /path/to/your/project --only-logical

# With custom config
npx claude-testing test /path/to/your/project --config my-config.json
```

### Step 5: Watch mode (for development)
```bash
# Auto-update tests as code changes
npx claude-testing watch /path/to/your/project
```

## 📊 Key Features

### AI-Powered Test Generation
- Analyzes code structure and intent
- Generates meaningful test cases
- Handles edge cases automatically
- Creates both unit and integration tests

### Incremental Updates
- Detects code changes via Git
- Only regenerates affected tests
- Maintains test history
- Cost-efficient AI usage

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
npx claude-testing test /path/to/new/project

# Set up watch mode for ongoing development
npx claude-testing watch /path/to/new/project
```

### Existing Project Enhancement
```bash
# Analyze current test coverage
npx claude-testing analyze /path/to/project --format markdown

# Generate missing tests
npx claude-testing test /path/to/project --update
```

### CI/CD Integration
```yaml
# In your GitHub Actions workflow
- name: Generate Tests
  run: |
    npx claude-testing test . --only-structural
    npx claude-testing test . --coverage
```

## 🔧 Configuration

Create `.claude-testing.config.json` in your project root:

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
2. **AI features require Claude API** - Set ANTHROPIC_API_KEY
3. **Tests are stored in `.claude-testing/`** - Add to .gitignore
4. **Pull updates regularly** - `git pull origin main`

## ❓ Troubleshooting

### "Command not found"
```bash
# Ensure you're in the infrastructure directory
cd claude-testing-infrastructure

# Rebuild if needed
npm run build
```

### "No tests generated"
```bash
# Check analysis results first
npx claude-testing analyze /path/to/project

# Verify file patterns in config
cat .claude-testing.config.json
```

### "AI tests not generating"
```bash
# Check API key
echo $ANTHROPIC_API_KEY

# Try structural tests only
npx claude-testing test /path/to/project --only-structural
```

## 🎯 Summary for AI Agents

1. **Clone** the infrastructure (don't modify target projects)
2. **Analyze** to understand the codebase
3. **Generate** comprehensive tests with AI assistance
4. **Watch** for changes during development
5. **Update** infrastructure with git pull

All commands work externally - no project modification required.

---

**Version**: 2.0.0 | **Architecture**: Decoupled-only | **AI**: Claude-powered