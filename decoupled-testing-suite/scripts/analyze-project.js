#!/usr/bin/env node

/**
 * Analyze Project Script
 * 
 * Performs deep analysis of a project to identify testing opportunities,
 * coverage gaps, and provide recommendations for comprehensive testing.
 */

const path = require('path');
const fs = require('fs').promises;
const chalk = require('chalk');
const { Command } = require('commander');
const { ProjectDiscovery } = require('../core/discovery/project-discovery');
const { adapterFactory } = require('../../shared/adapters/AdapterFactory');
const { ConfigManager } = require('../core/config/config-manager');

const program = new Command();

program
  .name('analyze-project')
  .description('Deep analysis of project structure and testing opportunities')
  .option('-p, --project-path <path>', 'Path to the project to analyze', process.cwd())
  .option('-c, --config-dir <path>', 'Test configuration directory', './test-config')
  .option('-o, --output <file>', 'Output analysis to JSON file')
  .option('-v, --verbose', 'Verbose output')
  .option('--format <type>', 'Output format (json|report|recommendations)', 'report')
  .option('--depth <level>', 'Analysis depth (shallow|deep|comprehensive)', 'deep')
  .option('--focus <area>', 'Focus area (coverage|performance|security|maintainability)')
  .parse();

const options = program.opts();

async function main() {
  try {
    console.log(chalk.blue('🔬 Performing deep project analysis...'));
    
    const projectPath = path.resolve(options.projectPath);
    const configDir = path.resolve(options.configDir);
    
    // Validate project path
    await validateProject(projectPath);
    
    if (options.verbose) {
      console.log(chalk.gray(`Analyzing: ${projectPath}`));
      console.log(chalk.gray(`Depth: ${options.depth}`));
      console.log(chalk.gray(`Focus: ${options.focus || 'comprehensive'}`));
    }
    
    // Initialize analysis components
    const discovery = new ProjectDiscovery({ 
      cacheEnabled: true, 
      verbose: options.verbose 
    });
    const adapter = await adapterFactory.getAdapter(projectPath);
    
    // Load existing configuration if available
    let existingConfig = null;
    try {
      const configManager = new ConfigManager(configDir);
      existingConfig = await configManager.loadConfig();
    } catch (error) {
      if (options.verbose) {
        console.log(chalk.yellow('No existing configuration found, performing fresh analysis'));
      }
    }
    
    // Perform comprehensive analysis
    console.log(chalk.yellow('📊 Analyzing project structure...'));
    const analysisResults = await performComprehensiveAnalysis(
      discovery, 
      adapter, 
      projectPath, 
      existingConfig,
      options
    );
    
    // Generate insights and recommendations
    console.log(chalk.yellow('💡 Generating insights...'));
    const insights = generateInsights(analysisResults, options);
    
    // Output results
    await outputAnalysis(analysisResults, insights, options);
    
    console.log(chalk.green('✅ Project analysis completed successfully!'));
    
  } catch (error) {
    console.error(chalk.red('❌ Analysis failed:'));
    console.error(chalk.red(error.message));
    
    if (options.verbose) {
      console.error(chalk.gray(error.stack));
    }
    
    process.exit(1);
  }
}

async function validateProject(projectPath) {
  try {
    await fs.access(projectPath);
    const stats = await fs.stat(projectPath);
    
    if (!stats.isDirectory()) {
      throw new Error(`Project path is not a directory: ${projectPath}`);
    }
  } catch (error) {
    throw new Error(`Invalid project path: ${projectPath}`);
  }
}

