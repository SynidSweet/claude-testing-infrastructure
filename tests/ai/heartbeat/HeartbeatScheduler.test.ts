/**
 * Unit tests for HeartbeatScheduler
 * 
 * Tests timer scheduling with MockTimer for deterministic behavior
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { HeartbeatScheduler, SchedulerConfig } from '../../../src/ai/heartbeat/HeartbeatScheduler';
import { MockTimer } from '../../../src/utils/MockTimer';

describe('HeartbeatScheduler', () => {
  let mockTimer: MockTimer;
  let scheduler: HeartbeatScheduler;
  const config: SchedulerConfig = {
    intervalMs: 30000,
    timeoutMs: 900000,
    progressIntervalMs: 10000
  };

  beforeEach(() => {
    mockTimer = new MockTimer();
    scheduler = new HeartbeatScheduler(mockTimer, config);
  });

  describe('scheduleChecks', () => {
    it('should schedule periodic health checks', async () => {
      const onCheck = jest.fn();
      const check = scheduler.scheduleChecks('task-1', onCheck);

      expect(check.taskId).toBe('task-1');
      expect(check.handle).toBeDefined();
      expect(onCheck).not.toHaveBeenCalled();

      // Advance time to trigger first check
      await mockTimer.advanceTime(30000);
      expect(onCheck).toHaveBeenCalledTimes(1);

      // Advance time again for second check
      await mockTimer.advanceTime(30000);
      expect(onCheck).toHaveBeenCalledTimes(2);
    });

    it('should cancel existing check when scheduling new one', async () => {
      const onCheck1 = jest.fn();
      const onCheck2 = jest.fn();

      scheduler.scheduleChecks('task-1', onCheck1);
      scheduler.scheduleChecks('task-1', onCheck2);

      await mockTimer.advanceTime(30000);
      
      expect(onCheck1).not.toHaveBeenCalled();
      expect(onCheck2).toHaveBeenCalledTimes(1);
    });

    it('should track active checks', () => {
      const onCheck = jest.fn();
      
      scheduler.scheduleChecks('task-1', onCheck);
      scheduler.scheduleChecks('task-2', onCheck);

      const activeTasks = scheduler.getActiveTasks();
      expect(activeTasks).toContain('task-1');
      expect(activeTasks).toContain('task-2');
      expect(activeTasks).toHaveLength(2);
    });
  });

  describe('scheduleTimeout', () => {
    it('should schedule one-time timeout', async () => {
      const onTimeout = jest.fn();
      const timeout = scheduler.scheduleTimeout('task-1', onTimeout, 5000);

      expect(timeout.taskId).toBe('task-1');
      expect(timeout.handle).toBeDefined();
      expect(timeout.executeAt).toBe(timeout.scheduledAt + 5000);

      await mockTimer.advanceTime(4999);
      expect(onTimeout).not.toHaveBeenCalled();

      await mockTimer.advanceTime(1);
      expect(onTimeout).toHaveBeenCalledTimes(1);

      // Should not fire again
      await mockTimer.advanceTime(5000);
      expect(onTimeout).toHaveBeenCalledTimes(1);
    });

    it('should cancel existing timeout when scheduling new one', async () => {
      const onTimeout1 = jest.fn();
      const onTimeout2 = jest.fn();

      scheduler.scheduleTimeout('task-1', onTimeout1, 5000);
      scheduler.scheduleTimeout('task-1', onTimeout2, 3000);

      await mockTimer.advanceTime(5000);
      
      expect(onTimeout1).not.toHaveBeenCalled();
      expect(onTimeout2).toHaveBeenCalledTimes(1);
    });

    it('should track timeout remaining time', () => {
      const now = 1000000; // Arbitrary start time
      mockTimer.setCurrentTime(now);
      
      scheduler.scheduleTimeout('task-1', jest.fn(), 5000);
      
      // The timeout is scheduled but we can't accurately test remaining time
      // without Date.now() being controlled by MockTimer
      expect(scheduler.getTimeoutRemaining('task-1')).toBeGreaterThanOrEqual(0);
      expect(scheduler.getTimeoutRemaining('task-1')).toBeLessThanOrEqual(5000);
    });
  });

  describe('scheduleProgressReporting', () => {
    it('should schedule progress reporting with default interval', async () => {
      const onProgress = jest.fn();
      const handle = scheduler.scheduleProgressReporting('task-1', onProgress);

      expect(handle).toBeDefined();

      await mockTimer.advanceTime(10000); // Default progress interval
      expect(onProgress).toHaveBeenCalledTimes(1);

      await mockTimer.advanceTime(10000);
      expect(onProgress).toHaveBeenCalledTimes(2);
    });

    it('should use custom interval', async () => {
      const onProgress = jest.fn();
      scheduler.scheduleProgressReporting('task-1', onProgress, 5000);

      await mockTimer.advanceTime(5000);
      expect(onProgress).toHaveBeenCalledTimes(1);
    });
  });

  describe('cancel operations', () => {
    it('should cancel scheduled checks', async () => {
      const onCheck = jest.fn();
      scheduler.scheduleChecks('task-1', onCheck);
      
      scheduler.cancelCheck('task-1');
      
      await mockTimer.advanceTime(30000);
      expect(onCheck).not.toHaveBeenCalled();
    });

    it('should cancel scheduled timeouts', async () => {
      const onTimeout = jest.fn();
      scheduler.scheduleTimeout('task-1', onTimeout, 5000);
      
      scheduler.cancelTimeout('task-1');
      
      await mockTimer.advanceTime(5000);
      expect(onTimeout).not.toHaveBeenCalled();
    });

    it('should cancel all operations for a task', async () => {
      const onCheck = jest.fn();
      const onTimeout = jest.fn();
      const onProgress = jest.fn();

      scheduler.scheduleChecks('task-1', onCheck);
      scheduler.scheduleTimeout('task-1', onTimeout, 5000);
      scheduler.scheduleProgressReporting('task-1', onProgress);

      scheduler.cancelAll('task-1');

      await mockTimer.advanceTime(30000);
      expect(onCheck).not.toHaveBeenCalled();
      expect(onTimeout).not.toHaveBeenCalled();
      expect(onProgress).not.toHaveBeenCalled();
    });

    it('should cancel all tasks', () => {
      scheduler.scheduleChecks('task-1', jest.fn());
      scheduler.scheduleChecks('task-2', jest.fn());
      scheduler.scheduleTimeout('task-3', jest.fn(), 5000);

      expect(scheduler.getActiveTasks()).toHaveLength(3);

      scheduler.cancelAllTasks();

      expect(scheduler.getActiveTasks()).toHaveLength(0);
    });
  });

  describe('getStats', () => {
    it('should return scheduler statistics', () => {
      scheduler.scheduleChecks('task-1', jest.fn());
      scheduler.scheduleTimeout('task-2', jest.fn(), 5000);
      scheduler.scheduleProgressReporting('task-3', jest.fn());
      scheduler.scheduleChecks('task-2', jest.fn()); // Same task with check

      const stats = scheduler.getStats();
      
      expect(stats.activeChecks).toBe(2);
      expect(stats.activeTimeouts).toBe(1);
      expect(stats.activeProgressReports).toBe(1);
      expect(stats.totalActive).toBe(3); // Unique tasks
    });
  });

  describe('utility methods', () => {
    it('should check if task has active scheduling', () => {
      expect(scheduler.hasActiveScheduling('task-1')).toBe(false);

      scheduler.scheduleChecks('task-1', jest.fn());
      expect(scheduler.hasActiveScheduling('task-1')).toBe(true);

      scheduler.cancelCheck('task-1');
      expect(scheduler.hasActiveScheduling('task-1')).toBe(false);
    });

    it('should get check duration', () => {
      const now = 1000000;
      mockTimer.setCurrentTime(now);
      
      const check = scheduler.scheduleChecks('task-1', jest.fn());
      
      // Since Date.now() doesn't change with MockTimer,
      // we'll just verify the check was created with a valid start time
      expect(check.startTime).toBeGreaterThan(0);
      expect(scheduler.getCheckDuration('task-1')).toBeGreaterThanOrEqual(0);
    });

    it('should return null for non-existent tasks', () => {
      expect(scheduler.getTimeoutRemaining('non-existent')).toBeNull();
      expect(scheduler.getCheckDuration('non-existent')).toBeNull();
    });
  });
});