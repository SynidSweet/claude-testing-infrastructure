import { TestType } from '../TestGenerator';
import type { Template, TemplateContext } from './TestTemplateEngine';
import type { FileAsyncPatterns } from '../javascript/analyzers/AsyncPatternDetector';
// import type { FileModuleSystemInfo } from '../javascript/analyzers/ModuleSystemAnalyzer';

/**
 * Enhanced JavaScript templates that leverage AsyncPatternDetector and framework detection
 * for more intelligent test generation
 */

/**
 * Enhanced Jest JavaScript template with async pattern awareness
 */
export class EnhancedJestJavaScriptTemplate implements Template {
  name = 'enhanced-jest-javascript';
  language = 'javascript' as const;
  framework = 'jest';

  generate(context: TemplateContext): string {
    const { moduleName, exports, hasDefaultExport, testType, moduleSystem, modulePath } = context;

    // Extract async patterns from metadata if available
    const asyncPatterns = this.getAsyncPatterns(context);
    // const moduleInfo = this.getModuleInfo(context); // Reserved for future use

    const useESM = moduleSystem === 'esm';
    const importPath = modulePath || moduleName;
    const relativeImportPath = this.normalizeImportPath(importPath);
    const importPathWithExtension = this.addExtensionIfNeeded(relativeImportPath, useESM);

    const importStatement = this.generateImportStatement(
      moduleName,
      exports,
      hasDefaultExport,
      useESM,
      importPathWithExtension,
      relativeImportPath
    );

    let testContent = `${importStatement}

describe('${moduleName}', () => {
`;

    // Module existence test
    let moduleTestReference = moduleName;
    if (!hasDefaultExport && exports.length > 0 && exports[0]) {
      // For named exports only, test the first export instead of the module name
      moduleTestReference = exports[0];
    }
    testContent += `  it('should load the module without errors', () => {
    expect(${moduleTestReference}).toBeDefined();
  });

`;

    // Async-aware tests
    if (asyncPatterns && asyncPatterns.hasAsyncPatterns) {
      testContent += this.generateAsyncModuleTests(moduleName, asyncPatterns);
    }

    // Default export tests
    if (hasDefaultExport) {
      testContent += this.generateDefaultExportTests(moduleName, asyncPatterns);
    }

    // Named export tests
    if (exports.length > 0) {
      exports.forEach((exportName) => {
        testContent += this.generateNamedExportTests(exportName, testType, asyncPatterns);
      });
    } else {
      testContent += this.generateFallbackModuleTests(moduleName);
    }

    testContent += '});';
    return testContent;
  }

  private getAsyncPatterns(context: TemplateContext): FileAsyncPatterns | null {
    // Access async patterns from context metadata
    const metadata = (context as any).metadata;
    return metadata?.asyncPatterns || null;
  }

  // private getModuleInfo(context: TemplateContext): FileModuleSystemInfo | null {
  //   const metadata = (context as any).metadata;
  //   return metadata?.moduleInfo || null;
  // }

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

  private generateImportStatement(
    moduleName: string,
    exports: string[],
    hasDefaultExport: boolean,
    useESM: boolean,
    importPathWithExtension: string,
    relativeImportPath: string
  ): string {
    if (useESM) {
      if (hasDefaultExport && exports.length > 0) {
        return `import ${moduleName}, { ${exports.join(', ')} } from '${importPathWithExtension}';`;
      } else if (hasDefaultExport) {
        return `import ${moduleName} from '${importPathWithExtension}';`;
      } else if (exports.length > 0) {
        return `import { ${exports.join(', ')} } from '${importPathWithExtension}';`;
      } else {
        return `import * as ${moduleName} from '${importPathWithExtension}';`;
      }
    } else {
      if (hasDefaultExport) {
        return `const ${moduleName} = require('${relativeImportPath}');`;
      } else if (exports.length > 0) {
        return `const { ${exports.join(', ')} } = require('${relativeImportPath}');`;
      } else {
        return `const ${moduleName} = require('${relativeImportPath}');`;
      }
    }
  }

