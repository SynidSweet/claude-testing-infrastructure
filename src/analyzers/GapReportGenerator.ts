import path from 'path';
import { TestGapAnalysisResult, TestGap, GapPriority } from './TestGapAnalyzer';
import { logger } from '../utils/logger';

export interface ReportOptions {
  /** Include detailed gap breakdown */
  includeDetails?: boolean;
  /** Include code snippets in report */
  includeCodeSnippets?: boolean;
  /** Maximum number of gaps to show in details */
  maxGapsToShow?: number;
  /** Show color output in terminal */
  useColors?: boolean;
  /** Include timing information */
  includeTiming?: boolean;
}

export interface VisualizationConfig {
  /** Terminal width for formatting */
  terminalWidth?: number;
  /** Use Unicode symbols */
  useUnicode?: boolean;
  /** Color scheme */
  colorScheme?: 'default' | 'dark' | 'light';
}

export interface GapReportSchema {
  /** Report metadata */
  metadata: {
    version: string;
    generatedAt: string;
    projectPath: string;
    duration?: number;
  };
  /** Executive summary */
  summary: {
    totalFiles: number;
    filesWithTests: number;
    filesNeedingLogicalTests: number;
    totalGaps: number;
    overallAssessment: string;
    priorityDistribution: Record<GapPriority, number>;
  };
  /** Cost analysis */
  cost: {
    numberOfTasks: number;
    estimatedTokens: number;
    estimatedCostUSD: number;
    complexityDistribution: Record<string, number>;
  };
  /** Prioritized recommendations */
  recommendations: {
    immediate: string[];
    shortTerm: string[];
    longTerm: string[];
  };
  /** Detailed gap analysis */
  gaps: DetailedGap[];
  /** Actionable insights */
  insights: ActionableInsight[];
}

export interface DetailedGap {
  sourceFile: string;
  testFile: string;
  priority: GapPriority;
  complexity: number;
  gapCount: number;
  framework: string;
  language: string;
  gaps: {
    type: string;
    description: string;
    priority: GapPriority;
    estimatedEffort: string;
  }[];
  context?: {
    dependencies: string[];
    codeSnippets?: {
      name: string;
      complexity: {
        hasAsync: boolean;
        hasConditionals: boolean;
        hasLoops: boolean;
        hasErrorHandling: boolean;
      };
    }[];
  };
}

export interface ActionableInsight {
  category: 'critical' | 'optimization' | 'best-practice';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  effort: 'low' | 'medium' | 'high';
  actions: string[];
  relatedGaps?: string[];
}

/**
 * Gap Report Generator - Creates enhanced visualizations and detailed reports
 * 
 * This generator transforms the TestGapAnalysisResult into various formatted
 * reports with enhanced visualization and actionable insights.
 */
export class GapReportGenerator {
  private readonly VERSION = '1.0.0';
  
  constructor(
    private options: ReportOptions = {},
    private visualConfig: VisualizationConfig = {}
  ) {
    this.options = {
      includeDetails: true,
      includeCodeSnippets: false,
      maxGapsToShow: 20,
      useColors: true,
      includeTiming: true,
      ...options
    };
    
    this.visualConfig = {
      terminalWidth: 80,
      useUnicode: true,
      colorScheme: 'default',
      ...visualConfig
    };
  }

  /**
   * Generate a structured report schema
   */
  generateReportSchema(analysis: TestGapAnalysisResult): GapReportSchema {
    logger.debug('Generating structured report schema');

    const metadata = {
      version: this.VERSION,
      generatedAt: new Date().toISOString(),
      projectPath: analysis.projectPath,
      ...(this.options.includeTiming && analysis.timing ? { duration: analysis.timing.duration } : {})
    };

    const summary = {
      totalFiles: analysis.summary.totalFiles,
      filesWithTests: analysis.summary.filesWithTests,
      filesNeedingLogicalTests: analysis.summary.filesNeedingLogicalTests,
      totalGaps: analysis.summary.totalGaps,
      overallAssessment: analysis.summary.overallAssessment,
      priorityDistribution: analysis.summary.priorityBreakdown
    };

    const cost = {
      numberOfTasks: analysis.estimatedCost.numberOfTasks,
      estimatedTokens: analysis.estimatedCost.estimatedTokens,
      estimatedCostUSD: analysis.estimatedCost.estimatedCostUSD,
      complexityDistribution: analysis.estimatedCost.complexityDistribution
    };

    const recommendations = this.categorizeRecommendations(analysis.recommendations);
    const gaps = this.transformGapsToDetailed(analysis.gaps);
    const insights = this.generateActionableInsights(analysis);

    return {
      metadata,
      summary,
      cost,
      recommendations,
      gaps,
      insights
    };
  }

