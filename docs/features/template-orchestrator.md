# Template Orchestrator Architecture

*Last updated: 2025-07-13 | New modular template management system replacing monolithic TestTemplateEngine*

## Overview

The TemplateOrchestrator implements a clean orchestrator pattern to manage test template registration, selection, and generation. This replaces the previous monolithic 1,774-line TestTemplateEngine with a modular, maintainable architecture.

## Architecture Benefits

### Code Organization
- **89% size reduction**: Main file reduced from 1,774 to 196 lines
- **Single responsibility**: Each template class handles one template type
- **Language separation**: JavaScript and Python templates in dedicated directories
- **Facade pattern**: `TestTemplateEngine` maintains API compatibility

### Modular Structure

```
src/generators/templates/
├── TestTemplateEngine.ts (facade, 196 lines)
│   └── Delegates to TemplateOrchestrator for functionality
├── TemplateOrchestrator.ts (core logic, 277 lines)
│   ├── Template registration and management
│   ├── Template selection logic
│   └── Enhanced template support
├── javascript/ (Jest-based templates)
│   ├── index.ts - Export aggregation
│   ├── JestJavaScriptTemplate.ts - Basic JS testing
│   ├── JestReactComponentTemplate.ts - React component testing
│   ├── JestExpressApiTemplate.ts - Express API testing
│   ├── JestTypeScriptTemplate.ts - TypeScript testing
│   ├── JestReactTypeScriptTemplate.ts - React TypeScript testing
│   └── Enhanced* templates - Already existing advanced templates
└── python/ (pytest-based templates)
    ├── index.ts - Export aggregation
    ├── PytestTemplate.ts - Basic Python testing
    ├── PytestFastApiTemplate.ts - FastAPI testing
    └── PytestDjangoTemplate.ts - Django testing
```

## Template System Design

### TemplateOrchestrator Class

The orchestrator manages all template operations:

```typescript
export class TemplateOrchestrator {
  private templates: Map<string, Template> = new Map();
  private registry: TemplateRegistry;

  registerTemplate(template: Template, allowOverride = false): void;
  generateTest(context: TemplateContext): string;
  generateTestSafe(context: TemplateContext): SafeGenerationResult;
  findBestTemplate(context: TemplateContext): Template | undefined;
  listTemplates(): TemplateInfo[];
}
```

### Template Registration

Templates are automatically registered during orchestrator construction:

```typescript
private registerDefaultTemplates(): void {
  // JavaScript Jest templates
  this.registerTemplate(new JestJavaScriptTemplate());
  this.registerTemplate(new JestReactComponentTemplate());
  this.registerTemplate(new JestExpressApiTemplate());

  // TypeScript Jest templates
  this.registerTemplate(new JestTypeScriptTemplate());
  this.registerTemplate(new JestReactTypeScriptTemplate());

  // Python pytest templates
  this.registerTemplate(new PytestTemplate());
  this.registerTemplate(new PytestFastApiTemplate());
  this.registerTemplate(new PytestDjangoTemplate());

  // Enhanced templates from existing files
  this.registerEnhancedTemplates();
}
```

### Template Selection Logic

The orchestrator uses intelligent template matching:

1. **Registry-based selection**: Uses `TemplateRegistry` for improved matching
2. **Fallback compatibility**: Legacy template lookup for backward compatibility
3. **Hierarchical matching**: Exact match → framework → language → defaults

```typescript
private findBestTemplate(context: TemplateContext): Template | undefined {
  // Try new TemplateRegistry first
  const registryTemplate = this.registry.findTemplate(context);
  if (registryTemplate) return registryTemplate;

  // Fallback to legacy template selection
  let key = this.getTemplateKey(context.language, context.framework, context.testType);
  let template = this.templates.get(key);
  if (template) return template;

  // Additional fallback logic...
}
```

## API Compatibility

### Facade Pattern Implementation

