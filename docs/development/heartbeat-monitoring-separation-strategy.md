# Heartbeat Monitoring Separation Strategy

*Task: TASK-TIMER-010 - Refactor heartbeat monitoring for complete testability*
*Created: 2025-07-08*

## 🎯 Objective

Separate timer concerns from business logic in heartbeat monitoring to enable complete test control and eliminate timing-related test failures.

## 📊 Current Architecture Analysis

### Current Implementation (ClaudeOrchestrator.ts)
```
ClaudeOrchestrator
├── ProcessHeartbeat management
├── Timer scheduling (setInterval/setTimeout)
├── Health check logic
├── Process metrics analysis
├── Event emission
└── Process termination logic
```

### Problems
1. **Tight Coupling**: Business logic mixed with timer management
2. **Test Brittleness**: Tests require precise timer advancement
3. **Limited Control**: Cannot easily test edge cases
4. **Complex Mocking**: Tests use brittle Jest fake timers

## 🏗️ Proposed Architecture

### Component Separation
```
HeartbeatMonitor (Facade)
├── HeartbeatScheduler (Timer Management)
│   ├── Uses injected TestableTimer
│   ├── Manages intervals/timeouts
│   └── Triggers health checks
├── ProcessHealthAnalyzer (Business Logic)
│   ├── Pure functions
│   ├── Analyzes process metrics
│   └── Determines health status
└── Event emission & backward compatibility
```

## 📋 Implementation Plan

### Phase 1: Create Core Components

#### 1.1 ProcessHealthAnalyzer (Pure Functions)
```typescript
// src/ai/heartbeat/ProcessHealthAnalyzer.ts
export interface ProcessMetrics {
  cpuPercent: number;
  memoryMB: number;
  outputRate: number;
  lastOutputTime: number;
  errorCount: number;
  processRuntime: number;
  progressMarkers: number;
}

export interface HealthStatus {
  isHealthy: boolean;
  shouldTerminate: boolean;
  warnings: string[];
  confidence: number;
  reason?: string;
}

export class ProcessHealthAnalyzer {
  static analyzeHealth(
    metrics: ProcessMetrics,
    config: HealthAnalysisConfig
  ): HealthStatus {
    // Pure function - no side effects, no timers
  }

  static calculateOutputRate(
    outputs: OutputEntry[],
    windowMs: number
  ): number {
    // Pure calculation
  }

  static detectProgressMarkers(
    output: string,
    patterns: string[]
  ): boolean {
    // Pure pattern matching
  }
}
```

#### 1.2 HeartbeatScheduler (Timer Management)
```typescript
// src/ai/heartbeat/HeartbeatScheduler.ts
export class HeartbeatScheduler {
  constructor(
    private timerService: TestableTimer,
    private config: SchedulerConfig
  ) {}

  scheduleChecks(
    taskId: string,
    onCheck: () => void
  ): ScheduledCheck {
    const handle = this.timerService.setInterval(
      onCheck,
      this.config.intervalMs
    );
    return { taskId, handle };
  }

  scheduleTimeout(
    onTimeout: () => void,
    delayMs: number
  ): TimerHandle {
    return this.timerService.setTimeout(onTimeout, delayMs);
  }

  cancelCheck(check: ScheduledCheck): void {
    this.timerService.clearInterval(check.handle);
  }
}
```

#### 1.3 HeartbeatMonitor (Facade)
```typescript
// src/ai/heartbeat/HeartbeatMonitor.ts
export class HeartbeatMonitor extends EventEmitter {
  constructor(
    private scheduler: HeartbeatScheduler,
    private analyzer: ProcessHealthAnalyzer,
    private processMonitor: ProcessMonitor
  ) {
    super();
  }

  startMonitoring(taskId: string, pid: number): void {
    // Coordinates scheduler and analyzer
    // Emits events for backward compatibility
  }

  private performHealthCheck(taskId: string): void {
    const metrics = this.collectMetrics(taskId);
    const status = ProcessHealthAnalyzer.analyzeHealth(
      metrics,
      this.config
    );
    this.handleHealthStatus(taskId, status);
  }
}
```

### Phase 2: Integration with ClaudeOrchestrator

#### 2.1 Update ClaudeOrchestrator Constructor
```typescript
class ClaudeOrchestrator {
  private heartbeatMonitor: HeartbeatMonitor;

  constructor(config: ClaudeOrchestratorConfig) {
    // Use existing timerService from config
    const scheduler = new HeartbeatScheduler(
      config.timerService || new RealTimer(),
      { intervalMs: this.HEARTBEAT_INTERVAL }
    );
    
    this.heartbeatMonitor = new HeartbeatMonitor(
      scheduler,
      ProcessHealthAnalyzer,
      this.processMonitor
    );

    // Wire up event handlers
    this.heartbeatMonitor.on('unhealthy', this.handleUnhealthy.bind(this));
    this.heartbeatMonitor.on('warning', this.handleWarning.bind(this));
  }
}
```

