/**
 * Test suite for TimerTestUtils utility library
 * 
 * Validates timer testing utilities, mock timer service, and helper functions
 * for deterministic testing of timer-based and async operations.
 */

import { EventEmitter } from 'events';
import { 
  TimerTestUtils, 
  MockTimerService, 
  timerTestHelpers,
  TimerTestConfig,
  TimerAdvancementOptions,
  MockProcessConfig,
  TimerEventConfig
} from '../../src/utils/TimerTestUtils';

describe('TimerTestUtils', () => {
  let originalSetTimeout: typeof setTimeout;
  let originalSetInterval: typeof setInterval;
  let originalClearTimeout: typeof clearTimeout;
  let originalClearInterval: typeof clearInterval;

  beforeAll(() => {
    // Store original timer functions
    originalSetTimeout = global.setTimeout;
    originalSetInterval = global.setInterval;
    originalClearTimeout = global.clearTimeout;
    originalClearInterval = global.clearInterval;
  });

  afterAll(() => {
    // Restore original timer functions
    global.setTimeout = originalSetTimeout;
    global.setInterval = originalSetInterval;
    global.clearTimeout = originalClearTimeout;
    global.clearInterval = originalClearInterval;
  });

  beforeEach(() => {
    // Clean up any timers between tests
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  afterEach(() => {
    // Ensure clean state after each test
    jest.clearAllTimers();
    jest.useRealTimers();
    // Additional cleanup to prevent worker process issues
    TimerTestUtils.cleanupTimers();
  });

  describe('Timer Setup and Cleanup', () => {
    test('should setup fake timers with default configuration', () => {
      TimerTestUtils.setupFakeTimers();
      
      expect(TimerTestUtils.isFakeTimersEnabled()).toBe(true);
      expect(TimerTestUtils.getTimerDiagnostics().fakeTimersEnabled).toBe(true);
    });

    test('should setup fake timers with custom configuration', () => {
      const config: TimerTestConfig = {
        useFakeTimers: true,
        fixedStartTime: new Date('2024-01-01T00:00:00.000Z'),
        doNotFake: ['nextTick', 'setImmediate'],
        autoAdvance: false
      };

      TimerTestUtils.setupFakeTimers(config);
      
      expect(TimerTestUtils.isFakeTimersEnabled()).toBe(true);
      expect(Date.now()).toBe(new Date('2024-01-01T00:00:00.000Z').getTime());
    });

    test('should skip timer setup when useFakeTimers is false', () => {
      TimerTestUtils.setupFakeTimers({ useFakeTimers: false });
      
      expect(TimerTestUtils.isFakeTimersEnabled()).toBe(false);
    });

    test('should cleanup timers and restore real timers', () => {
      TimerTestUtils.setupFakeTimers();
      expect(TimerTestUtils.isFakeTimersEnabled()).toBe(true);
      
      TimerTestUtils.cleanupTimers();
      expect(TimerTestUtils.isFakeTimersEnabled()).toBe(false);
    });
  });

  describe('Timer Advancement', () => {
    beforeEach(() => {
      TimerTestUtils.setupFakeTimers();
    });

    test('should advance timers and flush events', async () => {
      const callback = jest.fn();
      setTimeout(callback, 1000);

      await TimerTestUtils.advanceTimersAndFlush(1500);
      
      expect(callback).toHaveBeenCalledTimes(1);
    });

    test('should advance timers with custom options', async () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();
      setTimeout(callback1, 1000);
      setTimeout(callback2, 2000);  // This one is beyond our advance time

      const options: Partial<TimerAdvancementOptions> = {
        waitForEvents: false,
        runPendingTimers: false,
        eventLoopTicks: 0
      };

      await TimerTestUtils.advanceTimersAndFlush(1500, options);
      
      // Should have run callback1 (at 1000ms) but not callback2 (at 2000ms)
      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).not.toHaveBeenCalled();
      
      // With runPendingTimers: false, callback2 remains pending
      // Running pending timers manually should execute it
      jest.runOnlyPendingTimers();
      expect(callback2).toHaveBeenCalledTimes(1);
    });

    test('should wait for multiple event loop ticks', async () => {
      const promises: Promise<void>[] = [];
      
      for (let i = 0; i < 3; i++) {
        promises.push(Promise.resolve().then(() => {}));
      }

      await TimerTestUtils.waitForEvents(3);
      
      // All promises should be resolved
      await Promise.all(promises);
      expect(promises).toHaveLength(3);
    });

    test('should coordinate timer events with proper sequencing', async () => {
      const emitter = new EventEmitter();
      const eventHandler = jest.fn();
      emitter.on('test', eventHandler);

      const eventConfigs: TimerEventConfig[] = [
        { eventName: 'test', eventData: 'first', delay: 500, emitter },
        { eventName: 'test', eventData: 'second', delay: 1000, emitter }
      ];

      await TimerTestUtils.syncTimerEvents(1500, eventConfigs);
      
      expect(eventHandler).toHaveBeenCalledTimes(2);
      expect(eventHandler).toHaveBeenNthCalledWith(1, 'first');
      expect(eventHandler).toHaveBeenNthCalledWith(2, 'second');
    });
  });

  describe('Mock Process Creation', () => {
    test('should create mock process with default configuration', () => {
      const mockProcess = TimerTestUtils.createMockProcess();
      
      expect(mockProcess).toHaveProperty('stdout');
      expect(mockProcess).toHaveProperty('stderr');
      expect(mockProcess).toHaveProperty('kill');
      expect(mockProcess).toHaveProperty('pid');
      expect(mockProcess.killed).toBe(false);
      expect(mockProcess.exitCode).toBe(null);
      expect(typeof mockProcess.pid).toBe('number');
      expect(mockProcess.pid).toBeGreaterThan(999);
    });

    test('should create mock process with custom configuration', () => {
      const config: MockProcessConfig = {
        pid: 12345,
        killed: true,
        exitCode: 1,
        includeStdin: true
      };

      const mockProcess = TimerTestUtils.createMockProcess(config);
      
      expect(mockProcess.pid).toBe(12345);
      expect(mockProcess.killed).toBe(true);
      expect(mockProcess.exitCode).toBe(1);
      expect(mockProcess).toHaveProperty('stdin');
      expect(mockProcess.stdin).toHaveProperty('write');
      expect(mockProcess.stdin).toHaveProperty('end');
    });

    test('should create process with event emitter functionality', () => {
      const mockProcess = TimerTestUtils.createMockProcess();
      const eventHandler = jest.fn();
      
      mockProcess.on('test-event', eventHandler);
      mockProcess.emit('test-event', 'test-data');
      
      expect(eventHandler).toHaveBeenCalledWith('test-data');
    });
  });

  describe('Heartbeat Testing Patterns', () => {
    let activeIntervals: NodeJS.Timeout[] = [];
    
    beforeEach(() => {
      TimerTestUtils.setupFakeTimers();
      activeIntervals = [];
    });

    afterEach(() => {
      // Clean up any active intervals to prevent resource leaks
      activeIntervals.forEach(intervalId => clearInterval(intervalId));
      activeIntervals = [];
    });

    test('should test heartbeat pattern with multiple iterations', async () => {
      const heartbeatCallback = jest.fn();
      const heartbeatInterval = 30000; // 30 seconds
      
      // Set up heartbeat mechanism
      const intervalId = setInterval(heartbeatCallback, heartbeatInterval);
      activeIntervals.push(intervalId);

      // First iteration - advance exactly to first heartbeat
      jest.advanceTimersByTime(heartbeatInterval);
      expect(heartbeatCallback).toHaveBeenCalledTimes(1);

      // Second iteration  
      jest.advanceTimersByTime(heartbeatInterval);
      expect(heartbeatCallback).toHaveBeenCalledTimes(2);

      // Third iteration
      jest.advanceTimersByTime(heartbeatInterval);
      expect(heartbeatCallback).toHaveBeenCalledTimes(3);
      
      clearInterval(intervalId);
      activeIntervals = activeIntervals.filter(id => id !== intervalId);
    });

    test('should test progressive timeout warnings', async () => {
      const warningCallback = jest.fn();
      const totalTimeout = 60000; // 60 seconds
      const thresholds = [50, 75, 90];
      
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
      
      expect(warningCallback).toHaveBeenCalledTimes(3);
      expect(warningCallback).toHaveBeenCalledWith({ threshold: 50 });
      expect(warningCallback).toHaveBeenCalledWith({ threshold: 75 });
      expect(warningCallback).toHaveBeenCalledWith({ threshold: 90 });
    });
  });

  describe('Process Lifecycle Testing', () => {
    let activeIntervals: NodeJS.Timeout[] = [];
    
    beforeEach(() => {
      TimerTestUtils.setupFakeTimers();
      activeIntervals = [];
    });

    afterEach(() => {
      // Clean up any active intervals to prevent resource leaks
      activeIntervals.forEach(intervalId => clearInterval(intervalId));
      activeIntervals = [];
    });

    test('should test process lifecycle events', async () => {
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
      expect(eventHandler).toHaveBeenNthCalledWith(1, { status: 'starting' });
      expect(eventHandler).toHaveBeenNthCalledWith(2, { status: 'ready' });
      expect(eventHandler).toHaveBeenNthCalledWith(3, { code: 0 });
    });

    test('should test resource monitoring intervals', async () => {
      const resourceCheckCallback = jest.fn();
      const checkInterval = 5000; // 5 seconds
      const monitoringDuration = 20000; // 20 seconds exactly
      
      // Set up resource monitoring
      const intervalId = setInterval(resourceCheckCallback, checkInterval);
      activeIntervals.push(intervalId);

      // Advance time precisely
      jest.advanceTimersByTime(monitoringDuration);
      
      // Should have checked 4 times (at 5000, 10000, 15000, 20000)
      expect(resourceCheckCallback).toHaveBeenCalledTimes(4);
      
      clearInterval(intervalId);
      activeIntervals = activeIntervals.filter(id => id !== intervalId);
    });
  });

  describe('Async Operation Coordination', () => {
    beforeEach(() => {
      TimerTestUtils.setupFakeTimers();
    });

    test('should coordinate async operations with timer advancement', async () => {
      const asyncCallback = jest.fn();
      
      const asyncOperation = async () => {
        return new Promise<string>((resolve) => {
          setTimeout(() => {
            asyncCallback();
            resolve('completed');
          }, 2000);
        });
      };

      const result = await TimerTestUtils.coordAsyncOperation(
        asyncOperation,
        3000
      );
      
      expect(result).toBe('completed');
      expect(asyncCallback).toHaveBeenCalledTimes(1);
    });

    test('should test timeout scenarios with expected errors', async () => {
      const asyncOperation = async () => {
        return new Promise((_resolve, reject) => {
          setTimeout(() => {
            reject(new Error('Operation timed out'));
          }, 5000);
        });
      };

      await TimerTestUtils.testTimeoutScenario(
        5000,
        asyncOperation,
        'Operation timed out'
      );
      
      // Test should complete without throwing
    });

    test('should batch multiple timer operations', async () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();
      const callback3 = jest.fn();
      
      // Set up timed callbacks
      setTimeout(callback1, 1000);
      setTimeout(callback2, 3000);
      setTimeout(callback3, 6000);

      const operations = [
        {
          description: 'First callback at 1 second',
          timeAdvancement: 1500,
          assertion: () => expect(callback1).toHaveBeenCalledTimes(1)
        },
        {
          description: 'Second callback at 3 seconds',
          timeAdvancement: 2000,
          assertion: () => expect(callback2).toHaveBeenCalledTimes(1)
        },
        {
          description: 'Third callback at 6 seconds',
          timeAdvancement: 3500,
          assertion: () => expect(callback3).toHaveBeenCalledTimes(1)
        }
      ];

      await TimerTestUtils.batchTimerOperations(operations);
      
      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);
      expect(callback3).toHaveBeenCalledTimes(1);
    });
  });

  describe('Test Environment Setup', () => {
    test('should setup comprehensive test environment', () => {
      const testEnv = TimerTestUtils.setupTestEnvironment({
        fixedStartTime: new Date('2025-01-01T00:00:00.000Z')
      });
      
      expect(testEnv).toHaveProperty('cleanup');
      expect(testEnv).toHaveProperty('advance');
      expect(testEnv).toHaveProperty('createProcess');
      expect(testEnv).toHaveProperty('waitEvents');
      
      expect(TimerTestUtils.isFakeTimersEnabled()).toBe(true);
      
      testEnv.cleanup();
      expect(TimerTestUtils.isFakeTimersEnabled()).toBe(false);
    });

    test('should provide working helper functions', async () => {
      const testEnv = TimerTestUtils.setupTestEnvironment();
      const callback = jest.fn();
      
      setTimeout(callback, 1000);
      await testEnv.advance(1500);
      
      expect(callback).toHaveBeenCalledTimes(1);
      
      testEnv.cleanup();
    });
  });

  describe('Timer Diagnostics', () => {
    test('should provide timer diagnostics with real timers', () => {
      const diagnostics = TimerTestUtils.getTimerDiagnostics();
      
      expect(diagnostics).toHaveProperty('fakeTimersEnabled');
      expect(diagnostics).toHaveProperty('pendingTimers');
      expect(diagnostics).toHaveProperty('currentTime');
      expect(diagnostics.fakeTimersEnabled).toBe(false);
      expect(typeof diagnostics.currentTime).toBe('number');
    });

    test('should provide timer diagnostics with fake timers', () => {
      TimerTestUtils.setupFakeTimers();
      
      const diagnostics = TimerTestUtils.getTimerDiagnostics();
      
      expect(diagnostics.fakeTimersEnabled).toBe(true);
    });
  });

  describe('Real Timer Execution', () => {
    beforeEach(() => {
      TimerTestUtils.setupFakeTimers();
    });

    test('should execute callback with real timers temporarily', async () => {
      expect(TimerTestUtils.isFakeTimersEnabled()).toBe(true);
      
      const result = await TimerTestUtils.withRealTimers(async () => {
        expect(TimerTestUtils.isFakeTimersEnabled()).toBe(false);
        return 'executed with real timers';
      });
      
      expect(result).toBe('executed with real timers');
      expect(TimerTestUtils.isFakeTimersEnabled()).toBe(true);
    });

    test('should handle errors in real timer callback', async () => {
      expect(TimerTestUtils.isFakeTimersEnabled()).toBe(true);
      
      await expect(TimerTestUtils.withRealTimers(async () => {
        throw new Error('Test error');
      })).rejects.toThrow('Test error');
      
      expect(TimerTestUtils.isFakeTimersEnabled()).toBe(true);
    });
  });
});

