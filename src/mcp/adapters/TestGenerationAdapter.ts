/**
 * Test Generation Adapter
 *
 * Service adapter for integrating StructuralTestGenerator with MCP tools.
 * Provides standardized interface for test generation with caching,
 * error handling, and performance optimization.
 *
 * Implements TASK-2025-206: Create ProjectAnalysisAdapter and TestGenerationAdapter
 *
 * @module mcp/adapters/TestGenerationAdapter
 */

import { z } from 'zod';
import { ResilientServiceAdapter, FallbackStrategy } from './ResilientServiceAdapter';
import type { MCPToolContext } from '../services/MCPLoggingService';
import { MCPToolError, MCPToolErrorType } from '../../types/mcp-tool-types';
import { 
  StructuralTestGenerator, 
  type StructuralTestGeneratorOptions 
} from '../../generators/StructuralTestGenerator';
import type { ProjectAnalysis } from '../../analyzers/ProjectAnalyzer';
import type { TestGeneratorConfig, GeneratedTest } from '../../generators/TestGenerator';
import { CacheLayer } from '../services/MCPCacheManager';
import { logger } from '../../utils/logger';
import crypto from 'crypto';

/**
 * Test generation strategy options
 */
export const TestGenerationStrategySchema = z.enum(['structural', 'minimal', 'comprehensive']);

export type TestGenerationStrategy = z.infer<typeof TestGenerationStrategySchema>;

/**
 * Parameters for test generation
 */
export const TestGenerationParamsSchema = z.object({
  /** Project root directory */
  projectPath: z.string().min(1, 'Project path is required'),
  
  /** Project analysis data (if available) */
  projectAnalysis: z.any().optional(),
  
  /** Test generation strategy */
  strategy: TestGenerationStrategySchema.optional().default('structural'),
  
  /** File patterns to include */
  include: z.array(z.string()).optional(),
  
  /** File patterns to exclude */
  exclude: z.array(z.string()).optional(),
  
  /** Generate mock files */
  generateMocks: z.boolean().optional().default(true),
  
  /** Generate setup files */
  generateSetup: z.boolean().optional().default(true),
  
  /** Include test data */
  includeTestData: z.boolean().optional().default(false),
  
  /** Skip files that already have tests */
  skipExistingTests: z.boolean().optional().default(true),
  
  /** Dry run mode (don't create files) */
  dryRun: z.boolean().optional().default(false),
  
  /** Force fresh generation (bypass cache) */
  forceFresh: z.boolean().optional().default(false),
});

export type TestGenerationParams = z.infer<typeof TestGenerationParamsSchema>;

/**
 * Test generation result with metadata
 */
export interface TestGenerationResult {
  /** Generated test files */
  tests: GeneratedTest[];
  
  /** Summary statistics */
  summary: {
    /** Total number of test files generated */
    testFilesGenerated: number;
    
    /** Total number of source files analyzed */
    sourceFilesAnalyzed: number;
    
    /** Number of mock files created */
    mockFilesCreated: number;
    
    /** Number of setup files created */
    setupFilesCreated: number;
    
    /** Files skipped (already had tests) */
    filesSkipped: number;
  };
  
  /** Adapter execution metadata */
  metadata: {
    /** Time taken for generation in milliseconds */
    duration: number;
    
    /** Whether result came from cache */
    fromCache: boolean;
    
    /** Cache key used for this generation */
    cacheKey: string;
    
    /** Generation strategy used */
    strategy: TestGenerationStrategy | 'cached' | 'fallback';
    
    /** Whether this was a dry run */
    dryRun: boolean;
  };
}

/**
 * Test generation adapter with resilience features
 */
export class TestGenerationAdapter extends ResilientServiceAdapter<
  TestGenerationParams,
  TestGenerationResult
