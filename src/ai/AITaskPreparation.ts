/**
 * AI Task Preparation System
 *
 * Prepares test generation tasks for AI processing, including:
 * - Task queue management
 * - Context extraction
 * - Prompt preparation
 * - Batch optimization
 * - Cost estimation
 */

import type { TestGap, TestGapAnalysisResult } from '../analyzers/TestGapAnalyzer';
import { getModelPricing, resolveModelName } from '../utils/model-mapping';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface AITask {
  id: string;
  sourceFile: string;
  testFile: string;
  priority: number;
  complexity: number;
  prompt: string;
  context: TaskContext;
  estimatedTokens: number;
  estimatedCost: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  result?: AITaskResult;
}

export interface TaskContext {
  sourceCode: string;
  existingTests: string;
  dependencies: string[];
  businessDomain?: string;
  criticalPaths?: string[];
  missingScenarios: string[];
  frameworkInfo: FrameworkInfo;
}

export interface FrameworkInfo {
  language: 'javascript' | 'typescript' | 'python';
  testFramework: 'jest' | 'vitest' | 'pytest' | 'unittest';
  moduleType: 'commonjs' | 'esm' | 'python';
  hasTypeScript: boolean;
}

export interface AITaskResult {
  generatedTests: string;
  tokensUsed: number;
  actualCost: number;
  duration: number;
  error?: string;
}

export interface AITaskBatch {
  id: string;
  tasks: AITask[];
  totalEstimatedTokens: number;
  totalEstimatedCost: number;
  maxConcurrency: number;
}

export class AITaskPreparation {
  private readonly DEFAULT_MODEL = 'sonnet';
  private taskIdCounter = 0;

  constructor(
    private config: {
      model?: string;
      maxConcurrentTasks?: number;
      minComplexityForAI?: number;
    } = {}
  ) {
    this.config = {
      model: this.DEFAULT_MODEL,
      maxConcurrentTasks: 3,
      minComplexityForAI: 5,
      ...config,
    };
  }

  /**
   * Prepare AI tasks from gap analysis report
   */
  async prepareTasks(gapReport: TestGapAnalysisResult): Promise<AITaskBatch> {
    const tasks: AITask[] = [];

    // Filter gaps based on complexity threshold
    const eligibleGaps = gapReport.gaps.filter(
      (gap) => gap.complexity.overall >= (this.config.minComplexityForAI || 5)
    );

    // Create tasks for each eligible gap
    for (const gap of eligibleGaps) {
      const task = await this.createTask(gap);
      if (task) {
        tasks.push(task);
      }
    }

    // Sort by priority (highest first)
    tasks.sort((a, b) => b.priority - a.priority);

    // Create batch
    const batch: AITaskBatch = {
      id: `batch-${Date.now()}`,
      tasks,
      totalEstimatedTokens: tasks.reduce((sum, t) => sum + t.estimatedTokens, 0),
      totalEstimatedCost: tasks.reduce((sum, t) => sum + t.estimatedCost, 0),
      maxConcurrency: this.config.maxConcurrentTasks || 3,
    };

    return batch;
  }

  /**
   * Create an AI task from a test gap
   */
  private async createTask(gap: TestGap): Promise<AITask | null> {
    try {
      // Extract context
      const context = await this.extractContext(gap);

      // Build prompt
      const prompt = this.buildPrompt(gap, context);

      // Estimate tokens and cost
      const estimatedTokens = this.estimateTokens(prompt, context);
      const estimatedCost = this.estimateCost(estimatedTokens);

      const task: AITask = {
        id: `task-${++this.taskIdCounter}`,
        sourceFile: gap.sourceFile,
        testFile: gap.testFile,
        priority: this.mapPriorityToNumber(gap.priority),
        complexity: gap.complexity.overall,
        prompt,
        context,
        estimatedTokens,
        estimatedCost,
        status: 'pending',
      };

      return task;
    } catch (error) {
      console.error(`Failed to create task for ${gap.sourceFile}:`, error);
      return null;
    }
  }

  /**
   * Extract context for AI task
   */
  private async extractContext(gap: TestGap): Promise<TaskContext> {
    // Read source code
    const sourceCode = await fs.readFile(gap.sourceFile, 'utf-8');

    // Read existing tests if available
    let existingTests = '';
    try {
      existingTests = await fs.readFile(gap.testFile, 'utf-8');
    } catch (error) {
      // No existing tests yet
    }

    // Determine framework info
    const frameworkInfo = this.detectFrameworkInfo(gap.sourceFile, sourceCode);

    // Extract business domain and critical paths from gap context
    const businessDomain = this.extractBusinessDomain(gap);
    const criticalPaths: string[] = [];

    return {
      sourceCode,
      existingTests,
      dependencies: gap.context.dependencies || [],
      businessDomain,
      criticalPaths,
      missingScenarios: this.extractMissingScenarios(gap),
      frameworkInfo,
    };
  }