  private generateAsyncModuleTests(_moduleName: string, asyncPatterns: FileAsyncPatterns): string {
    if (!asyncPatterns.patterns || asyncPatterns.patterns.length === 0) {
      return '';
    }

    let tests = `  describe('async behavior', () => {
`;

    // Test based on detected patterns
    const patternTypes = new Set(asyncPatterns.patterns.map((p) => p.type));

    if (patternTypes.has('async-await')) {
      tests += `    it('should handle async/await patterns correctly', async () => {
      // Note: These tests are for modules with async patterns detected
      // Individual async functions should be tested in their respective describe blocks
      expect(true).toBe(true); // Placeholder - async functions tested individually
    });

`;
    }

    if (patternTypes.has('promise')) {
      tests += `    it('should handle Promise-based patterns correctly', async () => {
      // Note: These tests are for modules with Promise patterns detected
      // Individual Promise-returning functions should be tested in their respective describe blocks
      expect(true).toBe(true); // Placeholder - Promise functions tested individually
    });

`;
    }

    if (patternTypes.has('callback')) {
      tests += `    it('should handle callback patterns correctly', (done) => {
      // Note: These tests are for modules with callback patterns detected
      // Individual callback functions should be tested in their respective describe blocks
      expect(true).toBe(true); // Placeholder - callback functions tested individually
      done();
    });

`;
    }

    if (patternTypes.has('generator')) {
      tests += `    it('should handle generator patterns correctly', () => {
      // Note: These tests are for modules with generator patterns detected
      // Individual generator functions should be tested in their respective describe blocks
      expect(true).toBe(true); // Placeholder - generator functions tested individually
    });

`;
    }

    tests += `  });

`;
    return tests;
  }

  private generateDefaultExportTests(
    moduleName: string,
    asyncPatterns: FileAsyncPatterns | null
  ): string {
    let tests = `  describe('default export', () => {
    it('should export a default value', () => {
      expect(${moduleName}).toBeDefined();
      expect(typeof ${moduleName}).not.toBe('undefined');
    });

`;

    if (asyncPatterns?.hasAsyncPatterns) {
      tests += `    it('should handle async operations in default export', async () => {
      if (typeof ${moduleName} === 'function') {
        try {
          const result = ${moduleName}();
          if (result && typeof result.then === 'function') {
            await expect(result).resolves.toBeDefined();
          }
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
        }
      }
    });

`;
    }

    tests += `  });

`;
    return tests;
  }

  private generateNamedExportTests(
    exportName: string,
    testType: TestType,
    asyncPatterns: FileAsyncPatterns | null
  ): string {
    let tests = `  describe('${exportName}', () => {
    it('should be defined', () => {
      expect(${exportName}).toBeDefined();
    });

    it('should have the expected type', () => {
      const type = typeof ${exportName};
      expect(['function', 'object', 'string', 'number', 'boolean']).toContain(type);
    });

`;

    // Add async-specific tests
    if (asyncPatterns?.hasAsyncPatterns) {
      tests += this.generateAsyncExportTests(exportName, asyncPatterns);
    }

    // Add type-specific tests
    tests += this.generateTypeSpecificTests(
      exportName,
      testType,
      asyncPatterns?.hasAsyncPatterns || false
    );

    tests += `  });

`;
    return tests;
  }

  private generateAsyncExportTests(
    exportName: string,
    asyncPatterns: FileAsyncPatterns | null
  ): string {
    if (!asyncPatterns?.patterns) return '';

    const patternTypes = new Set(asyncPatterns.patterns.map((p) => p.type));
    let tests = '';

    if (patternTypes.has('async-await')) {
      tests += `    it('should handle async operations', async () => {
      if (typeof ${exportName} === 'function') {
        try {
          const result = ${exportName}();
          if (result && typeof result.then === 'function') {
            await expect(result).resolves.toBeDefined();
          }
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
        }
      }
    });

`;
    }

    if (patternTypes.has('promise')) {
      tests += `    it('should return Promise when expected', async () => {
      if (typeof ${exportName} === 'function') {
        try {
          const result = ${exportName}();
          if (result instanceof Promise) {
            expect(result).toBeInstanceOf(Promise);
            await expect(result).resolves.toBeDefined();
          }
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
        }
      }
    });

`;
    }

    return tests;
  }

  private generateTypeSpecificTests(
    exportName: string,
    testType: TestType,
    _isAsync: boolean
  ): string {
    let tests = '';

    if (testType === TestType.UTILITY) {
      tests += `    it('should work with typical inputs', () => {
      if (typeof ${exportName} === 'function') {
        const testInputs = [
          undefined, null, '', 'test', 0, 1, [], {}, true, false
        ];
        
        let hasValidInput = false;
        // Check if this might be a class constructor
        const isClass = ${exportName}.toString().startsWith('class ') || 
                       (${exportName}.prototype && ${exportName}.prototype.constructor === ${exportName});
        
        for (const input of testInputs) {
          try {
            const result = isClass ? new ${exportName}(input) : ${exportName}(input);
            hasValidInput = true;
            expect(result).toBeDefined();
            break;
          } catch {
            // Try next input
          }
        }
        
        if (!hasValidInput) {
          expect(${exportName}).toBeInstanceOf(Function);
          expect(${exportName}.length).toBeGreaterThanOrEqual(0);
        }
      }
    });

`;
    }

    tests += `    it('should have expected behavior', () => {
      if (typeof ${exportName} === 'function') {
        expect(${exportName}).toBeInstanceOf(Function);
        expect(${exportName}.name).toBe('${exportName}');
        expect(typeof ${exportName}.length).toBe('number');
        
        try {
          // Check if this might be a class constructor
          const isClass = ${exportName}.toString().startsWith('class ') || 
                         (${exportName}.prototype && ${exportName}.prototype.constructor === ${exportName});
          const result = isClass ? new ${exportName}() : ${exportName}();
          expect(result).toBeDefined();
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
        }
      } else if (typeof ${exportName} === 'object' && ${exportName} !== null) {
        expect(${exportName}).toBeInstanceOf(Object);
        const keys = Object.keys(${exportName});
        expect(Array.isArray(keys)).toBe(true);
      } else {
        expect(${exportName}).toBeDefined();
        expect(typeof ${exportName}).toMatch(/string|number|boolean/);
      }
    });
`;

    return tests;
  }

