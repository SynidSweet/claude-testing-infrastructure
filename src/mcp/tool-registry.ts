/**
 * Tool Registration and Discovery System
 *
 * Comprehensive tool registration framework for FastMCP server that provides
 * tool discovery, metadata management, validation, and lifecycle management.
 *
 * Implements TASK-2025-170: Implement tool registration and discovery system
 */

import type { z } from 'zod';
import { logger } from '../utils/logger';
import type { Context } from 'fastmcp';

/**
 * Tool metadata interface
 */
export interface ToolMetadata {
  name: string;
  description: string;
  version: string;
  category: string;
  tags: string[];
  author?: string;
  documentation?: string;
  examples?: ToolExample[];
  dependencies?: string[];
  performance?: {
    expectedResponseTime?: number;
    complexity?: 'low' | 'medium' | 'high';
    resourceUsage?: 'light' | 'moderate' | 'heavy';
  };
}

/**
 * Tool example interface
 */
export interface ToolExample {
  title: string;
  description: string;
  input: Record<string, any>;
  expectedOutput?: Record<string, any>;
}

/**
 * Tool handler function type
 */
export type ToolHandler<T = any> = (params: T, context: Context<undefined>) => Promise<any>;

/**
 * Registered tool interface
 */
export interface RegisteredTool {
  metadata: ToolMetadata;
  parameters: z.ZodSchema<any>;
  handler: ToolHandler;
  registeredAt: Date;
  lastUsed?: Date;
  usageCount: number;
  isActive: boolean;
  validationResults?: ToolValidationResult;
}

/**
 * Tool validation result interface
 */
export interface ToolValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  validatedAt: Date;
}

/**
 * Tool discovery filter interface
 */
export interface ToolDiscoveryFilter {
  category?: string;
  tags?: string[];
  name?: string;
  isActive?: boolean;
  hasExamples?: boolean;
  complexity?: 'low' | 'medium' | 'high';
}

/**
 * Tool registration options
 */
export interface ToolRegistrationOptions {
  replaceExisting?: boolean;
  validateOnRegistration?: boolean;
  autoActivate?: boolean;
}

/**
 * Tool Registry System
 */
export class ToolRegistry {
  private tools = new Map<string, RegisteredTool>();
  private categories = new Set<string>();
  private tags = new Set<string>();

  /**
   * Register a new tool in the registry
   */
  public registerTool<T extends Record<string, any>>(
    metadata: ToolMetadata,
    parameters: z.ZodSchema<T>,
    handler: ToolHandler<T>,
    options: ToolRegistrationOptions = {}
  ): void {
    const { replaceExisting = false, validateOnRegistration = true, autoActivate = true } = options;

    // Check if tool already exists
    if (this.tools.has(metadata.name) && !replaceExisting) {
      throw new Error(
        `Tool '${metadata.name}' is already registered. Use replaceExisting: true to overwrite.`
      );
    }

    // Validate tool metadata
    if (validateOnRegistration) {
      const validation = this.validateTool(metadata, parameters);
      if (!validation.isValid) {
        throw new Error(`Tool validation failed: ${validation.errors.join(', ')}`);
      }
    }

    // Create registered tool entry
    const registeredTool: RegisteredTool = {
      metadata,
      parameters,
      handler,
      registeredAt: new Date(),
      usageCount: 0,
      isActive: autoActivate,
    };

    // Add validation results if validation is enabled
    if (validateOnRegistration) {
      registeredTool.validationResults = this.validateTool(metadata, parameters);
    }

    // Register the tool
    this.tools.set(metadata.name, registeredTool);
    this.categories.add(metadata.category);
    metadata.tags.forEach((tag) => this.tags.add(tag));

    logger.info('Tool registered in registry', {
      toolName: metadata.name,
      category: metadata.category,
      tags: metadata.tags,
      isActive: autoActivate,
    });
  }

