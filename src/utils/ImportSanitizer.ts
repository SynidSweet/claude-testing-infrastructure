/**
 * ImportSanitizer - Detects and prevents dangerous imports in generated tests
 *
 * This utility is part of Phase 2 of the Process Context Isolation System.
 * It prevents generated tests from importing infrastructure components that
 * could spawn recursive processes.
 */

export interface ImportSanitizationResult {
  /** Whether the imports are safe */
  isSafe: boolean;
  /** List of dangerous imports found */
  dangerousImports: DangerousImport[];
  /** Sanitized import statement (if fixable) */
  sanitizedImport?: string;
  /** Suggested alternatives */
  suggestions: string[];
}

export interface DangerousImport {
  /** The import statement */
  importStatement: string;
  /** Type of danger */
  dangerType: 'infrastructure-import' | 'process-spawning' | 'external-dependency';
  /** Description of the risk */
  risk: string;
  /** Line number where found */
  lineNumber?: number;
}

/**
 * Patterns that indicate dangerous imports in generated tests
 */
const DANGEROUS_IMPORT_PATTERNS = {
  // Infrastructure imports that could spawn processes
  CLAUDE_ORCHESTRATOR: /from\s+['"](.*\/)?ClaudeOrchestrator['"]/,
  AI_INTEGRATION: /from\s+['"](.*claude-testing.*\/)?ai\//,
  CLI_COMMANDS: /from\s+['"](.*claude-testing.*\/)?cli\//,
  PROCESS_SPAWNING: /from\s+['"](.*\/)?(spawn|exec|fork|child_process)['"]/,
  
  // Infrastructure-specific imports (more specific - must include claude-testing or infrastructure)
  INFRASTRUCTURE_SRC: /from\s+['"](.*\/)?(claude-testing-infrastructure|claude-testing.*\/src)\//,
  INFRASTRUCTURE_UTILS: /from\s+['"](.*claude-testing.*\/)?utils\/(recursion-prevention|ProcessLimitValidator|GlobalProcessManager)['"]/,
  
  // External dependencies that should be mocked
  FILE_SYSTEM: /from\s+['"](fs|path|glob)['"]/,
  NETWORK: /from\s+['"](http|https|fetch|axios)['"]/,
} as const;

/**
 * Sanitizes imports in generated test code to prevent dangerous operations
 */
export class ImportSanitizer {
  /**
   * Analyzes test content for dangerous imports
   */
  static analyzeTestContent(testContent: string, _sourceFilePath?: string): ImportSanitizationResult {
    const lines = testContent.split('\n');
    const dangerousImports: DangerousImport[] = [];
    const suggestions: string[] = [];

    lines.forEach((line, index) => {
      const lineNumber = index + 1;
      
      // Check for infrastructure imports
      if (this.isDangerousInfrastructureImport(line)) {
        dangerousImports.push({
          importStatement: line.trim(),
          dangerType: 'infrastructure-import',
          risk: 'Could spawn recursive processes or access infrastructure internals',
          lineNumber,
        });
        suggestions.push('Replace with mock objects or remove dependency');
      }
      
      // Check for process spawning imports
      if (this.isDangerousProcessImport(line)) {
        dangerousImports.push({
          importStatement: line.trim(),
          dangerType: 'process-spawning',
          risk: 'Could spawn child processes',
          lineNumber,
        });
        suggestions.push('Mock process operations in tests');
      }
      
      // Check for external dependencies that should be mocked
      if (this.isExternalDependency(line)) {
        dangerousImports.push({
          importStatement: line.trim(),
          dangerType: 'external-dependency',
          risk: 'External dependency should be mocked in generated tests',
          lineNumber,
        });
        suggestions.push('Replace with jest.mock() or similar mocking mechanism');
      }
    });

    return {
      isSafe: dangerousImports.length === 0,
      dangerousImports,
      suggestions: [...new Set(suggestions)], // Remove duplicates
    };
  }

  /**
   * Sanitizes test content by removing or replacing dangerous imports
   */
  static sanitizeTestContent(testContent: string, sourceFilePath?: string): string {
    const result = this.analyzeTestContent(testContent, sourceFilePath);
    
    if (result.isSafe) {
      return testContent;
    }

    let sanitizedContent = testContent;
    
    // Remove dangerous infrastructure imports
    result.dangerousImports.forEach(dangerous => {
      if (dangerous.dangerType === 'infrastructure-import') {
        // Remove the entire import line
        sanitizedContent = sanitizedContent.replace(dangerous.importStatement, '');
      } else if (dangerous.dangerType === 'process-spawning') {
        // Comment out process spawning imports
        sanitizedContent = sanitizedContent.replace(
          dangerous.importStatement,
          `// SANITIZED: ${dangerous.importStatement}`
        );
      } else if (dangerous.dangerType === 'external-dependency') {
        // Add mock comment
        sanitizedContent = sanitizedContent.replace(
          dangerous.importStatement,
          `${dangerous.importStatement}\n// TODO: Mock this dependency in tests`
        );
      }
    });

    return sanitizedContent;
  }

  /**
   * Validates that a test file is safe to create
   */
  static validateTestFile(testContent: string, outputPath: string): ImportSanitizationResult {
    // Additional validation for output path safety
    const isInInfrastructure = outputPath.includes('claude-testing-infrastructure') ||
                               outputPath.includes('/src/') ||
                               outputPath.includes('/tests/');
    
    if (isInInfrastructure) {
      return {
        isSafe: false,
        dangerousImports: [{
          importStatement: '',
          dangerType: 'infrastructure-import',
          risk: 'Test output path is within infrastructure directory',
        }],
        suggestions: ['Move test output to external directory'],
      };
    }

    return this.analyzeTestContent(testContent, outputPath);
  }

  private static isDangerousInfrastructureImport(line: string): boolean {
    return DANGEROUS_IMPORT_PATTERNS.CLAUDE_ORCHESTRATOR.test(line) ||
           DANGEROUS_IMPORT_PATTERNS.AI_INTEGRATION.test(line) ||
           DANGEROUS_IMPORT_PATTERNS.CLI_COMMANDS.test(line) ||
           DANGEROUS_IMPORT_PATTERNS.INFRASTRUCTURE_SRC.test(line) ||
           DANGEROUS_IMPORT_PATTERNS.INFRASTRUCTURE_UTILS.test(line);
  }

  private static isDangerousProcessImport(line: string): boolean {
    return DANGEROUS_IMPORT_PATTERNS.PROCESS_SPAWNING.test(line);
  }

  private static isExternalDependency(line: string): boolean {
    return DANGEROUS_IMPORT_PATTERNS.FILE_SYSTEM.test(line) ||
           DANGEROUS_IMPORT_PATTERNS.NETWORK.test(line);
  }
}