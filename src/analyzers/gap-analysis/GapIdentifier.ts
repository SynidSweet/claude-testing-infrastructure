import { IdentifiedGap, GapPriority, CoverageAnalysis } from '../TestGapAnalyzer';
import { GeneratedTest, TestType } from '../../generators/TestGenerator';

/**
 * Gap Identifier - Identifies specific gaps requiring AI generation
 * 
 * Analyzes coverage data to determine business logic, edge case,
 * and integration gaps that need logical test generation.
 */
export class GapIdentifier {

  /**
   * Identify specific gaps requiring AI generation
   */
  async identifyLogicalTestingGaps(
    _sourceContent: string, 
    coverage: CoverageAnalysis, 
    _test: GeneratedTest
  ): Promise<IdentifiedGap[]> {
    const gaps: IdentifiedGap[] = [];

    // Business logic gaps
    for (const gap of coverage.businessLogicGaps) {
      gaps.push({
        type: 'business-logic',
        description: gap,
        priority: GapPriority.HIGH,
        estimatedEffort: 'medium',
        suggestedTestType: TestType.UNIT
      });
    }

    // Edge case gaps
    for (const gap of coverage.edgeCaseGaps) {
      gaps.push({
        type: 'edge-case',
        description: gap,
        priority: GapPriority.MEDIUM,
        estimatedEffort: 'low',
        suggestedTestType: TestType.UNIT
      });
    }

    // Integration gaps
    for (const gap of coverage.integrationGaps) {
      gaps.push({
        type: 'integration',
        description: gap,
        priority: GapPriority.HIGH,
        estimatedEffort: 'high',
        suggestedTestType: TestType.INTEGRATION
      });
    }

    return gaps;
  }
}