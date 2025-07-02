/**
 * PatternManager handles file pattern resolution for different discovery types
 * 
 * This service provides language-specific patterns, user configuration merging,
 * and pattern validation for consistent file discovery across components.
 */

import {
  FileDiscoveryType,
} from '../types/file-discovery-types';

import type {
  PatternManager,
  StandardPatterns,
  LanguagePatterns,
  PatternMergeOperation,
  PatternValidationResult,
  PatternValidationError,
  PatternValidationWarning,
} from '../types/file-discovery-types';

import type { FileDiscoveryConfig } from '../types/file-discovery-types';

/**
 * Implementation of PatternManager with comprehensive pattern resolution
 */
export class PatternManagerImpl implements PatternManager {
  private standardPatterns: StandardPatterns;
  private languagePatterns: LanguagePatterns;

  constructor(private configService?: { getFileDiscoveryConfig(): FileDiscoveryConfig }) {
    this.standardPatterns = this.initializeStandardPatterns();
    this.languagePatterns = this.initializeLanguagePatterns();
  }

  /**
   * Get include patterns for a discovery type and languages
   */
  getIncludePatterns(type: FileDiscoveryType, languages?: string[]): string[] {
    const patterns = this.getTypePatterns(type);
    let base = patterns?.includes || ['**/*'];
    
    // Apply user configuration if available
    if (this.configService) {
      const userConfig = this.configService.getFileDiscoveryConfig();
      const userIncludes = this.getUserIncludePatterns(type, userConfig);
      if (userIncludes.length > 0) {
        base = this.mergeUserPatterns(base, userIncludes, 'add');
      }
    }
    
    if (languages?.length) {
      return this.addLanguageExtensions(base, languages);
    }
    
    return base;
  }

  /**
   * Get exclude patterns for a discovery type and languages
   */
  getExcludePatterns(type: FileDiscoveryType, languages?: string[]): string[] {
    const base = [...this.standardPatterns.baseExcludes];
    const patterns = this.getTypePatterns(type);
    const typeSpecific = patterns?.excludes || [];
    const languageSpecific = this.getLanguageExcludes(languages);
    
    let allPatterns = [...base, ...typeSpecific, ...languageSpecific];
    
    // Apply user configuration if available
    if (this.configService) {
      const userConfig = this.configService.getFileDiscoveryConfig();
      const userPatterns = this.getUserPatterns(type, userConfig);
      allPatterns = this.mergeUserPatterns(allPatterns, userPatterns, 'add');
    }
    
    return allPatterns;
  }

  /**
   * Merge user patterns with default patterns
   */
  mergeUserPatterns(
    defaultPatterns: string[],
    userPatterns: string[],
    operation: PatternMergeOperation
  ): string[] {
    switch (operation) {
      case 'replace':
        return userPatterns.length > 0 ? userPatterns : defaultPatterns;
      case 'add':
        return [...defaultPatterns, ...userPatterns];
      default:
        return defaultPatterns;
    }
  }

