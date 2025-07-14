# Development Workflow

*Last updated: 2025-07-13 | Added dependency validation system and enhanced pre-commit hooks*

## Getting Started

### Prerequisites

- **Node.js**: Version 20+ (ES2022 support required)
- **npm**: Version 8+ (comes with Node.js)
- **Git**: For version control and incremental features
- **Claude CLI**: Required for AI features (Max subscription needed)

### Initial Setup

```bash
# Clone the repository
git clone https://github.com/SynidSweet/claude-testing-infrastructure.git
cd claude-testing-infrastructure

# Install dependencies
npm install

# Build the project
npm run build

# Verify installation
node dist/src/cli/index.js --version
# Should output: 2.0.0
```

### Claude CLI Setup (Local Development Only)

**🚨 IMPORTANT: Claude CLI is for local development only and should NOT be expected in CI/production environments.**

```bash
# Install Claude CLI if not present
# Follow instructions at https://claude.ai/cli

# Verify authentication
claude --version
claude config get

# Test AI functionality
node dist/src/cli/index.js analyze-gaps /path/to/test/project
```

**CI/Production Strategy:**
- ✅ **Structural tests**: Always run (no AI required)
- ⚠️ **AI tests**: Automatically skipped via `SKIP_AI_TESTS=1` environment variable
- 🎯 **Production validation**: Configured to skip AI checks in CI environment
- 📋 **Local validation**: Run full AI validation locally before pushing

## Development Environment

### Project Structure

```
claude-testing/
├── src/               # TypeScript source code
├── dist/              # Compiled JavaScript (gitignored)
├── tests/             # Test suites
├── scripts/           # Build and utility scripts
├── docs/              # Documentation
├── templates/         # Configuration templates
└── .claude-testing/   # Runtime test output (gitignored)
```

### Configuration Files

- **tsconfig.json**: TypeScript configuration (strict mode)
- **jest.config.js**: Test runner configuration
- **.eslintrc.js**: Linting rules
- **.prettierrc**: Code formatting rules

### Environment Variables

```bash
# Optional: Set log level
export CLAUDE_TESTING_LOG_LEVEL=debug

# Optional: Set Claude model preference
export CLAUDE_TESTING_AI_MODEL=claude-3-5-sonnet-20241022

# Optional: Disable color output
export NO_COLOR=1
```

## Core Development Workflow

### 1. Making Changes

```bash
# Create a feature branch
git checkout -b feature/your-feature-name

# Make your changes in src/
# Follow existing patterns and conventions

# Build to test changes
npm run build

# Test your changes
npm test
```

### 2. Running Tests

```bash
# Fast unit tests (6s)
npm run test:fast

# Core tests before commit (30s)
npm run test:core

# Full test suite (10 minutes)
npm run test:full

# Specific test file
npm test src/analyzers/ProjectAnalyzer.test.ts

# Watch mode during development
npm test -- --watch
```

### 3. Code Quality Checks

```bash
# Run linting
npm run lint

# Fix linting issues
npm run lint:fix

# Run type checking
npm run typecheck

# Format code
npm run format

# Validate dependencies
npm run validate:dependencies

# Complete validation
npm run validation:full
```

### 4. Testing Your Changes

#### Manual Testing

```bash
# Test with a sample project
node dist/src/cli/index.js analyze /path/to/test/project
node dist/src/cli/index.js test /path/to/test/project --dry-run
node dist/src/cli/index.js test /path/to/test/project
node dist/src/cli/index.js run /path/to/test/project --coverage
```

#### Integration Testing

```bash
# Run E2E tests
npm run test:e2e

# Test with real projects
npm run test:integration
```

### 5. Documentation Updates

After making changes:

```bash
# Update relevant documentation
# - API changes: Update docs/api/
# - New features: Update docs/features/
# - Architecture: Update docs/architecture/

# Update PROJECT_CONTEXT.md if needed
```

