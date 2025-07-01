/**
 * Debouncer Utility
 *
 * Provides intelligent debouncing for file changes to avoid excessive processing:
 * - Batches rapid file changes together
 * - Configurable delay and batch sizes
 * - Smart grouping by file type and directory
 * - Execution strategies for different scenarios
 */

import { EventEmitter } from 'events';
import { logger } from './logger';

export interface DebouncedEvent<T> {
  /** Unique ID for this debounced event */
  id: string;
  /** Original events that were batched together */
  events: T[];
  /** Total number of events in this batch */
  eventCount: number;
  /** First event timestamp */
  firstEventTime: Date;
  /** Last event timestamp */
  lastEventTime: Date;
  /** Total debounce duration */
  duration: number;
}

export interface DebouncerConfig<T> {
  /** Debounce delay in milliseconds */
  delay?: number;
  /** Maximum batch size before forcing execution */
  maxBatchSize?: number;
  /** Maximum wait time before forcing execution (ms) */
  maxWaitTime?: number;
  /** Function to extract a key for grouping events */
  groupBy?: (event: T) => string;
  /** Function to determine if events should be merged */
  shouldMerge?: (event1: T, event2: T) => boolean;
  /** Enable verbose logging */
  verbose?: boolean;
}

/**
 * Generic debouncer that batches events intelligently
 */
export class Debouncer<T> extends EventEmitter {
  private readonly config: Required<DebouncerConfig<T>>;
  private pendingBatches = new Map<
    string,
    {
      events: T[];
      timeout: NodeJS.Timeout;
      firstEventTime: Date;
      lastEventTime: Date;
    }
  >();
  private eventCounter = 0;

  constructor(config: DebouncerConfig<T> = {}) {
    super();

    this.config = {
      delay: 300, // 300ms default debounce
      maxBatchSize: 50, // Process if more than 50 events
      maxWaitTime: 2000, // Never wait more than 2 seconds
      groupBy: () => 'default', // Group all events together by default
      shouldMerge: () => false, // Don't merge events by default
      verbose: false,
      ...config,
    };
  }

  /**
   * Add an event to be debounced
   */
  debounce(event: T): void {
    const groupKey = this.config.groupBy(event);
    const now = new Date();

    if (this.config.verbose) {
      logger.debug('Debouncer received event', {
        groupKey,
        eventType:
          typeof event === 'object' && event !== null
            ? (event as any).type || 'unknown'
            : typeof event,
      });
    }

    // Get or create batch for this group
    let batch = this.pendingBatches.get(groupKey);

    if (!batch) {
      // Create new batch
      batch = {
        events: [],
        timeout: setTimeout(() => this.processBatch(groupKey), this.config.delay),
        firstEventTime: now,
        lastEventTime: now,
      };
      this.pendingBatches.set(groupKey, batch);
    } else {
      // Update existing batch
      clearTimeout(batch.timeout);
      batch.lastEventTime = now;

      // Check if we should merge with existing event
      let merged = false;
      if (this.config.shouldMerge && batch.events.length > 0) {
        for (let i = batch.events.length - 1; i >= 0; i--) {
          const existingEvent = batch.events[i];
          if (existingEvent && this.config.shouldMerge(existingEvent, event)) {
            // Replace the existing event with the new one
            batch.events[i] = event;
            merged = true;
            break;
          }
        }
      }

      if (!merged) {
        batch.events.push(event);
      }

      // Check if we should force processing due to batch size or wait time
      const shouldForceProcess =
        batch.events.length >= this.config.maxBatchSize ||
        now.getTime() - batch.firstEventTime.getTime() >= this.config.maxWaitTime;

      if (shouldForceProcess) {
        // Process immediately
        this.processBatch(groupKey);
        return;
      } else {
        // Reset timeout
        batch.timeout = setTimeout(() => this.processBatch(groupKey), this.config.delay);
      }
    }

    // Add event to batch if not merged
    if (!this.pendingBatches.get(groupKey)?.events.includes(event)) {
      this.pendingBatches.get(groupKey)?.events.push(event);
    }
  }

