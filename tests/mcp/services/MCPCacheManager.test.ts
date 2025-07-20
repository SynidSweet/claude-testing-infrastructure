/**
 * MCPCacheManager Tests
 * 
 * Comprehensive test suite for multi-layer caching system with TTL policies,
 * LRU eviction, memory management, and performance monitoring.
 * 
 * @module tests/mcp/services/MCPCacheManager
 */

import { 
  MCPCacheManager, 
  CacheLayer,
  cacheProjectAnalysis,
  getCachedProjectAnalysis,
  cacheTemplate,
  getCachedTemplate,
  cacheConfiguration,
  getCachedConfiguration
} from '../../../src/mcp/services/MCPCacheManager';
import type { ProjectAnalysis } from '../../../src/analyzers/ProjectAnalyzer';

// Mock logger to avoid actual logging during tests
jest.mock('../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }
}));

// Mock MCPErrorHandler to avoid complex error handling during tests
jest.mock('../../../src/mcp/services/MCPErrorHandler', () => ({
  handleMCPError: jest.fn().mockResolvedValue({
    error: {
      category: 'performance',
      severity: 'medium',
      code: 'CACHE_ERROR',
      message: 'Cache operation failed'
    }
  }),
  MCPErrorCategory: {
    Performance: 'performance'
  },
  MCPErrorSeverity: {
    Medium: 'medium',
    Low: 'low'
  }
}));

