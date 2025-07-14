import { fs, path } from '../../utils/common-imports';
import type { Dependencies, PackageJsonContent } from '../ProjectAnalyzer';

/**
 * Service responsible for analyzing project dependencies
 */
export class DependencyAnalysisService {
  constructor(private projectPath: string) {}

  async analyzeDependencies(): Promise<Dependencies> {
    const packageJsonContent = await this.readPackageJson();
    const pythonDeps = await this.readPythonDependencies();

    return {
      production: packageJsonContent?.dependencies ?? {},
      development: packageJsonContent?.devDependencies ?? {},
      python: pythonDeps ?? undefined,
    };
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
      // Try requirements.txt first
      const requirementsPath = path.join(this.projectPath, 'requirements.txt');
      try {
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
        return Object.keys(deps).length > 0 ? deps : null;
      } catch {
        // Fall back to pyproject.toml
        const pyprojectPath = path.join(this.projectPath, 'pyproject.toml');
        try {
          await fs.access(pyprojectPath);
          // For now, just indicate Python dependencies exist
          // Full TOML parsing would require additional dependency
          return {};
        } catch {
          return null;
        }
      }
    } catch {
      return null;
    }
  }
}
