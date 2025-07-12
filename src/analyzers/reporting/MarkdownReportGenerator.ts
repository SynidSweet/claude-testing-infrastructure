import { path } from '../../utils/common-imports';
import { GapPriority } from '../TestGapAnalyzer';
import type { GapReportSchema, ReportOptions } from '../GapReportGenerator';

/**
 * Markdown Report Generator - Creates enhanced markdown reports
 *
 * Focused class responsible for generating comprehensive markdown reports
 * with visual indicators, tables, and detailed gap analysis.
 */
export class MarkdownReportGenerator {
  constructor(private options: ReportOptions = {}) {}

  /**
   * Generate enhanced markdown report
   */
  generateMarkdownReport(schema: GapReportSchema): string {
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
        const impactIcon =
          insight.impact === 'high' ? '🔥' : insight.impact === 'medium' ? '⚡' : '💡';
        const effortIcon =
          insight.effort === 'low' ? '🟢' : insight.effort === 'medium' ? '🟡' : '🔴';

        markdown += `### ${i + 1}. ${insight.title} ${impactIcon}

**Impact**: ${insight.impact.toUpperCase()} | **Effort**: ${insight.effort.toUpperCase()} ${effortIcon}

${insight.description}

**Actions**:
`;
        insight.actions.forEach((action) => {
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
          gap.gaps.forEach((g) => {
            const typeIcon = this.getGapTypeIcon(g.type);
            markdown += `- ${typeIcon} ${g.description} _(${g.type}, ${g.estimatedEffort} effort)_\n`;
          });
          markdown += '\n';
        }

        if (this.options.includeCodeSnippets && gap.context?.codeSnippets) {
          markdown += `**Code Complexity Indicators**:
`;
          gap.context.codeSnippets.forEach((snippet) => {
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
        .filter((gap) => gap.priority === GapPriority.CRITICAL || gap.priority === GapPriority.HIGH)
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

  // Private helper methods for markdown-specific formatting

  private getPriorityIcon(priority: GapPriority): string {
    const icons = {
      [GapPriority.CRITICAL]: '🔴',
      [GapPriority.HIGH]: '🟠',
      [GapPriority.MEDIUM]: '🟡',
      [GapPriority.LOW]: '🟢',
    };
    return icons[priority] || '⚪';
  }

  private getGapStatusIcon(gapCount: number): string {
    if (gapCount === 0) return '✅';
    if (gapCount <= 5) return '⚠️';
    if (gapCount <= 20) return '❌';
    return '🚨';
  }

  private getAssessmentIcon(assessment: string): string {
    const icons: Record<string, string> = {
      excellent: '🏆',
      good: '👍',
      'needs-improvement': '⚠️',
      poor: '❌',
    };
    return icons[assessment] || '❓';
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
