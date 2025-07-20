/**
 * FastMCP Server Foundation
 *
 * Production-ready MCP server using FastMCP framework for the claude-testing-infrastructure.
 * This server provides a modern, standardized MCP implementation with built-in tool registration,
 * error handling, and performance monitoring.
 *
 * Implements TASK-2025-169: Set up FastMCP server foundation
 */

import { FastMCP, type ServerOptions, type Context } from 'fastmcp';
import { logger } from '../utils/logger';
import { z } from 'zod';
import {
  ToolRegistry,
  type ToolMetadata,
  type ToolRegistrationOptions,
  type ToolDiscoveryFilter,
  type ToolHandler,
} from './tool-registry';
import { ConfigurationAdapter } from './config';
import { handleMCPError, withCircuitBreaker } from './services/MCPErrorHandler';
import { MCPCacheManager } from './services/MCPCacheManager';
import http, { type Server as HttpServer, type IncomingMessage, type ServerResponse } from 'http';
import { URL } from 'url';
import { createGapRequestTool } from './tools/GapRequestTool';
import { createProjectAnalyzeTool } from './tools/ProjectAnalyzeTool';
import { createCoverageCheckTool } from './tools/CoverageCheckTool';
import { createTestGenerateTool } from './tools/TestGenerateTool';
import { createTestRunTool } from './tools/TestRunTool';
import { CachePerformanceMonitorTool } from './tools/CachePerformanceMonitorTool';
import { CacheWarmupTool } from './tools/CacheWarmupTool';
import { createConfigGetTool } from './tools/ConfigGetTool';
import { createConfigSetTool } from './tools/ConfigSetTool';
import { TemplateOrchestrator } from '../generators/templates/TemplateOrchestrator';

/**
 * FastMCP Server Configuration
 */
export interface FastMCPServerConfig {
  name: string;
  version: `${number}.${number}.${number}`;
  description: string;
  transport?: {
    type: 'stdio' | 'httpStream';
    port?: number;
    endpoint?: `/${string}`;
  };
  healthCheck?: {
    enabled?: boolean;
    port?: number;
    endpoints?: {
      health?: string;
      ready?: string;
      live?: string;
    };
  };
  debug?: boolean;
  timeout?: number;
  lifecycle?: {
    startupTimeout?: number;
    shutdownTimeout?: number;
    healthCheckInterval?: number;
    maxRetries?: number;
    retryDelay?: number;
  };
  errorHandling?: {
    enableRecovery?: boolean;
    logErrors?: boolean;
    maxConsecutiveErrors?: number;
    errorRecoveryDelay?: number;
  };
}

/**
 * Claude Testing Infrastructure FastMCP Server
 */
export class ClaudeTestingFastMCPServer {
  private server: FastMCP<undefined>;
  private config: FastMCPServerConfig;
  private isRunning = false;
  private startTime?: Date;
  private toolRegistry: ToolRegistry;
  private cacheManager: MCPCacheManager;
  private templateOrchestrator: TemplateOrchestrator;
  private healthCheckInterval?: NodeJS.Timeout | undefined;
  private consecutiveErrors = 0;
  private lastError?: { error: Error; timestamp: Date } | undefined;
  private recoveryAttempts = 0;
  private serverState: 'stopped' | 'starting' | 'running' | 'stopping' | 'error' | 'recovering' =
    'stopped';
  private healthServerInstance?: HttpServer;

  /**
   * Create server from comprehensive configuration files and environment variables
   *
   * @param configPath Optional path to configuration file
   * @returns Configured FastMCP server instance
   */
  static fromConfiguration(configPath?: string): ClaudeTestingFastMCPServer {
    logger.info('Creating FastMCP server from comprehensive configuration', { configPath });

    try {
      // Load comprehensive configuration using the new system
      const fastMCPConfig = ConfigurationAdapter.loadFastMCPConfig(configPath);

      // Create server instance
      const server = new ClaudeTestingFastMCPServer(fastMCPConfig);

      // Log configuration summary
      const summary = ConfigurationAdapter.getConfigurationSummary(fastMCPConfig);
      logger.info('FastMCP server created with comprehensive configuration', summary);

      return server;
    } catch (error) {
      logger.error('Failed to create server from configuration', {
        error: error instanceof Error ? error.message : error,
      });
      throw error;
    }
  }

  constructor(config: FastMCPServerConfig) {
    // Validate configuration using new comprehensive validation
    this.validateConfiguration(config);

    this.config = {
      ...config,
      // Set default lifecycle options
      lifecycle: {
        startupTimeout: 30000,
        shutdownTimeout: 15000,
        healthCheckInterval: 30000,
        maxRetries: 3,
        retryDelay: 5000,
        ...config.lifecycle,
      },
      // Set default error handling options
      errorHandling: {
        enableRecovery: true,
        logErrors: true,
        maxConsecutiveErrors: 5,
        errorRecoveryDelay: 10000,
        ...config.errorHandling,
      },
      // Set default health check options
      healthCheck: {
        enabled: true,
        port: config.transport?.port ? config.transport.port + 1 : 3002,
        endpoints: {
          health: '/health',
          ready: '/ready',
          live: '/live',
        },
        ...config.healthCheck,
      },
    };

    this.toolRegistry = new ToolRegistry();
    this.cacheManager = MCPCacheManager.getInstance();
    this.templateOrchestrator = new TemplateOrchestrator();

    const serverOptions: ServerOptions<undefined> = {
      name: config.name,
      version: config.version,
    };

    this.server = new FastMCP(serverOptions);

    this.setupServerHandlers();
    this.setupHealthCheckServer();
    this.registerInitialTools();
  }

