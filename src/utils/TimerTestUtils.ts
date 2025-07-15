/**
 * Timer Test Utilities Library
 *
 * Comprehensive utility library for testing timer-based and event-driven code.
 * Provides standardized patterns for Jest fake timers, event loop coordination,
 * and deterministic async testing.
 *
 * @category Testing Utilities
 * @since 1.0.0
 */

import { EventEmitter } from 'events';

/**
 * Mock process type for testing
 */
export interface MockProcessType extends EventEmitter {
  stdout: EventEmitter;
  stderr: EventEmitter;
  kill: jest.Mock;
  pid: number;
  killed: boolean;
  exitCode: number | null;
  stdin?: EventEmitter & {
    write: jest.Mock;
    end: jest.Mock;
  };
}

/**
 * Configuration options for timer testing setup
 */
export interface TimerTestConfig {
  /** Whether to use fake timers (default: true) */
  useFakeTimers?: boolean;
  /** Fixed start time for deterministic testing */
  fixedStartTime?: Date;
  /** List of timer methods to not fake */
  doNotFake?: string[] | undefined;
  /** Whether to advance timers automatically */
  autoAdvance?: boolean;
  /** Default timeout for test operations */
  defaultTimeout?: number;
}

/**
 * Options for timer advancement operations
 */
export interface TimerAdvancementOptions {
  /** Time in milliseconds to advance */
  timeMs: number;
  /** Whether to wait for event loop after advancement */
  waitForEvents?: boolean;
  /** Whether to run pending timers after advancement */
  runPendingTimers?: boolean;
  /** Number of event loop ticks to wait */
  eventLoopTicks?: number;
}

/**
 * Mock process configuration for testing
 */
export interface MockProcessConfig {
  /** Process ID (default: random) */
  pid?: number;
  /** Whether process is killed (default: false) */
  killed?: boolean;
  /** Process exit code (default: null) */
  exitCode?: number | null;
  /** Whether to include stdin */
  includeStdin?: boolean;
}

/**
 * Timer test event configuration
 */
export interface TimerEventConfig {
  /** Event name to emit */
  eventName: string;
  /** Event data to emit */
  eventData?: unknown;
  /** Delay before emitting event (in fake timer time) */
  delay?: number;
  /** Target event emitter */
  emitter: EventEmitter;
}

/**
 * Timed operation for batch testing
 */
export interface TimedOperation {
  description: string;
  timeAdvancement: number;
  assertion: () => void;
}

/**
 * Comprehensive timer testing utility library
 */
export class TimerTestUtils {
  private static defaultConfig: TimerTestConfig = {
    useFakeTimers: true,
    fixedStartTime: new Date('2025-01-01T00:00:00.000Z'),
    doNotFake: ['nextTick'],
    autoAdvance: false,
    defaultTimeout: 30000,
  };

  private static fakeTimersEnabled = false;

  /**
   * Check if fake timers are currently enabled
   */
  static isFakeTimersEnabled(): boolean {
    return this.fakeTimersEnabled;
  }

  /**
   * Configure Jest fake timers with recommended settings
   */
  static setupFakeTimers(config: TimerTestConfig = {}): void {
    const finalConfig = { ...this.defaultConfig, ...config };

    if (finalConfig.useFakeTimers) {
      interface JestTimerConfig {
        now?: Date;
        advanceTimers?: boolean;
        doNotFake?: string[];
      }

      const timerConfig: JestTimerConfig = {};

      if (finalConfig.fixedStartTime !== undefined) {
        timerConfig.now = finalConfig.fixedStartTime;
      }

      if (finalConfig.autoAdvance !== undefined) {
        timerConfig.advanceTimers = finalConfig.autoAdvance;
      }

      if (finalConfig.doNotFake) {
        timerConfig.doNotFake = finalConfig.doNotFake;
      }

      jest.useFakeTimers(timerConfig as Parameters<typeof jest.useFakeTimers>[0]);
      this.fakeTimersEnabled = true;
    } else {
      // Ensure the flag is false if we're not using fake timers
      this.fakeTimersEnabled = false;
    }
  }

