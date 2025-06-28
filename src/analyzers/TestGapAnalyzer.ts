import { promises as fs } from 'fs';
import path from 'path';
import { logger } from '../utils/logger';
import { ProjectAnalysis } from './ProjectAnalyzer';
import { GeneratedTest, TestGenerationResult, TestType } from '../generators/TestGenerator';

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
  LOW = 'low'
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
 */
export class TestGapAnalyzer {
  private projectAnalysis: ProjectAnalysis;
  private config: TestGapAnalyzerConfig;

  constructor(
    projectAnalysis: ProjectAnalysis,
    config: TestGapAnalyzerConfig = {}
  ) {
    this.projectAnalysis = projectAnalysis;
    this.config = {
      complexityThreshold: 3, // Lower threshold for better test coverage
      priorityWeights: {
        complexity: 0.3,
        businessLogic: 0.4,
        integrations: 0.3
      },
      costPerToken: 0.00001, // $0.01 per 1000 tokens
      ...config
    };
  }

  /**
   * Analyze generated tests to identify gaps for AI generation
   */
  async analyzeGaps(generationResult: TestGenerationResult): Promise<TestGapAnalysisResult> {
    logger.info('Starting test gap analysis', {
      generatedTests: generationResult.tests.length,
      projectPath: this.projectAnalysis.projectPath
    });

    const gaps: TestGap[] = [];
    
    for (const test of generationResult.tests) {
      const gap = await this.analyzeTestFile(test);
      if (gap) {
        gaps.push(gap);
      }
    }

    const summary = this.generateSummary(gaps, generationResult);
    const recommendations = this.generateRecommendations(gaps);
    const costEstimation = this.calculateCostEstimation(gaps);

    return {
      timestamp: new Date().toISOString(),
      projectPath: this.projectAnalysis.projectPath,
      summary,
      gaps,
      recommendations,
      estimatedCost: costEstimation
    };
  }

