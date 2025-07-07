#!/usr/bin/env node

/**
 * Configuration Template Initialization Command
 *
 * Helps users quickly set up .claude-testing.config.json files
 * based on common project templates
 */

import { Command } from 'commander';
import * as fs from 'fs/promises';
import * as path from 'path';
import { createInterface } from 'readline';

interface TemplateInfo {
  name: string;
  description: string;
  filename: string;
  frameworks: string[];
  testFramework: string;
}

interface PackageJsonContent {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

interface ClaudeTestingConfig {
  ai?: {
    maxCost?: number;
  };
  coverage?: {
    thresholds?: {
      global?: {
        lines?: number;
      };
    };
  };
}

const AVAILABLE_TEMPLATES: TemplateInfo[] = [
  {
    name: 'React TypeScript',
    description: 'React application with TypeScript, Jest, and component testing',
    filename: 'react-typescript.json',
    frameworks: ['React', 'TypeScript', 'JSX'],
    testFramework: 'Jest',
  },
  {
    name: 'Vue TypeScript',
    description: 'Vue.js application with TypeScript, Vitest, and SFC support',
    filename: 'vue-typescript.json',
    frameworks: ['Vue.js', 'TypeScript', 'Composition API'],
    testFramework: 'Vitest',
  },
  {
    name: 'Next.js TypeScript',
    description: 'Next.js application with TypeScript, API routes, and SSR testing',
    filename: 'nextjs-typescript.json',
    frameworks: ['Next.js', 'React', 'TypeScript'],
    testFramework: 'Jest',
  },
  {
    name: 'Express TypeScript',
    description: 'Express.js API with TypeScript, middleware, and endpoint testing',
    filename: 'express-typescript.json',
    frameworks: ['Express.js', 'Node.js', 'TypeScript'],
    testFramework: 'Jest',
  },
  {
    name: 'Node.js JavaScript',
    description: 'Node.js application with JavaScript, API testing, and business logic',
    filename: 'node-javascript.json',
    frameworks: ['Node.js', 'JavaScript'],
    testFramework: 'Jest',
  },
  {
    name: 'Python Django',
    description: 'Django web application with pytest, models, views, and API testing',
    filename: 'python-django.json',
    frameworks: ['Django', 'Python'],
    testFramework: 'pytest',
  },
];

export class ConfigInitializer {
  private templatesDir: string;
  private targetPath: string;

  constructor(targetPath: string = process.cwd()) {
    this.targetPath = path.resolve(targetPath);
    this.templatesDir = path.join(__dirname, '../../../templates/config');
  }

  async run(options: { template?: string; force?: boolean; interactive?: boolean }): Promise<void> {
    console.log('🚀 Claude Testing Infrastructure - Configuration Setup\n');

    try {
      // Check if config already exists
      const configPath = path.join(this.targetPath, '.claude-testing.config.json');
      const configExists = await this.fileExists(configPath);

      if (configExists && !options.force) {
        console.log('⚠️  Configuration file already exists!');
        console.log(`   ${configPath}`);
        console.log('\n   Use --force to overwrite, or --interactive to customize.\n');
        return;
      }

      let templateChoice: TemplateInfo;

      if (options.template) {
        // Use specified template
        templateChoice = this.findTemplate(options.template);
      } else if (options.interactive) {
        // Interactive selection
        templateChoice = await this.interactiveSelection();
      } else {
        // Auto-detect project type
        templateChoice = await this.autoDetectTemplate();
      }

      await this.copyTemplate(templateChoice, configPath);

      if (options.interactive) {
        await this.customizeConfig(configPath);
      }

      await this.showNextSteps(templateChoice);
    } catch (error) {
      console.error(
        '❌ Configuration setup failed:',
        error instanceof Error ? error.message : String(error)
      );
      process.exit(1);
    }
  }

  private async fileExists(filepath: string): Promise<boolean> {
    try {
      await fs.access(filepath);
      return true;
    } catch {
      return false;
    }
  }

