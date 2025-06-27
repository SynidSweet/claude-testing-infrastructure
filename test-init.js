// Test the core functionality of the initialization script
const FileSystemAnalyzer = require('./ai-testing-template/scripts/utils/fileSystem');

async function testAnalyzer() {
  console.log('Testing FileSystemAnalyzer...');
  
  const analyzer = new FileSystemAnalyzer('./ai-testing-template');
  const analysis = analyzer.analyzeProject();
  
  console.log('Analysis results:');
  console.log('- JavaScript project:', analysis.javascript.isJavaScript);
  console.log('- Python project:', analysis.python.isPython);
  console.log('- Empty project:', analysis.isEmpty);
  console.log('- Existing tests:', analysis.testing.hasExistingTests);
  
  if (analysis.javascript.isJavaScript) {
    console.log('- JS frameworks:', Object.entries(analysis.javascript.frameworks)
      .filter(([_, detected]) => detected)
      .map(([name]) => name));
  }
  
  console.log('\nFileSystemAnalyzer working correctly! ✅');
}

testAnalyzer().catch(console.error);