# MCP Integration Tests

This directory contains integration tests for the MCP (Model Context Protocol) components of the claude-testing-infrastructure.

## MCPTaskClient Integration Tests

The `MCPTaskClient-integration.test.ts` file contains comprehensive integration tests for the MCPTaskClient that validate real CLI command execution.

### Prerequisites

These integration tests require the `claude-tasks` CLI to be available in your PATH. The tests will automatically check for CLI availability and skip if not found.

#### Installing claude-tasks CLI

The `claude-tasks` CLI is part of the MCP task management system. To install it:

1. **If you have the MCP task system installed locally:**
   ```bash
   # Ensure claude-tasks is in your PATH
   which claude-tasks
   ```

2. **If running in a CI/CD environment:**
   The tests will skip gracefully if the CLI is not available, which is expected behavior.

### Test Coverage

The integration tests cover the following MCPTaskClient functionality:

#### Task Creation Integration
- ✅ **Task creation with JSON response validation** - Tests creating tasks with real CLI and parsing JSON responses
- ✅ **Minimal parameter task creation** - Tests task creation with only required fields
- ✅ **Full parameter task creation** - Tests task creation with all optional fields populated

#### Task Search Integration
- ✅ **Search by title** - Tests searching for tasks by title keywords
- ✅ **Search with status filter** - Tests filtering search results by task status
- ✅ **Search with priority filter** - Tests filtering search results by priority
- ✅ **Empty search results** - Tests handling of searches that return no results

#### Sprint Operations Integration
- ✅ **Get current sprint information** - Tests retrieving active sprint details
- ✅ **Add task to specific sprint** - Tests adding tasks to a named sprint
- ✅ **Add task to current sprint** - Tests automatic sprint detection and task addition
- ✅ **Handle no active sprint** - Tests behavior when no sprint is active

#### Project Statistics Integration
- ✅ **Retrieve project statistics** - Tests getting backlog size, active sprint tasks, completion rates
- ✅ **Cross-validate statistics** - Tests consistency between client results and direct CLI queries

#### Error Handling and Retry Logic
- ✅ **Invalid parameter handling** - Tests graceful handling of invalid task parameters
- ✅ **CLI timeout and retry logic** - Tests retry behavior on command timeouts
- ✅ **Malformed CLI response handling** - Tests parsing of unexpected CLI output

#### CLI Command Formatting Validation
- ✅ **Task creation command formatting** - Tests proper parameter passing and quoting
- ✅ **Search command formatting** - Tests search query and filter formatting
- ✅ **Sprint command formatting** - Tests sprint operation command structure

### Running the Tests

#### Local Development

```bash
# Run all MCP integration tests
npm run test:integration -- tests/mcp/integration/

# Run only MCPTaskClient integration tests
npm run test:integration -- tests/mcp/integration/MCPTaskClient-integration.test.ts

# Run with verbose output
npx jest tests/mcp/integration/MCPTaskClient-integration.test.ts --verbose
```

#### CI/CD Environment

The tests are designed to work in CI/CD environments where the `claude-tasks` CLI may not be available:

```bash
# Tests will skip gracefully if CLI not available
npm run test:integration
```

### Expected Behavior

#### With claude-tasks CLI Available
- ✅ All 17 tests should pass
- ✅ Real tasks will be created and cleaned up automatically
- ✅ Actual CLI commands will be executed and validated
- ✅ JSON responses will be parsed and validated

#### Without claude-tasks CLI Available
- ⚠️ Tests will fail with clear error message: "claude-tasks CLI not available"
- ⚠️ This is expected behavior in environments without the CLI
- ⚠️ No test tasks will be created (safe failure mode)

### Test Configuration

The tests use the following configuration:

```typescript
const TEST_CONFIG = {
  timeout: 30000,        // 30 seconds for CLI operations
  retryAttempts: 2,      // Number of retry attempts for failed commands
  testPrefix: 'MCPTaskClient-Integration-Test', // Prefix for test task names
};
```

### Cleanup

The tests automatically clean up any tasks they create:

- ✅ **Automatic cleanup** - All test tasks are deleted in the `afterAll` hook
- ✅ **Cleanup on failure** - Best-effort cleanup even if tests fail
- ✅ **No side effects** - Tests should not leave persistent data

### Troubleshooting

#### "claude-tasks CLI not available" Error

This is expected if the CLI is not installed. To resolve:

1. Install the claude-tasks CLI system
2. Ensure it's available in your PATH
3. Verify with: `claude-tasks --version`

#### Tests Timeout

If tests timeout, check:

1. CLI responsiveness: `claude-tasks task list --json`
2. System performance: CLI operations should complete within 30 seconds
3. Network connectivity: If using remote task system

#### Permission Errors

If you get permission errors:

1. Ensure you have write access to the task system
2. Check that you can create/delete tasks manually
3. Verify authentication with the task system

### Integration with CI/CD

The integration tests are configured to work seamlessly with CI/CD pipelines:

#### GitHub Actions Example
```yaml
- name: Run MCP Integration Tests
  run: npm run test:integration
  continue-on-error: true  # Allow CI to continue if CLI not available
```

#### Expected CI Behavior
- Tests skip gracefully if CLI unavailable
- No false failures in CI environments
- Clear logging of CLI availability status

### Development Workflow

When working on MCPTaskClient:

1. **Run unit tests first**: `npm run test:unit -- MCPTaskClient`
2. **Install CLI if needed**: Ensure claude-tasks is available
3. **Run integration tests**: `npm run test:integration -- MCPTaskClient-integration`
4. **Check real CLI interaction**: Tests validate actual command execution
5. **Verify cleanup**: Ensure no test tasks remain after test completion

### Future Enhancements

Potential improvements for these tests:

- [ ] **Mock CLI mode**: Option to run tests with mocked CLI for environments without real CLI
- [ ] **Performance benchmarks**: Measure and validate CLI response times
- [ ] **Load testing**: Test MCPTaskClient under high concurrent load
- [ ] **Cross-platform testing**: Validate behavior across different operating systems
- [ ] **Error injection testing**: More sophisticated error scenario testing

---

**Note**: These are true integration tests that require external dependencies. They complement the unit tests in `MCPTaskClient.test.ts` which mock all external dependencies.