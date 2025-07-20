/**
 * MCP Tool Interfaces and Data Structures
 *
 * Defines the 12 MCP tool interfaces with parameters, return types, and data structures.
 * Focus only on tool definitions without implementation details.
 *
 * Implements TASK-2025-166: Define MCP tool interfaces and data structures
 *
 * @module mcp/tool-interfaces
 */

import { z } from 'zod';

// ============================================================================
// Common Types and Enums
// ============================================================================

/**
 * Supported programming languages
 */
export enum SupportedLanguage {
  JavaScript = 'javascript',
  TypeScript = 'typescript',
  Python = 'python',
}

/**
 * Supported test frameworks
 */
export enum TestFramework {
  Jest = 'jest',
  Pytest = 'pytest',
  Mocha = 'mocha',
  Vitest = 'vitest',
}

/**
 * Test generation strategy
 */
export enum TestStrategy {
  Structural = 'structural',
  Logical = 'logical',
  Both = 'both',
}

/**
 * Gap type categories
 */
export enum GapType {
  MissingTest = 'missing-test',
  LowCoverage = 'low-coverage',
  UntestablCode = 'untestable-code',
  EdgeCase = 'edge-case',
  IntegrationGap = 'integration-gap',
}

/**
 * Feature request type
 */
export enum FeatureType {
  Enhancement = 'enhancement',
  NewFeature = 'new-feature',
  BugFix = 'bug-fix',
  Documentation = 'documentation',
}

// ============================================================================
// Common Data Structures
// ============================================================================

/**
 * File information structure
 */
export interface FileInfo {
  path: string;
  language: SupportedLanguage;
  framework?: string;
  size: number;
  lastModified: Date;
}

/**
 * Component information for testable components
 */
export interface ComponentInfo {
  name: string;
  type: 'function' | 'class' | 'module' | 'component';
  filePath: string;
  startLine: number;
  endLine: number;
  complexity: number;
  dependencies: string[];
  isExported: boolean;
  hasTests: boolean;
}

/**
 * Coverage metrics structure
 */
export interface CoverageMetrics {
  linesCovered: number;
  totalLines: number;
  branchesCovered: number;
  totalBranches: number;
  functionsCovered: number;
  totalFunctions: number;
  statementsCovered: number;
  totalStatements: number;
  percentage: number;
}

/**
 * Test result structure
 */
export interface TestResult {
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  coverage?: CoverageMetrics;
  failedTests?: Array<{
    name: string;
    error: string;
    file: string;
  }>;
}

/**
 * Gap information structure
 */
export interface GapInfo {
  type: GapType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  component: string;
  filePath: string;
  description: string;
  recommendation: string;
  estimatedEffort: number; // hours
}

// ============================================================================
// Core Testing Tools (Category 1)
// ============================================================================

/**
 * 1.1 project_analyze - Analyze project structure and identify testable components
 */
export const ProjectAnalyzeSchema = z.object({
  projectPath: z.string().describe('Path to the project directory'),
  include: z.array(z.string()).optional().describe('Glob patterns for files to include'),
  exclude: z.array(z.string()).optional().describe('Glob patterns for files to exclude'),
  deep: z
    .boolean()
    .optional()
    .default(true)
    .describe('Perform deep analysis including dependencies'),
});

export type ProjectAnalyzeParams = z.infer<typeof ProjectAnalyzeSchema>;

export interface ProjectAnalyzeResult {
  summary: {
    totalFiles: number;
    totalComponents: number;
    languages: Record<SupportedLanguage, number>;
    frameworks: string[];
    testFrameworks: TestFramework[];
  };
  components: ComponentInfo[];
  dependencies: {
    production: Record<string, string>;
    development: Record<string, string>;
  };
  testability: {
    score: number; // 0-100
    issues: string[];
    recommendations: string[];
  };
  metadata: {
    analyzedAt: Date;
    duration: number; // milliseconds
    version: string;
  };
}

/**
 * 1.2 test_generate - Generate comprehensive test suites for specified components
 */
export const TestGenerateSchema = z.object({
  targetPath: z.string().describe('Path to file or directory to generate tests for'),
  strategy: z.nativeEnum(TestStrategy).optional().default(TestStrategy.Both),
  framework: z.nativeEnum(TestFramework).optional().describe('Override detected test framework'),
  outputPath: z.string().optional().describe('Custom output path for generated tests'),
  options: z
    .object({
      includeEdgeCases: z.boolean().optional().default(true),
      includeIntegrationTests: z.boolean().optional().default(false),
      mockStrategy: z.enum(['auto', 'manual', 'none']).optional().default('auto'),
      coverageTarget: z.number().min(0).max(100).optional().default(80),
    })
    .optional(),
});

