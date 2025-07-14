#!/usr/bin/env node

/**
 * Fix CLI Path Documentation Script
 * 
 * This script corrects all incorrect CLI path references from:
 * dist/src/cli/index.js → dist/src/cli/index.js
 * 
 * Created as part of DOC-CLI-001 task
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PROJECT_ROOT = path.resolve(__dirname, '..');

console.log('🔧 CLI Path Documentation Fix Script');
console.log('=====================================');

/**
 * Find all files with incorrect CLI path references
 */
function findFilesWithIncorrectPaths() {
    console.log('\n📋 Step 1: Finding files with incorrect CLI paths...');
    
    try {
        // Use ripgrep to find all files with the incorrect path
        const output = execSync(
            'rg --files-with-matches "dist/cli/index\\.js" --type-not lock', 
            { 
                cwd: PROJECT_ROOT, 
                encoding: 'utf8',
                stdio: ['ignore', 'pipe', 'ignore'] // Suppress stderr
            }
        );
        
        const files = output.trim().split('\n').filter(file => file.length > 0);
        console.log(`   Found ${files.length} files with incorrect CLI paths`);
        
        return files;
    } catch (error) {
        if (error.status === 1) {
            // ripgrep returns exit code 1 when no matches found
            console.log('   ✅ No files found with incorrect CLI paths');
            return [];
        }
        throw error;
    }
}

/**
 * Create backup of files before modification
 */
function createBackups(files) {
    console.log('\n💾 Step 2: Creating backups...');
    const backupDir = path.join(PROJECT_ROOT, '.cli-path-fix-backups');
    
    if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
    }
    
    files.forEach(file => {
        const filePath = path.join(PROJECT_ROOT, file);
        const backupPath = path.join(backupDir, file.replace(/\//g, '_'));
        
        if (fs.existsSync(filePath)) {
            fs.copyFileSync(filePath, backupPath);
        }
    });
    
    console.log(`   ✅ Created backups in ${backupDir}`);
}

/**
 * Fix CLI paths in a single file
 */
function fixFileCliPaths(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Replace all instances of the incorrect path
    const updatedContent = content.replace(
        /dist\/cli\/index\.js/g,
        'dist/src/cli/index.js'
    );
    
    // Count how many replacements were made
    const oldMatches = content.match(/dist\/cli\/index\.js/g) || [];
    const newMatches = updatedContent.match(/dist\/src\/cli\/index\.js/g) || [];
    const replacementCount = oldMatches.length;
    
    if (replacementCount > 0) {
        fs.writeFileSync(filePath, updatedContent, 'utf8');
        return replacementCount;
    }
    
    return 0;
}

/**
 * Apply fixes to all identified files
 */
function applyFixes(files) {
    console.log('\n🔨 Step 3: Applying CLI path fixes...');
    
    let totalReplacements = 0;
    let filesModified = 0;
    
    files.forEach(file => {
        const filePath = path.join(PROJECT_ROOT, file);
        
        if (fs.existsSync(filePath)) {
            const replacements = fixFileCliPaths(filePath);
            if (replacements > 0) {
                console.log(`   ✅ ${file}: ${replacements} replacement(s)`);
                totalReplacements += replacements;
                filesModified++;
            }
        } else {
            console.log(`   ⚠️  ${file}: File not found, skipping`);
        }
    });
    
    console.log(`\n📊 Summary:`);
    console.log(`   Files modified: ${filesModified}`);
    console.log(`   Total replacements: ${totalReplacements}`);
}

/**
 * Verify the fixes worked correctly
 */
function verifyFixes() {
    console.log('\n✅ Step 4: Verifying fixes...');
    
    try {
        // Check if any files still have the old path
        const output = execSync(
            'rg --files-with-matches "dist/cli/index\\.js" --type-not lock', 
            { 
                cwd: PROJECT_ROOT, 
                encoding: 'utf8',
                stdio: ['ignore', 'pipe', 'ignore']
            }
        );
        
        const remainingFiles = output.trim().split('\n').filter(file => file.length > 0);
        
        if (remainingFiles.length > 0) {
            console.log(`   ⚠️  ${remainingFiles.length} files still have incorrect paths:`);
            remainingFiles.forEach(file => console.log(`      - ${file}`));
            return false;
        }
    } catch (error) {
        if (error.status === 1) {
            // No matches found - this is what we want
            console.log('   ✅ No files with incorrect CLI paths found');
            return true;
        }
        throw error;
    }
    
    return true;
}

/**
 * Clean up backup files after successful verification
 */
function cleanupBackups() {
    console.log('\n🧹 Step 5: Cleaning up backups...');
    
    const backupDir = path.join(PROJECT_ROOT, '.cli-path-fix-backups');
    
    if (fs.existsSync(backupDir)) {
        fs.rmSync(backupDir, { recursive: true, force: true });
        console.log('   ✅ Backup files cleaned up');
    }
}

/**
 * Main execution function
 */
function main() {
    try {
        // Step 1: Find files with incorrect paths
        const filesToFix = findFilesWithIncorrectPaths();
        
        if (filesToFix.length === 0) {
            console.log('\n🎉 All CLI paths are already correct!');
            return;
        }
        
        // Step 2: Create backups
        createBackups(filesToFix);
        
        // Step 3: Apply fixes
        applyFixes(filesToFix);
        
        // Step 4: Verify fixes
        const verified = verifyFixes();
        
        if (verified) {
            // Step 5: Clean up backups
            cleanupBackups();
            console.log('\n🎉 CLI path fix completed successfully!');
        } else {
            console.log('\n❌ Fix verification failed. Backups preserved for investigation.');
            console.log('   Backup location: .cli-path-fix-backups/');
        }
        
    } catch (error) {
        console.error('\n❌ Error during CLI path fix:', error.message);
        console.log('   Backups preserved for safety.');
        process.exit(1);
    }
}

// Execute the script
main();