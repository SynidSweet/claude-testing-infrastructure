# TestGenerator System

*Last updated: 2025-06-29 | Mixed-language project support added - file-specific test extensions*

## Overview

The TestGenerator system is the core test creation engine of the Claude Testing Infrastructure. It provides a flexible, extensible architecture for generating comprehensive test suites across multiple languages and frameworks.

## Architecture Components

### 1. TestGenerator Base Class (`src/generators/TestGenerator.ts`)

Abstract foundation that defines the test generation lifecycle:

```typescript
abstract class TestGenerator {
  async generateAllTests(): Promise<TestGenerationResult>
  protected abstract getFilesToTest(): Promise<string[]>
  protected abstract generateStructuralTestForFile(filePath: string): Promise<GeneratedTest | null>
  protected abstract getTestFileExtension(language?: string): string
}
```

**Key Features**:
- Lifecycle management (pre-generation, generation, post-generation)
- Configuration validation and error handling
- Naming conventions system with customizable patterns
- Progress tracking and comprehensive statistics
- Extensible hook system for custom behavior
- Mixed-language project support with file-specific extensions (2025-06-29)

### 2. StructuralTestGenerator (`src/generators/StructuralTestGenerator.ts`)

Concrete implementation that creates structural test scaffolding:

**Capabilities**:
- **File Analysis**: Detects language, framework, test type, exports, dependencies
- **Intelligent Filtering**: Skips existing tests, follows include/exclude patterns
- **Mock Generation**: Automatic mock file creation for dependencies
- **Setup Files**: Framework-specific setup file generation (setupTests.js, conftest.py)
- **Test Type Detection**: Components, services, utilities, APIs, hooks

**Supported Test Types**:
- `UNIT` - Basic unit tests for functions and classes
- `COMPONENT` - React/Vue component tests with testing-library
- `SERVICE` - API service tests with HTTP mocking
- `UTILITY` - Helper function tests
- `API` - Express/FastAPI endpoint tests
- `HOOK` - React hook tests

### 3. TestTemplateEngine (`src/generators/templates/TestTemplateEngine.ts`)

Framework-specific template system with intelligent fallback:

**Built-in Templates**:
- **JavaScript Jest**: Basic unit tests with CommonJS require() statements for Jest compatibility
- **React Component**: Testing Library integration with require() imports and snapshots
- **Express API**: Supertest-based endpoint testing using CommonJS modules
- **TypeScript Jest**: Type-safe testing with CommonJS require() for Jest execution
- **React TypeScript**: Typed component testing with CommonJS compatibility
- **Python pytest**: Class-based test structure with fixtures
- **FastAPI**: TestClient-based API testing
- **Django**: Django test client with database integration

**Template Selection Logic**:
1. Exact match (language + framework + test type)
2. Language + framework match
3. Language + test type match
4. Default framework fallback (jest for JS/TS, pytest for Python)
5. Language-only fallback

## File Analysis System

### Language Detection
```typescript
interface DetectedLanguage {
  name: 'javascript' | 'typescript' | 'python';
  confidence: number;
  files: string[];
  version?: string;
}
```

### Framework Detection
```typescript
interface DetectedFramework {
  name: 'react' | 'vue' | 'angular' | 'express' | 'fastapi' | 'django' | 'flask';
  confidence: number;
  version?: string;
  configFiles: string[];
}
```

### Smart Analysis Features
- **Export Extraction**: Finds all exported functions, classes, and components
- **Dependency Analysis**: Identifies imports and external dependencies
- **Component Detection**: React/Vue component identification
- **Async Code Detection**: Identifies async/await patterns
- **Test Type Inference**: Determines most appropriate test type based on file content

## Configuration System

### Generator Options
```typescript
interface TestGeneratorOptions {
  generateMocks?: boolean;           // Auto-generate mock files
  includeSetupTeardown?: boolean;    // Add setup/teardown code
  generateTestData?: boolean;        // Create test data factories
  addCoverage?: boolean;            // Include coverage requirements
  testTypes?: TestType[];           // Specific test types to generate
  namingConventions?: NamingConventions;
}
```

### Naming Conventions
```typescript
interface NamingConventions {
  testFileSuffix?: string;    // Default: '.test'
  testDirectory?: string;     // Default: '__tests__'
  mockFileSuffix?: string;    // Default: '.mock'
}
```

## Usage Examples

### Basic Test Generation
```typescript
import { StructuralTestGenerator } from './generators';

const config = {
  projectPath: '/path/to/project',
  outputPath: '/path/to/tests',
  testFramework: 'jest',
  options: {
    generateMocks: true,
    includeSetupTeardown: true
  }
};

const generator = new StructuralTestGenerator(config, analysis);
const result = await generator.generateAllTests();
```

