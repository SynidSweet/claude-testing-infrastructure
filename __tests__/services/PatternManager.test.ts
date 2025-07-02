/**
 * Tests for PatternManager
 * 
 * Validates pattern resolution, language-specific patterns,
 * user configuration merging, and pattern validation.
 */

import { PatternManagerImpl } from '../../src/services/PatternManager';
import { FileDiscoveryType } from '../../src/types/file-discovery-types';
import type { FileDiscoveryConfig } from '../../src/types/file-discovery-types';

describe('PatternManager', () => {
  let patternManager: PatternManagerImpl;
  let mockConfigService: { getFileDiscoveryConfig(): FileDiscoveryConfig };

  beforeEach(() => {
    mockConfigService = {
      getFileDiscoveryConfig: jest.fn().mockReturnValue({
        cache: { enabled: true, ttl: 300000, maxSize: 1000 },
        patterns: {},
        performance: { enableStats: false, logSlowOperations: true, slowThresholdMs: 1000 }
      })
    };
    patternManager = new PatternManagerImpl(mockConfigService);
  });

  describe('getIncludePatterns', () => {
    it('should return base patterns for project analysis', () => {
      const patterns = patternManager.getIncludePatterns(FileDiscoveryType.PROJECT_ANALYSIS);
      
      expect(patterns).toContain('src/**/*.{js,ts,jsx,tsx}');
      expect(patterns).toContain('lib/**/*.{js,ts,jsx,tsx}');
      expect(patterns).toContain('**/*.{py}');
    });

    it('should return test patterns for test execution', () => {
      const patterns = patternManager.getIncludePatterns(FileDiscoveryType.TEST_EXECUTION);
      
      expect(patterns).toContain('**/*.test.{js,ts,jsx,tsx}');
      expect(patterns).toContain('**/*.spec.{js,ts,jsx,tsx}');
      expect(patterns).toContain('**/test_*.py');
    });

    it('should return config patterns for config discovery', () => {
      const patterns = patternManager.getIncludePatterns(FileDiscoveryType.CONFIG_DISCOVERY);
      
      expect(patterns).toContain('**/package.json');
      expect(patterns).toContain('**/tsconfig.json');
      expect(patterns).toContain('**/.claude-testing.config.json');
    });

    it('should add language extensions when languages specified', () => {
      const patterns = patternManager.getIncludePatterns(
        FileDiscoveryType.PROJECT_ANALYSIS,
        ['javascript', 'python']
      );
      
      // Should include language-specific extensions
      expect(patterns.some(p => p.includes('.js'))).toBe(true);
      expect(patterns.some(p => p.includes('.py'))).toBe(true);
    });

    it('should return default pattern for unknown type', () => {
      const patterns = patternManager.getIncludePatterns(FileDiscoveryType.CUSTOM);
      
      expect(patterns).toEqual(['**/*']);
    });
  });

  describe('getExcludePatterns', () => {
    it('should return base exclude patterns', () => {
      const patterns = patternManager.getExcludePatterns(FileDiscoveryType.PROJECT_ANALYSIS);
      
      expect(patterns).toContain('**/node_modules/**');
      expect(patterns).toContain('**/dist/**');
      expect(patterns).toContain('**/.claude-testing/**');
      expect(patterns).toContain('**/__pycache__/**');
    });

    it('should include type-specific excludes', () => {
      const patterns = patternManager.getExcludePatterns(FileDiscoveryType.PROJECT_ANALYSIS);
      
      expect(patterns).toContain('**/*.test.*');
      expect(patterns).toContain('**/*.spec.*');
      expect(patterns).toContain('**/*.config.*');
    });

    it('should include language-specific excludes', () => {
      const patterns = patternManager.getExcludePatterns(
        FileDiscoveryType.PROJECT_ANALYSIS,
        ['python']
      );
      
      expect(patterns).toContain('**/__pycache__/**');
      expect(patterns).toContain('**/*.pyc');
      expect(patterns).toContain('**/venv/**');
    });

    it('should include JavaScript excludes for JavaScript/TypeScript', () => {
      const patterns = patternManager.getExcludePatterns(
        FileDiscoveryType.PROJECT_ANALYSIS,
        ['javascript', 'typescript']
      );
      
      expect(patterns).toContain('**/*.min.js');
      expect(patterns).toContain('**/.next/**');
      expect(patterns).toContain('**/.nuxt/**');
    });

    it('should apply user configuration patterns', () => {
      mockConfigService.getFileDiscoveryConfig = jest.fn().mockReturnValue({
        cache: { enabled: true, ttl: 300000, maxSize: 1000 },
        patterns: {
          projectAnalysis: {
            additionalExcludes: ['**/custom-exclude/**']
          }
        },
        performance: { enableStats: false, logSlowOperations: true, slowThresholdMs: 1000 }
      });

      const patterns = patternManager.getExcludePatterns(FileDiscoveryType.PROJECT_ANALYSIS);
      
      expect(patterns).toContain('**/custom-exclude/**');
    });
  });

  describe('mergeUserPatterns', () => {
    it('should add user patterns to default patterns', () => {
      const defaultPatterns = ['**/*.js', '**/*.ts'];
      const userPatterns = ['**/*.jsx', '**/*.tsx'];
      
      const result = patternManager.mergeUserPatterns(defaultPatterns, userPatterns, 'add');
      
      expect(result).toEqual(['**/*.js', '**/*.ts', '**/*.jsx', '**/*.tsx']);
    });

    it('should replace default patterns with user patterns', () => {
      const defaultPatterns = ['**/*.js', '**/*.ts'];
      const userPatterns = ['**/*.jsx', '**/*.tsx'];
      
      const result = patternManager.mergeUserPatterns(defaultPatterns, userPatterns, 'replace');
      
      expect(result).toEqual(['**/*.jsx', '**/*.tsx']);
    });

    it('should keep default patterns when user patterns empty and operation is replace', () => {
      const defaultPatterns = ['**/*.js', '**/*.ts'];
      const userPatterns: string[] = [];
      
      const result = patternManager.mergeUserPatterns(defaultPatterns, userPatterns, 'replace');
      
      expect(result).toEqual(['**/*.js', '**/*.ts']);
    });
  });

  describe('validatePatterns', () => {
    it('should validate correct patterns', () => {
      const patterns = ['**/*.js', 'src/**/*.{ts,tsx}', '**/test/**'];
      
      const result = patternManager.validatePatterns(patterns);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect empty patterns', () => {
      const patterns = ['', '  ', '**/*.js'];
      
      const result = patternManager.validatePatterns(patterns);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(2);
      expect(result.errors[0].message).toBe('Pattern cannot be empty');
    });

    it('should detect unmatched brackets', () => {
      const patterns = ['**/*.{js,ts', 'src/**/*.js]'];
      
      const result = patternManager.validatePatterns(patterns);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(2);
      expect(result.errors[0].message).toBe('Invalid glob pattern syntax');
    });

    it('should detect unmatched braces', () => {
      const patterns = ['**/*.{js,ts,tsx', 'src/**/*.[js]'];
      
      const result = patternManager.validatePatterns(patterns);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(2);
    });

    it('should warn about overly broad patterns', () => {
      const patterns = ['**', '**/*'];
      
      const result = patternManager.validatePatterns(patterns);
      
      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(2);
      expect(result.warnings[0].message).toContain('Very broad pattern');
    });

    it('should warn about redundant patterns', () => {
      const patterns = ['src/**/**/*.js'];
      
      const result = patternManager.validatePatterns(patterns);
      
      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].message).toContain('Redundant path separators');
      expect(result.warnings[0].suggestion).toBe('src/**/*.js');
    });

    it('should warn about Windows path separators', () => {
      const patterns = ['src\\**\\*.js'];
      
      const result = patternManager.validatePatterns(patterns);
      
      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].message).toContain('forward slashes');
      expect(result.warnings[0].suggestion).toBe('src/**/*.js');
    });
  });

  describe('constructor without config service', () => {
    it('should work without config service', () => {
      const manager = new PatternManagerImpl();
      
      const patterns = manager.getIncludePatterns(FileDiscoveryType.PROJECT_ANALYSIS);
      
      expect(patterns).toContain('src/**/*.{js,ts,jsx,tsx}');
    });

    it('should not apply user patterns without config service', () => {
      const manager = new PatternManagerImpl();
      
      const patterns = manager.getExcludePatterns(FileDiscoveryType.PROJECT_ANALYSIS);
      
      // Should only have standard patterns, no user configuration
      expect(patterns).toContain('**/node_modules/**');
      expect(patterns).not.toContain('**/custom-exclude/**');
    });
  });

  describe('language extension handling', () => {
    it('should handle multiple languages', () => {
      const patterns = patternManager.getIncludePatterns(
        FileDiscoveryType.PROJECT_ANALYSIS,
        ['javascript', 'typescript', 'python']
      );
      
      // Should include all language extensions
      const hasJS = patterns.some(p => p.includes('js'));
      const hasTS = patterns.some(p => p.includes('ts'));
      const hasPY = patterns.some(p => p.includes('py'));
      
      expect(hasJS).toBe(true);
      expect(hasTS).toBe(true);
      expect(hasPY).toBe(true);
    });

    it('should handle unknown languages gracefully', () => {
      const patterns = patternManager.getIncludePatterns(
        FileDiscoveryType.PROJECT_ANALYSIS,
        ['unknown-language']
      );
      
      // Should still return base patterns
      expect(patterns.length).toBeGreaterThan(0);
    });

    it('should deduplicate extensions', () => {
      const patterns = patternManager.getIncludePatterns(
        FileDiscoveryType.PROJECT_ANALYSIS,
        ['javascript', 'typescript'] // Both include .js extensions
      );
      
      // Should not have duplicate extensions in the same pattern
      patterns.forEach(pattern => {
        const jsCount = (pattern.match(/\.js/g) || []).length;
        expect(jsCount).toBeLessThanOrEqual(1);
      });
    });
  });
});