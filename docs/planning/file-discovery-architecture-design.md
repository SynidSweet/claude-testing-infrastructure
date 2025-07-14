# File Discovery Service Architecture Design

*Phase 2 of File Discovery Service Investigation | Created: 2025-07-01*

## 📊 Executive Summary

Based on Phase 1 findings, this document defines the architecture for a centralized FileDiscoveryService that will unify all file discovery operations across the Claude Testing Infrastructure. The service addresses identified inconsistencies, performance issues, and configuration gaps while maintaining backward compatibility.

## 🎯 Design Goals

### Primary Objectives
1. **Unify file discovery** - Single source of truth for all file discovery operations
2. **Improve performance** - Reduce repeated directory scans, optimize with caching
3. **Standardize patterns** - Consistent exclude/include pattern management
4. **Enable configuration** - Full integration with ConfigurationService
5. **Maintain compatibility** - No breaking changes during migration

### Success Metrics
- **Performance**: 70%+ reduction in total file discovery time
- **Consistency**: 100% pattern standardization across components
- **Configuration**: 100% user pattern customization support
- **Maintainability**: 90%+ reduction in pattern-related code duplication

## 🏗️ Core Architecture

### FileDiscoveryService Interface

```typescript
/**
 * Centralized file discovery service with caching and configuration support
 */
export interface FileDiscoveryService {
  /**
   * Find files matching patterns with optional configuration override
   */
  findFiles(request: FileDiscoveryRequest): Promise<FileDiscoveryResult>;

  /**
   * Find test files in directory with framework-specific patterns
   */
  findTestFiles(directory: string, framework?: string): Promise<string[]>;

  /**
   * Check if specific file exists (cached)
   */
  fileExists(path: string): Promise<boolean>;

  /**
   * Clear cache for specific path or all paths
   */
  invalidateCache(path?: string): void;

  /**
   * Get cache statistics for monitoring
   */
  getCacheStats(): CacheStats;
}

/**
 * File discovery request configuration
 */
export interface FileDiscoveryRequest {
  /** Base directory for search */
  baseDir: string;
  
  /** Include patterns (default: all files) */
  include?: string[];
  
  /** Exclude patterns (merged with default excludes) */
  exclude?: string[];
  
  /** Discovery type for pattern selection */
  type: FileDiscoveryType;
  
  /** Language filtering */
  languages?: string[];
  
  /** Return absolute paths */
  absolute?: boolean;
  
  /** Include directories in results */
  includeDirectories?: boolean;
  
  /** Cache results */
  useCache?: boolean;
  
  /** Custom options override */
  configOverride?: Partial<ClaudeTestingConfig>;
}

/**
 * File discovery result with metadata
 */
export interface FileDiscoveryResult {
  /** Found file paths */
  files: string[];
  
  /** Cache hit/miss status */
  fromCache: boolean;
  
  /** Discovery duration in milliseconds */
  duration: number;
  
  /** Pattern matching statistics */
  stats: {
    totalScanned: number;
    included: number;
    excluded: number;
    languageFiltered: number;
  };
}

/**
 * File discovery type determines default patterns
 */
export enum FileDiscoveryType {
  /** Project analysis - broad file discovery */
  PROJECT_ANALYSIS = 'project-analysis',
  
  /** Test generation - source files only */
  TEST_GENERATION = 'test-generation',
  
  /** Test execution - test files only */
  TEST_EXECUTION = 'test-execution',
  
  /** Configuration discovery */
  CONFIG_DISCOVERY = 'config-discovery',
  
  /** Custom patterns - no defaults */
  CUSTOM = 'custom'
}

/**
 * Cache performance statistics
 */
export interface CacheStats {
  totalRequests: number;
  cacheHits: number;
  cacheMisses: number;
  hitRate: number;
  totalSavedMs: number;
  cacheSize: number;
  oldestEntry: Date;
  newestEntry: Date;
}
```

### Pattern Management System

```typescript
/**
 * Centralized pattern management with configuration integration
 */
export interface PatternManager {
  /**
   * Get include patterns for discovery type
   */
  getIncludePatterns(type: FileDiscoveryType, languages?: string[]): string[];

  /**
   * Get exclude patterns for discovery type
   */
  getExcludePatterns(type: FileDiscoveryType, languages?: string[]): string[];

  /**
   * Merge user configuration patterns
   */
  mergeUserPatterns(
    defaultPatterns: string[],
    userPatterns: string[],
    operation: 'add' | 'replace' | 'remove'
  ): string[];

  /**
   * Validate pattern syntax
   */
  validatePatterns(patterns: string[]): PatternValidationResult;
}

/**
 * Standard pattern sets organized by discovery type
 */
export interface StandardPatterns {
  // Base exclude patterns (applied to all types)
  baseExcludes: string[];
  
  // Language-specific excludes
  languageExcludes: {
    javascript: string[];
    typescript: string[];
    python: string[];
  };
  
  // Discovery type specific patterns
  projectAnalysis: {
    includes: string[];
    excludes: string[];
  };
  
  testGeneration: {
    includes: string[];
    excludes: string[];
  };
  
  testExecution: {
    includes: string[];
    excludes: string[];
  };
  
  configDiscovery: {
    includes: string[];
    excludes: string[];
  };
}
```

