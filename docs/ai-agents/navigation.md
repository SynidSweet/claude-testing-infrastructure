# AI Agent Navigation Guide

*Last updated: 2025-06-29 | Updated by: /refactor-that command | Architecture aligned with current single decoupled approach*

Welcome to the AI-First Testing Infrastructure project. This guide helps AI agents navigate and understand the codebase efficiently.

⚠️ **ENTRY POINT UPDATE**: Primary AI agent entry point is now `AI_AGENT_GUIDE.md` (protected & stable). This file provides detailed navigation guidance.

## 🎯 Quick Start for AI Agents

### What This Project Is
A **single decoupled testing infrastructure** that provides:
- **External testing suite** - Generates comprehensive tests without modifying target projects
- **AI-powered test generation** - Intelligent logical test creation using Claude integration
- **Multi-language support** - JavaScript/TypeScript and Python through language adapters (not code duplication)

### First Steps
1. **Start with**: `/AI_AGENT_GUIDE.md` for stable, protected entry point guidance
2. Read `/docs/architecture/overview.md` to understand the system design
3. Review `PROJECT_CONTEXT.md` for comprehensive project details
4. Check `/docs/planning/refactoring-tasks.md` for current improvement priorities
5. Choose the appropriate workflow based on your task

## 🗺️ Project Structure Navigation

```
claude-testing/
├── 📋 Documentation (Start Here)
│   ├── AI_AGENT_GUIDE.md       # Primary, protected entry point
│   ├── AI_AGENT_GUIDE.template.md # Backup for restoration
│   ├── PROJECT_CONTEXT.md       # Comprehensive project overview
│   ├── docs/architecture/       # System design philosophy
│   ├── docs/planning/          # Current improvement roadmap
│   └── CLAUDE.md               # Legacy AI navigation guide
│
├── 🚀 Core Infrastructure
│   ├── src/cli/               # Command-line interface
│   ├── src/analyzers/         # Project analysis engine
│   ├── src/generators/        # Test generation system
│   ├── src/runners/           # Test execution system
│   ├── src/ai/               # AI integration components
│   ├── src/state/            # Incremental testing state
│   ├── src/utils/            # Shared utilities
│   └── src/workflows/        # AI-enhanced workflows
│
├── 📚 Documentation
│   ├── docs/features/        # Component documentation
│   ├── docs/development/     # Coding conventions
│   ├── docs/user/           # User guides
│   └── docs/api/            # API reference
│
└── 🧪 Testing & Examples
    ├── tests/               # Infrastructure test suite
    ├── templates/           # External test templates
    └── examples/           # Usage demonstrations
```

## 🎯 Common AI Agent Tasks

### Task: Add testing to a JavaScript/TypeScript project
```bash
# Navigate to project infrastructure
cd claude-testing-infrastructure

# Build the infrastructure
npm install && npm run build

# Analyze target project
node dist/src/cli/index.js analyze /path/to/target/project

# Generate comprehensive tests
node dist/src/cli/index.js test /path/to/target/project

# Run tests with coverage
node dist/src/cli/index.js run /path/to/target/project --coverage
```

### Task: Add testing to a Python project
```bash
# Same workflow - language adapter automatically detects Python
node dist/src/cli/index.js analyze /path/to/python/project
node dist/src/cli/index.js test /path/to/python/project --only-structural
node dist/src/cli/index.js run /path/to/python/project --coverage
```

### Task: Understand the architecture
1. Start with `/docs/architecture/overview.md`
2. Focus on the "Single Decoupled Approach" section
3. Understand the Language Adapter pattern
4. Review the AI Agent Entry Point Architecture

### Task: Work on refactoring
1. Check `/docs/planning/REFACTORING_PLAN.md` for active tasks
2. Review completed refactoring achievements in changelog
3. Follow established patterns from successful refactoring examples
4. Test with the comprehensive test suite (116/116 tests passing)

## 🔑 Critical Concepts

### Language Adapters (NOT Duplication)
```typescript
// This pattern appears for both JS and Python - it's intentional!
interface IProjectAnalyzer {
    analyze(projectPath: string): Promise<ProjectAnalysis>
    detectLanguages(projectPath: string): Promise<DetectedLanguage[]>
    detectFrameworks(projectPath: string): Promise<DetectedFramework[]>
}

// Each language has specific implementation
class JavaScriptAnalyzer implements IProjectAnalyzer { /* JS-specific */ }
class PythonAnalyzer implements IProjectAnalyzer { /* Python-specific */ }
```

### Single Decoupled Approach
- **External testing**: Never modifies target projects
- **Infrastructure updates**: Improves via `git pull`
- **AI-powered**: Intelligent test generation with cost optimization
- **Multi-language**: Supports JavaScript/TypeScript and Python

## 🚫 Common Misconceptions

### ❌ WRONG: "There's duplicate code for JS and Python"
✅ **RIGHT**: Each language needs specific handling through adapters

### ❌ WRONG: "We should use npx claude-testing commands"
✅ **RIGHT**: Always use `node dist/src/cli/index.js` - infrastructure is not published to npm

