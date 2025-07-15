/**
 * CLI utilities index
 *
 * Centralized exports for standardized CLI utilities
 */

// Configuration loading utilities
export {
  loadStandardConfiguration,
  getParentOptions,
  createConfigurationService,
  validateCliOptions,
  applyConfigToLogger,
  loadCommandConfig, // Legacy compatibility
  type StandardCliOptions,
  type ParentCommandOptions,
  type StandardConfigResult,
  type ConfigLoadOptions,
} from './config-loader';

// Error handling utilities
export {
  handleConfigurationError,
  handleValidationError,
  handleFileOperationError,
  handleArgumentValidationError,
  executeCLICommand,
  createCLIError,
  CLIErrorType,
  type StandardCLIErrorContext,
  type CLIErrorHandlingOptions,
} from './error-handler';

// Command execution patterns
export {
  executeCommand,
  executeConfigCommand,
  executeValidationCommand,
  executeFileCommand,
  simpleCommand,
  analysisCommand,
  generationCommand,
  createCommandOptions,
  validateProjectPath,
  getCommandSpinner,
  type CommandContext,
  type CommandExecutionOptions,
  type CommandExecutionResult,
} from './command-patterns';
