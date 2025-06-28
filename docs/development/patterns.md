# Development Patterns

*Last updated: 2025-06-28 | Created by: /document command*

## Overview

This document describes key development patterns used throughout the Claude Testing Infrastructure codebase. These patterns help maintain consistency, reduce complexity, and improve maintainability.

## Template Method Pattern

### Overview
The Template Method pattern is used to separate content/structure from presentation logic, particularly in report generation. This pattern defines the skeleton of an algorithm in a base class, letting subclasses override specific steps without changing the algorithm's structure.

### Implementation in Coverage Reporters

#### Problem Solved
Before implementing this pattern, report generation methods were extremely long (50-150 lines) mixing:
- Data transformation logic
- String formatting
- Content structure
- Output formatting

#### Solution Architecture
```
CoverageVisualizer
    ├── Uses → HtmlTemplateEngine
    ├── Uses → MarkdownTemplateEngine  
    └── Uses → XmlTemplateEngine

Each Template Engine:
    ├── prepareTemplateData() - Transforms raw data into template-ready format
    └── render() - Generates output using prepared data
```

#### Benefits Achieved
- **Complexity Reduction**: 
  - HTML: 137 → 16 lines (88% reduction)
  - Markdown: 48 → 14 lines (71% reduction)
  - XML: 30 → 9 lines (70% reduction)
- **Separation of Concerns**: Content structure separated from generation logic
- **Customization**: Easy to modify reports without changing code
- **Testability**: Each component can be tested independently

#### Example Usage
```typescript
// Before: Mixed concerns in one large method
private async generateMarkdownReport(data: CoverageData, filePath: string) {
  // 48 lines of mixed logic, formatting, and content...
}

// After: Clean separation
private async generateMarkdownReport(data: CoverageData, filePath: string) {
  const gaps = this.analyzeGaps(data);
  const templateData = this.markdownTemplateEngine.prepareTemplateData(data, gaps, this.config.projectName);
  const markdown = this.markdownTemplateEngine.render(templateData);
  await fs.writeFile(filePath, markdown, 'utf8');
}
```

### When to Apply This Pattern

Use the Template Method pattern when:
1. **Multiple output formats** share similar structure but different syntax
2. **Methods exceed 50 lines** mixing data processing with formatting
3. **Customization is needed** without modifying core logic
4. **Testing is difficult** due to mixed concerns

### Implementation Guidelines

1. **Create a dedicated engine class** for each output format
2. **Define a data preparation method** that transforms raw data into template-ready format
3. **Implement a render method** that uses the prepared data
4. **Keep the main method simple** - just orchestrate the steps
5. **Use external templates** when content is complex (like HTML)

### Files Using This Pattern
- `/src/runners/CoverageVisualizer.ts` - Main orchestrator
- `/src/runners/templates/HtmlTemplateEngine.ts` - HTML report generation
- `/src/runners/templates/MarkdownTemplateEngine.ts` - Markdown report generation
- `/src/runners/templates/XmlTemplateEngine.ts` - XML report generation
- `/src/runners/templates/coverage-report.html` - External HTML template

## Language Adapter Pattern

### Overview
The Language Adapter pattern provides language-specific implementations while maintaining a consistent interface. This is NOT code duplication - it's intentional separation of concerns for different language ecosystems.

### Implementation
```
IProjectAdapter (Interface)
    ├── JavaScriptAdapter - Handles npm, package.json, Jest/Vitest
    └── PythonAdapter - Handles pip, setup.py, pytest

Each adapter knows:
- How to detect its language
- Framework-specific patterns
- Dependency management
- Test runner configuration
```

### Benefits
- **Extensibility**: Easy to add new languages
- **Maintainability**: Language-specific logic is isolated
- **Consistency**: Same interface for all languages
- **Type Safety**: Each adapter can have language-specific types

## Future Patterns to Document

### Command Pattern
- For CLI command handling
- Planned for refactoring `handleIncrementalCommand`

### Builder Pattern
- For configuration generation
- Used in test setup creation

### Observer Pattern
- For file watching and change detection
- Used in incremental testing

### Factory Pattern
- For test runner selection
- Already implemented in TestRunnerFactory

## See Also
- **Architecture Overview**: [`/docs/architecture/overview.md`](../architecture/overview.md)
- **Coding Conventions**: [`/docs/development/conventions.md`](./conventions.md)
- **Refactoring Plan**: [`/docs/planning/refactoring-tasks.md`](../planning/refactoring-tasks.md)