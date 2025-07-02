# ConfigurationService

*Centralized configuration management for the Claude Testing Infrastructure*

*Last updated: 2025-07-02 | Fixed critical environment variable parsing bugs and CLI threshold handling*

## Overview

The `ConfigurationService` provides a centralized, consistent way to load and manage configuration across all CLI commands in the Claude Testing Infrastructure. It implements a proper source precedence hierarchy and maintains detailed metadata about configuration loading.

## Core Features

### Source Precedence ✅ FIXED
Configuration sources are loaded and merged in order of precedence (highest to lowest):

1. **CLI Arguments** - Command-line flags and options (highest priority)
2. **Environment Variables** - System environment configuration
3. **Custom Configuration** - Files specified via `--config` flag
4. **Project Configuration** - `.claude-testing.config.json` in target project
5. **User Configuration** - Global user configuration files
6. **Default Configuration** - Built-in defaults (lowest priority)

### Source Management
- **Source tracking**: Maintains metadata for each configuration source
- **Error handling**: Tracks loading errors without failing the entire process
- **Load timestamps**: Records when each source was loaded
- **Validation**: Full validation using existing `ConfigurationManager`

### Discovery Algorithms
- **Project config**: Searches for `.claude-testing.config.json` in target project
- **User config**: Searches standard locations (`~/.claude-testing.config.json`, `~/.config/claude-testing/config.json`)

### Feature Integration
- **FileDiscoveryService Integration**: Provides `getFileDiscoveryConfig()` method for file discovery pattern customization and cache behavior
- **Pattern Management**: Supports user configuration of include/exclude patterns through `fileDiscovery.patterns` configuration
- **Performance Monitoring**: Enables/disables file discovery statistics and slow operation logging via `fileDiscovery.performance` settings
- **Custom files**: Supports `--config` flag for arbitrary configuration files

### Environment Variable Support ✅ ENHANCED (2025-07-02)
- **Prefix**: All environment variables use `CLAUDE_TESTING_` prefix
- **Advanced Mapping**: Comprehensive nested object mapping with proper camelCase conversion
- **Root-Level Properties**: Direct mapping for `testFramework`, `aiModel`, `costLimit`, `dryRun`
- **Nested Objects**: Automatic creation of nested structures (e.g., `CLAUDE_TESTING_FEATURES_COVERAGE` → `features.coverage`)
- **Type Parsing**: Smart type conversion for booleans (`true/false/1/0/yes/no`), numbers (int/float), and arrays (comma-separated)
- **Special Cases**: Handles complex mappings like `OUTPUT_FORMAT` → both `output.format` and `output.formats`
- **CI/CD Ready**: Full support for containerized and CI/CD environments with comprehensive precedence

### New Configuration Properties ✅ ADDED (2025-07-01)
The following properties were added to support complete CLI argument mapping:

#### Feature Control Properties
- **`features.logicalTests`** - Enable/disable AI-powered logical test generation
- **`features.structuralTests`** - Enable/disable template-based structural test generation
- **CLI Mapping**: `--only-logical` sets `structuralTests: false, logicalTests: true`
- **CLI Mapping**: `--only-structural` sets `logicalTests: false, structuralTests: true`

#### Output Configuration
- **`output.file`** - Specify output file path for analysis results
- **CLI Mapping**: `--output filename.json` sets `output.file: "filename.json"`
- **Environment**: `CLAUDE_TESTING_OUTPUT_FILE=analysis.json`

#### Incremental Testing
- **`incremental.showStats`** - Display statistics after incremental test updates
- **CLI Mapping**: `--stats` flag sets `incremental.showStats: true`
- **Environment**: `CLAUDE_TESTING_INCREMENTAL_SHOW_STATS=true`

#### Cost Management
- **`costLimit`** - Top-level cost limit for AI operations (replaces nested structure)
- **CLI Mapping**: `--cost-limit 25.50` sets `costLimit: 25.50`
- **Environment**: `CLAUDE_TESTING_COST_LIMIT=10.00`

### User Configuration Support ✅ IMPLEMENTED
- **Locations**: Checks multiple standard locations for user preferences
- **Cross-platform**: Works on Windows, macOS, and Linux
- **Format**: Standard `.claude-testing.config.json` format
- **Precedence**: Applied after defaults but before project config

## Implementation Details

### Core Class: ConfigurationService

```typescript
class ConfigurationService {
  constructor(options: ConfigurationServiceOptions)
  async loadConfiguration(): Promise<ConfigurationLoadResult>
  getConfiguration(): ClaudeTestingConfig
  getSources(): ConfigurationSource[]
  addSource(source: ConfigurationSource): void
  async hasProjectConfig(): Promise<boolean>
}
```