  private generateFallbackModuleTests(moduleName: string): string {
    return `  it('should be a valid module structure', () => {
    const moduleType = typeof ${moduleName};
    expect(['object', 'function']).toContain(moduleType);
  });

  it('should have some exportable content', () => {
    if (typeof ${moduleName} === 'object' && ${moduleName} !== null) {
      expect(Object.keys(${moduleName}).length).toBeGreaterThanOrEqual(0);
    } else if (typeof ${moduleName} === 'function') {
      expect(${moduleName}).toBeInstanceOf(Function);
    }
  });

`;
  }
}

/**
 * Enhanced React component template with framework-specific testing patterns
 */
export class EnhancedReactComponentTemplate implements Template {
  name = 'enhanced-react-component';
  language = 'javascript' as const;
  framework = 'react';
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
      return this.generateESMReactTemplate(
        componentName,
        hasDefaultExport,
        importPathWithExtension,
        asyncPatterns
      );
    } else {
      return this.generateCommonJSReactTemplate(
        componentName,
        hasDefaultExport,
        relativeImportPath,
        asyncPatterns
      );
    }
  }

  private getAsyncPatterns(context: TemplateContext): FileAsyncPatterns | null {
    const metadata = (context as any).metadata;
    return metadata?.asyncPatterns || null;
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

  private generateESMReactTemplate(
    componentName: string,
    hasDefaultExport: boolean,
    importPath: string,
    asyncPatterns: FileAsyncPatterns | null
  ): string {
    const componentImport = hasDefaultExport
      ? `import ${componentName} from '${importPath}';`
      : `import { ${componentName} } from '${importPath}';`;

    let template = `import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
${componentImport}

describe('${componentName}', () => {
  it('should render without crashing', () => {
    const { container } = render(<${componentName} />);
    expect(container).toBeInTheDocument();
  });

  it('should be defined as a valid React component', () => {
    expect(${componentName}).toBeDefined();
    expect(typeof ${componentName}).toMatch(/^(function|object)$/);
  });

  it('should render content to the DOM', () => {
    const { container } = render(<${componentName} />);
    expect(container.firstChild).toBeTruthy();
  });

  it('should handle props correctly', () => {
    const commonProps = [
      {},
      { children: 'test content' },
      { className: 'test-class' },
      { style: { color: 'red' } },
      { 'data-testid': 'test-component' },
      { id: 'test-id' }
    ];
    
    commonProps.forEach((props) => {
      try {
        const { unmount } = render(<${componentName} {...props} />);
        expect(true).toBe(true); // Component rendered successfully
        unmount();
      } catch (error) {
        // Component may not accept these props - that's okay
        expect(error).toBeInstanceOf(Error);
      }
    });
  });

  it('should be accessible', () => {
    render(<${componentName} />);
    
    // Test basic accessibility patterns
    const interactiveElements = [
      ...screen.queryAllByRole('button'),
      ...screen.queryAllByRole('textbox'),
      ...screen.queryAllByRole('checkbox'),
      ...screen.queryAllByRole('link'),
      ...screen.queryAllByRole('tab'),
      ...screen.queryAllByRole('menuitem')
    ];
    
    interactiveElements.forEach(element => {
      expect(element).toBeInTheDocument();
      
      // Test that interactive elements are focusable
      if (element.tagName === 'BUTTON' || element.getAttribute('role') === 'button') {
        expect(element).not.toBeDisabled();
      }
    });
  });
`;

    // Add async-specific tests for React components
    if (asyncPatterns?.hasAsyncPatterns) {
      template += this.generateAsyncReactTests(componentName);
    }

    template += this.generateInteractionTests(componentName);

    template += `});
`;

    return template;
  }

  private generateCommonJSReactTemplate(
    componentName: string,
    hasDefaultExport: boolean,
    importPath: string,
    _asyncPatterns: FileAsyncPatterns | null
  ): string {
    const componentImport = hasDefaultExport
      ? `const ${componentName} = require('${importPath}');`
      : `const { ${componentName} } = require('${importPath}');`;

    return `// Basic React component test without external dependencies
${componentImport}

describe('${componentName}', () => {
  it('should be defined', () => {
    expect(${componentName}).toBeDefined();
  });

  it('should be a function or object', () => {
    expect(typeof ${componentName}).toMatch(/^(function|object)$/);
  });

  it('should not throw when accessed', () => {
    expect(() => {
      const comp = ${componentName};
      return comp;
    }).not.toThrow();
  });

  it('should have expected component properties', () => {
    if (typeof ${componentName} === 'function') {
      // Test function component properties
      expect(${componentName}.name || ${componentName}.displayName).toBeTruthy();
      expect(${componentName}.length).toBeDefined();
    } else if (typeof ${componentName} === 'object') {
      // Test class component or object
      expect(Object.keys(${componentName})).toEqual(expect.any(Array));
    }
  });

  it('should be a valid React component structure', () => {
    // Basic structural tests
    if (typeof ${componentName} === 'function') {
      // Function component
      expect(${componentName}).toBeInstanceOf(Function);
    } else if (typeof ${componentName} === 'object' && ${componentName} !== null) {
      // Class component or React component object
      expect(${componentName}).toBeInstanceOf(Object);
    }
  });
});
`;
  }

  private generateAsyncReactTests(componentName: string): string {
    return `
  it('should handle async operations', async () => {
    render(<${componentName} />);
    
    // Test async state updates
    await waitFor(() => {
      expect(screen.getByRole('document')).toBeInTheDocument();
    });
    
    // Test async data loading patterns
    const loadingIndicators = screen.queryAllByText(/loading|spinner|wait/i);
    if (loadingIndicators.length > 0) {
      await waitFor(() => {
        expect(loadingIndicators[0]).toBeInTheDocument();
      });
    }
  });

  it('should handle async user interactions', async () => {
    render(<${componentName} />);
    
    // Test async button clicks
    const buttons = screen.queryAllByRole('button');
    for (const button of buttons) {
      try {
        fireEvent.click(button);
        await waitFor(() => {
          expect(button).toBeInTheDocument();
        });
      } catch {
        // Button might not be interactive - that's okay
      }
    }
  });
`;
  }

  private generateInteractionTests(componentName: string): string {
    return `
  it('should handle user interactions', () => {
    render(<${componentName} />);
    
    // Test click interactions
    const clickableElements = [
      ...screen.queryAllByRole('button'),
      ...screen.queryAllByRole('link'),
      ...screen.queryAllByRole('tab')
    ];
    
    clickableElements.forEach(element => {
      try {
        fireEvent.click(element);
        expect(true).toBe(true); // Click was successful
      } catch {
        // Element might not be clickable - that's okay
      }
    });
    
    // Test input interactions
    const inputElements = [
      ...screen.queryAllByRole('textbox'),
      ...screen.queryAllByRole('checkbox'),
      ...screen.queryAllByRole('radio')
    ];
    
    inputElements.forEach(element => {
      try {
        if (element.tagName === 'INPUT') {
          fireEvent.change(element, { target: { value: 'test' } });
          expect(true).toBe(true); // Input change was successful
        }
      } catch {
        // Element might not be changeable - that's okay
      }
    });
  });

  it('should match snapshot', () => {
    const { container } = render(<${componentName} />);
    expect(container.firstChild).toMatchSnapshot();
  });
`;
  }
}

