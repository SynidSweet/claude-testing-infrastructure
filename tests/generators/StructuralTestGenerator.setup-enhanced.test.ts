/**
 * Enhanced tests for StructuralTestGenerator setup file generation
 * Addresses complex mocking requirements for integration testing
 */

// Set up global mocks at the top BEFORE any imports to ensure they're available
const mockFg = jest.fn() as any;
const mockFs = {
  mkdir: jest.fn() as any,
  writeFile: jest.fn() as any,
  access: jest.fn() as any,
  readdir: jest.fn() as any,
  readFile: jest.fn() as any,
  stat: jest.fn() as any,
  chmod: jest.fn() as any,
  copyFile: jest.fn() as any,
  unlink: jest.fn() as any,
  rmdir: jest.fn() as any,
  realpath: jest.fn() as any,
  lstat: jest.fn() as any,
  readlink: jest.fn() as any,
  symlink: jest.fn() as any,
  truncate: jest.fn() as any,
  appendFile: jest.fn() as any,
  utimes: jest.fn() as any,
  rename: jest.fn() as any,
  rm: jest.fn() as any,
  cp: jest.fn() as any,
  constants: {},
  open: jest.fn() as any,
};

const mockLogger = {
  debug: jest.fn() as any,
  info: jest.fn() as any,
  warn: jest.fn() as any,
  error: jest.fn() as any
};

// Mock all external dependencies
jest.mock('fast-glob', () => mockFg);
jest.mock('../../src/generators/templates/TestTemplateEngine');
jest.mock('../../src/utils/common-imports', () => ({
  fs: mockFs,
  path: require('path'),
  fg: mockFg,
  logger: mockLogger
}));

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { StructuralTestGenerator } from '../../src/generators/StructuralTestGenerator';
import { ProjectAnalysis } from '../../src/types/analysis-types';
import { FileDiscoveryService, FileDiscoveryType } from '../../src/types/file-discovery-types';
import { TestTemplateEngine } from '../../src/generators/templates/TestTemplateEngine';

