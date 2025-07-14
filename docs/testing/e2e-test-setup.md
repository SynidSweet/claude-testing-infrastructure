# E2E Test Setup and Infrastructure Guide

*Complete guide for setting up and maintaining E2E tests in the Claude Testing Infrastructure*

## 🎯 Purpose

This guide ensures consistent E2E test infrastructure across the project, documenting proper setup requirements and common patterns to prevent issues discovered during TEST-E2E-001.

## 📋 E2E Test Setup Requirements

### Prerequisites
1. **Build the project first** - E2E tests require compiled JavaScript
   ```bash
   npm run build
   ```

2. **Ensure runtime artifacts are copied**
   - The build script copies HTML templates to `dist/src/runners/templates/`
   - The build script copies config templates to `dist/templates/`

### Directory Structure
```
tests/e2e/
├── test-projects/          # Sample projects for testing
│   ├── javascript-project/
│   ├── python-project/
│   └── typescript-react-project/
├── comprehensive-e2e-test.js
├── run-e2e-validation.js
├── cli-commands.test.ts
├── complete-workflow.test.ts
├── ci-cd-integration.test.ts
└── setup.ts
```

## 🔧 CLI Path Standards

### Correct CLI Invocation Pattern
All E2E tests must use:
```javascript
const CLI_COMMAND = 'node dist/src/cli/index.js';
```

Or for dynamic paths:
```javascript
const cliPath = path.join(projectRoot, 'dist/src/cli/index.js');
```

### Incorrect Patterns to Avoid
- ❌ `npx claude-testing` - Package is not published to npm
- ❌ `./dist/cli/index.js` - Incorrect path structure
- ❌ `node src/cli/index.ts` - TypeScript files need compilation

## 🏗️ Build System Requirements

### Runtime Artifacts
The build script must copy:
1. **HTML Templates**: `src/runners/templates/*.html` → `dist/src/runners/templates/`
2. **Config Templates**: `templates/` → `dist/templates/`

### Build Script Pattern
```json
{
  "scripts": {
    "build": "tsc && mkdir -p dist/src/runners/templates && cp -r src/runners/templates/*.html dist/src/runners/templates/ 2>/dev/null || true && cp -r templates dist/ 2>/dev/null || true"
  }
}
```

Key elements:
- `mkdir -p` ensures directory exists before copying
- `2>/dev/null || true` prevents build failure if no files to copy
- Paths match TypeScript's compilation structure

## 📝 Writing E2E Tests

### Standard Test Structure
```typescript
describe('E2E: Command Name', () => {
  const testProjectPath = path.join(__dirname, 'test-projects/sample-project');
  const CLI_COMMAND = 'node dist/src/cli/index.js';
  
  beforeEach(() => {
    // Clean test environment
  });
  
  it('should perform expected behavior', () => {
    const result = execSync(`${CLI_COMMAND} analyze ${testProjectPath}`, {
      encoding: 'utf8'
    });
    
    expect(result).toContain('expected output');
  });
});
```

### Test Project Requirements
- Keep test projects minimal but representative
- Include various language/framework combinations
- Ensure test projects are self-contained (no external dependencies)
- Add `.gitignore` patterns as needed

## 🚨 Common Issues and Solutions

### Issue 1: Template Not Found
**Symptom**: Runtime error about missing HTML template
**Solution**: Check build script copies to correct `dist/src/` path

### Issue 2: CLI Command Not Found
**Symptom**: "command not found" or module errors
**Solution**: Ensure using `node dist/src/cli/index.js` pattern

### Issue 3: Build Artifacts Missing
**Symptom**: Tests fail with missing file errors
**Solution**: Run `npm run build` before tests

## 🔄 Maintenance Guidelines

### When Adding New Runtime Files
1. Identify if file is needed at runtime
2. Update build script to copy to appropriate `dist/` location
3. Test that E2E tests can access the file
4. Document in this guide if pattern is reusable

### When Modifying Build Process
1. Ensure all existing artifacts still copy correctly
2. Run full E2E test suite to verify
3. Update this documentation
4. Check CI/CD pipeline still passes

## 🧪 Running E2E Tests

### Local Development
```bash
# Run all E2E tests
npm run test:e2e

# Run with verbose output
npm run test:e2e-verbose

# Run specific test file
npx jest tests/e2e/cli-commands.test.ts
```

### CI/CD Pipeline
E2E tests run automatically in GitHub Actions:
- After build step completes
- Using same commands as local development
- With appropriate timeouts for CI environment

## 📊 E2E Test Coverage

Current E2E tests validate:
- ✅ All CLI commands (analyze, test, run, incremental, etc.)
- ✅ Multi-language support (JavaScript, TypeScript, Python)
- ✅ Framework detection (React, Express, FastAPI)
- ✅ Configuration loading and precedence
- ✅ Output formats and reporting

## 🔗 Related Documentation

- [Testing Strategies](./testing-strategies.md) - Overall testing approach
- [AI Test Optimization](./ai-test-optimization.md) - AI-specific testing
- [CI/CD Integration](../development/ci-cd.md) - Pipeline configuration
- [CLI Reference](../commands/cli-reference.md) - Command documentation

---

*This guide ensures E2E tests remain consistent and maintainable, preventing issues discovered during infrastructure standardization.*