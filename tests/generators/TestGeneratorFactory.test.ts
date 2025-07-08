import { TestGeneratorFactory } from '../../src/generators/TestGeneratorFactory';
import { StructuralTestGenerator } from '../../src/generators/StructuralTestGenerator';
import { BaseTestGenerator } from '../../src/generators/base/BaseTestGenerator';
import { TestGeneratorConfig, GeneratedTest } from '../../src/generators/TestGenerator';
import { ProjectAnalysis } from '../../src/analyzers/ProjectAnalyzer';
import { logger } from '../../src/utils/common-imports';
import { createMockProjectAnalysis } from '../helpers/mockData';

// Mock the logger
jest.mock('../../src/utils/common-imports', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
  path: require('path'),
  fs: jest.requireActual('fs'),
  fg: jest.fn(),
}));

// Mock StructuralTestGenerator
jest.mock('../../src/generators/StructuralTestGenerator');

// Test language generator implementation
class TestJavaScriptGenerator extends BaseTestGenerator {
  protected async getFilesToTest(): Promise<string[]> {
    return ['/test/file.js'];
  }

  protected async generateTestForFile(filePath: string): Promise<GeneratedTest | null> {
    return {
      sourcePath: filePath,
      testPath: filePath + '.test.js',
      testType: 'unit' as any,
      framework: 'jest',
      content: '// Test content',
    };
  }

  protected async analyzeSourceFile(filePath: string): Promise<any> {
    return { filePath };
  }

  protected selectTestTemplate(_analysis: any): string {
    return 'template';
  }

  protected async generateTestContent(_template: string, _analysis: any): Promise<string> {
    return '// Test content';
  }

  protected getSourceFileExtensions(): string[] {
    return ['.js', '.ts'];
  }
}

