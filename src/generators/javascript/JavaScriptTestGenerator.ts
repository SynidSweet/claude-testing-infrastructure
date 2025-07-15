import { BaseTestGenerator } from '../base/BaseTestGenerator';
import type {
  LanguageContext,
  SourceFileAnalysis,
  ExportedItem,
  ImportStatement,
} from '../base/BaseTestGenerator';
import type { ProjectAnalysis } from '../../analyzers/ProjectAnalyzer';
import type { TestGeneratorConfig, GeneratedTest } from '../TestGenerator';
import { TestType } from '../TestGenerator';
import { logger, fs, path } from '../../utils/common-imports';
import type { JavaScriptContext } from '../types/contexts';
import { ModuleSystemAnalyzer } from './analyzers/ModuleSystemAnalyzer';
import type { FileModuleSystemInfo } from './analyzers/ModuleSystemAnalyzer';
import { JSFrameworkDetector } from './analyzers/JSFrameworkDetector';
import { AsyncPatternDetector } from './analyzers/AsyncPatternDetector';
import type { FileAsyncPatterns } from './analyzers/AsyncPatternDetector';

/**
 * JavaScript/TypeScript specific test generator
 *
 * This generator understands JavaScript and TypeScript patterns,
 * frameworks, and idioms to create appropriate tests.
 */
export class JavaScriptTestGenerator extends BaseTestGenerator {
  private jsContext: JavaScriptContext;
  private moduleAnalyzer: ModuleSystemAnalyzer;
  private frameworkDetector: JSFrameworkDetector;
  private asyncDetector: AsyncPatternDetector;

  constructor(
    config: TestGeneratorConfig,
    analysis: ProjectAnalysis,
    languageContext: LanguageContext
  ) {
    super(config, analysis, languageContext);

    // Initialize JavaScript-specific context
    this.jsContext = this.buildJavaScriptContext();

    // Initialize module system analyzer
    this.moduleAnalyzer = new ModuleSystemAnalyzer({
      projectPath: config.projectPath,
      checkFileExtension: true,
      analyzeContent: true,
    });

    // Initialize framework detector
    this.frameworkDetector = new JSFrameworkDetector(
      config.projectPath,
      null // Will be loaded when needed
    );

    // Initialize async pattern detector
    this.asyncDetector = new AsyncPatternDetector({
      analyzeTypeScript: this.jsContext.isTypeScript,
      maxExamples: 3,
      minConfidence: 0.6,
    });
  }

  /**
   * Build JavaScript-specific context from project analysis
   */
  private buildJavaScriptContext(): JavaScriptContext {
    const moduleSystem = this.analysis.moduleSystem || {
      type: 'commonjs' as const,
      hasPackageJsonType: false,
      confidence: 0.5,
      fileExtensionPattern: 'js' as const,
    };

    const jsContext: JavaScriptContext = {
      moduleSystem: {
        type: moduleSystem.type,
        hasPackageJsonType: moduleSystem.hasPackageJsonType,
        confidence: moduleSystem.confidence,
        importExtension: moduleSystem.type === 'esm' ? '.js' : '',
      },
      isTypeScript: this.languageContext.language === 'typescript',
    };

    // Add optional properties only if they have values
    // These will be detected per file later

    return jsContext;
  }

  /**
   * Initialize framework detector with package.json if needed
   */
  private async ensureFrameworkDetectorInitialized(): Promise<void> {
    try {
      const packageJsonPath = path.join(this.config.projectPath, 'package.json');
      const packageJsonContent = await fs.readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(packageJsonContent);

      // Re-initialize framework detector with package.json
      this.frameworkDetector = new JSFrameworkDetector(this.config.projectPath, packageJson);
    } catch (error) {
      logger.debug('Could not load package.json for framework detection', { error });
      // Keep using the detector with null package.json
    }
  }

  /**
   * Get list of JavaScript/TypeScript files to test
   */
  protected async getFilesToTest(): Promise<string[]> {
    const fg = (await import('fast-glob')).default;

    // Get file extensions based on language
    const extensions = this.getSourceFileExtensions();
    const patterns = extensions.map((ext) => path.join(this.config.projectPath, `**/*${ext}`));

    // Get exclude patterns from config and defaults
    const excludePatterns = [
      ...this.getExcludePatterns(),
      ...(this.config.patterns?.exclude || []),
    ];

    try {
      const files = await fg(patterns, {
        ignore: excludePatterns,
        absolute: true,
        onlyFiles: true,
      });

      if (files) {
        logger.debug(`Found ${files.length} JavaScript/TypeScript files to test`, {
          patterns,
          excludePatterns,
        });
        return files;
      }

      return [];
    } catch (error) {
      logger.error('Failed to find JavaScript/TypeScript files', { error });
      throw error;
    }
  }

