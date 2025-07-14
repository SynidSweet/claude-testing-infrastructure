/**
 * Jest type extensions and utilities for enhanced test typing
 * Provides strongly typed Jest mocks and test utilities
 */

/**
 * Enhanced Jest mock types with better type safety
 */
export type TypedMockFunction<T extends (...args: any[]) => any> = jest.MockedFunction<T> & {
  mockReturnValueOnce<R extends ReturnType<T>>(value: R): TypedMockFunction<T>;
  mockResolvedValueOnce<R extends ReturnType<T>>(value: R extends Promise<infer U> ? U : never): TypedMockFunction<T>;
  mockRejectedValueOnce(value: any): TypedMockFunction<T>;
  mockImplementationOnce(fn: T): TypedMockFunction<T>;
};

/**
 * Type-safe Jest mock for classes and objects
 */
export type TypedMock<T> = {
  [K in keyof T]: T[K] extends (...args: any[]) => any 
    ? TypedMockFunction<T[K]>
    : T[K] extends object
    ? TypedMock<T[K]>
    : T[K];
};

/**
 * Jest spy type with enhanced typing
 */
export type TypedSpy<T, K extends keyof T> = T[K] extends (...args: any[]) => any
  ? jest.SpyInstance<ReturnType<T[K]>, Parameters<T[K]>>
  : never;

/**
 * Mock factory function type
 */
export type MockFactory<T> = () => TypedMock<T>;

/**
 * Test expectation extensions for common patterns
 */
export interface TypedExpectExtensions {
  toHaveBeenCalledWithTypes<T extends any[]>(...args: T): jest.CustomMatcherResult;
  toReturnWithType<T>(expectedType: string): jest.CustomMatcherResult;
  toThrowWithType<T extends Error>(errorType: new (...args: any[]) => T, message?: string): jest.CustomMatcherResult;
  toResolveWithType<T>(expectedType: string): Promise<jest.CustomMatcherResult>;
  toRejectWithType<T extends Error>(errorType: new (...args: any[]) => T): Promise<jest.CustomMatcherResult>;
}

/**
 * Test timing utilities with type safety
 */
export interface TimingUtilities {
  waitFor<T>(condition: () => T | Promise<T>, options?: WaitForOptions): Promise<T>;
  waitForElement<T extends Element>(selector: string, options?: WaitForOptions): Promise<T>;
  waitForValue<T>(getValue: () => T, expectedValue: T, options?: WaitForOptions): Promise<T>;
  delay(ms: number): Promise<void>;
  timeout<T>(promise: Promise<T>, ms: number): Promise<T>;
}

export interface WaitForOptions {
  timeout?: number;
  interval?: number;
  message?: string;
}

/**
 * Mock data generators with type safety
 */
export interface MockDataGenerators {
  string(options?: StringGeneratorOptions): string;
  number(options?: NumberGeneratorOptions): number;
  boolean(): boolean;
  date(options?: DateGeneratorOptions): Date;
  array<T>(generator: () => T, options?: ArrayGeneratorOptions): T[];
  object<T>(schema: MockSchema<T>): T;
  oneOf<T>(...values: T[]): T;
  maybe<T>(generator: () => T, probability?: number): T | undefined;
}

export interface StringGeneratorOptions {
  length?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  charset?: string;
}

export interface NumberGeneratorOptions {
  min?: number;
  max?: number;
  precision?: number;
  integer?: boolean;
}

export interface DateGeneratorOptions {
  start?: Date;
  end?: Date;
  format?: string;
}

export interface ArrayGeneratorOptions {
  length?: number;
  minLength?: number;
  maxLength?: number;
}

export type MockSchema<T> = {
  [K in keyof T]: MockSchemaProperty<T[K]>;
};

export type MockSchemaProperty<T> = 
  | (() => T)
  | MockDataGenerators[keyof MockDataGenerators]
  | (T extends object ? MockSchema<T> : T);

/**
 * Test fixture management
 */
export interface TestFixtureManager<T> {
  create(data?: Partial<T>): T;
  createMany(count: number, data?: Partial<T>): T[];
  build(): TestFixtureBuilder<T>;
  sequence<K extends keyof T>(field: K, generator: (index: number) => T[K]): TestFixtureManager<T>;
  trait(name: string, modifier: (data: T) => T): TestFixtureManager<T>;
  useTrait(name: string): TestFixtureManager<T>;
}

export interface TestFixtureBuilder<T> {
  with<K extends keyof T>(field: K, value: T[K]): TestFixtureBuilder<T>;
  override(data: Partial<T>): TestFixtureBuilder<T>;
  build(): T;
  buildMany(count: number): T[];
}

/**
 * Async testing utilities
 */
