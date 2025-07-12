/**
 * User configuration loader
 *
 * Loads configuration from user-level configuration files in standard locations:
 * - ~/.claude-testing.config.json
 * - ~/.config/claude-testing/config.json
 * - ~/.claude-testing/config.json
 */

import { fs, path } from '../../utils/common-imports';
import { ConfigurationManager } from '../../utils/config-validation';
import type { PartialClaudeTestingConfig } from '../../types/config';
import {
  BaseConfigurationSourceLoader,
  ConfigurationSourceType,
  type ConfigurationSourceLoadResult,
} from './ConfigurationSourceLoader';

/**
 * Loader for user configuration files
 */
export class UserConfigurationLoader extends BaseConfigurationSourceLoader {
  readonly sourceType = ConfigurationSourceType.USER_CONFIG;

  /**
   * Load user configuration from standard locations
   */
  async load(): Promise<ConfigurationSourceLoadResult> {
    const userConfigPaths = this.discoverUserConfigPaths();

    for (const configPath of userConfigPaths) {
      try {
        await fs.access(configPath);
        const configContent = await fs.readFile(configPath, 'utf8');
        const userConfig = JSON.parse(configContent) as PartialClaudeTestingConfig;

        // Validate the user configuration to get errors and warnings
        const manager = new ConfigurationManager(this.options.projectPath);
        const validationResult = manager.validateConfiguration(userConfig);

        const source = this.createSource(
          userConfig,
          true,
          validationResult.errors,
          validationResult.warnings,
          configPath
        );

        return this.createSuccessResult(source);
      } catch (error: unknown) {
        // Try next path
        continue;
      }
    }

    // No user configuration found - return empty but successful result
    const source = this.createSource({}, false, [], [], undefined);
    return this.createSuccessResult(source);
  }

  /**
   * Check if user configuration is available
   */
  async isAvailable(): Promise<boolean> {
    const userConfigPaths = this.discoverUserConfigPaths();

    for (const configPath of userConfigPaths) {
      try {
        await fs.access(configPath);
        return true;
      } catch {
        // Try next path
        continue;
      }
    }

    return false;
  }

  /**
   * Get description of this loader
   */
  getDescription(): string {
    return 'User configuration files (~/.claude-testing.config.json, ~/.config/claude-testing/config.json)';
  }

  /**
   * Discover potential user configuration file paths
   */
  private discoverUserConfigPaths(): string[] {
    const homeDir = process.env.HOME ?? process.env.USERPROFILE ?? '';
    return [
      path.join(homeDir, '.claude-testing.config.json'),
      path.join(homeDir, '.config', 'claude-testing', 'config.json'),
      path.join(homeDir, '.claude-testing', 'config.json'),
    ];
  }
}
