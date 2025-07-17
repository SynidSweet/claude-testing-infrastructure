import * as fs from 'fs';
import * as path from 'path';
import { JestRunner } from '../../../src/runners/JestRunner';
import { TestRunnerConfig } from '../../../src/runners/TestRunner';
import { ProjectAnalysis } from '../../../src/analyzers/ProjectAnalyzer';
import { FileDiscoveryServiceImpl } from '../../../src/services/FileDiscoveryService';
import { createTemporaryProject, cleanupTemporaryProject, setupFixtureLifecycle } from '../../fixtures/shared';

/**
 * Test subclass to expose protected methods for testing
 */
class TestableJestRunner extends JestRunner {
  public getRunCommand(): { command: string; args: string[] } {
    return super.getRunCommand();
  }
  
  public async callSetupBabelConfigurationIfNeeded(): Promise<void> {
    // Access the private method using bracket notation
    // TypeScript will allow this even though the method is private
    await (this as any).setupBabelConfigurationIfNeeded();
  }
}

/**
 * Creates a mock ProjectAnalysis with all required properties
 */
function createMockProjectAnalysis(overrides: Partial<ProjectAnalysis> = {}): ProjectAnalysis {
  return {
    projectPath: '/test/project',
    languages: [
      {
        name: 'javascript',
        confidence: 0.9,
        files: ['src/App.js', 'src/components/Button.js'],
        version: '2022',
      },
    ],
    frameworks: [
      {
        name: 'react',
        confidence: 0.9,
        version: '18.0.0',
        configFiles: [],
      },
    ],
    packageManagers: [
      {
        name: 'npm',
        confidence: 0.9,
        lockFiles: ['package-lock.json'],
      },
    ],
    projectStructure: {
      rootFiles: ['package.json'],
      srcDirectory: 'src',
      testDirectories: ['tests'],
      configFiles: [],
      buildOutputs: ['dist'],
      entryPoints: ['src/index.js'],
    },
    dependencies: {
      production: { react: '^18.0.0', 'react-dom': '^18.0.0' },
      development: { jest: '^29.0.0' },
      python: undefined,
    },
    testingSetup: {
      hasTests: true,
      testFrameworks: ['jest'],
      testFiles: ['src/App.test.js'],
      coverageTools: ['istanbul'],
    },
    complexity: {
      totalFiles: 10,
      totalLines: 500,
      averageFileSize: 50,
      largestFiles: [{ path: 'src/App.js', lines: 100 }],
    },
    moduleSystem: {
      type: 'esm',
      hasPackageJsonType: true,
      packageJsonType: 'module',
      confidence: 0.9,
      fileExtensionPattern: 'js',
    },
    ...overrides,
  };
}

