import { logger, fs } from '../../../utils/common-imports';
import * as parser from '@babel/parser';
import traverse from '@babel/traverse';

export interface AsyncPattern {
  /** Type of async pattern detected */
  type: 'async-await' | 'promise' | 'callback' | 'generator';
  /** Confidence level of the detection (0-1) */
  confidence: number;
  /** Count of occurrences in the file */
  count: number;
  /** Examples of the pattern found */
  examples: string[];
}

export interface FileAsyncPatterns {
  /** Path to the analyzed file */
  filePath: string;
  /** All async patterns found in the file */
  patterns: AsyncPattern[];
  /** Whether the file uses async patterns */
  hasAsyncPatterns: boolean;
  /** Primary async pattern (highest confidence) */
  primaryPattern?: AsyncPattern['type'];
}

export interface AsyncAnalysisOptions {
  /** Maximum number of examples to collect per pattern */
  maxExamples?: number;
  /** Whether to analyze TypeScript files */
  analyzeTypeScript?: boolean;
  /** Minimum confidence threshold for pattern detection */
  minConfidence?: number;
}

/**
 * Detects asynchronous patterns in JavaScript/TypeScript code
 * 
 * This analyzer identifies:
 * - async/await usage
 * - Promise-based patterns (.then, .catch, Promise.all, etc.)
 * - Callback patterns (error-first callbacks)
 * - Generator functions (function*)
 */
export class AsyncPatternDetector {
  private readonly maxExamples: number;
  private readonly analyzeTypeScript: boolean;
  private readonly minConfidence: number;

  constructor(options: AsyncAnalysisOptions = {}) {
    this.maxExamples = options.maxExamples ?? 3;
    this.analyzeTypeScript = options.analyzeTypeScript ?? true;
    this.minConfidence = options.minConfidence ?? 0.5;
  }

