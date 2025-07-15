import { logger } from '../../utils/common-imports';
import type { ProjectAnalysis } from '../ProjectAnalyzer';
import { LanguageDetectionService } from './LanguageDetectionService';
import { FrameworkDetectionService } from './FrameworkDetectionService';
import { DependencyAnalysisService } from './DependencyAnalysisService';
import { ComplexityAnalysisService } from './ComplexityAnalysisService';

/**
 * Orchestrator that coordinates analysis services to produce complete project analysis
 */
export class ProjectAnalysisOrchestrator {
  private languageService: LanguageDetectionService;
  private frameworkService: FrameworkDetectionService;
  private dependencyService: DependencyAnalysisService;
  private complexityService: ComplexityAnalysisService;

  constructor(private projectPath: string) {
    this.languageService = new LanguageDetectionService(projectPath);
    this.frameworkService = new FrameworkDetectionService(projectPath);
    this.dependencyService = new DependencyAnalysisService(projectPath);
    this.complexityService = new ComplexityAnalysisService(projectPath);
  }

  async analyzeProject(): Promise<Partial<ProjectAnalysis>> {
    logger.info(`Starting coordinated analysis of project: ${this.projectPath}`);

    try {
      const [languages, frameworks, dependencies, complexity] = await Promise.all([
        this.languageService.detectLanguages(),
        this.frameworkService.detectFrameworks(),
        this.dependencyService.analyzeDependencies(),
        this.complexityService.calculateComplexity(),
      ]);

      // Check if this is an MCP server project
      const isMCPServer = frameworks.some((f) => f.name === 'mcp-server' || f.name === 'fastmcp');

      const analysis: Partial<ProjectAnalysis> = {
        projectPath: this.projectPath,
        languages,
        frameworks,
        dependencies,
        complexity,
        projectType: isMCPServer ? 'mcp-server' : 'standard',
      };

      logger.info('Coordinated project analysis completed successfully');
      return analysis;
    } catch (error: unknown) {
      logger.error('Coordinated project analysis failed:', error);
      throw new Error(
        `Failed to analyze project at ${this.projectPath}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }
}
