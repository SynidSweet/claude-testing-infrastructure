/**
 * Real Timer Implementation
 *
 * Production implementation of TestableTimer that uses native Node.js/browser
 * timer functions (setTimeout, setInterval, setImmediate).
 *
 * @category Timer Implementation
 * @since 1.0.0
 */

import {
  TimerValidationError,
  type TestableTimer,
  type TimerHandle,
  type TimerCallback,
  type TimerOptions,
  type TimerMetrics,
} from '../types/timer-types';

/**
 * Real timer handle implementation
 */
class RealTimerHandle implements TimerHandle {
  private _active = true;
  private _nativeHandle: NodeJS.Timeout | NodeJS.Immediate | number | null = null;

  constructor(
    public readonly id: string,
    nativeHandle: NodeJS.Timeout | NodeJS.Immediate | number,
    private readonly onCancel: (id: string) => void
  ) {
    this._nativeHandle = nativeHandle;
  }

  get active(): boolean {
    return this._active;
  }

  cancel(): void {
    if (!this._active || !this._nativeHandle) {
      return;
    }

    this._active = false;

    // Clear the native timer based on type
    if (typeof this._nativeHandle === 'number') {
      // Browser environment or immediate handle
      clearTimeout(this._nativeHandle);
    } else if (
      this._nativeHandle &&
      typeof (this._nativeHandle as unknown as Record<string, unknown>).close === 'function'
    ) {
      // Node.js immediate handle
      clearImmediate(this._nativeHandle as NodeJS.Immediate);
    } else {
      // Node.js timeout/interval handle
      clearTimeout(this._nativeHandle as NodeJS.Timeout);
    }

    this._nativeHandle = null;
    this.onCancel(this.id);
  }
}

/**
 * Production timer implementation using native timer functions
 */
export class RealTimer implements TestableTimer {
  private readonly activeTimers = new Map<string, RealTimerHandle>();
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
  private callbackTimes: number[] = [];

  /**
   * Generate unique timer ID
   */
  private generateTimerId(prefix = 'timer'): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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

