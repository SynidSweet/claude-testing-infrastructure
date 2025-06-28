# Commands Reference

*Last updated: 2025-06-28 | Phase 5.3 Complete*

## 🆕 Core CLI Commands (TypeScript Infrastructure)
```bash
# Project Analysis (Primary Interface)
npx claude-testing analyze <path>                 # Analyze project structure and frameworks
npx claude-testing analyze <path> --verbose       # Detailed analysis output
npx claude-testing analyze <path> --format json   # JSON output for integration
npx claude-testing analyze <path> --format markdown --output report.md # Generate markdown report

# Test Generation ✅ IMPLEMENTED
npx claude-testing test <path>                    # Generate comprehensive tests (structural)
npx claude-testing test <path> --only-structural  # Generate only structural tests (default)
npx claude-testing test <path> --only-logical     # Generate only AI-powered tests (coming soon)
npx claude-testing test <path> --coverage         # Include coverage analysis
npx claude-testing test <path> --config config.json # Use custom configuration
npx claude-testing test <path> --update           # Update existing tests (don't skip)

# Test Execution ✅ IMPLEMENTED
npx claude-testing run <path>                     # Run generated tests
npx claude-testing run <path> --framework jest    # Specify test framework (jest, pytest)
npx claude-testing run <path> --coverage          # Generate coverage reports
npx claude-testing run <path> --watch             # Run in watch mode
npx claude-testing run <path> --junit             # Generate JUnit XML reports
npx claude-testing run <path> --threshold "80"    # Set coverage threshold
npx claude-testing run <path> --threshold "statements:85,branches:80" # Detailed thresholds
npx claude-testing run <path> --config config.json # Use custom configuration

# Test Gap Analysis ✅ IMPLEMENTED (Phase 5.2)
npx claude-testing analyze-gaps <path>            # Analyze test gaps with enhanced reporting
npx claude-testing gaps <path>                    # Alias for analyze-gaps
npx claude-testing analyze-gaps <path> --format markdown --output report.md # Markdown report
npx claude-testing analyze-gaps <path> --format json --output gaps.json     # JSON schema output
npx claude-testing analyze-gaps <path> --include-details                    # Detailed gap breakdown
npx claude-testing analyze-gaps <path> --include-code-snippets              # Include code context
npx claude-testing analyze-gaps <path> --no-colors                          # Disable terminal colors
npx claude-testing analyze-gaps <path> --threshold 5                        # Set complexity threshold

# AI-Powered Test Generation ✅ IMPLEMENTED (Phase 5.3)
npx claude-testing generate-logical <path>        # Generate AI tests from gap analysis
npx claude-testing generate-logical <path> --gap-report gaps.json # Use existing gap report
npx claude-testing generate-logical <path> --model sonnet         # Choose Claude model
npx claude-testing generate-logical <path> --budget 5.00          # Set cost limit
npx claude-testing generate-logical <path> --dry-run              # Preview without generating
npx claude-testing generate-logical <path> --concurrent 5         # Set concurrent processes
npx claude-testing generate-logical <path> --output ./reports     # Save reports to directory

# Complete AI Workflow ✅ IMPLEMENTED (Phase 5.3)
npx claude-testing test-ai <path>                 # Complete workflow with AI enhancement
npx claude-testing test-ai <path> --budget 10.00  # Set AI generation budget
npx claude-testing test-ai <path> --no-ai         # Structural tests only
npx claude-testing test-ai <path> --no-run        # Generate but don't execute
npx claude-testing test-ai <path> --no-coverage   # Skip coverage reporting
npx claude-testing test-ai <path> --model opus    # Use Claude Opus for complex tests

# Watch Mode (Planned - Phase 6)
npx claude-testing watch <path>                   # Watch for changes and update tests
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