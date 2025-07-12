/**
 * Configuration display utilities for developer debugging
 */

/* eslint-disable no-console */

import chalk from 'chalk';
import type { ConfigurationLoadResult } from '../config/ConfigurationService';
import type { PartialClaudeTestingConfig, ClaudeTestingConfig } from '../types/config';

/**
 * Display configuration sources and resolution details
 */
export function displayConfigurationSources(result: ConfigurationLoadResult): void {
  console.log(chalk.blue('\n🔍 Configuration Resolution Details'));
  console.log(chalk.blue('====================================\n'));

  // Show loading summary
  console.log(chalk.cyan('📊 Summary:'));
  console.log(`  • Sources loaded: ${result.summary.sourcesLoaded}`);
  console.log(`  • Total errors: ${result.summary.totalErrors}`);
  console.log(`  • Total warnings: ${result.summary.totalWarnings}`);
  console.log(
    `  • Valid configuration: ${result.valid ? chalk.green('✓ Yes') : chalk.red('✗ No')}`
  );

  // Show sources in precedence order (reverse to show highest precedence first)
  console.log(chalk.cyan('\n📂 Configuration Sources (in precedence order):'));
  console.log(chalk.gray('  Higher sources override lower sources\n'));

  const reversedSources = [...result.sources].reverse();
  reversedSources.forEach((source, index) => {
    const isLoaded = source.loaded;
    const statusIcon = isLoaded ? chalk.green('✓') : chalk.gray('✗');
    const sourceName = chalk.bold(source.type);
    const path = source.path ? chalk.gray(` (${source.path})`) : '';

    console.log(`  ${index + 1}. ${statusIcon} ${sourceName}${path}`);

    // Show loaded configuration data
    if (isLoaded && source.data && Object.keys(source.data).length > 0) {
      console.log(chalk.gray('     Configuration provided:'));
      // source.data is already typed as PartialClaudeTestingConfig which extends Record<string, unknown>
      displayConfigData(source.data, '       ');
    }

    // Show errors
    if (source.errors.length > 0) {
      console.log(chalk.red('     Errors:'));
      source.errors.forEach((error) => {
        console.log(chalk.red(`       • ${error}`));
      });
    }

    // ConfigurationSource doesn't have warnings property
    // Warnings are at the ConfigurationLoadResult level

    if (index < reversedSources.length - 1) {
      console.log('');
    }
  });

  // Show key resolved values
  console.log(chalk.cyan('\n🎯 Key Resolved Values:'));
  displayKeyValues(result.config);

  // Show all errors and warnings
  if (result.errors.length > 0) {
    console.log(chalk.red('\n❌ All Errors:'));
    result.errors.forEach((error) => {
      console.log(chalk.red(`  • ${error}`));
    });
  }

  if (result.warnings.length > 0) {
    console.log(chalk.yellow('\n⚠️  All Warnings:'));
    result.warnings.forEach((warning) => {
      console.log(chalk.yellow(`  • ${warning}`));
    });
  }

  console.log('');
}

/**
 * Display configuration data with proper formatting
 */
function displayConfigData(data: PartialClaudeTestingConfig, indent: string = ''): void {
  const keys = Object.keys(data);
  const maxKeys = 10; // Limit display to avoid overwhelming output

  keys.slice(0, maxKeys).forEach((key) => {
    // Use type assertion for dynamic key access with proper type guard
    const value = (data as Record<string, unknown>)[key];
    if (value === undefined || value === null) return;

    if (typeof value === 'object' && !Array.isArray(value)) {
      console.log(chalk.gray(`${indent}${key}: {...}`));
    } else if (Array.isArray(value)) {
      console.log(chalk.gray(`${indent}${key}: [${value.length} items]`));
    } else {
      const displayValue =
        typeof value === 'string' && value.length > 50 ? value.substring(0, 47) + '...' : value;
      console.log(chalk.gray(`${indent}${key}: ${String(displayValue)}`));
    }
  });

  if (keys.length > maxKeys) {
    console.log(chalk.gray(`${indent}... and ${keys.length - maxKeys} more`));
  }
}

/**
 * Display key configuration values that developers commonly need
 */
function displayKeyValues(config: ClaudeTestingConfig): void {
  const include = config.include.join(', ') || 'defaults';
  const exclude = config.exclude.join(', ') || 'defaults';
  const coverage = config.coverage.enabled ? 'Yes' : 'No';
  const output = config.output.logLevel ?? 'info';
  const costLimit = config.costLimit !== undefined ? `$${config.costLimit}` : 'None';

  const keyValues = [
    { label: 'Test Framework', value: config.testFramework },
    { label: 'AI Model', value: config.aiModel },
    { label: 'Include Patterns', value: include },
    { label: 'Exclude Patterns', value: exclude },
    { label: 'Coverage Enabled', value: coverage },
    { label: 'Dry Run', value: config.dryRun ? 'Yes' : 'No' },
    { label: 'Cost Limit', value: costLimit },
    { label: 'Log Level', value: output },
  ];

  keyValues.forEach(({ label, value }) => {
    if (value !== undefined) {
      console.log(`  • ${label}: ${chalk.bold(value)}`);
    }
  });
}

/**
 * Create a configuration debug report
 */
export function createConfigDebugReport(result: ConfigurationLoadResult): string {
  const report: string[] = [];

  report.push('=== Configuration Debug Report ===');
  report.push(`Generated at: ${new Date().toISOString()}`);
  report.push('');

  report.push('Summary:');
  report.push(`  Sources loaded: ${result.summary.sourcesLoaded}`);
  report.push(`  Total errors: ${result.summary.totalErrors}`);
  report.push(`  Total warnings: ${result.summary.totalWarnings}`);
  report.push(`  Valid: ${result.valid}`);
  report.push('');

  report.push('Sources (in load order):');
  result.sources.forEach((source) => {
    report.push(`  ${source.type}:`);
    report.push(`    Loaded: ${source.loaded}`);
    if (source.path) report.push(`    Path: ${source.path}`);
    if (source.errors.length > 0) {
      report.push(`    Errors: ${source.errors.length}`);
      source.errors.forEach((err) => report.push(`      - ${err}`));
    }
    // ConfigurationSource doesn't have warnings property
    if (source.data) {
      report.push(`    Data keys: ${Object.keys(source.data).join(', ')}`);
    }
    report.push('');
  });

  report.push('Resolved Configuration:');
  report.push(JSON.stringify(result.config, null, 2));

  return report.join('\n');
}
