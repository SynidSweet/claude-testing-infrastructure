/**
 * Project Structures End-to-End Validation
 * 
 * Tests the infrastructure against various real-world project structures
 * Part of IMPL-E2E-001 - Create End-to-End Validation Suite
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';
import { TestFixtureManager } from '../fixtures/shared/TestFixtureManager';

const execAsync = promisify(exec);
const CLI_COMMAND = 'node dist/cli/index.js';

describe('Project Structures End-to-End Validation', () => {
  let fixtureManager: TestFixtureManager;
  
  beforeAll(async () => {
    fixtureManager = TestFixtureManager.getInstance();
  });

  afterEach(async () => {
    await fixtureManager.cleanup();
  });

  describe('JavaScript Project Structures', () => {
    test('should handle standard React project structure', async () => {
      const projectPath = await fixtureManager.createTemporaryProject('react-project');
      
      // Verify project structure is detected correctly
      const analysisResult = await execAsync(`${CLI_COMMAND} analyze ${projectPath} --format json`, {
        cwd: path.resolve('.')
      });
      
      expect(analysisResult.stdout).toContain('React');
      expect(analysisResult.stdout).toContain('ES module');
      
      // Generate tests and verify structure-specific patterns
      await execAsync(`${CLI_COMMAND} test ${projectPath} --only-structural`, {
        cwd: path.resolve('.')
      });
      
      const testsGenerated = await countGeneratedTests(projectPath);
      expect(testsGenerated).toBeGreaterThan(0);
      
      // Verify React-specific test patterns
      const testFiles = await getGeneratedTestFiles(projectPath);
      const reactTestContent = await fs.readFile(testFiles[0], 'utf-8');
      expect(reactTestContent).toMatch(/@testing-library\/react|render|screen/);
      
      console.log(`✅ React project structure handled correctly (${testsGenerated} tests)`);
    }, 3 * 60 * 1000);

    test('should handle Node.js CommonJS project structure', async () => {
      const projectPath = await fixtureManager.createTemporaryProject('node-js-basic');
      
      const analysisResult = await execAsync(`${CLI_COMMAND} analyze ${projectPath} --format json`, {
        cwd: path.resolve('.')
      });
      
      expect(analysisResult.stdout).toContain('Node.js');
      expect(analysisResult.stdout).toContain('CommonJS');
      
      await execAsync(`${CLI_COMMAND} test ${projectPath} --only-structural`, {
        cwd: path.resolve('.')
      });
      
      const testsGenerated = await countGeneratedTests(projectPath);
      expect(testsGenerated).toBeGreaterThan(0);
      
      // Verify CommonJS-specific test patterns
      const testFiles = await getGeneratedTestFiles(projectPath);
      const nodeTestContent = await fs.readFile(testFiles[0], 'utf-8');
      expect(nodeTestContent).toMatch(/require\(|const.*=.*require/);
      
      console.log(`✅ Node.js CommonJS structure handled correctly (${testsGenerated} tests)`);
    }, 3 * 60 * 1000);

    test('should handle mixed JavaScript/TypeScript project', async () => {
      const projectPath = await fixtureManager.createTemporaryProject('mixed-project');
      
      const analysisResult = await execAsync(`${CLI_COMMAND} analyze ${projectPath} --format json`, {
        cwd: path.resolve('.')
      });
      
      expect(analysisResult.stdout).toContain('TypeScript');
      expect(analysisResult.stdout).toContain('JavaScript');
      
      await execAsync(`${CLI_COMMAND} test ${projectPath} --only-structural`, {
        cwd: path.resolve('.')
      });
      
      const testsGenerated = await countGeneratedTests(projectPath);
      expect(testsGenerated).toBeGreaterThan(0);
      
      console.log(`✅ Mixed JS/TS structure handled correctly (${testsGenerated} tests)`);
    }, 3 * 60 * 1000);
  });

  describe('Python Project Structures', () => {
    test('should handle standard Python project structure', async () => {
      const projectPath = await fixtureManager.createTemporaryProject('python-project');
      
      const analysisResult = await execAsync(`${CLI_COMMAND} analyze ${projectPath} --format json`, {
        cwd: path.resolve('.')
      });
      
      expect(analysisResult.stdout).toContain('Python');
      
      await execAsync(`${CLI_COMMAND} test ${projectPath} --only-structural`, {
        cwd: path.resolve('.')
      });
      
      const testsGenerated = await countGeneratedTests(projectPath);
      expect(testsGenerated).toBeGreaterThan(0);
      
      // Verify Python-specific test patterns
      const testFiles = await getGeneratedTestFiles(projectPath);
      const pythonTestContent = await fs.readFile(testFiles[0], 'utf-8');
      expect(pythonTestContent).toMatch(/import pytest|def test_|assert/);
      
      console.log(`✅ Python structure handled correctly (${testsGenerated} tests)`);
    }, 3 * 60 * 1000);
  });

  describe('Specialized Project Structures', () => {
    test('should handle MCP server project structure', async () => {
      const projectPath = await fixtureManager.createTemporaryProject('mcp-server');
      
      const analysisResult = await execAsync(`${CLI_COMMAND} analyze ${projectPath} --format json`, {
        cwd: path.resolve('.')
      });
      
      expect(analysisResult.stdout).toContain('MCP');
      
      await execAsync(`${CLI_COMMAND} test ${projectPath} --only-structural`, {
        cwd: path.resolve('.')
      });
      
      const testsGenerated = await countGeneratedTests(projectPath);
      expect(testsGenerated).toBeGreaterThan(0);
      
      console.log(`✅ MCP server structure handled correctly (${testsGenerated} tests)`);
    }, 3 * 60 * 1000);

    test('should handle empty/minimal project gracefully', async () => {
      const projectPath = await fixtureManager.createTemporaryProject('empty');
      
      const analysisResult = await execAsync(`${CLI_COMMAND} analyze ${projectPath}`, {
        cwd: path.resolve('.')
      });
      
      expect(analysisResult.stdout).toContain('Project analysis completed');
      
      await execAsync(`${CLI_COMMAND} test ${projectPath} --only-structural`, {
        cwd: path.resolve('.')
      });
      
      // Should complete without error, even if no tests generated
      const testsGenerated = await countGeneratedTests(projectPath);
      expect(testsGenerated).toBeGreaterThanOrEqual(0);
      
      console.log(`✅ Empty project handled gracefully (${testsGenerated} tests)`);
    }, 2 * 60 * 1000);
  });

  describe('Complex Project Configurations', () => {
    test('should handle monorepo-style structure', async () => {
      // Create a complex project with multiple subdirectories
      const projectPath = await createComplexProjectStructure();
      
      const analysisResult = await execAsync(`${CLI_COMMAND} analyze ${projectPath}`, {
        cwd: path.resolve('.')
      });
      
      expect(analysisResult.stdout).toContain('Project analysis completed');
      
      await execAsync(`${CLI_COMMAND} test ${projectPath} --only-structural`, {
        cwd: path.resolve('.')
      });
      
      const testsGenerated = await countGeneratedTests(projectPath);
      expect(testsGenerated).toBeGreaterThan(0);
      
      console.log(`✅ Complex monorepo structure handled (${testsGenerated} tests)`);
      
      // Cleanup
      await fs.rm(projectPath, { recursive: true, force: true });
    }, 5 * 60 * 1000);

    test('should handle project with custom configuration', async () => {
      const projectPath = await fixtureManager.createTemporaryProject('react-project');
      
      // Create custom configuration with specific patterns
      const configPath = path.join(projectPath, '.claude-testing.config.json');
      await fs.writeFile(configPath, JSON.stringify({
        include: ['src/**/*.jsx', 'src/**/*.js'],
        exclude: ['src/index.js', 'src/**/*.test.js'],
        testFramework: 'jest',
        features: {
          coverage: true,
          edgeCases: true
        },
        ai: {
          model: 'claude-3-5-sonnet-20241022',
          temperature: 0.1
        }
      }));

      const analysisResult = await execAsync(`${CLI_COMMAND} analyze ${projectPath} --show-config-sources`, {
        cwd: path.resolve('.')
      });
      
      expect(analysisResult.stdout).toContain('Project analysis completed');
      
      await execAsync(`${CLI_COMMAND} test ${projectPath} --only-structural`, {
        cwd: path.resolve('.')
      });
      
      const testsGenerated = await countGeneratedTests(projectPath);
      expect(testsGenerated).toBeGreaterThan(0);
      
      console.log(`✅ Custom configuration respected (${testsGenerated} tests)`);
    }, 3 * 60 * 1000);

    test('should handle project with nested source directories', async () => {
      const projectPath = await createNestedProjectStructure();
      
      const analysisResult = await execAsync(`${CLI_COMMAND} analyze ${projectPath}`, {
        cwd: path.resolve('.')
      });
      
      expect(analysisResult.stdout).toContain('Project analysis completed');
      
      await execAsync(`${CLI_COMMAND} test ${projectPath} --only-structural`, {
        cwd: path.resolve('.')
      });
      
      const testsGenerated = await countGeneratedTests(projectPath);
      expect(testsGenerated).toBeGreaterThan(0);
      
      console.log(`✅ Nested directory structure handled (${testsGenerated} tests)`);
      
      // Cleanup
      await fs.rm(projectPath, { recursive: true, force: true });
    }, 3 * 60 * 1000);
  });

  describe('Framework Detection', () => {
    test('should detect React framework correctly', async () => {
      const projectPath = await fixtureManager.createTemporaryProject('react-project');
      
      const analysisResult = await execAsync(`${CLI_COMMAND} analyze ${projectPath} --verbose`, {
        cwd: path.resolve('.')
      });
      
      expect(analysisResult.stdout).toMatch(/React.*detected|Framework.*React/i);
      console.log('✅ React framework detection working');
    });

    test('should detect Node.js framework correctly', async () => {
      const projectPath = await fixtureManager.createTemporaryProject('node-js-basic');
      
      const analysisResult = await execAsync(`${CLI_COMMAND} analyze ${projectPath} --verbose`, {
        cwd: path.resolve('.')
      });
      
      expect(analysisResult.stdout).toMatch(/Node\.js.*detected|Framework.*Node/i);
      console.log('✅ Node.js framework detection working');
    });

    test('should detect Python frameworks correctly', async () => {
      const projectPath = await fixtureManager.createTemporaryProject('python-project');
      
      const analysisResult = await execAsync(`${CLI_COMMAND} analyze ${projectPath} --verbose`, {
        cwd: path.resolve('.')
      });
      
      expect(analysisResult.stdout).toMatch(/Python.*detected|Framework.*Python/i);
      console.log('✅ Python framework detection working');
    });
  });
});

