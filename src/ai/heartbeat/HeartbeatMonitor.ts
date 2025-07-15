/**
 * Heartbeat Monitor - Facade that coordinates health monitoring
 *
 * This module combines the scheduler and analyzer to provide
 * a complete heartbeat monitoring solution with backward compatibility.
 */

import { EventEmitter } from 'events';
import { ChildProcess } from 'child_process';
import { HeartbeatScheduler, SchedulerConfig } from './HeartbeatScheduler';
import {
  ProcessHealthAnalyzer,
  ProcessMetrics,
  HealthStatus,
  HealthAnalysisConfig,
  OutputEntry,
} from './ProcessHealthAnalyzer';
import { ProcessMonitor } from '../../utils/ProcessMonitor';
import { TestableTimer } from '../../types/timer-types';

export interface MonitoredProcess {
  taskId: string;
  pid: number;
  startTime: number;
  outputs: OutputEntry[];
  errors: OutputEntry[];
  lastHealthCheck?: number;
  lastHealthStatus?: HealthStatus;
  progressMarkerCount: number;
  terminationRequested: boolean;
}

export interface HeartbeatMonitorConfig {
  scheduler: SchedulerConfig;
  analysis: HealthAnalysisConfig;
  enableLogging?: boolean;
}

export interface HeartbeatEvents {
  healthCheck: (taskId: string, status: HealthStatus) => void;
  unhealthy: (taskId: string, status: HealthStatus) => void;
  warning: (taskId: string, warnings: string[]) => void;
  terminated: (taskId: string, reason: string) => void;
  error: (taskId: string, error: Error) => void;
  progress: (taskId: string, markers: number) => void;
}

export interface HeartbeatMonitor {
  on<K extends keyof HeartbeatEvents>(event: K, listener: HeartbeatEvents[K]): this;
  emit<K extends keyof HeartbeatEvents>(event: K, ...args: Parameters<HeartbeatEvents[K]>): boolean;
}

export class HeartbeatMonitor extends EventEmitter {
  private monitoredProcesses = new Map<string, MonitoredProcess>();
  private processMonitor: ProcessMonitor;

  constructor(
    private scheduler: HeartbeatScheduler,
    private config: HeartbeatMonitorConfig,
    _timerService: TestableTimer
  ) {
    super();
    this.processMonitor = new ProcessMonitor();
    // timerService is passed in but not directly used by HeartbeatMonitor
    // It's used by the scheduler which is injected
  }

  /**
   * Starts monitoring a process
   */
  startMonitoring(taskId: string, pid: number, childProcess?: ChildProcess): void {
    if (this.monitoredProcesses.has(taskId)) {
      this.stopMonitoring(taskId);
    }

    const process: MonitoredProcess = {
      taskId,
      pid,
      startTime: Date.now(),
      outputs: [],
      errors: [],
      progressMarkerCount: 0,
      terminationRequested: false,
    };

    this.monitoredProcesses.set(taskId, process);

    // Set up output capture if child process provided
    if (childProcess) {
      this.attachProcessListeners(taskId, childProcess);
    }

    // Schedule periodic health checks
    this.scheduler.scheduleChecks(taskId, () => {
      this.performHealthCheck(taskId).catch((error) => {
        this.emit('error', taskId, error as Error);
      });
    });

    if (this.config.enableLogging) {
      console.log(`[HeartbeatMonitor] Started monitoring task ${taskId} (PID: ${pid})`);
    }
  }

  /**
   * Stops monitoring a process
   */
  stopMonitoring(taskId: string): void {
    const process = this.monitoredProcesses.get(taskId);
    if (!process) return;

    this.scheduler.cancelAll(taskId);
    this.monitoredProcesses.delete(taskId);

    if (this.config.enableLogging) {
      console.log(`[HeartbeatMonitor] Stopped monitoring task ${taskId}`);
    }
  }

  /**
   * Stops monitoring all processes
   */
  stopAll(): void {
    for (const taskId of this.monitoredProcesses.keys()) {
      this.stopMonitoring(taskId);
    }
  }

