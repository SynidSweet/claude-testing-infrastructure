/**
 * AI-specific error types for better error handling and user feedback
 */

/**
 * Base error class for AI-related operations
 */
export class AIError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'AIError';
  }
}

/**
 * Authentication error for Claude CLI
 */
export class AIAuthenticationError extends AIError {
  constructor(message: string) {
    super(message, 'AI_AUTH_ERROR');
    this.name = 'AIAuthenticationError';
  }
}

/**
 * Timeout error for AI operations
 */
export class AITimeoutError extends AIError {
  constructor(message: string, public readonly timeoutMs: number) {
    super(message, 'AI_TIMEOUT_ERROR');
    this.name = 'AITimeoutError';
  }
}

/**
 * Model configuration error
 */
export class AIModelError extends AIError {
  constructor(message: string, public readonly modelName: string) {
    super(message, 'AI_MODEL_ERROR');
    this.name = 'AIModelError';
  }
}

/**
 * Rate limit error
 */
export class AIRateLimitError extends AIError {
  constructor(message: string) {
    super(message, 'AI_RATE_LIMIT_ERROR');
    this.name = 'AIRateLimitError';
  }
}

/**
 * Network error for AI operations
 */
export class AINetworkError extends AIError {
  constructor(message: string) {
    super(message, 'AI_NETWORK_ERROR');
    this.name = 'AINetworkError';
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