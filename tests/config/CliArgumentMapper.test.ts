/**
 * Tests for CliArgumentMapper
 * 
 * Tests CLI argument to configuration mapping logic
 */

import { CliArgumentMapper, type CliArguments } from '../../src/config/CliArgumentMapper';

describe('CliArgumentMapper', () => {
  let mapper: CliArgumentMapper;

  beforeEach(() => {
    mapper = new CliArgumentMapper();
  });

  describe('mapCliArgsToConfig', () => {
    it('should map AI model correctly', () => {
      const cliArgs: CliArguments = { aiModel: 'claude-3-sonnet' };
      const result = mapper.mapCliArgsToConfig(cliArgs);
      
      expect(result.config.aiModel).toBe('claude-3-sonnet');
      expect(result.error).toBeUndefined();
    });

    it('should map verbose flag correctly', () => {
      const cliArgs: CliArguments = { verbose: true };
      const result = mapper.mapCliArgsToConfig(cliArgs);
      
      expect(result.config.output?.verbose).toBe(true);
      expect(result.config.output?.logLevel).toBe('verbose');
    });

    it('should map debug flag correctly', () => {
      const cliArgs: CliArguments = { debug: true };
      const result = mapper.mapCliArgsToConfig(cliArgs);
      
      expect(result.config.output?.logLevel).toBe('debug');
    });

    it('should map quiet flag correctly', () => {
      const cliArgs: CliArguments = { quiet: true };
      const result = mapper.mapCliArgsToConfig(cliArgs);
      
      expect(result.config.output?.logLevel).toBe('error');
    });

    it('should map format correctly', () => {
      const cliArgs: CliArguments = { format: 'json' };
      const result = mapper.mapCliArgsToConfig(cliArgs);
      
      expect(result.config.output?.formats).toEqual(['json']);
      expect(result.config.output?.format).toBe('json');
    });

    it('should map output file correctly', () => {
      const cliArgs: CliArguments = { output: 'test-results.json' };
      const result = mapper.mapCliArgsToConfig(cliArgs);
      
      expect(result.config.output?.file).toBe('test-results.json');
    });

    it('should map test framework correctly', () => {
      const cliArgs: CliArguments = { framework: 'jest' };
      const result = mapper.mapCliArgsToConfig(cliArgs);
      
      expect(result.config.testFramework).toBe('jest');
    });

    it('should map generation options correctly', () => {
      const cliArgs: CliArguments = { 
        maxRatio: 2.5, 
        batchSize: 10, 
        maxRetries: 3 
      };
      const result = mapper.mapCliArgsToConfig(cliArgs);
      
      expect(result.config.generation?.maxTestToSourceRatio).toBe(2.5);
      expect(result.config.generation?.batchSize).toBe(10);
      expect(result.config.generation?.maxRetries).toBe(3);
    });

    it('should map onlyStructural flag correctly', () => {
      const cliArgs: CliArguments = { onlyStructural: true };
      const result = mapper.mapCliArgsToConfig(cliArgs);
      
      expect(result.config.features?.structuralTests).toBe(true);
      expect(result.config.features?.logicalTests).toBe(false);
    });

    it('should map onlyLogical flag correctly', () => {
      const cliArgs: CliArguments = { onlyLogical: true };
      const result = mapper.mapCliArgsToConfig(cliArgs);
      
      expect(result.config.features?.structuralTests).toBe(false);
      expect(result.config.features?.logicalTests).toBe(true);
    });

    it('should map coverage configuration correctly', () => {
      const cliArgs: CliArguments = { coverage: true };
      const result = mapper.mapCliArgsToConfig(cliArgs);
      
      expect(result.config.coverage?.enabled).toBe(true);
    });

    it('should map reporter configuration correctly', () => {
      const cliArgs: CliArguments = { reporter: ['text', 'json'] };
      const result = mapper.mapCliArgsToConfig(cliArgs);
      
      expect(result.config.coverage?.reporters).toEqual(['text', 'json']);
    });

    it('should handle single reporter string', () => {
      const cliArgs: CliArguments = { reporter: 'lcov' };
      const result = mapper.mapCliArgsToConfig(cliArgs);
      
      expect(result.config.coverage?.reporters).toEqual(['lcov']);
    });

    it('should map watch configuration correctly', () => {
      const cliArgs: CliArguments = { watch: true, debounce: 1000 };
      const result = mapper.mapCliArgsToConfig(cliArgs);
      
      expect(result.config.watch?.enabled).toBe(true);
      expect(result.config.watch?.debounceMs).toBe(1000);
    });

    it('should map incremental configuration correctly', () => {
      const cliArgs: CliArguments = { 
        stats: true, 
        baseline: { create: true },
        costLimit: 50,
        dryRun: true
      };
      const result = mapper.mapCliArgsToConfig(cliArgs);
      
      expect(result.config.incremental?.showStats).toBe(true);
      expect(result.config.incremental?.baseline).toEqual({ create: true });
      expect(result.config.costLimit).toBe(50);
      expect(result.config.dryRun).toBe(true);
    });

    it('should handle empty CLI args', () => {
      const cliArgs: CliArguments = {};
      const result = mapper.mapCliArgsToConfig(cliArgs);
      
      expect(result.config).toEqual({});
      expect(result.error).toBeUndefined();
    });

    it('should handle threshold parsing errors', () => {
      const cliArgs: CliArguments = { threshold: 'invalid:format:too:many:colons' };
      const result = mapper.mapCliArgsToConfig(cliArgs);
      
      expect(result.error).toContain('Invalid threshold format');
    });
  });

  describe('parseThresholds', () => {
    it('should parse single threshold value', () => {
      const result = mapper.parseThresholds('80');
      
      expect(result.thresholds).toEqual({
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      });
      expect(result.error).toBeUndefined();
    });

    it('should parse specific threshold types', () => {
      const result = mapper.parseThresholds('statements:85,branches:75');
      
      expect(result.thresholds).toEqual({
        statements: 85,
        branches: 75,
      });
      expect(result.error).toBeUndefined();
    });

    it('should validate threshold range', () => {
      const result = mapper.parseThresholds('150');
      
      expect(result.error).toContain('Must be a number between 0 and 100');
      expect(result.thresholds).toBeUndefined();
    });

    it('should validate negative thresholds', () => {
      const result = mapper.parseThresholds('-10');
      
      expect(result.error).toContain('Must be a number between 0 and 100');
      expect(result.thresholds).toBeUndefined();
    });

    it('should validate threshold types', () => {
      const result = mapper.parseThresholds('invalid:80');
      
      expect(result.error).toContain('Invalid threshold type');
      expect(result.thresholds).toBeUndefined();
    });

    it('should handle malformed threshold strings', () => {
      const result = mapper.parseThresholds('statements:');
      
      expect(result.error).toContain('Invalid threshold format');
      expect(result.thresholds).toBeUndefined();
    });

    it('should handle multiple colons in a part', () => {
      const result = mapper.parseThresholds('statements:80:extra');
      
      expect(result.error).toContain('Invalid threshold format');
      expect(result.thresholds).toBeUndefined();
    });

    it('should handle non-numeric values', () => {
      const result = mapper.parseThresholds('statements:abc');
      
      expect(result.error).toContain('Must be a number between 0 and 100');
      expect(result.thresholds).toBeUndefined();
    });

    it('should handle edge case values', () => {
      const result = mapper.parseThresholds('0');
      
      expect(result.thresholds).toEqual({
        statements: 0,
        branches: 0,
        functions: 0,
        lines: 0,
      });
      expect(result.error).toBeUndefined();
    });

    it('should handle maximum valid values', () => {
      const result = mapper.parseThresholds('100');
      
      expect(result.thresholds).toEqual({
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100,
      });
      expect(result.error).toBeUndefined();
    });

    it('should handle multiple valid threshold types', () => {
      const result = mapper.parseThresholds('statements:80,branches:70,functions:90,lines:85');
      
      expect(result.thresholds).toEqual({
        statements: 80,
        branches: 70,
        functions: 90,
        lines: 85,
      });
      expect(result.error).toBeUndefined();
    });

    it('should handle whitespace in threshold strings', () => {
      const result = mapper.parseThresholds(' statements : 80 , branches : 70 ');
      
      expect(result.thresholds).toEqual({
        statements: 80,
        branches: 70,
      });
      expect(result.error).toBeUndefined();
    });
  });
});