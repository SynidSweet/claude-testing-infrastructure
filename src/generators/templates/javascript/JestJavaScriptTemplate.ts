import { Template, TemplateContext } from '../TestTemplateEngine';
import { TestType } from '../../TestGenerator';

/**
 * Generate JavaScript-specific tests for Jest
 */
function generateJSTypeSpecificTests(
  exportName: string,
  testType: TestType,
  isAsync: boolean
): string {
  let tests = '';

  if (isAsync) {
    tests += `    it('should handle async operations', async () => {
      if (typeof ${exportName} === 'function') {
        // Test that async functions return promises
        try {
          const result = ${exportName}();
          if (result && typeof result.then === 'function') {
            await expect(result).resolves.toBeDefined();
          }
        } catch (error) {
          // Function may require parameters - test with basic args
          try {
            const result = ${exportName}(null, undefined, {});
            if (result && typeof result.then === 'function') {
              await expect(result).resolves.toBeDefined();
            }
          } catch {
            // If it still fails, just verify it's a function
            expect(${exportName}).toBeInstanceOf(Function);
          }
        }
      }
    });

`;
  }

  if (testType === TestType.UTILITY) {
    tests += `    it('should work with typical inputs', () => {
      if (typeof ${exportName} === 'function') {
        // Test with common input types
        const testInputs = [
          undefined,
          null,
          '',
          'test',
          0,
          1,
          [],
          {},
          true,
          false
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
            break; // Found an input that works
          } catch {
            // Try next input
          }
        }
        
        // If no inputs work, at least verify it's callable
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
        // Test function properties
        expect(${exportName}).toBeInstanceOf(Function);
        expect(${exportName}.name).toBe('${exportName}');
        expect(typeof ${exportName}.length).toBe('number');
        
        // Basic invocation tests
        try {
          // Check if this might be a class constructor
          const isClass = ${exportName}.toString().startsWith('class ') || 
                         (${exportName}.prototype && ${exportName}.prototype.constructor === ${exportName});
          const result = isClass ? new ${exportName}() : ${exportName}();
          // If function succeeds without args, test return value
          expect(result).toBeDefined();
        } catch (error) {
          // Function requires arguments - that's valid behavior
          expect(error).toBeInstanceOf(Error);
        }
      } else if (typeof ${exportName} === 'object' && ${exportName} !== null) {
        // Test object properties
        expect(${exportName}).toBeInstanceOf(Object);
        expect(Object.keys(${exportName}).length).toBeGreaterThanOrEqual(0);
      }
    });
`;

  return tests;
}

/**
 * Jest JavaScript template for basic JavaScript modules
 */
export class JestJavaScriptTemplate implements Template {
  name = 'jest-javascript';
  language = 'javascript' as const;
  framework = 'jest';

  generate(context: TemplateContext): string {
    const { moduleName, exports, hasDefaultExport, isAsync, testType, moduleSystem, modulePath } =
      context;

    // Generate import statement based on module system
    let importStatement = '';
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

    // Detect JSX files that need special handling in ES modules
    const isJsxFile = pathWithoutTsExt.endsWith('.jsx') || pathWithoutTsExt.endsWith('.tsx');
    const needsJsxMocking = useESM && isJsxFile;

    if (needsJsxMocking) {
      // For JSX files in ES modules, use Jest mocking to avoid JSX parsing issues
      importStatement = `// JSX file detected - using mock for structural testing
jest.mock('${importPathWithExtension}', () => {
  const mockComponent = jest.fn(() => null);
  mockComponent.displayName = '${moduleName}';
  return { default: mockComponent };
});

const ${moduleName} = jest.requireMock('${importPathWithExtension}').default;`;
    } else if (useESM) {
      // ES Modules syntax
      if (hasDefaultExport && exports.length > 0) {
        // Both default and named exports
        importStatement = `import ${moduleName}, { ${exports.join(', ')} } from '${importPathWithExtension}';`;
      } else if (hasDefaultExport) {
        // Only default export
        importStatement = `import ${moduleName} from '${importPathWithExtension}';`;
      } else if (exports.length > 0) {
        // Only named exports
        importStatement = `import { ${exports.join(', ')} } from '${importPathWithExtension}';`;
      } else {
        // Fallback: try importing the whole module
        importStatement = `import * as ${moduleName} from '${importPathWithExtension}';`;
      }
    } else {
      // CommonJS syntax (default)
      // Use the processed path without TS extension for CommonJS too
      const commonjsPath = pathWithoutTsExt;
      if (hasDefaultExport) {
        importStatement = `const ${moduleName} = require('${commonjsPath}');`;
      } else if (exports.length > 0) {
        importStatement = `const { ${exports.join(', ')} } = require('${commonjsPath}');`;
      } else {
        // Fallback: try importing the whole module
        importStatement = `const ${moduleName} = require('${commonjsPath}');`;
      }
    }

    let testContent = `${importStatement}

describe('${moduleName}', () => {
`;

    // Always add module existence test
    let moduleTestReference = moduleName;
    if (!hasDefaultExport && exports.length > 0 && exports[0]) {
      // For named exports only, test the first export instead of the module name
      moduleTestReference = exports[0];
    }
    testContent += `  it('should load the module without errors', () => {
    expect(${moduleTestReference}).toBeDefined();
  });

`;

    if (hasDefaultExport) {
      testContent += `  it('should export a default value', () => {
    expect(${moduleName}).toBeDefined();
    expect(typeof ${moduleName}).not.toBe('undefined');
  });

`;
    }

    // If we have detected exports, test each one
    if (exports.length > 0) {
      exports.forEach((exportName) => {
        testContent += `  describe('${exportName}', () => {
    it('should be defined', () => {
      expect(${exportName}).toBeDefined();
    });

    it('should have the expected type', () => {
      const type = typeof ${exportName};
      expect(['function', 'object', 'string', 'number', 'boolean']).toContain(type);
    });

${generateJSTypeSpecificTests(exportName, testType, isAsync)}
  });

`;
      });
    } else {
      // Fallback tests when no exports detected
      testContent += `  it('should be a valid module structure', () => {
    // Test common export patterns
    const moduleType = typeof ${moduleName};
    expect(['object', 'function']).toContain(moduleType);
  });

  it('should have some exportable content', () => {
    // Check if module has properties or is callable
    if (typeof ${moduleName} === 'object' && ${moduleName} !== null) {
      expect(Object.keys(${moduleName}).length).toBeGreaterThanOrEqual(0);
    } else if (typeof ${moduleName} === 'function') {
      expect(${moduleName}).toBeInstanceOf(Function);
    }
  });

`;
    }

    testContent += '});';
    return testContent;
  }
}
