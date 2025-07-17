/**
 * Tests for React ES modules setup file generation
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { StructuralTestGenerator } from '../../src/generators/StructuralTestGenerator';
import { ProjectAnalysis } from '../../src/types/analysis-types';

// Import the mocked common-imports module to access the mocked fs
const { fs } = require('../../src/utils/common-imports');

// Mock dependencies
jest.mock('fast-glob');

// Mock the common-imports module since that's what StructuralTestGenerator actually uses
jest.mock('../../src/utils/common-imports', () => ({
  fs: {
    mkdir: jest.fn(() => Promise.resolve()),
    writeFile: jest.fn(() => Promise.resolve()),
    access: jest.fn(() => Promise.reject(new Error('File not found'))),
    readdir: jest.fn(() => Promise.resolve([])),
    readFile: jest.fn(() => Promise.resolve('import React from "react";\n\nexport default function App() {\n  return <div>Hello</div>;\n}'))
  },
  path: require('path'),
  fg: jest.fn(() => Promise.resolve(['/test/project/src/App.jsx'])),
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

describe('StructuralTestGenerator - React ES Modules Setup', () => {
  let mockAnalysis: ProjectAnalysis;

  const createGenerator = (analysis: ProjectAnalysis) => {
    return new StructuralTestGenerator(
      {
        outputPath: '/test/output',
        projectPath: '/test/project',
        testFramework: 'jest',
        options: {
          generateMocks: true,
          includeSetupTeardown: true,
          generateTestData: false,
          addCoverage: false,
          skipValidation: false
        }
      },
      analysis,
      { generateSetup: true }  // options - enable setup file generation
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock analysis for React ES modules project
    mockAnalysis = {
      projectPath: '/test/project',
      languages: [{ name: 'javascript', confidence: 0.9, files: ['/test/project/src/App.jsx'] }],
      frameworks: [{ name: 'react', confidence: 0.9, configFiles: [] }],
      packageManagers: [],
      projectStructure: {
        rootFiles: [],
        srcDirectory: '/test/project/src',
        testDirectories: [],
        configFiles: [],
        buildOutputs: [],
        entryPoints: ['/test/project/src/App.jsx']
      },
      dependencies: {
        production: { react: '^18.0.0', 'react-dom': '^18.0.0' },
        development: {},
        python: undefined
      },
      testingSetup: {
        hasTests: false,
        testFrameworks: ['jest'],
        testFiles: [],
        coverageTools: []
      },
      complexity: {
        totalFiles: 1,
        totalLines: 100,
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

    // Template engine is created internally by StructuralTestGenerator
  });

  it('should generate setupTests.mjs for ES modules React project', async () => {
    const generator = createGenerator(mockAnalysis);
    await generator.generateAllTests();

    // Check that a setup file was created with correct extension and content
    const writeFileCalls = (fs.writeFile as jest.MockedFunction<typeof fs.writeFile>).mock.calls;
    const setupFileCall = writeFileCalls.find((call: unknown[]) => 
      typeof call[0] === 'string' && call[0].includes('setupTests.mjs')
    );
    
    expect(setupFileCall).toBeDefined();
    expect(setupFileCall![1]).toContain('ES Modules Mode');
  });

  it('should include ES modules compatible imports in React setup', async () => {
    const generator = createGenerator(mockAnalysis);
    await generator.generateAllTests();

    const setupFileCall = (fs.writeFile as jest.Mock).mock.calls.find(
      (call: unknown[]) => typeof call[0] === 'string' && call[0].includes('setupTests.mjs')
    );

    expect(setupFileCall).toBeDefined();
    const setupContent = setupFileCall![1];

    // Check for ES modules syntax
    expect(setupContent).toContain('ES Modules compatible setup');
    expect(setupContent).toContain("await import('@testing-library/jest-dom')");
    expect(setupContent).toContain("const React = await import('react')");
    expect(setupContent).toContain("const { cleanup } = await import('@testing-library/react')");
  });

  it('should generate setupTests.js for CommonJS React project', async () => {
    // Change to CommonJS
    mockAnalysis.moduleSystem.type = 'commonjs';
    mockAnalysis.moduleSystem.hasPackageJsonType = false;
    delete mockAnalysis.moduleSystem.packageJsonType;

    const generator = createGenerator(mockAnalysis);
    await generator.generateAllTests();

    // Check that the correct setup file was created
    const writeFileCalls = (fs.writeFile as jest.MockedFunction<typeof fs.writeFile>).mock.calls;
    const setupFileCall = writeFileCalls.find((call: [string, string, ...unknown[]]) => 
      call[0].includes('setupTests.js')
    );
    
    expect(setupFileCall).toBeDefined();
    expect(setupFileCall![1]).toContain('CommonJS Mode');
  });

  it('should include CommonJS compatible imports in React setup', async () => {
    // Change to CommonJS
    mockAnalysis.moduleSystem.type = 'commonjs';
    mockAnalysis.moduleSystem.hasPackageJsonType = false;
    delete mockAnalysis.moduleSystem.packageJsonType;

    const generator = createGenerator(mockAnalysis);
    await generator.generateAllTests();

    const setupFileCall = (fs.writeFile as jest.Mock).mock.calls.find(
      (call: unknown[]) => typeof call[0] === 'string' && call[0].includes('setupTests.js')
    );

    expect(setupFileCall).toBeDefined();
    const setupContent = setupFileCall![1];

    // Check for CommonJS syntax
    expect(setupContent).toContain('CommonJS setup');
    expect(setupContent).toContain("require('@testing-library/jest-dom')");
    expect(setupContent).toContain("const React = require('react')");
    expect(setupContent).toContain("const { cleanup } = require('@testing-library/react')");
  });

  it('should include fetch polyfill in React setup', async () => {
    const generator = createGenerator(mockAnalysis);
    await generator.generateAllTests();

    const setupFileCall = (fs.writeFile as jest.Mock).mock.calls.find(
      (call: unknown[]) => typeof call[0] === 'string' && call[0].includes('setupTests.mjs')
    );

    expect(setupFileCall).toBeDefined();
    const setupContent = setupFileCall![1];

    // Check for fetch polyfill
    expect(setupContent).toContain('Polyfill for fetch API if not available');
    expect(setupContent).toContain('globalThis.fetch = jest.fn');
    expect(setupContent).toContain('globalThis.Headers');
    expect(setupContent).toContain('globalThis.Request');
    expect(setupContent).toContain('globalThis.Response');
  });

  it('should include React warning suppression in setup', async () => {
    const generator = createGenerator(mockAnalysis);
    await generator.generateAllTests();

    const setupFileCall = (fs.writeFile as jest.Mock).mock.calls.find(
      (call: unknown[]) => typeof call[0] === 'string' && call[0].includes('setupTests.mjs')
    );

    expect(setupFileCall).toBeDefined();
    const setupContent = setupFileCall![1];

    // Check for React warning suppression
    expect(setupContent).toContain('Suppress React warnings in tests');
    expect(setupContent).toContain('ReactDOM.render is no longer supported');
    expect(setupContent).toContain('useLayoutEffect does nothing on the server');
    expect(setupContent).toContain('not wrapped in act');
    expect(setupContent).toContain("Can't perform a React state update on an unmounted component");
  });

  it('should include browser API mocks in React setup', async () => {
    const generator = createGenerator(mockAnalysis);
    await generator.generateAllTests();

    const setupFileCall = (fs.writeFile as jest.Mock).mock.calls.find(
      (call: unknown[]) => typeof call[0] === 'string' && call[0].includes('setupTests.mjs')
    );

    expect(setupFileCall).toBeDefined();
    const setupContent = setupFileCall![1];

    // Check for browser API mocks
    expect(setupContent).toContain('Mock window.matchMedia');
    expect(setupContent).toContain('Mock IntersectionObserver');
    expect(setupContent).toContain('Mock ResizeObserver');
    expect(setupContent).toContain('React.useLayoutEffect = React.useEffect');
  });

  it('should not generate React setup for non-React projects', async () => {
    // Remove React from frameworks
    mockAnalysis.frameworks = [];

    const generator = createGenerator(mockAnalysis);
    await generator.generateAllTests();

    const setupFileCall = (fs.writeFile as jest.Mock).mock.calls.find(
      (call: unknown[]) => typeof call[0] === 'string' && call[0].includes('setupTests')
    );

    expect(setupFileCall).toBeDefined();
    const setupContent = setupFileCall![1];

    // Should not contain React-specific setup
    expect(setupContent).not.toContain('React testing configuration');
    expect(setupContent).not.toContain('@testing-library/react');
    expect(setupContent).not.toContain('IntersectionObserver');
  });
});