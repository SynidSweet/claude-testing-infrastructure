/**
 * ProjectStructureDetector provides intelligent detection of project layout patterns
 *
 * This service analyzes project directories to automatically detect common structures
 * and generates appropriate file patterns for different project types.
 */

import { promises as fs } from 'fs';
import path from 'path';
import debug from 'debug';

const logger = debug('claude-testing:project-structure');

export interface ProjectStructureAnalysis {
  detectedStructure: ProjectStructureType;
  confidence: number;
  sourceDirectories: SourceDirectory[];
  testDirectories: TestDirectory[];
  suggestedPatterns: SuggestedPatterns;
  monorepoInfo?: MonorepoInfo;
  frameworkIndicators: FrameworkIndicator[];
  fullStackInfo?: {
    isFullStack: boolean;
    frontendFrameworks: string[];
    backendFrameworks: string[];
    structure: 'separated' | 'integrated' | 'monorepo';
  };
  packageArchitecture?: {
    hasPackageArchitecture: boolean;
    packagePatterns: string[];
    architectureType: 'feature-based' | 'layer-based' | 'domain-based' | 'mixed';
  };
}

export interface SourceDirectory {
  path: string;
  type: 'primary' | 'secondary' | 'framework-specific';
  confidence: number;
  indicators: string[];
  fileCount: number;
}

export interface TestDirectory {
  path: string;
  type: 'unit' | 'integration' | 'e2e' | 'mixed';
  confidence: number;
  relatedSource?: string | undefined;
  testFramework?: string | undefined;
}

export interface SuggestedPatterns {
  include: string[];
  exclude: string[];
  testIncludes: string[];
  testExcludes: string[];
}

export interface MonorepoInfo {
  isMonorepo: boolean;
  workspaces: string[];
  rootPackageJson: boolean;
  workspacePattern?: string;
}

export interface FrameworkIndicator {
  framework: string;
  confidence: number;
  directoryPatterns: string[];
  filePatterns: string[];
}

export type ProjectStructureType =
  | 'standard-src' // src/ main directory
  | 'standard-lib' // lib/ main directory
  | 'standard-app' // app/ main directory
  | 'flat' // files in root
  | 'framework-specific' // framework conventions (Next.js pages/, etc)
  | 'monorepo' // multiple packages
  | 'mixed' // multiple source patterns
  | 'unknown'; // couldn't determine

/**
 * Service for intelligent project structure detection
 */
export class ProjectStructureDetector {
  constructor(private projectPath: string) {}

  /**
   * Analyze project structure and generate intelligent patterns
   */
  async analyzeStructure(): Promise<ProjectStructureAnalysis> {
    logger('Starting project structure analysis for: %s', this.projectPath);

    const [
      sourceDirectories,
      testDirectories,
      monorepoInfo,
      frameworkIndicators,
      fullStackInfo,
      packageArchitecture,
    ] = await Promise.all([
      this.detectSourceDirectories(),
      this.detectTestDirectories(),
      this.detectEnhancedMonorepoStructure(),
      this.detectFrameworkPatterns(),
      this.detectFullStackPatterns(),
      this.detectPackageBasedArchitecture(),
    ]);

    const structureType = this.classifyStructureType(
      sourceDirectories,
      monorepoInfo,
      frameworkIndicators
    );
    const confidence = this.calculateConfidence(
      structureType,
      sourceDirectories,
      frameworkIndicators
    );
    const suggestedPatterns = this.generateSuggestedPatterns(
      structureType,
      sourceDirectories,
      testDirectories,
      frameworkIndicators,
      monorepoInfo,
      fullStackInfo,
      packageArchitecture
    );

    const analysis: ProjectStructureAnalysis = {
      detectedStructure: structureType,
      confidence,
      sourceDirectories,
      testDirectories,
      suggestedPatterns,
      frameworkIndicators,
      ...(monorepoInfo.isMonorepo && { monorepoInfo }),
      ...(fullStackInfo.isFullStack && { fullStackInfo }),
      ...(packageArchitecture.hasPackageArchitecture && { packageArchitecture }),
    };

    logger('Structure analysis complete: type=%s confidence=%d', structureType, confidence);
    return analysis;
  }

