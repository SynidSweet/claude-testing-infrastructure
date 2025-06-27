const inquirer = require('inquirer');
const chalk = require('chalk');

/**
 * Interactive CLI prompting utilities
 */
class Prompter {
  constructor() {
    this.chalk = chalk;
  }

  /**
   * Welcome message and project analysis results
   */
  async showWelcome(analysis) {
    console.log(chalk.blue.bold('\n🤖 AI Testing Template Initializer\n'));
    console.log(chalk.gray('Analyzing your project structure...\n'));

    // Show detected languages
    if (analysis.javascript.isJavaScript) {
      console.log(chalk.green('✓ JavaScript/TypeScript project detected'));
      if (analysis.javascript.hasTypeScript) {
        console.log(chalk.blue('  → TypeScript support enabled'));
      }
      
      const frameworks = Object.entries(analysis.javascript.frameworks)
        .filter(([_, detected]) => detected)
        .map(([name]) => name);
      
      if (frameworks.length > 0) {
        console.log(chalk.blue(`  → Frameworks: ${frameworks.join(', ')}`));
      }
      console.log(chalk.blue(`  → Project Type: ${analysis.javascript.projectType}`));
    }

    if (analysis.python.isPython) {
      console.log(chalk.green('✓ Python project detected'));
      
      const frameworks = Object.entries(analysis.python.frameworks)
        .filter(([_, detected]) => detected)
        .map(([name]) => name);
      
      if (frameworks.length > 0) {
        console.log(chalk.blue(`  → Frameworks: ${frameworks.join(', ')}`));
      }
      console.log(chalk.blue(`  → Project Type: ${analysis.python.projectType}`));
    }

    if (analysis.testing.hasExistingTests) {
      console.log(chalk.yellow('⚠ Existing tests detected'));
      console.log(chalk.gray(`  → ${analysis.testing.testFiles.length} test files found`));
    }

    if (analysis.isEmpty) {
      console.log(chalk.yellow('⚠ No specific project structure detected'));
      console.log(chalk.gray('  → You can still initialize testing templates'));
    }

    console.log(''); // Empty line for spacing
  }

  /**
   * Prompts user for project configuration
   */
  async promptForConfiguration(analysis) {
    const questions = [];

    // If no project detected, ask for project type
    if (analysis.isEmpty) {
      questions.push({
        type: 'list',
        name: 'projectType',
        message: 'What type of project would you like to set up testing for?',
        choices: [
          { name: 'JavaScript Frontend (React, Vue, etc.)', value: 'javascript-frontend' },
          { name: 'JavaScript Backend (Node.js, Express, etc.)', value: 'javascript-backend' },
          { name: 'TypeScript Frontend', value: 'typescript-frontend' },
          { name: 'TypeScript Backend', value: 'typescript-backend' },
          { name: 'Python Backend (FastAPI, Flask, Django)', value: 'python-backend' },
          { name: 'Full-stack (Frontend + Backend)', value: 'fullstack' }
        ]
      });
    }

    // Language-specific questions
    if (analysis.javascript.isJavaScript || analysis.isEmpty) {
      questions.push({
        type: 'checkbox',
        name: 'jsTestingFrameworks',
        message: 'Which JavaScript testing frameworks would you like to include?',
        choices: [
          { name: 'Jest (Unit & Integration Testing)', value: 'jest', checked: true },
          { name: 'React Testing Library (Component Testing)', value: 'rtl', checked: analysis.javascript.frameworks?.react },
          { name: 'Playwright (E2E Testing)', value: 'playwright', checked: false },
          { name: 'Cypress (E2E Testing)', value: 'cypress', checked: false },
          { name: 'Vitest (Vite-based Testing)', value: 'vitest', checked: analysis.javascript.frameworks?.vite }
        ],
        when: (answers) => {
          return analysis.javascript.isJavaScript || 
                 answers.projectType?.includes('javascript') || 
                 answers.projectType?.includes('typescript');
        }
      });
    }

    if (analysis.python.isPython || analysis.isEmpty) {
      questions.push({
        type: 'checkbox',
        name: 'pythonTestingFrameworks',
        message: 'Which Python testing frameworks would you like to include?',
        choices: [
          { name: 'pytest (Recommended)', value: 'pytest', checked: true },
          { name: 'unittest (Standard Library)', value: 'unittest', checked: false },
          { name: 'coverage.py (Code Coverage)', value: 'coverage', checked: true },
          { name: 'Black (Code Formatting)', value: 'black', checked: true },
          { name: 'mypy (Type Checking)', value: 'mypy', checked: false }
        ],
        when: (answers) => {
          return analysis.python.isPython || answers.projectType?.includes('python');
        }
      });
    }

    // CI/CD configuration
    questions.push({
      type: 'list',
      name: 'ciProvider',
      message: 'Which CI/CD provider would you like to configure?',
      choices: [
        { name: 'GitHub Actions', value: 'github' },
        { name: 'GitLab CI', value: 'gitlab' },
        { name: 'CircleCI', value: 'circleci' },
        { name: 'None (Skip CI/CD setup)', value: 'none' }
      ],
      default: 'github'
    });

    // Test structure preferences
    questions.push({
      type: 'list',
      name: 'testStructure',
      message: 'How would you like to organize your tests?',
      choices: [
        { name: 'Separate test directory (recommended)', value: 'separate' },
        { name: 'Co-located with source files', value: 'colocated' },
        { name: 'Both (flexible structure)', value: 'mixed' }
      ],
      default: 'separate'
    });

    // Advanced features
    questions.push({
      type: 'checkbox',
      name: 'advancedFeatures',
      message: 'Which advanced testing features would you like to include?',
      choices: [
        { name: 'Code coverage reporting', value: 'coverage', checked: true },
        { name: 'Visual regression testing', value: 'visual', checked: false },
        { name: 'Performance testing setup', value: 'performance', checked: false },
        { name: 'Accessibility testing', value: 'accessibility', checked: false },
        { name: 'Database testing utilities', value: 'database', checked: false }
      ]
    });

    // Existing tests handling
    if (analysis.testing.hasExistingTests) {
      questions.push({
        type: 'list',
        name: 'existingTestsAction',
        message: 'How should we handle your existing tests?',
        choices: [
          { name: 'Keep existing tests and add new templates', value: 'keep' },
          { name: 'Backup existing tests and replace with templates', value: 'backup' },
          { name: 'Skip areas with existing tests', value: 'skip' }
        ],
        default: 'keep'
      });
    }

    const answers = await inquirer.prompt(questions);
    
    // Post-process answers
    return this.processAnswers(answers, analysis);
  }

