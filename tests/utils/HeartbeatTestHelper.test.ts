/**
 * Unit tests for HeartbeatTestHelper
 * 
 * Tests the utility class for heartbeat monitoring testing
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { 
  HeartbeatTestHelper, 
  createHeartbeatTestHelper, 
  expectHealthy, 
  expectUnhealthy,
  HeartbeatTestScenarios 
} from '../../src/utils/HeartbeatTestHelper';

describe('HeartbeatTestHelper', () => {
  let helper: HeartbeatTestHelper;

  beforeEach(() => {
    helper = createHeartbeatTestHelper();
  });

  afterEach(() => {
    helper.cleanup();
  });

  describe('createMockProcess', () => {
    it('should create a mock process with correct properties', () => {
      const taskId = 'test-task';
      const pid = 12345;
      const process = helper.createMockProcess(taskId, pid);

      expect(process.taskId).toBe(taskId);
      expect(process.pid).toBe(pid);
      expect(process.killed).toBe(false);
      expect(process.exitCode).toBe(null);
      expect(process.kill).toEqual(expect.any(Function));
      expect(process.stdout).toBeDefined();
      expect(process.stderr).toBeDefined();
    });

    it('should store mock process for later retrieval', () => {
      const taskId = 'test-task';
      helper.createMockProcess(taskId);
      
      const retrieved = helper.getMockProcess(taskId);
      expect(retrieved).toBeDefined();
      expect(retrieved!.taskId).toBe(taskId);
    });
  });

  describe('createMockMetrics', () => {
    it('should create metrics with default values', () => {
      const metrics = helper.createMockMetrics();
      
      expect(metrics.cpuPercent).toBe(50);
      expect(metrics.memoryMB).toBe(500);
      expect(metrics.outputRate).toBe(1.0);
      expect(metrics.errorCount).toBe(0);
      expect(metrics.progressMarkers).toBe(5);
      expect(metrics.isWaitingForInput).toBe(false);
    });

    it('should override default values with provided config', () => {
      const config = {
        cpuPercent: 90,
        memoryMB: 1200,
        errorCount: 10
      };
      const metrics = helper.createMockMetrics(config);
      
      expect(metrics.cpuPercent).toBe(90);
      expect(metrics.memoryMB).toBe(1200);
      expect(metrics.errorCount).toBe(10);
      // Should keep defaults for non-specified values
      expect(metrics.outputRate).toBe(1.0);
      expect(metrics.progressMarkers).toBe(5);
    });
  });

  describe('simulateHealthCheck', () => {
    it('should return healthy status for default metrics', () => {
      const status = helper.simulateHealthCheck();
      
      expect(status.isHealthy).toBe(true);
      expect(status.shouldTerminate).toBe(false);
      expect(status.confidence).toBeGreaterThan(0);
    });

    it('should return warning for high CPU', () => {
      const status = helper.simulateHealthCheck({ cpuPercent: 95 });
      
      expect(status.warnings).toContainEqual(expect.stringContaining('CPU'));
    });

    it('should return unhealthy status for too many errors', () => {
      const status = helper.simulateHealthCheck({ errorCount: 60 });
      
      expect(status.isHealthy).toBe(false);
      expect(status.warnings).toContainEqual(expect.stringContaining('error'));
    });

    it('should accept custom analysis configuration', () => {
      const customConfig = {
        cpuThreshold: 60,
        memoryThresholdMB: 1000,
        minOutputRate: 0.1,
        maxSilenceDuration: 120000,
        maxErrorCount: 50,
        progressMarkerPatterns: ['processing', 'analyzing', '\\d+%'],
        minProgressMarkers: 1,
        analysisWindowMs: 60000,
      };
      
      const status = helper.simulateHealthCheck({ cpuPercent: 75 }, customConfig);
      
      // With lower threshold (60), CPU of 75 should trigger warning
      expect(status.warnings).toContainEqual(expect.stringContaining('CPU'));
    });
  });

  describe('analyzeHealthStatus', () => {
    it('should analyze health status for provided metrics', () => {
      const metrics = {
        cpuPercent: 45,
        memoryMB: 400,
        outputRate: 2.0,
        lastOutputTime: Date.now() - 1000,
        errorCount: 0,
        processRuntime: 10000,
        progressMarkers: 10,
        isWaitingForInput: false,
      };
      
      const status = helper.analyzeHealthStatus(metrics);
      
      expect(status.isHealthy).toBe(true);
      expect(status.shouldTerminate).toBe(false);
      expect(status.confidence).toBeGreaterThan(0);
    });

    it('should accept custom analysis configuration', () => {
      const metrics = {
        cpuPercent: 75,
        memoryMB: 400,
        outputRate: 1.0,
        lastOutputTime: Date.now() - 1000,
        errorCount: 0,
        processRuntime: 10000,
        progressMarkers: 5,
        isWaitingForInput: false,
      };
      
      const customConfig = {
        cpuThreshold: 60,
        memoryThresholdMB: 1000,
        minOutputRate: 0.1,
        maxSilenceDuration: 120000,
        maxErrorCount: 50,
        progressMarkerPatterns: ['processing', 'analyzing', '\\d+%'],
        minProgressMarkers: 1,
        analysisWindowMs: 60000,
      };
      
      const status = helper.analyzeHealthStatus(metrics, customConfig);
      
      // With lower threshold (60), CPU of 75 should trigger warning
      expect(status.warnings).toContainEqual(expect.stringContaining('CPU'));
    });
  });

  describe('assertHealthStatus', () => {
    it('should pass when health status matches expectations', () => {
      const status = helper.simulateHealthCheck();
      
      expect(() => {
        helper.assertHealthStatus(status, {
          shouldBeHealthy: true,
          shouldTerminate: false,
          minimumConfidence: 0.1
        });
      }).not.toThrow();
    });

    it('should fail when health status does not match expectations', () => {
      const status = helper.simulateHealthCheck({ errorCount: 60 }); // This creates unhealthy status
      
      expect(() => {
        helper.assertHealthStatus(status, {
          shouldBeHealthy: true  // This should fail for too many errors
        });
      }).toThrow();
    });
  });

  describe('simulateOutput', () => {
    it('should emit output to stdout', () => {
      const taskId = 'test-task';
      const process = helper.createMockProcess(taskId);
      let receivedData = '';

      process.stdout.on('data', (data) => {
        receivedData += data.toString();
      });

      helper.simulateOutput(taskId, 'Test output');
      expect(receivedData).toBe('Test output');
    });

    it('should emit output to stderr when isError is true', () => {
      const taskId = 'test-task';
      const process = helper.createMockProcess(taskId);
      let receivedError = '';

      process.stderr.on('data', (data) => {
        receivedError += data.toString();
      });

      helper.simulateOutput(taskId, 'Error output', true);
      expect(receivedError).toBe('Error output');
    });

    it('should throw error for non-existent process', () => {
      expect(() => {
        helper.simulateOutput('non-existent', 'Test output');
      }).toThrow("Mock process with taskId 'non-existent' not found");
    });
  });

  describe('simulateCompletion', () => {
    it('should set exit code and emit exit event', () => {
      const taskId = 'test-task';
      const process = helper.createMockProcess(taskId);
      let exitCode: number | null = null;

      process.on('exit', (code) => {
        exitCode = code;
      });

      helper.simulateCompletion(taskId, 0);
      expect(process.exitCode).toBe(0);
      expect(exitCode).toBe(0);
    });
  });

  describe('simulateError', () => {
    it('should emit error event', () => {
      const taskId = 'test-task';
      const process = helper.createMockProcess(taskId);
      let receivedError: Error | null = null;

      process.on('error', (error) => {
        receivedError = error;
      });

      const testError = new Error('Test error');
      helper.simulateError(taskId, testError);
      expect(receivedError).toBe(testError);
    });
  });

  describe('assertProcessKilled', () => {
    it('should pass when process kill was called', () => {
      const taskId = 'test-task';
      const process = helper.createMockProcess(taskId);
      process.kill();

      expect(() => {
        helper.assertProcessKilled(taskId);
      }).not.toThrow();
    });

    it('should fail when process kill was not called', () => {
      const taskId = 'test-task';
      helper.createMockProcess(taskId);

      expect(() => {
        helper.assertProcessKilled(taskId);
      }).toThrow();
    });
  });

  describe('scenarios', () => {
    it('should provide healthy scenario metrics', () => {
      const metrics = helper.scenarios.healthy();
      expect(metrics.cpuPercent).toBeLessThan(80);
      expect(metrics.memoryMB).toBeLessThan(1000);
      expect(metrics.errorCount).toBe(0);
    });

    it('should provide high CPU scenario metrics', () => {
      const metrics = helper.scenarios.highCpu();
      expect(metrics.cpuPercent).toBeGreaterThan(80);
    });

    it('should provide silent scenario metrics', () => {
      const metrics = helper.scenarios.silent();
      expect(metrics.outputRate).toBe(0);
      expect(metrics.progressMarkers).toBe(0);
    });
  });

  describe('convenience functions', () => {
    it('expectHealthy should pass for healthy status', () => {
      const status = helper.simulateHealthCheck();
      expect(() => expectHealthy(status)).not.toThrow();
    });

    it('expectUnhealthy should pass for unhealthy status', () => {
      const status = helper.simulateHealthCheck({ errorCount: 60 }); // This creates unhealthy status
      expect(() => expectUnhealthy(status)).not.toThrow();
    });
  });

  describe('HeartbeatTestScenarios', () => {
    it('should test healthy process scenario', () => {
      expect(() => {
        HeartbeatTestScenarios.testHealthyProcess(helper);
      }).not.toThrow();
    });

    it('should test high CPU warning scenario', () => {
      expect(() => {
        HeartbeatTestScenarios.testHighCpuWarning(helper);
      }).not.toThrow();
    });

    it('should test silent process detection scenario', () => {
      expect(() => {
        HeartbeatTestScenarios.testSilentProcessDetection(helper);
      }).not.toThrow();
    });
  });

  describe('cleanup', () => {
    it('should clear all mock processes', () => {
      helper.createMockProcess('task1');
      helper.createMockProcess('task2');
      
      expect(helper.getMockProcess('task1')).toBeDefined();
      expect(helper.getMockProcess('task2')).toBeDefined();
      
      helper.cleanup();
      
      expect(helper.getMockProcess('task1')).toBeUndefined();
      expect(helper.getMockProcess('task2')).toBeUndefined();
    });
  });
});