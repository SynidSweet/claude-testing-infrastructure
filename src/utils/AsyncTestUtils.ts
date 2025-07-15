/**
 * Async Test Utilities Framework
 *
 * Comprehensive utility library for testing all kinds of async operations including
 * promises, events, streams, and other asynchronous patterns. Provides standardized
 * patterns for reliable async testing with proper timeout management and event coordination.
 *
 * @category Testing Utilities
 * @since 1.0.0
 */

import { EventEmitter } from 'events';
import { Readable, Writable, type Transform } from 'stream';
import { TimerTestUtils } from './TimerTestUtils';

/**
 * Configuration for async test operations
 */
export interface AsyncTestConfig {
  /** Default timeout for async operations (ms) */
  defaultTimeout?: number;
  /** Whether to use fake timers (default: true) */
  useFakeTimers?: boolean;
  /** Number of event loop ticks to wait by default */
  defaultEventLoopTicks?: number;
  /** Whether to enable debug logging */
  debug?: boolean;
}

/**
 * Promise testing utilities configuration
 */
export interface PromiseTestConfig {
  /** Timeout for promise resolution (ms) */
  timeout?: number;
  /** Expected resolution value */
  expectedValue?: unknown;
  /** Expected rejection error pattern */
  expectedError?: string | RegExp | Error;
  /** Whether to advance timers during test */
  advanceTimers?: boolean;
  /** Time to advance timers (ms) */
  timerAdvancement?: number;
}

/**
 * Event sequence validation configuration
 */
export interface EventSequenceConfig {
  /** Events to expect in sequence */
  expectedEvents: Array<{
    /** Event name */
    name: string;
    /** Expected event data (optional) */
    data?: unknown;
    /** Timeout for this event (ms) */
    timeout?: number;
  }>;
  /** Whether events must occur in exact order */
  strictOrder?: boolean;
  /** Overall timeout for entire sequence (ms) */
  sequenceTimeout?: number;
}

/**
 * Stream testing configuration
 */
export interface StreamTestConfig {
  /** Expected data chunks */
  expectedChunks?: unknown[];
  /** Whether to expect stream to end */
  expectEnd?: boolean;
  /** Whether to expect stream to error */
  expectError?: boolean;
  /** Expected error pattern */
  expectedErrorPattern?: string | RegExp | Error;
  /** Timeout for stream operations (ms) */
  timeout?: number;
  /** Encoding for string streams */
  encoding?: BufferEncoding;
}

/**
 * Async operation result tracking
 */
export interface AsyncOperationResult<T = unknown> {
  /** Whether operation completed successfully */
  success: boolean;
  /** Result value if successful */
  value?: T;
  /** Error if failed */
  error?: Error;
  /** Duration of operation (ms) */
  duration: number;
  /** Whether operation timed out */
  timedOut: boolean;
}

/**
 * Event sequence validation result
 */
export interface EventSequenceResult {
  /** Whether sequence completed successfully */
  success: boolean;
  /** Events that were received */
  receivedEvents: Array<{
    name: string;
    data: unknown;
    timestamp: number;
  }>;
  /** Events that were expected but not received */
  missingEvents: string[];
  /** Events that were received but not expected */
  unexpectedEvents: string[];
  /** Total duration of sequence (ms) */
  duration: number;
}

/**
 * Comprehensive async testing utility framework
 */
export class AsyncTestUtils {
  private static defaultConfig: AsyncTestConfig = {
    defaultTimeout: 5000,
    useFakeTimers: true,
    defaultEventLoopTicks: 3,
    debug: false,
  };

  /**
   * Set up async testing environment
   */
  static setupAsyncTesting(config: AsyncTestConfig = {}): {
    cleanup: () => void;
    advance: (timeMs: number) => Promise<void>;
    waitEvents: (ticks?: number) => Promise<void>;
  } {
    const finalConfig = { ...this.defaultConfig, ...config };

    if (finalConfig.useFakeTimers) {
      TimerTestUtils.setupFakeTimers();
    }

    return {
      cleanup: (): void => {
        if (finalConfig.useFakeTimers) {
          TimerTestUtils.cleanupTimers();
        }
      },
      advance: (timeMs: number) => TimerTestUtils.advanceTimersAndFlush(timeMs),
      waitEvents: (ticks?: number) =>
        TimerTestUtils.waitForEvents(ticks ?? finalConfig.defaultEventLoopTicks),
    };
  }

