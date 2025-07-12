import type { MCPProjectAnalysis } from '../../types/mcp-types';

export class MCPTransportTemplate {
  generateTransportTests(
    transport: 'stdio' | 'http-sse',
    analysis: MCPProjectAnalysis
  ): { path: string; content: string } {
    const isTypeScript = analysis.languages.some((l) => l.name === 'typescript');
    const extension = isTypeScript ? 'ts' : 'js';

    return {
      path: `.claude-testing/mcp-transport-${transport}.test.${extension}`,
      content: this.generateTestContent(transport, isTypeScript, analysis),
    };
  }

  private generateTestContent(
    transport: 'stdio' | 'http-sse',
    isTypeScript: boolean,
    _analysis: MCPProjectAnalysis
  ): string {
    const imports = this.generateImports(transport, isTypeScript);
    const setup = this.generateSetup(transport);
    const tests = transport === 'stdio' ? this.generateStdioTests() : this.generateHttpSseTests();

    return `${imports}

${setup}

describe('MCP ${transport.toUpperCase()} Transport Layer', () => {
${tests}
});
`;
  }

  private generateImports(transport: 'stdio' | 'http-sse', isTypeScript: boolean): string {
    const imports = [];

    if (transport === 'stdio') {
      imports.push("import { spawn } from 'child_process';");
      imports.push("import { Readable, Writable } from 'stream';");
    } else {
      imports.push("import axios from 'axios';");
      imports.push("import { EventSource } from 'eventsource';");
    }

    if (isTypeScript) {
      imports.push("import { Transport } from '@modelcontextprotocol/sdk/types';");
    }

    return imports.join('\n');
  }

  private generateSetup(transport: 'stdio' | 'http-sse'): string {
    if (transport === 'stdio') {
      return `
let mcpProcess;
let stdin;
let stdout;

beforeAll(() => {
  // Start MCP server as subprocess
  mcpProcess = spawn('node', ['./mcp-server.js'], {
    stdio: ['pipe', 'pipe', 'inherit']
  });
  
  stdin = mcpProcess.stdin;
  stdout = mcpProcess.stdout;
});

afterAll(() => {
  if (mcpProcess) {
    mcpProcess.kill();
  }
});

function sendMessage(message) {
  return new Promise((resolve, reject) => {
    const messageStr = JSON.stringify(message) + '\\n';
    stdout.once('data', (data) => {
      try {
        const response = JSON.parse(data.toString());
        resolve(response);
      } catch (error) {
        reject(error);
      }
    });
    stdin.write(messageStr);
  });
}`;
    } else {
      return `
let serverUrl;
let eventSource;

beforeAll(async () => {
  // Start HTTP server
  serverUrl = process.env.MCP_SERVER_URL || 'http://localhost:3000';
  
  // Wait for server to be ready
  await waitForServer(serverUrl);
});

afterAll(() => {
  if (eventSource) {
    eventSource.close();
  }
});

async function waitForServer(url, maxAttempts = 10) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      await axios.get(url + '/health');
      return;
    } catch (error) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  throw new Error('Server failed to start');
}

async function sendMessage(message) {
  const response = await axios.post(serverUrl + '/mcp', message, {
    headers: { 'Content-Type': 'application/json' }
  });
  return response.data;
}`;
    }
  }

  private generateStdioTests(): string {
    return `
  describe('STDIO Connection', () => {
    test('should establish STDIO connection', async () => {
      const initMessage = {
        jsonrpc: '2.0',
        method: 'initialize',
        params: { protocolVersion: '2024-11-05' },
        id: 1
      };
      
      const response = await sendMessage(initMessage);
      
      expect(response).toHaveProperty('jsonrpc', '2.0');
      expect(response).toHaveProperty('result');
    });

    test('should handle message boundaries correctly', async () => {
      // Send multiple messages in quick succession
      const messages = [
        { jsonrpc: '2.0', method: 'tools/list', id: 1 },
        { jsonrpc: '2.0', method: 'resources/list', id: 2 },
        { jsonrpc: '2.0', method: 'prompts/list', id: 3 }
      ];
      
      const responses = [];
      for (const msg of messages) {
        const response = await sendMessage(msg);
        responses.push(response);
      }
      
      expect(responses).toHaveLength(3);
      expect(responses.map(r => r.id)).toEqual([1, 2, 3]);
    });

    test('should handle large messages', async () => {
      const largeData = 'x'.repeat(1024 * 1024); // 1MB of data
      const message = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'processBigData',
          arguments: { data: largeData }
        },
        id: 1
      };
      
      const response = await sendMessage(message);
      
      expect(response).toHaveProperty('result');
    });

    test('should handle binary data in base64', async () => {
      const binaryData = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]).toString('base64');
      const message = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'processBinary',
          arguments: { 
            data: binaryData,
            encoding: 'base64'
          }
        },
        id: 1
      };
      
      const response = await sendMessage(message);
      
      expect(response).toHaveProperty('result');
      expect(response.result).toHaveProperty('content');
    });
  });

  describe('STDIO Error Handling', () => {
    test('should handle malformed JSON gracefully', async () => {
      stdin.write('not valid json\\n');
      
      const response = await new Promise((resolve) => {
        stdout.once('data', (data) => {
          resolve(JSON.parse(data.toString()));
        });
      });
      
      expect(response).toHaveProperty('error');
      expect(response.error.code).toBe(-32700); // Parse error
    });

    test('should handle process crashes', async () => {
      // Send a message that causes crash
      const crashMessage = {
        jsonrpc: '2.0',
        method: 'debug/crash',
        id: 1
      };
      
      let processExited = false;
      mcpProcess.on('exit', () => {
        processExited = true;
      });
      
      try {
        await sendMessage(crashMessage);
      } catch (error) {
        expect(processExited).toBe(true);
      }
    });
  });

  describe('STDIO Stream Management', () => {
    test('should handle backpressure', async () => {
      const messages = [];
      for (let i = 0; i < 1000; i++) {
        messages.push({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: { name: 'echo', arguments: { value: i } },
          id: i
        });
      }
      
      const responses = [];
      for (const msg of messages) {
        if (!stdin.write(JSON.stringify(msg) + '\\n')) {
          // Wait for drain event
          await new Promise(resolve => stdin.once('drain', resolve));
        }
      }
      
      // Collect responses
      await new Promise(resolve => {
        stdout.on('data', (data) => {
          const lines = data.toString().split('\\n').filter(l => l);
          lines.forEach(line => {
            try {
              responses.push(JSON.parse(line));
            } catch (e) {}
          });
          if (responses.length >= messages.length) {
            resolve();
          }
        });
      });
      
      expect(responses).toHaveLength(messages.length);
    });
  });`;
  }

