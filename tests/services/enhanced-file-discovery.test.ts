/**
 * Tests for enhanced file discovery service type safety
 */

import { describe, it, expect } from '@jest/globals';
import { 
  PatternErrorCode,
  SupportedLanguage,
  SupportedTestFramework,
  isSupportedLanguage,
  isSupportedTestFramework,
  type FileDiscoveryError,
  isFileDiscoveryError,
} from '../../src/types/enhanced-file-discovery-types';
import { EnhancedPatternValidator } from '../../src/services/EnhancedPatternValidator';
import { CacheKeyGenerator } from '../../src/services/CacheKeyGenerator';
import { createPatternBuilder } from '../../src/services/PatternBuilder';
import { FileDiscoveryType } from '../../src/types/file-discovery-types';

describe('Enhanced File Discovery Type Safety', () => {
  describe('SupportedLanguage', () => {
    it('should validate supported languages', () => {
      expect(isSupportedLanguage('javascript')).toBe(true);
      expect(isSupportedLanguage('typescript')).toBe(true);
      expect(isSupportedLanguage('python')).toBe(true);
      expect(isSupportedLanguage('vue')).toBe(true);
      expect(isSupportedLanguage('svelte')).toBe(true);
      expect(isSupportedLanguage('ruby')).toBe(false);
      expect(isSupportedLanguage('invalid')).toBe(false);
    });

    it('should have correct language values', () => {
      expect(SupportedLanguage.JAVASCRIPT).toBe('javascript');
      expect(SupportedLanguage.TYPESCRIPT).toBe('typescript');
      expect(SupportedLanguage.PYTHON).toBe('python');
      expect(SupportedLanguage.VUE).toBe('vue');
      expect(SupportedLanguage.SVELTE).toBe('svelte');
    });
  });

  describe('SupportedTestFramework', () => {
    it('should validate supported test frameworks', () => {
      expect(isSupportedTestFramework('jest')).toBe(true);
      expect(isSupportedTestFramework('vitest')).toBe(true);
      expect(isSupportedTestFramework('pytest')).toBe(true);
      expect(isSupportedTestFramework('mocha')).toBe(true);
      expect(isSupportedTestFramework('jasmine')).toBe(false);
      expect(isSupportedTestFramework('invalid')).toBe(false);
    });

    it('should have correct framework values', () => {
      expect(SupportedTestFramework.JEST).toBe('jest');
      expect(SupportedTestFramework.VITEST).toBe('vitest');
      expect(SupportedTestFramework.PYTEST).toBe('pytest');
      expect(SupportedTestFramework.MOCHA).toBe('mocha');
    });
  });

  describe('FileDiscoveryError', () => {
    it('should validate error types', () => {
      const dirError: FileDiscoveryError = {
        kind: 'DirectoryNotFoundError',
        path: '/missing',
        message: 'Directory not found',
      };
      expect(isFileDiscoveryError(dirError)).toBe(true);

      const patternError: FileDiscoveryError = {
        kind: 'InvalidPatternError',
        pattern: '**/{',
        message: 'Invalid pattern',
        position: 3,
      };
      expect(isFileDiscoveryError(patternError)).toBe(true);

      const permissionError: FileDiscoveryError = {
        kind: 'PermissionDeniedError',
        path: '/protected',
        message: 'Permission denied',
      };
      expect(isFileDiscoveryError(permissionError)).toBe(true);

      const timeoutError: FileDiscoveryError = {
        kind: 'OperationTimeoutError',
        duration: 5000,
        message: 'Operation timed out',
      };
      expect(isFileDiscoveryError(timeoutError)).toBe(true);

      expect(isFileDiscoveryError(null)).toBe(false);
      expect(isFileDiscoveryError({})).toBe(false);
      expect(isFileDiscoveryError({ kind: 'UnknownError' })).toBe(false);
    });
  });

  describe('EnhancedPatternValidator', () => {
    it('should validate empty patterns', () => {
      const result = EnhancedPatternValidator.validate(['', '  ']);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(2);
      expect(result.errors[0]?.code).toBe(PatternErrorCode.EMPTY_PATTERN);
    });

    it('should validate bracket matching', () => {
      const result = EnhancedPatternValidator.validate(['**/*.{js', '**/*].ts']);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(2);
      expect(result.errors[0]?.code).toBe(PatternErrorCode.UNMATCHED_BRACES);
      expect(result.errors[0]?.position).toBe(5); // Position of the opening brace
      expect(result.errors[1]?.code).toBe(PatternErrorCode.UNMATCHED_BRACKETS);
      expect(result.errors[1]?.position).toBe(4);
    });

    it('should warn about Windows path separators', () => {
      const result = EnhancedPatternValidator.validate(['src\\**\\*.js']);
      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]?.code).toBe(PatternErrorCode.WINDOWS_PATH_SEPARATOR);
      expect(result.suggestions).toHaveLength(1);
      expect(result.suggestions[0]?.suggested).toBe('src/**/*.js');
    });

    it('should warn about overly broad patterns', () => {
      const result = EnhancedPatternValidator.validate(['**', '**/*']);
      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(2);
      expect(result.warnings[0]?.code).toBe(PatternErrorCode.OVERLY_BROAD);
      expect(result.suggestions).toHaveLength(2);
    });

    it('should warn about redundant patterns', () => {
      const result = EnhancedPatternValidator.validate(['**/**/test.js']);
      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]?.code).toBe(PatternErrorCode.REDUNDANT_PATTERN);
      expect(result.suggestions[0]?.suggested).toBe('**/test.js');
    });

    it('should estimate match count', () => {
      expect(EnhancedPatternValidator.estimateMatchCount('**')).toBe('high');
      expect(EnhancedPatternValidator.estimateMatchCount('**/*')).toBe('high');
      expect(EnhancedPatternValidator.estimateMatchCount('**/*.js')).toBe('low');
      expect(EnhancedPatternValidator.estimateMatchCount('src/**/*.ts')).toBe('low');
      expect(EnhancedPatternValidator.estimateMatchCount('**/*.{js,ts}')).toBe('low');
      expect(EnhancedPatternValidator.estimateMatchCount('**/test/*')).toBe('medium');
    });

    it('should suggest optimizations', () => {
      const patterns = ['**/*.js', '**/*.ts', '**/*.jsx'];
      const suggestions = EnhancedPatternValidator.suggestOptimizations(patterns);
      expect(suggestions).toHaveLength(1);
      expect(suggestions[0]?.suggested).toContain('.{js,ts,jsx}');
    });
  });

  describe('CacheKeyGenerator', () => {
    it('should generate consistent cache keys', () => {
      const request1 = {
        baseDir: '/project',
        type: FileDiscoveryType.PROJECT_ANALYSIS,
        include: ['**/*.js', '**/*.ts'],
        exclude: ['node_modules'],
        languages: [SupportedLanguage.JAVASCRIPT],
      };

      const request2 = {
        baseDir: '/project',
        type: FileDiscoveryType.PROJECT_ANALYSIS,
        include: ['**/*.ts', '**/*.js'], // Different order
        exclude: ['node_modules'],
        languages: [SupportedLanguage.JAVASCRIPT],
      };

      const key1 = CacheKeyGenerator.generate(request1);
      const key2 = CacheKeyGenerator.generate(request2);

      expect(key1).toBe(key2); // Should be same despite order difference
    });

    it('should generate different keys for different requests', () => {
      const request1 = {
        baseDir: '/project',
        type: FileDiscoveryType.PROJECT_ANALYSIS,
      };

      const request2 = {
        baseDir: '/project',
        type: FileDiscoveryType.TEST_EXECUTION,
      };

      const key1 = CacheKeyGenerator.generate(request1);
      const key2 = CacheKeyGenerator.generate(request2);

      expect(key1).not.toBe(key2);
    });

    it('should validate cache keys', () => {
      const validKey = {
        baseDir: '/project',
        include: ['**/*.js'],
        exclude: ['node_modules'],
        type: FileDiscoveryType.PROJECT_ANALYSIS,
        languages: [SupportedLanguage.JAVASCRIPT],
        options: {
          absolute: false,
          includeDirectories: false,
        },
      };

      const result = CacheKeyGenerator.validate(validKey);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);

      const invalidKey = {
        baseDir: '',
        include: ['src\\test.js'],
        exclude: [],
        type: 'invalid' as any,
        languages: [],
        options: {
          absolute: false,
          includeDirectories: false,
        },
      };

      const invalidResult = CacheKeyGenerator.validate(invalidKey);
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.errors.length).toBeGreaterThan(0);
    });

    it('should create debug strings', () => {
      const key = {
        baseDir: '/project',
        include: ['**/*.js', '**/*.ts'],
        exclude: ['node_modules'],
        type: FileDiscoveryType.PROJECT_ANALYSIS,
        languages: [SupportedLanguage.JAVASCRIPT, SupportedLanguage.TYPESCRIPT],
        options: {
          absolute: true,
          includeDirectories: false,
        },
      };

      const debugStr = CacheKeyGenerator.toDebugString(key);
      expect(debugStr).toContain('BaseDir: /project');
      expect(debugStr).toContain('Type: project-analysis');
      expect(debugStr).toContain('Languages: javascript, typescript');
      expect(debugStr).toContain('Include: 2 patterns');
      expect(debugStr).toContain('absolute=true');
    });
  });

  describe('PatternBuilder', () => {
    it('should build basic patterns', () => {
      const pattern = createPatternBuilder()
        .withExtensions(['js', 'ts'])
        .build();
      expect(pattern).toBe('**/*.{js,ts}');
    });

    it('should build directory-specific patterns', () => {
      const pattern = createPatternBuilder()
        .inDirectory('src')
        .withExtensions(['js'])
        .build();
      expect(pattern).toBe('src/*.js');
    });

    it('should build recursive patterns', () => {
      const pattern = createPatternBuilder()
        .inDirectory('src')
        .recursive()
        .withExtensions(['ts', 'tsx'])
        .build();
      expect(pattern).toBe('src/**/*.{ts,tsx}');
    });

    it('should handle multiple directories', () => {
      const pattern = createPatternBuilder()
        .inDirectory('src')
        .inDirectory('components')
        .withExtensions(['jsx'])
        .build();
      expect(pattern).toBe('src/components/*.jsx');
    });

    it('should normalize paths', () => {
      const pattern = createPatternBuilder('\\src\\')
        .withExtensions(['py'])
        .build();
      expect(pattern).toBe('src/*.py');
    });

    it('should create source file patterns', () => {
      const jsPattern = createPatternBuilder.sourceFiles('javascript').build();
      expect(jsPattern).toBe('src/**/*.{js,jsx,mjs,cjs}');

      const tsPattern = createPatternBuilder.sourceFiles('typescript').build();
      expect(tsPattern).toBe('src/**/*.{ts,tsx}');

      const pyPattern = createPatternBuilder.sourceFiles('python').build();
      expect(pyPattern).toBe('**/*.py');
    });

    it('should create test file patterns', () => {
      const jestPattern = createPatternBuilder.testFiles('jest').build();
      expect(jestPattern).toBe('**/*.{test.js,test.ts,spec.js,spec.ts}');

      const pytestPattern = createPatternBuilder.testFiles('pytest').build();
      expect(pytestPattern).toBe('tests/**/*.py');
    });

    it('should create config file patterns', () => {
      const pattern = createPatternBuilder.configFiles().build();
      expect(pattern).toBe('**/*.{json,js,ts,yaml,yml,toml,ini}');
    });

    it('should track exclude patterns', () => {
      const builder = createPatternBuilder()
        .exclude('node_modules')
        .exclude('dist');
      
      expect(builder.getExcludes()).toEqual(['node_modules', 'dist']);
    });
  });
});