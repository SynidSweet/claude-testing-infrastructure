import { logger } from '../utils/common-imports';
import type { ProjectAnalysis } from './ProjectAnalyzer';
import type { GeneratedTest, TestGenerationResult, TestType } from '../generators/TestGenerator';
import { ComplexityCalculator } from './gap-analysis/ComplexityCalculator';
import { CoverageAnalyzer } from './gap-analysis/CoverageAnalyzer';
import { GapIdentifier } from './gap-analysis/GapIdentifier';
import { ContextExtractor } from './gap-analysis/ContextExtractor';

export interface TestGap {
  /** Source file that needs additional testing */
  sourceFile: string;
  /** Generated test file path */
  testFile: string;
  /** Current structural test coverage */
  currentCoverage: CoverageAnalysis;
  /** Identified gaps in testing */
  gaps: IdentifiedGap[];
  /** File complexity metrics */
  complexity: ComplexityScore;
  /** Priority for AI generation */
  priority: GapPriority;
  /** Context information for AI */
  context: TestContext;
}

export interface CoverageAnalysis {
  /** Structural elements currently tested */
  structuralCoverage: StructuralCoverage;
  /** Business logic coverage gaps */
  businessLogicGaps: string[];
  /** Edge cases not covered */
  edgeCaseGaps: string[];
  /** Integration points not tested */
  integrationGaps: string[];
}

export interface StructuralCoverage {
  /** Functions/methods covered */
  functions: CoveredElement[];
  /** Classes/components covered */
  classes: CoveredElement[];
  /** Exports covered */
  exports: CoveredElement[];
  /** Coverage percentage estimate */
  estimatedPercentage: number;
}

export interface CoveredElement {
  name: string;
  type: 'function' | 'method' | 'class' | 'component' | 'export';
  isCovered: boolean;
  coverageType: 'structural' | 'logical' | 'none';
  complexity: number;
}

export interface IdentifiedGap {
  type: 'business-logic' | 'edge-case' | 'integration' | 'error-handling' | 'performance';
  description: string;
  priority: GapPriority;
  estimatedEffort: 'low' | 'medium' | 'high';
  suggestedTestType: TestType;
}

export enum GapPriority {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
}

export interface ComplexityScore {
  /** Overall complexity score (1-10) */
  overall: number;
  /** Cyclomatic complexity indicators */
  cyclomaticIndicators: number;
  /** Number of dependencies */
  dependencies: number;
  /** Lines of code */
  linesOfCode: number;
  /** Number of exports */
  exports: number;
  /** Nesting depth indicators */
  nestingDepth: number;
}

export interface TestContext {
  /** Extracted imports and dependencies */
  dependencies: string[];
  /** Framework context */
  framework: string;
  /** Language context */
  language: string;
  /** File type context */
  fileType: 'component' | 'service' | 'utility' | 'api' | 'model' | 'hook' | 'unknown';
  /** Relevant code snippets for AI context */
  codeSnippets: CodeSnippet[];
  /** Related files context */
  relatedFiles: string[];
}

export interface CodeSnippet {
  /** Function/method name */
  name: string;
  /** Code content */
  content: string;
  /** Line numbers */
  lines: { start: number; end: number };
  /** Complexity indicators */
  hasAsyncOperations: boolean;
  hasConditionals: boolean;
  hasLoops: boolean;
  hasErrorHandling: boolean;
}

export interface TestGapAnalysisResult {
  /** Analysis timestamp */
  timestamp: string;
  /** Project path analyzed */
  projectPath: string;
  /** Summary statistics */
  summary: GapAnalysisSummary;
  /** Identified gaps requiring AI generation */
  gaps: TestGap[];
  /** Recommendations */
  recommendations: string[];
  /** Estimated AI generation cost */
  estimatedCost: CostEstimation;
  /** Optional timing information */
  timing?: {
    duration: number;
    startTime: string;
    endTime: string;
  };
}

export interface GapAnalysisSummary {
  /** Total files analyzed */
  totalFiles: number;
  /** Files with generated tests */
  filesWithTests: number;
  /** Files needing logical tests */
  filesNeedingLogicalTests: number;
  /** Total identified gaps */
  totalGaps: number;
  /** Priority breakdown */
  priorityBreakdown: Record<GapPriority, number>;
  /** Overall assessment */
  overallAssessment: 'excellent' | 'good' | 'needs-improvement' | 'poor';
}

export interface CostEstimation {
  /** Estimated tokens for AI generation */
  estimatedTokens: number;
  /** Estimated cost in USD */
  estimatedCostUSD: number;
  /** Number of AI tasks */
  numberOfTasks: number;
  /** Complexity distribution */
  complexityDistribution: Record<'low' | 'medium' | 'high', number>;
}

