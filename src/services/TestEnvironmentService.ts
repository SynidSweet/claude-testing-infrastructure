import { fs, path } from '../utils/common-imports';
import { logger } from '../utils/common-imports';
import type { ProjectAnalysis } from '../analyzers/ProjectAnalyzer';
import type { TestGeneratorConfig } from '../generators/TestGenerator';

export interface TestEnvironmentConfig {
  /** Project analysis results */
  analysis: ProjectAnalysis;
  /** Test generator configuration */
  config: TestGeneratorConfig;
  /** Skip environment setup in dry-run mode */
  dryRun?: boolean;
}

/**
 * Service responsible for creating test execution environments
 * 
 * This service handles the creation of package.json, test framework configurations,
 * and other files necessary for running tests in a decoupled environment.
 */
export class TestEnvironmentService {
  private analysis: ProjectAnalysis;
  private config: TestGeneratorConfig;
  private dryRun: boolean;

  constructor(environmentConfig: TestEnvironmentConfig) {
    this.analysis = environmentConfig.analysis;
    this.config = environmentConfig.config;
    this.dryRun = environmentConfig.dryRun || false;
  }

  /**
   * Create the complete test execution environment
   */
  async createEnvironment(): Promise<void> {
    if (this.dryRun) {
      logger.info('Dry run: would create test environment');
      return;
    }

    try {
      await this.createTestEnvironment();
    } catch (error) {
      logger.warn('Failed to create test environment', { error });
      // Don't throw - continue with test generation even if environment setup fails
    }
  }

  /**
   * Create test execution environment with package.json and framework config
   */
  private async createTestEnvironment(): Promise<void> {
    const outputPath = this.config.outputPath;

    // Ensure output directory exists
    await fs.mkdir(outputPath, { recursive: true });

    // Create package.json for the test directory
    await this.createTestPackageJson(outputPath);

    // Create test framework configuration
    await this.createTestFrameworkConfig(outputPath);

    logger.info(`Created test environment at ${outputPath}`);
  }

  /**
   * Create package.json for the test directory
   */
  private async createTestPackageJson(outputPath: string): Promise<void> {
    const packageJsonPath = path.join(outputPath, 'package.json');

    // Check if package.json already exists
    try {
      await fs.access(packageJsonPath);
      return; // Already exists, don't overwrite
    } catch {
      // Doesn't exist, create it
    }

    const packageConfig = {
      name: `${path.basename(this.config.projectPath)}-tests`,
      version: '1.0.0',
      description: 'Generated tests for ' + path.basename(this.config.projectPath),
      private: true,
      scripts: this.getTestScripts(),
      devDependencies: this.getTestDependencies(),
      jest: this.config.testFramework === 'jest' ? this.getJestConfig() : undefined,
    };

    // Remove undefined values
    Object.keys(packageConfig).forEach((key) => {
      if (packageConfig[key as keyof typeof packageConfig] === undefined) {
        delete packageConfig[key as keyof typeof packageConfig];
      }
    });

    await fs.writeFile(packageJsonPath, JSON.stringify(packageConfig, null, 2), 'utf-8');
    logger.debug(`Created package.json at ${packageJsonPath}`);
  }

  /**
   * Get test scripts based on framework
   */
  private getTestScripts(): Record<string, string> {
    switch (this.config.testFramework) {
      case 'jest':
        return {
          test: 'jest',
          'test:watch': 'jest --watch',
          'test:coverage': 'jest --coverage',
        };
      case 'pytest':
        return {
          test: 'pytest',
          'test:coverage': 'pytest --cov',
        };
      case 'vitest':
        return {
          test: 'vitest run',
          'test:watch': 'vitest',
          'test:coverage': 'vitest run --coverage',
        };
      default:
        return {
          test: this.config.testFramework || 'jest',
        };
    }
  }

