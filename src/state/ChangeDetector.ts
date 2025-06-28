/**
 * Git-based change detection for incremental test generation
 */

import { execSync } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';

export interface FileChange {
  type: 'added' | 'modified' | 'deleted' | 'renamed';
  path: string;
  oldPath?: string;
  severity: 'low' | 'medium' | 'high';
  affectedTests: string[];
}

export interface ChangeAnalysis {
  changedFiles: FileChange[];
  affectedTestFiles: string[];
  impactScore: number;
  requiresFullRegeneration: boolean;
  changesSinceBaseline: FileChange[];
}

export class ChangeDetector {
  constructor(private projectPath: string) {}

  /**
   * Detect changes since last baseline using Git
   */
  async detectChangesSinceBaseline(baselineCommit?: string): Promise<ChangeAnalysis> {
    const gitRoot = await this.findGitRoot();
    if (!gitRoot) {
      throw new Error('Project is not in a Git repository');
    }

    // Default to comparing with last commit if no baseline specified
    const compareWith = baselineCommit || 'HEAD~1';
    
    try {
      // Get list of changed files
      const diffOutput = execSync(
        `git diff --name-status ${compareWith}..HEAD`,
        { cwd: gitRoot, encoding: 'utf-8' }
      );

      const changedFiles = this.parseDiffOutput(diffOutput);
      const affectedTestFiles = await this.findAffectedTestFiles(changedFiles);
      const impactScore = this.calculateImpactScore(changedFiles);
      const requiresFullRegeneration = this.shouldRegenerateAll(changedFiles);

      return {
        changedFiles,
        affectedTestFiles,
        impactScore,
        requiresFullRegeneration,
        changesSinceBaseline: changedFiles
      };
    } catch (error) {
      // If git diff fails, fall back to filesystem-based detection
      return this.detectChangesFromFilesystem();
    }
  }

  /**
   * Detect changes by comparing file timestamps and hashes
   */
  async detectChangesFromFilesystem(): Promise<ChangeAnalysis> {
    // Implementation for non-git or fallback detection
    const changedFiles: FileChange[] = [];
    
    // This would compare against manifest file timestamps/hashes
    // For now, return empty analysis
    return {
      changedFiles,
      affectedTestFiles: [],
      impactScore: 0,
      requiresFullRegeneration: false,
      changesSinceBaseline: []
    };
  }

  /**
   * Get list of files that changed between two commits
   */
  async getChangedFilesBetweenCommits(fromCommit: string, toCommit: string): Promise<FileChange[]> {
    const gitRoot = await this.findGitRoot();
    if (!gitRoot) {
      return [];
    }

    try {
      const diffOutput = execSync(
        `git diff --name-status ${fromCommit}..${toCommit}`,
        { cwd: gitRoot, encoding: 'utf-8' }
      );

      return this.parseDiffOutput(diffOutput);
    } catch {
      return [];
    }
  }

  /**
   * Check if project is in a Git repository
   */
  async isGitRepository(): Promise<boolean> {
    const gitRoot = await this.findGitRoot();
    return gitRoot !== null;
  }

  /**
   * Get current Git commit hash
   */
  async getCurrentCommit(): Promise<string | null> {
    const gitRoot = await this.findGitRoot();
    if (!gitRoot) {
      return null;
    }

    try {
      const commit = execSync('git rev-parse HEAD', { 
        cwd: gitRoot, 
        encoding: 'utf-8' 
      }).trim();
      return commit;
    } catch {
      return null;
    }
  }

  /**
   * Get list of uncommitted changes
   */
  async getUncommittedChanges(): Promise<FileChange[]> {
    const gitRoot = await this.findGitRoot();
    if (!gitRoot) {
      return [];
    }

    try {
      // Get staged changes
      const stagedOutput = execSync(
        'git diff --cached --name-status',
        { cwd: gitRoot, encoding: 'utf-8' }
      );

      // Get unstaged changes
      const unstagedOutput = execSync(
        'git diff --name-status',
        { cwd: gitRoot, encoding: 'utf-8' }
      );

      const stagedChanges = this.parseDiffOutput(stagedOutput);
      const unstagedChanges = this.parseDiffOutput(unstagedOutput);

      // Combine and deduplicate
      const allChanges = [...stagedChanges, ...unstagedChanges];
      const uniqueChanges = allChanges.filter((change, index, arr) => 
        arr.findIndex(c => c.path === change.path) === index
      );

      return uniqueChanges;
    } catch {
      return [];
    }
  }

