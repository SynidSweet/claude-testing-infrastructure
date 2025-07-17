# CI/CD Troubleshooting Quick Reference

*Instant fixes for common CI/CD pipeline issues - complement to comprehensive validation guide*

*Quick access version of [`cicd-validation-guide.md`](./cicd-validation-guide.md)*

## 🚨 Emergency Fixes

### Test Failures
```bash
# ❌ Unit tests failing
npm run test:unit -- --verbose --clearCache

# ❌ Integration tests timeout  
npm run test:integration -- --testTimeout=60000

# ❌ Coverage generation hangs
npm run test:coverage -- --config jest.optimized.config.js
```

### Build Failures
```bash
# ❌ TypeScript errors
npx tsc --noEmit
npm run lint -- --fix

# ❌ Module not found
rm -rf dist/ node_modules/
npm install && npm run build

# ❌ CLI path wrong
node dist/src/cli/index.js --version  # Not dist/cli/
```

### Production Validation
```bash
# ❌ Quality gates failing
npm run lint -- --fix
npm run validation:production

# ❌ CI/CD status check failing
# Check GitHub Actions tab, wait for current run completion
```

## 🔧 Common Error Patterns

### TypeScript Fixes
```typescript
// ❌ Unsafe assignment
const result = someFunction();

// ✅ Type-safe
const result: ExpectedType = someFunction();

// ❌ Mock type error  
const mockFn = jest.fn();

// ✅ Typed mock
const mockFn = jest.fn() as jest.MockedFunction<typeof originalFn>;

// ❌ Unsafe member access
config.property.nested;

// ✅ Safe access
config.property?.nested;
```

### Test Timeout Fixes
```typescript
// Add timeout to spawnSync
const result = spawnSync('node', [script], {
  timeout: 30000,  // 30s timeout
  encoding: 'utf-8'
});

// Individual test timeout
it('should handle operation', async () => {
  // test code
}, 60000); // 60s timeout
```

## 📋 One-Minute Validation

```bash
# Complete local validation (mirrors CI)
npm run test:unit && \
npm run test:integration && \
npm run lint && \
npx tsc --noEmit && \
npm run validation:production
```

## 🎯 Environment Quick Setup

```yaml
# CI Environment Variables
CI: true
SKIP_AI_TESTS: "true"  
JEST_TIMEOUT: 45000
GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## 📊 Performance Targets

| Metric | Target | Fix Command |
|--------|--------|-------------|
| Unit tests | <2 min | `npm run test:unit` |
| Build time | <5 min | `npm run build` |
| Coverage | <3 min | Use `jest.optimized.config.js` |
| Overall job | <15 min | Check timeouts |

## 🚀 Quick Health Check

```bash
# 1. Dependencies OK?
npm ls

# 2. Build working?
npm run build && node dist/src/cli/index.js --version

# 3. Tests passing?
npm run test:unit

# 4. Types clean?  
npx tsc --noEmit

# 5. Production ready?
npm run validation:production
```

## ⚡ Immediate Actions by Error

| Error Message | Immediate Fix |
|---------------|---------------|
| `Module not found` | `npm install && npm run build` |
| `Type 'X' is not assignable` | Add type annotation |
| `Test timeout` | Add `timeout: 30000` to spawnSync |
| `Cannot find module dist/cli/` | Use `dist/src/cli/` |
| `Linting errors: N` | `npm run lint -- --fix` |
| `Coverage timeout` | Use `jest.optimized.config.js` |
| `CI/CD pipeline not passing` | Wait for current run, check Actions tab |

## 🔗 When Quick Fixes Don't Work

**Read the full guide**: [`cicd-validation-guide.md`](./cicd-validation-guide.md)

**Key sections for deep issues**:
- TypeScript compilation errors → Section "Common TypeScript Error Fixes"  
- Test reliability issues → Section "Test Failures"
- Performance problems → Section "Performance Optimization"
- Production validation → Section "Production Validation Failures"

---

**Philosophy**: Fix first, understand later - this card gets you unstuck fast, then you can read the comprehensive guide for the why.