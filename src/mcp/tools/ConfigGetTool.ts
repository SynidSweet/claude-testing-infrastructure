/**
 * MCP Config Get Tool
 *
 * Core MCP tool for retrieving project testing configuration.
 * This tool integrates with the existing ConfigurationService to provide
 * configuration access through the MCP protocol.
 *
 * Implements TASK-2025-150: Implement configuration management tools (config_get, config_set)
 *
 * @module mcp/tools/ConfigGetTool
 */

import { logger } from '../../utils/logger';
import {
  ConfigGetSchema,
  type ConfigGetParams,
  type ConfigGetResult,
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
 * Config Get Tool implementation
 */
export class ConfigGetTool {
  public readonly name = 'mcp__claude-testing__config_get';
  public readonly description = 'Get current testing configuration for project';

  private cacheManager: MCPCacheManager;
  private mcpLogger = getMCPLogger();

  constructor() {
    this.cacheManager = MCPCacheManager.getInstance();
  }

  /**
   * Execute the config get tool
   */
  public async execute(params: unknown): Promise<ConfigGetResult | MCPToolError | MCPErrorResponse> {
    // Create logging context
    const context: MCPToolContext = {
      toolName: this.name,
      operation: 'get_config',
      parameters: params as Record<string, unknown>,
      sessionId: this.generateSessionId(),
      traceId: this.generateTraceId()
    };

    // Start logging
    const metrics = this.mcpLogger.logToolStart(context);

    return withCircuitBreaker('config_get', async () => {
      try {
        // Validate input parameters
        const validatedParams = await this.validateParams(params);
        if (!validatedParams.success) {
          const error = {
            code: MCPErrorCode.InvalidInput,
            message: 'Config get validation failed',
            details: { errors: validatedParams.errors },
            suggestion: 'Please provide valid parameters according to the schema',
            documentation: 'See ConfigGetSchema for required parameters',
          } as MCPToolError;
          
          this.mcpLogger.logToolComplete(context, metrics, MCPToolStatus.Failure, error);
          return error;
        }

        const { projectPath, section, includeDefaults } = validatedParams.data;

        logger.info('Getting configuration', {
          projectPath,
          section,
          includeDefaults,
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

        // Check cache for existing results
        const cacheKey = this.generateCacheKey(projectPath, section, includeDefaults);
        const cachedResult = await this.cacheManager.get<ConfigGetResult>(
          cacheKey,
          CacheLayer.MEMORY
        );

        if (cachedResult) {
          logger.debug('Config retrieved from cache', { cacheKey });
          metrics.cacheHit = true;
          this.mcpLogger.logToolComplete(context, metrics, MCPToolStatus.Cached, cachedResult);
          return cachedResult;
        }

        // Load configuration using ConfigurationService
        const configService = new ConfigurationService({
          projectPath,
          includeEnvVars: includeDefaults ?? true,
          includeUserConfig: includeDefaults ?? true,
        });

        const loadResult = await configService.loadConfiguration();

        if (!loadResult.valid || loadResult.errors.length > 0) {
          const error = {
            code: MCPErrorCode.ConfigurationError,
            message: 'Failed to load configuration',
            details: { 
              errors: loadResult.errors,
              warnings: loadResult.warnings 
            },
            suggestion: 'Check your configuration files for syntax errors',
          } as MCPToolError;
          
          this.mcpLogger.logToolComplete(context, metrics, MCPToolStatus.Failure, error);
          return error;
        }

        const config = loadResult.config;

        // Extract section if specified
        const configValue = section 
          ? this.getConfigSection(config, section)
          : config;

        if (section && configValue === undefined) {
          const error = {
            code: MCPErrorCode.InvalidInput,
            message: 'Configuration section not found',
            details: { section },
            suggestion: 'Check available configuration sections',
          } as MCPToolError;
          
          this.mcpLogger.logToolComplete(context, metrics, MCPToolStatus.Failure, error);
          return error;
        }

        // Get configuration file metadata
        const configPath = path.join(projectPath, '.claude-testing.config.json');
        const metadata = await this.getConfigMetadata(configPath);

        // Prepare result
        const result: ConfigGetResult = {
          configuration: configValue,
          source: metadata.exists ? 'project' : 'defaults',
          validation: {
            valid: loadResult.valid,
            errors: loadResult.errors,
            warnings: loadResult.warnings,
          },
          metadata: {
            path: metadata.exists ? configPath : undefined,
            exists: metadata.exists,
            lastModified: metadata.lastModified,
          },
        };

        // Cache result for 5 minutes
        await this.cacheManager.set(
          cacheKey,
          result,
          CacheLayer.MEMORY,
          { ttl: 300000 } // 5 minutes
        );

        logger.info('Configuration retrieved successfully', {
          source: result.source,
          hasSection: !!section,
          errors: result.validation.errors.length,
          warnings: result.validation.warnings.length,
        });

        this.mcpLogger.logToolComplete(context, metrics, MCPToolStatus.Success, result);
        return result;

      } catch (error) {
        return handleMCPError(error, 'config_get');
      }
    });
  }

  /**
   * Validate input parameters
   */
  private async validateParams(params: unknown): Promise<{
    success: boolean;
    data?: ConfigGetParams;
    errors?: string[];
  }> {
    try {
      const result = ConfigGetSchema.safeParse(params);
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
   * Get a specific section from the configuration
   */
  private getConfigSection(config: ClaudeTestingConfig, section: string): unknown {
    const parts = section.split('.');
    let current: any = config;

    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        return undefined;
      }
    }

    return current;
  }

  /**
   * Get configuration file metadata
   */
  private async getConfigMetadata(configPath: string): Promise<{
    exists: boolean;
    lastModified?: Date;
  }> {
    try {
      const stats = await fs.promises.stat(configPath);
      return {
        exists: true,
        lastModified: stats.mtime,
      };
    } catch {
      return {
        exists: false,
      };
    }
  }

  /**
   * Generate cache key for configuration
   */
  private generateCacheKey(
    projectPath: string,
    section?: string,
    includeDefaults?: boolean
  ): string {
    const normalizedPath = path.resolve(projectPath);
    const parts = [
      'config_get',
      normalizedPath,
      section || 'full',
      includeDefaults ? 'defaults' : 'no-defaults',
    ];
    return parts.join(':');
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
export function createConfigGetTool(): ConfigGetTool {
  return new ConfigGetTool();
}