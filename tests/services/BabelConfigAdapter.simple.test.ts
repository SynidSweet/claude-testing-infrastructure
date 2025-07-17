import { describe, it, expect } from '@jest/globals';
import { createBabelConfigAdapter } from '../../src/services/BabelConfigAdapter';

// Mock logger
jest.mock('../../src/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('BabelConfigAdapter - Core Functionality', () => {
  it('should create a BabelConfigAdapter instance', () => {
    const adapter = createBabelConfigAdapter();
    expect(adapter).toBeDefined();
    expect(typeof adapter.validateAdaptedConfig).toBe('function');
  });

  it('should validate ES module configuration', () => {
    const adapter = createBabelConfigAdapter();
    const validEsmConfig = 'export default { presets: ["@babel/preset-env"] };';
    
    const result = adapter.validateAdaptedConfig(validEsmConfig, 'esm');
    
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should validate CommonJS configuration', () => {
    const adapter = createBabelConfigAdapter();
    const validCommonJsConfig = 'module.exports = { presets: ["@babel/preset-env"] };';
    
    const result = adapter.validateAdaptedConfig(validCommonJsConfig, 'commonjs');
    
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should detect incorrect module system usage', () => {
    const adapter = createBabelConfigAdapter();
    
    // ES module syntax in CommonJS context
    const esmInCommonJs = 'export default { presets: ["@babel/preset-env"] };';
    const commonJsResult = adapter.validateAdaptedConfig(esmInCommonJs, 'commonjs');
    
    expect(commonJsResult.isValid).toBe(false);
    expect(commonJsResult.errors.some(e => e.includes('module.exports'))).toBe(true);
    
    // CommonJS syntax in ES module context  
    const commonJsInEsm = 'module.exports = { presets: ["@babel/preset-env"] };';
    const esmResult = adapter.validateAdaptedConfig(commonJsInEsm, 'esm');
    
    expect(esmResult.isValid).toBe(false);
    expect(esmResult.errors.some(e => e.includes('export default'))).toBe(true);
  });

  it('should provide warnings for require statements in ES modules', () => {
    const adapter = createBabelConfigAdapter();
    const configWithRequire = `
      export default { 
        presets: [require('@babel/preset-env')]
      };
    `;
    
    const result = adapter.validateAdaptedConfig(configWithRequire, 'esm');
    
    expect(result.warnings.some(w => w.includes('require()'))).toBe(true);
  });

  it('should detect file types correctly', () => {
    const adapter = createBabelConfigAdapter();
    
    // Access private method for testing
    const determineConfigType = (adapter as any).determineConfigType.bind(adapter);
    
    expect(determineConfigType('babel.config.json', '{"presets": []}')).toBe('json');
    expect(determineConfigType('.babelrc', '{"presets": []}')).toBe('json');
    expect(determineConfigType('babel.config.js', 'module.exports = {}')).toBe('javascript');
    expect(determineConfigType('babel.config.mjs', 'export default {}')).toBe('javascript');
    expect(determineConfigType('unknown.txt', 'some content')).toBe('unknown');
  });
});