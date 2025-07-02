# Language-Specific Test Generators - Architecture Design

*Phase 2: Architecture Design for Language-Specific Test Generation*

*Created: 2025-07-02 | Status: In Progress | Part of Language-Specific Test Generators Investigation*

## Overview

This document presents the architectural design for implementing language-specific test generators based on the patterns and requirements identified in Phase 1. The design maintains backward compatibility while enabling language-specific optimizations.

## Design Principles

1. **Separation of Concerns**: Language-specific logic separated from common functionality
2. **Open/Closed Principle**: Easy to add new languages without modifying existing code  
3. **Single Responsibility**: Each component has one clear purpose
4. **Dependency Inversion**: Depend on abstractions, not concrete implementations
5. **Progressive Enhancement**: Start with basic tests, enhance with language features

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    TestGeneratorFactory                      │
│  - Creates appropriate generator based on language/config    │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│              BaseTestGenerator (Abstract)                    │
│  - Common file discovery                                     │
│  - Progress reporting                                        │
│  - Error handling                                           │
│  - Test file path generation                               │
└──────────┬──────────────────────────────────┬───────────────┘
           │                                  │
           ▼                                  ▼
┌──────────────────────────┐      ┌──────────────────────────┐
│  JavaScriptTestGenerator │      │   PythonTestGenerator    │
│  - AST parsing (Babel)   │      │  - AST parsing (ast)     │
│  - Module detection      │      │  - Import analysis       │
│  - Framework detection   │      │  - Fixture detection     │
│  - Template selection    │      │  - Decorator analysis   │
└──────────┬───────────────┘      └──────────┬───────────────┘
           │                                  │
           ▼                                  ▼
┌──────────────────────────┐      ┌──────────────────────────┐
│   Language Analyzers     │      │   Language Analyzers     │
├──────────────────────────┤      ├──────────────────────────┤
│ - ModuleSystemAnalyzer   │      │ - ImportAnalyzer         │
│ - FrameworkDetector      │      │ - FixtureDetector        │
│ - AsyncPatternDetector   │      │ - DecoratorAnalyzer      │
│ - TypeAnalyzer (TS)      │      │ - TypeHintExtractor      │
└──────────────────────────┘      └──────────────────────────┘
```

## Core Components

### 1. TestGeneratorFactory

```typescript
interface GeneratorConfig {
  language: 'javascript' | 'typescript' | 'python';
  framework?: string;
  projectPath: string;
  outputPath: string;
  options?: LanguageSpecificOptions;
}

class TestGeneratorFactory {
  private static generators = new Map<string, typeof BaseTestGenerator>();
  
  static {
    // Register default generators
    this.registerGenerator('javascript', JavaScriptTestGenerator);
    this.registerGenerator('typescript', JavaScriptTestGenerator); // Same generator
    this.registerGenerator('python', PythonTestGenerator);
  }
  
  static registerGenerator(language: string, generatorClass: typeof BaseTestGenerator): void {
    this.generators.set(language, generatorClass);
  }
  
  static createGenerator(
    config: GeneratorConfig,
    analysis: ProjectAnalysis,
    fileDiscovery?: FileDiscoveryService
  ): BaseTestGenerator {
    const GeneratorClass = this.generators.get(config.language);
    if (!GeneratorClass) {
      throw new Error(`No generator registered for language: ${config.language}`);
    }
    
    return new GeneratorClass(config, analysis, fileDiscovery);
  }
}
```

### 2. BaseTestGenerator (Abstract)

```typescript
abstract class BaseTestGenerator {
  protected config: TestGeneratorConfig;
  protected analysis: ProjectAnalysis;
  protected fileDiscovery?: FileDiscoveryService;
  protected progressReporter?: ProgressReporter;
  
  constructor(
    config: TestGeneratorConfig,
    analysis: ProjectAnalysis,
    fileDiscovery?: FileDiscoveryService
  ) {
    this.config = config;
    this.analysis = analysis;
    this.fileDiscovery = fileDiscovery;
  }
  
