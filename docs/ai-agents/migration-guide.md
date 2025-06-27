# Adapter Pattern Migration Guide

This guide explains how to migrate from the old detection logic to the new adapter pattern.

## Overview

The adapter pattern implementation (completed 2025-06-27) provides:
- Clear separation between shared logic and language-specific code
- Extensible architecture for adding new languages
- Better code organization and maintainability
- Multi-language project support

## Migration Status

### Template-Based Approach (`ai-testing-template/`)
- ✅ Created `fileSystemAdapter.js` with backward compatibility
- ✅ Created `initWithAdapter.js` that can use either old or new system
- 🔄 Next: Update imports and test the new implementation

### Decoupled Approach (`decoupled-testing-suite/`)
- 📍 Next: Update discovery engine to use adapters
- 📍 Next: Update configuration system to use adapters

## How to Use the New System

### Option 1: Gradual Migration (Recommended)

1. **Test with the new adapter**:
   ```bash
   cd ai-testing-template
   node scripts/initWithAdapter.js
   ```

2. **Compare with legacy**:
   ```bash
   USE_LEGACY_ANALYZER=1 node scripts/initWithAdapter.js
   ```

3. **Switch when ready**:
   Update `scripts/init.js` to use `fileSystemAdapter.js`

### Option 2: Direct Migration

1. **Replace imports**:
   ```javascript
   // Old
   const FileSystemAnalyzer = require('./utils/fileSystem');
   
   // New
   const FileSystemAnalyzer = require('./utils/fileSystemAdapter');
   ```

2. **Handle async changes**:
   ```javascript
   // Old (sync)
   const analysis = analyzer.analyzeProject();
   
   // New (async)
   const analysis = await analyzer.analyzeProject();
   ```

## API Changes

### FileSystemAnalyzer

The new adapter-based analyzer maintains backward compatibility while adding new features:

#### Backward Compatible Methods
- `detectJavaScriptProject()` - Now async, but sync version available
- `detectPythonProject()` - Now async, but sync version available
- `analyzeProject()` - Now async, but sync version available
- `getExistingTestStructure()` - Now async, but sync version available

#### New Methods
- `async initialize()` - Initialize adapter detection
- `async getTestConfiguration()` - Get test config from adapter
- `async getTestDependencies()` - Get dependencies from adapter
- `async getTestTemplates()` - Get templates from adapter
- `async validate()` - Validate project with adapter

### Enhanced Analysis Output

The analysis now includes adapter information:

```javascript
{
  projectPath: '/path/to/project',
  javascript: { /* legacy format */ },
  python: { /* legacy format */ },
  testing: { /* legacy format */ },
  isEmpty: false,
  isMultiLanguage: false,
  
  // NEW: Adapter information
  adapter: {
    language: 'javascript',  // or 'python' or 'multi'
    frameworks: ['react', 'jest', ...],
    analysis: { /* detailed adapter analysis */ }
  }
}
```

## Benefits of Migration

1. **Better Framework Detection**:
   - More comprehensive framework detection
   - Version-aware detection
   - Build tool detection

2. **Smarter Configuration**:
   - Adapter suggests optimal test runner
   - Framework-specific configuration
   - Automatic dependency selection

3. **Multi-Language Support**:
   - Fullstack projects handled automatically
   - Unified configuration for all languages
   - Language-specific optimizations

4. **Extensibility**:
   - Easy to add new languages
   - Framework adapters can be added
   - Custom adapters supported

## Testing the Migration

1. **Unit Tests**:
   ```bash
   # Test adapters directly
   node shared/examples/adapter-usage.js
   ```

2. **Integration Tests**:
   ```bash
   # Test with real projects
   cd /path/to/test/project
   node /path/to/ai-testing-template/scripts/initWithAdapter.js
   ```

3. **Compare Results**:
   - Run both old and new analyzers
   - Compare detection results
   - Verify configuration generation

## Troubleshooting

### Issue: "No suitable adapter found"
- Check if project has clear language indicators
- Ensure package.json or requirements.txt exists
- Try running with verbose logging

### Issue: "Cannot read property 'analyze' of null"
- Adapter initialization may have failed
- Check if project path is correct
- Ensure adapters are properly installed

### Issue: Sync method called on async analyzer
- Use the compatibility wrapper
- Or update code to use async/await

## Next Steps

1. **Complete Template Approach Migration**:
   - Update all references to use adapters
   - Test with various project types
   - Update documentation

2. **Migrate Decoupled Approach**:
   - Update discovery engine
   - Update configuration system
   - Test zero-modification guarantee

3. **Add More Adapters**:
   - TypeScript-specific adapter
   - Go adapter
   - Rust adapter
   - Ruby adapter

## Code Examples

### Using Specific Adapter
```javascript
const { adapterFactory } = require('./shared/adapters');

// Get JavaScript adapter directly
const jsAdapter = adapterFactory.getAdapterByLanguage('javascript');
const canHandle = await jsAdapter.detect(projectPath);
if (canHandle) {
  const analysis = await jsAdapter.analyze(projectPath);
  const config = await jsAdapter.generateConfiguration(analysis);
}
```

### Multi-Language Project
```javascript
// Automatically handles projects with both JS and Python
const adapter = await adapterFactory.getAdapter(projectPath);
if (adapter.getLanguage() === 'multi') {
  console.log('Detected multi-language project');
  const analysis = await adapter.analyze(projectPath);
  // Returns unified analysis for all languages
}
```

### Custom Adapter Registration
```javascript
const { adapterFactory } = require('./shared/adapters');
const { BaseProjectAdapter } = require('./shared/adapters/base');

class RustAdapter extends BaseProjectAdapter {
  constructor() {
    super('rust');
  }
  // ... implement required methods
}

adapterFactory.registerAdapter('rust', RustAdapter);
```

## Summary

The adapter pattern migration provides a cleaner, more maintainable architecture while maintaining backward compatibility. The migration can be done gradually, testing each component before fully switching over.