/**
 * Discriminated union types for reporting operations
 * Provides strong typing for report inputs and results to improve AI comprehension
 */

/**
 * Discriminated union for report input types
 */
export type ReportInput =
  | { type: 'gap-analysis'; data: any; format: ReportFormat }
  | { type: 'coverage'; data: any; format: ReportFormat }
  | { type: 'test-results'; data: any; format: ReportFormat }
  | { type: 'project-analysis'; data: any; format: ReportFormat };

/**
 * Report format specifications
 */
export type ReportFormat = 'markdown' | 'html' | 'json' | 'xml' | 'terminal' | 'csv';

/**
 * Discriminated union for report generation results
 */
export type ReportResult =
  | { type: 'success'; content: string; metadata: ReportMetadata }
  | { type: 'error'; error: string; context: ReportErrorContext };

/**
 * Metadata about the report generation
 */
export interface ReportMetadata {
  format: ReportFormat;
  inputType: string;
  generatedAt: string;
  size: number;
  processingTime: number;
}

/**
 * Context information for report generation errors
 */
export interface ReportErrorContext {
  operation: string;
  format?: ReportFormat;
  inputType?: string;
  timestamp: string;
  details?: Record<string, unknown>;
}

/**
 * Discriminated union for report output destinations
 */
export type ReportOutput =
  | { type: 'file'; path: string; overwrite: boolean }
  | { type: 'console'; colors: boolean; pager: boolean }
  | { type: 'buffer'; encoding: 'utf8' | 'base64' };

/**
 * Discriminated union for report templates
 */
export type ReportTemplate =
  | { type: 'built-in'; name: string; variant?: string }
  | { type: 'custom'; path: string; engine: 'handlebars' | 'mustache' }
  | { type: 'inline'; template: string; engine: 'handlebars' | 'mustache' };

/**
 * Options for report customization
 */
export interface ReportOptions {
  title?: string;
  includeTimestamp?: boolean;
  includeMetadata?: boolean;
  theme?: 'light' | 'dark' | 'auto';
  language?: string;
  customCss?: string;
}

/**
 * Type guards for ReportInput
 */
export function isGapAnalysisInput(
  input: ReportInput
): input is Extract<ReportInput, { type: 'gap-analysis' }> {
  return input.type === 'gap-analysis';
}

export function isCoverageInput(
  input: ReportInput
): input is Extract<ReportInput, { type: 'coverage' }> {
  return input.type === 'coverage';
}

export function isTestResultsInput(
  input: ReportInput
): input is Extract<ReportInput, { type: 'test-results' }> {
  return input.type === 'test-results';
}

export function isProjectAnalysisInput(
  input: ReportInput
): input is Extract<ReportInput, { type: 'project-analysis' }> {
  return input.type === 'project-analysis';
}

/**
 * Type guards for ReportResult
 */
export function isReportSuccessResult(
  result: ReportResult
): result is Extract<ReportResult, { type: 'success' }> {
  return result.type === 'success';
}

export function isReportErrorResult(
  result: ReportResult
): result is Extract<ReportResult, { type: 'error' }> {
  return result.type === 'error';
}

/**
 * Type guards for ReportOutput
 */
export function isFileOutput(
  output: ReportOutput
): output is Extract<ReportOutput, { type: 'file' }> {
  return output.type === 'file';
}

export function isConsoleOutput(
  output: ReportOutput
): output is Extract<ReportOutput, { type: 'console' }> {
  return output.type === 'console';
}

export function isBufferOutput(
  output: ReportOutput
): output is Extract<ReportOutput, { type: 'buffer' }> {
  return output.type === 'buffer';
}

/**
 * Type guards for ReportTemplate
 */
export function isBuiltInTemplate(
  template: ReportTemplate
): template is Extract<ReportTemplate, { type: 'built-in' }> {
  return template.type === 'built-in';
}

export function isCustomTemplate(
  template: ReportTemplate
): template is Extract<ReportTemplate, { type: 'custom' }> {
  return template.type === 'custom';
}

export function isInlineTemplate(
  template: ReportTemplate
): template is Extract<ReportTemplate, { type: 'inline' }> {
  return template.type === 'inline';
}
