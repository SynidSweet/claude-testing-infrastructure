# CLI Commands & API Reference

*Last updated: 2025-07-05 | Complete command reference and programmatic API guide*

## 🚀 CLI Commands Overview

The Claude Testing Infrastructure provides 9 production-ready commands for comprehensive test generation and management.

### Quick Command Reference
```bash
# Setup and analysis
node dist/cli/index.js init-config <project-path>        # Initialize configuration
node dist/cli/index.js analyze <project-path>            # Analyze project structure

# Test generation
node dist/cli/index.js test <project-path>               # Generate comprehensive tests
node dist/cli/index.js generate-logical-batch <path>    # AI-powered batch generation

# Test execution
node dist/cli/index.js run <project-path>                # Execute tests with coverage
node dist/cli/index.js incremental <project-path>       # Smart Git-based updates

# Monitoring and utilities
node dist/cli/index.js watch <project-path>              # Real-time file monitoring
node dist/cli/index.js analyze-gaps <project-path>      # Coverage gap analysis
node dist/cli/index.js monitor                          # System health monitoring
```

## 📖 Detailed Command Reference

### `init-config` - Configuration Initialization

Initialize testing configuration for a target project with auto-detection and framework-specific templates.

```bash
node dist/cli/index.js init-config <project-path> [options]
```

#### Options
- `--template <name>` - Use specific template (react, vue, nextjs, express, nodejs, django)
- `--language <lang>` - Force language detection (javascript, typescript, python)
- `--dry-run` - Preview configuration without writing files
- `--force` - Overwrite existing configuration
- `--verbose` - Show detailed initialization process

#### Examples
```bash
# Auto-detect and initialize
node dist/cli/index.js init-config /path/to/react-app

# Use specific template
node dist/cli/index.js init-config /path/to/project --template react

# Preview configuration
node dist/cli/index.js init-config /path/to/project --dry-run
```

#### Output
- Creates `.claude-testing.config.json` in project root
- Generates framework-specific configuration
- Sets up test directory structure
- Configures coverage thresholds and patterns

---

### `analyze` - Project Structure Analysis

Comprehensive analysis of project structure, languages, frameworks, and testing capabilities.

```bash
node dist/cli/index.js analyze <project-path> [options]
```

#### Options
- `--format <type>` - Output format: `json`, `markdown`, `table` (default: table)
- `--output <file>` - Save analysis to file
- `--show-config-sources` - Display configuration source hierarchy
- `--include-dependencies` - Include dependency analysis
- `--verbose` - Show detailed analysis steps

#### Examples
```bash
# Basic analysis
node dist/cli/index.js analyze /path/to/project

# Generate markdown report
node dist/cli/index.js analyze /path/to/project --format markdown --output analysis.md

# Debug configuration
node dist/cli/index.js analyze /path/to/project --show-config-sources --verbose
```

#### Output Information
- **Languages**: JavaScript, TypeScript, Python with confidence scores
- **Frameworks**: React, Vue, Angular, Express, Django, FastAPI detection
- **Test Frameworks**: Jest, Vitest, pytest configuration
- **Module Systems**: CommonJS, ESM analysis
- **Dependencies**: Production and development dependency analysis
- **File Statistics**: Source files, test files, coverage data

---

### `test` - Comprehensive Test Generation

Generate both structural and AI-powered logical tests with intelligent framework detection.

```bash
node dist/cli/index.js test <project-path> [options]
```

#### Options
- `--type <types>` - Test types: `structural`, `logical`, `both` (default: both)
- `--max-concurrent <num>` - Maximum concurrent AI processes (default: 1, max: 2)
- `--allow-concurrent` - Enable parallel processing (sequential by default)
- `--batch-size <num>` - Batch size for AI generation (default: 5)
- `--dry-run` - Preview generation without creating files
- `--force` - Skip validation checks
- `--verbose` - Show detailed generation progress

#### Examples
```bash
# Generate all tests (structural + logical)
node dist/cli/index.js test /path/to/project

# Only structural tests (no AI required)
node dist/cli/index.js test /path/to/project --type structural

# Parallel processing with custom batch size
node dist/cli/index.js test /path/to/project --allow-concurrent --batch-size 3

# Preview generation
node dist/cli/index.js test /path/to/project --dry-run --verbose
```

#### Generated Test Types

**Structural Tests** (Immediate):
- Function/method signature validation
- Class instantiation tests
- Import/export verification
- Basic component rendering (React/Vue)

**Logical Tests** (AI-powered):
- Edge case handling
- Business logic validation
- Integration scenarios
- Complex user interactions

---

### `generate-logical-batch` - AI Batch Processing

Efficient batch processing for AI-powered logical test generation with state persistence.

```bash
node dist/cli/index.js generate-logical-batch <project-path> [options]
```

