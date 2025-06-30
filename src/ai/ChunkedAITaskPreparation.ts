/**
 * Chunked AI Task Preparation System
 * 
 * Enhanced version of AITaskPreparation that supports intelligent file chunking
 * for large files that exceed token limits.
 */

import { TestGap, TestGapAnalysisResult } from '../analyzers/TestGapAnalyzer';
import { AITask, TaskContext, FrameworkInfo, AITaskBatch } from './AITaskPreparation';
import { AITaskPreparation } from './AITaskPreparation';
import { FileChunker, FileChunk } from '../utils/file-chunking';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface ChunkedAITask extends AITask {
  isChunked: boolean;
  chunkInfo?: {
    chunkIndex: number;
    totalChunks: number;
    fileContext?: string;
  };
  relatedTasks?: string[]; // IDs of other chunks from same file
}

export interface ChunkProcessingProgress {
  file: string;
  totalChunks: number;
  processedChunks: number;
  currentChunk: number;
  estimatedTokensSaved: number;
}

export class ChunkedAITaskPreparation {
  private static readonly TOKEN_LIMIT = 4000; // Conservative limit for safety
  private chunkProgress = new Map<string, ChunkProcessingProgress>();
  private basePreparation: AITaskPreparation;
  private chunkedConfig: {
    enableChunking: boolean;
    chunkTokenLimit: number;
  };
  private taskIdCounter = 0;

  constructor(config: {
    model?: string;
    maxConcurrentTasks?: number;
    minComplexityForAI?: number;
    enableChunking?: boolean;
    chunkTokenLimit?: number;
  } = {}) {
    // Create base preparation with original config
    const baseConfig: {
      model?: string;
      maxConcurrentTasks?: number;
      minComplexityForAI?: number;
    } = {};
    
    if (config.model !== undefined) baseConfig.model = config.model;
    if (config.maxConcurrentTasks !== undefined) baseConfig.maxConcurrentTasks = config.maxConcurrentTasks;
    if (config.minComplexityForAI !== undefined) baseConfig.minComplexityForAI = config.minComplexityForAI;
    
    this.basePreparation = new AITaskPreparation(baseConfig);
    
    this.chunkedConfig = {
      enableChunking: config.enableChunking ?? true,
      chunkTokenLimit: config.chunkTokenLimit ?? ChunkedAITaskPreparation.TOKEN_LIMIT
    };
  }

  /**
   * Prepare AI tasks with intelligent chunking for large files
   */
  async prepareTasks(gapReport: TestGapAnalysisResult): Promise<AITaskBatch> {
    const tasks: ChunkedAITask[] = [];

    // Filter gaps based on complexity threshold
    const eligibleGaps = gapReport.gaps.filter(
      gap => gap.complexity.overall >= 5 // Use default threshold
    );

    // Create tasks for each eligible gap
    for (const gap of eligibleGaps) {
      const fileTasks = await this.createTasksForGap(gap);
      if (fileTasks.length > 0) {
        tasks.push(...fileTasks);
      }
    }

    // Sort by priority (highest first) and group chunks together
    tasks.sort((a, b) => {
      // First by priority
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      // Then keep chunks from same file together
      if (a.sourceFile === b.sourceFile && a.chunkInfo && b.chunkInfo) {
        return a.chunkInfo.chunkIndex - b.chunkInfo.chunkIndex;
      }
      return 0;
    });

    // Create batch
    const batch: AITaskBatch = {
      id: `batch-${Date.now()}`,
      tasks: tasks as AITask[],
      totalEstimatedTokens: tasks.reduce((sum, t) => sum + t.estimatedTokens, 0),
      totalEstimatedCost: tasks.reduce((sum, t) => sum + t.estimatedCost, 0),
      maxConcurrency: 3
    };

    return batch;
  }

