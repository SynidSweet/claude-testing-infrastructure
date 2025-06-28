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
import { ProjectAnalyzer } from '../analyzers/ProjectAnalyzer';
// import { TestGenerator } from '../generators/TestGenerator'; // Not currently used
import { TestRunnerFactory } from '../runners/TestRunnerFactory';
import { TestGapAnalyzer } from '../analyzers/TestGapAnalyzer';
// import { CoverageReporter } from '../runners/CoverageReporter'; // Not currently used
import {
  AITaskPreparation,
  ClaudeOrchestrator,
  CostEstimator
} from '../ai';
import { logger } from '../utils/logger';

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

export interface WorkflowResult {
  success: boolean;
  projectAnalysis: any;
  generatedTests: {
    structural: number;
    logical: number;
  };
  testResults?: any;
  coverage?: any;
  gaps?: any;
  aiResults?: any;
  totalCost?: number;
  duration: number;
  reports: {
    summary: string;
    detailed: any;
  };
}

export class AIEnhancedTestingWorkflow extends EventEmitter {
  private startTime: number = 0;

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
      ...config
    };
  }

  /**
   * Execute the complete AI-enhanced testing workflow
   */
  async execute(projectPath: string): Promise<WorkflowResult> {
    this.startTime = Date.now();
    const result: Partial<WorkflowResult> = {
      success: false,
      generatedTests: { structural: 0, logical: 0 }
    };

    try {
      this.emit('workflow:start', { projectPath, config: this.config });

      // Phase 1: Project Analysis
      this.emit('phase:start', { phase: 'analysis' });
      result.projectAnalysis = await this.analyzeProject(projectPath);
      this.emit('phase:complete', { phase: 'analysis', result: result.projectAnalysis });

      // Phase 2: Structural Test Generation
      this.emit('phase:start', { phase: 'structural-generation' });
      const structuralTests = await this.generateStructuralTests(
        projectPath,
        result.projectAnalysis
      );
      result.generatedTests!.structural = structuralTests.length;
      this.emit('phase:complete', { phase: 'structural-generation', count: structuralTests.length });

      // Phase 3: Test Execution (if enabled)
      if (this.config.runTests) {
        this.emit('phase:start', { phase: 'test-execution' });
        const testResults = await this.runTests(projectPath);
        result.testResults = testResults.results;
        result.coverage = testResults.coverage;
        this.emit('phase:complete', { phase: 'test-execution', results: testResults });
      }

      // Phase 4: Gap Analysis
      this.emit('phase:start', { phase: 'gap-analysis' });
      const gapReport = await this.analyzeGaps(projectPath);
      result.gaps = gapReport;
      this.emit('phase:complete', { phase: 'gap-analysis', gaps: gapReport.gaps.length });

      // Phase 5: AI Logical Test Generation (if enabled and gaps exist)
      if (this.config.enableAI && gapReport.gaps.length > 0) {
        this.emit('phase:start', { phase: 'ai-generation' });
        const aiResults = await this.generateLogicalTests(gapReport);
        result.aiResults = aiResults;
        result.generatedTests!.logical = aiResults.successful;
        result.totalCost = aiResults.totalCost;
        this.emit('phase:complete', { phase: 'ai-generation', results: aiResults });
      }

      // Phase 6: Final Test Execution (if AI generated new tests)
      if (this.config.runTests && result.generatedTests!.logical > 0) {
        this.emit('phase:start', { phase: 'final-execution' });
        const finalResults = await this.runTests(projectPath);
        result.testResults = finalResults.results;
        result.coverage = finalResults.coverage;
        this.emit('phase:complete', { phase: 'final-execution', results: finalResults });
      }

      // Generate reports
      result.duration = (Date.now() - this.startTime) / 1000;
      result.reports = await this.generateReports(projectPath, result);
      result.success = true;

      this.emit('workflow:complete', { result });
      return result as WorkflowResult;

    } catch (error) {
      this.emit('workflow:error', { error });
      result.duration = (Date.now() - this.startTime) / 1000;
      result.reports = {
        summary: `Workflow failed: ${error}`,
        detailed: { error: error instanceof Error ? error.stack : error }
      };
      return result as WorkflowResult;
    }
  }

  /**
   * Phase 1: Analyze project
   */
  private async analyzeProject(projectPath: string): Promise<any> {
    const analyzer = new ProjectAnalyzer(projectPath);
    const analysis = await analyzer.analyze();
    
    logger.info(`Analyzed project with ${analysis.languages?.length || 0} languages`);
    return analysis;
  }

  /**
   * Phase 2: Generate structural tests
   */
  private async generateStructuralTests(
    projectPath: string,
    analysis: any
  ): Promise<any[]> {
    // Import StructuralTestGenerator since TestGenerator is abstract
    const { StructuralTestGenerator } = await import('../generators/StructuralTestGenerator');
    const config = {
      projectPath,
      outputPath: path.join(projectPath, '.claude-testing', 'tests'),
      testFramework: this.config.testFramework || 'jest',
      options: {
        generateMocks: this.config.generateMocks || false
      }
    };
    
    const generator = new StructuralTestGenerator(config, analysis, {
      generateMocks: this.config.generateMocks || false
    });

    const generatedTests = await generator.generate();
    
    // Save generated tests
    const testDir = path.join(projectPath, '.claude-testing', 'tests');
    await fs.mkdir(testDir, { recursive: true });
    
    let testCount = 0;
    if (generatedTests.tests) {
      for (const test of generatedTests.tests) {
        const testPath = path.join(testDir, path.basename(test.testPath));
        await fs.mkdir(path.dirname(testPath), { recursive: true });
        await fs.writeFile(testPath, test.content, 'utf-8');
        testCount++;
      }
    }

    logger.info(`Generated ${testCount} structural test files`);
    return generatedTests.tests || [];
  }

  /**
   * Phase 3: Run tests
   */
  private async runTests(projectPath: string): Promise<any> {
    // Create a temporary ProjectAnalysis for the runner
    const analyzer = new ProjectAnalyzer(projectPath);
    const analysis = await analyzer.analyze();
    
    const config: any = {
      projectPath,
      testPath: path.join(projectPath, '.claude-testing', 'tests'),
      framework: this.config.testFramework || 'jest'
    };
    
    if (this.config.coverage) {
      config.coverage = {
        enabled: true,
        outputDir: path.join(projectPath, '.claude-testing', 'coverage'),
        reporters: ['html', 'json', 'text']
      };
    }
    
    const runner = TestRunnerFactory.createRunner(config, analysis);
    const results = await runner.run();

    return { results, coverage: results.coverage };
  }

  /**
   * Phase 4: Analyze gaps
   */
  private async analyzeGaps(projectPath: string): Promise<any> {
    const projectAnalyzer = new ProjectAnalyzer(projectPath);
    const projectAnalysis = await projectAnalyzer.analyze();
    
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
        generationTime: 0
      }
    };
    
    const gapReport = await analyzer.analyzeGaps(testGenerationResult);
    
    logger.info(`Found ${gapReport.gaps?.length || 0} files needing logical tests`);
    return gapReport;
  }

  /**
   * Phase 5: Generate logical tests with AI
   */
  private async generateLogicalTests(gapReport: any): Promise<any> {
    // Check if Claude is available
    try {
      const { execSync } = require('child_process');
      execSync('which claude', { stdio: 'ignore' });
    } catch {
      logger.warn('Claude CLI not found - skipping AI generation');
      return { successful: 0, failed: 0, totalCost: 0 };
    }

    // Prepare AI tasks
    const taskPrep = new AITaskPreparation({
      model: `claude-3-${this.config.aiModel}`,
      maxConcurrentTasks: this.config.aiConcurrency || 3,
      minComplexityForAI: this.config.minComplexityForAI || 5
    });

    let batch = await taskPrep.prepareTasks(gapReport);

    // Apply budget optimization if specified
    if (this.config.aiBudget) {
      const estimator = new CostEstimator(`claude-3-${this.config.aiModel}`);
      const optimization = estimator.optimizeForBudget(gapReport, this.config.aiBudget);
      
      batch.tasks = batch.tasks.filter(task => {
        const allocation = optimization.allocations.find(a => a.file === task.sourceFile);
        return allocation?.includeInBatch;
      });
    }

    // Execute AI generation
    const orchestrator = new ClaudeOrchestrator({
      maxConcurrent: this.config.aiConcurrency || 3,
      model: `claude-3-${this.config.aiModel}`,
      verbose: this.config.verbose || false
    });

    // Track progress
    orchestrator.on('task:complete', ({ task }) => {
      this.emit('ai:task-complete', { file: task.sourceFile });
    });

    const results = await orchestrator.processBatch(batch);
    
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const stats = orchestrator['stats'];

    return {
      successful,
      failed,
      totalCost: stats.totalCost,
      totalTokens: stats.totalTokensUsed,
      duration: stats.totalDuration
    };
  }

  /**
   * Generate workflow reports
   */
  private async generateReports(
    projectPath: string,
    result: Partial<WorkflowResult>
  ): Promise<{ summary: string; detailed: any }> {
    const summary = this.generateSummaryReport(result);
    const detailed = {
      timestamp: new Date().toISOString(),
      projectPath,
      config: this.config,
      ...result
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
      await fs.writeFile(
        detailedPath,
        JSON.stringify(detailed, null, 2),
        'utf-8'
      );

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
      `- Structural tests: ${result.generatedTests?.structural || 0}`,
      `- Logical tests (AI): ${result.generatedTests?.logical || 0}`,
      `- Total tests: ${(result.generatedTests?.structural || 0) + (result.generatedTests?.logical || 0)}`,
      ''
    ];

    if (result.coverage) {
      lines.push(
        '### Coverage',
        `- Line coverage: ${result.coverage.summary.lines.percentage.toFixed(1)}%`,
        `- Branch coverage: ${result.coverage.summary.branches.percentage.toFixed(1)}%`,
        `- Function coverage: ${result.coverage.summary.functions.percentage.toFixed(1)}%`,
        ''
      );
    }

    if (result.gaps) {
      lines.push(
        '### Gap Analysis',
        `- Files analyzed: ${result.gaps.totalFiles}`,
        `- Files with gaps: ${result.gaps.gaps.length}`,
        `- Average complexity: ${result.gaps.averageComplexity.toFixed(1)}`,
        ''
      );
    }

    if (result.aiResults) {
      lines.push(
        '### AI Generation',
        `- Successful: ${result.aiResults.successful}`,
        `- Failed: ${result.aiResults.failed}`,
        `- Total cost: $${result.totalCost?.toFixed(2) || '0.00'}`,
        `- Tokens used: ${result.aiResults.totalTokens?.toLocaleString() || 0}`,
        ''
      );
    }

    if (result.projectAnalysis) {
      lines.push(
        '### Project Analysis',
        `- Language: ${result.projectAnalysis.language}`,
        `- Framework: ${result.projectAnalysis.framework || 'None detected'}`,
        `- Total files: ${result.projectAnalysis.metrics.totalFiles}`,
        `- Total lines: ${result.projectAnalysis.metrics.totalLines}`,
        ''
      );
    }

    return lines.join('\n');
  }
}