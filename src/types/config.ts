/**
 * Configuration schema for Claude Testing Infrastructure
 *
 * This file defines the complete configuration interface for .claude-testing.config.json
 * files in target projects. All options are documented with JSDoc for IDE support.
 */

import type { FileDiscoveryConfig } from './file-discovery-types';

/**
 * Main configuration interface for .claude-testing.config.json
 * This matches the example configuration shown in AI_AGENT_GUIDE.md
 */
export interface ClaudeTestingConfig {
  /** File patterns to include for test generation */
  include: string[];

  /** File patterns to exclude from test generation */
  exclude: string[];

  /** Test framework to use for test generation */
  testFramework: TestFramework;

  /** AI model to use for logical test generation */
  aiModel: AIModel;

  /** Feature flags to enable/disable specific functionality */
  features: FeatureFlags;

  /** Test generation specific options */
  generation: GenerationOptions;

  /** Coverage analysis and reporting options */
  coverage: CoverageOptions;

  /** Incremental testing configuration */
  incremental: IncrementalOptions;

  /** Watch mode configuration */
  watch: WatchOptions;

  /** AI-specific configuration options */
  ai: AIOptions;

  /** Output and reporting configuration */
  output: OutputOptions;

  /** File discovery service configuration */
  fileDiscovery?: FileDiscoveryConfig;

  /** Legacy AI options (for compatibility) */
  aiOptions?: Partial<AIOptions>;

  /** Dry run mode - don't execute, just show what would be done */
  dryRun?: boolean;

  /** Cost limit for AI operations */
  costLimit?: number;

  /** Custom prompts for AI generation */
  customPrompts?: Record<string, string>;
}

/**
 * Supported test frameworks
 */
export type TestFramework = 'jest' | 'vitest' | 'pytest' | 'mocha' | 'chai' | 'jasmine' | 'auto';

/**
 * Supported AI models for test generation
 */
export type AIModel =
  | 'claude-3-5-sonnet-20241022'
  | 'claude-3-opus-20240229'
  | 'claude-3-haiku-20240307';

/**
 * Feature flags to enable/disable functionality
 */
export interface FeatureFlags {
  /**
   * Enable coverage analysis and reporting
   * @default true
   */
  coverage?: boolean;

  /**
   * Generate edge case tests using AI
   * @default true
   */
  edgeCases?: boolean;

  /**
   * Generate integration tests
   * @default true
   */
  integrationTests?: boolean;

  /**
   * Generate unit tests
   * @default true
   */
  unitTests?: boolean;

  /**
   * Generate mock files for dependencies
   * @default false
   */
  mocks?: boolean;

  /**
   * Generate test data factories
   * @default false
   */
  testData?: boolean;

  /**
   * Enable AI-powered logical test generation
   * @default true
   */
  aiGeneration?: boolean;

  /**
   * Enable incremental test updates
   * @default true
   */
  incremental?: boolean;

  /**
   * Enable watch mode for real-time updates
   * @default false
   */
  watch?: boolean;

  /**
   * Enable logical test generation (AI-powered tests)
   * @default true
   */
  logicalTests?: boolean;

  /**
   * Enable structural test generation (template-based tests)
   * @default true
   */
  structuralTests?: boolean;
}

/**
 * Test generation configuration options
 */
export interface GenerationOptions {
  /**
   * Maximum number of tests to generate per file
   * @default 50
   * @minimum 1
   * @maximum 1000
   */
  maxTestsPerFile?: number;

  /**
   * Maximum ratio of test files to source files
   * @default 10
   * @minimum 1
   * @maximum 100
   */
  maxTestToSourceRatio?: number;

  /**
   * Test file naming convention
   */
  naming?: NamingConventions;

  /**
   * Template overrides for specific file types
   * @example { "react-component": "custom-react.template.js" }
   */
  templates?: Record<string, string>;

  /**
   * Custom test types to generate
   */
  testTypes?: TestType[];

  /**
   * Maximum number of retry attempts for failed generation
   * @default 3
   */
  maxRetries?: number;

  /**
   * Timeout for test generation operations in milliseconds
   * @default 60000
   */
  timeoutMs?: number;

  /**
   * Batch size for processing multiple files
   * @default 10
   */
  batchSize?: number;
}

/**
 * Test file naming conventions
 */
export interface NamingConventions {
  /**
   * Test file suffix
   * @default ".test"
   * @example ".test" | ".spec" | "_test"
   */
  testFileSuffix?: string;

  /**
   * Test directory name
   * @default "__tests__"
   * @example "__tests__" | "tests" | "test"
   */
  testDirectory?: string;

  /**
   * Mock file suffix
   * @default ".mock"
   * @example ".mock" | "__mocks__"
   */
  mockFileSuffix?: string;
}

/**
 * Types of tests to generate
 */
export enum TestType {
  UNIT = 'unit',
  INTEGRATION = 'integration',
  COMPONENT = 'component',
  API = 'api',
  E2E = 'e2e',
  PERFORMANCE = 'performance',
}