  /**
   * Discover tools based on filter criteria
   */
  public discoverTools(filter: ToolDiscoveryFilter = {}): RegisteredTool[] {
    const results: RegisteredTool[] = [];

    for (const [name, tool] of this.tools) {
      // Apply filters
      if (filter.category && tool.metadata.category !== filter.category) {
        continue;
      }

      if (filter.name && !name.toLowerCase().includes(filter.name.toLowerCase())) {
        continue;
      }

      if (filter.isActive !== undefined && tool.isActive !== filter.isActive) {
        continue;
      }

      if (filter.hasExamples !== undefined) {
        const hasExamples = tool.metadata.examples && tool.metadata.examples.length > 0;
        if (hasExamples !== filter.hasExamples) {
          continue;
        }
      }

      if (filter.complexity && tool.metadata.performance?.complexity !== filter.complexity) {
        continue;
      }

      if (filter.tags && filter.tags.length > 0) {
        const hasAllTags = filter.tags.every((tag) => tool.metadata.tags.includes(tag));
        if (!hasAllTags) {
          continue;
        }
      }

      results.push(tool);
    }

    return results.sort((a, b) => a.metadata.name.localeCompare(b.metadata.name));
  }

  /**
   * Get tool by name
   */
  public getTool(name: string): RegisteredTool | undefined {
    return this.tools.get(name);
  }

  /**
   * Get all registered tools
   */
  public getAllTools(): RegisteredTool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get available categories
   */
  public getCategories(): string[] {
    return Array.from(this.categories).sort();
  }

  /**
   * Get available tags
   */
  public getTags(): string[] {
    return Array.from(this.tags).sort();
  }

