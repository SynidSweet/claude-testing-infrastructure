/**
 * Type definitions for MCP Tool implementations
 *
 * Defines the core interfaces and types for implementing MCP tools
 * in the claude-testing-infrastructure service.
 */

/**
 * Base interface for all MCP tools
 */
export interface MCPTool {
  /** Unique tool name in MCP format */
  readonly name: string;

  /** Human-readable description of what the tool does */
  readonly description: string;

  /** Execute the tool with given parameters */
  execute(params: Record<string, any>): Promise<MCPToolResult>;

  /** Get the JSON schema for tool registration */
  getSchema(): MCPToolSchema;
}

/**
 * Base result interface for all MCP tool executions
 */
export interface MCPToolResult {
  /** Whether the tool execution was successful */
  success: boolean;

  /** Error message if execution failed */
  error?: string;

  /** Additional result data specific to each tool */
  [key: string]: any;
}

/**
 * MCP tool schema for registration
 */
export interface MCPToolSchema {
  /** Tool name */
  name: string;

  /** Tool description */
  description: string;

  /** JSON schema for input parameters */
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
    additionalProperties?: boolean;
  };
}

/**
 * MCP tool execution context
 */
export interface MCPToolContext {
  /** Current project path if applicable */
  projectPath?: string;

  /** User making the request */
  user?: string;

  /** Session ID for tracking */
  sessionId?: string;

  /** Additional context data */
  metadata?: Record<string, any>;
}

/**
 * MCP tool registration interface
 */
export interface MCPToolRegistry {
  /** Register a new tool */
  register(tool: MCPTool): void;

  /** Get tool by name */
  get(name: string): MCPTool | undefined;

  /** List all registered tools */
  list(): MCPTool[];

  /** Check if tool is registered */
  has(name: string): boolean;

  /** Unregister a tool */
  unregister(name: string): boolean;
}

/**
 * MCP server configuration
 */
export interface MCPServerConfig {
  /** Server name */
  name: string;

  /** Server version */
  version: string;

  /** Supported capabilities */
  capabilities: {
    tools?: boolean;
    resources?: boolean;
    prompts?: boolean;
  };

  /** Transport configuration */
  transport: {
    type: 'stdio' | 'http-sse';
    options?: Record<string, any>;
  };
}

/**
 * MCP tool execution options
 */
export interface MCPToolExecutionOptions {
  /** Timeout in milliseconds */
  timeout?: number;

  /** Whether to validate input parameters */
  validateInput?: boolean;

  /** Whether to include debug information */
  debug?: boolean;

  /** Context for the execution */
  context?: MCPToolContext;
}

/**
 * MCP tool validation result
 */
export interface MCPToolValidationResult {
  /** Whether validation passed */
  valid: boolean;

  /** Validation error messages */
  errors: string[];

  /** Validation warnings */
  warnings?: string[];
}

/**
 * Type guard to check if an object is an MCP tool
 */
export function isMCPTool(obj: any): obj is MCPTool {
  return (
    obj &&
    typeof obj.name === 'string' &&
    typeof obj.description === 'string' &&
    typeof obj.execute === 'function' &&
    typeof obj.getSchema === 'function'
  );
}

/**
 * Type guard to check if a result is an MCP tool result
 */
export function isMCPToolResult(obj: any): obj is MCPToolResult {
  return obj && typeof obj.success === 'boolean';
}

/**
 * MCP tool error types
 */
export enum MCPToolErrorType {
  VALIDATION_ERROR = 'validation_error',
  EXECUTION_ERROR = 'execution_error',
  TIMEOUT_ERROR = 'timeout_error',
  CONFIGURATION_ERROR = 'configuration_error',
  PERMISSION_ERROR = 'permission_error',
  RESOURCE_ERROR = 'resource_error',
}

/**
 * MCP tool error class
 */
export class MCPToolError extends Error {
  constructor(
    public readonly type: MCPToolErrorType,
    message: string,
    public readonly details?: any
  ) {
    super(message);
    this.name = 'MCPToolError';
  }
}

/**
 * MCP tool execution metrics
 */
export interface MCPToolMetrics {
  /** Tool name */
  toolName: string;

  /** Execution duration in milliseconds */
  duration: number;

  /** Whether execution succeeded */
  success: boolean;

  /** Error type if failed */
  errorType?: MCPToolErrorType | undefined;

  /** Timestamp of execution */
  timestamp: Date;

  /** Input parameter count */
  inputParameterCount: number;

  /** Result data size (approximate) */
  resultSize?: number;
}

/**
 * MCP tool factory interface
 */
export interface MCPToolFactory {
  /** Create tools based on configuration */
  createTools(config: MCPServerConfig): MCPTool[];

  /** Get available tool types */
  getAvailableTypes(): string[];

  /** Validate tool configuration */
  validateConfig(config: any): MCPToolValidationResult;
}
