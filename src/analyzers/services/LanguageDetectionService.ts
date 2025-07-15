import { fs, path, fg, logger } from '../../utils/common-imports';
import type { DetectedLanguage } from '../ProjectAnalyzer';

/**
 * Service responsible for detecting programming languages in a project
 */
export class LanguageDetectionService {
  constructor(private projectPath: string) {}

  async detectLanguages(): Promise<DetectedLanguage[]> {
    logger.debug('Detecting project languages');
    const languages: DetectedLanguage[] = [];

    try {
      // Check for JavaScript/TypeScript
      const jsFiles = await fg(['**/*.{js,jsx,ts,tsx}'], {
        cwd: this.projectPath,
        ignore: ['node_modules/**', '**/node_modules/**', '**/.git/**'],
      });

      if (jsFiles.length > 0) {
        const tsFiles = jsFiles.filter((file) => file.endsWith('.ts') || file.endsWith('.tsx'));
        if (tsFiles.length > 0) {
          const tsVersion = await this.getTypeScriptVersion();
          const tsLang: DetectedLanguage = {
            name: 'typescript',
            confidence: tsFiles.length / jsFiles.length,
            files: tsFiles,
          };
          if (tsVersion) {
            tsLang.version = tsVersion;
          }
          languages.push(tsLang);
        }
        const nodeVersion = await this.getNodeVersion();
        const jsLang: DetectedLanguage = {
          name: 'javascript',
          confidence: 1,
          files: jsFiles,
        };
        if (nodeVersion) {
          jsLang.version = nodeVersion;
        }
        languages.push(jsLang);
      }

      // Check for Python
      const pythonFiles = await fg(['**/*.py'], {
        cwd: this.projectPath,
        ignore: ['node_modules/**', '**/node_modules/**', '**/.git/**'],
      });

      if (pythonFiles.length > 0) {
        const pythonVersion = await this.getPythonVersion();
        const pythonLang: DetectedLanguage = {
          name: 'python',
          confidence: 1,
          files: pythonFiles,
        };
        if (pythonVersion) {
          pythonLang.version = pythonVersion;
        }
        languages.push(pythonLang);
      }

      logger.debug(`Detected ${languages.length} languages`);
      return languages;
    } catch (error: unknown) {
      logger.error('Error detecting languages:', error);
      return [];
    }
  }

  private async getTypeScriptVersion(): Promise<string | undefined> {
    try {
      const packageJsonPath = path.join(this.projectPath, 'package.json');
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
      return packageJson.devDependencies?.typescript || packageJson.dependencies?.typescript;
    } catch {
      return undefined;
    }
  }

  private async getNodeVersion(): Promise<string | undefined> {
    try {
      const packageJsonPath = path.join(this.projectPath, 'package.json');
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
      return packageJson.engines?.node;
    } catch {
      return undefined;
    }
  }

  private async getPythonVersion(): Promise<string | undefined> {
    try {
      const requirementsPath = path.join(this.projectPath, 'requirements.txt');
      await fs.access(requirementsPath);
      // Could parse for Python version requirements
      return undefined;
    } catch {
      try {
        const pyprojectPath = path.join(this.projectPath, 'pyproject.toml');
        await fs.access(pyprojectPath);
        // Could parse TOML for Python version
        return undefined;
      } catch {
        return undefined;
      }
    }
  }
}
