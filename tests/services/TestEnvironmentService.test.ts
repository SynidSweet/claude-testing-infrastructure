import { TestEnvironmentService, TestEnvironmentConfig } from '../../src/services/TestEnvironmentService';
import type { ProjectAnalysis } from '../../src/analyzers/ProjectAnalyzer';
import type { TestGeneratorConfig, TestGeneratorOptions } from '../../src/generators/TestGenerator';
import { fs, path } from '../../src/utils/common-imports';
import os from 'os';

// Mock fs operations
jest.mock('../../src/utils/common-imports', () => ({
  fs: {
    mkdir: jest.fn(),
    access: jest.fn(),
    writeFile: jest.fn(),
  },
  path: {
    join: jest.requireActual('path').join,
    basename: jest.requireActual('path').basename,
  },
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('TestEnvironmentService', () => {
  let mockAnalysis: ProjectAnalysis;
  let mockConfig: TestGeneratorConfig;
  let service: TestEnvironmentService;
  let testOutputPath: string;

  beforeEach(() => {
    jest.clearAllMocks();
    
    testOutputPath = path.join(os.tmpdir(), 'test-env-service-test');
    
    mockAnalysis = {
      projectPath: '/mock/project',
      languages: [
        { name: 'javascript', version: '1.0', confidence: 0.9, files: ['index.js'] }
      ],
      frameworks: [
        { name: 'react', version: '18.0.0', confidence: 0.8, configFiles: ['package.json'] }
      ],
      packageManagers: [
        { name: 'npm', confidence: 0.9, lockFiles: ['package-lock.json'] }
      ],
      projectStructure: {
        rootFiles: ['package.json'],
        srcDirectory: 'src',
        testDirectories: ['tests'],
        configFiles: [],
        buildOutputs: [],
        entryPoints: ['index.js']
      },
      dependencies: {
        production: {},
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
        totalFiles: 10,
        totalLines: 500,
        averageFileSize: 50,
        largestFiles: []
      },
      moduleSystem: {
        type: 'esm',
        hasPackageJsonType: true,
        packageJsonType: 'module',
        confidence: 0.9,
        fileExtensionPattern: 'js'
      }
    } as ProjectAnalysis;

    mockConfig = {
      projectPath: '/mock/project',
      outputPath: testOutputPath,
      testFramework: 'jest',
      options: {
        generateMocks: false,
        includeSetupTeardown: false,
        generateTestData: false,
        addCoverage: false
      } as TestGeneratorOptions,
      patterns: {
        include: ['**/*.js'],
        exclude: ['node_modules/**']
      }
    } as TestGeneratorConfig;
  });

  describe('constructor', () => {
    it('should initialize with valid configuration', () => {
      const environmentConfig: TestEnvironmentConfig = {
        analysis: mockAnalysis,
        config: mockConfig,
        dryRun: false
      };

      service = new TestEnvironmentService(environmentConfig);
      expect(service).toBeInstanceOf(TestEnvironmentService);
    });

    it('should default dryRun to false when not provided', () => {
      const environmentConfig: TestEnvironmentConfig = {
        analysis: mockAnalysis,
        config: mockConfig
      };

      service = new TestEnvironmentService(environmentConfig);
      expect(service).toBeInstanceOf(TestEnvironmentService);
    });

    it('should accept dryRun flag', () => {
      const environmentConfig: TestEnvironmentConfig = {
        analysis: mockAnalysis,
        config: mockConfig,
        dryRun: true
      };

      service = new TestEnvironmentService(environmentConfig);
      expect(service).toBeInstanceOf(TestEnvironmentService);
    });
  });

  describe('createEnvironment', () => {
    beforeEach(() => {
      const environmentConfig: TestEnvironmentConfig = {
        analysis: mockAnalysis,
        config: mockConfig,
        dryRun: false
      };
      service = new TestEnvironmentService(environmentConfig);
    });

    it('should create test environment in normal mode', async () => {
      (fs.access as jest.Mock).mockRejectedValue(new Error('File not found'));
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);

      await service.createEnvironment();

      expect(fs.mkdir).toHaveBeenCalledWith(testOutputPath, { recursive: true });
      expect(fs.writeFile).toHaveBeenCalled();
    });

    it('should skip creation in dry run mode', async () => {
      const dryRunConfig: TestEnvironmentConfig = {
        analysis: mockAnalysis,
        config: mockConfig,
        dryRun: true
      };
      service = new TestEnvironmentService(dryRunConfig);

      await service.createEnvironment();

      expect(fs.mkdir).not.toHaveBeenCalled();
      expect(fs.writeFile).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      (fs.mkdir as jest.Mock).mockRejectedValue(new Error('Permission denied'));

      await service.createEnvironment();

      // Should not throw, just log warning
      expect(fs.mkdir).toHaveBeenCalled();
    });
  });

  describe('package.json creation', () => {
    beforeEach(() => {
      const environmentConfig: TestEnvironmentConfig = {
        analysis: mockAnalysis,
        config: mockConfig,
        dryRun: false
      };
      service = new TestEnvironmentService(environmentConfig);
    });

    it('should create package.json with Jest configuration', async () => {
      (fs.access as jest.Mock).mockRejectedValue(new Error('File not found'));
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);

      await service.createEnvironment();

      const writeFileCall = (fs.writeFile as jest.Mock).mock.calls.find(call => 
        call[0].endsWith('package.json')
      );
      expect(writeFileCall).toBeDefined();

      const packageJson = JSON.parse(writeFileCall[1]);
      expect(packageJson.name).toBe('project-tests');
      expect(packageJson.scripts.test).toBe('jest');
      expect(packageJson.devDependencies.jest).toBe('^29.7.0');
      expect(packageJson.jest).toBeDefined();
    });

    it('should create package.json with Vitest configuration', async () => {
      mockConfig.testFramework = 'vitest';
      (fs.access as jest.Mock).mockRejectedValue(new Error('File not found'));
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);

      await service.createEnvironment();

      const writeFileCall = (fs.writeFile as jest.Mock).mock.calls.find(call => 
        call[0].endsWith('package.json')
      );
      const packageJson = JSON.parse(writeFileCall[1]);
      
      expect(packageJson.scripts.test).toBe('vitest run');
      expect(packageJson.devDependencies.vitest).toBe('^0.34.0');
      expect(packageJson.jest).toBeUndefined();
    });

    it('should create package.json with Pytest configuration', async () => {
      mockConfig.testFramework = 'pytest';
      (fs.access as jest.Mock).mockRejectedValue(new Error('File not found'));
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);

      await service.createEnvironment();

      const writeFileCall = (fs.writeFile as jest.Mock).mock.calls.find(call => 
        call[0].endsWith('package.json')
      );
      const packageJson = JSON.parse(writeFileCall[1]);
      
      expect(packageJson.scripts.test).toBe('pytest');
      expect(packageJson.scripts['test:coverage']).toBe('pytest --cov');
    });

    it('should include TypeScript dependencies when TypeScript is detected', async () => {
      mockAnalysis.languages = [
        { name: 'typescript', version: '5.0', confidence: 0.9, files: ['index.ts'] }
      ];
      
      (fs.access as jest.Mock).mockRejectedValue(new Error('File not found'));
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);

      await service.createEnvironment();

      const writeFileCall = (fs.writeFile as jest.Mock).mock.calls.find(call => 
        call[0].endsWith('package.json')
      );
      const packageJson = JSON.parse(writeFileCall[1]);
      
      expect(packageJson.devDependencies.typescript).toBe('^5.2.0');
      expect(packageJson.devDependencies['ts-jest']).toBe('^29.1.0');
      expect(packageJson.devDependencies['@types/node']).toBe('^20.6.0');
    });

    it('should include React testing dependencies when React is detected', async () => {
      mockAnalysis.frameworks = [
        { name: 'react', version: '18.0.0', confidence: 0.8, configFiles: ['package.json'] }
      ];
      
      (fs.access as jest.Mock).mockRejectedValue(new Error('File not found'));
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);

      await service.createEnvironment();

      const writeFileCall = (fs.writeFile as jest.Mock).mock.calls.find(call => 
        call[0].endsWith('package.json')
      );
      const packageJson = JSON.parse(writeFileCall[1]);
      
      expect(packageJson.devDependencies['@testing-library/react']).toBe('^13.4.0');
      expect(packageJson.devDependencies['@testing-library/jest-dom']).toBe('^6.1.0');
      expect(packageJson.devDependencies['@testing-library/user-event']).toBe('^14.5.0');
    });

    it('should include Vue testing dependencies when Vue is detected', async () => {
      mockAnalysis.frameworks = [
        { name: 'vue', version: '3.0.0', confidence: 0.8, configFiles: ['package.json'] }
      ];
      
      (fs.access as jest.Mock).mockRejectedValue(new Error('File not found'));
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);

      await service.createEnvironment();

      const writeFileCall = (fs.writeFile as jest.Mock).mock.calls.find(call => 
        call[0].endsWith('package.json')
      );
      const packageJson = JSON.parse(writeFileCall[1]);
      
      expect(packageJson.devDependencies['@vue/test-utils']).toBe('^2.4.0');
    });

    it('should include Angular testing dependencies when Angular is detected', async () => {
      mockAnalysis.frameworks = [
        { name: 'angular', version: '16.0.0', confidence: 0.8, configFiles: ['package.json'] }
      ];
      
      (fs.access as jest.Mock).mockRejectedValue(new Error('File not found')); // package.json doesn't exist
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);

      await service.createEnvironment();

      const writeFileCall = (fs.writeFile as jest.Mock).mock.calls.find(call => 
        call[0].endsWith('package.json')
      );
      expect(writeFileCall).toBeDefined();
      const packageJson = JSON.parse(writeFileCall[1]);
      
      expect(packageJson.devDependencies['@angular/testing']).toBe('^16.0.0');
    });

    it('should not overwrite existing package.json', async () => {
      (fs.access as jest.Mock).mockResolvedValue(undefined); // File exists
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);

      await service.createEnvironment();

      const packageJsonCalls = (fs.writeFile as jest.Mock).mock.calls.filter(call => 
        call[0].endsWith('package.json')
      );
      expect(packageJsonCalls).toHaveLength(0);
    });
  });

  describe('Jest configuration', () => {
    beforeEach(() => {
      const environmentConfig: TestEnvironmentConfig = {
        analysis: mockAnalysis,
        config: mockConfig,
        dryRun: false
      };
      service = new TestEnvironmentService(environmentConfig);
    });

    it('should configure Jest for React projects with jsdom environment', async () => {
      mockAnalysis.frameworks = [
        { name: 'react', version: '18.0.0', confidence: 0.8, configFiles: ['package.json'] }
      ];
      
      (fs.access as jest.Mock).mockRejectedValue(new Error('File not found'));
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);

      await service.createEnvironment();

      const writeFileCall = (fs.writeFile as jest.Mock).mock.calls.find(call => 
        call[0].endsWith('package.json')
      );
      const packageJson = JSON.parse(writeFileCall[1]);
      
      expect(packageJson.jest.testEnvironment).toBe('jsdom');
      expect(packageJson.jest.setupFilesAfterEnv).toEqual(['<rootDir>/jest.setup.js']);
    });

    it('should configure Jest for Node.js projects with node environment', async () => {
      mockAnalysis.frameworks = [
        { name: 'express', version: '4.0.0', confidence: 0.8, configFiles: ['package.json'] }
      ];
      
      (fs.access as jest.Mock).mockRejectedValue(new Error('File not found'));
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);

      await service.createEnvironment();

      const writeFileCall = (fs.writeFile as jest.Mock).mock.calls.find(call => 
        call[0].endsWith('package.json')
      );
      const packageJson = JSON.parse(writeFileCall[1]);
      
      expect(packageJson.jest.testEnvironment).toBe('node');
      expect(packageJson.jest.setupFilesAfterEnv).toBeUndefined();
    });

    it('should configure Jest for TypeScript projects', async () => {
      mockAnalysis.languages = [
        { name: 'typescript', version: '5.0', confidence: 0.9, files: ['index.ts'] }
      ];
      
      (fs.access as jest.Mock).mockRejectedValue(new Error('File not found'));
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);

      await service.createEnvironment();

      const writeFileCall = (fs.writeFile as jest.Mock).mock.calls.find(call => 
        call[0].endsWith('package.json')
      );
      const packageJson = JSON.parse(writeFileCall[1]);
      
      expect(packageJson.jest.preset).toBe('ts-jest');
      expect(packageJson.jest.moduleFileExtensions).toContain('ts');
      expect(packageJson.jest.moduleFileExtensions).toContain('tsx');
      expect(packageJson.jest.transform['^.+\\.tsx?$']).toBe('ts-jest');
    });
  });

  describe('framework configuration files', () => {
    beforeEach(() => {
      const environmentConfig: TestEnvironmentConfig = {
        analysis: mockAnalysis,
        config: mockConfig,
        dryRun: false
      };
      service = new TestEnvironmentService(environmentConfig);
    });

    it('should create Jest setup file for React projects', async () => {
      mockAnalysis.frameworks = [
        { name: 'react', version: '18.0.0', confidence: 0.8, configFiles: ['package.json'] }
      ];
      
      (fs.access as jest.Mock).mockRejectedValue(new Error('File not found'));
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);

      await service.createEnvironment();

      const setupFileCall = (fs.writeFile as jest.Mock).mock.calls.find(call => 
        call[0].endsWith('jest.setup.js')
      );
      expect(setupFileCall).toBeDefined();
      
      const setupContent = setupFileCall[1];
      expect(setupContent).toContain('@testing-library/jest-dom');
      expect(setupContent).toContain('ResizeObserver');
      expect(setupContent).toContain('window.matchMedia');
    });

    it('should create TypeScript config for TypeScript projects', async () => {
      mockAnalysis.languages = [
        { name: 'typescript', version: '5.0', confidence: 0.9, files: ['index.ts'] }
      ];
      
      (fs.access as jest.Mock).mockRejectedValue(new Error('File not found'));
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);

      await service.createEnvironment();

      const tsconfigCall = (fs.writeFile as jest.Mock).mock.calls.find(call => 
        call[0].endsWith('tsconfig.json')
      );
      expect(tsconfigCall).toBeDefined();
      
      const tsconfig = JSON.parse(tsconfigCall[1]);
      expect(tsconfig.compilerOptions.target).toBe('es2020');
      expect(tsconfig.compilerOptions.module).toBe('commonjs');
      expect(tsconfig.compilerOptions.strict).toBe(true);
    });

    it('should configure TypeScript with React JSX for React projects', async () => {
      mockAnalysis.languages = [
        { name: 'typescript', version: '5.0', confidence: 0.9, files: ['index.ts'] }
      ];
      mockAnalysis.frameworks = [
        { name: 'react', version: '18.0.0', confidence: 0.8, configFiles: ['package.json'] }
      ];
      
      (fs.access as jest.Mock).mockRejectedValue(new Error('File not found'));
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);

      await service.createEnvironment();

      const tsconfigCall = (fs.writeFile as jest.Mock).mock.calls.find(call => 
        call[0].endsWith('tsconfig.json')
      );
      const tsconfig = JSON.parse(tsconfigCall[1]);
      
      expect(tsconfig.compilerOptions.jsx).toBe('react-jsx');
    });

    it('should not overwrite existing configuration files', async () => {
      mockAnalysis.frameworks = [
        { name: 'react', version: '18.0.0', confidence: 0.8, configFiles: ['package.json'] }
      ];
      
      (fs.access as jest.Mock).mockResolvedValue(undefined); // All files exist
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);

      await service.createEnvironment();

      const configFileCalls = (fs.writeFile as jest.Mock).mock.calls.filter(call => 
        call[0].endsWith('jest.setup.js') || call[0].endsWith('tsconfig.json')
      );
      expect(configFileCalls).toHaveLength(0);
    });
  });

  describe('edge cases', () => {
    beforeEach(() => {
      const environmentConfig: TestEnvironmentConfig = {
        analysis: mockAnalysis,
        config: mockConfig,
        dryRun: false
      };
      service = new TestEnvironmentService(environmentConfig);
    });

    it('should handle unknown test framework gracefully', async () => {
      mockConfig.testFramework = 'unknown-framework' as any;
      
      (fs.access as jest.Mock).mockRejectedValue(new Error('File not found'));
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);

      await service.createEnvironment();

      const writeFileCall = (fs.writeFile as jest.Mock).mock.calls.find(call => 
        call[0].endsWith('package.json')
      );
      const packageJson = JSON.parse(writeFileCall[1]);
      
      expect(packageJson.scripts.test).toBe('unknown-framework');
      expect(packageJson.jest).toBeUndefined();
    });

    it('should handle empty analysis gracefully', async () => {
      mockAnalysis.languages = [];
      mockAnalysis.frameworks = [];
      
      (fs.access as jest.Mock).mockRejectedValue(new Error('File not found'));
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);

      await service.createEnvironment();

      const writeFileCall = (fs.writeFile as jest.Mock).mock.calls.find(call => 
        call[0].endsWith('package.json')
      );
      expect(writeFileCall).toBeDefined(); // Should still create basic package.json
    });

    it('should handle mixed directory permissions', async () => {
      (fs.access as jest.Mock)
        .mockResolvedValueOnce(undefined) // package.json exists
        .mockRejectedValueOnce(new Error('File not found')); // setup file doesn't exist
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);

      mockAnalysis.frameworks = [
        { name: 'react', version: '18.0.0', confidence: 0.8, configFiles: ['package.json'] }
      ];

      await service.createEnvironment();

      // Should skip package.json but create setup file
      const packageJsonCalls = (fs.writeFile as jest.Mock).mock.calls.filter(call => 
        call[0].endsWith('package.json')
      );
      const setupFileCalls = (fs.writeFile as jest.Mock).mock.calls.filter(call => 
        call[0].endsWith('jest.setup.js')
      );
      
      expect(packageJsonCalls).toHaveLength(0);
      expect(setupFileCalls).toHaveLength(1);
    });
  });
});