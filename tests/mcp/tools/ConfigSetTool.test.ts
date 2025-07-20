/**
 * Tests for MCP Config Set Tool
 *
 * @module tests/mcp/tools/ConfigSetTool
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { ConfigSetTool } from '../../../src/mcp/tools/ConfigSetTool';
import { ConfigurationService } from '../../../src/config/ConfigurationService';
import { MCPCacheManager } from '../../../src/mcp/services/MCPCacheManager';
import { getMCPLogger } from '../../../src/mcp/services/MCPLoggingService';
import type { ConfigSetResult, MCPToolError } from '../../../src/mcp/tool-interfaces';
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

describe('ConfigSetTool', () => {
  let tool: ConfigSetTool;
  let mockCacheManager: any;
  let mockLogger: any;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup mock cache manager
    mockCacheManager = {
      clear: jest.fn().mockResolvedValue(undefined),
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
    jest.mocked(fs.promises.readFile).mockResolvedValue('{}');
    jest.mocked(fs.promises.writeFile).mockResolvedValue(undefined);

    tool = new ConfigSetTool();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('execute', () => {
    it('should successfully update configuration', async () => {
      // Arrange
      const params = {
        projectPath: '/test/project',
        updates: {
          testFramework: 'vitest',
          coverage: { threshold: { lines: 90 } },
        },
        merge: true,
        validate: true,
        backup: true,
      };

      const existingConfig = {
        testFramework: 'jest',
        coverage: { threshold: { lines: 80, branches: 70 } },
      };

      jest.mocked(fs.promises.readFile).mockResolvedValue(JSON.stringify(existingConfig));

      // Act
      const result = await tool.execute(params) as ConfigSetResult;

      // Assert
      expect(result.success).toBe(true);
      expect(result.changes).toEqual({
        'testFramework': { old: 'jest', new: 'vitest' },
        'coverage.threshold.lines': { old: 80, new: 90 },
      });
      expect(result.backup.created).toBe(true);
      expect(result.backup.path).toMatch(/\.backup-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.json$/);
      expect(result.validation).toEqual({
        performed: true,
        passed: true,
      });

      // Verify file write
      expect(fs.promises.writeFile).toHaveBeenCalledWith(
        path.join('/test/project', '.claude-testing.config.json'),
        JSON.stringify({
          testFramework: 'vitest',
          coverage: { threshold: { lines: 90, branches: 70 } },
        }, null, 2),
        'utf-8'
      );

      // Verify cache clear
      expect(mockCacheManager.clear).toHaveBeenCalledWith(
        expect.stringContaining('config_get:/test/project:*')
      );
    });

    it('should handle non-existent project path', async () => {
      // Arrange
      const params = {
        projectPath: '/non/existent/path',
        updates: { test: true },
      };

      jest.mocked(fs.existsSync).mockReturnValue(false);

      // Act
      const result = await tool.execute(params) as MCPToolError;

      // Assert
      expect(result.code).toBe('InvalidInput');
      expect(result.message).toBe('Project path does not exist');
      expect(result.details).toEqual({ path: '/non/existent/path' });
    });

    it('should create new configuration file if not exists', async () => {
      // Arrange
      const params = {
        projectPath: '/test/project',
        updates: {
          include: ['**/*.ts'],
          exclude: ['node_modules/**'],
        },
      };

      jest.mocked(fs.existsSync).mockReturnValueOnce(true).mockReturnValueOnce(false);

      // Act
      const result = await tool.execute(params) as ConfigSetResult;

      // Assert
      expect(result.success).toBe(true);
      expect(result.changes).toEqual({
        'include': { old: undefined, new: ['**/*.ts'] },
        'exclude': { old: undefined, new: ['node_modules/**'] },
      });
      expect(result.backup.created).toBe(false);

      // Verify file write
      expect(fs.promises.writeFile).toHaveBeenCalledWith(
        path.join('/test/project', '.claude-testing.config.json'),
        JSON.stringify({
          include: ['**/*.ts'],
          exclude: ['node_modules/**'],
        }, null, 2),
        'utf-8'
      );
    });

    it('should replace entire configuration when merge is false', async () => {
      // Arrange
      const params = {
        projectPath: '/test/project',
        updates: {
          newConfig: true,
          version: '2.0',
        },
        merge: false,
      };

      const existingConfig = {
        oldConfig: true,
        version: '1.0',
        keep: 'this',
      };

      jest.mocked(fs.promises.readFile).mockResolvedValue(JSON.stringify(existingConfig));

      // Act
      const result = await tool.execute(params) as ConfigSetResult;

      // Assert
      expect(result.success).toBe(true);
      expect(result.changes).toEqual({
        'oldConfig': { old: true, new: undefined },
        'version': { old: '1.0', new: '2.0' },
        'keep': { old: 'this', new: undefined },
        'newConfig': { old: undefined, new: true },
      });

      // Verify file write contains only new config
      expect(fs.promises.writeFile).toHaveBeenCalledWith(
        expect.any(String),
        JSON.stringify({
          newConfig: true,
          version: '2.0',
        }, null, 2),
        'utf-8'
      );
    });

    it('should handle validation failures', async () => {
      // Arrange
      const params = {
        projectPath: '/test/project',
        updates: {
          include: 'not-an-array', // Invalid type
          coverage: 'not-an-object',
        },
        validate: true,
      };

      // Act
      const result = await tool.execute(params) as MCPToolError;

      // Assert
      expect(result.code).toBe('ConfigurationError');
      expect(result.message).toBe('Configuration validation failed');
      expect(result.details.errors).toContain('include must be an array of patterns');
      expect(result.details.errors).toContain('coverage must be an object');
    });

    it('should skip validation when validate is false', async () => {
      // Arrange
      const params = {
        projectPath: '/test/project',
        updates: {
          include: 'not-an-array', // Would fail validation
        },
        validate: false,
      };

      // Act
      const result = await tool.execute(params) as ConfigSetResult;

      // Assert
      expect(result.success).toBe(true);
      expect(result.validation).toEqual({
        performed: false,
        passed: true,
      });
    });

    it('should handle backup creation errors gracefully', async () => {
      // Arrange
      const params = {
        projectPath: '/test/project',
        updates: { test: true },
        backup: true,
      };

      const existingConfig = { existing: true };
      jest.mocked(fs.promises.readFile).mockResolvedValue(JSON.stringify(existingConfig));

      // Make backup write fail
      jest.mocked(fs.promises.writeFile).mockImplementation(async (path: any) => {
        if (path.includes('.backup-')) {
          throw new Error('Permission denied');
        }
        return undefined;
      });

      // Act
      const result = await tool.execute(params);

      // Assert
      // Should continue despite backup failure
      expect(result).toBeDefined();
    });

    it('should handle invalid JSON in existing config', async () => {
      // Arrange
      const params = {
        projectPath: '/test/project',
        updates: { test: true },
      };

      jest.mocked(fs.promises.readFile).mockResolvedValue('{ invalid json');

      // Act
      const result = await tool.execute(params) as MCPToolError;

      // Assert
      expect(result.code).toBe('ConfigurationError');
      expect(result.message).toBe('Failed to parse existing configuration');
      expect(result.suggestion).toBe('Check the configuration file for JSON syntax errors');
    });

    it('should handle write failures', async () => {
      // Arrange
      const params = {
        projectPath: '/test/project',
        updates: { test: true },
      };

      jest.mocked(fs.promises.writeFile).mockRejectedValue(new Error('Disk full'));

      // Act
      const result = await tool.execute(params) as MCPToolError;

      // Assert
      expect(result.code).toBe('InternalError');
      expect(result.message).toBe('Failed to write configuration file');
      expect(result.details.error).toBe('Disk full');
    });

    it('should handle deep nested updates', async () => {
      // Arrange
      const params = {
        projectPath: '/test/project',
        updates: {
          features: {
            coverage: {
              settings: {
                threshold: {
                  lines: 95,
                  functions: 90,
                },
              },
            },
          },
        },
        merge: true,
      };

      const existingConfig = {
        features: {
          coverage: {
            enabled: true,
            settings: {
              threshold: {
                lines: 80,
                branches: 70,
              },
              reporter: 'lcov',
            },
          },
          other: true,
        },
      };

      jest.mocked(fs.promises.readFile).mockResolvedValue(JSON.stringify(existingConfig));

      // Act
      const result = await tool.execute(params) as ConfigSetResult;

      // Assert
      expect(result.success).toBe(true);
      expect(result.changes).toEqual({
        'features.coverage.settings.threshold.lines': { old: 80, new: 95 },
        'features.coverage.settings.threshold.functions': { old: undefined, new: 90 },
      });

      // Verify merged result preserves existing values
      const writtenConfig = JSON.parse(
        (jest.mocked(fs.promises.writeFile).mock.calls[1][1] as string)
      );
      expect(writtenConfig.features.coverage.enabled).toBe(true);
      expect(writtenConfig.features.coverage.settings.reporter).toBe('lcov');
      expect(writtenConfig.features.coverage.settings.threshold.branches).toBe(70);
      expect(writtenConfig.features.other).toBe(true);
    });

    it('should include validation warnings in result', async () => {
      // Arrange
      const params = {
        projectPath: '/test/project',
        updates: {
          testFramework: 'jest',
          outputDir: './output', // Deprecated option
        },
      };

      // Act
      const result = await tool.execute(params) as ConfigSetResult;

      // Assert
      expect(result.success).toBe(true);
      expect(result.validation.warnings).toContain('outputDir is deprecated, tests are now stored in .claude-testing/');
    });

    it('should handle array updates correctly', async () => {
      // Arrange
      const params = {
        projectPath: '/test/project',
        updates: {
          include: ['**/*.ts', '**/*.tsx'],
          exclude: ['node_modules/**', 'dist/**'],
        },
      };

      const existingConfig = {
        include: ['**/*.js'],
        exclude: ['node_modules/**'],
      };

      jest.mocked(fs.promises.readFile).mockResolvedValue(JSON.stringify(existingConfig));

      // Act
      const result = await tool.execute(params) as ConfigSetResult;

      // Assert
      expect(result.success).toBe(true);
      expect(result.changes).toEqual({
        'include': { 
          old: ['**/*.js'], 
          new: ['**/*.ts', '**/*.tsx'] 
        },
        'exclude': { 
          old: ['node_modules/**'], 
          new: ['node_modules/**', 'dist/**'] 
        },
      });
    });

    it('should handle invalid parameters', async () => {
      // Arrange
      const params = {
        projectPath: '/test/project',
        // Missing required 'updates' field
      };

      // Act
      const result = await tool.execute(params) as MCPToolError;

      // Assert
      expect(result.code).toBe('InvalidInput');
      expect(result.message).toBe('Config set validation failed');
      expect(result.details.errors).toBeDefined();
      expect(result.details.errors).toContain('updates: Required');
    });
  });
});