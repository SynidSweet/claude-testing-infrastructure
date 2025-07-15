# CLI Command Reference

*Last updated: 2025-07-13 | Updated by: /document command | CLI run command configuration loading fix applied*

## Overview

The Claude Testing Infrastructure provides a comprehensive CLI for analyzing projects, generating tests, and managing test execution. All commands follow the pattern:

```bash
node dist/src/cli/index.js <command> [options] <path>
```

## Global Options

These options work with all commands:

- `--help, -h` - Display help for command
- `--version, -v` - Display version information
- `--verbose` - Enable verbose output
- `--config <path>` - Use custom configuration file
- `--no-color` - Disable colored output

## Commands

### `analyze` - Project Analysis

Analyzes a project to detect languages, frameworks, and structure.

```bash
node dist/src/cli/index.js analyze <path> [options]
```

**Options:**
- `-o, --output <path>` - Save analysis results to file
- `--format <format>` - Output format: `json|markdown|console` (default: console)
- `--dry-run` - Preview analysis without creating any files
- `--validate-config` - Validate configuration file
- `--show-patterns` - Display file discovery patterns
- `--show-config-sources` - Show configuration source precedence

**Example:**
```bash
# Basic analysis
node dist/src/cli/index.js analyze /path/to/project

# Save results as JSON
node dist/src/cli/index.js analyze /path/to/project --format json --output analysis.json

# Preview analysis only
node dist/src/cli/index.js analyze /path/to/project --dry-run

# Debug configuration
node dist/src/cli/index.js analyze /path/to/project --show-config-sources
```

### `test` (alias: `generate`) - Test Generation

Generates comprehensive tests for a project.

```bash
node dist/src/cli/index.js test <path> [options]
```

**Options:**
- `--only-structural` - Generate only structural tests (no AI)
- `--only-logical` - Generate only logical tests (AI required)
- `--dry-run` - Preview without creating files
- `--force` - Skip validation checks
- `--max-ratio <number>` - Override test-to-source ratio limit
- `--enable-chunking` - Enable large file chunking
- `--chunk-size <size>` - Token limit per chunk (default: 3500)
- `--update` - Update existing tests

**Example:**
```bash
# Generate all tests
node dist/src/cli/index.js test /path/to/project

# Preview generation
node dist/src/cli/index.js test /path/to/project --dry-run

# Structural tests only (fast, no AI)
node dist/src/cli/index.js test /path/to/project --only-structural
```

### `run` - Test Execution

Runs generated tests with optional coverage reporting. Configuration loading has been optimized for reliable operation.

```bash
node dist/src/cli/index.js run <path> [options]
```

**Options:**
- `--coverage` - Generate coverage report
- `--watch` - Run in watch mode
- `--junit` - Generate JUnit XML report
- `--bail` - Stop on first test failure
- `--update-snapshots` - Update test snapshots

**Example:**
```bash
# Run tests
node dist/src/cli/index.js run /path/to/project

# Run with coverage
node dist/src/cli/index.js run /path/to/project --coverage

# Watch mode
node dist/src/cli/index.js run /path/to/project --watch
```

### `incremental` - Smart Test Updates

Updates tests based on Git changes for cost-efficient maintenance.

```bash
node dist/src/cli/index.js incremental <path> [options]
```

**Options:**
- `--baseline` - Create baseline for future comparisons
- `--dry-run` - Preview changes without execution
- `--stats` - Show update statistics
- `--cost-limit <amount>` - Maximum AI cost in USD
- `--branch <name>` - Compare against specific branch

**Example:**
```bash
# Update changed tests
node dist/src/cli/index.js incremental /path/to/project

# Create baseline
node dist/src/cli/index.js incremental /path/to/project --baseline

# Preview with cost estimate
node dist/src/cli/index.js incremental /path/to/project --dry-run
```

### `watch` - Continuous Testing

Monitors project for changes and updates tests automatically.

```bash
node dist/src/cli/index.js watch <path> [options]
```

**Options:**
- `--auto-run` - Run tests after generation
- `--debounce <ms>` - Delay before processing (default: 1000)
- `--ignore <pattern>` - Additional ignore patterns

**Example:**
```bash
# Watch for changes
node dist/src/cli/index.js watch /path/to/project

# Auto-run tests
node dist/src/cli/index.js watch /path/to/project --auto-run
```

### `analyze-gaps` - Test Gap Analysis

Analyzes coverage gaps and prepares for AI enhancement.

```bash
node dist/src/cli/index.js analyze-gaps <path> [options]
```

**Options:**
- `--format <format>` - Output format: `json|markdown|terminal`
- `--min-complexity <number>` - Minimum complexity threshold
- `--cost-estimate` - Include AI cost estimates
- `--output <path>` - Save report to file

