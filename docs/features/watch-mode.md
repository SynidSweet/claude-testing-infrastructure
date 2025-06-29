# Watch Mode

*Last updated: 2025-06-28 | Feature Status: ✅ Production Ready*

## Overview

Watch Mode provides real-time file monitoring with automatic incremental test generation, transforming the development workflow from manual to automatic test updates. This feature dramatically improves developer experience by providing instant feedback as code changes.

## Core Functionality

### Real-time File Monitoring
- **Cross-platform file watching** using `chokidar` for reliability
- **Intelligent filtering** to watch only relevant source files
- **Configurable patterns** for include/exclude file patterns
- **Graceful startup and shutdown** with proper cleanup

### Smart Change Detection
- **Debounced processing** to avoid excessive test generation
- **Batch processing** of multiple file changes
- **Change type detection** (add, modify, delete)
- **Configurable debounce timing** (default: 500ms)

### Automatic Test Generation
- **Seamless integration** with existing `IncrementalGenerator`
- **Live progress feedback** with spinners and status updates
- **Error handling** with graceful degradation
- **Optional test execution** after generation

## CLI Interface

### Basic Usage
```bash
# Start watching a project
node dist/cli/index.js watch /path/to/project

# Watch with custom debounce delay
node dist/cli/index.js watch /path/to/project --debounce 1000

# Watch without automatic test generation (monitoring only)
node dist/cli/index.js watch /path/to/project --no-generate

# Enable automatic test execution after generation
node dist/cli/index.js watch /path/to/project --auto-run
```

### Command Options

| Option | Description | Default |
|--------|-------------|---------|
| `--debounce <ms>` | Debounce delay for file changes | `500` |
| `--verbose` | Enable verbose logging | `false` |
| `--no-generate` | Disable automatic test generation | `false` |
| `--auto-run` | Automatically run tests after generation | `false` |
| `--include <patterns...>` | Additional file patterns to watch | - |
| `--exclude <patterns...>` | File patterns to exclude | - |
| `--stats-interval <seconds>` | Show statistics every N seconds | `30` |

## Architecture Components

### FileWatcher (`src/utils/FileWatcher.ts`)
**Purpose**: Cross-platform file system monitoring with intelligent filtering

**Key Features**:
- Built on `chokidar` for reliable cross-platform watching
- Intelligent default patterns for source files
- Configurable include/exclude patterns
- Event-driven architecture with proper cleanup
- Error handling and graceful shutdown

**Default Watch Patterns**:
```typescript
// Included by default
'**/*.{js,jsx,ts,tsx,py,vue,svelte}'
'**/package.json'
'**/requirements.txt'

// Excluded by default
'node_modules/**'
'.git/**'
'dist/**'
'.claude-testing/**'
'**/*.test.{js,ts,jsx,tsx,py}'
```

### Debouncer (`src/utils/Debouncer.ts`)
**Purpose**: Smart event batching to reduce excessive processing

**Key Features**:
- Generic debouncing utility for any event type
- Configurable delay, batch size, and wait time limits
- Smart grouping by file type or directory
- Event merging for duplicate file changes
- Force processing for large batches or time limits

**Configuration Options**:
```typescript
{
  delay: 500,           // Debounce delay in ms
  maxBatchSize: 10,     // Force process if batch exceeds size
  maxWaitTime: 3000,    // Force process after max wait time
  groupBy: 'extension', // Group by file extension
  verbose: false        // Enable debug logging
}
```

### Watch Command (`src/cli/commands/watch.ts`)
**Purpose**: Complete watch mode implementation with user interface

**Key Features**:
- Comprehensive CLI option handling
- Live status display with progress indicators
- Statistics tracking and periodic reporting
- Graceful shutdown with cleanup
- Integration with existing incremental system

## User Experience Features

### Live Feedback
```
👁  Watch Mode Active
────────────────────
📁 Project: my-project
📊 Files watched: 247
⚡ Debounce: 500ms
🔧 Auto-generate: enabled
🏃 Auto-run: disabled

Watching for changes... Press Ctrl+C to stop

14:23:45 📝 src/utils/helper.ts
14:23:45 📝 src/components/Button.tsx
14:23:46 🔄 Processing 2 changes (2 files) in .tsx
✓ Generated 1 tests (1,247ms)
```

### Statistics Reporting
```
📊 Watch Statistics
   Uptime: 2h 15m 33s
   Changes: 47 events, 12 batches
   Generations: 12 (100% success)
   Last activity: 3m ago
```

