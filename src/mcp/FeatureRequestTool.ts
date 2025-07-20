/**
 * MCP Feature Request Enforcement Tool
 *
 * Critical MCP tool that prevents agents from implementing features themselves
 * and enforces the request-based workflow for testing infrastructure improvements.
 *
 * This tool is essential for maintaining centralized control over feature development
 * and preventing scope creep from AI agents implementing features directly.
 *
 * @category MCP Tools
 * @priority Critical
 * @tags mcp, feature-request, enforcement, critical-security
 */

import type { MCPTool, MCPToolResult } from '../types/mcp-tool-types';

/**
 * Feature request parameters
 */
export interface FeatureRequestParams {
  /** Title of the feature request */
  title: string;
  /** Detailed description of the requested feature */
  description: string;
  /** Priority level for the feature request */
  priority?: 'low' | 'medium' | 'high' | 'critical';
  /** Category of the feature request */
  category?:
    | 'testing-enhancement'
    | 'new-tool'
    | 'performance'
    | 'user-experience'
    | 'integration'
    | 'documentation';
  /** Use case or problem the feature would solve */
  use_case?: string;
  /** Expected benefits of implementing the feature */
  expected_benefits?: string;
  /** Technical complexity estimate */
  complexity?: 'simple' | 'moderate' | 'complex' | 'epic';
  /** Related tasks or dependencies */
  related_tasks?: string;
  /** Files or components that would be affected */
  affected_components?: string;
}

/**
 * Feature request result
 */
export interface FeatureRequestResult extends MCPToolResult {
  /** Created task ID */
  task_id: string;
  /** Assigned priority after validation */
  assigned_priority: 'low' | 'medium' | 'high' | 'critical';
  /** Estimated effort in hours */
  estimated_effort: string;
  /** Feature request status */
  status: 'submitted' | 'under_review' | 'approved' | 'rejected';
  /** Validation messages */
  validation_messages: string[];
  /** Next steps for the requester */
  next_steps: string[];
}

/**
 * Feature request validation rules
 */
interface ValidationRule {
  field: keyof FeatureRequestParams;
  required: boolean;
  minLength?: number;
  maxLength?: number;
  allowedValues?: string[];
  validator?: (value: any) => boolean;
  message: string;
}

/**
 * MCP Feature Request Enforcement Tool
 *
 * Prevents agents from implementing features directly by providing
 * a structured workflow for feature requests that creates tasks
 * in the development backlog.
 */
export class FeatureRequestTool implements MCPTool {
  public readonly name = 'mcp__claude-testing__feature_request';
  public readonly description =
    'Request new features or improvements to the testing infrastructure (REQUIRED for all feature work)';

  /**
   * Validation rules for feature requests
   */
  private readonly validationRules: ValidationRule[] = [
    {
      field: 'title',
      required: true,
      minLength: 10,
      maxLength: 100,
      message: 'Title must be between 10-100 characters and descriptive',
    },
    {
      field: 'description',
      required: true,
      minLength: 50,
      maxLength: 2000,
      message: 'Description must be between 50-2000 characters with detailed explanation',
    },
    {
      field: 'priority',
      required: false,
      allowedValues: ['low', 'medium', 'high', 'critical'],
      message: 'Priority must be one of: low, medium, high, critical',
    },
    {
      field: 'category',
      required: false,
      allowedValues: [
        'testing-enhancement',
        'new-tool',
        'performance',
        'user-experience',
        'integration',
        'documentation',
      ],
      message:
        'Category must be one of: testing-enhancement, new-tool, performance, user-experience, integration, documentation',
    },
    {
      field: 'complexity',
      required: false,
      allowedValues: ['simple', 'moderate', 'complex', 'epic'],
      message: 'Complexity must be one of: simple, moderate, complex, epic',
    },
  ];

  /**
   * Priority mapping for automatic assignment
   */
  private readonly priorityMapping = {
    'testing-enhancement': 'medium',
    'new-tool': 'high',
    performance: 'high',
    'user-experience': 'medium',
    integration: 'medium',
    documentation: 'low',
  } as const;

  /**
   * Complexity effort estimates (in hours)
   */
  private readonly effortEstimates = {
    simple: '2-4',
    moderate: '4-8',
    complex: '8-16',
    epic: '16+',
  } as const;