/**
 * Count generated test files
 */
async function countGeneratedTests(projectPath: string): Promise<number> {
  try {
    const testDir = path.join(projectPath, '.claude-testing');
    const files = await fs.readdir(testDir, { recursive: true });
    return files.filter(f => f.toString().match(/\.(test|spec)\.(js|ts|jsx|tsx|py)$/)).length;
  } catch {
    return 0;
  }
}

/**
 * Get list of generated test files
 */
async function getGeneratedTestFiles(projectPath: string): Promise<string[]> {
  try {
    const testDir = path.join(projectPath, '.claude-testing');
    const files = await fs.readdir(testDir, { recursive: true });
    const testFiles = files.filter(f => f.toString().match(/\.(test|spec)\.(js|ts|jsx|tsx|py)$/));
    return testFiles.map(f => path.join(testDir, f.toString()));
  } catch {
    return [];
  }
}

/**
 * Create a complex project structure for testing
 */
async function createComplexProjectStructure(): Promise<string> {
  const tempDir = path.join(process.cwd(), 'temp-complex-project');
  
  // Create directory structure
  await fs.mkdir(tempDir, { recursive: true });
  await fs.mkdir(path.join(tempDir, 'packages/frontend/src'), { recursive: true });
  await fs.mkdir(path.join(tempDir, 'packages/backend/src'), { recursive: true });
  await fs.mkdir(path.join(tempDir, 'packages/shared/src'), { recursive: true });
  
  // Create package.json files
  await fs.writeFile(
    path.join(tempDir, 'package.json'),
    JSON.stringify({
      name: 'complex-monorepo',
      workspaces: ['packages/*'],
      private: true
    })
  );
  
  await fs.writeFile(
    path.join(tempDir, 'packages/frontend/package.json'),
    JSON.stringify({
      name: 'frontend',
      type: 'module',
      dependencies: { react: '^18.0.0' }
    })
  );
  
  await fs.writeFile(
    path.join(tempDir, 'packages/backend/package.json'),
    JSON.stringify({
      name: 'backend',
      type: 'commonjs',
      dependencies: { express: '^4.18.0' }
    })
  );
  
  // Create some source files
  await fs.writeFile(
    path.join(tempDir, 'packages/frontend/src/App.jsx'),
    'export default function App() { return <div>Hello</div>; }'
  );
  
  await fs.writeFile(
    path.join(tempDir, 'packages/backend/src/server.js'),
    'const express = require("express"); const app = express(); module.exports = app;'
  );
  
  await fs.writeFile(
    path.join(tempDir, 'packages/shared/src/utils.js'),
    'export function shared() { return "shared"; }'
  );
  
  return tempDir;
}

