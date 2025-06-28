import { TestRunnerFactory } from '../../src/runners/TestRunnerFactory';
import { JestRunner } from '../../src/runners/JestRunner';
import { PytestRunner } from '../../src/runners/PytestRunner';
import { TestRunnerConfig } from '../../src/runners/TestRunner';
import { createMockProjectAnalysis, createMockFramework, createMockLanguage, createMockTestingSetup } from '../helpers/mockData';

describe('TestRunnerFactory', () => {
  const mockConfig: TestRunnerConfig = {
    projectPath: '/test/project',
    testPath: '/test/project/.claude-testing',
    framework: 'jest'
  };

  const mockAnalysis = createMockProjectAnalysis({
    frameworks: [createMockFramework({ name: 'react', version: '18.0.0' })],
    testingSetup: createMockTestingSetup({ testFrameworks: [] })
  });

  describe('createRunner', () => {
    it('should create Jest runner for jest framework', () => {
      const runner = TestRunnerFactory.createRunner(mockConfig, mockAnalysis);
      expect(runner).toBeInstanceOf(JestRunner);
      expect(runner.supports('jest')).toBe(true);
    });

    it('should create Pytest runner for pytest framework', () => {
      const pytestConfig = { ...mockConfig, framework: 'pytest' };
      const runner = TestRunnerFactory.createRunner(pytestConfig, mockAnalysis);
      expect(runner).toBeInstanceOf(PytestRunner);
      expect(runner.supports('pytest')).toBe(true);
    });

    it('should throw error for unsupported framework', () => {
      const unsupportedConfig = { ...mockConfig, framework: 'unsupported' };
      expect(() => TestRunnerFactory.createRunner(unsupportedConfig, mockAnalysis))
        .toThrow('No test runner found for framework: unsupported');
    });
  });

  describe('getSupportedFrameworks', () => {
    it('should return list of supported frameworks', () => {
      const frameworks = TestRunnerFactory.getSupportedFrameworks();
      expect(frameworks).toContain('jest');
      expect(frameworks).toContain('pytest');
      expect(frameworks.length).toBeGreaterThan(0);
    });
  });

  describe('isFrameworkSupported', () => {
    it('should return true for supported frameworks', () => {
      expect(TestRunnerFactory.isFrameworkSupported('jest')).toBe(true);
      expect(TestRunnerFactory.isFrameworkSupported('pytest')).toBe(true);
    });

    it('should return false for unsupported frameworks', () => {
      expect(TestRunnerFactory.isFrameworkSupported('unsupported')).toBe(false);
      expect(TestRunnerFactory.isFrameworkSupported('mocha')).toBe(false);
    });
  });

  describe('getRecommendedFramework', () => {
    it('should recommend existing framework if supported', () => {
      const analysisWithFramework = createMockProjectAnalysis({
        testingSetup: createMockTestingSetup({ testFrameworks: ['jest'] })
      });

      const recommended = TestRunnerFactory.getRecommendedFramework(analysisWithFramework);
      expect(recommended).toBe('jest');
    });

    it('should recommend pytest for Python projects', () => {
      const pythonAnalysis = createMockProjectAnalysis({
        languages: [createMockLanguage({ name: 'python' })],
        frameworks: [],
        testingSetup: createMockTestingSetup({ testFrameworks: [] })
      });

      const recommended = TestRunnerFactory.getRecommendedFramework(pythonAnalysis);
      expect(recommended).toBe('pytest');
    });

    it('should recommend jest for JavaScript/React projects', () => {
      const jsAnalysis = createMockProjectAnalysis({
        languages: [createMockLanguage({ name: 'javascript' })],
        frameworks: [createMockFramework({ name: 'react', version: '18.0.0' })],
        testingSetup: createMockTestingSetup({ testFrameworks: [] })
      });

      const recommended = TestRunnerFactory.getRecommendedFramework(jsAnalysis);
      expect(recommended).toBe('jest');
    });

    it('should recommend jest for Vue projects', () => {
      const vueAnalysis = createMockProjectAnalysis({
        languages: [createMockLanguage({ name: 'javascript' })],
        frameworks: [createMockFramework({ name: 'vue', version: '3.0.0' })],
        testingSetup: createMockTestingSetup({ testFrameworks: [] })
      });

      const recommended = TestRunnerFactory.getRecommendedFramework(vueAnalysis);
      expect(recommended).toBe('jest');
    });

    it('should recommend jest as default for TypeScript projects', () => {
      const tsAnalysis = createMockProjectAnalysis({
        languages: [createMockLanguage({ name: 'typescript' })],
        frameworks: [],
        testingSetup: createMockTestingSetup({ testFrameworks: [] })
      });

      const recommended = TestRunnerFactory.getRecommendedFramework(tsAnalysis);
      expect(recommended).toBe('jest');
    });

    it('should recommend jest as fallback for unknown projects', () => {
      const unknownAnalysis = createMockProjectAnalysis({
        languages: [],
        frameworks: [],
        testingSetup: createMockTestingSetup({ testFrameworks: [] })
      });

      const recommended = TestRunnerFactory.getRecommendedFramework(unknownAnalysis);
      expect(recommended).toBe('jest');
    });
  });

  describe('registerRunner', () => {
    it('should register new test runner', () => {
      // Mock runner class
      class CustomTestRunner extends JestRunner {
        supports(framework: string): boolean {
          return framework === 'custom';
        }
      }

      TestRunnerFactory.registerRunner(CustomTestRunner);
      
      // Should be able to create runner for custom framework
      const customConfig = { ...mockConfig, framework: 'custom' };
      const runner = TestRunnerFactory.createRunner(customConfig, mockAnalysis);
      expect(runner).toBeInstanceOf(CustomTestRunner);
    });
  });
});