  /**
   * Create tasks for a gap, potentially creating multiple tasks for chunked files
   */
  private async createTasksForGap(gap: TestGap): Promise<ChunkedAITask[]> {
    try {
      // Read source code
      const sourceCode = await fs.readFile(gap.sourceFile, 'utf-8');
      
      // Check if file needs chunking
      const estimatedTokens = FileChunker.countTokens(sourceCode);
      
      if (!this.chunkedConfig.enableChunking || estimatedTokens <= this.chunkedConfig.chunkTokenLimit) {
        // File is small enough, create single task
        const task = await this.createSingleTask(gap, sourceCode);
        return task ? [task] : [];
      }

      // File needs chunking
      console.log(`File ${gap.sourceFile} has ~${estimatedTokens} tokens, chunking required`);
      return await this.createChunkedTasks(gap, sourceCode);
      
    } catch (error) {
      console.error(`Failed to create tasks for ${gap.sourceFile}:`, error);
      return [];
    }
  }

  /**
   * Create a single task (no chunking needed)
   */
  private async createSingleTask(
    gap: TestGap,
    _sourceCode: string
  ): Promise<ChunkedAITask | null> {
    // Use the base preparation to create a single task
    const batch = await this.basePreparation.prepareTasks({ gaps: [gap] } as TestGapAnalysisResult);
    if (batch.tasks.length === 0) return null;

    const baseTask = batch.tasks[0];
    return {
      ...baseTask,
      isChunked: false
    } as ChunkedAITask;
  }

  /**
   * Create multiple tasks for a chunked file
   */
  private async createChunkedTasks(
    gap: TestGap,
    sourceCode: string
  ): Promise<ChunkedAITask[]> {
    const tasks: ChunkedAITask[] = [];
    
    // Detect language for better chunking
    const frameworkInfo = this.detectFrameworkInfo(gap.sourceFile, sourceCode);
    
    // Chunk the file
    const chunks = await FileChunker.chunkFile(sourceCode, {
      maxTokensPerChunk: this.chunkedConfig.chunkTokenLimit,
      overlapTokens: 200,
      preserveContext: true,
      language: frameworkInfo.language as any
    });

    console.log(`Split ${gap.sourceFile} into ${chunks.length} chunks`);

    // Track progress
    this.chunkProgress.set(gap.sourceFile, {
      file: gap.sourceFile,
      totalChunks: chunks.length,
      processedChunks: 0,
      currentChunk: 0,
      estimatedTokensSaved: 0
    });

    // Create tasks for each chunk
    const taskIds: string[] = [];
    
    for (const chunk of chunks) {
      const chunkTask = await this.createChunkTask(gap, chunk, frameworkInfo);
      if (chunkTask) {
        taskIds.push(chunkTask.id);
        tasks.push(chunkTask);
      }
    }

    // Link related tasks
    tasks.forEach(task => {
      task.relatedTasks = taskIds.filter(id => id !== task.id);
    });

    return tasks;
  }

  /**
   * Create a task for a specific chunk
   */
  private async createChunkTask(
    gap: TestGap,
    chunk: FileChunk,
    frameworkInfo: FrameworkInfo
  ): Promise<ChunkedAITask | null> {
    try {
      // Read existing tests if available
      let existingTests = '';
      try {
        existingTests = await fs.readFile(gap.testFile, 'utf-8');
      } catch (error) {
        // No existing tests yet
      }

      // Create context with chunk info
      const context: TaskContext = {
        sourceCode: chunk.content,
        existingTests: existingTests,
        dependencies: gap.context.dependencies || [],
        businessDomain: this.extractBusinessDomain(gap),
        criticalPaths: [],
        missingScenarios: this.extractMissingScenarios(gap),
        frameworkInfo
      };

      // Build chunk-aware prompt
      const prompt = this.buildChunkedPrompt(gap, context, chunk);
      
      // Estimate tokens and cost for this chunk
      const estimatedTokens = this.estimateTokens(prompt, context);
      const estimatedCost = this.estimateCost(estimatedTokens);

      const task: ChunkedAITask = {
        id: `task-${++this.taskIdCounter}-chunk-${chunk.chunkIndex}`,
        sourceFile: gap.sourceFile,
        testFile: gap.testFile,
        priority: this.mapPriorityToNumber(gap.priority),
        complexity: gap.complexity.overall,
        prompt,
        context,
        estimatedTokens,
        estimatedCost,
        status: 'pending',
        isChunked: true,
        chunkInfo: {
          chunkIndex: chunk.chunkIndex,
          totalChunks: chunk.totalChunks,
          ...(chunk.context?.summary && { fileContext: chunk.context.summary })
        }
      };

      return task;
    } catch (error) {
      console.error(`Failed to create chunk task for ${gap.sourceFile} chunk ${chunk.chunkIndex}:`, error);
      return null;
    }
  }

