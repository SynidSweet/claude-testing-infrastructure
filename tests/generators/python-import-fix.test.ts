import { TestTemplateEngine } from '../../src/generators/templates/TestTemplateEngine';
import { TestType } from '../../src/generators/TestGenerator';

describe('Python import syntax fix', () => {
  let engine: TestTemplateEngine;

  beforeEach(() => {
    engine = new TestTemplateEngine();
  });

  it('should filter out empty strings from exports', () => {
    // This test verifies the fix for the user-reported issue:
    // "Backend tests have import syntax errors (e.g., `from main import` with nothing after)"
    const context = {
      moduleName: 'main',
      modulePath: 'main',
      imports: [],
      exports: ['', ' ', 'valid_func', ''],  // Mix of empty and valid exports
      hasDefaultExport: false,
      testType: TestType.UNIT,
      framework: 'pytest',
      language: 'python' as const,
      isAsync: false,
      isComponent: false,
      dependencies: []
    };

    const result = engine.generateTest(context);
    
    // Should generate "from main import valid_func" only
    expect(result).toContain('from main import valid_func');
    expect(result).not.toMatch(/from\s+main\s+import\s*$/m);
    expect(result).not.toMatch(/from\s+main\s+import\s+,/);
    expect(result).not.toMatch(/from\s+main\s+import\s+valid_func,\s*$/);
  });

  it('should use import statement when all exports are empty', () => {
    const context = {
      moduleName: 'empty',
      modulePath: 'empty',
      imports: [],
      exports: ['', ' ', '  '],  // All empty
      hasDefaultExport: false,
      testType: TestType.UNIT,
      framework: 'pytest',
      language: 'python' as const,
      isAsync: false,
      isComponent: false,
      dependencies: []
    };

    const result = engine.generateTest(context);
    
    // Should generate "import empty" not "from empty import"
    expect(result).toContain('import empty');
    expect(result).not.toContain('from empty import');
  });
});