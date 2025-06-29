import { ProjectAnalyzer } from '../../src/analyzers/ProjectAnalyzer';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

describe('ProjectAnalyzer', () => {
  let tempDir: string;
  let analyzer: ProjectAnalyzer;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'project-analyzer-test-'));
    analyzer = new ProjectAnalyzer(tempDir);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true });
  });

  describe('analyze()', () => {
    it('should analyze an empty directory', async () => {
      const result = await analyzer.analyzeProject();
      
      expect(result.projectPath).toBe(tempDir);
      expect(result.languages).toHaveLength(0);
      expect(result.frameworks).toHaveLength(0);
      expect(result.packageManagers).toHaveLength(0);
      expect(result.testingSetup.hasTests).toBe(false);
      expect(result.complexity.totalFiles).toBe(0);
    });

    it('should detect JavaScript project with React', async () => {
      // Create package.json with React
      const packageJson = {
        name: 'test-project',
        dependencies: {
          react: '^18.0.0',
          'react-dom': '^18.0.0'
        },
        devDependencies: {
          jest: '^29.0.0'
        }
      };
      await fs.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      // Create package-lock.json to simulate npm
      await fs.writeFile(
        path.join(tempDir, 'package-lock.json'),
        JSON.stringify({ name: 'test-project', lockfileVersion: 2 }, null, 2)
      );

      // Create some JavaScript files
      await fs.writeFile(
        path.join(tempDir, 'App.js'),
        'import React from "react";\nexport default function App() { return <div>Hello</div>; }'
      );
      
      await fs.mkdir(path.join(tempDir, 'src'));
      await fs.writeFile(
        path.join(tempDir, 'src', 'index.js'),
        'import React from "react";\nimport ReactDOM from "react-dom";\nReactDOM.render(<App />, document.getElementById("root"));'
      );

      // Create test file
      await fs.writeFile(
        path.join(tempDir, 'App.test.js'),
        'import { render } from "@testing-library/react";\nimport App from "./App";\ntest("renders app", () => { render(<App />); });'
      );

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
      expect(result.testingSetup.testFiles.length).toBeGreaterThan(0);

      // Check dependencies
      expect(result.dependencies.production.react).toBe('^18.0.0');
      expect(result.dependencies.development.jest).toBe('^29.0.0');

      // Check project structure
      expect(result.projectStructure.srcDirectory).toBe('src');
      expect(result.projectStructure.entryPoints.length).toBeGreaterThan(0);
    });

    it('should detect TypeScript project with Vue', async () => {
      // Create package.json with Vue and TypeScript
      const packageJson = {
        name: 'vue-ts-project',
        dependencies: {
          vue: '^3.0.0'
        },
        devDependencies: {
          typescript: '^4.0.0',
          '@vue/cli': '^5.0.0',
          vitest: '^0.30.0'
        }
      };
      await fs.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      // Create TypeScript files
      await fs.writeFile(
        path.join(tempDir, 'main.ts'),
        'import { createApp } from "vue";\nimport App from "./App.vue";\ncreateApp(App).mount("#app");'
      );

      await fs.writeFile(
        path.join(tempDir, 'App.vue'),
        '<template><div>Hello Vue</div></template>\n<script setup lang="ts">\n// Vue component\n</script>'
      );

      // Create test file
      await fs.writeFile(
        path.join(tempDir, 'App.test.ts'),
        'import { mount } from "@vue/test-utils";\nimport App from "./App.vue";\ntest("renders vue app", () => { mount(App); });'
      );

      const result = await analyzer.analyzeProject();

      // Check languages
      expect(result.languages.map(l => l.name)).toContain('typescript');

      // Check frameworks
      expect(result.frameworks.map(f => f.name)).toContain('vue');

      // Check testing setup
      expect(result.testingSetup.testFrameworks).toContain('vitest');
    });

    it('should detect Python FastAPI project', async () => {
      // Create requirements.txt
      await fs.writeFile(
        path.join(tempDir, 'requirements.txt'),
        'fastapi==0.95.0\nuvicorn==0.21.0\npytest==7.3.0\ncoverage==7.2.0'
      );

      // Create Python files
      await fs.writeFile(
        path.join(tempDir, 'main.py'),
        'from fastapi import FastAPI\napp = FastAPI()\n@app.get("/")\ndef read_root():\n    return {"Hello": "World"}'
      );

      await fs.writeFile(
        path.join(tempDir, 'models.py'),
        'from pydantic import BaseModel\nclass Item(BaseModel):\n    name: str\n    price: float'
      );

      // Create test file
      await fs.writeFile(
        path.join(tempDir, 'test_main.py'),
        'from fastapi.testclient import TestClient\nfrom main import app\nclient = TestClient(app)\ndef test_read_root():\n    response = client.get("/")\n    assert response.status_code == 200'
      );

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
      const packageJson = {
        name: 'express-api',
        dependencies: {
          express: '^4.18.0',
          cors: '^2.8.5'
        },
        devDependencies: {
          nodemon: '^2.0.0',
          supertest: '^6.3.0',
          jest: '^29.0.0'
        }
      };
      await fs.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      await fs.writeFile(
        path.join(tempDir, 'server.js'),
        'const express = require("express");\nconst app = express();\napp.get("/", (req, res) => res.send("Hello World"));\napp.listen(3000);'
      );

      await fs.writeFile(
        path.join(tempDir, 'routes.js'),
        'const express = require("express");\nconst router = express.Router();\nrouter.get("/api/users", (req, res) => res.json([]));'
      );

      const result = await analyzer.analyzeProject();

      expect(result.frameworks.map(f => f.name)).toContain('express');
      expect(result.projectStructure.entryPoints.some(ep => ep.includes('server.js'))).toBe(true);
    });

    it('should handle projects with multiple languages', async () => {
      // Create package.json (JavaScript/TypeScript)
      const packageJson = {
        name: 'fullstack-project',
        dependencies: {
          express: '^4.18.0',
          react: '^18.0.0'
        }
      };
      await fs.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      // Create Python requirements
      await fs.writeFile(
        path.join(tempDir, 'requirements.txt'),
        'django==4.2.0\ndjango-rest-framework==3.14.0'
      );

      // Create files in different languages
      await fs.writeFile(path.join(tempDir, 'server.js'), 'const express = require("express");');
      await fs.writeFile(path.join(tempDir, 'app.tsx'), 'import React from "react";');
      await fs.writeFile(path.join(tempDir, 'api.py'), 'from django.http import JsonResponse');

      const result = await analyzer.analyzeProject();

      const languageNames = result.languages.map(l => l.name);
      expect(languageNames).toContain('javascript');
      expect(languageNames).toContain('typescript');
      expect(languageNames).toContain('python');

      const frameworkNames = result.frameworks.map(f => f.name);
      expect(frameworkNames).toContain('react');
      expect(frameworkNames).toContain('express');
      expect(frameworkNames).toContain('django');
    });

    it('should calculate complexity metrics correctly', async () => {
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

      const result = await analyzer.analyzeProject();

      expect(result.complexity.totalFiles).toBe(3);
      expect(result.complexity.totalLines).toBeGreaterThan(250);
      expect(result.complexity.averageFileSize).toBeGreaterThan(80);
      expect(result.complexity.largestFiles).toHaveLength(3);
      expect(result.complexity.largestFiles[0]?.path).toContain('large.js');
    });
  });

  describe('error handling', () => {
    it('should handle invalid project paths gracefully', async () => {
      const invalidAnalyzer = new ProjectAnalyzer('/nonexistent/path');
      
      await expect(invalidAnalyzer.analyzeProject()).rejects.toThrow();
    });

    it('should handle malformed package.json', async () => {
      await fs.writeFile(
        path.join(tempDir, 'package.json'),
        '{ invalid json'
      );

      const result = await analyzer.analyzeProject();
      
      // Should not crash, just treat as no package.json
      expect(result.dependencies.production).toEqual({});
      expect(result.dependencies.development).toEqual({});
    });

    it('should handle unreadable files gracefully', async () => {
      // Create a file and make it unreadable (if possible)
      const filePath = path.join(tempDir, 'test.js');
      await fs.writeFile(filePath, 'console.log("test");');
      
      try {
        await fs.chmod(filePath, 0o000);
      } catch {
        // Skip this test on Windows or if chmod fails
        return;
      }

      const result = await analyzer.analyzeProject();
      
      // Should complete without throwing
      expect(result).toBeDefined();
      
      // Restore permissions for cleanup
      await fs.chmod(filePath, 0o644);
    });
  });
});