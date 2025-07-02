import { JSFrameworkDetector } from '../../../../src/generators/javascript/analyzers/JSFrameworkDetector';

describe('JSFrameworkDetector', () => {
  const mockProjectPath = '/test/project';
  
  describe('detectFrameworks', () => {
    it('should detect React framework', async () => {
      const packageJson = {
        dependencies: {
          react: '^18.0.0',
          'react-dom': '^18.0.0'
        }
      };
      
      const detector = new JSFrameworkDetector(mockProjectPath, packageJson);
      const frameworks = await detector.detectFrameworks();
      
      expect(frameworks).toHaveLength(1);
      expect(frameworks[0]).toMatchObject({
        name: 'react',
        confidence: 0.95,
        version: '^18.0.0'
      });
    });
    
    it('should detect Vue framework', async () => {
      const packageJson = {
        dependencies: {
          vue: '^3.2.0'
        }
      };
      
      const detector = new JSFrameworkDetector(mockProjectPath, packageJson);
      const frameworks = await detector.detectFrameworks();
      
      expect(frameworks).toHaveLength(1);
      expect(frameworks[0]).toMatchObject({
        name: 'vue',
        confidence: 0.95,
        version: '^3.2.0'
      });
    });
    
    it('should detect Angular framework', async () => {
      const packageJson = {
        dependencies: {
          '@angular/core': '^15.0.0',
          '@angular/common': '^15.0.0'
        }
      };
      
      const detector = new JSFrameworkDetector(mockProjectPath, packageJson);
      const frameworks = await detector.detectFrameworks();
      
      expect(frameworks).toHaveLength(1);
      expect(frameworks[0]).toMatchObject({
        name: 'angular',
        confidence: 0.95,
        version: '^15.0.0'
      });
    });
    
    it('should detect Next.js and React together', async () => {
      const packageJson = {
        dependencies: {
          next: '^13.0.0',
          react: '^18.0.0',
          'react-dom': '^18.0.0'
        }
      };
      
      const detector = new JSFrameworkDetector(mockProjectPath, packageJson);
      const frameworks = await detector.detectFrameworks();
      
      expect(frameworks).toHaveLength(2);
      expect(frameworks.find(f => f.name === 'nextjs')).toMatchObject({
        name: 'nextjs',
        confidence: 0.95,
        version: '^13.0.0'
      });
      expect(frameworks.find(f => f.name === 'react')).toMatchObject({
        name: 'react',
        confidence: 0.9  // Next.js adds React with lower confidence
      });
    });
    
    it('should detect Express framework', async () => {
      const packageJson = {
        dependencies: {
          express: '^4.18.0'
        }
      };
      
      const detector = new JSFrameworkDetector(mockProjectPath, packageJson);
      const frameworks = await detector.detectFrameworks();
      
      expect(frameworks).toHaveLength(1);
      expect(frameworks[0]).toMatchObject({
        name: 'express',
        confidence: 0.9,
        version: '^4.18.0'
      });
    });
    
    it('should detect multiple frameworks', async () => {
      const packageJson = {
        dependencies: {
          react: '^18.0.0',
          express: '^4.18.0'
        }
      };
      
      const detector = new JSFrameworkDetector(mockProjectPath, packageJson);
      const frameworks = await detector.detectFrameworks();
      
      expect(frameworks).toHaveLength(2);
      expect(frameworks.map(f => f.name)).toContain('react');
      expect(frameworks.map(f => f.name)).toContain('express');
    });
    
    it('should handle empty package.json', async () => {
      const packageJson = {};
      
      const detector = new JSFrameworkDetector(mockProjectPath, packageJson);
      const frameworks = await detector.detectFrameworks();
      
      expect(frameworks).toHaveLength(0);
    });
    
    it('should handle null package.json', async () => {
      const detector = new JSFrameworkDetector(mockProjectPath, null);
      const frameworks = await detector.detectFrameworks();
      
      expect(frameworks).toHaveLength(0);
    });
  });
  
  describe('detectTestingFrameworks', () => {
    it('should detect Jest', async () => {
      const packageJson = {
        devDependencies: {
          jest: '^29.0.0'
        }
      };
      
      const detector = new JSFrameworkDetector(mockProjectPath, packageJson);
      const testFrameworks = await detector.detectTestingFrameworks();
      
      expect(testFrameworks).toContain('jest');
    });
    
    it('should detect Vitest', async () => {
      const packageJson = {
        devDependencies: {
          vitest: '^0.34.0'
        }
      };
      
      const detector = new JSFrameworkDetector(mockProjectPath, packageJson);
      const testFrameworks = await detector.detectTestingFrameworks();
      
      expect(testFrameworks).toContain('vitest');
    });
    
    it('should detect Mocha', async () => {
      const packageJson = {
        devDependencies: {
          mocha: '^10.0.0'
        }
      };
      
      const detector = new JSFrameworkDetector(mockProjectPath, packageJson);
      const testFrameworks = await detector.detectTestingFrameworks();
      
      expect(testFrameworks).toContain('mocha');
    });
    
    it('should detect multiple testing frameworks', async () => {
      const packageJson = {
        devDependencies: {
          jest: '^29.0.0',
          cypress: '^12.0.0',
          '@testing-library/react': '^13.0.0'
        }
      };
      
      const detector = new JSFrameworkDetector(mockProjectPath, packageJson);
      const testFrameworks = await detector.detectTestingFrameworks();
      
      expect(testFrameworks).toContain('jest');
      expect(testFrameworks).toContain('cypress');
      expect(testFrameworks).toContain('testing-library');
    });
  });
  
  describe('getPreferredTestFramework', () => {
    it('should prefer Vitest over Jest', async () => {
      const packageJson = {
        devDependencies: {
          jest: '^29.0.0',
          vitest: '^0.34.0'
        }
      };
      
      const detector = new JSFrameworkDetector(mockProjectPath, packageJson);
      const preferred = await detector.getPreferredTestFramework();
      
      expect(preferred).toBe('vitest');
    });
    
    it('should return jest when only jest is present', async () => {
      const packageJson = {
        devDependencies: {
          jest: '^29.0.0'
        }
      };
      
      const detector = new JSFrameworkDetector(mockProjectPath, packageJson);
      const preferred = await detector.getPreferredTestFramework();
      
      expect(preferred).toBe('jest');
    });
    
    it('should return jest as default when no test framework is found', async () => {
      const packageJson = {};
      
      const detector = new JSFrameworkDetector(mockProjectPath, packageJson);
      const preferred = await detector.getPreferredTestFramework();
      
      expect(preferred).toBe('jest');
    });
  });
  
  describe('detectBuildTools', () => {
    it('should detect Vite', async () => {
      const packageJson = {
        devDependencies: {
          vite: '^4.0.0'
        }
      };
      
      const detector = new JSFrameworkDetector(mockProjectPath, packageJson);
      const buildTools = await detector.detectBuildTools();
      
      expect(buildTools).toContain('vite');
    });
    
    it('should detect Webpack', async () => {
      const packageJson = {
        devDependencies: {
          webpack: '^5.0.0'
        }
      };
      
      const detector = new JSFrameworkDetector(mockProjectPath, packageJson);
      const buildTools = await detector.detectBuildTools();
      
      expect(buildTools).toContain('webpack');
    });
    
    it('should detect multiple build tools', async () => {
      const packageJson = {
        devDependencies: {
          vite: '^4.0.0',
          webpack: '^5.0.0',
          rollup: '^3.0.0'
        }
      };
      
      const detector = new JSFrameworkDetector(mockProjectPath, packageJson);
      const buildTools = await detector.detectBuildTools();
      
      expect(buildTools).toHaveLength(3);
      expect(buildTools).toContain('vite');
      expect(buildTools).toContain('webpack');
      expect(buildTools).toContain('rollup');
    });
  });
  
  describe('getTestSetupRecommendations', () => {
    const detector = new JSFrameworkDetector(mockProjectPath, {});
    
    it('should recommend Jest and Testing Library for React', async () => {
      const recommendations = await detector.getTestSetupRecommendations('react');
      
      expect(recommendations.testFramework).toBe('jest');
      expect(recommendations.additionalDeps).toContain('@testing-library/react');
      expect(recommendations.additionalDeps).toContain('@testing-library/jest-dom');
      expect(recommendations.configTemplate).toBe('react-jest');
    });
    
    it('should recommend Vitest for Vue', async () => {
      const recommendations = await detector.getTestSetupRecommendations('vue');
      
      expect(recommendations.testFramework).toBe('vitest');
      expect(recommendations.additionalDeps).toContain('@vue/test-utils');
      expect(recommendations.additionalDeps).toContain('@testing-library/vue');
      expect(recommendations.configTemplate).toBe('vue-vitest');
    });
    
    it('should recommend Karma for Angular', async () => {
      const recommendations = await detector.getTestSetupRecommendations('angular');
      
      expect(recommendations.testFramework).toBe('karma');
      expect(recommendations.additionalDeps).toContain('@angular-devkit/build-angular');
      expect(recommendations.additionalDeps).toContain('karma-jasmine');
      expect(recommendations.configTemplate).toBe('angular-karma');
    });
    
    it('should recommend Jest and Supertest for Express', async () => {
      const recommendations = await detector.getTestSetupRecommendations('express');
      
      expect(recommendations.testFramework).toBe('jest');
      expect(recommendations.additionalDeps).toContain('supertest');
      expect(recommendations.configTemplate).toBe('express-jest');
    });
    
    it('should provide default recommendations for unknown framework', async () => {
      const recommendations = await detector.getTestSetupRecommendations('unknown');
      
      expect(recommendations.testFramework).toBe('jest');
      expect(recommendations.additionalDeps).toHaveLength(0);
      expect(recommendations.configTemplate).toBe('default-jest');
    });
  });
  
  describe('edge cases', () => {
    it('should handle frameworks in peerDependencies', async () => {
      const packageJson = {
        peerDependencies: {
          react: '^18.0.0'
        }
      };
      
      const detector = new JSFrameworkDetector(mockProjectPath, packageJson);
      const frameworks = await detector.detectFrameworks();
      
      expect(frameworks).toHaveLength(1);
      expect(frameworks[0]?.name).toBe('react');
    });
    
    it('should detect NestJS as Express-compatible', async () => {
      const packageJson = {
        dependencies: {
          '@nestjs/core': '^9.0.0',
          '@nestjs/common': '^9.0.0'
        }
      };
      
      const detector = new JSFrameworkDetector(mockProjectPath, packageJson);
      const frameworks = await detector.detectFrameworks();
      
      expect(frameworks).toHaveLength(1);
      expect(frameworks[0]).toMatchObject({
        name: 'express',
        confidence: 0.95,
        version: '^9.0.0'
      });
    });
    
    it('should handle Svelte framework', async () => {
      const packageJson = {
        dependencies: {
          svelte: '^3.0.0'
        }
      };
      
      const detector = new JSFrameworkDetector(mockProjectPath, packageJson);
      const frameworks = await detector.detectFrameworks();
      
      expect(frameworks).toHaveLength(1);
      expect(frameworks[0]).toMatchObject({
        name: 'svelte',
        confidence: 0.95,
        version: '^3.0.0'
      });
    });
    
    it('should handle Nuxt and detect implied Vue', async () => {
      const packageJson = {
        dependencies: {
          nuxt: '^3.0.0'
        }
      };
      
      const detector = new JSFrameworkDetector(mockProjectPath, packageJson);
      const frameworks = await detector.detectFrameworks();
      
      expect(frameworks).toHaveLength(2);
      expect(frameworks.find(f => f.name === 'nuxt')).toMatchObject({
        name: 'nuxt',
        confidence: 0.95,
        version: '^3.0.0'
      });
      expect(frameworks.find(f => f.name === 'vue')).toMatchObject({
        name: 'vue',
        confidence: 0.9
      });
    });
  });
});