/**
 * Resource Limit Wrapper
 *
 * Provides resource limits and timeout enforcement for test processes
 * with configurable CPU/memory limits and graceful shutdown handling.
 */

import { ChildProcess } from 'child_process';
import { logger } from './logger';
import { ProcessMonitor, ProcessResourceUsage, ProcessHealthMetrics } from './ProcessMonitor';

export interface ResourceLimitConfig {
  /** Maximum CPU usage percentage before warning (default: 80) */
  cpuWarnThreshold: number;
  /** Maximum CPU usage percentage before termination (default: 95) */
  cpuKillThreshold: number;
  /** Maximum memory usage percentage before warning (default: 80) */
  memoryWarnThreshold: number;
  /** Maximum memory usage percentage before termination (default: 95) */
  memoryKillThreshold: number;
  /** Maximum execution time in milliseconds (default: 300000 = 5 minutes) */
  executionTimeout: number;
  /** Warning time threshold in milliseconds (default: 240000 = 4 minutes) */
  warningTimeout: number;
  /** Resource check interval in milliseconds (default: 5000 = 5 seconds) */
  checkInterval: number;
  /** Number of consecutive violations before action (default: 3) */
  violationThreshold: number;
}

export interface ResourceLimitResult {
  /** Whether the process completed within limits */
  success: boolean;
  /** Exit code of the process */
  exitCode: number;
  /** Reason for termination if not successful */
  terminationReason: string | undefined;
  /** Final resource usage */
  finalResourceUsage: ProcessResourceUsage | undefined;
  /** Resource violations that occurred */
  violations: string[];
  /** Warnings that were issued */
  warnings: string[];
}

export class ResourceLimitWrapper {
  private readonly config: Required<ResourceLimitConfig>;
  private processMonitor: ProcessMonitor;

  constructor(config: Partial<ResourceLimitConfig> = {}) {
    this.config = {
      cpuWarnThreshold: 80,
      cpuKillThreshold: 95,
      memoryWarnThreshold: 80,
      memoryKillThreshold: 95,
      executionTimeout: 300000, // 5 minutes
      warningTimeout: 240000, // 4 minutes
      checkInterval: 5000, // 5 seconds
      violationThreshold: 3,
      ...config,
    };

    this.processMonitor = new ProcessMonitor({
      cpuThreshold: this.config.cpuWarnThreshold,
      memoryThreshold: this.config.memoryWarnThreshold,
      checkInterval: this.config.checkInterval,
    });
  }

  /**
   * Wrap a child process with resource limits and monitoring
   */
  async wrapProcess(
    process: ChildProcess,
    processName: string = 'test-process'
  ): Promise<ResourceLimitResult> {
    const pid = process.pid;
    const violations: string[] = [];
    const warnings: string[] = [];
    let terminated = false;
    let terminationReason: string | undefined;
    let finalResourceUsage: ProcessResourceUsage | undefined;

    if (!pid) {
      return {
        success: false,
        exitCode: 1,
        terminationReason: 'Failed to get process PID',
        finalResourceUsage: undefined,
        violations: ['Unable to monitor process without PID'],
        warnings: [],
      };
    }

    logger.info(`Starting resource monitoring for ${processName} (PID: ${pid})`, {
      config: this.config,
    });

    // Start monitoring the process
    this.processMonitor.startMonitoring(pid);

    // Set up resource violation tracking
    let consecutiveCpuViolations = 0;
    let consecutiveMemoryViolations = 0;

    // Set up periodic resource checks
    const resourceCheckInterval = setInterval(() => {
      if (terminated) {
        clearInterval(resourceCheckInterval);
        return;
      }

      const healthMetrics = this.processMonitor.getHealthMetrics(pid);
      
      if (!healthMetrics.isAlive) {
        logger.debug(`Process ${pid} is no longer alive, stopping monitoring`);
        clearInterval(resourceCheckInterval);
        return;
      }

      this.checkResourceViolations(
        healthMetrics,
        processName,
        violations,
        warnings,
        consecutiveCpuViolations,
        consecutiveMemoryViolations,
        () => {
          if (!terminated) {
            terminated = true;
            terminationReason = 'Resource limit exceeded';
            this.terminateProcess(process, 'Resource limit exceeded');
          }
        }
      );
    }, this.config.checkInterval);

    // Set up execution timeout
    const warningTimer = setTimeout(() => {
      if (!terminated) {
        warnings.push(`Process approaching timeout (${this.config.warningTimeout}ms)`);
        logger.warn(`Process ${pid} approaching timeout`, {
          processName,
          elapsed: this.config.warningTimeout,
          maxTimeout: this.config.executionTimeout,
        });
      }
    }, this.config.warningTimeout);

    const killTimer = setTimeout(() => {
      if (!terminated) {
        terminated = true;
        terminationReason = 'Execution timeout exceeded';
        violations.push(`Execution timeout exceeded (${this.config.executionTimeout}ms)`);
        this.terminateProcess(process, 'Execution timeout exceeded');
      }
    }, this.config.executionTimeout);

    // Wait for process completion
    const exitResult = await new Promise<{ exitCode: number }>((resolve) => {
      process.on('exit', (code) => {
        resolve({ exitCode: code || 0 });
      });

      process.on('error', (error) => {
        logger.error(`Process ${pid} error:`, error);
        resolve({ exitCode: 1 });
      });
    });

    // Cleanup
    clearTimeout(warningTimer);
    clearTimeout(killTimer);
    clearInterval(resourceCheckInterval);

    // Get final resource usage
    const resourceUsage = this.processMonitor.getResourceUsage(pid);
    finalResourceUsage = resourceUsage || undefined;
    this.processMonitor.stopMonitoring(pid);

    const success = !terminated && exitResult.exitCode === 0;

    logger.info(`Resource monitoring completed for ${processName}`, {
      pid,
      success,
      exitCode: exitResult.exitCode,
      terminationReason,
      violations: violations.length,
      warnings: warnings.length,
    });

    return {
      success,
      exitCode: exitResult.exitCode,
      terminationReason: terminationReason || undefined,
      finalResourceUsage,
      violations,
      warnings,
    };
  }

