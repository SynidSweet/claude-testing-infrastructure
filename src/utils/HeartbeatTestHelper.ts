/**
 * HeartbeatTestHelper - Utility class for testing heartbeat monitoring
 *
 * Provides simple, reusable methods for testing heartbeat monitoring systems
 * without timer dependencies. Designed for use in other projects that need
 * to test heartbeat functionality.
 *
 * @category Testing Utilities
 * @since 2.0.0
 */

import { EventEmitter } from 'events';
import { MockTimer } from './MockTimer';
import { HeartbeatMonitor, type HeartbeatMonitorConfig } from '../ai/heartbeat/HeartbeatMonitor';
import type { HeartbeatScheduler } from '../ai/heartbeat/HeartbeatScheduler';
import {
  ProcessHealthAnalyzer,
  type ProcessMetrics,
  type HealthStatus,
} from '../ai/heartbeat/ProcessHealthAnalyzer';

/**
 * Mock process interface for testing
 */
export interface MockHeartbeatProcess extends EventEmitter {
  stdout: EventEmitter;
  stderr: EventEmitter;
  kill: jest.Mock;
  pid: number;
  killed: boolean;
  exitCode: number | null;
  taskId: string;
}

/**
 * Health status assertion options
 */
export interface HealthStatusAssertion {
  shouldBeHealthy?: boolean;
  shouldTerminate?: boolean;
  expectedWarnings?: string[];
  minimumConfidence?: number;
  expectedReason?: string;
}

/**
 * Mock metrics configuration for easy test setup
 */
export interface MockMetricsConfig {
  cpuPercent?: number;
  memoryMB?: number;
  outputRate?: number;
  lastOutputTime?: number;
  errorCount?: number;
  processRuntime?: number;
  progressMarkers?: number;
  isWaitingForInput?: boolean;
}

/**
 * HeartbeatTestHelper - Main utility class for heartbeat testing
 */
export class HeartbeatTestHelper {
  private mockTimer: MockTimer;
  private mockProcesses: Map<string, MockHeartbeatProcess>;
  private mockScheduler: jest.Mocked<HeartbeatScheduler>;
  private defaultConfig: HeartbeatMonitorConfig;

  constructor() {
    this.mockTimer = new MockTimer();
    this.mockProcesses = new Map();
    this.defaultConfig = this.createDefaultConfig();
    this.mockScheduler = this.createMockScheduler();
  }

  /**
   * Create a mock process for testing heartbeat monitoring
   */
  createMockProcess(taskId: string, pid: number = 12345): MockHeartbeatProcess {
    const stdout = new EventEmitter();
    const stderr = new EventEmitter();

    const process = new EventEmitter() as MockHeartbeatProcess;
    process.stdout = stdout;
    process.stderr = stderr;
    process.kill = jest.fn();
    process.pid = pid;
    process.killed = false;
    process.exitCode = null;
    process.taskId = taskId;

    this.mockProcesses.set(taskId, process);
    return process;
  }

  /**
   * Simulate a health check and return the result
   * @param metricsConfig - Configuration for creating mock metrics
   * @param analysisConfig - Optional analysis configuration override
   */
  simulateHealthCheck(
    metricsConfig?: MockMetricsConfig,
    analysisConfig?: typeof this.defaultConfig.analysis
  ): HealthStatus {
    const metrics = this.createMockMetrics(metricsConfig);
    const config = analysisConfig ?? this.defaultConfig.analysis;
    return ProcessHealthAnalyzer.analyzeHealth(metrics, config);
  }

  /**
   * Analyze health status for provided metrics (alternative to simulateHealthCheck)
   * @param metrics - Actual ProcessMetrics to analyze
   * @param analysisConfig - Optional analysis configuration override
   */
  analyzeHealthStatus(
    metrics: ProcessMetrics,
    analysisConfig?: typeof this.defaultConfig.analysis
  ): HealthStatus {
    const config = analysisConfig ?? this.defaultConfig.analysis;
    return ProcessHealthAnalyzer.analyzeHealth(metrics, config);
  }

  /**
   * Assert that a health status matches expected conditions
   */
  assertHealthStatus(status: HealthStatus, assertion: HealthStatusAssertion): void {
    if (assertion.shouldBeHealthy !== undefined) {
      expect(status.isHealthy).toBe(assertion.shouldBeHealthy);
    }

    if (assertion.shouldTerminate !== undefined) {
      expect(status.shouldTerminate).toBe(assertion.shouldTerminate);
    }

    if (assertion.expectedWarnings) {
      expect(status.warnings).toEqual(expect.arrayContaining(assertion.expectedWarnings));
    }

    if (assertion.minimumConfidence !== undefined) {
      expect(status.confidence).toBeGreaterThanOrEqual(assertion.minimumConfidence);
    }

    if (assertion.expectedReason) {
      expect(status.reason).toBe(assertion.expectedReason);
    }
  }

