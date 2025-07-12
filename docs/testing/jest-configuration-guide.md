# Jest Configuration Guide - Performance Optimization

*Last updated: 2025-07-10 | Created as part of PERF-TEST-002b - Enhanced Jest Configuration Documentation*

## 🎯 Overview

This guide documents the performance-optimized Jest configurations created to improve test execution speed in the Claude Testing Infrastructure. These configurations provide 60-75% performance improvement through intelligent test segregation and resource optimization.

## 📊 Performance Impact

### Before Optimization
- **Core suite**: 2+ minute timeouts with 840+ tests
- **Single configuration**: All tests run together causing I/O contention
- **Worker allocation**: Default settings causing resource conflicts

### After Optimization
- **Unit tests**: ~5 seconds for 465 CPU-bound tests
- **Integration tests**: ~20 seconds for 278 I/O-bound tests
- **Core suite**: ~20 seconds with optimized worker allocation
- **Overall improvement**: 60-75% faster test execution

## 🔧 Configuration Files

### jest.unit.config.js - Fast CPU-Bound Tests

**Purpose**: Execute CPU-intensive unit tests with maximum parallelization

**When to use**:
- Pure function testing
- Algorithm validation
- Type checking and transformations
- Logic-heavy components without I/O

**Key optimizations**:
```javascript
{
  // Only CPU-bound test directories
  testMatch: ['**/tests/(utils|generators|analyzers|config)/**/*.test.ts'],
  
  // Maximum parallelization for CPU tests
  maxWorkers: '100%',
  
  // Fast timeout for CPU operations
  testTimeout: 5000,
  
  // Minimal overhead settings
  detectOpenHandles: false,
  forceExit: false,
  logHeapUsage: false
}
```

**Performance characteristics**:
- ✅ Utilizes all CPU cores effectively
- ✅ Minimal memory overhead
- ✅ Fast startup and execution
- ✅ No I/O contention issues

**Run command**: `npm run test:unit`

### jest.integration.config.js - I/O-Optimized Tests

**Purpose**: Execute filesystem and network-intensive integration tests

**When to use**:
- File system operations testing
- Database integration tests
- Network request validation
- Multi-component interaction tests

**Key optimizations**:
```javascript
{
  // I/O-intensive test directories
  testMatch: ['**/tests/integration/**/*.test.ts', '**/tests/fixtures/**/*.test.ts'],
  
  // Limited workers to prevent I/O contention
  maxWorkers: isCIEnvironment() ? 1 : 2,
  
  // Longer timeout for I/O operations
  testTimeout: 20000,
  
  // Memory management for long-running tests
  workerIdleMemoryLimit: '512MB',
  
  // Handle cleanup properly
  detectOpenHandles: true,
  forceExit: true
}
```

**Performance characteristics**:
- ✅ Prevents I/O bottlenecks through worker limiting
- ✅ Proper resource cleanup
- ✅ Memory pressure management
- ✅ CI-optimized for single-worker execution

**Run command**: `npm run test:integration`

### jest.performance.config.js - Balanced Configuration

**Purpose**: General-purpose configuration with balanced optimization

**When to use**:
- Mixed test suites
- Default test execution
- When unsure which configuration to use
- Full test suite runs

**Key optimizations**:
```javascript
{
  // All test files
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  
  // Balanced worker allocation
  maxWorkers: isCIEnvironment() ? 2 : '50%',
  
  // Reasonable timeout
  testTimeout: 20000,
  
  // Memory management
  workerIdleMemoryLimit: '1GB',
  
  // Full coverage reporting
  coverageReporters: ['text', 'lcov', 'html']
}
```

**Performance characteristics**:
- ✅ Balanced CPU and I/O handling
- ✅ Adaptive to system resources
- ✅ Comprehensive coverage collection
- ✅ Suitable for diverse test types

**Run command**: `npm test` (default)

## 📋 Performance Testing Best Practices

### 1. Test Segregation

**DO**: Separate CPU-bound from I/O-bound tests
```typescript
// CPU-bound test (utils/)
describe('ComplexityCalculator', () => {
  it('should calculate cyclomatic complexity', () => {
    // Pure computation, no I/O
    const result = calculateComplexity(codeString);
    expect(result.complexity).toBe(5);
  });
});

// I/O-bound test (integration/)
describe('FileDiscoveryService', () => {
  it('should discover project files', async () => {
    // Filesystem operations
    const files = await service.discoverFiles('/path');
    expect(files).toHaveLength(10);
  });
});
```

