/**
 * Analyzers module
 * 
 * This module contains code analyzers for different frameworks and languages
 */

export { ProjectAnalyzer } from './ProjectAnalyzer';
export type {
  ProjectAnalysis,
  DetectedLanguage,
  DetectedFramework,
  DetectedPackageManager,
  ProjectStructure,
  Dependencies,
  TestingSetup,
  ComplexityMetrics
} from './ProjectAnalyzer';

export { TestGapAnalyzer } from './TestGapAnalyzer';
export type {
  TestGap,
  CoverageAnalysis,
  StructuralCoverage,
  CoveredElement,
  IdentifiedGap,
  GapPriority,
  ComplexityScore,
  TestContext,
  CodeSnippet,
  TestGapAnalysisResult,
  GapAnalysisSummary,
  CostEstimation,
  TestGapAnalyzerConfig
} from './TestGapAnalyzer';

export { GapReportGenerator } from './GapReportGenerator';
export type {
  ReportOptions,
  VisualizationConfig,
  GapReportSchema,
  DetailedGap,
  ActionableInsight
} from './GapReportGenerator';

// Legacy interface for backward compatibility
export interface Analyzer {
  name: string;
  analyze(filePath: string): Promise<AnalysisResult>;
}

export interface AnalysisResult {
  success: boolean;
  data?: any;
  errors?: string[];
}

// Updated function using ProjectAnalyzer
export async function analyzeCode(projectPath: string, _analyzerType?: string): Promise<AnalysisResult> {
  const { ProjectAnalyzer } = await import('./ProjectAnalyzer');
  
  try {
    const analyzer = new ProjectAnalyzer(projectPath);
    const analysis = await analyzer.analyze();
    
    return {
      success: true,
      data: analysis
    };
  } catch (error) {
    return {
      success: false,
      errors: [error instanceof Error ? error.message : String(error)]
    };
  }
}