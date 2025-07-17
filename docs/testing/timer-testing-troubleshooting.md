# Timer Testing Troubleshooting Guide

*Comprehensive troubleshooting guide for timer-based test issues*

*Created: 2025-07-07 | TASK-TIMER-002 | Updated: 2025-07-16 | TASK-2025-010 | Heartbeat monitoring test refactoring solutions*

## 🚨 Common Timer Test Issues

### 1. Test Timeouts / Hanging Tests

#### **Symptoms**
- Tests hang indefinitely
- Jest timeout errors after 30+ seconds
- No clear error message, just timeout

#### **Root Causes**
- Real timers not properly mocked
- Infinite timer loops
- Missing `jest.useRealTimers()` cleanup
- Process not terminating properly

#### **Solutions**

**A. Verify Timer Mocking**
```typescript
// ❌ Missing timer mocking
test('timer operation', async () => {
  startTimerOperation(); // Uses real timers
  // Test hangs waiting for real time
});

// ✅ Proper timer mocking
test('timer operation', async () => {
  jest.useFakeTimers();
  startTimerOperation();
  jest.advanceTimersByTime(5000);
  await Promise.resolve(); // Allow events to be processed
  jest.useRealTimers();
});

// ✅ Alternative - Use in beforeEach/afterEach
test('timer operation with setup', async () => {
  startTimerOperation();
  jest.advanceTimersByTime(5000);
  await Promise.resolve(); // Critical for event processing
});
```

**B. Check Timer Cleanup**
```typescript
// ❌ No cleanup - timers leak between tests
describe('Timer Tests', () => {
  test('first test', () => {
    jest.useFakeTimers();
    // No cleanup
  });
  
  test('second test', () => {
    // Inherits timer state from previous test
  });
});

// ✅ Proper cleanup
describe('Timer Tests', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());
});
```

**C. Infinite Timer Prevention**
```typescript
// ❌ Infinite timer loop
setInterval(() => {
  if (condition) {
    // Never clears interval
    doSomething();
  }
}, 1000);

// ✅ Proper timer management
const interval = setInterval(() => {
  if (condition) {
    clearInterval(interval);
    doSomething();
  }
}, 1000);
```

### 2. Flaky Timer Tests

#### **Symptoms**
- Tests pass sometimes, fail other times
- Different behavior on different machines
- Timing-dependent failures

#### **Root Causes**
- Missing event loop coordination
- Race conditions between timers and promises
- Platform-specific timing differences
- Inadequate timer advancement

#### **Solutions**

**A. Add Event Loop Coordination**
```typescript
// ❌ Missing coordination
jest.advanceTimersByTime(1000);
expect(handler).toHaveBeenCalled(); // Flaky

// ✅ Proper coordination
jest.advanceTimersByTime(1000);
await Promise.resolve(); // Allow microtasks
jest.runOnlyPendingTimers(); // Execute timers
expect(handler).toHaveBeenCalled(); // Reliable
```

**B. Sequential Timer Advancement**
```typescript
// ❌ Large time jumps can miss events
jest.advanceTimersByTime(60000); // Might skip intermediate events

// ✅ Incremental advancement
for (let i = 0; i < 6; i++) {
  jest.advanceTimersByTime(10000);
  await Promise.resolve();
  jest.runOnlyPendingTimers();
}
```

**C. Fixed Start Times**
```typescript
// ❌ Variable start time
jest.useFakeTimers(); // Uses current time

// ✅ Fixed start time
jest.useFakeTimers({
  now: new Date('2025-01-01T00:00:00.000Z')
});
```

### 3. Timer Events Not Firing

#### **Symptoms**
- `expect(handler).toHaveBeenCalled()` fails
- Timer callbacks not executing
- Events not being emitted

#### **Root Causes**
- Insufficient timer advancement
- Wrong timer advancement method
- Event handlers not properly attached
- Process mocking issues

#### **Solutions**

**A. Verify Timer Advancement**
```typescript
// ❌ Insufficient advancement
jest.advanceTimersByTime(500); // Timer set for 1000ms
expect(handler).toHaveBeenCalled(); // Fails

// ✅ Adequate advancement
jest.advanceTimersByTime(1000); // Matches timer interval
await Promise.resolve();
jest.runOnlyPendingTimers();
expect(handler).toHaveBeenCalled(); // Passes
```

