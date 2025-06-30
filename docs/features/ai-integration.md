# AI Integration Features

*Last updated: 2025-06-30 | Phase 5.3 Complete + File Chunking Integration + Model Configuration Fixes*

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

#### 2. ClaudeOrchestrator (`src/ai/ClaudeOrchestrator.ts`)
Orchestrates parallel Claude processes for test generation:
- **Concurrency Control**: Manages multiple Claude processes with configurable limits
- **Progress Tracking**: Real-time status updates via event emitters
- **Error Handling**: Retry logic with exponential backoff
- **Result Aggregation**: Collects and processes generated tests
- **Chunked Task Support**: Handles merging results from chunked file processing
- **Advanced Timeout Management**: Session-isolated timeout configuration for headless processes (15-30 min) without affecting interactive Claude Code sessions
- **Environment Isolation**: Process-specific environment variables to preserve standard 2-minute timeouts for other operations

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