  /**
   * Create mock metrics for testing
   */
  createMockMetrics(config?: MockMetricsConfig): ProcessMetrics {
    return {
      cpuPercent: config?.cpuPercent ?? 50,
      memoryMB: config?.memoryMB ?? 500,
      outputRate: config?.outputRate ?? 1.0,
      lastOutputTime: config?.lastOutputTime ?? Date.now(),
      errorCount: config?.errorCount ?? 0,
      processRuntime: config?.processRuntime ?? 10000,
      progressMarkers: config?.progressMarkers ?? 5,
      isWaitingForInput: config?.isWaitingForInput ?? false,
    };
  }

  /**
   * Simulate process output (stdout or stderr)
   */
  simulateOutput(taskId: string, content: string, isError: boolean = false): void {
    const process = this.mockProcesses.get(taskId);
    if (!process) {
      throw new Error(`Mock process with taskId '${taskId}' not found`);
    }

    const emitter = isError ? process.stderr : process.stdout;
    emitter.emit('data', Buffer.from(content));
  }

  /**
   * Simulate process completion
   */
  simulateCompletion(taskId: string, exitCode: number = 0): void {
    const process = this.mockProcesses.get(taskId);
    if (!process) {
      throw new Error(`Mock process with taskId '${taskId}' not found`);
    }

    process.exitCode = exitCode;
    process.emit('exit', exitCode);
  }

  /**
   * Simulate process error
   */
  simulateError(taskId: string, error: Error): void {
    const process = this.mockProcesses.get(taskId);
    if (!process) {
      throw new Error(`Mock process with taskId '${taskId}' not found`);
    }

    process.emit('error', error);
  }

  /**
   * Create a HeartbeatMonitor instance with mocked dependencies
   */
  createMonitor(config?: Partial<HeartbeatMonitorConfig>): HeartbeatMonitor {
    const monitorConfig = { ...this.defaultConfig, ...config };
    return new HeartbeatMonitor(this.mockScheduler, monitorConfig, this.mockTimer);
  }

  /**
   * Advance mock timer by specified milliseconds
   */
  advanceTime(ms: number): void {
    this.mockTimer.advanceTime(ms);
  }

  /**
   * Get the mock timer instance for advanced timer manipulation
   */
  getMockTimer(): MockTimer {
    return this.mockTimer;
  }

  /**
   * Get mock scheduler for verifying scheduled operations
   */
  getMockScheduler(): jest.Mocked<HeartbeatScheduler> {
    return this.mockScheduler;
  }

  /**
   * Get mock process by task ID
   */
  getMockProcess(taskId: string): MockHeartbeatProcess | undefined {
    return this.mockProcesses.get(taskId);
  }

  /**
   * Clean up all mock processes and reset state
   */
  cleanup(): void {
    this.mockProcesses.clear();
    this.mockTimer = new MockTimer();
    jest.clearAllMocks();
    // Recreate mocks with fresh instances
    this.mockScheduler = this.createMockScheduler();
  }

  /**
   * Verify that a process was killed
   */
  assertProcessKilled(taskId: string): void {
    const process = this.mockProcesses.get(taskId);
    if (!process) {
      throw new Error(`Mock process with taskId '${taskId}' not found`);
    }
    expect(process.kill).toHaveBeenCalled();
  }

