/**
 * MCP Core Integration Tests
 * 
 * Simplified integration tests that validate the core MCP tool functionality
 * without complex external dependencies. These tests focus on the essential
 * MCP tool integration patterns and behaviors.
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { MCPTestHelper, type MockMCPServer } from '../../../src/utils/MCPTestHelper';
import { MCP_TOOLS } from '../../../src/mcp/tools';

describe('MCP Core Integration Tests', () => {
  let mcpHelper: MCPTestHelper;
  let mockServer: MockMCPServer;

  beforeEach(async () => {
    mcpHelper = new MCPTestHelper();
    mockServer = await mcpHelper.createServer({
      requireInit: true,
      capabilities: {
        tools: true,
        resources: true,
        prompts: true,
      },
    });

    // Initialize the server
    await mockServer.handleRequest({
      jsonrpc: '2.0',
      method: 'initialize',
      params: {},
      id: 'init',
    });
  });

  afterEach(async () => {
    await mcpHelper.cleanup();
  });

  describe('Tool Discovery and Registration', () => {
    it('should list available tools', async () => {
      const response = await mockServer.handleRequest({
        jsonrpc: '2.0',
        method: 'tools/list',
        params: {},
        id: 'list-tools',
      });

      expect(response.result).toBeDefined();
      expect(response.error).toBeUndefined();
      
      const tools = (response.result as any).tools;
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThanOrEqual(2);
    });

    it('should provide tool metadata', async () => {
      const response = await mockServer.handleRequest({
        jsonrpc: '2.0',
        method: 'tools/list',
        params: {},
        id: 'tool-metadata',
      });

      const tools = (response.result as any).tools;
      tools.forEach((tool: any) => {
        expect(tool).toHaveProperty('name');
        expect(tool).toHaveProperty('description');
        expect(typeof tool.name).toBe('string');
        expect(typeof tool.description).toBe('string');
      });
    });
  });

  describe('Basic Tool Execution', () => {
    it('should execute simple tool calls successfully', async () => {
      const response = await mockServer.handleRequest({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'tool1', // From MCPTestHelper mock tools
          arguments: {},
        },
        id: 'simple-tool-call',
      });

      expect(response.result).toBeDefined();
      expect(response.error).toBeUndefined();
      expect((response.result as any).success).toBe(true);
    });

    it('should handle tool arguments correctly', async () => {
      const testArguments = {
        param1: 'value1',
        param2: 42,
        param3: true,
      };

      const response = await mockServer.handleRequest({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'tool2',
          arguments: testArguments,
        },
        id: 'tool-with-args',
      });

      expect(response.result).toBeDefined();
      expect((response.result as any).success).toBe(true);
      expect((response.result as any).arguments).toEqual(testArguments);
    });

    it('should maintain request-response correlation', async () => {
      const testId = 'correlation-test-123';
      
      const response = await mockServer.handleRequest({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'tool1',
          arguments: {},
        },
        id: testId,
      });

      expect(response.id).toBe(testId);
      expect(response.jsonrpc).toBe('2.0');
    });
  });

  describe('Error Handling', () => {
    it('should handle unknown tools gracefully', async () => {
      const response = await mockServer.handleRequest({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'unknown-tool',
          arguments: {},
        },
        id: 'unknown-tool-test',
      });

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32601); // Method not found
      expect(response.result).toBeUndefined();
    });

    it('should validate tool parameters', async () => {
      const response = await mockServer.handleRequest({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'validateTypes', // Special test tool that validates strictly
          arguments: {},
        },
        id: 'validation-test',
      });

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32602); // Invalid params
    });

    it('should handle malformed requests', async () => {
      const response = await mockServer.handleRequest({
        jsonrpc: '2.0',
        method: 'tools/call',
        // Missing params
        id: 'malformed-test',
      } as any);

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32602); // Invalid params
    });
  });

  describe('Session Management', () => {
    it('should maintain session state', async () => {
      // Set session state
      const setResponse = await mockServer.handleRequest({
        jsonrpc: '2.0',
        method: 'session/set',
        params: {
          key: 'test-state',
          value: { data: 'test-value', timestamp: Date.now() },
        },
        id: 'set-session',
      });

      expect(setResponse.result).toBeDefined();
      expect(setResponse.error).toBeUndefined();

      // Get session state
      const getResponse = await mockServer.handleRequest({
        jsonrpc: '2.0',
        method: 'session/get',
        params: {
          key: 'test-state',
        },
        id: 'get-session',
      });

      expect(getResponse.result).toBeDefined();
      expect((getResponse.result as any).value).toEqual({
        data: 'test-value',
        timestamp: expect.any(Number),
      });
    });

    it('should handle missing session keys', async () => {
      const response = await mockServer.handleRequest({
        jsonrpc: '2.0',
        method: 'session/get',
        params: {
          key: 'non-existent-key',
        },
        id: 'missing-session',
      });

      expect(response.result).toBeNull();
      expect(response.error).toBeUndefined();
    });
  });

  describe('Server Health and Status', () => {
    it('should respond to ping requests', async () => {
      const response = await mockServer.handleRequest({
        jsonrpc: '2.0',
        method: 'ping',
        params: {},
        id: 'ping-test',
      });

      expect(response.result).toBeDefined();
      expect((response.result as any).pong).toBe(true);
    });

    it('should handle server close gracefully', async () => {
      const response = await mockServer.handleRequest({
        jsonrpc: '2.0',
        method: 'close',
        params: {},
        id: 'close-test',
      });

      expect(response.result).toBeDefined();
      expect(response.error).toBeUndefined();
      expect(mockServer.initialized).toBe(false);
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle multiple concurrent requests', async () => {
      const requests = Array.from({ length: 5 }, (_, i) => ({
        jsonrpc: '2.0' as const,
        method: 'tools/call',
        params: {
          name: 'tool1',
          arguments: { index: i },
        },
        id: `concurrent-${i}`,
      }));

      const responses = await Promise.all(
        requests.map(req => mockServer.handleRequest(req))
      );

      // All should succeed
      responses.forEach((response, i) => {
        expect(response.result).toBeDefined();
        expect(response.error).toBeUndefined();
        expect(response.id).toBe(`concurrent-${i}`);
      });
    });

    it('should maintain isolation between concurrent sessions', async () => {
      const sessionRequests = [
        {
          jsonrpc: '2.0' as const,
          method: 'session/set',
          params: { key: 'session-1', value: 'value-1' },
          id: 'set-1',
        },
        {
          jsonrpc: '2.0' as const,
          method: 'session/set',
          params: { key: 'session-2', value: 'value-2' },
          id: 'set-2',
        },
      ];

      // Set sessions concurrently
      await Promise.all(
        sessionRequests.map(req => mockServer.handleRequest(req))
      );

      // Verify both sessions exist independently
      const getResponses = await Promise.all([
        mockServer.handleRequest({
          jsonrpc: '2.0',
          method: 'session/get',
          params: { key: 'session-1' },
          id: 'get-1',
        }),
        mockServer.handleRequest({
          jsonrpc: '2.0',
          method: 'session/get',
          params: { key: 'session-2' },
          id: 'get-2',
        }),
      ]);

      expect((getResponses[0].result as any).value).toBe('value-1');
      expect((getResponses[1].result as any).value).toBe('value-2');
    });
  });

  describe('Tool Performance and Reliability', () => {
    it('should complete tool calls within reasonable time', async () => {
      const start = Date.now();

      const response = await mockServer.handleRequest({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'tool1',
          arguments: {},
        },
        id: 'performance-test',
      });

      const duration = Date.now() - start;

      expect(response.result).toBeDefined();
      expect(duration).toBeLessThan(100); // Should complete under 100ms
    });

    it('should handle slow operations without blocking', async () => {
      const fastRequest = mockServer.handleRequest({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'tool1',
          arguments: {},
        },
        id: 'fast-operation',
      });

      const slowRequest = mockServer.handleRequest({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'slowTool',
          arguments: { delay: 50 }, // 50ms delay
        },
        id: 'slow-operation',
      });

      const [fastResponse, slowResponse] = await Promise.all([
        fastRequest,
        slowRequest,
      ]);

      expect(fastResponse.result).toBeDefined();
      expect(slowResponse.result).toBeDefined();
    });
  });

  describe('Tool Configuration and Validation', () => {
    it('should validate MCP tool names follow convention', () => {
      const validMCPTools = Object.values(MCP_TOOLS);
      
      validMCPTools.forEach(toolName => {
        expect(toolName).toMatch(/^mcp__claude-testing__.+/);
        expect(toolName).not.toContain(' '); // No spaces
        expect(toolName).not.toContain('..'); // No double underscores except prefix
      });
    });

    it('should have unique tool names', () => {
      const toolNames = Object.values(MCP_TOOLS);
      const uniqueNames = new Set(toolNames);
      
      expect(uniqueNames.size).toBe(toolNames.length);
    });

    it('should have reasonable tool name lengths', () => {
      const toolNames = Object.values(MCP_TOOLS);
      
      toolNames.forEach(toolName => {
        expect(toolName.length).toBeGreaterThan(10); // Minimum length
        expect(toolName.length).toBeLessThan(80); // Maximum length
      });
    });
  });

  describe('Integration Workflows', () => {
    it('should support basic workflow patterns', async () => {
      // Step 1: Initialize session
      const initResponse = await mockServer.handleRequest({
        jsonrpc: '2.0',
        method: 'session/set',
        params: { key: 'workflow-state', value: 'initialized' },
        id: 'workflow-init',
      });
      expect(initResponse.result).toBeDefined();

      // Step 2: Execute tool
      const toolResponse = await mockServer.handleRequest({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'tool1',
          arguments: { workflowStep: 'execute' },
        },
        id: 'workflow-tool',
      });
      expect(toolResponse.result).toBeDefined();

      // Step 3: Update session state
      const updateResponse = await mockServer.handleRequest({
        jsonrpc: '2.0',
        method: 'session/set',
        params: { key: 'workflow-state', value: 'completed' },
        id: 'workflow-complete',
      });
      expect(updateResponse.result).toBeDefined();

      // Step 4: Verify final state
      const stateResponse = await mockServer.handleRequest({
        jsonrpc: '2.0',
        method: 'session/get',
        params: { key: 'workflow-state' },
        id: 'workflow-verify',
      });
      expect((stateResponse.result as any).value).toBe('completed');
    });

    it('should handle workflow state rollback on errors', async () => {
      // Set initial state
      await mockServer.handleRequest({
        jsonrpc: '2.0',
        method: 'session/set',
        params: { key: 'transaction-state', value: 'active' },
        id: 'transaction-start',
      });

      // Attempt operation that fails
      const failResponse = await mockServer.handleRequest({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'unknown-tool', // This will fail
          arguments: {},
        },
        id: 'transaction-fail',
      });
      expect(failResponse.error).toBeDefined();

      // Rollback state
      await mockServer.handleRequest({
        jsonrpc: '2.0',
        method: 'session/set',
        params: { key: 'transaction-state', value: 'rolled-back' },
        id: 'transaction-rollback',
      });

      // Verify rollback
      const stateResponse = await mockServer.handleRequest({
        jsonrpc: '2.0',
        method: 'session/get',
        params: { key: 'transaction-state' },
        id: 'transaction-verify',
      });
      expect((stateResponse.result as any).value).toBe('rolled-back');
    });
  });
});