/**
 * Degraded Mode Handler Service
 *
 * Handles graceful degradation when Claude CLI is not available:
 * - Placeholder test generation
 * - Language-specific template creation
 * - Progress simulation for consistency
 */

import * as path from 'path';
import type { AITask } from '../AITaskPreparation';
import type { ProcessResult } from './ResultAggregator';
import { logger } from '../../utils/logger';

/**
 * Service responsible for handling tasks when Claude CLI is not available
 * by generating placeholder tests that maintain the expected workflow
 */
export class DegradedModeHandler {
  constructor() {}

  /**
   * Handle task in degraded mode (no Claude CLI available)
   */
  async handleDegradedTask(
    task: AITask,
    startTime: number,
    checkpointId?: string,
    checkpointManager?: any
  ): Promise<ProcessResult> {
    logger.info(`Processing task ${task.id} in degraded mode`);

    // Generate placeholder tests based on task context
    const placeholderTests = this.generatePlaceholderTests(task);

    const processResult: ProcessResult = {
      taskId: task.id,
      success: true,
      result: {
        generatedTests: placeholderTests,
        tokensUsed: 0, // No AI tokens used
        actualCost: 0, // No cost in degraded mode
        duration: Date.now() - startTime,
      },
    };

    // Complete checkpoint if enabled (even for degraded mode)
    if (checkpointId && checkpointManager) {
      await checkpointManager.completeCheckpoint(checkpointId, processResult.result!);
    }

    return processResult;
  }

  /**
   * Generate placeholder tests for degraded mode
   */
  private generatePlaceholderTests(task: AITask): string {
    const { language } = task.context.frameworkInfo;
    const sourceFile = path.basename(task.sourceFile);

    if (language === 'javascript' || language === 'typescript') {
      return `// AI-Generated Placeholder Tests (Degraded Mode)
// Install Claude Code and authenticate to enable AI-powered test generation

describe('${sourceFile}', () => {
  test.todo('should be tested properly');
  
  // TODO: The following scenarios should be tested:
  ${task.context.missingScenarios.map((scenario) => `  // - ${scenario}`).join('\n')}
});

// Note: These are placeholder tests. Install Claude Code for intelligent test generation.
`;
    } else if (language === 'python') {
      return `# AI-Generated Placeholder Tests (Degraded Mode)
# Install Claude Code and authenticate to enable AI-powered test generation

import pytest

class Test${sourceFile.replace('.py', '').replace(/[^a-zA-Z0-9]/g, '')}:
    def test_placeholder(self):
        """TODO: Implement proper tests"""
        pytest.skip("Placeholder test - Claude Code required for AI generation")
    
    # TODO: The following scenarios should be tested:
${task.context.missingScenarios.map((scenario) => `    # - ${scenario}`).join('\n')}

# Note: These are placeholder tests. Install Claude Code for intelligent test generation.
`;
    }

    return `// Placeholder tests for ${sourceFile} - Claude Code required for AI generation`;
  }
}
