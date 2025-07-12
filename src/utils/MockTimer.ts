/**
 * Mock Timer Implementation
 *
 * Test implementation of TestableTimer that provides complete control over
 * time advancement for deterministic testing of time-based functionality.
 *
 * @category Timer Implementation
 * @since 1.0.0
 */

import {
  TimerValidationError,
  type MockTimerController,
  type TimerHandle,
  type TimerCallback,
  type TimerOptions,
  type TimerMetrics,
} from '../types/timer-types';
import debug from 'debug';

/**
 * Pending timer information
 */
interface PendingTimer {
  id: string;
  callback: TimerCallback;
  scheduledTime: number;
  type: 'timeout' | 'interval' | 'immediate';
  interval?: number; // For repeating timers
  args: unknown[];
  active: boolean;
}

/**
 * Mock timer handle implementation
 */
class MockTimerHandle implements TimerHandle {
  private _active = true;

  constructor(
    public readonly id: string,
    private readonly mockTimer: MockTimer
  ) {}

  get active(): boolean {
    return this._active && this.mockTimer.hasTimer(this.id);
  }

  cancel(): void {
    if (this._active) {
      this._active = false;
      this.mockTimer.cancelTimer(this.id);
    }
  }
}

/**
 * Mock timer implementation for testing
 */
export class MockTimer implements MockTimerController {
  private currentTime: number;
  private pendingTimers = new Map<string, PendingTimer>();
  private timerIdCounter = 0;
  private readonly debug: boolean;

  private readonly metrics: TimerMetrics = {
    totalCreated: 0,
    activeCount: 0,
    cancelledCount: 0,
    completedCount: 0,
    averageCallbackTime: 0,
    typeBreakdown: {
      timeout: 0,
      interval: 0,
      immediate: 0,
    },
  };

  constructor(startTime: number = Date.now(), debug = false) {
    this.currentTime = startTime;
    this.debug = debug;
  }

  /**
   * Generate unique timer ID
   */
  private generateTimerId(prefix = 'mock'): string {
    return `${prefix}_${++this.timerIdCounter}`;
  }

  /**
   * Log debug information
   */
  private logger = debug('claude-testing:mock-timer');

  private log(message: string, ...args: unknown[]): void {
    if (this.debug) {
      this.logger(message, ...args);
    }
  }

  /**
   * Validate timer parameters
   */
  private validateTimerParams(callback: TimerCallback, delay: number): void {
    if (typeof callback !== 'function') {
      throw new TimerValidationError('Callback must be a function', 'INVALID_CALLBACK');
    }

    if (typeof delay !== 'number' || delay < 0 || !isFinite(delay)) {
      throw new TimerValidationError('Delay must be a non-negative finite number', 'INVALID_DELAY');
    }
  }

  /**
   * Execute a timer callback and handle errors
   */
  private executeCallback(timer: PendingTimer): void {
    const startTime = performance.now();

    try {
      this.log(`Executing timer ${timer.id} at time ${this.currentTime}`);
      timer.callback(...timer.args);
    } catch (error) {
      console.error(`Mock timer callback error (${timer.id}):`, error);
    }

    const endTime = performance.now();
    const executionTime = endTime - startTime;

    // Update metrics (simplified for mock)
    this.metrics.averageCallbackTime = (this.metrics.averageCallbackTime + executionTime) / 2;
  }

  /**
   * Check if timer exists
   */
  hasTimer(timerId: string): boolean {
    return this.pendingTimers.has(timerId);
  }

  /**
   * Cancel specific timer
   */
  cancelTimer(timerId: string): void {
    const timer = this.pendingTimers.get(timerId);
    if (timer) {
      timer.active = false;
      this.pendingTimers.delete(timerId);
      this.metrics.activeCount = this.pendingTimers.size;
      this.metrics.cancelledCount++;
      this.log(`Cancelled timer ${timerId}`);
    }
  }

