# Core Type System Guide

*Comprehensive guide to the foundational type system in Claude Testing Infrastructure*

## 🎯 Purpose

This guide explains the core type system that provides foundational types, utilities, and patterns used across the entire Claude Testing Infrastructure codebase. The core type system establishes consistent patterns for type safety, validation, and error handling.

## 📁 Type System Structure

### Core Modules
```
src/types/
├── core.ts           # Foundational types and utilities
├── type-guards.ts    # Runtime type checking and validation
└── index.ts          # Centralized exports
```

### Integration with Domain Types
```
src/types/
├── [CORE SYSTEM]
├── config.ts                        # Configuration types
├── analysis-types.ts               # Project analysis types
├── coverage-types.ts               # Coverage reporting types
├── generation-types.ts             # Test generation types
├── reporting-types.ts              # Result reporting types
├── timer-types.ts                  # Timer abstraction types
├── async-test-types.ts            # Async testing types
├── file-discovery-types.ts        # File discovery types
├── ai-error-types.ts              # AI error handling types
└── ai-task-types.ts               # AI task processing types
```

## 🏗️ Core Type Categories

### 1. Utility Types
**Purpose**: Generic type transformations and helpers

```typescript
import { DeepPartial, DeepRequired, Nullable, Maybe } from '@/types';

// Make all properties deeply optional
type PartialConfig = DeepPartial<Config>;

// Make all properties deeply required
type CompleteConfig = DeepRequired<PartialConfig>;

// Handle nullable values
type UserId = Nullable<string>;
type UserData = Maybe<UserInfo>;
```

### 2. Result Types
**Purpose**: Consistent error handling and operation results

```typescript
import { Result, Success, Failure, AsyncResult } from '@/types';

// Synchronous operations
function validateUser(data: unknown): Result<User, ValidationError> {
  if (isValidUser(data)) {
    return { success: true, data };
  }
  return { success: false, error: 'Invalid user data' };
}

// Asynchronous operations
async function fetchUser(id: string): AsyncResult<User, ApiError> {
  try {
    const user = await api.getUser(id);
    return { success: true, data: user };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
```

### 3. Common Enums
**Purpose**: Standardized status and priority values

```typescript
import { Status, Priority, LogLevel } from '@/types';

interface Task {
  id: string;
  status: Status;
  priority: Priority;
  logs: LogEntry[];
}

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: Date;
}
```

### 4. Base Interfaces
**Purpose**: Common patterns for entities and services

```typescript
import { Identifiable, Timestamped, Versioned, WithMetadata } from '@/types';

interface User extends Identifiable, Timestamped, WithMetadata<UserMetadata> {
  name: string;
  email: string;
}

interface Document extends Versioned {
  title: string;
  content: string;
}
```

### 5. Branded Types
**Purpose**: Type-safe primitives with semantic meaning

```typescript
import { FilePath, DirectoryPath, GlobPattern, Milliseconds } from '@/types';

function readFile(path: FilePath): Promise<string> {
  // TypeScript ensures only FilePath can be passed
}

function setTimeout(delay: Milliseconds): Timer {
  // TypeScript ensures only Milliseconds can be passed
}

// Creating branded types
const configPath = '/path/to/config.json' as FilePath;
const timeout = 5000 as Milliseconds;
```

## 🛡️ Type Guards and Validation

### Runtime Type Checking
**Purpose**: Validate data at runtime with type narrowing

```typescript
import { 
  isString, isNumber, isArray, isPlainObject,
  isNonEmptyArray, isDefined, hasStringProperty 
} from '@/types';

function processConfig(data: unknown): Config | null {
  if (!isPlainObject(data)) return null;
  if (!hasStringProperty(data, 'name')) return null;
  if (!isArray(data.include)) return null;
  
  // TypeScript now knows data has the correct shape
  return data as Config;
}
```

### Validation with Results
**Purpose**: Comprehensive validation with detailed error messages

