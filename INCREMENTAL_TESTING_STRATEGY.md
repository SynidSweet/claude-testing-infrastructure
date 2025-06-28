# Incremental Testing Strategy: Smart Change Detection & Complementary Test Generation

## 🎯 Vision

Create a deterministic system that:
1. **Tracks** test generation history
2. **Detects** code changes since last run
3. **Analyzes** impact of changes
4. **Generates** only necessary complementary tests
5. **Maintains** test evolution history

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Incremental Testing System                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Test State Management        2. Change Detection            │
│  ┌─────────────────────┐       ┌──────────────────────┐       │
│  │  .claude-testing/   │       │   Git Diff Analyzer   │       │
│  │  ├── manifest.json  │◄──────┤   - File changes      │       │
│  │  ├── history/       │       │   - Function changes  │       │
│  │  └── baselines/     │       │   - Dependency impact │       │
│  └─────────────────────┘       └──────────────────────┘       │
│            │                              │                      │
│            ▼                              ▼                      │
│  ┌─────────────────────────────────────────────────┐           │
│  │              Change Impact Analyzer              │           │
│  │  - New files → Full test generation            │           │
│  │  - Modified functions → Targeted regeneration  │           │
│  │  - Dependency changes → Cascade analysis       │           │
│  └─────────────────────────────────────────────────┘           │
│                          │                                      │
│                          ▼                                      │
│  ┌─────────────────────────────────────────────────┐           │
│  │         Complementary Test Generator            │           │
│  │  - Incremental structural tests                │           │
│  │  - Targeted AI logical tests                   │           │
│  │  - Regression test updates                     │           │
│  └─────────────────────────────────────────────────┘           │
└─────────────────────────────────────────────────────────────────┘
```

## 📋 Implementation Components

### 1. Test State Management

#### 1.1 Testing Manifest
```json
// .claude-testing/manifest.json
{
  "version": "1.0.0",
  "lastRun": "2024-01-10T10:00:00Z",
  "lastCommit": "abc123def456",
  "testingBranch": "claude-testing/baseline-abc123d",
  "project": {
    "path": "/path/to/project",
    "language": "javascript",
    "framework": "react"
  },
  "coverage": {
    "line": 89,
    "branch": 76,
    "logical": 72
  },
  "files": {
    "src/components/Button.jsx": {
      "hash": "sha256:1234567890abcdef",
      "lastTested": "2024-01-10T10:00:00Z",
      "tests": {
        "structural": "generated/tests/components/Button.test.jsx",
        "logical": "generated/tests/components/Button.logical.test.jsx"
      },
      "coverage": {
        "line": 100,
        "branch": 100,
        "logical": 85
      }
    }
  },
  "costTracking": {
    "totalTokensUsed": 125000,
    "totalCost": 2.45,
    "incrementalRuns": [
      {
        "date": "2024-01-10T10:00:00Z",
        "tokensUsed": 45000,
        "cost": 0.84,
        "filesProcessed": 12
      }
    ]
  }
}
```

#### 1.2 Git Branch Strategy
```javascript
// src/state/test-branch-manager.js
class TestBranchManager {
  async initializeTestingBranch(projectPath) {
    const mainBranch = await this.getCurrentBranch(projectPath);
    const commit = await this.getCurrentCommit(projectPath);
    const branchName = `claude-testing/baseline-${commit.substring(0, 7)}`;
    
    // Create testing branch
    await this.git(projectPath, ['checkout', '-b', branchName]);
    
    // Store generated tests in branch
    await this.git(projectPath, ['add', '.claude-testing/']);
    await this.git(projectPath, ['commit', '-m', 'Claude: Initial test baseline']);
    
    // Return to original branch
    await this.git(projectPath, ['checkout', mainBranch]);
    
    return { branchName, baselineCommit: commit };
  }
  