  /**
   * Clean up fake timers and restore real timers
   */
  static cleanupTimers(): void {
    jest.useRealTimers();
    jest.clearAllTimers();
    this.fakeTimersEnabled = false;
  }

  /**
   * Advance timers and coordinate with event loop
   */
  static async advanceTimersAndFlush(
    timeMs: number,
    options: Partial<TimerAdvancementOptions> = {}
  ): Promise<void> {
    const opts: TimerAdvancementOptions = {
      timeMs,
      waitForEvents: true,
      runPendingTimers: true,
      eventLoopTicks: 1,
      ...options,
    };

    // Advance the timers
    jest.advanceTimersByTime(opts.timeMs);

    // Wait for event loop if requested
    if (opts.waitForEvents) {
      await this.waitForEvents(opts.eventLoopTicks);
    }

    // Run pending timers if requested
    if (opts.runPendingTimers) {
      jest.runOnlyPendingTimers();
    }
  }

  /**
   * Wait for event loop to process microtasks
   */
  static async waitForEvents(ticks: number = 1): Promise<void> {
    for (let i = 0; i < ticks; i++) {
      await Promise.resolve();
    }
  }

  /**
   * Synchronize timer events with proper coordination
   */
  static async syncTimerEvents(
    timerAdvancement: number,
    eventConfigs: TimerEventConfig[] = []
  ): Promise<void> {
    // Schedule events if provided
    for (const config of eventConfigs) {
      if (config.delay && config.delay > 0) {
        setTimeout(() => {
          config.emitter.emit(config.eventName, config.eventData);
        }, config.delay);
      } else {
        // Emit immediately after next tick
        setImmediate(() => {
          config.emitter.emit(config.eventName, config.eventData);
        });
      }
    }

    // Allow setup to complete
    await this.waitForEvents();

    // Advance timers and process events
    await this.advanceTimersAndFlush(timerAdvancement);
  }

  /**
   * Create a mock process for testing
   */
  static createMockProcess(config: MockProcessConfig = {}): MockProcessType {
    const mockProcess = new EventEmitter() as MockProcessType;

    // Set up standard process properties
    mockProcess.stdout = new EventEmitter();
    mockProcess.stderr = new EventEmitter();
    mockProcess.kill = jest.fn();
    mockProcess.pid = config.pid ?? Math.floor(Math.random() * 100000) + 1000;
    mockProcess.killed = config.killed ?? false;
    mockProcess.exitCode = config.exitCode ?? null;

    // Add stdin if requested
    if (config.includeStdin) {
      const stdin = new EventEmitter() as EventEmitter & {
        write: jest.Mock;
        end: jest.Mock;
      };
      stdin.write = jest.fn();
      stdin.end = jest.fn();
      mockProcess.stdin = stdin;
    }

    // Mock common process methods
    mockProcess.removeAllListeners = jest.fn(
      () => mockProcess
    ) as typeof mockProcess.removeAllListeners;
    mockProcess.setMaxListeners = jest.fn(() => mockProcess) as typeof mockProcess.setMaxListeners;

    return mockProcess;
  }

  /**
   * Test heartbeat monitoring pattern with proper timing
   */
  static async testHeartbeatPattern(
    heartbeatInterval: number,
    heartbeatCallback: () => void,
    iterations: number = 2
  ): Promise<void> {
    for (let i = 0; i < iterations; i++) {
      // Advance to heartbeat interval
      await this.advanceTimersAndFlush(heartbeatInterval);

      // Verify heartbeat was called
      expect(heartbeatCallback).toHaveBeenCalledTimes(i + 1);
    }
  }

