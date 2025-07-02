import type { TestRunner, TestRunnerConfig } from './TestRunner';
import { JestRunner } from './JestRunner';
import { PytestRunner } from './PytestRunner';
import type { ProjectAnalysis } from '../analyzers/ProjectAnalyzer';
import { logger } from '../utils/logger';
import type { FileDiscoveryService } from '../types/file-discovery-types';
import { FileDiscoveryServiceFactory } from '../services/FileDiscoveryServiceFactory';
import { ConfigurationService } from '../config/ConfigurationService';

/**
 * Factory for creating appropriate test runners based on framework
 */
export class TestRunnerFactory {
  /**
   * Create a test runner for the specified framework
   */
  static createRunner(
    config: TestRunnerConfig, 
    analysis: ProjectAnalysis, 
    fileDiscovery?: FileDiscoveryService
  ): TestRunner {
    logger.debug(`Creating test runner for framework: ${config.framework}`);

    // Create FileDiscoveryService if not provided
    if (!fileDiscovery) {
      const configService = new ConfigurationService({ projectPath: config.projectPath });
      fileDiscovery = FileDiscoveryServiceFactory.create(configService);
    }

    // Create instance based on framework
    let instance: TestRunner;
    
    if (config.framework === 'jest') {
      instance = new JestRunner(config, analysis, fileDiscovery);
    } else if (config.framework === 'pytest') {
      instance = new PytestRunner(config, analysis, fileDiscovery);
    } else {
      throw new Error(`No test runner found for framework: ${config.framework}`);
    }

    logger.info(`Using ${instance.constructor.name} for framework: ${config.framework}`);
    return instance;
  }

  /**
   * Get list of supported frameworks
   */
  static getSupportedFrameworks(): string[] {
    // Hard-coded list of supported frameworks based on our runners
    return ['jest', 'pytest'];
  }

  /**
   * Check if a framework is supported
   */
  static isFrameworkSupported(framework: string): boolean {
    return this.getSupportedFrameworks().includes(framework);
  }

  /**
   * Get recommended framework for a project analysis
   */
  static getRecommendedFramework(analysis: ProjectAnalysis): string {
    // Check existing test frameworks in the project
    if (analysis.testingSetup?.testFrameworks?.length > 0) {
      const existingFramework = analysis.testingSetup.testFrameworks[0];
      if (existingFramework && this.isFrameworkSupported(existingFramework)) {
        return existingFramework;
      }
    }

    // Recommend based on languages and frameworks
    const languages = analysis.languages?.map((l) => l.name).filter(Boolean) || [];
    const frameworks = analysis.frameworks?.map((f) => f.name).filter(Boolean) || [];

    // Python projects
    if (languages.includes('python')) {
      return 'pytest';
    }

    // JavaScript/TypeScript projects
    if (languages.includes('javascript') || languages.includes('typescript')) {
      // React projects typically use Jest
      if (frameworks.includes('react')) {
        return 'jest';
      }

      // Vue projects can use Jest or Vitest
      if (frameworks.includes('vue')) {
        return 'jest'; // Default to Jest for now
      }

      // Default to Jest for JS/TS projects
      return 'jest';
    }

    // Default fallback
    return 'jest';
  }

}