  /**
   * Wrap tool handler with comprehensive error handling using MCPErrorHandler
   */
  private wrapToolHandler<T extends Record<string, any>>(
    toolName: string,
    handler: ToolHandler<T>
  ): ToolHandler<T> {
    return async (params: T, context: Context<undefined>) => {
      try {
        // Execute the original handler with circuit breaker protection
        const result = await withCircuitBreaker(
          `tool:${toolName}`,
          () => handler(params, context),
          // Fallback to basic error response if circuit is open
          async () => {
            const errorResponse = await handleMCPError(
              new Error(`Tool ${toolName} is currently unavailable due to repeated failures`),
              toolName,
              'execute'
            );
            return {
              content: [
                {
                  type: 'text' as const,
                  text: JSON.stringify(errorResponse, null, 2),
                },
              ],
            };
          }
        );

        return result;
      } catch (error) {
        // Handle any errors with standardized error response
        const errorResponse = await handleMCPError(error, toolName, 'execute');

        // Log the error for monitoring
        logger.error(`Tool ${toolName} execution failed`, {
          toolName,
          error: error instanceof Error ? error.message : 'Unknown error',
          params: JSON.stringify(params),
        });

        // Return standardized error response in FastMCP format
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(errorResponse, null, 2),
            },
          ],
        };
      }
    };
  }

  /**
   * Validate server configuration
   */
  private validateConfiguration(config: FastMCPServerConfig): void {
    const errors: string[] = [];

    // Validate required fields
    if (!config.name || config.name.trim().length === 0) {
      errors.push('Server name is required');
    }

    if (!config.version || !/^\d+\.\d+\.\d+$/.test(config.version)) {
      errors.push('Server version must follow semantic versioning (e.g., 1.0.0)');
    }

    if (!config.description || config.description.trim().length === 0) {
      errors.push('Server description is required');
    }

    // Validate transport configuration
    if (config.transport) {
      if (config.transport.type === 'httpStream') {
        if (!config.transport.port) {
          errors.push('Port is required for httpStream transport');
        } else if (config.transport.port < 1024 || config.transport.port > 65535) {
          errors.push('Port must be between 1024 and 65535');
        }
      }
    }

    // Validate timeout values
    if (config.timeout !== undefined && config.timeout < 1000) {
      errors.push('Timeout must be at least 1000ms');
    }

    // Validate lifecycle configuration
    if (config.lifecycle) {
      const lifecycle = config.lifecycle;
      if (lifecycle.startupTimeout !== undefined && lifecycle.startupTimeout < 5000) {
        errors.push('Startup timeout must be at least 5000ms');
      }
      if (lifecycle.shutdownTimeout !== undefined && lifecycle.shutdownTimeout < 1000) {
        errors.push('Shutdown timeout must be at least 1000ms');
      }
      if (lifecycle.healthCheckInterval !== undefined && lifecycle.healthCheckInterval < 10000) {
        errors.push('Health check interval must be at least 10000ms');
      }
      if (lifecycle.maxRetries !== undefined && lifecycle.maxRetries < 0) {
        errors.push('Max retries must be non-negative');
      }
      if (lifecycle.retryDelay !== undefined && lifecycle.retryDelay < 1000) {
        errors.push('Retry delay must be at least 1000ms');
      }
    }

    // Validate error handling configuration
    if (config.errorHandling) {
      const errorHandling = config.errorHandling;
      if (
        errorHandling.maxConsecutiveErrors !== undefined &&
        errorHandling.maxConsecutiveErrors < 1
      ) {
        errors.push('Max consecutive errors must be at least 1');
      }
      if (
        errorHandling.errorRecoveryDelay !== undefined &&
        errorHandling.errorRecoveryDelay < 1000
      ) {
        errors.push('Error recovery delay must be at least 1000ms');
      }
    }

    // Legacy validation - keeping for fallback
    if (errors.length > 0) {
      logger.warn('Legacy validation found issues, attempting comprehensive validation');
    }

    // Use comprehensive validation system
    try {
      const isValid = ConfigurationAdapter.validateFastMCPConfig(config);
      if (!isValid) {
        throw new Error('Comprehensive configuration validation failed');
      }
    } catch (comprehensiveError) {
      // If comprehensive validation fails and we have legacy errors, combine them
      if (errors.length > 0) {
        throw new Error(
          `Configuration validation failed: ${errors.join(', ')}. Additional: ${comprehensiveError instanceof Error ? comprehensiveError.message : comprehensiveError}`
        );
      }
      throw comprehensiveError;
    }

    logger.info('FastMCP Server configuration validated successfully', {
      name: config.name,
      version: config.version,
      transport: config.transport?.type || 'stdio',
      validationSystem: 'comprehensive',
    });
  }

  /**
   * Set up server event handlers and middleware
   */
  private setupServerHandlers(): void {
    // Server lifecycle handlers
    this.server.on('connect', (event) => {
      this.consecutiveErrors = 0; // Reset error count on successful connection
      logger.info('FastMCP Client connected', {
        serverName: this.config.name,
        sessionId: event.session.toString(),
        activeSessions: this.server.sessions.length,
      });
    });

    this.server.on('disconnect', (event) => {
      logger.info('FastMCP Client disconnected', {
        serverName: this.config.name,
        sessionId: event.session.toString(),
        activeSessions: this.server.sessions.length - 1,
      });
    });

    // Note: FastMCP doesn't have a direct 'error' event
    // Error handling will be done through try-catch in operations

    // Set up periodic health checks if configured
    if (
      this.config.lifecycle?.healthCheckInterval &&
      this.config.lifecycle.healthCheckInterval > 0
    ) {
      this.startHealthMonitoring();
    }

    logger.info('FastMCP Server handlers configured', {
      serverName: this.config.name,
      healthCheckInterval: this.config.lifecycle?.healthCheckInterval,
      errorRecoveryEnabled: this.config.errorHandling?.enableRecovery,
    });
  }

  /**
   * Set up health check HTTP endpoints for Kubernetes/Docker health checks
   */
  private setupHealthCheckServer(): void {
    if (!this.config.healthCheck?.enabled) {
      logger.info('Health check endpoints disabled');
      return;
    }

    logger.info('Health check server configured', {
      port: this.config.healthCheck.port,
      endpoints: this.config.healthCheck.endpoints,
      serverName: this.config.name,
    });
  }

  /**
   * Handle /health endpoint - comprehensive health information
   */
  private async handleHealthEndpoint(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const startTime = Date.now();
      const overallStatus = this.determineOverallHealthStatus();
      const serverStatus = this.getStatus();
      const registryHealth = this.toolRegistry.getHealthStatus();
      const cacheHealth = this.cacheManager.getHealthStatus();
      
      // Get template cache specific metrics
      let templateCacheStats = null;
      try {
        templateCacheStats = await this.templateOrchestrator.getTemplateCacheStats();
      } catch (error) {
        logger.warn('Failed to retrieve template cache stats', { error: error instanceof Error ? error.message : String(error) });
      }

      const url = new URL(req.url || '', `http://localhost:${this.config.healthCheck?.port}`);
      const detailed = url.searchParams.get('detailed') === 'true';

      const healthResponse = {
        status: overallStatus,
        server: {
          name: this.config.name,
          version: this.config.version,
          state: serverStatus.serverState,
          uptime: Math.floor(serverStatus.uptime / 1000),
          isRunning: serverStatus.isRunning,
          activeSessions: serverStatus.activeSessions,
        },
        errors: {
          consecutiveErrors: serverStatus.errorStatus.consecutiveErrors,
          lastError: serverStatus.errorStatus.lastError,
          recoveryAttempts: serverStatus.errorStatus.recoveryAttempts,
        },
        toolRegistry: {
          status: registryHealth.status,
          totalTools: this.toolRegistry.getUsageStatistics().totalTools,
          activeTools: this.toolRegistry.getUsageStatistics().activeTools,
          issues: registryHealth.issues,
        },
        cache: {
          status: cacheHealth.status,
          hitRate: Math.round(cacheHealth.overallHitRate * 100) / 100,
          memoryUsage: Math.round((cacheHealth.totalMemoryUsage / 1024 / 1024) * 100) / 100, // MB
          entryCount: cacheHealth.totalEntries,
          layers: Object.keys(cacheHealth.layerStatus).length,
          templateCache: templateCacheStats ? {
            hitRate: Math.round(templateCacheStats.hitRate * 100) / 100,
            memoryUsage: Math.round(templateCacheStats.memoryUsage / 1024 / 1024 * 100) / 100, // MB
            entryCount: templateCacheStats.entryCount,
            layer: templateCacheStats.layer
          } : null,
        },
        healthCheck: {
          responseTime: Date.now() - startTime,
          timestamp: new Date().toISOString(),
        },
      };

      if (detailed) {
        const detailedHealth = this.getDetailedHealth();
        (healthResponse as any).detailed = {
          memory: detailedHealth.performance.memoryUsage,
          environment: {
            nodeVersion: detailedHealth.performance.nodeVersion,
            platform: detailedHealth.performance.platform,
          },
          configuration: {
            transport: this.config.transport,
            lifecycle: this.config.lifecycle,
            healthCheck: this.config.healthCheck,
          },
          registry: detailedHealth.registry,
          cache: {
            ...cacheHealth,
            layerDetails: cacheHealth.layerStatus,
            templateCache: templateCacheStats ? {
              ...templateCacheStats,
              memoryUsageMB: Math.round(templateCacheStats.memoryUsage / 1024 / 1024 * 100) / 100,
              status: templateCacheStats.hitRate > 0.7 ? 'optimal' : 
                      templateCacheStats.hitRate > 0.5 ? 'good' : 
                      templateCacheStats.hitRate > 0.3 ? 'fair' : 'needs_warming',
              performance: {
                cacheEfficiency: templateCacheStats.hitRate,
                memoryEfficiency: templateCacheStats.entryCount > 0 ? 
                  templateCacheStats.memoryUsage / templateCacheStats.entryCount : 0
              }
            } : { status: 'unavailable', reason: 'Failed to retrieve template cache stats' },
          },
        };
      }

      const statusCode =
        overallStatus === 'healthy' ? 200 : overallStatus === 'warning' ? 200 : 503;
      res.writeHead(statusCode, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      });
      res.end(JSON.stringify(healthResponse, null, 2));
    } catch (error) {
      // Use MCPErrorHandler for health endpoint errors
      const errorResponse = await handleMCPError(
        error,
        this.config.name,
        'health_endpoint',
        `health-${Date.now()}`
      );

      logger.error('Health endpoint error with MCP categorization', {
        errorCategory: errorResponse.error.category,
        errorSeverity: errorResponse.error.severity,
        serverName: this.config.name,
        errorCode: errorResponse.error.code,
      });

      res.writeHead(503, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      });
      res.end(
        JSON.stringify(
          {
            status: 'error',
            error: 'Health check failed',
            timestamp: new Date().toISOString(),
          },
          null,
          2
        )
      );
    }
  }

  /**
   * Handle /ready endpoint - readiness probe for Kubernetes
   */
  private async handleReadyEndpoint(_req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const startTime = Date.now();
      const isReady = this.isServerReady();

      const readyResponse = {
        ready: isReady,
        server: this.config.name,
        version: this.config.version,
        state: this.serverState,
        checks: {
          serverRunning: this.isRunning,
          toolRegistryHealthy: this.toolRegistry.getHealthStatus().status !== 'error',
          noConsecutiveErrors: this.consecutiveErrors === 0,
        },
        responseTime: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      };

      const statusCode = isReady ? 200 : 503;
      res.writeHead(statusCode, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      });
      res.end(JSON.stringify(readyResponse, null, 2));
    } catch (error) {
      // Use MCPErrorHandler for ready endpoint errors
      const errorResponse = await handleMCPError(
        error,
        this.config.name,
        'ready_endpoint',
        `ready-${Date.now()}`
      );

      logger.error('Ready endpoint error with MCP categorization', {
        errorCategory: errorResponse.error.category,
        errorSeverity: errorResponse.error.severity,
        serverName: this.config.name,
        errorCode: errorResponse.error.code,
      });

      res.writeHead(503, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      });
      res.end(
        JSON.stringify(
          {
            ready: false,
            error: 'Readiness check failed',
            timestamp: new Date().toISOString(),
          },
          null,
          2
        )
      );
    }
  }

  /**
   * Handle /live endpoint - liveness probe for Kubernetes
   */
  private async handleLiveEndpoint(_req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const startTime = Date.now();
      const isAlive = this.isServerAlive();

      const liveResponse = {
        alive: isAlive,
        server: this.config.name,
        version: this.config.version,
        state: this.serverState,
        uptime: this.startTime ? Math.floor((Date.now() - this.startTime.getTime()) / 1000) : 0,
        checks: {
          notInErrorState: this.serverState !== 'error',
          belowErrorThreshold:
            this.consecutiveErrors < (this.config.errorHandling?.maxConsecutiveErrors || 5),
          processResponsive: true, // If we reach this point, process is responsive
        },
        responseTime: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      };

      const statusCode = isAlive ? 200 : 503;
      res.writeHead(statusCode, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      });
      res.end(JSON.stringify(liveResponse, null, 2));
    } catch (error) {
      // Use MCPErrorHandler for live endpoint errors
      const errorResponse = await handleMCPError(
        error,
        this.config.name,
        'live_endpoint',
        `live-${Date.now()}`
      );

      logger.error('Live endpoint error with MCP categorization', {
        errorCategory: errorResponse.error.category,
        errorSeverity: errorResponse.error.severity,
        serverName: this.config.name,
        errorCode: errorResponse.error.code,
      });

      res.writeHead(503, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      });
      res.end(
        JSON.stringify(
          {
            alive: false,
            error: 'Liveness check failed',
            timestamp: new Date().toISOString(),
          },
          null,
          2
        )
      );
    }
  }

  /**
   * Determine if server is ready to accept requests (for readiness probe)
   */
  private isServerReady(): boolean {
    return (
      this.isRunning &&
      this.serverState === 'running' &&
      this.toolRegistry.getHealthStatus().status !== 'error' &&
      this.consecutiveErrors === 0
    );
  }

  /**
   * Determine if server is alive (for liveness probe)
   */
  private isServerAlive(): boolean {
    return (
      this.serverState !== 'error' &&
      this.consecutiveErrors < (this.config.errorHandling?.maxConsecutiveErrors || 5)
    );
  }

  /**
   * Start the health check HTTP server
   */
  private async startHealthCheckServer(): Promise<void> {
    if (!this.config.healthCheck?.enabled) {
      return;
    }

    const port = this.config.healthCheck.port!;
    const endpoints = this.config.healthCheck.endpoints!;

    // Create HTTP server with request handler
    this.healthServerInstance = http.createServer(
      async (req: IncomingMessage, res: ServerResponse) => {
        const url = new URL(req.url || '', `http://localhost:${port}`);
        const pathname = url.pathname;

        // Handle CORS preflight requests
        if (req.method === 'OPTIONS') {
          res.writeHead(200, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          });
          res.end();
          return;
        }

        // Route requests to appropriate handlers
        if (req.method === 'GET' || req.method === 'HEAD') {
          switch (pathname) {
            case endpoints.health:
              await this.handleHealthEndpoint(req, res);
              break;
            case endpoints.ready:
              await this.handleReadyEndpoint(req, res);
              break;
            case endpoints.live:
              await this.handleLiveEndpoint(req, res);
              break;
            case '/':
              // Default health check endpoint (fallback)
              res.writeHead(200, {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
              });
              res.end(
                JSON.stringify(
                  {
                    service: this.config.name,
                    version: this.config.version,
                    status: 'healthy',
                    endpoints: endpoints,
                    timestamp: new Date().toISOString(),
                  },
                  null,
                  2
                )
              );
              break;
            default:
              res.writeHead(404, {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
              });
              res.end(
                JSON.stringify(
                  {
                    error: 'Not Found',
                    message: `Endpoint ${pathname} not found`,
                    availableEndpoints: endpoints,
                  },
                  null,
                  2
                )
              );
              break;
          }
        } else {
          res.writeHead(405, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            Allow: 'GET, HEAD, OPTIONS',
          });
          res.end(
            JSON.stringify(
              {
                error: 'Method Not Allowed',
                message: `${req.method} method not allowed`,
              },
              null,
              2
            )
          );
        }
      }
    );

    return new Promise((resolve, reject) => {
      this.healthServerInstance!.listen(port, (err?: Error) => {
        if (err) {
          logger.error('Failed to start health check server', {
            port,
            error: err.message,
            serverName: this.config.name,
          });
          reject(err);
        } else {
          logger.info('Health check server started', {
            port,
            endpoints: endpoints,
            serverName: this.config.name,
          });
          resolve();
        }
      });
    });
  }

  /**
   * Stop the health check HTTP server
   */
  private async stopHealthCheckServer(): Promise<void> {
    if (!this.healthServerInstance) {
      return;
    }

    return new Promise((resolve) => {
      this.healthServerInstance!.close(() => {
        logger.info('Health check server stopped', {
          serverName: this.config.name,
        });
        this.healthServerInstance = undefined as any;
        resolve();
      });
    });
  }

  /**
   * Handle server errors with recovery logic
   */
  private async handleServerError(error: any): Promise<void> {
    this.consecutiveErrors++;
    this.lastError = {
      error: error instanceof Error ? error : new Error(String(error)),
      timestamp: new Date(),
    };

    // Use MCPErrorHandler for comprehensive error processing
    const errorResponse = await handleMCPError(
      error,
      this.config.name,
      'server_lifecycle',
      `${this.config.name}-${Date.now()}`
    );

    // Enhanced logging with MCPErrorHandler categorization
    if (this.config.errorHandling?.logErrors) {
      logger.error('FastMCP Server error with MCP categorization', {
        serverName: this.config.name,
        errorCategory: errorResponse.error.category,
        errorSeverity: errorResponse.error.severity,
        consecutiveErrors: this.consecutiveErrors,
        serverState: this.serverState,
        retryable: errorResponse.metadata.retryable,
        errorCode: errorResponse.error.code,
        suggestions: errorResponse.error.suggestions,
      });
    }

    // Check if we've exceeded the maximum consecutive errors
    const maxErrors = this.config.errorHandling?.maxConsecutiveErrors || 5;
    if (this.consecutiveErrors >= maxErrors) {
      this.serverState = 'error';
      logger.error('FastMCP Server exceeded maximum consecutive errors', {
        serverName: this.config.name,
        maxErrors,
        consecutiveErrors: this.consecutiveErrors,
      });

      if (
        this.config.errorHandling?.enableRecovery &&
        this.recoveryAttempts < (this.config.lifecycle?.maxRetries || 3)
      ) {
        await this.attemptRecovery();
      } else {
        logger.error('FastMCP Server recovery disabled or max retries exceeded', {
          serverName: this.config.name,
          recoveryAttempts: this.recoveryAttempts,
          maxRetries: this.config.lifecycle?.maxRetries || 3,
        });
      }
    }
  }

  /**
   * Attempt to recover from server errors
   */
  private async attemptRecovery(): Promise<void> {
    this.serverState = 'recovering';
    this.recoveryAttempts++;

    logger.info('FastMCP Server attempting recovery', {
      serverName: this.config.name,
      attempt: this.recoveryAttempts,
      maxRetries: this.config.lifecycle?.maxRetries || 3,
    });

    try {
      // Wait for recovery delay
      const recoveryDelay = this.config.errorHandling?.errorRecoveryDelay || 10000;
      await new Promise((resolve) => setTimeout(resolve, recoveryDelay));

      // Stop the server if it's running
      if (this.isRunning) {
        await this.stop();
      }

      // Wait a bit before restarting
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Restart the server
      await this.start();

      // Reset error counters on successful recovery
      this.consecutiveErrors = 0;
      this.recoveryAttempts = 0;
      this.serverState = 'running';

      logger.info('FastMCP Server recovery successful', {
        serverName: this.config.name,
      });
    } catch (recoveryError) {
      logger.error('FastMCP Server recovery failed', {
        serverName: this.config.name,
        attempt: this.recoveryAttempts,
        error: recoveryError instanceof Error ? recoveryError.message : 'Unknown error',
      });

      this.serverState = 'error';

      // Try again if we haven't exceeded max retries
      if (this.recoveryAttempts < (this.config.lifecycle?.maxRetries || 3)) {
        setTimeout(() => this.attemptRecovery(), this.config.lifecycle?.retryDelay || 5000);
      }
    }
  }

  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    const interval = this.config.lifecycle?.healthCheckInterval || 30000;
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthCheck();
    }, interval);

    logger.info('FastMCP Server health monitoring started', {
      serverName: this.config.name,
      interval: interval,
    });
  }

  /**
   * Stop health monitoring
   */
  private stopHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined as any;
      logger.info('FastMCP Server health monitoring stopped', {
        serverName: this.config.name,
      });
    }
  }

  /**
   * Perform internal health check
   */
  private async performHealthCheck(): Promise<void> {
    try {
      // Check server state
      if (!this.isRunning) {
        logger.warn('FastMCP Server health check: Server not running', {
          serverName: this.config.name,
          serverState: this.serverState,
        });
        return;
      }

      // Check registry health
      const registryHealth = this.toolRegistry.getHealthStatus();
      if (registryHealth.status === 'error') {
        logger.warn('FastMCP Server health check: Registry has errors', {
          serverName: this.config.name,
          registryIssues: registryHealth.issues,
        });
      }

      // Check session count
      const sessionCount = this.server.sessions.length;

      // Log health status
      logger.debug('FastMCP Server health check passed', {
        serverName: this.config.name,
        uptime: this.startTime ? Math.floor((Date.now() - this.startTime.getTime()) / 1000) : 0,
        activeSessions: sessionCount,
        consecutiveErrors: this.consecutiveErrors,
        registryStatus: registryHealth.status,
        serverState: this.serverState,
      });
    } catch (error) {
      logger.error('FastMCP Server health check failed', {
        serverName: this.config.name,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Treat health check failure as a server error
      await this.handleServerError(error);
    }
  }

  /**
   * Register initial tools for the claude-testing-infrastructure
   */
  private registerInitialTools(): void {
    // Health check tool
    this.registerToolWithRegistry(
      {
        name: 'health_check',
        description: 'Check the health status of the claude-testing MCP server',
        version: '1.0.0',
        category: 'system',
        tags: ['health', 'monitoring', 'diagnostics'],
        author: 'claude-testing-infrastructure',
        performance: {
          expectedResponseTime: 100,
          complexity: 'low',
          resourceUsage: 'light',
        },
        examples: [
          {
            title: 'Basic health check',
            description: 'Get basic server health status',
            input: { detailed: false },
          },
          {
            title: 'Detailed health check',
            description: 'Get comprehensive server health information',
            input: { detailed: true },
          },
        ],
      },
      z.object({
        detailed: z
          .boolean()
          .optional()
          .default(false)
          .describe('Return detailed health information'),
      }),
      async (params: any, _context: Context<undefined>) => {
        this.toolRegistry.recordToolUsage('health_check');

        const serverStatus = this.getStatus();

        const basicHealth = {
          status: this.determineOverallHealthStatus(),
          server: this.config.name,
          version: this.config.version,
          uptime: Math.floor(serverStatus.uptime / 1000),
          timestamp: new Date().toISOString(),
          serverState: serverStatus.serverState,
          consecutiveErrors: serverStatus.errorStatus.consecutiveErrors,
          toolRegistry: {
            status: serverStatus.errorStatus.consecutiveErrors > 0 ? 'warning' : 'healthy',
            totalTools: this.toolRegistry.getUsageStatistics().totalTools,
            activeTools: this.toolRegistry.getUsageStatistics().activeTools,
          },
        };

        if (params.detailed) {
          const detailedHealth = this.getDetailedHealth();
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify(
                  {
                    ...basicHealth,
                    detailed: {
                      ...detailedHealth,
                      environment: {
                        nodeVersion: process.version,
                        platform: process.platform,
                        arch: process.arch,
                      },
                      configuration: {
                        debug: this.config.debug,
                        timeout: this.config.timeout,
                        transport: this.config.transport,
                        lifecycle: this.config.lifecycle,
                        errorHandling: this.config.errorHandling,
                      },
                    },
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(basicHealth, null, 2),
            },
          ],
        };
      }
    );

    // Server information tool
    this.registerToolWithRegistry(
      {
        name: 'server_info',
        description: 'Get comprehensive server information and capabilities',
        version: '1.0.0',
        category: 'system',
        tags: ['info', 'capabilities', 'metadata'],
        author: 'claude-testing-infrastructure',
        performance: {
          expectedResponseTime: 50,
          complexity: 'low',
          resourceUsage: 'light',
        },
        examples: [
          {
            title: 'Get server information',
            description: 'Retrieve complete server information and capabilities',
            input: {},
          },
        ],
      },
      z.object({}),
      async (_params: Record<string, never>, _context: Context<undefined>) => {
        this.toolRegistry.recordToolUsage('server_info');

        const serverInfo = {
          server: {
            name: this.config.name,
            version: this.config.version,
            description: this.config.description,
            framework: 'FastMCP',
            frameworkVersion: '3.9.0',
          },
          capabilities: {
            tools: true,
            resources: false,
            prompts: false,
            logging: true,
            toolRegistry: true,
            toolDiscovery: true,
          },
          infrastructure: {
            type: 'claude-testing-infrastructure',
            purpose: 'AI-powered decoupled testing infrastructure',
            features: [
              'Test generation',
              'Coverage analysis',
              'Gap detection',
              'Framework detection',
              'Multi-language support',
              'Tool registration and discovery',
            ],
          },
          runtime: {
            uptime: this.startTime ? Math.floor((Date.now() - this.startTime.getTime()) / 1000) : 0,
            memoryUsage: process.memoryUsage(),
            nodeVersion: process.version,
            activeSessions: this.server.sessions.length,
          },
          toolRegistry: this.toolRegistry.getUsageStatistics(),
        };

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(serverInfo, null, 2),
            },
          ],
        };
      }
    );

    // Tool discovery tool
    this.registerToolWithRegistry(
      {
        name: 'tool_discovery',
        description: 'Discover and search for available MCP tools',
        version: '1.0.0',
        category: 'registry',
        tags: ['discovery', 'search', 'tools', 'registry'],
        author: 'claude-testing-infrastructure',
        performance: {
          expectedResponseTime: 200,
          complexity: 'low',
          resourceUsage: 'light',
        },
        examples: [
          {
            title: 'List all tools',
            description: 'Get all available tools',
            input: {},
          },
          {
            title: 'Search by category',
            description: 'Find tools in a specific category',
            input: { category: 'system' },
          },
          {
            title: 'Search by tags',
            description: 'Find tools with specific tags',
            input: { tags: ['monitoring', 'health'] },
          },
        ],
      },
      z.object({
        category: z.string().optional().describe('Filter by tool category'),
        tags: z.array(z.string()).optional().describe('Filter by tool tags'),
        name: z.string().optional().describe('Search by tool name (partial match)'),
        isActive: z.boolean().optional().describe('Filter by active status'),
        hasExamples: z.boolean().optional().describe('Filter tools that have examples'),
        complexity: z
          .enum(['low', 'medium', 'high'])
          .optional()
          .describe('Filter by complexity level'),
      }),
      async (params: any, _context: Context<undefined>) => {
        this.toolRegistry.recordToolUsage('tool_discovery');

        const discoveredTools = this.toolRegistry.discoverTools(params);

        const result = {
          totalFound: discoveredTools.length,
          availableCategories: this.toolRegistry.getCategories(),
          availableTags: this.toolRegistry.getTags(),
          tools: discoveredTools.map((tool) => ({
            name: tool.metadata.name,
            description: tool.metadata.description,
            category: tool.metadata.category,
            tags: tool.metadata.tags,
            version: tool.metadata.version,
            isActive: tool.isActive,
            usageCount: tool.usageCount,
            lastUsed: tool.lastUsed?.toISOString(),
            complexity: tool.metadata.performance?.complexity,
            hasExamples: tool.metadata.examples && tool.metadata.examples.length > 0,
            registeredAt: tool.registeredAt.toISOString(),
          })),
        };

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }
    );

    // Tool registry status tool
    this.registerToolWithRegistry(
      {
        name: 'registry_status',
        description: 'Get comprehensive tool registry status and statistics',
        version: '1.0.0',
        category: 'registry',
        tags: ['registry', 'status', 'statistics', 'monitoring'],
        author: 'claude-testing-infrastructure',
        performance: {
          expectedResponseTime: 100,
          complexity: 'low',
          resourceUsage: 'light',
        },
        examples: [
          {
            title: 'Get registry status',
            description: 'Retrieve complete registry status and statistics',
            input: {},
          },
        ],
      },
      z.object({}),
      async (_params: Record<string, never>, _context: Context<undefined>) => {
        this.toolRegistry.recordToolUsage('registry_status');

        const healthStatus = this.toolRegistry.getHealthStatus();
        const usageStats = this.toolRegistry.getUsageStatistics();

        const result = {
          health: healthStatus,
          usage: usageStats,
          categories: this.toolRegistry.getCategories(),
          tags: this.toolRegistry.getTags(),
          timestamp: new Date().toISOString(),
        };

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }
    );

    // Tool registry management tools
    this.registerToolWithRegistry(
      {
        name: 'registry_activate_tool',
        description: 'Activate or deactivate a tool in the registry',
        version: '1.0.0',
        category: 'registry',
        tags: ['registry', 'management', 'activation'],
        author: 'claude-testing-infrastructure',
        performance: {
          expectedResponseTime: 50,
          complexity: 'low',
          resourceUsage: 'light',
        },
        examples: [
          {
            title: 'Activate a tool',
            description: 'Enable a tool in the registry',
            input: { toolName: 'health_check', isActive: true },
          },
          {
            title: 'Deactivate a tool',
            description: 'Disable a tool in the registry',
            input: { toolName: 'health_check', isActive: false },
          },
        ],
      },
      z.object({
        toolName: z.string().describe('Name of the tool to activate/deactivate'),
        isActive: z.boolean().describe('Whether to activate (true) or deactivate (false) the tool'),
      }),
      async (params: any, _context: Context<undefined>) => {
        this.toolRegistry.recordToolUsage('registry_activate_tool');

        try {
          this.toolRegistry.setToolActive(params.toolName, params.isActive);

          const result = {
            success: true,
            toolName: params.toolName,
            isActive: params.isActive,
            message: `Tool '${params.toolName}' ${params.isActive ? 'activated' : 'deactivated'} successfully`,
            timestamp: new Date().toISOString(),
          };

          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        } catch (error) {
          const errorResult = {
            success: false,
            toolName: params.toolName,
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString(),
          };

          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify(errorResult, null, 2),
              },
            ],
          };
        }
      }
    );

    // Tool metadata update tool
    this.registerToolWithRegistry(
      {
        name: 'registry_update_metadata',
        description: 'Update metadata for a tool in the registry',
        version: '1.0.0',
        category: 'registry',
        tags: ['registry', 'management', 'metadata'],
        author: 'claude-testing-infrastructure',
        performance: {
          expectedResponseTime: 100,
          complexity: 'low',
          resourceUsage: 'light',
        },
        examples: [
          {
            title: 'Update tool tags',
            description: 'Add new tags to a tool',
            input: {
              toolName: 'health_check',
              metadata: { tags: ['health', 'monitoring', 'diagnostics', 'system'] },
            },
          },
          {
            title: 'Update tool description',
            description: 'Change tool description',
            input: {
              toolName: 'health_check',
              metadata: { description: 'Enhanced health check with detailed diagnostics' },
            },
          },
        ],
      },
      z.object({
        toolName: z.string().describe('Name of the tool to update'),
        metadata: z
          .object({
            description: z.string().optional(),
            tags: z.array(z.string()).optional(),
            category: z.string().optional(),
            documentation: z.string().optional(),
            performance: z
              .object({
                expectedResponseTime: z.number().optional(),
                complexity: z.enum(['low', 'medium', 'high']).optional(),
                resourceUsage: z.enum(['light', 'moderate', 'heavy']).optional(),
              })
              .optional(),
          })
          .describe('Metadata fields to update'),
      }),
      async (params: any, _context: Context<undefined>) => {
        this.toolRegistry.recordToolUsage('registry_update_metadata');

        try {
          this.toolRegistry.updateToolMetadata(params.toolName, params.metadata);

          const updatedTool = this.toolRegistry.getTool(params.toolName);
          const result = {
            success: true,
            toolName: params.toolName,
            updatedFields: Object.keys(params.metadata),
            currentMetadata: updatedTool?.metadata,
            timestamp: new Date().toISOString(),
          };

          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        } catch (error) {
          const errorResult = {
            success: false,
            toolName: params.toolName,
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString(),
          };

          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify(errorResult, null, 2),
              },
            ],
          };
        }
      }
    );

    // Server lifecycle management tool
    this.registerToolWithRegistry(
      {
        name: 'server_lifecycle',
        description: 'Manage server lifecycle operations (restart, health monitoring control)',
        version: '1.0.0',
        category: 'system',
        tags: ['lifecycle', 'management', 'restart', 'monitoring'],
        author: 'claude-testing-infrastructure',
        performance: {
          expectedResponseTime: 5000,
          complexity: 'medium',
          resourceUsage: 'moderate',
        },
        examples: [
          {
            title: 'Restart server',
            description: 'Gracefully restart the FastMCP server',
            input: { action: 'restart' },
          },
          {
            title: 'Reset error counters',
            description: 'Reset server error counters and recovery attempts',
            input: { action: 'reset_errors' },
          },
          {
            title: 'Toggle health monitoring',
            description: 'Enable or disable health monitoring',
            input: { action: 'toggle_health_monitoring', enabled: true },
          },
        ],
      },
      z.object({
        action: z
          .enum(['restart', 'reset_errors', 'toggle_health_monitoring'])
          .describe('Lifecycle action to perform'),
        enabled: z
          .boolean()
          .optional()
          .describe('For toggle_health_monitoring: enable (true) or disable (false)'),
      }),
      async (params: any, _context: Context<undefined>) => {
        this.toolRegistry.recordToolUsage('server_lifecycle');

        try {
          switch (params.action) {
            case 'restart':
              const wasRunning = this.isRunning;

              if (wasRunning) {
                await this.stop();
                // Wait a moment between stop and start
                await new Promise((resolve) => setTimeout(resolve, 1000));
              }

              await this.start();

              return {
                content: [
                  {
                    type: 'text' as const,
                    text: JSON.stringify(
                      {
                        success: true,
                        action: 'restart',
                        message: 'Server restarted successfully',
                        previousState: wasRunning ? 'running' : 'stopped',
                        currentState: 'running',
                        timestamp: new Date().toISOString(),
                      },
                      null,
                      2
                    ),
                  },
                ],
              };

            case 'reset_errors':
              this.consecutiveErrors = 0;
              this.recoveryAttempts = 0;
              this.lastError = undefined as any;

              if (this.serverState === 'error') {
                this.serverState = this.isRunning ? 'running' : 'stopped';
              }

              return {
                content: [
                  {
                    type: 'text' as const,
                    text: JSON.stringify(
                      {
                        success: true,
                        action: 'reset_errors',
                        message: 'Error counters and recovery attempts reset',
                        serverState: this.serverState,
                        timestamp: new Date().toISOString(),
                      },
                      null,
                      2
                    ),
                  },
                ],
              };

            case 'toggle_health_monitoring':
              if (params.enabled === true) {
                if (!this.healthCheckInterval) {
                  this.startHealthMonitoring();
                }
              } else if (params.enabled === false) {
                this.stopHealthMonitoring();
              }

              return {
                content: [
                  {
                    type: 'text' as const,
                    text: JSON.stringify(
                      {
                        success: true,
                        action: 'toggle_health_monitoring',
                        enabled: !!this.healthCheckInterval,
                        interval: this.config.lifecycle?.healthCheckInterval,
                        message: `Health monitoring ${this.healthCheckInterval ? 'enabled' : 'disabled'}`,
                        timestamp: new Date().toISOString(),
                      },
                      null,
                      2
                    ),
                  },
                ],
              };

            default:
              throw new Error(`Unknown lifecycle action: ${params.action}`);
          }
        } catch (error) {
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify(
                  {
                    success: false,
                    action: params.action,
                    error: error instanceof Error ? error.message : 'Unknown error',
                    timestamp: new Date().toISOString(),
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }
      }
    );

    // Gap Request Tool
    const gapRequestTool = createGapRequestTool();
    const gapRequestMetadata = gapRequestTool.getMetadata();

    this.registerToolWithRegistry(
      {
        name: gapRequestTool.name,
        description: gapRequestTool.description,
        version: '1.0.0',
        category: gapRequestMetadata.category,
        tags: gapRequestMetadata.tags,
        author: 'claude-testing-infrastructure',
        performance: {
          expectedResponseTime: gapRequestMetadata.expectedResponseTime,
          complexity: gapRequestMetadata.complexity,
          resourceUsage: 'moderate',
        },
        examples: [
          {
            title: 'Request test coverage for a component',
            description: 'Create a gap request for missing test coverage',
            input: {
              targetProject: './my-project',
              component: 'src/utils/helper.ts',
              gapType: 'missing_tests',
              priority: 'high',
              description: 'Helper functions lack unit tests, causing reliability concerns',
            },
          },
          {
            title: 'Request integration test coverage',
            description: 'Request integration tests for API endpoints',
            input: {
              targetProject: './api-server',
              component: 'src/routes/users',
              gapType: 'integration_tests',
              priority: 'medium',
              description:
                'User management endpoints need integration tests to verify proper database interactions',
              context: {
                relatedFiles: ['src/models/User.ts', 'src/middleware/auth.ts'],
                currentCoverage: 45,
              },
            },
          },
        ],
      },
      z
        .object({
          targetProject: z
            .string()
            .min(1)
            .describe('Path to the target project needing test coverage'),
          component: z.string().min(1).describe('Specific component or file needing tests'),
          gapType: z
            .enum([
              'missing_tests',
              'low_coverage',
              'edge_cases',
              'integration_tests',
              'performance_tests',
              'security_tests',
              'error_handling',
              'accessibility_tests',
            ])
            .describe('Type of test gap identified'),
          priority: z
            .enum(['low', 'medium', 'high', 'critical'])
            .default('medium')
            .describe('Priority level for addressing this gap'),
          description: z
            .string()
            .min(20)
            .describe('Detailed description of the gap and why it needs to be addressed'),
          context: z
            .object({
              currentCoverage: z
                .number()
                .min(0)
                .max(100)
                .optional()
                .describe('Current test coverage percentage'),
              relatedFiles: z.array(z.string()).optional().describe('List of related files'),
              dependencies: z.array(z.string()).optional().describe('Dependencies to consider'),
              specialRequirements: z.string().optional().describe('Special testing requirements'),
            })
            .optional()
            .describe('Additional context about the gap'),
        })
        .strict(),
      async (params: any, _context: Context<undefined>) => {
        this.toolRegistry.recordToolUsage(gapRequestTool.name);

        const result = await gapRequestTool.execute(params);

        // Format the result for FastMCP response
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }
    );

    // Project Analyze Tool
    const projectAnalyzeTool = createProjectAnalyzeTool();

    this.registerToolWithRegistry(
      {
        name: projectAnalyzeTool.name,
        description: projectAnalyzeTool.description,
        version: '1.0.0',
        category: 'Core Testing',
        tags: ['analysis', 'project', 'components'],
        author: 'claude-testing-infrastructure',
        performance: {
          expectedResponseTime: 10000,
          complexity: 'medium',
          resourceUsage: 'moderate',
        },
        examples: [
          {
            title: 'Analyze project structure',
            description: 'Analyze a project to identify testable components',
            input: {
              projectPath: './my-project',
              deep: true,
            },
          },
          {
            title: 'Analyze with include/exclude patterns',
            description: 'Analyze with custom file patterns',
            input: {
              projectPath: './my-project',
              include: ['src/**/*.ts', 'src/**/*.js'],
              exclude: ['**/*.test.*', '**/*.spec.*'],
              deep: false,
            },
          },
        ],
      },
      z
        .object({
          projectPath: z.string().min(1).describe('Path to the project directory'),
          include: z.array(z.string()).optional().describe('Glob patterns for files to include'),
          exclude: z.array(z.string()).optional().describe('Glob patterns for files to exclude'),
          deep: z
            .boolean()
            .optional()
            .default(true)
            .describe('Perform deep analysis including dependencies'),
        })
        .strict(),
      async (params: any, _context: Context<undefined>) => {
        this.toolRegistry.recordToolUsage(projectAnalyzeTool.name);

        const result = await projectAnalyzeTool.execute(params);

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }
    );

    // Coverage Check Tool
    const coverageCheckTool = createCoverageCheckTool();

    this.registerToolWithRegistry(
      {
        name: coverageCheckTool.name,
        description: coverageCheckTool.description,
        version: '1.0.0',
        category: 'Core Testing',
        tags: ['coverage', 'analysis', 'gaps'],
        author: 'claude-testing-infrastructure',
        performance: {
          expectedResponseTime: 5000,
          complexity: 'low',
          resourceUsage: 'light',
        },
        examples: [
          {
            title: 'Check project coverage',
            description: 'Check test coverage for a project',
            input: {
              projectPath: './my-project',
              format: 'summary',
            },
          },
          {
            title: 'Check coverage with thresholds',
            description: 'Check coverage against specific thresholds',
            input: {
              projectPath: './my-project',
              threshold: {
                lines: 80,
                branches: 70,
                functions: 90,
                statements: 80,
              },
              format: 'detailed',
            },
          },
        ],
      },
      z
        .object({
          projectPath: z.string().min(1).describe('Path to the project directory'),
          threshold: z
            .object({
              lines: z.number().min(0).max(100).optional().default(80),
              branches: z.number().min(0).max(100).optional().default(80),
              functions: z.number().min(0).max(100).optional().default(80),
              statements: z.number().min(0).max(100).optional().default(80),
            })
            .optional(),
          format: z.enum(['summary', 'detailed', 'json']).optional().default('summary'),
        })
        .strict(),
      async (params: any, _context: Context<undefined>) => {
        this.toolRegistry.recordToolUsage(coverageCheckTool.name);

        const result = await coverageCheckTool.execute(params);

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }
    );

    // Test Generate Tool
    const testGenerateTool = createTestGenerateTool();

    this.registerToolWithRegistry(
      {
        name: testGenerateTool.name,
        description: testGenerateTool.description,
        version: '1.0.0',
        category: 'Core Testing',
        tags: ['generation', 'tests', 'ai'],
        author: 'claude-testing-infrastructure',
        performance: {
          expectedResponseTime: 30000,
          complexity: 'high',
          resourceUsage: 'heavy',
        },
        examples: [
          {
            title: 'Generate tests for a component',
            description: 'Generate comprehensive test suite for a specific file',
            input: {
              targetPath: './src/components/Button.tsx',
              strategy: 'both',
              framework: 'jest',
            },
          },
          {
            title: 'Generate structural tests only',
            description: 'Generate only structural tests for rapid scaffolding',
            input: {
              targetPath: './src/utils',
              strategy: 'structural',
              options: {
                mockStrategy: 'auto',
                includeEdgeCases: true,
              },
            },
          },
        ],
      },
      z
        .object({
          targetPath: z.string().min(1).describe('Path to file or directory to generate tests for'),
          strategy: z.enum(['structural', 'logical', 'both']).optional().default('both'),
          framework: z
            .enum(['jest', 'pytest', 'mocha', 'vitest'])
            .optional()
            .describe('Override detected test framework'),
          outputPath: z.string().optional().describe('Custom output path for generated tests'),
          options: z
            .object({
              includeEdgeCases: z.boolean().optional().default(true),
              includeIntegrationTests: z.boolean().optional().default(false),
              mockStrategy: z.enum(['auto', 'manual', 'none']).optional().default('auto'),
              coverageTarget: z.number().min(0).max(100).optional().default(80),
            })
            .optional(),
        })
        .strict(),
      async (params: any, _context: Context<undefined>) => {
        this.toolRegistry.recordToolUsage(testGenerateTool.name);

        const result = await testGenerateTool.execute(params);

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }
    );

    // Test Run Tool
    const testRunTool = createTestRunTool();

    this.registerToolWithRegistry(
      {
        name: testRunTool.name,
        description: testRunTool.description,
        version: '1.0.0',
        category: 'Core Testing',
        tags: ['execution', 'tests', 'coverage'],
        author: 'claude-testing-infrastructure',
        performance: {
          expectedResponseTime: 60000,
          complexity: 'medium',
          resourceUsage: 'moderate',
        },
        examples: [
          {
            title: 'Run all tests with coverage',
            description: 'Execute all tests and collect coverage data',
            input: {
              projectPath: './my-project',
              coverage: true,
            },
          },
          {
            title: 'Run specific test pattern',
            description: 'Run tests matching a specific pattern',
            input: {
              projectPath: './my-project',
              testPattern: '**/*.unit.test.js',
              framework: 'jest',
              watch: false,
              bail: true,
            },
          },
        ],
      },
      z
        .object({
          projectPath: z.string().min(1).describe('Path to the project directory'),
          testPattern: z.string().optional().describe('Glob pattern for test files to run'),
          framework: z
            .enum(['jest', 'pytest', 'mocha', 'vitest'])
            .optional()
            .describe('Override detected test framework'),
          coverage: z.boolean().optional().default(true).describe('Collect coverage data'),
          watch: z.boolean().optional().default(false).describe('Run in watch mode'),
          bail: z.boolean().optional().default(false).describe('Stop on first test failure'),
        })
        .strict(),
      async (params: any, _context: Context<undefined>) => {
        this.toolRegistry.recordToolUsage(testRunTool.name);

        const result = await testRunTool.execute(params);

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }
    );

    // Template Cache Management Tools
    this.registerToolWithRegistry(
      {
        name: 'template_cache_warm',
        description: 'Warm up template cache with commonly used patterns for improved performance',
        version: '1.0.0',
        category: 'Performance',
        tags: ['caching', 'performance', 'templates', 'optimization'],
        author: 'claude-testing-infrastructure',
        performance: {
          expectedResponseTime: 5000,
          complexity: 'medium',
          resourceUsage: 'moderate',
        },
        examples: [
          {
            title: 'Warm common template patterns',
            description: 'Pre-cache frequently used template combinations',
            input: {},
          },
          {
            title: 'Warm project-specific templates',
            description: 'Pre-cache templates for a specific project',
            input: { projectPath: './my-project' },
          },
        ],
      },
      z.object({
        projectPath: z.string().optional().describe('Optional project path for project-specific cache warming'),
        patterns: z.array(z.string()).optional().describe('Specific template patterns to warm'),
      }).strict(),
      async (params: any) => {
        this.toolRegistry.recordToolUsage('template_cache_warm');
        
        return withCircuitBreaker('template_cache_warm', async () => {
          try {
            if (params.projectPath) {
              await this.templateOrchestrator.preCacheTemplatesForProject(params.projectPath);
              return {
                content: [
                  {
                    type: 'text' as const,
                    text: JSON.stringify({
                      success: true,
                      action: 'project_cache_warming',
                      projectPath: params.projectPath,
                      message: 'Project-specific template cache warmed successfully'
                    }, null, 2),
                  },
                ],
              };
            } else {
              await this.templateOrchestrator.warmTemplateCache();
              return {
                content: [
                  {
                    type: 'text' as const,
                    text: JSON.stringify({
                      success: true,
                      action: 'general_cache_warming',
                      message: 'Template cache warmed with common patterns'
                    }, null, 2),
                  },
                ],
              };
            }
          } catch (error) {
            throw new Error(`Template cache warming failed: ${error instanceof Error ? error.message : String(error)}`);
          }
        });
      }
    );

    this.registerToolWithRegistry(
      {
        name: 'template_cache_invalidate',
        description: 'Invalidate template cache for development and testing purposes',
        version: '1.0.0',
        category: 'Development',
        tags: ['caching', 'development', 'templates', 'invalidation'],
        author: 'claude-testing-infrastructure',
        performance: {
          expectedResponseTime: 1000,
          complexity: 'low',
          resourceUsage: 'light',
        },
        examples: [
          {
            title: 'Clear all template cache',
            description: 'Invalidate entire template compilation cache',
            input: {},
          },
        ],
      },
      z.object({}).strict(),
      async (_params: any) => {
        this.toolRegistry.recordToolUsage('template_cache_invalidate');
        
        return withCircuitBreaker('template_cache_invalidate', async () => {
          try {
            await this.templateOrchestrator.invalidateTemplateCache();
            const stats = await this.templateOrchestrator.getTemplateCacheStats();
            
            return {
              content: [
                {
                  type: 'text' as const,
                  text: JSON.stringify({
                    success: true,
                    action: 'cache_invalidation',
                    message: 'Template cache invalidated successfully',
                    stats: {
                      entryCount: stats.entryCount,
                      memoryUsage: Math.round(stats.memoryUsage / 1024 / 1024 * 100) / 100, // MB
                      layer: stats.layer
                    }
                  }, null, 2),
                },
              ],
            };
          } catch (error) {
            throw new Error(`Template cache invalidation failed: ${error instanceof Error ? error.message : String(error)}`);
          }
        });
      }
    );

    this.registerToolWithRegistry(
      {
        name: 'template_cache_stats',
        description: 'Get detailed template cache statistics and performance metrics',
        version: '1.0.0',
        category: 'Monitoring',
        tags: ['caching', 'monitoring', 'templates', 'statistics'],
        author: 'claude-testing-infrastructure',
        performance: {
          expectedResponseTime: 100,
          complexity: 'low',
          resourceUsage: 'light',
        },
        examples: [
          {
            title: 'Get template cache statistics',
            description: 'Retrieve current template cache performance metrics',
            input: {},
          },
        ],
      },
      z.object({}).strict(),
      async (_params: any) => {
        this.toolRegistry.recordToolUsage('template_cache_stats');
        
        return withCircuitBreaker('template_cache_stats', async () => {
          try {
            const stats = await this.templateOrchestrator.getTemplateCacheStats();
            const cacheHealth = this.cacheManager.getHealthStatus();
            
            return {
              content: [
                {
                  type: 'text' as const,
                  text: JSON.stringify({
                    success: true,
                    templateCache: {
                      hitRate: Math.round(stats.hitRate * 100) / 100,
                      memoryUsage: Math.round(stats.memoryUsage / 1024 / 1024 * 100) / 100, // MB
                      entryCount: stats.entryCount,
                      layer: stats.layer,
                      status: stats.hitRate > 0.7 ? 'optimal' : 
                              stats.hitRate > 0.5 ? 'good' : 
                              stats.hitRate > 0.3 ? 'fair' : 'needs_warming',
                      performance: {
                        cacheEfficiency: stats.hitRate,
                        memoryEfficiency: stats.entryCount > 0 ? 
                          stats.memoryUsage / stats.entryCount : 0,
                        averageEntrySize: stats.entryCount > 0 ? 
                          Math.round(stats.memoryUsage / stats.entryCount / 1024 * 100) / 100 : 0 // KB
                      }
                    },
                    overallCache: {
                      status: cacheHealth.status,
                      overallHitRate: Math.round(cacheHealth.overallHitRate * 100) / 100,
                      totalMemoryUsage: Math.round(cacheHealth.totalMemoryUsage / 1024 / 1024 * 100) / 100, // MB
                      totalEntries: cacheHealth.totalEntries
                    }
                  }, null, 2),
                },
              ],
            };
          } catch (error) {
            throw new Error(`Failed to retrieve template cache stats: ${error instanceof Error ? error.message : String(error)}`);
          }
        });
      }
    );

    // Cache Performance Monitor Tool
    const cachePerformanceMonitorTool = new CachePerformanceMonitorTool();
    
    this.registerToolWithRegistry(
      {
        name: cachePerformanceMonitorTool.name,
        description: cachePerformanceMonitorTool.description,
        version: '1.0.0',
        category: 'Performance & Optimization',
        tags: ['cache', 'performance', 'monitoring', 'analytics'],
        author: 'claude-testing-infrastructure',
        performance: {
          expectedResponseTime: 3000,
          complexity: 'medium',
          resourceUsage: 'moderate',
        },
        examples: [
          {
            title: 'Get performance dashboard',
            description: 'Get comprehensive cache performance dashboard',
            input: { action: 'dashboard' },
          },
          {
            title: 'Get specific layer metrics',
            description: 'Get performance metrics for a specific cache layer',
            input: { action: 'metrics', layer: 'project_analysis' },
          },
          {
            title: 'Execute cache warmup',
            description: 'Execute cache warmup with custom configuration',
            input: { 
              action: 'warmup',
              config: { layers: ['project_analysis', 'template_compilation'], batchSize: 3 }
            },
          },
          {
            title: 'Get optimization recommendations',
            description: 'Get cache optimization recommendations',
            input: { action: 'recommendations' },
          },
        ],
      },
      z.object({
        action: z.enum(['dashboard', 'metrics', 'analytics', 'warmup', 'recommendations', 'alerts']),
        layer: z.string().optional(),
        config: z.object({
          layers: z.array(z.string()).optional(),
          batchSize: z.number().optional(),
          enabled: z.boolean().optional()
        }).optional(),
        alertConfig: z.array(z.object({
          metric: z.string(),
          threshold: z.number(),
          condition: z.enum(['above', 'below']),
          severity: z.enum(['warning', 'critical']),
          enabled: z.boolean()
        })).optional()
      }),
      async (params: any, _context: Context<undefined>) => {
        const result = await cachePerformanceMonitorTool.execute(params);
        
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }
    );

    // Cache Warmup Tool
    const cacheWarmupTool = new CacheWarmupTool();
    
    this.registerToolWithRegistry(
      {
        name: cacheWarmupTool.name,
        description: cacheWarmupTool.description,
        version: '1.0.0',
        category: 'Performance & Optimization',
        tags: ['cache', 'warmup', 'optimization', 'preloading'],
        author: 'claude-testing-infrastructure',
        performance: {
          expectedResponseTime: 10000,
          complexity: 'medium',
          resourceUsage: 'moderate',
        },
        examples: [
          {
            title: 'Auto warmup strategy',
            description: 'Execute automatic cache warmup with defaults',
            input: { strategy: 'auto' },
          },
          {
            title: 'Progressive warmup',
            description: 'Execute progressive warmup strategy',
            input: { 
              strategy: 'progressive',
              layers: ['project_analysis', 'template_compilation'],
              config: { batchSize: 3, maxConcurrency: 2 }
            },
          },
          {
            title: 'Custom warmup operations',
            description: 'Execute custom warmup with specific operations',
            input: { 
              strategy: 'custom',
              operations: [
                {
                  layer: 'project_analysis',
                  keys: ['./src', './tests'],
                  priority: 'high',
                  dataType: 'analysis'
                }
              ]
            },
          },
          {
            title: 'Dry run warmup',
            description: 'Simulate warmup without actual execution',
            input: { strategy: 'auto', dryRun: true },
          },
        ],
      },
      z.object({
        strategy: z.enum(['auto', 'custom', 'progressive', 'targeted']).default('auto'),
        layers: z.array(z.string()).optional(),
        operations: z.array(z.object({
          layer: z.string(),
          keys: z.array(z.string()),
          priority: z.enum(['high', 'medium', 'low']).default('medium'),
          dataType: z.enum(['analysis', 'template', 'config', 'coverage', 'dependency']).optional()
        })).optional(),
        config: z.object({
          batchSize: z.number().min(1).max(50).default(5),
          enabled: z.boolean().default(true),
          scheduleInterval: z.number().optional(),
          maxConcurrency: z.number().min(1).max(10).default(3),
          timeout: z.number().min(1000).default(30000)
        }).optional(),
        progressTracking: z.boolean().default(true),
        dryRun: z.boolean().default(false)
      }),
      async (params: any, _context: Context<undefined>) => {
        const result = await cacheWarmupTool.execute(params);
        
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }
    );

    // Config Get Tool
    const configGetTool = createConfigGetTool();

    this.registerToolWithRegistry(
      {
        name: configGetTool.name,
        description: configGetTool.description,
        version: '1.0.0',
        category: 'Configuration Management',
        tags: ['config', 'settings', 'read'],
        author: 'claude-testing-infrastructure',
        performance: {
          expectedResponseTime: 500,
          complexity: 'low',
          resourceUsage: 'light',
        },
        examples: [
          {
            title: 'Get all configuration',
            description: 'Retrieve complete project configuration',
            input: {
              projectPath: './my-project',
              includeDefaults: true,
            },
          },
          {
            title: 'Get specific section',
            description: 'Retrieve a specific configuration section',
            input: {
              projectPath: './my-project',
              section: 'coverage.threshold',
              includeDefaults: false,
            },
          },
        ],
      },
      z.object({
        projectPath: z.string().describe('Path to the project directory'),
        section: z.string().optional().describe('Specific configuration section to retrieve'),
        includeDefaults: z.boolean().optional().default(true).describe('Include default values'),
      }),
      async (params: any, _context: Context<undefined>) => {
        this.toolRegistry.recordToolUsage(configGetTool.name);

        const result = await configGetTool.execute(params);

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }
    );

    // Config Set Tool
    const configSetTool = createConfigSetTool();

    this.registerToolWithRegistry(
      {
        name: configSetTool.name,
        description: configSetTool.description,
        version: '1.0.0',
        category: 'Configuration Management',
        tags: ['config', 'settings', 'update'],
        author: 'claude-testing-infrastructure',
        performance: {
          expectedResponseTime: 1000,
          complexity: 'low',
          resourceUsage: 'light',
        },
        examples: [
          {
            title: 'Update test framework',
            description: 'Change the test framework configuration',
            input: {
              projectPath: './my-project',
              updates: { testFramework: 'vitest' },
              merge: true,
              validate: true,
              backup: true,
            },
          },
          {
            title: 'Update coverage thresholds',
            description: 'Set new coverage threshold values',
            input: {
              projectPath: './my-project',
              updates: {
                coverage: {
                  threshold: {
                    lines: 90,
                    branches: 85,
                    functions: 90,
                    statements: 90,
                  },
                },
              },
              merge: true,
            },
          },
        ],
      },
      z.object({
        projectPath: z.string().describe('Path to the project directory'),
        updates: z.record(z.string(), z.any()).describe('Configuration updates to apply'),
        merge: z.boolean().optional().default(true).describe('Merge with existing config vs replace'),
        validate: z.boolean().optional().default(true).describe('Validate before applying'),
        backup: z.boolean().optional().default(true).describe('Create backup before updating'),
      }),
      async (params: any, _context: Context<undefined>) => {
        this.toolRegistry.recordToolUsage(configSetTool.name);

        const result = await configSetTool.execute(params);

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }
    );

    logger.info('FastMCP Server: Initial tools registered with registry', {
      toolCount: 19,
      tools: [
        'health_check',
        'server_info',
        'tool_discovery',
        'registry_status',
        'registry_activate_tool',
        'registry_update_metadata',
        'server_lifecycle',
        gapRequestTool.name,
        projectAnalyzeTool.name,
        coverageCheckTool.name,
        testGenerateTool.name,
        testRunTool.name,
        'template_cache_warm',
        'template_cache_invalidate',
        'template_cache_stats',
        cachePerformanceMonitorTool.name,
        cacheWarmupTool.name,
        configGetTool.name,
        configSetTool.name,
      ],
    });

    // Initialize template cache warming in background
    this.initializeTemplateCacheWarming();
  }

  /**
   * Initialize template cache warming during server startup
   */
  private initializeTemplateCacheWarming(): void {
    // Warm template cache in background after a short delay to allow server initialization
    setTimeout(async () => {
      try {
        logger.info('FastMCP Server: Starting template cache warming', {
          action: 'cache_warming_startup'
        });
        
        await this.templateOrchestrator.warmTemplateCache();
        const stats = await this.templateOrchestrator.getTemplateCacheStats();
        
        logger.info('FastMCP Server: Template cache warming completed', {
          entryCount: stats.entryCount,
          memoryUsage: Math.round(stats.memoryUsage / 1024 / 1024 * 100) / 100, // MB
          layer: stats.layer,
          action: 'cache_warming_completed'
        });
      } catch (error) {
        logger.warn('FastMCP Server: Template cache warming failed during startup', {
          error: error instanceof Error ? error.message : String(error),
          action: 'cache_warming_failed'
        });
      }
    }, 2000); // 2 second delay to allow server initialization to complete
  }

  /**
   * Register a new tool with both the server and registry
   */
  private registerToolWithRegistry<T extends Record<string, any>>(
    metadata: ToolMetadata,
    parameters: z.ZodSchema<T>,
    handler: ToolHandler<T>,
    options: ToolRegistrationOptions = {}
  ): void {
    try {
      // Wrap the handler with comprehensive error handling
      const wrappedHandler = this.wrapToolHandler(metadata.name, handler);

      // Register in the tool registry first with wrapped handler
      this.toolRegistry.registerTool(metadata, parameters, wrappedHandler, options);

      // Add to the FastMCP server with wrapped handler
      this.server.addTool({
        name: metadata.name,
        description: metadata.description,
        parameters,
        execute: wrappedHandler,
      });

      logger.info('Tool registered with FastMCP server and registry', {
        toolName: metadata.name,
        category: metadata.category,
        tags: metadata.tags,
      });
    } catch (error) {
      // Use MCPErrorHandler for tool registration errors (non-async context)
      handleMCPError(
        error,
        metadata.name,
        'tool_registration',
        `registration-${metadata.name}-${Date.now()}`
      )
        .then((errorResponse) => {
          logger.error('Tool registration failed with MCP categorization', {
            toolName: metadata.name,
            errorCategory: errorResponse.error.category,
            errorSeverity: errorResponse.error.severity,
            errorCode: errorResponse.error.code,
            suggestions: errorResponse.error.suggestions,
          });
        })
        .catch((mcpError) => {
          logger.error('MCPErrorHandler failed during tool registration error handling', {
            toolName: metadata.name,
            originalError: error instanceof Error ? error.message : 'Unknown error',
            mcpError: mcpError instanceof Error ? mcpError.message : 'Unknown MCP error',
          });
        });
      throw error;
    }
  }

  /**
   * Register a new tool with the server (legacy method for backward compatibility)
   */
  public registerTool<T extends Record<string, any>>(
    name: string,
    description: string,
    parameters: z.ZodSchema<T>,
    handler: (params: T, context: Context<undefined>) => Promise<any>
  ): void {
    // Create basic metadata for legacy registration
    const metadata: ToolMetadata = {
      name,
      description,
      version: '1.0.0',
      category: 'legacy',
      tags: ['legacy'],
      author: 'claude-testing-infrastructure',
    };

    this.registerToolWithRegistry(metadata, parameters, handler);
  }

  /**
   * Start the FastMCP server with enhanced lifecycle management
   */
  public async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('FastMCP server is already running');
    }

    this.serverState = 'starting';
    const startupTimeout = this.config.lifecycle?.startupTimeout || 30000;

    try {
      // Create startup timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(
          () => reject(new Error(`Server startup timed out after ${startupTimeout}ms`)),
          startupTimeout
        );
      });

      // Create startup promise
      const startupPromise = this.performStartup();

      // Race between startup and timeout
      await Promise.race([startupPromise, timeoutPromise]);

      this.serverState = 'running';
      this.isRunning = true;
      this.startTime = new Date();
      this.consecutiveErrors = 0; // Reset error count on successful start

      // Start health monitoring if configured
      if (this.config.lifecycle?.healthCheckInterval) {
        this.startHealthMonitoring();
      }

      // Start health check server if configured
      if (this.config.healthCheck?.enabled) {
        await this.startHealthCheckServer();
      }

      logger.info('FastMCP Server startup completed successfully', {
        name: this.config.name,
        transport: this.config.transport?.type || 'stdio',
        healthMonitoring: !!this.config.lifecycle?.healthCheckInterval,
        healthCheckEndpoints: this.config.healthCheck?.enabled,
        healthCheckPort: this.config.healthCheck?.port,
        startupTime: Date.now() - (this.startTime?.getTime() || Date.now()),
      });
    } catch (error) {
      this.serverState = 'error';
      this.isRunning = false;

      logger.error('FastMCP Server startup failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        config: this.config,
        serverState: this.serverState,
      });

      await this.handleServerError(error);
      throw error;
    }
  }

  /**
   * Perform the actual server startup
   */
  private async performStartup(): Promise<void> {
    // Configure transport based on config
    if (this.config.transport?.type === 'httpStream' && this.config.transport.port) {
      await this.server.start({
        transportType: 'httpStream',
        httpStream: {
          port: this.config.transport.port,
          endpoint: this.config.transport.endpoint || '/mcp',
          enableJsonResponse: true,
        },
      });
      logger.info('FastMCP Server started (HTTP Stream)', {
        port: this.config.transport.port,
        endpoint: this.config.transport.endpoint || '/mcp',
        name: this.config.name,
      });
    } else {
      // Default to stdio transport
      await this.server.start({
        transportType: 'stdio',
      });
      logger.info('FastMCP Server started (STDIO)', {
        name: this.config.name,
      });
    }
  }

  /**
   * Stop the FastMCP server with enhanced lifecycle management
   */
  public async stop(): Promise<void> {
    if (!this.isRunning && this.serverState === 'stopped') {
      return;
    }

    this.serverState = 'stopping';
    const shutdownTimeout = this.config.lifecycle?.shutdownTimeout || 15000;

    try {
      // Stop health monitoring first
      this.stopHealthMonitoring();

      // Stop health check server
      if (this.config.healthCheck?.enabled) {
        await this.stopHealthCheckServer();
      }

      // Create shutdown timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(
          () => reject(new Error(`Server shutdown timed out after ${shutdownTimeout}ms`)),
          shutdownTimeout
        );
      });

      // Create shutdown promise
      const shutdownPromise = this.performShutdown();

      // Race between shutdown and timeout
      await Promise.race([shutdownPromise, timeoutPromise]);

      this.serverState = 'stopped';
      this.isRunning = false;

      logger.info('FastMCP Server stopped successfully', {
        name: this.config.name,
        uptime: this.startTime ? Math.floor((Date.now() - this.startTime.getTime()) / 1000) : 0,
      });
    } catch (error) {
      this.serverState = 'error';

      logger.error('FastMCP Server stop failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        serverState: this.serverState,
      });

      // Force stop health monitoring even if shutdown failed
      this.stopHealthMonitoring();
      this.isRunning = false;

      throw error;
    }
  }

  /**
   * Perform the actual server shutdown
   */
  private async performShutdown(): Promise<void> {
    await this.server.stop();
  }

  /**
   * Get comprehensive server status
   */
  public getStatus() {
    return {
      isRunning: this.isRunning,
      startTime: this.startTime,
      uptime: this.startTime ? Date.now() - this.startTime.getTime() : 0,
      serverState: this.serverState,
      config: this.config,
      activeSessions: this.isRunning ? this.server.sessions.length : 0,
      errorStatus: {
        consecutiveErrors: this.consecutiveErrors,
        lastError: this.lastError
          ? {
              message: this.lastError.error.message,
              timestamp: this.lastError.timestamp.toISOString(),
            }
          : null,
        recoveryAttempts: this.recoveryAttempts,
      },
      healthMonitoring: {
        enabled: !!this.healthCheckInterval,
        interval: this.config.lifecycle?.healthCheckInterval,
      },
      lifecycle: {
        startupTimeout: this.config.lifecycle?.startupTimeout,
        shutdownTimeout: this.config.lifecycle?.shutdownTimeout,
        maxRetries: this.config.lifecycle?.maxRetries,
        retryDelay: this.config.lifecycle?.retryDelay,
      },
    };
  }

  /**
   * Get detailed server health information
   */
  public getDetailedHealth() {
    const status = this.getStatus();
    const registryHealth = this.toolRegistry.getHealthStatus();
    const registryStats = this.toolRegistry.getUsageStatistics();

    return {
      ...status,
      registry: {
        health: registryHealth,
        statistics: registryStats,
      },
      performance: {
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage(),
        nodeVersion: process.version,
        platform: process.platform,
      },
    };
  }

  /**
   * Get the underlying FastMCP server instance
   */
  public getFastMCPInstance(): FastMCP<undefined> {
    return this.server;
  }

  /**
   * Get the tool registry instance
   */
  public getToolRegistry(): ToolRegistry {
    return this.toolRegistry;
  }

  /**
   * Get registry health status
   */
  public getRegistryHealth() {
    return this.toolRegistry.getHealthStatus();
  }

  /**
   * Get registry usage statistics
   */
  public getRegistryUsageStats() {
    return this.toolRegistry.getUsageStatistics();
  }

  /**
   * Discover tools using registry filters
   */
  public discoverTools(filter: ToolDiscoveryFilter = {}) {
    return this.toolRegistry.discoverTools(filter);
  }

  /**
   * Determine overall server health status
   */
  private determineOverallHealthStatus(): 'healthy' | 'warning' | 'error' {
    if (this.serverState === 'error') {
      return 'error';
    }

    if (this.consecutiveErrors > 0 || this.serverState === 'recovering') {
      return 'warning';
    }

    const registryHealth = this.toolRegistry.getHealthStatus();
    if (registryHealth.status === 'error') {
      return 'error';
    }

    if (registryHealth.status === 'warning') {
      return 'warning';
    }

    return 'healthy';
  }
}