async function performComprehensiveAnalysis(discovery, adapter, projectPath, existingConfig, options) {
  const results = {
    metadata: {
      timestamp: new Date().toISOString(),
      projectPath,
      analysisDepth: options.depth,
      focus: options.focus,
      adapter: adapter.constructor.name
    }
  };
  
  // Basic project discovery
  console.log('  📋 Project discovery...');
  results.discovery = await discovery.discoverComponents(projectPath, {
    projectRoot: projectPath,
    cacheEnabled: true
  });
  
  // Adapter-specific analysis
  console.log('  🔧 Framework analysis...');
  results.framework = await adapter.analyze(projectPath);
  
  // Code quality analysis
  console.log('  📏 Code quality analysis...');
  results.codeQuality = await analyzeCodeQuality(projectPath, results.framework);
  
  // Test coverage analysis
  console.log('  📈 Coverage analysis...');
  results.coverage = await analyzeCoverage(projectPath, results.discovery, existingConfig);
  
  // Performance analysis (if requested)
  if (options.depth === 'comprehensive' || options.focus === 'performance') {
    console.log('  ⚡ Performance analysis...');
    results.performance = await analyzePerformance(projectPath, results.framework);
  }
  
  // Security analysis (if requested)
  if (options.depth === 'comprehensive' || options.focus === 'security') {
    console.log('  🔒 Security analysis...');
    results.security = await analyzeSecurityConsiderations(projectPath, results.framework);
  }
  
  // Maintainability analysis
  console.log('  🛠️  Maintainability analysis...');
  results.maintainability = await analyzeMaintainability(projectPath, results.discovery);
  
  // Testing opportunities
  console.log('  🧪 Testing opportunities...');
  results.testingOpportunities = await identifyTestingOpportunities(results);
  
  return results;
}

async function analyzeCodeQuality(projectPath, frameworkAnalysis) {
  const quality = {
    metrics: {},
    issues: [],
    recommendations: []
  };
  
  try {
    // Check for linting configuration
    const lintConfigs = ['.eslintrc.js', '.eslintrc.json', 'pyproject.toml', 'setup.cfg'];
    let hasLinting = false;
    
    for (const config of lintConfigs) {
      try {
        await fs.access(path.join(projectPath, config));
        hasLinting = true;
        break;
      } catch {}
    }
    
    quality.metrics.hasLinting = hasLinting;
    
    if (!hasLinting) {
      quality.issues.push({
        type: 'linting',
        severity: 'medium',
        message: 'No linting configuration found'
      });
      quality.recommendations.push({
        type: 'setup',
        priority: 'medium',
        message: 'Set up code linting for consistent code quality'
      });
    }
    
    // Check for formatting configuration
    const formatConfigs = ['.prettierrc', '.black', 'pyproject.toml'];
    let hasFormatting = false;
    
    for (const config of formatConfigs) {
      try {
        await fs.access(path.join(projectPath, config));
        hasFormatting = true;
        break;
      } catch {}
    }
    
    quality.metrics.hasFormatting = hasFormatting;
    
    // Check for TypeScript
    if (frameworkAnalysis.language === 'javascript') {
      try {
        await fs.access(path.join(projectPath, 'tsconfig.json'));
        quality.metrics.hasTypeScript = true;
      } catch {
        quality.metrics.hasTypeScript = false;
        quality.recommendations.push({
          type: 'enhancement',
          priority: 'low',
          message: 'Consider migrating to TypeScript for better type safety'
        });
      }
    }
    
  } catch (error) {
    quality.issues.push({
      type: 'analysis',
      severity: 'low',
      message: `Code quality analysis incomplete: ${error.message}`
    });
  }
  
  return quality;
}

