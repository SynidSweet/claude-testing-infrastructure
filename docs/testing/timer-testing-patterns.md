# Timer Testing Patterns Guide

*Comprehensive guide for testing timer-based and async operations in the Claude Testing Infrastructure*

*Created: 2025-07-07 | TASK-TIMER-002 | Standardizes discovered timer synchronization patterns*

## 🎯 Purpose

This guide documents standardized patterns for testing timer-based operations, async processes, and event-driven code. Use these patterns to create reliable, deterministic tests that properly handle timing dependencies.

## 📋 Quick Reference

### Essential Setup Pattern
```typescript
beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers({
    doNotFake: ['nextTick'],
    now: new Date('2025-01-01T00:00:00.000Z')
  });
});

afterEach(() => {
  jest.useRealTimers();
});
```

### Basic Timer Advancement
```typescript
// Advance time and process events
jest.advanceTimersByTime(30000); // 30 seconds
await Promise.resolve(); // Allow event loop to process
jest.runOnlyPendingTimers(); // Execute scheduled timers
```

### Process Event Coordination
```typescript
// Start async operation
const operationPromise = startTimerBasedOperation();
await Promise.resolve(); // Allow setup

// Trigger timer events
jest.advanceTimersByTime(interval);
await Promise.resolve();
jest.runOnlyPendingTimers();

// Verify results
expect(expectedBehavior).toHaveOccurred();
```

## ⏰ Jest Fake Timers Configuration

### Standard Configuration
```typescript
beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});
```

### Enhanced Configuration (Recommended)
```typescript
beforeEach(() => {
  jest.useFakeTimers({
    doNotFake: ['nextTick'], // Keep process.nextTick real
    now: new Date('2025-01-01T00:00:00.000Z'), // Fixed start time
    advanceTimers: false // Manual timer control
  });
});

afterEach(() => {
  jest.useRealTimers();
  jest.clearAllTimers(); // Clean up any remaining timers
});
```

### Legacy Jest Support
```typescript
beforeEach(() => {
  jest.useFakeTimers('legacy'); // For Jest < 27
});
```

## 🔄 Timer Advancement Patterns

### Basic Advancement
```typescript
// Single timer advancement
jest.advanceTimersByTime(5000); // 5 seconds

// Run all pending timers immediately
jest.runAllTimers();

// Run only currently scheduled timers
jest.runOnlyPendingTimers();

// Fast-forward to next timer
jest.advanceTimersToNextTimer();
```

### Sequential Timer Events
```typescript
// Multiple timer intervals in sequence
jest.advanceTimersByTime(30000); // First interval
await Promise.resolve();
jest.runOnlyPendingTimers();

jest.advanceTimersByTime(30000); // Second interval
await Promise.resolve();
jest.runOnlyPendingTimers();

// Verify cumulative behavior
expect(eventHandler).toHaveBeenCalledTimes(2);
```

### Progressive Timeout Testing
```typescript
// Test multiple timeout thresholds
jest.advanceTimersByTime(31000); // 50% of 60s timeout
expect(warningHandler).toHaveBeenCalledWith(
  expect.objectContaining({ threshold: 50 })
);

jest.advanceTimersByTime(20000); // 75% threshold
expect(warningHandler).toHaveBeenCalledWith(
  expect.objectContaining({ threshold: 75 })
);

jest.advanceTimersByTime(15000); // 90% threshold
expect(warningHandler).toHaveBeenCalledWith(
  expect.objectContaining({ threshold: 90 })
);
```

## 🌊 Async/Event Loop Coordination

### Promise Resolution Coordination
```typescript
// Allow microtasks to complete
await Promise.resolve();

// Multiple ticks for complex setup
await Promise.resolve();
await Promise.resolve();

// Force immediate scheduling
await new Promise(resolve => setImmediate(resolve));
```

### Event Emission Patterns
```typescript
// Mock process with events
const mockProcess = new EventEmitter();
mockProcess.stdout = new EventEmitter();
mockProcess.stderr = new EventEmitter();
mockProcess.kill = jest.fn();

// Emit events in tests
mockProcess.stdout.emit('data', Buffer.from('Output'));
mockProcess.stderr.emit('data', Buffer.from('Error'));
mockProcess.emit('close', 0);

// Allow events to propagate
await Promise.resolve();
```

