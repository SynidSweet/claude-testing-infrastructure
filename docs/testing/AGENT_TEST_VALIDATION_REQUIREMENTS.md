# Agent Test Validation Requirements

## 🚨 CRITICAL: Test Execution Validation is MANDATORY

This document outlines the **mandatory** test validation requirements that ALL agents must follow when working on this project. Failure to follow these requirements will result in false success claims and broken CI/CD pipelines.

## ❌ The Problem We're Solving

Agents have been claiming "100% test pass rates" and "successful CI/CD" when in reality:
- 38 tests are failing out of 1213 total
- Multiple Jest configurations have `--passWithNoTests` allowing false success
- Empty test discovery patterns cause "No tests found" but still exit 0
- CI/CD pipeline is actually failing but agents don't verify properly

## ✅ Mandatory Validation Requirements

### 1. **NEVER Trust Exit Codes Alone**

```bash
# ❌ WRONG - This can lie!
npm test
echo "Tests passed!"

# ✅ CORRECT - Verify actual execution
npm test | tee test-output.log
grep -E "Tests:.*[0-9]+ passed.*[0-9]+ total" test-output.log || exit 1
```

### 2. **Always Verify Test Counts**

Before claiming tests pass, you MUST verify:
- **Actual test count**: Extract and verify `Tests: X passed, Y total`
- **No zero tests**: Ensure the count is NOT "0 total" or "No tests found"
- **No failures**: Check for "X failed" and ensure it's 0

Example validation:
```bash
# Run test and capture output
TEST_OUTPUT=$(npm test 2>&1)

# Extract test counts
TOTAL_TESTS=$(echo "$TEST_OUTPUT" | grep -oE "Tests:.*?([0-9]+) total" | grep -oE "[0-9]+" | tail -1)
FAILED_TESTS=$(echo "$TEST_OUTPUT" | grep -oE "Tests:.*?([0-9]+) failed" | grep -oE "[0-9]+" | head -1)

# Validate
if [ -z "$TOTAL_TESTS" ] || [ "$TOTAL_TESTS" -eq 0 ]; then
  echo "ERROR: No tests were executed!"
  exit 1
fi

if [ -n "$FAILED_TESTS" ] && [ "$FAILED_TESTS" -gt 0 ]; then
  echo "ERROR: $FAILED_TESTS tests failed!"
  exit 1
fi

echo "✓ Validated: $TOTAL_TESTS tests executed successfully"
```

### 3. **Use Validation Scripts**

The project provides validation scripts that MUST be used:

```bash
# Quick validation (for development)
npm run validate:test-quick

# Full test count validation
npm run validate:test-counts

# CI/CD validation
npm run validate:test-execution
```

### 4. **CI/CD Verification Requirements**

When claiming CI/CD success, you MUST:

1. **Run the validation script**:
   ```bash
   node scripts/validate-ci-cd-success.js
   ```

2. **Check GitHub Actions directly**:
   ```bash
   gh run list --limit 5
   gh run view <run-id> --log
   ```

3. **Verify ALL checks pass**, not just one

### 5. **Configuration Checks**

Before any test execution:

1. **Check for passWithNoTests**:
   ```bash
   grep -r "passWithNoTests: true" jest*.config.js
   # This should return NOTHING - if it finds matches, fix them!
   ```

2. **Verify testMatch patterns**:
   ```bash
   grep -r "testMatch: \[\]" jest*.config.js
   # This should return NOTHING - empty patterns = no tests!
   ```

## 🛡️ Validation Safeguards

### Pre-commit Hook
The project now includes a pre-commit hook that validates tests:
```bash
# Automatically runs on git commit
# Validates test execution and counts
# Blocks commits if tests don't actually run
```

### Sprint Validation Integration
```bash
# Use comprehensive validation for sprint completion
npm run sprint:validate

# This includes:
# - Test count validation
# - Actual test execution verification  
# - CI/CD pipeline status
# - Documentation truth validation
```

## 📋 Agent Checklist

Before claiming ANY test success:

- [ ] Ran tests and captured output (not just exit code)
- [ ] Verified test count > 0 using grep/validation scripts
- [ ] Checked for failing tests in output
- [ ] Ran `npm run validate:test-quick` successfully
- [ ] If claiming CI/CD success, ran `validate-ci-cd-success.js`
- [ ] No `passWithNoTests: true` in any Jest config
- [ ] No empty `testMatch: []` patterns

## 🚨 Red Flags to Watch For

These outputs indicate FALSE SUCCESS:
- `No tests found`
- `Test Suites: 0 total`
- `Tests: 0 total` 
- Exit code 0 with no test execution logs
- `--passWithNoTests` in commands

## 💡 Quick Commands

```bash
# Validate everything is working
npm run validate:test-counts

# Check a specific test command
npm run test:unit -- --listTests | wc -l  # Should be > 0

# Quick pre-commit validation
npm run validate:test-quick

# Full CI/CD validation
node scripts/validate-ci-cd-success.js
```

## ⚠️ Final Warning

**NEVER** claim test success without validation. The days of "exit code 0 = success" are OVER. Every test claim must be backed by evidence of actual test execution with specific counts.

Remember: It's better to report a problem than to falsely claim success!