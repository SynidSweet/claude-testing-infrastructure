/**
 * Enhanced FileDiscoveryService with improved type safety
 *
 * This service provides centralized file discovery with enhanced
 * type safety, better error handling, and improved caching.
 */

import fg from 'fast-glob';
import path from 'path';
import { promises as fs } from 'fs';
import debug from 'debug';

import {
  FileDiscoveryType,
  type FileDiscoveryService,
  type FileDiscoveryRequest,
  type FileDiscoveryResult,
  type FileDiscoveryCache,
  type PatternManager,
  type FileDiscoveryConfig,
  type CacheStats,
  type CacheKey,
} from '../types/file-discovery-types';

import {
  type EnhancedFileDiscoveryRequest,
  type EnhancedFileDiscoveryResult,
  type FileDiscoveryError,
  type SupportedLanguage,
  type SupportedTestFramework,
  type FileDiscoveryConfigOverride,
  SupportedLanguage as SupportedLanguageEnum,
  SupportedTestFramework as SupportedTestFrameworkEnum,
  isSupportedLanguage,
  isSupportedTestFramework,
} from '../types/enhanced-file-discovery-types';

import { PatternManagerImpl } from './PatternManager';
import { MemoryFileDiscoveryCache, NullFileDiscoveryCache } from './FileDiscoveryCache';
import { EnhancedPatternValidator } from './EnhancedPatternValidator';

const logger: debug.Debugger = debug('claude-testing:file-discovery');

/**
 * Service for configuration retrieval
 */
export interface ConfigurationService {
  getFileDiscoveryConfig(): FileDiscoveryConfig;
}

/**
 * Enhanced implementation of FileDiscoveryService
 */
export class EnhancedFileDiscoveryServiceImpl implements FileDiscoveryService {
  private cache: FileDiscoveryCache;
  private patternManager: PatternManager;
  private config: FileDiscoveryConfig;

  constructor(configService?: ConfigurationService) {
    this.config = configService?.getFileDiscoveryConfig() ?? this.getDefaultConfig();
    this.patternManager = new PatternManagerImpl(configService);

    if (this.config.cache.enabled) {
      this.cache = new MemoryFileDiscoveryCache(this.config.cache);
    } else {
      this.cache = new NullFileDiscoveryCache();
    }
  }

  /**
   * Find files based on discovery request parameters
   */
  async findFiles(request: FileDiscoveryRequest): Promise<FileDiscoveryResult> {
    // Convert to enhanced request for internal processing
    const enhancedRequest = this.toEnhancedRequest(request);
    const result = await this.findFilesEnhanced(enhancedRequest);

    // Convert back to standard result
    if (result.success) {
      return result.data;
    } else {
      // Handle error case
      return this.createErrorResult(result.error);
    }
  }

  /**
   * Enhanced find files with better type safety
   */
  async findFilesEnhanced(
    request: EnhancedFileDiscoveryRequest
  ): Promise<EnhancedFileDiscoveryResult<FileDiscoveryResult>> {
    const startTime = Date.now();

    // Validate patterns
    const validation = EnhancedPatternValidator.validate([
      ...(request.include ?? []),
      ...(request.exclude ?? []),
    ]);

    if (!validation.valid) {
      const error: FileDiscoveryError =
        validation.errors[0]?.position !== undefined
          ? {
              kind: 'InvalidPatternError',
              pattern: validation.errors[0].pattern,
              message: validation.errors[0].message,
              position: validation.errors[0].position,
            }
          : {
              kind: 'InvalidPatternError',
              pattern: validation.errors[0]?.pattern ?? '',
              message: validation.errors[0]?.message ?? 'Invalid pattern',
            };
      return { success: false, error };
    }

    // Apply configuration defaults to request
    const effectiveRequest = this.applyConfigDefaults(request);

    // Generate cache key - removed unused variable

    // Check cache if enabled
    if (effectiveRequest.useCache !== false) {
      const cached = this.cache.get(this.toCacheKey(effectiveRequest));
      if (cached) {
        return { success: true, data: cached.result };
      }
    }

    // Validate base directory exists
    const dirCheck = await this.validateDirectory(effectiveRequest.baseDir);
    if (!dirCheck.success) {
      return dirCheck;
    }

    // Resolve patterns
    const includePatterns = this.resolveIncludePatterns(effectiveRequest);
    const excludePatterns = this.resolveExcludePatterns(effectiveRequest);

    // Execute file discovery
    let files: string[];
    try {
      files = await fg(includePatterns, {
        cwd: effectiveRequest.baseDir,
        ignore: excludePatterns,
        absolute: effectiveRequest.absolute ?? false,
        onlyFiles: !effectiveRequest.includeDirectories,
        dot: false,
        followSymbolicLinks: false,
        suppressErrors: true,
      });
    } catch (error: unknown) {
      const discoveryError: FileDiscoveryError = {
        kind: 'InvalidPatternError',
        pattern: includePatterns.join(', '),
        message: `File discovery failed: ${String(error)}`,
      };
      return { success: false, error: discoveryError };
    }

    // Apply language filtering if needed
    const filteredFiles = this.applyEnhancedLanguageFiltering(files, effectiveRequest.languages);

    // Create result
    const result: FileDiscoveryResult = {
      files: filteredFiles,
      fromCache: false,
      duration: Date.now() - startTime,
      stats: {
        totalScanned: files.length,
        included: filteredFiles.length,
        excluded: files.length - filteredFiles.length,
        languageFiltered: effectiveRequest.languages ? files.length - filteredFiles.length : 0,
      },
    };

    // Cache result if enabled
    if (effectiveRequest.useCache !== false) {
      this.cache.set(this.toCacheKey(effectiveRequest), result);
    }

    // Log performance if needed
    this.logPerformance(effectiveRequest, result);

    return { success: true, data: result };
  }

