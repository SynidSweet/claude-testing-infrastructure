/**
 * MCP Project Analyze Tool
 *
 * Core MCP tool for analyzing project structure and identifying testable components.
 * This tool integrates with the existing ProjectAnalyzer to provide comprehensive
 * project analysis through the MCP protocol.
 *
 * Implements TASK-2025-146: Implement core analysis tools (project_analyze)
 *
 * @module mcp/tools/ProjectAnalyzeTool
 */

import { logger } from '../../utils/logger';
import {
  ProjectAnalyzeSchema,
  type ProjectAnalyzeParams,
  type ProjectAnalyzeResult,
  type ComponentInfo,
  type MCPToolError,
  MCPErrorCode,
  SupportedLanguage,
  TestFramework,
} from '../tool-interfaces';
import type { MCPErrorResponse } from '../services/MCPErrorHandler';
import { ProjectAnalyzer, type ProjectAnalysis } from '../../analyzers/ProjectAnalyzer';
import { handleMCPError, withCircuitBreaker } from '../services/MCPErrorHandler';
import { MCPCacheManager, CacheLayer } from '../services/MCPCacheManager';
import { getMCPLogger, MCPToolStatus, type MCPToolContext } from '../services/MCPLoggingService';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Project Analyze Tool implementation
 */
export class ProjectAnalyzeTool {
  public readonly name = 'mcp__claude-testing__project_analyze';
  public readonly description = 'Analyze project structure and identify testable components';

  private cacheManager: MCPCacheManager;
  private mcpLogger = getMCPLogger();

  constructor() {
    this.cacheManager = MCPCacheManager.getInstance();
  }

