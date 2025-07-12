/**
 * Core type definitions for Claude Testing Infrastructure
 *
 * This module provides fundamental types, utilities, and patterns that are used
 * across the entire codebase. These types serve as the foundation for all other
 * type definitions in the system.
 */

/**
 * Utility type that makes all properties in T deeply optional
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Utility type that makes all properties in T deeply required
 */
export type DeepRequired<T> = {
  [P in keyof T]-?: T[P] extends object ? DeepRequired<T[P]> : T[P];
};

/**
 * Utility type for values that can be null or undefined
 */
export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;
export type Maybe<T> = T | null | undefined;

/**
 * Utility type for creating strict object types (no extra properties)
 */
export type Exact<T, U extends T = T> = U & Record<Exclude<keyof U, keyof T>, never>;

/**
 * Utility type for non-empty arrays
 */
export type NonEmptyArray<T> = [T, ...T[]];

/**
 * Utility type for extracting array element type
 */
export type ArrayElement<T> = T extends (infer U)[] ? U : never;

/**
 * Utility type for creating branded types
 */
export type Brand<T, B> = T & { __brand: B };

/**
 * Common result types for operations that can succeed or fail
 */
export interface Success<T = void> {
  success: true;
  data: T;
}

export interface Failure<E = string> {
  success: false;
  error: E;
}

export type Result<T, E = string> = Success<T> | Failure<E>;

/**
 * Async result type for operations that can succeed or fail
 */
export type AsyncResult<T, E = string> = Promise<Result<T, E>>;

/**
 * Common status enumeration
 */
export enum Status {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

/**
 * Priority levels for tasks and operations
 */
export enum Priority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

/**
 * Base interface for identifiable entities
 */
export interface Identifiable {
  id: string;
}

/**
 * Base interface for entities with timestamps
 */
export interface Timestamped {
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Base interface for versioned entities
 */
export interface Versioned {
  version: number;
}

/**
 * Base interface for entities with metadata
 */
export interface WithMetadata<T = Record<string, unknown>> {
  metadata: T;
}

/**
 * Generic configuration interface
 */
export interface BaseConfig {
  enabled?: boolean;
  [key: string]: unknown;
}

/**
 * Generic options interface for service configuration
 */
export interface ServiceOptions {
  timeout?: number;
  retries?: number;
  debug?: boolean;
}

/**
 * File path utilities
 */
export type FilePath = Brand<string, 'FilePath'>;
export type DirectoryPath = Brand<string, 'DirectoryPath'>;
export type GlobPattern = Brand<string, 'GlobPattern'>;

/**
 * Time-related utilities
 */
export type Milliseconds = Brand<number, 'Milliseconds'>;
export type Seconds = Brand<number, 'Seconds'>;

/**
 * Common callback types
 */
export type Callback<T = void> = (error?: Error, result?: T) => void;
export type EventCallback<T = unknown> = (event: T) => void;
export type AsyncCallback<T = void> = (error?: Error, result?: T) => Promise<void>;

/**
 * Promise utilities
 */
export type PromiseResolver<T> = (value: T | PromiseLike<T>) => void;
export type PromiseRejecter = (reason?: unknown) => void;

/**
 * Function type utilities
 */
export type NoArgsFunction<T = void> = () => T;
export type SingleArgFunction<A, R = void> = (arg: A) => R;
export type TwoArgFunction<A, B, R = void> = (arg1: A, arg2: B) => R;
export type AsyncFunction<T = void> = () => Promise<T>;
export type AsyncSingleArgFunction<A, R = void> = (arg: A) => Promise<R>;

/**
 * Object utilities
 */
export type EmptyObject = Record<string, never>;
export type AnyObject = Record<string, unknown>;
export type StringRecord = Record<string, string>;
export type NumberRecord = Record<string, number>;
export type BooleanRecord = Record<string, boolean>;

/**
 * Array utilities
 */
export type ReadonlyNonEmptyArray<T> = readonly [T, ...T[]];

/**
 * Discriminated union helpers
 */
export type CoreDiscriminatedUnion<T, K extends keyof T, V extends T[K]> =
  T extends Record<K, V> ? T : never;

/**
 * Type predicate helpers
 */
export type TypePredicate<T> = (value: unknown) => value is T;
export type AsyncTypePredicate = (value: unknown) => Promise<boolean>;

/**
 * Common validation types
 */
export interface ValidationRule<T> {
  name: string;
  validate: TypePredicate<T>;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Metrics and measurement types
 */
export interface Metrics {
  duration: Milliseconds;
  memoryUsage?: number;
  operationCount?: number;
  errorCount?: number;
}

export interface PerformanceMetrics extends Metrics {
  startTime: Date;
  endTime: Date;
  success: boolean;
}

/**
 * Logging types
 */
export enum CoreLogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug',
  VERBOSE = 'verbose',
}

export interface LogEntry {
  level: CoreLogLevel;
  message: string;
  timestamp: Date;
  context?: AnyObject;
  error?: Error;
}

/**
 * Progress tracking types
 */
export interface ProgressInfo {
  current: number;
  total: number;
  percentage: number;
  message?: string;
}

export type ProgressCallback = (progress: ProgressInfo) => void;

/**
 * Cancellation types
 */
export interface CancellationToken {
  isCancelled: boolean;
  onCancelled: (callback: () => void) => void;
}

/**
 * Disposable resource pattern
 */
export interface Disposable {
  dispose(): void | Promise<void>;
}

/**
 * Event emitter types
 */
export interface EventMap {
  [event: string]: unknown;
}

export interface EventEmitter<T extends EventMap = EventMap> {
  on<K extends keyof T>(event: K, listener: (data: T[K]) => void): void;
  off<K extends keyof T>(event: K, listener: (data: T[K]) => void): void;
  emit<K extends keyof T>(event: K, data: T[K]): void;
}

/**
 * State management types
 */
export interface StateTransition<T> {
  from: T;
  to: T;
  timestamp: Date;
  reason?: string;
}

export interface StateMachine<T> {
  currentState: T;
  transitions: StateTransition<T>[];
  canTransition(to: T): boolean;
  transition(to: T, reason?: string): boolean;
}