  /**
   * Build prompt for a chunked file
   */
  private buildChunkedPrompt(
    gap: TestGap,
    context: TaskContext,
    chunk: FileChunk
  ): string {
    const { frameworkInfo } = context;
    
    const prompt = `You are an expert test engineer tasked with writing comprehensive logical/business tests for a PARTIAL section of a larger file.

**IMPORTANT**: This is chunk ${chunk.chunkIndex + 1} of ${chunk.totalChunks} from the file. Focus ONLY on the code in this chunk.

**FILE CONTEXT**
- Full file: ${gap.sourceFile}
- ${chunk.context?.summary || 'No summary available'}
- Lines in this chunk: ${chunk.startLine + 1} to ${chunk.endLine + 1}

**CONTEXT**
- Language: ${frameworkInfo.language}
- Test Framework: ${frameworkInfo.testFramework}
- Module Type: ${frameworkInfo.moduleType}

**SOURCE CODE CHUNK**: 
\`\`\`${frameworkInfo.language}
${context.sourceCode}
\`\`\`

${context.existingTests ? `**EXISTING TESTS**: ${gap.testFile}
Note: These are the complete existing tests, write new tests that complement these.` : '**EXISTING TESTS**: None yet'}

**IDENTIFIED GAPS FOR THIS FILE**:
${context.missingScenarios.map(s => `- ${s}`).join('\n')}

**REQUIREMENTS FOR THIS CHUNK**:
1. Write tests ONLY for the code visible in this chunk
2. If a function/class extends beyond this chunk, test only the parts visible here
3. Include appropriate imports for the code being tested
4. Focus on business logic within this chunk
5. Include edge cases specific to the visible code
6. Make tests independent and runnable in isolation
7. Use ${frameworkInfo.testFramework} testing framework conventions
8. Add descriptive test names that include the chunk context

**OUTPUT INSTRUCTIONS**:
- Output ONLY the test code for this chunk, no explanations
- Include necessary imports at the top
- Tests should be complete and ready to merge with other chunks
- Use the same module system as the source file (${frameworkInfo.moduleType})

Generate comprehensive logical tests for this code chunk:`;

    return prompt;
  }

  /**
   * Get progress for chunked file processing
   */
  getChunkProgress(file: string): ChunkProcessingProgress | undefined {
    return this.chunkProgress.get(file);
  }

  /**
   * Update chunk processing progress
   */
  updateChunkProgress(file: string, processedChunk: number): void {
    const progress = this.chunkProgress.get(file);
    if (progress) {
      progress.processedChunks++;
      progress.currentChunk = processedChunk;
      
      // Emit progress event
      this.emit('chunkProgress', progress);
    }
  }

  /**
   * Generate summary report with chunking statistics
   */
  generateSummary(batch: AITaskBatch): string {
    const baseReport = this.basePreparation.generateSummary(batch);
    
    // Add chunking statistics
    const chunkedTasks = (batch.tasks as ChunkedAITask[]).filter(t => t.isChunked);
    const chunkedFiles = new Set(chunkedTasks.map(t => t.sourceFile)).size;
    
    if (chunkedFiles > 0) {
      const chunkingStats = [
        '',
        '## Chunking Statistics:',
        `- Files requiring chunking: ${chunkedFiles}`,
        `- Total chunks created: ${chunkedTasks.length}`,
        `- Average chunks per file: ${(chunkedTasks.length / chunkedFiles).toFixed(1)}`,
        ''
      ];
      
      // Add per-file breakdown
      const fileChunks = new Map<string, number>();
      chunkedTasks.forEach(task => {
        fileChunks.set(task.sourceFile, (fileChunks.get(task.sourceFile) || 0) + 1);
      });
      
      chunkingStats.push('### Chunks by File:');
      fileChunks.forEach((chunks, file) => {
        chunkingStats.push(`- ${path.basename(file)}: ${chunks} chunks`);
      });
      
      return baseReport + '\n' + chunkingStats.join('\n');
    }
    
    return baseReport;
  }

