#!/usr/bin/env node

const path = require('path');
const chalk = require('chalk');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

// Import existing initializer
const TestingTemplateInitializer = require('./init');
const FileSystemAnalyzer = require('./utils/fileSystem');

/**
 * AI Agent Automated Testing Template Initializer
 * 
 * Extends the base initializer with automation capabilities for AI agents
 */
class AutomatedTestingInitializer extends TestingTemplateInitializer {
  constructor() {
    super();
    this.argv = null;
  }

  /**
   * Parse command line arguments and set up automation options
   */
  parseArguments() {
    this.argv = yargs(hideBin(process.argv))
      .scriptName('npm run init')
      .usage('Usage: $0 [options]')
      .option('auto', {
        type: 'boolean',
        default: false,
        description: 'Run fully automated with smart defaults (AI agent mode)'
      })
      .option('preset', {
        type: 'string',
        choices: ['minimal', 'recommended', 'comprehensive'],
        description: 'Use predefined configuration preset'
      })
      .option('dry-run', {
        type: 'boolean',
        default: false,
        description: 'Show what would be installed without making changes'
      })
      .option('yes', {
        type: 'boolean',
        default: false,
        description: 'Accept all defaults and confirmations'
      })
      .option('frameworks', {
        type: 'string',
        description: 'Comma-separated list of frameworks to include (jest,playwright,pytest)'
      })
      .option('ci', {
        type: 'string',
        choices: ['github', 'gitlab', 'circle', 'none'],
        description: 'CI/CD provider to configure'
      })
      .option('structure', {
        type: 'string',
        choices: ['separate', 'colocated', 'mixed'],
        default: 'separate',
        description: 'Test directory structure'
      })
      .option('no-coverage', {
        type: 'boolean',
        default: false,
        description: 'Disable code coverage'
      })
      .option('force', {
        type: 'boolean',
        default: false,
        description: 'Overwrite existing configurations'
      })
      .option('backup', {
        type: 'boolean',
        default: true,
        description: 'Create backup before making changes'
      })
      .option('verbose', {
        type: 'boolean',
        default: false,
        description: 'Show detailed output'
      })
      .help()
      .alias('help', 'h')
      .example('$0 --auto', 'Fully automated setup with smart defaults')
      .example('$0 --preset recommended', 'Use recommended configuration preset')
      .example('$0 --auto --frameworks jest,playwright --ci github', 'Automated with specific frameworks')
      .example('$0 --dry-run --preset comprehensive', 'Preview comprehensive setup')
      .argv;

    return this.argv;
  }

  /**
   * Main automated initialization flow
   */
  async initialize() {
    try {
      this.parseArguments();

      // Step 1: Analyze the current project
      if (this.argv.verbose) {
        console.log(chalk.blue('🔍 Analyzing project structure...'));
      }
      const analysis = this.analyzer.analyzeProject();

      // Step 2: Generate automated configuration
      const config = await this.generateAutomatedConfig(analysis);

      // Step 3: Show preview if requested
      if (this.argv.dryRun) {
        this.showDryRunPreview(config);
        return;
      }

      // Step 4: Show welcome and config (unless fully automated)
      if (!this.argv.auto && !this.argv.yes) {
        await this.prompter.showWelcome(analysis);
        this.showAutomatedConfig(config);
        
        const confirmed = await this.prompter.confirmInstallation(config);
        if (!confirmed) {
          console.log(chalk.yellow('Installation cancelled.'));
          process.exit(0);
        }
      } else {
        if (this.argv.verbose) {
          this.showAutomatedConfig(config);
        }
      }

      // Step 5-9: Run installation steps
      await this.installTemplates(config);
      await this.installDependencies(config);
      await this.generateConfigurations(config);
      await this.initializeGit(config);
      
      this.showCompletionMessage(config);

    } catch (error) {
      this.prompter.showError('Automated installation failed', error);
      process.exit(1);
    }
  }

  /**
   * Generate configuration based on analysis and CLI options
   */
  async generateAutomatedConfig(analysis) {
    const config = {
      // Copy analysis results
      detectedLanguages: {
        javascript: analysis.javascript.isJavaScript,
        typescript: analysis.javascript.hasTypeScript,
        python: analysis.python.isPython
      },
      detectedFrameworks: this.extractFrameworks(analysis),
      
      // Apply smart defaults
      ...this.getSmartDefaults(analysis),
      
      // Apply preset if specified
      ...this.getPresetConfig(this.argv.preset),
      
      // Apply CLI overrides
      ...this.getCliOverrides()
    };

    return this.validateAndEnhanceConfig(config, analysis);
  }

