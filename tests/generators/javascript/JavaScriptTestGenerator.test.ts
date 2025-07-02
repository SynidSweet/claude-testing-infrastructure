import { JavaScriptTestGenerator } from '../../../src/generators/javascript/JavaScriptTestGenerator';
import type { ProjectAnalysis } from '../../../src/analyzers/ProjectAnalyzer';
import type { TestGeneratorConfig } from '../../../src/generators/TestGenerator';
import { TestType } from '../../../src/generators/TestGenerator';
import type { LanguageContext } from '../../../src/generators/base/BaseTestGenerator';
import { fs } from '../../../src/utils/common-imports';

// Mock dependencies
jest.mock('../../../src/utils/common-imports', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
  fs: {
    readFile: jest.fn(),
    writeFile: jest.fn(),
    mkdir: jest.fn(),
  },
  path: require('path'),
}));

// Set up manual mock for fast-glob
jest.mock('fast-glob', () => {
  const mockFg = jest.fn();
  // Support both default export and named export patterns
  (mockFg as any).default = mockFg;
  return mockFg;
});

// Mock dynamic import for fast-glob to return our mock
const mockFg = jest.fn();
(mockFg as any).default = mockFg;
jest.doMock('fast-glob', () => {
  return {
    default: mockFg,
    __esModule: true,
  };
});

