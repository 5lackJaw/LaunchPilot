import type { SupabaseClient } from "@supabase/supabase-js";

export type AiProvider = "anthropic" | "gemini" | "openai";

export type AiModelRole =
  | "premium_generation"
  | "utility_analysis"
  | "embedding"
  | "fallback_generation";

export type AiTaskClass =
  | "brief_persona_analysis"
  | "brief_keyword_analysis"
  | "brief_generation"
  | "positioning_generation"
  | "seo_article_outline"
  | "seo_article_draft"
  | "seo_review"
  | "crawl_extraction"
  | "competitor_summary"
  | "keyword_expansion"
  | "keyword_clustering"
  | "community_thread_scoring"
  | "community_reply_draft"
  | "authenticity_scoring"
  | "directory_listing_generation"
  | "directory_listing_variant"
  | "outreach_prospect_research"
  | "outreach_email_draft"
  | "followup_email_draft"
  | "weekly_summary"
  | "weekly_recommendation";

export type AiServiceTier = "standard" | "batch" | "flex";

export type AiUsage = {
  inputTokens: number | null;
  outputTokens: number | null;
  cachedInputTokens: number | null;
};

export type AiCallContext = {
  supabase: SupabaseClient;
  productId: string;
  userId?: string;
};

export type AiGenerateTextInput = AiCallContext & {
  taskClass: AiTaskClass;
  prompt: string;
  system?: string;
  maxOutputTokens?: number;
  temperature?: number;
  serviceTier?: AiServiceTier;
  allowFallback?: boolean;
  responseMimeType?: "application/json" | "text/plain";
  responseJsonSchema?: unknown;
  metadata?: Record<string, unknown>;
};

export type AiGenerateTextResult = {
  text: string;
  provider: AiProvider;
  model: string;
  taskClass: AiTaskClass;
  usage: AiUsage;
  estimatedCostUsd: number;
  actualCostUsd: number;
  usageEventId: string | null;
};

export type AiEmbedInput = AiCallContext & {
  taskClass: Extract<AiTaskClass, "keyword_clustering">;
  input: string | string[];
  metadata?: Record<string, unknown>;
};

export type AiEmbedResult = {
  embeddings: number[][];
  provider: AiProvider;
  model: string;
  taskClass: AiTaskClass;
  usage: AiUsage;
  estimatedCostUsd: number;
  actualCostUsd: number;
  usageEventId: string | null;
};
