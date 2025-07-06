#!/usr/bin/env node

/**
 * Safe test checker - identifies which test files might spawn processes
 * Run this before running full test suite to identify risky tests
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔍 Scanning for tests that might spawn processes...\n');

// Set safety environment variable
process.env.DISABLE_HEADLESS_AGENTS = 'true';

// Patterns that indicate a test might spawn processes
const riskyPatterns = [
  /spawn\s*\(/,
  /execSync\s*\(/,
  /exec\s*\(/,
  /ClaudeOrchestrator/,
  /processBatch/,
  /executeClaudeCommand/,
  /executeClaudeProcess/,
  /JestRunner/,
  /runTests/,
  /ProcessMonitor/
];

// Find all test files
function findTestFiles(dir) {
  const files = [];
  
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      // Skip node_modules and dist
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git') {
        continue;
      }
      
      if (entry.isDirectory()) {
        files.push(...findTestFiles(fullPath));
      } else if (entry.name.match(/\.(test|spec)\.(js|ts)$/)) {
        files.push(fullPath);
      }
    }
  } catch (error) {
    // Ignore permission errors
  }
  
  return files;
}

// Check a test file for risky patterns
function checkTestFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const risks = [];
    
    riskyPatterns.forEach(pattern => {
      if (pattern.test(content)) {
        const matches = content.match(new RegExp(pattern.source, 'g')) || [];
        risks.push({
          pattern: pattern.source,
          count: matches.length
        });
      }
    });
    
    return risks;
  } catch (error) {
    return [];
  }
}

// Main execution
const testFiles = findTestFiles('.');
console.log(`Found ${testFiles.length} test files\n`);

const riskyTests = [];

testFiles.forEach(file => {
  const risks = checkTestFile(file);
  if (risks.length > 0) {
    riskyTests.push({
      file: file.replace(process.cwd() + '/', ''),
      risks
    });
  }
});

// Report findings
if (riskyTests.length === 0) {
  console.log('✅ No risky test patterns found!');
} else {
  console.log(`⚠️  Found ${riskyTests.length} test files with process-spawning patterns:\n`);
  
  riskyTests.forEach(test => {
    console.log(`📄 ${test.file}`);
    test.risks.forEach(risk => {
      console.log(`   - ${risk.pattern} (${risk.count} occurrences)`);
    });
    console.log('');
  });
  
  console.log('\n🛡️  Safety Recommendations:');
  console.log('1. Run tests with DISABLE_HEADLESS_AGENTS=true');
  console.log('2. Use --testPathIgnorePatterns to skip risky tests');
  console.log('3. Run risky tests individually with monitoring');
  
  // Generate a safe test command
  const skipPatterns = riskyTests
    .filter(test => test.file.includes('ClaudeOrchestrator') || test.file.includes('ai/'))
    .map(test => test.file)
    .join('|');
    
  if (skipPatterns) {
    console.log('\n📝 Safe test command (skips AI-related tests):');
    console.log(`DISABLE_HEADLESS_AGENTS=true npm test -- --testPathIgnorePatterns="${skipPatterns}"`);
  }
}

// Check if we're currently in the infrastructure directory
const cwd = process.cwd();
const packageJson = path.join(cwd, 'package.json');

if (fs.existsSync(packageJson)) {
  try {
    const pkg = JSON.parse(fs.readFileSync(packageJson, 'utf8'));
    if (pkg.name === 'claude-testing-infrastructure') {
      console.log('\n🚨 WARNING: You are in the infrastructure directory!');
      console.log('   Testing the infrastructure on itself can cause recursive spawning.');
      console.log('   Make sure DISABLE_HEADLESS_AGENTS=true is set!\n');
    }
  } catch (error) {
    // Ignore
  }
}