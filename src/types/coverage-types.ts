/**
 * Discriminated union types for coverage operations
 * Provides strong typing for coverage inputs and results to improve AI comprehension
 */

import type { CoverageData } from '../runners/CoverageParser';

/**
 * Discriminated union for coverage input types
 */
export type CoverageInput =
  | { type: 'json'; data: object; format?: 'jest' | 'istanbul' | 'pytest' }
  | { type: 'text'; data: string; format?: 'jest' | 'pytest' }
  | { type: 'file'; path: string; format?: 'jest' | 'pytest' };

/**
 * Discriminated union for coverage parsing results
 */
export type CoverageParseResult =
  | { type: 'success'; coverage: CoverageData; metadata: CoverageMetadata }
  | { type: 'partial'; coverage: CoverageData; warnings: string[]; metadata: CoverageMetadata }
  | { type: 'error'; error: string; context: CoverageErrorContext };

/**
 * Metadata about the coverage parsing operation
 */
export interface CoverageMetadata {
  parser: 'jest' | 'pytest';
  inputType: 'json' | 'text' | 'file';
  timestamp: string;
  processingTime: number;
  fileCount: number;
}

/**
 * Context information for coverage parsing errors
 */
export interface CoverageErrorContext {
  inputType?: string;
  format?: string;
  parser?: string;
  timestamp: string;
  details?: Record<string, unknown>;
}

/**
 * Discriminated union for coverage report formats
 */
export type CoverageReportFormat =
  | { type: 'html'; outputPath: string; includeDetails: boolean }
  | { type: 'json'; outputPath?: string; pretty: boolean }
  | { type: 'xml'; outputPath: string; junitFormat: boolean }
  | { type: 'markdown'; outputPath?: string; includeCharts: boolean }
  | { type: 'terminal'; colors: boolean; detailed: boolean };

/**
 * Type guards for CoverageInput
 */
export function isJsonInput(
  input: CoverageInput
): input is Extract<CoverageInput, { type: 'json' }> {
  return input.type === 'json';
}

export function isTextInput(
  input: CoverageInput
): input is Extract<CoverageInput, { type: 'text' }> {
  return input.type === 'text';
}

export function isFileInput(
  input: CoverageInput
): input is Extract<CoverageInput, { type: 'file' }> {
  return input.type === 'file';
}

/**
 * Type guards for CoverageParseResult
 */
export function isCoverageSuccessResult(
  result: CoverageParseResult
): result is Extract<CoverageParseResult, { type: 'success' }> {
  return result.type === 'success';
}

export function isCoveragePartialResult(
  result: CoverageParseResult
): result is Extract<CoverageParseResult, { type: 'partial' }> {
  return result.type === 'partial';
}

export function isCoverageErrorResult(
  result: CoverageParseResult
): result is Extract<CoverageParseResult, { type: 'error' }> {
  return result.type === 'error';
}

/**
 * Type guards for CoverageReportFormat
 */
export function isHtmlFormat(
  format: CoverageReportFormat
): format is Extract<CoverageReportFormat, { type: 'html' }> {
  return format.type === 'html';
}

export function isJsonFormat(
  format: CoverageReportFormat
): format is Extract<CoverageReportFormat, { type: 'json' }> {
  return format.type === 'json';
}

export function isXmlFormat(
  format: CoverageReportFormat
): format is Extract<CoverageReportFormat, { type: 'xml' }> {
  return format.type === 'xml';
}

export function isMarkdownFormat(
  format: CoverageReportFormat
): format is Extract<CoverageReportFormat, { type: 'markdown' }> {
  return format.type === 'markdown';
}

export function isTerminalFormat(
  format: CoverageReportFormat
): format is Extract<CoverageReportFormat, { type: 'terminal' }> {
  return format.type === 'terminal';
}
