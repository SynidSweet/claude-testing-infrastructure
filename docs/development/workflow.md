# Development Workflow

*Last updated: 2025-07-05 | Added comprehensive safety testing documentation*

## 🚀 Getting Started

### Prerequisites
- **Node.js 18+**: Required for TypeScript compilation and CLI execution
- **Git**: Required for change detection and incremental testing
- **Claude CLI**: Required for AI-powered logical test generation
  ```bash
  # Install Claude Code CLI
  npm install -g @anthropic-ai/claude-code
  
  # Authenticate (requires Anthropic account with Max subscription)
  claude auth login
  ```

### Initial Setup

#### 1. Clone and Build
```bash
# Clone the repository
git clone https://github.com/SynidSweet/claude-testing-infrastructure.git
cd claude-testing-infrastructure

# Install dependencies
npm install

# Build the TypeScript infrastructure
npm run build

# Verify installation
node dist/cli/index.js --version
```

#### 2. Development Build
```bash
# Development build with watch mode
npm run dev

# Or manual build
npm run build
```

### Testing Infrastructure Setup

For JavaScript/Python projects requiring tests, this infrastructure can test itself and other projects:

#### Self-Testing
```bash
# Run the full test suite
npm test

# Run specific test categories
npm run test:unit                    # Core infrastructure tests
npm run test:integration            # Service integration tests
npm run test:ai-validation         # AI integration validation
npm run test:local-comprehensive   # Complete local test suite

# Run with coverage
npm run test:coverage
```

#### Testing Other Projects
```bash
# Initialize configuration for a project
node dist/cli/index.js init-config /path/to/project

# Analyze project structure
node dist/cli/index.js analyze /path/to/project --format markdown

# Generate tests (dry run first)
node dist/cli/index.js test /path/to/project --dry-run
node dist/cli/index.js test /path/to/project

# Execute tests with coverage
node dist/cli/index.js run /path/to/project --coverage
```

## 🔧 Development Environment

### Project Structure Overview
```
claude-testing-infrastructure/
├── src/                          # TypeScript source code
│   ├── cli/                      # CLI commands and interface
│   │   ├── index.ts             # Main CLI entry point
│   │   └── commands/            # Individual command implementations
│   ├── services/                # Core service layer
│   │   ├── FileDiscoveryService.ts      # Centralized file discovery
│   │   ├── ConfigurationService.ts     # Multi-source configuration
│   │   └── FileDiscoveryServiceFactory.ts  # Singleton factory
│   ├── analyzers/               # Project analysis engine
│   │   ├── ProjectAnalyzer.ts   # Language/framework detection
│   │   └── TestGapAnalyzer.ts   # Test coverage gap analysis
│   ├── generators/              # Test generation system
│   │   ├── TestGenerator.ts     # Main test generation orchestrator
│   │   ├── StructuralTestGenerator.ts   # Immediate structural tests
│   │   ├── base/                # Abstract base classes
│   │   ├── javascript/          # JavaScript/TypeScript generators
│   │   └── templates/           # Test templates and engines
│   ├── ai/                      # AI integration layer
│   │   ├── ClaudeOrchestrator.ts        # AI task management
│   │   ├── BatchedLogicalTestGenerator.ts   # Batch processing
│   │   └── AITaskPreparation.ts # Task preparation and optimization
│   ├── runners/                 # Test execution layer
│   │   ├── TestRunner.ts        # Framework-agnostic test runner
│   │   ├── JestRunner.ts        # Jest-specific implementation
│   │   └── CoverageReporter.ts  # Coverage analysis and reporting
│   ├── state/                   # State management
│   │   ├── TaskCheckpointManager.ts     # AI task checkpointing
│   │   └── index.ts             # State exports
│   ├── utils/                   # Utilities and helpers
│   │   ├── ProcessLimitValidator.ts     # Process limit validation
│   │   ├── retry-helper.ts      # Intelligent retry strategies
│   │   ├── config-validation.ts # Configuration validation
│   │   └── logger.ts            # Winston-based logging
│   └── types/                   # TypeScript type definitions
│       ├── config.ts            # Configuration interfaces
│       ├── ai-error-types.ts    # AI-specific error types
│       └── file-discovery-types.ts     # File discovery interfaces
├── templates/                   # Configuration templates
│   └── config/                  # Pre-built framework configurations
├── tests/                       # Test suite
├── docs/                        # Modular documentation
└── dist/                        # Compiled JavaScript output
```

### Key Development Files
- **Entry Point**: `src/cli/index.ts` - Main CLI command router
- **Core Services**: `src/services/` - Centralized service layer
- **AI Integration**: `src/ai/ClaudeOrchestrator.ts` - AI task management
- **Configuration**: `src/config/ConfigurationService.ts` - Multi-source config
- **Types**: `src/types/` - TypeScript interface definitions

## 🔨 Development Commands

