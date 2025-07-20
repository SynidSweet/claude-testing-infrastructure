/**
 * MCP Test Generate Tool
 *
 * Core MCP tool for generating comprehensive test suites using existing infrastructure.
 * This tool wraps StructuralTestGenerator and integrates with the TestTemplateEngine
 * to provide test generation through the MCP protocol.
 *
 * Implements TASK-2025-147: Implement test generation tools (test_generate)
 *
 * @module mcp/tools/TestGenerateTool
 */

import { logger } from '../../utils/logger';
import {
  TestGenerateSchema,
  type TestGenerateParams,
  type TestGenerateResult,
  type MCPToolError,
  MCPErrorCode,
  SupportedLanguage,
  TestFramework,
  TestStrategy,
} from '../tool-interfaces';
import type { MCPErrorResponse } from '../services/MCPErrorHandler';
import { StructuralTestGenerator, type StructuralTestGeneratorOptions } from '../../generators/StructuralTestGenerator';
import { ProjectAnalyzer } from '../../analyzers/ProjectAnalyzer';
import { handleMCPError, withCircuitBreaker } from '../services/MCPErrorHandler';
import { MCPCacheManager, CacheLayer } from '../services/MCPCacheManager';
import { getMCPLogger, MCPToolStatus, type MCPToolContext } from '../services/MCPLoggingService';
import type { TestGeneratorConfig } from '../../generators/TestGenerator';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Test Generate Tool implementation
 */
export class TestGenerateTool {
  public readonly name = 'mcp__claude-testing__test_generate';
  public readonly description = 'Generate comprehensive test suites for projects';

  private cacheManager: MCPCacheManager;
  private mcpLogger = getMCPLogger();

  constructor() {
    this.cacheManager = MCPCacheManager.getInstance();
  }