describe('MockTimerService', () => {
  let mockTimer: MockTimerService;

  beforeEach(() => {
    mockTimer = new MockTimerService();
  });

  afterEach(() => {
    // Ensure complete cleanup to prevent worker process issues
    mockTimer.clearAll();
    mockTimer.reset();
  });

  describe('Timer Scheduling', () => {
    test('should schedule setTimeout callback', () => {
      const callback = jest.fn();
      const id = mockTimer.setTimeout(callback, 1000);
      
      expect(id).toBeDefined();
      expect(mockTimer.getPendingCount()).toBe(1);
      expect(callback).not.toHaveBeenCalled();
    });

    test('should schedule setInterval callback', () => {
      const callback = jest.fn();
      const id = mockTimer.setInterval(callback, 500);
      
      expect(id).toBeDefined();
      expect(mockTimer.getPendingCount()).toBe(1);
      expect(callback).not.toHaveBeenCalled();
    });

    test('should clear timeout', () => {
      const callback = jest.fn();
      const id = mockTimer.setTimeout(callback, 1000);
      
      expect(mockTimer.getPendingCount()).toBe(1);
      
      mockTimer.clearTimeout(id);
      expect(mockTimer.getPendingCount()).toBe(0);
    });

    test('should clear interval', () => {
      const callback = jest.fn();
      const id = mockTimer.setInterval(callback, 500);
      
      expect(mockTimer.getPendingCount()).toBe(1);
      
      mockTimer.clearInterval(id);
      expect(mockTimer.getPendingCount()).toBe(0);
    });
  });

  describe('Time Advancement', () => {
    test('should execute setTimeout callback when time advances', () => {
      const callback = jest.fn();
      mockTimer.setTimeout(callback, 1000);
      
      mockTimer.advanceTime(500);
      expect(callback).not.toHaveBeenCalled();
      
      mockTimer.advanceTime(600);
      expect(callback).toHaveBeenCalledTimes(1);
    });

    test('should execute setInterval callback multiple times', () => {
      const callback = jest.fn();
      mockTimer.setInterval(callback, 1000);
      
      mockTimer.advanceTime(3500);
      expect(callback).toHaveBeenCalledTimes(3);
    });

    test('should execute multiple timers in correct order', () => {
      const results: string[] = [];
      
      mockTimer.setTimeout(() => results.push('first'), 1000);
      mockTimer.setTimeout(() => results.push('second'), 500);
      mockTimer.setTimeout(() => results.push('third'), 1500);
      
      mockTimer.advanceTime(2000);
      
      expect(results).toEqual(['second', 'first', 'third']);
    });

    test('should handle overlapping timers correctly', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();
      
      mockTimer.setTimeout(callback1, 1000);
      mockTimer.setTimeout(callback2, 1000);
      
      // Advance time to exactly when both timers should fire
      mockTimer.advanceTime(1000);
      
      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);
    });
  });

  describe('Time Tracking', () => {
    test('should track current time correctly', () => {
      expect(mockTimer.getCurrentTime()).toBe(0);
      
      mockTimer.advanceTime(5000);
      expect(mockTimer.getCurrentTime()).toBe(5000);
      
      mockTimer.advanceTime(3000);
      expect(mockTimer.getCurrentTime()).toBe(8000);
    });

    test('should track pending timer count', () => {
      expect(mockTimer.getPendingCount()).toBe(0);
      
      mockTimer.setTimeout(() => {}, 1000);
      expect(mockTimer.getPendingCount()).toBe(1);
      
      mockTimer.setTimeout(() => {}, 2000);
      expect(mockTimer.getPendingCount()).toBe(2);
      
      mockTimer.advanceTime(1500);
      expect(mockTimer.getPendingCount()).toBe(1);
      
      mockTimer.advanceTime(1000);
      expect(mockTimer.getPendingCount()).toBe(0);
    });
  });

  describe('Reset and Cleanup', () => {
    test('should clear all timers', () => {
      mockTimer.setTimeout(() => {}, 1000);
      mockTimer.setInterval(() => {}, 500);
      
      expect(mockTimer.getPendingCount()).toBe(2);
      
      mockTimer.clearAll();
      expect(mockTimer.getPendingCount()).toBe(0);
    });

    test('should reset to initial state', () => {
      mockTimer.setTimeout(() => {}, 1000);
      mockTimer.advanceTime(5000);
      
      expect(mockTimer.getCurrentTime()).toBe(5000);
      expect(mockTimer.getPendingCount()).toBe(0);
      
      mockTimer.reset();
      
      expect(mockTimer.getCurrentTime()).toBe(0);
      expect(mockTimer.getPendingCount()).toBe(0);
    });
  });
});

