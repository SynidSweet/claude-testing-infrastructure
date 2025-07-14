/**
 * AI-specific error types for better error handling and user feedback
 */

import { ClaudeTestingError } from '../utils/error-handling';
import type { AITask, AITaskResult, AITaskBatch } from '../ai/AITaskPreparation';

/**
 * Base error class for AI-related operations
 */
export class AIError extends ClaudeTestingError {
  constructor(
    message: string,
    public readonly code: string,
    context: Record<string, unknown> = {}
  ) {
    super(message, { code, ...context });
    this.name = 'AIError';
    Object.setPrototypeOf(this, AIError.prototype);
  }
}

/**
 * Authentication error for Claude CLI
 */
export class AIAuthenticationError extends AIError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, 'AI_AUTH_ERROR', context);
    this.name = 'AIAuthenticationError';
    Object.setPrototypeOf(this, AIAuthenticationError.prototype);
  }
}

/**
 * Timeout error for AI operations
 */
export class AITimeoutError extends AIError {
  constructor(
    message: string,
    public readonly timeoutMs: number,
    context: Record<string, unknown> = {}
  ) {
    super(message, 'AI_TIMEOUT_ERROR', { timeoutMs, ...context });
    this.name = 'AITimeoutError';
    Object.setPrototypeOf(this, AITimeoutError.prototype);
  }
}

/**
 * Model configuration error
 */
export class AIModelError extends AIError {
  constructor(
    message: string,
    public readonly modelName: string,
    context: Record<string, unknown> = {}
  ) {
    super(message, 'AI_MODEL_ERROR', { modelName, ...context });
    this.name = 'AIModelError';
    Object.setPrototypeOf(this, AIModelError.prototype);
  }
}

/**
 * Rate limit error
 */
export class AIRateLimitError extends AIError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, 'AI_RATE_LIMIT_ERROR', context);
    this.name = 'AIRateLimitError';
    Object.setPrototypeOf(this, AIRateLimitError.prototype);
  }
}

/**
 * Network error for AI operations
 */
export class AINetworkError extends AIError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, 'AI_NETWORK_ERROR', context);
    this.name = 'AINetworkError';
    Object.setPrototypeOf(this, AINetworkError.prototype);
  }
}

/**
 * Workflow error for AI workflow operations
 */
export class AIWorkflowError extends AIError {
  constructor(
    message: string,
    public readonly phase: string,
    public readonly cause?: Error,
    context: Record<string, unknown> = {}
  ) {
    super(message, 'AI_WORKFLOW_ERROR', { phase, cause: cause?.message, ...context });
    this.name = 'AIWorkflowError';
    Object.setPrototypeOf(this, AIWorkflowError.prototype);
  }
}

/**
 * Task processing error for individual AI tasks
 */
export class AITaskError extends AIError {
  constructor(
    message: string,
    public readonly taskId: string,
    public readonly taskType: string,
    context: Record<string, unknown> = {}
  ) {
    super(message, 'AI_TASK_ERROR', { taskId, taskType, ...context });
    this.name = 'AITaskError';
    Object.setPrototypeOf(this, AITaskError.prototype);
  }
}

/**
 * JSON parsing error for AI responses
 */
export class AIResponseParseError extends AIError {
  constructor(
    message: string,
    public readonly rawOutput: string,
    context: Record<string, unknown> = {}
  ) {
    super(message, 'AI_RESPONSE_PARSE_ERROR', {
      rawOutput: rawOutput.substring(0, 200), // Limit context size
      ...context,
    });
    this.name = 'AIResponseParseError';
    Object.setPrototypeOf(this, AIResponseParseError.prototype);
  }
}

/**
 * Checkpoint error for AI task resumption
 */
export class AICheckpointError extends AIError {
  constructor(
    message: string,
    public readonly checkpointId: string,
    context: Record<string, unknown> = {}
  ) {
    super(message, 'AI_CHECKPOINT_ERROR', { checkpointId, ...context });
    this.name = 'AICheckpointError';
    Object.setPrototypeOf(this, AICheckpointError.prototype);
  }
}

/**
 * Progress update event
 */
export interface AIProgressUpdate {
  taskId: string;
  phase: 'authenticating' | 'preparing' | 'generating' | 'processing' | 'saving';
  progress: number; // 0-100
  message: string;
  estimatedTimeRemaining?: number; // in ms
  warning?: boolean; // Indicates this is a timeout warning update
}

/**
 * Type guard functions for AI errors
 */
export function isAIError(error: unknown): error is AIError {
  return error instanceof AIError;
}

export function isAIAuthenticationError(error: unknown): error is AIAuthenticationError {
  return error instanceof AIAuthenticationError;
}

export function isAITimeoutError(error: unknown): error is AITimeoutError {
  return error instanceof AITimeoutError;
}

export function isAIModelError(error: unknown): error is AIModelError {
  return error instanceof AIModelError;
}

export function isAIRateLimitError(error: unknown): error is AIRateLimitError {
  return error instanceof AIRateLimitError;
}

export function isAINetworkError(error: unknown): error is AINetworkError {
  return error instanceof AINetworkError;
}

export function isAIWorkflowError(error: unknown): error is AIWorkflowError {
  return error instanceof AIWorkflowError;
}

export function isAITaskError(error: unknown): error is AITaskError {
  return error instanceof AITaskError;
}

export function isAIResponseParseError(error: unknown): error is AIResponseParseError {
  return error instanceof AIResponseParseError;
}

export function isAICheckpointError(error: unknown): error is AICheckpointError {
  return error instanceof AICheckpointError;
}

/**
 * Node.js specific error type guard
 */
export function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return (
    error instanceof Error &&
    'code' in error &&
    typeof (error as NodeJS.ErrnoException).code === 'string'
  );
}

/**
 * Claude authentication result
 */
export type ClaudeAuthResult =
  | { authenticated: true }
  | { authenticated: false; error: AIAuthenticationError; canDegrade: boolean };

/**
 * Event data structures for AI operations
 */
export interface TaskEventData {
  task: AITask;
  result?: AITaskResult;
  error?: Error;
  degraded?: boolean;
}

export interface BatchEventData {
  batch?: AITaskBatch;
  results?: AITaskResult[];
  stats?: {
    totalTasks: number;
    completedTasks: number;
    failedTasks: number;
    totalTokens: number;
    totalCost: number;
    duration: number;
  };
}