  /**
   * Execute the test generate tool
   */
  public async execute(params: unknown): Promise<TestGenerateResult | MCPToolError | MCPErrorResponse> {
    // Create logging context
    const context: MCPToolContext = {
      toolName: this.name,
      operation: 'generate_tests',
      parameters: params as Record<string, unknown>,
      sessionId: this.generateSessionId(),
      traceId: this.generateTraceId()
    };

    // Start logging
    const metrics = this.mcpLogger.logToolStart(context);

    return withCircuitBreaker('test_generate', async () => {
      try {
        // Validate input parameters
        const validatedParams = await this.validateParams(params);
        if (!validatedParams.success) {
          const error = {
            code: MCPErrorCode.InvalidInput,
            message: 'Test generate validation failed',
            details: { errors: validatedParams.errors },
            suggestion: 'Please provide valid parameters according to the schema',
            documentation: 'See TestGenerateSchema for required parameters',
          } as MCPToolError;
          
          this.mcpLogger.logToolComplete(context, metrics, MCPToolStatus.Failure, error);
          return error;
        }

        const data = validatedParams.data!;
        const { 
          targetPath, 
          strategy = TestStrategy.Both, 
          framework, 
          outputPath,
          options = {}
        } = data;

        logger.info('Starting test generation', {
          targetPath,
          strategy,
          framework,
          outputPath,
          options,
        });

        // Check if target path exists
        if (!fs.existsSync(targetPath)) {
          const error = {
            code: MCPErrorCode.InvalidInput,
            message: 'Target path does not exist',
            details: { path: targetPath },
            suggestion: 'Please provide a valid file or directory path',
          } as MCPToolError;
          
          this.mcpLogger.logToolComplete(context, metrics, MCPToolStatus.Failure, error);
          return error;
        }

        // Determine project path (if targetPath is a file, use its directory)
        const projectPath = fs.statSync(targetPath).isDirectory() ? targetPath : path.dirname(targetPath);

        // Check cache first
        const cacheKey = this.generateCacheKey(data);
        const cachedResult = await this.cacheManager.get<TestGenerateResult>(cacheKey, CacheLayer.TestGeneration);
        if (cachedResult) {
          logger.info('Returning cached test generation result', { projectPath });
          metrics.cacheHit = true;
          this.mcpLogger.logToolComplete(context, metrics, MCPToolStatus.Cached, cachedResult);
          return cachedResult;
        }

        // Log cache miss
        this.mcpLogger.logToolWarning(context, 'Cache miss, generating tests', { cacheKey });

        // Perform project analysis for test generation
        const startTime = Date.now();
        const analyzer = new ProjectAnalyzer(projectPath);
        const analysis = await analyzer.analyzeProject();

        // Create test generator config
        const detectedFramework = framework || this.detectFramework(analysis);
        const finalOutputPath = outputPath || path.join(projectPath, '.claude-testing');
        
        const generatorConfig: TestGeneratorConfig = {
          projectPath,
          outputPath: finalOutputPath,
          testFramework: detectedFramework.toString(),
          options: {
            generateMocks: options?.mockStrategy !== 'none',
            includeSetupTeardown: true,
            generateTestData: false,
            addCoverage: true,
            skipValidation: false,
          },
          patterns: {
            include: fs.statSync(targetPath).isFile() ? [targetPath] : ['**/*.{js,ts,jsx,tsx,py}'],
            exclude: ['**/*.test.*', '**/*.spec.*', '**/node_modules/**'],
          },
        };

        // Generate tests based on strategy
        let generatedTests: any;
        let generator: any;

        if (strategy === TestStrategy.Structural || strategy === TestStrategy.Both) {
          // Use StructuralTestGenerator for structural/both strategies
          const structuralOptions: StructuralTestGeneratorOptions = {
            includePatterns: fs.statSync(targetPath).isFile() ? [targetPath] : ['**/*.{js,ts,jsx,tsx,py}'],
            excludePatterns: ['**/*.test.*', '**/*.spec.*', '**/node_modules/**'],
            generateMocks: options?.mockStrategy !== 'none',
            generateSetup: true,
            includeTestData: false,
            skipExistingTests: false,
            skipValidation: false,
            dryRun: false,
          };

          generator = new StructuralTestGenerator(generatorConfig, analysis, structuralOptions);
          generatedTests = await generator.generateTests();
        } else {
          // Use TestGeneratorFactory for logical strategy - placeholder for now
          // TODO: Implement logical test generation when TestGeneratorFactory.create is available
          throw new Error('Logical test generation not yet implemented');
        }

        // Transform results to MCP format
        const result = await this.transformGenerationToMCPFormat(
          generatedTests,
          analysis,
          strategy,
          detectedFramework,
          startTime
        );

        // Cache the result
        await this.cacheManager.set(cacheKey, result, CacheLayer.TestGeneration);

        logger.info('Successfully completed test generation', {
          targetPath,
          strategy,
          testsGenerated: result.summary.totalTests,
          filesCreated: result.summary.totalFiles,
          duration: result.summary.generationTime,
        });

        // Log successful completion
        this.mcpLogger.logToolComplete(context, metrics, MCPToolStatus.Success, result);

        return result;

      } catch (error) {
        // Log error with MCP logging service
        this.mcpLogger.logToolError(context, metrics, error as Error);
        
        return handleMCPError(error as Error, 'test_generate', 'Test generation execution failed');
      }
    });
  }

  /**
   * Validate input parameters using Zod schema
   */
  private async validateParams(params: unknown): Promise<{
    success: boolean;
    data?: TestGenerateParams;
    errors?: string[];
  }> {
    try {
      const result = TestGenerateSchema.safeParse(params);
      if (result.success) {
        return { success: true, data: result.data };
      } else {
        const errors = result.error.errors.map(err => `${err.path.join('.')}: ${err.message}`);
        return { success: false, errors };
      }
    } catch (error) {
      return {
        success: false,
        errors: [`Validation error: ${(error as Error).message}`],
      };
    }
  }

  /**
   * Generate cache key for test generation results
   */
  private generateCacheKey(params: TestGenerateParams): string {
    const keyParts = [
      'test_generate',
      params.targetPath.replace(/[^a-zA-Z0-9]/g, '_'),
      params.strategy?.toString() || 'both',
      params.framework || 'auto',
      params.outputPath || 'default',
      JSON.stringify(params.options || {}),
    ];
    return keyParts.join(':');
  }