    if (delay > 2147483647) {
      // Maximum 32-bit signed integer
      throw new TimerValidationError(
        'Delay exceeds maximum value (2147483647ms)',
        'DELAY_TOO_LARGE'
      );
    }
  }

  /**
   * Create wrapped callback with metrics tracking
   */
  private createWrappedCallback(
    originalCallback: TimerCallback,
    timerId: string,
    type: 'timeout' | 'interval' | 'immediate',
    args: unknown[] = []
  ): TimerCallback {
    return (...callbackArgs: unknown[]) => {
      const startTime = performance.now();

      try {
        // Use provided args or fallback to callback args
        const finalArgs = args.length > 0 ? args : callbackArgs;
        originalCallback(...finalArgs);
      } catch (error) {
        // Log error but don't throw to prevent timer system from breaking
        console.error(`Timer callback error (${timerId}):`, error);
      }

      const endTime = performance.now();
      const executionTime = endTime - startTime;

      // Update metrics
      this.callbackTimes.push(executionTime);
      if (this.callbackTimes.length > 1000) {
        // Keep only last 1000 measurements to prevent memory growth
        this.callbackTimes = this.callbackTimes.slice(-1000);
      }

      this.metrics.averageCallbackTime =
        this.callbackTimes.reduce((sum, time) => sum + time, 0) / this.callbackTimes.length;

      // For non-repeating timers, mark as completed
      if (type === 'timeout' || type === 'immediate') {
        // Mark timer as inactive before completing to avoid race condition
        const timer = this.activeTimers.get(timerId);
        if (timer?.active) {
          // Timer already completed, just update the active flag internally
          // Note: We can't modify _active directly, but cancel() is not appropriate here
          // since the timer has already fired. This is handled in handleTimerCompletion.
        }
        this.handleTimerCompletion(timerId);
      }
    };
  }

  /**
   * Handle timer completion
   */
  private handleTimerCompletion(timerId: string): void {
    const timer = this.activeTimers.get(timerId);
    if (timer) {
      this.activeTimers.delete(timerId);
      this.metrics.activeCount = this.activeTimers.size;
      this.metrics.completedCount++;
    }
  }

  /**
   * Handle timer cancellation
   */
  private handleTimerCancellation = (timerId: string): void => {
    this.activeTimers.delete(timerId);
    this.metrics.activeCount = this.activeTimers.size;
    this.metrics.cancelledCount++;
  };

  /**
   * Schedule a callback to run after a delay
   */
  schedule(callback: TimerCallback, delay: number, options: TimerOptions = {}): TimerHandle {
    this.validateTimerParams(callback, delay);

    const timerId = options.id ?? this.generateTimerId('timeout');
    const wrappedCallback = this.createWrappedCallback(callback, timerId, 'timeout', options.args);

    const nativeHandle = setTimeout(wrappedCallback, delay);
    const timerHandle = new RealTimerHandle(timerId, nativeHandle, this.handleTimerCancellation);

    this.activeTimers.set(timerId, timerHandle);
    this.metrics.totalCreated++;
    this.metrics.activeCount = this.activeTimers.size;
    this.metrics.typeBreakdown.timeout++;

    return timerHandle;
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
    const wrappedCallback = this.createWrappedCallback(callback, timerId, 'interval', options.args);

    const nativeHandle = setInterval(wrappedCallback, interval);
    const timerHandle = new RealTimerHandle(timerId, nativeHandle, this.handleTimerCancellation);

    this.activeTimers.set(timerId, timerHandle);
    this.metrics.totalCreated++;
    this.metrics.activeCount = this.activeTimers.size;
    this.metrics.typeBreakdown.interval++;

    return timerHandle;
  }

  /**
   * Schedule a callback to run on the next tick
   */
  scheduleImmediate(callback: TimerCallback, options: TimerOptions = {}): TimerHandle {
    if (typeof callback !== 'function') {
      throw new TimerValidationError('Callback must be a function', 'INVALID_CALLBACK');
    }

    const timerId = options.id ?? this.generateTimerId('immediate');
    const wrappedCallback = this.createWrappedCallback(
      callback,
      timerId,
      'immediate',
      options.args
    );

    // Use setImmediate if available (Node.js), otherwise use setTimeout(0)
    const nativeHandle =
      typeof setImmediate !== 'undefined'
        ? setImmediate(wrappedCallback)
        : setTimeout(wrappedCallback, 0);

    const timerHandle = new RealTimerHandle(timerId, nativeHandle, this.handleTimerCancellation);

    this.activeTimers.set(timerId, timerHandle);
    this.metrics.totalCreated++;
    this.metrics.activeCount = this.activeTimers.size;
    this.metrics.typeBreakdown.immediate++;

    return timerHandle;
  }

  /**
   * Cancel all active timers
   */
  cancelAll(): void {
    const timerIds = Array.from(this.activeTimers.keys());
    for (const timerId of timerIds) {
      const timer = this.activeTimers.get(timerId);
      timer?.cancel();
    }
  }

  /**
   * Get count of active timers
   */
  getActiveTimerCount(): number {
    return this.activeTimers.size;
  }

  /**
   * Get all active timer IDs
   */
  getActiveTimerIds(): string[] {
    return Array.from(this.activeTimers.keys());
  }

  /**
   * Get current time (real time implementation)
   */
  getCurrentTime(): number {
    return Date.now();
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
    this.metrics.activeCount = this.activeTimers.size;
    this.metrics.cancelledCount = 0;
    this.metrics.completedCount = 0;
    this.metrics.averageCallbackTime = 0;
    this.metrics.typeBreakdown = {
      timeout: 0,
      interval: 0,
      immediate: 0,
    };
    this.callbackTimes = [];
  }
}
