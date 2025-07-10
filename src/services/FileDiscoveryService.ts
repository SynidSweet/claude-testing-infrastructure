/**
 * FileDiscoveryService provides centralized file discovery for all components
 *
 * This service integrates pattern management, caching, and configuration
 * to provide consistent file discovery across the infrastructure.
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
  type CacheKey,
  type FileDiscoveryConfig,
  type CacheStats,
} from '../types/file-discovery-types';

import { PatternManagerImpl } from './PatternManager';
import { MemoryFileDiscoveryCache, NullFileDiscoveryCache } from './FileDiscoveryCache';
import { ProjectStructureDetector } from './ProjectStructureDetector';
import type { ProjectStructureAnalysis } from './ProjectStructureDetector';

const logger: debug.Debugger = debug('claude-testing:file-discovery');

/**
 * Service for configuration retrieval
 */
export interface ConfigurationService {
  getFileDiscoveryConfig(): FileDiscoveryConfig;
}

/**
 * Main implementation of FileDiscoveryService
 */
export class FileDiscoveryServiceImpl implements FileDiscoveryService {
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
    const startTime = Date.now();

    // Apply configuration defaults to request
    let effectiveRequest = this.applyConfigDefaults(request);

    // Apply smart pattern detection if enabled
    if (this.config.smartDetection?.enabled !== false) {
      effectiveRequest = await this.analyzeAndEnhancePatterns(effectiveRequest);
    }

    // Generate cache key
    const cacheKey = this.generateCacheKey(effectiveRequest);

    // Check cache if enabled
    if (effectiveRequest.useCache !== false) {
      const cached = this.cache.get(cacheKey);
      if (cached) {
        return cached.result;
      }
    }

    // Resolve patterns
    const includePatterns =
      effectiveRequest.include ??
      this.patternManager.getIncludePatterns(effectiveRequest.type, effectiveRequest.languages);
    const excludePatterns = this.mergeExcludePatterns(effectiveRequest);

