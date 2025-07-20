/**
 * Configuration Adapter for FastMCP Server
 * 
 * Bridges between the comprehensive MCPServerConfiguration and the existing
 * FastMCPServerConfig interface, allowing gradual migration while maintaining
 * backward compatibility.
 * 
 * Implements TASK-2025-179: Integration with existing FastMCP server configuration
 */

import { FastMCPServerConfig } from '../fastmcp-server';
import { MCPServerConfiguration } from './MCPServerConfiguration';
import { ConfigurationLoader } from './ConfigurationLoader';
import { logger } from '../../utils/logger';

/**
 * Configuration Adapter class
 */
export class ConfigurationAdapter {
  /**
   * Convert comprehensive MCPServerConfiguration to FastMCPServerConfig
   */
  static toFastMCPConfig(config: MCPServerConfiguration): FastMCPServerConfig {
    return {
      name: config.server.name,
      version: config.server.version as `${number}.${number}.${number}`,
      description: config.server.description,
      
      transport: {
        type: config.transport.type,
        ...(config.transport.port !== undefined && { port: config.transport.port }),
        ...(config.transport.endpoint !== undefined && { endpoint: config.transport.endpoint as `/${string}` }),
      },
      
      healthCheck: {
        enabled: true,
        ...(config.monitoring.metricsPort !== undefined && { port: config.monitoring.metricsPort }),
        endpoints: {
          health: '/health',
          ready: '/ready',
          live: '/live',
        },
      },
      
      debug: config.server.environment === 'development',
      ...(config.transport.timeout !== undefined && { timeout: config.transport.timeout }),
      
      lifecycle: {
        startupTimeout: config.lifecycle.startupTimeoutMs,
        shutdownTimeout: config.lifecycle.shutdownTimeoutMs,
        healthCheckInterval: config.performance.healthCheckIntervalMs,
        maxRetries: config.lifecycle.maxRetries,
        retryDelay: config.lifecycle.retryDelayMs,
      },
      
      errorHandling: {
        enableRecovery: config.errorHandling.enableRecovery,
        logErrors: config.errorHandling.logErrors,
        maxConsecutiveErrors: config.errorHandling.maxConsecutiveErrors,
        errorRecoveryDelay: config.errorHandling.errorRecoveryDelayMs,
      },
    };
  }
  
  /**
   * Convert FastMCPServerConfig to partial MCPServerConfiguration
   */
  static fromFastMCPConfig(config: FastMCPServerConfig): Partial<MCPServerConfiguration> {
    return {
      server: {
        name: config.name,
        version: config.version,
        description: config.description,
        environment: config.debug ? 'development' : 'production',
      },
      
      transport: {
        type: config.transport?.type || 'stdio',
        ...(config.transport?.port !== undefined && { port: config.transport.port }),
        ...(config.transport?.endpoint !== undefined && { endpoint: config.transport.endpoint }),
        ...(config.timeout !== undefined && { timeout: config.timeout }),
      },
      
      ...(config.lifecycle && {
        lifecycle: {
          startupTimeoutMs: config.lifecycle.startupTimeout || 30000,
          shutdownTimeoutMs: config.lifecycle.shutdownTimeout || 15000,
          maxRetries: config.lifecycle.maxRetries || 3,
          retryDelayMs: config.lifecycle.retryDelay || 5000,
        }
      }),
      
      ...(config.errorHandling && {
        errorHandling: {
          enableRecovery: config.errorHandling.enableRecovery ?? true,
          logErrors: config.errorHandling.logErrors ?? true,
          maxConsecutiveErrors: config.errorHandling.maxConsecutiveErrors || 5,
          errorRecoveryDelayMs: config.errorHandling.errorRecoveryDelay || 10000,
        }
      }),
      
      performance: {
        healthCheckIntervalMs: config.lifecycle?.healthCheckInterval || 60000,
        // Other performance settings will use defaults
        maxConcurrentRequests: 50,
        requestTimeoutMs: 30000,
        cacheEnabled: true,
        cacheTtlSeconds: 300,
      },
      
      monitoring: {
        enableMetrics: true,
        ...(config.healthCheck?.port !== undefined && { metricsPort: config.healthCheck.port }),
        enableTracing: false,
        healthCheckPath: config.healthCheck?.endpoints?.health || '/health',
      },
    };
  }
  
