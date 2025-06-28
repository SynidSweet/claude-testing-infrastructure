/**
 * Cost Estimator for AI Test Generation
 * 
 * Provides accurate cost estimation and optimization for AI token usage:
 * - Token counting and estimation
 * - Cost calculation for different models
 * - Budget optimization
 * - Usage tracking and reporting
 */

import { TestGapAnalysisResult, TestGap } from '../analyzers/TestGapAnalyzer';

export interface ModelPricing {
  name: string;
  inputCostPer1K: number;
  outputCostPer1K: number;
  contextWindow: number;
  bestForComplexity: [number, number]; // min, max complexity range
}

export interface TokenEstimate {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  withinLimit: boolean;
}

export interface CostEstimate {
  model: string;
  tokenEstimate: TokenEstimate;
  estimatedCost: number;
  confidence: 'high' | 'medium' | 'low';
}

export interface BudgetOptimization {
  totalBudget: number;
  allocations: TaskAllocation[];
  totalEstimatedCost: number;
  tasksIncluded: number;
  tasksExcluded: number;
  recommendations: string[];
}

export interface TaskAllocation {
  taskId: string;
  file: string;
  model: string;
  priority: number;
  estimatedCost: number;
  includeInBatch: boolean;
  reason?: string;
}

export interface UsageReport {
  period: string;
  totalTokensUsed: number;
  totalCost: number;
  byModel: Record<string, { tokens: number; cost: number }>;
  byProject: Record<string, { tokens: number; cost: number }>;
  averageTokensPerTask: number;
  averageCostPerTask: number;
}

export class CostEstimator {
  private static readonly MODELS: Record<string, ModelPricing> = {
    'claude-3-opus': {
      name: 'Claude 3 Opus',
      inputCostPer1K: 0.015,
      outputCostPer1K: 0.075,
      contextWindow: 200000,
      bestForComplexity: [8, 10]
    },
    'claude-3-sonnet': {
      name: 'Claude 3 Sonnet',
      inputCostPer1K: 0.003,
      outputCostPer1K: 0.015,
      contextWindow: 200000,
      bestForComplexity: [5, 8]
    },
    'claude-3-haiku': {
      name: 'Claude 3 Haiku',
      inputCostPer1K: 0.00025,
      outputCostPer1K: 0.00125,
      contextWindow: 200000,
      bestForComplexity: [1, 5]
    }
  };

  private static readonly TEST_OUTPUT_MULTIPLIER = {
    simple: 1.5,    // Output is 1.5x input for simple tests
    medium: 2.0,    // Output is 2x input for medium complexity
    complex: 2.5    // Output is 2.5x input for complex tests
  };

  private usageHistory: Array<{
    timestamp: Date;
    project: string;
    model: string;
    tokensUsed: number;
    cost: number;
  }> = [];

  constructor(private defaultModel = 'claude-3-sonnet') {}

  /**
   * Estimate cost for a gap analysis report
   */
  estimateReportCost(report: TestGapAnalysisResult): {
    totalCost: number;
    byComplexity: Record<string, { count: number; cost: number }>;
    byModel: Record<string, { count: number; cost: number }>;
    recommendations: string[];
  } {
    const byComplexity: Record<string, { count: number; cost: number }> = {
      low: { count: 0, cost: 0 },
      medium: { count: 0, cost: 0 },
      high: { count: 0, cost: 0 }
    };

    const byModel: Record<string, { count: number; cost: number }> = {};
    let totalCost = 0;

    for (const gap of report.gaps) {
      const estimate = this.estimateTaskCost(gap);
      const complexityBucket = this.getComplexityBucket(gap.complexity.overall);
      
      byComplexity[complexityBucket]!.count++;
      byComplexity[complexityBucket]!.cost += estimate.estimatedCost;
      
      if (!byModel[estimate.model]) {
        byModel[estimate.model] = { count: 0, cost: 0 };
      }
      byModel[estimate.model]!.count++;
      byModel[estimate.model]!.cost += estimate.estimatedCost;
      
      totalCost += estimate.estimatedCost;
    }

    const recommendations = this.generateRecommendations(report, totalCost);

    return {
      totalCost,
      byComplexity,
      byModel,
      recommendations
    };
  }

  /**
   * Estimate cost for a single task
   */
  estimateTaskCost(gap: TestGap): CostEstimate {
    const model = this.selectOptimalModel(gap.complexity.overall);
    const tokenEstimate = this.estimateTokens(gap);
    const cost = this.calculateCost(tokenEstimate, model);
    
    return {
      model,
      tokenEstimate,
      estimatedCost: cost,
      confidence: this.getConfidenceLevel(gap)
    };
  }