  /**
   * Test progressive timeout warnings
   */
  static async testProgressiveTimeouts(
    totalTimeout: number,
    warningThresholds: number[], // e.g., [50, 75, 90] for percentages
    warningCallback: jest.Mock
  ): Promise<void> {
    for (const threshold of warningThresholds) {
      const timeToAdvance = Math.floor((totalTimeout * threshold) / 100);
      await this.advanceTimersAndFlush(timeToAdvance);

      // Check that warning was called with the correct threshold
      expect(warningCallback).toHaveBeenCalledWith(expect.objectContaining({ threshold }));
    }
  }

  /**
   * Test process lifecycle events with proper timing
   */
  static async testProcessLifecycle(
    mockProcess: MockProcessType,
    events: Array<{ event: string; data?: unknown; delay: number }>
  ): Promise<void> {
    for (const eventConfig of events) {
      // Schedule the event
      setTimeout(() => {
        mockProcess.emit(eventConfig.event, eventConfig.data);
      }, eventConfig.delay);
    }

    // Allow events to be scheduled
    await this.waitForEvents();

    // Advance through all event timings
    const maxDelay = Math.max(...events.map((e) => e.delay));
    await this.advanceTimersAndFlush(maxDelay + 100); // Add buffer
  }

  /**
   * Test resource monitoring with interval checking
   */
  static async testResourceMonitoring(
    checkInterval: number,
    resourceCheckCallback: jest.Mock,
    monitoringDuration: number
  ): Promise<void> {
    const expectedChecks = Math.floor(monitoringDuration / checkInterval);

    await this.advanceTimersAndFlush(monitoringDuration);

    // Verify resource checks occurred at expected intervals
    expect(resourceCheckCallback).toHaveBeenCalledTimes(expectedChecks);
  }

  /**
   * Coordinate async operations with timer advancement
   */
  static async coordAsyncOperation<T>(
    operation: () => Promise<T>,
    timerAdvancement: number = 0
  ): Promise<T> {
    // Start the async operation
    const operationPromise = operation();

    // Allow operation setup
    await this.waitForEvents();

    // Advance timers if needed
    if (timerAdvancement > 0) {
      await this.advanceTimersAndFlush(timerAdvancement);
    }

    // Wait for operation completion
    return await operationPromise;
  }

  /**
   * Test timeout scenarios with proper error handling
   */
  static async testTimeoutScenario(
    timeoutMs: number,
    operation: () => Promise<unknown>,
    expectedError?: Error | string
  ): Promise<void> {
    const operationPromise = operation();

    // Allow operation to start
    await this.waitForEvents();

    // Advance past timeout
    await this.advanceTimersAndFlush(timeoutMs + 1000);

    // Verify timeout behavior
    if (expectedError) {
      if (typeof expectedError === 'string') {
        await expect(operationPromise).rejects.toThrow(expectedError);
      } else {
        await expect(operationPromise).rejects.toThrow(expectedError);
      }
    } else {
      await expect(operationPromise).rejects.toThrow();
    }
  }

