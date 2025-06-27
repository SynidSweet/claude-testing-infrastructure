# Decoupled Testing Suite

🚀 **A standalone, updatable testing repository that can test any compatible project without requiring modifications to the project's source code.**

## Core Architecture Principles

- **Complete Decoupling**: Testing suite exists as a separate git repository
- **Zero Project Modifications**: No changes required to target projects
- **Safe Updates**: Testing suite updates never break existing projects
- **Configuration-Driven**: Intelligent project discovery and testing
- **AI Agent Optimized**: Designed for autonomous AI agent operation

## Quick Start

### For Projects
```bash
# Clone the testing suite next to your project
git clone https://github.com/decoupled-testing-suite/core.git ai-testing-suite
cd ai-testing-suite

# Initialize testing for your project
npm install
npm run init

# Run tests
npm run test
```

### For AI Agents
```bash
# Initialize testing for current project
claude-init-testing

# Run all tests
claude-run-tests

# Update testing suite safely
claude-update-tests
```

## Project Structure

```
your-project/                    # Your main project (unchanged)
├── src/                        # Your project source code
├── package.json               # Your project dependencies
└── README.md                  # Your project docs

ai-testing-suite/              # Cloned testing repository
├── config/                    # Configuration system
│   ├── schemas/              # JSON schemas for validation
│   ├── adapters/             # Project type adapters
│   └── default-config.js     # Default configurations
├── core/                      # Core testing infrastructure
│   ├── discovery/            # Project analysis engines
│   ├── runners/              # Test execution engines
│   ├── interfaces/           # Stable API contracts
│   └── utils/                # Shared utilities
├── templates/                 # Test templates by project type
├── scripts/                   # Automation scripts
└── project-config.json       # Generated config for your project
```

## Key Features

### 🔍 Intelligent Project Discovery
- Automatically detects project type, frameworks, and structure
- Generates appropriate test strategies based on discovered code
- Supports React, Vue, Angular, Node.js, Python FastAPI/Flask/Django

### 🛡️ Safe Update System
- Semantic versioning with backward compatibility guarantees
- Automatic configuration migration
- Emergency rollback capabilities
- Pre-update validation and post-update verification

### 🤖 AI Agent Optimization
- Stable command interface that doesn't change between updates
- Clear, copy-pasteable instructions
- Built-in error recovery and troubleshooting
- Version-stable documentation

### ⚡ Framework Support
- **Frontend**: React, Vue, Angular with TypeScript support
- **Backend**: Node.js (Express, Fastify), Python (FastAPI, Flask, Django)
- **Testing**: Jest, Playwright, Cypress, pytest, coverage analysis
- **CI/CD**: GitHub Actions, GitLab CI, CircleCI integration

## Configuration Example

The testing suite automatically generates configuration based on your project:

```json
{
  "projectRoot": "../my-awesome-project",
  "projectType": "react-frontend-node-backend",
  "language": ["typescript", "javascript"],
  "framework": {
    "frontend": "react",
    "backend": "express",
    "database": "postgresql"
  },
  "testPatterns": {
    "unit": "**/*.{test,spec}.{js,ts,tsx}",
    "integration": "**/integration/**/*.{test,spec}.{js,ts}",
    "e2e": "**/e2e/**/*.{test,spec}.{js,ts}"
  },
  "coverage": {
    "threshold": {
      "global": 80,
      "functions": 80,
      "lines": 80,
      "statements": 80
    }
  }
}
```

## Usage Examples

### Initialize Testing for Existing Project
```bash
cd ai-testing-suite
npm run discover  # Analyze project structure
npm run init      # Set up testing configuration
npm run test      # Run all tests
```

### Run Specific Test Types
```bash
npm run test -- --type unit        # Unit tests only
npm run test -- --type integration # Integration tests only
npm run test -- --type e2e         # E2E tests only
npm run test -- --coverage         # With coverage report
```

### Update Testing Suite
```bash
npm run check-compatibility  # Check if update is safe
npm run update               # Perform safe update
npm run validate            # Verify everything still works
```

## Supported Project Types

| Project Type | Frontend | Backend | Database | Status |
|-------------|----------|---------|----------|---------|
| React + Node.js | React | Express/Fastify | PostgreSQL/MySQL | ✅ |
| Vue + Python | Vue | FastAPI/Flask | PostgreSQL/MongoDB | ✅ |
| Angular + Node.js | Angular | NestJS/Express | PostgreSQL/MySQL | ✅ |
| Python API | - | FastAPI/Flask/Django | PostgreSQL/MySQL | ✅ |
| Frontend Only | React/Vue/Angular | - | - | ✅ |
| Library/Package | - | - | - | ✅ |

## Interface Stability

The testing suite provides stable interfaces that remain compatible across updates:

```javascript
// These interfaces never change within major versions
const discovery = new ProjectDiscovery();
const results = await discovery.discoverComponents(projectRoot, config);

const runner = new TestRunner();
const testResults = await runner.runTests('unit', options);
```

## Version Compatibility

- **Major Version Changes**: Breaking changes to interfaces (rare)
- **Minor Version Changes**: New features, additional project support
- **Patch Version Changes**: Bug fixes, template improvements

The testing suite maintains backward compatibility and provides automatic migration tools.

## Agent Commands

### Stable Commands for AI Agents
```bash
# These commands remain stable across all updates
claude-init-testing    # Initialize testing for current project  
claude-run-tests      # Run all tests with analysis
claude-update-tests   # Safely update testing suite
claude-analyze-project # Analyze project structure and testability
```

## Advanced Configuration

### Custom Test Patterns
```json
{
  "testPatterns": {
    "unit": "src/**/*.test.{js,ts}",
    "integration": "tests/integration/**/*.spec.js",
    "e2e": "e2e/**/*.e2e.js"
  }
}
```

### Framework-Specific Settings
```json
{
  "framework": {
    "frontend": "react",
    "testing": {
      "unit": "jest",
      "e2e": "playwright"
    }
  }
}
```

### Environment Configuration
```json
{
  "environment": {
    "node": "16",
    "python": "3.9",
    "browser": ["chrome", "firefox"],
    "variables": {
      "NODE_ENV": "test",
      "DATABASE_URL": "postgresql://localhost/test_db"
    }
  }
}
```

## Migration and Updates

The testing suite includes robust migration tools:

```bash
# Check what will change in an update
npm run check-compatibility

# Migrate configuration to new version
npm run migrate

# Rollback to previous version if needed
git checkout v1.0.0  # Or use npm run rollback
```

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- 📖 [Documentation](docs/)
- 🐛 [Issue Tracker](https://github.com/decoupled-testing-suite/core/issues)
- 💬 [Discussions](https://github.com/decoupled-testing-suite/core/discussions)
- 🤖 [Agent Guide](AGENT_README.md)

---

**Built for the future of testing** - where testing infrastructure evolves independently while maintaining perfect compatibility with your projects.