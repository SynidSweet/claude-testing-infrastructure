#!/usr/bin/env node

/**
 * Simulate what would happen if a test tried to spawn Claude
 * This tests the actual spawn prevention in executeClaudeProcess
 */

console.log('🧪 Testing Claude Process Spawn Prevention\n');

// Set safety environment variable
process.env.DISABLE_HEADLESS_AGENTS = 'true';

console.log('Environment:');
console.log(`  DISABLE_HEADLESS_AGENTS: ${process.env.DISABLE_HEADLESS_AGENTS}`);
console.log(`  Current directory: ${process.cwd()}`);
console.log('');

async function testSpawnPrevention() {
  try {
    // Load the orchestrator
    const { ClaudeOrchestrator } = require('./dist/ai/ClaudeOrchestrator');
    
    console.log('1️⃣ Creating ClaudeOrchestrator...');
    const orchestrator = new ClaudeOrchestrator({
      maxConcurrent: 1,
      verbose: true,
      gracefulDegradation: false  // Disable graceful degradation to force real spawn attempt
    });
    
    console.log('   ✅ Orchestrator created\n');
    
    // Create a more realistic task
    const task = {
      id: 'spawn-test-1',
      sourceFile: '/tmp/test-file.js',
      testFile: '/tmp/test-file.test.js',
      prompt: 'Generate a test for this function',
      estimatedTokens: 100,
      estimatedCost: 0.01,
      context: {
        frameworkInfo: { 
          language: 'javascript',
          testFramework: 'jest'
        },
        missingScenarios: ['should handle edge cases']
      }
    };
    
    console.log('2️⃣ Attempting to process task...');
    console.log(`   Task: ${task.id}`);
    console.log(`   Source: ${task.sourceFile}`);
    console.log('');
    
    // Override the emergency recursion check to allow the test to proceed
    // This simulates what would happen if recursion check passed but DISABLE_HEADLESS_AGENTS is set
    const { RecursionPreventionValidator } = require('./dist/utils/recursion-prevention');
    const originalCheck = RecursionPreventionValidator.emergencyRecursionCheck;
    RecursionPreventionValidator.emergencyRecursionCheck = () => true;  // Force pass
    
    // Also mock the authentication check to get to the spawn prevention
    orchestrator.validateClaudeAuth = () => ({ authenticated: true });
    
    try {
      const results = await orchestrator.processBatch({
        tasks: [task],
        maxConcurrency: 1
      });
      
      console.log('   Task batch completed, checking results...');
      
      if (results.length > 0 && results[0].success === false && 
          results[0].error.includes('CRITICAL SAFETY STOP TRIGGERED')) {
        console.log('   ✅ EXPECTED: Task failed with safety stop!');
        console.log('   Success: false ✓');
        console.log('   Error contains safety message: Yes ✓');
        console.log('   Task ID matches:', results[0].taskId === task.id ? 'Yes ✓' : 'No ✗');
      } else {
        console.log('   ❌ UNEXPECTED: Different result');
        console.log('   Results:', JSON.stringify(results, null, 2));
      }
      
    } catch (error) {
      if (error.message.includes('CRITICAL SAFETY STOP TRIGGERED')) {
        console.log('   ✅ EXPECTED: Hard stop triggered in executeClaudeProcess!');
        console.log('   This confirms the spawn prevention is working.');
        console.log('');
        console.log('   Error details:');
        console.log('   - Type:', error.constructor.name);
        console.log('   - Contains task ID:', error.message.includes(task.id) ? 'Yes ✓' : 'No ✗');
        console.log('   - Contains source file:', error.message.includes(task.sourceFile) ? 'Yes ✓' : 'No ✗');
      } else {
        console.log('   ⚠️  Different error:', error.message);
      }
    } finally {
      // Restore original check
      RecursionPreventionValidator.emergencyRecursionCheck = originalCheck;
    }
    
  } catch (error) {
    console.log('❌ Setup error:', error.message);
  }
}

// Run the test
testSpawnPrevention().then(() => {
  console.log('\n✅ Test completed');
}).catch(error => {
  console.log('\n❌ Test failed:', error.message);
});