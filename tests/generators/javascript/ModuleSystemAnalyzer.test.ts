import { ModuleSystemAnalyzer } from '../../../src/generators/javascript/analyzers/ModuleSystemAnalyzer';
import { fs } from '../../../src/utils/common-imports';

// Mock the common imports
jest.mock('../../../src/utils/common-imports', () => ({
  logger: {
    debug: jest.fn(),
    error: jest.fn(),
  },
  fs: {
    readFile: jest.fn(),
  },
  path: require('path'),
}));

// Mock fast-glob
jest.mock('fast-glob', () => ({
  default: jest.fn(),
}));

describe('ModuleSystemAnalyzer', () => {
  const mockProjectPath = '/test/project';
  const mockFs = fs as jest.Mocked<typeof fs>;
  let fastGlobMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset the fast-glob mock
    fastGlobMock = require('fast-glob').default;
  });

  describe('analyzeProject', () => {
    it('should detect ESM from package.json type field', async () => {
      const analyzer = new ModuleSystemAnalyzer({ projectPath: mockProjectPath });
      
      mockFs.readFile.mockResolvedValueOnce(JSON.stringify({
        type: 'module',
        dependencies: { express: '^4.0.0' }
      }));

      // Mock for detectFileExtensionPattern
      fastGlobMock.mockResolvedValueOnce(['/test/project/src/index.js']);

      const result = await analyzer.analyzeProject();

      expect(result).toEqual({
        type: 'esm',
        hasPackageJsonType: true,
        packageJsonType: 'module',
        confidence: 1.0,
        fileExtensionPattern: 'js',
      });
    });

    it('should detect CommonJS from package.json type field', async () => {
      const analyzer = new ModuleSystemAnalyzer({ projectPath: mockProjectPath });
      
      mockFs.readFile.mockResolvedValueOnce(JSON.stringify({
        type: 'commonjs',
        dependencies: { lodash: '^4.0.0' }
      }));

      // Mock for detectFileExtensionPattern
      fastGlobMock.mockResolvedValueOnce(['/test/project/src/index.js']);

      const result = await analyzer.analyzeProject();

      expect(result).toEqual({
        type: 'commonjs',
        hasPackageJsonType: true,
        packageJsonType: 'commonjs',
        confidence: 1.0,
        fileExtensionPattern: 'js',
      });
    });

    it('should analyze files when no type field in package.json', async () => {
      const analyzer = new ModuleSystemAnalyzer({ projectPath: mockProjectPath });
      
      // Mock package.json without type field
      mockFs.readFile.mockResolvedValueOnce(JSON.stringify({
        name: 'test-project',
        dependencies: {}
      }));

      // Mock finding source files
      fastGlobMock.mockResolvedValueOnce([
        '/test/project/src/index.js',
        '/test/project/src/utils.js',
      ]);

      // Mock file contents - ESM syntax (these will be read after glob finds files)
      mockFs.readFile
        .mockResolvedValueOnce('import express from "express";\nexport default app;')
        .mockResolvedValueOnce('export function util() { return true; }');

      // Mock finding source files again for detectFileExtensionPattern
      fastGlobMock.mockResolvedValueOnce([
        '/test/project/src/index.js',
        '/test/project/src/utils.js',
      ]);

      const result = await analyzer.analyzeProject();

      expect(result.type).toBe('esm');
      expect(result.hasPackageJsonType).toBe(false);
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    it('should detect mixed module systems', async () => {
      const analyzer = new ModuleSystemAnalyzer({ projectPath: mockProjectPath });
      
      // Mock no package.json
      mockFs.readFile.mockRejectedValueOnce(new Error('ENOENT'));

      // Mock finding source files
      fastGlobMock.mockResolvedValueOnce([
        '/test/project/src/esm.js',
        '/test/project/src/cjs.js',
        '/test/project/src/mixed.js',
      ]);

      // Mock file contents - mixed modules (these will be read after glob finds files)
      mockFs.readFile
        .mockResolvedValueOnce('import foo from "foo";\nexport default foo;')
        .mockResolvedValueOnce('const bar = require("bar");\nmodule.exports = bar;')
        .mockResolvedValueOnce('import baz from "baz";\nconst qux = require("qux");');

      // Mock finding source files again for detectFileExtensionPattern
      fastGlobMock.mockResolvedValueOnce([
        '/test/project/src/esm.js',
        '/test/project/src/cjs.js',
        '/test/project/src/mixed.js',
      ]);

      const result = await analyzer.analyzeProject();

      expect(result.type).toBe('mixed');
      expect(result.confidence).toBeLessThan(0.7);
    });

    it('should cache project analysis results', async () => {
      const analyzer = new ModuleSystemAnalyzer({ projectPath: mockProjectPath });
      
      mockFs.readFile.mockResolvedValueOnce(JSON.stringify({ type: 'module' }));

      const result1 = await analyzer.analyzeProject();
      const result2 = await analyzer.analyzeProject();

      expect(result1).toBe(result2); // Same reference
      expect(mockFs.readFile).toHaveBeenCalledTimes(1); // Only called once
    });
  });

  describe('analyzeFile', () => {
    it('should detect .mjs files as ESM', async () => {
      const analyzer = new ModuleSystemAnalyzer({ projectPath: mockProjectPath });
      
      // Mock project as CommonJS
      mockFs.readFile.mockResolvedValueOnce(JSON.stringify({ type: 'commonjs' }));

      const result = await analyzer.analyzeFile('/test/project/src/module.mjs');

      expect(result.fileModuleType).toBe('esm');
      expect(result.fileExtension).toBe('.mjs');
      expect(result.confidence).toBe(1.0);
    });

    it('should detect .cjs files as CommonJS', async () => {
      const analyzer = new ModuleSystemAnalyzer({ projectPath: mockProjectPath });
      
      // Mock project as ESM
      mockFs.readFile.mockResolvedValueOnce(JSON.stringify({ type: 'module' }));

      const result = await analyzer.analyzeFile('/test/project/src/module.cjs');

      expect(result.fileModuleType).toBe('commonjs');
      expect(result.fileExtension).toBe('.cjs');
      expect(result.confidence).toBe(1.0);
    });

    it('should analyze file content for module patterns', async () => {
      const analyzer = new ModuleSystemAnalyzer({ projectPath: mockProjectPath });
      
      // Mock project without type (for analyzeProject call)
      mockFs.readFile.mockResolvedValueOnce(JSON.stringify({ name: 'test' }));
      
      // Mock finding files for project analysis - empty array means early return, no detectFileExtensionPattern call
      fastGlobMock.mockResolvedValueOnce([]);
      
      // Mock file content with ESM syntax (for analyzeFile specific file read)
      mockFs.readFile.mockResolvedValueOnce(`import React from 'react';
import { useState } from 'react';

export default function Component() {
  return <div>Hello</div>;
}

export const helper = () => true;`);

      const result = await analyzer.analyzeFile('/test/project/src/component.js');

      expect(result.importStyle).toBe('import');
      expect(result.exportStyle).toBe('esm');
      expect(result.fileModuleType).toBe('esm');
    });

    it('should detect dynamic imports', async () => {
      const analyzer = new ModuleSystemAnalyzer({ projectPath: mockProjectPath });
      
      // Mock project without type (for analyzeProject call)
      mockFs.readFile.mockResolvedValueOnce(JSON.stringify({}));
      
      // Mock finding files for project analysis - empty array means early return, no detectFileExtensionPattern call
      fastGlobMock.mockResolvedValueOnce([]);
      
      // Mock file content with dynamic import (for analyzeFile specific file read)
      mockFs.readFile.mockResolvedValueOnce(`async function loadModule() {
  const module = await import('./dynamic-module');
  return module;
}`);

      const result = await analyzer.analyzeFile('/test/project/src/dynamic.js');

      expect(result.hasDynamicImports).toBe(true);
    });

    it('should handle mixed import/export styles', async () => {
      const analyzer = new ModuleSystemAnalyzer({ projectPath: mockProjectPath });
      
      // Mock project without type (for analyzeProject call)
      mockFs.readFile.mockResolvedValueOnce(JSON.stringify({}));
      
      // Mock finding files for project analysis - empty array means early return, no detectFileExtensionPattern call
      fastGlobMock.mockResolvedValueOnce([]);
      
      // Mock file content with mixed imports/exports (for analyzeFile specific file read)
      mockFs.readFile.mockResolvedValueOnce(`import foo from 'foo';
const bar = require('bar');

export default foo;
module.exports.bar = bar;`);

      const result = await analyzer.analyzeFile('/test/project/src/mixed.js');

      expect(result.importStyle).toBe('both');
      expect(result.exportStyle).toBe('both');
      expect(result.fileModuleType).toBe('mixed');
    });
  });

  describe('getImportSyntax', () => {
    it('should return import for ESM files', () => {
      const analyzer = new ModuleSystemAnalyzer({ projectPath: mockProjectPath });
      
      const moduleInfo = {
        type: 'commonjs' as const,
        fileModuleType: 'esm' as const,
        hasPackageJsonType: false,
        confidence: 1.0,
        fileExtensionPattern: 'js' as const,
      };

      expect(analyzer.getImportSyntax(moduleInfo)).toBe('import');
    });

    it('should return require for CommonJS files', () => {
      const analyzer = new ModuleSystemAnalyzer({ projectPath: mockProjectPath });
      
      const moduleInfo = {
        type: 'esm' as const,
        fileModuleType: 'commonjs' as const,
        hasPackageJsonType: false,
        confidence: 1.0,
        fileExtensionPattern: 'js' as const,
      };

      expect(analyzer.getImportSyntax(moduleInfo)).toBe('require');
    });

    it('should use project default when file type not specified', () => {
      const analyzer = new ModuleSystemAnalyzer({ projectPath: mockProjectPath });
      
      const esmProject = {
        type: 'esm' as const,
        hasPackageJsonType: true,
        confidence: 1.0,
        fileExtensionPattern: 'js' as const,
      };

      const cjsProject = {
        type: 'commonjs' as const,
        hasPackageJsonType: true,
        confidence: 1.0,
        fileExtensionPattern: 'js' as const,
      };

      expect(analyzer.getImportSyntax(esmProject)).toBe('import');
      expect(analyzer.getImportSyntax(cjsProject)).toBe('require');
    });
  });

  describe('getImportExtension', () => {
    it('should return .js extension for ESM JavaScript files', () => {
      const analyzer = new ModuleSystemAnalyzer({ projectPath: mockProjectPath });
      
      const moduleInfo = {
        type: 'esm' as const,
        fileExtension: '.js',
        hasPackageJsonType: true,
        confidence: 1.0,
        fileExtensionPattern: 'js' as const,
      };

      expect(analyzer.getImportExtension(moduleInfo)).toBe('.js');
    });

    it('should return empty extension for TypeScript files', () => {
      const analyzer = new ModuleSystemAnalyzer({ projectPath: mockProjectPath });
      
      const moduleInfo = {
        type: 'esm' as const,
        fileExtension: '.ts',
        hasPackageJsonType: true,
        confidence: 1.0,
        fileExtensionPattern: 'ts' as const,
      };

      expect(analyzer.getImportExtension(moduleInfo)).toBe('');
    });

    it('should return empty extension for CommonJS', () => {
      const analyzer = new ModuleSystemAnalyzer({ projectPath: mockProjectPath });
      
      const moduleInfo = {
        type: 'commonjs' as const,
        fileExtension: '.js',
        hasPackageJsonType: true,
        confidence: 1.0,
        fileExtensionPattern: 'js' as const,
      };

      expect(analyzer.getImportExtension(moduleInfo)).toBe('');
    });
  });

  describe('error handling', () => {
    it('should handle package.json read errors gracefully', async () => {
      const analyzer = new ModuleSystemAnalyzer({ projectPath: mockProjectPath });
      
      mockFs.readFile.mockRejectedValueOnce(new Error('ENOENT'));
      fastGlobMock.mockResolvedValueOnce([]);

      const result = await analyzer.analyzeProject();

      expect(result.type).toBe('commonjs');
      expect(result.confidence).toBe(0.5);
    });

    it('should handle file content read errors gracefully', async () => {
      const analyzer = new ModuleSystemAnalyzer({ projectPath: mockProjectPath });
      
      // Mock project without type (for analyzeProject call)
      mockFs.readFile.mockResolvedValueOnce(JSON.stringify({}));
      
      // Mock finding files for project analysis - will read files, but we'll make those fail
      fastGlobMock.mockResolvedValueOnce(['/test/project/src/sample.js']);
      
      // Mock file read failure during project analysis
      mockFs.readFile.mockRejectedValueOnce(new Error('EACCES'));
      
      // Mock finding files again for detectFileExtensionPattern
      fastGlobMock.mockResolvedValueOnce([]);
      
      // Reject when trying to read file content (for analyzeFile specific file read)
      mockFs.readFile.mockRejectedValueOnce(new Error('EACCES'));

      const result = await analyzer.analyzeFile('/test/project/src/error.js');

      // When file read fails, content analysis should not be performed
      expect(result).toBeDefined();
      expect(result.importStyle).toBeUndefined();
      expect(result.exportStyle).toBeUndefined();
    });
  });

  describe('options', () => {
    it('should skip file extension check when disabled', async () => {
      const analyzer = new ModuleSystemAnalyzer({ 
        projectPath: mockProjectPath,
        checkFileExtension: false 
      });
      
      // Mock project with explicit type (for analyzeProject call)
      mockFs.readFile.mockResolvedValueOnce(JSON.stringify({ type: 'commonjs' }));
      
      // Mock finding files for detectFileExtensionPattern call
      fastGlobMock.mockResolvedValueOnce([]);
      
      // Mock file content with ESM syntax (for analyzeFile specific file read)
      mockFs.readFile.mockResolvedValueOnce('import foo from "foo";\nexport default foo;');

      const result = await analyzer.analyzeFile('/test/project/src/module.mjs');

      // fileModuleType should be 'esm' from content analysis, not from .mjs extension
      expect(result.fileModuleType).toBe('esm');
      expect(result.type).toBe('commonjs'); // project default
    });

    it('should skip content analysis when disabled', async () => {
      const analyzer = new ModuleSystemAnalyzer({ 
        projectPath: mockProjectPath,
        analyzeContent: false 
      });
      
      mockFs.readFile.mockResolvedValueOnce(JSON.stringify({ type: 'module' }));

      const result = await analyzer.analyzeFile('/test/project/src/file.js');

      expect(result.importStyle).toBeUndefined();
      expect(result.exportStyle).toBeUndefined();
      expect(mockFs.readFile).toHaveBeenCalledTimes(1); // Only for package.json
    });
  });
});