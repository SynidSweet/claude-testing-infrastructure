# AI Agent Guide - START HERE

**🤖 AI AGENTS: This is your ONLY entry point. Read this file completely before starting any work.**

## 📍 Important: Which File to Read

- **READ THIS FILE**: `/CLAUDE.md` (you're reading it now!)
- **IGNORE**: Other CLAUDE.md files in subdirectories - they're implementation details
- **THIS IS THE SINGLE SOURCE OF TRUTH** for AI agents using this infrastructure

## 🚀 How to Use This Infrastructure (Complete Instructions)

### Step 1: Clone this infrastructure into your project
```bash
# From your project root directory:
git clone https://github.com/SynidSweet/claude-testing-infrastructure.git
```

### Step 2: Choose your approach based on your needs

#### Option A: Template-Based (Copies tests INTO your project)
```bash
cd claude-testing-infrastructure/ai-testing-template
npm install
npm run init:auto  # Fully automated - no prompts!
```

#### Option B: Decoupled (Tests OUTSIDE your project)
```bash
cd claude-testing-infrastructure/decoupled-testing-suite
npm install
npm run discover  # Analyzes without modifying your project
```

### Step 3: Verify it worked
```bash
# For template-based:
npm test

# For decoupled:
npm run test:target
```

**That's it! Everything is automated. No user interaction required.**

## 📊 When to Use Each Approach

| Scenario | Use Template-Based | Use Decoupled |
|----------|-------------------|---------------|
| New project | ✅ | ❌ |
| Existing project with no tests | ✅ | ✅ |
| Existing project with tests | ❌ | ✅ |
| Need to modify project structure | ✅ | ❌ |
| Strict no-modification policy | ❌ | ✅ |
| Want tests inside project | ✅ | ❌ |
| Want tests outside project | ❌ | ✅ |

## 🎯 Common Commands (All Non-Interactive!)

### Template-Based Commands
```bash
# Automated setup with smart defaults
npm run init:auto

# Preset configurations
npm run init:minimal       # Basic unit tests only
npm run init:recommended   # Unit + integration tests (most common)
npm run init:comprehensive # Full testing pyramid

# Preview without making changes
npm run preview
```

### Decoupled Commands
```bash
# Discover and analyze project
npm run discover

# Run tests against target
npm run test:target

# Update test configuration
npm run update:config
```

### Custom Configuration
```bash
# Override specific aspects while keeping automation
npm run init:auto -- --frameworks "jest,playwright" --ci github --structure separate

# Available flags:
# --frameworks: jest,vitest,playwright,cypress,pytest
# --ci: github,gitlab,circle,none
# --structure: separate,colocated,both
# --features: coverage,visual,performance,a11y,database
# --dry-run: Preview without changes
```

## 💡 Confidence Scoring

The automated system includes intelligent confidence scoring:

- **High Confidence (>80%)**: Clear project structure, recognized frameworks
  - Example: React app with package.json, clear dependencies
  - Action: Applies full recommended setup automatically

- **Medium Confidence (50-80%)**: Partial detection, some ambiguity
  - Example: Mixed signals, unclear project structure
  - Action: Applies conservative defaults, focuses on basics

- **Low Confidence (<50%)**: Minimal information available
  - Example: Empty project, no clear indicators
  - Action: Applies minimal setup, just essentials

## 🔧 Supported Technologies

### JavaScript/TypeScript
- **Frameworks**: React, Vue, Angular, Next.js, Express, Fastify, NestJS
- **Test Runners**: Jest, Vitest, Mocha
- **E2E**: Playwright, Cypress
- **Tools**: ESLint, Prettier, TypeScript

### Python
- **Frameworks**: FastAPI, Flask, Django
- **Test Runners**: pytest, unittest
- **Tools**: Black, isort, mypy, coverage.py

## 🚨 Important Notes

1. **This is infrastructure** - Clone and use, don't modify
2. **Everything is automated** - No prompts or user interaction
3. **Pull updates regularly** - `git pull origin main` for latest features
4. **Report issues** - Create GitHub issues, mention `@claude` for AI assistance

## ❓ Quick Troubleshooting

### "Command not found"
```bash
# Make sure you're in the right directory
cd claude-testing-infrastructure/ai-testing-template
# or
cd claude-testing-infrastructure/decoupled-testing-suite

# Install dependencies
npm install
```

### "No tests found"
```bash
# For template-based, ensure init completed
npm run init:auto

# For decoupled, ensure discovery ran
npm run discover
```

### "Permission denied"
```bash
# Fix permissions
chmod +x scripts/*.js
```

## 🎯 Summary for AI Agents

1. **Clone** the infrastructure into your project
2. **Choose** template-based (modifies project) or decoupled (external tests)
3. **Run** the automated commands - no interaction needed
4. **Test** to verify everything works

All commands are fully automated. No prompts. No user interaction. Just run and go.

---

**Remember**: When instructed to "set up testing", this is the infrastructure to use. Always start by reading this file.