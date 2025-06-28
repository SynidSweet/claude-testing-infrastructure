import { TestGenerator, TestGeneratorConfig, TestType, GeneratedTest } from '../../src/generators/TestGenerator';
import { ProjectAnalysis } from '../../src/analyzers/ProjectAnalyzer';

// Mock implementation for testing
class MockTestGenerator extends TestGenerator {
  constructor(config: TestGeneratorConfig, analysis: ProjectAnalysis) {
    super(config, analysis);
  }

  protected async getFilesToTest(): Promise<string[]> {
    return ['/mock/file1.js', '/mock/file2.ts'];
  }

  protected async generateTestForFile(filePath: string): Promise<GeneratedTest | null> {
    return {
      sourcePath: filePath,
      testPath: this.getTestFilePath(filePath),
      testType: TestType.UNIT,
      framework: this.getFramework(),
      content: `// Test for ${filePath}\ndescribe('test', () => {\n  it('should work', () => {\n    expect(true).toBe(true);\n  });\n});`
    };
  }

  protected getTestFileExtension(): string {
    return '.test.js';
  }
}

describe('TestGenerator', () => {
  let mockAnalysis: ProjectAnalysis;
  let config: TestGeneratorConfig;

  beforeEach(() => {
    mockAnalysis = {
      projectPath: '/mock/project',
      languages: [{ name: 'javascript', confidence: 90, files: ['file1.js'] }],
      frameworks: [{ name: 'react', confidence: 80, version: '18.0.0', configFiles: [] }],
      packageManagers: [{ name: 'npm', confidence: 90, lockFiles: [] }],
      projectStructure: {
        rootFiles: [],
        srcDirectory: '/mock/project/src',
        testDirectories: [],
        configFiles: [],
        buildOutputs: [],
        entryPoints: []
      },
      dependencies: {
        production: {},
        development: {},
        python: undefined
      },
      testingSetup: {
        hasTests: false,
        testFrameworks: [],
        testFiles: [],
        coverageTools: []
      },
      complexity: {
        totalFiles: 2,
        totalLines: 100,
        averageFileSize: 50,
        largestFiles: []
      }
    };

    config = {
      projectPath: '/mock/project',
      outputPath: '/mock/tests',
      testFramework: 'jest',
      options: {}
    };
  });

  describe('constructor', () => {
    it('should create generator with valid config', () => {
      const generator = new MockTestGenerator(config, mockAnalysis);
      expect(generator.getFramework()).toBe('jest');
      expect(generator.getConfig()).toEqual(config);
      expect(generator.getAnalysis()).toEqual(mockAnalysis);
    });

    it('should throw error for missing project path', () => {
      const invalidConfig = { ...config, projectPath: '' };
      expect(() => new MockTestGenerator(invalidConfig, mockAnalysis)).toThrow('Project path is required');
    });

    it('should throw error for missing output path', () => {
      const invalidConfig = { ...config, outputPath: '' };
      expect(() => new MockTestGenerator(invalidConfig, mockAnalysis)).toThrow('Output path is required');
    });

    it('should throw error for missing test framework', () => {
      const invalidConfig = { ...config, testFramework: '' };
      expect(() => new MockTestGenerator(invalidConfig, mockAnalysis)).toThrow('Test framework is required');
    });
  });

  describe('generate', () => {
    it('should generate tests successfully', async () => {
      const generator = new MockTestGenerator(config, mockAnalysis);
      const result = await generator.generate();

      expect(result.success).toBe(true);
      expect(result.tests).toHaveLength(2);
      expect(result.errors).toHaveLength(0);
      expect(result.stats.filesAnalyzed).toBe(2);
      expect(result.stats.testsGenerated).toBe(2);
      expect(result.stats.testLinesGenerated).toBeGreaterThan(0);
    });

    it('should handle errors gracefully', async () => {
      class ErrorTestGenerator extends MockTestGenerator {
        protected async generateTestForFile(_filePath: string): Promise<GeneratedTest | null> {
          throw new Error('Mock generation error');
        }
      }

      const generator = new ErrorTestGenerator(config, mockAnalysis);
      const result = await generator.generate();

      expect(result.success).toBe(false);
      expect(result.tests).toHaveLength(0);
      expect(result.errors).toHaveLength(2);
      expect(result.errors[0]).toContain('Mock generation error');
    });
  });

  describe('shouldGenerateTestType', () => {
    it('should generate all types by default', () => {
      const generator = new MockTestGenerator(config, mockAnalysis);
      expect(generator['shouldGenerateTestType'](TestType.UNIT)).toBe(true);
      expect(generator['shouldGenerateTestType'](TestType.INTEGRATION)).toBe(true);
      expect(generator['shouldGenerateTestType'](TestType.COMPONENT)).toBe(true);
    });

    it('should respect configured test types', () => {
      const configWithTypes = {
        ...config,
        options: { testTypes: [TestType.UNIT, TestType.COMPONENT] }
      };
      const generator = new MockTestGenerator(configWithTypes, mockAnalysis);
      
      expect(generator['shouldGenerateTestType'](TestType.UNIT)).toBe(true);
      expect(generator['shouldGenerateTestType'](TestType.COMPONENT)).toBe(true);
      expect(generator['shouldGenerateTestType'](TestType.INTEGRATION)).toBe(false);
    });
  });

  describe('getNamingConventions', () => {
    it('should use default naming conventions', () => {
      const generator = new MockTestGenerator(config, mockAnalysis);
      const conventions = generator['getNamingConventions']();
      
      expect(conventions.testFileSuffix).toBe('.test');
      expect(conventions.testDirectory).toBe('__tests__');
      expect(conventions.mockFileSuffix).toBe('.mock');
    });

    it('should use custom naming conventions', () => {
      const configWithConventions = {
        ...config,
        options: {
          namingConventions: {
            testFileSuffix: '.spec',
            testDirectory: 'tests',
            mockFileSuffix: '.fake'
          }
        }
      };
      const generator = new MockTestGenerator(configWithConventions, mockAnalysis);
      const conventions = generator['getNamingConventions']();
      
      expect(conventions.testFileSuffix).toBe('.spec');
      expect(conventions.testDirectory).toBe('tests');
      expect(conventions.mockFileSuffix).toBe('.fake');
    });
  });

  describe('getTestFilePath', () => {
    it('should generate correct test file path', () => {
      const generator = new MockTestGenerator(config, mockAnalysis);
      const testPath = generator['getTestFilePath']('/mock/project/src/utils.js');
      
      expect(testPath).toBe('/mock/tests/src/utils.test.js');
    });

    it('should handle test type in path', () => {
      const generator = new MockTestGenerator(config, mockAnalysis);
      const testPath = generator['getTestFilePath']('/mock/project/src/utils.js', TestType.INTEGRATION);
      
      expect(testPath).toBe('/mock/tests/src/utils.integration.test.js');
    });

    it('should handle files in project root', () => {
      const generator = new MockTestGenerator(config, mockAnalysis);
      const testPath = generator['getTestFilePath']('/mock/project/index.js');
      
      expect(testPath).toBe('/mock/tests/index.test.js');
    });
  });
});