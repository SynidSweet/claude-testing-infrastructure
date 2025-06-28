# Troubleshooting Guide

*Common issues and solutions when using Claude Testing Infrastructure*

## 🔍 Quick Diagnosis

### Check Your Setup
```bash
# Verify Node.js version (needs 18+)
node --version

# Verify the CLI is working
npx claude-testing --version

# Check if your project is detectable
npx claude-testing analyze . --verbose
```

## 🚨 Common Issues

### Project Analysis Issues

#### "Project path does not exist"
**Symptoms**: Analysis fails immediately with path error
```bash
Error: Project path does not exist: /path/to/project
```

**Solutions**:
```bash
# Check path is correct
ls -la /path/to/project

# Use absolute path
npx claude-testing analyze $(pwd)/my-project

# Ensure you're in the correct directory
cd /correct/directory && npx claude-testing analyze .
```

#### "No language detected" or "Project type unknown"
**Symptoms**: Analysis shows no languages or frameworks
```bash
Languages: []
Frameworks: []
```

**Solutions**:
```bash
# Check for language indicators
ls package.json setup.py pyproject.toml requirements.txt

# Verify project structure
find . -name "*.js" -o -name "*.py" | head -5

# For JavaScript projects, ensure package.json exists
cat package.json | head -10

# For Python projects, ensure Python files exist
find . -name "*.py" -not -path "*/node_modules/*" | head -5
```

#### "Failed to analyze project: Permission denied"
**Symptoms**: Cannot read project files
```bash
Error: EACCES: permission denied, open '/path/to/file'
```

**Solutions**:
```bash
# Check file permissions
ls -la your-project/

# Fix permissions if needed
chmod -R 755 your-project/

# Run with appropriate user permissions
sudo npx claude-testing analyze your-project
```

### Test Generation Issues

#### "No tests generated" or "0 files analyzed"
**Symptoms**: Test generation completes but no tests created
```bash
Generation Statistics:
• Files analyzed: 0
• Tests generated: 0
```

**Solutions**:
```bash
# Check include/exclude patterns
npx claude-testing analyze . --verbose

# Verify files match patterns
find . -name "*.js" -o -name "*.ts" -o -name "*.jsx" -o -name "*.tsx" -o -name "*.py"

# Use custom config to adjust patterns
cat > .claude-testing.config.json << EOF
{
  "include": ["**/*.{js,ts,jsx,tsx,py}"],
  "exclude": ["**/node_modules/**", "**/dist/**"]
}
EOF

# Regenerate with custom config
npx claude-testing test . --config .claude-testing.config.json
```

#### "Template not found" or "Unknown framework"
**Symptoms**: Test generation fails with template errors
```bash
Error: Template not found for framework: unknown
```

**Solutions**:
```bash
# Check detected framework
npx claude-testing analyze . --format json | grep -A5 "frameworks"

# Force a specific framework
npx claude-testing test . --only-structural

# Check supported frameworks in documentation
npx claude-testing --help
```

#### "Out of memory" during test generation
**Symptoms**: Process crashes with memory errors
```bash
JavaScript heap out of memory
```

**Solutions**:
```bash
# Increase Node.js memory limit
node --max-old-space-size=4096 $(which npx) claude-testing test .

# Process smaller chunks
npx claude-testing test ./src --only-structural
npx claude-testing test ./lib --only-structural

# Exclude large directories
echo "node_modules/\ndist/\nbuild/" > .claudeignore
```

### Test Execution Issues

#### "No test framework detected"
**Symptoms**: Cannot run tests, no framework found
```bash
Error: No suitable test framework found for project
```

**Solutions**:
```bash
# Install test framework in your project
cd your-project

# For JavaScript projects
npm install --save-dev jest @testing-library/react @testing-library/jest-dom

# For Python projects  
pip install pytest pytest-cov

# Specify framework explicitly
npx claude-testing run . --framework jest
npx claude-testing run . --framework pytest
```

#### "Module not found" errors during test execution
**Symptoms**: Tests fail with import/require errors
```bash
Cannot find module 'your-module' from 'test-file.js'
```

**Solutions**:
```bash
# Install your project dependencies first
cd your-project
npm install  # or pip install -r requirements.txt

# Check import paths in generated tests
cat .claude-testing/code/src/Component.test.js

# Verify mock setup
cat .claude-testing/setupTests.js

# Update test configuration if needed
npx claude-testing test . --update
```

#### "Tests pass but coverage is 0%"
**Symptoms**: Tests run successfully but no coverage reported
```bash
Tests: 5 passed
Coverage: 0%
```

**Solutions**:
```bash
# Ensure coverage is enabled
npx claude-testing run . --coverage

# Check coverage configuration
cat your-project/.claude-testing/jest.config.js

# For Python projects, ensure pytest-cov is installed
pip show pytest-cov

# Run with verbose coverage
npx claude-testing run . --coverage --verbose
```

