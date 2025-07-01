# Template Engine System

*Documentation for the inheritance-based template engine architecture*

*Last updated: 2025-07-01 | Updated by: /document command | Template Engine Consolidation*

## Overview

The template engine system provides multi-format coverage report generation using an inheritance-based architecture. All template engines extend a common BaseTemplateEngine abstract class that provides shared functionality and consistent interfaces.

## Architecture

### BaseTemplateEngine Abstract Class

**Location**: `src/runners/templates/BaseTemplateEngine.ts` (122 lines)

The base class provides:

#### Common Interfaces
```typescript
interface BaseTemplateData {
  projectName: string;
  generatedDate: string;
  timestamp: string;
}
```

#### Shared Utility Methods
- **`getCoverageClass(percentage: number)`** - Returns CSS class ('good', 'warning', 'poor') based on coverage percentage
- **`formatPercentage(value: number)`** - Formats numbers to one decimal place
- **`getCurrentDateString()`** - Returns current date as locale string
- **`getCurrentTimestamp()`** - Returns current ISO timestamp
- **`createBaseTemplateData(projectName?)`** - Creates base template data with common properties

#### Data Transformation Utilities
- **`transformFilesData(files)`** - Converts coverage files to consistent format with percentage formatting
- **`transformSuggestionsData(suggestions)`** - Transforms suggestion arrays with index numbering

#### Abstract Methods
```typescript
abstract render(data: TData): Promise<string>;
abstract prepareTemplateData(data: TInput, gaps?: CoverageGapAnalysis, projectName?: string): TData;
```

## Template Engine Implementations

### HtmlTemplateEngine

**Location**: `src/runners/templates/HtmlTemplateEngine.ts` (144 lines)

#### Features
- **Template loading and caching** - Loads external HTML template files with Map-based cache
- **Complex template rendering** - Supports variables, conditionals, and loops in templates
- **Async render interface** - Consistent with base class async pattern
- **Built-in template rendering** - Internal `renderTemplate` method for template processing

#### Interface
```typescript
interface HtmlTemplateData extends BaseTemplateData {
  metrics: Array<{
    name: string;
    value: string;
    coverageClass: string;
  }>;
  files: Array<{ /* file coverage data */ }>;
  suggestions?: Array<{ /* improvement suggestions */ }>;
  uncoveredAreas?: Array<{ /* uncovered code areas */ }>;
}
```

#### Template Syntax
Supports mustache-like template syntax:
- Variables: `{{variable}}`
- Conditionals: `{{#if condition}}...{{/if}}`
- Loops: `{{#each array}}...{{/each}}`
- Nested properties: `{{object.property}}`

### MarkdownTemplateEngine

**Location**: `src/runners/templates/MarkdownTemplateEngine.ts` (122 lines)

#### Features
- **Table generation** - Creates properly formatted markdown tables
- **Threshold status** - Shows pass/fail status with emojis
- **Numbered suggestions** - Auto-numbered improvement suggestions
- **Clean markdown output** - Well-structured markdown with headers and sections

#### Interface
```typescript
interface MarkdownTemplateData extends BaseTemplateData {
  summary: {
    statements: string;
    branches: string;
    functions: string;
    lines: string;
  };
  meetsThresholds?: boolean;
  files: Array<{ /* file data */ }>;
  suggestions: Array<{ /* numbered suggestions */ }>;
}
```

### XmlTemplateEngine

**Location**: `src/runners/templates/XmlTemplateEngine.ts` (103 lines)

#### Features
- **XML escaping** - Proper escaping of special characters
- **Structured output** - Well-formed XML with proper nesting
- **Attribute support** - Includes project name and generation timestamp as attributes
- **Summary and details** - Both high-level summary and detailed file coverage

#### Interface
```typescript
interface XmlTemplateData extends BaseTemplateData {
  summary: {
    statements: number;
    branches: number;
    functions: number;
    lines: number;
  };
  files: Array<{ /* file data with numeric values */ }>;
  uncoveredAreas: Array<{ /* uncovered areas */ }>;
}
```

## Integration with CoverageVisualizer

The template engines are used by `CoverageVisualizer` to generate different report formats:

```typescript
// CoverageVisualizer usage pattern
private async generateHtmlReport(data: CoverageData | AggregatedCoverageData, filePath: string): Promise<void> {
  const gaps = this.analyzeGaps(data);
  const templateData = this.htmlTemplateEngine.prepareTemplateData(data, gaps, this.config.projectName);
  
  // Render using async interface
  const html = await this.htmlTemplateEngine.render(templateData);
  
  await fs.writeFile(filePath, html, 'utf8');
}
```

## Benefits of the Architecture

### Code Reuse
- **Shared utilities** eliminate duplication across template engines
- **Consistent data transformation** patterns
- **Common interface** patterns reduce implementation errors

### Type Safety
- **Interface inheritance** ensures consistent data structures
- **Generic base class** provides type-safe abstract methods
- **TypeScript strict mode** compliance

### Maintainability
- **Single source of truth** for common functionality
- **Easy to add new formats** by extending BaseTemplateEngine
- **Centralized utility methods** for easy updates

### Backward Compatibility
- **Existing integrations** continue to work without changes
- **Legacy methods** preserved where needed
- **Gradual migration** path for future improvements

## Adding New Template Engines

To add a new template engine:

1. **Create interface** extending `BaseTemplateData`
2. **Implement class** extending `BaseTemplateEngine<YourData>`
3. **Override abstract methods**:
   - `render(data: YourData): string`
   - `prepareTemplateData(data, gaps?, projectName?): YourData`
4. **Use inherited utilities** for common operations
5. **Integrate with CoverageVisualizer** if needed

### Example
```typescript
export interface JsonTemplateData extends BaseTemplateData {
  coverage: any;
  gaps: any;
}

export class JsonTemplateEngine extends BaseTemplateEngine<JsonTemplateData> {
  async render(data: JsonTemplateData): Promise<string> {
    return JSON.stringify(data, null, 2);
  }
  
  prepareTemplateData(data: CoverageData, gaps?: CoverageGapAnalysis, projectName?: string): JsonTemplateData {
    const baseData = this.createBaseTemplateData(projectName);
    return {
      ...baseData,
      coverage: data,
      gaps: gaps || {}
    };
  }
}
```

## Performance Considerations

- **Template caching** in HtmlTemplateEngine reduces file I/O
- **Lazy loading** of templates only when needed
- **Memory efficiency** through shared utility methods
- **No duplication** of common logic across engines

## Testing

Template engines are tested through:
- **Unit tests** for individual methods
- **Integration tests** with CoverageVisualizer
- **End-to-end tests** for complete report generation
- **Type checking** through TypeScript compilation

The inheritance-based architecture makes testing easier by allowing testing of shared functionality once in the base class, with format-specific tests for each implementation.