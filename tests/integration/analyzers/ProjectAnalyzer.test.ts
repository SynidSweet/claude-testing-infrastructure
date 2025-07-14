import { ProjectAnalyzer } from '../../../src/analyzers/ProjectAnalyzer';
import { getSharedFixture, createTemporaryProject, cleanupTemporaryProject, setupFixtureLifecycle, FIXTURE_TEMPLATES } from '../../fixtures/shared';
import { fs, path } from '../../../src/utils/common-imports';

describe('ProjectAnalyzer', () => {
  setupFixtureLifecycle();

  describe('analyze()', () => {
    it('should analyze an empty directory', async () => {
      const fixture = await getSharedFixture(FIXTURE_TEMPLATES.EMPTY);
      const analyzer = new ProjectAnalyzer(fixture.path);
      const result = await analyzer.analyzeProject();
      
      expect(result.projectPath).toBe(fixture.path);
      expect(result.languages).toHaveLength(0);
      expect(result.frameworks).toHaveLength(0);
      expect(result.packageManagers).toHaveLength(0);
      expect(result.testingSetup.hasTests).toBe(false);
      expect(result.complexity.totalFiles).toBe(0);
    });

    it('should detect JavaScript project with React', async () => {
      const fixture = await getSharedFixture(FIXTURE_TEMPLATES.REACT_PROJECT);
      const analyzer = new ProjectAnalyzer(fixture.path);
      const result = await analyzer.analyzeProject();

      // Check languages
      expect(result.languages).toHaveLength(1);
      expect(result.languages[0]?.name).toBe('javascript');
      expect(result.languages[0]?.confidence).toBeGreaterThan(0);

      // Check frameworks
      expect(result.frameworks).toHaveLength(1);
      expect(result.frameworks[0]?.name).toBe('react');
      expect(result.frameworks[0]?.version).toBe('^18.0.0');

      // Check package manager
      expect(result.packageManagers).toHaveLength(1);
      expect(result.packageManagers[0]?.name).toBe('npm');

      // Check testing setup
      expect(result.testingSetup.hasTests).toBe(true);
      expect(result.testingSetup.testFrameworks).toContain('jest');

      // Check dependencies
      expect(result.dependencies.production.react).toBe('^18.0.0');
      expect(result.dependencies.development.jest).toBe('^29.0.0');
    });

    it('should detect TypeScript project with Vue', async () => {
      const tempDir = await createTemporaryProject(FIXTURE_TEMPLATES.VUE_PROJECT);
      
      try {
        // Add TypeScript to the existing Vue project
        const packageJson = JSON.parse(await fs.readFile(path.join(tempDir, 'package.json'), 'utf-8'));
        packageJson.devDependencies.typescript = '^4.0.0';
        await fs.writeFile(
          path.join(tempDir, 'package.json'),
          JSON.stringify(packageJson, null, 2)
        );

        // Create TypeScript files
        await fs.writeFile(
          path.join(tempDir, 'main.ts'),
          'import { createApp } from "vue";\nimport App from "./App.vue";\ncreateApp(App).mount("#app");'
        );

        // Create test file
        await fs.writeFile(
          path.join(tempDir, 'App.test.ts'),
          'import { mount } from "@vue/test-utils";\nimport App from "./App.vue";\ntest("renders vue app", () => { mount(App); });'
        );

        const analyzer = new ProjectAnalyzer(tempDir);
        const result = await analyzer.analyzeProject();

        // Check languages
        expect(result.languages.map(l => l.name)).toContain('typescript');

        // Check frameworks
        expect(result.frameworks.map(f => f.name)).toContain('vue');

        // Check testing setup
        expect(result.testingSetup.testFrameworks).toContain('vitest');
      } finally {
        await cleanupTemporaryProject(tempDir);
      }
    });

    it('should detect Python FastAPI project', async () => {
      const fixture = await getSharedFixture(FIXTURE_TEMPLATES.FASTAPI_PROJECT);
      const analyzer = new ProjectAnalyzer(fixture.path);
      const result = await analyzer.analyzeProject();

      // Check languages
      expect(result.languages.map(l => l.name)).toContain('python');

      // Check frameworks
      expect(result.frameworks.map(f => f.name)).toContain('fastapi');

      // Check package manager
      expect(result.packageManagers.map(pm => pm.name)).toContain('pip');

      // Check testing setup
      expect(result.testingSetup.hasTests).toBe(true);
      expect(result.testingSetup.testFrameworks).toContain('pytest');

      // Check Python dependencies
      expect(result.dependencies.python).toBeDefined();
      expect(result.dependencies.python?.fastapi).toBeDefined();
    });

    it('should detect Express.js backend project', async () => {
      const fixture = await getSharedFixture(FIXTURE_TEMPLATES.EXPRESS_PROJECT);
      const analyzer = new ProjectAnalyzer(fixture.path);
      const result = await analyzer.analyzeProject();

      expect(result.frameworks.map(f => f.name)).toContain('express');
      expect(result.projectStructure.entryPoints.some(ep => ep.includes('server.js'))).toBe(true);
    });

    it('should handle projects with multiple languages', async () => {
      const tempDir = await createTemporaryProject(FIXTURE_TEMPLATES.MIXED_PROJECT);
      
      try {
        // Add more files to create a fuller mixed project
        await fs.writeFile(path.join(tempDir, 'server.js'), 'const express = require("express");');
        await fs.writeFile(path.join(tempDir, 'app.tsx'), 'import React from "react";');
        
        const analyzer = new ProjectAnalyzer(tempDir);
        const result = await analyzer.analyzeProject();

        const languageNames = result.languages.map((l: any) => l.name);
        expect(languageNames).toContain('javascript');
        expect(languageNames).toContain('typescript');
        expect(languageNames).toContain('python');

        const frameworkNames = result.frameworks.map((f: any) => f.name);
        expect(frameworkNames).toContain('react');
        expect(frameworkNames).toContain('fastapi');
      } finally {
        await cleanupTemporaryProject(tempDir);
      }
    });

    it('should calculate complexity metrics correctly', async () => {
      const tempDir = await createTemporaryProject(FIXTURE_TEMPLATES.EMPTY);
      
      try {
        // Create files of varying sizes
        await fs.writeFile(
          path.join(tempDir, 'small.js'),
          'console.log("hello");'
        );

        await fs.writeFile(
          path.join(tempDir, 'medium.js'),
          Array(50).fill('console.log("line");').join('\n')
        );

        await fs.writeFile(
          path.join(tempDir, 'large.js'),
          Array(200).fill('console.log("line");').join('\n')
        );

        const analyzer = new ProjectAnalyzer(tempDir);
        const result = await analyzer.analyzeProject();

        expect(result.complexity.totalFiles).toBe(3);
        expect(result.complexity.totalLines).toBeGreaterThan(250);
        expect(result.complexity.averageFileSize).toBeGreaterThan(80);
        expect(result.complexity.largestFiles).toHaveLength(3);
        expect(result.complexity.largestFiles[0]?.path).toContain('large.js');
      } finally {
        await cleanupTemporaryProject(tempDir);
      }
    });
  });

  describe('error handling', () => {
    it('should handle invalid project paths gracefully', async () => {
      const invalidAnalyzer = new ProjectAnalyzer('/nonexistent/path');
      
      await expect(invalidAnalyzer.analyzeProject()).rejects.toThrow();
    });

    it('should handle malformed package.json', async () => {
      const tempDir = await createTemporaryProject(FIXTURE_TEMPLATES.EMPTY);
      
      try {
        await fs.writeFile(
          path.join(tempDir, 'package.json'),
          '{ invalid json'
        );

        const analyzer = new ProjectAnalyzer(tempDir);
        const result = await analyzer.analyzeProject();
        
        // Should not crash, just treat as no package.json
        expect(result.dependencies.production).toEqual({});
        expect(result.dependencies.development).toEqual({});
      } finally {
        await cleanupTemporaryProject(tempDir);
      }
    });

    it('should handle unreadable files gracefully', async () => {
      const tempDir = await createTemporaryProject(FIXTURE_TEMPLATES.EMPTY);
      
      try {
        // Create a file and make it unreadable (if possible)
        const filePath = path.join(tempDir, 'test.js');
        await fs.writeFile(filePath, 'console.log("test");');
        
        try {
          await fs.chmod(filePath, 0o000);
        } catch {
          // Skip this test on Windows or if chmod fails
          return;
        }

        const analyzer = new ProjectAnalyzer(tempDir);
        const result = await analyzer.analyzeProject();
        
        // Should complete without throwing
        expect(result).toBeDefined();
        
        // Restore permissions for cleanup
        await fs.chmod(filePath, 0o644);
      } finally {
        await cleanupTemporaryProject(tempDir);
      }
    });
  });
});