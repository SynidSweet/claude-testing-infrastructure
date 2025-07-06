/**
 * Process Context Validator
 * 
 * Enforces process spawning boundaries based on execution context
 * to prevent recursive testing and ensure safety.
 */

import { ProcessContext, ProcessContextValidation, IProcessContextValidator } from '../types/process-types';
import * as path from 'path';

export class ProcessContextValidator implements IProcessContextValidator {
  private static instance: ProcessContextValidator;

  /**
   * Get singleton instance
   */
  static getInstance(): ProcessContextValidator {
    if (!ProcessContextValidator.instance) {
      ProcessContextValidator.instance = new ProcessContextValidator();
    }
    return ProcessContextValidator.instance;
  }

  /**
   * Validate if AI process spawning is allowed in the current context
   */
  validateAIProcessSpawn(context: ProcessContext, targetPath?: string): ProcessContextValidation {
    switch (context) {
      case ProcessContext.USER_INITIATED:
        // User-initiated processes can spawn AI freely
        return { allowed: true };

      case ProcessContext.TEST_GENERATION:
        // Test generation can spawn AI for external projects only
        if (targetPath && this.isExternalProject(targetPath)) {
          return { allowed: true };
        }
        return {
          allowed: false,
          reason: 'Test generation context cannot spawn AI processes for infrastructure testing',
          suggestion: 'Use MockClaudeOrchestrator for infrastructure testing'
        };

      case ProcessContext.VALIDATION_TEST:
        // Validation tests must use mocks
        return {
          allowed: false,
          reason: 'Validation test context cannot spawn real AI processes',
          suggestion: 'Use MockClaudeOrchestrator or test fixtures instead'
        };

      case ProcessContext.INTERNAL_TEST:
        // Internal tests cannot spawn any processes
        return {
          allowed: false,
          reason: 'Internal test context cannot spawn any processes',
          suggestion: 'Use mocks, stubs, or dependency injection for testing'
        };

      default:
        return {
          allowed: false,
          reason: `Unknown process context: ${context}`,
          suggestion: 'Use ProcessContext.USER_INITIATED for normal operation'
        };
    }
  }

  /**
   * Validate if test generation is allowed in the current context
   */
  validateTestGeneration(context: ProcessContext, targetPath?: string): ProcessContextValidation {
    switch (context) {
      case ProcessContext.USER_INITIATED:
      case ProcessContext.TEST_GENERATION:
        // Both contexts can generate tests
        if (targetPath && this.isInfrastructureProject(targetPath)) {
          return {
            allowed: false,
            reason: 'Cannot generate tests for infrastructure project (recursive testing prevention)',
            suggestion: 'Use external test projects for validation'
          };
        }
        return { allowed: true };

      case ProcessContext.VALIDATION_TEST:
      case ProcessContext.INTERNAL_TEST:
        // Test contexts should not generate real tests
        return {
          allowed: false,
          reason: `${this.getContextDescription(context)} should not generate real tests`,
          suggestion: 'Use test fixtures, mocks, or placeholder test generation'
        };

      default:
        return {
          allowed: false,
          reason: `Unknown process context: ${context}`,
          suggestion: 'Use ProcessContext.USER_INITIATED for normal test generation'
        };
    }
  }

  /**
   * Get human-readable context description
   */
  getContextDescription(context: ProcessContext): string {
    switch (context) {
      case ProcessContext.USER_INITIATED:
        return 'User-initiated operation';
      case ProcessContext.TEST_GENERATION:
        return 'AI test generation';
      case ProcessContext.VALIDATION_TEST:
        return 'Infrastructure validation test';
      case ProcessContext.INTERNAL_TEST:
        return 'Internal infrastructure test';
      default:
        return `Unknown context: ${context}`;
    }
  }

  /**
   * Check if the target path is an external project (not this infrastructure)
   */
  private isExternalProject(targetPath: string): boolean {
    const infrastructurePath = this.getInfrastructurePath();
    const resolvedTarget = path.resolve(targetPath);
    const resolvedInfrastructure = path.resolve(infrastructurePath);

    // Check if target is outside the infrastructure directory
    return !resolvedTarget.startsWith(resolvedInfrastructure);
  }

  /**
   * Check if the target path is the infrastructure project itself
   */
  private isInfrastructureProject(targetPath: string): boolean {
    return !this.isExternalProject(targetPath);
  }

  /**
   * Get the infrastructure project path
   */
  private getInfrastructurePath(): string {
    // Find the infrastructure root by looking for package.json with specific name
    let currentPath = __dirname;
    
    while (currentPath !== path.dirname(currentPath)) {
      try {
        const packageJsonPath = path.join(currentPath, 'package.json');
        const packageJson = require(packageJsonPath);
        
        // Check if this is the claude-testing-infrastructure package
        if (packageJson.name === 'claude-testing-infrastructure' || 
            packageJson.description?.includes('Claude Testing Infrastructure')) {
          return currentPath;
        }
      } catch {
        // Continue searching up the directory tree
      }
      currentPath = path.dirname(currentPath);
    }

    // Fallback: assume we're in the infrastructure if we can't find package.json
    return process.cwd();
  }

  /**
   * Create validation error for context violations
   */
  static createContextViolationError(context: ProcessContext, operation: string, validation: ProcessContextValidation): Error {
    const contextDesc = ProcessContextValidator.getInstance().getContextDescription(context);
    let message = `${contextDesc} cannot perform ${operation}: ${validation.reason}`;
    
    if (validation.suggestion) {
      message += `\n\nSuggestion: ${validation.suggestion}`;
    }

    return new Error(message);
  }
}