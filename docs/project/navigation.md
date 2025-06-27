# Where to Find Things

## Key Files & Locations
- **Initialization logic**: ai-testing-template/scripts/init.js:26 (main initialization flow)
- **Project detection**: ai-testing-template/scripts/utils/fileSystem.js:257 (analyzeProject method)
- **Template management**: ai-testing-template/scripts/utils/templateManager.js
- **Discovery engine**: decoupled-testing-suite/core/discovery/project-discovery.js:74 (discoverComponents method)
- **Configuration schemas**: decoupled-testing-suite/config/schemas/project-config.schema.json
- **Framework adapters**: decoupled-testing-suite/config/adapters/ (react-adapter.js, etc.)

## Documentation Locations
- **Architecture documentation**: ARCHITECTURE.md (system design, dual-approach rationale, adapter pattern explanation)
- **Refactoring roadmap**: REFACTORING_PLAN.md (prioritized improvements with AI-agent context)
- **AI Navigation guides**: CLAUDE.md (root), ai-testing-template/CLAUDE.md, decoupled-testing-suite/CLAUDE.md
- **Agent guides**: AGENT_README.md (step-by-step setup), AGENT_TEST_GUIDE.md (testing methodology)
- **Implementation plans**: AI_TESTING_TEMPLATE_IMPLEMENTATION_PLAN.md, DECOUPLED_TESTING_ARCHITECTURE_IMPLEMENTATION_PLAN.md
- **Template examples**: ai-testing-template/templates/ (organized by technology stack)
- **Working examples**: 
  - ai-testing-template/examples/ (template approach implementations)
  - examples/decoupled-demo/ (complete React app with decoupled testing)
- **MVP Completion Plan**: MVP_COMPLETION_PLAN.md (detailed implementation checklist)

## See Also
- 📖 **Project Overview**: [`/docs/project/overview.md`](./overview.md)
- 📖 **Architecture Overview**: [`/docs/architecture/overview.md`](../architecture/overview.md)
- 📖 **AI Agent Guidelines**: [`/docs/ai-agents/guidelines.md`](../ai-agents/guidelines.md)