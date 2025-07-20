/**
 * Tests for MCP Config Get Tool
 *
 * @module tests/mcp/tools/ConfigGetTool
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { ConfigGetTool } from '../../../src/mcp/tools/ConfigGetTool';
import { ConfigurationService } from '../../../src/config/ConfigurationService';
import { MCPCacheManager, CacheLayer } from '../../../src/mcp/services/MCPCacheManager';
import { getMCPLogger } from '../../../src/mcp/services/MCPLoggingService';
import type { ConfigGetResult, MCPToolError } from '../../../src/mcp/tool-interfaces';
import * as fs from 'fs';
import * as path from 'path';

// Mock dependencies
jest.mock('../../../src/config/ConfigurationService');
jest.mock('../../../src/mcp/services/MCPCacheManager');
jest.mock('../../../src/mcp/services/MCPLoggingService');
jest.mock('../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

jest.mock('fs', () => ({
  existsSync: jest.fn(),
  promises: {
    stat: jest.fn(),
    readFile: jest.fn(),
    writeFile: jest.fn(),
  },
}));

describe('ConfigGetTool', () => {
  let tool: ConfigGetTool;
  let mockCacheManager: any;
  let mockLogger: any;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup mock cache manager
    mockCacheManager = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
    };
    jest.mocked(MCPCacheManager).getInstance = jest.fn().mockReturnValue(mockCacheManager);

    // Setup mock logger
    mockLogger = {
      logToolStart: jest.fn().mockReturnValue({ startTime: Date.now() }),
      logToolComplete: jest.fn(),
    };
    jest.mocked(getMCPLogger).mockReturnValue(mockLogger);

    // Mock fs operations
    jest.mocked(fs.existsSync).mockReturnValue(true);
    jest.mocked(fs.promises.stat).mockResolvedValue({
      mtime: new Date('2024-01-01'),
    } as any);

    tool = new ConfigGetTool();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('execute', () => {
    it('should successfully retrieve configuration', async () => {
      // Arrange
      const params = {
        projectPath: '/test/project',
        includeDefaults: true,
      };

      const mockConfig = {
        include: ['**/*.ts', '**/*.js'],
        exclude: ['node_modules/**'],
        testFramework: 'jest',
      };

      const mockLoadResult = {
        valid: true,
        errors: [],
        warnings: [],
        config: mockConfig,
      };

      jest.mocked(ConfigurationService).mockImplementation(function(this: any) {
        this.loadConfiguration = jest.fn().mockResolvedValue(mockLoadResult);
        this.getConfiguration = jest.fn().mockReturnValue(mockConfig);
      } as any);

      // Act
      const result = await tool.execute(params) as ConfigGetResult;

      // Assert
      expect(result.configuration).toEqual(mockConfig);
      expect(result.source).toBe('project');
      expect(result.validation).toEqual({
        valid: true,
        errors: [],
        warnings: [],
      });
      expect(result.metadata.exists).toBe(true);

      // Verify caching
      expect(mockCacheManager.set).toHaveBeenCalledWith(
        expect.stringContaining('config_get'),
        result,
        CacheLayer.MEMORY,
        { ttl: 300000 }
      );
    });

    it('should retrieve specific configuration section', async () => {
      // Arrange
      const params = {
        projectPath: '/test/project',
        section: 'coverage.threshold',
        includeDefaults: false,
      };

      const mockConfig = {
        coverage: {
          threshold: {
            lines: 80,
            branches: 70,
            functions: 80,
            statements: 80,
          },
        },
      };

      const mockLoadResult = {
        valid: true,
        errors: [],
        warnings: [],
        config: mockConfig,
      };

      jest.mocked(ConfigurationService).mockImplementation(function(this: any) {
        this.loadConfiguration = jest.fn().mockResolvedValue(mockLoadResult);
        this.getConfiguration = jest.fn().mockReturnValue(mockConfig);
      } as any);

      // Act
      const result = await tool.execute(params) as ConfigGetResult;

      // Assert
      expect(result.configuration).toEqual({
        lines: 80,
        branches: 70,
        functions: 80,
        statements: 80,
      });
    });

    it('should return cached result if available', async () => {
      // Arrange
      const params = {
        projectPath: '/test/project',
        includeDefaults: true,
      };

      const cachedResult: ConfigGetResult = {
        configuration: { cached: true },
        source: 'project',
        validation: { valid: true, errors: [], warnings: [] },
        metadata: { exists: true, path: '/test/config.json' },
      };

      mockCacheManager.get.mockResolvedValue(cachedResult);

      // Act
      const result = await tool.execute(params);

      // Assert
      expect(result).toEqual(cachedResult);
      expect(mockLogger.logToolComplete).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ cacheHit: true }),
        expect.anything(),
        cachedResult
      );

      // Verify no configuration loading occurred
      expect(ConfigurationService).not.toHaveBeenCalled();
    });

    it('should handle non-existent project path', async () => {
      // Arrange
      const params = {
        projectPath: '/non/existent/path',
        includeDefaults: true,
      };

      jest.mocked(fs.existsSync).mockReturnValue(false);

      // Act
      const result = await tool.execute(params) as MCPToolError;

      // Assert
      expect(result.code).toBe('InvalidInput');
      expect(result.message).toBe('Project path does not exist');
      expect(result.details).toEqual({ path: '/non/existent/path' });
    });

    it('should handle configuration loading errors', async () => {
      // Arrange
      const params = {
        projectPath: '/test/project',
        includeDefaults: true,
      };

      const mockLoadResult = {
        valid: false,
        errors: ['Invalid JSON syntax', 'Missing required field'],
        warnings: ['Deprecated option used'],
        config: {},
      };

      jest.mocked(ConfigurationService).mockImplementation(function(this: any) {
        this.loadConfiguration = jest.fn().mockResolvedValue(mockLoadResult);
      } as any);

      // Act
      const result = await tool.execute(params) as MCPToolError;

      // Assert
      expect(result.code).toBe('ConfigurationError');
      expect(result.message).toBe('Failed to load configuration');
      expect(result.details).toEqual({
        errors: ['Invalid JSON syntax', 'Missing required field'],
        warnings: ['Deprecated option used'],
      });
    });

    it('should handle non-existent configuration section', async () => {
      // Arrange
      const params = {
        projectPath: '/test/project',
        section: 'nonexistent.section',
        includeDefaults: true,
      };

      const mockConfig = {
        coverage: { threshold: { lines: 80 } },
      };

      const mockLoadResult = {
        valid: true,
        errors: [],
        warnings: [],
        config: mockConfig,
      };

      jest.mocked(ConfigurationService).mockImplementation(function(this: any) {
        this.loadConfiguration = jest.fn().mockResolvedValue(mockLoadResult);
        this.getConfiguration = jest.fn().mockReturnValue(mockConfig);
      } as any);

      // Act
      const result = await tool.execute(params) as MCPToolError;

      // Assert
      expect(result.code).toBe('InvalidInput');
      expect(result.message).toBe('Configuration section not found');
      expect(result.details).toEqual({ section: 'nonexistent.section' });
    });

    it('should handle invalid parameters', async () => {
      // Arrange
      const params = {
        // Missing required projectPath
        includeDefaults: true,
      };

      // Act
      const result = await tool.execute(params) as MCPToolError;

      // Assert
      expect(result.code).toBe('InvalidInput');
      expect(result.message).toBe('Config get validation failed');
      expect(result.details.errors).toBeDefined();
      expect(result.details.errors).toContain('projectPath: Required');
    });

    it('should detect project configuration file', async () => {
      // Arrange
      const params = {
        projectPath: '/test/project',
        includeDefaults: true,
      };

      const mockConfig = { test: true };
      const mockLoadResult = {
        valid: true,
        errors: [],
        warnings: [],
        config: mockConfig,
      };

      // Mock config file exists
      jest.mocked(fs.promises.stat).mockResolvedValue({
        mtime: new Date('2024-01-01'),
      } as any);

      jest.mocked(ConfigurationService).mockImplementation(function(this: any) {
        this.loadConfiguration = jest.fn().mockResolvedValue(mockLoadResult);
        this.getConfiguration = jest.fn().mockReturnValue(mockConfig);
      } as any);

      // Act
      const result = await tool.execute(params) as ConfigGetResult;

      // Assert
      expect(result.source).toBe('project');
      expect(result.metadata.exists).toBe(true);
      expect(result.metadata.path).toBe(path.join('/test/project', '.claude-testing.config.json'));
      expect(result.metadata.lastModified).toEqual(new Date('2024-01-01'));
    });

    it('should handle nested configuration sections', async () => {
      // Arrange
      const params = {
        projectPath: '/test/project',
        section: 'features.coverage.settings',
        includeDefaults: true,
      };

      const mockConfig = {
        features: {
          coverage: {
            settings: {
              enabled: true,
              reporter: 'lcov',
            },
          },
        },
      };

      const mockLoadResult = {
        valid: true,
        errors: [],
        warnings: [],
        config: mockConfig,
      };

      jest.mocked(ConfigurationService).mockImplementation(function(this: any) {
        this.loadConfiguration = jest.fn().mockResolvedValue(mockLoadResult);
        this.getConfiguration = jest.fn().mockReturnValue(mockConfig);
      } as any);

      // Act
      const result = await tool.execute(params) as ConfigGetResult;

      // Assert
      expect(result.configuration).toEqual({
        enabled: true,
        reporter: 'lcov',
      });
    });
  });

  describe('caching behavior', () => {
    it('should generate correct cache keys', async () => {
      // Arrange
      const params = {
        projectPath: './relative/path',
        section: 'test.section',
        includeDefaults: false,
      };

      const mockConfig = { test: { section: 'value' } };
      const mockLoadResult = {
        valid: true,
        errors: [],
        warnings: [],
        config: mockConfig,
      };

      jest.mocked(ConfigurationService).mockImplementation(function(this: any) {
        this.loadConfiguration = jest.fn().mockResolvedValue(mockLoadResult);
        this.getConfiguration = jest.fn().mockReturnValue(mockConfig);
      } as any);

      // Act
      await tool.execute(params);

      // Assert
      expect(mockCacheManager.get).toHaveBeenCalledWith(
        expect.stringMatching(/config_get:.*:test\.section:no-defaults$/),
        CacheLayer.MEMORY
      );
    });
  });

  describe('error handling', () => {
    it('should handle circuit breaker errors gracefully', async () => {
      // Arrange
      const params = {
        projectPath: '/test/project',
        includeDefaults: true,
      };

      // Force an error in ConfigurationService
      jest.mocked(ConfigurationService).mockImplementation(function() {
        throw new Error('Circuit breaker open');
      } as any);

      // Act
      const result = await tool.execute(params);

      // Assert
      expect(result).toBeDefined();
      expect(mockLogger.logToolComplete).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Object),
        expect.anything(),
        expect.objectContaining({
          code: expect.any(String),
          message: expect.any(String),
        })
      );
    });
  });
});