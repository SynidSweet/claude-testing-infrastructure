/**
 * AI-Enhanced Testing Workflow
 *
 * Complete workflow that combines:
 * 1. Project analysis
 * 2. Structural test generation
 * 3. Test execution and coverage
 * 4. Gap analysis
 * 5. AI-powered logical test generation
 */

import { EventEmitter } from 'events';
import * as path from 'path';
import * as fs from 'fs/promises';
import { execSync } from 'child_process';
import { ProjectAnalyzer, type ProjectAnalysis } from '../analyzers/ProjectAnalyzer';
// import { TestGenerator } from '../generators/TestGenerator'; // Not currently used
import { TestRunnerFactory, type TestRunnerConfig } from '../runners/TestRunnerFactory';
import { type TestResult, type CoverageResult } from '../runners/TestRunner';
import { TestGapAnalyzer, type TestGapAnalysisResult } from '../analyzers/TestGapAnalyzer';
// import { CoverageReporter } from '../runners/CoverageReporter'; // Not currently used
import { ChunkedAITaskPreparation, ClaudeOrchestrator, CostEstimator, type AITask } from '../ai';
import { logger } from '../utils/logger';
import type { GapAnalysisResult } from '../types/generation-types';
import { AIWorkflowError } from '../types/ai-error-types';
import { formatErrorMessage } from '../utils/error-handling';
import type {
  WorkflowPhase,
  WorkflowEvents,
  StructuralTestFile,
  WorkflowEventHandler,
  WorkflowState,
  PhaseResults,
  PhaseResult,
} from '../types/ai-workflow-types';

export interface TestRunResults {
  results: TestResult;
  coverage?: CoverageResult | undefined;
}

export interface WorkflowConfig {
  // Analysis options
  includePatterns?: string[];
  excludePatterns?: string[];

  // Generation options
  testFramework?: string;
  generateMocks?: boolean;

  // AI options
  enableAI?: boolean;
  aiModel?: string;
  aiBudget?: number;
  aiConcurrency?: number;
  minComplexityForAI?: number;

  // Execution options
  runTests?: boolean;
  coverage?: boolean;

  // Output options
  outputDir?: string;
  verbose?: boolean;
}

interface AIGenerationResults {
  successful: number;
  failed: number;
  totalCost: number;
  totalTokens?: number;
}

export interface WorkflowResult {
  success: boolean;
  projectAnalysis: ProjectAnalysis;
  generatedTests: {
    structural: number;
    logical: number;
  };
  testResults?: TestResult;
  coverage?: CoverageResult;
  gaps?: GapAnalysisResult;
  aiResults?: AIGenerationResults;
  totalCost?: number;
  duration: number;
  reports: {
    summary: string;
    detailed: WorkflowDetailedReport;
  };
}

export interface WorkflowDetailedReport {
  timestamp: string;
  projectPath: string;
  config: WorkflowConfig;
  error?: AIWorkflowError | undefined;
  stack?: string | undefined;
  context?: Record<string, unknown> | undefined;
  [key: string]: unknown;
}

export class AIEnhancedTestingWorkflow extends EventEmitter {
  private startTime: number = 0;
  private workflowState: WorkflowState;

  // Type-safe event emission
  public emit<K extends keyof WorkflowEvents>(event: K, data: WorkflowEvents[K]): boolean {
    return super.emit(event, data);
  }

  // Type-safe event listener
  public on<K extends keyof WorkflowEvents>(event: K, listener: WorkflowEventHandler<K>): this {
    return super.on(event, listener);
  }

  // Initialize workflow state
  private initializeState(): WorkflowState {
    return {
      currentPhase: null,
      startTime: Date.now(),
      phaseTimes: {},
      results: {
        success: false,
        generatedTests: { structural: 0, logical: 0 },
      },
      errors: [],
    };
  }

