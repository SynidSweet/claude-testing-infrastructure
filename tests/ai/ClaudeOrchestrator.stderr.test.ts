/**
 * Integration tests for ClaudeOrchestrator stderr parsing functionality
 */

import { ClaudeOrchestrator } from '../../src/ai/ClaudeOrchestrator';
import type { AITaskBatch } from '../../src/ai/AITaskPreparation';
import { EventEmitter } from 'events';
import * as child_process from 'child_process';
import * as fs from 'fs/promises';
import { TimerTestUtils } from '../../src/utils/TimerTestUtils';
import { RealTimer } from '../../src/utils/RealTimer';
// AI error types are imported to ensure they exist but not directly used in assertions

// Mock child_process and fs
jest.mock('child_process');
jest.mock('fs/promises');

// Helper to create a mock process
function createMockProcess() {
  const proc = new EventEmitter() as any;
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  proc.kill = jest.fn();
  proc.killed = false;
  proc.pid = 12345;
  return proc;
}

describe('ClaudeOrchestrator - Enhanced Stderr Parsing', () => {
  jest.setTimeout(30000); // 30 second timeout for all tests to handle timing-sensitive operations
  let orchestrator: ClaudeOrchestrator;
  // let mockTimer: ReturnType<typeof createMockTimer>;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup fake timers for deterministic timer testing
    jest.useFakeTimers();
    
    // Mock execSync for auth validation
    jest.spyOn(child_process, 'execSync').mockImplementation((cmd: string) => {
      if (cmd.includes('--version')) {
        return 'claude version 1.0.0';
      }
      if (cmd.includes('config get')) {
        return 'authenticated';
      }
      return '';
    });
    
    // Mock fs operations
    (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
    (fs.readFile as jest.Mock).mockRejectedValue(new Error('File not found'));
    (fs.writeFile as jest.Mock).mockResolvedValue(undefined);
    
    orchestrator = new ClaudeOrchestrator({
      maxConcurrent: 1,
      timeout: 5000,
      retryAttempts: 0, // Disable retries for faster error detection tests
      timerService: new RealTimer(), // Use RealTimer which works with Jest fake timers
      gracefulDegradation: false, // Disable graceful degradation for these tests
      checkpointingEnabled: false, // Disable checkpointing for simpler tests
      circuitBreakerEnabled: false, // Disable circuit breaker for simpler tests
    });
  });

  afterEach(() => {
    // Clean up orchestrator and timers
    orchestrator.cleanup();
    TimerTestUtils.cleanupTimers();
  });

  describe('Early Authentication Error Detection', () => {
    it('should terminate immediately on authentication error', async () => {
      const mockProcess = createMockProcess();
      const spawnSpy = jest.spyOn(child_process, 'spawn').mockReturnValue(mockProcess);

      const batch: AITaskBatch = {
        id: 'test-batch',
        tasks: [{
          id: 'task-1',
          prompt: 'Generate tests',
          sourceFile: '/test/file.ts',
          testFile: '/test/file.test.ts',
          context: {
            sourceCode: 'const test = 1;',
            existingTests: '',
            missingScenarios: ['test scenario'],
            dependencies: [],
            frameworkInfo: { 
              language: 'javascript', 
              testFramework: 'jest', 
              moduleType: 'commonjs', 
              hasTypeScript: false 
            },
          },
          estimatedTokens: 100,
          estimatedCost: 0.01,
          priority: 1,
          complexity: 1,
          status: 'pending' as const,
        }],
        totalEstimatedTokens: 100,
        totalEstimatedCost: 0.01,
        maxConcurrency: 1,
      };

      const processPromise = orchestrator.processBatch(batch);
      
      // Wait for process setup and spawn using TimerTestUtils
      await TimerTestUtils.waitForEvents(); // Wait for initial setup
      await TimerTestUtils.waitForEvents(); // Wait for process spawn
      
      // Verify spawn was called
      expect(spawnSpy).toHaveBeenCalled();
      
      // Simulate auth error on stderr
      mockProcess.stderr.emit('data', Buffer.from('Error: Authentication failed. Please login first.\n'));
      
      // Process should be killed immediately
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');
      
      // Emit close event to complete the process
      mockProcess.emit('close', 1);
      
      // Should complete with error result
      const results = await processPromise;
      
      expect(results).toHaveLength(1);
      expect(results[0]?.success).toBe(false);
      expect(results[0]?.error).toContain('Authentication error detected');
    });

    it('should detect various authentication error patterns', async () => {
      const authErrorPatterns = [
        'User is not authenticated',
        'Please login to continue',
        'Invalid API key provided',
        'Missing API key',
        'Unauthorized: Invalid credentials',
      ];

      for (const errorPattern of authErrorPatterns) {
        const mockProcess = createMockProcess();
        jest.spyOn(child_process, 'spawn').mockReturnValue(mockProcess);
        
        const batch: AITaskBatch = {
          id: `test-batch-${errorPattern}`,
          tasks: [{
            id: 'task-1',
            prompt: 'Generate tests',
            sourceFile: '/test/file.ts',
            testFile: '/test/file.test.ts',
            context: {
              sourceCode: 'const test = 1;',
              existingTests: '',
              missingScenarios: ['test scenario'],
            dependencies: [],
                frameworkInfo: { 
              language: 'javascript', 
              testFramework: 'jest', 
              moduleType: 'commonjs', 
              hasTypeScript: false 
            },
            },
            estimatedTokens: 100,
            estimatedCost: 0.01,
            priority: 1,
            complexity: 1,
            status: 'pending' as const,
          }],
          totalEstimatedTokens: 100,
          totalEstimatedCost: 0.01,
          maxConcurrency: 1,
        };

        const processPromise = orchestrator.processBatch(batch);
        
        await new Promise(resolve => setImmediate(resolve));
        mockProcess.stderr.emit('data', Buffer.from(`${errorPattern}\n`));
        
        // Process should be killed, emit close event
        await new Promise(resolve => setTimeout(resolve, 100));
        mockProcess.emit('close', 1);
        
        const results = await processPromise;
        expect(results).toHaveLength(1);
        expect(results[0]?.success).toBe(false);
        expect(results[0]?.error).toContain('Authentication');
      }
    });
  });

  describe('Early Network Error Detection', () => {
    it('should terminate immediately on network errors', async () => {
      const mockProcess = createMockProcess();
      jest.spyOn(child_process, 'spawn').mockReturnValue(mockProcess);

      const batch: AITaskBatch = {
        id: 'test-batch',
        tasks: [{
          id: 'task-1',
          prompt: 'Generate tests',
          sourceFile: '/test/file.ts',
          testFile: '/test/file.test.ts',
          context: {
            sourceCode: 'const test = 1;',
            existingTests: '',
            missingScenarios: ['test scenario'],
            dependencies: [],
            frameworkInfo: { 
              language: 'javascript', 
              testFramework: 'jest', 
              moduleType: 'commonjs', 
              hasTypeScript: false 
            },
          },
          estimatedTokens: 100,
          estimatedCost: 0.01,
          priority: 1,
          complexity: 1,
          status: 'pending' as const,
        }],
        totalEstimatedTokens: 100,
        totalEstimatedCost: 0.01,
        maxConcurrency: 1,
      };

      const processPromise = orchestrator.processBatch(batch);
      
      await new Promise(resolve => setImmediate(resolve));
      mockProcess.stderr.emit('data', Buffer.from('Error: connect ECONNREFUSED api.anthropic.com:443\n'));
      
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');
      
      // Emit close event to resolve the process promise
      mockProcess.emit('close', 1);
      
      const results = await processPromise;
      expect(results).toHaveLength(1);
      expect(results[0]?.success).toBe(false);
      expect(results[0]?.error).toContain('Network error detected');
    });

    it('should detect various network error patterns', async () => {
      const networkErrorPatterns = [
        'Connection timeout after 30 seconds',
        'Error: ETIMEDOUT',
        'getaddrinfo ENOTFOUND api.anthropic.com',
        'SSL certificate problem: unable to verify',
        'socket hang up',
      ];

      for (const errorPattern of networkErrorPatterns) {
        const mockProcess = createMockProcess();
        jest.spyOn(child_process, 'spawn').mockReturnValue(mockProcess);
        
        const batch: AITaskBatch = {
          id: `test-batch-${errorPattern}`,
          tasks: [{
            id: 'task-1',
            prompt: 'Generate tests',
            sourceFile: '/test/file.ts',
            testFile: '/test/file.test.ts',
            context: {
              sourceCode: 'const test = 1;',
              existingTests: '',
              missingScenarios: ['test scenario'],
            dependencies: [],
                frameworkInfo: { 
              language: 'javascript', 
              testFramework: 'jest', 
              moduleType: 'commonjs', 
              hasTypeScript: false 
            },
            },
            estimatedTokens: 100,
            estimatedCost: 0.01,
            priority: 1,
            complexity: 1,
            status: 'pending' as const,
          }],
          totalEstimatedTokens: 100,
          totalEstimatedCost: 0.01,
          maxConcurrency: 1,
        };

        const processPromise = orchestrator.processBatch(batch);
        
        await new Promise(resolve => setImmediate(resolve));
        mockProcess.stderr.emit('data', Buffer.from(`${errorPattern}\n`));
        
        // Allow time for error processing
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Emit close event to resolve the process promise
        mockProcess.emit('close', 1);
        
        const results = await processPromise;
      expect(results).toHaveLength(1);
      expect(results[0]?.success).toBe(false);
      expect(results[0]?.error).toContain('Network error detected');
      }
    });
  });

  describe('Early Rate Limit Detection', () => {
    it('should terminate immediately on rate limit errors', async () => {
      const mockProcess = createMockProcess();
      jest.spyOn(child_process, 'spawn').mockReturnValue(mockProcess);

      const batch: AITaskBatch = {
        id: 'test-batch',
        tasks: [{
          id: 'task-1',
          prompt: 'Generate tests',
          sourceFile: '/test/file.ts',
          testFile: '/test/file.test.ts',
          context: {
            sourceCode: 'const test = 1;',
            existingTests: '',
            missingScenarios: ['test scenario'],
            dependencies: [],
            frameworkInfo: { 
              language: 'javascript', 
              testFramework: 'jest', 
              moduleType: 'commonjs', 
              hasTypeScript: false 
            },
          },
          estimatedTokens: 100,
          estimatedCost: 0.01,
          priority: 1,
          complexity: 1,
          status: 'pending' as const,
        }],
        totalEstimatedTokens: 100,
        totalEstimatedCost: 0.01,
        maxConcurrency: 1,
      };

      const processPromise = orchestrator.processBatch(batch);
      
      await new Promise(resolve => setImmediate(resolve));
      mockProcess.stderr.emit('data', Buffer.from('Error: Rate limit exceeded. Please try again later.\n'));
      
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');
      
      // Simulate process termination after being killed
      mockProcess.emit('close', 1);
      
      const results = await processPromise;
      expect(results).toHaveLength(1);
      expect(results[0]?.success).toBe(false);
      expect(results[0]?.error).toContain('Rate limit detected');
    });
  });

  describe('Mixed Output Handling', () => {
    it('should handle mixed progress and error output', async () => {
      const mockProcess = createMockProcess();
      jest.spyOn(child_process, 'spawn').mockReturnValue(mockProcess);

      const batch: AITaskBatch = {
        id: 'test-batch',
        tasks: [{
          id: 'task-1',
          prompt: 'Generate tests',
          sourceFile: '/test/file.ts',
          testFile: '/test/file.test.ts',
          context: {
            sourceCode: 'const test = 1;',
            existingTests: '',
            missingScenarios: ['test scenario'],
            dependencies: [],
            frameworkInfo: { 
              language: 'javascript', 
              testFramework: 'jest', 
              moduleType: 'commonjs', 
              hasTypeScript: false 
            },
          },
          estimatedTokens: 100,
          estimatedCost: 0.01,
          priority: 1,
          complexity: 1,
          status: 'pending' as const,
        }],
        totalEstimatedTokens: 100,
        totalEstimatedCost: 0.01,
        maxConcurrency: 1,
      };

      const processPromise = orchestrator.processBatch(batch);
      
      await new Promise(resolve => setImmediate(resolve));
      
      // Send progress messages first
      mockProcess.stderr.emit('data', Buffer.from('Loading model...\n'));
      mockProcess.stderr.emit('data', Buffer.from('Processing: 25%\n'));
      
      // Then send error
      mockProcess.stderr.emit('data', Buffer.from('Error: Authentication failed\n'));
      
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');
      
      // Emit close event to complete the process
      mockProcess.emit('close', 1);
      
      const results = await processPromise;
      expect(results).toHaveLength(1);
      expect(results[0]?.success).toBe(false);
      expect(results[0]?.error).toContain('Authentication error detected');
    });
  });

  describe('Non-Fatal Error Handling', () => {
    it('should continue on warning-level errors', async () => {
      const mockProcess = createMockProcess();
      jest.spyOn(child_process, 'spawn').mockReturnValue(mockProcess);

      const batch: AITaskBatch = {
        id: 'test-batch',
        tasks: [{
          id: 'task-1',
          prompt: 'Generate tests',
          sourceFile: '/test/file.ts',
          testFile: '/test/file.test.ts',
          context: {
            sourceCode: 'const test = 1;',
            existingTests: '',
            missingScenarios: ['test scenario'],
            dependencies: [],
            frameworkInfo: { 
              language: 'javascript', 
              testFramework: 'jest', 
              moduleType: 'commonjs', 
              hasTypeScript: false 
            },
          },
          estimatedTokens: 100,
          estimatedCost: 0.01,
          priority: 1,
          complexity: 1,
          status: 'pending' as const,
        }],
        totalEstimatedTokens: 100,
        totalEstimatedCost: 0.01,
        maxConcurrency: 1,
      };

      const processPromise = orchestrator.processBatch(batch);
      
      await new Promise(resolve => setImmediate(resolve));
      
      // Send warning-level error
      mockProcess.stderr.emit('data', Buffer.from('Warning: Service temporarily unavailable, retrying...\n'));
      
      // Process should not be killed
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(mockProcess.kill).not.toHaveBeenCalled();
      
      // Complete successfully
      mockProcess.stdout.emit('data', 'describe("test", () => { it("works", () => {}); })');
      mockProcess.emit('close', 0);
      
      const results = await processPromise;
      expect(results).toHaveLength(1);
      expect(results[0]?.success).toBe(true);
    });
  });

  describe('Error Event Emission', () => {
    it('should emit error:detected events', async () => {
      const mockProcess = createMockProcess();
      jest.spyOn(child_process, 'spawn').mockReturnValue(mockProcess);
      
      const detectedErrors: any[] = [];
      orchestrator.on('error:detected', (error) => {
        detectedErrors.push(error);
      });

      const batch: AITaskBatch = {
        id: 'test-batch',
        tasks: [{
          id: 'task-1',
          prompt: 'Generate tests',
          sourceFile: '/test/file.ts',
          testFile: '/test/file.test.ts',
          context: {
            sourceCode: 'const test = 1;',
            existingTests: '',
            missingScenarios: ['test scenario'],
            dependencies: [],
            frameworkInfo: { 
              language: 'javascript', 
              testFramework: 'jest', 
              moduleType: 'commonjs', 
              hasTypeScript: false 
            },
          },
          estimatedTokens: 100,
          estimatedCost: 0.01,
          priority: 1,
          complexity: 1,
          status: 'pending' as const,
        }],
        totalEstimatedTokens: 100,
        totalEstimatedCost: 0.01,
        maxConcurrency: 1,
      };

      const processPromise = orchestrator.processBatch(batch);
      
      await new Promise(resolve => setImmediate(resolve));
      mockProcess.stderr.emit('data', Buffer.from('Error: Authentication failed\n'));
      
      // Allow process to be killed and emit close event
      await new Promise(resolve => setTimeout(resolve, 100));
      mockProcess.emit('close', 1);
      
      await processPromise.catch(() => {}); // Ignore error
      
      expect(detectedErrors).toHaveLength(1);
      expect(detectedErrors[0].type).toBe('auth');
      expect(detectedErrors[0].severity).toBe('fatal');
    });
  });
});