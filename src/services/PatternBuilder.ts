/**
 * Type-safe pattern builder for creating glob patterns
 *
 * This builder provides a fluent API for constructing valid glob patterns
 * with compile-time type safety and runtime validation.
 */

import type { PatternBuilder } from '../types/enhanced-file-discovery-types';
import type { ProjectStructureAnalysis, ProjectStructureType } from './ProjectStructureDetector';

/**
 * Implementation of the type-safe pattern builder
 */
export class PatternBuilderImpl implements PatternBuilder {
  private basePath: string = '**';
  private extensions: string[] = [];
  private directories: string[] = [];
  private excludePatterns: string[] = [];
  private isRecursive: boolean = false;

  /**
   * Create a new pattern builder with optional base path
   */
  constructor(basePath?: string) {
    if (basePath) {
      this.basePath = this.normalizePath(basePath);
    }
  }

  /**
   * Add file extension constraint
   */
  withExtensions(extensions: string[]): PatternBuilder {
    this.extensions = extensions.map((ext) => (ext.startsWith('.') ? ext.slice(1) : ext));
    return this;
  }

  /**
   * Add directory constraint
   */
  inDirectory(directory: string): PatternBuilder {
    this.directories.push(this.normalizePath(directory));
    return this;
  }

  /**
   * Add recursive search
   */
  recursive(): PatternBuilder {
    this.isRecursive = true;
    return this;
  }

  /**
   * Exclude pattern
   */
  exclude(pattern: string): PatternBuilder {
    this.excludePatterns.push(this.normalizePath(pattern));
    return this;
  }

  /**
   * Build the final pattern
   */
  build(): string {
    let pattern = '';

    // Build directory path
    if (this.directories.length > 0) {
      pattern = this.directories.join('/');
    } else {
      pattern = this.basePath;
    }

    // Add recursive marker if needed
    if (this.isRecursive && !pattern.includes('**')) {
      pattern = pattern === '' ? '**' : `${pattern}/**`;
    }

    // Add file pattern
    if (this.extensions.length > 0) {
      const extPattern =
        this.extensions.length === 1 ? this.extensions[0] : `{${this.extensions.join(',')}}`;
      pattern = `${pattern}/*.${extPattern}`;
    } else if (!pattern.includes('*')) {
      pattern = `${pattern}/*`;
    }

    return pattern;
  }

  /**
   * Get exclude patterns
   */
  getExcludes(): string[] {
    return [...this.excludePatterns];
  }

  /**
   * Normalize path separators and clean up patterns
   */
  private normalizePath(path: string): string {
    return path
      .replace(/\\/g, '/')
      .replace(/\/+/g, '/')
      .replace(/^\/|\/$/g, '');
  }

  /**
   * Static factory methods for common patterns
   */
  static sourceFiles(language?: string): PatternBuilder {
    const builder = new PatternBuilderImpl();

    switch (language) {
      case 'javascript':
        return builder.withExtensions(['js', 'jsx', 'mjs', 'cjs']).inDirectory('src').recursive();
      case 'typescript':
        return builder.withExtensions(['ts', 'tsx']).inDirectory('src').recursive();
      case 'python':
        return builder.withExtensions(['py']).recursive();
      default:
        return builder.inDirectory('src').recursive();
    }
  }

  /**
   * Create patterns based on intelligent project structure analysis
   */
  static fromStructureAnalysis(analysis: ProjectStructureAnalysis): {
    sourcePatterns: string[];
    testPatterns: string[];
    excludePatterns: string[];
  } {
    return {
      sourcePatterns: analysis.suggestedPatterns.include,
      testPatterns: analysis.suggestedPatterns.testIncludes,
      excludePatterns: analysis.suggestedPatterns.exclude,
    };
  }

  /**
   * Create smart source patterns based on detected structure type
   */
  static smartSourceFiles(
    structureType: ProjectStructureType,
    sourceDirectories: string[],
    language?: string,
    frameworks?: string[]
  ): string[] {
    const extensions = PatternBuilderImpl.getLanguageExtensions(language);
    const patterns: string[] = [];

    switch (structureType) {
      case 'standard-src':
        patterns.push(`src/**/*.${extensions}`);
        break;
      case 'standard-lib':
        patterns.push(`lib/**/*.${extensions}`);
        break;
      case 'standard-app':
        patterns.push(`app/**/*.${extensions}`);
        break;
      case 'flat':
        patterns.push(`*.${extensions}`);
        break;
      case 'framework-specific':
      case 'mixed':
        sourceDirectories.forEach((dir) => {
          patterns.push(`${dir}/**/*.${extensions}`);
        });

        // Add framework-specific enhanced patterns
        if (frameworks) {
          frameworks.forEach((framework) => {
            const frameworkPatterns = PatternBuilderImpl.getFrameworkPatterns(
              framework,
              extensions
            );
            patterns.push(...frameworkPatterns);
          });
        }
        break;
      case 'monorepo':
        // Enhanced monorepo patterns
        patterns.push(`packages/**/*.${extensions}`);
        patterns.push(`apps/**/*.${extensions}`);
        patterns.push(`libs/**/*.${extensions}`);
        patterns.push(`services/**/*.${extensions}`);
        patterns.push(`@*/*/src/**/*.${extensions}`); // Scoped packages
        break;
      default:
        // Fallback to common patterns
        patterns.push(`src/**/*.${extensions}`);
        patterns.push(`lib/**/*.${extensions}`);
        patterns.push(`**/*.${extensions}`);
    }

    return [...new Set(patterns)]; // Remove duplicates
  }