  /**
   * Schedule a callback to run after a delay
   */
  schedule(callback: TimerCallback, delay: number, options: TimerOptions = {}): TimerHandle {
    this.validateTimerParams(callback, delay);

    const timerId = options.id ?? this.generateTimerId('timeout');
    const scheduledTime = this.currentTime + delay;

    const timer: PendingTimer = {
      id: timerId,
      callback,
      scheduledTime,
      type: 'timeout',
      args: options.args ?? [],
      active: true,
    };

    this.pendingTimers.set(timerId, timer);
    this.metrics.totalCreated++;
    this.metrics.activeCount = this.pendingTimers.size;
    this.metrics.typeBreakdown.timeout++;

    this.log(`Scheduled timeout ${timerId} for time ${scheduledTime} (delay: ${delay}ms)`);

    return new MockTimerHandle(timerId, this);
  }

  /**
   * Schedule a callback to run repeatedly at intervals
   */
  scheduleInterval(
    callback: TimerCallback,
    interval: number,
    options: TimerOptions = {}
  ): TimerHandle {
    this.validateTimerParams(callback, interval);

    const timerId = options.id ?? this.generateTimerId('interval');
    const scheduledTime = this.currentTime + interval;

    const timer: PendingTimer = {
      id: timerId,
      callback,
      scheduledTime,
      type: 'interval',
      interval,
      args: options.args ?? [],
      active: true,
    };

    this.pendingTimers.set(timerId, timer);
    this.metrics.totalCreated++;
    this.metrics.activeCount = this.pendingTimers.size;
    this.metrics.typeBreakdown.interval++;

    this.log(`Scheduled interval ${timerId} for time ${scheduledTime} (interval: ${interval}ms)`);

    return new MockTimerHandle(timerId, this);
  }

  /**
   * Schedule a callback to run on the next tick
   */
  scheduleImmediate(callback: TimerCallback, options: TimerOptions = {}): TimerHandle {
    if (typeof callback !== 'function') {
      throw new TimerValidationError('Callback must be a function', 'INVALID_CALLBACK');
    }

    const timerId = options.id ?? this.generateTimerId('immediate');
    const scheduledTime = this.currentTime + 1; // Execute on next advancement

    const timer: PendingTimer = {
      id: timerId,
      callback,
      scheduledTime,
      type: 'immediate',
      args: options.args ?? [],
      active: true,
    };

    this.pendingTimers.set(timerId, timer);
    this.metrics.totalCreated++;
    this.metrics.activeCount = this.pendingTimers.size;
    this.metrics.typeBreakdown.immediate++;

    this.log(`Scheduled immediate ${timerId} for current time ${scheduledTime}`);

    return new MockTimerHandle(timerId, this);
  }

  /**
   * Cancel all active timers
   */
  cancelAll(): void {
    const timerIds = Array.from(this.pendingTimers.keys());
    for (const timerId of timerIds) {
      this.cancelTimer(timerId);
    }
    this.log('Cancelled all timers');
  }

  /**
   * Get count of active timers
   */
  getActiveTimerCount(): number {
    return this.pendingTimers.size;
  }

  /**
   * Get all active timer IDs
   */
  getActiveTimerIds(): string[] {
    return Array.from(this.pendingTimers.keys());
  }

  /**
   * Advance mock time by specified milliseconds
   */
  advanceTime(ms: number): void {
    if (ms < 0) {
      throw new TimerValidationError(
        'Time advancement must be non-negative',
        'INVALID_TIME_ADVANCE'
      );
    }

    const targetTime = this.currentTime + ms;
    this.log(`Advancing time from ${this.currentTime} to ${targetTime} (+${ms}ms)`);

    // Process timers in chronological order
    while (this.currentTime < targetTime) {
      const nextTimer = this.getNextTimer();

      if (!nextTimer || nextTimer.scheduledTime > targetTime) {
        // No more timers to execute in this time range
        this.currentTime = targetTime;
        break;
      }

      // Advance to timer's scheduled time
      this.currentTime = nextTimer.scheduledTime;

      // Execute the timer
      this.executeCallback(nextTimer);

      // Handle timer completion/rescheduling
      if (nextTimer.type === 'interval' && nextTimer.active) {
        // Reschedule interval timer
        nextTimer.scheduledTime = this.currentTime + (nextTimer.interval ?? 0);
        this.log(`Rescheduled interval ${nextTimer.id} for time ${nextTimer.scheduledTime}`);
      } else {
        // Remove one-shot timers
        this.pendingTimers.delete(nextTimer.id);
        this.metrics.activeCount = this.pendingTimers.size;
        this.metrics.completedCount++;
        this.log(`Completed timer ${nextTimer.id}`);
      }
    }

    this.log(`Time advancement complete. Current time: ${this.currentTime}`);
  }

