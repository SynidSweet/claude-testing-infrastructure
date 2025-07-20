/**
 * MCP Cross-Tool Workflow Integration Tests
 * 
 * Tests complex workflows that span multiple MCP tools, validating
 * data flow, state management, and tool coordination scenarios.
 * 
 * These tests ensure that tools work together seamlessly in real-world
 * agent usage patterns and that data flows correctly between tools.
 */

import { describe, it, expect, jest, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';
import { MCPTestHelper, type MockMCPServer } from '../../../src/utils/MCPTestHelper';
import { 
  MCP_TOOLS,
  SupportedLanguage,
  TestFramework,
  TestStrategy,
  GapType,
  FeatureType,
} from '../../../src/mcp/tools';

// Mock FastMCP server imports to avoid ES module issues in Jest
jest.mock('../../../src/mcp/fastmcp-server', () => ({
  ClaudeTestingFastMCPServer: jest.fn().mockImplementation(() => ({
    getStatus: jest.fn().mockReturnValue({ isRunning: false }),
    stop: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock('../../../src/mcp/services/MCPTaskIntegration', () => ({
  MCPTaskIntegrationService: {
    getInstance: jest.fn().mockReturnValue({
      createTaskFromGap: jest.fn(),
    }),
  },
}));

jest.mock('../../../src/mcp/services/MCPCacheManager', () => ({
  MCPCacheManager: {
    getInstance: jest.fn().mockReturnValue({
      clearAll: jest.fn(),
    }),
  },
}));

interface WorkflowResult {
  stepId: string;
  toolName: string;
  success: boolean;
  data: any;
  duration: number;
  error?: string;
}

interface WorkflowContext {
  projectPath: string;
  sessionId: string;
  results: WorkflowResult[];
  state: Record<string, any>;
}

describe('MCP Cross-Tool Workflow Integration', () => {
  let mcpHelper: MCPTestHelper;
  let mockServer: MockMCPServer;
  let mockFastMCPServer: any;
  let mockCacheManager: any;
  let mockTaskIntegration: any;

  beforeAll(async () => {
    mcpHelper = new MCPTestHelper();
    mockServer = await mcpHelper.createServer({
      requireInit: true,
      capabilities: { tools: true, resources: true, prompts: true },
    });

    // Get mock instances
    const { ClaudeTestingFastMCPServer } = require('../../../src/mcp/fastmcp-server');
    const { MCPCacheManager } = require('../../../src/mcp/services/MCPCacheManager');
    const { MCPTaskIntegrationService } = require('../../../src/mcp/services/MCPTaskIntegration');

    mockFastMCPServer = new ClaudeTestingFastMCPServer();
    mockCacheManager = MCPCacheManager.getInstance();
    mockTaskIntegration = MCPTaskIntegrationService.getInstance();
  });

  afterAll(async () => {
    await mcpHelper.cleanup();
    if (mockFastMCPServer && mockFastMCPServer.getStatus().isRunning) {
      await mockFastMCPServer.stop();
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mcpHelper.resetServers();
    if (mockCacheManager) mockCacheManager.clearAll();
  });

  /**
   * Helper function to execute a workflow step
   */
  async function executeWorkflowStep(
    context: WorkflowContext,
    stepId: string,
    toolName: string,
    arguments_: Record<string, any>
  ): Promise<WorkflowResult> {
    const start = Date.now();
    
    try {
      const response = await mockServer.handleRequest({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: {
            ...arguments_,
            sessionId: context.sessionId, // Include session context
          },
        },
        id: stepId,
      });

      const duration = Date.now() - start;
      const result: WorkflowResult = {
        stepId,
        toolName,
        success: !response.error,
        data: response.result || response.error,
        duration,
        error: response.error?.message,
      };

      context.results.push(result);
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      const result: WorkflowResult = {
        stepId,
        toolName,
        success: false,
        data: null,
        duration,
        error: (error as Error).message,
      };

      context.results.push(result);
      return result;
    }
  }

  /**
   * Create workflow context
   */
  function createWorkflowContext(projectPath: string): WorkflowContext {
    return {
      projectPath,
      sessionId: `session-${Date.now()}`,
      results: [],
      state: {},
    };
  }

  describe('Complete Agent Development Workflow', () => {
    it('should execute full project setup and test generation workflow', async () => {
      const context = createWorkflowContext('/test/new-project');

      // Step 1: Initialize session and check server health
      const healthResult = await executeWorkflowStep(
        context,
        'health-check',
        MCP_TOOLS.SERVER_HEALTH,
        { includeMetrics: true, checkServices: ['cache', 'task-integration'] }
      );
      expect(healthResult.success).toBe(true);

      // Step 2: Set project configuration
      const configResult = await executeWorkflowStep(
        context,
        'set-config',
        MCP_TOOLS.CONFIG_SET,
        {
          projectPath: context.projectPath,
          settings: {
            testFramework: TestFramework.Jest,
            language: SupportedLanguage.TypeScript,
            coverage: { threshold: 85 },
            aiModel: 'claude-3-sonnet',
          },
          validate: true,
        }
      );
      expect(configResult.success).toBe(true);

      // Step 3: Analyze project structure
      const analyzeResult = await executeWorkflowStep(
        context,
        'analyze-project',
        MCP_TOOLS.PROJECT_ANALYZE,
        {
          projectPath: context.projectPath,
          include: ['src/**/*.ts', 'lib/**/*.ts'],
          exclude: ['node_modules/**', 'dist/**'],
          deep: true,
        }
      );
      expect(analyzeResult.success).toBe(true);
      
      // Store analysis results in context
      context.state.projectAnalysis = analyzeResult.data;

      // Step 4: Check current coverage
      const coverageResult = await executeWorkflowStep(
        context,
        'check-coverage',
        MCP_TOOLS.COVERAGE_CHECK,
        {
          projectPath: context.projectPath,
          threshold: 85,
          reportFormat: 'json',
          includeGaps: true,
        }
      );
      expect(coverageResult.success).toBe(true);
      
      // Store coverage data
      context.state.coverageReport = coverageResult.data;

      // Step 5: Generate tests for identified gaps
      const testGenResult = await executeWorkflowStep(
        context,
        'generate-tests',
        MCP_TOOLS.TEST_GENERATE,
        {
          projectPath: context.projectPath,
          targetFiles: ['src/utils/parser.ts', 'src/core/engine.ts'],
          strategy: TestStrategy.Both,
          framework: TestFramework.Jest,
          aiModel: 'claude-3-sonnet',
        }
      );
      expect(testGenResult.success).toBe(true);

      // Step 6: Run generated tests
      const testRunResult = await executeWorkflowStep(
        context,
        'run-tests',
        MCP_TOOLS.TEST_RUN,
        {
          projectPath: context.projectPath,
          testFiles: ['tests/**/*.test.ts'],
          coverage: true,
          watch: false,
          timeout: 60000,
        }
      );
      expect(testRunResult.success).toBe(true);

      // Step 7: Final coverage validation
      const finalCoverageResult = await executeWorkflowStep(
        context,
        'final-coverage',
        MCP_TOOLS.COVERAGE_CHECK,
        {
          projectPath: context.projectPath,
          threshold: 85,
          reportFormat: 'json',
          includeGaps: false,
        }
      );
      expect(finalCoverageResult.success).toBe(true);

      // Validate complete workflow
      expect(context.results).toHaveLength(7);
      expect(context.results.every(r => r.success)).toBe(true);

      // Verify workflow performance
      const totalDuration = context.results.reduce((sum, r) => sum + r.duration, 0);
      expect(totalDuration).toBeLessThan(30000); // Complete workflow under 30 seconds
    });

    it('should handle iterative development workflow with incremental updates', async () => {
      const context = createWorkflowContext('/test/iterative-project');

      // Step 1: Initial project analysis
      const initialAnalysis = await executeWorkflowStep(
        context,
        'initial-analysis',
        MCP_TOOLS.PROJECT_ANALYZE,
        {
          projectPath: context.projectPath,
          deep: true,
        }
      );
      expect(initialAnalysis.success).toBe(true);

      // Step 2: Set up file watching
      const watchResult = await executeWorkflowStep(
        context,
        'setup-watch',
        MCP_TOOLS.WATCH_CHANGES,
        {
          projectPath: context.projectPath,
          patterns: ['src/**/*.ts', 'lib/**/*.ts'],
          debounceMs: 1000,
          action: 'regenerate-tests',
        }
      );
      expect(watchResult.success).toBe(true);

      // Simulate file changes and incremental updates
      const iterations = 3;
      for (let i = 0; i < iterations; i++) {
        // Step 3a: Incremental update after changes
        const incrementalResult = await executeWorkflowStep(
          context,
          `incremental-${i}`,
          MCP_TOOLS.INCREMENTAL_UPDATE,
          {
            projectPath: context.projectPath,
            sinceCommit: `commit-${i}`,
            strategy: 'smart',
            dryRun: false,
          }
        );
        expect(incrementalResult.success).toBe(true);

        // Step 3b: Run tests after incremental update
        const iterativeTestResult = await executeWorkflowStep(
          context,
          `test-iteration-${i}`,
          MCP_TOOLS.TEST_RUN,
          {
            projectPath: context.projectPath,
            coverage: true,
            incremental: true,
          }
        );
        expect(iterativeTestResult.success).toBe(true);
      }

      // Verify iterative workflow completed successfully
      const totalSteps = 2 + (iterations * 2); // initial + watch + (incremental + test) * iterations
      expect(context.results).toHaveLength(totalSteps);
      expect(context.results.every(r => r.success)).toBe(true);
    });
  });

  describe('Gap Analysis and Task Management Workflow', () => {
    it('should execute comprehensive gap analysis with task creation', async () => {
      const context = createWorkflowContext('/test/gap-analysis-project');

      // Mock task integration service
      const mockCreateTask = jest.spyOn(taskIntegration, 'createTaskFromGap');
      mockCreateTask.mockResolvedValue({
        taskId: 'TASK-GAP-001',
        status: 'created',
        sprintAssigned: true,
        priority: 'high',
        metadata: {
          gapType: GapType.MissingTest,
          urgencyScore: 90,
          contextualScore: 85,
        },
      });

      // Step 1: Comprehensive project analysis
      const analysisResult = await executeWorkflowStep(
        context,
        'comprehensive-analysis',
        MCP_TOOLS.PROJECT_ANALYZE,
        {
          projectPath: context.projectPath,
          deep: true,
          includeComplexity: true,
          includeDependencies: true,
        }
      );
      expect(analysisResult.success).toBe(true);

      // Step 2: Coverage gap identification
      const gapAnalysisResult = await executeWorkflowStep(
        context,
        'gap-analysis',
        MCP_TOOLS.COVERAGE_CHECK,
        {
          projectPath: context.projectPath,
          threshold: 80,
          includeGaps: true,
          detailedGaps: true,
        }
      );
      expect(gapAnalysisResult.success).toBe(true);

      // Step 3: Create gap request for critical missing tests
      const criticalGapResult = await executeWorkflowStep(
        context,
        'critical-gap-request',
        MCP_TOOLS.GAP_REQUEST,
        {
          targetProject: context.projectPath,
          component: 'src/core/security.ts',
          gapType: GapType.MissingTest,
          priority: 'critical',
          description: 'Security module lacks comprehensive test coverage for authentication flows',
          context: {
            currentCoverage: 15,
            relatedFiles: ['src/auth/index.ts', 'src/middleware/auth.ts'],
            dependencies: ['jsonwebtoken', 'bcrypt'],
            securityImplications: true,
          },
        }
      );
      expect(criticalGapResult.success).toBe(true);

      // Step 4: Create gap request for integration testing
      const integrationGapResult = await executeWorkflowStep(
        context,
        'integration-gap-request',
        MCP_TOOLS.GAP_REQUEST,
        {
          targetProject: context.projectPath,
          component: 'src/api/endpoints.ts',
          gapType: GapType.IntegrationGap,
          priority: 'high',
          description: 'API endpoints missing end-to-end integration tests',
          context: {
            currentCoverage: 45,
            integrationPoints: ['database', 'external-apis', 'authentication'],
          },
        }
      );
      expect(integrationGapResult.success).toBe(true);

      // Step 5: Feature request for testing infrastructure
      const featureRequestResult = await executeWorkflowStep(
        context,
        'feature-request',
        MCP_TOOLS.FEATURE_REQUEST,
        {
          title: 'Enhanced test fixtures and mocking utilities',
          description: 'Create comprehensive test fixtures and mocking utilities to support complex integration testing scenarios',
          type: FeatureType.Enhancement,
          priority: 'medium',
          component: 'test-infrastructure',
          relatedGaps: ['TASK-GAP-001'],
        }
      );
      expect(featureRequestResult.success).toBe(true);

      // Step 6: Validate task creation
      const healthCheckResult = await executeWorkflowStep(
        context,
        'post-gap-health',
        MCP_TOOLS.SERVER_HEALTH,
        {
          includeMetrics: true,
          checkServices: ['task-integration'],
        }
      );
      expect(healthCheckResult.success).toBe(true);

      // Verify all steps succeeded
      expect(context.results).toHaveLength(6);
      expect(context.results.every(r => r.success)).toBe(true);

      // Verify task integration was called
      expect(mockCreateTask).toHaveBeenCalledTimes(2); // Two gap requests

      mockCreateTask.mockRestore();
    });

    it('should handle gap prioritization and sprint planning workflow', async () => {
      const context = createWorkflowContext('/test/sprint-planning-project');

      // Step 1: Analyze project for gap identification
      const projectAnalysis = await executeWorkflowStep(
        context,
        'project-analysis',
        MCP_TOOLS.PROJECT_ANALYZE,
        {
          projectPath: context.projectPath,
          deep: true,
        }
      );
      expect(projectAnalysis.success).toBe(true);

      // Step 2: Check coverage and identify multiple gaps
      const coverageAnalysis = await executeWorkflowStep(
        context,
        'coverage-analysis',
        MCP_TOOLS.COVERAGE_CHECK,
        {
          projectPath: context.projectPath,
          threshold: 85,
          includeGaps: true,
          gapPrioritization: true,
        }
      );
      expect(coverageAnalysis.success).toBe(true);

      // Step 3: Create multiple gap requests with different priorities
      const gapTypes = [
        { type: GapType.MissingTest, priority: 'critical', component: 'src/security/auth.ts' },
        { type: GapType.LowCoverage, priority: 'high', component: 'src/utils/validation.ts' },
        { type: GapType.EdgeCase, priority: 'medium', component: 'src/parsers/json.ts' },
        { type: GapType.IntegrationGap, priority: 'high', component: 'src/api/routes.ts' },
      ];

      for (const [index, gap] of gapTypes.entries()) {
        const gapResult = await executeWorkflowStep(
          context,
          `gap-request-${index}`,
          MCP_TOOLS.GAP_REQUEST,
          {
            targetProject: context.projectPath,
            component: gap.component,
            gapType: gap.type,
            priority: gap.priority,
            description: `${gap.type} for ${gap.component}`,
          }
        );
        expect(gapResult.success).toBe(true);
      }

      // Step 4: Generate tests for highest priority gaps
      const testGeneration = await executeWorkflowStep(
        context,
        'priority-test-generation',
        MCP_TOOLS.TEST_GENERATE,
        {
          projectPath: context.projectPath,
          targetFiles: ['src/security/auth.ts', 'src/api/routes.ts'], // High/critical priority
          strategy: TestStrategy.Both,
          prioritizeGaps: true,
        }
      );
      expect(testGeneration.success).toBe(true);

      // Verify sprint planning workflow
      expect(context.results).toHaveLength(7); // 1 analysis + 1 coverage + 4 gaps + 1 generation
      expect(context.results.every(r => r.success)).toBe(true);
    });
  });

  describe('Configuration and Environment Management Workflow', () => {
    it('should execute configuration management across multiple projects', async () => {
      const projects = ['/test/project-a', '/test/project-b', '/test/project-c'];
      const overallContext = createWorkflowContext('multi-project');

      for (const [index, projectPath] of projects.entries()) {
        const projectContext = createWorkflowContext(projectPath);

        // Step 1: Get current project configuration
        const getConfigResult = await executeWorkflowStep(
          projectContext,
          `get-config-${index}`,
          MCP_TOOLS.CONFIG_GET,
          {
            projectPath,
            format: 'json',
          }
        );
        expect(getConfigResult.success).toBe(true);

        // Step 2: Set standardized configuration
        const setConfigResult = await executeWorkflowStep(
          projectContext,
          `set-config-${index}`,
          MCP_TOOLS.CONFIG_SET,
          {
            projectPath,
            settings: {
              testFramework: TestFramework.Jest,
              language: SupportedLanguage.TypeScript,
              coverage: { 
                threshold: 85,
                excludePatterns: ['**/*.d.ts', '**/node_modules/**'],
              },
              aiModel: 'claude-3-sonnet',
              incremental: { enabled: true, strategy: 'smart' },
            },
            validate: true,
          }
        );
        expect(setConfigResult.success).toBe(true);

        // Step 3: Verify configuration applied correctly
        const verifyConfigResult = await executeWorkflowStep(
          projectContext,
          `verify-config-${index}`,
          MCP_TOOLS.CONFIG_GET,
          {
            projectPath,
            keys: ['testFramework', 'coverage', 'aiModel'],
          }
        );
        expect(verifyConfigResult.success).toBe(true);

        // Add project results to overall context
        overallContext.results.push(...projectContext.results);
      }

      // Verify configuration workflow for all projects
      expect(overallContext.results).toHaveLength(projects.length * 3);
      expect(overallContext.results.every(r => r.success)).toBe(true);
    });

    it('should handle dynamic configuration updates during development', async () => {
      const context = createWorkflowContext('/test/dynamic-config-project');

      // Step 1: Initial configuration
      const initialConfig = await executeWorkflowStep(
        context,
        'initial-config',
        MCP_TOOLS.CONFIG_SET,
        {
          projectPath: context.projectPath,
          settings: {
            testFramework: TestFramework.Jest,
            coverage: { threshold: 70 },
          },
        }
      );
      expect(initialConfig.success).toBe(true);

      // Step 2: Run initial tests
      const initialTests = await executeWorkflowStep(
        context,
        'initial-tests',
        MCP_TOOLS.TEST_RUN,
        {
          projectPath: context.projectPath,
          coverage: true,
        }
      );
      expect(initialTests.success).toBe(true);

      // Step 3: Update configuration based on results
      const updatedConfig = await executeWorkflowStep(
        context,
        'updated-config',
        MCP_TOOLS.CONFIG_SET,
        {
          projectPath: context.projectPath,
          settings: {
            coverage: { threshold: 85 }, // Increase threshold
            performance: { timeout: 60000 },
            reporting: { format: 'detailed' },
          },
          merge: true, // Merge with existing config
        }
      );
      expect(updatedConfig.success).toBe(true);

      // Step 4: Re-run tests with new configuration
      const updatedTests = await executeWorkflowStep(
        context,
        'updated-tests',
        MCP_TOOLS.TEST_RUN,
        {
          projectPath: context.projectPath,
          coverage: true,
          useUpdatedConfig: true,
        }
      );
      expect(updatedTests.success).toBe(true);

      // Step 5: Validate final configuration
      const finalConfigCheck = await executeWorkflowStep(
        context,
        'final-config-check',
        MCP_TOOLS.CONFIG_GET,
        {
          projectPath: context.projectPath,
        }
      );
      expect(finalConfigCheck.success).toBe(true);

      // Verify dynamic configuration workflow
      expect(context.results).toHaveLength(5);
      expect(context.results.every(r => r.success)).toBe(true);
    });
  });

  describe('Error Recovery and Resilience Workflow', () => {
    it('should handle tool failures and implement recovery strategies', async () => {
      const context = createWorkflowContext('/test/resilience-project');

      // Step 1: Start with healthy operations
      const healthCheck = await executeWorkflowStep(
        context,
        'initial-health',
        MCP_TOOLS.SERVER_HEALTH,
        { includeMetrics: true }
      );
      expect(healthCheck.success).toBe(true);

      // Step 2: Attempt operation that may fail
      const riskyOperation = await executeWorkflowStep(
        context,
        'risky-operation',
        'requiresParams', // Test tool that validates params strictly
        {
          invalidParam: 'this-will-cause-validation-error',
        }
      );
      expect(riskyOperation.success).toBe(false); // Expected to fail

      // Step 3: Check server health after failure
      const postFailureHealth = await executeWorkflowStep(
        context,
        'post-failure-health',
        MCP_TOOLS.SERVER_HEALTH,
        { includeMetrics: true, checkServices: ['error-handler'] }
      );
      expect(postFailureHealth.success).toBe(true); // Server should remain healthy

      // Step 4: Retry with corrected parameters
      const retryOperation = await executeWorkflowStep(
        context,
        'retry-operation',
        MCP_TOOLS.PROJECT_ANALYZE,
        {
          projectPath: context.projectPath,
          deep: true,
        }
      );
      expect(retryOperation.success).toBe(true); // Should succeed

      // Step 5: Verify system recovered
      const recoveryHealth = await executeWorkflowStep(
        context,
        'recovery-health',
        MCP_TOOLS.SERVER_HEALTH,
        { includeMetrics: true }
      );
      expect(recoveryHealth.success).toBe(true);

      // Verify error recovery workflow
      expect(context.results).toHaveLength(5);
      expect(context.results.filter(r => r.success)).toHaveLength(4); // 4 successful, 1 expected failure
    });

    it('should handle timeout scenarios gracefully', async () => {
      const context = createWorkflowContext('/test/timeout-project');

      // Step 1: Normal operation
      const normalOp = await executeWorkflowStep(
        context,
        'normal-operation',
        MCP_TOOLS.SERVER_HEALTH,
        { includeMetrics: false }
      );
      expect(normalOp.success).toBe(true);

      // Step 2: Slow operation (simulated)
      const slowOp = await executeWorkflowStep(
        context,
        'slow-operation',
        'slowTool', // Test tool that introduces delay
        { delay: 2000 } // 2 second delay
      );
      expect(slowOp.success).toBe(true); // Should handle delay gracefully

      // Step 3: Continue workflow after slow operation
      const continueOp = await executeWorkflowStep(
        context,
        'continue-operation',
        MCP_TOOLS.CONFIG_GET,
        { projectPath: context.projectPath }
      );
      expect(continueOp.success).toBe(true);

      // Verify timeout handling workflow
      expect(context.results).toHaveLength(3);
      expect(context.results.every(r => r.success)).toBe(true);
    });
  });

  describe('Performance and Scalability Workflow', () => {
    it('should handle concurrent tool operations efficiently', async () => {
      const context = createWorkflowContext('/test/concurrent-project');

      // Create multiple concurrent operations
      const concurrentOperations = [
        { tool: MCP_TOOLS.SERVER_HEALTH, args: { includeMetrics: true } },
        { tool: MCP_TOOLS.CONFIG_GET, args: { projectPath: context.projectPath } },
        { tool: MCP_TOOLS.PROJECT_ANALYZE, args: { projectPath: context.projectPath, deep: false } },
        { tool: MCP_TOOLS.COVERAGE_CHECK, args: { projectPath: context.projectPath, threshold: 50 } },
      ];

      const start = Date.now();
      
      // Execute all operations concurrently
      const promises = concurrentOperations.map((op, index) =>
        executeWorkflowStep(context, `concurrent-${index}`, op.tool, op.args)
      );

      const results = await Promise.all(promises);
      const duration = Date.now() - start;

      // Verify all operations succeeded
      expect(results.every(r => r.success)).toBe(true);
      expect(results).toHaveLength(4);

      // Verify concurrent execution was efficient
      expect(duration).toBeLessThan(5000); // All operations under 5 seconds

      // Add to context
      context.results.push(...results);
    });

    it('should maintain performance under load', async () => {
      const context = createWorkflowContext('/test/load-project');
      const iterations = 10;

      const start = Date.now();
      
      // Execute repeated operations to simulate load
      for (let i = 0; i < iterations; i++) {
        const result = await executeWorkflowStep(
          context,
          `load-test-${i}`,
          MCP_TOOLS.SERVER_HEALTH,
          { includeMetrics: i % 3 === 0 } // Vary the load
        );
        expect(result.success).toBe(true);
      }

      const totalDuration = Date.now() - start;
      const avgDuration = totalDuration / iterations;

      // Verify performance under load
      expect(context.results).toHaveLength(iterations);
      expect(context.results.every(r => r.success)).toBe(true);
      expect(avgDuration).toBeLessThan(500); // Average under 500ms per operation
      expect(totalDuration).toBeLessThan(5000); // Total under 5 seconds
    });
  });
});