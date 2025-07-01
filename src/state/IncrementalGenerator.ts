/**
 * Incremental test generation that updates only changed tests
 */

import path from 'path';
import { promises as fs } from 'fs';
import type { TestManifest } from './ManifestManager';
import { ManifestManager } from './ManifestManager';
import type { ChangeAnalysis, FileChange } from './ChangeDetector';
import { ChangeDetector } from './ChangeDetector';
// import { TestGenerator } from '../generators/TestGenerator';
// import { ProjectAnalyzer } from '../analyzers/ProjectAnalyzer';
import { logger } from '../utils/logger';

export interface IncrementalUpdate {
  changedFiles: string[];
  updatedTests: string[];
  deletedTests: string[];
  newTests: string[];
  skippedFiles: string[];
  totalTime: number;
  costEstimate: number;
}

export interface IncrementalOptions {
  forceRegenerate?: boolean;
  skipAI?: boolean;
  dryRun?: boolean;
  maxConcurrency?: number;
  costLimit?: number;
}

export class IncrementalGenerator {
  private manifestManager: ManifestManager;
  private changeDetector: ChangeDetector;

  constructor(private projectPath: string) {
    this.manifestManager = new ManifestManager(projectPath);
    this.changeDetector = new ChangeDetector(projectPath);
  }

  /**
   * Perform incremental test generation
   */
  async generateIncremental(options: IncrementalOptions = {}): Promise<IncrementalUpdate> {
    const startTime = Date.now();
    logger.info('Starting incremental test generation', { projectPath: this.projectPath });

    // Initialize state if needed
    await this.manifestManager.initialize();

    // Detect changes
    const changeAnalysis = await this.changeDetector.detectChangesSinceBaseline();
    logger.info('Change analysis completed', {
      changedFiles: changeAnalysis.changedFiles.length,
      impactScore: changeAnalysis.impactScore,
    });

    if (changeAnalysis.changedFiles.length === 0 && !options.forceRegenerate) {
      logger.info('No changes detected, skipping generation');
      return {
        changedFiles: [],
        updatedTests: [],
        deletedTests: [],
        newTests: [],
        skippedFiles: [],
        totalTime: Date.now() - startTime,
        costEstimate: 0,
      };
    }

    // Load current manifest
    const manifest = await this.manifestManager.load();

    // Analyze changes and determine update strategy
    const updateStrategy = this.determineUpdateStrategy(changeAnalysis, options);
    logger.info('Update strategy determined', updateStrategy);

    let result: IncrementalUpdate;

    if (updateStrategy.fullRegeneration) {
      result = await this.performFullRegeneration(manifest, options);
    } else {
      result = await this.performIncrementalUpdate(manifest, changeAnalysis, options);
    }

    // Update manifest with new state
    await this.updateManifest(manifest, result);

    result.totalTime = Date.now() - startTime;
    logger.info('Incremental generation completed', result);

    return result;
  }

  /**
   * Check if incremental update is beneficial
   */
  async shouldUseIncremental(): Promise<boolean> {
    try {
      const manifest = await this.manifestManager.load();
      const changes = await this.changeDetector.detectChangesSinceBaseline();

      // Use incremental if less than 30% of files changed
      const changeRatio = changes.changedFiles.length / Math.max(manifest.files.length, 1);
      return changeRatio < 0.3 && changes.changedFiles.length < 20;
    } catch {
      return false;
    }
  }

  /**
   * Get incremental generation statistics
   */
  async getIncrementalStats(): Promise<{
    filesTracked: number;
    testsGenerated: number;
    lastUpdate: string;
    changesSinceLastUpdate: number;
  }> {
    try {
      const manifest = await this.manifestManager.load();
      const changes = await this.changeDetector.detectChangesSinceBaseline();

      return {
        filesTracked: manifest.files.length,
        testsGenerated: manifest.tests.length,
        lastUpdate: manifest.lastGeneration,
        changesSinceLastUpdate: changes.changedFiles.length,
      };
    } catch {
      return {
        filesTracked: 0,
        testsGenerated: 0,
        lastUpdate: 'never',
        changesSinceLastUpdate: 0,
      };
    }
  }

  /**
   * Determine the best update strategy
   */
  private determineUpdateStrategy(changeAnalysis: ChangeAnalysis, options: IncrementalOptions) {
    return {
      fullRegeneration: changeAnalysis.requiresFullRegeneration || options.forceRegenerate || false,
      useAI: !options.skipAI && changeAnalysis.impactScore > 20,
      parallel: (options.maxConcurrency || 3) > 1,
      costBudget: options.costLimit || 5.0,
    };
  }

  /**
   * Perform full regeneration of all tests
   */
  private async performFullRegeneration(
    _manifest: TestManifest,
    _options: IncrementalOptions
  ): Promise<IncrementalUpdate> {
    logger.info('Performing full test regeneration');

    // This would call the full test generation pipeline
    // For now, return a mock result
    return {
      changedFiles: [],
      updatedTests: [],
      deletedTests: [],
      newTests: [],
      skippedFiles: [],
      totalTime: 0,
      costEstimate: 0,
    };
  }

  /**
   * Perform incremental update of only changed files
   */
  private async performIncrementalUpdate(
    manifest: TestManifest,
    changeAnalysis: ChangeAnalysis,
    options: IncrementalOptions
  ): Promise<IncrementalUpdate> {
    logger.info('Performing incremental test update', {
      changedFiles: changeAnalysis.changedFiles.length,
    });

    const result: IncrementalUpdate = {
      changedFiles: [],
      updatedTests: [],
      deletedTests: [],
      newTests: [],
      skippedFiles: [],
      totalTime: 0,
      costEstimate: 0,
    };

    for (const change of changeAnalysis.changedFiles) {
      try {
        await this.processFileChange(change, manifest, result, options);
      } catch (error) {
        logger.error('Failed to process file change', {
          file: change.path,
          error: error instanceof Error ? error.message : String(error),
        });
        result.skippedFiles.push(change.path);
      }
    }

    return result;
  }

