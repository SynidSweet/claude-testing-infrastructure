/**
 * MCP Config Set Tool
 *
 * Core MCP tool for updating project testing configuration.
 * This tool allows agents to modify project-specific settings through
 * the MCP protocol, with validation and backup capabilities.
 *
 * Implements TASK-2025-150: Implement configuration management tools (config_get, config_set)
 *
 * @module mcp/tools/ConfigSetTool
 */

import { logger } from '../../utils/logger';
import {
  ConfigSetSchema,
  type ConfigSetParams,
  type ConfigSetResult,
  type MCPToolError,
  MCPErrorCode,
} from '../tool-interfaces';
import type { MCPErrorResponse } from '../services/MCPErrorHandler';
import { handleMCPError, withCircuitBreaker } from '../services/MCPErrorHandler';
import { MCPCacheManager, CacheLayer } from '../services/MCPCacheManager';
import { getMCPLogger, MCPToolStatus, type MCPToolContext } from '../services/MCPLoggingService';
import { ConfigurationService } from '../../config/ConfigurationService';
import type { ClaudeTestingConfig } from '../../types/config';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Config Set Tool implementation
 */
export class ConfigSetTool {
  public readonly name = 'mcp__claude-testing__config_set';
  public readonly description = 'Update testing configuration for project';

  private cacheManager: MCPCacheManager;
  private mcpLogger = getMCPLogger();

  constructor() {
    this.cacheManager = MCPCacheManager.getInstance();
  }

  /**
   * Execute the config set tool
   */
  public async execute(params: unknown): Promise<ConfigSetResult | MCPToolError | MCPErrorResponse> {
    // Create logging context
    const context: MCPToolContext = {
      toolName: this.name,
      operation: 'set_config',
      parameters: params as Record<string, unknown>,
      sessionId: this.generateSessionId(),
      traceId: this.generateTraceId()
    };

    // Start logging
    const metrics = this.mcpLogger.logToolStart(context);

    return withCircuitBreaker('config_set', async () => {
      try {
        // Validate input parameters
        const validatedParams = await this.validateParams(params);
        if (!validatedParams.success) {
          const error = {
            code: MCPErrorCode.InvalidInput,
            message: 'Config set validation failed',
            details: { errors: validatedParams.errors },
            suggestion: 'Please provide valid parameters according to the schema',
            documentation: 'See ConfigSetSchema for required parameters',
          } as MCPToolError;
          
          this.mcpLogger.logToolComplete(context, metrics, MCPToolStatus.Failure, error);
          return error;
        }

        const { projectPath, updates, merge, validate, backup } = validatedParams.data;

        logger.info('Setting configuration', {
          projectPath,
          updateKeys: Object.keys(updates),
          merge,
          validate,
          backup,
        });

        // Check if project path exists
        if (!fs.existsSync(projectPath)) {
          const error = {
            code: MCPErrorCode.InvalidInput,
            message: 'Project path does not exist',
            details: { path: projectPath },
            suggestion: 'Please provide a valid project directory path',
          } as MCPToolError;
          
          this.mcpLogger.logToolComplete(context, metrics, MCPToolStatus.Failure, error);
          return error;
        }

        const configPath = path.join(projectPath, '.claude-testing.config.json');
        
        // Load existing configuration
        let existingConfig: ClaudeTestingConfig | null = null;
        let backupPath: string | undefined;

        if (fs.existsSync(configPath)) {
          try {
            const configContent = await fs.promises.readFile(configPath, 'utf-8');
            existingConfig = JSON.parse(configContent);

            // Create backup if requested
            if (backup ?? true) {
              backupPath = await this.createBackup(configPath, configContent);
              logger.debug('Created configuration backup', { backupPath });
            }
          } catch (error) {
            const parseError = {
              code: MCPErrorCode.ConfigurationError,
              message: 'Failed to parse existing configuration',
              details: { error: error instanceof Error ? error.message : 'Unknown error' },
              suggestion: 'Check the configuration file for JSON syntax errors',
            } as MCPToolError;
            
            this.mcpLogger.logToolComplete(context, metrics, MCPToolStatus.Failure, parseError);
            return parseError;
          }
        }

        // Apply updates
        let newConfig: ClaudeTestingConfig;
        if (merge ?? true) {
          // Deep merge updates with existing config
          newConfig = this.deepMerge(existingConfig || {}, updates) as ClaudeTestingConfig;
        } else {
          // Replace entire config
          newConfig = updates as ClaudeTestingConfig;
        }

        // Validate configuration if requested
        if (validate ?? true) {
          const validationResult = await this.validateConfiguration(newConfig);
          if (!validationResult.valid) {
            const error = {
              code: MCPErrorCode.ConfigurationError,
              message: 'Configuration validation failed',
              details: {
                errors: validationResult.errors,
                warnings: validationResult.warnings,
              },
              suggestion: 'Fix the validation errors before saving',
            } as MCPToolError;
            
            this.mcpLogger.logToolComplete(context, metrics, MCPToolStatus.Failure, error);
            return error;
          }
        }

        // Write configuration to file
        try {
          const configContent = JSON.stringify(newConfig, null, 2);
          await fs.promises.writeFile(configPath, configContent, 'utf-8');
        } catch (error) {
          const writeError = {
            code: MCPErrorCode.InternalError,
            message: 'Failed to write configuration file',
            details: { error: error instanceof Error ? error.message : 'Unknown error' },
            suggestion: 'Check file permissions and disk space',
          } as MCPToolError;
          
          this.mcpLogger.logToolComplete(context, metrics, MCPToolStatus.Failure, writeError);
          return writeError;
        }

        // Clear cache for this project
        await this.clearConfigCache(projectPath);

        // Prepare result
        const result: ConfigSetResult = {
          success: true,
          changes: this.getChanges(existingConfig, newConfig),
          backup: backupPath ? {
            created: true,
            path: backupPath,
          } : {
            created: false,
          },
          validation: {
            performed: validate ?? true,
            passed: true,
          },
        };

        logger.info('Configuration updated successfully', {
          changes: result.changes,
          backupCreated: result.backup.created,
        });

        this.mcpLogger.logToolComplete(context, metrics, MCPToolStatus.Success, result);
        return result;

      } catch (error) {
        return handleMCPError(error, 'config_set');
      }
    });
  }

