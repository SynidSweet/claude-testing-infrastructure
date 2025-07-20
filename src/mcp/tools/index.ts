/**
 * MCP Tools Index
 * 
 * Central export point for all MCP tool interfaces, schemas, and types.
 * This file re-exports all tool-related definitions for easy import.
 */

// Re-export everything from tool-interfaces
export * from '../tool-interfaces';

// Tool implementations
export * from './GapRequestTool';
export * from './ProjectAnalyzeTool';
export * from './CoverageCheckTool';
export * from './TestGenerateTool';
export * from './TestRunTool';
export * from './CachePerformanceMonitorTool';
export * from './CacheWarmupTool';
export * from './ConfigGetTool';
export * from './ConfigSetTool';

// Tool categories for easy reference
export const TOOL_CATEGORIES = {
  CORE_TESTING: 'Core Testing',
  GAP_ANALYSIS: 'Gap Analysis & Requests',
  INCREMENTAL: 'Incremental & Maintenance',
  CONFIGURATION: 'Configuration Management',
  INFRASTRUCTURE: 'Infrastructure',
  PERFORMANCE: 'Performance & Optimization',
} as const;

// Tool names mapping
export const MCP_TOOLS = {
  // Core Testing Tools
  PROJECT_ANALYZE: 'mcp__claude-testing__project_analyze',
  TEST_GENERATE: 'mcp__claude-testing__test_generate',
  TEST_RUN: 'mcp__claude-testing__test_run',
  COVERAGE_CHECK: 'mcp__claude-testing__coverage_check',
  
  // Gap Analysis & Request Tools
  GAP_REQUEST: 'mcp__claude-testing__gap_request',
  FEATURE_REQUEST: 'mcp__claude-testing__feature_request',
  
  // Incremental & Maintenance Tools
  INCREMENTAL_UPDATE: 'mcp__claude-testing__incremental_update',
  WATCH_CHANGES: 'mcp__claude-testing__watch_changes',
  
  // Configuration Management Tools
  CONFIG_GET: 'mcp__claude-testing__config_get',
  CONFIG_SET: 'mcp__claude-testing__config_set',
  
  // Infrastructure Tools
  REGISTER_TOOL: 'mcp__claude-testing__register_tool',
  SERVER_HEALTH: 'mcp__claude-testing__server_health',
  
  // Performance & Optimization Tools
  CACHE_PERFORMANCE_MONITOR: 'mcp__claude-testing__cache_performance_monitor',
  CACHE_WARMUP: 'mcp__claude-testing__cache_warmup',
} as const;

// Tool metadata for registration
export const TOOL_METADATA = {
  [MCP_TOOLS.PROJECT_ANALYZE]: {
    category: TOOL_CATEGORIES.CORE_TESTING,
    tags: ['analysis', 'project', 'components'],
    complexity: 'medium' as const,
    expectedResponseTime: 10000, // 10 seconds
  },
  [MCP_TOOLS.TEST_GENERATE]: {
    category: TOOL_CATEGORIES.CORE_TESTING,
    tags: ['generation', 'tests', 'ai'],
    complexity: 'high' as const,
    expectedResponseTime: 30000, // 30 seconds
  },
  [MCP_TOOLS.TEST_RUN]: {
    category: TOOL_CATEGORIES.CORE_TESTING,
    tags: ['execution', 'tests', 'coverage'],
    complexity: 'medium' as const,
    expectedResponseTime: 60000, // 60 seconds
  },
  [MCP_TOOLS.COVERAGE_CHECK]: {
    category: TOOL_CATEGORIES.CORE_TESTING,
    tags: ['coverage', 'analysis', 'gaps'],
    complexity: 'low' as const,
    expectedResponseTime: 5000, // 5 seconds
  },
  [MCP_TOOLS.GAP_REQUEST]: {
    category: TOOL_CATEGORIES.GAP_ANALYSIS,
    tags: ['gap', 'request', 'task-creation'],
    complexity: 'medium' as const,
    expectedResponseTime: 3000, // 3 seconds
  },
  [MCP_TOOLS.FEATURE_REQUEST]: {
    category: TOOL_CATEGORIES.GAP_ANALYSIS,
    tags: ['feature', 'request', 'enhancement'],
    complexity: 'low' as const,
    expectedResponseTime: 2000, // 2 seconds
  },
  [MCP_TOOLS.INCREMENTAL_UPDATE]: {
    category: TOOL_CATEGORIES.INCREMENTAL,
    tags: ['incremental', 'update', 'smart'],
    complexity: 'high' as const,
    expectedResponseTime: 20000, // 20 seconds
  },
  [MCP_TOOLS.WATCH_CHANGES]: {
    category: TOOL_CATEGORIES.INCREMENTAL,
    tags: ['watch', 'monitor', 'automatic'],
    complexity: 'medium' as const,
    expectedResponseTime: 1000, // 1 second to start
  },
  [MCP_TOOLS.CONFIG_GET]: {
    category: TOOL_CATEGORIES.CONFIGURATION,
    tags: ['config', 'settings', 'read'],
    complexity: 'low' as const,
    expectedResponseTime: 500, // 0.5 seconds
  },
  [MCP_TOOLS.CONFIG_SET]: {
    category: TOOL_CATEGORIES.CONFIGURATION,
    tags: ['config', 'settings', 'update'],
    complexity: 'low' as const,
    expectedResponseTime: 1000, // 1 second
  },
  [MCP_TOOLS.REGISTER_TOOL]: {
    category: TOOL_CATEGORIES.INFRASTRUCTURE,
    tags: ['registration', 'discovery', 'lifecycle'],
    complexity: 'low' as const,
    expectedResponseTime: 100, // 0.1 seconds
  },
  [MCP_TOOLS.SERVER_HEALTH]: {
    category: TOOL_CATEGORIES.INFRASTRUCTURE,
    tags: ['health', 'monitoring', 'status'],
    complexity: 'low' as const,
    expectedResponseTime: 200, // 0.2 seconds
  },
  [MCP_TOOLS.CACHE_PERFORMANCE_MONITOR]: {
    category: TOOL_CATEGORIES.PERFORMANCE,
    tags: ['cache', 'performance', 'monitoring', 'analytics'],
    complexity: 'medium' as const,
    expectedResponseTime: 3000, // 3 seconds
  },
  [MCP_TOOLS.CACHE_WARMUP]: {
    category: TOOL_CATEGORIES.PERFORMANCE,
    tags: ['cache', 'warmup', 'optimization', 'preloading'],
    complexity: 'medium' as const,
    expectedResponseTime: 10000, // 10 seconds
  },
} as const;

// Type for tool names
export type MCPToolName = typeof MCP_TOOLS[keyof typeof MCP_TOOLS];

// Type for tool categories
export type MCPToolCategory = typeof TOOL_CATEGORIES[keyof typeof TOOL_CATEGORIES];