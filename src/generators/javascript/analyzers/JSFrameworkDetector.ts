import { logger } from '../../../utils/common-imports';
import type { DetectedFramework, PackageJsonContent } from '../../../analyzers/ProjectAnalyzer';

/**
 * Enhanced JavaScript/TypeScript framework detector
 *
 * Provides comprehensive framework detection capabilities for:
 * - UI frameworks (React, Vue, Angular, Svelte, etc.)
 * - Backend frameworks (Express, NestJS, Koa, Fastify, etc.)
 * - Meta-frameworks (Next.js, Nuxt, Gatsby, etc.)
 * - Testing frameworks (Jest, Vitest, Mocha, Jasmine, etc.)
 * - Build tools (Vite, Webpack, etc.)
 */
export class JSFrameworkDetector {
  private packageJson: PackageJsonContent;

  constructor(_projectPath: string, packageJson: PackageJsonContent | null = null) {
    this.packageJson = packageJson ?? {} as PackageJsonContent;
  }

  /**
   * Detect all JavaScript frameworks in the project
   */
  async detectFrameworks(): Promise<DetectedFramework[]> {
    const frameworks: DetectedFramework[] = [];

    // Detect meta-frameworks first (they might imply UI frameworks)
    const metaFrameworks = await this.detectMetaFrameworks();
    frameworks.push(...metaFrameworks);

    // Detect UI frameworks
    const uiFrameworks = await this.detectUIFrameworks();
    // Only add UI frameworks that aren't already detected by meta-frameworks
    for (const uiFramework of uiFrameworks) {
      if (!this.hasFramework(frameworks, uiFramework.name)) {
        frameworks.push(uiFramework);
      }
    }

    // Detect backend frameworks
    const backendFrameworks = await this.detectBackendFrameworks();
    frameworks.push(...backendFrameworks);

    // Sort by confidence
    return frameworks.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Detect testing frameworks specifically
   */
  async detectTestingFrameworks(): Promise<string[]> {
    const testFrameworks: string[] = [];
    const deps = this.getAllDependencies();

    // Jest and related
    if (deps.jest || deps['@jest/core']) {
      testFrameworks.push('jest');
    }

    // Vitest
    if (deps.vitest) {
      testFrameworks.push('vitest');
    }

    // Mocha
    if (deps.mocha) {
      testFrameworks.push('mocha');
    }

    // Jasmine
    if (deps.jasmine || deps['jasmine-core']) {
      testFrameworks.push('jasmine');
    }

    // Testing Library
    if (
      deps['@testing-library/react'] ||
      deps['@testing-library/vue'] ||
      deps['@testing-library/angular']
    ) {
      testFrameworks.push('testing-library');
    }

    // Cypress
    if (deps.cypress) {
      testFrameworks.push('cypress');
    }

    // Playwright
    if (deps.playwright || deps['@playwright/test']) {
      testFrameworks.push('playwright');
    }

    // Puppeteer
    if (deps.puppeteer) {
      testFrameworks.push('puppeteer');
    }

    // Karma
    if (deps.karma) {
      testFrameworks.push('karma');
    }

    // AVA
    if (deps.ava) {
      testFrameworks.push('ava');
    }

    // Tape
    if (deps.tape) {
      testFrameworks.push('tape');
    }

    return testFrameworks;
  }

  /**
   * Get preferred test framework based on what's installed
   */
  async getPreferredTestFramework(): Promise<string> {
    const testFrameworks = await this.detectTestingFrameworks();

    // Priority order
    const priorityOrder = ['vitest', 'jest', 'mocha', 'jasmine', 'ava', 'tape', 'karma'];

    for (const framework of priorityOrder) {
      if (testFrameworks.includes(framework)) {
        return framework;
      }
    }

    // Default to jest if none found
    return 'jest';
  }

  /**
   * Detect UI frameworks
   */
  private async detectUIFrameworks(): Promise<DetectedFramework[]> {
    const frameworks: DetectedFramework[] = [];
    const deps = this.getAllDependencies();

    // React
    if (deps.react || deps['@types/react']) {
      const framework: DetectedFramework = {
        name: 'react',
        confidence: 0.95,
        configFiles: [],
      };
      const version = deps.react || deps['react-dom'];
      if (version) {
        framework.version = version;
      }
      frameworks.push(framework);
    }

    // Vue
    if (deps.vue || deps['@vue/cli'] || deps['vue-demi']) {
      const vueVersion = deps.vue || '';
      const isVue3 = vueVersion.startsWith('3') || deps['@vue/composition-api'];

      const framework: DetectedFramework = {
        name: 'vue',
        confidence: 0.95,
        configFiles: [],
      };
      if (vueVersion) {
        framework.version = vueVersion;
      }
      frameworks.push(framework);

      // Store Vue version info for later use
      if (isVue3) {
        logger.debug('Detected Vue 3');
      }
    }

    // Angular
    if (deps['@angular/core'] || deps['@angular/cli']) {
      const framework: DetectedFramework = {
        name: 'angular',
        confidence: 0.95,
        configFiles: [],
      };
      if (deps['@angular/core']) {
        framework.version = deps['@angular/core'];
      }
      frameworks.push(framework);
    }

    // Svelte
    if (deps.svelte || deps['@sveltejs/kit']) {
      const framework: DetectedFramework = {
        name: 'svelte',
        confidence: 0.95,
        configFiles: [],
      };
      if (deps.svelte) {
        framework.version = deps.svelte;
      }
      frameworks.push(framework);
    }

    // Preact
    if (deps.preact) {
      const framework: DetectedFramework = {
        name: 'react', // Treat as React-compatible
        confidence: 0.85,
        configFiles: [],
      };
      if (deps.preact) {
        framework.version = deps.preact;
      }
      frameworks.push(framework);
    }

    // Solid
    if (deps['solid-js']) {
      const framework: DetectedFramework = {
        name: 'react', // Similar testing patterns to React
        confidence: 0.8,
        configFiles: [],
      };
      if (deps['solid-js']) {
        framework.version = deps['solid-js'];
      }
      frameworks.push(framework);
    }

    return frameworks;
  }

  /**
   * Detect backend frameworks
   */
  private async detectBackendFrameworks(): Promise<DetectedFramework[]> {
    const frameworks: DetectedFramework[] = [];
    const deps = this.getAllDependencies();

    // Express
    if (deps.express) {
      const framework: DetectedFramework = {
        name: 'express',
        confidence: 0.9,
        configFiles: [],
      };
      if (deps.express) {
        framework.version = deps.express;
      }
      frameworks.push(framework);
    }

    // NestJS
    if (deps['@nestjs/core'] || deps['@nestjs/common']) {
      const framework: DetectedFramework = {
        name: 'express', // NestJS is built on Express/Fastify
        confidence: 0.95,
        configFiles: [],
      };
      if (deps['@nestjs/core']) {
        framework.version = deps['@nestjs/core'];
      }
      frameworks.push(framework);
    }

    // Koa
    if (deps.koa) {
      const framework: DetectedFramework = {
        name: 'express', // Similar patterns
        confidence: 0.85,
        configFiles: [],
      };
      if (deps.koa) {
        framework.version = deps.koa;
      }
      frameworks.push(framework);
    }

    // Fastify
    if (deps.fastify) {
      const framework: DetectedFramework = {
        name: 'express', // Similar patterns
        confidence: 0.85,
        configFiles: [],
      };
      if (deps.fastify) {
        framework.version = deps.fastify;
      }
      frameworks.push(framework);
    }

    // Hapi
    if (deps['@hapi/hapi'] || deps.hapi) {
      const framework: DetectedFramework = {
        name: 'express', // Similar patterns
        confidence: 0.8,
        configFiles: [],
      };
      const version = deps['@hapi/hapi'] || deps.hapi;
      if (version) {
        framework.version = version;
      }
      frameworks.push(framework);
    }

    return frameworks;
  }

  /**
   * Detect meta-frameworks
   */
  private async detectMetaFrameworks(): Promise<DetectedFramework[]> {
    const frameworks: DetectedFramework[] = [];
    const deps = this.getAllDependencies();

    // Next.js
    if (deps.next) {
      const nextFramework: DetectedFramework = {
        name: 'nextjs',
        confidence: 0.95,
        configFiles: [],
      };
      if (deps.next) {
        nextFramework.version = deps.next;
      }
      frameworks.push(nextFramework);

      // Next.js implies React
      if (!this.hasFramework(frameworks, 'react')) {
        const reactFramework: DetectedFramework = {
          name: 'react',
          confidence: 0.9,
          configFiles: [],
        };
        if (deps.react) {
          reactFramework.version = deps.react;
        }
        frameworks.push(reactFramework);
      }
    }

    // Nuxt
    if (deps.nuxt || deps['@nuxt/core']) {
      const nuxtFramework: DetectedFramework = {
        name: 'nuxt',
        confidence: 0.95,
        configFiles: [],
      };
      const nuxtVersion = deps.nuxt || deps['@nuxt/core'];
      if (nuxtVersion) {
        nuxtFramework.version = nuxtVersion;
      }
      frameworks.push(nuxtFramework);

      // Nuxt implies Vue
      if (!this.hasFramework(frameworks, 'vue')) {
        const vueFramework: DetectedFramework = {
          name: 'vue',
          confidence: 0.9,
          configFiles: [],
        };
        if (deps.vue) {
          vueFramework.version = deps.vue;
        }
        frameworks.push(vueFramework);
      }
    }

    // Gatsby
    if (deps.gatsby) {
      const framework: DetectedFramework = {
        name: 'react', // Gatsby is React-based
        confidence: 0.9,
        configFiles: [],
      };
      if (deps.react) {
        framework.version = deps.react;
      }
      frameworks.push(framework);
    }

    // Remix
    if (deps['@remix-run/react'] || deps['@remix-run/node']) {
      const framework: DetectedFramework = {
        name: 'react',
        confidence: 0.9,
        configFiles: [],
      };
      if (deps.react) {
        framework.version = deps.react;
      }
      frameworks.push(framework);
    }

    // Vite (as a meta-framework indicator)
    if (deps.vite && (deps.react || deps.vue || deps.svelte)) {
      // Vite is present, boost confidence of detected UI framework
      logger.debug('Vite detected, boosting UI framework confidence');
    }

    return frameworks;
  }

  /**
   * Get build tools
   */
  async detectBuildTools(): Promise<string[]> {
    const buildTools: string[] = [];
    const deps = this.getAllDependencies();

    if (deps.vite) buildTools.push('vite');
    if (deps.webpack) buildTools.push('webpack');
    if (deps['@parcel/core'] || deps.parcel) buildTools.push('parcel');
    if (deps.rollup) buildTools.push('rollup');
    if (deps.esbuild) buildTools.push('esbuild');
    if (deps['@swc/core']) buildTools.push('swc');
    if (deps.turbopack) buildTools.push('turbopack');

    return buildTools;
  }

  /**
   * Get all dependencies combined
   */
  private getAllDependencies(): Record<string, string> {
    if (!this.packageJson) return {};

    return {
      ...(this.packageJson.dependencies || {}),
      ...(this.packageJson.devDependencies || {}),
      ...(this.packageJson.peerDependencies || {}),
    };
  }

  /**
   * Check if a framework is already detected
   */
  private hasFramework(frameworks: DetectedFramework[], name: string): boolean {
    return frameworks.some((f) => f.name === name);
  }

  /**
   * Get framework-specific test setup recommendations
   */
  async getTestSetupRecommendations(framework: string): Promise<{
    testFramework: string;
    setupFiles: string[];
    additionalDeps: string[];
    configTemplate: string;
  }> {
    switch (framework) {
      case 'react':
        return {
          testFramework: 'jest',
          setupFiles: ['setupTests.js'],
          additionalDeps: ['@testing-library/react', '@testing-library/jest-dom'],
          configTemplate: 'react-jest',
        };

      case 'vue':
        return {
          testFramework: 'vitest',
          setupFiles: ['vitest.config.ts'],
          additionalDeps: ['@vue/test-utils', '@testing-library/vue'],
          configTemplate: 'vue-vitest',
        };

      case 'angular':
        return {
          testFramework: 'karma',
          setupFiles: ['karma.conf.js'],
          additionalDeps: ['@angular-devkit/build-angular', 'karma-jasmine'],
          configTemplate: 'angular-karma',
        };

      case 'express':
        return {
          testFramework: 'jest',
          setupFiles: ['jest.config.js'],
          additionalDeps: ['supertest'],
          configTemplate: 'express-jest',
        };

      case 'nextjs':
        return {
          testFramework: 'jest',
          setupFiles: ['jest.config.js', 'jest.setup.js'],
          additionalDeps: ['@testing-library/react', 'jest-environment-jsdom'],
          configTemplate: 'nextjs-jest',
        };

      default:
        return {
          testFramework: 'jest',
          setupFiles: ['jest.config.js'],
          additionalDeps: [],
          configTemplate: 'default-jest',
        };
    }
  }
}