async function analyzeCoverage(projectPath, discovery, existingConfig) {
  const coverage = {
    estimated: 0,
    detailed: {},
    gaps: [],
    recommendations: []
  };
  
  try {
    // Calculate estimated coverage based on existing tests
    const totalComponents = discovery.components?.length || 0;
    const testedComponents = discovery.components?.filter(c => c.hasTests)?.length || 0;
    
    if (totalComponents > 0) {
      coverage.estimated = Math.round((testedComponents / totalComponents) * 100);
    }
    
    // Analyze component-level coverage
    coverage.detailed.components = {
      total: totalComponents,
      tested: testedComponents,
      untested: totalComponents - testedComponents
    };
    
    // Analyze route-level coverage (for APIs)
    const totalRoutes = discovery.routes?.length || 0;
    const testedRoutes = discovery.routes?.filter(r => r.hasTests)?.length || 0;
    
    coverage.detailed.routes = {
      total: totalRoutes,
      tested: testedRoutes,
      untested: totalRoutes - testedRoutes
    };
    
    // Identify coverage gaps
    if (coverage.estimated < 50) {
      coverage.gaps.push('Low overall test coverage');
      coverage.recommendations.push({
        type: 'coverage',
        priority: 'high',
        message: `Add basic unit tests to increase coverage from ${coverage.estimated}% to at least 70%`
      });
    }
    
    if (totalComponents > 0 && testedComponents === 0) {
      coverage.gaps.push('No component tests found');
      coverage.recommendations.push({
        type: 'component-testing',
        priority: 'high',
        message: 'Add component tests for UI components'
      });
    }
    
    if (totalRoutes > 0 && testedRoutes === 0) {
      coverage.gaps.push('No API route tests found');
      coverage.recommendations.push({
        type: 'integration-testing',
        priority: 'high',
        message: 'Add integration tests for API endpoints'
      });
    }
    
  } catch (error) {
    coverage.gaps.push(`Coverage analysis error: ${error.message}`);
  }
  
  return coverage;
}

async function analyzePerformance(projectPath, frameworkAnalysis) {
  const performance = {
    metrics: {},
    issues: [],
    recommendations: []
  };
  
  try {
    // Check for performance monitoring
    const perfTools = ['lighthouse.json', 'webpack-bundle-analyzer', 'bundle-analyzer'];
    let hasPerformanceMonitoring = false;
    
    for (const tool of perfTools) {
      try {
        await fs.access(path.join(projectPath, tool));
        hasPerformanceMonitoring = true;
        break;
      } catch {}
    }
    
    performance.metrics.hasPerformanceMonitoring = hasPerformanceMonitoring;
    
    if (!hasPerformanceMonitoring) {
      performance.recommendations.push({
        type: 'performance',
        priority: 'medium',
        message: 'Set up performance monitoring and bundle analysis'
      });
    }
    
    // Check for common performance anti-patterns
    if (frameworkAnalysis.language === 'javascript') {
      // Check for large bundle indicators
      try {
        const packageJson = JSON.parse(
          await fs.readFile(path.join(projectPath, 'package.json'), 'utf-8')
        );
        
        const heavyDependencies = ['moment', 'lodash', 'jquery'];
        const foundHeavy = heavyDependencies.filter(dep => 
          packageJson.dependencies?.[dep] || packageJson.devDependencies?.[dep]
        );
        
        if (foundHeavy.length > 0) {
          performance.issues.push({
            type: 'bundle-size',
            severity: 'medium',
            message: `Heavy dependencies detected: ${foundHeavy.join(', ')}`
          });
          performance.recommendations.push({
            type: 'optimization',
            priority: 'medium',
            message: 'Consider lighter alternatives for heavy dependencies'
          });
        }
      } catch {}
    }
    
  } catch (error) {
    performance.issues.push({
      type: 'analysis',
      severity: 'low',
      message: `Performance analysis incomplete: ${error.message}`
    });
  }
  
  return performance;
}

async function analyzeSecurityConsiderations(projectPath, frameworkAnalysis) {
  const security = {
    metrics: {},
    issues: [],
    recommendations: []
  };
  
  try {
    // Check for security tools
    const securityConfigs = ['.nvmrc', 'audit.json', 'bandit.yaml'];
    let hasSecurityTools = false;
    
    for (const config of securityConfigs) {
      try {
        await fs.access(path.join(projectPath, config));
        hasSecurityTools = true;
        break;
      } catch {}
    }
    
    security.metrics.hasSecurityTools = hasSecurityTools;
    
    // Basic security recommendations
    security.recommendations.push({
      type: 'security',
      priority: 'high',
      message: 'Implement security testing in your test suite'
    });
    
    if (frameworkAnalysis.language === 'javascript') {
      security.recommendations.push({
        type: 'security',
        priority: 'medium',
        message: 'Run npm audit regularly to check for vulnerabilities'
      });
    }
    
    if (frameworkAnalysis.language === 'python') {
      security.recommendations.push({
        type: 'security',
        priority: 'medium',
        message: 'Use safety or bandit for Python security scanning'
      });
    }
    
  } catch (error) {
    security.issues.push({
      type: 'analysis',
      severity: 'low',
      message: `Security analysis incomplete: ${error.message}`
    });
  }
  
  return security;
}

