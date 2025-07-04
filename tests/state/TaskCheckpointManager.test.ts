/**
 * Tests for TaskCheckpointManager
 */

import { TaskCheckpointManager } from '../../src/state/TaskCheckpointManager';
import type { AITask } from '../../src/ai/AITaskPreparation';
import { promises as fs } from 'fs';
import path from 'path';
import { tmpdir } from 'os';

describe('TaskCheckpointManager', () => {
  let checkpointManager: TaskCheckpointManager;
  let testProjectPath: string;

  beforeEach(async () => {
    // Create temporary directory for testing
    testProjectPath = path.join(tmpdir(), `claude-testing-${Date.now()}`);
    await fs.mkdir(testProjectPath, { recursive: true });
    
    checkpointManager = new TaskCheckpointManager(testProjectPath);
    await checkpointManager.initialize();
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testProjectPath, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  const createMockTask = (id: string = 'test-task-1'): AITask => ({
    id,
    sourceFile: '/test/source.js',
    testFile: '/test/source.test.js',
    priority: 1,
    complexity: 5,
    prompt: 'Generate tests for this file',
    context: {
      sourceCode: 'function test() { return true; }',
      existingTests: '',
      dependencies: [],
      missingScenarios: ['should test basic functionality'],
      frameworkInfo: {
        language: 'javascript',
        testFramework: 'jest',
        moduleType: 'esm',
        hasTypeScript: false,
      },
    },
    estimatedTokens: 1000,
    estimatedCost: 0.01,
    status: 'pending',
  });

  describe('checkpoint creation', () => {
    it('should create a new checkpoint for a task', async () => {
      const task = createMockTask();
      const checkpointId = await checkpointManager.createCheckpoint(task, 'preparing');

      expect(checkpointId).toBeDefined();
      expect(checkpointId).toMatch(/^cp_[a-f0-9]{12}_\d+$/);

      const summary = await checkpointManager.getCheckpointSummary();
      expect(summary.activeCheckpoints).toBe(1);
      expect(summary.totalCheckpoints).toBe(1);
    });

    it('should initialize checkpoint directory structure', async () => {
      const checkpointDir = path.join(testProjectPath, '.claude-testing', 'checkpoints');
      
      // Check directories exist
      await expect(fs.access(path.join(checkpointDir, 'active'))).resolves.toBeUndefined();
      await expect(fs.access(path.join(checkpointDir, 'completed'))).resolves.toBeUndefined();
      await expect(fs.access(path.join(checkpointDir, 'failed'))).resolves.toBeUndefined();
      
      // Check index file exists
      await expect(fs.access(path.join(checkpointDir, 'index.json'))).resolves.toBeUndefined();
    });
  });

  describe('checkpoint updates', () => {
    it('should update checkpoint progress and state', async () => {
      const task = createMockTask();
      const checkpointId = await checkpointManager.createCheckpoint(task, 'preparing');

      await checkpointManager.updateCheckpoint(checkpointId, {
        phase: 'generating',
        progress: 50,
        partialResult: {
          generatedContent: 'describe("test", () => { it("should work", () => { expect(true).toBe(true); }); });',
          tokensUsed: 100,
          estimatedCost: 0.005,
        },
        state: {
          outputBytes: 1024,
          elapsedTime: 30000,
        },
      });

      // Verify checkpoint was updated by checking if we can resume
      const resumeInfo = await checkpointManager.canResume(task);
      expect(resumeInfo.canResume).toBe(true); // Should be true because progress is at 50% (above 10% threshold and not in preparing phase)
    });
  });

  describe('checkpoint resume capability', () => {
    it('should detect when a task can be resumed', async () => {
      const task = createMockTask();
      const checkpointId = await checkpointManager.createCheckpoint(task, 'preparing');

      // Update to significant progress
      await checkpointManager.updateCheckpoint(checkpointId, {
        phase: 'generating',
        progress: 75,
        partialResult: {
          generatedContent: 'Significant test content...',
          tokensUsed: 750,
          estimatedCost: 0.0075,
        },
      });

      const resumeInfo = await checkpointManager.canResume(task);
      expect(resumeInfo.canResume).toBe(true);
      expect(resumeInfo.checkpointId).toBe(checkpointId);
      expect(resumeInfo.lastProgress).toBe(75);
    });

    it('should not resume if task context has changed', async () => {
      const task = createMockTask();
      const checkpointId = await checkpointManager.createCheckpoint(task, 'preparing');

      // Update to significant progress
      await checkpointManager.updateCheckpoint(checkpointId, {
        phase: 'generating',
        progress: 75,
      });

      // Change the task prompt (different context)
      const modifiedTask = { ...task, prompt: 'Different prompt for test generation' };

      const resumeInfo = await checkpointManager.canResume(modifiedTask);
      expect(resumeInfo.canResume).toBe(false);
    });
  });

  describe('checkpoint completion and failure', () => {
    it('should complete a checkpoint successfully', async () => {
      const task = createMockTask();
      const checkpointId = await checkpointManager.createCheckpoint(task, 'preparing');

      const result = {
        generatedTests: 'Final test content',
        tokensUsed: 1000,
        actualCost: 0.01,
        duration: 60000,
      };

      await checkpointManager.completeCheckpoint(checkpointId, result);

      const summary = await checkpointManager.getCheckpointSummary();
      expect(summary.activeCheckpoints).toBe(0); // Should be moved to completed
    });

    it('should handle checkpoint failure', async () => {
      const task = createMockTask();
      const checkpointId = await checkpointManager.createCheckpoint(task, 'preparing');

      await checkpointManager.failCheckpoint(checkpointId, 'Timeout error');

      const summary = await checkpointManager.getCheckpointSummary();
      expect(summary.activeCheckpoints).toBe(1); // Should still be active for retry
    });

    it('should move checkpoint to failed after multiple failures', async () => {
      const task = createMockTask();
      const checkpointId = await checkpointManager.createCheckpoint(task, 'preparing');

      // Fail the checkpoint multiple times
      await checkpointManager.failCheckpoint(checkpointId, 'Error 1');
      await checkpointManager.failCheckpoint(checkpointId, 'Error 2');
      await checkpointManager.failCheckpoint(checkpointId, 'Error 3');

      const summary = await checkpointManager.getCheckpointSummary();
      expect(summary.activeCheckpoints).toBe(0); // Should be moved to failed
    });
  });

  describe('checkpoint resume functionality', () => {
    it('should create proper resume prompt with partial content', async () => {
      const task = createMockTask();
      const checkpointId = await checkpointManager.createCheckpoint(task, 'preparing');

      await checkpointManager.updateCheckpoint(checkpointId, {
        phase: 'generating',
        progress: 60,
        partialResult: {
          generatedContent: 'describe("partial test", () => { it("should work",',
          tokensUsed: 150,
          estimatedCost: 0.006,
        },
      });

      const resumeInfo = await checkpointManager.resumeFromCheckpoint(checkpointId);
      
      expect(resumeInfo.resumePrompt).toContain('RESUME FROM CHECKPOINT');
      expect(resumeInfo.resumePrompt).toContain('Previous progress: 60%');
      expect(resumeInfo.resumePrompt).toContain('Previous partial output');
      expect(resumeInfo.estimatedRemainingTokens).toBeLessThan(task.estimatedTokens);
      expect(resumeInfo.estimatedRemainingTokens).toBeGreaterThan(0);
    });
  });

  describe('checkpoint cleanup', () => {
    it('should clean up old checkpoints', async () => {
      const task1 = createMockTask('task-1');
      const task2 = createMockTask('task-2');
      
      const checkpoint1 = await checkpointManager.createCheckpoint(task1, 'preparing');
      await checkpointManager.createCheckpoint(task2, 'preparing');

      // Update one checkpoint to be significant
      await checkpointManager.updateCheckpoint(checkpoint1, {
        progress: 50,
        phase: 'generating',
      });

      const summary = await checkpointManager.getCheckpointSummary();
      expect(summary.totalCheckpoints).toBe(2);

      // Clean up checkpoints older than 0ms (should clean all)
      const cleanedCount = await checkpointManager.cleanupOldCheckpoints(0);
      expect(cleanedCount).toBeGreaterThan(0);
    });
  });

  describe('checkpoint summary', () => {
    it('should provide accurate checkpoint summary', async () => {
      const task1 = createMockTask('task-1');
      const task2 = createMockTask('task-2');
      const task3 = createMockTask('task-3');
      
      await checkpointManager.createCheckpoint(task1, 'preparing');
      const checkpoint2 = await checkpointManager.createCheckpoint(task2, 'generating');
      const checkpoint3 = await checkpointManager.createCheckpoint(task3, 'processing');

      // Make checkpoint2 and checkpoint3 recoverable
      await checkpointManager.updateCheckpoint(checkpoint2, {
        progress: 30,
        phase: 'generating',
      });
      await checkpointManager.updateCheckpoint(checkpoint3, {
        progress: 70,
        phase: 'processing',
      });

      const summary = await checkpointManager.getCheckpointSummary();
      
      expect(summary.totalCheckpoints).toBe(3);
      expect(summary.activeCheckpoints).toBe(3);
      expect(summary.recoverableCheckpoints).toHaveLength(2); // Only checkpoint2 and checkpoint3 have progress > 10%
      expect(summary.oldestCheckpoint).toBeDefined();
      expect(summary.newestCheckpoint).toBeDefined();
    });
  });
});