  /**
   * Extract detected frameworks from analysis
   */
  extractFrameworks(analysis) {
    const frameworks = {};
    
    if (analysis.javascript.isJavaScript) {
      Object.entries(analysis.javascript.frameworks).forEach(([name, detected]) => {
        if (detected) frameworks[name] = true;
      });
    }
    
    if (analysis.python.isPython) {
      Object.entries(analysis.python.frameworks).forEach(([name, detected]) => {
        if (detected) frameworks[name] = true;
      });
    }
    
    return frameworks;
  }

  /**
   * Generate smart defaults based on project analysis
   */
  getSmartDefaults(analysis) {
    const defaults = {
      testStructure: 'separate', // Safest option
      enableCoverage: !this.argv.noCoverage,
      ciProvider: this.detectCiProvider() || 'github',
      jsTestingFrameworks: [],
      pythonTestingFrameworks: [],
      advancedFeatures: []
    };

    // JavaScript/TypeScript defaults
    if (analysis.javascript.isJavaScript) {
      defaults.jsTestingFrameworks.push('jest');
      
      // Framework-specific defaults
      if (analysis.javascript.frameworks?.react) {
        defaults.jsTestingFrameworks.push('rtl');
      }
      
      if (analysis.javascript.frameworks?.vite) {
        defaults.jsTestingFrameworks.push('vitest');
      }
      
      // Frontend projects get E2E testing
      if (analysis.javascript.projectType === 'frontend') {
        defaults.jsTestingFrameworks.push('playwright');
      }
    }

    // Python defaults
    if (analysis.python.isPython) {
      defaults.pythonTestingFrameworks.push('pytest');
      
      if (this.argv.preset !== 'minimal') {
        defaults.pythonTestingFrameworks.push('coverage');
      }
      
      // Backend APIs get additional testing tools
      if (analysis.python.frameworks?.fastapi || analysis.python.frameworks?.flask) {
        defaults.advancedFeatures.push('api-testing');
      }
    }

    return defaults;
  }

  /**
   * Get configuration for specified preset
   */
  getPresetConfig(preset) {
    const presets = {
      minimal: {
        jsTestingFrameworks: ['jest'],
        pythonTestingFrameworks: ['pytest'],
        advancedFeatures: [],
        enableCoverage: false,
        ciProvider: 'github'
      },
      
      recommended: {
        jsTestingFrameworks: ['jest', 'rtl'],
        pythonTestingFrameworks: ['pytest', 'coverage'],
        advancedFeatures: ['api-testing'],
        enableCoverage: true,
        ciProvider: 'github'
      },
      
      comprehensive: {
        jsTestingFrameworks: ['jest', 'rtl', 'playwright'],
        pythonTestingFrameworks: ['pytest', 'coverage', 'black', 'mypy'],
        advancedFeatures: ['api-testing', 'visual-regression', 'performance'],
        enableCoverage: true,
        ciProvider: 'github'
      }
    };

    return preset ? presets[preset] || {} : {};
  }

  /**
   * Get CLI overrides from command line arguments
   */
  getCliOverrides() {
    const overrides = {};

    if (this.argv.frameworks) {
      const frameworks = this.argv.frameworks.split(',').map(f => f.trim());
      
      // Split frameworks by language
      const jsFrameworks = frameworks.filter(f => 
        ['jest', 'rtl', 'playwright', 'cypress', 'vitest'].includes(f)
      );
      const pythonFrameworks = frameworks.filter(f => 
        ['pytest', 'unittest', 'coverage', 'black', 'mypy'].includes(f)
      );
      
      if (jsFrameworks.length > 0) {
        overrides.jsTestingFrameworks = jsFrameworks;
      }
      if (pythonFrameworks.length > 0) {
        overrides.pythonTestingFrameworks = pythonFrameworks;
      }
    }

    if (this.argv.ci) {
      overrides.ciProvider = this.argv.ci;
    }

    if (this.argv.structure) {
      overrides.testStructure = this.argv.structure;
    }

    if (this.argv.noCoverage) {
      overrides.enableCoverage = false;
    }

    return overrides;
  }

