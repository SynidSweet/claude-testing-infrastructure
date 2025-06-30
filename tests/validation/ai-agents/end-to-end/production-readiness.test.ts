/**
 * Production Readiness Validation
 * 
 * End-to-end tests that validate the complete workflow based on testing feedback:
 * - Complete analyze → test → run workflow should work without manual intervention
 * - Generated tests should be executable without fixes
 * - All critical issues should be resolved before production deployment
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';

const execAsync = promisify(exec);
const CLI_COMMAND = 'node dist/cli/index.js';

interface ProductionReadinessResults {
  aiGenerationWorking: boolean;
  modelRecognitionWorking: boolean;
  testQualityScore: number;
  executionSuccessRate: number;
  averageCompletionTime: number;
  criticalIssuesResolved: boolean;
  overallScore: number;
}

describe('Production Readiness Validation - End-to-End', () => {
  const testProjectPath = path.join(__dirname, '../../../fixtures/validation-projects/react-es-modules');
  
  beforeAll(async () => {
    // Ensure test project exists
    try {
      await fs.access(testProjectPath);
    } catch {
      await createValidationProject(testProjectPath);
    }
  });

  describe('🎯 Complete Workflow Validation', () => {
    test('should complete full analyze → test → run workflow', async () => {
      const workflowResults = await runCompleteWorkflow(testProjectPath);
      
      expect(workflowResults.analysisSuccess).toBe(true);
      expect(workflowResults.testGenerationSuccess).toBe(true);
      expect(workflowResults.testExecutionSuccess).toBe(true);
      expect(workflowResults.totalTime).toBeLessThan(30 * 60 * 1000); // 30 minutes max
      
      console.log('✅ Complete workflow validation passed');
      console.log(`   Analysis time: ${workflowResults.analysisTime}ms`);
      console.log(`   Generation time: ${workflowResults.generationTime}ms`);
      console.log(`   Execution time: ${workflowResults.executionTime}ms`);
      console.log(`   Total time: ${workflowResults.totalTime}ms`);
    }, 35 * 60 * 1000); // 35 minute timeout

    test('should generate executable tests without manual fixes', async () => {
      // Clean slate
      await cleanupTestOutput(testProjectPath);
      
      // Generate tests
      const generationResult = await execAsync(
        `${CLI_COMMAND} test ${testProjectPath} --only-structural`,
        { cwd: path.resolve('.') }
      );
      
      expect(generationResult.stderr).not.toContain('Error');
      
      // Verify tests were generated
      const testDir = path.join(testProjectPath, '.claude-testing', 'tests');
      const testFiles = await fs.readdir(testDir, { recursive: true });
      const testFileCount = testFiles.filter(f => f.toString().endsWith('.test.js')).length;
      
      expect(testFileCount).toBeGreaterThan(0);
      
      // Attempt to run generated tests
      try {
        const runResult = await execAsync(
          `${CLI_COMMAND} run ${testProjectPath}`,
          { cwd: path.resolve('.'), timeout: 120000 }
        );
        
        expect(runResult.stdout).toContain('test');
        console.log('✅ Generated tests are executable without manual fixes');
      } catch (error) {
        console.error('❌ Generated tests require manual fixes:', error instanceof Error ? error.message : String(error));
        throw new Error('Generated tests are not immediately executable');
      }
    }, 10 * 60 * 1000);
  });

  describe('🚨 Critical Issues Resolution Validation', () => {
    test('should verify AI generation no longer hangs', async () => {
      const timeout = 10 * 60 * 1000; // 10 minutes
      const startTime = Date.now();
      
      try {
        // Test AI generation with timeout
        await Promise.race([
          execAsync(`${CLI_COMMAND} test ${testProjectPath} --only-logical --budget 1.00`, {
            cwd: path.resolve('.'),
            timeout: timeout - 1000 // Slightly less than our timeout
          }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('AI generation timeout')), timeout)
          )
        ]);
        
        const duration = Date.now() - startTime;
        console.log(`✅ AI generation completed in ${duration}ms (no hanging)`);
        
        expect(duration).toBeLessThan(timeout);
      } catch (error) {
        if (error instanceof Error ? error.message : String(error).includes('timeout') || error instanceof Error ? error.message : String(error).includes('AI generation timeout')) {
          fail('🚨 CRITICAL: AI generation is still hanging - production blocker not resolved');
        }
        // Other errors might be expected (API limits, etc.) but not hanging
        console.log(`⚠️ AI generation failed but didn't hang: ${error instanceof Error ? error.message : String(error)}`);
      }
    }, 12 * 60 * 1000);

    test('should verify model recognition works for all aliases', async () => {
      const models = ['sonnet', 'haiku', 'opus'];
      const results = [];
      
      for (const model of models) {
        try {
          const result = await execAsync(
            `${CLI_COMMAND} analyze-gaps ${testProjectPath} --model ${model} --dry-run`,
            { cwd: path.resolve('.'), timeout: 30000 }
          );
          
          // Should not contain "Unknown model" error
          expect(result.stderr).not.toContain('Unknown model');
          expect(result.stderr).not.toContain(`Unknown model: ${model}`);
          
          results.push({ model, success: true, output: result.stdout });
        } catch (error) {
          results.push({ model, success: false, error: error instanceof Error ? error.message : String(error) });
        }
      }
      
      const successfulRecognitions = results.filter(r => r.success).length;
      const failedRecognitions = results.filter(r => !r.success);
      
      console.log(`✅ Model recognition results: ${successfulRecognitions}/${models.length} successful`);
      
      if (failedRecognitions.length > 0) {
        console.log('❌ Failed model recognitions:');
        failedRecognitions.forEach(({ model, error }) => {
          console.log(`   ${model}: ${error}`);
        });
      }
      
      expect(successfulRecognitions).toBe(models.length);
    });

    test('should verify import path issues are resolved', async () => {
      // Generate tests for ES module project
      await execAsync(`${CLI_COMMAND} test ${testProjectPath} --only-structural`, {
        cwd: path.resolve('.')
      });
      
      // Check generated test files for correct import paths
      const testDir = path.join(testProjectPath, '.claude-testing', 'tests');
      const testFiles = await fs.readdir(testDir, { recursive: true });
      const jsTestFiles = testFiles.filter(f => f.toString().endsWith('.test.js'));
      
      let importIssueCount = 0;
      
      for (const testFile of jsTestFiles) {
        const testFilePath = path.join(testDir, testFile.toString());
        const content = await fs.readFile(testFilePath, 'utf-8');
        
        // Check for ES module import patterns
        const importLines = content.split('\n').filter(line => 
          line.trim().startsWith('import') && (line.includes('./') || line.includes('../'))
        );
        
        for (const importLine of importLines) {
          if (!importLine.match(/\.js['"]$/)) {
            importIssueCount++;
            console.log(`❌ Import path issue in ${testFile}: ${importLine.trim()}`);
          }
        }
      }
      
      if (importIssueCount === 0) {
        console.log('✅ All import paths are correctly formatted for ES modules');
      }
      
      expect(importIssueCount).toBe(0);
    });
  });

  describe('📊 Production Quality Metrics', () => {
    test('should meet production readiness criteria', async () => {
      const results = await runProductionValidation(testProjectPath);
      
      console.log('Production Readiness Report:');
      console.log(`  AI Generation Working: ${results.aiGenerationWorking ? '✅' : '❌'}`);
      console.log(`  Model Recognition Working: ${results.modelRecognitionWorking ? '✅' : '❌'}`);
      console.log(`  Test Quality Score: ${results.testQualityScore.toFixed(2)} ${results.testQualityScore >= 0.7 ? '✅' : '❌'}`);
      console.log(`  Execution Success Rate: ${results.executionSuccessRate.toFixed(2)} ${results.executionSuccessRate >= 0.9 ? '✅' : '❌'}`);
      console.log(`  Average Completion Time: ${(results.averageCompletionTime / 1000).toFixed(1)}s ${results.averageCompletionTime < 20 * 60 * 1000 ? '✅' : '❌'}`);
      console.log(`  Critical Issues Resolved: ${results.criticalIssuesResolved ? '✅' : '❌'}`);
      console.log(`  Overall Score: ${results.overallScore.toFixed(2)}/1.0`);
      
      // Production gates
      expect(results.testQualityScore).toBeGreaterThan(0.7); // 70% quality minimum
      expect(results.executionSuccessRate).toBeGreaterThan(0.9); // 90% success rate
      expect(results.averageCompletionTime).toBeLessThan(20 * 60 * 1000); // 20 minutes max
      expect(results.criticalIssuesResolved).toBe(true);
      expect(results.overallScore).toBeGreaterThan(0.8); // 80% overall score
      
      if (results.overallScore >= 0.8) {
        console.log('🎉 PRODUCTION READY: All criteria met');
      } else {
        console.log('⚠️ NOT PRODUCTION READY: Criteria not met');
      }
    }, 25 * 60 * 1000);
  });

  describe('🔄 Regression Prevention', () => {
    test('should prevent regression of resolved issues', async () => {
      // Test that previously resolved issues don't reappear
      const regressionTests = [
        {
          name: 'AI Generation Hanging',
          test: async () => {
            const startTime = Date.now();
            try {
              await execAsync(`${CLI_COMMAND} analyze-gaps ${testProjectPath} --dry-run`, {
                cwd: path.resolve('.'),
                timeout: 60000
              });
              return { success: true, duration: Date.now() - startTime };
            } catch (error) {
              return { success: false, error: error instanceof Error ? error.message : String(error), duration: Date.now() - startTime };
            }
          }
        },
        {
          name: 'Model Recognition',
          test: async () => {
            try {
              const result = await execAsync(`${CLI_COMMAND} analyze-gaps ${testProjectPath} --model sonnet --dry-run`, {
                cwd: path.resolve('.'),
                timeout: 30000
              });
              return { success: !result.stderr.includes('Unknown model'), output: result.stderr };
            } catch (error) {
              return { success: false, error: error instanceof Error ? error.message : String(error) };
            }
          }
        },
        {
          name: 'CLI Error Messages',
          test: async () => {
            try {
              const result = await execAsync(`${CLI_COMMAND} --version`, {
                cwd: path.resolve('.'),
                timeout: 10000
              });
              return { success: result.stderr === '', output: result.stdout, stderr: result.stderr };
            } catch (error) {
              return { success: false, error: error instanceof Error ? error.message : String(error) };
            }
          }
        }
      ];
      
      const results = [];
      for (const { name, test } of regressionTests) {
        const result = await test();
        results.push({ name, ...result });
      }
      
      console.log('Regression Test Results:');
      results.forEach(({ name, success, ...details }) => {
        console.log(`  ${name}: ${success ? '✅ PASS' : '❌ FAIL'}`);
        if (!success && details.error) {
          console.log(`    Error: ${details.error}`);
        }
      });
      
      const allPassed = results.every(r => r.success);
      expect(allPassed).toBe(true);
    });
  });
});

/**
 * Run complete workflow validation
 */
