/**
 * AI Test Harness for Validation Tests
 * 
 * Provides utilities for simulating AI responses and testing AI integration
 * without making real API calls or spawning real processes.
 */

import type { AITask, AITaskBatch } from './AITaskPreparation';
import type { MockAIResponse } from './MockClaudeOrchestrator';

export interface TestScenario {
  name: string;
  description: string;
  tasks: AITask[];
  expectedResponses: MockAIResponse[];
  expectedSuccess: boolean;
  expectedErrors?: string[];
}

export interface ValidationTestResult {
  scenario: string;
  success: boolean;
  processesSpawned: number;
  tasksCompleted: number;
  tasksFailed: number;
  errors: string[];
  duration: number;
  spawnHistory: Array<{
    taskId: string;
    timestamp: Date;
    context: string;
  }>;
}

export class AITestHarness {
  private scenarios: Map<string, TestScenario> = new Map();

  constructor() {
    this.initializeDefaultScenarios();
  }

  /**
   * Register a test scenario
   */
  registerScenario(scenario: TestScenario): void {
    this.scenarios.set(scenario.name, scenario);
  }

  /**
   * Get a registered scenario
   */
  getScenario(name: string): TestScenario | undefined {
    return this.scenarios.get(name);
  }

  /**
   * Create a simple React component test scenario
   */
  createReactComponentScenario(componentName: string = 'TestComponent'): TestScenario {
    const sourceFile = `/test/src/${componentName}.jsx`;
    const testFile = `/test/.claude-testing/src/${componentName}.test.jsx`;
    
    const task: AITask = {
      id: `react-${componentName.toLowerCase()}`,
      sourceFile,
      testFile,
      priority: 8,
      complexity: 5,
      estimatedTokens: 200,
      estimatedCost: 0.002,
      status: 'pending',
      prompt: `Generate comprehensive unit tests for the React component ${componentName}`,
      context: {
        sourceCode: `import React from 'react';

export default function ${componentName}({ title = 'Hello World', onClick }) {
  return (
    <div className="${componentName.toLowerCase()}">
      <h1>{title}</h1>
      <button onClick={onClick}>Click me</button>
    </div>
  );
}`,
        existingTests: '',
        dependencies: ['react', '@testing-library/react'],
        missingScenarios: [
          'Basic render test',
          'Props handling test',
          'Click event test',
          'Default props test'
        ],
        frameworkInfo: {
          language: 'javascript',
          testFramework: 'jest',
          moduleType: 'esm',
          hasTypeScript: false
        }
      }
    };

    const expectedResponse: MockAIResponse = {
      taskId: task.id,
      generatedTests: this.generateReactTestContent(componentName),
      success: true,
      tokenCount: 250,
      cost: 0.002,
      duration: 3000
    };

    return {
      name: `react-component-${componentName.toLowerCase()}`,
      description: `Test scenario for React component ${componentName}`,
      tasks: [task],
      expectedResponses: [expectedResponse],
      expectedSuccess: true
    };
  }

  /**
   * Create a utility function test scenario
   */
  createUtilityFunctionScenario(): TestScenario {
    const sourceFile = '/test/src/utils/math.js';
    const testFile = '/test/.claude-testing/src/utils/math.test.js';
    
    const task: AITask = {
      id: 'utility-math',
      sourceFile,
      testFile,
      priority: 5,
      complexity: 3,
      estimatedTokens: 150,
      estimatedCost: 0.001,
      status: 'pending',
      prompt: 'Generate unit tests for utility functions',
      context: {
        sourceCode: `export function add(a, b) {
  return a + b;
}

export function multiply(a, b) {
  return a * b;
}

export function divide(a, b) {
  if (b === 0) {
    throw new Error('Division by zero');
  }
  return a / b;
}`,
        existingTests: '',
        dependencies: [],
        missingScenarios: [
          'Basic arithmetic tests',
          'Edge case tests',
          'Error handling tests'
        ],
        frameworkInfo: {
          language: 'javascript',
          testFramework: 'jest',
          moduleType: 'esm',
          hasTypeScript: false
        }
      }
    };

    const expectedResponse: MockAIResponse = {
      taskId: task.id,
      generatedTests: this.generateUtilityTestContent(),
      success: true,
      tokenCount: 180,
      cost: 0.0015,
      duration: 2500
    };

    return {
      name: 'utility-functions',
      description: 'Test scenario for utility functions',
      tasks: [task],
      expectedResponses: [expectedResponse],
      expectedSuccess: true
    };
  }

  /**
   * Create a failure scenario for testing error handling
   */
  createFailureScenario(): TestScenario {
    const task: AITask = {
      id: 'failing-task',
      sourceFile: '/nonexistent/file.js',
      testFile: '/nonexistent/file.test.js',
      priority: 1,
      complexity: 1,
      estimatedTokens: 50,
      estimatedCost: 0.0005,
      status: 'pending',
      prompt: 'Test failure scenario',
      context: {
        sourceCode: 'invalid syntax',
        existingTests: '',
        dependencies: [],
        missingScenarios: [],
        frameworkInfo: {
          language: 'javascript',
          testFramework: 'jest',
          moduleType: 'commonjs',
          hasTypeScript: false
        }
      }
    };

    const expectedResponse: MockAIResponse = {
      taskId: task.id,
      generatedTests: '',
      success: false,
      error: 'Failed to process invalid source code',
      duration: 1000
    };

    return {
      name: 'failure-scenario',
      description: 'Test scenario for handling failures',
      tasks: [task],
      expectedResponses: [expectedResponse],
      expectedSuccess: false,
      expectedErrors: ['Failed to process invalid source code']
    };
  }