  // Type-safe phase transition
  private transitionToPhase(phase: WorkflowPhase): void {
    // Import the function dynamically to avoid circular dependencies
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { isValidPhaseTransition } = require('../types/ai-workflow-types') as {
      isValidPhaseTransition: (from: WorkflowPhase | null, to: WorkflowPhase) => boolean;
    };
    if (!isValidPhaseTransition(this.workflowState.currentPhase, phase)) {
      throw new AIWorkflowError(
        `Invalid phase transition from ${this.workflowState.currentPhase} to ${phase}`,
        'phase-transition'
      );
    }

    // End current phase timing
    if (this.workflowState.currentPhase) {
      const currentPhaseTime = this.workflowState.phaseTimes[this.workflowState.currentPhase];
      if (currentPhaseTime && !currentPhaseTime.end) {
        currentPhaseTime.end = Date.now();
      }
    }

    // Start new phase
    this.workflowState.currentPhase = phase;
    this.workflowState.phaseTimes[phase] = { start: Date.now() };
  }

  // Store phase result with type safety
  private setPhaseResult<T extends WorkflowPhase>(phase: T, result: PhaseResult<T>): void {
    // Type-safe result storage based on phase
    switch (phase) {
      case 'analysis': {
        this.workflowState.results.projectAnalysis = result as PhaseResults['analysis'];
        break;
      }
      case 'structural-generation': {
        const structuralTests = result as PhaseResults['structural-generation'];
        if (this.workflowState.results.generatedTests) {
          this.workflowState.results.generatedTests.structural = structuralTests.length;
        }
        break;
      }
      case 'test-execution':
      case 'final-execution': {
        const testResults = result as PhaseResults['test-execution'];
        this.workflowState.results.testResults = testResults.results;
        if (testResults.coverage) {
          this.workflowState.results.coverage = testResults.coverage;
        }
        break;
      }
      case 'gap-analysis': {
        const gapResult = result as PhaseResults['gap-analysis'];
        this.workflowState.results.gaps = this.convertToGapAnalysisResult(gapResult);
        break;
      }
      case 'ai-generation': {
        const aiResult = result as PhaseResults['ai-generation'];
        this.workflowState.results.aiResults = aiResult;
        if (this.workflowState.results.generatedTests) {
          this.workflowState.results.generatedTests.logical = aiResult.successful;
        }
        this.workflowState.results.totalCost = aiResult.totalCost;
        break;
      }
    }
  }

  constructor(private config: WorkflowConfig = {}) {
    super();

    // Set defaults
    this.config = {
      enableAI: true,
      aiModel: 'sonnet',
      aiConcurrency: 3,
      minComplexityForAI: 5,
      runTests: true,
      coverage: true,
      ...config,
    };

    // Initialize workflow state
    this.workflowState = this.initializeState();
  }