describe('JavaScriptTestGenerator', () => {
  let generator: JavaScriptTestGenerator;
  let mockConfig: TestGeneratorConfig;
  let mockAnalysis: ProjectAnalysis;
  let mockLanguageContext: LanguageContext;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();

    mockConfig = {
      projectPath: '/test/project',
      outputPath: '/test/project/.claude-testing',
      testFramework: 'jest',
      options: {},
      patterns: {
        include: ['**/*.js', '**/*.jsx'],
        exclude: ['**/dist/**'],
      },
    };

    mockAnalysis = {
      projectPath: '/test/project',
      languages: [
        { 
          name: 'javascript' as const, 
          files: ['/test/project/src/index.js'],
          confidence: 0.95
        }
      ],
      frameworks: [{ name: 'express' as const, confidence: 0.9, configFiles: ['package.json'] }],
      packageManagers: [{ name: 'npm' as const, confidence: 1.0, lockFiles: ['package-lock.json'] }],
      projectStructure: {
        rootFiles: ['package.json', 'index.js'],
        srcDirectory: 'src',
        testDirectories: [],
        configFiles: ['package.json'],
        buildOutputs: ['dist'],
        entryPoints: ['index.js'],
      },
      dependencies: {
        production: {},
        development: {},
        python: undefined,
      },
      testingSetup: {
        hasTests: false,
        testFrameworks: [],
        testFiles: [],
        coverageTools: [],
      },
      complexity: {
        totalFiles: 10,
        totalLines: 1000,
        averageFileSize: 100,
        largestFiles: [{ path: 'src/server.js', lines: 300 }],
      },
      moduleSystem: {
        type: 'commonjs' as const,
        hasPackageJsonType: false,
        confidence: 0.8,
        fileExtensionPattern: 'js' as const,
      },
    } as ProjectAnalysis;

    mockLanguageContext = {
      language: 'javascript',
      framework: 'express',
      moduleSystem: 'commonjs',
      testFramework: 'jest',
      features: {
        supportsAsync: true,
        hasDecorators: false,
        hasTypeAnnotations: false,
        testingPatterns: [
          { name: 'unit', applicable: true, templateKey: 'unit' },
        ],
        assertionStyle: 'expect',
      },
      testFileExtension: '.test.js',
      importStyle: {
        importSyntax: 'require',
        exportSyntax: 'module.exports',
        useFileExtensions: false,
      },
    };

    generator = new JavaScriptTestGenerator(mockConfig, mockAnalysis, mockLanguageContext);
  });

  describe('constructor', () => {
    it('should initialize with correct configuration', () => {
      expect(generator).toBeInstanceOf(JavaScriptTestGenerator);
      expect(generator.getLanguageContext()).toEqual(mockLanguageContext);
      expect(generator.getConfig()).toEqual(mockConfig);
      expect(generator.getAnalysis()).toEqual(mockAnalysis);
    });

    it('should build JavaScript context correctly', () => {
      expect(generator.getFramework()).toBe('jest');
      expect(generator.getLanguageContext().language).toBe('javascript');
    });
  });

  describe('getFilesToTest', () => {
    it('should find JavaScript files to test', async () => {
      const mockFiles = [
        '/test/project/src/index.js',
        '/test/project/src/utils.js',
        '/test/project/src/api/routes.js',
      ];

      mockFg.mockResolvedValue(mockFiles);

      const files = await (generator as any).getFilesToTest();

      expect(files).toEqual(mockFiles);
      expect(mockFg).toHaveBeenCalledWith(
        expect.arrayContaining([
          '/test/project/**/*.js',
          '/test/project/**/*.jsx',
          '/test/project/**/*.mjs',
        ]),
        expect.objectContaining({
          ignore: expect.arrayContaining([
            '**/node_modules/**',
            '**/dist/**',
            '**/*.test.*',
            '**/*.spec.*',
          ]),
          absolute: true,
          onlyFiles: true,
        })
      );
    });

    it('should include TypeScript extensions when TypeScript is detected', async () => {
      const tsContext: LanguageContext = {
        ...mockLanguageContext,
        language: 'typescript',
      };

      const tsGenerator = new JavaScriptTestGenerator(
        mockConfig,
        mockAnalysis,
        tsContext
      );

      const mockFiles = ['/test/project/src/index.ts'];
      mockFg.mockResolvedValue(mockFiles);

      await (tsGenerator as any).getFilesToTest();

      expect(mockFg).toHaveBeenCalledWith(
        expect.arrayContaining([
          '/test/project/**/*.js',
          '/test/project/**/*.jsx',
          '/test/project/**/*.mjs',
          '/test/project/**/*.ts',
          '/test/project/**/*.tsx',
        ]),
        expect.any(Object)
      );
    });
  });

  describe('generateTestForFile', () => {
    beforeEach(() => {
      (fs.readFile as jest.Mock).mockResolvedValue(`
        const express = require('express');
        
        function createApp() {
          const app = express();
          return app;
        }
        
        async function startServer(port) {
          const app = createApp();
          await app.listen(port);
          return app;
        }
        
        module.exports = { createApp, startServer };
      `);
    });

    it('should generate test for a valid JavaScript file', async () => {
      const filePath = '/test/project/src/server.js';
      const result = await (generator as any).generateTestForFile(filePath);

      expect(result).not.toBeNull();
      expect(result).toBeDefined();
      expect(result.sourcePath).toBe(filePath);
      expect(result.testPath).toBe('/test/project/.claude-testing/src/server.test.js');
      expect(result.testType).toBe(TestType.UNIT);
      expect(result.framework).toBe('jest');
      expect(result.content).toContain("const { createApp, startServer } = require('../../src/server');");
      expect(result.content).toContain("describe('server.js', () => {");
      expect(result.content).toContain("describe('createApp', () => {");
      expect(result.content).toContain("describe('startServer', () => {");
    });

    it('should skip test files', async () => {
      const testFile = '/test/project/src/server.test.js';
      const result = await (generator as any).generateTestForFile(testFile);

      expect(result).toBeNull();
      expect(fs.readFile).not.toHaveBeenCalled();
    });

    it('should skip files with no exports', async () => {
      (fs.readFile as jest.Mock).mockResolvedValue(`
        // Just some side effects
        console.log('Loading...');
      `);

      const filePath = '/test/project/src/sideEffects.js';
      const result = await (generator as any).generateTestForFile(filePath);

      expect(result).toBeNull();
    });
  });

  describe('analyzeSourceFile', () => {
    it('should analyze CommonJS exports correctly', async () => {
      (fs.readFile as jest.Mock).mockResolvedValue(`
        const helper = require('./helper');
        
        function processData(data) {
          return data.map(item => item * 2);
        }
        
        async function fetchData(url) {
          const response = await fetch(url);
          return response.json();
        }
        
        class DataProcessor {
          process(data) {
            return processData(data);
          }
        }
        
        module.exports = {
          processData,
          fetchData,
          DataProcessor
        };
      `);

      const analysis = await (generator as any).analyzeSourceFile('/test/project/src/processor.js');

      expect(analysis.filePath).toBe('/test/project/src/processor.js');
      expect(analysis.language).toBe('javascript');
      expect(analysis.fileType).toBe('module');
      expect(analysis.hasAsync).toBe(true);
      expect(analysis.exports).toHaveLength(3);
      
      const processDataExport = analysis.exports.find((e: any) => e.name === 'processData');
      expect(processDataExport).toEqual({
        name: 'processData',
        type: 'function',
        isDefault: false,
        isAsync: false,
      });

      const fetchDataExport = analysis.exports.find((e: any) => e.name === 'fetchData');
      expect(fetchDataExport).toEqual({
        name: 'fetchData',
        type: 'function',
        isDefault: false,
        isAsync: true,
      });

      const dataProcessorExport = analysis.exports.find((e: any) => e.name === 'DataProcessor');
      expect(dataProcessorExport).toEqual({
        name: 'DataProcessor',
        type: 'class',
        isDefault: false,
        isAsync: false,
      });
    });

    it('should analyze ES module exports correctly', async () => {
      const esmContext: LanguageContext = {
        ...mockLanguageContext,
        moduleSystem: 'esm',
        importStyle: {
          importSyntax: 'import',
          exportSyntax: 'export',
          useFileExtensions: true,
          importExtension: '.js',
        },
      };

      const esmGenerator = new JavaScriptTestGenerator(
        mockConfig,
        { ...mockAnalysis, moduleSystem: { type: 'esm' as const, hasPackageJsonType: true, confidence: 1, fileExtensionPattern: 'mjs' as const } },
        esmContext
      );

      (fs.readFile as jest.Mock).mockResolvedValue(`
        import { helper } from './helper.js';
        
        export function processData(data) {
          return data.map(item => item * 2);
        }
        
        export default class DataManager {
          constructor() {
            this.data = [];
          }
        }
        
        export const CONFIG = {
          apiUrl: 'https://api.example.com'
        };
      `);

      const analysis = await (esmGenerator as any).analyzeSourceFile('/test/project/src/manager.js');

      expect(analysis.exports).toHaveLength(3);
      
      const defaultExport = analysis.exports.find((e: any) => e.isDefault);
      expect(defaultExport?.name).toBe('DataManager');
      expect(defaultExport?.type).toBe('class');

      const processDataExport = analysis.exports.find((e: any) => e.name === 'processData');
      expect(processDataExport?.isDefault).toBe(false);

      const configExport = analysis.exports.find((e: any) => e.name === 'CONFIG');
      expect(configExport?.type).toBe('const');
    });
  });

  describe('generateTestContent', () => {
    it('should generate correct test content for CommonJS', async () => {
      const analysis = {
        filePath: '/test/project/src/utils.js',
        language: 'javascript',
        fileType: 'util',
        exports: [
          { name: 'formatDate', type: 'function' as const, isDefault: false },
          { name: 'parseJSON', type: 'function' as const, isDefault: false, isAsync: true },
        ],
        imports: [],
        hasAsync: true,
      };

      const content = await (generator as any).generateTestContent('default', analysis);

      expect(content).toContain("const { formatDate, parseJSON } = require('../../src/utils');");
      expect(content).toContain("describe('utils.js', () => {");
      expect(content).toContain("describe('formatDate', () => {");
      expect(content).toContain("it('should be a function', () => {");
      expect(content).toContain("expect(typeof formatDate).toBe('function');");
      expect(content).toContain("describe('parseJSON', () => {");
      expect(content).toContain("it('should handle async operations', async () => {");
    });

    it('should generate correct test content for ES modules', async () => {
      const esmContext: LanguageContext = {
        ...mockLanguageContext,
        moduleSystem: 'esm',
        importStyle: {
          importSyntax: 'import',
          exportSyntax: 'export',
          useFileExtensions: true,
          importExtension: '.js',
        },
      };

      const esmGenerator = new JavaScriptTestGenerator(
        mockConfig,
        { ...mockAnalysis, moduleSystem: { type: 'esm' as const, hasPackageJsonType: true, confidence: 1, fileExtensionPattern: 'mjs' as const } },
        esmContext
      );

      const analysis = {
        filePath: '/test/project/src/helpers.js',
        language: 'javascript',
        fileType: 'util',
        exports: [
          { name: 'Helper', type: 'class' as const, isDefault: true },
          { name: 'helperFunction', type: 'function' as const, isDefault: false },
        ],
        imports: [],
        hasAsync: false,
      };

      const content = await (esmGenerator as any).generateTestContent('default', analysis);

      expect(content).toContain("import Helper, { helperFunction } from '../../src/helpers.js';");
      expect(content).toContain("describe('helpers.js', () => {");
      expect(content).toContain("describe('Helper', () => {");
      expect(content).toContain("it('should be instantiable', () => {");
    });
  });

  describe('detectFileType', () => {
    it('should detect React components', () => {
      const reactContext: LanguageContext = {
        ...mockLanguageContext,
        framework: 'react',
      };

      const reactGenerator = new JavaScriptTestGenerator(
        mockConfig,
        mockAnalysis,
        reactContext
      );

      const content = `import React from 'react';\nexport default function Button() {}`;
      const fileType = (reactGenerator as any).detectFileType('/test/Button.jsx', content);
      
      expect(fileType).toBe('component');
    });

    it('should detect API/route files', () => {
      const fileType = (generator as any).detectFileType('/test/api.routes.js', '');
      expect(fileType).toBe('api');
    });

    it('should detect service files', () => {
      const fileType = (generator as any).detectFileType('/test/user.service.js', '');
      expect(fileType).toBe('service');
    });

    it('should detect utility files', () => {
      const fileType = (generator as any).detectFileType('/test/string.utils.js', '');
      expect(fileType).toBe('util');
    });

    it('should default to module for other files', () => {
      const fileType = (generator as any).detectFileType('/test/index.js', '');
      expect(fileType).toBe('module');
    });
  });

  describe('error handling', () => {
    it('should handle file read errors gracefully', async () => {
      (fs.readFile as jest.Mock).mockRejectedValue(new Error('File not found'));

      const filePath = '/test/project/src/missing.js';
      const result = await (generator as any).generateTestForFile(filePath);
      
      expect(result).toBeNull();
    });

    it('should handle glob errors gracefully', async () => {
      mockFg.mockRejectedValue(new Error('Glob pattern error'));

      await expect((generator as any).getFilesToTest()).rejects.toThrow('Glob pattern error');
    });
  });
});