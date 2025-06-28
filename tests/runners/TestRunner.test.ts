import { TestRunner, TestRunnerConfig, TestResult } from '../../src/runners/TestRunner';
import { ProjectAnalysis } from '../../src/analyzers/ProjectAnalyzer';
import { createMockProjectAnalysis } from '../helpers/mockData';

// Mock concrete implementation for testing
class MockTestRunner extends TestRunner {
  constructor(config: TestRunnerConfig, analysis: ProjectAnalysis) {
    super(config, analysis);
  }

  supports(framework: string): boolean {
    return framework === 'mock';
  }

  protected async hasTests(): Promise<boolean> {
    return true;
  }

  protected async executeTests(): Promise<TestResult> {
    return {
      success: true,
      exitCode: 0,
      testSuites: 1,
      tests: 5,
      passed: 5,
      failed: 0,
      skipped: 0,
      duration: 1000,
      failures: [],
      output: 'All tests passed',
      errorOutput: ''
    };
  }

  protected parseOutput(stdout: string, stderr: string, exitCode: number): TestResult {
    return {
      success: exitCode === 0,
      exitCode,
      testSuites: 1,
      tests: 1,
      passed: exitCode === 0 ? 1 : 0,
      failed: exitCode === 0 ? 0 : 1,
      skipped: 0,
      duration: 100,
      failures: [],
      output: stdout,
      errorOutput: stderr
    };
  }

  protected getRunCommand(): { command: string; args: string[] } {
    return { command: 'echo', args: ['test'] };
  }
}

describe('TestRunner', () => {
  const mockConfig: TestRunnerConfig = {
    projectPath: '/test/project',
    testPath: '/test/project/.claude-testing',
    framework: 'mock'
  };

  const mockAnalysis = createMockProjectAnalysis();

  describe('constructor', () => {
    it('should create a test runner with valid config', () => {
      const runner = new MockTestRunner(mockConfig, mockAnalysis);
      expect(runner.getFramework()).toBe('mock');
      expect(runner.getConfig()).toEqual(mockConfig);
      expect(runner.getAnalysis()).toEqual(mockAnalysis);
    });

    it('should throw error for missing project path', () => {
      const invalidConfig = { ...mockConfig, projectPath: '' };
      expect(() => new MockTestRunner(invalidConfig, mockAnalysis)).toThrow('Project path is required');
    });

    it('should throw error for missing test path', () => {
      const invalidConfig = { ...mockConfig, testPath: '' };
      expect(() => new MockTestRunner(invalidConfig, mockAnalysis)).toThrow('Test path is required');
    });

    it('should throw error for missing framework', () => {
      const invalidConfig = { ...mockConfig, framework: '' };
      expect(() => new MockTestRunner(invalidConfig, mockAnalysis)).toThrow('Test framework is required');
    });
  });

  describe('run', () => {
    it('should run tests successfully', async () => {
      const runner = new MockTestRunner(mockConfig, mockAnalysis);
      const result = await runner.run();

      expect(result.success).toBe(true);
      expect(result.exitCode).toBe(0);
      expect(result.tests).toBe(5);
      expect(result.passed).toBe(5);
      expect(result.failed).toBe(0);
      expect(result.duration).toBeGreaterThan(0);
    });

    it('should handle test execution errors', async () => {
      class FailingTestRunner extends MockTestRunner {
        protected async executeTests(): Promise<TestResult> {
          throw new Error('Test execution failed');
        }
      }

      const runner = new FailingTestRunner(mockConfig, mockAnalysis);
      const result = await runner.run();

      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(1);
      expect(result.failures).toHaveLength(1);
      expect(result.failures[0]?.message).toContain('Test execution failed');
    });

    it('should handle no tests found', async () => {
      class NoTestsRunner extends MockTestRunner {
        protected async hasTests(): Promise<boolean> {
          return false;
        }
      }

      const runner = new NoTestsRunner(mockConfig, mockAnalysis);
      const result = await runner.run();

      expect(result.success).toBe(true);
      expect(result.exitCode).toBe(0);
      expect(result.tests).toBe(0);
      expect(result.output).toBe('No tests found');
    });
  });

  describe('supports', () => {
    it('should return true for supported framework', () => {
      const runner = new MockTestRunner(mockConfig, mockAnalysis);
      expect(runner.supports('mock')).toBe(true);
    });

    it('should return false for unsupported framework', () => {
      const runner = new MockTestRunner(mockConfig, mockAnalysis);
      expect(runner.supports('jest')).toBe(false);
    });
  });

  describe('parseOutput', () => {
    it('should parse successful test output', () => {
      const runner = new MockTestRunner(mockConfig, mockAnalysis);
      const result = runner['parseOutput']('Test passed', '', 0);

      expect(result.success).toBe(true);
      expect(result.exitCode).toBe(0);
      expect(result.passed).toBe(1);
      expect(result.failed).toBe(0);
    });

    it('should parse failed test output', () => {
      const runner = new MockTestRunner(mockConfig, mockAnalysis);
      const result = runner['parseOutput']('', 'Test failed', 1);

      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(1);
      expect(result.passed).toBe(0);
      expect(result.failed).toBe(1);
    });
  });
});