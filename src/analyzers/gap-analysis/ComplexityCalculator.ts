import { ComplexityScore } from '../TestGapAnalyzer';

/**
 * Complexity Calculator - Calculates code complexity metrics
 *
 * Handles cyclomatic complexity calculation, nesting depth analysis,
 * and overall complexity scoring for test gap analysis.
 */
export class ComplexityCalculator {
  /**
   * Calculate complexity metrics for a source file
   */
  async calculateCodeComplexityMetrics(
    sourceContent: string,
    _filePath: string
  ): Promise<ComplexityScore> {
    const lines = sourceContent.split('\n');
    const linesOfCode = lines.filter(
      (line) => line.trim() && !line.trim().startsWith('//') && !line.trim().startsWith('*')
    ).length;

    // Basic complexity indicators
    const cyclomaticIndicators = (
      sourceContent.match(/\b(if|else|for|while|switch|case|catch|&&|\|\|)\b/g) || []
    ).length;
    const dependencies = (sourceContent.match(/import\s+.*?from\s+['"]/g) || []).length;
    const exports = (
      sourceContent.match(/export\s+(default\s+)?(function|class|const|let|var)/g) || []
    ).length;
    const nestingDepth = this.calculateNestingDepth(sourceContent);

    // Calculate overall complexity (1-10 scale)
    const overall = Math.min(
      10,
      Math.ceil(linesOfCode / 50 + cyclomaticIndicators / 10 + dependencies / 20 + nestingDepth / 3)
    );

    return {
      overall,
      cyclomaticIndicators,
      dependencies,
      linesOfCode,
      exports,
      nestingDepth,
    };
  }

  /**
   * Calculate approximate nesting depth
   */
  private calculateNestingDepth(content: string): number {
    let maxDepth = 0;
    let currentDepth = 0;

    for (const char of content) {
      if (char === '{' || char === '(') {
        currentDepth++;
        maxDepth = Math.max(maxDepth, currentDepth);
      } else if (char === '}' || char === ')') {
        currentDepth = Math.max(0, currentDepth - 1);
      }
    }

    return maxDepth;
  }
}