### Caching Strategy

```typescript
/**
 * Intelligent caching with invalidation
 */
export interface FileDiscoveryCache {
  /**
   * Get cached results if available
   */
  get(key: CacheKey): Promise<CachedResult | null>;

  /**
   * Store results in cache
   */
  set(key: CacheKey, result: FileDiscoveryResult, ttl?: number): Promise<void>;

  /**
   * Invalidate cache entries
   */
  invalidate(pattern: string | RegExp): Promise<void>;

  /**
   * Clear all cache entries
   */
  clear(): Promise<void>;

  /**
   * Get cache statistics
   */
  getStats(): CacheStats;
}

/**
 * Cache key generation based on request parameters
 */
export interface CacheKey {
  baseDir: string;
  include: string[];
  exclude: string[];
  type: FileDiscoveryType;
  languages: string[];
  options: string; // Serialized options hash
}

/**
 * Cached result with metadata
 */
export interface CachedResult {
  result: FileDiscoveryResult;
  timestamp: Date;
  ttl: number;
  valid: boolean;
}
```

## 🔧 Implementation Strategy

### Phase 1: Core Service Implementation (1 session)

**Create FileDiscoveryService** (`src/services/FileDiscoveryService.ts`)
```typescript
export class FileDiscoveryServiceImpl implements FileDiscoveryService {
  private cache: FileDiscoveryCache;
  private patternManager: PatternManager;
  private configService: ConfigurationService;

  constructor(configService: ConfigurationService) {
    this.configService = configService;
    this.patternManager = new PatternManagerImpl();
    this.cache = new MemoryFileDiscoveryCache();
  }

  async findFiles(request: FileDiscoveryRequest): Promise<FileDiscoveryResult> {
    // 1. Generate cache key
    // 2. Check cache if enabled
    // 3. Resolve patterns from type + config
    // 4. Execute fast-glob search
    // 5. Apply language filtering
    // 6. Cache results
    // 7. Return with metadata
  }
}
```

**Benefits of this approach:**
- **Single fast-glob implementation** - Consistent performance across all components
- **Configuration integration** - Full user customization support
- **Intelligent caching** - Reduces repeated scans by 70-90%
- **Type-safe patterns** - Eliminates pattern format inconsistencies

### Phase 2: Pattern Standardization (1 session)

**Create PatternManager** (`src/services/PatternManager.ts`)
```typescript
export class PatternManagerImpl implements PatternManager {
  private standardPatterns: StandardPatterns = {
    baseExcludes: [
      '**/node_modules/**',
      '**/dist/**', 
      '**/build/**',
      '**/coverage/**',
      '**/.git/**',
      '**/.claude-testing/**'
    ],
    
    languageExcludes: {
      javascript: [],
      typescript: ['**/*.d.ts'],
      python: ['**/__pycache__/**', '**/venv/**', '**/.venv/**']
    },
    
    projectAnalysis: {
      includes: ['**/*'],
      excludes: [] // Uses baseExcludes + languageExcludes
    },
    
    testGeneration: {
      includes: ['**/*.{js,jsx,ts,tsx,py}'],
      excludes: [
        '**/*.test.*',
        '**/*.spec.*',
        '**/tests/**',
        '**/__tests__/**'
      ]
    },
    
    testExecution: {
      includes: ['**/*.{test,spec}.{js,jsx,ts,tsx,py}'],
      excludes: []
    }
  };
}
```

**Pattern Resolution Algorithm:**
1. Start with standard patterns for discovery type
2. Add language-specific patterns
3. Merge user configuration patterns
4. Apply pattern validation
5. Return resolved include/exclude arrays

### Phase 3: Caching Implementation (0.5 sessions)

