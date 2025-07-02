/**
 * Integration tests for FileDiscoveryService across all CLI commands
 * 
 * These tests verify that FileDiscoveryService is properly integrated and
 * provides performance benefits across the entire CLI application.
 */

import { ProjectAnalyzer } from '../../src/analyzers/ProjectAnalyzer';
import { StructuralTestGenerator } from '../../src/generators/StructuralTestGenerator';
import { JestRunner } from '../../src/runners/JestRunner';
import { ConfigurationService } from '../../src/config/ConfigurationService';
import { FileDiscoveryServiceFactory } from '../../src/services/FileDiscoveryServiceFactory';
import { FileDiscoveryType } from '../../src/types/file-discovery-types';
import { TestGeneratorConfig } from '../../src/generators/TestGenerator';
import path from 'path';
import fs from 'fs/promises';

describe('FileDiscoveryService Integration', () => {
  const testFixturePath = path.join(__dirname, '../../tests/fixtures/validation-projects/mixed-minimal');
  let configService: ConfigurationService;
  let fileDiscovery: any;

  beforeEach(async () => {
    // Reset factory before each test
    FileDiscoveryServiceFactory.reset();
    
    // Create fresh instances
    configService = new ConfigurationService({ projectPath: testFixturePath });
    await configService.loadConfiguration();
    fileDiscovery = FileDiscoveryServiceFactory.create(configService);
  });

  afterEach(() => {
    // Clean up
    FileDiscoveryServiceFactory.reset();
  });

  describe('🔄 Full Workflow Integration', () => {
    it('should work across all components consistently', async () => {
      // 1. Project analysis with FileDiscoveryService
      const analyzer = new ProjectAnalyzer(testFixturePath, fileDiscovery);
      const analysis = await analyzer.analyzeProject();
      
      expect(analysis).toBeDefined();
      expect(analysis.projectPath).toBe(testFixturePath);
      expect(analysis.languages.length).toBeGreaterThan(0);

      // 2. Test generation with FileDiscoveryService
      const testConfig: TestGeneratorConfig = {
        projectPath: testFixturePath,
        outputPath: path.join(testFixturePath, '.claude-testing'),
        testFramework: 'jest',
        options: {},
        patterns: {
          include: ['**/*.{js,ts,jsx,tsx}'],
          exclude: ['**/node_modules/**']
        }
      };

      const generator = new StructuralTestGenerator(testConfig, analysis, {}, fileDiscovery);
      const result = await generator.generateAllTests();
      
      expect(result.success).toBe(true);

      // 3. Verify cache efficiency
      const stats = fileDiscovery.getCacheStats();
      expect(stats).toBeDefined();
      expect(typeof stats.hitRate).toBe('number');
      
      // Multiple operations should show cache benefits
      const analyzer2 = new ProjectAnalyzer(testFixturePath, fileDiscovery);
      await analyzer2.analyzeProject();
      
      const updatedStats = fileDiscovery.getCacheStats();
      expect(updatedStats.hitRate).toBeGreaterThan(0.3); // At least 30% cache efficiency
    }, 30000);
  });

  describe('⚙️ Configuration Integration', () => {
    it('should respect user configuration patterns', async () => {
      // Create a custom config for testing
      const customConfigPath = path.join(testFixturePath, '.claude-testing.config.json');
      const customConfig = {
        fileDiscovery: {
          patterns: {
            testGeneration: {
              additionalExcludes: ['**/custom-exclude/**']
            }
          }
        }
      };

      try {
        await fs.writeFile(customConfigPath, JSON.stringify(customConfig, null, 2));
        
        // Create new service with custom config
        FileDiscoveryServiceFactory.reset();
        const customConfigService = new ConfigurationService({ projectPath: testFixturePath });
        await customConfigService.loadConfiguration();
        const customFileDiscovery = FileDiscoveryServiceFactory.create(customConfigService);
        
        // Verify patterns are applied
        const result = await customFileDiscovery.findFiles({
          baseDir: testFixturePath,
          type: FileDiscoveryType.TEST_GENERATION,
          include: ['**/*']
        });
        
        expect(result.files).toBeDefined();
        expect(Array.isArray(result.files)).toBe(true);
        
        // Files in custom-exclude should not be included
        const excludedFiles = result.files.filter((file: string) => 
          file.includes('custom-exclude')
        );
        expect(excludedFiles.length).toBe(0);

      } finally {
        // Clean up custom config
        try {
          await fs.unlink(customConfigPath);
        } catch {
          // Ignore if file doesn't exist
        }
      }
    });
  });

  describe('🚀 Performance Benchmarks', () => {
    it('should improve performance vs uncached operations', async () => {
      const iterations = 5;
      
      // Warm up cache
      await fileDiscovery.findFiles({
        baseDir: testFixturePath,
        type: FileDiscoveryType.PROJECT_ANALYSIS
      });
      
      const startTime = Date.now();
      
      // Run multiple file discovery operations
      for (let i = 0; i < iterations; i++) {
        await fileDiscovery.findFiles({
          baseDir: testFixturePath,
          type: FileDiscoveryType.PROJECT_ANALYSIS
        });
      }
      
      const duration = Date.now() - startTime;
      const stats = fileDiscovery.getCacheStats();
      
      // Validate performance targets
      expect(stats.hitRate).toBeGreaterThan(0.7); // 70%+ cache hit rate
      expect(duration).toBeLessThan(5000); // < 5 seconds for 5 operations
      
      // Check that cache is actually being used
      expect(stats.hits).toBeGreaterThan(0);
      expect(stats.misses).toBeGreaterThan(0);
    });

    it('should handle concurrent operations efficiently', async () => {
      const operations = Array(3).fill(null).map(() => 
        fileDiscovery.findFiles({
          baseDir: testFixturePath,
          type: FileDiscoveryType.PROJECT_ANALYSIS
        })
      );
      
      const results = await Promise.all(operations);
      
      // All operations should succeed
      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.files).toBeDefined();
        expect(Array.isArray(result.files)).toBe(true);
      });
      
      // Cache should show efficiency gains
      const stats = fileDiscovery.getCacheStats();
      expect(stats.hitRate).toBeGreaterThan(0.5); // 50%+ efficiency for concurrent ops
    });
  });

  describe('🔧 Factory Pattern Validation', () => {
    it('should maintain singleton behavior', () => {
      const service1 = FileDiscoveryServiceFactory.create(configService);
      const service2 = FileDiscoveryServiceFactory.create(configService);
      
      expect(service1).toBe(service2); // Same instance
      expect(FileDiscoveryServiceFactory.hasInstance()).toBe(true);
    });

    it('should reset properly for testing', () => {
      const service1 = FileDiscoveryServiceFactory.create(configService);
      expect(FileDiscoveryServiceFactory.hasInstance()).toBe(true);
      
      FileDiscoveryServiceFactory.reset();
      expect(FileDiscoveryServiceFactory.hasInstance()).toBe(false);
      
      const service2 = FileDiscoveryServiceFactory.create(configService);
      expect(service1).not.toBe(service2); // Different instances after reset
    });
  });

  describe('🛡️ Error Handling', () => {
    it('should handle invalid directory gracefully', async () => {
      const result = await fileDiscovery.findFiles({
        baseDir: '/nonexistent/directory',
        type: FileDiscoveryType.PROJECT_ANALYSIS
      });
      
      expect(result.files).toEqual([]);
      expect(result.stats.totalScanned).toBe(0);
      expect(result.fromCache).toBe(false);
    });

    it('should handle invalid patterns gracefully', async () => {
      const result = await fileDiscovery.findFiles({
        baseDir: testFixturePath,
        include: ['[invalid-glob-pattern'],
        type: FileDiscoveryType.CUSTOM
      });
      
      // Should not crash, even with invalid patterns
      expect(result).toBeDefined();
      expect(Array.isArray(result.files)).toBe(true);
    });
  });

  describe('📊 Cache Statistics', () => {
    it('should provide detailed cache statistics', async () => {
      // Perform some operations to generate stats
      await fileDiscovery.findFiles({
        baseDir: testFixturePath,
        type: FileDiscoveryType.PROJECT_ANALYSIS
      });
      
      // Repeat same operation (should hit cache)
      await fileDiscovery.findFiles({
        baseDir: testFixturePath,
        type: FileDiscoveryType.PROJECT_ANALYSIS
      });
      
      const stats = fileDiscovery.getCacheStats();
      
      expect(stats).toHaveProperty('hits');
      expect(stats).toHaveProperty('misses');
      expect(stats).toHaveProperty('hitRate');
      expect(stats).toHaveProperty('size');
      
      expect(typeof stats.hits).toBe('number');
      expect(typeof stats.misses).toBe('number');
      expect(typeof stats.hitRate).toBe('number');
      expect(typeof stats.size).toBe('number');
      
      expect(stats.hits).toBeGreaterThan(0);
      expect(stats.hitRate).toBeGreaterThan(0);
      expect(stats.hitRate).toBeLessThanOrEqual(1);
    });
  });
});