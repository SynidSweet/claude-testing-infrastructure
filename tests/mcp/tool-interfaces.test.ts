/**
 * Tests for MCP Tool Interfaces and Validation Schemas
 * 
 * Validates that all tool interfaces are properly defined with correct
 * Zod schemas, return types, and error handling.
 */

import { describe, it, expect } from '@jest/globals';
import {
  // Import all schemas
  ProjectAnalyzeSchema,
  TestGenerateSchema,
  TestRunSchema,
  CoverageCheckSchema,
  GapRequestSchema,
  FeatureRequestSchema,
  IncrementalUpdateSchema,
  WatchChangesSchema,
  ConfigSetSchema,
  ServerHealthSchema,
  
  // Import enums
  SupportedLanguage,
  TestFramework,
  TestStrategy,
  GapType,
  FeatureType,
  MCPErrorCode,
  
  // Import type guards
  isMCPToolError,
  isSuccessResult,
} from '../../src/mcp/tool-interfaces';

describe('MCP Tool Interfaces', () => {
  describe('Schema Validation', () => {
    it('should validate ProjectAnalyzeSchema with valid input', () => {
      const validInput = {
        projectPath: '/path/to/project',
        include: ['src/**/*.ts'],
        exclude: ['node_modules/**'],
        deep: true,
      };
      
      const result = ProjectAnalyzeSchema.safeParse(validInput);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.projectPath).toBe(validInput.projectPath);
        expect(result.data.deep).toBe(true);
      }
    });

    it('should validate TestGenerateSchema with minimal input', () => {
      const minimalInput = {
        targetPath: '/path/to/file.ts',
      };
      
      const result = TestGenerateSchema.safeParse(minimalInput);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.strategy).toBe(TestStrategy.Both); // default
        expect(result.data.options).toBeUndefined();
      }
    });

    it('should validate TestGenerateSchema with full options', () => {
      const fullInput = {
        targetPath: '/path/to/file.ts',
        strategy: TestStrategy.Logical,
        framework: TestFramework.Jest,
        outputPath: '/path/to/output',
        options: {
          includeEdgeCases: false,
          includeIntegrationTests: true,
          mockStrategy: 'manual' as const,
          coverageTarget: 90,
        },
      };
      
      const result = TestGenerateSchema.safeParse(fullInput);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.options?.coverageTarget).toBe(90);
        expect(result.data.options?.mockStrategy).toBe('manual');
      }
    });

    it('should reject invalid coverage target in TestGenerateSchema', () => {
      const invalidInput = {
        targetPath: '/path/to/file.ts',
        options: {
          coverageTarget: 150, // Invalid: > 100
        },
      };
      
      const result = TestGenerateSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should validate GapRequestSchema with all fields', () => {
      const validInput = {
        targetProject: '/path/to/project',
        component: 'src/utils/helper.ts',
        gapType: GapType.LowCoverage,
        priority: 'high' as const,
        description: 'Low test coverage in helper functions',
        context: {
          currentCoverage: 45.5,
          relatedFiles: ['src/utils/index.ts'],
          dependencies: ['lodash'],
          specialRequirements: 'Need to mock external API calls',
        },
      };
      
      const result = GapRequestSchema.safeParse(validInput);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.gapType).toBe(GapType.LowCoverage);
        expect(result.data.context?.currentCoverage).toBe(45.5);
      }
    });

    it('should validate CoverageCheckSchema with thresholds', () => {
      const validInput = {
        projectPath: '/path/to/project',
        threshold: {
          lines: 85,
          branches: 80,
          functions: 90,
          statements: 85,
        },
        format: 'detailed' as const,
      };
      
      const result = CoverageCheckSchema.safeParse(validInput);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.threshold?.lines).toBe(85);
        expect(result.data.format).toBe('detailed');
      }
    });

    it('should validate IncrementalUpdateSchema with cost limit', () => {
      const validInput = {
        projectPath: '/path/to/project',
        baseline: 'main',
        dryRun: true,
        preserveCustomTests: true,
        costLimit: 5.0,
      };
      
      const result = IncrementalUpdateSchema.safeParse(validInput);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.costLimit).toBe(5.0);
        expect(result.data.dryRun).toBe(true);
      }
    });

    it('should validate ConfigSetSchema with updates', () => {
      const validInput = {
        projectPath: '/path/to/project',
        updates: {
          testFramework: 'jest',
          'features.coverage': true,
          'thresholds.coverage': 90,
        },
        merge: true,
        validate: true,
        backup: true,
      };
      
      const result = ConfigSetSchema.safeParse(validInput);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.updates).toHaveProperty('testFramework', 'jest');
        expect(result.data.merge).toBe(true);
      }
    });

    it('should validate ServerHealthSchema', () => {
      const validInput = {
        detailed: true,
        includeMetrics: true,
      };
      
      const result = ServerHealthSchema.safeParse(validInput);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.detailed).toBe(true);
        expect(result.data.includeMetrics).toBe(true);
      }
    });
  });

  describe('Enum Values', () => {
    it('should have correct SupportedLanguage values', () => {
      expect(SupportedLanguage.JavaScript).toBe('javascript');
      expect(SupportedLanguage.TypeScript).toBe('typescript');
      expect(SupportedLanguage.Python).toBe('python');
    });

    it('should have correct TestFramework values', () => {
      expect(TestFramework.Jest).toBe('jest');
      expect(TestFramework.Pytest).toBe('pytest');
      expect(TestFramework.Mocha).toBe('mocha');
      expect(TestFramework.Vitest).toBe('vitest');
    });

    it('should have correct GapType values', () => {
      expect(GapType.MissingTest).toBe('missing-test');
      expect(GapType.LowCoverage).toBe('low-coverage');
      expect(GapType.UntestablCode).toBe('untestable-code');
      expect(GapType.EdgeCase).toBe('edge-case');
      expect(GapType.IntegrationGap).toBe('integration-gap');
    });

    it('should have correct MCPErrorCode values', () => {
      expect(MCPErrorCode.InvalidInput).toBe('INVALID_INPUT');
      expect(MCPErrorCode.ProjectNotFound).toBe('PROJECT_NOT_FOUND');
      expect(MCPErrorCode.TestGenerationFailed).toBe('TEST_GENERATION_FAILED');
      expect(MCPErrorCode.SystemOverloaded).toBe('SYSTEM_OVERLOADED');
    });
  });

  describe('Type Guards', () => {
    it('should correctly identify MCPToolError', () => {
      const error = {
        code: MCPErrorCode.InvalidInput,
        message: 'Invalid project path',
        details: { path: '/invalid/path' },
      };
      
      expect(isMCPToolError(error)).toBe(true);
      expect(isMCPToolError({ message: 'Not an MCP error' })).toBe(false);
      expect(isMCPToolError(null)).toBe(false);
      expect(isMCPToolError('string error')).toBe(false);
    });

    it('should correctly identify success results', () => {
      const successResult = { data: 'success' };
      const errorResult = {
        code: MCPErrorCode.InvalidInput,
        message: 'Error',
      };
      
      expect(isSuccessResult(successResult)).toBe(true);
      expect(isSuccessResult(errorResult)).toBe(false);
    });
  });

  describe('Schema Default Values', () => {
    it('should apply defaults in ProjectAnalyzeSchema', () => {
      const minimalInput = { projectPath: '/path' };
      const result = ProjectAnalyzeSchema.safeParse(minimalInput);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.deep).toBe(true); // default
        expect(result.data.include).toBeUndefined();
        expect(result.data.exclude).toBeUndefined();
      }
    });

    it('should apply defaults in TestRunSchema', () => {
      const minimalInput = { projectPath: '/path' };
      const result = TestRunSchema.safeParse(minimalInput);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.coverage).toBe(true); // default
        expect(result.data.watch).toBe(false); // default
        expect(result.data.bail).toBe(false); // default
      }
    });

    it('should apply defaults in WatchChangesSchema', () => {
      const minimalInput = { projectPath: '/path' };
      const result = WatchChangesSchema.safeParse(minimalInput);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.debounceMs).toBe(1000); // default
        expect(result.data.autoUpdate).toBe(true); // default
      }
    });
  });

  describe('Complex Schema Validation', () => {
    it('should validate nested threshold object in CoverageCheckSchema', () => {
      const partialThreshold = {
        projectPath: '/path',
        threshold: {
          lines: 90,
          // Other thresholds should use defaults
        },
      };
      
      const result = CoverageCheckSchema.safeParse(partialThreshold);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.threshold?.lines).toBe(90);
        expect(result.data.threshold?.branches).toBe(80); // default
        expect(result.data.threshold?.functions).toBe(80); // default
        expect(result.data.threshold?.statements).toBe(80); // default
      }
    });

    it('should validate FeatureRequestSchema with acceptance criteria', () => {
      const validInput = {
        title: 'Add TypeScript support',
        description: 'Support TypeScript files in test generation',
        type: FeatureType.NewFeature,
        priority: 'high' as const,
        rationale: 'Many projects use TypeScript',
        acceptanceCriteria: [
          'Parse TypeScript syntax correctly',
          'Generate type-safe tests',
          'Support TSX files',
        ],
        technicalNotes: 'Use TypeScript compiler API',
      };
      
      const result = FeatureRequestSchema.safeParse(validInput);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.acceptanceCriteria).toHaveLength(3);
        expect(result.data.type).toBe(FeatureType.NewFeature);
      }
    });

    it('should reject invalid enum values', () => {
      const invalidStrategy = {
        targetPath: '/path',
        strategy: 'invalid-strategy',
      };
      
      const result = TestGenerateSchema.safeParse(invalidStrategy);
      expect(result.success).toBe(false);
    });
  });
});