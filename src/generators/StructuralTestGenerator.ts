import { fs, path, fg } from '../utils/common-imports';
import type { TestGeneratorConfig, GeneratedTest, GeneratedFile } from './TestGenerator';
import { TestGenerator, TestType } from './TestGenerator';
import type { ProjectAnalysis } from '../analyzers/ProjectAnalyzer';
import { logger } from '../utils/common-imports';
import type { TemplateContext } from './templates/TestTemplateEngine';
import { TestTemplateEngine } from './templates/TestTemplateEngine';
import { MCPProtocolComplianceTemplate } from './templates/MCPProtocolComplianceTemplate';
import { MCPToolIntegrationTemplate } from './templates/MCPToolIntegrationTemplate';
import { MCPMessageHandlingTemplate } from './templates/MCPMessageHandlingTemplate';
import { MCPTransportTemplate } from './templates/MCPTransportTemplate';
import { MCPChaosTemplate } from './templates/MCPChaosTemplate';
import { isMCPProjectAnalysis } from '../types/mcp-types';
import type { FileDiscoveryService } from '../types/file-discovery-types';
import { FileDiscoveryType } from '../types/file-discovery-types';

export interface StructuralTestGeneratorOptions {
  /** Patterns for files to include in test generation */
  includePatterns?: string[];
  /** Patterns for files to exclude from test generation */
  excludePatterns?: string[];
  /** Generate mocks for dependencies */
  generateMocks?: boolean;
  /** Generate test setup files */
  generateSetup?: boolean;
  /** Include example test data */
  includeTestData?: boolean;
  /** Skip files that already have tests */
  skipExistingTests?: boolean;
  /** Skip validation checks (e.g., test-to-source ratio) */
  skipValidation?: boolean;
  /** Override maximum test-to-source file ratio */
  maxRatio?: number;
  /** Dry run mode - don't create any files */
  dryRun?: boolean;
}

/**
 * Structural test generator that creates basic test scaffolding
 *
 * This generator analyzes the project structure and creates appropriate
 * test files with basic structure based on the detected languages,
 * frameworks, and patterns.
 */
export class StructuralTestGenerator extends TestGenerator {
  private options: StructuralTestGeneratorOptions;

