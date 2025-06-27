#!/usr/bin/env node

const path = require('path');
const fs = require('fs-extra');
const { spawn } = require('child_process');
const chalk = require('chalk');

// Import our utilities
const FileSystemAnalyzer = require('./utils/fileSystem');
const Prompter = require('./utils/prompter');
const TemplateManager = require('./utils/templateManager');

/**
 * Main initialization script for AI Testing Template
 */
class TestingTemplateInitializer {
  constructor() {
    this.analyzer = new FileSystemAnalyzer();
    this.prompter = new Prompter();
    this.templateManager = new TemplateManager();
  }

  /**
   * Main initialization flow
   */
  async initialize() {
    try {
      // Step 1: Analyze the current project
      console.log(chalk.blue('🔍 Analyzing project structure...'));
      const analysis = this.analyzer.analyzeProject();

      // Step 2: Show welcome and analysis results
      await this.prompter.showWelcome(analysis);

      // Step 3: Get user configuration
      const config = await this.prompter.promptForConfiguration(analysis);

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

      // Step 7: Generate configuration files
      await this.generateConfigurations(config);

      // Step 8: Initialize git (if needed)
      await this.initializeGit(config);

      // Step 9: Show completion message
      this.prompter.showCompletion(config);

    } catch (error) {
      this.prompter.showError('Installation failed', error);
      process.exit(1);
    }
  }

  /**
   * Install testing templates based on configuration
   */
  async installTemplates(config) {
    this.prompter.showProgress('Installing testing templates...');

    try {
      const operations = await this.templateManager.copyTemplates(config);
      
      this.prompter.showProgress(`Installed ${operations.length} template files`, true);
    } catch (error) {
      throw new Error(`Template installation failed: ${error.message}`);
    }
  }

  /**
   * Install required dependencies
   */
  async installDependencies(config) {
    const dependencies = this.getDependencies(config);
    
    if (dependencies.npm.length > 0) {
      await this.installNpmDependencies(dependencies.npm);
    }

    if (dependencies.python.length > 0) {
      await this.installPythonDependencies(dependencies.python);
    }
  }

  /**
   * Get list of dependencies to install
   */
  getDependencies(config) {
    const dependencies = {
      npm: [],
      python: []
    };

    // JavaScript/TypeScript dependencies
    if (config.detectedLanguages.javascript) {
      // Base testing dependencies
      dependencies.npm.push('jest', '@types/jest');

      if (config.jsTestingFrameworks?.includes('rtl')) {
        dependencies.npm.push('@testing-library/react', '@testing-library/jest-dom');
      }

      if (config.jsTestingFrameworks?.includes('playwright')) {
        dependencies.npm.push('@playwright/test');
      }

      if (config.jsTestingFrameworks?.includes('cypress')) {
        dependencies.npm.push('cypress');
      }

      if (config.jsTestingFrameworks?.includes('vitest')) {
        dependencies.npm.push('vitest', '@vitest/ui');
      }

      // TypeScript dependencies
      if (config.detectedLanguages.typescript) {
        dependencies.npm.push('ts-jest', 'typescript');
      }

      // Additional utilities
      dependencies.npm.push('supertest'); // For API testing
    }

    // Python dependencies
    if (config.detectedLanguages.python) {
      if (config.pythonTestingFrameworks?.includes('pytest')) {
        dependencies.python.push('pytest', 'pytest-asyncio');
      }

      if (config.pythonTestingFrameworks?.includes('coverage')) {
        dependencies.python.push('coverage', 'pytest-cov');
      }

      if (config.pythonTestingFrameworks?.includes('black')) {
        dependencies.python.push('black');
      }

      if (config.pythonTestingFrameworks?.includes('mypy')) {
        dependencies.python.push('mypy');
      }

      // Framework-specific testing dependencies
      if (config.detectedFrameworks?.fastapi) {
        dependencies.python.push('httpx'); // For FastAPI testing
      }

      if (config.detectedFrameworks?.flask) {
        dependencies.python.push('flask-testing');
      }
    }

    return dependencies;
  }

  /**
   * Install NPM dependencies
   */
  async installNpmDependencies(packages) {
    if (packages.length === 0) return;

    this.prompter.showProgress(`Installing ${packages.length} npm packages...`);

    try {
      await this.runCommand('npm', ['install', '--save-dev', ...packages]);
      this.prompter.showProgress('NPM dependencies installed', true);
    } catch (error) {
      console.warn(chalk.yellow(`Warning: Some npm packages may have failed to install: ${error.message}`));
    }
  }

  /**
   * Install Python dependencies
   */
  async installPythonDependencies(packages) {
    if (packages.length === 0) return;

    this.prompter.showProgress(`Installing ${packages.length} Python packages...`);

    try {
      // Try pip install
      await this.runCommand('pip', ['install', ...packages]);
      this.prompter.showProgress('Python dependencies installed', true);
    } catch (error) {
      try {
        // Fallback to pip3
        await this.runCommand('pip3', ['install', ...packages]);
        this.prompter.showProgress('Python dependencies installed', true);
      } catch (error2) {
        console.warn(chalk.yellow(`Warning: Python packages may need to be installed manually: ${packages.join(', ')}`));
      }
    }
  }