  /**
   * Estimate tokens for a task
   */
  private estimateTokens(gap: TestGap): TokenEstimate {
    // Estimate input tokens
    const promptOverhead = 500; // Base prompt template
    // Estimate based on file complexity and code snippets
    const sourceCodeTokens = Math.ceil(gap.complexity.linesOfCode * 2); // Rough estimate
    const existingTestTokens = gap.testFile ? 500 : 0; // Estimate if tests exist
    const contextTokens = 200; // Dependencies, scenarios, etc.
    
    const inputTokens = promptOverhead + sourceCodeTokens + existingTestTokens + contextTokens;
    
    // Estimate output tokens based on complexity
    const multiplier = gap.complexity.overall <= 3 ? CostEstimator.TEST_OUTPUT_MULTIPLIER.simple :
                      gap.complexity.overall <= 7 ? CostEstimator.TEST_OUTPUT_MULTIPLIER.medium :
                      CostEstimator.TEST_OUTPUT_MULTIPLIER.complex;
    
    const baseOutputTokens = Math.ceil(sourceCodeTokens * multiplier);
    const scenarioTokens = gap.gaps.length * 100; // ~100 tokens per test scenario
    
    const outputTokens = baseOutputTokens + scenarioTokens;
    const totalTokens = inputTokens + outputTokens;
    
    // Check against model limits
    const modelLimit = CostEstimator.MODELS[this.defaultModel]?.contextWindow || 200000;
    const withinLimit = totalTokens < modelLimit * 0.8; // Keep 20% buffer
    
    return {
      inputTokens,
      outputTokens,
      totalTokens,
      withinLimit
    };
  }

  /**
   * Calculate cost for token usage
   */
  private calculateCost(tokens: TokenEstimate, model: string): number {
    const pricing = CostEstimator.MODELS[model];
    if (!pricing) {
      console.warn(`Unknown model: ${model}, using default pricing`);
      return tokens.totalTokens * 0.01 / 1000; // Fallback
    }
    
    const inputCost = (tokens.inputTokens / 1000) * pricing.inputCostPer1K;
    const outputCost = (tokens.outputTokens / 1000) * pricing.outputCostPer1K;
    
    return inputCost + outputCost;
  }

  /**
   * Select optimal model based on complexity
   */
  private selectOptimalModel(complexity: number): string {
    // Find the best model for this complexity level
    for (const [modelId, pricing] of Object.entries(CostEstimator.MODELS)) {
      const [min, max] = pricing.bestForComplexity;
      if (complexity >= min && complexity <= max) {
        return modelId;
      }
    }
    
    return this.defaultModel;
  }

  /**
   * Optimize task allocation within budget
   */
  optimizeForBudget(
    report: TestGapAnalysisResult,
    budget: number
  ): BudgetOptimization {
    const allocations: TaskAllocation[] = [];
    let totalEstimatedCost = 0;
    let tasksIncluded = 0;
    let tasksExcluded = 0;

    // Sort gaps by priority (highest first)
    const sortedGaps = [...report.gaps].sort((a, b) => this.mapPriorityToNumber(b.priority) - this.mapPriorityToNumber(a.priority));

    for (const gap of sortedGaps) {
      const estimate = this.estimateTaskCost(gap);
      const allocation: TaskAllocation = {
        taskId: `task-${gap.sourceFile}`,
        file: gap.sourceFile,
        model: estimate.model,
        priority: this.mapPriorityToNumber(gap.priority),
        estimatedCost: estimate.estimatedCost,
        includeInBatch: false
      };

      if (totalEstimatedCost + estimate.estimatedCost <= budget) {
        allocation.includeInBatch = true;
        totalEstimatedCost += estimate.estimatedCost;
        tasksIncluded++;
      } else {
        allocation.reason = 'Exceeds budget';
        tasksExcluded++;
      }

      allocations.push(allocation);
    }

    const recommendations = this.generateBudgetRecommendations(
      budget,
      totalEstimatedCost,
      tasksIncluded,
      tasksExcluded,
      allocations
    );

    return {
      totalBudget: budget,
      allocations,
      totalEstimatedCost,
      tasksIncluded,
      tasksExcluded,
      recommendations
    };
  }

  /**
   * Track actual usage
   */
  trackUsage(
    project: string,
    model: string,
    tokensUsed: number,
    cost: number
  ): void {
    this.usageHistory.push({
      timestamp: new Date(),
      project,
      model,
      tokensUsed,
      cost
    });
  }

