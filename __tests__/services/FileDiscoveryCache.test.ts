/**
 * Tests for FileDiscoveryCache
 * 
 * Validates cache hit/miss behavior, TTL expiration,
 * cache invalidation patterns, and memory management.
 */

import { MemoryFileDiscoveryCache, NullFileDiscoveryCache } from '../../src/services/FileDiscoveryCache';
import { FileDiscoveryType } from '../../src/types/file-discovery-types';
import type { CacheKey, FileDiscoveryResult } from '../../src/types/file-discovery-types';

describe('MemoryFileDiscoveryCache', () => {
  let cache: MemoryFileDiscoveryCache;
  let mockResult: FileDiscoveryResult;
  let mockKey: CacheKey;

  beforeEach(() => {
    cache = new MemoryFileDiscoveryCache({
      enabled: true,
      ttl: 1000, // 1 second for testing
      maxSize: 100,
    });

    mockResult = {
      files: ['src/file1.js', 'src/file2.js'],
      fromCache: false,
      duration: 250,
      stats: {
        totalScanned: 10,
        included: 2,
        excluded: 8,
        languageFiltered: 0,
      },
    };

    mockKey = {
      baseDir: '/test/project',
      include: ['**/*.js'],
      exclude: ['**/node_modules/**'],
      type: FileDiscoveryType.PROJECT_ANALYSIS,
      options: {
        absolute: false,
        includeDirectories: false,
      },
    };
  });

  describe('get and set operations', () => {
    it('should return null for cache miss', async () => {
      const result = await cache.get(mockKey);
      
      expect(result).toBeNull();
      
      const stats = cache.getStats();
      expect(stats.totalRequests).toBe(1);
      expect(stats.cacheMisses).toBe(1);
      expect(stats.cacheHits).toBe(0);
      expect(stats.hitRate).toBe(0);
    });

    it('should store and retrieve cached results', async () => {
      // Store result
      await cache.set(mockKey, mockResult);
      
      // Retrieve result
      const cached = await cache.get(mockKey);
      
      expect(cached).not.toBeNull();
      expect(cached!.result.files).toEqual(mockResult.files);
      expect(cached!.result.fromCache).toBe(true);
      expect(cached!.result.duration).toBe(0); // Cache access is instant
      
      const stats = cache.getStats();
      expect(stats.cacheHits).toBe(1);
      expect(stats.hitRate).toBe(1);
      expect(stats.totalSavedMs).toBe(250); // Original duration
    });

    it('should generate different keys for different requests', async () => {
      await cache.set(mockKey, mockResult);
      
      const differentKey = {
        ...mockKey,
        include: ['**/*.ts'], // Different include pattern
      };
      
      const result = await cache.get(differentKey);
      expect(result).toBeNull();
    });

    it('should generate same keys for equivalent requests', async () => {
      await cache.set(mockKey, mockResult);
      
      const equivalentKey = {
        ...mockKey,
        include: ['**/*.js'], // Same include pattern
        exclude: ['**/node_modules/**'], // Same exclude pattern
      };
      
      const result = await cache.get(equivalentKey);
      expect(result).not.toBeNull();
    });

    it('should handle array order independence in key generation', async () => {
      const key1 = {
        ...mockKey,
        include: ['**/*.js', '**/*.ts'],
        exclude: ['**/node_modules/**', '**/dist/**'],
      };
      
      const key2 = {
        ...mockKey,
        include: ['**/*.ts', '**/*.js'], // Different order
        exclude: ['**/dist/**', '**/node_modules/**'], // Different order
      };
      
      await cache.set(key1, mockResult);
      const result = await cache.get(key2);
      
      expect(result).not.toBeNull();
    });
  });

  describe('TTL expiration', () => {
    it('should expire entries after TTL', async () => {
      await cache.set(mockKey, mockResult);
      
      // Should be cached immediately
      let result = await cache.get(mockKey);
      expect(result).not.toBeNull();
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      // Should be expired
      result = await cache.get(mockKey);
      expect(result).toBeNull();
      
      const stats = cache.getStats();
      expect(stats.cacheSize).toBe(0); // Expired entry should be removed
    });

    it('should support custom TTL per entry', async () => {
      const shortTtl = 100; // 100ms
      await cache.set(mockKey, mockResult, shortTtl);
      
      // Wait for custom TTL expiration
      await new Promise(resolve => setTimeout(resolve, 150));
      
      const result = await cache.get(mockKey);
      expect(result).toBeNull();
    });
  });

  describe('cache invalidation', () => {
    beforeEach(async () => {
      // Set up multiple cache entries
      await cache.set(mockKey, mockResult);
      
      await cache.set({
        ...mockKey,
        baseDir: '/test/other-project',
      }, mockResult);
      
      await cache.set({
        ...mockKey,
        type: FileDiscoveryType.TEST_GENERATION,
      }, mockResult);
    });

    it('should invalidate entries by string pattern', async () => {
      await cache.invalidate('/test/project');
      
      // Entry with matching baseDir should be invalidated
      const result1 = await cache.get(mockKey);
      expect(result1).toBeNull();
      
      // Entry with different baseDir should remain
      const result2 = await cache.get({
        ...mockKey,
        baseDir: '/test/other-project',
      });
      expect(result2).not.toBeNull();
    });

    it('should invalidate entries by regex pattern', async () => {
      await cache.invalidate(/\/test\/.*/);
      
      // All entries with baseDir starting with /test/ should be invalidated
      const result1 = await cache.get(mockKey);
      expect(result1).toBeNull();
      
      const result2 = await cache.get({
        ...mockKey,
        baseDir: '/test/other-project',
      });
      expect(result2).toBeNull();
    });

    it('should clear all cache entries', async () => {
      await cache.clear();
      
      const stats = cache.getStats();
      expect(stats.cacheSize).toBe(0);
      
      // All entries should be gone
      const result1 = await cache.get(mockKey);
      expect(result1).toBeNull();
    });
  });

  describe('cache size management', () => {
    it('should track cache size', async () => {
      let stats = cache.getStats();
      expect(stats.cacheSize).toBe(0);
      
      await cache.set(mockKey, mockResult);
      
      stats = cache.getStats();
      expect(stats.cacheSize).toBe(1);
    });

    it('should evict oldest entries when max size reached', async () => {
      const smallCache = new MemoryFileDiscoveryCache({
        enabled: true,
        ttl: 60000,
        maxSize: 3,
      });
      
      // Fill cache to capacity
      for (let i = 0; i < 3; i++) {
        await smallCache.set({
          ...mockKey,
          baseDir: `/test/project-${i}`,
        }, mockResult);
      }
      
      expect(smallCache.getStats().cacheSize).toBe(3);
      
      // Add one more entry to trigger eviction
      await smallCache.set({
        ...mockKey,
        baseDir: '/test/project-new',
      }, mockResult);
      
      // Cache size should still be 3 (oldest entry evicted)
      expect(smallCache.getStats().cacheSize).toBe(3);
      
      // First entry should be evicted
      const firstResult = await smallCache.get({
        ...mockKey,
        baseDir: '/test/project-0',
      });
      expect(firstResult).toBeNull();
      
      // New entry should be present
      const newResult = await smallCache.get({
        ...mockKey,
        baseDir: '/test/project-new',
      });
      expect(newResult).not.toBeNull();
    });
  });

  describe('statistics tracking', () => {
    it('should track hit rate accurately', async () => {
      await cache.set(mockKey, mockResult);
      
      // One hit
      await cache.get(mockKey);
      
      // One miss
      await cache.get({
        ...mockKey,
        baseDir: '/different/path',
      });
      
      const stats = cache.getStats();
      expect(stats.totalRequests).toBe(2);
      expect(stats.cacheHits).toBe(1);
      expect(stats.cacheMisses).toBe(1);
      expect(stats.hitRate).toBe(0.5);
    });

    it('should track time saved by cache', async () => {
      await cache.set(mockKey, mockResult);
      await cache.get(mockKey);
      
      const stats = cache.getStats();
      expect(stats.totalSavedMs).toBe(250); // Duration from mockResult
    });

    it('should track entry timestamps', async () => {
      const beforeTime = new Date();
      await cache.set(mockKey, mockResult);
      const afterTime = new Date();
      
      const stats = cache.getStats();
      expect(stats.oldestEntry.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(stats.oldestEntry.getTime()).toBeLessThanOrEqual(afterTime.getTime());
      expect(stats.newestEntry.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(stats.newestEntry.getTime()).toBeLessThanOrEqual(afterTime.getTime());
    });
  });

  describe('disabled cache', () => {
    it('should not cache when disabled', async () => {
      const disabledCache = new MemoryFileDiscoveryCache({
        enabled: false,
        ttl: 1000,
        maxSize: 100,
      });
      
      await disabledCache.set(mockKey, mockResult);
      const result = await disabledCache.get(mockKey);
      
      expect(result).toBeNull();
      
      const stats = disabledCache.getStats();
      expect(stats.cacheSize).toBe(0);
      expect(stats.cacheMisses).toBe(1);
    });
  });
});

describe('NullFileDiscoveryCache', () => {
  let cache: NullFileDiscoveryCache;
  let mockResult: FileDiscoveryResult;
  let mockKey: CacheKey;

  beforeEach(() => {
    cache = new NullFileDiscoveryCache();

    mockResult = {
      files: ['src/file1.js'],
      fromCache: false,
      duration: 100,
      stats: {
        totalScanned: 5,
        included: 1,
        excluded: 4,
        languageFiltered: 0,
      },
    };

    mockKey = {
      baseDir: '/test/project',
      include: ['**/*.js'],
      exclude: ['**/node_modules/**'],
      type: FileDiscoveryType.PROJECT_ANALYSIS,
      options: {
        absolute: false,
        includeDirectories: false,
      },
    };
  });

  it('should never cache anything', async () => {
    await cache.set(mockKey, mockResult);
    const result = await cache.get(mockKey);
    
    expect(result).toBeNull();
  });

  it('should track misses but no hits', async () => {
    await cache.get(mockKey);
    await cache.get(mockKey);
    
    const stats = cache.getStats();
    expect(stats.totalRequests).toBe(2);
    expect(stats.cacheMisses).toBe(2);
    expect(stats.cacheHits).toBe(0);
    expect(stats.hitRate).toBe(0);
    expect(stats.cacheSize).toBe(0);
  });

  it('should handle invalidation and clear operations', async () => {
    await cache.invalidate('test');
    await cache.clear();
    
    // Should not throw errors
    expect(cache.getStats().cacheSize).toBe(0);
  });
});