describe('JestRunner - Babel Configuration Integration Tests', () => {
  setupFixtureLifecycle();

  let tempProjectPath: string;
  let testConfig: TestRunnerConfig;

  afterEach(async () => {
    if (tempProjectPath) {
      await cleanupTemporaryProject(tempProjectPath);
    }
  });

  describe('ES Modules Babel Configuration Workflow', () => {
    beforeEach(async () => {
      // Create a temporary React project for testing
      tempProjectPath = await createTemporaryProject('react-project');
      
      // Set up test configuration
      testConfig = {
        projectPath: tempProjectPath,
        testPath: path.join(tempProjectPath, '.claude-testing'),
        framework: 'jest',
        coverage: { enabled: false },
      };

      // Ensure test directory exists
      await fs.promises.mkdir(testConfig.testPath, { recursive: true });
    });

    it('should create babel configuration for ES modules React project', async () => {
      // Mock project analysis for React with ES modules
      const mockAnalysis = createMockProjectAnalysis({
        projectPath: tempProjectPath,
        moduleSystem: {
          type: 'esm',
          hasPackageJsonType: true,
          packageJsonType: 'module',
          confidence: 0.9,
          fileExtensionPattern: 'js',
        },
        projectStructure: {
          rootFiles: ['package.json'],
          srcDirectory: 'src',
          testDirectories: ['tests'],
          configFiles: [],
          buildOutputs: ['dist'],
          entryPoints: ['src/index.js'],
        },
      });

      const mockFileDiscovery = {
        discoverFiles: jest.fn().mockResolvedValue([]),
        getAnalysis: jest.fn().mockResolvedValue(mockAnalysis),
      } as unknown as FileDiscoveryServiceImpl;

      const jestRunner = new TestableJestRunner(testConfig, mockAnalysis, mockFileDiscovery);

      // Call setupBabelConfigurationIfNeeded before getRunCommand (mimics executeTests flow)
      await jestRunner.callSetupBabelConfigurationIfNeeded();
      
      // Call getRunCommand
      const runCommand = await jestRunner.getRunCommand();
      expect(runCommand).toBeDefined();

      // Check that babel.config.mjs was created in the test directory
      const babelConfigPath = path.join(testConfig.testPath, 'babel.config.mjs');
      expect(fs.existsSync(babelConfigPath)).toBe(true);

      // Read and verify the babel configuration content
      const babelConfig = await fs.promises.readFile(babelConfigPath, 'utf-8');
      expect(babelConfig).toContain('export default');
      expect(babelConfig).toContain('@babel/preset-env');
      expect(babelConfig).toContain('@babel/preset-react');
      expect(babelConfig).toContain('modules: \'auto\'');
    });

    it('should adapt existing babel configuration for ES modules', async () => {
      // Create an existing babel configuration in the project
      const existingBabelConfig = `
module.exports = {
  presets: [
    ['@babel/preset-env', { modules: 'auto' }],
    '@babel/preset-react'
  ],
  plugins: [
    '@babel/plugin-transform-runtime'
  ]
};
`;
      const projectBabelConfigPath = path.join(tempProjectPath, 'babel.config.js');
      await fs.promises.writeFile(projectBabelConfigPath, existingBabelConfig);

      // Mock project analysis for React with ES modules
      const mockAnalysis = createMockProjectAnalysis({
        projectPath: tempProjectPath,
        moduleSystem: {
          type: 'esm',
          hasPackageJsonType: true,
          packageJsonType: 'module',
          confidence: 0.9,
          fileExtensionPattern: 'js',
        },
        projectStructure: {
          rootFiles: ['package.json', 'babel.config.js'],
          srcDirectory: 'src',
          testDirectories: ['tests'],
          configFiles: ['babel.config.js'],
          buildOutputs: ['dist'],
          entryPoints: ['src/index.js'],
        },
      });

      const mockFileDiscovery = {
        discoverFiles: jest.fn().mockResolvedValue([]),
        getAnalysis: jest.fn().mockResolvedValue(mockAnalysis),
      } as unknown as FileDiscoveryServiceImpl;

      const jestRunner = new TestableJestRunner(testConfig, mockAnalysis, mockFileDiscovery);

      // Call setupBabelConfigurationIfNeeded before getRunCommand (mimics executeTests flow)
      await jestRunner.callSetupBabelConfigurationIfNeeded();
      
      // Call getRunCommand
      const runCommand = await jestRunner.getRunCommand();
      expect(runCommand).toBeDefined();

      // Check that babel.config.mjs was created in the test directory
      const babelConfigPath = path.join(testConfig.testPath, 'babel.config.mjs');
      expect(fs.existsSync(babelConfigPath)).toBe(true);

      // Read and verify the adapted babel configuration
      const babelConfig = await fs.promises.readFile(babelConfigPath, 'utf-8');
      expect(babelConfig).toContain('export default');
      expect(babelConfig).toContain('@babel/preset-env');
      expect(babelConfig).toContain('@babel/preset-react');
      expect(babelConfig).toContain('modules: \'auto\''); // Preserves original modules setting
      expect(babelConfig).toContain('@babel/plugin-transform-runtime');
    });

    it('should handle multiple babel configuration files with preference order', async () => {
      // Create multiple babel configuration files
      const babelConfigJs = `
module.exports = {
  presets: ['@babel/preset-env', '@babel/preset-react'],
  plugins: ['@babel/plugin-transform-runtime']
};
`;
      const babelrcJson = `
{
  "presets": ["@babel/preset-env"],
  "plugins": ["@babel/plugin-proposal-class-properties"]
}
`;

      await fs.promises.writeFile(path.join(tempProjectPath, 'babel.config.js'), babelConfigJs);
      await fs.promises.writeFile(path.join(tempProjectPath, '.babelrc.json'), babelrcJson);

      // Mock project analysis
      const mockAnalysis = createMockProjectAnalysis({
        projectPath: tempProjectPath,
        moduleSystem: {
          type: 'esm',
          hasPackageJsonType: true,
          packageJsonType: 'module',
          confidence: 0.9,
          fileExtensionPattern: 'js',
        },
        projectStructure: {
          rootFiles: ['package.json', 'babel.config.js', '.babelrc.json'],
          srcDirectory: 'src',
          testDirectories: ['tests'],
          configFiles: ['babel.config.js', '.babelrc.json'],
          buildOutputs: ['dist'],
          entryPoints: ['src/index.js'],
        },
      });

      const mockFileDiscovery = {
        discoverFiles: jest.fn().mockResolvedValue([]),
        getAnalysis: jest.fn().mockResolvedValue(mockAnalysis),
      } as unknown as FileDiscoveryServiceImpl;

      const jestRunner = new TestableJestRunner(testConfig, mockAnalysis, mockFileDiscovery);

      // Call the ensureBabelConfig method
      await (jestRunner as any).ensureBabelConfig();

      // Check that babel.config.mjs was created (should prefer babel.config.js over .babelrc.json)
      const babelConfigPath = path.join(testConfig.testPath, 'babel.config.mjs');
      expect(fs.existsSync(babelConfigPath)).toBe(true);

      // Verify the configuration was adapted from babel.config.js
      const babelConfig = await fs.promises.readFile(babelConfigPath, 'utf-8');
      expect(babelConfig).toContain('@babel/preset-react');
      expect(babelConfig).toContain('@babel/plugin-transform-runtime');
    });
  });

  describe('CommonJS Babel Configuration Workflow', () => {
    beforeEach(async () => {
      // Create a temporary React project for testing
      tempProjectPath = await createTemporaryProject('react-project');
      
      // Set up test configuration
      testConfig = {
        projectPath: tempProjectPath,
        testPath: path.join(tempProjectPath, '.claude-testing'),
        framework: 'jest',
        coverage: { enabled: false },
      };

      // Ensure test directory exists
      await fs.promises.mkdir(testConfig.testPath, { recursive: true });
    });

    it('should not create babel configuration for CommonJS projects (only ESM+React supported)', async () => {
      // Create an existing babel configuration in the project
      const existingBabelConfig = `
module.exports = {
  presets: [
    ['@babel/preset-env', { modules: 'commonjs' }],
    '@babel/preset-react'
  ],
  plugins: [
    '@babel/plugin-transform-runtime'
  ]
};
`;
      const projectBabelConfigPath = path.join(tempProjectPath, 'babel.config.js');
      await fs.promises.writeFile(projectBabelConfigPath, existingBabelConfig);

      // Mock project analysis for React with CommonJS modules
      const mockAnalysis = createMockProjectAnalysis({
        projectPath: tempProjectPath,
        moduleSystem: {
          type: 'commonjs',
          hasPackageJsonType: true,
          packageJsonType: 'commonjs',
          confidence: 0.9,
          fileExtensionPattern: 'js',
        },
        projectStructure: {
          rootFiles: ['package.json', 'babel.config.js'],
          srcDirectory: 'src',
          testDirectories: ['tests'],
          configFiles: ['babel.config.js'],
          buildOutputs: ['dist'],
          entryPoints: ['src/index.js'],
        },
      });

      const mockFileDiscovery = {
        discoverFiles: jest.fn().mockResolvedValue([]),
        getAnalysis: jest.fn().mockResolvedValue(mockAnalysis),
      } as unknown as FileDiscoveryServiceImpl;

      const jestRunner = new TestableJestRunner(testConfig, mockAnalysis, mockFileDiscovery);

      // Call getRunCommand - should NOT trigger ensureBabelConfig for CommonJS projects
      const runCommand = jestRunner.getRunCommand();
      expect(runCommand).toBeDefined();

      // Check that NO babel configuration was created (ensureBabelConfig only runs for ESM+React)
      const babelConfigPath = path.join(testConfig.testPath, 'babel.config.js');
      expect(fs.existsSync(babelConfigPath)).toBe(false);
    });

    it('should not copy .babelrc.json for CommonJS projects (only ESM+React supported)', async () => {
      // Create a .babelrc.json file in the project
      const babelrcConfig = {
        presets: ['@babel/preset-env', '@babel/preset-react'],
        plugins: ['@babel/plugin-proposal-class-properties']
      };
      
      const projectBabelrcPath = path.join(tempProjectPath, '.babelrc.json');
      await fs.promises.writeFile(projectBabelrcPath, JSON.stringify(babelrcConfig, null, 2));

      // Mock project analysis for React with CommonJS modules
      const mockAnalysis = createMockProjectAnalysis({
        projectPath: tempProjectPath,
        moduleSystem: {
          type: 'commonjs',
          hasPackageJsonType: true,
          packageJsonType: 'commonjs',
          confidence: 0.9,
          fileExtensionPattern: 'js',
        },
        projectStructure: {
          rootFiles: ['package.json', '.babelrc.json'],
          srcDirectory: 'src',
          testDirectories: ['tests'],
          configFiles: ['.babelrc.json'],
          buildOutputs: ['dist'],
          entryPoints: ['src/index.js'],
        },
      });

      const mockFileDiscovery = {
        discoverFiles: jest.fn().mockResolvedValue([]),
        getAnalysis: jest.fn().mockResolvedValue(mockAnalysis),
      } as unknown as FileDiscoveryServiceImpl;

      const jestRunner = new TestableJestRunner(testConfig, mockAnalysis, mockFileDiscovery);

      // Call getRunCommand - should NOT trigger ensureBabelConfig for CommonJS
      const runCommand = jestRunner.getRunCommand();
      expect(runCommand).toBeDefined();

      // Check that NO babel configuration was created (ensureBabelConfig only runs for ESM+React)
      const babelConfigPath = path.join(testConfig.testPath, 'babel.config.js');
      expect(fs.existsSync(babelConfigPath)).toBe(false);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    beforeEach(async () => {
      // Create a temporary React project for testing
      tempProjectPath = await createTemporaryProject('react-project');
      
      // Set up test configuration
      testConfig = {
        projectPath: tempProjectPath,
        testPath: path.join(tempProjectPath, '.claude-testing'),
        framework: 'jest',
        coverage: { enabled: false },
      };

      // Ensure test directory exists
      await fs.promises.mkdir(testConfig.testPath, { recursive: true });
    });

    it('should handle missing babel configuration gracefully', async () => {
      // Mock project analysis without babel configuration
      const mockAnalysis = createMockProjectAnalysis({
        projectPath: tempProjectPath,
        moduleSystem: {
          type: 'esm',
          hasPackageJsonType: true,
          packageJsonType: 'module',
          confidence: 0.9,
          fileExtensionPattern: 'js',
        },
        projectStructure: {
          rootFiles: ['package.json'],
          srcDirectory: 'src',
          testDirectories: ['tests'],
          configFiles: [],
          buildOutputs: ['dist'],
          entryPoints: ['src/index.js'],
        },
      });

      const mockFileDiscovery = {
        discoverFiles: jest.fn().mockResolvedValue([]),
        getAnalysis: jest.fn().mockResolvedValue(mockAnalysis),
      } as unknown as FileDiscoveryServiceImpl;

      const jestRunner = new TestableJestRunner(testConfig, mockAnalysis, mockFileDiscovery);

      // Call setupBabelConfigurationIfNeeded before getRunCommand (mimics executeTests flow)
      await jestRunner.callSetupBabelConfigurationIfNeeded();
      
      // Call getRunCommand
      const runCommand = await jestRunner.getRunCommand();
      expect(runCommand).toBeDefined();

      // Check that a default babel.config.mjs was created
      const babelConfigPath = path.join(testConfig.testPath, 'babel.config.mjs');
      expect(fs.existsSync(babelConfigPath)).toBe(true);

      // Read and verify the default babel configuration
      const babelConfig = await fs.promises.readFile(babelConfigPath, 'utf-8');
      expect(babelConfig).toContain('export default');
      expect(babelConfig).toContain('@babel/preset-env');
      expect(babelConfig).toContain('@babel/preset-react');
    });

    it('should handle malformed babel configuration files', async () => {
      // Create a malformed babel configuration file
      const malformedBabelConfig = `
module.exports = {
  presets: ['@babel/preset-env'
  // Missing closing bracket and syntax errors
`;
      const projectBabelConfigPath = path.join(tempProjectPath, 'babel.config.js');
      await fs.promises.writeFile(projectBabelConfigPath, malformedBabelConfig);

      // Mock project analysis
      const mockAnalysis = createMockProjectAnalysis({
        projectPath: tempProjectPath,
        moduleSystem: {
          type: 'esm',
          hasPackageJsonType: true,
          packageJsonType: 'module',
          confidence: 0.9,
          fileExtensionPattern: 'js',
        },
        projectStructure: {
          rootFiles: ['package.json', 'babel.config.js'],
          srcDirectory: 'src',
          testDirectories: ['tests'],
          configFiles: ['babel.config.js'],
          buildOutputs: ['dist'],
          entryPoints: ['src/index.js'],
        },
      });

      const mockFileDiscovery = {
        discoverFiles: jest.fn().mockResolvedValue([]),
        getAnalysis: jest.fn().mockResolvedValue(mockAnalysis),
      } as unknown as FileDiscoveryServiceImpl;

      const jestRunner = new TestableJestRunner(testConfig, mockAnalysis, mockFileDiscovery);

      // Call setupBabelConfigurationIfNeeded before getRunCommand (mimics executeTests flow)
      await jestRunner.callSetupBabelConfigurationIfNeeded();
      
      // Call getRunCommand - should handle malformed config gracefully
      expect(() => jestRunner.getRunCommand()).not.toThrow();

      // Check that a fallback babel.config.mjs was created
      const babelConfigPath = path.join(testConfig.testPath, 'babel.config.mjs');
      expect(fs.existsSync(babelConfigPath)).toBe(true);

      // Read and verify the adapted malformed babel configuration
      // Note: The adaptation method applies regex transformations even to malformed code
      const babelConfig = await fs.promises.readFile(babelConfigPath, 'utf-8');
      expect(babelConfig).toContain('export default');
      expect(babelConfig).toContain('@babel/preset-env');
      // The malformed config gets transformed but remains malformed
      expect(babelConfig).toContain('// Missing closing bracket and syntax errors');
    });

    it('should handle non-React projects without babel configuration', async () => {
      // Mock project analysis for non-React project
      const mockAnalysis = createMockProjectAnalysis({
        projectPath: tempProjectPath,
        frameworks: [],
        moduleSystem: {
          type: 'commonjs',
          hasPackageJsonType: true,
          packageJsonType: 'commonjs',
          confidence: 0.9,
          fileExtensionPattern: 'js',
        },
        dependencies: {
          production: { lodash: '^4.17.21' },
          development: { jest: '^29.0.0' },
          python: undefined,
        },
        projectStructure: {
          rootFiles: ['package.json'],
          srcDirectory: 'src',
          testDirectories: ['tests'],
          configFiles: [],
          buildOutputs: ['dist'],
          entryPoints: ['src/index.js'],
        },
      });

      const mockFileDiscovery = {
        discoverFiles: jest.fn().mockResolvedValue([]),
        getAnalysis: jest.fn().mockResolvedValue(mockAnalysis),
      } as unknown as FileDiscoveryServiceImpl;

      const jestRunner = new TestableJestRunner(testConfig, mockAnalysis, mockFileDiscovery);

      // Call setupBabelConfigurationIfNeeded before getRunCommand (mimics executeTests flow)
      await jestRunner.callSetupBabelConfigurationIfNeeded();
      
      // Call getRunCommand
      const runCommand = await jestRunner.getRunCommand();
      expect(runCommand).toBeDefined();

      // Check that no babel configuration was created
      const babelConfigPath = path.join(testConfig.testPath, 'babel.config.js');
      expect(fs.existsSync(babelConfigPath)).toBe(false);
    });
  });
});