  /**
   * Get source file extensions for JavaScript/TypeScript
   */
  protected getSourceFileExtensions(): string[] {
    const extensions = ['.js', '.jsx', '.mjs'];

    if (this.jsContext.isTypeScript) {
      extensions.push('.ts', '.tsx');
    }

    return extensions;
  }

  /**
   * Public wrapper to generate a test for a specific file
   * Used by the adapter system
   */
  public async generateTestForFilePublic(filePath: string): Promise<GeneratedTest | null> {
    return this.generateTestForFile(filePath);
  }

  /**
   * Generate a test for a specific JavaScript/TypeScript file
   */
  protected async generateTestForFile(filePath: string): Promise<GeneratedTest | null> {
    try {
      // Skip test files
      if (this.isTestFile(filePath)) {
        logger.debug(`Skipping test file: ${filePath}`);
        return null;
      }

      // Analyze the source file
      const analysis = await this.analyzeSourceFile(filePath);

      // Skip files with no exports or only type exports
      if (analysis.exports.length === 0) {
        logger.debug(`Skipping file with no exports: ${filePath}`);
        return null;
      }

      // Select appropriate template
      const template = this.selectTestTemplate(analysis);

      // Generate test content
      const content = await this.generateTestContent(template, analysis);

      // Get test file path
      const testPath = this.getTestFilePath(filePath);

      // Determine test type based on file analysis
      const testType = this.mapFileTypeToTestType(analysis.fileType);

      return {
        sourcePath: filePath,
        testPath,
        testType,
        framework: this.languageContext.testFramework,
        content,
      };
    } catch (error) {
      logger.error(`Failed to generate test for ${filePath}`, { error });
      // Return null to skip this file rather than failing the entire generation
      return null;
    }
  }