```typescript
import { 
  validateRequired, validateString, validateArray,
  validateRange, validatePattern, Result 
} from '@/types';

function validateUserInput(input: unknown): Result<UserData> {
  const nameResult = validateString(input.name, 'name');
  if (!nameResult.success) return nameResult;
  
  const ageResult = validateRange(input.age, 0, 120, 'age');
  if (!ageResult.success) return ageResult;
  
  return { 
    success: true, 
    data: { name: nameResult.data, age: ageResult.data } 
  };
}
```

### Composite Validation
**Purpose**: Validate complex objects with multiple rules

```typescript
import { validateAll, validateAny, ValidationResult } from '@/types';

function validateComplexConfig(config: unknown): ValidationResult {
  return validateAll([
    () => validateRequired(config.database, 'database'),
    () => validateString(config.database.host, 'database.host'),
    () => validateRange(config.database.port, 1, 65535, 'database.port'),
  ]);
}
```

## 🎯 Usage Patterns

### 1. Service Implementation Pattern
```typescript
import { 
  BaseConfig, ServiceOptions, Result, AsyncResult,
  Disposable, EventEmitter, EventMap 
} from '@/types';

interface FileServiceConfig extends BaseConfig {
  maxConcurrency: number;
  timeout: Milliseconds;
}

interface FileServiceEvents extends EventMap {
  'file:read': { path: FilePath; size: number };
  'file:error': { path: FilePath; error: Error };
}

class FileService implements Disposable, EventEmitter<FileServiceEvents> {
  constructor(
    private config: FileServiceConfig,
    private options: ServiceOptions = {}
  ) {}
  
  async readFile(path: FilePath): AsyncResult<string> {
    try {
      const content = await fs.readFile(path, 'utf8');
      this.emit('file:read', { path, size: content.length });
      return { success: true, data: content };
    } catch (error) {
      this.emit('file:error', { path, error });
      return { success: false, error: error.message };
    }
  }
  
  dispose(): void {
    // Cleanup resources
  }
}
```

### 2. Error Handling Pattern
```typescript
import { Result, isSuccess, isFailure } from '@/types';

async function processFiles(paths: FilePath[]): AsyncResult<ProcessedFile[]> {
  const results: ProcessedFile[] = [];
  
  for (const path of paths) {
    const result = await fileService.readFile(path);
    
    if (isSuccess(result)) {
      results.push({ path, content: result.data });
    } else if (isFailure(result)) {
      return { success: false, error: `Failed to read ${path}: ${result.error}` };
    }
  }
  
  return { success: true, data: results };
}
```

### 3. State Management Pattern
```typescript
import { StateMachine, Status, StateTransition } from '@/types';

class TaskStateMachine implements StateMachine<Status> {
  public transitions: StateTransition<Status>[] = [];
  
  constructor(public currentState: Status = Status.PENDING) {}
  
  canTransition(to: Status): boolean {
    const validTransitions: Record<Status, Status[]> = {
      [Status.PENDING]: [Status.IN_PROGRESS, Status.CANCELLED],
      [Status.IN_PROGRESS]: [Status.COMPLETED, Status.FAILED, Status.CANCELLED],
      [Status.COMPLETED]: [],
      [Status.FAILED]: [Status.PENDING],
      [Status.CANCELLED]: [Status.PENDING],
    };
    
    return validTransitions[this.currentState].includes(to);
  }
  
  transition(to: Status, reason?: string): boolean {
    if (!this.canTransition(to)) return false;
    
    const transition: StateTransition<Status> = {
      from: this.currentState,
      to,
      timestamp: new Date(),
      reason,
    };
    
    this.currentState = to;
    this.transitions.push(transition);
    return true;
  }
}
```

## 📋 Best Practices

### 1. Type Definition Guidelines
- **Use branded types** for domain-specific primitives
- **Prefer Result types** over throwing exceptions
- **Use type guards** for runtime validation
- **Implement base interfaces** for common patterns
- **Export types** from index.ts for centralized access