  /**
   * Find test files with enhanced framework support
   */
  async findTestFiles(directory: string, framework?: string): Promise<string[]> {
    const validFramework = framework && isSupportedTestFramework(framework) ? framework : undefined;

    if (validFramework) {
      // Framework-specific patterns are built directly

      const patterns = this.getFrameworkTestPatternsEnhanced(validFramework);
      const request: EnhancedFileDiscoveryRequest = {
        baseDir: directory,
        type: FileDiscoveryType.TEST_EXECUTION,
        include: patterns,
        absolute: true,
        useCache: true,
      };

      const result = await this.findFilesEnhanced(request);
      return result.success ? result.data.files : [];
    }

    // Fallback to default behavior
    const result = await this.findFiles({
      baseDir: directory,
      type: FileDiscoveryType.TEST_EXECUTION,
      absolute: true,
      useCache: true,
    });
    return result.files;
  }

  /**
   * Check if a file exists
   */
  async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Invalidate cache entries matching pattern
   */
  invalidateCache(pattern?: string): void {
    if (pattern) {
      this.cache.invalidate(pattern);
    } else {
      this.cache.clear();
    }
  }

  /**
   * Get cache performance statistics
   */
  getCacheStats(): CacheStats {
    return this.cache.getStats();
  }

  /**
   * Convert standard request to enhanced request
   */
  private toEnhancedRequest(request: FileDiscoveryRequest): EnhancedFileDiscoveryRequest {
    const languages = request.languages?.filter(isSupportedLanguage).map((lang) => lang);

    const enhancedRequest: EnhancedFileDiscoveryRequest = {
      baseDir: request.baseDir,
      type: request.type,
    };

    if (request.include !== undefined) {
      enhancedRequest.include = request.include;
    }
    if (request.exclude !== undefined) {
      enhancedRequest.exclude = request.exclude;
    }
    if (languages !== undefined) {
      enhancedRequest.languages = languages;
    }
    if (request.absolute !== undefined) {
      enhancedRequest.absolute = request.absolute;
    }
    if (request.includeDirectories !== undefined) {
      enhancedRequest.includeDirectories = request.includeDirectories;
    }
    if (request.useCache !== undefined) {
      enhancedRequest.useCache = request.useCache;
    }
    if (request.configOverride !== undefined) {
      const config = request.configOverride;
      const override: FileDiscoveryConfigOverride = {
        ...(config && 'cache' in config && config.cache ? { cache: config.cache } : {}),
        ...(config && 'performance' in config && config.performance
          ? { performance: config.performance }
          : {}),
      };
      if (Object.keys(override).length > 0) {
        enhancedRequest.configOverride = override;
      }
    }

    return enhancedRequest;
  }

  /**
   * Convert enhanced request to cache key
   */
  private toCacheKey(request: EnhancedFileDiscoveryRequest): CacheKey {
    return {
      baseDir: request.baseDir,
      include: [...(request.include ?? [])],
      exclude: [...(request.exclude ?? [])],
      type: request.type,
      languages: [...(request.languages ?? [])].map((lang) => lang.toString()),
      options: {
        absolute: request.absolute ?? false,
        includeDirectories: request.includeDirectories ?? false,
      },
    };
  }

  /**
   * Validate directory exists and is accessible
   */
  private async validateDirectory(dirPath: string): Promise<EnhancedFileDiscoveryResult<void>> {
    try {
      const stat = await fs.stat(dirPath);
      if (!stat.isDirectory()) {
        return {
          success: false,
          error: {
            kind: 'DirectoryNotFoundError',
            path: dirPath,
            message: `Path exists but is not a directory: ${dirPath}`,
          },
        };
      }
      return { success: true, data: undefined };
    } catch (error: unknown) {
      const errorWithCode = error as NodeJS.ErrnoException;
      if (errorWithCode.code === 'ENOENT') {
        return {
          success: false,
          error: {
            kind: 'DirectoryNotFoundError',
            path: dirPath,
            message: `Directory does not exist: ${dirPath}`,
          },
        };
      } else if (errorWithCode.code === 'EACCES') {
        return {
          success: false,
          error: {
            kind: 'PermissionDeniedError',
            path: dirPath,
            message: `Permission denied accessing directory: ${dirPath}`,
          },
        };
      }
      throw error;
    }
  }

