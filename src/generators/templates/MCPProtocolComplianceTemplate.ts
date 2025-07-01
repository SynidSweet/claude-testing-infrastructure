import { MCPProjectAnalysis } from '../../types/mcp-types';

export class MCPProtocolComplianceTemplate {
  generateComplianceTests(analysis: MCPProjectAnalysis): { path: string; content: string } {
    const framework = analysis.mcpCapabilities?.framework || 'custom';
    const isTypeScript = analysis.languages.some(l => l.name === 'typescript');
    const extension = isTypeScript ? 'ts' : 'js';
    
    return {
      path: `.claude-testing/mcp-protocol-compliance.test.${extension}`,
      content: this.generateTestContent(framework, isTypeScript, analysis),
    };
  }

  private generateTestContent(framework: string, isTypeScript: boolean, _analysis: MCPProjectAnalysis): string {
    const imports = this.generateImports(framework, isTypeScript);
    const setup = this.generateSetup(framework);
    const tests = this.generateTests();
    
    return `${imports}

${setup}

describe('MCP Protocol Compliance', () => {
${tests}
});
`;
  }

  private generateImports(framework: string, isTypeScript: boolean): string {
    const baseImports = [];
    
    if (framework === 'fastmcp') {
      baseImports.push("import { FastMCP } from 'fastmcp';");
    } else if (framework === 'official-sdk') {
      baseImports.push("import { Server } from '@modelcontextprotocol/sdk/server';");
    }
    
    if (isTypeScript) {
      baseImports.push("import { JSONRPCRequest, JSONRPCResponse } from '@modelcontextprotocol/sdk/types';");
    }
    
    return baseImports.join('\n');
  }

  private generateSetup(framework: string): string {
    if (framework === 'fastmcp') {
      return `
let mcpServer;

beforeAll(async () => {
  mcpServer = new FastMCP();
  await mcpServer.start();
});

afterAll(async () => {
  await mcpServer.stop();
});`;
    } else {
      return `
let mcpServer;

beforeAll(async () => {
  // Initialize your MCP server
  mcpServer = await createMCPServer();
});

afterAll(async () => {
  // Clean up
  if (mcpServer && mcpServer.close) {
    await mcpServer.close();
  }
});`;
    }
  }

  private generateTests(): string {
    return `
  describe('JSON-RPC 2.0 Compliance', () => {
    test('should validate JSON-RPC 2.0 message format', async () => {
      const request = { 
        jsonrpc: '2.0', 
        method: 'initialize', 
        params: { 
          protocolVersion: '2024-11-05',
          capabilities: {}
        },
        id: 1 
      };
      
      const response = await mcpServer.handleRequest(request);
      
      expect(response).toHaveProperty('jsonrpc', '2.0');
      expect(response).toHaveProperty('id', 1);
      expect(response).toHaveProperty('result');
      expect(response).not.toHaveProperty('error');
    });

    test('should handle missing jsonrpc field', async () => {
      const request = { 
        method: 'initialize', 
        params: {},
        id: 2 
      };
      
      const response = await mcpServer.handleRequest(request);
      
      expect(response).toHaveProperty('error');
      expect(response.error).toHaveProperty('code', -32600); // Invalid Request
    });

    test('should handle invalid method', async () => {
      const request = { 
        jsonrpc: '2.0', 
        method: 'invalidMethod', 
        id: 3 
      };
      
      const response = await mcpServer.handleRequest(request);
      
      expect(response).toHaveProperty('error');
      expect(response.error).toHaveProperty('code', -32601); // Method not found
    });
  });

  describe('Capability Negotiation', () => {
    test('should handle initialize request', async () => {
      const request = {
        jsonrpc: '2.0',
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: true,
            resources: true
          }
        },
        id: 4
      };
      
      const response = await mcpServer.handleRequest(request);
      
      expect(response).toHaveProperty('result');
      expect(response.result).toHaveProperty('protocolVersion');
      expect(response.result).toHaveProperty('capabilities');
      expect(response.result).toHaveProperty('serverInfo');
    });

    test('should reject mismatched protocol version', async () => {
      const request = {
        jsonrpc: '2.0',
        method: 'initialize',
        params: {
          protocolVersion: '1.0.0', // Old version
          capabilities: {}
        },
        id: 5
      };
      
      const response = await mcpServer.handleRequest(request);
      
      expect(response).toHaveProperty('error');
      expect(response.error.message).toContain('protocol version');
    });
  });

  describe('Request/Response Correlation', () => {
    test('should maintain request ID in response', async () => {
      const ids = [1, 'string-id', null];
      
      for (const id of ids) {
        const request = {
          jsonrpc: '2.0',
          method: 'ping',
          id: id
        };
        
        const response = await mcpServer.handleRequest(request);
        
        expect(response).toHaveProperty('id', id);
      }
    });

    test('should handle notification (no id)', async () => {
      const notification = {
        jsonrpc: '2.0',
        method: 'notifications/progress',
        params: { progress: 50 }
        // No id field
      };
      
      const response = await mcpServer.handleRequest(notification);
      
      expect(response).toBeUndefined(); // Notifications don't get responses
    });
  });

  describe('Error Handling', () => {
    test('should return parse error for invalid JSON', async () => {
      const response = await mcpServer.handleRawInput('invalid json');
      
      expect(response).toHaveProperty('error');
      expect(response.error).toHaveProperty('code', -32700); // Parse error
    });

    test('should return invalid params error', async () => {
      const request = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          // Missing required 'name' field
          arguments: {}
        },
        id: 6
      };
      
      const response = await mcpServer.handleRequest(request);
      
      expect(response).toHaveProperty('error');
      expect(response.error).toHaveProperty('code', -32602); // Invalid params
    });
  });`;
  }
}