# Current Priorities & Roadmap

## Active Development Areas
- **Current milestone**: MVP COMPLETE ✅ Both approaches fully functional
- **Known issues**: 
  - Minor display issues with chalk formatting in analyze output
  - Python template system could use additional framework templates
- **Upcoming features**: 
  - Visual regression testing templates
  - Performance testing integration
  - Advanced CI/CD integrations
  - Additional language support (Go, Rust)

## Areas for Improvement
- **High-priority refactoring targets** (see REFACTORING_PLAN.md for details): 
  - ✅ Create comprehensive CLAUDE.md documentation for AI agent context (COMPLETED 2025-06-27)
  - ✅ Implement language adapter pattern to replace perceived "duplication" (COMPLETED 2025-06-27)
  - ✅ Establish clear boundaries between template and decoupled approaches (COMPLETED)
  - ✅ Implement all decoupled suite scripts (COMPLETED 2025-01-27)
  - Split oversized methods (10+ methods >50 lines) in init.js and prompter.js (remaining)
- **Code quality issues identified**:
  - Mixed responsibilities in core classes (handling 4-5 concerns each)
  - Complex nested conditionals making flow hard to follow
  - String-based code generation instead of proper templating
  - Poor error aggregation (errors logged but not collected)
- **Performance optimization**: Large codebase analysis speed, parallel test execution efficiency
- **Technical debt**: Interface stability testing, comprehensive error handling, cross-platform testing

## See Also
- 📖 **Refactoring Tasks**: [`/docs/planning/refactoring-tasks.md`](./refactoring-tasks.md)
- 📖 **Implementation Plans**: [`/docs/planning/implementation-plans.md`](./implementation-plans.md)
- 📖 **Changelog**: [`/docs/project/changelog.md`](../project/changelog.md)