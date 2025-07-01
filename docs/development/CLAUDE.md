# Development Guide - AI Agent Guide

*Quick navigation for AI agents working on Claude Testing Infrastructure development*

## 🎯 Purpose

This guide helps AI agents understand development workflows, coding conventions, and best practices for contributing to the Claude Testing Infrastructure. Follow these patterns to maintain consistency and quality.

## 🛠️ Development Setup

### Prerequisites
```bash
# Required tools
node --version  # 18+ required
git --version   # For version control
claude --version  # For AI features (optional)
```

### Initial Setup
```bash
# Clone and build
git clone https://github.com/SynidSweet/claude-testing-infrastructure.git
cd claude-testing-infrastructure
npm install
npm run build

# Verify build
node dist/cli/index.js --version  # Should show: 2.0.0
```

## 📐 Coding Conventions

### TypeScript Standards
- **Strict mode enabled** - No `any` types without justification
- **Interfaces over types** - For better extensibility
- **Discriminated unions** - For type safety (see `src/types/*-types.ts`)
- **Async/await** - Over callbacks and raw promises

### File Organization
```
src/
├── analyzers/       # Project analysis components
├── generators/      # Test generation logic
├── runners/         # Test execution
├── ai/             # AI integration
├── state/          # State management
├── types/          # TypeScript interfaces
├── utils/          # Shared utilities
└── cli/            # Command interface
```

### Naming Conventions
- **Files**: `kebab-case.ts` (e.g., `project-analyzer.ts`)
- **Classes**: `PascalCase` (e.g., `ProjectAnalyzer`)
- **Interfaces**: `I` prefix avoided, descriptive names (e.g., `TestResult`)
- **Functions**: `camelCase` with verb prefixes (e.g., `analyzeProject`)

## 🔄 Development Workflow

### Feature Development

1. **Create feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Follow TDD approach**
   - Write tests first in `__tests__/`
   - Implement feature
   - Ensure all tests pass

3. **Maintain test coverage**
   ```bash
   npm test -- --coverage
   # Maintain 90%+ coverage
   ```

4. **Update documentation**
   - Code comments for complex logic
   - Update relevant `.md` files
   - Add to CLAUDE.md guides if needed

### Common Development Tasks

#### Adding a New Command
1. Create command file in `src/cli/commands/`
2. Register in `src/cli/index.ts`
3. Add tests in `__tests__/cli/commands/`
4. Update help text and documentation

#### Adding Language Support
1. Create new adapter in `src/adapters/`
2. Implement `LanguageAdapter` interface
3. Register in `ProjectAnalyzer`
4. Add language-specific templates
5. Test with sample projects

#### Modifying AI Integration
1. Check `src/ai/ClaudeOrchestrator.ts`
2. Update `src/utils/model-mapping.ts` for models
3. Test with mock AI responses
4. Consider cost implications

## 🧪 Testing Practices

### Test Structure
```typescript
describe('ComponentName', () => {
  beforeEach(() => {
    // Setup
  });

  describe('methodName', () => {
    it('should handle specific case', () => {
      // Arrange
      // Act
      // Assert
    });
  });
});
```

### Test Categories
- **Unit tests**: Individual components (`*.test.ts`)
- **Integration tests**: Component interactions
- **E2E tests**: Full command execution

### Running Tests
```bash
# All tests
npm test

# Specific file
npm test -- ProjectAnalyzer.test.ts

# Watch mode
npm test -- --watch

# With coverage
npm test -- --coverage
```

## 🐛 Debugging Tips

### Common Issues

1. **Module not found**
   - Rebuild: `npm run build`
   - Check imports match file structure

2. **Type errors**
   - Run `npm run type-check`
   - Check discriminated union types

3. **Test failures**
   - Check mock data matches interfaces
   - Verify async operations awaited

### Debugging Tools
```bash
# Type checking
npm run type-check

# Linting
npm run lint

# Build with source maps
npm run build -- --sourcemap
```

## 📊 Performance Considerations

### Optimization Areas
1. **File discovery** - Use glob patterns efficiently
2. **AI batching** - Process in reasonable chunks
3. **State management** - Cache when appropriate
4. **Memory usage** - Stream large files

### Profiling
```javascript
// Use performance marks
performance.mark('analysis-start');
// ... code ...
performance.mark('analysis-end');
performance.measure('analysis', 'analysis-start', 'analysis-end');
```

## 🚀 Deployment Process

### Pre-deployment Checklist
- [ ] All tests passing (156/156 currently)
- [ ] Coverage maintained (90%+)
- [ ] Documentation updated
- [ ] Version bumped in `package.json`
- [ ] CHANGELOG updated

### Release Process
1. Merge to main branch
2. Tag release: `git tag v2.0.1`
3. Push tags: `git push --tags`
4. NPM publish (when applicable)

## 📝 Documentation Standards

### Code Comments
```typescript
/**
 * Analyzes project structure and detects languages/frameworks
 * @param projectPath - Absolute path to target project
 * @returns Analysis results with detected components
 * @throws {ProjectNotFoundError} If project path doesn't exist
 */
async analyzeProject(projectPath: string): Promise<ProjectAnalysis> {
  // Implementation
}
```

### Updating Docs
1. Keep `PROJECT_CONTEXT.md` current
2. Update feature docs in `/docs/features/`
3. Add decisions to `/docs/architecture/decisions.md`
4. Update CLAUDE.md guides for AI agents

## 🔗 Related Documentation

- **Architecture**: [`/docs/architecture/CLAUDE.md`](../architecture/CLAUDE.md) - System design
- **Features**: [`/docs/features/CLAUDE.md`](../features/CLAUDE.md) - Component details
- **Planning**: [`/docs/planning/CLAUDE.md`](../planning/CLAUDE.md) - Task management
- **API**: [`/docs/api/CLAUDE.md`](../api/CLAUDE.md) - Interface documentation
- **User Guide**: [`/docs/user/CLAUDE.md`](../user/CLAUDE.md) - Usage documentation

## ⚡ Quick Reference

### Essential Commands
```bash
npm install         # Install dependencies
npm run build      # Build project
npm test           # Run tests
npm run lint       # Check code style
npm run type-check # Verify types
```

### Key Patterns
- **Orchestrator pattern** - For complex operations
- **Adapter pattern** - For language support
- **Repository pattern** - For state management
- **Factory pattern** - For creating instances

---

**Development Philosophy**: Write clean, testable code that never modifies user projects while providing comprehensive test coverage.