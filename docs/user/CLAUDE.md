# User Documentation - AI Agent Guide

*Quick navigation for AI agents working with user-facing documentation*

## 🎯 Purpose

This guide helps AI agents understand how to create, maintain, and improve user documentation for the Claude Testing Infrastructure. Focus on clarity, accuracy, and practical examples.

## 📚 User Documentation Structure

### Document Organization
```
user/
├── getting-started.md      # Quick start guide
├── installation.md         # Detailed setup instructions
├── commands.md            # CLI command reference
├── configuration.md       # Config file options
├── troubleshooting.md     # Common issues and solutions
├── examples/              # Real-world usage examples
└── faq.md                # Frequently asked questions
```

### Documentation Principles
1. **User-first language** - Avoid technical jargon
2. **Step-by-step instructions** - Number each step clearly
3. **Real examples** - Show actual commands and output
4. **Problem-solution format** - For troubleshooting
5. **Visual hierarchy** - Use headers and formatting

## 📝 Writing User Documentation

### Getting Started Guide Pattern
```markdown
# Getting Started with Claude Testing Infrastructure

## What You'll Need
- Node.js 18 or higher
- Git (for version control)
- 5 minutes to set up

## Quick Start
1. Clone the infrastructure
   ```bash
   git clone https://github.com/SynidSweet/claude-testing-infrastructure.git
   cd claude-testing-infrastructure
   ```

2. Install and build
   ```bash
   npm install
   npm run build
   ```

3. Generate tests for your project
   ```bash
   node dist/src/cli/index.js test /path/to/your/project
   ```

## What Happens Next
[Explain what users should expect to see]
```

### Command Documentation Pattern
```markdown
## `test` Command

Generate comprehensive tests for your project.

### Usage
```bash
node dist/src/cli/index.js test <project-path> [options]
```

### Options
- `--only-structural` - Generate only structural tests (no AI required)
- `--only-logical` - Generate only AI-powered logical tests
- `--config <path>` - Use custom configuration file

### Examples
```bash
# Basic usage
node dist/src/cli/index.js test ./my-project

# Generate only structural tests
node dist/src/cli/index.js test ./my-project --only-structural
```

### Common Issues
**Problem**: "No tests generated"
**Solution**: Check that your project has source files matching the include patterns.
```

### Troubleshooting Entry Pattern
```markdown
## Issue: AI tests not generating

### Symptoms
- Command hangs during logical test generation
- "Unknown model" warnings appear
- No AI-powered tests created

### Cause
Claude CLI is not properly configured or authenticated.

### Solution
1. Check Claude CLI installation:
   ```bash
   claude --version
   ```

2. Verify authentication:
   ```bash
   claude config get
   ```

3. If not authenticated, run:
   ```bash
   claude auth login
   ```

### Prevention
Always verify Claude CLI setup before using AI features.
```

## 🔧 Documentation Maintenance

### Updating Existing Docs

1. **Check accuracy**
   - Test all commands shown
   - Verify output matches
   - Update version numbers
   - Fix broken links

2. **Improve clarity**
   - Simplify complex explanations
   - Add missing steps
   - Include more examples
   - Clarify ambiguous language

3. **Add user feedback**
   - Common questions → FAQ
   - Reported issues → Troubleshooting
   - Usage patterns → Examples
   - Feature requests → Roadmap

### Creating New Documentation

1. **Identify need**
   - New feature added
   - User confusion reported
   - Complex workflow discovered
   - Integration requested

2. **Choose format**
   - Step-by-step guide
   - Reference documentation
   - Troubleshooting guide
   - Example/tutorial

3. **Write and test**
   - Follow patterns above
   - Test every instruction
   - Get user feedback
   - Iterate on clarity

## 📋 Common Documentation Tasks

### Adding a New Command
1. Update `commands.md` with full reference
2. Add to `getting-started.md` if commonly used
3. Create examples in `examples/`
4. Add troubleshooting for common errors

### Documenting Configuration
1. Update `configuration.md` with new options
2. Show example configurations
3. Explain each option's effect
4. Note defaults and constraints

### Writing Examples
1. Use realistic project scenarios
2. Show complete command sequences
3. Include expected output
4. Explain what's happening

### Troubleshooting Entries
1. Start with clear symptoms
2. Explain root cause briefly
3. Provide step-by-step solution
4. Add prevention tips

## 🎨 Documentation Style Guide

### Formatting
- **Code blocks**: Use triple backticks with language
- **Commands**: Always show full command with path
- **Emphasis**: Bold for UI elements, italic for concepts
- **Lists**: Numbered for steps, bullets for options

### Language
- **Active voice**: "Run the command" not "The command should be run"
- **Present tense**: "This generates" not "This will generate"
- **Second person**: "You can" not "Users can"
- **Simple words**: "Use" not "Utilize"

### Structure
- **Short paragraphs**: 2-3 sentences maximum
- **Clear headers**: Descriptive and hierarchical
- **Logical flow**: Setup → Usage → Troubleshooting
- **Quick scanning**: Bold key points

## 🚨 Documentation Don'ts

### Avoid
- Technical implementation details
- Internal architecture explanations
- Assumptions about user knowledge
- Outdated version information
- Broken example commands

### Never
- Use "simply" or "just" - nothing is simple to everyone
- Skip error handling in examples
- Mix setup and usage instructions
- Leave TODOs in user docs
- Create docs without testing

## 📊 User Feedback Integration

### Sources
- GitHub issues
- Testing feedback (`~/Documents/testing-feedback.md`)
- Community discussions
- Direct user reports

### Processing
1. **Collect feedback**
   - Track common questions
   - Note confusion points
   - Identify missing docs

2. **Prioritize updates**
   - Critical errors first
   - Common issues next
   - Enhancements last

3. **Implement changes**
   - Update relevant docs
   - Add new sections
   - Improve examples

## 🔗 Related Documentation

- **Architecture**: [`/docs/architecture/CLAUDE.md`](../architecture/CLAUDE.md) - Technical details
- **Development**: [`/docs/development/CLAUDE.md`](../development/CLAUDE.md) - Contributing
- **Features**: [`/docs/features/CLAUDE.md`](../features/CLAUDE.md) - Components
- **Planning**: [`/docs/planning/CLAUDE.md`](../planning/CLAUDE.md) - Roadmap
- **API**: [`/docs/api/CLAUDE.md`](../api/CLAUDE.md) - Programmatic use

## ⚡ Quick Documentation Actions

### Need to document a feature?
1. Add to appropriate user doc
2. Include real example
3. Test all instructions
4. Update table of contents

### Found confusing docs?
1. Identify the confusion
2. Rewrite for clarity
3. Add examples
4. Test with fresh perspective

### User reported issue?
1. Add to troubleshooting
2. Provide clear solution
3. Explain prevention
4. Link from relevant docs

---

**Documentation Philosophy**: If users need to ask, the documentation needs improvement. Make it so clear that questions become rare.