### CLI and Build Issues

#### "Command not found: claude-testing"
**Symptoms**: CLI not available after installation
```bash
bash: claude-testing: command not found
```

**Solutions**:
```bash
# Ensure you built the project
npm run build

# Check if dist/ directory exists
ls -la dist/

# Use npx instead of direct command
npx claude-testing --version

# Verify package.json bin configuration
cat package.json | grep -A3 '"bin"'
```

#### "TypeScript compilation errors"
**Symptoms**: Build fails with TypeScript errors
```bash
src/file.ts:10:5 - error TS2322: Type 'string' is not assignable to type 'number'
```

**Solutions**:
```bash
# Clean and rebuild
npm run clean
npm run build

# Check TypeScript version
npx tsc --version

# Update dependencies
npm update

# Check for type definition issues
npx tsc --noEmit
```

#### "JEST configuration conflicts"
**Symptoms**: Jest fails to run with configuration errors
```bash
Configuration error: Unknown option "setupFilesAfterEnv"
```

**Solutions**:
```bash
# Check Jest version compatibility
npx jest --version

# Update Jest and related packages
npm update jest @types/jest

# Clear Jest cache
npx jest --clearCache

# Check for conflicting jest.config.js files
find . -name "jest.config.*" -type f
```

## 🐛 Debug Mode

### Enable Detailed Logging
```bash
# Full debug output
DEBUG=* npx claude-testing analyze your-project

# Component-specific debugging
DEBUG=claude-testing:analyzer npx claude-testing analyze .
DEBUG=claude-testing:generator npx claude-testing test .
DEBUG=claude-testing:runner npx claude-testing run .
```

### Verbose Output
```bash
# All commands support --verbose
npx claude-testing analyze . --verbose
npx claude-testing test . --verbose
npx claude-testing run . --verbose
```

### Manual Testing
```bash
# Test individual components
cd your-project/.claude-testing

# Run Jest directly
npx jest code/src/Component.test.js --verbose

# Run pytest directly
python -m pytest code/app/test_main.py -v

# Check setup files
node setupTests.js
python conftest.py
```

## 🔧 Advanced Troubleshooting

### Clean Slate Regeneration
```bash
# Remove all generated tests
rm -rf your-project/.claude-testing

# Regenerate from scratch
npx claude-testing test your-project --only-structural

# Verify clean generation
ls -la your-project/.claude-testing
```

### Manual Configuration Override
```bash
# Create minimal config
cat > .claude-testing.config.json << EOF
{
  "include": ["src/**/*.js"],
  "exclude": ["**/*.test.*"],
  "testFramework": "jest",
  "features": {
    "mocking": false,
    "integration": false
  }
}
EOF

# Test with minimal config
npx claude-testing test . --config .claude-testing.config.json
```

### Infrastructure Testing
```bash
# Test the infrastructure itself
cd claude-testing-infrastructure
npm test

# Run specific test suites
npm test -- --testPathPattern=ProjectAnalyzer
npm test -- --testPathPattern=TestGenerator
npm test -- --testPathPattern=TestRunner

# Check infrastructure health
npm run lint
npm run format:check
```

## 🆘 Getting Help

### Report Issues
```bash
# Include this information in issue reports:
echo "## Environment"
echo "Node: $(node --version)"
echo "npm: $(npm --version)"
echo "OS: $(uname -a)"
echo "Infrastructure: $(npx claude-testing --version)"

echo "## Analysis Results"
npx claude-testing analyze . --format json > analysis.json
cat analysis.json

echo "## Debug Output"
DEBUG=* npx claude-testing test . > debug.log 2>&1
cat debug.log
```

### Community Support
- **GitHub Issues**: Report bugs with `@claude` mention for automated assistance
- **Documentation**: Check [`/docs/`](../README.md) for detailed guides
- **Examples**: Review [`/examples/`](../../examples/) for working configurations

### Self-Diagnosis Checklist
- [ ] Node.js 18+ installed and working
- [ ] Project has package.json or Python config files
- [ ] Infrastructure built successfully (`npm run build`)
- [ ] Project dependencies installed in target project
- [ ] File permissions allow reading project files
- [ ] No conflicting test configurations in target project
- [ ] Sufficient disk space for test generation
- [ ] Network access for npm package downloads (if needed)

## 🔄 Version Updates

### Update Infrastructure
```bash
cd claude-testing-infrastructure
git pull origin main
npm install
npm run build
```

### Migration Issues
```bash
# If update breaks existing tests
rm -rf your-project/.claude-testing
npx claude-testing test your-project

# Check for breaking changes
git log --oneline --since="1 week ago"

# Rollback if needed
git checkout previous-tag
npm run build
```

Remember: The infrastructure is designed to be safe and non-intrusive. When in doubt, delete the `.claude-testing` directory and regenerate tests fresh.