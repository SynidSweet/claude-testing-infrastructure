#!/usr/bin/env node

/**
 * Migrate Configuration Script
 * 
 * Migrates configuration files between different versions of the decoupled testing suite.
 * Ensures backward compatibility and smooth transitions.
 */

const path = require('path');
const fs = require('fs').promises;
const chalk = require('chalk');
const { Command } = require('commander');
const semver = require('semver');
const { ConfigManager } = require('../core/config/config-manager');

const program = new Command();

program
  .name('migrate-config')
  .description('Migrate configuration between versions')
  .option('-c, --config-dir <path>', 'Test configuration directory', './test-config')
  .option('-v, --verbose', 'Verbose output')
  .option('--from <version>', 'Source version to migrate from')
  .option('--to <version>', 'Target version to migrate to')
  .option('--backup', 'Create backup before migration')
  .option('--dry-run', 'Show migration plan without executing')
  .parse();

const options = program.opts();

// Migration definitions
const MIGRATIONS = {
  '1.0.0': {
    to: '1.1.0',
    description: 'Add performance and security testing options',
    transform: migrateFrom1_0_0
  },
  '1.1.0': {
    to: '1.2.0',
    description: 'Add advanced coverage configuration',
    transform: migrateFrom1_1_0
  }
};

async function main() {
  try {
    console.log(chalk.blue('🔄 Starting configuration migration...'));
    
    const configDir = path.resolve(options.configDir);
    
    // Load existing configuration
    const configManager = new ConfigManager(configDir);
    let config;
    
    try {
      config = await configManager.loadConfig();
    } catch (error) {
      throw new Error(`Cannot load configuration: ${error.message}`);
    }
    
    const currentVersion = config.version || '1.0.0';
    const targetVersion = options.to || getLatestSupportedVersion();
    
    if (options.verbose) {
      console.log(chalk.gray(`Current version: ${currentVersion}`));
      console.log(chalk.gray(`Target version: ${targetVersion}`));
    }
    
    // Check if migration is needed
    if (semver.gte(currentVersion, targetVersion)) {
      console.log(chalk.green('✅ Configuration is already up to date!'));
      return;
    }
    
    // Plan migration path
    const migrationPath = planMigrationPath(currentVersion, targetVersion);
    
    if (migrationPath.length === 0) {
      throw new Error(`No migration path found from ${currentVersion} to ${targetVersion}`);
    }
    
    // Show migration plan
    console.log(chalk.blue('\n📋 Migration Plan:'));
    console.log('─'.repeat(40));
    migrationPath.forEach((step, index) => {
      console.log(`${index + 1}. ${step.from} → ${step.to}: ${step.description}`);
    });
    
    if (options.dryRun) {
      console.log('\n' + chalk.yellow('This was a dry run. Use without --dry-run to execute migration.'));
      return;
    }
    
    // Create backup if requested
    if (options.backup) {
      await createBackup(config, configDir);
    }
    
    // Execute migration
    let migratedConfig = config;
    
    for (const step of migrationPath) {
      console.log(chalk.yellow(`\n🔄 Migrating ${step.from} → ${step.to}...`));
      migratedConfig = await step.transform(migratedConfig, options);
      console.log(chalk.green(`✅ Migration ${step.from} → ${step.to} completed`));
    }
    
    // Save migrated configuration
    await configManager.saveConfig(migratedConfig);
    
    // Validate migrated configuration
    console.log(chalk.yellow('\n🔍 Validating migrated configuration...'));
    await validateMigratedConfig(migratedConfig, configDir);
    
    console.log(chalk.green('\n✅ Configuration migration completed successfully!'));
    console.log(chalk.blue(`Configuration updated from ${currentVersion} to ${targetVersion}`));
    
  } catch (error) {
    console.error(chalk.red('❌ Migration failed:'));
    console.error(chalk.red(error.message));
    
    if (options.verbose) {
      console.error(chalk.gray(error.stack));
    }
    
    process.exit(1);
  }
}

function getLatestSupportedVersion() {
  const versions = Object.keys(MIGRATIONS).map(v => MIGRATIONS[v].to);
  versions.push(...Object.keys(MIGRATIONS));
  return semver.maxSatisfying(versions, '*');
}

function planMigrationPath(fromVersion, toVersion) {
  const path = [];
  let currentVersion = fromVersion;
  
  while (semver.lt(currentVersion, toVersion)) {
    const migration = MIGRATIONS[currentVersion];
    
    if (!migration) {
      break; // No migration available
    }
    
    path.push({
      from: currentVersion,
      to: migration.to,
      description: migration.description,
      transform: migration.transform
    });
    
    currentVersion = migration.to;
    
    // Prevent infinite loops
    if (path.length > 10) {
      throw new Error('Migration path too long, possible circular dependency');
    }
  }
  
  return path;
}

async function createBackup(config, configDir) {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(configDir, `config.backup.${timestamp}.json`);
    
    console.log(chalk.yellow('📦 Creating configuration backup...'));
    
    await fs.writeFile(backupFile, JSON.stringify(config, null, 2));
    
    console.log(chalk.green(`✅ Backup created: ${path.basename(backupFile)}`));
    
  } catch (error) {
    throw new Error(`Backup creation failed: ${error.message}`);
  }
}

