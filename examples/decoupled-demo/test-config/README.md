# Test Configuration

This directory contains the decoupled testing configuration for your project.

## Configuration

- **Project**: /code/personal/claude-testing/examples/decoupled-demo/sample-react-app
- **Language**: javascript
- **Test Framework**: jest
- **Coverage Threshold**: 80%

## Quick Commands

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run tests for CI
npm run test:ci
```

## Directory Structure

- `tests/` - Test files organized by type
- `scripts/` - Helper scripts for test execution
- `config.json` - Main configuration file

## Framework Detection

Detected frameworks: react

## Test Types

Enabled test types:
- unit
- integration

## Coverage

Coverage reports are generated in the `coverage/` directory.
Minimum threshold: 80%

## Updating

To update the test configuration, run:
```bash
npm run init -- --force
```

## Troubleshooting

If tests fail to run:
1. Ensure all dependencies are installed in the target project
2. Check that the project path is correct
3. Verify the test framework is properly configured
4. Check the error logs for specific issues

Generated on: 27/06/2025, 14:17:52