### 2. Validation Guidelines
- **Validate at boundaries** (API inputs, file reads, user input)
- **Use type guards** for type narrowing
- **Return Result types** instead of throwing
- **Provide descriptive** error messages
- **Combine validators** for complex validation

### 3. Error Handling Guidelines
- **Use Result pattern** for fallible operations
- **Check success/failure** with type guards
- **Provide context** in error messages
- **Handle errors** at appropriate levels
- **Log errors** with structured data

### 4. Performance Considerations
- **Type guards are runtime checks** - use judiciously
- **Validation has overhead** - validate at boundaries only
- **Branded types are zero-cost** at runtime
- **Result types are lightweight** wrappers
- **Cache validation results** for repeated checks

## 🔧 Integration Examples

### Existing Codebase Integration
```typescript
// Before: Using any types and throwing errors
function loadConfig(path: string): any {
  const data = JSON.parse(fs.readFileSync(path, 'utf8'));
  if (!data.name) throw new Error('Name required');
  return data;
}

// After: Using core type system
import { FilePath, Result, validateObject, hasStringProperty } from '@/types';

function loadConfig(path: FilePath): Result<Config> {
  try {
    const data = JSON.parse(fs.readFileSync(path, 'utf8'));
    return validateObject(data, 'config', {
      name: isString,
      include: isStringArray,
      exclude: isStringArray,
    });
  } catch (error) {
    return { success: false, error: `Failed to load config: ${error.message}` };
  }
}
```

### Template for New Services
```typescript
import {
  BaseConfig, ServiceOptions, Result, AsyncResult,
  Disposable, LogLevel, LogEntry, Metrics,
  FilePath, Milliseconds
} from '@/types';

interface MyServiceConfig extends BaseConfig {
  // Service-specific configuration
}

interface MyServiceOptions extends ServiceOptions {
  // Service-specific options
}

class MyService implements Disposable {
  private metrics: Metrics = {
    duration: 0 as Milliseconds,
    operationCount: 0,
    errorCount: 0,
  };
  
  constructor(
    private config: MyServiceConfig,
    private options: MyServiceOptions = {}
  ) {}
  
  async performOperation(input: unknown): AsyncResult<Output> {
    const startTime = Date.now();
    this.metrics.operationCount++;
    
    try {
      // Validate input
      const validationResult = validateInput(input);
      if (!validationResult.success) {
        this.metrics.errorCount++;
        return validationResult;
      }
      
      // Perform operation
      const result = await this.doWork(validationResult.data);
      
      // Update metrics
      this.metrics.duration = (Date.now() - startTime) as Milliseconds;
      
      return { success: true, data: result };
    } catch (error) {
      this.metrics.errorCount++;
      return { success: false, error: error.message };
    }
  }
  
  dispose(): void {
    // Cleanup resources
  }
}
```

## 🚀 Migration Guide

### Step 1: Import Core Types
```typescript
// Add to your existing files
import { Result, isSuccess, validateString } from '@/types';
```

### Step 2: Replace Error Throwing
```typescript
// Before
function validate(data: any): Config {
  if (!data.name) throw new Error('Name required');
  return data;
}

// After
function validate(data: unknown): Result<Config> {
  const nameResult = validateString(data.name, 'name');
  if (!nameResult.success) return nameResult;
  return { success: true, data: data as Config };
}
```

### Step 3: Use Type Guards
```typescript
// Before
function process(input: any) {
  // Hope input is correct type
}

// After
function process(input: unknown) {
  if (!isPlainObject(input)) {
    return { success: false, error: 'Invalid input' };
  }
  // TypeScript now knows input is an object
}
```

### Step 4: Adopt Result Pattern
```typescript
// Before
try {
  const result = riskyOperation();
  useResult(result);
} catch (error) {
  handleError(error);
}

// After
const result = await riskyOperation();
if (isSuccess(result)) {
  useResult(result.data);
} else {
  handleError(result.error);
}
```

---

**Philosophy**: The core type system provides a solid foundation for type safety, error handling, and data validation across the entire codebase. Use these patterns consistently to build reliable, maintainable software.