// Migration functions
async function migrateFrom1_0_0(config, options) {
  if (options.verbose) {
    console.log('  Adding performance and security testing options...');
  }
  
  const migrated = JSON.parse(JSON.stringify(config));
  
  // Update version
  migrated.version = '1.1.0';
  
  // Add performance testing configuration
  if (!migrated.testing.performance) {
    migrated.testing.performance = {
      enabled: false,
      budget: {
        size: '100kb',
        time: '2s',
        requests: 10
      },
      tools: ['lighthouse', 'webpack-bundle-analyzer'],
      metrics: ['FCP', 'LCP', 'FID', 'CLS']
    };
  }
  
  // Add security testing configuration
  if (!migrated.testing.security) {
    migrated.testing.security = {
      enabled: false,
      scanDependencies: true,
      scanCode: false,
      tools: config.language === 'python' ? ['bandit', 'safety'] : ['audit', 'eslint-plugin-security'],
      reportLevel: 'high'
    };
  }
  
  // Add new script commands
  if (!migrated.scripts['test:performance']) {
    migrated.scripts['test:performance'] = 'npm run test:run -- --performance';
  }
  
  if (!migrated.scripts['test:security']) {
    migrated.scripts['test:security'] = 'npm run test:run -- --security';
  }
  
  // Update metadata
  migrated.metadata.migrated = true;
  migrated.metadata.migratedAt = new Date().toISOString();
  migrated.metadata.migrationFrom = '1.0.0';
  
  return migrated;
}

async function migrateFrom1_1_0(config, options) {
  if (options.verbose) {
    console.log('  Adding advanced coverage configuration...');
  }
  
  const migrated = JSON.parse(JSON.stringify(config));
  
  // Update version
  migrated.version = '1.2.0';
  
  // Enhance coverage configuration
  if (migrated.testing.coverage) {
    // Add branch-specific thresholds
    if (!migrated.testing.coverage.branches) {
      migrated.testing.coverage.branches = {
        functions: migrated.testing.coverage.threshold,
        lines: migrated.testing.coverage.threshold,
        statements: migrated.testing.coverage.threshold,
        branches: Math.max(70, migrated.testing.coverage.threshold - 10)
      };
    }
    
    // Add exclusion patterns
    if (!migrated.testing.coverage.exclude) {
      migrated.testing.coverage.exclude = [
        '**/node_modules/**',
        '**/test/**',
        '**/tests/**',
        '**/*.test.*',
        '**/*.spec.*',
        '**/coverage/**'
      ];
    }
    
    // Add coverage report options
    if (!migrated.testing.coverage.reports) {
      migrated.testing.coverage.reports = {
        html: true,
        text: true,
        lcov: true,
        json: false,
        cobertura: false
      };
    }
  }
  
  // Add test filtering options
  if (!migrated.testing.filtering) {
    migrated.testing.filtering = {
      tags: {
        enabled: false,
        include: [],
        exclude: []
      },
      patterns: {
        include: migrated.patterns.testFiles,
        exclude: ['**/*.skip.*', '**/*.todo.*']
      }
    };
  }
  
  // Add parallel execution configuration
  if (!migrated.testing.parallel) {
    migrated.testing.parallel = {
      enabled: false,
      workers: 'auto',
      maxWorkers: 4
    };
  }
  
  // Update metadata
  migrated.metadata.migratedAt = new Date().toISOString();
  migrated.metadata.migrationFrom = '1.1.0';
  
  return migrated;
}

async function validateMigratedConfig(config, configDir) {
  try {
    // Basic structure validation
    const requiredFields = ['version', 'projectPath', 'language', 'testing', 'metadata'];
    const missingFields = requiredFields.filter(field => !config[field]);
    
    if (missingFields.length > 0) {
      throw new Error(`Missing required fields after migration: ${missingFields.join(', ')}`);
    }
    
    // Version validation
    if (!semver.valid(config.version)) {
      throw new Error(`Invalid version format: ${config.version}`);
    }
    
    // Test that configuration can be loaded by ConfigManager
    const configManager = new ConfigManager(configDir);
    await configManager.validateConfig(config);
    
    console.log(chalk.green('  ✅ Migrated configuration is valid'));
    
  } catch (error) {
    throw new Error(`Configuration validation failed: ${error.message}`);
  }
}

// Utility functions for migration helpers
function addFieldIfMissing(config, path, defaultValue) {
  const keys = path.split('.');
  let current = config;
  
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (!current[key]) {
      current[key] = {};
    }
    current = current[key];
  }
  
  const finalKey = keys[keys.length - 1];
  if (current[finalKey] === undefined) {
    current[finalKey] = defaultValue;
  }
}

function removeDeprecatedField(config, path) {
  const keys = path.split('.');
  let current = config;
  
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (!current[key]) {
      return; // Path doesn't exist
    }
    current = current[key];
  }
  
  const finalKey = keys[keys.length - 1];
  delete current[finalKey];
}

function renameField(config, oldPath, newPath) {
  const oldKeys = oldPath.split('.');
  const newKeys = newPath.split('.');
  
  // Get the old value
  let current = config;
  for (const key of oldKeys) {
    if (!current[key]) {
      return; // Old path doesn't exist
    }
    current = current[key];
  }
  const value = current;
  
  // Set the new value
  current = config;
  for (let i = 0; i < newKeys.length - 1; i++) {
    const key = newKeys[i];
    if (!current[key]) {
      current[key] = {};
    }
    current = current[key];
  }
  current[newKeys[newKeys.length - 1]] = value;
  
  // Remove the old field
  removeDeprecatedField(config, oldPath);
}

if (require.main === module) {
  main().catch(error => {
    console.error(chalk.red('❌ Unexpected error:'), error.message);
    process.exit(1);
  });
}

module.exports = { 
  main, 
  MIGRATIONS,
  planMigrationPath,
  addFieldIfMissing,
  removeDeprecatedField,
  renameField
};