  // Common functionality
  async generateAllTests(): Promise<TestGenerationResult> {
    const filesToTest = await this.getFilesToTest();
    const results: GeneratedTest[] = [];
    
    for (const file of filesToTest) {
      try {
        const context = await this.analyzeSourceFile(file);
        const test = await this.generateTestForContext(context);
        if (test) {
          results.push(test);
        }
      } catch (error) {
        this.handleError(error, file);
      }
    }
    
    return this.createResult(results);
  }
  
  // Abstract methods for language-specific implementation
  abstract analyzeSourceFile(filePath: string): Promise<LanguageContext>;
  abstract generateTestForContext(context: LanguageContext): Promise<GeneratedTest | null>;
  abstract selectTemplate(context: LanguageContext): Template;
  
  // Optional hooks for customization
  protected async preGenerate(): Promise<void> {}
  protected async postGenerate(results: GeneratedTest[]): Promise<void> {}
  
  // Common utilities
  protected async getFilesToTest(): Promise<string[]> {
    // Use existing file discovery logic
  }
  
  protected getTestFilePath(sourceFile: string): string {
    // Common test file path generation
  }
}
```

### 3. Language Context Interfaces

```typescript
// Base context interface
interface LanguageContext {
  filePath: string;
  fileName: string;
  language: 'javascript' | 'typescript' | 'python';
  imports: ImportInfo[];
  exports: ExportInfo[];
  testFramework: string;
}

// JavaScript/TypeScript specific context
interface JavaScriptContext extends LanguageContext {
  language: 'javascript' | 'typescript';
  moduleSystem: 'commonjs' | 'esm' | 'mixed';
  framework?: 'react' | 'vue' | 'angular' | 'express' | 'nest' | 'none';
  asyncPatterns: Array<'promise' | 'callback' | 'observable'>;
  typeDefinitions?: TypeScriptTypeInfo[];
  jsxElements?: JSXElementInfo[];
  decorators?: DecoratorInfo[];
}

// Python specific context
interface PythonContext extends LanguageContext {
  language: 'python';
  testingFramework: 'pytest' | 'unittest' | 'nose2';
  framework?: 'django' | 'fastapi' | 'flask' | 'none';
  asyncFunctions: string[];
  classes: ClassInfo[];
  functions: FunctionInfo[];
  decorators: DecoratorInfo[];
  fixtures?: FixtureInfo[];
  typeHints?: TypeHintInfo[];
}

// Supporting types
interface ImportInfo {
  source: string;
  specifiers: string[];
  isDefault: boolean;
  isNamespace: boolean;
}

interface ExportInfo {
  name: string;
  type: 'function' | 'class' | 'variable' | 'type' | 'interface';
  isDefault: boolean;
  isAsync: boolean;
}
```

### 4. JavaScriptTestGenerator

```typescript
class JavaScriptTestGenerator extends BaseTestGenerator {
  private moduleAnalyzer: ModuleSystemAnalyzer;
  private frameworkDetector: JSFrameworkDetector;
  private asyncDetector: AsyncPatternDetector;
  private templateEngine: TestTemplateEngine;
  
  constructor(
    config: TestGeneratorConfig,
    analysis: ProjectAnalysis,
    fileDiscovery?: FileDiscoveryService
  ) {
    super(config, analysis, fileDiscovery);
    this.moduleAnalyzer = new ModuleSystemAnalyzer();
    this.frameworkDetector = new JSFrameworkDetector(analysis);
    this.asyncDetector = new AsyncPatternDetector();
    this.templateEngine = new TestTemplateEngine();
  }
  
  async analyzeSourceFile(filePath: string): Promise<JavaScriptContext> {
    const content = await fs.readFile(filePath, 'utf-8');
    const ast = parseJavaScript(content, { 
      sourceType: 'unambiguous',
      plugins: this.getBabelPlugins(filePath)
    });
    
    const context: JavaScriptContext = {
      filePath,
      fileName: path.basename(filePath),
      language: filePath.endsWith('.ts') || filePath.endsWith('.tsx') ? 'typescript' : 'javascript',
      moduleSystem: this.moduleAnalyzer.detectModuleSystem(ast),
      framework: await this.frameworkDetector.detectFramework(filePath, ast),
      imports: this.extractImports(ast),
      exports: this.extractExports(ast),
      asyncPatterns: this.asyncDetector.detectPatterns(ast),
      testFramework: this.getTestFramework(),
    };
    
    if (context.language === 'typescript') {
      context.typeDefinitions = await this.extractTypeInfo(filePath);
    }
    
    if (context.framework === 'react' || context.framework === 'vue') {
      context.jsxElements = this.extractJSXElements(ast);
    }
    
    return context;
  }
  
