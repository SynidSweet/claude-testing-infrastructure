import type { MCPProjectAnalysis } from '../../types/mcp-types';

export class MCPMessageHandlingTemplate {
  generateMessageTests(analysis: MCPProjectAnalysis): { path: string; content: string } {
    const isTypeScript = analysis.languages.some((l) => l.name === 'typescript');
    const extension = isTypeScript ? 'ts' : 'js';

    return {
      path: `.claude-testing/mcp-message-handling.test.${extension}`,
      content: this.generateTestContent(isTypeScript, analysis),
    };
  }

  private generateTestContent(isTypeScript: boolean, analysis: MCPProjectAnalysis): string {
    const imports = this.generateImports(
      analysis.mcpCapabilities?.framework || 'custom',
      isTypeScript
    );
    const setup = this.generateSetup();
    const tests = this.generateTests();

    return `${imports}

${setup}

describe('MCP Async Message Handling', () => {
${tests}
});
`;
  }

  private generateImports(framework: string, isTypeScript: boolean): string {
    const imports = [];

    if (framework === 'fastmcp') {
      imports.push("import { FastMCP } from 'fastmcp';");
    }

    imports.push("import { EventEmitter } from 'events';");

    if (isTypeScript) {
      imports.push("import { JSONRPCMessage } from '@modelcontextprotocol/sdk/types';");
    }

    return imports.join('\n');
  }

  private generateSetup(): string {
    return `
let mcpServer;
let messageQueue;

beforeAll(async () => {
  mcpServer = await createMCPServer();
  messageQueue = [];
});

afterAll(async () => {
  if (mcpServer && mcpServer.close) {
    await mcpServer.close();
  }
});

beforeEach(() => {
  messageQueue = [];
});`;
  }

