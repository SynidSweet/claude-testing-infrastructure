# TypeScript Type Patterns Guide

*Last updated: 2025-01-18 | Added AI workflow type patterns from TS-EXCEL-003 implementation*

## Overview

This guide establishes standardized type patterns for the Claude Testing Infrastructure codebase to ensure consistency, type safety, and maintainability.

## Core Type Patterns

### 0. AI Workflow Type Patterns

**Use comprehensive type definitions for complex workflows:**

```typescript
// ✅ Good - Complete type system for workflow management
export type WorkflowPhase = 
  | 'analysis'
  | 'structural-generation'
  | 'test-execution'
  | 'gap-analysis'
  | 'ai-generation'
  | 'final-execution';

export interface WorkflowEvents {
  'workflow:start': { projectPath: string; config: WorkflowConfig };
  'workflow:complete': { result: WorkflowResult };
  'workflow:error': { error: AIWorkflowError };
  'phase:start': { phase: WorkflowPhase };
  'phase:complete': { phase: WorkflowPhase; result?: unknown };
}

// Type-safe event emission
public emit<K extends keyof WorkflowEvents>(event: K, data: WorkflowEvents[K]): boolean {
  return super.emit(event, data);
}

// ❌ Bad - Using any types
orchestrator.on('task:complete', ({ task }) => {
  this.emit('ai:task-complete', { file: (task as any).sourceFile });
});
```

**Implement phase transition validation:**

```typescript
// ✅ Good - Validated state transitions
export const WORKFLOW_PHASE_TRANSITIONS: Record<WorkflowPhase, WorkflowPhase[]> = {
  'analysis': ['structural-generation'],
  'structural-generation': ['test-execution', 'gap-analysis'],
  // ... other transitions
};

export function isValidPhaseTransition(from: WorkflowPhase | null, to: WorkflowPhase): boolean {
  if (from === null) return to === 'analysis';
  return WORKFLOW_PHASE_TRANSITIONS[from]?.includes(to) ?? false;
}
```

### 1. Error Handling Pattern

**Use explicit `unknown` type in catch blocks:**

```typescript
// ✅ Good
try {
  await someAsyncOperation();
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  logger.error(`Operation failed: ${message}`);
}

// ❌ Bad - implicit unknown
} catch (error) {
  // error is implicitly unknown
}
```

### 2. Extending Context Interfaces

**For template metadata and extended properties:**

```typescript
// ✅ Good - Extend existing interfaces
interface ExtendedTestContext extends TestGenerationContext {
  metadata?: Record<string, unknown>;
  customProperties?: {
    framework: string;
    version: string;
  };
}

// ❌ Bad - Type assertions
const metadata = (context as any).metadata;
```

### 3. Function Return Types

**Always specify return types for exported functions:**

```typescript
// ✅ Good
export function createTemplateEngine(): TemplateEngine {
  return new TemplateEngine();
}

export async function processFile(path: string): Promise<ProcessResult> {
  // implementation
}

// ❌ Bad - Missing return type
export function createTemplateEngine() {
  return new TemplateEngine();
}
```

### 4. Avoiding `any` in Parameters

**Use specific types or generics instead of `any`:**

```typescript
// ✅ Good - Specific type
function processOrchestrator(orchestrator: ClaudeOrchestrator): void {
  // implementation
}

// ✅ Good - Generic type
function processData<T>(data: T): ProcessedData<T> {
  // implementation
}

// ❌ Bad - any parameter
function processOrchestrator(orchestrator: any): void {
  // implementation
}
```

### 5. Configuration Objects

**Use interfaces for configuration instead of `Record<string, any>`:**

```typescript
// ✅ Good
interface ProjectConfig {
  name: string;
  version: string;
  features?: {
    ai?: boolean;
    coverage?: boolean;
  };
  metadata?: Record<string, unknown>; // Only for truly dynamic data
}

// ❌ Bad
type ProjectConfig = Record<string, any>;
```

### 6. Type Guards

**Create type guards for runtime type checking:**

```typescript
// ✅ Good
function isClaudeOrchestrator(obj: unknown): obj is ClaudeOrchestrator {
  return obj !== null && 
         typeof obj === 'object' && 
         'processAITasks' in obj;
}

// Usage
if (isClaudeOrchestrator(someObject)) {
  someObject.processAITasks(); // Type safe!
}
```

### 7. Discriminated Unions

**Use discriminated unions for state management:**

```typescript
// ✅ Good
type TaskState = 
  | { status: 'pending'; taskId: string }
  | { status: 'running'; taskId: string; startTime: Date }
  | { status: 'completed'; taskId: string; result: TaskResult }
  | { status: 'failed'; taskId: string; error: Error };

// Type narrowing works automatically
function handleTask(state: TaskState) {
  switch (state.status) {
    case 'completed':
      console.log(state.result); // TypeScript knows result exists
      break;
    case 'failed':
      console.log(state.error); // TypeScript knows error exists
      break;
  }
}
```

### 8. Utility Types

**Use TypeScript utility types effectively:**

```typescript
// Common utility types to use
type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

type Nullable<T> = T | null | undefined;

type AsyncReturnType<T extends (...args: any[]) => Promise<any>> = 
  T extends (...args: any[]) => Promise<infer R> ? R : never;

// Usage
type PartialConfig = DeepPartial<ProjectConfig>;
type MaybeResult = Nullable<TestResult>;
type OrchestratorResult = AsyncReturnType<typeof orchestrator.processAITasks>;
```