### Mixed Timer/Promise Patterns
```typescript
// Real timeout for integration tests
await new Promise(resolve => setTimeout(resolve, 100));

// Fake timer advancement
jest.advanceTimersByTime(1000);
await Promise.resolve();

// Combine both approaches
setTimeout(async () => {
  await someAsyncOperation();
  resolve();
}, 500);
jest.advanceTimersByTime(600);
```

## 🔄 Process Lifecycle Testing

### Heartbeat Monitoring Pattern
```typescript
describe('Heartbeat Monitoring', () => {
  let orchestrator: ClaudeOrchestrator;
  let mockProcess: any;
  let processSlowHandler: jest.Mock;

  beforeEach(() => {
    jest.useFakeTimers();
    mockProcess = createMockProcess();
    processSlowHandler = jest.fn();
    
    orchestrator = new ClaudeOrchestrator({
      timeout: 300000,
      heartbeatInterval: 30000
    });
    
    orchestrator.on('processSlow', processSlowHandler);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('detects slow process', async () => {
    // Start process and allow heartbeat setup
    const batchPromise = orchestrator.processBatch(batch);
    await Promise.resolve();

    // Trigger heartbeat without activity
    jest.advanceTimersByTime(30000);
    await Promise.resolve();
    jest.runOnlyPendingTimers();

    // Verify slow process detection
    expect(processSlowHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: expect.any(String),
        timeSinceLastActivity: expect.any(Number),
      })
    );
  });
});
```

### Resource Monitoring Pattern
```typescript
test('monitors resource usage over time', async () => {
  const wrapper = new ResourceLimitWrapper(config);
  
  // Start monitoring
  await wrapper.executeWithLimits(mockProcess);
  await Promise.resolve();

  // Advance past check interval
  jest.advanceTimersByTime(5100);
  await Promise.resolve();

  // Verify resource checks occurred
  expect(mockGetResourceUsage).toHaveBeenCalled();
});
```

### Process Cleanup Pattern
```typescript
test('cleans up on process termination', async () => {
  const processPromise = startLongRunningProcess();
  await Promise.resolve();

  // Simulate process termination
  setTimeout(() => {
    mockProcess.emit('exit', 0);
  }, 100);

  jest.advanceTimersByTime(200);
  
  // Verify cleanup occurred
  expect(cleanupHandler).toHaveBeenCalled();
});
```

## 🛠️ Testing Utilities

### Mock Process Creation
```typescript
function createMockProcess(): any {
  const proc = new EventEmitter();
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  proc.kill = jest.fn();
  proc.killed = false;
  proc.pid = 12345;
  proc.exitCode = null;
  return proc;
}
```

### Timer Test Helper
```typescript
class TimerTestHelper {
  static async advanceAndProcess(timeMs: number): Promise<void> {
    jest.advanceTimersByTime(timeMs);
    await Promise.resolve();
    jest.runOnlyPendingTimers();
  }

  static async waitForEvents(): Promise<void> {
    await Promise.resolve();
    await Promise.resolve();
  }

  static setupMockProcess(): any {
    const mockProcess = new EventEmitter();
    mockProcess.stdout = new EventEmitter();
    mockProcess.stderr = new EventEmitter();
    mockProcess.kill = jest.fn();
    mockProcess.pid = Math.floor(Math.random() * 10000);
    return mockProcess;
  }
}

// Usage
await TimerTestHelper.advanceAndProcess(30000);
```

### Timeout Configuration Helper
```typescript
function configureTimerTest(timeoutMs: number = 30000): void {
  jest.setTimeout(timeoutMs);
  jest.useFakeTimers({
    doNotFake: ['nextTick'],
    now: new Date('2025-01-01T00:00:00.000Z')
  });
}
```

## 🚨 Common Issues & Solutions

### Issue: Race Conditions
**Problem**: Timer events and async operations not properly coordinated

**Solution**: Always use proper event loop coordination
```typescript
// ❌ Incorrect - missing coordination
jest.advanceTimersByTime(1000);
expect(handler).toHaveBeenCalled();

// ✅ Correct - proper coordination
jest.advanceTimersByTime(1000);
await Promise.resolve();
jest.runOnlyPendingTimers();
expect(handler).toHaveBeenCalled();
```

### Issue: Real Timer Leakage
**Problem**: Real timers interfering with fake timers