  /**
   * Detect source code directories with intelligent scoring
   */
  private async detectSourceDirectories(): Promise<SourceDirectory[]> {
    const candidates = [
      // Standard patterns
      'src',
      'lib',
      'app',
      'source',
      'code',
      // Framework-specific patterns
      'pages',
      'components',
      'utils',
      'helpers',
      'services',
      'modules',
      'features',
      'views',
      'controllers',
      // Language-specific patterns
      'server',
      'client',
      'shared',
      'common',
      'core',
      // Build output that might contain source
      'dist/src',
      'build/src',
    ];

    const sourceDirectories: SourceDirectory[] = [];

    for (const candidate of candidates) {
      const analysis = await this.analyzeSourceDirectory(candidate);
      if (analysis) {
        sourceDirectories.push(analysis);
      }
    }

    // Also check for flat structure (files in root)
    const rootAnalysis = await this.analyzeRootStructure();
    if (rootAnalysis) {
      sourceDirectories.push(rootAnalysis);
    }

    return sourceDirectories.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Analyze a specific directory as potential source directory
   */
  private async analyzeSourceDirectory(dirName: string): Promise<SourceDirectory | null> {
    const dirPath = path.join(this.projectPath, dirName);

    try {
      const stat = await fs.stat(dirPath);
      if (!stat.isDirectory()) return null;

      const files = await this.getDirectoryFiles(dirPath);
      const sourceFiles = this.filterSourceFiles(files);

      if (sourceFiles.length === 0) return null;

      const indicators = this.getSourceDirectoryIndicators(dirName, sourceFiles);
      const confidence = this.calculateSourceConfidence(dirName, sourceFiles, indicators);
      const type = this.classifySourceDirectoryType(dirName, indicators);

      return {
        path: dirName,
        type,
        confidence,
        indicators,
        fileCount: sourceFiles.length,
      };
    } catch {
      return null;
    }
  }

  /**
   * Analyze root directory for flat project structure
   */
  private async analyzeRootStructure(): Promise<SourceDirectory | null> {
    try {
      const files = await this.getDirectoryFiles(this.projectPath, 1); // Only direct children
      const sourceFiles = this.filterSourceFiles(files).filter(
        (file) => !this.isInSubdirectory(file)
      ); // Only root-level files

      if (sourceFiles.length < 2) return null; // Need at least a few files to be considered

      return {
        path: '.',
        type: 'primary',
        confidence: sourceFiles.length >= 5 ? 0.7 : 0.4, // Lower confidence for flat structure
        indicators: ['flat-structure', `${sourceFiles.length}-root-files`],
        fileCount: sourceFiles.length,
      };
    } catch {
      return null;
    }
  }

  /**
   * Detect test directories with framework awareness
   */
  private async detectTestDirectories(): Promise<TestDirectory[]> {
    const testPatterns = [
      'test',
      'tests',
      '__tests__',
      'spec',
      'e2e',
      'integration',
      'unit',
      'cypress',
      'playwright',
    ];

    const testDirectories: TestDirectory[] = [];

    // Check for test directories
    for (const pattern of testPatterns) {
      const dirs = await this.findDirectoriesMatching(`**/${pattern}`);
      for (const dir of dirs) {
        const analysis = await this.analyzeTestDirectory(dir);
        if (analysis) {
          testDirectories.push(analysis);
        }
      }
    }

    // Check for co-located tests (*.test.* files)
    const colocatedTests = await this.detectColocatedTests();
    testDirectories.push(...colocatedTests);

    return testDirectories;
  }

  /**
   * Analyze test directory structure
   */
  private async analyzeTestDirectory(dirPath: string): Promise<TestDirectory | null> {
    try {
      const fullPath = path.join(this.projectPath, dirPath);
      const files = await this.getDirectoryFiles(fullPath);
      const testFiles = files.filter((file) => this.isTestFile(file));

      if (testFiles.length === 0) return null;

      const type = this.classifyTestType(path.basename(dirPath), testFiles);
      const relatedSource = this.findRelatedSourceDirectory(dirPath);
      const testFramework = this.detectTestFramework(testFiles);

      return {
        path: dirPath,
        type,
        confidence: 0.9,
        relatedSource,
        testFramework,
      };
    } catch {
      return null;
    }
  }

  /**
   * Detect co-located test files
   */
  private async detectColocatedTests(): Promise<TestDirectory[]> {
    const testFiles = await this.findFilesMatching([
      '**/*.test.{js,ts,jsx,tsx,py}',
      '**/*.spec.{js,ts,jsx,tsx,py}',
    ]);

    const directories = new Set<string>();
    testFiles.forEach((file) => {
      const dir = path.dirname(file);
      if (dir !== '.') {
        directories.add(dir);
      }
    });

    return Array.from(directories).map((dir) => ({
      path: dir,
      type: 'unit' as const,
      confidence: 0.8,
      relatedSource: dir as string | undefined, // Co-located tests are in the same directory as source
    }));
  }

  /**
   * Detect monorepo structure
   */
  private async detectMonorepoStructure(): Promise<MonorepoInfo> {
    try {
      const packageJsonPath = path.join(this.projectPath, 'package.json');
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8')) as {
        workspaces?: string[] | { packages?: string[] };
      };

      const workspaces = packageJson.workspaces;
      if (workspaces) {
        const workspacePatterns = Array.isArray(workspaces)
          ? workspaces
          : (workspaces.packages ?? []);
        const result: MonorepoInfo = {
          isMonorepo: true,
          workspaces: workspacePatterns,
          rootPackageJson: true,
        };
        if (workspacePatterns[0]) {
          result.workspacePattern = workspacePatterns[0];
        }
        return result;
      }

      // Check for multiple package.json files
      const packageFiles = await this.findFilesMatching(['**/package.json']);
      if (packageFiles.length > 3) {
        // Root + at least 2 packages
        return {
          isMonorepo: true,
          workspaces: [],
          rootPackageJson: true,
        };
      }

      return { isMonorepo: false, workspaces: [], rootPackageJson: true };
    } catch {
      return { isMonorepo: false, workspaces: [], rootPackageJson: false };
    }
  }