  /**
   * Batch multiple timer operations with coordination
   */
  static async batchTimerOperations(
    operations: Array<{
      description: string;
      timeAdvancement: number;
      assertion: () => void;
    }>
  ): Promise<void> {
    for (const op of operations) {
      await this.advanceTimersAndFlush(op.timeAdvancement);

      try {
        op.assertion();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed assertion for "${op.description}": ${errorMessage}`);
      }
    }
  }

  /**
   * Set up comprehensive test environment
   */
  static setupTestEnvironment(config: TimerTestConfig = {}): {
    cleanup: () => void;
    advance: (timeMs: number) => Promise<void>;
    createProcess: (cfg?: MockProcessConfig) => MockProcessType;
    waitEvents: (ticks?: number) => Promise<void>;
  } {
    this.setupFakeTimers(config);

    return {
      cleanup: () => this.cleanupTimers(),
      advance: (timeMs: number) => this.advanceTimersAndFlush(timeMs),
      createProcess: (cfg?: MockProcessConfig) => this.createMockProcess(cfg),
      waitEvents: (ticks?: number) => this.waitForEvents(ticks),
    };
  }

  /**
   * Debug timer state and provide diagnostic information
   */
  static getTimerDiagnostics(): {
    fakeTimersEnabled: boolean;
    pendingTimers: number;
    currentTime: number;
  } {
    let pendingTimers = 0;

    if (this.fakeTimersEnabled) {
      try {
        const jestWithTimerCount = jest as unknown as { getTimerCount?: () => number };
        pendingTimers = jestWithTimerCount.getTimerCount?.() ?? 0;
      } catch {
        pendingTimers = 0;
      }
    }

    return {
      fakeTimersEnabled: this.fakeTimersEnabled,
      pendingTimers,
      currentTime: Date.now(),
    };
  }

  /**
   * Execute callback with real timers temporarily
   */
  static async withRealTimers<T>(callback: () => Promise<T>): Promise<T> {
    const wasUsingFake = this.fakeTimersEnabled;

    if (wasUsingFake) {
      jest.useRealTimers();
      this.fakeTimersEnabled = false;
    }

    try {
      return await callback();
    } finally {
      if (wasUsingFake) {
        this.setupFakeTimers();
      }
    }
  }
}

/**
 * Mock Timer Service for dependency injection testing
 */
export class MockTimerService {
  private scheduledCallbacks: Map<
    NodeJS.Timeout,
    {
      callback: () => void;
      delay: number;
      isInterval: boolean;
      scheduled: number;
    }
  > = new Map();

  private currentTime: number = 0;
  private timeoutId: number = 1;

  /**
   * Mock setTimeout implementation
   */
  setTimeout(callback: () => void, delay: number): NodeJS.Timeout {
    const id = this.timeoutId++ as unknown as NodeJS.Timeout;
    this.scheduledCallbacks.set(id, {
      callback,
      delay,
      isInterval: false,
      scheduled: this.currentTime,
    });
    return id;
  }

  /**
   * Mock setInterval implementation
   */
  setInterval(callback: () => void, delay: number): NodeJS.Timeout {
    const id = this.timeoutId++ as unknown as NodeJS.Timeout;
    this.scheduledCallbacks.set(id, {
      callback,
      delay,
      isInterval: true,
      scheduled: this.currentTime,
    });
    return id;
  }

  /**
   * Mock clearTimeout/clearInterval implementation
   */
  clearTimeout(id: NodeJS.Timeout): void {
    this.scheduledCallbacks.delete(id);
  }

  clearInterval(id: NodeJS.Timeout): void {
    this.clearTimeout(id);
  }

  /**
   * Advance mock time and execute callbacks
   */
  advanceTime(ms: number): void {
    const targetTime = this.currentTime + ms;

    while (this.currentTime < targetTime) {
      const nextExecuteTime = this.findNextExecuteTime();

      if (nextExecuteTime === null || nextExecuteTime > targetTime) {
        this.currentTime = targetTime;
        break;
      }

      this.currentTime = nextExecuteTime;

      // Execute all callbacks scheduled for this time
      const callbacksToExecute = this.getCallbacksForTime(nextExecuteTime);

      for (const callbackInfo of callbacksToExecute) {
        callbackInfo.callback();

        // Reschedule if it's an interval
        if (callbackInfo.isInterval) {
          this.scheduledCallbacks.set(callbackInfo.id, {
            ...callbackInfo.config,
            scheduled: this.currentTime,
          });
        } else {
          this.scheduledCallbacks.delete(callbackInfo.id);
        }
      }
    }
  }

  /**
   * Get current mock time
   */
  getCurrentTime(): number {
    return this.currentTime;
  }

  /**
   * Get number of pending timers
   */
  getPendingCount(): number {
    return this.scheduledCallbacks.size;
  }

  /**
   * Clear all timers
   */
  clearAll(): void {
    this.scheduledCallbacks.clear();
  }

  /**
   * Reset timer service to initial state
   */
  reset(): void {
    this.clearAll();
    this.currentTime = 0;
    this.timeoutId = 1;
  }

  private findNextExecuteTime(): number | null {
    let earliestTime = Infinity;

    for (const [, config] of this.scheduledCallbacks) {
      const executeTime = config.scheduled + config.delay;
      if (executeTime < earliestTime) {
        earliestTime = executeTime;
      }
    }

    return earliestTime === Infinity ? null : earliestTime;
  }

  private getCallbacksForTime(executeTime: number): Array<{
    id: NodeJS.Timeout;
    callback: () => void;
    isInterval: boolean;
    config: {
      callback: () => void;
      delay: number;
      isInterval: boolean;
      scheduled: number;
    };
  }> {
    const callbacks: Array<{
      id: NodeJS.Timeout;
      callback: () => void;
      isInterval: boolean;
      config: {
        callback: () => void;
        delay: number;
        isInterval: boolean;
        scheduled: number;
      };
    }> = [];

    for (const [id, config] of this.scheduledCallbacks) {
      const callbackExecuteTime = config.scheduled + config.delay;
      if (callbackExecuteTime === executeTime) {
        callbacks.push({
          id,
          callback: config.callback,
          isInterval: config.isInterval,
          config,
        });
      }
    }

    return callbacks;
  }
}

/**
 * Export convenience functions for common patterns
 */
export const timerTestHelpers = {
  setup: (config?: TimerTestConfig): void => TimerTestUtils.setupFakeTimers(config),
  cleanup: (): void => TimerTestUtils.cleanupTimers(),
  advance: (timeMs: number, options?: Partial<TimerAdvancementOptions>): Promise<void> =>
    TimerTestUtils.advanceTimersAndFlush(timeMs, options),
  wait: (ticks?: number): Promise<void> => TimerTestUtils.waitForEvents(ticks),
  sync: (timerAdvancement: number, eventConfigs?: TimerEventConfig[]): Promise<void> =>
    TimerTestUtils.syncTimerEvents(timerAdvancement, eventConfigs),
  mockProcess: (config?: MockProcessConfig): MockProcessType =>
    TimerTestUtils.createMockProcess(config),
  testHeartbeat: (
    heartbeatInterval: number,
    heartbeatCallback: jest.Mock,
    iterations?: number
  ): Promise<void> =>
    TimerTestUtils.testHeartbeatPattern(heartbeatInterval, heartbeatCallback, iterations),
  testTimeouts: (
    totalTimeout: number,
    warningThresholds: number[],
    warningCallback: jest.Mock
  ): Promise<void> =>
    TimerTestUtils.testProgressiveTimeouts(totalTimeout, warningThresholds, warningCallback),
  testLifecycle: (
    mockProcess: MockProcessType,
    events: Array<{ event: string; data?: unknown; delay: number }>
  ): Promise<void> => TimerTestUtils.testProcessLifecycle(mockProcess, events),
  testResources: (
    checkInterval: number,
    resourceCheckCallback: jest.Mock,
    monitoringDuration: number
  ): Promise<void> =>
    TimerTestUtils.testResourceMonitoring(checkInterval, resourceCheckCallback, monitoringDuration),
  coordAsync: <T>(operation: () => Promise<T>, timerAdvancement?: number): Promise<T> =>
    TimerTestUtils.coordAsyncOperation(operation, timerAdvancement),
  testTimeout: (
    timeoutMs: number,
    operation: () => Promise<unknown>,
    expectedError?: Error | string
  ): Promise<void> => TimerTestUtils.testTimeoutScenario(timeoutMs, operation, expectedError),
  batch: (
    operations: Array<{ description: string; timeAdvancement: number; assertion: () => void }>
  ): Promise<void> => TimerTestUtils.batchTimerOperations(operations),
  diagnose: (): { fakeTimersEnabled: boolean; pendingTimers: number; currentTime: number } =>
    TimerTestUtils.getTimerDiagnostics(),
  withReal: <T>(fn: () => Promise<T>): Promise<T> => TimerTestUtils.withRealTimers(fn),
};

export default TimerTestUtils;