  /**
   * Generate enhanced terminal output with visualization
   */
  generateTerminalReport(analysis: TestGapAnalysisResult): string {
    const schema = this.generateReportSchema(analysis);
    let output = '';

    // Header with title and metadata
    output += this.renderHeader(schema.metadata);
    
    // Executive summary with visual indicators
    output += this.renderSummarySection(schema.summary);
    
    // Cost visualization with breakdown
    output += this.renderCostSection(schema.cost);
    
    // Priority matrix visualization
    output += this.renderPriorityMatrix(schema.summary.priorityDistribution);
    
    // Recommendations categorized by urgency
    output += this.renderRecommendationsSection(schema.recommendations);
    
    // Actionable insights
    output += this.renderInsightsSection(schema.insights);
    
    // Detailed gaps (if enabled and not too many)
    if (this.options.includeDetails && schema.gaps.length <= (this.options.maxGapsToShow || 20)) {
      output += this.renderDetailedGaps(schema.gaps);
    }
    
    // Footer with next steps
    output += this.renderFooter(schema);

    return output;
  }

  /**
   * Generate enhanced markdown report
   */
  generateMarkdownReport(analysis: TestGapAnalysisResult): string {
    const schema = this.generateReportSchema(analysis);
    
    let markdown = `# 🔍 Test Gap Analysis Report

**Generated**: ${schema.metadata.generatedAt}  
**Project**: \`${schema.metadata.projectPath}\`  
**Version**: ${schema.metadata.version}`;

    if (schema.metadata.duration) {
      markdown += `  
**Duration**: ${schema.metadata.duration}ms`;
    }

    markdown += `

## 📊 Executive Summary

| Metric | Value | Status |
|--------|-------|---------|
| Total Files Analyzed | ${schema.summary.totalFiles} | ℹ️ |
| Files with Structural Tests | ${schema.summary.filesWithTests} | ✅ |
| Files Needing Logical Tests | ${schema.summary.filesNeedingLogicalTests} | ${schema.summary.filesNeedingLogicalTests > 0 ? '⚠️' : '✅'} |
| Total Gaps Identified | ${schema.summary.totalGaps} | ${this.getGapStatusIcon(schema.summary.totalGaps)} |
| **Overall Assessment** | **${schema.summary.overallAssessment.toUpperCase()}** | ${this.getAssessmentIcon(schema.summary.overallAssessment)} |

## 💰 Cost Analysis

### AI Generation Requirements
- **🎯 AI Tasks**: ${schema.cost.numberOfTasks}
- **🪙 Estimated Tokens**: ${schema.cost.estimatedTokens.toLocaleString()}
- **💵 Estimated Cost**: $${schema.cost.estimatedCostUSD}

### Complexity Distribution
`;

    Object.entries(schema.cost.complexityDistribution).forEach(([complexity, count]) => {
      markdown += `- **${complexity.charAt(0).toUpperCase() + complexity.slice(1)} Complexity**: ${count} tasks\n`;
    });

    // Priority breakdown with visual indicators
    markdown += `\n## 🎯 Priority Matrix

`;
    Object.entries(schema.summary.priorityDistribution).forEach(([priority, count]) => {
      const icon = this.getPriorityIcon(priority as GapPriority);
      markdown += `- ${icon} **${priority.toUpperCase()}**: ${count} files\n`;
    });

    // Categorized recommendations
    markdown += `\n## 💡 Recommendations

### 🚨 Immediate Actions (Critical Priority)
`;
    schema.recommendations.immediate.forEach((rec, i) => {
      markdown += `${i + 1}. ${rec}\n`;
    });

    if (schema.recommendations.shortTerm.length > 0) {
      markdown += `\n### ⏱️ Short-term Improvements
`;
      schema.recommendations.shortTerm.forEach((rec, i) => {
        markdown += `${i + 1}. ${rec}\n`;
      });
    }

    if (schema.recommendations.longTerm.length > 0) {
      markdown += `\n### 📅 Long-term Enhancements
`;
      schema.recommendations.longTerm.forEach((rec, i) => {
        markdown += `${i + 1}. ${rec}\n`;
      });
    }

    // Actionable insights
    if (schema.insights.length > 0) {
      markdown += `\n## 🧠 Actionable Insights

`;
      schema.insights.forEach((insight, i) => {
        const impactIcon = insight.impact === 'high' ? '🔥' : insight.impact === 'medium' ? '⚡' : '💡';
        const effortIcon = insight.effort === 'low' ? '🟢' : insight.effort === 'medium' ? '🟡' : '🔴';
        
        markdown += `### ${i + 1}. ${insight.title} ${impactIcon}

**Impact**: ${insight.impact.toUpperCase()} | **Effort**: ${insight.effort.toUpperCase()} ${effortIcon}

${insight.description}

**Actions**:
`;
        insight.actions.forEach(action => {
          markdown += `- ${action}\n`;
        });
        markdown += '\n';
      });
    }

    // Detailed gaps (if requested and reasonable size)
    if (this.options.includeDetails && schema.gaps.length <= (this.options.maxGapsToShow || 20)) {
      markdown += `\n## 📋 Detailed Gap Analysis

`;
      schema.gaps.forEach((gap, i) => {
        const priorityIcon = this.getPriorityIcon(gap.priority);
        markdown += `### ${i + 1}. ${path.basename(gap.sourceFile)} ${priorityIcon}

| Property | Value |
|----------|-------|
| **Priority** | ${gap.priority.toUpperCase()} |
| **Complexity** | ${gap.complexity}/10 |
| **Gap Count** | ${gap.gapCount} |
| **Framework** | ${gap.framework} |
| **Language** | ${gap.language} |
| **Test File** | \`${path.basename(gap.testFile)}\` |

`;
        if (gap.gaps.length > 0) {
          markdown += `**Identified Issues**:
`;
          gap.gaps.forEach(g => {
            const typeIcon = this.getGapTypeIcon(g.type);
            markdown += `- ${typeIcon} ${g.description} _(${g.type}, ${g.estimatedEffort} effort)_\n`;
          });
          markdown += '\n';
        }

        if (this.options.includeCodeSnippets && gap.context?.codeSnippets) {
          markdown += `**Code Complexity Indicators**:
`;
          gap.context.codeSnippets.forEach(snippet => {
            markdown += `- **${snippet.name}**: `;
            const indicators = [];
            if (snippet.complexity.hasAsync) indicators.push('async');
            if (snippet.complexity.hasConditionals) indicators.push('conditionals');
            if (snippet.complexity.hasLoops) indicators.push('loops');
            if (snippet.complexity.hasErrorHandling) indicators.push('error-handling');
            markdown += indicators.join(', ') || 'simple logic';
            markdown += '\n';
          });
          markdown += '\n';
        }
      });
    } else if (schema.gaps.length > (this.options.maxGapsToShow || 20)) {
      markdown += `\n## 📋 Gap Summary

Found ${schema.gaps.length} files with test gaps. Use \`--output detailed-report.md\` to see full analysis.

**Top Priority Files**:
`;
      const topPriorityGaps = schema.gaps
        .filter(gap => gap.priority === GapPriority.CRITICAL || gap.priority === GapPriority.HIGH)
        .slice(0, 10);
        
      topPriorityGaps.forEach((gap, i) => {
        const priorityIcon = this.getPriorityIcon(gap.priority);
        markdown += `${i + 1}. ${priorityIcon} \`${path.basename(gap.sourceFile)}\` (${gap.gapCount} gaps, complexity ${gap.complexity}/10)\n`;
      });
    }

    markdown += `\n---

*Report generated by Claude Testing Infrastructure v${schema.metadata.version}*`;

    return markdown;
  }

