/**
 * Enhanced stderr parser for early error detection in Claude CLI output
 * 
 * Provides real-time parsing of stderr to detect and categorize errors quickly,
 * enabling early termination of failing processes and better error reporting.
 */

import { EventEmitter } from 'events';
import { logger } from './logger';
import {
  AIAuthenticationError,
  AINetworkError,
  AIRateLimitError,
  AIModelError,
  AIError,
} from '../types/ai-error-types';

/**
 * Error pattern definitions for Claude CLI stderr
 */
interface ErrorPattern {
  patterns: RegExp[];
  errorType: 'auth' | 'network' | 'rateLimit' | 'model' | 'generic';
  createError: (match: string) => Error;
  severity: 'fatal' | 'warning';
}

/**
 * Parsed error information
 */
export interface ParsedError {
  type: string;
  error: Error;
  severity: 'fatal' | 'warning';
  raw: string;
  timestamp: Date;
}

/**
 * Stderr parser for Claude CLI output
 */
export class StderrParser {
  private buffer = '';
  private errors: ParsedError[] = [];
  private readonly patterns: ErrorPattern[] = [
    // Check specific status codes and service errors first
    {
      patterns: [
        /500\s+internal\s+server\s+error/i,
        /internal\s+server\s+error/i,
        /service\s+temporarily\s+unavailable/i,
        /service\s+unavailable/i,
        /service\s+degraded/i,
      ],
      errorType: 'generic',
      createError: (match) => new AIError(
        `API error detected: ${match}. The service may be temporarily unavailable.`,
        'AI_SERVICE_ERROR'
      ),
      severity: 'warning',
    },
    // Authentication errors
    {
      patterns: [
        /authentication.*failed/i,
        /not.*authenticated/i,
        /please.*login/i,
        /invalid.*credentials/i,
        /unauthorized/i,
        /claude.*auth.*login/i,
        /invalid.*api.*key/i,
        /missing.*api.*key/i,
      ],
      errorType: 'auth',
      createError: (match) => new AIAuthenticationError(
        `Authentication error detected: ${match}. Please run 'claude auth login' to authenticate.`
      ),
      severity: 'fatal',
    },
    // Network errors
    {
      patterns: [
        /network.*error/i,
        /connection.*refused/i,
        /connection.*timeout/i,
        /ECONNREFUSED/,
        /ETIMEDOUT/,
        /dns.*lookup.*failed/i,
        /unable.*to.*connect/i,
        /socket.*hang.*up/i,
        /ENOTFOUND/,
        /certificate.*problem/i,
        /ssl.*certificate/i,
        /ssl.*error/i,
      ],
      errorType: 'network',
      createError: (match) => new AINetworkError(
        `Network error detected: ${match}. Please check your internet connection.`
      ),
      severity: 'fatal',
    },
    // Rate limit errors
    {
      patterns: [
        /rate.*limit/i,
        /quota.*exceeded/i,
        /too.*many.*requests/i,
        /rate.*exceeded/i,
        /usage.*limit/i,
        /429.*too.*many/i,
        /request.*limit/i,
        /throttled/i,
      ],
      errorType: 'rateLimit',
      createError: (match) => new AIRateLimitError(
        `Rate limit detected: ${match}. Please wait before retrying or use a different model.`
      ),
      severity: 'fatal',
    },
    // Model errors
    {
      patterns: [
        /model.*not.*found/i,
        /invalid.*model/i,
        /unknown.*model/i,
        /model.*not.*available/i,
        /model.*deprecated/i,
      ],
      errorType: 'model',
      createError: (match) => new AIModelError(
        `Model error detected: ${match}. Please check the model name.`,
        match
      ),
      severity: 'fatal',
    },
    // Other API/Service errors
    {
      patterns: [
        /api.*error/i,
        /bad.*gateway/i,
        /502.*bad.*gateway/i,
        /503.*service/i,
      ],
      errorType: 'generic',
      createError: (match) => new AIError(
        `API error detected: ${match}. The service may be temporarily unavailable.`,
        'AI_SERVICE_ERROR'
      ),
      severity: 'warning',
    },
  ];

