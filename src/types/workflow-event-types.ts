/**
 * Enhanced Workflow Event System Types
 *
 * Provides advanced event handling with:
 * - Event filtering
 * - Middleware pipeline
 * - Error handling and recovery
 * - Type-safe event emission and listening
 */

import { AIWorkflowError } from './ai-error-types';
import type { WorkflowEvents, WorkflowEventHandler } from './ai-workflow-types';

/**
 * Event filter function
 */
export type EventFilter<K extends keyof WorkflowEvents> = (
  eventName: K,
  data: WorkflowEvents[K],
  context: EventContext
) => boolean | Promise<boolean>;

/**
 * Event middleware function
 */
export type EventMiddleware<K extends keyof WorkflowEvents> = (
  eventName: K,
  data: WorkflowEvents[K],
  context: EventContext,
  next: () => Promise<void>
) => Promise<void>;

/**
 * Event context for middleware and filters
 */
export interface EventContext {
  timestamp: number;
  eventId: string;
  workflowId: string;
  phase?: string;
  metadata: Record<string, unknown>;
}

/**
 * Event processing result
 */
export interface EventProcessingResult {
  success: boolean;
  filtered: boolean;
  middlewareErrors: AIWorkflowError[];
  handlerErrors: AIWorkflowError[];
  duration: number;
}

/**
 * Event listener configuration
 */
export interface EventListenerConfig<K extends keyof WorkflowEvents> {
  handler: WorkflowEventHandler<K>;
  priority?: number; // Higher numbers execute first
  once?: boolean;
  filter?: EventFilter<K>;
  middleware?: EventMiddleware<K>[];
  errorHandler?: (error: AIWorkflowError) => void;
}

/**
 * Enhanced event emitter configuration
 */
export interface EnhancedEventEmitterConfig {
  enableMetrics?: boolean;
  enableTracing?: boolean;
  maxListeners?: number;
  errorThreshold?: number; // Max errors before disabling listener
  defaultTimeout?: number; // Timeout for async operations
}

/**
 * Event metrics for monitoring
 */
export interface EventMetrics {
  totalEmitted: number;
  totalFiltered: number;
  totalErrors: number;
  averageProcessingTime: number;
  eventCounts: Record<string, number>;
  errorCounts: Record<string, number>;
}

/**
 * Event tracer for debugging
 */
export interface EventTrace {
  eventId: string;
  eventName: string;
  timestamp: number;
  duration: number;
  middlewareChain: string[];
  handlerCount: number;
  filtered: boolean;
  errors: string[];
}

/**
 * Event listener registry entry
 */
export interface ListenerRegistryEntry<K extends keyof WorkflowEvents> {
  id: string;
  eventName: K;
  config: EventListenerConfig<K>;
  errorCount: number;
  lastError?: AIWorkflowError;
  disabled: boolean;
  addedAt: number;
}

/**
 * Event batch for bulk processing
 */
export interface EventBatch {
  events: Array<{
    name: keyof WorkflowEvents;
    data: WorkflowEvents[keyof WorkflowEvents];
    context: EventContext;
  }>;
  batchId: string;
  timestamp: number;
}

/**
 * Event subscription options
 */
export interface EventSubscriptionOptions<K extends keyof WorkflowEvents> {
  filter?: EventFilter<K>;
  transform?: (data: WorkflowEvents[K]) => WorkflowEvents[K];
  throttle?: number; // Milliseconds between emissions
  debounce?: number; // Milliseconds to wait for additional events
}

/**
 * Event stream for reactive programming
 */
export interface EventStream<K extends keyof WorkflowEvents> {
  subscribe(
    handler: WorkflowEventHandler<K>,
    options?: EventSubscriptionOptions<K>
  ): EventStreamSubscription;
  filter(predicate: EventFilter<K>): EventStream<K>;
  map<T>(mapper: (data: WorkflowEvents[K]) => T): EventStream<K>;
  throttle(ms: number): EventStream<K>;
  debounce(ms: number): EventStream<K>;
}

/**
 * Event stream subscription
 */
export interface EventStreamSubscription {
  unsubscribe(): void;
  isActive(): boolean;
  getMetrics(): {
    eventsReceived: number;
    errorsEncountered: number;
    lastEventTime?: number;
  };
}

/**
 * Event pipeline stage
 */
export interface EventPipelineStage<K extends keyof WorkflowEvents> {
  name: string;
  process: (
    eventName: K,
    data: WorkflowEvents[K],
    context: EventContext
  ) => Promise<{ continue: boolean; data: WorkflowEvents[K] }>;
  errorHandler?: (error: AIWorkflowError) => boolean; // Return true to continue pipeline
}

/**
 * Event pipeline configuration
 */
export interface EventPipelineConfig<K extends keyof WorkflowEvents> {
  stages: EventPipelineStage<K>[];
  onError?: (error: AIWorkflowError, stage: string) => void;
  continueOnError?: boolean;
}

/**
 * Enhanced workflow event emitter interface
 */
export interface EnhancedWorkflowEventEmitter {
  // Core event methods
  emit<K extends keyof WorkflowEvents>(
    event: K,
    data: WorkflowEvents[K],
    context?: Partial<EventContext>
  ): Promise<EventProcessingResult>;