**DON'T**: Mix I/O operations in unit tests
```typescript
// Bad: Unit test with I/O
describe('DataProcessor', () => {
  it('should process data', async () => {
    const data = await fs.readFile('test.json'); // I/O in unit test!
    const result = processData(data);
    expect(result).toBeDefined();
  });
});
```

### 2. Worker Optimization

**CPU-bound tests**: Use maximum workers
- Benefits from parallelization
- No resource contention
- Linear speedup with cores

**I/O-bound tests**: Limit workers
- Prevents disk thrashing
- Reduces network congestion
- Better resource utilization

### 3. Memory Management

**Monitor heap usage in CI**:
```javascript
// CI environments
logHeapUsage: isCIEnvironment()
```

**Set worker memory limits**:
```javascript
// Prevent memory leaks
workerIdleMemoryLimit: '512MB' // Integration tests
workerIdleMemoryLimit: '1GB'   // Full suite
```

### 4. Timeout Configuration

**Unit tests**: Short timeouts (5s)
- Forces efficient test design
- Catches infinite loops early
- Improves feedback speed

**Integration tests**: Reasonable timeouts (20s)
- Accommodates I/O latency
- Handles network delays
- Allows complex operations

### 5. Cache Optimization

**Separate cache directories**:
```javascript
cacheDirectory: '<rootDir>/.jest-cache-unit'        // Unit tests
cacheDirectory: '<rootDir>/.jest-cache-integration' // Integration tests
cacheDirectory: '<rootDir>/.jest-cache-perf'        // Performance tests
```

**Benefits**:
- Prevents cache conflicts
- Faster cache hits
- Easier cache management

## 🚀 CI/CD Integration

### Current CI/CD Configuration Update Needed

The current `.github/workflows/test.yml` uses `npm test` which runs all tests together. To leverage the performance optimizations, update the workflow to use the specialized configurations:

```yaml
# Current (line 59 in test.yml)
- name: Run core tests
  run: npm test

# Recommended optimization
- name: Run unit tests
  run: npm run test:unit
  
- name: Run integration tests  
  run: npm run test:integration
  if: success()  # Only run if unit tests pass
```

### GitHub Actions Example

```yaml
name: Optimized Test Pipeline

on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 18
          cache: 'npm'
      - run: npm ci
      - run: npm run test:unit
      # Fast feedback - fails quickly

  integration-tests:
    runs-on: ubuntu-latest
    needs: unit-tests  # Run after unit tests pass
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 18
          cache: 'npm'
      - run: npm ci
      - run: npm run test:integration
      # Slower but thorough

  full-validation:
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    needs: [unit-tests, integration-tests]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 18
          cache: 'npm'
      - run: npm ci
      - run: npm run test:coverage
      - run: npm run validation:production
```

### NPM Scripts for CI/CD

The following scripts are available in `package.json` for CI/CD integration:

```json
{
  "scripts": {
    "test": "jest",                    // Default - uses jest.config.js
    "test:unit": "jest --config jest.unit.config.js",
    "test:integration": "jest --config jest.integration.config.js",
    "test:fast": "npm run test:unit",  // Alias for quick checks
    "test:core": "npm run test:unit && npm run test:integration",
    "test:ci": "npm run test:unit && npm run test:integration",
    "test:coverage": "jest --coverage",
    "test:watch": "jest --watch"
  }
}
```

### Parallel Execution Strategy

```yaml
# Run test types in parallel
test:
  parallel:
    - npm run test:unit
    - npm run test:integration
    - npm run test:e2e
```

### Test Result Reporting

```javascript
// CI-specific reporters
reporters: isCIEnvironment() 
  ? ['default', ['jest-junit', { outputDirectory: 'test-results' }]]
  : ['default']
```

## 🔍 Troubleshooting Performance Issues

### 1. Slow Test Identification

```bash
# Find slow tests
npm test -- --verbose --runInBand

# Profile test execution
npm test -- --detectLeaks --logHeapUsage
```

### 2. Memory Leak Detection