  constructor(private emitter?: EventEmitter) {}

  /**
   * Parse a chunk of stderr data
   */
  parseChunk(data: string): ParsedError | null {
    // Add to buffer
    this.buffer += data;
    
    // Split by lines but keep incomplete line in buffer
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || '';
    
    let warningError: ParsedError | null = null;
    
    // Process complete lines
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;
      
      // Log stderr line for debugging
      logger.debug(`Claude CLI stderr: ${trimmedLine}`);
      
      // Skip lines that are just informational messages without actual errors
      if (/^(INFO:|DEBUG:)/i.test(trimmedLine) && 
          !/error|failed|exception|unable|invalid|unauthorized/i.test(trimmedLine)) {
        continue;
      }
      
      // Check against all patterns
      for (const errorDef of this.patterns) {
        for (const pattern of errorDef.patterns) {
          const match = trimmedLine.match(pattern);
          if (match) {
            const error: ParsedError = {
              type: errorDef.errorType,
              error: errorDef.createError(trimmedLine),
              severity: errorDef.severity,
              raw: trimmedLine,
              timestamp: new Date(),
            };
            
            this.errors.push(error);
            
            // Emit error event if emitter provided
            if (this.emitter) {
              this.emitter.emit('error:detected', error);
            }
            
            // Return immediately for fatal errors
            if (errorDef.severity === 'fatal') {
              logger.error(`Fatal error detected in Claude CLI: ${trimmedLine}`);
              return error;
            }
            
            // Track warnings to return if no fatal errors found
            logger.warn(`Warning detected in Claude CLI: ${trimmedLine}`);
            if (!warningError) {
              warningError = error;
            }
            break; // Move to next line after finding a match
          }
        }
      }
    }
    
    // Return warning if no fatal error was found
    return warningError;
  }
  
  /**
   * Parse remaining buffer (call when process ends)
   */
  parseRemaining(): ParsedError | null {
    if (this.buffer.trim()) {
      // Add newline to force processing of remaining buffer as a complete line
      const result = this.parseChunk(this.buffer + '\n');
      this.buffer = ''; // Clear buffer after processing
      return result;
    }
    return null;
  }
  
  /**
   * Get all collected errors
   */
  getAllErrors(): ParsedError[] {
    return [...this.errors];
  }
  
  /**
   * Get first fatal error
   */
  getFirstFatalError(): ParsedError | undefined {
    return this.errors.find(e => e.severity === 'fatal');
  }
  
  /**
   * Clear parser state
   */
  reset(): void {
    this.buffer = '';
    this.errors = [];
  }
  
  /**
   * Check if stderr contains progress indicators (not errors)
   */
  static isProgressIndicator(line: string): boolean {
    const progressPatterns = [
      /progress:/i,
      /processing/i,
      /analyzing/i,
      /generating/i,
      /\d+%/,
      /spinner/i,
      /loading/i,
    ];
    
    return progressPatterns.some(pattern => pattern.test(line));
  }
  
  /**
   * Extract meaningful error message from stderr
   */
  static extractErrorMessage(stderr: string): string {
    // Try to find the most relevant error line
    const lines = stderr.split('\n').filter(line => line.trim());
    
    // Look for lines that contain error keywords
    const errorLines = lines.filter(line => 
      /error|failed|exception|unable|invalid|unauthorized/i.test(line)
    );
    
    if (errorLines.length > 0 && errorLines[0]) {
      // Return the first error line, cleaned up
      return errorLines[0].trim()
        .replace(/^(error:|failed:|exception:)/i, '')
        .trim();
    }
    
    // Fallback to full stderr if no specific error found
    return stderr.trim() || 'Unknown error';
  }
}

/**
 * Create a stderr parser with event emitter integration
 */
export function createStderrParser(emitter?: EventEmitter): StderrParser {
  return new StderrParser(emitter);
}