  /**
   * Generate configuration files
   */
  async generateConfigurations(config) {
    this.prompter.showProgress('Generating configuration files...');

    try {
      // Update package.json scripts
      await this.updatePackageJsonScripts(config);

      // Create VSCode settings if not exists
      await this.createVSCodeSettings(config);

      // Create .env.test if needed
      await this.createTestEnvironmentFile(config);

      this.prompter.showProgress('Configuration files generated', true);
    } catch (error) {
      console.warn(chalk.yellow(`Warning: Some configuration files may not have been created: ${error.message}`));
    }
  }

  /**
   * Update package.json with testing scripts
   */
  async updatePackageJsonScripts(config) {
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    
    if (!await fs.pathExists(packageJsonPath)) {
      return;
    }

    try {
      const packageJson = await fs.readJson(packageJsonPath);
      
      if (!packageJson.scripts) {
        packageJson.scripts = {};
      }

      // Add testing scripts
      const newScripts = {
        'test': 'jest',
        'test:watch': 'jest --watch',
        'test:coverage': 'jest --coverage'
      };

      if (config.jsTestingFrameworks?.includes('playwright')) {
        newScripts['test:e2e'] = 'playwright test';
      }

      if (config.jsTestingFrameworks?.includes('cypress')) {
        newScripts['test:e2e'] = 'cypress run';
        newScripts['test:e2e:open'] = 'cypress open';
      }

      // Merge scripts without overwriting existing ones
      for (const [key, value] of Object.entries(newScripts)) {
        if (!packageJson.scripts[key]) {
          packageJson.scripts[key] = value;
        }
      }

      await fs.writeJson(packageJsonPath, packageJson, { spaces: 2 });
    } catch (error) {
      console.warn(`Could not update package.json: ${error.message}`);
    }
  }

  /**
   * Create VSCode settings for testing
   */
  async createVSCodeSettings(config) {
    const vscodeDir = path.join(process.cwd(), '.vscode');
    const settingsPath = path.join(vscodeDir, 'settings.json');

    await fs.ensureDir(vscodeDir);

    const settings = {
      'jest.jestCommandLine': 'npm test --',
      'jest.autoRun': 'watch',
      'python.testing.pytestEnabled': config.detectedLanguages.python,
      'python.testing.unittestEnabled': false,
      'typescript.preferences.includePackageJsonAutoImports': 'auto'
    };

    if (await fs.pathExists(settingsPath)) {
      // Merge with existing settings
      try {
        const existingSettings = await fs.readJson(settingsPath);
        Object.assign(existingSettings, settings);
        await fs.writeJson(settingsPath, existingSettings, { spaces: 2 });
      } catch (error) {
        console.warn(`Could not update VSCode settings: ${error.message}`);
      }
    } else {
      await fs.writeJson(settingsPath, settings, { spaces: 2 });
    }
  }

  /**
   * Create test environment file
   */
  async createTestEnvironmentFile(config) {
    const envTestPath = path.join(process.cwd(), '.env.test');
    
    if (await fs.pathExists(envTestPath)) {
      return; // Don't overwrite existing file
    }

    const envContent = [
      '# Test Environment Variables',
      '# Add test-specific environment variables here',
      '',
      'NODE_ENV=test',
      'DATABASE_URL=sqlite:///:memory:',
      'JWT_SECRET=test-secret-key',
      ''
    ].join('\n');

    await fs.writeFile(envTestPath, envContent);
  }

  /**
   * Initialize git repository if needed
   */
  async initializeGit(config) {
    if (await fs.pathExists(path.join(process.cwd(), '.git'))) {
      return; // Already a git repository
    }

    try {
      this.prompter.showProgress('Initializing git repository...');
      await this.runCommand('git', ['init']);
      await this.runCommand('git', ['add', '.']);
      await this.runCommand('git', ['commit', '-m', 'Initial commit: Add testing setup']);
      this.prompter.showProgress('Git repository initialized', true);
    } catch (error) {
      console.warn(chalk.yellow('Warning: Could not initialize git repository. You may need to do this manually.'));
    }
  }

  /**
   * Run a command and return a promise
   */
  runCommand(command, args, options = {}) {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        stdio: 'pipe',
        cwd: process.cwd(),
        ...options
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve({ stdout, stderr });
        } else {
          reject(new Error(`Command failed with code ${code}: ${stderr || stdout}`));
        }
      });

      child.on('error', (error) => {
        reject(error);
      });
    });
  }
}

// Run the initializer if this file is executed directly
if (require.main === module) {
  const initializer = new TestingTemplateInitializer();
  initializer.initialize().catch((error) => {
    console.error(chalk.red('Fatal error:'), error.message);
    process.exit(1);
  });
}

module.exports = TestingTemplateInitializer;