# Batched AI Processing System

*Last updated: 2025-06-30 | Feature documentation for v2.0*

## Overview

The Batched AI Processing System enables configurable, iterative AI test generation for large projects. Instead of processing all tests at once, it breaks AI generation into manageable batches with state persistence and resume functionality.

## Core Components

### BatchedLogicalTestGenerator
**Location**: `src/ai/BatchedLogicalTestGenerator.ts`

Main class that orchestrates batched processing:
- **Configurable batch sizes** (1-50, default: 10)
- **State persistence** via `.claude-testing/batch-state.json`
- **Resume functionality** for interrupted processing
- **Progress tracking** with cost estimation
- **Validation** to ensure batching provides benefit

### CLI Command
**Command**: `generate-logical-batch`
**Location**: `src/cli/commands/generate-logical-batch.ts`

Comprehensive CLI interface with options:
- `--batch-size <number>` - Tests per batch (default: 10)
- `--resume` - Continue from previous state
- `--stats` - Show progress statistics
- `--dry-run` - Preview without execution
- `--clean` - Reset state and start fresh
- `--cost-limit <amount>` - Maximum cost per batch
- `--model <model>` - Claude model selection
- `--concurrent <number>` - Concurrent processes
- `--timeout <seconds>` - AI task timeout

## Key Features

### 1. State Persistence
Maintains processing state in `.claude-testing/batch-state.json`:
```json
{
  "batchId": "batch-1735689600000",
  "projectPath": "/path/to/project",
  "totalTasks": 45,
  "completedBatches": 3,
  "totalBatches": 5,
  "completedTasks": 30,
  "failedTasks": 2,
  "totalEstimatedCost": 12.50,
  "actualCostSoFar": 7.85,
  "startTime": "2025-06-30T12:00:00.000Z",
  "lastUpdate": "2025-06-30T12:45:00.000Z",
  "nextBatchIndex": 3,
  "config": {
    "batchSize": 10,
    "model": "sonnet",
    "maxConcurrent": 3,
    "timeout": 900000,
    "minComplexity": 5,
    "costLimit": 2.00
  }
}
```

### 2. Progress Tracking
Real-time progress reporting including:
- **Batch completion**: X/Y batches completed
- **Task completion**: X/Y individual tasks completed
- **Cost tracking**: Estimated vs actual costs
- **Time tracking**: Start time, last update, duration
- **Failure tracking**: Failed tasks and reasons

### 3. Resume Functionality
Interrupted processing can be resumed:
- Preserves state across CLI sessions
- Maintains cost tracking
- Continues from next pending batch
- Validates state integrity on resume

### 4. Validation System
Automatically validates if batching provides benefit:
- **Small projects** (≤ batch size): Suggests regular processing
- **Medium projects** (< 2x batch size): Minimal benefit warning
- **Large projects** (≥ 2x batch size): Recommends batching

## Usage Patterns

### For Large Projects (50+ files)
```bash
# Start batched processing
node dist/src/cli/index.js generate-logical-batch /path/to/large/project --batch-size 10

# Continue processing (run same command)
node dist/src/cli/index.js generate-logical-batch /path/to/large/project

# Check progress anytime
node dist/src/cli/index.js generate-logical-batch /path/to/large/project --stats
```

### Cost-Controlled Processing
```bash
# Set per-batch cost limit
node dist/src/cli/index.js generate-logical-batch /path/to/project --cost-limit 2.00

# Use smaller batches for budget control
node dist/src/cli/index.js generate-logical-batch /path/to/project --batch-size 5
```

### Preview and Planning
```bash
# Preview what batches would be created
node dist/src/cli/index.js generate-logical-batch /path/to/project --dry-run

# Check current progress without processing
node dist/src/cli/index.js generate-logical-batch /path/to/project --stats
```

### State Management
```bash
# Resume interrupted processing
node dist/src/cli/index.js generate-logical-batch /path/to/project --resume

# Clean up and start fresh
node dist/src/cli/index.js generate-logical-batch /path/to/project --clean
```

## Integration with Existing Commands

### Enhanced generate-logical Command
The existing `generate-logical` command now supports batch mode:
```bash
# Enable batch mode in existing command
node dist/src/cli/index.js generate-logical /path/to/project --batch-mode --batch-size 10
```

This provides basic batching without the advanced state management of `generate-logical-batch`.

## Technical Implementation

### Batch Creation Algorithm
1. **Task Preparation**: Use `AITaskPreparation` to create all tasks
2. **Batch Segmentation**: Split tasks into configured batch sizes
3. **State Initialization**: Create persistent state file
4. **Sequential Processing**: Process one batch at a time
5. **State Updates**: Update progress after each batch
6. **Completion Detection**: Automatically detect when all batches complete

### Error Handling
- **Task Failures**: Track failed tasks without stopping batch
- **Batch Failures**: Continue with next batch if one fails
- **State Corruption**: Validate state integrity on load
- **Cost Overruns**: Warn and optionally stop if costs exceed limits

### Performance Characteristics
- **Memory Usage**: Processes only current batch in memory
- **Timeout Handling**: Configurable timeouts per AI task
- **Concurrency**: Configurable concurrent processes within each batch
- **Cost Efficiency**: Process only necessary tasks, skip completed ones

## File Structure

```
src/ai/
├── BatchedLogicalTestGenerator.ts    # Core batched processing logic
├── AITaskPreparation.ts              # Task creation (existing)
├── ClaudeOrchestrator.ts             # AI execution (existing)
└── index.ts                          # Export new batched generator

src/cli/commands/
├── generate-logical-batch.ts         # New dedicated CLI command
├── generate-logical.ts               # Enhanced with batch mode
└── test.ts                           # Integration point

docs/features/
└── batched-ai-processing.md          # This documentation
```

## Benefits

### For Large Projects
- **Memory Efficiency**: Process in smaller chunks
- **Progress Visibility**: See incremental progress
- **Fault Tolerance**: Resume from interruptions
- **Cost Control**: Budget per batch instead of entire project

### For Development Workflow
- **Iterative Processing**: Work on batches between other tasks
- **Flexible Scheduling**: Process when convenient
- **Progress Tracking**: Understand time and cost investment
- **Risk Mitigation**: Stop if issues discovered early

## Limitations

### Not Beneficial For
- **Small projects** (< 20 files requiring AI generation)
- **Simple codebases** (low complexity scores)
- **Single-session requirements** (when all processing needed immediately)

### Technical Constraints
- **Batch size limits**: 1-50 tests per batch (configuration constraint)
- **State file dependencies**: Requires writable `.claude-testing/` directory
- **Sequential processing**: Batches processed one at a time (not parallel)

## Future Enhancements

Potential improvements identified during implementation:
- **Parallel batch processing**: Process multiple batches simultaneously
- **Smart batch sizing**: Automatically optimize batch size based on complexity
- **Cross-session coordination**: Handle multiple concurrent batch processes
- **Advanced retry logic**: Sophisticated failure recovery strategies
- **Batch templates**: Pre-configured batch settings for common scenarios

## Related Documentation

- **AI Integration**: [`./ai-integration.md`](./ai-integration.md) - Overall AI system architecture
- **Commands Reference**: [`../reference/commands.md`](../reference/commands.md) - Complete CLI documentation
- **Development Workflow**: [`../development/workflow.md`](../development/workflow.md) - Integration with development process
- **Architecture Overview**: [`../architecture/overview.md`](../architecture/overview.md) - System design context