  /**
   * Detect framework information from file and content
   */
  private detectFrameworkInfo(filePath: string, content: string): FrameworkInfo {
    const ext = path.extname(filePath).toLowerCase();

    if (ext === '.py') {
      return {
        language: 'python',
        testFramework: content.includes('pytest') ? 'pytest' : 'unittest',
        moduleType: 'python',
        hasTypeScript: false,
      };
    }

    const isTypeScript = ext === '.ts' || ext === '.tsx';
    const hasVitest = content.includes('vitest') || content.includes('vi.');
    const isESM = content.includes('export') || content.includes('import');

    return {
      language: isTypeScript ? 'typescript' : 'javascript',
      testFramework: hasVitest ? 'vitest' : 'jest',
      moduleType: isESM ? 'esm' : 'commonjs',
      hasTypeScript: isTypeScript,
    };
  }

  /**
   * Build prompt for AI test generation
   */
  private buildPrompt(gap: TestGap, context: TaskContext): string {
    const { frameworkInfo } = context;

    const prompt = `You are an expert test engineer tasked with writing comprehensive logical/business tests to complement existing structural tests.

**CONTEXT**
- Language: ${frameworkInfo.language}
- Test Framework: ${frameworkInfo.testFramework}
- Module Type: ${frameworkInfo.moduleType}
- Business Domain: ${context.businessDomain}
- Critical Paths: ${context.criticalPaths?.join(', ') || 'None'}

**SOURCE FILE**: ${gap.sourceFile}
\`\`\`${frameworkInfo.language}
${context.sourceCode}
\`\`\`

${
  context.existingTests
    ? `**EXISTING TESTS**: ${gap.testFile}
\`\`\`${frameworkInfo.language}
${context.existingTests}
\`\`\``
    : '**EXISTING TESTS**: None yet'
}

**IDENTIFIED GAPS**:
${context.missingScenarios.map((s) => `- ${s}`).join('\n')}

**REQUIREMENTS**:
1. Write tests that verify business logic correctness
2. Focus on the identified gap scenarios
3. Include edge cases specific to the business domain
4. Test error handling and boundary conditions
5. Ensure tests are independent and can run in isolation
6. Use ${frameworkInfo.testFramework} testing framework conventions
7. Follow the same patterns as existing tests (if any)
8. Include appropriate setup/teardown if needed
9. Add descriptive test names that explain the scenario

**OUTPUT INSTRUCTIONS**:
- Output ONLY the test code, no explanations or markdown
- The code should be complete and ready to save to a file
- Include all necessary imports at the top
- Use the same module system as the source file (${frameworkInfo.moduleType})

Generate comprehensive logical tests that thoroughly validate the business logic:`;

    return prompt;
  }

  /**
   * Estimate tokens for a task
   */
  private estimateTokens(prompt: string, context: TaskContext): number {
    // Rough estimation: 1 token ≈ 4 characters
    const promptTokens = Math.ceil(prompt.length / 4);

    // Estimate output based on complexity and scenarios
    const scenarioCount = context.missingScenarios.length;
    const outputTokens = Math.ceil(
      scenarioCount * 150 + // Base tokens per scenario
        context.sourceCode.length / 8 // Proportional to source complexity
    );

    return promptTokens + outputTokens;
  }

  /**
   * Estimate cost for tokens
   */
  private estimateCost(tokens: number): number {
    const model = this.config.model || this.DEFAULT_MODEL;

    // Resolve model name to full identifier
    const resolvedModelName = resolveModelName(model);
    if (!resolvedModelName) {
      console.warn(`Unknown model: ${model}, using default costs`);
      return (tokens * 0.01) / 1000; // Default fallback
    }

    // Get pricing from model mapping
    const pricing = getModelPricing(resolvedModelName);
    if (!pricing) {
      console.warn(`No pricing found for model: ${model}, using default costs`);
      return (tokens * 0.01) / 1000; // Default fallback
    }

    // Assume 70% input, 30% output for estimation
    const inputTokens = Math.ceil(tokens * 0.7);
    const outputTokens = Math.ceil(tokens * 0.3);

    const inputCost = (inputTokens / 1000) * pricing.inputCostPer1K;
    const outputCost = (outputTokens / 1000) * pricing.outputCostPer1K;

    return inputCost + outputCost;
  }

  /**
   * Optimize batch for efficient processing
   */
  optimizeBatch(batch: AITaskBatch, maxBudget?: number): AITaskBatch {
    let optimizedTasks = [...batch.tasks];

    // If budget constraint, select highest priority tasks within budget
    if (maxBudget && batch.totalEstimatedCost > maxBudget) {
      optimizedTasks = [];
      let currentCost = 0;

      for (const task of batch.tasks) {
        if (currentCost + task.estimatedCost <= maxBudget) {
          optimizedTasks.push(task);
          currentCost += task.estimatedCost;
        }
      }
    }

    // Group by similar complexity for better batching
    optimizedTasks.sort((a, b) => {
      // First by priority, then by complexity
      if (Math.abs(a.priority - b.priority) > 2) {
        return b.priority - a.priority;
      }
      return a.complexity - b.complexity;
    });

    return {
      ...batch,
      tasks: optimizedTasks,
      totalEstimatedTokens: optimizedTasks.reduce((sum, t) => sum + t.estimatedTokens, 0),
      totalEstimatedCost: optimizedTasks.reduce((sum, t) => sum + t.estimatedCost, 0),
    };
  }

  /**
   * Save batch to disk for persistence
   */
  async saveBatch(batch: AITaskBatch, outputPath: string): Promise<void> {
    const batchData = {
      ...batch,
      tasks: batch.tasks.map((t) => ({
        ...t,
        context: {
          ...t.context,
          // Don't save full source code to reduce file size
          sourceCode: `[${t.context.sourceCode.length} characters]`,
          existingTests: `[${t.context.existingTests.length} characters]`,
        },
      })),
    };

    await fs.writeFile(outputPath, JSON.stringify(batchData, null, 2), 'utf-8');
  }

  /**
   * Generate summary report
   */
  generateSummary(batch: AITaskBatch): string {
    const summary = [
      '# AI Task Preparation Summary',
      '',
      `## Batch: ${batch.id}`,
      `- Total Tasks: ${batch.tasks.length}`,
      `- Estimated Tokens: ${batch.totalEstimatedTokens.toLocaleString()}`,
      `- Estimated Cost: $${batch.totalEstimatedCost.toFixed(2)}`,
      `- Max Concurrency: ${batch.maxConcurrency}`,
      '',
      '## Tasks by Priority:',
      '',
    ];

    const byPriority = batch.tasks.reduce(
      (acc, task) => {
        const priority = Math.floor(task.priority);
        if (!acc[priority]) acc[priority] = [];
        acc[priority].push(task);
        return acc;
      },
      {} as Record<number, AITask[]>
    );

    Object.keys(byPriority)
      .sort((a, b) => Number(b) - Number(a))
      .forEach((priority) => {
        const tasks = byPriority[Number(priority)];
        if (tasks) {
          summary.push(`### Priority ${priority} (${tasks.length} tasks)`);
          tasks.forEach((task) => {
            summary.push(
              `- ${path.basename(task.sourceFile)} - ${task.estimatedTokens} tokens, $${task.estimatedCost.toFixed(3)}`
            );
          });
          summary.push('');
        }
      });

    return summary.join('\n');
  }

  /**
   * Map priority enum to number
   */
  private mapPriorityToNumber(priority: string | number): number {
    const priorityMap: Record<string, number> = {
      critical: 10,
      high: 8,
      medium: 5,
      low: 3,
    };
    return priorityMap[priority] || 5;
  }

  /**
   * Extract business domain from gap
   */
  private extractBusinessDomain(gap: TestGap): string {
    // Try to infer from file type
    switch (gap.context.fileType) {
      case 'api':
        return 'api-endpoints';
      case 'component':
        return 'ui-components';
      case 'service':
        return 'business-services';
      case 'model':
        return 'data-models';
      default:
        return 'general';
    }
  }

  /**
   * Extract missing scenarios from gap
   */
  private extractMissingScenarios(gap: TestGap): string[] {
    const scenarios: string[] = [];

    // Extract from coverage analysis
    if (gap.currentCoverage.businessLogicGaps.length > 0) {
      scenarios.push(...gap.currentCoverage.businessLogicGaps);
    }

    if (gap.currentCoverage.edgeCaseGaps.length > 0) {
      scenarios.push(...gap.currentCoverage.edgeCaseGaps);
    }

    if (gap.currentCoverage.integrationGaps.length > 0) {
      scenarios.push(...gap.currentCoverage.integrationGaps);
    }

    // Extract from identified gaps
    gap.gaps.forEach((g) => {
      scenarios.push(g.description);
    });

    return scenarios;
  }
}
