import { CostEstimator } from '../../src/ai/CostEstimator';
import { getModelInfo } from '../../src/utils/model-mapping';
import { GapPriority } from '../../src/analyzers/TestGapAnalyzer';
import type { TestGap, TestGapAnalysisResult } from '../../src/analyzers/TestGapAnalyzer';
import { TestType } from '../../src/generators/TestGenerator';

// Helper function to create a mock TestGap for consistent testing
const createMockTestGap = (
  linesOfCode: number,
  complexityOverall: number,
  gapsLength: number = 0,
  priority: GapPriority = GapPriority.MEDIUM,
  testFileExists: boolean = false
): TestGap => ({
  sourceFile: `/path/to/file.js`,
  testFile: testFileExists ? `/path/to/file.test.js` : `/path/to/file.test.js`,
  currentCoverage: {
    structuralCoverage: { functions: [], classes: [], exports: [], estimatedPercentage: 0 },
    businessLogicGaps: [],
    edgeCaseGaps: [],
    integrationGaps: [],
  },
  gaps: Array(gapsLength).fill({
    type: 'business-logic',
    description: 'mock gap',
    priority: GapPriority.LOW,
    estimatedEffort: 'low',
    suggestedTestType: TestType.UNIT,
  }),
  complexity: {
    overall: complexityOverall,
    cyclomaticIndicators: 1,
    dependencies: 0,
    linesOfCode,
    exports: 1,
    nestingDepth: 1,
  },
  priority,
  context: {
    dependencies: [],
    framework: 'jest',
    language: 'javascript',
    fileType: 'utility',
    codeSnippets: [],
    relatedFiles: [],
  },
});