  /**
   * Detect existing CI provider from project files
   */
  detectCiProvider() {
    const fs = require('fs-extra');
    const cwd = process.cwd();

    if (fs.pathExistsSync(path.join(cwd, '.github', 'workflows'))) {
      return 'github';
    }
    if (fs.pathExistsSync(path.join(cwd, '.gitlab-ci.yml'))) {
      return 'gitlab';
    }
    if (fs.pathExistsSync(path.join(cwd, '.circleci'))) {
      return 'circle';
    }
    
    return null;
  }

  /**
   * Validate and enhance the generated configuration
   */
  validateAndEnhanceConfig(config, analysis) {
    // Ensure we have frameworks for detected languages
    if (config.detectedLanguages.javascript && config.jsTestingFrameworks.length === 0) {
      config.jsTestingFrameworks = ['jest'];
    }
    
    if (config.detectedLanguages.python && config.pythonTestingFrameworks.length === 0) {
      config.pythonTestingFrameworks = ['pytest'];
    }

    // Add setupTypes array (required by template manager)
    config.setupTypes = this.determineSetupTypes(config, analysis);
    
    // Add project analysis for compatibility
    config.projectAnalysis = analysis;

    // Add confidence scoring for logging
    config.confidence = this.calculateConfidence(config, analysis);
    
    return config;
  }

  /**
   * Determine which project types to set up based on detection and configuration
   */
  determineSetupTypes(config, analysis) {
    const types = [];

    if (analysis.javascript.isJavaScript) {
      if (analysis.javascript.projectType === 'frontend' || 
          analysis.javascript.frameworks.react || 
          analysis.javascript.frameworks.vue || 
          analysis.javascript.frameworks.angular) {
        types.push(analysis.javascript.hasTypeScript ? 'typescript-frontend' : 'javascript-frontend');
      }
      
      if (analysis.javascript.projectType === 'backend' ||
          analysis.javascript.frameworks.express ||
          analysis.javascript.frameworks.fastify ||
          analysis.javascript.frameworks.nestjs) {
        types.push(analysis.javascript.hasTypeScript ? 'typescript-backend' : 'javascript-backend');
      }

      if (analysis.javascript.projectType === 'unknown') {
        // Default to frontend if React Testing Library selected
        if (config.jsTestingFrameworks && config.jsTestingFrameworks.includes('rtl')) {
          types.push(analysis.javascript.hasTypeScript ? 'typescript-frontend' : 'javascript-frontend');
        } else {
          types.push(analysis.javascript.hasTypeScript ? 'typescript-backend' : 'javascript-backend');
        }
      }
    }

    if (analysis.python.isPython) {
      types.push('python-backend');
    }

    // Handle manual project type selection for empty projects
    if (config.projectType) {
      types.push(config.projectType);
    }

    return types;
  }

  /**
   * Calculate confidence score for automated decisions
   */
  calculateConfidence(config, analysis) {
    let score = 0.5; // Base confidence
    
    // High confidence if languages are clearly detected
    if (analysis.javascript.isJavaScript && Object.keys(analysis.javascript.frameworks).length > 0) {
      score += 0.3;
    }
    if (analysis.python.isPython && Object.keys(analysis.python.frameworks).length > 0) {
      score += 0.3;
    }
    
    // Lower confidence for empty projects
    if (analysis.isEmpty) {
      score -= 0.2;
    }
    
    // CLI overrides increase confidence
    if (this.argv.frameworks || this.argv.preset) {
      score += 0.2;
    }
    
    return Math.min(1.0, Math.max(0.1, score));
  }

