import { path } from '../../utils/common-imports';
import { GapPriority } from '../TestGapAnalyzer';
import type {
  GapReportSchema,
  ActionableInsight,
  ReportOptions,
  VisualizationConfig,
} from '../GapReportGenerator';

/**
 * Terminal Report Generator - Creates enhanced terminal output with visualization
 *
 * Focused class responsible for generating colorized terminal reports
 * with visual indicators and formatted output.
 */
export class TerminalReportGenerator {
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
      ...options,
    };

    this.visualConfig = {
      terminalWidth: 80,
      useUnicode: true,
      colorScheme: 'default',
      ...visualConfig,
    };
  }

  /**
   * Generate enhanced terminal output with visualization
   */
  generateTerminalReport(schema: GapReportSchema): string {
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

  // Private rendering methods for terminal-specific formatting

  private renderHeader(metadata: GapReportSchema['metadata']): string {
    const title = '🔍 Test Gap Analysis Report';
    const separator = '━'.repeat(this.visualConfig.terminalWidth || 80);

    return `
${this.colorize(title, 'bold')}
${separator}
📅 Generated: ${metadata.generatedAt}
📁 Project: ${metadata.projectPath}
🏷️  Version: ${metadata.version}${
      metadata.duration
        ? `
⏱️  Duration: ${metadata.duration}ms`
        : ''
    }

`;
  }

  private renderSummarySection(summary: GapReportSchema['summary']): string {
    let output = `${this.colorize('📊 Executive Summary', 'bold')}
${'─'.repeat(30)}
`;

    const metrics = [
      { label: 'Total Files', value: summary.totalFiles, icon: '📁' },
      { label: 'Files with Tests', value: summary.filesWithTests, icon: '✅' },
      {
        label: 'Need Logical Tests',
        value: summary.filesNeedingLogicalTests,
        icon: summary.filesNeedingLogicalTests > 0 ? '⚠️' : '✅',
      },
      {
        label: 'Total Gaps',
        value: summary.totalGaps,
        icon: this.getGapStatusIcon(summary.totalGaps),
      },
    ];

    metrics.forEach((metric) => {
      output += `${metric.icon} ${metric.label.padEnd(18)}: ${metric.value}\n`;
    });

    const assessmentColor =
      summary.overallAssessment === 'excellent'
        ? 'green'
        : summary.overallAssessment === 'good'
          ? 'yellow'
          : summary.overallAssessment === 'needs-improvement'
            ? 'yellow'
            : 'red';

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

  private renderRecommendationsSection(
    recommendations: GapReportSchema['recommendations']
  ): string {
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
      const impactIcon =
        insight.impact === 'high' ? '🔥' : insight.impact === 'medium' ? '⚡' : '💡';
      const effortColor =
        insight.effort === 'low' ? 'green' : insight.effort === 'medium' ? 'yellow' : 'red';

      output += `${i + 1}. ${impactIcon} ${this.colorize(insight.title, 'bold')}\n`;
      output += `   Impact: ${insight.impact.toUpperCase()} | Effort: ${this.colorize(insight.effort.toUpperCase(), effortColor)}\n`;
      output += `   ${insight.description}\n\n`;
    });

    return output;
  }

  private renderDetailedGaps(gaps: GapReportSchema['gaps']): string {
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
        gap.gaps.slice(0, 3).forEach((g) => {
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
1. Run: ${this.colorize('node dist/src/cli/index.js test --only-logical', 'cyan')}
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

    return (
      nextSteps +
      `${'━'.repeat(this.visualConfig.terminalWidth || 80)}
Report generated by Claude Testing Infrastructure v${schema.metadata.version}

`
    );
  }

  // Utility methods for terminal styling and icons

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
      reset: '\x1b[0m',
    };

    return `${colors[color] || ''}${text}${colors.reset}`;
  }

  private getPriorityIcon(priority: GapPriority): string {
    const icons = {
      [GapPriority.CRITICAL]: '🔴',
      [GapPriority.HIGH]: '🟠',
      [GapPriority.MEDIUM]: '🟡',
      [GapPriority.LOW]: '🟢',
    };
    return icons[priority] || '⚪';
  }

  private getPriorityColor(priority: GapPriority): string {
    const colors = {
      [GapPriority.CRITICAL]: 'red',
      [GapPriority.HIGH]: 'magenta',
      [GapPriority.MEDIUM]: 'yellow',
      [GapPriority.LOW]: 'green',
    };
    return colors[priority] || 'reset';
  }

  private getGapStatusIcon(gapCount: number): string {
    if (gapCount === 0) return '✅';
    if (gapCount <= 5) return '⚠️';
    if (gapCount <= 20) return '❌';
    return '🚨';
  }

  private getGapTypeIcon(type: string): string {
    const icons: Record<string, string> = {
      'business-logic': '🧠',
      'edge-case': '⚡',
      integration: '🔗',
      'error-handling': '🛡️',
      performance: '🚀',
    };
    return icons[type] || '📝';
  }
}