  /**
   * Get test dependencies based on detected languages and frameworks
   */
  private getTestDependencies(): Record<string, string> {
    const deps: Record<string, string> = {};

    // Add test framework dependencies
    switch (this.config.testFramework) {
      case 'jest':
        deps.jest = '^29.7.0';
        deps['@types/jest'] = '^29.5.5';
        break;
      case 'vitest':
        deps.vitest = '^0.34.0';
        break;
    }

    // Add language-specific dependencies
    const languages = this.analysis.languages.map((l) => l.name);
    const frameworks = this.analysis.frameworks.map((f) => f.name);

    if (languages.includes('typescript')) {
      deps.typescript = '^5.2.0';
      deps['ts-jest'] = '^29.1.0';
      deps['@types/node'] = '^20.6.0';
    }

    if (frameworks.includes('react')) {
      deps['@testing-library/react'] = '^13.4.0';
      deps['@testing-library/jest-dom'] = '^6.1.0';
      deps['@testing-library/user-event'] = '^14.5.0';
    }

    if (frameworks.includes('vue')) {
      deps['@vue/test-utils'] = '^2.4.0';
    }

    if (frameworks.includes('angular')) {
      deps['@angular/testing'] = '^16.0.0';
    }

    // Add common utilities
    if (this.config.testFramework === 'jest') {
      deps['jest-environment-jsdom'] = '^29.7.0';
    }

    return deps;
  }

  /**
   * Get Jest configuration
   */
  private getJestConfig(): any {
    const languages = this.analysis.languages.map((l) => l.name);
    const frameworks = this.analysis.frameworks.map((f) => f.name);

    const config: any = {
      testEnvironment:
        frameworks.includes('react') || frameworks.includes('vue') ? 'jsdom' : 'node',
      collectCoverageFrom: [
        '**/*.{js,jsx,ts,tsx}',
        '!**/*.d.ts',
        '!**/node_modules/**',
        '!**/coverage/**',
      ],
      testMatch: ['**/*.test.{js,jsx,ts,tsx}', '**/*.spec.{js,jsx,ts,tsx}'],
      moduleFileExtensions: ['js', 'jsx', 'json', 'node'],
    };

    if (languages.includes('typescript')) {
      config.preset = 'ts-jest';
      config.moduleFileExtensions.push('ts', 'tsx');
      config.transform = {
        '^.+\\.tsx?$': 'ts-jest',
      };
    }

    if (frameworks.includes('react')) {
      config.setupFilesAfterEnv = ['<rootDir>/jest.setup.js'];
    }

    return config;
  }

  /**
   * Create test framework configuration files
   */
  private async createTestFrameworkConfig(outputPath: string): Promise<void> {
    const frameworks = this.analysis.frameworks.map((f) => f.name);

    // Create Jest setup file for React projects
    if (this.config.testFramework === 'jest' && frameworks.includes('react')) {
      const setupPath = path.join(outputPath, 'jest.setup.js');

      try {
        await fs.access(setupPath);
        return; // Already exists
      } catch {
        // Create setup file
        const setupContent = `import '@testing-library/jest-dom';

// Global test configuration
global.ResizeObserver = class ResizeObserver {
  constructor(callback) {
    this.callback = callback;
  }
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});
`;

        await fs.writeFile(setupPath, setupContent, 'utf-8');
        logger.debug(`Created Jest setup file at ${setupPath}`);
      }
    }

    // Create TypeScript config for TypeScript projects
    const languages = this.analysis.languages.map((l) => l.name);
    if (languages.includes('typescript')) {
      const tsconfigPath = path.join(outputPath, 'tsconfig.json');

      try {
        await fs.access(tsconfigPath);
        return; // Already exists
      } catch {
        const tsconfigContent = {
          compilerOptions: {
            target: 'es2020',
            module: 'commonjs',
            lib: ['es2020', 'dom'],
            allowJs: true,
            skipLibCheck: true,
            esModuleInterop: true,
            allowSyntheticDefaultImports: true,
            strict: true,
            forceConsistentCasingInFileNames: true,
            moduleResolution: 'node',
            resolveJsonModule: true,
            isolatedModules: true,
            noEmit: true,
            jsx: frameworks.includes('react') ? 'react-jsx' : undefined,
          },
          include: ['**/*'],
          exclude: ['node_modules', 'coverage'],
        };

        // Remove undefined values
        Object.keys(tsconfigContent.compilerOptions).forEach((key) => {
          if (
            tsconfigContent.compilerOptions[key as keyof typeof tsconfigContent.compilerOptions] ===
            undefined
          ) {
            delete tsconfigContent.compilerOptions[
              key as keyof typeof tsconfigContent.compilerOptions
            ];
          }
        });

        await fs.writeFile(tsconfigPath, JSON.stringify(tsconfigContent, null, 2), 'utf-8');
        logger.debug(`Created TypeScript config at ${tsconfigPath}`);
      }
    }
  }
}