  /**
   * Create a batch processing scenario
   */
  createBatchScenario(): TestScenario {
    const reactScenario = this.createReactComponentScenario('BatchComponent');
    const utilityScenario = this.createUtilityFunctionScenario();
    
    return {
      name: 'batch-processing',
      description: 'Test scenario for batch processing multiple tasks',
      tasks: [...reactScenario.tasks, ...utilityScenario.tasks],
      expectedResponses: [...reactScenario.expectedResponses, ...utilityScenario.expectedResponses],
      expectedSuccess: true
    };
  }

  /**
   * Create a task batch for testing
   */
  createTaskBatch(scenario: TestScenario): AITaskBatch {
    const totalTokens = scenario.tasks.reduce((sum, task) => sum + task.estimatedTokens, 0);
    const totalCost = scenario.tasks.reduce((sum, task) => sum + task.estimatedCost, 0);
    
    return {
      id: `batch-${scenario.name}`,
      tasks: scenario.tasks,
      totalEstimatedTokens: totalTokens,
      totalEstimatedCost: totalCost,
      maxConcurrency: Math.min(scenario.tasks.length, 3)
    };
  }

  /**
   * Initialize default test scenarios
   */
  private initializeDefaultScenarios(): void {
    this.registerScenario(this.createReactComponentScenario());
    this.registerScenario(this.createUtilityFunctionScenario());
    this.registerScenario(this.createFailureScenario());
    this.registerScenario(this.createBatchScenario());
  }

  /**
   * Generate React test content
   */
  private generateReactTestContent(componentName: string): string {
    return `import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ${componentName} from './${componentName}';

describe('${componentName}', () => {
  test('renders with default props', () => {
    render(<${componentName} />);
    expect(screen.getByText('Hello World')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument();
  });

  test('renders with custom title', () => {
    render(<${componentName} title="Custom Title" />);
    expect(screen.getByText('Custom Title')).toBeInTheDocument();
  });

  test('handles click events', () => {
    const mockOnClick = jest.fn();
    render(<${componentName} onClick={mockOnClick} />);
    
    fireEvent.click(screen.getByRole('button', { name: 'Click me' }));
    expect(mockOnClick).toHaveBeenCalledTimes(1);
  });

  test('applies correct CSS class', () => {
    const { container } = render(<${componentName} />);
    expect(container.firstChild).toHaveClass('${componentName.toLowerCase()}');
  });
});
`;
  }

  /**
   * Generate utility test content
   */
  private generateUtilityTestContent(): string {
    return `import { add, multiply, divide } from './math';

describe('Math Utilities', () => {
  describe('add', () => {
    test('adds positive numbers correctly', () => {
      expect(add(2, 3)).toBe(5);
      expect(add(10, 15)).toBe(25);
    });

    test('handles negative numbers', () => {
      expect(add(-2, 3)).toBe(1);
      expect(add(-5, -3)).toBe(-8);
    });

    test('handles zero', () => {
      expect(add(0, 5)).toBe(5);
      expect(add(5, 0)).toBe(5);
      expect(add(0, 0)).toBe(0);
    });
  });

  describe('multiply', () => {
    test('multiplies positive numbers correctly', () => {
      expect(multiply(2, 3)).toBe(6);
      expect(multiply(4, 5)).toBe(20);
    });

    test('handles negative numbers', () => {
      expect(multiply(-2, 3)).toBe(-6);
      expect(multiply(-2, -3)).toBe(6);
    });

    test('handles zero', () => {
      expect(multiply(0, 5)).toBe(0);
      expect(multiply(5, 0)).toBe(0);
    });
  });

  describe('divide', () => {
    test('divides positive numbers correctly', () => {
      expect(divide(6, 2)).toBe(3);
      expect(divide(15, 3)).toBe(5);
    });

    test('handles negative numbers', () => {
      expect(divide(-6, 2)).toBe(-3);
      expect(divide(-6, -2)).toBe(3);
    });

    test('throws error for division by zero', () => {
      expect(() => divide(5, 0)).toThrow('Division by zero');
      expect(() => divide(-5, 0)).toThrow('Division by zero');
    });
  });
});
`;
  }

  /**
   * Get all available scenarios
   */
  getAvailableScenarios(): string[] {
    return Array.from(this.scenarios.keys());
  }

  /**
   * Validate a test result against expected scenario
   */
  validateResult(scenario: TestScenario, actual: ValidationTestResult): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (actual.scenario !== scenario.name) {
      errors.push(`Scenario name mismatch: expected ${scenario.name}, got ${actual.scenario}`);
    }

    if (actual.success !== scenario.expectedSuccess) {
      errors.push(`Success mismatch: expected ${scenario.expectedSuccess}, got ${actual.success}`);
    }

    if (actual.tasksCompleted !== scenario.tasks.length && scenario.expectedSuccess) {
      errors.push(`Task completion mismatch: expected ${scenario.tasks.length}, got ${actual.tasksCompleted}`);
    }

    if (scenario.expectedErrors) {
      const missingErrors = scenario.expectedErrors.filter(
        expectedError => !actual.errors.some(actualError => actualError.includes(expectedError))
      );
      if (missingErrors.length > 0) {
        errors.push(`Missing expected errors: ${missingErrors.join(', ')}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}