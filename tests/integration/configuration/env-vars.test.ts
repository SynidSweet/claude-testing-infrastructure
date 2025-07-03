/**
 * Integration tests for environment variable configuration
 */

import { ConfigurationService } from '../../../src/config/ConfigurationService';
import { fs, path } from '../../../src/utils/common-imports';
import os from 'os';

describe('Environment Variable Configuration Integration', () => {
  let tempDir: string;
  let originalEnv: NodeJS.ProcessEnv;
  
  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'claude-testing-env-'));
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

  describe('Environment Variable Parsing', () => {
    test('should parse string values correctly', async () => {
      process.env.CLAUDE_TESTING_TEST_FRAMEWORK = 'pytest';
      process.env.CLAUDE_TESTING_AI_MODEL = 'claude-3-haiku-20240307';
      process.env.CLAUDE_TESTING_OUTPUT_FORMAT = 'json';
      
      const service = new ConfigurationService({
        projectPath: tempDir,
        includeEnvVars: true,
        includeUserConfig: false
      });

      const result = await service.loadConfiguration();
      
      expect(result.valid).toBe(true);
      expect(result.config.testFramework).toBe('pytest');
      expect(result.config.aiModel).toBe('claude-3-haiku-20240307');
      expect(result.config.output?.format).toBe('json');
    });

    test('should parse comma-separated arrays correctly', async () => {
      process.env.CLAUDE_TESTING_INCLUDE = 'src/**/*.js,lib/**/*.js,test/**/*.spec.js';
      process.env.CLAUDE_TESTING_EXCLUDE = '**/*.test.js,**/*.mock.js,node_modules/**';
      
      const service = new ConfigurationService({
        projectPath: tempDir,
        includeEnvVars: true,
        includeUserConfig: false
      });

      const result = await service.loadConfiguration();
      
      expect(result.valid).toBe(true);
      expect(result.config.include).toEqual([
        'src/**/*.js',
        'lib/**/*.js',
        'test/**/*.spec.js'
      ]);
      expect(result.config.exclude).toEqual([
        '**/*.test.js',
        '**/*.mock.js',
        'node_modules/**'
      ]);
    });

    test('should parse boolean values correctly', async () => {
      // Test various boolean representations
      process.env.CLAUDE_TESTING_FEATURES_COVERAGE = 'true';
      process.env.CLAUDE_TESTING_FEATURES_EDGE_CASES = 'false';
      process.env.CLAUDE_TESTING_FEATURES_INTEGRATION_TESTS = '1';
      process.env.CLAUDE_TESTING_FEATURES_MOCKING = '0';
      process.env.CLAUDE_TESTING_OUTPUT_VERBOSE = 'yes';
      process.env.CLAUDE_TESTING_DRY_RUN = 'no';
      
      const service = new ConfigurationService({
        projectPath: tempDir,
        includeEnvVars: true,
        includeUserConfig: false
      });

      const result = await service.loadConfiguration();
      
      expect(result.valid).toBe(true);
      expect(result.config.features.coverage).toBe(true);
      expect(result.config.features.edgeCases).toBe(false);
      expect(result.config.features.integrationTests).toBe(true);
      expect(result.config.features.mocks).toBe(false);
      expect(result.config.output?.verbose).toBe(true);
      expect(result.config.dryRun).toBe(false);
    });

    test('should parse numeric values correctly', async () => {
      process.env.CLAUDE_TESTING_GENERATION_MAX_RETRIES = '5';
      process.env.CLAUDE_TESTING_GENERATION_TIMEOUT_MS = '120000';
      process.env.CLAUDE_TESTING_GENERATION_MAX_TEST_TO_SOURCE_RATIO = '2.5';
      process.env.CLAUDE_TESTING_AI_OPTIONS_MAX_TOKENS = '4096';
      process.env.CLAUDE_TESTING_AI_OPTIONS_TEMPERATURE = '0.7';
      process.env.CLAUDE_TESTING_COST_LIMIT = '10.50';
      
      const service = new ConfigurationService({
        projectPath: tempDir,
        includeEnvVars: true,
        includeUserConfig: false
      });

      const result = await service.loadConfiguration();
      
      expect(result.valid).toBe(true);
      expect(result.config.generation?.maxRetries).toBe(5);
      expect(result.config.generation?.timeoutMs).toBe(120000);
      expect(result.config.generation?.maxTestToSourceRatio).toBe(2.5);
      expect(result.config.aiOptions?.maxTokens).toBe(4096);
      expect(result.config.aiOptions?.temperature).toBe(0.7);
      expect(result.config.costLimit).toBe(10.50);
    });

    test('should parse nested object values correctly', async () => {
      process.env.CLAUDE_TESTING_COVERAGE_THRESHOLDS_GLOBAL_STATEMENTS = '85';
      process.env.CLAUDE_TESTING_COVERAGE_THRESHOLDS_GLOBAL_BRANCHES = '80';
      process.env.CLAUDE_TESTING_COVERAGE_THRESHOLDS_GLOBAL_FUNCTIONS = '75';
      process.env.CLAUDE_TESTING_COVERAGE_THRESHOLDS_GLOBAL_LINES = '90';
      process.env.CLAUDE_TESTING_OUTPUT_LOG_LEVEL = 'debug';
      process.env.CLAUDE_TESTING_OUTPUT_COLORS = 'true';
      
      const service = new ConfigurationService({
        projectPath: tempDir,
        includeEnvVars: true,
        includeUserConfig: false
      });

      const result = await service.loadConfiguration();
      
      expect(result.valid).toBe(true);
      expect(result.config.coverage?.thresholds?.global).toEqual({
        statements: 85,
        branches: 80,
        functions: 75,
        lines: 90
      });
      expect(result.config.output?.logLevel).toBe('debug');
      expect(result.config.output?.colors).toBe(true);
    });
  });

  describe('Special Cases', () => {
    test('should handle empty string values', async () => {
      process.env.CLAUDE_TESTING_CUSTOM_PROMPTS_TEST_GENERATION = '';
      process.env.CLAUDE_TESTING_EXCLUDE = '';
      
      const service = new ConfigurationService({
        projectPath: tempDir,
        includeEnvVars: true,
        includeUserConfig: false
      });

      const result = await service.loadConfiguration();
      
      expect(result.valid).toBe(true);
      // Empty strings should be treated as undefined/not set
      expect(result.config.customPrompts?.testGeneration).toBeUndefined();
      expect(result.config.exclude).toEqual([]); // Empty array for comma-separated
    });

    test('should handle whitespace in comma-separated values', async () => {
      process.env.CLAUDE_TESTING_INCLUDE = ' src/**/*.js , lib/**/*.js , test/**/*.js ';
      
      const service = new ConfigurationService({
        projectPath: tempDir,
        includeEnvVars: true,
        includeUserConfig: false
      });

      const result = await service.loadConfiguration();
      
      expect(result.valid).toBe(true);
      expect(result.config.include).toEqual([
        'src/**/*.js',
        'lib/**/*.js',
        'test/**/*.js'
      ]);
    });

    test('should handle invalid numeric values gracefully', async () => {
      process.env.CLAUDE_TESTING_GENERATION_MAX_RETRIES = 'invalid';
      process.env.CLAUDE_TESTING_AI_OPTIONS_TEMPERATURE = '2.5'; // Out of valid range
      
      const service = new ConfigurationService({
        projectPath: tempDir,
        includeEnvVars: true,
        includeUserConfig: false
      });

      const result = await service.loadConfiguration();
      
      // Should load but may have warnings
      expect(result.config).toBeDefined();
      
      const envSource = result.sources.find(s => s.type === 'env-vars');
      expect(envSource?.warnings.length).toBeGreaterThan(0);
    });

    test('should support all nested path variations', async () => {
      // Test various nested path formats
      process.env.CLAUDE_TESTING_FEATURES_COVERAGE = 'true';
      process.env.CLAUDE_TESTING_FEATURES_EDGE_CASES = 'true';
      process.env.CLAUDE_TESTING_GENERATION_BATCH_SIZE = '10';
      process.env.CLAUDE_TESTING_AI_OPTIONS_MAX_TOKENS = '2048';
      process.env.CLAUDE_TESTING_COVERAGE_REPORTERS = 'text,lcov,html';
      
      const service = new ConfigurationService({
        projectPath: tempDir,
        includeEnvVars: true,
        includeUserConfig: false
      });

      const result = await service.loadConfiguration();
      
      expect(result.valid).toBe(true);
      expect(result.config.features).toMatchObject({
        coverage: true,
        edgeCases: true
      });
      expect(result.config.generation?.batchSize).toBe(10);
      expect(result.config.aiOptions?.maxTokens).toBe(2048);
      expect(result.config.coverage?.reporters).toEqual(['text', 'lcov', 'html']);
    });
  });

  describe('Environment Variable Precedence', () => {
    test('should override project config with env vars', async () => {
      const projectConfigPath = path.join(tempDir, '.claude-testing.config.json');
      await fs.writeFile(projectConfigPath, JSON.stringify({
        testFramework: 'jest',
        aiModel: 'claude-3-opus-20240229',
        features: {
          coverage: false
        }
      }, null, 2));
      
      process.env.CLAUDE_TESTING_TEST_FRAMEWORK = 'pytest';
      process.env.CLAUDE_TESTING_FEATURES_COVERAGE = 'true';
      
      const service = new ConfigurationService({
        projectPath: tempDir,
        includeEnvVars: true,
        includeUserConfig: false
      });

      const result = await service.loadConfiguration();
      
      expect(result.valid).toBe(true);
      expect(result.config.testFramework).toBe('pytest'); // Env overrides project
      expect(result.config.aiModel).toBe('claude-3-opus-20240229'); // From project (not overridden)
      expect(result.config.features.coverage).toBe(true); // Env overrides project
    });

    test('should be overridden by CLI args', async () => {
      process.env.CLAUDE_TESTING_TEST_FRAMEWORK = 'pytest';
      process.env.CLAUDE_TESTING_OUTPUT_VERBOSE = 'false';
      
      const service = new ConfigurationService({
        projectPath: tempDir,
        includeEnvVars: true,
        includeUserConfig: false,
        cliArgs: {
          framework: 'jest',
          verbose: true
        }
      });

      const result = await service.loadConfiguration();
      
      expect(result.valid).toBe(true);
      expect(result.config.testFramework).toBe('jest'); // CLI overrides env
      expect(result.config.output?.verbose).toBe(true); // CLI overrides env
    });
  });

  describe('Real-world Scenarios', () => {
    test('should handle CI/CD environment setup', async () => {
      // Simulate common CI environment variables
      process.env.CLAUDE_TESTING_TEST_FRAMEWORK = 'jest';
      process.env.CLAUDE_TESTING_COVERAGE_ENABLED = 'true';
      process.env.CLAUDE_TESTING_COVERAGE_REPORTERS = 'text,lcov';
      process.env.CLAUDE_TESTING_COVERAGE_THRESHOLDS_GLOBAL_STATEMENTS = '90';
      process.env.CLAUDE_TESTING_COVERAGE_THRESHOLDS_GLOBAL_BRANCHES = '85';
      process.env.CLAUDE_TESTING_OUTPUT_FORMAT = 'json';
      process.env.CLAUDE_TESTING_OUTPUT_VERBOSE = 'false';
      process.env.CLAUDE_TESTING_FEATURES_INTEGRATION_TESTS = 'true';
      process.env.CLAUDE_TESTING_COST_LIMIT = '50.00';
      
      const service = new ConfigurationService({
        projectPath: tempDir,
        includeEnvVars: true,
        includeUserConfig: false
      });

      const result = await service.loadConfiguration();
      
      expect(result.valid).toBe(true);
      expect(result.config).toMatchObject({
        testFramework: 'jest',
        coverage: {
          enabled: true,
          reporters: ['text', 'lcov'],
          thresholds: {
            global: {
              statements: 90,
              branches: 85
            }
          }
        },
        output: {
          format: 'json',
          verbose: false
        },
        features: {
          integrationTests: true
        },
        costLimit: 50.00
      });
    });

    test('should handle Docker environment with model switching', async () => {
      // Simulate Docker environment with alternative model
      process.env.CLAUDE_TESTING_AI_MODEL = 'claude-3-haiku-20240307';
      process.env.CLAUDE_TESTING_AI_OPTIONS_MAX_TOKENS = '2048';
      process.env.CLAUDE_TESTING_AI_OPTIONS_TEMPERATURE = '0.5';
      process.env.CLAUDE_TESTING_GENERATION_BATCH_SIZE = '5';
      process.env.CLAUDE_TESTING_GENERATION_TIMEOUT_MS = '60000';
      process.env.CLAUDE_TESTING_DRY_RUN = 'false';
      
      const service = new ConfigurationService({
        projectPath: tempDir,
        includeEnvVars: true,
        includeUserConfig: false
      });

      const result = await service.loadConfiguration();
      
      expect(result.valid).toBe(true);
      expect(result.config.aiModel).toBe('claude-3-haiku-20240307');
      expect(result.config.aiOptions).toMatchObject({
        maxTokens: 2048,
        temperature: 0.5
      });
      expect(result.config.generation).toMatchObject({
        batchSize: 5,
        timeoutMs: 60000
      });
      expect(result.config.dryRun).toBe(false);
    });
  });
});