  /**
   * Generate usage report
   */
  generateUsageReport(period: 'day' | 'week' | 'month' = 'month'): UsageReport {
    const now = new Date();
    const periodMs = {
      day: 24 * 60 * 60 * 1000,
      week: 7 * 24 * 60 * 60 * 1000,
      month: 30 * 24 * 60 * 60 * 1000
    };

    const cutoff = new Date(now.getTime() - periodMs[period]);
    const relevantUsage = this.usageHistory.filter(u => u.timestamp >= cutoff);

    const byModel: Record<string, { tokens: number; cost: number }> = {};
    const byProject: Record<string, { tokens: number; cost: number }> = {};
    let totalTokens = 0;
    let totalCost = 0;

    for (const usage of relevantUsage) {
      totalTokens += usage.tokensUsed;
      totalCost += usage.cost;

      if (!byModel[usage.model]) {
        byModel[usage.model] = { tokens: 0, cost: 0 };
      }
      byModel[usage.model]!.tokens += usage.tokensUsed;
      byModel[usage.model]!.cost += usage.cost;

      if (!byProject[usage.project]) {
        byProject[usage.project] = { tokens: 0, cost: 0 };
      }
      byProject[usage.project]!.tokens += usage.tokensUsed;
      byProject[usage.project]!.cost += usage.cost;
    }

    const taskCount = relevantUsage.length;

    return {
      period,
      totalTokensUsed: totalTokens,
      totalCost,
      byModel,
      byProject,
      averageTokensPerTask: taskCount > 0 ? totalTokens / taskCount : 0,
      averageCostPerTask: taskCount > 0 ? totalCost / taskCount : 0
    };
  }

  /**
   * Get complexity bucket
   */
  private getComplexityBucket(complexity: number): string {
    if (complexity <= 3) return 'low';
    if (complexity <= 7) return 'medium';
    return 'high';
  }

  /**
   * Get confidence level for estimate
   */
  private getConfidenceLevel(gap: TestGap): 'high' | 'medium' | 'low' {
    // High confidence for well-defined scenarios
    if (gap.gaps.length > 0 && gap.testFile) {
      return 'high';
    }
    
    // Medium confidence for partially defined
    if (gap.gaps.length > 0 || gap.testFile) {
      return 'medium';
    }
    
    // Low confidence for vague requirements
    return 'low';
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(
    report: TestGapAnalysisResult,
    totalCost: number
  ): string[] {
    const recommendations: string[] = [];

    // Cost optimization
    if (totalCost > 10) {
      recommendations.push(
        `Consider using Claude 3 Haiku for simpler tests (complexity < 5) to reduce costs by ~80%`
      );
    }

    // Batch optimization
    const highPriorityCount = report.gaps.filter(g => g.priority === 'critical' || g.priority === 'high').length;
    if (highPriorityCount > 10) {
      recommendations.push(
        `Focus on ${highPriorityCount} high-priority files first to maximize impact`
      );
    }

    // Complexity warnings
    const veryComplexCount = report.gaps.filter(g => g.complexity.overall >= 9).length;
    if (veryComplexCount > 0) {
      recommendations.push(
        `${veryComplexCount} files have very high complexity - consider manual review for these`
      );
    }

    // Token limit warnings
    const largeFiles = report.gaps.filter(g => g.complexity.linesOfCode > 500).length;
    if (largeFiles > 0) {
      recommendations.push(
        `${largeFiles} files are very large - may need to split into smaller chunks`
      );
    }

    return recommendations;
  }

  /**
   * Generate budget recommendations
   */
  private generateBudgetRecommendations(
    budget: number,
    estimatedCost: number,
    included: number,
    excluded: number,
    allocations: TaskAllocation[]
  ): string[] {
    const recommendations: string[] = [];

    if (excluded > 0) {
      const additionalBudget = allocations
        .filter(a => !a.includeInBatch)
        .reduce((sum, a) => sum + a.estimatedCost, 0);
      
      recommendations.push(
        `${excluded} tasks excluded. Need $${additionalBudget.toFixed(2)} more to include all tasks`
      );
    }

    if (estimatedCost < budget * 0.5) {
      recommendations.push(
        `Using only ${((estimatedCost / budget) * 100).toFixed(1)}% of budget. Consider including more low-priority tasks`
      );
    }

    const opusCount = allocations.filter(a => a.model === 'claude-3-opus' && a.includeInBatch).length;
    
    if (opusCount > included * 0.3) {
      recommendations.push(
        `${opusCount} tasks using expensive Opus model. Consider downgrading some to Sonnet for 80% cost savings`
      );
    }

    return recommendations;
  }

  /**
   * Map priority enum to number
   */
  public mapPriorityToNumber(priority: any): number {
    const priorityMap: Record<string, number> = {
      'critical': 10,
      'high': 8,
      'medium': 5,
      'low': 3
    };
    return priorityMap[priority] || 5;
  }
}