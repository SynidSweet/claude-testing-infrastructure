import { MCPProjectAnalysis } from '../../types/mcp-types';

export class MCPChaosTemplate {
  generateChaosTests(analysis: MCPProjectAnalysis): { path: string; content: string } {
    const isTypeScript = analysis.languages.some(l => l.name === 'typescript');
    const extension = isTypeScript ? 'ts' : 'js';
    
    return {
      path: `.claude-testing/mcp-chaos-testing.test.${extension}`,
      content: this.generateTestContent(isTypeScript, analysis),
    };
  }

  private generateTestContent(_isTypeScript: boolean, analysis: MCPProjectAnalysis): string {
    const imports = this.generateImports(analysis.mcpCapabilities?.framework || 'custom', _isTypeScript);
    const setup = this.generateSetup();
    const tests = this.generateTests();
    
    return `${imports}

${setup}

describe('MCP Chaos Testing - LLM Input Simulation', () => {
${tests}
});
`;
  }

  private generateImports(framework: string, _isTypeScript: boolean): string {
    const imports = [];
    
    if (framework === 'fastmcp') {
      imports.push("import { FastMCP } from 'fastmcp';");
    }
    
    return imports.join('\n');
  }

  private generateSetup(): string {
    return `
let mcpServer;

beforeAll(async () => {
  mcpServer = await createMCPServer();
});

afterAll(async () => {
  if (mcpServer && mcpServer.close) {
    await mcpServer.close();
  }
});

// Chaos test utilities
const chaosGenerators = {
  randomString: (length = 10) => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
    return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  },
  
  randomJSON: (depth = 3) => {
    if (depth <= 0) return chaosGenerators.randomString();
    const types = ['string', 'number', 'boolean', 'array', 'object', 'null'];
    const type = types[Math.floor(Math.random() * types.length)];
    
    switch (type) {
      case 'string': return chaosGenerators.randomString();
      case 'number': return Math.random() * 1000000 - 500000;
      case 'boolean': return Math.random() > 0.5;
      case 'array': return Array.from({ length: Math.floor(Math.random() * 5) }, () => chaosGenerators.randomJSON(depth - 1));
      case 'object': {
        const obj = {};
        for (let i = 0; i < Math.floor(Math.random() * 5); i++) {
          obj[chaosGenerators.randomString(5)] = chaosGenerators.randomJSON(depth - 1);
        }
        return obj;
      }
      case 'null': return null;
    }
  },
  
  malformedInput: () => {
    const patterns = [
      { name: 123 }, // Wrong type for name
      { name: null }, // Null name
      { name: '' }, // Empty name
      { name: 'test', arguments: 'not-an-object' }, // Wrong argument type
      { name: 'test', args: {} }, // Wrong property name
      { Name: 'test' }, // Wrong case
      { name: 'test'.repeat(1000) }, // Very long name
      { name: 'test\\x00null' }, // Null character
      { name: 'test', arguments: { circular: null } }, // Will be made circular
    ];
    return patterns[Math.floor(Math.random() * patterns.length)];
  }
};`;
  }