  /**
   * Check if a file is a test file
   */
  private isTestFile(filePath: string): boolean {
    const fileName = path.basename(filePath);
    const testPatterns = [/\.test\.[jt]sx?$/, /\.spec\.[jt]sx?$/];

    // Check if the filename itself is a test file
    if (testPatterns.some((pattern) => pattern.test(fileName))) {
      return true;
    }

    // Check if the file is in a test directory (but avoid matching project paths)
    const pathSegments = filePath.split(path.sep);
    const testDirPatterns = ['__tests__', 'test', 'tests'];

    // Look for actual test directories in the path, but exclude the first few segments
    // to avoid matching project paths like "/test/project"
    for (let i = 2; i < pathSegments.length - 1; i++) {
      const segment = pathSegments[i];
      if (segment && testDirPatterns.includes(segment)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Map file type to test type
   */
  private mapFileTypeToTestType(fileType: string): TestType {
    switch (fileType) {
      case 'component':
        return TestType.COMPONENT;
      case 'api':
      case 'middleware':
        return TestType.API;
      case 'service':
      case 'model':
      case 'repository':
        return TestType.SERVICE;
      case 'util':
      case 'helper':
      case 'lib':
        return TestType.UTILITY;
      case 'hook':
      case 'store':
      case 'reducer':
      case 'context':
        return TestType.UNIT; // These are typically unit tested
      case 'config':
      case 'constants':
        return TestType.UNIT; // Config files usually have simple unit tests
      default:
        return TestType.UNIT;
    }
  }

  /**
   * Analyze a JavaScript/TypeScript source file
   */
  protected async analyzeSourceFile(filePath: string): Promise<SourceFileAnalysis> {
    const content = await fs.readFile(filePath, 'utf-8');
    const relativePath = path.relative(this.config.projectPath, filePath);

    // Use ModuleSystemAnalyzer for detailed module analysis
    const moduleInfo = await this.moduleAnalyzer.analyzeFile(filePath);

    // Use AsyncPatternDetector for comprehensive async analysis
    const asyncAnalysis = await this.asyncDetector.analyzeFile(filePath);

    // Basic analysis - will be enhanced with proper AST parsing later
    const analysis: SourceFileAnalysis = {
      filePath,
      language: this.languageContext.language,
      ...(this.languageContext.framework && { framework: this.languageContext.framework }),
      fileType: this.detectFileType(filePath, content),
      exports: await this.extractExports(content, filePath, moduleInfo),
      imports: this.extractImports(content, moduleInfo),
      hasAsync: asyncAnalysis.hasAsyncPatterns,
      metadata: {
        relativePath,
        isTypeScript: this.jsContext.isTypeScript,
        moduleSystem: moduleInfo.fileModuleType || moduleInfo.type,
        moduleInfo, // Store full module info for import generation
        asyncPatterns: asyncAnalysis, // Store detailed async pattern analysis
      },
    };

    return analysis;
  }

  /**
   * Detect the type of JavaScript/TypeScript file
   */
  private detectFileType(filePath: string, content: string): string {
    const fileName = path.basename(filePath);
    const fileNameLower = fileName.toLowerCase();

    // Enhanced React component detection
    if (this.languageContext.framework === 'react' || this.languageContext.framework === 'nextjs') {
      if (
        /\.(jsx|tsx)$/.test(fileName) ||
        /import.*from\s+['"]react['"]/.test(content) ||
        /from\s+['"]react['"]/.test(content) ||
        /<[A-Z]\w*/.test(content)
      ) {
        // JSX syntax
        return 'component';
      }
    }

    // Enhanced Vue component detection
    if (this.languageContext.framework === 'vue' || this.languageContext.framework === 'nuxt') {
      if (
        fileName.endsWith('.vue') ||
        /import.*from\s+['"]vue['"]/.test(content) ||
        /<template>/.test(content)
      ) {
        return 'component';
      }
    }

    // Enhanced Angular component detection
    if (this.languageContext.framework === 'angular') {
      if (
        /@Component/.test(content) ||
        fileNameLower.includes('.component.') ||
        /@Directive/.test(content) ||
        /@Pipe/.test(content)
      ) {
        return 'component';
      }
    }

    // Svelte component detection
    if (this.languageContext.framework === 'svelte' && fileName.endsWith('.svelte')) {
      return 'component';
    }

    // API/Route detection - enhanced patterns
    if (
      /\.(router|routes|route|controller|controllers|api|endpoint|endpoints)\.[jt]sx?$/.test(
        fileNameLower
      ) ||
      /router\.[jt]sx?$/.test(fileNameLower) ||
      content.includes('express.Router()') ||
      content.includes('@Controller') || // NestJS
      content.includes('router.get(') ||
      content.includes('router.post(') ||
      content.includes('app.get(') ||
      content.includes('app.post(')
    ) {
      return 'api';
    }

    // Service/Model detection - enhanced patterns
    if (
      /\.(service|services|model|models|repository|repositories|dao|provider)\.[jt]sx?$/.test(
        fileNameLower
      ) ||
      /@Injectable/.test(content) || // NestJS/Angular
      content.includes('mongoose.Schema') || // Mongoose models
      content.includes('sequelize.define')
    ) {
      // Sequelize models
      return 'service';
    }

    // Hook detection (React/Vue hooks)
    if (
      /use[A-Z]/.test(fileName) ||
      fileNameLower.includes('.hook.') ||
      fileNameLower.includes('.hooks.') ||
      (content.includes('useState') && content.includes('useEffect'))
    ) {
      return 'hook';
    }

    // Store/State management detection
    if (
      fileNameLower.includes('store') ||
      fileNameLower.includes('reducer') ||
      fileNameLower.includes('context') ||
      content.includes('createStore') ||
      content.includes('createContext') ||
      content.includes('createSlice')
    ) {
      // Redux Toolkit
      return 'store';
    }

    // Middleware detection
    if (
      fileNameLower.includes('middleware') ||
      content.includes('(req, res, next)') ||
      content.includes('app.use(')
    ) {
      return 'middleware';
    }

    // Utility detection - enhanced patterns
    if (
      /\.(util|utils|helper|helpers|lib|common|shared)\.[jt]sx?$/.test(fileNameLower) ||
      fileNameLower.includes('/utils/') ||
      fileNameLower.includes('/helpers/') ||
      fileNameLower.includes('/lib/')
    ) {
      return 'util';
    }

    // Config/Constants detection
    if (
      /\.(config|configuration|constants|const|env)\.[jt]sx?$/.test(fileNameLower) ||
      fileNameLower === 'config.js' ||
      fileNameLower === 'constants.js'
    ) {
      return 'config';
    }

    // Default to module
    return 'module';
  }

  /**
   * Extract exports from JavaScript/TypeScript content
   * This is a simplified version - will be enhanced with AST parsing
   */
  private async extractExports(
    content: string,
    _filePath: string,
    moduleInfo: FileModuleSystemInfo
  ): Promise<ExportedItem[]> {
    const exports: ExportedItem[] = [];

    // Extract default exports
    // Handle export default class Name pattern
    const defaultClassMatch = content.match(/export\s+default\s+class\s+(\w+)/);
    if (defaultClassMatch?.[1]) {
      exports.push({
        name: defaultClassMatch[1],
        type: 'class',
        isDefault: true,
      });
    } else {
      // Handle other export default patterns
      const defaultExportMatch = content.match(/export\s+default\s+(\w+)/);
      if (defaultExportMatch?.[1]) {
        exports.push({
          name: defaultExportMatch[1],
          type: this.detectExportType(content, defaultExportMatch[1]),
          isDefault: true,
        });
      }
    }

    // Extract named exports
    const namedExportRegex =
      /export\s+(?:const|let|var|function|class|interface|type|enum)\s+(\w+)/g;
    let match;
    while ((match = namedExportRegex.exec(content)) !== null) {
      const name = match[1];
      if (name) {
        exports.push({
          name,
          type: this.detectExportType(content, name),
          isDefault: false,
          isAsync: this.isAsyncExport(content, name),
        });
      }
    }

    // Extract exports from export statements
    const exportStatementRegex = /export\s*{\s*([^}]+)\s*}/g;
    while ((match = exportStatementRegex.exec(content)) !== null) {
      if (match[1]) {
        const exportedItems = match[1].split(',').map((item) => item.trim());
        for (const item of exportedItems) {
          const [localName, exportedName] = item.split(/\s+as\s+/).map((s) => s.trim());
          if (localName) {
            exports.push({
              name: exportedName || localName,
              type: this.detectExportType(content, localName),
              isDefault: false,
            });
          }
        }
      }
    }

    // For CommonJS modules
    if (
      moduleInfo.fileModuleType === 'commonjs' ||
      (!moduleInfo.fileModuleType && moduleInfo.type === 'commonjs')
    ) {
      // Check for module.exports = { ... } pattern
      const objectExportsMatch = content.match(/module\.exports\s*=\s*{\s*([^}]+)\s*}/);
      if (objectExportsMatch?.[1]) {
        // Parse the exported properties
        const exportedProps = objectExportsMatch[1].split(',').map((prop) => prop.trim());
        for (const prop of exportedProps) {
          const propName = prop.split(':')[0]?.trim();
          if (propName) {
            exports.push({
              name: propName,
              type: this.detectExportType(content, propName),
              isDefault: false,
              isAsync: this.isAsyncExport(content, propName),
            });
          }
        }
      } else {
        // Check for module.exports = something pattern
        const moduleExportsMatch = content.match(/module\.exports\s*=\s*(\w+)/);
        if (moduleExportsMatch?.[1]) {
          exports.push({
            name: moduleExportsMatch[1],
            type: this.detectExportType(content, moduleExportsMatch[1]),
            isDefault: true,
          });
        }
      }

      // Named CommonJS exports
      const exportsRegex = /exports\.(\w+)\s*=/g;
      while ((match = exportsRegex.exec(content)) !== null) {
        if (match[1]) {
          exports.push({
            name: match[1],
            type: 'variable',
            isDefault: false,
          });
        }
      }
    }

    return exports;
  }

  /**
   * Detect the type of an export
   */
  private detectExportType(content: string, name: string): ExportedItem['type'] {
    const patterns = [
      { regex: new RegExp(`function\\s+${name}\\s*\\(`), type: 'function' as const },
      { regex: new RegExp(`class\\s+${name}\\s*(?:extends|{)`), type: 'class' as const },
      { regex: new RegExp(`const\\s+${name}\\s*=\\s*\\(`), type: 'function' as const },
      { regex: new RegExp(`const\\s+${name}\\s*=\\s*async`), type: 'function' as const },
      { regex: new RegExp(`const\\s+${name}\\s*=`), type: 'const' as const },
      { regex: new RegExp(`interface\\s+${name}\\s*{`), type: 'interface' as const },
      { regex: new RegExp(`type\\s+${name}\\s*=`), type: 'type' as const },
      { regex: new RegExp(`enum\\s+${name}\\s*{`), type: 'enum' as const },
    ];

    for (const { regex, type } of patterns) {
      if (regex.test(content)) {
        return type;
      }
    }

    return 'variable';
  }

  /**
   * Check if an export is async
   */
  private isAsyncExport(content: string, name: string): boolean {
    const asyncPatterns = [
      new RegExp(`async\\s+function\\s+${name}`),
      new RegExp(`const\\s+${name}\\s*=\\s*async`),
      new RegExp(`${name}\\s*=\\s*async`),
    ];

    return asyncPatterns.some((pattern) => pattern.test(content));
  }

  /**
   * Extract imports from JavaScript/TypeScript content
   */
  private extractImports(content: string, _moduleInfo: FileModuleSystemInfo): ImportStatement[] {
    const imports: ImportStatement[] = [];

    // ES6 imports
    const importRegex =
      /import\s+(?:type\s+)?(?:(\w+)|{([^}]+)}|\*\s+as\s+(\w+))?\s*(?:,\s*{([^}]+)})?\s*from\s+['"]([^'"]+)['"]/g;
    let match;

    while ((match = importRegex.exec(content)) !== null) {
      const defaultImport = match[1] || match[3];
      const namedImports = [
        ...(match[2] ? match[2].split(',') : []),
        ...(match[4] ? match[4].split(',') : []),
      ]
        .map((s) => s.trim())
        .filter(Boolean);
      const source = match[5];
      const isTypeOnly = match[0]?.includes('import type') || false;

      if (source) {
        imports.push({
          source,
          imports: namedImports,
          ...(defaultImport && { defaultImport }),
          isTypeOnly,
        });
      }
    }

    // CommonJS requires
    const requireRegex =
      /(?:const|let|var)\s+(?:{([^}]+)}|(\w+))\s*=\s*require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

    while ((match = requireRegex.exec(content)) !== null) {
      const namedImports = match[1] ? match[1].split(',').map((s) => s.trim()) : [];
      const defaultImport = match[2];
      const source = match[3];

      if (source) {
        imports.push({
          source,
          imports: namedImports,
          ...(defaultImport && { defaultImport }),
        });
      }
    }

    return imports;
  }

  /**
   * Select appropriate test template based on file analysis
   */
  protected selectTestTemplate(analysis: SourceFileAnalysis): string {
    // This will be enhanced to return actual template content
    // For now, return a template key
    if (analysis.fileType === 'component') {
      return `${this.languageContext.framework}-component`;
    }

    if (analysis.fileType === 'api') {
      return 'api-endpoint';
    }

    if (analysis.fileType === 'service') {
      return 'service';
    }

    return 'default';
  }

  /**
   * Generate test content from template and analysis
   */
  protected async generateTestContent(
    _template: string,
    analysis: SourceFileAnalysis
  ): Promise<string> {
    // Get module info from analysis metadata
    const moduleInfo = analysis.metadata?.moduleInfo as FileModuleSystemInfo | undefined;

    // Calculate import path from test file to source file
    const testPath = this.getTestFilePath(analysis.filePath);
    const importPath = this.calculateImportPath(testPath, analysis.filePath, moduleInfo);

    // Generate import statements
    const importStatements = await this.generateImportStatements(analysis, importPath, moduleInfo);

    // Generate test suites
    const testSuites = this.generateTestSuites(analysis);

    // Combine into final test content
    const content = [importStatements, '', testSuites].join('\n');

    return content;
  }

  /**
   * Calculate relative import path from test file to source file
   */
  private calculateImportPath(
    fromPath: string,
    toPath: string,
    moduleInfo?: FileModuleSystemInfo
  ): string {
    const fromDir = path.dirname(fromPath);
    let relativePath = path.relative(fromDir, toPath);

    // Ensure forward slashes
    relativePath = relativePath.replace(/\\/g, '/');

    // Add ./ prefix if needed
    if (!relativePath.startsWith('.')) {
      relativePath = `./${relativePath}`;
    }

    // Handle extension based on module system
    if (moduleInfo) {
      const extension = this.moduleAnalyzer.getImportExtension(moduleInfo);
      if (extension) {
        // Replace existing extension with the correct one
        relativePath = relativePath.replace(/\.[^/.]+$/, extension);
      } else {
        // Remove extension
        relativePath = relativePath.replace(/\.[^/.]+$/, '');
      }
    } else {
      // Fallback to old logic
      if (!this.jsContext.moduleSystem.importExtension) {
        relativePath = relativePath.replace(/\.[^/.]+$/, '');
      }
    }

    return relativePath;
  }

  /**
   * Generate import statements for the test file
   */
  private async generateImportStatements(
    analysis: SourceFileAnalysis,
    importPath: string,
    moduleInfo?: FileModuleSystemInfo
  ): Promise<string> {
    const imports: string[] = [];

    // Get preferred test framework
    await this.ensureFrameworkDetectorInitialized();
    const preferredTestFramework = await this.frameworkDetector.getPreferredTestFramework();
    const testFramework = this.languageContext.testFramework || preferredTestFramework;

    // Import test framework
    if (testFramework === 'jest') {
      // Jest globals are available, no import needed
    } else if (testFramework === 'vitest') {
      imports.push("import { describe, it, expect, beforeEach, afterEach } from 'vitest';");
    } else if (testFramework === 'mocha') {
      // Mocha globals are available, but we might need chai
      imports.push("import { expect } from 'chai';");
    }

    // Import items from source file
    const defaultExport = analysis.exports.find((exp) => exp.isDefault);
    const namedExports = analysis.exports.filter((exp) => !exp.isDefault);

    // Determine import syntax based on module info
    const importSyntax = moduleInfo
      ? this.moduleAnalyzer.getImportSyntax(moduleInfo)
      : this.jsContext.moduleSystem.type === 'esm'
        ? 'import'
        : 'require';

    if (importSyntax === 'import') {
      // ES module imports
      const importParts: string[] = [];

      if (defaultExport) {
        importParts.push(defaultExport.name);
      }

      if (namedExports.length > 0) {
        const namedImportStr = `{ ${namedExports.map((exp) => exp.name).join(', ')} }`;
        importParts.push(namedImportStr);
      }

      if (importParts.length > 0) {
        imports.push(`import ${importParts.join(', ')} from '${importPath}';`);
      }
    } else {
      // CommonJS imports
      if (defaultExport && namedExports.length === 0) {
        imports.push(`const ${defaultExport.name} = require('${importPath}');`);
      } else if (namedExports.length > 0) {
        const names = namedExports.map((exp) => exp.name).join(', ');
        imports.push(`const { ${names} } = require('${importPath}');`);
      }
    }

    return imports.join('\n');
  }

  /**
   * Generate test suites for the analyzed file
   */
  private generateTestSuites(analysis: SourceFileAnalysis): string {
    const fileName = path.basename(analysis.filePath);
    const suites: string[] = [];

    // Main describe block
    suites.push(`describe('${fileName}', () => {`);

    // Generate tests for each export
    for (const exportItem of analysis.exports) {
      if (exportItem.type === 'interface' || exportItem.type === 'type') {
        // Skip type-only exports
        continue;
      }

      suites.push(this.generateTestsForExport(exportItem, analysis));
    }

    suites.push('});');

    return suites.join('\n');
  }

  /**
   * Generate tests for a specific export
   */
  private generateTestsForExport(exportItem: ExportedItem, analysis: SourceFileAnalysis): string {
    const tests: string[] = [];

    tests.push(`  describe('${exportItem.name}', () => {`);

    switch (exportItem.type) {
      case 'function':
        tests.push(this.generateFunctionTests(exportItem, analysis));
        break;
      case 'class':
        tests.push(this.generateClassTests(exportItem, analysis));
        break;
      case 'variable':
      case 'const':
        tests.push(this.generateVariableTests(exportItem, analysis));
        break;
      default:
        tests.push(`    it('should be defined', () => {`);
        tests.push(`      expect(${exportItem.name}).toBeDefined();`);
        tests.push(`    });`);
    }

    tests.push('  });');
    tests.push('');

    return tests.join('\n');
  }

  /**
   * Generate tests for a function export
   */
  private generateFunctionTests(exportItem: ExportedItem, analysis: SourceFileAnalysis): string {
    const tests: string[] = [];

    tests.push(`    it('should be a function', () => {`);
    tests.push(`      expect(typeof ${exportItem.name}).toBe('function');`);
    tests.push(`    });`);
    tests.push('');

    // Get async pattern information from metadata
    const asyncPatterns = analysis.metadata?.asyncPatterns as FileAsyncPatterns | undefined;

    if (exportItem.isAsync || asyncPatterns?.hasAsyncPatterns) {
      // Generate async-aware tests based on detected patterns
      if (asyncPatterns?.primaryPattern === 'promise') {
        tests.push(`    it('should return a promise', () => {`);
        tests.push(`      const result = ${exportItem.name}();`);
        tests.push(`      expect(result).toBeInstanceOf(Promise);`);
        tests.push(`    });`);
        tests.push('');
        tests.push(`    it('should resolve successfully', async () => {`);
        tests.push(`      // TODO: Add test implementation for promise resolution`);
        tests.push(`      const result = await ${exportItem.name}();`);
        tests.push(`      expect(result).toBeDefined();`);
        tests.push(`    });`);
      } else if (asyncPatterns?.primaryPattern === 'callback') {
        tests.push(`    it('should handle callbacks', (done) => {`);
        tests.push(`      // TODO: Add callback test implementation`);
        tests.push(`      ${exportItem.name}((err, result) => {`);
        tests.push(`        expect(err).toBeNull();`);
        tests.push(`        expect(result).toBeDefined();`);
        tests.push(`        done();`);
        tests.push(`      });`);
        tests.push(`    });`);
      } else {
        // Default async/await pattern
        tests.push(`    it('should handle async operations', async () => {`);
        tests.push(`      // TODO: Add async test implementation`);
        tests.push(`      const result = await ${exportItem.name}();`);
        tests.push(`      expect(result).toBeDefined();`);
        tests.push(`    });`);
      }

      // Add error handling test for async functions
      tests.push('');
      tests.push(`    it('should handle errors appropriately', async () => {`);
      tests.push(`      // TODO: Add error handling test`);
      tests.push(`      try {`);
      tests.push(`        await ${exportItem.name}(/* invalid params */);`);
      tests.push(`        fail('Should have thrown an error');`);
      tests.push(`      } catch (error) {`);
      tests.push(`        expect(error).toBeDefined();`);
      tests.push(`      }`);
      tests.push(`    });`);
    } else {
      tests.push(`    it('should return expected result', () => {`);
      tests.push(`      // TODO: Add test implementation`);
      tests.push(`      const result = ${exportItem.name}();`);
      tests.push(`      expect(result).toBeDefined();`);
      tests.push(`    });`);
    }

    return tests.join('\n');
  }

  /**
   * Generate tests for a class export
   */
  private generateClassTests(exportItem: ExportedItem, _analysis: SourceFileAnalysis): string {
    const tests: string[] = [];

    tests.push(`    it('should be instantiable', () => {`);
    tests.push(`      expect(() => new ${exportItem.name}()).not.toThrow();`);
    tests.push(`    });`);
    tests.push('');

    tests.push(`    describe('instance', () => {`);
    tests.push(`      let instance;`);
    tests.push('');
    tests.push(`      beforeEach(() => {`);
    tests.push(`        instance = new ${exportItem.name}();`);
    tests.push(`      });`);
    tests.push('');
    tests.push(`      it('should have expected methods', () => {`);
    tests.push(`        // TODO: Add method existence tests`);
    tests.push(`        expect(instance).toBeDefined();`);
    tests.push(`      });`);
    tests.push(`    });`);

    return tests.join('\n');
  }

  /**
   * Generate tests for a variable/const export
   */
  private generateVariableTests(exportItem: ExportedItem, _analysis: SourceFileAnalysis): string {
    const tests: string[] = [];

    tests.push(`    it('should be defined', () => {`);
    tests.push(`      expect(${exportItem.name}).toBeDefined();`);
    tests.push(`    });`);
    tests.push('');

    tests.push(`    it('should have expected value or structure', () => {`);
    tests.push(`      // TODO: Add value/structure tests`);
    tests.push(`      expect(${exportItem.name}).toBeTruthy();`);
    tests.push(`    });`);

    return tests.join('\n');
  }
}
