# TimerTestUtils Library Guide

*Comprehensive guide for using the TimerTestUtils library for deterministic timer and async testing*

*Created: 2025-07-07 | TASK-TIMER-004 | Production-ready utility library for timer testing patterns*

## 🎯 Purpose

The TimerTestUtils library provides a comprehensive set of utilities for testing timer-based operations, async processes, and event-driven code. It standardizes timer testing patterns identified in the Claude Testing Infrastructure and provides both high-level convenience functions and low-level control for complex testing scenarios.

## 📋 Quick Start

### Basic Setup

```typescript
import { TimerTestUtils, timerTestHelpers } from '../src/utils/TimerTestUtils';

describe('Timer-based Component', () => {
  beforeEach(() => {
    TimerTestUtils.setupFakeTimers();
  });

  afterEach(() => {
    TimerTestUtils.cleanupTimers();
  });

  test('handles timer operations', async () => {
    const callback = jest.fn();
    setTimeout(callback, 5000);

    await TimerTestUtils.advanceTimersAndFlush(6000);
    
    expect(callback).toHaveBeenCalledTimes(1);
  });
});
```

### Using Helper Functions

```typescript
import { timerTestHelpers } from '../src/utils/TimerTestUtils';

describe('Component with Helpers', () => {
  beforeEach(() => {
    timerTestHelpers.setup();
  });

  afterEach(() => {
    timerTestHelpers.cleanup();
  });

  test('simplified timer testing', async () => {
    const callback = jest.fn();
    setTimeout(callback, 1000);

    await timerTestHelpers.advance(1500);
    
    expect(callback).toHaveBeenCalledTimes(1);
  });
});
```

## 🔧 Core Components

### TimerTestUtils Class

The main utility class providing comprehensive timer testing functionality.

#### Timer Setup and Configuration

```typescript
// Default setup
TimerTestUtils.setupFakeTimers();

// Custom configuration
TimerTestUtils.setupFakeTimers({
  fixedStartTime: new Date('2025-01-01T00:00:00.000Z'),
  doNotFake: ['nextTick', 'setImmediate'],
  autoAdvance: false,
  defaultTimeout: 60000
});

// Skip fake timers
TimerTestUtils.setupFakeTimers({ useFakeTimers: false });
```

#### Timer Advancement and Event Coordination

```typescript
// Basic advancement
await TimerTestUtils.advanceTimersAndFlush(5000);

// Advanced coordination
await TimerTestUtils.advanceTimersAndFlush(5000, {
  waitForEvents: true,
  runPendingTimers: true,
  eventLoopTicks: 2
});

// Event loop synchronization
await TimerTestUtils.waitForEvents(3); // Wait for 3 event loop ticks
```

### MockTimerService Class

Dependency injection compatible timer service for testing components that use timer abstractions.

```typescript
import { MockTimerService } from '../src/utils/TimerTestUtils';

describe('Component with Timer Dependency', () => {
  let mockTimer: MockTimerService;
  let component: MyTimerComponent;

  beforeEach(() => {
    mockTimer = new MockTimerService();
    component = new MyTimerComponent(mockTimer);
  });

  test('schedules operations correctly', () => {
    component.scheduleTask(() => {}, 5000);
    
    expect(mockTimer.getPendingCount()).toBe(1);
    
    mockTimer.advanceTime(6000);
    expect(mockTimer.getPendingCount()).toBe(0);
  });
});
```

## 🔄 Common Usage Patterns

### Heartbeat Monitoring Testing

```typescript
describe('Heartbeat Monitoring', () => {
  beforeEach(() => {
    TimerTestUtils.setupFakeTimers();
  });

  test('detects process heartbeat', async () => {
    const heartbeatCallback = jest.fn();
    const interval = 30000; // 30 seconds
    
    setInterval(heartbeatCallback, interval);

    await TimerTestUtils.testHeartbeatPattern(
      interval,
      heartbeatCallback,
      3 // Test 3 iterations
    );
    
    expect(heartbeatCallback).toHaveBeenCalledTimes(3);
  });
});
```

### Progressive Timeout Testing

```typescript
describe('Timeout Warnings', () => {
  beforeEach(() => {
    TimerTestUtils.setupFakeTimers();
  });

  test('emits progressive timeout warnings', async () => {
    const warningCallback = jest.fn();
    const totalTimeout = 60000; // 60 seconds
    const thresholds = [50, 75, 90]; // Percentage thresholds
    
    // Set up timeout warnings
    thresholds.forEach(threshold => {
      const warningTime = (totalTimeout * threshold) / 100;
      setTimeout(() => {
        warningCallback({ threshold });
      }, warningTime);
    });

    await TimerTestUtils.testProgressiveTimeouts(
      totalTimeout,
      thresholds,
      warningCallback
    );
    
    expect(warningCallback).toHaveBeenCalledWith({ threshold: 50 });
    expect(warningCallback).toHaveBeenCalledWith({ threshold: 75 });
    expect(warningCallback).toHaveBeenCalledWith({ threshold: 90 });
  });
});
```

