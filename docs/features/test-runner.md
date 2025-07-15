# TestRunner System

*Last updated: 2025-07-13 | Updated by: /document command | Jest ES modules configuration enhanced - NODE_OPTIONS handling, React ES modules support improved*

## Overview

The TestRunner System provides a framework-agnostic test execution engine that can run generated tests across different testing frameworks and languages. It forms the final piece of the complete testing workflow: analyze → generate → **run tests**.

## Architecture

### Core Components

1. **TestRunner Base Class** (`src/runners/TestRunner.ts`)
   - Abstract foundation with lifecycle management
   - Configuration validation and error handling
   - Common interfaces for all test runners

2. **Concrete Implementations**
   - **JestRunner** - JavaScript/TypeScript projects with Jest
   - **PytestRunner** - Python projects with pytest

3. **TestRunnerFactory** (`src/runners/TestRunnerFactory.ts`)
   - Automatic runner selection based on framework
   - Framework recommendation based on project analysis
   - Runtime registration of new runners

4. **CLI Integration** (`src/cli/commands/run.ts`)
   - User-friendly command interface
   - Progress indicators and error handling
   - Configuration loading and validation

## Features

### Framework Support

#### Jest Runner ✅ ENHANCED
- **Working Directory Resolution** ✅ FIXED - Proper rootDir calculation relative to test execution directory, resolves test discovery failures
- **Isolated Configuration** - Overrides project Jest config to prevent conflicts with proper path resolution
- **Node Environment** - Uses `node` environment to avoid jsdom dependency issues
- **Enhanced Configuration** - Includes `.js` test files in testMatch patterns with correct rootDir and testPathIgnorePatterns
- **ES Module Support** - Automatic detection and configuration for ES module projects:
  - Detects `"type": "module"` in package.json
  - Configures `ts-jest/presets/default-esm` for TypeScript ES modules
  - Sets `extensionsToTreatAsEsm: ['.ts']` for proper module handling
  - Adds `moduleNameMapper` for `.js` extension resolution
  - Configures transform with `useESM: true` option
- **Dual Module System** - Supports both CommonJS and ES modules with appropriate import syntax
- **JSON Output Parsing** - Structured test result extraction
- **Coverage Integration** - Istanbul coverage with HTML/JSON reports
- **Watch Mode** - Continuous testing during development
- **JUnit XML** - CI/CD integration reports

#### Pytest Runner
- **Text Output Parsing** - Robust test result extraction
- **Coverage Integration** - pytest-cov with multiple reporters
- **Python Frameworks** - FastAPI, Django, Flask support
- **Async Testing** - Native async function support
- **JUnit XML** - CI/CD integration reports

### Configuration Options

```typescript
interface TestRunnerConfig {
  projectPath: string;      // Target project directory
  testPath: string;         // Generated tests location
  framework: string;        // Test framework (jest, pytest)
  coverage?: CoverageConfig; // Coverage reporting
  watch?: boolean;          // Continuous testing
  reporter?: ReporterConfig; // Output formatting
}
```

### Coverage Configuration

```typescript
interface CoverageConfig {
  enabled: boolean;
  thresholds?: {
    statements?: number;
    branches?: number;
    functions?: number;
    lines?: number;
  };
  outputDir?: string;       // Coverage report location
  reporters?: string[];     // html, json, text, xml
}
```

## Usage Examples

### Basic Test Execution

```bash
# Run all generated tests
node dist/src/cli/index.js run /path/to/project

# Run with specific framework
node dist/src/cli/index.js run /path/to/project --framework jest
```

### Coverage Reporting

```bash
# Generate coverage report
node dist/src/cli/index.js run /path/to/project --coverage

# Set coverage thresholds
node dist/src/cli/index.js run /path/to/project --coverage --threshold "80"

# Detailed thresholds
node dist/src/cli/index.js run /path/to/project --coverage --threshold "statements:85,branches:80"
```

