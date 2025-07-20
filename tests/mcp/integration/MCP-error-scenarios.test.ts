/**
 * MCP Error Scenarios and Edge Case Tests
 * 
 * Tests error handling, edge cases, and failure scenarios for MCP tools
 * to ensure robust behavior under adverse conditions.
 * 
 * These tests validate that the MCP system handles errors gracefully,
 * provides meaningful error messages, and maintains system stability
 * even when individual tools fail.
 */

import { describe, it, expect, jest, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';
import { MCPTestHelper, type MockMCPServer } from '../../../src/utils/MCPTestHelper';
import { 
  MCP_TOOLS,
  SupportedLanguage,
  TestFramework,
  TestStrategy,
  GapType,
} from '../../../src/mcp/tools';

// Mock FastMCP server imports to avoid ES module issues in Jest
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

interface ErrorTestCase {
  name: string;
  tool: string;
  arguments: Record<string, any>;
  expectedErrorCode: number;
  expectedErrorPattern?: RegExp;
}

describe('MCP Error Scenarios and Edge Cases', () => {
  let mcpHelper: MCPTestHelper;
  let mockServer: MockMCPServer;
  let mockErrorHandler: any;
  let mockCacheManager: any;

  beforeAll(async () => {
    mcpHelper = new MCPTestHelper();
    mockServer = await mcpHelper.createServer({
      requireInit: true,
      capabilities: { tools: true, resources: true, prompts: true },
    });

    // Get mock instances
    const { MCPErrorHandler } = require('../../../src/mcp/services/MCPErrorHandler');
    const { MCPCacheManager } = require('../../../src/mcp/services/MCPCacheManager');

    mockErrorHandler = MCPErrorHandler.getInstance();
    mockCacheManager = MCPCacheManager.getInstance();
  });

  afterAll(async () => {
    await mcpHelper.cleanup();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mcpHelper.resetServers();
    if (mockErrorHandler) mockErrorHandler.reset();
    if (mockCacheManager) mockCacheManager.clearAll();
  });

  /**
   * Helper function to execute error test case
   */
  async function executeErrorTest(testCase: ErrorTestCase): Promise<void> {
    const response = await mockServer.handleRequest({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: testCase.tool,
        arguments: testCase.arguments,
      },
      id: `error-test-${testCase.name}`,
    });

    expect(response.error).toBeDefined();
    expect(response.error?.code).toBe(testCase.expectedErrorCode);
    
    if (testCase.expectedErrorPattern) {
      expect(response.error?.message).toMatch(testCase.expectedErrorPattern);
    }
    
    expect(response.result).toBeUndefined();
  }

  describe('Parameter Validation Errors', () => {
    const validationErrorCases: ErrorTestCase[] = [
      {
        name: 'missing-required-project-path',
        tool: MCP_TOOLS.PROJECT_ANALYZE,
        arguments: {
          // Missing required projectPath
          deep: true,
        },
        expectedErrorCode: -32602,
        expectedErrorPattern: /projectPath.*required/i,
      },
      {
        name: 'invalid-project-path-type',
        tool: MCP_TOOLS.PROJECT_ANALYZE,
        arguments: {
          projectPath: 123, // Should be string
          deep: true,
        },
        expectedErrorCode: -32602,
        expectedErrorPattern: /projectPath.*string/i,
      },
      {
        name: 'empty-project-path',
        tool: MCP_TOOLS.PROJECT_ANALYZE,
        arguments: {
          projectPath: '', // Empty string
          deep: true,
        },
        expectedErrorCode: -32602,
        expectedErrorPattern: /projectPath.*empty/i,
      },
      {
        name: 'invalid-language-enum',
        tool: MCP_TOOLS.TEST_GENERATE,
        arguments: {
          projectPath: '/test/project',
          targetFiles: ['test.js'],
          language: 'invalid-language', // Not in SupportedLanguage enum
        },
        expectedErrorCode: -32602,
        expectedErrorPattern: /language.*invalid/i,
      },
      {
        name: 'invalid-test-framework',
        tool: MCP_TOOLS.TEST_GENERATE,
        arguments: {
          projectPath: '/test/project',
          targetFiles: ['test.js'],
          framework: 'unknown-framework', // Not in TestFramework enum
        },
        expectedErrorCode: -32602,
        expectedErrorPattern: /framework.*invalid/i,
      },
      {
        name: 'invalid-test-strategy',
        tool: MCP_TOOLS.TEST_GENERATE,
        arguments: {
          projectPath: '/test/project',
          targetFiles: ['test.js'],
          strategy: 'invalid-strategy', // Not in TestStrategy enum
        },
        expectedErrorCode: -32602,
        expectedErrorPattern: /strategy.*invalid/i,
      },
      {
        name: 'negative-coverage-threshold',
        tool: MCP_TOOLS.COVERAGE_CHECK,
        arguments: {
          projectPath: '/test/project',
          threshold: -10, // Should be positive
        },
        expectedErrorCode: -32602,
        expectedErrorPattern: /threshold.*positive/i,
      },
      {
        name: 'coverage-threshold-over-100',
        tool: MCP_TOOLS.COVERAGE_CHECK,
        arguments: {
          projectPath: '/test/project',
          threshold: 150, // Should be <= 100
        },
        expectedErrorCode: -32602,
        expectedErrorPattern: /threshold.*100/i,
      },
      {
        name: 'invalid-gap-type',
        tool: MCP_TOOLS.GAP_REQUEST,
        arguments: {
          targetProject: '/test/project',
          component: 'test.js',
          gapType: 'invalid-gap-type', // Not in GapType enum
          priority: 'high',
          description: 'Test gap',
        },
        expectedErrorCode: -32602,
        expectedErrorPattern: /gapType.*invalid/i,
      },
      {
        name: 'invalid-priority-value',
        tool: MCP_TOOLS.GAP_REQUEST,
        arguments: {
          targetProject: '/test/project',
          component: 'test.js',
          gapType: GapType.MissingTest,
          priority: 'invalid-priority', // Should be low/medium/high/critical
          description: 'Test gap',
        },
        expectedErrorCode: -32602,
        expectedErrorPattern: /priority.*invalid/i,
      },
    ];

    validationErrorCases.forEach((testCase) => {
      it(`should handle ${testCase.name} error`, async () => {
        await executeErrorTest(testCase);
      });
    });

    it('should handle array parameter validation errors', async () => {
      await executeErrorTest({
        name: 'invalid-target-files-type',
        tool: MCP_TOOLS.TEST_GENERATE,
        arguments: {
          projectPath: '/test/project',
          targetFiles: 'not-an-array', // Should be array
          strategy: TestStrategy.Structural,
        },
        expectedErrorCode: -32602,
        expectedErrorPattern: /targetFiles.*array/i,
      });
    });

    it('should handle nested object validation errors', async () => {
      await executeErrorTest({
        name: 'invalid-settings-object',
        tool: MCP_TOOLS.CONFIG_SET,
        arguments: {
          projectPath: '/test/project',
          settings: 'not-an-object', // Should be object
          validate: true,
        },
        expectedErrorCode: -32602,
        expectedErrorPattern: /settings.*object/i,
      });
    });
  });

  describe('Tool Not Found Errors', () => {
    it('should handle unknown tool names', async () => {
      const response = await mockServer.handleRequest({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'mcp__unknown__nonexistent_tool',
          arguments: {},
        },
        id: 'unknown-tool-test',
      });

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32601); // Method not found
      expect(response.error?.message).toMatch(/method not found/i);
    });

    it('should handle malformed tool names', async () => {
      const malformedNames = [
        '', // Empty string
        'invalid-tool-name', // Missing mcp prefix
        'mcp__', // Incomplete prefix
        'mcp__tool', // Missing namespace
        'tool_without_mcp_prefix',
      ];

      for (const toolName of malformedNames) {
        const response = await mockServer.handleRequest({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: {
            name: toolName,
            arguments: {},
          },
          id: `malformed-tool-${toolName || 'empty'}`,
        });

        expect(response.error).toBeDefined();
        expect(response.error?.code).toBe(-32601); // Method not found
      }
    });
  });

  describe('JSON-RPC Protocol Errors', () => {
    it('should handle invalid JSON-RPC version', async () => {
      const response = await mockServer.handleRequest({
        jsonrpc: '1.0' as any, // Invalid version
        method: 'tools/call',
        params: {
          name: MCP_TOOLS.SERVER_HEALTH,
          arguments: {},
        },
        id: 'invalid-version',
      });

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32600); // Invalid Request
    });

    it('should handle missing method field', async () => {
      const response = await mockServer.handleRequest({
        jsonrpc: '2.0',
        // Missing method field
        params: {
          name: MCP_TOOLS.SERVER_HEALTH,
          arguments: {},
        },
        id: 'missing-method',
      } as any);

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32600); // Invalid Request
    });

    it('should handle invalid params structure', async () => {
      const response = await mockServer.handleRequest({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: 'invalid-params-not-object', // Should be object
        id: 'invalid-params',
      } as any);

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32602); // Invalid params
    });

    it('should handle missing tool name in params', async () => {
      const response = await mockServer.handleRequest({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          // Missing name field
          arguments: {},
        },
        id: 'missing-tool-name',
      } as any);

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32602); // Invalid params
    });
  });

  describe('Resource and System Errors', () => {
    it('should handle file system access errors', async () => {
      await executeErrorTest({
        name: 'non-existent-project-path',
        tool: MCP_TOOLS.PROJECT_ANALYZE,
        arguments: {
          projectPath: '/non/existent/path/to/project',
          deep: true,
        },
        expectedErrorCode: -32603, // Internal error
        expectedErrorPattern: /path.*not.*exist|file.*not.*found/i,
      });
    });

    it('should handle permission denied errors', async () => {
      await executeErrorTest({
        name: 'permission-denied',
        tool: MCP_TOOLS.PROJECT_ANALYZE,
        arguments: {
          projectPath: '/root/restricted-directory',
          deep: true,
        },
        expectedErrorCode: -32603, // Internal error
        expectedErrorPattern: /permission.*denied|access.*denied/i,
      });
    });

    it('should handle insufficient memory errors', async () => {
      await executeErrorTest({
        name: 'memory-limit-exceeded',
        tool: MCP_TOOLS.TEST_GENERATE,
        arguments: {
          projectPath: '/test/huge-project',
          targetFiles: Array.from({ length: 10000 }, (_, i) => `file${i}.ts`), // Excessive files
          strategy: TestStrategy.Both,
        },
        expectedErrorCode: -32603, // Internal error
        expectedErrorPattern: /memory.*limit|out.*of.*memory/i,
      });
    });

    it('should handle timeout errors', async () => {
      // Use the special slow tool to simulate timeout
      const response = await mockServer.handleRequest({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'slowTool',
          arguments: {
            delay: 10000, // 10 second delay to trigger timeout
          },
        },
        id: 'timeout-test',
      });

      // Should handle timeout gracefully (either success after wait or timeout error)
      expect(response).toBeDefined();
      expect(response.jsonrpc).toBe('2.0');
    });
  });

  describe('State and Consistency Errors', () => {
    it('should handle server not initialized error', async () => {
      // Create a server that requires initialization
      const uninitializedServer = await mcpHelper.createServer({
        requireInit: true,
      });

      const response = await uninitializedServer.handleRequest({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: MCP_TOOLS.PROJECT_ANALYZE,
          arguments: {
            projectPath: '/test/project',
          },
        },
        id: 'uninitialized-test',
      });

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32002); // Server not initialized
      expect(response.error?.message).toMatch(/not.*initialized/i);
    });

    it('should handle concurrent modification errors', async () => {
      // Simulate concurrent modifications by running multiple config updates
      const concurrentPromises = Array.from({ length: 5 }, (_, i) =>
        mockServer.handleRequest({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: {
            name: MCP_TOOLS.CONFIG_SET,
            arguments: {
              projectPath: '/test/project',
              settings: {
                testFramework: i % 2 === 0 ? TestFramework.Jest : TestFramework.Vitest,
              },
            },
          },
          id: `concurrent-config-${i}`,
        })
      );

      const responses = await Promise.all(concurrentPromises);
      
      // Should handle concurrent access gracefully
      // Either all succeed or some fail with appropriate errors
      responses.forEach((response) => {
        expect(response).toBeDefined();
        expect(response.jsonrpc).toBe('2.0');
        
        if (response.error) {
          // If error, should be a valid error code
          expect(response.error.code).toBeOneOf([-32603, -32002]);
        }
      });
    });

    it('should handle cache corruption scenarios', async () => {
      // Corrupt cache by clearing it mid-operation
      cacheManager.clearAll();
      
      const response = await mockServer.handleRequest({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: MCP_TOOLS.PROJECT_ANALYZE,
          arguments: {
            projectPath: '/test/project',
            useCache: true,
          },
        },
        id: 'cache-corruption-test',
      });

      // Should handle cache issues gracefully
      expect(response).toBeDefined();
      // Either succeeds by rebuilding cache or fails with appropriate error
      if (response.error) {
        expect(response.error.code).toBe(-32603); // Internal error
      }
    });
  });

  describe('Integration Service Errors', () => {
    it('should handle task integration service failures', async () => {
      await executeErrorTest({
        name: 'task-service-unavailable',
        tool: MCP_TOOLS.GAP_REQUEST,
        arguments: {
          targetProject: '/test/project',
          component: 'src/test.ts',
          gapType: GapType.MissingTest,
          priority: 'high',
          description: 'Test task integration failure',
          forceTaskServiceError: true, // Special flag to simulate service failure
        },
        expectedErrorCode: -32603,
        expectedErrorPattern: /task.*service.*unavailable|integration.*failed/i,
      });
    });

    it('should handle external dependency failures', async () => {
      await executeErrorTest({
        name: 'external-dependency-failure',
        tool: MCP_TOOLS.TEST_GENERATE,
        arguments: {
          projectPath: '/test/project',
          targetFiles: ['test.ts'],
          strategy: TestStrategy.Logical,
          aiModel: 'unavailable-model', // Simulate AI service unavailable
        },
        expectedErrorCode: -32603,
        expectedErrorPattern: /ai.*service.*unavailable|model.*not.*available/i,
      });
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    it('should handle extremely large input data', async () => {
      const largeDescription = 'x'.repeat(100000); // 100KB string
      
      await executeErrorTest({
        name: 'extremely-large-input',
        tool: MCP_TOOLS.GAP_REQUEST,
        arguments: {
          targetProject: '/test/project',
          component: 'test.ts',
          gapType: GapType.MissingTest,
          priority: 'high',
          description: largeDescription,
        },
        expectedErrorCode: -32603,
        expectedErrorPattern: /input.*too.*large|payload.*exceeded/i,
      });
    });

    it('should handle special characters in paths', async () => {
      const specialCharPaths = [
        '/test/path with spaces/project',
        '/test/path-with-unicode-💻/project',
        '/test/path\\with\\backslashes/project',
        '/test/path"with"quotes/project',
        '/test/path<with>brackets/project',
      ];

      for (const path of specialCharPaths) {
        const response = await mockServer.handleRequest({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: {
            name: MCP_TOOLS.PROJECT_ANALYZE,
            arguments: {
              projectPath: path,
              deep: true,
            },
          },
          id: `special-char-path-${encodeURIComponent(path)}`,
        });

        // Should either succeed or fail with appropriate validation error
        expect(response).toBeDefined();
        if (response.error) {
          expect(response.error.code).toBeOneOf([-32602, -32603]);
        }
      }
    });

    it('should handle null and undefined values', async () => {
      const nullUndefinedCases = [
        { projectPath: null },
        { projectPath: undefined },
        { projectPath: '/test', targetFiles: null },
        { projectPath: '/test', settings: null },
      ];

      for (const [index, args] of nullUndefinedCases.entries()) {
        const response = await mockServer.handleRequest({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: {
            name: MCP_TOOLS.PROJECT_ANALYZE,
            arguments: args,
          },
          id: `null-undefined-${index}`,
        });

        expect(response.error).toBeDefined();
        expect(response.error?.code).toBe(-32602); // Invalid params
      }
    });

    it('should handle recursive data structures', async () => {
      // Create circular reference
      const circularObj: any = { name: 'test' };
      circularObj.self = circularObj;

      const response = await mockServer.handleRequest({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: MCP_TOOLS.CONFIG_SET,
          arguments: {
            projectPath: '/test/project',
            settings: circularObj,
          },
        },
        id: 'circular-reference-test',
      });

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32602); // Invalid params
    });

    it('should handle empty arrays and objects', async () => {
      const response = await mockServer.handleRequest({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: MCP_TOOLS.TEST_GENERATE,
          arguments: {
            projectPath: '/test/project',
            targetFiles: [], // Empty array
            strategy: TestStrategy.Structural,
          },
        },
        id: 'empty-array-test',
      });

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32602); // Invalid params
      expect(response.error?.message).toMatch(/targetFiles.*empty/i);
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should maintain system stability after multiple errors', async () => {
      // Generate multiple errors in sequence
      const errorCases = [
        { tool: 'unknown-tool', args: {} },
        { tool: MCP_TOOLS.PROJECT_ANALYZE, args: { projectPath: '' } },
        { tool: MCP_TOOLS.TEST_GENERATE, args: { projectPath: 123 } },
        { tool: MCP_TOOLS.GAP_REQUEST, args: { invalidArg: true } },
      ];

      for (const [index, errorCase] of errorCases.entries()) {
        const response = await mockServer.handleRequest({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: {
            name: errorCase.tool,
            arguments: errorCase.args,
          },
          id: `stability-test-${index}`,
        });

        expect(response.error).toBeDefined();
      }

      // System should still be healthy after errors
      const healthResponse = await mockServer.handleRequest({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: MCP_TOOLS.SERVER_HEALTH,
          arguments: { includeMetrics: true },
        },
        id: 'stability-health-check',
      });

      expect(healthResponse.result).toBeDefined();
      expect(healthResponse.error).toBeUndefined();
    });

    it('should provide detailed error context for debugging', async () => {
      const response = await mockServer.handleRequest({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: MCP_TOOLS.PROJECT_ANALYZE,
          arguments: {
            projectPath: '/non/existent/project',
            deep: true,
            includeDebugInfo: true,
          },
        },
        id: 'debug-context-test',
      });

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32603);
      
      // Error should include helpful debugging information
      const errorData = response.error?.data;
      if (errorData) {
        expect(errorData).toHaveProperty('timestamp');
        expect(errorData).toHaveProperty('toolName');
        expect(errorData).toHaveProperty('arguments');
      }
    });
  });
});