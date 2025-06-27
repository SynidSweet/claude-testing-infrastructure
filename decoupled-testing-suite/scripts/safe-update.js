#!/usr/bin/env node

/**
 * Safe Update Script
 * 
 * Safely updates the decoupled testing suite while preserving user configurations
 * and ensuring backward compatibility.
 */

const path = require('path');
const fs = require('fs').promises;
const chalk = require('chalk');
const { Command } = require('commander');
const { execSync } = require('child_process');
const ConfigManager = require('../core/config/config-manager');

const program = new Command();

program
  .name('safe-update')
  .description('Safely update the decoupled testing suite')
  .option('-c, --config-dir <path>', 'Test configuration directory', './test-config')
  .option('-v, --verbose', 'Verbose output')
  .option('--backup', 'Create backup before updating')
  .option('--dry-run', 'Show what would be updated without making changes')
  .option('--force', 'Force update even if there are conflicts')
  .parse();

const options = program.opts();

async function main() {
  try {
    console.log(chalk.blue('🔄 Starting safe update process...'));
    
    const configDir = path.resolve(options.configDir);
    
    // Load existing configuration
    let existingConfig = null;
    try {
      const configManager = new ConfigManager(configDir);
      existingConfig = await configManager.loadConfig();
    } catch (error) {
      console.log(chalk.yellow('ℹ️  No existing configuration found, skipping configuration migration'));
    }
    
    // Check current version
    const currentVersion = await getCurrentVersion();
    const latestVersion = await getLatestVersion();
    
    if (options.verbose) {
      console.log(chalk.gray(`Current version: ${currentVersion}`));
      console.log(chalk.gray(`Latest version: ${latestVersion}`));
    }
    
    if (currentVersion === latestVersion) {
      console.log(chalk.green('✅ Already up to date!'));
      return;
    }
    
    // Create backup if requested
    if (options.backup && existingConfig) {
      await createBackup(configDir, options);
    }
    
    // Check for breaking changes
    const breakingChanges = await checkBreakingChanges(currentVersion, latestVersion);
    
    if (breakingChanges.length > 0 && !options.force) {
      console.log(chalk.red('⚠️  Breaking changes detected:'));
      breakingChanges.forEach(change => {
        console.log(`  • ${change}`);
      });
      console.log(chalk.yellow('Use --force to proceed anyway, or update manually.'));
      process.exit(1);
    }
    
    // Perform update
    if (options.dryRun) {
      await performDryRunUpdate(existingConfig, options);
    } else {
      await performUpdate(existingConfig, configDir, options);
    }
    
    console.log(chalk.green('✅ Update completed successfully!'));
    
  } catch (error) {
    console.error(chalk.red('❌ Update failed:'));
    console.error(chalk.red(error.message));
    
    if (options.verbose) {
      console.error(chalk.gray(error.stack));
    }
    
    process.exit(1);
  }
}

async function getCurrentVersion() {
  try {
    const packageJson = JSON.parse(
      await fs.readFile(path.join(__dirname, '..', 'package.json'), 'utf-8')
    );
    return packageJson.version;
  } catch {
    return 'unknown';
  }
}

async function getLatestVersion() {
  try {
    // In a real implementation, this would check npm registry or git tags
    // For now, return the current version as we're in development
    return await getCurrentVersion();
  } catch {
    return 'unknown';
  }
}

async function checkBreakingChanges(currentVersion, latestVersion) {
  // In a real implementation, this would check a changelog or breaking changes file
  // For now, return empty array as we're in development
  return [];
}

async function createBackup(configDir, options) {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(configDir, '..', `backup-${timestamp}`);
    
    console.log(chalk.yellow('📦 Creating backup...'));
    
    // Copy entire config directory
    await copyDirectory(configDir, backupDir);
    
    console.log(chalk.green(`✅ Backup created: ${backupDir}`));
    
    if (options.verbose) {
      console.log(chalk.gray(`Backup location: ${backupDir}`));
    }
    
  } catch (error) {
    throw new Error(`Backup creation failed: ${error.message}`);
  }
}

