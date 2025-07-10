/**
 * Type definitions for the centralized FileDiscoveryService
 *
 * This service provides consistent file discovery across all components
 * with caching, configuration integration, and performance monitoring.
 */

import type { ClaudeTestingConfig } from './config';

/**
 * Main interface for file discovery operations
 */
export interface FileDiscoveryService {
  /**
   * Find files based on discovery request parameters
   */
  findFiles(request: FileDiscoveryRequest): Promise<FileDiscoveryResult>;

  /**
   * Find test files in a directory for a specific framework
   */
  findTestFiles(directory: string, framework?: string): Promise<string[]>;

  /**
   * Check if a file exists
   */
  fileExists(path: string): Promise<boolean>;

  /**
   * Invalidate cache entries matching pattern
   */
  invalidateCache(path?: string): void;

  /**
   * Get cache performance statistics
   */
  getCacheStats(): CacheStats;

  /**
   * Analyze project structure for smart pattern detection
   */
  analyzeProjectStructure?(projectPath: string): Promise<any>;
}

/**
 * Request parameters for file discovery operations
 */
export interface FileDiscoveryRequest {
  /** Base directory to search from */
  baseDir: string;

  /** Include patterns (glob format) */
  include?: string[];

  /** Exclude patterns (glob format) */
  exclude?: string[];

  /** Type of discovery operation for pattern resolution */
  type: FileDiscoveryType;

  /** Target languages for language-specific filtering */
  languages?: string[];

  /** Return absolute paths instead of relative */
  absolute?: boolean;

  /** Include directories in results */
  includeDirectories?: boolean;

  /** Use cache for this operation */
  useCache?: boolean;

  /** Override configuration for this request */
  configOverride?: Partial<ClaudeTestingConfig>;
}

/**
 * Result of file discovery operation with metadata
 */
export interface FileDiscoveryResult {
  /** Array of discovered file paths */
  files: string[];

  /** Whether result came from cache */
  fromCache: boolean;

  /** Operation duration in milliseconds */
  duration: number;

  /** Detailed statistics about discovery operation */
  stats: FileDiscoveryStats;
}

/**
 * Detailed statistics for file discovery operations
 */
export interface FileDiscoveryStats {
  /** Total files scanned before filtering */
  totalScanned: number;

  /** Files included in final result */
  included: number;

  /** Files excluded by patterns */
  excluded: number;

  /** Files filtered by language detection */
  languageFiltered: number;
}

/**
 * Types of file discovery operations for pattern resolution
 */
export enum FileDiscoveryType {
  /** Project analysis - find all source files */
  PROJECT_ANALYSIS = 'project-analysis',

  /** Test generation - find files to generate tests for */
  TEST_GENERATION = 'test-generation',

  /** Test execution - find existing test files */
  TEST_EXECUTION = 'test-execution',

  /** Configuration discovery - find config files */
  CONFIG_DISCOVERY = 'config-discovery',

  /** Custom operation with user-defined patterns */
  CUSTOM = 'custom',
}

/**
 * Cache performance and usage statistics
 */
export interface CacheStats {
  /** Total cache requests made */
  totalRequests: number;

  /** Successful cache hits */
  cacheHits: number;

  /** Cache misses requiring file system access */
  cacheMisses: number;

  /** Cache hit rate (0-1) */
  hitRate: number;

  /** Total time saved by cache in milliseconds */
  totalSavedMs: number;

  /** Current number of cache entries */
  cacheSize: number;

  /** Timestamp of oldest cache entry */
  oldestEntry: Date;

  /** Timestamp of newest cache entry */
  newestEntry: Date;
}

/**
 * Interface for file discovery cache implementations
 */
export interface FileDiscoveryCache {
  /**
   * Get cached result for the given key
   */
  get(key: CacheKey): CachedResult | null;

  /**
   * Store result in cache with optional TTL
   */
  set(key: CacheKey, result: FileDiscoveryResult, ttl?: number): void;

  /**
   * Invalidate cache entries matching pattern
   */
  invalidate(pattern: string | RegExp): void;

  /**
   * Clear all cache entries
   */
  clear(): void;

  /**
   * Get cache performance statistics
   */
  getStats(): CacheStats;
}

/**
 * Cache key for storing and retrieving cached results
 */
export interface CacheKey {
  /** Base directory */
  baseDir: string;

  /** Include patterns */
  include: string[];

  /** Exclude patterns */
  exclude: string[];

  /** Discovery type */
  type: FileDiscoveryType;