  /**
   * Detect framework-specific directory patterns with enhanced support
   */
  private async detectFrameworkPatterns(): Promise<FrameworkIndicator[]> {
    const frameworkPatterns = [
      {
        framework: 'next.js',
        directories: ['pages', 'app', 'components', 'src/pages', 'src/app'],
        files: ['next.config.*', 'pages/**/*.{js,ts,jsx,tsx}', 'app/**/page.{js,ts,jsx,tsx}'],
        nestedPatterns: ['components/ui', 'components/layout', 'components/common'],
      },
      {
        framework: 'nuxt',
        directories: ['pages', 'components', 'layouts', 'middleware', 'composables', 'stores'],
        files: ['nuxt.config.*', 'pages/**/*.vue', 'app.vue'],
        nestedPatterns: ['components/base', 'components/global'],
      },
      {
        framework: 'react',
        directories: ['components', 'hooks', 'context', 'features', 'containers'],
        files: ['**/*.{jsx,tsx}', 'src/App.{js,jsx,ts,tsx}'],
        nestedPatterns: ['components/shared', 'components/common', 'features/*/components'],
      },
      {
        framework: 'vue',
        directories: ['components', 'views', 'router', 'stores', 'composables'],
        files: ['**/*.vue', 'src/App.vue'],
        nestedPatterns: ['components/base', 'views/*/components'],
      },
      {
        framework: 'angular',
        directories: ['src/app', 'src/environments', 'src/app/shared', 'src/app/core'],
        files: ['angular.json', '**/*.component.ts', '**/*.module.ts'],
        nestedPatterns: ['src/app/features', 'src/app/shared/components'],
      },
      {
        framework: 'svelte',
        directories: ['src/routes', 'src/lib', 'src/components'],
        files: ['**/*.svelte', 'svelte.config.js'],
        nestedPatterns: ['src/lib/components', 'src/routes/**/components'],
      },
      {
        framework: 'express',
        directories: ['routes', 'middleware', 'controllers', 'api', 'services'],
        files: ['app.js', 'server.js', '**/routes/**/*.js'],
        nestedPatterns: ['api/v1', 'api/v2'],
      },
      {
        framework: 'django',
        directories: ['**/migrations', '**/templates', '**/static', 'apps'],
        files: ['manage.py', '**/models.py', '**/views.py', '**/urls.py'],
        nestedPatterns: ['apps/*/templates', 'apps/*/static'],
      },
      {
        framework: 'fastapi',
        directories: ['api', 'routers', 'models', 'schemas', 'crud', 'core'],
        files: ['main.py', '**/routers/**/*.py', 'app/main.py'],
        nestedPatterns: ['api/v1/endpoints', 'app/api/*/endpoints'],
      },
      {
        framework: 'nx',
        directories: ['apps', 'libs', 'tools', 'packages'],
        files: ['nx.json', 'workspace.json', 'project.json'],
        nestedPatterns: ['apps/*/src', 'libs/*/src', 'libs/shared/*/src'],
      },
    ];

    const indicators: FrameworkIndicator[] = [];

    for (const pattern of frameworkPatterns) {
      const directoryScore = await this.scoreDirectoryPattern(pattern.directories);
      const fileScore = await this.scoreFilePattern(pattern.files);
      const nestedScore = pattern.nestedPatterns
        ? await this.scoreNestedPatterns(pattern.nestedPatterns)
        : 0;

      // Enhanced confidence calculation with nested pattern support
      const confidence = directoryScore * 0.4 + fileScore * 0.4 + nestedScore * 0.2;

      if (confidence > 0.3) {
        indicators.push({
          framework: pattern.framework,
          confidence,
          directoryPatterns: [...pattern.directories, ...(pattern.nestedPatterns || [])],
          filePatterns: pattern.files,
        });
      }
    }

    // Detect micro-frontend patterns
    const microFrontendIndicator = await this.detectMicroFrontendArchitecture();
    if (microFrontendIndicator) {
      indicators.push(microFrontendIndicator);
    }

    return indicators.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Classify the overall project structure type
   */
  private classifyStructureType(
    sourceDirectories: SourceDirectory[],
    monorepoInfo: MonorepoInfo,
    frameworkIndicators: FrameworkIndicator[]
  ): ProjectStructureType {
    if (monorepoInfo.isMonorepo) {
      return 'monorepo';
    }

    const topFramework = frameworkIndicators[0];
    if (frameworkIndicators.length > 0 && topFramework && topFramework.confidence > 0.7) {
      return 'framework-specific';
    }

    if (sourceDirectories.length === 0) {
      return 'unknown';
    }

    const primary = sourceDirectories[0];

    const secondary = sourceDirectories[1];
    if (sourceDirectories.length > 2 && secondary && secondary.confidence > 0.6) {
      return 'mixed';
    }

    if (!primary) {
      return 'unknown';
    }

    switch (primary.path) {
      case 'src':
        return 'standard-src';
      case 'lib':
        return 'standard-lib';
      case 'app':
        return 'standard-app';
      case '.':
        return 'flat';
      default:
        return 'framework-specific';
    }
  }

  /**
   * Calculate overall confidence score
   */
  private calculateConfidence(
    structureType: ProjectStructureType,
    sourceDirectories: SourceDirectory[],
    frameworkIndicators: FrameworkIndicator[]
  ): number {
    if (structureType === 'unknown') return 0.1;

    let confidence = 0.5; // Base confidence

    // Add confidence from source directories
    if (sourceDirectories.length > 0 && sourceDirectories[0]) {
      confidence += sourceDirectories[0].confidence * 0.4;
    }

    // Add confidence from framework detection
    if (frameworkIndicators.length > 0 && frameworkIndicators[0]) {
      confidence += frameworkIndicators[0].confidence * 0.3;
    }

    // Boost confidence for clear patterns
    if (structureType.startsWith('standard-')) {
      confidence += 0.2;
    }

    return Math.min(0.95, confidence);
  }

  /**
   * Generate suggested file patterns based on detected structure
   */
  private generateSuggestedPatterns(
    structureType: ProjectStructureType,
    sourceDirectories: SourceDirectory[],
    testDirectories: TestDirectory[],
    frameworkIndicators: FrameworkIndicator[],
    monorepoInfo: MonorepoInfo,
    fullStackInfo: {
      isFullStack: boolean;
      frontendFrameworks: string[];
      backendFrameworks: string[];
      structure: 'separated' | 'integrated' | 'monorepo';
    },
    packageArchitecture: {
      hasPackageArchitecture: boolean;
      packagePatterns: string[];
      architectureType: 'feature-based' | 'layer-based' | 'domain-based' | 'mixed';
    }
  ): SuggestedPatterns {
    const include: string[] = [];
    const exclude: string[] = [];
    const testIncludes: string[] = [];
    const testExcludes: string[] = [];

    // Base excludes (always applied)
    exclude.push(
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      '**/.git/**',
      '**/.claude-testing/**',
      '**/__pycache__/**',
      '**/venv/**',
      '**/env/**'
    );

    // Generate patterns based on structure type
    switch (structureType) {
      case 'standard-src':
        include.push('src/**/*.{js,ts,jsx,tsx,py,vue,svelte}');
        break;
      case 'standard-lib':
        include.push('lib/**/*.{js,ts,jsx,tsx,py,vue,svelte}');
        break;
      case 'standard-app':
        include.push('app/**/*.{js,ts,jsx,tsx,py,vue,svelte}');
        break;
      case 'flat':
        include.push('*.{js,ts,jsx,tsx,py,vue,svelte}');
        exclude.push('**/*'); // Only root files
        break;
      case 'framework-specific':
      case 'mixed':
        // Add patterns for each detected source directory
        sourceDirectories.forEach((dir) => {
          if (dir.confidence > 0.5) {
            include.push(`${dir.path}/**/*.{js,ts,jsx,tsx,py,vue,svelte}`);
          }
        });
        break;
      case 'monorepo':
        // Use detected workspaces if available
        if (monorepoInfo.workspaces.length > 0) {
          monorepoInfo.workspaces.forEach((workspace) => {
            include.push(`${workspace}/**/*.{js,ts,jsx,tsx,py,vue,svelte}`);

            // Add workspace-specific source patterns
            include.push(`${workspace}/src/**/*.{js,ts,jsx,tsx,py,vue,svelte}`);
            include.push(`${workspace}/lib/**/*.{js,ts,jsx,tsx,py,vue,svelte}`);

            // Exclude workspace-specific build artifacts
            exclude.push(`${workspace}/dist/**`);
            exclude.push(`${workspace}/build/**`);
            exclude.push(`${workspace}/node_modules/**`);
          });
        } else {
          // Fallback to common monorepo patterns
          include.push('packages/**/*.{js,ts,jsx,tsx,py,vue,svelte}');
          include.push('apps/**/*.{js,ts,jsx,tsx,py,vue,svelte}');
          include.push('services/**/*.{js,ts,jsx,tsx,py,vue,svelte}');
        }
        break;
      default:
        // Fallback to common patterns
        include.push(
          'src/**/*.{js,ts,jsx,tsx,py,vue,svelte}',
          'lib/**/*.{js,ts,jsx,tsx,py,vue,svelte}',
          '**/*.{js,ts,jsx,tsx,py,vue,svelte}'
        );
    }

    // Add framework-specific patterns
    frameworkIndicators.forEach((indicator) => {
      if (indicator.confidence > 0.5) {
        // Special handling for micro-frontend architecture
        if (indicator.framework === 'micro-frontend') {
          include.push(
            'shell/**/*.{js,ts,jsx,tsx}',
            'host/**/*.{js,ts,jsx,tsx}',
            'remotes/**/*.{js,ts,jsx,tsx}',
            'apps/*/src/**/*.{js,ts,jsx,tsx}',
            'mfe/*/src/**/*.{js,ts,jsx,tsx}'
          );
          exclude.push('**/remoteEntry.js', '**/federation-stats.json', '**/.module-federation/**');
        } else if (indicator.framework === 'nx') {
          // Enhanced Nx monorepo patterns
          include.push(
            'apps/*/src/**/*.{js,ts,jsx,tsx}',
            'libs/*/src/**/*.{js,ts,jsx,tsx}',
            'libs/shared/*/src/**/*.{js,ts,jsx,tsx}',
            'tools/**/*.{js,ts}'
          );
          exclude.push('dist/apps/**', 'dist/libs/**', '.nx/**');
        } else {
          // Standard framework patterns
          indicator.directoryPatterns.forEach((pattern) => {
            include.push(`${pattern}/**/*.{js,ts,jsx,tsx,py,vue,svelte}`);
          });
        }
      }
    });

    // Add full-stack specific patterns
    if (fullStackInfo.isFullStack) {
      if (fullStackInfo.structure === 'separated') {
        // Separated frontend/backend structure
        include.push(
          'client/**/*.{js,ts,jsx,tsx}',
          'frontend/**/*.{js,ts,jsx,tsx}',
          'server/**/*.{js,ts,py}',
          'backend/**/*.{js,ts,py}',
          'api/**/*.{js,ts,py}'
        );
      } else if (fullStackInfo.structure === 'integrated') {
        // Integrated structure - be more specific
        include.push(
          'src/components/**/*.{js,ts,jsx,tsx}',
          'src/pages/**/*.{js,ts,jsx,tsx}',
          'src/routes/**/*.{js,ts}',
          'src/controllers/**/*.{js,ts,py}',
          'src/models/**/*.{js,ts,py}'
        );
      }
    }

    // Add package-based architecture patterns
    if (packageArchitecture.hasPackageArchitecture) {
      packageArchitecture.packagePatterns.forEach((pattern) => {
        include.push(`${pattern}/**/*.{js,ts,jsx,tsx,py,vue,svelte}`);
      });

      // Add architecture-specific patterns
      switch (packageArchitecture.architectureType) {
        case 'feature-based':
          include.push(
            'features/**/components/**/*.{js,ts,jsx,tsx}',
            'features/**/services/**/*.{js,ts}',
            'features/**/hooks/**/*.{js,ts}'
          );
          break;
        case 'layer-based':
          include.push(
            'presentation/**/*.{js,ts,jsx,tsx}',
            'business/**/*.{js,ts}',
            'data/**/*.{js,ts}',
            'infrastructure/**/*.{js,ts}'
          );
          break;
        case 'domain-based':
          include.push(
            'domains/**/entities/**/*.{js,ts}',
            'domains/**/services/**/*.{js,ts}',
            'domains/**/repositories/**/*.{js,ts}'
          );
          break;
      }
    }

    // Generate test patterns
    testDirectories.forEach((testDir) => {
      testIncludes.push(`${testDir.path}/**/*.{test,spec}.{js,ts,jsx,tsx,py}`);
      testIncludes.push(`${testDir.path}/**/*.{js,ts,jsx,tsx,py}`);
    });

    // Add common test patterns if no specific test directories found
    if (testIncludes.length === 0) {
      testIncludes.push(
        '**/*.{test,spec}.{js,ts,jsx,tsx,py}',
        '**/test/**/*.{js,ts,jsx,tsx,py}',
        '**/tests/**/*.{js,ts,jsx,tsx,py}',
        '**/__tests__/**/*.{js,ts,jsx,tsx,py}'
      );
    }

    return {
      include: [...new Set(include)], // Remove duplicates
      exclude: [...new Set(exclude)],
      testIncludes: [...new Set(testIncludes)],
      testExcludes: [...new Set(testExcludes)],
    };
  }

  // Helper methods

  private async getDirectoryFiles(dirPath: string, maxDepth?: number): Promise<string[]> {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      const files: string[] = [];

      for (const entry of entries) {
        if (entry.isFile()) {
          files.push(entry.name);
        } else if (entry.isDirectory() && (!maxDepth || maxDepth > 1)) {
          const subFiles = await this.getDirectoryFiles(
            path.join(dirPath, entry.name),
            maxDepth ? maxDepth - 1 : undefined
          );
          files.push(...subFiles.map((file) => path.join(entry.name, file)));
        }
      }

      return files;
    } catch {
      return [];
    }
  }

