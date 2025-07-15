import { fs, path, fg } from '../../utils/common-imports';
import type {
  DetectedFramework,
  PackageJsonContent,
  FrameworkDetectionResult,
} from '../ProjectAnalyzer';

/**
 * Service responsible for detecting frameworks in a project
 */
export class FrameworkDetectionService {
  constructor(private projectPath: string) {}

  async detectFrameworks(): Promise<DetectedFramework[]> {
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
        '**/wsgi.py',
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
        '**/package.json',
        '**/index.js',
        '**/server.js',
        '**/mcp.config.*',
      ]);
      frameworks.push({
        name: 'mcp-server',
        confidence: mcpDetection.confidence,
        ...(mcpDetection.version && { version: mcpDetection.version }),
        configFiles,
      });
    }

    // FastMCP detection
    const fastMCPFramework = await this.detectMCPFramework(packageJsonContent, pythonDeps);
    if (fastMCPFramework) {
      frameworks.push(fastMCPFramework);
    }

    return frameworks;
  }

  private async readPackageJson(): Promise<PackageJsonContent | null> {
    try {
      const packageJsonPath = path.join(this.projectPath, 'package.json');
      const content = await fs.readFile(packageJsonPath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  private async readPythonDependencies(): Promise<Record<string, string> | null> {
    try {
      const requirementsPath = path.join(this.projectPath, 'requirements.txt');
      const content = await fs.readFile(requirementsPath, 'utf-8');
      const deps: Record<string, string> = {};
      content.split('\n').forEach((line) => {
        const cleanLine = line.trim();
        if (cleanLine && !cleanLine.startsWith('#')) {
          const [pkg, ...versionParts] = cleanLine.split('==');
          if (pkg) {
            const version = versionParts.length > 0 ? `==${versionParts.join('==')}` : '*';
            deps[pkg.trim()] = version.trim();
          }
        }
      });
      return deps;
    } catch {
      return null;
    }
  }

  private async findFiles(patterns: string[]): Promise<string[]> {
    try {
      return await fg(patterns, {
        cwd: this.projectPath,
        ignore: ['node_modules/**', '**/node_modules/**', '**/.git/**'],
      });
    } catch {
      return [];
    }
  }

  private hasReact(packageJson: PackageJsonContent | null): FrameworkDetectionResult {
    if (!packageJson) {
      return { detected: false, confidence: 0, indicators: [] };
    }

    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
    const reactDep = deps?.react;
    const hasReactDom = deps?.['react-dom'];
    const hasReactScripts = deps?.['react-scripts'];

    if (reactDep || hasReactDom || hasReactScripts) {
      const indicators = [];
      if (reactDep) indicators.push('react dependency');
      if (hasReactDom) indicators.push('react-dom dependency');
      if (hasReactScripts) indicators.push('react-scripts dependency');

      const result: FrameworkDetectionResult = {
        detected: true,
        confidence: 0.9,
        indicators,
        dependencies: ['react', 'react-dom'].filter((dep) => deps?.[dep]),
      };
      if (reactDep) {
        result.version = reactDep;
      }
      return result;
    }

    return { detected: false, confidence: 0, indicators: [] };
  }

  private hasVue(packageJson: PackageJsonContent | null): FrameworkDetectionResult {
    if (!packageJson) {
      return { detected: false, confidence: 0, indicators: [] };
    }

    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
    const vueDep = deps?.vue;

    if (vueDep) {
      return {
        detected: true,
        confidence: 0.9,
        version: vueDep,
        indicators: ['vue dependency'],
        dependencies: ['vue'],
      };
    }

    return { detected: false, confidence: 0, indicators: [] };
  }

  private hasAngular(packageJson: PackageJsonContent | null): FrameworkDetectionResult {
    if (!packageJson) {
      return { detected: false, confidence: 0, indicators: [] };
    }

    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
    const angularCore = deps?.['@angular/core'];
    const angularCli = deps?.['@angular/cli'];

    if (angularCore || angularCli) {
      const indicators = [];
      if (angularCore) indicators.push('@angular/core dependency');
      if (angularCli) indicators.push('@angular/cli dependency');

      const result: FrameworkDetectionResult = {
        detected: true,
        confidence: 0.9,
        indicators,
        dependencies: ['@angular/core'].filter((dep) => deps?.[dep]),
      };
      if (angularCore) {
        result.version = angularCore;
      }
      return result;
    }

    return { detected: false, confidence: 0, indicators: [] };
  }

  private hasExpress(packageJson: PackageJsonContent | null): FrameworkDetectionResult {
    if (!packageJson) {
      return { detected: false, confidence: 0, indicators: [] };
    }

    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
    const expressDep = deps?.express;

    if (expressDep) {
      return {
        detected: true,
        confidence: 0.9,
        version: expressDep,
        indicators: ['express dependency'],
        dependencies: ['express'],
      };
    }

    return { detected: false, confidence: 0, indicators: [] };
  }

  private hasNextJs(packageJson: PackageJsonContent | null): FrameworkDetectionResult {
    if (!packageJson) {
      return { detected: false, confidence: 0, indicators: [] };
    }

    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
    const nextDep = deps?.next;

    if (nextDep) {
      return {
        detected: true,
        confidence: 0.9,
        version: nextDep,
        indicators: ['next dependency'],
        dependencies: ['next'],
      };
    }

    return { detected: false, confidence: 0, indicators: [] };
  }

  private hasFastAPI(pythonDeps: Record<string, string> | null): FrameworkDetectionResult {
    if (!pythonDeps) {
      return { detected: false, confidence: 0, indicators: [] };
    }

    const fastApiDep = pythonDeps.fastapi;
    if (fastApiDep) {
      return {
        detected: true,
        confidence: 0.9,
        version: fastApiDep,
        indicators: ['fastapi dependency'],
        dependencies: ['fastapi'],
      };
    }

    return { detected: false, confidence: 0, indicators: [] };
  }

  private hasDjango(pythonDeps: Record<string, string> | null): FrameworkDetectionResult {
    if (!pythonDeps) {
      return { detected: false, confidence: 0, indicators: [] };
    }

    const djangoDep = pythonDeps.Django || pythonDeps.django;
    if (djangoDep) {
      return {
        detected: true,
        confidence: 0.9,
        version: djangoDep,
        indicators: ['django dependency'],
        dependencies: ['django'],
      };
    }

    return { detected: false, confidence: 0, indicators: [] };
  }

  private hasFlask(pythonDeps: Record<string, string> | null): FrameworkDetectionResult {
    if (!pythonDeps) {
      return { detected: false, confidence: 0, indicators: [] };
    }

    const flaskDep = pythonDeps.Flask || pythonDeps.flask;
    if (flaskDep) {
      return {
        detected: true,
        confidence: 0.9,
        version: flaskDep,
        indicators: ['flask dependency'],
        dependencies: ['flask'],
      };
    }

    return { detected: false, confidence: 0, indicators: [] };
  }

  private hasMCPServer(packageJson: PackageJsonContent | null): FrameworkDetectionResult {
    if (!packageJson) {
      return { detected: false, confidence: 0, indicators: [] };
    }

    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
    const mcpDep = deps?.['@modelcontextprotocol/sdk'];

    if (mcpDep) {
      return {
        detected: true,
        confidence: 0.9,
        version: mcpDep,
        indicators: ['@modelcontextprotocol/sdk dependency'],
        dependencies: ['@modelcontextprotocol/sdk'],
      };
    }

    return { detected: false, confidence: 0, indicators: [] };
  }

  private hasSvelte(packageJson: PackageJsonContent | null): FrameworkDetectionResult {
    if (!packageJson) {
      return { detected: false, confidence: 0, indicators: [] };
    }

    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
    const svelteDep = deps?.svelte;

    if (svelteDep) {
      return {
        detected: true,
        confidence: 0.9,
        version: svelteDep,
        indicators: ['svelte dependency'],
        dependencies: ['svelte'],
      };
    }

    return { detected: false, confidence: 0, indicators: [] };
  }

  private hasNuxt(packageJson: PackageJsonContent | null): FrameworkDetectionResult {
    if (!packageJson) {
      return { detected: false, confidence: 0, indicators: [] };
    }

    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
    const nuxtDep = deps?.nuxt;

    if (nuxtDep) {
      return {
        detected: true,
        confidence: 0.9,
        version: nuxtDep,
        indicators: ['nuxt dependency'],
        dependencies: ['nuxt'],
      };
    }

    return { detected: false, confidence: 0, indicators: [] };
  }

  private async detectMCPFramework(
    _packageJson: PackageJsonContent | null,
    pythonDeps: Record<string, string> | null
  ): Promise<DetectedFramework | null> {
    // Check for FastMCP in Python dependencies
    if (pythonDeps?.fastmcp) {
      const configFiles = await this.findFiles([
        '**/requirements.txt',
        '**/pyproject.toml',
        '**/main.py',
        '**/server.py',
      ]);

      return {
        name: 'fastmcp',
        confidence: 0.9,
        version: pythonDeps.fastmcp,
        configFiles,
      };
    }

    return null;
  }
}
