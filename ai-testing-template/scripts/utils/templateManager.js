const fs = require('fs-extra');
const path = require('path');
const glob = require('glob');

/**
 * Template management utilities for copying and configuring test templates
 */
class TemplateManager {
  constructor(templateBasePath) {
    this.templateBasePath = templateBasePath || path.join(__dirname, '..', '..', 'templates');
    this.targetPath = process.cwd();
  }

  /**
   * Copy templates based on configuration
   */
  async copyTemplates(config) {
    const operations = [];

    for (const setupType of config.setupTypes) {
      const templateOps = await this.getTemplateOperations(setupType, config);
      operations.push(...templateOps);
    }

    // Execute copy operations
    for (const operation of operations) {
      await this.executeCopyOperation(operation);
    }

    return operations;
  }

  /**
   * Get template copy operations for a specific setup type
   */
  async getTemplateOperations(setupType, config) {
    const operations = [];

    switch (setupType) {
      case 'javascript-frontend':
      case 'typescript-frontend':
        operations.push(...await this.getFrontendTemplateOperations(setupType, config));
        break;
      
      case 'javascript-backend':
      case 'typescript-backend':
        operations.push(...await this.getBackendTemplateOperations(setupType, config));
        break;
      
      case 'python-backend':
        operations.push(...await this.getPythonTemplateOperations(config));
        break;
      
      case 'fullstack':
        operations.push(...await this.getFullstackTemplateOperations(config));
        break;
    }

    // Add common templates
    operations.push(...await this.getCommonTemplateOperations(config));

    return operations;
  }

  /**
   * Get frontend template operations
   */
  async getFrontendTemplateOperations(setupType, config) {
    const operations = [];
    const isTypeScript = setupType.includes('typescript');
    const sourcePath = path.join(this.templateBasePath, 'javascript', 'frontend');

    // Base test setup
    operations.push({
      type: 'copy',
      source: path.join(sourcePath, 'jest.config.js'),
      target: path.join(this.targetPath, 'jest.config.js'),
      variables: {
        typescript: isTypeScript,
        testEnvironment: 'jsdom'
      }
    });

    // Test utilities
    operations.push({
      type: 'copy',
      source: path.join(sourcePath, 'src', 'test-utils'),
      target: path.join(this.targetPath, 'src', 'test-utils'),
      variables: { typescript: isTypeScript }
    });

    // Example tests
    if (config.jsTestingFrameworks?.includes('rtl')) {
      operations.push({
        type: 'copy',
        source: path.join(sourcePath, 'src', 'components', '__tests__'),
        target: path.join(this.targetPath, 'src', 'components', '__tests__'),
        variables: { typescript: isTypeScript }
      });
    }

    // E2E testing setup
    if (config.jsTestingFrameworks?.includes('playwright')) {
      operations.push({
        type: 'copy',
        source: path.join(sourcePath, 'playwright'),
        target: path.join(this.targetPath, 'tests'),
        variables: { typescript: isTypeScript }
      });
    }

    if (config.jsTestingFrameworks?.includes('cypress')) {
      operations.push({
        type: 'copy',
        source: path.join(sourcePath, 'cypress'),
        target: path.join(this.targetPath, 'cypress'),
        variables: { typescript: isTypeScript }
      });
    }

    return operations;
  }

  /**
   * Get backend template operations
   */
  async getBackendTemplateOperations(setupType, config) {
    const operations = [];
    const isTypeScript = setupType.includes('typescript');
    const sourcePath = path.join(this.templateBasePath, 'javascript', 'backend');

    // Jest configuration for Node.js
    operations.push({
      type: 'copy',
      source: path.join(sourcePath, 'jest.config.js'),
      target: path.join(this.targetPath, 'jest.config.js'),
      variables: {
        typescript: isTypeScript,
        testEnvironment: 'node'
      }
    });

    // Test setup and utilities
    operations.push({
      type: 'copy',
      source: path.join(sourcePath, 'tests', 'setup.js'),
      target: path.join(this.targetPath, 'tests', 'setup.js'),
      variables: { typescript: isTypeScript }
    });

    operations.push({
      type: 'copy',
      source: path.join(sourcePath, 'tests', 'utils'),
      target: path.join(this.targetPath, 'tests', 'utils'),
      variables: { typescript: isTypeScript }
    });

    // Example tests
    operations.push({
      type: 'copy',
      source: path.join(sourcePath, 'tests', 'unit'),
      target: path.join(this.targetPath, 'tests', 'unit'),
      variables: { typescript: isTypeScript }
    });

    operations.push({
      type: 'copy',
      source: path.join(sourcePath, 'tests', 'integration'),
      target: path.join(this.targetPath, 'tests', 'integration'),
      variables: { typescript: isTypeScript }
    });

    return operations;
  }

