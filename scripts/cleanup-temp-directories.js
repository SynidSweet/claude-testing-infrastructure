#!/usr/bin/env node

/**
 * Cleanup Temporary Directories Script
 * 
 * Automatically removes temporary test directories that can accumulate during
 * test runs and cause Jest haste-map duplicate mock warnings.
 * 
 * Usage:
 *   node scripts/cleanup-temp-directories.js [--dry-run] [--age-hours=24]
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const DEFAULT_AGE_HOURS = 24;
const TEMP_PATTERNS = [
  '.temp-test-projects',
  '.temp-fixtures',
  '.temp-test-timeout',
  '.claude-testing-fixtures-*'
];

function parseArgs() {
  const args = process.argv.slice(2);
  const config = {
    dryRun: false,
    ageHours: DEFAULT_AGE_HOURS,
    verbose: false
  };

  for (const arg of args) {
    if (arg === '--dry-run') {
      config.dryRun = true;
    } else if (arg === '--verbose') {
      config.verbose = true;
    } else if (arg.startsWith('--age-hours=')) {
      config.ageHours = parseInt(arg.split('=')[1], 10);
    } else if (arg === '--help') {
      console.log(`
Usage: node scripts/cleanup-temp-directories.js [options]

Options:
  --dry-run          Show what would be deleted without actually deleting
  --age-hours=N      Only delete directories older than N hours (default: 24)
  --verbose          Show detailed information about each directory
  --help             Show this help message

Examples:
  node scripts/cleanup-temp-directories.js --dry-run
  node scripts/cleanup-temp-directories.js --age-hours=6
  node scripts/cleanup-temp-directories.js --verbose
      `);
      process.exit(0);
    }
  }

  return config;
}

function isOlderThan(dirPath, ageHours) {
  try {
    const stats = fs.statSync(dirPath);
    const ageMs = Date.now() - stats.mtime.getTime();
    const ageHoursActual = ageMs / (1000 * 60 * 60);
    return ageHoursActual > ageHours;
  } catch (error) {
    return false; // If we can't stat it, don't delete it
  }
}

function getDirectorySize(dirPath) {
  try {
    const result = execSync(`du -sh "${dirPath}" 2>/dev/null | cut -f1`, { encoding: 'utf8' });
    return result.trim();
  } catch (error) {
    return 'unknown';
  }
}

function findTempDirectories() {
  const tempDirs = [];
  
  for (const pattern of TEMP_PATTERNS) {
    if (pattern.includes('*')) {
      // Handle glob patterns
      try {
        const basePattern = pattern.replace('*', '');
        const files = fs.readdirSync('.');
        for (const file of files) {
          if (file.startsWith(basePattern) && fs.statSync(file).isDirectory()) {
            tempDirs.push(file);
          }
        }
      } catch (error) {
        // Pattern not found, continue
      }
    } else {
      // Handle exact directory names
      if (fs.existsSync(pattern) && fs.statSync(pattern).isDirectory()) {
        tempDirs.push(pattern);
      }
    }
  }
  
  return tempDirs;
}

function cleanupDirectories(config) {
  const tempDirs = findTempDirectories();
  
  if (tempDirs.length === 0) {
    console.log('✅ No temporary directories found.');
    return;
  }

  console.log(`Found ${tempDirs.length} temporary directories:`);
  
  let deletedCount = 0;
  let deletedSize = 0;
  let skippedCount = 0;

  for (const dir of tempDirs) {
    const dirPath = path.resolve(dir);
    const size = getDirectorySize(dirPath);
    const age = isOlderThan(dirPath, config.ageHours);
    
    if (config.verbose) {
      const stats = fs.statSync(dirPath);
      const ageHours = Math.round((Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60));
      console.log(`  ${dir}: ${size}, ${ageHours}h old`);
    }

    if (!age) {
      if (config.verbose) {
        console.log(`    ⏰ Skipping ${dir} (too recent)`);
      }
      skippedCount++;
      continue;
    }

    if (config.dryRun) {
      console.log(`  🗑️  Would delete: ${dir} (${size})`);
    } else {
      try {
        fs.rmSync(dirPath, { recursive: true, force: true });
        console.log(`  ✅ Deleted: ${dir} (${size})`);
        deletedCount++;
      } catch (error) {
        console.log(`  ❌ Failed to delete ${dir}: ${error.message}`);
      }
    }
  }

  if (config.dryRun) {
    console.log(`\n📊 Dry run complete: ${tempDirs.length - skippedCount} directories would be deleted, ${skippedCount} skipped.`);
  } else {
    console.log(`\n📊 Cleanup complete: ${deletedCount} directories deleted, ${skippedCount} skipped.`);
  }
}

function main() {
  const config = parseArgs();
  
  console.log('🧹 Claude Testing Infrastructure - Temporary Directory Cleanup');
  console.log(`Configuration: age-threshold=${config.ageHours}h, dry-run=${config.dryRun}\n`);
  
  cleanupDirectories(config);
  
  // Additional cleanup suggestions
  console.log('\n💡 Recommendations:');
  console.log('  - Run this script periodically to prevent accumulation');
  console.log('  - Add to your CI/CD pipeline for automated cleanup');
  console.log('  - Consider adding to package.json scripts for easy access');
}

if (require.main === module) {
  main();
}

module.exports = { cleanupDirectories, findTempDirectories };