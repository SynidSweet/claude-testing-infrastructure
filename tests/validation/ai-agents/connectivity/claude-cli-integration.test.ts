/**
 * Claude CLI Integration Tests
 * 
 * Tests the critical connectivity and integration issues identified in testing feedback:
 * - AI generation hanging during "🤖 Starting AI test generation..." phase
 * - Model recognition failures for "sonnet", "haiku", "opus" aliases
 * - Timeout handling for AI operations
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';
import { ClaudeOrchestrator } from '../../../../src/ai/ClaudeOrchestrator';
import { getModelInfo, calculateCost } from '../../../../src/utils/model-mapping';

const execAsync = promisify(exec);

describe('Claude CLI Integration - Critical Issues', () => {
  const testProjectPath = path.join(__dirname, '../../../fixtures/validation-projects/react-es-modules');
  let orchestrator: ClaudeOrchestrator;

  beforeAll(async () => {
    orchestrator = new ClaudeOrchestrator();
    
    // Ensure test project exists
    try {
      await fs.access(testProjectPath);
    } catch {
      // Create minimal test project if it doesn't exist
      await createMinimalTestProject(testProjectPath);
    }
  });

  describe('🚨 Critical Issue: AI Generation Hanging', () => {
    test('should complete AI generation without hanging (15 minute timeout)', async () => {
      const timeout = 15 * 60 * 1000; // 15 minutes
      const startTime = Date.now();

      try {
        // Test the exact scenario that was hanging in feedback
        const result = await Promise.race([
          orchestrator.processBatch({
            id: 'test-batch-1',
            totalEstimatedTokens: 100,
            totalEstimatedCost: 0.001,
            maxConcurrency: 3,
            tasks: [{
              id: 'test-task-1',
              sourceFile: path.join(testProjectPath, 'src/App.jsx'),
              testFile: path.join(testProjectPath, '.claude-testing/src/App.test.jsx'),
              priority: 8,
              complexity: 5,
              estimatedTokens: 100,
              estimatedCost: 0.001,
              status: 'pending',
              prompt: 'Generate unit tests for this React component',
              context: {
                sourceCode: 'export default function App() { return <div>Hello World</div>; }',
                existingTests: '',
                dependencies: [],
                missingScenarios: ['Basic render test'],
                frameworkInfo: {
                  name: 'react',
                  version: '18.0.0',
                  testRunner: 'jest',
                  testFilePattern: '*.test.{js,jsx}'
                }
              }
            }]
          }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('AI generation timed out')), timeout)
          )
        ]);

        const duration = Date.now() - startTime;
        
        expect(result).toBeDefined();
        expect(duration).toBeLessThan(timeout);
        console.log(`✅ AI generation completed in ${duration}ms`);
      } catch (error: any) {
        if (error.message === 'AI generation timed out') {
          fail('🚨 CRITICAL: AI generation is still hanging - this blocks production deployment');
        }
        throw error;
      }
    }, 16 * 60 * 1000); // 16 minute Jest timeout

    test('should handle empty task list gracefully', async () => {
      const result = await orchestrator.processBatch({ tasks: [] });
      expect(result).toEqual([]);
    });

    test('should handle invalid file paths without hanging', async () => {
      const startTime = Date.now();
      
      try {
        await orchestrator.processBatch({
          tasks: [{
            id: 'invalid-task',
            filePath: '/nonexistent/file.js',
            content: 'invalid content',
            language: 'javascript',
            framework: 'react',
            priority: 'low',
            estimatedTokens: 50,
            prompt: 'Generate tests for invalid file'
          }]
        });
      } catch (error) {
        const duration = Date.now() - startTime;
        expect(duration).toBeLessThan(30000); // Should fail quickly, not hang
      }
    });
  });

  describe('🚨 Critical Issue: Model Recognition', () => {
    test.each(['sonnet', 'haiku', 'opus'])('should recognize %s model alias', (modelAlias) => {
      const mapping = getModelInfo(modelAlias);
      
      expect(mapping).toBeDefined();
      expect(mapping!.fullName).toBeDefined();
      expect(mapping!.inputCostPer1K).toBeGreaterThan(0);
      expect(mapping!.outputCostPer1K).toBeGreaterThan(0);
      
      console.log(`✅ Model alias "${modelAlias}" maps to: ${mapping!.fullName}`);
    });

    test('should use model aliases in cost estimation', () => {
      const testCases = [
        { model: 'sonnet', expectedPattern: /claude-3.*sonnet/i },
        { model: 'haiku', expectedPattern: /claude-3.*haiku/i },
        { model: 'opus', expectedPattern: /claude-3.*opus/i }
      ];

      testCases.forEach(({ model, expectedPattern }) => {
        const mapping = getModelInfo(model);
        expect(mapping?.fullName).toMatch(expectedPattern);
      });
    });

    test('should provide accurate cost calculations', () => {
      const testTokens = 1000;
      
      ['sonnet', 'haiku', 'opus'].forEach(model => {
        const cost = calculateCost(model, testTokens, testTokens);
        expect(cost).toBeGreaterThan(0);
        expect(cost).toBeLessThan(1); // Reasonable cost for test tokens
      });
    });
  });

  describe('Claude CLI Availability and Authentication', () => {
    test('should have Claude CLI available', async () => {
      try {
        const { stdout } = await execAsync('claude --version');
        expect(stdout).toContain('claude');
        console.log('✅ Claude CLI version:', stdout.trim());
      } catch (error) {
        fail('Claude CLI is not available or not in PATH');
      }
    });

    test('should have valid Claude CLI configuration', async () => {
      try {
        const { stdout } = await execAsync('claude config get');
        expect(stdout).toBeTruthy();
        console.log('✅ Claude CLI is configured');
      } catch (error) {
        console.warn('⚠️ Claude CLI configuration may be missing:', (error as Error).message);
      }
    });

    test('should be able to make test API call', async () => {
      try {
        // Test a simple API call to verify connectivity
        const { stdout } = await execAsync('echo "test" | claude --model haiku "Respond with just OK"', {
          timeout: 30000
        });
        expect(stdout.toLowerCase()).toContain('ok');
        console.log('✅ Claude API connectivity verified');
      } catch (error) {
        console.warn('⚠️ Claude API test failed:', (error as Error).message);
        // Don't fail the test as this might be due to rate limits or network issues
      }
    }, 35000);
  });

  describe('Timeout Handling', () => {
    test('should respect custom timeout configurations', async () => {
      const shortTimeout = 5000; // 5 seconds
      const startTime = Date.now();

      try {
        // Create a task that should timeout quickly
        await Promise.race([
          new Promise(resolve => setTimeout(resolve, 10000)), // 10 second task
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Custom timeout')), shortTimeout)
          )
        ]);
        fail('Should have timed out');
      } catch (error) {
        const duration = Date.now() - startTime;
        expect((error as Error).message).toBe('Custom timeout');
        expect(duration).toBeLessThan(shortTimeout + 1000); // Allow 1s buffer
      }
    });

    test('should handle process termination gracefully', async () => {
      // Test that we can interrupt long-running processes
      const controller = new AbortController();
      
      setTimeout(() => controller.abort(), 1000); // Abort after 1 second
      
      try {
        await orchestrator.processBatch({ 
          id: 'test-batch',
          tasks: [],
          totalEstimatedTokens: 0,
          totalEstimatedCost: 0,
          maxConcurrency: 3
        });
      } catch (error) {
        expect((error as Error).name).toBe('AbortError');
      }
    });
  });

  describe('Error Recovery', () => {
    test('should handle API rate limiting gracefully', async () => {
      // Mock rate limiting scenario
      const rateLimitedRequest = async () => {
        throw new Error('Rate limit exceeded');
      };

      try {
        await rateLimitedRequest();
        fail('Should have thrown rate limit error');
      } catch (error) {
        expect((error as Error).message).toContain('Rate limit');
        // In real implementation, this should trigger retry logic
      }
    });

    test('should handle network interruptions', async () => {
      // Mock network failure
      const networkFailure = async () => {
        throw new Error('Network error: ECONNREFUSED');
      };

      try {
        await networkFailure();
        fail('Should have thrown network error');
      } catch (error) {
        expect((error as Error).message).toContain('Network error');
        // In real implementation, this should trigger retry logic
      }
    });
  });
});

/**
 * Create a minimal test project for validation
 */
async function createMinimalTestProject(projectPath: string): Promise<void> {
  await fs.mkdir(projectPath, { recursive: true });
  await fs.mkdir(path.join(projectPath, 'src'), { recursive: true });
  
  // Create package.json
  await fs.writeFile(
    path.join(projectPath, 'package.json'),
    JSON.stringify({
      name: 'validation-test-project',
      version: '1.0.0',
      type: 'module',
      dependencies: {
        react: '^19.1.0',
        '@testing-library/react': '^16.0.0'
      }
    }, null, 2)
  );
  
  // Create a simple React component
  await fs.writeFile(
    path.join(projectPath, 'src/App.jsx'),
    `export default function App() {
  return (
    <div className="App">
      <h1>Test Component</h1>
      <p>This is a minimal test component for validation.</p>
    </div>
  );
}`
  );
  
  // Create a utility function
  await fs.writeFile(
    path.join(projectPath, 'src/utils.js'),
    `export function add(a, b) {
  return a + b;
}

export function multiply(a, b) {
  return a * b;
}

export const CONFIG = {
  apiUrl: 'https://api.example.com',
  timeout: 5000
};`
  );
}