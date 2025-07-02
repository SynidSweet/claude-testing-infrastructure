# Language-Specific Test Patterns Investigation Report

*Phase 1: Requirements Analysis for Language-Specific Test Generation*

*Created: 2025-07-02 | Status: In Progress | Part of Language-Specific Test Generators Investigation*

## Executive Summary

This investigation analyzes current test generation patterns and identifies language-specific requirements for JavaScript/TypeScript and Python test generation. The current system uses a single generator logic for all languages, leading to suboptimal test generation that doesn't follow language-specific idioms and best practices.

## Current State Analysis

### Test Generation Architecture

The current architecture consists of:
1. **TestGenerator** (abstract base) - Common interface for all generators
2. **StructuralTestGenerator** - Creates basic test scaffolding
3. **TestTemplateEngine** - Manages framework-specific templates
4. **Language Templates** - Individual template implementations

### Key Findings

1. **Single Generator Logic**: The `StructuralTestGenerator` uses the same logic flow for all languages
2. **Template-Based Differentiation**: Language differences are handled only at the template level
3. **Limited Context**: Templates receive the same context regardless of language-specific needs
4. **Missing Language Features**: No support for language-specific testing patterns

## JavaScript/TypeScript Test Patterns

### Current Implementation

```typescript
// Current JavaScript test generation pattern
describe('ModuleName', () => {
  it('should load the module without errors', () => {
    expect(ModuleName).toBeDefined();
  });
  
  // Basic existence tests for exports
  describe('exportName', () => {
    it('should be defined', () => {
      expect(exportName).toBeDefined();
    });
    
    it('should have the expected type', () => {
      const type = typeof exportName;
      expect(['function', 'object', 'string', 'number', 'boolean']).toContain(type);
    });
  });
});
```

### Required JavaScript-Specific Patterns

#### 1. **Module System Detection**
- CommonJS vs ES Modules require different import/export testing
- Dynamic imports need async test patterns
- Mixed module systems in same project

#### 2. **Framework-Specific Patterns**
- **React**: Component testing, hooks testing, context testing
- **Vue**: Component lifecycle, computed properties, watchers
- **Angular**: Dependency injection, services, directives
- **Express**: Middleware, route handlers, error handling
- **Nest.js**: Decorators, modules, providers

#### 3. **Async Pattern Testing**
```javascript
// Promise-based
it('should handle promises', async () => {
  await expect(asyncFunction()).resolves.toBe(expectedValue);
});

// Callback-based
it('should handle callbacks', (done) => {
  callbackFunction((err, result) => {
    expect(err).toBeNull();
    expect(result).toBe(expectedValue);
    done();
  });
});

// Observable-based (RxJS)
it('should handle observables', (done) => {
  observable$.subscribe({
    next: (value) => expect(value).toBe(expectedValue),
    complete: done
  });
});
```

#### 4. **Type Testing (TypeScript)**
```typescript
// Type guards
it('should correctly narrow types', () => {
  if (isUser(data)) {
    expect(data.name).toBeString();
    expect(data.age).toBeNumber();
  }
});

// Generic functions
it('should handle generic types', () => {
  const result = genericFunction<string>('test');
  expect(result).toBeString();
});
```

#### 5. **Mock Patterns**
```javascript
// Module mocking
jest.mock('../module', () => ({
  method: jest.fn()
}));

// Class mocking
const MockedClass = jest.mocked(OriginalClass);

// Timer mocking
jest.useFakeTimers();
```

### JavaScript Test Generation Requirements

1. **AST Analysis**
   - Detect module system (import/export vs require/module.exports)
   - Identify async patterns (async/await, promises, callbacks)
   - Extract JSDoc comments for test descriptions
   - Detect class vs function vs object exports

2. **Context Requirements**
   ```typescript
   interface JavaScriptTestContext extends TemplateContext {
     moduleSystem: 'commonjs' | 'esm' | 'mixed';
     asyncPatterns: Array<'promise' | 'callback' | 'observable'>;
     frameworkHooks?: string[]; // React hooks, Vue lifecycle, etc.
     typeDefinitions?: TypeInfo[]; // For TypeScript
     mockRequirements?: MockRequirement[];
   }
   ```

3. **Framework Detection**
   - Package.json dependencies analysis
   - Import pattern recognition
   - File naming conventions
   - Decorator usage (Angular, Nest.js)

## Python Test Patterns

### Current Implementation

```python
class TestModuleName:
    """Test class for module_name module."""
    
    def test_module_import_successful(self):
        """Test that the module can be imported without errors."""
        assert module_name is not None
    
    def test_function_exists(self):
        """Test that function is defined and importable."""
        assert function is not None
```

### Required Python-Specific Patterns

#### 1. **Testing Paradigms**
- **pytest**: Fixtures, parametrization, markers
- **unittest**: setUp/tearDown, test discovery
- **doctest**: Embedded documentation tests

#### 2. **Async Testing (asyncio)**
```python
@pytest.mark.asyncio
async def test_async_function():
    result = await async_function()
    assert result == expected_value

# Context manager testing
async def test_async_context_manager():
    async with AsyncContextManager() as manager:
        assert manager.is_connected
```

#### 3. **Framework-Specific Patterns**
- **Django**: TestCase, fixtures, client testing
- **FastAPI**: TestClient, dependency overrides
- **Flask**: app context, test client

```python
# FastAPI example
def test_read_main():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"message": "Hello World"}

# Django example
class ViewTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.user = User.objects.create_user('test')
    
    def test_view_response(self):
        response = self.client.get('/path/')
        self.assertEqual(response.status_code, 200)
```