async function analyzeMaintainability(projectPath, discovery) {
  const maintainability = {
    metrics: {},
    issues: [],
    recommendations: []
  };
  
  try {
    // Check for documentation
    const docFiles = ['README.md', 'CONTRIBUTING.md', 'docs/', 'API.md'];
    let hasDocumentation = false;
    
    for (const doc of docFiles) {
      try {
        await fs.access(path.join(projectPath, doc));
        hasDocumentation = true;
        break;
      } catch {}
    }
    
    maintainability.metrics.hasDocumentation = hasDocumentation;
    
    if (!hasDocumentation) {
      maintainability.recommendations.push({
        type: 'documentation',
        priority: 'medium',
        message: 'Add comprehensive README and documentation'
      });
    }
    
    // Check for CI/CD
    const ciConfigs = ['.github/workflows', '.gitlab-ci.yml', 'Jenkinsfile', '.circleci'];
    let hasCICD = false;
    
    for (const ci of ciConfigs) {
      try {
        await fs.access(path.join(projectPath, ci));
        hasCICD = true;
        break;
      } catch {}
    }
    
    maintainability.metrics.hasCICD = hasCICD;
    
    if (!hasCICD) {
      maintainability.recommendations.push({
        type: 'automation',
        priority: 'high',
        message: 'Set up CI/CD pipeline for automated testing and deployment'
      });
    }
    
  } catch (error) {
    maintainability.issues.push({
      type: 'analysis',
      severity: 'low',
      message: `Maintainability analysis incomplete: ${error.message}`
    });
  }
  
  return maintainability;
}

async function identifyTestingOpportunities(analysisResults) {
  const opportunities = {
    immediate: [],
    shortTerm: [],
    longTerm: []
  };
  
  // Immediate opportunities (can be done now)
  if (analysisResults.coverage.estimated < 50) {
    opportunities.immediate.push({
      type: 'unit-testing',
      effort: 'medium',
      impact: 'high',
      description: 'Add unit tests for core functionality',
      components: analysisResults.discovery.components
        ?.filter(c => !c.hasTests)
        ?.slice(0, 5)
        ?.map(c => c.name) || []
    });
  }
  
  // Short-term opportunities (next sprint/week)
  if (analysisResults.coverage.detailed.routes?.untested > 0) {
    opportunities.shortTerm.push({
      type: 'integration-testing',
      effort: 'high',
      impact: 'high',
      description: 'Add API integration tests',
      routes: analysisResults.discovery.routes
        ?.filter(r => !r.hasTests)
        ?.map(r => r.path) || []
    });
  }
  
  // Long-term opportunities (future iterations)
  if (!analysisResults.performance?.metrics.hasPerformanceMonitoring) {
    opportunities.longTerm.push({
      type: 'performance-testing',
      effort: 'high',
      impact: 'medium',
      description: 'Implement performance testing and monitoring'
    });
  }
  
  return opportunities;
}

function generateInsights(analysisResults, options) {
  const insights = {
    summary: {},
    priorities: [],
    recommendations: [],
    riskAssessment: {}
  };
  
  // Generate summary
  insights.summary = {
    overallHealth: calculateOverallHealth(analysisResults),
    testMaturity: calculateTestMaturity(analysisResults),
    maintenanceLoad: calculateMaintenanceLoad(analysisResults),
    riskLevel: calculateRiskLevel(analysisResults)
  };
  
  // Collect all recommendations and prioritize
  const allRecommendations = [
    ...(analysisResults.coverage?.recommendations || []),
    ...(analysisResults.codeQuality?.recommendations || []),
    ...(analysisResults.performance?.recommendations || []),
    ...(analysisResults.security?.recommendations || []),
    ...(analysisResults.maintainability?.recommendations || [])
  ];
  
  insights.recommendations = allRecommendations
    .sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    })
    .slice(0, 10); // Top 10 recommendations
  
  // Generate priorities
  insights.priorities = generatePriorities(analysisResults);
  
  return insights;
}

