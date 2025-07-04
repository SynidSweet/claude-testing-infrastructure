# Configuration Guide

*Complete reference for .claude-testing.config.json configuration files*

*Last updated: 2025-07-04 | Added init-config command and configuration templates for common frameworks*

## 🔄 Implementation Status

**ConfigurationService Phase 1 & 2 Complete + FileDiscoveryService Integration** (as of 2025-07-01): The core `ConfigurationService` has been implemented with centralized loading pipeline, source management, and comprehensive testing. **FileDiscovery Integration Complete**: Added `getFileDiscoveryConfig()` method enabling user configuration of file discovery patterns, cache behavior, and performance monitoring through .claude-testing.config.json. See [`/docs/planning/file-discovery-implementation-plan.md`](./planning/file-discovery-implementation-plan.md) for remaining implementation tasks.

## Overview

The Claude Testing Infrastructure uses `.claude-testing.config.json` files to customize test generation behavior for individual projects. This file should be placed in the root directory of your target project (not in the claude-testing infrastructure directory).

## Quick Start

### Using Configuration Templates (Recommended)

The easiest way to set up configuration is using the `init-config` command with pre-built templates:

```bash
# Auto-detect project type and create config
node dist/cli/index.js init-config /path/to/project

# Use specific template
node dist/cli/index.js init-config /path/to/project --template react-typescript

# Interactive setup with customization
node dist/cli/index.js init-config /path/to/project --interactive

# List available templates
node dist/cli/index.js init-config --list
```

Available templates:
- `react-typescript` - React applications with TypeScript
- `vue-typescript` - Vue.js applications with TypeScript and Vitest
- `nextjs-typescript` - Next.js applications with API routes
- `express-typescript` - Express.js APIs with TypeScript
- `node-javascript` - Node.js applications with JavaScript
- `python-django` - Django web applications with pytest

See [`/templates/config/README.md`](../templates/config/README.md) for detailed template documentation.

### Minimal Configuration

```json
{
  "include": ["src/**/*.js"],
  "testFramework": "jest"
}
```

### Typical Configuration

```json
{
  "include": ["src/**/*.{js,ts,jsx,tsx}", "lib/**/*.js"],
  "exclude": ["**/*.test.*", "**/vendor/**"],
  "testFramework": "jest",
  "features": {
    "coverage": true,
    "edgeCases": true,
    "integrationTests": true
  },
  "ai": {
    "maxCost": 5.00
  },
  "fileDiscovery": {
    "cache": {
      "enabled": true,
      "ttl": 300000
    },
    "patterns": {
      "testGeneration": {
        "additionalExcludes": ["**/legacy/**"]
      }
    },
    "performance": {
      "enableStats": true
    }
  }
}
```

### Advanced Configuration

```json
{
  "include": ["src/**/*.{js,ts,jsx,tsx,py}"],
  "exclude": ["**/*.test.*", "**/*.spec.*", "**/node_modules/**"],
  "testFramework": "auto",
  "aiModel": "claude-3-5-sonnet-20241022",
  "features": {
    "coverage": true,
    "edgeCases": true,
    "integrationTests": true,
    "unitTests": true,
    "mocks": true,
    "testData": true,
    "aiGeneration": true,
    "incremental": true
  },
  "generation": {
    "maxTestsPerFile": 25,
    "maxTestToSourceRatio": 5,
    "naming": {
      "testFileSuffix": ".spec",
      "testDirectory": "tests",
      "mockFileSuffix": ".mock"
    },
    "testTypes": ["unit", "integration", "component"]
  },
  "coverage": {
    "enabled": true,
    "thresholds": {
      "global": {
        "lines": 90,
        "functions": 85,
        "branches": 80,
        "statements": 90
      }
    },
    "formats": ["html", "json", "lcov"],
    "outputDir": "coverage-reports"
  },
  "incremental": {
    "enabled": true,
    "costLimit": 3.00,
    "maxFilesPerUpdate": 20,
    "git": {
      "baseBranch": "develop",
      "includeUncommitted": false
    }
  },
  "ai": {
    "enabled": true,
    "model": "claude-3-5-sonnet-20241022",
    "maxCost": 8.00,
    "timeout": 600000,
    "temperature": 0.2
  },
  "output": {
    "logLevel": "debug",
    "formats": ["console", "json"],
    "preserveFiles": true
  }
}
```

