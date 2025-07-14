/**
 * Enhanced Workflow Event Emitter
 *
 * Provides advanced event handling capabilities:
 * - Type-safe event emission and listening
 * - Event filtering and middleware pipeline
 * - Error handling and recovery strategies
 * - Metrics collection and tracing
 * - Event streams for reactive programming
 */

import { randomUUID } from 'crypto';
import { logger } from '../utils/logger';
import { AIWorkflowError } from '../types/ai-error-types';
import type { WorkflowEvents } from '../types/ai-workflow-types';
import type {
  EnhancedWorkflowEventEmitter,
  EventFilter,
  EventMiddleware,
  EventContext,
  EventProcessingResult,
  EventListenerConfig,
  EnhancedEventEmitterConfig,
  EventMetrics,
  EventTrace,
  ListenerRegistryEntry,
  EventBatch,
  EventStream,
  EventPipelineConfig,
} from '../types/workflow-event-types';

/**
 * Default configuration for enhanced event emitter
 */
const DEFAULT_CONFIG: Required<EnhancedEventEmitterConfig> = {
  enableMetrics: true,
  enableTracing: false,
  maxListeners: 50,
  errorThreshold: 5,
  defaultTimeout: 5000,
};

// Export types for external use
export type {
  EnhancedWorkflowEventEmitter,
  EventListenerConfig,
  EventProcessingResult,
  EventFilter,
  EventMiddleware,
  EventContext,
  EventMetrics,
  EventTrace,
} from '../types/workflow-event-types';

/**
 * Enhanced event emitter implementation
 */
export class EnhancedWorkflowEventEmitterImpl implements EnhancedWorkflowEventEmitter {
  private config: Required<EnhancedEventEmitterConfig>;
  private listenerRegistry = new Map<string, ListenerRegistryEntry<keyof WorkflowEvents>>();
  private filters = new Map<keyof WorkflowEvents, Map<string, EventFilter<keyof WorkflowEvents>>>();
  private middleware = new Map<
    keyof WorkflowEvents,
    Map<string, EventMiddleware<keyof WorkflowEvents>>
  >();
  private pipelines = new Map<
    keyof WorkflowEvents,
    Map<string, EventPipelineConfig<keyof WorkflowEvents>>
  >();

  // Metrics and tracing
  private metrics: EventMetrics = {
    totalEmitted: 0,
    totalFiltered: 0,
    totalErrors: 0,
    averageProcessingTime: 0,
    eventCounts: {},
    errorCounts: {},
  };
  private traces: EventTrace[] = [];
  private processingTimes: number[] = [];