**Solution**: Always clean up in afterEach
```typescript
// ❌ Incorrect - no cleanup
beforeEach(() => {
  jest.useFakeTimers();
});

// ✅ Correct - proper cleanup
beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
  jest.clearAllTimers();
});
```

### Issue: Process Cleanup
**Problem**: Background processes not properly terminated

**Solution**: Explicit cleanup in test teardown
```typescript
afterEach(async () => {
  if (mockProcess && !mockProcess.killed) {
    mockProcess.kill('SIGTERM');
  }
  // Allow cleanup to complete
  await Promise.resolve();
  jest.useRealTimers();
});
```

### Issue: Insufficient Test Timeout
**Problem**: Tests failing due to insufficient timeout

**Solution**: Configure appropriate timeouts
```typescript
// For individual tests
test('long timer operation', async () => {
  // Test implementation
}, 60000); // 60 second timeout

// For entire describe block
describe('Timer Operations', () => {
  jest.setTimeout(30000); // 30 second timeout
  
  // Tests...
});
```

### Issue: Jest Fake Timer Mode Conflicts
**Problem**: Different Jest versions or configurations causing conflicts

**Solution**: Use explicit configuration
```typescript
// Modern Jest (27+)
jest.useFakeTimers({
  doNotFake: ['nextTick', 'setImmediate'],
  now: new Date('2025-01-01T00:00:00.000Z')
});

// Legacy Jest support
if (jest.version && parseInt(jest.version) < 27) {
  jest.useFakeTimers('legacy');
} else {
  jest.useFakeTimers();
}
```

## 📋 Best Practices Checklist

### ✅ Timer Setup
- [ ] Use `jest.useFakeTimers()` in `beforeEach`
- [ ] Use `jest.useRealTimers()` in `afterEach`
- [ ] Configure `doNotFake: ['nextTick']` for event loop
- [ ] Set fixed `now` time for deterministic tests

### ✅ Timer Advancement
- [ ] Use `jest.advanceTimersByTime()` for specific intervals
- [ ] Add `await Promise.resolve()` after timer advancement
- [ ] Call `jest.runOnlyPendingTimers()` to execute timers
- [ ] Test multiple timer intervals in sequence

### ✅ Async Coordination
- [ ] Use `await Promise.resolve()` for microtask completion
- [ ] Use `setImmediate` for immediate scheduling
- [ ] Combine real and fake timers carefully
- [ ] Handle event emission properly

### ✅ Process Testing
- [ ] Mock all process properties (stdout, stderr, kill, pid)
- [ ] Emit events after setup completion
- [ ] Clean up processes in `afterEach`
- [ ] Test process lifecycle transitions

### ✅ Error Handling
- [ ] Test timeout scenarios with progressive advancement
- [ ] Verify error emission and handling
- [ ] Test recovery mechanisms
- [ ] Validate cleanup on errors

## 🔗 Related Patterns

### Integration with Existing Infrastructure
- **ClaudeOrchestrator**: Use these patterns for AI process testing
- **ResourceLimitWrapper**: Apply for resource monitoring tests
- **ProcessMonitor**: Use for system process testing
- **HeartbeatMonitoring**: Apply for process health checks

### Framework-Specific Considerations
- **Jest**: Primary framework, use fake timers extensively
- **React Testing**: Combine with `@testing-library/react` for component timers
- **Node.js**: Handle process lifecycle and event timing
- **Browser**: Consider `requestAnimationFrame` and event timing

## 📚 Examples Repository

Find complete working examples in:
- `/tests/ai/heartbeat-monitoring.test.ts` - Heartbeat patterns
- `/tests/ai/enhanced-heartbeat-monitoring.test.ts` - Advanced timing
- `/tests/utils/ResourceLimitWrapper.test.ts` - Resource monitoring
- `/tests/utils/ProcessMonitor.test.ts` - Process lifecycle testing

## 🎯 Next Steps

After implementing these patterns:
1. Create reusable `TimerTestUtils` utility library
2. Implement `TestableTimer` abstraction for dependency injection
3. Build comprehensive async testing framework
4. Apply patterns to existing problematic tests

---

**Pattern Philosophy**: Deterministic timer testing requires careful coordination between fake timers, the event loop, and async operations. Always prioritize predictability over performance in tests.