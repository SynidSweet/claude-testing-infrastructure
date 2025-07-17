# Scripts Directory

This directory contains utility scripts for the Claude Testing Infrastructure project.

## Available Scripts

### Sprint Validation System

- **generate-sprint-validation-report.js**: Comprehensive sprint validation report generator with MCP integration
  - Integrates with MCP task system for real-time sprint data
  - Collects evidence from validation scripts and quality checks
  - Generates JSON and Markdown reports with recommendations
  - Supports evidence file collection and archival
  ```bash
  # Generate sprint validation report
  node scripts/generate-sprint-validation-report.js
  
  # With evidence collection and JSON output
  node scripts/generate-sprint-validation-report.js --format json --collect-evidence
  
  # Verbose mode with specific sprint
  node scripts/generate-sprint-validation-report.js --sprint-id SPRINT-2025-Q3-DEV04 --verbose
  ```

### Truth Validation System

The truth validation system ensures documentation claims match actual project status:

- **status-aggregator.js**: Single source of truth for project status
- **documentation-claim-parser.js**: Extracts claims from documentation  
- **truth-validation-engine.js**: Validates claims against reality
- **test-suite-blocker-detector.js**: Identifies test suite blockers
- **infrastructure-blocker-detector.js**: Identifies infrastructure blockers
- **code-quality-blocker-detector.js**: Identifies code quality blockers
- **precommit-truth-validation.js**: Pre-commit hook for truth validation
- **status-documentation-updater.js**: Automatically updates status documentation

#### Usage

```bash
# Complete truth validation
npm run validate:truth

# Detailed discrepancy analysis
npm run validate:truth:detailed

# Blocker detection
npm run validate:blockers
npm run validate:infrastructure
npm run validate:code-quality

# Pre-commit truth validation
npm run truth-validation:precommit

# Bypass truth validation (for development)
SKIP_TRUTH_VALIDATION=true npm run truth-validation:precommit

# Automated status documentation updates
npm run status:update                # Update docs with current status
npm run status:update:dry-run        # Preview changes without writing
npm run status:update:commit         # Update and auto-commit changes
npm run status:update:verbose        # Show detailed information
```

#### Pre-commit Integration

The system provides pre-commit hooks to prevent false claims:

```bash
# Use standard pre-commit (no truth validation)
.husky/pre-commit

# Use truth validation pre-commit (blocks false claims)
.husky/pre-commit-truth-validation
```

To enable truth validation pre-commit, rename the hooks:
```bash
mv .husky/pre-commit .husky/pre-commit-standard
mv .husky/pre-commit-truth-validation .husky/pre-commit
```

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