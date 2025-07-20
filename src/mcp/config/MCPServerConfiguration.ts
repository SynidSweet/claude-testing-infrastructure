/**
 * MCP Server Configuration Interface and Validation
 * 
 * Comprehensive configuration schema for the Claude Testing Infrastructure MCP Server.
 * Implements TASK-2025-179: Configuration schema validation with TypeScript interfaces,
 * Zod validation, and environment variable support.
 * 
 * Based on deployment strategy: /docs/planning/MCP_SERVER_DEPLOYMENT_AND_CONFIGURATION_STRATEGY.md
 */

import { z } from 'zod';

/**
 * Comprehensive MCP Server Configuration Interface
 */
export interface MCPServerConfiguration {
  // Server identification
  server: {
    name: string;                    // e.g., "claude-testing-mcp"
    version: string;                 // e.g., "1.0.0"
    description: string;             // Server description
    environment: 'development' | 'staging' | 'production';
  };
  
  // Transport configuration
  transport: {
    type: 'stdio' | 'httpStream';
    port?: number;                   // HTTP port (if httpStream)
    endpoint?: string;               // HTTP endpoint (if httpStream)
    timeout?: number;                // Request timeout in ms
  };
  
  // Performance and scaling
  performance: {
    maxConcurrentRequests: number;   // Max concurrent requests
    requestTimeoutMs: number;        // Request timeout
    healthCheckIntervalMs: number;   // Health check frequency
    cacheEnabled: boolean;           // Enable response caching
    cacheTtlSeconds: number;         // Cache TTL
  };
  
  // Lifecycle management
  lifecycle: {
    startupTimeoutMs: number;        // Server startup timeout
    shutdownTimeoutMs: number;       // Graceful shutdown timeout
    maxRetries: number;              // Max retry attempts
    retryDelayMs: number;            // Retry delay
  };
  
  // Error handling and resilience
  errorHandling: {
    enableRecovery: boolean;         // Enable error recovery
    logErrors: boolean;              // Log errors
    maxConsecutiveErrors: number;    // Circuit breaker threshold
    errorRecoveryDelayMs: number;    // Recovery delay
  };
  
  // Logging configuration
  logging: {
    level: 'error' | 'warn' | 'info' | 'debug';
    format: 'json' | 'text';
    destination: 'console' | 'file' | 'both';
    filePath?: string;               // Log file path (if file output)
    maxFileSize?: string;            // Log rotation size
    maxFiles?: number;               // Log rotation count
  };
  
  // Tool-specific configuration
  tools: {
    // Project analysis tools
    projectAnalyze: {
      timeoutMs: number;             // Analysis timeout
      maxFileSize: number;           // Max file size to analyze
      excludePatterns: string[];     // Files to exclude
    };
    
    // Test generation tools
    testGenerate: {
      timeoutMs: number;             // Generation timeout
      maxTestsPerFile: number;       // Max tests per component
      enableAiEnhancement: boolean;  // Use Claude CLI for logical tests
    };
    
    // Test execution tools
    testRun: {
      timeoutMs: number;             // Execution timeout
      maxParallelTests: number;      // Parallel test execution
      enableCoverage: boolean;       // Enable coverage collection
    };
    
    // Gap analysis tools
    gapAnalysis: {
      timeoutMs: number;             // Analysis timeout
      coverageThreshold: number;     // Minimum coverage threshold
      enableTaskCreation: boolean;   // Create tasks for gaps
    };
  };
  
  // Security configuration
  security: {
    enableAuthentication: boolean;   // Enable auth (future)
    enableAuthorization: boolean;    // Enable authz (future)
    allowedOrigins: string[];        // CORS origins (if HTTP)
    rateLimitRequests: number;       // Rate limiting
    rateLimitWindowMs: number;       // Rate limit window
  };
  
  // Monitoring and observability
  monitoring: {
    enableMetrics: boolean;          // Enable metrics collection
    metricsPort?: number;            // Metrics HTTP port
    enableTracing: boolean;          // Enable request tracing
    healthCheckPath: string;         // Health check endpoint
  };
}

/**
 * Zod Validation Schema for MCP Server Configuration
 */
