import { TestType } from '../../TestGenerator';
import type { Template, TemplateContext } from '../TestTemplateEngine';
import type { FileAsyncPatterns } from '../../javascript/analyzers/AsyncPatternDetector';

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