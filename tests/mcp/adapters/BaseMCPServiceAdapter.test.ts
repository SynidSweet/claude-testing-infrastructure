/**
 * Tests for BaseMCPServiceAdapter
 * 
 * Comprehensive test suite for the base MCP service adapter class,
 * covering caching, error handling, validation, and monitoring.
 */

import { z } from 'zod';
import { BaseMCPServiceAdapter } from '../../../src/mcp/adapters/BaseMCPServiceAdapter';
import { MCPCacheManager, CacheLayer } from '../../../src/mcp/services/MCPCacheManager';
import { getMCPLogger, MCPToolStatus, MCPToolContext } from '../../../src/mcp/services/MCPLoggingService';
import { withCircuitBreaker } from '../../../src/mcp/services/MCPErrorHandler';
import { MCPToolError, MCPToolErrorType } from '../../../src/types/mcp-tool-types';

// Mock dependencies
jest.mock('../../../src/mcp/services/MCPCacheManager');
jest.mock('../../../src/mcp/services/MCPLoggingService');
jest.mock('../../../src/mcp/services/MCPErrorHandler');
jest.mock('../../../src/utils/logger');

// Test schemas and types
const TestParamsSchema = z.object({
  input: z.string(),
  options: z.object({
    flag: z.boolean().optional(),
    count: z.number().optional()
  }).optional()
});

type TestParams = z.infer<typeof TestParamsSchema>;

interface TestResult {
  output: string;
  processed: boolean;
  metadata?: Record<string, any>;
}

// Concrete test implementation
class TestServiceAdapter extends BaseMCPServiceAdapter<TestParams, TestResult> {
  public readonly name = 'test_service';
  public readonly description = 'Test service adapter';
  public readonly parameters = TestParamsSchema;
  
  public executeCoreMock = jest.fn();
  
  protected async executeCore(params: TestParams, context: MCPToolContext): Promise<any> {
    return this.executeCoreMock(params, context);
  }
  
  getCacheKey(params: TestParams): string {
    return `test:${params.input}:${JSON.stringify(params.options || {})}`;
  }
  
  getTTL(): number {
    return 5 * 60 * 1000; // 5 minutes
  }
  
  transformOutput(result: any): TestResult {
    return {
      ...result,
      processed: true
    };
  }
}

