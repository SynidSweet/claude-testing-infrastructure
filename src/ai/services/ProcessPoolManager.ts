/**
 * Process Pool Manager
 *
 * Manages Claude CLI process lifecycle:
 * - Process spawning and monitoring
 * - Heartbeat tracking and dead process detection
 * - Resource usage monitoring and cleanup
 * - Process-to-task mapping
 */

import { EventEmitter } from 'events';
import type { ChildProcess } from 'child_process';
import {
  ProcessMonitor,
  type ProcessHealthMetrics,
  type ProcessResourceUsage,
} from '../../utils/ProcessMonitor';
import { type TestableTimer, type TimerHandle } from '../../types/timer-types';
import { HeartbeatMonitor } from '../heartbeat/HeartbeatMonitor';
import { HeartbeatMonitorAdapter } from '../heartbeat/ClaudeOrchestratorIntegration';

export interface ProcessHeartbeat {
  taskId: string;
  process: ChildProcess;
  lastActivity: Date;
  stdoutBytes: number;
  stderrBytes: number;
  checkInterval?: TimerHandle;
  timeoutProgress?: TimerHandle;
  warningThresholds?: Set<number>;
  startTime?: Date;
  resourceUsage?: ProcessResourceUsage;
  healthMetrics?: ProcessHealthMetrics;
  lastStdinCheck?: Date;
  isWaitingForInput?: boolean;
  consecutiveSlowChecks?: number;
  lastProgressMarker?: string;
  progressHistory?: Array<{
    timestamp: Date;
    bytes: number;
    marker?: string;
  }>;
}

export interface ProcessPoolConfig {
  maxConcurrent?: number;
  timeout?: number;
  timerService?: TestableTimer;
}

export interface ProcessInfo {
  taskId: string;
  process: ChildProcess;
  startTime: Date;
  heartbeat: ProcessHeartbeat;
}

/**
 * Events emitted by ProcessPoolManager
 */
export interface ProcessPoolEvents {
  'process-started': { taskId: string; process: ChildProcess };
  'process-completed': { taskId: string; success: boolean };
  'process-failed': { taskId: string; error: Error };
  'process-timeout': { taskId: string };
  'process-killed': { taskId: string };
  'heartbeat-warning': { taskId: string; threshold: number };
  'resource-warning': { taskId: string; usage: ProcessResourceUsage };
}

export class ProcessPoolManager extends EventEmitter {
  private activeProcesses = new Map<string, ChildProcess>();
  private processHeartbeats = new Map<string, ProcessHeartbeat>();
  private processMonitor: ProcessMonitor;
  private heartbeatMonitor: HeartbeatMonitor;
  private heartbeatAdapter: HeartbeatMonitorAdapter;
  private timerService: TestableTimer;
  private config: ProcessPoolConfig;

  constructor(config: ProcessPoolConfig = {}) {
    super();
    this.config = config;
    this.timerService =
      config.timerService || require('../../utils/TimerFactory').createAutoTimer();
    this.processMonitor = new ProcessMonitor();

    // Initialize heartbeat monitoring system
    this.heartbeatMonitor =
      require('../heartbeat/ClaudeOrchestratorIntegration').createHeartbeatMonitor(
        this.timerService
      );
    this.heartbeatAdapter =
      new (require('../heartbeat/ClaudeOrchestratorIntegration').HeartbeatMonitorAdapter)(
        this.heartbeatMonitor
      );

    // Set up event mapping
    require('../heartbeat/ClaudeOrchestratorIntegration').setupEventMapping(
      this.heartbeatMonitor,
      this
    );
  }

  /**
   * Register a new process for monitoring
   */
  registerProcess(taskId: string, process: ChildProcess): void {
    if (this.activeProcesses.has(taskId)) {
      throw new Error(`Process with taskId ${taskId} is already registered`);
    }

    this.activeProcesses.set(taskId, process);
    this.startHeartbeatMonitoring(taskId, process);

    this.emit('process-started', { taskId, process });
  }

  /**
   * Unregister a process and clean up monitoring
   */
  unregisterProcess(taskId: string): void {
    const process = this.activeProcesses.get(taskId);
    if (!process) {
      return; // Already unregistered
    }

    this.stopHeartbeatMonitoring(taskId);
    this.activeProcesses.delete(taskId);
  }

  /**
   * Get process information for a task
   */
  getProcessInfo(taskId: string): ProcessInfo | undefined {
    const process = this.activeProcesses.get(taskId);
    const heartbeat = this.processHeartbeats.get(taskId);

    if (!process || !heartbeat) {
      return undefined;
    }

    return {
      taskId,
      process,
      startTime: heartbeat.startTime || new Date(),
      heartbeat,
    };
  }

  /**
   * Get all active process task IDs
   */
  getActiveTaskIds(): string[] {
    return Array.from(this.activeProcesses.keys());
  }

  /**
   * Get the number of active processes
   */
  getActiveProcessCount(): number {
    return this.activeProcesses.size;
  }

  /**
   * Check if we're at the maximum concurrent process limit
   */
  isAtMaxCapacity(): boolean {
    const maxConcurrent = this.config.maxConcurrent || 3;
    return this.activeProcesses.size >= maxConcurrent;
  }

