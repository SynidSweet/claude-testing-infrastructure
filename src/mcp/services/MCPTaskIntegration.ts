/**
 * MCP Task Integration Service
 *
 * Provides integration between the MCP gap request system and the claude-testing
 * task management system for automatic task creation from test coverage gaps.
 *
 * This service implements the core functionality for TASK-2025-173:
 * Create task integration with MCP system.
 *
 * @module mcp/services/MCPTaskIntegration
 */

import { logger } from '../../utils/logger';
import { GapType, type GapRequestParams, type GapRequestResult } from '../tool-interfaces';
import { MCPTaskClient, type MCPTaskParams } from './MCPTaskClient';

/**
 * Task priority mapping based on gap type and severity
 */
const GAP_PRIORITY_MAPPING = {
  [GapType.MissingTest]: {
    critical: 'critical' as const,
    high: 'high' as const,
    medium: 'medium' as const,
    low: 'low' as const,
  },
  [GapType.LowCoverage]: {
    critical: 'high' as const,
    high: 'medium' as const,
    medium: 'medium' as const,
    low: 'low' as const,
  },
  [GapType.UntestablCode]: {
    critical: 'critical' as const,
    high: 'high' as const,
    medium: 'medium' as const,
    low: 'medium' as const,
  },
  [GapType.EdgeCase]: {
    critical: 'high' as const,
    high: 'medium' as const,
    medium: 'medium' as const,
    low: 'low' as const,
  },
  [GapType.IntegrationGap]: {
    critical: 'critical' as const,
    high: 'high' as const,
    medium: 'medium' as const,
    low: 'medium' as const,
  },
} as const;

/**
 * Effort estimation based on gap type (in hours)
 */
const GAP_EFFORT_MAPPING = {
  [GapType.MissingTest]: { simple: 1, moderate: 3, complex: 6 },
  [GapType.LowCoverage]: { simple: 2, moderate: 4, complex: 8 },
  [GapType.UntestablCode]: { simple: 4, moderate: 8, complex: 16 },
  [GapType.EdgeCase]: { simple: 1, moderate: 2, complex: 4 },
  [GapType.IntegrationGap]: { simple: 3, moderate: 6, complex: 12 },
} as const;

/**
 * Task tags based on gap type
 */
const GAP_TAG_MAPPING = {
  [GapType.MissingTest]: ['gap-request', 'missing-test', 'testing'],
  [GapType.LowCoverage]: ['gap-request', 'low-coverage', 'testing', 'coverage'],
  [GapType.UntestablCode]: ['gap-request', 'untestable-code', 'refactoring', 'testing'],
  [GapType.EdgeCase]: ['gap-request', 'edge-case', 'testing', 'validation'],
  [GapType.IntegrationGap]: ['gap-request', 'integration-gap', 'testing', 'integration'],
} as const;

/**
 * MCP Task Creation Parameters
 */
export interface MCPTaskCreationParams {
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  tags: string[];
  estimatedEffort: number;
  gapType: GapType;
  targetProject: string;
  component: string;
  context?: {
    currentCoverage?: number;
    relatedFiles?: string[];
    dependencies?: string[];
    specialRequirements?: string;
  };
}

/**
 * MCP Task Creation Result
 */
export interface MCPTaskCreationResult {
  taskId: string;
  title: string;
  priority: string;
  tags: string[];
  estimatedEffort: number;
  created: boolean;
  isDuplicate: boolean;
  similarTasks: string[];
  urgencyScore: number;
}

/**
 * MCP Task Integration Service
 */
export class MCPTaskIntegrationService {
  private static instance: MCPTaskIntegrationService;
  private taskClient: MCPTaskClient;

  constructor() {
    this.taskClient = new MCPTaskClient();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): MCPTaskIntegrationService {
    if (!MCPTaskIntegrationService.instance) {
      MCPTaskIntegrationService.instance = new MCPTaskIntegrationService();
    }
    return MCPTaskIntegrationService.instance;
  }