  /**
   * Get the next timer to execute
   */
  private getNextTimer(): PendingTimer | null {
    let nextTimer: PendingTimer | null = null;

    for (const timer of this.pendingTimers.values()) {
      if (!timer.active) continue;

      if (!nextTimer || timer.scheduledTime < nextTimer.scheduledTime) {
        nextTimer = timer;
      }
    }

    return nextTimer;
  }

  /**
   * Advance to the next scheduled timer
   */
  advanceToNextTimer(): number {
    const nextTimer = this.getNextTimer();

    if (!nextTimer) {
      this.log('No pending timers to advance to');
      return 0;
    }

    const timeToAdvance = Math.max(0, nextTimer.scheduledTime - this.currentTime);
    if (timeToAdvance > 0) {
      this.advanceTime(timeToAdvance);
    }

    return timeToAdvance;
  }

  /**
   * Run all pending timers immediately
   */
  runAllTimers(): void {
    this.log('Running all pending timers');

    let processedCount = 0;
    const maxIterations = 1000; // Prevent infinite loops

    while (this.pendingTimers.size > 0 && processedCount < maxIterations) {
      const nextTimer = this.getNextTimer();

      if (!nextTimer) break;

      // Advance to timer time and execute
      this.currentTime = nextTimer.scheduledTime;
      this.executeCallback(nextTimer);

      // Handle completion
      if (nextTimer.type === 'interval' && nextTimer.active) {
        // For intervals, just remove them to avoid infinite loops
        this.pendingTimers.delete(nextTimer.id);
        this.log(`Removed interval timer ${nextTimer.id} to prevent infinite execution`);
      } else {
        this.pendingTimers.delete(nextTimer.id);
      }

      this.metrics.activeCount = this.pendingTimers.size;
      this.metrics.completedCount++;
      processedCount++;
    }

    if (processedCount >= maxIterations) {
      console.warn(
        'MockTimer.runAllTimers() stopped after maximum iterations to prevent infinite loop'
      );
    }

    this.log(`Ran ${processedCount} timers. Remaining: ${this.pendingTimers.size}`);
  }

  /**
   * Get current mock time
   */
  getCurrentTime(): number {
    return this.currentTime;
  }

  /**
   * Set current mock time
   */
  setCurrentTime(time: number): void {
    if (time < 0) {
      throw new TimerValidationError('Time cannot be negative', 'INVALID_TIME');
    }

    this.log(`Setting time from ${this.currentTime} to ${time}`);
    this.currentTime = time;
  }

  /**
   * Get pending timer information for debugging
   */
  getPendingTimers(): Array<{
    id: string;
    callback: TimerCallback;
    scheduledTime: number;
    type: 'timeout' | 'interval' | 'immediate';
  }> {
    return Array.from(this.pendingTimers.values())
      .filter((timer) => timer.active)
      .map((timer) => ({
        id: timer.id,
        callback: timer.callback,
        scheduledTime: timer.scheduledTime,
        type: timer.type,
      }))
      .sort((a, b) => a.scheduledTime - b.scheduledTime);
  }

  /**
   * Get current timer metrics
   */
  getMetrics(): TimerMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset metrics (useful for testing)
   */
  resetMetrics(): void {
    this.metrics.totalCreated = 0;
    this.metrics.activeCount = this.pendingTimers.size;
    this.metrics.cancelledCount = 0;
    this.metrics.completedCount = 0;
    this.metrics.averageCallbackTime = 0;
    this.metrics.typeBreakdown = {
      timeout: 0,
      interval: 0,
      immediate: 0,
    };
  }
}
