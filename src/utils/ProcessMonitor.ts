/**
 * Process Monitor Utility
 *
 * Cross-platform process monitoring for detecting resource usage,
 * zombie processes, and subprocess health issues.
 */

import { execSync } from 'child_process';
import { logger } from './logger';

export interface ProcessResourceUsage {
  pid: number;
  cpu: number; // CPU usage percentage
  memory: number; // Memory usage percentage
  rss?: number; // Resident Set Size in KB
  vsz?: number; // Virtual Memory Size in KB
  state?: string; // Process state (R, S, D, Z, etc.)
  ppid?: number; // Parent Process ID
  command?: string; // Process command
}

export interface ProcessHealthMetrics {
  isAlive: boolean;
  isZombie: boolean;
  isHighResource: boolean;
  resourceUsage?: ProcessResourceUsage;
  healthScore: number; // 0-100 score
  warnings: string[];
  recommendations: string[];
}

export interface ProcessMonitorConfig {
  cpuThreshold: number; // CPU % threshold for alerts (default: 80)
  memoryThreshold: number; // Memory % threshold for alerts (default: 80)
  checkInterval: number; // Monitoring interval in ms (default: 30000)
  maxHistory: number; // Max history entries to keep (default: 100)
  zombieDetection: boolean; // Enable zombie process detection (default: true)
}

interface HistoryEntry {
  timestamp: Date;
  resourceUsage: ProcessResourceUsage;
  healthScore: number;
}

export class ProcessMonitor {
  private readonly config: Required<ProcessMonitorConfig>;
  private history = new Map<number, HistoryEntry[]>();
  private monitoring = new Set<number>();
  private intervals = new Map<number, NodeJS.Timeout>();

  constructor(config: Partial<ProcessMonitorConfig> = {}) {
    this.config = {
      cpuThreshold: 80,
      memoryThreshold: 80,
      checkInterval: 30000,
      maxHistory: 100,
      zombieDetection: true,
      ...config,
    };
  }

  /**
   * Start monitoring a process
   */
  startMonitoring(pid: number): void {
    if (this.monitoring.has(pid)) {
      logger.debug(`Already monitoring process ${pid}`);
      return;
    }

    this.monitoring.add(pid);
    this.history.set(pid, []);

    // Set up periodic monitoring
    const interval = setInterval(() => {
      this.checkProcess(pid);
    }, this.config.checkInterval);

    this.intervals.set(pid, interval);

    // Run initial check immediately
    this.checkProcess(pid);

    logger.debug(`Started monitoring process ${pid}`);
  }

  /**
   * Stop monitoring a process
   */
  stopMonitoring(pid: number): void {
    if (!this.monitoring.has(pid)) {
      return;
    }

    const interval = this.intervals.get(pid);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(pid);
    }