**B. Use Correct Timer Method**
```typescript
// ❌ Wrong method for recurring timers
setInterval(handler, 1000);
jest.runAllTimers(); // Runs infinitely

// ✅ Correct method for recurring timers
setInterval(handler, 1000);
jest.advanceTimersByTime(1000);
jest.runOnlyPendingTimers();
```

**C. Check Event Handler Attachment**
```typescript
// ❌ Handler attached after timer start
startTimer();
emitter.on('event', handler); // Too late

// ✅ Handler attached before timer start
emitter.on('event', handler);
startTimer();
```

### 4. Real Timer Interference

#### **Symptoms**
- Tests behave differently with fake vs real timers
- Unexpected delays even with fake timers
- Timer operations using real time

#### **Root Causes**
- Incomplete timer mocking
- External dependencies using real timers
- Jest configuration issues

#### **Solutions**

**A. Complete Timer Mocking**
```typescript
// ❌ Incomplete mocking
jest.useFakeTimers(); // Only mocks some timer functions

// ✅ Complete mocking
jest.useFakeTimers({
  doNotFake: ['nextTick'], // Only keep essential real functions
  timers: 'legacy' // For older Jest versions
});
```

**B. Mock External Dependencies**
```typescript
// ❌ External library using real timers
import { delay } from 'external-library';
delay(1000); // Uses real setTimeout

// ✅ Mock external dependencies
jest.mock('external-library', () => ({
  delay: jest.fn().mockResolvedValue(undefined)
}));
```

**C. Check Jest Configuration**
```typescript
// jest.config.js
module.exports = {
  fakeTimers: {
    enableGlobally: true,
    doNotFake: ['nextTick']
  }
};
```

### 5. Process Event Timing Issues

#### **Symptoms**
- Process events not firing in tests
- Event handlers called in wrong order
- Missing stdout/stderr events

#### **Root Causes**
- Incomplete process mocking
- Event emission timing
- Missing event loop ticks

#### **Solutions**

**A. Complete Process Mocking**
```typescript
// ❌ Incomplete process mock
const mockProcess = new EventEmitter();
// Missing stdout, stderr, other properties

// ✅ Complete process mock
const mockProcess = new EventEmitter();
mockProcess.stdout = new EventEmitter();
mockProcess.stderr = new EventEmitter();
mockProcess.kill = jest.fn();
mockProcess.pid = 12345;
mockProcess.killed = false;
```

**B. Proper Event Emission Timing**
```typescript
// ❌ Immediate event emission
mockProcess.stdout.emit('data', 'output');
expect(handler).toHaveBeenCalled(); // May fail

// ✅ Delayed event emission
mockProcess.stdout.emit('data', 'output');
await Promise.resolve(); // Allow handlers to run
expect(handler).toHaveBeenCalled(); // Reliable
```

**C. Event Order Management**
```typescript
// ❌ Events emitted out of order
mockProcess.emit('close', 0);
mockProcess.stdout.emit('data', 'final output'); // Too late

// ✅ Proper event order
mockProcess.stdout.emit('data', 'final output');
await Promise.resolve();
mockProcess.emit('close', 0);
```

### 6. Memory Leaks in Timer Tests

#### **Symptoms**
- Tests slow down over time
- Memory usage increases during test run
- Jest warnings about leaks

#### **Root Causes**
- Timers not cleared properly
- Event listeners not removed
- Process references not cleaned up

#### **Solutions**

**A. Timer Cleanup**
```typescript
// ❌ Timers not cleared
const interval = setInterval(handler, 1000);
// Test ends without clearing

// ✅ Proper timer cleanup
const interval = setInterval(handler, 1000);
afterEach(() => {
  clearInterval(interval);
  jest.clearAllTimers();
});
```

**B. Event Listener Cleanup**
```typescript
// ❌ Listeners not removed
beforeEach(() => {
  process.on('SIGTERM', handler);
});

// ✅ Proper listener cleanup
let signalHandler: any;

beforeEach(() => {
  signalHandler = jest.fn();
  process.on('SIGTERM', signalHandler);
});

afterEach(() => {
  process.removeListener('SIGTERM', signalHandler);
});
```

**C. Process Reference Cleanup**
```typescript
// ❌ Process references retained
let longRunningProcess: any;

// ✅ Proper process cleanup
afterEach(() => {
  if (longRunningProcess && !longRunningProcess.killed) {
    longRunningProcess.kill('SIGTERM');
    longRunningProcess = null;
  }
});
```

