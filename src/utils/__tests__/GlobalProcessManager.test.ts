/**
 * Tests for GlobalProcessManager
 */

import { GlobalProcessManager } from '../GlobalProcessManager';

// Mock child_process to avoid actually spawning processes
jest.mock('child_process', () => ({
  spawn: jest.fn(),
}));

describe('GlobalProcessManager', () => {
  let manager: GlobalProcessManager;

  beforeEach(() => {
    // Destroy any existing instance
    GlobalProcessManager.destroy();
    // Create new instance for testing
    manager = GlobalProcessManager.getInstance({
      maxClaude: 2,
      maxTestRunner: 3,
      maxTotal: 4,
    });
  });

  afterEach(() => {
    GlobalProcessManager.destroy();
  });

  describe('process reservation', () => {
    it('should successfully reserve a process slot within limits', async () => {
      const result = await manager.reserveProcessSlot('claude', 'test-component');
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.reservationId).toBeDefined();
        expect(typeof result.reservationId).toBe('string');
      }
    });

    it('should reject reservations that exceed Claude limits', async () => {
      // Reserve max Claude processes
      await manager.reserveProcessSlot('claude', 'component1');
      await manager.reserveProcessSlot('claude', 'component2');
      
      // This should fail
      const result = await manager.reserveProcessSlot('claude', 'component3');
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.reason).toContain('Claude process limit exceeded');
      }
    });

    it('should reject reservations that exceed total limits', async () => {
      // Reserve max total processes
      await manager.reserveProcessSlot('claude', 'component1');
      await manager.reserveProcessSlot('claude', 'component2');
      await manager.reserveProcessSlot('jest', 'component3');
      await manager.reserveProcessSlot('pytest', 'component4');
      
      // This should fail
      const result = await manager.reserveProcessSlot('jest', 'component5');
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.reason).toContain('Total process limit exceeded');
      }
    });
  });

  describe('process registration', () => {
    it('should successfully register a process with valid reservation', async () => {
      const reservation = await manager.reserveProcessSlot('claude', 'test-component');
      expect(reservation.success).toBe(true);
      
      if (reservation.success) {
        // Mock process
        const mockProcess = {
          pid: 12345,
          killed: false,
          stdout: { on: jest.fn() },
          stderr: { on: jest.fn() },
          on: jest.fn(),
        } as any;

        const result = manager.registerProcess(reservation.reservationId, mockProcess, 'test-process');
        
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.processInfo.id).toBe('test-process');
          expect(result.processInfo.type).toBe('claude');
          expect(result.processInfo.component).toBe('test-component');
        }
      }
    });

    it('should reject registration with invalid reservation', () => {
      const mockProcess = {
        pid: 12345,
        killed: false,
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn(),
      } as any;

      const result = manager.registerProcess('invalid-reservation', mockProcess);
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.reason).toContain('Reservation not found');
      }
    });
  });

  describe('process counting', () => {
    it('should correctly count active processes', async () => {
      const initialCounts = manager.getCurrentCounts();
      expect(initialCounts.total).toBe(0);
      expect(initialCounts.claude).toBe(0);
      expect(initialCounts.testRunners).toBe(0);

      // Reserve and register a Claude process
      const reservation = await manager.reserveProcessSlot('claude', 'test-component');
      expect(reservation.success).toBe(true);

      if (reservation.success) {
        const mockProcess = {
          pid: 12345,
          killed: false,
          stdout: { on: jest.fn() },
          stderr: { on: jest.fn() },
          on: jest.fn(),
        } as any;

        const result = manager.registerProcess(reservation.reservationId, mockProcess);
        expect(result.success).toBe(true);

        const newCounts = manager.getCurrentCounts();
        expect(newCounts.total).toBe(1);
        expect(newCounts.claude).toBe(1);
        expect(newCounts.testRunners).toBe(0);
      }
    });
  });

  describe('emergency shutdown', () => {
    it('should terminate all processes during emergency shutdown', async () => {
      // Set up a process
      const reservation = await manager.reserveProcessSlot('claude', 'test-component');
      expect(reservation.success).toBe(true);

      if (reservation.success) {
        const mockProcess = {
          pid: 12345,
          killed: false,
          kill: jest.fn(),
          stdout: { on: jest.fn() },
          stderr: { on: jest.fn() },
          on: jest.fn(),
        } as any;

        const result = manager.registerProcess(reservation.reservationId, mockProcess);
        expect(result.success).toBe(true);

        // Trigger emergency shutdown
        manager.emergencyShutdown('Test emergency');

        // Verify process was killed
        expect(mockProcess.kill).toHaveBeenCalledWith('SIGKILL');

        // Verify stats updated
        const stats = manager.getStats();
        expect(stats.emergencyShutdowns).toBe(1);
        expect(stats.activeProcesses).toBe(0);
      }
    });
  });

  describe('singleton behavior', () => {
    it('should return the same instance when called multiple times', () => {
      const instance1 = GlobalProcessManager.getInstance();
      const instance2 = GlobalProcessManager.getInstance();
      
      expect(instance1).toBe(instance2);
    });
  });
});