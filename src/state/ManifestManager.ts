/**
 * Manages the .claude-testing manifest file for tracking incremental state
 */

import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { handleFileOperation } from '../utils/error-handling';

export interface TestManifest {
  version: string;
  projectPath: string;
  projectHash: string;
  lastAnalysis: string;
  lastGeneration: string;
  framework: string;
  language: string;
  files: FileManifest[];
  tests: TestManifest[];
  baselines: BaselineManifest[];
}

export interface FileManifest {
  relativePath: string;
  hash: string;
  lastModified: string;
  lastAnalyzed: string;
  complexity: number;
  hasTests: boolean;
  testFiles: string[];
}

export interface TestFile {
  relativePath: string;
  hash: string;
  sourceFile: string;
  generationType: 'structural' | 'logical' | 'ai';
  lastGenerated: string;
  status: 'current' | 'outdated' | 'failed';
}

export interface BaselineManifest {
  id: string;
  gitCommit?: string;
  timestamp: string;
  description: string;
  coverage: number;
  testCount: number;
}

export class ManifestManager {
  private manifestPath: string;
  private stateDir: string;

  constructor(private projectPath: string) {
    this.stateDir = path.join(projectPath, '.claude-testing');
    this.manifestPath = path.join(this.stateDir, 'manifest.json');
  }

  /**
   * Initialize .claude-testing directory structure
   */
  async initialize(): Promise<void> {
    await fs.mkdir(this.stateDir, { recursive: true });
    await fs.mkdir(path.join(this.stateDir, 'tests'), { recursive: true });
    await fs.mkdir(path.join(this.stateDir, 'cache'), { recursive: true });
    await fs.mkdir(path.join(this.stateDir, 'reports'), { recursive: true });
    await fs.mkdir(path.join(this.stateDir, 'history'), { recursive: true });

    // Create .gitignore for state directory
    const gitignorePath = path.join(this.stateDir, '.gitignore');
    const gitignoreContent = [
      '# Claude Testing Infrastructure - State Directory',
      '# Add this directory to your project .gitignore',
      '',
      'cache/',
      'temp/',
      '*.log',
      'coverage/',
      'reports/*.html',
    ].join('\n');

    await fs.writeFile(gitignorePath, gitignoreContent);

    // Initialize manifest if it doesn't exist
    if (!(await this.exists())) {
      await this.createInitialManifest();
    }
  }

  /**
   * Check if manifest exists
   */
  async exists(): Promise<boolean> {
    try {
      await fs.access(this.manifestPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Load manifest from disk
   */
  async load(): Promise<TestManifest> {
    return await handleFileOperation(
      async () => {
        const content = await fs.readFile(this.manifestPath, 'utf-8');
        return JSON.parse(content) as TestManifest;
      },
      'loading manifest file',
      this.manifestPath
    );
  }

  /**
   * Save manifest to disk
   */
  async save(manifest: TestManifest): Promise<void> {
    await handleFileOperation(
      async () => {
        const content = JSON.stringify(manifest, null, 2);
        await fs.writeFile(this.manifestPath, content);
      },
      'saving manifest file',
      this.manifestPath
    );
  }

  /**
   * Create initial manifest
   */
  private async createInitialManifest(): Promise<TestManifest> {
    const manifest: TestManifest = {
      version: '1.0.0',
      projectPath: this.projectPath,
      projectHash: this.calculateProjectHash(),
      lastAnalysis: new Date().toISOString(),
      lastGeneration: new Date().toISOString(),
      framework: 'unknown',
      language: 'unknown',
      files: [],
      tests: [],
      baselines: [],
    };

    await this.save(manifest);
    return manifest;
  }

  /**
   * Update file in manifest
   */
  async updateFile(
    relativePath: string,
    stats: {
      hash: string;
      lastModified: string;
      complexity: number;
      hasTests: boolean;
      testFiles: string[];
    }
  ): Promise<void> {
    const manifest = await this.load();

    const existingIndex = manifest.files.findIndex((f) => f.relativePath === relativePath);
    const fileManifest: FileManifest = {
      relativePath,
      hash: stats.hash,
      lastModified: stats.lastModified,
      lastAnalyzed: new Date().toISOString(),
      complexity: stats.complexity,
      hasTests: stats.hasTests,
      testFiles: stats.testFiles,
    };

    if (existingIndex >= 0) {
      manifest.files[existingIndex] = fileManifest;
    } else {
      manifest.files.push(fileManifest);
    }

    await this.save(manifest);
  }

  /**
   * Get files that have changed since last analysis
   */
  async getChangedFiles(): Promise<string[]> {
    const manifest = await this.load();
    const changedFiles: string[] = [];

    for (const fileManifest of manifest.files) {
      const fullPath = path.join(this.projectPath, fileManifest.relativePath);

      try {
        const currentHash = await this.calculateFileHash(fullPath);
        if (currentHash !== fileManifest.hash) {
          changedFiles.push(fileManifest.relativePath);
        }
      } catch {
        // File may have been deleted
        changedFiles.push(fileManifest.relativePath);
      }
    }

    return changedFiles;
  }

  /**
   * Create a baseline snapshot
   */
  async createBaseline(description: string, gitCommit?: string): Promise<string> {
    const manifest = await this.load();
    const baselineId = crypto.randomUUID();

    const baseline: BaselineManifest = {
      id: baselineId,
      ...(gitCommit && { gitCommit }),
      timestamp: new Date().toISOString(),
      description,
      coverage: 0, // Will be updated after test execution
      testCount: manifest.tests.length,
    };

    manifest.baselines.push(baseline);
    await this.save(manifest);

    // Save baseline snapshot
    const baselinePath = path.join(this.stateDir, 'history', `baseline-${baselineId}.json`);
    await fs.writeFile(
      baselinePath,
      JSON.stringify(
        {
          ...baseline,
          files: manifest.files,
          tests: manifest.tests,
        },
        null,
        2
      )
    );

    return baselineId;
  }

  /**
   * Calculate hash of entire project structure
   */
  private calculateProjectHash(): string {
    const hash = crypto.createHash('sha256');
    hash.update(this.projectPath);
    hash.update(new Date().toISOString());
    return hash.digest('hex').substring(0, 16);
  }

  /**
   * Calculate hash of a single file
   */
  private async calculateFileHash(filePath: string): Promise<string> {
    try {
      const content = await fs.readFile(filePath);
      return crypto.createHash('sha256').update(content).digest('hex').substring(0, 16);
    } catch {
      return '';
    }
  }

  /**
   * Get state directory path
   */
  getStateDir(): string {
    return this.stateDir;
  }

  /**
   * Get tests directory path
   */
  getTestsDir(): string {
    return path.join(this.stateDir, 'tests');
  }

  /**
   * Get cache directory path
   */
  getCacheDir(): string {
    return path.join(this.stateDir, 'cache');
  }

  /**
   * Get reports directory path
   */
  getReportsDir(): string {
    return path.join(this.stateDir, 'reports');
  }
}
