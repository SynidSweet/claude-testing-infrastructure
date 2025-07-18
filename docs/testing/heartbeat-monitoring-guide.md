# Heartbeat Monitoring Testing Guide

This guide provides comprehensive documentation for testing the heartbeat monitoring system in the Claude Testing Infrastructure.

## Unit Testing Strategy

The heartbeat monitoring system consists of three core components, each with dedicated unit tests achieving 100% code coverage:

### HeartbeatMonitor
- **Test File**: `tests/ai/heartbeat/HeartbeatMonitor.test.ts`
- **Coverage**: 100% (statements, branches, functions, lines)
- **Key Test Areas**:
  - Process monitoring lifecycle (start, stop, restart)
  - Health check execution and event emission
  - Process output capture and buffer management
  - Error handling and graceful termination
  - Metrics collection and statistics

### HeartbeatScheduler
- **Test File**: `tests/ai/heartbeat/HeartbeatScheduler.test.ts`
- **Coverage**: 100% (statements, branches, functions, lines)
- **Key Test Areas**:
  - Periodic health check scheduling
  - Timeout management
  - Progress reporting intervals
  - Cancellation operations
  - Scheduler statistics

### ProcessHealthAnalyzer
- **Test File**: `tests/ai/heartbeat/ProcessHealthAnalyzer.test.ts`
- **Coverage**: 100% (statements, branches, functions, lines)
- **Key Test Areas**:
  - Health status analysis based on metrics
  - CPU and memory threshold detection
  - Stuck process identification
  - Error severity analysis
  - Progress marker detection

## Integration Testing

Integration tests validate the complete heartbeat monitoring system working together:

### HeartbeatMonitor Integration Test
- **Test File**: `tests/ai/heartbeat/HeartbeatMonitor.integration.test.ts`
- **Reliability**: 100% (validated through 10x execution)
- **Scenarios Tested**:
  - Real process monitoring with child processes
  - Complete monitoring lifecycle
  - Event propagation across components
  - Resource cleanup and termination

### Optimized Integration Test
- **Test File**: `tests/ai/heartbeat-monitoring.optimized.test.ts`
- **Reliability**: 100% (validated through 10x execution)
- **Features**:
  - Async/await patterns for better control
  - Proper cleanup in afterEach hooks
  - Timeout handling for CI environments
  - Mock timer utilities for deterministic tests

## Common Pitfalls

### 1. Timer Management
**Problem**: Tests become flaky due to real timers in integration tests.
**Solution**: Use `HeartbeatTestHelper` utilities for consistent timer control:
```typescript
import { HeartbeatTestHelper } from '@/utils/HeartbeatTestHelper';

const helper = new HeartbeatTestHelper();
await helper.waitForHealthCheck(monitor, 'task-id');
```

### 2. Process Cleanup
**Problem**: Child processes not properly terminated after tests.
**Solution**: Always use proper cleanup in afterEach hooks:
```typescript
afterEach(() => {
  monitor.stopAll();
  scheduler.cancelAll();
  // Terminate any remaining child processes
  childProcess?.kill('SIGTERM');
});
```

### 3. Event Race Conditions
**Problem**: Events may fire in different orders causing intermittent failures.
**Solution**: Use event collectors and wait for specific conditions:
```typescript
const events = helper.collectEvents(monitor, ['healthCheck', 'terminated']);
await helper.waitForEvent(monitor, 'healthCheck');
expect(events.healthCheck).toHaveLength(1);
```

### 4. Resource Limits
**Problem**: Tests fail in CI due to resource constraints.
**Solution**: Use conservative timeouts and resource limits:
```typescript
const config = {
  checkIntervalMs: 100,  // Fast for tests
  timeoutMs: 5000,       // Reasonable timeout
  maxCpuPercent: 80,     // Leave headroom
  maxMemoryMB: 512       // CI-friendly limit
};
```

## Example Code