  /**
   * Apply configuration defaults to request
   */
  private applyConfigDefaults(request: EnhancedFileDiscoveryRequest): EnhancedFileDiscoveryRequest {
    return {
      ...request,
      useCache: request.useCache ?? this.config.cache.enabled,
    };
  }

  /**
   * Resolve include patterns with enhanced language support
   */
  private resolveIncludePatterns(request: EnhancedFileDiscoveryRequest): string[] {
    if (request.include?.length) {
      return [...request.include];
    }

    // Convert enhanced languages to standard strings for pattern manager
    const languageStrings = request.languages?.map((lang) => lang.toString()) ?? [];
    return this.patternManager.getIncludePatterns(request.type, languageStrings);
  }

  /**
   * Resolve exclude patterns with enhanced language support
   */
  private resolveExcludePatterns(request: EnhancedFileDiscoveryRequest): string[] {
    const languageStrings = request.languages?.map((lang) => lang.toString()) ?? [];
    const defaultExcludes = this.patternManager.getExcludePatterns(request.type, languageStrings);
    const requestExcludes = request.exclude ?? [];
    return [...defaultExcludes, ...requestExcludes];
  }

  /**
   * Apply enhanced language filtering
   */
  private applyEnhancedLanguageFiltering(
    files: string[],
    languages?: ReadonlyArray<SupportedLanguage>
  ): string[] {
    if (!languages?.length) {
      return files;
    }

    const extensionMap: Record<SupportedLanguage, string[]> = {
      [SupportedLanguageEnum.JAVASCRIPT]: ['.js', '.jsx', '.mjs', '.cjs'],
      [SupportedLanguageEnum.TYPESCRIPT]: ['.ts', '.tsx', '.d.ts'],
      [SupportedLanguageEnum.PYTHON]: ['.py', '.pyx', '.pyi'],
      [SupportedLanguageEnum.VUE]: ['.vue'],
      [SupportedLanguageEnum.SVELTE]: ['.svelte'],
    };

    const allowedExtensions = new Set<string>();
    for (const language of languages) {
      const extensions = extensionMap[language];
      if (extensions) {
        extensions.forEach((ext) => allowedExtensions.add(ext));
      }
    }

    return files.filter((file) => {
      const ext = path.extname(file).toLowerCase();
      return allowedExtensions.has(ext);
    });
  }

  /**
   * Get framework-specific test patterns with enhanced types
   */
  private getFrameworkTestPatternsEnhanced(framework: SupportedTestFramework): string[] {
    const patterns: Record<SupportedTestFramework, string[]> = {
      [SupportedTestFrameworkEnum.JEST]: [
        '**/*.test.{js,ts,jsx,tsx}',
        '**/*.spec.{js,ts,jsx,tsx}',
        '**/__tests__/**/*.{js,ts,jsx,tsx}',
      ],
      [SupportedTestFrameworkEnum.VITEST]: [
        '**/*.{test,spec}.{js,ts,jsx,tsx}',
        '**/test/**/*.{js,ts,jsx,tsx}',
      ],
      [SupportedTestFrameworkEnum.PYTEST]: ['**/test_*.py', '**/*_test.py', '**/tests/**/*.py'],
      [SupportedTestFrameworkEnum.MOCHA]: ['**/*.test.js', '**/*.spec.js', '**/test/**/*.js'],
    };

    return patterns[framework];
  }

  /**
   * Create error result for standard interface
   */
  private createErrorResult(_error: FileDiscoveryError): FileDiscoveryResult {
    return {
      files: [],
      fromCache: false,
      duration: 0,
      stats: {
        totalScanned: 0,
        included: 0,
        excluded: 0,
        languageFiltered: 0,
      },
    };
  }

  /**
   * Log performance metrics
   */
  private logPerformance(request: EnhancedFileDiscoveryRequest, result: FileDiscoveryResult): void {
    if (
      this.config.performance.logSlowOperations &&
      result.duration > this.config.performance.slowThresholdMs
    ) {
      console.warn(
        `Slow file discovery operation: ${result.duration}ms for ${request.baseDir} (${result.files.length} files)`
      );
    }

    if (this.config.performance.enableStats) {
      logger(
        'File discovery stats: type=%s duration=%dms files=%d fromCache=%s baseDir=%s',
        request.type,
        result.duration,
        result.files.length,
        result.fromCache,
        request.baseDir
      );
    }
  }

  /**
   * Get default configuration when no config service is provided
   */
  private getDefaultConfig(): FileDiscoveryConfig {
    return {
      cache: {
        enabled: true,
        ttl: 300000, // 5 minutes
        maxSize: 1000,
      },
      patterns: {},
      performance: {
        enableStats: false,
        logSlowOperations: true,
        slowThresholdMs: 1000,
      },
    };
  }
}
