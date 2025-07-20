/**
 * Configuration Module Exports
 * 
 * Central exports for the MCP Server configuration system.
 * Implements TASK-2025-179: Configuration schema validation system
 */

export {
  MCPServerConfigurationSchema,
  validateConfiguration,
  defaultConfiguration,
  createDefaultConfiguration,
} from './MCPServerConfiguration';

export type { MCPServerConfiguration } from './MCPServerConfiguration';

export {
  ConfigurationLoader,
} from './ConfigurationLoader';

export {
  ConfigurationAdapter,
} from './ConfigurationAdapter';

// Re-export key types for convenience
export type { MCPServerConfiguration as Config } from './MCPServerConfiguration';