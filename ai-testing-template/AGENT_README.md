# Quick Start for AI Agents

🤖 **This guide is optimized for AI agents**. Every command is copy-pasteable and designed for autonomous execution.

## 1. Clone and Initialize

### Step 1: Clone the Template Repository
```bash
git clone https://github.com/ai-testing-template/ai-testing-template.git
cd ai-testing-template
```

### Step 2: Install Dependencies
```bash
npm install
```

### Step 3: Run the Initialization Script (Fully Automated)
```bash
# Recommended: Fully automated with smart defaults
npm run init:auto

# OR use preset configurations:
npm run init:minimal     # Basic unit tests only
npm run init:recommended # Unit + integration tests (default)
npm run init:comprehensive # Full testing pyramid

# OR preview without making changes:
npm run preview
```

**🤖 AI Agent Note**: The initialization is **completely non-interactive**. No prompts will appear - everything is detected and configured automatically.

**Expected Output**: The script will analyze your project structure and apply appropriate testing setup without any user interaction.

**Success Indicator**: You should see "🎉 Testing setup complete!" at the end.

## 2. Project Detection

The initialization script automatically detects:

### JavaScript/TypeScript Projects
- **Detection Method**: Looks for `package.json`
- **Framework Detection**: Scans dependencies for React, Vue, Angular, Express, Fastify, Next.js
- **TypeScript Detection**: Checks for TypeScript dependencies and `.ts`/`.tsx` files
- **Project Type**: Determines if frontend, backend, or full-stack based on dependencies

### Python Projects  
- **Detection Method**: Looks for `requirements.txt`, `pyproject.toml`, `setup.py`, or `.py` files
- **Framework Detection**: Scans for FastAPI, Flask, Django imports and dependencies
- **Project Type**: Determines backend type based on framework patterns

### Multi-Language Projects
- **Support**: Both JavaScript and Python in the same project
- **Setup**: Templates for both languages will be configured

## 3. Automated Configuration (No User Input Required)

### How Auto-Init Works

The `init:auto` command automatically:
1. **Detects** your project type (JavaScript/TypeScript/Python)
2. **Analyzes** frameworks and dependencies
3. **Applies** appropriate testing setup
4. **Configures** based on confidence scoring

### Command Line Options for Fine Control

```bash
# Override specific aspects while keeping automation:
npm run init:auto -- --frameworks "jest,playwright" --ci github --structure separate

# Available flags:
--frameworks    # Comma-separated: jest,vitest,playwright,cypress,pytest
--ci           # CI provider: github,gitlab,circle,none
--structure    # Test structure: separate,colocated,both
--features     # Additional features: coverage,visual,performance,a11y,database
--dry-run      # Preview changes without applying them
```

### Confidence Scoring System

The auto-init includes confidence scoring:
- **High confidence (>80%)**: Proceeds automatically
- **Medium confidence (50-80%)**: Applies conservative defaults
- **Low confidence (<50%)**: Uses minimal setup

### Configuration Options (Applied Automatically)

#### Project Type Selection (for empty projects)
```
- JavaScript Frontend (React, Vue, etc.)
- JavaScript Backend (Node.js, Express, etc.)  
- TypeScript Frontend
- TypeScript Backend
- Python Backend (FastAPI, Flask, Django)
- Full-stack (Frontend + Backend)
```

### JavaScript Testing Frameworks
```
✓ Jest (Unit & Integration Testing) [Default: Yes]
✓ React Testing Library (Component Testing) [Auto-detected for React]
□ Playwright (E2E Testing) [Default: No]
□ Cypress (E2E Testing) [Default: No]  
□ Vitest (Vite-based Testing) [Auto-detected for Vite]
```

### Python Testing Frameworks
```
✓ pytest (Recommended) [Default: Yes]
□ unittest (Standard Library) [Default: No]
✓ coverage.py (Code Coverage) [Default: Yes]
✓ Black (Code Formatting) [Default: Yes]
□ mypy (Type Checking) [Default: No]
```

### CI/CD Provider
```
- GitHub Actions [Default]
- GitLab CI
- CircleCI  
- None (Skip CI/CD setup)
```