### 9. Import Types

**Use type imports for type-only imports:**

```typescript
// ✅ Good - Type-only import
import type { ClaudeOrchestrator } from '../ai/ClaudeOrchestrator';
import type { TestResult, CoverageResult } from '../types';

// ✅ Good - Mixed import
import { logger, type LogLevel } from '../utils/logger';

// ❌ Bad - Regular import for types
import { ClaudeOrchestrator } from '../ai/ClaudeOrchestrator'; // If only used as type
```

### 10. Const Assertions

**Use const assertions for literal types:**

```typescript
// ✅ Good
const ERROR_TYPES = ['auth', 'network', 'rate-limit'] as const;
type ErrorType = typeof ERROR_TYPES[number]; // 'auth' | 'network' | 'rate-limit'

// ✅ Good - Object const assertion
const CONFIG = {
  maxRetries: 3,
  timeout: 5000,
  model: 'claude-3'
} as const;
type Config = typeof CONFIG;
```

### 11. Function Return Type Annotations

**Add explicit return types for exported functions:**

```typescript
// ✅ Good - Explicit return type for clarity
import type { Ora } from 'ora';

export function getCommandSpinner(text: string): Ora {
  return ora(text);
}

// ✅ Good - When type is complex, use explicit annotation
export function createTemplateEngine(): TemplateEngine {
  const { TemplateRegistry } = require('./TemplateRegistry');
  const { TemplateEngine } = require('./TemplateEngine');
  const registry = new TemplateRegistry();
  return new TemplateEngine(registry);
}

// ✅ Good - PropertyDecorator return type (but avoid if TypeScript inference issues)
export function Retry(options: RetryOptions = {}) {
  return function (
    _target: unknown,
    _propertyKey: string | symbol,  // Note: symbol support for decorator compatibility
    descriptor: PropertyDescriptor
  ): PropertyDescriptor {
    // implementation
  };
}

// ❌ Avoid - Omitting return types for exported functions
export function getCommandSpinner(text: string) {
  return ora(text); // Type not immediately clear to consumers
}
```

**Return Type Best Practices:**
- **Always annotate exported functions** - Improves API clarity and type checking
- **Import required types** - Use `import type { }` for type-only imports 
- **Handle decorator compatibility** - Use `string | symbol` for property keys in decorators
- **Prefer explicit over complex inference** - When return type is complex or non-obvious
- **Test compilation** - Ensure TypeScript compiles cleanly after adding return types

## Migration Patterns

### Replacing `any` Types

**Step-by-step approach:**

1. **Identify the actual type**:
   ```typescript
   // Look at usage
   orchestrator.processAITasks(); // Indicates ClaudeOrchestrator
   ```

2. **Add proper import**:
   ```typescript
   import type { ClaudeOrchestrator } from '../ai/ClaudeOrchestrator';
   ```

3. **Replace `any` with specific type**:
   ```typescript
   // Before
   function process(orchestrator: any) { }
   
   // After
   function process(orchestrator: ClaudeOrchestrator) { }
   ```

4. **Handle edge cases**:
   ```typescript
   // If type can be multiple things
   function process(input: ClaudeOrchestrator | MockOrchestrator) { }
   ```

### Adding Return Types

**Process for adding missing return types:**

1. **Infer from implementation**:
   ```typescript
   // Implementation returns TemplateEngine
   function createEngine() {
     return new TemplateEngine();
   }
   
   // Add explicit type
   function createEngine(): TemplateEngine {
     return new TemplateEngine();
   }
   ```

2. **Use ReturnType utility for complex cases**:
   ```typescript
   type EngineCreator = () => TemplateEngine;
   const createEngine: EngineCreator = () => new TemplateEngine();
   ```

## Best Practices

### DO ✅

- Use `unknown` instead of `any` when type is truly unknown
- Add explicit return types to all exported functions
- Create specific interfaces for configuration objects
- Use type guards for runtime type checking
- Import types using `import type` when possible
- Document complex types with JSDoc comments

### DON'T ❌

- Use `any` unless absolutely necessary (3rd party integration)
- Use type assertions (`as`) to bypass type checking
- Create overly generic types (`Record<string, any>`)
- Ignore TypeScript errors with `@ts-ignore`
- Use `Function` type (use specific function signatures)
- Mix type definitions with implementation

## Type Documentation

**Document complex types:**

```typescript
/**
 * Represents the result of a test execution
 * @property passed - Number of tests that passed
 * @property failed - Number of tests that failed
 * @property skipped - Number of tests that were skipped
 * @property duration - Total execution time in milliseconds
 */
interface TestResult {
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
}
```

## Enforcement

### Pre-commit Checks

```json
// .husky/pre-commit
"tsc --noEmit"
"eslint . --ext .ts,.tsx --max-warnings 0"
```

### ESLint Rules

```json
{
  "@typescript-eslint/no-explicit-any": "error",
  "@typescript-eslint/explicit-function-return-type": "error",
  "@typescript-eslint/no-unsafe-assignment": "error",
  "@typescript-eslint/no-unsafe-member-access": "error",
  "@typescript-eslint/no-unsafe-call": "error"
}
```

---

These patterns ensure consistent, type-safe code across the Claude Testing Infrastructure project.