  /**
   * Detect appropriate test framework based on project analysis
   */
  private detectFramework(analysis: any): TestFramework {
    // Check for Jest configuration
    if (analysis.configurations?.jest || 
        analysis.dependencies?.devDependencies?.jest ||
        analysis.files?.some((f: any) => f.name.includes('jest.config'))) {
      return TestFramework.Jest;
    }

    // Check for Vitest
    if (analysis.dependencies?.devDependencies?.vitest ||
        analysis.files?.some((f: any) => f.name.includes('vitest.config'))) {
      return TestFramework.Vitest;
    }

    // Check for Python frameworks
    if (analysis.language === SupportedLanguage.Python) {
      if (analysis.dependencies?.requirements?.pytest) {
        return TestFramework.Pytest;
      }
      return TestFramework.Pytest; // Default to pytest for Python
    }

    // Default to Jest for JavaScript/TypeScript projects
    return TestFramework.Jest;
  }

  /**
   * Transform generation results to MCP format
   */
  private async transformGenerationToMCPFormat(
    generatedTests: any,
    analysis: any,
    strategy: TestStrategy,
    framework: TestFramework,
    startTime: number
  ): Promise<TestGenerateResult> {
    const duration = Date.now() - startTime;
    
    // Extract generated files from result
    const generatedFiles = generatedTests.files || [];
    
    // Transform to expected format
    const generated = generatedFiles.map((file: any) => ({
      filePath: file.path,
      testType: this.determineTestType(file),
      testsCount: file.tests?.length || this.estimateTestsCount(file),
      linesOfCode: file.content?.split('\n').length || 0,
      coverageEstimate: this.estimateCoverage(file, analysis),
    }));

    // Calculate summary statistics
    const totalTests = generated.reduce((sum, file) => sum + file.testsCount, 0);
    const totalFiles = generated.length;
    const estimatedCoverage = totalTests > 0 ? 
      generated.reduce((sum, file) => sum + file.coverageEstimate, 0) / totalFiles : 0;

    // Extract errors from generation process
    const errors = generatedTests.errors || [];

    return {
      generated,
      summary: {
        totalTests,
        totalFiles,
        estimatedCoverage,
        generationTime: duration,
      },
      errors: errors.map((err: any) => ({
        component: err.component || 'unknown',
        reason: err.message || err.reason || 'Unknown error',
        suggestion: err.suggestion || 'Check logs for more details',
      })),
      metadata: {
        strategy,
        framework,
        generatedAt: new Date(),
      },
    };
  }

  /**
   * Determine test type based on file characteristics
   */
  private determineTestType(file: any): 'unit' | 'integration' | 'e2e' {
    const filePath = file.path || '';
    if (filePath.includes('integration') || filePath.includes('e2e')) {
      return filePath.includes('e2e') ? 'e2e' : 'integration';
    }
    return 'unit';
  }

  /**
   * Estimate number of tests in a file
   */
  private estimateTestsCount(file: any): number {
    const content = file.content || '';
    const testMatches = content.match(/(test|it|describe)\s*\(/g);
    return testMatches ? testMatches.length : 1;
  }

  /**
   * Estimate coverage based on file and analysis
   */
  private estimateCoverage(file: any, analysis: any): number {
    // Simple heuristic: more tests = higher coverage estimate
    const testsCount = this.estimateTestsCount(file);
    const complexity = analysis.complexity?.average || 1;
    
    // Base coverage estimate between 60-90% depending on tests and complexity
    const baseCoverage = Math.min(90, 60 + (testsCount * 10) - (complexity * 5));
    return Math.max(60, baseCoverage);
  }

  /**
   * Generate session ID for logging context
   */
  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate trace ID for logging context
   */
  private generateTraceId(): string {
    return `trace-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Factory function for creating TestGenerateTool instances
 */
export function createTestGenerateTool(): TestGenerateTool {
  return new TestGenerateTool();
}