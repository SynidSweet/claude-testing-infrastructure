/**
 * MCP Task Client
 *
 * Client interface for integrating with the claude-testing MCP task management system.
 * This provides a programmatic interface to create, update, and manage tasks
 * from within the MCP testing service.
 *
 * @module mcp/services/MCPTaskClient
 */

import { logger } from '../../utils/logger';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * MCP Task System Client Configuration
 */
export interface MCPTaskClientConfig {
  endpoint?: string;
  timeout?: number;
  retryAttempts?: number;
  enableCaching?: boolean;
  transportType?: 'stdio' | 'http' | 'cli';
  httpOptions?: {
    url: string;
    headers?: Record<string, string>;
  };
  stdioOptions?: {
    command: string;
    args?: string[];
    env?: Record<string, string>;
  };
  cliOptions?: {
    command?: string; // defaults to 'claude-tasks'
  };
}

/**
 * Task creation parameters for MCP task system
 */
export interface MCPTaskParams {
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  tags?: string;
  complexity?: 'low' | 'medium' | 'high';
  parent_id?: string;
  context?: {
    files?: string[];
    commands?: string[];
    constraints?: string[];
  };
}

/**
 * Task creation result from MCP task system
 */
export interface MCPTaskResult {
  task_id: string;
  title: string;
  priority: string;
  status: string;
  created_at: string;
  sprint_id?: string;
}

/**
 * MCP Task System Client
 */
export class MCPTaskClient {
  private config: MCPTaskClientConfig;
  private isConnected: boolean = false;

  constructor(config: MCPTaskClientConfig = {}) {
    this.config = {
      endpoint: 'mcp://claude-tasks',
      timeout: 5000,
      retryAttempts: 3,
      enableCaching: false,
      transportType: 'cli',
      cliOptions: {
        command: 'claude-tasks',
      },
      ...config,
    };
  }

  /**
   * Initialize and connect the MCP client
   */
  private async ensureConnected(): Promise<void> {
    if (this.isConnected) {
      return;
    }

    // For CLI transport, we just mark as connected since we'll use direct CLI calls
    if (this.config.transportType === 'cli') {
      this.isConnected = true;
      logger.info('MCP client using CLI transport', {
        command: this.config.cliOptions?.command || 'claude-tasks',
      });
      return;
    }

    // For other transports, throw error as they're not implemented yet
    throw new Error(`Transport type ${this.config.transportType} not yet implemented. Use 'cli' transport.`);
  }

  /**
   * Disconnect the MCP client
   */
  async disconnect(): Promise<void> {
    if (this.isConnected) {
      this.isConnected = false;
      logger.info('MCP client disconnected');
    }
  }

