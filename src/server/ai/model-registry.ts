import type {
  AiModelRole,
  AiProvider,
  AiServiceTier,
  AiTaskClass,
} from "@/server/ai/types";

type ModelPricing = {
  inputPerMillionUsd: number;
  outputPerMillionUsd: number;
  cachedInputPerMillionUsd?: number;
};

export type AiModelConfig = {
  provider: AiProvider;
  model: string;
  role: AiModelRole;
  pricing: ModelPricing;
  supportsBatch: boolean;
  supportsFlex: boolean;
  supportsPromptCaching: boolean;
};

export type AiTaskRoute = {
  defaultModel: string;
  fallbackModel?: string;
  premiumVisibleOutput: boolean;
  batchEligible: boolean;
  flexEligible: boolean;
};

export const aiModels: Record<string, AiModelConfig> = {
  "claude-sonnet-4-6": {
    provider: "anthropic",
    model: "claude-sonnet-4-6",
    role: "premium_generation",
    pricing: {
      inputPerMillionUsd: 3,
      outputPerMillionUsd: 15,
      cachedInputPerMillionUsd: 0.3,
    },
    supportsBatch: true,
    supportsFlex: false,
    supportsPromptCaching: true,
  },
  "gemini-2.5-flash": {
    provider: "gemini",
    model: "gemini-2.5-flash",
    role: "utility_analysis",
    pricing: {
      inputPerMillionUsd: 0.3,
      outputPerMillionUsd: 2.5,
      cachedInputPerMillionUsd: 0.03,
    },
    supportsBatch: true,
    supportsFlex: true,
    supportsPromptCaching: true,
  },
  "text-embedding-3-small": {
    provider: "openai",
    model: "text-embedding-3-small",
    role: "embedding",
    pricing: {
      inputPerMillionUsd: 0.02,
      outputPerMillionUsd: 0,
    },
    supportsBatch: true,
    supportsFlex: false,
    supportsPromptCaching: false,
  },
  "gpt-5.5": {
    provider: "openai",
    model: "gpt-5.5",
    role: "fallback_generation",
    pricing: {
      inputPerMillionUsd: 1.75,
      outputPerMillionUsd: 14,
      cachedInputPerMillionUsd: 0.175,
    },
    supportsBatch: true,
    supportsFlex: true,
    supportsPromptCaching: true,
  },
};

export const aiTaskRoutes: Record<AiTaskClass, AiTaskRoute> = {
  crawl_extraction: utilityRoute(),
  competitor_summary: utilityRoute(),
  brief_generation: premiumRoute(),
  positioning_generation: premiumRoute(),
  keyword_expansion: utilityRoute(),
  keyword_clustering: {
    defaultModel: "text-embedding-3-small",
    premiumVisibleOutput: false,
    batchEligible: true,
    flexEligible: false,
  },
  seo_article_outline: premiumRoute(),
  seo_article_draft: premiumRoute(),
  seo_review: utilityRoute(),
  community_thread_scoring: utilityRoute(),
  community_reply_draft: premiumRoute(),
  authenticity_scoring: utilityRoute(),
  directory_listing_generation: premiumRoute(),
  directory_listing_variant: utilityRoute(),
  outreach_prospect_research: utilityRoute(),
  outreach_email_draft: premiumRoute(),
  followup_email_draft: utilityRoute(),
  weekly_summary: utilityRoute(),
  weekly_recommendation: premiumRoute(),
};

export function resolveModelForTask(input: {
  taskClass: AiTaskClass;
  useFallback?: boolean;
  serviceTier?: AiServiceTier;
}): AiModelConfig {
  const route = aiTaskRoutes[input.taskClass];
  const modelKey = input.useFallback && route.fallbackModel ? route.fallbackModel : route.defaultModel;
  const model = aiModels[modelKey];

  if (!model) {
    throw new Error(`No AI model configured for task ${input.taskClass}.`);
  }

  if (input.serviceTier === "batch" && !model.supportsBatch) {
    return aiModels[route.defaultModel] ?? model;
  }

  if (input.serviceTier === "flex" && !model.supportsFlex) {
    return aiModels[route.defaultModel] ?? model;
  }

  return model;
}

export function estimateCostUsd(input: {
  model: AiModelConfig;
  inputTokens?: number | null;
  outputTokens?: number | null;
  cachedInputTokens?: number | null;
}): number {
  const inputTokens = input.inputTokens ?? 0;
  const outputTokens = input.outputTokens ?? 0;
  const cachedInputTokens = input.cachedInputTokens ?? 0;
  const uncachedInputTokens = Math.max(inputTokens - cachedInputTokens, 0);

  return roundCost(
    (uncachedInputTokens / 1_000_000) * input.model.pricing.inputPerMillionUsd +
      (cachedInputTokens / 1_000_000) *
        (input.model.pricing.cachedInputPerMillionUsd ?? input.model.pricing.inputPerMillionUsd) +
      (outputTokens / 1_000_000) * input.model.pricing.outputPerMillionUsd,
  );
}

export function estimateTextTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

function premiumRoute(): AiTaskRoute {
  return {
    defaultModel: "claude-sonnet-4-6",
    fallbackModel: "gpt-5.5",
    premiumVisibleOutput: true,
    batchEligible: false,
    flexEligible: false,
  };
}

function utilityRoute(): AiTaskRoute {
  return {
    defaultModel: "gemini-2.5-flash",
    premiumVisibleOutput: false,
    batchEligible: true,
    flexEligible: true,
  };
}

function roundCost(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}
