import { ProjectAnalysis, DetectedLanguage, DetectedFramework, DetectedPackageManager, ProjectStructure, Dependencies, TestingSetup, ComplexityMetrics } from '../../src/analyzers/ProjectAnalyzer';

export function createMockProjectAnalysis(overrides: Partial<ProjectAnalysis> = {}): ProjectAnalysis {
  const defaults: ProjectAnalysis = {
    projectPath: '/test/project',
    languages: [{
      name: 'javascript',
      confidence: 0.9,
      files: ['src/index.js']
    }],
    frameworks: [],
    packageManagers: [{
      name: 'npm',
      confidence: 0.9,
      lockFiles: ['package-lock.json']
    }],
    projectStructure: {
      rootFiles: ['package.json', 'README.md'],
      srcDirectory: 'src',
      testDirectories: [],
      configFiles: ['package.json'],
      buildOutputs: ['dist'],
      entryPoints: ['src/index.js']
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
      totalFiles: 10,
      totalLines: 1000,
      averageFileSize: 100,
      largestFiles: []
    },
    moduleSystem: {
      type: 'commonjs',
      hasPackageJsonType: false,
      confidence: 0.8,
      fileExtensionPattern: 'js'
    }
  };

  return { ...defaults, ...overrides };
}

export function createMockLanguage(overrides: Partial<DetectedLanguage> = {}): DetectedLanguage {
  const base = {
    name: 'javascript' as const,
    confidence: 0.9,
    files: ['src/index.js']
  };
  return { ...base, ...overrides };
}

export function createMockFramework(overrides: Partial<DetectedFramework> = {}): DetectedFramework {
  return {
    name: 'react',
    confidence: 0.8,
    version: '18.0.0',
    configFiles: ['package.json'],
    ...overrides
  };
}

export function createMockPackageManager(overrides: Partial<DetectedPackageManager> = {}): DetectedPackageManager {
  return {
    name: 'npm',
    confidence: 0.9,
    lockFiles: ['package-lock.json'],
    ...overrides
  };
}

export function createMockProjectStructure(overrides: Partial<ProjectStructure> = {}): ProjectStructure {
  return {
    rootFiles: ['package.json', 'README.md'],
    srcDirectory: 'src',
    testDirectories: [],
    configFiles: ['package.json'],
    buildOutputs: ['dist'],
    entryPoints: ['src/index.js'],
    ...overrides
  };
}

export function createMockDependencies(overrides: Partial<Dependencies> = {}): Dependencies {
  return {
    production: {},
    development: {},
    python: undefined,
    ...overrides
  };
}

export function createMockTestingSetup(overrides: Partial<TestingSetup> = {}): TestingSetup {
  return {
    hasTests: false,
    testFrameworks: [],
    testFiles: [],
    coverageTools: [],
    ...overrides
  };
}

export function createMockComplexityMetrics(overrides: Partial<ComplexityMetrics> = {}): ComplexityMetrics {
  return {
    totalFiles: 10,
    totalLines: 1000,
    averageFileSize: 100,
    largestFiles: [],
    ...overrides
  };
}