/**
 * Type-safe mock utilities for test isolation and cleanup
 * Addresses mock implementation issues with proper type safety
 */

import { ProcessResourceUsage, ProcessHealthMetrics, ProcessMonitor } from '../../src/utils/ProcessMonitor';
import { HeartbeatScheduler, ScheduledCheck, ScheduledTimeout } from '../../src/ai/heartbeat/HeartbeatScheduler';
import { TestableTimer, TimerHandle } from '../../src/types/timer-types';
import { HeartbeatMonitorAdapter } from '../../src/ai/heartbeat/ClaudeOrchestratorIntegration';

/**
 * Type-safe mock factory for ProcessResourceUsage
 */
export function createMockProcessResourceUsage(overrides?: Partial<ProcessResourceUsage>): ProcessResourceUsage {
  return {
    pid: 12345,
    cpu: 50,
    memory: 40,
    rss: 1024,
    vsz: 2048,
    state: 'R',
    ppid: 1,
    command: 'test-process',
    ...overrides
  };
}

/**
 * Type-safe mock factory for ProcessHealthMetrics
 */
export function createMockProcessHealthMetrics(overrides?: Partial<ProcessHealthMetrics>): ProcessHealthMetrics {
  return {
    isAlive: true,
    isZombie: false,
    isHighResource: false,
    resourceUsage: createMockProcessResourceUsage(),
    healthScore: 80,
    warnings: [],
    recommendations: [],
    ...overrides
  };
}

/**
 * Type-safe mock factory for HeartbeatScheduler
 */
export function createMockHeartbeatScheduler(): jest.Mocked<HeartbeatScheduler> {
  return {
    scheduleChecks: jest.fn(),
    scheduleTimeout: jest.fn(),
    scheduleProgressReporting: jest.fn(),
    cancelCheck: jest.fn(),
    cancelTimeout: jest.fn(),
    cancelProgressReporting: jest.fn(),
    cancelAll: jest.fn(),
    cancelAllTasks: jest.fn(),
    getActiveTasks: jest.fn().mockReturnValue([]),
    getStats: jest.fn().mockReturnValue({
      activeChecks: 0,
      activeTimeouts: 0,
      totalScheduled: 0,
      totalCancelled: 0
    }),
    hasActiveScheduling: jest.fn().mockReturnValue(false),
    getTimeoutRemaining: jest.fn().mockReturnValue(null),
    getCheckDuration: jest.fn().mockReturnValue(null)
  } as unknown as jest.Mocked<HeartbeatScheduler>;
}

/**
 * Type-safe mock factory for ProcessMonitor
 */
export function createMockProcessMonitor(): jest.Mocked<ProcessMonitor> {
  return {
    startMonitoring: jest.fn(),
    stopMonitoring: jest.fn(),
    stopAll: jest.fn(),
    getHealthMetrics: jest.fn(),
    getResourceUsage: jest.fn()
  } as unknown as jest.Mocked<ProcessMonitor>;
}

/**
 * Type-safe mock factory for TestableTimer
 */
export function createMockTimer(): jest.Mocked<TestableTimer> {
  return {
    getCurrentTime: jest.fn(() => Date.now()),
    schedule: jest.fn((_callback: () => void, _delay: number) => {
      const handle: TimerHandle = {
        cancel: jest.fn(),
        id: 'test-timer-' + Math.random(),
        active: true,
      };
      return handle;
    }),
    scheduleInterval: jest.fn((_callback: () => void, _interval: number) => {
      const handle: TimerHandle = {
        cancel: jest.fn(),
        id: 'test-interval-' + Math.random(),
        active: true,
      };
      return handle;
    }),
    createTimeout: jest.fn((_callback: () => void, _delay: number) => {
      const handle: TimerHandle = {
        cancel: jest.fn(),
        id: 'test-timeout-' + Math.random(),
        active: true,
      };
      return handle;
    }),
    cancelTimer: jest.fn(),
    now: jest.fn(() => Date.now())
  } as unknown as jest.Mocked<TestableTimer>;
}

/**
 * Type-safe mock factory for ScheduledCheck
 */
export function createMockScheduledCheck(taskId: string = 'test-task'): ScheduledCheck {
  return {
    taskId,
    handle: {
      cancel: jest.fn(),
      id: 'test-check-' + Math.random(),
      active: true,
    },
    startTime: Date.now()
  };
}

/**
 * Type-safe mock factory for ScheduledTimeout
 */
export function createMockScheduledTimeout(taskId: string = 'test-task'): ScheduledTimeout {
  const now = Date.now();
  return {
    taskId,
    handle: {
      cancel: jest.fn(),
      id: 'test-timeout-' + Math.random(),
      active: true,
    },
    scheduledAt: now,
    executeAt: now + 5000
  };
}

/**
 * Test cleanup utility to ensure proper mock isolation
 */
export class MockCleanupManager {
  private cleanupCallbacks: Array<() => void> = [];

  /**
   * Register a cleanup callback
   */
  addCleanup(callback: () => void): void {
    this.cleanupCallbacks.push(callback);
  }

  /**
   * Execute all cleanup callbacks and clear them
   */
  cleanup(): void {
    this.cleanupCallbacks.forEach(callback => {
      try {
        callback();
      } catch (error) {
        console.warn('Mock cleanup error:', error);
      }
    });
    this.cleanupCallbacks = [];
  }

  /**
   * Clear all jest mocks and timers
   */
  clearAllMocks(): void {
    jest.clearAllMocks();
    jest.clearAllTimers();
  }

  /**
   * Full cleanup including jest mocks and registered callbacks
   */
  fullCleanup(): void {
    this.clearAllMocks();
    this.cleanup();
  }
}

/**
 * Global mock cleanup manager instance
 */
export const mockCleanupManager = new MockCleanupManager();

/**
 * Type-safe mock factory for HeartbeatMonitorAdapter
 */
export function createMockHeartbeatMonitorAdapter(): jest.Mocked<HeartbeatMonitorAdapter> {
  return {
    startMonitoring: jest.fn(),
    stopMonitoring: jest.fn(),
    updateActivity: jest.fn(),
    isTaskActive: jest.fn().mockReturnValue(true),
    getTaskStatus: jest.fn().mockReturnValue('active'),
    getTaskMetrics: jest.fn().mockReturnValue({
      taskId: 'test-task',
      pid: 12345,
      activityCount: 10,
      lastActivity: new Date(),
      health: 'healthy'
    })
  } as unknown as jest.Mocked<HeartbeatMonitorAdapter>;
}

/**
 * Helper function to setup proper mock cleanup in tests
 */
export function setupMockCleanup(): void {
  beforeEach(() => {
    mockCleanupManager.clearAllMocks();
  });

  afterEach(() => {
    mockCleanupManager.fullCleanup();
  });
}