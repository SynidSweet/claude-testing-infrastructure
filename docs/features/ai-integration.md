# AI Integration Features

*Last updated: 2025-07-02 | Updated by: /document command | Integrated centralized model mapping system for consistent model recognition*

## Overview

The Claude Testing Infrastructure includes powerful AI-powered test generation capabilities that leverage Claude to create comprehensive logical tests based on gap analysis. This system intelligently identifies where structural tests fall short and generates meaningful test cases that validate business logic, edge cases, and integration scenarios.

## Architecture

### Core Components

#### 1. AITaskPreparation (`src/ai/AITaskPreparation.ts`)
Manages the preparation of AI tasks from gap analysis results:
- **Task Queue Management**: Prioritizes tasks based on complexity and business importance
- **Context Extraction**: Gathers relevant code snippets and dependencies for AI prompts
- **Batch Optimization**: Groups tasks for efficient processing
- **Cost Estimation**: Predicts token usage and associated costs

#### 1a. ChunkedAITaskPreparation (`src/ai/ChunkedAITaskPreparation.ts`)
Enhanced AI task preparation with file chunking support for large files:
- **Intelligent Chunking**: Automatically segments files exceeding token limits (4k+)
- **Context Preservation**: Maintains continuity between chunks with overlap
- **Multi-chunk Orchestration**: Creates linked tasks for file segments
- **Result Aggregation**: Merges chunked outputs into coherent test files
- **Progress Tracking**: Per-file chunk processing statistics

#### 1b. BatchedLogicalTestGenerator (`src/ai/BatchedLogicalTestGenerator.ts`) ✅ NEW
Advanced batched processing system for large-scale AI test generation:
- **Configurable Batching**: Process tests in batches of 1-50 (default: 10)
- **State Persistence**: Maintains processing state in `.claude-testing/batch-state.json`
- **Resume Functionality**: Continue interrupted processing across CLI sessions
- **Progress Tracking**: Real-time progress with cost estimation per batch
- **Validation System**: Automatically determines if batching provides benefit
- **Cost Control**: Per-batch cost limits and budget management
- **Iterative Processing**: Ideal for large projects requiring controlled AI generation

#### 2. ClaudeOrchestrator (`src/ai/ClaudeOrchestrator.ts`)
Orchestrates parallel Claude processes for test generation with enhanced reliability:
- **Authentication Validation**: Pre-flight validation of Claude CLI authentication with `validateClaudeAuth()` method
- **Typed Error Handling**: Comprehensive error types (`AIAuthenticationError`, `AITimeoutError`, `AIRateLimitError`, `AINetworkError`)
- **Real-time Progress Tracking**: Event-based progress updates for authentication, generation phases with percentage completion
- **Enhanced Timeout Management**: Improved timeout errors with specific troubleshooting guidance
- **Concurrency Control**: Manages multiple Claude processes with configurable limits
- **Model Alias Resolution**: Automatic mapping of "opus", "sonnet", "haiku" to full model identifiers
- **Result Aggregation**: Collects and processes generated tests with graceful fallback handling
- **Chunked Task Support**: Handles merging results from chunked file processing
- **Process Lifecycle Management**: Proper cleanup of active processes on timeout or error

#### 3. PromptTemplates (`src/ai/PromptTemplates.ts`)
Provides framework-specific prompt templates:
- **Language Support**: JavaScript, TypeScript, Python
- **Framework Templates**: React, Express, FastAPI, Django, Flask, Vue, Angular
- **Test Types**: Unit, integration, edge cases, business logic
- **Context-Aware**: Adapts prompts based on project characteristics

#### 4. CostEstimator (`src/ai/CostEstimator.ts`)
Manages cost estimation and optimization:
- **Token Calculation**: Estimates input/output tokens based on complexity
- **Model Selection**: Chooses optimal Claude model (Opus, Sonnet, Haiku)
- **Budget Optimization**: Allocates resources within budget constraints
- **Usage Tracking**: Records actual usage for reporting
- **Model Name Resolution**: Supports standard aliases (sonnet, opus, haiku) and full model identifiers

#### 5. Model Mapping System (`src/utils/model-mapping.ts`)
Comprehensive model configuration management:
- **Alias Resolution**: Maps short names (sonnet, haiku, opus) to full model identifiers
- **Pricing Information**: Accurate cost per 1K token for all supported models
- **Validation**: Comprehensive model name validation with helpful error messages
- **Selection**: Automatic optimal model selection based on task complexity
- **User Experience**: Clear suggestions when invalid model names are provided