## Configuration Reference

### Root Level Options

#### `include` (string[])
File patterns to include for test generation.

- **Default**: `["src/**/*.{js,ts,jsx,tsx,py}", "lib/**/*.{js,ts,jsx,tsx,py}"]`
- **Examples**: 
  - `["src/**/*.js", "components/**/*.jsx"]`
  - `["lib/**/*.ts", "pages/**/*.tsx"]`
  - `["app/**/*.py", "models/**/*.py"]`

#### `exclude` (string[])
File patterns to exclude from test generation. ✅ **FIXED (2025-07-01)**: Exclude patterns now work correctly and are properly applied during test generation.

- **Default**: `["**/*.test.*", "**/*.spec.*", "**/node_modules/**", "**/.git/**", "**/dist/**", "**/build/**", "**/__pycache__/**", "**/coverage/**", "**/.claude-testing/**"]`
- **Common additions**: `["**/vendor/**", "**/tmp/**", "**/*.d.ts"]`
- **Pattern Support**: Uses fast-glob patterns with proper validation and debugging

#### `testFramework` (string)
Test framework to use for test generation.

- **Default**: `"auto"` (auto-detect based on project)
- **Options**: `"jest"`, `"vitest"`, `"pytest"`, `"mocha"`, `"chai"`, `"jasmine"`, `"auto"`
- **Recommendation**: Use `"auto"` unless you need to override detection

#### `aiModel` (string)
AI model to use for logical test generation.

- **Default**: `"claude-3-5-sonnet-20241022"`
- **Options**: 
  - `"claude-3-5-sonnet-20241022"` (recommended, balanced cost/quality)
  - `"claude-3-opus-20240229"` (highest quality, higher cost)
  - `"claude-3-haiku-20240307"` (fastest, lowest cost)

### Features Configuration

The `features` object controls which types of tests and functionality are enabled.

```json
{
  "features": {
    "coverage": true,
    "edgeCases": true,
    "integrationTests": true,
    "unitTests": true,
    "mocks": false,
    "testData": false,
    "aiGeneration": true,
    "incremental": true,
    "watch": false
  }
}
```

#### Feature Flags

| Flag | Default | Description |
|------|---------|-------------|
| `coverage` | `true` | Enable coverage analysis and reporting |
| `edgeCases` | `true` | Generate edge case tests using AI |
| `integrationTests` | `true` | Generate integration tests |
| `unitTests` | `true` | Generate unit tests |
| `mocks` | `false` | Generate mock files for dependencies |
| `testData` | `false` | Generate test data factories |
| `aiGeneration` | `true` | Enable AI-powered logical test generation |
| `incremental` | `true` | Enable incremental test updates |
| `watch` | `false` | Enable watch mode for real-time updates |

### Generation Configuration

The `generation` object controls test generation behavior.

```json
{
  "generation": {
    "maxTestsPerFile": 50,
    "maxTestToSourceRatio": 10,
    "naming": {
      "testFileSuffix": ".test",
      "testDirectory": "__tests__",
      "mockFileSuffix": ".mock"
    },
    "templates": {
      "react-component": "custom-react.template.js"
    },
    "testTypes": ["unit", "integration"]
  }
}
```

#### Generation Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `maxTestsPerFile` | number | `50` | Maximum tests per source file (1-1000) |
| `maxTestToSourceRatio` | number | `10` | Max ratio of test files to source files (1-100) |
| `testTypes` | string[] | `["unit", "integration"]` | Types of tests to generate |

#### Naming Conventions

| Option | Default | Description | Examples |
|--------|---------|-------------|----------|
| `testFileSuffix` | `".test"` | Test file suffix | `".test"`, `".spec"`, `"_test"` |
| `testDirectory` | `"__tests__"` | Test directory name | `"__tests__"`, `"tests"`, `"test"` |
| `mockFileSuffix` | `".mock"` | Mock file suffix | `".mock"`, `"__mocks__"` |

