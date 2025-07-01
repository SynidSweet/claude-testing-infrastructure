/**
 * Claude Model Mapping Utility
 *
 * Provides consistent model name resolution across the infrastructure:
 * - Maps short names to full model identifiers
 * - Provides pricing information for cost estimation
 * - Validates model configurations
 * - Supports backward compatibility with different naming conventions
 */

export interface ModelInfo {
  /** Full Claude API model identifier */
  fullName: string;
  /** Display name for reports */
  displayName: string;
  /** Input cost per 1K tokens in USD */
  inputCostPer1K: number;
  /** Output cost per 1K tokens in USD */
  outputCostPer1K: number;
  /** Context window size */
  contextWindow: number;
  /** Best complexity range for this model [min, max] */
  bestForComplexity: [number, number];
  /** Common aliases for this model */
  aliases: string[];
}

/**
 * Comprehensive model information database
 */
export const MODEL_DATABASE: Record<string, ModelInfo> = {
  'claude-3-5-sonnet-20241022': {
    fullName: 'claude-3-5-sonnet-20241022',
    displayName: 'Claude 3.5 Sonnet',
    inputCostPer1K: 0.003,
    outputCostPer1K: 0.015,
    contextWindow: 200000,
    bestForComplexity: [5, 8],
    aliases: ['sonnet', 'claude-3-sonnet', 'claude-3-5-sonnet'],
  },
  'claude-3-opus-20240229': {
    fullName: 'claude-3-opus-20240229',
    displayName: 'Claude 3 Opus',
    inputCostPer1K: 0.015,
    outputCostPer1K: 0.075,
    contextWindow: 200000,
    bestForComplexity: [8, 10],
    aliases: ['opus', 'claude-3-opus'],
  },
  'claude-3-haiku-20240307': {
    fullName: 'claude-3-haiku-20240307',
    displayName: 'Claude 3 Haiku',
    inputCostPer1K: 0.00025,
    outputCostPer1K: 0.00125,
    contextWindow: 200000,
    bestForComplexity: [1, 5],
    aliases: ['haiku', 'claude-3-haiku'],
  },
};

/**
 * Create reverse lookup map for aliases
 */
const ALIAS_MAP: Record<string, string> = {};
for (const [fullName, info] of Object.entries(MODEL_DATABASE)) {
  // Map full name to itself
  ALIAS_MAP[fullName] = fullName;

  // Map all aliases to full name
  for (const alias of info.aliases) {
    ALIAS_MAP[alias] = fullName;
  }
}

/**
 * Resolve any model name (short name, alias, or full name) to full model identifier
 */
export function resolveModelName(modelName: string): string | null {
  return ALIAS_MAP[modelName] || null;
}

/**
 * Get model information by any valid model name or alias
 */
export function getModelInfo(modelName: string): ModelInfo | null {
  const fullName = resolveModelName(modelName);
  return fullName ? MODEL_DATABASE[fullName] || null : null;
}

/**
 * Validate if a model name is supported
 */
export function isValidModel(modelName: string): boolean {
  return resolveModelName(modelName) !== null;
}

/**
 * Get all supported model names and aliases
 */
export function getSupportedModels(): { fullNames: string[]; aliases: string[] } {
  const fullNames = Object.keys(MODEL_DATABASE);
  const aliases = Object.keys(ALIAS_MAP).filter((name) => !fullNames.includes(name));

  return { fullNames, aliases };
}

/**
 * Select optimal model based on complexity score
 */
export function selectOptimalModel(complexity: number, preferredModel?: string): string {
  // If preferred model is specified and valid, use it
  if (preferredModel && isValidModel(preferredModel)) {
    return resolveModelName(preferredModel)!;
  }

  // Find the best model for this complexity level
  for (const [fullName, info] of Object.entries(MODEL_DATABASE)) {
    const [min, max] = info.bestForComplexity;
    if (complexity >= min && complexity <= max) {
      return fullName;
    }
  }

  // Default to Sonnet if no optimal match
  return 'claude-3-5-sonnet-20241022';
}

/**
 * Get pricing information for a model
 */
export function getModelPricing(modelName: string): {
  inputCostPer1K: number;
  outputCostPer1K: number;
} | null {
  const info = getModelInfo(modelName);
  if (!info) return null;

  return {
    inputCostPer1K: info.inputCostPer1K,
    outputCostPer1K: info.outputCostPer1K,
  };
}

/**
 * Validate model configuration and provide helpful error messages
 */
export function validateModelConfiguration(modelName: string): {
  valid: boolean;
  error?: string;
  suggestion?: string;
  resolvedName?: string;
} {
  if (!modelName) {
    return {
      valid: false,
      error: 'Model name is required',
      suggestion: 'Use one of: sonnet, opus, haiku, or full model identifiers',
    };
  }

  const resolvedName = resolveModelName(modelName);

  if (!resolvedName) {
    const { aliases } = getSupportedModels();
    return {
      valid: false,
      error: `Unknown model: ${modelName}`,
      suggestion: `Supported models: ${aliases.slice(0, 6).join(', ')} (and full identifiers)`,
    };
  }

  return {
    valid: true,
    resolvedName,
  };
}

/**
 * Calculate cost for model usage
 */
export function calculateCost(modelName: string, inputTokens: number, outputTokens: number): number {
  const pricing = getModelPricing(modelName);
  if (!pricing) return 0;

  const inputCost = (inputTokens / 1000) * pricing.inputCostPer1K;
  const outputCost = (outputTokens / 1000) * pricing.outputCostPer1K;
  
  return inputCost + outputCost;
}

/**
 * Generate user-friendly model information for help/documentation
 */
export function generateModelHelp(): string {
  const lines = [
    'Supported Claude Models:',
    '',
    'Short Names (recommended):',
    '  sonnet  - Claude 3.5 Sonnet (balanced performance/cost)',
    '  opus    - Claude 3 Opus (highest quality, most expensive)',
    '  haiku   - Claude 3 Haiku (fastest, lowest cost)',
    '',
    'Full Identifiers:',
    '  claude-3-5-sonnet-20241022',
    '  claude-3-opus-20240229',
    '  claude-3-haiku-20240307',
    '',
    'Cost Comparison (per 1K tokens):',
    '  Haiku:  $0.00025 input, $0.00125 output (80-90% cheaper)',
    '  Sonnet: $0.003 input,   $0.015 output   (balanced)',
    '  Opus:   $0.015 input,   $0.075 output   (highest quality)',
    '',
  ];

  return lines.join('\n');
}