export type TestGenerateParams = z.infer<typeof TestGenerateSchema>;

export interface TestGenerateResult {
  generated: Array<{
    filePath: string;
    testType: 'unit' | 'integration' | 'e2e';
    testsCount: number;
    linesOfCode: number;
    coverageEstimate: number;
  }>;
  summary: {
    totalTests: number;
    totalFiles: number;
    estimatedCoverage: number;
    generationTime: number;
  };
  errors: Array<{
    component: string;
    reason: string;
    suggestion: string;
  }>;
  metadata: {
    strategy: TestStrategy;
    framework: TestFramework;
    generatedAt: Date;
  };
}

/**
 * 1.3 test_run - Execute generated tests and collect coverage data
 */
export const TestRunSchema = z.object({
  projectPath: z.string().describe('Path to the project directory'),
  testPattern: z.string().optional().describe('Glob pattern for test files to run'),
  framework: z.nativeEnum(TestFramework).optional().describe('Override detected test framework'),
  coverage: z.boolean().optional().default(true).describe('Collect coverage data'),
  watch: z.boolean().optional().default(false).describe('Run in watch mode'),
  bail: z.boolean().optional().default(false).describe('Stop on first test failure'),
});

export type TestRunParams = z.infer<typeof TestRunSchema>;

export interface TestRunResult {
  results: TestResult;
  coverage?: {
    summary: CoverageMetrics;
    files: Record<string, CoverageMetrics>;
    uncoveredLines: Record<string, number[]>;
  };
  output: {
    stdout: string;
    stderr: string;
  };
  metadata: {
    framework: TestFramework;
    duration: number;
    executedAt: Date;
  };
}

/**
 * 1.4 coverage_check - Check current test coverage and identify gaps
 */
export const CoverageCheckSchema = z.object({
  projectPath: z.string().describe('Path to the project directory'),
  threshold: z
    .object({
      lines: z.number().min(0).max(100).optional().default(80),
      branches: z.number().min(0).max(100).optional().default(80),
      functions: z.number().min(0).max(100).optional().default(80),
      statements: z.number().min(0).max(100).optional().default(80),
    })
    .optional(),
  format: z.enum(['summary', 'detailed', 'json']).optional().default('summary'),
});

export type CoverageCheckParams = z.infer<typeof CoverageCheckSchema>;

export interface CoverageCheckResult {
  summary: CoverageMetrics;
  gaps: GapInfo[];
  recommendations: Array<{
    priority: 'low' | 'medium' | 'high';
    action: string;
    impact: string;
    effort: number; // hours
  }>;
  thresholdResults: {
    passed: boolean;
    failures: Array<{
      metric: string;
      actual: number;
      threshold: number;
    }>;
  };
  metadata: {
    checkedAt: Date;
    coverageToolVersion: string;
  };
}

// ============================================================================
// Gap Analysis & Request Tools (Category 2)
// ============================================================================

/**
 * 2.1 gap_request - Request test coverage for specific functionality
 */
export const GapRequestSchema = z.object({
  targetProject: z.string().describe('Path to the target project needing test coverage'),
  component: z.string().describe('Specific component or file needing tests'),
  gapType: z.nativeEnum(GapType).describe('Type of test gap identified'),
  priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  description: z.string().describe('Detailed description of the gap'),
  context: z
    .object({
      currentCoverage: z.number().optional().describe('Current coverage percentage'),
      relatedFiles: z.array(z.string()).optional().describe('Related files for context'),
      dependencies: z.array(z.string()).optional().describe('Dependencies to consider'),
      specialRequirements: z.string().optional().describe('Any special testing requirements'),
    })
    .optional(),
});

export type GapRequestParams = z.infer<typeof GapRequestSchema>;

export interface GapRequestResult {
  taskCreated: {
    id: string;
    title: string;
    priority: string;
    tags: string[];
    estimatedEffort: number;
  };
  validation: {
    isDuplicate: boolean;
    similarTasks: string[];
    urgencyScore: number; // 0-100
  };
  projectContext: {
    projectName: string;
    currentBacklogSize: number;
    estimatedCompletionTime: number; // days
  };
  metadata: {
    requestedAt: Date;
    requestId: string;
  };
}

/**
 * 2.2 feature_request - Request new features or improvements
 */
