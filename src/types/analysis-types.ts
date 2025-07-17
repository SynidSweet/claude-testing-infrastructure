/**
 * Discriminated union types for analysis operations
 * Provides strong typing for analysis inputs and results to improve AI comprehension
 */

import type { ProjectAnalysis } from '../analyzers/ProjectAnalyzer';

// Re-export ProjectAnalysis for external use
export type { ProjectAnalysis };

/**
 * Discriminated union for analysis input types
 */
export type AnalysisInput =
  | { type: 'path'; projectPath: string; options?: AnalysisOptions }
  | { type: 'analysis'; analysis: ProjectAnalysis };

/**
 * Options for analysis operations
 */
export interface AnalysisOptions {
  includeTests?: boolean;
  excludePatterns?: string[];
  maxDepth?: number;
  followSymlinks?: boolean;
}

/**
 * Discriminated union for analysis results
 */
export type AnalysisResult =
  | { type: 'success'; analysis: ProjectAnalysis; metadata: AnalysisMetadata }
  | { type: 'partial'; analysis: ProjectAnalysis; warnings: string[]; metadata: AnalysisMetadata }
  | { type: 'error'; error: string; context: AnalysisErrorContext };

/**
 * Metadata about the analysis operation
 */
export interface AnalysisMetadata {
  duration: number;
  filesScanned: number;
  timestamp: string;
  version: string;
}

/**
 * Context information for analysis errors
 */
export interface AnalysisErrorContext {
  projectPath?: string;
  operation: string;
  timestamp: string;
  details?: Record<string, unknown>;
}

/**
 * Type guard for AnalysisInput
 */
export function isPathInput(
  input: AnalysisInput
): input is Extract<AnalysisInput, { type: 'path' }> {
  return input.type === 'path';
}

/**
 * Type guard for AnalysisInput
 */
export function isAnalysisInput(
  input: AnalysisInput
): input is Extract<AnalysisInput, { type: 'analysis' }> {
  return input.type === 'analysis';
}

/**
 * Type guard for AnalysisResult
 */
export function isAnalysisSuccessResult(
  result: AnalysisResult
): result is Extract<AnalysisResult, { type: 'success' }> {
  return result.type === 'success';
}

/**
 * Type guard for AnalysisResult
 */
export function isAnalysisPartialResult(
  result: AnalysisResult
): result is Extract<AnalysisResult, { type: 'partial' }> {
  return result.type === 'partial';
}

/**
 * Type guard for AnalysisResult
 */
export function isAnalysisErrorResult(
  result: AnalysisResult
): result is Extract<AnalysisResult, { type: 'error' }> {
  return result.type === 'error';
}