// Create comprehensive mocks for complex dependencies
describe('StructuralTestGenerator - Enhanced Setup Tests', () => {
  let mockAnalysis: ProjectAnalysis;
  let mockFileDiscoveryService: jest.Mocked<FileDiscoveryService>;

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();

    // Set up default behaviors for global mocks
    mockFs.mkdir.mockResolvedValue(undefined);
    mockFs.writeFile.mockResolvedValue(undefined);
    mockFs.access.mockRejectedValue(new Error('File not found'));
    mockFs.readdir.mockResolvedValue([]);
    mockFs.readFile.mockResolvedValue('export default function App() { return <div>Hello</div>; }');
    mockFs.stat.mockResolvedValue({ isDirectory: () => false } as any);
    mockFs.chmod.mockResolvedValue(undefined);
    mockFs.copyFile.mockResolvedValue(undefined);
    mockFs.unlink.mockResolvedValue(undefined);
    mockFs.rmdir.mockResolvedValue(undefined);
    mockFs.realpath.mockImplementation(async (path: any) => path);
    mockFs.lstat.mockResolvedValue({ isDirectory: () => false } as any);
    mockFs.readlink.mockResolvedValue('');
    mockFs.symlink.mockResolvedValue(undefined);
    mockFs.truncate.mockResolvedValue(undefined);
    mockFs.appendFile.mockResolvedValue(undefined);
    mockFs.utimes.mockResolvedValue(undefined);
    mockFs.rename.mockResolvedValue(undefined);
    mockFs.rm.mockResolvedValue(undefined);
    mockFs.cp.mockResolvedValue(undefined);

    // Mock fast-glob
    mockFg.mockResolvedValue([
      '/test/project/src/App.jsx',
      '/test/project/src/components/Header.tsx',
      '/test/project/src/utils/helpers.js'
    ]);

    // Mock FileDiscoveryService
    mockFileDiscoveryService = {
      findFiles: jest.fn() as any,
      fileExists: jest.fn() as any,
      invalidateCache: jest.fn() as any,
      getCacheStats: jest.fn() as any
    } as any;
    
    // Set up default behaviors for FileDiscoveryService
    mockFileDiscoveryService.findFiles.mockResolvedValue({
      files: [
        '/test/project/src/App.jsx',
        '/test/project/src/components/Header.tsx'
      ],
      fromCache: false,
      duration: 150,
      stats: {
        totalScanned: 2,
        included: 2,
        excluded: 0,
        languageFiltered: 0
      }
    });
    mockFileDiscoveryService.fileExists.mockResolvedValue(false);
    (mockFileDiscoveryService.getCacheStats as any).mockResolvedValue({
      cacheSize: 0,
      hitRate: 0.0,
      lastUpdated: new Date()
    });

    // Mock TestTemplateEngine
    const mockTemplateEngine = {
      generateTest: jest.fn() as any
    };
    mockTemplateEngine.generateTest.mockReturnValue('// Mock generated test content');
    (TestTemplateEngine as jest.MockedClass<typeof TestTemplateEngine>).mockImplementation(
      () => mockTemplateEngine as any
    );

    // Create comprehensive mock project analysis
    mockAnalysis = {
      projectPath: '/test/project',
      languages: [
        { name: 'javascript', confidence: 0.9, files: ['/test/project/src/App.jsx'] },
        { name: 'typescript', confidence: 0.8, files: ['/test/project/src/components/Header.tsx'] }
      ],
      frameworks: [{ name: 'react', confidence: 0.9, configFiles: [] }],
      packageManagers: [{ name: 'npm', confidence: 0.9, lockFiles: [] }],
      projectStructure: {
        rootFiles: ['package.json', 'tsconfig.json'],
        srcDirectory: '/test/project/src',
        testDirectories: ['/test/project/tests'],
        configFiles: ['/test/project/jest.config.js'],
        buildOutputs: ['/test/project/dist'],
        entryPoints: ['/test/project/src/App.jsx']
      },
      dependencies: {
        production: { 
          react: '^18.0.0', 
          'react-dom': '^18.0.0' 
        },
        development: {
          '@testing-library/react': '^13.0.0',
          '@testing-library/jest-dom': '^5.0.0',
          jest: '^29.0.0'
        },
        python: undefined
      },
      testingSetup: {
        hasTests: false,
        testFrameworks: ['jest'],
        testFiles: [],
        coverageTools: []
      },
      complexity: {
        totalFiles: 2,
        totalLines: 200,
        averageFileSize: 100,
        largestFiles: []
      },
      moduleSystem: {
        type: 'esm',
        hasPackageJsonType: true,
        packageJsonType: 'module',
        confidence: 0.9,
        fileExtensionPattern: 'js'
      },
      projectType: 'standard'
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('File System Operations', () => {
    it('should create directory recursively before writing setup file', async () => {
      const generator = new StructuralTestGenerator(
        {
          outputPath: '/test/output',
          projectPath: '/test/project',
          testFramework: 'jest',
          options: {}
        },
        mockAnalysis,
        { generateSetup: true }
      );

      await generator.generateAllTests();

      expect(mockFs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('/test/output'),
        { recursive: true }
      );
    });

    it('should handle file system errors gracefully during setup generation', async () => {
      mockFs.mkdir.mockRejectedValue(new Error('Permission denied'));

      const generator = new StructuralTestGenerator(
        {
          outputPath: '/test/output',
          projectPath: '/test/project',
          testFramework: 'jest',
          options: {}
        },
        mockAnalysis,
        { generateSetup: true }
      );

      await generator.generateAllTests();

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to create setup file'),
        expect.objectContaining({ error: expect.any(Error) })
      );
    });

    it('should skip file creation in dry run mode', async () => {
      const generator = new StructuralTestGenerator(
        {
          outputPath: '/test/output',
          projectPath: '/test/project',
          testFramework: 'jest',
          options: {}
        },
        mockAnalysis,
        { generateSetup: true, dryRun: true }
      );

      await generator.generateAllTests();

      expect(mockFs.mkdir).not.toHaveBeenCalled();
      expect(mockFs.writeFile).not.toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Dry run: would generate setup file')
      );
    });

    it('should log success when setup file creation succeeds', async () => {
      const generator = new StructuralTestGenerator(
        {
          outputPath: '/test/output',
          projectPath: '/test/project',
          testFramework: 'jest',
          options: {}
        },
        mockAnalysis,
        { generateSetup: true }
      );

      await generator.generateAllTests();

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Generated setup file')
      );
    });
  });

  describe('Fast-Glob Integration', () => {
    it('should call fast-glob with correct options for file discovery', async () => {
      const generator = new StructuralTestGenerator(
        {
          outputPath: '/test/output',
          projectPath: '/test/project',
          testFramework: 'jest',
          options: {}
        },
        mockAnalysis,
        { generateSetup: true }
      );

      await generator.generateAllTests();

      expect(mockFg).toHaveBeenCalledWith(
        expect.arrayContaining(['**/*.{js,ts,jsx,tsx,py}']),
        expect.objectContaining({
          cwd: '/test/project',
          absolute: true,
          onlyFiles: true,
          dot: false,
          ignore: expect.arrayContaining([
            '**/*.test.*',
            '**/*.spec.*',
            '**/node_modules/**'
          ])
        })
      );
    });

    it('should handle fast-glob errors gracefully', async () => {
      mockFg.mockRejectedValue(new Error('Pattern matching failed'));

      const generator = new StructuralTestGenerator(
        {
          outputPath: '/test/output',
          projectPath: '/test/project',
          testFramework: 'jest',
          options: {}
        },
        mockAnalysis,
        { generateSetup: true }
      );

      const result = await generator.generateAllTests();
      
      // Should handle the error gracefully and return error info
      expect(result.success).toBe(false);
      expect(result.errors).toContain('Test generation failed: Pattern matching failed');
    });

    it('should filter files based on detected language extensions', async () => {
      // Mock fast-glob to return files with various extensions
      mockFg.mockResolvedValue([
        '/test/project/src/App.jsx',
        '/test/project/src/utils.py',
        '/test/project/src/config.json',
        '/test/project/src/component.tsx'
      ]);

      const generator = new StructuralTestGenerator(
        {
          outputPath: '/test/output',
          projectPath: '/test/project',
          testFramework: 'jest',
          options: {}
        },
        mockAnalysis,
        { generateSetup: true }
      );

      const result = await generator.generateAllTests();

      // Should only process JavaScript/TypeScript files based on analysis
      expect(result.success).toBe(true);
      expect(result.tests).toHaveLength(2); // Only JS/TS files processed
      
      // Check that the generated tests have the correct file extensions
      const testPaths = result.tests.map(t => t.testPath);
      expect(testPaths.some(path => path.includes('App.component.test.js'))).toBe(true);
      expect(testPaths.some(path => path.includes('component.component.test.ts'))).toBe(true);
    });
  });

  describe('FileDiscoveryService Integration', () => {
    it('should use FileDiscoveryService when provided', async () => {
      const generator = new StructuralTestGenerator(
        {
          outputPath: '/test/output',
          projectPath: '/test/project',
          testFramework: 'jest',
          options: {}
        },
        mockAnalysis,
        { generateSetup: true },
        mockFileDiscoveryService
      );

      await generator.generateAllTests();

      expect(mockFileDiscoveryService.findFiles).toHaveBeenCalledWith({
        baseDir: '/test/project',
        type: FileDiscoveryType.TEST_GENERATION,
        languages: ['javascript', 'typescript'],
        absolute: true,
        useCache: true
      });
    });

    it('should log cache statistics when using FileDiscoveryService', async () => {
      const generator = new StructuralTestGenerator(
        {
          outputPath: '/test/output',
          projectPath: '/test/project',
          testFramework: 'jest',
          options: {}
        },
        mockAnalysis,
        { generateSetup: true },
        mockFileDiscoveryService
      );

      await generator.generateAllTests();

      // Check that the FileDiscoveryService was called and debug logging occurred
      expect(mockFileDiscoveryService.findFiles).toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('FileDiscoveryService found'),
        expect.objectContaining({
          fromCache: false,
          duration: 150
        })
      );
    });

    it('should handle FileDiscoveryService errors gracefully', async () => {
      mockFileDiscoveryService.findFiles.mockRejectedValue(new Error('Service unavailable'));

      const generator = new StructuralTestGenerator(
        {
          outputPath: '/test/output',
          projectPath: '/test/project',
          testFramework: 'jest',
          options: {}
        },
        mockAnalysis,
        { generateSetup: true },
        mockFileDiscoveryService
      );

      const result = await generator.generateAllTests();
      
      // Should handle the error gracefully and return error info
      expect(result.success).toBe(false);
      expect(result.errors).toContain('Test generation failed: Service unavailable');
    });
  });

  describe('TestTemplateEngine Integration', () => {
    it('should instantiate TestTemplateEngine with correct configuration', async () => {
      const generator = new StructuralTestGenerator(
        {
          outputPath: '/test/output',
          projectPath: '/test/project',
          testFramework: 'jest',
          options: {}
        },
        mockAnalysis,
        { generateSetup: true }
      );

      const result = await generator.generateAllTests();

      // Check that the TestTemplateEngine was instantiated and tests were generated
      expect(TestTemplateEngine).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.tests.length).toBeGreaterThan(0);
    });

    it('should handle TestTemplateEngine errors gracefully', async () => {
      const mockTemplateEngine = {
        generateTest: jest.fn() as any
      };
      mockTemplateEngine.generateTest.mockImplementation(() => {
        throw new Error('Template generation failed');
      });
      (TestTemplateEngine as jest.MockedClass<typeof TestTemplateEngine>).mockImplementation(
        () => mockTemplateEngine as any
      );

      const generator = new StructuralTestGenerator(
        {
          outputPath: '/test/output',
          projectPath: '/test/project',
          testFramework: 'jest',
          options: {}
        },
        mockAnalysis,
        { generateSetup: true }
      );

      await generator.generateAllTests();

      // Should continue with other files despite template engine failure
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Template generation failed'),
        expect.objectContaining({
          error: expect.any(Error)
        })
      );
    });
  });

  describe('Integration Test Scenarios', () => {
    it('should generate complete test suite with setup files', async () => {
      const generator = new StructuralTestGenerator(
        {
          outputPath: '/test/output',
          projectPath: '/test/project',
          testFramework: 'jest',
          options: {}
        },
        mockAnalysis,
        { generateSetup: true, generateMocks: true }
      );

      await generator.generateAllTests();

      // Verify complete workflow
      expect(mockFg).toHaveBeenCalled();
      expect(mockFs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('/test/output'),
        { recursive: true }
      );
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('setupTests.mjs'),
        expect.stringContaining('ES Modules')
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Generated setup file')
      );
    });

    it('should handle mixed CommonJS and ES modules projects', async () => {
      const commonJSAnalysis = {
        ...mockAnalysis,
        moduleSystem: {
          type: 'commonjs' as const,
          hasPackageJsonType: true,
          packageJsonType: 'commonjs' as const,
          confidence: 0.9,
          fileExtensionPattern: 'js' as const
        }
      };

      const generator = new StructuralTestGenerator(
        {
          outputPath: '/test/output',
          projectPath: '/test/project',
          testFramework: 'jest',
          options: {}
        },
        commonJSAnalysis,
        { generateSetup: true }
      );

      await generator.generateAllTests();

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('setupTests.js'),
        expect.stringContaining('CommonJS')
      );
    });

    it('should skip existing tests when configured', async () => {
      mockFs.access.mockResolvedValue(undefined); // File exists

      const generator = new StructuralTestGenerator(
        {
          outputPath: '/test/output',
          projectPath: '/test/project',
          testFramework: 'jest',
          options: {}
        },
        mockAnalysis,
        { generateSetup: true, skipExistingTests: true }
      );

      await generator.generateAllTests();

      // Should only create setup file, not individual test files
      const writeFileCalls = (mockFs.writeFile as jest.Mock).mock.calls;
      const testFileCalls = writeFileCalls.filter((call: any) => 
        call[0].includes('.test.') && !call[0].includes('setupTests')
      );
      
      expect(testFileCalls).toHaveLength(0);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty project analysis gracefully', async () => {
      const emptyAnalysis = {
        ...mockAnalysis,
        languages: [],
        frameworks: []
      };

      const generator = new StructuralTestGenerator(
        {
          outputPath: '/test/output',
          projectPath: '/test/project',
          testFramework: 'jest',
          options: {}
        },
        emptyAnalysis,
        { generateSetup: true }
      );

      const result = await generator.generateAllTests();

      // Should still generate some output, but with empty analysis no setup file is created
      expect(result.success).toBe(true);
      expect(result.tests).toHaveLength(0);
      // With empty languages, no setup file should be created
      expect(mockFs.writeFile).not.toHaveBeenCalledWith(
        expect.stringContaining('setupTests'),
        expect.any(String)
      );
    });

    it('should handle concurrent file operations safely', async () => {
      (mockFs.mkdir as any).mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 50))
      );

      const generator = new StructuralTestGenerator(
        {
          outputPath: '/test/output',
          projectPath: '/test/project',
          testFramework: 'jest',
          options: {}
        },
        mockAnalysis,
        { generateSetup: true }
      );

      await generator.generateAllTests();

      expect(mockFs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('/test/output'),
        { recursive: true }
      );
    });

    it('should validate patterns before file discovery', async () => {
      const generator = new StructuralTestGenerator(
        {
          outputPath: '/test/output',
          projectPath: '/test/project',
          testFramework: 'jest',
          options: {}
        },
        mockAnalysis,
        { 
          generateSetup: true,
          includePatterns: ['invalid-pattern['],
          excludePatterns: ['another-invalid-pattern[']
        }
      );

      const result = await generator.generateAllTests();
      
      // Should handle invalid patterns gracefully
      expect(result.success).toBe(true);
      expect(result.tests.length).toBeGreaterThan(0);
    });
  });
});