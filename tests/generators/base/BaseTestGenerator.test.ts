import { BaseTestGenerator, LanguageContext, SourceFileAnalysis } from '../../../src/generators/base/BaseTestGenerator';
import { TestGeneratorConfig, GeneratedTest, TestType } from '../../../src/generators/TestGenerator';
import { ProjectAnalysis } from '../../../src/analyzers/ProjectAnalyzer';
import { ProgressReporter } from '../../../src/utils/ProgressReporter';
import { logger } from '../../../src/utils/common-imports';
import { createMockProjectAnalysis } from '../../helpers/mockData';

// Mock implementations
jest.mock('../../../src/utils/common-imports', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
  path: require('path'),
  fs: {
    mkdtemp: jest.fn(),
    writeFile: jest.fn(),
    rm: jest.fn(),
  },
  fg: jest.fn(),
}));

// Concrete implementation for testing
class TestableTestGenerator extends BaseTestGenerator {
  private filesToTest: string[] = [];
  private testResults: Map<string, GeneratedTest | null> = new Map();

  setFilesToTest(files: string[]): void {
    this.filesToTest = files;
  }

  setTestResult(file: string, result: GeneratedTest | null): void {
    this.testResults.set(file, result);
  }

  protected async getFilesToTest(): Promise<string[]> {
    return this.filesToTest;
  }

  protected async generateTestForFile(filePath: string): Promise<GeneratedTest | null> {
    const result = this.testResults.get(filePath);
    if (result === undefined && !this.testResults.has(filePath)) {
      throw new Error(`No test result configured for ${filePath}`);
    }
    return result || null;
  }

  protected async analyzeSourceFile(filePath: string): Promise<SourceFileAnalysis> {
    return {
      filePath,
      language: this.languageContext.language,
      ...(this.languageContext.framework && { framework: this.languageContext.framework }),
      fileType: 'module',
      exports: [],
      imports: [],
      hasAsync: false,
    };
  }

  protected selectTestTemplate(analysis: SourceFileAnalysis): string {
    return `template-for-${analysis.fileType}`;
  }

  protected async generateTestContent(template: string, analysis: SourceFileAnalysis): Promise<string> {
    return `// Test for ${analysis.filePath}\n// Using template: ${template}`;
  }

  protected getSourceFileExtensions(): string[] {
    return ['.js', '.ts'];
  }

  // Expose protected method for testing
  async testValidateTestGenerationRatio(filesToTest: string[]): Promise<void> {
    return this.validateTestGenerationRatio(filesToTest);
  }
}