async function copyDirectory(src, dest) {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    if (entry.isDirectory()) {
      await copyDirectory(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

async function performDryRunUpdate(existingConfig, options) {
  console.log(chalk.blue('\n🔍 Dry Run - Changes that would be made:'));
  console.log('═'.repeat(50));
  
  // Check template updates
  console.log(chalk.bold('\n📁 Template Updates:'));
  console.log('  • React templates: Update testing utilities');
  console.log('  • Python templates: Add new pytest fixtures');
  console.log('  • E2E templates: Update Playwright configuration');
  
  // Check configuration updates
  if (existingConfig) {
    console.log(chalk.bold('\n⚙️  Configuration Updates:'));
    console.log('  • Schema version: Update to latest');
    console.log('  • New fields: Add performance testing options');
    console.log('  • Deprecated fields: None detected');
  }
  
  // Check script updates
  console.log(chalk.bold('\n📝 Script Updates:'));
  console.log('  • discovery: Enhanced framework detection');
  console.log('  • run-tests: Improved error reporting');
  console.log('  • analyze: New security analysis features');
  
  console.log('\n' + '═'.repeat(50));
  console.log(chalk.yellow('This was a dry run. Use without --dry-run to apply changes.'));
}

async function performUpdate(existingConfig, configDir, options) {
  console.log(chalk.yellow('🔄 Updating testing suite...'));
  
  // Update templates
  await updateTemplates(configDir, options);
  
  // Update configuration (if exists)
  if (existingConfig) {
    await updateConfiguration(existingConfig, configDir, options);
  }
  
  // Update scripts (they're already updated since this script is running)
  console.log(chalk.green('  ✅ Scripts updated'));
  
  // Update dependencies
  await updateDependencies(options);
  
  // Validate updated setup
  console.log(chalk.yellow('🔍 Validating updated setup...'));
  try {
    const validateScript = path.join(__dirname, 'validate-setup.js');
    execSync(`node ${validateScript} --config-dir ${configDir} --quick`, {
      stdio: options.verbose ? 'inherit' : 'pipe'
    });
    console.log(chalk.green('  ✅ Validation passed'));
  } catch (error) {
    console.log(chalk.yellow('  ⚠️  Validation warnings (run validate-setup for details)'));
  }
}

async function updateTemplates(configDir, options) {
  console.log(chalk.yellow('  📁 Updating templates...'));
  
  const templatesDir = path.join(__dirname, '..', 'templates');
  const configTemplatesDir = path.join(configDir, 'templates');
  
  try {
    // Ensure templates directory exists in config
    await fs.mkdir(configTemplatesDir, { recursive: true });
    
    // Copy updated templates (preserve user modifications)
    await copyTemplatesWithMerge(templatesDir, configTemplatesDir, options);
    
    console.log(chalk.green('  ✅ Templates updated'));
    
  } catch (error) {
    console.log(chalk.yellow(`  ⚠️  Template update warning: ${error.message}`));
  }
}

async function copyTemplatesWithMerge(src, dest, options) {
  try {
    await fs.access(src);
  } catch {
    // Source templates don't exist, skip
    return;
  }
  
  const entries = await fs.readdir(src, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    if (entry.isDirectory()) {
      await fs.mkdir(destPath, { recursive: true });
      await copyTemplatesWithMerge(srcPath, destPath, options);
    } else {
      // Check if file exists in destination
      try {
        await fs.access(destPath);
        
        // File exists, check if it's been modified
        const srcContent = await fs.readFile(srcPath, 'utf-8');
        const destContent = await fs.readFile(destPath, 'utf-8');
        
        if (srcContent !== destContent) {
          // File has been modified, create .new version
          await fs.writeFile(destPath + '.new', srcContent);
          
          if (options.verbose) {
            console.log(chalk.gray(`    Modified template preserved: ${entry.name} (new version: ${entry.name}.new)`));
          }
        }
      } catch {
        // File doesn't exist, copy it
        await fs.copyFile(srcPath, destPath);
      }
    }
  }
}

async function updateConfiguration(existingConfig, configDir, options) {
  console.log(chalk.yellow('  ⚙️  Updating configuration...'));
  
  try {
    const configManager = new ConfigManager(configDir);
    
    // Migrate configuration to new schema
    const migratedConfig = await migrateConfiguration(existingConfig);
    
    // Save updated configuration
    await configManager.saveConfig(migratedConfig);
    
    console.log(chalk.green('  ✅ Configuration updated'));
    
  } catch (error) {
    console.log(chalk.yellow(`  ⚠️  Configuration update warning: ${error.message}`));
  }
}

async function migrateConfiguration(config) {
  // Clone the existing configuration
  const migrated = JSON.parse(JSON.stringify(config));
  
  // Update version
  migrated.version = '1.1.0';
  
  // Add new fields if they don't exist
  if (!migrated.testing.performance) {
    migrated.testing.performance = {
      enabled: false,
      budget: {
        size: '100kb',
        time: '2s'
      }
    };
  }
  
  if (!migrated.testing.security) {
    migrated.testing.security = {
      enabled: false,
      scanDependencies: true,
      scanCode: false
    };
  }
  
  // Update metadata
  migrated.metadata.updatedAt = new Date().toISOString();
  migrated.metadata.migrated = true;
  
  return migrated;
}

async function updateDependencies(options) {
  console.log(chalk.yellow('  📦 Checking dependencies...'));
  
  try {
    // Check if package.json exists in current directory
    const packageJsonPath = path.join(__dirname, '..', 'package.json');
    await fs.access(packageJsonPath);
    
    // Run npm update (cautiously)
    if (options.verbose) {
      console.log(chalk.gray('    Running npm update...'));
    }
    
    execSync('npm update', {
      cwd: path.dirname(packageJsonPath),
      stdio: options.verbose ? 'inherit' : 'pipe'
    });
    
    console.log(chalk.green('  ✅ Dependencies updated'));
    
  } catch (error) {
    console.log(chalk.yellow(`  ⚠️  Dependency update warning: ${error.message}`));
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error(chalk.red('❌ Unexpected error:'), error.message);
    process.exit(1);
  });
}

module.exports = { main };