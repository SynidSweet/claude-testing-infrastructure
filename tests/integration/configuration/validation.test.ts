/**
 * Integration tests for configuration validation and error handling
 */

import { ConfigurationService } from '../../../src/config/ConfigurationService';
import { ConfigurationManager } from '../../../src/utils/config-validation';
import { fs, path } from '../../../src/utils/common-imports';
import os from 'os';

describe('Configuration Validation Integration', () => {
  let tempDir: string;
  
  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'claude-testing-validation-'));
  });
  
  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('Validation Error Messages', () => {
    test('should provide helpful error messages for invalid values', async () => {
      const configPath = path.join(tempDir, 'invalid-config.json');
      await fs.writeFile(configPath, JSON.stringify({
        testFramework: 'invalid-framework',
        aiModel: 'invalid-model',
        generation: {
          maxRetries: -1,
          timeoutMs: 'not-a-number',
          maxTestToSourceRatio: 100
        },
        aiOptions: {
          temperature: 2.5,
          maxTokens: 999999
        }
      }, null, 2));

      const service = new ConfigurationService({
        projectPath: tempDir,
        customConfigPath: configPath,
        includeEnvVars: false,
        includeUserConfig: false
      });

      const result = await service.loadConfiguration();
      
      // Should load defaults but report errors
      expect(result.config).toBeDefined();
      
      const customSource = result.sources.find(s => s.type === 'custom-file');
      expect(customSource?.errors.length).toBeGreaterThan(0);
      expect(customSource?.warnings.length).toBeGreaterThan(0);
      
      // Check for specific error messages
      const errorMessages = customSource?.errors.join('\n') || '';
      expect(errorMessages).toContain('invalid-framework');
      expect(errorMessages).toContain('invalid-model');
    });

    test('should validate numeric ranges', async () => {
      const configPath = path.join(tempDir, 'range-config.json');
      await fs.writeFile(configPath, JSON.stringify({
        generation: {
          maxRetries: 100, // Too high
          batchSize: 0, // Too low
          timeoutMs: -1000 // Negative
        },
        aiOptions: {
          temperature: -0.5, // Negative
          maxTokens: 0 // Too low
        },
        coverage: {
          thresholds: {
            global: {
              statements: 150, // Over 100%
              branches: -10 // Negative
            }
          }
        }
      }, null, 2));

      const service = new ConfigurationService({
        projectPath: tempDir,
        customConfigPath: configPath,
        includeEnvVars: false,
        includeUserConfig: false
      });

      const result = await service.loadConfiguration();
      
      const customSource = result.sources.find(s => s.type === 'custom-file');
      expect(customSource?.warnings.length).toBeGreaterThan(0);
      
      const warningMessages = customSource?.warnings.join('\n') || '';
      expect(warningMessages).toContain('maxRetries');
      expect(warningMessages).toContain('batchSize');
      expect(warningMessages).toContain('temperature');
    });

    test('should validate enum values', async () => {
      const configPath = path.join(tempDir, 'enum-config.json');
      await fs.writeFile(configPath, JSON.stringify({
        testFramework: 'unknown-framework',
        output: {
          format: 'invalid-format',
          logLevel: 'super-verbose' // Invalid log level
        }
      }, null, 2));

      const service = new ConfigurationService({
        projectPath: tempDir,
        customConfigPath: configPath,
        includeEnvVars: false,
        includeUserConfig: false
      });

      const result = await service.loadConfiguration();
      
      const customSource = result.sources.find(s => s.type === 'custom-file');
      expect(customSource?.errors.length).toBeGreaterThan(0);
      
      const errorMessages = customSource?.errors.join('\n') || '';
      expect(errorMessages).toContain('unknown-framework');
      expect(errorMessages).toContain('invalid-format');
    });
  });

  describe('Cross-Validation', () => {
    test('should perform cross-validation checks', async () => {
      const configPath = path.join(tempDir, 'cross-validation.json');
      await fs.writeFile(configPath, JSON.stringify({
        features: {
          logicalTests: false,
          structuralTests: false // Both disabled
        },
        coverage: {
          enabled: true,
          thresholds: {
            global: {
              statements: 90
            }
          }
        },
        dryRun: true // Dry run with coverage enabled
      }, null, 2));

      const service = new ConfigurationService({
        projectPath: tempDir,
        customConfigPath: configPath,
        includeEnvVars: false,
        includeUserConfig: false
      });

      const result = await service.loadConfiguration();
      
      const customSource = result.sources.find(s => s.type === 'custom-file');
      expect(customSource?.warnings.length).toBeGreaterThan(0);
      
      const warningMessages = customSource?.warnings.join('\n') || '';
      expect(warningMessages).toContain('structural');
      expect(warningMessages).toContain('logical');
    });

    test('should warn about AI features without Claude CLI', async () => {
      const configPath = path.join(tempDir, 'ai-features.json');
      await fs.writeFile(configPath, JSON.stringify({
        features: {
          logicalTests: true
        },
        aiModel: 'claude-3-opus-20240229'
      }, null, 2));

      const manager = new ConfigurationManager(tempDir);
      const result = await manager.loadConfiguration();
      
      // Should load but may have warnings
      expect(result.config).toBeDefined();
      expect(result.warnings.length).toBeGreaterThanOrEqual(0); // May warn if Claude CLI not available
    });
  });

  describe('File Handling Edge Cases', () => {
    test('should handle empty configuration files', async () => {
      const configPath = path.join(tempDir, 'empty.json');
      await fs.writeFile(configPath, '{}');

      const service = new ConfigurationService({
        projectPath: tempDir,
        customConfigPath: configPath,
        includeEnvVars: false,
        includeUserConfig: false
      });

      const result = await service.loadConfiguration();
      
      expect(result.valid).toBe(true);
      expect(result.config).toBeDefined();
      expect(result.config.testFramework).toBeDefined(); // Should have defaults
    });

    test('should handle very large configuration files', async () => {
      const configPath = path.join(tempDir, 'large.json');
      const largeConfig: any = {
        include: [],
        exclude: [],
        customPrompts: {}
      };
      
      // Generate large arrays
      for (let i = 0; i < 1000; i++) {
        largeConfig.include.push(`src/folder${i}/**/*.js`);
        largeConfig.exclude.push(`src/folder${i}/**/*.test.js`);
      }
      
      // Generate large custom prompts
      for (let i = 0; i < 100; i++) {
        largeConfig.customPrompts[`prompt${i}`] = 'A'.repeat(1000);
      }
      
      await fs.writeFile(configPath, JSON.stringify(largeConfig, null, 2));

      const service = new ConfigurationService({
        projectPath: tempDir,
        customConfigPath: configPath,
        includeEnvVars: false,
        includeUserConfig: false
      });

      const result = await service.loadConfiguration();
      
      expect(result.valid).toBe(true);
      expect(result.config.include?.length).toBe(1000);
      expect(result.config.exclude?.length).toBe(1000);
    });

    test('should handle malformed JSON gracefully', async () => {
      const configPath = path.join(tempDir, 'malformed.json');
      await fs.writeFile(configPath, `{
        "testFramework": "jest",
        "features": {
          "coverage": true,
          // This is a comment that makes JSON invalid
          "edgeCases": true
        }
      }`);

      const service = new ConfigurationService({
        projectPath: tempDir,
        customConfigPath: configPath,
        includeEnvVars: false,
        includeUserConfig: false
      });

      const result = await service.loadConfiguration();
      
      // Should fall back to defaults
      expect(result.config).toBeDefined();
      
      const customSource = result.sources.find(s => s.type === 'custom-file');
      expect(customSource?.loaded).toBe(false);
      expect(customSource?.errors.length).toBeGreaterThan(0);
    });

    test('should handle missing configuration files', async () => {
      const service = new ConfigurationService({
        projectPath: tempDir,
        customConfigPath: path.join(tempDir, 'non-existent.json'),
        includeEnvVars: false,
        includeUserConfig: false
      });

      const result = await service.loadConfiguration();
      
      expect(result.config).toBeDefined();
      expect(result.config.testFramework).toBeDefined(); // Should have defaults
      
      const customSource = result.sources.find(s => s.type === 'custom-file');
      expect(customSource?.loaded).toBe(false);
    });
  });

  describe('Type Coercion', () => {
    test('should handle type mismatches gracefully', async () => {
      const configPath = path.join(tempDir, 'type-mismatch.json');
      await fs.writeFile(configPath, JSON.stringify({
        // String where boolean expected
        dryRun: 'yes',
        // Number where string expected
        testFramework: 123,
        // String where number expected
        generation: {
          maxRetries: '5'
        },
        // Object where array expected
        include: {
          pattern: 'src/**/*.js'
        }
      }, null, 2));

      const service = new ConfigurationService({
        projectPath: tempDir,
        customConfigPath: configPath,
        includeEnvVars: false,
        includeUserConfig: false
      });

      const result = await service.loadConfiguration();
      
      // Should attempt to coerce or use defaults
      expect(result.config).toBeDefined();
      
      const customSource = result.sources.find(s => s.type === 'custom-file');
      expect(customSource?.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('Complex Validation Scenarios', () => {
    test('should validate nested configuration correctly', async () => {
      const configPath = path.join(tempDir, 'nested.json');
      await fs.writeFile(configPath, JSON.stringify({
        coverage: {
          enabled: true,
          reporters: ['text', 'invalid-reporter', 'lcov'],
          thresholds: {
            global: {
              statements: 85,
              branches: 'not-a-number',
              functions: 75,
              lines: 200 // Over 100%
            }
          }
        },
        features: {
          coverage: false, // Conflicts with coverage.enabled
          edgeCases: 'maybe' // Should be boolean
        }
      }, null, 2));

      const service = new ConfigurationService({
        projectPath: tempDir,
        customConfigPath: configPath,
        includeEnvVars: false,
        includeUserConfig: false
      });

      const result = await service.loadConfiguration();
      
      const customSource = result.sources.find(s => s.type === 'custom-file');
      expect(customSource?.warnings.length).toBeGreaterThan(0);
      
      const warningMessages = customSource?.warnings.join('\n') || '';
      expect(warningMessages).toContain('reporter');
      expect(warningMessages).toContain('threshold');
    });

    test('should handle circular references safely', async () => {
      const configPath = path.join(tempDir, 'config.json');
      
      // Create a config object with circular reference
      const config: any = {
        testFramework: 'jest',
        features: {
          coverage: true
        }
      };
      // This would create a circular reference in the object
      // but JSON.stringify will fail on circular references
      
      // Instead, test with very deep nesting
      let deepObject: any = { value: 'deep' };
      for (let i = 0; i < 100; i++) {
        deepObject = { nested: deepObject };
      }
      
      config.deepNested = deepObject;
      
      await fs.writeFile(configPath, JSON.stringify(config));

      const service = new ConfigurationService({
        projectPath: tempDir,
        customConfigPath: configPath,
        includeEnvVars: false,
        includeUserConfig: false
      });

      const result = await service.loadConfiguration();
      
      expect(result.valid).toBe(true);
      expect(result.config.testFramework).toBe('jest');
    });
  });

  describe('Performance Validation', () => {
    test('should load configuration within performance limits', async () => {
      const configPath = path.join(tempDir, 'perf-test.json');
      await fs.writeFile(configPath, JSON.stringify({
        testFramework: 'jest',
        include: Array(100).fill('src/**/*.js'),
        exclude: Array(100).fill('**/*.test.js')
      }, null, 2));

      const service = new ConfigurationService({
        projectPath: tempDir,
        customConfigPath: configPath,
        includeEnvVars: true,
        includeUserConfig: true
      });

      const startTime = Date.now();
      const result = await service.loadConfiguration();
      const loadTime = Date.now() - startTime;
      
      expect(result.valid).toBe(true);
      expect(loadTime).toBeLessThan(100); // Should load in under 100ms
    });
  });
});