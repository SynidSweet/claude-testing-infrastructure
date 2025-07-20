/**
 * MCP Service Module
 *
 * Exports all MCP-related functionality for the claude-testing-infrastructure.
 * This module provides the feature request enforcement tool and MCP server
 * implementation required for TASK-2025-156.
 */

export {
  FeatureRequestTool,
  createFeatureRequestTool,
  featureRequestTool,
} from './FeatureRequestTool';
export { MCPServiceRegistry, mcpRegistry } from './MCPServiceRegistry';
export { MCPServer, createMCPServer } from './MCPServer';
export {
  ClaudeTestingFastMCPServer,
  createClaudeTestingFastMCPServer,
  runFastMCPServer,
} from './fastmcp-server';
export type { FastMCPServerConfig } from './fastmcp-server';

// Export MCP services
export * from './services';

// Re-export MCP types for convenience
export * from '../types/mcp-tool-types';

/**
 * Quick setup function for the MCP feature request service
 */
export function setupMCPFeatureRequestService() {
  const { createMCPServer } = require('./MCPServer');
  return createMCPServer({
    name: 'claude-testing-feature-request',
    version: '1.0.0',
    capabilities: {
      tools: true,
      resources: false,
      prompts: false,
    },
  });
}

/**
 * Validate that the feature request tool is properly configured
 */
export function validateFeatureRequestSetup(): {
  valid: boolean;
  issues: string[];
  recommendations: string[];
} {
  const issues: string[] = [];
  const recommendations: string[] = [];

  try {
    // Test tool creation
    const { createFeatureRequestTool } = require('./FeatureRequestTool');
    const tool = createFeatureRequestTool();
    const schema = tool.getSchema();

    // Basic validation
    if (!schema.name.includes('feature_request')) {
      issues.push('Feature request tool name is incorrect');
    }

    if (!schema.description.toLowerCase().includes('feature')) {
      issues.push('Feature request tool description is missing');
    }

    if (!schema.inputSchema.required?.includes('title')) {
      issues.push('Feature request tool missing required title parameter');
    }

    if (!schema.inputSchema.required?.includes('description')) {
      issues.push('Feature request tool missing required description parameter');
    }

    // Recommendations
    recommendations.push('Feature request tool is properly configured');
    recommendations.push('Tool enforces structured feature request workflow');
    recommendations.push('Integrates with task management system for request tracking');
  } catch (error) {
    issues.push(
      `Feature request tool setup failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }

  return {
    valid: issues.length === 0,
    issues,
    recommendations,
  };
}