  /**
   * Create a new task in the MCP task system
   */
  async createTask(params: MCPTaskParams): Promise<MCPTaskResult> {
    try {
      logger.info('Creating task via MCP task system', {
        title: params.title,
        priority: params.priority,
        tags: params.tags,
      });

      // Ensure MCP client is connected
      await this.ensureConnected();

      // Call the MCP task creation tool
      const response = await this.callMCPTool('mcp__claude-tasks__task_create', {
        title: params.title,
        description: params.description,
        priority: params.priority,
        tags: params.tags,
        complexity: params.complexity,
        parent_id: params.parent_id,
        notes: 'Created via MCP Gap Request System',
      });

      // Parse the response
      const taskData = response.task || response;
      
      const result: MCPTaskResult = {
        task_id: taskData.id,
        title: taskData.title,
        priority: taskData.priority,
        status: taskData.status,
        created_at: taskData.created_at,
        sprint_id: taskData.sprint_id,
      };

      logger.info('Successfully created MCP task', {
        taskId: result.task_id,
        title: result.title,
      });

      return result;
    } catch (error) {
      logger.error('Failed to create MCP task', {
        error: error instanceof Error ? error.message : 'Unknown error',
        params,
      });
      throw new Error(`MCP task creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Search for existing tasks to check for duplicates
   */
  async searchTasks(query: string, filters?: {
    status?: string;
    priority?: string;
    tags?: string;
  }): Promise<MCPTaskResult[]> {
    try {
      logger.debug('Searching for existing tasks', { query, filters });

      // Ensure MCP client is connected
      await this.ensureConnected();

      // Call the MCP task search tool
      const response = await this.callMCPTool('mcp__claude-tasks__task_search', {
        query,
        status: filters?.status,
        priority: filters?.priority,
        limit: '10',
      });
      
      // Parse and transform the response
      return response.tasks.map((task: any) => ({
        task_id: task.id,
        title: task.title,
        priority: task.priority,
        status: task.status,
        created_at: task.created_at,
        sprint_id: task.sprint_id,
      }));
    } catch (error) {
      logger.error('Failed to search MCP tasks', {
        error: error instanceof Error ? error.message : 'Unknown error',
        query,
        filters,
      });
      return [];
    }
  }

  /**
   * Get current sprint information
   */
  async getCurrentSprint(): Promise<{
    sprint_id?: string;
    title?: string;
    task_count?: number;
  } | null> {
    try {
      logger.debug('Getting current sprint information');

      // Ensure MCP client is connected
      await this.ensureConnected();

      // Call the MCP sprint current tool
      const response = await this.callMCPTool('mcp__claude-tasks__sprint_current', {
        include_tasks: false,
        include_progress: true,
      });
      
      if (response.active_sprint) {
        return {
          sprint_id: response.active_sprint.id,
          title: response.active_sprint.title,
          task_count: response.active_sprint.progress?.total_tasks || 0,
        };
      }

      return null;
    } catch (error) {
      logger.error('Failed to get current sprint', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Add task to current sprint
   */
  async addTaskToSprint(taskId: string, sprintId?: string): Promise<boolean> {
    try {
      logger.info('Adding task to sprint', { taskId, sprintId });

      // Ensure MCP client is connected
      await this.ensureConnected();

      // Get current sprint if not specified
      if (!sprintId) {
        const currentSprint = await this.getCurrentSprint();
        if (!currentSprint?.sprint_id) {
          logger.warn('No active sprint found, task will remain in backlog');
          return false;
        }
        sprintId = currentSprint.sprint_id;
      }

      // Call the MCP sprint add task tool
      await this.callMCPTool('mcp__claude-tasks__sprint_add_task', {
        sprint_id: sprintId,
        task_id: taskId,
      });

      logger.info('Successfully added task to sprint', { taskId, sprintId });
      return true;
    } catch (error) {
      logger.error('Failed to add task to sprint', {
        error: error instanceof Error ? error.message : 'Unknown error',
        taskId,
        sprintId,
      });
      return false;
    }
  }

  /**
   * Get project statistics for context
   */
  async getProjectStats(): Promise<{
    backlog_size: number;
    active_sprint_tasks: number;
    completion_rate: number;
  }> {
    try {
      logger.debug('Getting project statistics');

      // Ensure MCP client is connected
      await this.ensureConnected();

      // Call MCP tools in parallel for efficiency
      const [backlogStats, sprintStats] = await Promise.all([
        this.callMCPTool('mcp__claude-tasks__backlog_stats', {}),
        this.callMCPTool('mcp__claude-tasks__sprint_stats', {}),
      ]);
      
      return {
        backlog_size: backlogStats.total_tasks || 0,
        active_sprint_tasks: sprintStats.active_sprint_tasks || 0,
        completion_rate: sprintStats.average_completion_rate || 0,
      };
    } catch (error) {
      logger.error('Failed to get project statistics', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      // Return default stats on error
      return {
        backlog_size: 0,
        active_sprint_tasks: 0,
        completion_rate: 0,
      };
    }
  }


  /**
   * Call MCP tool using the appropriate transport
   */
  private async callMCPTool(toolName: string, params: any): Promise<any> {
    logger.debug('Calling MCP tool', { toolName, params });

    // For CLI transport, use direct CLI calls
    if (this.config.transportType === 'cli') {
      return this.callMCPToolViaCLI(toolName, params);
    }

    throw new Error(`Transport type ${this.config.transportType} not yet implemented for tool calls`);
  }

  /**
   * Call MCP tool via CLI command
   */
  private async callMCPToolViaCLI(toolName: string, params: any): Promise<any> {
    const command = this.config.cliOptions?.command || 'claude-tasks';
    
    // Map MCP tool names to CLI commands
    const toolMappings: Record<string, { command: string; transformer: (params: any) => string[] }> = {
      'mcp__claude-tasks__task_create': {
        command: 'task create',
        transformer: (p) => {
          const args = [`"${p.title}"`];
          if (p.description) args.push('--description', `"${p.description}"`);
          if (p.priority) args.push('--priority', p.priority);
          if (p.tags) args.push('--tags', `"${p.tags}"`);
          if (p.complexity) args.push('--complexity', p.complexity);
          if (p.parent_id) args.push('--parent-id', p.parent_id);
          if (p.notes) args.push('--notes', `"${p.notes}"`);
          return args;
        }
      },
      'mcp__claude-tasks__task_search': {
        command: 'task search',
        transformer: (p) => {
          const args = [`"${p.query}"`];
          if (p.status) args.push('--status', p.status);
          if (p.priority) args.push('--priority', p.priority);
          if (p.limit) args.push('--limit', p.limit);
          args.push('--json'); // Always get JSON output
          return args;
        }
      },
      'mcp__claude-tasks__sprint_current': {
        command: 'sprint current',
        transformer: (p) => {
          const args = ['--json'];
          if (p.include_tasks) args.push('--include-tasks');
          if (p.include_progress) args.push('--include-progress');
          return args;
        }
      },
      'mcp__claude-tasks__sprint_add_task': {
        command: 'sprint add-task',
        transformer: (p) => [p.sprint_id, p.task_id]
      },
      'mcp__claude-tasks__backlog_stats': {
        command: 'backlog stats',
        transformer: () => ['--json']
      },
      'mcp__claude-tasks__sprint_stats': {
        command: 'sprint stats',
        transformer: () => ['--json']
      },
    };

    const mapping = toolMappings[toolName];
    if (!mapping) {
      throw new Error(`CLI mapping not found for MCP tool: ${toolName}`);
    }

    const args = mapping.transformer(params);
    const fullCommand = `${command} ${mapping.command} ${args.join(' ')}`;

    logger.debug('Executing CLI command', { command: fullCommand });

    try {
      // Retry logic for resilience
      let lastError: Error | null = null;
      const maxRetries = this.config.retryAttempts || 3;
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const { stdout, stderr } = await execAsync(fullCommand, {
            timeout: this.config.timeout,
            env: { ...process.env, NO_COLOR: '1' } // Disable color output for parsing
          });

          if (stderr && !stderr.includes('Warning')) {
            logger.warn('CLI command produced stderr output', { stderr });
          }

          logger.debug('CLI command successful', { 
            toolName, 
            attempt,
            outputLength: stdout.length
          });

          // Parse the output
          try {
            // First try to parse as JSON
            return JSON.parse(stdout);
          } catch {
            // If not JSON, try to extract task ID from success messages
            if (toolName === 'mcp__claude-tasks__task_create') {
              const taskIdMatch = stdout.match(/Created task (TASK-[\d-]+)/);
              if (taskIdMatch) {
                return {
                  task: {
                    id: taskIdMatch[1],
                    title: params.title,
                    priority: params.priority || 'medium',
                    status: 'pending',
                    created_at: new Date().toISOString(),
                  }
                };
              }
            }
            
            // Return raw output if we can't parse it
            return { output: stdout };
          }
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
          
          if (attempt < maxRetries) {
            const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // Exponential backoff
            logger.warn(`CLI command failed, retrying in ${delay}ms`, {
              command: fullCommand,
              attempt,
              error: lastError.message,
            });
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }

      throw lastError || new Error(`Failed to execute CLI command after ${maxRetries} attempts`);
    } catch (error) {
      logger.error('CLI command execution failed', {
        command: fullCommand,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }
}