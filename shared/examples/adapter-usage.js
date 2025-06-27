/**
 * Example: Using the Adapter Pattern
 * 
 * This example demonstrates how to use the new adapter pattern to
 * analyze projects and generate test configurations for different
 * programming languages.
 */

const { adapterFactory, getSupportedLanguages } = require('../');
const path = require('path');

/**
 * Example 1: Detect and analyze a project
 */
async function analyzeProject(projectPath) {
  console.log(`\n=== Analyzing project: ${projectPath} ===\n`);
  
  try {
    // Get the appropriate adapter for the project
    const adapter = await adapterFactory.getAdapter(projectPath);
    console.log(`✓ Detected language: ${adapter.getLanguage()}`);
    console.log(`✓ Supported frameworks: ${adapter.getSupportedFrameworks().join(', ')}`);
    
    // Analyze the project
    const analysis = await adapter.analyze(projectPath);
    console.log('\n📊 Project Analysis:');
    console.log(`  - Project Type: ${analysis.projectType}`);
    console.log(`  - Frameworks: ${analysis.frameworks.join(', ') || 'none'}`);
    console.log(`  - Entry Points: ${analysis.entryPoints.join(', ') || 'none'}`);
    console.log(`  - Has Tests: ${analysis.existingTests.hasTests}`);
    console.log(`  - Test Runner: ${analysis.existingTests.testRunner || 'none'}`);
    
    // Generate test configuration
    const config = await adapter.generateConfiguration(analysis);
    console.log('\n⚙️  Generated Test Configuration:');
    console.log(`  - Test Runner: ${config.testRunner}`);
    console.log(`  - Test Directory: ${config.testDirectory || 'co-located'}`);
    console.log(`  - Coverage Threshold: ${config.coverage.threshold}%`);
    
    // Get test dependencies
    const deps = await adapter.getTestDependencies(analysis);
    console.log('\n📦 Required Dependencies:');
    console.log(`  - Required: ${deps.required.join(', ') || 'none'}`);
    console.log(`  - Optional: ${deps.optional.slice(0, 3).join(', ')}...`);
    
    // Get applicable templates
    const templates = await adapter.getTestTemplates(analysis);
    console.log('\n📝 Available Templates:');
    templates.slice(0, 5).forEach(template => {
      console.log(`  - ${template.name}: ${template.description}`);
    });
    
    return { adapter, analysis, config };
    
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
  }
}

/**
 * Example 2: Multi-language project detection
 */
async function analyzeMultiLanguageProject(projectPath) {
  console.log(`\n=== Analyzing multi-language project: ${projectPath} ===\n`);
  
  try {
    // Create multi-language adapter
    const multiAdapter = await adapterFactory.createMultiLanguageAdapter(projectPath);
    console.log(`✓ Detected multiple languages: ${multiAdapter.adapters.map(a => a.language).join(', ')}`);
    
    // Analyze with all adapters
    const analysis = await multiAdapter.analyze(projectPath);
    console.log('\n📊 Multi-Language Analysis:');
    console.log(`  - Languages: ${analysis.languages.join(', ')}`);
    console.log(`  - All Frameworks: ${analysis.frameworks.join(', ')}`);
    console.log(`  - Project Type: ${analysis.projectType}`);
    
    // Generate unified configuration
    const config = await multiAdapter.generateConfiguration(analysis);
    console.log('\n⚙️  Multi-Language Configuration:');
    Object.entries(config.configurations).forEach(([lang, langConfig]) => {
      console.log(`  - ${lang}: ${langConfig.testRunner} runner`);
    });
    
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
  }
}

/**
 * Example 3: Direct language adapter usage
 */
async function useSpecificAdapter(language, projectPath) {
  console.log(`\n=== Using ${language} adapter directly ===\n`);
  
  try {
    // Get specific language adapter
    const adapter = adapterFactory.getAdapterByLanguage(language);
    
    // Validate project
    const validation = await adapter.validate(projectPath);
    console.log('🔍 Validation Results:');
    console.log(`  - Valid: ${validation.valid}`);
    if (validation.warnings.length > 0) {
      console.log(`  - Warnings: ${validation.warnings.length}`);
      validation.warnings.slice(0, 3).forEach(w => console.log(`    • ${w}`));
    }
    if (Object.keys(validation.suggestions).length > 0) {
      console.log(`  - Suggestions:`);
      Object.entries(validation.suggestions).slice(0, 3).forEach(([key, value]) => {
        console.log(`    • ${key}: ${value}`);
      });
    }
    
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
  }
}

/**
 * Example 4: List all supported languages
 */
function showSupportedLanguages() {
  console.log('\n=== Supported Languages ===\n');
  const languages = getSupportedLanguages();
  languages.forEach(lang => {
    const adapter = adapterFactory.getAdapterByLanguage(lang);
    console.log(`- ${lang}: ${adapter.getSupportedFrameworks().length} frameworks supported`);
  });
}

/**
 * Example 5: Custom adapter registration
 */
function registerCustomAdapter() {
  console.log('\n=== Registering Custom Adapter ===\n');
  
  // This is how you would register a custom adapter
  // const RustAdapter = require('./RustAdapter');
  // adapterFactory.registerAdapter('rust', RustAdapter);
  
  console.log('Custom adapters can be registered using:');
  console.log('adapterFactory.registerAdapter("language", AdapterClass)');
}

// Main execution
async function main() {
  // Show supported languages
  showSupportedLanguages();
  
  // Example project paths (adjust these to real projects)
  const jsProject = path.join(__dirname, '../../ai-testing-template');
  const pyProject = '/path/to/python/project'; // Update this path
  const multiProject = '/path/to/fullstack/project'; // Update this path
  
  // Analyze JavaScript project
  await analyzeProject(jsProject);
  
  // Use specific adapter
  await useSpecificAdapter('javascript', jsProject);
  
  // Show how to register custom adapters
  registerCustomAdapter();
  
  console.log('\n✅ Examples completed!\n');
}

// Run examples if executed directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  analyzeProject,
  analyzeMultiLanguageProject,
  useSpecificAdapter,
  showSupportedLanguages
};