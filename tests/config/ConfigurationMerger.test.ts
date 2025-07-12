/**
 * Tests for ConfigurationMerger
 */

import { ConfigurationMerger } from '../../src/config/ConfigurationMerger';
import { ConfigurationSourceType, type ConfigurationSource } from '../../src/config/loaders';

describe('ConfigurationMerger', () => {
  let merger: ConfigurationMerger;
  
  beforeEach(() => {
    merger = new ConfigurationMerger({ projectPath: '/test/project' });
  });

  describe('constructor', () => {
    it('should initialize with project path', () => {
      expect(merger).toBeInstanceOf(ConfigurationMerger);
    });
  });

  describe('deepMerge', () => {
    it('should merge simple objects', () => {
      const target = { a: 1, b: 2 };
      const source = { b: 3, c: 4 };
      
      const result = merger.deepMerge(target, source);
      
      expect(result).toEqual({ a: 1, b: 3, c: 4 });
    });

    it('should merge nested objects recursively', () => {
      const target = { 
        features: { coverage: true, logicalTests: false },
        generation: { maxFiles: 10 }
      };
      const source = { 
        features: { logicalTests: true, mocking: true },
        ai: { model: 'sonnet' }
      };
      
      const result = merger.deepMerge(target, source);
      
      expect(result).toEqual({
        features: { coverage: true, logicalTests: true, mocking: true },
        generation: { maxFiles: 10 },
        ai: { model: 'sonnet' }
      });
    });

    it('should handle arrays by overriding completely', () => {
      const target = { include: ['src/**/*.js'] };
      const source = { include: ['lib/**/*.ts'] };
      
      const result = merger.deepMerge(target, source);
      
      expect(result).toEqual({ include: ['lib/**/*.ts'] });
    });

    it('should handle null and false values correctly', () => {
      const target = { enabled: true, value: 'test' };
      const source = { enabled: false, value: null, newProp: false };
      
      const result = merger.deepMerge(target, source);
      
      expect(result).toEqual({ enabled: false, value: null, newProp: false });
    });

    it('should skip undefined values', () => {
      const target = { a: 1, b: 2 };
      const source = { b: undefined, c: 3 };
      
      const result = merger.deepMerge(target, source);
      
      expect(result).toEqual({ a: 1, b: 2, c: 3 });
    });

    it('should handle primitive to object conversion', () => {
      const target = { features: 'string' };
      const source = { features: { coverage: true } };
      
      const result = merger.deepMerge(target, source);
      
      expect(result).toEqual({ features: { coverage: true } });
    });
  });

  describe('mergeConfigurations', () => {
    const createSource = (
      type: ConfigurationSourceType,
      data: any,
      loaded = true,
      errors: string[] = [],
      warnings: string[] = []
    ): ConfigurationSource => ({
      type,
      data,
      loaded,
      errors,
      warnings,
      loadedAt: new Date(),
    });

    it('should merge multiple sources in precedence order', () => {
      const sources: ConfigurationSource[] = [
        createSource(ConfigurationSourceType.DEFAULT, {
          testFramework: 'jest',
          include: ['src/**/*.js'],
          features: { coverage: false }
        }),
        createSource(ConfigurationSourceType.PROJECT, {
          include: ['lib/**/*.ts'],
          features: { coverage: true, logicalTests: false }
        }),
        createSource(ConfigurationSourceType.CLI_ARGS, {
          features: { logicalTests: true }
        })
      ];

      const result = merger.mergeConfigurations(sources);

      // Note: include gets defaults merged in, so check that our override is preserved
      expect(result.config.include).toContain('lib/**/*.ts');
      expect(result.config.features.coverage).toBe(true);
      expect(result.config.features.logicalTests).toBe(true);
      expect(result.sourcesMerged).toBe(3);
    });

    it('should skip unloaded sources', () => {
      const sources: ConfigurationSource[] = [
        createSource(ConfigurationSourceType.DEFAULT, { testFramework: 'jest' }),
        createSource(ConfigurationSourceType.PROJECT, { include: ['test'] }, false), // not loaded
        createSource(ConfigurationSourceType.CLI_ARGS, { features: { coverage: true } })
      ];

      const result = merger.mergeConfigurations(sources);

      expect(result.sourcesMerged).toBe(2);
      // include will have default values from validation, not the unloaded source
      expect(result.config.include).toBeDefined();
      expect(result.config.include).not.toContain('test');
    });

    it('should collect errors and warnings from all sources', () => {
      const sources: ConfigurationSource[] = [
        createSource(
          ConfigurationSourceType.DEFAULT, 
          { testFramework: 'jest' },
          true,
          ['Error 1'],
          ['Warning 1']
        ),
        createSource(
          ConfigurationSourceType.PROJECT,
          { include: ['test'] },
          true,
          ['Error 2', 'Error 3'],
          ['Warning 2']
        )
      ];

      const result = merger.mergeConfigurations(sources);

      expect(result.totalErrors).toBe(3);
      expect(result.totalWarnings).toBe(2);
      expect(result.errors).toContain('Error 1');
      expect(result.errors).toContain('Error 2');
      expect(result.errors).toContain('Error 3');
      expect(result.warnings).toContain('Warning 1');
      expect(result.warnings).toContain('Warning 2');
    });

    it('should mark result as invalid if any source has errors', () => {
      const sources: ConfigurationSource[] = [
        createSource(
          ConfigurationSourceType.DEFAULT,
          {
            testFramework: 'jest',
            aiModel: 'sonnet',
            include: ['src/**/*'],
            exclude: ['**/*.test.*'],
            features: { coverage: true },
            generation: { maxFiles: 100 },
            coverage: { threshold: 80 },
            incremental: { enabled: true },
            watch: { enabled: false },
            ai: { timeout: 15000 },
            output: { path: 'tests' }
          },
          true,
          ['Configuration error']
        )
      ];

      const result = merger.mergeConfigurations(sources);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Configuration error');
    });

    it('should handle empty sources array', () => {
      const result = merger.mergeConfigurations([]);

      expect(result.sourcesMerged).toBe(0);
      expect(result.totalErrors).toBe(0);
      expect(result.totalWarnings).toBe(0);
      expect(result.config).toBeDefined();
    });

    it('should handle complete configuration validation', () => {
      const sources: ConfigurationSource[] = [
        createSource(ConfigurationSourceType.DEFAULT, {
          include: ['src/**/*.ts'],
          exclude: ['**/*.test.*'],
          testFramework: 'jest',
          aiModel: 'sonnet',
          features: { coverage: true, logicalTests: true },
          generation: { maxFiles: 100 },
          coverage: { threshold: 80 },
          incremental: { enabled: true },
          watch: { enabled: false },
          ai: { timeout: 15000 },
          output: { path: 'tests' }
        })
      ];

      const result = merger.mergeConfigurations(sources);

      expect(result.config.testFramework).toBe('jest');
      expect(result.config.aiModel).toBe('sonnet');
      expect(result.sourcesMerged).toBe(1);
    });

    it('should handle partial configuration validation', () => {
      const sources: ConfigurationSource[] = [
        createSource(ConfigurationSourceType.PROJECT, {
          include: ['src/**/*.ts']
        })
      ];

      const result = merger.mergeConfigurations(sources);

      // Should fill in defaults during validation
      expect(result.config.testFramework).toBeDefined();
      expect(result.config.aiModel).toBeDefined();
      expect(result.sourcesMerged).toBe(1);
    });
  });
});