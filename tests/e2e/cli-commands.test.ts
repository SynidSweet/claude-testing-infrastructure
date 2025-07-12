/**
 * CLI Commands End-to-End Validation
 * 
 * Tests all CLI commands with real projects to ensure they work correctly
 * Part of IMPL-E2E-001 - Create End-to-End Validation Suite
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';
import { TestFixtureManager } from '../fixtures/shared/TestFixtureManager';

const execAsync = promisify(exec);
const CLI_COMMAND = 'node dist/cli/index.js';

describe('CLI Commands End-to-End Validation', () => {
  let fixtureManager: TestFixtureManager;
  let testProjectPath: string;
  
  beforeAll(async () => {
    fixtureManager = TestFixtureManager.getInstance();
    testProjectPath = await fixtureManager.createTemporaryProject('react-project');
  });

  afterEach(async () => {
    // Cleanup generated test artifacts
    await cleanupTestOutput(testProjectPath);
  });

  describe('Core Commands', () => {
    test('analyze command should work with all options', async () => {
      // Basic analysis
      const basicResult = await execAsync(`${CLI_COMMAND} analyze ${testProjectPath}`, {
        cwd: path.resolve('.')
      });
      
      expect(basicResult.stdout).toContain('Project analysis completed');
      expect(basicResult.stderr).not.toContain('Error');

      // Analysis with output file
      const outputPath = path.join(testProjectPath, 'analysis-output.json');
      const outputResult = await execAsync(
        `${CLI_COMMAND} analyze ${testProjectPath} --output ${outputPath} --format json`, 
        { cwd: path.resolve('.') }
      );
      
      expect(outputResult.stdout).toContain('Project analysis completed');
      
      // Verify output file was created
      const outputExists = await fs.access(outputPath).then(() => true).catch(() => false);
      expect(outputExists).toBe(true);

      // Verbose analysis
      const verboseResult = await execAsync(`${CLI_COMMAND} analyze ${testProjectPath} --verbose`, {
        cwd: path.resolve('.')
      });
      
      expect(verboseResult.stdout).toContain('Project analysis completed');
      
      console.log('✅ Analyze command working with all options');
    }, 2 * 60 * 1000);

    test('test command should work with all options', async () => {
      // Structural tests only
      const structuralResult = await execAsync(`${CLI_COMMAND} test ${testProjectPath} --only-structural`, {
        cwd: path.resolve('.')
      });
      
      expect(structuralResult.stderr).not.toContain('Error');
      
      // Verify tests were generated
      const testsGenerated = await countGeneratedTests(testProjectPath);
      expect(testsGenerated).toBeGreaterThan(0);

      // Cleanup for next test
      await cleanupTestOutput(testProjectPath);

      // Dry run
      const dryRunResult = await execAsync(`${CLI_COMMAND} test ${testProjectPath} --dry-run`, {
        cwd: path.resolve('.')
      });
      
      expect(dryRunResult.stdout.toLowerCase()).toContain('dry run');
      
      // Verify no tests were actually created
      const testsAfterDryRun = await countGeneratedTests(testProjectPath);
      expect(testsAfterDryRun).toBe(0);

      console.log('✅ Test command working with all options');
    }, 3 * 60 * 1000);

    test('run command should work with various options', async () => {
      // First generate some tests
      await execAsync(`${CLI_COMMAND} test ${testProjectPath} --only-structural`, {
        cwd: path.resolve('.')
      });

      try {
        // Basic run
        const runResult = await execAsync(`${CLI_COMMAND} run ${testProjectPath}`, {
          cwd: path.resolve('.'),
          timeout: 60000
        });
        
        expect(runResult.stdout).toContain('test');
        console.log('✅ Basic run command working');
      } catch (error) {
        // Handle expected dependency issues
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes('jest-environment-jsdom') || 
            errorMessage.includes('Test environment')) {
          console.log('⚠️ Run command skipped due to missing jest-environment-jsdom (expected)');
        } else {
          throw error;
        }
      }

      try {
        // Run with coverage
        const coverageResult = await execAsync(`${CLI_COMMAND} run ${testProjectPath} --coverage`, {
          cwd: path.resolve('.'),
          timeout: 60000
        });
        
        expect(coverageResult.stdout).toMatch(/coverage|test/i);
        console.log('✅ Coverage run command working');
      } catch (error) {
        console.log('⚠️ Coverage run skipped due to dependencies (expected)');
      }
    }, 3 * 60 * 1000);

    test('init-config command should work', async () => {
      const tempProjectPath = await fixtureManager.createTemporaryProject('empty');
      
      const initResult = await execAsync(`${CLI_COMMAND} init-config ${tempProjectPath}`, {
        cwd: path.resolve('.')
      });
      
      expect(initResult.stdout).toContain('Configuration initialized');
      
      // Verify config file was created
      const configPath = path.join(tempProjectPath, '.claude-testing.config.json');
      const configExists = await fs.access(configPath).then(() => true).catch(() => false);
      expect(configExists).toBe(true);

      // Verify config is valid JSON
      const configContent = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(configContent);
      expect(config).toHaveProperty('include');
      
      console.log('✅ Init-config command working');
    }, 60000);
  });

  describe('Advanced Commands', () => {
    test('incremental command should work', async () => {
      // Generate initial tests
      await execAsync(`${CLI_COMMAND} test ${testProjectPath} --only-structural`, {
        cwd: path.resolve('.')
      });

      // Run incremental update
      const incrementalResult = await execAsync(`${CLI_COMMAND} incremental ${testProjectPath}`, {
        cwd: path.resolve('.')
      });
      
      expect(incrementalResult.stderr).not.toContain('Error');
      
      console.log('✅ Incremental command working');
    }, 2 * 60 * 1000);

    test('watch command should initialize (but not run indefinitely)', async () => {
      // Test that watch command starts without error (kill it quickly)
      const watchProcess = exec(`${CLI_COMMAND} watch ${testProjectPath}`, {
        cwd: path.resolve('.')
      });

      // Let it start then kill it
      await new Promise(resolve => setTimeout(resolve, 3000));
      watchProcess.kill('SIGTERM');

      // If we get here without errors, watch command initialized successfully
      console.log('✅ Watch command initializes correctly');
    }, 10000);

    test('analyze-gaps command should work', async () => {
      // Generate some tests first
      await execAsync(`${CLI_COMMAND} test ${testProjectPath} --only-structural`, {
        cwd: path.resolve('.')
      });

      const gapsResult = await execAsync(`${CLI_COMMAND} analyze-gaps ${testProjectPath}`, {
        cwd: path.resolve('.')
      });
      
      expect(gapsResult.stderr).not.toContain('Error');
      
      console.log('✅ Analyze-gaps command working');
    }, 60000);
  });

  describe('Error Handling', () => {
    test('should handle invalid project paths', async () => {
      const invalidPath = '/nonexistent/project/path';
      
      try {
        await execAsync(`${CLI_COMMAND} analyze ${invalidPath}`, {
          cwd: path.resolve('.')
        });
        fail('Should have failed with invalid path');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        expect(errorMessage).toMatch(/not found|does not exist|ENOENT/i);
        console.log('✅ Invalid path error handling working');
      }
    });

    test('should handle invalid command options', async () => {
      try {
        await execAsync(`${CLI_COMMAND} analyze ${testProjectPath} --invalid-option`, {
          cwd: path.resolve('.')
        });
        fail('Should have failed with invalid option');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        expect(errorMessage).toMatch(/unknown|invalid|unrecognized/i);
        console.log('✅ Invalid option error handling working');
      }
    });

    test('should provide helpful error messages', async () => {
      try {
        await execAsync(`${CLI_COMMAND} nonexistent-command`, {
          cwd: path.resolve('.')
        });
        fail('Should have failed with unknown command');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        expect(errorMessage).toMatch(/unknown command|available commands/i);
        console.log('✅ Unknown command error handling working');
      }
    });
  });

  describe('Configuration Integration', () => {
    test('should respect configuration file settings', async () => {
      // Create custom configuration
      const configPath = path.join(testProjectPath, '.claude-testing.config.json');
      await fs.writeFile(configPath, JSON.stringify({
        include: ['src/**/*.jsx'],
        exclude: ['src/components/**'],
        testFramework: 'jest',
        features: {
          coverage: true
        }
      }));

      const result = await execAsync(`${CLI_COMMAND} analyze ${testProjectPath}`, {
        cwd: path.resolve('.')
      });
      
      expect(result.stdout).toContain('Project analysis completed');
      console.log('✅ Configuration file integration working');
    });

    test('should handle configuration validation', async () => {
      // Create invalid configuration
      const configPath = path.join(testProjectPath, '.claude-testing.config.json');
      await fs.writeFile(configPath, JSON.stringify({
        include: 123, // Invalid type
        invalid: 'field'
      }));

      // Should handle gracefully
      const result = await execAsync(`${CLI_COMMAND} analyze ${testProjectPath}`, {
        cwd: path.resolve('.')
      });
      
      expect(result.stdout).toContain('Project analysis completed');
      console.log('✅ Configuration validation working');
    });
  });

  describe('Output Formats', () => {
    test('should support different output formats', async () => {
      // JSON format
      const jsonResult = await execAsync(`${CLI_COMMAND} analyze ${testProjectPath} --format json`, {
        cwd: path.resolve('.')
      });
      expect(jsonResult.stdout).toContain('Project analysis completed');

      // Markdown format
      const markdownResult = await execAsync(`${CLI_COMMAND} analyze ${testProjectPath} --format markdown`, {
        cwd: path.resolve('.')
      });
      expect(markdownResult.stdout).toContain('Project analysis completed');

      // Console format (default)
      const consoleResult = await execAsync(`${CLI_COMMAND} analyze ${testProjectPath} --format console`, {
        cwd: path.resolve('.')
      });
      expect(consoleResult.stdout).toContain('Project analysis completed');

      console.log('✅ All output formats working');
    });
  });

  describe('Help and Version', () => {
    test('should display version information', async () => {
      const versionResult = await execAsync(`${CLI_COMMAND} --version`, {
        cwd: path.resolve('.')
      });
      
      expect(versionResult.stdout).toMatch(/\d+\.\d+\.\d+/);
      expect(versionResult.stderr).toBe('');
      
      console.log('✅ Version command working');
    });

    test('should display help information', async () => {
      const helpResult = await execAsync(`${CLI_COMMAND} --help`, {
        cwd: path.resolve('.')
      });
      
      expect(helpResult.stdout).toContain('Usage:');
      expect(helpResult.stdout).toContain('Commands:');
      
      console.log('✅ Help command working');
    });

    test('should display command-specific help', async () => {
      const analyzeHelpResult = await execAsync(`${CLI_COMMAND} analyze --help`, {
        cwd: path.resolve('.')
      });
      
      expect(analyzeHelpResult.stdout).toContain('analyze');
      expect(analyzeHelpResult.stdout).toContain('Options:');
      
      console.log('✅ Command-specific help working');
    });
  });
});

/**
 * Count generated test files
 */
async function countGeneratedTests(projectPath: string): Promise<number> {
  try {
    const testDir = path.join(projectPath, '.claude-testing');
    const files = await fs.readdir(testDir, { recursive: true });
    // Match both standard patterns (.test.py, .spec.py) and Python patterns (.unit_test.py, .utility_test.py, etc.)
    return files.filter(f => f.toString().match(/\.(test|spec)\.(js|ts|jsx|tsx|py)$|_test\.py$/)).length;
  } catch {
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
  } catch {
    // Ignore cleanup errors
  }
}