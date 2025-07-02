/**
 * FileDiscoveryCache provides caching for file discovery operations
 * 
 * This implementation uses in-memory storage with TTL expiration,
 * cache statistics, and pattern-based invalidation.
 */

import type {
  FileDiscoveryCache,
  CacheKey,
  CachedResult,
  CacheStats,
  FileDiscoveryResult,
} from '../types/file-discovery-types';

/**
 * Configuration for cache behavior
 */
export interface CacheConfig {
  /** Whether caching is enabled */
  enabled: boolean;
  
  /** Default TTL in milliseconds */
  ttl: number;
  
  /** Maximum number of cache entries */
  maxSize: number;
}

/**
 * In-memory implementation of FileDiscoveryCache
 */
export class MemoryFileDiscoveryCache implements FileDiscoveryCache {
  private cache = new Map<string, CachedResult>();
  private stats: CacheStats;
  private config: CacheConfig;

  constructor(config: CacheConfig = { enabled: true, ttl: 300000, maxSize: 1000 }) {
    this.config = config;
    this.stats = {
      totalRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      hitRate: 0,
      totalSavedMs: 0,
      cacheSize: 0,
      oldestEntry: new Date(),
      newestEntry: new Date(),
    };
  }

  /**
   * Get cached result for the given key
   */
  async get(key: CacheKey): Promise<CachedResult | null> {
    this.stats.totalRequests++;
    
    if (!this.config.enabled) {
      this.stats.cacheMisses++;
      this.updateHitRate();
      return null;
    }

    const cacheKey = this.generateCacheKey(key);
    const cached = this.cache.get(cacheKey);
    
    if (cached && this.isValid(cached)) {
      this.stats.cacheHits++;
      this.stats.totalSavedMs += cached.result.duration;
      this.updateHitRate();
      
      // Create a copy with updated fromCache flag
      return {
        ...cached,
        result: {
          ...cached.result,
          fromCache: true,
          duration: 0, // Cache access is effectively instant
        },
      };
    }
    
    // Remove expired entry
    if (cached) {
      this.cache.delete(cacheKey);
      this.updateCacheSize();
    }
    
    this.stats.cacheMisses++;
    this.updateHitRate();
    return null;
  }

  /**
   * Store result in cache with optional TTL
   */
  async set(key: CacheKey, result: FileDiscoveryResult, ttl?: number): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    const cacheKey = this.generateCacheKey(key);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + (ttl || this.config.ttl));
    
    const cachedResult: CachedResult = {
      result: {
        ...result,
        fromCache: false, // Original result was not from cache
      },
      timestamp: now,
      expiresAt,
      size: this.estimateSize(result),
    };

    // Evict oldest entries if cache is full
    if (this.cache.size >= this.config.maxSize) {
      this.evictOldest();
    }

    this.cache.set(cacheKey, cachedResult);
    this.updateCacheSize();
    this.updateTimestamps(now);
  }

  /**
   * Invalidate cache entries matching pattern
   */
  async invalidate(pattern: string | RegExp): Promise<void> {
    const keysToDelete: string[] = [];
    
    if (typeof pattern === 'string') {
      // Simple string matching
      for (const key of this.cache.keys()) {
        if (key.includes(pattern)) {
          keysToDelete.push(key);
        }
      }
    } else {
      // Regex matching
      for (const key of this.cache.keys()) {
        if (pattern.test(key)) {
          keysToDelete.push(key);
        }
      }
    }

    for (const key of keysToDelete) {
      this.cache.delete(key);
    }
    
    this.updateCacheSize();
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    this.cache.clear();
    this.updateCacheSize();
    
    // Reset timestamps
    const now = new Date();
    this.stats.oldestEntry = now;
    this.stats.newestEntry = now;
  }

  /**
   * Get cache performance statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Generate cache key from request parameters
   */
  private generateCacheKey(key: CacheKey): string {
    const parts = [
      key.baseDir,
      key.type,
      key.include.sort().join(','),
      key.exclude.sort().join(','),
      (key.languages || []).sort().join(','),
      JSON.stringify(key.options),
    ];
    
    return parts.join('|');
  }

  /**
   * Check if cached result is still valid
   */
  private isValid(cached: CachedResult): boolean {
    return cached.expiresAt.getTime() > Date.now();
  }

  /**
   * Update cache hit rate
   */
  private updateHitRate(): void {
    this.stats.hitRate = this.stats.totalRequests > 0 
      ? this.stats.cacheHits / this.stats.totalRequests 
      : 0;
  }

  /**
   * Update cache size statistics
   */
  private updateCacheSize(): void {
    this.stats.cacheSize = this.cache.size;
  }

  /**
   * Update timestamp statistics
   */
  private updateTimestamps(timestamp: Date): void {
    if (this.cache.size === 1) {
      // First entry
      this.stats.oldestEntry = timestamp;
      this.stats.newestEntry = timestamp;
    } else {
      // Find actual oldest and newest entries
      let oldest = timestamp;
      let newest = timestamp;
      
      for (const cached of this.cache.values()) {
        if (cached && cached.timestamp < oldest) {
          oldest = cached.timestamp;
        }
        if (cached && cached.timestamp > newest) {
          newest = cached.timestamp;
        }
      }
      
      this.stats.oldestEntry = oldest;
      this.stats.newestEntry = newest;
    }
  }

  /**
   * Evict oldest cache entries to make room
   */
  private evictOldest(): void {
    const entriesToEvict = Math.max(1, Math.floor(this.config.maxSize * 0.1)); // Evict 10%
    const entries = Array.from(this.cache.entries());
    
    // Sort by timestamp (oldest first)
    entries.sort((a, b) => (a[1]?.timestamp.getTime() || 0) - (b[1]?.timestamp.getTime() || 0));
    
    for (let i = 0; i < entriesToEvict && i < entries.length; i++) {
      const entry = entries[i];
      if (entry) {
        this.cache.delete(entry[0]);
      }
    }
  }

  /**
   * Estimate the size of a cache entry in bytes
   */
  private estimateSize(result: FileDiscoveryResult): number {
    // Rough estimation based on string content
    const filesSize = result.files.reduce((total, file) => total + file.length * 2, 0); // UTF-16
    const metadataSize = 200; // Approximate size of metadata
    
    return filesSize + metadataSize;
  }
}

/**
 * Null cache implementation that doesn't store anything
 * Useful for testing or when caching is disabled
 */
export class NullFileDiscoveryCache implements FileDiscoveryCache {
  private stats: CacheStats = {
    totalRequests: 0,
    cacheHits: 0,
    cacheMisses: 0,
    hitRate: 0,
    totalSavedMs: 0,
    cacheSize: 0,
    oldestEntry: new Date(),
    newestEntry: new Date(),
  };

  async get(_key: CacheKey): Promise<CachedResult | null> {
    this.stats.totalRequests++;
    this.stats.cacheMisses++;
    return null;
  }

  async set(_key: CacheKey, _result: FileDiscoveryResult, _ttl?: number): Promise<void> {
    // No-op
  }

  async invalidate(_pattern: string | RegExp): Promise<void> {
    // No-op
  }

  async clear(): Promise<void> {
    // No-op
  }

  getStats(): CacheStats {
    return { ...this.stats };
  }
}