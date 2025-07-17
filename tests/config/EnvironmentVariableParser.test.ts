/**
 * Unit tests for EnvironmentVariableParser
 * 
 * Tests the environment variable parsing functionality extracted from
 * ConfigurationService as part of REF-CONFIG-002.
 */

import { EnvironmentVariableParser } from '../../src/config/EnvironmentVariableParser';
import { setupMockCleanup } from '../utils/type-safe-mocks';

describe('EnvironmentVariableParser', () => {
  setupMockCleanup();
  
  let parser: EnvironmentVariableParser;

  beforeEach(() => {
    parser = new EnvironmentVariableParser();
  });

  describe('parseEnvironmentVariables', () => {
    it('should parse empty environment variables', () => {
      const result = parser.parseEnvironmentVariables({});
      
      expect(result.config).toEqual({});
      expect(result.warnings).toEqual([]);
    });

    it('should ignore non-CLAUDE_TESTING variables', () => {
      const env = {
        'NODE_ENV': 'test',
        'HOME': '/home/user',
        'CLAUDE_TESTING_AI_MODEL': 'sonnet',
      };
      
      const result = parser.parseEnvironmentVariables(env);
      
      expect(result.config).toEqual({
        aiModel: 'sonnet'
      });
      expect(result.warnings).toEqual([]);
    });

    it('should parse boolean values correctly', () => {
      const env = {
        'CLAUDE_TESTING_DRY_RUN': 'true',
        'CLAUDE_TESTING_FEATURES_COVERAGE': 'false',
        'CLAUDE_TESTING_FEATURES_EDGE_CASES': '1',
        'CLAUDE_TESTING_FEATURES_MOCKING': '0',
        'CLAUDE_TESTING_OUTPUT_VERBOSE': 'yes',
        'CLAUDE_TESTING_OUTPUT_COLORS': 'no',
      };
      
      const result = parser.parseEnvironmentVariables(env);
      
      expect(result.config).toEqual({
        dryRun: true,
        features: {
          coverage: false,
          edgeCases: true,
          mocks: false,
        },
        output: {
          verbose: true,
          logLevel: 'verbose',
          colors: false,
        }
      });
      expect(result.warnings).toEqual([]);
    });

    it('should parse numeric values correctly', () => {
      const env = {
        'CLAUDE_TESTING_COST_LIMIT': '10.5',
        'CLAUDE_TESTING_AI_OPTIONS_MAX_TOKENS': '4000',
        'CLAUDE_TESTING_GENERATION_MAX_RETRIES': '3',
        'CLAUDE_TESTING_GENERATION_TIMEOUT_MS': '15000',
      };
      
      const result = parser.parseEnvironmentVariables(env);
      
      expect(result.config).toEqual({
        costLimit: 10.5,
        aiOptions: {
          maxTokens: 4000,
        },
        generation: {
          maxRetries: 3,
          timeoutMs: 15000,
        }
      });
      expect(result.warnings).toEqual([]);
    });

    it('should parse array values correctly', () => {
      const env = {
        'CLAUDE_TESTING_INCLUDE': 'src/**/*.ts,test/**/*.js',
        'CLAUDE_TESTING_EXCLUDE': 'node_modules,dist',
        'CLAUDE_TESTING_COVERAGE_REPORTERS': 'html,json,lcov',
      };
      
      const result = parser.parseEnvironmentVariables(env);
      
      expect(result.config).toEqual({
        include: ['src/**/*.ts', 'test/**/*.js'],
        exclude: ['node_modules', 'dist'],
        coverage: {
          reporters: ['html', 'json', 'lcov'],
        }
      });
      expect(result.warnings).toEqual([]);
    });

    it('should handle empty array values', () => {
      const env = {
        'CLAUDE_TESTING_INCLUDE': '',
        'CLAUDE_TESTING_COVERAGE_REPORTERS': '',
      };
      
      const result = parser.parseEnvironmentVariables(env);
      
      expect(result.config).toEqual({
        include: [],
        coverage: {
          reporters: [],
        }
      });
      expect(result.warnings).toEqual([]);
    });

    it('should handle empty string values', () => {
      const env = {
        'CLAUDE_TESTING_AI_MODEL': '',
        'CLAUDE_TESTING_TEST_FRAMEWORK': '',
      };
      
      const result = parser.parseEnvironmentVariables(env);
      
      expect(result.config).toEqual({
        aiModel: undefined,
        testFramework: undefined,
      });
      expect(result.warnings).toEqual([]);
    });

    it('should generate warnings for invalid numeric values', () => {
      const env = {
        'CLAUDE_TESTING_GENERATION_MAX_RETRIES': 'invalid',
        'CLAUDE_TESTING_AI_OPTIONS_MAX_TOKENS': 'not-a-number',
        'CLAUDE_TESTING_COST_LIMIT': 'NaN',
      };
      
      const result = parser.parseEnvironmentVariables(env);
      
      expect(result.config).toEqual({
        generation: {
          maxRetries: 'invalid',
        },
        aiOptions: {
          maxTokens: 'not-a-number',
        },
        costLimit: 'NaN',
      });
      
      expect(result.warnings).toHaveLength(3);
      expect(result.warnings[0]).toContain('Invalid numeric value "invalid"');
      expect(result.warnings[1]).toContain('Invalid numeric value "not-a-number"');
      expect(result.warnings[2]).toContain('Invalid numeric value "NaN"');
    });

    it('should handle special output format mapping', () => {
      const env = {
        'CLAUDE_TESTING_OUTPUT_FORMAT': 'json',
      };
      
      const result = parser.parseEnvironmentVariables(env);
      
      expect(result.config).toEqual({
        output: {
          format: 'json',
          formats: ['json'],
        }
      });
      expect(result.warnings).toEqual([]);
    });

    it('should handle coverage thresholds correctly', () => {
      const env = {
        'CLAUDE_TESTING_COVERAGE_ENABLED': 'true',
        'CLAUDE_TESTING_COVERAGE_THRESHOLDS_GLOBAL_STATEMENTS': '80',
        'CLAUDE_TESTING_COVERAGE_THRESHOLDS_GLOBAL_BRANCHES': '75',
        'CLAUDE_TESTING_COVERAGE_THRESHOLDS_GLOBAL_FUNCTIONS': '90',
        'CLAUDE_TESTING_COVERAGE_THRESHOLDS_GLOBAL_LINES': '85',
      };
      
      const result = parser.parseEnvironmentVariables(env);
      
      expect(result.config).toEqual({
        coverage: {
          enabled: true,
          thresholds: {
            global: {
              statements: 80,
              branches: 75,
              functions: 90,
              lines: 85,
            }
          }
        }
      });
      expect(result.warnings).toEqual([]);
    });

    it('should handle custom prompts correctly', () => {
      const env = {
        'CLAUDE_TESTING_CUSTOM_PROMPTS_TEST_GENERATION': 'Generate comprehensive tests',
      };
      
      const result = parser.parseEnvironmentVariables(env);
      
      expect(result.config).toEqual({
        customPrompts: {
          testGeneration: 'Generate comprehensive tests',
        }
      });
      expect(result.warnings).toEqual([]);
    });

    it('should skip empty custom prompts', () => {
      const env = {
        'CLAUDE_TESTING_CUSTOM_PROMPTS_TEST_GENERATION': '',
      };
      
      const result = parser.parseEnvironmentVariables(env);
      
      expect(result.config).toEqual({});
      expect(result.warnings).toEqual([]);
    });

    it('should handle nested values with generic mapping', () => {
      const env = {
        'CLAUDE_TESTING_SOME_NESTED_VALUE': 'test',
        'CLAUDE_TESTING_DEEP_NESTED_STRUCTURE_FIELD': 'value',
      };
      
      const result = parser.parseEnvironmentVariables(env);
      
      expect(result.config).toEqual({
        some: {
          nested: {
            value: 'test',
          }
        },
        deep: {
          nested: {
            structure: {
              field: 'value',
            }
          }
        }
      });
      expect(result.warnings).toEqual([]);
    });

    it('should handle complex mixed configuration', () => {
      const env = {
        'CLAUDE_TESTING_AI_MODEL': 'sonnet',
        'CLAUDE_TESTING_TEST_FRAMEWORK': 'jest',
        'CLAUDE_TESTING_DRY_RUN': 'true',
        'CLAUDE_TESTING_INCLUDE': 'src/**/*.ts,src/**/*.tsx',
        'CLAUDE_TESTING_EXCLUDE': 'node_modules',
        'CLAUDE_TESTING_FEATURES_COVERAGE': 'true',
        'CLAUDE_TESTING_FEATURES_EDGE_CASES': 'false',
        'CLAUDE_TESTING_OUTPUT_VERBOSE': 'true',
        'CLAUDE_TESTING_OUTPUT_FORMAT': 'json',
        'CLAUDE_TESTING_COVERAGE_ENABLED': 'true',
        'CLAUDE_TESTING_COVERAGE_REPORTERS': 'html,json',
        'CLAUDE_TESTING_AI_OPTIONS_MAX_TOKENS': '4000',
        'CLAUDE_TESTING_GENERATION_MAX_RETRIES': '3',
      };
      
      const result = parser.parseEnvironmentVariables(env);
      
      expect(result.config).toEqual({
        aiModel: 'sonnet',
        testFramework: 'jest',
        dryRun: true,
        include: ['src/**/*.ts', 'src/**/*.tsx'],
        exclude: ['node_modules'],
        features: {
          coverage: true,
          edgeCases: false,
        },
        output: {
          verbose: true,
          logLevel: 'verbose',
          format: 'json',
          formats: ['json'],
        },
        coverage: {
          enabled: true,
          reporters: ['html', 'json'],
        },
        aiOptions: {
          maxTokens: 4000,
        },
        generation: {
          maxRetries: 3,
        }
      });
      expect(result.warnings).toEqual([]);
    });

    it('should handle undefined environment variable values', () => {
      const env = {
        'CLAUDE_TESTING_AI_MODEL': undefined,
        'CLAUDE_TESTING_TEST_FRAMEWORK': 'jest',
      };
      
      const result = parser.parseEnvironmentVariables(env);
      
      expect(result.config).toEqual({
        testFramework: 'jest',
      });
      expect(result.warnings).toEqual([]);
    });
  });
});