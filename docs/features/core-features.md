# Core Features & User Journeys

## Primary User Flows
1. **Template Installation Flow**: Clone template → Run `npm run init` → Answer prompts → Get configured testing setup
2. **Decoupled Testing Flow**: Clone testing suite → Run discovery → Generate configuration → Execute tests independently
3. **Agent-Guided Setup**: Follow AGENT_README.md → Execute verification commands → Begin test-driven development

## Feature Modules
- **Project Detection** (ai-testing-template/scripts/utils/fileSystem.js): Automatically detects JavaScript/TypeScript/Python projects and their frameworks
- **Template Management** (ai-testing-template/scripts/utils/templateManager.js): Copies and customizes test templates based on project type
- **Configuration Generation**: Creates Jest, pytest, Playwright configs with appropriate settings for detected project type
- **Decoupled Discovery** (decoupled-testing-suite/core/discovery/): Analyzes project components and generates test plans without modifying source
- **Framework Adapters** (decoupled-testing-suite/config/adapters/): Project-specific testing strategies for React, Vue, Node.js, Python frameworks
- **Decoupled Scripts** (decoupled-testing-suite/scripts/): Complete suite of automation scripts:
  - `discover-project.js`: Analyzes project structure with framework detection
  - `init-project.js`: Creates testing configuration without modifying target
  - `run-tests.js`: Executes tests with multiple framework support
  - `analyze-project.js`: Deep analysis with coverage gaps and recommendations
  - `validate-setup.js`: Validates configuration and dependencies
  - `check-compatibility.js`: Ensures version and dependency compatibility
  - `safe-update.js`: Updates suite while preserving user configurations
  - `migrate-config.js`: Handles configuration migrations between versions

## Data Models & Entities
- **ProjectAnalysis**: Framework detection results, project type classification, existing test structure analysis
- **Configuration**: Testing framework settings, coverage thresholds, environment variables, CI/CD pipeline definitions
- **TestPlan**: Generated test cases, template mappings, dependency requirements, coverage targets
- **ComponentInfo**: Discovered UI components, props/hooks analysis, testing recommendations

## See Also
- 📖 **Project Overview**: [`/docs/project/overview.md`](../project/overview.md)
- 📖 **Commands Reference**: [`/docs/reference/commands.md`](../reference/commands.md)
- 📖 **Architecture Overview**: [`/docs/architecture/overview.md`](../architecture/overview.md)