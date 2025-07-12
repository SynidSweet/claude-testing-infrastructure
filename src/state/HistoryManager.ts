/**
 * Manages test history and baseline tracking for incremental testing
 */

import { promises as fs } from 'fs';
import path from 'path';
import { ManifestManager, type BaselineManifest, type TestManifest } from './ManifestManager';
import { ChangeDetector } from './ChangeDetector';
import { logger } from '../utils/logger';

export interface HistoryEntry {
  id: string;
  timestamp: string;
  gitCommit?: string;
  operation: 'generation' | 'update' | 'baseline';
  summary: {
    filesChanged: number;
    testsGenerated: number;
    testsUpdated: number;
    testsDeleted: number;
    costIncurred: number;
  };
  details: {
    changedFiles: string[];
    generatedTests: string[];
    errors?: string[];
  };
}

export interface HistoryStats {
  totalGenerations: number;
  totalCost: number;
  averageCost: number;
  lastGeneration: string;
  mostActiveFiles: Array<{ path: string; updates: number }>;
  errorRate: number;
}

export interface BaselineComparison {
  baselineId: string;
  baselineDate: string;
  currentState: {
    files: number;
    tests: number;
    coverage: number;
  };
  changes: {
    filesAdded: number;
    filesModified: number;
    filesDeleted: number;
    testsAdded: number;
    testsUpdated: number;
    testsDeleted: number;
  };
  recommendations: string[];
}

export class HistoryManager {
  private manifestManager: ManifestManager;
  private changeDetector: ChangeDetector;
  private historyDir: string;

  constructor(projectPath: string) {
    this.manifestManager = new ManifestManager(projectPath);
    this.changeDetector = new ChangeDetector(projectPath);
    this.historyDir = path.join(this.manifestManager.getStateDir(), 'history');
  }

  /**
   * Initialize history tracking
   */
  async initialize(): Promise<void> {
    await fs.mkdir(this.historyDir, { recursive: true });

    // Create history index if it doesn't exist
    const indexPath = path.join(this.historyDir, 'index.json');
    try {
      await fs.access(indexPath);
    } catch {
      await fs.writeFile(indexPath, JSON.stringify({ entries: [] }, null, 2));
    }
  }

  /**
   * Record a new history entry
   */
  async recordEntry(entry: Omit<HistoryEntry, 'id' | 'timestamp'>): Promise<string> {
    await this.initialize();

    const historyEntry: HistoryEntry = {
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      ...entry,
    };

    // Add git commit if available
    if (!historyEntry.gitCommit) {
      const commit = await this.changeDetector.getCurrentCommit();
      if (commit) {
        historyEntry.gitCommit = commit;
      }
    }

    // Save detailed entry
    const entryPath = path.join(this.historyDir, `${historyEntry.id}.json`);
    await fs.writeFile(entryPath, JSON.stringify(historyEntry, null, 2));

    // Update index
    await this.updateIndex(historyEntry);

    logger.info('History entry recorded', {
      id: historyEntry.id,
      operation: historyEntry.operation,
    });

    return historyEntry.id;
  }

  /**
   * Get history statistics
   */
  async getStats(): Promise<HistoryStats> {
    const index = await this.loadIndex();

    if (index.entries.length === 0) {
      return {
        totalGenerations: 0,
        totalCost: 0,
        averageCost: 0,
        lastGeneration: 'never',
        mostActiveFiles: [],
        errorRate: 0,
      };
    }

    const totalCost = index.entries.reduce(
      (sum, entry) => sum + (entry.summary?.costIncurred || 0),
      0
    );

    const entriesWithErrors = index.entries.filter(
      (entry) => entry.details?.errors && entry.details.errors.length > 0
    );

    // Count file update frequency
    const fileUpdateCounts = new Map<string, number>();
    for (const entry of index.entries) {
      for (const file of entry.details?.changedFiles ?? []) {
        fileUpdateCounts.set(file, (fileUpdateCounts.get(file) ?? 0) + 1);
      }
    }

    const mostActiveFiles = Array.from(fileUpdateCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([path, updates]) => ({ path, updates }));

    return {
      totalGenerations: index.entries.length,
      totalCost,
      averageCost: totalCost / index.entries.length,
      lastGeneration: index.entries[index.entries.length - 1]?.timestamp ?? 'never',
      mostActiveFiles,
      errorRate: entriesWithErrors.length / index.entries.length,
    };
  }

  /**
   * Create a new baseline
   */
  async createBaseline(description: string): Promise<string> {
    const gitCommit = await this.changeDetector.getCurrentCommit();
    const baselineId = await this.manifestManager.createBaseline(
      description,
      gitCommit ?? undefined
    );

    // Record in history
    await this.recordEntry({
      operation: 'baseline',
      summary: {
        filesChanged: 0,
        testsGenerated: 0,
        testsUpdated: 0,
        testsDeleted: 0,
        costIncurred: 0,
      },
      details: {
        changedFiles: [],
        generatedTests: [],
      },
    });

    logger.info('Baseline created', { id: baselineId, description });
    return baselineId;
  }

