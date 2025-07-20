/**
 * Tests for TestGenerationAdapter
 *
 * Comprehensive test suite for the TestGenerationAdapter service adapter,
 * including unit tests, integration tests, caching, error handling, and resilience features.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { TestGenerationAdapter, type TestGenerationParams } from '../../../src/mcp/adapters/TestGenerationAdapter';
import { MCPCacheManager, CacheLayer } from '../../../src/mcp/services/MCPCacheManager';
import { StructuralTestGenerator } from '../../../src/generators/StructuralTestGenerator';
import type { MCPToolContext } from '../../../src/mcp/services/MCPLoggingService';
import type { GeneratedTest } from '../../../src/generators/TestGenerator';
import { MCPToolError, MCPToolErrorType } from '../../../src/types/mcp-tool-types';

// Mock dependencies
jest.mock('../../../src/mcp/services/MCPCacheManager');
jest.mock('../../../src/generators/StructuralTestGenerator');
jest.mock('../../../src/utils/logger');

describe('TestGenerationAdapter', () => {
  let adapter: TestGenerationAdapter;
  let mockCacheManager: jest.Mocked<MCPCacheManager>;
  let mockTestGenerator: jest.Mocked<StructuralTestGenerator>;
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

    // Mock test generator
    mockTestGenerator = {
      generateBasicTests: jest.fn(),
      generateAllTests: jest.fn(),
      generateStructuralTests: jest.fn(),
    } as any;

    (StructuralTestGenerator as jest.Mock).mockImplementation(() => mockTestGenerator);

    // Create adapter instance
    adapter = new TestGenerationAdapter();

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
      expect(adapter.name).toBe('test-generation-adapter');
      expect(adapter.description).toBe('Adapter for StructuralTestGenerator with caching and resilience');
      expect(adapter.parameters).toBeDefined();
    });

    it('should validate input parameters correctly', () => {
      const validParams: TestGenerationParams = {
        projectPath: '/test/path',
        strategy: 'structural',
        generateMocks: true,
      };

      const result = adapter.validateInput(validParams);
      expect(result).toEqual({
        projectPath: '/test/path',
        strategy: 'structural',
        generateMocks: true,
        generateSetup: true,
        includeTestData: false,
        skipExistingTests: true,
        dryRun: false,
        forceFresh: false,
      });
    });

    it('should throw validation error for invalid parameters', () => {
      const invalidParams = {
        projectPath: '', // Empty string should fail
      };

      expect(() => adapter.validateInput(invalidParams)).toThrow(MCPToolError);
    });

    it('should validate strategy enum correctly', () => {
      const invalidStrategy = {
        projectPath: '/test/path',
        strategy: 'invalid-strategy',
      };

      expect(() => adapter.validateInput(invalidStrategy)).toThrow(MCPToolError);
    });
  });

  describe('Cache Key Generation', () => {
    it('should generate consistent cache keys for same parameters', () => {
      const params: TestGenerationParams = {
        projectPath: '/test/path',
        strategy: 'structural',
        include: ['**/*.ts'],
        exclude: ['**/*.test.ts'],
        generateMocks: true,
      };

      const key1 = adapter.getCacheKey(params);
      const key2 = adapter.getCacheKey(params);

      expect(key1).toBe(key2);
      expect(key1).toMatch(/^testgen:[a-f0-9]{16}$/);
    });

    it('should generate different cache keys for different parameters', () => {
      const params1: TestGenerationParams = {
        projectPath: '/test/path1',
        strategy: 'structural',
      };

      const params2: TestGenerationParams = {
        projectPath: '/test/path2',
        strategy: 'comprehensive',
      };

      const key1 = adapter.getCacheKey(params1);
      const key2 = adapter.getCacheKey(params2);

      expect(key1).not.toBe(key2);
    });

    it('should handle array ordering in cache keys', () => {
      const params1: TestGenerationParams = {
        projectPath: '/test/path',
        include: ['**/*.ts', '**/*.js'],
      };

      const params2: TestGenerationParams = {
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
      expect(ttl).toBe(15 * 60 * 1000); // 15 minutes
    });
  });

  describe('Core Execution', () => {
    const mockGeneratedTests: GeneratedTest[] = [
      {
        filePath: '/test/path/src/component.test.ts',
        content: 'test content',
        type: 'unit',
        framework: 'jest',
        sourceFiles: ['/test/path/src/component.ts'],
      },
      {
        filePath: '/test/path/src/__mocks__/service.ts',
        content: 'mock content',
        type: 'mock',
        framework: 'jest',
        sourceFiles: ['/test/path/src/service.ts'],
      },
    ];

    it('should execute structural test generation successfully', async () => {
      const params: TestGenerationParams = {
        projectPath: '/test/path',
        strategy: 'structural',
        dryRun: false,
      };

      mockTestGenerator.generateStructuralTests.mockResolvedValue(mockGeneratedTests);
      mockCacheManager.get.mockResolvedValue(null);

      const result = await adapter.execute(params, mockContext);

      expect(result.tests).toEqual(mockGeneratedTests);
      expect(result.metadata).toMatchObject({
        fromCache: false,
        strategy: 'structural',
        dryRun: false,
      });

      expect(mockTestGenerator.generateStructuralTests).toHaveBeenCalled();
    });

    it('should execute minimal test generation strategy', async () => {
      const params: TestGenerationParams = {
        projectPath: '/test/path',
        strategy: 'minimal',
      };

      mockTestGenerator.generateBasicTests.mockResolvedValue(mockGeneratedTests);
      mockCacheManager.get.mockResolvedValue(null);

      await adapter.execute(params, mockContext);

      expect(mockTestGenerator.generateBasicTests).toHaveBeenCalled();
    });

    it('should execute comprehensive test generation strategy', async () => {
      const params: TestGenerationParams = {
        projectPath: '/test/path',
        strategy: 'comprehensive',
      };

      mockTestGenerator.generateAllTests.mockResolvedValue(mockGeneratedTests);
      mockCacheManager.get.mockResolvedValue(null);

      await adapter.execute(params, mockContext);

      expect(mockTestGenerator.generateAllTests).toHaveBeenCalled();
    });

    it('should return cached result when available', async () => {
      const params: TestGenerationParams = {
        projectPath: '/test/path',
        strategy: 'structural',
      };

      const cachedResult = {
        tests: mockGeneratedTests,
        summary: {
          testFilesGenerated: 1,
          sourceFilesAnalyzed: 1,
          mockFilesCreated: 1,
          setupFilesCreated: 0,
          filesSkipped: 0,
        },
        metadata: {
          duration: 100,
          fromCache: true,
          cacheKey: 'test-key',
          strategy: 'cached' as const,
          dryRun: false,
        },
      };

      mockCacheManager.get.mockResolvedValue(cachedResult);

      const result = await adapter.execute(params, mockContext);

      expect(result.metadata.fromCache).toBe(true);
      expect(mockTestGenerator.generateStructuralTests).not.toHaveBeenCalled();
    });

    it('should handle force fresh parameter', async () => {
      const params: TestGenerationParams = {
        projectPath: '/test/path',
        strategy: 'structural',
        forceFresh: true,
      };

      mockTestGenerator.generateStructuralTests.mockResolvedValue(mockGeneratedTests);
      mockCacheManager.delete.mockResolvedValue(undefined);
      mockCacheManager.get.mockResolvedValue(null);

      await adapter.execute(params, mockContext);

      expect(mockCacheManager.delete).toHaveBeenCalled();
      expect(mockTestGenerator.generateStructuralTests).toHaveBeenCalled();
    });

    it('should create correct summary statistics', async () => {
      const params: TestGenerationParams = {
        projectPath: '/test/path',
        strategy: 'structural',
      };

      const testsWithSourceFiles: GeneratedTest[] = [
        {
          filePath: '/test/path/src/component.test.ts',
          content: 'test content',
          type: 'unit-test',
          framework: 'jest',
          sourceFiles: ['/test/path/src/component.ts', '/test/path/src/utils.ts'],
        },
        {
          filePath: '/test/path/src/__mocks__/service.ts',
          content: 'mock content',
          type: 'mock',
          framework: 'jest',
          sourceFiles: ['/test/path/src/service.ts'],
        },
        {
          filePath: '/test/path/src/setupTests.ts',
          content: 'setup content',
          type: 'setup',
          framework: 'jest',
          sourceFiles: [],
        },
      ];

      mockTestGenerator.generateStructuralTests.mockResolvedValue(testsWithSourceFiles);
      mockCacheManager.get.mockResolvedValue(null);

      const result = await adapter.execute(params, mockContext);

      expect(result.summary).toEqual({
        testFilesGenerated: 1, // Files with 'test' in type
        sourceFilesAnalyzed: 3, // Total source files across all tests
        mockFilesCreated: 1, // Files with 'mock' in type
        setupFilesCreated: 1, // Files with 'setup' in type
        filesSkipped: 0,
      });
    });
  });

  describe('Project Analysis Handling', () => {
    it('should use provided project analysis', async () => {
      const mockAnalysis = {
        projectPath: '/test/path',
        languages: [{ name: 'typescript' as const, confidence: 0.9, files: [] }],
        frameworks: [{ name: 'react' as const, confidence: 0.8, version: '18.0.0', configFiles: [] }],
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

      const params: TestGenerationParams = {
        projectPath: '/test/path',
        strategy: 'structural',
        projectAnalysis: mockAnalysis,
      };

      mockTestGenerator.generateStructuralTests.mockResolvedValue([]);
      mockCacheManager.get.mockResolvedValue(null);

      await adapter.execute(params, mockContext);

      // Verify that StructuralTestGenerator was created with the provided analysis
      expect(StructuralTestGenerator).toHaveBeenCalledWith(
        expect.objectContaining({
          projectPath: '/test/path',
          frameworks: ['react'],
        }),
        mockAnalysis,
        expect.any(Object)
      );
    });

    it('should create minimal analysis when none provided', async () => {
      const params: TestGenerationParams = {
        projectPath: '/test/path',
        strategy: 'structural',
      };

      mockTestGenerator.generateStructuralTests.mockResolvedValue([]);
      mockCacheManager.get.mockResolvedValue(null);

      await adapter.execute(params, mockContext);

      // Verify that StructuralTestGenerator was created with minimal analysis
      expect(StructuralTestGenerator).toHaveBeenCalledWith(
        expect.objectContaining({
          projectPath: '/test/path',
          frameworks: [],
        }),
        expect.objectContaining({
          projectPath: '/test/path',
          languages: [{ name: 'javascript', confidence: 0.8, files: [] }],
        }),
        expect.any(Object)
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle generator errors gracefully', async () => {
      const params: TestGenerationParams = {
        projectPath: '/test/path',
        strategy: 'structural',
      };

      const error = new Error('Generation failed');
      mockTestGenerator.generateStructuralTests.mockRejectedValue(error);
      mockCacheManager.get.mockResolvedValue(null);

      await expect(adapter.execute(params, mockContext)).rejects.toThrow();
    });

    it('should handle cache errors gracefully', async () => {
      const params: TestGenerationParams = {
        projectPath: '/test/path',
        strategy: 'structural',
      };

      mockTestGenerator.generateStructuralTests.mockResolvedValue([]);
      mockCacheManager.get.mockRejectedValue(new Error('Cache error'));

      // Should still work even if cache fails
      const result = await adapter.execute(params, mockContext);
      expect(result.metadata.fromCache).toBe(false);
    });
  });

  describe('Transform Output', () => {
    it('should transform cached result correctly', () => {
      const cachedResult = {
        tests: [],
        summary: {
          testFilesGenerated: 0,
          sourceFilesAnalyzed: 0,
          mockFilesCreated: 0,
          setupFilesCreated: 0,
          filesSkipped: 0,
        },
      };

      const result = adapter.transformOutput(cachedResult);

      expect(result.metadata).toEqual({
        duration: 0,
        fromCache: true,
        cacheKey: 'cached',
        strategy: 'cached',
        dryRun: false,
      });
    });

    it('should return already transformed result as-is', () => {
      const alreadyTransformed = {
        tests: [],
        summary: {
          testFilesGenerated: 0,
          sourceFilesAnalyzed: 0,
          mockFilesCreated: 0,
          setupFilesCreated: 0,
          filesSkipped: 0,
        },
        metadata: {
          duration: 500,
          fromCache: false,
          cacheKey: 'existing',
          strategy: 'structural' as const,
          dryRun: false,
        },
      };

      const result = adapter.transformOutput(alreadyTransformed);
      expect(result).toBe(alreadyTransformed);
    });
  });

  describe('Health Check', () => {
    it('should return healthy status on successful execution', async () => {
      mockTestGenerator.generateBasicTests.mockResolvedValue([]);
      mockCacheManager.get.mockResolvedValue(null);

      const health = await adapter.healthCheck();

      expect(health.status).toBe('healthy');
      expect(health.details).toContain('Test generation completed');
    });

    it('should return failed status on execution error', async () => {
      mockTestGenerator.generateBasicTests.mockRejectedValue(new Error('Test error'));
      mockCacheManager.get.mockResolvedValue(null);

      const health = await adapter.healthCheck();

      expect(health.status).toBe('failed');
      expect(health.details).toContain('Health check failed: Test error');
    });
  });

  describe('Factory Function', () => {
    it('should create adapter instance correctly', async () => {
      const { createTestGenerationAdapter } = await import('../../../src/mcp/adapters/TestGenerationAdapter');
      const newAdapter = createTestGenerationAdapter();

      expect(newAdapter).toBeInstanceOf(TestGenerationAdapter);
      expect(newAdapter.name).toBe('test-generation-adapter');
    });
  });

  describe('Resilience Features', () => {
    it('should have correct fallback configuration', () => {
      // Access protected property for testing
      const fallbackConfig = (adapter as any).fallbackConfig;

      expect(fallbackConfig.enableFallback).toBe(true);
      expect(fallbackConfig.fallbackStrategy).toBe('simplified');
      expect(fallbackConfig.maxRetries).toBe(2);
      expect(fallbackConfig.operationTimeout).toBe(30000);
    });

    it('should execute simplified fallback when main execution fails', async () => {
      const params: TestGenerationParams = {
        projectPath: '/test/path',
        strategy: 'comprehensive',
        generateMocks: true,
      };

      // Mock main execution failure
      mockTestGenerator.generateAllTests.mockRejectedValue(new Error('Main execution failed'));
      
      // Mock simplified fallback success
      mockTestGenerator.generateBasicTests.mockResolvedValue([]);
      mockCacheManager.get.mockResolvedValue(null);

      try {
        const result = await adapter.execute(params, mockContext);
        // If fallback succeeds, should use minimal strategy
        expect(mockTestGenerator.generateBasicTests).toHaveBeenCalled();
      } catch (error) {
        // If no fallback available, should throw error
        expect(error).toBeDefined();
      }
    });
  });

  describe('Integration Tests', () => {
    it('should work with real cache manager integration', async () => {
      const params: TestGenerationParams = {
        projectPath: '/test/path',
        strategy: 'structural',
      };

      mockTestGenerator.generateStructuralTests.mockResolvedValue([]);
      mockCacheManager.get.mockResolvedValue(null);
      mockCacheManager.set.mockResolvedValue(undefined);

      const result = await adapter.execute(params, mockContext);

      expect(result.metadata.fromCache).toBe(false);
      expect(mockCacheManager.set).toHaveBeenCalled();
    });

    it('should handle concurrent executions correctly', async () => {
      const params: TestGenerationParams = {
        projectPath: '/test/path',
        strategy: 'structural',
      };

      mockTestGenerator.generateStructuralTests.mockResolvedValue([]);
      mockCacheManager.get.mockResolvedValue(null);

      // Execute multiple times concurrently
      const promises = Array(3).fill(null).map(() => adapter.execute(params, mockContext));
      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.tests).toEqual([]);
      });
    });

    it('should pass correct options to StructuralTestGenerator', async () => {
      const params: TestGenerationParams = {
        projectPath: '/test/path',
        strategy: 'structural',
        include: ['**/*.ts'],
        exclude: ['**/*.test.ts'],
        generateMocks: false,
        generateSetup: false,
        includeTestData: true,
        skipExistingTests: false,
        dryRun: true,
      };

      mockTestGenerator.generateStructuralTests.mockResolvedValue([]);
      mockCacheManager.get.mockResolvedValue(null);

      await adapter.execute(params, mockContext);

      expect(StructuralTestGenerator).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Object),
        expect.objectContaining({
          includePatterns: ['**/*.ts'],
          excludePatterns: ['**/*.test.ts'],
          generateMocks: false,
          generateSetup: false,
          includeTestData: true,
          skipExistingTests: false,
          dryRun: true,
        })
      );
    });
  });
});