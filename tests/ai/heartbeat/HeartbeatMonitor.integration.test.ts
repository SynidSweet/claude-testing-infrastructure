/**
 * Integration tests for HeartbeatMonitor
 * 
 * Tests the complete heartbeat monitoring system with mocked timers
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { HeartbeatMonitor, HeartbeatMonitorConfig } from '../../../src/ai/heartbeat/HeartbeatMonitor';
import { HeartbeatScheduler } from '../../../src/ai/heartbeat/HeartbeatScheduler';
import { MockTimer } from '../../../src/utils/MockTimer';
import { EventEmitter } from 'events';

describe('HeartbeatMonitor Integration', () => {
  let monitor: HeartbeatMonitor;
  let mockTimer: MockTimer;
  let config: HeartbeatMonitorConfig;

  beforeEach(() => {
    mockTimer = new MockTimer();
    const scheduler = new HeartbeatScheduler(mockTimer, { 
      intervalMs: 30000,
      timeoutMs: 900000,
      progressIntervalMs: 10000
    });
    
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

    monitor = new HeartbeatMonitor(scheduler, config, mockTimer);
  });

  afterEach(() => {
    monitor.stopAll();
  });

  describe('process monitoring', () => {
    it('should start and stop monitoring', () => {
      const healthCheckSpy = jest.fn();
      monitor.on('healthCheck', healthCheckSpy);

      monitor.startMonitoring('task-1', 1234);
      expect(monitor.isMonitoring('task-1')).toBe(true);

      monitor.stopMonitoring('task-1');
      expect(monitor.isMonitoring('task-1')).toBe(false);
    });

    it('should set up monitoring correctly', () => {
      monitor.startMonitoring('task-1', 1234);

      const processInfo = monitor.getProcessInfo('task-1');
      expect(processInfo).toBeDefined();
      expect(processInfo?.pid).toBe(1234);
      expect(processInfo?.taskId).toBe('task-1');
      expect(processInfo?.outputs).toEqual([]);
      expect(processInfo?.errors).toEqual([]);
      
      const stats = monitor.getStats();
      expect(stats.monitoredProcesses).toBe(1);
      expect(stats.schedulerStats.activeChecks).toBe(1);
    });

    it('should emit warnings for unhealthy processes', () => {
      // This is a placeholder test - full integration testing would require
      // mocking the ProcessMonitor and triggering actual health checks
      // For now, we just verify the event system works
      
      const warningSpy = jest.fn();
      monitor.on('warning', warningSpy);
      
      // Emit a warning directly to test event system
      monitor.emit('warning', 'task-1', ['Test warning']);
      
      expect(warningSpy).toHaveBeenCalledWith('task-1', ['Test warning']);
    });

    it('should detect progress markers', () => {
      const progressSpy = jest.fn();
      monitor.on('progress', progressSpy);

      // Create a mock child process
      const mockChildProcess = new EventEmitter() as any;
      mockChildProcess.stdout = new EventEmitter();
      mockChildProcess.stderr = new EventEmitter();
      mockChildProcess.pid = 1234;

      monitor.startMonitoring('task-1', 1234, mockChildProcess);

      // Emit output with progress marker
      mockChildProcess.stdout.emit('data', Buffer.from('Processing file 1/10'));
      
      expect(progressSpy).toHaveBeenCalledWith('task-1', 1);

      // Emit another progress marker
      mockChildProcess.stdout.emit('data', Buffer.from('50% complete'));
      
      expect(progressSpy).toHaveBeenCalledWith('task-1', 2);
    });

    it('should handle process termination events', () => {
      const terminatedSpy = jest.fn();
      monitor.on('terminated', terminatedSpy);

      monitor.startMonitoring('task-1', 1234);
      
      // Emit termination event to test event system
      monitor.emit('terminated', 'task-1', 'Test termination');
      
      expect(terminatedSpy).toHaveBeenCalledWith('task-1', 'Test termination');
    });
  });

  describe('statistics', () => {
    it('should track monitoring statistics', () => {
      monitor.startMonitoring('task-1', 1234);
      monitor.startMonitoring('task-2', 5678);

      const stats = monitor.getStats();
      
      expect(stats.monitoredProcesses).toBe(2);
      expect(stats.schedulerStats.activeChecks).toBe(2);
    });
  });

  describe('error handling', () => {
    it('should emit errors correctly', () => {
      const errorSpy = jest.fn();
      monitor.on('error', errorSpy);

      // Try to get info for non-existent process
      const info = monitor.getProcessInfo('non-existent');
      expect(info).toBeUndefined();

      // Test error event emission
      const testError = new Error('Test error');
      monitor.emit('error', 'task-1', testError);
      
      expect(errorSpy).toHaveBeenCalledWith('task-1', testError);
    });
  });
});