### Process Lifecycle Testing

```typescript
describe('Process Lifecycle', () => {
  beforeEach(() => {
    TimerTestUtils.setupFakeTimers();
  });

  test('handles process lifecycle events', async () => {
    const mockProcess = TimerTestUtils.createMockProcess();
    const eventHandler = jest.fn();
    
    mockProcess.on('startup', eventHandler);
    mockProcess.on('ready', eventHandler);
    mockProcess.on('close', eventHandler);

    const events = [
      { event: 'startup', data: { status: 'starting' }, delay: 100 },
      { event: 'ready', data: { status: 'ready' }, delay: 1000 },
      { event: 'close', data: { code: 0 }, delay: 5000 }
    ];

    await TimerTestUtils.testProcessLifecycle(mockProcess, events);
    
    expect(eventHandler).toHaveBeenCalledTimes(3);
  });
});
```

### Resource Monitoring Testing

```typescript
describe('Resource Monitoring', () => {
  beforeEach(() => {
    TimerTestUtils.setupFakeTimers();
  });

  test('monitors resources at intervals', async () => {
    const resourceCheck = jest.fn();
    const checkInterval = 5000; // 5 seconds
    const monitoringDuration = 25000; // 25 seconds
    
    setInterval(resourceCheck, checkInterval);

    await TimerTestUtils.testResourceMonitoring(
      checkInterval,
      resourceCheck,
      monitoringDuration
    );
    
    expect(resourceCheck).toHaveBeenCalledTimes(5); // 25000 / 5000
  });
});
```

### Async Operation Coordination

```typescript
describe('Async Operations', () => {
  beforeEach(() => {
    TimerTestUtils.setupFakeTimers();
  });

  test('coordinates async operations with timers', async () => {
    const asyncOperation = async () => {
      return new Promise<string>((resolve) => {
        setTimeout(() => resolve('completed'), 2000);
      });
    };

    const result = await TimerTestUtils.coordAsyncOperation(
      asyncOperation,
      3000 // Advance 3 seconds
    );
    
    expect(result).toBe('completed');
  });

  test('handles timeout scenarios', async () => {
    const slowOperation = async () => {
      return new Promise((resolve, reject) => {
        setTimeout(() => reject(new Error('Timeout')), 5000);
      });
    };

    await TimerTestUtils.testTimeoutScenario(
      5000,
      slowOperation,
      'Timeout'
    );
  });
});
```

### Event Synchronization

```typescript
describe('Event Synchronization', () => {
  beforeEach(() => {
    TimerTestUtils.setupFakeTimers();
  });

  test('synchronizes timer events', async () => {
    const emitter = new EventEmitter();
    const eventHandler = jest.fn();
    emitter.on('test', eventHandler);

    const eventConfigs = [
      { 
        eventName: 'test', 
        eventData: 'first', 
        delay: 500, 
        emitter 
      },
      { 
        eventName: 'test', 
        eventData: 'second', 
        delay: 1000, 
        emitter 
      }
    ];

    await TimerTestUtils.syncTimerEvents(1500, eventConfigs);
    
    expect(eventHandler).toHaveBeenNthCalledWith(1, 'first');
    expect(eventHandler).toHaveBeenNthCalledWith(2, 'second');
  });
});
```

### Batch Timer Operations

```typescript
describe('Batch Operations', () => {
  beforeEach(() => {
    TimerTestUtils.setupFakeTimers();
  });

  test('executes batch timer operations', async () => {
    const callback1 = jest.fn();
    const callback2 = jest.fn();
    const callback3 = jest.fn();
    
    setTimeout(callback1, 1000);
    setTimeout(callback2, 3000);
    setTimeout(callback3, 6000);

    const operations = [
      {
        description: 'First callback',
        timeAdvancement: 1500,
        assertion: () => expect(callback1).toHaveBeenCalledTimes(1)
      },
      {
        description: 'Second callback',
        timeAdvancement: 2000,
        assertion: () => expect(callback2).toHaveBeenCalledTimes(1)
      },
      {
        description: 'Third callback',
        timeAdvancement: 3500,
        assertion: () => expect(callback3).toHaveBeenCalledTimes(1)
      }
    ];

    await TimerTestUtils.batchTimerOperations(operations);
  });
});
```

## 🛠️ Advanced Features

### Test Environment Setup

