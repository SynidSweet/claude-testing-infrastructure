/**
 * Timer Abstraction Types
 *
 * Type definitions for the testable timer system that provides dependency injection
 * for timer operations, enabling deterministic testing of time-based functionality.
 *
 * @category Timer Types
 * @since 1.0.0
 */

/**
 * Timer operation result with cancellation capability
 */
export interface TimerHandle {
  /** Unique identifier for this timer */
  readonly id: string;
  /** Whether this timer is currently active */
  readonly active: boolean;
  /** Cancel this timer operation */
  cancel(): void;
}

/**
 * Timer callback function signature
 */
export type TimerCallback = (...args: unknown[]) => void;

/**
 * Timer scheduling options
 */
export interface TimerOptions {
  /** Whether the timer should repeat (for intervals) */
  repeat?: boolean;
  /** Arguments to pass to the callback */
  args?: unknown[];
  /** Optional timer identifier for debugging */
  id?: string;
}

/**
 * Core timer abstraction interface
 *
 * Provides a testable interface for all timer operations. Implementations can
 * use real timers for production or mock timers for testing.
 */
export interface TestableTimer {
  /**
   * Schedule a callback to run after a delay
   * @param callback Function to execute
   * @param delay Delay in milliseconds
   * @param options Additional options
   * @returns Handle to cancel the timer
   */
  schedule(callback: TimerCallback, delay: number, options?: TimerOptions): TimerHandle;

  /**
   * Schedule a callback to run repeatedly at intervals
   * @param callback Function to execute
   * @param interval Interval in milliseconds
   * @param options Additional options
   * @returns Handle to cancel the timer
   */
  scheduleInterval(callback: TimerCallback, interval: number, options?: TimerOptions): TimerHandle;

  /**
   * Schedule a callback to run on the next tick
   * @param callback Function to execute
   * @param options Additional options
   * @returns Handle to cancel the timer
   */
  scheduleImmediate(callback: TimerCallback, options?: TimerOptions): TimerHandle;

  /**
   * Cancel all active timers
   */
  cancelAll(): void;

  /**
   * Get count of active timers
   */
  getActiveTimerCount(): number;

  /**
   * Get all active timer IDs
   */
  getActiveTimerIds(): string[];

  /**
   * Get current time (for mock timers returns mock time, for real timers returns Date.now())
   */
  getCurrentTime(): number;
}

/**
 * Mock timer control interface for testing
 *
 * Extends TestableTimer with additional methods for controlling time in tests.
 */
export interface MockTimerController extends TestableTimer {
  /**
   * Advance mock time by specified milliseconds
   * @param ms Time to advance in milliseconds
   */
  advanceTime(ms: number): void;

  /**
   * Advance to the next scheduled timer
   * @returns Time advanced in milliseconds, or 0 if no timers pending
   */
  advanceToNextTimer(): number;

  /**
   * Run all pending timers immediately
   */
  runAllTimers(): void;

  /**
   * Get current mock time
   */
  getCurrentTime(): number;

  /**
   * Set current mock time
   * @param time New time in milliseconds since epoch
   */
  setCurrentTime(time: number): void;

  /**
   * Get pending timer information for debugging
   */
  getPendingTimers(): Array<{
    id: string;
    callback: TimerCallback;
    scheduledTime: number;
    type: 'timeout' | 'interval' | 'immediate';
  }>;
}

/**
 * Timer factory configuration
 */
export interface TimerFactoryConfig {
  /** Type of timer implementation to create */
  type?: 'real' | 'mock';
  /** Starting time for mock timers (milliseconds since epoch) */
  startTime?: number;
  /** Whether to enable debug logging */
  debug?: boolean;
}

/**
 * Timer factory interface
 *
 * Creates appropriate timer implementations based on environment and configuration.
 */
export interface TimerFactory {
  /**
   * Create a timer instance
   * @param config Factory configuration
   * @returns Timer instance
   */
  createTimer(config?: TimerFactoryConfig): TestableTimer;

  /**
   * Create a mock timer controller for testing
   * @param startTime Optional starting time
   * @returns Mock timer controller
   */
  createMockTimer(startTime?: number): MockTimerController;

  /**
   * Create a real timer for production use
   * @returns Real timer instance
   */
  createRealTimer(): TestableTimer;
}

/**
 * Timer validation error types
 */
export class TimerValidationError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = 'TimerValidationError';
  }
}

/**
 * Timer operation error types
 */
export class TimerOperationError extends Error {
  constructor(
    message: string,
    public readonly timerId?: string
  ) {
    super(message);
    this.name = 'TimerOperationError';
  }
}

/**
 * Timer configuration validation result
 */
export interface TimerValidationResult {
  /** Whether the configuration is valid */
  valid: boolean;
  /** Validation errors if any */
  errors: string[];
  /** Validation warnings if any */
  warnings: string[];
}

/**
 * Timer metrics for monitoring and debugging
 */
export interface TimerMetrics {
  /** Total number of timers created */
  totalCreated: number;
  /** Number of currently active timers */
  activeCount: number;
  /** Number of timers cancelled */
  cancelledCount: number;
  /** Number of timers that completed execution */
  completedCount: number;
  /** Average execution time for timer callbacks */
  averageCallbackTime: number;
  /** Timer type breakdown */
  typeBreakdown: {
    timeout: number;
    interval: number;
    immediate: number;
  };
}
