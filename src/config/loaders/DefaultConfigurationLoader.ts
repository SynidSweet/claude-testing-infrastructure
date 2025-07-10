/**
 * Default configuration loader
 *
 * Loads the default configuration values that serve as the base
 * for all other configuration sources.
 */

import { DEFAULT_CONFIG } from '../../types/config';
import {
  BaseConfigurationSourceLoader,
  ConfigurationSourceType,
  type ConfigurationSourceLoadResult,
} from './ConfigurationSourceLoader';

/**
 * Loader for default configuration values
 */
export class DefaultConfigurationLoader extends BaseConfigurationSourceLoader {
  readonly sourceType = ConfigurationSourceType.DEFAULTS;

  /**
   * Load default configuration
   */
  async load(): Promise<ConfigurationSourceLoadResult> {
    const source = this.createSource(DEFAULT_CONFIG);
    return this.createSuccessResult(source);
  }

  /**
   * Default configuration is always available
   */
  async isAvailable(): Promise<boolean> {
    return true;
  }

  /**
   * Get description of this loader
   */
  getDescription(): string {
    return 'Default configuration values';
  }
}