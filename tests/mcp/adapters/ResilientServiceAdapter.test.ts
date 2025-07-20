/**
 * Tests for ResilientServiceAdapter
 * 
 * Comprehensive test suite for the resilient service adapter class,
 * covering retry logic, fallback strategies, and enhanced error handling.
 */

import { z } from 'zod';
import { ResilientServiceAdapter, FallbackStrategy, ServiceFallbackConfig } from '../../../src/mcp/adapters/ResilientServiceAdapter';
import { MCPCacheManager } from '../../../src/mcp/services/MCPCacheManager';
import { getMCPLogger, MCPToolStatus, MCPToolContext } from '../../../src/mcp/services/MCPLoggingService';
import { withCircuitBreaker, MCPErrorCategory } from '../../../src/mcp/services/MCPErrorHandler';
import { MCPToolError, MCPToolErrorType } from '../../../src/types/mcp-tool-types';

// Mock dependencies
jest.mock('../../../src/mcp/services/MCPCacheManager');
jest.mock('../../../src/mcp/services/MCPLoggingService');
jest.mock('../../../src/mcp/services/MCPErrorHandler');
jest.mock('../../../src/utils/logger');

// Test schemas and types
const TestParamsSchema = z.object({
  input: z.string(),
  failureMode: z.enum(['none', 'first', 'all', 'timeout']).optional()
});

type TestParams = z.infer<typeof TestParamsSchema>;

interface TestResult {
  output: string;
  source: 'primary' | 'cache' | 'simplified' | 'partial' | 'default';
}

// Concrete test implementation
class TestResilientAdapter extends ResilientServiceAdapter<TestParams, TestResult> {
  public readonly name = 'test_resilient';
  public readonly description = 'Test resilient adapter';
  public readonly parameters = TestParamsSchema;
  
  public executionCount = 0;
  public executeCoreMock = jest.fn();
  
  constructor(config?: Partial<ServiceFallbackConfig>) {
    super(config);
  }
  
  protected async executeCore(params: TestParams, context: MCPToolContext): Promise<any> {
    this.executionCount++;
    
    // Simulate different failure modes for testing
    if (params.failureMode === 'all') {
      throw new Error('Service unavailable');
    }
    
    if (params.failureMode === 'first' && this.executionCount === 1) {
      throw new Error('Temporary failure');
    }
    
    if (params.failureMode === 'timeout') {
      throw new MCPToolError(MCPToolErrorType.TIMEOUT_ERROR, 'Operation timed out');
    }
    
    return this.executeCoreMock(params, context);
  }
  
  getCacheKey(params: TestParams): string {
    return `resilient:${params.input}`;
  }
  
  getTTL(): number {
    return 5 * 60 * 1000;
  }
  
  protected async executeSimplified(params: TestParams, context: MCPToolContext): Promise<TestResult> {
    return {
      output: `simplified-${params.input}`,
      source: 'simplified'
    };
  }
  
  protected async executePartial(params: TestParams, context: MCPToolContext): Promise<TestResult> {
    return {
      output: `partial-${params.input}`,
      source: 'partial'
    };
  }
  
  protected getDefaultResult(params: TestParams): TestResult {
    return {
      output: `default-${params.input}`,
      source: 'default'
    };
  }
  
  protected getHealthCheckParams(): TestParams | null {
    return { input: 'health-check', failureMode: 'none' };
  }
}

