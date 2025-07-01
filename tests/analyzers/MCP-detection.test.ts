import { ProjectAnalyzer } from '../../src/analyzers/ProjectAnalyzer';
import { fs } from '../../src/utils/common-imports';
import * as path from 'path';
import * as os from 'os';

describe('MCP Server Detection', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-test-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  test('should detect MCP server with @modelcontextprotocol/sdk dependency', async () => {
    const packageJson = {
      name: 'test-mcp-server',
      version: '1.0.0',
      dependencies: {
        '@modelcontextprotocol/sdk': '^1.0.0',
      },
    };

    await fs.writeFile(
      path.join(tempDir, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );

    const analyzer = new ProjectAnalyzer(tempDir);
    const analysis = await analyzer.analyzeProject();

    expect(analysis.frameworks).toContainEqual(
      expect.objectContaining({
        name: 'mcp-server',
        confidence: 0.9,
      })
    );
    expect(analysis.projectType).toBe('mcp-server');
    expect(analysis.mcpCapabilities).toBeDefined();
    expect(analysis.mcpCapabilities?.framework).toBe('official-sdk');
  });

  test('should detect FastMCP server', async () => {
    const packageJson = {
      name: 'test-fastmcp-server',
      version: '1.0.0',
      dependencies: {
        fastmcp: '^2.0.0',
      },
    };

    await fs.writeFile(
      path.join(tempDir, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );

    const analyzer = new ProjectAnalyzer(tempDir);
    const analysis = await analyzer.analyzeProject();

    expect(analysis.frameworks).toContainEqual(
      expect.objectContaining({
        name: 'fastmcp',
        confidence: 0.95,
      })
    );
    expect(analysis.projectType).toBe('mcp-server');
    expect(analysis.mcpCapabilities?.framework).toBe('fastmcp');
  });

  test('should detect MCP capabilities from config file', async () => {
    const packageJson = {
      name: 'test-mcp-server',
      version: '1.0.0',
      dependencies: {
        '@modelcontextprotocol/sdk': '^1.0.0',
      },
    };

    const mcpConfig = {
      tools: [
        {
          name: 'getTodo',
          description: 'Get a todo item by ID',
          inputSchema: {
            type: 'object',
            properties: {
              id: { type: 'string' },
            },
            required: ['id'],
          },
        },
      ],
      resources: [
        {
          name: 'todos',
          uri: 'todo://list',
          mimeType: 'application/json',
        },
      ],
    };

    await fs.writeFile(
      path.join(tempDir, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );
    
    await fs.writeFile(
      path.join(tempDir, 'mcp.json'),
      JSON.stringify(mcpConfig, null, 2)
    );

    const analyzer = new ProjectAnalyzer(tempDir);
    const analysis = await analyzer.analyzeProject();

    expect(analysis.mcpCapabilities?.tools).toHaveLength(1);
    expect(analysis.mcpCapabilities?.tools[0]).toMatchObject({
      name: 'getTodo',
      description: 'Get a todo item by ID',
    });
    expect(analysis.mcpCapabilities?.resources).toHaveLength(1);
    expect(analysis.mcpCapabilities?.resources[0]).toMatchObject({
      name: 'todos',
      uri: 'todo://list',
    });
  });

  test('should detect HTTP+SSE transport for MCP servers with Express', async () => {
    const packageJson = {
      name: 'test-mcp-http-server',
      version: '1.0.0',
      dependencies: {
        '@modelcontextprotocol/sdk': '^1.0.0',
        express: '^4.18.0',
      },
    };

    await fs.writeFile(
      path.join(tempDir, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );

    const analyzer = new ProjectAnalyzer(tempDir);
    const analysis = await analyzer.analyzeProject();

    expect(analysis.mcpCapabilities?.transports).toContain('stdio');
    expect(analysis.mcpCapabilities?.transports).toContain('http-sse');
  });

  test('should not detect MCP for non-MCP projects', async () => {
    const packageJson = {
      name: 'regular-express-app',
      version: '1.0.0',
      dependencies: {
        express: '^4.18.0',
      },
    };

    await fs.writeFile(
      path.join(tempDir, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );

    const analyzer = new ProjectAnalyzer(tempDir);
    const analysis = await analyzer.analyzeProject();

    expect(analysis.frameworks).not.toContainEqual(
      expect.objectContaining({
        name: 'mcp-server',
      })
    );
    expect(analysis.projectType).not.toBe('mcp-server');
    expect(analysis.mcpCapabilities).toBeUndefined();
  });
});