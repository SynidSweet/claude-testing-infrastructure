import { CoverageAnalysis, CoveredElement } from '../TestGapAnalyzer';

/**
 * Coverage Analyzer - Analyzes structural test coverage
 *
 * Examines source and test content to determine what's currently covered
 * by structural tests and identifies coverage gaps.
 */
export class CoverageAnalyzer {
  /**
   * Analyze current test coverage
   */
  async analyzeStructuralTestCoverage(
    sourceContent: string,
    testContent: string
  ): Promise<CoverageAnalysis> {
    // Extract structural elements from source
    const functions = this.extractFunctions(sourceContent);
    const classes = this.extractClasses(sourceContent);
    const exports = this.extractExports(sourceContent);

    // Check what's covered in tests
    const coveredFunctions = functions.map((func) => ({
      ...func,
      isCovered: testContent.includes(func.name),
      coverageType: testContent.includes(func.name) ? ('structural' as const) : ('none' as const),
    }));

    const coveredClasses = classes.map((cls) => ({
      ...cls,
      isCovered: testContent.includes(cls.name),
      coverageType: testContent.includes(cls.name) ? ('structural' as const) : ('none' as const),
    }));

    const coveredExports = exports.map((exp) => ({
      ...exp,
      isCovered: testContent.includes(exp.name),
      coverageType: testContent.includes(exp.name) ? ('structural' as const) : ('none' as const),
    }));

    const totalElements = functions.length + classes.length + exports.length;
    const coveredElements = [
      ...coveredFunctions.filter((f) => f.isCovered),
      ...coveredClasses.filter((c) => c.isCovered),
      ...coveredExports.filter((e) => e.isCovered),
    ].length;

    const estimatedPercentage =
      totalElements > 0 ? Math.round((coveredElements / totalElements) * 100) : 0;

    // Identify gap types
    const businessLogicGaps = this.identifyBusinessLogicGaps(sourceContent, testContent);
    const edgeCaseGaps = this.identifyEdgeCaseGaps(sourceContent, testContent);
    const integrationGaps = this.identifyIntegrationGaps(sourceContent, testContent);

    return {
      structuralCoverage: {
        functions: coveredFunctions,
        classes: coveredClasses,
        exports: coveredExports,
        estimatedPercentage,
      },
      businessLogicGaps,
      edgeCaseGaps,
      integrationGaps,
    };
  }

  /**
   * Extract function definitions from source code
   */
  private extractFunctions(content: string): CoveredElement[] {
    const functionPatterns = [
      /function\s+(\w+)/g,
      /const\s+(\w+)\s*=\s*.*?=>/g,
      /(\w+):\s*\([^)]*\)\s*=>/g,
      /def\s+(\w+)/g, // Python
    ];

    const functions: CoveredElement[] = [];

    for (const pattern of functionPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        if (match[1]) {
          functions.push({
            name: match[1],
            type: 'function',
            isCovered: false,
            coverageType: 'none',
            complexity: 1, // Basic complexity
          });
        }
      }
    }

    return functions;
  }

  /**
   * Extract class definitions from source code
   */
  private extractClasses(content: string): CoveredElement[] {
    const classPatterns = [/class\s+(\w+)/g, /interface\s+(\w+)/g, /type\s+(\w+)\s*=/g];

    const classes: CoveredElement[] = [];

    for (const pattern of classPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        if (match[1]) {
          classes.push({
            name: match[1],
            type: 'class',
            isCovered: false,
            coverageType: 'none',
            complexity: 2, // Classes are inherently more complex
          });
        }
      }
    }

    return classes;
  }

  /**
   * Extract export definitions from source code
   */
  private extractExports(content: string): CoveredElement[] {
    const exportPatterns = [
      /export\s+(?:default\s+)?(?:function|class|const|let|var)\s+(\w+)/g,
      /export\s*\{\s*([^}]+)\s*\}/g,
    ];

    const exports: CoveredElement[] = [];

    for (const pattern of exportPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        if (pattern.source.includes('{') && match[1]) {
          // Handle export { name1, name2 } syntax
          const names = match[1].split(',').map((name) => name.trim());
          for (const name of names) {
            exports.push({
              name: name.replace(/\s+as\s+\w+/, ''), // Remove 'as alias'
              type: 'export',
              isCovered: false,
              coverageType: 'none',
              complexity: 1,
            });
          }
        } else if (match[1]) {
          exports.push({
            name: match[1],
            type: 'export',
            isCovered: false,
            coverageType: 'none',
            complexity: 1,
          });
        }
      }
    }

    return exports;
  }

  /**
   * Identify business logic gaps
   */
  private identifyBusinessLogicGaps(sourceContent: string, testContent: string): string[] {
    const gaps: string[] = [];

    // Check for complex conditionals
    if (
      (/\b(if|switch)\b.*?\{[^}]{50,}\}/gs.test(sourceContent) &&
        !testContent.includes('describe')) ||
      !testContent.includes('test cases')
    ) {
      gaps.push('Complex conditional logic not thoroughly tested');
    }

    // Check for async operations
    if (
      (/\b(async|await|Promise|then|catch)\b/g.test(sourceContent) &&
        !testContent.includes('async')) ||
      !testContent.includes('await')
    ) {
      gaps.push('Async operations may need error handling tests');
    }

    // Check for data transformation
    if (
      (/\b(map|filter|reduce|forEach|find)\b/g.test(sourceContent) &&
        !testContent.includes('data')) ||
      !testContent.includes('transform')
    ) {
      gaps.push('Data transformation logic needs validation');
    }

    return gaps;
  }

  /**
   * Identify edge case gaps
   */
  private identifyEdgeCaseGaps(sourceContent: string, testContent: string): string[] {
    const gaps: string[] = [];

    // Check for error handling
    if (
      (/\b(try|catch|throw|Error)\b/g.test(sourceContent) && !testContent.includes('error')) ||
      !testContent.includes('throw')
    ) {
      gaps.push('Error handling scenarios need testing');
    }

    // Check for boundary conditions
    if (
      (/\b(length|size|count|index)\b/g.test(sourceContent) && !testContent.includes('empty')) ||
      !testContent.includes('boundary')
    ) {
      gaps.push('Boundary conditions (empty arrays, null values) need testing');
    }

    return gaps;
  }

  /**
   * Identify integration gaps
   */
  private identifyIntegrationGaps(sourceContent: string, testContent: string): string[] {
    const gaps: string[] = [];

    // Check for external dependencies
    if (
      (/import\s+.*?from\s+['"][^./]/g.test(sourceContent) && !testContent.includes('mock')) ||
      !testContent.includes('jest.mock')
    ) {
      gaps.push('External dependencies need integration testing');
    }

    // Check for API calls
    if (
      (/\b(fetch|axios|request|http)\b/g.test(sourceContent) && !testContent.includes('api')) ||
      !testContent.includes('network')
    ) {
      gaps.push('API integration points need testing');
    }

    return gaps;
  }
}
