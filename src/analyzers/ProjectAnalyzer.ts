import { fs, path, fg, logger } from '../utils/common-imports';
import { FileDiscoveryType, type FileDiscoveryService } from '../types/file-discovery-types';
import {
  ProjectStructureDetector,
  type ProjectStructureAnalysis,
} from '../services/ProjectStructureDetector';
import { ProjectAnalysisOrchestrator } from './services/ProjectAnalysisOrchestrator';

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

export interface FrameworkDetectionResult {
  detected: boolean;
  confidence: number;
  version?: string;
  indicators: string[];
  dependencies?: string[];
}

export interface PackageJsonContent {
  name?: string;
  version?: string;
  type?: 'module' | 'commonjs';
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
  engines?: Record<string, string>;
  main?: string;
  module?: string;
  types?: string;
  [key: string]: unknown;
}

export interface ProjectStructure {
  rootFiles: string[];
  srcDirectory: string | undefined;
  testDirectories: string[];
  configFiles: string[];
  buildOutputs: string[];
  entryPoints: string[];
  // Enhanced structure analysis
  smartAnalysis?: ProjectStructureAnalysis | undefined;
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
  private orchestrator: ProjectAnalysisOrchestrator;

  constructor(
    projectPath: string,
    private fileDiscovery?: FileDiscoveryService
  ) {
    this.projectPath = path.resolve(projectPath);
    this.orchestrator = new ProjectAnalysisOrchestrator(projectPath);
  }

  async analyzeProject(): Promise<ProjectAnalysis> {
    logger.info(`Starting analysis of project: ${this.projectPath}`);

    // Validate project path exists
    try {
      await fs.access(this.projectPath);
    } catch (error: unknown) {
      throw new Error(`Project path does not exist: ${this.projectPath}`);
    }

    try {
      // Use orchestrator for extracted services
      const coordinatedAnalysis = await this.orchestrator.analyzeProject();

      // Perform remaining analysis methods directly
      const [packageManagers, projectStructure, testingSetup, moduleSystem] = await Promise.all([
        this.detectPackageManagers(),
        this.analyzeProjectStructure(),
        this.analyzeTestingSetup(),
        this.analyzeModuleSystem(),
      ]);

      // Combine orchestrator results with remaining analysis
      const analysis: ProjectAnalysis = {
        ...coordinatedAnalysis,
        packageManagers,
        projectStructure,
        testingSetup,
        moduleSystem,
      } as ProjectAnalysis;

      // Add MCP capabilities if this is an MCP server
      if (analysis.projectType === 'mcp-server') {
        const mcpCapabilities = await this.analyzeMCPCapabilities();
        analysis.mcpCapabilities = mcpCapabilities;
      }

      logger.info('Project analysis completed successfully');
      return analysis;
    } catch (error: unknown) {
      logger.error('Project analysis failed:', error);
      throw new Error(
        `Failed to analyze project: ${error instanceof Error ? error.message : String(error)}`
      );
    }
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
    // Original basic analysis
    const rootFiles = await this.findFiles(['*'], [], { onlyFiles: true, deep: 1 });

    // Enhanced smart structure detection
    const structureDetector = new ProjectStructureDetector(this.projectPath);
    let smartAnalysis: ProjectStructureAnalysis | undefined;

    try {
      smartAnalysis = await structureDetector.analyzeStructure();
      logger.info(
        'Smart structure analysis complete: type=%s confidence=%d source_dirs=%d',
        smartAnalysis.detectedStructure,
        Math.round(smartAnalysis.confidence * 100),
        smartAnalysis.sourceDirectories.length
      );
    } catch (error: unknown) {
      logger.warn('Smart structure analysis failed, falling back to basic detection:', error);
    }

    // Use smart analysis results if available, otherwise fallback to basic detection
    let srcDirectory: string | undefined;
    let testDirectories: string[] = [];

    if (smartAnalysis && smartAnalysis.confidence > 0.5) {
      // Use smart analysis results
      const primarySource = smartAnalysis.sourceDirectories[0];
      srcDirectory = primarySource?.path !== '.' ? primarySource?.path : undefined;
      testDirectories = smartAnalysis.testDirectories.map((td) => td.path);
    } else {
      // Fallback to basic detection
      const srcCandidates = ['src', 'lib', 'app', 'source'];
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
      testDirectories = await this.findDirectories(
        ['**/test', '**/tests', '**/__tests__', '**/*.test.*'],
        ['node_modules/**']
      );
    }

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
      smartAnalysis,
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
      ...(packageJsonContent?.dependencies ?? {}),
      ...(packageJsonContent?.devDependencies ?? {}),
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

  private async analyzeMCPCapabilities(): Promise<MCPCapabilities> {
    const packageJson = await this.readPackageJson();
    const pythonDeps = await this.readPythonDependencies();

    // Determine MCP framework type based on dependencies
    let framework: 'fastmcp' | 'official-sdk' | 'custom' = 'custom';

    // Check Python dependencies first (FastMCP is a Python package)
    if (pythonDeps?.fastmcp) {
      framework = 'fastmcp';
    } else if (packageJson) {
      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
      if (deps?.['@modelcontextprotocol/sdk']) {
        framework = 'official-sdk';
      }
    }

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
      packageJson?.dependencies?.express ??
      packageJson?.dependencies?.fastify ??
      packageJson?.dependencies?.['@fastify/sse'] ??
      packageJson?.devDependencies?.express ??
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

        interface MCPConfig {
          tools?: Array<{
            name?: string;
            description?: string;
            inputSchema?: unknown;
          }>;
          resources?: Array<{
            name?: string;
            uri?: string;
            mimeType?: string;
          }>;
          prompts?: Array<{
            name?: string;
            description?: string;
            arguments?: unknown;
          }>;
        }

        const config = JSON.parse(configContent) as MCPConfig;

        // Extract capabilities from config if available
        if (config.tools) {
          capabilities.tools = config.tools.map((tool) => ({
            name: tool.name ?? 'unknown',
            ...(tool.description ? { description: tool.description } : {}),
            ...(tool.inputSchema ? { inputSchema: tool.inputSchema } : {}),
          }));
        }

        if (config.resources) {
          capabilities.resources = config.resources.map((resource) => ({
            name: resource.name ?? 'unknown',
            uri: resource.uri ?? '',
            ...(resource.mimeType ? { mimeType: resource.mimeType } : {}),
          }));
        }

        if (config.prompts) {
          capabilities.prompts = config.prompts.map((prompt) => ({
            name: prompt.name ?? 'unknown',
            ...(prompt.description ? { description: prompt.description } : {}),
            ...(prompt.arguments ? { arguments: prompt.arguments } : {}),
          }));
        }
      } catch (error: unknown) {
        logger.debug('Could not parse MCP config file:', error);
      }
    }