### Test Structure
```
- Separate test directory (recommended) [Default]
- Co-located with source files
- Both (flexible structure)
```

### Advanced Features
```
✓ Code coverage reporting [Default: Yes]
□ Visual regression testing [Default: No]
□ Performance testing setup [Default: No]
□ Accessibility testing [Default: No]
□ Database testing utilities [Default: No]
```

## 4. Verification Steps

### After Installation, Run These Commands:

#### For JavaScript/TypeScript Projects:
```bash
# Verify Jest is working
npm test

# Check if test files were created
ls -la src/**/__tests__/ 2>/dev/null || ls -la tests/ 2>/dev/null

# Verify coverage setup
npm run test:coverage
```

**Expected Output**: 
- Tests should run without errors
- Coverage report should be generated
- Test files should be visible in the project structure

#### For Python Projects:
```bash
# Verify pytest is working
pytest

# Check test discovery
pytest --collect-only

# Verify coverage
pytest --cov
```

**Expected Output**:
- Pytest should discover and run tests
- Coverage report should show percentage
- No import errors should occur

#### For E2E Testing (if selected):
```bash
# Playwright
npx playwright test

# Cypress  
npm run test:e2e:open
```

### Troubleshooting Common Issues:

#### Issue: "Command not found: jest"
**Solution**: 
```bash
# Install Jest globally or check package.json scripts
npm install -g jest
# OR
npx jest
```

#### Issue: "ModuleNotFoundError" in Python
**Solution**:
```bash
# Install dependencies
pip install -r requirements.txt
# OR
pip install pytest pytest-cov
```

#### Issue: "Cannot find module '@testing-library/react'"
**Solution**:
```bash
# Install missing dependencies
npm install --save-dev @testing-library/react @testing-library/jest-dom
```

#### Issue: Tests pass but no coverage report
**Solution**:
```bash
# For JavaScript
npm test -- --coverage
# For Python  
pytest --cov=src
```

## 5. Post-Installation Commands

### Essential Commands to Remember:

#### JavaScript/TypeScript:
```bash
npm test                    # Run all tests
npm run test:watch         # Run tests in watch mode
npm run test:coverage      # Run tests with coverage
npm run test:e2e          # Run E2E tests (if configured)
```

#### Python:
```bash
pytest                     # Run all tests
pytest --cov              # Run with coverage
pytest -v                 # Verbose output
pytest tests/unit/         # Run specific test directory
pytest -k "test_user"      # Run tests matching pattern
```

#### Both:
```bash
git add .                  # Stage all changes
git commit -m "Add testing setup"  # Commit the changes
```

## 6. Next Steps

1. **Read the Testing Guide**: Open `AGENT_TEST_GUIDE.md` for detailed testing methodology
2. **Examine Examples**: Check the `examples/` directory for complete working examples
3. **Run First Tests**: Execute the verification commands above
4. **Review Generated Files**: Look at the test files created in your project
5. **Customize Configuration**: Modify `jest.config.js`, `pytest.ini`, or other config files as needed

## 7. File Locations After Setup

```
your-project/
├── tests/                 # Test directory (if separate structure chosen)
├── src/                   # Source code
│   ├── __tests__/        # Component tests (if co-located structure)
│   └── test-utils/       # Testing utilities (JavaScript)
├── jest.config.js        # Jest configuration (JavaScript)
├── pytest.ini           # Pytest configuration (Python)
├── conftest.py           # Pytest fixtures (Python)
├── .github/workflows/    # CI/CD workflows
├── .vscode/settings.json # VS Code test settings
└── .env.test            # Test environment variables
```

## 8. Emergency Commands

If something goes wrong during setup:

```bash
# Reset and try again
rm -rf node_modules package-lock.json
npm install
npm run init

# Check what was installed
npm list --depth=0

# Verify Python packages
pip list | grep -E "(pytest|coverage)"

# Check Git status
git status
```

---

**🔍 Need Help?** 
- Check `docs/troubleshooting.md` for common issues
- Look at `examples/` for working implementations  
- Review `AGENT_TEST_GUIDE.md` for testing patterns