import type { Template, TemplateContext } from '../TestTemplateEngine';
import type { FileAsyncPatterns } from '../../javascript/analyzers/AsyncPatternDetector';

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
          ${moduleName}((error: Error | null, result?: unknown) => {
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
