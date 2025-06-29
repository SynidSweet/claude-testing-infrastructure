# Commands Reference

*Last updated: 2025-06-28 | Watch Mode Complete*

## 🆕 Core CLI Commands (TypeScript Infrastructure)
```bash
# Project Analysis (Primary Interface)
node dist/cli/index.js analyze <path>                 # Analyze project structure and frameworks
node dist/cli/index.js analyze <path> --verbose       # Detailed analysis output
node dist/cli/index.js analyze <path> --format json   # JSON output for integration
node dist/cli/index.js analyze <path> --format markdown --output report.md # Generate markdown report

# Test Generation ✅ IMPLEMENTED
node dist/cli/index.js test <path>                    # Generate comprehensive tests (structural)
node dist/cli/index.js test <path> --only-structural  # Generate only structural tests (default)
node dist/cli/index.js test <path> --only-logical     # Generate only AI-powered tests (coming soon)
node dist/cli/index.js test <path> --coverage         # Include coverage analysis
node dist/cli/index.js test <path> --config config.json # Use custom configuration
node dist/cli/index.js test <path> --update           # Update existing tests (don't skip)

# Test Execution ✅ IMPLEMENTED
node dist/cli/index.js run <path>                     # Run generated tests
node dist/cli/index.js run <path> --framework jest    # Specify test framework (jest, pytest)
node dist/cli/index.js run <path> --coverage          # Generate coverage reports
node dist/cli/index.js run <path> --watch             # Run in watch mode
node dist/cli/index.js run <path> --junit             # Generate JUnit XML reports
node dist/cli/index.js run <path> --threshold "80"    # Set coverage threshold
node dist/cli/index.js run <path> --threshold "statements:85,branches:80" # Detailed thresholds
node dist/cli/index.js run <path> --config config.json # Use custom configuration

# Test Gap Analysis ✅ IMPLEMENTED (Phase 5.2)
node dist/cli/index.js analyze-gaps <path>            # Analyze test gaps with enhanced reporting
node dist/cli/index.js gaps <path>                    # Alias for analyze-gaps
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
node dist/cli/index.js generate-logical <path> --output ./reports     # Save reports to directory

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
- 📖 **Development Workflow**: [`/docs/development/workflow.md`](../development/workflow.md)
- 📖 **Core Features**: [`/docs/features/core-features.md`](../features/core-features.md)