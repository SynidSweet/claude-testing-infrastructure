# Development Workflow

## 🔒 CRITICAL: Infrastructure Usage

**This is testing infrastructure - clone into your project and use as-is:**

- ✅ Clone this repo into your project directory
- ✅ Use without modifying any infrastructure files
- ✅ Pull updates regularly: `git pull origin main`
- ✅ Report bugs via GitHub issues
- ❌ NEVER modify files in this testing infrastructure

## Getting Started
- **Setup steps**: 
  1. Clone this repository into your project directory
  2. Run `npm install` to install dependencies
  3. Execute `npm run init` or discovery commands
  4. Follow verification steps in AGENT_README.md
- **Required tools**: Node.js 14+, Git, target project's runtime (Python 3.9+ for Python projects)
- **Common commands**: 
  - `npm run init` (template initialization)
  - `npm test` (run tests)
  - `npm run test:coverage` (coverage reports)
  - `npm run discover` (decoupled project analysis)
  - `npm run analyze` (deep project analysis)
  - `npm run validate` (validate setup)
  - `npm run check-compatibility` (check project compatibility)

## Development Practices
- **Branch strategy**: Main branch for stable releases, feature branches for development, automated testing on all branches
- **Code review process**: Template and configuration validation, agent documentation testing, cross-platform compatibility verification
- **Deployment process**: Git-based distribution, semantic versioning, automated validation of template integrity
- **Debugging approaches**: Verbose logging during initialization, step-by-step verification commands, common error troubleshooting guides

## See Also
- 📖 **Development Conventions**: [`/docs/development/conventions.md`](./conventions.md)
- 📖 **Important Gotchas**: [`/docs/development/gotchas.md`](./gotchas.md)
- 📖 **Commands Reference**: [`/docs/reference/commands.md`](../reference/commands.md)