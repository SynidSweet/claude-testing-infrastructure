# Non-Interactive Mode Guide for AI Agents

## 🤖 Executive Summary

**All testing infrastructure commands are now fully automated and non-interactive.** AI agents can execute any command without handling prompts or user interaction.

## 🚀 Key Changes (as of 2025-06-27)

### Before vs After

**Before**: `npm run init` → Interactive prompts requiring user input
**After**: `npm run init:auto` → Fully automated with smart defaults

### Command Mapping

| Old Command | New Command | Description |
|------------|-------------|-------------|
| `npm run init` | `npm run init:auto` | Fully automated initialization |
| Manual selection | `npm run init:minimal` | Basic unit tests only |
| Manual selection | `npm run init:recommended` | Balanced testing setup |
| Manual selection | `npm run init:comprehensive` | Full testing pyramid |
| N/A | `npm run preview` | Dry-run preview mode |

## 📋 Usage Examples

### Basic Automated Setup
```bash
cd ai-testing-template
npm run init:auto
# No prompts - everything is detected and configured automatically
```

### Custom Configuration
```bash
# Override specific aspects while keeping automation
npm run init:auto -- --frameworks "jest,playwright" --ci github --structure separate
```

### Preview Mode
```bash
# See what would happen without making changes
npm run preview
# OR
npm run init:auto -- --dry-run
```

## 🎯 Confidence Scoring

The automated system includes confidence scoring:
- **>80%**: Full setup with all recommended features
- **50-80%**: Conservative setup with essentials
- **<50%**: Minimal setup with just basics

## 🔧 Available CLI Options

```bash
--frameworks    # Comma-separated list: jest,vitest,playwright,cypress,pytest
--ci           # CI provider: github,gitlab,circle,none
--structure    # Test structure: separate,colocated,both
--features     # Additional features: coverage,visual,performance,a11y,database
--preset       # Use preset: minimal,recommended,comprehensive
--dry-run      # Preview without applying changes
--help         # Show all available options
```

## 💡 AI Agent Best Practices

1. **Always use automated commands** - Never try to handle interactive prompts
2. **Use presets for consistency** - `init:recommended` works for 90% of projects
3. **Preview first if uncertain** - Use `--dry-run` to see what will happen
4. **Check confidence scores** - Low confidence may need manual overrides
5. **Leverage CLI options** - Override specific aspects when needed

## 🚨 Common Pitfalls to Avoid

- ❌ Don't use the old `npm run init` expecting prompts
- ❌ Don't try to pipe input to handle prompts (they don't exist!)
- ❌ Don't ignore confidence warnings in the output
- ✅ Do use the automated commands designed for AI agents
- ✅ Do check the output for any warnings or recommendations

## 📊 Decision Flow

```
Project Analysis → Confidence Score → Apply Configuration
     ↓                    ↓                    ↓
  Detect Type       High: Full Setup    Install & Configure
  Find Frameworks   Med: Essentials     Generate Tests
  Check Structure   Low: Minimal        Setup CI/CD
```

## 🔗 Related Documentation

- Main navigation: `/CLAUDE.md`
- Template approach details: `/ai-testing-template/CLAUDE.md`
- Architecture overview: `/docs/architecture/overview.md`
- Command reference: `/docs/reference/commands.md`