### Configuration Sources

```typescript
interface ConfigurationSource {
  type: ConfigurationSourceType
  data: PartialClaudeTestingConfig
  path?: string
  loaded: boolean
  errors: string[]
  loadedAt: Date
}
```

### Load Result

```typescript
interface ConfigurationLoadResult extends ConfigValidationResult {
  sources: ConfigurationSource[]
  config: ClaudeTestingConfig
  summary: {
    sourcesLoaded: number
    sourcesWithErrors: number
    totalErrors: number
    totalWarnings: number
  }
}
```

## Environment Variable Implementation ✅ ENHANCED (2025-07-02)

### Enhanced Parsing System

The environment variable parsing system was significantly enhanced to handle complex nested configuration objects:

#### Core Parsing Algorithm
1. **Discovery**: Scans all environment variables with `CLAUDE_TESTING_` prefix
2. **Path Conversion**: Converts underscore-separated paths to nested object paths
3. **Type Parsing**: Intelligent conversion based on value patterns:
   - **Booleans**: `true/false/1/0/yes/no` → boolean
   - **Numbers**: Integer and float detection with validation
   - **Arrays**: Comma-separated values with trimming
   - **Strings**: Default fallback type

#### Smart Object Mapping
```typescript
// Examples of environment variable mapping:
CLAUDE_TESTING_TEST_FRAMEWORK=pytest              → testFramework: "pytest"
CLAUDE_TESTING_AI_MODEL=claude-3-haiku-20240307   → aiModel: "claude-3-haiku-20240307" 
CLAUDE_TESTING_FEATURES_COVERAGE=true             → features.coverage: true
CLAUDE_TESTING_OUTPUT_FORMAT=json                 → output.format: "json" + output.formats: ["json"]
CLAUDE_TESTING_AI_OPTIONS_MAX_TOKENS=2048         → aiOptions.maxTokens: 2048
CLAUDE_TESTING_COVERAGE_THRESHOLDS_GLOBAL_STATEMENTS=85 → coverage.thresholds.global.statements: 85
```

#### Special Case Handling
- **Dual Properties**: `OUTPUT_FORMAT` sets both `format` and `formats` for compatibility
- **Verbose Mapping**: `OUTPUT_VERBOSE=true` sets both `output.verbose` and `output.logLevel: "verbose"`
- **Feature Aliases**: `FEATURES_MOCKING` maps to `features.mocks` (not `mocking`)
- **Root-Level Promotion**: `COST_LIMIT` bypasses nested structure for direct assignment

#### Implementation Files
- **Core Parser**: `src/config/ConfigurationService.ts` - `extractEnvConfig()` method
- **Value Parser**: `parseEnvValue()` - Type conversion logic
- **Path Mapper**: `setNestedValue()` - Object path creation with camelCase conversion
- **Special Cases**: `handleEnvMappingSpecialCases()` - Complex mapping scenarios

### Testing Coverage
```bash
# Run environment variable integration tests
npm test -- tests/integration/configuration/env-vars.test.ts

# Test specific scenarios
npm test -- tests/integration/configuration/env-vars.test.ts --testNamePattern="nested"
npm test -- tests/integration/configuration/env-vars.test.ts --testNamePattern="boolean"
```

## Critical Bug Fixes ✅ RESOLVED (2025-07-02)

### Environment Variable Parsing Issues

#### Issue 1: Incorrect Nested Object Structure
**Problem**: `CLAUDE_TESTING_FEATURES_INTEGRATION_TESTS=true` was creating:
```json
"features": {
  "Integration": {
    "Tests": true
  }
}
```

**Fix**: Added special case mapping in `handleEnvMappingSpecialCases()`:
```typescript
if (upperPath === 'FEATURES_INTEGRATION_TESTS') {
  if (!obj.features) obj.features = {};
  obj.features.integrationTests = value;
  // Clean up incorrectly parsed nested structure
  if (obj.features.Integration) {
    delete obj.features.Integration;
  }
}
```

#### Issue 2: Coverage Threshold Mapping
**Problem**: `CLAUDE_TESTING_COVERAGE_THRESHOLDS_GLOBAL_FUNCTIONS=85` wasn't mapping to `coverage.thresholds.global.functions`.

**Fix**: Added pattern-based special case handling:
```typescript
if (upperPath.startsWith('COVERAGE_THRESHOLDS_GLOBAL_')) {
  const thresholdType = path[path.length - 1];
  if (thresholdType) {
    if (!obj.coverage) obj.coverage = {};
    if (!obj.coverage.thresholds) obj.coverage.thresholds = {};
    if (!obj.coverage.thresholds.global) obj.coverage.thresholds.global = {};
    obj.coverage.thresholds.global[thresholdType.toLowerCase()] = value;
  }
}
```