  private generateHttpSseTests(): string {
    return `
  describe('HTTP+SSE Connection', () => {
    test('should establish HTTP connection', async () => {
      const response = await axios.get(serverUrl + '/health');
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('status', 'healthy');
    });

    test('should handle JSON-RPC over HTTP POST', async () => {
      const message = {
        jsonrpc: '2.0',
        method: 'initialize',
        params: { protocolVersion: '2024-11-05' },
        id: 1
      };
      
      const response = await sendMessage(message);
      
      expect(response).toHaveProperty('jsonrpc', '2.0');
      expect(response).toHaveProperty('result');
    });

    test('should establish SSE connection for notifications', async () => {
      return new Promise((resolve, reject) => {
        eventSource = new EventSource(serverUrl + '/mcp/events');
        
        eventSource.onopen = () => {
          expect(eventSource.readyState).toBe(EventSource.OPEN);
          resolve();
        };
        
        eventSource.onerror = (error) => {
          reject(error);
        };
        
        // Timeout after 5 seconds
        setTimeout(() => reject(new Error('SSE connection timeout')), 5000);
      });
    });

    test('should receive server-sent events', async () => {
      return new Promise((resolve) => {
        const events = [];
        eventSource = new EventSource(serverUrl + '/mcp/events');
        
        eventSource.onmessage = (event) => {
          events.push(JSON.parse(event.data));
          if (events.length >= 3) {
            eventSource.close();
            expect(events).toHaveLength(3);
            resolve();
          }
        };
        
        // Trigger some events
        sendMessage({
          jsonrpc: '2.0',
          method: 'debug/triggerEvents',
          params: { count: 3 },
          id: 1
        });
      });
    });
  });

  describe('HTTP+SSE Error Handling', () => {
    test('should handle connection failures', async () => {
      try {
        await axios.post('http://localhost:9999/mcp', {
          jsonrpc: '2.0',
          method: 'test',
          id: 1
        });
        fail('Should have thrown connection error');
      } catch (error) {
        expect(error.code).toMatch(/ECONNREFUSED|ENOTFOUND/);
      }
    });

    test('should handle HTTP errors', async () => {
      try {
        await axios.post(serverUrl + '/invalid-endpoint', {
          jsonrpc: '2.0',
          method: 'test',
          id: 1
        });
      } catch (error) {
        expect(error.response.status).toBe(404);
      }
    });

    test('should reconnect SSE on connection loss', async () => {
      let reconnectCount = 0;
      eventSource = new EventSource(serverUrl + '/mcp/events');
      
      eventSource.onopen = () => {
        reconnectCount++;
        if (reconnectCount === 1) {
          // Simulate connection loss
          eventSource.close();
          // Reconnect
          eventSource = new EventSource(serverUrl + '/mcp/events');
        }
      };
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      expect(reconnectCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe('HTTP+SSE Performance', () => {
    test('should handle concurrent HTTP requests', async () => {
      const requests = [];
      for (let i = 0; i < 100; i++) {
        requests.push(sendMessage({
          jsonrpc: '2.0',
          method: 'tools/list',
          id: i
        }));
      }
      
      const responses = await Promise.all(requests);
      
      expect(responses).toHaveLength(100);
      expect(responses.every(r => r.jsonrpc === '2.0')).toBe(true);
    });

    test('should maintain low latency', async () => {
      const start = Date.now();
      
      await sendMessage({
        jsonrpc: '2.0',
        method: 'ping',
        id: 1
      });
      
      const latency = Date.now() - start;
      expect(latency).toBeLessThan(100); // Less than 100ms
    });
  });`;
  }
}