export const FeatureRequestSchema = z.object({
  title: z.string().describe('Clear, concise title for the feature'),
  description: z.string().describe('Detailed description of the feature'),
  type: z.nativeEnum(FeatureType).describe('Type of feature request'),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  rationale: z.string().describe('Why this feature is needed'),
  acceptanceCriteria: z.array(z.string()).optional().describe('Specific criteria for completion'),
  technicalNotes: z.string().optional().describe('Technical implementation notes'),
});

export type FeatureRequestParams = z.infer<typeof FeatureRequestSchema>;

export interface FeatureRequestResult {
  taskCreated: {
    id: string;
    title: string;
    priority: string;
    category: string;
    estimatedComplexity: 'simple' | 'moderate' | 'complex';
  };
  feasibility: {
    score: number; // 0-100
    challenges: string[];
    dependencies: string[];
    estimatedEffort: number; // hours
  };
  metadata: {
    requestedAt: Date;
    requestId: string;
    status: 'accepted' | 'needs-review' | 'deferred';
  };
}

// ============================================================================
// Incremental & Maintenance Tools (Category 3)
// ============================================================================

/**
 * 3.1 incremental_update - Smart test updates based on code changes
 */
export const IncrementalUpdateSchema = z.object({
  projectPath: z.string().describe('Path to the project directory'),
  baseline: z.string().optional().describe('Git ref for baseline comparison (default: HEAD~1)'),
  dryRun: z.boolean().optional().default(false).describe('Preview changes without applying'),
  preserveCustomTests: z
    .boolean()
    .optional()
    .default(true)
    .describe('Preserve manually modified tests'),
  costLimit: z.number().optional().describe('AI token cost limit for updates'),
});

export type IncrementalUpdateParams = z.infer<typeof IncrementalUpdateSchema>;

export interface IncrementalUpdateResult {
  changes: {
    added: string[];
    modified: string[];
    deleted: string[];
  };
  updates: Array<{
    file: string;
    reason: string;
    changeType: 'test-added' | 'test-updated' | 'test-removed';
    linesChanged: number;
  }>;
  costSavings: {
    tokensUsed: number;
    tokenssSaved: number;
    percentageSaved: number;
    estimatedCost: number;
  };
  summary: {
    filesAnalyzed: number;
    testsUpdated: number;
    testsPreserved: number;
    duration: number;
  };
  metadata: {
    baseline: string;
    updatedAt: Date;
  };
}

/**
 * 3.2 watch_changes - Monitor project for changes and automatically update tests
 */
export const WatchChangesSchema = z.object({
  projectPath: z.string().describe('Path to the project directory'),
  patterns: z.array(z.string()).optional().describe('Glob patterns for files to watch'),
  ignore: z.array(z.string()).optional().describe('Glob patterns for files to ignore'),
  debounceMs: z.number().optional().default(1000).describe('Debounce delay for file changes'),
  autoUpdate: z
    .boolean()
    .optional()
    .default(true)
    .describe('Automatically update tests on changes'),
});

export type WatchChangesParams = z.infer<typeof WatchChangesSchema>;

export interface WatchChangesResult {
  status: 'started' | 'stopped' | 'error';
  watchId: string;
  config: {
    patterns: string[];
    ignore: string[];
    debounceMs: number;
    autoUpdate: boolean;
  };
  stats: {
    filesWatched: number;
    changesDetected: number;
    testsUpdated: number;
    uptime: number; // seconds
  };
  metadata: {
    startedAt: Date;
    pid: number;
  };
}

// ============================================================================
// Configuration Management Tools (Category 4)
// ============================================================================

/**
 * 4.1 config_get - Get current testing configuration for project
 */
export const ConfigGetSchema = z.object({
  projectPath: z.string().describe('Path to the project directory'),
  section: z.string().optional().describe('Specific configuration section to retrieve'),
  includeDefaults: z.boolean().optional().default(true).describe('Include default values'),
});

export type ConfigGetParams = z.infer<typeof ConfigGetSchema>;

export interface ConfigGetResult {
  configuration: any; // The configuration object or section requested
  source: 'project' | 'defaults';
  validation: {
    valid: boolean;
    errors: string[];
    warnings: string[];
  };
  metadata: {
    path?: string;
    exists: boolean;
    lastModified?: Date;
  };
}

/**
 * 4.2 config_set - Update testing configuration for project
 */
export const ConfigSetSchema = z.object({
  projectPath: z.string().describe('Path to the project directory'),
  updates: z.record(z.string(), z.any()).describe('Configuration updates to apply'),
  merge: z.boolean().optional().default(true).describe('Merge with existing config vs replace'),
  validate: z.boolean().optional().default(true).describe('Validate before applying'),
  backup: z.boolean().optional().default(true).describe('Create backup before updating'),
});

