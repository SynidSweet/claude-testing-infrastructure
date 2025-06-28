import chalk from 'chalk';
import ora from 'ora';
import { logger } from '../../utils/logger';
import { ProjectAnalyzer } from '../../analyzers/ProjectAnalyzer';

interface AnalyzeOptions {
  output?: string;
  format?: 'json' | 'markdown' | 'console';
  verbose?: boolean;
}

export async function analyzeCommand(projectPath: string, options: AnalyzeOptions = {}): Promise<void> {
  const spinner = ora('Analyzing project...').start();
  
  try {
    logger.info(`Starting analysis of project: ${projectPath}`);
    
    const analyzer = new ProjectAnalyzer(projectPath);
    const analysis = await analyzer.analyze();
    
    spinner.succeed('Analysis complete');
    
    // Format and display results
    if (options.format === 'json') {
      const output = JSON.stringify(analysis, null, 2);
      console.log(output);
      
      if (options.output) {
        const fs = await import('fs/promises');
        await fs.writeFile(options.output, output);
        console.log(chalk.green(`\n✓ Analysis saved to ${options.output}`));
      }
    } else if (options.format === 'markdown') {
      const markdown = formatAsMarkdown(analysis);
      console.log(markdown);
      
      if (options.output) {
        const fs = await import('fs/promises');
        await fs.writeFile(options.output, markdown);
        console.log(chalk.green(`\n✓ Analysis saved to ${options.output}`));
      }
    } else {
      // Console format (default)
      displayConsoleResults(analysis, options.verbose);
    }
    
  } catch (error) {
    spinner.fail('Analysis failed');
    logger.error('Analysis error:', error);
    process.exit(1);
  }
}

function displayConsoleResults(analysis: any, verbose = false): void {
  console.log(chalk.green('\n✓ Project Analysis Complete\n'));
  
  // Project path
  console.log(chalk.cyan('📁 Project:'), analysis.projectPath);
  
  // Languages
  if (analysis.languages.length > 0) {
    console.log(chalk.cyan('\n🔤 Languages:'));
    analysis.languages.forEach((lang: any) => {
      console.log(`  • ${lang.name} (${Math.round(lang.confidence * 100)}% confidence)`);
    });
  }
  
  // Frameworks
  if (analysis.frameworks.length > 0) {
    console.log(chalk.cyan('\n🚀 Frameworks:'));
    analysis.frameworks.forEach((framework: any) => {
      const version = framework.version ? ` v${framework.version}` : '';
      console.log(`  • ${framework.name}${version} (${Math.round(framework.confidence * 100)}% confidence)`);
    });
  }
  
  // Package managers
  if (analysis.packageManagers.length > 0) {
    console.log(chalk.cyan('\n📦 Package Managers:'));
    analysis.packageManagers.forEach((pm: any) => {
      console.log(`  • ${pm.name} (${Math.round(pm.confidence * 100)}% confidence)`);
    });
  }
  
  // Testing setup
  console.log(chalk.cyan('\n🧪 Testing Setup:'));
  console.log(`  • Has tests: ${analysis.testingSetup.hasTests ? '✅' : '❌'}`);
  if (analysis.testingSetup.testFrameworks.length > 0) {
    console.log(`  • Test frameworks: ${analysis.testingSetup.testFrameworks.join(', ')}`);
  }
  if (analysis.testingSetup.testFiles.length > 0) {
    console.log(`  • Test files found: ${analysis.testingSetup.testFiles.length}`);
  }
  
  // Complexity metrics
  console.log(chalk.cyan('\n📊 Project Complexity:'));
  console.log(`  • Total files: ${analysis.complexity.totalFiles}`);
  console.log(`  • Total lines: ${analysis.complexity.totalLines.toLocaleString()}`);
  console.log(`  • Average file size: ${Math.round(analysis.complexity.averageFileSize)} lines`);
  
  if (verbose) {
    // Project structure
    console.log(chalk.cyan('\n📂 Project Structure:'));
    if (analysis.projectStructure.srcDirectory) {
      console.log(`  • Source directory: ${analysis.projectStructure.srcDirectory}`);
    }
    if (analysis.projectStructure.entryPoints.length > 0) {
      console.log(`  • Entry points: ${analysis.projectStructure.entryPoints.slice(0, 3).join(', ')}`);
    }
    if (analysis.projectStructure.testDirectories.length > 0) {
      console.log(`  • Test directories: ${analysis.projectStructure.testDirectories.slice(0, 3).join(', ')}`);
    }
    
    // Largest files
    if (analysis.complexity.largestFiles.length > 0) {
      console.log(chalk.cyan('\n📈 Largest Files:'));
      analysis.complexity.largestFiles.slice(0, 5).forEach((file: any) => {
        console.log(`  • ${file.path} (${file.lines} lines)`);
      });
    }
  }
  
  console.log(chalk.green('\n✨ Analysis complete! Use --format json or --verbose for more details.\n'));
}

function formatAsMarkdown(analysis: any): string {
  let markdown = `# Project Analysis Report\n\n`;
  markdown += `**Project:** ${analysis.projectPath}\n\n`;
  
  // Languages
  if (analysis.languages.length > 0) {
    markdown += `## Languages\n\n`;
    analysis.languages.forEach((lang: any) => {
      markdown += `- **${lang.name}** (${Math.round(lang.confidence * 100)}% confidence)\n`;
    });
    markdown += '\n';
  }
  
  // Frameworks
  if (analysis.frameworks.length > 0) {
    markdown += `## Frameworks\n\n`;
    analysis.frameworks.forEach((framework: any) => {
      const version = framework.version ? ` v${framework.version}` : '';
      markdown += `- **${framework.name}**${version} (${Math.round(framework.confidence * 100)}% confidence)\n`;
    });
    markdown += '\n';
  }
  
  // Testing setup
  markdown += `## Testing Setup\n\n`;
  markdown += `- **Has tests:** ${analysis.testingSetup.hasTests ? '✅ Yes' : '❌ No'}\n`;
  if (analysis.testingSetup.testFrameworks.length > 0) {
    markdown += `- **Test frameworks:** ${analysis.testingSetup.testFrameworks.join(', ')}\n`;
  }
  if (analysis.testingSetup.testFiles.length > 0) {
    markdown += `- **Test files found:** ${analysis.testingSetup.testFiles.length}\n`;
  }
  markdown += '\n';
  
  // Complexity metrics
  markdown += `## Project Complexity\n\n`;
  markdown += `- **Total files:** ${analysis.complexity.totalFiles}\n`;
  markdown += `- **Total lines:** ${analysis.complexity.totalLines.toLocaleString()}\n`;
  markdown += `- **Average file size:** ${Math.round(analysis.complexity.averageFileSize)} lines\n\n`;
  
  // Largest files
  if (analysis.complexity.largestFiles.length > 0) {
    markdown += `## Largest Files\n\n`;
    analysis.complexity.largestFiles.slice(0, 10).forEach((file: any) => {
      markdown += `- ${file.path} (${file.lines} lines)\n`;
    });
    markdown += '\n';
  }
  
  return markdown;
}