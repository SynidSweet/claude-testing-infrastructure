/**
 * Tests for model mapping utility
 */

import {
  resolveModelName,
  getModelInfo,
  isValidModel,
  selectOptimalModel,
  validateModelConfiguration,
  getModelPricing,
  getSupportedModels,
  generateModelHelp
} from '../../src/utils/model-mapping';

describe('Model Mapping Utility', () => {
  describe('resolveModelName', () => {
    it('should resolve short names to full model identifiers', () => {
      expect(resolveModelName('sonnet')).toBe('claude-3-5-sonnet-20241022');
      expect(resolveModelName('opus')).toBe('claude-3-opus-20240229');
      expect(resolveModelName('haiku')).toBe('claude-3-haiku-20240307');
    });

    it('should resolve alternative short names', () => {
      expect(resolveModelName('claude-3-sonnet')).toBe('claude-3-5-sonnet-20241022');
      expect(resolveModelName('claude-3-opus')).toBe('claude-3-opus-20240229');
      expect(resolveModelName('claude-3-haiku')).toBe('claude-3-haiku-20240307');
    });

    it('should return full names unchanged when already full', () => {
      expect(resolveModelName('claude-3-5-sonnet-20241022')).toBe('claude-3-5-sonnet-20241022');
      expect(resolveModelName('claude-3-opus-20240229')).toBe('claude-3-opus-20240229');
      expect(resolveModelName('claude-3-haiku-20240307')).toBe('claude-3-haiku-20240307');
    });

    it('should return null for invalid model names', () => {
      expect(resolveModelName('invalid-model')).toBeNull();
      expect(resolveModelName('')).toBeNull();
      expect(resolveModelName('gpt-4')).toBeNull();
    });
  });

  describe('getModelInfo', () => {
    it('should return model information for valid models', () => {
      const sonnetInfo = getModelInfo('sonnet');
      expect(sonnetInfo).toBeTruthy();
      expect(sonnetInfo?.displayName).toBe('Claude 3.5 Sonnet');
      expect(sonnetInfo?.inputCostPer1K).toBe(0.003);
      expect(sonnetInfo?.outputCostPer1K).toBe(0.015);
    });

    it('should return null for invalid models', () => {
      expect(getModelInfo('invalid-model')).toBeNull();
    });
  });

  describe('isValidModel', () => {
    it('should return true for valid model names', () => {
      expect(isValidModel('sonnet')).toBe(true);
      expect(isValidModel('opus')).toBe(true);
      expect(isValidModel('haiku')).toBe(true);
      expect(isValidModel('claude-3-5-sonnet-20241022')).toBe(true);
    });

    it('should return false for invalid model names', () => {
      expect(isValidModel('invalid-model')).toBe(false);
      expect(isValidModel('')).toBe(false);
      expect(isValidModel('gpt-4')).toBe(false);
    });
  });

  describe('selectOptimalModel', () => {
    it('should select appropriate models based on complexity', () => {
      // Low complexity should use Haiku
      expect(selectOptimalModel(2)).toBe('claude-3-haiku-20240307');
      
      // Medium complexity should use Sonnet
      expect(selectOptimalModel(6)).toBe('claude-3-5-sonnet-20241022');
      
      // High complexity should use Opus
      expect(selectOptimalModel(9)).toBe('claude-3-opus-20240229');
    });

    it('should use preferred model when specified and valid', () => {
      expect(selectOptimalModel(2, 'opus')).toBe('claude-3-opus-20240229');
      expect(selectOptimalModel(9, 'haiku')).toBe('claude-3-haiku-20240307');
    });

    it('should fall back to optimal model for invalid preferred model', () => {
      expect(selectOptimalModel(2, 'invalid-model')).toBe('claude-3-haiku-20240307');
    });
  });

  describe('validateModelConfiguration', () => {
    it('should validate correct model names', () => {
      const result = validateModelConfiguration('sonnet');
      expect(result.valid).toBe(true);
      expect(result.resolvedName).toBe('claude-3-5-sonnet-20241022');
      expect(result.error).toBeUndefined();
    });

    it('should provide helpful error messages for invalid models', () => {
      const result = validateModelConfiguration('invalid-model');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Unknown model: invalid-model');
      expect(result.suggestion).toContain('Supported models:');
    });

    it('should handle empty model names', () => {
      const result = validateModelConfiguration('');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Model name is required');
    });
  });

  describe('getModelPricing', () => {
    it('should return pricing information for valid models', () => {
      const pricing = getModelPricing('sonnet');
      expect(pricing).toBeTruthy();
      expect(pricing?.inputCostPer1K).toBe(0.003);
      expect(pricing?.outputCostPer1K).toBe(0.015);
    });

    it('should return null for invalid models', () => {
      expect(getModelPricing('invalid-model')).toBeNull();
    });
  });

  describe('getSupportedModels', () => {
    it('should return comprehensive list of supported models', () => {
      const { fullNames, aliases } = getSupportedModels();
      
      expect(fullNames).toContain('claude-3-5-sonnet-20241022');
      expect(fullNames).toContain('claude-3-opus-20240229');
      expect(fullNames).toContain('claude-3-haiku-20240307');
      
      expect(aliases).toContain('sonnet');
      expect(aliases).toContain('opus');
      expect(aliases).toContain('haiku');
    });
  });

  describe('generateModelHelp', () => {
    it('should generate helpful documentation', () => {
      const help = generateModelHelp();
      expect(help).toContain('Supported Claude Models:');
      expect(help).toContain('sonnet');
      expect(help).toContain('opus');
      expect(help).toContain('haiku');
      expect(help).toContain('Cost Comparison');
    });
  });
});

describe('Integration with CostEstimator patterns', () => {
  it('should work with common model naming patterns from user feedback', () => {
    // These are the patterns mentioned in the user feedback issue
    expect(resolveModelName('sonnet')).toBe('claude-3-5-sonnet-20241022');
    expect(resolveModelName('haiku')).toBe('claude-3-haiku-20240307');
    
    // Validate that these would not cause "Unknown model" warnings anymore
    const sonnetValidation = validateModelConfiguration('sonnet');
    const haikuValidation = validateModelConfiguration('haiku');
    
    expect(sonnetValidation.valid).toBe(true);
    expect(haikuValidation.valid).toBe(true);
    
    // Ensure pricing information is available
    expect(getModelPricing('sonnet')).toBeTruthy();
    expect(getModelPricing('haiku')).toBeTruthy();
  });
});