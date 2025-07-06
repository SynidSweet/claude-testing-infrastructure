import { fs, path, fg, logger } from '../utils/common-imports';
import type { FileDiscoveryService } from '../types/file-discovery-types';
import { FileDiscoveryType } from '../types/file-discovery-types';

export interface ProjectAnalysis {
  projectPath: string;
  languages: DetectedLanguage[];
  frameworks: DetectedFramework[];
  packageManagers: DetectedPackageManager[];
  projectStructure: ProjectStructure;
  dependencies: Dependencies;
  testingSetup: TestingSetup;
  complexity: ComplexityMetrics;
  moduleSystem: ModuleSystemInfo;
  projectType?: 'standard' | 'mcp-server';
  mcpCapabilities?: MCPCapabilities;
}

export interface ModuleSystemInfo {
  type: 'commonjs' | 'esm' | 'mixed';
  hasPackageJsonType: boolean;
  packageJsonType?: 'module' | 'commonjs';
  confidence: number;
  fileExtensionPattern: 'js' | 'mjs' | 'ts';
}

export interface DetectedLanguage {
  name: 'javascript' | 'typescript' | 'python';
  confidence: number;
  files: string[];
  version?: string;
}

export interface DetectedFramework {
  name:
    | 'react'
    | 'vue'
    | 'angular'
    | 'express'
    | 'fastapi'
    | 'django'
    | 'flask'
    | 'nextjs'
    | 'nuxt'
    | 'svelte'
    | 'mcp-server'
    | 'fastmcp';
  confidence: number;
  version?: string;
  configFiles: string[];
}

export interface DetectedPackageManager {
  name: 'npm' | 'yarn' | 'pnpm' | 'pip' | 'poetry' | 'pipenv';
  confidence: number;
  lockFiles: string[];
}

export interface ProjectStructure {
  rootFiles: string[];
  srcDirectory: string | undefined;
  testDirectories: string[];
  configFiles: string[];
  buildOutputs: string[];
  entryPoints: string[];
}

export interface Dependencies {
  production: Record<string, string>;
  development: Record<string, string>;
  python: Record<string, string> | undefined;
}

export interface TestingSetup {
  hasTests: boolean;
  testFrameworks: string[];
  testFiles: string[];
  coverageTools: string[];
}

export interface ComplexityMetrics {
  totalFiles: number;
  totalLines: number;
  averageFileSize: number;
  largestFiles: Array<{ path: string; lines: number }>;
}

export interface MCPCapabilities {
  tools: MCPTool[];
  resources: MCPResource[];
  prompts: MCPPrompt[];
  transports: ('stdio' | 'http-sse')[];
  framework: 'fastmcp' | 'official-sdk' | 'custom';
}

export interface MCPTool {
  name: string;
  description?: string;
  inputSchema?: unknown;
}

export interface MCPResource {
  name: string;
  uri: string;
  mimeType?: string;
}

export interface MCPPrompt {
  name: string;
  description?: string;
  arguments?: unknown;
}

export class ProjectAnalyzer {
  private projectPath: string;

  constructor(
    projectPath: string,
    private fileDiscovery?: FileDiscoveryService
  ) {
    this.projectPath = path.resolve(projectPath);
  }

