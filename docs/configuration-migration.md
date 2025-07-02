# Configuration Migration Guide

This guide helps you migrate from older configuration approaches to the new unified configuration system in Claude Testing Infrastructure v2.0+.

## Overview

The new configuration system provides:
- **Multiple sources** with clear precedence rules
- **Environment variable support** for CI/CD
- **User-level defaults** across projects  
- **Better validation** with helpful error messages
- **Debug tools** to understand configuration resolution

## Migration Scenarios

### From Direct CLI Arguments Only

**Old approach:**
```bash
claude-testing test ./my-project --framework jest --coverage --max-ratio 15
```

**New approach - Option 1: Keep using CLI args**
```bash
# CLI args still work and have highest precedence
claude-testing test ./my-project --framework jest --coverage --max-ratio 15
```

**New approach - Option 2: Use project config**
```json
// .claude-testing.config.json
{
  "testFramework": "jest",
  "coverage": {
    "enabled": true
  },
  "generation": {
    "maxTestToSourceRatio": 15
  }
}
```

**New approach - Option 3: Use environment variables**
```bash
export CLAUDE_TESTING_TEST_FRAMEWORK=jest
export CLAUDE_TESTING_COVERAGE_ENABLED=true
export CLAUDE_TESTING_GENERATION_MAX_TEST_TO_SOURCE_RATIO=15
claude-testing test ./my-project
```

### From Custom Config Files

**Old approach:**
```bash
claude-testing test ./my-project --config my-config.json
```

**New approach:**
The `--config` flag still works, but consider moving to:

1. **Project-level config** (`.claude-testing.config.json` in project root)
2. **User-level config** (`~/.config/claude-testing/config.json`)
3. **Environment variables** for CI/CD overrides

### From Hardcoded Defaults

**Old issues:**
- No way to change defaults without code changes
- Different behavior across environments
- No visibility into what configuration was used

**New benefits:**
```bash
# See exactly what configuration is being used
claude-testing test ./my-project --show-config-sources

# Override specific values via environment
export CLAUDE_TESTING_AI_MODEL=claude-3-haiku-20240307
export CLAUDE_TESTING_COST_LIMIT=25.00
```

## Configuration Precedence

Understanding precedence helps you organize your configuration:

1. **CLI arguments** - Highest priority, for one-time overrides
2. **Environment variables** - For CI/CD and temporary overrides
3. **Custom config file** - Via `--config` flag
4. **Project config** - `.claude-testing.config.json` in project root
5. **User config** - Personal defaults across all projects
6. **Built-in defaults** - Sensible fallbacks

### Example Precedence Resolution

```bash
# User config (~/.config/claude-testing/config.json)
{
  "aiModel": "claude-3-5-sonnet-20241022",
  "costLimit": 50.00
}

# Project config (.claude-testing.config.json)
{
  "testFramework": "jest",
  "costLimit": 20.00  # Overrides user default
}

# Environment variable
export CLAUDE_TESTING_COST_LIMIT=10.00  # Overrides project config

# CLI argument
--cost-limit 5.00  # Overrides everything

# Final result: costLimit = 5.00
```

## Common Migration Patterns

### 1. Team Standardization

Move shared configuration to project level:

```json
// .claude-testing.config.json
{
  "testFramework": "jest",
  "include": ["src/**/*.{js,ts,jsx,tsx}"],
  "exclude": ["**/*.test.*", "**/*.spec.*", "node_modules/**"],
  "coverage": {
    "enabled": true,
    "thresholds": {
      "global": {
        "statements": 80,
        "branches": 75,
        "functions": 80,
        "lines": 80
      }
    }
  }
}
```

### 2. CI/CD Configuration

Use environment variables for CI-specific settings:

```yaml
# .github/workflows/test.yml
env:
  CLAUDE_TESTING_AI_MODEL: claude-3-haiku-20240307  # Faster/cheaper for CI
  CLAUDE_TESTING_COST_LIMIT: 5.00
  CLAUDE_TESTING_DRY_RUN: false
  CLAUDE_TESTING_OUTPUT_FORMAT: json
```

### 3. Developer Preferences

Set personal defaults in user config:

```json
// ~/.config/claude-testing/config.json
{
  "output": {
    "logLevel": "verbose",
    "colors": true
  },
  "features": {
    "edgeCases": true,
    "integrationTests": false
  }
}
```

### 4. Model Aliases

Handle the AI model naming changes:

**Old model names:**
- `claude-3-sonnet` 
- `claude-3.5-sonnet`
- `sonnet`

**New canonical names:**
```json
{
  "aiModel": "claude-3-5-sonnet-20241022"
}
```

## Debugging Configuration Issues

### 1. Use --show-config-sources

```bash
claude-testing analyze ./my-project --show-config-sources
```

This shows:
- Which sources were loaded
- What values each source provided
- The final resolved configuration
- Any errors or warnings

### 2. Check for Conflicts

The new validation catches common issues:

```json
// This will generate a warning
{
  "features": {
    "coverage": false  // Feature disabled
  },
  "coverage": {
    "enabled": true    // But coverage enabled - conflict!
  }
}
```

### 3. Validate Configuration

Use the analyze command with `--validate-config`:

```bash
claude-testing analyze ./my-project --validate-config
```

## Best Practices

### 1. Use Appropriate Sources

- **CLI args**: One-time overrides, debugging
- **Environment**: CI/CD, temporary changes
- **Project config**: Team standards, project requirements
- **User config**: Personal preferences
- **Defaults**: Rely on sensible built-ins

### 2. Keep It Simple

Don't duplicate configuration across sources:

```json
// Bad: Same value in multiple places
// User config
{ "testFramework": "jest" }
// Project config  
{ "testFramework": "jest" }  // Redundant

// Good: Override only when different
// User config
{ "testFramework": "jest" }  // Personal default
// Project config
{ "testFramework": "pytest" }  // This project uses Python
```

### 3. Document Your Configuration

Add comments explaining non-obvious settings:

```json
{
  "generation": {
    "maxTestToSourceRatio": 3  // Limited due to large codebase
  },
  "exclude": [
    "**/legacy/**",  // Old code, not worth testing
    "**/generated/**"  // Auto-generated files
  ]
}
```

## Troubleshooting

### "Configuration not found"

Check file locations:
- Project: `.claude-testing.config.json` (note the leading dot)
- User: `~/.config/claude-testing/config.json` or `~/.claude-testing.config.json`

### "Invalid configuration"

Run with `--show-config-sources` to see detailed errors:
```bash
claude-testing test ./my-project --show-config-sources
```

### Environment variables not working

Ensure correct prefix and format:
```bash
# Correct
export CLAUDE_TESTING_TEST_FRAMEWORK=jest

# Wrong (missing prefix)
export TEST_FRAMEWORK=jest

# Wrong (incorrect separator)  
export CLAUDE_TESTING.TEST_FRAMEWORK=jest
```

### Performance issues

If configuration loading is slow:
1. Check for very large config files
2. Reduce number of patterns in include/exclude
3. Use `--show-config-sources` to see load times

## Migration Checklist

- [ ] Identify current configuration approach
- [ ] Choose appropriate configuration sources
- [ ] Create configuration files as needed
- [ ] Test with `--show-config-sources`
- [ ] Validate with `--validate-config`
- [ ] Update CI/CD scripts
- [ ] Document team conventions
- [ ] Remove old configuration files

## Need Help?

- Run `claude-testing --help` for command options
- Check [configuration reference](./configuration.md)
- View [example configurations](./examples/configuration)
- Report issues at [GitHub](https://github.com/SynidSweet/claude-testing-infrastructure)