/**
 * Task Checkpoint Manager
 * 
 * Manages checkpointing for long-running AI tasks to enable recovery from timeouts.
 * Integrates with existing state management system for persistent storage.
 */

import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { handleFileOperation } from '../utils/error-handling';
import { logger } from '../utils/logger';
import type { AITask, AITaskResult } from '../ai/AITaskPreparation';

export interface TaskCheckpoint {
  taskId: string;
  sourceFile: string;
  testFile: string;
  checkpointId: string;
  timestamp: string;
  phase: 'preparing' | 'generating' | 'processing' | 'finalizing';
  progress: number; // 0-100
  partialResult?: {
    generatedContent: string;
    tokensUsed: number;
    estimatedCost: number;
  };
  state: {
    outputBytes: number;
    elapsedTime: number;
    retryCount: number;
    modelUsed?: string;
    lastProgressMarker?: string;
  };
  metadata: {
    originalPrompt: string;
    promptHash: string;
    contextHash: string;
    estimatedTokens: number;
    timeoutThreshold: number;
  };
}

export interface CheckpointSummary {
  activeCheckpoints: number;
  totalCheckpoints: number;
  oldestCheckpoint?: Date;
  newestCheckpoint?: Date;
  recoverableCheckpoints: TaskCheckpoint[];
}

export class TaskCheckpointManager {
  private checkpointDir: string;
  private stateDir: string;

  constructor(projectPath: string) {
    this.stateDir = path.join(projectPath, '.claude-testing');
    this.checkpointDir = path.join(this.stateDir, 'checkpoints');
  }

  /**
   * Initialize checkpoint directory structure
   */
  async initialize(): Promise<void> {
    await fs.mkdir(this.checkpointDir, { recursive: true });
    await fs.mkdir(path.join(this.checkpointDir, 'active'), { recursive: true });
    await fs.mkdir(path.join(this.checkpointDir, 'completed'), { recursive: true });
    await fs.mkdir(path.join(this.checkpointDir, 'failed'), { recursive: true });

    // Create index file for tracking checkpoints
    const indexPath = path.join(this.checkpointDir, 'index.json');
    try {
      await fs.access(indexPath);
    } catch {
      await this.saveCheckpointIndex([]);
    }
  }

  /**
   * Create initial checkpoint for a task
   */
  async createCheckpoint(task: AITask, phase: TaskCheckpoint['phase'] = 'preparing'): Promise<string> {
    await this.initialize();

    const checkpointId = this.generateCheckpointId(task);
    const promptHash = crypto.createHash('sha256').update(task.prompt).digest('hex').substring(0, 16);
    const contextHash = crypto.createHash('sha256')
      .update(JSON.stringify(task.context))
      .digest('hex')
      .substring(0, 16);

    const checkpoint: TaskCheckpoint = {
      taskId: task.id,
      sourceFile: task.sourceFile,
      testFile: task.testFile,
      checkpointId,
      timestamp: new Date().toISOString(),
      phase,
      progress: 0,
      state: {
        outputBytes: 0,
        elapsedTime: 0,
        retryCount: 0,
      },
      metadata: {
        originalPrompt: task.prompt,
        promptHash,
        contextHash,
        estimatedTokens: task.estimatedTokens,
        timeoutThreshold: 900000, // 15 minutes default
      },
    };

    await this.saveCheckpoint(checkpoint);
    await this.addToIndex(checkpoint);

    logger.info(`Created checkpoint ${checkpointId} for task ${task.id}`);
    return checkpointId;
  }