  constructor(config?: Partial<EnhancedEventEmitterConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Enhanced event emission with filtering, middleware, and error handling
   */
  async emit<K extends keyof WorkflowEvents>(
    event: K,
    data: WorkflowEvents[K],
    context?: Partial<EventContext>
  ): Promise<EventProcessingResult> {
    const startTime = Date.now();
    const eventId = randomUUID();
    const fullContext: EventContext = {
      timestamp: startTime,
      eventId,
      workflowId: randomUUID(),
      metadata: {},
      ...context,
    };

    const result: EventProcessingResult = {
      success: true,
      filtered: false,
      middlewareErrors: [],
      handlerErrors: [],
      duration: 0,
    };

    try {
      // Update metrics
      if (this.config.enableMetrics) {
        this.metrics.totalEmitted++;
        this.metrics.eventCounts[event as string] =
          (this.metrics.eventCounts[event as string] ?? 0) + 1;
      }

      // Apply filters
      const shouldProcess = await this.applyFilters(event, data, fullContext);
      if (!shouldProcess) {
        result.filtered = true;
        if (this.config.enableMetrics) {
          this.metrics.totalFiltered++;
        }
        return result;
      }

      // Apply middleware pipeline
      let processedData = data;
      const middlewareChain: string[] = [];

      const middlewareMap = this.middleware.get(event);
      if (middlewareMap) {
        for (const [middlewareId, middlewareFn] of middlewareMap) {
          try {
            let nextCalled = false;
            await middlewareFn(event, processedData, fullContext, () => {
              nextCalled = true;
              return Promise.resolve();
            });

            if (!nextCalled) {
              logger.warn(`Middleware ${middlewareId} did not call next()`);
            }

            middlewareChain.push(middlewareId);
          } catch (error) {
            const workflowError =
              error instanceof AIWorkflowError
                ? error
                : new AIWorkflowError(
                    `Middleware error in ${middlewareId}: ${String(error)}`,
                    'middleware-error',
                    error instanceof Error ? error : undefined
                  );

            result.middlewareErrors.push(workflowError);
            logger.error(`Middleware error in ${middlewareId}:`, workflowError);
          }
        }
      }

      // Apply pipelines
      const pipelineMap = this.pipelines.get(event);
      if (pipelineMap) {
        for (const [pipelineId, pipelineConfig] of pipelineMap) {
          try {
            for (const stage of pipelineConfig.stages) {
              const stageResult = await stage.process(event, processedData, fullContext);
              if (!stageResult.continue) {
                logger.info(`Pipeline ${pipelineId} stopped at stage ${stage.name}`);
                break;
              }
              processedData = stageResult.data as WorkflowEvents[K];
            }
          } catch (error) {
            const workflowError =
              error instanceof AIWorkflowError
                ? error
                : new AIWorkflowError(
                    `Pipeline error in ${pipelineId}: ${String(error)}`,
                    'pipeline-error',
                    error instanceof Error ? error : undefined
                  );

            if (pipelineConfig.onError) {
              pipelineConfig.onError(workflowError, pipelineId);
            }

            if (!pipelineConfig.continueOnError) {
              result.middlewareErrors.push(workflowError);
              break;
            }
          }
        }
      }

      // Execute listeners
      const eventListeners = Array.from(this.listenerRegistry.values())
        .filter((entry) => entry.eventName === event && !entry.disabled)
        .sort((a, b) => (b.config.priority ?? 0) - (a.config.priority ?? 0));

      let handlerCount = 0;
      for (const listenerEntry of eventListeners) {
        try {
          // Apply listener-specific filter
          if (listenerEntry.config.filter) {
            const shouldExecute = await listenerEntry.config.filter(
              event,
              processedData,
              fullContext
            );
            if (!shouldExecute) {
              continue;
            }
          }

          // Apply listener-specific middleware
          if (listenerEntry.config.middleware) {
            for (const middlewareFn of listenerEntry.config.middleware) {
              let nextCalled = false;
              await middlewareFn(event, processedData, fullContext, () => {
                nextCalled = true;
                return Promise.resolve();
              });
              if (!nextCalled) {
                logger.warn(`Listener middleware did not call next()`);
              }
            }
          }

          // Execute handler
          listenerEntry.config.handler(processedData);
          handlerCount++;

          // Remove one-time listeners
          if (listenerEntry.config.once) {
            this.listenerRegistry.delete(listenerEntry.id);
          }
        } catch (error) {
          const workflowError =
            error instanceof AIWorkflowError
              ? error
              : new AIWorkflowError(
                  `Handler error in listener ${listenerEntry.id}: ${String(error)}`,
                  'handler-error',
                  error instanceof Error ? error : undefined
                );

          result.handlerErrors.push(workflowError);
          listenerEntry.errorCount++;
          listenerEntry.lastError = workflowError;

          // Handle error recovery
          if (listenerEntry.config.errorHandler) {
            try {
              listenerEntry.config.errorHandler(workflowError);
            } catch (recoveryError) {
              logger.error('Error in error handler:', recoveryError);
            }
          }

          // Disable listener if error threshold exceeded
          if (listenerEntry.errorCount >= this.config.errorThreshold) {
            listenerEntry.disabled = true;
            logger.warn(`Listener ${listenerEntry.id} disabled due to excessive errors`);
          }

          if (this.config.enableMetrics) {
            this.metrics.totalErrors++;
            this.metrics.errorCounts[event as string] =
              (this.metrics.errorCounts[event as string] ?? 0) + 1;
          }
        }
      }

      // Update success status
      result.success = result.middlewareErrors.length === 0 && result.handlerErrors.length === 0;

      // Record trace
      if (this.config.enableTracing) {
        const trace: EventTrace = {
          eventId,
          eventName: event as string,
          timestamp: startTime,
          duration: Date.now() - startTime,
          middlewareChain,
          handlerCount,
          filtered: result.filtered,
          errors: [
            ...result.middlewareErrors.map((e) => e.message),
            ...result.handlerErrors.map((e) => e.message),
          ],
        };

        this.traces.push(trace);

        // Keep only recent traces (max 1000)
        if (this.traces.length > 1000) {
          this.traces = this.traces.slice(-1000);
        }
      }
    } catch (error) {
      result.success = false;
      const workflowError =
        error instanceof AIWorkflowError
          ? error
          : new AIWorkflowError(
              `Event emission error: ${String(error)}`,
              'emission-error',
              error instanceof Error ? error : undefined
            );
      result.middlewareErrors.push(workflowError);
      logger.error('Event emission error:', workflowError);
    } finally {
      result.duration = Date.now() - startTime;

      // Update processing time metrics
      if (this.config.enableMetrics) {
        this.processingTimes.push(result.duration);

        // Keep only recent processing times for rolling average
        if (this.processingTimes.length > 1000) {
          this.processingTimes = this.processingTimes.slice(-1000);
        }

        this.metrics.averageProcessingTime =
          this.processingTimes.reduce((a, b) => a + b, 0) / this.processingTimes.length;
      }
    }

    return result;
  }

  /**
   * Enhanced event listener registration
   */
  on<K extends keyof WorkflowEvents>(event: K, config: EventListenerConfig<K>): string {
    const listenerId = randomUUID();

    const entry: ListenerRegistryEntry<K> = {
      id: listenerId,
      eventName: event,
      config,
      errorCount: 0,
      disabled: false,
      addedAt: Date.now(),
    };

    this.listenerRegistry.set(listenerId, entry as unknown as ListenerRegistryEntry<keyof WorkflowEvents>);
    return listenerId;
  }

  /**
   * Remove event listener
   */
  off(listenerId: string): boolean {
    return this.listenerRegistry.delete(listenerId);
  }

  /**
   * Add event filter
   */
  addFilter<K extends keyof WorkflowEvents>(eventName: K, filter: EventFilter<K>): string {
    const filterId = randomUUID();

    if (!this.filters.has(eventName)) {
      this.filters.set(eventName, new Map());
    }

    this.filters.get(eventName)!.set(filterId, filter as EventFilter<keyof WorkflowEvents>);
    return filterId;
  }

  /**
   * Add middleware
   */
  addMiddleware<K extends keyof WorkflowEvents>(
    eventName: K,
    middleware: EventMiddleware<K>
  ): string {
    const middlewareId = randomUUID();

    if (!this.middleware.has(eventName)) {
      this.middleware.set(eventName, new Map());
    }

    this.middleware
      .get(eventName)!
      .set(middlewareId, middleware as EventMiddleware<keyof WorkflowEvents>);
    return middlewareId;
  }

  /**
   * Create event stream (basic implementation)
   */
  createStream<K extends keyof WorkflowEvents>(_eventName: K): EventStream<K> {
    // This is a simplified implementation
    // In a full implementation, you'd want a proper reactive stream library
    throw new Error('Event streams not implemented in this basic version');
  }

  /**
   * Add event pipeline
   */
  addPipeline<K extends keyof WorkflowEvents>(
    eventName: K,
    config: EventPipelineConfig<K>
  ): string {
    const pipelineId = randomUUID();

    if (!this.pipelines.has(eventName)) {
      this.pipelines.set(eventName, new Map());
    }

    this.pipelines
      .get(eventName)!
      .set(pipelineId, config as unknown as EventPipelineConfig<keyof WorkflowEvents>);
    return pipelineId;
  }

  /**
   * Get metrics
   */
  getMetrics(): EventMetrics {
    return { ...this.metrics };
  }

  /**
   * Get traces
   */
  getTraces(limit = 100): EventTrace[] {
    return this.traces.slice(-limit);
  }

  /**
   * Clear metrics
   */
  clearMetrics(): void {
    this.metrics = {
      totalEmitted: 0,
      totalFiltered: 0,
      totalErrors: 0,
      averageProcessingTime: 0,
      eventCounts: {},
      errorCounts: {},
    };
    this.traces = [];
    this.processingTimes = [];
  }

  /**
   * Emit batch of events
   */
  async emitBatch(batch: EventBatch): Promise<EventProcessingResult[]> {
    const results: EventProcessingResult[] = [];

    for (const event of batch.events) {
      const result = await this.emit(event.name, event.data, event.context);
      results.push(result);
    }

    return results;
  }

  /**
   * Configure emitter
   */
  configure(config: Partial<EnhancedEventEmitterConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get listeners
   */
  getListeners<K extends keyof WorkflowEvents>(eventName?: K): ListenerRegistryEntry<K>[] {
    const allListeners = Array.from(this.listenerRegistry.values());

    if (eventName) {
      return allListeners.filter(
        (listener) => listener.eventName === eventName
      ) as unknown as ListenerRegistryEntry<K>[];
    }

    return allListeners as unknown as ListenerRegistryEntry<K>[];
  }

  /**
   * Apply filters to determine if event should be processed
   */
  private async applyFilters<K extends keyof WorkflowEvents>(
    eventName: K,
    data: WorkflowEvents[K],
    context: EventContext
  ): Promise<boolean> {
    const eventFilters = this.filters.get(eventName);
    if (!eventFilters || eventFilters.size === 0) {
      return true;
    }

    for (const [filterId, filter] of eventFilters) {
      try {
        const shouldProcess = await filter(eventName, data, context);
        if (!shouldProcess) {
          logger.debug(`Event ${eventName} filtered by ${filterId}`);
          return false;
        }
      } catch (error) {
        logger.error(`Filter ${filterId} error:`, error);
        // Continue with other filters if one fails
      }
    }

    return true;
  }
}