#### Test Types

- `"unit"` - Unit tests for individual functions/classes
- `"integration"` - Integration tests for component interactions
- `"component"` - Component tests for UI components
- `"api"` - API endpoint tests
- `"e2e"` - End-to-end tests
- `"performance"` - Performance and load tests

### Coverage Configuration

The `coverage` object controls coverage analysis and reporting.

```json
{
  "coverage": {
    "enabled": true,
    "thresholds": {
      "global": {
        "lines": 80,
        "functions": 80,
        "branches": 70,
        "statements": 80
      },
      "perFile": {
        "src/critical.js": {
          "lines": 100,
          "functions": 100
        }
      }
    },
    "formats": ["html", "json", "lcov"],
    "outputDir": "coverage-reports",
    "includeUntested": true
  }
}
```

#### Coverage Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | boolean | `true` | Enable coverage collection |
| `formats` | string[] | `["html", "json"]` | Report formats to generate |
| `outputDir` | string | `"coverage-reports"` | Output directory for reports |
| `includeUntested` | boolean | `true` | Include untested files in reports |

#### Coverage Formats

- `"html"` - Interactive HTML reports
- `"json"` - Machine-readable JSON data
- `"lcov"` - LCOV format for CI/CD integration
- `"text"` - Console text output
- `"markdown"` - Markdown format for documentation
- `"xml"` - XML format for Jenkins/other tools

#### Coverage Thresholds

Set minimum coverage percentages. Tests will fail if thresholds are not met.

- **Global thresholds**: Apply to entire project
- **Per-file thresholds**: Apply to specific files
- **Metrics**: `lines`, `functions`, `branches`, `statements`

### Incremental Testing Configuration

The `incremental` object controls incremental test updates based on file changes.

```json
{
  "incremental": {
    "enabled": true,
    "costLimit": 5.00,
    "maxFilesPerUpdate": 50,
    "git": {
      "enabled": true,
      "baseBranch": "main",
      "includeUncommitted": true
    },
    "baseline": {
      "autoCreate": true,
      "retentionDays": 30
    }
  }
}
```

#### Incremental Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | boolean | `true` | Enable incremental updates |
| `costLimit` | number | `5.00` | Max AI cost per update ($0.01-$100.00) |
| `maxFilesPerUpdate` | number | `50` | Max files to update per run (1-1000) |

#### Git Integration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | boolean | `true` | Use Git for change detection |
| `baseBranch` | string | `"main"` | Base branch for comparison |
| `includeUncommitted` | boolean | `true` | Include uncommitted changes |

### Watch Mode Configuration

The `watch` object controls real-time file monitoring.

```json
{
  "watch": {
    "enabled": false,
    "debounceMs": 1000,
    "patterns": ["src/**/*.js"],
    "autoRun": false,
    "autoGenerate": true
  }
}
```

#### Watch Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | boolean | `false` | Enable watch mode |
| `debounceMs` | number | `1000` | Debounce delay (100-10000ms) |
| `patterns` | string[] | (uses include) | Patterns to watch |
| `autoRun` | boolean | `false` | Auto-run tests after generation |
| `autoGenerate` | boolean | `true` | Auto-generate on file changes |

### AI Configuration

The `ai` object controls AI-powered test generation.

```json
{
  "ai": {
    "enabled": true,
    "model": "claude-3-5-sonnet-20241022",
    "maxCost": 10.00,
    "timeout": 900000,
    "temperature": 0.3,
    "customPrompts": {
      "react-component": "Generate comprehensive React component tests..."
    }
  }
}
```

#### AI Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | boolean | `true` | Enable AI test generation |
| `model` | string | `"claude-3-5-sonnet-20241022"` | AI model to use |
| `maxCost` | number | `10.00` | Max cost per session ($0.01-$100.00) |
| `timeout` | number | `900000` | Timeout in ms (30s-30m) |
| `temperature` | number | `0.3` | Creativity level (0.0-1.0) |

#### Temperature Guidelines

- `0.0-0.2`: Very focused, deterministic tests
- `0.3-0.5`: Balanced creativity and consistency (recommended)
- `0.6-1.0`: More creative, varied test approaches

