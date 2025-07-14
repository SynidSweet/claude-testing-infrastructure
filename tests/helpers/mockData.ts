import { ProjectAnalysis, DetectedLanguage, DetectedFramework, DetectedPackageManager, ProjectStructure, Dependencies, TestingSetup, ComplexityMetrics } from '../../src/analyzers/ProjectAnalyzer';
import type { TestProjectAnalysisResult, MockProjectData } from '../types/test-data-interfaces';

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

export function createMockAnalysisResult(overrides?: Partial<TestProjectAnalysisResult>): TestProjectAnalysisResult {
  return {
    languages: [
      {
        name: 'javascript',
        confidence: 0.9,
        files: ['src/index.js', 'src/utils.js'],
        features: ['es6', 'modules']
      }
    ],
    frameworks: [
      {
        name: 'jest',
        confidence: 0.8,
        type: 'testing',
        files: ['jest.config.js'],
        config: {
          configFiles: ['jest.config.js'],
          entryPoints: ['src/index.js'],
          dependencies: ['jest'],
          scripts: { test: 'jest' }
        }
      }
    ],
    dependencies: [
      {
        name: 'jest',
        version: '^29.0.0',
        type: 'development',
        source: 'package.json'
      }
    ],
    complexity: {
      averageComplexity: 5.2,
      maxComplexity: 15,
      highComplexityFiles: [],
      totalFunctions: 10,
      totalClasses: 2,
      totalLines: 500
    },
    testCoverage: {
      percentage: 85,
      coveredLines: 425,
      totalLines: 500,
      uncoveredFiles: [],
      coverageByFile: []
    },
    structure: {
      rootPath: '/test/project',
      sourceDirectories: ['src'],
      testDirectories: ['tests'],
      configFiles: ['package.json', 'jest.config.js'],
      documentationFiles: ['README.md'],
      totalFiles: 15,
      structure: {
        name: 'project',
        path: '/test/project',
        type: 'directory',
        children: []
      }
    },
    ...overrides
  };
}

export function createMockProjectData(overrides?: Partial<MockProjectData>): MockProjectData {
  return {
    name: 'test-project',
    path: '/test/project',
    structure: {
      'src/index.js': {
        content: 'export const hello = () => "Hello World";',
        type: 'file'
      },
      'package.json': {
        content: JSON.stringify({
          name: 'test-project',
          version: '1.0.0',
          scripts: { test: 'jest' },
          devDependencies: { jest: '^29.0.0' }
        }, null, 2),
        type: 'file'
      }
    },
    packageJson: {
      name: 'test-project',
      version: '1.0.0',
      scripts: { test: 'jest' },
      devDependencies: { jest: '^29.0.0' }
    },
    ...overrides
  };
}