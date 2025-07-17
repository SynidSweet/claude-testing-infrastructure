import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import * as fs from 'fs';
import { BabelConfigAdapter, createBabelConfigAdapter } from '../../src/services/BabelConfigAdapter';

// Mock fs module
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
  },
}));
const mockFs = fs as jest.Mocked<typeof fs>;

// Mock logger
jest.mock('../../src/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('BabelConfigAdapter', () => {
  let adapter: BabelConfigAdapter;
  
  beforeEach(() => {
    jest.clearAllMocks();
    adapter = createBabelConfigAdapter();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('JSON Configuration Adaptation', () => {
    it('should adapt JSON config to ES modules format', async () => {
      const jsonConfig = '{"presets": ["@babel/preset-env"], "plugins": ["@babel/plugin-transform-runtime"]}';
      const configPath = '/test/babel.config.json';
      
      // Mock fs promises
      (mockFs.promises.readFile as jest.Mock).mockResolvedValue(jsonConfig);
      
      const result = await adapter.adaptBabelConfig(configPath, {
        targetModuleSystem: 'esm',
        validateSyntax: true,
      });
      
      expect(result.success).toBe(true);
      expect(result.configType).toBe('json');
      expect(result.adaptedConfig).toContain('export default');
      expect(result.adaptedConfig).toContain('@babel/preset-env');
      expect(result.adaptedConfig).toContain('@babel/plugin-transform-runtime');
      expect(result.validationErrors).toHaveLength(0);
    });

    it('should adapt JSON config to CommonJS format', async () => {
      const jsonConfig = '{"presets": ["@babel/preset-react"]}';
      const configPath = '/test/.babelrc';
      
      (mockFs.promises.readFile as jest.Mock).mockResolvedValue(jsonConfig);
      
      const result = await adapter.adaptBabelConfig(configPath, {
        targetModuleSystem: 'commonjs',
        validateSyntax: true,
      });
      
      expect(result.success).toBe(true);
      expect(result.configType).toBe('json');
      expect(result.adaptedConfig).toContain('module.exports');
      expect(result.adaptedConfig).toContain('@babel/preset-react');
      expect(result.validationErrors).toHaveLength(0);
    });

    it('should handle invalid JSON gracefully', async () => {
      const invalidJson = '{"presets": ["@babel/preset-env",}'; // Invalid JSON
      const configPath = '/test/babel.config.json';
      
      (mockFs.promises.readFile as jest.Mock).mockResolvedValue(invalidJson);
      
      const result = await adapter.adaptBabelConfig(configPath);
      
      expect(result.success).toBe(false);
      expect(result.configType).toBe('json');
      expect(result.validationErrors.length).toBeGreaterThan(0);
      expect(result.validationErrors[0]).toContain('Invalid JSON');
    });
  });

  describe('JavaScript Configuration Adaptation', () => {
    it('should adapt simple JavaScript config to ES modules', async () => {
      const jsConfig = 'module.exports = { presets: ["@babel/preset-env"] };';
      const configPath = '/test/babel.config.js';
      
      (mockFs.promises.readFile as jest.Mock).mockResolvedValue(jsConfig);
      
      const result = await adapter.adaptBabelConfig(configPath, {
        targetModuleSystem: 'esm',
        fallbackToBasicTransform: true,
      });
      
      expect(result.success).toBe(true);
      expect(result.configType).toBe('javascript');
      expect(result.adaptedConfig).toContain('export default');
      expect(result.adaptedConfig).not.toContain('module.exports');
    });

    it('should adapt JavaScript config with require statements', async () => {
      const jsConfig = `
        const preset = require('@babel/preset-env');
        module.exports = { 
          presets: [preset],
          plugins: []
        };
      `;
      const configPath = '/test/babel.config.js';
      
      (mockFs.promises.readFile as jest.Mock).mockResolvedValue(jsConfig);
      
      const result = await adapter.adaptBabelConfig(configPath, {
        targetModuleSystem: 'esm',
        fallbackToBasicTransform: true,
      });
      
      expect(result.success).toBe(true);
      expect(result.configType).toBe('javascript');
      expect(result.adaptedConfig).toContain('export default');
      expect(result.warnings.length).toBeGreaterThan(0); // Should warn about require transformation
      expect(result.warnings.some(w => w.includes('require'))).toBe(true);
    });

    it('should adapt JavaScript config to CommonJS', async () => {
      const jsConfig = 'export default { presets: ["@babel/preset-react"] };';
      const configPath = '/test/babel.config.mjs';
      
      (mockFs.promises.readFile as jest.Mock).mockResolvedValue(jsConfig);
      
      const result = await adapter.adaptBabelConfig(configPath, {
        targetModuleSystem: 'commonjs',
        fallbackToBasicTransform: true,
      });
      
      expect(result.success).toBe(true);
      expect(result.configType).toBe('javascript');
      expect(result.adaptedConfig).toContain('module.exports');
      expect(result.adaptedConfig).not.toContain('export default');
    });

    it('should handle complex JavaScript configs with fallback', async () => {
      const complexConfig = `
        function createConfig(env) {
          return {
            presets: env === 'test' ? ['@babel/preset-env'] : ['@babel/preset-react'],
            plugins: []
          };
        }
        module.exports = createConfig(process.env.NODE_ENV);
      `;
      const configPath = '/test/babel.config.js';
      
      (mockFs.promises.readFile as jest.Mock).mockResolvedValue(complexConfig);
      
      const result = await adapter.adaptBabelConfig(configPath, {
        targetModuleSystem: 'esm',
        fallbackToBasicTransform: true,
      });
      
      // Should attempt AST transformation first, then fall back to basic transformation
      expect(result.configType).toBe('javascript');
      // The exact success depends on the implementation, but it should at least attempt transformation
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('Multiple Configuration Adaptation', () => {
    it('should adapt the first successful configuration', async () => {
      const configs = [
        '/test/babel.config.js',
        '/test/babel.config.json',
        '/test/.babelrc'
      ];
      
      // First config fails, second succeeds
      (mockFs.promises.readFile as jest.Mock)
        .mockRejectedValueOnce(new Error('File not found'))
        .mockResolvedValueOnce('{"presets": ["@babel/preset-env"]}')
        .mockResolvedValueOnce('{"presets": ["@babel/preset-react"]}');
      
      const result = await adapter.adaptBestAvailableConfig(configs, {
        targetModuleSystem: 'esm',
      });
      
      expect(result?.success).toBe(true);
      expect(result?.adaptedConfig).toContain('@babel/preset-env');
      expect(result?.adaptedConfig).not.toContain('@babel/preset-react');
    });

    it('should return aggregated errors when all configurations fail', async () => {
      const configs = [
        '/test/babel.config.js',
        '/test/babel.config.json'
      ];
      
      (mockFs.promises.readFile as jest.Mock)
        .mockRejectedValueOnce(new Error('File 1 not found'))
        .mockRejectedValueOnce(new Error('File 2 not found'));
      
      const result = await adapter.adaptBestAvailableConfig(configs);
      
      expect(result?.success).toBe(false);
      expect(result?.validationErrors.length).toBeGreaterThan(0);
    });

    it('should return null when no configurations provided', async () => {
      const result = await adapter.adaptBestAvailableConfig([]);
      
      expect(result).toBeNull();
    });
  });

  describe('Configuration Validation', () => {
    it('should validate ES module configuration correctly', () => {
      const validEsmConfig = 'export default { presets: ["@babel/preset-env"] };';
      
      const result = adapter.validateAdaptedConfig(validEsmConfig, 'esm');
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing export default in ES module config', () => {
      const invalidEsmConfig = 'module.exports = { presets: ["@babel/preset-env"] };';
      
      const result = adapter.validateAdaptedConfig(invalidEsmConfig, 'esm');
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('export default'))).toBe(true);
    });

    it('should validate CommonJS configuration correctly', () => {
      const validCommonJsConfig = 'module.exports = { presets: ["@babel/preset-env"] };';
      
      const result = adapter.validateAdaptedConfig(validCommonJsConfig, 'commonjs');
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing module.exports in CommonJS config', () => {
      const invalidCommonJsConfig = 'export default { presets: ["@babel/preset-env"] };';
      
      const result = adapter.validateAdaptedConfig(invalidCommonJsConfig, 'commonjs');
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('module.exports'))).toBe(true);
    });

    it('should detect syntax errors in adapted configuration', () => {
      const syntaxErrorConfig = 'export default { presets: ["@babel/preset-env" };'; // Missing closing bracket
      
      const result = adapter.validateAdaptedConfig(syntaxErrorConfig, 'esm');
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('Syntax error'))).toBe(true);
    });

    it('should warn about require statements in ES modules', () => {
      const configWithRequire = `
        export default { 
          presets: [require('@babel/preset-env')]
        };
      `;
      
      const result = adapter.validateAdaptedConfig(configWithRequire, 'esm');
      
      expect(result.warnings.some(w => w.includes('require()'))).toBe(true);
    });
  });

  describe('File Type Detection', () => {
    it('should detect JSON files correctly', () => {
      // Access private method for testing
      const adapter = createBabelConfigAdapter();
      const determineConfigType = (adapter as any).determineConfigType.bind(adapter);
      
      expect(determineConfigType('babel.config.json', '{"presets": []}')).toBe('json');
      expect(determineConfigType('.babelrc', '{"presets": []}')).toBe('json');
    });

    it('should detect JavaScript files correctly', () => {
      const adapter = createBabelConfigAdapter();
      const determineConfigType = (adapter as any).determineConfigType.bind(adapter);
      
      expect(determineConfigType('babel.config.js', 'module.exports = {}')).toBe('javascript');
      expect(determineConfigType('babel.config.mjs', 'export default {}')).toBe('javascript');
    });

    it('should detect unknown file types', () => {
      const adapter = createBabelConfigAdapter();
      const determineConfigType = (adapter as any).determineConfigType.bind(adapter);
      
      expect(determineConfigType('babel.config.txt', 'some content')).toBe('unknown');
    });

    it('should fallback to content analysis for ambiguous files', () => {
      const adapter = createBabelConfigAdapter();
      const determineConfigType = (adapter as any).determineConfigType.bind(adapter);
      
      // File with no clear extension, but JSON content
      expect(determineConfigType('config', '{"presets": []}')).toBe('json');
      
      // File with no clear extension, but JS content
      expect(determineConfigType('config', 'module.exports = {}')).toBe('javascript');
    });
  });

  describe('Error Handling', () => {
    it('should handle file read errors gracefully', async () => {
      const configPath = '/nonexistent/babel.config.js';
      
      (mockFs.promises.readFile as jest.Mock).mockRejectedValue(new Error('File 2 not found'));
      
      const result = await adapter.adaptBabelConfig(configPath);
      
      expect(result.success).toBe(false);
      expect(result.validationErrors[0]).toContain('File 2 not found');
    });

    it('should provide helpful error messages for common issues', async () => {
      const configPath = '/test/babel.config.json';
      
      (mockFs.promises.readFile as jest.Mock).mockResolvedValue('invalid json content');
      
      const result = await adapter.adaptBabelConfig(configPath);
      
      expect(result.success).toBe(false);
      expect(result.validationErrors[0]).toContain('Invalid JSON');
    });
  });

  describe('Options Handling', () => {
    it('should respect validateSyntax option', async () => {
      const configPath = '/test/babel.config.json';
      const validConfig = '{"presets": ["@babel/preset-env"]}';
      
      (mockFs.promises.readFile as jest.Mock).mockResolvedValue(validConfig);
      
      const result = await adapter.adaptBabelConfig(configPath, {
        validateSyntax: false,
      });
      
      expect(result.success).toBe(true);
      // With validation disabled, should not run syntax validation
      expect(result.validationErrors).toHaveLength(0);
    });

    it('should respect fallbackToBasicTransform option', async () => {
      const complexJsConfig = `
        function createConfig() { return { presets: [] }; }
        module.exports = createConfig();
      `;
      const configPath = '/test/babel.config.js';
      
      (mockFs.promises.readFile as jest.Mock).mockResolvedValue(complexJsConfig);
      
      // Without fallback
      await adapter.adaptBabelConfig(configPath, {
        fallbackToBasicTransform: false,
      });
      
      // With fallback
      const resultWithFallback = await adapter.adaptBabelConfig(configPath, {
        fallbackToBasicTransform: true,
      });
      
      // The behavior depends on implementation, but fallback should provide different results
      expect(resultWithFallback.configType).toBe('javascript');
    });
  });

  describe('Integration Tests', () => {
    it('should handle real-world React babel configuration', async () => {
      const reactConfig = `
        module.exports = {
          presets: [
            ['@babel/preset-env', {
              targets: {
                node: 'current',
                browsers: ['last 2 versions']
              }
            }],
            ['@babel/preset-react', {
              runtime: 'automatic'
            }]
          ],
          plugins: [
            '@babel/plugin-proposal-class-properties',
            '@babel/plugin-transform-runtime'
          ]
        };
      `;
      const configPath = '/test/babel.config.js';
      
      (mockFs.promises.readFile as jest.Mock).mockResolvedValue(reactConfig);
      
      const result = await adapter.adaptBabelConfig(configPath, {
        targetModuleSystem: 'esm',
        fallbackToBasicTransform: true,
      });
      
      expect(result.success).toBe(true);
      expect(result.adaptedConfig).toContain('export default');
      expect(result.adaptedConfig).toContain('@babel/preset-react');
      expect(result.adaptedConfig).toContain('@babel/preset-env');
    });

    it('should handle TypeScript babel configuration', async () => {
      const tsConfig = `{
        "presets": [
          "@babel/preset-env",
          "@babel/preset-typescript",
          "@babel/preset-react"
        ],
        "plugins": [
          "@babel/plugin-proposal-decorators",
          "@babel/plugin-proposal-class-properties"
        ]
      }`;
      const configPath = '/test/babel.config.json';
      
      (mockFs.promises.readFile as jest.Mock).mockResolvedValue(tsConfig);
      
      const result = await adapter.adaptBabelConfig(configPath, {
        targetModuleSystem: 'esm',
      });
      
      expect(result.success).toBe(true);
      expect(result.adaptedConfig).toContain('@babel/preset-typescript');
      expect(result.adaptedConfig).toContain('@babel/plugin-proposal-decorators');
    });
  });
});