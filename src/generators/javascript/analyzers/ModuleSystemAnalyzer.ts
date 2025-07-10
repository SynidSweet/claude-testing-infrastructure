import { logger, fs, path } from '../../../utils/common-imports';
import type { ModuleSystemInfo } from '../../../analyzers/ProjectAnalyzer';

interface PackageJsonContent {
  type?: 'module' | 'commonjs';
  [key: string]: unknown;
}

export interface FileModuleSystemInfo extends ModuleSystemInfo {
  /** File-specific module type (may differ from project default) */
  fileModuleType?: 'commonjs' | 'esm' | 'mixed';
  /** Import style used in this specific file */
  importStyle?: 'require' | 'import' | 'both' | 'none';
  /** Export style used in this specific file */
  exportStyle?: 'commonjs' | 'esm' | 'both' | 'none';
  /** Whether the file uses dynamic imports */
  hasDynamicImports?: boolean;
  /** File extension for this file */
  fileExtension?: string;
}

export interface ModuleAnalysisOptions {
  /** Path to the project root */
  projectPath: string;
  /** Path to package.json (if available) */
  packageJsonPath?: string;
  /** Whether to check file extension (.mjs, .cjs) */
  checkFileExtension?: boolean;
  /** Whether to analyze imports/exports in file content */
  analyzeContent?: boolean;
}

/**
 * Analyzes JavaScript/TypeScript module systems at both project and file level
 *
 * This analyzer provides:
 * - Project-level module system detection from package.json
 * - File-level module system analysis
 * - Mixed module system handling
 * - Import/export style detection
 */
export class ModuleSystemAnalyzer {
  private projectModuleSystem: ModuleSystemInfo | null = null;
  private packageJsonCache: PackageJsonContent | undefined | null = null;

  constructor(private options: ModuleAnalysisOptions) {}

  /**
   * Analyze module system for the entire project
   * Results are cached for subsequent calls
   */
  async analyzeProject(): Promise<ModuleSystemInfo> {
    if (this.projectModuleSystem) {
      return this.projectModuleSystem;
    }

    try {
      const packageJson = await this.readPackageJson();

      if (!packageJson) {
        // No package.json found, analyze based on files
        const fileBasedAnalysis = await this.analyzeProjectFromFiles();
        this.projectModuleSystem = fileBasedAnalysis;
        return fileBasedAnalysis;
      }

      // Check explicit type field in package.json
      if (packageJson.type === 'module') {
        this.projectModuleSystem = {
          type: 'esm',
          hasPackageJsonType: true,
          packageJsonType: 'module',
          confidence: 1.0,
          fileExtensionPattern: await this.detectFileExtensionPattern(),
        };
      } else if (packageJson.type === 'commonjs') {
        this.projectModuleSystem = {
          type: 'commonjs',
          hasPackageJsonType: true,
          packageJsonType: 'commonjs',
          confidence: 1.0,
          fileExtensionPattern: await this.detectFileExtensionPattern(),
        };
      } else {
        // No explicit type - analyze files
        const fileBasedAnalysis = await this.analyzeProjectFromFiles();
        this.projectModuleSystem = {
          ...fileBasedAnalysis,
          hasPackageJsonType: false,
        };
      }

      return this.projectModuleSystem;
    } catch (error) {
      logger.error('Error analyzing project module system:', error);
      // Default to CommonJS
      this.projectModuleSystem = {
        type: 'commonjs',
        hasPackageJsonType: false,
        confidence: 0.5,
        fileExtensionPattern: 'js',
      };
      return this.projectModuleSystem;
    }
  }