## CLI Commands

### generate-logical

Generate AI-powered logical tests based on gap analysis:

```bash
node dist/cli/index.js generate-logical <projectPath> [options]

Options:
  -g, --gap-report <path>     Path to existing gap analysis report
  -m, --model <model>         Claude model to use (opus, sonnet, haiku) [default: sonnet]
  -c, --concurrent <number>   Max concurrent Claude processes [default: 3]
  -b, --budget <amount>       Maximum budget in USD
  --min-complexity <number>   Minimum complexity for AI generation [default: 5]
  --batch-mode                Enable batched processing for large projects
  --batch-size <number>       Batch size when using batch mode [default: 10]
  --dry-run                   Show what would be generated without executing
  -o, --output <path>         Output directory for reports
  -v, --verbose               Enable verbose logging
```

Example:
```bash
# Generate logical tests with budget limit
node dist/cli/index.js generate-logical ./my-project --budget 5.00 --model sonnet

# Use existing gap report
node dist/cli/index.js generate-logical ./my-project -g ./gap-report.json

# Dry run to see cost estimates
node dist/cli/index.js generate-logical ./my-project --dry-run

# Enable batch mode for large projects
node dist/cli/index.js generate-logical ./my-project --batch-mode --batch-size 10
```

### generate-logical-batch ✅ NEW

Dedicated batched AI test generation with state persistence and resume functionality:

```bash
node dist/cli/index.js generate-logical-batch <projectPath> [options]

Options:
  -g, --gap-report <path>     Path to existing gap analysis report
  -b, --batch-size <number>   Number of tests to generate per batch [default: 10]
  -m, --model <model>         Claude model to use (opus, sonnet, haiku) [default: sonnet]
  -c, --concurrent <number>   Max concurrent Claude processes [default: 3]
  --cost-limit <amount>       Maximum cost per batch in USD
  --min-complexity <number>   Minimum complexity for AI generation [default: 5]
  --timeout <seconds>         Timeout per AI task in seconds [default: 900]
  --resume                    Resume from previous batch state
  --dry-run                   Show what batches would be created without executing
  --stats                     Show current progress statistics and exit
  --clean                     Clean up batch state and start fresh
  -o, --output <path>         Output directory for reports
  -v, --verbose               Enable verbose logging
```

Examples:
```bash
# Start batched processing for large project
node dist/cli/index.js generate-logical-batch ./large-project --batch-size 10

# Continue processing next batch
node dist/cli/index.js generate-logical-batch ./large-project

# Resume interrupted processing
node dist/cli/index.js generate-logical-batch ./large-project --resume

# Check current progress
node dist/cli/index.js generate-logical-batch ./large-project --stats

# Preview batches without executing
node dist/cli/index.js generate-logical-batch ./large-project --dry-run

# Start fresh (clean previous state)
node dist/cli/index.js generate-logical-batch ./large-project --clean

# Control costs per batch
node dist/cli/index.js generate-logical-batch ./large-project --cost-limit 2.00
```

### test-ai

Complete AI-enhanced testing workflow (analyze → generate → test → AI enhance):

```bash
node dist/cli/index.js test-ai <projectPath> [options]

Options:
  -m, --model <model>         Claude model (opus, sonnet, haiku) [default: sonnet]
  -b, --budget <amount>       Maximum budget in USD for AI generation
  -c, --concurrent <number>   Max concurrent AI processes [default: 3]
  --min-complexity <number>   Minimum complexity for AI [default: 5]
  --no-ai                     Disable AI generation (structural tests only)
  --no-run                    Skip test execution
  --no-coverage               Skip coverage reporting
  -o, --output <path>         Output directory for reports
  -v, --verbose               Enable verbose logging
```

Example:
```bash
# Complete workflow with AI enhancement
node dist/cli/index.js test-ai ./my-project --budget 10.00

# Structural tests only (no AI)
node dist/cli/index.js test-ai ./my-project --no-ai

# Generate but don't run tests
node dist/cli/index.js test-ai ./my-project --no-run
```

## AI Task Preparation

### Priority Calculation

