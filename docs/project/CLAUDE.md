# Project Documentation - AI Agent Guide

*Quick navigation for AI agents working with project-wide documentation and overview materials*

## 🎯 Purpose

This guide helps AI agents understand project-level documentation, including project overview, changelog, and navigation structure. Use this when you need high-level project context or are documenting project-wide changes.

## 📋 Project Documentation Structure

### Document Organization
```
project/
├── overview.md           # High-level project summary
├── changelog.md          # Version history and changes
└── navigation.md         # Project navigation structure
```

### Key Documents Overview

#### Overview (`overview.md`)
**Purpose**: Comprehensive project summary and context  
**When to reference**: Getting familiar with the project's purpose and scope  
**Key content**: Mission, goals, key features, user value proposition

#### Changelog (`changelog.md`)
**Purpose**: Track version history and significant changes  
**When to reference**: Understanding project evolution or documenting changes  
**Key content**: Version releases, feature additions, bug fixes, breaking changes

#### Navigation (`navigation.md`)
**Purpose**: Guide to project structure and documentation organization  
**When to reference**: Finding specific documentation or understanding project layout  
**Key content**: Directory structure, documentation paths, quick references

## 🏗️ Working with Project Documentation

### Understanding Project Context

#### Project Lifecycle Awareness
1. **Mission understanding** - What problem does this project solve?
2. **Feature evolution** - How has the project grown over time?
3. **User journey** - Who uses this and how?
4. **Technical maturity** - What's the current development stage?

#### Documentation Relationships
```markdown
# Project context flow
overview.md → Provides project mission and scope
    ↓
changelog.md → Shows evolution and current state
    ↓
navigation.md → Guides to specific documentation
    ↓
Technical docs → Detailed implementation guidance
```

### Project-Level Changes

#### When to Update Project Docs
- **Major feature releases** - Update overview and changelog
- **Architecture changes** - Reflect in overview if user-impacting
- **Documentation restructuring** - Update navigation
- **Breaking changes** - Prominently document in changelog

#### Change Documentation Patterns
```markdown
# Changelog entry format
## [Version] - YYYY-MM-DD

### Added
- New feature descriptions

### Changed
- Modified functionality

### Fixed
- Bug fixes

### Removed
- Deprecated features
```

## 📊 Project Documentation Best Practices

### Overview Maintenance
1. **Keep user-focused** - Explain value, not implementation
2. **Update regularly** - Reflect current capabilities
3. **Link to details** - Reference specific feature docs
4. **Show examples** - Demonstrate key use cases

### Changelog Management
1. **Version consistently** - Follow semantic versioning
2. **Group changes** - Use Added/Changed/Fixed/Removed
3. **Date entries** - Include release dates
4. **Link issues** - Reference GitHub issues where applicable

### Navigation Updates
1. **Reflect structure** - Keep in sync with actual organization
2. **Add new sections** - When creating new documentation areas
3. **Remove obsolete** - Clean up deprecated documentation paths
4. **Test links** - Ensure all references work

## 🔧 Common Project Documentation Tasks

### Adding Major Features
1. **Update overview.md** - If feature changes project scope
2. **Document in changelog.md** - Add to appropriate version
3. **Update navigation.md** - If new docs created
4. **Cross-reference** - Link from other relevant docs

### Project Restructuring
1. **Plan navigation changes** - Before moving files
2. **Update all cross-references** - Fix broken links
3. **Document restructuring** - In changelog
4. **Test documentation** - Ensure all paths work

### Version Releases
1. **Finalize changelog** - Complete version entry
2. **Update version references** - Throughout documentation
3. **Review overview** - Ensure accuracy
4. **Validate navigation** - All links functional

### Documentation Cleanup
1. **Remove outdated content** - From overview
2. **Archive old versions** - In changelog
3. **Clean navigation** - Remove obsolete paths
4. **Update references** - Fix stale links

## 🚨 Project Documentation Constraints

### Scope Boundaries
- **High-level focus** - Avoid implementation details
- **User perspective** - Emphasize value and capabilities
- **Current state** - Reflect actual project status
- **Accessible language** - Avoid technical jargon

### Consistency Requirements
- **Version alignment** - All docs reflect same version
- **Link integrity** - All references must work
- **Style consistency** - Follow project documentation standards
- **Update coordination** - Changes should be synchronized

## 📝 Documentation Patterns

### Overview Structure Pattern
```markdown
# Project Name

## What It Does
[Brief value proposition]

## Key Features
- Feature 1: [User benefit]
- Feature 2: [User benefit]

## Getting Started
[Link to getting started guide]

## Documentation
[Navigation to detailed docs]
```

### Changelog Entry Pattern
```markdown
## [2.1.0] - 2025-07-01

### Added
- New batched AI processing feature for large projects
- Configuration validation system

### Changed
- Improved test generation performance by 40%
- Enhanced error messages for better user experience

### Fixed
- Fixed issue with Python project detection
- Resolved memory leak in watch mode

### Removed
- Deprecated template-based testing approach
```

## 🔗 Related Documentation

- **Architecture**: [`/docs/architecture/CLAUDE.md`](../architecture/CLAUDE.md) - Technical design
- **Development**: [`/docs/development/CLAUDE.md`](../development/CLAUDE.md) - Development workflow
- **Features**: [`/docs/features/CLAUDE.md`](../features/CLAUDE.md) - Component details
- **Planning**: [`/docs/planning/CLAUDE.md`](../planning/CLAUDE.md) - Roadmap
- **API**: [`/docs/api/CLAUDE.md`](../api/CLAUDE.md) - Interfaces
- **User Guide**: [`/docs/user/CLAUDE.md`](../user/CLAUDE.md) - Usage documentation
- **AI Agents**: [`/docs/ai-agents/CLAUDE.md`](../ai-agents/CLAUDE.md) - AI patterns

## ⚡ Quick Project Actions

### Need project context?
1. Read `overview.md` for mission and scope
2. Check `changelog.md` for recent changes
3. Use `navigation.md` to find specific docs
4. Cross-reference with technical documentation

### Documenting changes?
1. Update `changelog.md` with version entry
2. Modify `overview.md` if scope changes
3. Update `navigation.md` if structure changes
4. Ensure all cross-references work

### New to the project?
1. Start with `overview.md` for context
2. Review recent `changelog.md` entries
3. Follow `navigation.md` to explore docs
4. Read user guide for practical understanding

### Project restructuring?
1. Plan changes in `navigation.md`
2. Update all affected documentation
3. Document restructuring in `changelog.md`
4. Test all documentation links

---

**Project Documentation Philosophy**: Clear, current, and comprehensive - project documentation should provide immediate context and guide users to the information they need.