/**
 * Coverage analysis and reporting options
 */
export interface CoverageOptions {
  /**
   * Enable coverage collection during test runs
   * @default true
   */
  enabled?: boolean;

  /**
   * Coverage threshold percentages
   */
  thresholds?: CoverageThresholds;

  /**
   * Coverage report formats to generate
   * @default ["html", "json"]
   */
  formats?: CoverageFormat[];

  /**
   * Output directory for coverage reports
   * @default "coverage-reports"
   */
  outputDir?: string;

  /**
   * Include files in coverage even if not tested
   * @default true
   */
  includeUntested?: boolean;

  /**
   * Coverage reporters to use
   * @default ["text", "json"]
   */
  reporters?: string[];
}

/**
 * Coverage threshold configuration
 */
export interface CoverageThresholds {
  /**
   * Global coverage thresholds
   */
  global?: {
    /** Line coverage percentage */
    lines?: number;
    /** Function coverage percentage */
    functions?: number;
    /** Branch coverage percentage */
    branches?: number;
    /** Statement coverage percentage */
    statements?: number;
  };

  /**
   * Per-file coverage thresholds
   * @example { "src/critical.js": { lines: 100 } }
   */
  perFile?: Record<
    string,
    {
      lines?: number;
      functions?: number;
      branches?: number;
      statements?: number;
    }
  >;
}

/**
 * Supported coverage report formats
 */
export type CoverageFormat = 'html' | 'json' | 'lcov' | 'text' | 'markdown' | 'xml';

/**
 * Incremental testing configuration
 */
export interface IncrementalOptions {
  /**
   * Enable incremental test updates
   * @default true
   */
  enabled?: boolean;

  /**
   * Cost limit for AI generation per update
   * @default 5.00
   * @minimum 0.01
   * @maximum 100.00
   */
  costLimit?: number;

  /**
   * Maximum number of files to update per run
   * @default 50
   * @minimum 1
   * @maximum 1000
   */
  maxFilesPerUpdate?: number;

  /**
   * Git integration options
   */
  git?: GitOptions;

  /**
   * Baseline management options
   */
  baseline?: BaselineOptions;

  /**
   * Show statistics after incremental update
   * @default false
   */
  showStats?: boolean;
}

/**
 * Git integration configuration
 */
export interface GitOptions {
  /**
   * Use Git for change detection
   * @default true
   */
  enabled?: boolean;

  /**
   * Base branch for comparison
   * @default "main"
   */
  baseBranch?: string;

  /**
   * Include uncommitted changes
   * @default true
   */
  includeUncommitted?: boolean;
}

/**
 * Baseline management configuration
 */
export interface BaselineOptions {
  /**
   * Automatic baseline creation
   * @default true
   */
  autoCreate?: boolean;

  /**
   * Baseline retention period in days
   * @default 30
   * @minimum 1
   * @maximum 365
   */
  retentionDays?: number;
}

/**
 * Watch mode configuration
 */
export interface WatchOptions {
  /**
   * Enable watch mode
   * @default false
   */
  enabled?: boolean;

  /**
   * Debounce delay in milliseconds
   * @default 1000
   * @minimum 100
   * @maximum 10000
   */
  debounceMs?: number;

  /**
   * Patterns to watch for changes
   * @default Uses include patterns
   */
  patterns?: string[];

  /**
   * Automatically run tests after generation
   * @default false
   */
  autoRun?: boolean;

  /**
   * Generate tests immediately on file changes
   * @default true
   */
  autoGenerate?: boolean;
}

/**
 * AI-specific configuration options
 */
export interface AIOptions {
  /**
   * Enable AI-powered test generation
   * @default true
   */
  enabled?: boolean;

  /**
   * AI model to use
   * @default "claude-3-5-sonnet-20241022"
   */
  model?: AIModel;

  /**
   * Maximum cost per AI generation session
   * @default 10.00
   * @minimum 0.01
   * @maximum 100.00
   */
  maxCost?: number;

  /**
   * Timeout for AI operations in milliseconds
   * @default 900000 (15 minutes)
   * @minimum 30000
   * @maximum 1800000
   */
  timeout?: number;

  /**
   * Temperature for AI generation (creativity level)
   * @default 0.3
   * @minimum 0.0
   * @maximum 1.0
   */
  temperature?: number;

  /**
   * Maximum tokens per AI request
   * @default 4096
   * @minimum 256
   * @maximum 8192
   */
  maxTokens?: number;

  /**
   * Custom prompts for specific scenarios
   */
  customPrompts?: Record<string, string>;
}

/**
 * Output and reporting configuration
 */
export interface OutputOptions {
  /**
   * Verbosity level for console output
   * @default "info"
   */
  logLevel?: LogLevel;

  /**
   * Output formats for reports
   * @default ["console"]
   */
  formats?: OutputFormat[];

