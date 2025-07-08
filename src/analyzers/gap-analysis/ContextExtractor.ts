import { fs, path, logger } from '../../utils/common-imports';
import type { TestContext, CodeSnippet } from '../TestGapAnalyzer';

/**
 * Context Extractor - Extracts AI context information
 *
 * Analyzes source files to extract relevant context information
 * for AI-powered test generation, including dependencies, framework
 * detection, and code snippets.
 */
export class ContextExtractor {
  /**
   * Extract context information for AI generation
   */
  async extractAITestContext(sourceContent: string, filePath: string): Promise<TestContext> {
    const framework = this.detectSourceFramework(sourceContent);
    const language = this.detectSourceLanguage(filePath);
    const fileType = this.detectSourceFileType(sourceContent, filePath);

    const dependencies = this.extractSourceDependencies(sourceContent);
    const codeSnippets = this.extractAIContextCodeSnippets(sourceContent);
    const relatedFiles = await this.findRelatedFiles(filePath);

    return {
      dependencies,
      framework,
      language,
      fileType,
      codeSnippets,
      relatedFiles,
    };
  }

  /**
   * Detect framework from source content
   */
  private detectSourceFramework(content: string): string {
    if (content.includes('react') || content.includes('React')) return 'react';
    if (content.includes('vue') || content.includes('Vue')) return 'vue';
    if (content.includes('express')) return 'express';
    if (content.includes('fastapi')) return 'fastapi';
    if (content.includes('django')) return 'django';
    return 'unknown';
  }

  /**
   * Detect language from file path
   */
  private detectSourceLanguage(filePath: string): string {
    const ext = path.extname(filePath);
    if (['.ts', '.tsx'].includes(ext)) return 'typescript';
    if (['.js', '.jsx'].includes(ext)) return 'javascript';
    if (ext === '.py') return 'python';
    return 'unknown';
  }

  /**
   * Detect file type from content and path
   */
  private detectSourceFileType(content: string, filePath: string): TestContext['fileType'] {
    const fileName = path.basename(filePath).toLowerCase();

    if (
      content.includes('React.Component') ||
      (content.includes('function ') && content.includes('return'))
    ) {
      return 'component';
    }
    if (fileName.includes('service') || content.includes('service')) return 'service';
    if (fileName.includes('util') || fileName.includes('helper')) return 'utility';
    if (content.includes('router') || content.includes('app.') || content.includes('endpoint'))
      return 'api';
    if (content.includes('model') || content.includes('schema')) return 'model';
    if (content.includes('hook') || fileName.includes('hook')) return 'hook';

    return 'unknown';
  }

  /**
   * Extract dependencies from imports
   */
  private extractSourceDependencies(content: string): string[] {
    const importRegex = /import\s+.*?from\s+['"]([^'"]+)['"]/g;
    const dependencies: string[] = [];

    let match;
    while ((match = importRegex.exec(content)) !== null) {
      if (match[1]) {
        dependencies.push(match[1]);
      }
    }

    return dependencies;
  }

  /**
   * Extract code snippets for AI context
   */
  private extractAIContextCodeSnippets(content: string): CodeSnippet[] {
    const snippets: CodeSnippet[] = [];

    // Look for function definitions
    const functionRegex = /(function\s+\w+|const\s+\w+\s*=.*?=>|def\s+\w+)/g;

    let match;
    while ((match = functionRegex.exec(content)) !== null) {
      const startIndex = content.lastIndexOf('\n', match.index) + 1;
      const functionStart = content.slice(0, match.index).split('\n').length - 1;

      // Find the end of the function (simple heuristic)
      let braceCount = 0;
      let endIndex = match.index;
      let foundStart = false;

      for (let i = match.index; i < content.length; i++) {
        if (content[i] === '{') {
          braceCount++;
          foundStart = true;
        } else if (content[i] === '}') {
          braceCount--;
          if (foundStart && braceCount === 0) {
            endIndex = i + 1;
            break;
          }
        }
      }

      const snippet = content.slice(startIndex, endIndex);
      const functionEnd = content.slice(0, endIndex).split('\n').length - 1;

      if (snippet.length > 10 && snippet.length < 500) {
        // Reasonable size
        const name =
          match[0].replace(/function\s+|const\s+|def\s+/, '').split(/\s|=/)[0] || 'unknown';
        snippets.push({
          name,
          content: snippet,
          lines: { start: functionStart, end: functionEnd },
          hasAsyncOperations: /\b(async|await|Promise)\b/.test(snippet),
          hasConditionals: /\b(if|switch|case)\b/.test(snippet),
          hasLoops: /\b(for|while|forEach|map)\b/.test(snippet),
          hasErrorHandling: /\b(try|catch|throw)\b/.test(snippet),
        });
      }
    }

    return snippets.slice(0, 5); // Limit to 5 snippets for token efficiency
  }

  /**
   * Find related files for context
   */
  private async findRelatedFiles(filePath: string): Promise<string[]> {
    try {
      const dir = path.dirname(filePath);
      const fileName = path.basename(filePath, path.extname(filePath));

      // Look for related files in the same directory
      const files = await fs.readdir(dir);
      const related = files
        .filter((file) => {
          const fileBase = path.basename(file, path.extname(file));
          return fileBase.includes(fileName) || fileName.includes(fileBase);
        })
        .filter((file) => file !== path.basename(filePath))
        .slice(0, 3); // Limit for token efficiency

      return related.map((file) => path.join(dir, file));
    } catch (error) {
      logger.debug('Error finding related files', { filePath, error });
      return [];
    }
  }
}