### Output Configuration

The `output` object controls logging and report generation.

```json
{
  "output": {
    "logLevel": "info",
    "formats": ["console", "json"],
    "outputDir": ".claude-testing",
    "preserveFiles": true,
    "includeTimestamps": true
  }
}
```

#### Output Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `logLevel` | string | `"info"` | Console verbosity level |
| `formats` | string[] | `["console"]` | Output formats |
| `outputDir` | string | `".claude-testing"` | Output directory |
| `preserveFiles` | boolean | `true` | Keep generated files |
| `includeTimestamps` | boolean | `true` | Add timestamps to files |

#### Log Levels

- `"error"`: Only errors
- `"warn"`: Errors and warnings
- `"info"`: General information (recommended)
- `"debug"`: Detailed debugging info
- `"verbose"`: Maximum detail

## Configuration Examples

### React Project

```json
{
  "include": ["src/**/*.{js,jsx,ts,tsx}"],
  "exclude": ["**/*.test.*", "**/*.stories.*", "**/node_modules/**"],
  "testFramework": "jest",
  "features": {
    "coverage": true,
    "edgeCases": true,
    "integrationTests": true,
    "mocks": true
  },
  "generation": {
    "maxTestsPerFile": 30,
    "naming": {
      "testFileSuffix": ".test",
      "testDirectory": "__tests__"
    },
    "testTypes": ["unit", "component", "integration"]
  },
  "coverage": {
    "thresholds": {
      "global": {
        "lines": 85,
        "functions": 85,
        "branches": 75
      }
    },
    "formats": ["html", "lcov"]
  }
}
```

### Python Project

```json
{
  "include": ["src/**/*.py", "app/**/*.py"],
  "exclude": ["**/*_test.py", "**/**/migrations/**", "**/venv/**"],
  "testFramework": "pytest",
  "features": {
    "coverage": true,
    "edgeCases": true,
    "unitTests": true,
    "mocks": true
  },
  "generation": {
    "naming": {
      "testFileSuffix": "_test",
      "testDirectory": "tests"
    },
    "testTypes": ["unit", "integration"]
  },
  "coverage": {
    "thresholds": {
      "global": {
        "lines": 90,
        "functions": 85
      }
    },
    "formats": ["html", "json", "xml"]
  }
}
```

### Mixed Language Project

```json
{
  "include": [
    "frontend/**/*.{js,jsx,ts,tsx}",
    "backend/**/*.py",
    "shared/**/*.{js,ts}"
  ],
  "exclude": [
    "**/*.test.*",
    "**/*.spec.*",
    "**/node_modules/**",
    "**/__pycache__/**",
    "**/venv/**"
  ],
  "testFramework": "auto",
  "features": {
    "coverage": true,
    "edgeCases": true,
    "integrationTests": true,
    "unitTests": true
  },
  "generation": {
    "maxTestsPerFile": 40,
    "testTypes": ["unit", "integration", "api"]
  },
  "ai": {
    "maxCost": 15.00,
    "temperature": 0.2
  }
}
```

### CI/CD Optimized

```json
{
  "include": ["src/**/*.{js,ts}"],
  "exclude": ["**/*.test.*", "**/node_modules/**"],
  "testFramework": "jest",
  "features": {
    "coverage": true,
    "edgeCases": false,
    "aiGeneration": false
  },
  "generation": {
    "maxTestsPerFile": 20,
    "maxTestToSourceRatio": 3
  },
  "coverage": {
    "thresholds": {
      "global": {
        "lines": 80,
        "functions": 80,
        "branches": 70,
        "statements": 80
      }
    },
    "formats": ["lcov", "json", "junit"]
  },
  "output": {
    "logLevel": "warn",
    "formats": ["console", "junit"]
  }
}
```

## Validation and Troubleshooting

### Schema Validation

The configuration is validated against a JSON schema. You can validate your configuration using:

```bash
# Validate configuration during analysis
node dist/cli/index.js analyze /path/to/project --validate-config

# The schema is located at schemas/claude-testing.config.schema.json
```

### Common Issues

#### "Configuration file not found"
- Ensure `.claude-testing.config.json` is in your project root
- Check file permissions and spelling
- Verify JSON syntax is valid

