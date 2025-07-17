/**
 * Simple tests for React ES modules setup file generation methods
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { StructuralTestGenerator } from '../../src/generators/StructuralTestGenerator';
import { ProjectAnalysis } from '../../src/types/analysis-types';

describe('StructuralTestGenerator - React ES Modules Setup Methods', () => {
  let generator: StructuralTestGenerator;
  let mockAnalysis: ProjectAnalysis;

  beforeEach(() => {
    // Create mock analysis for React ES modules project
    mockAnalysis = {
      projectPath: '/test/project',
      languages: [{ name: 'javascript', confidence: 0.9, files: ['/test/project/src/App.jsx'] }],
      frameworks: [{ name: 'react', confidence: 0.9, configFiles: [] }],
      moduleSystem: { type: 'esm', hasPackageJsonType: true, packageJsonType: 'module', confidence: 0.9, fileExtensionPattern: 'js' },
      dependencies: { production: { react: '^18.0.0', 'react-dom': '^18.0.0' }, development: {}, python: undefined },
      packageManagers: [{ name: 'npm', confidence: 0.9, lockFiles: ['package-lock.json'] }],
      projectStructure: {
        rootFiles: ['package.json'],
        srcDirectory: '/test/project/src',
        testDirectories: [],
        configFiles: [],
        buildOutputs: [],
        entryPoints: ['/test/project/src/App.jsx'],
      },
      testingSetup: {
        hasTests: false,
        testFrameworks: ['jest'],
        testFiles: [],
        coverageTools: [],
      },
      complexity: {
        totalFiles: 1,
        totalLines: 100,
        averageFileSize: 100,
        largestFiles: [{ path: '/test/project/src/App.jsx', lines: 100 }],
      },
    };

    generator = new StructuralTestGenerator(
      {
        outputPath: '/test/output',
        projectPath: '/test/project',
        testFramework: 'jest',
        options: {
          namingConventions: {
            testFileSuffix: '.test',
          },
        },
      },
      mockAnalysis,
      {}
    );
  });

  it('should generate setupTests.mjs filename for ES modules project', () => {
    const setupFileName = generator['getSetupFileName']();
    expect(setupFileName).toBe('setupTests.mjs');
  });

  it('should generate setupTests.js filename for CommonJS project', () => {
    // Change to CommonJS
    mockAnalysis.moduleSystem = { type: 'commonjs', hasPackageJsonType: false, confidence: 0.9, fileExtensionPattern: 'js' };
    const commonjsGenerator = new StructuralTestGenerator(
      {
        outputPath: '/test/output',
        projectPath: '/test/project',
        options: {
          namingConventions: {
            testFileSuffix: '.test',
          },
        },
        testFramework: 'jest',
      },
      mockAnalysis,
      {}
    );

    const setupFileName = commonjsGenerator['getSetupFileName']();
    expect(setupFileName).toBe('setupTests.js');
  });

  it('should generate React setup content with ES modules imports', () => {
    const reactConfig = generator['generateReactConfig'](true);
    
    // Check for ES modules specific content
    expect(reactConfig).toContain('ES Modules compatible setup');
    expect(reactConfig).toContain("await import('@testing-library/jest-dom')");
    expect(reactConfig).toContain("const React = await import('react')");
    expect(reactConfig).toContain("const { cleanup } = await import('@testing-library/react')");
  });

  it('should generate React setup content with CommonJS imports', () => {
    // Change to CommonJS
    mockAnalysis.moduleSystem = { type: 'commonjs', hasPackageJsonType: false, confidence: 0.9, fileExtensionPattern: 'js' };
    const commonjsGenerator = new StructuralTestGenerator(
      {
        outputPath: '/test/output',
        projectPath: '/test/project',
        options: {
          namingConventions: {
            testFileSuffix: '.test',
          },
        },
        testFramework: 'jest',
      },
      mockAnalysis,
      {}
    );

    const reactConfig = commonjsGenerator['generateReactConfig'](true);
    
    // Check for CommonJS specific content
    expect(reactConfig).toContain('CommonJS setup');
    expect(reactConfig).toContain("require('@testing-library/jest-dom')");
    expect(reactConfig).toContain("const React = require('react')");
    expect(reactConfig).toContain("const { cleanup } = require('@testing-library/react')");
  });

  it('should include fetch polyfill in React setup', () => {
    const reactConfig = generator['generateReactConfig'](true);

    // Check for fetch polyfill
    expect(reactConfig).toContain('Polyfill for fetch API if not available');
    expect(reactConfig).toContain('globalThis.fetch = jest.fn');
    expect(reactConfig).toContain('globalThis.Headers');
    expect(reactConfig).toContain('globalThis.Request');
    expect(reactConfig).toContain('globalThis.Response');
  });

  it('should include React warning suppression', () => {
    const reactConfig = generator['generateReactConfig'](true);

    // Check for React warning suppression
    expect(reactConfig).toContain('Suppress React warnings in tests');
    expect(reactConfig).toContain('ReactDOM.render is no longer supported');
    expect(reactConfig).toContain('useLayoutEffect does nothing on the server');
    expect(reactConfig).toContain('not wrapped in act');
    expect(reactConfig).toContain("Can't perform a React state update on an unmounted component");
  });

  it('should include browser API mocks', () => {
    const reactConfig = generator['generateReactConfig'](true);

    // Check for browser API mocks
    expect(reactConfig).toContain('Mock window.matchMedia');
    expect(reactConfig).toContain('Mock IntersectionObserver');
    expect(reactConfig).toContain('Mock ResizeObserver');
    expect(reactConfig).toContain('React.useLayoutEffect = React.useEffect');
  });

  it('should not generate React setup for non-React projects', () => {
    const reactConfig = generator['generateReactConfig'](false);

    // Should return empty string for non-React projects
    expect(reactConfig).toBe('');
  });

  it('should generate JavaScript setup with ES modules mode annotation', () => {
    const setupContent = generator['generateJavaScriptTestSetup']();

    expect(setupContent).toContain('ES Modules Mode');
    expect(setupContent).toContain('Test setup and configuration');
    expect(setupContent).toContain('Generated by Claude Testing Infrastructure');
  });

  it('should generate JavaScript setup with CommonJS mode annotation', () => {
    // Change to CommonJS
    mockAnalysis.moduleSystem = { type: 'commonjs', hasPackageJsonType: false, confidence: 0.9, fileExtensionPattern: 'js' };
    const commonjsGenerator = new StructuralTestGenerator(
      {
        outputPath: '/test/output',
        projectPath: '/test/project',
        options: {
          namingConventions: {
            testFileSuffix: '.test',
          },
        },
        testFramework: 'jest',
      },
      mockAnalysis,
      {}
    );

    const setupContent = commonjsGenerator['generateJavaScriptTestSetup']();

    expect(setupContent).toContain('CommonJS Mode');
    expect(setupContent).toContain('Test setup and configuration');
    expect(setupContent).toContain('Generated by Claude Testing Infrastructure');
  });
});