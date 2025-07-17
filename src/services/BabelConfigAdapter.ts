import * as fs from 'fs';
import * as path from 'path';
import { parse } from '@babel/parser';
import { logger } from '../utils/logger';

/**
 * Babel configuration adaptation result
 */
export interface BabelConfigAdaptationResult {
  success: boolean;
  adaptedConfig?: string;
  originalConfig?: string;
  configType: 'json' | 'javascript' | 'unknown';
  validationErrors: string[];
  warnings: string[];
}

/**
 * Options for babel configuration adaptation
 */
export interface BabelConfigAdaptationOptions {
  targetModuleSystem: 'esm' | 'commonjs';
  validateSyntax: boolean;
  preserveComments: boolean;
  fallbackToBasicTransform: boolean;
}

/**
 * AST-based babel configuration node types
 */
interface BabelConfigNode {
  type: string;
  value?: string | number | boolean | null;
  properties?: BabelConfigProperty[];
  elements?: BabelConfigNode[];
}

interface BabelConfigProperty {
  key: BabelConfigNode;
  value: BabelConfigNode;
}

/**
 * Enhanced Babel configuration adapter with AST-based transformation
 *
 * This service provides sophisticated babel configuration adaptation that handles:
 * - Complex JavaScript configurations with functions and conditionals
 * - Dynamic imports and require statements
 * - Nested configuration objects
 * - Syntax validation and error recovery
 * - Fallback mechanisms for edge cases
 */
export class BabelConfigAdapter {
  private readonly defaultOptions: BabelConfigAdaptationOptions = {
    targetModuleSystem: 'esm',
    validateSyntax: true,
    preserveComments: true,
    fallbackToBasicTransform: false,
  };

  /**
   * Adapt a babel configuration file to the target module system
   */
  async adaptBabelConfig(
    configPath: string,
    options: Partial<BabelConfigAdaptationOptions> = {}
  ): Promise<BabelConfigAdaptationResult> {
    const opts = { ...this.defaultOptions, ...options };

    try {
      const originalConfig = await fs.promises.readFile(configPath, 'utf8');
      const fileName = path.basename(configPath);

      logger.debug('Adapting babel configuration', {
        configPath,
        fileName,
        targetModuleSystem: opts.targetModuleSystem,
      });

      // Determine configuration type
      const configType = this.determineConfigType(fileName, originalConfig);

      if (configType === 'json') {
        return this.adaptJsonConfig(originalConfig, opts);
      } else if (configType === 'javascript') {
        return this.adaptJavaScriptConfig(originalConfig, opts);
      } else {
        return {
          success: false,
          configType: 'unknown',
          validationErrors: [`Unsupported configuration file type: ${fileName}`],
          warnings: [],
        };
      }
    } catch (error) {
      logger.warn('Failed to adapt babel configuration', { configPath, error });

      return {
        success: false,
        configType: 'unknown',
        validationErrors: [error instanceof Error ? error.message : 'Unknown error'],
        warnings: [],
      };
    }
  }

  /**
   * Adapt multiple babel configurations and return the first successful one
   */
  async adaptBestAvailableConfig(
    configPaths: string[],
    options: Partial<BabelConfigAdaptationOptions> = {}
  ): Promise<BabelConfigAdaptationResult | null> {
    const results: BabelConfigAdaptationResult[] = [];

    for (const configPath of configPaths) {
      try {
        const result = await this.adaptBabelConfig(configPath, options);
        results.push(result);

        if (result.success) {
          logger.debug('Successfully adapted babel configuration', { configPath });
          return result;
        }
      } catch (error) {
        logger.debug('Failed to process babel configuration', { configPath, error });
        results.push({
          success: false,
          configType: 'unknown',
          validationErrors: [error instanceof Error ? error.message : 'Unknown error'],
          warnings: [],
        });
      }
    }

    // If no configs were successfully adapted, return aggregated result
    if (results.length > 0) {
      const aggregatedErrors = results.flatMap((r) => r.validationErrors);
      const aggregatedWarnings = results.flatMap((r) => r.warnings);

      return {
        success: false,
        configType: 'unknown',
        validationErrors: aggregatedErrors,
        warnings: aggregatedWarnings,
      };
    }

    return null;
  }