### Build and Development
```bash
# Development workflow
npm run dev                      # Watch mode with automatic rebuilding
npm run build                    # Production build
npm run clean                    # Clean dist/ directory

# Code quality
npm run lint                     # ESLint with comprehensive rules
npm run lint:fix                 # Auto-fix linting issues
npm run format                   # Prettier formatting
npm run format:check             # Check formatting without changes

# Quality gates (pre-commit)
npm run quality:check            # Run all quality checks
npm run precommit               # Full pre-commit validation
```

### Testing Commands
```bash
# Core testing
npm test                         # Run main test suite
npm run test:watch              # Watch mode for test development
npm run test:coverage           # Generate coverage reports

# Specialized test suites
npm run test:unit               # Unit tests only
npm run test:integration        # Integration tests
npm run test:ai-validation      # AI integration validation
npm run test:local-comprehensive # Complete local test suite

# Validation and production readiness
npm run validation:production   # Production readiness assessment
npm run validation:report       # Generate validation reports
npm run validation:deployment   # Deployment checklist validation
```

### CLI Development and Testing
```bash
# Test CLI commands locally
node dist/cli/index.js analyze /path/to/test/project
node dist/cli/index.js test /path/to/test/project --dry-run
node dist/cli/index.js init-config /path/to/test/project

# Monitor and debug
node dist/cli/index.js monitor --testing-only
node dist/cli/index.js analyze /path/to/project --show-config-sources
```

## 🧪 Testing Strategy

### Test Categories

#### 1. **Infrastructure Tests** (`tests/`)
- **Unit Tests**: Individual component testing
- **Integration Tests**: Service interaction validation
- **Configuration Tests**: Multi-source configuration validation
- **File Discovery Tests**: Caching and pattern management

#### 2. **AI Validation Tests** (`tests/validation/ai-agents/`)
- **Claude CLI Integration**: Authentication and process management
- **Test Quality Validation**: Generated test assessment
- **End-to-End Workflows**: Complete generation pipeline testing
- **Timeout and Recovery**: Checkpoint and retry validation

#### 3. **Real-World Validation**
```bash
# Test with actual projects
mkdir test-projects && cd test-projects

# Clone test repositories
git clone https://github.com/facebook/react.git
git clone https://github.com/vercel/next.js.git

# Test infrastructure against real projects
cd ../
node dist/cli/index.js analyze test-projects/react --format markdown
node dist/cli/index.js test test-projects/react --dry-run
```

### Test Execution Environments

#### Local Development
- **Comprehensive Suite**: All tests including AI validation
- **Fast Feedback**: Watch mode for rapid iteration
- **Coverage Analysis**: Detailed coverage reporting

#### CI/CD Environment
- **Core Tests Only**: Infrastructure and integration tests
- **AI Tests Skipped**: Graceful degradation when Claude CLI unavailable
- **Multiple Platforms**: Ubuntu, macOS with Node.js 18, 20

### 🛡️ Safety Testing

#### Recursion Prevention
The infrastructure includes critical safety mechanisms to prevent catastrophic recursive testing:

```bash
# Set safety environment variable
export DISABLE_HEADLESS_AGENTS=true

# Use safe testing scripts
./run-safe-tests.sh              # Excludes AI tests entirely
./monitor-test-run.sh            # Smart monitoring (protects interactive sessions)
./test-one-ai-test.sh            # Test single files safely

# Check for risky tests
node safe-test-check.js          # Identifies process-spawning patterns
```

#### Smart Process Monitoring
The monitoring scripts distinguish between:
- **Headless Claude processes**: Spawned by tests (terminated if needed)
- **Interactive Claude sessions**: Your normal CLI usage (protected)

#### Safety Layers
1. **RecursionPreventionValidator**: Blocks testing infrastructure on itself
2. **DISABLE_HEADLESS_AGENTS**: Environment variable prevents AI spawning
3. **Process limits**: Maximum 5 concurrent Claude processes
4. **Emergency shutdown**: Immediate termination on limit violations
5. **Test auto-skip**: AI tests skip themselves when safety enabled

#### Testing the Infrastructure Safely
```bash
# NEVER run these on the infrastructure itself:
node dist/cli/index.js analyze .     # ❌ Blocked by recursion prevention
node dist/cli/index.js test .        # ❌ Would cause exponential spawning

# ALWAYS test on external projects:
node dist/cli/index.js analyze /path/to/other/project  # ✅ Safe
node dist/cli/index.js test /path/to/other/project     # ✅ Safe

# For infrastructure self-tests:
npm test                             # ✅ Uses built-in safety
DISABLE_HEADLESS_AGENTS=true npm test # ✅ Extra safety
```

### Writing Tests

#### Test Structure
```typescript
// Example test file: tests/services/FileDiscoveryService.test.ts
import { FileDiscoveryService } from '../../src/services/FileDiscoveryService';
import { FileDiscoveryConfig } from '../../src/types/file-discovery-types';

describe('FileDiscoveryService', () => {
  let service: FileDiscoveryService;
  let config: FileDiscoveryConfig;

  beforeEach(() => {
    config = {
      cache: { enabled: true, ttl: 300000, maxSize: 1000 },
      patterns: {},
      performance: { enableStats: false, logSlowOperations: true, slowThresholdMs: 1000 }
    };
    service = new FileDiscoveryService(config);
  });

  test('should discover JavaScript files', async () => {
    const files = await service.discoverFiles('/path/to/test', ['**/*.js']);
    expect(files).toBeDefined();
    expect(Array.isArray(files)).toBe(true);
  });
});
```

