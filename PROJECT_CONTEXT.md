# Claude Testing Infrastructure - Project Context

*This is the navigation hub for the Claude Testing Infrastructure project. Detailed documentation has been organized into modular files for better maintainability.*

## 🚀 Quick Start

The Claude Testing Infrastructure provides two comprehensive testing solutions for JavaScript/TypeScript and Python projects:
1. **Template-based approach** - Copies testing infrastructure INTO your project for quick setup
2. **Decoupled approach** - Maintains testing OUTSIDE your project for zero modification

📖 **See details**: [`/docs/project/overview.md`](./docs/project/overview.md)

## 📁 Documentation Structure

### 🏗️ Architecture
- 📖 **System Overview**: [`/docs/architecture/overview.md`](./docs/architecture/overview.md) - Dual-approach design philosophy
- 📖 **Technical Stack**: [`/docs/architecture/technical-stack.md`](./docs/architecture/technical-stack.md) - Technologies and project structure
- 📖 **Dependencies**: [`/docs/architecture/dependencies.md`](./docs/architecture/dependencies.md) - External libraries and services
- 📖 **Key Insights**: [`/docs/architecture/insights.md`](./docs/architecture/insights.md) - Critical architectural decisions
- 📖 **Adapter Pattern**: [`/docs/architecture/adapter-pattern.md`](./docs/architecture/adapter-pattern.md) - Language adapter implementation

### 🎯 Project Information
- 📖 **Overview**: [`/docs/project/overview.md`](./docs/project/overview.md) - Purpose and success metrics
- 📖 **Changelog**: [`/docs/project/changelog.md`](./docs/project/changelog.md) - Recent updates and milestones
- 📖 **Navigation**: [`/docs/project/navigation.md`](./docs/project/navigation.md) - Where to find things

### 🔧 Development
- 📖 **Conventions**: [`/docs/development/conventions.md`](./docs/development/conventions.md) - Code standards and patterns
- 📖 **Workflow**: [`/docs/development/workflow.md`](./docs/development/workflow.md) - Setup and development practices
- 📖 **Gotchas**: [`/docs/development/gotchas.md`](./docs/development/gotchas.md) - Common pitfalls and constraints

### ✨ Features
- 📖 **Core Features**: [`/docs/features/core-features.md`](./docs/features/core-features.md) - User journeys and modules

### 📋 Planning
- 📖 **Roadmap**: [`/docs/planning/roadmap.md`](./docs/planning/roadmap.md) - Current priorities and future features
- 📖 **Refactoring Tasks**: [`/docs/planning/refactoring-tasks.md`](./docs/planning/refactoring-tasks.md) - Improvement priorities
- 📖 **Implementation Plans**: [`/docs/planning/implementation-plans.md`](./docs/planning/implementation-plans.md) - Detailed plan links

### 🤖 AI Agents
- 📖 **Navigation Guide**: [`/docs/ai-agents/navigation.md`](./docs/ai-agents/navigation.md) - Complete AI agent guide
- 📖 **Guidelines**: [`/docs/ai-agents/guidelines.md`](./docs/ai-agents/guidelines.md) - Best practices and anti-patterns
- 📖 **Migration Guide**: [`/docs/ai-agents/migration-guide.md`](./docs/ai-agents/migration-guide.md) - Adapter pattern migration

### 📚 Reference
- 📖 **Commands**: [`/docs/reference/commands.md`](./docs/reference/commands.md) - All available CLI commands

## 🎯 Current Status

**MVP COMPLETE ✅** - Both template-based and decoupled approaches are fully functional with all promised features implemented.

### Recent Achievements (2025-06-27)
- ✅ Created comprehensive CLAUDE.md navigation guides for AI agents
- ✅ Implemented Language Adapter Pattern with full backward compatibility
- ✅ All decoupled suite scripts implemented and tested
- ✅ Working demos available for both approaches

## 🚦 Getting Started

### For AI Agents
1. Start with [`/docs/ai-agents/navigation.md`](./docs/ai-agents/navigation.md) for comprehensive understanding
2. Review [`/docs/architecture/overview.md`](./docs/architecture/overview.md) to understand the dual-approach design
3. Check [`/docs/planning/roadmap.md`](./docs/planning/roadmap.md) for current priorities

### For Developers
1. Choose your approach:
   - **Template-based**: `cd ai-testing-template && npm run init`
   - **Decoupled**: `cd decoupled-testing-suite && npm run discover`
2. Follow the approach-specific CLAUDE.md guide
3. Use [`/docs/reference/commands.md`](./docs/reference/commands.md) for command reference

## 🔑 Key Principles

1. **Two approaches serve different needs** - Don't try to merge them
2. **Language adapters are intentional** - JavaScript and Python need different handling
3. **Complexity handles real-world cases** - Don't oversimplify detection logic
4. **Documentation is modular** - Each topic has its own focused file

## 🔒 CRITICAL: Infrastructure Usage Rules

**This is testing infrastructure - clone and use, don't modify:**

- ✅ **CLONE** into your project and use as external infrastructure
- ✅ **PULL** updates regularly: `git pull origin main`
- ✅ **REPORT** bugs via GitHub issues (mention `@claude` for automated assistance)
- ❌ **NEVER** modify infrastructure files
- ❌ **DON'T** commit changes to this testing suite

## 🔗 Quick Links

- **Working Examples**: 
  - Template approach: `ai-testing-template/examples/`
  - Decoupled approach: `examples/decoupled-demo/`
- **Approach-Specific Guides**:
  - `ai-testing-template/CLAUDE.md`
  - `decoupled-testing-suite/CLAUDE.md`
- **Implementation Details**:
  - `shared/examples/adapter-usage.js` - Adapter pattern examples
  - `MVP_COMPLETION_PLAN.md` - Detailed implementation checklist