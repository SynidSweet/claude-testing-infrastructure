/**
 * Type definitions for MCP (Model Context Protocol) testing
 */

import { ProjectAnalysis } from '../analyzers/ProjectAnalyzer';

/**
 * Extended project analysis for MCP servers
 */
export interface MCPProjectAnalysis extends ProjectAnalysis {
  projectType: 'mcp-server';
  mcpCapabilities: {
    tools: MCPTool[];
    resources: MCPResource[];
    prompts: MCPPrompt[];
    transports: ('stdio' | 'http-sse')[];
    framework: 'fastmcp' | 'official-sdk' | 'custom';
  };
}

/**
 * MCP Tool definition
 */
export interface MCPTool {
  name: string;
  description?: string;
  inputSchema?: unknown;
}

/**
 * MCP Resource definition
 */
export interface MCPResource {
  name: string;
  uri: string;
  mimeType?: string;
}

/**
 * MCP Prompt definition
 */
export interface MCPPrompt {
  name: string;
  description?: string;
  arguments?: unknown;
}

/**
 * Type guard for MCP project analysis
 */
export function isMCPProjectAnalysis(
  analysis: ProjectAnalysis
): analysis is MCPProjectAnalysis {
  return analysis.projectType === 'mcp-server';
}