  async getChangesSinceBaseline(projectPath, baselineBranch) {
    // Get diff between current state and testing branch
    const diff = await this.git(projectPath, [
      'diff',
      `${baselineBranch}...HEAD`,
      '--name-status'
    ]);
    
    return this.parseDiff(diff);
  }
}
```

### 2. Smart Change Detection

#### 2.1 Change Analyzer
```javascript
// src/analyzers/change-analyzer.js
class ChangeAnalyzer {
  async analyzeChanges(projectPath, manifest) {
    const changes = {
      newFiles: [],
      modifiedFiles: [],
      deletedFiles: [],
      impactedFiles: []
    };
    
    // Get git diff
    const gitChanges = await this.getGitChanges(
      projectPath, 
      manifest.lastCommit
    );
    
    for (const change of gitChanges) {
      const analysis = await this.analyzeFileChange(change);
      
      switch (analysis.type) {
        case 'new':
          changes.newFiles.push(analysis);
          break;
        case 'modified':
          changes.modifiedFiles.push(analysis);
          // Analyze impact
          const impacted = await this.findImpactedFiles(analysis);
          changes.impactedFiles.push(...impacted);
          break;
        case 'deleted':
          changes.deletedFiles.push(analysis);
          break;
      }
    }
    
    return this.prioritizeChanges(changes);
  }
  
  async analyzeFileChange(change) {
    const ast = await this.parseFile(change.path);
    const oldAst = await this.parseFile(change.path, change.oldContent);
    
    return {
      path: change.path,
      type: change.type,
      changes: this.diffAst(oldAst, ast),
      complexity: this.calculateComplexity(ast),
      testingPriority: this.calculatePriority(change)
    };
  }
  
  async findImpactedFiles(fileAnalysis) {
    // Find files that import/depend on changed file
    const dependents = await this.findDependents(fileAnalysis.path);
    
    return dependents.map(dep => ({
      path: dep,
      reason: `Depends on ${fileAnalysis.path}`,
      changes: fileAnalysis.changes.filter(c => c.exported)
    }));
  }
}
```

#### 2.2 AST-Level Change Detection
```javascript
// src/analyzers/ast-diff-analyzer.js
class ASTDiffAnalyzer {
  async analyzeFunctionChanges(oldContent, newContent) {
    const oldAST = this.parse(oldContent);
    const newAST = this.parse(newContent);
    
    const changes = [];
    
    // Find new functions
    const newFunctions = this.findNewFunctions(oldAST, newAST);
    changes.push(...newFunctions.map(f => ({
      type: 'new_function',
      name: f.name,
      complexity: this.calculateComplexity(f),
      needsTests: true
    })));
    
    // Find modified functions
    const modifiedFunctions = this.findModifiedFunctions(oldAST, newAST);
    changes.push(...modifiedFunctions.map(f => ({
      type: 'modified_function',
      name: f.name,
      changes: f.changes,
      severity: this.calculateChangeSeverity(f.changes),
      needsTests: f.changes.some(c => c.type === 'logic_change')
    })));
    
    // Find deleted functions
    const deletedFunctions = this.findDeletedFunctions(oldAST, newAST);
    changes.push(...deletedFunctions.map(f => ({
      type: 'deleted_function',
      name: f.name,
      testsToRemove: true
    })));
    
    return changes;
  }
  