  /**
   * Execute the complete AI-enhanced testing workflow
   */
  async execute(projectPath: string): Promise<WorkflowResult> {
    // Initialize fresh state for this execution
    this.workflowState = this.initializeState();
    this.startTime = this.workflowState.startTime;

    try {
      this.emit('workflow:start', { projectPath, config: this.config });

      // Phase 1: Project Analysis
      this.transitionToPhase('analysis');
      this.emit('phase:start', { phase: 'analysis' as WorkflowPhase });
      const projectAnalysis = await this.analyzeProject(projectPath);
      this.setPhaseResult('analysis', projectAnalysis);
      this.emit('phase:complete', { phase: 'analysis' as WorkflowPhase, result: projectAnalysis });

      // Phase 2: Structural Test Generation
      this.transitionToPhase('structural-generation');
      this.emit('phase:start', { phase: 'structural-generation' as WorkflowPhase });
      const structuralTests = await this.generateStructuralTests(
        projectPath,
        this.workflowState.results.projectAnalysis!
      );
      this.setPhaseResult('structural-generation', structuralTests);
      this.emit('phase:complete', {
        phase: 'structural-generation' as WorkflowPhase,
        count: structuralTests.length,
      });

      // Phase 3: Test Execution (if enabled)
      if (this.config.runTests) {
        this.transitionToPhase('test-execution');
        this.emit('phase:start', { phase: 'test-execution' as WorkflowPhase });
        const testResults = await this.runTests(projectPath);
        this.setPhaseResult('test-execution', testResults);
        this.emit('phase:complete', {
          phase: 'test-execution' as WorkflowPhase,
          results: testResults,
        });
      }

      // Phase 4: Gap Analysis
      this.transitionToPhase('gap-analysis');
      this.emit('phase:start', { phase: 'gap-analysis' as WorkflowPhase });
      const gapReport = await this.analyzeTestGaps(projectPath);
      this.setPhaseResult('gap-analysis', gapReport);
      this.emit('phase:complete', {
        phase: 'gap-analysis' as WorkflowPhase,
        gaps: gapReport.gaps?.length ?? 0,
      });

      // Phase 5: AI Logical Test Generation (if enabled and gaps exist)
      if (this.config.enableAI && gapReport.gaps && gapReport.gaps.length > 0) {
        this.transitionToPhase('ai-generation');
        this.emit('phase:start', { phase: 'ai-generation' as WorkflowPhase });
        const aiResults = await this.generateLogicalTests(gapReport);
        this.setPhaseResult('ai-generation', aiResults);
        this.emit('phase:complete', {
          phase: 'ai-generation' as WorkflowPhase,
          results: aiResults,
        });
      }

      // Phase 6: Final Test Execution (if AI generated new tests)
      if (this.config.runTests && (this.workflowState.results.generatedTests?.logical ?? 0) > 0) {
        this.transitionToPhase('final-execution');
        this.emit('phase:start', { phase: 'final-execution' as WorkflowPhase });
        const finalResults = await this.runTests(projectPath);
        this.setPhaseResult('final-execution', finalResults);
        this.emit('phase:complete', {
          phase: 'final-execution' as WorkflowPhase,
          results: finalResults,
        });
      }

      // Generate reports
      this.workflowState.results.duration = (Date.now() - this.startTime) / 1000;
      this.workflowState.results.success = true;
      this.workflowState.results.reports = await this.generateReports(
        projectPath,
        this.workflowState.results
      );

      const finalResult = this.workflowState.results as WorkflowResult;
      this.emit('workflow:complete', { result: finalResult });
      return finalResult;
    } catch (error: unknown) {
      const workflowError =
        error instanceof AIWorkflowError
          ? error
          : new AIWorkflowError(
              formatErrorMessage(error),
              'execution',
              error instanceof Error ? error : undefined
            );

      this.workflowState.errors.push(workflowError);
      this.emit('workflow:error', { error: workflowError });
      this.workflowState.results.duration = (Date.now() - this.startTime) / 1000;
      this.workflowState.results.reports = {
        summary: `Workflow failed: ${workflowError.message}`,
        detailed: {
          timestamp: new Date().toISOString(),
          projectPath,
          config: this.config,
          error: workflowError,
          stack: workflowError.stack,
          context: workflowError.context,
        },
      };
      return this.workflowState.results as WorkflowResult;
    }
  }

  /**
   * Phase 1: Analyze project
   */
  private async analyzeProject(projectPath: string): Promise<ProjectAnalysis> {
    const analyzer = new ProjectAnalyzer(projectPath);
    const analysis = await analyzer.analyzeProject();

    logger.info(`Analyzed project with ${analysis.languages?.length ?? 0} languages`);
    return analysis;
  }

  /**
   * Phase 2: Generate structural tests
   */
  private async generateStructuralTests(
    projectPath: string,
    analysis: ProjectAnalysis
  ): Promise<StructuralTestFile[]> {
    // Import StructuralTestGenerator since TestGenerator is abstract
    const { StructuralTestGenerator } = await import('../generators/StructuralTestGenerator');
    const config = {
      projectPath,
      outputPath: path.join(projectPath, '.claude-testing', 'tests'),
      testFramework: this.config.testFramework ?? 'jest',
      options: {
        generateMocks: this.config.generateMocks ?? false,
      },
    };

    const generator = new StructuralTestGenerator(config, analysis, {
      generateMocks: this.config.generateMocks ?? false,
    });

    const generatedTests = await generator.generateAllTests();

    // Save generated tests
    const testDir = path.join(projectPath, '.claude-testing', 'tests');
    await fs.mkdir(testDir, { recursive: true });

    const structuralTestFiles: StructuralTestFile[] = [];
    if (generatedTests.tests) {
      for (const test of generatedTests.tests) {
        const testPath = path.join(testDir, path.basename(test.testPath));
        await fs.mkdir(path.dirname(testPath), { recursive: true });
        await fs.writeFile(testPath, test.content, 'utf-8');
        structuralTestFiles.push({
          testPath: test.testPath,
          content: test.content,
          sourceFile: (test as { sourceFile?: string }).sourceFile ?? '',
        });
      }
    }

    logger.info(`Generated ${structuralTestFiles.length} structural test files`);
    return structuralTestFiles;
  }

