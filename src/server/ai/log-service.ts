import type { SupabaseClient } from "@supabase/supabase-js";
import type { AiProvider, AiTaskClass, AiUsage } from "@/server/ai/types";

const MAX_TEXT_LENGTH = 40_000;
const REDACTION_PATTERNS = [
  /(api[_-]?key|secret|token|password|authorization)\s*[:=]\s*["']?[^"',\s}]+/gi,
  /(bearer\s+)[a-z0-9._~+/-]+/gi,
];

export class AiGenerationLogService {
  constructor(private readonly supabase: SupabaseClient) {}

  async create(input: {
    usageEventId: string | null;
    userId: string;
    productId: string;
    taskClass: AiTaskClass;
    provider: AiProvider;
    model: string;
    status: "succeeded" | "failed";
    system?: string;
    prompt: string;
    responseText?: string;
    errorMessage?: string;
    usage?: AiUsage;
    estimatedCostUsd: number;
    actualCostUsd: number;
    metadata?: Record<string, unknown>;
  }) {
    const { error } = await this.supabase.from("ai_generation_logs").insert({
      usage_event_id: input.usageEventId,
      user_id: input.userId,
      product_id: input.productId,
      task_class: input.taskClass,
      provider: input.provider,
      model: input.model,
      status: input.status,
      system_text: sanitizeLogText(input.system),
      prompt_text: sanitizeLogText(input.prompt),
      response_text: sanitizeLogText(input.responseText),
      error_message: sanitizeLogText(input.errorMessage, 4_000),
      input_tokens: input.usage?.inputTokens ?? null,
      output_tokens: input.usage?.outputTokens ?? null,
      cached_input_tokens: input.usage?.cachedInputTokens ?? null,
      estimated_cost_usd: input.estimatedCostUsd,
      actual_cost_usd: input.actualCostUsd,
      metadata: sanitizeLogMetadata(input.metadata),
    });

    if (error) {
      return null;
    }

    return true;
  }
}

export function sanitizeLogText(value: string | undefined, maxLength = MAX_TEXT_LENGTH) {
  if (!value) {
    return null;
  }

  const redacted = REDACTION_PATTERNS.reduce(
    (text, pattern) => text.replace(pattern, (_match, prefix = "") => `${prefix}[REDACTED]`),
    value,
  );

  return redacted.length > maxLength ? `${redacted.slice(0, maxLength)}\n[TRUNCATED]` : redacted;
}

function sanitizeLogMetadata(metadata: Record<string, unknown> | undefined) {
  if (!metadata) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(metadata).filter(
      ([key]) => !["prompt", "system", "apiKey", "secret", "credentials", "password", "token"].includes(key),
    ),
  );
}
