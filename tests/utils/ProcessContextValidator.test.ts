/**
 * Tests for ProcessContextValidator
 */

import { ProcessContextValidator } from '../../src/utils/ProcessContextValidator';
import { ProcessContext } from '../../src/types/process-types';

describe('ProcessContextValidator', () => {
  let validator: ProcessContextValidator;

  beforeEach(() => {
    validator = ProcessContextValidator.getInstance();
  });

  describe('validateAIProcessSpawn', () => {
    test('should allow USER_INITIATED context to spawn AI processes', () => {
      const result = validator.validateAIProcessSpawn(ProcessContext.USER_INITIATED);
      expect(result.allowed).toBe(true);
    });

    test('should allow TEST_GENERATION context for external projects', () => {
      const externalPath = '/external/project/file.ts';
      const result = validator.validateAIProcessSpawn(ProcessContext.TEST_GENERATION, externalPath);
      expect(result.allowed).toBe(true);
    });

    test('should block VALIDATION_TEST context from spawning AI processes', () => {
      const result = validator.validateAIProcessSpawn(ProcessContext.VALIDATION_TEST);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Validation test context cannot spawn real AI processes');
    });

    test('should block INTERNAL_TEST context from spawning any processes', () => {
      const result = validator.validateAIProcessSpawn(ProcessContext.INTERNAL_TEST);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Internal test context cannot spawn any processes');
    });
  });

  describe('validateTestGeneration', () => {
    test('should allow USER_INITIATED context to generate tests', () => {
      const externalPath = '/external/project/file.ts';
      const result = validator.validateTestGeneration(ProcessContext.USER_INITIATED, externalPath);
      expect(result.allowed).toBe(true);
    });

    test('should block test generation on infrastructure project', () => {
      const infrastructurePath = process.cwd() + '/src/file.ts'; // Path within infrastructure
      const result = validator.validateTestGeneration(ProcessContext.USER_INITIATED, infrastructurePath);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('recursive testing prevention');
    });

    test('should block VALIDATION_TEST context from generating tests', () => {
      const result = validator.validateTestGeneration(ProcessContext.VALIDATION_TEST);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('should not generate real tests');
    });
  });

  describe('getContextDescription', () => {
    test('should return readable descriptions for all contexts', () => {
      expect(validator.getContextDescription(ProcessContext.USER_INITIATED)).toBe('User-initiated operation');
      expect(validator.getContextDescription(ProcessContext.TEST_GENERATION)).toBe('AI test generation');
      expect(validator.getContextDescription(ProcessContext.VALIDATION_TEST)).toBe('Infrastructure validation test');
      expect(validator.getContextDescription(ProcessContext.INTERNAL_TEST)).toBe('Internal infrastructure test');
    });
  });

  describe('createContextViolationError', () => {
    test('should create descriptive error messages', () => {
      const validation = { allowed: false, reason: 'Test reason', suggestion: 'Test suggestion' };
      const error = ProcessContextValidator.createContextViolationError(
        ProcessContext.VALIDATION_TEST, 
        'test operation', 
        validation
      );
      
      expect(error.message).toContain('Infrastructure validation test cannot perform test operation');
      expect(error.message).toContain('Test reason');
      expect(error.message).toContain('Test suggestion');
    });
  });
});