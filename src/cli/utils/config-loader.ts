/**
 * Shared configuration loading utility for CLI commands
 */

import { ConfigurationService } from '../../config/ConfigurationService';
import { ClaudeTestingConfig } from '../../types/config';
import { displayConfigurationSources } from '../../utils/config-display';
import { logger } from '../../utils/logger';
import chalk from 'chalk';

interface LoadConfigOptions {
  projectPath: string;
  customConfigPath?: string;
  cliArgs?: Record<string, any>;
  showConfigSources?: boolean;
}

/**
 * Load configuration for a command with optional source display
 */
export async function loadCommandConfig(options: LoadConfigOptions): Promise<ClaudeTestingConfig> {
  const configService = new ConfigurationService({
    projectPath: options.projectPath,
    customConfigPath: options.customConfigPath,
    includeEnvVars: true,
    includeUserConfig: true,
    cliArgs: options.cliArgs || {}
  });
  
  const result = await configService.loadConfiguration();
  
  // Display configuration sources if requested
  if (options.showConfigSources) {
    displayConfigurationSources(result);
  }
  
  // Handle validation errors
  if (!result.valid && result.errors.length > 0) {
    console.error(chalk.red('\n❌ Configuration validation failed:'));
    result.errors.forEach(error => {
      console.error(chalk.red(`  • ${error}`));
    });
    process.exit(1);
  }
  
  // Show warnings even if valid
  if (result.warnings.length > 0) {
    console.warn(chalk.yellow('\n⚠️  Configuration warnings:'));
    result.warnings.forEach(warning => {
      console.warn(chalk.yellow(`  • ${warning}`));
    });
  }
  
  logger.debug('Configuration loaded successfully', {
    sourcesLoaded: result.summary.sourcesLoaded,
    hasErrors: result.summary.totalErrors > 0,
    hasWarnings: result.summary.totalWarnings > 0
  });
  
  return result.config;
}