  /**
   * Parse git diff output into FileChange objects
   */
  private parseDiffOutput(diffOutput: string): FileChange[] {
    const lines = diffOutput.trim().split('\n').filter(line => line.length > 0);
    const changes: FileChange[] = [];

    for (const line of lines) {
      const [status, ...pathParts] = line.split('\t');
      const filePath = pathParts.join('\t');

      // Skip files outside our project path
      if (!this.isRelevantFile(filePath)) {
        continue;
      }

      let type: FileChange['type'];
      let oldPath: string | undefined;

      switch (status?.[0]) {
        case 'A':
          type = 'added';
          break;
        case 'M':
          type = 'modified';
          break;
        case 'D':
          type = 'deleted';
          break;
        case 'R':
          type = 'renamed';
          oldPath = pathParts[0];
          break;
        default:
          type = 'modified';
      }

      const severity = this.calculateChangeSeverity(filePath, type);

      changes.push({
        type,
        path: filePath,
        ...(oldPath && { oldPath }),
        severity,
        affectedTests: [] // Will be populated by findAffectedTestFiles
      });
    }

    return changes;
  }

  /**
   * Find Git repository root
   */
  private async findGitRoot(): Promise<string | null> {
    let currentDir = this.projectPath;

    while (currentDir !== path.dirname(currentDir)) {
      try {
        await fs.access(path.join(currentDir, '.git'));
        return currentDir;
      } catch {
        currentDir = path.dirname(currentDir);
      }
    }

    return null;
  }

  /**
   * Check if file is relevant for testing
   */
  private isRelevantFile(filePath: string): boolean {
    // Skip test files themselves
    if (filePath.includes('.test.') || filePath.includes('.spec.')) {
      return false;
    }

    // Skip common non-source files
    const skipPatterns = [
      /\.md$/,
      /\.txt$/,
      /\.json$/,
      /package-lock\.json/,
      /yarn\.lock/,
      /\.git/,
      /node_modules/,
      /\.vscode/,
      /\.idea/
    ];

    return !skipPatterns.some(pattern => pattern.test(filePath));
  }

  /**
   * Calculate severity of a file change
   */
  private calculateChangeSeverity(filePath: string, changeType: FileChange['type']): 'low' | 'medium' | 'high' {
    // Deletions are high severity
    if (changeType === 'deleted') {
      return 'high';
    }

    // Core application files are high severity
    if (filePath.includes('/src/') || filePath.includes('/lib/')) {
      return 'high';
    }

    // Configuration files are medium severity
    if (filePath.includes('config') || filePath.endsWith('.config.js') || filePath.endsWith('.config.ts')) {
      return 'medium';
    }

    // Everything else is low severity
    return 'low';
  }

  /**
   * Find test files that might be affected by changes
   */
  private async findAffectedTestFiles(changes: FileChange[]): Promise<string[]> {
    const affectedTests: Set<string> = new Set();

    for (const change of changes) {
      // Simple heuristic: look for test files with similar names
      const baseName = path.basename(change.path, path.extname(change.path));
      
      // Common test file patterns
      const testPatterns = [
        `${baseName}.test.js`,
        `${baseName}.test.ts`,
        `${baseName}.spec.js`,
        `${baseName}.spec.ts`,
        `${baseName}.test.jsx`,
        `${baseName}.test.tsx`,
        `${baseName}.spec.jsx`,
        `${baseName}.spec.tsx`
      ];

      for (const pattern of testPatterns) {
        // This is a simplified check - in reality we'd search the filesystem
        if (await this.fileExists(path.join(path.dirname(change.path), pattern))) {
          affectedTests.add(pattern);
        }
      }
    }

    return Array.from(affectedTests);
  }

  /**
   * Calculate impact score based on changes
   */
  private calculateImpactScore(changes: FileChange[]): number {
    let score = 0;

    for (const change of changes) {
      switch (change.severity) {
        case 'high':
          score += 10;
          break;
        case 'medium':
          score += 5;
          break;
        case 'low':
          score += 1;
          break;
      }

      // Bonus for deletions
      if (change.type === 'deleted') {
        score += 5;
      }
    }

    return Math.min(score, 100); // Cap at 100
  }

  /**
   * Determine if full regeneration is needed
   */
  private shouldRegenerateAll(changes: FileChange[]): boolean {
    // Regenerate all if too many high-severity changes
    const highSeverityChanges = changes.filter(c => c.severity === 'high').length;
    
    return highSeverityChanges > 5 || changes.length > 20;
  }

  /**
   * Check if file exists
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}