Tasks are prioritized based on:
1. **Complexity Score** (30%): Higher complexity = higher priority
2. **Business Logic Gaps** (40%): Critical business rules get priority
3. **Integration Points** (30%): External dependencies increase priority

### Context Extraction

For each gap, the system extracts:
- Source code of the file being tested
- Existing test file (if any)
- Dependencies and imports
- Framework/language context
- Missing test scenarios
- Business domain hints

### Prompt Generation

Prompts are tailored to:
- **Framework**: React components, Express endpoints, FastAPI routes, etc.
- **Test Type**: Unit tests, integration tests, edge case tests
- **Language**: JavaScript/TypeScript vs Python conventions
- **Existing Patterns**: Matches style of existing tests

## Cost Management

### Model Selection

The system automatically selects the most cost-effective model:
- **Haiku** (complexity 1-5): Simple utility functions, basic components
- **Sonnet** (complexity 5-8): Business logic, API endpoints, services
- **Opus** (complexity 8-10): Complex algorithms, critical business rules

### Budget Optimization

When a budget is specified:
1. Tasks are sorted by priority (highest first)
2. Cost is accumulated until budget is reached
3. Lower priority tasks are excluded
4. Recommendations provided for excluded tasks

### Cost Estimation

Estimates are based on:
- **Input tokens**: Source code + existing tests + prompt template
- **Output tokens**: Expected test code (1.5x-2.5x input based on complexity)
- **Model pricing**: Current Claude API pricing

## Workflow Integration

### AIEnhancedTestingWorkflow

The complete workflow orchestrates:
1. **Project Analysis**: Understand codebase structure
2. **Structural Generation**: Create test scaffolding
3. **Test Execution**: Run tests and collect coverage
4. **Gap Analysis**: Identify missing test scenarios
5. **AI Generation**: Create logical tests for gaps
6. **Final Execution**: Run complete test suite

### Event-Based Progress

The system emits events for real-time tracking:
```javascript
workflow.on('phase:start', ({ phase }) => { /* ... */ });
workflow.on('phase:complete', ({ phase, results }) => { /* ... */ });
workflow.on('ai:task-complete', ({ file }) => { /* ... */ });
```

## Configuration

### Project Configuration

Create `.claude-testing.config.json` in your project:

```json
{
  "ai": {
    "enabled": true,
    "model": "sonnet",
    "maxConcurrent": 3,
    "minComplexityForAI": 5,
    "budget": {
      "maxCostPerRun": 5.00,
      "warningThreshold": 3.00
    },
    "priorities": [
      "business-logic",
      "payment-processing",
      "data-validation"
    ]
  }
}
```

### Claude Code CLI Integration

The AI integration leverages Claude Code CLI for headless operation with optimal configuration:

#### Authentication
- **Max Subscription**: Automatic authentication when logged in to Claude Code CLI
- **No API Key Required**: Uses your existing Claude subscription for seamless operation
- **Session Isolation**: Each headless process operates independently

#### Authentication Validation (NEW)
The ClaudeOrchestrator now validates authentication before processing:
```typescript
const authStatus = await orchestrator.validateClaudeAuth();
if (!authStatus.authenticated) {
  throw new AIAuthenticationError(authStatus.error);
}
```

#### Error Handling (ENHANCED)
The system uses typed errors for better debugging:
- `AIAuthenticationError` - Claude CLI not installed or not authenticated
- `AITimeoutError` - Generation exceeded timeout with specific duration info
- `AIRateLimitError` - API rate limits reached with fallback suggestions
- `AINetworkError` - Network connectivity issues
- Progress events provide real-time status updates

#### Timeout Configuration
```typescript
// ClaudeOrchestrator automatically configures timeouts for headless processes
const claudeEnv = {
  ...process.env,
  BASH_DEFAULT_TIMEOUT_MS: String(this.config.timeout), // 15-30 minutes
  BASH_MAX_TIMEOUT_MS: String(this.config.timeout)
};
```

#### Model Configuration with Fallback
```bash
# Use latest model with automatic fallback for Max subscription limits
node dist/cli/index.js generate-logical /path/to/project --model opus --timeout 1800

# The system automatically falls back to sonnet when opus usage limits are reached
```

### Environment Variables (Optional)

```bash
# Optional: Only needed if not using Claude Code CLI Max subscription
export ANTHROPIC_API_KEY=your-api-key

# Optional configuration
export CLAUDE_MODEL=sonnet
export CLAUDE_MAX_CONCURRENT=3
```

