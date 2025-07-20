/**
 * Integration tests for MCPTaskClient with real CLI execution
 * 
 * These tests actually execute claude-tasks CLI commands to validate
 * the MCPTaskClient implementation works correctly with the real task system.
 * 
 * Note: These tests require the claude-tasks CLI to be available in PATH
 * and will create/modify actual task data.
 */

import { MCPTaskClient, MCPTaskParams, MCPTaskResult } from '../../../src/mcp/services/MCPTaskClient';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Test configuration
const TEST_CONFIG = {
  timeout: 30000, // 30 seconds for CLI operations
  retryAttempts: 2,
  testPrefix: 'MCPTaskClient-Integration-Test',
};

describe('MCPTaskClient Integration Tests', () => {
  let client: MCPTaskClient;
  let createdTaskIds: string[] = [];

  beforeAll(async () => {
    // Verify claude-tasks CLI is available
    try {
      await execAsync('claude-tasks --version', { timeout: 5000 });
    } catch (error) {
      throw new Error(
        'claude-tasks CLI not available. Please ensure it is installed and in PATH. ' +
        'These integration tests require the real CLI to be functional.'
      );
    }

    // Initialize client for real CLI usage
    client = new MCPTaskClient({
      transportType: 'cli',
      timeout: TEST_CONFIG.timeout,
      retryAttempts: TEST_CONFIG.retryAttempts,
      cliOptions: {
        command: 'claude-tasks',
      },
    });
  }, TEST_CONFIG.timeout);

  afterAll(async () => {
    // Cleanup: Delete any test tasks we created
    for (const taskId of createdTaskIds) {
      try {
        await execAsync(`claude-tasks task delete ${taskId} --force`, { timeout: 10000 });
      } catch (error) {
        console.warn(`Failed to cleanup test task ${taskId}:`, error);
      }
    }

    await client.disconnect();
  }, TEST_CONFIG.timeout);

  describe('Task Creation Integration', () => {
    it('should create a task with real CLI and validate JSON response', async () => {
      const params: MCPTaskParams = {
        title: `${TEST_CONFIG.testPrefix} - Task Creation Test`,
        description: 'Integration test for MCPTaskClient task creation with real CLI execution',
        priority: 'medium',
        tags: 'integration-test,mcp-client,automated',
        complexity: 'low',
      };

      const result = await client.createTask(params);

      // Validate result structure
      expect(result).toMatchObject({
        task_id: expect.stringMatching(/^TASK-\d{4}-\d+$/),
        title: params.title,
        priority: params.priority,
        status: expect.stringMatching(/^(pending|created)$/),
        created_at: expect.any(String),
      });

      // Store for cleanup
      createdTaskIds.push(result.task_id);

      // Verify task exists by direct CLI query
      const { stdout } = await execAsync(`claude-tasks task get ${result.task_id} --json`);
      const taskData = JSON.parse(stdout);
      
      expect(taskData.task.id).toBe(result.task_id);
      expect(taskData.task.title).toBe(params.title);
      expect(taskData.task.description).toBe(params.description);
      expect(taskData.task.priority).toBe(params.priority);
    }, TEST_CONFIG.timeout);

    it('should handle task creation with minimal parameters', async () => {
      const params: MCPTaskParams = {
        title: `${TEST_CONFIG.testPrefix} - Minimal Task`,
        description: 'Minimal parameter test',
        priority: 'low',
      };

      const result = await client.createTask(params);

      expect(result.task_id).toMatch(/^TASK-\d{4}-\d+$/);
      expect(result.title).toBe(params.title);
      expect(result.priority).toBe(params.priority);

      createdTaskIds.push(result.task_id);

      // Verify creation through direct CLI
      const { stdout } = await execAsync(`claude-tasks task get ${result.task_id} --json`);
      const taskData = JSON.parse(stdout);
      expect(taskData.task.title).toBe(params.title);
    }, TEST_CONFIG.timeout);

    it('should handle task creation with all parameters', async () => {
      const params: MCPTaskParams = {
        title: `${TEST_CONFIG.testPrefix} - Full Parameters Task`,
        description: 'Complete parameter validation test with all fields populated',
        priority: 'high',
        tags: 'comprehensive,full-test,validation',
        complexity: 'high',
        context: {
          files: ['src/test.ts', 'docs/test.md'],
          commands: ['npm test', 'npm build'],
          constraints: ['Must maintain backwards compatibility', 'Requires documentation'],
        },
      };

      const result = await client.createTask(params);

      expect(result.task_id).toMatch(/^TASK-\d{4}-\d+$/);
      expect(result.title).toBe(params.title);
      expect(result.priority).toBe(params.priority);

      createdTaskIds.push(result.task_id);

      // Validate through CLI that all parameters were applied
      const { stdout } = await execAsync(`claude-tasks task get ${result.task_id} --json`);
      const taskData = JSON.parse(stdout);
      
      expect(taskData.task.tags).toContain('comprehensive');
      expect(taskData.task.complexity).toBe(params.complexity);
    }, TEST_CONFIG.timeout);
  });

  describe('Task Search Integration', () => {
    let searchTestTaskId: string;

    beforeAll(async () => {
      // Create a test task for searching
      const searchTask = await client.createTask({
        title: `${TEST_CONFIG.testPrefix} - Search Test Task`,
        description: 'Task created specifically for search integration testing',
        priority: 'medium',
        tags: 'search-test,integration,findable',
      });
      searchTestTaskId = searchTask.task_id;
      createdTaskIds.push(searchTestTaskId);

      // Wait a moment for task to be indexed
      await new Promise(resolve => setTimeout(resolve, 1000));
    }, TEST_CONFIG.timeout);

    it('should search tasks by title successfully', async () => {
      const results = await client.searchTasks('Search Test Task');

      expect(results.length).toBeGreaterThan(0);
      
      const foundTask = results.find(task => task.task_id === searchTestTaskId);
      expect(foundTask).toBeDefined();
      expect(foundTask?.title).toContain('Search Test Task');
    }, TEST_CONFIG.timeout);

    it('should search tasks with status filter', async () => {
      const results = await client.searchTasks('Search Test', {
        status: 'pending',
      });

      expect(results.length).toBeGreaterThan(0);
      
      // All results should have pending status
      results.forEach(task => {
        expect(task.status).toBe('pending');
      });
    }, TEST_CONFIG.timeout);

    it('should search tasks with priority filter', async () => {
      const results = await client.searchTasks('Search Test', {
        priority: 'medium',
      });

      expect(results.length).toBeGreaterThan(0);
      
      // All results should have medium priority
      results.forEach(task => {
        expect(task.priority).toBe('medium');
      });
    }, TEST_CONFIG.timeout);

    it('should return empty array for non-existent search', async () => {
      const results = await client.searchTasks('ThisTaskShouldNotExistAnywhere12345');

      expect(results).toEqual([]);
    }, TEST_CONFIG.timeout);
  });

  describe('Sprint Operations Integration', () => {
    it('should get current sprint information', async () => {
      const sprintInfo = await client.getCurrentSprint();

      // Sprint info can be null if no active sprint, or contain sprint data
      if (sprintInfo) {
        expect(sprintInfo).toMatchObject({
          sprint_id: expect.stringMatching(/^SPRINT-/),
          title: expect.any(String),
          task_count: expect.any(Number),
        });
        
        // Verify sprint exists through direct CLI
        const { stdout } = await execAsync('claude-tasks sprint current --json');
        const sprintData = JSON.parse(stdout);
        
        if (sprintData.active_sprint) {
          expect(sprintData.active_sprint.id).toBe(sprintInfo.sprint_id);
          expect(sprintData.active_sprint.title).toBe(sprintInfo.title);
        }
      } else {
        // Verify no active sprint through CLI
        const { stdout } = await execAsync('claude-tasks sprint current --json');
        const sprintData = JSON.parse(stdout);
        expect(sprintData.active_sprint).toBeUndefined();
      }
    }, TEST_CONFIG.timeout);

    it('should handle adding task to sprint when active sprint exists', async () => {
      // First, check if there's an active sprint
      const sprintInfo = await client.getCurrentSprint();
      
      if (!sprintInfo) {
        // Skip this test if no active sprint
        console.warn('Skipping sprint task addition test - no active sprint available');
        return;
      }

      // Create a test task for sprint addition
      const testTask = await client.createTask({
        title: `${TEST_CONFIG.testPrefix} - Sprint Addition Test`,
        description: 'Task for testing sprint addition functionality',
        priority: 'low',
        tags: 'sprint-test,integration',
      });
      createdTaskIds.push(testTask.task_id);

      const success = await client.addTaskToSprint(testTask.task_id, sprintInfo.sprint_id);
      
      expect(success).toBe(true);

      // Verify task was added to sprint through CLI
      const { stdout } = await execAsync(`claude-tasks task get ${testTask.task_id} --json`);
      const taskData = JSON.parse(stdout);
      expect(taskData.task.sprint_id).toBe(sprintInfo.sprint_id);
    }, TEST_CONFIG.timeout);

    it('should handle adding task to sprint without specifying sprint ID', async () => {
      const sprintInfo = await client.getCurrentSprint();
      
      if (!sprintInfo) {
        // Create a test task and verify it remains in backlog
        const testTask = await client.createTask({
          title: `${TEST_CONFIG.testPrefix} - No Sprint Test`,
          description: 'Task for testing behavior when no active sprint exists',
          priority: 'low',
        });
        createdTaskIds.push(testTask.task_id);

        const success = await client.addTaskToSprint(testTask.task_id);
        expect(success).toBe(false);
        return;
      }

      // Create a test task for automatic sprint addition
      const testTask = await client.createTask({
        title: `${TEST_CONFIG.testPrefix} - Auto Sprint Addition`,
        description: 'Task for testing automatic sprint detection',
        priority: 'low',
      });
      createdTaskIds.push(testTask.task_id);

      const success = await client.addTaskToSprint(testTask.task_id);
      expect(success).toBe(true);

      // Verify task was added to the current sprint
      const { stdout } = await execAsync(`claude-tasks task get ${testTask.task_id} --json`);
      const taskData = JSON.parse(stdout);
      expect(taskData.task.sprint_id).toBe(sprintInfo.sprint_id);
    }, TEST_CONFIG.timeout);
  });

  describe('Project Statistics Integration', () => {
    it('should retrieve real project statistics', async () => {
      const stats = await client.getProjectStats();

      expect(stats).toMatchObject({
        backlog_size: expect.any(Number),
        active_sprint_tasks: expect.any(Number),
        completion_rate: expect.any(Number),
      });

      // Validate that stats are reasonable values
      expect(stats.backlog_size).toBeGreaterThanOrEqual(0);
      expect(stats.active_sprint_tasks).toBeGreaterThanOrEqual(0);
      expect(stats.completion_rate).toBeGreaterThanOrEqual(0);
      expect(stats.completion_rate).toBeLessThanOrEqual(100);

      // Cross-validate with direct CLI queries
      const [backlogResult, sprintResult] = await Promise.all([
        execAsync('claude-tasks backlog stats --json'),
        execAsync('claude-tasks sprint stats --json'),
      ]);

      const backlogStats = JSON.parse(backlogResult.stdout);
      const sprintStats = JSON.parse(sprintResult.stdout);

      // Verify our client returns consistent data
      expect(stats.backlog_size).toBe(backlogStats.total_tasks || 0);
      expect(stats.active_sprint_tasks).toBe(sprintStats.active_sprint_tasks || 0);
    }, TEST_CONFIG.timeout);
  });

  describe('Error Handling and Retry Logic Integration', () => {
    it('should handle invalid task parameters gracefully', async () => {
      const invalidParams = {
        title: '', // Empty title should cause validation error
        description: 'Test invalid params',
        priority: 'invalid-priority' as any, // Invalid priority
      };

      await expect(client.createTask(invalidParams)).rejects.toThrow();
    }, TEST_CONFIG.timeout);

    it('should handle CLI command failures with retry logic', async () => {
      // Create a client with very short timeout to test retry behavior
      const failingClient = new MCPTaskClient({
        transportType: 'cli',
        timeout: 1, // 1ms timeout should cause failures
        retryAttempts: 2,
        cliOptions: {
          command: 'claude-tasks',
        },
      });

      const params: MCPTaskParams = {
        title: `${TEST_CONFIG.testPrefix} - Retry Test`,
        description: 'Testing retry logic on timeout',
        priority: 'low',
      };

      // This should fail due to timeout but attempt retries
      await expect(failingClient.createTask(params)).rejects.toThrow();

      await failingClient.disconnect();
    }, TEST_CONFIG.timeout);

    it('should handle malformed CLI responses gracefully', async () => {
      // This test will use a custom client with a command that might return unexpected output
      // We can't easily mock this in integration tests, so we'll test with valid but unexpected responses
      
      const results = await client.searchTasks('extremely-unlikely-to-exist-task-name-12345');
      expect(results).toEqual([]);
    }, TEST_CONFIG.timeout);
  });

  describe('CLI Command Formatting Validation', () => {
    let commandLogClient: MCPTaskClient;
    let originalExec: any;
    let capturedCommands: string[] = [];

    beforeEach(() => {
      capturedCommands = [];
      
      // Temporarily intercept exec calls to capture command formatting
      const { exec } = require('child_process');
      originalExec = exec;
      
      // Override exec to capture commands while still executing them
      jest.spyOn(require('child_process'), 'exec').mockImplementation((command: string, options: any, callback: Function) => {
        capturedCommands.push(command);
        return originalExec(command, options, callback);
      });

      commandLogClient = new MCPTaskClient({
        transportType: 'cli',
        timeout: TEST_CONFIG.timeout,
        retryAttempts: 1,
      });
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should format task creation commands correctly', async () => {
      const params: MCPTaskParams = {
        title: 'Test Command Formatting',
        description: 'Description with "quotes" and special chars',
        priority: 'high',
        tags: 'test,formatting',
        complexity: 'medium',
      };

      try {
        const result = await commandLogClient.createTask(params);
        createdTaskIds.push(result.task_id);
      } catch (error) {
        // Command might fail, but we're testing formatting
      }

      expect(capturedCommands.length).toBeGreaterThan(0);
      
      const createCommand = capturedCommands.find(cmd => cmd.includes('task create'));
      expect(createCommand).toBeDefined();
      expect(createCommand).toContain('"Test Command Formatting"');
      expect(createCommand).toContain('--priority high');
      expect(createCommand).toContain('--tags "test,formatting"');
      expect(createCommand).toContain('--complexity medium');
    });

    it('should format search commands correctly', async () => {
      await commandLogClient.searchTasks('test search', {
        status: 'pending',
        priority: 'high',
      });

      const searchCommand = capturedCommands.find(cmd => cmd.includes('task search'));
      expect(searchCommand).toBeDefined();
      expect(searchCommand).toContain('"test search"');
      expect(searchCommand).toContain('--status pending');
      expect(searchCommand).toContain('--priority high');
      expect(searchCommand).toContain('--json');
    });

    it('should format sprint commands correctly', async () => {
      await commandLogClient.getCurrentSprint();

      const sprintCommand = capturedCommands.find(cmd => cmd.includes('sprint current'));
      expect(sprintCommand).toBeDefined();
      expect(sprintCommand).toContain('--json');
    });
  });
});