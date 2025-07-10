import { fs, path, fg, logger } from '../utils/common-imports';
import { FileDiscoveryType, type FileDiscoveryService } from '../types/file-discovery-types';
import { ProjectStructureDetector, type ProjectStructureAnalysis } from '../services/ProjectStructureDetector';

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
    const reactDetection = this.hasReact(packageJsonContent);
    if (reactDetection.detected) {
      const configFiles = await this.findFiles([
        '**/package.json',
        '**/.babelrc*',
        '**/webpack.config.*',
      ]);
      frameworks.push({
        name: 'react',
        confidence: reactDetection.confidence,
        ...(reactDetection.version && { version: reactDetection.version }),
        configFiles,
      });
    }

    // Vue detection
    const vueDetection = this.hasVue(packageJsonContent);
    if (vueDetection.detected) {
      const configFiles = await this.findFiles([
        '**/package.json',
        '**/vue.config.*',
        '**/vite.config.*',
      ]);
      frameworks.push({
        name: 'vue',
        confidence: vueDetection.confidence,
        ...(vueDetection.version && { version: vueDetection.version }),
        configFiles,
      });
    }

    // Angular detection
    const angularDetection = this.hasAngular(packageJsonContent);
    if (angularDetection.detected) {
      const configFiles = await this.findFiles([
        '**/angular.json',
        '**/package.json',
        '**/tsconfig.json',
      ]);
      frameworks.push({
        name: 'angular',
        confidence: angularDetection.confidence,
        ...(angularDetection.version && { version: angularDetection.version }),
        configFiles,
      });
    }

    // Express detection
    const expressDetection = this.hasExpress(packageJsonContent);
    if (expressDetection.detected) {
      const configFiles = await this.findFiles([
        '**/package.json',
        '**/app.js',
        '**/server.js',
        '**/index.js',
      ]);
      frameworks.push({
        name: 'express',
        confidence: expressDetection.confidence,
        ...(expressDetection.version && { version: expressDetection.version }),
        configFiles,
      });
    }

    // Next.js detection
    const nextJsDetection = this.hasNextJs(packageJsonContent);
    if (nextJsDetection.detected) {
      const configFiles = await this.findFiles(['**/next.config.*', '**/package.json']);
      frameworks.push({
        name: 'nextjs',
        confidence: nextJsDetection.confidence,
        ...(nextJsDetection.version && { version: nextJsDetection.version }),
        configFiles,
      });
    }

    // Svelte detection
    const svelteDetection = this.hasSvelte(packageJsonContent);
    if (svelteDetection.detected) {
      const configFiles = await this.findFiles([
        '**/svelte.config.*',
        '**/package.json',
        '**/.svelte-kit/**',
      ]);
      frameworks.push({
        name: 'svelte',
        confidence: svelteDetection.confidence,
        ...(svelteDetection.version && { version: svelteDetection.version }),
        configFiles,
      });
    }

    // Nuxt detection
    const nuxtDetection = this.hasNuxt(packageJsonContent);
    if (nuxtDetection.detected) {
      const configFiles = await this.findFiles([
        '**/nuxt.config.*',
        '**/package.json',
        '**/.nuxt/**',
      ]);
      frameworks.push({
        name: 'nuxt',
        confidence: nuxtDetection.confidence,
        ...(nuxtDetection.version && { version: nuxtDetection.version }),
        configFiles,
      });
    }

    // FastAPI detection
    const fastAPIDetection = this.hasFastAPI(pythonDeps);
    if (fastAPIDetection.detected) {
      const configFiles = await this.findFiles([
        '**/main.py',
        '**/app.py',
        '**/requirements.txt',
        '**/pyproject.toml',
      ]);
      frameworks.push({
        name: 'fastapi',
        confidence: fastAPIDetection.confidence,
        ...(fastAPIDetection.version && { version: fastAPIDetection.version }),
        configFiles,
      });
    }

    // Django detection
    const djangoDetection = this.hasDjango(pythonDeps);
    if (djangoDetection.detected) {
      const configFiles = await this.findFiles([
        '**/manage.py',
        '**/settings.py',
        '**/requirements.txt',
        '**/pyproject.toml',
      ]);
      frameworks.push({
        name: 'django',
        confidence: djangoDetection.confidence,
        ...(djangoDetection.version && { version: djangoDetection.version }),
        configFiles,
      });
    }

    // Flask detection
    const flaskDetection = this.hasFlask(pythonDeps);
    if (flaskDetection.detected) {
      const configFiles = await this.findFiles([
        '**/app.py',
        '**/main.py',
        '**/requirements.txt',
        '**/pyproject.toml',
      ]);
      frameworks.push({
        name: 'flask',
        confidence: flaskDetection.confidence,
        ...(flaskDetection.version && { version: flaskDetection.version }),
        configFiles,
      });
    }

    // MCP Server detection
    const mcpDetection = this.hasMCPServer(packageJsonContent);
    if (mcpDetection.detected) {
      const configFiles = await this.findFiles([
        '**/mcp.json',
        '**/.mcp/**',
        '**/package.json',
        '**/server.py',
        '**/server.js',
        '**/server.ts',
      ]);

      const framework = this.detectMCPFramework(packageJsonContent);
      if (framework === 'fastmcp') {
        frameworks.push({
          name: 'fastmcp',
          confidence: mcpDetection.confidence,
          ...(mcpDetection.version && { version: mcpDetection.version }),
          configFiles,
        });
      } else {
        frameworks.push({
          name: 'mcp-server',
          confidence: mcpDetection.confidence,
          ...(mcpDetection.version && { version: mcpDetection.version }),
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
    } catch (error) {
      logger.warn('Smart structure analysis failed, falling back to basic detection:', error);
    }

    // Use smart analysis results if available, otherwise fallback to basic detection
    let srcDirectory: string | undefined;
    let testDirectories: string[] = [];

    if (smartAnalysis && smartAnalysis.confidence > 0.5) {
      // Use smart analysis results
      const primarySource = smartAnalysis.sourceDirectories[0];
      srcDirectory = primarySource?.path !== '.' ? primarySource?.path : undefined;
      testDirectories = smartAnalysis.testDirectories.map(td => td.path);
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

  private async analyzeDependencies(): Promise<Dependencies> {
    const packageJsonContent = await this.readPackageJson();
    const pythonDeps = await this.readPythonDependencies();

    return {
      production: packageJsonContent?.dependencies ?? {},
      development: packageJsonContent?.devDependencies ?? {},
      python: pythonDeps ?? undefined,
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
  private hasReact(packageJson: PackageJsonContent | null): FrameworkDetectionResult {
    if (!packageJson) {
      return { detected: false, confidence: 0, indicators: [] };
    }

    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
    const indicators: string[] = [];
    const dependencies: string[] = [];

    if (deps?.react) {
      indicators.push('react package found');
      dependencies.push('react');
    }
    if (deps?.['react-dom']) {
      indicators.push('react-dom package found');
      dependencies.push('react-dom');
    }
    if (deps?.['@types/react']) {
      indicators.push('TypeScript React types found');
      dependencies.push('@types/react');
    }
    if (deps?.['react-scripts']) {
      indicators.push('Create React App detected');
      dependencies.push('react-scripts');
    }

    const detected = dependencies.length > 0;
    const confidence = detected ? Math.min(0.95, 0.6 + dependencies.length * 0.1) : 0;

    const result: FrameworkDetectionResult = {
      detected,
      confidence,
      indicators,
      dependencies,
    };

    if (deps?.react) {
      result.version = deps.react;
    }

    return result;
  }

  private hasVue(packageJson: PackageJsonContent | null): FrameworkDetectionResult {
    if (!packageJson) {
      return { detected: false, confidence: 0, indicators: [] };
    }

    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
    const indicators: string[] = [];
    const dependencies: string[] = [];

    if (deps?.vue) {
      indicators.push('vue package found');
      dependencies.push('vue');
    }
    if (deps?.['@vue/cli']) {
      indicators.push('Vue CLI found');
      dependencies.push('@vue/cli');
    }
    if (deps?.['@vue/cli-service']) {
      indicators.push('Vue CLI Service found');
      dependencies.push('@vue/cli-service');
    }
    if (deps?.nuxt) {
      indicators.push('Nuxt.js framework detected');
      dependencies.push('nuxt');
    }

    const detected = dependencies.length > 0;
    const confidence = detected ? Math.min(0.95, 0.6 + dependencies.length * 0.1) : 0;

    const result: FrameworkDetectionResult = {
      detected,
      confidence,
      indicators,
      dependencies,
    };

    if (deps?.vue) {
      result.version = deps.vue;
    }

    return result;
  }

  private hasAngular(packageJson: PackageJsonContent | null): FrameworkDetectionResult {
    if (!packageJson) {
      return { detected: false, confidence: 0, indicators: [] };
    }

    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
    const indicators: string[] = [];
    const dependencies: string[] = [];

    if (deps?.['@angular/core']) {
      indicators.push('Angular core package found');
      dependencies.push('@angular/core');
    }
    if (deps?.['@angular/cli']) {
      indicators.push('Angular CLI found');
      dependencies.push('@angular/cli');
    }
    if (deps?.['@angular/common']) {
      indicators.push('Angular common package found');
      dependencies.push('@angular/common');
    }
    if (deps?.['@angular/platform-browser']) {
      indicators.push('Angular platform browser found');
      dependencies.push('@angular/platform-browser');
    }

    const detected = dependencies.length > 0;
    const confidence = detected ? Math.min(0.95, 0.6 + dependencies.length * 0.1) : 0;

    const result: FrameworkDetectionResult = {
      detected,
      confidence,
      indicators,
      dependencies,
    };

    if (deps?.['@angular/core']) {
      result.version = deps['@angular/core'];
    }

    return result;
  }

  private hasExpress(packageJson: PackageJsonContent | null): FrameworkDetectionResult {
    if (!packageJson) {
      return { detected: false, confidence: 0, indicators: [] };
    }

    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
    const indicators: string[] = [];
    const dependencies: string[] = [];

    if (deps?.express) {
      indicators.push('express package found');
      dependencies.push('express');
    }
    if (deps?.['@types/express']) {
      indicators.push('TypeScript Express types found');
      dependencies.push('@types/express');
    }
    if (deps?.['body-parser']) {
      indicators.push('Express body-parser middleware found');
      dependencies.push('body-parser');
    }
    if (deps?.['express-session']) {
      indicators.push('Express session middleware found');
      dependencies.push('express-session');
    }

    const detected = dependencies.length > 0;
    const confidence = detected ? Math.min(0.9, 0.5 + dependencies.length * 0.1) : 0;

    const result: FrameworkDetectionResult = {
      detected,
      confidence,
      indicators,
      dependencies,
    };

    if (deps?.express) {
      result.version = deps.express;
    }

    return result;
  }

  private hasNextJs(packageJson: PackageJsonContent | null): FrameworkDetectionResult {
    if (!packageJson) {
      return { detected: false, confidence: 0, indicators: [] };
    }

    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
    const indicators: string[] = [];
    const dependencies: string[] = [];

    if (deps?.next) {
      indicators.push('next package found');
      dependencies.push('next');
    }
    if (deps?.['@next/font']) {
      indicators.push('Next.js font optimization found');
      dependencies.push('@next/font');
    }
    if (deps?.['@next/image']) {
      indicators.push('Next.js image optimization found');
      dependencies.push('@next/image');
    }
    if (packageJson.scripts?.dev?.includes('next dev')) {
      indicators.push('Next.js dev script detected');
    }

    const detected = dependencies.length > 0;
    const confidence = detected ? Math.min(0.95, 0.7 + dependencies.length * 0.1) : 0;

    const result: FrameworkDetectionResult = {
      detected,
      confidence,
      indicators,
      dependencies,
    };

    if (deps?.next) {
      result.version = deps.next;
    }

    return result;
  }

  private hasFastAPI(pythonDeps: Record<string, string> | null): FrameworkDetectionResult {
    if (!pythonDeps) {
      return { detected: false, confidence: 0, indicators: [] };
    }

    const indicators: string[] = [];
    const dependencies: string[] = [];

    if (pythonDeps?.fastapi ?? pythonDeps?.['fastapi[all]']) {
      indicators.push('fastapi package found');
      dependencies.push('fastapi');
    }
    if (pythonDeps?.uvicorn ?? pythonDeps?.['uvicorn[standard]']) {
      indicators.push('Uvicorn ASGI server found');
      dependencies.push('uvicorn');
    }
    if (pythonDeps?.pydantic) {
      indicators.push('Pydantic validation library found');
      dependencies.push('pydantic');
    }
    if (pythonDeps?.starlette) {
      indicators.push('Starlette framework found');
      dependencies.push('starlette');
    }

    const detected = dependencies.includes('fastapi');
    const confidence = detected ? Math.min(0.95, 0.6 + dependencies.length * 0.1) : 0;

    const result: FrameworkDetectionResult = {
      detected,
      confidence,
      indicators,
      dependencies,
    };

    const version = pythonDeps?.fastapi ?? pythonDeps?.['fastapi[all]'];
    if (version) {
      result.version = version;
    }

    return result;
  }

  private hasDjango(pythonDeps: Record<string, string> | null): FrameworkDetectionResult {
    if (!pythonDeps) {
      return { detected: false, confidence: 0, indicators: [] };
    }

    const indicators: string[] = [];
    const dependencies: string[] = [];

    if (pythonDeps?.django ?? pythonDeps?.Django) {
      indicators.push('django package found');
      dependencies.push('django');
    }
    if (pythonDeps?.['django-rest-framework'] ?? pythonDeps?.djangorestframework) {
      indicators.push('Django REST Framework found');
      dependencies.push('django-rest-framework');
    }
    if (pythonDeps?.['django-cors-headers']) {
      indicators.push('Django CORS headers found');
      dependencies.push('django-cors-headers');
    }
    if (pythonDeps?.celery) {
      indicators.push('Celery task queue found');
      dependencies.push('celery');
    }

    const detected = dependencies.includes('django');
    const confidence = detected ? Math.min(0.95, 0.7 + dependencies.length * 0.1) : 0;

    const result: FrameworkDetectionResult = {
      detected,
      confidence,
      indicators,
      dependencies,
    };

    const version = pythonDeps?.django ?? pythonDeps?.Django;
    if (version) {
      result.version = version;
    }

    return result;
  }

  private hasFlask(pythonDeps: Record<string, string> | null): FrameworkDetectionResult {
    if (!pythonDeps) {
      return { detected: false, confidence: 0, indicators: [] };
    }

    const indicators: string[] = [];
    const dependencies: string[] = [];

    if (pythonDeps?.flask ?? pythonDeps?.Flask) {
      indicators.push('flask package found');
      dependencies.push('flask');
    }
    if (pythonDeps?.['flask-restful'] ?? pythonDeps?.['Flask-RESTful']) {
      indicators.push('Flask-RESTful extension found');
      dependencies.push('flask-restful');
    }
    if (pythonDeps?.['flask-sqlalchemy'] ?? pythonDeps?.['Flask-SQLAlchemy']) {
      indicators.push('Flask-SQLAlchemy extension found');
      dependencies.push('flask-sqlalchemy');
    }
    if (pythonDeps?.['flask-cors'] ?? pythonDeps?.['Flask-CORS']) {
      indicators.push('Flask-CORS extension found');
      dependencies.push('flask-cors');
    }

    const detected = dependencies.includes('flask');
    const confidence = detected ? Math.min(0.9, 0.6 + dependencies.length * 0.1) : 0;

    const result: FrameworkDetectionResult = {
      detected,
      confidence,
      indicators,
      dependencies,
    };

    const version = pythonDeps?.flask ?? pythonDeps?.Flask;
    if (version) {
      result.version = version;
    }

    return result;
  }

  private hasMCPServer(packageJson: PackageJsonContent | null): FrameworkDetectionResult {
    if (!packageJson) {
      return { detected: false, confidence: 0, indicators: [] };
    }

    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
    const indicators: string[] = [];
    const dependencies: string[] = [];

    if (deps?.['@modelcontextprotocol/sdk']) {
      indicators.push('Official MCP SDK found');
      dependencies.push('@modelcontextprotocol/sdk');
    }
    if (deps?.['@modelcontextprotocol/server']) {
      indicators.push('MCP server package found');
      dependencies.push('@modelcontextprotocol/server');
    }
    if (deps?.fastmcp) {
      indicators.push('FastMCP framework found');
      dependencies.push('fastmcp');
    }
    if (deps?.['mcp-framework']) {
      indicators.push('MCP framework package found');
      dependencies.push('mcp-framework');
    }
    if (deps?.['@anthropic/mcp']) {
      indicators.push('Anthropic MCP package found');
      dependencies.push('@anthropic/mcp');
    }

    // Check for MCP-related scripts
    if (packageJson.scripts) {
      const mcpScripts = Object.entries(packageJson.scripts).filter(
        ([key, value]) => value.includes('mcp') || key.includes('mcp')
      );
      if (mcpScripts.length > 0) {
        indicators.push(`MCP scripts found: ${mcpScripts.map(([k]) => k).join(', ')}`);
      }
    }

    const detected = dependencies.length > 0;
    const confidence = detected ? Math.min(0.95, 0.7 + dependencies.length * 0.1) : 0;

    // Determine primary version
    const version =
      deps?.fastmcp ??
      deps?.['@modelcontextprotocol/sdk'] ??
      deps?.['@modelcontextprotocol/server'] ??
      deps?.['mcp-framework'] ??
      deps?.['@anthropic/mcp'];

    const result: FrameworkDetectionResult = {
      detected,
      confidence,
      indicators,
      dependencies,
    };

    if (version) {
      result.version = version;
    }

    return result;
  }

  private detectMCPFramework(
    packageJson: PackageJsonContent | null
  ): 'fastmcp' | 'official-sdk' | 'custom' {
    if (!packageJson) return 'custom';
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

    if (deps?.fastmcp) {
      return 'fastmcp';
    } else if (deps?.['@modelcontextprotocol/sdk']) {
      return 'official-sdk';
    }

    return 'custom';
  }

  private hasSvelte(packageJson: PackageJsonContent | null): FrameworkDetectionResult {
    if (!packageJson) {
      return { detected: false, confidence: 0, indicators: [] };
    }

    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
    const indicators: string[] = [];
    const dependencies: string[] = [];

    if (deps?.svelte) {
      indicators.push('svelte package found');
      dependencies.push('svelte');
    }
    if (deps?.['@sveltejs/kit']) {
      indicators.push('SvelteKit framework found');
      dependencies.push('@sveltejs/kit');
    }
    if (deps?.['@sveltejs/adapter-auto']) {
      indicators.push('SvelteKit adapter found');
      dependencies.push('@sveltejs/adapter-auto');
    }
    if (deps?.['svelte-preprocess']) {
      indicators.push('Svelte preprocessor found');
      dependencies.push('svelte-preprocess');
    }

    const detected = dependencies.length > 0;
    const confidence = detected ? Math.min(0.95, 0.6 + dependencies.length * 0.1) : 0;

    const result: FrameworkDetectionResult = {
      detected,
      confidence,
      indicators,
      dependencies,
    };

    if (deps?.svelte) {
      result.version = deps.svelte;
    }

    return result;
  }

  private hasNuxt(packageJson: PackageJsonContent | null): FrameworkDetectionResult {
    if (!packageJson) {
      return { detected: false, confidence: 0, indicators: [] };
    }

    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
    const indicators: string[] = [];
    const dependencies: string[] = [];

    if (deps?.nuxt ?? deps?.nuxt3) {
      indicators.push('nuxt package found');
      dependencies.push('nuxt');
    }
    if (deps?.['@nuxt/kit']) {
      indicators.push('Nuxt Kit found');
      dependencies.push('@nuxt/kit');
    }
    if (deps?.['@nuxtjs/composition-api']) {
      indicators.push('Nuxt Composition API found');
      dependencies.push('@nuxtjs/composition-api');
    }

    const detected = dependencies.length > 0;
    const confidence = detected ? Math.min(0.95, 0.7 + dependencies.length * 0.1) : 0;

    const result: FrameworkDetectionResult = {
      detected,
      confidence,
      indicators,
      dependencies,
    };

    const version = deps?.nuxt ?? deps?.nuxt3;
    if (version) {
      result.version = version;
    }

    return result;
  }

  private async analyzeMCPCapabilities(): Promise<MCPCapabilities> {
    const packageJson = await this.readPackageJson();
    const framework = this.detectMCPFramework(packageJson);

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
        deep: options.deep ?? 10,
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

  private async readPackageJson(): Promise<PackageJsonContent | null> {
    try {
      const packageJsonPath = path.join(this.projectPath, 'package.json');
      const content = await fs.readFile(packageJsonPath, 'utf-8');
      return JSON.parse(content) as PackageJsonContent;
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
            deps[match[1]] = match[2] ?? '*';
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