  private filterSourceFiles(files: string[]): string[] {
    const sourceExtensions = ['.js', '.ts', '.jsx', '.tsx', '.py', '.vue', '.svelte'];
    return files.filter((file) => {
      const ext = path.extname(file);
      return sourceExtensions.includes(ext) && !this.isTestFile(file);
    });
  }

  private isTestFile(file: string): boolean {
    return (
      /\.(test|spec)\.(js|ts|jsx|tsx|py)$/.test(file) ||
      file.includes('__tests__') ||
      file.includes('/test/') ||
      file.includes('/tests/')
    );
  }

  private isInSubdirectory(file: string): boolean {
    return file.includes('/') || file.includes('\\');
  }

  private getSourceDirectoryIndicators(dirName: string, sourceFiles: string[]): string[] {
    const indicators: string[] = [];

    // Standard directory indicators
    if (['src', 'lib', 'app'].includes(dirName)) {
      indicators.push('standard-directory');
    }

    // Framework indicators
    if (sourceFiles.some((f) => f.endsWith('.jsx') || f.endsWith('.tsx'))) {
      indicators.push('react-files');
    }
    if (sourceFiles.some((f) => f.endsWith('.vue'))) {
      indicators.push('vue-files');
    }
    if (sourceFiles.some((f) => f.endsWith('.svelte'))) {
      indicators.push('svelte-files');
    }

    // Size indicators
    if (sourceFiles.length > 20) {
      indicators.push('large-codebase');
    } else if (sourceFiles.length > 5) {
      indicators.push('medium-codebase');
    }

    return indicators;
  }

