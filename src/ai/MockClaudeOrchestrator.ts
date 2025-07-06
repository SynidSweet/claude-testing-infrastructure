/**
 * Mock Claude Orchestrator for Validation Tests
 * 
 * Provides a mock implementation of ClaudeOrchestrator that records process spawn attempts
 * without actually spawning real processes. Used for testing in VALIDATION_TEST contexts
 * to prevent recursive process spawning and API consumption during tests.
 */

import { EventEmitter } from 'events';
import type { AITask, AITaskBatch, AITaskResult } from './AITaskPreparation';
import type { ClaudeOrchestratorConfig, ProcessResult, OrchestratorStats } from './ClaudeOrchestrator';
import { ProcessContext } from '../types/process-types';
import { logger } from '../utils/logger';

export interface MockProcessSpawn {
  taskId: string;
  timestamp: Date;
  model: string;
  context: ProcessContext;
  prompt: string;
  sourceFile: string;
  testFile: string;
}

export interface MockAIResponse {
  taskId: string;
  generatedTests: string;
  success: boolean;
  error?: string | undefined;
  tokenCount?: number;
  cost?: number;
  duration?: number;
}

export class MockClaudeOrchestrator extends EventEmitter {
  private spawnHistory: MockProcessSpawn[] = [];
  private mockResponses: Map<string, MockAIResponse> = new Map();
  private config: ClaudeOrchestratorConfig;
  private processContext: ProcessContext;
  private stats: OrchestratorStats;

  constructor(
    config: ClaudeOrchestratorConfig = {},
    context: ProcessContext = ProcessContext.VALIDATION_TEST
  ) {
    super();
    this.config = {
      maxConcurrent: 2,
      model: 'sonnet',
      fallbackModel: 'haiku',
      retryAttempts: 3,
      retryDelay: 1000,
      timeout: 900000,
      outputFormat: 'json',
      verbose: false,
      gracefulDegradation: true,
      exponentialBackoff: true,
      circuitBreakerEnabled: true,
      maxRetryDelay: 30000,
      checkpointingEnabled: false,
      ...config,
    };
    
    this.processContext = context;
    this.stats = this.resetStats();
    
    logger.info(`MockClaudeOrchestrator initialized in context: ${context}`);
  }

  /**
   * Mock validateClaudeAuth - simulates authentication check
   */
  validateClaudeAuth(): {
    authenticated: boolean;
    error?: string;
    canDegrade?: boolean;
  } {
    // In mock mode, we can simulate different authentication scenarios
    const mockAuthState = process.env.MOCK_CLAUDE_AUTH || 'degraded';
    
    switch (mockAuthState) {
      case 'authenticated':
        return {
          authenticated: true,
          canDegrade: false
        };
      
      case 'failed':
        return {
          authenticated: false,
          error: 'Mock authentication failure',
          canDegrade: false
        };
      
      case 'degraded':
      default:
        return {
          authenticated: false,
          error: 'Mock Claude CLI not available - using degraded mode',
          canDegrade: true
        };
    }
  }