describe('TestGeneratorFactory', () => {
  let config: TestGeneratorConfig;
  let analysis: ProjectAnalysis;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset static state
    TestGeneratorFactory.setFeatureFlag(false);
    (TestGeneratorFactory as any).languageGenerators.clear();

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
  });

  describe('setFeatureFlag', () => {
    it('should set feature flag and log', () => {
      TestGeneratorFactory.setFeatureFlag(true);
      expect(logger.info).toHaveBeenCalledWith('Language-specific generators feature flag set to: true');
      
      TestGeneratorFactory.setFeatureFlag(false);
      expect(logger.info).toHaveBeenCalledWith('Language-specific generators feature flag set to: false');
    });
  });

  describe('registerLanguageGenerator', () => {
    it('should register a language generator', () => {
      TestGeneratorFactory.registerLanguageGenerator('javascript', TestJavaScriptGenerator);
      expect(logger.info).toHaveBeenCalledWith('Registered javascript test generator');
      
      // Verify it's registered (we'll test usage in createGenerator tests)
      expect((TestGeneratorFactory as any).languageGenerators.has('javascript')).toBe(true);
    });

    it('should normalize language to lowercase', () => {
      TestGeneratorFactory.registerLanguageGenerator('JavaScript', TestJavaScriptGenerator);
      expect((TestGeneratorFactory as any).languageGenerators.has('javascript')).toBe(true);
    });
  });

  describe('createGenerator', () => {
    it('should create StructuralTestGenerator when feature flag is disabled', async () => {
      TestGeneratorFactory.setFeatureFlag(false);
      
      const generator = await TestGeneratorFactory.createGenerator(config, analysis);
      
      expect(generator).toBeInstanceOf(StructuralTestGenerator);
      expect(logger.info).toHaveBeenCalledWith('Using structural test generator');
    });

    it('should create StructuralTestGenerator when no language generator is registered', async () => {
      TestGeneratorFactory.setFeatureFlag(true);
      // Don't register any generators
      
      const generator = await TestGeneratorFactory.createGenerator(config, analysis);
      
      expect(generator).toBeInstanceOf(StructuralTestGenerator);
      expect(logger.info).toHaveBeenCalledWith('Using structural test generator');
    });

    it('should create language-specific generator when enabled and registered', async () => {
      TestGeneratorFactory.setFeatureFlag(true);
      TestGeneratorFactory.registerLanguageGenerator('javascript', TestJavaScriptGenerator);
      
      const generator = await TestGeneratorFactory.createGenerator(config, analysis);
      
      expect(generator).toBeInstanceOf(TestJavaScriptGenerator);
      expect(logger.info).toHaveBeenCalledWith('Using language-specific test generator');
    });

    it('should respect configuration override to use structural generator', async () => {
      TestGeneratorFactory.setFeatureFlag(true);
      TestGeneratorFactory.registerLanguageGenerator('javascript', TestJavaScriptGenerator);
      
      const configWithOverride = {
        ...config,
        testGeneration: {
          engine: 'structural' as const,
        },
      } as TestGeneratorConfig & {
        testGeneration: { engine: 'structural' };
      };
      
      const generator = await TestGeneratorFactory.createGenerator(configWithOverride, analysis);
      
      expect(generator).toBeInstanceOf(StructuralTestGenerator);
    });

    it('should respect configuration override to use language-specific generator', async () => {
      TestGeneratorFactory.setFeatureFlag(false); // Feature flag off
      TestGeneratorFactory.registerLanguageGenerator('javascript', TestJavaScriptGenerator);
      
      const configWithOverride = {
        ...config,
        testGeneration: {
          engine: 'language-specific',
        },
      } as any;
      
      const generator = await TestGeneratorFactory.createGenerator(configWithOverride, analysis);
      
      expect(generator).toBeInstanceOf(TestJavaScriptGenerator);
    });

    it('should handle TypeScript as JavaScript', async () => {
      TestGeneratorFactory.setFeatureFlag(true);
      TestGeneratorFactory.registerLanguageGenerator('javascript', TestJavaScriptGenerator);
      
      const tsAnalysis = createMockProjectAnalysis({
        ...analysis,
        languages: [
          { name: 'typescript', confidence: 0.95, files: Array(15).fill('file.ts') },
        ],
      });
      
      const generator = await TestGeneratorFactory.createGenerator(config, tsAnalysis);
      
      expect(generator).toBeInstanceOf(TestJavaScriptGenerator);
    });

    it('should detect Python as primary language', async () => {
      TestGeneratorFactory.setFeatureFlag(true);
      
      const pythonAnalysis = createMockProjectAnalysis({
        ...analysis,
        languages: [
          { name: 'javascript', confidence: 0.3, files: Array(2).fill('file.js') },
          { name: 'python', confidence: 0.95, files: Array(20).fill('file.py') },
        ],
      });
      
      // Should fall back to structural since no Python generator is registered
      const generator = await TestGeneratorFactory.createGenerator(config, pythonAnalysis);
      
      expect(generator).toBeInstanceOf(StructuralTestGenerator);
    });

    it('should throw error when language-specific forced but no generator available', () => {
      TestGeneratorFactory.setFeatureFlag(true);
      // Don't register any generators
      
      const configWithOverride = {
        ...config,
        testGeneration: {
          engine: 'language-specific',
        },
      } as any;
      
      expect(() => TestGeneratorFactory.createGenerator(configWithOverride, analysis))
        .toThrow('No generator registered for language: javascript');
    });
  });

  describe('buildLanguageContext', () => {
    it('should build JavaScript context correctly', async () => {
      TestGeneratorFactory.setFeatureFlag(true);
      TestGeneratorFactory.registerLanguageGenerator('javascript', TestJavaScriptGenerator);
      
      const jsOnlyAnalysis = createMockProjectAnalysis({
        projectPath: '/test/project',
        languages: [
          { name: 'javascript', confidence: 0.95, files: Array(15).fill('file.js') },
        ],
        frameworks: [
          { name: 'react', confidence: 0.9, configFiles: ['package.json'] },
          { name: 'express', confidence: 0.8, configFiles: ['package.json'] },
        ],
      });
      
      const generator = await TestGeneratorFactory.createGenerator(config, jsOnlyAnalysis);
      const context = (generator as TestJavaScriptGenerator).getLanguageContext();
      
      expect(context.language).toBe('javascript');
      expect(context.framework).toBe('react');
      expect(context.testFramework).toBe('jest');
      expect(context.features.supportsAsync).toBe(true);
      expect(context.importStyle.importSyntax).toBe('require'); // Default is commonjs
    });

    it('should build TypeScript context correctly', async () => {
      TestGeneratorFactory.setFeatureFlag(true);
      TestGeneratorFactory.registerLanguageGenerator('javascript', TestJavaScriptGenerator);
      
      const tsAnalysis = createMockProjectAnalysis({
        ...analysis,
        languages: [
          { name: 'javascript', confidence: 0.6, files: Array(5).fill('file.js') },
          { name: 'typescript', confidence: 0.9, files: Array(10).fill('file.ts') },
        ],
        moduleSystem: {
          type: 'esm' as const,
          hasPackageJsonType: true,
          packageJsonType: 'module' as const,
          confidence: 1,
          fileExtensionPattern: 'js' as const,
        },
      });
      
      const generator = await TestGeneratorFactory.createGenerator(config, tsAnalysis);
      const context = (generator as TestJavaScriptGenerator).getLanguageContext();
      
      expect(context.language).toBe('typescript');
      expect(context.testFileExtension).toBe('.test.ts');
      expect(context.features.hasTypeAnnotations).toBe(true);
      expect(context.importStyle.importSyntax).toBe('import');
    });

    it('should detect framework priority correctly', async () => {
      TestGeneratorFactory.setFeatureFlag(true);
      TestGeneratorFactory.registerLanguageGenerator('javascript', TestJavaScriptGenerator);
      
      // Vue should be selected over express based on priority
      const vueAnalysis = createMockProjectAnalysis({
        ...analysis,
        frameworks: [
          { name: 'express', confidence: 0.7, configFiles: ['package.json'] },
          { name: 'vue', confidence: 0.9, configFiles: ['package.json'] },
        ],
      });
      
      const generator = await TestGeneratorFactory.createGenerator(config, vueAnalysis);
      const context = (generator as TestJavaScriptGenerator).getLanguageContext();
      
      expect(context.framework).toBe('vue');
    });
  });

  describe('createCompatibilityAdapter', () => {
    it('should throw not implemented error', () => {
      const mockGenerator = {} as BaseTestGenerator;
      
      expect(() => TestGeneratorFactory.createCompatibilityAdapter(mockGenerator))
        .toThrow('Compatibility adapter not yet implemented');
    });
  });
});