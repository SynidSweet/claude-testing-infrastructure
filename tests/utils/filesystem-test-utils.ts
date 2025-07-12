import { vol } from 'memfs';
import { fs } from 'memfs';
import * as path from 'path';

/**
 * Utilities for testing with in-memory filesystem
 * Provides performance optimization for tests that don't require real I/O
 */
export class FileSystemTestUtils {
  private static originalFs: any;
  private static mockActive = false;

  /**
   * Create an in-memory filesystem with specified files
   * @param files Object mapping file paths to content
   * @param rootPath Optional root path for all files
   */
  static setupInMemoryFileSystem(files: Record<string, string>, rootPath: string = '/test'): void {
    // Reset any existing mock
    this.cleanupInMemoryFileSystem();
    
    // Create normalized file structure
    const normalizedFiles: Record<string, string> = {};
    for (const [filePath, content] of Object.entries(files)) {
      const fullPath = path.isAbsolute(filePath) ? filePath : path.join(rootPath, filePath);
      normalizedFiles[fullPath] = content;
    }
    
    // Setup memfs with file structure
    vol.fromJSON(normalizedFiles);
    
    // Store original fs for restoration
    if (!this.originalFs) {
      this.originalFs = jest.requireActual('fs');
    }
    
    // Mock fs module
    jest.doMock('fs', () => ({
      ...fs,
      promises: fs.promises
    }));
    
    // Mock fs/promises module
    jest.doMock('fs/promises', () => fs.promises);
    
    // Mock the common-imports module specifically
    jest.doMock('../../src/utils/common-imports', () => ({
      ...jest.requireActual('../../src/utils/common-imports'),
      fs: fs.promises
    }));
    
    this.mockActive = true;
  }

  /**
   * Add files to existing in-memory filesystem
   * @param files Object mapping file paths to content
   * @param rootPath Optional root path for all files
   */
  static addFiles(files: Record<string, string>, rootPath: string = '/test'): void {
    if (!this.mockActive) {
      throw new Error('In-memory filesystem not active. Call setupInMemoryFileSystem first.');
    }
    
    const normalizedFiles: Record<string, string> = {};
    for (const [filePath, content] of Object.entries(files)) {
      const fullPath = path.isAbsolute(filePath) ? filePath : path.join(rootPath, filePath);
      normalizedFiles[fullPath] = content;
    }
    
    vol.fromJSON(normalizedFiles);
  }

  /**
   * Remove files from in-memory filesystem
   * @param filePaths Array of file paths to remove
   */
  static removeFiles(filePaths: string[]): void {
    if (!this.mockActive) {
      throw new Error('In-memory filesystem not active. Call setupInMemoryFileSystem first.');
    }
    
    for (const filePath of filePaths) {
      try {
        vol.unlinkSync(filePath);
      } catch (error) {
        // Ignore if file doesn't exist
      }
    }
  }