async function runCompleteWorkflow(projectPath: string) {
  const results = {
    analysisSuccess: false,
    analysisTime: 0,
    testGenerationSuccess: false,
    generationTime: 0,
    testExecutionSuccess: false,
    executionTime: 0,
    totalTime: 0
  };
  
  const overallStart = Date.now();
  
  try {
    // Phase 1: Analysis
    const analysisStart = Date.now();
    await execAsync(`${CLI_COMMAND} analyze ${projectPath}`, {
      cwd: path.resolve('.')
    });
    results.analysisTime = Date.now() - analysisStart;
    results.analysisSuccess = true;
    
    // Phase 2: Test Generation
    const generationStart = Date.now();
    await execAsync(`${CLI_COMMAND} test ${projectPath} --only-structural`, {
      cwd: path.resolve('.')
    });
    results.generationTime = Date.now() - generationStart;
    results.testGenerationSuccess = true;
    
    // Phase 3: Test Execution
    const executionStart = Date.now();
    await execAsync(`${CLI_COMMAND} run ${projectPath}`, {
      cwd: path.resolve('.'),
      timeout: 120000
    });
    results.executionTime = Date.now() - executionStart;
    results.testExecutionSuccess = true;
    
  } catch (error) {
    console.error('Workflow step failed:', error instanceof Error ? error instanceof Error ? error.message : String(error) : String(error));
  }
  
  results.totalTime = Date.now() - overallStart;
  return results;
}

