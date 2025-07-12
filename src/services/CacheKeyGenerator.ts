/**
 * Type-safe cache key generator for file discovery operations
 *
 * This module provides deterministic cache key generation with
 * proper type safety and consistent ordering.
 */

import { createHash } from 'crypto';
import type {
  TypedCacheKey,
  SupportedLanguage,
  EnhancedFileDiscoveryRequest,
} from '../types/enhanced-file-discovery-types';
import { FileDiscoveryType } from '../types/file-discovery-types';

/**
 * Cache key generator with type safety and consistent hashing
 */
export class CacheKeyGenerator {
  /**
   * Generate a deterministic cache key from request parameters
   */
  static generate(request: EnhancedFileDiscoveryRequest): string {
    const typedKey = this.createTypedKey(request);
    return this.hashKey(typedKey);
  }

  /**
   * Create a typed cache key from request
   */
  private static createTypedKey(request: EnhancedFileDiscoveryRequest): TypedCacheKey {
    return {
      baseDir: this.normalizePath(request.baseDir),
      include: this.normalizePatterns(request.include ?? []),
      exclude: this.normalizePatterns(request.exclude ?? []),
      type: request.type,
      languages: this.normalizeLanguages(request.languages ?? []),
      options: {
        absolute: request.absolute ?? false,
        includeDirectories: request.includeDirectories ?? false,
      },
    };
  }

  /**
   * Generate hash from typed key for efficient storage
   */
  private static hashKey(key: TypedCacheKey): string {
    const keyObject = {
      baseDir: key.baseDir,
      include: key.include,
      exclude: key.exclude,
      type: key.type,
      languages: key.languages,
      options: key.options,
    };

    // Create deterministic string representation
    const keyString = this.createDeterministicString(keyObject);

    // Create hash for efficient comparison and storage
    return createHash('sha256').update(keyString).digest('hex').substring(0, 16);
  }

  /**
   * Create deterministic string from object
   */
  private static createDeterministicString(obj: unknown): string {
    // Sort object keys for consistency
    const sortedObj = this.sortObject(obj);
    return JSON.stringify(sortedObj);
  }

  /**
   * Recursively sort object keys for deterministic serialization
   */
  private static sortObject(obj: unknown): unknown {
    if (Array.isArray(obj)) {
      return obj.map((item) => this.sortObject(item)).sort();
    }

    if (obj !== null && typeof obj === 'object') {
      const sorted: Record<string, unknown> = {};
      const objRecord = obj as Record<string, unknown>;
      Object.keys(objRecord)
        .sort()
        .forEach((key) => {
          sorted[key] = this.sortObject(objRecord[key]);
        });
      return sorted;
    }

    return obj;
  }

  /**
   * Normalize path for consistent caching
   */
  private static normalizePath(path: string): string {
    return path.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/\/$/, '');
  }

  /**
   * Normalize and sort patterns for consistent caching
   */
  private static normalizePatterns(patterns: ReadonlyArray<string>): ReadonlyArray<string> {
    return patterns.map((p) => p.replace(/\\/g, '/')).sort();
  }

  /**
   * Normalize and sort languages for consistent caching
   */
  private static normalizeLanguages(
    languages: ReadonlyArray<SupportedLanguage>
  ): ReadonlyArray<SupportedLanguage> {
    return [...languages].sort();
  }

  /**
   * Validate cache key for debugging
   */
  static validate(key: TypedCacheKey): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!key.baseDir || key.baseDir.trim() === '') {
      errors.push('Base directory is required');
    }

    if (!Object.values(FileDiscoveryType).includes(key.type)) {
      errors.push(`Invalid discovery type: ${key.type}`);
    }

    // Validate patterns
    const allPatterns = [...key.include, ...key.exclude];
    for (const pattern of allPatterns) {
      if (pattern.includes('\\')) {
        errors.push(`Pattern contains backslash: ${pattern}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Create a human-readable representation of cache key
   */
  static toDebugString(key: TypedCacheKey): string {
    return [
      `BaseDir: ${key.baseDir}`,
      `Type: ${key.type}`,
      `Languages: ${key.languages.join(', ') || 'none'}`,
      `Include: ${key.include.length} patterns`,
      `Exclude: ${key.exclude.length} patterns`,
      `Options: absolute=${key.options.absolute}, dirs=${key.options.includeDirectories}`,
    ].join(' | ');
  }
}