#### Issue 3: CLI Threshold Override Behavior
**Problem**: CLI threshold arguments like `--threshold "lines:90"` were overriding all project config values with defaults.

**Fix**: Modified CLI threshold mapping to only set explicitly provided values:
```typescript
// Before (caused overrides)
global: {
  statements: thresholds.statements || 80,  // Default overwrote project config
  branches: thresholds.branches || 80,
  functions: thresholds.functions || 80,
  lines: thresholds.lines || 80
}

// After (preserves project config)
global: thresholds  // Only set the properties that were explicitly provided
```

### Configuration Precedence Validation

All configuration precedence tests now pass:
- ✅ Full precedence chain: CLI > env > custom > project > user > defaults
- ✅ Partial configuration merging from multiple sources
- ✅ Deep merge behavior for nested objects
- ✅ Array merging with proper override behavior
- ✅ Source tracking and override detection

## Configuration Debugging ✅ NEW

### --show-config-sources Flag
The new global `--show-config-sources` flag provides detailed insight into configuration resolution:

```bash
# Show configuration sources for any command
claude-testing analyze ./project --show-config-sources
claude-testing test ./project --show-config-sources --dry-run
claude-testing run ./project --show-config-sources --coverage
```

### Debugging Output
The flag displays:
- **Source precedence order** (highest to lowest priority)
- **Configuration values** provided by each source
- **Load status** and any errors for each source
- **Final resolved values** with clear precedence winners
- **Key configuration summary** for quick verification

### Enhanced Error Messages
Configuration validation now provides:
- **Context and suggestions** for invalid values
- **Similar field name suggestions** for typos (using Levenshtein distance)
- **Practical examples** for correct configuration
- **Documentation links** for complex configuration options

### Example Debugging Session
```bash
$ claude-testing test ./my-project --show-config-sources

🔍 Configuration Resolution Details
====================================

📊 Summary:
  • Sources loaded: 4
  • Total errors: 0
  • Total warnings: 1
  • Valid configuration: ✓ Yes

📂 Configuration Sources (in precedence order):
  1. ✓ cli-args
     Configuration provided:
       output: {...}
       dryRun: true

  2. ✗ env-vars
     (No environment variables found)

  3. ✓ project-config (./.claude-testing.config.json)
     Configuration provided:
       testFramework: jest
       include: [2 items]
       features: {...}

  4. ✓ defaults
     Configuration provided:
       [All default configuration values]

🎯 Key Resolved Values:
  • Test Framework: jest
  • AI Model: claude-3-5-sonnet-20241022
  • Include Patterns: src/**/*.js, lib/**/*.js
  • Dry Run: Yes (from CLI)
  • Cost Limit: None
```

## Usage Patterns

### Basic Usage
```typescript
import { ConfigurationService } from '../config/ConfigurationService';

const service = new ConfigurationService({ projectPath: '/path/to/project' });
const result = await service.loadConfiguration();

if (result.valid) {
  const config = service.getConfiguration();
  // Use configuration
}
```

### CLI Command Integration Pattern
```typescript
// In command file (e.g., analyze.ts, test.ts, run.ts)
const configService = new ConfigurationService({
  projectPath,
  ...(options.config && { customConfigPath: options.config }),
  includeEnvVars: true,
  includeUserConfig: true,
  cliArgs: options
});

const configResult = await configService.loadConfiguration();

if (!configResult.valid) {
  logger.warn('Configuration validation failed', { 
    errors: configResult.errors 
  });
}

const config = configResult.config;
```

### Helper Function
```typescript
import { loadCommandConfig } from '../config/ConfigurationService';

const result = await loadCommandConfig('/path/to/project', {
  cliArgs: { verbose: true, aiModel: 'claude-3-haiku-20240307' }
});
```

### Advanced Usage with Source Management
```typescript
const service = new ConfigurationService({ projectPath });

// Add custom source
service.addSource({
  type: ConfigurationSourceType.CUSTOM_FILE,
  data: customConfig,
  loaded: true,
  errors: [],
  loadedAt: new Date()
});

const result = await service.loadConfiguration();

// Inspect sources for debugging
const sources = service.getSources();
sources.forEach(source => {
  console.log(`${source.type}: ${source.loaded ? 'loaded' : 'failed'}`);
  if (source.errors.length > 0) {
    console.log(`Errors: ${source.errors.join(', ')}`);
  }
});
```

## Integration Status

