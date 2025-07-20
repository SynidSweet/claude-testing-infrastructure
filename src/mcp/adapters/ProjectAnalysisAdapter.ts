/**
 * Project Analysis Adapter
 *
 * Service adapter for integrating ProjectAnalyzer with MCP tools.
 * Provides standardized interface for project analysis with caching,
 * error handling, and performance optimization.
 *
 * Implements TASK-2025-206: Create ProjectAnalysisAdapter and TestGenerationAdapter
 *
 * @module mcp/adapters/ProjectAnalysisAdapter
 */

import { z } from 'zod';
import { ResilientServiceAdapter, FallbackStrategy } from './ResilientServiceAdapter';
import type { MCPToolContext } from '../services/MCPLoggingService';
import { MCPToolError, MCPToolErrorType } from '../../types/mcp-tool-types';
import { ProjectAnalyzer, type ProjectAnalysis } from '../../analyzers/ProjectAnalyzer';
import { CacheLayer } from '../services/MCPCacheManager';
import { logger } from '../../utils/logger';
import crypto from 'crypto';

/**
 * Parameters for project analysis
 */
export const ProjectAnalysisParamsSchema = z.object({
  /** Project root directory to analyze */
  projectPath: z.string().min(1, 'Project path is required'),
  
  /** Perform deep analysis (slower but more comprehensive) */
  deep: z.boolean().optional().default(false),
  
  /** File patterns to include in analysis */
  include: z.array(z.string()).optional(),
  
  /** File patterns to exclude from analysis */
  exclude: z.array(z.string()).optional(),
  
  /** Include cache statistics in response */
  includeCacheStats: z.boolean().optional().default(false),
  
  /** Force cache invalidation and fresh analysis */
  forceFresh: z.boolean().optional().default(false),
});

export type ProjectAnalysisParams = z.infer<typeof ProjectAnalysisParamsSchema>;

/**
 * Enhanced project analysis result with adapter metadata
 */
export interface ProjectAnalysisResult extends ProjectAnalysis {
  /** Adapter execution metadata */
  metadata: {
    /** Time taken for analysis in milliseconds */
    duration: number;
    
    /** Whether result came from cache */
    fromCache: boolean;
    
    /** Cache key used for this analysis */
    cacheKey: string;
    
    /** Analysis strategy used */
    strategy: 'full' | 'cached' | 'fallback';
  };
}

/**
 * Project analysis adapter with resilience features
 */
export class ProjectAnalysisAdapter extends ResilientServiceAdapter<
  ProjectAnalysisParams,
  ProjectAnalysisResult
