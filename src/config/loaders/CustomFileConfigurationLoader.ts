/**
 * Custom file configuration loader
 *
 * Loads configuration from a custom file path specified by the user.
 */

import { fs } from '../../utils/common-imports';
import { ConfigurationManager } from '../../utils/config-validation';
import type { PartialClaudeTestingConfig } from '../../types/config';
import {
  BaseConfigurationSourceLoader,
  ConfigurationSourceType,
  type ConfigurationSourceLoadResult,
  type ConfigurationSourceLoaderOptions,
} from './ConfigurationSourceLoader';

/**
 * Options for custom file configuration loader
 */
export interface CustomFileConfigurationLoaderOptions extends ConfigurationSourceLoaderOptions {
  /** Custom configuration file path */
  customConfigPath: string;
}

/**
 * Loader for custom configuration files
 */
export class CustomFileConfigurationLoader extends BaseConfigurationSourceLoader {
  readonly sourceType = ConfigurationSourceType.CUSTOM_FILE;
  private customConfigPath: string;

  constructor(options: CustomFileConfigurationLoaderOptions) {
    super(options);
    this.customConfigPath = options.customConfigPath;
  }

  /**
   * Load custom file configuration
   */
  async load(): Promise<ConfigurationSourceLoadResult> {
    try {
      const configContent = await fs.readFile(this.customConfigPath, 'utf8');
      const customConfig = JSON.parse(configContent) as PartialClaudeTestingConfig;

      // Validate the custom configuration to get errors and warnings
      const manager = new ConfigurationManager(this.options.projectPath);
      const validationResult = manager.validateConfiguration(customConfig);

      const source = this.createSource(
        customConfig,
        true,
        validationResult.errors,
        validationResult.warnings,
        this.customConfigPath
      );

      return this.createSuccessResult(source);
    } catch (error: unknown) {
      return this.createFailureResult(
        `Failed to load custom configuration: ${(error as Error).message}`,
        this.customConfigPath
      );
    }
  }

  /**
   * Check if custom file configuration is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      await fs.access(this.customConfigPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get description of this loader
   */
  getDescription(): string {
    return `Custom configuration file (${this.customConfigPath})`;
  }
}
