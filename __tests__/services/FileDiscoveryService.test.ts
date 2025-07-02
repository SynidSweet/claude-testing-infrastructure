/**
 * Tests for FileDiscoveryService
 * 
 * Validates file discovery with different types, cache integration,
 * language filtering, and performance characteristics.
 */

import { promises as fs } from 'fs';
import path from 'path';
import { FileDiscoveryServiceImpl } from '../../src/services/FileDiscoveryService';
import { FileDiscoveryType } from '../../src/types/file-discovery-types';
import type { FileDiscoveryConfig, ConfigurationService } from '../../src/services/FileDiscoveryService';

// Mock fast-glob
jest.mock('fast-glob', () => {
  return jest.fn().mockImplementation((patterns, options) => {
    // Return mock files based on patterns
    const mockFiles = [
      'src/component.js',
      'src/component.ts',
      'src/utils.py',
      'src/component.test.js',
      'dist/built.js',
      'node_modules/package/index.js',
    ];

    // Simple filtering based on ignore patterns
    const ignored = options.ignore || [];
    const filtered = mockFiles.filter(file => {
      return !ignored.some((pattern: string) => {
        // Simple pattern matching for tests
        if (pattern.includes('node_modules')) return file.includes('node_modules');
        if (pattern.includes('dist')) return file.includes('dist');
        if (pattern.includes('.test.')) return file.includes('.test.');
        return false;
      });
    });

    // Apply include patterns
    if (patterns.some((p: string) => p.includes('*.js'))) {
      return Promise.resolve(filtered.filter(f => f.endsWith('.js')));
    }
    if (patterns.some((p: string) => p.includes('*.ts'))) {
      return Promise.resolve(filtered.filter(f => f.endsWith('.ts')));
    }
    if (patterns.some((p: string) => p.includes('*.py'))) {
      return Promise.resolve(filtered.filter(f => f.endsWith('.py')));
    }

    return Promise.resolve(filtered);
  });
});

// Mock fs operations
jest.mock('fs', () => ({
  promises: {
    access: jest.fn(),
    stat: jest.fn(),
  },
}));

const mockFs = fs as jest.Mocked<typeof fs>;

