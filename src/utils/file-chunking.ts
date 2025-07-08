/**
 * File Chunking Utility
 *
 * Provides intelligent file chunking for large files to handle AI token limits:
 * - Accurate token counting
 * - Smart code-aware chunking
 * - Context preservation between chunks
 * - File summarization
 */

export interface FileChunk {
  chunkIndex: number;
  totalChunks: number;
  content: string;
  startLine: number;
  endLine: number;
  tokens: number;
  overlap?: string | undefined;
  context?: ChunkContext | undefined;
}

export interface ChunkContext {
  imports: string[];
  exports: string[];
  classes: string[];
  functions: string[];
  summary?: string;
}

export interface ChunkingOptions {
  maxTokensPerChunk?: number;
  overlapTokens?: number;
  preserveContext?: boolean;
  language?: 'javascript' | 'typescript' | 'python';
}

export class FileChunker {
  private static readonly DEFAULT_MAX_TOKENS = 3500; // Leave buffer for prompt
  private static readonly DEFAULT_OVERLAP_TOKENS = 200;
  private static readonly CHARS_PER_TOKEN = 4; // Rough estimate

  /**
   * Count approximate tokens in text
   */
  static countTokens(text: string): number {
    // More accurate token counting based on Claude's tokenization
    // This is still an approximation but better than simple character count

    // Account for whitespace and special characters
    const normalizedText = text
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/[^\w\s]/g, '  '); // Special chars often become multiple tokens

    // Better approximation considering code structure
    const baseTokens = Math.ceil(normalizedText.length / this.CHARS_PER_TOKEN);

    // Add overhead for code-specific patterns
    const codeOverhead = this.calculateCodeOverhead(text);

