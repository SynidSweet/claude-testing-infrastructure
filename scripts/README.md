# Scripts Directory

This directory contains utility scripts for the Claude Testing Infrastructure project.

## Available Scripts

### `production-readiness-check.js`

Comprehensive production readiness validation script that checks:

- **Build Success**: Verifies build artifacts exist and are accessible
- **CLI Responsiveness**: Tests basic CLI commands (`--version`, `--help`)
- **Test Suite Reliability**: Runs core test suite and checks pass rate (≥95% required)
- **Core Commands**: Validates `analyze`, `test`, and `run` commands respond correctly
- **Documentation**: Checks for required documentation files
- **AI Integration**: Optional check for Claude CLI availability

#### Usage

```bash
# Run production readiness check
npm run validation:production

# Or run directly
node scripts/production-readiness-check.js
```

#### Exit Codes

- `0` - Production ready (all gates passed)
- `1` - Not production ready (gates failed)
- `2` - Script error (validation couldn't complete)

#### Quality Gates

- Test pass rate: ≥95%
- Overall score: ≥90%
- All core functionality must work
- Documentation must be complete

## Future Scripts

This directory is designed to hold additional utility scripts for:

- Validation report generation
- Performance benchmarking
- Deployment automation
- Quality gate enforcement

## Development

When adding new scripts:

1. Make them executable: `chmod +x script-name.js`
2. Add appropriate shebang: `#!/usr/bin/env node`
3. Include meaningful exit codes
4. Add documentation here
5. Add to package.json scripts if appropriate

## Integration

These scripts integrate with:

- **npm scripts** - Called via `npm run` commands
- **CI/CD pipelines** - Used for automated quality gates
- **Pre-commit hooks** - For local quality validation
- **Production deployment** - For release readiness validation