### Custom Template Registration
```typescript
import { TestTemplateEngine } from './generators/templates/TestTemplateEngine';

const engine = new TestTemplateEngine();
engine.registerTemplate({
  name: 'custom-vue-test',
  language: 'javascript',
  framework: 'vue',
  testType: TestType.COMPONENT,
  generate: (context) => `// Custom Vue test for ${context.moduleName}`
});
```

### Framework-Specific Generation
```typescript
// React Component Test
const reactContext = {
  moduleName: 'Button',
  language: 'typescript',
  framework: 'react',
  testType: TestType.COMPONENT,
  isComponent: true,
  hasDefaultExport: true
};

// Generates testing-library/react test with:
// - render(<Button />)
// - snapshot testing
// - user interaction tests
// - accessibility checks
```

## Generated Test Examples

### React Component Test (TypeScript)
```typescript
import React from 'react';
import { render, screen, RenderResult } from '@testing-library/react';
import '@testing-library/jest-dom';
import Button from './Button';

describe('Button', () => {
  let renderResult: RenderResult;

  beforeEach(() => {
    renderResult = render(<Button />);
  });

  it('should render without crashing', () => {
    expect(renderResult.container).toBeInTheDocument();
  });

  it('should match snapshot', () => {
    expect(renderResult.container.firstChild).toMatchSnapshot();
  });
});
```

### FastAPI Test (Python)
```python
"""Tests for user_api FastAPI endpoints."""
import pytest
from fastapi.testclient import TestClient
from user_api import get_user, create_user

@pytest.fixture
def client():
    """Create test client."""
    from main import app
    return TestClient(app)

class TestUser_apiApi:
    """Test class for user_api API endpoints."""

    def test_get_user_get_success(self, client):
        """Test successful GET request for get_user."""
        response = client.get("/api/get_user")
        assert response.status_code == 200
        assert response.json() is not None
```

## Integration Points

### CLI Integration
```bash
# Generate tests using CLI
node dist/cli/index.js test /path/to/project --only-structural

# Generate with specific options
node dist/cli/index.js test /path/to/project --framework jest --generate-mocks
```

### ProjectAnalyzer Integration
The TestGenerator system integrates seamlessly with the ProjectAnalyzer:
- Uses language detection for template selection
- Leverages framework detection for test type inference
- Utilizes project structure analysis for file organization
- Incorporates complexity metrics for test prioritization

## Performance Features

### Incremental Generation
- **Change Detection**: Only regenerates tests for modified files
- **Dependency Tracking**: Updates tests when dependencies change
- **Caching**: Reuses analysis results for unchanged files
- **Parallel Processing**: Concurrent test generation for multiple files

### Memory Optimization
- **Streaming Analysis**: Processes large files without loading into memory
- **Lazy Loading**: Templates loaded on-demand
- **Garbage Collection**: Proper cleanup of temporary resources

## Quality Assurance

### Mixed-Language Project Support (2025-06-29)
The test generator now correctly handles mixed-language projects:
- **File-Specific Extensions**: Each file gets the correct test extension based on its language
  - Python files → `_test.py`
  - JavaScript files → `.test.js`
  - TypeScript files → `.test.ts`
- **Language Detection**: Analyzes each file individually rather than using project-wide language
- **Backward Compatible**: Optional language parameter maintains API compatibility

### Comprehensive Test Suite (61 Tests)
- **Base Class Tests**: Lifecycle, configuration, error handling
- **Structural Generator Tests**: File analysis, test generation, mock creation, mixed-language support
- **Template Engine Tests**: Template selection, fallback logic, custom templates
- **Integration Tests**: End-to-end generation workflows

### Error Handling
- **Graceful Degradation**: Continues generation even if some files fail
- **Detailed Error Reporting**: Specific error messages with context
- **Recovery Mechanisms**: Automatic retry for transient failures
- **Validation**: Configuration and input validation before processing

## Future Extensibility

### Adding New Languages
1. Create language adapter implementing core interfaces
2. Add language-specific templates to TestTemplateEngine
3. Update file extension mappings
4. Add comprehensive tests

### Adding New Frameworks
1. Create framework-specific template class
2. Register with TestTemplateEngine
3. Add framework detection logic to StructuralTestGenerator
4. Create example tests

### Adding New Test Types
1. Add to TestType enum
2. Create detection logic in determineTestType()
3. Add framework-specific templates for new type
4. Update documentation and examples

## See Also
- 📖 **Architecture Overview**: [`/docs/architecture/overview.md`](../architecture/overview.md)
- 📖 **Core Features**: [`/docs/features/core-features.md`](./core-features.md)
- 📖 **Development Workflow**: [`/docs/development/workflow.md`](../development/workflow.md)
- 📖 **Implementation Plan**: [`IMPLEMENTATION_PLAN_COMPLETE.md`](../../IMPLEMENTATION_PLAN_COMPLETE.md)