  /**
   * Analyze module system for a specific file
   * Takes into account project defaults and file-specific patterns
   */
  async analyzeFile(filePath: string): Promise<FileModuleSystemInfo> {
    const projectInfo = await this.analyzeProject();
    const fileInfo: FileModuleSystemInfo = { ...projectInfo };

    // Check file extension for explicit module type
    const fileExtension = path.extname(filePath);
    fileInfo.fileExtension = fileExtension;

    if (this.options.checkFileExtension !== false) {
      if (fileExtension === '.mjs') {
        fileInfo.fileModuleType = 'esm';
        fileInfo.confidence = 1.0;
      } else if (fileExtension === '.cjs') {
        fileInfo.fileModuleType = 'commonjs';
        fileInfo.confidence = 1.0;
      }
    }

    // Analyze file content if requested
    if (this.options.analyzeContent !== false) {
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const contentAnalysis = this.analyzeFileContent(content);

        // Merge content analysis with file info
        fileInfo.importStyle = contentAnalysis.importStyle;
        fileInfo.exportStyle = contentAnalysis.exportStyle;
        fileInfo.hasDynamicImports = contentAnalysis.hasDynamicImports;

        // Determine file module type if not already set by extension
        if (!fileInfo.fileModuleType) {
          if (contentAnalysis.importStyle === 'import' && contentAnalysis.exportStyle === 'esm') {
            fileInfo.fileModuleType = 'esm';
          } else if (
            contentAnalysis.importStyle === 'require' &&
            contentAnalysis.exportStyle === 'commonjs'
          ) {
            fileInfo.fileModuleType = 'commonjs';
          } else if (
            contentAnalysis.importStyle === 'both' ||
            contentAnalysis.exportStyle === 'both'
          ) {
            fileInfo.fileModuleType = 'mixed';
          } else {
            // Use project default
            fileInfo.fileModuleType = projectInfo.type;
          }
        }
      } catch (error) {
        logger.debug(`Error analyzing file content for ${filePath}:`, error);
      }
    }

