# AI Agent Navigation Guide

Welcome to the AI-First Testing Infrastructure project. This guide helps AI agents navigate and understand the codebase efficiently.

## 🎯 Quick Start for AI Agents

### What This Project Is
A **dual-approach testing infrastructure** that provides:
1. **Template-based testing** - Quick setup by copying tests into projects
2. **Decoupled testing suite** - External testing that never modifies target code

Both support JavaScript/TypeScript AND Python projects through **language adapters** (not code duplication).

### First Steps
1. Read `/docs/architecture/overview.md` to understand the system design
2. Review `PROJECT_CONTEXT.md` for comprehensive project details
3. Check `/docs/planning/refactoring-tasks.md` for current improvement priorities
4. Choose the appropriate approach based on your task

## 🗺️ Project Structure Navigation

```
claude-testing/
├── 📋 Documentation (Start Here)
│   ├── docs/architecture/       # System design philosophy
│   ├── PROJECT_CONTEXT.md       # Comprehensive project overview
│   ├── docs/planning/          # Current improvement roadmap
│   └── CLAUDE.md               # This file - AI navigation guide
│
├── 🚀 Template-Based Approach
│   └── ai-testing-template/
│       ├── scripts/            # Initialization logic
│       ├── templates/          # Test templates by language
│       ├── examples/           # Working implementations
│       └── CLAUDE.md          # Approach-specific guide
│
├── 🔧 Decoupled Testing Suite
│   └── decoupled-testing-suite/
│       ├── core/              # Discovery and execution
│       ├── config/            # Configuration management
│       ├── templates/         # External test templates
│       └── CLAUDE.md          # Approach-specific guide
│
└── 📚 Planning Documents/
    └── Various implementation plans and specifications
```

## 🎯 Common AI Agent Tasks

### Task: Add testing to a JavaScript/TypeScript project
```bash
# Navigate to template approach
cd ai-testing-template

# Review available templates
ls templates/javascript/

# Run initialization
npm run init
```

### Task: Add testing to a Python project
```bash
# For existing projects (safer)
cd decoupled-testing-suite
npm run discover

# For new projects
cd ai-testing-template
npm run init
```

### Task: Understand the architecture
1. Start with `/docs/architecture/overview.md`
2. Focus on the "Why Two Approaches?" section
3. Understand the Language Adapter pattern (✅ Implemented 2025-06-27)
4. Review ADRs (Architecture Decision Records)

### Task: Work on refactoring
1. Check `/docs/planning/refactoring-tasks.md` (Major milestone completed 2025-06-27!)
2. Review `ADAPTER_IMPLEMENTATION_SUMMARY.md` for adapter details
3. See `ADAPTER_MIGRATION_GUIDE.md` for migration instructions
4. Test with `shared/examples/adapter-usage.js`

## 🔑 Critical Concepts

### Language Adapters (NOT Duplication)
```javascript
// This pattern appears for both JS and Python - it's intentional!
interface IProjectAdapter {
    detect(projectPath: string): Promise<boolean>
    analyze(projectPath: string): Promise<Analysis>
    configure(analysis: Analysis): Promise<Config>
}

// Each language has specific implementation
class JavaScriptAdapter implements IProjectAdapter { /* JS-specific */ }
class PythonAdapter implements IProjectAdapter { /* Python-specific */ }
```

### Two Approaches Serve Different Needs
- **Template-based**: Modifies project, quick setup, full control
- **Decoupled**: Zero modification, updateable, version-safe
- **Both needed**: Different teams have different requirements

## 🚫 Common Misconceptions

### ❌ WRONG: "There's duplicate code for JS and Python"
✅ **RIGHT**: Each language needs specific handling through adapters

### ❌ WRONG: "We should merge the two approaches"
✅ **RIGHT**: They solve different problems for different users

### ❌ WRONG: "Complex detection logic should be simplified"
✅ **RIGHT**: It handles real-world edge cases intentionally

## 📍 Key File Locations

### Core Logic
- **Initialization**: `ai-testing-template/scripts/init.js:26`
- **Project Detection**: `ai-testing-template/scripts/utils/fileSystem.js:257`
- **Discovery Engine**: `decoupled-testing-suite/core/discovery/project-discovery.js:74`

### Configuration
- **Schemas**: `decoupled-testing-suite/config/schemas/`
- **Adapters**: `decoupled-testing-suite/config/adapters/`
- **Templates**: Both approaches have `templates/` directories

### Documentation
- **Agent Guides**: `AGENT_README.md`, `AGENT_TEST_GUIDE.md`
- **Implementation Plans**: `Planning Documents/` directory

## 🛠️ Development Workflow

### Before Making Changes
1. Understand which approach you're working on
2. Check if it's language-specific (use adapters) or shared
3. Review existing patterns in similar files
4. Consider impact on both JavaScript AND Python support

### Testing Changes
```bash
# JavaScript/TypeScript projects
npm test
npm run test:coverage

# Python projects
pytest --cov

# Cross-platform verification
npm run verify:all
```

### Adding New Features
1. Determine if it's approach-specific or shared
2. Implement for one language first (usually JavaScript)
3. Add corresponding support for other language
4. Update templates and documentation
5. Test with example projects

## 🎯 Current Priorities

From `/docs/planning/refactoring-tasks.md`:
1. **Documentation**: Creating CLAUDE.md files (in progress)
2. **Adapter Pattern**: Implementing proper language adapters
3. **Boundaries**: Clear separation between approaches

## 💡 Tips for Success

### Understanding the Codebase
- Start with documentation before diving into code
- Trace through one complete flow (e.g., init process)
- Understand the adapter pattern deeply
- Respect the dual-approach design

### Making Changes
- Small, focused commits
- Test after each change
- Update documentation immediately
- Consider both languages when changing shared code

### Common Patterns
```javascript
// Project detection pattern
if (await this.hasFile('package.json')) {
    // JavaScript project logic
} else if (await this.hasFile('setup.py') || await this.hasFile('pyproject.toml')) {
    // Python project logic
}

// Adapter selection pattern
const adapter = await AdapterFactory.getAdapter(projectPath);
const analysis = await adapter.analyze();
const config = await adapter.configure(analysis);
```

## 🔄 Quick Commands

### Most Used Commands
```bash
# Initialize testing (template approach)
npm run init

# Discover project (decoupled approach)
npm run discover

# Run all tests
npm test

# Check code quality
npm run lint

# See all available commands
npm run
```

## 📚 Further Reading

- **For architecture questions**: See `/docs/architecture/overview.md`
- **For project details**: See `PROJECT_CONTEXT.md`
- **For current work**: See `/docs/planning/refactoring-tasks.md`
- **For approach-specific details**: See approach-specific `CLAUDE.md` files

Remember: This project supports BOTH JavaScript/TypeScript AND Python through intentional design, not duplication. When in doubt, check the architecture documentation!