  calculateChangeSeverity(changes) {
    // Score based on what changed
    let severity = 0;
    
    changes.forEach(change => {
      switch (change.type) {
        case 'logic_change':
          severity += 10;
          break;
        case 'parameter_change':
          severity += 8;
          break;
        case 'return_type_change':
          severity += 7;
          break;
        case 'formatting_only':
          severity += 1;
          break;
      }
    });
    
    return severity;
  }
}
```

### 3. Incremental Test Generation

#### 3.1 Complementary Test Generator
```javascript
// src/generators/incremental-test-generator.js
class IncrementalTestGenerator {
  async generateComplementaryTests(changes, manifest) {
    const testPlan = {
      structural: [],
      logical: [],
      regression: [],
      removed: []
    };
    
    // New files - full test generation
    for (const file of changes.newFiles) {
      testPlan.structural.push({
        file: file.path,
        action: 'generate_full',
        reason: 'new_file'
      });
      
      if (file.complexity > 5) {
        testPlan.logical.push({
          file: file.path,
          action: 'ai_generate',
          focus: 'complete_coverage'
        });
      }
    }
    
    // Modified files - targeted generation
    for (const file of changes.modifiedFiles) {
      const existingTests = manifest.files[file.path]?.tests;
      
      for (const change of file.changes) {
        if (change.type === 'new_function') {
          testPlan.structural.push({
            file: file.path,
            action: 'append_tests',
            target: change.name,
            existingTestFile: existingTests?.structural
          });
        } else if (change.type === 'modified_function' && change.severity > 5) {
          testPlan.logical.push({
            file: file.path,
            action: 'ai_regenerate',
            target: change.name,
            context: change.changes,
            existingTestFile: existingTests?.logical
          });
        }
      }
    }
    
    // Impacted files - regression tests
    for (const file of changes.impactedFiles) {
      testPlan.regression.push({
        file: file.path,
        action: 'verify_integration',
        reason: file.reason,
        focusAreas: file.changes
      });
    }
    
    // Deleted files - cleanup
    for (const file of changes.deletedFiles) {
      if (manifest.files[file.path]) {
        testPlan.removed.push({
          testFiles: manifest.files[file.path].tests,
          action: 'remove'
        });
      }
    }
    
    return testPlan;
  }
}
```

#### 3.2 AI Context Builder for Incremental Changes
```javascript
// src/ai/incremental-prompt-builder.js
class IncrementalPromptBuilder {
  buildIncrementalPrompt(change, existingTests, manifest) {
    if (change.action === 'ai_regenerate') {
      return this.buildRegenerationPrompt(change, existingTests);
    } else if (change.action === 'ai_generate') {
      return this.buildComplementaryPrompt(change, manifest);
    }
  }
  
  buildRegenerationPrompt(change, existingTests) {
    return `A function has been modified and needs updated tests.

ORIGINAL FUNCTION:
${change.oldImplementation}

MODIFIED FUNCTION:
${change.newImplementation}

CHANGES DETECTED:
${change.changes.map(c => `- ${c.description}`).join('\n')}

EXISTING TESTS:
${existingTests}

INSTRUCTIONS:
1. Analyze what changed in the function
2. Identify which existing tests are now invalid
3. Generate updated tests that reflect the new behavior
4. Add new tests for any new functionality
5. Ensure edge cases are still covered
6. Output ONLY the updated test code

Generate updated logical tests:`;
  }
}
```

### 4. Workflow Integration

#### 4.1 CLI Commands
```json
{
  "scripts": {
    "test:init": "node src/cli init-baseline",
    "test:incremental": "node src/cli test --incremental",
    "test:changes": "node src/cli show-changes",
    "test:sync": "node src/cli sync-baseline"
  }
}
```

#### 4.2 Incremental Testing Workflow
```javascript
// src/workflows/incremental-testing-workflow.js
class IncrementalTestingWorkflow {
  async execute(projectPath, options = {}) {
    // Step 1: Load or initialize manifest
    const manifest = await this.loadOrInitManifest(projectPath);
    
    // Step 2: Detect changes
    console.log('🔍 Detecting changes since last run...');
    const changes = await this.changeAnalyzer.analyzeChanges(
      projectPath, 
      manifest
    );
    
    if (changes.totalChanges === 0) {
      console.log('✅ No changes detected since last test generation');
      return;
    }
    
    console.log(`📊 Found changes:
    - New files: ${changes.newFiles.length}
    - Modified files: ${changes.modifiedFiles.length}
    - Impacted files: ${changes.impactedFiles.length}
    - Deleted files: ${changes.deletedFiles.length}`);
    
    // Step 3: Generate test plan
    const testPlan = await this.testGenerator.generateComplementaryTests(
      changes, 
      manifest
    );
    
    // Step 4: Estimate cost
    const estimate = await this.estimateCost(testPlan);
    console.log(`💰 Estimated cost: $${estimate.cost.toFixed(2)}`);
    
    if (options.interactive && estimate.cost > 0.50) {
      const confirm = await this.prompt('Proceed with test generation?');
      if (!confirm) return;
    }
    
    // Step 5: Execute test generation
    const results = await this.executeTestPlan(testPlan);
    
    // Step 6: Update manifest
    await this.updateManifest(manifest, changes, results);
    
    // Step 7: Create new baseline
    if (options.createBaseline) {
      await this.createNewBaseline(projectPath, manifest);
    }
    
    return results;
  }
}
```

### 5. Visual Change Report

#### 5.1 Change Summary Display
```
🔍 Incremental Test Analysis
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📅 Last Run: 2024-01-08 (2 days ago)
📊 Changes Since: commit abc123d

