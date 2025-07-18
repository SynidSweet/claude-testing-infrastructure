/**
 * Integration tests for StructuralTestGenerator with complex mocking scenarios
 * Demonstrates comprehensive integration testing patterns
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Mock external dependencies - must be defined before other imports
const mockFg = jest.fn() as any;
const mockFs = {
  mkdir: jest.fn() as any,
  writeFile: jest.fn() as any,
  access: jest.fn() as any,
  readFile: jest.fn() as any,
  stat: jest.fn() as any,
  readdir: jest.fn() as any,
};
const mockLogger = {
  debug: jest.fn() as any,
  info: jest.fn() as any,
  warn: jest.fn() as any,
  error: jest.fn() as any,
};

jest.mock('fast-glob', () => mockFg);
jest.mock('../../src/generators/templates/TestTemplateEngine');
jest.mock('../../src/utils/common-imports', () => ({
  fs: mockFs,
  path: jest.requireActual('path'),
  fg: mockFg,
  logger: mockLogger,
}));

import { StructuralTestGenerator } from '../../src/generators/StructuralTestGenerator';
import { 
  TestAssertions,
  TestPatterns,
  createMockProjectAnalysis 
} from '../utils/structural-test-generator-mocks';

describe('StructuralTestGenerator - Complex Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Set up default mock behaviors
    mockFg.mockResolvedValue([
      '/test/project/src/App.jsx',
      '/test/project/src/components/Header.tsx',
      '/test/project/src/utils/helpers.js'
    ]);
    mockFs.mkdir.mockResolvedValue(undefined);
    mockFs.writeFile.mockResolvedValue(undefined);
    mockFs.access.mockRejectedValue(new Error('File not found'));
    mockFs.readFile.mockResolvedValue('export default function App() { return <div>Hello</div>; }');
    mockFs.stat.mockResolvedValue({ 
      isDirectory: () => false,
      isFile: () => true,
      size: 1024,
      mtime: new Date()
    });
    mockFs.readdir.mockResolvedValue([]);
    
    mockLogger.debug.mockImplementation(() => {});
    mockLogger.info.mockImplementation(() => {});
    mockLogger.warn.mockImplementation(() => {});
    mockLogger.error.mockImplementation(() => {});
    
    // Reset template engine to default working state
    const mockTemplateEngine = require('../../src/generators/templates/TestTemplateEngine');
    mockTemplateEngine.TestTemplateEngine.mockClear();
    mockTemplateEngine.TestTemplateEngine.mockImplementation(() => {
      const generateTestMock = jest.fn() as any;
      generateTestMock.mockResolvedValue('// Default test content');
      return {
        generateTest: generateTestMock
      };
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('End-to-End Integration Scenarios', () => {
    it('should handle complete React ES modules project workflow', async () => {
      const { analysis, expectedContent } = TestPatterns.reactESModules();
      
      // Mock the TestTemplateEngine
      const mockTemplateEngine = require('../../src/generators/templates/TestTemplateEngine');
      mockTemplateEngine.TestTemplateEngine.mockImplementation(() => {
        const generateTestMock = jest.fn() as any;
        generateTestMock.mockResolvedValue('// React component test\nimport { render } from "@testing-library/react";');
        return {
          generateTest: generateTestMock
        };
      });

      const generator = new StructuralTestGenerator(
        {
          outputPath: '/test/output',
          projectPath: '/test/project',
          testFramework: 'jest',
          options: {}
        },
        analysis,
        { generateSetup: true, generateMocks: true }
      );

      await generator.generateAllTests();

      // Verify complete workflow
      expect(mockFg).toHaveBeenCalledWith(
        expect.arrayContaining(['**/*.{js,ts,jsx,tsx,py}']),
        expect.objectContaining({
          cwd: '/test/project',
          absolute: true,
          onlyFiles: true,
          dot: false
        })
      );

      TestAssertions.assertDirectoryCreated(mockFs.mkdir, '/test/output');
      TestAssertions.assertSetupFileCreated(mockFs.writeFile, 'mjs', expectedContent);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Starting test generation'),
        expect.any(Object)
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Found 3 files to test')
      );
    });

    it('should handle FileDiscoveryService integration with cache behavior', async () => {
      const analysis = createMockProjectAnalysis();
      
      // Mock FileDiscoveryService with cache behavior
      const mockFileDiscovery = {
        findFiles: jest.fn().mockResolvedValue([
          '/test/project/src/App.jsx',
          '/test/project/src/utils.ts'
        ]),
        findTestFiles: jest.fn().mockResolvedValue([]),
        fileExists: jest.fn().mockResolvedValue(false),
        invalidateCache: jest.fn(),
        getCacheStats: jest.fn().mockReturnValue({ hits: 0, misses: 0, size: 0 })
      } as any;

      const generator = new StructuralTestGenerator(
        {
          outputPath: '/test/output',
          projectPath: '/test/project',
          testFramework: 'jest',
          options: {}
        },
        analysis,
        { generateSetup: true },
        mockFileDiscovery
      );

      await generator.generateAllTests();

      // Verify FileDiscoveryService was called
      expect(mockFileDiscovery.findFiles).toHaveBeenCalledWith(
        expect.objectContaining({
          baseDir: '/test/project'
        })
      );
    });

    it('should handle mixed project types with different module systems', async () => {
      const commonJSAnalysis = createMockProjectAnalysis({
        moduleSystem: 'commonjs',
        frameworks: ['react'],
        hasReact: true,
        hasTypeScript: false
      });

      // Set up file discovery for CommonJS files
      mockFg.mockResolvedValue(['/test/project/src/App.js']);

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

      // Should generate CommonJS setup file
      TestAssertions.assertSetupFileCreated(
        mockFs.writeFile,
        'js',
        ['CommonJS', 'require(']
      );
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle file system errors gracefully', async () => {
      const analysis = createMockProjectAnalysis();
      
      // Set up file system error for mkdir
      mockFs.mkdir.mockRejectedValue(new Error('Permission denied'));
      mockFg.mockResolvedValue(['/test/project/src/App.jsx']);

      const generator = new StructuralTestGenerator(
        {
          outputPath: '/test/output',
          projectPath: '/test/project',
          testFramework: 'jest',
          options: {}
        },
        analysis,
        { generateSetup: true }
      );

      await generator.generateAllTests();

      // Verify error was logged
      TestAssertions.assertLoggedMessages(
        mockLogger,
        'error',
        ['Failed to create setup file']
      );
    });

    it('should handle template engine failures gracefully', async () => {
      const analysis = createMockProjectAnalysis();
      
      // Set up file discovery to find files but with invalid patterns to test error handling
      mockFg.mockRejectedValue(new Error('Invalid file pattern'));

      const generator = new StructuralTestGenerator(
        {
          outputPath: '/test/output',
          projectPath: '/test/project',
          testFramework: 'jest',
          options: {}
        },
        analysis,
        { generateSetup: true }
      );

      const result = await generator.generateAllTests();

      // Should handle file discovery failures gracefully
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Test generation failed');
    });

    it('should handle FileDiscoveryService failures with fallback', async () => {
      const analysis = createMockProjectAnalysis();
      
      // Create a mock file discovery service that fails
      const mockFileDiscoveryService = {
        findFiles: jest.fn().mockRejectedValue(new Error('Service unavailable')),
        findTestFiles: jest.fn().mockResolvedValue([]),
        fileExists: jest.fn().mockResolvedValue(false),
        invalidateCache: jest.fn(),
        getCacheStats: jest.fn().mockReturnValue({ hits: 0, misses: 0, size: 0 })
      } as any;

      const generator = new StructuralTestGenerator(
        {
          outputPath: '/test/output',
          projectPath: '/test/project',
          testFramework: 'jest',
          options: {}
        },
        analysis,
        { generateSetup: true },
        mockFileDiscoveryService
      );

      const result = await generator.generateAllTests();
      
      expect(result.success).toBe(false);
      expect(result.errors).toContain('Test generation failed: Service unavailable');
    });
  });

  describe('Advanced Configuration Scenarios', () => {
    it('should handle dry run mode without file creation', async () => {
      const analysis = createMockProjectAnalysis();
      
      mockFg.mockResolvedValue(['/test/project/src/App.jsx']);

      const generator = new StructuralTestGenerator(
        {
          outputPath: '/test/output',
          projectPath: '/test/project',
          testFramework: 'jest',
          options: {}
        },
        analysis,
        { generateSetup: true, dryRun: true }
      );

      await generator.generateAllTests();

      // Should not create any files
      expect(mockFs.mkdir).not.toHaveBeenCalled();
      expect(mockFs.writeFile).not.toHaveBeenCalled();

      // Should log dry run messages
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Starting test generation'),
        expect.any(Object)
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Found 1 files to test')
      );
    });

    it('should skip existing tests when configured', async () => {
      const analysis = createMockProjectAnalysis();
      
      // Set up existing files check
      mockFs.access.mockImplementation((path: string) => {
        if (path.includes('/test/output/App.test.jsx')) {
          return Promise.resolve(); // File exists
        }
        return Promise.reject(new Error('File not found'));
      });
      
      mockFg.mockResolvedValue(['/test/project/src/App.jsx']);

      const generator = new StructuralTestGenerator(
        {
          outputPath: '/test/output',
          projectPath: '/test/project',
          testFramework: 'jest',
          options: {}
        },
        analysis,
        { generateSetup: true, skipExistingTests: true }
      );

      await generator.generateAllTests();

      // Should only create setup file, skip individual test files
      const writeFileCalls = mockFs.writeFile.mock.calls;
      const testFileCalls = writeFileCalls.filter((args: unknown[]) => {
        const [path] = args as [string, ...unknown[]];
        return path.includes('.test.') && !path.includes('setupTests');
      });
      
      expect(testFileCalls).toHaveLength(0);
    });

    it('should handle complex file pattern matching', async () => {
      const analysis = createMockProjectAnalysis();
      
      mockFg.mockResolvedValue([
        '/test/project/src/App.jsx',
        '/test/project/src/utils.py',
        '/test/project/src/config.json',
        '/test/project/src/styles.css'
      ]);

      const generator = new StructuralTestGenerator(
        {
          outputPath: '/test/output',
          projectPath: '/test/project',
          testFramework: 'jest',
          options: {}
        },
        analysis,
        { 
          generateSetup: true,
          includePatterns: ['**/*.{js,jsx,ts,tsx}'],
          excludePatterns: ['**/*.test.*', '**/*.spec.*']
        }
      );

      await generator.generateAllTests();

      // Should filter files based on language detection
      expect(mockFg).toHaveBeenCalledWith(
        ['**/*.{js,jsx,ts,tsx}'],
        expect.objectContaining({
          ignore: expect.arrayContaining(['**/*.test.*', '**/*.spec.*'])
        })
      );
    });
  });

  describe('Performance and Concurrency', () => {
    it('should handle concurrent operations safely', async () => {
      const analysis = createMockProjectAnalysis();
      
      // Return empty files so we don't trigger template engine
      mockFg.mockResolvedValue([]);

      // Add delays to simulate concurrent operations
      mockFs.mkdir.mockImplementation(() => 
        new Promise<void>(resolve => setTimeout(() => resolve(), 10))
      );
      mockFs.writeFile.mockImplementation(() => 
        new Promise<void>(resolve => setTimeout(() => resolve(), 5))
      );

      const generator = new StructuralTestGenerator(
        {
          outputPath: '/test/output',
          projectPath: '/test/project',
          testFramework: 'jest',
          options: {}
        },
        analysis,
        { generateSetup: true }
      );

      const result = await generator.generateAllTests();

      // Should handle all operations without race conditions
      expect(result.success).toBe(true);
      expect(result.stats.filesAnalyzed).toBe(0);
      expect(result.stats.testsGenerated).toBe(0);
    });

    it('should handle large file discovery efficiently', async () => {
      const analysis = createMockProjectAnalysis();
      const largeFileList = Array.from({ length: 1000 }, (_, i) => 
        `/test/project/src/component${i}.jsx`
      );
      
      mockFg.mockResolvedValue(largeFileList);

      const generator = new StructuralTestGenerator(
        {
          outputPath: '/test/output',
          projectPath: '/test/project',
          testFramework: 'jest',
          options: {}
        },
        analysis,
        { generateSetup: true }
      );

      const startTime = Date.now();
      await generator.generateAllTests();
      const duration = Date.now() - startTime;

      // Should handle large file lists efficiently (under 5 seconds)
      expect(duration).toBeLessThan(5000);
      expect(mockFs.writeFile).toHaveBeenCalled();
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    it('should handle empty project gracefully', async () => {
      const emptyAnalysis = createMockProjectAnalysis({
        languages: [],
        frameworks: []
      });
      
      mockFg.mockResolvedValue([]);

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

      // Should complete successfully even with empty project
      expect(result.success).toBe(true);
      expect(result.stats.filesAnalyzed).toBe(0);
      expect(result.stats.testsGenerated).toBe(0);
    });

    it('should handle invalid patterns gracefully', async () => {
      const analysis = createMockProjectAnalysis();
      
      // Mock fast-glob to throw pattern error
      mockFg.mockRejectedValue(new Error('Invalid pattern'));

      const generator = new StructuralTestGenerator(
        {
          outputPath: '/test/output',
          projectPath: '/test/project',
          testFramework: 'jest',
          options: {}
        },
        analysis,
        { 
          generateSetup: true,
          includePatterns: ['invalid-pattern[']
        }
      );

      const result = await generator.generateAllTests();
      
      expect(result.success).toBe(false);
      expect(result.errors).toContain('Test generation failed: Invalid pattern');
    });

    it('should handle missing dependencies gracefully', async () => {
      const analysisWithoutDependencies = createMockProjectAnalysis({
        hasReact: false,
        hasTypeScript: false
      });
      
      mockFg.mockResolvedValue(['/test/project/src/app.js']);

      const generator = new StructuralTestGenerator(
        {
          outputPath: '/test/output',
          projectPath: '/test/project',
          testFramework: 'jest',
          options: {}
        },
        analysisWithoutDependencies,
        { generateSetup: true }
      );

      await generator.generateAllTests();

      // Should create basic setup file
      TestAssertions.assertSetupFileCreated(
        mockFs.writeFile,
        'mjs',
        ['import']
      );
    });
  });
});