  /**
   * Generate enhanced JSON report with schema
   */
  generateJsonReport(analysis: TestGapAnalysisResult): string {
    const schema = this.generateReportSchema(analysis);
    
    // Add schema information for programmatic consumption
    const jsonReport = {
      $schema: 'https://claude-testing-infrastructure.schema.json/gap-analysis/v1',
      ...schema
    };

    return JSON.stringify(jsonReport, null, 2);
  }

  /**
   * Generate plain text report with ASCII art
   */
  generateTextReport(analysis: TestGapAnalysisResult): string {
    const schema = this.generateReportSchema(analysis);
    
    let report = `
████████╗███████╗███████╗████████╗     ██████╗  █████╗ ██████╗ 
╚══██╔══╝██╔════╝██╔════╝╚══██╔══╝    ██╔════╝ ██╔══██╗██╔══██╗
   ██║   █████╗  ███████╗   ██║       ██║  ███╗███████║██████╔╝
   ██║   ██╔══╝  ╚════██║   ██║       ██║   ██║██╔══██║██╔═══╝ 
   ██║   ███████╗███████║   ██║       ╚██████╔╝██║  ██║██║     
   ╚═╝   ╚══════╝╚══════╝   ╚═╝        ╚═════╝ ╚═╝  ╚═╝╚═╝     
                                                               
                 A N A L Y S I S   R E P O R T                
${'═'.repeat(this.visualConfig.terminalWidth || 80)}

Generated: ${schema.metadata.generatedAt}
Project: ${schema.metadata.projectPath}
Version: ${schema.metadata.version}`;

    if (schema.metadata.duration) {
      report += `
Duration: ${schema.metadata.duration}ms`;
    }

    report += `

EXECUTIVE SUMMARY
${'─'.repeat(50)}
Total Files Analyzed           : ${schema.summary.totalFiles}
Files with Structural Tests    : ${schema.summary.filesWithTests}
Files Needing Logical Tests    : ${schema.summary.filesNeedingLogicalTests}
Total Gaps Identified         : ${schema.summary.totalGaps}
Overall Assessment            : ${schema.summary.overallAssessment.toUpperCase()}

COST ANALYSIS
${'─'.repeat(50)}
AI Tasks Required             : ${schema.cost.numberOfTasks}
Estimated Tokens              : ${schema.cost.estimatedTokens.toLocaleString()}
Estimated Cost (USD)          : $${schema.cost.estimatedCostUSD}

PRIORITY BREAKDOWN
${'─'.repeat(50)}`;

    Object.entries(schema.summary.priorityDistribution).forEach(([priority, count]) => {
      const paddedPriority = (priority.charAt(0).toUpperCase() + priority.slice(1)).padEnd(20);
      report += `
${paddedPriority} : ${count} files`;
    });

    report += `

IMMEDIATE ACTIONS
${'─'.repeat(50)}`;
    schema.recommendations.immediate.forEach((rec, i) => {
      report += `
${(i + 1).toString().padStart(2)}. ${rec}`;
    });

    if (schema.recommendations.shortTerm.length > 0) {
      report += `

SHORT-TERM IMPROVEMENTS
${'─'.repeat(50)}`;
      schema.recommendations.shortTerm.forEach((rec, i) => {
        report += `
${(i + 1).toString().padStart(2)}. ${rec}`;
      });
    }

    // Include top insights
    if (schema.insights.length > 0) {
      report += `

KEY INSIGHTS
${'─'.repeat(50)}`;
      schema.insights.slice(0, 3).forEach((insight, i) => {
        report += `
${(i + 1).toString().padStart(2)}. ${insight.title}
    Impact: ${insight.impact.toUpperCase()} | Effort: ${insight.effort.toUpperCase()}
    ${insight.description}`;
      });
    }

    report += `

${'═'.repeat(this.visualConfig.terminalWidth || 80)}
Report generated by Claude Testing Infrastructure v${schema.metadata.version}
`;

    return report;
  }