    // Validate base directory exists
    if (!(await this.directoryExists(effectiveRequest.baseDir))) {
      return this.createEmptyResult(startTime, 'Base directory does not exist');
    }

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
    } catch (error) {
      return this.createEmptyResult(startTime, `File discovery failed: ${String(error)}`);
    }

    // Apply language filtering if needed
    const filteredFiles = this.applyLanguageFiltering(files, effectiveRequest.languages);

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
      this.cache.set(cacheKey, result);
    }

    // Log slow operations and performance stats
    if (
      this.config.performance.logSlowOperations &&
      result.duration > this.config.performance.slowThresholdMs
    ) {
      console.warn(
        `Slow file discovery operation: ${result.duration}ms for ${effectiveRequest.baseDir} (${result.files.length} files)`
      );
    }

    // Log performance statistics if enabled
    if (this.config.performance.enableStats) {
      logger(
        'File discovery stats: type=%s duration=%dms files=%d fromCache=%s baseDir=%s',
        effectiveRequest.type,
        result.duration,
        result.files.length,
        result.fromCache,
        effectiveRequest.baseDir
      );
    }

    return result;
  }

  /**
   * Find test files in a directory for a specific framework
   */
  async findTestFiles(directory: string, framework?: string): Promise<string[]> {
    const request: FileDiscoveryRequest = {
      baseDir: directory,
      type: FileDiscoveryType.TEST_EXECUTION,
      absolute: true,
      useCache: true,
    };

    // Add framework-specific patterns if provided
    if (framework) {
      request.include = this.getFrameworkTestPatterns(framework);
    }

    const result = await this.findFiles(request);
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
   * Analyze project structure without modifying request
   * 
   * This method is useful for CLI tools that want to display
   * structure analysis results to users.
   */
  async analyzeProjectStructure(projectPath: string): Promise<ProjectStructureAnalysis> {
    const detector = new ProjectStructureDetector(projectPath);
    return await detector.analyzeStructure();
  }

  /**
   * Analyze project structure and apply smart patterns to discovery request
   * 
   * This method integrates ProjectStructureDetector to enhance file discovery
   * with intelligent pattern detection based on project layout analysis.
   */
  async analyzeAndEnhancePatterns(request: FileDiscoveryRequest): Promise<FileDiscoveryRequest> {
    // Skip smart detection if patterns are explicitly provided or disabled in config
    if ((request.include && request.include.length > 0) || this.config.smartDetection?.enabled === false) {
      return request;
    }

    try {

    const structureCacheKey: CacheKey = {
      baseDir: request.baseDir,
      include: ['__structure_analysis__'],
      exclude: [],
      type: request.type,
      languages: request.languages ?? [],
      options: {
        absolute: false,
        includeDirectories: false,
      },
    };
    const cached = this.cache.get(structureCacheKey);
    
    let analysis: ProjectStructureAnalysis;
    if (cached && cached.result.files.length > 0 && cached.result.files[0]) {
      // Use cached analysis stored as serialized JSON in files array
      analysis = JSON.parse(cached.result.files[0]) as ProjectStructureAnalysis;
    } else {
      const detector = new ProjectStructureDetector(request.baseDir);
      analysis = await detector.analyzeStructure();
      
      // Cache the analysis for future use
      this.cache.set(
        structureCacheKey,
        {
          files: [JSON.stringify(analysis)],
          fromCache: false,
          duration: 0,
          stats: {
            totalScanned: 0,
            included: 1,
            excluded: 0,
            languageFiltered: 0,
          },
        }
      );
    }

    // Only apply smart patterns if confidence meets threshold
    const confidenceThreshold = this.config.smartDetection?.confidenceThreshold ?? 0.7;
    if (analysis.confidence < confidenceThreshold) {
      logger('Smart pattern confidence too low: %d < %d, using defaults', analysis.confidence, confidenceThreshold);
      return request;
    }

    // Apply smart patterns based on discovery type
    const enhancedRequest = { ...request };
    
    switch (request.type) {
      case FileDiscoveryType.PROJECT_ANALYSIS:
      case FileDiscoveryType.TEST_GENERATION:
        enhancedRequest.include = analysis.suggestedPatterns.include;
        enhancedRequest.exclude = [...(request.exclude ?? []), ...analysis.suggestedPatterns.exclude];
        break;
        
      case FileDiscoveryType.TEST_EXECUTION:
        enhancedRequest.include = analysis.suggestedPatterns.testIncludes;
        enhancedRequest.exclude = [...(request.exclude ?? []), ...analysis.suggestedPatterns.testExcludes];
        break;
        
      default:
        // For other types, use general patterns
        enhancedRequest.include = analysis.suggestedPatterns.include;
        enhancedRequest.exclude = [...(request.exclude ?? []), ...analysis.suggestedPatterns.exclude];
    }

    logger('Smart pattern detection applied: %O', {
      detectedStructure: analysis.detectedStructure,
      confidence: analysis.confidence,
      patterns: enhancedRequest.include,
      threshold: confidenceThreshold,
    });

    return enhancedRequest;
    } catch (error) {
      logger('Smart pattern detection failed: %O', error);
      // Fall back to original request on error
      return request;
    }
  }

  /**
   * Apply configuration defaults to request
   */
  private applyConfigDefaults(request: FileDiscoveryRequest): FileDiscoveryRequest {
    return {
      ...request,
      useCache: request.useCache ?? this.config.cache.enabled,
    };
  }

  /**
   * Generate cache key from request parameters
   */
  private generateCacheKey(request: FileDiscoveryRequest): CacheKey {
    return {
      baseDir: request.baseDir,
      include: request.include ?? [],
      exclude: request.exclude ?? [],
      type: request.type,
      languages: request.languages ?? [],
      options: {
        absolute: request.absolute ?? false,
        includeDirectories: request.includeDirectories ?? false,
      },
    };
  }

  /**
   * Merge exclude patterns from request and configuration
   */
  private mergeExcludePatterns(request: FileDiscoveryRequest): string[] {
    const defaultExcludes = this.patternManager.getExcludePatterns(request.type, request.languages);
    const requestExcludes = request.exclude ?? [];

    return [...defaultExcludes, ...requestExcludes];
  }

  /**
   * Apply language-specific filtering to file list
   */
  private applyLanguageFiltering(files: string[], languages?: string[]): string[] {
    if (!languages?.length) {
      return files;
    }

    const languageExtensions = this.getLanguageExtensions(languages);
    if (languageExtensions.length === 0) {
      return files;
    }

    return files.filter((file) => {
      const ext = path.extname(file).toLowerCase();
      return languageExtensions.includes(ext);
    });
  }

  /**
   * Get file extensions for specified languages
   */
  private getLanguageExtensions(languages: string[]): string[] {
    const extensionMap: Record<string, string[]> = {
      javascript: ['.js', '.jsx', '.mjs', '.cjs'],
      typescript: ['.ts', '.tsx', '.d.ts'],
      python: ['.py', '.pyx', '.pyi'],
      vue: ['.vue'],
      svelte: ['.svelte'],
    };

    const extensions: string[] = [];
    for (const language of languages) {
      const langExtensions = extensionMap[language.toLowerCase()];
      if (langExtensions) {
        extensions.push(...langExtensions);
      }
    }

    return Array.from(new Set(extensions));
  }

  /**
   * Get framework-specific test patterns
   */
  private getFrameworkTestPatterns(framework: string): string[] {
    const frameworkPatterns: Record<string, string[]> = {
      jest: [
        '**/*.test.{js,ts,jsx,tsx}',
        '**/*.spec.{js,ts,jsx,tsx}',
        '**/__tests__/**/*.{js,ts,jsx,tsx}',
      ],
      vitest: ['**/*.{test,spec}.{js,ts,jsx,tsx}', '**/test/**/*.{js,ts,jsx,tsx}'],
      pytest: ['**/test_*.py', '**/*_test.py', '**/tests/**/*.py'],
      mocha: ['**/*.test.js', '**/*.spec.js', '**/test/**/*.js'],
    };

    return frameworkPatterns[framework.toLowerCase()] ?? frameworkPatterns.jest ?? [];
  }

  /**
   * Check if directory exists
   */
  private async directoryExists(dirPath: string): Promise<boolean> {
    try {
      const stat = await fs.stat(dirPath);
      return stat.isDirectory();
    } catch {
      return false;
    }
  }

  /**
   * Create empty result for error cases
   */
  private createEmptyResult(startTime: number, _reason?: string): FileDiscoveryResult {
    return {
      files: [],
      fromCache: false,
      duration: Date.now() - startTime,
      stats: {
        totalScanned: 0,
        included: 0,
        excluded: 0,
        languageFiltered: 0,
      },
    };
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
      smartDetection: {
        enabled: true,
        confidenceThreshold: 0.7, // 70% confidence required
        cacheAnalysis: true,
      },
    };
  }
}
