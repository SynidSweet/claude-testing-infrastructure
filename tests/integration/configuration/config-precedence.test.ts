/**
 * Integration tests for configuration precedence and merging behavior
 */

import { ConfigurationService } from '../../../src/config/ConfigurationService';
import { fs, path } from '../../../src/utils/common-imports';
import os from 'os';

describe('Configuration Precedence Integration', () => {
  let tempDir: string;
  let originalEnv: NodeJS.ProcessEnv;
  
  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'claude-testing-precedence-'));
    originalEnv = { ...process.env };
    
    // Clear any existing CLAUDE_TESTING_ env vars
    Object.keys(process.env).forEach(key => {
      if (key.startsWith('CLAUDE_TESTING_')) {
        delete process.env[key];
      }
    });
  });
  
  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
    process.env = originalEnv;
  });

  describe('Complete Precedence Chain', () => {
    test('should respect full precedence order: CLI > env > custom > project > user > defaults', async () => {
      // 1. Set up defaults (built-in)
      // Defaults include testFramework: 'jest'
      
      // 2. Create user config
      const userConfigDir = path.join(os.homedir(), '.config', 'claude-testing');
      const userConfigPath = path.join(userConfigDir, 'config.json');
      await fs.mkdir(userConfigDir, { recursive: true });
      const userConfig = {
        testFramework: 'mocha',
        aiModel: 'claude-3-5-sonnet-20241022',
        features: {
          coverage: false
        }
      };
      await fs.writeFile(userConfigPath, JSON.stringify(userConfig, null, 2));
      
      // 3. Create project config
      const projectConfigPath = path.join(tempDir, '.claude-testing.config.json');
      const projectConfig = {
        testFramework: 'pytest',
        aiModel: 'claude-3-opus-20240229',
        include: ['src/**/*.py'],
        features: {
          coverage: true,
          edgeCases: false
        }
      };
      await fs.writeFile(projectConfigPath, JSON.stringify(projectConfig, null, 2));
      
      // 4. Create custom config file
      const customConfigPath = path.join(tempDir, 'custom.json');
      const customConfig = {
        testFramework: 'vitest',
        include: ['custom/**/*.ts'],
        exclude: ['custom/**/*.spec.ts'],
        features: {
          edgeCases: true,
          integrationTests: false
        }
      };
      await fs.writeFile(customConfigPath, JSON.stringify(customConfig, null, 2));
      
      // 5. Set environment variables
      process.env.CLAUDE_TESTING_TEST_FRAMEWORK = 'jasmine';
      process.env.CLAUDE_TESTING_EXCLUDE = '**/*.env.ts,**/*.config.ts';
      process.env.CLAUDE_TESTING_FEATURES_INTEGRATION_TESTS = 'true';
      
      // 6. CLI arguments (highest priority)
      const cliArgs = {
        framework: 'jest',  // Should win
        verbose: true
      };
      
      const service = new ConfigurationService({
        projectPath: tempDir,
        customConfigPath,
        includeEnvVars: true,
        includeUserConfig: true,
        cliArgs
      });

      const result = await service.loadConfiguration();
      
      expect(result.valid).toBe(true);
      
      // Verify precedence
      expect(result.config.testFramework).toBe('jest'); // CLI wins
      expect(result.config.aiModel).toBe('claude-3-opus-20240229'); // Project overrides user
      expect(result.config.include).toEqual(['custom/**/*.ts']); // Custom overrides project
      expect(result.config.exclude).toEqual(['**/*.env.ts', '**/*.config.ts']); // Env overrides custom
      expect(result.config.features.coverage).toBe(true); // Project overrides user
      expect(result.config.features.edgeCases).toBe(true); // Custom overrides project
      expect(result.config.features.integrationTests).toBe(true); // Env overrides custom
      expect(result.config.output?.logLevel).toBe('verbose'); // CLI
      
      // Verify all sources were loaded
      const sourceTypes = result.sources.map(s => s.type);
      expect(sourceTypes).toContain('defaults');
      expect(sourceTypes).toContain('user-config');
      expect(sourceTypes).toContain('project-config');
      expect(sourceTypes).toContain('custom-file');
      expect(sourceTypes).toContain('env-vars');
      expect(sourceTypes).toContain('cli-args');
      
      // Clean up user config
      await fs.rm(userConfigPath, { force: true });
      await fs.rmdir(userConfigDir);
    });

    test('should handle partial configurations at each level', async () => {
      // Each level only specifies some values
      const projectConfigPath = path.join(tempDir, '.claude-testing.config.json');
      await fs.writeFile(projectConfigPath, JSON.stringify({
        include: ['src/**/*.js']
      }, null, 2));
      
      process.env.CLAUDE_TESTING_AI_MODEL = 'claude-3-haiku-20240307';
      
      const service = new ConfigurationService({
        projectPath: tempDir,
        includeEnvVars: true,
        includeUserConfig: false,
        cliArgs: {
          coverage: true
        }
      });

      const result = await service.loadConfiguration();
      
      expect(result.valid).toBe(true);
      expect(result.config.testFramework).toBe('auto'); // From defaults
      expect(result.config.include).toEqual(['src/**/*.js']); // From project
      expect(result.config.aiModel).toBe('claude-3-haiku-20240307'); // From env
      expect(result.config.coverage?.enabled).toBe(true); // From CLI
    });
  });

  describe('Deep Merge Behavior', () => {
    test('should properly deep merge nested objects', async () => {
      const projectConfigPath = path.join(tempDir, '.claude-testing.config.json');
      await fs.writeFile(projectConfigPath, JSON.stringify({
        features: {
          coverage: true,
          edgeCases: true
        },
        coverage: {
          thresholds: {
            global: {
              statements: 80,
              branches: 70
            }
          }
        }
      }, null, 2));
      
      process.env.CLAUDE_TESTING_FEATURES_INTEGRATION_TESTS = 'true';
      process.env.CLAUDE_TESTING_COVERAGE_THRESHOLDS_GLOBAL_FUNCTIONS = '85';
      
      const service = new ConfigurationService({
        projectPath: tempDir,
        includeEnvVars: true,
        includeUserConfig: false,
        cliArgs: {
          threshold: 'lines:90'
        }
      });

      const result = await service.loadConfiguration();
      
      expect(result.valid).toBe(true);
      expect(result.config.features.coverage).toBe(true); // From project
      expect(result.config.features.edgeCases).toBe(true); // From project
      expect(result.config.features.integrationTests).toBe(true); // From env
      expect(result.config.coverage?.thresholds?.global?.statements).toBe(80); // From project
      expect(result.config.coverage?.thresholds?.global?.branches).toBe(70); // From project
      expect(result.config.coverage?.thresholds?.global?.functions).toBe(85); // From env
      expect(result.config.coverage?.thresholds?.global?.lines).toBe(90); // From CLI
    });

    test('should handle array merging correctly', async () => {
      const projectConfigPath = path.join(tempDir, '.claude-testing.config.json');
      await fs.writeFile(projectConfigPath, JSON.stringify({
        include: ['src/**/*.js', 'lib/**/*.js'],
        exclude: ['**/*.test.js']
      }, null, 2));
      
      process.env.CLAUDE_TESTING_EXCLUDE = '**/*.spec.js,**/*.mock.js';
      
      const service = new ConfigurationService({
        projectPath: tempDir,
        includeEnvVars: true,
        includeUserConfig: false
      });

      const result = await service.loadConfiguration();
      
      expect(result.valid).toBe(true);
      expect(result.config.include).toEqual(['src/**/*.js', 'lib/**/*.js']); // From project
      expect(result.config.exclude).toEqual(['**/*.spec.js', '**/*.mock.js']); // Env replaces project
    });
  });

  describe('Source Tracking', () => {
    test('should accurately track which values came from which sources', async () => {
      const projectConfigPath = path.join(tempDir, '.claude-testing.config.json');
      await fs.writeFile(projectConfigPath, JSON.stringify({
        testFramework: 'pytest',
        aiModel: 'claude-3-opus-20240229'
      }, null, 2));
      
      process.env.CLAUDE_TESTING_AI_MODEL = 'claude-3-sonnet-20240229';
      
      const service = new ConfigurationService({
        projectPath: tempDir,
        includeEnvVars: true,
        includeUserConfig: false,
        cliArgs: {
          framework: 'jest'
        }
      });

      const result = await service.loadConfiguration();
      
      // Check source tracking
      const projectSource = result.sources.find(s => s.type === 'project-config');
      expect(projectSource?.loaded).toBe(true);
      expect(projectSource?.data).toHaveProperty('testFramework', 'pytest');
      expect(projectSource?.data).toHaveProperty('aiModel', 'claude-3-opus-20240229');
      
      const envSource = result.sources.find(s => s.type === 'env-vars');
      expect(envSource?.loaded).toBe(true);
      expect(envSource?.data).toHaveProperty('aiModel', 'claude-3-sonnet-20240229');
      
      const cliSource = result.sources.find(s => s.type === 'cli-args');
      expect(cliSource?.loaded).toBe(true);
      expect(cliSource?.data).toHaveProperty('testFramework', 'jest');
    });

    test('should show overridden values in source details', async () => {
      const projectConfigPath = path.join(tempDir, '.claude-testing.config.json');
      await fs.writeFile(projectConfigPath, JSON.stringify({
        testFramework: 'pytest',
        output: {
          logLevel: 'info'
        }
      }, null, 2));
      
      const service = new ConfigurationService({
        projectPath: tempDir,
        includeEnvVars: false,
        includeUserConfig: false,
        cliArgs: {
          verbose: true // This should override logLevel to 'verbose'
        }
      });

      const result = await service.loadConfiguration();
      
      expect(result.config.output?.logLevel).toBe('verbose');
      
      // Both sources should show their original values
      const projectSource = result.sources.find(s => s.type === 'project-config');
      expect(projectSource?.data?.output?.logLevel).toBe('info');
      
      const cliSource = result.sources.find(s => s.type === 'cli-args');
      expect(cliSource?.data?.output?.logLevel).toBe('verbose');
    });
  });
});