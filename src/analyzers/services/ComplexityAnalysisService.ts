import { fs, path, fg, logger } from '../../utils/common-imports';
import type { ComplexityMetrics } from '../ProjectAnalyzer';

/**
 * Service responsible for calculating project complexity metrics
 */
export class ComplexityAnalysisService {
  constructor(private projectPath: string) {}

  async calculateComplexity(): Promise<ComplexityMetrics> {
    const allFiles = await this.findFiles(
      ['**/*.{js,ts,jsx,tsx,py}'],
      ['node_modules/**', 'dist/**', 'build/**']
    );
    let totalLines = 0;
    const fileSizes: Array<{ path: string; lines: number }> = [];

    for (const file of allFiles.slice(0, 100)) {
      // Limit for performance
      try {
        const content = await fs.readFile(path.join(this.projectPath, file), 'utf-8');
        const lines = content.split('\n').length;
        totalLines += lines;
        fileSizes.push({ path: file, lines });
      } catch (error: unknown) {
        // Skip files that can't be read
        logger.debug(`Could not read file ${file}:`, error);
      }
    }

    const averageFileSize = allFiles.length > 0 ? totalLines / allFiles.length : 0;
    const largestFiles = fileSizes.sort((a, b) => b.lines - a.lines).slice(0, 10);

    return {
      totalFiles: allFiles.length,
      totalLines,
      averageFileSize,
      largestFiles,
    };
  }

  private async findFiles(patterns: string[], ignore: string[] = []): Promise<string[]> {
    try {
      return await fg(patterns, {
        cwd: this.projectPath,
        ignore: ['node_modules/**', '**/node_modules/**', '**/.git/**', ...ignore],
      });
    } catch {
      return [];
    }
  }
}
