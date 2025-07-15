/**
 * Integration module for migrating ClaudeOrchestrator to new heartbeat monitoring
 *
 * This provides adapter methods to help with incremental migration.
 */

import { ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { HeartbeatMonitor, HeartbeatMonitorConfig } from './HeartbeatMonitor';
import { HeartbeatScheduler } from './HeartbeatScheduler';
import { TestableTimer } from '../../types/timer-types';
import { RealTimer } from '../../utils/RealTimer';

/**
 * Creates a configured HeartbeatMonitor instance for ClaudeOrchestrator
 */
export function createHeartbeatMonitor(
  timerService: TestableTimer = new RealTimer(),
  config?: Partial<HeartbeatMonitorConfig>
): HeartbeatMonitor {
  const defaultConfig: HeartbeatMonitorConfig = {
    scheduler: {
      intervalMs: 30000, // 30 seconds (matches HEARTBEAT_INTERVAL)
      timeoutMs: 900000, // 15 minutes (matches timeout config)
      progressIntervalMs: 10000, // 10 seconds for progress updates
    },
    analysis: {
      cpuThreshold: 80,
      memoryThresholdMB: 1000,
      minOutputRate: 0.1, // lines per minute
      maxSilenceDuration: 120000, // 2 minutes (matches DEAD_PROCESS_THRESHOLD)
      maxErrorCount: 50,
      progressMarkerPatterns: [
        'analyzing',
        'processing',
        'generating',
        'writing',
        'completed',
        'done',
        'finished',
        '\\d+%', // Percentage patterns
        'step \\d+',
        'phase \\d+',
        'task \\d+/\\d+',
      ],
      minProgressMarkers: 1,
      analysisWindowMs: 60000, // 1 minute window
    },
    enableLogging: true,
    ...config,
  };

  const scheduler = new HeartbeatScheduler(timerService, defaultConfig.scheduler);
  return new HeartbeatMonitor(scheduler, defaultConfig, timerService);
}

/**
 * Maps HeartbeatMonitor events to ClaudeOrchestrator events
 */
export function mapMonitorEvents(monitor: HeartbeatMonitor, orchestrator: EventEmitter): void {
  // Map health check events
  monitor.on('healthCheck', () => {
    // Internal health check - no direct mapping needed
  });

  // Map unhealthy events to process:dead
  monitor.on('unhealthy', (taskId, status) => {
    if (status.shouldTerminate) {
      orchestrator.emit('process:dead', {
        taskId,
        lastActivity: new Date(),
        bytesReceived: 0, // Will be populated from process info
        timeSinceLastActivity: 0,
        reason: status.reason || 'Process unhealthy',
        metrics: {
          isDead: true,
          isSlow: false,
          reason: status.reason || 'Process unhealthy',
          hasProgressMarkers: false,
          bytesPerSecond: 0,
          isEarlyPhase: false,
        },
        healthMetrics: undefined,
        resourceUsage: undefined,
      });
    }
  });

  // Map warning events
  monitor.on('warning', (taskId, warnings) => {
    const processInfo = monitor.getProcessInfo(taskId);
    if (!processInfo) {
      // If process info is not found, skip emitting events
      // This should not happen in normal operation
      return;
    }

    // Map to appropriate ClaudeOrchestrator events based on warning type
    for (const warning of warnings) {
      if (warning.includes('High CPU') || warning.includes('High memory')) {
        orchestrator.emit('process:high-resource', {
          taskId,
          lastActivity: new Date(processInfo.lastHealthCheck || Date.now()),
          bytesReceived: processInfo.outputs.length,
          timeSinceLastActivity: 0,
          healthMetrics: {
            isHealthy: true,
            isZombie: false,
            isHighResource: true,
            warnings: [warning],
            recommendations: [],
          },
          resourceUsage: undefined,
          recommendations: [],
        });
      } else if (warning.includes('Low output rate')) {
        // Check if we're in early phase (first 60 seconds)
        const processRuntime = Date.now() - processInfo.startTime;
        const isEarlyPhase = processRuntime < 60000; // 60 seconds
        const reason = isEarlyPhase ? `${warning} (early phase)` : warning;

        orchestrator.emit('process:slow', {
          taskId,
          lastActivity: new Date(processInfo.lastHealthCheck || Date.now()),
          bytesReceived: processInfo.outputs.length,
          timeSinceLastActivity: 0,
          consecutiveSlowChecks: 1,
          reason,
          metrics: {
            isDead: false,
            isSlow: true,
            reason,
            hasProgressMarkers: processInfo.progressMarkerCount > 0,
            bytesPerSecond: 0,
            isEarlyPhase,
          },
          healthMetrics: undefined,
          resourceUsage: undefined,
        });
      }
    }
  });

  // Map terminated events
  monitor.on('terminated', (_taskId, _reason) => {
    // Process terminated by monitor - implement if needed
    // orchestrator.emit('process:terminated', { taskId, reason });
  });

  // Map error events
  monitor.on('error', (_taskId, error) => {
    orchestrator.emit('error', error);
  });

  // Map progress events
  monitor.on('progress', (taskId, markers) => {
    orchestrator.emit('process:progress', { taskId, markers });
  });
}

/**
 * Legacy function expected by ProcessPoolManager for backward compatibility
 * This function creates and configures the heartbeat monitoring system
 */
export function setupEventMapping(poolManager: EventEmitter): {
  heartbeatAdapter: HeartbeatMonitorAdapter;
} {
  // Create a new heartbeat monitor with default configuration
  const monitor = createHeartbeatMonitor();

  // Set up event mapping between the monitor and pool manager
  mapMonitorEvents(monitor, poolManager);

  // Create and return the adapter
  const heartbeatAdapter = new HeartbeatMonitorAdapter(monitor);

  return { heartbeatAdapter };
}

/**
 * Adapter to convert ClaudeOrchestrator heartbeat calls to new monitor
 */
export class HeartbeatMonitorAdapter {
  constructor(private monitor: HeartbeatMonitor) {}

  /**
   * Starts monitoring (replaces startHeartbeatMonitoring)
   */
  startMonitoring(taskId: string, process: ChildProcess): void {
    if (!process.pid) {
      throw new Error('Process must have a valid PID for monitoring');
    }
    this.monitor.startMonitoring(taskId, process.pid, process);
  }

  /**
   * Stops monitoring (replaces stopHeartbeatMonitoring)
   */
  stopMonitoring(taskId: string): void {
    this.monitor.stopMonitoring(taskId);
  }

  /**
   * Updates activity (for updateProcessActivity compatibility)
   */
  updateActivity(
    _taskId: string,
    _bytesReceived: number,
    _isStdout: boolean,
    _data?: string
  ): void {
    // The new monitor handles this through process listeners
    // This method is kept for compatibility but may not be needed
  }

  /**
   * Gets monitoring stats
   */
  getStats(): ReturnType<HeartbeatMonitor['getStats']> {
    return this.monitor.getStats();
  }

  /**
   * Checks if a task is being monitored
   */
  isMonitoring(taskId: string): boolean {
    return this.monitor.isMonitoring(taskId);
  }
}
