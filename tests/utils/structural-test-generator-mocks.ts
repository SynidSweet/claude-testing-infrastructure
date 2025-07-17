/**
 * Comprehensive mock utilities for StructuralTestGenerator testing
 * Provides type-safe mocks for complex integration testing scenarios
 */

import { jest } from '@jest/globals';
import { ProjectAnalysis } from '../../src/types/analysis-types';
import { FileDiscoveryService, FileDiscoveryType } from '../../src/types/file-discovery-types';
import { TestTemplateEngine } from '../../src/generators/templates/TestTemplateEngine';

/**
 * Mock file system operations with comprehensive fs.promises interface
 */
export function createMockFileSystem() {
  const mkdir = jest.fn() as any;
  const writeFile = jest.fn() as any;
  const access = jest.fn() as any;
  const readdir = jest.fn() as any;
  const readFile = jest.fn() as any;
  const stat = jest.fn() as any;
  const chmod = jest.fn() as any;
  const copyFile = jest.fn() as any;
  const unlink = jest.fn() as any;
  const rmdir = jest.fn() as any;
  const realpath = jest.fn() as any;
  const lstat = jest.fn() as any;
  const readlink = jest.fn() as any;
  const symlink = jest.fn() as any;
  const truncate = jest.fn() as any;
  const appendFile = jest.fn() as any;
  const utimes = jest.fn() as any;
  const rename = jest.fn() as any;
  const rm = jest.fn() as any;
  const cp = jest.fn() as any;

  // Set up default behaviors
  mkdir.mockResolvedValue(undefined);
  writeFile.mockResolvedValue(undefined);
  access.mockRejectedValue(new Error('File not found'));
  readdir.mockResolvedValue([]);
  readFile.mockResolvedValue('export default function App() { return <div>Hello</div>; }');
  stat.mockResolvedValue({ 
    isDirectory: () => false,
    isFile: () => true,
    size: 1024,
    mtime: new Date()
  });
  chmod.mockResolvedValue(undefined);
  copyFile.mockResolvedValue(undefined);
  unlink.mockResolvedValue(undefined);
  rmdir.mockResolvedValue(undefined);
  realpath.mockImplementation(async (path: any) => path);
  lstat.mockResolvedValue({ 
    isDirectory: () => false,
    isFile: () => true,
    isSymbolicLink: () => false
  });
  readlink.mockResolvedValue('');
  symlink.mockResolvedValue(undefined);
  truncate.mockResolvedValue(undefined);
  appendFile.mockResolvedValue(undefined);
  utimes.mockResolvedValue(undefined);
  rename.mockResolvedValue(undefined);
  rm.mockResolvedValue(undefined);
  cp.mockResolvedValue(undefined);

  return {
    mkdir,
    writeFile,
    access,
    readdir,
    readFile,
    stat,
    chmod,
    copyFile,
    unlink,
    rmdir,
    realpath,
    lstat,
    readlink,
    symlink,
    truncate,
    appendFile,
    utimes,
    rename,
    rm,
    cp,
    constants: {} as any,
    open: jest.fn() as any,
    close: jest.fn() as any,
    read: jest.fn() as any,
    write: jest.fn() as any,
    fsync: jest.fn() as any,
    fstat: jest.fn() as any,
    fchmod: jest.fn() as any,
    fchown: jest.fn() as any,
    futimes: jest.fn() as any,
    ftruncate: jest.fn() as any,
    opendir: jest.fn() as any,
    mkdtemp: jest.fn() as any,
    watch: jest.fn() as any,
    watchFile: jest.fn() as any,
    unwatchFile: jest.fn() as any,
    lutimes: jest.fn() as any,
    link: jest.fn() as any,
    chown: jest.fn() as any,
    lchown: jest.fn() as any,
    lchmod: jest.fn() as any,
  };
}

/**
 * Mock fast-glob with realistic file discovery patterns
 */
