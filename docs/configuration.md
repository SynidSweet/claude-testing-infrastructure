# Configuration Guide

*Complete reference for .claude-testing.config.json configuration files*

## Overview

The Claude Testing Infrastructure uses `.claude-testing.config.json` files to customize test generation behavior for individual projects. This file should be placed in the root directory of your target project (not in the claude-testing infrastructure directory).

## Quick Start

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
File patterns to exclude from test generation.

- **Default**: `["**/*.test.*", "**/*.spec.*", "**/node_modules/**", "**/.git/**", "**/dist/**", "**/build/**", "**/__pycache__/**", "**/coverage/**", "**/.claude-testing/**"]`
- **Common additions**: `["**/vendor/**", "**/tmp/**", "**/*.d.ts"]`

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

---

*This configuration guide covers all available options for the Claude Testing Infrastructure. For additional help, see the [troubleshooting guide](./troubleshooting.md) or [getting started guide](./getting-started.md).*