  private generateTests(): string {
    return `
  describe('Malformed Tool Parameters', () => {
    test('should handle wrong parameter types gracefully', async () => {
      const wrongTypeInputs = [
        { stringAsNumber: "not-a-number", expectedNumber: true },
        { numberAsString: 123, expectedString: true },
        { arrayAsObject: { 0: 'a', 1: 'b' }, expectedArray: true },
        { objectAsArray: ['key', 'value'], expectedObject: true },
        { booleanAsString: 'true', expectedBoolean: true }
      ];
      
      for (const input of wrongTypeInputs) {
        const request = {
          jsonrpc: '2.0',
          method: 'tools/call',
          params: {
            name: 'validateTypes',
            arguments: input
          },
          id: Math.random()
        };
        
        const response = await mcpServer.handleRequest(request);
        
        expect(response).toHaveProperty('error');
        expect(response.error.message).toMatch(/type|validation|invalid/i);
      }
    });

    test('should handle missing required parameters', async () => {
      const missingParamInputs = [
        {}, // All params missing
        { optional: 'value' }, // Required missing
        { required1: 'value' }, // Some required missing
        { unrelated: 'value' } // No valid params
      ];
      
      for (const input of missingParamInputs) {
        const request = {
          jsonrpc: '2.0',
          method: 'tools/call',
          params: {
            name: 'requiresParams',
            arguments: input
          },
          id: Math.random()
        };
        
        const response = await mcpServer.handleRequest(request);
        
        expect(response).toHaveProperty('error');
        expect(response.error.code).toBe(-32602); // Invalid params
      }
    });

    test('should handle extra unexpected parameters', async () => {
      const extraParamInputs = [
        { valid: 'param', extra1: 'unexpected', extra2: 123 },
        { valid: 'param', nested: { deep: { extra: 'data' } } },
        { valid: 'param', ...chaosGenerators.randomJSON() }
      ];
      
      for (const input of extraParamInputs) {
        const request = {
          jsonrpc: '2.0',
          method: 'tools/call',
          params: {
            name: 'strictParams',
            arguments: input
          },
          id: Math.random()
        };
        
        const response = await mcpServer.handleRequest(request);
        
        // Should either ignore extras or return error
        expect(response).toHaveProperty(['result', 'error']);
      }
    });
  });

  describe('Creative Input Combinations', () => {
    test('should handle randomly generated inputs', async () => {
      const errors = [];
      
      for (let i = 0; i < 100; i++) {
        const chaosInput = chaosGenerators.randomJSON();
        const request = {
          jsonrpc: '2.0',
          method: 'tools/call',
          params: {
            name: 'flexibleTool',
            arguments: chaosInput
          },
          id: i
        };
        
        try {
          const response = await mcpServer.handleRequest(request);
          expect(response).toHaveProperty(['result', 'error']);
        } catch (error) {
          errors.push({ input: chaosInput, error: error.message });
        }
      }
      
      // Server should handle at least 95% of random inputs gracefully
      expect(errors.length).toBeLessThan(5);
    });

    test('should handle edge case numeric values', async () => {
      const edgeCaseNumbers = [
        0,
        -0,
        Infinity,
        -Infinity,
        NaN,
        Number.MAX_VALUE,
        Number.MIN_VALUE,
        Number.MAX_SAFE_INTEGER,
        Number.MIN_SAFE_INTEGER,
        1e308,
        -1e308,
        0.1 + 0.2, // Floating point precision
      ];
      
      for (const num of edgeCaseNumbers) {
        const request = {
          jsonrpc: '2.0',
          method: 'tools/call',
          params: {
            name: 'calculateValue',
            arguments: { value: num }
          },
          id: Math.random()
        };
        
        const response = await mcpServer.handleRequest(request);
        
        // Should handle gracefully (either process or return appropriate error)
        expect(response).toBeDefined();
        expect(response).toHaveProperty(['result', 'error']);
      }
    });

    test('should handle special string patterns', async () => {
      const specialStrings = [
        '', // Empty string
        ' ', // Whitespace
        '\\n\\r\\t', // Control characters
        '\${code}', // Template literal
        '<script>alert("xss")</script>', // HTML/XSS attempt
        'Robert"); DROP TABLE Students;--', // SQL injection
        '../../../etc/passwd', // Path traversal
        '\\x00\\x01\\x02', // Null bytes
        '🔥💯🎉', // Emojis
        '你好世界', // Unicode
        'A'.repeat(10000), // Very long string
        '\\\\\\\\\\\\\\\\', // Escaped backslashes
      ];
      
      for (const str of specialStrings) {
        const request = {
          jsonrpc: '2.0',
          method: 'tools/call',
          params: {
            name: 'processText',
            arguments: { text: str }
          },
          id: Math.random()
        };
        
        const response = await mcpServer.handleRequest(request);
        
        expect(response).toBeDefined();
        expect(response).toHaveProperty(['result', 'error']);
      }
    });
  });

  describe('Boundary Testing', () => {
    test('should handle maximum nested depth', async () => {
      // Create deeply nested object
      let deepObject = { value: 'bottom' };
      for (let i = 0; i < 100; i++) {
        deepObject = { nested: deepObject };
      }
      
      const request = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'processNested',
          arguments: deepObject
        },
        id: 1
      };
      
      const response = await mcpServer.handleRequest(request);
      
      // Should either process or reject due to depth
      expect(response).toHaveProperty(['result', 'error']);
    });

    test('should handle circular references', async () => {
      const circular = { name: 'test' };
      circular.self = circular;
      
      let response;
      try {
        // This might throw during serialization
        const request = {
          jsonrpc: '2.0',
          method: 'tools/call',
          params: {
            name: 'processData',
            arguments: circular
          },
          id: 1
        };
        
        response = await mcpServer.handleRequest(request);
      } catch (error) {
        // Serialization error is acceptable
        expect(error.message).toMatch(/circular|converting/i);
        return;
      }
      
      // If it didn't throw, should return error response
      expect(response).toHaveProperty('error');
    });

    test('should handle maximum array sizes', async () => {
      const sizes = [0, 1, 100, 1000, 10000];
      
      for (const size of sizes) {
        const request = {
          jsonrpc: '2.0',
          method: 'tools/call',
          params: {
            name: 'processArray',
            arguments: {
              items: Array(size).fill('item')
            }
          },
          id: Math.random()
        };
        
        const response = await mcpServer.handleRequest(request);
        
        expect(response).toBeDefined();
        // Large arrays might timeout or return error
        if (size > 1000) {
          expect(response).toHaveProperty(['result', 'error']);
        } else {
          expect(response).toHaveProperty('result');
        }
      }
    });
  });

  describe('Protocol Abuse Testing', () => {
    test('should handle rapid-fire requests', async () => {
      const requests = Array(50).fill(null).map((_, i) => ({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'quickTool',
          arguments: { index: i }
        },
        id: i
      }));
      
      // Send all at once
      const responses = await Promise.all(
        requests.map(req => mcpServer.handleRequest(req))
      );
      
      expect(responses).toHaveLength(50);
      expect(responses.every(r => r && (r.result || r.error))).toBe(true);
    });

    test('should handle mixed valid and invalid requests', async () => {
      const mixedRequests = [
        { jsonrpc: '2.0', method: 'tools/list', id: 1 }, // Valid
        { method: 'tools/list', id: 2 }, // Missing jsonrpc
        { jsonrpc: '2.0', method: 'invalid_method', id: 3 }, // Invalid method
        { jsonrpc: '2.0', method: 'tools/call', params: chaosGenerators.malformedInput(), id: 4 }, // Malformed
        { jsonrpc: '2.0', method: 'resources/list', id: 5 }, // Valid
      ];
      
      const responses = [];
      for (const req of mixedRequests) {
        try {
          const response = await mcpServer.handleRequest(req);
          responses.push(response);
        } catch (error) {
          responses.push({ error: { message: error.message } });
        }
      }
      
      expect(responses).toHaveLength(5);
      // Valid requests should succeed
      expect(responses[0]).toHaveProperty('result');
      expect(responses[4]).toHaveProperty('result');
      // Invalid requests should error
      expect(responses[1]).toHaveProperty('error');
      expect(responses[2]).toHaveProperty('error');
      expect(responses[3]).toHaveProperty('error');
    });
  });`;
  }
}