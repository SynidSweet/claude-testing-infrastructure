# Mock Usage Patterns for AI Testing

*Documentation for Phase 3 of REF-ARCH-001: Mock-First Validation Tests*

## Overview

The Claude Testing Infrastructure provides comprehensive mocking capabilities to enable testing of AI integration without spawning real Claude processes or making API calls. This is critical for validation tests that run in VALIDATION_TEST context.

## Core Components

### MockClaudeOrchestrator

A drop-in replacement for `ClaudeOrchestrator` that records process spawn attempts instead of spawning real processes.

```typescript
import { MockClaudeOrchestrator } from '../../src/ai/MockClaudeOrchestrator';
import { ProcessContext } from '../../src/types/process-types';

const mockOrchestrator = new MockClaudeOrchestrator({
  maxConcurrent: 2,
  model: 'sonnet',
  timeout: 5000
}, ProcessContext.VALIDATION_TEST);
```

### AITestHarness

Provides utilities for creating test scenarios and validating results.

```typescript
import { AITestHarness } from '../../src/ai/AITestHarness';

const testHarness = new AITestHarness();
const scenario = testHarness.createReactComponentScenario('MyComponent');
```

## Usage Patterns

### Basic Mock Setup

```typescript
describe('AI Integration Test', () => {
  let mockOrchestrator: MockClaudeOrchestrator;
  let testHarness: AITestHarness;

  beforeEach(() => {
    mockOrchestrator = new MockClaudeOrchestrator({
      model: 'sonnet',
      timeout: 5000
    }, ProcessContext.VALIDATION_TEST);
    
    testHarness = new AITestHarness();
  });

  test('should process tasks without real API calls', async () => {
    // Clear any previous history
    mockOrchestrator.clearSpawnHistory();
    
    // Create test scenario
    const scenario = testHarness.createReactComponentScenario('TestComponent');
    const batch = testHarness.createTaskBatch(scenario);
    
    // Configure mock responses
    mockOrchestrator.setDefaultMockResponses({
      success: true,
      generatedTests: 'mock test content',
      tokenCount: 150,
      cost: 0.001,
      duration: 2000
    });
    
    // Process batch
    const results = await mockOrchestrator.processBatch(batch);
    
    // Validate results
    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(true);
    
    // Validate no real processes spawned
    const spawnHistory = mockOrchestrator.getSpawnHistory();
    expect(spawnHistory).toHaveLength(1);
    expect(spawnHistory[0].context).toBe(ProcessContext.VALIDATION_TEST);
  });
});
```

### Authentication Simulation

```typescript
test('should simulate different authentication states', () => {
  // Test degraded mode (default)
  let authStatus = mockOrchestrator.validateClaudeAuth();
  expect(authStatus.canDegrade).toBe(true);
  
  // Test authenticated mode
  process.env.MOCK_CLAUDE_AUTH = 'authenticated';
  authStatus = mockOrchestrator.validateClaudeAuth();
  expect(authStatus.authenticated).toBe(true);
  
  // Test failed authentication
  process.env.MOCK_CLAUDE_AUTH = 'failed';
  authStatus = mockOrchestrator.validateClaudeAuth();
  expect(authStatus.authenticated).toBe(false);
  expect(authStatus.canDegrade).toBe(false);
  
  // Reset
  delete process.env.MOCK_CLAUDE_AUTH;
});
```

### Error Handling Testing

```typescript
test('should handle errors without real API failures', async () => {
  const failureScenario = testHarness.createFailureScenario();
  const batch = testHarness.createTaskBatch(failureScenario);
  
  // Configure mock failure
  mockOrchestrator.setDefaultMockResponses({
    success: false,
    error: 'Mock processing error',
    duration: 500
  });
  
  const results = await mockOrchestrator.processBatch(batch);
  
  expect(results[0].success).toBe(false);
  expect(results[0].error).toBe('Mock processing error');
  
  // Verify spawn was recorded even for failures
  const spawnHistory = mockOrchestrator.getSpawnHistory();
  expect(spawnHistory).toHaveLength(1);
});
```

### Batch Processing Testing

```typescript
test('should handle multiple tasks in batch', async () => {
  const batchScenario = testHarness.createBatchScenario();
  const batch = testHarness.createTaskBatch(batchScenario);
  
  mockOrchestrator.setDefaultMockResponses({
    success: true,
    generatedTests: 'batch test content',
    tokenCount: 200,
    cost: 0.002
  });
  
  const results = await mockOrchestrator.processBatch(batch);
  
  expect(results).toHaveLength(batchScenario.tasks.length);
  
  const spawnHistory = mockOrchestrator.getSpawnHistory();
  expect(spawnHistory).toHaveLength(batchScenario.tasks.length);
});
```

### Emergency Operations Testing

```typescript
test('should record emergency operations', () => {
  mockOrchestrator.clearSpawnHistory();
  
  // Test emergency shutdown
  mockOrchestrator.emergencyShutdown('Test emergency');
  
  let spawnHistory = mockOrchestrator.getSpawnHistory();
  expect(spawnHistory).toHaveLength(1);
  expect(spawnHistory[0].taskId).toBe('emergency-shutdown');
  
  // Test killAll
  await mockOrchestrator.killAll();
  
  spawnHistory = mockOrchestrator.getSpawnHistory();
  expect(spawnHistory).toHaveLength(2);
  expect(spawnHistory[1].taskId).toBe('kill-all');
});
```

