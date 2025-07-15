import { logger } from '../utils/common-imports';
import { GapPriority, type TestGapAnalysisResult, type TestGap } from './TestGapAnalyzer';
import { MarkdownReportGenerator } from './reporting/MarkdownReportGenerator';
import { TerminalReportGenerator } from './reporting/TerminalReportGenerator';
import { ReportVisualizationService } from './reporting/ReportVisualizationService';

export interface ReportOptions {
  /** Include detailed gap breakdown */
  includeDetails?: boolean;
  /** Include code snippets in report */
  includeCodeSnippets?: boolean;
  /** Maximum number of gaps to show in details */
  maxGapsToShow?: number;
  /** Show color output in terminal */
  useColors?: boolean;
  /** Include timing information */
  includeTiming?: boolean;
}

export interface VisualizationConfig {
  /** Terminal width for formatting */
  terminalWidth?: number;
  /** Use Unicode symbols */
  useUnicode?: boolean;
  /** Color scheme */
  colorScheme?: 'default' | 'dark' | 'light';
}

export interface GapReportSchema {
  /** Report metadata */
  metadata: {
    version: string;
    generatedAt: string;
    projectPath: string;
    duration?: number;
  };
  /** Executive summary */
  summary: {
    totalFiles: number;
    filesWithTests: number;
    filesNeedingLogicalTests: number;
    totalGaps: number;
    overallAssessment: string;
    priorityDistribution: Record<GapPriority, number>;
  };
  /** Cost analysis */
  cost: {
    numberOfTasks: number;
    estimatedTokens: number;
    estimatedCostUSD: number;
    complexityDistribution: Record<string, number>;
  };
  /** Prioritized recommendations */
  recommendations: {
    immediate: string[];
    shortTerm: string[];
    longTerm: string[];
  };
  /** Detailed gap analysis */
  gaps: DetailedGap[];
  /** Actionable insights */
  insights: ActionableInsight[];
}

export interface DetailedGap {
  sourceFile: string;
  testFile: string;
  priority: GapPriority;
  complexity: number;
  gapCount: number;
  framework: string;
  language: string;
  gaps: {
    type: string;
    description: string;
    priority: GapPriority;
    estimatedEffort: string;
  }[];
  context?: {
    dependencies: string[];
    codeSnippets?: {
      name: string;
      complexity: {
        hasAsync: boolean;
        hasConditionals: boolean;
        hasLoops: boolean;
        hasErrorHandling: boolean;
      };
    }[];
  };
}

export interface ActionableInsight {
  category: 'critical' | 'optimization' | 'best-practice';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  effort: 'low' | 'medium' | 'high';
  actions: string[];
  relatedGaps?: string[];
}

/**
 * Gap Report Generator - Orchestrates focused report generators
 *
 * This orchestrator coordinates specialized report generators to transform
 * TestGapAnalysisResult into various formatted reports with enhanced visualization.
 *
 * Refactored to use composition pattern with focused classes:
 * - MarkdownReportGenerator: Handles markdown output
 * - TerminalReportGenerator: Handles colorized terminal output
 * - ReportVisualizationService: Handles ASCII art and text formatting
 */
export class GapReportGenerator {
  private readonly VERSION = '1.0.0';
  private readonly markdownGenerator: MarkdownReportGenerator;
  private readonly terminalGenerator: TerminalReportGenerator;
  private readonly visualizationService: ReportVisualizationService;

  constructor(
    private options: ReportOptions = {},
    private visualConfig: VisualizationConfig = {}
  ) {
    this.options = {
      includeDetails: true,
      includeCodeSnippets: false,
      maxGapsToShow: 20,
      useColors: true,
      includeTiming: true,
      ...options,
    };

    this.visualConfig = {
      terminalWidth: 80,
      useUnicode: true,
      colorScheme: 'default',
      ...visualConfig,
    };

    // Initialize focused report generators
    this.markdownGenerator = new MarkdownReportGenerator(this.options);
    this.terminalGenerator = new TerminalReportGenerator(this.options, this.visualConfig);
    this.visualizationService = new ReportVisualizationService(this.visualConfig);
  }

  /**
   * Generate a structured report schema
   */
  generateReportSchema(analysis: TestGapAnalysisResult): GapReportSchema {
    logger.debug('Generating structured report schema');

    const metadata = {
      version: this.VERSION,
      generatedAt: new Date().toISOString(),
      projectPath: analysis.projectPath,
      ...(this.options.includeTiming && analysis.timing
        ? { duration: analysis.timing.duration }
        : {}),
    };

    const summary = {
      totalFiles: analysis.summary.totalFiles,
      filesWithTests: analysis.summary.filesWithTests,
      filesNeedingLogicalTests: analysis.summary.filesNeedingLogicalTests,
      totalGaps: analysis.summary.totalGaps,
      overallAssessment: analysis.summary.overallAssessment,
      priorityDistribution: analysis.summary.priorityBreakdown,
    };

    const cost = {
      numberOfTasks: analysis.estimatedCost.numberOfTasks,
      estimatedTokens: analysis.estimatedCost.estimatedTokens,
      estimatedCostUSD: analysis.estimatedCost.estimatedCostUSD,
      complexityDistribution: analysis.estimatedCost.complexityDistribution,
    };

    const recommendations = this.categorizeRecommendations(analysis.recommendations);
    const gaps = this.transformGapsToDetailed(analysis.gaps);
    const insights = this.generateActionableInsights(analysis);

    return {
      metadata,
      summary,
      cost,
      recommendations,
      gaps,
      insights,
    };
  }

