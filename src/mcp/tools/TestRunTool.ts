/**
 * MCP Test Run Tool
 *
 * Core MCP tool for executing tests and collecting coverage data using existing infrastructure.
 * This tool wraps JestRunner and other test runners to provide test execution through the MCP protocol.
 *
 * Implements TASK-2025-147: Implement test generation tools (test_run)
 *
 * @module mcp/tools/TestRunTool
 */

import { logger } from '../../utils/logger';
import {
  TestRunSchema,
  type TestRunParams,
  type TestRunResult,
  type MCPToolError,
  MCPErrorCode,
  TestFramework,
} from '../tool-interfaces';
import type { MCPErrorResponse } from '../services/MCPErrorHandler';
import { JestRunner } from '../../runners/JestRunner';
import { TestRunnerFactory } from '../../runners/TestRunnerFactory';
import type { TestRunnerConfig, TestResult, CoverageResult } from '../../runners/TestRunner';
import { ProjectAnalyzer } from '../../analyzers/ProjectAnalyzer';
import { handleMCPError, withCircuitBreaker } from '../services/MCPErrorHandler';
import { MCPCacheManager, CacheLayer } from '../services/MCPCacheManager';
import { getMCPLogger, MCPToolStatus, type MCPToolContext } from '../services/MCPLoggingService';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Test Run Tool implementation
 */
export class TestRunTool {
  public readonly name = 'mcp__claude-testing__test_run';
  public readonly description = 'Execute tests and collect coverage data';

  private cacheManager: MCPCacheManager;
  private mcpLogger = getMCPLogger();

  constructor() {
    this.cacheManager = MCPCacheManager.getInstance();
  }

  /**
   * Execute the test run tool
   */
  public async execute(params: unknown): Promise<TestRunResult | MCPToolError | MCPErrorResponse> {
    // Create logging context
    const context: MCPToolContext = {
      toolName: this.name,
      operation: 'run_tests',
      parameters: params as Record<string, unknown>,
      sessionId: this.generateSessionId(),
      traceId: this.generateTraceId()
    };

    // Start logging
    const metrics = this.mcpLogger.logToolStart(context);

    return withCircuitBreaker('test_run', async () => {
      try {
        // Validate input parameters
        const validatedParams = await this.validateParams(params);
        if (!validatedParams.success) {
          const error = {
            code: MCPErrorCode.InvalidInput,
            message: 'Test run validation failed',
            details: { errors: validatedParams.errors },
            suggestion: 'Please provide valid parameters according to the schema',
            documentation: 'See TestRunSchema for required parameters',
          } as MCPToolError;
          
          this.mcpLogger.logToolComplete(context, metrics, MCPToolStatus.Failure, error);
          return error;
        }

        const data = validatedParams.data!;
        const { 
          projectPath, 
          testPattern, 
          framework, 
          coverage = true, 
          watch = false,
          bail = false
        } = data;

        logger.info('Starting test execution', {
          projectPath,
          testPattern,
          framework,
          coverage,
          watch,
          bail,
        });

        // Check if project path exists
        if (!fs.existsSync(projectPath)) {
          const error = {
            code: MCPErrorCode.InvalidInput,
            message: 'Project path does not exist',
            details: { path: projectPath },
            suggestion: 'Please provide a valid project directory path',
          } as MCPToolError;
          
          this.mcpLogger.logToolComplete(context, metrics, MCPToolStatus.Failure, error);
          return error;
        }

        // Check cache first (for deterministic test runs)
        let cacheKey: string | null = null;
        if (!watch) {
          cacheKey = this.generateCacheKey(data);
          const cachedResult = await this.cacheManager.get<TestRunResult>(cacheKey, CacheLayer.TestExecution);
          if (cachedResult) {
            logger.info('Returning cached test execution result', { projectPath });
            metrics.cacheHit = true;
            this.mcpLogger.logToolComplete(context, metrics, MCPToolStatus.Cached, cachedResult);
            return cachedResult;
          }
        }

        // Log cache miss or watch mode
        if (!watch) {
          this.mcpLogger.logToolWarning(context, 'Cache miss, executing tests', { cacheKey });
        } else {
          this.mcpLogger.logToolWarning(context, 'Watch mode enabled, bypassing cache', {});
        }

        // Perform project analysis to detect framework if not specified
        const startTime = Date.now();
        const analyzer = new ProjectAnalyzer(projectPath);
        const analysis = await analyzer.analyzeProject();

        // Detect framework if not provided
        const detectedFramework = framework || this.detectFramework(analysis);

        // Create test runner config
        const testPath = testPattern || this.getDefaultTestPattern(projectPath, detectedFramework);
        const runnerConfig: TestRunnerConfig = {
          projectPath,
          testPath,
          framework: detectedFramework.toString(),
          coverage: coverage ? {
            enabled: true,
            thresholds: {
              statements: 80,
              branches: 70,
              functions: 80,
              lines: 80,
            },
          } : undefined,
          watch,
          reporter: {
            console: 'normal',
            junit: false,
          },
        };

        // Execute tests using appropriate runner
        let testResult: TestResult;
        let coverageResult: CoverageResult | undefined;

        if (detectedFramework === TestFramework.Jest) {
          const jestRunner = new JestRunner(runnerConfig, analysis);
          testResult = await jestRunner.run();
          if (coverage) {
            coverageResult = (testResult as any).coverage;
          }
        } else {
          // TODO: Implement other test runners when available
          throw new Error(`Test framework ${detectedFramework} not yet supported`);
        }

        // Transform results to MCP format
        const result = await this.transformExecutionToMCPFormat(
          testResult,
          coverageResult,
          detectedFramework,
          startTime
        );

        // Cache the result (only for non-watch runs)
        if (cacheKey && !watch) {
          await this.cacheManager.set(cacheKey, result, CacheLayer.TestExecution);
        }

        logger.info('Successfully completed test execution', {
          projectPath,
          framework: detectedFramework,
          testsRun: result.results.passed + result.results.failed + result.results.skipped,
          passed: result.results.passed,
          failed: result.results.failed,
          duration: result.results.duration,
        });

        // Determine status based on test results
        const status = result.results.failed > 0 ? MCPToolStatus.Partial : MCPToolStatus.Success;
        
        // Log completion with appropriate status
        this.mcpLogger.logToolComplete(context, metrics, status, result);

        return result;

      } catch (error) {
        // Log error with MCP logging service
        this.mcpLogger.logToolError(context, metrics, error as Error);
        
        return handleMCPError(error as Error, 'test_run', 'Test execution failed');
      }
    });
  }