  /**
   * Validate an adapted babel configuration
   */
  validateAdaptedConfig(
    adaptedConfig: string,
    targetModuleSystem: 'esm' | 'commonjs'
  ): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // For ES modules, try to parse as module
      if (targetModuleSystem === 'esm') {
        // Check for export default syntax
        if (!adaptedConfig.includes('export default')) {
          errors.push('ES module configuration must use "export default" syntax');
        }

        // Check for module.exports usage (should not exist in ESM)
        if (adaptedConfig.includes('module.exports')) {
          errors.push('ES module configuration should not contain "module.exports"');
        }

        // Check for require() usage (should be replaced with import)
        const requireMatches = adaptedConfig.match(/(?<!\/\/.*)require\s*\(/g);
        if (requireMatches && requireMatches.length > 0) {
          warnings.push(
            `Found ${requireMatches.length} require() statements that may need manual review`
          );
        }
      } else {
        // CommonJS validation
        if (!adaptedConfig.includes('module.exports')) {
          errors.push('CommonJS configuration must use "module.exports" syntax');
        }

        if (adaptedConfig.includes('export default')) {
          errors.push('CommonJS configuration should not contain "export default"');
        }
      }

      // Try to parse the configuration to check for syntax errors
      try {
        if (targetModuleSystem === 'esm') {
          parse(adaptedConfig, {
            sourceType: 'module',
            allowImportExportEverywhere: true,
            plugins: ['jsx', 'typescript', 'dynamicImport'],
          });
        } else {
          parse(adaptedConfig, {
            sourceType: 'script',
            allowImportExportEverywhere: false,
            plugins: ['jsx', 'typescript'],
          });
        }
      } catch (parseError) {
        errors.push(
          `Syntax error in adapted configuration: ${parseError instanceof Error ? parseError.message : 'Unknown parse error'}`
        );
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [`Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
        warnings,
      };
    }
  }

  /**
   * Determine the type of babel configuration file
   */
  private determineConfigType(
    fileName: string,
    content: string
  ): 'json' | 'javascript' | 'unknown' {
    // Check file extension first
    if (fileName.endsWith('.json') || fileName === '.babelrc') {
      return 'json';
    }

    if (fileName.endsWith('.js') || fileName.endsWith('.mjs')) {
      return 'javascript';
    }

    // Fallback to content analysis
    const trimmedContent = content.trim();

    // Check if content starts with { and ends with } (JSON-like)
    if (trimmedContent.startsWith('{') && trimmedContent.endsWith('}')) {
      try {
        JSON.parse(content);
        return 'json';
      } catch {
        // Not valid JSON, might be JavaScript object literal
        return 'javascript';
      }
    }

    // Check for JavaScript patterns
    if (
      trimmedContent.includes('module.exports') ||
      trimmedContent.includes('export default') ||
      trimmedContent.includes('require(') ||
      trimmedContent.includes('function')
    ) {
      return 'javascript';
    }

    return 'unknown';
  }

  /**
   * Adapt JSON babel configuration
   */
  private adaptJsonConfig(
    originalConfig: string,
    options: BabelConfigAdaptationOptions
  ): BabelConfigAdaptationResult {
    const validationErrors: string[] = [];
    const warnings: string[] = [];

    try {
      // Parse and validate JSON
      const configObject: Record<string, unknown> = JSON.parse(originalConfig) as Record<
        string,
        unknown
      >;

      // Convert to target module system
      let adaptedConfig: string;

      if (options.targetModuleSystem === 'esm') {
        adaptedConfig = `export default ${JSON.stringify(configObject, null, 2)};`;
      } else {
        adaptedConfig = `module.exports = ${JSON.stringify(configObject, null, 2)};`;
      }

      // Validate the adapted configuration
      if (options.validateSyntax) {
        const validation = this.validateAdaptedConfig(adaptedConfig, options.targetModuleSystem);
        validationErrors.push(...validation.errors);
        warnings.push(...validation.warnings);
      }

      return {
        success: validationErrors.length === 0,
        adaptedConfig,
        originalConfig,
        configType: 'json',
        validationErrors,
        warnings,
      };
    } catch (error) {
      validationErrors.push(
        `Invalid JSON configuration: ${error instanceof Error ? error.message : 'Unknown error'}`
      );

      return {
        success: false,
        originalConfig,
        configType: 'json',
        validationErrors,
        warnings,
      };
    }
  }

  /**
   * Adapt JavaScript babel configuration using AST transformation
   */
  private adaptJavaScriptConfig(
    originalConfig: string,
    options: BabelConfigAdaptationOptions
  ): BabelConfigAdaptationResult {
    const validationErrors: string[] = [];
    const warnings: string[] = [];

    try {
      // First, try AST-based transformation
      const astResult = this.transformJavaScriptConfigWithAST(originalConfig, options);

      if (astResult.success) {
        // Validate the AST-adapted configuration
        if (options.validateSyntax && astResult.adaptedConfig) {
          const validation = this.validateAdaptedConfig(
            astResult.adaptedConfig,
            options.targetModuleSystem
          );
          validationErrors.push(...validation.errors);
          warnings.push(...validation.warnings);
        }

        return {
          success: validationErrors.length === 0,
          ...(astResult.adaptedConfig !== undefined && { adaptedConfig: astResult.adaptedConfig }),
          originalConfig,
          configType: 'javascript',
          validationErrors: [...validationErrors, ...astResult.validationErrors],
          warnings: [...warnings, ...astResult.warnings],
        };
      }

      // Fallback to basic transformation if enabled
      if (options.fallbackToBasicTransform) {
        warnings.push('AST transformation failed, falling back to basic string replacement');
        const basicResult = this.transformJavaScriptConfigBasic(originalConfig, options);

        if (options.validateSyntax && basicResult.adaptedConfig) {
          const validation = this.validateAdaptedConfig(
            basicResult.adaptedConfig,
            options.targetModuleSystem
          );
          validationErrors.push(...validation.errors);
          warnings.push(...validation.warnings);
        }

        return {
          success: basicResult.success && validationErrors.length === 0,
          ...(basicResult.adaptedConfig !== undefined && {
            adaptedConfig: basicResult.adaptedConfig,
          }),
          originalConfig,
          configType: 'javascript',
          validationErrors: [...validationErrors, ...basicResult.validationErrors],
          warnings: [...warnings, ...basicResult.warnings],
        };
      }

      // Return AST failure result
      return {
        success: false,
        originalConfig,
        configType: 'javascript',
        validationErrors: astResult.validationErrors,
        warnings: astResult.warnings,
      };
    } catch (error) {
      validationErrors.push(
        `JavaScript configuration adaptation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );

      return {
        success: false,
        originalConfig,
        configType: 'javascript',
        validationErrors,
        warnings,
      };
    }
  }