  /**
   * Generate enhanced terminal output with visualization
   */
  generateTerminalReport(analysis: TestGapAnalysisResult): string {
    const schema = this.generateReportSchema(analysis);
    return this.terminalGenerator.generateTerminalReport(schema);
  }

  /**
   * Generate enhanced markdown report
   */
  generateMarkdownReport(analysis: TestGapAnalysisResult): string {
    const schema = this.generateReportSchema(analysis);
    return this.markdownGenerator.generateMarkdownReport(schema);
  }

  /**
   * Generate enhanced JSON report with schema
   */
  generateJsonReport(analysis: TestGapAnalysisResult): string {
    const schema = this.generateReportSchema(analysis);

    // Add schema information for programmatic consumption
    const jsonReport = {
      $schema: 'https://claude-testing-infrastructure.schema.json/gap-analysis/v1',
      ...schema,
    };

    return JSON.stringify(jsonReport, null, 2);
  }

  /**
   * Generate plain text report with ASCII art
   */
  generateTextReport(analysis: TestGapAnalysisResult): string {
    const schema = this.generateReportSchema(analysis);
    return this.visualizationService.generateTextReport(schema);
  }

  private categorizeRecommendations(recommendations: string[]): GapReportSchema['recommendations'] {
    const immediate: string[] = [];
    const shortTerm: string[] = [];
    const longTerm: string[] = [];

    recommendations.forEach((rec) => {
      const lowerRec = rec.toLowerCase();
      if (
        lowerRec.includes('critical') ||
        lowerRec.includes('address') ||
        lowerRec.includes('first')
      ) {
        immediate.push(rec);
      } else if (
        lowerRec.includes('focus') ||
        lowerRec.includes('generate') ||
        lowerRec.includes('create')
      ) {
        shortTerm.push(rec);
      } else {
        longTerm.push(rec);
      }
    });

    return { immediate, shortTerm, longTerm };
  }

  private transformGapsToDetailed(gaps: TestGap[]): DetailedGap[] {
    return gaps.map((gap) => ({
      sourceFile: gap.sourceFile,
      testFile: gap.testFile,
      priority: gap.priority,
      complexity: gap.complexity.overall,
      gapCount: gap.gaps.length,
      framework: gap.context.framework,
      language: gap.context.language,
      gaps: gap.gaps.map((g) => ({
        type: g.type,
        description: g.description,
        priority: g.priority,
        estimatedEffort: g.estimatedEffort,
      })),
      ...(this.options.includeCodeSnippets && {
        context: {
          dependencies: gap.context.dependencies,
          codeSnippets: gap.context.codeSnippets.map((snippet) => ({
            name: snippet.name,
            complexity: {
              hasAsync: snippet.hasAsyncOperations,
              hasConditionals: snippet.hasConditionals,
              hasLoops: snippet.hasLoops,
              hasErrorHandling: snippet.hasErrorHandling,
            },
          })),
        },
      }),
    }));
  }

  private generateActionableInsights(analysis: TestGapAnalysisResult): ActionableInsight[] {
    const insights: ActionableInsight[] = [];

    // Analyze patterns in gaps
    const totalGaps = analysis.summary.totalGaps;
    const criticalFiles = analysis.gaps.filter((g) => g.priority === GapPriority.CRITICAL).length;

    if (criticalFiles > 0) {
      insights.push({
        category: 'critical',
        title: 'High-complexity files need immediate attention',
        description: `${criticalFiles} files have critical complexity that could significantly impact system reliability. These should be prioritized for logical test generation.`,
        impact: 'high',
        effort: 'medium',
        actions: [
          'Generate logical tests for critical complexity files first',
          'Consider breaking down complex functions into smaller, testable units',
          'Implement integration tests for external dependencies',
        ],
        relatedGaps: analysis.gaps
          .filter((g) => g.priority === GapPriority.CRITICAL)
          .map((g) => g.sourceFile),
      });
    }

    if (totalGaps > 20) {
      insights.push({
        category: 'optimization',
        title: 'Batch AI generation for cost efficiency',
        description: `With ${totalGaps} gaps identified, batch processing can reduce AI costs by up to 40% through context sharing and prompt optimization.`,
        impact: 'medium',
        effort: 'low',
        actions: [
          'Group similar files by framework and language',
          'Use shared context for related components',
          'Generate tests in priority order to maximize early value',
        ],
      });
    }

    if (analysis.estimatedCost.estimatedCostUSD > 10) {
      insights.push({
        category: 'optimization',
        title: 'Consider incremental test generation',
        description: `Estimated cost of $${analysis.estimatedCost.estimatedCostUSD} suggests implementing incremental testing to manage ongoing costs effectively.`,
        impact: 'medium',
        effort: 'medium',
        actions: [
          'Implement git-based change detection',
          'Generate tests only for modified files',
          'Set up automated cost monitoring',
        ],
      });
    }

    const businessLogicGaps = analysis.gaps.reduce(
      (count, gap) => count + gap.gaps.filter((g) => g.type === 'business-logic').length,
      0
    );

    if (businessLogicGaps > totalGaps * 0.6) {
      insights.push({
        category: 'best-practice',
        title: 'Focus on business logic validation',
        description: `${businessLogicGaps} business logic gaps indicate need for comprehensive functional testing beyond structural coverage.`,
        impact: 'high',
        effort: 'high',
        actions: [
          'Prioritize business logic test generation',
          'Include edge case scenarios in prompts',
          'Consider property-based testing for complex algorithms',
        ],
      });
    }

    return insights.slice(0, 5); // Limit to top 5 insights
  }
}