  /**
   * Update tool metadata
   */
  public updateToolMetadata(name: string, metadata: Partial<ToolMetadata>): void {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Tool '${name}' not found`);
    }

    // Update metadata
    tool.metadata = { ...tool.metadata, ...metadata };

    // Update categories and tags sets
    this.categories.add(tool.metadata.category);
    tool.metadata.tags.forEach((tag) => this.tags.add(tag));

    logger.info('Tool metadata updated', {
      toolName: name,
      updatedFields: Object.keys(metadata),
    });
  }

  /**
   * Activate or deactivate a tool
   */
  public setToolActive(name: string, isActive: boolean): void {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Tool '${name}' not found`);
    }

    tool.isActive = isActive;
    logger.info('Tool status changed', {
      toolName: name,
      isActive,
    });
  }

  /**
   * Record tool usage
   */
  public recordToolUsage(name: string): void {
    const tool = this.tools.get(name);
    if (!tool) {
      return; // Silent fail for usage tracking
    }

    tool.usageCount++;
    tool.lastUsed = new Date();
  }

  /**
   * Get tool usage statistics
   */
  public getUsageStatistics(): {
    totalTools: number;
    activeTools: number;
    totalUsage: number;
    mostUsedTool: { name: string; usage: number } | undefined;
    leastUsedTool: { name: string; usage: number } | undefined;
    categoryCounts: Record<string, number>;
    tagCounts: Record<string, number>;
  } {
    const tools = Array.from(this.tools.values());
    const activeTools = tools.filter((t) => t.isActive);
    const totalUsage = tools.reduce((sum, t) => sum + t.usageCount, 0);

    // Find most and least used tools
    const sortedByUsage = tools
      .filter((t) => t.usageCount > 0)
      .sort((a, b) => b.usageCount - a.usageCount);
    const mostUsedTool =
      sortedByUsage.length > 0 && sortedByUsage[0]
        ? { name: sortedByUsage[0].metadata.name, usage: sortedByUsage[0].usageCount }
        : undefined;
    const lastTool = sortedByUsage[sortedByUsage.length - 1];
    const leastUsedTool =
      sortedByUsage.length > 0 && lastTool
        ? { name: lastTool.metadata.name, usage: lastTool.usageCount }
        : undefined;

    // Count by categories
    const categoryCounts: Record<string, number> = {};
    tools.forEach((tool) => {
      categoryCounts[tool.metadata.category] = (categoryCounts[tool.metadata.category] || 0) + 1;
    });

    // Count by tags
    const tagCounts: Record<string, number> = {};
    tools.forEach((tool) => {
      tool.metadata.tags.forEach((tag) => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });

    return {
      totalTools: tools.length,
      activeTools: activeTools.length,
      totalUsage,
      mostUsedTool,
      leastUsedTool,
      categoryCounts,
      tagCounts,
    };
  }

  /**
   * Validate a tool's metadata and parameters
   */
  public validateTool(metadata: ToolMetadata, parameters: z.ZodSchema<any>): ToolValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate required fields
    if (!metadata.name || metadata.name.trim().length === 0) {
      errors.push('Tool name is required');
    }

    if (!metadata.description || metadata.description.trim().length === 0) {
      errors.push('Tool description is required');
    }

    if (!metadata.category || metadata.category.trim().length === 0) {
      errors.push('Tool category is required');
    }

    if (!metadata.version || metadata.version.trim().length === 0) {
      errors.push('Tool version is required');
    }

    // Validate name format (alphanumeric, underscore, hyphen)
    if (metadata.name && !/^[a-zA-Z0-9_-]+$/.test(metadata.name)) {
      errors.push('Tool name must contain only alphanumeric characters, underscores, and hyphens');
    }

    // Validate version format (semantic versioning)
    if (metadata.version && !/^\d+\.\d+\.\d+(-[\w.-]+)?(\+[\w.-]+)?$/.test(metadata.version)) {
      warnings.push('Tool version should follow semantic versioning (e.g., 1.0.0)');
    }

    // Validate parameters schema
    try {
      parameters.parse({});
    } catch (error) {
      // This is expected for schemas with required fields
      // We're just checking if the schema is valid
    }

    // Check for examples
    if (!metadata.examples || metadata.examples.length === 0) {
      warnings.push('Tool should include usage examples');
    }

    // Check for documentation
    if (!metadata.documentation) {
      warnings.push('Tool should include documentation');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      validatedAt: new Date(),
    };
  }

  /**
   * Unregister a tool
   */
  public unregisterTool(name: string): void {
    if (!this.tools.has(name)) {
      throw new Error(`Tool '${name}' not found`);
    }

    this.tools.delete(name);
    logger.info('Tool unregistered', { toolName: name });
  }

  /**
   * Clear all tools
   */
  public clear(): void {
    this.tools.clear();
    this.categories.clear();
    this.tags.clear();
    logger.info('Tool registry cleared');
  }

  /**
   * Get registry health status
   */
  public getHealthStatus(): {
    status: 'healthy' | 'warning' | 'error';
    totalTools: number;
    activeTools: number;
    inactiveTools: number;
    toolsWithIssues: number;
    issues: string[];
  } {
    const tools = Array.from(this.tools.values());
    const activeTools = tools.filter((t) => t.isActive);
    const inactiveTools = tools.filter((t) => !t.isActive);
    const issues: string[] = [];
    let toolsWithIssues = 0;

    // Check for validation issues
    tools.forEach((tool) => {
      if (tool.validationResults && !tool.validationResults.isValid) {
        toolsWithIssues++;
        issues.push(
          `Tool '${tool.metadata.name}' has validation errors: ${tool.validationResults.errors.join(', ')}`
        );
      }
    });

    // Determine overall status
    let status: 'healthy' | 'warning' | 'error' = 'healthy';
    if (toolsWithIssues > 0) {
      status = 'error';
    } else if (inactiveTools.length > activeTools.length) {
      status = 'warning';
      issues.push('More inactive tools than active tools');
    }

    return {
      status,
      totalTools: tools.length,
      activeTools: activeTools.length,
      inactiveTools: inactiveTools.length,
      toolsWithIssues,
      issues,
    };
  }
}

/**
 * Default tool registry instance
 */
export const toolRegistry = new ToolRegistry();