#### "Invalid pattern in include/exclude"
- Use glob patterns: `**/*.js`, `src/**/*.{js,ts}`
- Avoid absolute paths
- Test patterns with tools like `fast-glob`

#### "Test framework not detected"
- Set `testFramework` explicitly instead of `"auto"`
- Ensure framework dependencies are installed
- Check supported frameworks list

#### "AI generation costs too high"
- Reduce `ai.maxCost` or `incremental.costLimit`
- Use `claude-3-haiku-20240307` for lower costs
- Enable `features.aiGeneration: false` for structural tests only

#### "Too many tests generated"
- Reduce `generation.maxTestsPerFile`
- Lower `generation.maxTestToSourceRatio`
- Add more specific exclude patterns

### Performance Optimization

#### Large Projects
```json
{
  "generation": {
    "maxTestsPerFile": 25,
    "maxTestToSourceRatio": 5
  },
  "incremental": {
    "maxFilesPerUpdate": 20,
    "costLimit": 3.00
  },
  "ai": {
    "timeout": 600000
  }
}
```

#### Cost Control
```json
{
  "ai": {
    "model": "claude-3-haiku-20240307",
    "maxCost": 2.00,
    "temperature": 0.1
  },
  "incremental": {
    "costLimit": 1.00
  },
  "features": {
    "edgeCases": false
  }
}
```

## Best Practices

### 1. Start Simple
Begin with minimal configuration and add options as needed:

```json
{
  "include": ["src/**/*.js"],
  "testFramework": "jest"
}
```

### 2. Use Incremental Testing
Enable incremental testing for active development:

```json
{
  "features": {
    "incremental": true
  },
  "incremental": {
    "costLimit": 3.00,
    "maxFilesPerUpdate": 20
  }
}
```

### 3. Configure Coverage Appropriately
Set realistic coverage thresholds:

```json
{
  "coverage": {
    "thresholds": {
      "global": {
        "lines": 80,
        "functions": 75,
        "branches": 70
      }
    }
  }
}
```

### 4. Control AI Costs
Monitor and limit AI generation costs:

```json
{
  "ai": {
    "maxCost": 5.00,
    "model": "claude-3-5-sonnet-20241022"
  },
  "incremental": {
    "costLimit": 2.00
  }
}
```

### 5. Optimize for Your Team
Adjust verbosity and output for your workflow:

```json
{
  "output": {
    "logLevel": "info",
    "formats": ["console", "json"],
    "preserveFiles": true
  }
}
```

## Integration with IDEs

### VS Code
Add to your VS Code settings for JSON schema validation:

```json
{
  "json.schemas": [
    {
      "fileMatch": [".claude-testing.config.json"],
      "url": "./schemas/claude-testing.config.schema.json"
    }
  ]
}
```

### IntelliJ/WebStorm
The JSON schema will be automatically detected for IntelliSense support.

## Migration Guide

### From v1.x Configuration

Old format:
```json
{
  "patterns": {
    "include": ["src/**/*.js"],
    "exclude": ["**/*.test.js"]
  },
  "framework": "jest"
}
```

New format:
```json
{
  "include": ["src/**/*.js"],
  "exclude": ["**/*.test.js"],
  "testFramework": "jest"
}
```

### Breaking Changes

- `patterns` object flattened to `include`/`exclude` arrays
- `framework` renamed to `testFramework`
- `ai.model` now uses specific model identifiers
- Added required `generation.maxTestToSourceRatio` validation

## Configuration Sources

The Claude Testing Infrastructure loads configuration from multiple sources in the following precedence order (highest to lowest):

1. **CLI Arguments** - Command-line flags override all other settings
2. **Environment Variables** - For CI/CD and containerized environments
3. **Project Configuration** - `.claude-testing.config.json` in target project
4. **User Configuration** - Global user preferences
5. **Default Configuration** - Built-in defaults

### Environment Variables

All configuration options can be set via environment variables using the `CLAUDE_TESTING_` prefix. This is particularly useful for CI/CD environments.

#### Environment Variable Reference