    return baseTokens + codeOverhead;
  }

  /**
   * Calculate additional tokens for code-specific patterns
   */
  private static calculateCodeOverhead(text: string): number {
    let overhead = 0;

    // Each line typically adds tokens for line breaks and indentation
    const lines = text.split('\n');
    overhead += lines.length * 0.5;

    // Code blocks and strings often tokenize differently
    const codeBlocks = (text.match(/```[\s\S]*?```/g) ?? []).length;
    overhead += codeBlocks * 10;

    // Long strings and comments
    const longStrings = (text.match(/["'`][\s\S]{50,}?["'`]/g) ?? []).length;
    overhead += longStrings * 5;

    return Math.ceil(overhead);
  }

  /**
   * Split a file into chunks based on token limits
   */
  static chunkFile(content: string, options: ChunkingOptions = {}): FileChunk[] {
    const {
      maxTokensPerChunk = this.DEFAULT_MAX_TOKENS,
      overlapTokens = this.DEFAULT_OVERLAP_TOKENS,
      preserveContext = true,
      language,
    } = options;

    const lines = content.split('\n');
    const chunks: FileChunk[] = [];
    let currentChunk: string[] = [];
    let currentTokens = 0;
    let chunkStartLine = 0;
    let previousOverlap: string | undefined = '';

    // Extract file context if needed
    const fileContext = preserveContext ? this.extractFileContext(content, language) : undefined;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line === undefined) continue;

      const lineTokens = this.countTokens(line + '\n');

      // Check if adding this line would exceed limit
      if (currentTokens + lineTokens > maxTokensPerChunk && currentChunk.length > 0) {
        // Create chunk with overlap from previous chunk
        const chunkContent = (previousOverlap ?? '') + currentChunk.join('\n');

        const chunk: FileChunk = {
          chunkIndex: chunks.length,
          totalChunks: -1, // Will be set after all chunks are created
          content: chunkContent,
          startLine: chunkStartLine,
          endLine: i - 1,
          tokens: this.countTokens(chunkContent),
        };

        if (previousOverlap) chunk.overlap = previousOverlap;
        if (fileContext) chunk.context = fileContext;

        chunks.push(chunk);

        // Prepare overlap for next chunk
        previousOverlap = this.createOverlap(currentChunk, overlapTokens);

        // Reset for next chunk
        currentChunk = [];
        currentTokens = this.countTokens(previousOverlap ?? '');
        chunkStartLine = i;
      }

      currentChunk.push(line);
      currentTokens += lineTokens;
    }

    // Add final chunk
    if (currentChunk.length > 0) {
      const chunkContent = (previousOverlap ?? '') + currentChunk.join('\n');
      const finalChunk: FileChunk = {
        chunkIndex: chunks.length,
        totalChunks: chunks.length + 1,
        content: chunkContent,
        startLine: chunkStartLine,
        endLine: lines.length - 1,
        tokens: this.countTokens(chunkContent),
      };

      if (previousOverlap) finalChunk.overlap = previousOverlap;
      if (fileContext) finalChunk.context = fileContext;

      chunks.push(finalChunk);
    }

    // Update total chunks count
    chunks.forEach((chunk) => {
      chunk.totalChunks = chunks.length;
    });

    return chunks;
  }

  /**
   * Create overlap content for context preservation
   */
  private static createOverlap(lines: string[], targetTokens: number): string | undefined {
    const overlap: string[] = [];
    let tokens = 0;

    // Start from the end and work backwards to get most recent context
    for (let i = lines.length - 1; i >= 0 && tokens < targetTokens; i--) {
      const line = lines[i];
      if (!line) continue;

      const lineTokens = this.countTokens(line + '\n');
      if (tokens + lineTokens <= targetTokens) {
        overlap.unshift(line);
        tokens += lineTokens;
      }
    }

    if (overlap.length > 0) {
      return `// ... previous chunk overlap ...\n${overlap.join('\n')}\n// ... end overlap ...\n\n`;
    }

    return undefined;
  }

  /**
   * Extract file-level context
   */
  private static extractFileContext(content: string, language?: string): ChunkContext {
    const context: ChunkContext = {
      imports: [],
      exports: [],
      classes: [],
      functions: [],
    };

    if (language === 'python') {
      // Python-specific extraction
      context.imports = this.extractPythonImports(content);
      context.classes = this.extractPythonClasses(content);
      context.functions = this.extractPythonFunctions(content);
    } else {
      // JavaScript/TypeScript extraction
      context.imports = this.extractJSImports(content);
      context.exports = this.extractJSExports(content);
      context.classes = this.extractJSClasses(content);
      context.functions = this.extractJSFunctions(content);
    }

    // Generate summary
    context.summary = this.generateFileSummary(context);

    return context;
  }

  /**
   * Extract JavaScript/TypeScript imports
   */
  private static extractJSImports(content: string): string[] {
    const imports: string[] = [];

    // ES6 imports
    const es6Imports = content.match(/^import\s+.*?from\s+['"`].*?['"`]/gm) ?? [];
    imports.push(...es6Imports);

    // CommonJS requires
    const cjsImports = content.match(/^const\s+\w+\s*=\s*require\s*\(['"`].*?['"`]\)/gm) ?? [];
    imports.push(...cjsImports);

    return imports;
  }

  /**
   * Extract JavaScript/TypeScript exports
   */
  private static extractJSExports(content: string): string[] {
    const exports: string[] = [];

    // Named exports
    const namedExports =
      content.match(/^export\s+(const|let|function|class|interface|type)\s+\w+/gm) ?? [];
    exports.push(...namedExports.map((e) => e.replace(/^export\s+/, '')));

    // Default export
    const defaultExport = content.match(/^export\s+default\s+\w+/gm) ?? [];
    exports.push(...defaultExport);

    return exports;
  }

  /**
   * Extract JavaScript/TypeScript classes
   */
  private static extractJSClasses(content: string): string[] {
    const classes = content.match(/class\s+\w+/g) ?? [];
    return classes.map((c) => c.replace('class ', ''));
  }

  /**
   * Extract JavaScript/TypeScript functions
   */
  private static extractJSFunctions(content: string): string[] {
    const functions: string[] = [];

    // Regular functions
    const regularFuncs = content.match(/function\s+\w+\s*\(/g) ?? [];
    functions.push(...regularFuncs.map((f) => f.replace(/function\s+/, '').replace(/\s*\(/, '')));

    // Arrow functions assigned to const/let
    const arrowFuncs = content.match(/(const|let)\s+\w+\s*=\s*(\(.*?\)|[^=])\s*=>/g) ?? [];
    functions.push(
      ...arrowFuncs
        .map((f) => {
          const parts = f.split(/\s+/);
          return parts[1] ?? '';
        })
        .filter(Boolean)
    );

    return [...new Set(functions)]; // Remove duplicates
  }

  /**
   * Extract Python imports
   */
  private static extractPythonImports(content: string): string[] {
    const imports: string[] = [];

    // import statements
    const importStmts = content.match(/^import\s+.+$/gm) ?? [];
    imports.push(...importStmts);

    // from imports
    const fromImports = content.match(/^from\s+.+\s+import\s+.+$/gm) ?? [];
    imports.push(...fromImports);

    return imports;
  }

  /**
   * Extract Python classes
   */
  private static extractPythonClasses(content: string): string[] {
    const classes = content.match(/^class\s+\w+/gm) ?? [];
    return classes.map((c) => c.replace(/^class\s+/, ''));
  }

  /**
   * Extract Python functions
   */
  private static extractPythonFunctions(content: string): string[] {
    const functions = content.match(/^def\s+\w+/gm) ?? [];
    return functions.map((f) => f.replace(/^def\s+/, ''));
  }

  /**
   * Generate a summary of the file context
   */
  private static generateFileSummary(context: ChunkContext): string {
    const parts: string[] = [];

    if (context.imports.length > 0) {
      parts.push(`Imports: ${context.imports.length} modules`);
    }

    if (context.exports.length > 0) {
      parts.push(`Exports: ${context.exports.length} items`);
    }

    if (context.classes.length > 0) {
      parts.push(`Classes: ${context.classes.join(', ')}`);
    }

    if (context.functions.length > 0) {
      const funcList = context.functions.slice(0, 5).join(', ');
      const more = context.functions.length > 5 ? ` and ${context.functions.length - 5} more` : '';
      parts.push(`Functions: ${funcList}${more}`);
    }

    return parts.join(' | ');
  }

  /**
   * Merge results from multiple chunks
   */
  static mergeChunkResults(results: string[]): string {
    // Remove duplicate imports and combine test content
    const imports = new Set<string>();
    const testBodies: string[] = [];

    for (const result of results) {
      // Extract imports from each chunk result
      const importMatches = result.match(/^(import|const|from)\s+.+$/gm) ?? [];
      importMatches.forEach((imp) => imports.add(imp));

      // Extract test body (everything after imports)
      const lines = result.split('\n');
      let inBody = false;
      const body: string[] = [];

      for (const line of lines) {
        if (inBody) {
          body.push(line);
        } else if (line.trim() && !line.match(/^(import|const.*require|from)/)) {
          inBody = true;
          body.push(line);
        }
      }

      if (body.length > 0) {
        testBodies.push(body.join('\n'));
      }
    }

    // Combine imports and test bodies
    const finalResult: string[] = [];

    if (imports.size > 0) {
      finalResult.push(...Array.from(imports));
      finalResult.push(''); // Empty line after imports
    }

    finalResult.push(...testBodies);

    return finalResult.join('\n');
  }
}
