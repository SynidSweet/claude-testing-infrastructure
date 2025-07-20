/**
 * MCP Service Adapters
 *
 * Central export point for all MCP service adapter classes and types.
 * These adapters bridge existing infrastructure services with MCP tools.
 *
 * @module mcp/adapters
 */

// Base adapter classes
export { BaseMCPServiceAdapter } from './BaseMCPServiceAdapter';
export type { ServiceAdapter } from './BaseMCPServiceAdapter';

export {
  ResilientServiceAdapter,
  FallbackStrategy,
  type ServiceFallbackConfig,
} from './ResilientServiceAdapter';

// Re-export commonly used types for adapter implementations
export {
  MCPToolStatus,
  type MCPToolContext,
  type MCPToolMetrics,
} from '../services/MCPLoggingService';

export {
  MCPErrorCategory,
  MCPErrorSeverity,
  DegradationStrategy,
} from '../services/MCPErrorHandler';

export { CacheLayer } from '../services/MCPCacheManager';

export { MCPToolError, MCPToolErrorType } from '../../types/mcp-tool-types';

// Service adapters
export {
  ProjectAnalysisAdapter,
  createProjectAnalysisAdapter,
  type ProjectAnalysisParams,
  type ProjectAnalysisResult,
} from './ProjectAnalysisAdapter';

export {
  TestGenerationAdapter,
  createTestGenerationAdapter,
  type TestGenerationParams,
  type TestGenerationResult,
  type TestGenerationStrategy,
} from './TestGenerationAdapter';

/**
 * Example usage for creating a new service adapter:
 *
 * ```typescript
 * import { BaseMCPServiceAdapter } from '@mcp/adapters';
 * import { z } from 'zod';
 *
 * const MyServiceParamsSchema = z.object({
 *   projectPath: z.string(),
 *   options: z.object({
 *     deep: z.boolean().optional()
 *   }).optional()
 * });
 *
 * type MyServiceParams = z.infer<typeof MyServiceParamsSchema>;
 *
 * class MyServiceAdapter extends BaseMCPServiceAdapter<MyServiceParams, MyServiceResult> {
 *   public readonly name = 'my_service';
 *   public readonly description = 'My service adapter';
 *   public readonly parameters = MyServiceParamsSchema;
 *
 *   protected async executeCore(params: MyServiceParams, context: MCPToolContext): Promise<any> {
 *     // Integrate with existing service
 *     return await myExistingService.execute(params);
 *   }
 *
 *   getCacheKey(params: MyServiceParams): string {
 *     return `my-service:${params.projectPath}:${JSON.stringify(params.options)}`;
 *   }
 *
 *   getTTL(): number {
 *     return 15 * 60 * 1000; // 15 minutes
 *   }
 * }
 * ```
 */