  /**
   * Update checkpoint with progress and state
   */
  async updateCheckpoint(
    checkpointId: string,
    updates: {
      phase?: TaskCheckpoint['phase'];
      progress?: number;
      partialResult?: TaskCheckpoint['partialResult'];
      state?: Partial<TaskCheckpoint['state']>;
    }
  ): Promise<void> {
    try {
      const checkpoint = await this.loadCheckpoint(checkpointId);
      
      // Update fields
      if (updates.phase) checkpoint.phase = updates.phase;
      if (updates.progress !== undefined) checkpoint.progress = updates.progress;
      if (updates.partialResult) {
        checkpoint.partialResult = {
          ...checkpoint.partialResult,
          ...updates.partialResult,
        };
      }
      if (updates.state) {
        checkpoint.state = {
          ...checkpoint.state,
          ...updates.state,
        };
      }

      checkpoint.timestamp = new Date().toISOString();

      await this.saveCheckpoint(checkpoint);

      logger.debug(`Updated checkpoint ${checkpointId}: phase=${checkpoint.phase}, progress=${checkpoint.progress}%`);
    } catch (error) {
      logger.warn(`Failed to update checkpoint ${checkpointId}:`, error);
    }
  }

  /**
   * Check if a task can be resumed from checkpoint
   */
  async canResume(task: AITask): Promise<{ canResume: boolean; checkpointId?: string; lastProgress?: number }> {
    try {
      const checkpoints = await this.findCheckpointsForTask(task.id);
      
      if (checkpoints.length === 0) {
        return { canResume: false };
      }

      // Find the most recent recoverable checkpoint
      const sortedCheckpoints = checkpoints
        .filter(cp => cp.progress > 10 && cp.phase !== 'preparing') // Must have made significant progress
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      if (sortedCheckpoints.length === 0) {
        return { canResume: false };
      }

      const latestCheckpoint = sortedCheckpoints[0]!; // Safe because we checked length above
      
      // Verify the checkpoint is for the same prompt (task hasn't changed)
      const currentPromptHash = crypto.createHash('sha256').update(task.prompt).digest('hex').substring(0, 16);
      const currentContextHash = crypto.createHash('sha256')
        .update(JSON.stringify(task.context))
        .digest('hex')
        .substring(0, 16);

      if (latestCheckpoint.metadata.promptHash !== currentPromptHash ||
          latestCheckpoint.metadata.contextHash !== currentContextHash) {
        logger.info(`Checkpoint ${latestCheckpoint.checkpointId} outdated - task context changed`);
        return { canResume: false };
      }

      return {
        canResume: true,
        checkpointId: latestCheckpoint.checkpointId,
        lastProgress: latestCheckpoint.progress,
      };
    } catch (error) {
      logger.warn(`Failed to check resume capability for task ${task.id}:`, error);
      return { canResume: false };
    }
  }

  /**
   * Resume task from checkpoint
   */
  async resumeFromCheckpoint(checkpointId: string): Promise<{
    checkpoint: TaskCheckpoint;
    resumePrompt: string;
    estimatedRemainingTokens: number;
  }> {
    const checkpoint = await this.loadCheckpoint(checkpointId);
    
    // Create a resume prompt that includes partial progress
    const resumePrompt = this.createResumePrompt(checkpoint);
    
    // Estimate remaining tokens based on progress
    const progressRatio = checkpoint.progress / 100;
    const estimatedRemainingTokens = Math.max(
      checkpoint.metadata.estimatedTokens * (1 - progressRatio),
      checkpoint.metadata.estimatedTokens * 0.2 // Minimum 20% of original estimate
    );

    logger.info(`Resuming task ${checkpoint.taskId} from checkpoint ${checkpointId} at ${checkpoint.progress}% progress`);

    return {
      checkpoint,
      resumePrompt,
      estimatedRemainingTokens: Math.floor(estimatedRemainingTokens),
    };
  }

  /**
   * Mark checkpoint as completed successfully
   */
  async completeCheckpoint(checkpointId: string, result: AITaskResult): Promise<void> {
    try {
      const checkpoint = await this.loadCheckpoint(checkpointId);
      
      // Update final state
      checkpoint.phase = 'finalizing';
      checkpoint.progress = 100;
      checkpoint.partialResult = {
        generatedContent: result.generatedTests,
        tokensUsed: result.tokensUsed,
        estimatedCost: result.actualCost,
      };
      checkpoint.state.elapsedTime = result.duration;

      // Move to completed directory
      await this.moveCheckpoint(checkpointId, 'completed');
      await this.removeFromIndex(checkpointId);

      logger.info(`Completed checkpoint ${checkpointId} for task ${checkpoint.taskId}`);
    } catch (error) {
      logger.warn(`Failed to complete checkpoint ${checkpointId}:`, error);
    }
  }