  /**
   * Check for resource violations and take action if needed
   */
  private checkResourceViolations(
    healthMetrics: ProcessHealthMetrics,
    processName: string,
    violations: string[],
    warnings: string[],
    consecutiveCpuViolations: number,
    consecutiveMemoryViolations: number,
    terminateCallback: () => void
  ): void {
    const usage = healthMetrics.resourceUsage;
    if (!usage) return;

    const pid = usage.pid;

    // Check CPU violations
    if (usage.cpu > this.config.cpuKillThreshold) {
      consecutiveCpuViolations++;
      if (consecutiveCpuViolations >= this.config.violationThreshold) {
        violations.push(`CPU usage exceeded kill threshold: ${usage.cpu.toFixed(1)}% > ${this.config.cpuKillThreshold}%`);
        logger.error(`Process ${pid} exceeded CPU kill threshold`, {
          processName,
          cpu: usage.cpu,
          threshold: this.config.cpuKillThreshold,
          consecutiveViolations: consecutiveCpuViolations,
        });
        terminateCallback();
        return;
      }
    } else if (usage.cpu > this.config.cpuWarnThreshold) {
      warnings.push(`High CPU usage: ${usage.cpu.toFixed(1)}%`);
      logger.warn(`Process ${pid} high CPU usage`, {
        processName,
        cpu: usage.cpu,
        threshold: this.config.cpuWarnThreshold,
      });
    } else {
      consecutiveCpuViolations = 0;
    }

    // Check memory violations
    if (usage.memory > this.config.memoryKillThreshold) {
      consecutiveMemoryViolations++;
      if (consecutiveMemoryViolations >= this.config.violationThreshold) {
        violations.push(`Memory usage exceeded kill threshold: ${usage.memory.toFixed(1)}% > ${this.config.memoryKillThreshold}%`);
        logger.error(`Process ${pid} exceeded memory kill threshold`, {
          processName,
          memory: usage.memory,
          threshold: this.config.memoryKillThreshold,
          consecutiveViolations: consecutiveMemoryViolations,
        });
        terminateCallback();
        return;
      }
    } else if (usage.memory > this.config.memoryWarnThreshold) {
      warnings.push(`High memory usage: ${usage.memory.toFixed(1)}%`);
      logger.warn(`Process ${pid} high memory usage`, {
        processName,
        memory: usage.memory,
        threshold: this.config.memoryWarnThreshold,
      });
    } else {
      consecutiveMemoryViolations = 0;
    }

    // Check for zombie processes
    if (healthMetrics.isZombie) {
      violations.push('Process is in zombie state');
      logger.error(`Process ${pid} is in zombie state`, { processName });
    }
  }

  /**
   * Gracefully terminate a process
   */
  private terminateProcess(process: ChildProcess, reason: string): void {
    const pid = process.pid;
    
    if (!pid || process.killed) {
      return;
    }

    logger.warn(`Terminating process ${pid}: ${reason}`);

    try {
      // First try graceful termination
      process.kill('SIGTERM');
      
      // Force kill after 5 seconds if still running
      setTimeout(() => {
        if (!process.killed && process.pid) {
          logger.warn(`Force killing process ${process.pid} after graceful termination timeout`);
          process.kill('SIGKILL');
        }
      }, 5000);
    } catch (error) {
      logger.error(`Failed to terminate process ${pid}:`, error);
      try {
        // Try force kill as fallback
        process.kill('SIGKILL');
      } catch (killError) {
        logger.error(`Failed to force kill process ${pid}:`, killError);
      }
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): Required<ResourceLimitConfig> {
    return { ...this.config };
  }

  /**
   * Stop all monitoring
   */
  destroy(): void {
    this.processMonitor.stopAll();
  }
}