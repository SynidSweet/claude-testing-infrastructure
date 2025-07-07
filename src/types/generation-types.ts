/**
 * Discriminated union types for test generation operations
 * Provides strong typing for generation inputs and results to improve AI comprehension
 */

/**
 * Gap analysis result for logical test generation
 */
export interface GapAnalysisResult {
  fileGaps: FileGap[];
  totalFiles: number;
  coveragePercentage: number;
  missingTests: string[];
}

/**
 * File gap information
 */
export interface FileGap {
  filePath: string;
  hasTests: boolean;
  testPath?: string;
  coverage?: number;
  complexity?: number;
}

/**
 * File change information for incremental generation
 */
export interface FileChange {
  filePath: string;
  changeType: 'added' | 'modified' | 'deleted';
  lines?: { added: number; removed: number };
  functions?: string[];
}

/**
 * Discriminated union for test generation input types
 */
export type GenerationInput =
  | { type: 'structural'; projectPath: string; config: StructuralGenerationConfig }
  | {
      type: 'logical';
      projectPath: string;
      config: LogicalGenerationConfig;
      gapAnalysis: GapAnalysisResult;
    }
  | {
      type: 'incremental';
      projectPath: string;
      config: IncrementalGenerationConfig;
      changes: FileChange[];
    };

/**
 * Configuration for structural test generation
 */
export interface StructuralGenerationConfig {
  frameworks: string[];
  includePatterns: string[];
  excludePatterns: string[];
  outputDirectory: string;
  overwrite: boolean;
}

/**
 * Configuration for logical test generation
 */
export interface LogicalGenerationConfig {
  aiModel: string;
  batchSize: number;
  costLimit?: number;
  timeout: number;
  outputDirectory: string;
}

/**
 * Configuration for incremental test generation
 */
export interface IncrementalGenerationConfig {
  baseline?: string;
  maxFiles?: number;
  strategy: 'smart' | 'full' | 'minimal';
  outputDirectory: string;
}

/**
 * Discriminated union for test generation results
 */
export type GenerationResult =
  | { type: 'success'; tests: GeneratedTest[]; metadata: GenerationMetadata }
  | { type: 'partial'; tests: GeneratedTest[]; errors: string[]; metadata: GenerationMetadata }
  | { type: 'error'; error: string; context: GenerationErrorContext };

/**
 * Information about a generated test
 */
export interface GeneratedTest {
  filePath: string;
  sourceFile: string;
  framework: string;
  type: 'structural' | 'logical';
  lines: number;
  assertions: number;
  created: string;
}

/**
 * Metadata about the generation operation
 */
export interface GenerationMetadata {
  duration: number;
  filesProcessed: number;
  testsCreated: number;
  strategy: string;
  timestamp: string;
  cost?: number;
}

/**
 * Context information for generation errors
 */
export interface GenerationErrorContext {
  operation: string;
  projectPath?: string;
  sourceFile?: string;
  timestamp: string;
  details?: Record<string, unknown>;
}

/**
 * Discriminated union for generation strategies
 */
export type GenerationStrategy =
  | { type: 'full'; includeAll: boolean; parallel: boolean }
  | { type: 'incremental'; baselineRef: string; maxChanges: number }
  | { type: 'selective'; filePatterns: string[]; prioritize: boolean };

/**
 * Type guards for GenerationInput
 */
export function isStructuralInput(
  input: GenerationInput
): input is Extract<GenerationInput, { type: 'structural' }> {
  return input.type === 'structural';
}

export function isLogicalInput(
  input: GenerationInput
): input is Extract<GenerationInput, { type: 'logical' }> {
  return input.type === 'logical';
}

export function isIncrementalInput(
  input: GenerationInput
): input is Extract<GenerationInput, { type: 'incremental' }> {
  return input.type === 'incremental';
}

/**
 * Type guards for GenerationResult
 */
export function isGenerationSuccessResult(
  result: GenerationResult
): result is Extract<GenerationResult, { type: 'success' }> {
  return result.type === 'success';
}

export function isGenerationPartialResult(
  result: GenerationResult
): result is Extract<GenerationResult, { type: 'partial' }> {
  return result.type === 'partial';
}

export function isGenerationErrorResult(
  result: GenerationResult
): result is Extract<GenerationResult, { type: 'error' }> {
  return result.type === 'error';
}

/**
 * Type guards for GenerationStrategy
 */
export function isFullStrategy(
  strategy: GenerationStrategy
): strategy is Extract<GenerationStrategy, { type: 'full' }> {
  return strategy.type === 'full';
}

export function isIncrementalStrategy(
  strategy: GenerationStrategy
): strategy is Extract<GenerationStrategy, { type: 'incremental' }> {
  return strategy.type === 'incremental';
}

export function isSelectiveStrategy(
  strategy: GenerationStrategy
): strategy is Extract<GenerationStrategy, { type: 'selective' }> {
  return strategy.type === 'selective';
}