  async generateTestForContext(context: JavaScriptContext): Promise<GeneratedTest> {
    const template = this.selectTemplate(context);
    const testContent = template.generate(context);
    const testPath = this.getTestFilePath(context.filePath);
    
    // Generate additional files if needed
    const additionalFiles: GeneratedFile[] = [];
    
    if (this.config.options?.generateMocks) {
      additionalFiles.push(...this.generateMocks(context));
    }
    
    if (context.framework === 'react' && this.config.options?.generateTestUtils) {
      additionalFiles.push(this.generateReactTestUtils(context));
    }
    
    return {
      sourcePath: context.filePath,
      testPath,
      testType: this.determineTestType(context),
      framework: context.testFramework,
      content: testContent,
      additionalFiles
    };
  }
  
  selectTemplate(context: JavaScriptContext): Template {
    // Prioritized template selection
    const templateKey = this.buildTemplateKey(context);
    return this.templateEngine.getTemplate(templateKey) || 
           this.templateEngine.getDefaultTemplate(context.language);
  }
  
  private buildTemplateKey(context: JavaScriptContext): string {
    const parts = [context.language, context.testFramework];
    
    if (context.framework) {
      parts.push(context.framework);
    }
    
    if (context.asyncPatterns.length > 0) {
      parts.push('async');
    }
    
    return parts.join(':');
  }
}
```

### 5. PythonTestGenerator

```typescript
class PythonTestGenerator extends BaseTestGenerator {
  private importAnalyzer: PythonImportAnalyzer;
  private fixtureDetector: FixtureDetector;
  private decoratorAnalyzer: DecoratorAnalyzer;
  private templateEngine: TestTemplateEngine;
  
  async analyzeSourceFile(filePath: string): Promise<PythonContext> {
    const content = await fs.readFile(filePath, 'utf-8');
    const ast = parsePython(content); // Using a Python AST parser
    
    const context: PythonContext = {
      filePath,
      fileName: path.basename(filePath),
      language: 'python',
      testingFramework: this.detectTestingFramework(),
      framework: await this.detectPythonFramework(filePath, ast),
      imports: this.importAnalyzer.analyze(ast),
      exports: this.extractPythonExports(ast),
      asyncFunctions: this.findAsyncFunctions(ast),
      classes: this.extractClasses(ast),
      functions: this.extractFunctions(ast),
      decorators: this.decoratorAnalyzer.analyze(ast),
      testFramework: this.config.testFramework || 'pytest',
    };
    
    if (context.testingFramework === 'pytest') {
      context.fixtures = await this.fixtureDetector.detect(filePath, ast);
    }
    
    return context;
  }
  
  async generateTestForContext(context: PythonContext): Promise<GeneratedTest> {
    const template = this.selectTemplate(context);
    const testContent = template.generate(context);
    const testPath = this.getTestFilePath(context.filePath);
    
    const additionalFiles: GeneratedFile[] = [];
    
    // Generate conftest.py if needed
    if (context.fixtures && context.fixtures.length > 0) {
      additionalFiles.push(this.generateConftest(context));
    }
    
    // Generate fixtures file
    if (this.config.options?.generateFixtures) {
      additionalFiles.push(this.generateFixturesFile(context));
    }
    
    return {
      sourcePath: context.filePath,
      testPath,
      testType: this.determineTestType(context),
      framework: context.testingFramework,
      content: testContent,
      additionalFiles
    };
  }
  
