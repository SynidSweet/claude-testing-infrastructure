# Development Patterns & Conventions

## Code Organization Principles
- **Naming conventions**: camelCase for functions/variables, PascalCase for classes, kebab-case for files/directories
- **Code structure patterns**: Class-based architecture with dependency injection, utility modules, clear separation of concerns
- **Design patterns used**: Adapter Pattern (framework adapters), Factory Pattern (configuration generation), Strategy Pattern (testing approaches)
- **Error handling approach**: Try-catch with graceful degradation, warning messages for non-critical failures, comprehensive error logging

## Testing Strategy
- **Testing framework(s)**: Jest for JavaScript/TypeScript, pytest for Python, Playwright for E2E testing
- **Test organization**: Templates provide both co-located (src/__tests__/) and separate (tests/) directory structures
- **Coverage expectations**: 80% overall coverage target with 70% branch coverage minimum
- **Testing patterns**: Red-Green-Refactor TDD cycle, component testing with React Testing Library, API testing with supertest/httpx

## Configuration Management
- **Environment variables**: .env.test files for test-specific configuration, framework-specific environment handling
- **Feature flags**: Version-based feature detection, framework capability flags
- **Deployment configs**: CI/CD templates for multiple platforms (GitHub Actions, GitLab CI, CircleCI)

## See Also
- 📖 **Development Workflow**: [`/docs/development/workflow.md`](./workflow.md)
- 📖 **Important Gotchas**: [`/docs/development/gotchas.md`](./gotchas.md)
- 📖 **Architecture Insights**: [`/docs/architecture/insights.md`](../architecture/insights.md)