  private calculateSourceConfidence(
    dirName: string,
    sourceFiles: string[],
    indicators: string[]
  ): number {
    let confidence = 0;

    // Base confidence by directory name
    const dirScores: Record<string, number> = {
      src: 0.9,
      lib: 0.8,
      app: 0.8,
      source: 0.7,
      code: 0.6,
      components: 0.6,
      utils: 0.5,
      helpers: 0.5,
    };

    confidence += dirScores[dirName] ?? 0.3;

    // File count boost
    if (sourceFiles.length > 10) confidence += 0.2;
    else if (sourceFiles.length > 3) confidence += 0.1;

    // Indicator boost
    if (indicators.includes('standard-directory')) confidence += 0.1;
    if (indicators.includes('react-files')) confidence += 0.05;

    return Math.min(0.95, confidence);
  }

  private classifySourceDirectoryType(
    dirName: string,
    _indicators: string[]
  ): 'primary' | 'secondary' | 'framework-specific' {
    if (['src', 'lib', 'app'].includes(dirName)) {
      return 'primary';
    }
    if (['components', 'pages', 'views'].includes(dirName)) {
      return 'framework-specific';
    }
    return 'secondary';
  }

  private classifyTestType(
    dirName: string,
    testFiles: string[]
  ): 'unit' | 'integration' | 'e2e' | 'mixed' {
    if (dirName.includes('e2e') || dirName.includes('integration')) {
      return dirName.includes('e2e') ? 'e2e' : 'integration';
    }
    if (dirName.includes('unit')) {
      return 'unit';
    }

    // Analyze test files to determine type
    const hasIntegrationTests = testFiles.some(
      (f) => f.includes('integration') || f.includes('e2e')
    );
    const hasUnitTests = testFiles.some(
      (f) => f.includes('unit') || (!f.includes('integration') && !f.includes('e2e'))
    );

    if (hasIntegrationTests && hasUnitTests) return 'mixed';
    if (hasIntegrationTests) return 'integration';
    return 'unit';
  }

