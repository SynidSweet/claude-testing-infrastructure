/**
 * Type definitions for AI task processing and prioritization
 */

/**
 * Priority levels for AI tasks
 */
export type TaskPriority = 'critical' | 'high' | 'medium' | 'low';

/**
 * AI task processing configuration
 */
export interface AITaskConfig {
  priority: TaskPriority;
  batchSize: number;
  timeout: number;
  model: string;
  maxRetries: number;
}

/**
 * AI task processing result
 */
export interface AITaskResult {
  success: boolean;
  content?: string;
  error?: string;
  duration: number;
  tokensUsed?: number;
  retryCount: number;
}

/**
 * Gap analysis data structure
 */
export interface AIGapAnalysisData {
  filePath: string;
  language: string;
  framework?: string;
  functions: FunctionGap[];
  classes: ClassGap[];
  complexity: number;
  priority: TaskPriority;
}

/**
 * Function gap information
 */
export interface FunctionGap {
  name: string;
  parameters: string[];
  returnType?: string;
  async: boolean;
  exported: boolean;
  lineNumber: number;
}

/**
 * Class gap information
 */
export interface ClassGap {
  name: string;
  methods: FunctionGap[];
  properties: string[];
  extends?: string;
  exported: boolean;
  lineNumber: number;
}

/**
 * Batch processing state
 */
export interface BatchProcessingState {
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  currentBatch: number;
  totalBatches: number;
  estimatedTimeRemaining: number;
  results: AITaskResult[];
}

/**
 * Type guard for TaskPriority
 */
export function isValidTaskPriority(value: unknown): value is TaskPriority {
  return typeof value === 'string' && ['critical', 'high', 'medium', 'low'].includes(value);
}

/**
 * Type guard for GapAnalysisData
 */
export function isAIGapAnalysisData(value: unknown): value is AIGapAnalysisData {
  return (
    typeof value === 'object' &&
    value !== null &&
    'filePath' in value &&
    'language' in value &&
    'functions' in value &&
    'classes' in value &&
    'complexity' in value &&
    'priority' in value
  );
}