  /**
   * Process and validate user answers
   */
  processAnswers(answers, analysis) {
    const config = {
      ...answers,
      detectedLanguages: {
        javascript: analysis.javascript.isJavaScript,
        python: analysis.python.isPython,
        typescript: analysis.javascript.hasTypeScript
      },
      detectedFrameworks: {
        ...analysis.javascript.frameworks,
        ...analysis.python.frameworks
      },
      projectAnalysis: analysis
    };

    // Determine final project types to set up
    config.setupTypes = this.determineSetupTypes(config, analysis);
    
    return config;
  }

  /**
   * Determine which project types to set up based on detection and user input
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
        // Default to frontend if React-like dependencies found
        if (config.jsTestingFrameworks?.includes('rtl')) {
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

    return [...new Set(types)]; // Remove duplicates
  }

  /**
   * Confirmation prompt before proceeding with installation
   */
  async confirmInstallation(config) {
    console.log(chalk.blue.bold('\n📋 Installation Summary\n'));
    
    console.log(chalk.white('Project Types:'));
    config.setupTypes.forEach(type => {
      console.log(chalk.green(`  ✓ ${type}`));
    });

    if (config.jsTestingFrameworks?.length > 0) {
      console.log(chalk.white('\nJavaScript Testing:'));
      config.jsTestingFrameworks.forEach(framework => {
        console.log(chalk.green(`  ✓ ${framework}`));
      });
    }

    if (config.pythonTestingFrameworks?.length > 0) {
      console.log(chalk.white('\nPython Testing:'));
      config.pythonTestingFrameworks.forEach(framework => {
        console.log(chalk.green(`  ✓ ${framework}`));
      });
    }

    if (config.ciProvider !== 'none') {
      console.log(chalk.white(`\nCI/CD: ${config.ciProvider}`));
    }

    if (config.advancedFeatures?.length > 0) {
      console.log(chalk.white('\nAdvanced Features:'));
      config.advancedFeatures.forEach(feature => {
        console.log(chalk.green(`  ✓ ${feature}`));
      });
    }

    const { confirmed } = await inquirer.prompt([{
      type: 'confirm',
      name: 'confirmed',
      message: 'Proceed with the installation?',
      default: true
    }]);

    return confirmed;
  }

  /**
   * Display progress during installation
   */
  showProgress(message, isComplete = false) {
    if (isComplete) {
      console.log(chalk.green(`✓ ${message}`));
    } else {
      console.log(chalk.blue(`→ ${message}`));
    }
  }

  /**
   * Display completion message
   */
  showCompletion(config) {
    console.log(chalk.green.bold('\n🎉 Testing setup complete!\n'));
    
    console.log(chalk.white('Next steps:'));
    console.log(chalk.blue('1. Review the generated test files and configurations'));
    console.log(chalk.blue('2. Read AGENT_TEST_GUIDE.md for testing methodology'));
    console.log(chalk.blue('3. Run your first tests to verify the setup'));
    
    if (config.setupTypes.includes('javascript-frontend') || config.setupTypes.includes('typescript-frontend')) {
      console.log(chalk.gray('\nFrontend testing commands:'));
      console.log(chalk.gray('  npm test              # Run unit tests'));
      console.log(chalk.gray('  npm run test:watch    # Run tests in watch mode'));
      if (config.jsTestingFrameworks?.includes('playwright')) {
        console.log(chalk.gray('  npm run test:e2e      # Run E2E tests'));
      }
    }

    if (config.setupTypes.includes('javascript-backend') || config.setupTypes.includes('typescript-backend')) {
      console.log(chalk.gray('\nBackend testing commands:'));
      console.log(chalk.gray('  npm test              # Run all tests'));
      console.log(chalk.gray('  npm run test:unit     # Run unit tests'));
      console.log(chalk.gray('  npm run test:integration # Run integration tests'));
    }

    if (config.setupTypes.includes('python-backend')) {
      console.log(chalk.gray('\nPython testing commands:'));
      console.log(chalk.gray('  pytest                # Run all tests'));
      console.log(chalk.gray('  pytest --cov          # Run tests with coverage'));
      console.log(chalk.gray('  pytest -v             # Run tests verbosely'));
    }

    console.log(chalk.yellow('\n💡 Tip: Check out the examples/ directory for complete working examples!'));
  }

  /**
   * Display error message
   */
  showError(message, error = null) {
    console.log(chalk.red.bold(`\n❌ ${message}`));
    if (error) {
      console.log(chalk.red(error.message));
      if (process.env.DEBUG) {
        console.log(chalk.gray(error.stack));
      }
    }
  }
}

module.exports = Prompter;