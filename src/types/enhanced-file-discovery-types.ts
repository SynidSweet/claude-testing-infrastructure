/**
 * Enhanced type definitions for improved FileDiscoveryService type safety
 *
 * This file contains refined interfaces and types that provide better
 * compile-time guarantees and developer experience.
 */

import type { FileDiscoveryType } from './file-discovery-types';

/**
 * Supported programming languages with strict typing
 */
export const SupportedLanguage = {
  JAVASCRIPT: 'javascript',
  TYPESCRIPT: 'typescript',
  PYTHON: 'python',
  VUE: 'vue',
  SVELTE: 'svelte',
} as const;

export type SupportedLanguage = (typeof SupportedLanguage)[keyof typeof SupportedLanguage];

/**
 * Supported test frameworks with strict typing
 */
export const SupportedTestFramework = {
  JEST: 'jest',
  VITEST: 'vitest',
  PYTEST: 'pytest',
  MOCHA: 'mocha',
} as const;

export type SupportedTestFramework =
  (typeof SupportedTestFramework)[keyof typeof SupportedTestFramework];

/**
 * Enhanced file discovery request with stricter types
 */
export interface EnhancedFileDiscoveryRequest {
  /** Base directory to search from */
  baseDir: string;

  /** Include patterns (glob format) */
  include?: ReadonlyArray<string>;

  /** Exclude patterns (glob format) */
  exclude?: ReadonlyArray<string>;

  /** Type of discovery operation for pattern resolution */
  type: FileDiscoveryType;

  /** Target languages with enum constraint */
  languages?: ReadonlyArray<SupportedLanguage>;

  /** Return absolute paths instead of relative */
  absolute?: boolean;

  /** Include directories in results */
  includeDirectories?: boolean;

  /** Use cache for this operation */
  useCache?: boolean;

  /** Request-specific configuration overrides */
  configOverride?: FileDiscoveryConfigOverride;
}

/**
 * Type-safe configuration override for file discovery
 */
export interface FileDiscoveryConfigOverride {
  readonly cache?: {
    readonly enabled?: boolean;
    readonly ttl?: number;
  };
  readonly performance?: {
    readonly enableStats?: boolean;
    readonly logSlowOperations?: boolean;
  };
}

/**
 * Structured error types for file discovery operations
 */
export type FileDiscoveryError =
  | DirectoryNotFoundError
  | InvalidPatternError
  | PermissionDeniedError
  | OperationTimeoutError;

export interface DirectoryNotFoundError {
  readonly kind: 'DirectoryNotFoundError';
  readonly path: string;
  readonly message: string;
}

export interface InvalidPatternError {
  readonly kind: 'InvalidPatternError';
  readonly pattern: string;
  readonly position?: number;
  readonly message: string;
}

export interface PermissionDeniedError {
  readonly kind: 'PermissionDeniedError';
  readonly path: string;
  readonly message: string;
}

export interface OperationTimeoutError {
  readonly kind: 'OperationTimeoutError';
  readonly duration: number;
  readonly message: string;
}

/**
 * Enhanced result type with error handling
 */
export type EnhancedFileDiscoveryResult<T> =
  | { readonly success: true; readonly data: T }
  | { readonly success: false; readonly error: FileDiscoveryError };

/**
 * Type-safe pattern builder for creating glob patterns
 */
export interface PatternBuilder {
  /** Add file extension constraint */
  withExtensions(extensions: string[]): PatternBuilder;

  /** Add directory constraint */
  inDirectory(directory: string): PatternBuilder;

  /** Add recursive search */
  recursive(): PatternBuilder;

  /** Exclude pattern */
  exclude(pattern: string): PatternBuilder;

  /** Build the final pattern */
  build(): string;

  /** Get exclude patterns */
  getExcludes(): string[];
}

/**
 * Type-safe cache key with proper typing
 */
export interface TypedCacheKey {
  readonly baseDir: string;
  readonly include: ReadonlyArray<string>;
  readonly exclude: ReadonlyArray<string>;
  readonly type: FileDiscoveryType;
  readonly languages: ReadonlyArray<SupportedLanguage>;
  readonly options: Readonly<{
    absolute: boolean;
    includeDirectories: boolean;
  }>;
}

/**
 * Enhanced pattern validation with detailed results
 */
export interface EnhancedPatternValidation {
  readonly valid: boolean;
  readonly errors: ReadonlyArray<PatternValidationDetail>;
  readonly warnings: ReadonlyArray<PatternValidationDetail>;
  readonly suggestions: ReadonlyArray<PatternSuggestion>;
}

export interface PatternValidationDetail {
  pattern: string;
  code: PatternErrorCode;
  message: string;
  position?: number;
  severity: 'error' | 'warning';
}

export const PatternErrorCode = {
  EMPTY_PATTERN: 'EMPTY_PATTERN',
  INVALID_SYNTAX: 'INVALID_SYNTAX',
  UNMATCHED_BRACKETS: 'UNMATCHED_BRACKETS',
  UNMATCHED_BRACES: 'UNMATCHED_BRACES',
  WINDOWS_PATH_SEPARATOR: 'WINDOWS_PATH_SEPARATOR',
  OVERLY_BROAD: 'OVERLY_BROAD',
  REDUNDANT_PATTERN: 'REDUNDANT_PATTERN',
} as const;

export type PatternErrorCode = (typeof PatternErrorCode)[keyof typeof PatternErrorCode];

export interface PatternSuggestion {
  readonly original: string;
  readonly suggested: string;
  readonly reason: string;
}

/**
 * Type guard functions for runtime validation
 */
export const isFileDiscoveryError = (error: unknown): error is FileDiscoveryError => {
  return (
    error !== null &&
    typeof error === 'object' &&
    'kind' in error &&
    [
      'DirectoryNotFoundError',
      'InvalidPatternError',
      'PermissionDeniedError',
      'OperationTimeoutError',
    ].includes((error as Record<string, unknown>).kind as string)
  );
};

export const isSupportedLanguage = (language: string): language is SupportedLanguage => {
  return Object.values(SupportedLanguage).includes(language as SupportedLanguage);
};

export const isSupportedTestFramework = (
  framework: string
): framework is SupportedTestFramework => {
  return Object.values(SupportedTestFramework).includes(framework as SupportedTestFramework);
};

/**
 * Utility type for ensuring exhaustive checks
 */
export type Exhaustive<T> = T extends never ? true : false;

/**
 * Helper type for creating discriminated unions
 */
export type DiscriminatedUnion<K extends string, T extends Record<K, string>> = T[keyof T];
