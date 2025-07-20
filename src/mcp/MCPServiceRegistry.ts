/**
 * MCP Service Registry
 *
 * Central registry for managing MCP tools in the claude-testing-infrastructure service.
 * Provides tool registration, discovery, and execution management.
 */

import type {
  MCPTool,
  MCPToolRegistry,
  MCPToolResult,
  MCPToolExecutionOptions,
  MCPToolMetrics,
} from '../types/mcp-tool-types';
import { MCPToolError, MCPToolErrorType } from '../types/mcp-tool-types';
import { logger } from '../utils/logger';

/**
 * Implementation of the MCP tool registry
 */
export class MCPServiceRegistry implements MCPToolRegistry {
  private tools = new Map<string, MCPTool>();
  private metrics = new Map<string, MCPToolMetrics[]>();

  /**
   * Register a new MCP tool
   */
  public register(tool: MCPTool): void {
    if (this.tools.has(tool.name)) {
      logger.warn(`MCP tool '${tool.name}' is already registered, replacing existing registration`);
    }

    this.tools.set(tool.name, tool);
    this.metrics.set(tool.name, []);

    logger.info(`MCP tool registered: ${tool.name}`);
    logger.debug(`Tool description: ${tool.description}`);
  }

  /**
   * Get tool by name
   */
  public get(name: string): MCPTool | undefined {
    return this.tools.get(name);
  }

