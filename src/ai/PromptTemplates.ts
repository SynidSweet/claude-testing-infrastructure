/**
 * Prompt Templates for AI Test Generation
 * 
 * Provides specialized prompt templates for different:
 * - Test types (unit, integration, edge cases)
 * - Languages (JavaScript, TypeScript, Python)
 * - Frameworks (React, Express, FastAPI, etc.)
 * - Testing frameworks (Jest, Vitest, Pytest)
 */

export interface PromptContext {
  language: 'javascript' | 'typescript' | 'python';
  testFramework: 'jest' | 'vitest' | 'pytest' | 'unittest';
  projectType?: 'react' | 'vue' | 'angular' | 'express' | 'fastapi' | 'django' | 'flask';
  hasTypeScript: boolean;
  moduleType: 'commonjs' | 'esm' | 'python';
  sourceCode: string;
  existingTests?: string;
  fileName: string;
  dependencies: string[];
  businessDomain?: string;
  missingScenarios: string[];
  testType?: 'unit' | 'integration' | 'edge-cases' | 'business-logic';
}

export class PromptTemplates {
  /**
   * Get the appropriate prompt template based on context
   */
  getPrompt(context: PromptContext): string {
    const basePrompt = this.getBasePrompt(context);
    const specificRequirements = this.getSpecificRequirements(context);
    const examples = this.getExamples(context);
    const outputInstructions = this.getOutputInstructions(context);

    return `${basePrompt}

${specificRequirements}

${examples}

${outputInstructions}`;
  }