#### 2.2 Replace Direct Heartbeat Methods
```typescript
// Replace startHeartbeatMonitoring
private startHeartbeatMonitoring(taskId: string, childProcess: ChildProcess): void {
  this.heartbeatMonitor.startMonitoring(taskId, childProcess.pid!);
}

// Replace stopHeartbeatMonitoring
private stopHeartbeatMonitoring(taskId: string): void {
  this.heartbeatMonitor.stopMonitoring(taskId);
}
```

### Phase 3: Test Migration

#### 3.1 Unit Tests for ProcessHealthAnalyzer
```typescript
describe('ProcessHealthAnalyzer', () => {
  it('should detect unhealthy process with high CPU', () => {
    const metrics: ProcessMetrics = {
      cpuPercent: 95,
      memoryMB: 500,
      outputRate: 0.5,
      lastOutputTime: Date.now(),
      errorCount: 0,
      processRuntime: 60000,
      progressMarkers: 10
    };

    const status = ProcessHealthAnalyzer.analyzeHealth(
      metrics,
      defaultConfig
    );

    expect(status.isHealthy).toBe(false);
    expect(status.warnings).toContain('High CPU usage');
  });
});
```

#### 3.2 Integration Tests with MockTimer
```typescript
describe('HeartbeatMonitor Integration', () => {
  let monitor: HeartbeatMonitor;
  let mockTimer: MockTimer;

  beforeEach(() => {
    mockTimer = new MockTimer();
    const scheduler = new HeartbeatScheduler(mockTimer, { intervalMs: 30000 });
    monitor = new HeartbeatMonitor(scheduler, ProcessHealthAnalyzer, mockProcessMonitor);
  });

  it('should perform health checks at intervals', async () => {
    const checkSpy = jest.fn();
    monitor.on('healthCheck', checkSpy);

    monitor.startMonitoring('task-1', 1234);

    // Advance exactly to trigger interval
    await mockTimer.advanceTime(30000);
    
    expect(checkSpy).toHaveBeenCalledTimes(1);
  });
});
```

### Phase 4: Migration Strategy

#### 4.1 Incremental Migration
1. Create new components alongside existing code
2. Update ClaudeOrchestrator to use new components
3. Maintain backward compatibility through events
4. Migrate tests incrementally
5. Remove old implementation after validation

#### 4.2 Risk Mitigation
- Keep existing public API unchanged
- Add comprehensive logging during migration
- Run parallel testing (old vs new)
- Feature flag for rollback if needed

## 🧪 Testing Strategy

### Unit Test Coverage
- **ProcessHealthAnalyzer**: 100% coverage of analysis logic
- **HeartbeatScheduler**: Timer interaction tests
- **HeartbeatMonitor**: Integration and event tests

### Test Patterns
```typescript
// Deterministic health analysis
const status = ProcessHealthAnalyzer.analyzeHealth(knownMetrics, config);
expect(status).toEqual(expectedStatus);

// Controlled timer behavior
mockTimer.advanceTime(30000);
expect(healthCheckCallback).toHaveBeenCalled();

// Event verification
monitor.on('warning', warningHandler);
// Trigger conditions
expect(warningHandler).toHaveBeenCalledWith(expectedWarning);
```

## 📊 Success Metrics

1. **Test Reliability**: Eliminate timing-related test failures
2. **Test Speed**: Reduce test execution time by 50%
3. **Code Coverage**: Achieve 95%+ coverage on health logic
4. **Maintainability**: Clear separation of concerns
5. **Backward Compatibility**: No breaking changes

## 🚀 Next Steps

1. ✅ Strategy documented
2. Create ProcessHealthAnalyzer with pure functions
3. Implement HeartbeatScheduler with timer injection
4. Build HeartbeatMonitor facade
5. Integrate with ClaudeOrchestrator
6. Migrate and enhance tests
7. Validate and cleanup

## 📚 References

- Timer abstraction: `/docs/features/testable-timer-system.md`
- Current implementation: `/src/ai/ClaudeOrchestrator.ts`
- Test files: `/tests/ai/*heartbeat*.test.ts`
- Task definition: TASK-TIMER-010 in REFACTORING_PLAN.md