  /**
   * List all registered tools
   */
  public list(): MCPTool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Check if tool is registered
   */
  public has(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Unregister a tool
   */
  public unregister(name: string): boolean {
    const removed = this.tools.delete(name);
    if (removed) {
      this.metrics.delete(name);
      logger.info(`MCP tool unregistered: ${name}`);
    }
    return removed;
  }

  /**
   * Execute a tool with parameters
   */
  public async execute(
    toolName: string,
    params: Record<string, any>,
    options: MCPToolExecutionOptions = {}
  ): Promise<MCPToolResult> {
    const startTime = Date.now();
    let success = false;
    let errorType: MCPToolErrorType | undefined;

    try {
      // Get the tool
      const tool = this.get(toolName);
      if (!tool) {
        throw new MCPToolError(
          MCPToolErrorType.CONFIGURATION_ERROR,
          `Tool '${toolName}' is not registered`
        );
      }

      // Validate input if requested
      if (options.validateInput !== false) {
        const schema = tool.getSchema();
        this.validateParameters(params, schema, toolName);
      }

      // Set up timeout if specified
      const timeout = options.timeout || 30000; // 30 second default
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(
            new MCPToolError(
              MCPToolErrorType.TIMEOUT_ERROR,
              `Tool '${toolName}' timed out after ${timeout}ms`
            )
          );
        }, timeout);
      });

      // Execute the tool
      logger.debug(`Executing MCP tool: ${toolName}`, { params, options });
      const result = await Promise.race([tool.execute(params), timeoutPromise]);

      success = result.success;
      logger.info(`MCP tool execution completed: ${toolName}`, {
        success,
        duration: Date.now() - startTime,
      });

      return result;
    } catch (error) {
      if (error instanceof MCPToolError) {
        errorType = error.type;
        logger.error(`MCP tool execution failed: ${toolName}`, {
          error: error.message,
          type: error.type,
          details: error.details,
        });
      } else {
        errorType = MCPToolErrorType.EXECUTION_ERROR;
        logger.error(`MCP tool execution failed with unexpected error: ${toolName}`, {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    } finally {
      // Record metrics
      this.recordMetrics({
        toolName,
        duration: Date.now() - startTime,
        success,
        errorType,
        timestamp: new Date(),
        inputParameterCount: Object.keys(params).length,
      });
    }
  }

  /**
   * Validate tool parameters against schema
   */
  private validateParameters(params: Record<string, any>, schema: any, toolName: string): void {
    const { inputSchema } = schema;

    if (!inputSchema || inputSchema.type !== 'object') {
      return; // No validation needed
    }

    const errors: string[] = [];

    // Check required parameters
    if (inputSchema.required) {
      for (const required of inputSchema.required) {
        if (!(required in params)) {
          errors.push(`Missing required parameter: ${required}`);
        }
      }
    }

    // Basic type validation for provided parameters
    if (inputSchema.properties) {
      for (const [key, value] of Object.entries(params)) {
        const propSchema = inputSchema.properties[key];
        if (propSchema && typeof propSchema === 'object') {
          const propType = propSchema.type;
          const actualType = typeof value;

          // Basic type checking
          if (propType === 'string' && actualType !== 'string') {
            errors.push(`Parameter '${key}' must be a string, got ${actualType}`);
          } else if (propType === 'number' && actualType !== 'number') {
            errors.push(`Parameter '${key}' must be a number, got ${actualType}`);
          } else if (propType === 'boolean' && actualType !== 'boolean') {
            errors.push(`Parameter '${key}' must be a boolean, got ${actualType}`);
          }

          // String length validation
          if (propType === 'string' && typeof value === 'string') {
            const minLength = propSchema.minLength;
            const maxLength = propSchema.maxLength;

            if (minLength && value.length < minLength) {
              errors.push(`Parameter '${key}' must be at least ${minLength} characters long`);
            }
            if (maxLength && value.length > maxLength) {
              errors.push(`Parameter '${key}' must be no more than ${maxLength} characters long`);
            }
          }

          // Enum validation
          const enumValues = propSchema.enum;
          if (enumValues && !enumValues.includes(value)) {
            errors.push(`Parameter '${key}' must be one of: ${enumValues.join(', ')}`);
          }
        }
      }
    }

    if (errors.length > 0) {
      throw new MCPToolError(
        MCPToolErrorType.VALIDATION_ERROR,
        `Parameter validation failed for tool '${toolName}': ${errors.join('; ')}`,
        { errors }
      );
    }
  }

  /**
   * Record execution metrics
   */
  private recordMetrics(metrics: MCPToolMetrics): void {
    const toolMetrics = this.metrics.get(metrics.toolName);
    if (toolMetrics) {
      toolMetrics.push(metrics);

      // Keep only last 1000 metrics per tool to prevent memory issues
      if (toolMetrics.length > 1000) {
        toolMetrics.splice(0, toolMetrics.length - 1000);
      }
    }
  }

  /**
   * Get metrics for a tool
   */
  public getMetrics(toolName: string): MCPToolMetrics[] {
    return this.metrics.get(toolName) || [];
  }

  /**
   * Get metrics summary for a tool
   */
  public getMetricsSummary(toolName: string): {
    totalExecutions: number;
    successRate: number;
    averageDuration: number;
    errorTypes: Record<string, number>;
  } {
    const metrics = this.getMetrics(toolName);

    if (metrics.length === 0) {
      return {
        totalExecutions: 0,
        successRate: 0,
        averageDuration: 0,
        errorTypes: {},
      };
    }

    const successful = metrics.filter((m) => m.success).length;
    const totalDuration = metrics.reduce((sum, m) => sum + m.duration, 0);
    const errorTypes: Record<string, number> = {};

    metrics.forEach((m) => {
      if (m.errorType) {
        errorTypes[m.errorType] = (errorTypes[m.errorType] || 0) + 1;
      }
    });

    return {
      totalExecutions: metrics.length,
      successRate: successful / metrics.length,
      averageDuration: totalDuration / metrics.length,
      errorTypes,
    };
  }

  /**
   * Get all tools with their schemas for MCP server registration
   */
  public getToolSchemas(): Array<{ name: string; description: string; inputSchema: any }> {
    return this.list().map((tool) => tool.getSchema());
  }

  /**
   * Health check for the registry
   */
  public healthCheck(): {
    healthy: boolean;
    toolCount: number;
    issues: string[];
  } {
    const issues: string[] = [];
    const toolCount = this.tools.size;

    if (toolCount === 0) {
      issues.push('No tools registered');
    }

    // Check each tool can provide a schema
    for (const tool of this.list()) {
      try {
        const schema = tool.getSchema();
        if (!schema.name || !schema.description) {
          issues.push(`Tool '${tool.name}' has invalid schema`);
        }
      } catch (error) {
        issues.push(
          `Tool '${tool.name}' schema generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }

    return {
      healthy: issues.length === 0,
      toolCount,
      issues,
    };
  }

  /**
   * Clear all tools (for testing)
   */
  public clear(): void {
    this.tools.clear();
    this.metrics.clear();
    logger.info('MCP service registry cleared');
  }
}

/**
 * Global registry instance
 */
export const mcpRegistry = new MCPServiceRegistry();
