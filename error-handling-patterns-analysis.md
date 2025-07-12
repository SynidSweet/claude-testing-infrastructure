# Error Handling Patterns Analysis

## Summary

After analyzing the codebase, I found the following untyped error handling patterns:

### 1. **Untyped catch blocks with `catch (error)`** (Most Common)
This is the predominant pattern across the codebase with 300+ occurrences.

**Count:** 
- src/: ~180 occurrences
- tests/: ~120 occurrences

**Examples by module:**

#### AI Module (src/ai/)
- `src/ai/AITaskPreparation.ts:146`
- `src/ai/AITaskPreparation.ts:163`
- `src/ai/ChunkedAITaskPreparation.ts:146,227,269`
- `src/ai/ClaudeOrchestrator.ts:342,1040`
- `src/ai/heartbeat/HeartbeatMonitor.ts:164,270,278`

#### Analyzers Module (src/analyzers/)
- `src/analyzers/ProjectAnalyzer.ts:157,206,539,681,1286,1318,1336,1350,1361,1397,1418,1468,1515,1537,1580`
- `src/analyzers/TestGapAnalyzer.ts:293`
- `src/analyzers/gap-analysis/ContextExtractor.ts:169`
- `src/analyzers/index.ts:72`

#### CLI Module (src/cli/)
- `src/cli/commands/analyze-gaps.ts:51,190,218`
- `src/cli/commands/analyze.ts:132`
- `src/cli/commands/generate-logical-batch.ts:370`
- `src/cli/commands/generate-logical.ts:341`
- `src/cli/commands/incremental.ts:277`
- `src/cli/commands/init-config.ts:131,264,291,338`
- `src/cli/commands/run.ts:113,268`
- `src/cli/commands/test.ts:321,336,412,591,743,784`
- `src/cli/commands/watch.ts:104,225,306`
- `src/cli/index.ts:140`
- `src/cli/utils/command-patterns.ts:131`
- `src/cli/utils/config-loader.ts:130,170`
- `src/cli/utils/error-handler.ts:296`

#### Utilities (src/utils/)
- `src/utils/AsyncTestUtils.ts:203,549`
- `src/utils/retry-helper.ts:372,529`
- `src/utils/ResourceLimitWrapper.ts:305,310`
- `src/utils/RealTimer.ts:129`
- `src/utils/config-validation.ts:54,195`
- `src/utils/ProcessMonitor.ts:113,165,247`
- `src/utils/error-handling.ts:86,107,137,158,179,200,308`
- `src/utils/FileWatcher.ts:181,202,280`
- `src/utils/TimerTestUtils.ts:399`

#### Services (src/services/)
- `src/services/FileDiscoveryService.ts:108,320`
- `src/services/EnhancedFileDiscoveryService.ts:153,330`

#### Config Module (src/config/)
- `src/config/ConfigurationService.ts:229`
- `src/config/CliArgumentMapper.ts:363`
- `src/config/loaders/CustomFileConfigurationLoader.ts:58`
- `src/config/loaders/ProjectConfigurationLoader.ts:39`
- `src/config/loaders/UserConfigurationLoader.ts:50`

#### Generators (src/generators/)
- `src/generators/base/BaseTestGenerator.ts:165,212,377`
- `src/generators/javascript/analyzers/AsyncPatternDetector.ts:75,211`
- `src/generators/javascript/analyzers/ModuleSystemAnalyzer.ts:94,159,227,267,339,373,409`
- `src/generators/javascript/JavaScriptTestGenerator.ts:100,138,196`
- `src/generators/StructuralTestGenerator.ts:213,269,364,894`
- Multiple template files in `src/generators/templates/`

### 2. **Type assertions with `as Error`**
Less common but still present in critical error handling paths.

**Count:** ~13 occurrences

**Examples:**
- `src/ai/heartbeat/HeartbeatMonitor.ts:96,168,282` - `error as Error`
- `src/config/loaders/CustomFileConfigurationLoader.ts:60` - `(error as Error).message`
- `src/config/loaders/ProjectConfigurationLoader.ts:41` - `(error as Error).message`
- `src/utils/config-validation.ts:59,196` - `(error as Error).message`
- Multiple test files in `tests/validation/ai-agents/`

### 3. **Type assertions with specific error types**
- `src/services/EnhancedFileDiscoveryService.ts:331` - `error as NodeJS.ErrnoException`

### 4. **Explicit `any` type**
Only found in test files:
- `tests/validation/ai-agents/connectivity/claude-cli-integration.test.ts:86` - `catch (error: any)`

### 5. **Short parameter names**
- `src/generators/StructuralTestGenerator.ts:752` - `catch (e)`
- `src/generators/templates/MCPTransportTemplate.ts` - `catch (e) {}`

## Common Error Handling Patterns Inside Catch Blocks

1. **Conditional type checking:**
   ```typescript
   error instanceof Error ? error.message : String(error)
   ```

2. **Direct type assertion:**
   ```typescript
   (error as Error).message
   ```

3. **Creating new errors:**
   ```typescript
   new Error(String(error))
   ```

4. **Error type guards:**
   ```typescript
   error instanceof AIWorkflowError
   ```

5. **Node.js specific error handling:**
   ```typescript
   const errorWithCode = error as NodeJS.ErrnoException;
   if (errorWithCode.code === 'ENOENT') { ... }
   ```

## Recommendations

1. **Define a standard error type** for catch blocks:
   ```typescript
   catch (error: unknown) {
     // Handle with proper type guards
   }
   ```

2. **Create utility functions** for common error handling patterns:
   ```typescript
   function getErrorMessage(error: unknown): string {
     return error instanceof Error ? error.message : String(error);
   }
   ```

3. **Use specific error types** where applicable:
   ```typescript
   catch (error: NodeJS.ErrnoException) {
     if (error.code === 'ENOENT') { ... }
   }
   ```

4. **Avoid type assertions** in favor of type guards:
   ```typescript
   if (error instanceof Error) {
     // error is typed as Error here
   }
   ```