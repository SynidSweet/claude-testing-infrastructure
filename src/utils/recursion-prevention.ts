/**
 * Recursion Prevention Utility
 * 
 * Prevents the infrastructure from testing itself, which can cause:
 * - Exponential process spawning (Jest × Claude CLI processes)
 * - System crashes from resource exhaustion
 * - Usage quota depletion
 */

import * as fs from 'fs';
import * as path from 'path';
import { logger } from './logger';

export interface RecursionCheckResult {
  isSafe: boolean;
  reason?: string;
  projectName?: string;
  projectType?: 'self' | 'infrastructure' | 'safe';
}

export class RecursionPreventionValidator {
  // Known infrastructure project names that should never be tested by themselves
  private static readonly INFRASTRUCTURE_NAMES = new Set([
    'claude-testing-infrastructure',
    'claude-testing',
    '@anthropic-ai/claude-testing',
    'testing-infrastructure',
    // Add more patterns as needed
  ]);

  // Safe subdirectories that can be tested (relative to infrastructure root)
  private static readonly SAFE_SUBDIRECTORIES = [
    'tests/fixtures/',
    'examples/',
    'tests/validation-projects/',
    '__tests__/fixtures/',
  ];

  /**
   * Validate that the target project path is not this infrastructure or similar
   */
  static validateNotSelfTarget(projectPath: string): RecursionCheckResult {
    try {
      const absolutePath = path.resolve(projectPath);
      const currentPath = path.resolve(__dirname, '../../');

      // Check 1: Same directory path
      if (absolutePath === currentPath) {
        return {
          isSafe: false,
          reason: 'Cannot test the infrastructure on itself - this would cause exponential process spawning',
          projectType: 'self',
        };
      }

      // Check 2: Child directory of current infrastructure (with safe subdirectory whitelist)
      if (absolutePath.startsWith(currentPath + path.sep)) {
        // Check if path is in safe subdirectory
        const relativePath = path.relative(currentPath, absolutePath);
        const isSafeSubdirectory = this.SAFE_SUBDIRECTORIES.some(safePath => 
          relativePath.startsWith(safePath) || relativePath.startsWith(safePath.replace(/\/$/, ''))
        );

        if (!isSafeSubdirectory) {
          return {
            isSafe: false,
            reason: 'Cannot test a subdirectory of the infrastructure - this could cause recursive testing. Safe directories: ' + this.SAFE_SUBDIRECTORIES.join(', '),
            projectType: 'self',
          };
        }

        // Safe subdirectory - allow testing but mark as safe type for logging
        logger.info(`Testing safe subdirectory: ${relativePath}`);
      }

      // Check 3: Parent directory containing current infrastructure
      if (currentPath.startsWith(absolutePath + path.sep)) {
        return {
          isSafe: false,
          reason: 'Cannot test a parent directory containing the infrastructure - this could cause recursive testing',
          projectType: 'self',
        };
      }

      // Check 4: Package.json name-based detection
      const packageJsonPath = path.join(absolutePath, 'package.json');
      if (fs.existsSync(packageJsonPath)) {
        try {
          const packageContent = fs.readFileSync(packageJsonPath, 'utf8');
          const packageData = JSON.parse(packageContent);
          const packageName = packageData.name;

          if (packageName && this.INFRASTRUCTURE_NAMES.has(packageName)) {
            return {
              isSafe: false,
              reason: `Cannot test infrastructure project "${packageName}" - this would cause exponential process spawning`,
              projectName: packageName,
              projectType: 'infrastructure',
            };
          }

          // Check for keywords indicating testing infrastructure
          const keywords = packageData.keywords || [];
          const description = packageData.description || '';
          
          if (this.isTestingInfrastructure(keywords, description, packageName)) {
            return {
              isSafe: false,
              reason: `Project "${packageName}" appears to be testing infrastructure - refusing to test to prevent recursion`,
              projectName: packageName,
              projectType: 'infrastructure',
            };
          }

          return {
            isSafe: true,
            projectName: packageName,
            projectType: 'safe',
          };
        } catch (error) {
          logger.warn(`Failed to parse package.json at ${packageJsonPath}:`, error);
          // Continue with other checks
        }
      }

      // Check 5: Directory name patterns
      const dirName = path.basename(absolutePath);
      if (this.INFRASTRUCTURE_NAMES.has(dirName)) {
        return {
          isSafe: false,
          reason: `Directory name "${dirName}" suggests testing infrastructure - refusing to test to prevent recursion`,
          projectType: 'infrastructure',
        };
      }

      // If all checks pass, it's safe
      return {
        isSafe: true,
        projectType: 'safe',
      };

    } catch (error) {
      logger.error('Error during recursion check:', error);
      // Fail safe - if we can't determine, assume it's unsafe
      return {
        isSafe: false,
        reason: `Unable to validate project safety due to error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        projectType: 'self',
      };
    }
  }

  /**
   * Check if project keywords/description suggest it's testing infrastructure
   */
  private static isTestingInfrastructure(keywords: string[], description: string, name: string): boolean {
    const indicators = [
      'test-generation',
      'testing-infrastructure',
      'claude-testing',
      'ai-testing',
      'test-generator',
      'testing-framework',
    ];

    // Check keywords
    for (const keyword of keywords) {
      if (indicators.some(indicator => keyword.toLowerCase().includes(indicator))) {
        return true;
      }
    }

    // Check description
    const lowerDescription = description.toLowerCase();
    if (indicators.some(indicator => lowerDescription.includes(indicator))) {
      return true;
    }

    // Check name patterns
    const lowerName = name.toLowerCase();
    if (indicators.some(indicator => lowerName.includes(indicator))) {
      return true;
    }

    return false;
  }

  /**
   * Get a user-friendly error message for blocked operations
   */
  static getBlockedOperationMessage(result: RecursionCheckResult): string {
    const baseMessage = `🚨 RECURSION PREVENTION: ${result.reason}\n\nThis safety measure prevents:\n- Exponential process spawning (Jest × Claude CLI)\n- System crashes from resource exhaustion  \n- Usage quota depletion\n- Infinite recursive testing loops\n\n`;

    const suggestions = result.projectType === 'self' 
      ? `Instead, test the infrastructure using:\n- npm test (for infrastructure self-tests)\n- Use a different target project for testing capabilities`
      : `Instead:\n- Test this infrastructure on a different, non-infrastructure project\n- Use npm test to run the infrastructure's own test suite`;

    return baseMessage + suggestions;
  }

  /**
   * Emergency check during process spawning
   */
  static emergencyRecursionCheck(): boolean {
    try {
      // ABSOLUTE SAFETY CHECK - Environment flag always takes precedence
      if (process.env.DISABLE_HEADLESS_AGENTS === 'true') {
        logger.warn('HEADLESS AGENTS DISABLED via environment variable');
        return false; // No exceptions - safety first
      }

      // Only if environment allows, check other conditions
      // Check if we're running via npm test or jest (internal testing is allowed)
      const processArgs = process.argv.join(' ');
      if (processArgs.includes('jest') || 
          processArgs.includes('npm test') || 
          process.env.NODE_ENV === 'test' ||
          process.env.JEST_WORKER_ID) {
        // Allow internal testing - this is self-testing, not recursive user-initiated testing
        return true;
      }

      // Check for CLI-initiated testing (which should be blocked)
      if (processArgs.includes('claude-testing') || processArgs.includes('dist/cli/index.js')) {
        const currentDir = process.cwd();
        const infrastructureDir = path.resolve(__dirname, '../../');
        
        // If current working directory is the infrastructure and we're running CLI, we might be recursing
        if (currentDir === infrastructureDir) {
          logger.error('🚨 EMERGENCY: CLI-initiated recursion detected - current working directory is infrastructure');
          return false;
        }
      }

      return true;
    } catch (error) {
      logger.error('Emergency recursion check failed:', error);
      return false; // Fail safe
    }
  }
}