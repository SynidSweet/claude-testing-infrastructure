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

/**
 * Python test generator
 *
 * This generator understands Python patterns and frameworks
 * to create appropriate pytest-based tests.
 */
export class PythonTestGenerator extends BaseTestGenerator {
  constructor(
    config: TestGeneratorConfig,
    analysis: ProjectAnalysis,
    languageContext: LanguageContext
  ) {
    super(config, analysis, languageContext);
  }

  /**
   * Get list of Python files to test
   */
  protected async getFilesToTest(): Promise<string[]> {
    const fg = (await import('fast-glob')).default;

    // Python file extensions
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
        logger.debug(`Found ${files.length} Python files to test`, {
          patterns,
          excludePatterns,
        });
        return files;
      }

      return [];
    } catch (error) {
      logger.error('Failed to find Python files', { error });
      throw error;
    }
  }

  /**
   * Get source file extensions for Python
   */
  protected getSourceFileExtensions(): string[] {
    return ['.py'];
  }

  /**
   * Public wrapper to generate a test for a specific file
   * Used by the adapter system
   */
  public async generateTestForFilePublic(filePath: string): Promise<GeneratedTest | null> {
    return this.generateTestForFile(filePath);
  }

  /**
   * Generate a test for a specific Python file
   */
  protected async generateTestForFile(filePath: string): Promise<GeneratedTest | null> {
    try {
      // Skip test files
      if (this.isTestFile(filePath)) {
        logger.debug(`Skipping test file: ${filePath}`);
        return null;
      }

      // Skip __init__.py files unless they have substantial content
      if (path.basename(filePath) === '__init__.py') {
        const content = await fs.readFile(filePath, 'utf-8');
        if (content.trim().length < 50) {
          logger.debug(`Skipping minimal __init__.py file: ${filePath}`);
          return null;
        }
      }

      // Analyze the source file
      const analysis = await this.analyzeSourceFile(filePath);

      // Skip files with no exports
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
    const testPatterns = [/test_.*\.py$/, /.*_test\.py$/, /test\.py$/];

    // Check if the filename itself is a test file
    if (testPatterns.some((pattern) => pattern.test(fileName))) {
      return true;
    }

    // Check if the file is in a test directory
    const pathSegments = filePath.split(path.sep);
    const testDirPatterns = ['tests', 'test'];

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
      case 'api':
      case 'route':
      case 'endpoint':
        return TestType.API;
      case 'service':
      case 'model':
      case 'repository':
        return TestType.SERVICE;
      case 'util':
      case 'helper':
      case 'utility':
        return TestType.UTILITY;
      case 'config':
      case 'settings':
      case 'constants':
        return TestType.UNIT;
      default:
        return TestType.UNIT;
    }
  }

  /**
   * Analyze a Python source file
   */
  protected async analyzeSourceFile(filePath: string): Promise<SourceFileAnalysis> {
    const content = await fs.readFile(filePath, 'utf-8');
    const relativePath = path.relative(this.config.projectPath, filePath);

    const analysis: SourceFileAnalysis = {
      filePath,
      language: this.languageContext.language,
      ...(this.languageContext.framework && { framework: this.languageContext.framework }),
      fileType: this.detectFileType(filePath, content),
      exports: this.extractExports(content),
      imports: this.extractImports(content),
      hasAsync: this.hasAsyncCode(content),
      metadata: {
        relativePath,
        isPython: true,
      },
    };

    return analysis;
  }

  /**
   * Detect the type of Python file
   */
  private detectFileType(filePath: string, content: string): string {
    const fileName = path.basename(filePath);
    const fileNameLower = fileName.toLowerCase();

    // FastAPI detection
    if (
      this.languageContext.framework === 'fastapi' ||
      content.includes('from fastapi') ||
      content.includes('import fastapi')
    ) {
      if (content.includes('@app.') || content.includes('APIRouter')) {
        return 'api';
      }
    }

    // Django detection
    if (
      this.languageContext.framework === 'django' ||
      content.includes('from django') ||
      content.includes('import django')
    ) {
      if (content.includes('class.*View') || content.includes('def.*view')) {
        return 'api';
      }
      if (content.includes('models.Model')) {
        return 'model';
      }
    }

    // Flask detection
    if (content.includes('from flask') || content.includes('import flask')) {
      if (content.includes('@app.route') || content.includes('@bp.route')) {
        return 'api';
      }
    }

    // Service/Model detection
    if (
      fileNameLower.includes('service') ||
      fileNameLower.includes('model') ||
      fileNameLower.includes('repository') ||
      fileNameLower.includes('dao')
    ) {
      return 'service';
    }

    // Utility detection
    if (
      fileNameLower.includes('util') ||
      fileNameLower.includes('helper') ||
      fileNameLower.includes('tool') ||
      fileNameLower.includes('common')
    ) {
      return 'util';
    }

    // Config detection
    if (
      fileNameLower.includes('config') ||
      fileNameLower.includes('setting') ||
      fileNameLower.includes('constant') ||
      fileName === 'settings.py' ||
      fileName === 'config.py'
    ) {
      return 'config';
    }

    // Default to module
    return 'module';
  }

  /**
   * Extract exports from Python content
   */
  private extractExports(content: string): ExportedItem[] {
    const exports: ExportedItem[] = [];

    // Extract function definitions
    const functionRegex = /^(async\s+)?def\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/gm;
    let match;
    while ((match = functionRegex.exec(content)) !== null) {
      const isAsync = !!match[1];
      const name = match[2];
      if (name && !name.startsWith('_')) {
        // Only export public functions
        exports.push({
          name,
          type: 'function',
          isDefault: false,
          isAsync,
        });
      }
    }

    // Extract class definitions
    const classRegex = /^class\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*(?:\([^)]*\))?\s*:/gm;
    while ((match = classRegex.exec(content)) !== null) {
      const name = match[1];
      if (name && !name.startsWith('_')) {
        // Only export public classes
        exports.push({
          name,
          type: 'class',
          isDefault: false,
        });
      }
    }

    // Extract variable assignments (simple case)
    const variableRegex = /^([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*[^=]/gm;
    while ((match = variableRegex.exec(content)) !== null) {
      const name = match[1];
      if (name && !name.startsWith('_') && name.toUpperCase() === name) {
        // Only export constants (ALL_CAPS)
        exports.push({
          name,
          type: 'const',
          isDefault: false,
        });
      }
    }

    return exports;
  }

  /**
   * Extract imports from Python content
   */
  private extractImports(content: string): ImportStatement[] {
    const imports: ImportStatement[] = [];

    // Extract "from ... import ..." statements
    const fromImportRegex = /^from\s+([a-zA-Z0-9_.]+)\s+import\s+(.+)$/gm;
    let match;
    while ((match = fromImportRegex.exec(content)) !== null) {
      const source = match[1];
      const importedItems = match[2]?.split(',').map((item) => item.trim()) || [];

      if (source) {
        imports.push({
          source,
          imports: importedItems,
        });
      }
    }

    // Extract "import ..." statements
    const importRegex = /^import\s+([a-zA-Z0-9_.]+)(?:\s+as\s+([a-zA-Z0-9_]+))?$/gm;
    while ((match = importRegex.exec(content)) !== null) {
      const source = match[1];
      const alias = match[2];

      if (source) {
        imports.push({
          source,
          imports: [],
          ...(alias && { defaultImport: alias }),
        });
      }
    }

    return imports;
  }

  /**
   * Check if content has async code
   */
  private hasAsyncCode(content: string): boolean {
    return content.includes('async def') || content.includes('await ');
  }

  /**
   * Select appropriate test template based on file analysis
   */
  protected selectTestTemplate(analysis: SourceFileAnalysis): string {
    if (analysis.framework === 'fastapi') {
      return 'pytest-fastapi';
    }

    if (analysis.framework === 'django') {
      return 'pytest-django';
    }

    if (analysis.framework === 'flask') {
      return 'pytest-flask';
    }

    return 'pytest';
  }

  /**
   * Generate test content from template and analysis
   */
  protected async generateTestContent(
    _template: string,
    analysis: SourceFileAnalysis
  ): Promise<string> {
    // Calculate import path
    const testPath = this.getTestFilePath(analysis.filePath);
    const importPath = this.calculateImportPath(testPath, analysis.filePath);

    // Generate import statements
    const importStatements = this.generateImportStatements(analysis, importPath);

    // Generate test functions
    const testFunctions = this.generateTestFunctions(analysis);

    // Combine into final test content
    const content = [importStatements, '', testFunctions].join('\n');

    return content;
  }

  /**
   * Calculate Python import path from test file to source file
   */
  private calculateImportPath(fromPath: string, toPath: string): string {
    const fromDir = path.dirname(fromPath);
    let relativePath = path.relative(fromDir, toPath);

    // Remove .py extension
    relativePath = relativePath.replace(/\.py$/, '');

    // Convert path separators to dots for Python imports
    relativePath = relativePath.replace(/[/\\]/g, '.');

    // Handle relative imports
    if (relativePath.startsWith('..')) {
      return relativePath;
    } else if (relativePath.startsWith('.')) {
      return relativePath;
    } else {
      return `.${relativePath}`;
    }
  }

  /**
   * Generate import statements for the test file
   */
  private generateImportStatements(analysis: SourceFileAnalysis, importPath: string): string {
    const imports: string[] = [];

    // Import pytest
    imports.push('import pytest');

    // Import asyncio if needed
    if (analysis.hasAsync) {
      imports.push('import asyncio');
    }

    // Import framework-specific testing utilities
    if (analysis.framework === 'fastapi') {
      imports.push('from fastapi.testclient import TestClient');
    } else if (analysis.framework === 'django') {
      imports.push('from django.test import TestCase');
    }

    // Import items from source file
    const exportNames = analysis.exports.map((exp) => exp.name);
    if (exportNames.length > 0) {
      imports.push(`from ${importPath} import ${exportNames.join(', ')}`);
    }

    return imports.join('\n');
  }

  /**
   * Generate test functions for the analyzed file
   */
  private generateTestFunctions(analysis: SourceFileAnalysis): string {
    const functions: string[] = [];

    // Generate tests for each export
    for (const exportItem of analysis.exports) {
      functions.push(this.generateTestsForExport(exportItem, analysis));
    }

    return functions.join('\n\n');
  }

  /**
   * Generate tests for a specific export
   */
  private generateTestsForExport(exportItem: ExportedItem, analysis: SourceFileAnalysis): string {
    const tests: string[] = [];

    switch (exportItem.type) {
      case 'function':
        tests.push(this.generateFunctionTests(exportItem, analysis));
        break;
      case 'class':
        tests.push(this.generateClassTests(exportItem, analysis));
        break;
      case 'const':
        tests.push(this.generateConstantTests(exportItem));
        break;
      default:
        tests.push(`def test_${exportItem.name}_exists():`);
        tests.push(`    assert ${exportItem.name} is not None`);
    }

    return tests.join('\n');
  }

  /**
   * Generate tests for a function export
   */
  private generateFunctionTests(exportItem: ExportedItem, _analysis: SourceFileAnalysis): string {
    const tests: string[] = [];

    if (exportItem.isAsync) {
      tests.push(`@pytest.mark.asyncio`);
      tests.push(`async def test_${exportItem.name}_async():`);
      tests.push(`    # TODO: Add async test implementation`);
      tests.push(`    result = await ${exportItem.name}()`);
      tests.push(`    assert result is not None`);
    } else {
      tests.push(`def test_${exportItem.name}():`);
      tests.push(`    # TODO: Add test implementation`);
      tests.push(`    result = ${exportItem.name}()`);
      tests.push(`    assert result is not None`);
    }

    // Add error handling test
    tests.push('');
    tests.push(`def test_${exportItem.name}_error_handling():`);
    tests.push(`    # TODO: Add error handling test`);
    tests.push(`    with pytest.raises(Exception):`);
    tests.push(`        ${exportItem.name}(invalid_param=True)`);

    return tests.join('\n');
  }

  /**
   * Generate tests for a class export
   */
  private generateClassTests(exportItem: ExportedItem, _analysis: SourceFileAnalysis): string {
    const tests: string[] = [];

    tests.push(`def test_${exportItem.name}_instantiation():`);
    tests.push(`    instance = ${exportItem.name}()`);
    tests.push(`    assert instance is not None`);
    tests.push('');

    tests.push(`def test_${exportItem.name}_methods():`);
    tests.push(`    instance = ${exportItem.name}()`);
    tests.push(`    # TODO: Add method tests`);
    tests.push(`    assert hasattr(instance, '__dict__')`);

    return tests.join('\n');
  }

  /**
   * Generate tests for a constant export
   */
  private generateConstantTests(exportItem: ExportedItem): string {
    const tests: string[] = [];

    tests.push(`def test_${exportItem.name}_value():`);
    tests.push(`    assert ${exportItem.name} is not None`);
    tests.push(`    # TODO: Add specific value tests`);

    return tests.join('\n');
  }
}