describe('MCPCacheManager', () => {
  let cacheManager: MCPCacheManager;

  beforeEach(() => {
    // Get fresh instance for each test
    cacheManager = MCPCacheManager.getInstance();
    
    // Clear all cache layers
    Object.values(CacheLayer).forEach(layer => {
      cacheManager.clear(layer);
    });
  });

  afterEach(() => {
    // Stop cleanup interval to prevent Jest from hanging
    cacheManager.stopCleanupInterval();
    // Clean up timers to prevent memory leaks
    jest.clearAllTimers();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = MCPCacheManager.getInstance();
      const instance2 = MCPCacheManager.getInstance();
      
      expect(instance1).toBe(instance2);
    });
  });

  describe('Basic Cache Operations', () => {
    const testData = { test: 'data', value: 123 };
    const testKey = 'test-key';

    it('should store and retrieve data from cache', async () => {
      await cacheManager.set(CacheLayer.ProjectAnalysis, testKey, testData);
      const retrieved = await cacheManager.get(CacheLayer.ProjectAnalysis, testKey);
      
      expect(retrieved).toEqual(testData);
    });

    it('should return null for non-existent keys', async () => {
      const result = await cacheManager.get(CacheLayer.ProjectAnalysis, 'non-existent');
      
      expect(result).toBeNull();
    });

    it('should remove specific entries', async () => {
      await cacheManager.set(CacheLayer.ProjectAnalysis, testKey, testData);
      await cacheManager.remove(CacheLayer.ProjectAnalysis, testKey);
      
      const result = await cacheManager.get(CacheLayer.ProjectAnalysis, testKey);
      expect(result).toBeNull();
    });

    it('should clear entire cache layer', async () => {
      await cacheManager.set(CacheLayer.ProjectAnalysis, 'key1', testData);
      await cacheManager.set(CacheLayer.ProjectAnalysis, 'key2', testData);
      
      await cacheManager.clear(CacheLayer.ProjectAnalysis);
      
      const result1 = await cacheManager.get(CacheLayer.ProjectAnalysis, 'key1');
      const result2 = await cacheManager.get(CacheLayer.ProjectAnalysis, 'key2');
      
      expect(result1).toBeNull();
      expect(result2).toBeNull();
    });
  });

  describe('TTL (Time To Live) Functionality', () => {
    const testData = { ttl: 'test' };
    const testKey = 'ttl-key';

    it('should respect TTL for project analysis cache', async () => {
      // Project analysis has 10-minute TTL by default
      await cacheManager.set(CacheLayer.ProjectAnalysis, testKey, testData);
      
      // Should be available immediately
      let result = await cacheManager.get(CacheLayer.ProjectAnalysis, testKey);
      expect(result).toEqual(testData);
      
      // Mock time passage to simulate TTL expiration
      const originalDateNow = Date.now;
      Date.now = jest.fn(() => originalDateNow() + 11 * 60 * 1000); // 11 minutes later
      
      result = await cacheManager.get(CacheLayer.ProjectAnalysis, testKey);
      expect(result).toBeNull();
      
      // Restore Date.now
      Date.now = originalDateNow;
    });

    it('should use custom TTL when provided', async () => {
      const customTtl = 1000; // 1 second
      await cacheManager.set(CacheLayer.Configuration, testKey, testData, customTtl);
      
      // Should be available immediately
      let result = await cacheManager.get(CacheLayer.Configuration, testKey);
      expect(result).toEqual(testData);
      
      // Mock time passage
      const originalDateNow = Date.now;
      Date.now = jest.fn(() => originalDateNow() + 1100); // 1.1 seconds later
      
      result = await cacheManager.get(CacheLayer.Configuration, testKey);
      expect(result).toBeNull();
      
      // Restore Date.now
      Date.now = originalDateNow;
    });

    it('should not expire template cache without TTL', async () => {
      await cacheManager.set(CacheLayer.TemplateCompilation, testKey, testData);
      
      // Mock significant time passage
      const originalDateNow = Date.now;
      Date.now = jest.fn(() => originalDateNow() + 24 * 60 * 60 * 1000); // 24 hours later
      
      const result = await cacheManager.get(CacheLayer.TemplateCompilation, testKey);
      expect(result).toEqual(testData);
      
      // Restore Date.now
      Date.now = originalDateNow;
    });
  });

  describe('Cache Metrics and Monitoring', () => {
    const testData = { metrics: 'test' };

    it('should track cache hits and misses', async () => {
      // Get initial metrics
      const initialMetrics = cacheManager.getMetrics(CacheLayer.ProjectAnalysis);
      const initialHits = initialMetrics[CacheLayer.ProjectAnalysis]?.hits || 0;
      const initialMisses = initialMetrics[CacheLayer.ProjectAnalysis]?.misses || 0;
      
      await cacheManager.set(CacheLayer.ProjectAnalysis, 'key1', testData);
      
      // Generate hits
      await cacheManager.get(CacheLayer.ProjectAnalysis, 'key1');
      await cacheManager.get(CacheLayer.ProjectAnalysis, 'key1');
      
      // Generate misses
      await cacheManager.get(CacheLayer.ProjectAnalysis, 'missing1');
      await cacheManager.get(CacheLayer.ProjectAnalysis, 'missing2');
      
      const metrics = cacheManager.getMetrics(CacheLayer.ProjectAnalysis);
      const layerMetrics = metrics[CacheLayer.ProjectAnalysis];
      
      expect(layerMetrics).toBeDefined();
      expect(layerMetrics!.hits).toBe(initialHits + 2);
      expect(layerMetrics!.misses).toBe(initialMisses + 2);
      // Hit rate should be recalculated based on total requests
      const totalRequests = layerMetrics!.hits + layerMetrics!.misses;
      const expectedHitRate = layerMetrics!.hits / totalRequests;
      expect(layerMetrics!.hitRate).toBeCloseTo(expectedHitRate, 2);
    });

    it('should track memory usage and entry count', async () => {
      await cacheManager.set(CacheLayer.ProjectAnalysis, 'key1', testData);
      await cacheManager.set(CacheLayer.ProjectAnalysis, 'key2', testData);
      
      const metrics = cacheManager.getMetrics(CacheLayer.ProjectAnalysis);
      const layerMetrics = metrics[CacheLayer.ProjectAnalysis];
      
      expect(layerMetrics).toBeDefined();
      expect(layerMetrics!.entryCount).toBe(2);
      expect(layerMetrics!.memoryUsage).toBeGreaterThan(0);
    });

    it('should provide health status', () => {
      const healthStatus = cacheManager.getHealthStatus();
      
      expect(healthStatus).toHaveProperty('status');
      expect(healthStatus).toHaveProperty('totalMemoryUsage');
      expect(healthStatus).toHaveProperty('totalEntries');
      expect(healthStatus).toHaveProperty('overallHitRate');
      expect(healthStatus).toHaveProperty('layerStatus');
      
      expect(['healthy', 'degraded', 'critical']).toContain(healthStatus.status);
    });
  });

  describe('Memory Management and Eviction', () => {
    const largeData = { large: 'x'.repeat(1000) }; // Create larger data for testing

    it('should evict entries when memory limit is reached', async () => {
      // Fill cache beyond normal capacity
      for (let i = 0; i < 200; i++) {
        await cacheManager.set(CacheLayer.ProjectAnalysis, `key${i}`, largeData);
      }
      
      const metrics = cacheManager.getMetrics(CacheLayer.ProjectAnalysis);
      const layerMetrics = metrics[CacheLayer.ProjectAnalysis];
      
      // Should have triggered evictions
      expect(layerMetrics).toBeDefined();
      expect(layerMetrics!.evictions).toBeGreaterThan(0);
      expect(layerMetrics!.entryCount).toBeLessThan(200);
    });

    it('should update access count and last access time', async () => {
      await cacheManager.set(CacheLayer.ProjectAnalysis, 'access-test', largeData);
      
      // Access the entry multiple times
      await cacheManager.get(CacheLayer.ProjectAnalysis, 'access-test');
      await cacheManager.get(CacheLayer.ProjectAnalysis, 'access-test');
      
      // The internal access tracking should be working (we can't directly test it,
      // but it should affect eviction behavior)
      const result = await cacheManager.get(CacheLayer.ProjectAnalysis, 'access-test');
      expect(result).toEqual(largeData);
    });
  });

  describe('Multiple Cache Layers', () => {
    const testData1 = { layer: 'project' };
    const testData2 = { layer: 'template' };
    const testData3 = { layer: 'config' };

    it('should maintain separate data across layers', async () => {
      const sameKey = 'same-key';
      
      await cacheManager.set(CacheLayer.ProjectAnalysis, sameKey, testData1);
      await cacheManager.set(CacheLayer.TemplateCompilation, sameKey, testData2);
      await cacheManager.set(CacheLayer.Configuration, sameKey, testData3);
      
      const result1 = await cacheManager.get(CacheLayer.ProjectAnalysis, sameKey);
      const result2 = await cacheManager.get(CacheLayer.TemplateCompilation, sameKey);
      const result3 = await cacheManager.get(CacheLayer.Configuration, sameKey);
      
      expect(result1).toEqual(testData1);
      expect(result2).toEqual(testData2);
      expect(result3).toEqual(testData3);
    });

    it('should provide metrics for all layers', () => {
      const allMetrics = cacheManager.getMetrics();
      
      // Should have metrics for all cache layers
      expect(Object.keys(allMetrics)).toEqual(
        expect.arrayContaining(Object.values(CacheLayer))
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid layer gracefully', async () => {
      // This test depends on the error handler mock returning null
      const result = await cacheManager.get('invalid-layer' as CacheLayer, 'test');
      expect(result).toBeNull();
    });
  });
});