  /**
   * Show automated configuration preview
   */
  showAutomatedConfig(config) {
    console.log(chalk.blue.bold('\n🤖 Automated Configuration\n'));
    
    if (config.confidence < 0.7) {
      console.log(chalk.yellow(`⚠ Confidence: ${Math.round(config.confidence * 100)}% (some decisions are estimates)`));
    } else {
      console.log(chalk.green(`✓ Confidence: ${Math.round(config.confidence * 100)}%`));
    }
    
    console.log(chalk.gray('\nSelected Configuration:'));
    
    if (config.detectedLanguages.javascript) {
      console.log(chalk.blue(`  JavaScript Frameworks: ${config.jsTestingFrameworks.join(', ')}`));
    }
    
    if (config.detectedLanguages.python) {
      console.log(chalk.blue(`  Python Frameworks: ${config.pythonTestingFrameworks.join(', ')}`));
    }
    
    console.log(chalk.blue(`  Test Structure: ${config.testStructure}`));
    console.log(chalk.blue(`  Code Coverage: ${config.enableCoverage ? 'Enabled' : 'Disabled'}`));
    console.log(chalk.blue(`  CI/CD Provider: ${config.ciProvider}`));
    
    if (config.advancedFeatures && config.advancedFeatures.length > 0) {
      console.log(chalk.blue(`  Advanced Features: ${config.advancedFeatures.join(', ')}`));
    }
    
    console.log('');
  }

  /**
   * Show dry run preview
   */
  showDryRunPreview(config) {
    console.log(chalk.blue.bold('\n🔍 Dry Run Preview\n'));
    
    this.showAutomatedConfig(config);
    
    console.log(chalk.gray('Files that would be created/modified:'));
    
    // Simulate template manager preview
    const templateFiles = this.getTemplateFiles(config);
    templateFiles.forEach(file => {
      console.log(chalk.gray(`  + ${file}`));
    });
    
    console.log(chalk.gray('\nDependencies that would be installed:'));
    const deps = this.getDependencies(config);
    
    if (deps.npm.length > 0) {
      console.log(chalk.gray(`  npm: ${deps.npm.join(', ')}`));
    }
    if (deps.python.length > 0) {
      console.log(chalk.gray(`  python: ${deps.python.join(', ')}`));
    }
    
    console.log(chalk.blue('\nRun without --dry-run to apply these changes.'));
  }

  /**
   * Get list of template files that would be created
   */
  getTemplateFiles(config) {
    const files = [];
    
    if (config.detectedLanguages.javascript) {
      files.push('jest.config.js', 'src/__tests__/example.test.js');
      
      if (config.jsTestingFrameworks.includes('playwright')) {
        files.push('playwright.config.js', 'tests/example.spec.js');
      }
    }
    
    if (config.detectedLanguages.python) {
      files.push('pytest.ini', 'tests/test_example.py');
      
      if (config.pythonTestingFrameworks.includes('coverage')) {
        files.push('.coveragerc');
      }
    }
    
    if (config.ciProvider !== 'none') {
      files.push(`.${config.ciProvider === 'github' ? 'github/workflows' : config.ciProvider === 'gitlab' ? 'gitlab-ci.yml' : 'circleci/config.yml'}`);
    }
    
    return files;
  }

  /**
   * Show completion message with next steps
   */
  showCompletionMessage(config) {
    console.log(chalk.green.bold('\n✅ Testing setup completed!\n'));
    
    console.log(chalk.blue('Next steps:'));
    
    if (config.detectedLanguages.javascript) {
      console.log(chalk.gray('  npm test              # Run JavaScript tests'));
      console.log(chalk.gray('  npm run test:watch    # Run tests in watch mode'));
      
      if (config.enableCoverage) {
        console.log(chalk.gray('  npm run test:coverage # Run tests with coverage'));
      }
      
      if (config.jsTestingFrameworks.includes('playwright')) {
        console.log(chalk.gray('  npm run test:e2e      # Run E2E tests'));
      }
    }
    
    if (config.detectedLanguages.python) {
      console.log(chalk.gray('  pytest                # Run Python tests'));
      
      if (config.enableCoverage) {
        console.log(chalk.gray('  pytest --cov          # Run tests with coverage'));
      }
    }
    
    console.log(chalk.blue('\nDocumentation:'));
    console.log(chalk.gray('  Check the generated test files for examples'));
    console.log(chalk.gray('  See README.md for detailed testing guide'));
    
    if (this.argv.auto) {
      console.log(chalk.green(`\n🤖 Automated setup completed with ${Math.round(config.confidence * 100)}% confidence`));
    }
  }
}

// Run the automated initializer if this file is executed directly
if (require.main === module) {
  const initializer = new AutomatedTestingInitializer();
  initializer.initialize().catch((error) => {
    console.error(chalk.red('Fatal error:'), error.message);
    process.exit(1);
  });
}

module.exports = AutomatedTestingInitializer;