  /**
   * Kill a specific process
   */
  killProcess(taskId: string): boolean {
    const process = this.activeProcesses.get(taskId);
    if (!process) {
      return false;
    }

    if (!process.killed) {
      process.kill('SIGTERM');

      // Force kill after timeout if process doesn't respond
      this.timerService.schedule(() => {
        if (!process.killed) {
          process.kill('SIGKILL');
        }
      }, 5000);
    }

    this.unregisterProcess(taskId);
    this.emit('process-killed', { taskId });
    return true;
  }

  /**
   * Kill all active processes
   */
  killAllProcesses(): void {
    const taskIds = Array.from(this.activeProcesses.keys());
    for (const taskId of taskIds) {
      this.killProcess(taskId);
    }
  }

  /**
   * Start heartbeat monitoring for a process
   */
  private startHeartbeatMonitoring(taskId: string, process: ChildProcess): void {
    // Use new heartbeat monitoring system
    this.heartbeatAdapter.startMonitoring(taskId, process);

    // Keep legacy heartbeat object for backward compatibility during transition
    const currentTime = this.timerService.getCurrentTime();
    const heartbeat: ProcessHeartbeat = {
      taskId,
      process,
      lastActivity: new Date(currentTime),
      stdoutBytes: 0,
      stderrBytes: 0,
      startTime: new Date(currentTime),
      warningThresholds: new Set([50, 75, 90]),
      lastStdinCheck: new Date(currentTime),
      isWaitingForInput: false,
      consecutiveSlowChecks: 0,
      progressHistory: [],
    };

    this.processHeartbeats.set(taskId, heartbeat);

    // Start process monitoring if we have a valid PID
    if (process.pid) {
      this.processMonitor.startMonitoring(process.pid);
    }
  }

  /**
   * Stop heartbeat monitoring for a process
   */
  private stopHeartbeatMonitoring(taskId: string): void {
    // Use new heartbeat monitoring system
    this.heartbeatAdapter.stopMonitoring(taskId);

    // Clean up legacy heartbeat object
    const heartbeat = this.processHeartbeats.get(taskId);
    if (heartbeat) {
      // Stop process monitoring if we have a valid PID
      if (heartbeat.process.pid) {
        this.processMonitor.stopMonitoring(heartbeat.process.pid);
      }

      if (heartbeat.checkInterval) {
        heartbeat.checkInterval.cancel();
      }
      if (heartbeat.timeoutProgress) {
        heartbeat.timeoutProgress.cancel();
      }
      this.processHeartbeats.delete(taskId);
    }
  }

  /**
   * Update activity timestamp for a process
   */
  updateProcessActivity(taskId: string, bytesReceived: number, progressMarker?: string): void {
    const heartbeat = this.processHeartbeats.get(taskId);
    if (!heartbeat) {
      return;
    }

    const currentTime = this.timerService.getCurrentTime();
    const now = new Date(currentTime);

    heartbeat.lastActivity = now;

    if (progressMarker) {
      heartbeat.lastProgressMarker = progressMarker;
    }

    // Track progress history
    if (heartbeat.progressHistory) {
      const entry: { timestamp: Date; bytes: number; marker?: string } = {
        timestamp: now,
        bytes: bytesReceived,
      };
      if (progressMarker) {
        entry.marker = progressMarker;
      }
      heartbeat.progressHistory.push(entry);

      // Keep only last 50 progress entries
      if (heartbeat.progressHistory.length > 50) {
        heartbeat.progressHistory = heartbeat.progressHistory.slice(-50);
      }
    }

    // Reset slow check counter on activity
    heartbeat.consecutiveSlowChecks = 0;
  }

  /**
   * Detect progress markers in process output
   */
  detectProgressMarker(taskId: string, output: string): string | undefined {
    // Common progress markers in Claude CLI output
    const progressPatterns = [
      /Processing request\.\.\./,
      /Generating response\.\.\./,
      /Analysis complete/,
      /Test generation started/,
      /Writing output/,
    ];

    for (const pattern of progressPatterns) {
      const match = output.match(pattern);
      if (match) {
        this.updateProcessActivity(taskId, output.length, match[0]);
        return match[0];
      }
    }

    return undefined;
  }

  /**
   * Capture resource usage for a process
   */
  async captureResourceUsage(taskId: string): Promise<ProcessResourceUsage | null> {
    const heartbeat = this.processHeartbeats.get(taskId);
    if (!heartbeat?.process.pid) {
      return null;
    }

    try {
      const usage = this.processMonitor.getResourceUsage(heartbeat.process.pid);
      if (usage) {
        heartbeat.resourceUsage = usage;

        // Emit warning if resource usage is high
        if (usage.memory > 80) {
          // 80% memory threshold
          this.emit('resource-warning', { taskId, usage });
        }
      }

      return usage;
    } catch (error) {
      // Process might have ended, return null
      return null;
    }
  }

  /**
   * Get health metrics for all active processes
   */
  async getHealthMetrics(): Promise<Map<string, ProcessHealthMetrics>> {
    const metrics = new Map<string, ProcessHealthMetrics>();

    for (const [taskId, heartbeat] of this.processHeartbeats.entries()) {
      if (heartbeat.process.pid) {
        try {
          const health = await this.processMonitor.getHealthMetrics(heartbeat.process.pid);
          metrics.set(taskId, health);
        } catch (error) {
          // Process might have ended, skip
        }
      }
    }

    return metrics;
  }

  /**
   * Clean up all resources
   */
  cleanup(): void {
    this.killAllProcesses();
    this.processMonitor.stopAll();
    this.removeAllListeners();
  }
}