  /**
   * Phase 3: Run tests
   */
  private async runTests(projectPath: string): Promise<TestRunResults> {
    // Create a temporary ProjectAnalysis for the runner
    const analyzer = new ProjectAnalyzer(projectPath);
    const analysis = await analyzer.analyzeProject();

    const config: TestRunnerConfig = {
      projectPath,
      testPath: path.join(projectPath, '.claude-testing', 'tests'),
      framework: this.config.testFramework ?? 'jest',
    };

    if (this.config.coverage) {
      config.coverage = {
        enabled: true,
        outputDir: path.join(projectPath, '.claude-testing', 'coverage'),
        reporters: ['html', 'json', 'text'],
      };
    }

    const runner = TestRunnerFactory.createRunner(config, analysis);
    const results = await runner.run();

    return {
      results: results,
      coverage: results.coverage,
    };
  }

  /**
   * Phase 4: Analyze gaps
   */
  private async analyzeTestGaps(projectPath: string): Promise<TestGapAnalysisResult> {
    const projectAnalyzer = new ProjectAnalyzer(projectPath);
    const projectAnalysis = await projectAnalyzer.analyzeProject();

    const analyzer = new TestGapAnalyzer(projectAnalysis);

    // Create a mock TestGenerationResult to simulate having generated tests
    const testGenerationResult = {
      success: true,
      tests: [],
      errors: [],
      warnings: [],
      stats: {
        filesAnalyzed: 0,
        testsGenerated: 0,
        testLinesGenerated: 0,
        generationTime: 0,
      },
    };

    const gapReport = await analyzer.analyzeTestGaps(testGenerationResult);

    logger.info(`Found ${gapReport.gaps?.length ?? 0} files needing logical tests`);
    return gapReport;
  }

  /**
   * Convert TestGapAnalysisResult to GapAnalysisResult for AI
   */
  private convertToGapAnalysisResult(testGapResult: TestGapAnalysisResult): GapAnalysisResult {
    return {
      fileGaps: testGapResult.gaps.map((gap) => ({
        filePath: gap.sourceFile,
        hasTests: gap.currentCoverage.structuralCoverage.estimatedPercentage > 0,
        testPath: gap.testFile,
        coverage: gap.currentCoverage.structuralCoverage.estimatedPercentage,
        complexity:
          typeof gap.complexity === 'object' &&
          gap.complexity !== null &&
          'overall' in gap.complexity
            ? (gap.complexity as { overall: number }).overall
            : 0,
      })),
      totalFiles: testGapResult.summary.totalFiles,
      coveragePercentage:
        (testGapResult.summary.filesWithTests / testGapResult.summary.totalFiles) * 100,
      missingTests: testGapResult.gaps.map((gap) => gap.sourceFile),
    };
  }

  /**
   * Phase 5: Generate logical tests with AI
   */
  private async generateLogicalTests(
    gapAnalysis: TestGapAnalysisResult
  ): Promise<AIGenerationResults> {
    // Check if Claude is available
    try {
      execSync('which claude', { stdio: 'ignore' });
    } catch (error: unknown) {
      const workflowError = new AIWorkflowError(
        'Claude CLI not found - skipping AI generation',
        'ai-generation',
        error instanceof Error ? error : undefined,
        { reason: 'claude-cli-unavailable' }
      );
      logger.warn(workflowError.message);
      this.emit('ai:skipped', { reason: workflowError });
      return { successful: 0, failed: 0, totalCost: 0 };
    }

    // Prepare AI tasks with chunking support
    const taskPrep = new ChunkedAITaskPreparation({
      model: `claude-3-${this.config.aiModel}`,
      maxConcurrentTasks: this.config.aiConcurrency ?? 3,
      minComplexityForAI: this.config.minComplexityForAI ?? 5,
      enableChunking: true,
    });

    const batch = await taskPrep.prepareTasks(gapAnalysis);

    // Apply budget optimization if specified
    if (this.config.aiBudget) {
      const estimator = new CostEstimator(`claude-3-${this.config.aiModel}`);
      const optimization = estimator.optimizeForBudget(gapAnalysis, this.config.aiBudget);

      batch.tasks = batch.tasks.filter((task) => {
        const allocation = optimization.allocations.find((a) => a.file === task.sourceFile);
        return allocation?.includeInBatch;
      });
    }

    // Execute AI generation
    const orchestrator = new ClaudeOrchestrator({
      maxConcurrent: this.config.aiConcurrency ?? 3,
      model: `claude-3-${this.config.aiModel}`,
      verbose: this.config.verbose ?? false,
    });

    // Track progress with type safety
    orchestrator.on('task:complete', ({ task }: { task: AITask }) => {
      this.emit('ai:task-complete', { file: task.sourceFile });
    });

    const results = await orchestrator.processBatch(batch);

    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    // Use getStats method for type safety
    const stats = orchestrator.getStats
      ? orchestrator.getStats()
      : {
          totalCost: 0,
          totalTokensUsed: 0,
          totalDuration: 0,
          successfulTasks: successful,
          failedTasks: failed,
        };

    return {
      successful,
      failed,
      totalCost: stats.totalCost,
      totalTokens: stats.totalTokensUsed,
    };
  }

