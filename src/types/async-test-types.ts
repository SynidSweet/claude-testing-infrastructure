/**
 * Async Test Utilities Types
 *
 * Type definitions for the async test utilities framework that provides comprehensive
 * testing support for promises, events, streams, and other asynchronous operations.
 *
 * @category Async Test Types
 * @since 1.0.0
 */

import type { EventEmitter } from 'events';
import type { Readable, Writable, Transform } from 'stream';

/**
 * Base configuration for async test operations
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
 * Configuration for promise testing utilities
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
 * Expected event definition for sequence validation
 */
export interface ExpectedEvent {
  /** Event name */
  name: string;
  /** Expected event data (optional) */
  data?: unknown;
  /** Timeout for this specific event (ms) */
  timeout?: number;
  /** Whether this event is optional */
  optional?: boolean;
}

/**
 * Event sequence validation configuration
 */
export interface EventSequenceConfig {
  /** Events to expect in sequence */
  expectedEvents: ExpectedEvent[];
  /** Whether events must occur in exact order */
  strictOrder?: boolean;
  /** Overall timeout for entire sequence (ms) */
  sequenceTimeout?: number;
  /** Whether to allow unexpected events */
  allowUnexpectedEvents?: boolean;
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
  /** Whether to collect all chunks */
  collectChunks?: boolean;
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
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Received event information
 */
export interface ReceivedEvent {
  /** Event name */
  name: string;
  /** Event data */
  data: unknown;
  /** Timestamp when event was received */
  timestamp: number;
  /** Index in the sequence */
  index: number;
}

/**
 * Event sequence validation result
 */
export interface EventSequenceResult {
  /** Whether sequence completed successfully */
  success: boolean;
  /** Events that were received */
  receivedEvents: ReceivedEvent[];
  /** Events that were expected but not received */
  missingEvents: string[];
  /** Events that were received but not expected */
  unexpectedEvents: string[];
  /** Total duration of sequence (ms) */
  duration: number;
  /** Sequence completion percentage */
  completionPercentage: number;
}

/**
 * Stream operation result
 */
export interface StreamOperationResult {
  /** Whether operation completed successfully */
  success: boolean;
  /** Data chunks received */
  chunks: unknown[];
  /** Error if any occurred */
  error?: Error;
  /** Duration of operation (ms) */
  duration: number;
  /** Whether end event was received */
  endReceived: boolean;
  /** Whether error event was received */
  errorReceived: boolean;
  /** Total bytes processed (if applicable) */
  bytesProcessed?: number;
}

/**
 * Promise chain operation definition
 */
export interface PromiseChainOperation<T = unknown> {
  /** Operation name for identification */
  name: string;
  /** The async operation to perform */
  operation: (previousResult?: unknown) => Promise<T>;
  /** Expected result for validation */
  expectedResult?: unknown;
  /** Timeout for this specific operation (ms) */
  timeout?: number;
  /** Whether this operation is optional */
  optional?: boolean;
  /** Dependencies on previous operations */
  dependencies?: string[];
}

/**
 * Promise chain test result
 */
export interface PromiseChainResult<T = unknown> {
  /** Whether entire chain completed successfully */
  success: boolean;
  /** Results from individual operations */
  results: Array<{
    name: string;
    result: AsyncOperationResult<T>;
  }>;
  /** Overall duration of chain (ms) */
  overallDuration: number;
  /** Final result value */
  finalValue?: T;
  /** Operation that caused failure (if any) */
  failedOperation?: string;
}

/**
 * Async operation coordination definition
 */
export interface AsyncOperationDefinition<T = unknown> {
  /** Operation name for identification */
  name: string;
  /** The async operation to perform */
  operation: () => Promise<T>;
  /** Dependencies on other operations */
  dependencies?: string[];
  /** Timeout for this operation (ms) */
  timeout?: number;
  /** Priority for execution ordering */
  priority?: number;
  /** Whether this operation is optional */
  optional?: boolean;
}

/**
 * Async operations coordination result
 */
export interface AsyncCoordinationResult<T = unknown> {
  /** Whether all operations completed successfully */
  success: boolean;
  /** Results mapped by operation name */
  results: Map<string, AsyncOperationResult<T>>;
  /** Order in which operations were executed */
  executionOrder: string[];
  /** Total duration of all operations (ms) */
  totalDuration: number;
  /** Operations that failed */
  failedOperations: string[];
  /** Operations that were skipped due to dependencies */
  skippedOperations: string[];
}

/**
 * Event emitter mock configuration
 */
export interface MockEventEmitterConfig {
  /** Whether to track all events */
  trackEvents?: boolean;
  /** Maximum number of events to track */
  maxTrackedEvents?: number;
  /** Whether to enable automatic event cleanup */
  autoCleanup?: boolean;
}

/**
 * Mock event emission definition
 */
export interface MockEventDefinition {
  /** Event name */
  name: string;
  /** Event data */
  data: unknown;
  /** Delay before emission (ms) */
  delay: number;
  /** Whether to repeat this event */
  repeat?: boolean;
  /** Repeat interval (ms) */
  repeatInterval?: number;
  /** Maximum number of repetitions */
  maxRepetitions?: number;
}

/**
 * Enhanced mock event emitter interface
 */
export interface MockEventEmitter extends EventEmitter {
  /** Emit event after specified delay */
  emitAfterDelay(event: string, data: unknown, delay: number): void;

