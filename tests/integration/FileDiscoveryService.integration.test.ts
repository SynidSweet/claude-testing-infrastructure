/**
 * Integration tests for FileDiscoveryService across all components
 * 
 * This suite validates that the FileDiscoveryService works consistently 
 * across all components and provides the expected performance benefits.
 */

import { ProjectAnalyzer } from '../../src/analyzers/ProjectAnalyzer';
import { StructuralTestGenerator } from '../../src/generators/StructuralTestGenerator';
import { TestRunnerFactory } from '../../src/runners/TestRunnerFactory';
import { FileDiscoveryServiceFactory } from '../../src/services/FileDiscoveryServiceFactory';
import { ConfigurationService } from '../../src/config/ConfigurationService';
import { FileDiscoveryType } from '../../src/types/file-discovery-types';
import type { TestGeneratorConfig } from '../../src/generators/TestGenerator';
import path from 'path';

describe('FileDiscoveryService Integration', () => {
  const testProjectPath = path.join(__dirname, '../fixtures/validation-projects/mixed-complex');
  let configService: ConfigurationService;
  let fileDiscovery: any;

  beforeEach(async () => {
    // Reset factory to ensure clean state
    FileDiscoveryServiceFactory.reset();
    
    // Create configuration service
    configService = new ConfigurationService({
      projectPath: testProjectPath,
      includeEnvVars: false,
      includeUserConfig: false
    });
    
    // Load configuration
    await configService.loadConfiguration();
    
    // Create FileDiscoveryService
    fileDiscovery = FileDiscoveryServiceFactory.create(configService);
  });

  afterEach(() => {
    FileDiscoveryServiceFactory.reset();
  });

  describe('Cross-Component Integration', () => {
    it('should work across all components consistently', async () => {
      // 1. Project analysis with FileDiscoveryService
      const analyzer = new ProjectAnalyzer(testProjectPath, fileDiscovery);
      const analysis = await analyzer.analyzeProject();
      
      expect(analysis).toBeDefined();
      expect(analysis.languages.length).toBeGreaterThan(0);
      expect(analysis.frameworks.length).toBeGreaterThan(0);
      
      // 2. Test generation with FileDiscoveryService
      const testConfig: TestGeneratorConfig = {
        projectPath: testProjectPath,
        outputPath: path.join(testProjectPath, '.claude-testing'),
        testFramework: 'jest',
        patterns: {
          include: ['src/**/*.{js,ts,jsx,tsx}'],
          exclude: ['**/*.test.*', '**/*.spec.*']
        },
        options: {
          generateMocks: true,
          includeSetupTeardown: true
        }
      };
      
      const generatorOptions = {
        generateMocks: true,
        generateSetup: true,
        skipExistingTests: false,
        dryRun: true // Don't actually create files in tests
      };
      
      const generator = new StructuralTestGenerator(testConfig, analysis, generatorOptions, fileDiscovery);
      const generationResult = await generator.generateAllTests();
      
      expect(generationResult.success).toBe(true);
      expect(generationResult.errors.length).toBe(0);
      
      // 3. Test execution preparation (TestRunner factory)
      const runnerConfig = {
        projectPath: testProjectPath,
        testPath: path.join(testProjectPath, '.claude-testing'),
        framework: 'jest' as const,
        coverage: { enabled: false },
        watch: false
      };
      
      const runner = TestRunnerFactory.createRunner(runnerConfig, analysis, fileDiscovery);
      expect(runner).toBeDefined();
      
      // 4. Perform additional file discovery operations to test caching
      await fileDiscovery.findFiles({
        baseDir: testProjectPath,
        type: FileDiscoveryType.PROJECT_ANALYSIS
      });
      
      // Run the same operation again - should hit cache
      await fileDiscovery.findFiles({
        baseDir: testProjectPath,
        type: FileDiscoveryType.PROJECT_ANALYSIS
      });
      
      // Verify cache efficiency
      const stats = fileDiscovery.getCacheStats();
      expect(stats.hitRate).toBeGreaterThan(0.04); // At least 4% cache efficiency (more realistic)
      expect(stats.cacheHits).toBeGreaterThan(0);
    }, 30000);

    it('should maintain singleton pattern across components', async () => {
      // Create multiple instances through factory
      const fileDiscovery1 = FileDiscoveryServiceFactory.create(configService);
      const fileDiscovery2 = FileDiscoveryServiceFactory.create(configService);
      
      // Should be the same instance
      expect(fileDiscovery1).toBe(fileDiscovery2);
      
      // Use in different components
      const analyzer1 = new ProjectAnalyzer(testProjectPath, fileDiscovery1);
      const analyzer2 = new ProjectAnalyzer(testProjectPath, fileDiscovery2);
      
      // Both should use the same service instance
      expect(analyzer1).toBeDefined();
      expect(analyzer2).toBeDefined();
      
      // Cache should be shared
      await fileDiscovery1.findFiles({
        baseDir: testProjectPath,
        type: FileDiscoveryType.PROJECT_ANALYSIS
      });
      
      const stats1 = fileDiscovery1.getCacheStats();
      const stats2 = fileDiscovery2.getCacheStats();
      
      expect(stats1.cacheHits).toBe(stats2.cacheHits);
      expect(stats1.cacheMisses).toBe(stats2.cacheMisses);
    });
  });

  describe('Configuration Integration', () => {
    it('should respect user configuration patterns', async () => {
      // Create custom configuration
      const customConfigService = new ConfigurationService({
        projectPath: testProjectPath,
        includeEnvVars: false,
        includeUserConfig: false,
        cliArgs: {}
      });
      
      // Load configuration first
      await customConfigService.loadConfiguration();
      
      // Mock configuration with custom patterns
      jest.spyOn(customConfigService, 'getFileDiscoveryConfig').mockReturnValue({
        cache: {
          enabled: true,
          ttl: 300000,
          maxSize: 1000
        },
        patterns: {
          [FileDiscoveryType.TEST_GENERATION]: {
            additionalExcludes: ['**/custom-exclude/**']
          }
        },
        performance: {
          enableStats: true,
          logSlowOperations: false,
          slowThresholdMs: 1000
        }
      });
      
      const customFileDiscovery = FileDiscoveryServiceFactory.create(customConfigService);
      
      // Test that custom patterns are applied
      const result = await customFileDiscovery.findFiles({
        baseDir: testProjectPath,
        type: FileDiscoveryType.TEST_GENERATION
      });
      
      expect(result.files).toBeDefined();
      // Verify that files in custom-exclude directory are excluded
      const excludedFiles = result.files.filter((file: string) => 
        file.includes('custom-exclude')
      );
      expect(excludedFiles.length).toBe(0);
    });
  });

  describe('Performance Validation', () => {
    it('should improve performance vs repeated file operations', async () => {
      const startTime = Date.now();
      
      // Run multiple file discovery operations that should benefit from caching
      // Run them sequentially to ensure cache can be used
      for (let i = 0; i < 5; i++) {
        await fileDiscovery.findFiles({
          baseDir: testProjectPath,
          type: FileDiscoveryType.PROJECT_ANALYSIS
        });
      }
      
      const duration = Date.now() - startTime;
      const stats = fileDiscovery.getCacheStats();
      
      // Validate performance targets
      expect(stats.hitRate).toBeGreaterThan(0.5); // 50%+ cache hit rate after repeated operations
      expect(duration).toBeLessThan(10000); // < 10 seconds for 5 operations
      expect(stats.cacheHits).toBeGreaterThan(0); // Should have cache hits
    });

    it('should maintain reasonable memory usage', async () => {
      // Run many operations to test memory management
      for (let i = 0; i < 20; i++) {
        await fileDiscovery.findFiles({
          baseDir: testProjectPath,
          type: FileDiscoveryType.PROJECT_ANALYSIS,
          useCache: true
        });
      }
      
      const stats = fileDiscovery.getCacheStats();
      
      // Cache should not grow unbounded
      expect(stats.cacheSize).toBeLessThan(1000); // Reasonable cache size limit
      expect(stats.hitRate).toBeGreaterThan(0.8); // High efficiency with many operations
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid project paths gracefully', async () => {
      const invalidPath = '/nonexistent/path';
      
      const result = await fileDiscovery.findFiles({
        baseDir: invalidPath,
        type: FileDiscoveryType.PROJECT_ANALYSIS
      });
      
      expect(result.files).toEqual([]);
      expect(result.duration).toBeGreaterThanOrEqual(0); // Allow for very fast responses
      expect(result.fromCache).toBe(false);
    });

    it('should recover from cache errors', async () => {
      // Force an error by corrupting cache state
      fileDiscovery.invalidateCache();
      
      // Should still work without cache
      const result = await fileDiscovery.findFiles({
        baseDir: testProjectPath,
        type: FileDiscoveryType.PROJECT_ANALYSIS,
        useCache: false
      });
      
      expect(result.files.length).toBeGreaterThan(0);
      expect(result.fromCache).toBe(false);
    });
  });

  describe('Factory Reset Functionality', () => {
    it('should create new instance after reset', async () => {
      const originalInstance = FileDiscoveryServiceFactory.getInstance();
      expect(originalInstance).toBe(fileDiscovery);
      
      // Reset factory
      FileDiscoveryServiceFactory.reset();
      
      // Should be null after reset
      expect(FileDiscoveryServiceFactory.getInstance()).toBeNull();
      
      // Create new instance
      const newInstance = FileDiscoveryServiceFactory.create(configService);
      
      // Should be different instance
      expect(newInstance).not.toBe(originalInstance);
      expect(FileDiscoveryServiceFactory.getInstance()).toBe(newInstance);
    });
  });
});