```typescript
describe('Advanced Setup', () => {
  test('uses comprehensive test environment', async () => {
    const testEnv = TimerTestUtils.setupTestEnvironment({
      fixedStartTime: new Date('2025-01-01T00:00:00.000Z'),
      defaultTimeout: 30000
    });
    
    const callback = jest.fn();
    setTimeout(callback, 1000);
    
    await testEnv.advance(1500);
    expect(callback).toHaveBeenCalledTimes(1);
    
    const mockProcess = testEnv.createProcess({ pid: 12345 });
    expect(mockProcess.pid).toBe(12345);
    
    await testEnv.waitEvents(2);
    
    testEnv.cleanup();
  });
});
```

### Timer Diagnostics

```typescript
describe('Diagnostics', () => {
  test('provides timer diagnostics', () => {
    const diagnostics = TimerTestUtils.getTimerDiagnostics();
    
    expect(diagnostics.fakeTimersEnabled).toBe(false);
    expect(typeof diagnostics.currentTime).toBe('number');
    expect(typeof diagnostics.pendingTimers).toBe('number');
  });
});
```

### Real Timer Execution

```typescript
describe('Real Timer Execution', () => {
  beforeEach(() => {
    TimerTestUtils.setupFakeTimers();
  });

  test('executes callback with real timers', async () => {
    const result = await TimerTestUtils.withRealTimers(async () => {
      // This code runs with real timers
      return new Promise<string>((resolve) => {
        setTimeout(() => resolve('real timer result'), 10);
      });
    });
    
    expect(result).toBe('real timer result');
  });
});
```

### Mock Process Configuration

```typescript
describe('Mock Process Creation', () => {
  test('creates configured mock process', () => {
    const mockProcess = TimerTestUtils.createMockProcess({
      pid: 12345,
      killed: false,
      exitCode: null,
      includeStdin: true
    });
    
    expect(mockProcess.pid).toBe(12345);
    expect(mockProcess.killed).toBe(false);
    expect(mockProcess.exitCode).toBe(null);
    expect(mockProcess).toHaveProperty('stdin');
    expect(mockProcess.stdin).toHaveProperty('write');
  });
});
```

## 🚨 Best Practices

### Setup and Cleanup

```typescript
describe('Best Practices', () => {
  beforeEach(() => {
    // Always setup fake timers in beforeEach
    TimerTestUtils.setupFakeTimers();
  });

  afterEach(() => {
    // Always cleanup in afterEach
    TimerTestUtils.cleanupTimers();
  });

  test('follows proper patterns', async () => {
    // Use advancement with event coordination
    await TimerTestUtils.advanceTimersAndFlush(1000);
    
    // Not just: jest.advanceTimersByTime(1000);
  });
});
```

### Event Loop Coordination

```typescript
test('proper event loop coordination', async () => {
  const callback = jest.fn();
  
  // Start async operation
  setTimeout(callback, 1000);
  
  // Allow setup to complete
  await TimerTestUtils.waitForEvents();
  
  // Advance timers with coordination
  await TimerTestUtils.advanceTimersAndFlush(1500);
  
  expect(callback).toHaveBeenCalledTimes(1);
});
```

### Error Handling

```typescript
test('handles errors in timer operations', async () => {
  const errorCallback = jest.fn(() => {
    throw new Error('Timer error');
  });
  
  setTimeout(errorCallback, 1000);
  
  // Should not throw - errors are contained
  await TimerTestUtils.advanceTimersAndFlush(1500);
  
  expect(errorCallback).toHaveBeenCalledTimes(1);
});
```

## 🔗 Integration Examples

### ClaudeOrchestrator Heartbeat Testing

```typescript
import { ClaudeOrchestrator } from '../src/ai/ClaudeOrchestrator';
import { TimerTestUtils } from '../src/utils/TimerTestUtils';

describe('ClaudeOrchestrator Heartbeat', () => {
  let orchestrator: ClaudeOrchestrator;
  let mockProcess: any;

  beforeEach(() => {
    TimerTestUtils.setupFakeTimers();
    mockProcess = TimerTestUtils.createMockProcess();
    
    orchestrator = new ClaudeOrchestrator({
      timeout: 300000,
      heartbeatInterval: 30000
    });
  });

  afterEach(() => {
    TimerTestUtils.cleanupTimers();
  });

  test('monitors process heartbeat', async () => {
    const processSlowHandler = jest.fn();
    orchestrator.on('processSlow', processSlowHandler);
    
    // Start operation
    const batchPromise = orchestrator.processBatch(mockBatch);
    await TimerTestUtils.waitForEvents();
    
    // Trigger heartbeat check
    await TimerTestUtils.advanceTimersAndFlush(30000);
    
    expect(processSlowHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: expect.any(String),
        timeSinceLastActivity: expect.any(Number)
      })
    );
  });
});
```

### ResourceLimitWrapper Testing

