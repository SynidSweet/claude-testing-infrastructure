/**
 * MCP Gap Request Tool
 *
 * Core MCP tool for requesting test coverage for specific functionality.
 * This tool analyzes missing test coverage and creates tasks in the claude-testing
 * task MCP system for automatic task creation.
 *
 * Implements TASK-2025-173: Create task integration with MCP system
 *
 * @module mcp/tools/GapRequestTool
 */

import { logger } from '../../utils/logger';
import {
  GapRequestSchema,
  type GapRequestParams,
  type GapRequestResult,
  type MCPToolError,
  MCPErrorCode,
  GapType,
} from '../tool-interfaces';
import type { MCPErrorResponse } from '../services/MCPErrorHandler';
import { MCPTaskIntegrationService } from '../services/MCPTaskIntegration';
import { handleMCPError, withCircuitBreaker } from '../services/MCPErrorHandler';
import { getMCPLogger, MCPToolStatus, type MCPToolContext } from '../services/MCPLoggingService';

/**
 * Gap Request Tool implementation
 */
export class GapRequestTool {
  public readonly name = 'mcp__claude-testing__gap_request';
  public readonly description = 'Request test coverage for specific functionality and create tracking tasks';

  private taskIntegrationService: MCPTaskIntegrationService;
  private mcpLogger = getMCPLogger();

  constructor() {
    this.taskIntegrationService = MCPTaskIntegrationService.getInstance();
  }

  /**
   * Execute the gap request tool
   */
  public async execute(params: unknown): Promise<GapRequestResult | MCPToolError | MCPErrorResponse> {
    // Create logging context
    const context: MCPToolContext = {
      toolName: this.name,
      operation: 'create_gap_request',
      parameters: params as Record<string, unknown>,
      sessionId: this.generateSessionId(),
      traceId: this.generateTraceId()
    };

    // Start logging
    const metrics = this.mcpLogger.logToolStart(context);

    return withCircuitBreaker('gap_request', async () => {
      try {
        // Validate input parameters
        const validatedParams = await this.validateParams(params);
        if (!validatedParams.success) {
          const error = {
            code: MCPErrorCode.InvalidInput,
            message: 'Gap request validation failed',
            details: { errors: validatedParams.errors || [] },
            suggestion: 'Please provide valid parameters according to the schema',
            documentation: 'See GapRequestSchema for required parameters',
          } as MCPToolError;
          
          this.mcpLogger.logToolComplete(context, metrics, MCPToolStatus.Failure, error);
          return error;
        }

        logger.info('Processing gap request', {
          component: validatedParams.data.component,
          gapType: validatedParams.data.gapType,
          priority: validatedParams.data.priority,
        });

        // Additional business validation
        const businessValidation = await this.validateBusinessRules(validatedParams.data);
        if (!businessValidation.valid) {
          const error = {
            code: MCPErrorCode.InvalidInput,
            message: 'Business rule validation failed',
            details: { issues: businessValidation.issues },
            suggestion: businessValidation.suggestion,
          } as MCPToolError;
          
          this.mcpLogger.logToolComplete(context, metrics, MCPToolStatus.Failure, error);
          return error;
        }

        // Create task from gap request
        const result = await this.taskIntegrationService.createTaskFromGap(validatedParams.data);

        logger.info('Successfully processed gap request', {
          taskId: result.taskCreated.id,
          component: validatedParams.data.component,
          urgencyScore: result.validation.urgencyScore,
        });

        // Log successful completion
        this.mcpLogger.logToolComplete(context, metrics, MCPToolStatus.Success, result);

        return result;
      } catch (error) {
        // Log error with MCP logging service
        this.mcpLogger.logToolError(context, metrics, error as Error);
        
        const mcpError = await handleMCPError(error as Error, 'gap_request', 'Gap request processing');
        logger.error('Gap request processing failed', {
          error: mcpError.error.message,
          category: mcpError.error.category,
          severity: mcpError.error.severity,
        });
        return mcpError;
      }
    });
  }

  /**
   * Validate input parameters against schema
   */
  private async validateParams(
    params: unknown
  ): Promise<{ success: true; data: GapRequestParams } | { success: false; errors: string[] }> {
    try {
      const data = GapRequestSchema.parse(params);
      return { success: true, data };
    } catch (error) {
      const errors: string[] = [];

      if (error && typeof error === 'object' && 'errors' in error) {
        const zodErrors = error.errors as Array<{ path: (string | number)[]; message: string }>;
        for (const zodError of zodErrors) {
          errors.push(`${zodError.path.join('.')}: ${zodError.message}`);
        }
      } else {
        errors.push('Invalid input format');
      }

      return { success: false, errors };
    }
  }