  /**
   * Get base prompt with context
   */
  private getBasePrompt(context: PromptContext): string {
    const frameworkName = this.getFrameworkName(context);
    
    return `You are an expert test engineer specializing in ${context.language} and ${context.testFramework}. Your task is to write comprehensive ${context.testType || 'logical'} tests for a ${frameworkName} application.

**CONTEXT**
- Language: ${context.language}
- Test Framework: ${context.testFramework}
- Project Type: ${frameworkName}
- Module System: ${context.moduleType}
${context.businessDomain ? `- Business Domain: ${context.businessDomain}` : ''}

**SOURCE FILE**: ${context.fileName}
\`\`\`${context.language}
${context.sourceCode}
\`\`\`

${context.existingTests ? `**EXISTING TESTS**:
\`\`\`${context.language}
${context.existingTests}
\`\`\`` : '**EXISTING TESTS**: None yet'}

**MISSING TEST SCENARIOS**:
${context.missingScenarios.map(s => `- ${s}`).join('\n')}`;
  }

  /**
   * Get specific requirements based on test type and framework
   */
  private getSpecificRequirements(context: PromptContext): string {
    const requirements: string[] = [
      '**REQUIREMENTS**:',
      '1. Write tests that thoroughly validate the implementation',
      '2. Focus on the identified missing scenarios',
      '3. Ensure tests are independent and deterministic'
    ];

    // Add framework-specific requirements
    switch (context.projectType) {
      case 'react':
        requirements.push(
          '4. Use React Testing Library for component tests',
          '5. Test user interactions and state changes',
          '6. Verify rendered output and accessibility',
          '7. Mock external dependencies and API calls'
        );
        break;
      
      case 'express':
        requirements.push(
          '4. Use supertest for HTTP endpoint testing',
          '5. Test all HTTP methods and status codes',
          '6. Verify request validation and error handling',
          '7. Mock database and external service calls'
        );
        break;
      
      case 'fastapi':
        requirements.push(
          '4. Use TestClient for API endpoint testing',
          '5. Test request/response validation with Pydantic',
          '6. Verify authentication and authorization',
          '7. Use pytest fixtures for setup/teardown'
        );
        break;
      
      default:
        requirements.push(
          '4. Test all public methods and functions',
          '5. Verify error handling and edge cases',
          '6. Mock external dependencies appropriately',
          '7. Use appropriate setup/teardown hooks'
        );
    }

    // Add test type specific requirements
    switch (context.testType) {
      case 'unit':
        requirements.push(
          '8. Focus on testing individual functions/methods in isolation',
          '9. Mock all external dependencies',
          '10. Test both success and failure paths'
        );
        break;
      
      case 'integration':
        requirements.push(
          '8. Test interactions between multiple components',
          '9. Use real implementations where appropriate',
          '10. Verify data flow and state management'
        );
        break;
      
      case 'edge-cases':
        requirements.push(
          '8. Test boundary conditions and limits',
          '9. Test with invalid, null, and edge case inputs',
          '10. Verify proper error messages and handling'
        );
        break;
      
      case 'business-logic':
        requirements.push(
          '8. Test complex business rules and workflows',
          '9. Verify calculations and data transformations',
          '10. Test all business rule combinations'
        );
        break;
    }

    return requirements.join('\n');
  }

  /**
   * Get framework-specific examples
   */
  private getExamples(context: PromptContext): string {
    const examples: string[] = ['**EXAMPLES TO FOLLOW**:'];

    if (context.testFramework === 'jest' || context.testFramework === 'vitest') {
      examples.push(this.getJestExample(context));
    } else if (context.testFramework === 'pytest') {
      examples.push(this.getPytestExample(context));
    }

    return examples.join('\n\n');
  }

  /**
   * Get Jest/Vitest example
   */
  private getJestExample(context: PromptContext): string {
    if (context.projectType === 'react') {
      return `\`\`\`${context.language}
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MyComponent } from './MyComponent';

describe('MyComponent', () => {
  it('should handle user interaction correctly', async () => {
    const user = userEvent.setup();
    const mockHandler = jest.fn();
    
    render(<MyComponent onSubmit={mockHandler} />);
    
    await user.type(screen.getByLabelText('Name'), 'John Doe');
    await user.click(screen.getByRole('button', { name: 'Submit' }));
    
    await waitFor(() => {
      expect(mockHandler).toHaveBeenCalledWith({ name: 'John Doe' });
    });
  });
});
\`\`\``;
    }

    return `\`\`\`${context.language}
describe('functionName', () => {
  it('should handle normal case correctly', () => {
    const result = functionName(validInput);
    expect(result).toEqual(expectedOutput);
  });

  it('should throw error for invalid input', () => {
    expect(() => functionName(invalidInput)).toThrow('Expected error message');
  });

  it('should handle edge case', () => {
    const result = functionName(edgeCaseInput);
    expect(result).toBeDefined();
    expect(result).toHaveProperty('expectedProperty');
  });
});
\`\`\``;
  }

  /**
   * Get Pytest example
   */
  private getPytestExample(context: PromptContext): string {
    if (context.projectType === 'fastapi') {
      return `\`\`\`python
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

class TestAPI:
    def test_endpoint_success(self):
        response = client.post(
            "/api/endpoint",
            json={"field": "value"}
        )
        assert response.status_code == 200
        assert response.json()["status"] == "success"
    
    def test_endpoint_validation_error(self):
        response = client.post(
            "/api/endpoint",
            json={"invalid": "data"}
        )
        assert response.status_code == 422
        assert "validation error" in response.json()["detail"][0]["msg"]
    
    @pytest.mark.parametrize("input_value,expected", [
        ("test1", "result1"),
        ("test2", "result2"),
        ("edge_case", "edge_result"),
    ])
    def test_parametrized_cases(self, input_value, expected):
        result = process_value(input_value)
        assert result == expected
\`\`\``;
    }

    return `\`\`\`python
import pytest

class TestFunction:
    def test_normal_case(self):
        result = function_name(valid_input)
        assert result == expected_output
    
    def test_raises_exception_for_invalid_input(self):
        with pytest.raises(ValueError, match="Expected error message"):
            function_name(invalid_input)
    
    def test_edge_case(self):
        result = function_name(edge_case_input)
        assert result is not None
        assert hasattr(result, 'expected_attribute')
    
    @pytest.fixture
    def setup_data(self):
        # Setup test data
        yield test_data
        # Cleanup if needed
\`\`\``;
  }

  /**
   * Get output instructions
   */
  private getOutputInstructions(context: PromptContext): string {
    const importStyle = this.getImportStyle(context);
    
    return `**OUTPUT INSTRUCTIONS**:
- Output ONLY the test code, no explanations or markdown
- Start with necessary imports using ${importStyle}
- Include all required test setup and teardown
- Use descriptive test names that explain what is being tested
- Group related tests using describe/class blocks
- Add brief comments only for complex test logic
- Ensure all tests can run independently
- Follow ${context.testFramework} best practices and conventions
- Match the code style of existing tests (if any)

Generate the complete test file:`;
  }

  /**
   * Get framework display name
   */
  private getFrameworkName(context: PromptContext): string {
    const frameworkNames = {
      'react': 'React',
      'vue': 'Vue.js',
      'angular': 'Angular',
      'express': 'Express.js',
      'fastapi': 'FastAPI',
      'django': 'Django',
      'flask': 'Flask'
    };
    
    return frameworkNames[context.projectType || 'unknown' as keyof typeof frameworkNames] || context.language;
  }

  /**
   * Get import style based on module type
   */
  private getImportStyle(context: PromptContext): string {
    switch (context.moduleType) {
      case 'esm':
        return 'ES6 import/export syntax';
      case 'commonjs':
        return 'CommonJS require/module.exports syntax';
      case 'python':
        return 'Python import statements';
      default:
        return 'appropriate import syntax';
    }
  }

  /**
   * Get specialized prompt for React components
   */
  getReactComponentPrompt(context: PromptContext): string {
    return `You are a React testing expert. Write comprehensive tests for the following React component using React Testing Library and ${context.testFramework}.

**COMPONENT**: ${context.fileName}
\`\`\`${context.language}
${context.sourceCode}
\`\`\`

**REQUIREMENTS**:
1. Test all props and their effects on rendering
2. Test user interactions (clicks, typing, etc.)
3. Test conditional rendering
4. Test error boundaries if present
5. Test accessibility (ARIA attributes, roles)
6. Mock child components if needed
7. Test component lifecycle and effects
8. Verify component state changes

**TEST SCENARIOS**:
${context.missingScenarios.map(s => `- ${s}`).join('\n')}

Write comprehensive React component tests:`;
  }

  /**
   * Get specialized prompt for API endpoints
   */
  getAPIEndpointPrompt(context: PromptContext): string {
    const framework = context.projectType === 'express' ? 'Express.js' : 
                     context.projectType === 'fastapi' ? 'FastAPI' : 'API';
    
    return `You are an API testing expert. Write comprehensive tests for the following ${framework} endpoints.

**API FILE**: ${context.fileName}
\`\`\`${context.language}
${context.sourceCode}
\`\`\`

**REQUIREMENTS**:
1. Test all HTTP methods (GET, POST, PUT, DELETE, etc.)
2. Test successful responses with valid data
3. Test validation errors with invalid data
4. Test authentication and authorization
5. Test rate limiting if implemented
6. Test pagination and filtering
7. Test error responses and status codes
8. Mock database and external services

**TEST SCENARIOS**:
${context.missingScenarios.map(s => `- ${s}`).join('\n')}

Write comprehensive API endpoint tests:`;
  }

  /**
   * Get specialized prompt for data processing functions
   */
  getDataProcessingPrompt(context: PromptContext): string {
    return `You are a data processing testing expert. Write comprehensive tests for the following data processing logic.

**FILE**: ${context.fileName}
\`\`\`${context.language}
${context.sourceCode}
\`\`\`

**REQUIREMENTS**:
1. Test with various data sizes (empty, single, large datasets)
2. Test data validation and sanitization
3. Test transformation accuracy
4. Test performance with large datasets
5. Test error handling for malformed data
6. Test edge cases (null, undefined, special characters)
7. Test concurrent processing if applicable
8. Verify output format and structure

**TEST SCENARIOS**:
${context.missingScenarios.map(s => `- ${s}`).join('\n')}

Write comprehensive data processing tests:`;
  }
}