export function createMockFastGlob() {
  const fg = jest.fn() as any;
  fg.mockResolvedValue([
    '/test/project/src/App.jsx',
    '/test/project/src/components/Header.tsx',
    '/test/project/src/utils/helpers.js',
    '/test/project/src/services/api.ts'
  ]);
  return fg;
}

/**
 * Mock logger with comprehensive logging methods
 */
export function createMockLogger() {
  return {
    debug: jest.fn() as any,
    info: jest.fn() as any,
    warn: jest.fn() as any,
    error: jest.fn() as any,
    trace: jest.fn() as any,
    fatal: jest.fn() as any
  };
}

/**
 * Mock FileDiscoveryService with realistic discovery results
 */
export function createMockFileDiscoveryService(): jest.Mocked<FileDiscoveryService> {
  const findFiles = jest.fn() as any;
  const fileExists = jest.fn() as any;
  const invalidateCache = jest.fn() as any;
  const getCacheStats = jest.fn() as any;

  findFiles.mockResolvedValue({
    files: [
      '/test/project/src/App.jsx',
      '/test/project/src/components/Header.tsx',
      '/test/project/src/utils/helpers.js'
    ],
    fromCache: false,
    duration: 125,
    stats: {
      totalScanned: 3,
      included: 3,
      excluded: 0,
      languageFiltered: 0
    }
  });
  
  fileExists.mockResolvedValue(false);
  
  getCacheStats.mockResolvedValue({
    cacheSize: 256,
    hitRate: 0.75,
    lastUpdated: new Date()
  });

  return {
    findFiles,
    fileExists,
    invalidateCache,
    getCacheStats
  } as any;
}

/**
 * Mock TestTemplateEngine with configurable behavior
 */
export function createMockTestTemplateEngine() {
  const mockEngine = {
    generateTest: jest.fn() as any,
    getAvailableTemplates: jest.fn() as any,
    validateTemplate: jest.fn() as any
  };
  
  // Set up default behaviors
  mockEngine.generateTest.mockReturnValue('// Mock generated test content');
  mockEngine.getAvailableTemplates.mockReturnValue(['unit', 'integration']);
  mockEngine.validateTemplate.mockReturnValue(true);

  (TestTemplateEngine as jest.MockedClass<typeof TestTemplateEngine>).mockImplementation(
    () => mockEngine as any
  );

  return mockEngine;
}

/**
 * Create comprehensive mock project analysis
 */
