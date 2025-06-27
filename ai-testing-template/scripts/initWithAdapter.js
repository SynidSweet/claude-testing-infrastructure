#!/usr/bin/env node

const path = require('path');
const fs = require('fs-extra');
const { spawn } = require('child_process');
const chalk = require('chalk');

// Import utilities - with adapter support
const FileSystemAnalyzer = process.env.USE_LEGACY_ANALYZER 
  ? require('./utils/fileSystem')
  : require('./utils/fileSystemAdapter');
const Prompter = require('./utils/prompter');
const TemplateManager = require('./utils/templateManager');

/**
 * Main initialization script for AI Testing Template with Adapter Pattern
 */
class TestingTemplateInitializer {
  constructor() {
    this.analyzer = new FileSystemAnalyzer();
    this.prompter = new Prompter();
    this.templateManager = new TemplateManager();
    this.useAdapter = !process.env.USE_LEGACY_ANALYZER;
  }

  /**
   * Main initialization flow
   */
  async initialize() {
    try {
      // Step 1: Analyze the current project
      console.log(chalk.blue('🔍 Analyzing project structure...'));
      
      let analysis;
      if (this.useAdapter) {
        // New adapter-based analysis
        analysis = await this.analyzer.analyzeProject();
        
        // Show adapter information
        if (analysis.adapter) {
          console.log(chalk.green(`✓ Detected language: ${analysis.adapter.language}`));
          if (analysis.adapter.language === 'multi') {
            console.log(chalk.green(`  Supporting: ${analysis.adapter.analysis.languages.join(', ')}`));
          }
        }
      } else {
        // Legacy synchronous analysis
        analysis = this.analyzer.analyzeProject();
      }

      // Step 2: Show welcome and analysis results
      await this.prompter.showWelcome(analysis);

      // Step 3: Get user configuration
      const config = await this.prompter.promptForConfiguration(analysis);

      // If using adapter, enhance config with adapter insights
      if (this.useAdapter && analysis.adapter) {
        config.adapterConfig = await this.enhanceConfigWithAdapter(analysis, config);
      }

      // Step 4: Confirm installation
      const confirmed = await this.prompter.confirmInstallation(config);
      if (!confirmed) {
        console.log(chalk.yellow('Installation cancelled.'));
        process.exit(0);
      }

      // Step 5: Install templates
      await this.installTemplates(config);

      // Step 6: Install dependencies
      await this.installDependencies(config);

      // Step 7: Show next steps
      this.showNextSteps(config);

      console.log(chalk.green('\n✅ Testing setup completed successfully!'));
      
    } catch (error) {
      console.error(chalk.red('\n❌ Error during initialization:'), error.message);
      console.error(chalk.gray(error.stack));
      process.exit(1);
    }
  }

  /**
   * Enhance configuration with adapter insights
   */
  async enhanceConfigWithAdapter(analysis, config) {
    const adapterConfig = {};
    
    try {
      // Get test configuration from adapter
      const testConfig = await this.analyzer.getTestConfiguration();
      adapterConfig.testConfiguration = testConfig;

      // Get test dependencies from adapter
      const dependencies = await this.analyzer.getTestDependencies();
      adapterConfig.dependencies = dependencies;

      // Get available templates from adapter
      const templates = await this.analyzer.getTestTemplates();
      adapterConfig.templates = templates;

      // Validate project
      const validation = await this.analyzer.validate();
      if (!validation.valid) {
        console.log(chalk.yellow('\n⚠️  Project validation warnings:'));
        validation.warnings.forEach(warning => {
          console.log(chalk.yellow(`  - ${warning}`));
        });
      }

      // Show suggestions
      if (Object.keys(validation.suggestions).length > 0) {
        console.log(chalk.cyan('\n💡 Suggestions:'));
        Object.entries(validation.suggestions).forEach(([key, suggestion]) => {
          console.log(chalk.cyan(`  - ${suggestion}`));
        });
      }

      return adapterConfig;
      
    } catch (error) {
      console.warn(chalk.yellow('Warning: Could not enhance config with adapter:'), error.message);
      return {};
    }
  }

  /**
   * Install templates based on configuration
   */
  async installTemplates(config) {
    console.log(chalk.blue('\n📦 Installing test templates...'));
    
    const selectedTemplates = this.selectTemplates(config);
    
    for (const template of selectedTemplates) {
      try {
        await this.templateManager.copyTemplate(template, config);
        console.log(chalk.green(`  ✓ Installed ${template}`));
      } catch (error) {
        console.error(chalk.red(`  ✗ Failed to install ${template}: ${error.message}`));
      }
    }

    // If using adapter, install adapter-suggested templates
    if (config.adapterConfig?.templates) {
      console.log(chalk.blue('\n📝 Installing adapter-suggested templates...'));
      
      for (const template of config.adapterConfig.templates.slice(0, 5)) {
        try {
          // Convert adapter template format to template manager format
          const templatePath = template.path.replace('.template', '');
          await this.templateManager.copyTemplate(templatePath, {
            ...config,
            targetPath: template.targetPath,
            variables: template.variables
          });
          console.log(chalk.green(`  ✓ Installed ${template.name}: ${template.description}`));
        } catch (error) {
          console.warn(chalk.yellow(`  ⚠️  Could not install ${template.name}`));
        }
      }
    }
  }