  // Private helper methods for visualization and formatting

  private renderHeader(metadata: GapReportSchema['metadata']): string {
    const title = '🔍 Test Gap Analysis Report';
    const separator = '━'.repeat(this.visualConfig.terminalWidth || 80);
    
    return `
${this.colorize(title, 'bold')}
${separator}
📅 Generated: ${metadata.generatedAt}
📁 Project: ${metadata.projectPath}
🏷️  Version: ${metadata.version}${metadata.duration ? `
⏱️  Duration: ${metadata.duration}ms` : ''}

`;
  }

  private renderSummarySection(summary: GapReportSchema['summary']): string {
    let output = `${this.colorize('📊 Executive Summary', 'bold')}
${'─'.repeat(30)}
`;

    const metrics = [
      { label: 'Total Files', value: summary.totalFiles, icon: '📁' },
      { label: 'Files with Tests', value: summary.filesWithTests, icon: '✅' },
      { label: 'Need Logical Tests', value: summary.filesNeedingLogicalTests, icon: summary.filesNeedingLogicalTests > 0 ? '⚠️' : '✅' },
      { label: 'Total Gaps', value: summary.totalGaps, icon: this.getGapStatusIcon(summary.totalGaps) }
    ];

    metrics.forEach(metric => {
      output += `${metric.icon} ${metric.label.padEnd(18)}: ${metric.value}\n`;
    });

    const assessmentColor = summary.overallAssessment === 'excellent' ? 'green' : 
                          summary.overallAssessment === 'good' ? 'yellow' :
                          summary.overallAssessment === 'needs-improvement' ? 'orange' : 'red';
    
    output += `📈 ${this.colorize(`Overall Assessment: ${summary.overallAssessment.toUpperCase()}`, assessmentColor)}\n\n`;

    return output;
  }