function calculateOverallHealth(analysisResults) {
  let score = 100;
  
  // Deduct points for issues
  if (analysisResults.coverage.estimated < 50) score -= 30;
  else if (analysisResults.coverage.estimated < 70) score -= 15;
  
  if (!analysisResults.codeQuality.metrics.hasLinting) score -= 10;
  if (!analysisResults.maintainability.metrics.hasCICD) score -= 15;
  if (!analysisResults.maintainability.metrics.hasDocumentation) score -= 10;
  
  return Math.max(0, score);
}

function calculateTestMaturity(analysisResults) {
  const coverage = analysisResults.coverage.estimated;
  const hasUnitTests = coverage > 0;
  const hasIntegrationTests = analysisResults.coverage.detailed.routes?.tested > 0;
  
  if (coverage >= 80 && hasUnitTests && hasIntegrationTests) return 'Advanced';
  if (coverage >= 60 && hasUnitTests) return 'Intermediate';
  if (coverage > 0) return 'Basic';
  return 'None';
}

function calculateMaintenanceLoad(analysisResults) {
  let factors = 0;
  
  if (!analysisResults.codeQuality.metrics.hasLinting) factors++;
  if (!analysisResults.maintainability.metrics.hasCICD) factors++;
  if (analysisResults.coverage.estimated < 50) factors++;
  
  if (factors >= 3) return 'High';
  if (factors >= 2) return 'Medium';
  return 'Low';
}

function calculateRiskLevel(analysisResults) {
  let riskScore = 0;
  
  if (analysisResults.coverage.estimated < 30) riskScore += 3;
  else if (analysisResults.coverage.estimated < 60) riskScore += 2;
  else if (analysisResults.coverage.estimated < 80) riskScore += 1;
  
  if (!analysisResults.maintainability.metrics.hasCICD) riskScore += 2;
  if (!analysisResults.codeQuality.metrics.hasLinting) riskScore += 1;
  
  if (riskScore >= 5) return 'High';
  if (riskScore >= 3) return 'Medium';
  return 'Low';
}

function generatePriorities(analysisResults) {
  const priorities = [];
  
  if (analysisResults.coverage.estimated < 50) {
    priorities.push({
      priority: 1,
      area: 'Testing Coverage',
      description: 'Increase test coverage to reduce risk',
      effort: 'High',
      impact: 'High'
    });
  }
  
  if (!analysisResults.maintainability.metrics.hasCICD) {
    priorities.push({
      priority: 2,
      area: 'CI/CD Setup',
      description: 'Implement automated testing and deployment',
      effort: 'Medium',
      impact: 'High'
    });
  }
  
  if (!analysisResults.codeQuality.metrics.hasLinting) {
    priorities.push({
      priority: 3,
      area: 'Code Quality',
      description: 'Set up linting and formatting tools',
      effort: 'Low',
      impact: 'Medium'
    });
  }
  
  return priorities;
}

async function outputAnalysis(analysisResults, insights, options) {
  switch (options.format) {
    case 'json':
      await outputJSON({ analysis: analysisResults, insights }, options);
      break;
    case 'recommendations':
      await outputRecommendations(insights, options);
      break;
    case 'report':
    default:
      await outputReport(analysisResults, insights, options);
      break;
  }
  
  // Save to file if requested
  if (options.output) {
    const fullResults = { analysis: analysisResults, insights };
    await fs.writeFile(options.output, JSON.stringify(fullResults, null, 2));
    console.log(chalk.green(`📁 Analysis saved to ${options.output}`));
  }
}

async function outputJSON(results, options) {
  console.log(JSON.stringify(results, null, 2));
}