describe('Timer Test Helpers', () => {
  beforeEach(() => {
    jest.useRealTimers();
  });

  afterEach(() => {
    // Comprehensive cleanup to prevent worker process issues
    jest.clearAllTimers();
    jest.useRealTimers();
    TimerTestUtils.cleanupTimers();
  });

  test('should provide convenient helper functions', () => {
    expect(timerTestHelpers).toHaveProperty('setup');
    expect(timerTestHelpers).toHaveProperty('cleanup');
    expect(timerTestHelpers).toHaveProperty('advance');
    expect(timerTestHelpers).toHaveProperty('wait');
    expect(timerTestHelpers).toHaveProperty('sync');
    expect(timerTestHelpers).toHaveProperty('mockProcess');
    expect(timerTestHelpers).toHaveProperty('testHeartbeat');
    expect(timerTestHelpers).toHaveProperty('testTimeouts');
    expect(timerTestHelpers).toHaveProperty('testLifecycle');
    expect(timerTestHelpers).toHaveProperty('testResources');
    expect(timerTestHelpers).toHaveProperty('coordAsync');
    expect(timerTestHelpers).toHaveProperty('testTimeout');
    expect(timerTestHelpers).toHaveProperty('batch');
    expect(timerTestHelpers).toHaveProperty('diagnose');
    expect(timerTestHelpers).toHaveProperty('withReal');
  });

  test('should work as aliases for TimerTestUtils methods', async () => {
    timerTestHelpers.setup();
    expect(TimerTestUtils.isFakeTimersEnabled()).toBe(true);
    
    const callback = jest.fn();
    setTimeout(callback, 1000);
    
    await timerTestHelpers.advance(1500);
    expect(callback).toHaveBeenCalledTimes(1);
    
    timerTestHelpers.cleanup();
    expect(TimerTestUtils.isFakeTimersEnabled()).toBe(false);
  });

  test('should create mock process through helper', () => {
    const mockProcess = timerTestHelpers.mockProcess({ pid: 54321 });
    
    expect(mockProcess.pid).toBe(54321);
    expect(mockProcess).toHaveProperty('stdout');
    expect(mockProcess).toHaveProperty('stderr');
    expect(mockProcess).toHaveProperty('kill');
  });

  test('should provide diagnostics through helper', () => {
    const diagnostics = timerTestHelpers.diagnose();
    
    expect(diagnostics).toHaveProperty('fakeTimersEnabled');
    expect(diagnostics).toHaveProperty('pendingTimers');
    expect(diagnostics).toHaveProperty('currentTime');
  });
});