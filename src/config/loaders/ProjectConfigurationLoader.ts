/**
 * Project configuration loader
 *
 * Loads configuration from project-level configuration files.
 * Uses the existing ConfigurationManager for consistency.
 */

import { ConfigurationManager } from '../../utils/config-validation';
import {
  BaseConfigurationSourceLoader,
  ConfigurationSourceType,
  type ConfigurationSourceLoadResult,
} from './ConfigurationSourceLoader';

/**
 * Loader for project configuration files
 */
export class ProjectConfigurationLoader extends BaseConfigurationSourceLoader {
  readonly sourceType = ConfigurationSourceType.PROJECT_CONFIG;

  /**
   * Load project configuration
   */
  async load(): Promise<ConfigurationSourceLoadResult> {
    const manager = new ConfigurationManager(this.options.projectPath);

    try {
      const result = await manager.loadConfiguration();

      const source = this.createSource(
        result.config,
        result.valid,
        result.errors,
        [],
        manager.getConfigurationPath()
      );

      return this.createSuccessResult(source);
    } catch (error: unknown) {
      return this.createFailureResult(
        `Failed to load project configuration: ${(error as Error).message}`,
        manager.getConfigurationPath()
      );
    }
  }

  /**
   * Check if project configuration is available
   */
  async isAvailable(): Promise<boolean> {
    const manager = new ConfigurationManager(this.options.projectPath);
    try {
      await manager.loadConfiguration();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get description of this loader
   */
  getDescription(): string {
    return 'Project configuration file (.claude-testing.config.json)';
  }
}
