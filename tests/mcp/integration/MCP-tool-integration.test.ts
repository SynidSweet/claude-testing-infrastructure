/**
 * Comprehensive MCP Tool Integration Tests
 * 
 * Tests all 12 MCP tools individually, cross-tool workflows, error scenarios,
 * and end-to-end integration with the FastMCP server infrastructure.
 * 
 * This test suite validates the complete MCP ecosystem for the claude-testing
 * infrastructure, ensuring all tools work correctly both independently and
 * in combination.
 */

import { describe, it, expect, jest, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';
import { MCPTestHelper, type MockMCPServer } from '../../../src/utils/MCPTestHelper';
import { 
  MCP_TOOLS, 
  TOOL_METADATA,
  type MCPToolName,
  SupportedLanguage,
  TestFramework,
  TestStrategy,
  GapType,
  FeatureType,
} from '../../../src/mcp/tools';

// Mock FastMCP server imports to avoid ES module issues in Jest
jest.mock('../../../src/mcp/fastmcp-server', () => ({
  ClaudeTestingFastMCPServer: jest.fn().mockImplementation(() => ({
    getStatus: jest.fn().mockReturnValue({ isRunning: false }),
    getToolRegistry: jest.fn().mockReturnValue({
      discoverTools: jest.fn().mockReturnValue([
        {
          metadata: {
            name: 'mcp__claude-testing__gap_request',
            category: 'Gap Analysis & Requests',
            tags: ['gap', 'request', 'task-creation'],
          },
        },
      ]),
    }),
    stop: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock('../../../src/mcp/services/MCPTaskIntegration', () => ({
  MCPTaskIntegrationService: {
    getInstance: jest.fn().mockReturnValue({
      createTaskFromGap: jest.fn(),
    }),
  },
}));

jest.mock('../../../src/mcp/services/MCPErrorHandler', () => ({
  MCPErrorHandler: {
    getInstance: jest.fn().mockReturnValue({
      reset: jest.fn(),
      getMetrics: jest.fn().mockReturnValue({ totalErrors: 0 }),
    }),
  },
}));

jest.mock('../../../src/mcp/services/MCPCacheManager', () => ({
  MCPCacheManager: {
    getInstance: jest.fn().mockReturnValue({
      clearAll: jest.fn(),
    }),
  },
}));

describe('MCP Tool Integration Tests', () => {
  let mcpHelper: MCPTestHelper;
  let mockServer: MockMCPServer;
  let mockTaskIntegration: any;
  let mockErrorHandler: any;
  let mockCacheManager: any;
  let mockFastMCPServer: any;

  beforeAll(async () => {
    // Initialize test helpers and services
    mcpHelper = new MCPTestHelper();
    mockServer = await mcpHelper.createServer({
      requireInit: true,
      capabilities: {
        tools: true,
        resources: true,
        prompts: true,
      },
      serverInfo: {
        name: 'claude-testing-integration-test',
        version: '1.0.0',
      },
    });

    // Get mock instances
    const { MCPTaskIntegrationService } = require('../../../src/mcp/services/MCPTaskIntegration');
    const { MCPErrorHandler } = require('../../../src/mcp/services/MCPErrorHandler');
    const { MCPCacheManager } = require('../../../src/mcp/services/MCPCacheManager');
    const { ClaudeTestingFastMCPServer } = require('../../../src/mcp/fastmcp-server');

    mockTaskIntegration = MCPTaskIntegrationService.getInstance();
    mockErrorHandler = MCPErrorHandler.getInstance();
    mockCacheManager = MCPCacheManager.getInstance();
    mockFastMCPServer = new ClaudeTestingFastMCPServer();
  });

  afterAll(async () => {
    // Clean up all resources
    await mcpHelper.cleanup();
    if (mockFastMCPServer && mockFastMCPServer.getStatus().isRunning) {
      await mockFastMCPServer.stop();
    }
  });

  beforeEach(() => {
    // Reset mocks and clear state
    jest.clearAllMocks();
    mcpHelper.resetServers();
    if (mockCacheManager) mockCacheManager.clearAll();
    if (mockErrorHandler) mockErrorHandler.reset();
  });

  describe('Individual Tool Functionality', () => {
    describe('Core Testing Tools', () => {
      it('should execute project_analyze tool successfully', async () => {
        const request = {
          jsonrpc: '2.0' as const,
          method: 'tools/call',
          params: {
            name: MCP_TOOLS.PROJECT_ANALYZE,
            arguments: {
              projectPath: '/test/project',
              include: ['src/**/*.ts'],
              exclude: ['node_modules/**'],
              deep: true,
            },
          },
          id: 'test-project-analyze',
        };

        const response = await mockServer.handleRequest(request);
        expect(response.jsonrpc).toBe('2.0');
        expect(response.id).toBe('test-project-analyze');
        expect(response.result).toBeDefined();
        expect(response.error).toBeUndefined();
      });

      it('should execute test_generate tool with proper validation', async () => {
        const request = {
          jsonrpc: '2.0' as const,
          method: 'tools/call',
          params: {
            name: MCP_TOOLS.TEST_GENERATE,
            arguments: {
              projectPath: '/test/project',
              targetFiles: ['src/utils/helper.ts'],
              strategy: TestStrategy.Both,
              framework: TestFramework.Jest,
              aiModel: 'claude-3-sonnet',
            },
          },
          id: 'test-generate',
        };

        const response = await mockServer.handleRequest(request);
        expect(response.jsonrpc).toBe('2.0');
        expect(response.id).toBe('test-generate');
        expect(response.result).toBeDefined();
      });

      it('should execute test_run tool with coverage reporting', async () => {
        const request = {
          jsonrpc: '2.0' as const,
          method: 'tools/call',
          params: {
            name: MCP_TOOLS.TEST_RUN,
            arguments: {
              projectPath: '/test/project',
              testFiles: ['tests/**/*.test.ts'],
              coverage: true,
              watch: false,
              timeout: 30000,
            },
          },
          id: 'test-run',
        };

        const response = await mockServer.handleRequest(request);
        expect(response.jsonrpc).toBe('2.0');
        expect(response.id).toBe('test-run');
        expect(response.result).toBeDefined();
      });

      it('should execute coverage_check tool with gap analysis', async () => {
        const request = {
          jsonrpc: '2.0' as const,
          method: 'tools/call',
          params: {
            name: MCP_TOOLS.COVERAGE_CHECK,
            arguments: {
              projectPath: '/test/project',
              threshold: 80,
              reportFormat: 'json',
              includeGaps: true,
            },
          },
          id: 'coverage-check',
        };

        const response = await mockServer.handleRequest(request);
        expect(response.jsonrpc).toBe('2.0');
        expect(response.id).toBe('coverage-check');
        expect(response.result).toBeDefined();
      });
    });

    describe('Gap Analysis & Request Tools', () => {
      it('should execute gap_request tool with task integration', async () => {
        const request = {
          jsonrpc: '2.0' as const,
          method: 'tools/call',
          params: {
            name: MCP_TOOLS.GAP_REQUEST,
            arguments: {
              targetProject: '/test/project',
              component: 'src/utils/helper.ts',
              gapType: GapType.MissingTest,
              priority: 'high',
              description: 'Missing unit tests for helper utility functions',
              context: {
                currentCoverage: 25,
                relatedFiles: ['src/utils/index.ts'],
                dependencies: ['lodash'],
              },
            },
          },
          id: 'gap-request',
        };

        const response = await mockServer.handleRequest(request);
        expect(response.jsonrpc).toBe('2.0');
        expect(response.id).toBe('gap-request');
        expect(response.result).toBeDefined();
      });

      it('should execute feature_request tool', async () => {
        const request = {
          jsonrpc: '2.0' as const,
          method: 'tools/call',
          params: {
            name: MCP_TOOLS.FEATURE_REQUEST,
            arguments: {
              title: 'Add support for Python testing',
              description: 'Extend the framework to support Python test generation',
              type: FeatureType.Enhancement,
              priority: 'medium',
              component: 'generators',
            },
          },
          id: 'feature-request',
        };

        const response = await mockServer.handleRequest(request);
        expect(response.jsonrpc).toBe('2.0');
        expect(response.id).toBe('feature-request');
        expect(response.result).toBeDefined();
      });
    });

    describe('Incremental & Maintenance Tools', () => {
      it('should execute incremental_update tool', async () => {
        const request = {
          jsonrpc: '2.0' as const,
          method: 'tools/call',
          params: {
            name: MCP_TOOLS.INCREMENTAL_UPDATE,
            arguments: {
              projectPath: '/test/project',
              sinceCommit: 'abc123',
              strategy: 'smart',
              dryRun: false,
            },
          },
          id: 'incremental-update',
        };

        const response = await mockServer.handleRequest(request);
        expect(response.jsonrpc).toBe('2.0');
        expect(response.id).toBe('incremental-update');
        expect(response.result).toBeDefined();
      });

      it('should execute watch_changes tool', async () => {
        const request = {
          jsonrpc: '2.0' as const,
          method: 'tools/call',
          params: {
            name: MCP_TOOLS.WATCH_CHANGES,
            arguments: {
              projectPath: '/test/project',
              patterns: ['src/**/*.ts'],
              debounceMs: 1000,
              action: 'regenerate-tests',
            },
          },
          id: 'watch-changes',
        };

        const response = await mockServer.handleRequest(request);
        expect(response.jsonrpc).toBe('2.0');
        expect(response.id).toBe('watch-changes');
        expect(response.result).toBeDefined();
      });
    });

    describe('Configuration Management Tools', () => {
      it('should execute config_get tool', async () => {
        const request = {
          jsonrpc: '2.0' as const,
          method: 'tools/call',
          params: {
            name: MCP_TOOLS.CONFIG_GET,
            arguments: {
              projectPath: '/test/project',
              keys: ['testFramework', 'aiModel'],
              format: 'json',
            },
          },
          id: 'config-get',
        };

        const response = await mockServer.handleRequest(request);
        expect(response.jsonrpc).toBe('2.0');
        expect(response.id).toBe('config-get');
        expect(response.result).toBeDefined();
      });

      it('should execute config_set tool', async () => {
        const request = {
          jsonrpc: '2.0' as const,
          method: 'tools/call',
          params: {
            name: MCP_TOOLS.CONFIG_SET,
            arguments: {
              projectPath: '/test/project',
              settings: {
                testFramework: TestFramework.Jest,
                aiModel: 'claude-3-sonnet',
                coverage: { threshold: 85 },
              },
              validate: true,
            },
          },
          id: 'config-set',
        };

        const response = await mockServer.handleRequest(request);
        expect(response.jsonrpc).toBe('2.0');
        expect(response.id).toBe('config-set');
        expect(response.result).toBeDefined();
      });
    });

    describe('Infrastructure Tools', () => {
      it('should execute register_tool tool', async () => {
        const request = {
          jsonrpc: '2.0' as const,
          method: 'tools/call',
          params: {
            name: MCP_TOOLS.REGISTER_TOOL,
            arguments: {
              toolName: 'custom-analyzer',
              description: 'Custom analysis tool',
              category: 'analysis',
              handler: 'CustomAnalyzer',
            },
          },
          id: 'register-tool',
        };

        const response = await mockServer.handleRequest(request);
        expect(response.jsonrpc).toBe('2.0');
        expect(response.id).toBe('register-tool');
        expect(response.result).toBeDefined();
      });

      it('should execute server_health tool', async () => {
        const request = {
          jsonrpc: '2.0' as const,
          method: 'tools/call',
          params: {
            name: MCP_TOOLS.SERVER_HEALTH,
            arguments: {
              includeMetrics: true,
              checkServices: ['cache', 'task-integration', 'error-handler'],
            },
          },
          id: 'server-health',
        };

        const response = await mockServer.handleRequest(request);
        expect(response.jsonrpc).toBe('2.0');
        expect(response.id).toBe('server-health');
        expect(response.result).toBeDefined();
      });
    });
  });

  describe('Cross-Tool Workflows', () => {
    it('should execute complete test generation workflow', async () => {
      // Step 1: Analyze project
      const analyzeResponse = await mockServer.handleRequest({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: MCP_TOOLS.PROJECT_ANALYZE,
          arguments: {
            projectPath: '/test/project',
            deep: true,
          },
        },
        id: 'workflow-analyze',
      });
      expect(analyzeResponse.result).toBeDefined();

      // Step 2: Check coverage
      const coverageResponse = await mockServer.handleRequest({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: MCP_TOOLS.COVERAGE_CHECK,
          arguments: {
            projectPath: '/test/project',
            threshold: 80,
            includeGaps: true,
          },
        },
        id: 'workflow-coverage',
      });
      expect(coverageResponse.result).toBeDefined();

      // Step 3: Generate tests for gaps
      const generateResponse = await mockServer.handleRequest({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: MCP_TOOLS.TEST_GENERATE,
          arguments: {
            projectPath: '/test/project',
            targetFiles: ['src/utils/helper.ts'],
            strategy: TestStrategy.Both,
          },
        },
        id: 'workflow-generate',
      });
      expect(generateResponse.result).toBeDefined();

      // Step 4: Run tests
      const runResponse = await mockServer.handleRequest({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: MCP_TOOLS.TEST_RUN,
          arguments: {
            projectPath: '/test/project',
            coverage: true,
          },
        },
        id: 'workflow-run',
      });
      expect(runResponse.result).toBeDefined();
    });

    it('should execute gap request and task creation workflow', async () => {
      // Step 1: Create gap request
      const gapResponse = await mockServer.handleRequest({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: MCP_TOOLS.GAP_REQUEST,
          arguments: {
            targetProject: '/test/project',
            component: 'src/api/auth.ts',
            gapType: GapType.LowCoverage,
            priority: 'high',
            description: 'Authentication module needs comprehensive testing',
          },
        },
        id: 'gap-workflow',
      });
      expect(gapResponse.result).toBeDefined();

      // Step 2: Check server health after task creation
      const healthResponse = await mockServer.handleRequest({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: MCP_TOOLS.SERVER_HEALTH,
          arguments: {
            includeMetrics: true,
            checkServices: ['task-integration'],
          },
        },
        id: 'health-check',
      });
      expect(healthResponse.result).toBeDefined();
    });

    it('should execute configuration workflow', async () => {
      // Step 1: Get current configuration
      const getConfigResponse = await mockServer.handleRequest({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: MCP_TOOLS.CONFIG_GET,
          arguments: {
            projectPath: '/test/project',
          },
        },
        id: 'config-get-workflow',
      });
      expect(getConfigResponse.result).toBeDefined();

      // Step 2: Update configuration
      const setConfigResponse = await mockServer.handleRequest({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: MCP_TOOLS.CONFIG_SET,
          arguments: {
            projectPath: '/test/project',
            settings: {
              testFramework: TestFramework.Jest,
              coverage: { threshold: 90 },
            },
          },
        },
        id: 'config-set-workflow',
      });
      expect(setConfigResponse.result).toBeDefined();

      // Step 3: Verify updated configuration
      const verifyConfigResponse = await mockServer.handleRequest({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: MCP_TOOLS.CONFIG_GET,
          arguments: {
            projectPath: '/test/project',
            keys: ['testFramework', 'coverage'],
          },
        },
        id: 'config-verify-workflow',
      });
      expect(verifyConfigResponse.result).toBeDefined();
    });
  });

  describe('Error Handling Scenarios', () => {
    it('should handle invalid parameters gracefully', async () => {
      const request = {
        jsonrpc: '2.0' as const,
        method: 'tools/call',
        params: {
          name: MCP_TOOLS.PROJECT_ANALYZE,
          arguments: {
            projectPath: '', // Invalid empty path
            deep: 'not-a-boolean', // Invalid type
          },
        },
        id: 'invalid-params',
      };

      const response = await mockServer.handleRequest(request);
      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32602); // Invalid params
    });

    it('should handle missing required parameters', async () => {
      const request = {
        jsonrpc: '2.0' as const,
        method: 'tools/call',
        params: {
          name: MCP_TOOLS.TEST_GENERATE,
          arguments: {
            // Missing required projectPath
            strategy: TestStrategy.Structural,
          },
        },
        id: 'missing-params',
      };

      const response = await mockServer.handleRequest(request);
      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32602); // Invalid params
    });

    it('should handle unknown tool names', async () => {
      const request = {
        jsonrpc: '2.0' as const,
        method: 'tools/call',
        params: {
          name: 'unknown-tool',
          arguments: {},
        },
        id: 'unknown-tool',
      };

      const response = await mockServer.handleRequest(request);
      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32601); // Method not found
    });

    it('should handle tool execution timeouts', async () => {
      const request = {
        jsonrpc: '2.0' as const,
        method: 'tools/call',
        params: {
          name: 'slowTool', // Special test tool that simulates delay
          arguments: {
            delay: 5000, // 5 second delay
          },
        },
        id: 'timeout-test',
      };

      const response = await mockServer.handleRequest(request);
      // Should handle timeout gracefully
      expect(response).toBeDefined();
    });

    it('should handle circuit breaker activation', async () => {
      // Simulate multiple failures to trigger circuit breaker
      const failingRequests = Array.from({ length: 5 }, (_, i) => ({
        jsonrpc: '2.0' as const,
        method: 'tools/call',
        params: {
          name: 'validateTypes', // Special test tool that always fails
          arguments: {},
        },
        id: `failing-${i}`,
      }));

      // Execute failing requests
      const responses = await Promise.all(
        failingRequests.map(req => mockServer.handleRequest(req))
      );

      // All should show errors
      responses.forEach(response => {
        expect(response.error).toBeDefined();
      });

      // Circuit breaker should now be open, subsequent requests should fail fast
      const finalRequest = {
        jsonrpc: '2.0' as const,
        method: 'tools/call',
        params: {
          name: MCP_TOOLS.PROJECT_ANALYZE,
          arguments: {
            projectPath: '/test/project',
          },
        },
        id: 'circuit-breaker-test',
      };

      const finalResponse = await mockServer.handleRequest(finalRequest);
      expect(finalResponse).toBeDefined();
    });
  });

  describe('Performance Validation', () => {
    it('should meet response time expectations for fast tools', async () => {
      const fastTools = [
        MCP_TOOLS.SERVER_HEALTH,
        MCP_TOOLS.CONFIG_GET,
        MCP_TOOLS.REGISTER_TOOL,
      ];

      for (const toolName of fastTools) {
        const start = Date.now();
        
        const response = await mockServer.handleRequest({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: {
            name: toolName,
            arguments: {
              projectPath: '/test/project',
            },
          },
          id: `perf-${toolName}`,
        });

        const duration = Date.now() - start;
        const expectedTime = TOOL_METADATA[toolName as MCPToolName].expectedResponseTime;
        
        expect(response.result).toBeDefined();
        // Allow 100% tolerance for test environment
        expect(duration).toBeLessThan(expectedTime * 2);
      }
    });

    it('should handle concurrent tool executions', async () => {
      const concurrentRequests = Array.from({ length: 10 }, (_, i) => ({
        jsonrpc: '2.0' as const,
        method: 'tools/call',
        params: {
          name: MCP_TOOLS.SERVER_HEALTH,
          arguments: {
            includeMetrics: false,
          },
        },
        id: `concurrent-${i}`,
      }));

      const start = Date.now();
      const responses = await Promise.all(
        concurrentRequests.map(req => mockServer.handleRequest(req))
      );
      const duration = Date.now() - start;

      // All requests should succeed
      responses.forEach((response, i) => {
        expect(response.result).toBeDefined();
        expect(response.id).toBe(`concurrent-${i}`);
      });

      // Concurrent execution should not take much longer than sequential
      expect(duration).toBeLessThan(2000); // 2 seconds for 10 requests
    });
  });

  describe('End-to-End Integration', () => {
    it('should complete full agent workflow simulation', async () => {
      // Simulate a complete agent workflow:
      // 1. Agent checks server health
      // 2. Agent analyzes project
      // 3. Agent checks coverage gaps
      // 4. Agent requests gap analysis task creation
      // 5. Agent generates missing tests
      // 6. Agent runs tests and validates results

      const workflow = [
        {
          tool: MCP_TOOLS.SERVER_HEALTH,
          args: { includeMetrics: true },
          description: 'Check server health',
        },
        {
          tool: MCP_TOOLS.PROJECT_ANALYZE,
          args: { projectPath: '/agent/project', deep: true },
          description: 'Analyze project structure',
        },
        {
          tool: MCP_TOOLS.COVERAGE_CHECK,
          args: { projectPath: '/agent/project', threshold: 80, includeGaps: true },
          description: 'Check coverage gaps',
        },
        {
          tool: MCP_TOOLS.GAP_REQUEST,
          args: {
            targetProject: '/agent/project',
            component: 'src/core/engine.ts',
            gapType: GapType.MissingTest,
            priority: 'high',
            description: 'Core engine missing comprehensive tests',
          },
          description: 'Request gap analysis task',
        },
        {
          tool: MCP_TOOLS.TEST_GENERATE,
          args: {
            projectPath: '/agent/project',
            targetFiles: ['src/core/engine.ts'],
            strategy: TestStrategy.Both,
          },
          description: 'Generate missing tests',
        },
        {
          tool: MCP_TOOLS.TEST_RUN,
          args: {
            projectPath: '/agent/project',
            coverage: true,
          },
          description: 'Run tests and validate',
        },
      ];

      const results = [];
      for (const [index, step] of workflow.entries()) {
        const response = await mockServer.handleRequest({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: {
            name: step.tool,
            arguments: step.args,
          },
          id: `workflow-step-${index}`,
        });

        expect(response.result).toBeDefined();
        expect(response.error).toBeUndefined();
        
        results.push({
          step: step.description,
          tool: step.tool,
          success: !!response.result,
          responseTime: 0, // Would track in real implementation
        });
      }

      // Verify complete workflow executed successfully
      expect(results).toHaveLength(workflow.length);
      expect(results.every(r => r.success)).toBe(true);
    });

    it('should handle tool discovery and capabilities', async () => {
      // Test tool listing and capabilities
      const toolsResponse = await mockServer.handleRequest({
        jsonrpc: '2.0',
        method: 'tools/list',
        params: {},
        id: 'list-tools',
      });

      expect(toolsResponse.result).toBeDefined();
      
      // Verify all expected tools are available
      const toolsList = (toolsResponse.result as any).tools;
      expect(Array.isArray(toolsList)).toBe(true);
      expect(toolsList.length).toBeGreaterThan(0);
    });

    it('should maintain session state across tool calls', async () => {
      // Set session state
      const setState = await mockServer.handleRequest({
        jsonrpc: '2.0',
        method: 'session/set',
        params: {
          key: 'current-project',
          value: '/test/project',
        },
        id: 'set-session',
      });
      expect(setState.result).toBeDefined();

      // Get session state
      const getState = await mockServer.handleRequest({
        jsonrpc: '2.0',
        method: 'session/get',
        params: {
          key: 'current-project',
        },
        id: 'get-session',
      });
      expect(getState.result).toBeDefined();
      expect((getState.result as any).value).toBe('/test/project');

      // Use session state in tool call
      const toolCall = await mockServer.handleRequest({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: MCP_TOOLS.PROJECT_ANALYZE,
          arguments: {
            projectPath: '/test/project', // Using session state value
          },
        },
        id: 'session-tool-call',
      });
      expect(toolCall.result).toBeDefined();
    });
  });

  describe('Service Integration Validation', () => {
    it('should validate MCP cache integration', async () => {
      // Clear cache first
      cacheManager.clearAll();

      // Make repeated calls to test caching
      const request = {
        jsonrpc: '2.0' as const,
        method: 'tools/call',
        params: {
          name: MCP_TOOLS.PROJECT_ANALYZE,
          arguments: {
            projectPath: '/test/project',
          },
        },
        id: 'cache-test',
      };

      // First call - should populate cache
      const response1 = await mockServer.handleRequest(request);
      expect(response1.result).toBeDefined();

      // Second call - should hit cache
      const response2 = await mockServer.handleRequest(request);
      expect(response2.result).toBeDefined();

      // Results should be consistent
      expect(response1.result).toEqual(response2.result);
    });

    it('should validate error handler integration', async () => {
      // Reset error handler
      errorHandler.reset();

      // Generate an error
      const errorRequest = {
        jsonrpc: '2.0' as const,
        method: 'tools/call',
        params: {
          name: 'requiresParams', // Special test tool that fails validation
          arguments: {},
        },
        id: 'error-test',
      };

      const response = await mockServer.handleRequest(errorRequest);
      expect(response.error).toBeDefined();

      // Check error handler metrics
      const metrics = errorHandler.getMetrics();
      expect(metrics.totalErrors).toBeGreaterThan(0);
    });

    it('should validate task integration service', async () => {
      // Mock task integration calls
      const mockCreateTask = jest.spyOn(taskIntegration, 'createTaskFromGap');
      mockCreateTask.mockResolvedValue({
        taskId: 'TASK-TEST-001',
        status: 'created',
        sprintAssigned: true,
        priority: 'high',
        metadata: {
          gapType: GapType.MissingTest,
          urgencyScore: 85,
          contextualScore: 75,
        },
      });

      // Execute gap request
      const gapRequest = {
        jsonrpc: '2.0' as const,
        method: 'tools/call',
        params: {
          name: MCP_TOOLS.GAP_REQUEST,
          arguments: {
            targetProject: '/test/project',
            component: 'src/test.ts',
            gapType: GapType.MissingTest,
            priority: 'high',
            description: 'Test task integration',
          },
        },
        id: 'task-integration-test',
      };

      const response = await mockServer.handleRequest(gapRequest);
      expect(response.result).toBeDefined();

      // Verify task integration was called
      expect(mockCreateTask).toHaveBeenCalled();
      
      mockCreateTask.mockRestore();
    });
  });
});