describe('ResilientServiceAdapter', () => {
  let adapter: TestResilientAdapter;
  let mockCacheManager: jest.Mocked<MCPCacheManager>;
  let mockLogger: any;
  let mockCircuitBreaker: jest.Mock;
  
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    
    // Setup mock cache manager
    mockCacheManager = {
      getInstance: jest.fn(),
      get: jest.fn(),
      set: jest.fn(),
      has: jest.fn(),
      delete: jest.fn(),
      clear: jest.fn(),
      getMetrics: jest.fn(),
      resetInstance: jest.fn()
    } as any;
    
    (MCPCacheManager.getInstance as jest.Mock).mockReturnValue(mockCacheManager);
    
    // Setup mock logger
    mockLogger = {
      logToolStart: jest.fn().mockReturnValue({ startTime: Date.now() }),
      logToolComplete: jest.fn(),
      logToolError: jest.fn()
    };
    
    (getMCPLogger as jest.Mock).mockReturnValue(mockLogger);
    
    // Setup mock circuit breaker - pass through by default
    mockCircuitBreaker = withCircuitBreaker as jest.Mock;
    mockCircuitBreaker.mockImplementation((name, fn, options) => fn());
  });
  
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });
  
  describe('constructor', () => {
    it('should initialize with default fallback config', () => {
      adapter = new TestResilientAdapter();
      expect(adapter['fallbackConfig']).toMatchObject({
        enableFallback: true,
        fallbackStrategy: FallbackStrategy.Cache,
        maxRetries: 3,
        retryDelay: 1000,
        backoffMultiplier: 2,
        maxRetryDelay: 10000,
        operationTimeout: 30000
      });
    });
    
    it('should merge custom config with defaults', () => {
      adapter = new TestResilientAdapter({
        maxRetries: 5,
        fallbackStrategy: FallbackStrategy.Simplified
      });
      
      expect(adapter['fallbackConfig'].maxRetries).toBe(5);
      expect(adapter['fallbackConfig'].fallbackStrategy).toBe(FallbackStrategy.Simplified);
      expect(adapter['fallbackConfig'].enableFallback).toBe(true); // Default preserved
    });
  });
  
  describe('retry logic', () => {
    beforeEach(() => {
      adapter = new TestResilientAdapter({ maxRetries: 2, retryDelay: 100, enableFallback: false });
      mockCacheManager.get.mockResolvedValue(null);
    });
    
    it('should succeed on first attempt without retries', async () => {
      adapter.executeCoreMock.mockResolvedValue({ output: 'success', source: 'primary' });
      
      const result = await adapter.execute(
        { input: 'test', failureMode: 'none' },
        { toolName: 'test', operation: 'execute' }
      );
      
      expect(result).toEqual({ output: 'success', source: 'primary' });
      expect(adapter.executionCount).toBe(1);
    });
    
    it('should retry on temporary failures', async () => {
      adapter.executeCoreMock.mockResolvedValue({ output: 'success', source: 'primary' });
      
      const promise = adapter.execute(
        { input: 'test', failureMode: 'first' },
        { toolName: 'test', operation: 'execute' }
      );
      
      // First attempt fails
      await jest.advanceTimersByTimeAsync(0);
      expect(adapter.executionCount).toBe(1);
      
      // Wait for retry delay
      await jest.advanceTimersByTimeAsync(100);
      
      // Second attempt should succeed
      const result = await promise;
      expect(result).toEqual({ output: 'success', source: 'primary' });
      expect(adapter.executionCount).toBe(2);
    });
    
    it('should apply exponential backoff', async () => {
      adapter = new TestResilientAdapter({
        maxRetries: 3,
        retryDelay: 100,
        backoffMultiplier: 2,
        enableFallback: false
      });
      
      // Mock to fail multiple times
      let callCount = 0;
      adapter.executeCoreMock.mockImplementation(() => {
        callCount++;
        if (callCount < 3) {
          throw new Error('Temporary failure');
        }
        return { output: 'success', source: 'primary' };
      });
      
      const promise = adapter.execute(
        { input: 'test', failureMode: 'none' },
        { toolName: 'test', operation: 'execute' }
      );
      
      // First retry after 100ms
      await jest.advanceTimersByTimeAsync(100);
      
      // Second retry after 200ms (100 * 2)
      await jest.advanceTimersByTimeAsync(200);
      
      const result = await promise;
      expect(result).toEqual({ output: 'success', source: 'primary' });
      expect(callCount).toBe(3);
    });
    
    it('should respect max retry delay', async () => {
      adapter = new TestResilientAdapter({
        maxRetries: 5,
        retryDelay: 1000,
        backoffMultiplier: 10,
        maxRetryDelay: 2000,
        enableFallback: false
      });
      
      let callCount = 0;
      adapter.executeCoreMock.mockImplementation(() => {
        callCount++;
        if (callCount < 3) {
          throw new Error('Temporary failure');
        }
        return { output: 'success', source: 'primary' };
      });
      
      const promise = adapter.execute(
        { input: 'test', failureMode: 'none' },
        { toolName: 'test', operation: 'execute' }
      );
      
      // First retry after 1000ms
      await jest.advanceTimersByTimeAsync(1000);
      
      // Second retry should be capped at 2000ms (not 10000ms)
      await jest.advanceTimersByTimeAsync(2000);
      
      await promise;
      expect(callCount).toBe(3);
    });
    
    it('should not retry non-retryable errors', async () => {
      // Create adapter with no fallback
      adapter = new TestResilientAdapter({
        maxRetries: 2,
        retryDelay: 100,
        enableFallback: false
      });
      
      // Create validation error that's not retryable
      const validationError = new MCPToolError(MCPToolErrorType.VALIDATION_ERROR, 'Invalid input');
      
      // Override executeCore to throw validation error immediately
      adapter.executeCore = jest.fn().mockRejectedValue(validationError);
      
      await expect(adapter.execute(
        { input: 'test' },
        { toolName: 'test', operation: 'execute' }
      )).rejects.toThrow('Invalid input');
      
      expect(adapter.executeCore).toHaveBeenCalledTimes(1); // No retries
    });
  });
  
  describe('fallback strategies', () => {
    beforeEach(() => {
      adapter = new TestResilientAdapter({
        enableFallback: true,
        maxRetries: 0 // No retries to test fallback directly
      });
      mockCacheManager.get.mockResolvedValue(null);
    });
    
    it('should use cache fallback when available', async () => {
      adapter = new TestResilientAdapter({
        enableFallback: true,
        fallbackStrategy: FallbackStrategy.Cache,
        maxRetries: 0
      });
      
      const cachedResult = { output: 'cached', source: 'cache' as const };
      mockCacheManager.get.mockResolvedValueOnce(null); // First check
      mockCacheManager.get.mockResolvedValueOnce(cachedResult); // Fallback check
      
      const result = await adapter.execute(
        { input: 'test', failureMode: 'all' },
        { toolName: 'test', operation: 'execute' }
      );
      
      expect(result).toEqual(cachedResult);
    });
    
    it('should use simplified fallback', async () => {
      adapter = new TestResilientAdapter({
        enableFallback: true,
        fallbackStrategy: FallbackStrategy.Simplified,
        maxRetries: 0
      });
      
      const result = await adapter.execute(
        { input: 'test', failureMode: 'all' },
        { toolName: 'test', operation: 'execute' }
      );
      
      expect(result).toEqual({
        output: 'simplified-test',
        source: 'simplified'
      });
    });
    
    it('should use partial fallback', async () => {
      adapter = new TestResilientAdapter({
        enableFallback: true,
        fallbackStrategy: FallbackStrategy.Partial,
        maxRetries: 0
      });
      
      const result = await adapter.execute(
        { input: 'test', failureMode: 'all' },
        { toolName: 'test', operation: 'execute' }
      );
      
      expect(result).toEqual({
        output: 'partial-test',
        source: 'partial'
      });
    });
    
    it('should use default fallback', async () => {
      adapter = new TestResilientAdapter({
        enableFallback: true,
        fallbackStrategy: FallbackStrategy.Default,
        maxRetries: 0
      });
      
      const result = await adapter.execute(
        { input: 'test', failureMode: 'all' },
        { toolName: 'test', operation: 'execute' }
      );
      
      expect(result).toEqual({
        output: 'default-test',
        source: 'default'
      });
    });
    
    it('should fail immediately with Fail strategy', async () => {
      adapter = new TestResilientAdapter({
        enableFallback: true,
        fallbackStrategy: FallbackStrategy.Fail,
        maxRetries: 0
      });
      
      await expect(adapter.execute(
        { input: 'test', failureMode: 'all' },
        { toolName: 'test', operation: 'execute' }
      )).rejects.toThrow('Both primary and fallback execution failed');
    });
    
    it('should throw error when fallback also fails', async () => {
      adapter = new TestResilientAdapter({
        enableFallback: true,
        fallbackStrategy: FallbackStrategy.Cache,
        maxRetries: 0
      });
      
      mockCacheManager.get.mockResolvedValue(null); // No cached data
      
      await expect(adapter.execute(
        { input: 'test', failureMode: 'all' },
        { toolName: 'test', operation: 'execute' }
      )).rejects.toThrow('Both primary and fallback execution failed');
    });
  });
  
  describe('error categorization', () => {
    beforeEach(() => {
      adapter = new TestResilientAdapter({ maxRetries: 2 });
    });
    
    it('should identify retryable errors', () => {
      const retryableErrors = [
        new Error('Operation timed out'),
        new Error('Rate limit exceeded'),
        new Error('External service error'),
        new Error('System error occurred')
      ];
      
      retryableErrors.forEach(error => {
        expect(adapter['isRetryableError'](error)).toBe(true);
      });
    });
    
    it('should identify non-retryable errors', () => {
      const nonRetryableErrors = [
        new Error('Invalid input validation'),
        new Error('Permission denied'),
        new Error('Resource not found')
      ];
      
      nonRetryableErrors.forEach(error => {
        expect(adapter['isRetryableError'](error)).toBe(false);
      });
    });
  });
  
  describe('health check', () => {
    beforeEach(() => {
      adapter = new TestResilientAdapter();
      adapter.executeCoreMock.mockResolvedValue({ output: 'healthy' });
    });
    
    it('should perform health check successfully', async () => {
      const isHealthy = await adapter.checkHealth();
      
      expect(isHealthy).toBe(true);
      expect(adapter.executeCoreMock).toHaveBeenCalledWith(
        { input: 'health-check', failureMode: 'none' },
        { toolName: 'test_resilient', operation: 'health_check' }
      );
    });
    
    it('should return false on health check failure', async () => {
      adapter.executeCoreMock.mockRejectedValue(new Error('Service down'));
      
      const isHealthy = await adapter.checkHealth();
      
      expect(isHealthy).toBe(false);
    });
    
    it('should handle missing health check params', async () => {
      class NoHealthCheckAdapter extends TestResilientAdapter {
        protected getHealthCheckParams(): TestParams | null {
          return null;
        }
      }
      
      const noHealthAdapter = new NoHealthCheckAdapter();
      const isHealthy = await noHealthAdapter.checkHealth();
      
      expect(isHealthy).toBe(true);
      expect(noHealthAdapter.executeCoreMock).not.toHaveBeenCalled();
    });
  });
  
  describe('timeout handling', () => {
    it('should handle timeout operations', async () => {
      adapter = new TestResilientAdapter({
        operationTimeout: 100,
        maxRetries: 0,
        enableFallback: false
      });
      
      // Create a promise that simulates timeout
      const timeoutError = new MCPToolError(MCPToolErrorType.TIMEOUT_ERROR, 'Operation timed out');
      adapter.executeCore = jest.fn().mockRejectedValue(timeoutError);
      
      await expect(adapter.execute(
        { input: 'test' },
        { toolName: 'test', operation: 'execute' }
      )).rejects.toThrow(timeoutError);
    });
  });
});