# Troubleshooting Guide

*Common issues and solutions when using Claude Testing Infrastructure*

*Last updated: 2025-07-01 | Updated by: /document command | Enhanced AI troubleshooting*

## 🔍 Quick Diagnosis

### Check Your Setup
```bash
# Verify Node.js version (needs 18+)
node --version

# Verify the CLI is working (should show clean output)
node dist/src/cli/index.js --version

# Check if your project is detectable
node dist/src/cli/index.js analyze . --verbose
```

**Note**: As of version 2.0.0, the CLI provides clean output for `--version` and `--help` commands without spurious error messages.

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
node dist/src/cli/index.js analyze $(pwd)/my-project

# Ensure you're in the correct directory
cd /correct/directory && node dist/src/cli/index.js analyze .
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
sudo node dist/src/cli/index.js analyze your-project
```

#### "Git dubious ownership" warnings
**Symptoms**: Git warnings about repository ownership
```bash
fatal: detected dubious ownership in repository at '/path/to/repo'
```

**Solutions**:
```bash
# Add infrastructure directory to git safe.directory
git config --global --add safe.directory "$(pwd)"

# For target project directories
git config --global --add safe.directory "/path/to/your/project"

# Or for AI agents, add multiple directories
git config --global --add safe.directory "*"
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
node dist/src/cli/index.js analyze . --verbose

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
node dist/src/cli/index.js test . --config .claude-testing.config.json
```

#### "Template not found" or "Unknown framework"
**Symptoms**: Test generation fails with template errors
```bash
Error: Template not found for framework: unknown
```

**Solutions**:
```bash
# Check detected framework
node dist/src/cli/index.js analyze . --format json | grep -A5 "frameworks"

# Force a specific framework
node dist/src/cli/index.js test . --only-structural

# Check supported frameworks in documentation
node dist/src/cli/index.js --help
```

#### Python Import Syntax Errors ✅ FIXED (2025-06-29)
**Previous Issue**: Python test files had malformed import statements
```python
# Malformed imports that would cause syntax errors:
from main import     # Empty import
from helper import helper_function  # Wrong module path
class TestSrc.utils.helper:  # Invalid class name
```

**Current Status**: This issue has been fixed in the latest version. Python tests now generate with:
- Correct module paths (`from src.utils.helper import helper_function`)
- Proper handling of files with no exports (`import main`)
- Valid class names (`class TestSrc_utils_helper:`)

**If You Still See This Issue**:
```bash
# Ensure you have the latest version
git pull origin main
npm install
npm run build

# Regenerate your tests
rm -rf .claude-testing
node dist/src/cli/index.js test . --only-structural
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
node dist/src/cli/index.js test ./src --only-structural
node dist/src/cli/index.js test ./lib --only-structural

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
node dist/src/cli/index.js run . --framework jest
node dist/src/cli/index.js run . --framework pytest
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
node dist/src/cli/index.js test . --update
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
node dist/src/cli/index.js run . --coverage

# Check coverage configuration
cat your-project/.claude-testing/jest.config.js

# For Python projects, ensure pytest-cov is installed
pip show pytest-cov

# Run with verbose coverage
node dist/src/cli/index.js run . --coverage --verbose
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
node dist/src/cli/index.js --version

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

#### "Error messages with --version or --help"
**Symptoms**: CLI shows error logs even for working commands (**FIXED in v2.0.0**)
```bash
# Before fix - showed error messages despite working
node dist/src/cli/index.js --version
# ERROR Unexpected error: 2.0.0 ...CommanderError...

# After fix - clean output
node dist/src/cli/index.js --version
# 2.0.0
```

**Solution**: Update to version 2.0.0 or later. The CLI now properly handles Commander.js error codes for normal operations like `--version` and `--help`, providing clean output while maintaining proper error handling for actual errors.

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
DEBUG=* node dist/src/cli/index.js analyze your-project

# Component-specific debugging
DEBUG=claude-testing:analyzer node dist/src/cli/index.js analyze .
DEBUG=claude-testing:generator node dist/src/cli/index.js test .
DEBUG=claude-testing:runner node dist/src/cli/index.js run .
```

### Verbose Output
```bash
# All commands support --verbose
node dist/src/cli/index.js analyze . --verbose
node dist/src/cli/index.js test . --verbose
node dist/src/cli/index.js run . --verbose
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
node dist/src/cli/index.js test your-project --only-structural

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
node dist/src/cli/index.js test . --config .claude-testing.config.json
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