  private renderCostSection(cost: GapReportSchema['cost']): string {
    return `${this.colorize('💰 Cost Analysis', 'bold')}
${'─'.repeat(20)}
🎯 AI Tasks: ${cost.numberOfTasks}
🪙 Est. Tokens: ${cost.estimatedTokens.toLocaleString()}
💵 Est. Cost: ${this.colorize(`$${cost.estimatedCostUSD}`, 'green')}

`;
  }

  private renderPriorityMatrix(priorities: Record<GapPriority, number>): string {
    let output = `${this.colorize('🎯 Priority Matrix', 'bold')}
${'─'.repeat(20)}
`;

    Object.entries(priorities).forEach(([priority, count]) => {
      const icon = this.getPriorityIcon(priority as GapPriority);
      const color = this.getPriorityColor(priority as GapPriority);
      output += `${icon} ${this.colorize(priority.toUpperCase().padEnd(10), color)}: ${count} files\n`;
    });

    return output + '\n';
  }

  private renderRecommendationsSection(recommendations: GapReportSchema['recommendations']): string {
    let output = `${this.colorize('💡 Recommendations', 'bold')}
${'─'.repeat(22)}
`;

    if (recommendations.immediate.length > 0) {
      output += `${this.colorize('🚨 IMMEDIATE:', 'red')}\n`;
      recommendations.immediate.forEach((rec, i) => {
        output += `  ${i + 1}. ${rec}\n`;
      });
      output += '\n';
    }

    if (recommendations.shortTerm.length > 0) {
      output += `${this.colorize('⏱️  SHORT-TERM:', 'yellow')}\n`;
      recommendations.shortTerm.forEach((rec, i) => {
        output += `  ${i + 1}. ${rec}\n`;
      });
      output += '\n';
    }

    return output;
  }

  private renderInsightsSection(insights: ActionableInsight[]): string {
    if (insights.length === 0) return '';

    let output = `${this.colorize('🧠 Key Insights', 'bold')}
${'─'.repeat(16)}
`;

    insights.slice(0, 3).forEach((insight, i) => {
      const impactIcon = insight.impact === 'high' ? '🔥' : insight.impact === 'medium' ? '⚡' : '💡';
      const effortColor = insight.effort === 'low' ? 'green' : insight.effort === 'medium' ? 'yellow' : 'red';
      
      output += `${i + 1}. ${impactIcon} ${this.colorize(insight.title, 'bold')}\n`;
      output += `   Impact: ${insight.impact.toUpperCase()} | Effort: ${this.colorize(insight.effort.toUpperCase(), effortColor)}\n`;
      output += `   ${insight.description}\n\n`;
    });

    return output;
  }