  /**
   * Get Python template operations
   */
  async getPythonTemplateOperations(config) {
    const operations = [];
    const sourcePath = path.join(this.templateBasePath, 'python', 'backend');

    // pytest configuration
    operations.push({
      type: 'copy',
      source: path.join(sourcePath, 'pytest.ini'),
      target: path.join(this.targetPath, 'pytest.ini'),
      variables: {
        coverage: config.pythonTestingFrameworks?.includes('coverage'),
        asyncio: config.detectedFrameworks?.fastapi
      }
    });

    // Test configuration
    operations.push({
      type: 'copy',
      source: path.join(sourcePath, 'conftest.py'),
      target: path.join(this.targetPath, 'conftest.py'),
      variables: {
        fastapi: config.detectedFrameworks?.fastapi,
        flask: config.detectedFrameworks?.flask,
        django: config.detectedFrameworks?.django
      }
    });

    // Test directories and examples
    operations.push({
      type: 'copy',
      source: path.join(sourcePath, 'tests'),
      target: path.join(this.targetPath, 'tests'),
      variables: {
        framework: this.detectPrimaryPythonFramework(config.detectedFrameworks)
      }
    });

    return operations;
  }

  /**
   * Get fullstack template operations
   */
  async getFullstackTemplateOperations(config) {
    const operations = [];
    
    // Combine frontend and backend operations
    operations.push(...await this.getFrontendTemplateOperations('javascript-frontend', config));
    operations.push(...await this.getBackendTemplateOperations('javascript-backend', config));
    
    // Add fullstack-specific configurations
    const sourcePath = path.join(this.templateBasePath, 'common', 'fullstack');
    
    operations.push({
      type: 'copy',
      source: path.join(sourcePath, 'package.json.template'),
      target: path.join(this.targetPath, 'package.json'),
      variables: {
        merge: true, // Merge with existing package.json
        scripts: {
          'test:frontend': 'cd frontend && npm test',
          'test:backend': 'cd backend && npm test',
          'test:e2e': 'playwright test',
          'test:all': 'npm run test:frontend && npm run test:backend && npm run test:e2e'
        }
      }
    });

    return operations;
  }

  /**
   * Get common template operations
   */
  async getCommonTemplateOperations(config) {
    const operations = [];
    const sourcePath = path.join(this.templateBasePath, 'common');

    // CI/CD templates
    if (config.ciProvider === 'github') {
      operations.push({
        type: 'copy',
        source: path.join(sourcePath, 'github', 'workflows'),
        target: path.join(this.targetPath, '.github', 'workflows'),
        variables: {
          javascript: config.detectedLanguages.javascript,
          python: config.detectedLanguages.python,
          coverage: config.advancedFeatures?.includes('coverage')
        }
      });
    }

    // Code coverage configuration
    if (config.advancedFeatures?.includes('coverage')) {
      if (config.detectedLanguages.javascript) {
        operations.push({
          type: 'copy',
          source: path.join(sourcePath, 'coverage', 'jest-coverage.json'),
          target: path.join(this.targetPath, 'coverage.config.js'),
          variables: {}
        });
      }
    }

    // VSCode configuration
    operations.push({
      type: 'copy',
      source: path.join(sourcePath, 'vscode'),
      target: path.join(this.targetPath, '.vscode'),
      variables: {
        javascript: config.detectedLanguages.javascript,
        python: config.detectedLanguages.python
      }
    });

    return operations;
  }

  /**
   * Execute a single copy operation
   */
  async executeCopyOperation(operation) {
    try {
      // Ensure target directory exists
      await fs.ensureDir(path.dirname(operation.target));

      if (operation.type === 'copy') {
        // Check if source exists (it might not exist yet in our template)
        if (await fs.pathExists(operation.source)) {
          if (operation.variables?.merge && await fs.pathExists(operation.target)) {
            // Handle file merging (e.g., package.json)
            await this.mergeFiles(operation.source, operation.target, operation.variables);
          } else {
            // Regular copy with variable substitution
            await this.copyWithVariables(operation.source, operation.target, operation.variables);
          }
        } else {
          // Create placeholder file for now
          await this.createPlaceholderFile(operation.target, operation);
        }
      }
    } catch (error) {
      console.warn(`Warning: Could not copy ${operation.source} to ${operation.target}: ${error.message}`);
    }
  }

