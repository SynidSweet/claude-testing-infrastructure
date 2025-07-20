/**
 * FastMCP Server Integration Tests
 * 
 * Tests the integration of tools with the FastMCP server,
 * particularly the Gap Request Tool registration.
 */

import { ClaudeTestingFastMCPServer } from '../../src/mcp/fastmcp-server';
import { MCPTaskIntegrationService } from '../../src/mcp/services/MCPTaskIntegration';

describe('FastMCP Server Integration', () => {
  let server: ClaudeTestingFastMCPServer;

  beforeEach(() => {
    // Create server instance with test configuration
    server = new ClaudeTestingFastMCPServer({
      name: 'test-server',
      version: '1.0.0',
      description: 'Test server for integration tests',
      transport: { type: 'stdio' },
      debug: false,
    });
  });

  afterEach(async () => {
    // Ensure server is stopped after each test
    if (server.getStatus().isRunning) {
      await server.stop();
    }
  });

  describe('Gap Request Tool Registration', () => {
    it('should register Gap Request Tool during server initialization', () => {
      // Get the tool registry
      const registry = server.getToolRegistry();
      
      // Discover tools by name
      const gapRequestTools = registry.discoverTools({
        name: 'mcp__claude-testing__gap_request'
      });

      // Verify the tool is registered
      expect(gapRequestTools).toHaveLength(1);
      expect(gapRequestTools[0].metadata.name).toBe('mcp__claude-testing__gap_request');
      expect(gapRequestTools[0].metadata.category).toBe('Gap Analysis & Requests');
      expect(gapRequestTools[0].metadata.tags).toContain('gap');
      expect(gapRequestTools[0].metadata.tags).toContain('request');
      expect(gapRequestTools[0].metadata.tags).toContain('task-creation');
    });

    it('should have correct metadata for Gap Request Tool', () => {
      const registry = server.getToolRegistry();
      const gapRequestTools = registry.discoverTools({
        name: 'mcp__claude-testing__gap_request'
      });

      expect(gapRequestTools).toHaveLength(1);
      const tool = gapRequestTools[0];

      // Check metadata
      expect(tool.metadata.description).toBe('Request test coverage for specific functionality and create tracking tasks');
      expect(tool.metadata.version).toBe('1.0.0');
      expect(tool.metadata.author).toBe('claude-testing-infrastructure');
      
      // Check performance metadata
      expect(tool.metadata.performance).toBeDefined();
      expect(tool.metadata.performance?.expectedResponseTime).toBe(3000);
      expect(tool.metadata.performance?.complexity).toBe('medium');
      expect(tool.metadata.performance?.resourceUsage).toBe('moderate');

      // Check examples
      expect(tool.metadata.examples).toBeDefined();
      expect(tool.metadata.examples).toHaveLength(2);
    });

    it('should have Gap Request Tool active by default', () => {
      const registry = server.getToolRegistry();
      const gapRequestTools = registry.discoverTools({
        name: 'mcp__claude-testing__gap_request',
        isActive: true
      });

      expect(gapRequestTools).toHaveLength(1);
      expect(gapRequestTools[0].isActive).toBe(true);
    });

    it('should include Gap Request Tool in total tool count', () => {
      const registry = server.getToolRegistry();
      const stats = registry.getUsageStatistics();
      
      // Should have at least 8 tools (7 initial + gap request)
      expect(stats.totalTools).toBeGreaterThanOrEqual(8);
      
      // Verify Gap Request Tool is in the list
      const allTools = registry.discoverTools();
      const toolNames = allTools.map(t => t.metadata.name);
      expect(toolNames).toContain('mcp__claude-testing__gap_request');
    });

    it('should be discoverable by category', () => {
      const registry = server.getToolRegistry();
      const gapAnalysisTools = registry.discoverTools({
        category: 'Gap Analysis & Requests'
      });

      expect(gapAnalysisTools.length).toBeGreaterThanOrEqual(1);
      const gapRequestTool = gapAnalysisTools.find(
        t => t.metadata.name === 'mcp__claude-testing__gap_request'
      );
      expect(gapRequestTool).toBeDefined();
    });

    it('should be discoverable by tags', () => {
      const registry = server.getToolRegistry();
      
      // Search by 'task-creation' tag
      const taskCreationTools = registry.discoverTools({
        tags: ['task-creation']
      });

      const gapRequestTool = taskCreationTools.find(
        t => t.metadata.name === 'mcp__claude-testing__gap_request'
      );
      expect(gapRequestTool).toBeDefined();
    });
  });

  describe('Server Health with Gap Request Tool', () => {
    it('should report healthy status with Gap Request Tool registered', () => {
      const health = server.getDetailedHealth();
      
      expect(health.serverState).toBe('stopped'); // Not started yet
      expect(health.registry.statistics.totalTools).toBeGreaterThanOrEqual(8);
      expect(health.registry.health.status).not.toBe('error');
    });
  });
});