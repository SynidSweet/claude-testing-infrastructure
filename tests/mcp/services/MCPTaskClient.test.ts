import { MCPTaskClient, MCPTaskParams, MCPTaskResult } from '../../../src/mcp/services/MCPTaskClient';

// Mock winston logger to avoid filesystem issues in tests
jest.mock('../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

// Mock child_process instead of util to catch the exec call
jest.mock('child_process', () => ({
  exec: jest.fn(),
}));

describe('MCPTaskClient', () => {
  let client: MCPTaskClient;
  let mockExec: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Get the mocked exec function from child_process
    const { exec } = require('child_process');
    mockExec = exec as jest.Mock;
    
    // Mock exec to work with promisify - it should accept callback style
    mockExec.mockImplementation((command: string, options: any, callback: Function) => {
      // If callback is provided directly as second parameter
      if (typeof options === 'function') {
        callback = options;
      }
      
      // Simulate async execution
      setTimeout(() => {
        callback(null, { stdout: '{}', stderr: '' });
      }, 0);
    });
    
    client = new MCPTaskClient({
      transportType: 'cli',
      cliOptions: {
        command: 'claude-tasks',
      },
    });
  });

  describe('createTask', () => {
    it('should create a task successfully', async () => {
      const params: MCPTaskParams = {
        title: 'Test Task',
        description: 'Test Description',
        priority: 'high',
        tags: 'test,mcp',
        complexity: 'medium',
      };

      const mockTaskId = 'TASK-2025-001';
      const mockOutput = JSON.stringify({
        task: {
          id: mockTaskId,
          title: params.title,
          priority: params.priority,
          status: 'pending',
          created_at: '2025-01-19T12:00:00Z',
        },
      });

      // Mock successful response
      mockExec.mockImplementationOnce((command: string, options: any, callback: Function) => {
        if (typeof options === 'function') callback = options;
        setTimeout(() => callback(null, { stdout: mockOutput, stderr: '' }), 0);
      });

      const result = await client.createTask(params);

      expect(result).toEqual({
        task_id: mockTaskId,
        title: params.title,
        priority: params.priority,
        status: 'pending',
        created_at: '2025-01-19T12:00:00Z',
      });

      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('claude-tasks task create "Test Task"'),
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should handle task creation with CLI text output', async () => {
      const params: MCPTaskParams = {
        title: 'Test Task',
        description: 'Test Description',
        priority: 'high',
      };

      const mockTaskId = 'TASK-2025-002';
      const mockOutput = `✓ Created task ${mockTaskId}`;

      // Mock CLI text response
      mockExec.mockImplementationOnce((command: string, options: any, callback: Function) => {
        if (typeof options === 'function') callback = options;
        setTimeout(() => callback(null, { stdout: mockOutput, stderr: '' }), 0);
      });

      const result = await client.createTask(params);

      expect(result.task_id).toBe(mockTaskId);
      expect(result.title).toBe(params.title);
      expect(result.priority).toBe(params.priority);
    });

    it('should retry on failure', async () => {
      const params: MCPTaskParams = {
        title: 'Test Task',
        description: 'Test Description',
        priority: 'medium',
      };

      const mockError = new Error('Command failed');
      const mockTaskId = 'TASK-2025-003';
      const mockOutput = JSON.stringify({
        task: {
          id: mockTaskId,
          title: params.title,
          priority: params.priority,
          status: 'pending',
          created_at: '2025-01-19T12:00:00Z',
        },
      });

      // First call fails, second succeeds
      mockExec
        .mockImplementationOnce((command: string, options: any, callback: Function) => {
          if (typeof options === 'function') callback = options;
          setTimeout(() => callback(mockError), 0);
        })
        .mockImplementationOnce((command: string, options: any, callback: Function) => {
          if (typeof options === 'function') callback = options;
          setTimeout(() => callback(null, { stdout: mockOutput, stderr: '' }), 0);
        });

      const result = await client.createTask(params);

      expect(result.task_id).toBe(mockTaskId);
      expect(mockExec).toHaveBeenCalledTimes(2);
    });
  });

  describe('searchTasks', () => {
    it('should search tasks successfully', async () => {
      const query = 'test';
      const filters = { status: 'pending', priority: 'high' };

      const mockTasks = [
        {
          id: 'TASK-2025-001',
          title: 'Test Task 1',
          priority: 'high',
          status: 'pending',
          created_at: '2025-01-19T12:00:00Z',
        },
        {
          id: 'TASK-2025-002',
          title: 'Test Task 2',
          priority: 'high',
          status: 'pending',
          created_at: '2025-01-19T12:01:00Z',
        },
      ];

      // Mock search response
      mockExec.mockImplementationOnce((command: string, options: any, callback: Function) => {
        if (typeof options === 'function') callback = options;
        setTimeout(() => callback(null, { stdout: JSON.stringify({ tasks: mockTasks }), stderr: '' }), 0);
      });

      const result = await client.searchTasks(query, filters);

      expect(result).toHaveLength(2);
      expect(result[0].task_id).toBe('TASK-2025-001');
      expect(result[1].task_id).toBe('TASK-2025-002');

      const callArgs = mockExec.mock.calls[0];
      expect(callArgs[0]).toContain('claude-tasks task search "test"');
      expect(callArgs[0]).toContain('--status pending');
      expect(callArgs[0]).toContain('--priority high');
    });

    it('should return empty array on error', async () => {
      const query = 'test';

      // Mock search failure
      mockExec.mockImplementationOnce((command: string, options: any, callback: Function) => {
        if (typeof options === 'function') callback = options;
        setTimeout(() => callback(new Error('Search failed')), 0);
      });

      const result = await client.searchTasks(query);

      expect(result).toEqual([]);
    });
  });

  describe('getCurrentSprint', () => {
    it('should get current sprint successfully', async () => {
      const mockSprint = {
        active_sprint: {
          id: 'SPRINT-2025-001',
          title: 'Test Sprint',
          progress: {
            total_tasks: 10,
          },
        },
      };

      // Mock sprint response
      mockExec.mockImplementationOnce((command: string, options: any, callback: Function) => {
        if (typeof options === 'function') callback = options;
        setTimeout(() => callback(null, { stdout: JSON.stringify(mockSprint), stderr: '' }), 0);
      });

      const result = await client.getCurrentSprint();

      expect(result).toEqual({
        sprint_id: 'SPRINT-2025-001',
        title: 'Test Sprint',
        task_count: 10,
      });

      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('claude-tasks sprint current'),
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should return null when no active sprint', async () => {
      // Mock empty sprint response
      mockExec.mockImplementationOnce((command: string, options: any, callback: Function) => {
        if (typeof options === 'function') callback = options;
        setTimeout(() => callback(null, { stdout: JSON.stringify({}), stderr: '' }), 0);
      });

      const result = await client.getCurrentSprint();

      expect(result).toBeNull();
    });
  });

  describe('addTaskToSprint', () => {
    it('should add task to sprint successfully', async () => {
      const taskId = 'TASK-2025-001';
      const sprintId = 'SPRINT-2025-001';

      // Mock add task success
      mockExec.mockImplementationOnce((command: string, options: any, callback: Function) => {
        if (typeof options === 'function') callback = options;
        setTimeout(() => callback(null, { stdout: 'Task added to sprint', stderr: '' }), 0);
      });

      const result = await client.addTaskToSprint(taskId, sprintId);

      expect(result).toBe(true);
      expect(mockExec).toHaveBeenCalledWith(
        `claude-tasks sprint add-task ${sprintId} ${taskId}`,
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should get current sprint if not provided', async () => {
      const taskId = 'TASK-2025-001';
      const mockSprint = {
        active_sprint: {
          id: 'SPRINT-2025-001',
          title: 'Test Sprint',
          progress: { total_tasks: 10 },
        },
      };

      // Mock get current sprint then add task
      mockExec
        .mockImplementationOnce((command: string, options: any, callback: Function) => {
          if (typeof options === 'function') callback = options;
          setTimeout(() => callback(null, { stdout: JSON.stringify(mockSprint), stderr: '' }), 0);
        })
        .mockImplementationOnce((command: string, options: any, callback: Function) => {
          if (typeof options === 'function') callback = options;
          setTimeout(() => callback(null, { stdout: 'Task added to sprint', stderr: '' }), 0);
        });

      const result = await client.addTaskToSprint(taskId);

      expect(result).toBe(true);
      expect(mockExec).toHaveBeenCalledTimes(2);
    });
  });

  describe('getProjectStats', () => {
    it('should get project statistics successfully', async () => {
      const mockBacklogStats = { total_tasks: 25 };
      const mockSprintStats = {
        active_sprint_tasks: 15,
        average_completion_rate: 75.5,
      };

      // Mock parallel stats calls
      mockExec
        .mockImplementationOnce((command: string, options: any, callback: Function) => {
          if (typeof options === 'function') callback = options;
          setTimeout(() => callback(null, { stdout: JSON.stringify(mockBacklogStats), stderr: '' }), 0);
        })
        .mockImplementationOnce((command: string, options: any, callback: Function) => {
          if (typeof options === 'function') callback = options;
          setTimeout(() => callback(null, { stdout: JSON.stringify(mockSprintStats), stderr: '' }), 0);
        });

      const result = await client.getProjectStats();

      expect(result).toEqual({
        backlog_size: 25,
        active_sprint_tasks: 15,
        completion_rate: 75.5,
      });

      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('claude-tasks backlog stats'),
        expect.any(Object),
        expect.any(Function)
      );
      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('claude-tasks sprint stats'),
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should return default stats on error', async () => {
      // Mock stats failure
      mockExec.mockImplementation((command: string, options: any, callback: Function) => {
        if (typeof options === 'function') callback = options;
        setTimeout(() => callback(new Error('Stats failed')), 0);
      });

      const result = await client.getProjectStats();

      expect(result).toEqual({
        backlog_size: 0,
        active_sprint_tasks: 0,
        completion_rate: 0,
      });
    });
  });

  describe('disconnect', () => {
    it('should disconnect successfully', async () => {
      await client.disconnect();
      // Should not throw
    });
  });
});