### Basic Unit Test Pattern
```typescript
describe('HeartbeatMonitor', () => {
  let monitor: HeartbeatMonitor;
  let scheduler: HeartbeatScheduler;
  let analyzer: ProcessHealthAnalyzer;

  beforeEach(() => {
    const config = { checkIntervalMs: 100, enableLogging: false };
    scheduler = new HeartbeatScheduler();
    analyzer = new ProcessHealthAnalyzer(config);
    monitor = new HeartbeatMonitor(config, scheduler, analyzer);
  });

  afterEach(() => {
    monitor.stopAll();
    scheduler.cancelAll();
  });

  it('should monitor process health', async () => {
    const processInfo = {
      taskId: 'test-task',
      pid: 12345,
      startTime: Date.now()
    };

    monitor.startMonitoring(processInfo);
    
    await new Promise(resolve => {
      monitor.once('healthCheck', (taskId, status) => {
        expect(taskId).toBe('test-task');
        expect(status.isHealthy).toBe(true);
        resolve(void 0);
      });
    });
  });
});
```

### Integration Test Pattern
```typescript
describe('Heartbeat Monitoring Integration', () => {
  let helper: HeartbeatTestHelper;
  let monitor: HeartbeatMonitor;
  let childProcess: ChildProcess;

  beforeEach(() => {
    helper = new HeartbeatTestHelper();
    monitor = helper.createMonitor({ checkIntervalMs: 50 });
  });

  afterEach(async () => {
    monitor.stopAll();
    childProcess?.kill('SIGTERM');
    await helper.cleanup();
  });

  it('should monitor real child process', async () => {
    // Spawn a test process
    childProcess = spawn('node', ['-e', 'setTimeout(() => {}, 10000)']);
    
    const processInfo = {
      taskId: 'real-process',
      pid: childProcess.pid!,
      childProcess
    };

    monitor.startMonitoring(processInfo);

    // Wait for health checks
    const events = await helper.waitForEvents(monitor, ['healthCheck'], 3);
    expect(events.healthCheck).toHaveLength(3);
    
    // All checks should be healthy
    events.healthCheck.forEach(([, status]) => {
      expect(status.isHealthy).toBe(true);
    });
  });
});
```

### Using Test Utilities
```typescript
import { HeartbeatTestHelper } from '@/utils/HeartbeatTestHelper';

// Create helper instance
const helper = new HeartbeatTestHelper();

// Wait for specific events
await helper.waitForEvent(monitor, 'terminated', 5000);

// Collect multiple events
const events = helper.collectEvents(monitor, ['healthCheck', 'warning']);

// Simulate process metrics
helper.simulateHighCPU(monitor, 'task-id', 95);

// Wait for health checks
await helper.waitForHealthCheck(monitor, 'task-id', 3);

// Clean up resources
await helper.cleanup();
```

## Best Practices

1. **Always use HeartbeatTestHelper** for integration tests to ensure consistent behavior
2. **Set short intervals** for tests (50-100ms) to speed up test execution
3. **Disable logging** in tests unless debugging (`enableLogging: false`)
4. **Use proper TypeScript types** - avoid `any` types in test code
5. **Test error scenarios** - ensure graceful handling of failures
6. **Validate cleanup** - check that all resources are properly released

## Debugging Test Failures

When tests fail, use these strategies:

1. **Enable verbose logging**:
   ```typescript
   const config = { enableLogging: true, logLevel: 'debug' };
   ```

2. **Increase timeouts** for slow CI environments:
   ```typescript
   jest.setTimeout(30000); // 30 seconds for entire suite
   ```

3. **Add debug output** in tests:
   ```typescript
   console.log('Process state:', monitor.getProcessInfo('task-id'));
   console.log('Scheduler stats:', scheduler.getStats());
   ```

4. **Check for race conditions** using event ordering:
   ```typescript
   const events = helper.collectEvents(monitor, ['event1', 'event2']);
   // Verify events fire in expected order
   ```

## CI/CD Considerations

The heartbeat monitoring tests are designed to work reliably in CI/CD environments:

- **Timeout Protection**: All tests have maximum execution times
- **Resource Limits**: Conservative CPU/memory thresholds
- **Parallel Execution**: Tests are isolated and can run in parallel
- **Deterministic Behavior**: Mock timers ensure consistent results
- **Automatic Cleanup**: All resources are cleaned up even on failure

## Maintenance

To maintain the test suite:

1. **Run coverage regularly**: `npm run test:coverage`
2. **Validate reliability**: `npm run validate:heartbeat-reliability`
3. **Update tests** when adding new features to maintain 100% coverage
4. **Review integration tests** periodically for flakiness
5. **Keep documentation updated** with new patterns and pitfalls