  /** Emit sequence of events with timing */
  emitSequence(events: MockEventDefinition[]): void;

  /** Get all tracked events */
  getTrackedEvents(): ReceivedEvent[];

  /** Clear tracked events */
  clearTrackedEvents(): void;

  /** Get event emission statistics */
  getEventStats(): Record<string, number>;
}

/**
 * Timeout management configuration
 */
export interface TimeoutConfig {
  /** Timeout duration (ms) */
  duration: number;
  /** Error message for timeout */
  message?: string;
  /** Whether to advance timers during timeout */
  advanceTimers?: boolean;
  /** Timer advancement amount (ms) */
  timerAdvancement?: number;
}

/**
 * Async test environment setup result
 */
export interface AsyncTestEnvironment {
  /** Cleanup function */
  cleanup: () => void;
  /** Advance timers function */
  advance: (timeMs: number) => Promise<void>;
  /** Wait for event loop ticks */
  waitEvents: (ticks?: number) => Promise<void>;
  /** Create mock event emitter */
  createMockEmitter: (config?: MockEventEmitterConfig) => MockEventEmitter;
  /** Test promise with configuration */
  testPromise: <T>(
    factory: () => Promise<T>,
    config?: PromiseTestConfig
  ) => Promise<AsyncOperationResult<T>>;
}

/**
 * Async pattern testing utilities interface
 */
export interface AsyncTestUtilities {
  /** Set up async testing environment */
  setupAsyncTesting(config?: AsyncTestConfig): AsyncTestEnvironment;

  /** Test promise resolution */
  testPromiseResolution<T>(
    promiseFactory: () => Promise<T>,
    config?: PromiseTestConfig
  ): Promise<AsyncOperationResult<T>>;

  /** Test promise rejection */
  testPromiseRejection(
    promiseFactory: () => Promise<unknown>,
    expectedError: string | RegExp | Error,
    config?: PromiseTestConfig
  ): Promise<AsyncOperationResult>;

  /** Test promise chain */
  testPromiseChain<T>(
    operations: PromiseChainOperation<T>[],
    config?: PromiseTestConfig
  ): Promise<PromiseChainResult<T>>;

  /** Validate event sequence */
  validateEventSequence(
    emitter: EventEmitter,
    config: EventSequenceConfig
  ): Promise<EventSequenceResult>;

  /** Test stream operation */
  testStreamOperation(
    stream: Readable | Writable | Transform,
    config?: StreamTestConfig
  ): Promise<StreamOperationResult>;

  /** Test async timeout */
  testAsyncTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number,
    expectedTimeoutError?: string | RegExp
  ): Promise<AsyncOperationResult<T>>;

  /** Coordinate multiple async operations */
  coordinateAsyncOperations<T>(
    operations: AsyncOperationDefinition<T>[]
  ): Promise<AsyncCoordinationResult<T>>;

  /** Create mock event emitter */
  createMockEventEmitter(config?: MockEventEmitterConfig): MockEventEmitter;

  /** Wait for specific event */
  waitForEvent(emitter: EventEmitter, eventName: string, timeout?: number): Promise<unknown>;
}

/**
 * Async test validation error types
 */
export class AsyncTestValidationError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = 'AsyncTestValidationError';
  }
}

/**
 * Async operation timeout error
 */
export class AsyncTimeoutError extends Error {
  constructor(
    message: string,
    public readonly timeoutMs: number,
    public readonly operationName?: string
  ) {
    super(message);
    this.name = 'AsyncTimeoutError';
  }
}

/**
 * Event sequence validation error
 */
export class EventSequenceError extends Error {
  constructor(
    message: string,
    public readonly expectedEvents: string[],
    public readonly receivedEvents: string[]
  ) {
    super(message);
    this.name = 'EventSequenceError';
  }
}

/**
 * Stream operation error
 */
export class StreamOperationError extends Error {
  constructor(
    message: string,
    public readonly streamType: string,
    public readonly operation: string
  ) {
    super(message);
    this.name = 'StreamOperationError';
  }
}

/**
 * Promise chain validation error
 */
export class PromiseChainError extends Error {
  constructor(
    message: string,
    public readonly failedOperation: string,
    public readonly operationIndex: number
  ) {
    super(message);
    this.name = 'PromiseChainError';
  }
}