### Shutdown Summary
```
📊 Final Watch Statistics
─────────────────────────
Total uptime: 2h 15m 45s
File changes: 47
Change batches: 12
Test generations: 12
Success rate: 100%

Thank you for using Claude Testing Infrastructure! 🚀
```

## Integration Points

### With Incremental Generator
Watch mode leverages the existing `IncrementalGenerator` for test generation:
- Seamless integration without code duplication
- Maintains all incremental features (change detection, cost optimization)
- Preserves state management and manifest tracking
- Consistent behavior with manual incremental commands

### With Project Analysis
- Initial project analysis for framework detection
- Reuses existing project structure understanding
- Compatible with all supported languages and frameworks

### With CLI Infrastructure
- Consistent with other CLI commands
- Shared logging and error handling
- Compatible with existing configuration systems

## Developer Benefits

### Immediate Feedback Loop
- **Instant awareness** of file changes
- **Automatic test updates** without manual intervention
- **Continuous validation** during development
- **Reduced context switching** between coding and testing

### Cost Efficiency
- **Smart batching** reduces redundant test generation
- **Debounced processing** prevents excessive API usage
- **Change-based updates** only generate tests for modified files
- **Optional generation** allows monitoring without cost

### Productivity Enhancement
- **Hands-free operation** during active development
- **Live progress indicators** show system activity
- **Comprehensive statistics** track development patterns
- **Graceful handling** of rapid file changes

## Configuration Examples

### Development Mode
```bash
# Fast feedback with minimal delay
node dist/cli/index.js watch . --debounce 200 --verbose
```

### Production Monitoring
```bash
# Monitor changes without generating tests
node dist/cli/index.js watch . --no-generate --stats-interval 60
```

### CI/CD Integration
```bash
# Watch with automatic test execution
node dist/cli/index.js watch . --auto-run --debounce 1000
```

### Custom File Patterns
```bash
# Watch specific patterns
node dist/cli/index.js watch . \
  --include "**/*.{js,ts}" \
  --exclude "**/node_modules/**" \
  --exclude "**/dist/**"
```

## Performance Characteristics

### File System Monitoring
- **Lightweight**: Uses native file system events when available
- **Efficient**: Intelligent filtering reduces event volume
- **Scalable**: Handles large projects with thousands of files
- **Reliable**: Cross-platform compatibility with fallback polling

### Processing Efficiency
- **Debounced**: Batches rapid changes to reduce processing
- **Incremental**: Only processes changed files, not entire project
- **Memory efficient**: Minimal memory overhead for long-running processes
- **CPU optimized**: Event-driven architecture minimizes CPU usage

## Error Handling

### File System Errors
- Graceful handling of permission issues
- Automatic retry for transient file system errors
- Clear error messages for troubleshooting
- Fallback to polling mode when native watching fails

### Test Generation Errors
- Continues watching even if test generation fails
- Logs detailed error information for debugging
- Maintains statistics for success/failure tracking
- Non-blocking error handling preserves watch functionality

## Future Enhancements

### Planned Features
- **Live test execution** with automatic re-running
- **Interactive dashboard** with real-time project status
- **Smart notifications** for significant changes
- **Integration patterns** for different IDEs

### Performance Optimizations
- **Change impact analysis** for targeted test updates
- **Dependency graph integration** for smarter test selection
- **Parallel processing** for large batch changes
- **Advanced caching** for repeated operations

## Best Practices

### Development Workflow
1. **Start watch mode** at beginning of development session
2. **Use appropriate debounce** timing for your workflow
3. **Monitor statistics** to understand change patterns
4. **Enable auto-run** for continuous validation when ready

### Performance Optimization
1. **Use exclude patterns** to ignore irrelevant files
2. **Adjust debounce timing** based on typing speed
3. **Monitor batch sizes** to optimize processing
4. **Use --no-generate** for pure monitoring scenarios

### Error Recovery
1. **Check file permissions** if watching fails to start
2. **Verify include/exclude patterns** if too many/few files watched
3. **Monitor logs** for file system or test generation errors
4. **Restart watch mode** if persistent issues occur

---

**Implementation Status**: ✅ Complete  
**Test Coverage**: 116/116 tests passing (100%)  
**Performance**: Optimized for long-running development sessions  
**Compatibility**: All supported platforms (Linux, macOS, Windows)