  /** Target languages */
  languages: string[];

  /** Additional options affecting result */
  options: {
    absolute: boolean;
    includeDirectories: boolean;
  };
}

/**
 * Cached result with metadata
 */
export interface CachedResult {
  /** The cached file discovery result */
  result: FileDiscoveryResult;

  /** When this entry was cached */
  timestamp: Date;

  /** When this entry expires */
  expiresAt: Date;

  /** Size of this cache entry in bytes (estimated) */
  size: number;
}

/**
 * Interface for managing file patterns and filters
 */
export interface PatternManager {
  /**
   * Get include patterns for a discovery type and languages
   */
  getIncludePatterns(type: FileDiscoveryType, languages?: string[]): string[];

  /**
   * Get exclude patterns for a discovery type and languages
   */
  getExcludePatterns(type: FileDiscoveryType, languages?: string[]): string[];

  /**
   * Merge user patterns with default patterns
   */
  mergeUserPatterns(
    defaultPatterns: string[],
    userPatterns: string[],
    operation: PatternMergeOperation
  ): string[];

  /**
   * Validate that patterns are syntactically correct
   */
  validatePatterns(patterns: string[]): PatternValidationResult;
}

/**
 * Operations for merging user patterns with defaults
 */
export type PatternMergeOperation = 'add' | 'replace';

/**
 * Result of pattern validation
 */
export interface PatternValidationResult {
  /** Whether all patterns are valid */
  valid: boolean;

  /** Invalid patterns with error messages */
  errors: PatternValidationError[];

  /** Warnings about patterns */
  warnings: PatternValidationWarning[];
}

/**
 * Error in pattern validation
 */
export interface PatternValidationError {
  /** The invalid pattern */
  pattern: string;

  /** Error message */
  message: string;

  /** Position in pattern where error occurs */
  position?: number;
}

/**
 * Warning about pattern usage
 */
export interface PatternValidationWarning {
  /** The pattern causing warning */
  pattern: string;

  /** Warning message */
  message: string;

  /** Suggested alternative */
  suggestion?: string;
}

/**
 * Standard patterns used by the pattern manager
 */
export interface StandardPatterns {
  /** Base exclude patterns applied to all operations */
  baseExcludes: string[];

  /** Patterns for project analysis */
  [FileDiscoveryType.PROJECT_ANALYSIS]?: {
    includes: string[];
    excludes: string[];
  };

  /** Patterns for test generation */
  [FileDiscoveryType.TEST_GENERATION]?: {
    includes: string[];
    excludes: string[];
  };

  /** Patterns for test execution */
  [FileDiscoveryType.TEST_EXECUTION]?: {
    includes: string[];
    excludes: string[];
  };

  /** Patterns for config discovery */
  [FileDiscoveryType.CONFIG_DISCOVERY]?: {
    includes: string[];
    excludes: string[];
  };
}

/**
 * Language-specific file extensions and patterns
 */
export interface LanguagePatterns {
  /** JavaScript/TypeScript patterns */
  javascript: {
    extensions: string[];
    frameworks: Record<string, string[]>;
    testPatterns: string[];
  };

  /** Python patterns */
  python: {
    extensions: string[];
    frameworks: Record<string, string[]>;
    testPatterns: string[];
  };

  /** Additional language support */
  [language: string]: {
    extensions: string[];
    frameworks: Record<string, string[]>;
    testPatterns: string[];
  };
}

/**
 * Configuration for FileDiscoveryService
 */
export interface FileDiscoveryConfig {
  /** Cache configuration */
  cache: {
    enabled: boolean;
    ttl: number; // milliseconds
    maxSize: number; // max entries
  };

  /** Pattern customization */
  patterns: Record<string, PatternOverrides>;

  /** Performance monitoring */
  performance: {
    enableStats: boolean;
    logSlowOperations: boolean;
    slowThresholdMs: number;
  };

  /** Smart pattern detection configuration */
  smartDetection?: {
    enabled: boolean;
    confidenceThreshold?: number; // minimum confidence to apply patterns (0-1)
    cacheAnalysis?: boolean; // whether to cache structure analysis
  };
}

/**
 * User pattern overrides for specific discovery types
 */
export interface PatternOverrides {
  /** Additional exclude patterns */
  additionalExcludes?: string[];

  /** Additional include patterns */
  additionalIncludes?: string[];

  /** Replace default exclude patterns entirely */
  replaceExcludes?: string[];

  /** Replace default include patterns entirely */
  replaceIncludes?: string[];
}