  /**
   * Select templates based on configuration
   */
  selectTemplates(config) {
    const templates = [];
    
    if (config.language === 'javascript' || config.language === 'both') {
      templates.push('javascript/jest.config');
      templates.push('javascript/setupTests');
      
      if (config.framework === 'react') {
        templates.push('javascript/frontend/react');
      } else if (config.framework === 'vue') {
        templates.push('javascript/frontend/vue');
      } else if (config.framework === 'express') {
        templates.push('javascript/backend/express');
      }
      
      if (config.e2e) {
        templates.push('javascript/e2e/playwright');
      }
    }
    
    if (config.language === 'python' || config.language === 'both') {
      templates.push('python/pytest.ini');
      templates.push('python/conftest');
      
      if (config.framework === 'fastapi') {
        templates.push('python/backend/fastapi');
      } else if (config.framework === 'django') {
        templates.push('python/backend/django');
      }
    }
    
    // CI/CD templates
    if (config.ci === 'github') {
      templates.push('common/github-actions/test');
    } else if (config.ci === 'gitlab') {
      templates.push('common/gitlab-ci/test');
    }
    
    return templates;
  }

  /**
   * Install testing dependencies
   */
  async installDependencies(config) {
    console.log(chalk.blue('\n📚 Installing testing dependencies...'));
    
    // Use adapter dependencies if available
    const dependencies = config.adapterConfig?.dependencies || this.getDefaultDependencies(config);
    
    if (config.language === 'javascript' || config.language === 'both') {
      await this.installNpmDependencies(dependencies.required || dependencies.javascript || []);
    }
    
    if (config.language === 'python' || config.language === 'both') {
      await this.installPythonDependencies(dependencies.required || dependencies.python || []);
    }
  }

  /**
   * Get default dependencies (fallback when adapter not available)
   */
  getDefaultDependencies(config) {
    const deps = {
      javascript: [],
      python: []
    };
    
    if (config.language === 'javascript' || config.language === 'both') {
      deps.javascript = [
        'jest',
        '@types/jest',
        'jest-environment-jsdom'
      ];
      
      if (config.framework === 'react') {
        deps.javascript.push('@testing-library/react', '@testing-library/jest-dom');
      }
    }
    
    if (config.language === 'python' || config.language === 'both') {
      deps.python = [
        'pytest',
        'pytest-cov',
        'pytest-mock'
      ];
      
      if (config.framework === 'fastapi') {
        deps.python.push('httpx', 'pytest-asyncio');
      }
    }
    
    return deps;
  }

  /**
   * Install npm dependencies
   */
  async installNpmDependencies(dependencies) {
    if (dependencies.length === 0) return;
    
    console.log(chalk.blue('  Installing npm packages...'));
    
    return new Promise((resolve, reject) => {
      const npm = spawn('npm', ['install', '--save-dev', ...dependencies], {
        stdio: 'inherit',
        shell: true
      });
      
      npm.on('close', (code) => {
        if (code === 0) {
          console.log(chalk.green('  ✓ npm packages installed'));
          resolve();
        } else {
          reject(new Error(`npm install failed with code ${code}`));
        }
      });
    });
  }

  /**
   * Install Python dependencies
   */
  async installPythonDependencies(dependencies) {
    if (dependencies.length === 0) return;
    
    console.log(chalk.blue('  Installing Python packages...'));
    
    // Check for virtual environment
    const venvPaths = ['venv', '.venv', 'env', '.env'];
    const venvExists = venvPaths.some(venv => fs.existsSync(venv));
    
    if (!venvExists) {
      console.log(chalk.yellow('  ⚠️  No virtual environment detected. Installing globally...'));
    }
    
    return new Promise((resolve, reject) => {
      const pip = spawn('pip', ['install', ...dependencies], {
        stdio: 'inherit',
        shell: true
      });
      
      pip.on('close', (code) => {
        if (code === 0) {
          console.log(chalk.green('  ✓ Python packages installed'));
          resolve();
        } else {
          reject(new Error(`pip install failed with code ${code}`));
        }
      });
    });
  }

  /**
   * Show next steps to the user
   */
  showNextSteps(config) {
    console.log(chalk.blue('\n🚀 Next steps:'));
    
    if (config.language === 'javascript' || config.language === 'both') {
      console.log(chalk.white('  - Run tests: npm test'));
      console.log(chalk.white('  - Run tests with coverage: npm run test:coverage'));
    }
    
    if (config.language === 'python' || config.language === 'both') {
      console.log(chalk.white('  - Run tests: pytest'));
      console.log(chalk.white('  - Run tests with coverage: pytest --cov'));
    }
    
    if (config.ci) {
      console.log(chalk.white(`  - Commit and push to trigger ${config.ci} CI/CD`));
    }
    
    console.log(chalk.white('\n📖 For more information, check the generated test examples!'));
  }
}

// Run initialization if called directly
if (require.main === module) {
  const initializer = new TestingTemplateInitializer();
  initializer.initialize();
}

module.exports = TestingTemplateInitializer;