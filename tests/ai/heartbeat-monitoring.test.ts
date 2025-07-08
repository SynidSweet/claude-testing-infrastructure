/**
 * Tests for ClaudeOrchestrator heartbeat monitoring functionality
 * Updated to use AsyncTestUtils framework for improved reliability
 */

import { ClaudeOrchestrator } from '../../src/ai/ClaudeOrchestrator';
import type { AITaskBatch, TaskContext } from '../../src/ai/AITaskPreparation';
import { EventEmitter } from 'events';
import { TimerTestUtils } from '../../src/utils/TimerTestUtils';
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

describe('ClaudeOrchestrator Heartbeat Monitoring', () => {
  jest.setTimeout(60000); // 60 second timeout for all tests to handle timing-sensitive operations
  let orchestrator: ClaudeOrchestrator;
  let mockProcess: any;
  const mockSpawn = require('child_process').spawn as jest.Mock;
  const mockExecSync = require('child_process').execSync as jest.Mock;
  const mockLogger = require('../../src/utils/logger').logger;

  const createTestContext = (): TaskContext => ({
    sourceCode: 'test source code',
    existingTests: '',
    dependencies: [],
    missingScenarios: [],
    frameworkInfo: {
      language: 'javascript',
      testFramework: 'jest',
      moduleType: 'commonjs',
      hasTypeScript: false,
    },
  });

  const createTestTask = (id: string, sourceFile: string = 'test.js') => ({
    id,
    sourceFile,
    testFile: sourceFile.replace('.js', '.test.js'),
    priority: 1,
    complexity: 1,
    prompt: 'Generate tests',
    context: createTestContext(),
    estimatedTokens: 100,
    estimatedCost: 0.01,
    status: 'pending' as const,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup fake timers for deterministic timer testing
    TimerTestUtils.setupFakeTimers();
    
    // Mock Claude CLI availability check
    mockExecSync.mockImplementation((cmd: string) => {
      if (cmd.includes('--version')) return 'claude version 1.0.0';
      if (cmd.includes('config get')) return 'authenticated';
      return '';
    });

    // Create a mock process
    mockProcess = new EventEmitter();
    mockProcess.stdout = new EventEmitter();
    mockProcess.stderr = new EventEmitter();
    mockProcess.kill = jest.fn();
    mockProcess.killed = false;
    mockProcess.pid = 12345;

    mockSpawn.mockReturnValue(mockProcess);

    orchestrator = new ClaudeOrchestrator({
      timeout: 60000, // 1 minute for testing
      maxConcurrent: 1,
      timerService: createRealTimer(), // Use RealTimer so Jest can fake the native timers
    });
  });

  afterEach(async () => {
    await orchestrator.killAll();
    TimerTestUtils.cleanupTimers();
  });

  describe('Heartbeat Initialization', () => {
    it('should start heartbeat monitoring when process starts', async () => {
      const batch: AITaskBatch = {
        id: 'batch-1',
        tasks: [createTestTask('task-1')],
        totalEstimatedTokens: 100,
        totalEstimatedCost: 0.01,
        maxConcurrency: 1,
      };

      const batchPromise = orchestrator.processBatch(batch);
      
      // Wait for process to be spawned
      await TimerTestUtils.waitForEvents();
      
      // Verify process is spawned
      expect(mockSpawn).toHaveBeenCalled();
      
      // Emit some data to prevent timeout
      mockProcess.stdout.emit('data', Buffer.from('Test output'));
      
      // Complete the process
      mockProcess.emit('close', 0);
      
      await batchPromise;
    });

    it('should update activity on stdout data', async () => {
      const batch: AITaskBatch = {
        id: 'batch-1',
        tasks: [createTestTask('task-1')],
        totalEstimatedTokens: 100,
        totalEstimatedCost: 0.01,
        maxConcurrency: 1,
      };

      const batchPromise = orchestrator.processBatch(batch);
      await Promise.resolve();

      // Emit data multiple times
      mockProcess.stdout.emit('data', Buffer.from('First output'));
      mockProcess.stdout.emit('data', Buffer.from('Second output'));
      
      // Complete the process
      mockProcess.emit('close', 0);
      
      await batchPromise;
    });

    it('should update activity on stderr data', async () => {
      const batch: AITaskBatch = {
        id: 'batch-1',
        tasks: [createTestTask('task-1')],
        totalEstimatedTokens: 100,
        totalEstimatedCost: 0.01,
        maxConcurrency: 1,
      };

      const batchPromise = orchestrator.processBatch(batch);
      await Promise.resolve();

      // Emit stderr data
      mockProcess.stderr.emit('data', Buffer.from('Warning message'));
      
      // Complete the process
      mockProcess.stdout.emit('data', Buffer.from('{}'));
      mockProcess.emit('close', 0);
      
      await batchPromise;
    });
  });

  describe('Dead Process Detection', () => {
    it('should detect and kill dead process after threshold', async () => {
      const processDeadHandler = jest.fn();
      orchestrator.on('process:dead', processDeadHandler);

      const batch: AITaskBatch = {
        id: 'batch-1',
        tasks: [createTestTask('task-1')],
        totalEstimatedTokens: 100,
        totalEstimatedCost: 0.01,
        maxConcurrency: 1,
      };

      const batchPromise = orchestrator.processBatch(batch);
      
      // Wait for process to be spawned and heartbeat monitoring to start
      await TimerTestUtils.waitForEvents();
      await TimerTestUtils.waitForEvents(); // Extra wait to ensure heartbeat is fully set up
      
      // Advance past heartbeat intervals to trigger dead process check
      // Heartbeat interval is 30 seconds, dead threshold is 120 seconds
      await TimerTestUtils.advanceTimersAndFlush(30000); // First interval
      await TimerTestUtils.advanceTimersAndFlush(30000); // Second interval (60s total)
      await TimerTestUtils.advanceTimersAndFlush(30000); // Third interval (90s total)
      await TimerTestUtils.advanceTimersAndFlush(30000); // Fourth interval (120s total)
      await TimerTestUtils.advanceTimersAndFlush(1000); // Just past the dead process threshold

      // Verify dead process event was emitted
      expect(processDeadHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          taskId: 'task-1',
          timeSinceLastActivity: expect.any(Number),
        })
      );

      // Verify process kill was attempted
      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');
      
      // Wait for SIGKILL timeout
      await TimerTestUtils.advanceTimersAndFlush(5000);
      expect(mockProcess.kill).toHaveBeenCalledWith('SIGKILL');

      // Complete the process with timeout
      mockProcess.emit('close', 1);
      
      try {
        await batchPromise;
      } catch (error) {
        // Expected to fail due to timeout
      }
    });

    it('should emit slow process warning after heartbeat interval', async () => {
      const processSlowHandler = jest.fn();
      orchestrator.on('process:slow', processSlowHandler);

      const batch: AITaskBatch = {
        id: 'batch-1',
        tasks: [createTestTask('task-1')],
        totalEstimatedTokens: 100,
        totalEstimatedCost: 0.01,
        maxConcurrency: 1,
      };

      const batchPromise = orchestrator.processBatch(batch);
      
      // Wait for process to be spawned and heartbeat monitoring to start
      await TimerTestUtils.waitForEvents();
      
      // Allow heartbeat monitoring to be set up
      await TimerTestUtils.waitForEvents();
      
      // Since the initial check happens immediately, we need to wait
      // for the first actual interval to trigger
      await TimerTestUtils.advanceTimersAndFlush(30000); // First interval (should not trigger slow yet)
      
      // Now advance past the heartbeat interval threshold (30s) from last activity
      await TimerTestUtils.advanceTimersAndFlush(30000); // Second interval - 60s total, should detect slow

      // Verify slow process event was emitted
      expect(processSlowHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          taskId: 'task-1',
          timeSinceLastActivity: expect.any(Number),
        })
      );

      // Send some data to keep it alive
      mockProcess.stdout.emit('data', Buffer.from('Still working...'));
      
      // Complete the process
      mockProcess.stdout.emit('data', Buffer.from('{}'));
      mockProcess.emit('close', 0);
      
      await batchPromise;
    });
  });

  describe('Heartbeat Cleanup', () => {
    it('should stop heartbeat monitoring on process completion', async () => {
      const batch: AITaskBatch = {
        id: 'batch-1',
        tasks: [createTestTask('task-1')],
        totalEstimatedTokens: 100,
        totalEstimatedCost: 0.01,
        maxConcurrency: 1,
      };

      const batchPromise = orchestrator.processBatch(batch);
      await Promise.resolve();

      // Complete the process normally
      mockProcess.stdout.emit('data', Buffer.from('{}'));
      mockProcess.emit('close', 0);
      
      await batchPromise;

      // Advance timers - should not trigger any heartbeat events
      const processDeadHandler = jest.fn();
      orchestrator.on('process:dead', processDeadHandler);
      
      await TimerTestUtils.advanceTimersAndFlush(180000); // 3 minutes
      
      expect(processDeadHandler).not.toHaveBeenCalled();
    });

    it('should stop heartbeat monitoring on process error', async () => {
      const batch: AITaskBatch = {
        id: 'batch-1',
        tasks: [createTestTask('task-1')],
        totalEstimatedTokens: 100,
        totalEstimatedCost: 0.01,
        maxConcurrency: 1,
      };

      const batchPromise = orchestrator.processBatch(batch);
      await Promise.resolve();

      // Emit error
      mockProcess.emit('error', new Error('Process failed'));
      
      try {
        await batchPromise;
      } catch (error) {
        // Expected to fail
      }

      // Verify heartbeat monitoring stopped
      const processDeadHandler = jest.fn();
      orchestrator.on('process:dead', processDeadHandler);
      
      await TimerTestUtils.advanceTimersAndFlush(180000); // 3 minutes
      
      expect(processDeadHandler).not.toHaveBeenCalled();
    });

    it('should stop heartbeat monitoring on timeout', async () => {
      const batch: AITaskBatch = {
        id: 'batch-1',
        tasks: [createTestTask('task-1')],
        totalEstimatedTokens: 100,
        totalEstimatedCost: 0.01,
        maxConcurrency: 1,
      };

      const batchPromise = orchestrator.processBatch(batch);
      
      // Allow process to start and heartbeat monitoring to be set up
      await Promise.resolve();
      await Promise.resolve();
      
      // Trigger timeout (300 seconds in test config, so advance much further)
      await TimerTestUtils.advanceTimersAndFlush(300000);
      await Promise.resolve();
      jest.runOnlyPendingTimers();
      
      // Give event loop a chance to process timeout
      await Promise.resolve();
      
      // Verify process was killed
      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');
      
      mockProcess.emit('close', 1);
      
      try {
        await batchPromise;
      } catch (error) {
        // Expected to fail due to timeout
      }

      // Verify heartbeat monitoring stopped
      const processDeadHandler = jest.fn();
      orchestrator.on('process:dead', processDeadHandler);
      
      await TimerTestUtils.advanceTimersAndFlush(180000); // 3 minutes
      await Promise.resolve();
      jest.runOnlyPendingTimers();
      
      expect(processDeadHandler).not.toHaveBeenCalled();
    }, 10000);

    it('should cleanup all heartbeats when batch completes', async () => {
      const batch: AITaskBatch = {
        id: 'batch-1',
        tasks: [
          createTestTask('task-1', 'test1.js'),
          createTestTask('task-2', 'test2.js'),
        ],
        totalEstimatedTokens: 200,
        totalEstimatedCost: 0.02,
        maxConcurrency: 2,
      };

      // Run with 2 concurrent tasks
      orchestrator = new ClaudeOrchestrator({
        timeout: 60000,
        maxConcurrent: 2,
      });

      const batchPromise = orchestrator.processBatch(batch);
      await Promise.resolve();
      await Promise.resolve();

      // Complete both processes
      mockProcess.stdout.emit('data', Buffer.from('{}'));
      mockProcess.emit('close', 0);
      
      // Create second mock process for second spawn call
      const mockProcess2: any = new EventEmitter();
      mockProcess2.stdout = new EventEmitter();
      mockProcess2.stderr = new EventEmitter();
      mockProcess2.kill = jest.fn();
      mockProcess2.killed = false;
      mockProcess2.pid = 12346;
      
      mockSpawn.mockReturnValueOnce(mockProcess2);
      
      await Promise.resolve();
      await Promise.resolve();
      mockProcess2.stdout.emit('data', Buffer.from('{}'));
      mockProcess2.emit('close', 0);
      
      await batchPromise;

      // Verify no active heartbeats remain
      const processDeadHandler = jest.fn();
      orchestrator.on('process:dead', processDeadHandler);
      
      await TimerTestUtils.advanceTimersAndFlush(180000); // 3 minutes
      await Promise.resolve();
      
      expect(processDeadHandler).not.toHaveBeenCalled();
    }, 45000);
  });

  describe('Timeout Warning Events', () => {
    it('should emit timeout warning at 50% of timeout', async () => {
      const timeoutWarningHandler = jest.fn();
      orchestrator.on('timeout:warning', timeoutWarningHandler);

      const batch: AITaskBatch = {
        id: 'batch-1',
        tasks: [createTestTask('task-1')],
        totalEstimatedTokens: 100,
        totalEstimatedCost: 0.01,
        maxConcurrency: 1,
      };

      const batchPromise = orchestrator.processBatch(batch);
      await Promise.resolve();

      // Wait for the timeout progress tracking to be set up
      await TimerTestUtils.waitForEvents(3);
      
      // Advance to 50% of timeout (30 seconds of 60 second timeout)
      await TimerTestUtils.advanceTimersAndFlush(30000);

      expect(timeoutWarningHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          taskId: 'task-1',
          threshold: 50,
          progress: 50,
          elapsed: 30,
          timeoutSeconds: 60,
        })
      );

      // Complete the process
      mockProcess.stdout.emit('data', Buffer.from('{}'));
      mockProcess.emit('close', 0);
      
      await batchPromise;
    });

    it('should emit timeout warnings at 50%, 75%, and 90% thresholds', async () => {
      const timeoutWarningHandler = jest.fn();
      orchestrator.on('timeout:warning', timeoutWarningHandler);

      const batch: AITaskBatch = {
        id: 'batch-1',
        tasks: [createTestTask('task-1')],
        totalEstimatedTokens: 100,
        totalEstimatedCost: 0.01,
        maxConcurrency: 1,
      };

      const batchPromise = orchestrator.processBatch(batch);
      await Promise.resolve();

      // Advance to 50% of timeout
      await TimerTestUtils.advanceTimersAndFlush(31000); // A bit past 50% to ensure trigger
      expect(timeoutWarningHandler).toHaveBeenCalledTimes(1);
      expect(timeoutWarningHandler).toHaveBeenLastCalledWith(
        expect.objectContaining({ threshold: 50 })
      );

      // Advance to 75% of timeout
      await TimerTestUtils.advanceTimersAndFlush(20000); // Total 51 seconds (well past 75% to ensure trigger)
      expect(timeoutWarningHandler).toHaveBeenCalledTimes(2);
      expect(timeoutWarningHandler).toHaveBeenLastCalledWith(
        expect.objectContaining({ threshold: 75 })
      );

      // Advance to 90% of timeout (but not past it)
      await TimerTestUtils.advanceTimersAndFlush(5000); // Total 56 seconds (93% of 60s timeout)
      expect(timeoutWarningHandler).toHaveBeenCalledTimes(3);
      expect(timeoutWarningHandler).toHaveBeenLastCalledWith(
        expect.objectContaining({ threshold: 90 })
      );

      // Complete the process before timeout triggers
      mockProcess.stdout.emit('data', Buffer.from('{}'));
      mockProcess.emit('close', 0);
      
      await batchPromise;
    });

    it('should include resource usage in timeout warnings', async () => {
      // Mock resource usage capture
      mockExecSync.mockImplementation((cmd: string) => {
        if (cmd.includes('--version')) return 'claude version 1.0.0';
        if (cmd.includes('config get')) return 'authenticated';
        if (cmd.includes('ps -p')) {
          return '%CPU %MEM\n 25.3  12.5';
        }
        return '';
      });

      const timeoutWarningHandler = jest.fn();
      orchestrator.on('timeout:warning', timeoutWarningHandler);

      const batch: AITaskBatch = {
        id: 'batch-1',
        tasks: [createTestTask('task-1')],
        totalEstimatedTokens: 100,
        totalEstimatedCost: 0.01,
        maxConcurrency: 1,
      };

      const batchPromise = orchestrator.processBatch(batch);
      await Promise.resolve();

      // Emit some data to track bytes
      mockProcess.stdout.emit('data', Buffer.from('Some test output'));
      mockProcess.stderr.emit('data', Buffer.from('Some warnings'));

      // Advance to 50% of timeout
      await TimerTestUtils.advanceTimersAndFlush(30000);

      expect(timeoutWarningHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          bytesReceived: expect.any(Number),
          stdout: 16, // Length of 'Some test output'
          stderr: 13, // Length of 'Some warnings'
          resourceUsage: expect.objectContaining({
            cpu: 25.3,
            memory: 12.5,
          }),
        })
      );

      // Complete the process
      mockProcess.stdout.emit('data', Buffer.from('{}'));
      mockProcess.emit('close', 0);
      
      await batchPromise;
    });

    it('should emit progress updates with warning flag', async () => {
      const progressHandler = jest.fn();
      orchestrator.on('progress', progressHandler);

      const batch: AITaskBatch = {
        id: 'batch-1',
        tasks: [createTestTask('task-1')],
        totalEstimatedTokens: 100,
        totalEstimatedCost: 0.01,
        maxConcurrency: 1,
      };

      const batchPromise = orchestrator.processBatch(batch);
      await Promise.resolve();

      // Clear previous progress events
      progressHandler.mockClear();

      // Advance to 50% of timeout
      await TimerTestUtils.advanceTimersAndFlush(30000);

      // Find the warning progress event
      const warningCall = progressHandler.mock.calls.find(
        call => call[0].warning === true
      );

      expect(warningCall).toBeDefined();
      expect(warningCall[0]).toMatchObject({
        taskId: 'task-1',
        phase: 'generating',
        warning: true,
        message: expect.stringContaining('⚠️ Generation at 50% of timeout'),
      });

      // Complete the process
      mockProcess.stdout.emit('data', Buffer.from('{}'));
      mockProcess.emit('close', 0);
      
      await batchPromise;
    });

    it('should stop timeout progress tracking on process completion', async () => {
      const timeoutWarningHandler = jest.fn();
      orchestrator.on('timeout:warning', timeoutWarningHandler);

      const batch: AITaskBatch = {
        id: 'batch-1',
        tasks: [createTestTask('task-1')],
        totalEstimatedTokens: 100,
        totalEstimatedCost: 0.01,
        maxConcurrency: 1,
      };

      const batchPromise = orchestrator.processBatch(batch);
      await Promise.resolve();

      // Complete the process quickly (before any warnings)
      mockProcess.stdout.emit('data', Buffer.from('{}'));
      mockProcess.emit('close', 0);
      
      await batchPromise;

      // Advance time past all warning thresholds
      await TimerTestUtils.advanceTimersAndFlush(60000);

      // No warnings should have been emitted
      expect(timeoutWarningHandler).not.toHaveBeenCalled();
    });

    it('should only emit each threshold warning once', async () => {
      const timeoutWarningHandler = jest.fn();
      orchestrator.on('timeout:warning', timeoutWarningHandler);

      const batch: AITaskBatch = {
        id: 'batch-1',
        tasks: [createTestTask('task-1')],
        totalEstimatedTokens: 100,
        totalEstimatedCost: 0.01,
        maxConcurrency: 1,
      };

      const batchPromise = orchestrator.processBatch(batch);
      await Promise.resolve();

      // Advance to 55% of timeout (past 50% threshold)
      await TimerTestUtils.advanceTimersAndFlush(33000);

      // Should only have one warning for 50%
      expect(timeoutWarningHandler).toHaveBeenCalledTimes(1);
      expect(timeoutWarningHandler).toHaveBeenCalledWith(
        expect.objectContaining({ threshold: 50 })
      );

      // Advance more but stay below 75%
      await TimerTestUtils.advanceTimersAndFlush(5000); // Total 38 seconds (63%)

      // Still only one warning
      expect(timeoutWarningHandler).toHaveBeenCalledTimes(1);

      // Complete the process
      mockProcess.stdout.emit('data', Buffer.from('{}'));
      mockProcess.emit('close', 0);
      
      await batchPromise;
    });
  });

  describe('Logging and Events', () => {
    it('should log warnings for slow and dead processes', async () => {
      const batch: AITaskBatch = {
        id: 'batch-1',
        tasks: [createTestTask('task-1')],
        totalEstimatedTokens: 100,
        totalEstimatedCost: 0.01,
        maxConcurrency: 1,
      };

      const batchPromise = orchestrator.processBatch(batch);
      
      // Allow process to start and heartbeat monitoring to be set up
      await Promise.resolve();
      await Promise.resolve();
      
      // Trigger slow process warning - advance past heartbeat interval
      await TimerTestUtils.advanceTimersAndFlush(30000); // First interval
      await Promise.resolve();
      await TimerTestUtils.advanceTimersAndFlush(5000); // Past the interval to trigger slow
      await Promise.resolve();
      
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Process task-1 is slow')
      );

      // Trigger dead process warning - advance past dead threshold
      await TimerTestUtils.advanceTimersAndFlush(30000); // Second interval (65s total)
      await Promise.resolve();
      await TimerTestUtils.advanceTimersAndFlush(30000); // Third interval (95s total)
      await Promise.resolve();
      await TimerTestUtils.advanceTimersAndFlush(30000); // Fourth interval (125s total, past 120s threshold)
      await Promise.resolve();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Process task-1 appears to be dead')
      );

      // Clean up
      mockProcess.emit('close', 1);
      try {
        await batchPromise;
      } catch (error) {
        // Expected
      }
    });
  });
});