```typescript
import { ResourceLimitWrapper } from '../src/utils/ResourceLimitWrapper';
import { TimerTestUtils } from '../src/utils/TimerTestUtils';

describe('ResourceLimitWrapper', () => {
  beforeEach(() => {
    TimerTestUtils.setupFakeTimers();
  });

  afterEach(() => {
    TimerTestUtils.cleanupTimers();
  });

  test('monitors resource usage at intervals', async () => {
    const mockGetResourceUsage = jest.fn().mockReturnValue({
      cpu: '25.0',
      memory: '128MB'
    });
    
    const wrapper = new ResourceLimitWrapper({
      memoryLimit: '256MB',
      cpuLimit: 50,
      checkInterval: 5000
    });
    
    const mockProcess = TimerTestUtils.createMockProcess();
    
    await wrapper.executeWithLimits(mockProcess);
    await TimerTestUtils.waitForEvents();
    
    // Test resource checking over time
    await TimerTestUtils.testResourceMonitoring(
      5000, // checkInterval
      mockGetResourceUsage,
      25000 // 25 seconds total
    );
    
    expect(mockGetResourceUsage).toHaveBeenCalledTimes(5);
  });
});
```

## 📊 Performance Considerations

### Efficient Timer Testing

```typescript
test('efficient timer testing', async () => {
  // ✅ Good - uses coordination
  await TimerTestUtils.advanceTimersAndFlush(5000);
  
  // ❌ Avoid - missing event loop coordination
  jest.advanceTimersByTime(5000);
  expect(callback).toHaveBeenCalled(); // May be flaky
});
```

### Batch Operations

```typescript
test('batch multiple timer checks', async () => {
  // ✅ Good - single batch operation
  const operations = [
    { description: 'First check', timeAdvancement: 1000, assertion: () => {} },
    { description: 'Second check', timeAdvancement: 2000, assertion: () => {} },
    { description: 'Third check', timeAdvancement: 3000, assertion: () => {} }
  ];
  
  await TimerTestUtils.batchTimerOperations(operations);
  
  // ❌ Avoid - multiple separate advances
  // await TimerTestUtils.advanceTimersAndFlush(1000);
  // await TimerTestUtils.advanceTimersAndFlush(2000);
  // await TimerTestUtils.advanceTimersAndFlush(3000);
});
```

## 🔧 Troubleshooting

### Common Issues

#### Issue: Timers Not Executing
```typescript
// ❌ Problem: Missing event coordination
jest.advanceTimersByTime(1000);
expect(callback).toHaveBeenCalled();

// ✅ Solution: Use proper coordination
await TimerTestUtils.advanceTimersAndFlush(1000);
expect(callback).toHaveBeenCalled();
```

#### Issue: Flaky Tests
```typescript
// ❌ Problem: Race conditions
setTimeout(callback, 1000);
jest.advanceTimersByTime(1000);

// ✅ Solution: Event coordination
setTimeout(callback, 1000);
await TimerTestUtils.waitForEvents(); // Allow setup
await TimerTestUtils.advanceTimersAndFlush(1000);
```

#### Issue: Memory Leaks
```typescript
// ✅ Always cleanup in afterEach
afterEach(() => {
  TimerTestUtils.cleanupTimers();
  jest.clearAllMocks();
});
```

### Debugging Timer Issues

```typescript
test('debug timer state', async () => {
  const diagnostics = TimerTestUtils.getTimerDiagnostics();
  console.log('Timer state:', diagnostics);
  
  if (!diagnostics.fakeTimersEnabled) {
    console.warn('Fake timers not enabled!');
  }
  
  if (diagnostics.pendingTimers > 0) {
    console.log(`${diagnostics.pendingTimers} timers still pending`);
  }
});
```

## 🎯 Next Steps

After implementing TimerTestUtils:

1. **Apply to Existing Tests**: Update problematic timer tests to use the utility library
2. **Create TestableTimer**: Implement timer abstraction for dependency injection (TASK-TIMER-005)
3. **Build Async Framework**: Create comprehensive async testing utilities (TASK-TIMER-006)
4. **Convert Test Suites**: Migrate critical tests to new patterns (TASK-TIMER-007)

## 📚 Related Documentation

- **Timer Testing Patterns**: [`timer-testing-patterns.md`](./timer-testing-patterns.md) - Foundational patterns
- **Timer Troubleshooting**: [`timer-testing-troubleshooting.md`](./timer-testing-troubleshooting.md) - Issue resolution
- **AI Agent Validation**: [`ai-agent-validation.md`](./ai-agent-validation.md) - Validation framework
- **Testing Guide**: [`CLAUDE.md`](./CLAUDE.md) - Testing documentation navigation

---

**TimerTestUtils Philosophy**: Deterministic timer testing requires proper coordination between fake timers, the event loop, and async operations. This library standardizes proven patterns while providing flexibility for complex testing scenarios.