/**
 * Heartbeat Scheduler - Manages timer scheduling for health checks
 *
 * This module handles all timer-related operations using dependency injection.
 * It has no business logic, only scheduling concerns.
 */

import { TestableTimer, TimerHandle } from '../../types/timer-types';

export interface SchedulerConfig {
  intervalMs: number;
  timeoutMs?: number;
  progressIntervalMs?: number;
}

export interface ScheduledCheck {
  taskId: string;
  handle: TimerHandle;
  startTime: number;
}

export interface ScheduledTimeout {
  taskId: string;
  handle: TimerHandle;
  scheduledAt: number;
  executeAt: number;
}

export class HeartbeatScheduler {
  private activeChecks = new Map<string, ScheduledCheck>();
  private activeTimeouts = new Map<string, ScheduledTimeout>();
  private progressIntervals = new Map<string, TimerHandle>();

  constructor(
    private timerService: TestableTimer,
    private config: SchedulerConfig
  ) {}

  /**
   * Schedules periodic health checks for a task
   */
  scheduleChecks(taskId: string, onCheck: () => void): ScheduledCheck {
    // Cancel any existing check for this task
    this.cancelCheck(taskId);

    const handle = this.timerService.scheduleInterval(onCheck, this.config.intervalMs);

    const scheduledCheck: ScheduledCheck = {
      taskId,
      handle,
      startTime: Date.now(),
    };

    this.activeChecks.set(taskId, scheduledCheck);
    return scheduledCheck;
  }

  /**
   * Schedules a one-time timeout callback
   */
  scheduleTimeout(taskId: string, onTimeout: () => void, delayMs: number): ScheduledTimeout {
    // Cancel any existing timeout for this task
    this.cancelTimeout(taskId);

    const handle = this.timerService.schedule(onTimeout, delayMs);
    const now = Date.now();

    const scheduledTimeout: ScheduledTimeout = {
      taskId,
      handle,
      scheduledAt: now,
      executeAt: now + delayMs,
    };

    this.activeTimeouts.set(taskId, scheduledTimeout);
    return scheduledTimeout;
  }

  /**
   * Schedules progress reporting intervals
   */
  scheduleProgressReporting(
    taskId: string,
    onProgress: () => void,
    intervalMs?: number
  ): TimerHandle {
    // Cancel any existing progress reporting
    this.cancelProgressReporting(taskId);

    const interval = intervalMs || this.config.progressIntervalMs || 10000;
    const handle = this.timerService.scheduleInterval(onProgress, interval);

    this.progressIntervals.set(taskId, handle);
    return handle;
  }

  /**
   * Cancels scheduled health checks for a task
   */
  cancelCheck(taskId: string): void {
    const check = this.activeChecks.get(taskId);
    if (check) {
      check.handle.cancel();
      this.activeChecks.delete(taskId);
    }
  }

  /**
   * Cancels scheduled timeout for a task
   */
  cancelTimeout(taskId: string): void {
    const timeout = this.activeTimeouts.get(taskId);
    if (timeout) {
      timeout.handle.cancel();
      this.activeTimeouts.delete(taskId);
    }
  }

  /**
   * Cancels progress reporting for a task
   */
  cancelProgressReporting(taskId: string): void {
    const handle = this.progressIntervals.get(taskId);
    if (handle) {
      handle.cancel();
      this.progressIntervals.delete(taskId);
    }
  }

  /**
   * Cancels all scheduled operations for a task
   */
  cancelAll(taskId: string): void {
    this.cancelCheck(taskId);
    this.cancelTimeout(taskId);
    this.cancelProgressReporting(taskId);
  }

  /**
   * Cancels all scheduled operations
   */
  cancelAllTasks(): void {
    // Cancel all health checks
    for (const taskId of this.activeChecks.keys()) {
      this.cancelCheck(taskId);
    }

    // Cancel all timeouts
    for (const taskId of this.activeTimeouts.keys()) {
      this.cancelTimeout(taskId);
    }

    // Cancel all progress reporting
    for (const taskId of this.progressIntervals.keys()) {
      this.cancelProgressReporting(taskId);
    }
  }

  /**
   * Gets active task IDs
   */
  getActiveTasks(): string[] {
    const tasks = new Set<string>();

    for (const taskId of this.activeChecks.keys()) {
      tasks.add(taskId);
    }
    for (const taskId of this.activeTimeouts.keys()) {
      tasks.add(taskId);
    }
    for (const taskId of this.progressIntervals.keys()) {
      tasks.add(taskId);
    }

    return Array.from(tasks);
  }

  /**
   * Gets scheduler statistics
   */
  getStats(): {
    activeChecks: number;
    activeTimeouts: number;
    activeProgressReports: number;
    totalActive: number;
  } {
    return {
      activeChecks: this.activeChecks.size,
      activeTimeouts: this.activeTimeouts.size,
      activeProgressReports: this.progressIntervals.size,
      totalActive: this.getActiveTasks().length,
    };
  }

  /**
   * Checks if a task has active scheduling
   */
  hasActiveScheduling(taskId: string): boolean {
    return (
      this.activeChecks.has(taskId) ||
      this.activeTimeouts.has(taskId) ||
      this.progressIntervals.has(taskId)
    );
  }

  /**
   * Gets remaining time for a timeout
   */
  getTimeoutRemaining(taskId: string): number | null {
    const timeout = this.activeTimeouts.get(taskId);
    if (!timeout) return null;

    const remaining = timeout.executeAt - Date.now();
    return Math.max(0, remaining);
  }

  /**
   * Gets time since check started
   */
  getCheckDuration(taskId: string): number | null {
    const check = this.activeChecks.get(taskId);
    if (!check) return null;

    return Date.now() - check.startTime;
  }
}
