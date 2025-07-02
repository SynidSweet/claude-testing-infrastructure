/**
 * Tests for PatternManager configuration integration
 */

import { PatternManagerImpl } from '../../src/services/PatternManager';
import { FileDiscoveryType } from '../../src/types/file-discovery-types';
import type { FileDiscoveryConfig } from '../../src/types/file-discovery-types';

describe('PatternManager Configuration Integration', () => {
  describe('User Pattern Configuration', () => {
    it('should apply additional exclude patterns', () => {
      const mockConfig: FileDiscoveryConfig = {
        cache: { enabled: true, ttl: 300000, maxSize: 1000 },
        patterns: {
          testGeneration: {
            additionalExcludes: ['**/custom-exclude/**', '**/temp/**']
          }
        },
        performance: { enableStats: false, logSlowOperations: true, slowThresholdMs: 1000 }
      };

      const mockConfigService = {
        getFileDiscoveryConfig: () => mockConfig
      };

      const patternManager = new PatternManagerImpl(mockConfigService);
      const excludePatterns = patternManager.getExcludePatterns(
        FileDiscoveryType.TEST_GENERATION
      );

      expect(excludePatterns).toContain('**/custom-exclude/**');
      expect(excludePatterns).toContain('**/temp/**');
      expect(excludePatterns).toContain('**/node_modules/**'); // Standard pattern
    });

    it('should apply additional include patterns', () => {
      const mockConfig: FileDiscoveryConfig = {
        cache: { enabled: true, ttl: 300000, maxSize: 1000 },
        patterns: {
          projectAnalysis: {
            additionalIncludes: ['custom/**/*.ts', 'special/**/*.js']
          }
        },
        performance: { enableStats: false, logSlowOperations: true, slowThresholdMs: 1000 }
      };

      const mockConfigService = {
        getFileDiscoveryConfig: () => mockConfig
      };

      const patternManager = new PatternManagerImpl(mockConfigService);
      const includePatterns = patternManager.getIncludePatterns(
        FileDiscoveryType.PROJECT_ANALYSIS
      );

      expect(includePatterns).toContain('custom/**/*.ts');
      expect(includePatterns).toContain('special/**/*.js');
      expect(includePatterns).toContain('src/**/*.{js,ts,jsx,tsx}'); // Standard pattern
    });

    it('should replace default exclude patterns when configured', () => {
      const mockConfig: FileDiscoveryConfig = {
        cache: { enabled: true, ttl: 300000, maxSize: 1000 },
        patterns: {
          testGeneration: {
            replaceExcludes: ['**/only-this/**', '**/and-this/**']
          }
        },
        performance: { enableStats: false, logSlowOperations: true, slowThresholdMs: 1000 }
      };

      const mockConfigService = {
        getFileDiscoveryConfig: () => mockConfig
      };

      const patternManager = new PatternManagerImpl(mockConfigService);
      const excludePatterns = patternManager.getExcludePatterns(
        FileDiscoveryType.TEST_GENERATION
      );

      // Should still include base excludes but replace type-specific excludes
      expect(excludePatterns).toContain('**/node_modules/**'); // Base exclude
      expect(excludePatterns).toContain('**/only-this/**'); // Replacement
      expect(excludePatterns).toContain('**/and-this/**'); // Replacement
      expect(excludePatterns).not.toContain('**/*.test.*'); // Original type-specific excluded
    });

    it('should replace default include patterns when configured', () => {
      const mockConfig: FileDiscoveryConfig = {
        cache: { enabled: true, ttl: 300000, maxSize: 1000 },
        patterns: {
          projectAnalysis: {
            replaceIncludes: ['**/custom-only/**/*.ts']
          }
        },
        performance: { enableStats: false, logSlowOperations: true, slowThresholdMs: 1000 }
      };

      const mockConfigService = {
        getFileDiscoveryConfig: () => mockConfig
      };

      const patternManager = new PatternManagerImpl(mockConfigService);
      const includePatterns = patternManager.getIncludePatterns(
        FileDiscoveryType.PROJECT_ANALYSIS
      );

      expect(includePatterns).toEqual(['**/custom-only/**/*.ts']);
      expect(includePatterns).not.toContain('src/**/*.{js,ts,jsx,tsx}'); // Original excluded
    });

    it('should work without configuration service', () => {
      const patternManager = new PatternManagerImpl();
      
      const includePatterns = patternManager.getIncludePatterns(
        FileDiscoveryType.TEST_GENERATION
      );
      const excludePatterns = patternManager.getExcludePatterns(
        FileDiscoveryType.TEST_GENERATION
      );

      expect(includePatterns.length).toBeGreaterThan(0);
      expect(excludePatterns.length).toBeGreaterThan(0);
      expect(excludePatterns).toContain('**/node_modules/**');
    });
  });

  describe('Pattern Validation', () => {
    it('should validate configuration patterns correctly', () => {
      const patternManager = new PatternManagerImpl();
      
      const validPatterns = ['**/*.js', 'src/**/*.ts', '**/test/**'];
      const validationResult = patternManager.validatePatterns(validPatterns);
      
      expect(validationResult.valid).toBe(true);
      expect(validationResult.errors).toHaveLength(0);
    });

    it('should detect invalid configuration patterns', () => {
      const patternManager = new PatternManagerImpl();
      
      const invalidPatterns = ['', '**/*.{js', 'invalid[pattern'];
      const validationResult = patternManager.validatePatterns(invalidPatterns);
      
      expect(validationResult.valid).toBe(false);
      expect(validationResult.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Configuration Type Key Mapping', () => {
    it('should handle all discovery types correctly', () => {
      const mockConfig: FileDiscoveryConfig = {
        cache: { enabled: true, ttl: 300000, maxSize: 1000 },
        patterns: {
          projectAnalysis: { additionalExcludes: ['**/project/**'] },
          testGeneration: { additionalExcludes: ['**/generation/**'] },
          testExecution: { additionalExcludes: ['**/execution/**'] },
          custom: { additionalExcludes: ['**/custom/**'] }
        },
        performance: { enableStats: false, logSlowOperations: true, slowThresholdMs: 1000 }
      };

      const mockConfigService = {
        getFileDiscoveryConfig: () => mockConfig
      };

      const patternManager = new PatternManagerImpl(mockConfigService);

      // Test each discovery type gets its patterns
      const projectPatterns = patternManager.getExcludePatterns(FileDiscoveryType.PROJECT_ANALYSIS);
      const generationPatterns = patternManager.getExcludePatterns(FileDiscoveryType.TEST_GENERATION);
      const executionPatterns = patternManager.getExcludePatterns(FileDiscoveryType.TEST_EXECUTION);
      const customPatterns = patternManager.getExcludePatterns(FileDiscoveryType.CUSTOM);

      expect(projectPatterns).toContain('**/project/**');
      expect(generationPatterns).toContain('**/generation/**');
      expect(executionPatterns).toContain('**/execution/**');
      expect(customPatterns).toContain('**/custom/**');
    });
  });
});