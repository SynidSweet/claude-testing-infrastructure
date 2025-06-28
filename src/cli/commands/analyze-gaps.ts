import { promises as fs } from 'fs';
import path from 'path';
import { Command } from 'commander';
import { logger } from '../../utils/logger';
import { ProjectAnalyzer } from '../../analyzers/ProjectAnalyzer';
import { TestGapAnalyzer } from '../../analyzers/TestGapAnalyzer';
import { GapReportGenerator, ReportOptions } from '../../analyzers/GapReportGenerator';
import { StructuralTestGenerator } from '../../generators/StructuralTestGenerator';
import { TestGeneratorConfig } from '../../generators/TestGenerator';

interface AnalyzeGapsOptions {
  config?: string;
  output?: string;
  format?: 'json' | 'markdown' | 'text';
  threshold?: number;
  verbose?: boolean;
  includeDetails?: boolean;
  includeCodeSnippets?: boolean;
  noColors?: boolean;
}

export const analyzeGapsCommand = new Command('analyze-gaps')
  .alias('gaps')
  .description('Analyze generated tests to identify gaps for AI-powered logical test generation')
  .argument('<projectPath>', 'Path to the project to analyze')
  .option('-c, --config <config>', 'Configuration file path')
  .option('-o, --output <output>', 'Output file path for gap analysis results')
  .option('-f, --format <format>', 'Output format (json, markdown, text)', 'text')
  .option('-t, --threshold <threshold>', 'Complexity threshold for analysis', '3')
  .option('-v, --verbose', 'Enable verbose logging')
  .option('--include-details', 'Include detailed gap breakdown in output')
  .option('--include-code-snippets', 'Include code snippets in reports (increases size)')
  .option('--no-colors', 'Disable colored terminal output')
  .action(async (projectPath: string, options: AnalyzeGapsOptions) => {
    const startTime = Date.now();
    
    try {
      if (options.verbose) {
        logger.level = 'debug';
      }

      logger.info('Starting test gap analysis', {
        projectPath,
        options
      });

      // Resolve and validate project path
      const resolvedProjectPath = path.resolve(projectPath);
      
      try {
        await fs.access(resolvedProjectPath);
      } catch (error) {
        logger.error('Project path does not exist', { projectPath: resolvedProjectPath });
        process.exit(1);
      }

      // Step 1: Analyze the project
      logger.info('Analyzing project structure and generating structural tests');
      const projectAnalyzer = new ProjectAnalyzer(resolvedProjectPath);
      const projectAnalysis = await projectAnalyzer.analyze();

      // Step 2: Generate structural tests (to analyze gaps against)
      const config: TestGeneratorConfig = {
        projectPath: resolvedProjectPath,
        outputPath: path.join(resolvedProjectPath, '.claude-testing'),
        testFramework: projectAnalysis.languages[0]?.name === 'python' ? 'pytest' : 'jest',
        options: {}
      };

      const testGenerator = new StructuralTestGenerator(config, projectAnalysis);
      const generationResult = await testGenerator.generate();

      if (!generationResult.success) {
        logger.error('Failed to generate structural tests for gap analysis', {
          errors: generationResult.errors
        });
        process.exit(1);
      }

      // Step 3: Analyze gaps
      logger.info('Analyzing test gaps', {
        testsGenerated: generationResult.tests.length
      });

      const gapAnalyzer = new TestGapAnalyzer(projectAnalysis, {
        complexityThreshold: parseInt(String(options.threshold || '3'), 10)
      });

      const gapAnalysis = await gapAnalyzer.analyzeGaps(generationResult);

      // Step 4: Generate enhanced reports using GapReportGenerator
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Add timing information
      const analysisWithTiming = {
        ...gapAnalysis,
        timing: {
          duration,
          startTime: new Date(startTime).toISOString(),
          endTime: new Date(endTime).toISOString()
        }
      };

      // Configure report options
      const reportOptions: ReportOptions = {
        includeDetails: options.includeDetails || false,
        includeCodeSnippets: options.includeCodeSnippets || false,
        useColors: !options.noColors,
        includeTiming: true,
        maxGapsToShow: 50
      };

      const reportGenerator = new GapReportGenerator(reportOptions);

      if (options.output) {
        await outputResults(analysisWithTiming, options.output, options.format || 'json', reportGenerator);
        logger.info('Gap analysis results saved', { 
          outputPath: options.output,
          format: options.format
        });
      } else {
        // Output to console with enhanced visualization
        outputToConsole(analysisWithTiming, options.format || 'text', reportGenerator);
      }

      // Log summary
      logger.info('Test gap analysis completed', {
        totalFiles: gapAnalysis.summary.totalFiles,
        filesNeedingLogicalTests: gapAnalysis.summary.filesNeedingLogicalTests,
        totalGaps: gapAnalysis.summary.totalGaps,
        estimatedCost: gapAnalysis.estimatedCost.estimatedCostUSD,
        overallAssessment: gapAnalysis.summary.overallAssessment,
        duration
      });

      // Exit with appropriate code
      if (gapAnalysis.summary.overallAssessment === 'poor') {
        process.exit(2); // Indicates significant gaps found
      } else if (gapAnalysis.summary.filesNeedingLogicalTests > 0) {
        process.exit(1); // Indicates some gaps found
      }
      // Exit 0 for excellent/good assessments

    } catch (error) {
      logger.error('Gap analysis failed', { 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      process.exit(1);
    }
  });

async function outputResults(
  analysis: any, 
  outputPath: string, 
  format: string, 
  reportGenerator: GapReportGenerator
): Promise<void> {
  const outputDir = path.dirname(outputPath);
  
  try {
    await fs.mkdir(outputDir, { recursive: true });
  } catch (error) {
    // Directory might already exist
  }

  let content: string;
  switch (format) {
    case 'json':
      content = reportGenerator.generateJsonReport(analysis);
      break;
    case 'markdown':
      content = reportGenerator.generateMarkdownReport(analysis);
      break;
    case 'text':
      content = reportGenerator.generateTextReport(analysis);
      break;
    default:
      throw new Error(`Unsupported output format: ${format}`);
  }

  await fs.writeFile(outputPath, content);
}

function outputToConsole(analysis: any, format: string, reportGenerator: GapReportGenerator): void {
  switch (format) {
    case 'json':
      console.log(reportGenerator.generateJsonReport(analysis));
      break;
    case 'markdown':
      console.log(reportGenerator.generateMarkdownReport(analysis));
      break;
    case 'text':
    default:
      console.log(reportGenerator.generateTerminalReport(analysis));
      break;
  }
}