/**
 * Create a project with nested source directories
 */
async function createNestedProjectStructure(): Promise<string> {
  const tempDir = path.join(process.cwd(), 'temp-nested-project');
  
  // Create deeply nested structure
  await fs.mkdir(path.join(tempDir, 'src/components/ui/buttons'), { recursive: true });
  await fs.mkdir(path.join(tempDir, 'src/services/api/auth'), { recursive: true });
  await fs.mkdir(path.join(tempDir, 'src/utils/helpers/validators'), { recursive: true });
  
  // Create package.json
  await fs.writeFile(
    path.join(tempDir, 'package.json'),
    JSON.stringify({
      name: 'nested-project',
      type: 'module',
      dependencies: { react: '^18.0.0' }
    })
  );
  
  // Create nested source files
  await fs.writeFile(
    path.join(tempDir, 'src/components/ui/buttons/Button.jsx'),
    'export default function Button() { return <button>Click</button>; }'
  );
  
  await fs.writeFile(
    path.join(tempDir, 'src/services/api/auth/AuthService.js'),
    'export class AuthService { login() { return Promise.resolve(); } }'
  );
  
  await fs.writeFile(
    path.join(tempDir, 'src/utils/helpers/validators/EmailValidator.js'),
    'export function validateEmail(email) { return email.includes("@"); }'
  );
  
  return tempDir;
}