    return capabilities;
  }

  // Utility methods
  private async findFiles(
    patterns: string[],
    ignore: string[] = [],
    options: {
      absolute?: boolean;
      onlyFiles?: boolean;
      deep?: number;
    } = {}
  ): Promise<string[]> {
    // Use FileDiscoveryService if available, otherwise fall back to direct implementation
    if (this.fileDiscovery) {
      try {
        const result = await this.fileDiscovery.findFiles({
          baseDir: this.projectPath,
          include: patterns,
          exclude: ignore,
          type: FileDiscoveryType.CUSTOM,
          absolute: options.absolute ?? false,
          includeDirectories: options.onlyFiles === false,
          useCache: true,
        });

        return result.files;
      } catch (error: unknown) {
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
        deep: options.deep ?? 10,
        dot: false,
      });
    } catch (error: unknown) {
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
    } catch (error: unknown) {
      logger.debug('Error finding directories:', error);
      return [];
    }
  }

  private async readPackageJson(): Promise<PackageJsonContent | null> {
    try {
      const packageJsonPath = path.join(this.projectPath, 'package.json');
      const content = await fs.readFile(packageJsonPath, 'utf-8');
      return JSON.parse(content) as PackageJsonContent;
    } catch (error: unknown) {
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
    } catch (error: unknown) {
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
            deps[match[1]] = match[2] ?? '*';
          }
        }
      });

      return Object.keys(deps).length > 0 ? deps : null;
    } catch (error: unknown) {
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
    } catch (error: unknown) {
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
        } catch (error: unknown) {
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
    } catch (error: unknown) {
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
    } catch (error: unknown) {
      logger.debug('Error detecting file extension pattern:', error);
      return 'js';
    }
  }
}