#### 4. **Fixture Patterns**
```python
@pytest.fixture
def sample_data():
    return {"key": "value"}

@pytest.fixture(scope="module")
def database_connection():
    conn = create_connection()
    yield conn
    conn.close()

def test_with_fixture(sample_data, database_connection):
    assert sample_data["key"] == "value"
```

#### 5. **Parametrized Testing**
```python
@pytest.mark.parametrize("input,expected", [
    (1, 2),
    (2, 4),
    (3, 6),
])
def test_double(input, expected):
    assert double(input) == expected
```

#### 6. **Mock Patterns**
```python
# unittest.mock
from unittest.mock import Mock, patch, MagicMock

@patch('module.function')
def test_with_mock(mock_function):
    mock_function.return_value = 'mocked'
    result = function_under_test()
    assert result == 'expected'

# pytest-mock
def test_with_pytest_mock(mocker):
    mock = mocker.patch('module.function')
    mock.return_value = 'mocked'
```

### Python Test Generation Requirements

1. **AST Analysis**
   - Detect class vs function definitions
   - Identify decorators (async, property, classmethod, etc.)
   - Extract docstrings for test descriptions
   - Detect type hints for better test generation

2. **Context Requirements**
   ```typescript
   interface PythonTestContext extends TemplateContext {
     testingFramework: 'pytest' | 'unittest' | 'nose2';
     asyncFramework?: 'asyncio' | 'trio' | 'anyio';
     fixtures?: FixtureDefinition[];
     decorators?: string[];
     typeHints?: PythonTypeHint[];
     docstring?: string;
   }
   ```

3. **Import Analysis**
   - Relative vs absolute imports
   - Package structure detection
   - Namespace packages
   - Import cycles detection

## Common vs Language-Specific Logic

### Common Logic (Keep in Base Generator)
1. File discovery and filtering
2. Test file path generation
3. Progress reporting
4. Error handling and recovery
5. Configuration management
6. Dry-run support

### Language-Specific Logic (Move to Specialized Generators)

#### JavaScript/TypeScript Generator
1. Module system detection (CommonJS/ESM)
2. Framework detection from package.json
3. TypeScript configuration parsing
4. JSDoc comment extraction
5. Async pattern detection
6. React/Vue/Angular specific analysis

#### Python Generator
1. Import style detection
2. Framework detection from imports/requirements
3. Async pattern detection (async def)
4. Fixture discovery
5. Class vs module-level code analysis
6. Type hint extraction

## Proposed Architecture

### Base Generator Interface
```typescript
abstract class LanguageAwareTestGenerator extends TestGenerator {
  abstract analyzeSourceFile(filePath: string): LanguageSpecificContext;
  abstract selectTemplate(context: LanguageSpecificContext): Template;
  abstract generateMocks(context: LanguageSpecificContext): GeneratedFile[];
  abstract generateFixtures(context: LanguageSpecificContext): GeneratedFile[];
}
```

### Generator Factory
```typescript
class TestGeneratorFactory {
  static createGenerator(
    language: string,
    config: TestGeneratorConfig,
    analysis: ProjectAnalysis
  ): TestGenerator {
    switch (language) {
      case 'javascript':
      case 'typescript':
        return new JavaScriptTestGenerator(config, analysis);
      case 'python':
        return new PythonTestGenerator(config, analysis);
      default:
        throw new Error(`Unsupported language: ${language}`);
    }
  }
}
```

### Language-Specific Generators
```typescript
class JavaScriptTestGenerator extends LanguageAwareTestGenerator {
  private moduleAnalyzer: ModuleSystemAnalyzer;
  private frameworkDetector: JSFrameworkDetector;
  
  async analyzeSourceFile(filePath: string): Promise<JavaScriptTestContext> {
    // Parse AST
    // Detect module system
    // Extract exports
    // Identify framework patterns
    // Detect async patterns
  }
}

class PythonTestGenerator extends LanguageAwareTestGenerator {
  private importAnalyzer: PythonImportAnalyzer;
  private fixtureDetector: FixtureDetector;
  
  async analyzeSourceFile(filePath: string): Promise<PythonTestContext> {
    // Parse AST
    // Analyze imports
    // Extract functions/classes
    // Detect decorators
    // Identify fixtures
  }
}
```

## Best Practices Identified

### JavaScript/TypeScript
1. **Always test module loading first** - Catches import/export issues
2. **Use appropriate async patterns** - Match source code patterns
3. **Mock external dependencies** - Isolate unit tests
4. **Test error cases** - JavaScript's dynamic nature requires it
5. **Type safety in TypeScript** - Leverage type information

### Python
1. **Use fixtures for setup** - Cleaner than setUp/tearDown
2. **Parametrize similar tests** - Reduce code duplication
3. **Test both success and failure paths** - Python's "easier to ask forgiveness"
4. **Use appropriate markers** - pytest.mark.asyncio, pytest.mark.skip
5. **Follow naming conventions** - test_* for discovery

## Next Steps

### Phase 2: Architecture Design (Next Session)
1. Design detailed class hierarchy
2. Define interfaces for language-specific analyzers
3. Plan template selection algorithm
4. Design configuration schema
5. Create extension points for new languages

### Phase 3: Migration Planning
1. Identify backward compatibility requirements
2. Plan incremental migration path
3. Design feature flags for gradual rollout
4. Create test scenarios for validation
5. Document migration guide

## Conclusion

The investigation reveals significant differences in testing patterns between JavaScript/TypeScript and Python that cannot be adequately addressed by templates alone. A language-specific generator architecture is needed to:

1. Perform appropriate AST analysis per language
2. Generate contextually appropriate test patterns
3. Support language-specific testing frameworks properly
4. Enable future extension to other languages
5. Improve test quality and reduce manual fixes

The proposed architecture maintains common functionality in the base class while delegating language-specific logic to specialized generators, providing a clean separation of concerns and enabling language-specific optimizations.