  selectTemplate(context: PythonContext): Template {
    // Python-specific template selection
    if (context.framework === 'django' && context.classes.some(c => c.extends === 'models.Model')) {
      return this.templateEngine.getTemplate('python:pytest:django:model');
    }
    
    if (context.framework === 'fastapi' && context.decorators.some(d => d.name.includes('router'))) {
      return this.templateEngine.getTemplate('python:pytest:fastapi:router');
    }
    
    // Default to base pytest template
    return this.templateEngine.getTemplate('python:pytest') ||
           this.templateEngine.getDefaultTemplate('python');
  }
}
```

### 6. Language Analyzers

#### JavaScript Analyzers

```typescript
class ModuleSystemAnalyzer {
  detectModuleSystem(ast: any): 'commonjs' | 'esm' | 'mixed' {
    let hasImport = false;
    let hasRequire = false;
    let hasExport = false;
    let hasModuleExports = false;
    
    traverse(ast, {
      ImportDeclaration() { hasImport = true; },
      ExportDeclaration() { hasExport = true; },
      CallExpression(path) {
        if (path.node.callee.name === 'require') {
          hasRequire = true;
        }
      },
      MemberExpression(path) {
        if (path.node.object.name === 'module' && 
            path.node.property.name === 'exports') {
          hasModuleExports = true;
        }
      }
    });
    
    if ((hasImport || hasExport) && (hasRequire || hasModuleExports)) {
      return 'mixed';
    }
    if (hasImport || hasExport) {
      return 'esm';
    }
    return 'commonjs';
  }
}

class JSFrameworkDetector {
  constructor(private analysis: ProjectAnalysis) {}
  
  async detectFramework(filePath: string, ast: any): Promise<string | undefined> {
    // Check imports for framework indicators
    const imports = this.extractImports(ast);
    
    if (imports.some(imp => imp.source.includes('react'))) {
      return 'react';
    }
    if (imports.some(imp => imp.source.includes('vue'))) {
      return 'vue';
    }
    if (imports.some(imp => imp.source.includes('@angular'))) {
      return 'angular';
    }
    if (imports.some(imp => imp.source === 'express')) {
      return 'express';
    }
    if (imports.some(imp => imp.source.includes('@nestjs'))) {
      return 'nest';
    }
    
    return undefined;
  }
}

class AsyncPatternDetector {
  detectPatterns(ast: any): Array<'promise' | 'callback' | 'observable'> {
    const patterns = new Set<'promise' | 'callback' | 'observable'>();
    
    traverse(ast, {
      // Detect async/await and promises
      AsyncFunction() { patterns.add('promise'); },
      AwaitExpression() { patterns.add('promise'); },
      NewExpression(path) {
        if (path.node.callee.name === 'Promise') {
          patterns.add('promise');
        }
      },
      
      // Detect callbacks (heuristic)
      CallExpression(path) {
        const args = path.node.arguments;
        if (args.some(arg => arg.type === 'FunctionExpression' || 
                            arg.type === 'ArrowFunctionExpression')) {
          // Check if function parameter names include 'callback', 'cb', 'done'
          patterns.add('callback');
        }
      },
      
      // Detect observables
      MemberExpression(path) {
        if (path.node.property.name === 'subscribe' ||
            path.node.property.name === 'pipe') {
          patterns.add('observable');
        }
      }
    });
    
    return Array.from(patterns);
  }
}
```

#### Python Analyzers

```typescript
class PythonImportAnalyzer {
  analyze(ast: any): ImportInfo[] {
    const imports: ImportInfo[] = [];
    
    // Parse import statements
    ast.body.forEach((node: any) => {
      if (node.type === 'Import') {
        node.names.forEach((alias: any) => {
          imports.push({
            source: alias.name,
            specifiers: [alias.asname || alias.name],
            isDefault: false,
            isNamespace: true
          });
        });
      } else if (node.type === 'ImportFrom') {
        imports.push({
          source: node.module,
          specifiers: node.names.map((n: any) => n.asname || n.name),
          isDefault: false,
          isNamespace: false
        });
      }
    });
    
    return imports;
  }
}

class FixtureDetector {
  async detect(filePath: string, ast: any): Promise<FixtureInfo[]> {
    const fixtures: FixtureInfo[] = [];
    
    // Look for pytest fixtures
    ast.body.forEach((node: any) => {
      if (node.type === 'FunctionDef' && node.decorator_list) {
        const fixtureDecorator = node.decorator_list.find(
          (d: any) => d.func?.id === 'fixture' || 
                      d.func?.attr === 'fixture'
        );
        
        if (fixtureDecorator) {
          fixtures.push({
            name: node.name,
            scope: this.extractFixtureScope(fixtureDecorator),
            params: node.args.args.map((a: any) => a.arg),
            yields: this.hasYield(node)
          });
        }
      }
    });
    
    return fixtures;
  }
  
