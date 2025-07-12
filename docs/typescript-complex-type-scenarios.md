# Complex Type Scenarios Requiring Design

*Documented: 2025-07-10 | Part of TS-EXCEL-001 Task*

## Overview

This document catalogs complex type scenarios discovered during the TypeScript type audit that require careful design consideration before implementation.

## 1. Template System Registry Types

### Current State
```typescript
// src/generators/templates/core/index.ts
export function createTemplateEngineWithRegistry(registry: any) { ... }
export function registerTemplatesFromFactories(templateRegistry: any, factoryRegistry: any) { ... }
```

### Challenge
The template system uses dynamic registration patterns that need flexible but type-safe interfaces.

### Design Considerations
- Registry needs to handle multiple template types (JavaScript, Python, etc.)
- Factory pattern requires generic constraints
- Dynamic registration while maintaining type safety
- Plugin architecture compatibility

### Proposed Solution
```typescript
interface TemplateRegistry<T extends Template = Template> {
  register(name: string, template: T): void;
  get(name: string): T | undefined;
  getAll(): Map<string, T>;
}

interface TemplateFactoryRegistry {
  register<T extends Template>(
    language: string, 
    factory: TemplateFactory<T>
  ): void;
}
```

## 2. Template Context Metadata

### Current State
```typescript
// Multiple template files
const metadata = (context as any).metadata;
```

### Challenge
Different templates need different metadata structures, but all extend from base context.

### Design Considerations
- Each framework needs specific metadata
- Backward compatibility with existing templates
- Type safety without excessive boilerplate
- Runtime validation needs

### Proposed Solution
```typescript
// Base metadata interface
interface BaseMetadata {
  framework?: string;
  version?: string;
  [key: string]: unknown; // Allow extensions
}

// Framework-specific metadata
interface ReactMetadata extends BaseMetadata {
  framework: 'react';
  componentType?: 'functional' | 'class';
  hooks?: string[];
}

// Generic context extension
interface ExtendedContext<M extends BaseMetadata = BaseMetadata> 
  extends TestGenerationContext {
  metadata?: M;
}
```

## 3. Dynamic File Discovery Configuration

### Current State
```typescript
// src/cli/commands/analyze.ts
let fileDiscovery: any;
fileDiscovery = new FileDiscoveryService(/* ... */);
```

### Challenge
FileDiscoveryService is conditionally created with different configurations.

### Design Considerations
- Service might not be initialized
- Different configuration shapes
- Lazy initialization pattern
- Error handling for uninitialized state

### Proposed Solution
```typescript
type FileDiscoveryInstance = FileDiscoveryService | null;

interface FileDiscoveryFactory {
  create(config: FileDiscoveryConfig): FileDiscoveryService;
  createLazy(configProvider: () => FileDiscoveryConfig): () => FileDiscoveryService;
}
```

## 4. Logger Level Type Safety

### Current State
```typescript
// Multiple files
logger.level = config.output.logLevel as any;
```

### Challenge
Logger level types don't match configuration types directly.

### Design Considerations
- Third-party logger library constraints
- Configuration validation
- Type mapping between systems
- Runtime safety

### Proposed Solution
```typescript
// Type mapping
type ConfigLogLevel = 'debug' | 'info' | 'warn' | 'error';
type WinstonLogLevel = 'silly' | 'debug' | 'verbose' | 'info' | 'warn' | 'error';

function mapLogLevel(configLevel: ConfigLogLevel): WinstonLogLevel {
  const mapping: Record<ConfigLogLevel, WinstonLogLevel> = {
    'debug': 'debug',
    'info': 'info',
    'warn': 'warn',
    'error': 'error'
  };
  return mapping[configLevel];
}

// Usage
logger.level = mapLogLevel(config.output.logLevel);
```

## 5. Dynamic CLI Command Options

### Current State
```typescript
// src/cli/commands/test-ai.ts
.action(async (_projectPath: string, _options: any) => { ... })
```

### Challenge
Each command has different option shapes but shares common patterns.

### Design Considerations
- Commander.js integration
- Type inference from command definition
- Shared option interfaces
- Validation needs

### Proposed Solution
```typescript
// Base options all commands share
interface BaseCommandOptions {
  verbose?: boolean;
  config?: string;
  output?: string;
}

// Command-specific options
interface TestAICommandOptions extends BaseCommandOptions {
  model?: string;
  budget?: number;
  concurrency?: number;
}

// Type-safe command builder
function createCommand<T extends BaseCommandOptions>(
  name: string,
  handler: (path: string, options: T) => Promise<void>
): Command { ... }
```

## 6. Watcher Event Types

### Current State
```typescript
// src/cli/commands/watch.ts
debouncer.on('debounced', async (event: DebouncedEvent<any>, groupKey: string) => { ... })
```

### Challenge
Event system with generic payloads needs type safety.

### Design Considerations
- Multiple event types
- Generic event data
- Type narrowing in handlers
- Event emitter constraints

### Proposed Solution
```typescript
// Event type definitions
type WatchEvent = 
  | { type: 'change'; path: string; stats: fs.Stats }
  | { type: 'add'; path: string }
  | { type: 'unlink'; path: string };

interface DebouncedEvent<T extends WatchEvent> {
  events: T[];
  timestamp: number;
}

// Type-safe event handler
type EventHandler<T extends WatchEvent> = (
  event: DebouncedEvent<T>, 
  groupKey: string
) => Promise<void>;
```

## 7. Test Framework Configuration

### Current State
```typescript
// Multiple uses of Record<string, any> for options
options?: Record<string, any>;
```

### Challenge
Different test frameworks need different configuration shapes.

### Design Considerations
- Jest vs Pytest vs others
- Framework-specific options
- Extensibility for new frameworks
- Type safety vs flexibility

### Proposed Solution
```typescript
// Base configuration
interface BaseTestConfig {
  testMatch?: string[];
  coverage?: boolean;
  timeout?: number;
}

// Framework-specific configs
interface JestConfig extends BaseTestConfig {
  framework: 'jest';
  setupFiles?: string[];
  transformIgnorePatterns?: string[];
}

interface PytestConfig extends BaseTestConfig {
  framework: 'pytest';
  markers?: string[];
  pythonpath?: string[];
}

// Union type for all configs
type TestFrameworkConfig = JestConfig | PytestConfig;
```

## Implementation Priority

1. **High Priority** (Blocking other fixes):
   - Template Context Metadata - Affects 7 files
   - Template System Registry Types - Core infrastructure

2. **Medium Priority** (Standalone fixes):
   - Logger Level Type Safety - Quick fix
   - CLI Command Options - Improves user experience

3. **Low Priority** (Nice to have):
   - Watcher Event Types - Limited scope
   - Test Framework Configuration - Future extensibility

## Next Steps

1. Review proposed solutions with team
2. Create detailed implementation plan for high priority items
3. Update type patterns guide with approved designs
4. Implement incrementally with tests

---

These complex scenarios require thoughtful design to maintain both type safety and usability in the codebase.