  /**
   * Create realistic scenarios for testing
   */
  scenarios = {
    /**
     * Healthy process scenario
     */
    healthy: (): MockMetricsConfig => ({
      cpuPercent: 45,
      memoryMB: 400,
      outputRate: 2.0,
      lastOutputTime: Date.now() - 1000,
      errorCount: 0,
      progressMarkers: 10,
      isWaitingForInput: false,
    }),

    /**
     * High CPU usage scenario
     */
    highCpu: (): MockMetricsConfig => ({
      cpuPercent: 95,
      memoryMB: 400,
      outputRate: 1.0,
      lastOutputTime: Date.now() - 1000,
      errorCount: 0,
      progressMarkers: 5,
      isWaitingForInput: false,
    }),

    /**
     * High memory usage scenario
     */
    highMemory: (): MockMetricsConfig => ({
      cpuPercent: 45,
      memoryMB: 1500,
      outputRate: 1.0,
      lastOutputTime: Date.now() - 1000,
      errorCount: 0,
      progressMarkers: 5,
      isWaitingForInput: false,
    }),

    /**
     * Silent process scenario (no output)
     */
    silent: (): MockMetricsConfig => ({
      cpuPercent: 45,
      memoryMB: 400,
      outputRate: 0,
      lastOutputTime: Date.now() - 150000, // 2.5 minutes ago
      errorCount: 0,
      processRuntime: 120000, // 2 minutes runtime (past early phase)
      progressMarkers: 0,
      isWaitingForInput: false,
    }),

    /**
     * Error-prone process scenario
     */
    errorProne: (): MockMetricsConfig => ({
      cpuPercent: 45,
      memoryMB: 400,
      outputRate: 1.0,
      lastOutputTime: Date.now() - 1000,
      errorCount: 60,
      progressMarkers: 2,
      isWaitingForInput: false,
    }),

    /**
     * Stalled process scenario
     */
    stalled: (): MockMetricsConfig => ({
      cpuPercent: 5,
      memoryMB: 400,
      outputRate: 0.01,
      lastOutputTime: Date.now() - 5000,
      errorCount: 0,
      progressMarkers: 1,
      isWaitingForInput: true,
    }),
  };

  /**
   * Create default configuration for heartbeat monitoring
   * @returns A default HeartbeatMonitorConfig instance
   */
  private createDefaultConfig(): HeartbeatMonitorConfig {
    return {
      scheduler: { intervalMs: 30000 },
      analysis: {
        cpuThreshold: 80,
        memoryThresholdMB: 1000,
        minOutputRate: 0.1,
        maxSilenceDuration: 120000,
        maxErrorCount: 50,
        progressMarkerPatterns: ['processing', 'analyzing', '\\d+%'],
        minProgressMarkers: 1,
        analysisWindowMs: 60000,
      },
      enableLogging: false,
    };
  }

  /**
   * Create a mock HeartbeatScheduler instance with default behavior
   * @returns A Jest-mocked HeartbeatScheduler instance
   */
  private createMockScheduler(): jest.Mocked<HeartbeatScheduler> {
    return {
      scheduleChecks: jest.fn(),
      scheduleTimeout: jest.fn(),
      cancelAll: jest.fn(),
      getStats: jest.fn().mockReturnValue({
        activeChecks: 0,
        activeTimeouts: 0,
        totalScheduled: 0,
        totalCancelled: 0,
      }),
    } as unknown as jest.Mocked<HeartbeatScheduler>;
  }
}

/**
 * Factory function for creating HeartbeatTestHelper instances
 */
export function createHeartbeatTestHelper(): HeartbeatTestHelper {
  return new HeartbeatTestHelper();
}

/**
 * Convenience function for quick health status assertions
 */
export function expectHealthy(status: HealthStatus): void {
  expect(status.isHealthy).toBe(true);
  expect(status.shouldTerminate).toBe(false);
  expect(status.confidence).toBeGreaterThan(0.5);
}

/**
 * Convenience function for quick unhealthy status assertions
 */
export function expectUnhealthy(status: HealthStatus, shouldTerminate: boolean = false): void {
  expect(status.isHealthy).toBe(false);
  if (shouldTerminate) {
    expect(status.shouldTerminate).toBe(true);
  }
  expect(status.warnings.length).toBeGreaterThan(0);
}

/**
 * Pre-configured test scenarios for common use cases
 */
export const HeartbeatTestScenarios = {
  /**
   * Test that a healthy process is correctly identified
   */
  testHealthyProcess: (helper: HeartbeatTestHelper): void => {
    const status = helper.simulateHealthCheck(helper.scenarios.healthy());
    expectHealthy(status);
  },

  /**
   * Test that a high CPU process triggers warnings
   */
  testHighCpuWarning: (helper: HeartbeatTestHelper): void => {
    const status = helper.simulateHealthCheck(helper.scenarios.highCpu());
    expect(status.warnings).toContainEqual(expect.stringContaining('CPU'));
  },

  /**
   * Test that a silent process is detected as unhealthy
   */
  testSilentProcessDetection: (helper: HeartbeatTestHelper): void => {
    const status = helper.simulateHealthCheck(helper.scenarios.silent());
    expectUnhealthy(status);
  },
};
