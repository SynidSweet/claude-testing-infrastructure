/**
 * Test data interfaces for type-safe test fixtures
 * Provides structured types for test data and analysis results
 */

/**
 * Project analysis result interfaces
 */
export interface TestProjectAnalysisResult {
  languages: LanguageAnalysisResult[];
  frameworks: FrameworkAnalysisResult[];
  dependencies: DependencyAnalysisResult[];
  complexity: ComplexityAnalysisResult;
  testCoverage: TestCoverageResult;
  structure: ProjectStructureResult;
}

export interface LanguageAnalysisResult {
  name: string;
  confidence: number;
  files: string[];
  version?: string;
  features: string[];
}

export interface FrameworkAnalysisResult {
  name: string;
  confidence: number;
  version?: string;
  type: 'frontend' | 'backend' | 'testing' | 'build' | 'other';
  files: string[];
  config?: FrameworkConfig;
}

export interface FrameworkConfig {
  configFiles: string[];
  entryPoints: string[];
  dependencies: string[];
  scripts: Record<string, string>;
}

export interface DependencyAnalysisResult {
  name: string;
  version: string;
  type: 'production' | 'development' | 'peer' | 'optional';
  source: 'package.json' | 'requirements.txt' | 'pom.xml' | 'other';
  transitive?: boolean;
}

export interface ComplexityAnalysisResult {
  averageComplexity: number;
  maxComplexity: number;
  highComplexityFiles: ComplexityFileResult[];
  totalFunctions: number;
  totalClasses: number;
  totalLines: number;
}

export interface ComplexityFileResult {
  file: string;
  complexity: number;
  functions: FunctionComplexityResult[];
}

export interface FunctionComplexityResult {
  name: string;
  complexity: number;
  lineNumber: number;
  parameters: number;
}

export interface TestCoverageResult {
  percentage: number;
  coveredLines: number;
  totalLines: number;
  uncoveredFiles: string[];
  coverageByFile: FileCoverageResult[];
}

export interface FileCoverageResult {
  file: string;
  percentage: number;
  coveredLines: number;
  totalLines: number;
  uncoveredRanges: CoverageRange[];
}

export interface CoverageRange {
  startLine: number;
  endLine: number;
  type: 'statement' | 'branch' | 'function';
}

export interface ProjectStructureResult {
  rootPath: string;
  sourceDirectories: string[];
  testDirectories: string[];
  configFiles: string[];
  documentationFiles: string[];
  totalFiles: number;
  structure: DirectoryNode;
}

export interface DirectoryNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: DirectoryNode[];
  size?: number;
  extension?: string;
}

/**
 * Test generation context interfaces
 */
export interface TestGenerationContext {
  sourceFile: string;
  sourceCode: string;
  existingTests: string[];
  dependencies: string[];
  framework: FrameworkAnalysisResult;
  language: LanguageAnalysisResult;
  testType: TestType;
  configuration: TestGenerationConfiguration;
}

export type TestType = 'unit' | 'integration' | 'e2e' | 'performance' | 'security';

export interface TestGenerationConfiguration {
  framework: string;
  runner: string;
  mockingLibrary?: string;
  assertionLibrary?: string;
  coverageThreshold: number;
  patterns: TestPatternConfiguration;
  features: TestFeatureConfiguration;
}

export interface TestPatternConfiguration {
  naming: string;
  structure: string;
  setup: string[];
  teardown: string[];
}

export interface TestFeatureConfiguration {
  mocking: boolean;
  spying: boolean;
  fixtures: boolean;
  snapshots: boolean;
  async: boolean;
  timers: boolean;
}

/**
 * Test execution result interfaces
 */
export interface TestExecutionResult {
  success: boolean;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  duration: number;
  coverage?: TestCoverageResult;
  failures: TestFailureResult[];
  performance: TestPerformanceResult;
}

export interface TestFailureResult {
  testName: string;
  testFile: string;
  error: TestErrorResult;
  stackTrace: string;
  duration: number;
}

export interface TestErrorResult {
  message: string;
  type: string;
  expected?: any;
  actual?: any;
  diff?: string;
}

export interface TestPerformanceResult {
  totalDuration: number;
  averageTestDuration: number;
  slowestTests: SlowTestResult[];
  memoryUsage: MemoryUsageResult;
}

export interface SlowTestResult {
  testName: string;
  testFile: string;
  duration: number;
  reason?: string;
}

export interface MemoryUsageResult {
  peak: number;
  average: number;
  leaks: MemoryLeakResult[];
}

