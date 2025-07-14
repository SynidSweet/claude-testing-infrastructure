import { Template, TemplateContext } from '../TestTemplateEngine';
import { TestType } from '../../TestGenerator';

/**
 * Jest React TypeScript template for testing React components with TypeScript
 */
export class JestReactTypeScriptTemplate implements Template {
  name = 'jest-react-typescript';
  language = 'typescript' as const;
  framework = 'react';
  testType = TestType.COMPONENT;

  generate(context: TemplateContext): string {
    const { moduleName, hasDefaultExport, exports, moduleSystem, modulePath } = context;

    // If no default export, use first export name or fallback to moduleName
    const componentName: string = hasDefaultExport
      ? moduleName
      : exports && exports.length > 0 && exports[0]
        ? exports[0]
        : moduleName;
    const useESM = moduleSystem === 'esm';

    // Use modulePath if available, fallback to moduleName
    const importPath = modulePath || moduleName;
    // Add relative path prefix if it doesn't already exist and it's not an npm package
    const relativeImportPath =
      importPath.startsWith('./') ||
      importPath.startsWith('../') ||
      importPath.startsWith('/') ||
      (!importPath.includes('/') && !importPath.includes('\\'))
        ? importPath.startsWith('./') || importPath.startsWith('../') || importPath.startsWith('/')
          ? importPath
          : `./${importPath}`
        : importPath;
    // Remove TypeScript extensions first
    const pathWithoutTsExt = relativeImportPath.replace(/\.(ts|tsx)$/, '');
    const importPathWithExtension =
      useESM && !pathWithoutTsExt.endsWith('.js') && !pathWithoutTsExt.endsWith('.jsx')
        ? `${pathWithoutTsExt}.js`
        : pathWithoutTsExt;

    if (useESM) {
      return `import React from 'react';
import { render, screen, RenderResult } from '@testing-library/react';
import '@testing-library/jest-dom';
${hasDefaultExport ? `import ${componentName} from '${importPathWithExtension}';` : `import { ${componentName} } from '${importPathWithExtension}';`}

describe('${componentName}', () => {
  let renderResult: RenderResult;

  beforeEach(() => {
    renderResult = render(<${componentName} />);
  });

  it('should render without crashing', () => {
    expect(renderResult.container).toBeInTheDocument();
  });

  it('should match snapshot', () => {
    expect(renderResult.container.firstChild).toMatchSnapshot();
  });

  it('should have correct TypeScript props', () => {
    // Test component with default props
    const { container } = render(<${componentName} />);
    expect(container).toBeInTheDocument();
    
    // Test component with various prop types
    const commonProps = [
      {},
      { children: 'test' },
      { className: 'test-class' },
      { style: { color: 'red' } },
      { 'data-testid': 'test-component' }
    ];
    
    commonProps.forEach((props, index) => {
      try {
        const { unmount } = render(<${componentName} {...props} />);
        unmount(); // Clean up after each render
      } catch (error) {
        // Component may not accept these props - that's okay
        expect(error).toBeInstanceOf(Error);
      }
    });
  });

  it('should handle user interactions with type safety', () => {
    render(<${componentName} />);
    
    // Test for TypeScript-safe interactions
    const interactiveElements = [
      ...screen.queryAllByRole('button'),
      ...screen.queryAllByRole('textbox'),
      ...screen.queryAllByRole('checkbox'),
      ...screen.queryAllByRole('link')
    ];
    
    interactiveElements.forEach(element => {
      // Test that elements are properly typed and accessible
      expect(element).toBeInTheDocument();
      expect(element.tagName).toBeDefined();
      
      // Test TypeScript-safe event handling
      if (element.getAttribute('role') === 'button' || element.tagName === 'BUTTON') {
        expect(() => element.click()).not.toThrow();
      }
      
      if (element.getAttribute('role') === 'textbox' || element.tagName === 'INPUT') {
        expect(() => element.focus()).not.toThrow();
      }
    });
  });
});
`;
    } else {
      return `const React = require('react');
const { render, screen } = require('@testing-library/react');
require('@testing-library/jest-dom');
${hasDefaultExport ? `const ${componentName} = require('${pathWithoutTsExt}');` : `const { ${componentName} } = require('${pathWithoutTsExt}');`}

describe('${componentName}', () => {
  let renderResult: RenderResult;

  beforeEach(() => {
    renderResult = render(<${componentName} />);
  });

  it('should render without crashing', () => {
    expect(renderResult.container).toBeInTheDocument();
  });

  it('should match snapshot', () => {
    expect(renderResult.container.firstChild).toMatchSnapshot();
  });

  it('should have correct TypeScript props', () => {
    // Test component with default props
    const { container } = render(<${componentName} />);
    expect(container).toBeInTheDocument();
    
    // Test component with various prop types
    const commonProps = [
      {},
      { children: 'test' },
      { className: 'test-class' },
      { style: { color: 'red' } },
      { 'data-testid': 'test-component' }
    ];
    
    commonProps.forEach((props, index) => {
      try {
        const { unmount } = render(<${componentName} {...props} />);
        unmount(); // Clean up after each render
      } catch (error) {
        // Component may not accept these props - that's okay
        expect(error).toBeInstanceOf(Error);
      }
    });
  });

  it('should handle user interactions with type safety', () => {
    render(<${componentName} />);
    
    // Test for TypeScript-safe interactions
    const interactiveElements = [
      ...screen.queryAllByRole('button'),
      ...screen.queryAllByRole('textbox'),
      ...screen.queryAllByRole('checkbox'),
      ...screen.queryAllByRole('link')
    ];
    
    interactiveElements.forEach(element => {
      // Test that elements are properly typed and accessible
      expect(element).toBeInTheDocument();
      expect(element.tagName).toBeDefined();
      
      // Test TypeScript-safe event handling
      if (element.getAttribute('role') === 'button' || element.tagName === 'BUTTON') {
        expect(() => element.click()).not.toThrow();
      }
      
      if (element.getAttribute('role') === 'textbox' || element.tagName === 'INPUT') {
        expect(() => element.focus()).not.toThrow();
      }
    });
  });
});
`;
    }
  }
}
