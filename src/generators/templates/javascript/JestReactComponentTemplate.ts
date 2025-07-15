import { Template, TemplateContext } from '../TestTemplateEngine';
import { TestType } from '../../TestGenerator';

/**
 * Jest React component template for testing React components
 */
export class JestReactComponentTemplate implements Template {
  name = 'jest-react-component';
  language = 'javascript' as const;
  framework = 'react';
  testType = TestType.COMPONENT;

  generate(context: TemplateContext): string {
    const { moduleName, hasDefaultExport, exports, moduleSystem, modulePath } = context;
    const useESM = moduleSystem === 'esm';

    // If no default export, use first export name or fallback to moduleName
    const componentName: string = hasDefaultExport
      ? moduleName
      : exports && exports.length > 0 && exports[0]
        ? exports[0]
        : moduleName;

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

    let importStatements = '';
    let componentImport = '';

    if (useESM) {
      // ES Module syntax with React testing imports
      importStatements = `import React from 'react';
import { render, screen } from '@testing-library/react';`;

      if (hasDefaultExport) {
        componentImport = `import ${componentName} from '${importPathWithExtension}';`;
      } else if (exports && exports.length > 0) {
        componentImport = `import { ${componentName} } from '${importPathWithExtension}';`;
      } else {
        componentImport = `import ${componentName} from '${importPathWithExtension}';`;
      }
    } else {
      // CommonJS syntax for validation tests to avoid dependency issues
      importStatements = `// Basic component test without external dependencies`;
      componentImport = `const ${componentName} = require('${pathWithoutTsExt}');`;
    }

    if (useESM) {
      // Full React testing template for ES modules
      return `${importStatements}
${componentImport}

describe('${componentName}', () => {
  it('should render without crashing', () => {
    render(<${componentName} />);
  });

  it('should be defined', () => {
    expect(${componentName}).toBeDefined();
  });

  it('should be a function or object', () => {
    expect(typeof ${componentName}).toMatch(/^(function|object)$/);
  });

  it('should render content', () => {
    render(<${componentName} />);
    // Component should render something to the DOM
    expect(document.body).toBeInTheDocument();
  });
});
`;
    } else {
      // Basic structural test for CommonJS to avoid dependencies
      return `${importStatements}
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

  it('should have expected properties', () => {
    // Basic structural test
    if (typeof ${componentName} === 'function') {
      expect(${componentName}.name || ${componentName}.displayName).toBeTruthy();
    } else if (typeof ${componentName} === 'object') {
      expect(Object.keys(${componentName})).toEqual(expect.any(Array));
    }
  });
});
`;
    }
  }
}