### Development Workflow

```bash
# Watch mode for continuous testing
node dist/src/cli/index.js run /path/to/project --watch

# CI/CD integration with JUnit reports
node dist/src/cli/index.js run /path/to/project --coverage --junit
```

## Test Result Processing

### Output Parsing

Each runner implements sophisticated output parsing:

- **Jest**: JSON format parsing with structured error extraction
- **Pytest**: Text format parsing with regex-based result extraction

### Result Structure

```typescript
interface TestResult {
  success: boolean;         // Overall pass/fail
  exitCode: number;         // Process exit code
  testSuites: number;       // Number of test files
  tests: number;            // Total test count
  passed: number;           // Successful tests
  failed: number;           // Failed tests
  skipped: number;          // Skipped tests
  duration: number;         // Execution time (ms)
  coverage?: CoverageResult; // Coverage data
  failures: TestFailure[];  // Detailed failure info
}
```

### Error Handling

- **Process Errors**: Graceful handling of test runner crashes
- **Parse Errors**: Fallback parsing strategies with improved Jest configuration
- **Configuration Errors**: Clear validation messages
- **File System Errors**: Proper error reporting
- **Coverage Parsing**: Robust error handling for malformed coverage data with graceful degradation

## Framework Detection

The system automatically recommends appropriate frameworks:

1. **Existing Framework**: Uses project's current test framework if supported
2. **Language-Based**: 
   - Python projects → pytest
   - JavaScript/TypeScript → Jest
3. **Framework-Specific**:
   - React projects → Jest
   - Vue projects → Jest
4. **Default Fallback**: Jest for unknown projects

## ES Modules Support ✅ ENHANCED

### Configuration Improvements
The JestRunner now provides enhanced ES modules support:

#### Environment Variables
- **NODE_OPTIONS**: Automatically sets `--experimental-vm-modules` for ES modules projects
- **Process Environment**: Proper environment variable inheritance in Jest processes

#### React ES Modules
- **Simplified Configuration**: Avoids complex JSX transformation issues
- **Test Environment**: Falls back to 'node' environment for compatibility
- **Framework Detection**: Automatically detects React projects for specialized handling

#### Module System Detection
```typescript
// Automatic detection based on project analysis
if (moduleSystem.type === 'esm') {
  // ES modules configuration applied
  config.extensionsToTreatAsEsm = ['.jsx'];
  config.moduleNameMapper = { '^(\\.{1,2}/.*)\\.jsx?$': '$1' };
  
  // NODE_OPTIONS set for Jest process
  env.NODE_OPTIONS = '--experimental-vm-modules';
}
```

#### Known Limitations
- **React JSX**: Complex JSX transformation in ES modules requires additional setup
- **Test Dependencies**: Some React testing libraries may need specific ES modules configuration

### ES Modules Best Practices
1. **Use `"type": "module"`** in package.json for ES modules projects
2. **Configure transforms** sparingly to avoid configuration conflicts
3. **Test incrementally** with simpler projects before complex React setups
4. **Check NODE_OPTIONS** inheritance in CI/CD environments

## Integration Points

### CLI Integration

```bash
# Available commands
node dist/src/cli/index.js run <path> [options]

# Options
--framework <framework>     # Specify test framework
--coverage                  # Generate coverage reports
--watch                     # Run in watch mode
--junit                     # Generate JUnit XML
--threshold <threshold>     # Coverage thresholds
--config <path>            # Custom configuration
```

### Project Workflow

1. **Generate Tests**: `node dist/src/cli/index.js test /path/to/project`
2. **Run Tests**: `node dist/src/cli/index.js run /path/to/project`
3. **Review Results**: Check `.claude-testing/` directory for reports

## File Structure

