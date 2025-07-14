/**
 * Service Factory
 *
 * Centralizes service creation and configuration:
 * - Creates and configures all orchestrator services
 * - Handles service dependencies and initialization order
 * - Provides clean separation of construction logic
 */

import { ProcessPoolManager } from './ProcessPoolManager';
import { TaskQueueManager } from './TaskQueueManager';
import { ResultAggregator } from './ResultAggregator';
import { ProcessExecutor } from './ProcessExecutor';
import { DegradedModeHandler } from './DegradedModeHandler';
import { AuthenticationService } from './AuthenticationService';
import { StatisticsService } from './StatisticsService';
import { TaskExecutionService } from './TaskExecutionService';
import type { ClaudeOrchestratorConfig } from '../ClaudeOrchestrator';
import type { TaskCheckpointManager } from '../../state/TaskCheckpointManager';
import type { TestableTimer } from '../../types/timer-types';
import { CircuitBreaker, FailurePatternDetector } from '../../utils/retry-helper';

/**
 * Orchestrator services bundle
 */
export interface OrchestratorServices {
  processPoolManager: ProcessPoolManager;
  taskQueueManager: TaskQueueManager;
  resultAggregator: ResultAggregator;
  processExecutor: ProcessExecutor;
  degradedModeHandler: DegradedModeHandler;
  authenticationService: AuthenticationService;
  statisticsService: StatisticsService;
  taskExecutionService: TaskExecutionService;
  circuitBreaker: CircuitBreaker | null;
  failurePatternDetector: FailurePatternDetector;
}

/**
 * Factory responsible for creating and configuring all orchestrator services
 */
export class ServiceFactory {
  /**
   * Create all orchestrator services with proper configuration and dependencies
   */
  static createServices(
    config: ClaudeOrchestratorConfig,
    timerService: TestableTimer,
    checkpointManager?: TaskCheckpointManager
  ): OrchestratorServices {
    // Initialize circuit breaker if enabled
    const circuitBreaker = config.circuitBreakerEnabled
      ? new CircuitBreaker(5, 60000) // 5 failures, 1 minute recovery
      : null;

    // Initialize failure pattern detector
    const failurePatternDetector = new FailurePatternDetector();

    // Initialize ResultAggregator
    const resultAggregator = new ResultAggregator({
      enableFileOutput: true,
      mergeChunkedResults: true,
    });

    // Initialize ProcessPoolManager
    const processPoolManager = new ProcessPoolManager({
      maxConcurrent: config.maxConcurrent ?? 3,
      timeout: config.timeout ?? 900000,
      timerService,
    });

    // Initialize TaskQueueManager
    const taskQueueManager = new TaskQueueManager({
      maxConcurrency: config.maxConcurrent ?? 3,
      timeout: config.timeout,
      verbose: config.verbose,
    });

    // Initialize ProcessExecutor
    const processExecutorConfig: any = {
      model: config.model!,
      timeout: config.timeout,
      verbose: config.verbose,
    };
    if (config.fallbackModel) {
      processExecutorConfig.fallbackModel = config.fallbackModel;
    }

    const processExecutor = new ProcessExecutor(
      processExecutorConfig,
      processPoolManager,
      timerService,
      checkpointManager
    );

    // Initialize DegradedModeHandler
    const degradedModeHandler = new DegradedModeHandler();

    // Initialize AuthenticationService
    const authenticationService = new AuthenticationService(config.gracefulDegradation);

    // Initialize StatisticsService
    const statisticsService = new StatisticsService(
      processPoolManager,
      taskQueueManager,
      resultAggregator,
      failurePatternDetector
    );

    // Initialize TaskExecutionService
    const taskExecutionService = new TaskExecutionService(
      config,
      processExecutor,
      degradedModeHandler,
      resultAggregator,
      taskQueueManager,
      failurePatternDetector,
      circuitBreaker,
      false, // isGracefullyDegraded - will be set later
      checkpointManager
    );

    return {
      processPoolManager,
      taskQueueManager,
      resultAggregator,
      processExecutor,
      degradedModeHandler,
      authenticationService,
      statisticsService,
      taskExecutionService,
      circuitBreaker,
      failurePatternDetector,
    };
  }
}
