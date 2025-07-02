# Commands Reference

*Last updated: 2025-07-01 | Updated by: /document command | All UX improvements complete*

## 🆕 Core CLI Commands (TypeScript Infrastructure)
```bash
# Project Analysis (Primary Interface)
node dist/cli/index.js analyze <path>                 # Analyze project structure and frameworks
node dist/cli/index.js analyze <path> --verbose       # Detailed analysis output
node dist/cli/index.js analyze <path> --format json   # JSON output for integration
node dist/cli/index.js analyze <path> --format markdown --output report.md # Generate markdown report
node dist/cli/index.js analyze <path> --output analysis.txt # Save console output to file ✅ FIXED
node dist/cli/index.js analyze <path> --format json --output analysis.json # Save JSON to file
node dist/cli/index.js analyze <path> --config custom-config.json # Use custom configuration file ✅ NEW
node dist/cli/index.js analyze <path> --validate-config # Validate .claude-testing.config.json

# Test Generation ✅ IMPLEMENTED
node dist/cli/index.js test <path>                    # Generate comprehensive tests (structural)
node dist/cli/index.js test <path> --dry-run          # Preview test generation without creating files ✅ NEW
node dist/cli/index.js test <path> --dry-run --verbose # Detailed preview with file content samples ✅ NEW
node dist/cli/index.js test <path> --verbose          # Show detailed test generation information
node dist/cli/index.js test <path> --only-structural  # Generate only structural tests (default)
node dist/cli/index.js test <path> --only-logical     # Generate only AI-powered tests ✅ IMPLEMENTED
node dist/cli/index.js test <path> --only-logical --dry-run # Preview AI test generation ✅ NEW
node dist/cli/index.js test <path> --coverage         # Include coverage analysis
node dist/cli/index.js test <path> --config config.json # Use custom configuration
node dist/cli/index.js test <path> --update           # Update existing tests (don't skip)
node dist/cli/index.js test <path> --force            # Skip validation checks (e.g., test-to-source ratio)
node dist/cli/index.js test <path> --max-ratio 15     # Override maximum test-to-source file ratio (default: 10)
node dist/cli/index.js test <path> --enable-chunking  # Enable file chunking for large files (default: true)
node dist/cli/index.js test <path> --chunk-size 4000  # Set custom chunk size in tokens (default: 3500)

# Test Execution ✅ IMPLEMENTED
node dist/cli/index.js run <path>                     # Run generated tests
node dist/cli/index.js run <path> --verbose           # Show detailed test execution information
node dist/cli/index.js run <path> --framework jest    # Specify test framework (jest, pytest)
node dist/cli/index.js run <path> --coverage          # Generate coverage reports
node dist/cli/index.js run <path> --watch             # Run in watch mode
node dist/cli/index.js run <path> --junit             # Generate JUnit XML reports
node dist/cli/index.js run <path> --threshold "80"    # Set coverage threshold
node dist/cli/index.js run <path> --config config.json # Use custom configuration file
node dist/cli/index.js run <path> --threshold "statements:85,branches:80" # Detailed thresholds

# Test Gap Analysis ✅ IMPLEMENTED (Phase 5.2)
node dist/cli/index.js analyze-gaps <path>            # Analyze test gaps with enhanced reporting
node dist/cli/index.js gaps <path>                    # Alias for analyze-gaps
node dist/cli/index.js analyze-gaps <path> --config config.json         # Use custom configuration ✅ NEW
node dist/cli/index.js analyze-gaps <path> --format markdown --output report.md # Markdown report
node dist/cli/index.js analyze-gaps <path> --format json --output gaps.json     # JSON schema output
node dist/cli/index.js analyze-gaps <path> --include-details                    # Detailed gap breakdown
node dist/cli/index.js analyze-gaps <path> --include-code-snippets              # Include code context
node dist/cli/index.js analyze-gaps <path> --no-colors                          # Disable terminal colors
node dist/cli/index.js analyze-gaps <path> --threshold 5                        # Set complexity threshold

# AI-Powered Test Generation ✅ IMPLEMENTED (Phase 5.3)
node dist/cli/index.js generate-logical <path>        # Generate AI tests from gap analysis
node dist/cli/index.js generate-logical <path> --gap-report gaps.json # Use existing gap report
node dist/cli/index.js generate-logical <path> --model sonnet         # Choose Claude model
node dist/cli/index.js generate-logical <path> --budget 5.00          # Set cost limit
node dist/cli/index.js generate-logical <path> --dry-run              # Preview without generating
node dist/cli/index.js generate-logical <path> --concurrent 5         # Set concurrent processes
node dist/cli/index.js generate-logical <path> --batch-mode           # Enable batched processing
node dist/cli/index.js generate-logical <path> --batch-size 5         # Set batch size (when using batch mode)
node dist/cli/index.js generate-logical <path> --output ./reports     # Save reports to directory

# Batched AI Generation ✅ NEW (v2.0)
node dist/cli/index.js generate-logical-batch <path>                    # Start batched AI test generation
node dist/cli/index.js generate-logical-batch <path> --batch-size 10   # Set batch size (default: 10)
node dist/cli/index.js generate-logical-batch <path> --resume          # Resume interrupted batch processing
node dist/cli/index.js generate-logical-batch <path> --stats           # Show current progress statistics
node dist/cli/index.js generate-logical-batch <path> --dry-run         # Preview batches without executing
node dist/cli/index.js generate-logical-batch <path> --clean           # Clean up batch state and start fresh
node dist/cli/index.js generate-logical-batch <path> --cost-limit 2.00 # Set maximum cost per batch
node dist/cli/index.js generate-logical-batch <path> --model sonnet    # Choose Claude model for batches
node dist/cli/index.js generate-logical-batch <path> --concurrent 3    # Set concurrent processes per batch
node dist/cli/index.js generate-logical-batch <path> --timeout 1200    # Set timeout per AI task (seconds)

# Complete AI Workflow ✅ IMPLEMENTED (Phase 5.3)
node dist/cli/index.js test-ai <path>                 # Complete workflow with AI enhancement
node dist/cli/index.js test-ai <path> --budget 10.00  # Set AI generation budget
node dist/cli/index.js test-ai <path> --no-ai         # Structural tests only
node dist/cli/index.js test-ai <path> --no-run        # Generate but don't execute
node dist/cli/index.js test-ai <path> --no-coverage   # Skip coverage reporting
node dist/cli/index.js test-ai <path> --model opus    # Use Claude Opus for complex tests

# Incremental Testing ✅ IMPLEMENTED (Phase 6)
node dist/cli/index.js incremental <path>             # Smart test updates based on Git changes
node dist/cli/index.js incremental <path> --dry-run   # Preview changes without executing
node dist/cli/index.js incremental <path> --baseline  # Create baseline for future comparisons
node dist/cli/index.js incremental <path> --stats     # View statistics and history
node dist/cli/index.js incremental <path> --cost-limit 5.00 # Set maximum cost for updates

# Watch Mode ✅ IMPLEMENTED (Phase 8.1)
node dist/cli/index.js watch <path>                   # Watch for changes and update tests automatically
node dist/cli/index.js watch <path> --debounce 1000   # Custom debounce delay (ms)
node dist/cli/index.js watch <path> --no-generate     # Monitor only, no test generation
node dist/cli/index.js watch <path> --auto-run        # Automatically run tests after generation
node dist/cli/index.js watch <path> --verbose         # Enable detailed logging
node dist/cli/index.js watch <path> --include "**/*.js" --exclude "**/node_modules/**" # Custom patterns
node dist/cli/index.js watch <path> --stats-interval 60 # Show statistics every 60 seconds
```