## 🤖 AI Integration Issues

### Claude Code CLI Integration

#### "AI test generation hangs indefinitely" (FIXED)
**Symptoms**: AI generation hangs without timeout or error
```bash
# Command stuck indefinitely:
Generating logical tests... (0/10) - Starting AI generation
```

**Root Cause**: Claude CLI authentication issues

**Solutions**:
```bash
# 1. Verify Claude CLI is installed
claude --version

# 2. Check authentication (NEW validation)
claude config get  # Should show config without prompts

# 3. If not authenticated, run interactively
claude chat  # Complete authentication flow

# 4. Test with simple query
echo "What is 2+2?" | claude  # Should respond without hanging

# 5. If still hanging, check for zombie processes
ps aux | grep claude
killall claude  # Kill any stuck processes

# 6. Try again with verbose mode
node dist/src/cli/index.js test /path/to/project --only-logical --verbose
```

#### Enhanced Error Messages (NEW)
The system now provides specific error types:
- `AIAuthenticationError` - Clear authentication guidance
- `AITimeoutError` - Timeout duration and troubleshooting steps
- `AIRateLimitError` - Rate limit info with model suggestions
- `AINetworkError` - Network connectivity guidance

#### "Unknown model: sonnet" warnings (FIXED)
**Note**: Model aliases "opus", "sonnet", "haiku" are now fully supported and automatically mapped.

# Check if logged in to Claude Code CLI
claude config get

# Use explicit timeout configuration
node dist/src/cli/index.js generate-logical /path/to/project --timeout 1800  # 30 minutes

# Try with different model/concurrency
node dist/src/cli/index.js generate-logical /path/to/project --model sonnet --concurrent 1
```

#### "Claude CLI not found"
**Symptoms**: Error about missing Claude CLI
```bash
Error: Claude Code CLI not found. Please install it first
```

**Solutions**:
```bash
# Install Claude Code CLI
npm install -g @anthropic-ai/claude-code

# Verify installation
claude --version

# Login if not already authenticated
claude auth login  # If this command exists, or follow Claude Code CLI docs
```

#### "AI tasks not generating"
**Symptoms**: Dry run shows tasks but execution generates 0 tests
```bash
Tasks to be generated: 1
Generated 0 test files
```

**Solutions**:
```bash
# Check complexity threshold (lower to include more files)
node dist/src/cli/index.js generate-logical /path/to/project --min-complexity 1

# Use dry run to inspect task details
node dist/src/cli/index.js generate-logical /path/to/project --dry-run --output ./debug

# Check the generated batch file
cat ./debug/ai-batch.json

# Verify gap analysis is finding issues
node dist/src/cli/index.js analyze-gaps /path/to/project --threshold 1
```

### Timeout Configuration

#### "Session timeout affects other Claude Code operations"
**Symptoms**: Concerned about timeout changes affecting interactive Claude Code sessions

**Explanation**: The timeout configuration is **session-isolated**:
- Interactive Claude Code sessions maintain standard 2-minute timeout
- Only headless AI generation processes use extended timeouts (15-30 minutes)
- Configuration is applied per-process via environment variables
- No global timeout changes are made

#### "Need different timeouts for different tasks"
**Solutions**:
```bash
# Configure per-command timeout
node dist/src/cli/index.js generate-logical /path/to/project --timeout 600   # 10 minutes
node dist/src/cli/index.js generate-logical /path/to/project --timeout 1800  # 30 minutes

# Use budget limits for complex projects
node dist/src/cli/index.js generate-logical /path/to/project --budget 5.00 --timeout 900
```

## 🆘 Getting Help

### Report Issues
```bash
# Include this information in issue reports:
echo "## Environment"
echo "Node: $(node --version)"
echo "npm: $(npm --version)"
echo "OS: $(uname -a)"
echo "Infrastructure: $(node dist/src/cli/index.js --version)"

echo "## Analysis Results"
node dist/src/cli/index.js analyze . --format json > analysis.json
cat analysis.json

echo "## Debug Output"
DEBUG=* node dist/src/cli/index.js test . > debug.log 2>&1
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
node dist/src/cli/index.js test your-project

# Check for breaking changes
git log --oneline --since="1 week ago"

# Rollback if needed
git checkout previous-tag
npm run build
```

Remember: The infrastructure is designed to be safe and non-intrusive. When in doubt, delete the `.claude-testing` directory and regenerate tests fresh.