  /**
   * Validate input parameters
   */
  private async validateParams(params: unknown): Promise<{
    success: boolean;
    data?: ConfigSetParams;
    errors?: string[];
  }> {
    try {
      const result = ConfigSetSchema.safeParse(params);
      if (result.success) {
        return { success: true, data: result.data };
      }
      
      const errors = result.error.issues.map(issue => 
        `${issue.path.join('.')}: ${issue.message}`
      );
      return { success: false, errors };
    } catch (error) {
      return {
        success: false,
        errors: [`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`],
      };
    }
  }

  /**
   * Create a backup of the configuration file
   */
  private async createBackup(configPath: string, content: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = configPath.replace('.json', `.backup-${timestamp}.json`);
    await fs.promises.writeFile(backupPath, content, 'utf-8');
    return backupPath;
  }

  /**
   * Deep merge two objects
   */
  private deepMerge(target: any, source: any): any {
    const output = { ...target };

    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
          if (key in target && target[key] && typeof target[key] === 'object' && !Array.isArray(target[key])) {
            output[key] = this.deepMerge(target[key], source[key]);
          } else {
            output[key] = source[key];
          }
        } else {
          output[key] = source[key];
        }
      }
    }

    return output;
  }

  /**
   * Validate configuration structure
   */
  private async validateConfiguration(config: ClaudeTestingConfig): Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic structure validation
    if (typeof config !== 'object' || config === null) {
      errors.push('Configuration must be an object');
      return { valid: false, errors, warnings };
    }

    // Validate known sections
    if (config.include && !Array.isArray(config.include)) {
      errors.push('include must be an array of patterns');
    }

    if (config.exclude && !Array.isArray(config.exclude)) {
      errors.push('exclude must be an array of patterns');
    }

    if (config.testFramework && typeof config.testFramework !== 'string') {
      errors.push('testFramework must be a string');
    }

    if (config.coverage) {
      if (typeof config.coverage !== 'object') {
        errors.push('coverage must be an object');
      } else {
        if (config.coverage.threshold && typeof config.coverage.threshold !== 'object') {
          errors.push('coverage.threshold must be an object');
        }
      }
    }

    // Add warnings for deprecated options
    if ('outputDir' in config) {
      warnings.push('outputDir is deprecated, tests are now stored in .claude-testing/');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Get changes between old and new configuration
   */
  private getChanges(oldConfig: any, newConfig: any): Record<string, { old: any; new: any }> {
    const changes: Record<string, { old: any; new: any }> = {};

    const getAllKeys = (obj1: any, obj2: any): string[] => {
      const keys = new Set<string>();
      if (obj1) Object.keys(obj1).forEach(k => keys.add(k));
      if (obj2) Object.keys(obj2).forEach(k => keys.add(k));
      return Array.from(keys);
    };

    const compareObjects = (old: any, current: any, path: string = '') => {
      const keys = getAllKeys(old, current);

      for (const key of keys) {
        const fullPath = path ? `${path}.${key}` : key;
        const oldValue = old?.[key];
        const newValue = current?.[key];

        if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
          if (typeof oldValue === 'object' && typeof newValue === 'object' && 
              !Array.isArray(oldValue) && !Array.isArray(newValue) &&
              oldValue !== null && newValue !== null) {
            // Recurse into objects
            compareObjects(oldValue, newValue, fullPath);
          } else {
            // Record the change
            changes[fullPath] = {
              old: oldValue,
              new: newValue,
            };
          }
        }
      }
    };

    compareObjects(oldConfig, newConfig);
    return changes;
  }

  /**
   * Clear configuration cache for a project
   */
  private async clearConfigCache(projectPath: string): Promise<void> {
    const normalizedPath = path.resolve(projectPath);
    const cachePattern = `config_get:${normalizedPath}:*`;
    
    // Clear all cache entries for this project
    await this.cacheManager.clear(cachePattern);
    logger.debug('Cleared configuration cache', { pattern: cachePattern });
  }

  /**
   * Generate session ID for logging
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  /**
   * Generate trace ID for logging
   */
  private generateTraceId(): string {
    return `trace_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }
}

/**
 * Create and export the tool instance
 */
export function createConfigSetTool(): ConfigSetTool {
  return new ConfigSetTool();
}