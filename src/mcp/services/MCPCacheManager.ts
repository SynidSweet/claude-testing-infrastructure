/**
 * MCP Cache Manager
 * 
 * Multi-layer caching system for MCP tool performance optimization.
 * Provides project analysis caching, template compilation caching, and configuration caching
 * with TTL-based expiration, LRU eviction, and thread-safe operations.
 * 
 * Implements TASK-2025-177: Create MCPCacheManager for performance optimization
 * 
 * @module mcp/services/MCPCacheManager
 */

import { logger } from '../../utils/logger';
import { handleMCPError } from './MCPErrorHandler';
import type { ProjectAnalysis } from '../../analyzers/ProjectAnalyzer';

/**
 * Cache layer types for different data categories
 */
export enum CacheLayer {
  ProjectAnalysis = 'project_analysis',     // 10-minute TTL
  TemplateCompilation = 'template_compilation', // Indefinite (until restart)
  Configuration = 'configuration',          // 5-minute TTL
  Coverage = 'coverage',                    // 5-minute TTL
  Dependencies = 'dependencies',            // 30-minute TTL
  TestGeneration = 'test_generation',       // 15-minute TTL
  TestExecution = 'test_execution'          // 5-minute TTL
}

/**
 * Cache entry with metadata for expiration and access tracking
 */
interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  accessCount: number;
  lastAccess: number;
  ttl: number | undefined; // Time to live in milliseconds
  size: number; // Estimated memory size in bytes
}

/**
 * Cache layer configuration
 */
interface CacheLayerConfig {
  maxSize: number;           // Maximum number of entries
  ttl?: number;             // Default TTL in milliseconds
  maxMemory: number;        // Maximum memory usage in bytes
  evictionPolicy: 'lru' | 'lfu' | 'ttl'; // Eviction strategy
}

/**
 * Cache metrics for monitoring and optimization
 */
interface CacheMetrics {
  hits: number;
  misses: number;
  hitRate: number;
  evictions: number;
  memoryUsage: number;
  entryCount: number;
}

/**
 * Cache configuration for all layers
 */
const DEFAULT_CACHE_CONFIG: Record<CacheLayer, CacheLayerConfig> = {
  [CacheLayer.ProjectAnalysis]: {
    maxSize: 100,
    ttl: 10 * 60 * 1000, // 10 minutes
    maxMemory: 50 * 1024 * 1024, // 50MB
    evictionPolicy: 'lru'
  },
  [CacheLayer.TemplateCompilation]: {
    maxSize: 500,
    // ttl: undefined means indefinite - omit the property
    maxMemory: 100 * 1024 * 1024, // 100MB
    evictionPolicy: 'lfu'
  },
  [CacheLayer.Configuration]: {
    maxSize: 50,
    ttl: 5 * 60 * 1000, // 5 minutes
    maxMemory: 10 * 1024 * 1024, // 10MB
    evictionPolicy: 'ttl'
  },
  [CacheLayer.Coverage]: {
    maxSize: 200,
    ttl: 5 * 60 * 1000, // 5 minutes
    maxMemory: 30 * 1024 * 1024, // 30MB
    evictionPolicy: 'lru'
  },
  [CacheLayer.Dependencies]: {
    maxSize: 100,
    ttl: 30 * 60 * 1000, // 30 minutes
    maxMemory: 20 * 1024 * 1024, // 20MB
    evictionPolicy: 'lru'
  },
  [CacheLayer.TestGeneration]: {
    maxSize: 150,
    ttl: 15 * 60 * 1000, // 15 minutes
    maxMemory: 40 * 1024 * 1024, // 40MB
    evictionPolicy: 'lru'
  },
  [CacheLayer.TestExecution]: {
    maxSize: 100,
    ttl: 5 * 60 * 1000, // 5 minutes
    maxMemory: 25 * 1024 * 1024, // 25MB
    evictionPolicy: 'lru'
  }
};

/**
 * Multi-layer cache manager for MCP tools with performance optimization
 */
export class MCPCacheManager {
  private static instance: MCPCacheManager;
  private readonly caches: Map<CacheLayer, Map<string, CacheEntry>>;
  private readonly configs: Map<CacheLayer, CacheLayerConfig>;
  private readonly metrics: Map<CacheLayer, CacheMetrics>;
  private cleanupInterval?: NodeJS.Timeout;
  private constructor() {
    this.caches = new Map();
    this.configs = new Map();
    this.metrics = new Map();

    // Initialize cache layers
    this.initializeCacheLayers();

    // Start cleanup interval for expired entries
    this.startCleanupInterval();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): MCPCacheManager {
    if (!MCPCacheManager.instance) {
      MCPCacheManager.instance = new MCPCacheManager();
    }
    return MCPCacheManager.instance;
  }