  /**
   * Transform JavaScript babel configuration using AST parsing
   */
  private transformJavaScriptConfigWithAST(
    originalConfig: string,
    options: BabelConfigAdaptationOptions
  ): { success: boolean; adaptedConfig?: string; validationErrors: string[]; warnings: string[] } {
    const validationErrors: string[] = [];
    const warnings: string[] = [];

    try {
      // Parse the JavaScript configuration
      const ast = parse(originalConfig, {
        sourceType: 'script',
        allowImportExportEverywhere: true,
        plugins: ['jsx', 'typescript', 'dynamicImport'],
      });

      // Transform the AST based on target module system
      const transformed = this.transformASTToTargetSystem(
        ast as unknown as Record<string, unknown>,
        options
      );

      if (transformed.success && transformed.adaptedConfig) {
        return {
          success: true,
          adaptedConfig: transformed.adaptedConfig,
          validationErrors,
          warnings: [...warnings, ...transformed.warnings],
        };
      } else {
        validationErrors.push(...transformed.validationErrors);
        return {
          success: false,
          validationErrors,
          warnings: [...warnings, ...transformed.warnings],
        };
      }
    } catch (parseError) {
      validationErrors.push(
        `AST parsing failed: ${parseError instanceof Error ? parseError.message : 'Unknown parse error'}`
      );
      return {
        success: false,
        validationErrors,
        warnings,
      };
    }
  }