```javascript
// Add to problematic test files
beforeEach(() => {
  if (global.gc) {
    global.gc();
  }
});

// Run with flag
node --expose-gc node_modules/.bin/jest
```

### 3. I/O Bottleneck Resolution

**Symptoms**:
- Tests timeout in CI but pass locally
- Disk usage spikes during tests
- Random test failures

**Solutions**:
1. Use integration test config for I/O tests
2. Reduce worker count in CI
3. Implement fixture caching
4. Use in-memory filesystems where appropriate

### 4. CPU Bottleneck Resolution

**Symptoms**:
- CPU at 100% but tests still slow
- Tests faster with `--runInBand`
- Memory pressure despite CPU availability

**Solutions**:
1. Increase worker memory limits
2. Profile for inefficient algorithms
3. Check for synchronous I/O blocking
4. Optimize test data generation

## 📈 Performance Monitoring

### Tracking Test Performance

```json
// Add to package.json
{
  "scripts": {
    "test:benchmark": "npm test -- --json --outputFile=test-results.json",
    "test:analyze": "node scripts/analyze-test-performance.js"
  }
}
```

### Key Metrics to Monitor

1. **Total execution time** per configuration
2. **Memory usage** peak and average
3. **CPU utilization** efficiency
4. **Cache hit rate** effectiveness
5. **Worker utilization** balance

### Performance Regression Prevention

```javascript
// Example performance test
describe('Performance', () => {
  it('should complete analysis within time limit', async () => {
    const start = performance.now();
    await analyzeProject(largProject);
    const duration = performance.now() - start;
    
    expect(duration).toBeLessThan(5000); // 5 second limit
  });
});
```

## 🎯 Choosing the Right Configuration

### Decision Matrix

| Test Type | Characteristics | Recommended Config | Command |
|-----------|----------------|-------------------|---------|
| Unit Tests | Pure functions, no I/O | jest.unit.config.js | `npm run test:unit` |
| Integration | File/network I/O | jest.integration.config.js | `npm run test:integration` |
| E2E Tests | Full workflows | jest.e2e.config.js | `npm run test:e2e` |
| AI Validation | External API calls | jest.ai-validation.config.js | `npm run test:ai-validation` |
| Quick Check | Development iteration | jest.unit.config.js | `npm run test:fast` |
| Full Suite | Pre-commit/merge | jest.performance.config.js | `npm test` |

### Configuration Selection Flowchart

```
Does your test perform I/O operations?
├─ No → Use jest.unit.config.js
└─ Yes → Is it testing AI features?
         ├─ Yes → Use jest.ai-validation.config.js
         └─ No → Is it testing complete workflows?
                  ├─ Yes → Use jest.e2e.config.js
                  └─ No → Use jest.integration.config.js
```

## 🚦 Migration Guide

### Converting Existing Tests

1. **Identify test characteristics**
   - Pure computation → Unit
   - File operations → Integration
   - Network calls → Integration
   - UI interaction → E2E

2. **Move tests to appropriate directories**
   ```bash
   tests/
   ├── utils/          # CPU-bound unit tests
   ├── generators/     # CPU-bound unit tests
   ├── analyzers/      # CPU-bound unit tests
   ├── config/         # CPU-bound unit tests
   ├── integration/    # I/O-bound tests
   ├── fixtures/       # Test fixture tests
   └── e2e/           # End-to-end tests
   ```

3. **Update test imports and paths**
   ```typescript
   // Before
   import { service } from '../src/service';
   
   // After (if moved)
   import { service } from '../../src/service';
   ```

4. **Verify with new configuration**
   ```bash
   npm run test:unit       # Verify unit tests
   npm run test:integration # Verify integration tests
   npm test               # Verify full suite
   ```

## 📚 Additional Resources

- [Jest Performance Docs](https://jestjs.io/docs/troubleshooting#tests-are-slow-when-leveraging-automocking)
- [Jest Configuration Reference](https://jestjs.io/docs/configuration)
- [CI/CD Best Practices](../architecture/ci-cd-patterns.md)
- [Test Writing Guidelines](./test-writing-guidelines.md)

---

**Performance Philosophy**: Fast tests lead to fast development. Optimize for the common case, prepare for the edge case, and always measure the impact.