  /**
   * Initialize all cache layers with default configurations
   */
  private initializeCacheLayers(): void {
    for (const [layer, config] of Object.entries(DEFAULT_CACHE_CONFIG)) {
      const cacheLayer = layer as CacheLayer;
      this.caches.set(cacheLayer, new Map());
      this.configs.set(cacheLayer, config);
      this.metrics.set(cacheLayer, {
        hits: 0,
        misses: 0,
        hitRate: 0,
        evictions: 0,
        memoryUsage: 0,
        entryCount: 0
      });
    }

    logger.info('MCPCacheManager: Initialized cache layers', {
      layers: Array.from(this.caches.keys()),
      totalMemoryLimit: this.getTotalMemoryLimit()
    });
  }

  /**
   * Get data from cache
   */
  public async get<T>(layer: CacheLayer, key: string): Promise<T | null> {
    try {
      const cache = this.caches.get(layer);
      const metrics = this.metrics.get(layer);
      
      if (!cache || !metrics) {
        throw new Error(`Cache layer ${layer} not found`);
      }

      const entry = cache.get(key);
      
      if (!entry) {
        metrics.misses++;
        this.updateHitRate(layer);
        return null;
      }

      // Check TTL expiration
      if (this.isExpired(entry)) {
        cache.delete(key);
        metrics.misses++;
        metrics.entryCount--;
        this.updateMemoryUsage(layer);
        this.updateHitRate(layer);
        return null;
      }

      // Update access tracking
      entry.accessCount++;
      entry.lastAccess = Date.now();
      
      metrics.hits++;
      this.updateHitRate(layer);

      logger.debug('MCPCacheManager: Cache hit', {
        layer,
        key,
        accessCount: entry.accessCount,
        age: Date.now() - entry.timestamp
      });

      return entry.data as T;
    } catch (error) {
      const errorResponse = await handleMCPError(
        error,
        'MCPCacheManager',
        'get'
      );
      logger.error('MCPCacheManager: Cache get error', { 
        layer, 
        key, 
        error: errorResponse.error 
      });
      return null;
    }
  }