export function createMockProjectAnalysis(options: {
  moduleSystem?: 'esm' | 'commonjs';
  frameworks?: string[];
  languages?: string[];
  hasReact?: boolean;
  hasTypeScript?: boolean;
} = {}): ProjectAnalysis {
  const {
    moduleSystem = 'esm',
    frameworks = ['react'],
    languages = ['javascript', 'typescript'],
    hasReact = true,
    hasTypeScript = true
  } = options;

  return {
    projectPath: '/test/project',
    languages: languages.map(lang => ({
      name: lang as 'javascript' | 'typescript' | 'python',
      confidence: 0.9,
      files: [`/test/project/src/app.${lang === 'typescript' ? 'tsx' : 'jsx'}`]
    })),
    frameworks: frameworks.map(framework => ({
      name: framework as 'react' | 'vue' | 'angular' | 'express' | 'fastapi' | 'django' | 'flask' | 'nextjs' | 'nuxt' | 'svelte' | 'mcp-server' | 'fastmcp',
      confidence: 0.9,
      configFiles: []
    })),
    packageManagers: [{ name: 'npm', confidence: 0.9, lockFiles: [] }],
    projectStructure: {
      rootFiles: ['package.json', hasTypeScript ? 'tsconfig.json' : undefined].filter(Boolean) as string[],
      srcDirectory: '/test/project/src',
      testDirectories: ['/test/project/tests'],
      configFiles: ['/test/project/jest.config.js'],
      buildOutputs: ['/test/project/dist'],
      entryPoints: ['/test/project/src/App.jsx']
    },
    dependencies: {
      production: hasReact ? { 
        react: '^18.0.0', 
        'react-dom': '^18.0.0' 
      } : {},
      development: {
        ...(hasReact ? {
          '@testing-library/react': '^13.0.0',
          '@testing-library/jest-dom': '^5.0.0'
        } : {}),
        jest: '^29.0.0',
        ...(hasTypeScript ? { typescript: '^5.0.0' } : {})
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
      totalFiles: 3,
      totalLines: 300,
      averageFileSize: 100,
      largestFiles: []
    },
    moduleSystem: {
      type: moduleSystem,
      hasPackageJsonType: true,
      packageJsonType: moduleSystem === 'esm' ? 'module' : 'commonjs',
      confidence: 0.9,
      fileExtensionPattern: 'js'
    },
    projectType: 'standard'
  };
}

/**
 * Create mock setup for common-imports module
 */
export function createMockCommonImports() {
  const mockFs = createMockFileSystem();
  const mockFg = createMockFastGlob();
  const mockLogger = createMockLogger();

  return {
    fs: mockFs,
    path: require('path'),
    fg: mockFg,
    logger: mockLogger
  };
}

/**
 * Test scenario builder for complex mocking scenarios
 */
export class MockScenarioBuilder {
  private fs: ReturnType<typeof createMockFileSystem>;
  private fg: ReturnType<typeof createMockFastGlob>;
  private logger: ReturnType<typeof createMockLogger>;
  private fileDiscovery: jest.Mocked<FileDiscoveryService>;
  private templateEngine: ReturnType<typeof createMockTestTemplateEngine>;

  constructor() {
    this.fs = createMockFileSystem();
    this.fg = createMockFastGlob();
    this.logger = createMockLogger();
    this.fileDiscovery = createMockFileDiscoveryService();
    this.templateEngine = createMockTestTemplateEngine();
  }

  /**
   * Configure file system to simulate errors
   */
  withFileSystemErrors(errorType: 'mkdir' | 'writeFile' | 'access' | 'readFile') {
    switch (errorType) {
      case 'mkdir':
        this.fs.mkdir.mockRejectedValue(new Error('Permission denied'));
        break;
      case 'writeFile':
        this.fs.writeFile.mockRejectedValue(new Error('Disk full'));
        break;
      case 'access':
        this.fs.access.mockRejectedValue(new Error('File not found'));
        break;
      case 'readFile':
        this.fs.readFile.mockRejectedValue(new Error('File corrupted'));
        break;
    }
    return this;
  }

  /**
   * Configure existing files to simulate skip behavior
   */
  withExistingFiles(filePaths: string[]) {
    this.fs.access.mockImplementation(async (path: any) => {
      if (filePaths.some(fp => path.includes(fp))) {
        return undefined;
      }
      throw new Error('File not found');
    });
    return this;
  }

  /**
   * Configure fast-glob to return specific files
   */
  withDiscoveredFiles(files: string[]) {
    this.fg.mockResolvedValue(files);
    return this;
  }

  /**
   * Configure FileDiscoveryService behavior
   */
  withFileDiscoveryService(config: {
    files?: string[];
    fromCache?: boolean;
    duration?: number;
    error?: Error;
  }) {
    if (config.error) {
      this.fileDiscovery.findFiles.mockRejectedValue(config.error);
    } else {
      this.fileDiscovery.findFiles.mockResolvedValue({
        files: config.files || [],
        fromCache: config.fromCache || false,
        duration: config.duration || 100,
        stats: {
          totalScanned: config.files?.length || 0,
          included: config.files?.length || 0,
          excluded: 0,
          languageFiltered: 0
        }
      });
    }
    return this;
  }

  /**
   * Configure template engine behavior
   */
  withTemplateEngine(config: {
    generateTest?: string;
    shouldError?: boolean;
    errorMessage?: string;
  }) {
    if (config.shouldError) {
      this.templateEngine.generateTest.mockImplementation(() => {
        throw new Error(config.errorMessage || 'Template generation failed');
      });
    } else {
      this.templateEngine.generateTest.mockReturnValue(
        config.generateTest || '// Mock generated test content'
      );
    }
    return this;
  }

  /**
   * Build the complete mock scenario
   */
  build() {
    return {
      fs: this.fs,
      fg: this.fg,
      logger: this.logger,
      fileDiscovery: this.fileDiscovery,
      templateEngine: this.templateEngine,
      commonImports: {
        fs: this.fs,
        path: require('path'),
        fg: this.fg,
        logger: this.logger
      }
    };
  }
}

/**
 * Test utilities for assertion patterns
 */
export class TestAssertions {
  /**
   * Assert that setup file was created with correct content
   */
  static assertSetupFileCreated(
    writeFileMock: jest.Mock,
    expectedExtension: 'js' | 'mjs',
    expectedContent: string[]
  ) {
    const writeFileCalls = writeFileMock.mock.calls;
    const setupFileCall = writeFileCalls.find((args: unknown[]) => {
      const [path] = args as [string, ...unknown[]];
      return path.includes(`setupTests.${expectedExtension}`);
    });
    
    expect(setupFileCall).toBeDefined();
    
    const setupContent = setupFileCall![1] as string;
    expectedContent.forEach(content => {
      expect(setupContent).toContain(content);
    });
  }

  /**
   * Assert that directory was created recursively
   */
  static assertDirectoryCreated(mkdirMock: jest.Mock, expectedPath: string) {
    expect(mkdirMock).toHaveBeenCalledWith(
      expect.stringContaining(expectedPath),
      { recursive: true }
    );
  }

  /**
   * Assert that logger was called with expected messages
   */
  static assertLoggedMessages(
    loggerMock: { debug: jest.Mock; info: jest.Mock; warn: jest.Mock; error: jest.Mock },
    level: 'debug' | 'info' | 'warn' | 'error',
    expectedMessages: string[]
  ) {
    expectedMessages.forEach(message => {
      expect(loggerMock[level]).toHaveBeenCalledWith(
        expect.stringContaining(message),
        expect.any(Object)
      );
    });
  }

  /**
   * Assert that FileDiscoveryService was called with correct parameters
   */
  static assertFileDiscoveryServiceCalled(
    servicesMock: jest.Mocked<FileDiscoveryService>,
    expectedParams: {
      baseDir: string;
      type: FileDiscoveryType;
      languages: string[];
      absolute: boolean;
      useCache: boolean;
    }
  ) {
    expect(servicesMock.findFiles).toHaveBeenCalledWith(expectedParams);
  }
}

/**
 * Common test patterns for integration scenarios
 */
export const TestPatterns = {
  /**
   * Standard React ES modules project test pattern
   */
  reactESModules: () => ({
    analysis: createMockProjectAnalysis({
      moduleSystem: 'esm',
      frameworks: ['react'],
      languages: ['javascript', 'typescript'],
      hasReact: true,
      hasTypeScript: true
    }),
    expectedSetupFile: 'setupTests.mjs',
    expectedContent: ['ES Modules', 'React', 'await import']
  }),

  /**
   * Standard React CommonJS project test pattern
   */
  reactCommonJS: () => ({
    analysis: createMockProjectAnalysis({
      moduleSystem: 'commonjs',
      frameworks: ['react'],
      languages: ['javascript'],
      hasReact: true,
      hasTypeScript: false
    }),
    expectedSetupFile: 'setupTests.js',
    expectedContent: ['CommonJS', 'React', 'require(']
  }),

  /**
   * Non-React project test pattern
   */
  nonReactProject: () => ({
    analysis: createMockProjectAnalysis({
      moduleSystem: 'esm',
      frameworks: [],
      languages: ['javascript'],
      hasReact: false,
      hasTypeScript: false
    }),
    expectedSetupFile: 'setupTests.mjs',
    expectedContent: ['ES Modules', 'Basic setup']
  })
};