# Decoupled Testing Suite Demo

This directory contains a complete demonstration of the decoupled testing approach, showing how to test a React application without modifying its source code.

## Demo Contents

### Sample React App
- **Location**: `sample-react-app/`
- **Description**: A simple React application with counter and todo functionality
- **Features**: 
  - Interactive counter with increment/decrement/reset
  - Todo list with add/toggle/delete functionality
  - Well-structured components for testing

### Demo Script
- **File**: `demo.sh`
- **Purpose**: Automated demonstration of the entire decoupled testing workflow

## Running the Demo

### Quick Start
```bash
./demo.sh
```

This will run through the entire process:
1. Discover the project structure
2. Check compatibility
3. Initialize testing configuration
4. Validate the setup
5. Analyze testing opportunities
6. Generate test files
7. Show next steps

### Manual Step-by-Step

If you want to run each step manually:

```bash
# Navigate to the decoupled testing suite
cd ../../decoupled-testing-suite

# Step 1: Discover the project
node scripts/discover-project.js --project-path ../examples/decoupled-demo/sample-react-app

# Step 2: Check compatibility
node scripts/check-compatibility.js --project-path ../examples/decoupled-demo/sample-react-app

# Step 3: Initialize testing
node scripts/init-project.js \
  --project-path ../examples/decoupled-demo/sample-react-app \
  --config-dir ../examples/decoupled-demo/test-config

# Step 4: Validate setup
node scripts/validate-setup.js --config-dir ../examples/decoupled-demo/test-config

# Step 5: Analyze the project
node scripts/analyze-project.js \
  --project-path ../examples/decoupled-demo/sample-react-app \
  --config-dir ../examples/decoupled-demo/test-config
```

## What Gets Generated

After running the demo, you'll find:

### Test Configuration
- `test-config/config.json` - Main configuration file
- `test-config/package.json` - NPM scripts for running tests
- `test-config/README.md` - Documentation for the generated setup

### Test Files
- `test-config/tests/unit/` - Unit test examples
- `test-config/tests/component/` - Component test examples
- `test-config/tests/integration/` - Integration test examples
- `test-config/tests/utils/` - Test utilities and helpers

### Scripts
- `test-config/scripts/run-tests.js` - Test execution script
- Helper scripts for different testing scenarios

## Key Concepts Demonstrated

### Zero Modification Principle
- The sample React app is never modified
- All tests live in the separate `test-config/` directory
- The original project remains untouched

### Framework Detection
- Automatically detects React and its version
- Identifies Create React App structure
- Recognizes testing libraries already present

### Adaptive Configuration
- Generates Jest configuration tailored to the project
- Sets up React Testing Library integration
- Configures appropriate test patterns

### Comprehensive Analysis
- Identifies testable components (App, counter, todo functions)
- Suggests test coverage improvements
- Provides testing recommendations

## Sample Test Output

When tests are run, you should see output like:

```
🧪 Running decoupled tests...
⚙️  Configuration loaded from: test-config
🔧 Environment prepared

 PASS  tests/component/example.component.test.js
 PASS  tests/unit/example.unit.test.js

Test Suites: 2 passed, 2 total
Tests:       5 passed, 5 total
Snapshots:   0 total
Time:        2.45s

✅ All tests passed!
```

## Extending the Demo

### Adding More Tests
1. Examine the generated test templates
2. Create additional test files following the patterns
3. Use the discovered components as guides for what to test

### Customizing Configuration
1. Edit `test-config/config.json` to adjust settings
2. Modify coverage thresholds
3. Add custom test scripts

### Integration with CI/CD
The demo shows how to generate CI/CD configurations that can be added to your project.

## Troubleshooting

### Common Issues

1. **"Cannot find project type"**
   - Ensure you're running from the correct directory
   - Check that the sample React app has all required files

2. **"Permission denied"**
   - Make sure the demo script is executable: `chmod +x demo.sh`
   - Check file permissions in the demo directory

3. **"Dependency errors"**
   - Run `npm install` in the decoupled-testing-suite directory first
   - Ensure Node.js is version 14+ and npm is available

### Getting Help

- Check the main README: `../../README.md`
- Review the decoupled approach guide: `../../decoupled-testing-suite/CLAUDE.md`
- Examine the architecture documentation: `../../ARCHITECTURE.md`

## What This Demonstrates

This demo proves that the decoupled testing suite can:

1. **Analyze any React project** without modification
2. **Generate appropriate test configuration** automatically
3. **Create working test examples** that demonstrate testing patterns
4. **Provide ongoing maintenance** through update and migration scripts
5. **Scale to real projects** by following the same patterns

The key insight is that testing infrastructure can be completely separate from application code while still being effective and maintainable.