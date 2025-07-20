/**
 * Configuration Loader for MCP Server
 * 
 * Handles loading configuration from:
 * 1. Environment variables
 * 2. Configuration files (YAML/JSON)
 * 3. Default values
 * 
 * Implements TASK-2025-179: Environment variable and file-based configuration loading
 * with proper validation and error handling.
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, join } from 'path';
import { parse as parseYaml } from 'yaml';
import { MCPServerConfiguration, validateConfiguration, createDefaultConfiguration } from './MCPServerConfiguration';
import { logger } from '../../utils/logger';

/**
 * Environment variable mapping for MCP Server configuration
 */
const ENV_VAR_MAPPING = {
  // Server configuration
  'MCP_SERVER_NAME': 'server.name',
  'MCP_SERVER_VERSION': 'server.version',
  'MCP_SERVER_DESCRIPTION': 'server.description',
  'MCP_SERVER_ENVIRONMENT': 'server.environment',
  
  // Transport configuration
  'MCP_TRANSPORT_TYPE': 'transport.type',
  'MCP_SERVER_PORT': 'transport.port',
  'MCP_TRANSPORT_ENDPOINT': 'transport.endpoint',
  'MCP_REQUEST_TIMEOUT': 'transport.timeout',
  
  // Performance configuration
  'MCP_MAX_CONCURRENT_REQUESTS': 'performance.maxConcurrentRequests',
  'MCP_REQUEST_TIMEOUT_MS': 'performance.requestTimeoutMs',
  'MCP_HEALTH_CHECK_INTERVAL': 'performance.healthCheckIntervalMs',
  'MCP_CACHE_ENABLED': 'performance.cacheEnabled',
  'MCP_CACHE_TTL': 'performance.cacheTtlSeconds',
  
  // Lifecycle configuration
  'MCP_STARTUP_TIMEOUT': 'lifecycle.startupTimeoutMs',
  'MCP_SHUTDOWN_TIMEOUT': 'lifecycle.shutdownTimeoutMs',
  'MCP_MAX_RETRIES': 'lifecycle.maxRetries',
  'MCP_RETRY_DELAY': 'lifecycle.retryDelayMs',
  
  // Error handling configuration
  'MCP_ENABLE_RECOVERY': 'errorHandling.enableRecovery',
  'MCP_LOG_ERRORS': 'errorHandling.logErrors',
  'MCP_MAX_CONSECUTIVE_ERRORS': 'errorHandling.maxConsecutiveErrors',
  'MCP_ERROR_RECOVERY_DELAY': 'errorHandling.errorRecoveryDelayMs',
  
  // Logging configuration
  'MCP_LOG_LEVEL': 'logging.level',
  'MCP_LOG_FORMAT': 'logging.format',
  'MCP_LOG_DESTINATION': 'logging.destination',
  'MCP_LOG_FILE_PATH': 'logging.filePath',
  'MCP_LOG_MAX_FILE_SIZE': 'logging.maxFileSize',
  'MCP_LOG_MAX_FILES': 'logging.maxFiles',
  
  // Tool configuration
  'MCP_PROJECT_ANALYZE_TIMEOUT': 'tools.projectAnalyze.timeoutMs',
  'MCP_PROJECT_ANALYZE_MAX_FILE_SIZE': 'tools.projectAnalyze.maxFileSize',
  'MCP_TEST_GENERATE_TIMEOUT': 'tools.testGenerate.timeoutMs',
  'MCP_TEST_GENERATE_MAX_TESTS': 'tools.testGenerate.maxTestsPerFile',
  'MCP_TEST_GENERATE_AI_ENABLED': 'tools.testGenerate.enableAiEnhancement',
  'MCP_TEST_RUN_TIMEOUT': 'tools.testRun.timeoutMs',
  'MCP_TEST_RUN_MAX_PARALLEL': 'tools.testRun.maxParallelTests',
  'MCP_TEST_RUN_COVERAGE_ENABLED': 'tools.testRun.enableCoverage',
  'MCP_GAP_ANALYSIS_TIMEOUT': 'tools.gapAnalysis.timeoutMs',
  'MCP_GAP_ANALYSIS_COVERAGE_THRESHOLD': 'tools.gapAnalysis.coverageThreshold',
  'MCP_GAP_ANALYSIS_TASK_CREATION_ENABLED': 'tools.gapAnalysis.enableTaskCreation',
  
  // Security configuration
  'MCP_AUTH_ENABLED': 'security.enableAuthentication',
  'MCP_AUTHZ_ENABLED': 'security.enableAuthorization',
  'MCP_CORS_ORIGINS': 'security.allowedOrigins',
  'MCP_RATE_LIMIT_REQUESTS': 'security.rateLimitRequests',
  'MCP_RATE_LIMIT_WINDOW': 'security.rateLimitWindowMs',
  
  // Monitoring configuration
  'MCP_METRICS_ENABLED': 'monitoring.enableMetrics',
  'MCP_METRICS_PORT': 'monitoring.metricsPort',
  'MCP_TRACING_ENABLED': 'monitoring.enableTracing',
  'MCP_HEALTH_CHECK_PATH': 'monitoring.healthCheckPath',
} as const;

