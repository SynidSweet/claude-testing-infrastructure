#!/usr/bin/env node

/**
 * Discover Project Script
 * 
 * Analyzes a project structure and discovers components, frameworks, and testing opportunities.
 * Uses the existing ProjectDiscovery engine and AdapterFactory for comprehensive analysis.
 */

const path = require('path');
const fs = require('fs').promises;
const chalk = require('chalk');
const { Command } = require('commander');
const { ProjectDiscovery } = require('../core/discovery/project-discovery');
const { adapterFactory } = require('../../shared/adapters/AdapterFactory');

const program = new Command();

program
  .name('discover-project')
  .description('Discover and analyze project structure for testing opportunities')
  .option('-p, --project-path <path>', 'Path to the project to analyze', process.cwd())
  .option('-o, --output <file>', 'Output analysis to JSON file')
  .option('-v, --verbose', 'Verbose output')
  .option('--format <type>', 'Output format (json|table|summary)', 'summary')
  .option('--save-cache', 'Save discovery cache for faster subsequent runs')
  .parse();

const options = program.opts();

async function main() {
  try {
    console.log(chalk.blue('🔍 Discovering project structure...'));
    
    const projectPath = path.resolve(options.projectPath);
    
    // Validate project path exists
    try {
      await fs.access(projectPath);
    } catch (error) {
      console.error(chalk.red(`❌ Project path does not exist: ${projectPath}`));
      process.exit(1);
    }
    
    if (options.verbose) {
      console.log(chalk.gray(`Analyzing: ${projectPath}`));
    }
    
    // Initialize discovery engine
    const discovery = new ProjectDiscovery({
      cacheEnabled: options.saveCache,
      verbose: options.verbose
    });
    
    // Get appropriate adapter for the project
    const adapter = await adapterFactory.getAdapter(projectPath);
    if (options.verbose) {
      console.log(chalk.gray(`Using adapter: ${adapter.constructor.name}`));
    }
    
    // Perform comprehensive analysis
    console.log(chalk.yellow('📊 Analyzing project components...'));
    const analysis = await discovery.discoverComponents(projectPath, {
      projectRoot: projectPath,
      cacheEnabled: options.saveCache
    });
    
    // Get adapter-specific insights
    console.log(chalk.yellow('🔧 Gathering framework-specific insights...'));
    const adapterAnalysis = await adapter.analyze(projectPath);
    
    // Combine results
    const combinedResults = {
      projectPath,
      timestamp: new Date().toISOString(),
      adapter: adapter.constructor.name,
      discovery: analysis,
      framework: adapterAnalysis,
      summary: generateSummary(analysis, adapterAnalysis),
      recommendations: generateRecommendations(analysis, adapterAnalysis)
    };
    
    // Output results
    await outputResults(combinedResults, options);
    
    console.log(chalk.green('✅ Project discovery completed successfully!'));
    
  } catch (error) {
    console.error(chalk.red('❌ Discovery failed:'));
    console.error(chalk.red(error.message));
    
    if (options.verbose) {
      console.error(chalk.gray(error.stack));
    }
    
    process.exit(1);
  }
}

function generateSummary(discovery, framework) {
  const summary = {
    projectType: framework.projectType || 'Unknown',
    language: framework.language || 'Unknown',
    frameworks: framework.frameworks || [],
    totalComponents: discovery.components?.length || 0,
    testableComponents: discovery.components?.filter(c => c.testable)?.length || 0,
    existingTests: discovery.existingTests?.length || 0,
    coverage: {
      estimated: calculateEstimatedCoverage(discovery),
      gaps: identifyGaps(discovery)
    }
  };
  
  return summary;
}

function generateRecommendations(discovery, framework) {
  const recommendations = [];
  
  // Framework-specific recommendations
  if (framework.recommendations) {
    recommendations.push(...framework.recommendations);
  }
  
  // Component testing recommendations
  const untestedComponents = discovery.components?.filter(c => c.testable && !c.hasTests) || [];
  if (untestedComponents.length > 0) {
    recommendations.push({
      type: 'component-testing',
      priority: 'high',
      message: `${untestedComponents.length} components need testing`,
      components: untestedComponents.map(c => c.name)
    });
  }
  
  // Coverage recommendations
  const estimatedCoverage = calculateEstimatedCoverage(discovery);
  if (estimatedCoverage < 60) {
    recommendations.push({
      type: 'coverage',
      priority: 'high',
      message: `Low test coverage detected (${estimatedCoverage}%). Consider adding more tests.`
    });
  }
  
  // Integration testing recommendations
  if (discovery.routes?.length > 0 && discovery.routes.filter(r => r.hasTests).length === 0) {
    recommendations.push({
      type: 'integration-testing',
      priority: 'medium',
      message: 'API routes detected but no integration tests found'
    });
  }
  
  return recommendations;
}

function calculateEstimatedCoverage(discovery) {
  const totalComponents = discovery.components?.length || 0;
  const testedComponents = discovery.components?.filter(c => c.hasTests)?.length || 0;
  
  if (totalComponents === 0) return 0;
  return Math.round((testedComponents / totalComponents) * 100);
}