/**
 * Test Gap Analyzer - Identifies gaps in generated structural tests
 *
 * This analyzer examines the generated structural tests and identifies
 * areas where AI-powered logical test generation would be beneficial.
 *
 * Orchestrates focused service classes for complexity calculation,
 * coverage analysis, gap identification, and context extraction.
 */
export class TestGapAnalyzer {
  private projectAnalysis: ProjectAnalysis;
  private config: TestGapAnalyzerConfig;
  private complexityCalculator: ComplexityCalculator;
  private coverageAnalyzer: CoverageAnalyzer;
  private gapIdentifier: GapIdentifier;
  private contextExtractor: ContextExtractor;

  constructor(projectAnalysis: ProjectAnalysis, config: TestGapAnalyzerConfig = {}) {
    this.projectAnalysis = projectAnalysis;
    this.config = {
      complexityThreshold: 3, // Lower threshold for better test coverage
      priorityWeights: {
        complexity: 0.3,
        businessLogic: 0.4,
        integrations: 0.3,
      },
      costPerToken: 0.00001, // $0.01 per 1000 tokens
      ...config,
    };

    // Initialize focused service classes
    this.complexityCalculator = new ComplexityCalculator();
    this.coverageAnalyzer = new CoverageAnalyzer();
    this.gapIdentifier = new GapIdentifier();
    this.contextExtractor = new ContextExtractor();
  }

  /**
   * Analyze generated tests to identify gaps for AI generation
   */
  async analyzeTestGaps(generationResult: TestGenerationResult): Promise<TestGapAnalysisResult> {
    logger.info('Starting test gap analysis', {
      generatedTests: generationResult.tests.length,
      projectPath: this.projectAnalysis.projectPath,
    });

    const gaps: TestGap[] = [];

    for (const test of generationResult.tests) {
      const gap = await this.analyzeTestFileForGaps(test);
      if (gap) {
        gaps.push(gap);
      }
    }

    const summary = this.generateGapAnalysisSummary(gaps, generationResult);
    const recommendations = this.generateAITestRecommendations(gaps);
    const costEstimation = this.calculateAIGenerationCostEstimation(gaps);

    return {
      timestamp: new Date().toISOString(),
      projectPath: this.projectAnalysis.projectPath,
      summary,
      gaps,
      recommendations,
      estimatedCost: costEstimation,
    };
  }