/**
 * Configuration file names to search for
 */
const CONFIG_FILE_NAMES = [
  'mcp-server.yaml',
  'mcp-server.yml',
  'mcp-server.json',
  '.mcp-server.yaml',
  '.mcp-server.yml',
  '.mcp-server.json',
];

/**
 * Load and merge configuration from all sources
 */
export class ConfigurationLoader {
  /**
   * Load complete configuration from all sources
   */
  static loadConfiguration(configPath?: string): MCPServerConfiguration {
    logger.info('Loading MCP server configuration from multiple sources');
    
    // Start with default configuration
    let config: MCPServerConfiguration = createDefaultConfiguration();
    
    // 1. Load from configuration file
    const fileConfig = this.loadConfigurationFile(configPath);
    if (fileConfig) {
      config = this.mergeConfigurations(config, fileConfig) as MCPServerConfiguration;
      logger.info('Configuration loaded from file');
    }
    
    // 2. Load from environment variables
    const envConfig = this.loadEnvironmentConfiguration();
    if (Object.keys(envConfig).length > 0) {
      config = this.mergeConfigurations(config, envConfig) as MCPServerConfiguration;
      logger.info(`Configuration loaded from ${Object.keys(envConfig).length} environment variables`);
    }
    
    // 3. Validate final configuration
    try {
      const validatedConfig = validateConfiguration(config);
      logger.info('Configuration validation successful');
      return validatedConfig;
    } catch (error) {
      logger.error('Configuration validation failed', { error: error instanceof Error ? error.message : error });
      throw error;
    }
  }
  
  /**
   * Load configuration from file (YAML or JSON)
   */
  private static loadConfigurationFile(configPath?: string): Partial<MCPServerConfiguration> | null {
    let filePath: string | null = null;
    
    // Use provided path or search for config files
    if (configPath) {
      if (existsSync(configPath)) {
        filePath = configPath;
      } else {
        logger.warn(`Specified config file not found: ${configPath}`);
        return null;
      }
    } else {
      // Search for config files in current directory and parent directories
      filePath = this.findConfigFile();
    }
    
    if (!filePath) {
      logger.debug('No configuration file found, using defaults and environment variables');
      return null;
    }
    
    try {
      logger.info(`Loading configuration from file: ${filePath}`);
      const fileContent = readFileSync(filePath, 'utf-8');
      
      if (filePath.endsWith('.json')) {
        return JSON.parse(fileContent);
      } else if (filePath.endsWith('.yaml') || filePath.endsWith('.yml')) {
        return parseYaml(fileContent);
      } else {
        logger.warn(`Unsupported config file format: ${filePath}`);
        return null;
      }
    } catch (error) {
      logger.error(`Failed to load configuration file: ${filePath}`, { 
        error: error instanceof Error ? error.message : error 
      });
      throw new Error(`Configuration file loading failed: ${error instanceof Error ? error.message : error}`);
    }
  }
  
  /**
   * Find configuration file in current directory and parent directories
   */
  private static findConfigFile(): string | null {
    let currentDir = process.cwd();
    const maxDepth = 5; // Limit search depth
    
    for (let depth = 0; depth < maxDepth; depth++) {
      for (const filename of CONFIG_FILE_NAMES) {
        const filePath = join(currentDir, filename);
        if (existsSync(filePath)) {
          return filePath;
        }
      }
      
      const parentDir = resolve(currentDir, '..');
      if (parentDir === currentDir) {
        break; // Reached root directory
      }
      currentDir = parentDir;
    }
    
    return null;
  }
  