  /**
   * Force processing of all pending batches
   */
  flush(): void {
    if (this.config.verbose) {
      logger.debug('Flushing all pending batches', {
        pendingGroups: this.pendingBatches.size,
      });
    }

    const groupKeys = Array.from(this.pendingBatches.keys());
    groupKeys.forEach((groupKey) => this.processBatch(groupKey));
  }

  /**
   * Cancel all pending batches
   */
  cancel(): void {
    if (this.config.verbose) {
      logger.debug('Cancelling all pending batches', {
        pendingGroups: this.pendingBatches.size,
      });
    }

    for (const batch of this.pendingBatches.values()) {
      clearTimeout(batch.timeout);
    }
    this.pendingBatches.clear();
  }

  /**
   * Get current pending batch information
   */
  getPendingBatches(): Array<{
    groupKey: string;
    eventCount: number;
    firstEventTime: Date;
    lastEventTime: Date;
    waitTime: number;
  }> {
    const now = Date.now();
    return Array.from(this.pendingBatches.entries()).map(([groupKey, batch]) => ({
      groupKey,
      eventCount: batch.events.length,
      firstEventTime: batch.firstEventTime,
      lastEventTime: batch.lastEventTime,
      waitTime: now - batch.firstEventTime.getTime(),
    }));
  }

  /**
   * Check if there are pending batches
   */
  get hasPending(): boolean {
    return this.pendingBatches.size > 0;
  }

  /**
   * Process a batch of events
   */
  private processBatch(groupKey: string): void {
    const batch = this.pendingBatches.get(groupKey);
    if (!batch) {
      return;
    }

    // Remove from pending
    this.pendingBatches.delete(groupKey);
    clearTimeout(batch.timeout);

    // Create debounced event
    const eventId = `debounced-${++this.eventCounter}`;
    const debouncedEvent: DebouncedEvent<T> = {
      id: eventId,
      events: [...batch.events], // Copy array
      eventCount: batch.events.length,
      firstEventTime: batch.firstEventTime,
      lastEventTime: batch.lastEventTime,
      duration: batch.lastEventTime.getTime() - batch.firstEventTime.getTime(),
    };

    if (this.config.verbose) {
      logger.debug('Processing debounced batch', {
        groupKey,
        eventId,
        eventCount: debouncedEvent.eventCount,
        duration: debouncedEvent.duration,
      });
    }

    // Emit the processed batch
    this.emit('debounced', debouncedEvent, groupKey);
  }
}

/**
 * Specialized debouncer for file changes
 */
export interface FileChangeDebounceEvent {
  type: 'add' | 'change' | 'unlink';
  filePath: string;
  timestamp: Date;
  extension?: string;
}

export class FileChangeDebouncer extends Debouncer<FileChangeDebounceEvent> {
  constructor(
    config: Omit<DebouncerConfig<FileChangeDebounceEvent>, 'groupBy' | 'shouldMerge'> & {
      /** Group by file extension or directory */
      groupBy?: 'extension' | 'directory' | 'file' | ((event: FileChangeDebounceEvent) => string);
    } = {}
  ) {
    // Smart defaults for file changes
    const groupByFn =
      typeof config.groupBy === 'function'
        ? config.groupBy
        : config.groupBy === 'extension'
          ? (event: FileChangeDebounceEvent) => event.extension || 'unknown'
          : config.groupBy === 'directory'
            ? (event: FileChangeDebounceEvent) => {
                const path = require('path');
                return path.dirname(event.filePath);
              }
            : config.groupBy === 'file'
              ? (event: FileChangeDebounceEvent) => event.filePath
              : () => 'files'; // Default: group all file changes together

    const shouldMergeFn = (event1: FileChangeDebounceEvent, event2: FileChangeDebounceEvent) => {
      // Merge events for the same file (keep latest)
      return event1.filePath === event2.filePath;
    };

    super({
      delay: 500, // Slightly longer delay for file changes
      maxBatchSize: 20, // Smaller batches for files
      maxWaitTime: 3000, // Allow longer wait for file operations
      ...config,
      groupBy: groupByFn,
      shouldMerge: shouldMergeFn,
    });
  }
}

/**
 * Type definitions for events - removing the problematic declare interface
 */