### Implementation Complete ✅
- [x] ConfigurationService core implementation (TASK-CONFIG-001)
- [x] Integrated into all 8 CLI commands (TASK-CONFIG-002)
- [x] Environment variable support with `CLAUDE_TESTING_` prefix (TASK-CONFIG-003)
- [x] User configuration file support in standard locations (TASK-CONFIG-003)
- [x] Validation & Testing Enhancement complete (TASK-CONFIG-004)
- [x] CLI argument mapping implemented
- [x] Helper function `loadCommandConfig` available
- [x] Configuration debugging tools (`--show-config-sources` flag)
- [x] Enhanced validation error messages with context and suggestions
- [x] Configuration migration guide created
- [x] Comprehensive test coverage (8/8 existing tests passing)

### CLI Argument Mapping
The ConfigurationService now maps CLI arguments to configuration properties:

- `--verbose/--debug/--quiet` → `output.logLevel`
- `--format` → `output.formats`
- `--framework` → `testFramework`
- `--max-ratio` → `generation.maxTestToSourceRatio`
- `--enable-chunking` → AI chunking options (handled at implementation level)
- `--coverage` → `coverage.enabled`
- `--threshold` → `coverage.thresholds.global`
- `--watch` → `watch.enabled`

### Command Integration Patterns

All commands now follow a consistent pattern for configuration loading:

```typescript
// Using the helper function (recommended)
const configResult = await loadCommandConfig(projectPath, {
  customConfigPath: options.config,
  cliArgs: {
    verbose: options.verbose,
    aiModel: options.model,
    // ... other CLI arguments
  }
});

// Apply configuration
if (!configResult.valid) {
  logger.warn('Configuration validation warnings', { 
    warnings: configResult.warnings 
  });
}

const config = configResult.config;
```

### Recently Completed ✅
**TASK-CONFIG-004**: Validation & Testing Enhancement (4 hours) - COMPLETED
- [x] Configuration debugging features (`--show-config-sources` global flag)
- [x] Enhanced validation messages with context and suggestions
- [x] Comprehensive integration test suite (environment variables, precedence, command integration, validation)
- [x] Configuration migration guide created
- [x] Performance validation (<100ms load time confirmed)

**All critical configuration tasks completed. System is production-ready.**

## Testing

### Test Coverage
- ✅ **Constructor validation** with various options
- ✅ **Loading scenarios** including custom config files
- ✅ **Source management** and metadata tracking
- ✅ **Helper function** `loadCommandConfig` behavior
- ✅ **CLI integration** with argument mapping and precedence
- ✅ **Configuration source** tracking and validation
- ✅ **Error handling** for invalid configuration files
- ✅ **Integration tests** covering environment variables, precedence, and validation
- ✅ **Command integration** tests for all major CLI commands
- ✅ **Edge case validation** including malformed JSON and type mismatches

### Test Locations
- Core tests: `tests/config/ConfigurationService.test.ts` (8 tests, all passing)
- Integration tests: `tests/integration/configuration/` (4 comprehensive test suites)
  - `config-precedence.test.ts` - Configuration source precedence and merging
  - `env-vars.test.ts` - Environment variable parsing and integration
  - `command-integration.test.ts` - Command-specific configuration behavior
  - `validation.test.ts` - Validation logic and error handling

### Running Tests
```bash
# Core configuration tests
npx jest tests/config/ConfigurationService.test.ts

# Integration test suite
npx jest tests/integration/configuration/

# All configuration-related tests
npx jest tests/config/ tests/integration/configuration/
```

## Architecture Integration

### Backward Compatibility
- Maintains compatibility with existing `ConfigurationManager`
- Uses existing configuration types and validation
- Does not break current command implementations

### Future Commands
New commands should use the standardized pattern:

```typescript
import { loadCommandConfig } from '../config/ConfigurationService';

// In command implementation
const configResult = await loadCommandConfig(projectPath, {
  cliArgs: program.opts(),
  customConfigPath: program.config
});

if (!configResult.valid) {
  logger.error('Configuration errors:', configResult.errors);
  process.exit(1);
}

const config = configResult.config;
```

## Related Documentation

- **Configuration Guide**: [`/docs/configuration.md`](../configuration.md) - User configuration reference
- **Implementation Tasks**: [`/docs/planning/configuration-implementation-tasks.md`](../planning/configuration-implementation-tasks.md) - Phase 2 details
- **Architecture**: [`/docs/architecture/overview.md`](../architecture/overview.md#configuration-management-architecture) - System design
- **Types**: `src/types/config.ts` - TypeScript interfaces

---

The ConfigurationService establishes a solid foundation for consistent configuration management across the entire Claude Testing Infrastructure, resolving critical configuration loading issues while maintaining backward compatibility.