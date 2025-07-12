/**
 * Type definitions for AI-enhanced workflow processing
 * Provides comprehensive type safety for the AIEnhancedTestingWorkflow
 */

import type { AITask, AITaskBatch, AITaskResult } from '../ai/AITaskPreparation';
import type { TestGapAnalysisResult } from '../analyzers/TestGapAnalyzer';

/**
 * Workflow phases for type-safe phase tracking
 */
export type WorkflowPhase =
  | 'analysis'
  | 'structural-generation'
  | 'test-execution'
  | 'gap-analysis'
  | 'ai-generation'
  | 'final-execution';

/**
 * Event types emitted during workflow execution
 */
export interface WorkflowEvents {
  'workflow:start': {
    projectPath: string;
    config: WorkflowConfig;
  };
  'workflow:complete': {
    result: WorkflowResult;
  };
  'workflow:error': {
    error: AIWorkflowError;
  };
  'phase:start': {
    phase: WorkflowPhase;
  };
  'phase:complete': {
    phase: WorkflowPhase;
    result?: unknown;
    count?: number;
    results?: unknown;
    gaps?: number;
  };
  'ai:skipped': {
    reason: AIWorkflowError;
  };
  'ai:task-complete': {
    file: string;
  };
}

/**
 * AI task with source file information
 */
export interface AITaskWithSource extends AITask {
  sourceFile: string;
}

/**
 * Orchestrator statistics with proper typing
 */
export interface OrchestratorStats {
  totalCost: number;
  totalTokensUsed: number;
  totalDuration: number;
  successfulTasks: number;
  failedTasks: number;
}

/**
 * Extended orchestrator for type safety
 */
export interface TypedClaudeOrchestrator {
  processBatch(batch: AITaskBatch): Promise<AITaskResult[]>;
  getStats(): OrchestratorStats;
  on(event: 'task:complete', listener: (data: { task: AITaskWithSource }) => void): void;
}

/**
 * Structural test file result
 */
export interface StructuralTestFile {
  testPath: string;
  content: string;
  sourceFile: string;
}

/**
 * Structural test generation result with proper typing
 */
export interface StructuralTestGenerationResult {
  tests: StructuralTestFile[];
  stats: {
    filesAnalyzed: number;
    testsGenerated: number;
    testLinesGenerated: number;
    generationTime: number;
  };
}

/**
 * Import types from original file for re-export
 */
export interface TestRunResults {
  results: TestResult;
  coverage?: CoverageResult | undefined;
}

export interface WorkflowConfig {
  // Analysis options
  includePatterns?: string[];
  excludePatterns?: string[];

  // Generation options
  testFramework?: string;
  generateMocks?: boolean;

  // AI options
  enableAI?: boolean;
  aiModel?: string;
  aiBudget?: number;
  aiConcurrency?: number;
  minComplexityForAI?: number;

  // Execution options
  runTests?: boolean;
  coverage?: boolean;

  // Output options
  outputDir?: string;
  verbose?: boolean;
}

export interface AIGenerationResults {
  successful: number;
  failed: number;
  totalCost: number;
  totalTokens?: number;
}

export interface WorkflowResult {
  success: boolean;
  projectAnalysis: ProjectAnalysis;
  generatedTests: {
    structural: number;
    logical: number;
  };
  testResults?: TestResult;
  coverage?: CoverageResult;
  gaps?: GapAnalysisResult;
  aiResults?: AIGenerationResults;
  totalCost?: number;
  duration: number;
  reports: {
    summary: string;
    detailed: WorkflowDetailedReport;
  };
}

export interface WorkflowDetailedReport {
  timestamp: string;
  projectPath: string;
  config: WorkflowConfig;
  error?: AIWorkflowError | undefined;
  stack?: string | undefined;
  context?: Record<string, unknown> | undefined;
  [key: string]: unknown;
}

// Import required types from dependencies
import type { TestResult, CoverageResult } from '../runners/TestRunner';
import type { ProjectAnalysis } from '../analyzers/ProjectAnalyzer';
import type { GapAnalysisResult } from '../types/generation-types';
import type { AIWorkflowError } from '../types/ai-error-types';

/**
 * Type guards for runtime validation
 */