| Configuration Path | Environment Variable | Type | Example |
|-------------------|---------------------|------|---------|
| `aiModel` | `CLAUDE_TESTING_AI_MODEL` | string | `claude-3-5-sonnet-20241022` |
| `testFramework` | `CLAUDE_TESTING_TEST_FRAMEWORK` | string | `jest` |
| `include` | `CLAUDE_TESTING_INCLUDE` | comma-separated | `src/**/*.js,lib/**/*.js` |
| `exclude` | `CLAUDE_TESTING_EXCLUDE` | comma-separated | `**/*.test.*,**/node_modules/**` |
| `features.coverage` | `CLAUDE_TESTING_COVERAGE` | boolean | `true` |
| `features.edgeCases` | `CLAUDE_TESTING_EDGE_CASES` | boolean | `true` |
| `features.integrationTests` | `CLAUDE_TESTING_INTEGRATION_TESTS` | boolean | `true` |
| `features.unitTests` | `CLAUDE_TESTING_UNIT_TESTS` | boolean | `true` |
| `features.mocks` | `CLAUDE_TESTING_MOCKS` | boolean | `false` |
| `features.aiGeneration` | `CLAUDE_TESTING_AI_GENERATION` | boolean | `true` |
| `features.incremental` | `CLAUDE_TESTING_INCREMENTAL` | boolean | `true` |
| `features.watch` | `CLAUDE_TESTING_WATCH` | boolean | `false` |
| `generation.maxTestsPerFile` | `CLAUDE_TESTING_MAX_TESTS_PER_FILE` | integer | `50` |
| `generation.maxTestToSourceRatio` | `CLAUDE_TESTING_MAX_TEST_TO_SOURCE_RATIO` | float | `10.0` |
| `coverage.enabled` | `CLAUDE_TESTING_COVERAGE_ENABLED` | boolean | `true` |
| `coverage.threshold` | `CLAUDE_TESTING_COVERAGE_THRESHOLD` | integer | `80` |
| `ai.batchSize` | `CLAUDE_TESTING_AI_BATCH_SIZE` | integer | `20` |
| `ai.maxConcurrency` | `CLAUDE_TESTING_AI_MAX_CONCURRENCY` | integer | `5` |
| `ai.maxCost` | `CLAUDE_TESTING_AI_MAX_COST` | float | `10.00` |
| `ai.timeout` | `CLAUDE_TESTING_AI_TIMEOUT` | integer | `900000` |
| `ai.temperature` | `CLAUDE_TESTING_AI_TEMPERATURE` | float | `0.3` |
| `output.logLevel` | `CLAUDE_TESTING_LOG_LEVEL` | string | `info` |
| `output.formats` | `CLAUDE_TESTING_OUTPUT_FORMATS` | comma-separated | `console,json` |
| `output.outputDir` | `CLAUDE_TESTING_OUTPUT_DIR` | string | `.claude-testing` |

#### CI/CD Examples

**GitHub Actions:**
```yaml
env:
  CLAUDE_TESTING_AI_MODEL: claude-3-5-sonnet-20241022
  CLAUDE_TESTING_COVERAGE: true
  CLAUDE_TESTING_COVERAGE_THRESHOLD: 85
  CLAUDE_TESTING_MAX_TEST_TO_SOURCE_RATIO: 5.0
  CLAUDE_TESTING_LOG_LEVEL: debug
```

**GitLab CI:**
```yaml
variables:
  CLAUDE_TESTING_TEST_FRAMEWORK: pytest
  CLAUDE_TESTING_COVERAGE_ENABLED: "true"
  CLAUDE_TESTING_OUTPUT_FORMATS: "junit,json"
  CLAUDE_TESTING_AI_MAX_COST: "2.50"
```

**Docker:**
```dockerfile
ENV CLAUDE_TESTING_AI_MODEL=claude-3-5-sonnet-20241022
ENV CLAUDE_TESTING_COVERAGE=true
ENV CLAUDE_TESTING_LOG_LEVEL=info
ENV CLAUDE_TESTING_OUTPUT_DIR=/test-results
```

