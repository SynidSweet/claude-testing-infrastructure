# Safe Testing Guide for Claude Testing Infrastructure

## Overview

The infrastructure has built-in recursion prevention to avoid catastrophic scenarios where it tries to test itself, leading to exponential process spawning. This guide explains how to safely run tests.

## The Problem

Testing the infrastructure on itself can cause:
- **Exponential process spawning**: Each test spawns Jest, which spawns Claude CLI, which could spawn more tests
- **System resource exhaustion**: Hundreds of processes consuming CPU and memory
- **Claude API quota depletion**: Rapid consumption of API tokens
- **System crashes**: Complete system lockup requiring hard reboot

## Safety Mechanisms

### 1. Environment Variable Protection

The infrastructure checks for `DISABLE_HEADLESS_AGENTS=true`:
- When set, ClaudeOrchestrator refuses to spawn any Claude processes
- Aggressive error messages ensure the block is noticed
- This is the primary safety mechanism

### 2. Smart Process Monitoring

We've created scripts that distinguish between:
- **Headless Claude processes**: Spawned by tests (dangerous)
- **Interactive Claude sessions**: Your normal Claude CLI usage (safe)

The smart monitors only kill headless processes, protecting your work sessions.

## Safe Testing Scripts

### 1. `run-safe-tests.sh` - Run Most Tests Safely
```bash
./run-safe-tests.sh
```
- Excludes all AI-related tests that might spawn processes
- Runs tests sequentially (not in parallel)
- Monitors for runaway processes
- Safe for regular CI/CD usage

### 2. `monitor-test-run.sh` - Run All Tests with Monitoring
```bash
./monitor-test-run.sh
```
- Sets `DISABLE_HEADLESS_AGENTS=true`
- Monitors for headless Claude processes
- Kills only headless processes (not your interactive sessions)
- Shows detailed process classification

### 3. `test-one-ai-test.sh` - Test Single AI Test Safely
```bash
./test-one-ai-test.sh
```
- Tests ProcessMonitor by default (safe test)
- Can be modified to test other single test files
- Smart monitoring that protects interactive sessions
- 30-second timeout for safety

### 4. `safe-test-check.js` - Identify Risky Tests
```bash
node safe-test-check.js
```
- Scans all test files for process-spawning patterns
- Identifies which tests are risky
- Generates safe test commands

## How the Smart Detection Works

The scripts identify headless processes by checking:
1. **Parent process**: Is it spawned by jest or node?
2. **Command arguments**: Contains `--model` but not `--interactive`?
3. **TTY attachment**: Interactive sessions have TTY, headless don't
4. **Process patterns**: Specific to test-spawned processes

## Manual Testing Guidelines

### Testing AI Features Safely

1. **Always set the environment variable**:
   ```bash
   export DISABLE_HEADLESS_AGENTS=true
   ```

2. **Test AI features individually**:
   ```bash
   DISABLE_HEADLESS_AGENTS=true npm test -- tests/ai/specific-test.test.ts
   ```

3. **Monitor while testing**:
   ```bash
   # In one terminal
   watch 'ps aux | grep claude | grep -v grep'
   
   # In another terminal
   DISABLE_HEADLESS_AGENTS=true npm test
   ```

### If Things Go Wrong

1. **Emergency kill (headless only)**:
   ```bash
   # Kill headless Claude processes only
   ps aux | grep -E "claude.*--model" | grep -v interactive | awk '{print $2}' | xargs kill -9
   
   # Kill jest processes
   pkill -f "jest.*claude-testing"
   ```

2. **Check for zombie processes**:
   ```bash
   ps aux | grep defunct
   ```

3. **Clean up test artifacts**:
   ```bash
   rm -rf .claude-testing/
   rm -f jest.config.safe.js
   ```

## CI/CD Configuration

For CI/CD pipelines, always:

1. Set environment variable:
   ```yaml
   env:
     DISABLE_HEADLESS_AGENTS: true
   ```

2. Use safe test command:
   ```yaml
   - run: ./run-safe-tests.sh
   ```

3. Or exclude AI tests:
   ```yaml
   - run: npm test -- --testPathIgnorePatterns="tests/ai|tests/validation/ai-agents"
   ```

## Summary

The infrastructure is safe to test when proper precautions are taken:
- ✅ Use the provided safe testing scripts
- ✅ Set `DISABLE_HEADLESS_AGENTS=true` when testing manually
- ✅ Monitor processes when testing AI features
- ✅ Use smart monitors that protect interactive sessions
- ❌ Never run full test suite without safety measures
- ❌ Never use scripts that blindly kill all Claude processes

The smart monitoring approach ensures your interactive Claude sessions remain safe while still providing protection against runaway test processes.