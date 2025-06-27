#!/usr/bin/env node

/**
 * Test script for the new adapter pattern implementation
 */

const path = require('path');
const chalk = require('chalk');
const { adapterFactory, getSupportedLanguages } = require('./shared');

async function testAdapterDetection() {
  console.log(chalk.blue('\n=== Testing Adapter Detection ===\n'));
  
  // Test paths
  const testPaths = [
    {
      name: 'Template-based approach',
      path: path.join(__dirname, 'ai-testing-template')
    },
    {
      name: 'Decoupled approach', 
      path: path.join(__dirname, 'decoupled-testing-suite')
    },
    {
      name: 'Current directory',
      path: __dirname
    }
  ];

  for (const test of testPaths) {
    console.log(chalk.yellow(`\nTesting: ${test.name}`));
    console.log(chalk.gray(`Path: ${test.path}`));
    
    try {
      // Get adapter
      const adapter = await adapterFactory.getAdapter(test.path);
      console.log(chalk.green(`✓ Detected language: ${adapter.getLanguage()}`));
      
      // Analyze project
      const analysis = await adapter.analyze(test.path);
      console.log(chalk.green(`✓ Project type: ${analysis.projectType}`));
      console.log(chalk.green(`✓ Frameworks: ${analysis.frameworks.join(', ') || 'none'}`));
      
      // Validate project
      const validation = await adapter.validate(test.path);
      console.log(chalk.green(`✓ Valid: ${validation.valid}`));
      if (validation.warnings.length > 0) {
        console.log(chalk.yellow(`  Warnings: ${validation.warnings.length}`));
      }
      
    } catch (error) {
      console.log(chalk.red(`✗ Error: ${error.message}`));
    }
  }
}

async function testLanguageAdapters() {
  console.log(chalk.blue('\n\n=== Testing Individual Language Adapters ===\n'));
  
  const languages = getSupportedLanguages();
  console.log(chalk.green(`Supported languages: ${languages.join(', ')}`));
  
  for (const language of languages) {
    console.log(chalk.yellow(`\n${language.toUpperCase()} Adapter:`));
    
    try {
      const adapter = adapterFactory.getAdapterByLanguage(language);
      const frameworks = adapter.getSupportedFrameworks();
      console.log(chalk.green(`✓ Supported frameworks: ${frameworks.length}`));
      console.log(chalk.gray(`  ${frameworks.slice(0, 5).join(', ')}${frameworks.length > 5 ? '...' : ''}`));
    } catch (error) {
      console.log(chalk.red(`✗ Error: ${error.message}`));
    }
  }
}

async function testBackwardCompatibility() {
  console.log(chalk.blue('\n\n=== Testing Backward Compatibility ===\n'));
  
  try {
    // Test the compatibility wrapper
    const FileSystemAnalyzer = require('./ai-testing-template/scripts/utils/fileSystemAdapter');
    const analyzer = new FileSystemAnalyzer(path.join(__dirname, 'ai-testing-template'));
    
    console.log(chalk.yellow('Testing sync methods (backward compatibility):'));
    
    // Test sync detection
    const jsResult = analyzer.detectJavaScriptProject();
    console.log(chalk.green(`✓ JavaScript detection (sync): ${jsResult.isJavaScript}`));
    
    const pyResult = analyzer.detectPythonProject();
    console.log(chalk.green(`✓ Python detection (sync): ${pyResult.isPython}`));
    
    // Test sync analysis
    const analysis = analyzer.analyzeProject();
    console.log(chalk.green(`✓ Project analysis (sync): ${analysis.isEmpty ? 'empty' : 'has code'}`));
    
    console.log(chalk.yellow('\nTesting async methods (new features):'));
    
    // Test async methods
    const asyncAnalysis = await analyzer.analyzeProject();
    console.log(chalk.green(`✓ Project analysis (async): ${asyncAnalysis.adapter ? 'adapter detected' : 'no adapter'}`));
    
    if (asyncAnalysis.adapter) {
      const config = await analyzer.getTestConfiguration();
      console.log(chalk.green(`✓ Test configuration: ${config.testRunner} runner`));
      
      const deps = await analyzer.getTestDependencies();
      console.log(chalk.green(`✓ Dependencies: ${deps.required.length} required`));
    }
    
  } catch (error) {
    console.log(chalk.red(`✗ Error: ${error.message}`));
    console.log(chalk.gray(error.stack));
  }
}

async function main() {
  console.log(chalk.bold.blue('🧪 Testing Adapter Pattern Implementation\n'));
  
  await testAdapterDetection();
  await testLanguageAdapters();
  await testBackwardCompatibility();
  
  console.log(chalk.bold.green('\n\n✅ Testing completed!\n'));
}

// Run tests
main().catch(error => {
  console.error(chalk.red('\n❌ Test failed:'), error);
  process.exit(1);
});