> {
  public readonly name = 'test-generation-adapter';
  public readonly description = 'Adapter for StructuralTestGenerator with caching and resilience';
  public readonly parameters = TestGenerationParamsSchema;

  protected readonly cacheLayer = CacheLayer.TestGeneration;

  constructor() {
    super({
      enableFallback: true,
      fallbackStrategy: FallbackStrategy.Simplified,
      maxRetries: 2,
      retryDelay: 2000,
      operationTimeout: 30000, // 30 second timeout for test generation
    });
  }

  /**
   * Generate cache key based on generation parameters
   */
  public getCacheKey(params: TestGenerationParams): string {
    const keyData = {
      projectPath: params.projectPath,
      strategy: params.strategy,
      include: params.include?.sort(),
      exclude: params.exclude?.sort(),
      generateMocks: params.generateMocks,
      generateSetup: params.generateSetup,
      includeTestData: params.includeTestData,
      skipExistingTests: params.skipExistingTests,
    };

    const hash = crypto
      .createHash('sha256')
      .update(JSON.stringify(keyData))
      .digest('hex')
      .substring(0, 16);

    return `testgen:${hash}`;
  }

  /**
   * Get cache TTL - 15 minutes for test generation (less frequent than analysis)
   */
  public getTTL(): number {
    return 15 * 60 * 1000; // 15 minutes
  }

  /**
   * Core test generation execution
   */
  protected async executeCore(
    params: TestGenerationParams,
    context: MCPToolContext
  ): Promise<TestGenerationResult> {
    const startTime = Date.now();
    
    try {
      logger.info(`Starting test generation for: ${params.projectPath}`, {
        sessionId: context.sessionId,
        strategy: params.strategy,
        dryRun: params.dryRun,
      });

      // Force cache invalidation if requested
      if (params.forceFresh) {
        const cacheKey = this.getCacheKey(params);
        await this.cacheManager.invalidate(this.cacheLayer, cacheKey);
        logger.debug('Forced cache invalidation for fresh test generation');
      }

      // Get or create project analysis
      const projectAnalysis = await this.getProjectAnalysis(params, context);

      // Create test generator configuration
      const generatorConfig: TestGeneratorConfig = {
        projectPath: params.projectPath,
        outputDir: `${params.projectPath}/.claude-testing`,
        patterns: {
          include: params.include || [],
          exclude: params.exclude || [],
        },
        frameworks: this.extractFrameworksFromAnalysis(projectAnalysis),
      };

      // Create generator options
      const generatorOptions: StructuralTestGeneratorOptions = {
        includePatterns: params.include || undefined,
        excludePatterns: params.exclude || undefined,
        generateMocks: params.generateMocks,
        generateSetup: params.generateSetup,
        includeTestData: params.includeTestData,
        skipExistingTests: params.skipExistingTests,
        dryRun: params.dryRun,
      };

      // Create and configure test generator
      const generator = new StructuralTestGenerator(
        generatorConfig,
        projectAnalysis,
        generatorOptions
      );

      // Generate tests based on strategy
      const tests = await this.executeGenerationStrategy(
        generator,
        params.strategy,
        context
      );

      const duration = Date.now() - startTime;

      // Create result with summary
      const result: TestGenerationResult = {
        tests,
        summary: this.createSummary(tests, generatorOptions),
        metadata: {
          duration,
          fromCache: false,
          cacheKey: this.getCacheKey(params),
          strategy: params.strategy,
          dryRun: params.dryRun,
        },
      };

      logger.info(`Test generation completed in ${duration}ms`, {
        sessionId: context.sessionId,
        testFilesGenerated: result.summary.testFilesGenerated,
        sourceFilesAnalyzed: result.summary.sourceFilesAnalyzed,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      logger.error(`Test generation failed after ${duration}ms:`, {
        error: (error as Error).message,
        sessionId: context.sessionId,
        projectPath: params.projectPath,
      });

      this.handleServiceError(error as Error, context);
    }
  }

  /**
   * Get project analysis, either from params or by analyzing the project
   */
  private async getProjectAnalysis(
    params: TestGenerationParams,
    context: MCPToolContext
  ): Promise<ProjectAnalysis> {
    if (params.projectAnalysis) {
      logger.debug('Using provided project analysis');
      return params.projectAnalysis as ProjectAnalysis;
    }

    // If no analysis provided, we need to create a minimal one
    // In a real implementation, this might use ProjectAnalysisAdapter
    logger.debug('Creating minimal project analysis for test generation');
    
    return {
      projectPath: params.projectPath,
      languages: [{ name: 'javascript', confidence: 0.8, files: [] }],
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
        confidence: 0.5,
        fileExtensionPattern: 'js',
      },
    };
  }

  /**
   * Extract framework information from project analysis
   */
  private extractFrameworksFromAnalysis(analysis: ProjectAnalysis): string[] {
    return analysis.frameworks.map(fw => fw.name);
  }

  /**
   * Execute test generation based on strategy
   */
  private async executeGenerationStrategy(
    generator: StructuralTestGenerator,
    strategy: TestGenerationStrategy,
    context: MCPToolContext
  ): Promise<GeneratedTest[]> {
    switch (strategy) {
      case 'minimal':
        logger.debug('Executing minimal test generation strategy');
        // For minimal, use the main method with limited scope
        const minimalResult = await generator.generateAllTests();
        return minimalResult.tests || [];
        
      case 'comprehensive':
        logger.debug('Executing comprehensive test generation strategy');
        const comprehensiveResult = await generator.generateAllTests();
        return comprehensiveResult.tests || [];
        
      case 'structural':
      default:
        logger.debug('Executing structural test generation strategy');
        const structuralResult = await generator.generateAllTests();
        return structuralResult.tests || [];
    }
  }

  /**
   * Create summary statistics from generated tests
   */
  private createSummary(
    tests: GeneratedTest[],
    options: StructuralTestGeneratorOptions
  ): TestGenerationResult['summary'] {
    const testFiles = tests.filter(test => test.testType.toString().includes('test'));
    const mockFiles = tests.filter(test => test.additionalFiles?.some(f => f.path.includes('mock')));
    const setupFiles = tests.filter(test => test.additionalFiles?.some(f => f.path.includes('setup')));

    return {
      testFilesGenerated: testFiles.length,
      sourceFilesAnalyzed: tests.length, // Each test corresponds to a source file
      mockFilesCreated: mockFiles.length,
      setupFilesCreated: setupFiles.length,
      filesSkipped: 0, // This would need to be tracked by the generator
    };
  }

  /**
   * Transform cached output to include metadata
   */
  public transformOutput(result: unknown): TestGenerationResult {
    // If result is already transformed, return as-is
    if (result && typeof result === 'object' && 'metadata' in result) {
      return result as TestGenerationResult;
    }

    // Transform cached result to include metadata
    const cachedResult = result as Omit<TestGenerationResult, 'metadata'>;
    
    return {
      ...cachedResult,
      metadata: {
        duration: 0,
        fromCache: true,
        cacheKey: 'cached',
        strategy: 'cached',
        dryRun: false,
      },
    };
  }

  /**
   * Simplified fallback implementation
   */
  protected async executeSimplifiedFallback(
    params: TestGenerationParams,
    context: MCPToolContext
  ): Promise<TestGenerationResult> {
    logger.warn('Executing simplified fallback for test generation', {
      sessionId: context.sessionId,
    });

    // Try minimal test generation with reduced options
    const simplifiedParams = {
      ...params,
      strategy: 'minimal' as TestGenerationStrategy,
      generateMocks: false,
      includeTestData: false,
      dryRun: true, // Safer in fallback mode
    };

    return this.executeCore(simplifiedParams, context);
  }

  /**
   * Default fallback with empty result
   */
  protected async executeDefaultFallback(
    params: TestGenerationParams,
    context: MCPToolContext
  ): Promise<TestGenerationResult> {
    logger.warn('Executing default fallback for test generation', {
      sessionId: context.sessionId,
    });

    return {
      tests: [],
      summary: {
        testFilesGenerated: 0,
        sourceFilesAnalyzed: 0,
        mockFilesCreated: 0,
        setupFilesCreated: 0,
        filesSkipped: 0,
      },
      metadata: {
        duration: 0,
        fromCache: false,
        cacheKey: this.getCacheKey(params),
        strategy: 'fallback',
        dryRun: true,
      },
    };
  }

  /**
   * Health check for the test generator
   */
  public async healthCheck(): Promise<{ status: 'healthy' | 'degraded' | 'failed'; details: string }> {
    try {
      // Test with a dry run generation
      const testResult = await this.executeCore(
        { 
          projectPath: process.cwd(), 
          strategy: 'minimal',
          dryRun: true,
          generateMocks: true,
          generateSetup: true,
          skipExistingTests: true,
          forceFresh: false,
          includeTestData: false,
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
        details: `Test generation completed in ${testResult.metadata.duration}ms`,
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
 * Factory function for creating TestGenerationAdapter instances
 */
export function createTestGenerationAdapter(): TestGenerationAdapter {
  return new TestGenerationAdapter();
}