/**
 * Create a default FastMCP server instance for claude-testing-infrastructure
 */
export function createClaudeTestingFastMCPServer(
  options?: Partial<FastMCPServerConfig>
): ClaudeTestingFastMCPServer {
  const defaultConfig: FastMCPServerConfig = {
    name: 'claude-testing-infrastructure',
    version: '2.0.0',
    description: 'AI-powered decoupled testing infrastructure MCP server',
    transport: {
      type: 'stdio',
    },
    debug: process.env.NODE_ENV === 'development',
    timeout: 60000,
    lifecycle: {
      startupTimeout: 30000,
      shutdownTimeout: 15000,
      healthCheckInterval: 60000, // 1 minute health checks
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
      enabled: options?.transport?.type === 'httpStream' || process.env.NODE_ENV === 'development',
      port: options?.transport?.port ? options.transport.port + 1 : 3002,
      endpoints: {
        health: '/health',
        ready: '/ready',
        live: '/live',
      },
    },
    ...options,
  };

  return new ClaudeTestingFastMCPServer(defaultConfig);
}

/**
 * CLI entry point for the FastMCP server
 */
export async function runFastMCPServer(config?: Partial<FastMCPServerConfig>): Promise<void> {
  const server = createClaudeTestingFastMCPServer(config);

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    logger.info('Received SIGINT, shutting down FastMCP server gracefully...');
    await server.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    logger.info('Received SIGTERM, shutting down FastMCP server gracefully...');
    await server.stop();
    process.exit(0);
  });

  // Start the server
  await server.start();
}
