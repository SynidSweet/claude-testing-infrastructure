import type { MCPTool } from '../../analyzers/ProjectAnalyzer';
import type { MCPProjectAnalysis } from '../../types/mcp-types';

// JSON Schema type definitions for tool input validation
interface JSONSchemaProperty {
  type?: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'null';
  description?: string;
  default?: unknown;
  enum?: unknown[];
  required?: string[];
}

interface JSONSchema {
  type?: string;
  properties?: Record<string, JSONSchemaProperty>;
  required?: string[];
}

export class MCPToolIntegrationTemplate {
  generateToolTests(
    tools: MCPTool[],
    analysis: MCPProjectAnalysis
  ): { path: string; content: string } {
    const isTypeScript = analysis.languages.some((l) => l.name === 'typescript');
    const extension = isTypeScript ? 'ts' : 'js';

    return {
      path: `.claude-testing/mcp-tool-integration.test.${extension}`,
      content: this.generateTestContent(tools, isTypeScript, analysis),
    };
  }

  private generateTestContent(
    tools: MCPTool[],
    isTypeScript: boolean,
    analysis: MCPProjectAnalysis
  ): string {
    const imports = this.generateImports(
      analysis.mcpCapabilities?.framework || 'custom',
      isTypeScript
    );
    const setup = this.generateSetup();
    const tests = this.generateTests(tools);

    return `${imports}

${setup}

describe('MCP Tool Integration', () => {
${tests}
});
`;
  }

  private generateImports(framework: string, isTypeScript: boolean): string {
    const imports = [];

    if (framework === 'fastmcp') {
      imports.push("import { FastMCP } from 'fastmcp';");
    }

    if (isTypeScript) {
      imports.push(
        "import { CallToolRequest, ListToolsRequest } from '@modelcontextprotocol/sdk/types';"
      );
    }

    return imports.join('\n');
  }

  private generateSetup(): string {
    return `
let mcpServer;

beforeAll(async () => {
  // Initialize your MCP server with tools
  mcpServer = await createMCPServer();
});

afterAll(async () => {
  if (mcpServer && mcpServer.close) {
    await mcpServer.close();
  }
});`;
  }

  private generateTests(tools: MCPTool[]): string {
    const toolTests =
      tools.length > 0 ? this.generateSpecificToolTests(tools) : this.generateGenericToolTests();

    return `
  describe('Tool Discovery', () => {
    test('should list available tools', async () => {
      const request = {
        jsonrpc: '2.0',
        method: 'tools/list',
        id: 1
      };
      
      const response = await mcpServer.handleRequest(request);
      
      expect(response).toHaveProperty('result');
      expect(response.result).toHaveProperty('tools');
      expect(Array.isArray(response.result.tools)).toBe(true);
      
      // Each tool should have required fields
      response.result.tools.forEach(tool => {
        expect(tool).toHaveProperty('name');
        expect(tool).toHaveProperty('description');
        expect(tool).toHaveProperty('inputSchema');
        expect(tool.inputSchema).toHaveProperty('type', 'object');
      });
    });

    test('should return empty array if no tools available', async () => {
      const serverWithoutTools = await createMCPServer({ tools: [] });
      
      const request = {
        jsonrpc: '2.0',
        method: 'tools/list',
        id: 2
      };
      
      const response = await serverWithoutTools.handleRequest(request);
      
      expect(response.result.tools).toEqual([]);
    });
  });

  describe('Tool Execution', () => {
${toolTests}

    test('should handle tool execution errors gracefully', async () => {
      const request = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'errorTool',
          arguments: { throwError: true }
        },
        id: 10
      };
      
      const response = await mcpServer.handleRequest(request);
      
      expect(response).toHaveProperty('result');
      expect(response.result).toHaveProperty('isError', true);
      expect(response.result).toHaveProperty('content');
    });
  });

  describe('Tool Input Validation', () => {
    test('should validate required parameters', async () => {
      const request = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'testTool',
          arguments: {} // Missing required parameters
        },
        id: 11
      };
      
      const response = await mcpServer.handleRequest(request);
      
      expect(response).toHaveProperty('error');
      expect(response.error).toHaveProperty('code', -32602); // Invalid params
      expect(response.error.message).toContain('required');
    });

    test('should validate parameter types', async () => {
      const request = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'testTool',
          arguments: {
            numberParam: 'not-a-number', // Wrong type
            stringParam: 123 // Wrong type
          }
        },
        id: 12
      };
      
      const response = await mcpServer.handleRequest(request);
      
      expect(response).toHaveProperty('error');
      expect(response.error.message).toContain('type');
    });
  });

  describe('Tool Context and State', () => {
    test('should maintain context between tool calls', async () => {
      // First call to set state
      const firstRequest = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'setState',
          arguments: { key: 'testKey', value: 'testValue' }
        },
        id: 13
      };
      
      await mcpServer.handleRequest(firstRequest);
      
      // Second call to get state
      const secondRequest = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'getState',
          arguments: { key: 'testKey' }
        },
        id: 14
      };
      
      const response = await mcpServer.handleRequest(secondRequest);
      
      expect(response.result.content).toContain('testValue');
    });
  });`;
  }

  private generateSpecificToolTests(tools: MCPTool[]): string {
    const testCases = tools
      .slice(0, 3)
      .map(
        (tool, index) => `
    test('should execute ${tool.name} tool', async () => {
      const request = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: '${tool.name}',
          arguments: ${this.generateSampleArguments(tool)}
        },
        id: ${index + 3}
      };
      
      const response = await mcpServer.handleRequest(request);
      
      expect(response).toHaveProperty('result');
      expect(response.result).toHaveProperty('content');
      expect(Array.isArray(response.result.content)).toBe(true);
      expect(response.result.content.length).toBeGreaterThan(0);
      expect(response.result.content[0]).toHaveProperty('type');
      expect(response.result.content[0]).toHaveProperty('text');
    });`
      )
      .join('\n');

    return testCases;
  }

  private generateGenericToolTests(): string {
    return `
    test('should execute a basic tool', async () => {
      const request = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'echo',
          arguments: { message: 'Hello MCP' }
        },
        id: 3
      };
      
      const response = await mcpServer.handleRequest(request);
      
      expect(response).toHaveProperty('result');
      expect(response.result).toHaveProperty('content');
      expect(Array.isArray(response.result.content)).toBe(true);
    });

    test('should handle unknown tool name', async () => {
      const request = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'nonexistentTool',
          arguments: {}
        },
        id: 4
      };
      
      const response = await mcpServer.handleRequest(request);
      
      expect(response).toHaveProperty('error');
      expect(response.error.message).toContain('tool');
    });`;
  }

  private generateSampleArguments(tool: MCPTool): string {
    // Generate sample arguments based on input schema if available
    if (!tool.inputSchema || typeof tool.inputSchema !== 'object') {
      return '{}';
    }

    const schema = tool.inputSchema as JSONSchema;
    const sampleArgs: Record<string, unknown> = {};

    if (schema.properties) {
      Object.entries(schema.properties).forEach(([key, prop]) => {
        switch (prop.type) {
          case 'string':
            sampleArgs[key] = 'test string';
            break;
          case 'number':
            sampleArgs[key] = 123;
            break;
          case 'boolean':
            sampleArgs[key] = true;
            break;
          case 'array':
            sampleArgs[key] = [];
            break;
          case 'object':
            sampleArgs[key] = {};
            break;
          default:
            sampleArgs[key] = null;
        }
      });
    }

    return JSON.stringify(sampleArgs, null, 8);
  }
}