/**
 * Run comprehensive production validation
 */
async function runProductionValidation(projectPath: string): Promise<ProductionReadinessResults> {
  const results: ProductionReadinessResults = {
    aiGenerationWorking: false,
    modelRecognitionWorking: false,
    testQualityScore: 0,
    executionSuccessRate: 0,
    averageCompletionTime: 0,
    criticalIssuesResolved: false,
    overallScore: 0
  };
  
  try {
    // Test AI generation (without hanging)
    const aiStart = Date.now();
    try {
      await execAsync(`${CLI_COMMAND} analyze-gaps ${projectPath} --dry-run`, {
        cwd: path.resolve('.'),
        timeout: 120000
      });
      results.aiGenerationWorking = true;
    } catch (error) {
      console.log('AI generation test failed:', error instanceof Error ? error.message : String(error));
    }
    
    // Test model recognition
    try {
      const modelTest = await execAsync(`${CLI_COMMAND} analyze-gaps ${projectPath} --model sonnet --dry-run`, {
        cwd: path.resolve('.'),
        timeout: 30000
      });
      results.modelRecognitionWorking = !modelTest.stderr.includes('Unknown model');
    } catch (error) {
      console.log('Model recognition test failed:', error instanceof Error ? error.message : String(error));
    }
    
    // Test quality and execution
    await cleanupTestOutput(projectPath);
    await execAsync(`${CLI_COMMAND} test ${projectPath} --only-structural`, {
      cwd: path.resolve('.')
    });
    
    // Analyze test quality
    results.testQualityScore = await analyzeGeneratedTestQuality(projectPath);
    
    // Test execution success rate
    try {
      await execAsync(`${CLI_COMMAND} run ${projectPath}`, {
        cwd: path.resolve('.'),
        timeout: 120000
      });
      results.executionSuccessRate = 1.0; // If it runs, it's 100% for this test
    } catch (error) {
      results.executionSuccessRate = 0.0;
    }
    
    results.averageCompletionTime = Date.now() - aiStart;
    
    // Check if critical issues are resolved
    results.criticalIssuesResolved = 
      results.aiGenerationWorking && 
      results.modelRecognitionWorking && 
      results.executionSuccessRate > 0.8;
    
    // Calculate overall score
    results.overallScore = (
      (results.aiGenerationWorking ? 0.3 : 0) +
      (results.modelRecognitionWorking ? 0.2 : 0) +
      (results.testQualityScore * 0.2) +
      (results.executionSuccessRate * 0.2) +
      (results.criticalIssuesResolved ? 0.1 : 0)
    );
    
  } catch (error) {
    console.error('Production validation failed:', error instanceof Error ? error.message : String(error));
  }
  
  return results;
}