  /**
   * Test promise resolution with proper async coordination
   */
  static async testPromiseResolution<T>(
    promiseFactory: () => Promise<T>,
    config: PromiseTestConfig = {}
  ): Promise<AsyncOperationResult<T>> {
    const startTime = Date.now();
    const timeout = config.timeout ?? this.defaultConfig.defaultTimeout!;

    try {
      // Create promise
      const promise = promiseFactory();

      // Set up timeout if needed
      let timeoutId: NodeJS.Timeout | undefined;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(`Promise timed out after ${timeout}ms`));
        }, timeout);
      });

      // Advance timers if requested
      if (config.advanceTimers && config.timerAdvancement) {
        setTimeout(() => {
          void TimerTestUtils.advanceTimersAndFlush(config.timerAdvancement!);
        }, 0);
      }

      // Wait for promise or timeout
      const result = await Promise.race([promise, timeoutPromise]);

      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      // Validate result if expected value provided
      if (config.expectedValue !== undefined) {
        expect(result).toEqual(config.expectedValue);
      }

      return {
        success: true,
        value: result,
        duration: Date.now() - startTime,
        timedOut: false,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      const timedOut = err.message.includes('timed out');

      // Validate error if expected
      if (config.expectedError) {
        if (typeof config.expectedError === 'string') {
          expect(err.message).toContain(config.expectedError);
        } else if (config.expectedError instanceof RegExp) {
          expect(err.message).toMatch(config.expectedError);
        } else {
          expect(err).toEqual(config.expectedError);
        }
      }

      return {
        success: false,
        error: err,
        duration: Date.now() - startTime,
        timedOut,
      };
    }
  }

  /**
   * Test promise rejection with proper error handling
   */
  static async testPromiseRejection(
    promiseFactory: () => Promise<unknown>,
    expectedError: string | RegExp | Error,
    config: PromiseTestConfig = {}
  ): Promise<AsyncOperationResult> {
    const testConfig: PromiseTestConfig = {
      ...config,
      expectedError,
      timeout: config.timeout ?? this.defaultConfig.defaultTimeout!,
    };

    const result = await this.testPromiseResolution(promiseFactory, testConfig);

    // For rejection tests, success means we got the expected error
    if (!result.success && result.error) {
      return {
        ...result,
        success: true, // We successfully caught the expected error
        value: result.error,
      };
    }

    return {
      ...result,
      success: false,
      error: new Error('Promise was expected to reject but resolved instead'),
    };
  }

  /**
   * Test promise chain with multiple async operations
   */
  static async testPromiseChain<T>(
    operations: Array<{
      name: string;
      operation: (previousResult?: unknown) => Promise<T>;
      expectedResult?: unknown;
      timeout?: number;
    }>,
    config: PromiseTestConfig = {}
  ): Promise<{
    success: boolean;
    results: Array<{ name: string; result: AsyncOperationResult<T> }>;
    overallDuration: number;
  }> {
    const startTime = Date.now();
    const results: Array<{ name: string; result: AsyncOperationResult<T> }> = [];
    let previousResult: unknown;
    let overallSuccess = true;

    for (const op of operations) {
      const opConfig: PromiseTestConfig = {
        ...config,
        timeout: op.timeout ?? config.timeout ?? this.defaultConfig.defaultTimeout!,
        expectedValue: op.expectedResult,
      };

      const result = await this.testPromiseResolution(() => op.operation(previousResult), opConfig);

      results.push({ name: op.name, result });

      if (!result.success) {
        overallSuccess = false;
        break;
      }

      previousResult = result.value;
    }

    return {
      success: overallSuccess,
      results,
      overallDuration: Date.now() - startTime,
    };
  }

  /**
   * Validate event sequence with proper timing
   */
  static async validateEventSequence(
    emitter: EventEmitter,
    config: EventSequenceConfig
  ): Promise<EventSequenceResult> {
    const startTime = Date.now();
    const receivedEvents: Array<{ name: string; data: unknown; timestamp: number }> = [];
    const expectedEventNames = config.expectedEvents.map((e) => e.name);
    let currentEventIndex = 0;

    return new Promise<EventSequenceResult>((resolve) => {
      const timeout = config.sequenceTimeout ?? this.defaultConfig.defaultTimeout!;

      // Set up overall sequence timeout
      const sequenceTimeout = setTimeout(() => {
        cleanup();
        resolve(createResult(false));
      }, timeout);

      // Set up event listeners
      const listeners = new Map<string, (...args: unknown[]) => void>();

      for (const expectedEvent of config.expectedEvents) {
        const listener = (...args: unknown[]): void => {
          const timestamp = Date.now();
          const eventData = args.length === 1 ? args[0] : args;

          receivedEvents.push({
            name: expectedEvent.name,
            data: eventData,
            timestamp,
          });

          // Check if this is the expected next event (for strict order)
          if (config.strictOrder) {
            const expectedNext = config.expectedEvents[currentEventIndex];
            if (expectedNext && expectedNext.name === expectedEvent.name) {
              currentEventIndex++;

              // Check if we've received all events
              if (currentEventIndex >= config.expectedEvents.length) {
                cleanup();
                resolve(createResult(true));
              }
            }
          } else {
            // For non-strict order, check if we've received all expected events
            const receivedEventNames = receivedEvents.map((e) => e.name);
            const hasAllEvents = expectedEventNames.every((name) =>
              receivedEventNames.includes(name)
            );

            if (hasAllEvents) {
              cleanup();
              resolve(createResult(true));
            }
          }
        };

        listeners.set(expectedEvent.name, listener);
        emitter.on(expectedEvent.name, listener);
      }

      function cleanup(): void {
        clearTimeout(sequenceTimeout);
        for (const [eventName, listener] of listeners) {
          emitter.removeListener(eventName, listener);
        }
      }

      function createResult(success: boolean): EventSequenceResult {
        const receivedEventNames = receivedEvents.map((e) => e.name);
        const missingEvents = expectedEventNames.filter(
          (name) => !receivedEventNames.includes(name)
        );
        const unexpectedEvents = receivedEventNames.filter(
          (name) => !expectedEventNames.includes(name)
        );

        return {
          success,
          receivedEvents,
          missingEvents,
          unexpectedEvents,
          duration: Date.now() - startTime,
        };
      }
    });
  }

  /**
   * Test stream operations with timeout and validation
   */
  static async testStreamOperation(
    stream: Readable | Writable | Transform,
    config: StreamTestConfig = {}
  ): Promise<{
    success: boolean;
    chunks: unknown[];
    error?: Error;
    duration: number;
    endReceived: boolean;
  }> {
    const startTime = Date.now();
    const chunks: unknown[] = [];
    let endReceived = false;
    let errorReceived: Error | undefined;

    return new Promise((resolve) => {
      const timeout = config.timeout ?? this.defaultConfig.defaultTimeout!;

      // Set up timeout
      const timeoutId = setTimeout(() => {
        cleanup();
        resolve({
          success: false,
          chunks,
          error: new Error(`Stream operation timed out after ${timeout}ms`),
          duration: Date.now() - startTime,
          endReceived,
        });
      }, timeout);

      // Set up stream listeners
      const onData = (chunk: unknown): void => {
        if (config.encoding && typeof chunk === 'string') {
          chunks.push(chunk);
        } else if (Buffer.isBuffer(chunk) && config.encoding) {
          chunks.push(chunk.toString(config.encoding));
        } else {
          chunks.push(chunk);
        }
      };

      const onEnd = (): void => {
        endReceived = true;
        cleanup();

        // Validate results
        const success = validateStreamResults();
        resolve({
          success,
          chunks,
          ...(errorReceived ? { error: errorReceived } : {}),
          duration: Date.now() - startTime,
          endReceived,
        });
      };

      const onError = (error: Error): void => {
        errorReceived = error;
        cleanup();

        // If we expected an error, this might be success
        const success = Boolean(
          config.expectError &&
            (!config.expectedErrorPattern ||
              matchesErrorPattern(error, config.expectedErrorPattern))
        );

        resolve({
          success,
          chunks,
          error,
          duration: Date.now() - startTime,
          endReceived,
        });
      };

      // Attach listeners
      if (stream instanceof Readable) {
        stream.on('data', onData);
        stream.on('end', onEnd);
        stream.on('error', onError);
      } else if (stream instanceof Writable) {
        stream.on('finish', onEnd);
        stream.on('error', onError);
      }

      function cleanup(): void {
        clearTimeout(timeoutId);
        stream.removeListener('data', onData);
        stream.removeListener('end', onEnd);
        stream.removeListener('finish', onEnd);
        stream.removeListener('error', onError);
      }

      function validateStreamResults(): boolean {
        // Check expected chunks
        if (config.expectedChunks) {
          try {
            expect(chunks).toEqual(config.expectedChunks);
          } catch {
            return false;
          }
        }

        // Check end expectation
        if (config.expectEnd !== undefined && config.expectEnd !== endReceived) {
          return false;
        }

        // Check error expectation
        if (config.expectError && !errorReceived) {
          return false;
        }

        if (!config.expectError && errorReceived) {
          return false;
        }

        return true;
      }
    });
  }

  /**
   * Test async operation with timeout management
   */
  static async testAsyncTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number,
    expectedTimeoutError?: string | RegExp
  ): Promise<AsyncOperationResult<T>> {
    const startTime = Date.now();

    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Operation timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      });

      const result = await Promise.race([operation(), timeoutPromise]);

      return {
        success: true,
        value: result,
        duration: Date.now() - startTime,
        timedOut: false,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      const timedOut = err.message.includes('timed out');

      // Validate timeout error if expected
      if (timedOut && expectedTimeoutError) {
        if (typeof expectedTimeoutError === 'string') {
          expect(err.message).toContain(expectedTimeoutError);
        } else {
          expect(err.message).toMatch(expectedTimeoutError);
        }
      }

      return {
        success: false,
        error: err,
        duration: Date.now() - startTime,
        timedOut,
      };
    }
  }

  /**
   * Coordinate multiple async operations with dependency management
   */
  static async coordinateAsyncOperations<T>(
    operations: Array<{
      name: string;
      operation: () => Promise<T>;
      dependencies?: string[];
      timeout?: number;
    }>
  ): Promise<{
    success: boolean;
    results: Map<string, AsyncOperationResult<T>>;
    executionOrder: string[];
    totalDuration: number;
  }> {
    const startTime = Date.now();
    const results = new Map<string, AsyncOperationResult<T>>();
    const executionOrder: string[] = [];
    const completed = new Set<string>();

    // Build dependency graph
    const dependencyMap = new Map<string, string[]>();
    const reverseDependencyMap = new Map<string, string[]>();

    for (const op of operations) {
      dependencyMap.set(op.name, op.dependencies ?? []);

      for (const dep of op.dependencies ?? []) {
        const dependents = reverseDependencyMap.get(dep) ?? [];
        dependents.push(op.name);
        reverseDependencyMap.set(dep, dependents);
      }
    }

    // Execute operations in dependency order
    while (completed.size < operations.length) {
      const readyOperations = operations.filter(
        (op) =>
          !completed.has(op.name) && (op.dependencies ?? []).every((dep) => completed.has(dep))
      );

      if (readyOperations.length === 0) {
        // Circular dependency or other issue
        break;
      }

      // Execute ready operations in parallel
      const promises = readyOperations.map(async (op) => {
        const result = await this.testPromiseResolution(op.operation, {
          timeout: op.timeout ?? this.defaultConfig.defaultTimeout!,
        });

        results.set(op.name, result);
        executionOrder.push(op.name);
        completed.add(op.name);

        return { name: op.name, result };
      });

      await Promise.all(promises);
    }

    const overallSuccess = Array.from(results.values()).every((r) => r.success);

    return {
      success: overallSuccess,
      results,
      executionOrder,
      totalDuration: Date.now() - startTime,
    };
  }

  /**
   * Create a mock event emitter for testing
   */
  static createMockEventEmitter(): EventEmitter & {
    emitAfterDelay: (event: string, data: unknown, delay: number) => void;
    emitSequence: (events: Array<{ name: string; data: unknown; delay: number }>) => void;
  } {
    const emitter = new EventEmitter();

    return Object.assign(emitter, {
      emitAfterDelay(event: string, data: unknown, delay: number) {
        setTimeout(() => {
          emitter.emit(event, data);
        }, delay);
      },

      emitSequence(events: Array<{ name: string; data: unknown; delay: number }>) {
        let currentDelay = 0;
        for (const event of events) {
          currentDelay += event.delay;
          setTimeout(() => {
            emitter.emit(event.name, event.data);
          }, currentDelay);
        }
      },
    });
  }

  /**
   * Wait for specific event with timeout
   */
  static waitForEvent(
    emitter: EventEmitter,
    eventName: string,
    timeout: number = this.defaultConfig.defaultTimeout!
  ): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        emitter.removeListener(eventName, onEvent);
        reject(new Error(`Event '${eventName}' not received within ${timeout}ms`));
      }, timeout);

      const onEvent = (data: unknown): void => {
        clearTimeout(timeoutId);
        emitter.removeListener(eventName, onEvent);
        resolve(data);
      };

      emitter.once(eventName, onEvent);
    });
  }
}

