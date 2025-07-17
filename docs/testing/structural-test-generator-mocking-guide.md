# StructuralTestGenerator Complex Mocking Guide

*Last updated: 2025-07-17 | Mock configuration timing fixes implemented*

## Overview

This guide documents the complex mocking requirements for testing `StructuralTestGenerator` setup file generation functionality. The mocking patterns address the infrastructure gaps identified in TASK-2025-064.

**⚠️ CRITICAL**: Mock timing is essential - all mocks must be defined before any module imports to work correctly.

## Key Mocking Requirements

### 1. Correct Mock Setup Order (FIXED)

**PROBLEM**: Dynamic mocking with `jest.doMock` doesn't work when modules are already loaded.

**SOLUTION**: Define global mocks before imports, then use static `jest.mock()` calls.

```typescript
// CORRECT: Global mocks defined before imports
const mockFg = jest.fn();
const mockFs = {
  mkdir: jest.fn(),
  writeFile: jest.fn(),
  access: jest.fn(),
  readFile: jest.fn(),
  stat: jest.fn(),
  readdir: jest.fn(),
};
const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// CORRECT: Static mock calls
jest.mock('fast-glob', () => mockFg);
jest.mock('../../src/utils/common-imports', () => ({
  fs: mockFs,
  path: jest.requireActual('path'),
  fg: mockFg,
  logger: mockLogger,
}));

// CORRECT: Configure mocks in beforeEach
beforeEach(() => {
  jest.clearAllMocks();
  
  // Set up default behaviors
  mockFg.mockResolvedValue(['/test/file1.js', '/test/file2.ts']);
  mockFs.mkdir.mockResolvedValue(undefined);
  mockFs.writeFile.mockResolvedValue(undefined);
  mockFs.access.mockRejectedValue(new Error('File not found'));
  mockLogger.info.mockImplementation(() => {});
});
```

### 2. File System Operations Mocking

The `generateTestSetupFiles` method requires comprehensive fs.promises mocking:

**Critical Patterns:**
- `fs.mkdir` with `{ recursive: true }` option
- `fs.writeFile` with UTF-8 encoding
- Error handling for file system failures
- Directory creation before file writing

### 2. Fast-Glob Integration Mocking

The `getFilesToTestDirect` method uses fast-glob with complex options:

```typescript
const mockFg = jest.fn().mockResolvedValue([
  '/test/project/src/App.jsx',
  '/test/project/src/components/Header.tsx',
  '/test/project/src/utils/helpers.js'
]);

// Mock fast-glob with pattern matching
mockFg.mockImplementation((patterns: string[], options: any) => {
  const { cwd, absolute, onlyFiles, dot, ignore } = options;
  // Simulate pattern matching logic
  return Promise.resolve(filteredFiles);
});
```

**Critical Options:**
- `cwd`: Working directory for pattern matching
- `absolute: true`: Return absolute paths
- `onlyFiles: true`: Only return files, not directories
- `dot: false`: Exclude hidden files
- `ignore`: Array of exclude patterns

### 3. FileDiscoveryService Interface Mocking

The `getFilesToTestViaService` method needs comprehensive service mocking:

```typescript
const mockFileDiscoveryService: jest.Mocked<FileDiscoveryService> = {
  findFiles: jest.fn().mockResolvedValue({
    files: ['/test/project/src/App.jsx'],
    fromCache: false,
    duration: 150,
    stats: {
      totalFiles: 1,
      directories: 1,
      extensions: { '.jsx': 1 }
    }
  }),
  fileExists: jest.fn().mockResolvedValue(false),
  invalidateCache: jest.fn(),
  getCacheStats: jest.fn().mockResolvedValue({
    totalRequests: 10,
    cacheHits: 7,
    cacheMisses: 3,
    hitRate: 0.7,
    averageRequestTime: 25,
    cacheSize: 256,
    lastUpdated: new Date()
  })
};
```

**Critical Components:**
- `FileDiscoveryRequest` with baseDir, type, languages, absolute, useCache
- `FileDiscoveryResult` with files, fromCache, duration, stats
- Cache behavior validation
- Performance metrics handling

### 4. TestTemplateEngine Mocking

Template engine initialization requires sophisticated mocking:

```typescript
jest.mock('../../src/generators/templates/TestTemplateEngine');

const mockTemplateEngine = {
  generateTest: jest.fn().mockReturnValue('// Mock generated test content'),
  getAvailableTemplates: jest.fn().mockReturnValue(['unit', 'integration']),
  validateTemplate: jest.fn().mockReturnValue(true)
};

(TestTemplateEngine as jest.MockedClass<typeof TestTemplateEngine>).mockImplementation(
  () => mockTemplateEngine as any
);
```

**Critical Patterns:**
- Constructor with config and analysis parameters
- `generateTest(context)` method with TemplateContext
- Error handling for template generation failures
- Framework-specific template selection

### 5. Logger Mocking

Comprehensive logging verification:

```typescript
const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

// Expected log patterns
const expectedLogMessages = [
  'Scanning for files to test',
  'Found X files before language filtering',
  'Generated setup file',
  'Failed to create setup file'
];
```

### 6. ProjectAnalysis Mocking

Complex project analysis requires realistic mock data:

```typescript
const mockAnalysis: ProjectAnalysis = {
  projectPath: '/test/project',
  languages: [
    { name: 'javascript', confidence: 0.9, files: ['/test/project/src/App.jsx'] },
    { name: 'typescript', confidence: 0.8, files: ['/test/project/src/Header.tsx'] }
  ],
  frameworks: [{ name: 'react', confidence: 0.9, configFiles: [] }],
  moduleSystem: {
    type: 'esm',
    hasPackageJsonType: true,
    packageJsonType: 'module',
    confidence: 0.9,
    fileExtensionPattern: 'js'
  },
  dependencies: {
    production: { react: '^18.0.0', 'react-dom': '^18.0.0' },
    development: { '@testing-library/react': '^13.0.0', jest: '^29.0.0' }
  },
  // ... additional required properties
};
```

## Testing Patterns

### 1. Setup File Generation Tests

```typescript
describe('Setup File Generation', () => {
  it('should create directory recursively before writing setup file', async () => {
    const generator = new StructuralTestGenerator(config, analysis, { generateSetup: true });
    await generator.generateAllTests();
    
    expect(mockFs.mkdir).toHaveBeenCalledWith(
      expect.stringContaining('/test/output'),
      { recursive: true }
    );
  });
  
  it('should handle file system errors gracefully', async () => {
    mockFs.mkdir.mockRejectedValue(new Error('Permission denied'));
    
    const generator = new StructuralTestGenerator(config, analysis, { generateSetup: true });
    await generator.generateAllTests();
    
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('Failed to create setup file'),
      expect.objectContaining({ error: expect.any(Error) })
    );
  });
});
```

### 2. File Discovery Integration Tests

```typescript
describe('File Discovery Integration', () => {
  it('should use FileDiscoveryService when provided', async () => {
    const generator = new StructuralTestGenerator(
      config, analysis, { generateSetup: true }, mockFileDiscoveryService
    );
    await generator.generateAllTests();
    
    expect(mockFileDiscoveryService.findFiles).toHaveBeenCalledWith({
      baseDir: '/test/project',
      type: FileDiscoveryType.TEST_GENERATION,
      languages: ['javascript', 'typescript'],
      absolute: true,
      useCache: true
    });
  });
});
```

### 3. Error Handling Tests

```typescript
describe('Error Handling', () => {
  it('should handle fast-glob errors gracefully', async () => {
    mockFg.mockRejectedValue(new Error('Pattern matching failed'));
    
    const generator = new StructuralTestGenerator(config, analysis, { generateSetup: true });
    await expect(generator.generateAllTests()).rejects.toThrow('Pattern matching failed');
  });
  
  it('should handle template engine failures gracefully', async () => {
    mockTemplateEngine.generateTest.mockImplementation(() => {
      throw new Error('Template generation failed');
    });
    
    const generator = new StructuralTestGenerator(config, analysis, { generateSetup: true });
    await generator.generateAllTests();
    
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('Template generation failed'),
      expect.objectContaining({ error: expect.any(Error) })
    );
  });
});
```

## Common Integration Scenarios

### 1. React ES Modules Project

```typescript
const reactESMAnalysis = {
  ...baseAnalysis,
  moduleSystem: { type: 'esm', packageJsonType: 'module' },
  frameworks: [{ name: 'react', confidence: 0.9 }],
  languages: [{ name: 'javascript' }, { name: 'typescript' }]
};

// Expected: setupTests.mjs with ES modules imports
```

### 2. React CommonJS Project

```typescript
const reactCJSAnalysis = {
  ...baseAnalysis,
  moduleSystem: { type: 'commonjs', packageJsonType: 'commonjs' },
  frameworks: [{ name: 'react', confidence: 0.9 }]
};

// Expected: setupTests.js with require() statements
```

### 3. Non-React Project

```typescript
const nonReactAnalysis = {
  ...baseAnalysis,
  frameworks: [], // No frameworks detected
  languages: [{ name: 'javascript' }]
};

// Expected: Basic setup file without React-specific configuration
```

## Mock Cleanup and Isolation

### Best Practices

1. **Clear mocks between tests:**
```typescript
beforeEach(() => {
  jest.clearAllMocks();
});
```

2. **Restore mocks after tests:**
```typescript
afterEach(() => {
  jest.restoreAllMocks();
});
```

3. **Isolate mock configurations:**
```typescript
// Configure mocks specifically for each test
mockFs.mkdir.mockResolvedValue(undefined);
mockFs.writeFile.mockResolvedValue(undefined);
```

## Integration with Common-Imports

The key challenge is mocking the `common-imports` module that centralizes all external dependencies:

```typescript
// Mock the entire common-imports module
jest.doMock('../../src/utils/common-imports', () => ({
  fs: mockFs,
  path: require('path'),
  fg: mockFg,
  logger: mockLogger
}));
```

This pattern ensures all dependencies are properly mocked without complex module resolution issues.

## Performance Considerations

1. **Batch mock setup:** Configure all mocks in beforeEach
2. **Reuse mock instances:** Create mock factories for common patterns
3. **Avoid over-mocking:** Only mock what's actually used in tests
4. **Use realistic data:** Mock responses should match production behavior

## Summary

The complex mocking requirements for StructuralTestGenerator stem from its integration with multiple external systems:

- **File system operations** with recursive directory creation
- **Fast-glob pattern matching** with complex options
- **FileDiscoveryService** with caching and performance metrics
- **TestTemplateEngine** with framework-specific templates
- **Logger** with structured message patterns
- **ProjectAnalysis** with realistic project metadata

These mocking patterns enable comprehensive testing of setup file generation functionality while maintaining test isolation and performance.