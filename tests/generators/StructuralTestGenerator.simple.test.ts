import { StructuralTestGenerator, StructuralTestGeneratorOptions } from '../../src/generators/StructuralTestGenerator';
import { TestGeneratorConfig, TestType } from '../../src/generators/TestGenerator';
import { ProjectAnalysis } from '../../src/analyzers/ProjectAnalyzer';

describe('StructuralTestGenerator - Basic Tests', () => {
  let mockAnalysis: ProjectAnalysis;
  let config: TestGeneratorConfig;

  beforeEach(() => {
    mockAnalysis = {
      projectPath: '/mock/project',
      languages: [
        { name: 'javascript', confidence: 90, files: ['src/utils.js'] },
        { name: 'typescript', confidence: 80, files: ['src/types.ts'] }
      ],
      frameworks: [
        { name: 'react', confidence: 80, version: '18.0.0', configFiles: [] }
      ],
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
        totalFiles: 3,
        totalLines: 150,
        averageFileSize: 50,
        largestFiles: []
      },
      moduleSystem: {
        type: 'commonjs',
        hasPackageJsonType: false,
        confidence: 0.8,
        fileExtensionPattern: 'js'
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
    it('should create generator with default options', () => {
      const generator = new StructuralTestGenerator(config, mockAnalysis);
      expect(generator).toBeInstanceOf(StructuralTestGenerator);
      expect(generator.getFramework()).toBe('jest');
    });

    it('should create generator with custom options', () => {
      const options: StructuralTestGeneratorOptions = {
        generateMocks: false,
        generateSetup: false
      };
      const generator = new StructuralTestGenerator(config, mockAnalysis, options);
      expect(generator).toBeInstanceOf(StructuralTestGenerator);
    });
  });

  describe('getTestFileExtension', () => {
    it('should return correct extension for JavaScript', () => {
      const generator = new StructuralTestGenerator(config, mockAnalysis);
      const ext = generator['getTestFileExtension']();
      expect(ext).toBe('.test.js');
    });

    it('should return correct extension for TypeScript', () => {
      const tsAnalysis = {
        ...mockAnalysis,
        languages: [{ name: 'typescript' as const, confidence: 90, files: ['src/types.ts'] }]
      };
      const generator = new StructuralTestGenerator(config, tsAnalysis);
      const ext = generator['getTestFileExtension']();
      expect(ext).toBe('.test.ts');
    });

    it('should return correct extension for Python', () => {
      const pyAnalysis = {
        ...mockAnalysis,
        languages: [{ name: 'python' as const, confidence: 90, files: ['src/utils.py'] }]
      };
      const generator = new StructuralTestGenerator(config, pyAnalysis);
      const ext = generator['getTestFileExtension']();
      expect(ext).toBe('_test.py');
    });

    it('should return correct extension when language is passed as parameter', () => {
      // Test mixed-language project scenario
      const mixedAnalysis = {
        ...mockAnalysis,
        languages: [
          { name: 'javascript' as const, confidence: 90, files: ['src/utils.js'] },
          { name: 'python' as const, confidence: 80, files: ['src/service.py'] }
        ]
      };
      const generator = new StructuralTestGenerator(config, mixedAnalysis);
      
      // Without language parameter, should use primary language (JavaScript)
      expect(generator['getTestFileExtension']()).toBe('.test.js');
      
      // With specific language parameter
      expect(generator['getTestFileExtension']('python')).toBe('_test.py');
      expect(generator['getTestFileExtension']('javascript')).toBe('.test.js');
      expect(generator['getTestFileExtension']('typescript')).toBe('.test.ts');
    });
  });

  describe('private helper methods', () => {
    let generator: StructuralTestGenerator;

    beforeEach(() => {
      generator = new StructuralTestGenerator(config, mockAnalysis);
    });

    it('should get language extensions correctly', () => {
      const extensions = generator['getLanguageExtensions']();
      expect(extensions).toContain('.js');
      expect(extensions).toContain('.jsx');
      expect(extensions).toContain('.ts');
      expect(extensions).toContain('.tsx');
    });

    it('should get language from extension', () => {
      expect(generator['getLanguageFromExtension']('.js')).toBe('javascript');
      expect(generator['getLanguageFromExtension']('.jsx')).toBe('javascript');
      expect(generator['getLanguageFromExtension']('.ts')).toBe('typescript');
      expect(generator['getLanguageFromExtension']('.tsx')).toBe('typescript');
      expect(generator['getLanguageFromExtension']('.py')).toBe('python');
      expect(generator['getLanguageFromExtension']('.unknown')).toBeNull();
    });

    it('should get primary language correctly', () => {
      const primaryLang = generator['getPrimaryLanguage']();
      expect(primaryLang).toBe('javascript'); // Highest confidence
    });

    it('should get primary framework correctly', () => {
      const primaryFramework = generator['getPrimaryFramework']();
      expect(primaryFramework).toBe('react');
    });

    it('should determine test types correctly', () => {
      // Component test
      const componentTestType = generator['determineTestType']('/src/Button.tsx', 'function Button() { return <div>test</div>; }');
      expect(componentTestType).toBe(TestType.COMPONENT);

      // Service test
      const serviceTestType = generator['determineTestType']('/src/ApiService.js', 'class ApiService { async fetch() {} }');
      expect(serviceTestType).toBe(TestType.SERVICE);

      // Utility test
      const utilTestType = generator['determineTestType']('/src/utils.js', 'export function helper() {}');
      expect(utilTestType).toBe(TestType.UTILITY);

      // API test
      const apiTestType = generator['determineTestType']('/src/routes.js', 'app.get("/api", handler)');
      expect(apiTestType).toBe(TestType.API);

      // Hook test
      const hookTestType = generator['determineTestType']('/src/useCounter.js', 'function useCounter() { useState(0); }');
      expect(hookTestType).toBe(TestType.HOOK);
    });

    it('should extract JavaScript exports correctly', () => {
      const jsContent = `
export const helper = () => {};
export function calculate() {}
export class MyClass {}
export { another, variable };
`;
      const exports = generator['extractExports'](jsContent, 'javascript');
      expect(exports).toContain('helper');
      expect(exports).toContain('calculate');
      expect(exports).toContain('MyClass');
      expect(exports).toContain('another');
      expect(exports).toContain('variable');
    });

    it('should extract Python exports correctly', () => {
      const pyContent = `
def helper():
    pass

class MyClass:
    pass

def another_function():
    pass
`;
      const exports = generator['extractExports'](pyContent, 'python');
      expect(exports).toContain('helper');
      expect(exports).toContain('MyClass');
      expect(exports).toContain('another_function');
    });

    it('should extract dependencies correctly', () => {
      const jsContent = `
import React from 'react';
import { useState } from 'react';
import axios from 'axios';
import './styles.css';
`;
      const deps = generator['extractDependencies'](jsContent, 'javascript');
      expect(deps).toContain('react');
      expect(deps).toContain('axios');
      expect(deps).toContain('./styles.css');
    });

    it('should detect default exports correctly', () => {
      const withDefault = 'export default function Component() {}';
      const withoutDefault = 'export function Component() {}';
      
      expect(generator['hasDefaultExport'](withDefault, 'javascript')).toBe(true);
      expect(generator['hasDefaultExport'](withoutDefault, 'javascript')).toBe(false);
      expect(generator['hasDefaultExport']('anything', 'python')).toBe(false);
    });

    it('should detect component files correctly', () => {
      const componentContent = 'function Button() { return <div>Click me</div>; }';
      const utilContent = 'export function helper() { return "help"; }';
      
      expect(generator['isComponent']('/src/Button.jsx', componentContent)).toBe(true);
      expect(generator['isComponent']('/src/button.jsx', componentContent)).toBe(true);
      expect(generator['isComponent']('/src/utils.js', utilContent)).toBe(false);
    });

    it('should detect utility files correctly', () => {
      const utilContent = 'export function helper() {}';
      const componentContent = 'function Button() { return <div>; }';
      
      expect(generator['isUtility']('/src/utils.js', utilContent)).toBe(true);
      expect(generator['isUtility']('/src/helpers.js', utilContent)).toBe(true);
      expect(generator['isUtility']('/src/Button.jsx', componentContent)).toBe(false);
    });

    it('should detect service files correctly', () => {
      const serviceContent = 'class ApiService { fetch() {} }';
      const utilContent = 'export function helper() {}';
      
      expect(generator['isService']('/src/ApiService.js', serviceContent)).toBe(true);
      expect(generator['isService']('/src/service.js', serviceContent)).toBe(true);
      expect(generator['isService']('/src/utils.js', utilContent)).toBe(false);
    });

    it('should detect async code correctly', () => {
      const asyncContent = 'async function fetchData() { await api.get(); }';
      const promiseContent = 'function getData() { return Promise.resolve(); }';
      const syncContent = 'function helper() { return 42; }';
      
      expect(generator['hasAsyncCode'](asyncContent)).toBe(true);
      expect(generator['hasAsyncCode'](promiseContent)).toBe(true);
      expect(generator['hasAsyncCode'](syncContent)).toBe(false);
    });

    it('should generate mock file paths correctly', () => {
      const sourcePath = '/mock/project/src/services/api.js';
      const mockPath = generator['getMockFilePath'](sourcePath);
      expect(mockPath).toContain('__mocks__');
      expect(mockPath).toContain('services/api');
    });

    it('should generate mock content correctly', () => {
      const jsMockContent = generator['generateMockFileContent'](['axios', 'lodash']);
      expect(jsMockContent).toContain('jest.fn');
      expect(jsMockContent).toContain('axios');
      expect(jsMockContent).toContain('lodash');
    });

    it('should generate setup file names correctly', () => {
      const jsSetupFileName = generator['getSetupFileName']();
      expect(jsSetupFileName).toBe('setupTests.js');

      // Test Python setup file name
      const pyAnalysis = {
        ...mockAnalysis,
        languages: [{ name: 'python' as const, confidence: 90, files: ['test.py'] }]
      };
      const pyGenerator = new StructuralTestGenerator(config, pyAnalysis);
      const pySetupFileName = pyGenerator['getSetupFileName']();
      expect(pySetupFileName).toBe('conftest.py');
    });
  });
});