  private findTemplate(templateName: string): TemplateInfo {
    // Try exact match first
    let template = AVAILABLE_TEMPLATES.find(
      (t) =>
        t.name.toLowerCase() === templateName.toLowerCase() ||
        t.filename === templateName ||
        t.filename === `${templateName}.json`
    );

    if (!template) {
      // Try partial match
      template = AVAILABLE_TEMPLATES.find(
        (t) =>
          t.name.toLowerCase().includes(templateName.toLowerCase()) ||
          t.frameworks.some((f) => f.toLowerCase().includes(templateName.toLowerCase()))
      );
    }

    return template ?? AVAILABLE_TEMPLATES[0]!; // Default to first template
  }

  private listTemplates(): void {
    console.log('📋 Available Templates:\n');

    AVAILABLE_TEMPLATES.forEach((template, index) => {
      console.log(`   ${index + 1}. ${template.name}`);
      console.log(`      ${template.description}`);
      console.log(`      Frameworks: ${template.frameworks.join(', ')}`);
      console.log(`      Test Framework: ${template.testFramework}`);
      console.log('');
    });

    console.log('Usage: node dist/cli/index.js init-config --template "react-typescript"');
    console.log('   or: node dist/cli/index.js init-config --interactive\n');
  }

  private async interactiveSelection(): Promise<TemplateInfo> {
    console.log('📋 Available Project Templates:\n');

    AVAILABLE_TEMPLATES.forEach((template, index) => {
      console.log(`   ${index + 1}. ${template.name}`);
      console.log(`      ${template.description}`);
      console.log('');
    });

    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    return new Promise((resolve) => {
      rl.question('Select template number (1-6): ', (answer) => {
        rl.close();
        const choice = parseInt(answer.trim()) - 1;

        if (choice >= 0 && choice < AVAILABLE_TEMPLATES.length) {
          resolve(AVAILABLE_TEMPLATES[choice]!);
        } else {
          console.log('❌ Invalid selection, using React TypeScript template');
          resolve(AVAILABLE_TEMPLATES[0]!);
        }
      });
    });
  }

  private async autoDetectTemplate(): Promise<TemplateInfo> {
    console.log('🔍 Auto-detecting project type...\n');

    try {
      // Check for package.json
      const packageJsonPath = path.join(this.targetPath, 'package.json');
      if (await this.fileExists(packageJsonPath)) {
        const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8')) as PackageJsonContent;
        const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

        // Check for specific frameworks
        if (deps.next) {
          console.log('✅ Detected: Next.js project');
          return this.findTemplate('nextjs-typescript');
        }

        if (deps.react) {
          console.log('✅ Detected: React project');
          return this.findTemplate('react-typescript');
        }

        if (deps.vue) {
          console.log('✅ Detected: Vue.js project');
          return this.findTemplate('vue-typescript');
        }

        if (deps.express) {
          console.log('✅ Detected: Express.js project');
          return this.findTemplate('express-typescript');
        }

        console.log('✅ Detected: Node.js project');
        return this.findTemplate('node-javascript');
      }

      // Check for Python files
      const pythonFiles = await this.hasFilePattern('**/*.py');
      if (pythonFiles) {
        // Check for Django
        const djangoFiles =
          (await this.hasFilePattern('**/manage.py')) ||
          (await this.hasFilePattern('**/settings.py'));
        if (djangoFiles) {
          console.log('✅ Detected: Django project');
          return this.findTemplate('python-django');
        }
      }

      console.log('⚠️  Could not auto-detect project type, using React TypeScript template');
      return AVAILABLE_TEMPLATES[0]!;
    } catch (error) {
      console.log('⚠️  Auto-detection failed, using React TypeScript template');
      return AVAILABLE_TEMPLATES[0]!;
    }
  }

  private async hasFilePattern(pattern: string): Promise<boolean> {
    try {
      const files = await fs.readdir(this.targetPath, { recursive: true });
      return files.some((file) => file.toString().includes(pattern.replace('**/*', '')));
    } catch {
      return false;
    }
  }