`TestTemplateEngine` maintains complete backward compatibility:

```typescript
export class TestTemplateEngine {
  private orchestrator: TemplateOrchestrator;

  constructor() {
    this.orchestrator = new TemplateOrchestrator();
  }

  // All methods delegate to orchestrator
  registerTemplate(template: Template, allowOverride = false): void {
    this.orchestrator.registerTemplate(template, allowOverride);
  }

  generateTest(context: TemplateContext): string {
    return this.orchestrator.generateTest(context);
  }

  // ... other methods
}
```

### Preserved Interfaces

All existing interfaces remain unchanged:
- `Template` interface
- `TemplateContext` types
- `ValidationResult` structure
- `TemplateInfo` metadata

## Template Extraction Details

### JavaScript Templates Extracted

1. **JestJavaScriptTemplate** - Basic JavaScript module testing
2. **JestReactComponentTemplate** - React component testing with RTL
3. **JestExpressApiTemplate** - Express.js API endpoint testing
4. **JestTypeScriptTemplate** - TypeScript module testing
5. **JestReactTypeScriptTemplate** - React TypeScript component testing

### Python Templates Extracted

1. **PytestTemplate** - Basic Python module testing
2. **PytestFastApiTemplate** - FastAPI endpoint testing
3. **PytestDjangoTemplate** - Django view and model testing

### Utility Functions

Common utility functions are included where needed:
- `generateJSTypeSpecificTests()` - JavaScript-specific test patterns
- `capitalize()` - String capitalization utility

## Testing & Validation

### Backward Compatibility Testing

All existing tests continue to pass:
- **Template Engine Tests**: 12/12 passing
- **Template-Related Tests**: 42/42 passing
- **Unit Test Suite**: All tests passing

### API Stability

No breaking changes to public APIs:
- All existing template registration works unchanged
- Template generation produces identical output
- Template selection logic preserved

## Development Benefits

### Maintainability
- **Focused responsibility**: Each template class handles one template type
- **Easy extension**: New templates added as individual files
- **Clear dependencies**: Import structure shows relationships

### Testability
- **Isolated testing**: Individual template classes tested independently
- **Mock-friendly**: Clean dependency injection patterns
- **Focused tests**: Template-specific test suites

### Scalability
- **Language separation**: Easy to add new languages
- **Framework patterns**: Template per framework approach
- **Plugin potential**: Architecture supports future plugin system

## Migration Impact

### For Developers
- **No code changes required**: Existing code works unchanged
- **Better debugging**: Smaller files easier to debug
- **Clearer structure**: Template organization more intuitive

### For Users
- **Transparent change**: No user-visible differences
- **Same functionality**: All template features preserved
- **Better performance**: Potential for future optimizations

## Future Enhancements

### Plugin Architecture
The modular structure enables future plugin capabilities:
- Dynamic template loading
- User-defined templates
- Framework-specific plugins

### Template Registry
Enhanced template selection with:
- Confidence scoring
- Template metadata
- Performance monitoring

### Language Extensions
Easy addition of new languages:
- Dedicated language directories
- Consistent template patterns
- Automated registration

## Integration Points

### Used By
- `TestGenerator` - Primary template consumer
- `StructuralTestGenerator` - Basic template generation
- CLI commands - Via generator chain

### Dependencies
- `TemplateRegistry` - Advanced template selection
- Template classes - Individual template implementations
- Type definitions - Context and interface types

## Performance Characteristics

### Memory Usage
- **Reduced footprint**: Smaller classes load faster
- **Lazy loading potential**: Templates can be loaded on demand
- **Better caching**: Individual template caching possible

### Generation Speed
- **Unchanged performance**: Same generation algorithms
- **Better parallelization**: Independent template classes
- **Optimization potential**: Per-template optimizations

---

**Architecture Philosophy**: Decompose monolithic classes into focused, single-responsibility components while maintaining complete API compatibility and transparency to users.