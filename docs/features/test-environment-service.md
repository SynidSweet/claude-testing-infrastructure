# TestEnvironmentService

*Last updated: 2025-07-06 | New service extracted from StructuralTestGenerator*

## 🎯 Purpose

The TestEnvironmentService is a dedicated service responsible for creating and configuring test execution environments in the decoupled testing infrastructure. It handles the generation of package.json, framework configurations, and other necessary files for running tests external to the target project.

## 🏗️ Architecture

### Service-Oriented Design
- **Single Responsibility**: Focused exclusively on environment setup, extracted from StructuralTestGenerator
- **Dependency Injection**: Injected into test generators via constructor pattern
- **Configuration-Driven**: Uses ProjectAnalysis and TestGeneratorConfig for decisions
- **Non-Destructive**: Never overwrites existing user files

### Integration Pattern
```typescript
const environmentService = new TestEnvironmentService({
  analysis: projectAnalysis,
  config: testGeneratorConfig,
  dryRun: false
});

await environmentService.createEnvironment();
```

## 🔧 Core Features

### Environment Creation
- **Output Directory Setup**: Creates test directory structure
- **Package.json Generation**: Framework-aware dependency selection
- **Test Framework Config**: Jest, TypeScript, and other config files
- **Dependency Resolution**: Smart dependency selection based on detected frameworks

### Framework Support
- **Jest Configuration**: Environment setup (node/jsdom), coverage, test patterns
- **TypeScript Support**: tsconfig.json generation with proper compiler options
- **React Integration**: Testing library dependencies, jest-dom setup, mocking utilities
- **Vue/Angular Support**: Framework-specific testing dependencies

### File Generation Logic
1. **Check Existing Files**: Never overwrites user-created configurations
2. **Analyze Project Context**: Uses ProjectAnalysis for framework detection
3. **Select Dependencies**: Framework-aware dependency resolution
4. **Generate Configurations**: Creates minimal, working configurations
5. **Setup Test Environment**: Jest setup files, TypeScript configs

## 🎛️ Configuration Interface

### TestEnvironmentConfig
```typescript
interface TestEnvironmentConfig {
  analysis: ProjectAnalysis;     // Project analysis results
  config: TestGeneratorConfig;   // Test generator configuration
  dryRun?: boolean;              // Skip actual file creation
}
```

### Supported Frameworks
- **JavaScript/TypeScript**: Jest, Vitest configuration
- **React**: Testing Library setup, jest-dom, component testing environment
- **Vue**: Vue Test Utils integration
- **Angular**: Angular Testing framework setup
- **Node.js**: Node environment configuration for backend testing

## 📁 Generated Files

### Package.json
- **Framework Dependencies**: Jest, TypeScript, testing libraries
- **Test Scripts**: test, test:watch, test:coverage commands
- **Project Metadata**: Name derived from target project
- **Private Flag**: Prevents accidental publication

### Jest Configuration
- **Environment Selection**: jsdom for frontend, node for backend
- **Coverage Settings**: Comprehensive coverage collection patterns
- **Module Extensions**: Support for JS, TS, JSX, TSX files
- **Transform Rules**: TypeScript and JSX transformation

### TypeScript Configuration
- **Compiler Options**: Optimized for testing environment
- **Module Resolution**: Node-style resolution
- **JSX Support**: React JSX configuration when React detected
- **Strict Mode**: Type safety without being overly restrictive

### React Jest Setup
- **jest-dom Integration**: Custom matchers for DOM testing
- **Mock Utilities**: ResizeObserver, matchMedia mocking
- **Environment Setup**: Global test configuration

## 🚀 Usage Examples

### Basic Environment Creation
```typescript
const service = new TestEnvironmentService({
  analysis: projectAnalysis,
  config: {
    outputPath: '/path/to/.claude-testing',
    projectPath: '/path/to/project',
    testFramework: 'jest'
  }
});

await service.createEnvironment();
```

### Dry Run Preview
```typescript
const service = new TestEnvironmentService({
  analysis: projectAnalysis,
  config: testConfig,
  dryRun: true  // Only logs what would be created
});

await service.createEnvironment();
```

## 🔄 Integration Points

### StructuralTestGenerator
- **Lifecycle Integration**: Called during preGenerate() phase
- **Service Injection**: Clean separation from test generation logic
- **Error Handling**: Graceful degradation if environment setup fails

### ProjectAnalyzer
- **Framework Detection**: Uses analysis results for configuration decisions
- **Language Support**: TypeScript/JavaScript detection drives config generation
- **Module System**: CommonJS/ESM detection affects configuration

### Configuration System
- **Test Framework Selection**: Respects user's test framework choice
- **Output Path Management**: Uses configured output directory
- **Dry Run Support**: Integrates with global dry-run functionality

## 📊 Impact

### Code Organization
- **Line Reduction**: Reduced StructuralTestGenerator from 1205 to 942 lines (22% reduction)
- **Separation of Concerns**: Clear boundary between test generation and environment setup
- **Maintainability**: Isolated environment logic easier to test and modify

### Architecture Benefits
- **Service Pattern**: Follows established service-oriented architecture
- **Testability**: Environment logic can be unit tested independently
- **Reusability**: Service can be used by other test generators

## 🧪 Testing

### Unit Tests
- **Configuration Generation**: Validates package.json, Jest config, TypeScript config
- **Framework Detection**: Tests framework-specific dependency selection
- **File Existence Checks**: Ensures no overwrites of existing files
- **Dry Run Mode**: Validates preview functionality

### Integration Tests
- **End-to-End**: Environment creation → test execution workflow
- **Framework Compatibility**: Tests with various project types
- **Error Scenarios**: Handles permission issues, disk space, etc.

## 🔗 Related Documentation

- **Architecture**: [`/docs/architecture/overview.md`](../architecture/overview.md) - Service layer design
- **Test Generator**: [`test-generator.md`](./test-generator.md) - How environment service integrates
- **Development**: [`/docs/development/conventions.md`](../development/conventions.md) - Service patterns

---

**Key Benefit**: Clean separation of environment setup from test generation logic, improving code maintainability and enabling independent testing of environment creation functionality.