  /**
   * Store data in cache
   */
  public async set<T>(
    layer: CacheLayer, 
    key: string, 
    data: T, 
    customTtl?: number
  ): Promise<void> {
    try {
      const cache = this.caches.get(layer);
      const config = this.configs.get(layer);
      const metrics = this.metrics.get(layer);
      
      if (!cache || !config || !metrics) {
        throw new Error(`Cache layer ${layer} not found`);
      }

      const entry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
        accessCount: 1,
        lastAccess: Date.now(),
        ttl: customTtl || config.ttl,
        size: this.estimateSize(data)
      };

      // Check if we need to evict entries
      await this.evictIfNeeded(layer, entry.size);

      cache.set(key, entry);
      metrics.entryCount++;
      this.updateMemoryUsage(layer);

      logger.debug('MCPCacheManager: Cache set', {
        layer,
        key,
        size: entry.size,
        ttl: entry.ttl,
        entryCount: metrics.entryCount
      });
    } catch (error) {
      const errorResponse = await handleMCPError(
        error,
        'MCPCacheManager',
        'set'
      );
      logger.error('MCPCacheManager: Cache set error', { 
        layer, 
        key, 
        error: errorResponse.error 
      });
    }
  }

  /**
   * Remove specific entry from cache
   */
  public async remove(layer: CacheLayer, key: string): Promise<void> {
    try {
      const cache = this.caches.get(layer);
      const metrics = this.metrics.get(layer);
      
      if (!cache || !metrics) {
        throw new Error(`Cache layer ${layer} not found`);
      }

      if (cache.delete(key)) {
        metrics.entryCount--;
        this.updateMemoryUsage(layer);
        
        logger.debug('MCPCacheManager: Cache entry removed', { layer, key });
      }
    } catch (error) {
      const errorResponse = await handleMCPError(
        error,
        'MCPCacheManager',
        'remove'
      );
      logger.error('MCPCacheManager: Cache remove error', { 
        layer, 
        key, 
        error: errorResponse.error 
      });
    }
  }

  /**
   * Clear entire cache layer
   */
  public async clear(layer: CacheLayer): Promise<void> {
    try {
      const cache = this.caches.get(layer);
      const metrics = this.metrics.get(layer);
      
      if (!cache || !metrics) {
        throw new Error(`Cache layer ${layer} not found`);
      }

      const entryCount = cache.size;
      cache.clear();
      
      metrics.entryCount = 0;
      metrics.memoryUsage = 0;
      
      logger.info('MCPCacheManager: Cache layer cleared', { 
        layer, 
        clearedEntries: entryCount 
      });
    } catch (error) {
      const errorResponse = await handleMCPError(
        error,
        'MCPCacheManager',
        'clear'
      );
      logger.error('MCPCacheManager: Cache clear error', { 
        layer, 
        error: errorResponse.error 
      });
    }
  }

  /**
   * Get cache metrics for monitoring
   */
  public getMetrics(layer?: CacheLayer): Record<string, CacheMetrics> {
    if (layer) {
      const metrics = this.metrics.get(layer);
      return metrics ? { [layer]: metrics } : {};
    }

    const allMetrics: Record<string, CacheMetrics> = {};
    for (const [layerName, metrics] of this.metrics.entries()) {
      allMetrics[layerName] = { ...metrics };
    }
    
    return allMetrics;
  }

  /**
   * Get cache health status
   */
  public getHealthStatus(): {
    status: 'healthy' | 'degraded' | 'critical';
    totalMemoryUsage: number;
    totalEntries: number;
    overallHitRate: number;
    layerStatus: Record<string, any>;
  } {
    let totalMemoryUsage = 0;
    let totalEntries = 0;
    let totalHits = 0;
    let totalRequests = 0;
    const layerStatus: Record<string, any> = {};

    for (const [layer, metrics] of this.metrics.entries()) {
      totalMemoryUsage += metrics.memoryUsage;
      totalEntries += metrics.entryCount;
      totalHits += metrics.hits;
      totalRequests += metrics.hits + metrics.misses;

      const config = this.configs.get(layer);
      layerStatus[layer] = {
        hitRate: metrics.hitRate,
        memoryUsage: metrics.memoryUsage,
        memoryLimit: config?.maxMemory,
        entryCount: metrics.entryCount,
        entryLimit: config?.maxSize,
        evictions: metrics.evictions
      };
    }

    const overallHitRate = totalRequests > 0 ? totalHits / totalRequests : 0;
    const totalMemoryLimit = this.getTotalMemoryLimit();
    const memoryUsagePercent = totalMemoryUsage / totalMemoryLimit;

    let status: 'healthy' | 'degraded' | 'critical' = 'healthy';
    if (memoryUsagePercent > 0.9 || overallHitRate < 0.5) {
      status = 'critical';
    } else if (memoryUsagePercent > 0.75 || overallHitRate < 0.7) {
      status = 'degraded';
    }

    return {
      status,
      totalMemoryUsage,
      totalEntries,
      overallHitRate,
      layerStatus
    };
  }

  /**
   * Check if cache entry has expired
   */
  private isExpired(entry: CacheEntry): boolean {
    if (!entry.ttl) {
      return false; // No TTL means never expires
    }
    
    return Date.now() - entry.timestamp > entry.ttl;
  }

  /**
   * Evict entries if needed to make space
   */
  private async evictIfNeeded(layer: CacheLayer, newEntrySize: number): Promise<void> {
    const cache = this.caches.get(layer);
    const config = this.configs.get(layer);
    const metrics = this.metrics.get(layer);
    
    if (!cache || !config || !metrics) {
      return;
    }

    // Check size limits
    if (cache.size >= config.maxSize || 
        metrics.memoryUsage + newEntrySize > config.maxMemory) {
      
      await this.evictEntries(layer, config.evictionPolicy);
    }
  }

  /**
   * Evict entries based on eviction policy
   */
  private async evictEntries(layer: CacheLayer, policy: 'lru' | 'lfu' | 'ttl'): Promise<void> {
    const cache = this.caches.get(layer);
    const metrics = this.metrics.get(layer);
    
    if (!cache || !metrics) {
      return;
    }

    const entries = Array.from(cache.entries());
    let toEvict: string[] = [];

    switch (policy) {
      case 'lru':
        toEvict = entries
          .sort(([, a], [, b]) => a.lastAccess - b.lastAccess)
          .slice(0, Math.ceil(entries.length * 0.2))
          .map(([key]) => key);
        break;
        
      case 'lfu':
        toEvict = entries
          .sort(([, a], [, b]) => a.accessCount - b.accessCount)
          .slice(0, Math.ceil(entries.length * 0.2))
          .map(([key]) => key);
        break;
        
      case 'ttl':
        toEvict = entries
          .filter(([, entry]) => this.isExpired(entry))
          .map(([key]) => key);
        break;
    }

    for (const key of toEvict) {
      cache.delete(key);
      metrics.evictions++;
      metrics.entryCount--;
    }

    this.updateMemoryUsage(layer);
    
    logger.debug('MCPCacheManager: Evicted entries', {
      layer,
      policy,
      evicted: toEvict.length,
      remaining: cache.size
    });
  }

  /**
   * Update memory usage for a cache layer
   */
  private updateMemoryUsage(layer: CacheLayer): void {
    const cache = this.caches.get(layer);
    const metrics = this.metrics.get(layer);
    
    if (!cache || !metrics) {
      return;
    }

    let totalSize = 0;
    for (const entry of cache.values()) {
      totalSize += entry.size;
    }
    
    metrics.memoryUsage = totalSize;
  }

  /**
   * Update hit rate for a cache layer
   */
  private updateHitRate(layer: CacheLayer): void {
    const metrics = this.metrics.get(layer);
    if (!metrics) {
      return;
    }

    const totalRequests = metrics.hits + metrics.misses;
    metrics.hitRate = totalRequests > 0 ? metrics.hits / totalRequests : 0;
  }

  /**
   * Estimate memory size of data
   */
  private estimateSize(data: any): number {
    try {
      return JSON.stringify(data).length * 2; // Rough estimate: 2 bytes per character
    } catch {
      return 1024; // Default size if serialization fails
    }
  }

  /**
   * Get total memory limit across all layers
   */
  private getTotalMemoryLimit(): number {
    let total = 0;
    for (const config of this.configs.values()) {
      total += config.maxMemory;
    }
    return total;
  }

  /**
   * Start periodic cleanup of expired entries
   */
  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredEntries();
    }, 60000); // Run every minute
  }

  /**
   * Stop the cleanup interval (useful for testing)
   */
  public stopCleanupInterval(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      delete this.cleanupInterval;
    }
  }

  /**
   * Clean up expired entries across all cache layers
   */
  private cleanupExpiredEntries(): void {
    for (const [layer, cache] of this.caches.entries()) {
      const metrics = this.metrics.get(layer);
      if (!metrics) continue;

      let cleanedCount = 0;
      
      for (const [key, entry] of cache.entries()) {
        if (this.isExpired(entry)) {
          cache.delete(key);
          cleanedCount++;
          metrics.entryCount--;
        }
      }

      if (cleanedCount > 0) {
        this.updateMemoryUsage(layer);
        logger.debug('MCPCacheManager: Cleaned expired entries', {
          layer,
          cleaned: cleanedCount,
          remaining: cache.size
        });
      }
    }
  }
}