#### Options
- `--batch-size <num>` - Files per batch (default: 5)
- `--max-concurrent <num>` - Maximum concurrent processes (default: 1)
- `--allow-concurrent` - Enable parallel batch processing
- `--resume` - Resume from previous checkpoint
- `--estimate-cost` - Show cost estimation before processing
- `--timeout <ms>` - AI timeout per batch (default: 120000)

#### Examples
```bash
# Standard batch processing
node dist/cli/index.js generate-logical-batch /path/to/project

# Large project with parallel processing
node dist/cli/index.js generate-logical-batch /path/to/project --batch-size 3 --allow-concurrent

# Cost estimation
node dist/cli/index.js generate-logical-batch /path/to/project --estimate-cost
```

#### Batch Processing Features
- **State Persistence**: Resumable across sessions
- **Progress Tracking**: Real-time progress with ETA
- **Cost Control**: Token estimation and budget limits
- **Error Recovery**: Intelligent retry with exponential backoff

---

### `run` - Test Execution & Coverage

Execute generated tests with comprehensive coverage reporting and framework-specific runners.

```bash
node dist/cli/index.js run <project-path> [options]
```

#### Options
- `--coverage` - Generate coverage reports
- `--coverage-format <formats>` - Coverage formats: `html`, `json`, `lcov`, `text` (default: html,json)
- `--test-pattern <pattern>` - Test file patterns (default: framework-specific)
- `--verbose` - Show detailed test execution
- `--watch` - Watch mode for continuous testing
- `--bail` - Stop on first test failure

#### Examples
```bash
# Basic test execution
node dist/cli/index.js run /path/to/project

# Full coverage analysis
node dist/cli/index.js run /path/to/project --coverage --coverage-format html,json,lcov

# Watch mode with verbose output
node dist/cli/index.js run /path/to/project --watch --verbose
```

#### Test Runners
- **Jest Runner**: JavaScript/TypeScript projects with full Jest integration
- **Pytest Runner**: Python projects with pytest-cov coverage
- **Automatic Selection**: Framework detection determines runner

#### Coverage Reporting
- **HTML Reports**: Interactive coverage visualization
- **JSON Data**: Programmatic coverage analysis
- **LCOV Format**: CI/CD integration support
- **Text Summary**: Command-line coverage overview

---

### `incremental` - Smart Git-Based Updates

Intelligent incremental testing based on Git change detection with cost optimization.

```bash
node dist/cli/index.js incremental <project-path> [options]
```

#### Options
- `--base-branch <branch>` - Base branch for comparison (default: main)
- `--include-deps` - Include dependency changes
- `--estimate-savings` - Show cost savings from incremental approach
- `--force-full` - Force full regeneration
- `--verbose` - Show change analysis details

#### Examples
```bash
# Standard incremental update
node dist/cli/index.js incremental /path/to/project

# Compare against develop branch
node dist/cli/index.js incremental /path/to/project --base-branch develop

# Show cost savings
node dist/cli/index.js incremental /path/to/project --estimate-savings --verbose
```

#### Change Detection
- **File-level Changes**: Modified, added, deleted files
- **Dependency Analysis**: Package.json changes affecting tests
- **Test Impact**: Determines which tests need regeneration
- **Cost Optimization**: 70-90% cost reduction through smart targeting

---

### `watch` - Real-Time File Monitoring

Real-time file system monitoring with automatic test regeneration and execution.

```bash
node dist/cli/index.js watch <project-path> [options]
```

#### Options
- `--patterns <patterns>` - File patterns to watch (comma-separated)
- `--ignore <patterns>` - Patterns to ignore
- `--debounce <ms>` - Debounce delay for file changes (default: 300)
- `--run-tests` - Automatically run tests on changes
- `--verbose` - Show file system events

#### Examples
```bash
# Watch source files
node dist/cli/index.js watch /path/to/project

# Watch with custom patterns
node dist/cli/index.js watch /path/to/project --patterns "src/**/*.ts,lib/**/*.js"

# Auto-run tests on changes
node dist/cli/index.js watch /path/to/project --run-tests --verbose
```

#### Watch Features
- **Cross-Platform**: Uses chokidar for reliable file watching
- **Intelligent Filtering**: Ignores node_modules, .git, build directories
- **Debouncing**: Prevents excessive triggering on rapid changes
- **Error Recovery**: Continues monitoring after individual failures

---

### `analyze-gaps` - Coverage Gap Analysis

Advanced analysis of test coverage gaps with AI-powered recommendations.

```bash
node dist/cli/index.js analyze-gaps <project-path> [options]
```

#### Options
- `--threshold <percent>` - Coverage threshold for gap identification (default: 80)
- `--output <file>` - Save gap analysis report
- `--format <type>` - Report format: `json`, `markdown`, `html`
- `--include-suggestions` - Include AI-powered improvement suggestions
- `--verbose` - Show detailed gap analysis