## 🔧 Debugging Techniques

### 1. Timer State Inspection

```typescript
// Check current timer state
console.log('Pending timers:', jest.getTimerCount());

// Check what timers are scheduled
jest.useFakeTimers();
setTimeout(() => console.log('Timer 1'), 1000);
setTimeout(() => console.log('Timer 2'), 2000);
console.log('Timer count:', jest.getTimerCount()); // 2
```

### 2. Event Loop Debugging

```typescript
// Add debugging to event loop coordination
async function debugEventLoop(label: string) {
  console.log(`${label}: Before Promise.resolve()`);
  await Promise.resolve();
  console.log(`${label}: After Promise.resolve()`);
}

// Usage in tests
await debugEventLoop('Before timer advancement');
jest.advanceTimersByTime(1000);
await debugEventLoop('After timer advancement');
```

### 3. Timer Advancement Logging

```typescript
function advanceTimersWithLogging(timeMs: number, label: string) {
  console.log(`${label}: Advancing ${timeMs}ms, current count: ${jest.getTimerCount()}`);
  jest.advanceTimersByTime(timeMs);
  console.log(`${label}: After advancement, count: ${jest.getTimerCount()}`);
}
```

### 4. Process Event Debugging

```typescript
function createDebugMockProcess(label: string) {
  const proc = new EventEmitter();
  
  // Log all events
  const originalEmit = proc.emit;
  proc.emit = function(event: string, ...args: any[]) {
    console.log(`${label}: Process event '${event}'`, args);
    return originalEmit.call(this, event, ...args);
  };
  
  return proc;
}
```

## 📋 Timer Test Checklist

### Before Writing Timer Tests
- [ ] Understand the timing requirements
- [ ] Identify all timer dependencies
- [ ] Plan event coordination points
- [ ] Consider error scenarios

### During Test Implementation
- [ ] Use `jest.useFakeTimers()` in setup
- [ ] Mock all external timer dependencies
- [ ] Add proper event loop coordination
- [ ] Test multiple timer intervals
- [ ] Include error and edge cases

### After Test Implementation
- [ ] Verify tests pass consistently
- [ ] Check for memory leaks
- [ ] Validate timer cleanup
- [ ] Test on different platforms
- [ ] Add debugging aids if needed

### Test Review Checklist
- [ ] All timers properly mocked
- [ ] Event loop coordination present
- [ ] Proper cleanup in `afterEach`
- [ ] No real timer dependencies
- [ ] Adequate timer advancement
- [ ] Process mocking complete
- [ ] Event emission timing correct

## 🚑 Emergency Fixes

### Quick Fix for Hanging Tests
```typescript
// Add to any hanging timer test
jest.setTimeout(10000); // 10 second timeout
afterEach(() => {
  jest.useRealTimers();
  jest.clearAllTimers();
  jest.clearAllMocks();
});
```

### Quick Fix for Flaky Tests
```typescript
// Add event loop coordination everywhere
const advanceAndWait = async (timeMs: number) => {
  jest.advanceTimersByTime(timeMs);
  await Promise.resolve();
  await Promise.resolve(); // Extra tick for safety
  jest.runOnlyPendingTimers();
};
```

### Quick Fix for Event Issues
```typescript
// Ensure all process events are mocked
const createFullMockProcess = () => {
  const proc = new EventEmitter() as any;
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  proc.stdin = new EventEmitter();
  proc.kill = jest.fn();
  proc.killed = false;
  proc.pid = Math.floor(Math.random() * 10000);
  proc.exitCode = null;
  return proc;
};
```

## 📚 Additional Resources

### Related Documentation
- [Timer Testing Patterns Guide](./timer-testing-patterns.md)
- [Jest Timer Documentation](https://jestjs.io/docs/timer-mocks)
- [Node.js Process Events](https://nodejs.org/api/process.html#process_process_events)

### Example Files
- `/tests/ai/heartbeat-monitoring.test.ts` - Complex timer patterns
- `/tests/utils/ResourceLimitWrapper.test.ts` - Resource monitoring
- `/tests/ai/ClaudeOrchestrator.stderr.test.ts` - Process events

---

**Troubleshooting Philosophy**: Timer test issues are almost always coordination problems. When in doubt, add more event loop coordination and verify complete mocking of timer dependencies.