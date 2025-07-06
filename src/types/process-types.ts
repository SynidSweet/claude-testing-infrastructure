/**
 * Process Management Types
 * 
 * Type definitions for centralized process management across components
 */

import { ChildProcess } from 'child_process';

export interface ProcessLimits {
  maxClaude: number;
  maxTestRunner: number;
  maxTotal: number;
  warningThreshold: number;
}

export interface ProcessInfo {
  id: string;
  type: 'claude' | 'jest' | 'pytest' | 'other';
  component: string;
  process: ChildProcess;
  startTime: Date;
  lastActivity?: Date;
  resourceUsage?: {
    cpu: number;
    memory: number;
  };
}

export interface ProcessReservation {
  id: string;
  type: ProcessInfo['type'];
  component: string;
  reserved: boolean;
  reservedAt: Date;
  expiresAt: Date;
}

export interface ProcessManagerStats {
  activeProcesses: number;
  activeClaude: number;
  activeTestRunners: number;
  totalSpawned: number;
  emergencyShutdowns: number;
  reservations: number;
  failedReservations: number;
}

export interface ProcessManagerEvents {
  'process-registered': (processInfo: ProcessInfo) => void;
  'process-unregistered': (processInfo: ProcessInfo) => void;
  'approaching-limit': (data: {
    current: { total: number; claude: number; testRunners: number; other: number };
    projected: { total: number; claude: number; testRunners: number };
    limits: ProcessLimits;
  }) => void;
  'emergency-shutdown': (data: { reason: string; processCount: number }) => void;
}

export interface ProcessManagerConfig {
  limits?: Partial<ProcessLimits>;
  reservationTimeout?: number;
  cleanupInterval?: number;
}

/**
 * Execution context for AI processes
 * 
 * This enum enforces boundaries between different types of process spawning:
 * - USER_INITIATED: Direct user commands
 * - TEST_GENERATION: AI-powered test generation 
 * - VALIDATION_TEST: Infrastructure validation tests
 * - INTERNAL_TEST: Internal infrastructure testing
 */
export enum ProcessContext {
  /**
   * User-initiated AI processes (normal operation)
   * Can spawn AI processes freely for test generation
   */
  USER_INITIATED = 'user_initiated',

  /**
   * AI test generation context
   * Can spawn processes for generating tests for external projects
   * Cannot spawn processes for infrastructure testing
   */
  TEST_GENERATION = 'test_generation',

  /**
   * Validation test context
   * Cannot spawn real AI processes - must use mocks
   * Used for infrastructure validation and CI/CD
   */
  VALIDATION_TEST = 'validation_test',

  /**
   * Internal test context  
   * Cannot spawn any processes
   * Used for unit tests and internal infrastructure testing
   */
  INTERNAL_TEST = 'internal_test'
}

/**
 * Process context validation result
 */
export interface ProcessContextValidation {
  /** Whether the operation is allowed in this context */
  allowed: boolean;
  /** Reason if operation is not allowed */
  reason?: string;
  /** Suggested alternative action */
  suggestion?: string;
}

/**
 * Process context validator interface
 */
export interface IProcessContextValidator {
  /**
   * Validate if AI process spawning is allowed in the current context
   */
  validateAIProcessSpawn(context: ProcessContext, targetPath?: string): ProcessContextValidation;

  /**
   * Validate if test generation is allowed in the current context
   */
  validateTestGeneration(context: ProcessContext, targetPath?: string): ProcessContextValidation;

  /**
   * Get human-readable context description
   */
  getContextDescription(context: ProcessContext): string;
}