#### Examples
```bash
# Basic gap analysis
node dist/cli/index.js analyze-gaps /path/to/project

# Generate detailed report
node dist/cli/index.js analyze-gaps /path/to/project --format html --output gaps-report.html

# AI-powered suggestions
node dist/cli/index.js analyze-gaps /path/to/project --include-suggestions --threshold 90
```

#### Gap Analysis Features
- **Line Coverage**: Identifies uncovered code lines
- **Branch Coverage**: Analyzes conditional logic coverage
- **Function Coverage**: Reports untested functions
- **Integration Gaps**: Identifies missing integration tests

---

### `monitor` - System Health Monitoring

System health monitoring and process management for the testing infrastructure.

```bash
node dist/cli/index.js monitor [options]
```

#### Options
- `--testing-only` - Monitor only testing-related processes
- `--interval <ms>` - Monitoring interval (default: 5000)
- `--output <file>` - Log monitoring data to file
- `--alert-threshold <num>` - Process count alert threshold
- `--verbose` - Show detailed process information

#### Examples
```bash
# Basic monitoring
node dist/cli/index.js monitor

# Monitor testing processes only
node dist/cli/index.js monitor --testing-only --verbose

# Continuous monitoring with alerts
node dist/cli/index.js monitor --interval 3000 --alert-threshold 10
```

#### Monitoring Features
- **Process Tracking**: Claude CLI and Node.js process monitoring
- **Resource Usage**: CPU, memory consumption tracking
- **Health Metrics**: Process count, zombie detection
- **Alert System**: Configurable thresholds with notifications

## 🔧 Programmatic API

### Core Services

#### FileDiscoveryService
```typescript
import { FileDiscoveryService } from './src/services/FileDiscoveryService'

const service = new FileDiscoveryService({
  cache: { enabled: true, ttl: 300000 },
  patterns: { javascript: ['**/*.js', '**/*.ts'] }
})

const files = await service.discoverFiles('/path/to/project', ['**/*.js'])
```

#### ConfigurationService
```typescript
import { ConfigurationService } from './src/services/ConfigurationService'

const configService = new ConfigurationService()
const config = await configService.loadConfiguration('/path/to/project')
```

#### ProjectAnalyzer
```typescript
import { ProjectAnalyzer } from './src/analyzers/ProjectAnalyzer'

const analyzer = new ProjectAnalyzer('/path/to/project')
const analysis = await analyzer.analyzeProject()
```

### Test Generation API

#### TestGenerator
```typescript
import { TestGenerator } from './src/generators/TestGenerator'

const generator = new TestGenerator({
  projectPath: '/path/to/project',
  outputDirectory: '.claude-testing',
  generateLogical: true
})

const result = await generator.generateTests()
```

#### AI Integration
```typescript
import { ClaudeOrchestrator } from './src/ai/ClaudeOrchestrator'

const orchestrator = new ClaudeOrchestrator({
  maxConcurrent: 2,
  timeoutMs: 120000,
  retryAttempts: 3
})

const tests = await orchestrator.generateLogicalTests(context)
```

## 🎯 Global Options

All commands support these global options:

- `--help` - Show command help
- `--version` - Show version information
- `--config <path>` - Use specific configuration file
- `--log-level <level>` - Set logging level (debug, info, warn, error)
- `--no-color` - Disable colored output

## 🚨 Exit Codes

- `0` - Success
- `1` - General error
- `2` - Invalid arguments
- `3` - File system error
- `4` - Configuration error
- `5` - AI integration error
- `6` - Validation error

## 📊 Performance Considerations

### Resource Management
- **Sequential Processing**: Default to prevent resource exhaustion
- **Process Limits**: Maximum 5 concurrent Claude processes
- **Memory Management**: Streaming for large files (4k+ tokens)
- **Caching**: 70%+ cache hit rate for file discovery

### Cost Optimization
- **Incremental Updates**: 70-90% cost reduction
- **Batch Processing**: Configurable batch sizes (default: 5)
- **Token Estimation**: Pre-processing cost calculation
- **Smart Targeting**: Only regenerate affected tests

## 🔗 Integration Examples

### CI/CD Integration
```yaml
# GitHub Actions example
- name: Generate and run tests
  run: |
    node dist/cli/index.js test ./project --type both
    node dist/cli/index.js run ./project --coverage --coverage-format lcov
```

### NPM Scripts
```json
{
  "scripts": {
    "test:generate": "claude-testing test .",
    "test:run": "claude-testing run . --coverage",
    "test:watch": "claude-testing watch . --run-tests"
  }
}
```

---

This API reference provides comprehensive coverage of all available commands and programmatic interfaces for the Claude Testing Infrastructure.