  /**
   * Merge results from chunked tasks
   */
  static mergeChunkedResults(
    tasks: ChunkedAITask[],
    results: Map<string, string>
  ): Map<string, string> {
    const mergedResults = new Map<string, string>();
    
    // Group tasks by source file
    const tasksByFile = new Map<string, ChunkedAITask[]>();
    tasks.forEach(task => {
      if (!tasksByFile.has(task.sourceFile)) {
        tasksByFile.set(task.sourceFile, []);
      }
      tasksByFile.get(task.sourceFile)!.push(task);
    });
    
    // Merge results for each file
    tasksByFile.forEach((fileTasks, sourceFile) => {
      if (fileTasks.length === 1) {
        // Single chunk, use result as-is
        const result = results.get(fileTasks[0]!.id);
        if (result) {
          mergedResults.set(sourceFile, result);
        }
      } else {
        // Multiple chunks, merge results
        const sortedTasks = fileTasks.sort((a, b) => 
          (a.chunkInfo?.chunkIndex || 0) - (b.chunkInfo?.chunkIndex || 0)
        );
        
        const chunkResults: string[] = [];
        sortedTasks.forEach(task => {
          const result = results.get(task.id);
          if (result) {
            chunkResults.push(result);
          }
        });
        
        if (chunkResults.length > 0) {
          const merged = FileChunker.mergeChunkResults(chunkResults);
          mergedResults.set(sourceFile, merged);
        }
      }
    });
    
    return mergedResults;
  }

  // Helper methods using composition
  private detectFrameworkInfo(filePath: string, content: string): FrameworkInfo {
    const ext = path.extname(filePath).toLowerCase();
    
    if (ext === '.py') {
      return {
        language: 'python',
        testFramework: content.includes('pytest') ? 'pytest' : 'unittest',
        moduleType: 'python',
        hasTypeScript: false
      };
    }
    
    const isTypeScript = ext === '.ts' || ext === '.tsx';
    const hasVitest = content.includes('vitest') || content.includes('vi.');
    const isESM = content.includes('export') || content.includes('import');
    
    return {
      language: isTypeScript ? 'typescript' : 'javascript',
      testFramework: hasVitest ? 'vitest' : 'jest',
      moduleType: isESM ? 'esm' : 'commonjs',
      hasTypeScript: isTypeScript
    };
  }
  
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
    gap.gaps.forEach(g => {
      scenarios.push(g.description);
    });
    
    return scenarios;
  }
  
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
  
  private estimateCost(tokens: number): number {
    const MODEL_COSTS = {
      'claude-3-opus': { input: 0.015, output: 0.075 },    // per 1K tokens
      'claude-3-sonnet': { input: 0.003, output: 0.015 },  // per 1K tokens
      'claude-3-haiku': { input: 0.00025, output: 0.00125 } // per 1K tokens
    };
    
    const costs = MODEL_COSTS['claude-3-sonnet']; // Default
    
    // Assume 70% input, 30% output for estimation
    const inputTokens = Math.ceil(tokens * 0.7);
    const outputTokens = Math.ceil(tokens * 0.3);
    
    const inputCost = (inputTokens / 1000) * costs.input;
    const outputCost = (outputTokens / 1000) * costs.output;
    
    return inputCost + outputCost;
  }
  
  private mapPriorityToNumber(priority: any): number {
    const priorityMap: Record<string, number> = {
      'critical': 10,
      'high': 8,
      'medium': 5,
      'low': 3
    };
    return priorityMap[priority] || 5;
  }
  
  private emit(_event: string, _data: any): void {
    // Event emission for progress tracking
    // This would integrate with EventEmitter if needed
  }
}