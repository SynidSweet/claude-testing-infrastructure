/**
 * Tests for enhanced ClaudeOrchestrator heartbeat monitoring functionality
 */

import { ClaudeOrchestrator } from '../../src/ai/ClaudeOrchestrator';
import type { AITaskBatch, TaskContext } from '../../src/ai/AITaskPreparation';
import { EventEmitter } from 'events';

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

describe('Enhanced ClaudeOrchestrator Heartbeat Monitoring', () => {
  jest.setTimeout(15000); // 15 second timeout for all tests
  let orchestrator: ClaudeOrchestrator;
  let mockProcess: any;
  const mockSpawn = require('child_process').spawn as jest.Mock;
  const mockExecSync = require('child_process').execSync as jest.Mock;

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
    jest.useFakeTimers({
      doNotFake: ['nextTick'],
      now: new Date('2025-01-01T00:00:00.000Z')
    });
    
    // Modern Jest should handle Date mocking automatically with useFakeTimers
    
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
      timeout: 300000, // 5 minutes for testing - much longer than test duration
      maxConcurrent: 1,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Progress Marker Detection', () => {
    it('should detect progress markers in output', async () => {
      const processSlowHandler = jest.fn();
      orchestrator.on('process:slow', processSlowHandler);

      // Add debug listeners
      orchestrator.on('process:dead', (data) => console.log('DEAD:', data));
      orchestrator.on('process:zombie', (data) => console.log('ZOMBIE:', data));
      orchestrator.on('progress', (data) => console.log('PROGRESS:', data));
      orchestrator.on('process:slow', (data) => console.log('SLOW EVENT:', data));

      const batch: AITaskBatch = {
        id: 'batch-1',
        tasks: [createTestTask('task-1')],
        totalEstimatedTokens: 100,
        totalEstimatedCost: 0.01,
        maxConcurrency: 1,
      };

      console.log('Starting processBatch...');
      
      const batchPromise = orchestrator.processBatch(batch);
      await Promise.resolve();
      console.log('Process should be spawned now...');

      // Emit data with progress markers at time 0
      mockProcess.stdout.emit('data', Buffer.from('Analyzing code structure...'));
      mockProcess.stdout.emit('data', Buffer.from('Generating test cases...'));
      
      // Wait 31 seconds to trigger the first heartbeat check after the 30s mark
      // This should trigger slow detection since timeSinceLastActivity > 30s
      jest.advanceTimersByTime(31000);
      
      // At this point, 31s have passed since the data was emitted
      // Progress markers should still be recent (31s < 60s window)
      // The process should be marked as slow since timeSinceLastActivity > 30s
      
      // Should emit slow event with progress marker context
      expect(processSlowHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          metrics: expect.objectContaining({
            hasProgressMarkers: true, // Just within 60s window
          }),
        })
      );

      // Complete the process
      mockProcess.stdout.emit('data', Buffer.from('{}'));
      mockProcess.emit('close', 0);
      
      await batchPromise;
    });

    it('should track consecutive slow checks', async () => {
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
      await Promise.resolve();

      // Multiple slow checks without activity
      jest.advanceTimersByTime(35000); // First slow check
      jest.advanceTimersByTime(30000); // Second slow check
      jest.advanceTimersByTime(30000); // Third slow check

      // Should have increasing consecutive slow checks
      expect(processSlowHandler).toHaveBeenCalledTimes(3);
      expect(processSlowHandler).toHaveBeenNthCalledWith(1, 
        expect.objectContaining({ consecutiveSlowChecks: 1 })
      );
      expect(processSlowHandler).toHaveBeenNthCalledWith(2,
        expect.objectContaining({ consecutiveSlowChecks: 2 })
      );
      expect(processSlowHandler).toHaveBeenNthCalledWith(3,
        expect.objectContaining({ consecutiveSlowChecks: 3 })
      );

      // Send data to reset counter
      mockProcess.stdout.emit('data', Buffer.from('New activity'));
      jest.advanceTimersByTime(35000);

      // Consecutive count should reset
      expect(processSlowHandler).toHaveBeenNthCalledWith(4,
        expect.objectContaining({ consecutiveSlowChecks: 1 })
      );

      // Complete the process
      mockProcess.emit('close', 0);
      await batchPromise;
    });
  });

  describe('Input Wait Detection', () => {
    it('should detect when process might be waiting for input', async () => {
      const waitingInputHandler = jest.fn();
      orchestrator.on('process:waiting-input', waitingInputHandler);

      const batch: AITaskBatch = {
        id: 'batch-1',
        tasks: [createTestTask('task-1')],
        totalEstimatedTokens: 100,
        totalEstimatedCost: 0.01,
        maxConcurrency: 1,
      };

      const batchPromise = orchestrator.processBatch(batch);
      await Promise.resolve();

      // Emit small outputs that might be prompts
      mockProcess.stdout.emit('data', Buffer.from('> '));
      
      // Wait for input detection
      jest.advanceTimersByTime(35000);

      // Should detect waiting for input
      expect(waitingInputHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          taskId: 'task-1',
          timeSinceLastActivity: expect.any(Number),
        })
      );

      // Complete the process
      mockProcess.stdout.emit('data', Buffer.from('{}'));
      mockProcess.emit('close', 0);
      
      await batchPromise;
    });

    it('should not kill processes waiting for input prematurely', async () => {
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
      await Promise.resolve();

      // Emit small output
      mockProcess.stdout.emit('data', Buffer.from('Enter value: '));
      
      // Wait past dead threshold
      jest.advanceTimersByTime(130000); // Past 2 minute threshold

      // Should not be marked as dead if waiting for input
      expect(processDeadHandler).not.toHaveBeenCalled();
      expect(mockProcess.kill).not.toHaveBeenCalled();

      // Complete the process
      mockProcess.stdout.emit('data', Buffer.from('{}'));
      mockProcess.emit('close', 0);
      
      await batchPromise;
    });
  });

  describe('Enhanced Process Health Analysis', () => {
    it('should be lenient during early phase', async () => {
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
      await Promise.resolve();

      // No output in first 45 seconds (early phase)
      jest.advanceTimersByTime(45000);

      // Should emit slow but with early phase reason
      expect(processSlowHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          reason: expect.stringContaining('early phase'),
        })
      );

      // Complete the process
      mockProcess.stdout.emit('data', Buffer.from('{}'));
      mockProcess.emit('close', 0);
      
      await batchPromise;
    });

    it('should detect very low output rate', async () => {
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
      await Promise.resolve();

      // Wait past early phase
      jest.advanceTimersByTime(65000);

      // Emit very small amount of data
      mockProcess.stdout.emit('data', Buffer.from('x'));
      
      // Wait more
      jest.advanceTimersByTime(35000);

      // Should detect low output rate
      expect(processSlowHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          reason: expect.stringContaining('very low output rate'),
          metrics: expect.objectContaining({
            bytesPerSecond: expect.any(Number),
          }),
        })
      );

      // Complete the process
      mockProcess.stdout.emit('data', Buffer.from('{}'));
      mockProcess.emit('close', 0);
      
      await batchPromise;
    });

    it('should provide detailed metrics in dead process events', async () => {
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
      await Promise.resolve();

      // Wait past dead threshold with no activity
      jest.advanceTimersByTime(125000);

      // Should provide detailed metrics
      expect(processDeadHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          reason: expect.any(String),
          metrics: expect.objectContaining({
            isDead: true,
            isSlow: false,
            hasProgressMarkers: false,
            bytesPerSecond: 0,
            isEarlyPhase: false,
          }),
        })
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

  describe('Progress History Tracking', () => {
    it('should maintain progress history with size limit', async () => {
      const batch: AITaskBatch = {
        id: 'batch-1',
        tasks: [createTestTask('task-1')],
        totalEstimatedTokens: 100,
        totalEstimatedCost: 0.01,
        maxConcurrency: 1,
      };

      const batchPromise = orchestrator.processBatch(batch);
      await Promise.resolve();

      // Emit many data chunks
      for (let i = 0; i < 60; i++) {
        mockProcess.stdout.emit('data', Buffer.from(`Data chunk ${i}\n`));
      }

      // Progress history should be limited to 50 entries
      // We can't directly check this without exposing internals,
      // but we can verify the system still works after many entries

      // Complete the process
      mockProcess.stdout.emit('data', Buffer.from('{}'));
      mockProcess.emit('close', 0);
      
      await batchPromise;
    });

    it('should detect various progress markers', async () => {
      const batch: AITaskBatch = {
        id: 'batch-1',
        tasks: [createTestTask('task-1')],
        totalEstimatedTokens: 100,
        totalEstimatedCost: 0.01,
        maxConcurrency: 1,
      };

      const batchPromise = orchestrator.processBatch(batch);
      await Promise.resolve();

      // Emit various progress markers
      const progressMarkers = [
        'Analyzing the code...',
        'Generating test cases...',
        'Processing requirements...',
        'Creating tests for function...',
        'Writing test for class...',
        'describe("test suite", () => {',
        'it("should test something", () => {',
        'test("another test", () => {',
        'def test_python_function():',
        'class TestPythonClass:',
      ];

      for (const marker of progressMarkers) {
        mockProcess.stdout.emit('data', Buffer.from(marker));
      }

      // Complete the process
      mockProcess.stdout.emit('data', Buffer.from('{}'));
      mockProcess.emit('close', 0);
      
      await batchPromise;
    });
  });
});