# Reference Documentation - AI Agent Guide

*Quick navigation for AI agents working with reference materials and command documentation*

## 🎯 Purpose

This guide helps AI agents understand and work with reference documentation, particularly command references, API specifications, and quick lookup materials for the Claude Testing Infrastructure.

## 📋 Reference Documentation Structure

### Document Organization
```
reference/
├── commands.md           # Complete CLI command reference
├── api-reference.md      # API method documentation (future)
├── configuration.md      # Config option reference (future)
└── error-codes.md        # Error reference guide (future)
```

### Current Documents Overview

#### Commands (`commands.md`)
**Purpose**: Comprehensive CLI command reference with syntax and examples  
**When to reference**: When using or documenting CLI commands  
**Key content**: Command syntax, options, examples, common patterns

### Future Reference Documents
- **API Reference**: Programmatic interface documentation
- **Configuration Reference**: Complete config option documentation
- **Error Codes**: Standardized error reference with solutions

## 📖 Working with Reference Documentation

### Understanding Reference Patterns

#### Command Reference Structure
```markdown
# Command Name

## Syntax
command [options] <arguments>

## Description
What the command does and why you'd use it

## Options
- --option: Description of option
- --flag: Description of flag

## Examples
Practical usage examples with explanations

## Related Commands
Links to related functionality
```

#### Reference Documentation Principles
1. **Completeness** - Document all options and behaviors
2. **Accuracy** - Syntax must match actual implementation
3. **Examples** - Show real-world usage patterns
4. **Cross-linking** - Connect related commands and concepts

### Using Command Reference

#### Finding Commands
1. **Browse by category** - Commands grouped by function
2. **Search by purpose** - Find commands for specific tasks
3. **Follow examples** - Copy-paste ready command patterns
4. **Check related** - Discover connected functionality

#### Validating Commands
1. **Check syntax** - Ensure options match reference
2. **Test examples** - Verify examples actually work
3. **Update references** - When commands change
4. **Add new commands** - Document new functionality

## 🔧 Reference Documentation Tasks

### Adding New Commands

#### Documentation Checklist
1. **Command syntax** - Exact argument structure
2. **All options** - Every flag and parameter documented
3. **Clear description** - Purpose and use cases
4. **Working examples** - Tested command sequences
5. **Error scenarios** - Common mistakes and solutions
6. **Related commands** - Cross-references to similar functionality

#### Command Documentation Template
```markdown
## `command-name`

Brief description of what this command does.

### Syntax
```bash
node dist/cli/index.js command-name <required-arg> [optional-arg] [options]
```

### Arguments
- `required-arg`: Description of required argument
- `optional-arg`: Description of optional argument

### Options
- `--option <value>`: Description and default value
- `--flag`: Description of boolean flag
- `--help`: Show command help

### Examples
```bash
# Basic usage
node dist/cli/index.js command-name project-path

# With options
node dist/cli/index.js command-name project-path --option value --flag

# Common patterns
node dist/cli/index.js command-name . --dry-run
```

### Common Issues
**Problem**: Command not found
**Solution**: Ensure you're in the infrastructure directory and have run `npm run build`

### Related Commands
- [`other-command`](#other-command): Related functionality
- [`similar-command`](#similar-command): Alternative approach
```

### Updating Existing Commands

#### Update Process
1. **Test current behavior** - Verify existing documentation accuracy
2. **Document changes** - Add new options or modify descriptions
3. **Update examples** - Ensure examples reflect current syntax
4. **Check cross-references** - Update related command links
5. **Validate completeness** - Ensure all functionality documented

#### Common Updates
- **New options added** - Document with examples
- **Option behavior changed** - Update descriptions and examples
- **Command renamed** - Update all references
- **Command deprecated** - Mark as deprecated with alternatives

### Creating API Reference

#### When API Reference Is Needed
- Programmatic interfaces stabilize
- External integrations are developed
- Plugin system is implemented
- TypeScript interfaces are finalized

#### API Reference Structure
```markdown
# API Reference

## Classes
### ClassName
Description and purpose

#### Methods
##### methodName(params): returnType
Method description, parameters, and return value

#### Examples
Code examples showing usage

## Interfaces
### InterfaceName
Interface description and usage

## Types
### TypeName
Type definition and usage patterns
```

## 📊 Reference Quality Standards

### Accuracy Requirements
- **Tested examples** - All examples must work as shown
- **Current syntax** - Matches actual command implementation
- **Complete options** - No undocumented flags or parameters
- **Error handling** - Common errors and solutions documented

### Usability Standards
- **Quick scanning** - Easy to find specific information
- **Copy-paste ready** - Examples work without modification
- **Progressive detail** - Basic usage first, advanced options later
- **Clear language** - Technical accuracy with plain language

## 🚨 Reference Documentation Constraints

### Maintenance Requirements
- **Sync with implementation** - Must match actual command behavior
- **Regular validation** - Test examples periodically
- **Version awareness** - Note version-specific features
- **Breaking changes** - Clearly mark deprecated functionality

### Documentation Scope
- **Focus on usage** - How to use, not how it works internally
- **Complete coverage** - All public functionality documented
- **External perspective** - Written from user's point of view
- **Quick reference** - Optimize for fast lookup

## 🔄 Reference Documentation Workflows

### Daily Reference Tasks
1. **Command lookup** - Find syntax for specific commands
2. **Option checking** - Verify available flags and parameters
3. **Example copying** - Use documented patterns
4. **Cross-referencing** - Find related functionality

### Documentation Maintenance
1. **Weekly validation** - Test command examples
2. **Version updates** - Document new command features
3. **Deprecation tracking** - Mark obsolete functionality
4. **User feedback** - Incorporate usage questions into docs

### Integration with Development
1. **New feature documentation** - Add commands as they're implemented
2. **Breaking change updates** - Immediately update affected references
3. **Beta feature marking** - Clearly indicate experimental functionality
4. **Release preparation** - Finalize documentation before releases

## 🔗 Related Documentation

- **Architecture**: [`/docs/architecture/CLAUDE.md`](../architecture/CLAUDE.md) - System design
- **Development**: [`/docs/development/CLAUDE.md`](../development/CLAUDE.md) - Dev workflow
- **Features**: [`/docs/features/CLAUDE.md`](../features/CLAUDE.md) - Component details
- **Planning**: [`/docs/planning/CLAUDE.md`](../planning/CLAUDE.md) - Roadmap
- **API**: [`/docs/api/CLAUDE.md`](../api/CLAUDE.md) - Interfaces
- **User Guide**: [`/docs/user/CLAUDE.md`](../user/CLAUDE.md) - Usage tutorials
- **AI Agents**: [`/docs/ai-agents/CLAUDE.md`](../ai-agents/CLAUDE.md) - AI patterns
- **Project**: [`/docs/project/CLAUDE.md`](../project/CLAUDE.md) - Project overview

## ⚡ Quick Reference Actions

### Need command syntax?
1. Check `commands.md` for complete reference
2. Find command by name or category
3. Copy example syntax
4. Modify for your specific use case

### Documenting new command?
1. Use command documentation template
2. Test all examples before documenting
3. Add to appropriate category in commands.md
4. Cross-reference with related commands

### Found documentation error?
1. Test the documented behavior
2. Update incorrect information
3. Verify examples work
4. Check for similar errors in related docs

### Creating reference for new feature?
1. Document all public interfaces
2. Provide working examples
3. Include error scenarios
4. Cross-reference with existing functionality

---

**Reference Documentation Philosophy**: Authoritative, accurate, and accessible - reference documentation should be the definitive source for how to use every feature correctly.