describe('FileDiscoveryService', () => {
  let service: FileDiscoveryServiceImpl;
  let mockConfigService: jest.Mocked<ConfigurationService>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockConfigService = {
      getFileDiscoveryConfig: jest.fn().mockReturnValue({
        cache: {
          enabled: true,
          ttl: 300000,
          maxSize: 1000,
        },
        patterns: {},
        performance: {
          enableStats: false,
          logSlowOperations: true,
          slowThresholdMs: 1000,
        },
      } as FileDiscoveryConfig),
    };

    service = new FileDiscoveryServiceImpl(mockConfigService);

    // Mock directory exists by default
    mockFs.stat.mockResolvedValue({
      isDirectory: () => true,
    } as any);
  });

  describe('findFiles', () => {
    it('should find files for project analysis', async () => {
      const result = await service.findFiles({
        baseDir: '/test/project',
        type: FileDiscoveryType.PROJECT_ANALYSIS,
      });

      expect(result.files).toEqual(['src/component.js', 'src/component.ts', 'src/utils.py']);
      expect(result.fromCache).toBe(false);
      expect(result.duration).toBeGreaterThan(0);
      expect(result.stats.included).toBe(3);
    });

    it('should apply exclude patterns', async () => {
      const result = await service.findFiles({
        baseDir: '/test/project',
        type: FileDiscoveryType.PROJECT_ANALYSIS,
        exclude: ['**/*.py'],
      });

      expect(result.files).not.toContain('src/utils.py');
    });

    it('should apply language filtering', async () => {
      const result = await service.findFiles({
        baseDir: '/test/project',
        type: FileDiscoveryType.PROJECT_ANALYSIS,
        languages: ['javascript'],
      });

      expect(result.files).toEqual(['src/component.js']);
      expect(result.files).not.toContain('src/component.ts');
      expect(result.files).not.toContain('src/utils.py');
    });

    it('should handle multiple languages', async () => {
      const result = await service.findFiles({
        baseDir: '/test/project',
        type: FileDiscoveryType.PROJECT_ANALYSIS,
        languages: ['javascript', 'typescript'],
      });

      expect(result.files).toContain('src/component.js');
      expect(result.files).toContain('src/component.ts');
      expect(result.files).not.toContain('src/utils.py');
    });

    it('should handle non-existent directory', async () => {
      mockFs.stat.mockRejectedValue(new Error('ENOENT'));

      const result = await service.findFiles({
        baseDir: '/non/existent',
        type: FileDiscoveryType.PROJECT_ANALYSIS,
      });

      expect(result.files).toEqual([]);
      expect(result.stats.totalScanned).toBe(0);
    });

    it('should use cache for repeated requests', async () => {
      const request = {
        baseDir: '/test/project',
        type: FileDiscoveryType.PROJECT_ANALYSIS,
      };

      // First request
      const result1 = await service.findFiles(request);
      expect(result1.fromCache).toBe(false);

      // Second request should use cache
      const result2 = await service.findFiles(request);
      expect(result2.fromCache).toBe(true);
      expect(result2.files).toEqual(result1.files);
      expect(result2.duration).toBe(0); // Cache access is instant
    });

    it('should skip cache when useCache is false', async () => {
      const request = {
        baseDir: '/test/project',
        type: FileDiscoveryType.PROJECT_ANALYSIS,
        useCache: false,
      };

      // First request
      const result1 = await service.findFiles(request);
      expect(result1.fromCache).toBe(false);

      // Second request should not use cache
      const result2 = await service.findFiles(request);
      expect(result2.fromCache).toBe(false);
    });

    it('should handle custom include patterns', async () => {
      const result = await service.findFiles({
        baseDir: '/test/project',
        type: FileDiscoveryType.CUSTOM,
        include: ['**/*.js'],
      });

      expect(result.files).toEqual(['src/component.js']);
    });
  });

  describe('findTestFiles', () => {
    it('should find test files with default patterns', async () => {
      const testFiles = await service.findTestFiles('/test/project');

      expect(testFiles).toContain('src/component.test.js');
    });

    it('should find test files for specific framework', async () => {
      const testFiles = await service.findTestFiles('/test/project', 'jest');

      expect(testFiles).toContain('src/component.test.js');
    });

    it('should handle unknown framework', async () => {
      const testFiles = await service.findTestFiles('/test/project', 'unknown');

      // Should fallback to jest patterns
      expect(testFiles).toContain('src/component.test.js');
    });
  });

  describe('fileExists', () => {
    it('should return true for existing files', async () => {
      mockFs.access.mockResolvedValue(undefined);

      const exists = await service.fileExists('/test/file.js');

      expect(exists).toBe(true);
      expect(mockFs.access).toHaveBeenCalledWith('/test/file.js');
    });

    it('should return false for non-existent files', async () => {
      mockFs.access.mockRejectedValue(new Error('ENOENT'));

      const exists = await service.fileExists('/test/nonexistent.js');

      expect(exists).toBe(false);
    });
  });

  describe('cache operations', () => {
    it('should invalidate cache by pattern', () => {
      service.invalidateCache('/test/project');

      // Should not throw error
      expect(() => service.getCacheStats()).not.toThrow();
    });

    it('should clear all cache', () => {
      service.invalidateCache();

      const stats = service.getCacheStats();
      expect(stats.cacheSize).toBe(0);
    });

    it('should provide cache statistics', () => {
      const stats = service.getCacheStats();

      expect(stats).toHaveProperty('totalRequests');
      expect(stats).toHaveProperty('cacheHits');
      expect(stats).toHaveProperty('cacheMisses');
      expect(stats).toHaveProperty('hitRate');
      expect(stats).toHaveProperty('cacheSize');
    });
  });

  describe('configuration integration', () => {
    it('should use configuration service patterns', async () => {
      mockConfigService.getFileDiscoveryConfig.mockReturnValue({
        cache: { enabled: true, ttl: 300000, maxSize: 1000 },
        patterns: {
          projectAnalysis: {
            additionalExcludes: ['**/custom-exclude/**'],
          },
        },
        performance: {
          enableStats: false,
          logSlowOperations: true,
          slowThresholdMs: 1000,
        },
      });

      // Create new service with updated config
      const configuredService = new FileDiscoveryServiceImpl(mockConfigService);

      const result = await configuredService.findFiles({
        baseDir: '/test/project',
        type: FileDiscoveryType.PROJECT_ANALYSIS,
      });

      // Should apply configuration patterns
      expect(result).toBeDefined();
    });

    it('should work without configuration service', () => {
      const serviceWithoutConfig = new FileDiscoveryServiceImpl();

      expect(() => serviceWithoutConfig.getCacheStats()).not.toThrow();
    });

    it('should disable cache when configured', async () => {
      mockConfigService.getFileDiscoveryConfig.mockReturnValue({
        cache: { enabled: false, ttl: 300000, maxSize: 1000 },
        patterns: {},
        performance: {
          enableStats: false,
          logSlowOperations: true,
          slowThresholdMs: 1000,
        },
      });

      const disabledCacheService = new FileDiscoveryServiceImpl(mockConfigService);

      const request = {
        baseDir: '/test/project',
        type: FileDiscoveryType.PROJECT_ANALYSIS,
      };

      // Two identical requests
      const result1 = await disabledCacheService.findFiles(request);
      const result2 = await disabledCacheService.findFiles(request);

      // Both should show fromCache: false
      expect(result1.fromCache).toBe(false);
      expect(result2.fromCache).toBe(false);
    });
  });

  describe('performance monitoring', () => {
    it('should log slow operations when configured', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      mockConfigService.getFileDiscoveryConfig.mockReturnValue({
        cache: { enabled: true, ttl: 300000, maxSize: 1000 },
        patterns: {},
        performance: {
          enableStats: true,
          logSlowOperations: true,
          slowThresholdMs: 0, // Very low threshold to trigger warning
        },
      });

      const monitoredService = new FileDiscoveryServiceImpl(mockConfigService);

      await monitoredService.findFiles({
        baseDir: '/test/project',
        type: FileDiscoveryType.PROJECT_ANALYSIS,
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Slow file discovery operation')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('error handling', () => {
    it('should handle fast-glob errors gracefully', async () => {
      const fg = require('fast-glob');
      fg.mockRejectedValueOnce(new Error('Glob error'));

      const result = await service.findFiles({
        baseDir: '/test/project',
        type: FileDiscoveryType.PROJECT_ANALYSIS,
      });

      expect(result.files).toEqual([]);
      expect(result.stats.totalScanned).toBe(0);
    });
  });
});