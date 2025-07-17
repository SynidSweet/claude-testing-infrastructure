# HeartbeatTestHelper Documentation

*Last updated: 2025-07-16 | Updated: Type safety improvements and API enhancements completed*

## Overview

The `HeartbeatTestHelper` is a comprehensive utility class designed to make testing heartbeat monitoring systems simple and reliable. It provides easy-to-use methods for creating mock processes, simulating health checks, and asserting health outcomes without timer dependencies.

**Production Ready**: Successfully used to achieve 100% unit test coverage for HeartbeatMonitor (51/51 tests passing) and completely refactor integration tests to be event-driven (11/11 tests passing, <1s execution time).

## Key Features

- **Timer-free testing**: No complex timer management or coordination
- **Pre-built scenarios**: Common testing scenarios like healthy, high CPU, silent processes
- **Simple assertions**: Easy-to-use assertion methods for health status validation
- **Mock process management**: Complete process lifecycle simulation
- **Reusable patterns**: Designed for use across multiple projects
- **Type safety**: Proper TypeScript initialization patterns eliminate runtime errors
- **Flexible API**: Enhanced methods support both mock and real metrics analysis

## Quick Start

```typescript
import { HeartbeatTestHelper, expectHealthy, expectUnhealthy } from '@/utils/HeartbeatTestHelper';

describe('Your Heartbeat Tests', () => {
  let helper: HeartbeatTestHelper;

  beforeEach(() => {
    helper = new HeartbeatTestHelper();
  });

  afterEach(() => {
    helper.cleanup();
  });

  it('should detect healthy process', () => {
    const status = helper.simulateHealthCheck('test-task');
    expectHealthy(status);
  });
});
```

## Core Methods

### Process Management

#### `createMockProcess(taskId: string, pid?: number): MockHeartbeatProcess`
Creates a mock process for testing with stdout/stderr emitters and kill functionality.

```typescript
const process = helper.createMockProcess('task-1', 12345);
expect(process.pid).toBe(12345);
expect(process.taskId).toBe('task-1');
```

#### `simulateOutput(taskId: string, content: string, isError?: boolean): void`
Simulates process output to stdout or stderr.

```typescript
helper.simulateOutput('task-1', 'Processing data...');
helper.simulateOutput('task-1', 'Error: something failed', true);
```

#### `simulateCompletion(taskId: string, exitCode?: number): void`
Simulates process completion with exit code.

```typescript
helper.simulateCompletion('task-1', 0); // Success
helper.simulateCompletion('task-1', 1); // Error
```

### Health Checking

#### `simulateHealthCheck(metricsConfig?: MockMetricsConfig, analysisConfig?: AnalysisConfig): HealthStatus`
Performs a health check with custom or default metrics and optional analysis configuration.

```typescript
// Default healthy metrics
const status = helper.simulateHealthCheck();

// Custom metrics with default analysis
const status = helper.simulateHealthCheck({
  cpuPercent: 95,
  memoryMB: 1200,
  errorCount: 10
});

// Custom metrics with custom analysis configuration
const customAnalysis = {
  cpuThreshold: 60,
  memoryThresholdMB: 800,
  maxErrorCount: 30
};
const status = helper.simulateHealthCheck({ cpuPercent: 75 }, customAnalysis);
```

#### `analyzeHealthStatus(metrics: ProcessMetrics, analysisConfig?: AnalysisConfig): HealthStatus`
Analyzes health status for provided real ProcessMetrics (alternative to simulateHealthCheck).

```typescript
// Analyze real metrics
const realMetrics = {
  cpuPercent: 45,
  memoryMB: 400,
  outputRate: 2.0,
  lastOutputTime: Date.now() - 1000,
  errorCount: 0,
  processRuntime: 10000,
  progressMarkers: 10,
  isWaitingForInput: false
};
const status = helper.analyzeHealthStatus(realMetrics);

// With custom analysis configuration
const status = helper.analyzeHealthStatus(realMetrics, customAnalysis);
```

#### `createMockMetrics(config?: MockMetricsConfig): ProcessMetrics`
Creates process metrics for testing.

```typescript
const metrics = helper.createMockMetrics({
  cpuPercent: 75,
  memoryMB: 800,
  outputRate: 2.0
});
```

### Assertions

#### `assertHealthStatus(status: HealthStatus, assertion: HealthStatusAssertion): void`
Detailed assertion for health status properties.

```typescript
helper.assertHealthStatus(status, {
  shouldBeHealthy: true,
  shouldTerminate: false,
  minimumConfidence: 0.8,
  expectedWarnings: ['High CPU usage']
});
```

#### `assertProcessKilled(taskId: string): void`
Verifies that a process was killed.

```typescript
helper.assertProcessKilled('task-1');
```

## Pre-built Scenarios

The helper includes realistic scenarios for common testing cases:

### `helper.scenarios.healthy()`
Normal, healthy process with good metrics.

### `helper.scenarios.highCpu()`
Process with high CPU usage (95%).

### `helper.scenarios.highMemory()`
Process with high memory usage (1500MB).

### `helper.scenarios.silent()`
Process with no output for extended period.

### `helper.scenarios.errorProne()`
Process with high error count (60 errors).

### `helper.scenarios.stalled()`
Process that appears to be waiting for input.

```typescript
// Test different scenarios
const healthyStatus = helper.simulateHealthCheck('task-1', helper.scenarios.healthy());
const highCpuStatus = helper.simulateHealthCheck('task-2', helper.scenarios.highCpu());
const silentStatus = helper.simulateHealthCheck('task-3', helper.scenarios.silent());
```

## Convenience Functions

### `expectHealthy(status: HealthStatus): void`
Quick assertion for healthy status.

```typescript
const status = helper.simulateHealthCheck('task-1');
expectHealthy(status); // Expects isHealthy=true, shouldTerminate=false, confidence>0.5
```

### `expectUnhealthy(status: HealthStatus, shouldTerminate?: boolean): void`
Quick assertion for unhealthy status.

```typescript
const status = helper.simulateHealthCheck('task-1', { errorCount: 60 });
expectUnhealthy(status); // Expects isHealthy=false, warnings.length>0
```

## Pre-built Test Scenarios

### `HeartbeatTestScenarios.testHealthyProcess(helper)`
Tests that a healthy process is correctly identified.

### `HeartbeatTestScenarios.testHighCpuWarning(helper)`
Tests that high CPU processes trigger warnings.

### `HeartbeatTestScenarios.testSilentProcessDetection(helper)`
Tests that silent processes are detected as unhealthy.

```typescript
describe('Common Scenarios', () => {
  it('should handle standard scenarios', () => {
    HeartbeatTestScenarios.testHealthyProcess(helper);
    HeartbeatTestScenarios.testHighCpuWarning(helper);
    HeartbeatTestScenarios.testSilentProcessDetection(helper);
  });
});
```

## Advanced Usage

### Timer Management

```typescript
// Advance mock timer
helper.advanceTime(30000); // 30 seconds

// Get timer for advanced manipulation
const timer = helper.getMockTimer();
timer.advanceTime(60000);
```

### Custom Monitor Creation

```typescript
// Create HeartbeatMonitor with custom config
const monitor = helper.createMonitor({
  scheduler: { intervalMs: 15000 },
  analysis: {
    cpuThreshold: 70,
    memoryThresholdMB: 800,
    maxErrorCount: 30
  }
});
```

### Process Lifecycle Testing

```typescript
it('should handle complete process lifecycle', () => {
  // Create process
  const process = helper.createMockProcess('task-1');
  
  // Simulate activity
  helper.simulateOutput('task-1', 'Starting...');
  helper.simulateOutput('task-1', 'Progress: 50%');
  
  // Check health
  const status = helper.simulateHealthCheck('task-1');
  expectHealthy(status);
  
  // Complete process
  helper.simulateCompletion('task-1', 0);
});
```

## Configuration Options

### MockMetricsConfig
```typescript
interface MockMetricsConfig {
  cpuPercent?: number;        // CPU usage percentage
  memoryMB?: number;          // Memory usage in MB
  outputRate?: number;        // Output rate (lines/min)
  lastOutputTime?: number;    // Timestamp of last output
  errorCount?: number;        // Number of errors
  processRuntime?: number;    // Process runtime in ms
  progressMarkers?: number;   // Number of progress markers
  isWaitingForInput?: boolean; // Whether process is waiting for input
}
```

### HealthStatusAssertion
```typescript
interface HealthStatusAssertion {
  shouldBeHealthy?: boolean;
  shouldTerminate?: boolean;
  expectedWarnings?: string[];
  minimumConfidence?: number;
  expectedReason?: string;
}
```

## Best Practices

1. **Always call cleanup()** in `afterEach` to reset state between tests
2. **Use pre-built scenarios** for common test cases
3. **Use convenience functions** (`expectHealthy`/`expectUnhealthy`) for simple assertions
4. **Test complete process lifecycles** not just individual health checks
5. **Simulate realistic output patterns** for integration testing

## Integration with Existing Tests

The HeartbeatTestHelper can be easily integrated into existing test suites:

```typescript
// Replace complex timer management
// OLD: Complex timer coordination and mocking
// NEW: Simple helper methods

// Replace manual process mocking
// OLD: Manual EventEmitter setup and process simulation
// NEW: helper.createMockProcess() and lifecycle methods

// Replace health status verification
// OLD: Complex assertion chains
// NEW: expectHealthy() and expectUnhealthy()
```

This utility significantly reduces the complexity of testing heartbeat monitoring systems while maintaining comprehensive test coverage and reliability.