  private extractFixtureScope(decorator: any): string {
    // Extract scope from @pytest.fixture(scope="module")
    const scopeKeyword = decorator.keywords?.find(
      (k: any) => k.arg === 'scope'
    );
    return scopeKeyword?.value?.s || 'function';
  }
  
  private hasYield(functionNode: any): boolean {
    // Check if fixture uses yield
    return functionNode.body.some(
      (stmt: any) => stmt.type === 'Expr' && 
                     stmt.value.type === 'Yield'
    );
  }
}

class DecoratorAnalyzer {
  analyze(ast: any): DecoratorInfo[] {
    const decorators: DecoratorInfo[] = [];
    
    const analyzeDecorators = (decoratorList: any[], target: string) => {
      decoratorList.forEach((dec: any) => {
        decorators.push({
          name: this.getDecoratorName(dec),
          target,
          arguments: this.getDecoratorArgs(dec)
        });
      });
    };
    
    ast.body.forEach((node: any) => {
      if (node.decorator_list) {
        const target = node.name;
        analyzeDecorators(node.decorator_list, target);
      }
    });
    
    return decorators;
  }
  
  private getDecoratorName(decorator: any): string {
    if (decorator.id) return decorator.id;
    if (decorator.func?.id) return decorator.func.id;
    if (decorator.func?.attr) {
      return `${decorator.func.value.id}.${decorator.func.attr}`;
    }
    return 'unknown';
  }
  
  private getDecoratorArgs(decorator: any): any[] {
    if (!decorator.args) return [];
    return decorator.args.map((arg: any) => this.parseArg(arg));
  }
}
```

## Template System Enhancement

### Enhanced Template Selection

```typescript
class EnhancedTemplateEngine extends TestTemplateEngine {
  private templateRegistry = new Map<string, Template>();
  
  constructor() {
    super();
    this.registerLanguageTemplates();
  }
  
  private registerLanguageTemplates() {
    // JavaScript templates
    this.register(new JavaScriptBasicTemplate());
    this.register(new JavaScriptAsyncTemplate());
    this.register(new TypeScriptTemplate());
    this.register(new ReactComponentTemplate());
    this.register(new ReactHooksTemplate());
    this.register(new VueComponentTemplate());
    this.register(new AngularComponentTemplate());
    this.register(new ExpressRouteTemplate());
    this.register(new NestControllerTemplate());
    
    // Python templates
    this.register(new PytestBasicTemplate());
    this.register(new PytestAsyncTemplate());
    this.register(new PytestFixtureTemplate());
    this.register(new PytestParametrizedTemplate());
    this.register(new DjangoModelTemplate());
    this.register(new DjangoViewTemplate());
    this.register(new FastAPIRouteTemplate());
    this.register(new FlaskViewTemplate());
  }
  
  getTemplate(key: string): Template | undefined {
    return this.templateRegistry.get(key);
  }
  
  selectBestTemplate(context: LanguageContext): Template {
    // Build a list of candidate keys from most specific to least
    const candidateKeys = this.buildCandidateKeys(context);
    
    for (const key of candidateKeys) {
      const template = this.templateRegistry.get(key);
      if (template && template.canHandle(context)) {
        return template;
      }
    }
    
    // Fallback to basic template
    return this.getDefaultTemplate(context.language);
  }
  
