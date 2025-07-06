/**
 * Global Process Manager
 * 
 * Centralized process management to prevent runaway process scenarios.
 * Coordinates process spawning across all components (ClaudeOrchestrator, JestRunner, PytestRunner)
 * with hard limits and emergency shutdown capabilities.
 */

import { EventEmitter } from 'events';
import { ChildProcess } from 'child_process';
import { logger } from './logger';
import type {
  ProcessLimits,
  ProcessInfo,
  ProcessReservation,
  ProcessManagerStats,
  ProcessManagerEvents,
} from '../types/process-types';

export class GlobalProcessManager extends EventEmitter {
  declare emit: <K extends keyof ProcessManagerEvents>(
    event: K,
    ...args: Parameters<ProcessManagerEvents[K]>
  ) => boolean;
  
  declare on: <K extends keyof ProcessManagerEvents>(
    event: K,
    listener: ProcessManagerEvents[K]
  ) => this;
  private static instance: GlobalProcessManager | null = null;
  
  private readonly limits: ProcessLimits = {
    maxClaude: 5,        // Maximum Claude CLI processes
    maxTestRunner: 10,   // Maximum test runner processes (Jest/pytest)
    maxTotal: 12,        // Maximum total processes
    warningThreshold: 8, // Warning when approaching total limit
  };

  private activeProcesses = new Map<string, ProcessInfo>();
  private reservations = new Map<string, ProcessReservation>();
  private stats: ProcessManagerStats = {
    activeProcesses: 0,
    activeClaude: 0,
    activeTestRunners: 0,
    totalSpawned: 0,
    emergencyShutdowns: 0,
    reservations: 0,
    failedReservations: 0,
  };

  private cleanupInterval?: NodeJS.Timeout;
  private readonly RESERVATION_TIMEOUT = 30000; // 30 seconds
  private readonly CLEANUP_INTERVAL = 10000;    // 10 seconds

  constructor(customLimits?: Partial<ProcessLimits>) {
    super();
    
    if (customLimits) {
      this.limits = { ...this.limits, ...customLimits };
    }

    this.startCleanupTimer();
    this.setupProcessExitHandlers();
    
    logger.info('GlobalProcessManager initialized', {
      limits: this.limits,
    });
  }

  /**
   * Get singleton instance
   */
  static getInstance(customLimits?: Partial<ProcessLimits>): GlobalProcessManager {
    if (!GlobalProcessManager.instance) {
      GlobalProcessManager.instance = new GlobalProcessManager(customLimits);
    }
    return GlobalProcessManager.instance;
  }

