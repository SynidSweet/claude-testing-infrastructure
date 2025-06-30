# File Chunking System

*Last updated: 2025-06-30 | Created by: /document command | File Chunking Implementation*

## Overview

The file chunking system enables AI-powered logical test generation for large files that exceed token limits (4k+ tokens). This critical feature resolves real-world compatibility issues where complex services couldn't be processed by AI models.

## Problem Solved

**Challenge**: Large files (4k+ tokens) exceeded Claude AI context limits, preventing logical test generation for real-world projects with complex services reaching 9,507+ tokens.

**Solution**: Intelligent file segmentation with context preservation, enabling AI processing of any file size through chunked analysis and result aggregation.

## Core Components

### FileChunker Utility (`src/utils/file-chunking.ts`)

Primary utility for intelligent file segmentation:

#### Key Features
- **Accurate Token Counting**: Claude-specific tokenization estimation considering code patterns
- **Smart Chunking**: Respects function/class boundaries for logical segmentation
- **Context Preservation**: Maintains overlap between chunks for continuity
- **Language Support**: JavaScript/TypeScript and Python-specific patterns
- **Metadata Extraction**: Preserves imports, exports, classes, and functions

#### Core Methods
```typescript
export class FileChunker {
  // Count tokens using Claude-specific estimation
  static countTokens(text: string): number
  
  // Split file into chunks with options
  static async chunkFile(content: string, options: ChunkingOptions): Promise<FileChunk[]>
  
  // Merge results from multiple chunks
  static mergeChunkResults(results: string[]): string
}
```

#### Chunking Strategy
1. **Token Analysis**: Estimate tokens considering code overhead
2. **Boundary Detection**: Split at logical points (functions, classes)
3. **Overlap Creation**: Include context from previous chunk
4. **Metadata Preservation**: Extract and attach file context

### ChunkedAITaskPreparation (`src/ai/ChunkedAITaskPreparation.ts`)

Enhanced AI task preparation supporting chunked file processing:

#### Key Features
- **Composition Pattern**: Extends AITaskPreparation functionality through composition
- **Multi-chunk Orchestration**: Creates separate AI tasks for each chunk
- **Progress Tracking**: Monitors chunk processing status
- **Result Aggregation**: Intelligent merging of chunked test outputs
- **Cost Optimization**: Efficient token usage with chunk-aware estimation

#### Core Methods
```typescript
export class ChunkedAITaskPreparation {
  // Prepare tasks with automatic chunking
  async prepareTasks(gapReport: TestGapAnalysisResult): Promise<AITaskBatch>
  
  // Track chunk processing progress
  getChunkProgress(file: string): ChunkProcessingProgress | undefined
  
  // Merge results from chunked tasks
  static mergeChunkedResults(tasks: ChunkedAITask[], results: Map<string, string>): Map<string, string>
}
```

#### Task Management
- **Automatic Detection**: Files >4k tokens automatically chunked
- **Task Linking**: Related chunks reference each other
- **Sequential Processing**: Maintains chunk order for consistent results
- **Progress Reporting**: Per-file and overall statistics

## Configuration & Usage

### CLI Integration

New command-line flags for chunking control:

```bash
# Enable chunking (default: true)
node dist/cli/index.js test /path/to/project --enable-chunking

# Custom chunk size (default: 3500 tokens)
node dist/cli/index.js test /path/to/project --chunk-size 4000

# Disable chunking for testing
node dist/cli/index.js test /path/to/project --no-enable-chunking
```

### Automatic Operation

Chunking operates automatically when:
- File token count exceeds configured limit (default: 3500)
- `--only-logical` flag is used for AI generation
- Files contain substantial code complexity

### Configuration Options

```typescript
interface ChunkingOptions {
  maxTokensPerChunk?: number;     // Default: 3500
  overlapTokens?: number;         // Default: 200
  preserveContext?: boolean;      // Default: true
  language?: 'javascript' | 'typescript' | 'python';
}
```

## Workflow Integration

### Test Generation Process

1. **File Analysis**: Check token count for each source file
2. **Chunking Decision**: Automatically chunk files exceeding limit
3. **Chunk Creation**: Split file maintaining context
4. **AI Task Generation**: Create separate tasks per chunk
5. **Parallel Processing**: Execute chunk tasks concurrently
6. **Result Merging**: Combine outputs into single test file

### Progress Reporting

Chunking provides detailed progress information:
- Files requiring chunking
- Chunks created per file
- Processing status per chunk
- Token savings achieved
- Aggregation statistics

## Technical Implementation

### Token Counting Algorithm

Accurate estimation considering:
- Character-to-token ratio adjustments
- Code-specific overhead (indentation, syntax)
- String and comment patterns
- Language-specific characteristics

### Context Preservation Strategy

Each chunk includes:
- **File Summary**: High-level context about entire file
- **Chunk Overlap**: Last 200 tokens from previous chunk
- **Import Context**: Relevant imports and dependencies
- **Structural Context**: Classes and functions visible in chunk

### Result Aggregation

Intelligent merging handles:
- **Import Deduplication**: Removes duplicate import statements
- **Test Organization**: Maintains logical test structure
- **Coverage Continuity**: Ensures comprehensive test coverage
- **Quality Preservation**: Maintains test quality across chunks

## Performance & Cost Benefits

### Token Optimization
- **Precise Chunking**: Maximizes token usage without exceeding limits
- **Context Efficiency**: Minimal overlap while preserving continuity
- **Batch Processing**: Optimizes AI API usage

### Real-World Impact
- **Large File Support**: Enables testing of 9,507+ token files
- **Production Compatibility**: Handles complex enterprise codebases
- **Cost Efficiency**: Only chunks when necessary, preserves single-task processing for smaller files

## Error Handling & Edge Cases

### Robust Processing
- **Graceful Degradation**: Falls back to single-task processing on chunk failures
- **Context Validation**: Ensures chunk coherence before processing
- **Result Validation**: Verifies merged outputs for completeness

### Edge Case Handling
- **Very Large Functions**: Handles functions exceeding chunk size
- **Minimal Files**: Skips chunking for files under threshold
- **Parsing Errors**: Robust error handling with meaningful messages

## Monitoring & Debugging

### Chunk Statistics
```typescript
interface ChunkProcessingProgress {
  file: string;
  totalChunks: number;
  processedChunks: number;
  currentChunk: number;
  estimatedTokensSaved: number;
}
```

### Debug Information
- Chunk boundaries and overlap
- Token count per chunk
- Context preservation quality
- Result merging success

## Future Enhancements

### Planned Improvements
- **Adaptive Chunking**: Dynamic chunk size based on content complexity
- **Cross-Chunk References**: Enhanced context sharing between chunks
- **Performance Optimization**: Caching and incremental chunking
- **Quality Metrics**: Chunk quality assessment and optimization

This file chunking system enables the Claude Testing Infrastructure to handle real-world codebases of any size while maintaining the quality and intelligence of AI-generated tests.