  /**
   * Analyze a file for async patterns
   */
  async analyzeFile(filePath: string): Promise<FileAsyncPatterns> {
    logger.debug(`Analyzing async patterns in ${filePath}`);

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const patterns = await this.detectPatterns(content, filePath);

      const hasAsyncPatterns = patterns.length > 0;
      const primaryPattern = this.determinePrimaryPattern(patterns);

      return {
        filePath,
        patterns,
        hasAsyncPatterns,
        ...(primaryPattern && { primaryPattern })
      };
    } catch (error) {
      logger.warn(`Failed to analyze async patterns in ${filePath}:`, error);
      return {
        filePath,
        patterns: [],
        hasAsyncPatterns: false
      };
    }
  }

  /**
   * Detect all async patterns in the given content
   */
  private async detectPatterns(content: string, filePath: string): Promise<AsyncPattern[]> {
    const patterns: Map<AsyncPattern['type'], AsyncPattern> = new Map();

    try {
      // Parse the file into an AST
      const ast = parser.parse(content, {
        sourceType: 'unambiguous',
        plugins: [
          'jsx',
          ...(this.analyzeTypeScript && filePath.match(/\.tsx?$/) ? ['typescript' as const] : [])
        ],
        errorRecovery: true
      });

      // Traverse the AST to find patterns
      traverse(ast, {
        // Detect async/await
        FunctionDeclaration: (path) => {
          if (path.node.async) {
            this.addPattern(patterns, 'async-await', 'async function');
          }
          if (path.node.generator) {
            this.addPattern(patterns, 'generator', 'function*');
          }
        },
        FunctionExpression: (path) => {
          if (path.node.async) {
            this.addPattern(patterns, 'async-await', 'async function expression');
          }
          if (path.node.generator) {
            this.addPattern(patterns, 'generator', 'generator function expression');
          }
        },
        ArrowFunctionExpression: (path) => {
          if (path.node.async) {
            this.addPattern(patterns, 'async-await', 'async arrow function');
          }
        },
        AwaitExpression: () => {
          this.addPattern(patterns, 'async-await', 'await expression');
        },

        // Detect Promise patterns
        MemberExpression: (path) => {
          if (path.node.property.type === 'Identifier') {
            const propertyName = path.node.property.name;
            if (['then', 'catch', 'finally'].includes(propertyName)) {
              this.addPattern(patterns, 'promise', `Promise.${propertyName}()`);
            }
          }
        },
        CallExpression: (path) => {
          // Check for Promise constructor
          if (path.node.callee.type === 'Identifier' && path.node.callee.name === 'Promise') {
            this.addPattern(patterns, 'promise', 'new Promise()');
          }
          
          // Check for Promise static methods
          if (path.node.callee.type === 'MemberExpression' &&
              path.node.callee.object.type === 'Identifier' &&
              path.node.callee.object.name === 'Promise' &&
              path.node.callee.property.type === 'Identifier') {
            const method = path.node.callee.property.name;
            if (['all', 'race', 'resolve', 'reject', 'allSettled', 'any'].includes(method)) {
              this.addPattern(patterns, 'promise', `Promise.${method}()`);
            }
          }

          // Check for callback patterns (error-first callbacks)
          const args = path.node.arguments;
          if (args.length > 0) {
            const lastArg = args[args.length - 1];
            if (lastArg && (lastArg.type === 'ArrowFunctionExpression' || 
                 lastArg.type === 'FunctionExpression') &&
                lastArg.params.length >= 2) {
              const firstParam = lastArg.params[0];
              if (firstParam && firstParam.type === 'Identifier' && 
                  (firstParam.name === 'err' || firstParam.name === 'error' || firstParam.name === 'e')) {
                this.addPattern(patterns, 'callback', 'error-first callback');
              }
            }
          }
        },

        // Detect yield expressions (generators)
        YieldExpression: () => {
          this.addPattern(patterns, 'generator', 'yield expression');
        }
      });

      // Also check for common callback patterns using regex
      if (!patterns.has('callback')) {
        const callbackPatterns = [
          /\bcallback\s*\(/g,
          /\(err(?:or)?[,)]/g,
          /\.on\s*\(\s*['"]error['"]/g,
          /\.once\s*\(\s*['"]error['"]/g
        ];

        for (const pattern of callbackPatterns) {
          if (pattern.test(content)) {
            this.addPattern(patterns, 'callback', 'callback pattern');
            break;
          }
        }
      }

    } catch (error) {
      logger.debug(`AST parsing failed for ${filePath}, falling back to regex detection`);
      // Fallback to regex-based detection
      const regexPatterns = await this.detectPatternsWithRegex(content);
      for (const [type, pattern] of regexPatterns) {
        patterns.set(type, pattern);
      }
    }

    // Filter patterns by confidence threshold
    return Array.from(patterns.values()).filter(p => p.confidence >= this.minConfidence);
  }

  /**
   * Fallback regex-based pattern detection
   */
  private async detectPatternsWithRegex(content: string): Promise<[AsyncPattern['type'], AsyncPattern][]> {
    const patterns: Map<AsyncPattern['type'], AsyncPattern> = new Map();

    // async/await patterns
    if (/\basync\s+function|\basync\s*\(|\basync\s*\w+\s*=>/.test(content)) {
      patterns.set('async-await', {
        type: 'async-await',
        confidence: 0.8,
        count: (content.match(/\basync\s/g) || []).length,
        examples: []
      });
    }

    // Promise patterns
    if (/\.then\s*\(|\.catch\s*\(|new\s+Promise\s*\(|Promise\.\w+\s*\(/.test(content)) {
      patterns.set('promise', {
        type: 'promise',
        confidence: 0.8,
        count: (content.match(/\.then\s*\(|\.catch\s*\(/g) || []).length,
        examples: []
      });
    }

    // Callback patterns
    if (/\bcallback\s*\(|\(err(?:or)?[,)]|\.on\s*\(\s*['"]error['"]/.test(content)) {
      patterns.set('callback', {
        type: 'callback',
        confidence: 0.7,
        count: (content.match(/\bcallback\s*\(/g) || []).length,
        examples: []
      });
    }

    // Generator patterns
    if (/function\s*\*|yield\s+/.test(content)) {
      patterns.set('generator', {
        type: 'generator',
        confidence: 0.9,
        count: (content.match(/yield\s+/g) || []).length,
        examples: []
      });
    }

    return Array.from(patterns.entries());
  }

  /**
   * Add or update a pattern in the collection
   */
  private addPattern(
    patterns: Map<AsyncPattern['type'], AsyncPattern>,
    type: AsyncPattern['type'],
    example: string
  ): void {
    if (patterns.has(type)) {
      const pattern = patterns.get(type)!;
      pattern.count++;
      if (pattern.examples.length < this.maxExamples && !pattern.examples.includes(example)) {
        pattern.examples.push(example);
      }
    } else {
      patterns.set(type, {
        type,
        confidence: 0.9, // High confidence for AST-based detection
        count: 1,
        examples: [example]
      });
    }
  }

  /**
   * Determine the primary async pattern based on confidence and count
   */
  private determinePrimaryPattern(patterns: AsyncPattern[]): AsyncPattern['type'] | undefined {
    if (patterns.length === 0) return undefined;

    // Sort by confidence and count
    const sorted = patterns.sort((a, b) => {
      const scoreA = a.confidence * Math.log(a.count + 1);
      const scoreB = b.confidence * Math.log(b.count + 1);
      return scoreB - scoreA;
    });

    return sorted[0]?.type;
  }

  /**
   * Analyze multiple files and aggregate results
   */
  async analyzeFiles(filePaths: string[]): Promise<Map<string, FileAsyncPatterns>> {
    const results = new Map<string, FileAsyncPatterns>();

    for (const filePath of filePaths) {
      const analysis = await this.analyzeFile(filePath);
      results.set(filePath, analysis);
    }

    return results;
  }

  /**
   * Get a summary of async patterns across multiple files
   */
  summarizePatterns(analyses: Map<string, FileAsyncPatterns>): {
    totalFiles: number;
    filesWithAsync: number;
    patternCounts: Record<AsyncPattern['type'], number>;
    primaryPattern: AsyncPattern['type'] | undefined;
  } {
    const patternCounts: Record<string, number> = {
      'async-await': 0,
      'promise': 0,
      'callback': 0,
      'generator': 0
    };

    let filesWithAsync = 0;

    for (const analysis of analyses.values()) {
      if (analysis.hasAsyncPatterns) {
        filesWithAsync++;
        for (const pattern of analysis.patterns) {
          patternCounts[pattern.type] = (patternCounts[pattern.type] || 0) + pattern.count;
        }
      }
    }

    // Determine overall primary pattern
    let primaryPattern: AsyncPattern['type'] | undefined;
    let maxCount = 0;
    for (const [type, count] of Object.entries(patternCounts)) {
      if (count > maxCount) {
        maxCount = count;
        primaryPattern = type as AsyncPattern['type'];
      }
    }

    return {
      totalFiles: analyses.size,
      filesWithAsync,
      patternCounts: patternCounts as Record<AsyncPattern['type'], number>,
      primaryPattern
    };
  }
}