function identifyGaps(discovery) {
  const gaps = [];
  
  if (!discovery.existingTests || discovery.existingTests.length === 0) {
    gaps.push('No existing tests found');
  }
  
  if (discovery.components?.length > 0 && discovery.components.filter(c => c.hasTests).length === 0) {
    gaps.push('No component tests found');
  }
  
  if (discovery.routes?.length > 0 && discovery.routes.filter(r => r.hasTests).length === 0) {
    gaps.push('No API route tests found');
  }
  
  return gaps;
}

async function outputResults(results, options) {
  switch (options.format) {
    case 'json':
      await outputJSON(results, options);
      break;
    case 'table':
      await outputTable(results, options);
      break;
    case 'summary':
    default:
      await outputSummary(results, options);
      break;
  }
  
  // Save to file if requested
  if (options.output) {
    await fs.writeFile(options.output, JSON.stringify(results, null, 2));
    console.log(chalk.green(`📁 Results saved to ${options.output}`));
  }
}

async function outputJSON(results, options) {
  console.log(JSON.stringify(results, null, 2));
}

async function outputTable(results, options) {
  const { summary, recommendations } = results;
  
  console.log('\n' + chalk.bold('📊 PROJECT ANALYSIS RESULTS'));
  console.log('═'.repeat(50));
  
  // Project Info Table
  console.log(chalk.bold('\n🏗️  Project Information'));
  console.log('─'.repeat(30));
  console.log(`${chalk.blue('Type:')} ${summary.projectType}`);
  console.log(`${chalk.blue('Language:')} ${summary.language}`);
  console.log(`${chalk.blue('Frameworks:')} ${summary.frameworks.join(', ') || 'None detected'}`);
  
  // Component Stats Table
  console.log(chalk.bold('\n📦 Component Statistics'));
  console.log('─'.repeat(30));
  console.log(`${chalk.blue('Total Components:')} ${summary.totalComponents}`);
  console.log(`${chalk.blue('Testable Components:')} ${summary.testableComponents}`);
  console.log(`${chalk.blue('Existing Tests:')} ${summary.existingTests}`);
  console.log(`${chalk.blue('Estimated Coverage:')} ${summary.coverage.estimated}%`);
  
  // Recommendations
  if (recommendations.length > 0) {
    console.log(chalk.bold('\n💡 Recommendations'));
    console.log('─'.repeat(30));
    recommendations.forEach((rec, index) => {
      const priority = rec.priority === 'high' ? chalk.red('HIGH') : 
                       rec.priority === 'medium' ? chalk.yellow('MEDIUM') : 
                       chalk.green('LOW');
      console.log(`${index + 1}. [${priority}] ${rec.message}`);
    });
  }
  
  console.log('\n' + '═'.repeat(50));
}

async function outputSummary(results, options) {
  const { summary, recommendations } = results;
  
  console.log('\n' + chalk.bold.blue('📊 PROJECT DISCOVERY SUMMARY'));
  console.log('═'.repeat(60));
  
  // Project overview
  console.log(chalk.bold(`\n🏗️  ${summary.projectType} Project`));
  if (summary.frameworks.length > 0) {
    console.log(`   Frameworks: ${chalk.cyan(summary.frameworks.join(', '))}`);
  }
  console.log(`   Language: ${chalk.cyan(summary.language)}`);
  
  // Statistics
  console.log(chalk.bold('\n📈 Testing Statistics'));
  console.log(`   Total Components: ${chalk.white(summary.totalComponents)}`);
  console.log(`   Testable Components: ${chalk.white(summary.testableComponents)}`);
  console.log(`   Components with Tests: ${chalk.white(summary.existingTests)}`);
  
  // Coverage indicator
  const coverage = summary.coverage.estimated;
  const coverageColor = coverage >= 80 ? chalk.green : coverage >= 60 ? chalk.yellow : chalk.red;
  console.log(`   Estimated Coverage: ${coverageColor(coverage + '%')}`);
  
  // Coverage gaps
  if (summary.coverage.gaps.length > 0) {
    console.log(chalk.bold('\n⚠️  Coverage Gaps'));
    summary.coverage.gaps.forEach(gap => {
      console.log(`   • ${chalk.yellow(gap)}`);
    });
  }
  
  // Top recommendations
  if (recommendations.length > 0) {
    console.log(chalk.bold('\n💡 Top Recommendations'));
    recommendations.slice(0, 3).forEach((rec, index) => {
      const icon = rec.priority === 'high' ? '🔴' : rec.priority === 'medium' ? '🟡' : '🟢';
      console.log(`   ${icon} ${rec.message}`);
    });
    
    if (recommendations.length > 3) {
      console.log(`   ... and ${recommendations.length - 3} more recommendations`);
    }
  }
  
  console.log('\n' + chalk.bold.green('✅ Discovery complete! Use --format=table for detailed results.'));
  console.log('═'.repeat(60));
}

// Run the script
if (require.main === module) {
  main().catch(error => {
    console.error(chalk.red('❌ Unexpected error:'), error.message);
    process.exit(1);
  });
}

module.exports = { main };