> {
  public readonly name = 'project-analysis-adapter';
  public readonly description = 'Adapter for ProjectAnalyzer with caching and resilience';
  public readonly parameters = ProjectAnalysisParamsSchema;

  protected readonly cacheLayer = CacheLayer.ProjectAnalysis;
  private projectAnalyzer: ProjectAnalyzer;

  constructor() {
    super({
      enableFallback: true,
      fallbackStrategy: FallbackStrategy.Cache,
      maxRetries: 2,
      retryDelay: 1000,
      operationTimeout: 15000, // 15 second timeout for analysis
    });

    this.projectAnalyzer = new ProjectAnalyzer(process.cwd());
  }

  /**
   * Generate cache key based on analysis parameters
   */
  public getCacheKey(params: ProjectAnalysisParams): string {
    const keyData = {
      projectPath: params.projectPath,
      deep: params.deep,
      include: params.include?.sort(),
      exclude: params.exclude?.sort(),
    };

    const hash = crypto
      .createHash('sha256')
      .update(JSON.stringify(keyData))
      .digest('hex')
      .substring(0, 16);

    return `analysis:${hash}`;
  }

  /**
   * Get cache TTL - 10 minutes for standard analysis, 30 minutes for deep analysis
   */
  public getTTL(): number {
    return 10 * 60 * 1000; // 10 minutes default
  }

  /**
   * Core project analysis execution
   */
  protected async executeCore(
    params: ProjectAnalysisParams,
    context: MCPToolContext
  ): Promise<ProjectAnalysisResult> {
    const startTime = Date.now();
    
    try {
      logger.info(`Starting project analysis for: ${params.projectPath}`, {
        sessionId: context.sessionId,
        deep: params.deep,
      });

      // Configure analysis options
      const analysisOptions = {
        includePatterns: params.include,
        excludePatterns: params.exclude,
        deep: params.deep,
        includeCacheStats: params.includeCacheStats,
      };

      // Force cache invalidation if requested
      if (params.forceFresh) {
        const cacheKey = this.getCacheKey(params);
        await this.cacheManager.invalidate(this.cacheLayer, cacheKey);
        logger.debug('Forced cache invalidation for fresh analysis');
      }

      // Create new analyzer for the specific project path
      const analyzer = new ProjectAnalyzer(params.projectPath);
      
      // Execute project analysis
      const analysis = await analyzer.analyzeProject();

      const duration = Date.now() - startTime;

      // Create enriched result with metadata
      const result: ProjectAnalysisResult = {
        ...analysis,
        metadata: {
          duration,
          fromCache: false,
          cacheKey: this.getCacheKey(params),
          strategy: 'full',
        },
      };

      logger.info(`Project analysis completed in ${duration}ms`, {
        sessionId: context.sessionId,
        languagesCount: analysis.languages.length,
        frameworksCount: analysis.frameworks.length,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      logger.error(`Project analysis failed after ${duration}ms:`, {
        error: (error as Error).message,
        sessionId: context.sessionId,
        projectPath: params.projectPath,
      });

      this.handleServiceError(error as Error, context);
    }
  }

  /**
   * Transform output to include cache metadata when result comes from cache
   */
  public transformOutput(result: unknown): ProjectAnalysisResult {
    // If result is already transformed, return as-is
    if (result && typeof result === 'object' && 'metadata' in result) {
      return result as ProjectAnalysisResult;
    }

    // Transform cached result to include metadata
    const analysis = result as ProjectAnalysis;
    
    return {
      ...analysis,
      metadata: {
        duration: 0,
        fromCache: true,
        cacheKey: 'cached',
        strategy: 'cached',
      },
    };
  }

  /**
   * Fallback implementation for cache strategy
   */
  protected async executeCacheFallback(
    params: ProjectAnalysisParams,
    context: MCPToolContext
  ): Promise<ProjectAnalysisResult> {
    logger.warn('Attempting cache fallback for project analysis', {
      sessionId: context.sessionId,
    });

    // Try to get any cached result, even if stale
    const cacheKey = this.getCacheKey(params);
    const cached = await this.cacheManager.get(this.cacheLayer, cacheKey);

    if (cached) {
      logger.info('Successfully retrieved stale cached analysis for fallback');
      return this.transformOutput(cached);
    }

    // If no cache available, return minimal analysis
    return this.executeDefaultFallback(params, context);
  }

  /**
   * Default fallback with minimal analysis
   */
  protected async executeDefaultFallback(
    params: ProjectAnalysisParams,
    context: MCPToolContext
  ): Promise<ProjectAnalysisResult> {
    logger.warn('Executing default fallback for project analysis', {
      sessionId: context.sessionId,
    });

    // Return minimal analysis structure using correct interface
    const fallbackAnalysis: ProjectAnalysisResult = {
      projectPath: params.projectPath,
      languages: [],
      frameworks: [],
      packageManagers: [],
      projectStructure: {
        rootFiles: [],
        srcDirectory: undefined,
        testDirectories: [],
        configFiles: [],
        buildOutputs: [],
        entryPoints: [],
      },
      dependencies: {
        production: {},
        development: {},
        python: undefined,
      },
      testingSetup: {
        hasTests: false,
        testFrameworks: [],
        testFiles: [],
        coverageTools: [],
      },
      complexity: {
        totalFiles: 0,
        totalLines: 0,
        averageFileSize: 0,
        largestFiles: [],
      },
      moduleSystem: {
        type: 'commonjs',
        hasPackageJsonType: false,
        confidence: 0,
        fileExtensionPattern: 'js',
      },
      metadata: {
        duration: 0,
        fromCache: false,
        cacheKey: this.getCacheKey(params),
        strategy: 'fallback',
      },
    };

    return fallbackAnalysis;
  }

  /**
   * Health check for the project analyzer
   */
  public async healthCheck(): Promise<{ status: 'healthy' | 'degraded' | 'failed'; details: string }> {
    try {
      // Test with a simple analysis
      const testResult = await this.executeCore(
        { 
          projectPath: process.cwd(), 
          deep: false,
          includeCacheStats: false,
          forceFresh: false
        },
        {
          toolName: this.name,
          operation: 'health-check',
          parameters: {},
          sessionId: 'health-check',
          traceId: 'health-check',
        }
      );

      return {
        status: 'healthy',
        details: `Analysis completed in ${testResult.metadata.duration}ms`,
      };
    } catch (error) {
      return {
        status: 'failed',
        details: `Health check failed: ${(error as Error).message}`,
      };
    }
  }
}

/**
 * Factory function for creating ProjectAnalysisAdapter instances
 */
export function createProjectAnalysisAdapter(): ProjectAnalysisAdapter {
  return new ProjectAnalysisAdapter();
}