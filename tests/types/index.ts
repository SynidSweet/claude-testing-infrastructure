/**
 * Test types index - centralized exports for all test type definitions
 * Provides easy access to all test-related types and utilities
 */

// Mock interfaces
export * from './mock-interfaces';

// Test data interfaces
export * from './test-data-interfaces';

// Jest extensions and utilities
export * from './jest-extensions';

/**
 * Re-export commonly used types for convenience
 */
export type {
  // Mock interfaces
  MockChildProcess,
  MockProcessMonitor,
  MockHeartbeatMonitor,
  MockConfigurationService,
  MockFileSystem,
  MockLogger,
  MockTimer,
  MockHttpResponse,
  MockStream,
  Mockify,
  
  // Test data interfaces
  TestProjectAnalysisResult,
  LanguageAnalysisResult,
  FrameworkAnalysisResult,
  TestGenerationContext,
  TestExecutionResult,
  MockProjectData,
  TestScenario,
  TestSuite,
  
  // Jest extensions
  TypedMock,
  TypedMockFunction,
  TypedSpy,
  MockFactory,
  TestFixtureManager,
  AsyncTestUtilities,
  ErrorTestUtilities,
  PerformanceTestUtilities
} from './mock-interfaces';

/**
 * Utility types for test development
 */
export type TestCase<TInput = any, TOutput = any> = {
  name: string;
  input: TInput;
  expected: TOutput;
  setup?: () => void | Promise<void>;
  teardown?: () => void | Promise<void>;
};

export type TestMatrix<TInput = any, TOutput = any> = {
  [key: string]: TestCase<TInput, TOutput>[];
};

export type MockConfiguration = {
  resetBetweenTests?: boolean;
  autoMock?: boolean;
  deepMock?: boolean;
  preservePrototype?: boolean;
};

/**
 * Test environment types
 */
export type TestEnvironment = 'node' | 'jsdom' | 'happy-dom';

export type TestPlatform = 'unit' | 'integration' | 'e2e' | 'performance';

export type TestFramework = 'jest' | 'vitest' | 'mocha' | 'jasmine';

/**
 * Assertion helper types
 */
export type AssertionResult = {
  pass: boolean;
  message: string;
  actual?: any;
  expected?: any;
};

export type CustomMatcher<T = any> = (received: T, ...args: any[]) => AssertionResult;

/**
 * Test reporting types
 */
export type TestReport = {
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  duration: number;
  coverage?: CoverageReport;
  failures: TestFailure[];
};

export type TestFailure = {
  testName: string;
  testFile: string;
  error: string;
  stackTrace: string;
};

export type CoverageReport = {
  statements: CoverageMetric;
  branches: CoverageMetric;
  functions: CoverageMetric;
  lines: CoverageMetric;
};

export type CoverageMetric = {
  total: number;
  covered: number;
  percentage: number;
};

/**
 * Test configuration types
 */
export type TestConfiguration = {
  testMatch?: string[];
  testIgnore?: string[];
  timeout?: number;
  retries?: number;
  bail?: boolean;
  verbose?: boolean;
  coverage?: boolean;
  coverageThreshold?: CoverageThreshold;
  setupFiles?: string[];
  setupFilesAfterEnv?: string[];
  globalSetup?: string;
  globalTeardown?: string;
};

export type CoverageThreshold = {
  statements?: number;
  branches?: number;
  functions?: number;
  lines?: number;
};

/**
 * Helper function types
 */
export type TestHelper<T = any> = (...args: any[]) => T | Promise<T>;

export type TestCleanup = () => void | Promise<void>;

export type TestSetup<TContext = any> = () => TContext | Promise<TContext>;

/**
 * Common test patterns
 */
export type TestBuilder<T> = {
  given: (description: string, setup: () => T) => TestBuilder<T>;
  when: (description: string, action: (context: T) => any) => TestBuilder<T>;
  then: (description: string, assertion: (result: any, context: T) => void) => TestBuilder<T>;
  build: () => void;
};

export type BehaviorTest<T> = {
  scenario: string;
  given: T;
  when: (context: T) => any;
  then: (result: any, context: T) => void;
};

/**
 * Type utilities for test development
 */
export type ExtractTestType<T> = T extends TestCase<infer TInput, infer TOutput> 
  ? { input: TInput; output: TOutput }
  : never;

export type InferMockType<T> = T extends (...args: any[]) => any
  ? jest.MockedFunction<T>
  : T extends object
  ? jest.Mocked<T>
  : T;

export type TestPromise<T> = Promise<T> & {
  test: (name: string, assertion: (value: T) => void) => TestPromise<T>;
  catch: (handler: (error: any) => void) => TestPromise<T>;
};

/**
 * Default configurations
 */
export const DEFAULT_TEST_TIMEOUT = 5000;
export const DEFAULT_MOCK_CONFIG: MockConfiguration = {
  resetBetweenTests: true,
  autoMock: false,
  deepMock: false,
  preservePrototype: true
};

export const DEFAULT_TEST_CONFIG: TestConfiguration = {
  timeout: DEFAULT_TEST_TIMEOUT,
  retries: 0,
  bail: false,
  verbose: false,
  coverage: false
};