/**
 * Authentication Service
 *
 * Handles Claude CLI authentication validation:
 * - CLI presence detection
 * - Authentication status checking
 * - Graceful degradation decisions
 */

import { execSync } from 'child_process';
import {
  AIAuthenticationError,
  isNodeError,
  type ClaudeAuthResult,
} from '../../types/ai-error-types';
import { logger } from '../../utils/logger';

/**
 * Service responsible for managing Claude CLI authentication
 */
export class AuthenticationService {
  constructor(private gracefulDegradation: boolean = true) {}

  /**
   * Validate Claude CLI authentication
   */
  validateClaudeAuth(): ClaudeAuthResult {
    try {
      // Try to check Claude CLI version (basic check if Claude CLI exists)
      execSync('claude --version', { stdio: 'ignore' });

      // Check if Claude CLI is properly authenticated using a minimal command
      // The 'claude config get' command will fail if not authenticated
      const configCheck = execSync('claude config get 2>&1', { encoding: 'utf-8' });

      // If we can get config, we're authenticated
      if (configCheck && !configCheck.includes('error') && !configCheck.includes('login')) {
        return { authenticated: true };
      }

      return {
        authenticated: false,
        error: new AIAuthenticationError(
          'Claude CLI not authenticated. Please run Claude Code interactively to authenticate.'
        ),
        canDegrade: this.gracefulDegradation,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      if (isNodeError(error) && (error.code === 'ENOENT' || errorMessage.includes('not found'))) {
        return {
          authenticated: false,
          error: new AIAuthenticationError(
            'Claude CLI not found. Please ensure Claude Code is installed and available in PATH.',
            { code: error.code }
          ),
          canDegrade: this.gracefulDegradation,
        };
      }

      if (errorMessage.includes('login') || errorMessage.includes('authenticate')) {
        return {
          authenticated: false,
          error: new AIAuthenticationError(
            'Claude CLI not authenticated. Please run Claude Code interactively to authenticate.'
          ),
          canDegrade: this.gracefulDegradation,
        };
      }

      // Generic error
      return {
        authenticated: false,
        error: new AIAuthenticationError(
          `Failed to check Claude CLI authentication: ${errorMessage}`,
          { originalError: errorMessage }
        ),
        canDegrade: this.gracefulDegradation,
      };
    }
  }

  /**
   * Set graceful degradation mode
   */
  setGracefulDegradation(enabled: boolean): void {
    this.gracefulDegradation = enabled;
    logger.info(`Graceful degradation ${enabled ? 'enabled' : 'disabled'}`);
  }
}