  /**
   * Load configuration and return FastMCPServerConfig for existing server
   */
  static loadFastMCPConfig(configPath?: string): FastMCPServerConfig {
    try {
      logger.info('Loading comprehensive configuration and adapting to FastMCP format');
      
      // Load comprehensive configuration
      const comprehensiveConfig = ConfigurationLoader.loadConfiguration(configPath);
      
      // Convert to FastMCP format
      const fastMCPConfig = this.toFastMCPConfig(comprehensiveConfig);
      
      // Store comprehensive config for future use
      this.storeComprehensiveConfig(comprehensiveConfig);
      
      logger.info('Configuration successfully loaded and adapted', {
        serverName: fastMCPConfig.name,
        version: fastMCPConfig.version,
        environment: comprehensiveConfig.server.environment,
        transport: fastMCPConfig.transport?.type || 'stdio',
      });
      
      return fastMCPConfig;
    } catch (error) {
      logger.error('Configuration loading failed, using fallback', { 
        error: error instanceof Error ? error.message : error 
      });
      
      // Return minimal working configuration as fallback
      return this.getFallbackConfig();
    }
  }
  
  /**
   * Get stored comprehensive configuration
   */
  static getComprehensiveConfig(): MCPServerConfiguration | null {
    return this._storedConfig;
  }
  
  /**
   * Store comprehensive configuration for access by tools and features
   */
  private static storeComprehensiveConfig(config: MCPServerConfiguration): void {
    this._storedConfig = config;
  }
  
  private static _storedConfig: MCPServerConfiguration | null = null;
  
  /**
   * Get fallback configuration when loading fails
   */
  private static getFallbackConfig(): FastMCPServerConfig {
    logger.warn('Using fallback configuration due to configuration loading failure');
    
    return {
      name: 'claude-testing-mcp',
      version: '1.0.0',
      description: 'Claude Testing Infrastructure MCP Server (Fallback Configuration)',
      transport: {
        type: 'stdio',
      },
      debug: process.env.NODE_ENV === 'development',
      timeout: 30000,
      lifecycle: {
        startupTimeout: 30000,
        shutdownTimeout: 15000,
        healthCheckInterval: 60000,
        maxRetries: 3,
        retryDelay: 5000,
      },
      errorHandling: {
        enableRecovery: true,
        logErrors: true,
        maxConsecutiveErrors: 5,
        errorRecoveryDelay: 10000,
      },
      healthCheck: {
        enabled: true,
        endpoints: {
          health: '/health',
          ready: '/ready',
          live: '/live',
        },
      },
    };
  }
  
  /**
   * Validate that FastMCPServerConfig can be safely converted
   */
  static validateFastMCPConfig(config: FastMCPServerConfig): boolean {
    try {
      // Convert to comprehensive config and validate
      const partialConfig = this.fromFastMCPConfig(config);
      
      // Fill in defaults for required fields
      const comprehensiveConfig = ConfigurationLoader.loadConfiguration();
      
      // Merge and validate
      const mergedConfig = {
        ...comprehensiveConfig,
        ...partialConfig,
        server: {
          ...comprehensiveConfig.server,
          ...partialConfig.server,
        },
        transport: {
          ...comprehensiveConfig.transport,
          ...partialConfig.transport,
        },
      };
      
      // This will throw if invalid
      const { validateConfiguration } = require('./MCPServerConfiguration');
      validateConfiguration(mergedConfig);
      
      return true;
    } catch (error) {
      logger.error('FastMCP config validation failed', { 
        error: error instanceof Error ? error.message : error 
      });
      return false;
    }
  }
  
  /**
   * Get configuration summary for logging and debugging
   */
  static getConfigurationSummary(config: FastMCPServerConfig): Record<string, any> {
    const comprehensive = this.getComprehensiveConfig();
    
    return {
      // Basic info
      name: config.name,
      version: config.version,
      environment: comprehensive?.server.environment || (config.debug ? 'development' : 'production'),
      
      // Transport
      transport: {
        type: config.transport?.type || 'stdio',
        port: config.transport?.port,
        endpoint: config.transport?.endpoint,
      },
      
      // Performance settings (from comprehensive config if available)
      performance: comprehensive ? {
        maxConcurrentRequests: comprehensive.performance.maxConcurrentRequests,
        requestTimeout: comprehensive.performance.requestTimeoutMs,
        cacheEnabled: comprehensive.performance.cacheEnabled,
      } : {
        timeout: config.timeout,
      },
      
      // Monitoring
      monitoring: {
        healthCheckEnabled: config.healthCheck?.enabled ?? true,
        metricsEnabled: comprehensive?.monitoring.enableMetrics ?? true,
        tracingEnabled: comprehensive?.monitoring.enableTracing ?? false,
      },
      
      // Security
      security: comprehensive ? {
        authEnabled: comprehensive.security.enableAuthentication,
        rateLimitRequests: comprehensive.security.rateLimitRequests,
      } : {
        authEnabled: false,
      },
    };
  }
}