export interface AsyncTestUtilities {
  flushPromises(): Promise<void>;
  flushMicrotasks(): Promise<void>;
  advanceTimers(ms: number): void;
  runOnlyPendingTimers(): void;
  runAllTimers(): void;
  useFakeTimers(): void;
  useRealTimers(): void;
  mockTimers(): MockedTimers;
}

export interface MockedTimers {
  setTimeout: TypedMockFunction<typeof setTimeout>;
  clearTimeout: TypedMockFunction<typeof clearTimeout>;
  setInterval: TypedMockFunction<typeof setInterval>;
  clearInterval: TypedMockFunction<typeof clearInterval>;
  setImmediate: TypedMockFunction<typeof setImmediate>;
  clearImmediate: TypedMockFunction<typeof clearImmediate>;
  Date: jest.MockedClass<typeof Date>;
  now(): number;
  advanceTimersByTime(ms: number): void;
  runOnlyPendingTimers(): void;
  runAllTimers(): void;
}

/**
 * Environment and setup utilities
 */
export interface TestEnvironmentUtilities {
  setupEnvironment(config: TestEnvironmentConfig): void;
  cleanupEnvironment(): void;
  mockEnvironmentVariable(name: string, value: string): () => void;
  mockProcessArgv(argv: string[]): () => void;
  mockCurrentWorkingDirectory(cwd: string): () => void;
  isolateModules<T>(callback: () => T): T;
}

export interface TestEnvironmentConfig {
  environmentVariables?: Record<string, string>;
  processArgv?: string[];
  currentWorkingDirectory?: string;
  nodeOptions?: string[];
  timezone?: string;
  locale?: string;
}

/**
 * Error testing utilities
 */
export interface ErrorTestUtilities {
  expectError<T extends Error>(
    fn: () => any | Promise<any>,
    errorType: new (...args: any[]) => T,
    messagePattern?: string | RegExp
  ): Promise<T>;
  
  expectNoError(fn: () => any | Promise<any>): Promise<void>;
  
  expectAsyncError<T extends Error>(
    promise: Promise<any>,
    errorType: new (...args: any[]) => T,
    messagePattern?: string | RegExp
  ): Promise<T>;
  
  createError<T extends Error>(
    errorType: new (...args: any[]) => T,
    message: string,
    properties?: Partial<T>
  ): T;
}

/**
 * Performance testing utilities
 */
export interface PerformanceTestUtilities {
  measureTime<T>(fn: () => T | Promise<T>): Promise<{ result: T; duration: number }>;
  measureMemory<T>(fn: () => T | Promise<T>): Promise<{ result: T; memoryUsed: number }>;
  expectToBeFasterThan<T>(fn: () => T | Promise<T>, maxDurationMs: number): Promise<T>;
  expectToUseMemoryLessThan<T>(fn: () => T | Promise<T>, maxMemoryMB: number): Promise<T>;
  benchmark<T>(name: string, fn: () => T | Promise<T>, iterations?: number): Promise<BenchmarkResult>;
}

export interface BenchmarkResult {
  name: string;
  iterations: number;
  totalTime: number;
  averageTime: number;
  minTime: number;
  maxTime: number;
  standardDeviation: number;
  operationsPerSecond: number;
}

/**
 * Snapshot testing utilities
 */
export interface SnapshotTestUtilities {
  expectMatchesSnapshot(value: any, hint?: string): void;
  expectInlineSnapshot(value: any, snapshot?: string): void;
  expectThrowsMatchingSnapshot(fn: () => any): void;
  expectToMatchObjectSnapshot(value: object, hint?: string): void;
  updateSnapshots(): void;
}

/**
 * Global test utilities accessible in all tests
 */
declare global {
  namespace jest {
    interface Matchers<R> extends TypedExpectExtensions {}
  }
  
  const timing: TimingUtilities;
  const mockData: MockDataGenerators;
  const fixtures: <T>(factory: () => T) => TestFixtureManager<T>;
  const async: AsyncTestUtilities;
  const env: TestEnvironmentUtilities;
  const errors: ErrorTestUtilities;
  const performance: PerformanceTestUtilities;
  const snapshots: SnapshotTestUtilities;
}

/**
 * Helper functions for creating typed mocks
 */
export function createMock<T>(): TypedMock<T>;
export function createMockFunction<T extends (...args: any[]) => any>(): TypedMockFunction<T>;
export function createSpy<T, K extends keyof T>(object: T, method: K): TypedSpy<T, K>;
export function createMockFactory<T>(factory: () => T): MockFactory<T>;

/**
 * Type guards for testing
 */
export function isMockFunction(value: any): value is jest.MockedFunction<any>;
export function isMockObject(value: any): value is TypedMock<any>;
export function isJestSpy(value: any): value is jest.SpyInstance;