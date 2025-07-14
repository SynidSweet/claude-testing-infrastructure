# Deployment Strategy

*Last updated: 2025-07-12 | CI/CD branch triggers updated*

## Branch Structure & CI/CD Triggers

### main (default)
- Full development environment
- Complete test suite (400+ tests)
- CI/CD pipelines trigger on push
- Development dependencies
- Coverage tools

### CI/CD Workflow Triggers
- **Push triggers**: main, develop, feature/*, fix/*
- **Pull request triggers**: main, develop
- **Current branch**: fix/production-code-quality-cleanup (triggers CI)

### deploy/clean
- Core infrastructure only
- Minimal package.json
- No tests or development tools
- Ready for cloning into other projects

## Usage

### For Development
```bash
git clone https://github.com/SynidSweet/claude-testing-infrastructure.git
cd claude-testing-infrastructure
npm install
npm test
```

### For Deployment to Test Other Projects
```bash
git clone -b deploy/clean https://github.com/SynidSweet/claude-testing-infrastructure.git
cd claude-testing-infrastructure
npm install
npm run build
```

## Maintenance

The `deploy/clean` branch is automatically synchronized with core infrastructure changes from `main` via GitHub Actions. Only changes to:
- `src/` - Core infrastructure code
- `templates/` - Configuration templates
- `AI_AGENT_GUIDE.md` - Primary documentation

Are synced to the deployment branch. All test infrastructure remains in `main`.

## Branch Differences

### Files in main but NOT in deploy/clean:
- `tests/` - All test files and fixtures
- `__tests__/` - Additional test files
- `.github/workflows/` - CI/CD pipelines (except sync workflow)
- `scripts/` - Validation and deployment scripts
- `jest.config.js` - Test configuration
- `jest.ai-validation.config.js` - AI validation config
- `.eslintrc.json` - Linting configuration
- `.prettierrc.json` - Formatting configuration
- `.husky/` - Git hooks
- All devDependencies in package.json

### Scripts in main vs deploy/clean:

**main branch scripts:**
- All development scripts (test, lint, format, etc.)
- Validation scripts
- Watch mode
- Coverage reporting

**deploy/clean branch scripts:**
- `build` - Compile TypeScript
- `start` - Run the CLI
- `clean` - Remove build artifacts

## Workflow

1. **Development happens in main**
   - All features developed here
   - Full test suite available
   - CI/CD validation

2. **Core changes auto-sync to deploy/clean**
   - GitHub Actions monitors main
   - Syncs only essential files
   - Maintains clean package.json

3. **Users clone appropriate branch**
   - Developers working on infrastructure: main
   - Users testing their projects: deploy/clean

## Adding New Core Files

If you need a new file to be included in deploy/clean:

1. Add the path to `.github/workflows/sync-deploy-branch.yml`
2. The file will sync on next push to main
3. Consider if it's truly needed for deployment

## Security Considerations

- deploy/clean has no development tools
- Smaller attack surface
- No test fixtures that might contain sensitive examples
- Minimal dependencies reduce vulnerability exposure