  /**
   * Output directory for generated files
   * @default ".claude-testing"
   */
  outputDir?: string;

  /**
   * Preserve generated files after completion
   * @default true
   */
  preserveFiles?: boolean;

  /**
   * Include timestamps in output files
   * @default true
   */
  includeTimestamps?: boolean;

  /**
   * Enable verbose output
   * @default false
   */
  verbose?: boolean;

  /**
   * Output format
   * @default "console"
   */
  format?: OutputFormat;

  /**
   * Enable colored output
   * @default true
   */
  colors?: boolean;

  /**
   * Output file path for results
   * @example "analysis.json", "report.md"
   */
  file?: string;
}

/**
 * Log levels for console output
 */
export type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'verbose';

/**
 * Output formats for reports and results
 */
export type OutputFormat = 'console' | 'json' | 'markdown' | 'xml' | 'html' | 'junit';

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: Required<ClaudeTestingConfig> = {
  include: ['src/**/*.{js,ts,jsx,tsx,py}', 'lib/**/*.{js,ts,jsx,tsx,py}'],
  exclude: [
    '**/*.test.*',
    '**/*.spec.*',
    '**/node_modules/**',
    '**/.git/**',
    '**/dist/**',
    '**/build/**',
    '**/__pycache__/**',
    '**/coverage/**',
    '**/.claude-testing/**',
  ],
  testFramework: 'auto',
  aiModel: 'claude-3-5-sonnet-20241022',
  features: {
    coverage: true,
    edgeCases: true,
    integrationTests: true,
    unitTests: true,
    mocks: false,
    testData: false,
    aiGeneration: true,
    incremental: true,
    watch: false,
    logicalTests: true,
    structuralTests: true,
  },
  generation: {
    maxTestsPerFile: 50,
    maxTestToSourceRatio: 10,
    naming: {
      testFileSuffix: '.test',
      testDirectory: '__tests__',
      mockFileSuffix: '.mock',
    },
    templates: {},
    testTypes: [TestType.UNIT, TestType.INTEGRATION],
    maxRetries: 3,
    timeoutMs: 60000,
    batchSize: 10,
  },
  coverage: {
    enabled: true,
    thresholds: {
      global: {
        lines: 80,
        functions: 80,
        branches: 70,
        statements: 80,
      },
      perFile: {},
    },
    formats: ['html', 'json'],
    outputDir: 'coverage-reports',
    includeUntested: true,
    reporters: ['text', 'json'],
  },
  incremental: {
    enabled: true,
    costLimit: 5.0,
    maxFilesPerUpdate: 50,
    git: {
      enabled: true,
      baseBranch: 'main',
      includeUncommitted: true,
    },
    baseline: {
      autoCreate: true,
      retentionDays: 30,
    },
    showStats: false,
  },
  watch: {
    enabled: false,
    debounceMs: 1000,
    patterns: [],
    autoRun: false,
    autoGenerate: true,
  },
  ai: {
    enabled: true,
    model: 'claude-3-5-sonnet-20241022',
    maxCost: 10.0,
    timeout: 900000,
    temperature: 0.3,
    customPrompts: {},
  },
  output: {
    logLevel: 'info',
    formats: ['console'],
    outputDir: '.claude-testing',
    preserveFiles: true,
    includeTimestamps: true,
    verbose: false,
    format: 'console',
    colors: true,
  },
  fileDiscovery: {
    cache: {
      enabled: true,
      ttl: 300000, // 5 minutes
      maxSize: 1000,
    },
    patterns: {},
    performance: {
      enableStats: false,
      logSlowOperations: true,
      slowThresholdMs: 1000,
    },
  },
  aiOptions: {
    enabled: true,
    model: 'claude-3-5-sonnet-20241022',
    maxCost: 10.0,
    timeout: 900000,
    temperature: 0.3,
    maxTokens: 4096,
    customPrompts: {},
  },
  dryRun: false,
  costLimit: 10.0,
  customPrompts: {},
};

/**
 * Utility type for partial configuration (what users typically provide)
 * All properties are optional in user configuration
 */
export interface PartialClaudeTestingConfig {
  include?: string[];
  exclude?: string[];
  testFramework?: TestFramework;
  aiModel?: AIModel;
  features?: Partial<FeatureFlags>;
  generation?: Partial<GenerationOptions>;
  coverage?: Partial<CoverageOptions>;
  incremental?: Partial<IncrementalOptions>;
  watch?: Partial<WatchOptions>;
  ai?: Partial<AIOptions>;
  output?: Partial<OutputOptions>;
  fileDiscovery?: Partial<FileDiscoveryConfig>;
  costLimit?: number;
}

/**
 * Configuration validation result
 */
export interface ConfigValidationResult {
  /** Whether the configuration is valid */
  valid: boolean;
  /** Validation errors, if any */
  errors: string[];
  /** Validation warnings, if any */
  warnings: string[];
  /** Merged configuration with defaults applied */
  config: ClaudeTestingConfig;
}
