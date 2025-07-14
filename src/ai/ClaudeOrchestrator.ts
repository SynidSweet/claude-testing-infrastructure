/**
 * Claude Orchestrator
 *
 * Coordinates AI test generation services:
 * - Delegates process management to ProcessPoolManager
 * - Delegates task scheduling to TaskQueueManager
 * - Delegates result aggregation to ResultAggregator
 * - Handles authentication and configuration
 */

import { EventEmitter } from 'events';
import type { AITaskBatch } from './AITaskPreparation';
import type { ChunkedAITask } from './ChunkedAITaskPreparation';
import type { ProcessResult, OrchestratorStats } from './services/ResultAggregator';
import { ServiceFactory, type OrchestratorServices } from './services/ServiceFactory';
import type {
  ReliabilityStatus,
  ProcessMonitoringStatus,
  RetryStatistics,
} from './services/StatisticsService';
import { validateModelConfiguration } from '../utils/model-mapping';
import { type AIProgressUpdate, type ClaudeAuthResult } from '../types/ai-error-types';
import { logger } from '../utils/logger';
import { type ProcessResourceUsage } from '../utils/ProcessMonitor';
import { TaskCheckpointManager } from '../state/TaskCheckpointManager';
import { type TestableTimer } from '../types/timer-types';
import { createAutoTimer } from '../utils/TimerFactory';

export interface ClaudeOrchestratorConfig {
  maxConcurrent?: number;
  model?: string;
  fallbackModel?: string;
  retryAttempts?: number;
  retryDelay?: number;
  timeout?: number;
  outputFormat?: 'json' | 'text';
  verbose?: boolean;
  gracefulDegradation?: boolean;
  exponentialBackoff?: boolean;
  circuitBreakerEnabled?: boolean;
  maxRetryDelay?: number;
  checkpointingEnabled?: boolean;
  projectPath?: string;
  timerService?: TestableTimer;
}

export class ClaudeOrchestrator extends EventEmitter {
  private services: OrchestratorServices;
  private isRunning = false;
  private isGracefullyDegraded = false;
  private checkpointManager?: TaskCheckpointManager;
  private timerService: TestableTimer;

  constructor(private config: ClaudeOrchestratorConfig = {}) {
    super();
    this.config = {
      maxConcurrent: 3,
      model: 'opus', // Use alias for latest model with Max subscription
      fallbackModel: 'sonnet', // Automatic fallback when usage limits reached
      retryAttempts: 3,
      retryDelay: 1000,
      timeout: 900000, // 15 minutes (increased for complex analysis)
      outputFormat: 'json',
      verbose: false,
      gracefulDegradation: true,
      exponentialBackoff: true,
      circuitBreakerEnabled: true,
      maxRetryDelay: 30000, // 30 seconds max retry delay
      checkpointingEnabled: true,
      ...config,
    };

    // Initialize timer service (use provided or create auto-timer)
    this.timerService = this.config.timerService ?? createAutoTimer();

    // Initialize checkpoint manager if enabled and project path provided
    if (this.config.checkpointingEnabled && this.config.projectPath) {
      this.checkpointManager = new TaskCheckpointManager(this.config.projectPath);
    }

    // Validate and normalize model configuration
    this.validateAndNormalizeModelConfig();

    // Initialize all services using factory
    this.services = ServiceFactory.createServices(
      this.config,
      this.timerService,
      this.checkpointManager
    );

    // Set up event forwarding
    this.setupEventForwarding();
  }

  /**
   * Validate and normalize model configuration
   */
  private validateAndNormalizeModelConfig(): void {
    if (this.config.model) {
      const validation = validateModelConfiguration(this.config.model);
      if (!validation.valid) {
        logger.warn(`ClaudeOrchestrator: ${validation.error}. ${validation.suggestion}`);
        this.config.model = 'claude-3-5-sonnet-20241022'; // Fallback to default
      } else {
        this.config.model = validation.resolvedName!;
      }
    }

    if (this.config.fallbackModel) {
      const validation = validateModelConfiguration(this.config.fallbackModel);
      if (!validation.valid) {
        logger.warn(
          `ClaudeOrchestrator fallback model: ${validation.error}. ${validation.suggestion}`
        );
        this.config.fallbackModel = 'claude-3-haiku-20240307'; // Fallback to cheapest
      } else {
        this.config.fallbackModel = validation.resolvedName!;
      }
    }
  }

  /**
   * Set up event forwarding from services
   */
  private setupEventForwarding(): void {
    // Forward process pool events to orchestrator events
    this.services.processPoolManager.on('process-started', (event) => {
      this.emit('process-started', event);
    });
    this.services.processPoolManager.on('process-completed', (event) => {
      this.emit('process-completed', event);
    });
    this.services.processPoolManager.on('process-failed', (event) => {
      this.emit('process-failed', event);
    });
    this.services.processPoolManager.on('process-timeout', (event) => {
      this.emit('process-timeout', event);
    });
    this.services.processPoolManager.on('process-killed', (event) => {
      this.emit('process-killed', event);
    });

    // Forward task queue events to orchestrator events
    this.services.taskQueueManager.on('batch:start', (event) => {
      this.emit('batch:start', event);
    });
    this.services.taskQueueManager.on('batch:complete', (event) => {
      this.emit('batch:complete', event);
    });
    this.services.taskQueueManager.on('task:start', (event) => {
      this.emit('task:start', event);
    });
    this.services.taskQueueManager.on('task:complete', (event) => {
      this.emit('task:complete', event);
    });
    this.services.taskQueueManager.on('task:failed', (event) => {
      this.emit('task:failed', event);
    });

    // Forward process executor events
    this.services.processExecutor.on('progress', (update) => {
      this.emit('progress', update);
    });
    this.services.processExecutor.on('timeout:warning', (warning) => {
      this.emit('timeout:warning', warning);
    });
    this.services.processExecutor.on('error:detected', (error) => {
      this.emit('error:detected', error);
    });

    // Forward task execution service events
    this.services.taskExecutionService.on('task:start', (event) => {
      this.emit('task:start', event);
    });
    this.services.taskExecutionService.on('task:complete', (event) => {
      this.emit('task:complete', event);
    });
    this.services.taskExecutionService.on('task:failed', (event) => {
      this.emit('task:failed', event);
    });
    this.services.taskExecutionService.on('task:retry', (event) => {
      this.emit('task:retry', event);
    });
    this.services.taskExecutionService.on('progress', (update) => {
      this.emit('progress', update);
    });
  }

