#!/usr/bin/env node

/**
 * Test script to verify the safety mechanism works
 * This will try to spawn a Claude process and see if it's blocked
 */

const { spawn } = require('child_process');

console.log('🧪 Testing Safety Mechanism\n');

// Check current environment
console.log('Environment check:');
console.log(`  DISABLE_HEADLESS_AGENTS: ${process.env.DISABLE_HEADLESS_AGENTS || 'not set'}`);
console.log(`  Current directory: ${process.cwd()}`);
console.log('');

// First, let's test if the recursion prevention check works
console.log('1️⃣ Testing RecursionPreventionValidator...');
try {
  const { RecursionPreventionValidator } = require('./dist/utils/recursion-prevention');
  
  const result = RecursionPreventionValidator.validateNotSelfTarget(process.cwd());
  console.log(`   Result: ${result.isSafe ? '✅ SAFE' : '❌ NOT SAFE'}`);
  if (!result.isSafe) {
    console.log(`   Reason: ${result.reason}`);
  }
  
  const emergencyCheck = RecursionPreventionValidator.emergencyRecursionCheck();
  console.log(`   Emergency check: ${emergencyCheck ? '✅ PASS' : '❌ FAIL'}`);
} catch (error) {
  console.log('   ❌ Error loading recursion prevention:', error.message);
}

console.log('');

// Now test the ClaudeOrchestrator hard stop
console.log('2️⃣ Testing ClaudeOrchestrator hard stop...');
console.log('   Setting DISABLE_HEADLESS_AGENTS=true');
process.env.DISABLE_HEADLESS_AGENTS = 'true';

try {
  const { ClaudeOrchestrator } = require('./dist/ai/ClaudeOrchestrator');
  
  console.log('   Creating orchestrator instance...');
  const orchestrator = new ClaudeOrchestrator({
    maxConcurrent: 1,
    verbose: true
  });
  
  console.log('   ✅ Orchestrator created (warning should have appeared above)');
  
  // Try to process a batch
  console.log('   Attempting to process a test batch...');
  const mockTask = {
    id: 'safety-test-1',
    sourceFile: 'test.js',
    testFile: 'test.test.js',
    prompt: 'Test prompt',
    estimatedTokens: 100,
    estimatedCost: 0.01,
    context: {
      frameworkInfo: { language: 'javascript' },
      missingScenarios: ['test']
    }
  };
  
  orchestrator.processBatch({
    tasks: [mockTask],
    maxConcurrency: 1
  })
    .then(results => {
      console.log('   ❌ UNEXPECTED: Batch processed successfully!');
      console.log('   Results:', results);
    })
    .catch(error => {
      if (error.message.includes('CRITICAL SAFETY STOP TRIGGERED') || 
          error.message.includes('EMERGENCY SHUTDOWN') ||
          error.message.includes('Emergency shutdown triggered')) {
        console.log('   ✅ EXPECTED: Safety mechanism triggered!');
        console.log('   Error type:', error.constructor.name);
        console.log('   Message preview:', error.message.split('.')[0] + '.');
      } else {
        console.log('   ⚠️  Different error:', error.message);
      }
    });
    
} catch (error) {
  console.log('   ❌ Error testing orchestrator:', error.message);
}

console.log('');

// Test manual spawn attempt
console.log('3️⃣ Testing manual Claude spawn attempt...');
console.log('   This simulates what would happen if code tried to spawn Claude directly');
console.log('   (We\'ll use a safe command that exits immediately)');

try {
  // Try to spawn claude with --version (safe, exits immediately)
  const claude = spawn('claude', ['--version'], {
    env: { ...process.env, DISABLE_HEADLESS_AGENTS: 'true' }
  });
  
  console.log('   📝 Process spawned with PID:', claude.pid);
  
  claude.stdout.on('data', (data) => {
    console.log('   stdout:', data.toString().trim());
  });
  
  claude.stderr.on('data', (data) => {
    console.log('   stderr:', data.toString().trim());
  });
  
  claude.on('close', (code) => {
    console.log(`   Process exited with code: ${code}`);
    if (code === 0) {
      console.log('   ✅ Claude CLI is available and working');
    }
  });
  
  claude.on('error', (error) => {
    console.log('   ❌ Spawn error:', error.message);
  });
  
} catch (error) {
  console.log('   ❌ Failed to spawn:', error.message);
}

// Show current Claude processes
console.log('\n4️⃣ Current Claude processes:');
const { execSync } = require('child_process');
try {
  const processes = execSync('ps aux | grep claude | grep -v grep', { encoding: 'utf8' });
  console.log(processes);
} catch (error) {
  console.log('   No Claude processes found');
}