  constructor(
    config: TestGeneratorConfig,
    analysis: ProjectAnalysis,
    options: StructuralTestGeneratorOptions = {},
    private fileDiscovery?: FileDiscoveryService
  ) {
    super(config, analysis);

    // Use configuration patterns if available, otherwise use defaults
    const defaultIncludePatterns = ['**/*.{js,ts,jsx,tsx,py}'];
    const defaultExcludePatterns = [
      '**/*.test.*',
      '**/*.spec.*',
      '**/*.d.ts', // Exclude TypeScript declaration files
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/__pycache__/**',
      '**/coverage/**',
      '**/tests/**',
      '**/__tests__/**',
    ];

    this.options = {
      includePatterns:
        config.patterns?.include || options.includePatterns || defaultIncludePatterns,
      excludePatterns:
        config.patterns?.exclude || options.excludePatterns || defaultExcludePatterns,
      generateMocks: true,
      generateSetup: true,
      includeTestData: false,
      skipExistingTests: true,
      skipValidation: false,
      ...options,
    };
  }

  protected async getFilesToTest(): Promise<string[]> {
    // Use FileDiscoveryService if available, otherwise fall back to direct implementation
    if (this.fileDiscovery) {
      return this.getFilesToTestViaService();
    } else {
      return this.getFilesToTestDirect();
    }
  }

  private async getFilesToTestViaService(): Promise<string[]> {
    logger.info('Scanning for files to test via FileDiscoveryService');

    const result = await this.fileDiscovery!.findFiles({
      baseDir: this.config.projectPath,
      type: FileDiscoveryType.TEST_GENERATION,
      languages: this.getDetectedLanguages(),
      absolute: true,
      useCache: true,
    });

    logger.debug(`FileDiscoveryService found ${result.files.length} files`, {
      fromCache: result.fromCache,
      duration: result.duration,
      stats: result.stats,
    });

    // Apply existing test filtering if configured
    if (this.options.skipExistingTests) {
      const filesWithoutTests: string[] = [];

      for (const file of result.files) {
        const hasExistingTest = await this.hasExistingTest(file);
        if (!hasExistingTest) {
          filesWithoutTests.push(file);
        }
      }

      return filesWithoutTests;
    }

    return result.files;
  }

  private async getFilesToTestDirect(): Promise<string[]> {
    logger.info('Scanning for files to test via direct implementation', {
      includePatterns: this.options.includePatterns,
      excludePatterns: this.options.excludePatterns,
    });

    // Validate patterns
    this.validatePatterns();

    // Use relative patterns (no path.join) - fast-glob handles cwd option better
    const allFiles = await fg(this.options.includePatterns!, {
      ignore: this.options.excludePatterns || [],
      cwd: this.config.projectPath,
      absolute: true,
      onlyFiles: true,
      dot: false, // Don't include hidden files by default
    });

    logger.debug(`Found ${allFiles.length} files before language filtering`, {
      sampleFiles: allFiles.slice(0, 5),
    });

    // Filter files based on detected languages
    const languageExtensions = this.getLanguageExtensions();
    const filteredFiles = allFiles.filter((file) => {
      const ext = path.extname(file);
      return languageExtensions.includes(ext);
    });

    // Skip existing tests if configured
    if (this.options.skipExistingTests) {
      const filesWithoutTests: string[] = [];

      for (const file of filteredFiles) {
        const hasExistingTest = await this.hasExistingTest(file);
        if (!hasExistingTest) {
          filesWithoutTests.push(file);
        }
      }

      return filesWithoutTests;
    }

    return filteredFiles;
  }

  private getDetectedLanguages(): string[] {
    return this.analysis.languages.map((lang) => lang.name);
  }

  protected async generateStructuralTestForFile(filePath: string): Promise<GeneratedTest | null> {
    logger.debug(`Generating test for: ${filePath}`);

    try {
      // Analyze the file to determine test type and content
      const fileAnalysis = await this.analyzeSourceFileForTesting(filePath);
      if (!fileAnalysis) {
        logger.warn(`Could not analyze file: ${filePath}`);
        return null;
      }

      // Generate test content based on file type and framework
      const testContent = await this.generateTestFileContent(filePath, fileAnalysis);
      const testPath = this.getTestFilePath(filePath, fileAnalysis.testType, fileAnalysis.language);

      // Generate additional files if needed
      const additionalFiles: GeneratedFile[] = [];

      if (this.options.generateMocks && fileAnalysis.dependencies.length > 0) {
        const mockFile = await this.generateMockFileForDependencies(
          filePath,
          fileAnalysis.dependencies
        );
        if (mockFile) {
          additionalFiles.push(mockFile);
        }
      }

      return {
        sourcePath: filePath,
        testPath,
        testType: fileAnalysis.testType,
        framework: this.getFramework(),
        content: testContent,
        ...(additionalFiles.length > 0 && { additionalFiles }),
      };
    } catch (error) {
      logger.error(`Failed to generate test for ${filePath}`, { error });
      throw error;
    }
  }

  protected getTestFileExtension(language?: string): string {
    const lang = language || this.getPrimaryLanguage();
    switch (lang) {
      case 'typescript':
        return '.test.ts';
      case 'javascript':
        return '.test.js';
      case 'python':
        return '_test.py';
      default:
        return '.test.js';
    }
  }

  protected async postGenerate(results: GeneratedTest[]): Promise<void> {
    // Generate setup files if configured
    if (this.options.generateSetup && results.length > 0) {
      await this.generateTestSetupFiles(results);
    }

    // Generate MCP-specific tests if this is an MCP server project
    if (this.analysis.projectType === 'mcp-server' && this.analysis.mcpCapabilities) {
      await this.generateMCPTests(results);
    }
  }

  private async analyzeSourceFileForTesting(filePath: string): Promise<FileAnalysis | null> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const ext = path.extname(filePath);
      const language = this.getLanguageFromExtension(ext);

      if (!language) {
        return null;
      }

      // Basic analysis based on content patterns
      const analysis: FileAnalysis = {
        language,
        testType: this.determineTestType(filePath, content),
        exports: this.extractExports(content, language),
        dependencies: this.extractDependencies(content, language),
        hasDefaultExport: this.hasDefaultExport(content, language),
        isComponent: this.isComponent(filePath, content),
        isUtility: this.isUtility(filePath, content),
        isService: this.isService(filePath, content),
        hasAsyncCode: this.hasAsyncCode(content),
      };

      return analysis;
    } catch (error) {
      logger.error(`Failed to analyze file: ${filePath}`, { error });
      return null;
    }
  }

  private async generateTestFileContent(filePath: string, analysis: FileAnalysis): Promise<string> {
    const templateEngine = new TestTemplateEngine();
    const fileName = path.basename(filePath, path.extname(filePath));

    const context: TemplateContext = {
      moduleName: fileName,
      imports: analysis.dependencies,
      exports: analysis.exports,
      hasDefaultExport: analysis.hasDefaultExport,
      testType: analysis.testType,
      framework: this.getPrimaryFramework() || 'jest',
      language: analysis.language as 'javascript' | 'typescript' | 'python',
      isAsync: analysis.hasAsyncCode,
      isComponent: analysis.isComponent,
      dependencies: analysis.dependencies,
    };

    // Add modulePath for JavaScript/TypeScript/Python files
    if (analysis.language === 'python') {
      context.modulePath = this.getPythonModulePath(filePath);
    } else if (analysis.language === 'javascript' || analysis.language === 'typescript') {
      context.modulePath = this.getJavaScriptModulePath(filePath, analysis.testType);
    }

    // Add module system information for JavaScript/TypeScript files
    if (analysis.language === 'javascript' || analysis.language === 'typescript') {
      context.moduleSystem = this.analysis.moduleSystem.type;
    }

    return templateEngine.generateTest(context);
  }

  private getPythonModulePath(filePath: string): string {
    // Get relative path from project root to source file
    const relativePath = path.relative(this.config.projectPath, filePath);

    // Remove .py extension and convert path separators to dots
    const modulePath = relativePath.replace(/\.py$/, '').split(path.sep).join('.');

    return modulePath;
  }

  private getJavaScriptModulePath(filePath: string, testType?: TestType): string {
    // Calculate the relative path from the test file location to the source file
    const testPath = this.getTestFilePath(filePath, testType);
    const relativePath = path.relative(path.dirname(testPath), filePath);

    // Convert to forward slashes for import statements
    const normalizedPath = relativePath.split(path.sep).join('/');

    // Ensure the path starts with ./ or ../
    if (!normalizedPath.startsWith('./') && !normalizedPath.startsWith('../')) {
      return './' + normalizedPath;
    }

    return normalizedPath;
  }

  private async generateMockFileForDependencies(
    filePath: string,
    dependencies: string[]
  ): Promise<GeneratedFile | null> {
    if (dependencies.length === 0) {
      return null;
    }

    const mockPath = this.getMockFilePath(filePath);
    const mockContent = this.generateMockFileContent(dependencies);

    return {
      path: mockPath,
      content: mockContent,
      type: 'mock',
    };
  }

  private async generateTestSetupFiles(results: GeneratedTest[]): Promise<void> {
    const setupContent = this.generateTestSetupContent(results);
    const setupPath = path.join(this.config.outputPath, this.getSetupFileName());

    if (this.options.dryRun) {
      logger.info(`Dry run: would generate setup file: ${setupPath}`);
      return;
    }

    try {
      await fs.mkdir(path.dirname(setupPath), { recursive: true });
      await fs.writeFile(setupPath, setupContent);
      logger.info(`Generated setup file: ${setupPath}`);
    } catch (error) {
      logger.error(`Failed to create setup file: ${setupPath}`, { error });
    }
  }

  private async hasExistingTest(filePath: string): Promise<boolean> {
    const testPath = this.getTestFilePath(filePath);
    try {
      await fs.access(testPath);
      return true;
    } catch {
      return false;
    }
  }

  private getLanguageExtensions(): string[] {
    const extensions: string[] = [];

    for (const lang of this.analysis.languages) {
      switch (lang.name) {
        case 'javascript':
          extensions.push('.js', '.jsx');
          break;
        case 'typescript':
          extensions.push('.ts', '.tsx');
          break;
        case 'python':
          extensions.push('.py');
          break;
      }
    }

    return extensions;
  }

  private getLanguageFromExtension(ext: string): string | null {
    const extMap: Record<string, string> = {
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.py': 'python',
    };

    return extMap[ext] || null;
  }

  private getPrimaryLanguage(): string {
    if (this.analysis.languages.length === 0) {
      return 'javascript';
    }

    // Return the language with highest confidence
    return this.analysis.languages.reduce((prev, current) =>
      current.confidence > prev.confidence ? current : prev
    ).name;
  }

  private getPrimaryFramework(): string | null {
    if (this.analysis.frameworks.length === 0) {
      return null;
    }

    // Return the framework with highest confidence
    return this.analysis.frameworks.reduce((prev, current) =>
      current.confidence > prev.confidence ? current : prev
    ).name;
  }

  private determineTestType(filePath: string, content: string): TestType {
    const fileName = path.basename(filePath).toLowerCase();

    // Component detection
    if (this.isComponent(filePath, content)) {
      return TestType.COMPONENT;
    }

    // Service detection
    if (this.isService(filePath, content)) {
      return TestType.SERVICE;
    }

    // Utility detection
    if (this.isUtility(filePath, content)) {
      return TestType.UTILITY;
    }

    // Hook detection (React)
    if (fileName.includes('hook') || (content.includes('use') && content.includes('useState'))) {
      return TestType.HOOK;
    }

    // API detection
    if (
      fileName.includes('api') ||
      fileName.includes('route') ||
      content.includes('router') ||
      content.includes('app.')
    ) {
      return TestType.API;
    }

    // Default to unit test
    return TestType.UNIT;
  }

  private extractExports(content: string, language: string): string[] {
    const exports: string[] = [];

    if (language === 'python') {
      // Python exports (functions and classes at module level)
      // Use more precise regex that doesn't match across lines
      const functionRegex = /^(?:async\s+)?def\s+(\w+)\s*\(/gm;
      const classRegex = /^class\s+(\w+)\s*[:\(]/gm;

      let match;
      while ((match = functionRegex.exec(content)) !== null) {
        if (match[1]?.trim() && !match[1].startsWith('_')) {
          exports.push(match[1].trim());
        }
      }

      while ((match = classRegex.exec(content)) !== null) {
        if (match[1]?.trim() && !match[1].startsWith('_')) {
          exports.push(match[1].trim());
        }
      }

      // Also look for module-level variables that might be exports
      const variableRegex = /^(\w+)\s*=\s*[^=]/gm;
      while ((match = variableRegex.exec(content)) !== null) {
        if (
          match[1]?.trim() &&
          !match[1].startsWith('_') &&
          match[1] !== 'if' &&
          match[1] !== 'for' &&
          match[1] !== 'while' &&
          match[1] !== 'import' &&
          match[1] !== 'from'
        ) {
          exports.push(match[1].trim());
        }
      }
    } else {
      // JavaScript/TypeScript exports
      const namedExports = content.match(/export\s+(?:const|let|var|function|class)\s+(\w+)/g);
      const exportList = content.match(/export\s*\{\s*([^}]+)\s*\}/g);

      if (namedExports) {
        namedExports.forEach((match) => {
          const parts = match.split(/\s+/);
          const exportName = parts[parts.length - 1];
          if (exportName?.trim()) {
            exports.push(exportName.trim());
          }
        });
      }
      if (exportList) {
        exportList.forEach((match) => {
          const namesSection = match.replace(/export\s*\{\s*|\s*\}/g, '');
          const names = namesSection
            .split(',')
            .map((s) => s.trim())
            .filter((s) => s && !s.includes('as')); // Skip renamed exports for now
          exports.push(...names);
        });
      }

      // Also look for default exports
      const defaultExportMatch = content.match(
        /export\s+default\s+(?:class\s+(\w+)|function\s+(\w+)|(\w+))/
      );
      if (defaultExportMatch) {
        const exportName = defaultExportMatch[1] || defaultExportMatch[2] || defaultExportMatch[3];
        if (exportName?.trim()) {
          exports.push(exportName.trim());
        }
      }
    }

    // Remove duplicates and empty strings
    return [...new Set(exports.filter((exp) => exp && exp.trim()))];
  }

  private extractDependencies(content: string, language: string): string[] {
    const dependencies: string[] = [];

    if (language === 'python') {
      const imports = content.match(/^(?:from\s+(\w+)|import\s+(\w+))/gm);
      if (imports) {
        imports.forEach((imp) => {
          const cleaned = imp.replace(/^(?:from\s+|import\s+)/, '');
          const moduleName = cleaned.split('.')[0];
          if (moduleName) {
            dependencies.push(moduleName);
          }
        });
      }
    } else {
      // Match both named imports and side-effect imports
      const namedImports = content.match(/import.*?from\s+['"`]([^'"`]+)['"`]/g) || [];
      const sideEffectImports = content.match(/import\s+['"`]([^'"`]+)['"`]/g) || [];

      [...namedImports, ...sideEffectImports].forEach((imp) => {
        const match = imp.match(/['"`]([^'"`]+)['"`]/);
        if (match?.[1]) {
          dependencies.push(match[1]);
        }
      });
    }

    return [...new Set(dependencies)]; // Remove duplicates
  }

  private hasDefaultExport(content: string, language: string): boolean {
    if (language === 'python') {
      return false; // Python doesn't have default exports
    }
    return content.includes('export default');
  }

  private isComponent(filePath: string, content: string): boolean {
    const fileName = path.basename(filePath);
    const isReactFile =
      fileName.match(/\.(jsx|tsx)$/) ||
      content.includes('React') ||
      content.includes('jsx') ||
      (content.includes('return (') && content.includes('<'));

    return (
      isReactFile &&
      (fileName.charAt(0) === fileName.charAt(0).toUpperCase() || // PascalCase filename
        (content.includes('function') && content.includes('return') && content.includes('<')))
    );
  }

  private isUtility(filePath: string, content: string): boolean {
    const fileName = path.basename(filePath).toLowerCase();
    return (
      fileName.includes('util') ||
      fileName.includes('helper') ||
      fileName.includes('tool') ||
      (content.includes('export function') && !content.includes('React'))
    );
  }

  private isService(filePath: string, content: string): boolean {
    const fileName = path.basename(filePath).toLowerCase();
    return (
      fileName.includes('service') ||
      fileName.includes('api') ||
      fileName.includes('client') ||
      content.includes('fetch(') ||
      content.includes('axios') ||
      content.includes('http')
    );
  }

  private hasAsyncCode(content: string): boolean {
    return content.includes('async') || content.includes('await') || content.includes('Promise');
  }

  private getMockFilePath(filePath: string): string {
    const conventions = this.getNamingConventions();
    const ext = this.getTestFileExtension().replace('.test', conventions.mockFileSuffix);
    const relativePath = path.relative(this.config.projectPath, filePath);
    const pathWithoutExt = relativePath.replace(/\.[^/.]+$/, '');

    return path.join(this.config.outputPath, '__mocks__', `${pathWithoutExt}${ext}`);
  }

  private generateMockFileContent(dependencies: string[]): string {
    const language = this.getPrimaryLanguage();

    if (language === 'python') {
      return dependencies
        .map((dep) => `from unittest.mock import MagicMock\n\n${dep} = MagicMock()`)
        .join('\n\n');
    } else {
      return dependencies.map((dep) => `export const ${dep} = jest.fn();`).join('\n');
    }
  }

  private generateTestSetupContent(_results: GeneratedTest[]): string {
    const language = this.getPrimaryLanguage();

    if (language === 'python') {
      return this.generatePythonTestSetup();
    } else {
      return this.generateJavaScriptTestSetup();
    }
  }

  private generatePythonTestSetup(): string {
    return `"""Test setup and configuration"""
import pytest
import sys
import os

# Add src to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

@pytest.fixture(scope="session")
def setup_test_environment():
    """Set up test environment"""
    # Add any global test setup here
    yield
    # Add any cleanup here

# Global test configuration
pytest_plugins = []
`;
  }

  private generateJavaScriptTestSetup(): string {
    const framework = this.getFramework();
    const hasReact = this.analysis.frameworks.some((f) => f.name === 'react');

    const imports = this.generateJavaScriptSetupImports(framework, hasReact);
    const globalSetup = this.generateJavaScriptGlobalSetup(framework);
    const mockConsole = this.generateJavaScriptConsoleMocks();
    const reactConfig = this.generateReactConfig(hasReact);

    return `/**
 * Test setup and configuration
 * Generated by Claude Testing Infrastructure
 */

${imports}

// Global test setup
${globalSetup}

${mockConsole}

${reactConfig}`;
  }

  private generateJavaScriptSetupImports(_framework: string, _hasReact: boolean): string {
    const imports: string[] = [];

    // Only add imports that are commonly available without additional dependencies
    // Skip testing library imports to avoid dependency issues

    // No imports needed for basic test setup

    return imports.join('\n');
  }

  private generateJavaScriptGlobalSetup(framework: string): string {
    if (framework !== 'jest') return '';

    return `
beforeAll(() => {
  // Global setup before all tests
});

afterAll(() => {
  // Global cleanup after all tests
});

beforeEach(() => {
  // Setup before each test
});

afterEach(() => {
  // Cleanup after each test
});
`;
  }

  private generateJavaScriptConsoleMocks(): string {
    return `// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  warn: jest.fn(),
  error: jest.fn(),
};`;
  }

  private generateReactConfig(hasReact: boolean): string {
    if (!hasReact) return '';

    return `// React testing configuration
// Import jest-dom for additional matchers
// Note: This assumes @testing-library/jest-dom is installed
try {
  require('@testing-library/jest-dom');
} catch (e) {
  // @testing-library/jest-dom not available - using basic matchers
}

// Mock window.matchMedia for responsive components
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});
`;
  }

  private getSetupFileName(): string {
    const language = this.getPrimaryLanguage();
    return language === 'python' ? 'conftest.py' : 'setupTests.js';
  }

  /**
   * Validate include and exclude patterns
   */
  private validatePatterns(): void {
    // Check for valid pattern formats
    const invalidIncludePatterns =
      this.options.includePatterns?.filter(
        (pattern) => !pattern || typeof pattern !== 'string' || pattern.trim() === ''
      ) || [];

    const invalidExcludePatterns =
      this.options.excludePatterns?.filter(
        (pattern) => !pattern || typeof pattern !== 'string' || pattern.trim() === ''
      ) || [];

    if (invalidIncludePatterns.length > 0) {
      logger.warn('Invalid include patterns found', { patterns: invalidIncludePatterns });
    }

    if (invalidExcludePatterns.length > 0) {
      logger.warn('Invalid exclude patterns found', { patterns: invalidExcludePatterns });
    }

    // Log pattern validation for debugging
    logger.debug('Pattern validation completed', {
      includeCount: this.options.includePatterns?.length || 0,
      excludeCount: this.options.excludePatterns?.length || 0,
      hasNodeModulesExclude:
        this.options.excludePatterns?.some((p) => p.includes('node_modules')) || false,
    });
  }

  private async generateMCPTests(existingResults: GeneratedTest[]): Promise<void> {
    if (!isMCPProjectAnalysis(this.analysis)) {
      return;
    }

    logger.info('Generating MCP-specific tests');
    const mcpAnalysis = this.analysis;
    const mcpTests: GeneratedTest[] = [];

    try {
      // Generate protocol compliance tests
      const protocolTemplate = new MCPProtocolComplianceTemplate();
      const protocolTest = protocolTemplate.generateComplianceTests(mcpAnalysis);
      mcpTests.push({
        sourcePath: 'mcp-server',
        testPath: protocolTest.path,
        testType: TestType.INTEGRATION,
        framework: this.getFramework(),
        content: protocolTest.content,
      });

      // Generate tool integration tests if tools are present
      if (mcpAnalysis.mcpCapabilities.tools.length > 0) {
        const toolTemplate = new MCPToolIntegrationTemplate();
        const toolTest = toolTemplate.generateToolTests(
          mcpAnalysis.mcpCapabilities.tools,
          mcpAnalysis
        );
        mcpTests.push({
          sourcePath: 'mcp-server',
          testPath: toolTest.path,
          testType: TestType.INTEGRATION,
          framework: this.getFramework(),
          content: toolTest.content,
        });
      }

      // Generate message handling tests
      const messageTemplate = new MCPMessageHandlingTemplate();
      const messageTest = messageTemplate.generateMessageTests(mcpAnalysis);
      mcpTests.push({
        sourcePath: 'mcp-server',
        testPath: messageTest.path,
        testType: TestType.INTEGRATION,
        framework: this.getFramework(),
        content: messageTest.content,
      });

      // Generate transport-specific tests
      const transportTemplate = new MCPTransportTemplate();
      for (const transport of mcpAnalysis.mcpCapabilities.transports) {
        const transportTest = transportTemplate.generateTransportTests(transport, mcpAnalysis);
        mcpTests.push({
          sourcePath: 'mcp-server',
          testPath: transportTest.path,
          testType: TestType.INTEGRATION,
          framework: this.getFramework(),
          content: transportTest.content,
        });
      }

      // Generate chaos tests
      const chaosTemplate = new MCPChaosTemplate();
      const chaosTest = chaosTemplate.generateChaosTests(mcpAnalysis);
      mcpTests.push({
        sourcePath: 'mcp-server',
        testPath: chaosTest.path,
        testType: TestType.INTEGRATION,
        framework: this.getFramework(),
        content: chaosTest.content,
      });

      // Write MCP tests if not in dry-run mode
      if (!this.options.dryRun) {
        for (const test of mcpTests) {
          const fullPath = path.join(this.config.projectPath, test.testPath);
          await fs.mkdir(path.dirname(fullPath), { recursive: true });
          await fs.writeFile(fullPath, test.content, 'utf-8');
          logger.info(`Generated MCP test: ${test.testPath}`);
        }
      }

      // Update results count
      existingResults.push(...mcpTests);
    } catch (error) {
      logger.error('Failed to generate MCP tests', { error });
      throw error;
    }
  }
}

interface FileAnalysis {
  language: string;
  testType: TestType;
  exports: string[];
  dependencies: string[];
  hasDefaultExport: boolean;
  isComponent: boolean;
  isUtility: boolean;
  isService: boolean;
  hasAsyncCode: boolean;
}