  /**
   * Mark checkpoint as failed
   */
  async failCheckpoint(checkpointId: string, _error: string): Promise<void> {
    try {
      const checkpoint = await this.loadCheckpoint(checkpointId);
      
      // Update with failure information
      checkpoint.state = {
        ...checkpoint.state,
        retryCount: (checkpoint.state.retryCount || 0) + 1,
      };

      // Move to failed directory if retry count is high
      if ((checkpoint.state.retryCount || 0) >= 3) {
        await this.moveCheckpoint(checkpointId, 'failed');
        await this.removeFromIndex(checkpointId);
        logger.warn(`Failed checkpoint ${checkpointId} after ${checkpoint.state.retryCount} retries`);
      } else {
        // Keep in active for potential retry
        await this.saveCheckpoint(checkpoint);
        logger.info(`Checkpoint ${checkpointId} failed, retry count: ${checkpoint.state.retryCount}`);
      }
    } catch (err) {
      logger.warn(`Failed to mark checkpoint ${checkpointId} as failed:`, err);
    }
  }

  /**
   * Get checkpoint summary
   */
  async getCheckpointSummary(): Promise<CheckpointSummary> {
    try {
      const index = await this.loadCheckpointIndex();
      const activeCheckpoints = await Promise.all(
        index.map(entry => this.loadCheckpoint(entry.checkpointId).catch(() => null))
      );
      const validCheckpoints = activeCheckpoints.filter(cp => cp !== null) as TaskCheckpoint[];

      const timestamps = validCheckpoints.map(cp => new Date(cp.timestamp));
      
      const result: CheckpointSummary = {
        activeCheckpoints: validCheckpoints.filter(cp => cp.phase !== 'finalizing').length,
        totalCheckpoints: validCheckpoints.length,
        recoverableCheckpoints: validCheckpoints.filter(cp => cp.progress > 10 && cp.phase !== 'preparing'),
      };

      if (timestamps.length > 0) {
        result.oldestCheckpoint = new Date(Math.min(...timestamps.map(d => d.getTime())));
        result.newestCheckpoint = new Date(Math.max(...timestamps.map(d => d.getTime())));
      }

      return result;
    } catch (error) {
      logger.warn('Failed to get checkpoint summary:', error);
      return {
        activeCheckpoints: 0,
        totalCheckpoints: 0,
        recoverableCheckpoints: [],
      };
    }
  }

  /**
   * Clean up old checkpoints
   */
  async cleanupOldCheckpoints(maxAge: number = 24 * 60 * 60 * 1000): Promise<number> {
    try {
      const summary = await this.getCheckpointSummary();
      const cutoffTime = Date.now() - maxAge;
      let cleanedCount = 0;

      for (const checkpoint of summary.recoverableCheckpoints) {
        const checkpointTime = new Date(checkpoint.timestamp).getTime();
        if (checkpointTime < cutoffTime) {
          await this.removeCheckpoint(checkpoint.checkpointId);
          cleanedCount++;
        }
      }

      logger.info(`Cleaned up ${cleanedCount} old checkpoints`);
      return cleanedCount;
    } catch (error) {
      logger.warn('Failed to cleanup old checkpoints:', error);
      return 0;
    }
  }

  // Private helper methods

  private generateCheckpointId(task: AITask): string {
    const timestamp = Date.now().toString();
    const hash = crypto.createHash('sha256')
      .update(task.id + task.sourceFile + timestamp)
      .digest('hex')
      .substring(0, 12);
    return `cp_${hash}_${timestamp}`;
  }

  private async saveCheckpoint(checkpoint: TaskCheckpoint): Promise<void> {
    const filePath = path.join(this.checkpointDir, 'active', `${checkpoint.checkpointId}.json`);
    await handleFileOperation(
      async () => {
        const content = JSON.stringify(checkpoint, null, 2);
        await fs.writeFile(filePath, content);
      },
      'saving checkpoint',
      filePath
    );
  }

