/**
 * Mock Claude Orchestrator Tests
 * 
 * Tests the MockClaudeOrchestrator implementation to ensure it properly
 * records process spawn attempts without actually spawning real processes.
 * This validates Phase 3 of REF-ARCH-001: Mock-First Validation Tests.
 */

import { MockClaudeOrchestrator } from '../../src/ai/MockClaudeOrchestrator';
import { AITestHarness } from '../../src/ai/AITestHarness';
import { ProcessContext } from '../../src/types/process-types';

describe('MockClaudeOrchestrator', () => {
  let mockOrchestrator: MockClaudeOrchestrator;
  let testHarness: AITestHarness;

  beforeEach(() => {
    mockOrchestrator = new MockClaudeOrchestrator({
      maxConcurrent: 2,
      model: 'sonnet',
      timeout: 5000
    }, ProcessContext.VALIDATION_TEST);
    
    testHarness = new AITestHarness();
  });

  describe('Process Spawn Recording', () => {
    test('should record process spawn attempts without real processes', async () => {
      // Clear any existing history
      mockOrchestrator.clearSpawnHistory();
      
      // Create test scenario
      const scenario = testHarness.createReactComponentScenario('TestComponent');
      const batch = testHarness.createTaskBatch(scenario);
      
      // Set up mock response
      mockOrchestrator.setDefaultMockResponses({
        success: true,
        generatedTests: 'mock test content',
        tokenCount: 150,
        cost: 0.001,
        duration: 2000
      });
      
      // Process batch
      const results = await mockOrchestrator.processBatch(batch);
      
      // Verify results
      expect(results).toHaveLength(1);
      expect(results[0]?.success).toBe(true);
      expect(results[0]?.result?.generatedTests).toBe('mock test content');
      
      // Verify spawn history
      const spawnHistory = mockOrchestrator.getSpawnHistory();
      expect(spawnHistory).toHaveLength(1);
      expect(spawnHistory[0]?.taskId).toBe(scenario.tasks[0]?.id);
      expect(spawnHistory[0]?.context).toBe(ProcessContext.VALIDATION_TEST);
      expect(spawnHistory[0]?.model).toBe('sonnet');
      expect(spawnHistory[0]?.prompt).toBe(scenario.tasks[0]?.prompt);
    });

    test('should record multiple task spawns in batch processing', async () => {
      mockOrchestrator.clearSpawnHistory();
      
      // Create batch scenario with multiple tasks
      const batchScenario = testHarness.createBatchScenario();
      const batch = testHarness.createTaskBatch(batchScenario);
      
      mockOrchestrator.setDefaultMockResponses({
        success: true,
        generatedTests: 'mock batch test content',
        tokenCount: 200,
        cost: 0.002,
        duration: 1500
      });
      
      const results = await mockOrchestrator.processBatch(batch);
      
      // Verify all tasks processed
      expect(results).toHaveLength(batchScenario.tasks.length);
      results.forEach(result => {
        expect(result.success).toBe(true);
      });
      
      // Verify all spawns recorded
      const spawnHistory = mockOrchestrator.getSpawnHistory();
      expect(spawnHistory).toHaveLength(batchScenario.tasks.length);
      
      // Verify each spawn record
      spawnHistory.forEach((spawn, index) => {
        expect(spawn?.taskId).toBe(batchScenario.tasks[index]?.id);
        expect(spawn?.context).toBe(ProcessContext.VALIDATION_TEST);
        expect(spawn?.model).toBe('sonnet');
      });
    });

    test('should record spawn attempts even for failed tasks', async () => {
      mockOrchestrator.clearSpawnHistory();
      
      // Create failure scenario
      const failureScenario = testHarness.createFailureScenario();
      const batch = testHarness.createTaskBatch(failureScenario);
      
      // Set up mock failure response
      mockOrchestrator.setDefaultMockResponses({
        success: false,
        error: 'Mock processing error',
        duration: 500
      });
      
      const results = await mockOrchestrator.processBatch(batch);
      
      // Verify failure handling
      expect(results).toHaveLength(1);
      expect(results[0]?.success).toBe(false);
      expect(results[0]?.error).toBe('Mock processing error');
      
      // Verify spawn was still recorded
      const spawnHistory = mockOrchestrator.getSpawnHistory();
      expect(spawnHistory).toHaveLength(1);
      expect(spawnHistory[0]?.taskId).toBe(failureScenario.tasks[0]?.id);
      expect(spawnHistory[0]?.context).toBe(ProcessContext.VALIDATION_TEST);
    });
  });

  describe('Authentication Simulation', () => {
    test('should simulate different authentication states', () => {
      // Test default degraded state
      let authStatus = mockOrchestrator.validateClaudeAuth();
      expect(authStatus.authenticated).toBe(false);
      expect(authStatus.canDegrade).toBe(true);
      expect(authStatus.error).toContain('Mock Claude CLI not available');
      
      // Test authenticated state
      process.env.MOCK_CLAUDE_AUTH = 'authenticated';
      authStatus = mockOrchestrator.validateClaudeAuth();
      expect(authStatus.authenticated).toBe(true);
      expect(authStatus.canDegrade).toBe(false);
      
      // Test failed state
      process.env.MOCK_CLAUDE_AUTH = 'failed';
      authStatus = mockOrchestrator.validateClaudeAuth();
      expect(authStatus.authenticated).toBe(false);
      expect(authStatus.canDegrade).toBe(false);
      expect(authStatus.error).toBe('Mock authentication failure');
      
      // Reset to default
      delete process.env.MOCK_CLAUDE_AUTH;
    });
  });

  describe('Emergency Operations', () => {
    test('should record emergency shutdown calls', () => {
      mockOrchestrator.clearSpawnHistory();
      
      // Trigger emergency shutdown
      mockOrchestrator.emergencyShutdown('Test emergency shutdown');
      
      // Verify shutdown was recorded
      const spawnHistory = mockOrchestrator.getSpawnHistory();
      expect(spawnHistory).toHaveLength(1);
      expect(spawnHistory[0]?.taskId).toBe('emergency-shutdown');
      expect(spawnHistory[0]?.prompt).toContain('Emergency shutdown: Test emergency shutdown');
      
      // Verify stats updated
      const stats = mockOrchestrator.getStats();
      expect(stats.sessionUsage.usageWarnings).toBe(1);
      expect(stats.endTime).toBeDefined();
    });

    test('should record killAll operations', async () => {
      mockOrchestrator.clearSpawnHistory();
      
      // Trigger killAll
      await mockOrchestrator.killAll();
      
      // Verify killAll was recorded
      const spawnHistory = mockOrchestrator.getSpawnHistory();
      expect(spawnHistory).toHaveLength(1);
      expect(spawnHistory[0]?.taskId).toBe('kill-all');
      expect(spawnHistory[0]?.prompt).toBe('Kill all processes');
    });
  });

  describe('Mock Response Configuration', () => {
    test('should use specific task responses when configured', async () => {
      mockOrchestrator.clearSpawnHistory();
      
      const scenario = testHarness.createUtilityFunctionScenario();
      const batch = testHarness.createTaskBatch(scenario);
      
      // Set specific response for this task
      const taskId = scenario.tasks[0]?.id;
      if (taskId) {
        mockOrchestrator.setMockResponse(taskId, {
          taskId: taskId,
          generatedTests: 'specific mock response',
          success: true,
          tokenCount: 300,
          cost: 0.003,
          duration: 3000
        });
      }
      
      const results = await mockOrchestrator.processBatch(batch);
      
      expect(results[0]?.result?.generatedTests).toBe('specific mock response');
      expect(results[0]?.result?.tokensUsed).toBe(300);
      expect(results[0]?.result?.actualCost).toBe(0.003);
    });

    test('should fall back to default responses', async () => {
      mockOrchestrator.clearSpawnHistory();
      
      const scenario = testHarness.createReactComponentScenario('FallbackTest');
      const batch = testHarness.createTaskBatch(scenario);
      
      // Set only default response
      mockOrchestrator.setDefaultMockResponses({
        success: true,
        generatedTests: 'default fallback response',
        tokenCount: 100,
        cost: 0.001,
        duration: 1000
      });
      
      const results = await mockOrchestrator.processBatch(batch);
      
      expect(results[0]?.result?.generatedTests).toBe('default fallback response');
      expect(results[0]?.result?.tokensUsed).toBe(100);
    });

    test('should generate built-in default when no responses configured', async () => {
      mockOrchestrator.clearSpawnHistory();
      
      const scenario = testHarness.createReactComponentScenario('DefaultTest');
      const batch = testHarness.createTaskBatch(scenario);
      
      // Don't set any mock responses
      const results = await mockOrchestrator.processBatch(batch);
      
      expect(results[0]?.success).toBe(true);
      expect(results[0]?.result?.generatedTests).toContain('Mock generated test');
      expect(results[0]?.result?.generatedTests).toContain('DefaultTest');
      expect(results[0]?.result?.tokensUsed).toBe(150);
    });
  });

  describe('Stats Tracking', () => {
    test('should track processing statistics', async () => {
      mockOrchestrator.clearSpawnHistory();
      
      const scenario = testHarness.createBatchScenario();
      const batch = testHarness.createTaskBatch(scenario);
      
      mockOrchestrator.setDefaultMockResponses({
        success: true,
        generatedTests: 'stats test',
        tokenCount: 250,
        cost: 0.0025,
        duration: 2000
      });
      
      await mockOrchestrator.processBatch(batch);
      
      const stats = mockOrchestrator.getStats();
      expect(stats.totalTasks).toBe(scenario.tasks.length);
      expect(stats.completedTasks).toBe(scenario.tasks.length);
      expect(stats.failedTasks).toBe(0);
      expect(stats.totalTokensUsed).toBe(250 * scenario.tasks.length);
      expect(stats.totalCost).toBe(0.0025 * scenario.tasks.length);
      expect(stats.sessionUsage.processesSpawned).toBe(scenario.tasks.length);
    });

    test('should track failures in statistics', async () => {
      mockOrchestrator.clearSpawnHistory();
      
      const scenario = testHarness.createFailureScenario();
      const batch = testHarness.createTaskBatch(scenario);
      
      mockOrchestrator.setDefaultMockResponses({
        success: false,
        error: 'Stats failure test',
        duration: 1000
      });
      
      await mockOrchestrator.processBatch(batch);
      
      const stats = mockOrchestrator.getStats();
      expect(stats.totalTasks).toBe(1);
      expect(stats.completedTasks).toBe(0);
      expect(stats.failedTasks).toBe(1);
      expect(stats.sessionUsage.processesSpawned).toBe(1);
    });
  });

  describe('Context Validation', () => {
    test('should maintain validation test context', async () => {
      mockOrchestrator.clearSpawnHistory();
      
      const scenario = testHarness.createReactComponentScenario('ContextTest');
      const batch = testHarness.createTaskBatch(scenario);
      
      await mockOrchestrator.processBatch(batch);
      
      const spawnHistory = mockOrchestrator.getSpawnHistory();
      expect(spawnHistory).toHaveLength(1);
      expect(spawnHistory[0]?.context).toBe(ProcessContext.VALIDATION_TEST);
    });

    test('should work with different process contexts', () => {
      const testContextOrchestrator = new MockClaudeOrchestrator({
        model: 'haiku'
      }, ProcessContext.TEST_GENERATION);
      
      const authStatus = testContextOrchestrator.validateClaudeAuth();
      expect(authStatus).toBeDefined();
      
      // Context should be preserved in spawn records
      testContextOrchestrator.emergencyShutdown('Context test');
      const spawnHistory = testContextOrchestrator.getSpawnHistory();
      expect(spawnHistory[0]?.context).toBe(ProcessContext.TEST_GENERATION);
    });
  });
});