    this.monitoring.delete(pid);
    logger.debug(`Stopped monitoring process ${pid}`);
  }

  /**
   * Get current resource usage for a process
   */
  getResourceUsage(pid: number): ProcessResourceUsage | null {
    try {
      const usage = this.captureResourceUsage(pid);
      return usage;
    } catch (error) {
      logger.debug(`Failed to get resource usage for PID ${pid}: ${error}`);
      return null;
    }
  }

  /**
   * Get health metrics for a process
   */
  getHealthMetrics(pid: number): ProcessHealthMetrics {
    const resourceUsage = this.getResourceUsage(pid);
    const history = this.history.get(pid) || [];

    if (!resourceUsage) {
      return {
        isAlive: false,
        isZombie: false,
        isHighResource: false,
        healthScore: 0,
        warnings: ['Process not found or not accessible'],
        recommendations: ['Process may have terminated or requires elevated permissions'],
      };
    }

    const metrics = this.analyzeHealth(resourceUsage, history);
    return metrics;
  }

  /**
   * Get historical data for a process
   */
  getHistory(pid: number): HistoryEntry[] {
    return [...(this.history.get(pid) || [])];
  }

  /**
   * Detect zombie processes system-wide
   */
  detectZombieProcesses(): ProcessResourceUsage[] {
    if (!this.config.zombieDetection) {
      return [];
    }

    try {
      // Look for processes in zombie state
      const zombies = this.findZombieProcesses();

      if (zombies.length > 0) {
        logger.warn(`Detected ${zombies.length} zombie processes`);
      }

      return zombies;
    } catch (error) {
      logger.debug(`Failed to detect zombie processes: ${error}`);
      return [];
    }
  }

  /**
   * Get monitoring status
   */
  getMonitoringStatus(): {
    activeProcesses: number[];
    totalHistory: number;
    configuration: ProcessMonitorConfig;
  } {
    const totalHistory = Array.from(this.history.values()).reduce(
      (sum, entries) => sum + entries.length,
      0
    );

    return {
      activeProcesses: Array.from(this.monitoring),
      totalHistory,
      configuration: this.config,
    };
  }

  /**
   * Stop all monitoring
   */
  stopAll(): void {
    for (const pid of this.monitoring) {
      this.stopMonitoring(pid);
    }
    this.history.clear();
  }

  /**
   * Private method to check a single process
   */
  private checkProcess(pid: number): void {
    try {
      const resourceUsage = this.captureResourceUsage(pid);
      if (!resourceUsage) {
        // Process no longer exists
        this.stopMonitoring(pid);
        return;
      }

      const history = this.history.get(pid) || [];
      const healthMetrics = this.analyzeHealth(resourceUsage, history);

      // Add to history
      const entry: HistoryEntry = {
        timestamp: new Date(),
        resourceUsage,
        healthScore: healthMetrics.healthScore,
      };

      history.push(entry);

      // Trim history if needed
      if (history.length > this.config.maxHistory) {
        history.splice(0, history.length - this.config.maxHistory);
      }

      this.history.set(pid, history);

      // Log warnings if any
      if (healthMetrics.warnings.length > 0) {
        logger.warn(`Process ${pid} health warnings: ${healthMetrics.warnings.join(', ')}`);
      }

      // Emit events for high resource usage
      if (healthMetrics.isHighResource) {
        logger.warn(
          `Process ${pid} high resource usage: CPU=${resourceUsage.cpu}%, Memory=${resourceUsage.memory}%`
        );
      }

      if (healthMetrics.isZombie) {
        logger.error(`Process ${pid} is in zombie state`);
      }
    } catch (error) {
      logger.debug(`Error checking process ${pid}: ${error}`);
      // Process might have terminated
      this.stopMonitoring(pid);
    }
  }

  /**
   * Capture detailed resource usage for a process
   */
  private captureResourceUsage(pid: number): ProcessResourceUsage | null {
    try {
      // Try to get detailed process info using ps command
      // Use cross-platform ps options for better compatibility
      const psCommand =
        process.platform === 'darwin'
          ? `ps -p ${pid} -o pid,ppid,%cpu,%mem,rss,vsz,state,comm`
          : `ps -p ${pid} -o pid,ppid,%cpu,%mem,rss,vsz,stat,comm 2>/dev/null`;

      const psOutput = execSync(psCommand, {
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim();

      if (!psOutput) {
        return null;
      }

      const lines = psOutput.split('\n');
      if (lines.length < 2) {
        return null;
      }

      // Parse the data line (skip header)
      const dataLine = lines[1]?.trim();
      if (!dataLine) {
        return null;
      }

      const fields = dataLine.split(/\s+/);

      if (fields.length < 8) {
        // Fallback to basic CPU/Memory only
        return this.getBasicResourceUsage(pid);
      }

      const parsedPid = fields[0] ? parseInt(fields[0]) : pid;
      const parsedPpid = fields[1] ? parseInt(fields[1]) : undefined;
      const parsedCpu = fields[2] ? parseFloat(fields[2]) : 0;
      const parsedMemory = fields[3] ? parseFloat(fields[3]) : 0;
      const parsedRss = fields[4] ? parseInt(fields[4]) : undefined;
      const parsedVsz = fields[5] ? parseInt(fields[5]) : undefined;
      const parsedState = fields[6] || undefined;
      const parsedCommand = fields.slice(7).join(' ') || undefined;

      return {
        pid: parsedPid || pid,
        cpu: parsedCpu,
        memory: parsedMemory,
        ...(parsedPpid !== undefined && { ppid: parsedPpid }),
        ...(parsedRss !== undefined && { rss: parsedRss }),
        ...(parsedVsz !== undefined && { vsz: parsedVsz }),
        ...(parsedState && { state: parsedState }),
        ...(parsedCommand && { command: parsedCommand }),
      };
    } catch (error) {
      logger.debug(`Failed to capture detailed resource usage for PID ${pid}: ${error}`);
      // Fallback to basic resource usage
      return this.getBasicResourceUsage(pid);
    }
  }

  /**
   * Fallback method for basic resource usage (compatible with existing code)
   */
  private getBasicResourceUsage(pid: number): ProcessResourceUsage | null {
    try {
      const psOutput = execSync(`ps -p ${pid} -o %cpu,%mem 2>/dev/null || echo ""`, {
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim();

      if (!psOutput) {
        return null;
      }

      const lines = psOutput.split('\n');
      if (lines.length > 1 && lines[1]) {
        const stats = lines[1].trim().split(/\s+/);
        if (stats.length >= 2 && stats[0] && stats[1]) {
          return {
            pid,
            cpu: parseFloat(stats[0]) || 0,
            memory: parseFloat(stats[1]) || 0,
          };
        }
      }

      return null;
    } catch (error) {
      logger.debug(`Failed to get basic resource usage for PID ${pid}: ${error}`);
      return null;
    }
  }

  /**
   * Find zombie processes system-wide
   */
  private findZombieProcesses(): ProcessResourceUsage[] {
    try {
      // Look for processes with zombie state
      const psCommand =
        process.platform === 'darwin'
          ? `ps -A -o pid,ppid,%cpu,%mem,state,comm | grep " Z "`
          : `ps -A -o pid,ppid,%cpu,%mem,stat,comm | grep " Z"`;

      const psOutput = execSync(psCommand, {
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim();

      if (!psOutput) {
        return [];
      }

      const zombies: ProcessResourceUsage[] = [];
      const lines = psOutput.split('\n');

      for (const line of lines) {
        const fields = line.trim().split(/\s+/);
        if (fields.length >= 6) {
          const parsedPid = fields[0] ? parseInt(fields[0]) : 0;
          const parsedPpid = fields[1] ? parseInt(fields[1]) : undefined;
          const parsedCpu = fields[2] ? parseFloat(fields[2]) : 0;
          const parsedMemory = fields[3] ? parseFloat(fields[3]) : 0;
          const parsedState = fields[4] || 'Z';
          const parsedCommand = fields.slice(5).join(' ') || 'zombie';

          zombies.push({
            pid: parsedPid,
            cpu: parsedCpu,
            memory: parsedMemory,
            state: parsedState,
            command: parsedCommand,
            ...(parsedPpid !== undefined && { ppid: parsedPpid }),
          });
        }
      }

      return zombies;
    } catch (error) {
      // ps command might fail if no zombies or insufficient permissions
      logger.debug(`Failed to find zombie processes: ${error}`);
      return [];
    }
  }

  /**
   * Analyze process health based on current and historical data
   */
  private analyzeHealth(
    current: ProcessResourceUsage,
    history: HistoryEntry[]
  ): ProcessHealthMetrics {
    const warnings: string[] = [];
    const recommendations: string[] = [];
    let healthScore = 100;

    // Check if process is alive
    const isAlive = current.pid > 0;
    if (!isAlive) {
      return {
        isAlive: false,
        isZombie: false,
        isHighResource: false,
        healthScore: 0,
        warnings: ['Process not accessible'],
        recommendations: ['Check if process exists and permissions'],
      };
    }

    // Check for zombie state
    const isZombie = current.state === 'Z' || current.state?.includes('Z') || false;
    if (isZombie) {
      healthScore -= 50;
      warnings.push('Process is in zombie state');
      recommendations.push('Parent process should reap zombie child');
    }

    // Check CPU usage
    const isHighCpu = current.cpu > this.config.cpuThreshold;
    if (isHighCpu) {
      healthScore -= 20;
      warnings.push(`High CPU usage: ${current.cpu.toFixed(1)}%`);
      if (current.cpu > 95) {
        recommendations.push('Consider reducing workload or increasing timeout');
      }
    }

    // Check memory usage
    const isHighMemory = current.memory > this.config.memoryThreshold;
    if (isHighMemory) {
      healthScore -= 20;
      warnings.push(`High memory usage: ${current.memory.toFixed(1)}%`);
      if (current.memory > 95) {
        recommendations.push('Monitor for memory leaks or increase available memory');
      }
    }

    // Analyze trends if we have history
    if (history.length >= 3) {
      const recentEntries = history.slice(-3);
      const cpuTrend = this.calculateTrend(recentEntries.map((e) => e.resourceUsage.cpu));
      const memoryTrend = this.calculateTrend(recentEntries.map((e) => e.resourceUsage.memory));

      if (cpuTrend > 10) {
        healthScore -= 10;
        warnings.push('CPU usage trending upward');
      }

      if (memoryTrend > 10) {
        healthScore -= 10;
        warnings.push('Memory usage trending upward');
        recommendations.push('Monitor for memory leaks');
      }
    }

    // Check for stale process (no state information)
    if (!current.state && current.cpu === 0 && current.memory === 0) {
      healthScore -= 30;
      warnings.push('Process appears stale or unresponsive');
      recommendations.push('Check if process is actually running');
    }

    const isHighResource = isHighCpu || isHighMemory;

    return {
      isAlive,
      isZombie,
      isHighResource,
      resourceUsage: current,
      healthScore: Math.max(0, healthScore),
      warnings,
      recommendations,
    };
  }

  /**
   * Calculate trend in a series of values
   */
  private calculateTrend(values: number[]): number {
    if (values.length < 2) return 0;

    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));

    const firstAvg = firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length;

    return secondAvg - firstAvg;
  }
}
