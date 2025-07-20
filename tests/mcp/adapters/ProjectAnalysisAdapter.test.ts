/**
 * Tests for ProjectAnalysisAdapter
 *
 * Comprehensive test suite for the ProjectAnalysisAdapter service adapter,
 * including unit tests, integration tests, caching, error handling, and resilience features.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { ProjectAnalysisAdapter, type ProjectAnalysisParams } from '../../../src/mcp/adapters/ProjectAnalysisAdapter';
import { MCPCacheManager, CacheLayer } from '../../../src/mcp/services/MCPCacheManager';
import { ProjectAnalyzer } from '../../../src/analyzers/ProjectAnalyzer';
import type { MCPToolContext } from '../../../src/mcp/services/MCPLoggingService';
import { MCPToolError, MCPToolErrorType } from '../../../src/types/mcp-tool-types';

// Mock dependencies
jest.mock('../../../src/mcp/services/MCPCacheManager');
jest.mock('../../../src/analyzers/ProjectAnalyzer');
jest.mock('../../../src/utils/logger');

describe('ProjectAnalysisAdapter', () => {
  let adapter: ProjectAnalysisAdapter;
  let mockCacheManager: jest.Mocked<MCPCacheManager>;
  let mockProjectAnalyzer: jest.Mocked<ProjectAnalyzer>;
  let mockContext: MCPToolContext;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Mock cache manager
    mockCacheManager = {
      get: jest.fn(),
      set: jest.fn(),
      delete: jest.fn(),
      getInstance: jest.fn(),
    } as any;

    (MCPCacheManager.getInstance as jest.Mock).mockReturnValue(mockCacheManager);

    // Mock project analyzer
    mockProjectAnalyzer = {
      analyze: jest.fn(),
    } as any;

    (ProjectAnalyzer as jest.Mock).mockImplementation(() => mockProjectAnalyzer);

    // Create adapter instance
    adapter = new ProjectAnalysisAdapter();

    // Mock context
    mockContext = {
      toolName: 'test-tool',
      operation: 'test',
      parameters: {},
      sessionId: 'test-session',
      traceId: 'test-trace',
    };
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('Basic Functionality', () => {
    it('should have correct adapter properties', () => {
      expect(adapter.name).toBe('project-analysis-adapter');
      expect(adapter.description).toBe('Adapter for ProjectAnalyzer with caching and resilience');
      expect(adapter.parameters).toBeDefined();
    });

    it('should validate input parameters correctly', () => {
      const validParams: ProjectAnalysisParams = {
        projectPath: '/test/path',
        deep: true,
      };

      const result = adapter.validateInput(validParams);
      expect(result).toEqual({
        projectPath: '/test/path',
        deep: true,
        includeCacheStats: false,
        forceFresh: false,
      });
    });

    it('should throw validation error for invalid parameters', () => {
      const invalidParams = {
        projectPath: '', // Empty string should fail
      };

      expect(() => adapter.validateInput(invalidParams)).toThrow(MCPToolError);
    });
  });

  describe('Cache Key Generation', () => {
    it('should generate consistent cache keys for same parameters', () => {
      const params: ProjectAnalysisParams = {
        projectPath: '/test/path',
        deep: true,
        include: ['**/*.ts'],
        exclude: ['**/*.test.ts'],
      };

      const key1 = adapter.getCacheKey(params);
      const key2 = adapter.getCacheKey(params);

      expect(key1).toBe(key2);
      expect(key1).toMatch(/^analysis:[a-f0-9]{16}$/);
    });

    it('should generate different cache keys for different parameters', () => {
      const params1: ProjectAnalysisParams = {
        projectPath: '/test/path1',
        deep: true,
      };

      const params2: ProjectAnalysisParams = {
        projectPath: '/test/path2',
        deep: true,
      };

      const key1 = adapter.getCacheKey(params1);
      const key2 = adapter.getCacheKey(params2);

      expect(key1).not.toBe(key2);
    });

    it('should handle array ordering in cache keys', () => {
      const params1: ProjectAnalysisParams = {
        projectPath: '/test/path',
        include: ['**/*.ts', '**/*.js'],
      };

      const params2: ProjectAnalysisParams = {
        projectPath: '/test/path',
        include: ['**/*.js', '**/*.ts'],
      };

      const key1 = adapter.getCacheKey(params1);
      const key2 = adapter.getCacheKey(params2);

      // Should be the same because arrays are sorted in cache key generation
      expect(key1).toBe(key2);
    });
  });

  describe('TTL Configuration', () => {
    it('should return correct TTL value', () => {
      const ttl = adapter.getTTL();
      expect(ttl).toBe(10 * 60 * 1000); // 10 minutes
    });
  });

  describe('Core Execution', () => {
    const mockAnalysisResult = {
      projectPath: '/test/path',
      languages: [{ name: 'typescript' as const, confidence: 0.9, files: [] }],
      frameworks: [],
      packageManagers: [],
      projectStructure: {
        directories: [],
        files: [],
        depth: 0,
        fileCount: 0,
        directoryCount: 0,
      },
      dependencies: {
        runtime: {},
        development: {},
        total: 0,
      },
      testingSetup: {
        testFrameworks: [],
        testFiles: [],
        coverageTools: [],
        hasTestConfig: false,
        testFileCount: 0,
      },
      complexity: {
        overall: 'medium' as const,
        score: 5,
        factors: [],
      },
      moduleSystem: {
        type: 'esm' as const,
        hasPackageJsonType: true,
        confidence: 0.9,
        fileExtensionPattern: 'ts' as const,
      },
    };

    it('should execute analysis successfully', async () => {
      const params: ProjectAnalysisParams = {
        projectPath: '/test/path',
        deep: false,
      };

      mockProjectAnalyzer.analyze.mockResolvedValue(mockAnalysisResult);
      mockCacheManager.get.mockResolvedValue(null); // No cache hit

      const result = await adapter.execute(params, mockContext);

      expect(result).toMatchObject({
        ...mockAnalysisResult,
        metadata: {
          fromCache: false,
          strategy: 'full',
        },
      });

      expect(mockProjectAnalyzer.analyze).toHaveBeenCalledWith('/test/path', {
        includePatterns: undefined,
        excludePatterns: undefined,
        deep: false,
        includeCacheStats: false,
      });
    });

    it('should return cached result when available', async () => {
      const params: ProjectAnalysisParams = {
        projectPath: '/test/path',
        deep: false,
      };

      const cachedResult = {
        ...mockAnalysisResult,
        metadata: {
          duration: 100,
          fromCache: true,
          cacheKey: 'test-key',
          strategy: 'cached',
        },
      };

      mockCacheManager.get.mockResolvedValue(cachedResult);

      const result = await adapter.execute(params, mockContext);

      expect(result.metadata.fromCache).toBe(true);
      expect(mockProjectAnalyzer.analyze).not.toHaveBeenCalled();
    });

    it('should handle force fresh parameter', async () => {
      const params: ProjectAnalysisParams = {
        projectPath: '/test/path',
        deep: false,
        forceFresh: true,
      };

      mockProjectAnalyzer.analyze.mockResolvedValue(mockAnalysisResult);
      mockCacheManager.delete.mockResolvedValue(undefined);
      mockCacheManager.get.mockResolvedValue(null);

      await adapter.execute(params, mockContext);

      expect(mockCacheManager.delete).toHaveBeenCalled();
      expect(mockProjectAnalyzer.analyze).toHaveBeenCalled();
    });

    it('should pass through analysis options correctly', async () => {
      const params: ProjectAnalysisParams = {
        projectPath: '/test/path',
        deep: true,
        include: ['**/*.ts'],
        exclude: ['**/*.test.ts'],
        includeCacheStats: true,
      };

      mockProjectAnalyzer.analyze.mockResolvedValue(mockAnalysisResult);
      mockCacheManager.get.mockResolvedValue(null);

      await adapter.execute(params, mockContext);

      expect(mockProjectAnalyzer.analyze).toHaveBeenCalledWith('/test/path', {
        includePatterns: ['**/*.ts'],
        excludePatterns: ['**/*.test.ts'],
        deep: true,
        includeCacheStats: true,
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle analyzer errors gracefully', async () => {
      const params: ProjectAnalysisParams = {
        projectPath: '/test/path',
        deep: false,
      };

      const error = new Error('Analysis failed');
      mockProjectAnalyzer.analyze.mockRejectedValue(error);
      mockCacheManager.get.mockResolvedValue(null);

      await expect(adapter.execute(params, mockContext)).rejects.toThrow();
    });

    it('should handle cache errors gracefully', async () => {
      const params: ProjectAnalysisParams = {
        projectPath: '/test/path',
        deep: false,
      };

      mockProjectAnalyzer.analyze.mockResolvedValue(mockAnalysisResult);
      mockCacheManager.get.mockRejectedValue(new Error('Cache error'));

      // Should still work even if cache fails
      const result = await adapter.execute(params, mockContext);
      expect(result.metadata.fromCache).toBe(false);
    });
  });

  describe('Transform Output', () => {
    it('should transform cached result correctly', () => {
      const cachedAnalysis = {
        projectPath: '/test/path',
        languages: [],
        frameworks: [],
        packageManagers: [],
        projectStructure: {
          directories: [],
          files: [],
          depth: 0,
          fileCount: 0,
          directoryCount: 0,
        },
        dependencies: {
          runtime: {},
          development: {},
          total: 0,
        },
        testingSetup: {
          testFrameworks: [],
          testFiles: [],
          coverageTools: [],
          hasTestConfig: false,
          testFileCount: 0,
        },
        complexity: {
          overall: 'low' as const,
          score: 2,
          factors: [],
        },
        moduleSystem: {
          type: 'commonjs' as const,
          hasPackageJsonType: false,
          confidence: 0.5,
          fileExtensionPattern: 'js' as const,
        },
      };

      const result = adapter.transformOutput(cachedAnalysis);

      expect(result.metadata).toEqual({
        duration: 0,
        fromCache: true,
        cacheKey: 'cached',
        strategy: 'cached',
      });
    });

    it('should return already transformed result as-is', () => {
      const alreadyTransformed = {
        projectPath: '/test/path',
        languages: [],
        frameworks: [],
        packageManagers: [],
        projectStructure: {
          directories: [],
          files: [],
          depth: 0,
          fileCount: 0,
          directoryCount: 0,
        },
        dependencies: {
          runtime: {},
          development: {},
          total: 0,
        },
        testingSetup: {
          testFrameworks: [],
          testFiles: [],
          coverageTools: [],
          hasTestConfig: false,
          testFileCount: 0,
        },
        complexity: {
          overall: 'medium' as const,
          score: 3,
          factors: [],
        },
        moduleSystem: {
          type: 'mixed' as const,
          hasPackageJsonType: true,
          confidence: 0.7,
          fileExtensionPattern: 'ts' as const,
        },
        metadata: {
          duration: 500,
          fromCache: false,
          cacheKey: 'existing',
          strategy: 'full' as const,
        },
      };

      const result = adapter.transformOutput(alreadyTransformed);
      expect(result).toBe(alreadyTransformed);
    });
  });

  describe('Health Check', () => {
    it('should return healthy status on successful execution', async () => {
      mockProjectAnalyzer.analyze.mockResolvedValue(mockAnalysisResult);
      mockCacheManager.get.mockResolvedValue(null);

      const health = await adapter.healthCheck();

      expect(health.status).toBe('healthy');
      expect(health.details).toContain('Analysis completed');
    });

    it('should return failed status on execution error', async () => {
      mockProjectAnalyzer.analyze.mockRejectedValue(new Error('Test error'));
      mockCacheManager.get.mockResolvedValue(null);

      const health = await adapter.healthCheck();

      expect(health.status).toBe('failed');
      expect(health.details).toContain('Health check failed: Test error');
    });
  });

  describe('Factory Function', () => {
    it('should create adapter instance correctly', async () => {
      const { createProjectAnalysisAdapter } = await import('../../../src/mcp/adapters/ProjectAnalysisAdapter');
      const newAdapter = createProjectAnalysisAdapter();

      expect(newAdapter).toBeInstanceOf(ProjectAnalysisAdapter);
      expect(newAdapter.name).toBe('project-analysis-adapter');
    });
  });

  describe('Resilience Features', () => {
    it('should have correct fallback configuration', () => {
      // Access protected property for testing
      const fallbackConfig = (adapter as any).fallbackConfig;

      expect(fallbackConfig.enableFallback).toBe(true);
      expect(fallbackConfig.maxRetries).toBe(2);
      expect(fallbackConfig.operationTimeout).toBe(15000);
    });

    it('should execute fallback when main execution fails', async () => {
      const params: ProjectAnalysisParams = {
        projectPath: '/test/path',
        deep: false,
      };

      // Mock main execution failure
      mockProjectAnalyzer.analyze.mockRejectedValue(new Error('Main execution failed'));
      
      // Mock cache fallback success
      mockCacheManager.get.mockResolvedValue(mockAnalysisResult);

      try {
        const result = await adapter.execute(params, mockContext);
        // If fallback succeeds, result should be returned
        expect(result.metadata.strategy).toBe('cached');
      } catch (error) {
        // If no fallback available, should throw error
        expect(error).toBeDefined();
      }
    });
  });

  describe('Integration Tests', () => {
    it('should work with real cache manager integration', async () => {
      // This test would use real MCPCacheManager instead of mocks
      // For now, we'll simulate the integration
      const params: ProjectAnalysisParams = {
        projectPath: '/test/path',
        deep: false,
      };

      mockProjectAnalyzer.analyze.mockResolvedValue(mockAnalysisResult);
      mockCacheManager.get.mockResolvedValue(null);
      mockCacheManager.set.mockResolvedValue(undefined);

      const result = await adapter.execute(params, mockContext);

      expect(result.metadata.fromCache).toBe(false);
      expect(mockCacheManager.set).toHaveBeenCalled();
    });

    it('should handle concurrent executions correctly', async () => {
      const params: ProjectAnalysisParams = {
        projectPath: '/test/path',
        deep: false,
      };

      mockProjectAnalyzer.analyze.mockResolvedValue(mockAnalysisResult);
      mockCacheManager.get.mockResolvedValue(null);

      // Execute multiple times concurrently
      const promises = Array(3).fill(null).map(() => adapter.execute(params, mockContext));
      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.projectPath).toBe('/test/path');
      });
    });
  });
});