  /**
   * Analyze a single test file to identify gaps
   */
  private async analyzeTestFileForGaps(test: GeneratedTest): Promise<TestGap | null> {
    try {
      logger.debug('Analyzing test file for gaps', { testPath: test.testPath });

      // Read source file to analyze
      const { fs } = await import('../utils/common-imports');
      const sourceContent = await fs.readFile(test.sourcePath, 'utf-8');
      const testContent = test.content;

      // Calculate complexity using focused service
      const complexity = await this.complexityCalculator.calculateCodeComplexityMetrics(
        sourceContent,
        test.sourcePath
      );

      // Skip low-complexity files
      if (complexity.overall < this.config.complexityThreshold!) {
        logger.debug('Skipping low-complexity file', {
          sourceFile: test.sourcePath,
          complexity: complexity.overall,
        });
        return null;
      }

      // Analyze current coverage using focused service
      const currentCoverage = await this.coverageAnalyzer.analyzeStructuralTestCoverage(
        sourceContent,
        testContent
      );

      // Identify gaps using focused service
      const gaps = await this.gapIdentifier.identifyLogicalTestingGaps(
        sourceContent,
        currentCoverage,
        test
      );

      if (gaps.length === 0) {
        return null;
      }

      // Calculate priority
      const priority = this.calculateGapPriority(complexity, gaps);

      // Extract context for AI using focused service
      const context = await this.contextExtractor.extractAITestContext(
        sourceContent,
        test.sourcePath
      );

      return {
        sourceFile: test.sourcePath,
        testFile: test.testPath,
        currentCoverage,
        gaps,
        complexity,
        priority,
        context,
      };
    } catch (error) {
      logger.error('Error analyzing test file', {
        testPath: test.testPath,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Calculate priority for AI generation
   */
  private calculateGapPriority(complexity: ComplexityScore, gaps: IdentifiedGap[]): GapPriority {
    const weights = this.config.priorityWeights!;

    const complexityScore = complexity.overall / 10; // Normalize to 0-1
    const businessLogicScore = gaps.filter((g) => g.type === 'business-logic').length / 5; // Normalize
    const integrationScore = gaps.filter((g) => g.type === 'integration').length / 3; // Normalize

    const weightedScore =
      complexityScore * weights.complexity! +
      businessLogicScore * weights.businessLogic! +
      integrationScore * weights.integrations!;

    if (weightedScore > 0.8) return GapPriority.CRITICAL;
    if (weightedScore > 0.6) return GapPriority.HIGH;
    if (weightedScore > 0.4) return GapPriority.MEDIUM;
    return GapPriority.LOW;
  }

  /**
   * Generate summary statistics
   */
  private generateGapAnalysisSummary(
    gaps: TestGap[],
    generationResult: TestGenerationResult
  ): GapAnalysisSummary {
    const totalFiles = generationResult.tests.length;
    const filesWithTests = totalFiles;
    const filesNeedingLogicalTests = gaps.length;
    const totalGaps = gaps.reduce((sum, gap) => sum + gap.gaps.length, 0);

    const priorityBreakdown = gaps.reduce(
      (breakdown, gap) => {
        breakdown[gap.priority] = (breakdown[gap.priority] || 0) + 1;
        return breakdown;
      },
      {} as Record<GapPriority, number>
    );

    // Set default values for missing priorities
    Object.values(GapPriority).forEach((priority) => {
      if (!(priority in priorityBreakdown)) {
        priorityBreakdown[priority] = 0;
      }
    });

    const overallAssessment: GapAnalysisSummary['overallAssessment'] =
      filesNeedingLogicalTests === 0
        ? 'excellent'
        : filesNeedingLogicalTests < totalFiles * 0.3
          ? 'good'
          : filesNeedingLogicalTests < totalFiles * 0.7
            ? 'needs-improvement'
            : 'poor';

    return {
      totalFiles,
      filesWithTests,
      filesNeedingLogicalTests,
      totalGaps,
      priorityBreakdown,
      overallAssessment,
    };
  }

  /**
   * Generate actionable recommendations
   */
  private generateAITestRecommendations(gaps: TestGap[]): string[] {
    const recommendations: string[] = [];

    const criticalGaps = gaps.filter((g) => g.priority === GapPriority.CRITICAL);
    const highGaps = gaps.filter((g) => g.priority === GapPriority.HIGH);

    if (criticalGaps.length > 0) {
      recommendations.push(
        `Address ${criticalGaps.length} critical complexity files first for maximum impact`
      );
    }

    if (highGaps.length > 0) {
      recommendations.push(
        `Focus on ${highGaps.length} high-priority files with business logic gaps`
      );
    }

    const businessLogicCount = gaps.reduce(
      (count, gap) => count + gap.gaps.filter((g) => g.type === 'business-logic').length,
      0
    );

    if (businessLogicCount > 0) {
      recommendations.push(
        `Generate ${businessLogicCount} logical tests for business logic validation`
      );
    }

    const integrationCount = gaps.reduce(
      (count, gap) => count + gap.gaps.filter((g) => g.type === 'integration').length,
      0
    );

    if (integrationCount > 0) {
      recommendations.push(
        `Create ${integrationCount} integration tests for external dependencies`
      );
    }

    if (recommendations.length === 0) {
      recommendations.push(
        'Structural tests appear comprehensive - no additional logical tests needed'
      );
    }

    return recommendations;
  }

  /**
   * Calculate cost estimation for AI generation
   */
  private calculateAIGenerationCostEstimation(gaps: TestGap[]): CostEstimation {
    let totalTokens = 0;
    let numberOfTasks = 0;
    const complexityDistribution = { low: 0, medium: 0, high: 0 };

    for (const gap of gaps) {
      for (const specificGap of gap.gaps) {
        numberOfTasks++;

        // Estimate tokens based on complexity and context
        const baseTokens = 800; // Base prompt + response
        const complexityMultiplier = gap.complexity.overall / 5; // 0.2 to 2.0
        const contextTokens = gap.context.codeSnippets.length * 200; // Context snippets

        const taskTokens = Math.round(baseTokens * complexityMultiplier + contextTokens);
        totalTokens += taskTokens;

        // Update complexity distribution
        if (specificGap.estimatedEffort === 'low') complexityDistribution.low++;
        else if (specificGap.estimatedEffort === 'medium') complexityDistribution.medium++;
        else complexityDistribution.high++;
      }
    }

    const estimatedCostUSD = totalTokens * this.config.costPerToken!;

    return {
      estimatedTokens: totalTokens,
      estimatedCostUSD: Number(estimatedCostUSD.toFixed(4)),
      numberOfTasks,
      complexityDistribution,
    };
  }
}

export interface TestGapAnalyzerConfig {
  /** Minimum complexity threshold for gap analysis */
  complexityThreshold?: number;
  /** Priority calculation weights */
  priorityWeights?: {
    complexity?: number;
    businessLogic?: number;
    integrations?: number;
  };
  /** Cost per token for estimation */
  costPerToken?: number;
}
