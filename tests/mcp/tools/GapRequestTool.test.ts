/**
 * Unit Tests for GapRequestTool
 *
 * Tests the MCP Gap Request Tool functionality including parameter validation,
 * business rule validation, and integration with the task creation system.
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { GapRequestTool } from '../../../src/mcp/tools/GapRequestTool';
import { MCPTaskIntegrationService } from '../../../src/mcp/services/MCPTaskIntegration';
import { GapType, MCPErrorCode } from '../../../src/mcp/tool-interfaces';

// Mock the MCPTaskIntegrationService
jest.mock('../../../src/mcp/services/MCPTaskIntegration');
const MockedMCPTaskIntegrationService = MCPTaskIntegrationService as jest.MockedClass<typeof MCPTaskIntegrationService>;

describe('GapRequestTool', () => {
  let tool: GapRequestTool;
  let mockTaskIntegrationService: jest.Mocked<MCPTaskIntegrationService>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create mock instance
    mockTaskIntegrationService = {
      createTaskFromGap: jest.fn(),
    } as any;

    MockedMCPTaskIntegrationService.getInstance.mockReturnValue(mockTaskIntegrationService);
    
    tool = new GapRequestTool();
  });

  afterEach(() => {
    jest.resetModules();
  });

  describe('execute', () => {
    it('should successfully process a valid gap request', async () => {
      const validParams = {
        targetProject: '/path/to/project',
        component: 'src/utils/helper.ts',
        gapType: GapType.MissingTest,
        priority: 'high',
        description: 'Missing unit tests for helper utility functions that handle data transformation and validation',
        context: {
          currentCoverage: 25,
          relatedFiles: ['src/utils/index.ts'],
          dependencies: ['lodash', 'validator'],
          specialRequirements: 'Requires mock data for external API calls',
        },
      };

      const expectedResult = {
        taskCreated: {
          id: 'GAP-MISS-20250719001',
          title: 'Missing Test Coverage: helper.ts',
          priority: 'high',
          tags: ['gap-request', 'missing-test', 'testing'],
          estimatedEffort: 3,
        },
        validation: {
          isDuplicate: false,
          similarTasks: [],
          urgencyScore: 85,
        },
        projectContext: {
          projectName: 'project',
          currentBacklogSize: 5,
          estimatedCompletionTime: 2,
        },
        metadata: {
          requestedAt: expect.any(Date),
          requestId: expect.any(String),
        },
      };

      mockTaskIntegrationService.createTaskFromGap.mockResolvedValue(expectedResult);

      const result = await tool.execute(validParams);

      expect(result).toEqual(expectedResult);
      expect(mockTaskIntegrationService.createTaskFromGap).toHaveBeenCalledWith(validParams);
    });

    it('should validate required parameters', async () => {
      const invalidParams = {
        targetProject: '',
        component: 'src/utils/helper.ts',
        gapType: GapType.MissingTest,
        // Missing required description
      };

      const result = await tool.execute(invalidParams);

      expect(result).toMatchObject({
        code: MCPErrorCode.InvalidInput,
        message: 'Gap request validation failed',
        details: {
          errors: expect.arrayContaining([
            expect.stringContaining('description'),
          ]),
        },
      });
    });

    it('should validate business rules', async () => {
      const paramsWithBusinessRuleViolation = {
        targetProject: '/path/to/project',
        component: 'invalid-component-format',
        gapType: GapType.LowCoverage,
        priority: 'medium',
        description: 'Too short', // Less than 20 characters
        context: {
          currentCoverage: 150, // Invalid percentage
        },
      };

      const result = await tool.execute(paramsWithBusinessRuleViolation);

      expect(result).toMatchObject({
        code: MCPErrorCode.InvalidInput,
        message: 'Business rule validation failed',
        details: {
          issues: expect.arrayContaining([
            expect.stringContaining('Component should be a valid file path'),
            expect.stringContaining('Description should be at least 20 characters'),
            expect.stringContaining('Current coverage must be between 0 and 100'),
          ]),
        },
      });
    });

    it('should validate gap type consistency', async () => {
      const inconsistentParams = {
        targetProject: '/path/to/project',
        component: 'src/components/Button.tsx',
        gapType: GapType.LowCoverage,
        priority: 'medium',
        description: 'Component has good test coverage but reporting low coverage gap',
        context: {
          currentCoverage: 95, // High coverage but low coverage gap type
        },
      };

      const result = await tool.execute(inconsistentParams);

      expect(result).toMatchObject({
        code: MCPErrorCode.InvalidInput,
        message: 'Business rule validation failed',
        details: {
          issues: expect.arrayContaining([
            expect.stringContaining('Low coverage gap type but current coverage is high'),
          ]),
        },
      });
    });

    it('should handle different gap types correctly', async () => {
      const edgeCaseParams = {
        targetProject: '/path/to/project',
        component: 'src/validators/inputValidator.js',
        gapType: GapType.EdgeCase,
        priority: 'low',
        description: 'Missing edge case tests for input validation with special characters and boundary conditions',
        context: {
          currentCoverage: 80,
        },
      };

      const expectedResult = {
        taskCreated: {
          id: 'GAP-EDGE-20250719002',
          title: 'Edge Case Testing: inputValidator.js',
          priority: 'low',
          tags: ['gap-request', 'edge-case', 'testing'],
          estimatedEffort: 1,
        },
        validation: {
          isDuplicate: false,
          similarTasks: [],
          urgencyScore: 45,
        },
        projectContext: {
          projectName: 'project',
          currentBacklogSize: 3,
          estimatedCompletionTime: 1,
        },
        metadata: {
          requestedAt: expect.any(Date),
          requestId: expect.any(String),
        },
      };

      mockTaskIntegrationService.createTaskFromGap.mockResolvedValue(expectedResult);

      const result = await tool.execute(edgeCaseParams);

      expect(result).toEqual(expectedResult);
    });

    it('should validate related files format', async () => {
      const paramsWithInvalidFiles = {
        targetProject: '/path/to/project',
        component: 'src/utils/helper.ts',
        gapType: GapType.MissingTest,
        priority: 'medium',
        description: 'Missing tests for utility functions with proper validation and error handling',
        context: {
          relatedFiles: ['../../../etc/passwd', '', 'valid/file.ts'], // Invalid path and empty entry
        },
      };

      const result = await tool.execute(paramsWithInvalidFiles);

      expect(result).toMatchObject({
        code: MCPErrorCode.InvalidInput,
        message: 'Business rule validation failed',
        details: {
          issues: expect.arrayContaining([
            expect.stringContaining('Related files contain invalid paths'),
          ]),
        },
      });
    });

    it('should validate dependencies format', async () => {
      const paramsWithInvalidDependencies = {
        targetProject: '/path/to/project',
        component: 'src/services/ApiService.ts',
        gapType: GapType.IntegrationGap,
        priority: 'high',
        description: 'Missing integration tests for API service with external dependencies',
        context: {
          dependencies: ['lodash', '', 'axios'], // Empty dependency
        },
      };

      const result = await tool.execute(paramsWithInvalidDependencies);

      expect(result).toMatchObject({
        code: MCPErrorCode.InvalidInput,
        message: 'Business rule validation failed',
        details: {
          issues: expect.arrayContaining([
            expect.stringContaining('Dependencies list contains empty entries'),
          ]),
        },
      });
    });

    it('should handle task creation service errors', async () => {
      const validParams = {
        targetProject: '/path/to/project',
        component: 'src/utils/helper.ts',
        gapType: GapType.MissingTest,
        priority: 'medium',
        description: 'Missing tests for utility functions that need comprehensive coverage',
      };

      mockTaskIntegrationService.createTaskFromGap.mockRejectedValue(
        new Error('MCP task system is currently unavailable')
      );

      const result = await tool.execute(validParams);

      expect(result).toMatchObject({
        code: expect.any(String),
        message: expect.stringContaining('MCP task system is currently unavailable'),
      });
    });

    it('should provide helpful suggestions for validation failures', async () => {
      const paramsNeedingSuggestions = {
        targetProject: '/path/to/project',
        component: 'invalid-component',
        gapType: GapType.MissingTest,
        priority: 'medium',
        description: 'Short description',
        context: {
          currentCoverage: -5,
        },
      };

      const result = await tool.execute(paramsNeedingSuggestions);

      expect(result).toMatchObject({
        code: MCPErrorCode.InvalidInput,
        message: 'Business rule validation failed',
        suggestion: expect.stringContaining('For component paths, use relative paths'),
      });
    });
  });

  describe('getSchema', () => {
    it('should return a valid MCP tool schema', () => {
      const schema = tool.getSchema();

      expect(schema).toMatchObject({
        name: 'mcp__claude-testing__gap_request',
        description: expect.any(String),
        inputSchema: {
          type: 'object',
          properties: {
            targetProject: {
              type: 'string',
              minLength: 1,
            },
            component: {
              type: 'string',
              minLength: 1,
            },
            gapType: {
              type: 'string',
              enum: Object.values(GapType),
            },
            priority: {
              type: 'string',
              enum: ['low', 'medium', 'high', 'critical'],
              default: 'medium',
            },
            description: {
              type: 'string',
              minLength: 20,
            },
            context: {
              type: 'object',
              properties: {
                currentCoverage: {
                  type: 'number',
                  minimum: 0,
                  maximum: 100,
                },
                relatedFiles: {
                  type: 'array',
                  items: { type: 'string' },
                },
                dependencies: {
                  type: 'array',
                  items: { type: 'string' },
                },
                specialRequirements: {
                  type: 'string',
                },
              },
            },
          },
          required: ['targetProject', 'component', 'gapType', 'description'],
        },
      });
    });
  });

  describe('getMetadata', () => {
    it('should return tool metadata', () => {
      const metadata = tool.getMetadata();

      expect(metadata).toMatchObject({
        category: 'Gap Analysis & Requests',
        tags: ['gap', 'request', 'task-creation', 'testing'],
        complexity: 'medium',
        expectedResponseTime: 3000,
        requiresAuth: false,
        cacheable: false,
      });
    });
  });
});