export function isWorkflowPhase(value: unknown): value is WorkflowPhase {
  return (
    typeof value === 'string' &&
    [
      'analysis',
      'structural-generation',
      'test-execution',
      'gap-analysis',
      'ai-generation',
      'final-execution',
    ].includes(value)
  );
}

export function isAITaskWithSource(task: unknown): task is AITaskWithSource {
  return (
    typeof task === 'object' &&
    task !== null &&
    'sourceFile' in task &&
    typeof (task as AITaskWithSource).sourceFile === 'string'
  );
}

export function isOrchestratorStats(stats: unknown): stats is OrchestratorStats {
  return (
    typeof stats === 'object' &&
    stats !== null &&
    'totalCost' in stats &&
    'totalTokensUsed' in stats &&
    typeof (stats as OrchestratorStats).totalCost === 'number' &&
    typeof (stats as OrchestratorStats).totalTokensUsed === 'number'
  );
}

/**
 * Utility type for typed event emitter
 */
export type WorkflowEventHandler<K extends keyof WorkflowEvents> = (
  data: WorkflowEvents[K]
) => void;

/**
 * Workflow execution state
 */
export interface WorkflowState {
  currentPhase: WorkflowPhase | null;
  startTime: number;
  phaseTimes: Partial<Record<WorkflowPhase, { start: number; end?: number }>>;
  results: Partial<WorkflowResult>;
  errors: AIWorkflowError[];
}

/**
 * Phase transition validation
 */
export const WORKFLOW_PHASE_TRANSITIONS: Record<WorkflowPhase, WorkflowPhase[]> = {
  analysis: ['structural-generation'],
  'structural-generation': ['test-execution', 'gap-analysis'],
  'test-execution': ['gap-analysis'],
  'gap-analysis': ['ai-generation', 'final-execution'],
  'ai-generation': ['final-execution'],
  'final-execution': [],
};

/**
 * Validate phase transition
 */
export function isValidPhaseTransition(from: WorkflowPhase | null, to: WorkflowPhase): boolean {
  if (from === null) {
    return to === 'analysis';
  }
  return WORKFLOW_PHASE_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Phase result types for type safety
 */
export interface PhaseResults {
  analysis: ProjectAnalysis;
  'structural-generation': StructuralTestFile[];
  'test-execution': TestRunResults;
  'gap-analysis': TestGapAnalysisResult;
  'ai-generation': AIGenerationResults;
  'final-execution': TestRunResults;
}

/**
 * Type-safe phase result getter
 */
export type PhaseResult<T extends WorkflowPhase> = T extends keyof PhaseResults
  ? PhaseResults[T]
  : never;

/**
 * AI response parsing result
 */
export interface ParsedAIResponse {
  success: boolean;
  testContent?: string;
  metadata?: {
    framework: string;
    testCount: number;
    coverage: string[];
  };
  error?: string;
}

/**
 * Response validation result
 */
export interface ResponseValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Parse AI response with type safety
 */
export function parseAIResponse(response: string): ParsedAIResponse {
  try {
    // Extract test content from response
    const testMatch = response.match(/```(?:javascript|typescript|js|ts)\n([\s\S]*?)\n```/);

    if (!testMatch) {
      return {
        success: false,
        error: 'No test code found in response',
      };
    }

    const testContent = testMatch[1];

    // Extract metadata if available
    const frameworkMatch = response.match(/framework:\s*(\w+)/i);
    const testCountMatch = response.match(/tests?:\s*(\d+)/i);

    return {
      success: true,
      testContent: testContent ?? '',
      metadata: {
        framework: frameworkMatch?.[1] ?? 'jest',
        testCount: testCountMatch?.[1] ? parseInt(testCountMatch[1], 10) : 1,
        coverage: [],
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error) || 'Failed to parse response',
    };
  }
}

/**
 * Validate response structure
 */
export function validateAIResponse(response: ParsedAIResponse): ResponseValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!response.success) {
    errors.push(response.error ?? 'Response parsing failed');
    return { isValid: false, errors, warnings };
  }

  if (!response.testContent) {
    errors.push('No test content found');
  }

  if (!response.metadata?.framework) {
    warnings.push('Test framework not specified');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}
