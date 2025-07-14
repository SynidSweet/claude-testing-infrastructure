import { ProjectAnalyzer } from '../../src/analyzers/ProjectAnalyzer';
import { getSharedFixture, createTemporaryProject, cleanupTemporaryProject, setupFixtureLifecycle, FIXTURE_TEMPLATES } from '../fixtures/shared';
import { fs, path } from '../../src/utils/common-imports';

describe('MCP Server Detection', () => {
  setupFixtureLifecycle();

  test('should detect MCP server with @modelcontextprotocol/sdk dependency', async () => {
    const fixture = await getSharedFixture(FIXTURE_TEMPLATES.MCP_SERVER);

    const analyzer = new ProjectAnalyzer(fixture.path);
    const analysis = await analyzer.analyzeProject();

    const mcpFramework = analysis.frameworks.find(f => f.name === 'mcp-server');
    expect(mcpFramework).toBeDefined();
    expect(mcpFramework?.confidence).toBeGreaterThanOrEqual(0.7);
    expect(mcpFramework?.confidence).toBeLessThanOrEqual(0.95);
    expect(analysis.projectType).toBe('mcp-server');
    expect(analysis.mcpCapabilities).toBeDefined();
    expect(analysis.mcpCapabilities?.framework).toBe('official-sdk');
  });

  test('should detect FastMCP server', async () => {
    const tempDir = await createTemporaryProject(FIXTURE_TEMPLATES.EMPTY);
    
    try {
      // FastMCP is a Python package, so create requirements.txt
      const requirementsContent = 'fastmcp==2.0.0\nuvicorn>=0.15.0\n';

      await fs.writeFile(
        path.join(tempDir, 'requirements.txt'),
        requirementsContent
      );

      const analyzer = new ProjectAnalyzer(tempDir);
      const analysis = await analyzer.analyzeProject();

      const fastmcpFramework = analysis.frameworks.find(f => f.name === 'fastmcp');
      expect(fastmcpFramework).toBeDefined();
      expect(fastmcpFramework?.confidence).toBeGreaterThanOrEqual(0.7);
      expect(fastmcpFramework?.confidence).toBeLessThanOrEqual(0.95);
      expect(analysis.projectType).toBe('mcp-server');
      expect(analysis.mcpCapabilities?.framework).toBe('fastmcp');
    } finally {
      await cleanupTemporaryProject(tempDir);
    }
  });

  test('should detect MCP capabilities from config file', async () => {
    const tempDir = await createTemporaryProject(FIXTURE_TEMPLATES.EMPTY);
    
    try {
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
    } finally {
      await cleanupTemporaryProject(tempDir);
    }
  });

  test('should detect HTTP+SSE transport for MCP servers with Express', async () => {
    const tempDir = await createTemporaryProject(FIXTURE_TEMPLATES.EMPTY);
    
    try {
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
    } finally {
      await cleanupTemporaryProject(tempDir);
    }
  });

  test('should not detect MCP for non-MCP projects', async () => {
    const tempDir = await createTemporaryProject(FIXTURE_TEMPLATES.EMPTY);
    
    try {
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
    } finally {
      await cleanupTemporaryProject(tempDir);
    }
  });
});