  /**
   * Process a single file change
   */
  private async processFileChange(
    change: FileChange,
    manifest: TestManifest,
    result: IncrementalUpdate,
    options: IncrementalOptions
  ): Promise<void> {
    const fullPath = path.join(this.projectPath, change.path);

    switch (change.type) {
      case 'added':
        await this.handleAddedFile(fullPath, change.path, result, options);
        break;

      case 'modified':
        await this.handleModifiedFile(fullPath, change.path, manifest, result, options);
        break;

      case 'deleted':
        await this.handleDeletedFile(change.path, manifest, result);
        break;

      case 'renamed':
        await this.handleRenamedFile(change.oldPath!, change.path, manifest, result, options);
        break;
    }

    result.changedFiles.push(change.path);
  }

  /**
   * Handle newly added file
   */
  private async handleAddedFile(
    fullPath: string,
    relativePath: string,
    result: IncrementalUpdate,
    options: IncrementalOptions
  ): Promise<void> {
    if (options.dryRun) {
      logger.info('DRY RUN: Would generate tests for new file', { file: relativePath });
      return;
    }

    // Generate tests for new file
    const testFiles = await this.generateTestsForFile(fullPath, relativePath);
    result.newTests.push(...testFiles);
    result.costEstimate += this.estimateGenerationCost(relativePath, 'new');
  }

  /**
   * Handle modified file
   */
  private async handleModifiedFile(
    fullPath: string,
    relativePath: string,
    manifest: TestManifest,
    result: IncrementalUpdate,
    options: IncrementalOptions
  ): Promise<void> {
    if (options.dryRun) {
      logger.info('DRY RUN: Would update tests for modified file', { file: relativePath });
      return;
    }

    // Check if we need to update existing tests
    const existingTests = this.findTestsForFile(relativePath, manifest);

    if (existingTests.length > 0) {
      // Update existing tests
      const updatedTests = await this.updateTestsForFile(fullPath, relativePath, existingTests);
      result.updatedTests.push(...updatedTests);
      result.costEstimate += this.estimateGenerationCost(relativePath, 'update');
    } else {
      // Generate new tests
      const newTests = await this.generateTestsForFile(fullPath, relativePath);
      result.newTests.push(...newTests);
      result.costEstimate += this.estimateGenerationCost(relativePath, 'new');
    }
  }

  /**
   * Handle deleted file
   */
  private async handleDeletedFile(
    relativePath: string,
    manifest: TestManifest,
    result: IncrementalUpdate
  ): Promise<void> {
    // Remove tests for deleted file
    const testsToDelete = this.findTestsForFile(relativePath, manifest);

    for (const testFile of testsToDelete) {
      const testPath = path.join(this.manifestManager.getTestsDir(), testFile);
      try {
        await fs.unlink(testPath);
        result.deletedTests.push(testFile);
        logger.info('Deleted test file for removed source', { testFile, sourceFile: relativePath });
      } catch (error) {
        logger.warn('Failed to delete test file', { testFile, error });
      }
    }
  }

  /**
   * Handle renamed file
   */
  private async handleRenamedFile(
    oldPath: string,
    newPath: string,
    manifest: TestManifest,
    result: IncrementalUpdate,
    options: IncrementalOptions
  ): Promise<void> {
    // Handle as delete + add for simplicity
    await this.handleDeletedFile(oldPath, manifest, result);

    const fullNewPath = path.join(this.projectPath, newPath);
    await this.handleAddedFile(fullNewPath, newPath, result, options);
  }

  /**
   * Generate tests for a specific file
   */
  private async generateTestsForFile(_fullPath: string, relativePath: string): Promise<string[]> {
    // This would integrate with the existing TestGenerator
    // For now, return mock data
    logger.info('Generating tests for file', { file: relativePath });
    return [`${relativePath}.test.ts`];
  }

  /**
   * Update existing tests for a file
   */
  private async updateTestsForFile(
    _fullPath: string,
    relativePath: string,
    existingTests: string[]
  ): Promise<string[]> {
    // This would update existing test files
    logger.info('Updating tests for file', { file: relativePath, tests: existingTests });
    return existingTests;
  }

  /**
   * Find test files associated with a source file
   */
  private findTestsForFile(relativePath: string, manifest: TestManifest): string[] {
    const fileManifest = manifest.files.find((f) => f.relativePath === relativePath);
    return fileManifest?.testFiles || [];
  }

  /**
   * Estimate cost of generating tests for a file
   */
  private estimateGenerationCost(relativePath: string, type: 'new' | 'update'): number {
    // Simple cost estimation based on file type and operation
    const baselineCost = type === 'new' ? 0.25 : 0.1;

    if (relativePath.includes('.test.') || relativePath.includes('.spec.')) {
      return 0; // Don't generate tests for test files
    }

    if (relativePath.endsWith('.ts') || relativePath.endsWith('.tsx')) {
      return baselineCost * 1.2; // TypeScript files are slightly more complex
    }

    return baselineCost;
  }

  /**
   * Update manifest with generation results
   */
  private async updateManifest(manifest: TestManifest, _result: IncrementalUpdate): Promise<void> {
    // Update generation timestamp
    manifest.lastGeneration = new Date().toISOString();

    // This would update file manifests, test records, etc.
    await this.manifestManager.save(manifest);
  }
}