  private generateTests(): string {
    return `
  describe('Message Ordering and Sequencing', () => {
    test('should process messages in order', async () => {
      const messages = [
        { jsonrpc: '2.0', method: 'initialize', params: { protocolVersion: '2024-11-05' }, id: 1 },
        { jsonrpc: '2.0', method: 'tools/list', id: 2 },
        { jsonrpc: '2.0', method: 'resources/list', id: 3 }
      ];
      
      const responses = [];
      for (const message of messages) {
        const response = await mcpServer.handleRequest(message);
        responses.push(response);
      }
      
      // Verify responses are in order
      expect(responses[0].id).toBe(1);
      expect(responses[1].id).toBe(2);
      expect(responses[2].id).toBe(3);
    });

    test('should handle interleaved requests and notifications', async () => {
      const messages = [
        { jsonrpc: '2.0', method: 'tools/list', id: 1 },
        { jsonrpc: '2.0', method: 'notifications/progress', params: { progress: 25 } }, // No ID
        { jsonrpc: '2.0', method: 'resources/list', id: 2 },
        { jsonrpc: '2.0', method: 'notifications/progress', params: { progress: 50 } }, // No ID
      ];
      
      const responses = [];
      for (const message of messages) {
        const response = await mcpServer.handleRequest(message);
        if (response) {
          responses.push(response);
        }
      }
      
      // Only requests with IDs should have responses
      expect(responses.length).toBe(2);
      expect(responses[0].id).toBe(1);
      expect(responses[1].id).toBe(2);
    });
  });

  describe('Concurrent Request Handling', () => {
    test('should handle concurrent tool calls', async () => {
      const toolCalls = [
        { jsonrpc: '2.0', method: 'tools/call', params: { name: 'tool1', arguments: {} }, id: 1 },
        { jsonrpc: '2.0', method: 'tools/call', params: { name: 'tool2', arguments: {} }, id: 2 },
        { jsonrpc: '2.0', method: 'tools/call', params: { name: 'tool3', arguments: {} }, id: 3 }
      ];
      
      // Send all requests concurrently
      const responsePromises = toolCalls.map(call => mcpServer.handleRequest(call));
      const responses = await Promise.all(responsePromises);
      
      // All responses should be successful
      expect(responses).toHaveLength(3);
      responses.forEach((response, index) => {
        expect(response).toHaveProperty('result');
        expect(response.id).toBe(index + 1);
      });
    });

    test('should handle mixed concurrent operations', async () => {
      const operations = [
        mcpServer.handleRequest({ jsonrpc: '2.0', method: 'tools/list', id: 1 }),
        mcpServer.handleRequest({ jsonrpc: '2.0', method: 'resources/list', id: 2 }),
        mcpServer.handleRequest({ jsonrpc: '2.0', method: 'prompts/list', id: 3 }),
        mcpServer.handleRequest({ jsonrpc: '2.0', method: 'tools/call', params: { name: 'test', arguments: {} }, id: 4 })
      ];
      
      const responses = await Promise.all(operations);
      
      expect(responses).toHaveLength(4);
      expect(responses.every(r => r.jsonrpc === '2.0')).toBe(true);
      expect(responses.every(r => r.result || r.error)).toBe(true);
    });
  });

  describe('Connection Lifecycle Management', () => {
    test('should handle connection initialization', async () => {
      const initRequest = {
        jsonrpc: '2.0',
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {}
        },
        id: 1
      };
      
      const response = await mcpServer.handleRequest(initRequest);
      
      expect(response).toHaveProperty('result');
      expect(response.result).toHaveProperty('protocolVersion');
      expect(response.result).toHaveProperty('serverInfo');
    });

    test('should reject requests before initialization', async () => {
      const uninitializedServer = await createMCPServer({ requireInit: true });
      
      const request = {
        jsonrpc: '2.0',
        method: 'tools/list',
        id: 1
      };
      
      const response = await uninitializedServer.handleRequest(request);
      
      expect(response).toHaveProperty('error');
      expect(response.error.message).toContain('initialized');
    });

    test('should handle connection teardown', async () => {
      const server = await createMCPServer();
      
      // Initialize connection
      await server.handleRequest({
        jsonrpc: '2.0',
        method: 'initialize',
        params: { protocolVersion: '2024-11-05' },
        id: 1
      });
      
      // Close connection
      const closeResponse = await server.handleRequest({
        jsonrpc: '2.0',
        method: 'close',
        id: 2
      });
      
      expect(closeResponse).toHaveProperty('result', null);
      
      // Subsequent requests should fail
      const afterClose = await server.handleRequest({
        jsonrpc: '2.0',
        method: 'tools/list',
        id: 3
      });
      
      expect(afterClose).toHaveProperty('error');
    });
  });

  describe('Session State Persistence', () => {
    test('should maintain session state across requests', async () => {
      // Set session data
      await mcpServer.handleRequest({
        jsonrpc: '2.0',
        method: 'session/set',
        params: { key: 'userId', value: '12345' },
        id: 1
      });
      
      // Retrieve session data in another request
      const response = await mcpServer.handleRequest({
        jsonrpc: '2.0',
        method: 'session/get',
        params: { key: 'userId' },
        id: 2
      });
      
      expect(response.result).toEqual({ value: '12345' });
    });

    test('should isolate session state between connections', async () => {
      const server1 = await createMCPServer();
      const server2 = await createMCPServer();
      
      // Set data in server1
      await server1.handleRequest({
        jsonrpc: '2.0',
        method: 'session/set',
        params: { key: 'data', value: 'server1' },
        id: 1
      });
      
      // Try to get data from server2
      const response = await server2.handleRequest({
        jsonrpc: '2.0',
        method: 'session/get',
        params: { key: 'data' },
        id: 2
      });
      
      expect(response.result).not.toEqual({ value: 'server1' });
    });
  });

  describe('Timeout and Cancellation', () => {
    test('should handle request timeouts', async () => {
      const request = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'slowTool',
          arguments: { delay: 5000 } // 5 second delay
        },
        id: 1
      };
      
      // Set a shorter timeout
      const timeoutPromise = new Promise((resolve) => {
        setTimeout(() => resolve({ error: { code: -32000, message: 'Request timeout' } }), 1000);
      });
      
      const responsePromise = mcpServer.handleRequest(request);
      const result = await Promise.race([responsePromise, timeoutPromise]);
      
      expect(result).toHaveProperty('error');
      expect(result.error.message).toContain('timeout');
    });

    test('should support request cancellation', async () => {
      const controller = new AbortController();
      
      const request = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'cancelableTool',
          arguments: {}
        },
        id: 1
      };
      
      // Start request with cancellation signal
      const responsePromise = mcpServer.handleRequest(request, { signal: controller.signal });
      
      // Cancel after 100ms
      setTimeout(() => controller.abort(), 100);
      
      try {
        await responsePromise;
        fail('Request should have been cancelled');
      } catch (error) {
        expect(error.message).toContain('aborted');
      }
    });
  });`;
  }
}