  private findRelatedSourceDirectory(testDir: string): string | undefined {
    // Simple heuristic: look for source directory with similar name
    const testBasename = path.basename(testDir);
    if (testBasename === 'test' || testBasename === 'tests') {
      return 'src'; // Default assumption
    }
    return undefined;
  }

  private detectTestFramework(testFiles: string[]): string | undefined {
    const content = testFiles.join(' ');
    if (content.includes('jest') || content.includes('.test.')) return 'jest';
    if (content.includes('vitest')) return 'vitest';
    if (content.includes('mocha')) return 'mocha';
    if (content.includes('pytest') || content.includes('test_')) return 'pytest';
    return undefined;
  }

  private async findDirectoriesMatching(pattern: string): Promise<string[]> {
    // Simplified directory finding - would integrate with fast-glob in real implementation
    try {
      const fg = await import('fast-glob');
      return await fg.default(pattern, {
        cwd: this.projectPath,
        onlyDirectories: true,
        ignore: ['node_modules/**', '.git/**'],
      });
    } catch {
      return [];
    }
  }

  private async findFilesMatching(patterns: string[]): Promise<string[]> {
    try {
      const fg = await import('fast-glob');
      return await fg.default(patterns, {
        cwd: this.projectPath,
        onlyFiles: true,
        ignore: ['node_modules/**', '.git/**'],
      });
    } catch {
      return [];
    }
  }