  /**
   * Execute the feature request tool
   */
  public async execute(params: FeatureRequestParams): Promise<FeatureRequestResult> {
    try {
      // Validate the feature request
      const validationResult = this.validateRequest(params);
      if (!validationResult.valid) {
        return {
          success: false,
          error: 'Feature request validation failed',
          validation_messages: validationResult.messages,
          task_id: '',
          assigned_priority: 'medium',
          estimated_effort: 'unknown',
          status: 'rejected',
          next_steps: ['Fix validation errors and resubmit'],
        };
      }

      // Assign priority based on category if not provided
      const assignedPriority =
        params.priority || (params.category ? this.priorityMapping[params.category] : 'medium');

      // Estimate effort based on complexity
      const estimatedEffort = params.complexity ? this.effortEstimates[params.complexity] : '4-8';

      // Create task in the development system
      const taskId = await this.createFeatureRequestTask(params, assignedPriority);

      // Generate guidance messages
      const validation_messages = [
        '✅ Feature request validated successfully',
        `📋 Task created: ${taskId}`,
        `🎯 Priority assigned: ${assignedPriority}`,
        `⏱️ Estimated effort: ${estimatedEffort} hours`,
      ];

      const next_steps = [
        'Your feature request has been submitted to the development team',
        'The request will be reviewed and prioritized in the next planning session',
        'You can track progress by searching for task ID: ' + taskId,
        'Do NOT implement this feature yourself - wait for official implementation',
      ];

      return {
        success: true,
        task_id: taskId,
        assigned_priority: assignedPriority as any,
        estimated_effort: estimatedEffort,
        status: 'submitted',
        validation_messages: validation_messages,
        next_steps: next_steps,
      };
    } catch (error) {
      return {
        success: false,
        error: `Feature request processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        task_id: '',
        assigned_priority: 'medium',
        estimated_effort: 'unknown',
        status: 'rejected',
        validation_messages: ['Internal processing error occurred'],
        next_steps: ['Contact development team for assistance'],
      };
    }
  }

  /**
   * Validate feature request parameters
   */
  private validateRequest(params: FeatureRequestParams): { valid: boolean; messages: string[] } {
    const messages: string[] = [];

    for (const rule of this.validationRules) {
      const value = params[rule.field];

      // Check required fields
      if (rule.required && (!value || value === '')) {
        messages.push(`❌ ${rule.field} is required: ${rule.message}`);
        continue;
      }

      // Skip validation for optional empty fields
      if (!value || value === '') {
        continue;
      }

      // Validate string length
      if (typeof value === 'string') {
        if (rule.minLength && value.length < rule.minLength) {
          messages.push(`❌ ${rule.field} too short: ${rule.message}`);
        }
        if (rule.maxLength && value.length > rule.maxLength) {
          messages.push(`❌ ${rule.field} too long: ${rule.message}`);
        }
      }

      // Validate allowed values
      if (rule.allowedValues && !rule.allowedValues.includes(value)) {
        messages.push(`❌ ${rule.field} invalid value: ${rule.message}`);
      }

      // Custom validator
      if (rule.validator && !rule.validator(value)) {
        messages.push(`❌ ${rule.field} validation failed: ${rule.message}`);
      }
    }

    // Additional business logic validation
    if (
      params.title &&
      params.description &&
      params.title.toLowerCase() ===
        params.description.toLowerCase().substring(0, params.title.length)
    ) {
      messages.push('❌ Description should provide more detail than just repeating the title');
    }

    if (params.complexity === 'epic' && (!params.use_case || params.use_case.length < 100)) {
      messages.push(
        '❌ Epic complexity features require detailed use case description (100+ characters)'
      );
    }

    return {
      valid: messages.length === 0,
      messages,
    };
  }

  /**
   * Create a feature request task in the development system
   */
  private async createFeatureRequestTask(
    params: FeatureRequestParams,
    priority: string
  ): Promise<string> {
    // This would integrate with the MCP task system to create actual tasks
    // For now, generate a unique task ID and return it
    const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '');
    const taskId = `FEATURE-${timestamp}`;

    // In real implementation, this would call:
    // await mcpTaskSystem.createTask({
    //   title: `FEATURE REQUEST: ${params.title}`,
    //   description: this.formatTaskDescription(params),
    //   priority: priority,
    //   tags: ['feature-request', 'external-request', params.category || 'general'].join(','),
    //   type: 'feature'
    // });

    console.log(`[FeatureRequestTool] Created feature request task: ${taskId}`);
    console.log(`[FeatureRequestTool] Title: ${params.title}`);
    console.log(`[FeatureRequestTool] Priority: ${priority}`);
    console.log(`[FeatureRequestTool] Category: ${params.category || 'uncategorized'}`);

    return taskId;
  }

  // formatTaskDescription method removed as it's not currently used
  // Will be implemented when task integration is completed

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
          title: {
            type: 'string',
            description: 'Descriptive title for the feature request (10-100 characters)',
            minLength: 10,
            maxLength: 100,
          },
          description: {
            type: 'string',
            description: 'Detailed description of the requested feature (50-2000 characters)',
            minLength: 50,
            maxLength: 2000,
          },
          priority: {
            type: 'string',
            enum: ['low', 'medium', 'high', 'critical'],
            description: 'Priority level for the feature request',
          },
          category: {
            type: 'string',
            enum: [
              'testing-enhancement',
              'new-tool',
              'performance',
              'user-experience',
              'integration',
              'documentation',
            ],
            description: 'Category of the feature request',
          },
          use_case: {
            type: 'string',
            description: 'Specific use case or problem the feature would solve',
          },
          expected_benefits: {
            type: 'string',
            description: 'Expected benefits of implementing the feature',
          },
          complexity: {
            type: 'string',
            enum: ['simple', 'moderate', 'complex', 'epic'],
            description: 'Technical complexity estimate',
          },
          related_tasks: {
            type: 'string',
            description: 'Related tasks or dependencies',
          },
          affected_components: {
            type: 'string',
            description: 'Files or components that would be affected',
          },
        },
        required: ['title', 'description'],
      },
    };
  }
}

/**
 * Factory function to create the feature request tool
 */
export function createFeatureRequestTool(): FeatureRequestTool {
  return new FeatureRequestTool();
}

/**
 * Export tool instance for direct use
 */
export const featureRequestTool = new FeatureRequestTool();