  private async loadCheckpoint(checkpointId: string): Promise<TaskCheckpoint> {
    // Try active directory first
    let filePath = path.join(this.checkpointDir, 'active', `${checkpointId}.json`);
    
    try {
      await fs.access(filePath);
    } catch {
      // Try completed directory
      filePath = path.join(this.checkpointDir, 'completed', `${checkpointId}.json`);
      try {
        await fs.access(filePath);
      } catch {
        // Try failed directory
        filePath = path.join(this.checkpointDir, 'failed', `${checkpointId}.json`);
      }
    }

    return await handleFileOperation(
      async () => {
        const content = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(content);
      },
      'loading checkpoint',
      filePath
    );
  }

  private async moveCheckpoint(checkpointId: string, targetDir: 'completed' | 'failed'): Promise<void> {
    const sourcePath = path.join(this.checkpointDir, 'active', `${checkpointId}.json`);
    const targetPath = path.join(this.checkpointDir, targetDir, `${checkpointId}.json`);
    
    try {
      await fs.rename(sourcePath, targetPath);
    } catch (error) {
      // If rename fails, try copy and delete
      try {
        await fs.copyFile(sourcePath, targetPath);
        await fs.unlink(sourcePath);
      } catch (err) {
        logger.warn(`Failed to move checkpoint ${checkpointId} to ${targetDir}:`, err);
      }
    }
  }

  private async removeCheckpoint(checkpointId: string): Promise<void> {
    const directories = ['active', 'completed', 'failed'];
    
    for (const dir of directories) {
      const filePath = path.join(this.checkpointDir, dir, `${checkpointId}.json`);
      try {
        await fs.unlink(filePath);
        break;
      } catch {
        // File doesn't exist in this directory, continue
      }
    }

    await this.removeFromIndex(checkpointId);
  }

  private async findCheckpointsForTask(taskId: string): Promise<TaskCheckpoint[]> {
    try {
      const index = await this.loadCheckpointIndex();
      const checkpoints: TaskCheckpoint[] = [];

      for (const entry of index) {
        if (entry.taskId === taskId) {
          try {
            const checkpoint = await this.loadCheckpoint(entry.checkpointId);
            checkpoints.push(checkpoint);
          } catch {
            // Checkpoint file might be missing, skip
          }
        }
      }

      return checkpoints;
    } catch {
      return [];
    }
  }

  private createResumePrompt(checkpoint: TaskCheckpoint): string {
    const progressInfo = checkpoint.partialResult ? 
      `\n\nPrevious partial output:\n${checkpoint.partialResult.generatedContent.substring(0, 500)}...` : '';
    
    return `${checkpoint.metadata.originalPrompt}

RESUME FROM CHECKPOINT:
- Previous progress: ${checkpoint.progress}%
- Last phase: ${checkpoint.phase}
- Resume from where the previous attempt left off
- Build upon any existing partial output${progressInfo}

Continue generating tests from where you left off.`;
  }

  private async saveCheckpointIndex(index: { checkpointId: string; taskId: string; timestamp: string }[]): Promise<void> {
    const indexPath = path.join(this.checkpointDir, 'index.json');
    await handleFileOperation(
      async () => {
        const content = JSON.stringify(index, null, 2);
        await fs.writeFile(indexPath, content);
      },
      'saving checkpoint index',
      indexPath
    );
  }

  private async loadCheckpointIndex(): Promise<{ checkpointId: string; taskId: string; timestamp: string }[]> {
    const indexPath = path.join(this.checkpointDir, 'index.json');
    
    try {
      const content = await fs.readFile(indexPath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return [];
    }
  }

  private async addToIndex(checkpoint: TaskCheckpoint): Promise<void> {
    const index = await this.loadCheckpointIndex();
    index.push({
      checkpointId: checkpoint.checkpointId,
      taskId: checkpoint.taskId,
      timestamp: checkpoint.timestamp,
    });
    await this.saveCheckpointIndex(index);
  }

  private async removeFromIndex(checkpointId: string): Promise<void> {
    const index = await this.loadCheckpointIndex();
    const filteredIndex = index.filter(entry => entry.checkpointId !== checkpointId);
    await this.saveCheckpointIndex(filteredIndex);
  }
}