  private async scoreDirectoryPattern(directories: string[]): Promise<number> {
    let score = 0;
    for (const dir of directories) {
      try {
        await fs.stat(path.join(this.projectPath, dir));
        score += 1;
      } catch {
        // Directory doesn't exist
      }
    }
    return directories.length > 0 ? score / directories.length : 0;
  }

  private async scoreFilePattern(patterns: string[]): Promise<number> {
    const files = await this.findFilesMatching(patterns);
    return files.length > 0 ? Math.min(1, files.length / 5) : 0;
  }

  /**
   * Score nested directory patterns for better framework detection
   */
  private async scoreNestedPatterns(patterns: string[]): Promise<number> {
    let totalScore = 0;
    let validPatterns = 0;

    for (const pattern of patterns) {
      try {
        // Check if the nested pattern exists
        const dirs = await this.findDirectoriesMatching(pattern);
        if (dirs.length > 0) {
          totalScore += 1;
          validPatterns++;
        }
      } catch {
        // Pattern doesn't match
      }
    }

    return validPatterns > 0 ? totalScore / patterns.length : 0;
  }

  /**
   * Detect micro-frontend architecture patterns
   */
  private async detectMicroFrontendArchitecture(): Promise<FrameworkIndicator | null> {
    const microFrontendPatterns = {
      directories: [
        'shell',
        'host',
        'remote',
        'remotes',
        'apps/shell',
        'apps/host',
        'packages/shell',
        'micro-apps',
        'micro-frontends',
        'mfe',
      ],
      files: [
        'module-federation.config.*',
        'webpack.config.*federation*',
        '**/remoteEntry.js',
        'federation.config.*',
      ],
      nestedPatterns: [
        'apps/*/webpack.config.*',
        'packages/*/module-federation.config.*',
        'mfe/*/src',
      ],
    };

    const directoryScore = await this.scoreDirectoryPattern(microFrontendPatterns.directories);
    const fileScore = await this.scoreFilePattern(microFrontendPatterns.files);
    const nestedScore = await this.scoreNestedPatterns(microFrontendPatterns.nestedPatterns);

    const confidence = directoryScore * 0.3 + fileScore * 0.5 + nestedScore * 0.2;

    if (confidence > 0.4) {
      return {
        framework: 'micro-frontend',
        confidence,
        directoryPatterns: [
          ...microFrontendPatterns.directories,
          ...microFrontendPatterns.nestedPatterns,
        ],
        filePatterns: microFrontendPatterns.files,
      };
    }

    return null;
  }

  /**
   * Enhanced monorepo detection with better workspace support
   */
  private async detectEnhancedMonorepoStructure(): Promise<MonorepoInfo> {
    const baseInfo = await this.detectMonorepoStructure();

    // Check for additional monorepo patterns
    const monorepoIndicators = [
      'lerna.json',
      'rush.json',
      'pnpm-workspace.yaml',
      '.yarn/workspaces',
      'nx.json',
    ];

    let hasAdvancedMonorepo = false;
    for (const indicator of monorepoIndicators) {
      try {
        await fs.stat(path.join(this.projectPath, indicator));
        hasAdvancedMonorepo = true;
        break;
      } catch {
        // File doesn't exist
      }
    }

    if (hasAdvancedMonorepo || baseInfo.isMonorepo) {
      // Detect workspace patterns more accurately
      const workspacePatterns = await this.detectWorkspacePatterns();
      return {
        ...baseInfo,
        isMonorepo: true,
        workspaces: workspacePatterns.length > 0 ? workspacePatterns : baseInfo.workspaces,
      };
    }

    return baseInfo;
  }

  /**
   * Detect workspace patterns in monorepos
   */
  private async detectWorkspacePatterns(): Promise<string[]> {
    const patterns: string[] = [];

    // Common monorepo workspace patterns
    const workspaceLocations = [
      'packages/*',
      'apps/*',
      'libs/*',
      'services/*',
      'modules/*',
      '@*/*', // Scoped packages
    ];

    for (const location of workspaceLocations) {
      const dirs = await this.findDirectoriesMatching(location);
      if (dirs.length > 0) {
        patterns.push(location);
      }
    }

    return patterns;
  }