export interface MemoryLeakResult {
  testName: string;
  beforeMemory: number;
  afterMemory: number;
  leak: number;
}

/**
 * Mock data interfaces for test scenarios
 */
export interface MockProjectData {
  name: string;
  path: string;
  structure: MockFileStructure;
  packageJson?: MockPackageJson;
  tsConfig?: MockTsConfig;
  jestConfig?: MockJestConfig;
}

export interface MockFileStructure {
  [path: string]: MockFile | MockFileStructure;
}

export interface MockFile {
  content: string;
  type: 'file';
  encoding?: string;
  permissions?: string;
}

export interface MockPackageJson {
  name: string;
  version: string;
  description?: string;
  main?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  engines?: Record<string, string>;
  repository?: MockRepository;
  author?: string | MockAuthor;
  license?: string;
  keywords?: string[];
}

export interface MockRepository {
  type: string;
  url: string;
}

export interface MockAuthor {
  name: string;
  email?: string;
  url?: string;
}

export interface MockTsConfig {
  compilerOptions: MockCompilerOptions;
  include?: string[];
  exclude?: string[];
  extends?: string;
  references?: MockProjectReference[];
}

export interface MockCompilerOptions {
  target: string;
  module: string;
  lib?: string[];
  outDir?: string;
  rootDir?: string;
  strict?: boolean;
  esModuleInterop?: boolean;
  skipLibCheck?: boolean;
  declaration?: boolean;
  declarationMap?: boolean;
  sourceMap?: boolean;
  inlineSourceMap?: boolean;
  noEmit?: boolean;
  isolatedModules?: boolean;
  allowSyntheticDefaultImports?: boolean;
  moduleResolution?: string;
  resolveJsonModule?: boolean;
  jsx?: string;
  [key: string]: any;
}

export interface MockProjectReference {
  path: string;
  prepend?: boolean;
}

export interface MockJestConfig {
  preset?: string;
  testEnvironment?: string;
  roots?: string[];
  testMatch?: string[];
  testPathIgnorePatterns?: string[];
  coverageDirectory?: string;
  coverageReporters?: string[];
  collectCoverageFrom?: string[];
  setupFilesAfterEnv?: string[];
  moduleNameMapping?: Record<string, string>;
  transform?: Record<string, string>;
  moduleFileExtensions?: string[];
  testTimeout?: number;
  maxWorkers?: number | string;
  cache?: boolean;
  clearMocks?: boolean;
  restoreMocks?: boolean;
  resetMocks?: boolean;
}

/**
 * Helper types for test data creation
 */
export type TestDataBuilder<T> = {
  [K in keyof T]: (value: T[K]) => TestDataBuilder<T>;
} & {
  build(): T;
};

export type PartialTestData<T> = {
  [K in keyof T]?: T[K] extends object ? PartialTestData<T[K]> : T[K];
};

/**
 * Test scenario interfaces
 */
export interface TestScenario<TInput = any, TOutput = any> {
  name: string;
  description: string;
  input: TInput;
  expectedOutput: TOutput;
  setup?: () => Promise<void> | void;
  teardown?: () => Promise<void> | void;
  timeout?: number;
  skip?: boolean;
  only?: boolean;
}

export interface TestSuite<TContext = any> {
  name: string;
  description: string;
  scenarios: TestScenario[];
  context?: TContext;
  beforeAll?: (context: TContext) => Promise<void> | void;
  afterAll?: (context: TContext) => Promise<void> | void;
  beforeEach?: (context: TContext) => Promise<void> | void;
  afterEach?: (context: TContext) => Promise<void> | void;
}

/**
 * Test fixture management interfaces
 */
export interface TestFixtureManager<T extends object = Record<string, any>> {
  create(data?: Partial<T>): T;
  createMany(count: number, data?: Partial<T>): T[];
  build(): TestFixtureBuilder<T>;
  sequence<K extends keyof T>(field: K, generator: (index: number) => T[K]): TestFixtureManager<T>;
  trait(name: string, modifier: (data: T) => T): TestFixtureManager<T>;
  useTrait(name: string): TestFixtureManager<T>;
}

export interface TestFixtureBuilder<T extends object = Record<string, any>> {
  set<K extends keyof T>(field: K, value: T[K]): TestFixtureBuilder<T>;
  trait(name: string): TestFixtureBuilder<T>;
  sequence<K extends keyof T>(field: K, generator: (index: number) => T[K]): TestFixtureBuilder<T>;
  build(): T;
  buildList(count: number): T[];
}