  /**
   * Execute the project analyze tool
   */
  public async execute(params: unknown): Promise<ProjectAnalyzeResult | MCPToolError | MCPErrorResponse> {
    // Create logging context
    const context: MCPToolContext = {
      toolName: this.name,
      operation: 'analyze',
      parameters: params as Record<string, unknown>,
      sessionId: this.generateSessionId(),
      traceId: this.generateTraceId()
    };

    // Start logging
    const metrics = this.mcpLogger.logToolStart(context);

    return withCircuitBreaker('project_analyze', async () => {
      try {
        // Validate input parameters
        const validatedParams = await this.validateParams(params);
        if (!validatedParams.success) {
          const error = {
            code: MCPErrorCode.InvalidInput,
            message: 'Project analyze validation failed',
            details: { errors: validatedParams.errors },
            suggestion: 'Please provide valid parameters according to the schema',
            documentation: 'See ProjectAnalyzeSchema for required parameters',
          } as MCPToolError;
          
          this.mcpLogger.logToolComplete(context, metrics, MCPToolStatus.Failure, error);
          return error;
        }

        const { projectPath, include, exclude, deep } = validatedParams.data;

        logger.info('Starting project analysis', {
          projectPath,
          deep,
          includePatterns: include?.length ?? 0,
          excludePatterns: exclude?.length ?? 0,
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

        // Check cache first
        const cacheKey = this.generateCacheKey(validatedParams.data);
        const cachedResult = await this.cacheManager.get<ProjectAnalyzeResult>(cacheKey, CacheLayer.ProjectAnalysis);
        if (cachedResult) {
          logger.info('Returning cached project analysis result', { projectPath });
          metrics.cacheHit = true;
          this.mcpLogger.logToolComplete(context, metrics, MCPToolStatus.Cached, cachedResult);
          return cachedResult;
        }

        // Log cache miss
        this.mcpLogger.logToolWarning(context, 'Cache miss, performing full analysis', { cacheKey });

        // Perform project analysis
        const startTime = Date.now();
        const analyzer = new ProjectAnalyzer(projectPath);
        const analysis = await analyzer.analyzeProject();

        // Transform analysis to MCP format
        const result = await this.transformAnalysisToMCPFormat(analysis, startTime);

        // Cache the result
        await this.cacheManager.set(cacheKey, result, CacheLayer.ProjectAnalysis);

        logger.info('Successfully completed project analysis', {
          projectPath,
          duration: result.metadata.duration,
          componentsFound: result.components.length,
          testabilityScore: result.testability.score,
        });

        // Log successful completion
        this.mcpLogger.logToolComplete(context, metrics, MCPToolStatus.Success, result);

        return result;
      } catch (error) {
        // Log error with MCP logging service
        this.mcpLogger.logToolError(context, metrics, error as Error);
        
        const mcpError = await handleMCPError(error, 'project_analyze', 'execute');
        logger.error('Project analysis failed', {
          error: mcpError.error?.message || 'Unknown error',
          details: mcpError.error?.category || 'Unknown category',
        });
        return mcpError;
      }
    });
  }

  /**
   * Validate input parameters against schema
   */
  private async validateParams(
    params: unknown
  ): Promise<{ success: true; data: ProjectAnalyzeParams } | { success: false; errors: string[] }> {
    try {
      const validated = ProjectAnalyzeSchema.parse(params);
      return { success: true, data: validated };
    } catch (error) {
      const errors = error instanceof Error ? [error.message] : ['Unknown validation error'];
      return { success: false, errors };
    }
  }

  /**
   * Generate cache key for analysis parameters
   */
  private generateCacheKey(params: ProjectAnalyzeParams): string {
    const key = `project_analyze:${params.projectPath}:${params.deep}:${JSON.stringify(params.include ?? [])}:${JSON.stringify(params.exclude ?? [])}`;
    return Buffer.from(key).toString('base64');
  }

  /**
   * Transform ProjectAnalysis to MCP format
   */
  private async transformAnalysisToMCPFormat(
    analysis: ProjectAnalysis,
    startTime: number
  ): Promise<ProjectAnalyzeResult> {
    const duration = Date.now() - startTime;

    // Transform detected languages to enum
    const languages: Record<SupportedLanguage, number> = {} as Record<SupportedLanguage, number>;
    for (const lang of analysis.languages) {
      if (lang.name in SupportedLanguage) {
        languages[lang.name as SupportedLanguage] = lang.files.length;
      }
    }

    // Extract framework names
    const frameworks = analysis.frameworks.map(f => f.name);

    // Map test frameworks to enum
    const testFrameworks: TestFramework[] = [];
    for (const framework of analysis.testingSetup.testFrameworks) {
      if (framework.toLowerCase() in TestFramework) {
        testFrameworks.push(framework.toLowerCase() as TestFramework);
      }
    }

    // Generate components from analysis (simplified for now)
    const components = await this.extractComponents(analysis);

    // Calculate testability score
    const testability = this.calculateTestability(analysis, components);

    return {
      summary: {
        totalFiles: analysis.complexity.totalFiles,
        totalComponents: components.length,
        languages,
        frameworks,
        testFrameworks,
      },
      components,
      dependencies: {
        production: analysis.dependencies.production,
        development: analysis.dependencies.development,
      },
      testability,
      metadata: {
        analyzedAt: new Date(),
        duration,
        version: '1.0.0',
      },
    };
  }

  /**
   * Extract testable components from project analysis
   */
  private async extractComponents(analysis: ProjectAnalysis): Promise<ComponentInfo[]> {
    const components: ComponentInfo[] = [];

    // For now, create basic components from source files
    // This could be enhanced with actual AST parsing
    
    for (const lang of analysis.languages) {
      for (const filePath of lang.files) {
        // Skip test files and config files
        if (this.isTestFile(filePath) || this.isConfigFile(filePath)) {
          continue;
        }

        // Extract relative path
        const relativePath = path.relative(analysis.projectPath, filePath);
        
        // Create a basic component for each source file
        const component: ComponentInfo = {
          name: path.basename(filePath, path.extname(filePath)),
          type: this.detectComponentType(filePath),
          filePath: relativePath,
          startLine: 1,
          endLine: 100, // This would be determined by actual file analysis
          complexity: this.estimateComplexity(filePath),
          dependencies: [], // This would be extracted from actual imports
          isExported: true, // Assume exported for now
          hasTests: this.hasCorrespondingTest(filePath, analysis.testingSetup.testFiles),
        };

        components.push(component);
      }
    }

    return components;
  }

  /**
   * Calculate testability score
   */
  private calculateTestability(analysis: ProjectAnalysis, components: ComponentInfo[]): {
    score: number;
    issues: string[];
    recommendations: string[];
  } {
    const issues: string[] = [];
    const recommendations: string[] = [];
    let score = 100;

    // Check test coverage
    const testedComponents = components.filter(c => c.hasTests).length;
    const testCoverage = components.length > 0 ? (testedComponents / components.length) * 100 : 0;
    
    if (testCoverage < 50) {
      score -= 30;
      issues.push('Low test coverage - less than 50% of components have tests');
      recommendations.push('Add unit tests for core functionality');
    }

    // Check for test framework
    if (analysis.testingSetup.testFrameworks.length === 0) {
      score -= 20;
      issues.push('No test framework detected');
      recommendations.push('Set up a test framework (Jest, pytest, etc.)');
    }

    // Check for overly complex components
    const complexComponents = components.filter(c => c.complexity > 20).length;
    if (complexComponents > 0) {
      score -= 10;
      issues.push(`${complexComponents} components have high complexity`);
      recommendations.push('Consider breaking down complex components');
    }

    // Check for dependency issues
    if (Object.keys(analysis.dependencies.production).length > 50) {
      score -= 10;
      issues.push('High number of dependencies may affect testability');
      recommendations.push('Consider reducing dependency count');
    }

    return {
      score: Math.max(0, score),
      issues,
      recommendations,
    };
  }

  /**
   * Detect component type from file path
   */
  private detectComponentType(filePath: string): ComponentInfo['type'] {
    const fileName = path.basename(filePath);
    
    if (fileName.includes('component') || fileName.includes('Component')) {
      return 'component';
    }
    
    if (fileName.includes('class') || fileName.includes('Class')) {
      return 'class';
    }
    
    if (fileName.includes('util') || fileName.includes('helper')) {
      return 'function';
    }
    
    return 'module';
  }

  /**
   * Estimate complexity based on file size and content
   */
  private estimateComplexity(filePath: string): number {
    try {
      const stats = fs.statSync(filePath);
      const sizeKB = stats.size / 1024;
      
      // Simple heuristic: larger files tend to be more complex
      if (sizeKB > 10) return 30;
      if (sizeKB > 5) return 20;
      if (sizeKB > 2) return 10;
      return 5;
    } catch {
      return 10; // Default complexity
    }
  }

  /**
   * Check if file is a test file
   */
  private isTestFile(filePath: string): boolean {
    const fileName = path.basename(filePath);
    return /\.(test|spec)\.(js|ts|py)$/.test(fileName) || fileName.includes('__tests__');
  }

  /**
   * Check if file is a config file
   */
  private isConfigFile(filePath: string): boolean {
    const fileName = path.basename(filePath);
    return /\.(config|conf)\.(js|ts|json)$/.test(fileName) || 
           fileName.startsWith('.') ||
           ['package.json', 'tsconfig.json', 'jest.config.js'].includes(fileName);
  }

  /**
   * Check if component has corresponding test
   */
  private hasCorrespondingTest(filePath: string, testFiles: string[]): boolean {
    const fileName = path.basename(filePath, path.extname(filePath));
    return testFiles.some(testFile => 
      path.basename(testFile).includes(fileName)
    );
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
 * Create and export the tool instance
 */
export function createProjectAnalyzeTool(): ProjectAnalyzeTool {
  return new ProjectAnalyzeTool();
}