async function outputRecommendations(insights, options) {
  console.log('\n' + chalk.bold.blue('💡 RECOMMENDATIONS'));
  console.log('═'.repeat(60));
  
  insights.recommendations.forEach((rec, index) => {
    const priority = rec.priority === 'high' ? chalk.red('HIGH') : 
                     rec.priority === 'medium' ? chalk.yellow('MEDIUM') : 
                     chalk.green('LOW');
    console.log(`\n${index + 1}. [${priority}] ${chalk.bold(rec.type.toUpperCase())}`);
    console.log(`   ${rec.message}`);
  });
  
  console.log('\n' + '═'.repeat(60));
}

async function outputReport(analysisResults, insights, options) {
  console.log('\n' + chalk.bold.blue('📊 PROJECT ANALYSIS REPORT'));
  console.log('═'.repeat(70));
  
  // Executive Summary
  console.log(chalk.bold('\n🎯 Executive Summary'));
  console.log('─'.repeat(30));
  console.log(`Overall Health: ${getHealthColor(insights.summary.overallHealth)}${insights.summary.overallHealth}/100`);
  console.log(`Test Maturity: ${chalk.cyan(insights.summary.testMaturity)}`);
  console.log(`Maintenance Load: ${getLoadColor(insights.summary.maintenanceLoad)}${insights.summary.maintenanceLoad}`);
  console.log(`Risk Level: ${getRiskColor(insights.summary.riskLevel)}${insights.summary.riskLevel}`);
  
  // Coverage Analysis
  console.log(chalk.bold('\n📈 Test Coverage Analysis'));
  console.log('─'.repeat(30));
  const coverage = analysisResults.coverage;
  const coverageColor = coverage.estimated >= 80 ? chalk.green : 
                        coverage.estimated >= 60 ? chalk.yellow : chalk.red;
  console.log(`Estimated Coverage: ${coverageColor(coverage.estimated + '%')}`);
  console.log(`Components: ${coverage.detailed.components.tested}/${coverage.detailed.components.total} tested`);
  console.log(`API Routes: ${coverage.detailed.routes.tested}/${coverage.detailed.routes.total} tested`);
  
  // Top Priorities
  console.log(chalk.bold('\n🎯 Top Priorities'));
  console.log('─'.repeat(30));
  insights.priorities.slice(0, 3).forEach((priority, index) => {
    console.log(`${index + 1}. ${chalk.bold(priority.area)}`);
    console.log(`   ${priority.description}`);
    console.log(`   Effort: ${priority.effort} | Impact: ${priority.impact}\n`);
  });
  
  // Testing Opportunities
  if (analysisResults.testingOpportunities.immediate.length > 0) {
    console.log(chalk.bold('\n🧪 Immediate Testing Opportunities'));
    console.log('─'.repeat(30));
    analysisResults.testingOpportunities.immediate.forEach(opp => {
      console.log(`• ${chalk.bold(opp.type)}: ${opp.description}`);
      console.log(`  Effort: ${opp.effort} | Impact: ${opp.impact}`);
    });
  }
  
  // Key Recommendations
  console.log(chalk.bold('\n💡 Key Recommendations'));
  console.log('─'.repeat(30));
  insights.recommendations.slice(0, 5).forEach((rec, index) => {
    const priority = rec.priority === 'high' ? chalk.red('HIGH') : 
                     rec.priority === 'medium' ? chalk.yellow('MED') : 
                     chalk.green('LOW');
    console.log(`${index + 1}. [${priority}] ${rec.message}`);
  });
  
  console.log('\n' + '═'.repeat(70));
  console.log(chalk.bold.green('✅ Analysis complete! Use --format=json for detailed data.'));
}

function getHealthColor(health) {
  if (health >= 80) return chalk.green;
  if (health >= 60) return chalk.yellow;
  return chalk.red;
}

function getLoadColor(load) {
  if (load === 'Low') return chalk.green;
  if (load === 'Medium') return chalk.yellow;
  return chalk.red;
}

function getRiskColor(risk) {
  if (risk === 'Low') return chalk.green;
  if (risk === 'Medium') return chalk.yellow;
  return chalk.red;
}

if (require.main === module) {
  main().catch(error => {
    console.error(chalk.red('❌ Unexpected error:'), error.message);
    process.exit(1);
  });
}

module.exports = { main };