describe('CostEstimator', () => {
  let estimator: CostEstimator;

  beforeEach(() => {
    estimator = new CostEstimator();
  });

  // Test estimateTaskCost which internally uses calculateCost and estimateTokens
  test('should estimate task cost for Claude 3 Opus correctly', () => {
    const model = 'claude-3-opus-20240229';
    // To get specific input/output tokens, we need to reverse engineer linesOfCode and gapsLength
    // Let's aim for a simple case that's easy to verify
    // promptOverhead = 500, contextTokens = 200, existingTestTokens = 0
    // If linesOfCode = 150, sourceCodeTokens = 300
    // inputTokens = 500 + 300 + 0 + 200 = 1000
    // multiplier for complex (overall >= 8) is 2.5
    // baseOutputTokens = 300 * 2.5 = 750
    // If gapsLength = 0, scenarioTokens = 0
    // outputTokens = 750 + 0 = 750
    const gap = createMockTestGap(150, 8, 0, GapPriority.HIGH, false); // linesOfCode, complexityOverall, gapsLength, priority, testFileExists
    // Manually calculate expected cost based on the internal logic and model pricing
    const modelInfo = getModelInfo(model)!;
    const expectedInputTokens = 1000; // Based on mock gap setup
    const expectedOutputTokens = 750; // Based on mock gap setup
    const expectedCost = (expectedInputTokens / 1000) * modelInfo.inputCostPer1K + (expectedOutputTokens / 1000) * modelInfo.outputCostPer1K;

    const estimate = estimator.estimateTaskCost(gap);
    expect(estimate.model).toBe(model);
    expect(estimate.tokenEstimate.inputTokens).toBe(expectedInputTokens);
    expect(estimate.tokenEstimate.outputTokens).toBe(expectedOutputTokens);
    expect(estimate.estimatedCost).toBeCloseTo(expectedCost);
  });

  test('should estimate task cost for Claude 3 Sonnet correctly', () => {
    const model = 'claude-3-5-sonnet-20241022';
    // For Sonnet (medium complexity, overall 4-7)
    // linesOfCode = 100, sourceCodeTokens = 200
    // inputTokens = 500 + 200 + 0 + 200 = 900
    // multiplier for medium is 2.0
    // baseOutputTokens = 200 * 2.0 = 400
    // gapsLength = 2, scenarioTokens = 200
    // outputTokens = 400 + 200 = 600
    const gap = createMockTestGap(100, 5, 2, GapPriority.MEDIUM, false);
    const modelInfo = getModelInfo(model)!;
    const expectedInputTokens = 900;
    const expectedOutputTokens = 600;
    const expectedCost = (expectedInputTokens / 1000) * modelInfo.inputCostPer1K + (expectedOutputTokens / 1000) * modelInfo.outputCostPer1K;

    const estimate = estimator.estimateTaskCost(gap);
    expect(estimate.model).toBe(model);
    expect(estimate.tokenEstimate.inputTokens).toBe(expectedInputTokens);
    expect(estimate.tokenEstimate.outputTokens).toBe(expectedOutputTokens);
    expect(estimate.estimatedCost).toBeCloseTo(expectedCost);
  });

  test('should estimate task cost for Claude 3 Haiku correctly', () => {
    const model = 'claude-3-haiku-20240307';
    // For Haiku (low complexity, overall <= 3)
    // linesOfCode = 50, sourceCodeTokens = 100
    // inputTokens = 500 + 100 + 0 + 200 = 800
    // multiplier for simple is 1.5
    // baseOutputTokens = 100 * 1.5 = 150
    // gapsLength = 1, scenarioTokens = 100
    // outputTokens = 150 + 100 = 250
    const gap = createMockTestGap(50, 2, 1, GapPriority.LOW, false);
    const modelInfo = getModelInfo(model)!;
    const expectedInputTokens = 800; // 500 (overhead) + 50*2 (sourceCodeTokens) + 0 (existingTestTokens) + 200 (contextTokens)
    const expectedOutputTokens = 250;
    const expectedCost = (expectedInputTokens / 1000) * modelInfo.inputCostPer1K + (expectedOutputTokens / 1000) * modelInfo.outputCostPer1K;

    const estimate = estimator.estimateTaskCost(gap);
    expect(estimate.model).toBe(model);
    expect(estimate.tokenEstimate.inputTokens).toBe(expectedInputTokens);
    expect(estimate.tokenEstimate.outputTokens).toBe(expectedOutputTokens);
    expect(estimate.estimatedCost).toBeCloseTo(expectedCost);
  });

  test('should estimate batch cost correctly via optimizeForBudget', () => {
    const gap1 = createMockTestGap(50, 2, 1, GapPriority.LOW, false); // Haiku
    const gap2 = createMockTestGap(100, 5, 2, GapPriority.MEDIUM, false); // Sonnet
    const gap3 = createMockTestGap(150, 8, 0, GapPriority.HIGH, false); // Opus

    const report: TestGapAnalysisResult = {
      gaps: [gap1, gap2, gap3],
      summary: {
        totalFiles: 3,
        totalGaps: 3,
        filesWithTests: 3,
        filesNeedingLogicalTests: 3,
        priorityBreakdown: { [GapPriority.LOW]: 1, [GapPriority.MEDIUM]: 1, [GapPriority.HIGH]: 1, [GapPriority.CRITICAL]: 0 },
        overallAssessment: 'needs-improvement',
      },
      timestamp: new Date().toISOString(),
      projectPath: '/mock/project',
      recommendations: [],
      estimatedCost: { estimatedTokens: 0, estimatedCostUSD: 0, numberOfTasks: 0, complexityDistribution: { low: 0, medium: 0, high: 0 } },
    };

    const budget = 100; // A large budget to include all
    const optimization = estimator.optimizeForBudget(report, budget);

    const expectedCost1 = estimator.estimateTaskCost(gap1).estimatedCost;
    const expectedCost2 = estimator.estimateTaskCost(gap2).estimatedCost;
    const expectedCost3 = estimator.estimateTaskCost(gap3).estimatedCost;
    const expectedTotalCost = expectedCost1 + expectedCost2 + expectedCost3;

    expect(optimization.totalEstimatedCost).toBeCloseTo(expectedTotalCost);
    expect(optimization.tasksIncluded).toBe(3);
    expect(optimization.tasksExcluded).toBe(0);
  });

  test('should provide cost recommendations via estimateReportCost', () => {
    const gap1 = createMockTestGap(1000, 9, 0, GapPriority.HIGH, false); // Very complex, expensive
    const gap2 = createMockTestGap(10, 1, 0, GapPriority.LOW, false); // Simple, cheap
    const report: TestGapAnalysisResult = {
      gaps: [gap1, gap2],
      summary: {
        totalFiles: 2,
        filesWithTests: 2,
        filesNeedingLogicalTests: 2,
        totalGaps: 2,
        priorityBreakdown: { [GapPriority.LOW]: 1, [GapPriority.HIGH]: 1, [GapPriority.MEDIUM]: 0, [GapPriority.CRITICAL]: 0 },
        overallAssessment: 'needs-improvement',
      },
      timestamp: new Date().toISOString(),
      projectPath: '/mock/project',
      recommendations: [],
      estimatedCost: { estimatedTokens: 0, estimatedCostUSD: 0, numberOfTasks: 0, complexityDistribution: { low: 0, medium: 0, high: 0 } },
    };

    const estimatedReportCost = estimator.estimateReportCost(report);
    expect(estimatedReportCost.recommendations).toContain(
      expect.stringContaining('Consider using Claude 3 Haiku for simpler tests')
    );
    expect(estimatedReportCost.recommendations).toContain(
      expect.stringContaining('files have very high complexity')
    );
  });

  test('should not provide recommendation for optimal model usage', () => {
    const gap1 = createMockTestGap(50, 2, 0, GapPriority.LOW, false); // Haiku
    const gap2 = createMockTestGap(100, 5, 0, GapPriority.MEDIUM, false); // Sonnet
    const report: TestGapAnalysisResult = {
      gaps: [gap1, gap2],
      summary: {
        totalFiles: 2,
        filesWithTests: 2,
        filesNeedingLogicalTests: 0,
        totalGaps: 0,
        priorityBreakdown: { critical: 0, high: 0, medium: 0, low: 0 },
        overallAssessment: 'excellent',
      },
      timestamp: new Date().toISOString(),
      projectPath: '/mock/project',
      recommendations: [],
      estimatedCost: { estimatedTokens: 0, estimatedCostUSD: 0, numberOfTasks: 0, complexityDistribution: { low: 0, medium: 0, high: 0 } },
    };

    const estimatedReportCost = estimator.estimateReportCost(report);
    // Expect no specific cost optimization recommendations if usage is already optimal
    expect(estimatedReportCost.recommendations).not.toContain(
      expect.stringContaining('Consider using Claude 3 Haiku')
    );
    expect(estimatedReportCost.recommendations).not.toContain(
      expect.stringContaining('tasks using expensive Opus model')
    );
  });
});