  /**
   * Reserve a process slot before spawning
   */
  async reserveProcessSlot(
    type: ProcessInfo['type'],
    component: string,
    timeoutMs: number = this.RESERVATION_TIMEOUT
  ): Promise<{ success: true; reservationId: string } | { success: false; reason: string }> {
    const reservationId = `${component}-${type}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    
    // Check current limits
    const currentCounts = this.getCurrentCounts();
    const projected = this.getProjectedCounts(type, 1);
    
    // Validate against limits
    if (type === 'claude' && projected.claude > this.limits.maxClaude) {
      this.stats.failedReservations++;
      return {
        success: false,
        reason: `Claude process limit exceeded: ${projected.claude}/${this.limits.maxClaude}`,
      };
    }

    if ((type === 'jest' || type === 'pytest') && projected.testRunners > this.limits.maxTestRunner) {
      this.stats.failedReservations++;
      return {
        success: false,
        reason: `Test runner process limit exceeded: ${projected.testRunners}/${this.limits.maxTestRunner}`,
      };
    }

    if (projected.total > this.limits.maxTotal) {
      this.stats.failedReservations++;
      return {
        success: false,
        reason: `Total process limit exceeded: ${projected.total}/${this.limits.maxTotal}`,
      };
    }

    // Create reservation
    const reservation: ProcessReservation = {
      id: reservationId,
      type,
      component,
      reserved: true,
      reservedAt: new Date(),
      expiresAt: new Date(Date.now() + timeoutMs),
    };

    this.reservations.set(reservationId, reservation);
    this.stats.reservations++;

    // Warning threshold check
    if (projected.total >= this.limits.warningThreshold) {
      logger.warn(`⚠️  Approaching process limit: ${projected.total}/${this.limits.maxTotal} processes`);
      this.emit('approaching-limit', {
        current: currentCounts,
        projected,
        limits: this.limits,
      });
    }

    logger.debug(`Process slot reserved: ${reservationId}`, {
      type,
      component,
      currentCounts,
      projectedCounts: projected,
    });

    return { success: true, reservationId };
  }

  /**
   * Register a spawned process
   */
  registerProcess(
    reservationId: string,
    process: ChildProcess,
    processId?: string
  ): { success: true; processInfo: ProcessInfo } | { success: false; reason: string } {
    const reservation = this.reservations.get(reservationId);
    
    if (!reservation) {
      return {
        success: false,
        reason: `Reservation not found: ${reservationId}`,
      };
    }

    if (!reservation.reserved) {
      return {
        success: false,
        reason: `Reservation already used: ${reservationId}`,
      };
    }

    if (new Date() > reservation.expiresAt) {
      this.reservations.delete(reservationId);
      return {
        success: false,
        reason: `Reservation expired: ${reservationId}`,
      };
    }

    // Create process info
    const finalProcessId = processId || `${reservation.component}-${process.pid || 'unknown'}-${Date.now()}`;
    const processInfo: ProcessInfo = {
      id: finalProcessId,
      type: reservation.type,
      component: reservation.component,
      process,
      startTime: new Date(),
      lastActivity: new Date(),
    };

    // Register process
    this.activeProcesses.set(finalProcessId, processInfo);
    this.reservations.delete(reservationId);
    this.updateStats();

    // Set up process monitoring
    this.setupProcessMonitoring(processInfo);

    logger.info(`Process registered: ${finalProcessId}`, {
      type: processInfo.type,
      component: processInfo.component,
      pid: process.pid,
      activeCount: this.activeProcesses.size,
    });

    this.emit('process-registered', processInfo);

    return { success: true, processInfo };
  }

  /**
   * Unregister a process when it completes
   */
  unregisterProcess(processId: string): void {
    const processInfo = this.activeProcesses.get(processId);
    
    if (processInfo) {
      this.activeProcesses.delete(processId);
      this.updateStats();

      logger.info(`Process unregistered: ${processId}`, {
        type: processInfo.type,
        component: processInfo.component,
        duration: Date.now() - processInfo.startTime.getTime(),
        activeCount: this.activeProcesses.size,
      });

      this.emit('process-unregistered', processInfo);
    }
  }

  /**
   * Emergency shutdown - terminate all processes
   */
  emergencyShutdown(reason: string): void {
    logger.error(`🚨 GLOBAL PROCESS MANAGER EMERGENCY SHUTDOWN: ${reason}`);
    
    this.stats.emergencyShutdowns++;
    const processCount = this.activeProcesses.size;

    // Terminate all active processes
    for (const [processId, processInfo] of this.activeProcesses) {
      try {
        if (processInfo.process.pid && !processInfo.process.killed) {
          processInfo.process.kill('SIGKILL');
          logger.warn(`Emergency killed process: ${processId} (PID: ${processInfo.process.pid})`);
        }
      } catch (error) {
        logger.error(`Failed to emergency kill process ${processId}:`, error);
      }
    }

    // Clear all state
    this.activeProcesses.clear();
    this.reservations.clear();
    this.updateStats();

    logger.error(`Emergency shutdown completed. Terminated ${processCount} processes. Reason: ${reason}`);
    this.emit('emergency-shutdown', { reason, processCount });
  }

  /**
   * Get current process counts
   */
  getCurrentCounts(): { total: number; claude: number; testRunners: number; other: number } {
    const counts = { total: 0, claude: 0, testRunners: 0, other: 0 };
    
    for (const processInfo of this.activeProcesses.values()) {
      counts.total++;
      if (processInfo.type === 'claude') {
        counts.claude++;
      } else if (processInfo.type === 'jest' || processInfo.type === 'pytest') {
        counts.testRunners++;
      } else {
        counts.other++;
      }
    }

    return counts;
  }

  /**
   * Get projected counts after adding processes
   */
  private getProjectedCounts(type: ProcessInfo['type'], count: number): { total: number; claude: number; testRunners: number } {
    const current = this.getCurrentCounts();
    const reservedClaude = Array.from(this.reservations.values()).filter(r => r.type === 'claude').length;
    const reservedTestRunners = Array.from(this.reservations.values()).filter(r => r.type === 'jest' || r.type === 'pytest').length;
    
    return {
      total: current.total + reservedClaude + reservedTestRunners + count,
      claude: current.claude + reservedClaude + (type === 'claude' ? count : 0),
      testRunners: current.testRunners + reservedTestRunners + (type === 'jest' || type === 'pytest' ? count : 0),
    };
  }

  /**
   * Get process manager statistics
   */
  getStats(): ProcessManagerStats {
    return { ...this.stats };
  }

  /**
   * Get process limits
   */
  getLimits(): ProcessLimits {
    return { ...this.limits };
  }

  /**
   * Check if graceful degradation should be triggered
   */
  shouldGracefullyDegrade(): boolean {
    const counts = this.getCurrentCounts();
    return counts.total >= this.limits.warningThreshold;
  }

  /**
   * Update internal statistics
   */
  private updateStats(): void {
    const counts = this.getCurrentCounts();
    this.stats.activeProcesses = counts.total;
    this.stats.activeClaude = counts.claude;
    this.stats.activeTestRunners = counts.testRunners;
    this.stats.totalSpawned = this.stats.totalSpawned + 1;
  }

  /**
   * Set up process monitoring for lifecycle management
   */
  private setupProcessMonitoring(processInfo: ProcessInfo): void {
    const { process } = processInfo;

    // Monitor process exit
    process.on('exit', (code, signal) => {
      logger.debug(`Process exited: ${processInfo.id}`, { code, signal });
      this.unregisterProcess(processInfo.id);
    });

    process.on('error', (error) => {
      logger.error(`Process error: ${processInfo.id}`, error);
      this.unregisterProcess(processInfo.id);
    });

    // Update last activity on data
    process.stdout?.on('data', () => {
      processInfo.lastActivity = new Date();
    });

    process.stderr?.on('data', () => {
      processInfo.lastActivity = new Date();
    });
  }

  /**
   * Start periodic cleanup of expired reservations
   */
  private startCleanupTimer(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredReservations();
    }, this.CLEANUP_INTERVAL);
  }

  /**
   * Clean up expired reservations
   */
  private cleanupExpiredReservations(): void {
    const now = new Date();
    const expiredReservations: string[] = [];

    for (const [id, reservation] of this.reservations) {
      if (now > reservation.expiresAt) {
        expiredReservations.push(id);
      }
    }

    for (const id of expiredReservations) {
      this.reservations.delete(id);
      logger.debug(`Cleaned up expired reservation: ${id}`);
    }
  }

  /**
   * Set up process exit handlers for cleanup
   */
  private setupProcessExitHandlers(): void {
    const cleanup = () => {
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
      }
      // Emergency shutdown on exit
      if (this.activeProcesses.size > 0) {
        this.emergencyShutdown('Application exit');
      }
    };

    process.on('exit', cleanup);
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception, emergency shutdown:', error);
      cleanup();
    });
  }

  /**
   * Destroy the singleton instance (for testing)
   */
  static destroy(): void {
    if (GlobalProcessManager.instance) {
      if (GlobalProcessManager.instance.cleanupInterval) {
        clearInterval(GlobalProcessManager.instance.cleanupInterval);
      }
      GlobalProcessManager.instance.emergencyShutdown('Instance destroyed');
      GlobalProcessManager.instance = null;
    }
  }
}