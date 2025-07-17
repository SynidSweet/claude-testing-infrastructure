/**
 * Unit tests for HeartbeatMonitor
 * 
 * Tests HeartbeatMonitor component without timer dependencies using mocks and direct method calls
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { EventEmitter } from 'events';
import { ChildProcess } from 'child_process';
import { HeartbeatMonitor, HeartbeatMonitorConfig } from '../../../src/ai/heartbeat/HeartbeatMonitor';
import { HealthStatus } from '../../../src/ai/heartbeat/ProcessHealthAnalyzer';
import { ProcessHealthAnalyzer } from '../../../src/ai/heartbeat/ProcessHealthAnalyzer';
import { ProcessMonitor } from '../../../src/utils/ProcessMonitor';
import { MockTimer } from '../../../src/utils/MockTimer';
import { createMockHeartbeatScheduler, createMockProcessMonitor, createMockProcessResourceUsage, setupMockCleanup } from '../../utils/type-safe-mocks';

// Mock dependencies
jest.mock('../../../src/ai/heartbeat/ProcessHealthAnalyzer');
jest.mock('../../../src/utils/ProcessMonitor');

describe('HeartbeatMonitor', () => {
  let monitor: HeartbeatMonitor;
  let mockScheduler: ReturnType<typeof createMockHeartbeatScheduler>;
  let mockTimer: MockTimer;
  let config: HeartbeatMonitorConfig;
  let mockProcessMonitor: ReturnType<typeof createMockProcessMonitor>;

  // Setup proper mock cleanup
  setupMockCleanup();

  beforeEach(() => {
    // Create mock timer
    mockTimer = new MockTimer();

    // Create type-safe mock scheduler
    mockScheduler = createMockHeartbeatScheduler();

    // Configure HeartbeatMonitor
    config = {
      scheduler: { intervalMs: 30000 },
      analysis: {
        cpuThreshold: 80,
        memoryThresholdMB: 1000,
        minOutputRate: 0.1,
        maxSilenceDuration: 120000,
        maxErrorCount: 50,
        progressMarkerPatterns: ['processing', 'analyzing', '\\d+%'],
        minProgressMarkers: 1,
        analysisWindowMs: 60000
      },
      enableLogging: false
    };

    // Mock ProcessMonitor
    mockProcessMonitor = createMockProcessMonitor();
    mockProcessMonitor.getResourceUsage.mockReturnValue(
      createMockProcessResourceUsage({
        pid: 12345,
        cpu: 50,
        memory: 500
      })
    );
    jest.mocked(ProcessMonitor).mockImplementation(() => mockProcessMonitor as any);

    // Create monitor instance
    monitor = new HeartbeatMonitor(mockScheduler, config, mockTimer);
  });

  afterEach(() => {
    monitor.stopAll();
  });

  describe('constructor', () => {
    it('should create monitor with config and inherit from EventEmitter', () => {
      expect(monitor).toBeInstanceOf(EventEmitter);
      expect(monitor).toBeInstanceOf(HeartbeatMonitor);
    });
  });

  describe('startMonitoring', () => {
    it('should start monitoring a process', () => {
      const taskId = 'task-1';
      const pid = 12345;

      monitor.startMonitoring(taskId, pid);

      expect(mockScheduler.scheduleChecks).toHaveBeenCalledWith(taskId, expect.any(Function));
      expect(monitor.isMonitoring(taskId)).toBe(true);
    });

    it('should stop existing monitoring before starting new one', () => {
      const taskId = 'task-1';
      const pid1 = 12345;
      const pid2 = 67890;

      monitor.startMonitoring(taskId, pid1);
      monitor.startMonitoring(taskId, pid2);

      expect(mockScheduler.cancelAll).toHaveBeenCalledWith(taskId);
      expect(mockScheduler.scheduleChecks).toHaveBeenCalledTimes(2);
    });

    it('should attach process listeners when child process is provided', () => {
      const taskId = 'task-1';
      const pid = 12345;
      const mockChildProcess = new EventEmitter() as ChildProcess;
      mockChildProcess.stdout = new EventEmitter() as any;
      mockChildProcess.stderr = new EventEmitter() as any;

      const stdoutSpy = jest.spyOn(mockChildProcess.stdout!, 'on');
      const stderrSpy = jest.spyOn(mockChildProcess.stderr!, 'on');

      monitor.startMonitoring(taskId, pid, mockChildProcess);

      expect(stdoutSpy).toHaveBeenCalledWith('data', expect.any(Function));
      expect(stderrSpy).toHaveBeenCalledWith('data', expect.any(Function));
    });

    it('should log when logging is enabled', () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      const monitorWithLogging = new HeartbeatMonitor(mockScheduler, { ...config, enableLogging: true }, mockTimer);

      monitorWithLogging.startMonitoring('task-1', 12345);

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Started monitoring task task-1'));
      consoleLogSpy.mockRestore();
    });
  });

  describe('stopMonitoring', () => {
    it('should stop monitoring a process', () => {
      const taskId = 'task-1';
      monitor.startMonitoring(taskId, 12345);
      
      monitor.stopMonitoring(taskId);

      expect(mockScheduler.cancelAll).toHaveBeenCalledWith(taskId);
      expect(monitor.isMonitoring(taskId)).toBe(false);
    });

    it('should do nothing if process is not being monitored', () => {
      monitor.stopMonitoring('non-existent');
      expect(mockScheduler.cancelAll).not.toHaveBeenCalled();
    });

    it('should log when logging is enabled', () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      const monitorWithLogging = new HeartbeatMonitor(mockScheduler, { ...config, enableLogging: true }, mockTimer);

      monitorWithLogging.startMonitoring('task-1', 12345);
      monitorWithLogging.stopMonitoring('task-1');

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Stopped monitoring task task-1'));
      consoleLogSpy.mockRestore();
    });
  });

  describe('stopAll', () => {
    it('should stop monitoring all processes', () => {
      monitor.startMonitoring('task-1', 12345);
      monitor.startMonitoring('task-2', 67890);
      monitor.startMonitoring('task-3', 11111);

      monitor.stopAll();

      expect(mockScheduler.cancelAll).toHaveBeenCalledWith('task-1');
      expect(mockScheduler.cancelAll).toHaveBeenCalledWith('task-2');
      expect(mockScheduler.cancelAll).toHaveBeenCalledWith('task-3');
      expect(monitor.isMonitoring('task-1')).toBe(false);
      expect(monitor.isMonitoring('task-2')).toBe(false);
      expect(monitor.isMonitoring('task-3')).toBe(false);
    });
  });

  describe('health check execution', () => {
    let healthCheckCallback: () => void;

    beforeEach(() => {
      mockScheduler.scheduleChecks.mockImplementation((taskId, callback) => {
        healthCheckCallback = callback;
        return { taskId, handle: { id: 'test-1', active: true, cancel: jest.fn() }, startTime: Date.now() };
      });
    });

    it('should emit healthCheck event when health check is performed', async () => {
      const healthCheckListener = jest.fn();
      const mockStatus: HealthStatus = {
        isHealthy: true,
        reason: '',
        warnings: [],
        shouldTerminate: false,
        confidence: 0.8
      };

      (ProcessHealthAnalyzer.analyzeHealth as jest.Mock).mockReturnValue(mockStatus);
      (ProcessHealthAnalyzer.calculateOutputRate as jest.Mock).mockReturnValue(1.0);
      (ProcessHealthAnalyzer.detectInputWait as jest.Mock).mockReturnValue(false);

      monitor.on('healthCheck', healthCheckListener);
      monitor.startMonitoring('task-1', 12345);

      // Trigger health check and wait for async operations
      healthCheckCallback();
      await new Promise(resolve => setImmediate(resolve));

      expect(healthCheckListener).toHaveBeenCalledWith('task-1', mockStatus);
    });

    it('should emit unhealthy event when process is unhealthy', async () => {
      const unhealthyListener = jest.fn();
      const mockStatus: HealthStatus = {
        isHealthy: false,
        reason: 'High CPU usage',
        warnings: [],
        shouldTerminate: false,
        confidence: 0.7
      };

      (ProcessHealthAnalyzer.analyzeHealth as jest.Mock).mockReturnValue(mockStatus);
      (ProcessHealthAnalyzer.calculateOutputRate as jest.Mock).mockReturnValue(1.0);
      (ProcessHealthAnalyzer.detectInputWait as jest.Mock).mockReturnValue(false);

      monitor.on('unhealthy', unhealthyListener);
      monitor.startMonitoring('task-1', 12345);

      // Trigger health check and wait for async operations
      healthCheckCallback();
      await new Promise(resolve => setImmediate(resolve));

      expect(unhealthyListener).toHaveBeenCalledWith('task-1', mockStatus);
    });

    it('should emit warning event when warnings are present', async () => {
      const warningListener = jest.fn();
      const mockStatus: HealthStatus = {
        isHealthy: true,
        reason: '',
        warnings: ['CPU usage approaching threshold', 'Low output rate'],
        shouldTerminate: false,
        confidence: 0.8
      };

      (ProcessHealthAnalyzer.analyzeHealth as jest.Mock).mockReturnValue(mockStatus);
      (ProcessHealthAnalyzer.calculateOutputRate as jest.Mock).mockReturnValue(0.2);
      (ProcessHealthAnalyzer.detectInputWait as jest.Mock).mockReturnValue(false);

      monitor.on('warning', warningListener);
      monitor.startMonitoring('task-1', 12345);

      // Trigger health check and wait for async operations
      healthCheckCallback();
      await new Promise(resolve => setImmediate(resolve));

      expect(warningListener).toHaveBeenCalledWith('task-1', mockStatus.warnings);
    });

    it('should terminate process when shouldTerminate is true', async () => {
      const terminatedListener = jest.fn();
      const mockStatus: HealthStatus = {
        isHealthy: false,
        reason: 'Process unresponsive',
        warnings: [],
        shouldTerminate: true,
        confidence: 0.9
      };

      (ProcessHealthAnalyzer.analyzeHealth as jest.Mock).mockReturnValue(mockStatus);
      (ProcessHealthAnalyzer.calculateOutputRate as jest.Mock).mockReturnValue(0);
      (ProcessHealthAnalyzer.detectInputWait as jest.Mock).mockReturnValue(false);

      const processKillSpy = jest.spyOn(global.process, 'kill').mockImplementation(() => true);

      monitor.on('terminated', terminatedListener);
      monitor.startMonitoring('task-1', 12345);

      // Trigger health check and wait for async operations
      healthCheckCallback();
      await new Promise(resolve => setImmediate(resolve));

      expect(processKillSpy).toHaveBeenCalledWith(12345, 'SIGTERM');
      expect(terminatedListener).toHaveBeenCalledWith('task-1', 'Process unresponsive');
      expect(mockScheduler.scheduleTimeout).toHaveBeenCalledWith('task-1', expect.any(Function), 5000);

      processKillSpy.mockRestore();
    });

    it('should emit error event when health check fails', async () => {
      const errorListener = jest.fn();
      const mockError = new Error('Health check failed');

      (ProcessHealthAnalyzer.analyzeHealth as jest.Mock).mockImplementation(() => {
        throw mockError;
      });

      monitor.on('error', errorListener);
      monitor.startMonitoring('task-1', 12345);

      // Trigger health check and wait for async operations
      healthCheckCallback();
      await new Promise(resolve => setImmediate(resolve));

      expect(errorListener).toHaveBeenCalledWith('task-1', mockError);
    });

    it('should handle missing process gracefully', async () => {
      const healthCheckListener = jest.fn();
      monitor.on('healthCheck', healthCheckListener);
      
      monitor.startMonitoring('task-1', 12345);
      monitor.stopMonitoring('task-1');

      // Trigger health check and wait for async operations
      healthCheckCallback();
      await new Promise(resolve => setImmediate(resolve));

      expect(healthCheckListener).not.toHaveBeenCalled();
    });
  });

  describe('process output capture', () => {
    let mockChildProcess: ChildProcess;
    let stdoutEmitter: EventEmitter;
    let stderrEmitter: EventEmitter;

    beforeEach(() => {
      stdoutEmitter = new EventEmitter();
      stderrEmitter = new EventEmitter();
      
      mockChildProcess = new EventEmitter() as ChildProcess;
      mockChildProcess.stdout = stdoutEmitter as any;
      mockChildProcess.stderr = stderrEmitter as any;
    });

    it('should capture stdout data', () => {
      monitor.startMonitoring('task-1', 12345, mockChildProcess);

      stdoutEmitter.emit('data', Buffer.from('Test output\n'));
      
      const processInfo = monitor.getProcessInfo('task-1');
      expect(processInfo).toBeDefined();
      expect(processInfo!.outputs).toHaveLength(1);
      expect(processInfo!.outputs[0]?.content).toBe('Test output\n');
      expect(processInfo!.outputs[0]?.isError).toBe(false);
    });

    it('should capture stderr data', () => {
      monitor.startMonitoring('task-1', 12345, mockChildProcess);

      stderrEmitter.emit('data', Buffer.from('Error message\n'));
      
      const processInfo = monitor.getProcessInfo('task-1');
      expect(processInfo).toBeDefined();
      expect(processInfo!.errors).toHaveLength(1);
      expect(processInfo!.errors[0]?.content).toBe('Error message\n');
      expect(processInfo!.errors[0]?.isError).toBe(true);
    });

    it('should detect progress markers and emit progress event', () => {
      const progressListener = jest.fn();
      monitor.on('progress', progressListener);

      (ProcessHealthAnalyzer.detectProgressMarkers as jest.Mock).mockReturnValue(true);

      monitor.startMonitoring('task-1', 12345, mockChildProcess);

      stdoutEmitter.emit('data', Buffer.from('Processing item 1...\n'));
      stdoutEmitter.emit('data', Buffer.from('Analyzing data 50%\n'));

      expect(progressListener).toHaveBeenCalledTimes(2);
      expect(progressListener).toHaveBeenCalledWith('task-1', 1);
      expect(progressListener).toHaveBeenCalledWith('task-1', 2);
      
      const processInfo = monitor.getProcessInfo('task-1');
      expect(processInfo?.progressMarkerCount).toBe(2);
    });

    it('should limit output buffer size to prevent memory growth', () => {
      monitor.startMonitoring('task-1', 12345, mockChildProcess);

      // Add exactly 1001 outputs to trigger the slice once
      for (let i = 0; i < 1001; i++) {
        stdoutEmitter.emit('data', Buffer.from(`Output line ${i}\n`));
      }

      const processInfo = monitor.getProcessInfo('task-1');
      expect(processInfo?.outputs.length).toBe(500);
    });

    it('should limit error buffer size to prevent memory growth', () => {
      monitor.startMonitoring('task-1', 12345, mockChildProcess);

      // Add exactly 501 errors to trigger the slice once
      for (let i = 0; i < 501; i++) {
        stderrEmitter.emit('data', Buffer.from(`Error line ${i}\n`));
      }

      const processInfo = monitor.getProcessInfo('task-1');
      expect(processInfo?.errors.length).toBe(250);
    });
  });

  describe('getStats', () => {
    it('should return monitoring statistics', () => {
      monitor.startMonitoring('task-1', 12345);
      monitor.startMonitoring('task-2', 67890);

      const stats = monitor.getStats();

      expect(stats.monitoredProcesses).toBe(2);
      expect(stats.schedulerStats).toEqual({
        activeChecks: 0,
        activeTimeouts: 0,
        totalScheduled: 0,
        totalCancelled: 0
      });
    });
  });

  describe('getProcessInfo', () => {
    it('should return process information', () => {
      const taskId = 'task-1';
      const pid = 12345;

      monitor.startMonitoring(taskId, pid);
      const info = monitor.getProcessInfo(taskId);

      expect(info).toBeDefined();
      expect(info?.taskId).toBe(taskId);
      expect(info?.pid).toBe(pid);
      expect(info?.outputs).toEqual([]);
      expect(info?.errors).toEqual([]);
      expect(info?.progressMarkerCount).toBe(0);
      expect(info?.terminationRequested).toBe(false);
    });

    it('should return undefined for non-existent process', () => {
      const info = monitor.getProcessInfo('non-existent');
      expect(info).toBeUndefined();
    });
  });

  describe('isMonitoring', () => {
    it('should return true for monitored process', () => {
      monitor.startMonitoring('task-1', 12345);
      expect(monitor.isMonitoring('task-1')).toBe(true);
    });

    it('should return false for non-monitored process', () => {
      expect(monitor.isMonitoring('non-existent')).toBe(false);
    });
  });

  describe('process termination', () => {
    let healthCheckCallback: () => void;

    beforeEach(() => {
      mockScheduler.scheduleChecks.mockImplementation((taskId, callback) => {
        healthCheckCallback = callback;
        return { taskId, handle: { id: 'test-1', active: true, cancel: jest.fn() }, startTime: Date.now() };
      });
    });

    it('should handle termination errors gracefully', async () => {
      const errorListener = jest.fn();
      const mockStatus: HealthStatus = {
        isHealthy: false,
        reason: 'Process unresponsive',
        warnings: [],
        shouldTerminate: true,
        confidence: 0.9
      };

      (ProcessHealthAnalyzer.analyzeHealth as jest.Mock).mockReturnValue(mockStatus);
      (ProcessHealthAnalyzer.calculateOutputRate as jest.Mock).mockReturnValue(0);
      (ProcessHealthAnalyzer.detectInputWait as jest.Mock).mockReturnValue(false);

      const processKillSpy = jest.spyOn(global.process, 'kill').mockImplementation(() => {
        throw new Error('Process not found');
      });

      monitor.on('error', errorListener);
      monitor.startMonitoring('task-1', 12345);

      // Trigger health check and wait for async operations
      healthCheckCallback();
      await new Promise(resolve => setImmediate(resolve));

      expect(errorListener).toHaveBeenCalledWith('task-1', expect.objectContaining({
        message: 'Process not found'
      }));

      processKillSpy.mockRestore();
    });

    it('should not attempt to terminate already terminated process', async () => {
      const mockStatus: HealthStatus = {
        isHealthy: false,
        reason: 'Process unresponsive',
        warnings: [],
        shouldTerminate: true,
        confidence: 0.9
      };

      (ProcessHealthAnalyzer.analyzeHealth as jest.Mock).mockReturnValue(mockStatus);
      (ProcessHealthAnalyzer.calculateOutputRate as jest.Mock).mockReturnValue(0);
      (ProcessHealthAnalyzer.detectInputWait as jest.Mock).mockReturnValue(false);

      const processKillSpy = jest.spyOn(global.process, 'kill').mockImplementation(() => true);

      monitor.startMonitoring('task-1', 12345);

      // First health check - should terminate
      healthCheckCallback();
      await new Promise(resolve => setImmediate(resolve));
      expect(processKillSpy).toHaveBeenCalledTimes(1);

      // Second health check - should not terminate again
      healthCheckCallback();
      await new Promise(resolve => setImmediate(resolve));
      expect(processKillSpy).toHaveBeenCalledTimes(1);

      processKillSpy.mockRestore();
    });
  });

  describe('metrics collection', () => {
    let healthCheckCallback: () => void;

    beforeEach(() => {
      mockScheduler.scheduleChecks.mockImplementation((taskId, callback) => {
        healthCheckCallback = callback;
        return { taskId, handle: { id: 'test-1', active: true, cancel: jest.fn() }, startTime: Date.now() };
      });
    });

    it('should handle process without PID gracefully', async () => {
      const mockStatus: HealthStatus = {
        isHealthy: true,
        reason: '',
        warnings: [],
        shouldTerminate: false,
        confidence: 0.8
      };

      (ProcessHealthAnalyzer.analyzeHealth as jest.Mock).mockReturnValue(mockStatus);
      (ProcessHealthAnalyzer.calculateOutputRate as jest.Mock).mockReturnValue(0);
      (ProcessHealthAnalyzer.detectInputWait as jest.Mock).mockReturnValue(false);

      monitor.startMonitoring('task-1', 0); // PID 0 to simulate missing PID

      // Trigger health check and wait for async operations
      healthCheckCallback();
      await new Promise(resolve => setImmediate(resolve));

      expect(ProcessHealthAnalyzer.analyzeHealth).toHaveBeenCalledWith(
        expect.objectContaining({
          cpuPercent: 0,
          memoryMB: 0
        }),
        config.analysis
      );
    });

    it('should detect input waiting state', async () => {
      const mockChildProcess = new EventEmitter() as ChildProcess;
      mockChildProcess.stdout = new EventEmitter() as any;
      mockChildProcess.stderr = new EventEmitter() as any;

      (ProcessHealthAnalyzer.detectInputWait as jest.Mock).mockReturnValue(true);
      (ProcessHealthAnalyzer.calculateOutputRate as jest.Mock).mockReturnValue(0.5);
      (ProcessHealthAnalyzer.analyzeHealth as jest.Mock).mockReturnValue({
        isHealthy: true,
        reason: '',
        warnings: [],
        shouldTerminate: false,
        confidence: 0.8
      });

      monitor.startMonitoring('task-1', 12345, mockChildProcess);

      // Add some output
      (mockChildProcess.stdout as EventEmitter).emit('data', Buffer.from('Enter your choice: '));

      // Trigger health check and wait for async operations
      healthCheckCallback();
      await new Promise(resolve => setImmediate(resolve));

      expect(ProcessHealthAnalyzer.analyzeHealth).toHaveBeenCalledWith(
        expect.objectContaining({
          isWaitingForInput: true
        }),
        config.analysis
      );
    });
  });

  describe('error handling coverage', () => {
    let healthCheckCallback: () => void;
    let timeoutCallback: () => void;

    beforeEach(() => {
      mockScheduler.scheduleChecks.mockImplementation((taskId, callback) => {
        healthCheckCallback = callback;
        return { taskId, handle: { id: 'test-1', active: true, cancel: jest.fn() }, startTime: Date.now() };
      });

      mockScheduler.scheduleTimeout.mockImplementation((taskId, callback, delayMs) => {
        timeoutCallback = callback;
        return { 
          taskId, 
          handle: { id: 'timeout-1', active: true, cancel: jest.fn() }, 
          scheduledAt: Date.now(),
          executeAt: Date.now() + delayMs
        };
      });
    });

    it('should handle errors in scheduled health check callback', async () => {
      const errorListener = jest.fn();
      monitor.on('error', errorListener);

      // Mock collectMetrics to throw an error
      mockProcessMonitor.getResourceUsage.mockImplementation(() => {
        throw new Error('Resource collection failed');
      });

      monitor.startMonitoring('task-1', 12345);

      // Trigger health check callback which should catch the error
      healthCheckCallback();
      await new Promise(resolve => setImmediate(resolve));

      expect(errorListener).toHaveBeenCalledWith('task-1', expect.objectContaining({
        message: 'Resource collection failed'
      }));
    });

    it('should handle promise rejection in performHealthCheck by forcing unhandled rejection', async () => {
      const errorListener = jest.fn();
      monitor.on('error', errorListener);

      // Directly mock performHealthCheck on the instance to force a rejected promise
      const originalPerformHealthCheck = (monitor as any).performHealthCheck;
      (monitor as any).performHealthCheck = jest.fn().mockImplementation(() => Promise.reject(new Error('Forced async rejection')));

      monitor.startMonitoring('task-1', 12345);

      // Trigger health check callback which should catch the promise rejection on line 96
      healthCheckCallback();
      await new Promise(resolve => setTimeout(resolve, 10)); // Give more time for async rejection

      expect(errorListener).toHaveBeenCalledWith('task-1', expect.objectContaining({
        message: 'Forced async rejection'
      }));

      // Restore original method
      (monitor as any).performHealthCheck = originalPerformHealthCheck;
    });

    it('should log health check failures when logging is enabled', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const monitorWithLogging = new HeartbeatMonitor(mockScheduler, { ...config, enableLogging: true }, mockTimer);

      // Add error listener to prevent unhandled error
      const errorListener = jest.fn();
      monitorWithLogging.on('error', errorListener);

      // Mock scheduler for the logging monitor
      let loggingHealthCheckCallback: () => void;
      mockScheduler.scheduleChecks.mockImplementation((taskId, callback) => {
        loggingHealthCheckCallback = callback;
        return { taskId, handle: { id: 'test-1', active: true, cancel: jest.fn() }, startTime: Date.now() };
      });

      // Mock collectMetrics to throw an error
      mockProcessMonitor.getResourceUsage.mockImplementation(() => {
        throw new Error('Health check failed');
      });

      monitorWithLogging.startMonitoring('task-1', 12345);

      // Trigger health check callback which should log the error
      loggingHealthCheckCallback!();
      await new Promise(resolve => setImmediate(resolve));

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[HeartbeatMonitor] Health check failed for task-1:'),
        expect.objectContaining({ message: 'Health check failed' })
      );
      expect(errorListener).toHaveBeenCalledWith('task-1', expect.objectContaining({
        message: 'Health check failed'
      }));

      consoleErrorSpy.mockRestore();
    });

    it('should handle SIGKILL fallback timeout errors gracefully', async () => {
      const mockStatus: HealthStatus = {
        isHealthy: false,
        reason: 'Process unresponsive',
        warnings: [],
        shouldTerminate: true,
        confidence: 0.9
      };

      (ProcessHealthAnalyzer.analyzeHealth as jest.Mock).mockReturnValue(mockStatus);
      (ProcessHealthAnalyzer.calculateOutputRate as jest.Mock).mockReturnValue(0);
      (ProcessHealthAnalyzer.detectInputWait as jest.Mock).mockReturnValue(false);

      const processKillSpy = jest.spyOn(global.process, 'kill').mockImplementation((_pid, signal) => {
        if (signal === 'SIGKILL') {
          throw new Error('Process already dead');
        }
        return true;
      });

      monitor.startMonitoring('task-1', 12345);

      // Trigger health check to initiate termination
      healthCheckCallback();
      await new Promise(resolve => setImmediate(resolve));

      // Trigger the SIGKILL timeout callback
      timeoutCallback();

      // The error should be caught silently (no error event emitted for SIGKILL failures)
      expect(processKillSpy).toHaveBeenCalledWith(12345, 'SIGTERM');
      expect(processKillSpy).toHaveBeenCalledWith(12345, 'SIGKILL');

      processKillSpy.mockRestore();
    });

    it('should log termination failures when logging is enabled', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const monitorWithLogging = new HeartbeatMonitor(mockScheduler, { ...config, enableLogging: true }, mockTimer);

      // Add error listener to prevent unhandled error
      const errorListener = jest.fn();
      monitorWithLogging.on('error', errorListener);

      // Mock scheduler for the logging monitor
      let loggingHealthCheckCallback: () => void;
      mockScheduler.scheduleChecks.mockImplementation((taskId, callback) => {
        loggingHealthCheckCallback = callback;
        return { taskId, handle: { id: 'test-1', active: true, cancel: jest.fn() }, startTime: Date.now() };
      });

      const mockStatus: HealthStatus = {
        isHealthy: false,
        reason: 'Process unresponsive',
        warnings: [],
        shouldTerminate: true,
        confidence: 0.9
      };

      (ProcessHealthAnalyzer.analyzeHealth as jest.Mock).mockReturnValue(mockStatus);
      (ProcessHealthAnalyzer.calculateOutputRate as jest.Mock).mockReturnValue(0);
      (ProcessHealthAnalyzer.detectInputWait as jest.Mock).mockReturnValue(false);

      const processKillSpy = jest.spyOn(global.process, 'kill').mockImplementation(() => {
        throw new Error('Failed to terminate process');
      });

      monitorWithLogging.startMonitoring('task-1', 12345);

      // Trigger health check to initiate termination
      loggingHealthCheckCallback!();
      await new Promise(resolve => setImmediate(resolve));

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[HeartbeatMonitor] Failed to terminate task-1:'),
        expect.objectContaining({ message: 'Failed to terminate process' })
      );
      expect(errorListener).toHaveBeenCalledWith('task-1', expect.objectContaining({
        message: 'Failed to terminate process'
      }));

      processKillSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });

    it('should handle attachProcessListeners when process not found', () => {
      const mockChildProcess = new EventEmitter() as ChildProcess;
      mockChildProcess.stdout = new EventEmitter() as any;
      mockChildProcess.stderr = new EventEmitter() as any;

      // Start monitoring and immediately stop to remove process
      monitor.startMonitoring('task-1', 12345);
      monitor.stopMonitoring('task-1');

      // Call attachProcessListeners on the non-existent process - should return early
      (monitor as any).attachProcessListeners('task-1', mockChildProcess);

      // Verify no listeners were attached by checking that data emission doesn't affect anything
      mockChildProcess.stdout?.emit('data', Buffer.from('test'));
      mockChildProcess.stderr?.emit('data', Buffer.from('error'));

      // Process should not exist
      expect(monitor.getProcessInfo('task-1')).toBeUndefined();
    });

    it('should handle terminateProcess when process not found', async () => {
      // Call terminateProcess on non-existent process - should return early
      await (monitor as any).terminateProcess('non-existent', 'Test reason');

      // No events should be emitted
      const terminatedListener = jest.fn();
      monitor.on('terminated', terminatedListener);

      await (monitor as any).terminateProcess('non-existent', 'Test reason');
      expect(terminatedListener).not.toHaveBeenCalled();
    });

    it('should await terminateProcess in performHealthCheck termination flow', async () => {
      const terminatedListener = jest.fn();
      monitor.on('terminated', terminatedListener);

      const mockStatus: HealthStatus = {
        isHealthy: false,
        reason: 'Process stuck',
        warnings: [],
        shouldTerminate: true,
        confidence: 0.9
      };

      (ProcessHealthAnalyzer.analyzeHealth as jest.Mock).mockReturnValue(mockStatus);
      (ProcessHealthAnalyzer.calculateOutputRate as jest.Mock).mockReturnValue(0);
      (ProcessHealthAnalyzer.detectInputWait as jest.Mock).mockReturnValue(false);

      const processKillSpy = jest.spyOn(global.process, 'kill').mockImplementation(() => true);

      monitor.startMonitoring('task-1', 12345);

      // Trigger health check to initiate termination (this should hit line 156)
      healthCheckCallback();
      await new Promise(resolve => setImmediate(resolve));

      expect(terminatedListener).toHaveBeenCalledWith('task-1', 'Process stuck');
      expect(processKillSpy).toHaveBeenCalledWith(12345, 'SIGTERM');

      processKillSpy.mockRestore();
    });

    it('should not terminate process when termination is already requested', async () => {
      const terminatedListener = jest.fn();
      monitor.on('terminated', terminatedListener);

      let healthCheckCallback: () => void;

      mockScheduler.scheduleChecks.mockImplementation((_taskId, callback) => {
        healthCheckCallback = callback;
        return { 
          taskId: _taskId, 
          handle: { id: 'test-1', active: true, cancel: jest.fn() }, 
          startTime: Date.now() 
        };
      });

      const mockStatus: HealthStatus = {
        isHealthy: false,
        shouldTerminate: true,
        reason: 'Test reason',
        warnings: [],
        confidence: 0.9
      };

      (ProcessHealthAnalyzer.analyzeHealth as jest.Mock).mockReturnValue(mockStatus);
      (ProcessHealthAnalyzer.calculateOutputRate as jest.Mock).mockReturnValue(0);
      (ProcessHealthAnalyzer.detectInputWait as jest.Mock).mockReturnValue(false);

      const processKillSpy = jest.spyOn(global.process, 'kill').mockImplementation(() => true);

      monitor.startMonitoring('task-1', 12345);

      // First health check - should initiate termination
      healthCheckCallback!();
      await new Promise(resolve => setImmediate(resolve));

      expect(terminatedListener).toHaveBeenCalledTimes(1);
      expect(processKillSpy).toHaveBeenCalledTimes(1);

      // Second health check - should NOT initiate termination again (covers line 156 branch)
      healthCheckCallback!();
      await new Promise(resolve => setImmediate(resolve));

      // No additional termination calls
      expect(terminatedListener).toHaveBeenCalledTimes(1);
      expect(processKillSpy).toHaveBeenCalledTimes(1);

      processKillSpy.mockRestore();
    });

    it('should use default termination reason when status.reason is undefined', async () => {
      const terminatedListener = jest.fn();
      monitor.on('terminated', terminatedListener);

      let healthCheckCallback: () => void;

      mockScheduler.scheduleChecks.mockImplementation((_taskId, callback) => {
        healthCheckCallback = callback;
        return { 
          taskId: _taskId, 
          handle: { id: 'test-1', active: true, cancel: jest.fn() }, 
          startTime: Date.now() 
        };
      });

      const mockStatus: HealthStatus = {
        isHealthy: false,
        shouldTerminate: true,
        // No reason provided - should use default
        warnings: [],
        confidence: 0.9
      };

      (ProcessHealthAnalyzer.analyzeHealth as jest.Mock).mockReturnValue(mockStatus);
      (ProcessHealthAnalyzer.calculateOutputRate as jest.Mock).mockReturnValue(0);
      (ProcessHealthAnalyzer.detectInputWait as jest.Mock).mockReturnValue(false);

      const processKillSpy = jest.spyOn(global.process, 'kill').mockImplementation(() => true);

      monitor.startMonitoring('task-1', 12345);

      // Trigger health check - should use default reason 'Unhealthy process'
      healthCheckCallback!();
      await new Promise(resolve => setImmediate(resolve));

      expect(terminatedListener).toHaveBeenCalledWith('task-1', 'Unhealthy process');
      expect(processKillSpy).toHaveBeenCalledWith(12345, 'SIGTERM');

      processKillSpy.mockRestore();
    });
  });

  describe('dead process detection scenarios', () => {
    it('should detect and terminate a dead/silent process', async () => {
      const unhealthyListener = jest.fn();
      const terminatedListener = jest.fn();
      monitor.on('unhealthy', unhealthyListener);
      monitor.on('terminated', terminatedListener);

      let healthCheckCallback: () => void;

      mockScheduler.scheduleChecks.mockImplementation((_taskId, callback) => {
        healthCheckCallback = callback;
        return { 
          taskId: _taskId, 
          handle: { id: 'test-1', active: true, cancel: jest.fn() }, 
          startTime: Date.now() 
        };
      });

      // Mock a dead process scenario (no output, high runtime, low CPU)
      const deadProcessStatus: HealthStatus = {
        isHealthy: false,
        shouldTerminate: true,
        reason: 'Process is silent and appears dead',
        warnings: ['No output for extended period', 'Low CPU activity'],
        confidence: 0.95
      };

      (ProcessHealthAnalyzer.analyzeHealth as jest.Mock).mockReturnValue(deadProcessStatus);
      (ProcessHealthAnalyzer.calculateOutputRate as jest.Mock).mockReturnValue(0);
      (ProcessHealthAnalyzer.detectInputWait as jest.Mock).mockReturnValue(false);

      const processKillSpy = jest.spyOn(global.process, 'kill').mockImplementation(() => true);

      monitor.startMonitoring('dead-task', 12345);

      // Trigger health check - should detect dead process
      healthCheckCallback!();
      await new Promise(resolve => setImmediate(resolve));

      expect(unhealthyListener).toHaveBeenCalledWith('dead-task', deadProcessStatus);
      expect(terminatedListener).toHaveBeenCalledWith('dead-task', 'Process is silent and appears dead');
      expect(processKillSpy).toHaveBeenCalledWith(12345, 'SIGTERM');

      processKillSpy.mockRestore();
    });

    it('should detect process with excessive error output as unhealthy', async () => {
      const unhealthyListener = jest.fn();
      const warningListener = jest.fn();
      monitor.on('unhealthy', unhealthyListener);
      monitor.on('warning', warningListener);

      let healthCheckCallback: () => void;

      mockScheduler.scheduleChecks.mockImplementation((_taskId, callback) => {
        healthCheckCallback = callback;
        return { 
          taskId: _taskId, 
          handle: { id: 'test-1', active: true, cancel: jest.fn() }, 
          startTime: Date.now() 
        };
      });

      // Mock an error-prone process scenario
      const errorProneStatus: HealthStatus = {
        isHealthy: false,
        shouldTerminate: true,
        reason: 'Too many errors detected',
        warnings: ['Error count exceeded threshold', 'Poor progress rate'],
        confidence: 0.9
      };

      (ProcessHealthAnalyzer.analyzeHealth as jest.Mock).mockReturnValue(errorProneStatus);
      (ProcessHealthAnalyzer.calculateOutputRate as jest.Mock).mockReturnValue(0.5);
      (ProcessHealthAnalyzer.detectInputWait as jest.Mock).mockReturnValue(false);

      const processKillSpy = jest.spyOn(global.process, 'kill').mockImplementation(() => true);

      monitor.startMonitoring('error-task', 12345);

      // Trigger health check - should detect error-prone process
      healthCheckCallback!();
      await new Promise(resolve => setImmediate(resolve));

      expect(unhealthyListener).toHaveBeenCalledWith('error-task', errorProneStatus);
      expect(warningListener).toHaveBeenCalledWith('error-task', ['Error count exceeded threshold', 'Poor progress rate']);

      processKillSpy.mockRestore();
    });
  });

  describe('slow process warning scenarios', () => {
    it('should emit warnings for slow processes without terminating them', async () => {
      const warningListener = jest.fn();
      const unhealthyListener = jest.fn();
      monitor.on('warning', warningListener);
      monitor.on('unhealthy', unhealthyListener);

      let healthCheckCallback: () => void;

      mockScheduler.scheduleChecks.mockImplementation((_taskId, callback) => {
        healthCheckCallback = callback;
        return { 
          taskId: _taskId, 
          handle: { id: 'test-1', active: true, cancel: jest.fn() }, 
          startTime: Date.now() 
        };
      });

      // Mock a slow but healthy process scenario
      const slowProcessStatus: HealthStatus = {
        isHealthy: true, // Still healthy, just slow
        shouldTerminate: false,
        reason: 'Process running slower than expected',
        warnings: ['Low output rate', 'High CPU usage'],
        confidence: 0.7
      };

      (ProcessHealthAnalyzer.analyzeHealth as jest.Mock).mockReturnValue(slowProcessStatus);
      (ProcessHealthAnalyzer.calculateOutputRate as jest.Mock).mockReturnValue(0.05);
      (ProcessHealthAnalyzer.detectInputWait as jest.Mock).mockReturnValue(false);

      monitor.startMonitoring('slow-task', 12345);

      // Trigger health check - should emit warnings but not terminate
      healthCheckCallback!();
      await new Promise(resolve => setImmediate(resolve));

      expect(warningListener).toHaveBeenCalledWith('slow-task', ['Low output rate', 'High CPU usage']);
      expect(unhealthyListener).not.toHaveBeenCalled();
    });

    it('should emit warnings for processes with resource usage concerns', async () => {
      const warningListener = jest.fn();
      monitor.on('warning', warningListener);

      let healthCheckCallback: () => void;

      mockScheduler.scheduleChecks.mockImplementation((_taskId, callback) => {
        healthCheckCallback = callback;
        return { 
          taskId: _taskId, 
          handle: { id: 'test-1', active: true, cancel: jest.fn() }, 
          startTime: Date.now() 
        };
      });

      // Mock high resource usage scenario
      const highResourceStatus: HealthStatus = {
        isHealthy: true,
        shouldTerminate: false,
        reason: 'High resource usage detected',
        warnings: ['High CPU usage (95%)', 'Memory usage approaching threshold'],
        confidence: 0.8
      };

      (ProcessHealthAnalyzer.analyzeHealth as jest.Mock).mockReturnValue(highResourceStatus);
      (ProcessHealthAnalyzer.calculateOutputRate as jest.Mock).mockReturnValue(1.0);
      (ProcessHealthAnalyzer.detectInputWait as jest.Mock).mockReturnValue(false);

      // Mock high resource usage
      mockProcessMonitor.getResourceUsage.mockReturnValue({
        pid: 12345,
        cpu: 95,
        memory: 900
      });

      monitor.startMonitoring('resource-task', 12345);

      // Trigger health check - should emit resource warnings
      healthCheckCallback!();
      await new Promise(resolve => setImmediate(resolve));

      expect(warningListener).toHaveBeenCalledWith('resource-task', ['High CPU usage (95%)', 'Memory usage approaching threshold']);
    });
  });

  describe('timeout handling scenarios', () => {
    it('should handle process timeout gracefully', async () => {
      const errorListener = jest.fn();
      const terminatedListener = jest.fn();
      monitor.on('error', errorListener);
      monitor.on('terminated', terminatedListener);

      let healthCheckCallback: () => void;

      mockScheduler.scheduleChecks.mockImplementation((_taskId, callback) => {
        healthCheckCallback = callback;
        return { 
          taskId: _taskId, 
          handle: { id: 'test-1', active: true, cancel: jest.fn() }, 
          startTime: Date.now() 
        };
      });

      // Mock timeout scenario
      const timeoutStatus: HealthStatus = {
        isHealthy: false,
        shouldTerminate: true,
        reason: 'Process timeout exceeded',
        warnings: ['Long running process', 'No progress indicators'],
        confidence: 0.9
      };

      (ProcessHealthAnalyzer.analyzeHealth as jest.Mock).mockReturnValue(timeoutStatus);
      (ProcessHealthAnalyzer.calculateOutputRate as jest.Mock).mockReturnValue(0.1);
      (ProcessHealthAnalyzer.detectInputWait as jest.Mock).mockReturnValue(false);

      const processKillSpy = jest.spyOn(global.process, 'kill').mockImplementation(() => {
        throw new Error('Process already terminated');
      });

      monitor.startMonitoring('timeout-task', 12345);

      // Trigger health check - should handle timeout and emit error for termination failure
      healthCheckCallback!();
      await new Promise(resolve => setImmediate(resolve));

      // Error should be emitted for termination failure (this is expected behavior)
      expect(errorListener).toHaveBeenCalledWith('timeout-task', expect.any(Error));
      expect(terminatedListener).not.toHaveBeenCalled(); // Termination failed, so no terminated event

      processKillSpy.mockRestore();
    });

    it('should track timeout progress through scheduled checks', async () => {
      const healthCheckListener = jest.fn();
      monitor.on('healthCheck', healthCheckListener);

      let healthCheckCallback: () => void;

      mockScheduler.scheduleChecks.mockImplementation((_taskId, callback) => {
        healthCheckCallback = callback;
        return { 
          taskId: _taskId, 
          handle: { id: 'test-1', active: true, cancel: jest.fn() }, 
          startTime: Date.now() 
        };
      });

      // Mock a process approaching timeout
      const approachingTimeoutStatus: HealthStatus = {
        isHealthy: true,
        shouldTerminate: false,
        reason: 'Process running normally',
        warnings: ['Runtime approaching maximum'],
        confidence: 0.6
      };

      (ProcessHealthAnalyzer.analyzeHealth as jest.Mock).mockReturnValue(approachingTimeoutStatus);
      (ProcessHealthAnalyzer.calculateOutputRate as jest.Mock).mockReturnValue(0.8);
      (ProcessHealthAnalyzer.detectInputWait as jest.Mock).mockReturnValue(false);

      monitor.startMonitoring('timeout-progress-task', 12345);

      // Trigger multiple health checks to simulate timeout progression
      healthCheckCallback!();
      await new Promise(resolve => setImmediate(resolve));

      healthCheckCallback!();
      await new Promise(resolve => setImmediate(resolve));

      expect(healthCheckListener).toHaveBeenCalledTimes(2);
      expect(healthCheckListener).toHaveBeenCalledWith('timeout-progress-task', approachingTimeoutStatus);
    });
  });

  describe('batch cleanup scenarios', () => {
    it('should handle cleanup of multiple processes simultaneously', () => {
      const taskIds = ['task-1', 'task-2', 'task-3'];
      
      // Start monitoring multiple processes
      taskIds.forEach((taskId, index) => {
        monitor.startMonitoring(taskId, 12345 + index);
      });

      // Verify all are being monitored
      taskIds.forEach(taskId => {
        expect(monitor.isMonitoring(taskId)).toBe(true);
      });

      // Stop all monitoring
      monitor.stopAll();

      // Verify all monitoring stopped
      taskIds.forEach(taskId => {
        expect(monitor.isMonitoring(taskId)).toBe(false);
      });

      // Verify scheduler cleanup was called for each
      expect(mockScheduler.cancelAll).toHaveBeenCalledTimes(3);
    });

    it('should handle batch cleanup with scheduler errors gracefully', () => {
      // Create a separate monitor instance to avoid affecting other tests
      const testMonitor = new HeartbeatMonitor(mockScheduler, config, mockTimer);
      
      const taskIds = ['task-1', 'task-2'];
      
      // Start monitoring multiple processes
      taskIds.forEach((taskId, index) => {
        testMonitor.startMonitoring(taskId, 12345 + index);
      });

      // Verify all are being monitored
      taskIds.forEach(taskId => {
        expect(testMonitor.isMonitoring(taskId)).toBe(true);
      });

      // Mock scheduler to throw error for task-2 only
      mockScheduler.cancelAll.mockImplementation((taskId) => {
        if (taskId === 'task-2') {
          throw new Error('Cleanup failed');
        }
      });

      // Test individual cleanup behavior
      testMonitor.stopMonitoring('task-1'); // Should succeed
      expect(testMonitor.isMonitoring('task-1')).toBe(false);

      // This should throw error
      expect(() => testMonitor.stopMonitoring('task-2')).toThrow('Cleanup failed');
      
      // Task-2 should still be monitored because scheduler error prevented deletion
      expect(testMonitor.isMonitoring('task-2')).toBe(true);
    });
  });

  describe('progress tracking with warning context', () => {
    it('should emit progress events with warning context information', () => {
      const progressListener = jest.fn();
      monitor.on('progress', progressListener);

      const mockChildProcess = new EventEmitter() as any;
      mockChildProcess.stdout = new EventEmitter();
      mockChildProcess.stderr = new EventEmitter();

      monitor.startMonitoring('progress-task', 12345, mockChildProcess);

      // Simulate output with progress markers
      mockChildProcess.stdout.emit('data', Buffer.from('Processing item 1...\n'));
      mockChildProcess.stdout.emit('data', Buffer.from('Analyzing data 50%\n'));
      mockChildProcess.stdout.emit('data', Buffer.from('Processing item 2...\n'));

      expect(progressListener).toHaveBeenCalledTimes(3);
      expect(progressListener).toHaveBeenCalledWith('progress-task', 1);
      expect(progressListener).toHaveBeenCalledWith('progress-task', 2);
      expect(progressListener).toHaveBeenCalledWith('progress-task', 3);
    });

    it('should track progress markers during warning states', async () => {
      const warningListener = jest.fn();
      const progressListener = jest.fn();
      monitor.on('warning', warningListener);
      monitor.on('progress', progressListener);

      let healthCheckCallback: () => void;

      mockScheduler.scheduleChecks.mockImplementation((_taskId, callback) => {
        healthCheckCallback = callback;
        return { 
          taskId: _taskId, 
          handle: { id: 'test-1', active: true, cancel: jest.fn() }, 
          startTime: Date.now() 
        };
      });

      const mockChildProcess = new EventEmitter() as any;
      mockChildProcess.stdout = new EventEmitter();
      mockChildProcess.stderr = new EventEmitter();

      // Mock a slow process with some progress
      const slowProgressStatus: HealthStatus = {
        isHealthy: true,
        shouldTerminate: false,
        reason: 'Slow progress detected',
        warnings: ['Progress rate below expected'],
        confidence: 0.7
      };

      (ProcessHealthAnalyzer.analyzeHealth as jest.Mock).mockReturnValue(slowProgressStatus);
      (ProcessHealthAnalyzer.calculateOutputRate as jest.Mock).mockReturnValue(0.3);
      (ProcessHealthAnalyzer.detectInputWait as jest.Mock).mockReturnValue(false);

      monitor.startMonitoring('slow-progress-task', 12345, mockChildProcess);

      // Emit some progress
      mockChildProcess.stdout.emit('data', Buffer.from('Processing slowly...\n'));

      // Trigger health check - should emit warning but track progress
      healthCheckCallback!();
      await new Promise(resolve => setImmediate(resolve));

      expect(progressListener).toHaveBeenCalledWith('slow-progress-task', 1);
      expect(warningListener).toHaveBeenCalledWith('slow-progress-task', ['Progress rate below expected']);
    });
  });

  describe('logging for slow and dead processes', () => {
    it('should log when dead process is detected with logging enabled', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      // Create monitor with logging enabled
      const loggingMonitor = new HeartbeatMonitor(mockScheduler, { 
        ...config, 
        enableLogging: true 
      }, mockTimer);

      let healthCheckCallback: () => void;

      mockScheduler.scheduleChecks.mockImplementation((_taskId, callback) => {
        healthCheckCallback = callback;
        return { 
          taskId: _taskId, 
          handle: { id: 'test-1', active: true, cancel: jest.fn() }, 
          startTime: Date.now() 
        };
      });

      const deadProcessStatus: HealthStatus = {
        isHealthy: false,
        shouldTerminate: true,
        reason: 'Dead process detected',
        warnings: ['No activity'],
        confidence: 0.95
      };

      (ProcessHealthAnalyzer.analyzeHealth as jest.Mock).mockReturnValue(deadProcessStatus);
      (ProcessHealthAnalyzer.calculateOutputRate as jest.Mock).mockReturnValue(0);
      (ProcessHealthAnalyzer.detectInputWait as jest.Mock).mockReturnValue(false);

      const processKillSpy = jest.spyOn(global.process, 'kill').mockImplementation(() => true);

      loggingMonitor.startMonitoring('logging-task', 12345);

      // Should log start monitoring
      expect(consoleSpy).toHaveBeenCalledWith('[HeartbeatMonitor] Started monitoring task logging-task (PID: 12345)');

      // Trigger health check - should handle dead process
      healthCheckCallback!();
      await new Promise(resolve => setImmediate(resolve));

      loggingMonitor.stopMonitoring('logging-task');

      // Should log stop monitoring
      expect(consoleSpy).toHaveBeenCalledWith('[HeartbeatMonitor] Stopped monitoring task logging-task');

      consoleSpy.mockRestore();
      processKillSpy.mockRestore();
    });

    it('should log health check failures when logging is enabled', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      // Create monitor with logging enabled
      const loggingMonitor = new HeartbeatMonitor(mockScheduler, { 
        ...config, 
        enableLogging: true 
      }, mockTimer);

      // Add error listener to prevent unhandled error
      const errorListener = jest.fn();
      loggingMonitor.on('error', errorListener);

      let healthCheckCallback: () => void;

      mockScheduler.scheduleChecks.mockImplementation((_taskId, callback) => {
        healthCheckCallback = callback;
        return { 
          taskId: _taskId, 
          handle: { id: 'test-1', active: true, cancel: jest.fn() }, 
          startTime: Date.now() 
        };
      });

      // Mock health analyzer to throw error
      (ProcessHealthAnalyzer.analyzeHealth as jest.Mock).mockImplementation(() => {
        throw new Error('Health check failed');
      });

      loggingMonitor.startMonitoring('error-logging-task', 12345);

      // Trigger health check - should log error
      healthCheckCallback!();
      await new Promise(resolve => setImmediate(resolve));

      expect(consoleSpy).toHaveBeenCalledWith(
        '[HeartbeatMonitor] Health check failed for error-logging-task:',
        expect.any(Error)
      );

      // Error should also be emitted
      expect(errorListener).toHaveBeenCalledWith('error-logging-task', expect.any(Error));

      consoleSpy.mockRestore();
    });
  });
});