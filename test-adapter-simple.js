#!/usr/bin/env node

/**
 * Simple test script for the adapter pattern (no external deps)
 */

const path = require('path');
const { adapterFactory, getSupportedLanguages } = require('./shared');

async function main() {
  console.log('🧪 Testing Adapter Pattern Implementation\n');
  
  // Test 1: Supported languages
  console.log('=== Supported Languages ===');
  const languages = getSupportedLanguages();
  console.log('Languages:', languages.join(', '));
  
  // Test 2: Get adapters
  console.log('\n=== Language Adapters ===');
  for (const lang of languages) {
    try {
      const adapter = adapterFactory.getAdapterByLanguage(lang);
      console.log(`${lang}: ${adapter.getSupportedFrameworks().length} frameworks`);
    } catch (error) {
      console.error(`${lang}: ERROR -`, error.message);
    }
  }
  
  // Test 3: Detect current project
  console.log('\n=== Current Directory Detection ===');
  try {
    const adapter = await adapterFactory.getAdapter(__dirname);
    console.log('Detected language:', adapter.getLanguage());
    
    const analysis = await adapter.analyze(__dirname);
    console.log('Project type:', analysis.projectType);
    console.log('Frameworks:', analysis.frameworks.join(', ') || 'none');
  } catch (error) {
    console.error('Detection error:', error.message);
  }
  
  // Test 4: Test specific paths
  console.log('\n=== Testing Specific Paths ===');
  const testPaths = [
    { name: 'ai-testing-template', path: path.join(__dirname, 'ai-testing-template') },
    { name: 'decoupled-testing-suite', path: path.join(__dirname, 'decoupled-testing-suite') }
  ];
  
  for (const test of testPaths) {
    console.log(`\nTesting ${test.name}:`);
    try {
      const adapter = await adapterFactory.getAdapter(test.path);
      console.log('- Language:', adapter.getLanguage());
      
      const analysis = await adapter.analyze(test.path);
      console.log('- Type:', analysis.projectType);
      console.log('- Has tests:', analysis.existingTests.hasTests);
    } catch (error) {
      console.error('- Error:', error.message);
    }
  }
  
  console.log('\n✅ Testing completed!');
}

main().catch(error => {
  console.error('\n❌ Test failed:', error);
  process.exit(1);
});