  /**
   * Create a task from a gap request
   */
  public async createTaskFromGap(params: GapRequestParams): Promise<GapRequestResult> {
    try {
      logger.info('Creating task from gap request', {
        component: params.component,
        gapType: params.gapType,
        priority: params.priority,
      });

      // Generate task metadata
      const taskMetadata = this.generateTaskMetadata(params);

      // Check for duplicate tasks
      const duplicateCheck = await this.checkForDuplicates(taskMetadata);

      // Create the task
      const taskResult = await this.createTask(taskMetadata);

      // Calculate urgency score
      const urgencyScore = this.calculateUrgencyScore(params, taskMetadata);

      // Get project context
      const projectContext = await this.getProjectContext(params.targetProject);

      // Update duplicate status based on the duplicate check
      const isDuplicate = duplicateCheck.isDuplicate;
      const similarTasks = duplicateCheck.similarTasks;

      return {
        taskCreated: {
          id: taskResult.taskId,
          title: taskResult.title,
          priority: taskResult.priority,
          tags: taskResult.tags,
          estimatedEffort: taskResult.estimatedEffort,
        },
        validation: {
          isDuplicate,
          similarTasks,
          urgencyScore,
        },
        projectContext,
        metadata: {
          requestedAt: new Date(),
          requestId: this.generateRequestId(),
        },
      };
    } catch (error) {
      logger.error('Failed to create task from gap request', {
        error: error instanceof Error ? error.message : 'Unknown error',
        params,
      });
      throw new Error(
        `Failed to create task from gap request: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Generate task metadata from gap request parameters
   */
  private generateTaskMetadata(params: GapRequestParams): MCPTaskCreationParams {
    // Determine complexity based on gap type and component
    const complexity = this.determineComplexity(params);

    // Map priority based on gap type and severity
    const mappedPriority = GAP_PRIORITY_MAPPING[params.gapType][params.priority];

    // Calculate effort estimate
    const estimatedEffort = GAP_EFFORT_MAPPING[params.gapType][complexity];

    // Generate task title
    const title = this.generateTaskTitle(params);

    // Generate task description
    const description = this.generateTaskDescription(params);

    // Generate tags
    const tags = [
      ...GAP_TAG_MAPPING[params.gapType],
      complexity,
      `priority-${params.priority}`,
      'mcp-generated',
    ];

    const result: MCPTaskCreationParams = {
      title,
      description,
      priority: mappedPriority,
      tags,
      estimatedEffort,
      gapType: params.gapType,
      targetProject: params.targetProject,
      component: params.component,
    };

    if (params.context) {
      result.context = {
        ...(params.context.currentCoverage !== undefined && {
          currentCoverage: params.context.currentCoverage,
        }),
        ...(params.context.relatedFiles !== undefined && {
          relatedFiles: params.context.relatedFiles,
        }),
        ...(params.context.dependencies !== undefined && {
          dependencies: params.context.dependencies,
        }),
        ...(params.context.specialRequirements !== undefined && {
          specialRequirements: params.context.specialRequirements,
        }),
      };
    }

    return result;
  }

  /**
   * Generate task title from gap request
   */
  private generateTaskTitle(params: GapRequestParams): string {
    const gapTypeNames = {
      [GapType.MissingTest]: 'Missing Test Coverage',
      [GapType.LowCoverage]: 'Low Test Coverage',
      [GapType.UntestablCode]: 'Untestable Code Refactoring',
      [GapType.EdgeCase]: 'Edge Case Testing',
      [GapType.IntegrationGap]: 'Integration Test Gap',
    };

    const componentName = params.component.split('/').pop() ?? params.component;
    return `${gapTypeNames[params.gapType]}: ${componentName}`;
  }

  /**
   * Generate detailed task description
   */
  private generateTaskDescription(params: GapRequestParams): string {
    const sections = [
      `## Gap Request: ${params.gapType}`,
      `**Component**: ${params.component}`,
      `**Target Project**: ${params.targetProject}`,
      '',
      '## Description',
      params.description,
      '',
      '## Context',
    ];

    if (params.context?.currentCoverage !== undefined) {
      sections.push(`- **Current Coverage**: ${params.context.currentCoverage}%`);
    }

    if (params.context?.relatedFiles?.length) {
      sections.push(`- **Related Files**: ${params.context.relatedFiles.join(', ')}`);
    }

    if (params.context?.dependencies?.length) {
      sections.push(`- **Dependencies**: ${params.context.dependencies.join(', ')}`);
    }

    if (params.context?.specialRequirements) {
      sections.push(`- **Special Requirements**: ${params.context.specialRequirements}`);
    }

    sections.push(
      '',
      '## Acceptance Criteria',
      '- [ ] Implement missing test coverage',
      '- [ ] Achieve target coverage threshold',
      '- [ ] Validate test quality and effectiveness',
      '- [ ] Update documentation if needed',
      '',
      '---',
      '*Generated automatically by MCP Gap Request System*'
    );

    return sections.join('\n');
  }

  /**
   * Determine complexity based on gap type and component analysis
   */
  private determineComplexity(params: GapRequestParams): 'simple' | 'moderate' | 'complex' {
    // Simple heuristics for complexity determination
    const componentPath = params.component.toLowerCase();
    const description = params.description.toLowerCase();

    // Complex indicators
    if (
      componentPath.includes('integration') ||
      componentPath.includes('orchestrator') ||
      componentPath.includes('workflow') ||
      description.includes('complex') ||
      description.includes('multiple') ||
      description.includes('integration') ||
      (params.context?.dependencies?.length ?? 0) > 3
    ) {
      return 'complex';
    }

    // Simple indicators
    if (
      componentPath.includes('util') ||
      componentPath.includes('helper') ||
      componentPath.includes('constant') ||
      description.includes('simple') ||
      description.includes('basic') ||
      params.gapType === GapType.EdgeCase
    ) {
      return 'simple';
    }

    // Default to moderate
    return 'moderate';
  }

  /**
   * Check for duplicate or similar tasks
   */
  private async checkForDuplicates(
    taskMetadata: MCPTaskCreationParams
  ): Promise<{ isDuplicate: boolean; similarTasks: string[] }> {
    logger.debug('Checking for duplicate tasks', {
      component: taskMetadata.component,
      gapType: taskMetadata.gapType,
    });

    try {
      // Search for existing tasks related to this component
      const componentSearch = await this.taskClient.searchTasks(taskMetadata.component, {
        status: 'pending,in_progress',
      });

      // Search for tasks with similar gap type
      const gapTypeSearch = await this.taskClient.searchTasks(taskMetadata.gapType, {
        tags: 'gap-request',
      });

      // Combine and deduplicate results
      const allSimilarTasks = [...componentSearch, ...gapTypeSearch];
      const uniqueTasks = allSimilarTasks.filter(
        (task, index, array) => array.findIndex((t) => t.task_id === task.task_id) === index
      );

      // Check for exact duplicates (same component and gap type)
      const componentName = taskMetadata.component.split('/').pop() ?? taskMetadata.component;
      const exactDuplicates = uniqueTasks.filter((task) => {
        const titleLower = task.title.toLowerCase();
        const componentLower = componentName.toLowerCase();

        // Check if title contains the component name
        const hasComponent = titleLower.includes(componentLower);

        // Check if title contains gap type keywords
        const gapTypeKeywords = {
          'missing-test': ['missing test', 'test coverage'],
          'low-coverage': ['low coverage', 'coverage'],
          'untestable-code': ['untestable', 'refactoring'],
          'edge-case': ['edge case', 'edge-case'],
          'integration-gap': ['integration', 'integration gap'],
        };

        const keywords = gapTypeKeywords[taskMetadata.gapType] ?? [];
        const hasGapType = keywords.some((keyword) => titleLower.includes(keyword.toLowerCase()));

        return hasComponent && hasGapType;
      });

      return {
        isDuplicate: exactDuplicates.length > 0,
        similarTasks: uniqueTasks.map((task) => task.task_id).slice(0, 5), // Limit to 5 similar tasks
      };
    } catch (error) {
      logger.warn('Failed to check for duplicate tasks, proceeding anyway', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        isDuplicate: false,
        similarTasks: [],
      };
    }
  }

  /**
   * Create the actual task in the MCP task system
   */
  private async createTask(taskMetadata: MCPTaskCreationParams): Promise<MCPTaskCreationResult> {
    logger.info('Creating MCP task', {
      title: taskMetadata.title,
      priority: taskMetadata.priority,
      gapType: taskMetadata.gapType,
    });

    try {
      // Prepare task parameters for the MCP task system
      const taskParams: MCPTaskParams = {
        title: taskMetadata.title,
        description: taskMetadata.description,
        priority: taskMetadata.priority,
        tags: taskMetadata.tags.join(','),
        complexity: this.mapEffortToComplexity(taskMetadata.estimatedEffort),
        context: {
          files: taskMetadata.context?.relatedFiles ?? [],
          commands: [`# Test coverage for ${taskMetadata.component}`],
          constraints: [taskMetadata.context?.specialRequirements ?? ''].filter(Boolean),
        },
      };

      // Create the task using the MCP task client
      const mcpTaskResult = await this.taskClient.createTask(taskParams);

      // Try to add to current sprint if applicable
      const currentSprint = await this.taskClient.getCurrentSprint();
      if (currentSprint?.sprint_id) {
        await this.taskClient.addTaskToSprint(mcpTaskResult.task_id, currentSprint.sprint_id);
      }

      const result: MCPTaskCreationResult = {
        taskId: mcpTaskResult.task_id,
        title: mcpTaskResult.title,
        priority: mcpTaskResult.priority,
        tags: taskMetadata.tags,
        estimatedEffort: taskMetadata.estimatedEffort,
        created: true,
        isDuplicate: false,
        similarTasks: [],
        urgencyScore: 0, // Will be calculated separately
      };

      logger.info('Successfully created MCP task', {
        taskId: result.taskId,
        title: result.title,
        addedToSprint: !!currentSprint?.sprint_id,
      });

      return result;
    } catch (error) {
      logger.error('Failed to create MCP task', {
        error: error instanceof Error ? error.message : 'Unknown error',
        taskMetadata,
      });
      throw error;
    }
  }

  /**
   * Calculate urgency score based on gap parameters
   */
  private calculateUrgencyScore(
    params: GapRequestParams,
    _taskMetadata: MCPTaskCreationParams
  ): number {
    let score = 0;

    // Base score from priority
    const priorityScores = { low: 25, medium: 50, high: 75, critical: 100 };
    score += priorityScores[params.priority];

    // Gap type multipliers
    const gapTypeMultipliers = {
      [GapType.MissingTest]: 1.2,
      [GapType.LowCoverage]: 1.0,
      [GapType.UntestablCode]: 1.5,
      [GapType.EdgeCase]: 0.8,
      [GapType.IntegrationGap]: 1.3,
    };
    score *= gapTypeMultipliers[params.gapType];

    // Coverage impact
    if (params.context?.currentCoverage !== undefined) {
      if (params.context.currentCoverage < 50) score *= 1.3;
      else if (params.context.currentCoverage < 70) score *= 1.1;
    }

    // Complexity impact
    const complexity = this.determineComplexity(params);
    if (complexity === 'complex')
      score *= 0.9; // Lower urgency for complex tasks
    else if (complexity === 'simple') score *= 1.1; // Higher urgency for simple tasks

    return Math.min(Math.round(score), 100);
  }

  /**
   * Get project context information
   */
  private async getProjectContext(targetProject: string): Promise<{
    projectName: string;
    currentBacklogSize: number;
    estimatedCompletionTime: number;
  }> {
    // Extract project name from path
    const projectName = targetProject.split('/').pop() ?? 'unknown-project';

    try {
      // Get current project statistics from MCP task system
      const stats = await this.taskClient.getProjectStats();

      // Estimate completion time based on current completion rate
      // Assuming average 8 hours per working day and current completion rate
      const estimatedDays =
        stats.completion_rate > 0
          ? Math.ceil(stats.backlog_size / ((stats.completion_rate / 100) * 8))
          : 0;

      return {
        projectName,
        currentBacklogSize: stats.backlog_size,
        estimatedCompletionTime: estimatedDays,
      };
    } catch (error) {
      logger.warn('Failed to get project context from MCP task system', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        projectName,
        currentBacklogSize: 0,
        estimatedCompletionTime: 0,
      };
    }
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `REQ-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  }

  /**
   * Map effort hours to complexity level
   */
  private mapEffortToComplexity(effort: number): 'low' | 'medium' | 'high' {
    if (effort <= 2) return 'low';
    if (effort <= 6) return 'medium';
    return 'high';
  }
}