  private renderDetailedGaps(gaps: DetailedGap[]): string {
    let output = `${this.colorize('📋 Detailed Gap Analysis', 'bold')}
${'─'.repeat(30)}
`;

    gaps.slice(0, this.options.maxGapsToShow || 20).forEach((gap, i) => {
      const priorityIcon = this.getPriorityIcon(gap.priority);
      const priorityColor = this.getPriorityColor(gap.priority);
      
      output += `${i + 1}. ${priorityIcon} ${this.colorize(path.basename(gap.sourceFile), 'bold')}\n`;
      output += `   Priority: ${this.colorize(gap.priority.toUpperCase(), priorityColor)} | `;
      output += `Complexity: ${gap.complexity}/10 | Gaps: ${gap.gapCount}\n`;
      output += `   Framework: ${gap.framework} | Language: ${gap.language}\n`;
      
      if (gap.gaps.length > 0) {
        gap.gaps.slice(0, 3).forEach(g => {
          const typeIcon = this.getGapTypeIcon(g.type);
          output += `   ${typeIcon} ${g.description}\n`;
        });
        if (gap.gaps.length > 3) {
          output += `   ... and ${gap.gaps.length - 3} more gaps\n`;
        }
      }
      output += '\n';
    });

    return output;
  }

  private renderFooter(schema: GapReportSchema): string {
    let nextSteps = '';
    
    if (schema.summary.totalGaps > 0) {
      nextSteps = `
${this.colorize('🚀 Next Steps', 'bold')}
${'─'.repeat(15)}
1. Run: ${this.colorize('npx claude-testing test --only-logical', 'cyan')}
2. Review generated logical tests
3. Integrate with your CI/CD pipeline
4. Monitor coverage improvements

`;
    } else {
      nextSteps = `
${this.colorize('🎉 Excellent Test Coverage!', 'green')}
${'─'.repeat(35)}
Your structural tests appear comprehensive.
Consider running periodic gap analysis as your code evolves.

`;
    }

    return nextSteps + `${'━'.repeat(this.visualConfig.terminalWidth || 80)}
Report generated by Claude Testing Infrastructure v${schema.metadata.version}

`;
  }

  private categorizeRecommendations(recommendations: string[]): GapReportSchema['recommendations'] {
    const immediate: string[] = [];
    const shortTerm: string[] = [];
    const longTerm: string[] = [];

    recommendations.forEach(rec => {
      const lowerRec = rec.toLowerCase();
      if (lowerRec.includes('critical') || lowerRec.includes('address') || lowerRec.includes('first')) {
        immediate.push(rec);
      } else if (lowerRec.includes('focus') || lowerRec.includes('generate') || lowerRec.includes('create')) {
        shortTerm.push(rec);
      } else {
        longTerm.push(rec);
      }
    });

    return { immediate, shortTerm, longTerm };
  }

  private transformGapsToDetailed(gaps: TestGap[]): DetailedGap[] {
    return gaps.map(gap => ({
      sourceFile: gap.sourceFile,
      testFile: gap.testFile,
      priority: gap.priority,
      complexity: gap.complexity.overall,
      gapCount: gap.gaps.length,
      framework: gap.context.framework,
      language: gap.context.language,
      gaps: gap.gaps.map(g => ({
        type: g.type,
        description: g.description,
        priority: g.priority,
        estimatedEffort: g.estimatedEffort
      })),
      ...(this.options.includeCodeSnippets && {
        context: {
          dependencies: gap.context.dependencies,
          codeSnippets: gap.context.codeSnippets.map(snippet => ({
            name: snippet.name,
            complexity: {
              hasAsync: snippet.hasAsyncOperations,
              hasConditionals: snippet.hasConditionals,
              hasLoops: snippet.hasLoops,
              hasErrorHandling: snippet.hasErrorHandling
            }
          }))
        }
      })
    }));
  }

