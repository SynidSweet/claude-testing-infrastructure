# Contributing to Claude Testing Infrastructure

Thank you for your interest in contributing to the Claude Testing Infrastructure! This guide will help you get started.

## Branch Strategy

This project uses a dual-branch strategy:

### main branch
- Full development environment
- Complete test suite (400+ tests)
- CI/CD pipelines
- Development tools (ESLint, Prettier, Husky)
- Used for all development work

### deploy/clean branch
- Minimal deployment package
- Core infrastructure only
- No tests or development tools
- Automatically synced from main
- **DO NOT contribute directly to this branch**

## Development Workflow

1. **Fork and Clone**
   ```bash
   # Fork the repository on GitHub
   # Clone your fork (use main branch for development)
   git clone https://github.com/YOUR_USERNAME/claude-testing-infrastructure.git
   cd claude-testing-infrastructure
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Create Feature Branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

4. **Make Changes**
   - Write code following existing patterns
   - Add tests for new functionality
   - Update documentation as needed

5. **Run Tests**
   ```bash
   npm test
   npm run lint
   npm run format:check
   ```

6. **Commit Changes**
   ```bash
   git add .
   git commit -m "feat: add new feature"
   ```

7. **Push and Create PR**
   ```bash
   git push origin feature/your-feature-name
   # Create PR on GitHub targeting main branch
   ```

## Code Style

- TypeScript for all source code
- ESLint and Prettier for formatting
- Follow existing patterns in the codebase
- Write meaningful commit messages

## Testing

- Write tests for all new functionality
- Maintain or improve code coverage
- Run `npm test` before submitting PR
- CI/CD must pass for PR to be merged

## What Gets Synced to deploy/clean

Only these items are automatically synced:
- `src/` - Core source code
- `templates/` - Configuration templates
- `AI_AGENT_GUIDE.md` - Primary documentation
- `package.json` - Cleaned version with only runtime dependencies

Everything else (tests, dev configs, etc.) stays in main.

## Questions?

- Open an issue for bugs or feature requests
- Start a discussion for questions
- Tag @claude in issues for AI assistance

## License

By contributing, you agree that your contributions will be licensed under the MIT License.