## Available Test Scenarios

The `AITestHarness` provides several pre-built scenarios:

### React Component Scenario
```typescript
const scenario = testHarness.createReactComponentScenario('ComponentName');
// Creates a scenario for testing React component generation
```

### Utility Function Scenario
```typescript
const scenario = testHarness.createUtilityFunctionScenario();
// Creates a scenario for testing utility function generation
```

### Failure Scenario
```typescript
const scenario = testHarness.createFailureScenario();
// Creates a scenario that simulates failure conditions
```

### Batch Scenario
```typescript
const scenario = testHarness.createBatchScenario();
// Creates a scenario with multiple tasks for batch testing
```

## Mock Response Configuration

### Default Responses
```typescript
mockOrchestrator.setDefaultMockResponses({
  success: true,
  generatedTests: 'default mock content',
  tokenCount: 150,
  cost: 0.001,
  duration: 2000
});
```

### Task-Specific Responses
```typescript
mockOrchestrator.setMockResponse('specific-task-id', {
  taskId: 'specific-task-id',
  generatedTests: 'specific mock content',
  success: true,
  tokenCount: 300,
  cost: 0.003,
  duration: 3000
});
```

## Validation Patterns

### Process Spawn Validation
```typescript
// Verify correct number of spawns
const spawnHistory = mockOrchestrator.getSpawnHistory();
expect(spawnHistory).toHaveLength(expectedCount);

// Verify spawn details
expect(spawnHistory[0].taskId).toBe(expectedTaskId);
expect(spawnHistory[0].context).toBe(ProcessContext.VALIDATION_TEST);
expect(spawnHistory[0].model).toBe('sonnet');
```

### Statistics Validation
```typescript
const stats = mockOrchestrator.getStats();
expect(stats.totalTasks).toBe(expectedTasks);
expect(stats.completedTasks).toBe(expectedCompletions);
expect(stats.failedTasks).toBe(expectedFailures);
expect(stats.sessionUsage.processesSpawned).toBe(expectedSpawns);
```

### Result Validation
```typescript
const validation = testHarness.validateResult(scenario, actualResult);
expect(validation.valid).toBe(true);
if (!validation.valid) {
  console.error('Validation errors:', validation.errors);
}
```

## Integration with Existing Tests

### Replacing Real Orchestrator
```typescript
// Before (real orchestrator)
import { ClaudeOrchestrator } from '../../src/ai/ClaudeOrchestrator';

const orchestrator = new ClaudeOrchestrator(config, ProcessContext.VALIDATION_TEST);

// After (mock orchestrator)
import { MockClaudeOrchestrator } from '../../src/ai/MockClaudeOrchestrator';

const orchestrator = new MockClaudeOrchestrator(config, ProcessContext.VALIDATION_TEST);
```

### Conditional Mocking
```typescript
const useRealOrchestrator = process.env.USE_REAL_CLAUDE === 'true';

const orchestrator = useRealOrchestrator 
  ? new ClaudeOrchestrator(config, ProcessContext.VALIDATION_TEST)
  : new MockClaudeOrchestrator(config, ProcessContext.VALIDATION_TEST);
```

## Best Practices

### 1. Always Clear History
```typescript
beforeEach(() => {
  mockOrchestrator.clearSpawnHistory();
});
```

### 2. Use Appropriate Context
```typescript
// For validation tests
const orchestrator = new MockClaudeOrchestrator(config, ProcessContext.VALIDATION_TEST);

// For test generation context
const orchestrator = new MockClaudeOrchestrator(config, ProcessContext.TEST_GENERATION);
```

### 3. Validate Both Success and Failure
```typescript
// Test success cases
mockOrchestrator.setDefaultMockResponses({ success: true });
// ... test success path

// Test failure cases  
mockOrchestrator.setDefaultMockResponses({ success: false, error: 'test error' });
// ... test error handling
```

### 4. Verify No Real Processes
```typescript
// After any operation that might spawn processes
const spawnHistory = mockOrchestrator.getSpawnHistory();
expect(spawnHistory.every(spawn => spawn.context === ProcessContext.VALIDATION_TEST)).toBe(true);
```

## Environment Variables

- `MOCK_CLAUDE_AUTH`: Controls authentication simulation
  - `'authenticated'`: Simulates successful authentication
  - `'failed'`: Simulates authentication failure
  - `'degraded'` (default): Simulates degraded mode

## Common Patterns

### Testing Timeout Behavior
```typescript
test('should complete within expected time with mocks', async () => {
  const startTime = Date.now();
  
  await mockOrchestrator.processBatch(batch);
  
  const duration = Date.now() - startTime;
  expect(duration).toBeLessThan(5000); // Mocks should be fast
});
```

### Testing Concurrency
```typescript
test('should handle concurrent tasks', async () => {
  const largeBatch = { 
    // ... batch with many tasks
  };
  
  const results = await mockOrchestrator.processBatch(largeBatch);
  
  // Verify all tasks processed
  expect(results).toHaveLength(largeBatch.tasks.length);
  
  // Verify spawn history shows concurrent processing simulation
  const spawnHistory = mockOrchestrator.getSpawnHistory();
  expect(spawnHistory).toHaveLength(largeBatch.tasks.length);
});
```

This mocking system enables comprehensive testing of AI integration logic without the overhead, cost, or instability of real AI API calls, while still validating that the correct process spawning attempts would occur in production.