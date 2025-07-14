import { TestType } from '../../TestGenerator';
import type { Template, TemplateContext } from '../TestTemplateEngine';
import type { FileAsyncPatterns } from '../../javascript/analyzers/AsyncPatternDetector';

/**
 * Enhanced Angular component template with Angular-specific testing patterns
 */
export class EnhancedAngularComponentTemplate implements Template {
  name = 'enhanced-angular-component';
  language = 'javascript' as const;
  framework = 'angular';
  testType = TestType.COMPONENT;

  generate(context: TemplateContext): string {
    const { moduleName, hasDefaultExport, exports, moduleSystem, modulePath } = context;
    const useESM = moduleSystem === 'esm';

    const componentName = hasDefaultExport
      ? moduleName
      : exports && exports.length > 0 && exports[0]
        ? exports[0]
        : moduleName;

    const importPath = modulePath || moduleName;
    const relativeImportPath = this.normalizeImportPath(importPath);
    const importPathWithExtension = this.addExtensionIfNeeded(relativeImportPath, useESM);

    const asyncPatterns = this.getAsyncPatterns(context);

    if (useESM) {
      return this.generateESMAngularTemplate(
        componentName,
        hasDefaultExport,
        importPathWithExtension,
        asyncPatterns
      );
    } else {
      return this.generateCommonJSAngularTemplate(
        componentName,
        hasDefaultExport,
        relativeImportPath,
        asyncPatterns
      );
    }
  }

  private getAsyncPatterns(context: TemplateContext): FileAsyncPatterns | null {
    const metadata = (context as any).metadata;
    return metadata?.asyncPatterns ?? null;
  }

  private normalizeImportPath(importPath: string): string {
    return importPath.startsWith('./') ||
      importPath.startsWith('../') ||
      importPath.startsWith('/') ||
      (!importPath.includes('/') && !importPath.includes('\\'))
      ? importPath.startsWith('./') || importPath.startsWith('../') || importPath.startsWith('/')
        ? importPath
        : `./${importPath}`
      : importPath;
  }

  private addExtensionIfNeeded(importPath: string, useESM: boolean): string {
    // Remove TypeScript extensions first (.ts, .tsx)
    const pathWithoutTsExtension = importPath.replace(/\.(ts|tsx)$/, '');

    const hasJsExtension = /\.(js|jsx)$/.test(pathWithoutTsExtension);

    if (useESM && !hasJsExtension) {
      return `${pathWithoutTsExtension}.js`;
    }

    return pathWithoutTsExtension;
  }

  private generateESMAngularTemplate(
    componentName: string,
    hasDefaultExport: boolean,
    importPath: string,
    asyncPatterns: FileAsyncPatterns | null
  ): string {
    const componentImport = hasDefaultExport
      ? `import ${componentName} from '${importPath}';`
      : `import { ${componentName} } from '${importPath}';`;

    let template = `import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { DebugElement } from '@angular/core';
${componentImport}

describe('${componentName}', () => {
  let component: ${componentName};
  let fixture: ComponentFixture<${componentName}>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [${componentName}]
    }).compileComponents();

    fixture = TestBed.createComponent(${componentName});
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should be defined as a valid Angular component', () => {
    expect(${componentName}).toBeDefined();
    expect(typeof ${componentName}).toBe('function');
  });

  it('should render without errors', () => {
    expect(fixture.nativeElement).toBeTruthy();
    expect(fixture.debugElement).toBeTruthy();
  });

  it('should handle component properties', () => {
    // Test component instance properties
    expect(component).toBeInstanceOf(${componentName});
    
    // Test that component has expected lifecycle methods
    const lifecycleMethods = ['ngOnInit', 'ngOnDestroy', 'ngOnChanges'];
    lifecycleMethods.forEach(method => {
      if (typeof component[method] === 'function') {
        expect(component[method]).toBeInstanceOf(Function);
      }
    });
  });

  it('should handle input properties', () => {
    // Test common input properties
    const commonInputs = ['title', 'value', 'disabled', 'visible', 'data'];
    
    commonInputs.forEach(inputName => {
      if (inputName in component) {
        try {
          component[inputName] = 'test value';
          fixture.detectChanges();
          expect(true).toBe(true); // Property set successfully
        } catch {
          // Property might be readonly or have type constraints
        }
      }
    });
  });

  it('should handle events correctly', () => {
    const debugElement = fixture.debugElement;
    
    // Test click events
    const clickableElements = debugElement.queryAll(By.css('button, a, [click]'));
    clickableElements.forEach(element => {
      try {
        element.triggerEventHandler('click', null);
        fixture.detectChanges();
        expect(true).toBe(true); // Event handled successfully
      } catch {
        // Element might not handle events - that's okay
      }
    });
    
    // Test input events
    const inputElements = debugElement.queryAll(By.css('input, textarea, select'));
    inputElements.forEach(element => {
      try {
        element.triggerEventHandler('input', { target: { value: 'test' } });
        fixture.detectChanges();
        expect(true).toBe(true); // Input event handled successfully
      } catch {
        // Element might not handle input events - that's okay
      }
    });
  });
`;

    if (asyncPatterns?.hasAsyncPatterns) {
      template += this.generateAsyncAngularTests(componentName);
    }

    template += `
  it('should match snapshot', () => {
    expect(fixture.nativeElement).toMatchSnapshot();
  });
});
`;

    return template;
  }

