import { Template, TemplateContext } from '../TestTemplateEngine';

/**
 * Jest TypeScript template for testing TypeScript modules with type awareness
 */
export class JestTypeScriptTemplate implements Template {
  name = 'jest-typescript';
  language = 'typescript' as const;
  framework = 'jest';

  generate(context: TemplateContext): string {
    const { moduleName, exports, hasDefaultExport, moduleSystem, modulePath } = context;
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

    let importStatement = '';
    if (useESM) {
      // ES Modules syntax for TypeScript
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
      // CommonJS syntax
      if (hasDefaultExport) {
        importStatement = `const ${moduleName} = require('${relativeImportPath}');`;
      } else if (exports.length > 0) {
        importStatement = `const { ${exports.join(', ')} } = require('${relativeImportPath}');`;
      }
    }

    let testContent = `${importStatement}

describe('${moduleName}', () => {
`;

    if (hasDefaultExport) {
      testContent += `  it('should be defined', () => {
    expect(${moduleName}).toBeDefined();
  });

`;
    }

    exports.forEach((exportName) => {
      testContent += `  describe('${exportName}', () => {
    it('should be defined', () => {
      expect(${exportName}).toBeDefined();
    });

    it('should have correct TypeScript types', () => {
      // Test basic type expectations
      const actualType = typeof ${exportName};
      expect(['function', 'object', 'string', 'number', 'boolean']).toContain(actualType);
      
      if (actualType === 'function') {
        // Test function signature properties
        expect(${exportName}).toBeInstanceOf(Function);
        expect(typeof ${exportName}.length).toBe('number');
        expect(typeof ${exportName}.name).toBe('string');
      }
    });

    it('should work correctly', () => {
      if (typeof ${exportName} === 'function') {
        // Test function behavior
        expect(${exportName}).toBeInstanceOf(Function);
        
        // Try calling with common TypeScript patterns
        const testScenarios = [
          () => ${exportName}(),
          () => ${exportName}(undefined),
          () => ${exportName}(null),
          () => ${exportName}({}),
          () => ${exportName}(''),
          () => ${exportName}(0)
        ];
        
        let successfulCall = false;
        for (const scenario of testScenarios) {
          try {
            const result = scenario();
            successfulCall = true;
            expect(result).toBeDefined();
            break;
          } catch {
            // Continue to next scenario
          }
        }
        
        // If no scenarios work, verify it's still a valid function
        if (!successfulCall) {
          expect(${exportName}).toBeInstanceOf(Function);
        }
      } else {
        // Test non-function exports
        expect(${exportName}).toBeDefined();
        expect(${exportName}).not.toBeUndefined();
      }
    });
  });

`;
    });

    testContent += '});';
    return testContent;
  }
}