  /**
   * Load configuration from environment variables
   */
  private static loadEnvironmentConfiguration(): Partial<MCPServerConfiguration> {
    const envConfig: any = {};
    
    for (const [envVar, configPath] of Object.entries(ENV_VAR_MAPPING)) {
      const value = process.env[envVar];
      if (value !== undefined) {
        this.setNestedProperty(envConfig, configPath, this.parseEnvironmentValue(value));
      }
    }
    
    // Handle special case for exclude patterns (comma-separated)
    const excludePatterns = process.env.MCP_PROJECT_ANALYZE_EXCLUDE_PATTERNS;
    if (excludePatterns) {
      this.setNestedProperty(envConfig, 'tools.projectAnalyze.excludePatterns', excludePatterns.split(',').map(p => p.trim()));
    }
    
    // Handle special case for CORS origins (comma-separated)
    const corsOrigins = process.env.MCP_CORS_ORIGINS;
    if (corsOrigins) {
      this.setNestedProperty(envConfig, 'security.allowedOrigins', corsOrigins.split(',').map(o => o.trim()));
    }
    
    return envConfig;
  }
  
  /**
   * Parse environment variable value to appropriate type
   */
  private static parseEnvironmentValue(value: string): any {
    // Boolean values
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;
    
    // Numeric values
    const numValue = Number(value);
    if (!isNaN(numValue)) return numValue;
    
    // String values
    return value;
  }
  
  /**
   * Set nested property in object using dot notation
   */
  private static setNestedProperty(obj: any, path: string, value: any): void {
    const keys = path.split('.');
    let current = obj;
    
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!key) continue; // Skip empty keys
      if (!(key in current)) {
        current[key] = {};
      }
      current = current[key];
    }
    
    const lastKey = keys[keys.length - 1];
    if (lastKey) {
      current[lastKey] = value;
    }
  }
  
  /**
   * Deep merge two configuration objects
   */
  private static mergeConfigurations(
    base: Partial<MCPServerConfiguration>, 
    override: Partial<MCPServerConfiguration>
  ): Partial<MCPServerConfiguration> {
    const result = { ...base };
    
    for (const [key, value] of Object.entries(override)) {
      const typedKey = key as keyof MCPServerConfiguration;
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        (result as any)[typedKey] = this.mergeConfigurations(
          (result[typedKey] as any) || {},
          value as any
        );
      } else {
        (result as any)[typedKey] = value;
      }
    }
    
    return result;
  }
  
  /**
   * Get environment-specific defaults
   */
  static getEnvironmentDefaults(environment: string): MCPServerConfiguration {
    const baseDefaults = createDefaultConfiguration();
    
    switch (environment) {
      case 'development':
        return {
          ...baseDefaults,
          server: {
            ...baseDefaults.server,
            environment: 'development',
          },
          transport: {
            type: 'httpStream',
            port: 3001,
            ...(baseDefaults.transport.timeout !== undefined && { timeout: baseDefaults.transport.timeout }),
          },
          logging: {
            ...baseDefaults.logging,
            level: 'debug',
          },
          monitoring: {
            ...baseDefaults.monitoring,
            enableMetrics: true,
            enableTracing: true,
          },
        };
        
      case 'staging':
        return {
          ...baseDefaults,
          server: {
            ...baseDefaults.server,
            environment: 'staging',
          },
          transport: {
            type: 'stdio',
            ...(baseDefaults.transport.timeout !== undefined && { timeout: baseDefaults.transport.timeout }),
          },
          logging: {
            ...baseDefaults.logging,
            level: 'info',
          },
          monitoring: {
            ...baseDefaults.monitoring,
            enableMetrics: true,
            enableTracing: true,
          },
        };
        
      case 'production':
        return {
          ...baseDefaults,
          server: {
            ...baseDefaults.server,
            environment: 'production',
          },
          transport: {
            type: 'stdio',
            ...(baseDefaults.transport.timeout !== undefined && { timeout: baseDefaults.transport.timeout }),
          },
          logging: {
            ...baseDefaults.logging,
            level: 'warn',
          },
          security: {
            ...baseDefaults.security,
            enableAuthentication: false, // Will be true when auth is implemented
          },
          monitoring: {
            ...baseDefaults.monitoring,
            enableMetrics: true,
            enableTracing: true,
          },
        };
        
      default:
        return baseDefaults;
    }
  }
  
  /**
   * Save configuration to file
   */
  static saveConfigurationFile(config: MCPServerConfiguration, filePath: string): void {
    const { writeFileSync } = require('fs');
    const { stringify } = require('yaml');
    
    try {
      let content: string;
      
      if (filePath.endsWith('.json')) {
        content = JSON.stringify(config, null, 2);
      } else {
        content = stringify(config, {
          indent: 2,
          lineWidth: 120,
          minContentWidth: 0,
        });
      }
      
      writeFileSync(filePath, content, 'utf-8');
      logger.info(`Configuration saved to: ${filePath}`);
    } catch (error) {
      logger.error(`Failed to save configuration file: ${filePath}`, {
        error: error instanceof Error ? error.message : error
      });
      throw error;
    }
  }
}