/**
 * Helper function to match error patterns
 */
function matchesErrorPattern(error: Error, pattern: string | RegExp | Error): boolean {
  if (typeof pattern === 'string') {
    return error.message.includes(pattern);
  } else if (pattern instanceof RegExp) {
    return pattern.test(error.message);
  } else {
    return error.message === pattern.message && error.constructor === pattern.constructor;
  }
}

/**
 * Export convenience functions for common async testing patterns
 */
export const asyncTestHelpers = {
  setup: (config?: AsyncTestConfig): { cleanup: () => void } =>
    AsyncTestUtils.setupAsyncTesting(config),
  testPromise: <T>(
    factory: () => Promise<T>,
    config?: PromiseTestConfig
  ): Promise<AsyncOperationResult<T>> => AsyncTestUtils.testPromiseResolution(factory, config),
  testRejection: (
    factory: () => Promise<unknown>,
    expectedError: string | RegExp | Error,
    config?: PromiseTestConfig
  ): Promise<AsyncOperationResult<unknown>> =>
    AsyncTestUtils.testPromiseRejection(factory, expectedError, config),
  testChain: <T>(
    operations: Array<{
      name: string;
      operation: (previousResult?: unknown) => Promise<T>;
      expectedResult?: unknown;
      timeout?: number;
    }>,
    config?: PromiseTestConfig
  ): Promise<{
    success: boolean;
    results: Array<{ name: string; result: AsyncOperationResult<T> }>;
    overallDuration: number;
  }> => AsyncTestUtils.testPromiseChain(operations, config),
  validateEvents: (
    emitter: EventEmitter,
    config: EventSequenceConfig
  ): Promise<EventSequenceResult> => AsyncTestUtils.validateEventSequence(emitter, config),
  testStream: (
    stream: Readable | Writable | Transform,
    config?: StreamTestConfig
  ): Promise<{
    success: boolean;
    chunks: unknown[];
    error?: Error;
    duration: number;
    endReceived: boolean;
  }> => AsyncTestUtils.testStreamOperation(stream, config),
  testTimeout: <T>(
    operation: () => Promise<T>,
    timeoutMs: number,
    expectedTimeoutError?: string | RegExp
  ): Promise<AsyncOperationResult<T>> =>
    AsyncTestUtils.testAsyncTimeout(operation, timeoutMs, expectedTimeoutError),
  coordinate: <T>(
    operations: Array<{
      name: string;
      operation: () => Promise<T>;
      dependencies?: string[];
      timeout?: number;
    }>
  ): Promise<{
    success: boolean;
    results: Map<string, AsyncOperationResult<T>>;
    executionOrder: string[];
    totalDuration: number;
  }> => AsyncTestUtils.coordinateAsyncOperations(operations),
  mockEmitter: (): EventEmitter => AsyncTestUtils.createMockEventEmitter(),
  waitFor: (emitter: EventEmitter, eventName: string, timeout?: number): Promise<unknown> =>
    AsyncTestUtils.waitForEvent(emitter, eventName, timeout),
};

export default AsyncTestUtils;