#### AI Integration Testing
```typescript
// Example AI test: tests/ai/ClaudeOrchestrator.test.ts
import { ClaudeOrchestrator } from '../../src/ai/ClaudeOrchestrator';

describe('ClaudeOrchestrator', () => {
  test('should handle authentication gracefully', async () => {
    const orchestrator = new ClaudeOrchestrator({
      gracefulDegradation: true
    });

    // Test graceful degradation when Claude CLI unavailable
    const result = await orchestrator.validateClaudeAuth();
    expect(result).toHaveProperty('authenticated');
    expect(result).toHaveProperty('canDegrade');
  });
});
```

## 🔄 Git Workflow

### Branch Strategy
- **main**: Production-ready code with comprehensive testing
- **feature/***: New features and enhancements
- **fix/***: Bug fixes and patches
- **refactor/***: Code refactoring without functional changes

### Commit Process
```bash
# Standard development workflow
git checkout -b feature/new-feature

# Make changes and test
npm run build
npm test

# Commit with descriptive message
git add .
git commit -m "feat: add new feature with comprehensive tests

- Implement feature X with Y capability
- Add comprehensive test coverage
- Update documentation

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>"

# Push and create PR
git push origin feature/new-feature
```

### Pre-commit Hooks
```bash
# Automatic quality checks before commit
.husky/pre-commit:
- npm run quality:check      # Lint, format, build verification
- npm run test:local-comprehensive  # Full test suite
```

## 🐛 Debugging and Troubleshooting

### Common Development Issues

#### TypeScript Compilation Errors
```bash
# Check TypeScript configuration
npx tsc --noEmit

# Fix import/export issues
npm run lint:fix

# Rebuild from clean state
npm run clean && npm run build
```

#### Test Failures
```bash
# Run specific test file
npm test -- --testPathPattern="FileDiscoveryService"

# Debug test with verbose output
npm test -- --verbose --testNamePattern="specific test name"

# Check test coverage
npm run test:coverage
```

#### Configuration Issues
```bash
# Debug configuration loading
node dist/cli/index.js analyze /path/to/project --show-config-sources

# Validate configuration
node dist/cli/index.js init-config /path/to/project --dry-run

# Check environment variables
env | grep CLAUDE_TESTING_
```

#### AI Integration Issues
```bash
# Verify Claude CLI installation
claude --version

# Test authentication
claude auth status

# Debug AI task processing
node dist/cli/index.js test /path/to/project --dry-run --verbose
```

### Development Tools

#### VS Code Configuration
```json
// .vscode/settings.json
{
  "typescript.preferences.importModuleSpecifier": "relative",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "jest.jestCommandLine": "npm test --"
}
```

#### Debug Configuration
```json
// .vscode/launch.json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug CLI",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/dist/cli/index.js",
      "args": ["analyze", "/path/to/test/project"],
      "console": "integratedTerminal"
    }
  ]
}
```

## 📝 Code Style and Conventions

### TypeScript Guidelines
- **Strict Mode**: Full type safety with `exactOptionalPropertyTypes`
- **Interface Design**: Prefer interfaces over types for public APIs
- **Error Handling**: Use discriminated unions for error types
- **Async/Await**: Prefer async/await over Promises for readability

### Architecture Patterns
- **Service-Oriented**: Centralized services with dependency injection
- **Factory Pattern**: Clean instantiation of language-specific components
- **Adapter Pattern**: Language-specific implementations with unified interfaces
- **Observer Pattern**: Event-driven architecture for progress reporting

### File Organization
- **Single Responsibility**: One primary class/function per file
- **Barrel Exports**: Use index.ts files for clean imports
- **Type Definitions**: Separate types in dedicated files
- **Interface Stability**: Maintain backward compatibility in public APIs

## 🚀 Deployment and Distribution

### Build Pipeline
```bash
# Production build
npm run build

# Verify build
node dist/cli/index.js --version

# Package validation
npm pack --dry-run
```

### Release Process
1. **Quality Gates**: All tests passing, lint clean, build successful
2. **Version Bump**: Semantic versioning (major.minor.patch)
3. **Documentation**: Update CHANGELOG.md and version documentation
4. **Release**: npm publish with appropriate tags

### CI/CD Integration
- **GitHub Actions**: Automated testing on multiple platforms
- **Quality Gates**: Lint, format, build, test validation
- **Coverage Reporting**: Automated coverage analysis
- **Dependency Security**: Automated security scanning

---

This workflow ensures consistent, high-quality development while maintaining the infrastructure's core mission of providing reliable, AI-enhanced testing capabilities.