/**
 * Convenience functions for common cache operations
 */

/**
 * Cache project analysis data
 */
export async function cacheProjectAnalysis(
  projectPath: string, 
  analysis: ProjectAnalysis
): Promise<void> {
  const cache = MCPCacheManager.getInstance();
  await cache.set(CacheLayer.ProjectAnalysis, projectPath, analysis);
}

/**
 * Get cached project analysis
 */
export async function getCachedProjectAnalysis(
  projectPath: string
): Promise<ProjectAnalysis | null> {
  const cache = MCPCacheManager.getInstance();
  return cache.get<ProjectAnalysis>(CacheLayer.ProjectAnalysis, projectPath);
}

/**
 * Cache template compilation result
 */
export async function cacheTemplate(
  templateKey: string, 
  compiledTemplate: any
): Promise<void> {
  const cache = MCPCacheManager.getInstance();
  await cache.set(CacheLayer.TemplateCompilation, templateKey, compiledTemplate);
}

/**
 * Get cached template
 */
export async function getCachedTemplate(templateKey: string): Promise<any> {
  const cache = MCPCacheManager.getInstance();
  return cache.get(CacheLayer.TemplateCompilation, templateKey);
}

/**
 * Cache configuration data
 */
export async function cacheConfiguration(
  configKey: string, 
  config: any
): Promise<void> {
  const cache = MCPCacheManager.getInstance();
  await cache.set(CacheLayer.Configuration, configKey, config);
}

/**
 * Get cached configuration
 */
export async function getCachedConfiguration(configKey: string): Promise<any> {
  const cache = MCPCacheManager.getInstance();
  return cache.get(CacheLayer.Configuration, configKey);
}