**Create MemoryFileDiscoveryCache** (`src/services/FileDiscoveryCache.ts`)
```typescript
export class MemoryFileDiscoveryCache implements FileDiscoveryCache {
  private cache = new Map<string, CachedResult>();
  private stats: CacheStats;

  async get(key: CacheKey): Promise<CachedResult | null> {
    const cacheKey = this.generateCacheKey(key);
    const cached = this.cache.get(cacheKey);
    
    if (cached && this.isValid(cached)) {
      this.stats.cacheHits++;
      return cached;
    }
    
    this.stats.cacheMisses++;
    return null;
  }
  
  private generateCacheKey(key: CacheKey): string {
    // Generate stable hash from request parameters
    return crypto.createHash('md5')
      .update(JSON.stringify(key))
      .digest('hex');
  }
  
  private isValid(cached: CachedResult): boolean {
    const age = Date.now() - cached.timestamp.getTime();
    return age < cached.ttl && cached.valid;
  }
}
```

**Cache Invalidation Strategy:**
- **Time-based TTL**: Default 5 minutes for file system changes
- **Path-based invalidation**: Invalidate when directories change
- **Event-based invalidation**: File watcher integration (future)

### Phase 4: Migration Strategy (0.5 sessions)

**Gradual Component Migration:**

1. **Test Runners First** (Highest Performance Gain)
   ```typescript
   // Replace custom findTestFiles with FileDiscoveryService
   protected async hasTests(): Promise<boolean> {
     const files = await this.fileDiscovery.findFiles({
       baseDir: this.config.testPath,
       type: FileDiscoveryType.TEST_EXECUTION,
       useCache: true
     });
     return files.files.length > 0;
   }
   ```

2. **StructuralTestGenerator Second** (Configuration Integration)
   ```typescript
   protected async getFilesToTest(): Promise<string[]> {
     const result = await this.fileDiscovery.findFiles({
       baseDir: this.config.projectPath,
       type: FileDiscoveryType.TEST_GENERATION,
       languages: this.getDetectedLanguages(),
       useCache: true
     });
     return result.files;
   }
   ```

3. **ProjectAnalyzer Last** (Preserve Existing Performance)
   ```typescript
   private async findFiles(patterns: string[], ignore: string[] = []): Promise<string[]> {
     const result = await this.fileDiscovery.findFiles({
       baseDir: this.projectPath,
       include: patterns,
       exclude: ignore,
       type: FileDiscoveryType.CUSTOM,
       useCache: true
     });
     return result.files;
   }
   ```

## 📊 Performance Optimization

### Expected Performance Improvements

Based on Phase 1 analysis:

**Current Performance:**
- ProjectAnalyzer: ~150-300ms (fast-glob)
- StructuralTestGenerator: ~100-200ms (fast-glob)  
- Test Runners: ~500-1000ms (fs.readdir)
- **Total**: ~750-1500ms per operation

**Projected Performance with FileDiscoveryService:**
- All components: ~50-150ms (fast-glob + cache)
- Cache hits: ~1-5ms
- **Total with 80% cache hit rate**: ~60-180ms per operation
- **Performance improvement**: 70-85% reduction

### Cache Effectiveness Modeling

**Cache Hit Rate Projections:**
- **Development mode**: 80-90% (repeated file discovery)
- **CI/CD mode**: 20-40% (fresh environments)
- **Watch mode**: 95%+ (incremental changes)

**Memory Usage:**
- Cache entry size: ~1-5KB per request
- Typical cache size: 50-200 entries
- Memory overhead: ~250KB-1MB (negligible)

## 🔌 Configuration Integration

### User Configuration Support

**Enhanced .claude-testing.config.json:**
```json
{
  "fileDiscovery": {
    "cache": {
      "enabled": true,
      "ttl": 300000,
      "maxSize": 1000
    },
    "patterns": {
      "projectAnalysis": {
        "additionalExcludes": ["**/temp/**"],
        "additionalIncludes": ["**/*.custom"]
      },
      "testGeneration": {
        "replaceExcludes": ["**/*.test.*", "**/*.spec.*"]
      }
    },
    "performance": {
      "enableStats": true,
      "logSlowOperations": true,
      "slowThresholdMs": 1000
    }
  }
}
```

**Configuration Resolution:**
1. Default patterns from StandardPatterns
2. User configuration patterns merged
3. CLI argument overrides applied
4. Validation and error reporting

### Backward Compatibility

**Compatibility Bridge:**
```typescript
// Maintain existing ProjectAnalyzer interface
private async findFiles(patterns: string[], ignore: string[] = []): Promise<string[]> {
  return this.fileDiscoveryService.findFiles({
    baseDir: this.projectPath,
    include: patterns,
    exclude: ignore,
    type: FileDiscoveryType.CUSTOM
  }).then(result => result.files);
}
```

**Migration Safety:**
- All existing APIs preserved during transition
- Extensive test coverage for pattern matching
- A/B testing capability for validation
- Rollback mechanism if issues found