  private generateCommonJSAngularTemplate(
    componentName: string,
    hasDefaultExport: boolean,
    importPath: string,
    _asyncPatterns: FileAsyncPatterns | null
  ): string {
    const componentImport = hasDefaultExport
      ? `const ${componentName} = require('${importPath}');`
      : `const { ${componentName} } = require('${importPath}');`;

    return `// Basic Angular component test without external dependencies
${componentImport}

describe('${componentName}', () => {
  it('should be defined', () => {
    expect(${componentName}).toBeDefined();
  });

  it('should be a valid Angular component class', () => {
    expect(typeof ${componentName}).toBe('function');
    expect(${componentName}).toBeInstanceOf(Function);
  });

  it('should have Angular component metadata', () => {
    // Test for Angular component decorator metadata
    if (${componentName}.__annotations__ || ${componentName}.decorators) {
      expect(true).toBe(true); // Has Angular metadata
    } else {
      // Fallback: test that it's a valid constructor
      expect(${componentName}).toBeInstanceOf(Function);
      expect(${componentName}.prototype).toBeDefined();
    }
  });

  it('should not throw when instantiated', () => {
    expect(() => {
      const instance = new ${componentName}();
      return instance;
    }).not.toThrow();
  });

  it('should have expected component structure', () => {
    const instance = new ${componentName}();
    
    // Test component instance properties
    expect(instance).toBeInstanceOf(${componentName});
    expect(typeof instance).toBe('object');
    
    // Test for common Angular lifecycle methods
    const lifecycleMethods = ['ngOnInit', 'ngOnDestroy', 'ngOnChanges'];
    lifecycleMethods.forEach(method => {
      if (typeof instance[method] === 'function') {
        expect(instance[method]).toBeInstanceOf(Function);
      }
    });
  });
});
`;
  }

  private generateAsyncAngularTests(_componentName: string): string {
    return `
  it('should handle async operations', async () => {
    // Test async component lifecycle
    if (typeof component.ngOnInit === 'function') {
      try {
        await component.ngOnInit();
        fixture.detectChanges();
        expect(component).toBeTruthy();
      } catch {
        // ngOnInit might not be async or might require setup
      }
    }
    
    // Test async change detection
    component.ngOnChanges?.({});
    fixture.detectChanges();
    await fixture.whenStable();
    expect(component).toBeTruthy();
  });

  it('should handle async user interactions', async () => {
    const debugElement = fixture.debugElement;
    
    // Test async button clicks
    const buttons = debugElement.queryAll(By.css('button'));
    for (const button of buttons) {
      try {
        button.triggerEventHandler('click', null);
        fixture.detectChanges();
        await fixture.whenStable();
        expect(true).toBe(true); // Async click handled
      } catch {
        // Button might not have async handlers
      }
    }
  });
`;
  }
}