  /**
   * Compare current state with a baseline
   */
  async compareWithBaseline(baselineId?: string): Promise<BaselineComparison> {
    const manifest = await this.manifestManager.load();

    // Use latest baseline if none specified
    let targetBaseline: BaselineManifest;
    if (baselineId) {
      const found = manifest.baselines.find((b) => b.id === baselineId);
      if (!found) {
        throw new Error(`Baseline ${baselineId} not found`);
      }
      targetBaseline = found;
    } else {
      const latest = manifest.baselines[manifest.baselines.length - 1];
      if (!latest) {
        throw new Error('No baselines found');
      }
      targetBaseline = latest;
    }

    // Load baseline snapshot
    const baselineSnapshot = await this.loadBaselineSnapshot(targetBaseline.id);

    const comparison: BaselineComparison = {
      baselineId: targetBaseline.id,
      baselineDate: targetBaseline.timestamp,
      currentState: {
        files: manifest.files.length,
        tests: manifest.tests.length,
        coverage: 0, // Would be calculated from coverage data
      },
      changes: {
        filesAdded: Math.max(0, manifest.files.length - baselineSnapshot.files.length),
        filesModified: 0, // Would be calculated by comparing hashes
        filesDeleted: Math.max(0, baselineSnapshot.files.length - manifest.files.length),
        testsAdded: Math.max(0, manifest.tests.length - baselineSnapshot.tests.length),
        testsUpdated: 0, // Would be calculated by comparing test hashes
        testsDeleted: Math.max(0, baselineSnapshot.tests.length - manifest.tests.length),
      },
      recommendations: [],
    };

    // Generate recommendations
    comparison.recommendations = this.generateRecommendations(comparison);

    return comparison;
  }

  /**
   * Get recent history entries
   */
  async getRecentEntries(limit: number = 10): Promise<HistoryEntry[]> {
    const index = await this.loadIndex();
    const recentEntries = index.entries
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);

    const detailedEntries: HistoryEntry[] = [];
    for (const entry of recentEntries) {
      try {
        const detailed = await this.loadEntry(entry.id);
        detailedEntries.push(detailed);
      } catch (error) {
        logger.warn('Failed to load history entry', { id: entry.id, error });
      }
    }

    return detailedEntries;
  }

  /**
   * Clean up old history entries
   */
  async cleanup(retentionDays: number = 30): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const index = await this.loadIndex();
    const entriesToKeep = index.entries.filter((entry) => new Date(entry.timestamp) > cutoffDate);

    const entriesToDelete = index.entries.filter(
      (entry) => new Date(entry.timestamp) <= cutoffDate
    );

    // Delete old entry files
    for (const entry of entriesToDelete) {
      try {
        const entryPath = path.join(this.historyDir, `${entry.id}.json`);
        await fs.unlink(entryPath);
      } catch (error) {
        logger.warn('Failed to delete old history entry', { id: entry.id, error });
      }
    }

    // Update index
    await fs.writeFile(
      path.join(this.historyDir, 'index.json'),
      JSON.stringify({ entries: entriesToKeep }, null, 2)
    );

    logger.info('History cleanup completed', {
      deleted: entriesToDelete.length,
      retained: entriesToKeep.length,
    });
  }

  /**
   * Load history index
   */
  private async loadIndex(): Promise<{
    entries: Array<Pick<HistoryEntry, 'id' | 'timestamp' | 'operation' | 'summary' | 'details'>>;
  }> {
    try {
      const indexPath = path.join(this.historyDir, 'index.json');
      const content = await fs.readFile(indexPath, 'utf-8');
      return JSON.parse(content) as {
        entries: Array<
          Pick<HistoryEntry, 'id' | 'timestamp' | 'operation' | 'summary' | 'details'>
        >;
      };
    } catch {
      return { entries: [] };
    }
  }

  /**
   * Update history index
   */
  private async updateIndex(entry: HistoryEntry): Promise<void> {
    const index = await this.loadIndex();

    // Add summary entry to index
    index.entries.push({
      id: entry.id,
      timestamp: entry.timestamp,
      operation: entry.operation,
      summary: entry.summary,
      details: entry.details,
    });

    // Keep only last 100 entries in index
    if (index.entries.length > 100) {
      index.entries = index.entries.slice(-100);
    }

    const indexPath = path.join(this.historyDir, 'index.json');
    await fs.writeFile(indexPath, JSON.stringify(index, null, 2));
  }

  /**
   * Load detailed history entry
   */
  private async loadEntry(id: string): Promise<HistoryEntry> {
    const entryPath = path.join(this.historyDir, `${id}.json`);
    const content = await fs.readFile(entryPath, 'utf-8');
    return JSON.parse(content) as HistoryEntry;
  }

  /**
   * Load baseline snapshot
   */
  private async loadBaselineSnapshot(baselineId: string): Promise<TestManifest> {
    const snapshotPath = path.join(this.historyDir, `baseline-${baselineId}.json`);
    const content = await fs.readFile(snapshotPath, 'utf-8');
    return JSON.parse(content) as TestManifest;
  }

  /**
   * Generate recommendations based on comparison
   */
  private generateRecommendations(comparison: BaselineComparison): string[] {
    const recommendations: string[] = [];

    if (comparison.changes.filesAdded > 10) {
      recommendations.push('Consider creating a new baseline - many files have been added');
    }

    if (comparison.changes.testsDeleted > comparison.changes.testsAdded) {
      recommendations.push('Test coverage may have decreased - review deleted tests');
    }

    if (comparison.changes.filesModified > 20) {
      recommendations.push('High activity detected - consider running full regeneration');
    }

    return recommendations;
  }

  /**
   * Generate unique ID for history entries
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  }
}
