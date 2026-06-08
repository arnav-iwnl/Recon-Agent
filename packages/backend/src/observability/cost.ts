

interface ModelPricing {
  input: number;   // $ per million input tokens
  output: number;  // $ per million output tokens
}

const MODEL_PRICING: Record<string, ModelPricing> = {
  // NVIDIA NIM free tier models — $0 cost
  'moonshot/kimi-k2.6': { input: 0, output: 0 },
  'mistralai/mistral-nemo-12b-instruct': { input: 0, output: 0 },
  'mistralai/mistral-medium-3.5': { input: 0, output: 0 },
  'meta/llama-3.1-70b-instruct': { input: 0, output: 0 },

  // Custom configured models
  'openai/qwen/qwen3.5-397b-a17b': { input: 0, output: 0 },
  'openai/minimaxai/minimax-m2.7': { input: 0, output: 0 },
  'openai/deepseek-ai/deepseek-v4-flash': { input: 0, output: 0 },
  'openai/mistralai/mistral-medium-3.5-128b': { input: 0, output: 0 },
  'openai/z-ai/glm-5.1': { input: 0, output: 0 },

  // DeepInfra pricing (for reference/future use)
  'deepseek-ai/DeepSeek-V3-0324': { input: 0.26, output: 0.38 },
  'Qwen/Qwen3-235B-A22B': { input: 0.20, output: 0.60 },
};

// Default pricing for unknown models
const DEFAULT_PRICING: ModelPricing = { input: 0, output: 0 };

export function calculateCost(modelId: string, tokensIn: number, tokensOut: number): number {
  const pricing = MODEL_PRICING[modelId] || DEFAULT_PRICING;
  const inputCost = (tokensIn / 1_000_000) * pricing.input;
  const outputCost = (tokensOut / 1_000_000) * pricing.output;
  return Math.round((inputCost + outputCost) * 1_000_000) / 1_000_000; // 6 decimal places
}

export function getModelPricing(modelId: string): ModelPricing {
  return MODEL_PRICING[modelId] || DEFAULT_PRICING;
}