  /**
   * Analyze a single test file to identify gaps
   */
  private async analyzeTestFile(test: GeneratedTest): Promise<TestGap | null> {
    try {
      logger.debug('Analyzing test file for gaps', { testPath: test.testPath });

      // Read source file to analyze
      const sourceContent = await fs.readFile(test.sourcePath, 'utf-8');
      const testContent = test.content;

      // Calculate complexity
      const complexity = await this.calculateComplexity(sourceContent, test.sourcePath);
      
      // Skip low-complexity files
      if (complexity.overall < this.config.complexityThreshold!) {
        logger.debug('Skipping low-complexity file', { 
          sourceFile: test.sourcePath,
          complexity: complexity.overall 
        });
        return null;
      }

      // Analyze current coverage
      const currentCoverage = await this.analyzeCoverage(sourceContent, testContent);
      
      // Identify gaps
      const gaps = await this.identifyGaps(sourceContent, currentCoverage, test);
      
      if (gaps.length === 0) {
        return null;
      }

      // Calculate priority
      const priority = this.calculatePriority(complexity, gaps);
      
      // Extract context for AI
      const context = await this.extractTestContext(sourceContent, test.sourcePath);

      return {
        sourceFile: test.sourcePath,
        testFile: test.testPath,
        currentCoverage,
        gaps,
        complexity,
        priority,
        context
      };

    } catch (error) {
      logger.error('Error analyzing test file', {
        testPath: test.testPath,
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  /**
   * Calculate complexity metrics for a source file
   */
  private async calculateComplexity(sourceContent: string, _filePath: string): Promise<ComplexityScore> {
    const lines = sourceContent.split('\n');
    const linesOfCode = lines.filter(line => 
      line.trim() && !line.trim().startsWith('//') && !line.trim().startsWith('*')
    ).length;

    // Basic complexity indicators
    const cyclomaticIndicators = (sourceContent.match(/\b(if|else|for|while|switch|case|catch|&&|\|\|)\b/g) || []).length;
    const dependencies = (sourceContent.match(/import\s+.*?from\s+['"]/g) || []).length;
    const exports = (sourceContent.match(/export\s+(default\s+)?(function|class|const|let|var)/g) || []).length;
    const nestingDepth = this.calculateNestingDepth(sourceContent);

    // Calculate overall complexity (1-10 scale)
    const overall = Math.min(10, Math.ceil(
      (linesOfCode / 50) + 
      (cyclomaticIndicators / 10) + 
      (dependencies / 20) + 
      (nestingDepth / 3)
    ));

    return {
      overall,
      cyclomaticIndicators,
      dependencies,
      linesOfCode,
      exports,
      nestingDepth
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

  /**
   * Analyze current test coverage
   */
  private async analyzeCoverage(sourceContent: string, testContent: string): Promise<CoverageAnalysis> {
    // Extract structural elements from source
    const functions = this.extractFunctions(sourceContent);
    const classes = this.extractClasses(sourceContent);
    const exports = this.extractExports(sourceContent);

    // Check what's covered in tests
    const coveredFunctions = functions.map(func => ({
      ...func,
      isCovered: testContent.includes(func.name),
      coverageType: testContent.includes(func.name) ? 'structural' as const : 'none' as const
    }));

    const coveredClasses = classes.map(cls => ({
      ...cls,
      isCovered: testContent.includes(cls.name),
      coverageType: testContent.includes(cls.name) ? 'structural' as const : 'none' as const
    }));

    const coveredExports = exports.map(exp => ({
      ...exp,
      isCovered: testContent.includes(exp.name),
      coverageType: testContent.includes(exp.name) ? 'structural' as const : 'none' as const
    }));

    const totalElements = functions.length + classes.length + exports.length;
    const coveredElements = [
      ...coveredFunctions.filter(f => f.isCovered),
      ...coveredClasses.filter(c => c.isCovered),
      ...coveredExports.filter(e => e.isCovered)
    ].length;

    const estimatedPercentage = totalElements > 0 ? Math.round((coveredElements / totalElements) * 100) : 0;

    // Identify gap types
    const businessLogicGaps = this.identifyBusinessLogicGaps(sourceContent, testContent);
    const edgeCaseGaps = this.identifyEdgeCaseGaps(sourceContent, testContent);
    const integrationGaps = this.identifyIntegrationGaps(sourceContent, testContent);

    return {
      structuralCoverage: {
        functions: coveredFunctions,
        classes: coveredClasses,
        exports: coveredExports,
        estimatedPercentage
      },
      businessLogicGaps,
      edgeCaseGaps,
      integrationGaps
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
      /def\s+(\w+)/g // Python
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
            complexity: 1 // Basic complexity
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
    const classPatterns = [
      /class\s+(\w+)/g,
      /interface\s+(\w+)/g,
      /type\s+(\w+)\s*=/g
    ];

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
            complexity: 2 // Classes are inherently more complex
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
      /export\s*\{\s*([^}]+)\s*\}/g
    ];

    const exports: CoveredElement[] = [];
    
    for (const pattern of exportPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        if (pattern.source.includes('{') && match[1]) {
          // Handle export { name1, name2 } syntax
          const names = match[1].split(',').map(name => name.trim());
          for (const name of names) {
            exports.push({
              name: name.replace(/\s+as\s+\w+/, ''), // Remove 'as alias'
              type: 'export',
              isCovered: false,
              coverageType: 'none',
              complexity: 1
            });
          }
        } else if (match[1]) {
          exports.push({
            name: match[1],
            type: 'export',
            isCovered: false,
            coverageType: 'none',
            complexity: 1
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
    if (/\b(if|switch)\b.*?\{[^}]{50,}\}/gs.test(sourceContent) && 
        !testContent.includes('describe') || !testContent.includes('test cases')) {
      gaps.push('Complex conditional logic not thoroughly tested');
    }

    // Check for async operations
    if (/\b(async|await|Promise|then|catch)\b/g.test(sourceContent) && 
        !testContent.includes('async') || !testContent.includes('await')) {
      gaps.push('Async operations may need error handling tests');
    }

    // Check for data transformation
    if (/\b(map|filter|reduce|forEach|find)\b/g.test(sourceContent) && 
        !testContent.includes('data') || !testContent.includes('transform')) {
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
    if (/\b(try|catch|throw|Error)\b/g.test(sourceContent) && 
        !testContent.includes('error') || !testContent.includes('throw')) {
      gaps.push('Error handling scenarios need testing');
    }

    // Check for boundary conditions
    if (/\b(length|size|count|index)\b/g.test(sourceContent) && 
        !testContent.includes('empty') || !testContent.includes('boundary')) {
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
    if (/import\s+.*?from\s+['"][^./]/g.test(sourceContent) && 
        !testContent.includes('mock') || !testContent.includes('jest.mock')) {
      gaps.push('External dependencies need integration testing');
    }

    // Check for API calls
    if (/\b(fetch|axios|request|http)\b/g.test(sourceContent) && 
        !testContent.includes('api') || !testContent.includes('network')) {
      gaps.push('API integration points need testing');
    }

    return gaps;
  }

  /**
   * Identify specific gaps requiring AI generation
   */
  private async identifyGaps(
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

  /**
   * Calculate priority for AI generation
   */
  private calculatePriority(complexity: ComplexityScore, gaps: IdentifiedGap[]): GapPriority {
    const weights = this.config.priorityWeights!;
    
    const complexityScore = complexity.overall / 10; // Normalize to 0-1
    const businessLogicScore = gaps.filter(g => g.type === 'business-logic').length / 5; // Normalize
    const integrationScore = gaps.filter(g => g.type === 'integration').length / 3; // Normalize

    const weightedScore = 
      (complexityScore * weights.complexity!) +
      (businessLogicScore * weights.businessLogic!) +
      (integrationScore * weights.integrations!);

    if (weightedScore > 0.8) return GapPriority.CRITICAL;
    if (weightedScore > 0.6) return GapPriority.HIGH;
    if (weightedScore > 0.4) return GapPriority.MEDIUM;
    return GapPriority.LOW;
  }

  /**
   * Extract context information for AI generation
   */
  private async extractTestContext(sourceContent: string, filePath: string): Promise<TestContext> {
    const framework = this.detectFramework(sourceContent);
    const language = this.detectLanguage(filePath);
    const fileType = this.detectFileType(sourceContent, filePath);
    
    const dependencies = this.extractDependencies(sourceContent);
    const codeSnippets = this.extractCodeSnippets(sourceContent);
    const relatedFiles = await this.findRelatedFiles(filePath);

    return {
      dependencies,
      framework,
      language,
      fileType,
      codeSnippets,
      relatedFiles
    };
  }

  /**
   * Detect framework from source content
   */
  private detectFramework(content: string): string {
    if (content.includes('react') || content.includes('React')) return 'react';
    if (content.includes('vue') || content.includes('Vue')) return 'vue';
    if (content.includes('express')) return 'express';
    if (content.includes('fastapi')) return 'fastapi';
    if (content.includes('django')) return 'django';
    return 'unknown';
  }

  /**
   * Detect language from file path
   */
  private detectLanguage(filePath: string): string {
    const ext = path.extname(filePath);
    if (['.ts', '.tsx'].includes(ext)) return 'typescript';
    if (['.js', '.jsx'].includes(ext)) return 'javascript';
    if (ext === '.py') return 'python';
    return 'unknown';
  }

  /**
   * Detect file type from content and path
   */
  private detectFileType(content: string, filePath: string): TestContext['fileType'] {
    const fileName = path.basename(filePath).toLowerCase();
    
    if (content.includes('React.Component') || content.includes('function ') && content.includes('return')) {
      return 'component';
    }
    if (fileName.includes('service') || content.includes('service')) return 'service';
    if (fileName.includes('util') || fileName.includes('helper')) return 'utility';
    if (content.includes('router') || content.includes('app.') || content.includes('endpoint')) return 'api';
    if (content.includes('model') || content.includes('schema')) return 'model';
    if (content.includes('hook') || fileName.includes('hook')) return 'hook';
    
    return 'unknown';
  }

  /**
   * Extract dependencies from imports
   */
  private extractDependencies(content: string): string[] {
    const importRegex = /import\s+.*?from\s+['"]([^'"]+)['"]/g;
    const dependencies: string[] = [];
    
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      if (match[1]) {
        dependencies.push(match[1]);
      }
    }
    
    return dependencies;
  }

  /**
   * Extract code snippets for AI context
   */
  private extractCodeSnippets(content: string): CodeSnippet[] {
    const snippets: CodeSnippet[] = [];
    
    // Look for function definitions
    const functionRegex = /(function\s+\w+|const\s+\w+\s*=.*?=>|def\s+\w+)/g;
    
    let match;
    while ((match = functionRegex.exec(content)) !== null) {
      const startIndex = content.lastIndexOf('\n', match.index) + 1;
      const functionStart = content.slice(0, match.index).split('\n').length - 1;
      
      // Find the end of the function (simple heuristic)
      let braceCount = 0;
      let endIndex = match.index;
      let foundStart = false;
      
      for (let i = match.index; i < content.length; i++) {
        if (content[i] === '{') {
          braceCount++;
          foundStart = true;
        } else if (content[i] === '}') {
          braceCount--;
          if (foundStart && braceCount === 0) {
            endIndex = i + 1;
            break;
          }
        }
      }
      
      const snippet = content.slice(startIndex, endIndex);
      const functionEnd = content.slice(0, endIndex).split('\n').length - 1;
      
      if (snippet.length > 10 && snippet.length < 500) { // Reasonable size
        const name = match[0].replace(/function\s+|const\s+|def\s+/, '').split(/\s|=/)[0] || 'unknown';
        snippets.push({
          name,
          content: snippet,
          lines: { start: functionStart, end: functionEnd },
          hasAsyncOperations: /\b(async|await|Promise)\b/.test(snippet),
          hasConditionals: /\b(if|switch|case)\b/.test(snippet),
          hasLoops: /\b(for|while|forEach|map)\b/.test(snippet),
          hasErrorHandling: /\b(try|catch|throw)\b/.test(snippet)
        });
      }
    }
    
    return snippets.slice(0, 5); // Limit to 5 snippets for token efficiency
  }

  /**
   * Find related files for context
   */
  private async findRelatedFiles(filePath: string): Promise<string[]> {
    try {
      const dir = path.dirname(filePath);
      const fileName = path.basename(filePath, path.extname(filePath));
      
      // Look for related files in the same directory
      const files = await fs.readdir(dir);
      const related = files
        .filter(file => {
          const fileBase = path.basename(file, path.extname(file));
          return fileBase.includes(fileName) || fileName.includes(fileBase);
        })
        .filter(file => file !== path.basename(filePath))
        .slice(0, 3); // Limit for token efficiency
      
      return related.map(file => path.join(dir, file));
    } catch (error) {
      logger.debug('Error finding related files', { filePath, error });
      return [];
    }
  }

  /**
   * Generate summary statistics
   */
  private generateSummary(gaps: TestGap[], generationResult: TestGenerationResult): GapAnalysisSummary {
    const totalFiles = generationResult.tests.length;
    const filesWithTests = totalFiles;
    const filesNeedingLogicalTests = gaps.length;
    const totalGaps = gaps.reduce((sum, gap) => sum + gap.gaps.length, 0);

    const priorityBreakdown = gaps.reduce((breakdown, gap) => {
      breakdown[gap.priority] = (breakdown[gap.priority] || 0) + 1;
      return breakdown;
    }, {} as Record<GapPriority, number>);

    // Set default values for missing priorities
    Object.values(GapPriority).forEach(priority => {
      if (!(priority in priorityBreakdown)) {
        priorityBreakdown[priority] = 0;
      }
    });

    const overallAssessment: GapAnalysisSummary['overallAssessment'] = 
      filesNeedingLogicalTests === 0 ? 'excellent' :
      filesNeedingLogicalTests < totalFiles * 0.3 ? 'good' :
      filesNeedingLogicalTests < totalFiles * 0.7 ? 'needs-improvement' : 'poor';

    return {
      totalFiles,
      filesWithTests,
      filesNeedingLogicalTests,
      totalGaps,
      priorityBreakdown,
      overallAssessment
    };
  }

  /**
   * Generate actionable recommendations
   */
  private generateRecommendations(gaps: TestGap[]): string[] {
    const recommendations: string[] = [];

    const criticalGaps = gaps.filter(g => g.priority === GapPriority.CRITICAL);
    const highGaps = gaps.filter(g => g.priority === GapPriority.HIGH);

    if (criticalGaps.length > 0) {
      recommendations.push(`Address ${criticalGaps.length} critical complexity files first for maximum impact`);
    }

    if (highGaps.length > 0) {
      recommendations.push(`Focus on ${highGaps.length} high-priority files with business logic gaps`);
    }

    const businessLogicCount = gaps.reduce((count, gap) => 
      count + gap.gaps.filter(g => g.type === 'business-logic').length, 0
    );
    
    if (businessLogicCount > 0) {
      recommendations.push(`Generate ${businessLogicCount} logical tests for business logic validation`);
    }

    const integrationCount = gaps.reduce((count, gap) => 
      count + gap.gaps.filter(g => g.type === 'integration').length, 0
    );
    
    if (integrationCount > 0) {
      recommendations.push(`Create ${integrationCount} integration tests for external dependencies`);
    }

    if (recommendations.length === 0) {
      recommendations.push('Structural tests appear comprehensive - no additional logical tests needed');
    }

    return recommendations;
  }

  /**
   * Calculate cost estimation for AI generation
   */
  private calculateCostEstimation(gaps: TestGap[]): CostEstimation {
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
      complexityDistribution
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