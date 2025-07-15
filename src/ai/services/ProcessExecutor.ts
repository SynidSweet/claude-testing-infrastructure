/**
 * Process Executor Service
 *
 * Handles Claude CLI process execution:
 * - Process spawning and lifecycle management
 * - Stdout/stderr handling and parsing
 * - Timeout management and progress tracking
 * - Error detection and recovery
 * - Checkpoint integration
 */

import { spawn, type ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import type { AITask } from '../AITaskPreparation';
import type { TaskCheckpointManager } from '../../state/TaskCheckpointManager';
import type { ProcessPoolManager } from './ProcessPoolManager';
import type { TestableTimer, TimerHandle } from '../../types/timer-types';
import {
  AIAuthenticationError,
  AITimeoutError,
  AIRateLimitError,
  AINetworkError,
  AIResponseParseError,
  AICheckpointError,
  type AIProgressUpdate,
} from '../../types/ai-error-types';
import { logger } from '../../utils/logger';
import { createStderrParser, type ParsedError } from '../../utils/stderr-parser';

/**
 * Task execution result from subprocess
 */
export interface SubprocessResult {
  output: string;
  tokensUsed?: number;
  cost?: number;
}

/**
 * Claude CLI response structure
 */
interface ClaudeAPIResponse {
  result?: string;
  output?: string;
  content?: string;
  usage?: { total_tokens?: number };
  tokens_used?: number;
  total_cost_usd?: number;
  cost?: number;
}

/**
 * Checkpoint update data
 */
interface CheckpointUpdateData {
  phase?: 'preparing' | 'generating' | 'processing' | 'finalizing';
  progress?: number;
  partialResult?: {
    generatedContent: string;
    tokensUsed: number;
    estimatedCost: number;
  };
  state?: {
    outputBytes: number;
    elapsedTime: number;
  };
}

/**
 * Configuration for ProcessExecutor
 */
export interface ProcessExecutorConfig {
  model: string;
  fallbackModel?: string;
  timeout?: number;
  verbose?: boolean;
}

/**
 * ProcessExecutor handles the low-level execution of Claude CLI processes
 * with integrated timeout management, error detection, and checkpoint support
 */
export class ProcessExecutor extends EventEmitter {
  constructor(
    private config: ProcessExecutorConfig,
    private processPoolManager: ProcessPoolManager,
    private timerService: TestableTimer,
    private checkpointManager?: TaskCheckpointManager
  ) {
    super();
  }

  /**
   * Execute Claude process for a task
   */
  async executeClaudeProcess(
    task: AITask,
    shouldResume: boolean = false,
    checkpointId?: string
  ): Promise<SubprocessResult> {
    return new Promise((resolve, reject) => {
      const executeTask = async (): Promise<void> => {
        let promptToUse = task.prompt;
        let estimatedTokens = task.estimatedTokens;

        // Handle resume from checkpoint
        if (shouldResume && checkpointId && this.checkpointManager) {
          try {
            const resumeInfo = await this.checkpointManager.resumeFromCheckpoint(checkpointId);
            promptToUse = resumeInfo.resumePrompt;
            estimatedTokens = resumeInfo.estimatedRemainingTokens;

            // Update progress to show resuming
            this.emit('progress', {
              taskId: task.id,
              phase: 'generating',
              progress: resumeInfo.checkpoint.progress,
              message: `Resuming generation from ${resumeInfo.checkpoint.progress}%...`,
              estimatedTimeRemaining: estimatedTokens * 10,
            } as AIProgressUpdate);

            logger.info(
              `Resuming task ${task.id} with ${estimatedTokens} estimated remaining tokens`
            );
          } catch (error: unknown) {
            const checkpointError = new AICheckpointError(
              `Failed to resume from checkpoint ${checkpointId}, starting fresh`,
              checkpointId,
              {
                taskId: task.id,
                error: error instanceof Error ? error.message : String(error),
              }
            );
            logger.warn(checkpointError.message, checkpointError.context);
            // Continue with original prompt if resume fails
          }
        }

        const args = [promptToUse, '--model', this.config.model];

        // Add fallback model if configured (helps with Max subscription limits)
        if (this.config.fallbackModel) {
          args.push('--fallback-model', this.config.fallbackModel);
        }

        if (this.config.verbose) {
          logger.info(`Executing Claude for task ${task.id} with model ${this.config.model}...`);
        }

        // Emit progress update for generation start
        this.emit('progress', {
          taskId: task.id,
          phase: 'generating',
          progress: 10,
          message: `Generating tests with ${this.config.model} model...`,
          estimatedTimeRemaining: task.estimatedTokens * 10,
        } as AIProgressUpdate);

        // Set up environment with extended timeouts for headless AI generation
        const claudeEnv = {
          ...process.env,
          // Only affect this specific headless Claude process, not interactive sessions
          BASH_DEFAULT_TIMEOUT_MS: String(this.config.timeout),
          BASH_MAX_TIMEOUT_MS: String(this.config.timeout),
        };

        let stdout = '';
        let stderr = '';
        let timeout: TimerHandle | undefined;
        let killed = false;
        let claude: ChildProcess | undefined;

        // Set up early error detection handler BEFORE spawning process
        const errorHandler = (parsedError: ParsedError): void => {
          if (parsedError.severity === 'fatal' && !killed) {
            logger.error(`Early fatal error detected for task ${task.id}: ${parsedError.type}`);

            // Kill the process immediately on fatal errors
            killed = true;
            if (timeout) timeout.cancel();
            this.processPoolManager.unregisterProcess(task.id);

            // Kill the process if it exists
            if (claude) {
              claude.kill('SIGTERM');
              this.timerService.schedule(() => {
                if (claude && !claude.killed) {
                  claude.kill('SIGKILL');
                }
              }, 1000);
            }

            // Reject with the specific error
            reject(parsedError.error);
          }
        };

        // Listen for early error detection BEFORE spawning
        this.on('error:detected', errorHandler);

        claude = spawn('claude', args, {
          env: claudeEnv,
          shell: false,
        });

        // Create stderr parser for early error detection
        const stderrParser = createStderrParser(this);

        // Set up timeout with more descriptive error
        if (this.config.timeout) {
          const timeoutMs = this.config.timeout;

          // Set main timeout
          timeout = this.timerService.schedule(() => {
            if (!killed) {
              killed = true;
              // Stop process monitoring before killing
              this.processPoolManager.unregisterProcess(task.id);

              // Try SIGTERM first, then SIGKILL after 5 seconds
              claude.kill('SIGTERM');
              this.timerService.schedule(() => {
                if (claude.killed === false) {
                  claude.kill('SIGKILL');
                }
              }, 5000);

              reject(
                new AITimeoutError(
                  `AI generation timed out after ${timeoutMs / 1000} seconds. ` +
                    `This may indicate: 1) Complex task requiring more time, 2) Claude CLI hanging, ` +
                    `3) Network connectivity issues. Try: reducing batch size, checking Claude Code setup, ` +
                    `or increasing timeout with --timeout flag.`,
                  timeoutMs
                )
              );
            }
          }, timeoutMs);

          // Set progress timeout (if no output for 30 seconds, consider it stuck)
          this.timerService.schedule(() => {
            if (!stdout && !killed) {
              logger.warn(`No output from Claude CLI after 30 seconds for task ${task.id}`);
              this.emit('progress', {
                taskId: task.id,
                phase: 'generating',
                progress: 25,
                message: 'Waiting for Claude CLI response (may be processing)...',
              } as AIProgressUpdate);
            }
          }, 30000);
        }

        // Register process with pool manager for monitoring
        this.processPoolManager.registerProcess(task.id, claude);

        // Set up timeout progress tracking if timeout is configured
        if (this.config.timeout) {
          this.setupTimeoutProgressTracking(
            task.id,
            this.config.timeout,
            () => stdout.length,
            () => stderr.length
          );
        }

        claude.stdout?.on('data', (data: Buffer) => {
          const dataStr = data.toString();
          const bytes = data.length;
          stdout += dataStr;

          // Update heartbeat activity with data content
          this.processPoolManager.updateProcessActivity(task.id, bytes, dataStr);

          // Update checkpoint with partial progress
          if (checkpointId && this.checkpointManager) {
            const progress = Math.min(50 + (stdout.length / estimatedTokens) * 40, 90); // Scale 50-90%
            const updateData: CheckpointUpdateData = {
              phase: 'generating',
              progress,
              partialResult: {
                generatedContent: stdout,
                tokensUsed: Math.floor(stdout.length / 4), // Rough token estimate
                estimatedCost: task.estimatedCost * (progress / 100),
              },
              state: {
                outputBytes: stdout.length,
                elapsedTime:
                  Date.now() -
                  (this.processPoolManager
                    .getProcessInfo(task.id)
                    ?.heartbeat.startTime?.getTime() ?? Date.now()),
              },
            };
            void this.checkpointManager.updateCheckpoint(checkpointId, updateData);
          }

          // Emit progress update - we're getting data
          this.emit('progress', {
            taskId: task.id,
            phase: 'generating',
            progress: 50,
            message: 'Receiving generated tests from Claude...',
          } as AIProgressUpdate);
        });

        claude.stderr?.on('data', (data: Buffer) => {
          const dataStr = data.toString();
          const bytes = data.length;
          stderr += dataStr;

          // Parse stderr in real-time for early error detection
          const parsedError = stderrParser.parseChunk(dataStr);
          if (parsedError && parsedError.severity === 'fatal' && !killed) {
            // Early error detection will trigger the error handler
            logger.debug(`Parsed fatal error from stderr: ${parsedError.type}`);
            // Emit the error:detected event
            this.emit('error:detected', parsedError);
          }

          // Update heartbeat activity with data content
          this.processPoolManager.updateProcessActivity(task.id, bytes, dataStr);
        });

        claude.on('error', (error) => {
          if (!killed) {
            if (timeout) timeout.cancel();
            this.processPoolManager.unregisterProcess(task.id);

            // Provide more helpful error messages
            if (error.message.includes('ENOENT')) {
              reject(
                new AIAuthenticationError(
                  'Claude CLI not found. Please ensure Claude Code is installed and available in PATH. ' +
                    'Visit https://docs.anthropic.com/claude-code for installation instructions.'
                )
              );
            } else {
              reject(new Error(`Failed to spawn Claude process: ${error.message}`));
            }
          }
        });

        claude.on('close', (code) => {
          // Clean up error handler
          this.removeListener('error:detected', errorHandler);

          if (!killed) {
            if (timeout) timeout.cancel();
            this.processPoolManager.unregisterProcess(task.id);

            // Parse any remaining stderr
            stderrParser.parseRemaining();

            if (code !== 0) {
              // Check if parser found any errors
              const fatalError = stderrParser.getFirstFatalError();
              if (fatalError) {
                reject(fatalError.error);
                return;
              }

              // Fallback to pattern matching for backwards compatibility
              if (stderr.includes('authentication') || stderr.includes('login')) {
                reject(
                  new AIAuthenticationError(
                    'Claude CLI authentication required. Please run Claude Code interactively first to authenticate. ' +
                      'Use: claude auth login'
                  )
                );
              } else if (stderr.includes('rate limit') || stderr.includes('quota')) {
                reject(
                  new AIRateLimitError(
                    'Claude API rate limit or quota exceeded. Please try again later or use a different model. ' +
                      'Consider using --model haiku for lower-cost generation.'
                  )
                );
              } else if (stderr.includes('network') || stderr.includes('connection')) {
                reject(
                  new AINetworkError(
                    'Network connection error while communicating with Claude API. ' +
                      'Please check your internet connection and try again.'
                  )
                );
              } else {
                reject(
                  new Error(`Claude process exited with code ${code}${stderr ? `: ${stderr}` : ''}`)
                );
              }
              return;
            }

            try {
              // Handle both text and JSON responses
              if (stdout.trim().startsWith('{')) {
                const result = JSON.parse(stdout) as ClaudeAPIResponse;
                const resolveData: SubprocessResult = {
                  output: result.result ?? result.output ?? result.content ?? stdout,
                };

                if (result.usage?.total_tokens !== undefined || result.tokens_used !== undefined) {
                  resolveData.tokensUsed = result.usage?.total_tokens ?? result.tokens_used!;
                }

                if (result.total_cost_usd !== undefined || result.cost !== undefined) {
                  resolveData.cost = result.total_cost_usd ?? result.cost!;
                }

                resolve(resolveData);
              } else {
                resolve({
                  output: stdout.trim() || 'No output generated',
                  tokensUsed: task.estimatedTokens, // Fallback estimation
                  cost: task.estimatedCost, // Fallback estimation
                });
              }
            } catch (parseError: unknown) {
              // If JSON parsing fails, log the error and return text output
              const error = new AIResponseParseError(
                'Failed to parse JSON response from Claude CLI',
                stdout,
                {
                  taskId: task.id,
                  parseError: parseError instanceof Error ? parseError.message : String(parseError),
                }
              );
              logger.warn('JSON parsing failed, using raw output', error.context);

              resolve({
                output: stdout.trim() || 'Generated test content',
                tokensUsed: task.estimatedTokens,
                cost: task.estimatedCost,
              });
            }
          }
        });
      };

      void executeTask();
    });
  }

  /**
   * Set up timeout progress tracking
   */
  private setupTimeoutProgressTracking(
    taskId: string,
    timeoutMs: number,
    getStdoutLength: () => number,
    getStderrLength: () => number
  ): void {
    const processInfo = this.processPoolManager.getProcessInfo(taskId);
    if (!processInfo) return;

    const progressCheckInterval = Math.min(timeoutMs / 10, 10000); // Check every 10% or 10s, whichever is smaller

    const timerHandle = this.timerService.scheduleInterval(() => {
      const currentTime = this.timerService.getCurrentTime();
      const elapsed = currentTime - (processInfo.heartbeat.startTime?.getTime() ?? currentTime);
      const progress = Math.floor((elapsed / timeoutMs) * 100);

      // Check warning thresholds
      for (const threshold of processInfo.heartbeat.warningThresholds ?? []) {
        if (progress >= threshold && processInfo.heartbeat.warningThresholds?.has(threshold)) {
          processInfo.heartbeat.warningThresholds.delete(threshold); // Only emit once per threshold

          // Capture current state
          const stateInfo = {
            taskId,
            threshold,
            progress,
            elapsed: elapsed / 1000,
            timeoutSeconds: timeoutMs / 1000,
            bytesReceived: processInfo.heartbeat.stdoutBytes + processInfo.heartbeat.stderrBytes,
            lastActivity: processInfo.heartbeat.lastActivity,
            stdout: getStdoutLength(),
            stderr: getStderrLength(),
            resourceUsage: undefined, // Resource usage will be captured separately by ProcessPoolManager
          };

          // Emit timeout warning event
          this.emit('timeout:warning', stateInfo);

          // Log detailed state information
          logger.warn(
            `Timeout warning for task ${taskId}: ${threshold}% of timeout reached`,
            stateInfo
          );

          // Update progress event with warning
          this.emit('progress', {
            taskId,
            phase: 'generating',
            progress: Math.min(90, 10 + progress * 0.8), // Scale progress from 10-90%
            message: `⚠️ Generation at ${threshold}% of timeout (${Math.floor(elapsed / 1000)}s / ${Math.floor(timeoutMs / 1000)}s)`,
            warning: true,
            estimatedTimeRemaining: timeoutMs - elapsed,
          } as AIProgressUpdate);
        }
      }
    }, progressCheckInterval);

    processInfo.heartbeat.timeoutProgress = timerHandle;
  }
}