  /**
   * Performs a health check for a process
   */
  private async performHealthCheck(taskId: string): Promise<void> {
    const process = this.monitoredProcesses.get(taskId);
    if (!process) return;

    try {
      // Collect current metrics
      const metrics = await this.collectMetrics(process);

      // Analyze health
      const status = ProcessHealthAnalyzer.analyzeHealth(metrics, this.config.analysis);

      // Update process state
      process.lastHealthCheck = Date.now();
      process.lastHealthStatus = status;

      // Emit health check event
      this.emit('healthCheck', taskId, status);

      // Handle unhealthy status
      if (!status.isHealthy) {
        this.emit('unhealthy', taskId, status);

        if (status.shouldTerminate && !process.terminationRequested) {
          process.terminationRequested = true;
          await this.terminateProcess(taskId, status.reason || 'Unhealthy process');
        }
      }

      // Emit warnings
      if (status.warnings.length > 0) {
        this.emit('warning', taskId, status.warnings);
      }
    } catch (error) {
      if (this.config.enableLogging) {
        console.error(`[HeartbeatMonitor] Health check failed for ${taskId}:`, error);
      }
      this.emit('error', taskId, error as Error);
    }
  }

  /**
   * Collects metrics for a process
   */
  private async collectMetrics(process: MonitoredProcess): Promise<ProcessMetrics> {
    // Get resource usage
    const usage = process.pid ? await this.processMonitor.getResourceUsage(process.pid) : undefined;

    // Calculate output rate
    const outputRate = ProcessHealthAnalyzer.calculateOutputRate(
      process.outputs,
      this.config.analysis.analysisWindowMs
    );

    // Check for input waiting
    const recentOutput = process.outputs
      .slice(-10)
      .map((o) => o.content)
      .join('\n');
    const isWaitingForInput = ProcessHealthAnalyzer.detectInputWait(recentOutput);

    // Get last output time
    const lastOutput = process.outputs[process.outputs.length - 1];
    const lastOutputTime = lastOutput ? lastOutput.timestamp : process.startTime;

    return {
      cpuPercent: usage?.cpu ?? 0,
      memoryMB: usage?.memory ?? 0,
      outputRate,
      lastOutputTime,
      errorCount: process.errors.length,
      processRuntime: Date.now() - process.startTime,
      progressMarkers: process.progressMarkerCount,
      isWaitingForInput,
    };
  }

  /**
   * Attaches listeners to capture process output
   */
  private attachProcessListeners(taskId: string, childProcess: ChildProcess): void {
    const process = this.monitoredProcesses.get(taskId);
    if (!process) return;

    // Capture stdout
    childProcess.stdout?.on('data', (data: Buffer) => {
      const content = data.toString();
      const timestamp = Date.now();

      process.outputs.push({ timestamp, content, isError: false });

      // Keep only recent outputs to prevent memory growth
      if (process.outputs.length > 1000) {
        process.outputs = process.outputs.slice(-500);
      }

      // Check for progress markers
      if (
        ProcessHealthAnalyzer.detectProgressMarkers(
          content,
          this.config.analysis.progressMarkerPatterns
        )
      ) {
        process.progressMarkerCount++;
        this.emit('progress', taskId, process.progressMarkerCount);
      }
    });

    // Capture stderr
    childProcess.stderr?.on('data', (data: Buffer) => {
      const content = data.toString();
      const timestamp = Date.now();

      process.errors.push({ timestamp, content, isError: true });

      // Keep only recent errors
      if (process.errors.length > 500) {
        process.errors = process.errors.slice(-250);
      }
    });
  }

  /**
   * Terminates a process
   */
  private async terminateProcess(taskId: string, reason: string): Promise<void> {
    const process = this.monitoredProcesses.get(taskId);
    if (!process) return;

    try {
      // Use Node's global process.kill with the PID
      global.process.kill(process.pid, 'SIGTERM');

      // Schedule SIGKILL as fallback
      this.scheduler.scheduleTimeout(
        taskId,
        () => {
          try {
            global.process.kill(process.pid, 'SIGKILL');
          } catch (error) {
            // Process might already be dead
          }
        },
        5000 // 5 seconds grace period
      );

      this.emit('terminated', taskId, reason);
    } catch (error) {
      if (this.config.enableLogging) {
        console.error(`[HeartbeatMonitor] Failed to terminate ${taskId}:`, error);
      }
      this.emit('error', taskId, error as Error);
    }
  }

  /**
   * Gets monitoring statistics
   */
  getStats(): {
    monitoredProcesses: number;
    schedulerStats: ReturnType<HeartbeatScheduler['getStats']>;
  } {
    return {
      monitoredProcesses: this.monitoredProcesses.size,
      schedulerStats: this.scheduler.getStats(),
    };
  }

  /**
   * Gets process information
   */
  getProcessInfo(taskId: string): MonitoredProcess | undefined {
    return this.monitoredProcesses.get(taskId);
  }

  /**
   * Checks if a task is being monitored
   */
  isMonitoring(taskId: string): boolean {
    return this.monitoredProcesses.has(taskId);
  }
}