  /**
   * Mock processBatch - records spawn attempts and returns mock results
   */
  async processBatch(batch: AITaskBatch): Promise<ProcessResult[]> {
    const results: ProcessResult[] = [];
    
    logger.info(`MockClaudeOrchestrator: Processing batch ${batch.id} with ${batch.tasks.length} tasks`);
    
    // Record the process spawn attempts
    for (const task of batch.tasks) {
      const spawnRecord: MockProcessSpawn = {
        taskId: task.id,
        timestamp: new Date(),
        model: this.config.model || 'sonnet',
        context: this.processContext,
        prompt: task.prompt,
        sourceFile: task.sourceFile,
        testFile: task.testFile
      };
      
      this.spawnHistory.push(spawnRecord);
      
      // Generate or retrieve mock response
      const mockResponse = this.getMockResponse(task.id, task);
      
      const processResult: ProcessResult = {
        taskId: task.id,
        success: mockResponse.success,
        ...(mockResponse.success && {
          result: {
            generatedTests: mockResponse.generatedTests,
            tokensUsed: mockResponse.tokenCount || 150,
            actualCost: mockResponse.cost || 0.001,
            duration: mockResponse.duration || 2000,
            error: mockResponse.error
          } as AITaskResult
        }),
        ...(mockResponse.error && { error: mockResponse.error })
      };
      
      results.push(processResult);
      
      // Update stats
      this.stats.totalTasks++;
      if (mockResponse.success) {
        this.stats.completedTasks++;
        this.stats.totalTokensUsed += mockResponse.tokenCount || 150;
        this.stats.totalCost += mockResponse.cost || 0.001;
      } else {
        this.stats.failedTasks++;
      }
      
      this.stats.sessionUsage.processesSpawned++;
    }
    
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 100));
    
    logger.info(`MockClaudeOrchestrator: Completed batch ${batch.id} with ${results.length} results`);
    
    return results;
  }

  /**
   * Mock emergencyShutdown - records emergency shutdown calls
   */
  public emergencyShutdown(reason: string): void {
    logger.warn(`MockClaudeOrchestrator: Emergency shutdown called - ${reason}`);
    
    // Record the emergency shutdown
    this.spawnHistory.push({
      taskId: 'emergency-shutdown',
      timestamp: new Date(),
      model: 'N/A',
      context: this.processContext,
      prompt: `Emergency shutdown: ${reason}`,
      sourceFile: 'N/A',
      testFile: 'N/A'
    });
    
    this.stats.sessionUsage.usageWarnings++;
    this.stats.endTime = new Date();
    
    this.emit('emergencyShutdown', { reason });
  }

  /**
   * Mock killAll - simulates killing all processes
   */
  async killAll(): Promise<void> {
    logger.info('MockClaudeOrchestrator: killAll called - simulating process termination');
    
    // Record the kill all operation
    this.spawnHistory.push({
      taskId: 'kill-all',
      timestamp: new Date(),
      model: 'N/A',
      context: this.processContext,
      prompt: 'Kill all processes',
      sourceFile: 'N/A',
      testFile: 'N/A'
    });
    
    // Simulate cleanup time
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  /**
   * Get spawn history for validation
   */
  getSpawnHistory(): MockProcessSpawn[] {
    return [...this.spawnHistory];
  }

  /**
   * Clear spawn history
   */
  clearSpawnHistory(): void {
    this.spawnHistory = [];
  }

  /**
   * Set mock response for a specific task
   */
  setMockResponse(taskId: string, response: MockAIResponse): void {
    this.mockResponses.set(taskId, response);
  }

  /**
   * Set default mock responses for all tasks
   */
  setDefaultMockResponses(responses: Partial<MockAIResponse>): void {
    this.mockResponses.set('*', {
      taskId: '*',
      generatedTests: responses.generatedTests || this.generateDefaultTestContent(),
      success: responses.success !== undefined ? responses.success : true,
      error: responses.error || undefined,
      tokenCount: responses.tokenCount || 150,
      cost: responses.cost || 0.001,
      duration: responses.duration || 2000
    });
  }

  /**
   * Get mock response for task
   */
  private getMockResponse(taskId: string, task: AITask): MockAIResponse {
    // Check for specific task response first
    const specificResponse = this.mockResponses.get(taskId);
    if (specificResponse) {
      return specificResponse;
    }
    
    // Check for default response
    const defaultResponse = this.mockResponses.get('*');
    if (defaultResponse) {
      return {
        ...defaultResponse,
        taskId: taskId
      };
    }
    
    // Generate default mock response
    return {
      taskId: taskId,
      generatedTests: this.generateDefaultTestContent(task),
      success: true,
      tokenCount: 150,
      cost: 0.001,
      duration: 2000
    };
  }

  /**
   * Generate default test content for mock responses
   */
  private generateDefaultTestContent(task?: AITask): string {
    const sourceFileName = task?.sourceFile ? task.sourceFile.split('/').pop()?.replace('.js', '').replace('.jsx', '').replace('.ts', '').replace('.tsx', '') : 'Component';
    
    return `// Mock generated test for validation
import { render, screen } from '@testing-library/react';
import ${sourceFileName} from './${sourceFileName}';

describe('${sourceFileName}', () => {
  test('should render without crashing', () => {
    const result = render(<${sourceFileName} />);
    expect(result).toBeDefined();
  });

  test('should handle basic functionality', () => {
    // Mock test content for validation
    expect(true).toBe(true);
  });
});
`;
  }

  /**
   * Get orchestrator stats
   */
  getStats(): OrchestratorStats {
    return { ...this.stats };
  }

  /**
   * Reset stats
   */
  private resetStats(): OrchestratorStats {
    return {
      totalTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      totalTokensUsed: 0,
      totalCost: 0,
      totalDuration: 0,
      startTime: new Date(),
      sessionUsage: {
        processesSpawned: 0,
        peakConcurrency: 0,
        usageWarnings: 0,
        rateLimitHits: 0
      }
    };
  }
}