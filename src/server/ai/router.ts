import { getAnthropicClient, getGeminiClient, getOpenAIClient } from "@/server/ai/clients";
import { AiBudgetService } from "@/server/ai/budget-service";
import { AiGenerationError } from "@/server/ai/errors";
import {
  estimateCostUsd,
  estimateTextTokens,
  resolveModelForTask,
  type AiModelConfig,
} from "@/server/ai/model-registry";
import type {
  AiEmbedInput,
  AiEmbedResult,
  AiGenerateTextInput,
  AiGenerateTextResult,
  AiUsage,
} from "@/server/ai/types";

export class AiRouter {
  async generateText(input: AiGenerateTextInput): Promise<AiGenerateTextResult> {
    const model = resolveModelForTask({
      taskClass: input.taskClass,
      serviceTier: input.serviceTier,
    });
    const estimatedInputTokens = estimateTextTokens(
      [input.system, input.prompt].filter(Boolean).join("\n\n"),
    );
    const estimatedOutputTokens = input.maxOutputTokens ?? 1200;
    const estimatedCostUsd = estimateCostUsd({
      model,
      inputTokens: estimatedInputTokens,
      outputTokens: estimatedOutputTokens,
    });
    const budget = new AiBudgetService(input.supabase);
    const prepared = await budget.prepareUsage({
      productId: input.productId,
      userId: input.userId,
      taskClass: input.taskClass,
      estimatedCostUsd,
    });

    try {
      const result = await this.callTextProvider({ input, model });
      const actualCostUsd = estimateCostUsd({
        model,
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        cachedInputTokens: result.usage.cachedInputTokens,
      });
      const usageEventId = await budget.recordUsage({
        userId: prepared.userId,
        productId: input.productId,
        taskClass: input.taskClass,
        provider: model.provider,
        model: model.model,
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        cachedInputTokens: result.usage.cachedInputTokens,
        estimatedCostUsd,
        actualCostUsd,
        status: "succeeded",
        metadata: sanitizeMetadata(input.metadata),
      });

      return {
        text: result.text,
        provider: model.provider,
        model: model.model,
        taskClass: input.taskClass,
        usage: result.usage,
        estimatedCostUsd,
        actualCostUsd,
        usageEventId,
      };
    } catch (error) {
      const fallbackResult = await this.maybeFallback({ input, model, error });

      if (fallbackResult) {
        const usageEventId = await budget.recordUsage({
          userId: prepared.userId,
          productId: input.productId,
          taskClass: input.taskClass,
          provider: fallbackResult.provider,
          model: fallbackResult.model,
          inputTokens: fallbackResult.usage.inputTokens,
          outputTokens: fallbackResult.usage.outputTokens,
          cachedInputTokens: fallbackResult.usage.cachedInputTokens,
          estimatedCostUsd: fallbackResult.estimatedCostUsd,
          actualCostUsd: fallbackResult.actualCostUsd,
          status: "succeeded",
          metadata: sanitizeMetadata({
            ...input.metadata,
            fallbackFrom: model.model,
          }),
        });

        return { ...fallbackResult, usageEventId };
      }

      await budget.recordUsage({
        userId: prepared.userId,
        productId: input.productId,
        taskClass: input.taskClass,
        provider: model.provider,
        model: model.model,
        inputTokens: null,
        outputTokens: null,
        cachedInputTokens: null,
        estimatedCostUsd,
        actualCostUsd: 0,
        status: "failed",
        metadata: sanitizeMetadata({
          ...input.metadata,
          error: error instanceof Error ? error.message : String(error),
        }),
      });

      throw new AiGenerationError(
        error instanceof Error ? error.message : String(error),
        { cause: error },
      );
    }
  }

  async embed(input: AiEmbedInput): Promise<AiEmbedResult> {
    const model = resolveModelForTask({ taskClass: input.taskClass });
    const texts = Array.isArray(input.input) ? input.input : [input.input];
    const estimatedInputTokens = texts.reduce(
      (sum, text) => sum + estimateTextTokens(text),
      0,
    );
    const estimatedCostUsd = estimateCostUsd({
      model,
      inputTokens: estimatedInputTokens,
      outputTokens: 0,
    });
    const budget = new AiBudgetService(input.supabase);
    const prepared = await budget.prepareUsage({
      productId: input.productId,
      userId: input.userId,
      taskClass: input.taskClass,
      estimatedCostUsd,
    });

    try {
      const client = getOpenAIClient();
      const response = await client.embeddings.create({
        model: model.model,
        input: input.input,
      });
      const usage: AiUsage = {
        inputTokens: response.usage.prompt_tokens,
        outputTokens: 0,
        cachedInputTokens: 0,
      };
      const actualCostUsd = estimateCostUsd({
        model,
        inputTokens: usage.inputTokens,
        outputTokens: 0,
      });
      const usageEventId = await budget.recordUsage({
        userId: prepared.userId,
        productId: input.productId,
        taskClass: input.taskClass,
        provider: model.provider,
        model: model.model,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        cachedInputTokens: usage.cachedInputTokens,
        estimatedCostUsd,
        actualCostUsd,
        status: "succeeded",
        metadata: sanitizeMetadata(input.metadata),
      });

      return {
        embeddings: response.data.map((item) => item.embedding),
        provider: model.provider,
        model: model.model,
        taskClass: input.taskClass,
        usage,
        estimatedCostUsd,
        actualCostUsd,
        usageEventId,
      };
    } catch (error) {
      await budget.recordUsage({
        userId: prepared.userId,
        productId: input.productId,
        taskClass: input.taskClass,
        provider: model.provider,
        model: model.model,
        inputTokens: null,
        outputTokens: null,
        cachedInputTokens: null,
        estimatedCostUsd,
        actualCostUsd: 0,
        status: "failed",
        metadata: sanitizeMetadata({
          ...input.metadata,
          error: error instanceof Error ? error.message : String(error),
        }),
      });
      throw new AiGenerationError(
        error instanceof Error ? error.message : String(error),
        { cause: error },
      );
    }
  }

