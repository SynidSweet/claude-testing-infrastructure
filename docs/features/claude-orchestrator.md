# ClaudeOrchestrator - AI Integration Module

*Enhanced Claude CLI process management with advanced reliability features*

*Last updated: 2025-07-03 | Created enhanced heartbeat monitoring documentation*

## 🎯 Overview

The ClaudeOrchestrator manages parallel Claude processes for AI test generation with sophisticated reliability mechanisms including exponential backoff retry logic, circuit breaker pattern, graceful degradation, and advanced heartbeat monitoring.

## 🏗️ Architecture

### Core Components
- **Process Pool Management**: Controls concurrent Claude CLI processes
- **Task Queue System**: Manages AI task scheduling and distribution
- **Retry Mechanism**: Exponential backoff with jitter for transient failures
- **Circuit Breaker**: Prevents cascading failures when API is down
- **Heartbeat Monitor**: Advanced process health detection with multiple heuristics
- **Graceful Degradation**: Placeholder test generation when CLI unavailable

### Key Classes
- **ClaudeOrchestrator**: Main orchestration class extending EventEmitter
- **ProcessHeartbeat**: Enhanced monitoring state with progress tracking
- **OrchestratorStats**: Execution metrics and reporting

## 🚀 Key Features

### Heartbeat Monitoring (Enhanced 2025-07-03)
Advanced process health monitoring with intelligent heuristics:

```typescript
interface ProcessHeartbeat {
  taskId: string;
  process: ChildProcess;
  lastActivity: Date;
  stdoutBytes: number;
  stderrBytes: number;
  // Enhanced fields
  lastStdinCheck?: Date;
  isWaitingForInput?: boolean;
  consecutiveSlowChecks?: number;
  lastProgressMarker?: string;
  progressHistory?: Array<{
    timestamp: Date;
    bytes: number;
    marker?: string;
  }>;
}
```

#### Progress Marker Detection
Detects AI generation progress through output patterns:
- Test framework markers: `describe(`, `it(`, `test(`, `def test_`
- Generation indicators: "Analyzing", "Generating", "Processing"
- Framework-specific patterns for better accuracy

#### Multi-Metric Health Analysis
Sophisticated health assessment considering:
- Time since last activity vs process age
- Output rate (bytes per second)
- Recent progress markers
- Early phase leniency (first 60 seconds)
- Consecutive slow check tracking

#### Input Wait Detection
Prevents killing processes waiting for user input:
- Detects small output patterns that might be prompts
- Tracks stdin activity expectations
- Avoids false positives for interactive processes

### Timeout Management
Progressive timeout warnings at key thresholds:
- **50% threshold**: Initial warning with state capture
- **75% threshold**: Elevated warning with resource usage
- **90% threshold**: Critical warning before timeout
- Resource usage tracking (CPU, memory) at each threshold

### Reliability Features

#### Exponential Backoff Retry
```typescript
await withRetry(operation, {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 30000,
  backoffFactor: 2,
  jitter: true,
  retryableErrors: [AITimeoutError, AINetworkError, AIRateLimitError]
});
```

#### Circuit Breaker Pattern
Prevents repeated failures from overwhelming the system:
- Opens after 5 consecutive failures
- 1-minute recovery timeout
- Automatic state transitions

#### Graceful Degradation
When Claude CLI is unavailable:
- Generates placeholder tests with TODOs
- Maintains workflow continuity
- Clear indicators of degraded mode

## 📊 Events

The orchestrator emits various events for monitoring:

### Process Events
- `process:slow` - Process running slower than expected
- `process:dead` - Process appears unresponsive
- `process:waiting-input` - Process may be waiting for input
- `timeout:warning` - Timeout threshold reached

### Task Events
- `task:start` - Task processing begun
- `task:complete` - Task finished successfully
- `task:failed` - Task failed after retries
- `task:retry` - Retry attempt initiated

### Batch Events
- `batch:start` - Batch processing started
- `batch:complete` - All tasks in batch completed
- `degradation:enabled` - Graceful degradation activated

### Progress Events
```typescript
interface AIProgressUpdate {
  taskId: string;
  phase: string;
  progress: number;
  message: string;
  warning?: boolean;
  estimatedTimeRemaining?: number;
}
```

## 🔧 Configuration

```typescript
interface ClaudeOrchestratorConfig {
  maxConcurrent?: number;      // Default: 3
  model?: string;              // Default: 'opus'
  fallbackModel?: string;      // Default: 'sonnet'
  retryAttempts?: number;      // Default: 3
  retryDelay?: number;         // Default: 1000ms
  timeout?: number;            // Default: 900000ms (15 min)
  outputFormat?: 'json' | 'text';
  verbose?: boolean;
  gracefulDegradation?: boolean; // Default: true
  exponentialBackoff?: boolean;  // Default: true
  circuitBreakerEnabled?: boolean; // Default: true
  maxRetryDelay?: number;        // Default: 30000ms
}
```

## 📋 Usage Example

```typescript
const orchestrator = new ClaudeOrchestrator({
  maxConcurrent: 3,
  timeout: 900000,
  gracefulDegradation: true
});

// Listen for process health events
orchestrator.on('process:slow', (event) => {
  console.log(`Process ${event.taskId} is slow: ${event.reason}`);
});

orchestrator.on('timeout:warning', (event) => {
  console.log(`Warning: ${event.threshold}% of timeout reached`);
  console.log(`Resource usage:`, event.resourceUsage);
});

// Process batch
const results = await orchestrator.processBatch(batch);
```

## 🧪 Testing

Comprehensive test coverage includes:
- Basic heartbeat monitoring (`heartbeat-monitoring.test.ts`)
- Enhanced monitoring features (`enhanced-heartbeat-monitoring.test.ts`)
- Reliability improvements (`reliability-improvements.test.ts`)
- Timeout warning scenarios
- Progress marker detection
- Input wait detection
- Resource usage tracking

## 🔍 Monitoring & Debugging

### Health Status
```typescript
const status = orchestrator.getReliabilityStatus();
// Returns: {
//   isHealthy: boolean;
//   isDegraded: boolean;
//   circuitBreakerState: string;
//   failureRate: number;
//   successRate: number;
// }
```

### Execution Report
```typescript
const report = orchestrator.generateReport();
// Provides detailed execution statistics
```

## 🚨 Common Issues

### Process Hanging
- Enhanced heartbeat monitoring detects various hanging scenarios
- Progress markers help distinguish active processing from hanging
- Input wait detection prevents false positives

### Timeout Management
- Progressive warnings provide early indication
- Resource usage helps diagnose performance issues
- Configurable timeout with environment variables

### Authentication Errors
- Clear error messages for CLI setup issues
- Graceful degradation when CLI unavailable
- Validation before batch processing

## 📖 Related Documentation

- [`/docs/architecture/ai-integration.md`](../architecture/ai-integration.md) - Overall AI architecture
- [`/docs/development/error-handling.md`](../development/error-handling.md) - Error handling patterns
- [`/docs/testing/ai-validation.md`](../testing/ai-validation.md) - AI validation testing

---

**Module Status**: Production-ready with enhanced reliability features