📁 File Changes:
├── 🆕 New Files (3)
│   ├── src/components/PaymentForm.jsx [High Priority]
│   ├── src/utils/validators.js [Medium Priority]
│   └── src/hooks/useAuth.js [Medium Priority]
│
├── 📝 Modified Files (5)
│   ├── src/services/PricingEngine.js
│   │   ├── calculateDiscount() - Logic changed
│   │   └── applyTax() - New parameter added
│   ├── src/components/Button.jsx
│   │   └── Minor style changes only [Skip]
│   └── ...
│
├── 🔗 Impacted Files (8)
│   ├── src/pages/Checkout.jsx
│   │   └── Uses PricingEngine.calculateDiscount()
│   └── ...
│
└── 🗑️ Deleted Files (1)
    └── src/utils/legacy.js

💡 Test Generation Plan:
- Structural tests: 8 files
- AI logical tests: 3 files (high complexity)
- Regression tests: 8 files
- Tests to remove: 1 file

💰 Estimated Cost: $0.32 (vs $2.45 for full regeneration)
⏱️ Estimated Time: 45 seconds

Proceed? (Y/n)
```

### 6. Advanced Features

#### 6.1 Dependency Graph Analysis
```javascript
// src/analyzers/dependency-analyzer.js
class DependencyAnalyzer {
  async buildDependencyGraph(projectPath) {
    const graph = new Map();
    
    // Analyze all imports/exports
    const files = await this.getAllSourceFiles(projectPath);
    
    for (const file of files) {
      const dependencies = await this.extractDependencies(file);
      graph.set(file, dependencies);
    }
    
    return graph;
  }
  
  async findCascadingChanges(changedFile, dependencyGraph) {
    const impacted = new Set();
    const queue = [changedFile];
    
    while (queue.length > 0) {
      const current = queue.shift();
      
      // Find all files that depend on current
      for (const [file, deps] of dependencyGraph) {
        if (deps.includes(current) && !impacted.has(file)) {
          impacted.add(file);
          queue.push(file);
        }
      }
    }
    
    return Array.from(impacted);
  }
}
```

#### 6.2 Test History Tracking
```javascript
// src/state/test-history.js
class TestHistory {
  async recordRun(manifest, results) {
    const historyEntry = {
      timestamp: new Date().toISOString(),
      commit: await this.getCurrentCommit(),
      changes: results.changes,
      testsGenerated: results.generated,
      coverage: results.coverage,
      cost: results.cost,
      duration: results.duration
    };
    
    // Append to history
    const historyPath = '.claude-testing/history/history.jsonl';
    await this.appendJsonLine(historyPath, historyEntry);
    
    // Generate trend report
    return this.generateTrendReport();
  }
  
  async generateTrendReport() {
    const history = await this.loadHistory();
    
    return {
      coverageTrend: this.calculateTrend(history, 'coverage'),
      costTrend: this.calculateTrend(history, 'cost'),
      efficiencyScore: this.calculateEfficiency(history)
    };
  }
}
```

## 🎯 Benefits

1. **Cost Efficient**: Only regenerates what changed
2. **Fast**: Incremental updates in seconds vs minutes
3. **Deterministic**: Git-based change detection
4. **Traceable**: Complete history of test evolution
5. **Smart**: Understands code dependencies

## 📊 Example Scenario

```bash
# Monday: Initial test generation
npm run test:init
# Generated 500 tests, cost $2.45

# Wednesday: After feature development
npm run test:incremental
# Detected 15 file changes
# Generated 45 new tests, updated 23 tests
# Cost: $0.32

# Friday: After bug fixes
npm run test:incremental
# Detected 3 file changes
# Updated 8 tests
# Cost: $0.08
```

## 🔮 Future Enhancements

1. **PR Integration**: Auto-generate tests for pull requests
2. **Test Decay Detection**: Identify stale tests over time
3. **Coverage Regression Alerts**: Warn when changes reduce coverage
4. **Parallel Baseline Branches**: Multiple baselines for different features