import { TestRunner, TestRunnerConfig } from './TestRunner';
import { JestRunner } from './JestRunner';
import { PytestRunner } from './PytestRunner';
import { ProjectAnalysis } from '../analyzers/ProjectAnalyzer';
import { logger } from '../utils/logger';

/**
 * Factory for creating appropriate test runners based on framework
 */
export class TestRunnerFactory {
  private static runners: (new (config: TestRunnerConfig, analysis: ProjectAnalysis) => TestRunner)[] = [
    JestRunner,
    PytestRunner
  ];

  /**
   * Create a test runner for the specified framework
   */
  static createRunner(config: TestRunnerConfig, analysis: ProjectAnalysis): TestRunner {
    logger.debug(`Creating test runner for framework: ${config.framework}`);

    for (const RunnerClass of this.runners) {
      const instance = new RunnerClass(config, analysis);
      if (instance.supports(config.framework)) {
        logger.info(`Using ${RunnerClass.name} for framework: ${config.framework}`);
        return instance;
      }
    }

    throw new Error(`No test runner found for framework: ${config.framework}`);
  }

  /**
   * Get list of supported frameworks
   */
  static getSupportedFrameworks(): string[] {
    // Hard-coded list of supported frameworks based on our runners
    return ['jest', 'pytest'];
  }

  /**
   * Check if a framework is supported
   */
  static isFrameworkSupported(framework: string): boolean {
    return this.getSupportedFrameworks().includes(framework);
  }

  /**
   * Get recommended framework for a project analysis
   */
  static getRecommendedFramework(analysis: ProjectAnalysis): string {
    // Check existing test frameworks in the project
    if (analysis.testingSetup?.testFrameworks?.length > 0) {
      const existingFramework = analysis.testingSetup.testFrameworks[0];
      if (existingFramework && this.isFrameworkSupported(existingFramework)) {
        return existingFramework;
      }
    }

    // Recommend based on languages and frameworks
    const languages = analysis.languages?.map(l => l.name).filter(Boolean) || [];
    const frameworks = analysis.frameworks?.map(f => f.name).filter(Boolean) || [];

    // Python projects
    if (languages.includes('python')) {
      return 'pytest';
    }

    // JavaScript/TypeScript projects
    if (languages.includes('javascript') || languages.includes('typescript')) {
      // React projects typically use Jest
      if (frameworks.includes('react')) {
        return 'jest';
      }
      
      // Vue projects can use Jest or Vitest
      if (frameworks.includes('vue')) {
        return 'jest'; // Default to Jest for now
      }

      // Default to Jest for JS/TS projects
      return 'jest';
    }

    // Default fallback
    return 'jest';
  }

  /**
   * Register a new test runner
   */
  static registerRunner(runnerClass: new (config: TestRunnerConfig, analysis: ProjectAnalysis) => TestRunner): void {
    this.runners.push(runnerClass);
    logger.debug(`Registered new test runner: ${runnerClass.name}`);
  }
}