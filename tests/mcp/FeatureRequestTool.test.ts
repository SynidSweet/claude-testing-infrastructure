/**
 * Tests for MCP Feature Request Enforcement Tool
 * 
 * Validates that the feature request tool properly enforces
 * the request-based workflow and prevents direct feature implementation.
 */

import { FeatureRequestTool, createFeatureRequestTool } from '../../src/mcp/FeatureRequestTool';

describe('FeatureRequestTool', () => {
  let tool: FeatureRequestTool;

  beforeEach(() => {
    tool = createFeatureRequestTool();
  });

  describe('Tool Configuration', () => {
    test('should have correct tool name', () => {
      expect(tool.name).toBe('mcp__claude-testing__feature_request');
    });

    test('should have descriptive tool description', () => {
      expect(tool.description).toContain('feature');
      expect(tool.description).toContain('Request'); // Capital R in "Request"
      expect(tool.description).toContain('REQUIRED');
    });

    test('should provide valid schema', () => {
      const schema = tool.getSchema();
      
      expect(schema.name).toBe('mcp__claude-testing__feature_request');
      expect(schema.inputSchema.type).toBe('object');
      expect(schema.inputSchema.required).toContain('title');
      expect(schema.inputSchema.required).toContain('description');
    });
  });

  describe('Parameter Validation', () => {
    test('should reject request without title', async () => {
      const params = {
        description: 'A detailed description of the feature request that is long enough to pass validation'
      } as any;

      const result = await tool.execute(params);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('validation failed');
      expect(result.validation_messages.join(' ')).toMatch(/title.*required/i);
    });

    test('should reject request without description', async () => {
      const params = {
        title: 'Valid feature title'
      } as any;

      const result = await tool.execute(params);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('validation failed');
      expect(result.validation_messages.join(' ')).toMatch(/description.*required/i);
    });

    test('should reject title that is too short', async () => {
      const params = {
        title: 'Short',
        description: 'A detailed description of the feature request that is long enough to pass validation'
      };

      const result = await tool.execute(params);
      
      expect(result.success).toBe(false);
      expect(result.validation_messages.join(' ')).toMatch(/title.*too short/i);
    });

    test('should reject description that is too short', async () => {
      const params = {
        title: 'Valid feature title',
        description: 'Too short'
      };

      const result = await tool.execute(params);
      
      expect(result.success).toBe(false);
      expect(result.validation_messages.join(' ')).toMatch(/description.*too short/i);
    });

    test('should reject invalid priority values', async () => {
      const params = {
        title: 'Valid feature title',
        description: 'A detailed description of the feature request that is long enough to pass validation',
        priority: 'invalid-priority' as any
      };

      const result = await tool.execute(params);
      
      expect(result.success).toBe(false);
      expect(result.validation_messages.join(' ')).toMatch(/priority.*invalid/i);
    });

    test('should reject invalid category values', async () => {
      const params = {
        title: 'Valid feature title',
        description: 'A detailed description of the feature request that is long enough to pass validation',
        category: 'invalid-category' as any
      };

      const result = await tool.execute(params);
      
      expect(result.success).toBe(false);
      expect(result.validation_messages.join(' ')).toMatch(/category.*invalid/i);
    });

    test('should require detailed use case for epic complexity', async () => {
      const params = {
        title: 'Epic feature request',
        description: 'A detailed description of the feature request that is long enough to pass validation',
        complexity: 'epic' as const,
        use_case: 'Short'
      };

      const result = await tool.execute(params);
      
      expect(result.success).toBe(false);
      expect(result.validation_messages.join(' ')).toMatch(/epic.*use case/i);
    });
  });

  describe('Successful Feature Requests', () => {
    test('should accept valid minimal feature request', async () => {
      const params = {
        title: 'Add new testing capability',
        description: 'This feature request is for adding a new testing capability that would help with automated test generation. The feature should integrate with existing systems and provide clear value to users.'
      };

      const result = await tool.execute(params);
      
      expect(result.success).toBe(true);
      expect(result.task_id).toBeTruthy();
      expect(result.task_id).toMatch(/^FEATURE-\d{8}T\d{6}$/);
      expect(result.assigned_priority).toBe('medium');
      expect(result.status).toBe('submitted');
      expect(result.next_steps.join(' ')).toContain('Do NOT implement this feature yourself');
    });

    test('should accept comprehensive feature request', async () => {
      const params = {
        title: 'Advanced test coverage analysis',
        description: 'Implement advanced test coverage analysis that provides detailed insights into code coverage gaps and suggests specific test cases to improve coverage. This would enhance the existing coverage reporting with actionable recommendations.',
        priority: 'high' as const,
        category: 'testing-enhancement' as const,
        use_case: 'Development teams need detailed coverage analysis to identify critical gaps in their test suites',
        expected_benefits: 'Improved test quality, reduced bugs in production, faster development cycles',
        complexity: 'moderate' as const,
        affected_components: 'src/analyzers/CoverageAnalyzer.ts, src/runners/CoverageReporter.ts'
      };

      const result = await tool.execute(params);
      
      expect(result.success).toBe(true);
      expect(result.task_id).toBeTruthy();
      expect(result.assigned_priority).toBe('high');
      expect(result.estimated_effort).toBe('4-8');
      expect(result.validation_messages).toContain('✅ Feature request validated successfully');
    });

    test('should auto-assign priority based on category', async () => {
      const params = {
        title: 'Performance optimization',
        description: 'Optimize test generation performance to reduce execution time and resource usage during large test suite generation.',
        category: 'performance' as const
      };

      const result = await tool.execute(params);
      
      expect(result.success).toBe(true);
      expect(result.assigned_priority).toBe('high'); // performance category maps to high priority
    });

    test('should provide effort estimates based on complexity', async () => {
      const testCases = [
        { complexity: 'simple', expectedEffort: '2-4' },
        { complexity: 'moderate', expectedEffort: '4-8' },
        { complexity: 'complex', expectedEffort: '8-16' },
        { complexity: 'epic', expectedEffort: '16+' }
      ];

      for (const testCase of testCases) {
        const params = {
          title: `${testCase.complexity} feature`,
          description: 'A detailed description of the feature request that is long enough to pass validation and explains the requirements clearly.',
          complexity: testCase.complexity as any,
          ...(testCase.complexity === 'epic' ? {
            use_case: 'This is a comprehensive use case description that is long enough to satisfy the epic complexity requirement and provides detailed context about why this feature is needed and how it would be used in practice.'
          } : {})
        };

        const result = await tool.execute(params);
        
        expect(result.success).toBe(true);
        expect(result.estimated_effort).toBe(testCase.expectedEffort);
      }
    });
  });

  describe('Security and Enforcement', () => {
    test('should emphasize that agents must not implement features themselves', async () => {
      const params = {
        title: 'New security feature',
        description: 'Add security validation to test generation process to ensure no malicious code is generated in test files.',
        priority: 'critical' as const
      };

      const result = await tool.execute(params);
      
      expect(result.success).toBe(true);
      expect(result.next_steps.join(' ')).toContain('Do NOT implement this feature yourself');
      expect(result.next_steps.join(' ')).toContain('wait for official implementation');
    });

    test('should provide clear guidance on the request workflow', async () => {
      const params = {
        title: 'Workflow improvement',
        description: 'Improve the feature request workflow to make it easier for users to submit and track feature requests.'
      };

      const result = await tool.execute(params);
      
      expect(result.success).toBe(true);
      expect(result.next_steps.join(' ')).toMatch(/submitted.*development team/i);
      expect(result.next_steps.join(' ')).toMatch(/track progress.*task ID/i);
    });
  });

  describe('Error Handling', () => {
    test('should handle unexpected errors gracefully', async () => {
      // Mock console.log to avoid test output
      const originalConsoleLog = console.log;
      console.log = jest.fn();

      const params = {
        title: 'Valid feature title',
        description: 'A detailed description of the feature request that is long enough to pass validation'
      };

      const result = await tool.execute(params);
      
      // Restore console.log
      console.log = originalConsoleLog;
      
      // Even with potential errors, the tool should return a valid response
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('task_id');
      expect(result).toHaveProperty('status');
    });
  });

  describe('Schema Validation', () => {
    test('should provide complete input schema', () => {
      const schema = tool.getSchema();
      
      expect(schema.inputSchema.properties).toHaveProperty('title');
      expect(schema.inputSchema.properties).toHaveProperty('description');
      expect(schema.inputSchema.properties).toHaveProperty('priority');
      expect(schema.inputSchema.properties).toHaveProperty('category');
      expect(schema.inputSchema.properties).toHaveProperty('complexity');
      
      // Check required fields
      expect(schema.inputSchema.required).toEqual(['title', 'description']);
      
      // Check enum values
      expect(schema.inputSchema.properties.priority.enum).toEqual(['low', 'medium', 'high', 'critical']);
      expect(schema.inputSchema.properties.category.enum).toContain('testing-enhancement');
      expect(schema.inputSchema.properties.complexity.enum).toEqual(['simple', 'moderate', 'complex', 'epic']);
    });
  });
});