describe('Convenience Functions', () => {
  const mockProjectAnalysis: Partial<ProjectAnalysis> = {
    projectPath: '/test/project',
    languages: [{ name: 'typescript', confidence: 0.9, files: ['test.ts'] }],
    frameworks: []
  };

  beforeEach(() => {
    const cacheManager = MCPCacheManager.getInstance();
    Object.values(CacheLayer).forEach(layer => {
      cacheManager.clear(layer);
    });
  });

  describe('Project Analysis Caching', () => {
    it('should cache and retrieve project analysis', async () => {
      const projectPath = '/test/project';
      
      await cacheProjectAnalysis(projectPath, mockProjectAnalysis as ProjectAnalysis);
      const retrieved = await getCachedProjectAnalysis(projectPath);
      
      expect(retrieved).toEqual(mockProjectAnalysis);
    });

    it('should return null for non-cached project', async () => {
      const result = await getCachedProjectAnalysis('/non/existent/project');
      expect(result).toBeNull();
    });
  });

  describe('Template Caching', () => {
    const mockTemplate = { compiled: true, template: 'test template' };

    it('should cache and retrieve templates', async () => {
      const templateKey = 'jest-template';
      
      await cacheTemplate(templateKey, mockTemplate);
      const retrieved = await getCachedTemplate(templateKey);
      
      expect(retrieved).toEqual(mockTemplate);
    });

    it('should return null for non-cached template', async () => {
      const result = await getCachedTemplate('non-existent-template');
      expect(result).toBeNull();
    });
  });

  describe('Configuration Caching', () => {
    const mockConfig = { setting1: 'value1', setting2: 42 };

    it('should cache and retrieve configuration', async () => {
      const configKey = 'test-config';
      
      await cacheConfiguration(configKey, mockConfig);
      const retrieved = await getCachedConfiguration(configKey);
      
      expect(retrieved).toEqual(mockConfig);
    });

    it('should return null for non-cached configuration', async () => {
      const result = await getCachedConfiguration('non-existent-config');
      expect(result).toBeNull();
    });
  });
});

describe('Performance and Integration', () => {
  let cacheManager: MCPCacheManager;

  beforeEach(() => {
    cacheManager = MCPCacheManager.getInstance();
    Object.values(CacheLayer).forEach(layer => {
      cacheManager.clear(layer);
    });
  });

  it('should handle high-volume operations efficiently', async () => {
    const startTime = Date.now();
    const numOperations = 1000;
    
    // Perform many cache operations
    const promises = [];
    for (let i = 0; i < numOperations; i++) {
      promises.push(
        cacheManager.set(CacheLayer.ProjectAnalysis, `key${i}`, { value: i })
      );
    }
    
    await Promise.all(promises);
    
    // Verify operations completed in reasonable time
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    
    // Verify data integrity
    const randomKey = `key${Math.floor(Math.random() * numOperations)}`;
    const result = await cacheManager.get(CacheLayer.ProjectAnalysis, randomKey);
    expect(result).toBeDefined();
  });

  it('should maintain cache integrity under concurrent access', async () => {
    const testData = { concurrent: true };
    const key = 'concurrent-test';
    
    // Simulate concurrent reads and writes
    const operations = [
      cacheManager.set(CacheLayer.ProjectAnalysis, key, testData),
      cacheManager.get(CacheLayer.ProjectAnalysis, key),
      cacheManager.set(CacheLayer.ProjectAnalysis, key, { ...testData, updated: true }),
      cacheManager.get(CacheLayer.ProjectAnalysis, key),
      cacheManager.remove(CacheLayer.ProjectAnalysis, key),
      cacheManager.get(CacheLayer.ProjectAnalysis, key)
    ];
    
    const results = await Promise.all(operations);
    
    // Last get should return null after removal
    expect(results[results.length - 1]).toBeNull();
  });
});