/**
 * Runners module
 *
 * This module contains test runners for different testing frameworks
 */

// Export test runner classes and interfaces
export {
  TestRunner,
  type TestRunnerConfig,
  type TestResult,
  type TestFailure,
  type CoverageResult,
  type CoverageConfig,
  type ReporterConfig,
} from './TestRunner';

export { JestRunner } from './JestRunner';
export { PytestRunner } from './PytestRunner';
export { TestRunnerFactory } from './TestRunnerFactory';

// Coverage system exports
export {
  CoverageParser,
  CoverageParserFactory,
  type CoverageData,
  type FileCoverage,
  type UncoveredArea,
  type CoverageThresholds,
} from './CoverageParser';

export {
  CoverageAggregator,
  type AggregatedCoverageData,
  type AggregationConfig,
  type CoverageSource,
} from './CoverageAggregator';

export {
  CoverageVisualizer,
  type CoverageReportConfig,
  type CoverageGapAnalysis,
} from './CoverageVisualizer';

export {
  CoverageReporter,
  CoverageReporterFactory,
  type CoverageReporterConfig,
  type CoverageReport,
} from './CoverageReporter';

// Re-export factory methods for convenience
import { TestRunnerFactory } from './TestRunnerFactory';

export const createRunner = TestRunnerFactory.createRunner.bind(TestRunnerFactory);
export const getSupportedFrameworks =
  TestRunnerFactory.getSupportedFrameworks.bind(TestRunnerFactory);
export const isFrameworkSupported = TestRunnerFactory.isFrameworkSupported.bind(TestRunnerFactory);
export const getRecommendedFramework =
  TestRunnerFactory.getRecommendedFramework.bind(TestRunnerFactory);
