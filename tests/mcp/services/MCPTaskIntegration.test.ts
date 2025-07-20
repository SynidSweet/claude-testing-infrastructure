/**
 * Unit Tests for MCPTaskIntegrationService
 *
 * Tests the integration between gap requests and the MCP task system,
 * validating task creation, metadata generation, and priority assignment.
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { MCPTaskIntegrationService } from '../../../src/mcp/services/MCPTaskIntegration';
import { GapType, type GapRequestParams } from '../../../src/mcp/tool-interfaces';
import { MCPTaskClient } from '../../../src/mcp/services/MCPTaskClient';

// Mock the MCPTaskClient
jest.mock('../../../src/mcp/services/MCPTaskClient');
const MockedMCPTaskClient = MCPTaskClient as jest.MockedClass<typeof MCPTaskClient>;

describe('MCPTaskIntegrationService', () => {
  let service: MCPTaskIntegrationService;
  let mockTaskClient: jest.Mocked<MCPTaskClient>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create mock instance
    mockTaskClient = {
      createTask: jest.fn(),
      searchTasks: jest.fn(),
      getCurrentSprint: jest.fn(),
      addTaskToSprint: jest.fn(),
      getProjectStats: jest.fn(),
    } as any;

    MockedMCPTaskClient.mockImplementation(() => mockTaskClient);
    
    service = MCPTaskIntegrationService.getInstance();
  });

  afterEach(() => {
    jest.resetModules();
    // Reset the singleton instance
    (MCPTaskIntegrationService as any).instance = undefined;
  });

  describe('createTaskFromGap', () => {
    it('should create a task with correct metadata for missing test gap', async () => {
      const gapParams: GapRequestParams = {
        targetProject: '/path/to/project',
        component: 'src/utils/helper.ts',
        gapType: GapType.MissingTest,
        priority: 'high',
        description: 'Missing unit tests for helper utility functions that handle data transformation',
        context: {
          currentCoverage: 25,
          relatedFiles: ['src/utils/index.ts'],
          dependencies: ['lodash'],
        },
      };

      // Mock responses
      mockTaskClient.searchTasks.mockResolvedValue([]);
      mockTaskClient.createTask.mockResolvedValue({
        task_id: 'TASK-250719-001',
        title: 'Missing Test Coverage: helper.ts',
        priority: 'high',
        status: 'pending',
        created_at: '2025-07-19T12:00:00Z',
      });
      mockTaskClient.getCurrentSprint.mockResolvedValue({
        sprint_id: 'SPRINT-2025-Q3-DEV11',
        title: 'Current Sprint',
        task_count: 10,
      });
      mockTaskClient.addTaskToSprint.mockResolvedValue(true);
      mockTaskClient.getProjectStats.mockResolvedValue({
        backlog_size: 5,
        active_sprint_tasks: 10,
        completion_rate: 75,
      });

      const result = await service.createTaskFromGap(gapParams);

      expect(result).toMatchObject({
        taskCreated: {
          id: 'TASK-250719-001',
          title: 'Missing Test Coverage: helper.ts',
          priority: 'high',
          estimatedEffort: 1, // simple complexity (has util in path)
        },
        validation: {
          isDuplicate: false,
          urgencyScore: expect.any(Number),
        },
        projectContext: {
          projectName: 'project',
          currentBacklogSize: 5,
          estimatedCompletionTime: expect.any(Number),
        },
      });

      expect(mockTaskClient.createTask).toHaveBeenCalledWith({
        title: 'Missing Test Coverage: helper.ts',
        description: expect.stringContaining('Missing unit tests for helper utility functions'),
        priority: 'high',
        tags: 'gap-request,missing-test,testing,simple,priority-high,mcp-generated',
        complexity: 'low',
        context: {
          files: ['src/utils/index.ts'],
          commands: ['# Test coverage for src/utils/helper.ts'],
          constraints: [],
        },
      });
    });

    it('should handle untestable code gaps with higher complexity', async () => {
      const gapParams: GapRequestParams = {
        targetProject: '/path/to/complex-project',
        component: 'src/orchestrators/WorkflowOrchestrator.ts',
        gapType: GapType.UntestablCode,
        priority: 'critical',
        description: 'Complex orchestrator class with multiple dependencies needs refactoring for testability',
        context: {
          dependencies: ['serviceA', 'serviceB', 'serviceC', 'serviceD'],
          specialRequirements: 'Requires dependency injection pattern',
        },
      };

      mockTaskClient.searchTasks.mockResolvedValue([]);
      mockTaskClient.createTask.mockResolvedValue({
        task_id: 'TASK-250719-002',
        title: 'Untestable Code Refactoring: WorkflowOrchestrator.ts',
        priority: 'critical',
        status: 'pending',
        created_at: '2025-07-19T12:00:00Z',
      });
      mockTaskClient.getCurrentSprint.mockResolvedValue(null);
      mockTaskClient.getProjectStats.mockResolvedValue({
        backlog_size: 0,
        active_sprint_tasks: 0,
        completion_rate: 0,
      });

      const result = await service.createTaskFromGap(gapParams);

      expect(result.taskCreated.estimatedEffort).toBe(16); // complex task
      expect(result.taskCreated.tags).toContain('untestable-code');
      expect(result.taskCreated.tags).toContain('refactoring');
      expect(result.validation.urgencyScore).toBeGreaterThan(80); // High urgency for critical untestable code
    });

    it('should detect and handle duplicate tasks', async () => {
      const gapParams: GapRequestParams = {
        targetProject: '/path/to/project',
        component: 'src/components/Button.tsx',
        gapType: GapType.EdgeCase,
        priority: 'medium',
        description: 'Missing edge case tests for button component',
      };

      // Mock duplicate detection - need to mock both search calls
      mockTaskClient.searchTasks
        .mockResolvedValueOnce([
          {
            task_id: 'EXISTING-TASK-001',
            title: 'Edge Case Testing: Button.tsx contains edge-case',
            priority: 'medium',
            status: 'pending',
            created_at: '2025-07-18T12:00:00Z',
          },
        ])
        .mockResolvedValueOnce([]);

      mockTaskClient.createTask.mockResolvedValue({
        task_id: 'TASK-250719-003',
        title: 'Edge Case Testing: Button.tsx',
        priority: 'medium',
        status: 'pending',
        created_at: '2025-07-19T12:00:00Z',
      });

      mockTaskClient.getCurrentSprint.mockResolvedValue(null);
      mockTaskClient.getProjectStats.mockResolvedValue({
        backlog_size: 1,
        active_sprint_tasks: 5,
        completion_rate: 60,
      });

      const result = await service.createTaskFromGap(gapParams);

      expect(result.validation.isDuplicate).toBe(true);
      expect(result.validation.similarTasks).toContain('EXISTING-TASK-001');
    });

    it('should handle low coverage gaps with appropriate priority mapping', async () => {
      const gapParams: GapRequestParams = {
        targetProject: '/path/to/project',
        component: 'src/services/ApiService.ts',
        gapType: GapType.LowCoverage,
        priority: 'critical',
        description: 'API service has only 45% test coverage, needs additional test cases',
        context: {
          currentCoverage: 45,
        },
      };

      mockTaskClient.searchTasks.mockResolvedValue([]);
      mockTaskClient.createTask.mockResolvedValue({
        task_id: 'TASK-250719-004',
        title: 'Low Test Coverage: ApiService.ts',
        priority: 'high', // Mapped from critical -> high for low coverage
        status: 'pending',
        created_at: '2025-07-19T12:00:00Z',
      });
      mockTaskClient.getCurrentSprint.mockResolvedValue(null);
      mockTaskClient.getProjectStats.mockResolvedValue({
        backlog_size: 3,
        active_sprint_tasks: 8,
        completion_rate: 50,
      });

      const result = await service.createTaskFromGap(gapParams);

      expect(result.taskCreated.priority).toBe('high'); // Mapped down from critical
      expect(result.taskCreated.tags).toContain('low-coverage');
      expect(result.taskCreated.tags).toContain('coverage');
    });

    it('should handle integration gaps with proper tagging', async () => {
      const gapParams: GapRequestParams = {
        targetProject: '/path/to/microservice',
        component: 'src/integration/payment-gateway',
        gapType: GapType.IntegrationGap,
        priority: 'high',
        description: 'Missing integration tests for payment gateway service interactions',
        context: {
          relatedFiles: ['src/services/PaymentService.ts', 'src/models/Payment.ts'],
          dependencies: ['stripe-api', 'payment-validator'],
        },
      };

      mockTaskClient.searchTasks.mockResolvedValue([]);
      mockTaskClient.createTask.mockResolvedValue({
        task_id: 'TASK-250719-005',
        title: 'Integration Test Gap: payment-gateway',
        priority: 'high',
        status: 'pending',
        created_at: '2025-07-19T12:00:00Z',
      });
      mockTaskClient.getCurrentSprint.mockResolvedValue({
        sprint_id: 'SPRINT-CURRENT',
        title: 'Integration Sprint',
        task_count: 15,
      });
      mockTaskClient.addTaskToSprint.mockResolvedValue(true);
      mockTaskClient.getProjectStats.mockResolvedValue({
        backlog_size: 8,
        active_sprint_tasks: 15,
        completion_rate: 70,
      });

      const result = await service.createTaskFromGap(gapParams);

      expect(result.taskCreated.tags).toContain('integration-gap');
      expect(result.taskCreated.tags).toContain('integration');
      expect(result.taskCreated.estimatedEffort).toBe(12); // complex complexity for integration with dependencies
    });

    it('should calculate urgency scores correctly', async () => {
      const criticalGap: GapRequestParams = {
        targetProject: '/path/to/project',
        component: 'src/core/SecurityManager.ts',
        gapType: GapType.MissingTest,
        priority: 'critical',
        description: 'Critical security component has no test coverage',
        context: {
          currentCoverage: 0,
        },
      };

      mockTaskClient.searchTasks.mockResolvedValue([]);
      mockTaskClient.createTask.mockResolvedValue({
        task_id: 'TASK-250719-006',
        title: 'Missing Test Coverage: SecurityManager.ts',
        priority: 'critical',
        status: 'pending',
        created_at: '2025-07-19T12:00:00Z',
      });
      mockTaskClient.getCurrentSprint.mockResolvedValue(null);
      mockTaskClient.getProjectStats.mockResolvedValue({
        backlog_size: 2,
        active_sprint_tasks: 5,
        completion_rate: 80,
      });

      const result = await service.createTaskFromGap(criticalGap);

      expect(result.validation.urgencyScore).toBeGreaterThan(90); // Very high urgency
    });

    it('should handle errors gracefully', async () => {
      const gapParams: GapRequestParams = {
        targetProject: '/path/to/project',
        component: 'src/utils/helper.ts',
        gapType: GapType.MissingTest,
        priority: 'medium',
        description: 'Test description',
      };

      // Mock search to return empty results
      mockTaskClient.searchTasks.mockResolvedValue([]);
      // Mock task creation to fail
      mockTaskClient.createTask.mockRejectedValue(new Error('MCP service unavailable'));
      // Mock other calls to avoid undefined results
      mockTaskClient.getCurrentSprint.mockResolvedValue(null);
      mockTaskClient.getProjectStats.mockResolvedValue({
        backlog_size: 0,
        active_sprint_tasks: 0,
        completion_rate: 0,
      });

      await expect(service.createTaskFromGap(gapParams)).rejects.toThrow('MCP service unavailable');
    });
  });

  describe('singleton pattern', () => {
    it('should return the same instance', () => {
      const instance1 = MCPTaskIntegrationService.getInstance();
      const instance2 = MCPTaskIntegrationService.getInstance();
      
      expect(instance1).toBe(instance2);
    });
  });
});