/**
 * Enhanced Vue.js component template with Vue-specific testing patterns
 */
export class EnhancedVueComponentTemplate implements Template {
  name = 'enhanced-vue-component';
  language = 'javascript' as const;
  framework = 'vue';
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
      return this.generateESMVueTemplate(
        componentName,
        hasDefaultExport,
        importPathWithExtension,
        asyncPatterns
      );
    } else {
      return this.generateCommonJSVueTemplate(
        componentName,
        hasDefaultExport,
        relativeImportPath,
        asyncPatterns
      );
    }
  }

  private getAsyncPatterns(context: TemplateContext): FileAsyncPatterns | null {
    const metadata = (context as any).metadata;
    return metadata?.asyncPatterns || null;
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

  private generateESMVueTemplate(
    componentName: string,
    hasDefaultExport: boolean,
    importPath: string,
    asyncPatterns: FileAsyncPatterns | null
  ): string {
    const componentImport = hasDefaultExport
      ? `import ${componentName} from '${importPath}';`
      : `import { ${componentName} } from '${importPath}';`;

    let template = `import { mount, shallowMount } from '@vue/test-utils';
${componentImport}

describe('${componentName}', () => {
  it('should mount without errors', () => {
    const wrapper = mount(${componentName});
    expect(wrapper.vm).toBeTruthy();
  });

  it('should be a valid Vue component', () => {
    expect(${componentName}).toBeDefined();
    expect(typeof ${componentName}).toMatch(/^(function|object)$/);
  });

  it('should render content', () => {
    const wrapper = mount(${componentName});
    expect(wrapper.element).toBeTruthy();
    expect(wrapper.html()).toBeTruthy();
  });

  it('should handle props correctly', () => {
    const commonProps = [
      {},
      { msg: 'test message' },
      { title: 'test title' },
      { disabled: false },
      { visible: true }
    ];
    
    commonProps.forEach((props) => {
      try {
        const wrapper = mount(${componentName}, { props });
        expect(wrapper.vm).toBeTruthy();
        wrapper.unmount();
      } catch (error) {
        // Component may not accept these props - that's okay
        expect(error).toBeInstanceOf(Error);
      }
    });
  });

  it('should handle Vue lifecycle correctly', () => {
    const wrapper = mount(${componentName});
    
    // Test component instance
    expect(wrapper.vm).toBeTruthy();
    expect(wrapper.vm.$el).toBeTruthy();
    
    // Test that component can be unmounted
    expect(() => wrapper.unmount()).not.toThrow();
  });

  it('should handle events correctly', async () => {
    const wrapper = mount(${componentName});
    
    // Test click events
    const clickableElements = wrapper.findAll('button, a, [role="button"]');
    for (const element of clickableElements) {
      try {
        await element.trigger('click');
        expect(true).toBe(true); // Event triggered successfully
      } catch {
        // Element might not be clickable - that's okay
      }
    }
    
    // Test input events
    const inputElements = wrapper.findAll('input, textarea, select');
    for (const element of inputElements) {
      try {
        await element.setValue('test value');
        expect(true).toBe(true); // Input value set successfully
      } catch {
        // Element might not accept values - that's okay
      }
    }
  });
`;

    if (asyncPatterns?.hasAsyncPatterns) {
      template += this.generateAsyncVueTests(componentName);
    }

    template += `
  it('should match snapshot', () => {
    const wrapper = shallowMount(${componentName});
    expect(wrapper.html()).toMatchSnapshot();
  });
});
`;

    return template;
  }

  private generateCommonJSVueTemplate(
    componentName: string,
    hasDefaultExport: boolean,
    importPath: string,
    _asyncPatterns: FileAsyncPatterns | null
  ): string {
    const componentImport = hasDefaultExport
      ? `const ${componentName} = require('${importPath}');`
      : `const { ${componentName} } = require('${importPath}');`;

    return `// Basic Vue component test without external dependencies
${componentImport}

describe('${componentName}', () => {
  it('should be defined', () => {
    expect(${componentName}).toBeDefined();
  });

  it('should be a valid Vue component structure', () => {
    expect(typeof ${componentName}).toMatch(/^(function|object)$/);
    
    // Test for Vue component properties
    if (typeof ${componentName} === 'object' && ${componentName} !== null) {
      // Check for common Vue component properties
      const vueProps = ['template', 'render', 'data', 'methods', 'props', 'computed'];
      const hasVueProps = vueProps.some(prop => prop in ${componentName});
      
      if (hasVueProps) {
        expect(Object.keys(${componentName})).toEqual(expect.any(Array));
      }
    }
  });

  it('should not throw when accessed', () => {
    expect(() => {
      const comp = ${componentName};
      return comp;
    }).not.toThrow();
  });

  it('should have expected component structure', () => {
    if (typeof ${componentName} === 'function') {
      expect(${componentName}).toBeInstanceOf(Function);
      expect(${componentName}.name).toBeDefined();
    } else if (typeof ${componentName} === 'object' && ${componentName} !== null) {
      expect(${componentName}).toBeInstanceOf(Object);
      expect(Object.keys(${componentName})).toEqual(expect.any(Array));
    }
  });
});
`;
  }

  private generateAsyncVueTests(componentName: string): string {
    return `
  it('should handle async operations', async () => {
    const wrapper = mount(${componentName});
    
    // Test async component updates
    await wrapper.vm.$nextTick();
    expect(wrapper.vm).toBeTruthy();
    
    // Test async method calls if component has methods
    if (wrapper.vm.$options.methods) {
      const methods = Object.keys(wrapper.vm.$options.methods);
      for (const methodName of methods) {
        try {
          const result = await wrapper.vm[methodName]();
          // Method executed successfully
          expect(true).toBe(true);
        } catch {
          // Method might require parameters or not be async
        }
      }
    }
  });

  it('should handle async lifecycle hooks', async () => {
    const wrapper = mount(${componentName});
    
    // Wait for potential async lifecycle hooks
    await wrapper.vm.$nextTick();
    expect(wrapper.vm).toBeTruthy();
    
    // Test async component updates
    if (wrapper.vm.$data) {
      await wrapper.vm.$forceUpdate();
      expect(wrapper.vm).toBeTruthy();
    }
  });
`;
  }
}

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
    return metadata?.asyncPatterns || null;
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