/**
 * Analyze quality of generated tests
 */
async function analyzeGeneratedTestQuality(projectPath: string): Promise<number> {
  try {
    const testDir = path.join(projectPath, '.claude-testing', 'tests');
    const files = await fs.readdir(testDir, { recursive: true });
    const testFiles = files.filter(f => f.toString().endsWith('.test.js'));
    
    if (testFiles.length === 0) return 0;
    
    let totalQuality = 0;
    
    for (const testFile of testFiles) {
      const content = await fs.readFile(path.join(testDir, testFile.toString()), 'utf-8');
      
      const assertions = (content.match(/expect\(/g) || []).length;
      const todos = (content.match(/TODO|FIXME/gi) || []).length;
      const testCases = (content.match(/test\(/g) || []).length;
      
      // Simple quality calculation
      const quality = Math.min(1, (assertions - todos * 0.5) / Math.max(testCases, 1));
      totalQuality += Math.max(0, quality);
    }
    
    return totalQuality / testFiles.length;
  } catch (error) {
    return 0;
  }
}

/**
 * Clean up test output
 */
async function cleanupTestOutput(projectPath: string): Promise<void> {
  const testDir = path.join(projectPath, '.claude-testing');
  try {
    await fs.rm(testDir, { recursive: true, force: true });
  } catch (error) {
    // Ignore cleanup errors
  }
}

/**
 * Create validation project
 */
async function createValidationProject(projectPath: string): Promise<void> {
  await fs.mkdir(projectPath, { recursive: true });
  await fs.mkdir(path.join(projectPath, 'src'), { recursive: true });
  
  await fs.writeFile(
    path.join(projectPath, 'package.json'),
    JSON.stringify({
      name: 'validation-project',
      version: '1.0.0',
      type: 'module',
      scripts: {
        test: 'jest'
      },
      dependencies: {
        react: '^19.1.0'
      },
      devDependencies: {
        '@testing-library/react': '^16.0.0',
        '@testing-library/jest-dom': '^6.0.0',
        jest: '^29.0.0'
      }
    }, null, 2)
  );
  
  await fs.writeFile(
    path.join(projectPath, 'src/App.jsx'),
    `export default function App() {
  return <div>Hello World</div>;
}`
  );
  
  await fs.writeFile(
    path.join(projectPath, 'src/utils.js'),
    `export function add(a, b) {
  return a + b;
}

export function subtract(a, b) {
  return a - b;
}`
  );
}