  async analyzeProject(): Promise<ProjectAnalysis> {
    logger.info(`Starting analysis of project: ${this.projectPath}`);

    // Validate project path exists
    try {
      await fs.access(this.projectPath);
    } catch (error) {
      throw new Error(`Project path does not exist: ${this.projectPath}`);
    }

    try {
      const [
        languages,
        frameworks,
        packageManagers,
        projectStructure,
        dependencies,
        testingSetup,
        complexity,
        moduleSystem,
      ] = await Promise.all([
        this.detectLanguages(),
        this.detectFrameworks(),
        this.detectPackageManagers(),
        this.analyzeProjectStructure(),
        this.analyzeDependencies(),
        this.analyzeTestingSetup(),
        this.calculateComplexity(),
        this.analyzeModuleSystem(),
      ]);

      // Check if this is an MCP server project
      const isMCPServer = frameworks.some((f) => f.name === 'mcp-server' || f.name === 'fastmcp');

      const analysis: ProjectAnalysis = {
        projectPath: this.projectPath,
        languages,
        frameworks,
        packageManagers,
        projectStructure,
        dependencies,
        testingSetup,
        complexity,
        moduleSystem,
        projectType: isMCPServer ? 'mcp-server' : 'standard',
      };

      // Add MCP capabilities if this is an MCP server
      if (isMCPServer) {
        const mcpCapabilities = await this.analyzeMCPCapabilities();
        analysis.mcpCapabilities = mcpCapabilities;
      }

      logger.info('Project analysis completed successfully');
      return analysis;
    } catch (error) {
      logger.error('Project analysis failed:', error);
      throw new Error(
        `Failed to analyze project: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async detectLanguages(): Promise<DetectedLanguage[]> {
    const languages: DetectedLanguage[] = [];

    // JavaScript detection
    const jsFiles = await this.findFiles(
      ['**/*.js', '**/*.jsx'],
      ['node_modules/**', 'dist/**', 'build/**']
    );
    if (jsFiles.length > 0) {
      languages.push({
        name: 'javascript',
        confidence: Math.min(0.9, jsFiles.length / 10),
        files: jsFiles.slice(0, 10), // Limit for performance
      });
    }

    // TypeScript detection
    const tsFiles = await this.findFiles(
      ['**/*.ts', '**/*.tsx'],
      ['node_modules/**', 'dist/**', 'build/**']
    );
    if (tsFiles.length > 0) {
      languages.push({
        name: 'typescript',
        confidence: Math.min(0.9, tsFiles.length / 10),
        files: tsFiles.slice(0, 10),
      });
    }

    // Python detection
    const pyFiles = await this.findFiles(['**/*.py'], ['__pycache__/**', '.venv/**', 'venv/**']);
    if (pyFiles.length > 0) {
      languages.push({
        name: 'python',
        confidence: Math.min(0.9, pyFiles.length / 10),
        files: pyFiles.slice(0, 10),
      });
    }

    return languages.sort((a, b) => b.confidence - a.confidence);
  }

  private async detectFrameworks(): Promise<DetectedFramework[]> {
    const frameworks: DetectedFramework[] = [];
    const packageJsonContent = await this.readPackageJson();
    const pythonDeps = await this.readPythonDependencies();

    // React detection
    if (await this.hasReact(packageJsonContent)) {
      const configFiles = await this.findFiles([
        '**/package.json',
        '**/.babelrc*',
        '**/webpack.config.*',
      ]);
      frameworks.push({
        name: 'react',
        confidence: 0.9,
        version:
          packageJsonContent?.dependencies?.react || packageJsonContent?.devDependencies?.react,
        configFiles,
      });
    }

    // Vue detection
    if (await this.hasVue(packageJsonContent)) {
      const configFiles = await this.findFiles([
        '**/package.json',
        '**/vue.config.*',
        '**/vite.config.*',
      ]);
      frameworks.push({
        name: 'vue',
        confidence: 0.9,
        version: packageJsonContent?.dependencies?.vue || packageJsonContent?.devDependencies?.vue,
        configFiles,
      });
    }

    // Angular detection
    if (await this.hasAngular(packageJsonContent)) {
      const configFiles = await this.findFiles([
        '**/angular.json',
        '**/package.json',
        '**/tsconfig.json',
      ]);
      frameworks.push({
        name: 'angular',
        confidence: 0.9,
        version: packageJsonContent?.dependencies?.['@angular/core'],
        configFiles,
      });
    }

    // Express detection
    if (await this.hasExpress(packageJsonContent)) {
      const configFiles = await this.findFiles([
        '**/package.json',
        '**/app.js',
        '**/server.js',
        '**/index.js',
      ]);
      frameworks.push({
        name: 'express',
        confidence: 0.8,
        version: packageJsonContent?.dependencies?.express,
        configFiles,
      });
    }

    // Next.js detection
    if (await this.hasNextJs(packageJsonContent)) {
      const configFiles = await this.findFiles(['**/next.config.*', '**/package.json']);
      frameworks.push({
        name: 'nextjs',
        confidence: 0.9,
        version: packageJsonContent?.dependencies?.next,
        configFiles,
      });
    }

    // FastAPI detection
    if (await this.hasFastAPI(pythonDeps)) {
      const configFiles = await this.findFiles([
        '**/main.py',
        '**/app.py',
        '**/requirements.txt',
        '**/pyproject.toml',
      ]);
      frameworks.push({
        name: 'fastapi',
        confidence: 0.9,
        configFiles,
      });
    }

    // Django detection
    if (await this.hasDjango(pythonDeps)) {
      const configFiles = await this.findFiles([
        '**/manage.py',
        '**/settings.py',
        '**/requirements.txt',
        '**/pyproject.toml',
      ]);
      frameworks.push({
        name: 'django',
        confidence: 0.9,
        configFiles,
      });
    }

    // Flask detection
    if (await this.hasFlask(pythonDeps)) {
      const configFiles = await this.findFiles([
        '**/app.py',
        '**/main.py',
        '**/requirements.txt',
        '**/pyproject.toml',
      ]);
      frameworks.push({
        name: 'flask',
        confidence: 0.8,
        configFiles,
      });
    }

    // MCP Server detection
    if (await this.hasMCPServer(packageJsonContent)) {
      const configFiles = await this.findFiles([
        '**/mcp.json',
        '**/.mcp/**',
        '**/package.json',
        '**/server.py',
        '**/server.js',
        '**/server.ts',
      ]);

      const framework = await this.detectMCPFramework(packageJsonContent);
      if (framework === 'fastmcp') {
        frameworks.push({
          name: 'fastmcp',
          confidence: 0.95,
          version:
            packageJsonContent?.dependencies?.fastmcp ||
            packageJsonContent?.devDependencies?.fastmcp,
          configFiles,
        });
      } else {
        frameworks.push({
          name: 'mcp-server',
          confidence: 0.9,
          version:
            packageJsonContent?.dependencies?.['@modelcontextprotocol/sdk'] ||
            packageJsonContent?.devDependencies?.['@modelcontextprotocol/sdk'],
          configFiles,
        });
      }
    }

    return frameworks.sort((a, b) => b.confidence - a.confidence);
  }

  private async detectPackageManagers(): Promise<DetectedPackageManager[]> {
    const packageManagers: DetectedPackageManager[] = [];

    // npm
    const npmLock = await this.findFiles(['**/package-lock.json']);
    if (npmLock.length > 0) {
      packageManagers.push({
        name: 'npm',
        confidence: 0.9,
        lockFiles: npmLock,
      });
    }

    // yarn
    const yarnLock = await this.findFiles(['**/yarn.lock']);
    if (yarnLock.length > 0) {
      packageManagers.push({
        name: 'yarn',
        confidence: 0.9,
        lockFiles: yarnLock,
      });
    }

    // pnpm
    const pnpmLock = await this.findFiles(['**/pnpm-lock.yaml']);
    if (pnpmLock.length > 0) {
      packageManagers.push({
        name: 'pnpm',
        confidence: 0.9,
        lockFiles: pnpmLock,
      });
    }

    // poetry
    const poetryLock = await this.findFiles(['**/poetry.lock']);
    if (poetryLock.length > 0) {
      packageManagers.push({
        name: 'poetry',
        confidence: 0.9,
        lockFiles: poetryLock,
      });
    }

    // pipenv
    const pipfileLock = await this.findFiles(['**/Pipfile.lock']);
    if (pipfileLock.length > 0) {
      packageManagers.push({
        name: 'pipenv',
        confidence: 0.9,
        lockFiles: pipfileLock,
      });
    }

    // pip (fallback)
    const requirements = await this.findFiles(['**/requirements.txt', '**/requirements-*.txt']);
    if (
      requirements.length > 0 &&
      packageManagers.filter((pm) => pm.name.includes('pip') || pm.name === 'poetry').length === 0
    ) {
      packageManagers.push({
        name: 'pip',
        confidence: 0.7,
        lockFiles: requirements,
      });
    }

    return packageManagers.sort((a, b) => b.confidence - a.confidence);
  }

  private async analyzeProjectStructure(): Promise<ProjectStructure> {
    const rootFiles = await this.findFiles(['*'], [], { onlyFiles: true, deep: 1 });

    // Common src directories
    const srcCandidates = ['src', 'lib', 'app', 'source'];
    let srcDirectory: string | undefined;

    for (const candidate of srcCandidates) {
      const candidatePath = path.join(this.projectPath, candidate);
      try {
        const stat = await fs.stat(candidatePath);
        if (stat.isDirectory()) {
          srcDirectory = candidate;
          break;
        }
      } catch {
        // Directory doesn't exist, continue
      }
    }

    const testDirectories = await this.findDirectories(
      ['**/test', '**/tests', '**/__tests__', '**/*.test.*'],
      ['node_modules/**']
    );
    const configFiles = await this.findFiles([
      '**/package.json',
      '**/tsconfig.json',
      '**/babel.config.*',
      '**/webpack.config.*',
      '**/vite.config.*',
      '**/jest.config.*',
      '**/pytest.ini',
      '**/pyproject.toml',
      '**/requirements.txt',
      '**/Pipfile',
      '**/poetry.lock',
    ]);

    const buildOutputs = await this.findDirectories([
      '**/dist',
      '**/build',
      '**/out',
      '**/.next',
      '**/__pycache__',
    ]);

    const entryPoints = await this.findFiles([
      '**/index.{js,ts,jsx,tsx,py}',
      '**/main.{js,ts,jsx,tsx,py}',
      '**/app.{js,ts,jsx,tsx,py}',
      '**/server.{js,ts,py}',
      '**/manage.py',
    ]);

    return {
      rootFiles,
      srcDirectory,
      testDirectories,
      configFiles,
      buildOutputs,
      entryPoints,
    };
  }

  private async analyzeDependencies(): Promise<Dependencies> {
    const packageJsonContent = await this.readPackageJson();
    const pythonDeps = await this.readPythonDependencies();

    return {
      production: packageJsonContent?.dependencies || {},
      development: packageJsonContent?.devDependencies || {},
      python: pythonDeps || undefined,
    };
  }

  private async analyzeTestingSetup(): Promise<TestingSetup> {
    const testFiles = await this.findFiles(
      ['**/*.test.{js,ts,jsx,tsx,py}', '**/*.spec.{js,ts,jsx,tsx,py}', '**/test_*.py'],
      ['node_modules/**']
    );

    const packageJsonContent = await this.readPackageJson();
    const testFrameworks: string[] = [];
    const coverageTools: string[] = [];

    // Detect test frameworks from dependencies
    const allDeps = {
      ...(packageJsonContent?.dependencies || {}),
      ...(packageJsonContent?.devDependencies || {}),
    };

    if (allDeps?.jest) testFrameworks.push('jest');
    if (allDeps?.vitest) testFrameworks.push('vitest');
    if (allDeps?.mocha) testFrameworks.push('mocha');
    if (allDeps?.cypress) testFrameworks.push('cypress');
    if (allDeps?.playwright) testFrameworks.push('playwright');

    // Python test frameworks
    const pythonDeps = await this.readPythonDependencies();
    if (pythonDeps?.pytest) testFrameworks.push('pytest');
    if (pythonDeps?.unittest2) testFrameworks.push('unittest');

    // Coverage tools
    if (allDeps?.['@jest/globals']) coverageTools.push('jest-coverage');
    if (allDeps?.c8) coverageTools.push('c8');
    if (allDeps?.nyc) coverageTools.push('nyc');
    if (pythonDeps?.coverage) coverageTools.push('coverage.py');

    return {
      hasTests: testFiles.length > 0,
      testFrameworks,
      testFiles: testFiles.slice(0, 20), // Limit for performance
      coverageTools,
    };
  }

  private async calculateComplexity(): Promise<ComplexityMetrics> {
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
      } catch (error) {
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

  // Helper methods for framework detection
  private async hasReact(packageJson: any): Promise<boolean> {
    if (!packageJson) return false;
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
    return !!(deps?.react || deps?.['@types/react']);
  }

  private async hasVue(packageJson: any): Promise<boolean> {
    if (!packageJson) return false;
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
    return !!(deps?.vue || deps?.['@vue/cli']);
  }

  private async hasAngular(packageJson: any): Promise<boolean> {
    if (!packageJson) return false;
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
    return !!(deps?.['@angular/core'] || deps?.['@angular/cli']);
  }

  private async hasExpress(packageJson: any): Promise<boolean> {
    if (!packageJson) return false;
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
    return !!deps?.express;
  }

  private async hasNextJs(packageJson: any): Promise<boolean> {
    if (!packageJson) return false;
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
    return !!deps?.next;
  }

  private async hasFastAPI(pythonDeps: any): Promise<boolean> {
    return !!(pythonDeps?.fastapi || pythonDeps?.['fastapi[all]']);
  }

  private async hasDjango(pythonDeps: any): Promise<boolean> {
    return !!(pythonDeps?.django || pythonDeps?.Django);
  }

  private async hasFlask(pythonDeps: any): Promise<boolean> {
    return !!(pythonDeps?.flask || pythonDeps?.Flask);
  }

  private async hasMCPServer(packageJson: any): Promise<boolean> {
    if (!packageJson) return false;
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
    return !!(
      deps?.['@modelcontextprotocol/sdk'] ||
      deps?.['@modelcontextprotocol/server'] ||
      deps?.fastmcp ||
      deps?.['mcp-framework'] ||
      deps?.['@anthropic/mcp']
    );
  }

  private async detectMCPFramework(
    packageJson: any
  ): Promise<'fastmcp' | 'official-sdk' | 'custom'> {
    if (!packageJson) return 'custom';
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

    if (deps?.fastmcp) {
      return 'fastmcp';
    } else if (deps?.['@modelcontextprotocol/sdk']) {
      return 'official-sdk';
    }

    return 'custom';
  }

  private async analyzeMCPCapabilities(): Promise<MCPCapabilities> {
    const packageJson = await this.readPackageJson();
    const framework = await this.detectMCPFramework(packageJson);

    // Basic capability detection - would be enhanced with actual AST parsing
    const capabilities: MCPCapabilities = {
      tools: [],
      resources: [],
      prompts: [],
      transports: ['stdio'], // Default transport
      framework,
    };

    // Check for HTTP+SSE transport indicators
    const hasHttpIndicators =
      packageJson?.dependencies?.express ||
      packageJson?.dependencies?.fastify ||
      packageJson?.dependencies?.['@fastify/sse'] ||
      packageJson?.devDependencies?.express ||
      packageJson?.devDependencies?.fastify;

    if (hasHttpIndicators) {
      capabilities.transports.push('http-sse');
    }

    // Try to detect MCP configuration file
    const mcpConfigFiles = await this.findFiles([
      'mcp.json',
      '.mcp/config.json',
      '**/mcp.json',
      '**/.mcp/config.json',
    ]);
    if (mcpConfigFiles.length > 0 && mcpConfigFiles[0]) {
      try {
        const configPath = path.join(this.projectPath, mcpConfigFiles[0]);
        const configContent = await fs.readFile(configPath, 'utf-8');
        const config = JSON.parse(configContent);

        // Extract capabilities from config if available
        if (config.tools) {
          capabilities.tools = config.tools.map((tool: any) => ({
            name: tool.name || 'unknown',
            description: tool.description,
            inputSchema: tool.inputSchema,
          }));
        }

        if (config.resources) {
          capabilities.resources = config.resources.map((resource: any) => ({
            name: resource.name || 'unknown',
            uri: resource.uri || '',
            mimeType: resource.mimeType,
          }));
        }

        if (config.prompts) {
          capabilities.prompts = config.prompts.map((prompt: any) => ({
            name: prompt.name || 'unknown',
            description: prompt.description,
            arguments: prompt.arguments,
          }));
        }
      } catch (error) {
        logger.debug('Could not parse MCP config file:', error);
      }
    }

    return capabilities;
  }

  // Utility methods
  private async findFiles(
    patterns: string[],
    ignore: string[] = [],
    options: any = {}
  ): Promise<string[]> {
    // Use FileDiscoveryService if available, otherwise fall back to direct implementation
    if (this.fileDiscovery) {
      try {
        const result = await this.fileDiscovery.findFiles({
          baseDir: this.projectPath,
          include: patterns,
          exclude: ignore,
          type: FileDiscoveryType.CUSTOM,
          absolute: options.absolute,
          includeDirectories: options.onlyFiles === false,
          useCache: true,
        });

        return result.files;
      } catch (error) {
        logger.debug(
          'Error using FileDiscoveryService, falling back to direct implementation:',
          error
        );
        // Fall through to direct implementation
      }
    }

    // Direct implementation fallback
    try {
      return await fg(patterns, {
        cwd: this.projectPath,
        ignore,
        onlyFiles: options.onlyFiles !== false,
        deep: options.deep,
        dot: false,
      });
    } catch (error) {
      logger.debug('Error finding files:', error);
      return [];
    }
  }

  private async findDirectories(patterns: string[], ignore: string[] = []): Promise<string[]> {
    try {
      return await fg(patterns, {
        cwd: this.projectPath,
        ignore,
        onlyDirectories: true,
        dot: false,
      });
    } catch (error) {
      logger.debug('Error finding directories:', error);
      return [];
    }
  }

  private async readPackageJson(): Promise<any> {
    try {
      const packageJsonPath = path.join(this.projectPath, 'package.json');
      const content = await fs.readFile(packageJsonPath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      logger.debug('No package.json found or invalid JSON');
      return null;
    }
  }

  private async readPythonDependencies(): Promise<Record<string, string> | null> {
    // Try pyproject.toml first
    try {
      const pyprojectPath = path.join(this.projectPath, 'pyproject.toml');
      const content = await fs.readFile(pyprojectPath, 'utf-8');
      // Simple TOML parsing for dependencies - in production, use a proper TOML parser
      const deps: Record<string, string> = {};
      const lines = content.split('\n');
      let inDependencies = false;

      for (const line of lines) {
        if (
          line.includes('[tool.poetry.dependencies]') ||
          line.includes('[project.dependencies]')
        ) {
          inDependencies = true;
          continue;
        }
        if (inDependencies && line.startsWith('[')) {
          inDependencies = false;
        }
        if (inDependencies && line.includes('=')) {
          const [key, value] = line.split('=').map((s) => s.trim());
          if (key && value) {
            deps[key] = value.replace(/['"]/g, '');
          }
        }
      }

      if (Object.keys(deps).length > 0) return deps;
    } catch (error) {
      logger.debug('No pyproject.toml found');
    }

    // Try requirements.txt
    try {
      const requirementsPath = path.join(this.projectPath, 'requirements.txt');
      const content = await fs.readFile(requirementsPath, 'utf-8');
      const deps: Record<string, string> = {};

      content.split('\n').forEach((line) => {
        line = line.trim();
        if (line && !line.startsWith('#')) {
          const match = line.match(/^([a-zA-Z0-9_-]+)([>=<~!]+.*)?$/);
          if (match?.[1]) {
            deps[match[1]] = match[2] || '*';
          }
        }
      });

      return Object.keys(deps).length > 0 ? deps : null;
    } catch (error) {
      logger.debug('No requirements.txt found');
    }

    return null;
  }

  private async analyzeModuleSystem(): Promise<ModuleSystemInfo> {
    try {
      const packageJsonContent = await this.readPackageJson();

      if (!packageJsonContent) {
        // No package.json found, assume CommonJS for JavaScript projects
        return {
          type: 'commonjs',
          hasPackageJsonType: false,
          confidence: 0.7,
          fileExtensionPattern: await this.detectFileExtensionPattern(),
        };
      }

      const packageJsonType = packageJsonContent.type;

      if (packageJsonType === 'module') {
        return {
          type: 'esm',
          hasPackageJsonType: true,
          packageJsonType: 'module',
          confidence: 1.0,
          fileExtensionPattern: await this.detectFileExtensionPattern(),
        };
      } else if (packageJsonType === 'commonjs') {
        return {
          type: 'commonjs',
          hasPackageJsonType: true,
          packageJsonType: 'commonjs',
          confidence: 1.0,
          fileExtensionPattern: await this.detectFileExtensionPattern(),
        };
      } else {
        // No explicit type field - analyze imports/exports in source files
        const moduleTypeFromFiles = await this.detectModuleTypeFromFiles();

        return {
          type: moduleTypeFromFiles.type,
          hasPackageJsonType: false,
          confidence: moduleTypeFromFiles.confidence,
          fileExtensionPattern: await this.detectFileExtensionPattern(),
        };
      }
    } catch (error) {
      logger.debug('Error analyzing module system:', error);
      return {
        type: 'commonjs',
        hasPackageJsonType: false,
        confidence: 0.5,
        fileExtensionPattern: await this.detectFileExtensionPattern(),
      };
    }
  }

  private async detectModuleTypeFromFiles(): Promise<{
    type: 'commonjs' | 'esm' | 'mixed';
    confidence: number;
  }> {
    try {
      // Find JavaScript/TypeScript files to analyze
      const sourceFiles = await this.findFiles(
        ['**/*.{js,ts,jsx,tsx}'],
        ['node_modules/**', '**/dist/**', '**/build/**', '**/*.test.*', '**/*.spec.*']
      );

      if (sourceFiles.length === 0) {
        return { type: 'commonjs', confidence: 0.5 };
      }

      let esmCount = 0;
      let cjsCount = 0;
      let totalFiles = 0;

      // Sample up to 20 files for performance
      const filesToCheck = sourceFiles.slice(0, 20);

      for (const filePath of filesToCheck) {
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          const hasEsmSyntax = this.hasEsmSyntax(content);
          const hasCjsSyntax = this.hasCjsSyntax(content);

          totalFiles++;

          if (hasEsmSyntax && !hasCjsSyntax) {
            esmCount++;
          } else if (hasCjsSyntax && !hasEsmSyntax) {
            cjsCount++;
          }
          // Files with both or neither don't contribute to the count
        } catch (error) {
          logger.debug(`Error reading file ${filePath}:`, error);
        }
      }

      if (totalFiles === 0) {
        return { type: 'commonjs', confidence: 0.5 };
      }

      const esmRatio = esmCount / totalFiles;
      const cjsRatio = cjsCount / totalFiles;

      if (esmRatio > 0.7) {
        return { type: 'esm', confidence: Math.min(0.9, esmRatio) };
      } else if (cjsRatio > 0.7) {
        return { type: 'commonjs', confidence: Math.min(0.9, cjsRatio) };
      } else if (esmCount > 0 && cjsCount > 0) {
        return { type: 'mixed', confidence: 0.6 };
      } else {
        // Default to CommonJS if no clear pattern
        return { type: 'commonjs', confidence: 0.6 };
      }
    } catch (error) {
      logger.debug('Error detecting module type from files:', error);
      return { type: 'commonjs', confidence: 0.5 };
    }
  }

  private hasEsmSyntax(content: string): boolean {
    // Check for ES module syntax
    return (
      /\bimport\s+.*\s+from\s+['"`]/.test(content) ||
      /\bexport\s+(?:default\s+|(?:const|let|var|function|class)\s+)/.test(content) ||
      /\bexport\s*\{/.test(content)
    );
  }

  private hasCjsSyntax(content: string): boolean {
    // Check for CommonJS syntax
    return (
      /\brequire\s*\(/.test(content) ||
      /\bmodule\.exports\s*=/.test(content) ||
      /\bexports\.\w+\s*=/.test(content)
    );
  }

  private async detectFileExtensionPattern(): Promise<'js' | 'mjs' | 'ts'> {
    try {
      // Check for common file patterns in the project
      const tsFiles = await this.findFiles(
        ['**/*.ts', '**/*.tsx'],
        ['node_modules/**', 'dist/**', 'build/**']
      );
      const mjsFiles = await this.findFiles(
        ['**/*.mjs'],
        ['node_modules/**', 'dist/**', 'build/**']
      );

      if (tsFiles.length > 0) {
        return 'ts';
      } else if (mjsFiles.length > 0) {
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