**Shell Script:**
```bash
export CLAUDE_TESTING_TEST_FRAMEWORK=jest
export CLAUDE_TESTING_COVERAGE=true
export CLAUDE_TESTING_COVERAGE_THRESHOLD=90
export CLAUDE_TESTING_INCLUDE="src/**/*.ts,lib/**/*.ts"
export CLAUDE_TESTING_EXCLUDE="**/*.test.*,**/node_modules/**"

node dist/cli/index.js test /path/to/project
```

### User Configuration

Global user preferences can be stored in the following locations (first found is used):

1. `~/.claude-testing.config.json`
2. `~/.config/claude-testing/config.json`
3. `~/.claude-testing/config.json`

#### User Configuration Example

Create `~/.claude-testing.config.json`:

```json
{
  "aiModel": "claude-3-5-sonnet-20241022",
  "features": {
    "coverage": true,
    "edgeCases": true,
    "aiGeneration": true
  },
  "ai": {
    "maxCost": 5.00,
    "temperature": 0.3
  },
  "output": {
    "logLevel": "info",
    "formats": ["console", "json"]
  }
}
```

This configuration will be used for all projects unless overridden by project-specific configuration or environment variables.

### Configuration Precedence Example

Given the following configurations:

**User Config** (`~/.claude-testing.config.json`):
```json
{
  "aiModel": "claude-3-opus-20240229",
  "coverage": { "enabled": true }
}
```

**Project Config** (`.claude-testing.config.json`):
```json
{
  "testFramework": "jest",
  "coverage": { "enabled": false }
}
```

**Environment Variable**:
```bash
export CLAUDE_TESTING_COVERAGE_ENABLED=true
```

**CLI Command**:
```bash
node dist/cli/index.js test /project --ai-model sonnet
```

**Result**: The effective configuration will be:
- `aiModel`: "claude-3-5-sonnet-20241022" (from CLI mapping)
- `testFramework`: "jest" (from project config)
- `coverage.enabled`: true (from environment variable)

### File Discovery Configuration ✅ NEW

Configure file discovery behavior, pattern overrides, and performance monitoring:

```json
{
  "fileDiscovery": {
    "cache": {
      "enabled": true,
      "ttl": 300000,
      "maxSize": 1000
    },
    "patterns": {
      "projectAnalysis": {
        "additionalExcludes": ["**/build/**", "**/custom-ignore/**"],
        "additionalIncludes": ["special/**/*.ts"]
      },
      "testGeneration": {
        "replaceExcludes": ["**/only-exclude-this/**"]
      },
      "testExecution": {
        "additionalExcludes": ["**/slow-tests/**"]
      }
    },
    "performance": {
      "enableStats": true,
      "logSlowOperations": true,
      "slowThresholdMs": 1000
    }
  }
}
```

#### Cache Configuration
- **enabled**: Enable/disable file discovery caching (default: true)
- **ttl**: Cache time-to-live in milliseconds (default: 300000 = 5 minutes)
- **maxSize**: Maximum cache entries (default: 1000)

#### Pattern Override Types
- **additionalExcludes**: Add patterns to default excludes
- **additionalIncludes**: Add patterns to default includes
- **replaceExcludes**: Replace default exclude patterns entirely
- **replaceIncludes**: Replace default include patterns entirely

#### Discovery Types
- **projectAnalysis**: Patterns for project structure analysis
- **testGeneration**: Patterns for finding files to generate tests for
- **testExecution**: Patterns for finding existing test files
- **custom**: User-defined pattern operations

#### Performance Monitoring
- **enableStats**: Log detailed file discovery statistics (default: false)
- **logSlowOperations**: Warn about slow discovery operations (default: true)
- **slowThresholdMs**: Threshold for "slow" operations in milliseconds (default: 1000)

### Debugging Configuration

To see which configuration sources are being used:

```bash
# Enable debug logging
export CLAUDE_TESTING_LOG_LEVEL=debug
node dist/cli/index.js test /project

# Or use CLI flag (when implemented)
node dist/cli/index.js test /project --show-config-sources
```

---

*This configuration guide covers all available options for the Claude Testing Infrastructure. For additional help, see the [troubleshooting guide](./troubleshooting.md) or [getting started guide](./getting-started.md).*