  /**
   * Validate input parameters using Zod schema
   */
  private async validateParams(params: unknown): Promise<{
    success: boolean;
    data?: TestRunParams;
    errors?: string[];
  }> {
    try {
      const result = TestRunSchema.safeParse(params);
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
   * Generate cache key for test execution results
   */
  private generateCacheKey(params: TestRunParams): string {
    const keyParts = [
      'test_run',
      params.projectPath.replace(/[^a-zA-Z0-9]/g, '_'),
      params.framework || 'auto',
      params.testPattern || 'default',
      params.coverage ? 'coverage' : 'no-coverage',
      params.bail ? 'bail' : 'no-bail',
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
    if (analysis.language === 'python') {
      if (analysis.dependencies?.requirements?.pytest) {
        return TestFramework.Pytest;
      }
      return TestFramework.Pytest; // Default to pytest for Python
    }

    // Default to Jest for JavaScript/TypeScript projects
    return TestFramework.Jest;
  }

  /**
   * Get default test pattern based on framework conventions
   */
  private getDefaultTestPattern(projectPath: string, framework: TestFramework): string {
    if (framework === TestFramework.Jest || framework === TestFramework.Vitest) {
      // JavaScript/TypeScript test patterns
      return '**/*.{test,spec}.{js,ts,jsx,tsx}';
    } else if (framework === TestFramework.Pytest) {
      // Python test patterns
      return '**/test_*.py';
    }
    
    // Default pattern
    return '**/*.{test,spec}.{js,ts,jsx,tsx}';
  }

  /**
   * Transform execution results to MCP format
   */
  private async transformExecutionToMCPFormat(
    testResult: TestResult,
    coverageResult: CoverageResult | undefined,
    framework: TestFramework,
    startTime: number
  ): Promise<TestRunResult> {
    const duration = Date.now() - startTime;

    // Transform to expected TestResult interface  
    const results = {
      passed: testResult.passed || 0,
      failed: testResult.failed || 0,
      skipped: testResult.skipped || 0,
      duration: testResult.duration || duration,
      coverage: coverageResult ? this.transformCoverageToMetrics(coverageResult) : undefined,
      failedTests: testResult.failures?.map(failure => ({
        name: (failure as any).testName || 'Unknown test',
        error: failure.message || 'Unknown error',
        file: (failure as any).file || 'Unknown file',
      })) || [],
    };

    // Transform coverage results
    const coverage = coverageResult ? {
      summary: this.transformCoverageToMetrics(coverageResult),
      files: this.transformCoverageFiles(coverageResult),
      uncoveredLines: this.extractUncoveredLines(coverageResult),
    } : undefined;

    // Extract stdout/stderr from test result
    const output = {
      stdout: (testResult as any).stdout || '',
      stderr: (testResult as any).stderr || '',
    };

    return {
      results,
      coverage,
      output,
      metadata: {
        framework,
        duration,
        executedAt: new Date(),
      },
    };
  }

  /**
   * Transform coverage result to metrics format
   */
  private transformCoverageToMetrics(coverageResult: CoverageResult): any {
    return {
      linesCovered: Math.round(coverageResult.lines * 100),
      totalLines: 100,
      branchesCovered: Math.round(coverageResult.branches * 100),
      totalBranches: 100,
      functionsCovered: Math.round(coverageResult.functions * 100),
      totalFunctions: 100,
      statementsCovered: Math.round(coverageResult.statements * 100),
      totalStatements: 100,
      percentage: coverageResult.lines,
    };
  }

  /**
   * Transform coverage files to expected format
   */
  private transformCoverageFiles(coverageResult: CoverageResult): Record<string, any> {
    // The CoverageResult interface doesn't have files property
    // Return empty record for now
    return {};
  }

  /**
   * Extract uncovered lines from coverage result
   */
  private extractUncoveredLines(coverageResult: CoverageResult): Record<string, number[]> {
    // Return the uncoveredLines if available, otherwise empty record
    return coverageResult.uncoveredLines || {};
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
 * Factory function for creating TestRunTool instances
 */
export function createTestRunTool(): TestRunTool {
  return new TestRunTool();
}