  private async copyTemplate(template: TemplateInfo, configPath: string): Promise<void> {
    console.log(`📄 Using template: ${template.name}`);
    console.log(`   ${template.description}\n`);

    const templatePath = path.join(this.templatesDir, template.filename);

    try {
      const templateContent = await fs.readFile(templatePath, 'utf-8');
      await fs.writeFile(configPath, templateContent, 'utf-8');

      console.log('✅ Configuration file created successfully!');
      console.log(`   ${configPath}\n`);
    } catch (error) {
      throw new Error(
        `Failed to copy template: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async customizeConfig(configPath: string): Promise<void> {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    console.log('🔧 Configuration Customization (press Enter to keep defaults):\n');

    try {
      const config = JSON.parse(await fs.readFile(configPath, 'utf-8')) as ClaudeTestingConfig;

      // Customize key settings interactively
      const maxCost = await this.askQuestion(
        rl,
        `AI maximum cost (current: $${config.ai?.maxCost || 3.0}): `
      );
      if (maxCost.trim()) {
        config.ai = config.ai || {};
        config.ai.maxCost = parseFloat(maxCost);
      }

      const coverageLines = await this.askQuestion(
        rl,
        `Coverage lines threshold % (current: ${config.coverage?.thresholds?.global?.lines || 80}): `
      );
      if (coverageLines.trim()) {
        if (!config.coverage) {
          config.coverage = { thresholds: { global: {} } };
        }
        if (!config.coverage.thresholds) {
          config.coverage.thresholds = { global: {} };
        }
        if (!config.coverage.thresholds.global) {
          config.coverage.thresholds.global = {};
        }
        config.coverage.thresholds.global.lines = parseInt(coverageLines);
      }

      await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
      console.log('\n✅ Configuration customized successfully!\n');
    } catch (error) {
      console.log('⚠️  Customization failed, using template defaults\n');
    } finally {
      rl.close();
    }
  }

  private askQuestion(rl: ReturnType<typeof createInterface>, question: string): Promise<string> {
    return new Promise((resolve) => {
      rl.question(question, (answer: string) => {
        resolve(answer);
      });
    });
  }

  private async showNextSteps(template: TemplateInfo): Promise<void> {
    console.log('🎯 Next Steps:\n');
    console.log('1. Analyze your project:');
    console.log(`   node dist/cli/index.js analyze ${this.targetPath}\n`);

    console.log('2. Generate tests:');
    console.log(`   node dist/cli/index.js test ${this.targetPath}\n`);

    console.log('3. Run tests with coverage:');
    console.log(`   node dist/cli/index.js run ${this.targetPath} --coverage\n`);

    console.log('📖 Documentation:');
    console.log('   - Configuration Guide: docs/configuration.md');
    console.log('   - Template README: templates/config/README.md');
    console.log('   - Full Guide: AI_AGENT_GUIDE.md\n');

    console.log(`🔧 Template Info: ${template.filename}`);
    console.log(`   Frameworks: ${template.frameworks.join(', ')}`);
    console.log(`   Test Framework: ${template.testFramework}\n`);
  }
}

// Export command for CLI integration
export function createInitConfigCommand(): Command {
  return new Command('init-config')
    .description('Initialize .claude-testing.config.json with pre-configured templates')
    .argument('[path]', 'Target project path', process.cwd())
    .option('-t, --template <name>', 'Template name (react-typescript, vue-typescript, etc.)')
    .option('-f, --force', 'Overwrite existing configuration file')
    .option('-i, --interactive', 'Interactive template selection and customization')
    .option('-l, --list', 'List available templates')
    .action(
      async (
        targetPath: string,
        options: { template?: string; force?: boolean; interactive?: boolean; list?: boolean }
      ) => {
        if (options.list) {
          const initializer = new ConfigInitializer();
          initializer['listTemplates']();
          return;
        }

        const initializer = new ConfigInitializer(targetPath);
        await initializer.run(options);
      }
    );
}