  /**
   * Validate Claude CLI authentication
   */
  validateClaudeAuth(): ClaudeAuthResult {
    const authResult = this.services.authenticationService.validateClaudeAuth();
    if (authResult.authenticated) {
      this.isGracefullyDegraded = false;
      this.services.taskExecutionService.setGracefullyDegraded(false);
    }
    return authResult;
  }

  /**
   * Process a batch of AI tasks
   */
  async processBatch(batch: AITaskBatch): Promise<ProcessResult[]> {
    if (this.isRunning) {
      throw new Error('Orchestrator is already running');
    }

    // Emit progress for authentication check
    this.emit('progress', {
      taskId: 'auth-check',
      phase: 'authenticating',
      progress: 0,
      message: 'Validating Claude CLI authentication...',
    } as AIProgressUpdate);

    // Validate Claude CLI authentication before starting
    const authStatus = this.validateClaudeAuth();
    if (!authStatus.authenticated) {
      if (authStatus.canDegrade) {
        // Enable graceful degradation mode
        this.isGracefullyDegraded = true;
        this.services.taskExecutionService.setGracefullyDegraded(true);
        logger.warn('Claude CLI not available - entering graceful degradation mode');
        this.emit('degradation:enabled', {
          reason: authStatus.error,
          message:
            'AI test generation will return placeholder tests. Install Claude Code for full functionality.',
        });
      } else {
        throw authStatus.error;
      }
    }

    this.emit('progress', {
      taskId: 'auth-check',
      phase: 'authenticating',
      progress: 100,
      message: 'Authentication validated successfully',
    } as AIProgressUpdate);

    this.isRunning = true;
    this.services.resultAggregator.clear();
    this.services.resultAggregator.initializeStats(batch.tasks.length);

    try {
      // Use TaskQueueManager to process the batch
      await this.services.taskQueueManager.processBatch(
        batch,
        this.services.taskExecutionService.processTask.bind(this.services.taskExecutionService), // Task processor function
        (update) => this.emit('progress', update) // Progress callback
      );

      // Handle chunked results merging
      if (this.hasChunkedTasks(batch)) {
        await this.services.resultAggregator.mergeChunkedResults(batch.tasks as ChunkedAITask[]);
      }

      this.services.resultAggregator.markExecutionComplete();

      return this.services.resultAggregator.getResults();
    } finally {
      this.isRunning = false;
      this.cleanupAllHeartbeats();
    }
  }

  /**
   * Cleanup all heartbeat monitors
   */
  private cleanupAllHeartbeats(): void {
    // Kill all active processes and clean up monitoring
    this.services.processPoolManager.killAllProcesses();
  }

  /**
   * Check if batch contains chunked tasks
   */
  private hasChunkedTasks(batch: AITaskBatch): boolean {
    return batch.tasks.some((task) => (task as ChunkedAITask).isChunked !== undefined);
  }

  /**
   * Kill all active processes
   */
  async killAll(): Promise<void> {
    await this.services.taskQueueManager.stop();
    this.services.processPoolManager.killAllProcesses();
  }

  /**
   * Get reliability status
   */
  getReliabilityStatus(): ReliabilityStatus {
    const circuitBreakerState = this.services.circuitBreaker?.getState();
    return this.services.statisticsService.getReliabilityStatus(
      this.isGracefullyDegraded,
      circuitBreakerState?.state
    );
  }

  /**
   * Get system-wide zombie processes
   */
  getZombieProcesses(): ProcessResourceUsage[] {
    return this.services.statisticsService.getZombieProcesses();
  }

  /**
   * Get process monitoring status
   */
  getProcessMonitoringStatus(): ProcessMonitoringStatus {
    return this.services.statisticsService.getProcessMonitoringStatus();
  }

  /**
   * Get intelligent retry statistics
   */
  getRetryStatistics(): RetryStatistics {
    return this.services.statisticsService.getRetryStatistics();
  }

  /**
   * Generate execution report
   */
  generateReport(): string {
    return this.services.statisticsService.generateReport(this.config, this.isGracefullyDegraded);
  }

  /**
   * Get current statistics
   */
  getStats(): OrchestratorStats {
    return this.services.statisticsService.getStats();
  }

  /**
   * Clean up resources and cancel all active timers
   */
  cleanup(): void {
    // Cancel all active timers in the timer service
    this.timerService.cancelAll();

    // Clean up process pool manager
    this.services.processPoolManager.cleanup();

    // Clear result aggregator
    this.services.resultAggregator.clear();
  }
}

// Re-export types for backward compatibility
export type { ProcessResult, OrchestratorStats } from './services/ResultAggregator';
