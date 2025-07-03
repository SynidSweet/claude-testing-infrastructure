/**
 * Integration tests for command-specific configuration behavior
 */

import { ConfigurationService } from '../../../src/config/ConfigurationService';
import { fs, path } from '../../../src/utils/common-imports';
import os from 'os';

describe('Command Configuration Integration', () => {
  let tempDir: string;
  let originalEnv: NodeJS.ProcessEnv;
  
  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'claude-testing-cmd-'));
    originalEnv = { ...process.env };
  });
  
  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
    process.env = originalEnv;
  });

  describe('Analyze Command', () => {
    test('should map analyze command arguments correctly', async () => {
      const service = new ConfigurationService({
        projectPath: tempDir,
        includeEnvVars: false,
        includeUserConfig: false,
        cliArgs: {
          format: 'json',
          verbose: true,
          output: 'analysis.json'
        }
      });

      const result = await service.loadConfiguration();
      
      expect(result.valid).toBe(true);
      expect(result.config.output?.formats).toContain('json');
      expect(result.config.output?.logLevel).toBe('verbose');
      expect(result.config.output?.file).toBe('analysis.json');
    });

    test('should handle console format flag', async () => {
      const service = new ConfigurationService({
        projectPath: tempDir,
        includeEnvVars: false,
        includeUserConfig: false,
        cliArgs: {
          format: 'console'
        }
      });

      const result = await service.loadConfiguration();
      
      expect(result.valid).toBe(true);
      expect(result.config.output?.format).toBe('console');
    });
  });

  describe('Test Command', () => {
    test('should map test command arguments correctly', async () => {
      const service = new ConfigurationService({
        projectPath: tempDir,
        includeEnvVars: false,
        includeUserConfig: false,
        cliArgs: {
          framework: 'pytest',
          onlyStructural: true,
          dryRun: true,
          maxRatio: 3
        }
      });

      const result = await service.loadConfiguration();
      
      expect(result.valid).toBe(true);
      expect(result.config.testFramework).toBe('pytest');
      expect(result.config.features.logicalTests).toBe(false); // onlyStructural disables logical
      // dryRun is a CLI option, not a config property
      expect(result.config.generation?.maxTestToSourceRatio).toBe(3);
    });

    test('should handle onlyLogical flag', async () => {
      const service = new ConfigurationService({
        projectPath: tempDir,
        includeEnvVars: false,
        includeUserConfig: false,
        cliArgs: {
          onlyLogical: true
        }
      });

      const result = await service.loadConfiguration();
      
      expect(result.valid).toBe(true);
      expect(result.config.features.structuralTests).toBe(false);
      expect(result.config.features.logicalTests).toBe(true);
    });

    test('should handle mutually exclusive flags', async () => {
      const service = new ConfigurationService({
        projectPath: tempDir,
        includeEnvVars: false,
        includeUserConfig: false,
        cliArgs: {
          onlyStructural: true,
          onlyLogical: true // Should be ignored due to mutual exclusion
        }
      });

      const result = await service.loadConfiguration();
      
      expect(result.config.features.logicalTests).toBe(false);
      expect(result.config.features.structuralTests).toBe(true);
    });
  });

  describe('Run Command', () => {
    test('should map run command arguments correctly', async () => {
      const service = new ConfigurationService({
        projectPath: tempDir,
        includeEnvVars: false,
        includeUserConfig: false,
        cliArgs: {
          coverage: true,
          threshold: 'statements:90,branches:85,functions:80,lines:95',
          reporter: ['text', 'lcov', 'html']
        }
      });

      const result = await service.loadConfiguration();
      
      expect(result.valid).toBe(true);
      expect(result.config.coverage?.enabled).toBe(true);
      expect(result.config.coverage?.thresholds?.global).toEqual({
        statements: 90,
        branches: 85,
        functions: 80,
        lines: 95
      });
      expect(result.config.coverage?.reporters).toEqual(['text', 'lcov', 'html']);
    });

    test('should handle partial threshold settings', async () => {
      const service = new ConfigurationService({
        projectPath: tempDir,
        includeEnvVars: false,
        includeUserConfig: false,
        cliArgs: {
          threshold: 'statements:85,lines:90'
        }
      });

      const result = await service.loadConfiguration();
      
      expect(result.valid).toBe(true);
      expect(result.config.coverage?.thresholds?.global?.statements).toBe(85);
      expect(result.config.coverage?.thresholds?.global?.lines).toBe(90);
      // Note: branches and functions will have default values from DEFAULT_CONFIG
      expect(result.config.coverage?.thresholds?.global?.branches).toBe(70);
      expect(result.config.coverage?.thresholds?.global?.functions).toBe(80);
    });
  });

  describe('Incremental Command', () => {
    test('should map incremental command arguments correctly', async () => {
      const service = new ConfigurationService({
        projectPath: tempDir,
        includeEnvVars: false,
        includeUserConfig: false,
        cliArgs: {
          dryRun: true,
          baseline: true,
          stats: true,
          costLimit: 25.50
        }
      });

      const result = await service.loadConfiguration();
      
      expect(result.valid).toBe(true);
      // dryRun is a CLI option, not a config property
      expect(result.config.incremental?.baseline).toBe(true);
      expect(result.config.incremental?.showStats).toBe(true);
      expect(result.config.costLimit).toBe(25.50);
    });
  });

  describe('Watch Command', () => {
    test('should map watch command arguments correctly', async () => {
      const service = new ConfigurationService({
        projectPath: tempDir,
        includeEnvVars: false,
        includeUserConfig: false,
        cliArgs: {
          debounce: 500,
          verbose: true
        }
      });

      const result = await service.loadConfiguration();
      
      expect(result.valid).toBe(true);
      expect(result.config.watch?.debounceMs).toBe(500);
      expect(result.config.output?.logLevel).toBe('verbose');
    });
  });

  describe('Generate-Logical-Batch Command', () => {
    test('should map batch generation arguments correctly', async () => {
      const service = new ConfigurationService({
        projectPath: tempDir,
        includeEnvVars: false,
        includeUserConfig: false,
        cliArgs: {
          batchSize: 20,
          maxRetries: 5,
          costLimit: 100
        }
      });

      const result = await service.loadConfiguration();
      
      expect(result.valid).toBe(true);
      expect(result.config.generation?.batchSize).toBe(20);
      expect(result.config.generation?.maxRetries).toBe(5);
      expect(result.config.costLimit).toBe(100);
    });
  });

  describe('Command Interaction with Project Config', () => {
    test('should let CLI args override project config', async () => {
      const projectConfigPath = path.join(tempDir, '.claude-testing.config.json');
      await fs.writeFile(projectConfigPath, JSON.stringify({
        testFramework: 'jest',
        coverage: {
          enabled: false,
          thresholds: {
            global: {
              statements: 80
            }
          }
        }
      }, null, 2));
      
      const service = new ConfigurationService({
        projectPath: tempDir,
        includeEnvVars: false,
        includeUserConfig: false,
        cliArgs: {
          framework: 'pytest',
          coverage: true,
          threshold: 'statements:90'
        }
      });

      const result = await service.loadConfiguration();
      
      expect(result.valid).toBe(true);
      expect(result.config.testFramework).toBe('pytest'); // CLI overrides
      expect(result.config.coverage?.enabled).toBe(true); // CLI overrides
      expect(result.config.coverage?.thresholds?.global?.statements).toBe(90); // CLI overrides
    });

    test('should merge CLI args with project config', async () => {
      const projectConfigPath = path.join(tempDir, '.claude-testing.config.json');
      await fs.writeFile(projectConfigPath, JSON.stringify({
        include: ['src/**/*.js'],
        exclude: ['**/*.test.js'],
        features: {
          coverage: true,
          edgeCases: true
        }
      }, null, 2));
      
      const service = new ConfigurationService({
        projectPath: tempDir,
        includeEnvVars: false,
        includeUserConfig: false,
        cliArgs: {
          verbose: true,
          dryRun: true
        }
      });

      const result = await service.loadConfiguration();
      
      expect(result.valid).toBe(true);
      // From project config
      expect(result.config.include).toEqual(['src/**/*.js']);
      expect(result.config.exclude).toEqual(['**/*.test.js']);
      expect(result.config.features.coverage).toBe(true);
      expect(result.config.features.edgeCases).toBe(true);
      // From CLI args
      expect(result.config.output?.logLevel).toBe('verbose');
      // dryRun is a CLI option, not a config property
    });
  });

  describe('Error Scenarios', () => {
    test('should handle invalid threshold format gracefully', async () => {
      const service = new ConfigurationService({
        projectPath: tempDir,
        includeEnvVars: false,
        includeUserConfig: false,
        cliArgs: {
          threshold: 'invalid:format:here'
        }
      });

      const result = await service.loadConfiguration();
      
      // Should still load but may have warnings
      expect(result.config).toBeDefined();
      
      const cliSource = result.sources.find(s => s.type === 'cli-args');
      expect(cliSource?.errors.length).toBeGreaterThan(0);
    });

    test('should handle conflicting framework specifications', async () => {
      const projectConfigPath = path.join(tempDir, '.claude-testing.config.json');
      await fs.writeFile(projectConfigPath, JSON.stringify({
        testFramework: 'invalid-framework'
      }, null, 2));
      
      const service = new ConfigurationService({
        projectPath: tempDir,
        includeEnvVars: false,
        includeUserConfig: false,
        cliArgs: {
          framework: 'jest' // Valid framework from CLI
        }
      });

      const result = await service.loadConfiguration();
      
      // Project config has errors, but CLI overrides with valid value
      expect(result.valid).toBe(false); // Invalid because project config has errors
      expect(result.config.testFramework).toBe('jest'); // CLI valid value wins in final config
      
      // Verify project config has errors but CLI doesn't
      const projectSource = result.sources.find(s => s.type === 'project-config');
      expect(projectSource?.errors.length).toBeGreaterThan(0);
      
      const cliSource = result.sources.find(s => s.type === 'cli-args');
      expect(cliSource?.errors.length).toBe(0);
    });
  });

  describe('Real Command Scenarios', () => {
    test('should handle typical test generation scenario', async () => {
      const projectConfigPath = path.join(tempDir, '.claude-testing.config.json');
      await fs.writeFile(projectConfigPath, JSON.stringify({
        include: ['src/**/*.ts'],
        exclude: ['**/*.test.ts', '**/*.spec.ts'],
        testFramework: 'jest',
        features: {
          coverage: true,
          edgeCases: true,
          integrationTests: false
        }
      }, null, 2));
      
      process.env.CLAUDE_TESTING_AI_MODEL = 'claude-3-5-sonnet-20241022';
      process.env.CLAUDE_TESTING_COST_LIMIT = '50.00';
      
      const service = new ConfigurationService({
        projectPath: tempDir,
        includeEnvVars: true,
        includeUserConfig: false,
        cliArgs: {
          dryRun: true,
          verbose: true,
          maxRatio: 2
        }
      });

      const result = await service.loadConfiguration();
      
      expect(result.valid).toBe(true);
      expect(result.config).toMatchObject({
        testFramework: 'jest',
        include: ['src/**/*.ts'],
        exclude: ['**/*.test.ts', '**/*.spec.ts'],
        aiModel: 'claude-3-5-sonnet-20241022',
        costLimit: 50.00,
        dryRun: true,
        generation: {
          maxTestToSourceRatio: 2
        },
        output: {
          logLevel: 'verbose'
        },
        features: {
          coverage: true,
          edgeCases: true,
          integrationTests: false
        }
      });
    });

    test('should handle CI/CD test run scenario', async () => {
      process.env.CI = 'true';
      process.env.CLAUDE_TESTING_COVERAGE_ENABLED = 'true';
      process.env.CLAUDE_TESTING_COVERAGE_REPORTERS = 'text,lcov';
      process.env.CLAUDE_TESTING_OUTPUT_FORMAT = 'json';
      
      const service = new ConfigurationService({
        projectPath: tempDir,
        includeEnvVars: true,
        includeUserConfig: false,
        cliArgs: {
          threshold: 'statements:90,branches:85,functions:80,lines:90'
        }
      });

      const result = await service.loadConfiguration();
      
      expect(result.valid).toBe(true);
      expect(result.config.coverage).toMatchObject({
        enabled: true,
        reporters: ['text', 'lcov'],
        thresholds: {
          global: {
            statements: 90,
            branches: 85,
            functions: 80,
            lines: 90
          }
        }
      });
      expect(result.config.output?.formats).toContain('json');
    });
  });
});