describe('BaseMCPServiceAdapter', () => {
  let adapter: TestServiceAdapter;
  let mockCacheManager: jest.Mocked<MCPCacheManager>;
  let mockLogger: any;
  let mockCircuitBreaker: jest.Mock;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
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
    
    // Setup mock circuit breaker
    mockCircuitBreaker = withCircuitBreaker as jest.Mock;
    mockCircuitBreaker.mockImplementation((name, fn) => fn());
    
    adapter = new TestServiceAdapter();
  });
  
  afterEach(() => {
    jest.restoreAllMocks();
  });
  
  describe('constructor', () => {
    it('should initialize with cache manager and logger', () => {
      expect(MCPCacheManager.getInstance).toHaveBeenCalled();
      expect(getMCPLogger).toHaveBeenCalled();
    });
  });
  
  describe('execute', () => {
    const testParams: TestParams = {
      input: 'test-input',
      options: { flag: true, count: 5 }
    };
    
    const testContext: MCPToolContext = {
      toolName: 'test_service',
      operation: 'execute',
      sessionId: 'test-session',
      traceId: 'test-trace'
    };
    
    it('should execute successfully with cache miss', async () => {
      const expectedResult = { output: 'test-output', processed: true };
      mockCacheManager.get.mockResolvedValue(null);
      adapter.executeCoreMock.mockResolvedValue({ output: 'test-output' });
      
      const result = await adapter.execute(testParams, testContext);
      
      expect(result).toEqual(expectedResult);
      expect(mockLogger.logToolStart).toHaveBeenCalledWith(testContext);
      expect(mockCacheManager.get).toHaveBeenCalledWith(
        CacheLayer.TestGeneration,
        'test:test-input:{"flag":true,"count":5}'
      );
      expect(adapter.executeCoreMock).toHaveBeenCalledWith(testParams, testContext);
      expect(mockCacheManager.set).toHaveBeenCalledWith(
        CacheLayer.TestGeneration,
        'test:test-input:{"flag":true,"count":5}',
        expectedResult,
        300000
      );
      expect(mockLogger.logToolComplete).toHaveBeenCalledWith(
        testContext,
        expect.any(Object),
        MCPToolStatus.Success,
        expectedResult
      );
    });
    
    it('should return cached result on cache hit', async () => {
      const cachedResult = { output: 'cached-output', processed: true };
      mockCacheManager.get.mockResolvedValue(cachedResult);
      
      const result = await adapter.execute(testParams, testContext);
      
      expect(result).toEqual(cachedResult);
      expect(adapter.executeCoreMock).not.toHaveBeenCalled();
      expect(mockLogger.logToolComplete).toHaveBeenCalledWith(
        testContext,
        expect.objectContaining({ cacheHit: true }),
        MCPToolStatus.Cached,
        cachedResult
      );
    });
    
    it('should handle execution errors properly', async () => {
      mockCacheManager.get.mockResolvedValue(null);
      const testError = new Error('Service execution failed');
      adapter.executeCoreMock.mockRejectedValue(testError);
      
      await expect(adapter.execute(testParams, testContext)).rejects.toThrow(MCPToolError);
      
      expect(mockLogger.logToolError).toHaveBeenCalledWith(
        testContext,
        expect.any(Object),
        testError
      );
    });
    
    it('should pass through MCPToolError without transformation', async () => {
      mockCacheManager.get.mockResolvedValue(null);
      const mcpError = new MCPToolError(
        MCPToolErrorType.VALIDATION_ERROR,
        'Validation failed'
      );
      adapter.executeCoreMock.mockRejectedValue(mcpError);
      
      await expect(adapter.execute(testParams, testContext)).rejects.toThrow(mcpError);
    });
    
    it('should use circuit breaker for execution', async () => {
      mockCacheManager.get.mockResolvedValue(null);
      adapter.executeCoreMock.mockResolvedValue({ output: 'test' });
      
      await adapter.execute(testParams, testContext);
      
      expect(mockCircuitBreaker).toHaveBeenCalledWith(
        'test_service',
        expect.any(Function)
      );
    });
  });
  
  describe('validateInput', () => {
    it('should validate valid input successfully', () => {
      const validParams = {
        input: 'test',
        options: { flag: true }
      };
      
      const result = adapter.validateInput(validParams);
      expect(result).toEqual(validParams);
    });
    
    it('should throw MCPToolError for invalid input', () => {
      const invalidParams = {
        input: 123, // Should be string
        options: { flag: 'not-boolean' }
      };
      
      expect(() => adapter.validateInput(invalidParams)).toThrow(MCPToolError);
      expect(() => adapter.validateInput(invalidParams)).toThrow(
        expect.objectContaining({
          type: MCPToolErrorType.VALIDATION_ERROR
        })
      );
    });
    
    it('should include validation errors in details', () => {
      const invalidParams = { notInput: 'test' };
      
      try {
        adapter.validateInput(invalidParams);
        fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeInstanceOf(MCPToolError);
        expect((error as MCPToolError).details?.validationErrors).toBeDefined();
      }
    });
  });
  
  describe('transformOutput', () => {
    it('should transform output with default implementation', () => {
      const result = { output: 'test' };
      const transformed = adapter.transformOutput(result);
      
      expect(transformed).toEqual({
        output: 'test',
        processed: true
      });
    });
  });
  
  describe('caching helpers', () => {
    it('should generate correct cache keys', () => {
      const params1 = { input: 'test1' };
      const params2 = { input: 'test2', options: { flag: true } };
      
      expect(adapter.getCacheKey(params1)).toBe('test:test1:{}');
      expect(adapter.getCacheKey(params2)).toBe('test:test2:{"flag":true}');
    });
    
    it('should return correct TTL', () => {
      expect(adapter.getTTL()).toBe(300000); // 5 minutes
    });
    
    it('should handle cache check failures gracefully', async () => {
      mockCacheManager.get.mockRejectedValue(new Error('Cache error'));
      adapter.executeCoreMock.mockResolvedValue({ output: 'test' });
      
      const result = await adapter.execute(
        { input: 'test' },
        { toolName: 'test', operation: 'execute' }
      );
      
      expect(result).toEqual({ output: 'test', processed: true });
      expect(adapter.executeCoreMock).toHaveBeenCalled();
    });
    
    it('should handle cache set failures gracefully', async () => {
      mockCacheManager.get.mockResolvedValue(null);
      mockCacheManager.set.mockRejectedValue(new Error('Cache set error'));
      adapter.executeCoreMock.mockResolvedValue({ output: 'test' });
      
      const result = await adapter.execute(
        { input: 'test' },
        { toolName: 'test', operation: 'execute' }
      );
      
      expect(result).toEqual({ output: 'test', processed: true });
    });
  });
  
  describe('context helpers', () => {
    it('should generate valid session IDs', () => {
      const sessionId = (adapter as any).generateSessionId();
      
      expect(sessionId).toMatch(/^test_service-\d+-[a-z0-9]{9}$/);
    });
    
    it('should generate valid trace IDs', () => {
      const traceId = (adapter as any).generateTraceId();
      
      expect(traceId).toMatch(/^trace-\d+-[a-z0-9]{9}$/);
    });
    
    it('should create proper context with defaults', () => {
      const params = { input: 'test' };
      const context = (adapter as any).createContext(params);
      
      expect(context).toMatchObject({
        toolName: 'test_service',
        operation: 'execute',
        parameters: params,
        sessionId: expect.stringMatching(/^test_service-\d+-[a-z0-9]{9}$/),
        traceId: expect.stringMatching(/^trace-\d+-[a-z0-9]{9}$/)
      });
    });
    
    it('should merge provided context', () => {
      const params = { input: 'test' };
      const baseContext = {
        sessionId: 'custom-session',
        userId: 'test-user'
      };
      
      const context = (adapter as any).createContext(params, baseContext);
      
      expect(context).toMatchObject({
        toolName: 'test_service',
        operation: 'execute',
        parameters: params,
        sessionId: 'custom-session',
        userId: 'test-user',
        traceId: expect.any(String)
      });
    });
  });
  
  describe('error handling', () => {
    it('should categorize timeout errors correctly', () => {
      const error = new Error('Operation timed out');
      const category = (adapter as any).categorizeError(error);
      
      expect(category).toBe('performance');
    });
    
    it('should categorize permission errors correctly', () => {
      const error = new Error('Access denied to resource');
      const category = (adapter as any).categorizeError(error);
      
      expect(category).toBe('authorization');
    });
    
    it('should categorize resource errors correctly', () => {
      const error = new Error('File not found');
      const category = (adapter as any).categorizeError(error);
      
      expect(category).toBe('resource');
    });
    
    it('should categorize validation errors correctly', () => {
      const error = new Error('Invalid parameter provided');
      const category = (adapter as any).categorizeError(error);
      
      expect(category).toBe('validation');
    });
    
    it('should categorize rate limit errors correctly', () => {
      const error = new Error('Too many requests');
      const category = (adapter as any).categorizeError(error);
      
      expect(category).toBe('rate_limit');
    });
    
    it('should default to system category for unknown errors', () => {
      const error = new Error('Something went wrong');
      const category = (adapter as any).categorizeError(error);
      
      expect(category).toBe('system');
    });
    
    it('should map error categories to tool error types correctly', () => {
      const testCases = [
        { category: 'validation', expectedType: MCPToolErrorType.VALIDATION_ERROR },
        { category: 'performance', expectedType: MCPToolErrorType.TIMEOUT_ERROR },
        { category: 'authorization', expectedType: MCPToolErrorType.PERMISSION_ERROR },
        { category: 'resource', expectedType: MCPToolErrorType.RESOURCE_ERROR },
        { category: 'system', expectedType: MCPToolErrorType.EXECUTION_ERROR },
        { category: 'unknown', expectedType: MCPToolErrorType.EXECUTION_ERROR }
      ];
      
      testCases.forEach(({ category, expectedType }) => {
        const type = (adapter as any).mapErrorCategoryToType(category);
        expect(type).toBe(expectedType);
      });
    });
  });
});