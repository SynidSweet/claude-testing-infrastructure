# Active Development Tasks

*This document contains only active, pending tasks that are realistically achievable in standard development sessions (60-80 minutes)*

## 🎯 Current Project Status

**Infrastructure Status**: Production-ready v2.0 in maintenance mode
**Test Suite**: 156/156 tests passing (100% success rate)
**Priority**: Bug fixes and moderate improvements only

## 📋 Pending Moderate Tasks (3-6 hours / 2-3 sessions)

### 1. **Implement Dry-Run Mode**
- **Effort**: 4-5 hours / 2 sessions
- **Priority**: Medium
- **Description**: Add --dry-run flag to test command to preview what tests would be generated without creating files
- **Success Criteria**:
  - [ ] Add --dry-run flag to test command
  - [ ] Show preview of files to be generated
  - [ ] Display file counts and statistics
  - [ ] No files actually created in dry-run mode

### 2. **Fix Analysis Output Flag**
- **Effort**: 3-4 hours / 2 sessions
- **Priority**: Medium
- **Description**: The --output flag for analyze command doesn't save results to file
- **Success Criteria**:
  - [ ] Make --output flag save analysis to specified file
  - [ ] Support JSON format output
  - [ ] Handle file write errors gracefully
  - [ ] Update documentation

### 3. **Improve Progress Reporting**
- **Effort**: 4-5 hours / 2 sessions
- **Priority**: Medium
- **Description**: Test generation provides minimal feedback on large projects
- **Success Criteria**:
  - [ ] Show real-time progress during generation
  - [ ] Display current file being processed
  - [ ] Add progress bar with ETA
  - [ ] Show statistics during generation

### 4. **Create Basic Test Assertion Templates**
- **Effort**: 5-6 hours / 3 sessions
- **Priority**: Medium
- **Description**: Generated tests only contain TODOs without meaningful assertions
- **Success Criteria**:
  - [ ] Generate basic meaningful assertions
  - [ ] Framework-specific test patterns
  - [ ] At least check exports and basic functionality
  - [ ] Improve from 0% to 30% useful tests

### 5. **Add File Count Validation**
- **Effort**: 3-4 hours / 2 sessions
- **Priority**: Medium
- **Description**: System lacks validation of reasonable test-to-source file ratios
- **Success Criteria**:
  - [ ] Calculate accurate source file count
  - [ ] Validate test-to-source ratio
  - [ ] Warn when ratio exceeds threshold
  - [ ] Allow configuration of thresholds

### 6. **Implement Basic Exclude Pattern Fix**
- **Effort**: 4-5 hours / 2 sessions
- **Priority**: Medium
- **Description**: Exclude patterns exist but don't work properly for node_modules
- **Success Criteria**:
  - [ ] Make exclude patterns actually work
  - [ ] Properly exclude node_modules
  - [ ] Fix fast-glob pattern application
  - [ ] Validate with real projects

### 7. **Create Mixed Project Test Cases**
- **Effort**: 3-4 hours / 2 sessions
- **Priority**: Medium
- **Description**: Need test projects that combine Python and JavaScript
- **Success Criteria**:
  - [ ] Create minimal mixed project fixture
  - [ ] Create complex mixed project fixture
  - [ ] Add automated test harness
  - [ ] Document test scenarios

### 8. **Create Missing CLAUDE.md Files**
- **Effort**: 3-4 hours / 2 sessions
- **Priority**: Low
- **Description**: 6 key directories lack CLAUDE.md files for AI agent navigation
- **Success Criteria**:
  - [ ] Create 6 new CLAUDE.md files in docs subdirectories
  - [ ] Each file follows consistent template
  - [ ] Clear navigation between all CLAUDE.md files
  - [ ] AI agents can efficiently navigate documentation

### 9. **Consolidate Template Engines**
- **Effort**: 3-4 hours / 2 sessions
- **Priority**: Low
- **Description**: Template engines share 70% code with only format-specific differences
- **Success Criteria**:
  - [ ] Create BaseTemplateEngine abstract class
  - [ ] Refactor Html/Markdown/Xml engines to extend base
  - [ ] Reduce total code from 378 to ~150 lines
  - [ ] Maintain all functionality

### 10. **Fix Claude CLI Integration Issues**
- **Effort**: 60-85 minutes / 1-2 sessions
- **Priority**: High (if AI features needed)
- **Description**: AI logical test generation has Claude CLI integration failures
- **Success Criteria**:
  - [ ] Fix Claude CLI authentication handling
  - [ ] Add timeout handling (prevent infinite hangs)
  - [ ] Resolve model naming mismatch warnings
  - [ ] Add comprehensive setup documentation

### 11. **Implement Batched Logical Test Creation**
- **Effort**: 50-75 minutes / 1 session
- **Priority**: Medium
- **Description**: Process AI test generation in configurable batches
- **Success Criteria**:
  - [ ] Create iterative script for batched creation
  - [ ] Support configurable batch size (default: 10)
  - [ ] Maintain state between executions
  - [ ] Provide clear progress reporting

## 📊 Task Distribution

- **High Priority**: 1 task (Claude CLI fix - only if AI features needed)
- **Medium Priority**: 10 tasks
- **Low Priority**: 2 tasks

## 🚫 Not Included (Too Large for Standard Sessions)

The following items require investigation phases or are too large:
- Configuration Auto-Discovery Investigation (6+ hours)
- File Discovery Service Investigation (8+ hours)
- Language-Specific Generators Investigation (8+ hours)
- Configuration Management System Epic (20+ hours)
- File Discovery Architecture Overhaul Epic (25+ hours)
- Multi-Language Architecture Epic (30+ hours)
- Intelligent Test Generation System Epic (40+ hours)

These items are documented in `/docs/planning/FUTURE_WORK.md` for reference.

## 🎯 Recommended Next Steps

1. **If AI features are critical**: Fix Claude CLI Integration first
2. **For general improvements**: Start with Dry-Run Mode or Progress Reporting
3. **For test quality**: Focus on Basic Test Assertion Templates
4. **For robustness**: Implement File Count Validation and Exclude Pattern Fix

---

*Last updated: 2025-06-30*
*Use `/user:carry-on` to pick up the highest priority task*