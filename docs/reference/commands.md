# Key Commands Reference

## Template-Based Approach
```bash
npm run init              # Initialize testing setup
npm test                  # Run all tests
npm run test:coverage     # Run with coverage report
npm run test:e2e         # Run E2E tests (if configured)
```

## Decoupled Approach
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