  /**
   * Get framework-specific patterns
   */
  private static getFrameworkPatterns(framework: string, extensions: string): string[] {
    const patterns: string[] = [];

    switch (framework.toLowerCase()) {
      case 'next.js':
        patterns.push(
          `app/**/page.${extensions}`,
          `app/**/layout.${extensions}`,
          `app/**/loading.${extensions}`,
          `app/**/error.${extensions}`,
          `pages/**/*.${extensions}`,
          `components/**/*.${extensions}`
        );
        break;
      case 'vue':
        patterns.push(
          `composables/**/*.${extensions}`,
          `stores/**/*.${extensions}`,
          `views/**/components/**/*.${extensions}`
        );
        break;
      case 'angular':
        patterns.push(
          `src/app/features/**/*.${extensions}`,
          `src/app/shared/components/**/*.${extensions}`,
          `src/app/core/**/*.${extensions}`
        );
        break;
      case 'micro-frontend':
        patterns.push(
          `shell/src/**/*.${extensions}`,
          `host/src/**/*.${extensions}`,
          `remotes/*/src/**/*.${extensions}`,
          `mfe/*/src/**/*.${extensions}`
        );
        break;
      case 'nx':
        patterns.push(
          `libs/shared/*/src/**/*.${extensions}`,
          `libs/feature-*/src/**/*.${extensions}`,
          `apps/*/src/**/*.${extensions}`,
          `tools/**/*.${extensions}`
        );
        break;
    }

    return patterns;
  }

  /**
   * Get file extensions pattern for a language
   */
  private static getLanguageExtensions(language?: string): string {
    switch (language) {
      case 'javascript':
        return '{js,jsx,mjs,cjs}';
      case 'typescript':
        return '{ts,tsx}';
      case 'python':
        return 'py';
      case 'vue':
        return '{vue,js,ts}';
      case 'svelte':
        return '{svelte,js,ts}';
      default:
        return '{js,ts,jsx,tsx,py,vue,svelte}';
    }
  }

  static testFiles(framework?: string): PatternBuilder {
    const builder = new PatternBuilderImpl();

    switch (framework) {
      case 'jest':
      case 'vitest':
        return builder.withExtensions(['test.js', 'test.ts', 'spec.js', 'spec.ts']).recursive();
      case 'pytest':
        return builder.withExtensions(['py']).inDirectory('tests').recursive();
      default:
        return builder.recursive();
    }
  }

  static configFiles(): PatternBuilder {
    return new PatternBuilderImpl().withExtensions([
      'json',
      'js',
      'ts',
      'yaml',
      'yml',
      'toml',
      'ini',
    ]);
  }
}

/**
 * Enhanced pattern builder type with static methods
 */
export interface PatternBuilderConstructor {
  (basePath?: string): PatternBuilder;
  sourceFiles(language?: string): PatternBuilder;
  testFiles(framework?: string): PatternBuilder;
  configFiles(): PatternBuilder;
}

/**
 * Factory function for creating pattern builders
 */
export const createPatternBuilder = Object.assign(
  (basePath?: string): PatternBuilder => {
    return new PatternBuilderImpl(basePath);
  },
  {
    sourceFiles: (language?: string) => PatternBuilderImpl.sourceFiles(language),
    testFiles: (framework?: string) => PatternBuilderImpl.testFiles(framework),
    configFiles: () => PatternBuilderImpl.configFiles(),
    fromStructureAnalysis: (analysis: ProjectStructureAnalysis) =>
      PatternBuilderImpl.fromStructureAnalysis(analysis),
    smartSourceFiles: (
      structureType: ProjectStructureType,
      sourceDirectories: string[],
      language?: string,
      frameworks?: string[]
    ) =>
      PatternBuilderImpl.smartSourceFiles(structureType, sourceDirectories, language, frameworks),
  }
) as PatternBuilderConstructor;