  /**
   * Validate business rules for gap requests
   */
  private async validateBusinessRules(
    params: GapRequestParams
  ): Promise<{ valid: boolean; issues?: string[]; suggestion?: string }> {
    const issues: string[] = [];

    // Validate target project exists and is accessible
    if (!params.targetProject || params.targetProject.trim().length === 0) {
      issues.push('Target project path is required');
    }

    // Validate component path format
    if (!params.component || params.component.trim().length === 0) {
      issues.push('Component path is required');
    } else {
      // Check for valid file extension or component format
      const validExtensions = ['.js', '.ts', '.jsx', '.tsx', '.py', '.vue', '.svelte'];
      const hasValidExtension = validExtensions.some(ext => params.component.endsWith(ext));
      const isDirectoryPath = !params.component.includes('.');

      if (!hasValidExtension && !isDirectoryPath) {
        issues.push('Component should be a valid file path or directory');
      }
    }

    // Validate description quality
    if (params.description.length < 20) {
      issues.push('Description should be at least 20 characters for meaningful gap analysis');
    }

    // Validate context consistency
    if (params.context?.currentCoverage !== undefined) {
      if (params.context.currentCoverage < 0 || params.context.currentCoverage > 100) {
        issues.push('Current coverage must be between 0 and 100');
      }

      // Check if gap type matches coverage situation
      if (params.gapType === GapType.LowCoverage && params.context.currentCoverage > 80) {
        issues.push('Low coverage gap type but current coverage is high (>80%)');
      }
    }

    // Validate related files if provided
    if (params.context?.relatedFiles?.length) {
      for (const file of params.context.relatedFiles) {
        if (!file.trim() || file.includes('..')) {
          issues.push('Related files contain invalid paths');
          break;
        }
      }
    }

    // Validate dependencies format
    if (params.context?.dependencies?.length) {
      for (const dep of params.context.dependencies) {
        if (!dep.trim()) {
          issues.push('Dependencies list contains empty entries');
          break;
        }
      }
    }

    // Provide helpful suggestions
    let suggestion = '';
    if (issues.length > 0) {
      suggestion = 'Please fix the validation issues and resubmit the gap request';
      
      if (issues.some(issue => issue.includes('Component'))) {
        suggestion += '. For component paths, use relative paths like "src/components/Button.tsx" or "utils/helpers"';
      }

      if (issues.some(issue => issue.includes('coverage'))) {
        suggestion += '. Ensure coverage values are realistic and match the gap type';
      }
    }

    return {
      valid: issues.length === 0,
      ...(issues.length > 0 && { issues }),
      ...(suggestion && { suggestion }),
    };
  }

  /**
   * Get tool schema for MCP registration
   */
  public getSchema() {
    return {
      name: this.name,
      description: this.description,
      inputSchema: {
        type: 'object' as const,
        properties: {
          targetProject: {
            type: 'string',
            description: 'Path to the target project needing test coverage',
            minLength: 1,
          },
          component: {
            type: 'string',
            description: 'Specific component or file needing tests (e.g., "src/utils/helper.ts")',
            minLength: 1,
          },
          gapType: {
            type: 'string',
            enum: Object.values(GapType),
            description: 'Type of test gap identified',
          },
          priority: {
            type: 'string',
            enum: ['low', 'medium', 'high', 'critical'],
            default: 'medium',
            description: 'Priority level for addressing this gap',
          },
          description: {
            type: 'string',
            description: 'Detailed description of the gap and why it needs to be addressed',
            minLength: 20,
          },
          context: {
            type: 'object',
            description: 'Additional context about the gap',
            properties: {
              currentCoverage: {
                type: 'number',
                minimum: 0,
                maximum: 100,
                description: 'Current test coverage percentage for this component',
              },
              relatedFiles: {
                type: 'array',
                items: { type: 'string' },
                description: 'List of related files that should be considered',
              },
              dependencies: {
                type: 'array',
                items: { type: 'string' },
                description: 'Dependencies that need to be considered for testing',
              },
              specialRequirements: {
                type: 'string',
                description: 'Any special testing requirements or constraints',
              },
            },
            additionalProperties: false,
          },
        },
        required: ['targetProject', 'component', 'gapType', 'description'],
        additionalProperties: false,
      },
    };
  }

  /**
   * Get tool metadata
   */
  public getMetadata() {
    return {
      category: 'Gap Analysis & Requests',
      tags: ['gap', 'request', 'task-creation', 'testing'],
      complexity: 'medium' as const,
      expectedResponseTime: 3000, // 3 seconds
      requiresAuth: false,
      cacheable: false, // Each request creates a new task
    };
  }

  /**
   * Generate session ID for logging context
   */
  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate trace ID for logging context
   */
  private generateTraceId(): string {
    return `trace-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Factory function to create the gap request tool
 */
export function createGapRequestTool(): GapRequestTool {
  return new GapRequestTool();
}

/**
 * Export tool instance for direct use
 */
export const gapRequestTool = createGapRequestTool();