  private generateActionableInsights(analysis: TestGapAnalysisResult): ActionableInsight[] {
    const insights: ActionableInsight[] = [];

    // Analyze patterns in gaps
    const totalGaps = analysis.summary.totalGaps;
    const criticalFiles = analysis.gaps.filter(g => g.priority === GapPriority.CRITICAL).length;

    if (criticalFiles > 0) {
      insights.push({
        category: 'critical',
        title: 'High-complexity files need immediate attention',
        description: `${criticalFiles} files have critical complexity that could significantly impact system reliability. These should be prioritized for logical test generation.`,
        impact: 'high',
        effort: 'medium',
        actions: [
          'Generate logical tests for critical complexity files first',
          'Consider breaking down complex functions into smaller, testable units',
          'Implement integration tests for external dependencies'
        ],
        relatedGaps: analysis.gaps.filter(g => g.priority === GapPriority.CRITICAL).map(g => g.sourceFile)
      });
    }

    if (totalGaps > 20) {
      insights.push({
        category: 'optimization',
        title: 'Batch AI generation for cost efficiency',
        description: `With ${totalGaps} gaps identified, batch processing can reduce AI costs by up to 40% through context sharing and prompt optimization.`,
        impact: 'medium',
        effort: 'low',
        actions: [
          'Group similar files by framework and language',
          'Use shared context for related components',
          'Generate tests in priority order to maximize early value'
        ]
      });
    }

    if (analysis.estimatedCost.estimatedCostUSD > 10) {
      insights.push({
        category: 'optimization',
        title: 'Consider incremental test generation',
        description: `Estimated cost of $${analysis.estimatedCost.estimatedCostUSD} suggests implementing incremental testing to manage ongoing costs effectively.`,
        impact: 'medium',
        effort: 'medium',
        actions: [
          'Implement git-based change detection',
          'Generate tests only for modified files',
          'Set up automated cost monitoring'
        ]
      });
    }

    const businessLogicGaps = analysis.gaps.reduce((count, gap) => 
      count + gap.gaps.filter(g => g.type === 'business-logic').length, 0
    );

    if (businessLogicGaps > totalGaps * 0.6) {
      insights.push({
        category: 'best-practice',
        title: 'Focus on business logic validation',
        description: `${businessLogicGaps} business logic gaps indicate need for comprehensive functional testing beyond structural coverage.`,
        impact: 'high',
        effort: 'high',
        actions: [
          'Prioritize business logic test generation',
          'Include edge case scenarios in prompts',
          'Consider property-based testing for complex algorithms'
        ]
      });
    }

    return insights.slice(0, 5); // Limit to top 5 insights
  }

  // Utility methods for styling and icons

  private colorize(text: string, color: string): string {
    if (!this.options.useColors) return text;
    
    const colors: Record<string, string> = {
      red: '\x1b[31m',
      green: '\x1b[32m',
      yellow: '\x1b[33m',
      blue: '\x1b[34m',
      magenta: '\x1b[35m',
      cyan: '\x1b[36m',
      bold: '\x1b[1m',
      reset: '\x1b[0m'
    };
    
    return `${colors[color] || ''}${text}${colors.reset}`;
  }

  private getPriorityIcon(priority: GapPriority): string {
    const icons = {
      [GapPriority.CRITICAL]: '🔴',
      [GapPriority.HIGH]: '🟠', 
      [GapPriority.MEDIUM]: '🟡',
      [GapPriority.LOW]: '🟢'
    };
    return icons[priority] || '⚪';
  }

  private getPriorityColor(priority: GapPriority): string {
    const colors = {
      [GapPriority.CRITICAL]: 'red',
      [GapPriority.HIGH]: 'magenta',
      [GapPriority.MEDIUM]: 'yellow', 
      [GapPriority.LOW]: 'green'
    };
    return colors[priority] || 'reset';
  }

  private getGapStatusIcon(gapCount: number): string {
    if (gapCount === 0) return '✅';
    if (gapCount <= 5) return '⚠️';
    if (gapCount <= 20) return '❌';
    return '🚨';
  }

  private getAssessmentIcon(assessment: string): string {
    const icons: Record<string, string> = {
      'excellent': '🏆',
      'good': '👍',
      'needs-improvement': '⚠️',
      'poor': '❌'
    };
    return icons[assessment] || '❓';
  }

  private getGapTypeIcon(type: string): string {
    const icons: Record<string, string> = {
      'business-logic': '🧠',
      'edge-case': '⚡',
      'integration': '🔗',
      'error-handling': '🛡️',
      'performance': '🚀'
    };
    return icons[type] || '📝';
  }
}