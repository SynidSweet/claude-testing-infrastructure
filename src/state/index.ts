/**
 * State management exports for incremental testing
 */

export { ManifestManager } from './ManifestManager';
export { ChangeDetector } from './ChangeDetector';
export { IncrementalGenerator } from './IncrementalGenerator';
export { HistoryManager } from './HistoryManager';
export { TaskCheckpointManager } from './TaskCheckpointManager';

export type { TestManifest, FileManifest, TestFile, BaselineManifest } from './ManifestManager';

export type { FileChange, ChangeAnalysis } from './ChangeDetector';

export type { IncrementalUpdate, IncrementalOptions } from './IncrementalGenerator';

export type { HistoryEntry, HistoryStats, BaselineComparison } from './HistoryManager';

export type { TaskCheckpoint, CheckpointSummary } from './TaskCheckpointManager';