  /**
   * Copy files with variable substitution
   */
  async copyWithVariables(source, target, variables = {}) {
    const stats = await fs.stat(source);
    
    if (stats.isDirectory()) {
      // Copy directory recursively
      await fs.copy(source, target, {
        filter: (src) => !src.includes('node_modules') && !src.includes('.git')
      });
      
      // Process variables in all files
      const files = glob.sync('**/*', { cwd: target, nodir: true });
      for (const file of files) {
        const filePath = path.join(target, file);
        await this.processVariablesInFile(filePath, variables);
      }
    } else {
      // Copy single file
      await fs.copy(source, target);
      await this.processVariablesInFile(target, variables);
    }
  }

  /**
   * Process variables in a file
   */
  async processVariablesInFile(filePath, variables) {
    try {
      let content = await fs.readFile(filePath, 'utf-8');
      
      // Replace variables in content
      for (const [key, value] of Object.entries(variables)) {
        const regex = new RegExp(`{{${key}}}`, 'g');
        content = content.replace(regex, value);
      }
      
      // Handle conditional blocks
      content = this.processConditionalBlocks(content, variables);
      
      await fs.writeFile(filePath, content);
    } catch (error) {
      // Skip binary files or files that can't be processed
      if (!error.message.includes('binary')) {
        console.warn(`Warning: Could not process variables in ${filePath}: ${error.message}`);
      }
    }
  }

  /**
   * Process conditional blocks in template content
   */
  processConditionalBlocks(content, variables) {
    // Handle {{#if condition}} blocks
    const ifRegex = /{{#if\s+(\w+)}}([\s\S]*?){{\/if}}/g;
    content = content.replace(ifRegex, (match, condition, block) => {
      return variables[condition] ? block : '';
    });

    // Handle {{#unless condition}} blocks
    const unlessRegex = /{{#unless\s+(\w+)}}([\s\S]*?){{\/unless}}/g;
    content = content.replace(unlessRegex, (match, condition, block) => {
      return !variables[condition] ? block : '';
    });

    return content;
  }

  /**
   * Merge configuration files (like package.json)
   */
  async mergeFiles(source, target, variables) {
    if (path.extname(source) === '.json' || source.includes('package.json')) {
      await this.mergeJsonFiles(source, target, variables);
    } else {
      // For other files, just copy with variables
      await this.copyWithVariables(source, target, variables);
    }
  }

  /**
   * Merge JSON files (primarily package.json)
   */
  async mergeJsonFiles(source, target, variables) {
    try {
      const sourceContent = await fs.readJson(source);
      const targetContent = await fs.readJson(target);

      // Merge specific sections
      if (variables.scripts) {
        targetContent.scripts = { ...targetContent.scripts, ...variables.scripts };
      }

      if (sourceContent.devDependencies) {
        targetContent.devDependencies = { 
          ...targetContent.devDependencies, 
          ...sourceContent.devDependencies 
        };
      }

      if (sourceContent.dependencies) {
        targetContent.dependencies = { 
          ...targetContent.dependencies, 
          ...sourceContent.dependencies 
        };
      }

      await fs.writeJson(target, targetContent, { spaces: 2 });
    } catch (error) {
      console.warn(`Warning: Could not merge JSON files: ${error.message}`);
      // Fallback to regular copy
      await this.copyWithVariables(source, target, variables);
    }
  }

  /**
   * Create placeholder file for templates that don't exist yet
   */
  async createPlaceholderFile(target, operation) {
    const ext = path.extname(target);
    let content = '';

    if (ext === '.js') {
      content = `// TODO: Implement ${path.basename(target)}\n// Generated by AI Testing Template\n`;
    } else if (ext === '.py') {
      content = `# TODO: Implement ${path.basename(target)}\n# Generated by AI Testing Template\n`;
    } else if (ext === '.json') {
      content = '{}';
    } else {
      content = `# TODO: Implement ${path.basename(target)}\n# Generated by AI Testing Template\n`;
    }

    await fs.writeFile(target, content);
  }

  /**
   * Detect primary Python framework
   */
  detectPrimaryPythonFramework(frameworks) {
    if (frameworks?.fastapi) return 'fastapi';
    if (frameworks?.flask) return 'flask';
    if (frameworks?.django) return 'django';
    return 'generic';
  }
}

module.exports = TemplateManager;