**Example:**
```bash
# Analyze test gaps
node dist/src/cli/index.js analyze-gaps /path/to/project

# Save detailed report
node dist/src/cli/index.js analyze-gaps /path/to/project --format markdown --output gaps.md
```

### `generate-logical` - AI Test Generation

Generates logical tests using Claude AI for identified gaps.

```bash
node dist/src/cli/index.js generate-logical <gaps-file> [options]
```

**Options:**
- `--model <name>` - AI model to use (opus|sonnet|haiku)
- `--max-cost <amount>` - Cost limit in USD
- `--batch-size <number>` - Files per batch
- `--dry-run` - Preview without generation

**Example:**
```bash
# Generate from gaps analysis
node dist/src/cli/index.js generate-logical gaps.json

# Use specific model with cost limit
node dist/src/cli/index.js generate-logical gaps.json --model sonnet --max-cost 5.00
```

### `init-config` - Initialize Configuration

Creates a configuration file for the target project.

```bash
node dist/src/cli/index.js init-config <path> [options]
```

**Options:**
- `--force` - Overwrite existing configuration
- `--template <name>` - Use specific template
- `--interactive` - Interactive configuration mode

**Example:**
```bash
# Auto-detect and create config
node dist/src/cli/index.js init-config /path/to/project

# Use specific template
node dist/src/cli/index.js init-config /path/to/project --template react-typescript
```

### `generate-logical-batch` - Batch AI Generation

Processes multiple gap analysis files for AI test generation.

```bash
node dist/src/cli/index.js generate-logical-batch <directory> [options]
```

**Options:**
- `--pattern <glob>` - File pattern to match
- `--max-total-cost <amount>` - Total cost limit
- `--parallel <number>` - Concurrent processes

**Example:**
```bash
# Process all gap files
node dist/src/cli/index.js generate-logical-batch ./gap-reports

# With cost control
node dist/src/cli/index.js generate-logical-batch ./gap-reports --max-total-cost 20.00
```

## Configuration

### Configuration File

Create `.claude-testing.config.json` in your project:

```json
{
  "include": ["src/**/*.{js,ts}"],
  "exclude": ["**/*.test.*"],
  "testFramework": "jest",
  "aiModel": "claude-3-5-sonnet-20241022",
  "features": {
    "coverage": true,
    "edgeCases": true,
    "integrationTests": true
  }
}
```

### Configuration Precedence

1. CLI arguments (highest)
2. Environment variables
3. Project config file
4. User config (`~/.claude-testing.config.json`)
5. Default configuration (lowest)

### Environment Variables

- `CLAUDE_TESTING_LOG_LEVEL` - Set log level (debug|info|warn|error)
- `CLAUDE_TESTING_AI_MODEL` - Default AI model
- `CLAUDE_TESTING_MAX_COST` - Default cost limit
- `NO_COLOR` - Disable colored output

## Common Workflows

### Complete Test Generation

```bash
# 1. Initialize configuration
node dist/src/cli/index.js init-config /project

# 2. Analyze project
node dist/src/cli/index.js analyze /project

# 3. Generate tests
node dist/src/cli/index.js test /project

# 4. Run with coverage
node dist/src/cli/index.js run /project --coverage
```

### Incremental Updates

```bash
# 1. Create baseline
node dist/src/cli/index.js incremental /project --baseline

# 2. Make code changes
# ... edit source files ...

# 3. Update tests
node dist/src/cli/index.js incremental /project

# 4. Run updated tests
node dist/src/cli/index.js run /project
```

### AI-Enhanced Testing

```bash
# 1. Generate structural tests
node dist/src/cli/index.js test /project --only-structural

# 2. Analyze gaps
node dist/src/cli/index.js analyze-gaps /project --output gaps.json

# 3. Generate logical tests
node dist/src/cli/index.js generate-logical gaps.json --max-cost 10.00

# 4. Run all tests
node dist/src/cli/index.js run /project --coverage
```

## Exit Codes

- `0` - Success
- `1` - General error
- `2` - Invalid arguments
- `3` - Project not found
- `4` - Configuration error
- `5` - Test generation failed
- `6` - Test execution failed
- `7` - AI service error

## Tips

1. **Start with structural tests** - They're fast and don't require AI
2. **Use incremental updates** - Save 70-90% on AI costs
3. **Set cost limits** - Prevent unexpected AI charges
4. **Enable chunking** - For projects with large files
5. **Check configuration** - Use `--show-config-sources` to debug

---

**Need help?** Run any command with `--help` for detailed options and examples.