/**
 * Unit tests for ProcessPoolManager
 *
 * Tests process lifecycle management, heartbeat monitoring, and resource tracking.
 */

import { ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import {
  ProcessPoolManager,
  type ProcessPoolConfig,
} from '../../src/ai/services/ProcessPoolManager';
import { type TestableTimer, type TimerHandle } from '../../src/types/timer-types';
import { type ProcessResourceUsage } from '../../src/utils/ProcessMonitor';
import type { MockProcessMonitor, MockHeartbeatMonitor } from '../types/mock-interfaces';

// Mock dependencies
jest.mock('../../src/utils/ProcessMonitor');
jest.mock('../../src/ai/heartbeat/HeartbeatMonitor');
jest.mock('../../src/ai/heartbeat/ClaudeOrchestratorIntegration');
jest.mock('../../src/utils/TimerFactory');

describe('ProcessPoolManager', () => {
  let processPoolManager: ProcessPoolManager;
  let mockTimer: TestableTimer;
  let mockProcess: jest.Mocked<ChildProcess>;
  let mockProcessMonitor: MockProcessMonitor;
  let mockHeartbeatMonitor: MockHeartbeatMonitor;
  let mockHeartbeatAdapter: jest.Mocked<any>;

  beforeEach(() => {
    // Setup mock timer
    mockTimer = {
      getCurrentTime: jest.fn(() => Date.now()),
      schedule: jest.fn((callback: () => void, delay: number) => {
        const handle: TimerHandle = {
          cancel: jest.fn(),
          id: 'test-timer-' + Math.random(),
          active: true,
        };
        setTimeout(callback, delay);
        return handle;
      }),
      scheduleInterval: jest.fn(),
      scheduleImmediate: jest.fn(),
      cancelAll: jest.fn(),
      getActiveTimerCount: jest.fn(() => 0),
      getActiveTimerIds: jest.fn(() => []),
    };

    // Setup mock process
    mockProcess = {
      pid: 12345,
      killed: false,
      kill: jest.fn(),
      stdout: new EventEmitter(),
      stderr: new EventEmitter(),
      stdin: {
        write: jest.fn(),
        end: jest.fn(),
      },
      on: jest.fn(),
      once: jest.fn(),
      removeListener: jest.fn(),
      removeAllListeners: jest.fn(),
    } as any;

    // Setup mock process monitor
    mockProcessMonitor = {
      startMonitoring: jest.fn(),
      stopMonitoring: jest.fn(),
      getProcessHealth: jest.fn((_pid: number) => ({
        pid: _pid,
        status: 'healthy' as const,
        cpuUsage: 50,
        memoryUsage: 100,
        lastHeartbeat: new Date()
      })),
      isHealthy: jest.fn((_pid: number) => true),
      getStatistics: jest.fn(() => ({
        totalProcesses: 1,
        healthyProcesses: 1,
        unhealthyProcesses: 0,
        averageCpuUsage: 50,
        averageMemoryUsage: 100
      })),
      getResourceUsage: jest.fn(),
      getHealthMetrics: jest.fn(),
      stopAll: jest.fn()
    };

    // Setup mock heartbeat components
    mockHeartbeatMonitor = {
      startHeartbeat: jest.fn(),
      stopHeartbeat: jest.fn(),
      getLastHeartbeat: jest.fn((_pid: number) => new Date()),
      isHeartbeatHealthy: jest.fn((_pid: number) => true),
      getHeartbeatStatistics: jest.fn(() => ({
        totalHeartbeats: 10,
        missedHeartbeats: 0,
        averageInterval: 1000,
        healthyProcesses: 1
      }))
    };

    mockHeartbeatAdapter = {
      startMonitoring: jest.fn(),
      stopMonitoring: jest.fn(),
    };

    // Mock the module imports
    require('../../src/utils/ProcessMonitor').ProcessMonitor.mockImplementation(() => mockProcessMonitor);
    require('../../src/ai/heartbeat/ClaudeOrchestratorIntegration').createHeartbeatMonitor.mockReturnValue(mockHeartbeatMonitor);
    require('../../src/ai/heartbeat/ClaudeOrchestratorIntegration').HeartbeatMonitorAdapter.mockImplementation(() => mockHeartbeatAdapter);
    require('../../src/ai/heartbeat/ClaudeOrchestratorIntegration').setupEventMapping.mockImplementation(() => {});
    require('../../src/utils/TimerFactory').createAutoTimer.mockReturnValue(mockTimer);

    // Create ProcessPoolManager instance
    const config: ProcessPoolConfig = {
      maxConcurrent: 3,
      timeout: 30000,
      timerService: mockTimer,
    };
    processPoolManager = new ProcessPoolManager(config);
  });

  afterEach(() => {
    processPoolManager.cleanup();
    jest.clearAllMocks();
  });

  describe('Process Registration', () => {
    test('should register a new process successfully', () => {
      const taskId = 'test-task-1';

      processPoolManager.registerProcess(taskId, mockProcess);

      expect(processPoolManager.getActiveTaskIds()).toContain(taskId);
      expect(processPoolManager.getActiveProcessCount()).toBe(1);
      expect(mockHeartbeatAdapter.startMonitoring).toHaveBeenCalledWith(taskId, mockProcess);
      expect(mockProcessMonitor.startMonitoring).toHaveBeenCalledWith(mockProcess.pid);
    });

    test('should throw error when registering duplicate taskId', () => {
      const taskId = 'test-task-1';

      processPoolManager.registerProcess(taskId, mockProcess);

      expect(() => {
        processPoolManager.registerProcess(taskId, mockProcess);
      }).toThrow(`Process with taskId ${taskId} is already registered`);
    });

    test('should emit process-started event on registration', () => {
      const taskId = 'test-task-1';
      const eventSpy = jest.fn();
      processPoolManager.on('process-started', eventSpy);

      processPoolManager.registerProcess(taskId, mockProcess);

      expect(eventSpy).toHaveBeenCalledWith({ taskId, process: mockProcess });
    });
  });

  describe('Process Unregistration', () => {
    test('should unregister a process successfully', () => {
      const taskId = 'test-task-1';

      // Register first
      processPoolManager.registerProcess(taskId, mockProcess);
      expect(processPoolManager.getActiveProcessCount()).toBe(1);

      // Unregister
      processPoolManager.unregisterProcess(taskId);

      expect(processPoolManager.getActiveTaskIds()).not.toContain(taskId);
      expect(processPoolManager.getActiveProcessCount()).toBe(0);
      expect(mockHeartbeatAdapter.stopMonitoring).toHaveBeenCalledWith(taskId);
      expect(mockProcessMonitor.stopMonitoring).toHaveBeenCalledWith(mockProcess.pid);
    });

    test('should handle unregistering non-existent process gracefully', () => {
      const taskId = 'non-existent-task';

      expect(() => {
        processPoolManager.unregisterProcess(taskId);
      }).not.toThrow();

      expect(processPoolManager.getActiveProcessCount()).toBe(0);
    });
  });

  describe('Process Information', () => {
    test('should return process info for registered process', () => {
      const taskId = 'test-task-1';

      processPoolManager.registerProcess(taskId, mockProcess);
      const processInfo = processPoolManager.getProcessInfo(taskId);

      expect(processInfo).toBeDefined();
      expect(processInfo!.taskId).toBe(taskId);
      expect(processInfo!.process).toBe(mockProcess);
      expect(processInfo!.startTime).toBeInstanceOf(Date);
      expect(processInfo!.heartbeat).toBeDefined();
      expect(processInfo!.heartbeat.taskId).toBe(taskId);
    });

    test('should return undefined for non-existent process', () => {
      const taskId = 'non-existent-task';

      const processInfo = processPoolManager.getProcessInfo(taskId);

      expect(processInfo).toBeUndefined();
    });

    test('should return correct active task IDs', () => {
      const taskIds = ['task-1', 'task-2', 'task-3'];
      const mockProcesses = taskIds.map(() => ({ ...mockProcess, pid: Math.floor(Math.random() * 10000) }));

      taskIds.forEach((taskId, index) => {
        processPoolManager.registerProcess(taskId, mockProcesses[index]);
      });

      const activeTaskIds = processPoolManager.getActiveTaskIds();
      expect(activeTaskIds).toHaveLength(3);
      expect(activeTaskIds).toEqual(expect.arrayContaining(taskIds));
    });
  });

  describe('Capacity Management', () => {
    test('should track process count correctly', () => {
      expect(processPoolManager.getActiveProcessCount()).toBe(0);

      processPoolManager.registerProcess('task-1', mockProcess);
      expect(processPoolManager.getActiveProcessCount()).toBe(1);

      processPoolManager.registerProcess('task-2', { ...mockProcess, pid: 12346 });
      expect(processPoolManager.getActiveProcessCount()).toBe(2);

      processPoolManager.unregisterProcess('task-1');
      expect(processPoolManager.getActiveProcessCount()).toBe(1);
    });

    test('should detect max capacity correctly', () => {
      const config: ProcessPoolConfig = { maxConcurrent: 2, timerService: mockTimer };
      const poolManager = new ProcessPoolManager(config);

      expect(poolManager.isAtMaxCapacity()).toBe(false);

      poolManager.registerProcess('task-1', mockProcess);
      expect(poolManager.isAtMaxCapacity()).toBe(false);

      poolManager.registerProcess('task-2', { ...mockProcess, pid: 12346 });
      expect(poolManager.isAtMaxCapacity()).toBe(true);

      poolManager.cleanup();
    });

    test('should use default max capacity when not specified', () => {
      const poolManager = new ProcessPoolManager({ timerService: mockTimer });

      // Default should be 3
      for (let i = 0; i < 3; i++) {
        poolManager.registerProcess(`task-${i}`, { ...mockProcess, pid: 12345 + i });
      }

      expect(poolManager.isAtMaxCapacity()).toBe(true);
      poolManager.cleanup();
    });
  });

  describe('Process Killing', () => {
    test('should kill a specific process successfully', () => {
      const taskId = 'test-task-1';
      const eventSpy = jest.fn();
      processPoolManager.on('process-killed', eventSpy);

      processPoolManager.registerProcess(taskId, mockProcess);
      const result = processPoolManager.killProcess(taskId);

      expect(result).toBe(true);
      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');
      expect(processPoolManager.getActiveProcessCount()).toBe(0);
      expect(eventSpy).toHaveBeenCalledWith({ taskId });
    });

    test('should return false when killing non-existent process', () => {
      const taskId = 'non-existent-task';

      const result = processPoolManager.killProcess(taskId);

      expect(result).toBe(false);
      expect(mockProcess.kill).not.toHaveBeenCalled();
    });

    test('should schedule SIGKILL after timeout for unresponsive process', () => {
      const taskId = 'test-task-1';

      processPoolManager.registerProcess(taskId, mockProcess);
      processPoolManager.killProcess(taskId);

      expect(mockTimer.schedule).toHaveBeenCalledWith(expect.any(Function), 5000);
    });

    test('should kill all processes', () => {
      const taskIds = ['task-1', 'task-2', 'task-3'];
      const mockProcesses = taskIds.map((_, index) => ({
        ...mockProcess,
        pid: 12345 + index,
        kill: jest.fn(),
      }));

      taskIds.forEach((taskId, index) => {
        processPoolManager.registerProcess(taskId, mockProcesses[index]);
      });

      processPoolManager.killAllProcesses();

      expect(processPoolManager.getActiveProcessCount()).toBe(0);
      mockProcesses.forEach((proc) => {
        expect(proc.kill).toHaveBeenCalledWith('SIGTERM');
      });
    });
  });

  describe('Activity Tracking', () => {
    test('should update process activity', () => {
      const taskId = 'test-task-1';
      const bytesReceived = 1024;
      const progressMarker = 'Processing request...';

      processPoolManager.registerProcess(taskId, mockProcess);
      processPoolManager.updateProcessActivity(taskId, bytesReceived, progressMarker);

      const processInfo = processPoolManager.getProcessInfo(taskId);
      expect(processInfo!.heartbeat.lastProgressMarker).toBe(progressMarker);
      expect(processInfo!.heartbeat.progressHistory).toHaveLength(1);
      expect(processInfo!.heartbeat.progressHistory![0].bytes).toBe(bytesReceived);
      expect(processInfo!.heartbeat.progressHistory![0].marker).toBe(progressMarker);
      expect(processInfo!.heartbeat.consecutiveSlowChecks).toBe(0);
    });

    test('should handle activity update for non-existent process', () => {
      const taskId = 'non-existent-task';

      expect(() => {
        processPoolManager.updateProcessActivity(taskId, 1024);
      }).not.toThrow();
    });

    test('should limit progress history to 50 entries', () => {
      const taskId = 'test-task-1';

      processPoolManager.registerProcess(taskId, mockProcess);

      // Add 60 progress entries
      for (let i = 0; i < 60; i++) {
        processPoolManager.updateProcessActivity(taskId, i * 100, `marker-${i}`);
      }

      const processInfo = processPoolManager.getProcessInfo(taskId);
      expect(processInfo!.heartbeat.progressHistory).toHaveLength(50);
      // Should keep the last 50 entries
      expect(processInfo!.heartbeat.progressHistory![0].marker).toBe('marker-10');
      expect(processInfo!.heartbeat.progressHistory![49].marker).toBe('marker-59');
    });
  });

  describe('Progress Marker Detection', () => {
    test('should detect progress markers in output', () => {
      const taskId = 'test-task-1';
      const output = 'Starting process... Processing request... Done.';

      processPoolManager.registerProcess(taskId, mockProcess);
      const marker = processPoolManager.detectProgressMarker(taskId, output);

      expect(marker).toBe('Processing request...');
      const processInfo = processPoolManager.getProcessInfo(taskId);
      expect(processInfo!.heartbeat.lastProgressMarker).toBe('Processing request...');
    });

    test('should return undefined when no progress markers found', () => {
      const taskId = 'test-task-1';
      const output = 'Some random output without markers';

      processPoolManager.registerProcess(taskId, mockProcess);
      const marker = processPoolManager.detectProgressMarker(taskId, output);

      expect(marker).toBeUndefined();
    });

    test('should detect multiple progress patterns', () => {
      const testCases = [
        { output: 'Generating response...', expected: 'Generating response...' },
        { output: 'Analysis complete!', expected: 'Analysis complete' },
        { output: 'Test generation started', expected: 'Test generation started' },
        { output: 'Writing output to file', expected: 'Writing output' },
      ];

      const taskId = 'test-task-1';
      processPoolManager.registerProcess(taskId, mockProcess);

      testCases.forEach(({ output, expected }) => {
        const marker = processPoolManager.detectProgressMarker(taskId, output);
        expect(marker).toBe(expected);
      });
    });
  });

  describe('Resource Usage Monitoring', () => {
    test('should capture resource usage successfully', async () => {
      const taskId = 'test-task-1';
      const mockUsage: ProcessResourceUsage = {
        pid: mockProcess.pid!,
        cpu: 45.5,
        memory: 60.2,
      };

      mockProcessMonitor.getResourceUsage.mockReturnValue(mockUsage);
      processPoolManager.registerProcess(taskId, mockProcess);

      const result = await processPoolManager.captureResourceUsage(taskId);

      expect(result).toEqual(mockUsage);
      expect(mockProcessMonitor.getResourceUsage).toHaveBeenCalledWith(mockProcess.pid);
      
      const processInfo = processPoolManager.getProcessInfo(taskId);
      expect(processInfo!.heartbeat.resourceUsage).toEqual(mockUsage);
    });

    test('should emit resource warning for high memory usage', async () => {
      const taskId = 'test-task-1';
      const mockUsage: ProcessResourceUsage = {
        pid: mockProcess.pid!,
        cpu: 45.5,
        memory: 85.0, // Above 80% threshold
      };
      const eventSpy = jest.fn();

      mockProcessMonitor.getResourceUsage.mockReturnValue(mockUsage);
      processPoolManager.on('resource-warning', eventSpy);
      processPoolManager.registerProcess(taskId, mockProcess);

      await processPoolManager.captureResourceUsage(taskId);

      expect(eventSpy).toHaveBeenCalledWith({ taskId, usage: mockUsage });
    });

    test('should return null for process without PID', async () => {
      const taskId = 'test-task-1';
      const processWithoutPid = { ...mockProcess, pid: undefined };

      processPoolManager.registerProcess(taskId, processWithoutPid);
      const result = await processPoolManager.captureResourceUsage(taskId);

      expect(result).toBeNull();
      expect(mockProcessMonitor.getResourceUsage).not.toHaveBeenCalled();
    });

    test('should handle resource monitoring errors gracefully', async () => {
      const taskId = 'test-task-1';

      mockProcessMonitor.getResourceUsage.mockImplementation(() => {
        throw new Error('Process not found');
      });
      processPoolManager.registerProcess(taskId, mockProcess);

      const result = await processPoolManager.captureResourceUsage(taskId);

      expect(result).toBeNull();
    });
  });

  describe('Health Metrics', () => {
    test('should get health metrics for all processes', async () => {
      const taskIds = ['task-1', 'task-2'];
      const mockMetrics: ProcessHealthMetrics = {
        isResponsive: true,
        cpuTrend: 'stable',
        memoryTrend: 'increasing',
        uptime: 120000,
        lastActivity: new Date(),
      };

      taskIds.forEach((taskId, index) => {
        processPoolManager.registerProcess(taskId, { ...mockProcess, pid: 12345 + index });
      });

      mockProcessMonitor.getHealthMetrics.mockResolvedValue(mockMetrics);

      const healthMetrics = await processPoolManager.getHealthMetrics();

      expect(healthMetrics.size).toBe(2);
      expect(healthMetrics.get('task-1')).toEqual(mockMetrics);
      expect(healthMetrics.get('task-2')).toEqual(mockMetrics);
    });

    test('should skip processes without PID in health metrics', async () => {
      const taskId = 'test-task-1';
      const processWithoutPid = { ...mockProcess, pid: undefined };

      processPoolManager.registerProcess(taskId, processWithoutPid);

      const healthMetrics = await processPoolManager.getHealthMetrics();

      expect(healthMetrics.size).toBe(0);
      expect(mockProcessMonitor.getHealthMetrics).not.toHaveBeenCalled();
    });

    test('should handle health metrics errors gracefully', async () => {
      const taskId = 'test-task-1';

      mockProcessMonitor.getHealthMetrics.mockRejectedValue(new Error('Process ended'));
      processPoolManager.registerProcess(taskId, mockProcess);

      const healthMetrics = await processPoolManager.getHealthMetrics();

      expect(healthMetrics.size).toBe(0);
    });
  });

  describe('Cleanup', () => {
    test('should cleanup all resources', () => {
      const taskIds = ['task-1', 'task-2', 'task-3'];
      const mockProcesses = taskIds.map((_, index) => ({
        ...mockProcess,
        pid: 12345 + index,
        kill: jest.fn(),
      }));

      taskIds.forEach((taskId, index) => {
        processPoolManager.registerProcess(taskId, mockProcesses[index]);
      });

      processPoolManager.cleanup();

      expect(processPoolManager.getActiveProcessCount()).toBe(0);
      expect(mockProcessMonitor.stopAll).toHaveBeenCalled();
      mockProcesses.forEach((proc) => {
        expect(proc.kill).toHaveBeenCalledWith('SIGTERM');
      });
    });

    test('should remove all event listeners on cleanup', () => {
      const eventSpy = jest.fn();
      processPoolManager.on('process-started', eventSpy);

      processPoolManager.cleanup();

      // Verify listeners are removed by registering a process and checking if event fires
      processPoolManager.registerProcess('test-task', mockProcess);
      expect(eventSpy).not.toHaveBeenCalled();
    });
  });

  describe('Event Emission', () => {
    test('should emit process-started event', () => {
      const taskId = 'test-task-1';
      const eventSpy = jest.fn();
      processPoolManager.on('process-started', eventSpy);

      processPoolManager.registerProcess(taskId, mockProcess);

      expect(eventSpy).toHaveBeenCalledWith({ taskId, process: mockProcess });
    });

    test('should emit process-killed event', () => {
      const taskId = 'test-task-1';
      const eventSpy = jest.fn();
      processPoolManager.on('process-killed', eventSpy);

      processPoolManager.registerProcess(taskId, mockProcess);
      processPoolManager.killProcess(taskId);

      expect(eventSpy).toHaveBeenCalledWith({ taskId });
    });

    test('should emit resource-warning event for high memory usage', async () => {
      const taskId = 'test-task-1';
      const mockUsage: ProcessResourceUsage = {
        pid: mockProcess.pid!,
        cpu: 45.5,
        memory: 85.0, // Above threshold
      };
      const eventSpy = jest.fn();

      mockProcessMonitor.getResourceUsage.mockReturnValue(mockUsage);
      processPoolManager.on('resource-warning', eventSpy);
      processPoolManager.registerProcess(taskId, mockProcess);

      await processPoolManager.captureResourceUsage(taskId);

      expect(eventSpy).toHaveBeenCalledWith({ taskId, usage: mockUsage });
    });
  });
});