## Legacy Decoupled Approach (JavaScript)
```bash
npm run discover          # Analyze project structure
npm run init             # Set up testing configuration
npm run test             # Run all tests
npm run analyze          # Deep project analysis
npm run validate         # Validate setup
npm run update           # Safely update testing suite
npm run migrate          # Migrate configuration
npm run check-compatibility # Check project compatibility
```

## Template-Based Approach (Being Deprecated)
```bash
npm run init              # Initialize testing setup
npm test                  # Run all tests
npm run test:coverage     # Run with coverage report
npm run test:e2e         # Run E2E tests (if configured)
```

## Test Generation Validation ✅ NEW

The test generation system includes built-in validation to prevent creating unmaintainable test suites:

```bash
# Validation will automatically check test-to-source ratio (max 10x)
node dist/cli/index.js test <path>

# If ratio exceeds threshold, generation is blocked with clear warning:
# ⚠️  WARNING: Test generation would create 150 test files for 10 source files
#    This is a 15.0x ratio, which exceeds the recommended 10x maximum.
#    Options:
#    • Review your include/exclude patterns
#    • Use --force to bypass this check
#    • Consider using --only-logical for targeted test generation

# Override validation when you're confident about the ratio
node dist/cli/index.js test <path> --force
```

**Validation Thresholds**:
- **Warning threshold**: At 75% of maximum ratio, warning is displayed but generation continues
- **Maximum ratio**: Generation blocked unless `--force` flag used (default: 10x, configurable via `--max-ratio`)
- **Source file counting**: Automatically excludes test files, node_modules, build directories

**Customization Options**:
```bash
# Override ratio limit temporarily 
node dist/cli/index.js test <path> --max-ratio 20

# Configure permanently in .claude-testing.config.json
{
  "generation": {
    "maxTestToSourceRatio": 15
  }
}

# Skip validation entirely (use with caution)
node dist/cli/index.js test <path> --force
```

## Configuration Validation ✅ NEW

The system includes comprehensive validation for `.claude-testing.config.json` files:

```bash
# Validate configuration file structure and values
node dist/cli/index.js analyze <path> --validate-config

# Example output for valid configuration:
# 📋 Configuration Validation Results
# =====================================
# ✓ Configuration is valid
# 
# ⚠️  Warnings:
#   • High incremental cost limit may result in unexpected AI charges
# 
# 📊 Resolved Configuration:
# {
#   "include": ["src/**/*.{js,ts,jsx,tsx}"],
#   "exclude": ["**/*.test.*", "**/node_modules/**"],
#   "testFramework": "jest",
#   "aiModel": "claude-3-5-sonnet-20241022",
#   "features": { "coverage": true, ... }
# }
```

**Validation Features**:
- **Schema validation**: All properties checked against TypeScript interfaces
- **Value validation**: Ranges, enums, and format validation
- **Cross-validation**: Checks for conflicting configuration options
- **Helpful warnings**: Performance and cost optimization suggestions
- **Default merging**: Shows final configuration with defaults applied

## Verification Commands
```bash
# JavaScript/TypeScript
npm test && npm run test:coverage

# Python
pytest --cov

# Cross-platform file checks
ls -la src/**/__tests__/ 2>/dev/null || ls -la tests/ 2>/dev/null
```

## See Also
- 📖 **Configuration Guide**: [`/docs/configuration.md`](../configuration.md) - Complete .claude-testing.config.json reference
- 📖 **Development Workflow**: [`/docs/development/workflow.md`](../development/workflow.md)
- 📖 **Core Features**: [`/docs/features/core-features.md`](../features/core-features.md)