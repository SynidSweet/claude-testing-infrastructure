# TestableTimer System

*Last updated: 2025-07-07 | Complete timer abstraction system with dependency injection for deterministic testing*

## Overview

The TestableTimer system provides a comprehensive abstraction layer for timer operations that enables dependency injection and deterministic testing of time-based functionality. This system is the foundation for systematic timer testing improvements across the Claude Testing Infrastructure.

## Core Components

### Timer Abstractions (`src/types/timer-types.ts`)
- **TestableTimer Interface**: Core abstraction for all timer operations
- **MockTimerController Interface**: Extended interface for test-time control
- **TimerHandle Interface**: Cancellable timer operation results
- **TimerFactory Interface**: Factory for creating appropriate timer implementations
- **Validation Types**: TimerValidationError, TimerOperationError, TimerMetrics

### Production Implementation (`src/utils/RealTimer.ts`)
- **RealTimer Class**: Production implementation using native Node.js/browser timers
- **Features**: Metrics tracking, error handling, proper cleanup, argument passing
- **Timer Types**: setTimeout, setInterval, setImmediate with cross-platform support
- **Validation**: Parameter validation, timeout limits, callback error catching

### Test Implementation (`src/utils/MockTimer.ts`)
- **MockTimer Class**: Test implementation with complete time control
- **Time Control**: Manual time advancement, jump to next timer, run all timers
- **Debugging**: Pending timer inspection, execution logging, state tracking
- **Deterministic**: Precise chronological execution, no real time dependencies

### Factory System (`src/utils/TimerFactory.ts`)
- **Environment Detection**: Automatic selection between real/mock timers
- **Configuration**: Type-safe configuration with validation
- **Convenience Functions**: createTimer, createMockTimer, createRealTimer
- **Singleton Support**: Optional singleton pattern for consistent usage

## Usage Patterns

### Basic Timer Operations
```typescript
import { createTimer } from './src/utils/TimerFactory';

const timer = createTimer({ type: 'mock' });

// Schedule operations
const handle = timer.schedule(() => console.log('executed'), 1000);
timer.scheduleInterval(() => console.log('recurring'), 500);
timer.scheduleImmediate(() => console.log('immediate'));

// Timer management
console.log(`Active timers: ${timer.getActiveTimerCount()}`);
timer.cancelAll();
```

### Test-Specific Control
```typescript
import { createMockTimer } from './src/utils/TimerFactory';

const mockTimer = createMockTimer(1000); // Start at time 1000

// Schedule timers
mockTimer.schedule(() => executed = true, 500);

// Control time
mockTimer.advanceTime(500); // Execute scheduled timers
mockTimer.setCurrentTime(2000); // Jump to specific time
mockTimer.runAllTimers(); // Execute all pending timers immediately
```

### Dependency Injection
```typescript
class MyService {
  constructor(private timer: TestableTimer) {}
  
  startHeartbeat() {
    return this.timer.scheduleInterval(() => {
      this.sendHeartbeat();
    }, 30000);
  }
}

// Production
const service = new MyService(createRealTimer());

// Testing
const service = new MyService(createMockTimer());
```

## Integration Points

### Current Integrations
- **TimerTestUtils**: Built on top of TestableTimer abstractions
- **Type System**: Comprehensive TypeScript interfaces
- **Test Suite**: 31 passing tests validating all functionality

### Planned Integrations
- **ClaudeOrchestrator**: Replace direct timer usage with TestableTimer
- **Process Monitoring**: Inject TestableTimer for deterministic testing
- **Heartbeat Systems**: Use TestableTimer for reliable test execution

## Testing Infrastructure

### Test Coverage
- **MockTimer**: Complete time control and advancement testing
- **RealTimer**: Production timer functionality validation  
- **TimerFactory**: Environment detection and configuration testing
- **Integration**: Interface compatibility and switching tests

### Test Location
`tests/utils/TimerAbstraction.test.ts` - Comprehensive test suite with 32 tests (31 passing, 1 skipped for environment sensitivity)

## Benefits

### For Development
- **Deterministic Testing**: No more flaky timer-based tests
- **Dependency Injection**: Easy mocking and test isolation
- **Type Safety**: Full TypeScript support with comprehensive interfaces
- **Error Handling**: Graceful degradation and detailed error reporting

### For Infrastructure
- **Systematic Testing**: Foundation for reliable AI process testing
- **Performance Monitoring**: Built-in metrics and timing analysis
- **Environment Flexibility**: Automatic adaptation to test vs production
- **Future Extensibility**: Clean abstractions for additional timer features

## Architecture Decision

The TestableTimer system uses **composition over inheritance** and **dependency injection** to provide:
1. **Clean separation** between real and mock implementations
2. **Testable code** through dependency injection
3. **Type safety** through comprehensive TypeScript interfaces
4. **Environment awareness** through automatic detection and configuration

This system serves as the foundation for TASK-TIMER-006 (async test utilities framework) and subsequent timer-related improvements throughout the Claude Testing Infrastructure.