```
src/runners/
├── TestRunner.ts           # Abstract base class
├── JestRunner.ts          # Jest implementation
├── PytestRunner.ts        # Pytest implementation
├── TestRunnerFactory.ts   # Runner selection
└── index.ts              # Module exports

src/cli/commands/
└── run.ts                # CLI command implementation

tests/runners/
├── TestRunner.test.ts     # Base class tests
└── TestRunnerFactory.test.ts # Factory tests
```

## Technical Implementation Details

### Jest Configuration Working Directory Fix ✅ 2025-07-12

**Problem Solved**: Jest configurations were running from wrong directory context, causing 0 tests to execute.

**Root Cause**: Tests stored in `projectPath/.claude-testing/tests/` but Jest config referenced `<rootDir>/setupTests.js` without setting explicit rootDir, causing Jest to look for setup files in test directory instead of project root.

**Solution Implemented**:
```typescript
// Calculate rootDir relative to test execution directory
const testPath = this.config.testPath;      // /project/.claude-testing/tests
const projectPath = this.config.projectPath; // /project  
const rootDir = path.relative(testPath, projectPath); // ../..

const config: JestConfig = {
  rootDir: rootDir || '.',  // Points back to project root
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/\\.claude-testing/.*\\.claude-testing/'
  ],
  // Only include setupFiles if they exist
  ...(this.hasSetupFile() && {
    setupFilesAfterEnv: ['<rootDir>/setupTests.js']
  }),
};
```

**Key Improvements**:
- **Correct Path Resolution**: Jest now finds project files correctly using relative rootDir
- **Conditional Setup Files**: Only includes setup files if they actually exist in target project
- **Proper Ignore Patterns**: Uses `<rootDir>` prefix for consistent path resolution
- **TypeScript Interface**: Added `rootDir` property to JestConfig interface

**Impact**: Resolves critical validation criteria for test execution success rate in production projects.

## Test Coverage

The TestRunner system includes comprehensive test coverage:

- **24 test cases** covering all functionality
- **Mock implementations** for testing base class behavior
- **Factory pattern testing** for runner selection
- **Error handling validation** for edge cases
- **Configuration testing** for various scenarios

## Future Enhancements

### Phase 5 Integration
- **Gap Analysis**: Integration with test gap detection
- **AI Enhancement**: Intelligent test execution strategies
- **Incremental Testing**: Run only tests affected by changes

### Additional Frameworks
- **Vitest Support**: Modern Vite-based testing
- **Mocha Support**: Alternative JavaScript testing
- **Unittest Support**: Python standard library testing

### Advanced Features
- **Parallel Execution**: Concurrent test running
- **Result Caching**: Avoid redundant test execution
- **Performance Tracking**: Test execution metrics
- **Custom Reporters**: Extensible result formatting

## Dependencies

### Core Dependencies
- **child_process**: Test runner process spawning
- **fs/promises**: Async file system operations
- **path**: Cross-platform path handling

### CLI Dependencies
- **chalk**: Console output coloring
- **ora**: Progress spinner indicators
- **commander**: CLI argument parsing

### Testing Dependencies
- **jest**: Test framework for infrastructure tests
- **@types/jest**: TypeScript definitions

## Configuration Files

### Default Test Configuration
Generated tests use framework-appropriate configuration:

- **Jest**: `jest.config.js` with project-specific setup
- **Pytest**: Command-line configuration with coverage integration

### Custom Configuration
Users can provide custom configuration via:

- **CLI options**: Direct command-line parameters
- **Config files**: JSON configuration files
- **Environment variables**: Runtime configuration

## Error Recovery

### Graceful Degradation
- **Missing Tests**: Clear messaging when no tests found
- **Framework Issues**: Fallback to alternative parsing
- **Permission Errors**: Helpful troubleshooting guidance

### Debugging Support
- **Verbose Logging**: Detailed execution information
- **Debug Mode**: Additional diagnostic output
- **Error Context**: Rich error information with suggestions

This system provides the foundation for reliable, cross-platform test execution as part of the complete Claude Testing Infrastructure workflow.