## Common Development Tasks

### Adding a New CLI Command

1. Create command file in `src/cli/commands/`
2. Implement command logic following existing patterns
3. Register in `src/cli/index.ts`
4. Add tests in `tests/cli/commands/`
5. Update documentation in `docs/commands/`

### Adding Language Support

1. Create new adapter in `src/adapters/`
2. Implement language detection in ProjectAnalyzer
3. Add templates in `src/generators/templates/`
4. Create test runner in `src/runners/`
5. Add comprehensive tests

### Modifying AI Integration

1. Changes go in `src/ai/` directory
2. Update ClaudeOrchestrator for process management
3. Modify AITaskPreparation for prompt changes
4. Test with mock AI responses first
5. Validate with real Claude CLI

## Debugging

### Enable Debug Logging

```bash
# Set debug log level
export CLAUDE_TESTING_LOG_LEVEL=debug

# Run with verbose output
node dist/src/cli/index.js analyze /path --verbose
```

### Common Issues

#### Build Failures
```bash
# Clean and rebuild
rm -rf dist/ node_modules/
npm install
npm run build
```

#### Test Failures
```bash
# Check for timing issues
npm run test:optimized  # Uses simplified timers

# Run specific test in isolation
npm test -- --testNamePattern="specific test name"
```

#### AI Generation Issues
```bash
# Test Claude CLI directly
claude --help

# Check API limits
node dist/src/cli/index.js analyze-gaps /path --dry-run
```

## Git Workflow

### Branch Naming
- Features: `feature/description`
- Fixes: `fix/description`
- Refactoring: `refactor/description`
- Documentation: `docs/description`

### Commit Messages
```
type(scope): brief description

Longer explanation if needed.

Fixes #123
```

Types: feat, fix, docs, style, refactor, test, chore

### Pull Request Process

1. Ensure all tests pass
2. Update documentation
3. Add/update tests for changes
4. Request review
5. Address feedback
6. Squash commits if needed

## Performance Optimization

### Development Performance

```bash
# Use optimized test configuration
npm run test:optimized

# Skip AI tests during development
npm test -- --testPathIgnorePatterns=ai

# Use watch mode for faster feedback
npm test -- --watch
```

### Runtime Performance

- Use FileDiscoveryService caching
- Batch AI operations
- Enable incremental generation
- Configure appropriate timeouts

## CI/CD Integration

### GitHub Actions

The project uses GitHub Actions for:
- Running tests on PRs
- Code quality checks
- Dependency validation and security checks
- Coverage reporting
- Production validation

### Local CI Simulation

```bash
# Run same checks as CI
npm run ci:local

# Production readiness check
npm run validation:production
```

## Troubleshooting

### Module Resolution Issues
- Ensure `npm run build` completed successfully
- Check for circular dependencies
- Verify import paths

### Timer Test Issues
- Use MockTimer for deterministic tests
- Inject timer dependencies
- Avoid real setTimeout in tests

### Configuration Loading
- Check precedence: CLI > env > project > user > defaults
- Use `--show-config-sources` flag
- Verify JSON syntax in config files

## Best Practices

1. **Follow existing patterns** - Consistency is key
2. **Write tests first** - TDD approach preferred
3. **Document as you go** - Update docs with code
4. **Use TypeScript strictly** - Avoid `any` types
5. **Handle errors gracefully** - Use Result pattern
6. **Optimize for AI agents** - Clear, predictable code
7. **Maintain backward compatibility** - Don't break APIs

## Resources

- **Architecture Guide**: [`/docs/architecture/overview.md`](../architecture/overview.md)
- **Conventions**: [`/docs/development/conventions.md`](./conventions.md)
- **API Reference**: [`/docs/api/`](../api/)
- **Planning**: [`/docs/planning/`](../planning/)

---

**Development Philosophy**: Build robust, testable, and maintainable code that serves both human developers and AI agents effectively.