describe('BaseTestGenerator', () => {
  let config: TestGeneratorConfig;
  let analysis: ProjectAnalysis;
  let languageContext: LanguageContext;
  let generator: TestableTestGenerator;

  beforeEach(() => {
    jest.clearAllMocks();
    
    config = {
      projectPath: '/test/project',
      outputPath: '/test/output',
      testFramework: 'jest',
      options: {},
    };

    analysis = createMockProjectAnalysis({
      projectPath: '/test/project',
      languages: [
        { name: 'javascript', confidence: 0.9, files: Array(10).fill('file.js') },
        { name: 'typescript', confidence: 0.8, files: Array(5).fill('file.ts') },
      ],
      frameworks: [
        { name: 'react', confidence: 0.9, configFiles: ['package.json'] },
        { name: 'express', confidence: 0.8, configFiles: ['package.json'] },
      ],
      projectType: 'standard',
    });

    languageContext = {
      language: 'javascript',
      framework: 'react',
      moduleSystem: 'esm',
      testFramework: 'jest',
      features: {
        supportsAsync: true,
        hasDecorators: false,
        hasTypeAnnotations: false,
        testingPatterns: [
          { name: 'unit', applicable: true, templateKey: 'unit' },
          { name: 'component', applicable: true, templateKey: 'component' },
        ],
        assertionStyle: 'expect',
      },
      testFileExtension: '.test.js',
      importStyle: {
        importSyntax: 'import',
        exportSyntax: 'export',
        useFileExtensions: true,
        importExtension: '.js',
      },
    };

    generator = new TestableTestGenerator(config, analysis, languageContext);
  });

  describe('constructor', () => {
    it('should initialize with valid configuration', () => {
      expect(generator.getConfig()).toBe(config);
      expect(generator.getAnalysis()).toBe(analysis);
      expect(generator.getLanguageContext()).toBe(languageContext);
      expect(generator.getFramework()).toBe('jest');
    });

    it('should throw error if project path is missing', () => {
      const invalidConfig = { ...config, projectPath: '' };
      expect(() => new TestableTestGenerator(invalidConfig, analysis, languageContext))
        .toThrow('Project path is required');
    });

    it('should throw error if output path is missing', () => {
      const invalidConfig = { ...config, outputPath: '' };
      expect(() => new TestableTestGenerator(invalidConfig, analysis, languageContext))
        .toThrow('Output path is required');
    });

    it('should throw error if test framework is missing', () => {
      const invalidConfig = { ...config, testFramework: '' };
      expect(() => new TestableTestGenerator(invalidConfig, analysis, languageContext))
        .toThrow('Test framework is required');
    });

    it('should throw error if language context is missing', () => {
      expect(() => new TestableTestGenerator(config, analysis, null as any))
        .toThrow('Language context is required');
    });
  });

  describe('setProgressReporter', () => {
    it('should set progress reporter', () => {
      const reporter = new ProgressReporter();
      generator.setProgressReporter(reporter);
      // The reporter is stored privately, so we can't directly test it
      // but we can verify it doesn't throw
      expect(() => generator.setProgressReporter(reporter)).not.toThrow();
    });
  });

  describe('generateAllTests', () => {
    it('should generate tests successfully for all files', async () => {
      const files = ['/test/project/src/index.js', '/test/project/src/utils.js'];
      generator.setFilesToTest(files);
      
      files.forEach(file => {
        generator.setTestResult(file, {
          sourcePath: file,
          testPath: `/test/output/${file.replace('/test/project/', '')}.test.js`,
          testType: TestType.UNIT,
          framework: 'jest',
          content: `// Test for ${file}`,
        });
      });

      const result = await generator.generateAllTests();

      expect(result.success).toBe(true);
      expect(result.tests).toHaveLength(2);
      expect(result.errors).toHaveLength(0);
      expect(result.stats.filesAnalyzed).toBe(2);
      expect(result.stats.testsGenerated).toBe(2);
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Starting javascript test generation'),
        expect.any(Object)
      );
    });

    it('should handle errors in individual file generation', async () => {
      const files = ['/test/project/src/index.js', '/test/project/src/error.js'];
      generator.setFilesToTest(files);
      
      generator.setTestResult(files[0]!, {
        sourcePath: files[0]!,
        testPath: `/test/output/src/index.test.js`,
        testType: TestType.UNIT,
        framework: 'jest',
        content: `// Test for ${files[0]}`,
      });
      
      // Don't set result for error.js to simulate failure

      const result = await generator.generateAllTests();

      expect(result.success).toBe(false);
      expect(result.tests).toHaveLength(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Failed to generate test for /test/project/src/error.js');
    });

    it('should skip undefined file paths', async () => {
      const files = ['/test/project/src/index.js', undefined as any, '/test/project/src/utils.js'];
      generator.setFilesToTest(files);
      
      generator.setTestResult(files[0]!, {
        sourcePath: files[0]!,
        testPath: `/test/output/src/index.test.js`,
        testType: TestType.UNIT,
        framework: 'jest',
        content: `// Test`,
      });
      
      generator.setTestResult(files[2]!, {
        sourcePath: files[2]!,
        testPath: `/test/output/src/utils.test.js`,
        testType: TestType.UNIT,
        framework: 'jest',
        content: `// Test`,
      });

      const result = await generator.generateAllTests();

      expect(result.success).toBe(true);
      expect(result.tests).toHaveLength(2);
      expect(logger.warn).toHaveBeenCalledWith('Skipping undefined file path at index 1');
    });

    it('should use progress reporter if provided', async () => {
      const reporter = {
        start: jest.fn(),
        updateProgress: jest.fn(),
        reportError: jest.fn(),
        complete: jest.fn(),
      } as any;
      
      generator.setProgressReporter(reporter);
      
      const files = ['/test/project/src/index.js'];
      generator.setFilesToTest(files);
      generator.setTestResult(files[0]!, {
        sourcePath: files[0]!,
        testPath: `/test/output/src/index.test.js`,
        testType: TestType.UNIT,
        framework: 'jest',
        content: `// Test`,
      });

      await generator.generateAllTests();

      expect(reporter.start).toHaveBeenCalledWith(1, 'Generating javascript tests...');
      expect(reporter.updateProgress).toHaveBeenCalledWith(1, files[0]);
      expect(reporter.complete).toHaveBeenCalledWith(true, 'javascript tests generated successfully');
    });

    it('should handle complete failure in test generation', async () => {
      // Override getFilesToTest to throw an error
      (generator as any).getFilesToTest = jest.fn().mockRejectedValue(new Error('File discovery failed'));

      const result = await generator.generateAllTests();

      expect(result.success).toBe(false);
      expect(result.tests).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Test generation failed: File discovery failed');
    });
  });

  describe('validateTestGenerationRatio', () => {
    beforeEach(() => {
      const fg = require('../../../src/utils/common-imports').fg;
      fg.mockResolvedValue([
        '/test/project/src/file1.js',
        '/test/project/src/file2.js',
        '/test/project/src/file3.js',
      ]);
    });

    it('should pass validation when ratio is within limits', async () => {
      const filesToTest = ['/test/project/src/file1.js', '/test/project/src/file2.js'];
      
      await expect(generator.testValidateTestGenerationRatio(filesToTest))
        .resolves.not.toThrow();
    });

    it('should throw error when ratio exceeds maximum', async () => {
      const filesToTest = Array(35).fill('/test/project/src/file.js'); // 35 test files for 3 source files
      
      await expect(generator.testValidateTestGenerationRatio(filesToTest))
        .rejects.toThrow('Test generation ratio exceeds configured maximum threshold');
    });

    it('should skip validation when skipValidation is true', async () => {
      const configWithSkip = { ...config, skipValidation: true } as any;
      const generatorWithSkip = new TestableTestGenerator(configWithSkip, analysis, languageContext);
      
      const filesToTest = Array(35).fill('/test/project/src/file.js');
      
      await expect(generatorWithSkip.testValidateTestGenerationRatio(filesToTest))
        .resolves.not.toThrow();
        
      expect(logger.debug).toHaveBeenCalledWith('Skipping test generation validation due to --force flag');
    });

    it('should use custom maxRatio from config', async () => {
      const configWithRatio = { 
        ...config, 
        generation: { maxTestToSourceRatio: 20 } 
      } as any;
      const generatorWithRatio = new TestableTestGenerator(configWithRatio, analysis, languageContext);
      
      const filesToTest = Array(50).fill('/test/project/src/file.js'); // 50/3 = 16.7x ratio
      
      await expect(generatorWithRatio.testValidateTestGenerationRatio(filesToTest))
        .resolves.not.toThrow(); // 16.7 < 20, so it should pass
    });

    it('should handle case when no source files are found', async () => {
      const fg = require('../../../src/utils/common-imports').fg;
      fg.mockResolvedValue([]);
      
      const filesToTest = ['/test/project/src/file1.js'];
      
      await expect(generator.testValidateTestGenerationRatio(filesToTest))
        .resolves.not.toThrow();
        
      expect(logger.warn).toHaveBeenCalledWith('No source files found in project for ratio validation');
    });
  });

  describe('getTestFilePath', () => {
    it('should generate correct test file path', () => {
      const sourcePath = '/test/project/src/components/Button.js';
      // Access protected method through type assertion
      const testPath = (generator as any).getTestFilePath(sourcePath);
      
      expect(testPath).toBe('/test/output/src/components/Button.test.js');
    });

    it('should handle TypeScript files', () => {
      const tsContext = { ...languageContext, testFileExtension: '.test.ts' };
      const tsGenerator = new TestableTestGenerator(config, analysis, tsContext);
      
      const sourcePath = '/test/project/src/components/Button.ts';
      const testPath = (tsGenerator as any).getTestFilePath(sourcePath);
      
      expect(testPath).toBe('/test/output/src/components/Button.test.ts');
    });

    it('should handle Python files', () => {
      const pyContext = { ...languageContext, language: 'python', testFileExtension: '_test.py' };
      const pyGenerator = new TestableTestGenerator(config, analysis, pyContext);
      
      const sourcePath = '/test/project/src/services/auth.py';
      const testPath = (pyGenerator as any).getTestFilePath(sourcePath);
      
      expect(testPath).toBe('/test/output/src/services/auth_test.py');
    });
  });

  describe('pre and post generation hooks', () => {
    it('should call preGenerate hook', async () => {
      const preGenerateSpy = jest.spyOn(generator as any, 'preGenerate');
      
      generator.setFilesToTest([]);
      await generator.generateAllTests();
      
      expect(preGenerateSpy).toHaveBeenCalled();
    });

    it('should call postGenerate hook with results', async () => {
      const postGenerateSpy = jest.spyOn(generator as any, 'postGenerate');
      
      const files = ['/test/project/src/index.js'];
      generator.setFilesToTest(files);
      generator.setTestResult(files[0]!, {
        sourcePath: files[0]!,
        testPath: `/test/output/src/index.test.js`,
        testType: TestType.UNIT,
        framework: 'jest',
        content: `// Test`,
      });
      
      await generator.generateAllTests();
      
      expect(postGenerateSpy).toHaveBeenCalledWith(expect.arrayContaining([
        expect.objectContaining({
          sourcePath: files[0]!,
        })
      ]));
    });
  });
});