    return fileInfo;
  }

  /**
   * Determine the import syntax to use for a test file based on module analysis
   */
  getImportSyntax(moduleInfo: FileModuleSystemInfo): 'require' | 'import' {
    // If file has explicit module type, use that
    if (moduleInfo.fileModuleType === 'esm') {
      return 'import';
    } else if (moduleInfo.fileModuleType === 'commonjs') {
      return 'require';
    }

    // Use project default
    return moduleInfo.type === 'esm' ? 'import' : 'require';
  }

  /**
   * Get the appropriate file extension for imports based on module system
   */
  getImportExtension(moduleInfo: FileModuleSystemInfo): string {
    if (moduleInfo.type === 'esm' || moduleInfo.fileModuleType === 'esm') {
      // ES modules require extensions for relative imports
      return moduleInfo.fileExtension === '.ts' || moduleInfo.fileExtension === '.tsx' ? '' : '.js';
    }
    // CommonJS doesn't require extensions
    return '';
  }

  /**
   * Analyze project module system from source files
   */
  private async analyzeProjectFromFiles(): Promise<ModuleSystemInfo> {
    try {
      const sourceFiles = await this.findSourceFiles();

      if (sourceFiles.length === 0) {
        return {
          type: 'commonjs',
          hasPackageJsonType: false,
          confidence: 0.5,
          fileExtensionPattern: 'js',
        };
      }

      let esmCount = 0;
      let cjsCount = 0;
      let mixedCount = 0;
      const samplesToCheck = Math.min(sourceFiles.length, 20);

      for (let i = 0; i < samplesToCheck; i++) {
        try {
          const content = await fs.readFile(sourceFiles[i]!, 'utf-8');
          const analysis = this.analyzeFileContent(content);

          if (analysis.importStyle === 'import' || analysis.exportStyle === 'esm') {
            esmCount++;
          } else if (analysis.importStyle === 'require' || analysis.exportStyle === 'commonjs') {
            cjsCount++;
          } else if (analysis.importStyle === 'both' || analysis.exportStyle === 'both') {
            mixedCount++;
          }
        } catch (error) {
          logger.debug(`Error reading file ${sourceFiles[i]}:`, error);
        }
      }

      const total = esmCount + cjsCount + mixedCount;
      if (total === 0) {
        return {
          type: 'commonjs',
          hasPackageJsonType: false,
          confidence: 0.5,
          fileExtensionPattern: 'js',
        };
      }

      const esmRatio = esmCount / total;
      const cjsRatio = cjsCount / total;

      if (esmRatio > 0.7) {
        return {
          type: 'esm',
          hasPackageJsonType: false,
          confidence: Math.min(0.9, esmRatio),
          fileExtensionPattern: await this.detectFileExtensionPattern(),
        };
      } else if (cjsRatio > 0.7) {
        return {
          type: 'commonjs',
          hasPackageJsonType: false,
          confidence: Math.min(0.9, cjsRatio),
          fileExtensionPattern: await this.detectFileExtensionPattern(),
        };
      } else {
        return {
          type: 'mixed',
          hasPackageJsonType: false,
          confidence: 0.6,
          fileExtensionPattern: await this.detectFileExtensionPattern(),
        };
      }
    } catch (error) {
      logger.error('Error analyzing project from files:', error);
      return {
        type: 'commonjs',
        hasPackageJsonType: false,
        confidence: 0.5,
        fileExtensionPattern: 'js',
      };
    }
  }

  /**
   * Analyze content of a file to determine import/export patterns
   */
  private analyzeFileContent(content: string): {
    importStyle: 'require' | 'import' | 'both' | 'none';
    exportStyle: 'commonjs' | 'esm' | 'both' | 'none';
    hasDynamicImports: boolean;
  } {
    const hasImport = /\bimport\s+.*\s+from\s+['"`]/.test(content);
    const hasRequire = /\brequire\s*\(/.test(content);
    const hasDynamicImport = /\bimport\s*\(/.test(content);

    const hasEsmExport =
      /\bexport\s+(?:default\s+|(?:const|let|var|function|class)\s+)/.test(content) ||
      /\bexport\s*\{/.test(content);
    const hasCjsExport =
      /\bmodule\.exports\s*=/.test(content) || /\bexports\.\w+\s*=/.test(content);

    let importStyle: 'require' | 'import' | 'both' | 'none';
    if (hasImport && hasRequire) {
      importStyle = 'both';
    } else if (hasImport) {
      importStyle = 'import';
    } else if (hasRequire) {
      importStyle = 'require';
    } else {
      importStyle = 'none';
    }

    let exportStyle: 'commonjs' | 'esm' | 'both' | 'none';
    if (hasEsmExport && hasCjsExport) {
      exportStyle = 'both';
    } else if (hasEsmExport) {
      exportStyle = 'esm';
    } else if (hasCjsExport) {
      exportStyle = 'commonjs';
    } else {
      exportStyle = 'none';
    }

    return {
      importStyle,
      exportStyle,
      hasDynamicImports: hasDynamicImport,
    };
  }

  /**
   * Read and cache package.json
   */
  private async readPackageJson(): Promise<PackageJsonContent | undefined> {
    if (this.packageJsonCache !== null) {
      return this.packageJsonCache;
    }

    try {
      const packageJsonPath =
        this.options.packageJsonPath || path.join(this.options.projectPath, 'package.json');
      const content = await fs.readFile(packageJsonPath, 'utf-8');
      this.packageJsonCache = JSON.parse(content) as PackageJsonContent;
      return this.packageJsonCache;
    } catch (error) {
      logger.debug('No package.json found or error reading it:', error);
      this.packageJsonCache = undefined;
      return undefined;
    }
  }

  /**
   * Find source files in the project
   */
  private async findSourceFiles(): Promise<string[]> {
    const fg = (await import('fast-glob')).default;

    const patterns = [path.join(this.options.projectPath, '**/*.{js,jsx,mjs,cjs,ts,tsx}')];

    const ignore = [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/*.test.*',
      '**/*.spec.*',
      '**/test/**',
      '**/tests/**',
      '**/__tests__/**',
    ];

    try {
      const files = await fg(patterns, {
        ignore,
        absolute: true,
        onlyFiles: true,
      });

      return files || [];
    } catch (error) {
      logger.error('Error finding source files:', error);
      return [];
    }
  }

  /**
   * Detect the predominant file extension pattern in the project
   */
  private async detectFileExtensionPattern(): Promise<'js' | 'mjs' | 'ts'> {
    try {
      const sourceFiles = await this.findSourceFiles();

      let jsCount = 0;
      let mjsCount = 0;
      let tsCount = 0;

      for (const file of sourceFiles) {
        const ext = path.extname(file);
        if (ext === '.ts' || ext === '.tsx') {
          tsCount++;
        } else if (ext === '.mjs') {
          mjsCount++;
        } else if (ext === '.js' || ext === '.jsx') {
          jsCount++;
        }
      }

      // Return the most common pattern
      if (tsCount > jsCount && tsCount > mjsCount) {
        return 'ts';
      } else if (mjsCount > jsCount) {
        return 'mjs';
      } else {
        return 'js';
      }
    } catch (error) {
      logger.debug('Error detecting file extension pattern:', error);
      return 'js';
    }
  }
}
