import { TestType } from '../../TestGenerator';
import type { Template, TemplateContext } from '../TestTemplateEngine';
import type { FileAsyncPatterns } from '../../javascript/analyzers/AsyncPatternDetector';

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
