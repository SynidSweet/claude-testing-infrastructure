# Process Monitoring

*Last updated: 2025-07-02 | Feature Status: ✅ New Feature | Cross-platform resource debugging*

## Overview

Process Monitoring provides cross-platform utilities for detecting and diagnosing resource-intensive processes that may be affecting system performance during testing workflows. This feature helps users identify orphaned test processes, stuck development servers, and other resource-heavy applications that could impact testing performance.

## Core Functionality

### Cross-Platform Process Detection
- **Unix/Linux support** using `ps` command with comprehensive process information
- **Windows support** using `wmic` for process discovery and resource metrics
- **Unified interface** that abstracts platform differences
- **Resource metrics** including CPU percentage, memory usage, and process metadata

### Testing Framework Recognition
- **Intelligent filtering** using regex patterns for testing-related processes
- **Framework detection** for Jest, Mocha, Pytest, AVA, Vitest, and others
- **Node.js process identification** for development servers and test runners
- **False positive prevention** to avoid system services being flagged as testing processes

### Resource Threshold Configuration
- **Configurable CPU thresholds** (default: 50% for high-resource detection)
- **Memory usage limits** (default: 500MB for resource warnings)
- **Adaptive thresholds** for different use cases (watch mode uses lower thresholds)
- **Multi-criteria filtering** combining CPU and memory metrics

## CLI Interface

### Monitor Command
```bash
# Basic process monitoring
node dist/cli/index.js monitor

# Focus on testing-related processes only
node dist/cli/index.js monitor --testing-only

# Check for high-resource processes only
node dist/cli/index.js monitor --high-resource-only

# Custom resource thresholds
node dist/cli/index.js monitor --cpu-threshold 30 --memory-threshold 200
```

### Command Options

| Option | Description | Default |
|--------|-------------|---------|
| `--cpu-threshold <percent>` | CPU percentage threshold for high-resource detection | 50 |
| `--memory-threshold <mb>` | Memory threshold in MB for high-resource detection | 500 |
| `--testing-only` | Show only testing-related processes | false |
| `--high-resource-only` | Show only high-resource processes | false |

### Output Format
```
PID     NAME                CPU%    MEM(MB)   COMMAND
--------------------------------------------------------------------------------
12345   node                85.2    512       jest --watchAll
23456   python              45.1    256       pytest -v tests/
34567   node                72.3    384       npm run dev

💡 To terminate a process: kill <PID> (or taskkill /PID <PID> on Windows)
```

## Technical Implementation

### ProcessMonitor Class (`src/utils/ProcessMonitor.ts`)
**Purpose**: Core process detection and analysis utility

**Key Methods**:
```typescript
// Detect high-resource processes
static async detectHighResourceProcesses(options?: ProcessMonitorOptions): Promise<ProcessInfo[]>

// Get testing-related processes
static async getTestingProcesses(): Promise<ProcessInfo[]>

// Format process information for display
static formatProcessInfo(processes: ProcessInfo[]): string
```

**Process Detection Strategy**:
- **Unix/Linux**: Uses `ps -eo pid,ppid,pcpu,pmem,comm,args` for comprehensive process information
- **Windows**: Uses `wmic process get ProcessId,ParentProcessId,Name,CommandLine,PageFileUsage`
- **Error handling**: Graceful degradation with logging when process commands fail
- **Resource calculation**: Memory conversion from percentage/KB to MB for consistency

### Testing Framework Patterns
The system uses sophisticated regex patterns to identify testing-related processes:

```typescript
const testingPatterns = [
  /\bjest\b/,           // Jest test runner
  /\bmocha\b/,          // Mocha test runner
  /\bpytest\b/,         // Python pytest
  /\bvitest\b/,         // Vitest
  /\bnode.*test\b/,     // Node.js test files
  /\.test\./,           // Test files
  /\/test\//,           // Test directories
  // ... additional patterns
];
```

**Pattern Strategy**:
- **Word boundaries** (`\b`) to prevent false matches
- **File extension matching** for test files
- **Directory path detection** for test folders
- **Command line analysis** for test execution patterns

## Integration Points

### Watch Mode Integration
Process monitoring integrates seamlessly with watch mode:

```bash
node dist/cli/index.js watch /path/to/project --monitor-processes
```

**Features**:
- **Periodic resource checks** during statistics reporting
- **Non-intrusive monitoring** that doesn't affect watch performance
- **Lower thresholds** (30% CPU, 200MB memory) for continuous monitoring
- **Warning integration** in statistics display

### CLI Command System
- **Consistent command structure** following existing CLI patterns
- **Error handling integration** with shared logging system
- **Help system integration** with automatic command discovery
- **Platform detection** for appropriate troubleshooting guidance

### Troubleshooting Documentation
Comprehensive integration with user troubleshooting guides:
- **Resource issue diagnosis** in `docs/user/troubleshooting.md`
- **Step-by-step solutions** for common scenarios
- **Cross-platform instructions** for process termination
- **Prevention strategies** for avoiding resource issues

## Use Cases

### Development Workflow Debugging
- **Identify stuck Jest watch mode** processes consuming excessive CPU
- **Detect orphaned development servers** running in background
- **Monitor pytest execution** for memory usage patterns
- **Track Node.js processes** during active development

### System Performance Analysis
- **Diagnose slow system responsiveness** during testing
- **Identify resource-intensive background processes** affecting testing
- **Monitor testing framework resource usage** over time
- **Detect process accumulation** from incomplete test shutdowns

### Troubleshooting Assistance
- **Provide specific process information** for support requests
- **Generate actionable process termination commands** for users
- **Identify testing vs. non-testing processes** for focused debugging
- **Cross-platform compatibility** for diverse development environments

## Safety and User Experience

### Non-Intrusive Design
- **Read-only operations** - never modifies or terminates processes
- **Optional functionality** - monitoring only activates when requested
- **Performance optimized** - minimal system impact during detection
- **Graceful error handling** - continues operation when process access fails

### User Guidance
- **Clear termination instructions** for identified processes
- **Platform-specific commands** (kill vs taskkill)
- **Safety warnings** about terminating system processes
- **Educational information** about process types and purposes

### Error Recovery
- **Platform detection failures** fallback to generic guidance
- **Process access limitations** logged with appropriate warnings
- **Command execution errors** handled with user-friendly messages
- **Resource detection failures** return empty results rather than crashing

## Developer Benefits

### Debugging Efficiency
- **Immediate process identification** without manual system tools
- **Testing-focused filtering** reduces noise from system processes
- **Actionable information** including specific termination commands
- **Cross-platform consistency** for team development environments

### Resource Optimization
- **Early warning system** for resource issues during development
- **Proactive monitoring** before system performance degrades
- **Educational insights** about testing framework resource usage
- **Development workflow improvement** through resource awareness

### Integration Advantages
- **Seamless CLI integration** with existing command structure
- **Watch mode enhancement** for continuous resource monitoring
- **Documentation integration** with comprehensive troubleshooting guides
- **Zero configuration** required for basic functionality

---

**Process Monitoring Philosophy**: Provide actionable insights into system resource usage without being intrusive, helping developers maintain optimal testing environments through awareness and guidance.