### ❌ WRONG: "Complex detection logic should be simplified"
✅ **RIGHT**: It handles real-world edge cases intentionally

### ❌ WRONG: "CLAUDE.md is the primary entry point"
✅ **RIGHT**: Use `AI_AGENT_GUIDE.md` as the stable, protected primary entry point

## 📍 Key File Locations

### Core Logic
- **Primary Entry**: `AI_AGENT_GUIDE.md` - Protected AI agent guidance
- **CLI Interface**: `src/cli/index.ts` - Main command interface
- **Project Analysis**: `src/analyzers/ProjectAnalyzer.ts` - Language/framework detection
- **Test Generation**: `src/generators/TestGenerator.ts` - Structural test creation
- **Test Execution**: `src/runners/TestRunner.ts` - Framework-agnostic test running

### AI Integration
- **Gap Analysis**: `src/analyzers/TestGapAnalyzer.ts` - Orchestrator for gap analysis (438 lines)
- **AI Components**: `src/ai/` - Claude integration and cost estimation
- **AI Workflows**: `src/workflows/AIEnhancedTestingWorkflow.ts` - Complete AI testing workflows

### Configuration
- **CLI Commands**: `src/cli/commands/` - All command implementations
- **State Management**: `src/state/` - Incremental testing and change detection
- **Templates**: `src/generators/templates/` - Test generation templates

### Documentation
- **Agent Guides**: `/docs/ai-agents/` - AI agent specific guidance
- **Architecture**: `/docs/architecture/overview.md` - System design
- **Features**: `/docs/features/` - Component documentation

## 🛠️ Development Workflow

### Before Making Changes
1. Start with the protected entry point (`AI_AGENT_GUIDE.md`)
2. Understand the single decoupled architecture
3. Check if changes are language-specific (use adapters) or shared
4. Review existing patterns in similar files
5. Consider impact on both JavaScript/TypeScript AND Python support

### Testing Changes
```bash
# TypeScript infrastructure tests
npm test

# Coverage verification
npm run test:coverage

# Build verification
npm run build

# CLI integration test
node dist/src/cli/index.js --help
```

### Adding New Features
1. Determine if it's language-specific or shared
2. Implement for one language first (usually JavaScript/TypeScript)
3. Add corresponding support for other languages
4. Update templates and documentation
5. Test with example projects from both ecosystems

## 🎯 Current Priorities

From `/docs/planning/REFACTORING_PLAN.md`:
1. **✅ COMPLETED**: TestGapAnalyzer god class decomposition
2. **✅ COMPLETED**: Function naming refactoring for AI clarity
3. **✅ COMPLETED**: Stable AI agent entry point system
4. **Current**: Split GapReportGenerator god class
5. **Next**: Standardize error handling patterns

## 💡 Tips for Success

### Understanding the Codebase
- Start with protected documentation before diving into code
- Trace through one complete flow (e.g., analyze → test → run process)
- Understand the language adapter pattern deeply
- Respect the single decoupled approach design

### Making Changes
- Small, focused commits with clear descriptions
- Test after each change using the comprehensive test suite
- Update documentation immediately after implementation
- Consider both languages when changing shared code
- Always use the correct CLI commands (`node dist/src/cli/index.js`)

### Common Patterns
```bash
# Project detection pattern (in code)
if (await this.hasFile('package.json')) {
    // JavaScript/TypeScript project logic
} else if (await this.hasFile('setup.py') || await this.hasFile('pyproject.toml')) {
    // Python project logic
}

# CLI usage pattern (for users)
node dist/src/cli/index.js analyze /path/to/project
node dist/src/cli/index.js test /path/to/project
node dist/src/cli/index.js run /path/to/project --coverage
```

## 🔄 Quick Commands

### Most Used Commands
```bash
# Analyze project structure and capabilities
node dist/src/cli/index.js analyze /path/to/project

# Generate comprehensive tests
node dist/src/cli/index.js test /path/to/project

# Run tests with coverage analysis
node dist/src/cli/index.js run /path/to/project --coverage

# Incremental updates (cost-efficient for development)
node dist/src/cli/index.js incremental /path/to/project

# Watch mode for continuous development
node dist/src/cli/index.js watch /path/to/project

# AI-powered gap analysis
node dist/src/cli/index.js analyze-gaps /path/to/project

# Check all available commands
node dist/src/cli/index.js --help
```

### Build and Development
```bash
# Install dependencies and build
npm install
npm run build

# Run infrastructure tests
npm test

# Check code quality
npm run lint

# See all available npm scripts
npm run
```

## 📚 Further Reading

- **For architecture questions**: See `/docs/architecture/overview.md`
- **For project details**: See `PROJECT_CONTEXT.md`
- **For current work**: See `/docs/planning/REFACTORING_PLAN.md`
- **For stable guidance**: Always start with `AI_AGENT_GUIDE.md`

Remember: This project supports JavaScript/TypeScript AND Python through intentional language adapter design, not duplication. The infrastructure never modifies target projects and improves via `git pull` updates. When in doubt, check the protected entry point documentation!