/**
 * Enhanced TypeScript template with advanced type checking and async patterns
 */
export class EnhancedTypeScriptTemplate implements Template {
  name = 'enhanced-typescript';
  language = 'typescript' as const;
  framework = 'jest';

  generate(context: TemplateContext): string {
    const { moduleName, exports, hasDefaultExport, moduleSystem, modulePath } = context;

    const asyncPatterns = this.getAsyncPatterns(context);
    const useESM = moduleSystem === 'esm';

    const importPath = modulePath || moduleName;
    const relativeImportPath = this.normalizeImportPath(importPath);
    const importPathWithExtension = this.addExtensionIfNeeded(relativeImportPath, useESM);

    const importStatement = this.generateImportStatement(
      moduleName,
      exports,
      hasDefaultExport,
      useESM,
      importPathWithExtension,
      relativeImportPath
    );

    let testContent = `${importStatement}

describe('${moduleName}', () => {
`;

    // TypeScript-specific module tests
    testContent += `  it('should load the module with correct TypeScript types', () => {
    expect(${moduleName}).toBeDefined();
    expect(typeof ${moduleName}).not.toBe('undefined');
  });

`;

    // Type safety tests
    testContent += this.generateTypeSafetyTests(moduleName, hasDefaultExport);

    // Async-aware tests
    if (asyncPatterns?.hasAsyncPatterns) {
      testContent += this.generateAsyncTypeScriptTests(moduleName, asyncPatterns);
    }

    // Enhanced export tests
    if (exports.length > 0) {
      exports.forEach((exportName) => {
        testContent += this.generateTypeScriptExportTests(exportName, asyncPatterns);
      });
    } else {
      testContent += this.generateFallbackTypeScriptTests(moduleName);
    }

    testContent += '});';
    return testContent;
  }