  /**
   * Check if a file exists in the in-memory filesystem
   * @param filePath Path to check
   * @returns true if file exists
   */
  static fileExists(filePath: string): boolean {
    if (!this.mockActive) {
      throw new Error('In-memory filesystem not active. Call setupInMemoryFileSystem first.');
    }
    
    try {
      vol.statSync(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get content of a file from in-memory filesystem
   * @param filePath Path to file
   * @returns File content as string
   */
  static getFileContent(filePath: string): string {
    if (!this.mockActive) {
      throw new Error('In-memory filesystem not active. Call setupInMemoryFileSystem first.');
    }
    
    return vol.readFileSync(filePath, 'utf8') as string;
  }

  /**
   * Get current filesystem structure as JSON
   * @returns Object mapping all file paths to content
   */
  static getFileSystemSnapshot(): Record<string, string> {
    if (!this.mockActive) {
      throw new Error('In-memory filesystem not active. Call setupInMemoryFileSystem first.');
    }
    
    return vol.toJSON() as Record<string, string>;
  }

  /**
   * Clean up in-memory filesystem and restore original fs
   */
  static cleanupInMemoryFileSystem(): void {
    if (this.mockActive) {
      // Clear memfs
      vol.reset();
      
      // Restore original fs
      jest.restoreAllMocks();
      
      this.mockActive = false;
    }
  }

  /**
   * Create a standard test project structure
   * @param projectType Type of project (javascript, typescript, python, etc.)
   * @param projectPath Root path for the project
   * @returns Object with project files
   */
  static createStandardProject(projectType: string, projectPath: string = '/test/project'): Record<string, string> {
    const projects: Record<string, Record<string, string>> = {
      javascript: {
        [`${projectPath}/package.json`]: JSON.stringify({
          name: 'test-project',
          version: '1.0.0',
          main: 'index.js',
          scripts: {
            test: 'jest'
          },
          dependencies: {
            express: '^4.18.0'
          }
        }, null, 2),
        [`${projectPath}/index.js`]: 'const express = require("express");\nconst app = express();\nmodule.exports = app;',
        [`${projectPath}/src/utils.js`]: 'function add(a, b) {\n  return a + b;\n}\nmodule.exports = { add };',
        [`${projectPath}/src/config.js`]: 'module.exports = {\n  port: 3000,\n  env: "development"\n};'
      },
      typescript: {
        [`${projectPath}/package.json`]: JSON.stringify({
          name: 'test-project',
          version: '1.0.0',
          main: 'dist/index.js',
          scripts: {
            build: 'tsc',
            test: 'jest'
          },
          devDependencies: {
            typescript: '^5.0.0',
            '@types/node': '^18.0.0'
          }
        }, null, 2),
        [`${projectPath}/tsconfig.json`]: JSON.stringify({
          compilerOptions: {
            target: 'ES2020',
            module: 'commonjs',
            outDir: './dist',
            rootDir: './src',
            strict: true
          }
        }, null, 2),
        [`${projectPath}/src/index.ts`]: 'import express from "express";\nconst app = express();\nexport default app;',
        [`${projectPath}/src/utils.ts`]: 'export function add(a: number, b: number): number {\n  return a + b;\n}'
      },
      python: {
        [`${projectPath}/setup.py`]: 'from setuptools import setup\nsetup(name="test-project", version="1.0.0")',
        [`${projectPath}/requirements.txt`]: 'flask>=2.0.0\nrequests>=2.28.0',
        [`${projectPath}/src/main.py`]: 'from flask import Flask\napp = Flask(__name__)\n\nif __name__ == "__main__":\n    app.run()',
        [`${projectPath}/src/utils.py`]: 'def add(a, b):\n    return a + b\n\ndef multiply(a, b):\n    return a * b'
      },
      react: {
        [`${projectPath}/package.json`]: JSON.stringify({
          name: 'test-react-app',
          version: '1.0.0',
          dependencies: {
            react: '^18.0.0',
            'react-dom': '^18.0.0'
          },
          devDependencies: {
            '@testing-library/react': '^13.0.0'
          }
        }, null, 2),
        [`${projectPath}/src/App.js`]: 'import React from "react";\nfunction App() {\n  return <div>Hello World</div>;\n}\nexport default App;',
        [`${projectPath}/src/components/Button.js`]: 'import React from "react";\nconst Button = ({ children, onClick }) => {\n  return <button onClick={onClick}>{children}</button>;\n};\nexport default Button;'
      }
    };

    return projects[projectType] || projects.javascript || {};
  }

  /**
   * Check if in-memory filesystem is currently active
   * @returns true if mock is active
   */
  static isInMemoryActive(): boolean {
    return this.mockActive;
  }
}

/**
 * Test helper for typical filesystem test patterns
 */
export class FileSystemTestHelper {
  /**
   * Setup a test with in-memory filesystem
   * @param files Files to create
   * @param rootPath Root path for files
   * @returns Cleanup function
   */
  static setup(files: Record<string, string>, rootPath?: string): () => void {
    FileSystemTestUtils.setupInMemoryFileSystem(files, rootPath);
    return () => FileSystemTestUtils.cleanupInMemoryFileSystem();
  }

  /**
   * Setup a standard project for testing
   * @param projectType Type of project to create
   * @param projectPath Path for the project
   * @returns Cleanup function
   */
  static setupProject(projectType: string, projectPath?: string): () => void {
    const files = FileSystemTestUtils.createStandardProject(projectType, projectPath);
    FileSystemTestUtils.setupInMemoryFileSystem(files);
    return () => FileSystemTestUtils.cleanupInMemoryFileSystem();
  }

  /**
   * Create a temporary test environment with automatic cleanup
   * @param files Files to create
   * @param testFn Test function to run
   * @param rootPath Root path for files
   */
  static async withInMemoryFS<T>(
    files: Record<string, string>,
    testFn: () => Promise<T> | T,
    rootPath?: string
  ): Promise<T> {
    const cleanup = this.setup(files, rootPath);
    try {
      return await testFn();
    } finally {
      cleanup();
    }
  }
}