/**
 * MCP Server Implementation
 *
 * Basic MCP server implementation for the claude-testing-infrastructure
 * that provides the feature request enforcement tool and other MCP tools.
 */

import { EventEmitter } from 'events';
import type { MCPTool, MCPServerConfig, MCPToolExecutionOptions } from '../types/mcp-tool-types';
import { MCPServiceRegistry } from './MCPServiceRegistry';
import { FeatureRequestTool } from './FeatureRequestTool';
import { logger } from '../utils/logger';

/**
 * JSON-RPC 2.0 message interfaces
 */
interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: string | number | null;
  method: string;
  params?: any;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

/**
 * MCP Server implementation
 */
export class MCPServer extends EventEmitter {
  private registry: MCPServiceRegistry;
  private config: MCPServerConfig;
  private initialized = false;
  private sessionData = new Map<string, any>();

  constructor(config: MCPServerConfig) {
    super();
    this.config = config;
    this.registry = new MCPServiceRegistry();
    this.setupDefaultTools();
  }

  /**
   * Set up default MCP tools
   */
  private setupDefaultTools(): void {
    // Register the feature request enforcement tool
    const featureRequestTool = new FeatureRequestTool();
    this.registry.register(featureRequestTool);

    logger.info('MCP Server: Default tools registered');
  }

  /**
   * Initialize the MCP server
   */
  public async initialize(_clientInfo?: any): Promise<any> {
    if (this.initialized) {
      throw new Error('MCP Server already initialized');
    }

    this.initialized = true;

    logger.info('MCP Server initialized', {
      server: this.config.name,
      version: this.config.version,
      tools: this.registry.list().length,
    });

    return {
      protocolVersion: '2024-11-05',
      capabilities: this.config.capabilities,
      serverInfo: {
        name: this.config.name,
        version: this.config.version,
      },
      instructions:
        'Claude Testing Infrastructure MCP Service - Use mcp__claude-testing__feature_request for all feature requests',
    };
  }

  /**
   * Handle JSON-RPC 2.0 messages
   */
  public async handleMessage(message: JsonRpcRequest): Promise<JsonRpcResponse> {
    try {
      if (!this.initialized && message.method !== 'initialize') {
        return this.createErrorResponse(message.id, -32002, 'Server not initialized');
      }

      switch (message.method) {
        case 'initialize':
          const result = await this.initialize(message.params?.clientInfo);
          return this.createSuccessResponse(message.id, result);

        case 'tools/list':
          return this.createSuccessResponse(message.id, { tools: this.registry.getToolSchemas() });

        case 'tools/call':
          return await this.handleToolCall(message);

        case 'session/set':
          return this.handleSessionSet(message);

        case 'session/get':
          return this.handleSessionGet(message);

        case 'ping':
          return this.createSuccessResponse(message.id, { status: 'pong' });

        case 'health':
          return this.createSuccessResponse(message.id, this.getHealthStatus());

        default:
          return this.createErrorResponse(
            message.id,
            -32601,
            `Method '${message.method}' not found`
          );
      }
    } catch (error) {
      logger.error('MCP Server message handling error', {
        method: message.method,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return this.createErrorResponse(
        message.id,
        -32603,
        'Internal error',
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  /**
   * Handle tool execution calls
   */
  private async handleToolCall(message: JsonRpcRequest): Promise<JsonRpcResponse> {
    const { name, arguments: params = {} } = message.params || {};

    if (!name) {
      return this.createErrorResponse(message.id, -32602, 'Invalid params: tool name is required');
    }

    if (!this.registry.has(name)) {
      return this.createErrorResponse(message.id, -32602, `Tool '${name}' not found`);
    }

    try {
      const options: MCPToolExecutionOptions = {
        timeout: 60000, // 60 second timeout for tools
        validateInput: true,
        debug: false,
      };

      const result = await this.registry.execute(name, params, options);

      return this.createSuccessResponse(message.id, result);
    } catch (error) {
      logger.error(`Tool execution failed: ${name}`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        params,
      });

      return this.createErrorResponse(
        message.id,
        -32603,
        `Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Handle session data setting
   */
  private handleSessionSet(message: JsonRpcRequest): JsonRpcResponse {
    const { key, value } = message.params || {};

    if (!key) {
      return this.createErrorResponse(message.id, -32602, 'Invalid params: key is required');
    }

    this.sessionData.set(key, value);

    return this.createSuccessResponse(message.id, {
      success: true,
      key,
      value,
    });
  }

  /**
   * Handle session data getting
   */
  private handleSessionGet(message: JsonRpcRequest): JsonRpcResponse {
    const { key } = message.params || {};

    if (!key) {
      return this.createErrorResponse(message.id, -32602, 'Invalid params: key is required');
    }

    const value = this.sessionData.get(key);

    return this.createSuccessResponse(message.id, {
      key,
      value,
      exists: this.sessionData.has(key),
    });
  }

  /**
   * Get server health status
   */
  private getHealthStatus() {
    const registryHealth = this.registry.healthCheck();

    return {
      status: 'healthy',
      initialized: this.initialized,
      server: {
        name: this.config.name,
        version: this.config.version,
      },
      registry: registryHealth,
      capabilities: this.config.capabilities,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    };
  }

  /**
   * Create success response
   */
  private createSuccessResponse(id: string | number | null, result: any): JsonRpcResponse {
    return {
      jsonrpc: '2.0',
      id,
      result,
    };
  }

  /**
   * Create error response
   */
  private createErrorResponse(
    id: string | number | null,
    code: number,
    message: string,
    data?: any
  ): JsonRpcResponse {
    return {
      jsonrpc: '2.0',
      id,
      error: {
        code,
        message,
        data,
      },
    };
  }

  /**
   * Register additional tools
   */
  public registerTool(tool: MCPTool): void {
    this.registry.register(tool);
  }

  /**
   * Get tool metrics
   */
  public getToolMetrics(toolName?: string) {
    if (toolName) {
      return this.registry.getMetricsSummary(toolName);
    }

    const allTools = this.registry.list();
    const metrics: Record<string, any> = {};

    for (const tool of allTools) {
      metrics[tool.name] = this.registry.getMetricsSummary(tool.name);
    }

    return metrics;
  }

  /**
   * Shutdown the server
   */
  public async shutdown(): Promise<void> {
    this.initialized = false;
    this.sessionData.clear();
    this.registry.clear();

    logger.info('MCP Server shutdown complete');
  }
}

/**
 * Create a default MCP server instance
 */
export function createMCPServer(config?: Partial<MCPServerConfig>): MCPServer {
  const defaultConfig: MCPServerConfig = {
    name: 'claude-testing-infrastructure',
    version: '2.0.0',
    capabilities: {
      tools: true,
      resources: false,
      prompts: false,
    },
    transport: {
      type: 'stdio',
    },
    ...config,
  };

  return new MCPServer(defaultConfig);
}

/**
 * Export the server class and factory
 */
// MCPServer already exported above