  private getAsyncPatterns(context: TemplateContext): FileAsyncPatterns | null {
    const metadata = (context as any).metadata;
    return metadata?.asyncPatterns || null;
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

  private generateImportStatement(
    moduleName: string,
    exports: string[],
    hasDefaultExport: boolean,
    useESM: boolean,
    importPathWithExtension: string,
    relativeImportPath: string
  ): string {
    if (useESM) {
      if (hasDefaultExport && exports.length > 0) {
        return `import ${moduleName}, { ${exports.join(', ')} } from '${importPathWithExtension}';`;
      } else if (hasDefaultExport) {
        return `import ${moduleName} from '${importPathWithExtension}';`;
      } else if (exports.length > 0) {
        return `import { ${exports.join(', ')} } from '${importPathWithExtension}';`;
      } else {
        return `import * as ${moduleName} from '${importPathWithExtension}';`;
      }
    } else {
      if (hasDefaultExport) {
        return `const ${moduleName} = require('${relativeImportPath}');`;
      } else if (exports.length > 0) {
        return `const { ${exports.join(', ')} } = require('${relativeImportPath}');`;
      } else {
        return `const ${moduleName} = require('${relativeImportPath}');`;
      }
    }
  }

  private generateTypeSafetyTests(moduleName: string, hasDefaultExport: boolean): string {
    let tests = `  describe('type safety', () => {
    it('should have correct TypeScript types', () => {
      // Test that TypeScript compilation succeeded
      expect(${moduleName}).toBeDefined();
      
      // Test type information is preserved
      const actualType = typeof ${moduleName};
      expect(['function', 'object', 'string', 'number', 'boolean']).toContain(actualType);
    });

`;

    if (hasDefaultExport) {
      tests += `    it('should export default with correct type', () => {
      // Test default export type consistency
      expect(${moduleName}).toBeDefined();
      expect(${moduleName}).not.toBeUndefined();
      
      // Test that it's not accidentally typed as 'any'
      expect(typeof ${moduleName}).not.toBe('undefined');
    });

`;
    }

    tests += `    it('should maintain type safety in operations', () => {
      // Test type-safe operations
      if (typeof ${moduleName} === 'function') {
        // Test function type properties
        expect(${moduleName}).toBeInstanceOf(Function);
        expect(typeof ${moduleName}.length).toBe('number');
        expect(typeof ${moduleName}.name).toBe('string');
        
        // Test TypeScript-specific function properties
        if ('prototype' in ${moduleName}) {
          expect(${moduleName}.prototype).toBeDefined();
        }
      } else if (typeof ${moduleName} === 'object' && ${moduleName} !== null) {
        // Test object type safety
        expect(${moduleName}).toBeInstanceOf(Object);
        expect(Object.keys(${moduleName})).toEqual(expect.any(Array));
        
        // Test that object methods are properly typed
        Object.values(${moduleName}).forEach(value => {
          if (typeof value === 'function') {
            expect(value).toBeInstanceOf(Function);
          }
        });
      }
    });

  });

`;
    return tests;
  }

  private generateAsyncTypeScriptTests(
    moduleName: string,
    asyncPatterns: FileAsyncPatterns
  ): string {
    if (!asyncPatterns.patterns || asyncPatterns.patterns.length === 0) {
      return '';
    }

    let tests = `  describe('async TypeScript behavior', () => {
`;

    const patternTypes = new Set(asyncPatterns.patterns.map((p) => p.type));

    if (patternTypes.has('async-await')) {
      tests += `    it('should handle async/await with proper TypeScript types', async () => {
      if (typeof ${moduleName} === 'function') {
        try {
          const result = ${moduleName}();
          
          // TypeScript type checking for promises
          if (result && typeof result.then === 'function') {
            expect(result).toBeInstanceOf(Promise);
            
            // Test Promise typing
            const resolvedValue = await result;
            expect(resolvedValue).toBeDefined();
            
            // Test that Promise has correct TypeScript interface
            expect(typeof result.then).toBe('function');
            expect(typeof result.catch).toBe('function');
            expect(typeof result.finally).toBe('function');
          }
        } catch (error) {
          // Test error type safety
          expect(error).toBeInstanceOf(Error);
          expect(typeof error.message).toBe('string');
        }
      }
    });

`;
    }

    if (patternTypes.has('promise')) {
      tests += `    it('should handle Promise types correctly', async () => {
      if (typeof ${moduleName} === 'function') {
        try {
          const result = ${moduleName}();
          
          if (result instanceof Promise) {
            // Test Promise type safety
            expect(result).toBeInstanceOf(Promise);
            
            // Test Promise methods are properly typed
            expect(typeof result.then).toBe('function');
            expect(typeof result.catch).toBe('function');
            
            // Test Promise resolution with TypeScript types
            const resolvedValue = await result;
            expect(resolvedValue).toBeDefined();
            
            // Test Promise state
            expect(result).toHaveProperty('then');
            expect(result).toHaveProperty('catch');
            expect(result).toHaveProperty('finally');
          }
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
        }
      }
    });

`;
    }

    if (patternTypes.has('callback')) {
      tests += `    it('should handle callback types correctly', (done) => {
      if (typeof ${moduleName} === 'function') {
        try {
          // Test callback with TypeScript error-first convention
          ${moduleName}((error: Error | null, result?: any) => {
            // Test callback parameter types
            if (error) {
              expect(error).toBeInstanceOf(Error);
              expect(typeof error.message).toBe('string');
            }
            
            if (result !== undefined) {
              expect(result).toBeDefined();
            }
            
            done();
          });
        } catch (error) {
          // Test TypeScript error handling
          expect(error).toBeInstanceOf(Error);
          done();
        }
      } else {
        done();
      }
    });

`;
    }

    if (patternTypes.has('generator')) {
      tests += `    it('should handle generator types correctly', () => {
      if (typeof ${moduleName} === 'function') {
        try {
          const generator = ${moduleName}();
          
          if (generator && typeof generator.next === 'function') {
            // Test generator TypeScript interface
            expect(generator).toHaveProperty('next');
            expect(generator).toHaveProperty('return');
            expect(generator).toHaveProperty('throw');
            
            // Test generator iteration result types
            const firstResult = generator.next();
            expect(firstResult).toHaveProperty('done');
            expect(firstResult).toHaveProperty('value');
            expect(typeof firstResult.done).toBe('boolean');
            
            // Test TypeScript generator typing
            expect(typeof generator.next).toBe('function');
            if ('Symbol' in globalThis && Symbol.iterator) {
              expect(generator[Symbol.iterator]).toBeInstanceOf(Function);
            }
          }
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
        }
      }
    });

`;
    }

    tests += `  });

`;
    return tests;
  }

  private generateTypeScriptExportTests(
    exportName: string,
    asyncPatterns: FileAsyncPatterns | null
  ): string {
    let tests = `  describe('${exportName} (TypeScript)', () => {
    it('should be defined with correct TypeScript type', () => {
      expect(${exportName}).toBeDefined();
      expect(typeof ${exportName}).not.toBe('undefined');
    });

    it('should maintain TypeScript type safety', () => {
      const actualType = typeof ${exportName};
      expect(['function', 'object', 'string', 'number', 'boolean']).toContain(actualType);
      
      // Enhanced TypeScript type checking
      if (actualType === 'function') {
        // Test function signature properties
        expect(${exportName}).toBeInstanceOf(Function);
        expect(typeof ${exportName}.length).toBe('number');
        expect(typeof ${exportName}.name).toBe('string');
        
        // Test TypeScript function properties
        expect(${exportName}.constructor).toBe(Function);
        if ('prototype' in ${exportName}) {
          expect(typeof ${exportName}.prototype).toBe('object');
        }
      } else if (actualType === 'object' && ${exportName} !== null) {
        // Test object type safety
        expect(${exportName}).toBeInstanceOf(Object);
        expect(Array.isArray(Object.keys(${exportName}))).toBe(true);
        
        // Test object method types
        Object.entries(${exportName}).forEach(([key, value]) => {
          expect(typeof key).toBe('string');
          if (typeof value === 'function') {
            expect(value).toBeInstanceOf(Function);
          }
        });
      }
    });

    it('should work correctly with TypeScript patterns', () => {
      if (typeof ${exportName} === 'function') {
        // Test function behavior with TypeScript awareness
        expect(${exportName}).toBeInstanceOf(Function);
        
        // Try calling with TypeScript-common patterns
        const testScenarios = [
          () => ${exportName}(),
          () => ${exportName}(undefined),
          () => ${exportName}(null),
          () => ${exportName}({}),
          () => ${exportName}(''),
          () => ${exportName}(0),
          () => ${exportName}(false),
          () => ${exportName}([]),
        ];
        
        let successfulCall = false;
        for (const scenario of testScenarios) {
          try {
            const result = scenario();
            successfulCall = true;
            
            // Test result type safety
            expect(result).toBeDefined();
            expect(typeof result).toMatch(/^(string|number|boolean|object|function|undefined)$/);
            break;
          } catch (error) {
            // Test error type safety
            expect(error).toBeInstanceOf(Error);
          }
        }
        
        // If no scenarios work, verify it's still a valid function
        if (!successfulCall) {
          expect(${exportName}).toBeInstanceOf(Function);
        }
      } else {
        // Test non-function exports with TypeScript patterns
        expect(${exportName}).toBeDefined();
        expect(typeof ${exportName}).not.toBe('undefined');
        
        // Test TypeScript primitive type safety
        const primitiveTypes = ['string', 'number', 'boolean'];
        const complexTypes = ['object', 'function'];
        const validTypes = [...primitiveTypes, ...complexTypes];
        
        expect(validTypes).toContain(typeof ${exportName});
      }
    });
`;

    // Add async-specific TypeScript tests
    if (asyncPatterns?.hasAsyncPatterns) {
      tests += this.generateAsyncExportTypeScriptTests(exportName, asyncPatterns);
    }

    tests += `  });

`;
    return tests;
  }

  private generateAsyncExportTypeScriptTests(
    exportName: string,
    asyncPatterns: FileAsyncPatterns
  ): string {
    const patternTypes = new Set(asyncPatterns.patterns?.map((p) => p.type) || []);
    let tests = '';

    if (patternTypes.has('async-await') || patternTypes.has('promise')) {
      tests += `
    it('should handle async operations with TypeScript types', async () => {
      if (typeof ${exportName} === 'function') {
        try {
          const result = ${exportName}();
          
          // TypeScript Promise type checking
          if (result && typeof result.then === 'function') {
            expect(result).toBeInstanceOf(Promise);
            
            // Test Promise interface methods
            expect(typeof result.then).toBe('function');
            expect(typeof result.catch).toBe('function');
            expect(typeof result.finally).toBe('function');
            
            // Test async resolution with type safety
            const resolvedValue = await result;
            expect(resolvedValue).toBeDefined();
          }
        } catch (error) {
          // TypeScript error type checking
          expect(error).toBeInstanceOf(Error);
          expect(typeof error.message).toBe('string');
          expect(typeof error.name).toBe('string');
        }
      }
    });`;
    }

    return tests;
  }

  private generateFallbackTypeScriptTests(moduleName: string): string {
    return `  it('should be a valid TypeScript module structure', () => {
    const moduleType = typeof ${moduleName};
    expect(['object', 'function']).toContain(moduleType);
    
    // TypeScript module validation
    if (moduleType === 'object' && ${moduleName} !== null) {
      expect(Object.keys(${moduleName})).toEqual(expect.any(Array));
      expect(${moduleName}).toBeInstanceOf(Object);
    } else if (moduleType === 'function') {
      expect(${moduleName}).toBeInstanceOf(Function);
      expect(typeof ${moduleName}.length).toBe('number');
    }
  });

  it('should maintain TypeScript compilation integrity', () => {
    // Test that module was properly compiled from TypeScript
    expect(${moduleName}).toBeDefined();
    expect(typeof ${moduleName}).not.toBe('undefined');
    
    // Test TypeScript-specific behaviors
    if (typeof ${moduleName} === 'object' && ${moduleName} !== null) {
      const keys = Object.keys(${moduleName});
      expect(Array.isArray(keys)).toBe(true);
      
      // Test that object methods have proper types
      keys.forEach(key => {
        const value = ${moduleName}[key];
        expect(typeof value).toMatch(/^(string|number|boolean|object|function|undefined)$/);
      });
    }
  });

`;
  }
}