  private buildCandidateKeys(context: LanguageContext): string[] {
    const keys: string[] = [];
    
    if (context.language === 'javascript' || context.language === 'typescript') {
      const jsContext = context as JavaScriptContext;
      
      // Most specific: language:framework:testFramework:feature
      if (jsContext.framework && jsContext.asyncPatterns.length > 0) {
        keys.push(`${jsContext.language}:${jsContext.framework}:${jsContext.testFramework}:async`);
      }
      
      // Framework specific
      if (jsContext.framework) {
        keys.push(`${jsContext.language}:${jsContext.framework}:${jsContext.testFramework}`);
        keys.push(`${jsContext.language}:${jsContext.framework}`);
      }
      
      // Language with features
      if (jsContext.asyncPatterns.length > 0) {
        keys.push(`${jsContext.language}:async`);
      }
      
      // Basic language
      keys.push(jsContext.language);
    } else if (context.language === 'python') {
      const pyContext = context as PythonContext;
      
      // Framework specific with features
      if (pyContext.framework && pyContext.asyncFunctions.length > 0) {
        keys.push(`python:${pyContext.framework}:${pyContext.testingFramework}:async`);
      }
      
      // Framework specific
      if (pyContext.framework) {
        keys.push(`python:${pyContext.framework}:${pyContext.testingFramework}`);
        keys.push(`python:${pyContext.framework}`);
      }
      
      // Testing framework with features
      if (pyContext.fixtures && pyContext.fixtures.length > 0) {
        keys.push(`python:${pyContext.testingFramework}:fixtures`);
      }
      
      // Basic testing framework
      keys.push(`python:${pyContext.testingFramework}`);
      keys.push('python');
    }
    
    return keys;
  }
}
```

## Migration Strategy

### Phase 1: Parallel Implementation
1. Implement new generators alongside existing StructuralTestGenerator
2. Add feature flag to enable language-specific generation
3. Compare outputs between old and new generators
4. Collect metrics on improvement

### Phase 2: Gradual Rollout
1. Enable for new projects by default
2. Provide migration tool for existing projects
3. Update documentation and examples
4. Gather user feedback

### Phase 3: Deprecation
1. Mark StructuralTestGenerator as deprecated
2. Provide migration guide
3. Remove in next major version

### Backward Compatibility

```typescript
// Adapter to maintain compatibility
class StructuralTestGeneratorAdapter extends StructuralTestGenerator {
  private newGenerator: BaseTestGenerator;
  
  constructor(
    config: TestGeneratorConfig,
    analysis: ProjectAnalysis,
    options: StructuralTestGeneratorOptions = {},
    fileDiscovery?: FileDiscoveryService
  ) {
    super(config, analysis, options, fileDiscovery);
    
    // Create appropriate new generator
    const language = this.detectPrimaryLanguage(analysis);
    this.newGenerator = TestGeneratorFactory.createGenerator(
      { ...config, language },
      analysis,
      fileDiscovery
    );
  }
  
  async generateStructuralTestForFile(filePath: string): Promise<GeneratedTest | null> {
    // Delegate to new generator
    return this.newGenerator.generateTestForFile(filePath);
  }
}
```

## Configuration Schema

```json
{
  "testGeneration": {
    "engine": "language-specific", // or "legacy"
    "languages": {
      "javascript": {
        "parser": "babel",
        "plugins": ["jsx", "typescript"],
        "preferredModuleSystem": "esm",
        "templateOverrides": {
          "react:component": "./templates/custom-react.js"
        }
      },
      "python": {
        "parser": "ast",
        "preferredTestingFramework": "pytest",
        "generateFixtures": true,
        "asyncFramework": "asyncio"
      }
    },
    "templates": {
      "customTemplatesDir": "./test-templates",
      "preferSpecificTemplates": true
    }
  }
}
```

## Performance Considerations

1. **AST Parsing Caching**: Cache parsed ASTs for reuse
2. **Template Compilation**: Pre-compile templates at startup
3. **Parallel Processing**: Process files in parallel when possible
4. **Incremental Analysis**: Only re-analyze changed files

## Extension Points

1. **Custom Language Support**: Register new generators via factory
2. **Custom Templates**: Register project-specific templates
3. **Analysis Plugins**: Add custom analyzers for specific patterns
4. **Output Formatters**: Customize generated test format

## Conclusion

This architecture provides:
1. **Clear separation** between common and language-specific logic
2. **Extensibility** for new languages and frameworks
3. **Backward compatibility** during migration
4. **Improved test quality** through language-specific patterns
5. **Maintainability** through well-defined interfaces

The design allows for incremental implementation while maintaining the existing functionality, ensuring a smooth transition to language-specific test generation.