## Output Examples

### Generated Logical Test

```javascript
// AI-Generated Logical Tests
describe('PricingEngine - Business Logic Tests', () => {
  describe('Discount Stacking', () => {
    test('applies percentage discounts before fixed discounts', () => {
      const engine = new PricingEngine();
      const price = 100;
      const discounts = [
        { type: 'percentage', value: 10 },
        { type: 'fixed', value: 5 }
      ];
      
      // Should be (100 * 0.9) - 5 = 85, not (100 - 5) * 0.9 = 85.5
      expect(engine.applyDiscounts(price, discounts)).toBe(85);
    });
    
    test('prevents negative prices with large discounts', () => {
      const engine = new PricingEngine();
      const price = 10;
      const discounts = [{ type: 'fixed', value: 15 }];
      
      expect(engine.applyDiscounts(price, discounts)).toBe(0);
      expect(engine.applyDiscounts(price, discounts)).not.toBe(-5);
    });
  });
});
```

### Cost Report

```
Cost Estimation:
Total estimated cost: $2.45
By complexity:
  low: 5 files, $0.25
  medium: 8 files, $1.20
  high: 3 files, $1.00

Recommendations:
  • Consider using Claude 3 Haiku for simpler tests to reduce costs by ~80%
  • Focus on 12 high-priority files first to maximize impact
```

## Best Practices

### 1. Start with Gap Analysis
Always run gap analysis first to understand what needs AI generation:
```bash
node dist/cli/index.js analyze-gaps ./project
```

### 2. Use Budget Controls
Set reasonable budgets to control costs:
```bash
node dist/cli/index.js generate-logical ./project --budget 5.00
```

### 3. Review Generated Tests
AI-generated tests should be reviewed for:
- Correctness of assertions
- Appropriate test data
- Edge case coverage
- Performance considerations

### 4. Iterate on Complex Files
For very complex files, consider:
- Breaking into smaller modules
- Running multiple generation passes
- Using Opus model for critical logic

### 5. Combine with Structural Tests
AI tests complement structural tests:
- Structural: Ensures all exports are tested
- AI/Logical: Validates business logic correctness

## Troubleshooting

### AI Generation Hanging or Timeout Issues
**Fixed in v2.0**: Common issue where AI logical test generation would hang indefinitely.

**Root Cause**: Claude CLI authentication issues or network problems.

**Solutions** (implemented in current version):
- **Automatic Authentication Validation**: System now validates Claude CLI authentication before starting AI generation
- **Robust Timeout Handling**: 15-minute individual task timeouts and 30-minute overall process timeout prevent infinite hangs
- **Clear Error Messages**: Context-aware error messages identify specific issues (authentication, network, rate limits)
- **Progress Reporting**: Real-time progress with ETA calculations helps identify stuck processes

**Manual Verification**:
```bash
# Test Claude CLI authentication
echo "What is 2+2?" | claude
# Should respond with "4" without hanging

# If hanging, run Claude Code interactively first
# Open Claude Code application to ensure authentication
```

### "Claude CLI not found"
Install Claude CLI first:
```bash
# Check Claude CLI documentation for installation
which claude
```

### "Exceeds token limit"
For large files:
- Increase `maxTokensPerTask` in configuration
- Break file into smaller modules
- Use `--min-complexity` to filter files

### "Unknown model" warnings
**Fixed in v2.0**: Model recognition warnings for "sonnet", "haiku", "opus" aliases.

**Solution**: Comprehensive model mapping system now properly recognizes all standard Claude model aliases.

**Current Support**:
- `sonnet` → `claude-3-5-sonnet-20241022`
- `haiku` → `claude-3-haiku-20240307`  
- `opus` → `claude-3-opus-20240229`

### "Budget exceeded"
- Use `--dry-run` to preview costs
- Increase budget or reduce scope
- Use cheaper models for simple tests

### "No gaps found"
- Check if structural tests already provide good coverage
- Lower `--min-complexity` threshold
- Verify gap analysis ran successfully

## Future Enhancements

- **Streaming Generation**: Real-time test output as generated
- **Test Quality Scoring**: Automated assessment of generated tests
- **Learning System**: Improve prompts based on successful patterns
- **Multi-Model Support**: Integration with other AI providers
- **Test Refactoring**: AI-powered test improvement suggestions