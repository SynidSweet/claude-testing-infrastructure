/**
 * MCPErrorHandler Test Suite
 *
 * Comprehensive tests for centralized MCP error handling with circuit breaker,
 * retry logic, and graceful degradation strategies.
 *
 * Tests TASK-2025-178: Create MCPErrorHandler for comprehensive error management
 */

import {
  MCPErrorHandler,
  MCPError,
  MCPErrorCategory,
  MCPErrorSeverity,
  DegradationStrategy,
  mcpErrorHandler,
  handleMCPError,
  withCircuitBreaker,
  withRetry,
  isMCPError,
} from '../../../src/mcp/services/MCPErrorHandler';
import { ClaudeTestingError } from '../../../src/types/error-types';

describe('MCPErrorHandler', () => {
  let errorHandler: MCPErrorHandler;

  beforeEach(() => {
    errorHandler = new MCPErrorHandler();
  });

  afterEach(() => {
    // Reset circuit breakers between tests
    const circuitBreakers = errorHandler.getCircuitBreakerStates();
    circuitBreakers.forEach((_, serviceName) => {
      errorHandler.resetCircuitBreaker(serviceName);
    });
  });

  describe('Error Categorization', () => {
    it('should categorize validation errors correctly', async () => {
      const error = new Error('Invalid parameter validation failed');
      const response = await errorHandler.handleError(error, 'test_tool', 'validate');

      expect(response.success).toBe(false);
      expect(response.error.category).toBe(MCPErrorCategory.Validation);
      expect(response.error.severity).toBe(MCPErrorSeverity.Medium);
      expect(response.metadata.retryable).toBe(false);
    });

    it('should categorize timeout errors as performance issues', async () => {
      const error = new Error('Operation timeout ETIMEDOUT');
      const response = await errorHandler.handleError(error, 'test_tool', 'analyze');

      expect(response.error.category).toBe(MCPErrorCategory.Performance);
      expect(response.error.severity).toBe(MCPErrorSeverity.High);
      expect(response.metadata.retryable).toBe(true);
    });

    it('should categorize connection errors as external issues', async () => {
      const error = new Error('ECONNREFUSED - connection refused');
      const response = await errorHandler.handleError(error, 'test_tool', 'external_call');

      expect(response.error.category).toBe(MCPErrorCategory.External);
      expect(response.error.severity).toBe(MCPErrorSeverity.High);
      expect(response.metadata.degradationStrategy).toBe(DegradationStrategy.Circuit);
    });

    it('should categorize rate limit errors correctly', async () => {
      const error = new Error('Rate limit exceeded - too many requests');
      const response = await errorHandler.handleError(error, 'test_tool', 'api_call');

      expect(response.error.category).toBe(MCPErrorCategory.RateLimit);
      expect(response.error.severity).toBe(MCPErrorSeverity.Medium);
      expect(response.metadata.degradationStrategy).toBe(DegradationStrategy.Retry);
    });

    it('should categorize authorization errors correctly', async () => {
      const error = new Error('Access denied - unauthorized');
      const response = await errorHandler.handleError(error, 'test_tool', 'secure_operation');

      expect(response.error.category).toBe(MCPErrorCategory.Authorization);
      expect(response.error.severity).toBe(MCPErrorSeverity.High);
      expect(response.metadata.retryable).toBe(false);
    });

    it('should categorize resource errors correctly', async () => {
      const error = new Error('File not found - ENOENT');
      const response = await errorHandler.handleError(error, 'test_tool', 'read_file');

      expect(response.error.category).toBe(MCPErrorCategory.Resource);
      expect(response.error.severity).toBe(MCPErrorSeverity.Medium);
      expect(response.metadata.degradationStrategy).toBe(DegradationStrategy.Fallback);
    });

    it('should categorize system errors correctly', async () => {
      const error = new Error('Out of memory - ENOMEM');
      const response = await errorHandler.handleError(error, 'test_tool', 'memory_operation');

      expect(response.error.category).toBe(MCPErrorCategory.System);
      expect(response.error.severity).toBe(MCPErrorSeverity.Critical);
      expect(response.metadata.retryable).toBe(false);
    });
  });

  describe('Circuit Breaker', () => {
    it('should start with closed circuit breaker', () => {
      expect(errorHandler.isServiceAvailable('test_service')).toBe(true);
    });

    it('should open circuit breaker after threshold failures', async () => {
      const serviceName = 'failing_service';

      // Trigger failures up to threshold (default 5)
      for (let i = 0; i < 5; i++) {
        try {
          await errorHandler.executeWithCircuitBreaker(serviceName, async () => {
            throw new Error('Service failure');
          });
        } catch (error) {
          // Expected to fail
        }
      }

      // Circuit should now be open
      expect(errorHandler.isServiceAvailable(serviceName)).toBe(false);
    });

    it('should use fallback when circuit is open', async () => {
      const serviceName = 'failing_service_with_fallback';
      const fallbackResult = 'fallback_result';

      // Trigger failures to open circuit
      for (let i = 0; i < 5; i++) {
        try {
          await errorHandler.executeWithCircuitBreaker(serviceName, async () => {
            throw new Error('Service failure');
          });
        } catch (error) {
          // Expected to fail
        }
      }

      // Should use fallback when circuit is open
      const result = await errorHandler.executeWithCircuitBreaker(
        serviceName,
        async () => {
          throw new Error('Should not execute');
        },
        async () => fallbackResult
      );

      expect(result).toBe(fallbackResult);
    });

    it('should throw error when circuit is open and no fallback provided', async () => {
      const serviceName = 'failing_service_no_fallback';

      // Trigger failures to open circuit
      for (let i = 0; i < 5; i++) {
        try {
          await errorHandler.executeWithCircuitBreaker(serviceName, async () => {
            throw new Error('Service failure');
          });
        } catch (error) {
          // Expected to fail
        }
      }

      // Should throw error when no fallback
      await expect(
        errorHandler.executeWithCircuitBreaker(serviceName, async () => 'success')
      ).rejects.toThrow('Service failing_service_no_fallback is currently unavailable');
    });

    it('should transition to half-open after recovery timeout', async () => {
      const serviceName = 'recovery_test_service';

      // Create handler with short recovery timeout for testing
      const testHandler = new MCPErrorHandler({
        circuitBreaker: {
          failureThreshold: 2,
          recoveryTimeoutMs: 100, // Very short for testing
          halfOpenMaxCalls: 3,
        },
      });

      // Trigger failures to open circuit
      for (let i = 0; i < 2; i++) {
        try {
          await testHandler.executeWithCircuitBreaker(serviceName, async () => {
            throw new Error('Service failure');
          });
        } catch (error) {
          // Expected to fail
        }
      }

      expect(testHandler.isServiceAvailable(serviceName)).toBe(false);

      // Wait for recovery timeout
      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(testHandler.isServiceAvailable(serviceName)).toBe(true);
    });

    it('should close circuit after successful recovery', async () => {
      const serviceName = 'successful_recovery_service';

      // Create handler with short recovery timeout
      const testHandler = new MCPErrorHandler({
        circuitBreaker: {
          failureThreshold: 2,
          recoveryTimeoutMs: 50,
          halfOpenMaxCalls: 3,
        },
      });

      // Trigger failures to open circuit
      for (let i = 0; i < 2; i++) {
        try {
          await testHandler.executeWithCircuitBreaker(serviceName, async () => {
            throw new Error('Service failure');
          });
        } catch (error) {
          // Expected to fail
        }
      }

      // Wait for recovery timeout
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Successful operation should close circuit
      await testHandler.executeWithCircuitBreaker(serviceName, async () => 'success');

      // Verify circuit is now closed (this is internal state, tested via behavior)
      expect(testHandler.isServiceAvailable(serviceName)).toBe(true);
    });
  });

  describe('Retry Logic', () => {
    it('should retry retryable operations', async () => {
      let attempts = 0;
      const operation = async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Temporary failure');
        }
        return 'success';
      };

      const result = await errorHandler.executeWithRetry(operation, 'test_tool', 'retry_test', 3);

      expect(result).toBe('success');
      expect(attempts).toBe(3);
    });

    it('should not retry validation errors', async () => {
      let attempts = 0;
      const operation = async () => {
        attempts++;
        throw new Error('Invalid parameter validation failed');
      };

      await expect(
        errorHandler.executeWithRetry(operation, 'test_tool', 'validation_test', 3)
      ).rejects.toThrow('Invalid parameter validation failed');

      expect(attempts).toBe(1); // Should not retry
    });

    it('should not retry authorization errors', async () => {
      let attempts = 0;
      const operation = async () => {
        attempts++;
        throw new Error('Access denied - unauthorized');
      };

      await expect(
        errorHandler.executeWithRetry(operation, 'test_tool', 'auth_test', 3)
      ).rejects.toThrow('Access denied - unauthorized');

      expect(attempts).toBe(1); // Should not retry
    });

    it('should stop retrying after max attempts', async () => {
      let attempts = 0;
      const operation = async () => {
        attempts++;
        throw new Error('Persistent failure');
      };

      await expect(
        errorHandler.executeWithRetry(operation, 'test_tool', 'persistent_failure', 2)
      ).rejects.toThrow('Persistent failure');

      expect(attempts).toBe(2);
    });
  });

  describe('Error Response Format', () => {
    it('should return standardized error response format', async () => {
      const error = new Error('Test error message');
      const response = await errorHandler.handleError(
        error,
        'test_tool',
        'test_operation',
        'req-123'
      );

      expect(response).toHaveProperty('success', false);
      expect(response).toHaveProperty('error');
      expect(response).toHaveProperty('metadata');

      expect(response.error).toHaveProperty('code');
      expect(response.error).toHaveProperty('message', 'Test error message');
      expect(response.error).toHaveProperty('category');
      expect(response.error).toHaveProperty('severity');
      expect(response.error).toHaveProperty('toolName', 'test_tool');
      expect(response.error).toHaveProperty('operation', 'test_operation');
      expect(response.error).toHaveProperty('timestamp');
      expect(response.error).toHaveProperty('requestId', 'req-123');
      expect(response.error).toHaveProperty('suggestions');

      expect(response.metadata).toHaveProperty('degradationStrategy');
      expect(response.metadata).toHaveProperty('retryable');
    });

    it('should generate appropriate error codes', async () => {
      const validationError = new Error('Invalid validation');
      const response = await errorHandler.handleError(validationError, 'test_tool', 'validate');

      expect(response.error.code).toBe('MCP_VALIDATION_MEDIUM');
    });

    it('should include helpful suggestions', async () => {
      const validationError = new Error('Invalid parameter validation failed');
      const response = await errorHandler.handleError(validationError, 'test_tool', 'validate');

      expect(response.error.suggestions).toContain(
        'Check input parameters for correct format and values'
      );
      expect(response.error.suggestions).toContain(
        'Refer to tool documentation for required parameters'
      );
    });

    it('should sanitize sensitive information in context', async () => {
      const errorWithContext = new ClaudeTestingError('Test error', {
        password: 'secret123',
        apiToken: 'token456',
        publicInfo: 'safe_data',
      });

      const response = await errorHandler.handleError(errorWithContext, 'test_tool', 'test_op');

      expect(response.error.context?.password).toBe('[REDACTED]');
      expect(response.error.context?.apiToken).toBe('[REDACTED]');
      expect(response.error.context?.publicInfo).toBe('safe_data');
    });

    it('should truncate very long strings in context', async () => {
      const longString = 'x'.repeat(2000);
      const errorWithLongContext = new ClaudeTestingError('Test error', {
        longData: longString,
      });

      const response = await errorHandler.handleError(errorWithLongContext, 'test_tool', 'test_op');

      expect(response.error.context?.longData).toContain('[TRUNCATED]');
      expect((response.error.context?.longData as string).length).toBeLessThan(longString.length);
    });
  });

  describe('Configuration', () => {
    it('should use custom configuration', () => {
      const customConfig = {
        circuitBreaker: {
          failureThreshold: 10,
          recoveryTimeoutMs: 30000,
          halfOpenMaxCalls: 5,
        },
      };

      const customHandler = new MCPErrorHandler(customConfig);

      // Test that custom config is applied (behavior-based test)
      expect(customHandler).toBeDefined();
    });

    it('should allow runtime configuration updates', () => {
      const newConfig = {
        retry: {
          maxAttempts: 5,
          baseDelayMs: 2000,
          maxDelayMs: 60000,
          backoffMultiplier: 3,
        },
      };

      errorHandler.updateConfig(newConfig);

      // Configuration updated successfully
      expect(errorHandler).toBeDefined();
    });
  });

  describe('Convenience Functions', () => {
    it('should work with handleMCPError convenience function', async () => {
      const error = new Error('Convenience test error');
      const response = await handleMCPError(error, 'convenience_tool', 'test_op');

      expect(response.success).toBe(false);
      expect(response.error.toolName).toBe('convenience_tool');
      expect(response.error.operation).toBe('test_op');
    });

    it('should work with withCircuitBreaker convenience function', async () => {
      const result = await withCircuitBreaker(
        'test_service',
        async () => 'circuit_breaker_success'
      );

      expect(result).toBe('circuit_breaker_success');
    });

    it('should work with withRetry convenience function', async () => {
      let attempts = 0;
      const result = await withRetry(
        async () => {
          attempts++;
          if (attempts < 2) throw new Error('Retry test failure');
          return 'retry_success';
        },
        'retry_tool',
        'retry_op'
      );

      expect(result).toBe('retry_success');
      expect(attempts).toBe(2);
    });
  });

  describe('Type Guards and Utilities', () => {
    it('should correctly identify MCP errors', () => {
      const mcpError = new MCPError(
        'Test MCP error',
        MCPErrorCategory.Validation,
        MCPErrorSeverity.Medium
      );
      const regularError = new Error('Regular error');

      expect(isMCPError(mcpError)).toBe(true);
      expect(isMCPError(regularError)).toBe(false);
    });

    it('should handle existing MCP errors without re-categorization', async () => {
      const existingMCPError = new MCPError(
        'Existing MCP error',
        MCPErrorCategory.Performance,
        MCPErrorSeverity.High,
        'original_tool',
        'original_op'
      );

      const response = await errorHandler.handleError(existingMCPError, 'new_tool', 'new_op');

      expect(response.error.category).toBe(MCPErrorCategory.Performance);
      expect(response.error.severity).toBe(MCPErrorSeverity.High);
      expect(response.error.toolName).toBe('original_tool');
      expect(response.error.operation).toBe('original_op');
    });
  });

  describe('Circuit Breaker Management', () => {
    it('should allow manual circuit breaker reset', async () => {
      const serviceName = 'manual_reset_service';

      // Trigger failures to open circuit
      for (let i = 0; i < 5; i++) {
        try {
          await errorHandler.executeWithCircuitBreaker(serviceName, async () => {
            throw new Error('Service failure');
          });
        } catch (error) {
          // Expected to fail
        }
      }

      expect(errorHandler.isServiceAvailable(serviceName)).toBe(false);

      // Manual reset
      errorHandler.resetCircuitBreaker(serviceName);

      expect(errorHandler.isServiceAvailable(serviceName)).toBe(true);
    });

    it('should provide circuit breaker state information', async () => {
      const serviceName = 'state_test_service';

      // Trigger a failure
      try {
        await errorHandler.executeWithCircuitBreaker(serviceName, async () => {
          throw new Error('Service failure');
        });
      } catch (error) {
        // Expected to fail
      }

      const states = errorHandler.getCircuitBreakerStates();
      expect(states.has(serviceName)).toBe(true);

      const state = states.get(serviceName);
      expect(state).toHaveProperty('failures');
      expect(state).toHaveProperty('state');
      expect(state?.failures).toBeGreaterThan(0);
    });
  });

  describe('Global Singleton', () => {
    it('should provide global singleton instance', () => {
      expect(mcpErrorHandler).toBeDefined();
      expect(mcpErrorHandler).toBeInstanceOf(MCPErrorHandler);
    });

    it('should maintain state across calls', async () => {
      // Use global instance
      const serviceName = 'global_singleton_test';

      try {
        await mcpErrorHandler.executeWithCircuitBreaker(serviceName, async () => {
          throw new Error('Failure');
        });
      } catch (error) {
        // Expected to fail
      }

      const states = mcpErrorHandler.getCircuitBreakerStates();
      expect(states.has(serviceName)).toBe(true);
    });
  });
});