export const MCPServerConfigurationSchema = z.object({
  server: z.object({
    name: z.string().min(1, 'Server name is required'),
    version: z.string().regex(/^\d+\.\d+\.\d+$/, 'Version must follow semantic versioning (e.g., 1.0.0)'),
    description: z.string().min(1, 'Server description is required'),
    environment: z.enum(['development', 'staging', 'production']),
  }),
  
  transport: z.object({
    type: z.enum(['stdio', 'httpStream']),
    port: z.number().int().min(1024, 'Port must be at least 1024').max(65535, 'Port must be at most 65535').optional(),
    endpoint: z.string().startsWith('/', 'Endpoint must start with /').optional(),
    timeout: z.number().int().min(1000, 'Timeout must be at least 1000ms').max(300000, 'Timeout must be at most 300000ms').optional(),
  }),
  
  performance: z.object({
    maxConcurrentRequests: z.number().int().min(1, 'Max concurrent requests must be at least 1').max(1000, 'Max concurrent requests must be at most 1000'),
    requestTimeoutMs: z.number().int().min(1000, 'Request timeout must be at least 1000ms').max(300000, 'Request timeout must be at most 300000ms'),
    healthCheckIntervalMs: z.number().int().min(5000, 'Health check interval must be at least 5000ms').max(300000, 'Health check interval must be at most 300000ms'),
    cacheEnabled: z.boolean(),
    cacheTtlSeconds: z.number().int().min(60, 'Cache TTL must be at least 60 seconds').max(86400, 'Cache TTL must be at most 86400 seconds'),
  }),
  
  lifecycle: z.object({
    startupTimeoutMs: z.number().int().min(5000, 'Startup timeout must be at least 5000ms'),
    shutdownTimeoutMs: z.number().int().min(1000, 'Shutdown timeout must be at least 1000ms'),
    maxRetries: z.number().int().min(0, 'Max retries must be non-negative').max(10, 'Max retries must be at most 10'),
    retryDelayMs: z.number().int().min(1000, 'Retry delay must be at least 1000ms'),
  }),
  
  errorHandling: z.object({
    enableRecovery: z.boolean(),
    logErrors: z.boolean(),
    maxConsecutiveErrors: z.number().int().min(1, 'Max consecutive errors must be at least 1'),
    errorRecoveryDelayMs: z.number().int().min(1000, 'Error recovery delay must be at least 1000ms'),
  }),
  
  logging: z.object({
    level: z.enum(['error', 'warn', 'info', 'debug']),
    format: z.enum(['json', 'text']),
    destination: z.enum(['console', 'file', 'both']),
    filePath: z.string().optional(),
    maxFileSize: z.string().optional(),
    maxFiles: z.number().int().min(1).optional(),
  }),
  
  tools: z.object({
    projectAnalyze: z.object({
      timeoutMs: z.number().int().min(1000, 'Analysis timeout must be at least 1000ms'),
      maxFileSize: z.number().int().min(1024, 'Max file size must be at least 1024 bytes'),
      excludePatterns: z.array(z.string()),
    }),
    
    testGenerate: z.object({
      timeoutMs: z.number().int().min(1000, 'Generation timeout must be at least 1000ms'),
      maxTestsPerFile: z.number().int().min(1, 'Max tests per file must be at least 1'),
      enableAiEnhancement: z.boolean(),
    }),
    
    testRun: z.object({
      timeoutMs: z.number().int().min(1000, 'Execution timeout must be at least 1000ms'),
      maxParallelTests: z.number().int().min(1, 'Max parallel tests must be at least 1'),
      enableCoverage: z.boolean(),
    }),
    
    gapAnalysis: z.object({
      timeoutMs: z.number().int().min(1000, 'Analysis timeout must be at least 1000ms'),
      coverageThreshold: z.number().min(0, 'Coverage threshold must be at least 0').max(100, 'Coverage threshold must be at most 100'),
      enableTaskCreation: z.boolean(),
    }),
  }),
  
  security: z.object({
    enableAuthentication: z.boolean(),
    enableAuthorization: z.boolean(),
    allowedOrigins: z.array(z.string()),
    rateLimitRequests: z.number().int().min(1, 'Rate limit requests must be at least 1'),
    rateLimitWindowMs: z.number().int().min(1000, 'Rate limit window must be at least 1000ms'),
  }),
  
  monitoring: z.object({
    enableMetrics: z.boolean(),
    metricsPort: z.number().int().min(1024, 'Metrics port must be at least 1024').max(65535, 'Metrics port must be at most 65535').optional(),
    enableTracing: z.boolean(),
    healthCheckPath: z.string().startsWith('/', 'Health check path must start with /'),
  }),
});

/**
 * Configuration validation function
 */
export function validateConfiguration(config: unknown): MCPServerConfiguration {
  try {
    const parsed = MCPServerConfigurationSchema.parse(config);
    return parsed as MCPServerConfiguration; // Type assertion for strict mode compatibility
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.errors.map(e => `${e.path.join('.')}: ${e.message}`);
      throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
    }
    throw error;
  }
}

/**
 * Create default configuration values
 */
export function createDefaultConfiguration(): MCPServerConfiguration {
  return {
    server: {
      name: 'claude-testing-mcp',
      version: '1.0.0',
      description: 'Claude Testing Infrastructure MCP Server',
      environment: 'development',
    },
    
    transport: {
      type: 'stdio',
      timeout: 30000,
    },
    
    performance: {
      maxConcurrentRequests: 50,
      requestTimeoutMs: 30000,
      healthCheckIntervalMs: 60000,
      cacheEnabled: true,
      cacheTtlSeconds: 300,
    },
    
    lifecycle: {
      startupTimeoutMs: 30000,
      shutdownTimeoutMs: 15000,
      maxRetries: 3,
      retryDelayMs: 5000,
    },
    
    errorHandling: {
      enableRecovery: true,
      logErrors: true,
      maxConsecutiveErrors: 5,
      errorRecoveryDelayMs: 10000,
    },
    
    logging: {
      level: 'info',
      format: 'json',
      destination: 'console',
    },
    
    tools: {
      projectAnalyze: {
        timeoutMs: 10000,
        maxFileSize: 1048576, // 1MB
        excludePatterns: [
          'node_modules/**',
          '*.log',
          '.git/**',
          '.claude-testing/**',
        ],
      },
      
      testGenerate: {
        timeoutMs: 30000,
        maxTestsPerFile: 20,
        enableAiEnhancement: true,
      },
      
      testRun: {
        timeoutMs: 300000, // 5 minutes
        maxParallelTests: 4,
        enableCoverage: true,
      },
      
      gapAnalysis: {
        timeoutMs: 15000,
        coverageThreshold: 80,
        enableTaskCreation: true,
      },
    },
    
    security: {
      enableAuthentication: false,
      enableAuthorization: false,
      allowedOrigins: ['*'],
      rateLimitRequests: 100,
      rateLimitWindowMs: 60000,
    },
    
    monitoring: {
      enableMetrics: true,
      enableTracing: true,
      healthCheckPath: '/health',
    },
  };
}

/**
 * Default configuration values
 */
export const defaultConfiguration = createDefaultConfiguration();