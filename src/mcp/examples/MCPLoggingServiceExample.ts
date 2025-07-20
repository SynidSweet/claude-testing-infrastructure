/**
 * Example: Integrating MCPLoggingService with MCP Tools
 * 
 * This example demonstrates how MCP tools should integrate with the MCPLoggingService
 * for comprehensive execution tracking and monitoring.
 */

import { getMCPLogger, MCPToolStatus } from '../services/MCPLoggingService';
import type { MCPToolContext } from '../services/MCPLoggingService';
import { withCircuitBreaker } from '../services/MCPErrorHandler';

/**
 * Example MCP tool showing logging integration
 */
export class ExampleMCPTool {
  private readonly logger = getMCPLogger();
  
  public readonly name = 'mcp__claude-testing__example_tool';
  public readonly description = 'Example tool demonstrating logging integration';

  /**
   * Execute the tool with comprehensive logging
   */
  public async execute(params: { projectPath: string; options?: any }): Promise<any> {
    // Create execution context
    const context: MCPToolContext = {
      toolName: this.name,
      operation: 'analyze',
      parameters: params,
      sessionId: this.generateSessionId(),
      traceId: this.generateTraceId()
    };

    // Start logging
    const metrics = this.logger.logToolStart(context);

    return withCircuitBreaker(this.name, async () => {
      try {
        // Check cache first
        const cacheKey = this.generateCacheKey(params);
        const cachedResult = await this.checkCache(cacheKey);
        
        if (cachedResult) {
          metrics.cacheHit = true;
          this.logger.logToolComplete(context, metrics, MCPToolStatus.Cached, cachedResult);
          return cachedResult;
        }

        // Perform actual work
        this.logger.logToolWarning(context, 'Cache miss, performing full analysis', { cacheKey });
        
        const result = await this.performAnalysis(params);
        
        // Log successful completion
        this.logger.logToolComplete(context, metrics, MCPToolStatus.Success, result);
        
        return result;
      } catch (error) {
        // Log error
        this.logger.logToolError(context, metrics, error as Error);
        throw error;
      }
    });
  }

  /**
   * Example method with retry logging
   */
  public async executeWithRetry(params: any, maxRetries: number = 3): Promise<any> {
    const context: MCPToolContext = {
      toolName: this.name,
      operation: 'analyze_with_retry',
      parameters: params
    };

    const metrics = this.logger.logToolStart(context);
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        metrics.retryCount = attempt - 1;
        
        if (attempt > 1) {
          this.logger.logToolWarning(context, `Retry attempt ${attempt}/${maxRetries}`);
        }
        
        const result = await this.performAnalysis(params);
        
        this.logger.logToolComplete(context, metrics, MCPToolStatus.Success, result);
        return result;
      } catch (error) {
        if (attempt === maxRetries) {
          this.logger.logToolError(context, metrics, error as Error);
          throw error;
        }
        
        // Log retry
        this.logger.logToolWarning(context, `Attempt ${attempt} failed, retrying...`, {
          error: (error as Error).message,
          nextAttempt: attempt + 1
        });
      }
    }
  }

  /**
   * Example method with partial results
   */
  public async executeWithPartialResults(params: any): Promise<any> {
    const context: MCPToolContext = {
      toolName: this.name,
      operation: 'analyze_partial',
      parameters: params
    };

    const metrics = this.logger.logToolStart(context);
    
    try {
      const results = {
        completed: [] as any[],
        failed: [] as any[],
        warnings: [] as string[]
      };

      // Process multiple items
      for (const item of params.items) {
        try {
          const result = await this.processItem(item);
          results.completed.push(result);
        } catch (error) {
          results.failed.push({ item, error: (error as Error).message });
          results.warnings.push(`Failed to process ${item}: ${(error as Error).message}`);
        }
      }

      // Determine status based on results
      const status = results.failed.length === 0 
        ? MCPToolStatus.Success 
        : results.completed.length > 0 
          ? MCPToolStatus.Partial 
          : MCPToolStatus.Failure;

      this.logger.logToolComplete(context, metrics, status, results);
      
      return results;
    } catch (error) {
      this.logger.logToolError(context, metrics, error as Error);
      throw error;
    }
  }

  // Helper methods
  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateTraceId(): string {
    return `trace-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateCacheKey(params: any): string {
    return `example:${JSON.stringify(params)}`;
  }

  private async checkCache(key: string): Promise<any> {
    // Simulated cache check
    return null;
  }

  private async performAnalysis(params: any): Promise<any> {
    // Simulated analysis
    return { status: 'completed', data: params };
  }

  private async processItem(item: any): Promise<any> {
    // Simulated item processing
    return { item, processed: true };
  }
}

/**
 * Usage example
 */
export async function exampleUsage(): Promise<void> {
  const tool = new ExampleMCPTool();
  const logger = getMCPLogger();

  try {
    // Basic execution
    await tool.execute({ projectPath: '/path/to/project' });

    // With retry
    await tool.executeWithRetry({ projectPath: '/path/to/project' }, 3);

    // With partial results
    await tool.executeWithPartialResults({ 
      items: ['file1.ts', 'file2.ts', 'file3.ts'] 
    });

    // Get metrics
    const toolMetrics = logger.getToolMetrics(tool.name);
    console.log('Tool metrics:', toolMetrics);

    // Get execution history
    const history = logger.getExecutionHistory(tool.name, 10);
    console.log('Recent executions:', history.length);

  } catch (error) {
    console.error('Example failed:', error);
  }
}