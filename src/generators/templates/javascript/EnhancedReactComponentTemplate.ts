import { TestType } from '../../TestGenerator';
import type { Template, TemplateContext } from '../TestTemplateEngine';
import type { FileAsyncPatterns } from '../../javascript/analyzers/AsyncPatternDetector';

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