## 🧪 Testing Strategy

### Test Categories

**Unit Tests:**
- Pattern resolution logic
- Cache behavior and invalidation
- Configuration integration
- Performance monitoring

**Integration Tests:**
- Full file discovery workflows
- Cross-component compatibility
- Cache consistency across operations
- Configuration override behavior

**Performance Tests:**
- Cache hit rate validation
- Memory usage monitoring  
- Response time verification
- Large project scalability

### Test Implementation

**Pattern Matching Validation:**
```typescript
describe('PatternManager', () => {
  it('should resolve patterns consistently across discovery types', () => {
    const patterns = patternManager.getExcludePatterns(
      FileDiscoveryType.TEST_GENERATION,
      ['typescript']
    );
    
    expect(patterns).toContain('**/node_modules/**');
    expect(patterns).toContain('**/*.d.ts'); // TypeScript specific
    expect(patterns).toContain('**/*.test.*'); // Test generation specific
  });
});
```

**Cache Performance Validation:**
```typescript
describe('FileDiscoveryCache', () => {
  it('should achieve target cache hit rates', async () => {
    // Simulate repeated discovery requests
    for (let i = 0; i < 100; i++) {
      await fileDiscovery.findFiles(standardRequest);
    }
    
    const stats = fileDiscovery.getCacheStats();
    expect(stats.hitRate).toBeGreaterThan(0.8); // 80% hit rate
  });
});
```

## 📈 Monitoring and Metrics

### Performance Metrics

**Real-time Monitoring:**
```typescript
export interface FileDiscoveryMetrics {
  // Operation metrics
  totalOperations: number;
  averageResponseTime: number;
  slowOperations: number; // > threshold
  
  // Cache metrics
  cacheHitRate: number;
  cacheSizeMB: number;
  oldestCacheEntry: Date;
  
  // Pattern metrics
  mostUsedPatterns: string[];
  patternValidationErrors: number;
  
  // Configuration metrics
  userOverrides: number;
  configErrors: number;
}
```

**Alerting Thresholds:**
- Response time > 1000ms
- Cache hit rate < 50%
- Cache size > 10MB
- Pattern validation errors > 0

### Debug and Troubleshooting

**Diagnostic Tools:**
```typescript
// Debug mode logging
DEBUG=claude-testing:file-discovery node dist/src/cli/index.js analyze /project

// Performance analysis
node dist/src/cli/index.js analyze /project --file-discovery-stats

// Cache inspection
node dist/src/cli/index.js debug cache-stats
```

## 🚀 Implementation Phases

### Phase Summary

| Phase | Duration | Components | Success Criteria |
|-------|----------|------------|------------------|
| **Phase 1** | 1 session (3 hours) | Core service, interfaces | Service operational, basic patterns working |
| **Phase 2** | 1 session (3 hours) | Pattern management, config integration | Full pattern support, user config working |
| **Phase 3** | 0.5 session (1.5 hours) | Caching implementation | Cache working, performance improved |
| **Phase 4** | 0.5 session (1.5 hours) | Component migration | All components using service |

**Total Estimated Time**: 9 hours across 3 full sessions

### Risk Assessment

**High Risk:**
- Pattern matching behavior changes
- Performance regression during transition
- Configuration compatibility issues

**Mitigation Strategies:**
- Extensive A/B testing before migration
- Rollback capability at each phase
- Performance benchmarking at each step
- Comprehensive test coverage

**Success Validation:**
- All existing tests pass after migration
- Performance improvements verified
- Configuration integration working
- Cache hit rates meet targets

## 📋 Next Steps

### Immediate Actions (Phase 3)

1. **Create detailed implementation tasks**
   - Break down each phase into specific coding tasks
   - Define file structure and module organization
   - Plan test scenarios and validation criteria

2. **Set up performance baselines**
   - Benchmark current file discovery performance
   - Establish target metrics for each phase
   - Create performance regression detection

3. **Design validation strategy**
   - A/B testing framework for pattern matching
   - Migration rollback procedures
   - User acceptance testing plan

### Implementation Order

1. **FileDiscoveryService core implementation**
2. **PatternManager with StandardPatterns**
3. **MemoryFileDiscoveryCache with TTL**
4. **Test Runner migration** (highest impact)
5. **StructuralTestGenerator migration**
6. **ProjectAnalyzer migration** (preserve existing)

---

**Architecture Status**: Phase 2 Complete ✅  
**Next Phase**: Implementation Planning (2 hours estimated)  
**Overall Progress**: 75% complete (6/8 hours)  
**Ready for Implementation**: Yes - detailed architecture defined