  on<K extends keyof WorkflowEvents>(event: K, config: EventListenerConfig<K>): string; // Returns listener ID

  off(listenerId: string): boolean;

  // Enhanced features
  addFilter<K extends keyof WorkflowEvents>(eventName: K, filter: EventFilter<K>): string;

  addMiddleware<K extends keyof WorkflowEvents>(
    eventName: K,
    middleware: EventMiddleware<K>
  ): string;

  createStream<K extends keyof WorkflowEvents>(eventName: K): EventStream<K>;

  addPipeline<K extends keyof WorkflowEvents>(eventName: K, config: EventPipelineConfig<K>): string;

  // Metrics and monitoring
  getMetrics(): EventMetrics;
  getTraces(limit?: number): EventTrace[];
  clearMetrics(): void;

  // Batch processing
  emitBatch(batch: EventBatch): Promise<EventProcessingResult[]>;

  // Configuration
  configure(config: Partial<EnhancedEventEmitterConfig>): void;
  getListeners<K extends keyof WorkflowEvents>(eventName?: K): ListenerRegistryEntry<K>[];
}

/**
 * Event error recovery strategies
 */
export enum EventErrorRecoveryStrategy {
  IGNORE = 'ignore',
  RETRY = 'retry',
  DISABLE_LISTENER = 'disable_listener',
  FAIL_FAST = 'fail_fast',
  CIRCUIT_BREAKER = 'circuit_breaker',
}

/**
 * Event error recovery configuration
 */
export interface EventErrorRecoveryConfig {
  strategy: EventErrorRecoveryStrategy;
  maxRetries?: number;
  retryDelay?: number;
  circuitBreakerThreshold?: number;
  circuitBreakerTimeout?: number;
}

/**
 * Event handler wrapper with error recovery
 */
export interface ResilientEventHandler<K extends keyof WorkflowEvents> {
  handler: WorkflowEventHandler<K>;
  recovery: EventErrorRecoveryConfig;
  state: {
    errorCount: number;
    lastError?: AIWorkflowError;
    circuitOpen: boolean;
    circuitOpenedAt?: number;
  };
}

/**
 * Type guards for event system
 */
export function isEventFilter<K extends keyof WorkflowEvents>(
  value: unknown
): value is EventFilter<K> {
  return typeof value === 'function';
}

export function isEventMiddleware<K extends keyof WorkflowEvents>(
  value: unknown
): value is EventMiddleware<K> {
  return typeof value === 'function';
}

export function isEventContext(value: unknown): value is EventContext {
  return (
    typeof value === 'object' &&
    value !== null &&
    'timestamp' in value &&
    'eventId' in value &&
    'workflowId' in value &&
    typeof (value as EventContext).timestamp === 'number' &&
    typeof (value as EventContext).eventId === 'string' &&
    typeof (value as EventContext).workflowId === 'string'
  );
}

/**
 * Common event filters
 */
export const CommonFilters = {
  // Only emit events during specific phases
  phaseFilter: <K extends keyof WorkflowEvents>(allowedPhases: string[]): EventFilter<K> => {
    return (_eventName, _data, context) => {
      return !context.phase || allowedPhases.includes(context.phase);
    };
  },

  // Rate limiting filter
  rateLimitFilter: <K extends keyof WorkflowEvents>(maxEventsPerSecond: number): EventFilter<K> => {
    const timestamps: number[] = [];
    return (_eventName, _data, _context) => {
      const now = Date.now();
      // Remove timestamps older than 1 second
      while (timestamps.length > 0 && now - timestamps[0]! > 1000) {
        timestamps.shift();
      }

      if (timestamps.length >= maxEventsPerSecond) {
        return false;
      }

      timestamps.push(now);
      return true;
    };
  },

  // Event name pattern filter
  eventPatternFilter: <K extends keyof WorkflowEvents>(pattern: RegExp): EventFilter<K> => {
    return (eventName, _data, _context) => {
      return pattern.test(eventName as string);
    };
  },
};

/**
 * Common middleware
 */
export const CommonMiddleware = {
  // Logging middleware
  loggingMiddleware: <K extends keyof WorkflowEvents>(logger: {
    info: (message: string) => void;
  }): EventMiddleware<K> => {
    return async (eventName, _data, context, next) => {
      logger.info(`Event ${eventName} emitted in workflow ${context.workflowId}`);
      await next();
    };
  },

  // Timing middleware
  timingMiddleware: <K extends keyof WorkflowEvents>(): EventMiddleware<K> => {
    return async (_eventName, _data, context, next) => {
      const start = Date.now();
      await next();
      const duration = Date.now() - start;
      context.metadata.processingTime = duration;
    };
  },

  // Validation middleware
  validationMiddleware: <K extends keyof WorkflowEvents>(
    validator: (data: WorkflowEvents[K]) => boolean
  ): EventMiddleware<K> => {
    return async (eventName, data, _context, next) => {
      if (!validator(data)) {
        throw new AIWorkflowError(
          `Event data validation failed for ${eventName}`,
          'validation-error'
        );
      }
      await next();
    };
  },
};
