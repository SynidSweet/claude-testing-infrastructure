/**
 * Tests for ConfigurationService integration
 */

import { ConfigurationService } from '../../src/config/ConfigurationService';
import { fs, path } from '../../src/utils/common-imports';
import { createTemporaryProject, FIXTURE_TEMPLATES } from '../fixtures/shared/fixtures';

describe('ConfigurationService', () => {
  let tempDir: string;
  
  beforeEach(async () => {
    tempDir = await createTemporaryProject(FIXTURE_TEMPLATES.EMPTY);
  });
  
  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('CLI Integration', () => {
    test('should integrate CLI arguments correctly', async () => {
      const service = new ConfigurationService({
        projectPath: tempDir,
        includeEnvVars: true,
        includeUserConfig: true,
        cliArgs: {
          verbose: true,
          coverage: true,
          framework: 'jest',
          maxRatio: 15
        }
      });

      const result = await service.loadConfiguration();
      
      expect(result.valid).toBe(true);
      expect(result.config.output?.logLevel).toBe('verbose');
      expect(result.config.coverage?.enabled).toBe(true);
      expect(result.config.testFramework).toBe('jest');
      expect(result.config.generation?.maxTestToSourceRatio).toBe(15);
    });

    test('should handle custom config file path', async () => {
      // Create a custom config file
      const customConfigPath = path.join(tempDir, 'custom-config.json');
      const customConfig = {
        testFramework: 'vitest',
        aiModel: 'claude-3-opus-20240229',
        features: {
          coverage: false
        }
      };
      await fs.writeFile(customConfigPath, JSON.stringify(customConfig, null, 2));

      const service = new ConfigurationService({
        projectPath: tempDir,
        customConfigPath,
        includeEnvVars: false,
        includeUserConfig: false
      });

      const result = await service.loadConfiguration();
      
      expect(result.valid).toBe(true);
      expect(result.config.testFramework).toBe('vitest');
      expect(result.config.aiModel).toBe('claude-3-opus-20240229');
    });

    test('should merge CLI args with project config correctly', async () => {
      // Create project config
      const projectConfigPath = path.join(tempDir, '.claude-testing.config.json');
      const projectConfig = {
        testFramework: 'pytest',
        include: ['src/**/*.py'],
        exclude: ['**/*.test.py']
      };
      await fs.writeFile(projectConfigPath, JSON.stringify(projectConfig, null, 2));

      const service = new ConfigurationService({
        projectPath: tempDir,
        includeEnvVars: false,
        includeUserConfig: false,
        cliArgs: {
          verbose: true,
          framework: 'jest' // Should override project config
        }
      });

      const result = await service.loadConfiguration();
      
      expect(result.valid).toBe(true);
      expect(result.config.testFramework).toBe('jest'); // CLI override
      expect(result.config.include).toEqual(['src/**/*.py']); // From project config
      expect(result.config.output?.logLevel).toBe('verbose'); // From CLI
    });

    test('should handle threshold parsing', async () => {
      const service = new ConfigurationService({
        projectPath: tempDir,
        includeEnvVars: false,
        includeUserConfig: false,
        cliArgs: {
          threshold: 'statements:85,branches:75'
        }
      });

      const result = await service.loadConfiguration();
      
      expect(result.valid).toBe(true);
      expect(result.config.coverage?.thresholds?.global?.statements).toBe(85);
      expect(result.config.coverage?.thresholds?.global?.branches).toBe(75);
    });
  });

  describe('Configuration Sources', () => {
    test('should track configuration sources properly', async () => {
      const service = new ConfigurationService({
        projectPath: tempDir,
        includeEnvVars: true,
        includeUserConfig: true,
        cliArgs: {
          verbose: true
        }
      });

      const result = await service.loadConfiguration();
      
      expect(result.sources.length).toBeGreaterThan(0);
      
      const sourceTypes = result.sources.map(s => s.type);
      expect(sourceTypes).toContain('defaults');
      expect(sourceTypes).toContain('cli-args');
      
      // Check that CLI args source was loaded
      const cliSource = result.sources.find(s => s.type === 'cli-args');
      expect(cliSource?.loaded).toBe(true);
      expect(cliSource?.data).toHaveProperty('output');
    });

    test('should provide configuration summary', async () => {
      const service = new ConfigurationService({
        projectPath: tempDir,
        includeEnvVars: true,
        includeUserConfig: true
      });

      const result = await service.loadConfiguration();
      
      expect(result.summary).toBeDefined();
      expect(result.summary.sourcesLoaded).toBeGreaterThan(0);
      expect(result.summary.totalErrors).toBeGreaterThanOrEqual(0);
      expect(result.summary.totalWarnings).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid custom config file gracefully', async () => {
      const invalidConfigPath = path.join(tempDir, 'invalid.json');
      await fs.writeFile(invalidConfigPath, '{ invalid json }');

      const service = new ConfigurationService({
        projectPath: tempDir,
        customConfigPath: invalidConfigPath,
        includeEnvVars: false,
        includeUserConfig: false
      });

      const result = await service.loadConfiguration();
      
      // Should still load with defaults even if custom config is invalid
      expect(result.config).toBeDefined();
      
      const customSource = result.sources.find(s => s.type === 'custom-file');
      expect(customSource?.loaded).toBe(false);
      expect(customSource?.errors.length).toBeGreaterThan(0);
    });

    test('should provide configuration even when no sources are available', async () => {
      const service = new ConfigurationService({
        projectPath: tempDir,
        includeEnvVars: false,
        includeUserConfig: false
      });

      const result = await service.loadConfiguration();
      
      expect(result.config).toBeDefined();
      expect(result.config.testFramework).toBeDefined(); // From defaults
      expect(result.sources.length).toBeGreaterThan(0); // At least defaults
    });
  });
});