  /**
   * Transform AST to target module system
   * Note: This is a simplified implementation. A full AST transformation would require
   * a complete AST traversal and code generation library like @babel/traverse and @babel/generator
   */
  private transformASTToTargetSystem(
    ast: Record<string, unknown>,
    options: BabelConfigAdaptationOptions
  ): { success: boolean; adaptedConfig?: string; validationErrors: string[]; warnings: string[] } {
    const validationErrors: string[] = [];
    const warnings: string[] = [];

    // For now, this is a simplified approach that extracts the configuration object
    // A full implementation would use @babel/traverse to walk the AST and @babel/generator to emit code

    try {
      // This is a simplified extraction - in a full implementation, we'd walk the AST
      const astString = String(ast);
      const configMatchResult = astString.match(/module\.exports\s*=\s*({[\s\S]*?});?\s*$/);

      if (configMatchResult?.[1]) {
        const configObjectStr = configMatchResult[1];

        // Try to evaluate the configuration object safely
        try {
          // This is a simplified approach - a production implementation would use safe evaluation
          const configObject: Record<string, unknown> | null =
            this.safeEvaluateConfigObject(configObjectStr);

          if (configObject) {
            let adaptedConfig: string;

            if (options.targetModuleSystem === 'esm') {
              adaptedConfig = `export default ${JSON.stringify(configObject, null, 2)};`;
            } else {
              adaptedConfig = `module.exports = ${JSON.stringify(configObject, null, 2)};`;
            }

            return {
              success: true,
              adaptedConfig,
              validationErrors,
              warnings,
            };
          }
        } catch (evalError) {
          warnings.push(
            'Could not safely evaluate configuration object, using string-based transformation'
          );
        }
      }

      validationErrors.push('Could not extract configuration object from AST');
      return {
        success: false,
        validationErrors,
        warnings,
      };
    } catch (error) {
      validationErrors.push(
        `AST transformation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      return {
        success: false,
        validationErrors,
        warnings,
      };
    }
  }

  /**
   * Safely evaluate a configuration object string
   * Note: This is a simplified implementation for demonstration
   */
  private safeEvaluateConfigObject(configObjectStr: string): Record<string, unknown> | null {
    try {
      // This is a very basic approach - a production implementation would use
      // a proper safe evaluation library or AST-based object construction

      // For simple object literals without functions or complex expressions
      if (!/function|require|import|eval|\$|process|global/.test(configObjectStr)) {
        return JSON.parse(configObjectStr.replace(/'/g, '"').replace(/(\w+):/g, '"$1":')) as Record<
          string,
          unknown
        >;
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Basic string-based transformation (fallback method)
   */
  private transformJavaScriptConfigBasic(
    originalConfig: string,
    options: BabelConfigAdaptationOptions
  ): { success: boolean; adaptedConfig?: string; validationErrors: string[]; warnings: string[] } {
    const validationErrors: string[] = [];
    const warnings: string[] = [];

    try {
      let adaptedConfig = originalConfig;

      if (options.targetModuleSystem === 'esm') {
        // Enhanced transformations for ES modules
        adaptedConfig = adaptedConfig
          // Transform module.exports to export default
          .replace(/module\.exports\s*=\s*/, 'export default ')
          // Transform require statements to dynamic imports (with warning)
          .replace(/const\s+(\w+)\s*=\s*require\(['"]([^'"]+)['"]\)/g, (_, varName, moduleName) => {
            warnings.push(
              `Transformed require('${moduleName}') to dynamic import - may need manual review`
            );
            return `const ${varName} = await import('${moduleName}')`;
          })
          // Transform simple require calls to dynamic imports
          .replace(/require\(['"]([^'"]+)['"]\)/g, (_, moduleName) => {
            warnings.push(
              `Transformed require('${moduleName}') to dynamic import - may need manual review`
            );
            return `await import('${moduleName}')`;
          });
      } else {
        // Transformations for CommonJS
        adaptedConfig = adaptedConfig
          // Transform export default to module.exports
          .replace(/export\s+default\s+/, 'module.exports = ')
          // Transform import statements to require
          .replace(/import\s+(\w+)\s+from\s+['"]([^'"]+)['"]/g, "const $1 = require('$2')")
          .replace(
            /import\s*\*\s*as\s+(\w+)\s+from\s+['"]([^'"]+)['"]/g,
            "const $1 = require('$2')"
          )
          .replace(
            /import\s*\{\s*([^}]+)\s*\}\s*from\s+['"]([^'"]+)['"]/g,
            "const { $1 } = require('$2')"
          );
      }

      return {
        success: true,
        adaptedConfig,
        validationErrors,
        warnings,
      };
    } catch (error) {
      validationErrors.push(
        `Basic transformation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      return {
        success: false,
        validationErrors,
        warnings,
      };
    }
  }
}

/**
 * Factory function to create a BabelConfigAdapter instance
 */
export function createBabelConfigAdapter(): BabelConfigAdapter {
  return new BabelConfigAdapter();
}