  /**
   * Detect full-stack project patterns (frontend + backend in same repo)
   */
  private async detectFullStackPatterns(): Promise<{
    isFullStack: boolean;
    frontendFrameworks: string[];
    backendFrameworks: string[];
    structure: 'separated' | 'integrated' | 'monorepo';
  }> {
    // Common full-stack directory patterns
    const fullStackPatterns = {
      separated: {
        frontend: ['client', 'frontend', 'web', 'ui'],
        backend: ['server', 'backend', 'api', 'service'],
      },
      integrated: {
        patterns: ['app', 'src'],
        indicators: {
          frontend: ['components', 'pages', 'views'],
          backend: ['routes', 'controllers', 'models', 'api'],
        },
      },
    };

    const frontendDirs: string[] = [];
    const backendDirs: string[] = [];

    // Check for separated structure
    for (const frontDir of fullStackPatterns.separated.frontend) {
      try {
        const stat = await fs.stat(path.join(this.projectPath, frontDir));
        if (stat.isDirectory()) {
          frontendDirs.push(frontDir);
        }
      } catch {
        // Directory doesn't exist
      }
    }

    for (const backDir of fullStackPatterns.separated.backend) {
      try {
        const stat = await fs.stat(path.join(this.projectPath, backDir));
        if (stat.isDirectory()) {
          backendDirs.push(backDir);
        }
      } catch {
        // Directory doesn't exist
      }
    }

    // Detect frameworks in each part
    const frontendFrameworks: string[] = [];
    const backendFrameworks: string[] = [];

    // Frontend framework detection
    if (frontendDirs.length > 0 || (await this.hasFile('package.json'))) {
      const reactIndicators = await this.findFilesMatching(['**/*.jsx', '**/*.tsx']);
      const vueIndicators = await this.findFilesMatching(['**/*.vue']);
      const angularIndicators = await this.findFilesMatching(['angular.json']);

      if (reactIndicators.length > 0) frontendFrameworks.push('react');
      if (vueIndicators.length > 0) frontendFrameworks.push('vue');
      if (angularIndicators.length > 0) frontendFrameworks.push('angular');
    }

    // Backend framework detection
    if (
      backendDirs.length > 0 ||
      (await this.hasFile('server.js')) ||
      (await this.hasFile('app.py'))
    ) {
      const expressIndicators = await this.findFilesMatching([
        '**/routes/**/*.js',
        'server.js',
        'app.js',
      ]);
      const djangoIndicators = await this.findFilesMatching(['manage.py', '**/models.py']);
      const fastApiIndicators = await this.findFilesMatching(['main.py', '**/routers/**/*.py']);

      if (expressIndicators.length > 0) backendFrameworks.push('express');
      if (djangoIndicators.length > 0) backendFrameworks.push('django');
      if (fastApiIndicators.length > 0) backendFrameworks.push('fastapi');
    }

    const isFullStack = frontendFrameworks.length > 0 && backendFrameworks.length > 0;
    let structure: 'separated' | 'integrated' | 'monorepo' = 'integrated';

    if (frontendDirs.length > 0 && backendDirs.length > 0) {
      structure = 'separated';
    } else if ((await this.hasFile('lerna.json')) || (await this.hasFile('nx.json'))) {
      structure = 'monorepo';
    }

    return {
      isFullStack,
      frontendFrameworks,
      backendFrameworks,
      structure,
    };
  }

  /**
   * Check if a file exists
   */
  private async hasFile(filename: string): Promise<boolean> {
    try {
      await fs.stat(path.join(this.projectPath, filename));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Detect package-based architecture patterns
   */
  private async detectPackageBasedArchitecture(): Promise<{
    hasPackageArchitecture: boolean;
    packagePatterns: string[];
    architectureType: 'feature-based' | 'layer-based' | 'domain-based' | 'mixed';
  }> {
    const packageIndicators = {
      'feature-based': ['features/*', 'modules/*', 'packages/features/*', 'src/features/*'],
      'layer-based': ['presentation/*', 'business/*', 'data/*', 'domain/*', 'infrastructure/*'],
      'domain-based': ['domains/*', 'bounded-contexts/*', 'contexts/*', 'aggregates/*'],
    };

    const detectedPatterns: string[] = [];
    let architectureType: 'feature-based' | 'layer-based' | 'domain-based' | 'mixed' = 'mixed';
    let maxScore = 0;

    for (const [archType, patterns] of Object.entries(packageIndicators)) {
      let score = 0;
      for (const pattern of patterns) {
        const dirs = await this.findDirectoriesMatching(pattern);
        if (dirs.length > 0) {
          score++;
          detectedPatterns.push(pattern);
        }
      }

      if (score > maxScore) {
        maxScore = score;
        architectureType = archType as typeof architectureType;
      }
    }

    const hasPackageArchitecture = detectedPatterns.length > 0;

    return {
      hasPackageArchitecture,
      packagePatterns: detectedPatterns,
      architectureType,
    };
  }
}