  /**
   * Generate workflow reports
   */
  private async generateReports(
    projectPath: string,
    result: Partial<WorkflowResult>
  ): Promise<{ summary: string; detailed: WorkflowDetailedReport }> {
    const summary = this.generateSummaryReport(result);
    const detailed: WorkflowDetailedReport = {
      timestamp: new Date().toISOString(),
      projectPath,
      config: this.config,
      ...result,
    };

    // Save reports if output directory specified
    if (this.config.outputDir) {
      const outputDir = path.resolve(this.config.outputDir);
      await fs.mkdir(outputDir, { recursive: true });

      // Save summary
      const summaryPath = path.join(outputDir, 'workflow-summary.md');
      await fs.writeFile(summaryPath, summary, 'utf-8');

      // Save detailed report
      const detailedPath = path.join(outputDir, 'workflow-report.json');
      await fs.writeFile(detailedPath, JSON.stringify(detailed, null, 2), 'utf-8');

      logger.info(`Reports saved to: ${outputDir}`);
    }

    return { summary, detailed };
  }

  /**
   * Generate summary report
   */
  private generateSummaryReport(result: Partial<WorkflowResult>): string {
    const lines = [
      '# AI-Enhanced Testing Workflow Summary',
      '',
      `**Duration**: ${result.duration?.toFixed(1)}s`,
      `**Status**: ${result.success ? '✅ Success' : '❌ Failed'}`,
      '',
      '## Results',
      '',
      '### Test Generation',
      `- Structural tests: ${result.generatedTests?.structural ?? 0}`,
      `- Logical tests (AI): ${result.generatedTests?.logical ?? 0}`,
      `- Total tests: ${(result.generatedTests?.structural ?? 0) + (result.generatedTests?.logical ?? 0)}`,
      '',
    ];

    if (result.coverage) {
      lines.push('### Coverage', `- Coverage data available`, '');
    }

    if (result.gaps) {
      lines.push(
        '### Gap Analysis',
        `- Files analyzed: ${result.gaps.totalFiles}`,
        `- Files with gaps: ${result.gaps.fileGaps.length}`,
        `- Coverage: ${result.gaps.coveragePercentage.toFixed(1)}%`,
        ''
      );
    }

    if (result.aiResults) {
      lines.push(
        '### AI Generation',
        `- Successful: ${result.aiResults.successful}`,
        `- Failed: ${result.aiResults.failed}`,
        `- Total cost: $${result.totalCost?.toFixed(2) ?? '0.00'}`,
        `- Tokens used: ${result.aiResults.totalTokens?.toLocaleString() ?? 0}`,
        ''
      );
    }

    if (result.projectAnalysis) {
      lines.push(
        '### Project Analysis',
        `- Languages: ${result.projectAnalysis.languages.map((l) => l.name).join(', ')}`,
        `- Frameworks: ${result.projectAnalysis.frameworks.map((f) => f.name).join(', ') || 'None detected'}`,
        `- Total files: ${result.projectAnalysis.complexity.totalFiles}`,
        `- Total lines: ${result.projectAnalysis.complexity.totalLines}`,
        ''
      );
    }

    return lines.join('\n');
  }
}