  /**
   * Validate that patterns are syntactically correct
   */
  validatePatterns(patterns: string[]): PatternValidationResult {
    const errors: PatternValidationError[] = [];
    const warnings: PatternValidationWarning[] = [];

    for (const pattern of patterns) {
      // Check for empty patterns
      if (!pattern || pattern.trim() === '') {
        errors.push({
          pattern,
          message: 'Pattern cannot be empty',
        });
        continue;
      }

      // Check for invalid glob syntax
      if (this.hasInvalidGlobSyntax(pattern)) {
        const position = this.findInvalidGlobPosition(pattern);
        errors.push({
          pattern,
          message: 'Invalid glob pattern syntax',
          ...(position !== undefined && { position }),
        });
        continue;
      }

      // Check for potentially problematic patterns
      const warning = this.checkPatternWarnings(pattern);
      if (warning) {
        warnings.push({
          pattern,
          message: warning.message,
          ...(warning.suggestion && { suggestion: warning.suggestion }),
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Get patterns for a specific discovery type
   */
  private getTypePatterns(type: FileDiscoveryType): { includes: string[]; excludes: string[] } | undefined {
    switch (type) {
      case FileDiscoveryType.PROJECT_ANALYSIS:
      case FileDiscoveryType.TEST_GENERATION:
      case FileDiscoveryType.TEST_EXECUTION:
      case FileDiscoveryType.CONFIG_DISCOVERY:
        return this.standardPatterns[type];
      default:
        return undefined;
    }
  }

  /**
   * Initialize standard patterns for different discovery types
   */
  private initializeStandardPatterns(): StandardPatterns {
    return {
      baseExcludes: [
        '**/node_modules/**',
        '**/dist/**',
        '**/build/**',
        '**/coverage/**',
        '**/.git/**',
        '**/.claude-testing/**',
        '**/__pycache__/**',
        '**/venv/**',
        '**/env/**',
        '**/.env/**',
        '**/target/**', // Rust, Java
        '**/bin/**',
        '**/obj/**', // C#
        '**/.next/**', // Next.js
        '**/.nuxt/**', // Nuxt.js
        '**/vendor/**', // PHP, Go
      ],
      [FileDiscoveryType.PROJECT_ANALYSIS]: {
        includes: [
          'src/**/*.{js,ts,jsx,tsx}',
          'lib/**/*.{js,ts,jsx,tsx}',
          '**/*.{py}',
          'src/**/*.{vue,svelte}',
          'components/**/*.{js,ts,jsx,tsx,vue,svelte}',
          'pages/**/*.{js,ts,jsx,tsx,vue,svelte}',
          'utils/**/*.{js,ts,jsx,tsx,py}',
          'helpers/**/*.{js,ts,jsx,tsx,py}',
          'services/**/*.{js,ts,jsx,tsx,py}',
        ],
        excludes: [
          '**/*.test.*',
          '**/*.spec.*',
          '**/*.stories.*',
          '**/*.config.*',
          '**/webpack.*',
          '**/rollup.*',
          '**/vite.*',
        ],
      },
      [FileDiscoveryType.TEST_GENERATION]: {
        includes: [
          'src/**/*.{js,ts,jsx,tsx}',
          'lib/**/*.{js,ts,jsx,tsx}',
          '**/*.{py}',
          'components/**/*.{js,ts,jsx,tsx,vue,svelte}',
          'pages/**/*.{js,ts,jsx,tsx,vue,svelte}',
          'utils/**/*.{js,ts,jsx,tsx,py}',
          'helpers/**/*.{js,ts,jsx,tsx,py}',
          'services/**/*.{js,ts,jsx,tsx,py}',
        ],
        excludes: [
          '**/*.test.*',
          '**/*.spec.*',
          '**/*.stories.*',
          '**/*.config.*',
          '**/*.d.ts',
          '**/index.{js,ts}', // Often just re-exports
          '**/types/**',
        ],
      },
      [FileDiscoveryType.TEST_EXECUTION]: {
        includes: [
          '**/*.test.{js,ts,jsx,tsx}',
          '**/*.spec.{js,ts,jsx,tsx}',
          '**/test_*.py',
          '**/*_test.py',
          '**/tests/**/*.py',
          '**/__tests__/**/*.{js,ts,jsx,tsx}',
          '**/spec/**/*.{js,ts,jsx,tsx}',
        ],
        excludes: [
          '**/node_modules/**',
          '**/*.d.ts',
        ],
      },
      [FileDiscoveryType.CONFIG_DISCOVERY]: {
        includes: [
          '**/package.json',
          '**/tsconfig.json',
          '**/jest.config.*',
          '**/vitest.config.*',
          '**/pytest.ini',
          '**/pyproject.toml',
          '**/setup.cfg',
          '**/.claude-testing.config.json',
          '**/webpack.config.*',
          '**/vite.config.*',
          '**/rollup.config.*',
        ],
        excludes: [],
      },
    };
  }

  /**
   * Initialize language-specific patterns
   */
  private initializeLanguagePatterns(): LanguagePatterns {
    return {
      javascript: {
        extensions: ['.js', '.jsx', '.mjs', '.cjs'],
        frameworks: {
          react: ['**/*.jsx', '**/components/**/*.js', '**/src/**/*.js'],
          vue: ['**/*.vue'],
          angular: ['**/*.component.js', '**/src/app/**/*.js'],
          node: ['**/server/**/*.js', '**/api/**/*.js', '**/routes/**/*.js'],
        },
        testPatterns: [
          '**/*.test.js',
          '**/*.spec.js',
          '**/__tests__/**/*.js',
          '**/test/**/*.js',
        ],
      },
      typescript: {
        extensions: ['.ts', '.tsx', '.d.ts'],
        frameworks: {
          react: ['**/*.tsx', '**/components/**/*.ts', '**/src/**/*.ts'],
          vue: ['**/*.vue.ts'],
          angular: ['**/*.component.ts', '**/src/app/**/*.ts'],
          node: ['**/server/**/*.ts', '**/api/**/*.ts', '**/routes/**/*.ts'],
        },
        testPatterns: [
          '**/*.test.ts',
          '**/*.spec.ts',
          '**/__tests__/**/*.ts',
          '**/test/**/*.ts',
        ],
      },
      python: {
        extensions: ['.py', '.pyx', '.pyi'],
        frameworks: {
          django: ['**/models.py', '**/views.py', '**/urls.py', '**/admin.py'],
          flask: ['**/app.py', '**/routes.py', '**/blueprints/**/*.py'],
          fastapi: ['**/main.py', '**/routers/**/*.py', '**/dependencies.py'],
          pytest: ['**/conftest.py', '**/test_*.py', '**/*_test.py'],
        },
        testPatterns: [
          '**/test_*.py',
          '**/*_test.py',
          '**/tests/**/*.py',
          '**/test/**/*.py',
        ],
      },
    };
  }

  /**
   * Add language-specific extensions to patterns
   */
  private addLanguageExtensions(basePatterns: string[], languages: string[]): string[] {
    const extendedPatterns: string[] = [];
    
    for (const pattern of basePatterns) {
      if (pattern.includes('{')) {
        // Pattern already has extensions, keep as is
        extendedPatterns.push(pattern);
      } else {
        // Add language-specific extensions
        const extensions = this.getLanguageExtensions(languages);
        if (extensions.length > 0) {
          const extPattern = pattern.replace('*', `*.{${extensions.join(',')}}`);
          extendedPatterns.push(extPattern);
        } else {
          extendedPatterns.push(pattern);
        }
      }
    }
    
    return extendedPatterns;
  }

  /**
   * Get file extensions for specified languages
   */
  private getLanguageExtensions(languages: string[]): string[] {
    const extensions: string[] = [];
    
    for (const language of languages) {
      const langKey = language.toLowerCase();
      if (this.languagePatterns[langKey]) {
        extensions.push(...this.languagePatterns[langKey].extensions.map(ext => ext.slice(1))); // Remove dot
      }
    }
    
    return Array.from(new Set(extensions)); // Remove duplicates
  }

  /**
   * Get language-specific exclude patterns
   */
  private getLanguageExcludes(languages?: string[]): string[] {
    if (!languages?.length) return [];
    
    const excludes: string[] = [];
    
    for (const language of languages) {
      const langKey = language.toLowerCase();
      
      switch (langKey) {
        case 'python':
          excludes.push(
            '**/__pycache__/**',
            '**/*.pyc',
            '**/*.pyo',
            '**/*.pyd',
            '**/venv/**',
            '**/env/**',
            '**/.venv/**'
          );
          break;
        case 'javascript':
        case 'typescript':
          excludes.push(
            '**/node_modules/**',
            '**/*.min.js',
            '**/dist/**',
            '**/build/**',
            '**/.next/**',
            '**/.nuxt/**'
          );
          break;
      }
    }
    
    return excludes;
  }

  /**
   * Get user patterns from configuration
   */
  private getUserPatterns(type: FileDiscoveryType, config: FileDiscoveryConfig): string[] {
    const typeKey = this.getConfigTypeKey(type);
    const patterns = config.patterns[typeKey];
    
    if (patterns?.replaceExcludes) {
      return patterns.replaceExcludes;
    }
    
    return patterns?.additionalExcludes || [];
  }

  /**
   * Get user include patterns from configuration
   */
  private getUserIncludePatterns(type: FileDiscoveryType, config: FileDiscoveryConfig): string[] {
    const typeKey = this.getConfigTypeKey(type);
    const patterns = config.patterns[typeKey];
    
    if (patterns?.replaceIncludes) {
      return patterns.replaceIncludes;
    }
    
    return patterns?.additionalIncludes || [];
  }

  /**
   * Convert FileDiscoveryType to configuration key
   */
  private getConfigTypeKey(type: FileDiscoveryType): string {
    switch (type) {
      case FileDiscoveryType.PROJECT_ANALYSIS:
        return 'projectAnalysis';
      case FileDiscoveryType.TEST_GENERATION:
        return 'testGeneration';
      case FileDiscoveryType.TEST_EXECUTION:
        return 'testExecution';
      default:
        return 'custom';
    }
  }

  /**
   * Check if pattern has invalid glob syntax
   */
  private hasInvalidGlobSyntax(pattern: string): boolean {
    // Check for unmatched brackets
    const openBrackets = (pattern.match(/\[/g) || []).length;
    const closeBrackets = (pattern.match(/\]/g) || []).length;
    
    if (openBrackets !== closeBrackets) return true;
    
    // Check for unmatched braces
    const openBraces = (pattern.match(/\{/g) || []).length;
    const closeBraces = (pattern.match(/\}/g) || []).length;
    
    if (openBraces !== closeBraces) return true;
    
    // Check for invalid characters in glob context
    if (pattern.includes('\\') && !pattern.includes('/')) {
      // Windows-style paths might be problematic
      return true;
    }
    
    return false;
  }

  /**
   * Find position of invalid glob syntax
   */
  private findInvalidGlobPosition(pattern: string): number | undefined {
    let openBrackets = 0;
    let openBraces = 0;
    
    for (let i = 0; i < pattern.length; i++) {
      const char = pattern[i];
      
      switch (char) {
        case '[':
          openBrackets++;
          break;
        case ']':
          openBrackets--;
          if (openBrackets < 0) return i;
          break;
        case '{':
          openBraces++;
          break;
        case '}':
          openBraces--;
          if (openBraces < 0) return i;
          break;
      }
    }
    
    return undefined;
  }

  /**
   * Check for pattern warnings
   */
  private checkPatternWarnings(pattern: string): { message: string; suggestion?: string } | null {
    // Check for overly broad patterns
    if (pattern === '**' || pattern === '**/*') {
      return {
        message: 'Very broad pattern may impact performance',
        suggestion: 'Consider adding file extensions or directory constraints',
      };
    }
    
    // Check for redundant patterns
    if (pattern.includes('**/**')) {
      return {
        message: 'Redundant path separators in pattern',
        suggestion: pattern.replace('**/**', '**'),
      };
    }
    
    // Check for Windows path separators
    if (pattern.includes('\\')) {
      return {
        message: 'Use forward slashes for cross-platform compatibility',
        suggestion: pattern.replace(/\\/g, '/'),
      };
    }
    
    return null;
  }
}