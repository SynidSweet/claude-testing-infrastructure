# ProcessPoolManager Service

*Last updated: 2025-07-13 | Initial documentation after extraction from ClaudeOrchestrator*

## 🎯 Purpose

The ProcessPoolManager is a dedicated service extracted from ClaudeOrchestrator to handle process lifecycle management for Claude AI subprocesses. It provides centralized process monitoring, heartbeat tracking, and resource management with a clean event-driven interface.

## 🏗️ Architecture

### Service Extraction
The ProcessPoolManager was extracted as part of the ClaudeOrchestrator modernization effort to separate concerns:

- **Before**: 1720-line monolithic ClaudeOrchestrator handling everything
- **After**: 350-line focused ProcessPoolManager + 1650-line coordinating ClaudeOrchestrator

### Core Responsibilities

1. **Process Registration & Lifecycle**
   - `registerProcess(taskId, process)` - Register new Claude subprocess
   - `unregisterProcess(taskId)` - Clean up process monitoring
   - `getProcessInfo(taskId)` - Access process metadata

2. **Capacity Management**
   - `isAtMaxCapacity()` - Check against configured limits
   - `getActiveProcessCount()` - Current process count
   - `getActiveTaskIds()` - List of active tasks

3. **Process Termination**
   - `killProcess(taskId)` - Graceful then forceful termination
   - `killAllProcesses()` - Emergency shutdown
   - `cleanup()` - Full resource cleanup

4. **Monitoring Integration**
   - Heartbeat monitoring via HeartbeatMonitor
   - Resource usage tracking via ProcessMonitor
   - Progress marker detection in output
   - Activity timestamp updates

## 🔌 Event System

### Emitted Events

```typescript
interface ProcessPoolEvents {
  'process-started': { taskId: string; process: ChildProcess };
  'process-completed': { taskId: string; success: boolean };
  'process-failed': { taskId: string; error: Error };
  'process-timeout': { taskId: string };
  'process-killed': { taskId: string };
  'heartbeat-warning': { taskId: string; threshold: number };
  'resource-warning': { taskId: string; usage: ProcessResourceUsage };
}
```

### Event Integration
The ClaudeOrchestrator forwards all ProcessPoolManager events to maintain API compatibility:

```typescript
this.processPoolManager.on('process-started', (event) => {
  this.emit('process-started', event);
});
```

## 🔧 Configuration

### ProcessPoolConfig
```typescript
interface ProcessPoolConfig {
  maxConcurrent?: number;    // Default: 3
  timeout?: number;          // Default: 900000ms (15 min)
  timerService?: TestableTimer;  // Injected for testability
}
```

### Heartbeat Integration
The service integrates with the existing HeartbeatMonitor system:
- Automatic process monitoring startup/shutdown
- Progress marker detection in subprocess output
- Resource usage warnings and alerts
- Dead process detection and cleanup

## 📍 Integration Points

### ClaudeOrchestrator Integration
```typescript
// Process registration in executeClaudeProcess()
this.processPoolManager.registerProcess(task.id, claude);

// Process cleanup on completion/timeout
this.processPoolManager.unregisterProcess(task.id);

// Capacity checking before task execution
if (this.processPoolManager.isAtMaxCapacity()) {
  // Queue task for later
}
```

### HeartbeatMonitor Integration
```typescript
// Automatic heartbeat monitoring
this.heartbeatAdapter.startMonitoring(taskId, process);
this.heartbeatAdapter.stopMonitoring(taskId);

// Activity updates
this.processPoolManager.updateProcessActivity(taskId, bytesReceived, progressMarker);
```

## 🧪 Testing

### Test Coverage
- **Process registration/unregistration**: Verify proper lifecycle management
- **Heartbeat integration**: Mock HeartbeatMonitor interactions
- **Resource monitoring**: Test ProcessMonitor integration
- **Event emission**: Verify all events are properly emitted
- **Capacity management**: Test concurrent process limits
- **Cleanup operations**: Ensure proper resource cleanup

### Test Structure
```typescript
describe('ProcessPoolManager', () => {
  let manager: ProcessPoolManager;
  let mockProcess: ChildProcess;
  
  beforeEach(() => {
    manager = new ProcessPoolManager({ maxConcurrent: 2 });
    mockProcess = createMockProcess();
  });
  
  it('should register and track processes', () => {
    manager.registerProcess('test-1', mockProcess);
    expect(manager.getActiveProcessCount()).toBe(1);
    expect(manager.getProcessInfo('test-1')).toBeDefined();
  });
});
```

## 🔄 Migration Pattern

The ProcessPoolManager extraction follows a standard service extraction pattern:

1. **Identify boundaries** - Process management vs. task/result management
2. **Extract interface** - Define clear public API
3. **Preserve events** - Maintain existing event contracts
4. **Delegate operations** - Replace direct calls with service calls
5. **Test compatibility** - Ensure existing tests still pass

This pattern will be repeated for:
- TaskQueueManager (next)
- ResultAggregator  
- Final ClaudeOrchestrator coordination layer

## 🚀 Future Enhancements

### Planned Improvements
1. **Unit Test Coverage**: Comprehensive testing of the extracted service
2. **Performance Metrics**: Enhanced monitoring and reporting
3. **Process Pooling**: Reuse processes across tasks for efficiency
4. **Resource Limits**: Per-process memory and CPU limits

### Integration Opportunities
- **Standalone Usage**: ProcessPoolManager could be used by other components
- **Plugin Architecture**: Support for different process types beyond Claude
- **Monitoring Dashboard**: Real-time process health visualization

## 📖 Related Documentation

- **Architecture**: [`../architecture/overview.md`](../architecture/overview.md) - Full architectural context
- **ClaudeOrchestrator**: [`./claude-orchestrator.md`](./claude-orchestrator.md) - Parent service documentation
- **Heartbeat System**: [`./process-monitoring.md`](./process-monitoring.md) - Monitoring integration
- **Planning**: [`../planning/REFACTORING_PLAN.md`](../planning/REFACTORING_PLAN.md) - Remaining modernization tasks

---

**Service Philosophy**: Single responsibility with clean interfaces - ProcessPoolManager handles only process lifecycle, nothing more.