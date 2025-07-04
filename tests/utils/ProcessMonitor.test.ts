import { ProcessMonitor } from '../../src/utils/ProcessMonitor';
import { execSync } from 'child_process';

// Mock execSync for testing
jest.mock('child_process');
const mockedExecSync = execSync as jest.MockedFunction<typeof execSync>;

describe('ProcessMonitor', () => {
  let processMonitor: ProcessMonitor;

  beforeEach(() => {
    jest.clearAllMocks();
    processMonitor = new ProcessMonitor({
      cpuThreshold: 80,
      memoryThreshold: 80,
      checkInterval: 1000, // Faster for testing
      maxHistory: 10,
      zombieDetection: true,
    });
  });

  afterEach(() => {
    processMonitor.stopAll();
  });

  describe('constructor', () => {
    it('should initialize with default configuration', () => {
      const monitor = new ProcessMonitor();
      const status = monitor.getMonitoringStatus();
      
      expect(status.configuration.cpuThreshold).toBe(80);
      expect(status.configuration.memoryThreshold).toBe(80);
      expect(status.configuration.checkInterval).toBe(30000);
      expect(status.configuration.maxHistory).toBe(100);
      expect(status.configuration.zombieDetection).toBe(true);
    });

    it('should initialize with custom configuration', () => {
      const status = processMonitor.getMonitoringStatus();
      
      expect(status.configuration.cpuThreshold).toBe(80);
      expect(status.configuration.memoryThreshold).toBe(80);
      expect(status.configuration.checkInterval).toBe(1000);
      expect(status.configuration.maxHistory).toBe(10);
      expect(status.configuration.zombieDetection).toBe(true);
    });
  });

  describe('getResourceUsage', () => {
    it('should return null for invalid PID', () => {
      mockedExecSync.mockImplementation(() => {
        throw new Error('No such process');
      });

      const usage = processMonitor.getResourceUsage(99999);
      expect(usage).toBeNull();
    });

    it('should parse detailed process information', () => {
      const mockOutput = `  PID  PPID %CPU %MEM   RSS   VSZ STAT COMMAND
12345 12344 25.5 15.2  1024  2048 R    node test.js`;
      
      mockedExecSync.mockReturnValue(mockOutput);

      const usage = processMonitor.getResourceUsage(12345);
      
      expect(usage).toEqual({
        pid: 12345,
        ppid: 12344,
        cpu: 25.5,
        memory: 15.2,
        rss: 1024,
        vsz: 2048,
        state: 'R',
        command: 'node test.js',
      });
    });

    it('should fallback to basic resource usage on parsing error', () => {
      // First call (detailed) fails, second call (basic) succeeds
      mockedExecSync
        .mockImplementationOnce(() => {
          throw new Error('Detailed ps failed');
        })
        .mockReturnValue('%CPU %MEM\n25.5 15.2');

      const usage = processMonitor.getResourceUsage(12345);
      
      expect(usage).toEqual({
        pid: 12345,
        cpu: 25.5,
        memory: 15.2,
      });
    });
  });

  describe('getHealthMetrics', () => {
    it('should return not alive for non-existent process', () => {
      mockedExecSync.mockImplementation(() => {
        throw new Error('No such process');
      });

      const metrics = processMonitor.getHealthMetrics(99999);
      
      expect(metrics.isAlive).toBe(false);
      expect(metrics.isZombie).toBe(false);
      expect(metrics.isHighResource).toBe(false);
      expect(metrics.healthScore).toBe(0);
      expect(metrics.warnings).toContain('Process not found or not accessible');
    });

    it('should detect zombie process', () => {
      const mockOutput = `  PID  PPID %CPU %MEM   RSS   VSZ STAT COMMAND
12345 12344  0.0  0.0     0     0 Z    <defunct>`;
      
      mockedExecSync.mockReturnValue(mockOutput);

      const metrics = processMonitor.getHealthMetrics(12345);
      
      expect(metrics.isAlive).toBe(true);
      expect(metrics.isZombie).toBe(true);
      expect(metrics.healthScore).toBe(50); // 100 - 50 for zombie
      expect(metrics.warnings).toContain('Process is in zombie state');
      expect(metrics.recommendations).toContain('Parent process should reap zombie child');
    });

    it('should detect high CPU usage', () => {
      const mockOutput = `  PID  PPID %CPU %MEM   RSS   VSZ STAT COMMAND
12345 12344 95.5 15.2  1024  2048 R    node test.js`;
      
      mockedExecSync.mockReturnValue(mockOutput);

      const metrics = processMonitor.getHealthMetrics(12345);
      
      expect(metrics.isAlive).toBe(true);
      expect(metrics.isZombie).toBe(false);
      expect(metrics.isHighResource).toBe(true);
      expect(metrics.healthScore).toBe(80); // 100 - 20 for high CPU
      expect(metrics.warnings).toContain('High CPU usage: 95.5%');
    });

    it('should detect high memory usage', () => {
      const mockOutput = `  PID  PPID %CPU %MEM   RSS   VSZ STAT COMMAND
12345 12344 25.5 95.2  1024  2048 S    node test.js`;
      
      mockedExecSync.mockReturnValue(mockOutput);

      const metrics = processMonitor.getHealthMetrics(12345);
      
      expect(metrics.isAlive).toBe(true);
      expect(metrics.isZombie).toBe(false);
      expect(metrics.isHighResource).toBe(true);
      expect(metrics.healthScore).toBe(80); // 100 - 20 for high memory
      expect(metrics.warnings).toContain('High memory usage: 95.2%');
    });

    it('should detect stale process', () => {
      // First call (detailed) fails, second call (basic) returns 0 CPU/memory
      mockedExecSync
        .mockImplementationOnce(() => {
          throw new Error('Detailed ps failed');
        })
        .mockReturnValue('%CPU %MEM\n 0.0  0.0');

      const metrics = processMonitor.getHealthMetrics(12345);
      
      expect(metrics.isAlive).toBe(true);
      expect(metrics.healthScore).toBe(70); // 100 - 30 for stale process
      expect(metrics.warnings).toContain('Process appears stale or unresponsive');
    });
  });

  describe('detectZombieProcesses', () => {
    it('should detect zombie processes system-wide', () => {
      const mockOutput = `12345 12344  0.0  0.0 Z <defunct>
12346 12344  0.0  0.0 Z <defunct>`;
      
      mockedExecSync.mockReturnValue(mockOutput);

      const zombies = processMonitor.detectZombieProcesses();
      
      expect(zombies).toHaveLength(2);
      expect(zombies[0]).toEqual({
        pid: 12345,
        ppid: 12344,
        cpu: 0.0,
        memory: 0.0,
        state: 'Z',
        command: '<defunct>',
      });
    });

    it('should return empty array when no zombies found', () => {
      mockedExecSync.mockImplementation(() => {
        throw new Error('No zombies found');
      });

      const zombies = processMonitor.detectZombieProcesses();
      
      expect(zombies).toHaveLength(0);
    });

    it('should handle zombie detection disabled', () => {
      const monitor = new ProcessMonitor({ zombieDetection: false });
      const zombies = monitor.detectZombieProcesses();
      
      expect(zombies).toHaveLength(0);
    });
  });

  describe('monitoring lifecycle', () => {
    it('should start and stop monitoring', () => {
      const mockOutput = `  PID  PPID %CPU %MEM   RSS   VSZ STAT COMMAND
12345 12344 25.5 15.2  1024  2048 R    node test.js`;
      
      mockedExecSync.mockReturnValue(mockOutput);

      // Start monitoring
      processMonitor.startMonitoring(12345);
      
      let status = processMonitor.getMonitoringStatus();
      expect(status.activeProcesses).toContain(12345);

      // Stop monitoring
      processMonitor.stopMonitoring(12345);
      
      status = processMonitor.getMonitoringStatus();
      expect(status.activeProcesses).not.toContain(12345);
    });

    it('should not duplicate monitoring for same PID', () => {
      const mockOutput = `  PID  PPID %CPU %MEM   RSS   VSZ STAT COMMAND
12345 12344 25.5 15.2  1024  2048 R    node test.js`;
      
      mockedExecSync.mockReturnValue(mockOutput);

      processMonitor.startMonitoring(12345);
      processMonitor.startMonitoring(12345); // Should not duplicate
      
      const status = processMonitor.getMonitoringStatus();
      expect(status.activeProcesses.filter(pid => pid === 12345)).toHaveLength(1);
    });

    it('should stop all monitoring', () => {
      const mockOutput = `  PID  PPID %CPU %MEM   RSS   VSZ STAT COMMAND
12345 12344 25.5 15.2  1024  2048 R    node test.js`;
      
      mockedExecSync.mockReturnValue(mockOutput);

      processMonitor.startMonitoring(12345);
      processMonitor.startMonitoring(12346);
      
      let status = processMonitor.getMonitoringStatus();
      expect(status.activeProcesses).toHaveLength(2);

      processMonitor.stopAll();
      
      status = processMonitor.getMonitoringStatus();
      expect(status.activeProcesses).toHaveLength(0);
    });
  });

  describe('history tracking', () => {
    it('should track process history', async () => {
      const mockOutput = `  PID  PPID %CPU %MEM   RSS   VSZ STAT COMMAND
12345 12344 25.5 15.2  1024  2048 R    node test.js`;
      
      mockedExecSync.mockReturnValue(mockOutput);

      processMonitor.startMonitoring(12345);
      
      // Wait for at least one monitoring cycle
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      const history = processMonitor.getHistory(12345);
      expect(history.length).toBeGreaterThan(0);
      expect(history[0]?.resourceUsage?.pid).toBe(12345);
    });

    it('should limit history entries', async () => {
      const mockOutput = `  PID  PPID %CPU %MEM   RSS   VSZ STAT COMMAND
12345 12344 25.5 15.2  1024  2048 R    node test.js`;
      
      mockedExecSync.mockReturnValue(mockOutput);

      // Create monitor with very small history limit
      const monitor = new ProcessMonitor({ maxHistory: 2, checkInterval: 100 });
      monitor.startMonitoring(12345);
      
      // Wait for multiple cycles
      await new Promise(resolve => setTimeout(resolve, 350));
      
      const history = monitor.getHistory(12345);
      expect(history.length).toBeLessThanOrEqual(2);
      
      monitor.stopAll();
    });
  });
});