  private async maybeFallback(input: {
    input: AiGenerateTextInput;
    model: AiModelConfig;
    error: unknown;
  }): Promise<Omit<AiGenerateTextResult, "usageEventId"> | null> {
    if (input.input.allowFallback === false || input.model.role !== "premium_generation") {
      return null;
    }

    const fallbackModel = resolveModelForTask({
      taskClass: input.input.taskClass,
      useFallback: true,
    });

    if (fallbackModel.model === input.model.model) {
      return null;
    }

    const result = await this.callTextProvider({
      input: input.input,
      model: fallbackModel,
    });
    const estimatedInputTokens = estimateTextTokens(
      [input.input.system, input.input.prompt].filter(Boolean).join("\n\n"),
    );
    const estimatedCostUsd = estimateCostUsd({
      model: fallbackModel,
      inputTokens: estimatedInputTokens,
      outputTokens: input.input.maxOutputTokens ?? 1200,
    });
    const actualCostUsd = estimateCostUsd({
      model: fallbackModel,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      cachedInputTokens: result.usage.cachedInputTokens,
    });

    return {
      text: result.text,
      provider: fallbackModel.provider,
      model: fallbackModel.model,
      taskClass: input.input.taskClass,
      usage: result.usage,
      estimatedCostUsd,
      actualCostUsd,
    };
  }

  private async callTextProvider(input: {
    input: AiGenerateTextInput;
    model: AiModelConfig;
  }): Promise<{ text: string; usage: AiUsage }> {
    if (input.model.provider === "anthropic") {
      return this.callAnthropic(input.input, input.model);
    }

    if (input.model.provider === "gemini") {
      return this.callGemini(input.input, input.model);
    }

    return this.callOpenAI(input.input, input.model);
  }

  private async callAnthropic(
    input: AiGenerateTextInput,
    model: AiModelConfig,
  ): Promise<{ text: string; usage: AiUsage }> {
    const client = getAnthropicClient();
    const response = await client.messages.create({
      model: model.model as never,
      max_tokens: input.maxOutputTokens ?? 1200,
      temperature: input.temperature,
      system: input.system,
      messages: [{ role: "user", content: input.prompt }],
    });

    return {
      text: extractAnthropicText(response.content),
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        cachedInputTokens: response.usage.cache_read_input_tokens ?? 0,
      },
    };
  }

  private async callGemini(
    input: AiGenerateTextInput,
    model: AiModelConfig,
  ): Promise<{ text: string; usage: AiUsage }> {
    const client = getGeminiClient();
    const response = await client.models.generateContent({
      model: model.model,
      contents: [input.system, input.prompt].filter(Boolean).join("\n\n"),
      config: {
        maxOutputTokens: input.maxOutputTokens,
        temperature: input.temperature,
        responseMimeType: input.responseMimeType,
        responseJsonSchema: input.responseJsonSchema,
      },
    });

    return {
      text: response.text ?? "",
      usage: {
        inputTokens: response.usageMetadata?.promptTokenCount ?? null,
        outputTokens: response.usageMetadata?.candidatesTokenCount ?? null,
        cachedInputTokens: 0,
      },
    };
  }

  private async callOpenAI(
    input: AiGenerateTextInput,
    model: AiModelConfig,
  ): Promise<{ text: string; usage: AiUsage }> {
    const client = getOpenAIClient();
    const response = await client.responses.create({
      model: model.model as never,
      instructions: input.system,
      input: input.prompt,
      max_output_tokens: input.maxOutputTokens,
      temperature: input.temperature,
    });

    return {
      text: response.output_text,
      usage: {
        inputTokens: response.usage?.input_tokens ?? null,
        outputTokens: response.usage?.output_tokens ?? null,
        cachedInputTokens: response.usage?.input_tokens_details.cached_tokens ?? 0,
      },
    };
  }
}

export const aiRouter = new AiRouter();

function extractAnthropicText(content: Array<{ type: string; text?: string }>): string {
  return content
    .map((block) => (block.type === "text" ? block.text : ""))
    .filter(Boolean)
    .join("\n");
}

function sanitizeMetadata(
  metadata: Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (!metadata) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(metadata).filter(
      ([key]) => !["prompt", "system", "apiKey", "secret", "credentials"].includes(key),
    ),
  );
}