export type ConfigSetParams = z.infer<typeof ConfigSetSchema>;

export interface ConfigSetResult {
  success: boolean;
  changes: Record<string, { old: any; new: any }>;
  backup: {
    created: boolean;
    path?: string;
  };
  validation: {
    performed: boolean;
    passed: boolean;
    warnings: string[];
    errors: string[];
  };
  metadata: {
    updatedAt: Date;
    updatedBy: string;
  };
}

// ============================================================================
// Infrastructure Tools (Category 5)
// ============================================================================

/**
 * 5.1 register_tool - Tool registration and discovery system
 */
export const RegisterToolSchema = z.object({
  name: z.string().describe('Unique tool name'),
  description: z.string().describe('Tool description'),
  version: z.string().describe('Semantic version'),
  category: z.string().describe('Tool category'),
  tags: z.array(z.string()).optional().describe('Tool tags for discovery'),
  replaceExisting: z.boolean().optional().default(false).describe('Replace if already registered'),
});

export type RegisterToolParams = z.infer<typeof RegisterToolSchema>;

export interface RegisterToolResult {
  registered: boolean;
  toolInfo: {
    name: string;
    version: string;
    category: string;
    isActive: boolean;
  };
  discovery: {
    totalTools: number;
    toolsInCategory: number;
    relatedTools: string[];
  };
  metadata: {
    registeredAt: Date;
    registryVersion: string;
  };
}

/**
 * 5.2 server_health - Server lifecycle and health management
 */
export const ServerHealthSchema = z.object({
  detailed: z.boolean().optional().default(false).describe('Include detailed component status'),
  includeMetrics: z.boolean().optional().default(true).describe('Include performance metrics'),
});

export type ServerHealthParams = z.infer<typeof ServerHealthSchema>;

export interface ServerHealthResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number; // seconds
  components: {
    toolRegistry: 'operational' | 'degraded' | 'failed';
    taskQueue: 'operational' | 'degraded' | 'failed';
    aiConnection: 'operational' | 'degraded' | 'failed';
    fileSystem: 'operational' | 'degraded' | 'failed';
  };
  metrics: {
    cpu: number; // percentage
    memory: {
      used: number; // MB
      total: number; // MB
      percentage: number;
    };
    responseTime: number; // ms
    activeRequests: number;
    queuedRequests: number;
  };
  tools: {
    total: number;
    active: number;
    failed: number;
    mostUsed: string[];
  };
  issues: Array<{
    component: string;
    severity: 'low' | 'medium' | 'high';
    message: string;
    since: Date;
  }>;
  metadata: {
    version: string;
    environment: string;
    checkedAt: Date;
  };
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * MCP Tool Error structure
 */
export interface MCPToolError {
  code: string;
  message: string;
  details?: Record<string, any>;
  suggestion?: string;
  documentation?: string;
}

/**
 * Standard error codes for MCP tools
 */
export enum MCPErrorCode {
  // General errors
  InvalidInput = 'INVALID_INPUT',
  NotFound = 'NOT_FOUND',
  Unauthorized = 'UNAUTHORIZED',
  RateLimited = 'RATE_LIMITED',

  // Project errors
  ProjectNotFound = 'PROJECT_NOT_FOUND',
  InvalidProjectStructure = 'INVALID_PROJECT_STRUCTURE',
  UnsupportedLanguage = 'UNSUPPORTED_LANGUAGE',

  // Test errors
  TestGenerationFailed = 'TEST_GENERATION_FAILED',
  TestExecutionFailed = 'TEST_EXECUTION_FAILED',
  CoverageCollectionFailed = 'COVERAGE_COLLECTION_FAILED',

  // Configuration errors
  ConfigNotFound = 'CONFIG_NOT_FOUND',
  ConfigInvalid = 'CONFIG_INVALID',
  ConfigUpdateFailed = 'CONFIG_UPDATE_FAILED',

  // System errors
  SystemOverloaded = 'SYSTEM_OVERLOADED',
  DependencyFailure = 'DEPENDENCY_FAILURE',
  InternalError = 'INTERNAL_ERROR',
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard for MCPToolError
 */
export function isMCPToolError(error: any): error is MCPToolError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error &&
    typeof error.code === 'string' &&
    typeof error.message === 'string'
  );
}

/**
 * Type guard for successful tool results
 */
export function isSuccessResult<T>(result: T | MCPToolError): result is T {
  return !isMCPToolError(result);
}
