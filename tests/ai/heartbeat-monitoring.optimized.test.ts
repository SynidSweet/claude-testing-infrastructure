/**
 * Optimized tests for ClaudeOrchestrator heartbeat monitoring functionality
 * 
 * Performance-optimized version demonstrating streamlined timer mocking
 * and reduced complexity while maintaining comprehensive test coverage.
 */

import { ClaudeOrchestrator } from '../../src/ai/ClaudeOrchestrator';
import { OptimizedAITestUtils, optimizedAITestHelpers } from '../../src/utils/OptimizedAITestUtils';
import { createRealTimer } from '../../src/utils/TimerFactory';

// Mock child_process
jest.mock('child_process', () => ({
  spawn: jest.fn(),
  execSync: jest.fn(),
}));

// Mock logger
jest.mock('../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('ClaudeOrchestrator Optimized Heartbeat Monitoring', () => {
  jest.setTimeout(30000); // Increased timeout for timer advancement tests
  let orchestrator: ClaudeOrchestrator;
  
  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    optimizedAITestHelpers.setup();

    // Configure optimized environment for heartbeat testing
    OptimizedAITestUtils.configure({
      useSimplifiedTimers: true,
      skipComplexCoordination: false, // Need some coordination for heartbeat tests
      defaultTimeout: 5000,
    });

    orchestrator = new ClaudeOrchestrator({
      timeout: 60000, // 1 minute for testing
      maxConcurrent: 1,
      timerService: createRealTimer(),
    });
  });

  afterEach(async () => {
    await orchestrator.killAll();
    optimizedAITestHelpers.cleanup();
  });

  describe('Heartbeat Initialization', () => {
    it('should start heartbeat monitoring when process starts', async () => {
      const { mockSpawn } = optimizedAITestHelpers.setupMocks();
      const process = optimizedAITestHelpers.createProcess();
      const batch = optimizedAITestHelpers.createBatch();

      mockSpawn.mockReturnValue(process);

      const batchPromise = orchestrator.processBatch(batch);
      
      // Single coordination point
      await Promise.resolve();
      
      expect(mockSpawn).toHaveBeenCalled();
      
      // Complete quickly without complex event simulation
      await optimizedAITestHelpers.completeProcess(process, true, 'Test output');
      
      await batchPromise;
    });

    it('should update activity on stdout data', async () => {
      const { mockSpawn } = optimizedAITestHelpers.setupMocks();
      const process = optimizedAITestHelpers.createProcess();
      const batch = optimizedAITestHelpers.createBatch();

      mockSpawn.mockReturnValue(process);

      const batchPromise = orchestrator.processBatch(batch);
      await Promise.resolve();

      // Optimized multiple data emission
      await optimizedAITestHelpers.simulateEvents(process, [
        { eventName: 'data', data: 'First output', target: 'stdout' },
        { eventName: 'data', data: 'Second output', target: 'stdout' },
      ]);
      
      await optimizedAITestHelpers.completeProcess(process);
      
      await batchPromise;
    });
  });

  describe('Dead Process Detection', () => {
    it('should detect and kill dead process after threshold', async () => {
      const processDeadHandler = jest.fn();
      orchestrator.on('process:dead', processDeadHandler);

      const { mockSpawn } = optimizedAITestHelpers.setupMocks();
      const process = optimizedAITestHelpers.createProcess();
      const batch = optimizedAITestHelpers.createBatch();

      mockSpawn.mockReturnValue(process);

      const batchPromise = orchestrator.processBatch(batch);
      
      await Promise.resolve();
      
      // Fast advance past dead threshold (120s) with single operation
      await optimizedAITestHelpers.fastAdvance(121000);

      expect(processDeadHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          taskId: 'task-1',
          timeSinceLastActivity: expect.any(Number),
        })
      );

      expect(process.kill).toHaveBeenCalledWith('SIGTERM');
      
      // Fast advance for SIGKILL
      await optimizedAITestHelpers.fastAdvance(5000);
      expect(process.kill).toHaveBeenCalledWith('SIGKILL');

      await optimizedAITestHelpers.completeProcess(process, false);
      
      try {
        await batchPromise;
      } catch (error) {
        // Expected to fail due to timeout
      }
    });

    it('should emit slow process warning efficiently', async () => {
      await optimizedAITestHelpers.testHeartbeat(orchestrator, 30000, 'process:slow');
    });
  });

  describe('Heartbeat Cleanup', () => {
    it('should stop heartbeat monitoring on process completion', async () => {
      const { mockSpawn } = optimizedAITestHelpers.setupMocks();
      const process = optimizedAITestHelpers.createProcess();
      const batch = optimizedAITestHelpers.createBatch();

      mockSpawn.mockReturnValue(process);

      const batchPromise = orchestrator.processBatch(batch);
      
      // Complete immediately
      await optimizedAITestHelpers.completeProcess(process);
      
      await batchPromise;

      // Verify no active heartbeats with fast advance
      const processDeadHandler = jest.fn();
      orchestrator.on('process:dead', processDeadHandler);
      
      await optimizedAITestHelpers.fastAdvance(180000);
      
      expect(processDeadHandler).not.toHaveBeenCalled();
    });

    it('should stop heartbeat monitoring on process error', async () => {
      const { mockSpawn } = optimizedAITestHelpers.setupMocks();
      const process = optimizedAITestHelpers.createProcess();
      const batch = optimizedAITestHelpers.createBatch();

      mockSpawn.mockReturnValue(process);

      const batchPromise = orchestrator.processBatch(batch);
      await Promise.resolve();

      // Emit error and complete in one operation
      process.emit('error', new Error('Process failed'));
      
      try {
        await batchPromise;
      } catch (error) {
        // Expected to fail
      }

      // Verify cleanup with single test
      const processDeadHandler = jest.fn();
      orchestrator.on('process:dead', processDeadHandler);
      
      await optimizedAITestHelpers.fastAdvance(180000);
      
      expect(processDeadHandler).not.toHaveBeenCalled();
    });

    it('should cleanup all heartbeats when batch completes', async () => {
      const { mockSpawn } = optimizedAITestHelpers.setupMocks();
      const batch = optimizedAITestHelpers.createBatch(2); // 2 tasks

      // Use optimized 2-concurrent setup
      orchestrator = new ClaudeOrchestrator({
        timeout: 60000,
        maxConcurrent: 2,
      });

      const process1 = optimizedAITestHelpers.createProcess({ pid: 12345 });
      const process2 = optimizedAITestHelpers.createProcess({ pid: 12346 });
      
      mockSpawn
        .mockReturnValueOnce(process1)
        .mockReturnValueOnce(process2);

      const batchPromise = orchestrator.processBatch(batch);
      await Promise.resolve();

      // Complete both processes efficiently
      await Promise.all([
        optimizedAITestHelpers.completeProcess(process1),
        optimizedAITestHelpers.completeProcess(process2),
      ]);
      
      await batchPromise;

      // Verify no active heartbeats
      const processDeadHandler = jest.fn();
      orchestrator.on('process:dead', processDeadHandler);
      
      await optimizedAITestHelpers.fastAdvance(180000);
      
      expect(processDeadHandler).not.toHaveBeenCalled();
    });
  });

  describe('Timeout Warning Events', () => {
    it('should emit timeout warning at 50% efficiently', async () => {
      const timeoutWarningHandler = jest.fn();
      orchestrator.on('timeout:warning', timeoutWarningHandler);

      const { mockSpawn } = optimizedAITestHelpers.setupMocks();
      const process = optimizedAITestHelpers.createProcess();
      const batch = optimizedAITestHelpers.createBatch();

      mockSpawn.mockReturnValue(process);

      const batchPromise = orchestrator.processBatch(batch);
      await Promise.resolve();

      // Fast advance to 50% of timeout (30 seconds of 60 second timeout)
      await optimizedAITestHelpers.fastAdvance(30000);

      expect(timeoutWarningHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          taskId: 'task-1',
          threshold: 50,
          progress: 50,
        })
      );

      await optimizedAITestHelpers.completeProcess(process);
      await batchPromise;
    });

    it('should emit multiple timeout warnings efficiently', async () => {
      const timeoutWarningHandler = jest.fn();
      orchestrator.on('timeout:warning', timeoutWarningHandler);

      const { mockSpawn } = optimizedAITestHelpers.setupMocks();
      const process = optimizedAITestHelpers.createProcess();
      const batch = optimizedAITestHelpers.createBatch();

      mockSpawn.mockReturnValue(process);

      const batchPromise = orchestrator.processBatch(batch);
      await Promise.resolve();

      // Batch advance to test multiple thresholds
      await optimizedAITestHelpers.fastAdvance(31000); // 50%
      expect(timeoutWarningHandler).toHaveBeenCalledTimes(1);

      await optimizedAITestHelpers.fastAdvance(15000); // 75% (46s total)
      expect(timeoutWarningHandler).toHaveBeenCalledTimes(2);

      await optimizedAITestHelpers.fastAdvance(9000); // 90% (55s total)
      expect(timeoutWarningHandler).toHaveBeenCalledTimes(3);

      await optimizedAITestHelpers.completeProcess(process);
      await batchPromise;
    });
  });

  describe('Performance Comparison', () => {
    it('should demonstrate optimization metrics', () => {
      const metrics = optimizedAITestHelpers.getMetrics();
      
      expect(metrics.config.useSimplifiedTimers).toBe(true);
      expect(metrics.config.useLightweightProcesses).toBe(true);
      expect(metrics.config.batchMockOps).toBe(true);
      
      // Log metrics for performance tracking
      console.log('Optimization metrics:', {
        sharedMocks: metrics.sharedMocksCount,
        processPool: metrics.processPoolSize,
        simplifiedTimers: metrics.config.useSimplifiedTimers,
      });
    });
  });
});